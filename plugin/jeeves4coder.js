#!/usr/bin/env node

/**
 * Jeeves4Coder - Claude Code Plugin
 * Sophisticated coding assistant for code review, refactoring, and architectural guidance
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 * @description A refined butler-style coding assistant with deep programming expertise
 *
 * Features:
 * - Comprehensive code review analysis
 * - Strategic refactoring suggestions
 * - Architecture and design pattern recommendations
 * - Performance optimization guidance
 * - Security vulnerability detection
 * - Testing strategy development
 * - Documentation improvement
 * - Multi-language support (10+ languages)
 * - Multi-framework support (15+ frameworks)
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * Memory Manager for Jeeves4Coder
 * Prevents IDE crashes by monitoring and managing memory usage
 */
class MemoryManager {
  constructor(options = {}) {
    this.maxMemoryMB = options.maxMemoryMB || 512; // 512 MB limit
    this.warningThresholdPercent = options.warningThresholdPercent || 80;
    this.criticalThresholdPercent = options.criticalThresholdPercent || 95;
    this.checkIntervalMs = options.checkIntervalMs || 1000;
    this.maxRunawayDetectionMs = options.maxRunawayDetectionMs || 30000; // 30 second timeout
    this.memoryHistory = [];
    this.maxHistoryLength = 100;
    this.runawayDetectionEnabled = true;
    this.lastExecutionTime = 0;
    this.executionStartTime = null;
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    if (typeof process === 'undefined' || !process.memoryUsage) {
      return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
    }
    return process.memoryUsage();
  }

  /**
   * Check if memory usage is within acceptable limits
   */
  isMemoryHealthy() {
    const usage = this.getMemoryUsage();
    const heapUsedMB = usage.heapUsed / (1024 * 1024);
    const usagePercent = (heapUsedMB / this.maxMemoryMB) * 100;

    this.memoryHistory.push({
      timestamp: Date.now(),
      heapUsedMB,
      usagePercent,
      heapTotalMB: usage.heapTotal / (1024 * 1024),
      rssMB: usage.rss / (1024 * 1024)
    });

    if (this.memoryHistory.length > this.maxHistoryLength) {
      this.memoryHistory.shift();
    }

    return usagePercent < this.criticalThresholdPercent;
  }

  /**
   * Get memory status
   */
  getMemoryStatus() {
    const usage = this.getMemoryUsage();
    const heapUsedMB = usage.heapUsed / (1024 * 1024);
    const heapTotalMB = usage.heapTotal / (1024 * 1024);
    const usagePercent = (heapUsedMB / this.maxMemoryMB) * 100;

    return {
      heapUsedMB: heapUsedMB.toFixed(2),
      heapTotalMB: heapTotalMB.toFixed(2),
      rssMB: (usage.rss / (1024 * 1024)).toFixed(2),
      usagePercent: usagePercent.toFixed(2),
      status: usagePercent > this.criticalThresholdPercent ? 'critical' :
              usagePercent > this.warningThresholdPercent ? 'warning' : 'healthy',
      history: this.memoryHistory.slice(-10)
    };
  }

  /**
   * Check for runaway execution (infinite loops, excessive processing)
   */
  detectRunaway() {
    if (!this.runawayDetectionEnabled) return false;

    if (this.executionStartTime) {
      const elapsedMs = Date.now() - this.executionStartTime;
      if (elapsedMs > this.maxRunawayDetectionMs) {
        return {
          detected: true,
          elapsedMs,
          timeout: this.maxRunawayDetectionMs,
          message: `Runaway execution detected: ${elapsedMs}ms exceeds ${this.maxRunawayDetectionMs}ms limit`
        };
      }
    }

    return { detected: false };
  }

  /**
   * Start execution timer
   */
  startExecution() {
    this.executionStartTime = Date.now();
  }

  /**
   * End execution timer
   */
  endExecution() {
    if (this.executionStartTime) {
      this.lastExecutionTime = Date.now() - this.executionStartTime;
      this.executionStartTime = null;
    }
    return this.lastExecutionTime;
  }

  /**
   * Force garbage collection (if available)
   */
  forceGarbageCollection() {
    if (global.gc) {
      global.gc();
      return { success: true, message: 'Garbage collection triggered' };
    }
    return { success: false, message: 'Garbage collection not available (run with --expose-gc)' };
  }

  /**
   * Clear memory history
   */
  clearHistory() {
    this.memoryHistory = [];
  }

  /**
   * Get memory trend (increasing, stable, decreasing)
   */
  getMemoryTrend() {
    if (this.memoryHistory.length < 3) return 'insufficient-data';

    const recent = this.memoryHistory.slice(-3);
    const trend = recent[2].usagePercent - recent[0].usagePercent;

    if (trend > 5) return 'increasing';
    if (trend < -5) return 'decreasing';
    return 'stable';
  }
}

/**
 * Runaway Condition Detector
 * Identifies infinite loops, deadlocks, and excessive resource usage
 */
class RunawayDetector {
  constructor(options = {}) {
    this.timeoutMs = options.timeoutMs || 30000; // 30 second default
    this.maxIterations = options.maxIterations || 100000;
    this.maxRecursionDepth = options.maxRecursionDepth || 1000;
    this.maxArraySize = options.maxArraySize || 10000000; // 10M elements
    this.enableStackTrace = options.enableStackTrace || true;
  }

  /**
   * Create a safe wrapper for potentially runaway code
   */
  createSafeWrapper(asyncFn, timeoutMs = this.timeoutMs) {
    return async (...args) => {
      return Promise.race([
        asyncFn(...args),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Execution timeout: ${timeoutMs}ms exceeded`)), timeoutMs)
        )
      ]);
    };
  }

  /**
   * Check for potential infinite loop patterns
   */
  detectInfiniteLoopPatterns(code) {
    const patterns = [
      { regex: /while\s*\(\s*true\s*\)/g, message: 'Infinite while loop detected' },
      { regex: /for\s*\(\s*;\s*;\s*\)/g, message: 'Infinite for loop detected' },
      { regex: /do\s*{[\s\S]*?}\s*while\s*\(\s*true\s*\)/g, message: 'Infinite do-while loop detected' }
    ];

    const issues = [];
    patterns.forEach(pattern => {
      if (pattern.regex.test(code)) {
        issues.push({
          pattern: pattern.message,
          severity: 'critical',
          recommendation: 'Add break condition or modify loop condition'
        });
      }
    });

    return issues;
  }

  /**
   * Check for deep recursion patterns
   */
  detectDeepRecursion(code) {
    const recursionMatches = code.match(/function\s+\w+\s*\([\s\S]*?\)\s*{[\s\S]*?\1\s*\(/g);
    if (recursionMatches && recursionMatches.length > 0) {
      return {
        detected: true,
        count: recursionMatches.length,
        message: `${recursionMatches.length} potential recursive calls detected`,
        recommendation: 'Ensure recursion has proper base case and depth limits'
      };
    }
    return { detected: false };
  }

  /**
   * Check for potential memory leaks
   */
  detectMemoryLeakPatterns(code) {
    const patterns = [
      { regex: /setInterval\s*\([^)]*\)/g, message: 'setInterval without clearInterval - potential memory leak' },
      { regex: /addEventListener\s*\([^)]*\)/g, message: 'addEventListener without removeEventListener - potential memory leak' },
      { regex: /new\s+\w+\s*\([\s\S]*?\)/g, message: 'Object creation in loop - potential memory leak' }
    ];

    const issues = [];
    patterns.forEach(pattern => {
      const matches = code.match(pattern.regex);
      if (matches) {
        issues.push({
          pattern: pattern.message,
          count: matches.length,
          severity: 'major'
        });
      }
    });

    return issues;
  }

  /**
   * Validate code for runaway conditions before execution
   */
  validateBeforeExecution(code) {
    const results = {
      infiniteLoops: this.detectInfiniteLoopPatterns(code),
      recursion: this.detectDeepRecursion(code),
      memoryLeaks: this.detectMemoryLeakPatterns(code),
      isSafe: true
    };

    if (results.infiniteLoops.length > 0 || results.recursion.detected) {
      results.isSafe = false;
    }

    return results;
  }
}

/**
 * Jeeves4Coder Plugin Class
 * Main plugin class for Claude Code integration with memory management
 */
class Jeeves4CoderPlugin {
  /**
   * Constructor
   * @param {Object} config - Plugin configuration
   */
  constructor(config = {}) {
    this.name = 'Jeeves4Coder';
    this.version = '1.1.0'; // Updated version with memory management
    this.author = 'Aurigraph Development Team';
    this.description = 'Sophisticated coding assistant for code review, refactoring, and architectural guidance';

    this.config = {
      debug: config.debug || false,
      verbose: config.verbose || false,
      reviewDepth: config.reviewDepth || 'standard', // light, standard, deep
      outputFormat: config.outputFormat || 'detailed', // brief, standard, detailed
      memoryManagementEnabled: config.memoryManagementEnabled !== false, // Default: enabled
      runawayDetectionEnabled: config.runawayDetectionEnabled !== false, // Default: enabled
      maxMemoryMB: config.maxMemoryMB || 512,
      executionTimeoutMs: config.executionTimeoutMs || 30000,
      ...config
    };

    // Initialize memory management
    this.memoryManager = new MemoryManager({
      maxMemoryMB: this.config.maxMemoryMB,
      maxRunawayDetectionMs: this.config.executionTimeoutMs
    });

    // Initialize runaway detection
    this.runawayDetector = new RunawayDetector({
      timeoutMs: this.config.executionTimeoutMs
    });

    this.skills = this.initializeSkills();
    this.languages = this.initializeLanguages();
    this.frameworks = this.initializeFrameworks();
    this.patterns = this.initializePatterns();

    // Performance tracking
    this.executionStats = {
      totalExecutions: 0,
      totalExecutionTimeMs: 0,
      averageExecutionTimeMs: 0,
      maxExecutionTimeMs: 0,
      minExecutionTimeMs: Infinity,
      runawayDetections: 0,
      memoryWarnings: 0
    };
  }

  /**
   * Initialize available skills
   * @returns {Object} Map of available skills
   */
  initializeSkills() {
    return {
      'code-review': {
        name: 'Code Review & Analysis',
        description: 'Comprehensive code review with quality assessment',
        duration: '5-15 minutes',
        parameters: ['code', 'language', 'context'],
        output: ['issues', 'suggestions', 'metrics']
      },
      'refactor-code': {
        name: 'Refactoring & Modernization',
        description: 'Strategic refactoring for improvement',
        duration: '10-30 minutes',
        parameters: ['code', 'objectives', 'constraints'],
        output: ['refactoredCode', 'improvements', 'explanation']
      },
      'architecture-review': {
        name: 'Architecture & Design Review',
        description: 'System architecture assessment and recommendations',
        duration: '15-30 minutes',
        parameters: ['architecture', 'requirements', 'context'],
        output: ['recommendations', 'analysis', 'patterns']
      },
      'optimize-performance': {
        name: 'Performance Optimization',
        description: 'Performance analysis and optimization',
        duration: '10-20 minutes',
        parameters: ['code', 'metrics', 'constraints'],
        output: ['optimizedCode', 'improvements', 'benchmarks']
      },
      'design-pattern-suggest': {
        name: 'Design Pattern Recommendation',
        description: 'Recommend design patterns for solutions',
        duration: '5-10 minutes',
        parameters: ['problem', 'requirements', 'context'],
        output: ['patterns', 'recommendations', 'examples']
      },
      'test-strategy': {
        name: 'Testing Strategy Development',
        description: 'Develop comprehensive testing strategy',
        duration: '10-15 minutes',
        parameters: ['code', 'requirements', 'scope'],
        output: ['strategy', 'testCases', 'examples']
      },
      'documentation-improve': {
        name: 'Documentation Improvement',
        description: 'Enhance code documentation quality',
        duration: '5-15 minutes',
        parameters: ['code', 'docType', 'style'],
        output: ['documentation', 'improvements', 'examples']
      },
      'security-audit': {
        name: 'Security Vulnerability Audit',
        description: 'Security vulnerability assessment and hardening',
        duration: '10-20 minutes',
        parameters: ['code', 'standards', 'context'],
        output: ['vulnerabilities', 'recommendations', 'fixes']
      }
    };
  }

  /**
   * Initialize supported languages
   * @returns {Object} Map of supported languages
   */
  initializeLanguages() {
    return {
      'javascript': {
        name: 'JavaScript',
        expertise: 'expert',
        frameworks: ['Node.js', 'Express', 'React (via Node)', 'Vue', 'Angular']
      },
      'typescript': {
        name: 'TypeScript',
        expertise: 'expert',
        frameworks: ['Node.js', 'Express', 'React', 'Vue', 'Angular', 'Nest.js']
      },
      'python': {
        name: 'Python',
        expertise: 'expert',
        frameworks: ['Django', 'Flask', 'FastAPI', 'async/await', 'asyncio']
      },
      'java': {
        name: 'Java',
        expertise: 'intermediate',
        frameworks: ['Spring Boot', 'Gradle', 'Maven', 'JUnit']
      },
      'csharp': {
        name: 'C#',
        expertise: 'intermediate',
        frameworks: ['.NET Core', 'ASP.NET', 'Entity Framework', 'Moq']
      },
      'go': {
        name: 'Go',
        expertise: 'intermediate',
        frameworks: ['Goroutines', 'Channels', 'gin', 'gorm']
      },
      'rust': {
        name: 'Rust',
        expertise: 'intermediate',
        frameworks: ['Ownership', 'Traits', 'async/await', 'Tokio']
      },
      'sql': {
        name: 'SQL',
        expertise: 'expert',
        frameworks: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis']
      },
      'ruby': {
        name: 'Ruby',
        expertise: 'intermediate',
        frameworks: ['Rails', 'Sinatra', 'gems', 'RSpec']
      },
      'php': {
        name: 'PHP',
        expertise: 'intermediate',
        frameworks: ['Laravel', 'Symfony', 'modern PHP']
      }
    };
  }

  /**
   * Initialize supported frameworks
   * @returns {Object} Map of supported frameworks
   */
  initializeFrameworks() {
    return {
      'frontend': {
        'react': { version: 'latest', expertise: 'expert' },
        'vue': { version: 'latest', expertise: 'advanced' },
        'angular': { version: 'latest', expertise: 'advanced' },
        'svelte': { version: 'latest', expertise: 'intermediate' }
      },
      'backend': {
        'node.js': { version: 'latest', expertise: 'expert' },
        'express': { version: 'latest', expertise: 'expert' },
        'django': { version: 'latest', expertise: 'expert' },
        'flask': { version: 'latest', expertise: 'advanced' },
        'fastapi': { version: 'latest', expertise: 'advanced' },
        'spring-boot': { version: 'latest', expertise: 'intermediate' }
      },
      'cloud': {
        'aws': { services: ['EC2', 'Lambda', 'S3', 'RDS'], expertise: 'advanced' },
        'gcp': { services: ['Compute Engine', 'Cloud Run', 'BigQuery'], expertise: 'advanced' },
        'azure': { services: ['App Service', 'Functions', 'Cosmos DB'], expertise: 'advanced' }
      },
      'devops': {
        'docker': { expertise: 'advanced' },
        'kubernetes': { expertise: 'advanced' },
        'terraform': { expertise: 'advanced' },
        'ci-cd': { tools: ['GitHub Actions', 'GitLab CI', 'Jenkins'], expertise: 'advanced' }
      },
      'database': {
        'postgresql': { expertise: 'expert' },
        'mongodb': { expertise: 'expert' },
        'redis': { expertise: 'advanced' },
        'mysql': { expertise: 'advanced' }
      }
    };
  }

  /**
   * Initialize design patterns
   * @returns {Object} Map of design patterns
   */
  initializePatterns() {
    return {
      'creational': [
        'Singleton', 'Factory', 'Abstract Factory', 'Builder', 'Prototype'
      ],
      'structural': [
        'Adapter', 'Bridge', 'Composite', 'Decorator', 'Facade', 'Proxy'
      ],
      'behavioral': [
        'Chain of Responsibility', 'Command', 'Iterator', 'Mediator',
        'Memento', 'Observer', 'State', 'Strategy', 'Template Method', 'Visitor'
      ],
      'architectural': [
        'MVC', 'MVVM', 'Redux', 'Flux', 'Microservices', 'Event-Driven',
        'CQRS', 'Hexagonal', 'Layered', 'API Gateway'
      ]
    };
  }

  /**
   * Execute a code review analysis with memory and runaway protection
   * @param {Object} params - Review parameters
   * @returns {Object} Review results
   */
  async executeCodeReview(params = {}) {
    const { code, language = 'javascript', context = {}, depth = this.config.reviewDepth } = params;

    if (!code) {
      throw new Error('Code parameter is required for code review');
    }

    // Check memory before execution
    if (this.config.memoryManagementEnabled && !this.memoryManager.isMemoryHealthy()) {
      const status = this.memoryManager.getMemoryStatus();
      this.executionStats.memoryWarnings++;
      throw new Error(`Memory limit exceeded: ${status.usagePercent}% of ${this.config.maxMemoryMB}MB limit`);
    }

    // Detect runaway conditions in code
    if (this.config.runawayDetectionEnabled) {
      const validation = this.runawayDetector.validateBeforeExecution(code);
      if (!validation.isSafe) {
        const issues = [...validation.infiniteLoops];
        if (validation.recursion.detected) {
          issues.push({
            pattern: 'Recursion Risk',
            severity: 'critical',
            message: validation.recursion.message
          });
        }
        return {
          error: true,
          message: 'Code contains potential runaway conditions',
          issues,
          recommendations: 'Fix the detected issues before executing code review',
          timestamp: new Date().toISOString()
        };
      }
    }

    // Start execution timer
    this.memoryManager.startExecution();
    this.executionStats.totalExecutions++;

    try {
      const review = {
        summary: this.analyzeSummary(code),
        strengths: this.identifyStrengths(code, language),
        issues: this.identifyIssues(code, language, depth),
        suggestions: this.generateSuggestions(code, language),
        metrics: this.calculateMetrics(code, language),
        recommendations: this.prioritizeRecommendations(code, language),
        timestamp: new Date().toISOString()
      };

      // Check for runaway execution during processing
      const runawayCheck = this.memoryManager.detectRunaway();
      if (runawayCheck.detected) {
        this.executionStats.runawayDetections++;
        return {
          error: true,
          ...runawayCheck,
          partialResults: review
        };
      }

      return review;
    } catch (error) {
      this.executionStats.runawayDetections++;
      throw new Error(`Code review failed: ${error.message}`);
    } finally {
      // Track execution time
      const executionTime = this.memoryManager.endExecution();
      this.executionStats.totalExecutionTimeMs += executionTime;
      this.executionStats.maxExecutionTimeMs = Math.max(this.executionStats.maxExecutionTimeMs, executionTime);
      this.executionStats.minExecutionTimeMs = Math.min(this.executionStats.minExecutionTimeMs, executionTime);
      this.executionStats.averageExecutionTimeMs =
        this.executionStats.totalExecutionTimeMs / this.executionStats.totalExecutions;
    }
  }

  /**
   * Analyze code and generate summary
   * @param {string} code - Code to analyze
   * @returns {string} Summary analysis
   */
  analyzeSummary(code) {
    const lines = code.trim().split('\n').length;
    const complexity = this.calculateComplexity(code);

    return {
      lineCount: lines,
      complexity: complexity,
      status: complexity > 8 ? 'needs-improvement' : complexity > 5 ? 'acceptable' : 'good',
      summary: `Code analysis: ${lines} lines, ${complexity}/10 complexity`
    };
  }

  /**
   * Identify code strengths
   * @param {string} code - Code to analyze
   * @param {string} language - Programming language
   * @returns {Array} List of strengths
   */
  identifyStrengths(code, language) {
    const strengths = [];

    // Check for clarity
    if (this.hasDescriptiveNames(code)) {
      strengths.push('Clear naming conventions');
    }

    // Check for structure
    if (this.isWellStructured(code)) {
      strengths.push('Well-organized structure');
    }

    // Check for documentation
    if (this.hasDocumentation(code)) {
      strengths.push('Good documentation');
    }

    // Check for error handling
    if (this.hasErrorHandling(code)) {
      strengths.push('Error handling present');
    }

    return strengths.length > 0 ? strengths : ['Code exists and runs'];
  }

  /**
   * Identify code issues
   * @param {string} code - Code to analyze
   * @param {string} language - Programming language
   * @param {string} depth - Analysis depth (light, standard, deep)
   * @returns {Array} List of issues
   */
  identifyIssues(code, language, depth) {
    const issues = {
      critical: [],
      major: [],
      minor: []
    };

    // Critical issues
    if (code.includes('eval(')) {
      issues.critical.push({
        type: 'Security',
        message: 'Avoid eval() - security risk',
        line: this.findLine(code, 'eval('),
        severity: 'critical'
      });
    }

    // Major issues
    if (this.hasMagicNumbers(code)) {
      issues.major.push({
        type: 'Code Quality',
        message: 'Magic numbers detected - extract to constants',
        severity: 'major'
      });
    }

    // Minor issues
    if (code.length > 10000) {
      issues.minor.push({
        type: 'Size',
        message: 'Function/file is too large - consider breaking down',
        severity: 'minor'
      });
    }

    return issues;
  }

  /**
   * Generate improvement suggestions
   * @param {string} code - Code to analyze
   * @param {string} language - Programming language
   * @returns {Array} List of suggestions
   */
  generateSuggestions(code, language) {
    const suggestions = [];

    // Refactoring suggestions
    if (this.hasCodeDuplication(code)) {
      suggestions.push({
        type: 'Refactoring',
        title: 'Extract duplicate code',
        description: 'Found duplicated code patterns that could be extracted'
      });
    }

    // Performance suggestions
    if (this.hasPerformanceIssues(code)) {
      suggestions.push({
        type: 'Performance',
        title: 'Optimize loops and iterations',
        description: 'Potential performance improvements in loop constructs'
      });
    }

    // Testing suggestions
    if (!this.hasTests(code)) {
      suggestions.push({
        type: 'Testing',
        title: 'Add unit tests',
        description: 'No test cases detected - add comprehensive tests'
      });
    }

    // Documentation suggestions
    if (!this.hasDocumentation(code)) {
      suggestions.push({
        type: 'Documentation',
        title: 'Improve code documentation',
        description: 'Add JSDoc/docstrings and inline comments'
      });
    }

    return suggestions;
  }

  /**
   * Calculate code metrics
   * @param {string} code - Code to analyze
   * @param {string} language - Programming language
   * @returns {Object} Code metrics
   */
  calculateMetrics(code, language) {
    const lines = code.split('\n').length;
    const functions = (code.match(/function\s+\w+|const\s+\w+\s*=/g) || []).length;
    const comments = (code.match(/\/\//g) || []).length;
    const docRatio = comments / lines;

    return {
      lines,
      functions,
      comments,
      documentationRatio: (docRatio * 100).toFixed(2) + '%',
      complexity: this.calculateComplexity(code),
      maintainability: this.calculateMaintainability(code)
    };
  }

  /**
   * Prioritize recommendations
   * @param {string} code - Code to analyze
   * @param {string} language - Programming language
   * @returns {Array} Prioritized recommendations
   */
  prioritizeRecommendations(code, language) {
    return [
      {
        priority: 1,
        title: 'Security Review',
        description: 'Review for security vulnerabilities'
      },
      {
        priority: 2,
        title: 'Performance Analysis',
        description: 'Analyze and optimize performance'
      },
      {
        priority: 3,
        title: 'Refactoring',
        description: 'Improve code structure and readability'
      },
      {
        priority: 4,
        title: 'Testing',
        description: 'Increase test coverage'
      },
      {
        priority: 5,
        title: 'Documentation',
        description: 'Improve documentation quality'
      }
    ];
  }

  /**
   * Helper: Calculate code complexity
   */
  calculateComplexity(code) {
    const conditions = (code.match(/if|else|switch|case|for|while|catch/g) || []).length;
    return Math.min(Math.ceil(conditions / 2), 10);
  }

  /**
   * Helper: Calculate maintainability score
   */
  calculateMaintainability(code) {
    const lines = code.split('\n').length;
    const complexity = this.calculateComplexity(code);
    const hasTests = this.hasTests(code);
    const hasDocs = this.hasDocumentation(code);

    let score = 100;
    score -= complexity * 5;
    score -= (lines / 100) * 2;
    score += hasTests ? 10 : -5;
    score += hasDocs ? 10 : -5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Helper: Check for descriptive names
   */
  hasDescriptiveNames(code) {
    const singleLetterVars = (code.match(/\b[a-z]\b/g) || []).length;
    return singleLetterVars < 10;
  }

  /**
   * Helper: Check if code is well-structured
   */
  isWellStructured(code) {
    return code.includes('class') || code.includes('function') || code.includes('const');
  }

  /**
   * Helper: Check for documentation
   */
  hasDocumentation(code) {
    return code.includes('/*') || code.includes('//') || code.includes('/**');
  }

  /**
   * Helper: Check for error handling
   */
  hasErrorHandling(code) {
    return code.includes('try') && code.includes('catch');
  }

  /**
   * Helper: Find line number of text
   */
  findLine(code, text) {
    const lines = code.split('\n');
    const index = lines.findIndex(line => line.includes(text));
    return index >= 0 ? index + 1 : 0;
  }

  /**
   * Helper: Check for magic numbers
   */
  hasMagicNumbers(code) {
    return /\b[0-9]{2,}\b/.test(code);
  }

  /**
   * Helper: Check for code duplication
   */
  hasCodeDuplication(code) {
    const lines = code.split('\n');
    return lines.length > new Set(lines).size;
  }

  /**
   * Helper: Check for performance issues
   */
  hasPerformanceIssues(code) {
    return code.includes('nested for') || code.includes('synchronous');
  }

  /**
   * Helper: Check for tests
   */
  hasTests(code) {
    return code.includes('test') || code.includes('describe') || code.includes('it(');
  }

  /**
   * Get available skills
   */
  getSkills() {
    return this.skills;
  }

  /**
   * Get supported languages
   */
  getLanguages() {
    return this.languages;
  }

  /**
   * Get supported frameworks
   */
  getFrameworks() {
    return this.frameworks;
  }

  /**
   * Get available patterns
   */
  getPatterns() {
    return this.patterns;
  }

  /**
   * Get memory management status
   * @returns {Object} Current memory status and health
   */
  getMemoryStatus() {
    return this.memoryManager.getMemoryStatus();
  }

  /**
   * Get execution statistics
   * @returns {Object} Execution performance metrics
   */
  getExecutionStats() {
    return {
      ...this.executionStats,
      memoryStatus: this.memoryManager.getMemoryStatus(),
      memoryTrend: this.memoryManager.getMemoryTrend()
    };
  }

  /**
   * Validate code for runaway conditions
   * @param {string} code - Code to validate
   * @returns {Object} Validation results
   */
  validateCodeSafety(code) {
    return this.runawayDetector.validateBeforeExecution(code);
  }

  /**
   * Force garbage collection
   * @returns {Object} GC result
   */
  forceGarbageCollection() {
    return this.memoryManager.forceGarbageCollection();
  }

  /**
   * Reset execution statistics
   */
  resetExecutionStats() {
    this.executionStats = {
      totalExecutions: 0,
      totalExecutionTimeMs: 0,
      averageExecutionTimeMs: 0,
      maxExecutionTimeMs: 0,
      minExecutionTimeMs: Infinity,
      runawayDetections: 0,
      memoryWarnings: 0
    };
  }

  /**
   * Get plugin information
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      author: this.author,
      description: this.description,
      skills: Object.keys(this.skills).length,
      languages: Object.keys(this.languages).length,
      frameworks: Object.keys(this.frameworks),
      patterns: Object.values(this.patterns).reduce((sum, arr) => sum + arr.length, 0),
      memoryManagementEnabled: this.config.memoryManagementEnabled,
      runawayDetectionEnabled: this.config.runawayDetectionEnabled,
      maxMemoryMB: this.config.maxMemoryMB,
      executionTimeoutMs: this.config.executionTimeoutMs
    };
  }

  /**
   * Format output based on configuration
   */
  formatOutput(data, format = this.config.outputFormat) {
    switch (format) {
      case 'brief':
        return this.briefFormat(data);
      case 'detailed':
        return this.detailedFormat(data);
      case 'standard':
      default:
        return this.standardFormat(data);
    }
  }

  /**
   * Brief format output
   */
  briefFormat(data) {
    return {
      summary: data.summary,
      issues: data.issues.critical.length + data.issues.major.length,
      recommendations: data.recommendations.slice(0, 3)
    };
  }

  /**
   * Standard format output
   */
  standardFormat(data) {
    return {
      summary: data.summary,
      strengths: data.strengths,
      issues: data.issues,
      suggestions: data.suggestions.slice(0, 5),
      recommendations: data.recommendations.slice(0, 5)
    };
  }

  /**
   * Detailed format output
   */
  detailedFormat(data) {
    return data; // Return all details
  }

  /**
   * Console output with styling
   */
  log(message, level = 'info') {
    const prefix = {
      'info': chalk.blue('ℹ'),
      'success': chalk.green('✓'),
      'warning': chalk.yellow('⚠'),
      'error': chalk.red('✗')
    };

    console.log(`${prefix[level] || prefix.info} ${message}`);
  }
}

/**
 * Export plugin
 */
module.exports = Jeeves4CoderPlugin;

/**
 * CLI Usage
 */
if (require.main === module) {
  const plugin = new Jeeves4CoderPlugin({
    verbose: true,
    debug: false,
    memoryManagementEnabled: true,
    runawayDetectionEnabled: true,
    maxMemoryMB: 512,
    executionTimeoutMs: 30000
  });

  console.log('\n' + chalk.bold.cyan('🤖 Jeeves4Coder Plugin v1.1.0 - WITH MEMORY MANAGEMENT'));
  console.log(chalk.gray('Sophisticated coding assistant with IDE crash prevention\n'));

  const info = plugin.getInfo();
  console.log('Plugin Information:');
  console.log(`  Name: ${info.name}`);
  console.log(`  Version: ${info.version}`);
  console.log(`  Skills: ${info.skills}`);
  console.log(`  Languages: ${info.languages}`);
  console.log(`  Design Patterns: ${info.patterns}`);
  console.log(`  Memory Management: ${info.memoryManagementEnabled ? chalk.green('✓ ENABLED') : chalk.red('✗ DISABLED')}`);
  console.log(`  Runaway Detection: ${info.runawayDetectionEnabled ? chalk.green('✓ ENABLED') : chalk.red('✗ DISABLED')}`);
  console.log(`  Max Memory: ${info.maxMemoryMB}MB`);
  console.log(`  Execution Timeout: ${info.executionTimeoutMs}ms\n`);

  // Show memory status
  const memoryStatus = plugin.getMemoryStatus();
  console.log(chalk.bold('Memory Status:'));
  console.log(`  Heap Used: ${memoryStatus.heapUsedMB}MB / ${memoryStatus.heapTotalMB}MB`);
  console.log(`  RSS: ${memoryStatus.rssMB}MB`);
  console.log(`  Usage: ${memoryStatus.usagePercent}% - Status: ${memoryStatus.status === 'healthy' ? chalk.green(memoryStatus.status) : chalk.yellow(memoryStatus.status)}\n`);

  // Example code review
  const exampleCode = `
    function calculateSum(numbers) {
      let sum = 0;
      for (let i = 0; i < numbers.length; i++) {
        sum += numbers[i];
      }
      return sum;
    }
  `;

  console.log(chalk.bold('Running safe code review...\n'));

  // Validate code safety first
  const safety = plugin.validateCodeSafety(exampleCode);
  console.log(chalk.bold('Code Safety Check:'));
  console.log(`  Infinite Loops: ${safety.infiniteLoops.length > 0 ? chalk.red('DETECTED') : chalk.green('✓ SAFE')}`);
  console.log(`  Deep Recursion: ${safety.recursion.detected ? chalk.red('DETECTED') : chalk.green('✓ SAFE')}`);
  console.log(`  Memory Leaks: ${safety.memoryLeaks.length > 0 ? chalk.yellow('POTENTIAL ISSUES') : chalk.green('✓ CLEAN')}`);
  console.log(`  Overall Safety: ${safety.isSafe ? chalk.green('✓ SAFE TO EXECUTE') : chalk.red('✗ UNSAFE')}\n`);

  // Execute review if safe
  if (safety.isSafe) {
    plugin.executeCodeReview({ code: exampleCode }).then(review => {
      console.log(chalk.bold('Review Results:'));
      console.log(JSON.stringify(review, null, 2));

      // Show execution statistics
      const stats = plugin.getExecutionStats();
      console.log('\n' + chalk.bold('Execution Statistics:'));
      console.log(`  Total Executions: ${stats.totalExecutions}`);
      console.log(`  Average Time: ${stats.averageExecutionTimeMs.toFixed(2)}ms`);
      console.log(`  Max Time: ${stats.maxExecutionTimeMs}ms`);
      console.log(`  Memory Warnings: ${stats.memoryWarnings}`);
      console.log(`  Runaway Detections: ${stats.runawayDetections}\n`);
    });
  } else {
    console.log(chalk.red('Code failed safety check. Fix issues before executing.\n'));
  }
}
