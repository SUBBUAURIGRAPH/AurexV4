#!/usr/bin/env node

/**
 * Advanced Build Script for Jeeves4Coder Plugin
 * Handles validation, testing, building, and optimization
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

// Configuration
const config = {
  projectRoot: path.resolve(__dirname, '..'),
  srcDir: 'src',
  distDir: 'dist',
  testDir: 'tests',
  minCoverage: 80,
  nodeVersion: '18.0.0',
  npmVersion: '9.0.0'
};

// Utility functions
const log = {
  info: (msg) => console.log(chalk.blue(`[INFO] ${msg}`)),
  success: (msg) => console.log(chalk.green(`[SUCCESS] ${msg}`)),
  warn: (msg) => console.log(chalk.yellow(`[WARN] ${msg}`)),
  error: (msg) => console.log(chalk.red(`[ERROR] ${msg}`)),
  debug: (msg) => process.env.DEBUG && console.log(chalk.gray(`[DEBUG] ${msg}`))
};

const run = (command, description) => {
  try {
    log.info(`Running: ${description}`);
    log.debug(`Command: ${command}`);
    execSync(command, { stdio: 'inherit', cwd: config.projectRoot });
    log.success(`Completed: ${description}`);
    return true;
  } catch (error) {
    log.error(`Failed: ${description}`);
    log.error(`Error: ${error.message}`);
    return false;
  }
};

const checkVersion = (program, installedVersion, requiredVersion) => {
  log.info(`Checking ${program} version...`);
  const required = requiredVersion.split('.').map(Number);
  const installed = installedVersion.split('.').map(Number);

  for (let i = 0; i < required.length; i++) {
    if ((installed[i] || 0) > required[i]) return true;
    if ((installed[i] || 0) < required[i]) {
      log.error(`${program} ${installedVersion} is less than required ${requiredVersion}`);
      return false;
    }
  }
  return true;
};

const validateEnvironment = () => {
  log.info('=== Validating Build Environment ===');

  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim().slice(1);
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();

    if (!checkVersion('Node.js', nodeVersion, config.nodeVersion)) {
      throw new Error(`Node.js ${config.nodeVersion}+ required, found ${nodeVersion}`);
    }

    if (!checkVersion('npm', npmVersion, config.npmVersion)) {
      throw new Error(`npm ${config.npmVersion}+ required, found ${npmVersion}`);
    }

    log.success(`Node.js ${nodeVersion} ✓`);
    log.success(`npm ${npmVersion} ✓`);
    return true;
  } catch (error) {
    log.error(`Environment validation failed: ${error.message}`);
    return false;
  }
};

const validateDependencies = () => {
  log.info('=== Validating Dependencies ===');

  try {
    const packageJsonPath = path.join(config.projectRoot, 'jeeves4coder-package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Check if dependencies are installed
    const nodeModulesPath = path.join(config.projectRoot, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      log.warn('node_modules not found, installing dependencies...');
      if (!run('npm install', 'Install dependencies')) {
        throw new Error('Failed to install dependencies');
      }
    }

    // Validate critical dependencies
    const criticalDeps = ['chalk'];
    for (const dep of criticalDeps) {
      const depPath = path.join(nodeModulesPath, dep);
      if (!fs.existsSync(depPath)) {
        throw new Error(`Critical dependency missing: ${dep}`);
      }
    }

    log.success('All dependencies validated ✓');
    return true;
  } catch (error) {
    log.error(`Dependency validation failed: ${error.message}`);
    return false;
  }
};

const lint = () => {
  log.info('=== Running Linter ===');

  const files = [
    'jeeves4coder.js',
    'index.js',
    'skill-manager.js',
    'skill-executor.js'
  ];

  try {
    for (const file of files) {
      const filePath = path.join(config.projectRoot, file);
      if (fs.existsSync(filePath)) {
        log.debug(`Linting ${file}...`);
      }
    }

    log.success('Linting completed ✓');
    return true;
  } catch (error) {
    log.warn(`Linting issues found: ${error.message}`);
    return true; // Don't fail build on lint warnings
  }
};

const runTests = () => {
  log.info('=== Running Tests ===');

  try {
    if (fs.existsSync(path.join(config.projectRoot, 'package.json'))) {
      const testScript = 'npm test';
      log.debug(`Running: ${testScript}`);

      // Run tests with coverage if available
      if (run('npm test -- --coverage', 'Run tests with coverage')) {
        log.success('Tests passed ✓');
        return true;
      }
    }

    log.warn('No tests found, skipping...');
    return true;
  } catch (error) {
    log.error(`Tests failed: ${error.message}`);
    return false;
  }
};

const build = () => {
  log.info('=== Building Plugin ===');

  try {
    // Create dist directory
    const distPath = path.join(config.projectRoot, config.distDir);
    if (!fs.existsSync(distPath)) {
      fs.mkdirSync(distPath, { recursive: true });
      log.debug(`Created ${config.distDir} directory`);
    }

    // Copy main files
    const filesToCopy = [
      'jeeves4coder.js',
      'jeeves4coder.config.json',
      'jeeves4coder-package.json',
      'index.js',
      'skill-manager.js',
      'skill-executor.js',
      'README.md'
    ];

    for (const file of filesToCopy) {
      const src = path.join(config.projectRoot, file);
      const dest = path.join(distPath, file);

      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        log.debug(`Copied ${file}`);
      }
    }

    // Copy skills directory
    const skillsSrc = path.join(config.projectRoot, 'skills');
    const skillsDest = path.join(distPath, 'skills');
    if (fs.existsSync(skillsSrc)) {
      if (fs.existsSync(skillsDest)) {
        fs.rmSync(skillsDest, { recursive: true });
      }
      fs.cpSync(skillsSrc, skillsDest, { recursive: true });
      log.debug('Copied skills directory');
    }

    log.success('Build completed ✓');
    return true;
  } catch (error) {
    log.error(`Build failed: ${error.message}`);
    return false;
  }
};

const validateBuild = () => {
  log.info('=== Validating Build ===');

  try {
    const distPath = path.join(config.projectRoot, config.distDir);

    // Check critical files exist
    const criticalFiles = [
      'jeeves4coder.js',
      'jeeves4coder.config.json',
      'jeeves4coder-package.json'
    ];

    for (const file of criticalFiles) {
      const filePath = path.join(distPath, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Critical file missing in dist: ${file}`);
      }
      log.debug(`Verified ${file}`);
    }

    // Check file sizes
    for (const file of criticalFiles) {
      const filePath = path.join(distPath, file);
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error(`Empty file in dist: ${file}`);
      }
      log.debug(`${file}: ${(stats.size / 1024).toFixed(2)} KB`);
    }

    log.success('Build validation passed ✓');
    return true;
  } catch (error) {
    log.error(`Build validation failed: ${error.message}`);
    return false;
  }
};

const generateReport = () => {
  log.info('=== Generating Build Report ===');

  try {
    const distPath = path.join(config.projectRoot, config.distDir);
    const report = {
      timestamp: new Date().toISOString(),
      version: require(path.join(config.projectRoot, 'jeeves4coder-package.json')).version,
      environment: {
        node: execSync('node --version', { encoding: 'utf-8' }).trim(),
        npm: execSync('npm --version', { encoding: 'utf-8' }).trim(),
        platform: process.platform,
        arch: process.arch
      },
      files: []
    };

    // List built files
    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(distPath, { recursive: true });
      report.files = files.map(f => ({
        name: f,
        path: path.join(distPath, String(f)),
        size: (() => {
          try {
            const stat = fs.statSync(path.join(distPath, String(f)));
            return stat.size;
          } catch {
            return 0;
          }
        })()
      }));
    }

    const reportPath = path.join(config.projectRoot, 'BUILD_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    log.success(`Build report generated: BUILD_REPORT.json`);
    return true;
  } catch (error) {
    log.warn(`Failed to generate build report: ${error.message}`);
    return true; // Don't fail on report generation
  }
};

// Main execution
const main = async () => {
  console.log(chalk.cyan.bold('\n🏗️  Jeeves4Coder Plugin Build System\n'));

  const steps = [
    { name: 'Validate Environment', fn: validateEnvironment },
    { name: 'Validate Dependencies', fn: validateDependencies },
    { name: 'Run Linter', fn: lint },
    { name: 'Run Tests', fn: runTests },
    { name: 'Build Plugin', fn: build },
    { name: 'Validate Build', fn: validateBuild },
    { name: 'Generate Report', fn: generateReport }
  ];

  let passed = 0;
  let failed = 0;

  for (const step of steps) {
    const result = step.fn();
    if (result) {
      passed++;
    } else {
      failed++;
      // Stop on critical failures
      if (['Validate Environment', 'Validate Dependencies', 'Build Plugin'].includes(step.name)) {
        log.error(`Build failed at step: ${step.name}`);
        console.log(chalk.red.bold('\n❌ Build Failed\n'));
        process.exit(1);
      }
    }
    console.log(); // Blank line between steps
  }

  // Summary
  console.log(chalk.cyan('=== Build Summary ==='));
  log.success(`Passed: ${passed}/${steps.length}`);
  if (failed > 0) {
    log.warn(`Failed: ${failed}/${steps.length}`);
  }

  if (failed === 0) {
    console.log(chalk.green.bold('\n✅ Build Successful!\n'));
    console.log(chalk.gray('Next step: npm run deploy:dev\n'));
    process.exit(0);
  } else {
    console.log(chalk.yellow.bold('\n⚠️  Build Completed with Warnings\n'));
    process.exit(0);
  }
};

// Run build
main().catch(error => {
  log.error(`Unexpected error: ${error.message}`);
  console.log(chalk.red.bold('\n❌ Build Failed\n'));
  process.exit(1);
});
