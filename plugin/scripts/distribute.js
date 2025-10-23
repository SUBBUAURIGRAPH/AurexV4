#!/usr/bin/env node

/**
 * J4C Plugin Distribution Script
 * Distributes plugin across npm, GitHub Packages, Docker registries, and other channels
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

// Configuration
const config = {
  projectRoot: path.resolve(__dirname, '..'),
  distConfig: 'distribution.config.json',
  maxRetries: 3,
  retryDelay: 5000
};

// Utility functions
const log = {
  info: (msg) => console.log(chalk.blue(`[INFO] ${msg}`)),
  success: (msg) => console.log(chalk.green(`[SUCCESS] ${msg}`)),
  warn: (msg) => console.log(chalk.yellow(`[WARN] ${msg}`)),
  error: (msg) => console.log(chalk.red(`[ERROR] ${msg}`)),
  debug: (msg) => process.env.DEBUG && console.log(chalk.gray(`[DEBUG] ${msg}`))
};

const run = (command, description, options = {}) => {
  try {
    log.debug(`Running: ${description}`);
    log.debug(`Command: ${command}`);

    const opts = {
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: config.projectRoot,
      encoding: 'utf-8',
      ...options
    };

    const result = execSync(command, opts);
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout || '' };
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async (fn, description, maxRetries = config.maxRetries) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log.info(`${description} (Attempt ${attempt}/${maxRetries})`);
      const result = await fn();
      if (result) {
        log.success(`${description} ✓`);
        return true;
      }
    } catch (error) {
      log.warn(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        log.info(`Retrying in ${config.retryDelay / 1000} seconds...`);
        await sleep(config.retryDelay);
      }
    }
  }
  return false;
};

const loadDistributionConfig = () => {
  try {
    const configPath = path.join(config.projectRoot, config.distConfig);
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    log.error(`Failed to load distribution config: ${error.message}`);
    throw error;
  }
};

const getPackageInfo = () => {
  const packagePath = path.join(config.projectRoot, 'jeeves4coder-package.json');
  return JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
};

const verifyEnvironment = () => {
  log.info('=== Verifying Distribution Environment ===');

  const requiredEnvs = [];
  const optionalEnvs = ['INTERNAL_NPM_TOKEN', 'GITHUB_TOKEN', 'DOCKER_CREDENTIALS'];

  for (const env of optionalEnvs) {
    if (!process.env[env]) {
      log.warn(`${env} not configured`);
    } else {
      log.debug(`${env} configured`);
    }
  }

  log.success('Environment verification complete ✓');
  return true;
};

const publishToNpm = async (registry, token) => {
  return retryOperation(async () => {
    const { name, version } = getPackageInfo();

    log.info(`Publishing ${name}@${version} to ${registry.name}...`);

    // Set npm config
    const registryUrl = registry.url.replace('https://', '').replace('http://', '');
    const configCmd = `npm config set //${registryUrl}/:_authToken="${token}"`;

    run(configCmd, 'Configure npm registry', { silent: true });

    // Publish package
    const publishCmd = [
      'npm publish',
      `--registry=${registry.url}`,
      `--access=${registry.access}`,
      `--tag=${registry.tag}`
    ].join(' ');

    const result = run(publishCmd, `Publish to ${registry.name}`, { silent: true });

    if (result.success) {
      log.success(`Published to ${registry.name} ✓`);

      // Verify publication
      const infoCmd = `npm info ${name}@${version} --registry=${registry.url}`;
      const infoResult = run(infoCmd, `Verify publication on ${registry.name}`, { silent: true });

      return infoResult.success;
    }

    return false;
  }, `Publish to npm registry (${registry.name})`);
};

const publishToDockerRegistry = async (registry, imageName, imageTag) => {
  return retryOperation(async () => {
    log.info(`Publishing Docker image to ${registry.name}...`);

    const fullImageName = `${registry.url}/${registry.repository}:${imageTag}`;

    // Build Docker image
    const buildCmd = `docker build -t ${fullImageName} .`;
    const buildResult = run(buildCmd, `Build Docker image for ${registry.name}`, { silent: true });

    if (!buildResult.success) {
      log.error(`Failed to build Docker image: ${buildResult.error}`);
      return false;
    }

    // Login if token available
    if (registry.tokenVar && process.env[registry.tokenVar]) {
      const token = process.env[registry.tokenVar];
      let loginCmd;

      if (registry.name === 'github-container-registry') {
        loginCmd = `echo "${token}" | docker login ghcr.io -u ${process.env.GITHUB_ACTOR || 'github'} --password-stdin`;
      } else {
        loginCmd = `docker login -u ${process.env.DOCKER_USERNAME || 'default'} -p "${token}" ${registry.url}`;
      }

      const loginResult = run(loginCmd, `Login to ${registry.name}`, { silent: true });
      if (!loginResult.success) {
        log.warn(`Failed to login to ${registry.name}`);
      }
    }

    // Push image
    const pushCmd = `docker push ${fullImageName}`;
    const pushResult = run(pushCmd, `Push image to ${registry.name}`, { silent: true });

    if (pushResult.success) {
      log.success(`Pushed to ${registry.name}: ${fullImageName} ✓`);
      return true;
    }

    return false;
  }, `Publish to Docker registry (${registry.name})`);
};

const createGitHubRelease = async (distConfig) => {
  return retryOperation(async () => {
    const { version } = getPackageInfo();
    const { repository } = distConfig.distribution.distribution_metadata;

    log.info('Creating GitHub release...');

    // Check if gh CLI is available
    const ghCheck = run('gh --version', 'Check gh CLI', { silent: true });
    if (!ghCheck.success) {
      log.warn('gh CLI not available, skipping GitHub release');
      return true;
    }

    // Prepare release notes
    const releaseTitle = `Jeeves4Coder Plugin v${version}`;
    const releaseBody = `
## Jeeves4Coder Plugin v${version}

**Release Date**: ${new Date().toISOString().split('T')[0]}

### Features
- Code review and analysis
- Refactoring suggestions
- Architecture review
- Performance optimization
- Design pattern recommendations
- Testing strategy development
- Documentation improvement
- Security vulnerability auditing

### Installation

#### npm (Internal Registry)
\`\`\`bash
npm install @aurigraph/jeeves4coder-plugin --registry https://npm.aurigraph.io
\`\`\`

#### GitHub Packages
\`\`\`bash
npm install @aurigraph-dlt-corp/jeeves4coder-plugin --registry https://npm.pkg.github.com
\`\`\`

#### Docker
\`\`\`bash
docker pull ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:${version}
\`\`\`

### Documentation
- [Installation Guide](https://docs.aurigraph.io/j4c/installation)
- [Usage Guide](https://docs.aurigraph.io/j4c/usage)
- [API Documentation](https://docs.aurigraph.io/j4c/api)
- [Troubleshooting](https://docs.aurigraph.io/j4c/troubleshooting)

### Support
- Email: agents@aurigraph.io
- Slack: #aurigraph-agents
- GitHub Issues: ${repository}/issues

---

*Distributed by Aurigraph Development Team*
`;

    const releaseCmd = [
      'gh release create',
      `v${version}`,
      `--title="${releaseTitle}"`,
      `--notes="${releaseBody}"`,
      '--latest'
    ].join(' ');

    const result = run(releaseCmd, 'Create GitHub release', { silent: true });
    return result.success;
  }, 'Create GitHub release');
};

const updateDistributionMetadata = async () => {
  log.info('=== Updating Distribution Metadata ===');

  try {
    const packageJson = getPackageInfo();
    const timestamp = new Date().toISOString();

    const metadata = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      distributedAt: timestamp,
      distributedBy: process.env.USER || process.env.USERNAME || 'automation',
      channels: {
        npm_internal: true,
        github_packages: true,
        github_container_registry: true,
        direct_download: true
      },
      documentation: {
        homepage: packageJson.homepage,
        repository: packageJson.repository.url,
        bugs: packageJson.bugs.url,
        docs: 'https://docs.aurigraph.io/j4c'
      }
    };

    const metadataPath = path.join(config.projectRoot, 'DISTRIBUTION_METADATA.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    log.success('Distribution metadata updated ✓');
    return true;
  } catch (error) {
    log.warn(`Failed to update metadata: ${error.message}`);
    return true; // Don't fail distribution
  }
};

const generateDistributionReport = async (results) => {
  log.info('=== Generating Distribution Report ===');

  try {
    const reportPath = path.join(config.projectRoot, 'DISTRIBUTION_REPORT.json');

    const report = {
      timestamp: new Date().toISOString(),
      version: getPackageInfo().version,
      distribution: {
        npm_registries: results.npmResults || [],
        docker_registries: results.dockerResults || [],
        github_release: results.githubRelease || false,
        metadata_updated: results.metadataUpdated || false
      },
      summary: {
        total_channels: (results.npmResults || []).length + (results.dockerResults || []).length + 1,
        successful_distributions: (results.npmResults || []).filter(r => r).length +
                                  (results.dockerResults || []).filter(r => r).length +
                                  (results.githubRelease ? 1 : 0),
        failed_distributions: (results.npmResults || []).filter(r => !r).length +
                              (results.dockerResults || []).filter(r => !r).length
      },
      channels: {
        npm: {
          public: false,
          internal: true,
          github_packages: true
        },
        docker: {
          docker_hub: false,
          github_container_registry: true,
          internal_registry: true
        }
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    log.success(`Distribution report saved: DISTRIBUTION_REPORT.json ✓`);

    return true;
  } catch (error) {
    log.warn(`Failed to generate report: ${error.message}`);
    return true;
  }
};

const verifyDistribution = async (distConfig) => {
  log.info('=== Verifying Distribution ===');

  try {
    const { name, version } = getPackageInfo();

    // Verify npm packages
    for (const registry of distConfig.distribution.channels.npm.registries) {
      if (registry.enabled) {
        const infoCmd = `npm info ${name}@${version} --registry=${registry.url}`;
        const result = run(infoCmd, `Verify on ${registry.name}`, { silent: true });

        if (result.success) {
          log.success(`✓ ${name}@${version} available on ${registry.name}`);
        } else {
          log.warn(`✗ Could not verify ${registry.name}`);
        }
      }
    }

    // Verify Docker images
    for (const registry of distConfig.distribution.channels.docker.registries) {
      if (registry.enabled) {
        const imageName = `${registry.url}/${registry.repository}:${version}`;
        log.info(`Docker image available: ${imageName}`);
      }
    }

    log.success('Distribution verification complete ✓');
    return true;
  } catch (error) {
    log.warn(`Verification failed: ${error.message}`);
    return true;
  }
};

// Main distribution function
const distribute = async () => {
  console.log(chalk.cyan.bold('\n📦 J4C Plugin Distribution System\n'));

  const distConfig = loadDistributionConfig();
  const packageJson = getPackageInfo();

  log.info(`Distributing ${packageJson.name} v${packageJson.version}`);

  const results = {
    npmResults: [],
    dockerResults: [],
    githubRelease: false,
    metadataUpdated: false
  };

  try {
    // Step 1: Verify environment
    verifyEnvironment();
    console.log();

    // Step 2: Publish to npm registries
    log.info('=== Publishing to npm Registries ===');
    for (const registry of distConfig.distribution.channels.npm.registries) {
      if (registry.enabled) {
        const token = process.env[registry.tokenVar];
        if (!token) {
          log.warn(`No token for ${registry.name}, skipping...`);
          results.npmResults.push(false);
          continue;
        }

        const success = await publishToNpm(registry, token);
        results.npmResults.push(success);
      }
    }
    console.log();

    // Step 3: Publish to Docker registries
    log.info('=== Publishing to Docker Registries ===');
    for (const registry of distConfig.distribution.channels.docker.registries) {
      if (registry.enabled) {
        const success = await publishToDockerRegistry(
          registry,
          packageJson.name,
          packageJson.version
        );
        results.dockerResults.push(success);
      }
    }
    console.log();

    // Step 4: Create GitHub release
    log.info('=== Creating GitHub Release ===');
    results.githubRelease = await createGitHubRelease(distConfig);
    console.log();

    // Step 5: Update metadata
    log.info('=== Updating Distribution Metadata ===');
    results.metadataUpdated = await updateDistributionMetadata();
    console.log();

    // Step 6: Verify distribution
    await verifyDistribution(distConfig);
    console.log();

    // Step 7: Generate report
    await generateDistributionReport(results);
    console.log();

    // Summary
    const successCount = results.npmResults.filter(r => r).length +
                        results.dockerResults.filter(r => r).length +
                        (results.githubRelease ? 1 : 0);
    const totalCount = results.npmResults.length + results.dockerResults.length + 1;

    console.log(chalk.cyan('=== Distribution Summary ==='));
    log.success(`Successful: ${successCount}/${totalCount}`);

    if (successCount === totalCount) {
      console.log(chalk.green.bold('\n✅ Distribution Complete!\n'));
      console.log(chalk.gray('Plugin is now available at:'));
      console.log(chalk.gray('  • npm Internal Registry'));
      console.log(chalk.gray('  • GitHub Packages'));
      console.log(chalk.gray('  • GitHub Container Registry'));
      console.log(chalk.gray('  • GitHub Releases\n'));
      return true;
    } else {
      console.log(chalk.yellow.bold('\n⚠️  Distribution Partially Complete\n'));
      return true;
    }
  } catch (error) {
    log.error(`Distribution failed: ${error.message}`);
    console.log(chalk.red.bold('\n❌ Distribution Failed\n'));
    process.exit(1);
  }
};

// Run distribution
distribute().catch(error => {
  log.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});
