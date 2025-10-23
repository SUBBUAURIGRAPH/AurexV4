#!/usr/bin/env node

/**
 * Deployment Script with Context Management
 * Deploys Jeeves4Coder plugin and manages context.md across projects
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 * @description Handles plugin deployment with automatic context management
 *
 * Features:
 * - Deploy plugin to target projects
 * - Initialize/update context.md automatically
 * - Validate installations
 * - Generate deployment reports
 * - Backup existing contexts
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ContextManager = require('./context-manager.js');

/**
 * PluginDeployer Class
 * Manages plugin deployment with context management
 */
class PluginDeployer {
  constructor(options = {}) {
    this.sourceDir = options.sourceDir || path.join(__dirname, '..');
    this.targetProjects = options.targetProjects || [];
    this.verbose = options.verbose !== false;
    this.dry = options.dry || false;
    this.autoContext = options.autoContext !== false;
    this.backupExisting = options.backupExisting !== false;

    this.deploymentResults = {
      successful: [],
      failed: [],
      skipped: [],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log message
   */
  log(message, level = 'info') {
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
   * Get plugin files to deploy
   */
  getPluginFiles() {
    const files = [
      'jeeves4coder.js',
      'context-manager.js',
      'deploy-with-context.js',
      'jeeves4coder.test.js',
      'jeeves4coder-setup.js',
      'package.json',
      'README.md'
    ];

    return files.map(f => ({
      source: path.join(this.sourceDir, 'plugin', f),
      name: f
    })).filter(f => fs.existsSync(f.source));
  }

  /**
   * Deploy to single project
   */
  async deployToProject(projectPath) {
    const projectName = path.basename(projectPath);
    const claudeDir = path.join(projectPath, '.claude');
    const pluginDir = path.join(claudeDir, 'plugin');

    this.log(`\nDeploying to: ${projectName}`, 'info');
    this.log(`Project path: ${projectPath}`, 'debug');

    // Check project exists
    if (!fs.existsSync(projectPath)) {
      this.log(`Project not found: ${projectPath}`, 'error');
      this.deploymentResults.failed.push({
        project: projectName,
        error: 'Project directory not found',
        timestamp: new Date().toISOString()
      });
      return { success: false, error: 'Project not found' };
    }

    try {
      // Create directories
      if (!fs.existsSync(claudeDir)) {
        if (this.dry) {
          this.log(`DRY RUN: Would create ${claudeDir}`, 'debug');
        } else {
          fs.mkdirSync(claudeDir, { recursive: true });
        }
      }

      if (!fs.existsSync(pluginDir)) {
        if (this.dry) {
          this.log(`DRY RUN: Would create ${pluginDir}`, 'debug');
        } else {
          fs.mkdirSync(pluginDir, { recursive: true });
        }
      }

      // Deploy plugin files
      const files = this.getPluginFiles();
      let copiedCount = 0;

      for (const file of files) {
        const dest = path.join(pluginDir, file.name);

        if (this.dry) {
          this.log(`DRY RUN: Would copy ${file.name}`, 'debug');
          copiedCount++;
        } else {
          fs.copyFileSync(file.source, dest);
          this.log(`Copied: ${file.name}`, 'debug');
          copiedCount++;
        }
      }

      this.log(`✓ Deployed ${copiedCount} files`, 'success');

      // Initialize/update context
      if (this.autoContext) {
        this.log('Initializing context.md...', 'info');

        const manager = new ContextManager({
          projectRoot: projectPath,
          verbose: this.verbose,
          dry: this.dry
        });

        const contextResult = await manager.autoDetectAndInit({
          backupExisting: this.backupExisting,
          forceReinit: false
        });

        if (contextResult.success) {
          this.log('✓ Context initialized', 'success');
        } else {
          this.log(`Context initialization: ${contextResult.error}`, 'warning');
        }
      }

      // Record success
      this.deploymentResults.successful.push({
        project: projectName,
        path: projectPath,
        filesDeployed: copiedCount,
        contextInitialized: this.autoContext,
        timestamp: new Date().toISOString()
      });

      return { success: true, filesDeployed: copiedCount };
    } catch (error) {
      this.log(`Deployment failed: ${error.message}`, 'error');

      this.deploymentResults.failed.push({
        project: projectName,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Deploy to multiple projects
   */
  async deployToProjects(projectPaths) {
    this.log(chalk.bold(`\n🚀 Starting Deployment (${projectPaths.length} projects)\n`), 'success');

    for (const projectPath of projectPaths) {
      await this.deployToProject(projectPath);
    }

    this.log('\n✓ Deployment complete', 'success');
    return this.deploymentResults;
  }

  /**
   * Validate deployment
   */
  async validateDeployment(projectPath) {
    const projectName = path.basename(projectPath);
    const pluginDir = path.join(projectPath, '.claude', 'plugin');
    const contextPath = path.join(projectPath, 'context.md');

    const validation = {
      project: projectName,
      pluginDeployed: false,
      contextInitialized: false,
      issues: []
    };

    // Check plugin
    if (fs.existsSync(pluginDir)) {
      const requiredFiles = [
        'jeeves4coder.js',
        'context-manager.js',
        'package.json'
      ];

      validation.pluginDeployed = requiredFiles.every(f =>
        fs.existsSync(path.join(pluginDir, f))
      );

      if (!validation.pluginDeployed) {
        validation.issues.push('Missing plugin files');
      }
    } else {
      validation.issues.push('Plugin directory not found');
    }

    // Check context
    if (fs.existsSync(contextPath)) {
      validation.contextInitialized = true;

      const manager = new ContextManager({ projectRoot: projectPath });
      const contextValidation = manager.validateContext();

      if (!contextValidation.valid) {
        validation.issues.push(...contextValidation.errors);
      }
    } else {
      validation.issues.push('context.md not initialized');
    }

    return validation;
  }

  /**
   * Generate deployment report
   */
  generateReport() {
    const { successful, failed, skipped, timestamp } = this.deploymentResults;
    const total = successful.length + failed.length + skipped.length;

    let report = `
╔════════════════════════════════════════════════════════════╗
║       Jeeves4Coder Plugin Deployment Report               ║
╚════════════════════════════════════════════════════════════╝

📊 Summary
─────────────────────────────────────────────────────────────
Total Projects: ${total}
Successful: ${successful.length} ✓
Failed: ${failed.length} ✗
Skipped: ${skipped.length}

Success Rate: ${total > 0 ? ((successful.length / total) * 100).toFixed(1) : 0}%

⏰ Timestamp
─────────────────────────────────────────────────────────────
${timestamp}

`;

    if (successful.length > 0) {
      report += `✅ Successful Deployments (${successful.length})
─────────────────────────────────────────────────────────────
`;
      successful.forEach(s => {
        report += `  • ${s.project}
    Path: ${s.path}
    Files: ${s.filesDeployed}
    Context: ${s.contextInitialized ? '✓' : '✗'}
`;
      });
      report += '\n';
    }

    if (failed.length > 0) {
      report += `❌ Failed Deployments (${failed.length})
─────────────────────────────────────────────────────────────
`;
      failed.forEach(f => {
        report += `  • ${f.project}
    Error: ${f.error}
`;
      });
      report += '\n';
    }

    report += `═════════════════════════════════════════════════════════════
Generated: ${new Date().toISOString()}
`;

    return report;
  }

  /**
   * Summary statistics
   */
  getSummary() {
    const { successful, failed, skipped } = this.deploymentResults;

    return {
      total: successful.length + failed.length + skipped.length,
      successful: successful.length,
      failed: failed.length,
      skipped: skipped.length,
      successRate: successful.length > 0 ?
        ((successful.length / (successful.length + failed.length)) * 100).toFixed(1) : 0,
      timestamp: this.deploymentResults.timestamp
    };
  }
}

/**
 * CLI Interface
 */
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(chalk.bold.cyan('\n🚀 Jeeves4Coder Plugin Deployer\n'));
    console.log('Usage: node deploy-with-context.js <command> [options]\n');
    console.log('Commands:');
    console.log('  deploy <project-paths>   Deploy to projects');
    console.log('  validate <project-path>  Validate deployment');
    console.log('  report                   Generate report\n');
    console.log('Examples:');
    console.log('  node deploy-with-context.js deploy /path/to/project1 /path/to/project2');
    console.log('  node deploy-with-context.js validate /path/to/project');
    console.log('  node deploy-with-context.js report\n');
    process.exit(0);
  }

  const command = args[0];
  const deployer = new PluginDeployer({
    verbose: true,
    dry: process.env.DRY_RUN === 'true'
  });

  switch (command) {
    case 'deploy':
      const projects = args.slice(1);
      if (projects.length === 0) {
        console.log(chalk.red('Error: Please provide project paths'));
        process.exit(1);
      }
      deployer.deployToProjects(projects).then(results => {
        console.log(deployer.generateReport());
        process.exit(results.failed.length > 0 ? 1 : 0);
      });
      break;

    case 'validate':
      const projectPath = args[1];
      if (!projectPath) {
        console.log(chalk.red('Error: Please provide project path'));
        process.exit(1);
      }
      deployer.validateDeployment(projectPath).then(validation => {
        console.log('Validation Result:');
        console.log(JSON.stringify(validation, null, 2));
        process.exit(validation.issues.length > 0 ? 1 : 0);
      });
      break;

    case 'report':
      console.log(deployer.generateReport());
      break;

    default:
      console.log(chalk.red(`Unknown command: ${command}`));
      process.exit(1);
  }
}

module.exports = PluginDeployer;
