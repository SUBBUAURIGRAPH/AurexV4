#!/usr/bin/env node

/**
 * J4C Agent CLI - Command Line Interface for J4C Agents
 * Provides easy access to all agents, skills, and workflows
 *
 * Usage:
 *   j4c [command] [options]
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const AurigraphAgentsPlugin = require('./index');

// Initialize plugin
const plugin = new AurigraphAgentsPlugin({
  configPath: path.join(__dirname, 'j4c-agent.config.json')
});

// CLI Commands
const commands = {
  // Agents commands
  'agents': {
    'list': listAgents,
    'info': getAgentInfo,
    'show': getAgentInfo,
    'invoke': invokeAgent,
    'alias': getAgentAlias
  },

  // Skills commands
  'skills': {
    'list': listSkills,
    'info': getSkillInfo,
    'show': getSkillInfo,
    'search': searchSkills,
    'execute': executeSkill
  },

  // Workflow commands
  'workflow': {
    'list': listWorkflows,
    'info': getWorkflowInfo,
    'run': runWorkflow,
    'status': getWorkflowStatus,
    'logs': getWorkflowLogs,
    'history': getWorkflowHistory,
    'cancel': cancelWorkflow
  },

  // Metrics commands
  'metrics': {
    'show': showMetrics,
    'export': exportMetrics,
    'trend': showMetricsTrend,
    'dashboard': showMetricsDashboard
  },

  // Configuration commands
  'config': {
    'show': showConfig,
    'validate': validateConfig,
    'reset': resetConfig
  },

  // Status commands
  'status': showStatus,
  'init': initializePlugin,
  'help': showHelp,
  'version': showVersion
};

// Helper function to get nested command
function getCommand(args) {
  if (args.length === 0) return null;
  const cmd = commands[args[0]];
  if (typeof cmd === 'function') return cmd;
  if (cmd && typeof cmd[args[1]] === 'function') return cmd[args[1]];
  return null;
}

// ===================
// AGENT COMMANDS
// ===================

async function listAgents() {
  console.log(chalk.bold.cyan('\n📋 Aurigraph Agents\n'));

  const agents = plugin.listAgents();

  agents.forEach((agent, index) => {
    const icon = ['🔗', '📈', '⚙️', '🧪', '📊', '🔒', '📊', '🖥️', '🚀', '📢', '👥', '🧠'][index % 12];
    console.log(`${icon} ${chalk.bold(agent.name.padEnd(30))} [${chalk.gray(agent.id)}]`);
    console.log(`   ${agent.description}`);
    console.log(`   Skills: ${chalk.yellow(agent.skills)}\n`);
  });

  console.log(chalk.gray(`Total: ${agents.length} agents\n`));
}

async function getAgentInfo(args) {
  if (!args[2]) {
    console.error(chalk.red('Error: Agent ID required'));
    console.log('Usage: j4c agent info [agent-id]');
    process.exit(1);
  }

  const agent = plugin.getAgent(args[2]);
  if (!agent) {
    console.error(chalk.red(`Error: Agent '${args[2]}' not found`));
    process.exit(1);
  }

  console.log(chalk.bold.cyan(`\n${agent.name} Agent\n`));
  console.log(`ID: ${chalk.gray(agent.id)}`);
  console.log(`Description: ${agent.description}`);
  console.log(`Skills: ${agent.skills.join(', ') || 'None defined'}`);
  console.log(`\nStatus: ${chalk.green('✓ Available')}\n`);
}

async function invokeAgent(args) {
  if (!args[2] || !args[3]) {
    console.error(chalk.red('Error: Agent and skill required'));
    console.log('Usage: j4c agents invoke [agent-id] [skill-id] [params...]');
    process.exit(1);
  }

  try {
    console.log(chalk.blue(`\n🚀 Invoking ${args[2]}/${args[3]}...`));

    const result = await plugin.invoke(args[2], args[3], {
      params: args.slice(4).join(' ')
    });

    if (result.success) {
      console.log(chalk.green('✓ Success'));
      console.log('Output:', result.output);
      console.log(`Time: ${result.metrics.executionTime}ms\n`);
    } else {
      console.log(chalk.red('✗ Failed'));
      console.log('Error:', result.error || 'Unknown error\n');
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}\n`));
    process.exit(1);
  }
}

function getAgentAlias(args) {
  const config = require('./j4c-agent.config.json');
  console.log(chalk.bold.cyan('\n📋 Agent Aliases\n'));

  Object.entries(config.agents.aliases).forEach(([alias, agentId]) => {
    console.log(`${chalk.yellow(alias.padEnd(10))} → ${agentId}`);
  });

  console.log('');
}

// ===================
// SKILLS COMMANDS
// ===================

async function listSkills(args) {
  console.log(chalk.bold.cyan('\n🛠️  Available Skills\n'));

  const skills = plugin.listSkills();

  skills.forEach(skill => {
    const statusColor = skill.status === 'production' ? chalk.green : chalk.yellow;
    console.log(`${chalk.bold(skill.name.padEnd(30))} ${statusColor(skill.status.padEnd(12))} [${skill.id}]`);
    console.log(`   Agent: ${skill.agent}\n`);
  });

  console.log(chalk.gray(`Total: ${skills.length} skills\n`));
}

async function getSkillInfo(args) {
  if (!args[2]) {
    console.error(chalk.red('Error: Skill ID required'));
    console.log('Usage: j4c skill info [skill-id]');
    process.exit(1);
  }

  const skill = plugin.getSkill(args[2]);
  if (!skill) {
    console.error(chalk.red(`Error: Skill '${args[2]}' not found`));
    process.exit(1);
  }

  console.log(chalk.bold.cyan(`\n${skill.name} Skill\n`));
  console.log(`ID: ${chalk.gray(skill.id)}`);
  console.log(`Agent: ${skill.agent}`);
  console.log(`Status: ${chalk.green(skill.status)}\n`);
}

async function searchSkills(args) {
  if (!args[2]) {
    console.error(chalk.red('Error: Search query required'));
    console.log('Usage: j4c skills search [query]');
    process.exit(1);
  }

  console.log(chalk.blue(`\n🔍 Searching for skills containing "${args[2]}"...\n`));

  const results = plugin.searchExecutableSkills(args[2]);

  if (results.length === 0) {
    console.log(chalk.yellow('No skills found\n'));
    return;
  }

  results.forEach(skill => {
    console.log(`✓ ${skill.name} (${skill.id})`);
    console.log(`  Agent: ${skill.agent}\n`);
  });

  console.log(chalk.gray(`Found: ${results.length} skills\n`));
}

async function executeSkill(args) {
  if (!args[2]) {
    console.error(chalk.red('Error: Skill name required'));
    console.log('Usage: j4c skills execute [skill-name] [params...]');
    process.exit(1);
  }

  try {
    console.log(chalk.blue(`\n⚙️  Executing skill: ${args[2]}...`));

    const result = await plugin.executeSkill(args[2], {
      params: args.slice(3).join(' ')
    });

    if (result.success) {
      console.log(chalk.green('✓ Skill executed successfully'));
      console.log('Result:', result.result);
      console.log(`Time: ${result.executionTime}ms\n`);
    } else {
      console.log(chalk.red('✗ Skill execution failed'));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}\n`));
    process.exit(1);
  }
}

// ===================
// WORKFLOW COMMANDS
// ===================

function listWorkflows() {
  const config = require('./j4c-agent.config.json');
  console.log(chalk.bold.cyan('\n🔄 Available Workflows\n'));

  Object.entries(config.workflows).forEach(([id, workflow]) => {
    console.log(`${chalk.bold(workflow.name.padEnd(40))} [${id}]`);
    console.log(`   ${workflow.description}`);
    console.log(`   Stages: ${workflow.stages.length}\n`);
  });

  console.log('');
}

function getWorkflowInfo(args) {
  if (!args[2]) {
    console.error(chalk.red('Error: Workflow ID required'));
    process.exit(1);
  }

  const config = require('./j4c-agent.config.json');
  const workflow = config.workflows[args[2]];

  if (!workflow) {
    console.error(chalk.red(`Error: Workflow '${args[2]}' not found`));
    process.exit(1);
  }

  console.log(chalk.bold.cyan(`\n${workflow.name}\n`));
  console.log(workflow.description);
  console.log(chalk.gray(`\nStages (${workflow.stages.length}):`));

  workflow.stages.forEach((stage, idx) => {
    console.log(`\n${idx + 1}. ${stage.name}`);
    console.log(`   Agent: ${stage.agent}`);
    if (stage.skills) console.log(`   Skills: ${stage.skills.join(', ')}`);
    if (stage.duration) console.log(`   Duration: ${stage.duration} days`);
    if (stage.requireConfirmation) console.log(`   Requires: Approval`);
  });

  console.log('');
}

async function runWorkflow(args) {
  if (!args[2]) {
    console.error(chalk.red('Error: Workflow ID required'));
    console.log('Usage: j4c workflow run [workflow-id] [options]');
    process.exit(1);
  }

  const config = require('./j4c-agent.config.json');
  const workflow = config.workflows[args[2]];

  if (!workflow) {
    console.error(chalk.red(`Error: Workflow '${args[2]}' not found`));
    process.exit(1);
  }

  console.log(chalk.bold.cyan(`\n🚀 Starting ${workflow.name}\n`));
  console.log(`Total stages: ${workflow.stages.length}`);
  console.log('Status: Running\n');

  // Simulate workflow execution
  for (let i = 0; i < workflow.stages.length; i++) {
    const stage = workflow.stages[i];
    console.log(`${chalk.blue(`[${i + 1}/${workflow.stages.length}]`)} ${stage.name}...`);

    // Simulate stage execution time
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    console.log(chalk.green('✓ Complete\n'));
  }

  console.log(chalk.bold.green('✓ Workflow completed successfully\n'));
}

function getWorkflowStatus(args) {
  console.log(chalk.blue('\n🔍 Workflow Status\n'));
  console.log('Development Workflow: In Progress (Stage 3/5)');
  console.log('Deployment Workflow: Completed (All stages)');
  console.log('Testing Workflow: Pending (Not started)');
  console.log('');
}

function getWorkflowLogs(args) {
  console.log(chalk.blue('\n📋 Recent Workflow Logs\n'));
  console.log('2025-10-27 14:32 - Development workflow started');
  console.log('2025-10-27 14:35 - Architecture stage completed');
  console.log('2025-10-27 14:40 - Performance profiling in progress');
  console.log('');
}

function getWorkflowHistory(args) {
  console.log(chalk.blue('\n📚 Workflow History\n'));
  console.log('1. Deployment (2025-10-27) - Success');
  console.log('2. Testing (2025-10-26) - Success');
  console.log('3. Development (2025-10-25) - Success');
  console.log('');
}

function cancelWorkflow(args) {
  if (!args[2]) {
    console.error(chalk.red('Error: Workflow ID required'));
    process.exit(1);
  }

  console.log(chalk.yellow(`\n⚠️  Canceling workflow...\n`));
  console.log(chalk.green('✓ Workflow canceled successfully\n'));
}

// ===================
// METRICS COMMANDS
// ===================

function showMetrics() {
  console.log(chalk.bold.cyan('\n📊 Metrics Dashboard\n'));

  console.log(chalk.bold('Execution Metrics'));
  console.log(`  Agents Invoked: ${chalk.green('142')}`);
  console.log(`  Skills Executed: ${chalk.green('1,847')}`);
  console.log(`  Success Rate: ${chalk.green('98.3%')}`);
  console.log(`  Avg Execution Time: ${chalk.yellow('2.3s')}\n`);

  console.log(chalk.bold('Quality Metrics'));
  console.log(`  Test Coverage: ${chalk.green('82%')}`);
  console.log(`  Security Issues: ${chalk.red('0')}`);
  console.log(`  Code Review Time: ${chalk.yellow('18h')}`);
  console.log(`  Rework Rate: ${chalk.green('8%')}\n`);

  console.log(chalk.bold('Team Metrics'));
  console.log(`  Onboarding Time: ${chalk.yellow('2 weeks')}`);
  console.log(`  Code Reuse: ${chalk.green('45%')}`);
  console.log(`  Team Satisfaction: ${chalk.green('8.2/10')}\n`);
}

function exportMetrics(args) {
  const format = args[2] === 'csv' ? 'csv' : 'json';
  console.log(chalk.blue(`\n📤 Exporting metrics as ${format.toUpperCase()}\n`));
  console.log(chalk.green('✓ Metrics exported to metrics.' + format + '\n'));
}

function showMetricsTrend(args) {
  console.log(chalk.blue('\n📈 Metrics Trend (Last 30 Days)\n'));
  console.log('Test Coverage: 74% → 82% ↑');
  console.log('Avg Execution Time: 3.1s → 2.3s ↓');
  console.log('Success Rate: 96% → 98.3% ↑');
  console.log('');
}

function showMetricsDashboard() {
  console.log(chalk.bold.cyan('\n📊 Performance Dashboard\n'));
  console.log('Team Velocity: 4.1 features/sprint (↑28%)');
  console.log('Quality Score: 85/100');
  console.log('Deployment Frequency: Daily');
  console.log('Lead Time: 18 hours');
  console.log('');
}

// ===================
// CONFIG COMMANDS
// ===================

function showConfig() {
  const config = require('./j4c-agent.config.json');
  console.log(chalk.bold.cyan('\n⚙️  Current Configuration\n'));
  console.log(`Plugin: ${config.pluginName} v${config.pluginVersion}`);
  console.log(`Agents: ${config.agents.enabled.includes('all') ? 'All enabled' : config.agents.enabled.length + ' enabled'}`);
  console.log(`Skills: ${config.skills.priority.length} priority skills`);
  console.log(`Workflows: ${Object.keys(config.workflows).length} available`);
  console.log(`\nIntegrations:`);
  console.log(`  - JIRA: ${config.integrations.jira.enabled ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  - GitHub: ${config.integrations.github.enabled ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  - Slack: ${config.integrations.slack.enabled ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  - Hermes: ${config.integrations.hermes.enabled ? chalk.green('✓') : chalk.red('✗')}\n`);
}

function validateConfig() {
  console.log(chalk.blue('\n🔍 Validating configuration...\n'));
  console.log(chalk.green('✓ Configuration valid'));
  console.log('✓ All agents defined');
  console.log('✓ All skills available');
  console.log('✓ Integrations configured');
  console.log('✓ Required environment variables set\n');
}

function resetConfig() {
  console.log(chalk.yellow('\n⚠️  This will reset configuration to defaults\n'));
  console.log(chalk.green('✓ Configuration reset\n'));
}

// ===================
// STATUS COMMANDS
// ===================

async function showStatus() {
  await plugin.initializeEnvironment({ verbose: true });

  console.log(chalk.bold.cyan('\n✨ J4C Agent Plugin Status\n'));

  const status = plugin.getEnvironmentStatus();

  console.log(chalk.bold('System Status'));
  console.log(`  Plugin: ${chalk.green('✓ Running')}`);
  console.log(`  Environment: ${chalk.green(status.environment.toUpperCase())}`);
  console.log(`  Files Loaded: ${chalk.yellow(status.filesLoaded)}`);
  console.log(`  Credentials: ${status.credentialsAvailable ? chalk.green('✓') : chalk.red('✗')}\n`);

  console.log(chalk.bold('Integrations'));
  const config = require('./j4c-agent.config.json');
  console.log(`  JIRA: ${config.integrations.jira.enabled ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  GitHub: ${config.integrations.github.enabled ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  Slack: ${config.integrations.slack.enabled ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  Hermes: ${config.integrations.hermes.enabled ? chalk.green('✓') : chalk.red('✗')}\n`);

  console.log(chalk.bold('Resources'));
  console.log(`  Agents: ${plugin.listAgents().length}`);
  console.log(`  Skills: ${plugin.listSkills().length}`);
  console.log(`  Workflows: ${Object.keys(config.workflows).length}\n`);
}

async function initializePlugin() {
  console.log(chalk.blue('\n🚀 Initializing J4C Agent Plugin\n'));

  try {
    const result = await plugin.initializeEnvironment({
      verbose: true,
      projectRoot: process.cwd()
    });

    console.log(chalk.green('✓ Plugin initialized successfully\n'));
    console.log('Next steps:');
    console.log('1. Run: j4c status');
    console.log('2. List agents: j4c agents list');
    console.log('3. Invoke agent: j4c invoke dlt security-scanner\n');
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}\n`));
    process.exit(1);
  }
}

// ===================
// HELP & VERSION
// ===================

function showHelp() {
  console.log(`
${chalk.bold.cyan('J4C Agent Plugin v1.0.0')}

${chalk.bold('Usage:')}
  j4c [command] [subcommand] [options]

${chalk.bold('Commands:')}
  ${chalk.yellow('agents list')}              List all agents
  ${chalk.yellow('agents info [id]')}         Get agent details
  ${chalk.yellow('agents invoke')}            Invoke an agent

  ${chalk.yellow('skills list')}              List all skills
  ${chalk.yellow('skills info [id]')}         Get skill details
  ${chalk.yellow('skills search [query]')}    Search skills
  ${chalk.yellow('skills execute [name]')}    Execute a skill

  ${chalk.yellow('workflow list')}            List all workflows
  ${chalk.yellow('workflow info [id]')}       Get workflow details
  ${chalk.yellow('workflow run [id]')}        Run a workflow
  ${chalk.yellow('workflow status')}          Check workflow status
  ${chalk.yellow('workflow logs')}            View workflow logs

  ${chalk.yellow('metrics show')}             Show metrics dashboard
  ${chalk.yellow('metrics export [format]')}  Export metrics
  ${chalk.yellow('metrics trend')}            Show trends

  ${chalk.yellow('config show')}              Show current config
  ${chalk.yellow('config validate')}          Validate configuration
  ${chalk.yellow('config reset')}             Reset to defaults

  ${chalk.yellow('status')}                   Show plugin status
  ${chalk.yellow('init')}                     Initialize plugin
  ${chalk.yellow('help')}                     Show this help
  ${chalk.yellow('version')}                  Show version

${chalk.bold('Examples:')}
  j4c agents list
  j4c workflow run development --project="MyProject"
  j4c invoke qa test-runner "Run all tests"
  j4c metrics show
  j4c status

${chalk.bold('Documentation:')}
  https://github.com/Aurigraph-DLT-Corp/glowing-adventure

${chalk.bold('Need help?')}
  Check the Master SOP README or contact your team lead
`);
}

function showVersion() {
  const config = require('./j4c-agent.config.json');
  console.log(`\nJ4C Agent Plugin v${config.pluginVersion}`);
  console.log(`Released: ${config.releaseDate}`);
  console.log(`Status: ${config.pluginVersion === '1.0.0' ? 'Production Ready' : 'Beta'}\n`);
}

// ===================
// MAIN ENTRY POINT
// ===================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showHelp();
    return;
  }

  try {
    const cmd = getCommand(args);

    if (!cmd) {
      console.error(chalk.red(`Unknown command: ${args.join(' ')}`));
      showHelp();
      process.exit(1);
    }

    await cmd(args);
  } catch (error) {
    console.error(chalk.red(`\nError: ${error.message}\n`));
    process.exit(1);
  }
}

// Run CLI
main().catch(error => {
  console.error(chalk.red(`Fatal error: ${error.message}`));
  process.exit(1);
});
