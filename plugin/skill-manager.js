#!/usr/bin/env node

/**
 * Aurigraph Agents - Skill Manager
 * Manages skill registry, metadata, and skill lifecycle
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

/**
 * SkillManager - Registry and metadata management for skills
 *
 * Responsibilities:
 * - Maintain skill registry
 * - Manage skill metadata and documentation
 * - Provide skill search and filtering
 * - Track skill versions and dependencies
 * - Generate skill documentation
 *
 * @class
 * @extends EventEmitter
 */
class SkillManager extends EventEmitter {
  /**
   * Initialize the SkillManager
   *
   * @param {Object} options - Configuration options
   * @param {string} options.skillsPath - Path to skills directory
   * @param {boolean} options.verbose - Enable verbose logging
   * @param {Object} options.logger - Custom logger instance
   */
  constructor(options = {}) {
    super();

    this.version = '1.0.0';
    this.skillsPath = options.skillsPath || path.join(__dirname, 'skills');
    this.verbose = options.verbose || false;
    this.logger = options.logger || console;

    // Registry storage
    this.registry = new Map();
    this.categories = new Map();
    this.tags = new Map();
    this.dependencies = new Map();

    this._initialized = false;
  }

  /**
   * Initialize the manager and build registry
   *
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    if (this._initialized) {
      return { success: true, message: 'Already initialized' };
    }

    try {
      // Build registry from skills directory
      await this.buildRegistry();

      this._initialized = true;
      this.emit('initialized', { skillCount: this.registry.size });

      if (this.verbose) {
        this.logger.log(`SkillManager initialized with ${this.registry.size} skills`);
      }

      return {
        success: true,
        skillsRegistered: this.registry.size,
        categories: this.categories.size,
        tags: this.tags.size
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Build skill registry from directory
   *
   * @returns {Promise<Map>} Registry map
   */
  async buildRegistry() {
    if (!fs.existsSync(this.skillsPath)) {
      fs.mkdirSync(this.skillsPath, { recursive: true });
      return this.registry;
    }

    try {
      const files = fs.readdirSync(this.skillsPath)
        .filter(file => file.endsWith('.js'));

      for (const file of files) {
        try {
          const skillPath = path.join(this.skillsPath, file);
          const skillName = file.replace('.js', '');

          // Load skill for registration
          const skill = require(skillPath);

          // Register the skill
          await this.registerSkill(skillName, skill, skillPath);

        } catch (error) {
          if (this.verbose) {
            this.logger.warn(`Failed to register skill ${file}: ${error.message}`);
          }
        }
      }

      return this.registry;
    } catch (error) {
      this.logger.error(`Failed to build registry: ${error.message}`);
      return this.registry;
    }
  }

  /**
   * Register a skill in the registry
   *
   * @param {string} skillName - Skill identifier
   * @param {Object} skill - Skill module
   * @param {string} skillPath - Path to skill file
   * @returns {Promise<Object>} Registration result
   */
  async registerSkill(skillName, skill, skillPath) {
    try {
      const metadata = {
        // Basic information
        name: skill.name || skillName,
        description: skill.description || 'No description available',
        version: skill.version || '1.0.0',
        author: skill.author || 'Unknown',

        // Configuration
        parameters: skill.parameters || {},
        output: skill.output || 'any',
        timeout: skill.timeout || 300000,
        retries: skill.retries !== undefined ? skill.retries : 3,

        // Classification
        category: skill.category || 'general',
        tags: skill.tags || [],
        priority: skill.priority || 'normal',

        // Dependencies
        dependencies: skill.dependencies || [],
        requiredEnvironment: skill.requiredEnvironment || [],

        // File information
        path: skillPath,
        filename: path.basename(skillPath),
        registeredAt: new Date().toISOString(),

        // Status
        enabled: skill.enabled !== undefined ? skill.enabled : true,
        experimental: skill.experimental || false,
        deprecated: skill.deprecated || false
      };

      // Store in registry
      this.registry.set(skillName, metadata);

      // Index by category
      this.indexByCategory(skillName, metadata.category);

      // Index by tags
      this.indexByTags(skillName, metadata.tags);

      // Track dependencies
      this.trackDependencies(skillName, metadata.dependencies);

      this.emit('skill:registered', { skillName, metadata });

      if (this.verbose) {
        this.logger.log(`Registered skill: ${skillName}`);
      }

      return { success: true, metadata };

    } catch (error) {
      this.logger.error(`Failed to register skill ${skillName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Index skill by category
   *
   * @param {string} skillName - Skill name
   * @param {string} category - Category name
   */
  indexByCategory(skillName, category) {
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }

    this.categories.get(category).add(skillName);
  }

  /**
   * Index skill by tags
   *
   * @param {string} skillName - Skill name
   * @param {Array<string>} tags - Skill tags
   */
  indexByTags(skillName, tags) {
    for (const tag of tags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }

      this.tags.get(tag).add(skillName);
    }
  }

  /**
   * Track skill dependencies
   *
   * @param {string} skillName - Skill name
   * @param {Array<string>} deps - Dependencies
   */
  trackDependencies(skillName, deps) {
    if (deps.length > 0) {
      this.dependencies.set(skillName, deps);
    }
  }

  /**
   * Get skill metadata
   *
   * @param {string} skillName - Skill name
   * @returns {Object|null} Skill metadata or null
   */
  getSkill(skillName) {
    return this.registry.get(skillName) || null;
  }

  /**
   * List all registered skills
   *
   * @param {Object} options - Filter options
   * @returns {Array<Object>} Array of skill metadata
   */
  listSkills(options = {}) {
    const {
      category = null,
      tag = null,
      enabled = true,
      includeExperimental = false,
      includeDeprecated = false
    } = options;

    let skills = Array.from(this.registry.values());

    // Filter by category
    if (category) {
      skills = skills.filter(skill => skill.category === category);
    }

    // Filter by tag
    if (tag) {
      skills = skills.filter(skill => skill.tags.includes(tag));
    }

    // Filter by enabled status
    if (enabled !== null) {
      skills = skills.filter(skill => skill.enabled === enabled);
    }

    // Filter experimental
    if (!includeExperimental) {
      skills = skills.filter(skill => !skill.experimental);
    }

    // Filter deprecated
    if (!includeDeprecated) {
      skills = skills.filter(skill => !skill.deprecated);
    }

    return skills.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Search skills by query
   *
   * @param {string} query - Search query
   * @returns {Array<Object>} Matching skills
   */
  searchSkills(query) {
    const lowerQuery = query.toLowerCase();
    const results = [];

    for (const [skillName, metadata] of this.registry) {
      const searchText = [
        metadata.name,
        metadata.description,
        metadata.category,
        ...metadata.tags
      ].join(' ').toLowerCase();

      if (searchText.includes(lowerQuery)) {
        results.push({
          skillName,
          ...metadata,
          relevance: this.calculateRelevance(lowerQuery, searchText)
        });
      }
    }

    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Calculate search relevance score
   *
   * @param {string} query - Search query
   * @param {string} text - Text to search
   * @returns {number} Relevance score
   */
  calculateRelevance(query, text) {
    let score = 0;

    // Exact match in name
    if (text.startsWith(query)) {
      score += 100;
    }

    // Contains query
    if (text.includes(query)) {
      score += 50;
    }

    // Count occurrences
    const occurrences = (text.match(new RegExp(query, 'g')) || []).length;
    score += occurrences * 10;

    return score;
  }

  /**
   * Get skills by category
   *
   * @param {string} category - Category name
   * @returns {Array<Object>} Skills in category
   */
  getSkillsByCategory(category) {
    const skillNames = this.categories.get(category);
    if (!skillNames) {
      return [];
    }

    return Array.from(skillNames)
      .map(name => this.registry.get(name))
      .filter(Boolean);
  }

  /**
   * Get skills by tag
   *
   * @param {string} tag - Tag name
   * @returns {Array<Object>} Skills with tag
   */
  getSkillsByTag(tag) {
    const skillNames = this.tags.get(tag);
    if (!skillNames) {
      return [];
    }

    return Array.from(skillNames)
      .map(name => this.registry.get(name))
      .filter(Boolean);
  }

  /**
   * Get all categories
   *
   * @returns {Array<Object>} Categories with skill counts
   */
  getCategories() {
    return Array.from(this.categories.entries()).map(([name, skills]) => ({
      name,
      skillCount: skills.size
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get all tags
   *
   * @returns {Array<Object>} Tags with skill counts
   */
  getTags() {
    return Array.from(this.tags.entries()).map(([name, skills]) => ({
      name,
      skillCount: skills.size
    })).sort((a, b) => b.skillCount - a.skillCount);
  }

  /**
   * Get skill dependencies
   *
   * @param {string} skillName - Skill name
   * @returns {Array<string>} Array of dependency names
   */
  getDependencies(skillName) {
    return this.dependencies.get(skillName) || [];
  }

  /**
   * Check if skill has dependencies
   *
   * @param {string} skillName - Skill name
   * @returns {boolean} True if has dependencies
   */
  hasDependencies(skillName) {
    return this.dependencies.has(skillName) && this.dependencies.get(skillName).length > 0;
  }

  /**
   * Validate skill dependencies are available
   *
   * @param {string} skillName - Skill name
   * @returns {Object} Validation result
   */
  validateDependencies(skillName) {
    const deps = this.getDependencies(skillName);
    const missing = [];

    for (const dep of deps) {
      if (!this.registry.has(dep)) {
        missing.push(dep);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      dependencies: deps
    };
  }

  /**
   * Generate documentation for a skill
   *
   * @param {string} skillName - Skill name
   * @returns {string} Markdown documentation
   */
  generateDocumentation(skillName) {
    const skill = this.registry.get(skillName);
    if (!skill) {
      return `# Skill Not Found\n\nSkill '${skillName}' not found in registry.`;
    }

    const doc = [];

    doc.push(`# ${skill.name}`);
    doc.push('');
    doc.push(skill.description);
    doc.push('');

    // Version and metadata
    doc.push('## Metadata');
    doc.push(`- **Version**: ${skill.version}`);
    doc.push(`- **Author**: ${skill.author}`);
    doc.push(`- **Category**: ${skill.category}`);
    doc.push(`- **Tags**: ${skill.tags.join(', ') || 'None'}`);
    doc.push(`- **Priority**: ${skill.priority}`);
    doc.push('');

    // Parameters
    if (Object.keys(skill.parameters).length > 0) {
      doc.push('## Parameters');
      doc.push('');

      for (const [name, param] of Object.entries(skill.parameters)) {
        const required = param.required ? '**Required**' : 'Optional';
        const type = param.type || 'any';
        const description = param.description || 'No description';

        doc.push(`### ${name}`);
        doc.push(`- **Type**: \`${type}\``);
        doc.push(`- **Required**: ${required}`);
        doc.push(`- **Description**: ${description}`);
        doc.push('');
      }
    }

    // Configuration
    doc.push('## Configuration');
    doc.push(`- **Timeout**: ${skill.timeout}ms`);
    doc.push(`- **Retries**: ${skill.retries}`);
    doc.push(`- **Output Type**: ${skill.output}`);
    doc.push('');

    // Dependencies
    if (skill.dependencies.length > 0) {
      doc.push('## Dependencies');
      for (const dep of skill.dependencies) {
        doc.push(`- ${dep}`);
      }
      doc.push('');
    }

    // Status
    doc.push('## Status');
    doc.push(`- **Enabled**: ${skill.enabled ? 'Yes' : 'No'}`);
    doc.push(`- **Experimental**: ${skill.experimental ? 'Yes' : 'No'}`);
    doc.push(`- **Deprecated**: ${skill.deprecated ? 'Yes' : 'No'}`);
    doc.push('');

    return doc.join('\n');
  }

  /**
   * Generate registry summary
   *
   * @returns {string} Markdown summary
   */
  generateRegistrySummary() {
    const doc = [];

    doc.push('# Skill Registry Summary');
    doc.push('');
    doc.push(`**Total Skills**: ${this.registry.size}`);
    doc.push(`**Categories**: ${this.categories.size}`);
    doc.push(`**Tags**: ${this.tags.size}`);
    doc.push('');

    // Categories
    doc.push('## Categories');
    doc.push('');

    for (const category of this.getCategories()) {
      doc.push(`- **${category.name}**: ${category.skillCount} skills`);
    }
    doc.push('');

    // Top tags
    doc.push('## Popular Tags');
    doc.push('');

    const topTags = this.getTags().slice(0, 10);
    for (const tag of topTags) {
      doc.push(`- **${tag.name}**: ${tag.skillCount} skills`);
    }
    doc.push('');

    return doc.join('\n');
  }

  /**
   * Export registry to JSON
   *
   * @param {string} outputPath - Path to output file
   * @returns {Object} Exported data
   */
  exportRegistry(outputPath = null) {
    const data = {
      version: this.version,
      timestamp: new Date().toISOString(),
      totalSkills: this.registry.size,
      skills: Array.from(this.registry.entries()).map(([name, metadata]) => ({
        name,
        ...metadata
      })),
      categories: this.getCategories(),
      tags: this.getTags()
    };

    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    }

    return data;
  }

  /**
   * Clear registry
   */
  clearRegistry() {
    this.registry.clear();
    this.categories.clear();
    this.tags.clear();
    this.dependencies.clear();

    if (this.verbose) {
      this.logger.log('Registry cleared');
    }
  }

  /**
   * Reload registry
   *
   * @returns {Promise<Object>} Reload result
   */
  async reloadRegistry() {
    this.clearRegistry();
    return await this.buildRegistry();
  }

  /**
   * Get registry statistics
   *
   * @returns {Object} Statistics
   */
  getStatistics() {
    const skills = Array.from(this.registry.values());

    return {
      total: this.registry.size,
      enabled: skills.filter(s => s.enabled).length,
      disabled: skills.filter(s => !s.enabled).length,
      experimental: skills.filter(s => s.experimental).length,
      deprecated: skills.filter(s => s.deprecated).length,
      categories: this.categories.size,
      tags: this.tags.size,
      withDependencies: this.dependencies.size
    };
  }
}

// Export SkillManager
module.exports = SkillManager;
