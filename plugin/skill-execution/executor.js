/**
 * Skill Execution Framework
 * Handles skill invocation with parameter validation, logging, and history tracking
 * @version 1.0.0
 */

const crypto = require('crypto');

/**
 * Skill Executor
 * @class SkillExecutor
 * @description Executes skills with validation, logging, and history tracking
 */
class SkillExecutor {
  /**
   * Initialize Skill Executor
   * @param {Object} config - Configuration object
   * @param {Object} config.plugin - Aurigraph plugin instance
   * @param {Object} config.logger - Logger instance
   */
  constructor(config = {}) {
    this.plugin = config.plugin;
    this.logger = config.logger || console;
    this.executionHistory = [];
    this.executionStats = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      totalDuration: 0
    };
    this.parameterSchemas = new Map();
    this.executionContexts = new Map();
  }

  /**
   * Define parameter schema for a skill
   * @param {string} skillId - Skill ID
   * @param {Object} schema - Parameter schema definition
   */
  defineParameterSchema(skillId, schema) {
    this.parameterSchemas.set(skillId, schema);
  }

  /**
   * Get parameter schema for skill
   * @param {string} skillId - Skill ID
   * @returns {Object|null} Schema or null
   */
  getParameterSchema(skillId) {
    return this.parameterSchemas.get(skillId) || null;
  }

  /**
   * Validate parameters against schema
   * @param {Object} parameters - Parameters to validate
   * @param {Object} schema - Parameter schema
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validateParameters(parameters, schema) {
    const errors = [];

    if (!schema || typeof schema !== 'object') {
      return { valid: true, errors: [] };
    }

    for (const [paramName, paramSchema] of Object.entries(schema)) {
      const value = parameters[paramName];

      // Check required parameters
      if (paramSchema.required && (value === undefined || value === null)) {
        errors.push(`Missing required parameter: ${paramName}`);
        continue;
      }

      // Skip validation if not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Validate type
      if (paramSchema.type) {
        const expectedType = paramSchema.type.toLowerCase();
        const actualType = typeof value;

        if (expectedType === 'array') {
          if (!Array.isArray(value)) {
            errors.push(`Parameter '${paramName}' must be an array`);
          }
        } else if (expectedType === 'object') {
          if (typeof value !== 'object' || Array.isArray(value)) {
            errors.push(`Parameter '${paramName}' must be an object`);
          }
        } else if (actualType !== expectedType) {
          errors.push(`Parameter '${paramName}' must be ${expectedType}, got ${actualType}`);
        }
      }

      // Validate enum
      if (paramSchema.enum && !paramSchema.enum.includes(value)) {
        errors.push(`Parameter '${paramName}' must be one of: ${paramSchema.enum.join(', ')}`);
      }

      // Validate min/max for numbers
      if (paramSchema.type === 'number' || paramSchema.type === 'integer') {
        if (paramSchema.min !== undefined && value < paramSchema.min) {
          errors.push(`Parameter '${paramName}' must be >= ${paramSchema.min}`);
        }
        if (paramSchema.max !== undefined && value > paramSchema.max) {
          errors.push(`Parameter '${paramName}' must be <= ${paramSchema.max}`);
        }
      }

      // Validate string length
      if (paramSchema.type === 'string') {
        if (paramSchema.minLength && value.length < paramSchema.minLength) {
          errors.push(`Parameter '${paramName}' must be at least ${paramSchema.minLength} characters`);
        }
        if (paramSchema.maxLength && value.length > paramSchema.maxLength) {
          errors.push(`Parameter '${paramName}' must be at most ${paramSchema.maxLength} characters`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create execution context
   * @param {string} executionId - Execution ID
   * @param {Object} details - Execution details
   * @returns {Object} Execution context
   */
  createExecutionContext(executionId, details = {}) {
    const context = {
      executionId,
      agentId: details.agentId,
      skillId: details.skillId,
      userId: details.userId,
      sessionId: details.sessionId,
      parameters: details.parameters || {},
      startTime: new Date(),
      endTime: null,
      duration: 0,
      status: 'running',
      result: null,
      error: null,
      logs: [],
      metadata: details.metadata || {},
      parentExecutionId: details.parentExecutionId || null
    };

    this.executionContexts.set(executionId, context);
    return context;
  }

  /**
   * Get execution context
   * @param {string} executionId - Execution ID
   * @returns {Object|null} Execution context
   */
  getExecutionContext(executionId) {
    return this.executionContexts.get(executionId) || null;
  }

  /**
   * Add log entry to execution context
   * @param {string} executionId - Execution ID
   * @param {Object} logEntry - Log entry
   */
  addLog(executionId, logEntry) {
    const context = this.executionContexts.get(executionId);
    if (context) {
      context.logs.push({
        timestamp: new Date(),
        level: logEntry.level || 'info',
        message: logEntry.message,
        data: logEntry.data
      });
    }
  }

  /**
   * Execute skill
   * @param {Object} request - Execution request
   * @param {string} request.agentId - Agent ID
   * @param {string} request.skillId - Skill ID
   * @param {Object} request.parameters - Skill parameters
   * @param {string} request.userId - User ID (for auditing)
   * @param {string} request.sessionId - Session ID
   * @returns {Promise<Object>} Execution result
   */
  async executeSkill(request) {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    try {
      // Log execution start
      this.logger.info(`[${executionId}] Executing skill: ${request.agentId}.${request.skillId}`);

      // Create execution context
      const context = this.createExecutionContext(executionId, {
        agentId: request.agentId,
        skillId: request.skillId,
        userId: request.userId,
        sessionId: request.sessionId,
        parameters: request.parameters,
        metadata: request.metadata || {}
      });

      // Validate parameters
      const schema = this.getParameterSchema(request.skillId);
      const validation = this.validateParameters(request.parameters || {}, schema);

      if (!validation.valid) {
        this.addLog(executionId, {
          level: 'error',
          message: 'Parameter validation failed',
          data: { errors: validation.errors }
        });

        throw new Error(`Parameter validation failed: ${validation.errors.join(', ')}`);
      }

      this.addLog(executionId, {
        level: 'info',
        message: 'Parameters validated successfully'
      });

      // Execute skill via plugin
      if (!this.plugin) {
        throw new Error('Plugin not available');
      }

      let result;
      try {
        result = await this.plugin.invoke(
          request.agentId,
          request.skillId,
          request.parameters || {}
        );
      } catch (error) {
        this.addLog(executionId, {
          level: 'error',
          message: 'Skill execution failed',
          data: { error: error.message }
        });
        throw error;
      }

      // Mark execution as successful
      context.status = 'successful';
      context.result = result;

      this.addLog(executionId, {
        level: 'info',
        message: 'Skill execution completed successfully',
        data: { result }
      });

      this.executionStats.successful++;

    } catch (error) {
      // Mark execution as failed
      const context = this.executionContexts.get(executionId);
      if (context) {
        context.status = 'failed';
        context.error = {
          message: error.message,
          stack: error.stack
        };
      }

      this.logger.error(`[${executionId}] Skill execution failed:`, error);
      this.executionStats.failed++;

      throw error;

    } finally {
      // Finalize execution context
      const context = this.executionContexts.get(executionId);
      if (context) {
        context.endTime = new Date();
        context.duration = context.endTime - context.startTime;
      }

      // Update statistics
      const duration = Date.now() - startTime;
      this.executionStats.total++;
      this.executionStats.totalDuration += duration;

      // Add to history
      this.recordExecution(executionId, request, duration);

      // Clean up old execution contexts (keep last 1000)
      if (this.executionContexts.size > 1000) {
        const firstKey = this.executionContexts.keys().next().value;
        this.executionContexts.delete(firstKey);
      }
    }

    return {
      executionId,
      status: 'completed',
      context: this.executionContexts.get(executionId)
    };
  }

  /**
   * Execute skill with timeout
   * @param {Object} request - Execution request
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<Object>} Execution result
   */
  async executeSkillWithTimeout(request, timeoutMs = 30000) {
    return Promise.race([
      this.executeSkill(request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Execution timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Execute skill with retry
   * @param {Object} request - Execution request
   * @param {number} maxRetries - Maximum retry attempts
   * @param {number} delayMs - Delay between retries
   * @returns {Promise<Object>} Execution result
   */
  async executeSkillWithRetry(request, maxRetries = 3, delayMs = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeSkill(request);
      } catch (error) {
        lastError = error;
        this.logger.warn(`Skill execution attempt ${attempt} failed, retrying...`);

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        }
      }
    }

    throw new Error(`Skill execution failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Batch execute multiple skills
   * @param {Array<Object>} requests - Array of execution requests
   * @returns {Promise<Array>} Array of execution results
   */
  async batchExecute(requests) {
    const results = [];

    for (const request of requests) {
      try {
        const result = await this.executeSkill(request);
        results.push({ ...result, success: true });
      } catch (error) {
        results.push({
          agentId: request.agentId,
          skillId: request.skillId,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Record execution in history
   * @param {string} executionId - Execution ID
   * @param {Object} request - Original request
   * @param {number} duration - Execution duration
   * @private
   */
  recordExecution(executionId, request, duration) {
    const context = this.executionContexts.get(executionId);

    this.executionHistory.push({
      executionId,
      agentId: request.agentId,
      skillId: request.skillId,
      userId: request.userId,
      status: context?.status || 'unknown',
      timestamp: new Date(),
      duration,
      result: context?.result,
      error: context?.error
    });

    // Keep only last 10000 executions
    if (this.executionHistory.length > 10000) {
      this.executionHistory.shift();
    }
  }

  /**
   * Get execution history
   * @param {Object} filters - Filter options
   * @returns {Array} Execution history entries
   */
  getExecutionHistory(filters = {}) {
    let history = this.executionHistory;

    // Filter by skill
    if (filters.skillId) {
      history = history.filter(h => h.skillId === filters.skillId);
    }

    // Filter by agent
    if (filters.agentId) {
      history = history.filter(h => h.agentId === filters.agentId);
    }

    // Filter by user
    if (filters.userId) {
      history = history.filter(h => h.userId === filters.userId);
    }

    // Filter by status
    if (filters.status) {
      history = history.filter(h => h.status === filters.status);
    }

    // Filter by date range
    if (filters.startDate || filters.endDate) {
      const start = filters.startDate ? new Date(filters.startDate) : null;
      const end = filters.endDate ? new Date(filters.endDate) : null;

      history = history.filter(h => {
        const timestamp = new Date(h.timestamp);
        if (start && timestamp < start) return false;
        if (end && timestamp > end) return false;
        return true;
      });
    }

    // Sort by timestamp descending
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit results
    const limit = filters.limit || 100;
    return history.slice(0, limit);
  }

  /**
   * Get execution statistics
   * @returns {Object} Execution statistics
   */
  getStatistics() {
    const avgDuration = this.executionStats.total > 0
      ? Math.round(this.executionStats.totalDuration / this.executionStats.total)
      : 0;

    const successRate = this.executionStats.total > 0
      ? ((this.executionStats.successful / this.executionStats.total) * 100).toFixed(2)
      : 0;

    return {
      ...this.executionStats,
      averageDuration: avgDuration,
      successRate: `${successRate}%`,
      failureRate: `${(100 - successRate).toFixed(2)}%`,
      historySizeLimit: 10000,
      currentHistorySize: this.executionHistory.length
    };
  }

  /**
   * Generate unique execution ID
   * @returns {string} Execution ID
   * @private
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Clear old execution data
   * @param {number} olderThanMinutes - Clear entries older than N minutes
   */
  clearOldExecutions(olderThanMinutes = 60) {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);

    const initialCount = this.executionHistory.length;
    this.executionHistory = this.executionHistory.filter(
      entry => new Date(entry.timestamp) > cutoffTime
    );

    const removedCount = initialCount - this.executionHistory.length;
    this.logger.info(`Cleared ${removedCount} execution history entries older than ${olderThanMinutes} minutes`);
  }
}

module.exports = SkillExecutor;
