#!/usr/bin/env node

/**
 * Infrastructure File Manager for Jeeves4Coder Plugin
 * Manages all infrastructure files (context.md, TODO.md, PROMPTS.md, CHANGELOG.md, etc.)
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 * @description Handles initialization, update, and sync of all project infrastructure files
 *
 * Managed Files:
 * - context.md: Project context and information
 * - TODO.md: Task tracking and progress
 * - PROMPTS.md: Interaction logging and prompts
 * - CHANGELOG.md: Version history and changes
 * - README.md: Project documentation
 * - SOPS.md: Standard operating procedures
 * - SKILLS.md: Skills documentation
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * InfrastructureManager Class
 * Manages all project infrastructure files
 */
class InfrastructureManager {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.verbose = options.verbose || false;
    this.dry = options.dry || false;
    this.autoBackup = options.autoBackup !== false;

    this.managedFiles = {
      'context.md': { name: 'Project Context', required: true, priority: 1 },
      'TODO.md': { name: 'Task Tracking', required: false, priority: 2 },
      'PROMPTS.md': { name: 'Interaction Log', required: false, priority: 3 },
      'CHANGELOG.md': { name: 'Version History', required: false, priority: 4 },
      'README.md': { name: 'Project Documentation', required: false, priority: 5 },
      'SOPS.md': { name: 'Standard Operating Procedures', required: false, priority: 6 },
      'SKILLS.md': { name: 'Skills Documentation', required: false, priority: 7 }
    };

    this.fileStatus = {};
    this.backups = {};
  }

  /**
   * Log message
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
   * Check if file exists
   */
  fileExists(filename) {
    return fs.existsSync(path.join(this.projectRoot, filename));
  }

  /**
   * Read file content
   */
  readFile(filename) {
    try {
      const filePath = path.join(this.projectRoot, filename);
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      this.log(`Failed to read ${filename}: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Write file content
   */
  writeFile(filename, content) {
    try {
      if (this.dry) {
        this.log(`DRY RUN: Would write ${filename}`, 'debug');
        return { success: true, dry: true };
      }

      const filePath = path.join(this.projectRoot, filename);
      fs.writeFileSync(filePath, content, 'utf-8');
      this.log(`Wrote ${filename}`, 'success');
      return { success: true, path: filePath };
    } catch (error) {
      this.log(`Failed to write ${filename}: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * Backup file with timestamp
   */
  backupFile(filename) {
    if (!this.fileExists(filename)) {
      return { success: true, message: `${filename} does not exist, skipping backup` };
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = path.extname(filename);
      const name = path.basename(filename, ext);
      const backupPath = path.join(
        this.projectRoot,
        `${name}.${timestamp}${ext}.backup`
      );

      if (this.dry) {
        this.log(`DRY RUN: Would backup to ${backupPath}`, 'debug');
        return { success: true, dry: true, backupPath };
      }

      const content = this.readFile(filename);
      fs.writeFileSync(backupPath, content, 'utf-8');

      this.backups[filename] = backupPath;
      this.log(`Backed up ${filename}`, 'success');
      return { success: true, backupPath };
    } catch (error) {
      this.log(`Backup failed for ${filename}: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * Get file status
   */
  getFileStatus(filename) {
    const exists = this.fileExists(filename);
    const content = exists ? this.readFile(filename) : null;
    const size = content ? content.length : 0;
    const lines = content ? content.split('\n').length : 0;
    const hasJeeves4Coder = content ? content.includes('Jeeves4Coder') : false;

    return {
      filename,
      exists,
      size,
      lines,
      hasJeeves4Coder,
      lastModified: exists ?
        fs.statSync(path.join(this.projectRoot, filename)).mtime.toISOString() : null
    };
  }

  /**
   * Check all infrastructure files status
   */
  checkAllStatus() {
    const status = {};

    for (const [filename, config] of Object.entries(this.managedFiles)) {
      status[filename] = {
        ...config,
        ...this.getFileStatus(filename)
      };
    }

    return status;
  }

  /**
   * Initialize infrastructure files for project
   */
  async initializeInfrastructure(projectInfo = {}) {
    const {
      projectName = path.basename(this.projectRoot),
      projectVersion = '1.0.0',
      description = `Project: ${projectName}`,
      withJeeves4Coder = true,
      initializeAll = true
    } = projectInfo;

    this.log(`Initializing infrastructure for ${projectName}...`, 'info');

    const results = {};

    // 1. Initialize context.md
    results['context.md'] = await this.initializeContext(projectInfo);

    // 2. Initialize TODO.md (optional)
    if (initializeAll || this.fileExists('TODO.md')) {
      results['TODO.md'] = await this.initializeTodo(projectName);
    }

    // 3. Initialize PROMPTS.md (optional)
    if (initializeAll || this.fileExists('PROMPTS.md')) {
      results['PROMPTS.md'] = await this.initializePrompts(projectName);
    }

    // 4. Initialize CHANGELOG.md (optional)
    if (initializeAll || this.fileExists('CHANGELOG.md')) {
      results['CHANGELOG.md'] = await this.initializeChangelog(projectName, projectVersion);
    }

    // 5. Initialize README.md (optional)
    if (initializeAll || !this.fileExists('README.md')) {
      results['README.md'] = await this.initializeReadme(projectInfo);
    }

    return {
      success: Object.values(results).every(r => r.success !== false),
      results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Initialize context.md
   */
  async initializeContext(projectInfo = {}) {
    const { projectName = 'Project', projectVersion = '1.0.0', description = 'Project context' } = projectInfo;
    const timestamp = new Date().toISOString().split('T')[0];

    const content = `# ${projectName}

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
4. [Tools & Plugins](#tools--plugins)
5. [Infrastructure Files](#infrastructure-files)
6. [Team](#team)
7. [Maintenance](#maintenance)

---

## Project Overview

### Description
${description}

### Key Characteristics
- Aurigraph agents ecosystem integration
- Jeeves4Coder v1.1.0 with memory management
- Comprehensive infrastructure files

---

## Current Status

**Status**: ✅ In Progress

### Progress
- ✅ Project initialized
- ⏳ Features in development
- ⏳ Documentation in progress

---

## Architecture

\`\`\`
${path.basename(this.projectRoot)}/
├── .claude/                    # Claude Code plugins
│   ├── agents/                # Aurigraph agents
│   └── plugin/                # Plugin system
├── src/                        # Source code
├── docs/                       # Documentation
├── context.md                 # Project context (this file)
├── TODO.md                    # Task tracking
├── PROMPTS.md                 # Interaction log
├── CHANGELOG.md               # Version history
├── README.md                  # Project documentation
└── SOPS.md                    # Standard procedures
\`\`\`

---

## Tools & Plugins

### Installed Plugins
- ✅ **Jeeves4Coder** v1.1.0
  - Memory Management & Runaway Prevention
  - Code Review & Analysis
  - Architecture Review
  - Performance Optimization
  - Security Audit

### Infrastructure Management
- ✅ **InfrastructureManager**: Manages all infrastructure files
- ✅ **Auto-sync**: Synchronizes files across projects
- ✅ **Backup system**: Automatic timestamped backups

---

## Infrastructure Files

### Managed Files
| File | Purpose | Status | Updated |
|------|---------|--------|---------|
| context.md | Project context | ✅ Initialized | ${timestamp} |
| TODO.md | Task tracking | ⏳ TBD | - |
| PROMPTS.md | Interaction log | ⏳ TBD | - |
| CHANGELOG.md | Version history | ⏳ TBD | - |
| README.md | Documentation | ⏳ TBD | - |
| SOPS.md | Operating procedures | ⏳ TBD | - |

### File Management
- **Auto-backup**: ✅ Enabled (timestamped)
- **Sync**: ✅ Supported (multi-project)
- **Validation**: ✅ Integrated
- **#memorize**: ✅ Context preservation enabled

---

## Team

### Contacts
- Project Lead: TBD
- Tech Lead: TBD
- DevOps: TBD

---

## Maintenance

### Regular Tasks
- Weekly: Update TODO.md and context.md
- Monthly: Review and validate infrastructure
- Quarterly: Update CHANGELOG.md and roadmap

---

**Infrastructure Manager**: Automatic management enabled
**Last Sync**: ${timestamp}
**#memorize**: Full project context preserved for continuation
`;

    return this.writeFile('context.md', content);
  }

  /**
   * Initialize TODO.md
   */
  async initializeTodo(projectName = 'Project') {
    const timestamp = new Date().toISOString().split('T')[0];

    const content = `# ${projectName} - Task Tracking

**Project**: ${projectName}
**Created**: ${timestamp}
**Last Updated**: ${timestamp}

---

## Backlog

### High Priority
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Medium Priority
- [ ] Task 4
- [ ] Task 5

### Low Priority
- [ ] Task 6
- [ ] Task 7

---

## In Progress

- [ ] Current task 1
- [ ] Current task 2

---

## Completed

✅ Task completed 1
✅ Task completed 2

---

## Notes

### Important Decisions
- TBD

### Blockers
- None currently

---

**Last Updated**: ${timestamp}
**#memorize**: Task tracking preserved for continuations
`;

    return this.writeFile('TODO.md', content);
  }

  /**
   * Initialize PROMPTS.md
   */
  async initializePrompts(projectName = 'Project') {
    const timestamp = new Date().toISOString().split('T')[0];

    const content = `# ${projectName} - Interaction Log

**Project**: ${projectName}
**Created**: ${timestamp}
**Last Updated**: ${timestamp}

---

## Session Log

### Session 1 (${timestamp})

#### Objectives
- Objective 1
- Objective 2

#### Work Completed
- [ ] Item 1
- [ ] Item 2

#### Notes
- Note 1
- Note 2

#### Next Steps
- Next step 1
- Next step 2

---

## Prompts Used

### Code Review
\`\`\`
@jeeves4coder "Review this code"
\`\`\`

### Architecture Review
\`\`\`
@jeeves4coder "Review system architecture"
\`\`\`

### Performance Optimization
\`\`\`
@jeeves4coder "Optimize this function"
\`\`\`

---

## Key Interactions

### With Claude Code
- Session 1: Initial setup
- Session 2: Feature development

### With Team
- Daily standups
- Weekly reviews

---

**Last Updated**: ${timestamp}
**#memorize**: Interaction history preserved for context
`;

    return this.writeFile('PROMPTS.md', content);
  }

  /**
   * Initialize CHANGELOG.md
   */
  async initializeChangelog(projectName = 'Project', version = '1.0.0') {
    const timestamp = new Date().toISOString().split('T')[0];

    const content = `# ${projectName} - Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [${version}] - ${timestamp}

### Added
- Initial project setup
- Infrastructure files
- Jeeves4Coder v1.1.0 integration
- Memory management features
- Runaway prevention system

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

---

## Format

### For New Releases

\`\`\`
## [Version] - YYYY-MM-DD

### Added
- New feature 1
- New feature 2

### Changed
- Change 1
- Change 2

### Fixed
- Fix 1
- Fix 2

### Security
- Security update 1
\`\`\`

---

## Versioning

- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes

---

**Last Updated**: ${timestamp}
**#memorize**: Version history preserved for release tracking
`;

    return this.writeFile('CHANGELOG.md', content);
  }

  /**
   * Initialize README.md
   */
  async initializeReadme(projectInfo = {}) {
    const {
      projectName = 'Project',
      projectVersion = '1.0.0',
      description = 'Project description'
    } = projectInfo;

    const timestamp = new Date().toISOString().split('T')[0];

    const content = `# ${projectName}

${description}

**Version**: ${projectVersion}
**Status**: ✅ In Development

---

## Quick Start

### Installation
\`\`\`bash
git clone [repository-url]
cd ${projectName}
npm install
\`\`\`

### Running the Project
\`\`\`bash
npm start
\`\`\`

### Running Tests
\`\`\`bash
npm test
\`\`\`

---

## Features

### Core Features
- ✅ Jeeves4Coder integration
- ✅ Memory management
- ✅ Runaway prevention
- ✅ Infrastructure automation

### Coming Soon
- TBD

---

## Architecture

See [context.md](./context.md) for detailed architecture information.

---

## Project Structure

\`\`\`
${projectName}/
├── src/                        # Source code
├── docs/                       # Documentation
├── tests/                      # Test files
├── .claude/                    # Claude Code configuration
├── context.md                 # Project context
├── README.md                  # This file
├── package.json               # Project configuration
└── .gitignore                # Git ignore rules
\`\`\`

---

## Documentation

- [Project Context](./context.md) - Detailed project information
- [Tasks](./TODO.md) - Task tracking and progress
- [Interaction Log](./PROMPTS.md) - Session history
- [Changelog](./CHANGELOG.md) - Version history
- [SOPs](./SOPS.md) - Standard operating procedures

---

## Tools & Technologies

### Development
- **Language**: JavaScript/Node.js
- **IDE**: Claude Code with Jeeves4Coder
- **Version Control**: Git

### AI Assistance
- **Jeeves4Coder v1.1.0**
  - Memory Management & Runaway Prevention
  - Code Review & Analysis
  - Architecture Review
  - Performance Optimization
  - Security Audit

---

## Getting Help

### Documentation
See [context.md](./context.md) and other infrastructure files.

### Support
- Email: agents@aurigraph.io
- Slack: #claude-agents
- GitHub: Issue tracker

---

## Contributing

See [SOPs](./SOPS.md) for contribution guidelines.

---

## License

TBD

---

**Last Updated**: ${timestamp}
**#memorize**: Project documentation preserved for continuations
`;

    return this.writeFile('README.md', content);
  }

  /**
   * Update all infrastructure files with new information
   */
  async updateInfrastructure(updates = {}) {
    const results = {};

    // Update context.md
    if (updates.context) {
      const existing = this.readFile('context.md');
      if (existing) {
        this.backupFile('context.md');
        const updated = this.updateFileContent(existing, updates.context);
        results['context.md'] = this.writeFile('context.md', updated);
      }
    }

    // Update TODO.md
    if (updates.todo) {
      const existing = this.readFile('TODO.md');
      if (existing) {
        this.backupFile('TODO.md');
        const updated = this.updateFileContent(existing, updates.todo);
        results['TODO.md'] = this.writeFile('TODO.md', updated);
      }
    }

    // Update PROMPTS.md
    if (updates.prompts) {
      const existing = this.readFile('PROMPTS.md');
      if (existing) {
        this.backupFile('PROMPTS.md');
        const updated = this.updateFileContent(existing, updates.prompts);
        results['PROMPTS.md'] = this.writeFile('PROMPTS.md', updated);
      }
    }

    // Update CHANGELOG.md
    if (updates.changelog) {
      const existing = this.readFile('CHANGELOG.md');
      if (existing) {
        this.backupFile('CHANGELOG.md');
        const updated = this.updateFileContent(existing, updates.changelog);
        results['CHANGELOG.md'] = this.writeFile('CHANGELOG.md', updated);
      }
    }

    return {
      success: Object.values(results).every(r => r.success !== false),
      results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Update file content by appending notes
   */
  updateFileContent(existing, updates) {
    const timestamp = new Date().toISOString().split('T')[0];

    let updated = existing;

    if (updates.notes) {
      const noteSection = `

---

## Updates (${timestamp})

${updates.notes}

**Updated**: ${timestamp}
`;
      updated += noteSection;
    }

    if (updates.status) {
      updated = updated.replace(
        /\*\*Last Updated\*\*:\s+.+?$/m,
        `**Last Updated**: ${timestamp}`
      );
    }

    return updated;
  }

  /**
   * Validate all infrastructure files
   */
  validateAllFiles() {
    const validation = {
      timestamp: new Date().toISOString(),
      files: {},
      summary: {
        total: 0,
        valid: 0,
        missing: 0,
        errors: []
      }
    };

    for (const [filename, config] of Object.entries(this.managedFiles)) {
      const exists = this.fileExists(filename);
      const content = exists ? this.readFile(filename) : null;

      validation.files[filename] = {
        exists,
        required: config.required,
        size: content ? content.length : 0,
        lines: content ? content.split('\n').length : 0,
        hasJeeves4Coder: content ? content.includes('Jeeves4Coder') : false
      };

      validation.summary.total++;

      if (!exists) {
        validation.summary.missing++;
        if (config.required) {
          validation.summary.errors.push(`Missing required file: ${filename}`);
        }
      } else {
        validation.summary.valid++;
      }
    }

    return validation;
  }

  /**
   * Sync infrastructure files across multiple projects
   */
  async syncInfrastructure(projectPaths = [], options = {}) {
    const results = {};

    this.log(`Syncing infrastructure across ${projectPaths.length} projects...`, 'info');

    for (const projectPath of projectPaths) {
      try {
        const manager = new InfrastructureManager({
          projectRoot: projectPath,
          verbose: this.verbose,
          dry: this.dry
        });

        const result = await manager.initializeInfrastructure({
          projectName: path.basename(projectPath),
          projectVersion: '1.0.0',
          initializeAll: options.initializeAll !== false
        });

        results[projectPath] = result;

        if (result.success) {
          this.log(`✓ ${path.basename(projectPath)}`, 'success');
        } else {
          this.log(`✗ ${path.basename(projectPath)}`, 'error');
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
   * Generate infrastructure status report
   */
  generateReport() {
    const status = this.checkAllStatus();
    const validation = this.validateAllFiles();

    let report = `
╔════════════════════════════════════════════════════════════╗
║        Infrastructure Files Status Report                  ║
╚════════════════════════════════════════════════════════════╝

Project: ${path.basename(this.projectRoot)}
Path: ${this.projectRoot}

📊 File Status
─────────────────────────────────────────────────────────────
`;

    for (const [filename, info] of Object.entries(status)) {
      const icon = info.exists ? '✅' : '⏳';
      const required = info.required ? '(required)' : '(optional)';
      report += `${icon} ${filename} ${required}
  Lines: ${info.lines} | Size: ${info.size} bytes
  Jeeves4Coder: ${info.hasJeeves4Coder ? '✓' : '✗'}
  ${info.lastModified ? `Last Modified: ${info.lastModified}` : ''}
`;
    }

    report += `

📋 Validation Results
─────────────────────────────────────────────────────────────
Total Files: ${validation.summary.total}
Valid: ${validation.summary.valid} ✓
Missing: ${validation.summary.missing} ⏳
Errors: ${validation.summary.errors.length}
${validation.summary.errors.length > 0 ? `Issues:\n${validation.summary.errors.map(e => `  - ${e}`).join('\n')}` : ''}

═════════════════════════════════════════════════════════════
Generated: ${new Date().toISOString()}
`;

    return report;
  }
}

/**
 * Export InfrastructureManager
 */
module.exports = InfrastructureManager;

/**
 * CLI Usage
 */
if (require.main === module) {
  const command = process.argv[2] || 'status';
  const projectPath = process.argv[3] || process.cwd();

  const manager = new InfrastructureManager({
    projectRoot: projectPath,
    verbose: true
  });

  console.log(chalk.bold.cyan('\n📁 Infrastructure Manager\n'));

  switch (command) {
    case 'init':
      console.log('Initializing infrastructure files...\n');
      manager.initializeInfrastructure({
        projectName: path.basename(projectPath),
        projectVersion: '1.0.0',
        initializeAll: true
      }).then(result => {
        console.log('\nResult:', JSON.stringify(result, null, 2));
      });
      break;

    case 'validate':
      console.log('Validating infrastructure files...\n');
      const validation = manager.validateAllFiles();
      console.log('Validation Result:');
      console.log(JSON.stringify(validation, null, 2));
      break;

    case 'report':
      console.log(manager.generateReport());
      break;

    case 'status':
    default:
      console.log(manager.generateReport());
      break;
  }
}
