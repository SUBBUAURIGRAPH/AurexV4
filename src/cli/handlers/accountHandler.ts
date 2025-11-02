/**
 * Account Command Handler
 * Handles account management and authentication operations
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios';
import * as chalk from 'chalk';
import * as inquirer from 'inquirer';
import { CommandOptions, AccountInfo, OutputFormat } from '../types';
import Formatter from '../utils/formatter';
import Validator from '../utils/validator';
import ConfigManager from '../utils/config';
import AuthManager from '../utils/auth';

/**
 * Account Handler Class
 * Manages authentication, configuration, and account operations
 *
 * @example
 * ```bash
 * # Login to account
 * hms account login
 *
 * # Show account status
 * hms account status
 *
 * # Update configuration
 * hms account config --set apiUrl=https://api.hms.aurex.in
 * ```
 */
export class AccountHandler {
  private config = ConfigManager.getInstance();
  private auth = AuthManager.getInstance();
  private apiClient: AxiosInstance;

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
   * Handle login command
   * Authenticates user and stores credentials
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms account login --email user@example.com
   * hms account login --apiKey YOUR_API_KEY
   * ```
   */
  async login(options: CommandOptions): Promise<void> {
    try {
      Formatter.header('HMS Account Login');

      let authMethod: string;
      let credentials: any = {};

      // Check if API key provided
      if (options.apiKey) {
        authMethod = 'apikey';
        credentials.apiKey = options.apiKey;
      } else {
        // Interactive login
        const answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'method',
            message: 'Select authentication method:',
            choices: ['API Key', 'Email/Password'],
            default: 'API Key'
          }
        ]);

        authMethod = answers.method === 'API Key' ? 'apikey' : 'password';

        if (authMethod === 'apikey') {
          const keyAnswer = await inquirer.prompt([
            {
              type: 'password',
              name: 'apiKey',
              message: 'Enter your API Key:',
              mask: '*',
              validate: (input) => input.length >= 32 || 'API key must be at least 32 characters'
            }
          ]);
          credentials.apiKey = keyAnswer.apiKey;
        } else {
          const credAnswers = await inquirer.prompt([
            {
              type: 'input',
              name: 'email',
              message: 'Email:',
              validate: (input) => {
                try {
                  Validator.validateEmail(input);
                  return true;
                } catch {
                  return 'Invalid email format';
                }
              }
            },
            {
              type: 'password',
              name: 'password',
              message: 'Password:',
              mask: '*'
            }
          ]);
          credentials = credAnswers;
        }
      }

      // Authenticate with API
      const stopLoading = Formatter.loading('Authenticating...');

      try {
        const response = await this.apiClient.post('/auth/login', credentials);
        stopLoading();

        if (response.data.success) {
          const { token, refreshToken, user } = response.data.data;

          // Store credentials
          if (authMethod === 'apikey') {
            this.auth.setApiKey(credentials.apiKey, user.userId);
          } else {
            this.auth.setAccessToken(token, refreshToken, new Date(Date.now() + 3600000));
          }

          this.config.setUserId(user.userId);

          Formatter.success('Login successful!');
          console.log(chalk.cyan('\nAccount Details:'));
          console.log(`  User ID: ${chalk.yellow(user.userId)}`);
          console.log(`  Email: ${chalk.yellow(user.email)}`);
          console.log(`  Account Type: ${chalk.yellow(user.accountType)}`);
          console.log('');
        } else {
          throw new Error(response.data.message || 'Login failed');
        }
      } catch (error: any) {
        stopLoading();
        if (error.response?.status === 401) {
          throw new Error('Invalid credentials. Please check your API key or email/password.');
        }
        throw error;
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message, 'Please verify your credentials and try again');
      }
      throw error;
    }
  }

  /**
   * Handle status command
   * Shows current account status and authentication state
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms account status
   * hms account status --format json
   * ```
   */
  async status(options: CommandOptions): Promise<void> {
    try {
      Formatter.header('Account Status');

      if (!this.auth.isAuthenticated()) {
        Formatter.warning('Not logged in');
        console.log(chalk.yellow('\nUse "hms account login" to authenticate\n'));
        return;
      }

      const stopLoading = Formatter.loading('Fetching account information...');

      try {
        const response = await this.apiClient.get('/account/status', {
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const accountInfo: AccountInfo = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.JSON) {
          console.log(JSON.stringify(accountInfo, null, 2));
        } else if (format === OutputFormat.TABLE) {
          const statusData = {
            'User ID': accountInfo.userId,
            'Email': accountInfo.email,
            'Username': accountInfo.username,
            'Account Type': accountInfo.accountType.toUpperCase(),
            'Status': accountInfo.accountStatus.toUpperCase(),
            'Created': new Date(accountInfo.createdAt).toLocaleDateString(),
            'Last Login': accountInfo.lastLoginAt
              ? new Date(accountInfo.lastLoginAt).toLocaleString()
              : 'Never',
            'API Keys': accountInfo.apiKeysCount,
            '2FA Enabled': accountInfo.twoFactorEnabled ? 'Yes' : 'No'
          };

          console.log(Formatter.format(statusData, OutputFormat.TABLE));
        } else {
          console.log(Formatter.format(accountInfo, format));
        }

      } catch (error: any) {
        stopLoading();
        if (error.response?.status === 401) {
          Formatter.error('Session expired', 'Please login again');
          this.auth.clearCredentials();
        } else {
          throw error;
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
   * Handle config command
   * Manage account configuration settings
   *
   * @param options - Command options
   * @example
   * ```bash
   * # Show configuration
   * hms account config
   *
   * # Set configuration
   * hms account config --set apiUrl=https://api.hms.aurex.in
   * hms account config --set outputFormat=json
   *
   * # Reset configuration
   * hms account config --reset
   * ```
   */
  async config(options: CommandOptions): Promise<void> {
    try {
      Formatter.header('Account Configuration');

      // Reset configuration
      if (options.reset) {
        const confirmation = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: 'Reset all configuration to defaults?',
            default: false
          }
        ]);

        if (confirmation.confirmed) {
          this.config.reset();
          Formatter.success('Configuration reset to defaults');
        }
        return;
      }

      // Set configuration value
      if (options.set) {
        const [key, value] = String(options.set).split('=');

        if (!key || !value) {
          throw new Error('Invalid format. Use: --set key=value');
        }

        // Validate known keys
        const validKeys = ['apiUrl', 'outputFormat', 'verbose', 'userId'];
        if (!validKeys.includes(key)) {
          throw new Error(`Unknown configuration key: ${key}. Valid keys: ${validKeys.join(', ')}`);
        }

        // Update configuration
        if (key === 'apiUrl') {
          this.config.set('apiUrl', value);
        } else if (key === 'outputFormat') {
          if (!['table', 'json', 'csv', 'yaml'].includes(value)) {
            throw new Error('Invalid output format. Use: table, json, csv, or yaml');
          }
          this.config.setOutputFormat(value as any);
        } else if (key === 'verbose') {
          this.config.setVerbose(value === 'true');
        } else if (key === 'userId') {
          this.config.setUserId(value);
        }

        Formatter.success(`Updated ${key} to ${value}`);
        return;
      }

      // Show current configuration
      const configData = this.config.getAll();
      const format = (options.format as OutputFormat) || OutputFormat.TABLE;

      console.log(Formatter.format(configData, format));
      console.log('');
      console.log(chalk.gray('Use --set key=value to update configuration'));
      console.log(chalk.gray('Use --reset to restore defaults'));
      console.log('');

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Handle logout command
   * Logs out user and clears stored credentials
   *
   * @param options - Command options
   * @example
   * ```bash
   * # Logout current user
   * hms account logout
   *
   * # Logout all users
   * hms account logout --all
   * ```
   */
  async logout(options: CommandOptions): Promise<void> {
    try {
      Formatter.header('Logout');

      if (!this.auth.isAuthenticated()) {
        Formatter.warning('Already logged out');
        return;
      }

      // Confirm logout
      const confirmation = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: options.all
            ? 'Logout all users and clear all credentials?'
            : 'Logout current user?',
          default: false
        }
      ]);

      if (!confirmation.confirmed) {
        Formatter.info('Logout cancelled');
        return;
      }

      // Notify server (optional)
      try {
        await this.apiClient.post('/auth/logout', {}, {
          headers: this.auth.getAuthHeader()
        });
      } catch (error) {
        // Ignore errors - still clear local credentials
        if (this.config.isVerbose()) {
          console.log(chalk.gray('Note: Could not notify server of logout'));
        }
      }

      // Clear credentials
      if (options.all) {
        this.auth.clearAll();
        Formatter.success('Logged out all users');
      } else {
        this.auth.clearCredentials();
        Formatter.success('Logged out successfully');
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Update API client base URL
   */
  private updateApiClient(): void {
    this.apiClient.defaults.baseURL = this.config.getApiUrl();
  }
}

export default AccountHandler;
