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

class AurigraphAgentsPlugin {
  constructor(config = {}) {
    this.version = '1.0.0';
    this.name = 'Aurigraph Agents';
    this.config = this.loadConfig(config);
    this.agents = this.loadAgents();
    this.skills = this.loadSkills();
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
   * This is a simplified version - actual implementation would integrate with Hermes APIs
   */
  async execute(agentId, skillId, params) {
    // For now, return simulated success
    // In production, this would:
    // 1. Parse the task from params
    // 2. Call appropriate Hermes APIs or scripts
    // 3. Return actual results

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
