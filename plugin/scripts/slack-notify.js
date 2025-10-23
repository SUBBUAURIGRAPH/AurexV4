#!/usr/bin/env node

/**
 * Slack Notification Script
 * Sends J4C plugin distribution and release notifications to Slack
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Configuration
const config = {
  projectRoot: path.resolve(__dirname, '..'),
  slackConfig: 'slack.config.json',
  timeout: 10000
};

// Utility functions
const log = {
  info: (msg) => console.log(chalk.blue(`[INFO] ${msg}`)),
  success: (msg) => console.log(chalk.green(`[SUCCESS] ${msg}`)),
  warn: (msg) => console.log(chalk.yellow(`[WARN] ${msg}`)),
  error: (msg) => console.log(chalk.red(`[ERROR] ${msg}`)),
  debug: (msg) => process.env.DEBUG && console.log(chalk.gray(`[DEBUG] ${msg}`))
};

const loadConfig = () => {
  try {
    const configPath = path.join(config.projectRoot, config.slackConfig);
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    log.error(`Failed to load Slack config: ${error.message}`);
    throw error;
  }
};

const getPackageInfo = () => {
  try {
    const packagePath = path.join(config.projectRoot, 'jeeves4coder-package.json');
    return JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  } catch (error) {
    log.error(`Failed to load package info: ${error.message}`);
    throw error;
  }
};

const sendSlackMessage = (webhookUrl, message) => {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(message))
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          reject(new Error(`Slack API returned status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(config.timeout);
    req.write(JSON.stringify(message));
    req.end();
  });
};

const retryOperation = async (fn, description, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log.debug(`${description} (Attempt ${attempt}/${maxRetries})`);
      await fn();
      log.success(`${description} ✓`);
      return true;
    } catch (error) {
      log.warn(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  return false;
};

const createDistributionMessage = (packageJson) => {
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📦 J4C Plugin Distribution Complete',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Plugin:*\n${packageJson.name}`
          },
          {
            type: 'mrkdwn',
            text: `*Version:*\nv${packageJson.version}`
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n✅ Distributed`
          },
          {
            type: 'mrkdwn',
            text: `*Date:*\n${new Date().toISOString().split('T')[0]}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Description:*\n${packageJson.description}`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Distribution Channels:*\n• npm Internal Registry (@aurigraph)\n• GitHub Packages (@aurigraph-dlt-corp)\n• GitHub Container Registry (ghcr.io)\n• Internal Docker Registry\n• GitHub Releases\n• Direct Download'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Installation Methods:*\n```\nnpm install @aurigraph/jeeves4coder-plugin\ndocker pull ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:1.0.0\ngh release download v1.0.0\ngit clone https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git\n```'
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Release',
              emoji: true
            },
            url: 'https://github.com/Aurigraph-DLT-Corp/glowing-adventure/releases/latest',
            action_id: 'view_release'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Documentation',
              emoji: true
            },
            url: 'https://docs.aurigraph.io/j4c',
            action_id: 'view_docs'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'GitHub Packages',
              emoji: true
            },
            url: 'https://github.com/Aurigraph-DLT-Corp/glowing-adventure/packages',
            action_id: 'view_packages'
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '🤖 Distributed by Aurigraph Development Team | <https://github.com/Aurigraph-DLT-Corp/glowing-adventure|GitHub>'
          }
        ]
      }
    ]
  };
};

const createReleaseMessage = (packageJson) => {
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚀 J4C Plugin v' + packageJson.version + ' Released',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${packageJson.name}* has been released!\n\n_${packageJson.description}_`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Author:*\nAurigraph Development Team`
          },
          {
            type: 'mrkdwn',
            text: `*Release Date:*\n${new Date().toISOString().split('T')[0]}`
          },
          {
            type: 'mrkdwn',
            text: `*License:*\nProprietary`
          },
          {
            type: 'mrkdwn',
            text: `*Support:*\nagents@aurigraph.io`
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Key Features:*\n✅ Code review and analysis\n✅ Refactoring suggestions\n✅ Architecture review\n✅ Performance optimization\n✅ Design pattern recommendations\n✅ Testing strategy development\n✅ Documentation improvement\n✅ Security vulnerability auditing'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Quick Installation:*\n```\nnpm install @aurigraph/jeeves4coder-plugin\n# or\ndocker pull ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:' + packageJson.version + '\n```'
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View on GitHub',
              emoji: true
            },
            url: 'https://github.com/Aurigraph-DLT-Corp/glowing-adventure/releases/latest',
            action_id: 'github_release'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Read Documentation',
              emoji: true
            },
            url: 'https://docs.aurigraph.io/j4c',
            action_id: 'read_docs'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Get Support',
              emoji: true
            },
            url: 'https://github.com/Aurigraph-DLT-Corp/glowing-adventure/issues',
            action_id: 'support'
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Check out the <https://docs.aurigraph.io/j4c|documentation> for installation instructions and usage examples!'
          }
        ]
      }
    ]
  };
};

const createDeploymentMessage = (environment, packageJson) => {
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔧 J4C Plugin Deployed to ' + environment,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Plugin:*\n${packageJson.name}`
          },
          {
            type: 'mrkdwn',
            text: `*Version:*\nv${packageJson.version}`
          },
          {
            type: 'mrkdwn',
            text: `*Environment:*\n${environment.charAt(0).toUpperCase() + environment.slice(1)}`
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n✅ Deployed`
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Deployment Details:*\n• Environment: ' + environment + '\n• Version: ' + packageJson.version + '\n• Timestamp: ' + new Date().toISOString() + '\n• Status: Success'
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '✅ Deployment completed successfully!'
          }
        ]
      }
    ]
  };
};

const notifyDistribution = async (slackConfig, packageJson) => {
  console.log(chalk.cyan.bold('\n📢 Sending Distribution Notifications to Slack\n'));

  const channels = slackConfig.slack.channels;
  const message = createDistributionMessage(packageJson);
  let successCount = 0;
  let failureCount = 0;

  // Send to configured channels
  const targetChannels = ['announcements', 'agents', 'releases'];

  for (const channelName of targetChannels) {
    const channel = channels[channelName];
    if (!channel || !channel.enabled) {
      log.warn(`${channel?.name || channelName} is disabled, skipping...`);
      continue;
    }

    const webhookUrl = process.env[channel.webhookUrl.substring(2, channel.webhookUrl.length - 1)] ||
                       channel.webhookUrl;

    if (!webhookUrl) {
      log.warn(`No webhook URL configured for ${channel.name}`);
      failureCount++;
      continue;
    }

    const success = await retryOperation(
      () => sendSlackMessage(webhookUrl, message),
      `Send distribution notification to ${channel.name}`
    );

    if (success) {
      successCount++;
    } else {
      failureCount++;
    }

    // Add spacing between requests
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(chalk.cyan('\n=== Notification Summary ==='));
  log.success(`Sent: ${successCount} notifications`);
  if (failureCount > 0) {
    log.warn(`Failed: ${failureCount} notifications`);
  }

  return successCount > 0;
};

const notifyRelease = async (slackConfig, packageJson) => {
  console.log(chalk.cyan.bold('\n🚀 Sending Release Notification to Slack\n'));

  const channels = slackConfig.slack.channels;
  const message = createReleaseMessage(packageJson);
  let successCount = 0;

  // Send to announcements and releases
  const targetChannels = ['announcements', 'releases'];

  for (const channelName of targetChannels) {
    const channel = channels[channelName];
    if (!channel || !channel.enabled) {
      log.warn(`${channel?.name || channelName} is disabled, skipping...`);
      continue;
    }

    const webhookUrl = process.env[channel.webhookUrl.substring(2, channel.webhookUrl.length - 1)] ||
                       channel.webhookUrl;

    if (!webhookUrl) {
      log.warn(`No webhook URL configured for ${channel.name}`);
      continue;
    }

    const success = await retryOperation(
      () => sendSlackMessage(webhookUrl, message),
      `Send release notification to ${channel.name}`
    );

    if (success) {
      successCount++;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(chalk.cyan('\n=== Release Notification Summary ==='));
  log.success(`Sent: ${successCount} release notifications`);

  return successCount > 0;
};

const notifyDeployment = async (slackConfig, packageJson, environment) => {
  console.log(chalk.cyan.bold(`\n🔧 Sending Deployment Notification to Slack\n`));

  const channels = slackConfig.slack.channels;
  const message = createDeploymentMessage(environment, packageJson);
  let successCount = 0;

  // Send to dev and releases
  const targetChannels = ['dev', 'releases'];

  for (const channelName of targetChannels) {
    const channel = channels[channelName];
    if (!channel || !channel.enabled) {
      continue;
    }

    const webhookUrl = process.env[channel.webhookUrl.substring(2, channel.webhookUrl.length - 1)] ||
                       channel.webhookUrl;

    if (!webhookUrl) {
      continue;
    }

    const success = await retryOperation(
      () => sendSlackMessage(webhookUrl, message),
      `Send deployment notification to ${channel.name}`
    );

    if (success) {
      successCount++;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(chalk.cyan('\n=== Deployment Notification Summary ==='));
  log.success(`Sent: ${successCount} deployment notifications`);

  return successCount > 0;
};

// Main execution
const main = async () => {
  const command = process.argv[2] || 'distribution';
  const environment = process.argv[3] || 'staging';

  try {
    const slackConfig = loadConfig();
    const packageJson = getPackageInfo();

    if (!slackConfig.slack.enabled) {
      log.warn('Slack notifications are disabled');
      return;
    }

    switch (command) {
      case 'distribution':
        await notifyDistribution(slackConfig, packageJson);
        break;

      case 'release':
        await notifyRelease(slackConfig, packageJson);
        break;

      case 'deployment':
        await notifyDeployment(slackConfig, packageJson, environment);
        break;

      default:
        log.error(`Unknown command: ${command}`);
        process.exit(1);
    }

    console.log(chalk.green.bold('\n✅ Slack Notifications Complete\n'));
  } catch (error) {
    log.error(`Failed to send Slack notifications: ${error.message}`);
    process.exit(1);
  }
};

// Run notifications
main();
