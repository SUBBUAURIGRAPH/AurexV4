#!/usr/bin/env node

/**
 * Validation script for Aurigraph Agents Plugin
 * Validates plugin structure and configuration
 */

const fs = require('fs');
const path = require('path');

console.log('');
console.log('='.repeat(60));
console.log('  Aurigraph Agents Plugin - Validation');
console.log('='.repeat(60));
console.log('');

let errors = 0;
let warnings = 0;

// Helper functions
const error = (msg) => {
  console.log('❌ ERROR:', msg);
  errors++;
};

const warn = (msg) => {
  console.log('⚠️  WARNING:', msg);
  warnings++;
};

const success = (msg) => {
  console.log('✓', msg);
};

// Check core files
console.log('Checking core files...');
const coreFiles = [
  'plugin/index.js',
  'plugin/config.json',
  'plugin/package.json',
  'plugin/README.md'
];

coreFiles.forEach(file => {
  if (fs.existsSync(file)) {
    success(`${file} exists`);
  } else {
    error(`${file} not found`);
  }
});

console.log('');

// Check directories
console.log('Checking directories...');
const dirs = ['agents', 'skills', 'sparc-templates', 'sparc-examples'];

dirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    success(`${dir}/ exists (${files.length} files)`);
  } else {
    error(`${dir}/ not found`);
  }
});

console.log('');

// Validate package.json
console.log('Validating package.json...');
try {
  const pkg = JSON.parse(fs.readFileSync('plugin/package.json', 'utf8'));

  if (pkg.name) success(`Package name: ${pkg.name}`);
  else error('Package name missing');

  if (pkg.version) success(`Version: ${pkg.version}`);
  else error('Version missing');

  if (pkg.main) success(`Main entry: ${pkg.main}`);
  else error('Main entry missing');

} catch (e) {
  error(`Failed to parse package.json: ${e.message}`);
}

console.log('');

// Validate config.json
console.log('Validating config.json...');
try {
  const config = JSON.parse(fs.readFileSync('plugin/config.json', 'utf8'));

  if (config.pluginName) success(`Plugin name: ${config.pluginName}`);
  else error('Plugin name missing');

  if (config.agents) success('Agents configuration found');
  else error('Agents configuration missing');

  if (config.integrations) success('Integrations configuration found');
  else warn('Integrations configuration missing');

} catch (e) {
  error(`Failed to parse config.json: ${e.message}`);
}

console.log('');

// Load and test plugin
console.log('Loading plugin...');
try {
  const AurigraphAgentsPlugin = require('../index.js');
  const plugin = new AurigraphAgentsPlugin();

  success('Plugin loaded successfully');
  success(`Found ${plugin.listAgents().length} agents`);
  success(`Found ${plugin.listSkills().length} skills`);

} catch (e) {
  error(`Failed to load plugin: ${e.message}`);
}

console.log('');
console.log('='.repeat(60));
console.log('  Validation Results');
console.log('='.repeat(60));
console.log('');

if (errors === 0 && warnings === 0) {
  console.log('✅ All checks passed!');
  console.log('');
  console.log('Plugin is ready for deployment.');
  process.exit(0);
} else {
  console.log(`Errors: ${errors}`);
  console.log(`Warnings: ${warnings}`);
  console.log('');

  if (errors > 0) {
    console.log('❌ Validation failed. Please fix the errors above.');
    process.exit(1);
  } else {
    console.log('⚠️  Validation passed with warnings.');
    process.exit(0);
  }
}
