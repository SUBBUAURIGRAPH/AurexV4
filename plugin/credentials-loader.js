/**
 * Secure Credentials Loader
 * Loads and validates credentials from environment variables
 * Supports multiple credential sources with fallback logic
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

class CredentialsLoader {
  constructor(options = {}) {
    this.environment = process.env.NODE_ENV || 'development';
    this.verbose = options.verbose || false;
    this.credentials = {};
    this.missingCredentials = [];
    this.warnings = [];
  }

  /**
   * Load all credentials from environment variables
   * @returns {Object} Credentials object with all configured services
   */
  load() {
    this.log('Loading credentials from environment variables...');

    const credentials = {
      jira: this.loadJiraCredentials(),
      github: this.loadGitHubCredentials(),
      docker: this.loadDockerCredentials(),
      aws: this.loadAWSCredentials(),
      slack: this.loadSlackCredentials(),
      database: this.loadDatabaseCredentials(),
      security: this.loadSecurityCredentials()
    };

    this.credentials = credentials;
    this.validateCredentials();

    return credentials;
  }

  /**
   * Load JIRA credentials
   * @private
   */
  loadJiraCredentials() {
    const jira = {
      apiKey: process.env.JIRA_API_KEY || null,
      email: process.env.JIRA_EMAIL || null,
      baseUrl: process.env.JIRA_BASE_URL || 'https://aurigraph.atlassian.net',
      configured: false
    };

    if (jira.apiKey && jira.email) {
      jira.configured = true;
      this.log('✓ JIRA credentials loaded');
    } else {
      this.addMissing('JIRA', ['JIRA_API_KEY', 'JIRA_EMAIL']);
      this.warn('JIRA credentials not found - jira-sync skill will be unavailable');
    }

    return jira;
  }

  /**
   * Load GitHub credentials
   * @private
   */
  loadGitHubCredentials() {
    const github = {
      token: process.env.GITHUB_TOKEN || null,
      apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
      configured: false
    };

    if (github.token) {
      github.configured = true;
      this.log('✓ GitHub credentials loaded');
    } else {
      this.addMissing('GitHub', ['GITHUB_TOKEN']);
      this.warn('GitHub credentials not found - github integration will be limited');
    }

    return github;
  }

  /**
   * Load Docker credentials
   * @private
   */
  loadDockerCredentials() {
    const docker = {
      host: process.env.DOCKER_HOST || 'unix:///var/run/docker.sock',
      registryUsername: process.env.DOCKER_REGISTRY_USERNAME || null,
      registryPassword: process.env.DOCKER_REGISTRY_PASSWORD || null,
      registryUrl: process.env.DOCKER_REGISTRY_URL || 'docker.io',
      configured: false
    };

    // Docker is optional - system Docker socket is default
    if (docker.registryUsername && docker.registryPassword) {
      docker.configured = true;
      this.log('✓ Docker registry credentials loaded');
    } else {
      this.warn('Docker registry credentials not found - will use Docker socket only');
    }

    return docker;
  }

  /**
   * Load AWS credentials
   * @private
   */
  loadAWSCredentials() {
    const aws = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || null,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || null,
      region: process.env.AWS_REGION || 'us-east-1',
      configured: false
    };

    if (aws.accessKeyId && aws.secretAccessKey) {
      aws.configured = true;
      this.log('✓ AWS credentials loaded');
    } else {
      this.warn('AWS credentials not found - AWS features will be unavailable');
    }

    return aws;
  }

  /**
   * Load Slack credentials
   * @private
   */
  loadSlackCredentials() {
    const slack = {
      botToken: process.env.SLACK_BOT_TOKEN || null,
      signingSecret: process.env.SLACK_SIGNING_SECRET || null,
      configured: false
    };

    if (slack.botToken && slack.signingSecret) {
      slack.configured = true;
      this.log('✓ Slack credentials loaded');
    } else {
      this.warn('Slack credentials not found - Slack integration will be unavailable');
    }

    return slack;
  }

  /**
   * Load database credentials
   * @private
   */
  loadDatabaseCredentials() {
    const database = {
      mongoUri: process.env.MONGODB_URI || null,
      user: process.env.MONGODB_USER || null,
      password: process.env.MONGODB_PASSWORD || null,
      configured: false
    };

    if (database.mongoUri) {
      database.configured = true;
      this.log('✓ Database credentials loaded');
    } else {
      this.warn('MongoDB credentials not found - database features will be unavailable');
    }

    return database;
  }

  /**
   * Load security credentials
   * @private
   */
  loadSecurityCredentials() {
    const security = {
      jwtSecret: process.env.JWT_SECRET || null,
      encryptionKey: process.env.ENCRYPTION_KEY || null
    };

    if (!security.jwtSecret) {
      this.warn('JWT_SECRET not configured - using default (not secure for production)');
    }

    if (!security.encryptionKey) {
      this.warn('ENCRYPTION_KEY not configured - encryption will be disabled');
    }

    return security;
  }

  /**
   * Get credentials for a specific service
   * @param {string} service - Service name (jira, github, docker, aws, slack, database)
   * @returns {Object} Service credentials
   */
  getCredentials(service) {
    if (!this.credentials[service]) {
      throw new Error(`Unknown service: ${service}`);
    }
    return this.credentials[service];
  }

  /**
   * Check if a service is configured
   * @param {string} service - Service name
   * @returns {boolean} True if service is configured
   */
  isConfigured(service) {
    const creds = this.credentials[service];
    return creds && creds.configured === true;
  }

  /**
   * Get all configured services
   * @returns {Array} List of configured service names
   */
  getConfiguredServices() {
    return Object.keys(this.credentials).filter(
      service => this.credentials[service].configured === true
    );
  }

  /**
   * Get all missing credentials
   * @returns {Array} Array of missing credential configurations
   */
  getMissingCredentials() {
    return this.missingCredentials;
  }

  /**
   * Get all warnings
   * @returns {Array} Array of credential warnings
   */
  getWarnings() {
    return this.warnings;
  }

  /**
   * Validate all loaded credentials
   * @private
   */
  validateCredentials() {
    this.log(`\nCredential Summary:`);
    this.log(`Environment: ${this.environment}`);
    this.log(`Configured Services: ${this.getConfiguredServices().join(', ') || 'None'}`);
    this.log(`Warnings: ${this.warnings.length}`);

    if (this.warnings.length > 0) {
      this.log('\nWarnings:');
      this.warnings.forEach(w => this.log(`  ⚠️  ${w}`));
    }

    if (this.missingCredentials.length > 0) {
      this.log('\nMissing Credentials (required for some features):');
      this.missingCredentials.forEach(m => {
        this.log(`  ${m.service}: ${m.variables.join(', ')}`);
      });
    }
  }

  /**
   * Add missing credential record
   * @private
   */
  addMissing(service, variables) {
    this.missingCredentials.push({ service, variables });
  }

  /**
   * Add warning message
   * @private
   */
  warn(message) {
    this.warnings.push(message);
  }

  /**
   * Log message if verbose
   * @private
   */
  log(message) {
    if (this.verbose) {
      console.log(message);
    }
  }

  /**
   * Print credential status report
   */
  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('CREDENTIALS LOADER REPORT');
    console.log('='.repeat(60));
    this.validateCredentials();
    console.log('='.repeat(60) + '\n');
  }
}

module.exports = CredentialsLoader;
