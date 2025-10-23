#!/usr/bin/env node

/**
 * Context Manager for Jeeves4Coder Plugin
 * Manages context.md files across target projects
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 * @description Handles context.md initialization, detection, merge, and sync
 *
 * Features:
 * - Auto-detect existing context.md files
 * - Initialize context.md for new projects
 * - Merge plugin context with project context
 * - Sync context updates across projects
 * - Preserve project-specific information
 * - Track plugin version and configuration
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * ContextManager Class
 * Manages context.md files for Jeeves4Coder plugin deployment
 */
class ContextManager {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.pluginPath = options.pluginPath || path.join(this.projectRoot, '.claude');
    this.contextPath = path.join(this.projectRoot, 'context.md');
    this.backupPath = path.join(this.projectRoot, 'context.md.backup');
    this.configPath = path.join(this.pluginPath, 'context-config.json');

    this.version = '1.0.0';
    this.autoBackup = options.autoBackup !== false;
    this.preserveExisting = options.preserveExisting !== false;
    this.verbose = options.verbose || false;
    this.dry = options.dry || false;

    this.metadata = {
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      pluginVersion: '1.1.0',
      contextManagerVersion: this.version,
      projectPath: this.projectRoot,
      contextPath: this.contextPath
    };
  }

  /**
   * Log message based on verbose level
   */
  log(message, level = 'info') {
    if (!this.verbose && level === 'debug') return;

    const prefix = {
      'info': chalk.blue('ℹ'),
      'success': chalk.green('✓'),
      'warning': chalk.yellow('⚠'),
      'error': chalk.red('✗'),
      'debug': chalk.gray('▸')
    };

    console.log(`${prefix[level] || prefix.info} ${message}`);
  }

  /**
   * Check if context.md exists in project
   */
  contextExists() {
    return fs.existsSync(this.contextPath);
  }

  /**
   * Check if project has existing context
   */
  projectHasContext() {
    return this.contextExists();
  }

  /**
   * Read existing context.md
   */
  readContext() {
    if (!this.contextExists()) {
      return null;
    }

    try {
      return fs.readFileSync(this.contextPath, 'utf-8');
    } catch (error) {
      this.log(`Failed to read context.md: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Write context.md
   */
  writeContext(content) {
    try {
      if (this.dry) {
        this.log('DRY RUN: Would write context.md', 'debug');
        return { success: true, dry: true };
      }

      fs.writeFileSync(this.contextPath, content, 'utf-8');
      this.metadata.lastUpdated = new Date().toISOString();
      this.log(`Context.md written to ${this.contextPath}`, 'success');
      return { success: true, path: this.contextPath };
    } catch (error) {
      this.log(`Failed to write context.md: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * Backup existing context.md
   */
  backupContext() {
    if (!this.contextExists()) {
      return { success: true, message: 'No context.md to backup' };
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${this.contextPath}.${timestamp}.backup`;

      if (this.dry) {
        this.log(`DRY RUN: Would backup to ${backupPath}`, 'debug');
        return { success: true, dry: true, backupPath };
      }

      const content = fs.readFileSync(this.contextPath, 'utf-8');
      fs.writeFileSync(backupPath, content, 'utf-8');
      this.log(`Context.md backed up to ${backupPath}`, 'success');
      return { success: true, backupPath };
    } catch (error) {
      this.log(`Backup failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract metadata from context.md
   */
  extractMetadata(context) {
    const metadata = {
      projectName: null,
      version: null,
      lastUpdated: null,
      hasJeeves4Coder: false,
      hasMemoryManagement: false,
      plugins: [],
      agents: []
    };

    if (!context) return metadata;

    // Extract project name
    const nameMatch = context.match(/^#\s+(.+?)$/m);
    if (nameMatch) metadata.projectName = nameMatch[1];

    // Extract version
    const versionMatch = context.match(/\*\*Version\*\*:\s+(.+?)$/m);
    if (versionMatch) metadata.version = versionMatch[1];

    // Check for Jeeves4Coder
    metadata.hasJeeves4Coder = context.includes('Jeeves4Coder');
    metadata.hasMemoryManagement = context.includes('Memory Management');

    // Extract last updated
    const updateMatch = context.match(/\*\*Last Updated\*\*:\s+(.+?)$/m);
    if (updateMatch) metadata.lastUpdated = updateMatch[1];

    return metadata;
  }

  /**
   * Initialize context.md for new project
   */
  initializeContext(projectInfo = {}) {
    const {
      projectName = 'New Project',
      projectVersion = '1.0.0',
      description = 'Project context and information',
      withJeeves4Coder = true
    } = projectInfo;

    const timestamp = new Date().toISOString().split('T')[0];

    let context = `# ${projectName}

**Repository**: ${this.projectRoot}
**Version**: ${projectVersion}
**Status**: ✅ In Progress
**Last Updated**: ${timestamp}
**Purpose**: ${description}

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Current Status](#current-status)
3. [Architecture](#architecture)
4. [Team](#team)
5. [Tools & Plugins](#tools--plugins)
6. [Implementation Notes](#implementation-notes)
7. [Maintenance](#maintenance)

---

## Project Overview

### Description
${description}

### Key Characteristics
- Project-specific implementation
- Integrated with Aurigraph agents ecosystem
- Using Jeeves4Coder for code assistance

---

## Current Status

**Status**: ✅ In Progress

### Components
- ✅ Project initialized
- ⏳ Features in development
- ⏳ Documentation in progress

### Metrics
- Version: ${projectVersion}
- Last Updated: ${timestamp}

---

## Architecture

### Directory Structure
\`\`\`
${path.basename(this.projectRoot)}/
├── .claude/                    # Claude Code plugins
│   ├── agents/                # Aurigraph agents
│   ├── skills/                # Skills implementations
│   └── context-manager.js     # Context management
├── src/                        # Source code
├── docs/                       # Documentation
├── context.md                 # This file
├── README.md                  # Project README
└── package.json               # Project configuration
\`\`\`

---

## Team

### Roles
- **Project Owner**: TBD
- **Lead Developer**: TBD
- **DevOps**: TBD

### Contact
- Email: team@aurigraph.io
- Slack: #project-channel

---

## Tools & Plugins

### Installed Plugins
- ✅ **Jeeves4Coder** v1.1.0
  - Memory Management & Runaway Prevention
  - Code Review & Analysis
  - Architecture Review
  - Performance Optimization
  - Security Audit

### Integration Points
- Code review analysis
- Deployment automation
- Testing & QA
- Documentation generation

---

## Implementation Notes

### Key Decisions
1. Using Jeeves4Coder for code quality
2. Memory management enabled by default
3. Runaway detection enabled by default

### Configuration
\`\`\`javascript
{
  memoryManagementEnabled: true,
  runawayDetectionEnabled: true,
  maxMemoryMB: 512,
  executionTimeoutMs: 30000
}
\`\`\`

### Development Workflow
1. Write code
2. Use Jeeves4Coder for review
3. Run tests
4. Deploy

---

## Maintenance

### Regular Tasks
- Weekly: Update context.md with progress
- Monthly: Review and update documentation
- Quarterly: Major version planning

### Backup & Recovery
- Context.md backed up automatically
- Backups stored with timestamp
- Previous versions available

---

## Plugin Information

### Jeeves4Coder Integration
**Version**: 1.1.0
**Features**:
- Memory Management: ✅ Enabled
- Runaway Detection: ✅ Enabled
- Code Review: ✅ Available
- Architecture Review: ✅ Available
- Performance Optimization: ✅ Available

### Usage
\`\`\`bash
# In Claude Code IDE:
@jeeves4coder "Review this code"
@jeeves4coder "Optimize performance"
@jeeves4coder "Check security"
\`\`\`

---

## Resources

### Documentation
- Main: [Jeeves4Coder Plugin](./plugin/README.md)
- Memory Management: [Memory Management Guide](./JEEVES4CODER_MEMORY_MANAGEMENT.md)
- Quick Start: [Quick Reference](./MEMORY_MANAGEMENT_README.md)

### Support
- Email: agents@aurigraph.io
- Slack: #claude-agents
- GitHub: Issue tracker

---

**Context Manager**: Automatically updated
**Last Sync**: ${timestamp}
**Auto-Backup**: Enabled
**#memorize**: Full context preserved for continuation sessions
`;

    if (withJeeves4Coder) {
      context += `

---

## Jeeves4Coder v1.1.0 Features

### Memory Management
- Real-time memory monitoring
- Health status checks
- Garbage collection support
- Memory trend analysis

### Runaway Prevention
- Infinite loop detection
- Deep recursion detection
- Memory leak detection
- Execution timeout enforcement

### Code Quality
- Comprehensive code review
- Architecture assessment
- Performance optimization
- Security vulnerability audit

### Statistics & Metrics
- Execution time tracking
- Memory usage tracking
- Performance trend analysis
- Detailed reporting

---

**#memorize**: Context updated for Jeeves4Coder v1.1.0 integration
`;
    }

    return context;
  }

  /**
   * Merge plugin context with existing project context
   */
  mergeContexts(existingContext, pluginContext) {
    if (!existingContext) {
      return pluginContext;
    }

    // Extract sections from both contexts
    const existingMetadata = this.extractMetadata(existingContext);

    // Find insertion point for plugin information
    const lines = existingContext.split('\n');
    let insertIndex = lines.length;

    // Find appropriate section to add/update
    const toolsIndex = lines.findIndex(line => line.includes('## Tools & Plugins'));
    if (toolsIndex !== -1) {
      insertIndex = toolsIndex;
    }

    // Add plugin section if not exists
    if (!existingContext.includes('Jeeves4Coder')) {
      const pluginSection = `

---

## Jeeves4Coder Integration

### Version
1.1.0

### Features Enabled
- ✅ Memory Management (real-time monitoring)
- ✅ Runaway Prevention (pattern detection)
- ✅ Code Review & Analysis
- ✅ Architecture Review
- ✅ Performance Optimization
- ✅ Security Audit

### Configuration
\`\`\`javascript
{
  memoryManagementEnabled: true,
  runawayDetectionEnabled: true,
  maxMemoryMB: 512,
  executionTimeoutMs: 30000
}
\`\`\`

### Usage
Use \`@jeeves4coder\` in Claude Code IDE for:
- Code review and analysis
- Refactoring suggestions
- Architecture validation
- Performance optimization
- Security vulnerability detection

---

**Integrated**: ${new Date().toISOString().split('T')[0]}
**#memorize**: Jeeves4Coder v1.1.0 with memory management enabled
`;

      return existingContext + pluginSection;
    }

    return existingContext;
  }

  /**
   * Auto-detect and initialize context for project
   */
  autoDetectAndInit(options = {}) {
    const {
      forceReinit = false,
      backupExisting = true
    } = options;

    this.log('Starting auto-detection and initialization...', 'info');

    // Check existing context
    if (this.contextExists() && !forceReinit) {
      this.log('Context.md already exists', 'info');

      if (backupExisting) {
        this.backupContext();
      }

      // Read existing context
      const existing = this.readContext();
      const metadata = this.extractMetadata(existing);

      this.log(`Existing project: ${metadata.projectName}`, 'success');
      this.log(`Jeeves4Coder integrated: ${metadata.hasJeeves4Coder ? '✓' : '✗'}`, 'info');

      // Merge if needed
      if (!metadata.hasJeeves4Coder) {
        this.log('Merging plugin context with existing context...', 'info');
        const merged = this.mergeContexts(existing, null);
        return this.writeContext(merged);
      }

      return { success: true, existing: true, metadata };
    }

    // Initialize new context
    this.log('Initializing new context.md...', 'info');

    const projectName = path.basename(this.projectRoot);
    const newContext = this.initializeContext({
      projectName,
      projectVersion: '1.0.0',
      description: `Project: ${projectName}`,
      withJeeves4Coder: true
    });

    return this.writeContext(newContext);
  }

  /**
   * Update context with new information
   */
  updateContext(updates = {}) {
    const existing = this.readContext();
    if (!existing) {
      this.log('No existing context.md found', 'error');
      return { success: false, error: 'Context not found' };
    }

    let updated = existing;

    // Update version if provided
    if (updates.version) {
      updated = updated.replace(
        /\*\*Version\*\*:\s+.+?$/m,
        `**Version**: ${updates.version}`
      );
    }

    // Update status if provided
    if (updates.status) {
      updated = updated.replace(
        /\*\*Status\*\*:\s+.+?$/m,
        `**Status**: ${updates.status}`
      );
    }

    // Update last updated timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    updated = updated.replace(
      /\*\*Last Updated\*\*:\s+.+?$/m,
      `**Last Updated**: ${timestamp}`
    );

    // Add custom notes if provided
    if (updates.notes) {
      const noteSection = `

---

## Latest Updates

${updates.notes}

**Updated**: ${timestamp}
**#memorize**: Context updated with latest information
`;
      updated += noteSection;
    }

    return this.writeContext(updated);
  }

  /**
   * Sync context across multiple projects
   */
  syncContexts(projectPaths = [], options = {}) {
    const results = {};

    this.log(`Syncing context across ${projectPaths.length} projects...`, 'info');

    for (const projectPath of projectPaths) {
      try {
        const manager = new ContextManager({
          projectRoot: projectPath,
          autoBackup: options.autoBackup !== false,
          verbose: this.verbose,
          dry: this.dry
        });

        const result = manager.autoDetectAndInit(options);
        results[projectPath] = result;

        if (result.success) {
          this.log(`✓ ${path.basename(projectPath)}`, 'success');
        } else {
          this.log(`✗ ${path.basename(projectPath)}: ${result.error}`, 'error');
        }
      } catch (error) {
        results[projectPath] = { success: false, error: error.message };
        this.log(`✗ ${path.basename(projectPath)}: ${error.message}`, 'error');
      }
    }

    return {
      success: Object.values(results).every(r => r.success),
      results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate context.md structure
   */
  validateContext() {
    const context = this.readContext();
    if (!context) {
      return { valid: false, errors: ['Context.md not found'] };
    }

    const errors = [];
    const warnings = [];

    // Check for required sections
    const requiredSections = [
      'Project Overview',
      'Current Status',
      'Architecture'
    ];

    for (const section of requiredSections) {
      if (!context.includes(`## ${section}`)) {
        errors.push(`Missing section: ${section}`);
      }
    }

    // Check for metadata
    if (!context.includes('**Version**:')) {
      warnings.push('Missing version metadata');
    }

    if (!context.includes('**Last Updated**:')) {
      warnings.push('Missing last updated timestamp');
    }

    // Check for plugin info
    if (!context.includes('Jeeves4Coder')) {
      warnings.push('Jeeves4Coder not documented');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      contextSize: context.length,
      lineCount: context.split('\n').length
    };
  }

  /**
   * Get context summary
   */
  getSummary() {
    const exists = this.contextExists();
    const context = this.readContext();
    const validation = exists ? this.validateContext() : null;
    const metadata = context ? this.extractMetadata(context) : null;

    return {
      contextExists: exists,
      path: this.contextPath,
      backupPath: this.backupPath,
      metadata,
      validation,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate context report
   */
  generateReport() {
    const summary = this.getSummary();

    let report = `
╔════════════════════════════════════════════════════════════╗
║          Context.md Management Report                      ║
╚════════════════════════════════════════════════════════════╝

Project: ${path.basename(this.projectRoot)}
Path: ${this.projectRoot}

📋 Context Status
─────────────────────────────────────────────────────────────
Context Exists: ${summary.contextExists ? '✓ Yes' : '✗ No'}
${summary.contextExists ? `Location: ${summary.path}` : ''}
${summary.metadata ? `Project: ${summary.metadata.projectName || 'N/A'}` : ''}
${summary.metadata ? `Version: ${summary.metadata.version || 'N/A'}` : ''}

🔧 Integration Status
─────────────────────────────────────────────────────────────
Jeeves4Coder: ${summary.metadata?.hasJeeves4Coder ? '✓ Integrated' : '✗ Not Integrated'}
Memory Management: ${summary.metadata?.hasMemoryManagement ? '✓ Enabled' : '✗ Disabled'}

✅ Validation
─────────────────────────────────────────────────────────────
Valid: ${summary.validation?.valid ? '✓ Yes' : '✗ No'}
${summary.validation?.errors?.length > 0 ? `Errors: ${summary.validation.errors.join(', ')}` : ''}
${summary.validation?.warnings?.length > 0 ? `Warnings: ${summary.validation.warnings.join(', ')}` : ''}

📊 Statistics
─────────────────────────────────────────────────────────────
Size: ${summary.validation?.contextSize || 0} bytes
Lines: ${summary.validation?.lineCount || 0}

⏰ Timestamps
─────────────────────────────────────────────────────────────
Last Updated: ${summary.metadata?.lastUpdated || 'N/A'}
Report Generated: ${summary.timestamp}

═════════════════════════════════════════════════════════════
`;

    return report;
  }
}

/**
 * Export ContextManager
 */
module.exports = ContextManager;

/**
 * CLI Usage
 */
if (require.main === module) {
  const chalk = require('chalk');
  const command = process.argv[2] || 'status';
  const projectPath = process.argv[3] || process.cwd();

  const manager = new ContextManager({
    projectRoot: projectPath,
    verbose: true
  });

  console.log(chalk.bold.cyan('\n🔧 Context Manager for Jeeves4Coder\n'));

  switch (command) {
    case 'init':
      console.log('Initializing context.md...\n');
      manager.autoDetectAndInit({ backupExisting: true }).then(result => {
        console.log('\nResult:', JSON.stringify(result, null, 2));
      });
      break;

    case 'update':
      console.log('Updating context.md...\n');
      manager.updateContext({
        version: '1.1.0',
        status: '✅ Active',
        notes: 'Context updated with latest information'
      }).then(result => {
        console.log('\nResult:', JSON.stringify(result, null, 2));
      });
      break;

    case 'validate':
      console.log('Validating context.md...\n');
      const validation = manager.validateContext();
      console.log('Validation Result:');
      console.log(JSON.stringify(validation, null, 2));
      break;

    case 'report':
      console.log(manager.generateReport());
      break;

    case 'backup':
      console.log('Backing up context.md...\n');
      const backup = manager.backupContext();
      console.log('Backup Result:', JSON.stringify(backup, null, 2));
      break;

    case 'status':
    default:
      console.log(manager.generateReport());
      break;
  }
}
