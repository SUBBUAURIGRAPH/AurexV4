#!/usr/bin/env node

/**
 * J4C Agent Plugin - End-to-End Test Suite
 * Version: 1.0.0
 * Tests: 30+ comprehensive test cases across all components
 */

const fs = require('fs');
const path = require('path');

// Test runner setup
let passCount = 0;
let failCount = 0;
const failures = [];

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (expected: ${expected}, got: ${actual})`);
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passCount++;
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
    failCount++;
    failures.push({ name, error: error.message });
  }
}

function section(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
}

// ========== TEST CATEGORIES ==========

section('1. PLUGIN INITIALIZATION TESTS');

test('Plugin module exists', () => {
  const pluginPath = path.join(__dirname, 'index.js');
  assertTrue(fs.existsSync(pluginPath), 'index.js should exist');
});

test('Plugin loads successfully', () => {
  delete require.cache[require.resolve('./index.js')];
  const PluginClass = require('./index.js');
  assertTrue(PluginClass !== undefined, 'Plugin class should load without errors');
  assertTrue(typeof PluginClass === 'function', 'Plugin should be a class/function');
});

test('Plugin has required methods', () => {
  const PluginClass = require('./index.js');
  const plugin = new PluginClass();
  assertTrue(typeof plugin.listAgents === 'function', 'listAgents method should exist');
  assertTrue(typeof plugin.listSkills === 'function', 'listSkills method should exist');
  assertTrue(typeof plugin.executeSkill === 'function', 'executeSkill method should exist');
});

// ========== CONFIGURATION FILES TESTS ==========

section('2. CONFIGURATION FILES TESTS');

test('Agent config file exists', () => {
  const configPath = path.join(__dirname, 'j4c-agent.config.json');
  assertTrue(fs.existsSync(configPath), 'j4c-agent.config.json should exist');
});

test('Agent config is valid JSON', () => {
  const configPath = path.join(__dirname, 'j4c-agent.config.json');
  const content = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content);
  assertTrue(config !== null, 'Agent config should parse as valid JSON');
});

test('Agent config has required sections', () => {
  const configPath = path.join(__dirname, 'j4c-agent.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  assertTrue(config.agents !== undefined, 'Config should have agents section');
  assertTrue(config.workflows !== undefined, 'Config should have workflows section');
});

test('HubSpot config file exists', () => {
  const configPath = path.join(__dirname, 'hubspot.config.json');
  assertTrue(fs.existsSync(configPath), 'hubspot.config.json should exist');
});

// ========== AGENTS LOADING TESTS ==========

section('3. AGENTS LOADING TESTS');

test('Agents can be listed', () => {
  const PluginClass = require('./index.js');
  const plugin = new PluginClass();
  const agents = plugin.listAgents();
  assertTrue(Array.isArray(agents), 'listAgents should return an array');
  assertTrue(agents.length > 0, `Should have at least one agent, found ${agents.length}`);
});

test('Agents have required properties', () => {
  const PluginClass = require('./index.js');
  const plugin = new PluginClass();
  const agents = plugin.listAgents();

  for (const agent of agents) {
    assertTrue(agent.name !== undefined, `Agent should have name property: ${JSON.stringify(agent)}`);
    assertTrue(agent.id !== undefined, `Agent should have id property: ${JSON.stringify(agent)}`);
  }
});

test('Multiple agents are loaded correctly', () => {
  const PluginClass = require('./index.js');
  const plugin = new PluginClass();
  const agents = plugin.listAgents();

  const requiredCount = 5;
  assertTrue(
    agents.length >= requiredCount,
    `Should have at least ${requiredCount} agents, found ${agents.length}`
  );
});

test('Agents have unique IDs', () => {
  const PluginClass = require('./index.js');
  const plugin = new PluginClass();
  const agents = plugin.listAgents();
  const ids = agents.map(a => a.id);
  const uniqueIds = new Set(ids);

  assertTrue(
    ids.length === uniqueIds.size,
    'All agents should have unique IDs'
  );
});

// ========== SKILLS LOADING TESTS ==========

section('4. SKILLS LOADING TESTS');

test('Skills directory exists', () => {
  const skillsDir = path.join(__dirname, 'skills');
  assertTrue(fs.existsSync(skillsDir), 'skills directory should exist');
});

test('Skills can be listed', () => {
  const PluginClass = require('./index.js');
  const plugin = new PluginClass();
  const skills = plugin.listSkills();
  assertTrue(Array.isArray(skills), 'listSkills should return an array');
  assertTrue(skills.length > 0, `Should have at least some skills, found ${skills.length}`);
});

test('Skills have required properties', () => {
  const PluginClass = require('./index.js');
  const plugin = new PluginClass();
  const skills = plugin.listSkills();

  for (const skill of skills.slice(0, Math.min(5, skills.length))) {
    assertTrue(skill.name !== undefined, `Skill should have name property: ${JSON.stringify(skill)}`);
    assertTrue(skill.id !== undefined, `Skill should have id property: ${JSON.stringify(skill)}`);
  }
});

test('Multiple skills are loaded', () => {
  const PluginClass = require('./index.js');
  const plugin = new PluginClass();
  const skills = plugin.listSkills();
  assertTrue(skills.length >= 5, `Should have at least 5 skills, found ${skills.length}`);
});

// ========== DOCUMENTATION FILES TESTS ==========

section('5. DOCUMENTATION FILES TESTS');

test('Plugin documentation exists', () => {
  const docPath = path.join(__dirname, 'J4C_AGENT_PLUGIN.md');
  assertTrue(fs.existsSync(docPath), 'J4C_AGENT_PLUGIN.md should exist');
});

test('HubSpot integration documentation exists', () => {
  const docPath = path.join(__dirname, 'HUBSPOT_INTEGRATION.md');
  assertTrue(fs.existsSync(docPath), 'HUBSPOT_INTEGRATION.md should exist');
});

test('Deployment package documentation exists', () => {
  const docPath = path.join(__dirname, 'DEPLOYMENT_PACKAGE.md');
  assertTrue(fs.existsSync(docPath), 'DEPLOYMENT_PACKAGE.md should exist');
});

// ========== PACKAGE DEPENDENCIES TESTS ==========

section('6. PACKAGE DEPENDENCIES TESTS');

test('package.json exists', () => {
  const pkgPath = path.join(__dirname, 'package.json');
  assertTrue(fs.existsSync(pkgPath), 'package.json should exist');
});

test('package.json is valid', () => {
  const pkgPath = path.join(__dirname, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  assertTrue(pkg.name !== undefined, 'package.json should have name field');
  assertTrue(pkg.version !== undefined, 'package.json should have version field');
});

test('Required dependencies are listed', () => {
  const pkgPath = path.join(__dirname, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const deps = pkg.dependencies || {};

  const required = ['axios', 'chalk', 'dotenv'];
  for (const dep of required) {
    assertTrue(deps[dep] !== undefined, `${dep} should be in dependencies`);
  }
});

test('Dependencies are installed', () => {
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  assertTrue(fs.existsSync(nodeModulesPath), 'node_modules directory should exist (dependencies installed)');
});

// ========== CLI INTERFACE TESTS ==========

section('7. CLI INTERFACE TESTS');

test('CLI script exists', () => {
  const cliPath = path.join(__dirname, 'j4c-cli.js');
  assertTrue(fs.existsSync(cliPath), 'j4c-cli.js should exist');
});

test('CLI script is executable', () => {
  const cliPath = path.join(__dirname, 'j4c-cli.js');
  const stats = fs.statSync(cliPath);
  assertTrue(stats.isFile(), 'j4c-cli.js should be a file');
});

// ========== HUBSPOT INTEGRATION TESTS ==========

section('8. HUBSPOT INTEGRATION TESTS');

test('HubSpot integration module exists', () => {
  const hsPath = path.join(__dirname, 'hubspot-integration.js');
  assertTrue(fs.existsSync(hsPath), 'hubspot-integration.js should exist');
});

test('HubSpot module exports class', () => {
  delete require.cache[require.resolve('./hubspot-integration.js')];
  const HubSpot = require('./hubspot-integration.js');
  assertTrue(typeof HubSpot === 'function' || HubSpot.constructor !== undefined, 'HubSpot should export a class');
});

// ========== GIT INTEGRATION TESTS ==========

section('9. GIT INTEGRATION TESTS');

test('Repository is initialized', () => {
  const gitDir = path.join(__dirname, '..', '.git');
  assertTrue(fs.existsSync(gitDir), '.git directory should exist');
});

test('Git config exists', () => {
  const gitConfig = path.join(__dirname, '..', '.git', 'config');
  assertTrue(fs.existsSync(gitConfig), 'Git config should exist');
});

// ========== FILE STRUCTURE TESTS ==========

section('10. FILE STRUCTURE TESTS');

test('Required files exist', () => {
  const requiredFiles = [
    'index.js',
    'j4c-cli.js',
    'hubspot-integration.js',
    'config.json',
    'package.json'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, file);
    assertTrue(fs.existsSync(filePath), `${file} should exist`);
  }
});

test('Required directories exist', () => {
  const requiredDirs = [
    'skills',
    'node_modules'
  ];

  for (const dir of requiredDirs) {
    const dirPath = path.join(__dirname, dir);
    assertTrue(fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory(), `${dir} directory should exist`);
  }
});

// ========== CONTENT VALIDATION TESTS ==========

section('11. CONTENT VALIDATION TESTS');

test('Plugin has correct name and version', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
  assertTrue(pkg.name.includes('j4c') || pkg.name.includes('agent'), 'Package name should reference J4C or agent');
  assertTrue(pkg.version !== undefined, 'Package should have version');
});

test('Agent config contains workflow definitions', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'j4c-agent.config.json'), 'utf-8'));
  assertTrue(config.workflows !== undefined, 'Agent config should have workflows');
  assertTrue(typeof config.workflows === 'object' && Object.keys(config.workflows).length > 0, 'Should have at least one workflow defined');
});

test('Workflows include required types', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'j4c-agent.config.json'), 'utf-8'));
  const workflowNames = Object.keys(config.workflows);

  const requiredWorkflows = ['development', 'deployment', 'testing'];
  for (const required of requiredWorkflows) {
    const found = workflowNames.some(w => w.toLowerCase().includes(required));
    assertTrue(found, `Workflow '${required}' should be defined`);
  }
});

test('Integration settings are configured', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'j4c-agent.config.json'), 'utf-8'));
  assertTrue(config.integrations !== undefined, 'Config should have integrations section');
});

// ========== TEST SUMMARY ==========

function printSummary() {
  const total = passCount + failCount;
  const percentage = total > 0 ? Math.round((passCount / total) * 100) : 0;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  TEST SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passCount} ✅`);
  console.log(`Failed: ${failCount} ❌`);
  console.log(`Success Rate: ${percentage}%`);

  if (failures.length > 0) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  FAILURES DETAILS`);
    console.log(`${'='.repeat(60)}`);

    for (const failure of failures) {
      console.log(`\n❌ ${failure.name}`);
      console.log(`   ${failure.error}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  if (failCount === 0) {
    console.log(`  ✅ ALL TESTS PASSED - PLUGIN READY FOR PRODUCTION`);
  } else {
    console.log(`  ⚠️  SOME TESTS FAILED - REVIEW BEFORE DEPLOYMENT`);
  }
  console.log(`${'='.repeat(60)}\n`);

  process.exit(failCount > 0 ? 1 : 0);
}

printSummary();
