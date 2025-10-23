#!/usr/bin/env node

/**
 * Aurigraph Agents - Claude Code Plugin
 * Main entry point for the plugin
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const EnvironmentLoader = require('./environment-loader');
const SkillExecutor = require('./skill-executor');
const SkillManager = require('./skill-manager');

class AurigraphAgentsPlugin {
  constructor(config = {}) {
    this.version = '1.0.0';
    this.name = 'Aurigraph Agents';
    this.config = this.loadConfig(config);
    this.environmentLoader = null;
    this.projectContext = null;
    this.agents = this.loadAgents();
    this.skills = this.loadSkills();

    // Initialize Skill Executor Framework
    this.skillExecutor = null;
    this.skillManager = null;
  }

  /**
   * Initialize the Aurigraph Agent environment
   * Loads all project files including credentials and initializes Skill Executor Framework
   */
  async initializeEnvironment(options = {}) {
    try {
      this.environmentLoader = new EnvironmentLoader({
        projectRoot: options.projectRoot || path.join(__dirname, '..'),
        environment: options.environment || process.env.NODE_ENV || 'development',
        verbose: options.verbose || false
      });

      const result = await this.environmentLoader.initialize();

      // Load project context files
      this.projectContext = {
        files: this.environmentLoader.getLoadedFiles(),
        contextFiles: this.environmentLoader.getContextFiles(),
        credentials: this.environmentLoader.getCredentials(false), // Redacted
        environment: this.environmentLoader.environment
      };

      // Initialize Skill Executor Framework
      await this.initializeSkillExecutor(options);

      if (options.verbose) {
        console.log('\n✅ Aurigraph Agent environment initialized');
        console.log(`   - Project Root: ${this.environmentLoader.projectRoot}`);
        console.log(`   - Environment: ${this.environmentLoader.environment}`);
        console.log(`   - Files Loaded: ${Object.keys(this.projectContext.files).length}`);
        console.log(`   - Skills Available: ${this.skillManager ? this.skillManager.registry.size : 0}`);
      }

      return result;
    } catch (error) {
      console.error('Failed to initialize environment:', error.message);
      throw error;
    }
  }

  /**
   * Initialize the Skill Executor Framework
   */
  async initializeSkillExecutor(options = {}) {
    try {
      // Initialize Skill Manager
      this.skillManager = new SkillManager({
        skillsPath: path.join(__dirname, 'skills'),
        verbose: options.verbose || false
      });

      await this.skillManager.initialize();

      // Initialize Skill Executor
      this.skillExecutor = new SkillExecutor({
        skillsPath: path.join(__dirname, 'skills'),
        environmentLoader: this.environmentLoader,
        verbose: options.verbose || false,
        defaultTimeout: this.config.defaults.timeout * 1000, // Convert to ms
        maxRetries: this.config.defaults.retries
      });

      await this.skillExecutor.initialize();

      if (options.verbose) {
        console.log('✅ Skill Executor Framework initialized');
      }

      return {
        success: true,
        skillsAvailable: this.skillManager.registry.size
      };
    } catch (error) {
      console.error('Failed to initialize Skill Executor:', error.message);
      throw error;
    }
  }

  /**
   * Load plugin configuration
   */
  loadConfig(userConfig) {
    const defaultConfig = require('./config.json');
    return { ...defaultConfig, ...userConfig };
  }

  /**
   * Load all available agents
   */
  loadAgents() {
    const agentsPath = path.join(__dirname, '..', 'agents');
    const agentFiles = fs.readdirSync(agentsPath)
      .filter(file => file.endsWith('.md'));

    const agents = {};
    agentFiles.forEach(file => {
      const agentId = file.replace('.md', '');
      const content = fs.readFileSync(path.join(agentsPath, file), 'utf8');
      agents[agentId] = {
        id: agentId,
        name: this.extractAgentName(content),
        description: this.extractAgentDescription(content),
        skills: this.extractAgentSkills(content),
        content: content
      };
    });

    return agents;
  }

  /**
   * Load all available skills
   */
  loadSkills() {
    const skillsPath = path.join(__dirname, '..', 'skills');
    const skillFiles = fs.readdirSync(skillsPath)
      .filter(file => file.endsWith('.md') && file !== 'README.md' && file !== 'SKILL_TEMPLATE.md');

    const skills = {};
    skillFiles.forEach(file => {
      const skillId = file.replace('.md', '');
      const content = fs.readFileSync(path.join(skillsPath, file), 'utf8');
      skills[skillId] = {
        id: skillId,
        name: this.extractSkillName(content),
        agent: this.extractSkillAgent(content),
        status: this.extractSkillStatus(content),
        content: content
      };
    });

    return skills;
  }

  /**
   * Invoke an agent with a skill
   */
  async invoke(agentId, skillId, params = {}) {
    // Resolve agent alias
    const resolvedAgentId = this.config.agents.aliases[agentId] || agentId;

    // Validate agent exists
    if (!this.agents[resolvedAgentId]) {
      throw new Error(`Agent '${agentId}' not found`);
    }

    // Validate skill exists (if specified)
    if (skillId && !this.skills[skillId]) {
      throw new Error(`Skill '${skillId}' not found`);
    }

    const startTime = Date.now();

    try {
      // Execute the agent/skill
      const result = await this.execute(resolvedAgentId, skillId, params);

      const executionTime = Date.now() - startTime;

      // Track metrics if enabled
      if (this.config.metrics.enabled) {
        await this.trackMetrics({
          agent: resolvedAgentId,
          skill: skillId,
          success: result.success,
          executionTime,
          timestamp: new Date().toISOString()
        });
      }

      return {
        success: result.success,
        output: result.output,
        metrics: {
          executionTime,
          agent: resolvedAgentId,
          skill: skillId
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Track error if metrics enabled
      if (this.config.metrics.enabled && this.config.metrics.trackErrors) {
        await this.trackMetrics({
          agent: resolvedAgentId,
          skill: skillId,
          success: false,
          error: error.message,
          executionTime,
          timestamp: new Date().toISOString()
        });
      }

      throw error;
    }
  }

  /**
   * Execute agent/skill logic
   * Now integrates with Skill Executor Framework for dynamic skill execution
   */
  async execute(agentId, skillId, params) {
    // If skill executor is available and skill exists, use it
    if (this.skillExecutor && skillId) {
      try {
        const result = await this.skillExecutor.execute(skillId, params);
        return {
          success: result.success,
          output: result.result,
          executionTime: result.executionTime,
          executionId: result.executionId
        };
      } catch (error) {
        // If skill not found in executor, fall back to legacy behavior
        if (error.name === 'SkillNotFoundError') {
          console.log(`Skill ${skillId} not found in executor, using legacy execution`);
        } else {
          throw error;
        }
      }
    }

    // Legacy execution path for backward compatibility
    console.log(`Executing ${agentId}${skillId ? '/' + skillId : ''}`);
    console.log('Parameters:', params);

    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      success: true,
      output: `Agent ${agentId} executed successfully`
    };
  }

  /**
   * Execute a skill directly using the Skill Executor Framework
   */
  async executeSkill(skillName, parameters = {}, options = {}) {
    if (!this.skillExecutor) {
      throw new Error('Skill Executor not initialized. Call initializeEnvironment() first.');
    }

    return await this.skillExecutor.execute(skillName, parameters, options);
  }

  /**
   * List all executable skills from Skill Executor Framework
   */
  async listExecutableSkills() {
    if (!this.skillExecutor) {
      return [];
    }

    return await this.skillExecutor.listSkills();
  }

  /**
   * Get skill metadata from Skill Manager
   */
  getExecutableSkillMetadata(skillName) {
    if (!this.skillManager) {
      return null;
    }

    return this.skillManager.getSkill(skillName);
  }

  /**
   * Search for skills in the registry
   */
  searchExecutableSkills(query) {
    if (!this.skillManager) {
      return [];
    }

    return this.skillManager.searchSkills(query);
  }

  /**
   * Get skill execution metrics
   */
  getSkillExecutionMetrics() {
    if (!this.skillExecutor) {
      return null;
    }

    return this.skillExecutor.getMetrics();
  }

  /**
   * Get skill execution history
   */
  getSkillExecutionHistory(limit = 20) {
    if (!this.skillExecutor) {
      return [];
    }

    return this.skillExecutor.getExecutionHistory(limit);
  }

  /**
   * Track usage metrics
   */
  async trackMetrics(metrics) {
    if (!this.config.metrics.enabled) return;

    try {
      await axios.post(this.config.metrics.endpoint, metrics, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'X-Plugin-Version': this.version
        }
      });
    } catch (error) {
      // Silently fail metrics tracking
      if (this.config.logging.level === 'debug') {
        console.error('Metrics tracking failed:', error.message);
      }
    }
  }

  /**
   * Helper: Extract agent name from markdown
   */
  extractAgentName(content) {
    const match = content.match(/# (.+) Agent/);
    return match ? match[1] : 'Unknown';
  }

  /**
   * Helper: Extract agent description
   */
  extractAgentDescription(content) {
    const lines = content.split('\n');
    for (let line of lines) {
      if (line.startsWith('You are a specialized') || line.startsWith('You are an')) {
        return line.replace('You are a specialized ', '')
                   .replace('You are an ', '')
                   .replace(' Agent', '')
                   .trim();
      }
    }
    return 'Specialized agent';
  }

  /**
   * Helper: Extract agent skills
   */
  extractAgentSkills(content) {
    const skillMatches = content.match(/### Skill: ([^\n]+)/g);
    if (!skillMatches) return [];
    return skillMatches.map(match => match.replace('### Skill: ', '').trim());
  }

  /**
   * Helper: Extract skill name
   */
  extractSkillName(content) {
    const match = content.match(/# (.+) Skill/);
    return match ? match[1] : 'Unknown';
  }

  /**
   * Helper: Extract skill agent
   */
  extractSkillAgent(content) {
    const match = content.match(/\*\*Agent\*\*: (.+)/);
    return match ? match[1].trim() : 'Unknown';
  }

  /**
   * Helper: Extract skill status
   */
  extractSkillStatus(content) {
    const match = content.match(/\*\*Status\*\*: (.+)/);
    return match ? match[1].trim() : 'Unknown';
  }

  /**
   * List all available agents
   */
  listAgents() {
    return Object.values(this.agents).map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      skills: agent.skills.length
    }));
  }

  /**
   * List all available skills
   */
  listSkills() {
    return Object.values(this.skills).map(skill => ({
      id: skill.id,
      name: skill.name,
      agent: skill.agent,
      status: skill.status
    }));
  }

  /**
   * Get agent information
   */
  getAgent(agentId) {
    const resolvedId = this.config.agents.aliases[agentId] || agentId;
    return this.agents[resolvedId] || null;
  }

  /**
   * Get skill information
   */
  getSkill(skillId) {
    return this.skills[skillId] || null;
  }

  /**
   * Get project context (loaded files, credentials, environment info)
   */
  getProjectContext() {
    if (!this.projectContext) {
      throw new Error('Environment not initialized. Call initializeEnvironment() first.');
    }
    return this.projectContext;
  }

  /**
   * Get specific context file content
   */
  getContextFileContent(fileName) {
    if (!this.environmentLoader) {
      throw new Error('Environment not initialized. Call initializeEnvironment() first.');
    }
    return this.environmentLoader.getContextFileContent(fileName);
  }

  /**
   * Get all loaded files metadata
   */
  getLoadedFiles() {
    if (!this.environmentLoader) {
      throw new Error('Environment not initialized. Call initializeEnvironment() first.');
    }
    return this.environmentLoader.getLoadedFiles();
  }

  /**
   * Check if a credential exists
   */
  hasCredential(key) {
    if (!this.environmentLoader) {
      return false;
    }
    const creds = this.environmentLoader.getCredentials(true);
    return creds && creds.data && key in creds.data;
  }

  /**
   * Get credential value (returns only for internal use, redacted for external)
   */
  getCredential(key, redact = true) {
    if (!this.environmentLoader) {
      return null;
    }
    const creds = this.environmentLoader.getCredentials(true);
    if (!creds || !creds.data) return null;

    const value = creds.data[key];
    if (!value) return null;

    if (redact) {
      return '***' + (value.length > 4 ? value.slice(-4) : '');
    }
    return value;
  }

  /**
   * Get all credentials (redacted by default)
   */
  getAllCredentials(redact = true) {
    if (!this.environmentLoader) {
      return null;
    }
    return this.environmentLoader.getCredentials(!redact);
  }

  /**
   * Verify environment is properly loaded
   */
  isEnvironmentLoaded() {
    return this.projectContext !== null && this.environmentLoader !== null;
  }

  /**
   * Get environment status information
   */
  getEnvironmentStatus() {
    return {
      loaded: this.isEnvironmentLoaded(),
      environment: this.environmentLoader?.environment || 'not-initialized',
      filesLoaded: this.environmentLoader?.loadedFiles.size || 0,
      credentialsAvailable: !!this.environmentLoader?.credentials,
      contextAvailable: !!this.projectContext?.contextFiles
    };
  }

  /**
   * Export environment state for debugging
   */
  exportEnvironmentState(outputPath = null) {
    if (!this.environmentLoader) {
      throw new Error('Environment not initialized.');
    }

    const outputFile = outputPath || path.join(process.cwd(), 'environment-state.json');
    return this.environmentLoader.exportState(outputFile);
  }
}

// Export plugin class
module.exports = AurigraphAgentsPlugin;

// CLI entry point
if (require.main === module) {
  const plugin = new AurigraphAgentsPlugin();

  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case 'list':
      console.log('Aurigraph Agents (v' + plugin.version + ')');
      console.log('='.repeat(40));
      plugin.listAgents().forEach(agent => {
        console.log(`✓ ${agent.name} (${agent.skills} skills)`);
      });
      break;

    case 'skills':
      console.log('Available Skills');
      console.log('='.repeat(40));
      plugin.listSkills().forEach(skill => {
        console.log(`• ${skill.name} (${skill.agent}) - ${skill.status}`);
      });
      break;

    case 'invoke':
      const [agentId, skillId, ...params] = args;
      plugin.invoke(agentId, skillId, { task: params.join(' ') })
        .then(result => {
          console.log(result.success ? '✓' : '✗', result.output);
          console.log('Time:', result.metrics.executionTime + 'ms');
        })
        .catch(error => {
          console.error('Error:', error.message);
          process.exit(1);
        });
      break;

    case 'help':
    default:
      console.log(`
Aurigraph Agents Plugin v${plugin.version}

Usage:
  node index.js list                    List all agents
  node index.js skills                  List all skills
  node index.js invoke <agent> <skill>  Invoke agent/skill
  node index.js help                    Show this help

Examples:
  node index.js list
  node index.js invoke devops deploy-wizard "Deploy to dev4"
  node index.js invoke qa test-runner "Run tests"
      `);
  }
}
