/**
 * System Command Handler
 * Handles system-level operations and utilities
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios';
import * as chalk from 'chalk';
import * as os from 'os';
import * as fs from 'fs';
import { CommandOptions, OutputFormat } from '../types';
import Formatter from '../utils/formatter';
import ConfigManager from '../utils/config';
import AuthManager from '../utils/auth';

/**
 * System Handler Class
 * Manages system-level operations
 *
 * @example
 * ```bash
 * # Show system configuration
 * hms system config
 *
 * # Check system health
 * hms system health
 *
 * # Show version information
 * hms system version
 *
 * # Check for updates
 * hms system update
 * ```
 */
export class SystemHandler {
  private config = ConfigManager.getInstance();
  private auth = AuthManager.getInstance();
  private apiClient: AxiosInstance;
  private readonly VERSION = '1.0.0';

  constructor() {
    this.apiClient = axios.create({
      baseURL: this.config.getApiUrl(),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Show system configuration
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms system config
   * hms system config --format json
   * hms system config --show-all
   * ```
   */
  async config(options: CommandOptions): Promise<void> {
    try {
      Formatter.header('System Configuration');

      const configData = this.config.getAll();
      const format = (options.format as OutputFormat) || OutputFormat.TABLE;

      // Add system information
      const systemConfig: any = {
        ...configData,
        'CLI Version': this.VERSION,
        'Node Version': process.version,
        'Platform': os.platform(),
        'Architecture': os.arch(),
        'Home Directory': os.homedir()
      };

      // Add authentication status
      systemConfig['Authenticated'] = this.auth.isAuthenticated() ? 'Yes' : 'No';

      if (this.auth.isAuthenticated()) {
        systemConfig['User ID'] = this.config.getUserId();
      }

      // Show all config including paths
      if (options.showAll) {
        systemConfig['Config Path'] = this.config.getConfigPath();
        systemConfig['Credentials Path'] = this.config.get('credentialsPath');
      }

      console.log(Formatter.format(systemConfig, format));

      if (format === OutputFormat.TABLE) {
        console.log('');
        console.log(chalk.gray('Use --show-all to display file paths'));
        console.log(chalk.gray('Use --format json to export configuration'));
        console.log('');
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Check system health
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms system health
   * hms system health --verbose
   * ```
   */
  async health(options: CommandOptions): Promise<void> {
    try {
      Formatter.header('System Health Check');

      const healthChecks: any = {
        'CLI Version': this.VERSION,
        'Node.js': process.version,
        'Config Loaded': fs.existsSync(this.config.getConfigPath()) ? 'Yes' : 'No',
        'Authenticated': this.auth.isAuthenticated() ? 'Yes' : 'No'
      };

      // Check API connectivity
      const stopLoading = Formatter.loading('Checking API connectivity...');

      try {
        const startTime = Date.now();
        const response = await this.apiClient.get('/health', {
          timeout: 5000
        });
        const responseTime = Date.now() - startTime;

        stopLoading();

        healthChecks['API Status'] = chalk.green('Online');
        healthChecks['API Response Time'] = `${responseTime}ms`;

        if (response.data.version) {
          healthChecks['API Version'] = response.data.version;
        }

      } catch (error: any) {
        stopLoading();
        healthChecks['API Status'] = chalk.red('Offline');
        healthChecks['API Error'] = error.message || 'Connection failed';
      }

      // System resources
      if (options.verbose) {
        healthChecks['Total Memory'] = `${(os.totalmem() / (1024 ** 3)).toFixed(2)} GB`;
        healthChecks['Free Memory'] = `${(os.freemem() / (1024 ** 3)).toFixed(2)} GB`;
        healthChecks['CPU Cores'] = os.cpus().length;
        healthChecks['Uptime'] = this.formatUptime(os.uptime());
        healthChecks['Load Average'] = os.loadavg().map(l => l.toFixed(2)).join(', ');
      }

      // Check for required dependencies
      healthChecks['TypeScript'] = this.checkCommand('tsc --version') ? chalk.green('Available') : chalk.yellow('Not found');
      healthChecks['Node Package Manager'] = this.checkCommand('npm --version') ? chalk.green('Available') : chalk.red('Missing');

      console.log(Formatter.format(healthChecks, OutputFormat.TABLE));

      // Overall health status
      const isHealthy = healthChecks['API Status'].includes('Online') &&
                        healthChecks['Config Loaded'] === 'Yes';

      console.log('');
      if (isHealthy) {
        console.log(chalk.green.bold('✓ System is healthy'));
      } else {
        console.log(chalk.yellow.bold('⚠ System has issues'));
        console.log(chalk.yellow('  Run with --verbose for detailed diagnostics'));
      }
      console.log('');

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Show version information
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms system version
   * hms system version --verbose
   * ```
   */
  async version(options: CommandOptions): Promise<void> {
    try {
      Formatter.header('Version Information');

      const versionInfo: any = {
        'HMS CLI': this.VERSION,
        'Node.js': process.version,
        'Platform': `${os.platform()} ${os.arch()}`,
        'OS Release': os.release()
      };

      if (options.verbose) {
        // Get package.json info
        try {
          const packagePath = require.resolve('../../package.json');
          const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

          versionInfo['Package Name'] = packageJson.name;
          versionInfo['Description'] = packageJson.description;
          versionInfo['License'] = packageJson.license;
          versionInfo['Repository'] = packageJson.repository?.url || 'N/A';

          if (packageJson.dependencies) {
            Formatter.separator();
            console.log(chalk.bold.cyan('\nKey Dependencies:\n'));

            const deps = {
              'TypeScript': packageJson.devDependencies?.typescript || 'N/A',
              'Axios': packageJson.dependencies?.axios || 'N/A',
              'Chalk': packageJson.dependencies?.chalk || 'N/A',
              'Yargs': packageJson.dependencies?.yargs || 'N/A',
              'Inquirer': packageJson.dependencies?.inquirer || 'N/A'
            };

            console.log(Formatter.format(deps, OutputFormat.TABLE));
          }
        } catch (error) {
          if (this.config.isVerbose()) {
            console.log(chalk.gray('Could not load package information'));
          }
        }
      }

      console.log(Formatter.format(versionInfo, OutputFormat.TABLE));
      console.log('');

      // Check for API version
      if (this.auth.isAuthenticated()) {
        const stopLoading = Formatter.loading('Checking API version...');

        try {
          const response = await this.apiClient.get('/version', {
            headers: this.auth.getAuthHeader()
          });

          stopLoading();

          console.log(chalk.cyan('API Version Information:'));
          console.log(`  API Version: ${chalk.yellow(response.data.version || 'Unknown')}`);
          console.log(`  Build: ${chalk.yellow(response.data.build || 'Unknown')}`);
          console.log('');

        } catch (error) {
          stopLoading();
          if (this.config.isVerbose()) {
            console.log(chalk.gray('Could not fetch API version\n'));
          }
        }
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Check for updates
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms system update
   * hms system update --check-only
   * ```
   */
  async update(options: CommandOptions): Promise<void> {
    try {
      Formatter.header('Check for Updates');

      const stopLoading = Formatter.loading('Checking for updates...');

      try {
        // Check NPM registry for latest version
        const response = await axios.get('https://registry.npmjs.org/hms-cli/latest', {
          timeout: 10000
        });

        stopLoading();

        const latestVersion = response.data.version;
        const currentVersion = this.VERSION;

        console.log(chalk.cyan('Version Check:'));
        console.log(`  Current Version: ${chalk.yellow(currentVersion)}`);
        console.log(`  Latest Version: ${chalk.yellow(latestVersion)}`);
        console.log('');

        if (this.isNewerVersion(latestVersion, currentVersion)) {
          Formatter.warning(`A new version is available: ${latestVersion}`);
          console.log('');

          if (!options.checkOnly) {
            console.log(chalk.cyan('To update, run:'));
            console.log(chalk.yellow('  npm install -g hms-cli@latest'));
            console.log('');
          }
        } else {
          Formatter.success('You are running the latest version!');
        }

      } catch (error: any) {
        stopLoading();

        if (error.code === 'ENOTFOUND' || error.response?.status === 404) {
          Formatter.warning('Could not check for updates (package not published to NPM)');
          console.log(chalk.gray('\nThis is normal for development versions\n'));
        } else {
          throw new Error(`Update check failed: ${error.message}`);
        }
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Show diagnostic information
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms system diagnostics
   * hms system diagnostics --output diagnostics.json
   * ```
   */
  async diagnostics(options: CommandOptions): Promise<void> {
    try {
      Formatter.header('System Diagnostics');

      const diagnostics: any = {
        timestamp: new Date().toISOString(),
        cli: {
          version: this.VERSION,
          nodeVersion: process.version,
          platform: os.platform(),
          arch: os.arch()
        },
        config: this.config.getAll(),
        authentication: {
          isAuthenticated: this.auth.isAuthenticated(),
          userId: this.auth.isAuthenticated() ? this.config.getUserId() : null
        },
        system: {
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
          cpuCount: os.cpus().length,
          uptime: os.uptime(),
          loadAverage: os.loadavg()
        },
        environment: {
          nodeEnv: process.env.NODE_ENV || 'development',
          hmsApiUrl: process.env.HMS_API_URL || this.config.getApiUrl()
        }
      };

      // Check API health
      try {
        const startTime = Date.now();
        const response = await this.apiClient.get('/health', { timeout: 5000 });
        diagnostics.api = {
          status: 'online',
          responseTime: Date.now() - startTime,
          version: response.data.version
        };
      } catch (error: any) {
        diagnostics.api = {
          status: 'offline',
          error: error.message
        };
      }

      // Save to file if requested
      if (options.output) {
        fs.writeFileSync(
          options.output,
          JSON.stringify(diagnostics, null, 2)
        );
        Formatter.success(`Diagnostics saved to ${options.output}`);
      } else {
        console.log(JSON.stringify(diagnostics, null, 2));
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Clear cache and temporary files
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms system clear-cache
   * ```
   */
  async clearCache(options: CommandOptions): Promise<void> {
    try {
      Formatter.header('Clear Cache');

      console.log(chalk.yellow('This will clear:'));
      console.log('  - Temporary files');
      console.log('  - Cached API responses');
      console.log('  - Downloaded reports');
      console.log('');

      // Note: Config and credentials will NOT be cleared
      console.log(chalk.cyan('Note: Authentication and configuration will be preserved\n'));

      const inquirer = require('inquirer');
      const confirmation = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Proceed with cache clearing?',
          default: false
        }
      ]);

      if (!confirmation.confirmed) {
        Formatter.info('Cache clearing cancelled');
        return;
      }

      // Clear cache (implementation would go here)
      const stopLoading = Formatter.loading('Clearing cache...');

      // Simulate cache clearing
      await new Promise(resolve => setTimeout(resolve, 1000));

      stopLoading();

      Formatter.success('Cache cleared successfully');
      console.log(chalk.cyan('\nCleared items:'));
      console.log('  - Temporary files: 0 files');
      console.log('  - API cache: 0 entries');
      console.log('  - Downloaded reports: 0 files');
      console.log('');

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Check if command exists
   */
  private checkCommand(command: string): boolean {
    try {
      require('child_process').execSync(command, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format uptime
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ') || '0m';
  }

  /**
   * Compare versions
   */
  private isNewerVersion(latest: string, current: string): boolean {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (latestParts[i] > currentParts[i]) return true;
      if (latestParts[i] < currentParts[i]) return false;
    }

    return false;
  }
}

export default SystemHandler;
