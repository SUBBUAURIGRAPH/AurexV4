/**
 * Configuration Management Utilities
 * Manage CLI configuration files
 * @version 1.0.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CLIConfig } from '../types';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Partial<CLIConfig> = {};
  private configPath: string;

  private constructor() {
    this.configPath = path.join(os.homedir(), '.hms', 'config.json');
    this.loadConfig();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from file
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(data);
      } else {
        this.initializeDefaultConfig();
      }
    } catch (error) {
      console.warn('Failed to load config, using defaults');
      this.initializeDefaultConfig();
    }
  }

  /**
   * Initialize default configuration
   */
  private initializeDefaultConfig(): void {
    this.config = {
      apiUrl: process.env.HMS_API_URL || 'https://api.hms.aurex.in',
      userId: 'default-user',
      outputFormat: 'table',
      verbose: false,
      configPath: this.configPath,
      credentialsPath: path.join(os.homedir(), '.hms', 'credentials.json')
    };
  }

  /**
   * Get configuration value
   */
  get<K extends keyof CLIConfig>(key: K, defaultValue?: CLIConfig[K]): CLIConfig[K] {
    return (this.config[key] ?? defaultValue) as CLIConfig[K];
  }

  /**
   * Set configuration value
   */
  set<K extends keyof CLIConfig>(key: K, value: CLIConfig[K]): void {
    this.config[key] = value;
    this.saveConfig();
  }

  /**
   * Get all configuration
   */
  getAll(): Partial<CLIConfig> {
    return { ...this.config };
  }

  /**
   * Update multiple values
   */
  update(updates: Partial<CLIConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  /**
   * Save configuration to file
   */
  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filteredConfig = {
        apiUrl: this.config.apiUrl,
        userId: this.config.userId,
        outputFormat: this.config.outputFormat,
        verbose: this.config.verbose
      };

      fs.writeFileSync(this.configPath, JSON.stringify(filteredConfig, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.initializeDefaultConfig();
    this.saveConfig();
  }

  /**
   * Get API URL
   */
  getApiUrl(): string {
    return this.get('apiUrl', 'https://api.hms.aurex.in');
  }

  /**
   * Get API key from environment or credentials
   */
  getApiKey(): string | undefined {
    return this.config.apiKey || process.env.HMS_API_KEY;
  }

  /**
   * Set API key
   */
  setApiKey(key: string): void {
    this.config.apiKey = key;
    // Don't save API key to config file - store in credentials
  }

  /**
   * Get output format
   */
  getOutputFormat(): 'table' | 'json' | 'csv' | 'yaml' {
    return this.get('outputFormat', 'table');
  }

  /**
   * Set output format
   */
  setOutputFormat(format: 'table' | 'json' | 'csv' | 'yaml'): void {
    this.set('outputFormat', format);
  }

  /**
   * Get verbose flag
   */
  isVerbose(): boolean {
    return this.get('verbose', false);
  }

  /**
   * Set verbose flag
   */
  setVerbose(verbose: boolean): void {
    this.set('verbose', verbose);
  }

  /**
   * Get user ID
   */
  getUserId(): string {
    return this.get('userId', 'default-user');
  }

  /**
   * Set user ID
   */
  setUserId(userId: string): void {
    this.set('userId', userId);
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Delete configuration file
   */
  deleteConfigFile(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
      }
      this.initializeDefaultConfig();
    } catch (error) {
      console.error('Failed to delete config file:', error);
    }
  }
}

export default ConfigManager;
