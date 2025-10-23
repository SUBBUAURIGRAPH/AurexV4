/**
 * File Analyzer Skill - Example skill with file operations
 *
 * Demonstrates file system operations and error handling
 * in the Skill Executor Framework
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  // Skill metadata
  name: 'file-analyzer',
  description: 'Analyzes files and provides statistics (size, type, lines, etc.)',
  version: '1.0.0',
  author: 'Aurigraph Development Team',

  // Classification
  category: 'utilities',
  tags: ['file', 'analysis', 'utilities', 'filesystem'],
  priority: 'normal',

  // Configuration
  timeout: 30000, // 30 seconds
  retries: 2,
  output: 'object',

  // Dependencies
  dependencies: [],
  requiredEnvironment: [],

  // Status
  enabled: true,
  experimental: false,
  deprecated: false,

  // Parameters definition
  parameters: {
    filePath: {
      type: 'string',
      required: true,
      description: 'Absolute path to the file to analyze',
      validate: (value) => {
        return typeof value === 'string' && value.length > 0 && path.isAbsolute(value);
      }
    },
    includeContent: {
      type: 'boolean',
      required: false,
      description: 'Include file content in the result (for small files)',
      default: false
    },
    maxContentSize: {
      type: 'number',
      required: false,
      description: 'Maximum file size (in bytes) to include content',
      default: 10240, // 10KB
      validate: (value) => {
        return typeof value === 'number' && value > 0 && value <= 1048576; // Max 1MB
      }
    }
  },

  /**
   * Execute the skill
   *
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Analysis result
   */
  async execute(context) {
    const { parameters, logger, fs: fileSystem, path: pathModule, helpers } = context;

    const { filePath, includeContent = false, maxContentSize = 10240 } = parameters;

    logger.log(`Analyzing file: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Get file stats
    const stats = fs.statSync(filePath);

    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    // Basic file information
    const analysis = {
      path: filePath,
      name: path.basename(filePath),
      directory: path.dirname(filePath),
      extension: path.extname(filePath),
      size: stats.size,
      sizeFormatted: helpers.formatBytes(stats.size),
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      accessed: stats.atime.toISOString(),
      permissions: {
        readable: fs.accessSync(filePath, fs.constants.R_OK) === undefined,
        writable: this.checkWritable(filePath),
        executable: this.checkExecutable(filePath)
      }
    };

    // Determine file type
    analysis.type = this.determineFileType(analysis.extension);

    // Analyze content if requested and file is small enough
    if (includeContent && stats.size <= maxContentSize) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        analysis.content = content;
        analysis.lines = content.split('\n').length;
        analysis.characters = content.length;
        analysis.words = content.split(/\s+/).filter(w => w.length > 0).length;
      } catch (error) {
        logger.warn(`Could not read file content: ${error.message}`);
        analysis.contentError = error.message;
      }
    }

    // For text files, provide additional statistics
    if (analysis.type === 'text' && stats.size <= maxContentSize) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        analysis.textStats = {
          lines: content.split('\n').length,
          nonEmptyLines: content.split('\n').filter(line => line.trim().length > 0).length,
          characters: content.length,
          words: content.split(/\s+/).filter(w => w.length > 0).length
        };
      } catch (error) {
        // Silently fail for text stats
      }
    }

    logger.log(`File analysis complete: ${analysis.name} (${analysis.sizeFormatted})`);

    return {
      success: true,
      analysis,
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Check if file is writable
   *
   * @param {string} filePath - File path
   * @returns {boolean} True if writable
   */
  checkWritable(filePath) {
    try {
      fs.accessSync(filePath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Check if file is executable
   *
   * @param {string} filePath - File path
   * @returns {boolean} True if executable
   */
  checkExecutable(filePath) {
    try {
      fs.accessSync(filePath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Determine file type from extension
   *
   * @param {string} extension - File extension
   * @returns {string} File type category
   */
  determineFileType(extension) {
    const ext = extension.toLowerCase();

    const types = {
      text: ['.txt', '.md', '.json', '.xml', '.csv', '.log', '.yml', '.yaml'],
      code: ['.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.rb', '.go', '.rs', '.php'],
      image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.ico', '.webp'],
      video: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'],
      audio: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'],
      archive: ['.zip', '.tar', '.gz', '.bz2', '.7z', '.rar'],
      document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']
    };

    for (const [type, extensions] of Object.entries(types)) {
      if (extensions.includes(ext)) {
        return type;
      }
    }

    return 'unknown';
  },

  /**
   * Format the result for display
   *
   * @param {Object} result - Raw execution result
   * @returns {Object} Formatted result
   */
  formatResult(result) {
    return {
      success: result.success,
      file: {
        name: result.analysis.name,
        path: result.analysis.path,
        size: result.analysis.sizeFormatted,
        type: result.analysis.type,
        modified: result.analysis.modified
      },
      statistics: result.analysis.textStats || null,
      timestamp: result.timestamp
    };
  }
};
