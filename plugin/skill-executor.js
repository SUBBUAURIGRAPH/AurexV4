#!/usr/bin/env node

/**
 * Aurigraph Agents - Skill Executor Framework
 * Orchestrates execution of developer tools skills with dynamic loading,
 * error handling, and comprehensive execution context management
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const EventEmitter = require('events');

/**
 * Custom error classes for skill execution
 */
class SkillError extends Error {
  constructor(message, skillName, originalError = null) {
    super(message);
    this.name = 'SkillError';
    this.skillName = skillName;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

class SkillNotFoundError extends SkillError {
  constructor(skillName) {
    super(`Skill '${skillName}' not found`, skillName);
    this.name = 'SkillNotFoundError';
  }
}

class SkillValidationError extends SkillError {
  constructor(skillName, validationErrors) {
    super(`Skill '${skillName}' validation failed`, skillName);
    this.name = 'SkillValidationError';
    this.validationErrors = validationErrors;
  }
}

class SkillExecutionError extends SkillError {
  constructor(skillName, message, originalError = null) {
    super(`Skill '${skillName}' execution failed: ${message}`, skillName, originalError);
    this.name = 'SkillExecutionError';
  }
}

class SkillTimeoutError extends SkillError {
  constructor(skillName, timeout) {
    super(`Skill '${skillName}' timed out after ${timeout}ms`, skillName);
    this.name = 'SkillTimeoutError';
    this.timeout = timeout;
  }
}

/**
 * SkillExecutor - Main orchestrator for developer tools skills
 *
 * Responsibilities:
 * - Dynamic skill loading from plugin/skills/ directory
 * - Execution context building with utilities and environment
 * - Error handling with retry logic
 * - Skill lifecycle management (validation, execution, formatting)
 * - Performance monitoring and metrics
 *
 * @class
 * @extends EventEmitter
 */
class SkillExecutor extends EventEmitter {
  /**
   * Initialize the SkillExecutor
   *
   * @param {Object} options - Configuration options
   * @param {string} options.skillsPath - Path to skills directory
   * @param {boolean} options.hotReload - Enable hot-reloading in development
   * @param {number} options.defaultTimeout - Default execution timeout in ms
   * @param {number} options.maxRetries - Maximum retry attempts
   * @param {boolean} options.verbose - Enable verbose logging
   * @param {Object} options.logger - Custom logger instance
   * @param {Object} options.environmentLoader - Environment loader instance
   */
  constructor(options = {}) {
    super();

    this.version = '1.0.0';
    this.skillsPath = options.skillsPath || path.join(__dirname, 'skills');
    this.hotReload = options.hotReload !== undefined ? options.hotReload : process.env.NODE_ENV === 'development';
    this.defaultTimeout = options.defaultTimeout || 300000; // 5 minutes
    this.maxRetries = options.maxRetries || 3;
    this.verbose = options.verbose || false;
    this.logger = options.logger || console;
    this.environmentLoader = options.environmentLoader || null;

    // Skill cache for lazy loading
    this.skillCache = new Map();
    this.skillMetadata = new Map();
    this.executionHistory = [];

    // Performance metrics
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0
    };

    this._initialized = false;
  }

  /**
   * Initialize the executor and discover available skills
   *
   * @returns {Promise<Object>} Initialization result with discovered skills
   */
  async initialize() {
    if (this._initialized) {
      return { success: true, message: 'Already initialized' };
    }

    try {
      // Ensure skills directory exists
      if (!fs.existsSync(this.skillsPath)) {
        fs.mkdirSync(this.skillsPath, { recursive: true });
        if (this.verbose) {
          this.logger.log(`Created skills directory at ${this.skillsPath}`);
        }
      }

      // Discover available skills
      await this.discoverSkills();

      this._initialized = true;
      this.emit('initialized', { skillCount: this.skillMetadata.size });

      if (this.verbose) {
        this.logger.log(`SkillExecutor initialized with ${this.skillMetadata.size} skills`);
      }

      return {
        success: true,
        skillsDiscovered: this.skillMetadata.size,
        skillsPath: this.skillsPath
      };
    } catch (error) {
      this.emit('error', error);
      throw new SkillError('Initialization failed', 'system', error);
    }
  }

  /**
   * Discover all available skills in the skills directory
   *
   * @returns {Promise<Map>} Map of skill metadata
   */
  async discoverSkills() {
    if (!fs.existsSync(this.skillsPath)) {
      return this.skillMetadata;
    }

    try {
      const files = fs.readdirSync(this.skillsPath)
        .filter(file => file.endsWith('.js'));

      for (const file of files) {
        try {
          const skillPath = path.join(this.skillsPath, file);
          const skillName = file.replace('.js', '');

          // Load skill metadata without executing
          const metadata = await this.loadSkillMetadata(skillName, skillPath);

          if (metadata) {
            this.skillMetadata.set(skillName, metadata);

            if (this.verbose) {
              this.logger.log(`Discovered skill: ${skillName}`);
            }
          }
        } catch (error) {
          if (this.verbose) {
            this.logger.warn(`Failed to discover skill ${file}: ${error.message}`);
          }
        }
      }

      return this.skillMetadata;
    } catch (error) {
      this.logger.error(`Failed to discover skills: ${error.message}`);
      return this.skillMetadata;
    }
  }

  /**
   * Load skill metadata without full module loading
   *
   * @param {string} skillName - Name of the skill
   * @param {string} skillPath - Path to skill file
   * @returns {Promise<Object>} Skill metadata
   */
  async loadSkillMetadata(skillName, skillPath) {
    try {
      // For now, load the module to get metadata
      // In production, could parse file for metadata without execution
      const skill = require(skillPath);

      return {
        name: skill.name || skillName,
        description: skill.description || 'No description available',
        version: skill.version || '1.0.0',
        parameters: skill.parameters || {},
        output: skill.output || 'any',
        timeout: skill.timeout || this.defaultTimeout,
        retries: skill.retries !== undefined ? skill.retries : this.maxRetries,
        path: skillPath,
        loadedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new SkillError(`Failed to load metadata for ${skillName}`, skillName, error);
    }
  }

  /**
   * Load a skill module dynamically
   *
   * @param {string} skillName - Name of the skill to load
   * @returns {Promise<Object>} Loaded skill module
   */
  async loadSkill(skillName) {
    // Check cache first
    if (!this.hotReload && this.skillCache.has(skillName)) {
      return this.skillCache.get(skillName);
    }

    const metadata = this.skillMetadata.get(skillName);
    if (!metadata) {
      throw new SkillNotFoundError(skillName);
    }

    try {
      // Clear from require cache if hot-reloading
      if (this.hotReload && require.cache[metadata.path]) {
        delete require.cache[metadata.path];
      }

      const skill = require(metadata.path);

      // Validate skill structure
      this.validateSkillStructure(skill, skillName);

      // Cache the loaded skill
      this.skillCache.set(skillName, skill);

      if (this.verbose) {
        this.logger.log(`Loaded skill: ${skillName}`);
      }

      return skill;
    } catch (error) {
      if (error instanceof SkillError) {
        throw error;
      }
      throw new SkillError(`Failed to load skill '${skillName}'`, skillName, error);
    }
  }

  /**
   * Validate skill module structure
   *
   * @param {Object} skill - Skill module
   * @param {string} skillName - Skill name for error reporting
   * @throws {SkillValidationError} If skill structure is invalid
   */
  validateSkillStructure(skill, skillName) {
    const errors = [];

    if (!skill.name) {
      errors.push('Skill must have a name property');
    }

    if (!skill.execute || typeof skill.execute !== 'function') {
      errors.push('Skill must have an execute function');
    }

    if (skill.parameters && typeof skill.parameters !== 'object') {
      errors.push('Skill parameters must be an object');
    }

    if (errors.length > 0) {
      throw new SkillValidationError(skillName, errors);
    }
  }

  /**
   * Validate parameters against skill definition
   *
   * @param {string} skillName - Name of the skill
   * @param {Object} parameters - Parameters to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateParameters(skillName, parameters = {}) {
    const skill = await this.loadSkill(skillName);
    const errors = [];

    if (!skill.parameters) {
      return { valid: true, errors: [] };
    }

    // Check required parameters
    for (const [paramName, paramDef] of Object.entries(skill.parameters)) {
      if (paramDef.required && !(paramName in parameters)) {
        errors.push(`Missing required parameter: ${paramName}`);
      }

      // Type validation
      if (paramName in parameters && paramDef.type) {
        const actualType = typeof parameters[paramName];
        const expectedType = paramDef.type;

        if (actualType !== expectedType) {
          errors.push(`Parameter '${paramName}' expected type ${expectedType}, got ${actualType}`);
        }
      }

      // Custom validation
      if (paramName in parameters && paramDef.validate && typeof paramDef.validate === 'function') {
        try {
          const isValid = paramDef.validate(parameters[paramName]);
          if (!isValid) {
            errors.push(`Parameter '${paramName}' failed custom validation`);
          }
        } catch (error) {
          errors.push(`Parameter '${paramName}' validation error: ${error.message}`);
        }
      }
    }

    const valid = errors.length === 0;

    if (!valid) {
      throw new SkillValidationError(skillName, errors);
    }

    return { valid, errors };
  }

  /**
   * Build execution context for skill
   *
   * @param {Object} parameters - Execution parameters
   * @returns {Object} Execution context
   */
  buildContext(parameters = {}) {
    const context = {
      // Parameters
      parameters,

      // Environment
      environment: process.env.NODE_ENV || 'development',
      projectRoot: path.join(__dirname, '..'),

      // Utilities
      logger: this.logger,
      fs,
      path,
      util,

      // Environment loader
      environmentLoader: this.environmentLoader,

      // Helpers
      helpers: {
        formatDate: (date) => new Date(date).toISOString(),
        formatBytes: (bytes) => {
          if (bytes === 0) return '0 Bytes';
          const k = 1024;
          const sizes = ['Bytes', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        },
        sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
      },

      // Execution metadata
      executionId: this.generateExecutionId(),
      timestamp: new Date().toISOString()
    };

    return context;
  }

  /**
   * Execute a skill with parameters
   *
   * @param {string} skillName - Name of the skill to execute
   * @param {Object} parameters - Execution parameters
   * @param {Object} options - Execution options (timeout, retries)
   * @returns {Promise<Object>} Execution result
   */
  async execute(skillName, parameters = {}, options = {}) {
    const startTime = Date.now();
    const executionId = this.generateExecutionId();

    // Load the skill first to get metadata timeout
    const skill = await this.loadSkill(skillName);

    const executionOptions = {
      timeout: options.timeout || skill.timeout || this.defaultTimeout,
      retries: options.retries !== undefined ? options.retries : this.maxRetries,
      ...options
    };

    try {

      // Validate parameters
      await this.validateParameters(skillName, parameters);

      // Build execution context
      const context = this.buildContext(parameters);

      // Execute with timeout and retry logic
      const result = await this.executeWithRetry(
        skill,
        skillName,
        context,
        executionOptions
      );

      // Format result
      const formattedResult = await this.formatResult(skill, result);

      const executionTime = Date.now() - startTime;

      // Update metrics
      this.updateMetrics(true, executionTime);

      // Record execution
      this.recordExecution({
        executionId,
        skillName,
        success: true,
        executionTime,
        timestamp: new Date().toISOString()
      });

      this.emit('execution:success', {
        skillName,
        executionId,
        executionTime,
        result: formattedResult
      });

      if (this.verbose) {
        this.logger.log(`Skill '${skillName}' executed successfully in ${executionTime}ms`);
      }

      return {
        success: true,
        skillName,
        executionId,
        result: formattedResult,
        executionTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Update metrics
      this.updateMetrics(false, executionTime);

      // Record execution
      this.recordExecution({
        executionId,
        skillName,
        success: false,
        error: error.message,
        executionTime,
        timestamp: new Date().toISOString()
      });

      this.emit('execution:error', {
        skillName,
        executionId,
        error,
        executionTime
      });

      throw this.handleError(error, skillName);
    }
  }

  /**
   * Execute skill with retry logic
   *
   * @param {Object} skill - Skill module
   * @param {string} skillName - Skill name
   * @param {Object} context - Execution context
   * @param {Object} options - Execution options
   * @returns {Promise<any>} Execution result
   */
  async executeWithRetry(skill, skillName, context, options) {
    let lastError = null;
    let attempt = 0;

    while (attempt <= options.retries) {
      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(
          skill.execute(context),
          options.timeout,
          skillName
        );

        return result;

      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt <= options.retries) {
          if (this.verbose) {
            this.logger.warn(`Skill '${skillName}' failed (attempt ${attempt}/${options.retries + 1}), retrying...`);
          }

          // Exponential backoff
          await this.sleep(Math.pow(2, attempt - 1) * 1000);
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute with timeout
   *
   * @param {Promise} promise - Promise to execute
   * @param {number} timeout - Timeout in milliseconds
   * @param {string} skillName - Skill name for error reporting
   * @returns {Promise<any>} Result or timeout error
   */
  executeWithTimeout(promise, timeout, skillName) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new SkillTimeoutError(skillName, timeout)), timeout);
      })
    ]);
  }

  /**
   * Format execution result using skill's formatter if available
   *
   * @param {Object} skill - Skill module
   * @param {any} result - Raw execution result
   * @returns {Promise<any>} Formatted result
   */
  async formatResult(skill, result) {
    if (skill.formatResult && typeof skill.formatResult === 'function') {
      try {
        return await skill.formatResult(result);
      } catch (error) {
        if (this.verbose) {
          this.logger.warn(`Failed to format result: ${error.message}`);
        }
        return result;
      }
    }

    return result;
  }

  /**
   * Handle execution errors
   *
   * @param {Error} error - Error to handle
   * @param {string} skillName - Skill name
   * @returns {SkillError} Wrapped error
   */
  handleError(error, skillName) {
    if (error instanceof SkillError) {
      return error;
    }

    return new SkillExecutionError(skillName, error.message, error);
  }

  /**
   * List all available skills
   *
   * @returns {Promise<Array>} Array of skill information
   */
  async listSkills() {
    if (!this._initialized) {
      await this.initialize();
    }

    const skills = [];

    for (const [name, metadata] of this.skillMetadata) {
      skills.push({
        name: metadata.name,
        description: metadata.description,
        version: metadata.version,
        parameters: Object.keys(metadata.parameters || {}),
        timeout: metadata.timeout,
        retries: metadata.retries
      });
    }

    return skills.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get detailed metadata for a specific skill
   *
   * @param {string} skillName - Name of the skill
   * @returns {Promise<Object>} Skill metadata
   */
  async getSkillMetadata(skillName) {
    if (!this._initialized) {
      await this.initialize();
    }

    const metadata = this.skillMetadata.get(skillName);
    if (!metadata) {
      throw new SkillNotFoundError(skillName);
    }

    return { ...metadata };
  }

  /**
   * Update performance metrics
   *
   * @param {boolean} success - Whether execution succeeded
   * @param {number} executionTime - Execution time in milliseconds
   */
  updateMetrics(success, executionTime) {
    this.metrics.totalExecutions++;

    if (success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }

    this.metrics.totalExecutionTime += executionTime;
    this.metrics.averageExecutionTime = Math.round(
      this.metrics.totalExecutionTime / this.metrics.totalExecutions
    );
  }

  /**
   * Record execution in history
   *
   * @param {Object} execution - Execution record
   */
  recordExecution(execution) {
    this.executionHistory.push(execution);

    // Keep only last 100 executions
    if (this.executionHistory.length > 100) {
      this.executionHistory.shift();
    }
  }

  /**
   * Get performance metrics
   *
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Get execution history
   *
   * @param {number} limit - Maximum number of records to return
   * @returns {Array} Execution history
   */
  getExecutionHistory(limit = 20) {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Generate unique execution ID
   *
   * @returns {string} Unique execution ID
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep helper
   *
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear skill cache
   */
  clearCache() {
    this.skillCache.clear();
    if (this.verbose) {
      this.logger.log('Skill cache cleared');
    }
  }

  /**
   * Reload a specific skill
   *
   * @param {string} skillName - Name of skill to reload
   * @returns {Promise<Object>} Reloaded skill
   */
  async reloadSkill(skillName) {
    this.skillCache.delete(skillName);
    return await this.loadSkill(skillName);
  }
}

// Export classes
module.exports = SkillExecutor;
module.exports.SkillError = SkillError;
module.exports.SkillNotFoundError = SkillNotFoundError;
module.exports.SkillValidationError = SkillValidationError;
module.exports.SkillExecutionError = SkillExecutionError;
module.exports.SkillTimeoutError = SkillTimeoutError;
