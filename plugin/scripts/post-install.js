#!/usr/bin/env node

/**
 * Post-install script for Aurigraph Agents Plugin
 * Runs after npm install to set up the plugin
 */

const fs = require('fs');
const path = require('path');

console.log('');
console.log('='.repeat(60));
console.log('  Aurigraph Agents Plugin - Installation');
console.log('='.repeat(60));
console.log('');

// Check if running in development or production
const isDev = fs.existsSync(path.join(__dirname, '..', '..', '.git'));

if (isDev) {
  console.log('✓ Development installation detected');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Test the plugin: npm test');
  console.log('  2. Validate: npm run validate');
  console.log('  3. Install locally: npm link');
  console.log('');
} else {
  console.log('✓ Plugin installed successfully');
  console.log('');
  console.log('Get started:');
  console.log('  node plugin/index.js list');
  console.log('');
}

console.log('Documentation:');
console.log('  README: plugin/README.md');
console.log('  Agents: agents/');
console.log('  Skills: skills/');
console.log('');
console.log('Support:');
console.log('  Email: agents@aurigraph.io');
console.log('  Slack: #claude-agents');
console.log('');
console.log('='.repeat(60));
console.log('');
