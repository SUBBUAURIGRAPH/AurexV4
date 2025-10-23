#!/usr/bin/env node

/**
 * Aurigraph Agents - Environment Loader
 * Loads all project files including credentials.md on environment initialization
 *
 * This module ensures that when the Aurigraph Agent environment loads,
 * all project context files are available for agent access.
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class EnvironmentLoader {
  constructor(options = {}) {
    this.version = '1.0.0';
    this.projectRoot = options.projectRoot || path.join(__dirname, '..');
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.verbose = options.verbose || false;
    this.cache = new Map();
    this.loadedFiles = new Map();
    this.credentials = null;
    this.contextFiles = null;
  }

  /**
   * Initialize the environment by loading all project files
   * This should be called when the Aurigraph Agent environment loads
   */
  async initialize() {
    if (this.verbose) {
      console.log(`🚀 Initializing Aurigraph Agent Environment (${this.environment})`);
    }

    try {
      // Load context files (CONTEXT.md, README.md, etc.)
      await this.loadContextFiles();

      // Load credentials (credentials.md or .env)
      await this.loadCredentials();

      // Load configuration files
      await this.loadConfigurationFiles();

      // Load agents and skills
      await this.loadAgentsAndSkills();

      // Validate environment
      this.validateEnvironment();

      if (this.verbose) {
        console.log(`✅ Environment loaded successfully`);
        this.printLoadSummary();
      }

      return {
        success: true,
        environment: this.environment,
        filesLoaded: this.loadedFiles.size,
        contextAvailable: !!this.contextFiles,
        credentialsLoaded: !!this.credentials
      };
    } catch (error) {
      console.error('❌ Environment initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Load all context files (CONTEXT.md, README.md, PROMPTS.md, etc.)
   */
  async loadContextFiles() {
    if (this.verbose) console.log('📚 Loading context files...');

    const contextFileNames = [
      'CONTEXT.md',
      'README.md',
      'PROMPTS.md',
      'TODO.md',
      'CHANGELOG.md'
    ];

    const contextFiles = {};

    for (const fileName of contextFileNames) {
      const filePath = path.join(this.projectRoot, fileName);

      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          contextFiles[fileName] = {
            path: filePath,
            content: content,
            size: Buffer.byteLength(content, 'utf8'),
            hash: this.calculateHash(content),
            loadedAt: new Date().toISOString()
          };

          this.loadedFiles.set(fileName, contextFiles[fileName]);

          if (this.verbose) {
            console.log(`  ✓ ${fileName} (${this.formatBytes(contextFiles[fileName].size)})`);
          }
        } catch (error) {
          console.warn(`  ⚠ Failed to load ${fileName}: ${error.message}`);
        }
      }
    }

    this.contextFiles = contextFiles;
    this.cache.set('context-files', contextFiles);

    return contextFiles;
  }

  /**
   * Load credentials from credentials.md or environment variables
   * Supports both markdown format and .env format
   */
  async loadCredentials() {
    if (this.verbose) console.log('🔐 Loading credentials...');

    const credentials = {
      sources: [],
      data: {},
      environment: {},
      encrypted: {}
    };

    // Try to load credentials.md
    const credentialsMdPath = path.join(this.projectRoot, 'credentials.md');
    if (fs.existsSync(credentialsMdPath)) {
      try {
        const content = fs.readFileSync(credentialsMdPath, 'utf8');
        const parsed = this.parseCredentialsMd(content);
        credentials.sources.push('credentials.md');
        credentials.data = { ...credentials.data, ...parsed };

        this.loadedFiles.set('credentials.md', {
          path: credentialsMdPath,
          size: Buffer.byteLength(content, 'utf8'),
          hash: this.calculateHash(content),
          loadedAt: new Date().toISOString(),
          redacted: true // Don't store actual content
        });

        if (this.verbose) console.log(`  ✓ credentials.md loaded (redacted)`);
      } catch (error) {
        console.warn(`  ⚠ Failed to load credentials.md: ${error.message}`);
      }
    }

    // Load environment variables for credentials
    const envCredentials = this.loadEnvironmentVariables();
    if (Object.keys(envCredentials).length > 0) {
      credentials.sources.push('environment-variables');
      credentials.environment = envCredentials;

      if (this.verbose) {
        console.log(`  ✓ Environment variables loaded (${Object.keys(envCredentials).length} variables)`);
      }
    }

    // Mark credentials that should be encrypted
    credentials.encrypted = this.identifyEncryptableCredentials(credentials.data);

    this.credentials = credentials;
    this.cache.set('credentials', credentials);

    return credentials;
  }

  /**
   * Load configuration files (config.json, package.json, etc.)
   */
  async loadConfigurationFiles() {
    if (this.verbose) console.log('⚙️  Loading configuration files...');

    const configFiles = [
      'plugin/config.json',
      'plugin/package.json'
    ];

    const configurations = {};

    for (const filePath of configFiles) {
      const fullPath = path.join(this.projectRoot, filePath);

      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const parsed = JSON.parse(content);

          configurations[filePath] = {
            path: fullPath,
            config: parsed,
            loadedAt: new Date().toISOString()
          };

          this.loadedFiles.set(filePath, {
            path: fullPath,
            size: Buffer.byteLength(content, 'utf8'),
            loadedAt: new Date().toISOString()
          });

          if (this.verbose) {
            console.log(`  ✓ ${filePath}`);
          }
        } catch (error) {
          console.warn(`  ⚠ Failed to load ${filePath}: ${error.message}`);
        }
      }
    }

    this.cache.set('configurations', configurations);
    return configurations;
  }

  /**
   * Load agents and skills metadata
   */
  async loadAgentsAndSkills() {
    if (this.verbose) console.log('👥 Loading agents and skills...');

    const agentsPath = path.join(this.projectRoot, 'agents');
    const skillsPath = path.join(this.projectRoot, 'skills');

    const agents = this.loadDirectory(agentsPath, '.md');
    const skills = this.loadDirectory(skillsPath, '.md', ['README.md', 'SKILL_TEMPLATE.md']);

    this.loadedFiles.set('agents', { count: Object.keys(agents).length });
    this.loadedFiles.set('skills', { count: Object.keys(skills).length });

    if (this.verbose) {
      console.log(`  ✓ ${Object.keys(agents).length} agents loaded`);
      console.log(`  ✓ ${Object.keys(skills).length} skills loaded`);
    }

    this.cache.set('agents', agents);
    this.cache.set('skills', skills);

    return { agents, skills };
  }

  /**
   * Parse credentials.md file
   * Supports multiple formats (YAML, key=value, JSON)
   */
  parseCredentialsMd(content) {
    const credentials = {};

    // Split by sections
    const sections = content.split(/## |# /);

    for (const section of sections) {
      const lines = section.split('\n').filter(line => line.trim());

      for (const line of lines) {
        // Skip comments and empty lines
        if (line.startsWith('//') || line.startsWith('#') || !line.trim()) continue;

        // Parse key=value format
        if (line.includes('=')) {
          const [key, value] = line.split('=').map(s => s.trim());
          if (key && value) {
            credentials[key] = value;
          }
        }

        // Parse key: value format (YAML)
        if (line.includes(':')) {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key && value) {
            credentials[key] = value;
          }
        }
      }
    }

    return credentials;
  }

  /**
   * Load environment variables that look like credentials
   */
  loadEnvironmentVariables() {
    const credentialPatterns = [
      'API_KEY',
      'SECRET',
      'TOKEN',
      'PASSWORD',
      'CREDENTIAL',
      'AUTH',
      'KEY',
      'HERMES_',
      'JIRA_',
      'GITHUB_',
      'AWS_'
    ];

    const envCredentials = {};

    for (const [key, value] of Object.entries(process.env)) {
      const isCredential = credentialPatterns.some(pattern => key.includes(pattern));

      if (isCredential && value) {
        // Store only the key and a masked value
        envCredentials[key] = '***' + value.slice(-4); // Show last 4 chars only
      }
    }

    return envCredentials;
  }

  /**
   * Identify which credentials should be encrypted
   */
  identifyEncryptableCredentials(credentials) {
    const sensitivePatterns = [
      'key',
      'secret',
      'password',
      'token',
      'credential',
      'auth'
    ];

    const encryptable = {};

    for (const [key, value] of Object.entries(credentials)) {
      const isSensitive = sensitivePatterns.some(pattern => key.toLowerCase().includes(pattern));

      if (isSensitive && value) {
        encryptable[key] = true;
      }
    }

    return encryptable;
  }

  /**
   * Validate that the environment is properly loaded
   */
  validateEnvironment() {
    const errors = [];

    // Check required context files
    if (!this.contextFiles['CONTEXT.md']) {
      errors.push('Missing CONTEXT.md - project context unavailable');
    }

    // Check that at least some files were loaded
    if (this.loadedFiles.size === 0) {
      errors.push('No files were loaded');
    }

    // Check credentials source
    if (this.credentials && this.credentials.sources.length === 0) {
      if (this.environment === 'production') {
        errors.push('No credentials loaded in production environment');
      }
    }

    if (errors.length > 0) {
      console.warn('⚠️  Validation warnings:');
      errors.forEach(error => console.warn(`   - ${error}`));
    }

    return errors.length === 0;
  }

  /**
   * Load all files from a directory
   */
  loadDirectory(dirPath, extension = '.md', exclude = []) {
    const files = {};

    if (!fs.existsSync(dirPath)) {
      return files;
    }

    try {
      const entries = fs.readdirSync(dirPath);

      for (const entry of entries) {
        if (!entry.endsWith(extension) || exclude.includes(entry)) continue;

        const fullPath = path.join(dirPath, entry);
        const content = fs.readFileSync(fullPath, 'utf8');

        files[entry.replace(extension, '')] = {
          path: fullPath,
          size: Buffer.byteLength(content, 'utf8'),
          loadedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.warn(`Failed to load directory ${dirPath}: ${error.message}`);
    }

    return files;
  }

  /**
   * Get loaded file content (if cached)
   */
  getFile(fileName) {
    return this.loadedFiles.get(fileName) || null;
  }

  /**
   * Get all loaded files metadata
   */
  getLoadedFiles() {
    return Object.fromEntries(this.loadedFiles);
  }

  /**
   * Get credentials (redacted for security)
   */
  getCredentials(includeRedacted = false) {
    if (!this.credentials) return null;

    if (includeRedacted) {
      return this.credentials;
    }

    // Return redacted credentials
    return {
      sources: this.credentials.sources,
      data: Object.keys(this.credentials.data).reduce((acc, key) => {
        acc[key] = '***'; // Fully redact
        return acc;
      }, {}),
      environment: this.credentials.environment,
      encryptable: Object.keys(this.credentials.encrypted)
    };
  }

  /**
   * Get context files
   */
  getContextFiles() {
    return this.contextFiles;
  }

  /**
   * Get specific context file content
   */
  getContextFileContent(fileName) {
    if (!this.contextFiles || !this.contextFiles[fileName]) {
      return null;
    }

    return this.contextFiles[fileName].content;
  }

  /**
   * Get cached data
   */
  getCache(key) {
    return this.cache.get(key) || null;
  }

  /**
   * Print load summary
   */
  printLoadSummary() {
    console.log('\n📊 Environment Load Summary:');
    console.log('='.repeat(50));
    console.log(`Total Files Loaded: ${this.loadedFiles.size}`);
    console.log(`Context Files: ${this.contextFiles ? Object.keys(this.contextFiles).length : 0}`);
    console.log(`Credentials Sources: ${this.credentials ? this.credentials.sources.length : 0}`);
    console.log(`Cache Entries: ${this.cache.size}`);
    console.log(`Environment: ${this.environment}`);
    console.log('='.repeat(50));
  }

  /**
   * Calculate hash of content
   */
  calculateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 8);
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Export environment state to file
   */
  exportState(outputPath) {
    const state = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      version: this.version,
      filesLoaded: this.getLoadedFiles(),
      credentialsSources: this.credentials ? this.credentials.sources : [],
      cacheEntries: Array.from(this.cache.keys()),
      contextFilesLoaded: this.contextFiles ? Object.keys(this.contextFiles) : []
    };

    fs.writeFileSync(outputPath, JSON.stringify(state, null, 2));
    return state;
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
    this.credentials = null;
    this.contextFiles = null;
    this.loadedFiles.clear();
  }
}

// Export the EnvironmentLoader class
module.exports = EnvironmentLoader;

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'init';

  const loader = new EnvironmentLoader({
    projectRoot: process.cwd(),
    verbose: args.includes('--verbose') || args.includes('-v')
  });

  switch (command) {
    case 'init':
    case 'initialize':
      loader.initialize()
        .then(result => {
          console.log('\n✅ Environment initialization complete');
          process.exit(0);
        })
        .catch(error => {
          console.error('\n❌ Initialization failed:', error);
          process.exit(1);
        });
      break;

    case 'status':
      loader.initialize()
        .then(() => {
          console.log('\n📋 Loaded Files:');
          const files = loader.getLoadedFiles();
          Object.entries(files).forEach(([name, info]) => {
            console.log(`  • ${name}`);
          });
        })
        .catch(error => console.error('Error:', error));
      break;

    case 'credentials':
      loader.initialize()
        .then(() => {
          console.log('\n🔐 Credentials Information:');
          const creds = loader.getCredentials();
          console.log(`  Sources: ${creds.sources.join(', ')}`);
          console.log(`  Variables Loaded: ${creds.environment ? Object.keys(creds.environment).length : 0}`);
          console.log(`  Encryptable Fields: ${creds.encryptable.length}`);
        })
        .catch(error => console.error('Error:', error));
      break;

    case 'export':
      const outputFile = args[1] || 'environment-state.json';
      loader.initialize()
        .then(() => {
          loader.exportState(outputFile);
          console.log(`✅ Environment state exported to ${outputFile}`);
        })
        .catch(error => console.error('Error:', error));
      break;

    case 'help':
    default:
      console.log(`
Aurigraph Agent Environment Loader v${new EnvironmentLoader().version}

Usage:
  node environment-loader.js init                Initialize environment
  node environment-loader.js status              Show loaded files
  node environment-loader.js credentials         Show credentials info
  node environment-loader.js export [file]       Export environment state
  node environment-loader.js help                Show this help

Options:
  -v, --verbose                                  Verbose output

Examples:
  node environment-loader.js init
  node environment-loader.js init --verbose
  node environment-loader.js status
  node environment-loader.js export state.json
      `);
  }
}
