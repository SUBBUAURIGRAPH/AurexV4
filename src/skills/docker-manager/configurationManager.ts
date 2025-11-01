/**
 * Configuration Manager - Centralized Configuration & Secret Management
 * Manages application configurations, secrets with encryption, and hot updates
 *
 * @module docker-manager/configurationManager
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as Logger from 'winston';

/**
 * Configuration version entry
 */
interface ConfigVersion {
  id: string;
  configId: string;
  version: number;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  description: string;
}

/**
 * Configuration entry
 */
interface ConfigEntry {
  id: string;
  name: string;
  description: string;
  isSecret: boolean;
  data: Record<string, any>;
  encrypted: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lastModifiedBy: string;
  tags: string[];
  metadata: Record<string, any>;
}

/**
 * Configuration update event
 */
interface ConfigUpdateEvent {
  configId: string;
  configName: string;
  previousVersion: number;
  newVersion: number;
  updatedAt: Date;
  updatedBy: string;
  changesSummary: string;
}

/**
 * ConfigurationManager - Centralized configuration and secret management
 * Provides configuration versioning, encryption, and hot updates
 */
export class ConfigurationManager extends EventEmitter {
  private logger: Logger.Logger;
  private configurations: Map<string, ConfigEntry> = new Map();
  private versions: Map<string, ConfigVersion[]> = new Map();
  private encryptionKey: Buffer;
  private updateSubscriptions: Map<string, Set<Function>> = new Map();

  /**
   * Creates a new ConfigurationManager instance
   *
   * @param logger - Winston logger instance
   * @param encryptionKey - 32-byte encryption key for AES-256-GCM (auto-generated if not provided)
   */
  constructor(logger: Logger.Logger, encryptionKey?: Buffer) {
    super();
    this.logger = logger;

    // Use provided key or generate a new one
    if (encryptionKey && encryptionKey.length === 32) {
      this.encryptionKey = encryptionKey;
    } else {
      this.encryptionKey = crypto.randomBytes(32);
      this.logger.warn('No encryption key provided, generated random key. Use exportEncryptionKey() to persist.');
    }
  }

  /**
   * Create or update a configuration
   *
   * @param name - Configuration name
   * @param data - Configuration data
   * @param options - Creation options
   * @returns Configuration ID
   */
  async setConfiguration(
    name: string,
    data: Record<string, any>,
    options: {
      description?: string;
      isSecret?: boolean;
      tags?: string[];
      metadata?: Record<string, any>;
      createdBy?: string;
    } = {}
  ): Promise<string> {
    try {
      const configId = `config-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      const existingConfig = Array.from(this.configurations.values()).find((c) => c.name === name);

      let config: ConfigEntry;

      if (existingConfig) {
        // Update existing configuration
        config = {
          ...existingConfig,
          data: options.isSecret ? this.encryptData(data) : data,
          encrypted: options.isSecret || false,
          version: existingConfig.version + 1,
          updatedAt: new Date(),
          lastModifiedBy: options.createdBy || 'system',
          description: options.description || existingConfig.description,
          tags: options.tags || existingConfig.tags,
          metadata: options.metadata || existingConfig.metadata,
        };

        // Record version
        this.recordVersion(existingConfig.id, config.version, config.data, options.createdBy || 'system');
      } else {
        // Create new configuration
        config = {
          id: configId,
          name,
          description: options.description || '',
          isSecret: options.isSecret || false,
          data: options.isSecret ? this.encryptData(data) : data,
          encrypted: options.isSecret || false,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastModifiedBy: options.createdBy || 'system',
          tags: options.tags || [],
          metadata: options.metadata || {},
        };

        // Initialize version history
        if (!this.versions.has(configId)) {
          this.versions.set(configId, []);
        }

        // Record initial version
        this.recordVersion(configId, 1, config.data, options.createdBy || 'system');
      }

      this.configurations.set(config.id, config);

      this.logger.info(`Configuration set: ${name} (v${config.version})`);

      // Notify subscribers
      this.notifySubscribers(config.id, {
        configId: config.id,
        configName: name,
        previousVersion: config.version - 1,
        newVersion: config.version,
        updatedAt: config.updatedAt,
        updatedBy: config.lastModifiedBy,
        changesSummary: `Updated configuration ${name}`,
      });

      this.emit('configuration-updated', {
        configId: config.id,
        name,
        version: config.version,
      });

      return config.id;
    } catch (error) {
      this.logger.error(`Failed to set configuration: ${name}`, error);
      throw new Error(`Failed to set configuration: ${error.message}`);
    }
  }

  /**
   * Get a configuration
   *
   * @param configIdOrName - Configuration ID or name
   * @param decrypt - Whether to decrypt if secret (default: true)
   * @returns Configuration data
   */
  async getConfiguration(configIdOrName: string, decrypt: boolean = true): Promise<Record<string, any> | null> {
    try {
      let config = this.configurations.get(configIdOrName);

      // Try to find by name if not found by ID
      if (!config) {
        config = Array.from(this.configurations.values()).find((c) => c.name === configIdOrName);
      }

      if (!config) {
        this.logger.warn(`Configuration not found: ${configIdOrName}`);
        return null;
      }

      // Decrypt if needed
      if (config.encrypted && decrypt) {
        return this.decryptData(config.data);
      }

      return config.data;
    } catch (error) {
      this.logger.error(`Failed to get configuration: ${configIdOrName}`, error);
      throw new Error(`Failed to get configuration: ${error.message}`);
    }
  }

  /**
   * Get all configurations with optional filtering
   *
   * @param options - Filter options
   * @returns Array of configurations
   */
  async listConfigurations(options?: {
    includeSecrets?: boolean;
    tags?: string[];
    namePattern?: string;
  }): Promise<ConfigEntry[]> {
    let configs = Array.from(this.configurations.values());

    if (!options?.includeSecrets) {
      configs = configs.filter((c) => !c.isSecret);
    }

    if (options?.tags && options.tags.length > 0) {
      configs = configs.filter((c) => options.tags!.some((tag) => c.tags.includes(tag)));
    }

    if (options?.namePattern) {
      const regex = new RegExp(options.namePattern, 'i');
      configs = configs.filter((c) => regex.test(c.name));
    }

    return configs;
  }

  /**
   * Delete a configuration
   *
   * @param configIdOrName - Configuration ID or name
   */
  async deleteConfiguration(configIdOrName: string): Promise<void> {
    try {
      let configId = configIdOrName;

      // Find by name if needed
      if (!this.configurations.has(configId)) {
        const config = Array.from(this.configurations.values()).find((c) => c.name === configIdOrName);
        if (!config) {
          throw new Error(`Configuration not found: ${configIdOrName}`);
        }
        configId = config.id;
      }

      this.configurations.delete(configId);
      this.versions.delete(configId);
      this.updateSubscriptions.delete(configId);

      this.logger.info(`Configuration deleted: ${configId}`);

      this.emit('configuration-deleted', { configId });
    } catch (error) {
      this.logger.error(`Failed to delete configuration: ${configIdOrName}`, error);
      throw new Error(`Failed to delete configuration: ${error.message}`);
    }
  }

  /**
   * Get configuration version history
   *
   * @param configIdOrName - Configuration ID or name
   * @param limit - Maximum number of versions to return (default: 10)
   * @returns Version history
   */
  async getConfigurationHistory(configIdOrName: string, limit: number = 10): Promise<ConfigVersion[]> {
    try {
      let configId = configIdOrName;

      // Find by name if needed
      if (!this.configurations.has(configId)) {
        const config = Array.from(this.configurations.values()).find((c) => c.name === configIdOrName);
        if (!config) {
          return [];
        }
        configId = config.id;
      }

      const versions = this.versions.get(configId) || [];
      return versions.slice(-limit);
    } catch (error) {
      this.logger.error(`Failed to get configuration history: ${configIdOrName}`, error);
      return [];
    }
  }

  /**
   * Restore configuration to a specific version
   *
   * @param configIdOrName - Configuration ID or name
   * @param version - Version number to restore
   * @param restoredBy - User performing the restoration
   */
  async restoreConfigurationVersion(
    configIdOrName: string,
    version: number,
    restoredBy: string = 'system'
  ): Promise<void> {
    try {
      let config = this.configurations.get(configIdOrName);

      // Find by name if needed
      if (!config) {
        config = Array.from(this.configurations.values()).find((c) => c.name === configIdOrName);
      }

      if (!config) {
        throw new Error(`Configuration not found: ${configIdOrName}`);
      }

      const versions = this.versions.get(config.id) || [];
      const targetVersion = versions.find((v) => v.version === version);

      if (!targetVersion) {
        throw new Error(`Version ${version} not found for configuration ${config.name}`);
      }

      // Update configuration with restored data
      const updatedConfig: ConfigEntry = {
        ...config,
        data: targetVersion.data,
        version: config.version + 1,
        updatedAt: new Date(),
        lastModifiedBy: restoredBy,
      };

      this.configurations.set(config.id, updatedConfig);
      this.recordVersion(config.id, updatedConfig.version, updatedConfig.data, restoredBy);

      this.logger.info(`Configuration ${config.name} restored to version ${version}`);

      this.notifySubscribers(config.id, {
        configId: config.id,
        configName: config.name,
        previousVersion: config.version,
        newVersion: updatedConfig.version,
        updatedAt: updatedConfig.updatedAt,
        updatedBy: restoredBy,
        changesSummary: `Restored to version ${version}`,
      });

      this.emit('configuration-restored', {
        configId: config.id,
        name: config.name,
        restoredToVersion: version,
        newVersion: updatedConfig.version,
      });
    } catch (error) {
      this.logger.error(`Failed to restore configuration version`, error);
      throw new Error(`Failed to restore configuration: ${error.message}`);
    }
  }

  /**
   * Subscribe to configuration updates
   *
   * @param configIdOrName - Configuration ID or name to watch
   * @param callback - Callback function for updates
   * @returns Unsubscribe function
   */
  async subscribeToUpdates(
    configIdOrName: string,
    callback: (event: ConfigUpdateEvent) => void
  ): Promise<() => void> {
    try {
      let configId = configIdOrName;

      // Find by name if needed
      if (!this.configurations.has(configId)) {
        const config = Array.from(this.configurations.values()).find((c) => c.name === configIdOrName);
        if (!config) {
          throw new Error(`Configuration not found: ${configIdOrName}`);
        }
        configId = config.id;
      }

      if (!this.updateSubscriptions.has(configId)) {
        this.updateSubscriptions.set(configId, new Set());
      }

      this.updateSubscriptions.get(configId)!.add(callback);

      // Return unsubscribe function
      return () => {
        this.updateSubscriptions.get(configId)?.delete(callback);
      };
    } catch (error) {
      this.logger.error(`Failed to subscribe to configuration updates`, error);
      throw new Error(`Failed to subscribe: ${error.message}`);
    }
  }

  /**
   * Export encryption key for backup/sharing
   *
   * @returns Base64-encoded encryption key
   */
  exportEncryptionKey(): string {
    return this.encryptionKey.toString('base64');
  }

  /**
   * Import encryption key
   *
   * @param keyBase64 - Base64-encoded encryption key
   */
  async importEncryptionKey(keyBase64: string): Promise<void> {
    try {
      const key = Buffer.from(keyBase64, 'base64');
      if (key.length !== 32) {
        throw new Error('Encryption key must be 32 bytes for AES-256');
      }
      this.encryptionKey = key;
      this.logger.info('Encryption key imported successfully');
    } catch (error) {
      this.logger.error('Failed to import encryption key', error);
      throw new Error(`Failed to import encryption key: ${error.message}`);
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   * @private
   */
  private encryptData(data: Record<string, any>): Record<string, any> {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

      const jsonStr = JSON.stringify(data);
      let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return {
        __encrypted: true,
        iv: iv.toString('hex'),
        data: encrypted,
        authTag: authTag.toString('hex'),
      };
    } catch (error) {
      this.logger.error('Failed to encrypt data', error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * @private
   */
  private decryptData(encryptedData: Record<string, any>): Record<string, any> {
    try {
      if (!encryptedData.__encrypted) {
        return encryptedData;
      }

      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      const encrypted = encryptedData.data;

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.error('Failed to decrypt data', error);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Record a configuration version
   * @private
   */
  private recordVersion(configId: string, version: number, data: Record<string, any>, createdBy: string): void {
    if (!this.versions.has(configId)) {
      this.versions.set(configId, []);
    }

    const versionEntry: ConfigVersion = {
      id: `${configId}-v${version}`,
      configId,
      version,
      data: JSON.parse(JSON.stringify(data)), // Deep copy
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      description: `Version ${version}`,
    };

    this.versions.get(configId)!.push(versionEntry);
  }

  /**
   * Notify subscribers of configuration updates
   * @private
   */
  private notifySubscribers(configId: string, event: ConfigUpdateEvent): void {
    const subscribers = this.updateSubscriptions.get(configId);
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          this.logger.warn('Error in configuration update subscriber', error);
        }
      });
    }
  }

  /**
   * Get configuration statistics
   *
   * @returns Configuration statistics
   */
  async getConfigurationStatistics(): Promise<{
    totalConfigurations: number;
    secretConfigurations: number;
    totalVersions: number;
    averageVersionsPerConfig: number;
  }> {
    let totalVersions = 0;
    const configs = Array.from(this.configurations.values());

    for (const config of configs) {
      const versions = this.versions.get(config.id) || [];
      totalVersions += versions.length;
    }

    return {
      totalConfigurations: configs.length,
      secretConfigurations: configs.filter((c) => c.isSecret).length,
      totalVersions,
      averageVersionsPerConfig: configs.length > 0 ? totalVersions / configs.length : 0,
    };
  }

  /**
   * Cleanup configuration manager
   */
  async cleanup(): Promise<void> {
    try {
      this.configurations.clear();
      this.versions.clear();
      this.updateSubscriptions.clear();
      this.logger.info('ConfigurationManager cleanup complete');
    } catch (error) {
      this.logger.error('Error during configuration manager cleanup', error);
    }
  }
}

export default ConfigurationManager;
