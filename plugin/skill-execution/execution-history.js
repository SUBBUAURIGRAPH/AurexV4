/**
 * Execution History Module
 * Tracks skill execution history with database support
 * @version 1.0.0
 */

const crypto = require('crypto');

/**
 * Execution History Manager
 * @class ExecutionHistory
 * @description Manages skill execution history and analytics
 */
class ExecutionHistory {
  /**
   * Initialize Execution History
   * @param {Object} config - Configuration object
   * @param {Object} config.storage - Storage backend (memory or database)
   * @param {number} config.maxInMemoryRecords - Max in-memory records
   */
  constructor(config = {}) {
    this.storage = config.storage || 'memory';
    this.maxInMemoryRecords = config.maxInMemoryRecords || 10000;

    // In-memory storage (fallback)
    this.records = [];
    this.recordMap = new Map(); // For quick lookup by execution ID

    // Statistics cache
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      averageRetries: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Record skill execution
   * @param {Object} execution - Execution details
   * @returns {string} Execution ID
   */
  recordExecution(execution) {
    const executionId = crypto.randomBytes(16).toString('hex');

    const record = {
      id: executionId,
      skillId: execution.skillId,
      agentId: execution.agentId,
      userId: execution.userId,
      sessionId: execution.sessionId,
      parameters: this.sanitizeParameters(execution.parameters),
      result: execution.result,
      error: execution.error,
      status: execution.status, // 'pending', 'running', 'success', 'failed', 'timeout'
      startTime: execution.startTime || new Date(),
      endTime: execution.endTime || null,
      duration: execution.duration || 0,
      retries: execution.retries || 0,
      maxRetries: execution.maxRetries || 0,
      timeout: execution.timeout || 30000,
      metadata: execution.metadata || {},
      ipAddress: execution.ipAddress || null,
      userAgent: execution.userAgent || null,
      version: execution.version || '1.0.0'
    };

    this.recordMap.set(executionId, record);
    this.records.push(record);

    // Trim old records if exceeding max
    if (this.records.length > this.maxInMemoryRecords) {
      const removed = this.records.shift();
      this.recordMap.delete(removed.id);
    }

    // Update statistics
    this.updateStatistics(record);

    return executionId;
  }

  /**
   * Update execution record (e.g., when completed)
   * @param {string} executionId - Execution ID
   * @param {Object} updates - Updates to apply
   */
  updateExecution(executionId, updates) {
    const record = this.recordMap.get(executionId);
    if (!record) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    // Update fields
    if (updates.status) record.status = updates.status;
    if (updates.result) record.result = updates.result;
    if (updates.error) record.error = updates.error;
    if (updates.endTime) record.endTime = updates.endTime;
    if (updates.duration !== undefined) record.duration = updates.duration;
    if (updates.retries !== undefined) record.retries = updates.retries;

    // Update statistics
    this.updateStatistics(record);
  }

  /**
   * Get execution record
   * @param {string} executionId - Execution ID
   * @returns {Object|null} Execution record
   */
  getExecution(executionId) {
    return this.recordMap.get(executionId) || null;
  }

  /**
   * Get execution history for skill
   * @param {string} skillId - Skill ID
   * @param {Object} filters - Filter options
   * @returns {Array} Matching execution records
   */
  getSkillHistory(skillId, filters = {}) {
    let results = this.records.filter(r => r.skillId === skillId);

    // Apply filters
    if (filters.userId) {
      results = results.filter(r => r.userId === filters.userId);
    }

    if (filters.status) {
      results = results.filter(r => r.status === filters.status);
    }

    if (filters.startDate) {
      results = results.filter(r => r.startTime >= filters.startDate);
    }

    if (filters.endDate) {
      results = results.filter(r => r.startTime <= filters.endDate);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.startTime - a.startTime);

    // Apply pagination
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Get execution history for user
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Array} Matching execution records
   */
  getUserHistory(userId, filters = {}) {
    let results = this.records.filter(r => r.userId === userId);

    // Apply filters
    if (filters.skillId) {
      results = results.filter(r => r.skillId === filters.skillId);
    }

    if (filters.status) {
      results = results.filter(r => r.status === filters.status);
    }

    if (filters.startDate) {
      results = results.filter(r => r.startTime >= filters.startDate);
    }

    if (filters.endDate) {
      results = results.filter(r => r.startTime <= filters.endDate);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.startTime - a.startTime);

    // Apply pagination
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Get execution statistics
   * @param {Object} filters - Filter options
   * @returns {Object} Statistics
   */
  getStatistics(filters = {}) {
    let records = this.records;

    // Apply filters
    if (filters.skillId) {
      records = records.filter(r => r.skillId === filters.skillId);
    }

    if (filters.userId) {
      records = records.filter(r => r.userId === filters.userId);
    }

    if (filters.startDate) {
      records = records.filter(r => r.startTime >= filters.startDate);
    }

    if (filters.endDate) {
      records = records.filter(r => r.startTime <= filters.endDate);
    }

    const total = records.length;
    const successful = records.filter(r => r.status === 'success').length;
    const failed = records.filter(r => r.status === 'failed').length;
    const timeout = records.filter(r => r.status === 'timeout').length;

    const totalDuration = records.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = total > 0 ? totalDuration / total : 0;

    const totalRetries = records.reduce((sum, r) => sum + r.retries, 0);
    const averageRetries = total > 0 ? totalRetries / total : 0;

    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return {
      total,
      successful,
      failed,
      timeout,
      successRate: Math.round(successRate * 100) / 100,
      averageDuration: Math.round(averageDuration * 100) / 100,
      averageRetries: Math.round(averageRetries * 100) / 100,
      totalDuration,
      topSkills: this.getTopSkills(records),
      topUsers: this.getTopUsers(records),
      errorRate: Math.round(((failed + timeout) / total) * 100 * 100) / 100 || 0
    };
  }

  /**
   * Get top executed skills
   * @param {Array} records - Records to analyze
   * @returns {Array} Top skills
   * @private
   */
  getTopSkills(records) {
    const skillCounts = {};
    records.forEach(r => {
      skillCounts[r.skillId] = (skillCounts[r.skillId] || 0) + 1;
    });

    return Object.entries(skillCounts)
      .map(([skillId, count]) => ({ skillId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get top executing users
   * @param {Array} records - Records to analyze
   * @returns {Array} Top users
   * @private
   */
  getTopUsers(records) {
    const userCounts = {};
    records.forEach(r => {
      if (r.userId) {
        userCounts[r.userId] = (userCounts[r.userId] || 0) + 1;
      }
    });

    return Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get recent executions
   * @param {number} limit - Number of records to return
   * @returns {Array} Recent execution records
   */
  getRecentExecutions(limit = 100) {
    return this.records
      .slice(-limit)
      .reverse();
  }

  /**
   * Get failed executions
   * @param {number} limit - Number of records to return
   * @returns {Array} Failed execution records
   */
  getFailedExecutions(limit = 100) {
    return this.records
      .filter(r => r.status === 'failed' || r.status === 'timeout')
      .slice(-limit)
      .reverse();
  }

  /**
   * Export history to format
   * @param {string} format - Export format (json, csv)
   * @returns {string} Exported data
   */
  export(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.records, null, 2);
    }

    if (format === 'csv') {
      const headers = [
        'ID', 'SkillID', 'AgentID', 'UserID', 'Status',
        'Duration(ms)', 'StartTime', 'EndTime', 'Error'
      ];

      const rows = this.records.map(r => [
        r.id,
        r.skillId,
        r.agentId,
        r.userId,
        r.status,
        r.duration,
        r.startTime.toISOString(),
        r.endTime ? r.endTime.toISOString() : '',
        r.error || ''
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      return csv;
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Clear history (with caution!)
   * @param {Object} filters - Clear only matching records
   */
  clearHistory(filters = {}) {
    if (Object.keys(filters).length === 0) {
      // Clear all
      this.records = [];
      this.recordMap.clear();
      return;
    }

    // Clear filtered records
    const toClear = [];
    for (const record of this.records) {
      let matches = true;
      for (const [key, value] of Object.entries(filters)) {
        if (record[key] !== value) {
          matches = false;
          break;
        }
      }
      if (matches) {
        toClear.push(record);
      }
    }

    toClear.forEach(r => {
      this.records = this.records.filter(x => x.id !== r.id);
      this.recordMap.delete(r.id);
    });
  }

  /**
   * Sanitize parameters for storage
   * @param {Object} parameters - Parameters to sanitize
   * @returns {Object} Sanitized parameters
   * @private
   */
  sanitizeParameters(parameters) {
    if (!parameters) return {};

    const sanitized = {};
    for (const [key, value] of Object.entries(parameters)) {
      // Remove sensitive data
      if (key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('key')) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'string' && value.length > 1000) {
        sanitized[key] = value.substring(0, 1000) + '...';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Update statistics
   * @param {Object} record - Execution record
   * @private
   */
  updateStatistics(record) {
    this.stats.totalExecutions = this.records.length;
    this.stats.successfulExecutions = this.records.filter(r => r.status === 'success').length;
    this.stats.failedExecutions = this.records.filter(r => r.status === 'failed').length;

    const totalDuration = this.records.reduce((sum, r) => sum + r.duration, 0);
    this.stats.averageDuration = this.records.length > 0 ? totalDuration / this.records.length : 0;

    const totalRetries = this.records.reduce((sum, r) => sum + r.retries, 0);
    this.stats.averageRetries = this.records.length > 0 ? totalRetries / this.records.length : 0;

    this.stats.lastUpdated = new Date();
  }

  /**
   * Get statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return { ...this.stats };
  }
}

module.exports = {
  ExecutionHistory
};
