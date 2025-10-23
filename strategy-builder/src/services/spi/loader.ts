/**
 * Email-based SPI Loader
 * Self-generates Service Providers from user email addresses
 */

import {
  ServiceProvider,
  SPIConfiguration,
  EmailSPIIdentifier,
  SPIGeneratorConfig,
  HealthStatus,
  ServiceMetadata,
  SPIResponse
} from './types';
import { SPIRegistry } from './registry';
import { logger } from '../../utils/logger';

/**
 * Base Service Provider Class
 * Implements common functionality for all service providers
 */
export abstract class BaseServiceProvider implements ServiceProvider {
  public name: string;
  public version: string;
  public description: string;
  public email: string;
  public capabilities: string[] = [];

  protected startTime: Date = new Date();
  protected requestCount: number = 0;
  protected errorCount: number = 0;
  protected initialized: boolean = false;

  constructor(protected config: SPIConfiguration) {
    this.name = config.name;
    this.version = config.version;
    this.description = config.description;
    this.email = config.email;
    this.capabilities = config.capabilities || [];
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    logger.info(`Service initialized: ${this.name}`);
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
    logger.info(`Service shutdown: ${this.name}`);
  }

  async health(): Promise<HealthStatus> {
    const uptime = Date.now() - this.startTime.getTime();

    return {
      status: this.initialized ? 'healthy' : 'unhealthy',
      message: `Service is ${this.initialized ? 'operational' : 'not operational'}`,
      timestamp: new Date(),
      uptime,
      metrics: {
        requestsProcessed: this.requestCount,
        errorsEncountered: this.errorCount,
        averageResponseTime: this.requestCount > 0 ? uptime / this.requestCount : 0
      }
    };
  }

  getMetadata(): ServiceMetadata {
    return {
      id: this.email,
      email: this.email,
      name: this.name,
      version: this.version,
      description: this.description,
      capabilities: this.capabilities,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: this.initialized,
      supportedEndpoints: [],
      configuration: this.config.config || {}
    };
  }

  protected incrementRequestCount(): void {
    this.requestCount++;
  }

  protected incrementErrorCount(): void {
    this.errorCount++;
  }
}

/**
 * Auto-Generated Email SPI Provider
 * Automatically generated from user email
 */
export class EmailSPIProvider extends BaseServiceProvider {
  private emailIdentifier: EmailSPIIdentifier;
  private generatorConfig: SPIGeneratorConfig;

  constructor(
    config: SPIConfiguration,
    generatorConfig?: Partial<SPIGeneratorConfig>
  ) {
    super(config);

    this.emailIdentifier = this.parseEmail(config.email);

    this.generatorConfig = {
      autoGenerate: true,
      nameTemplate: '{localPart}-service',
      versionTemplate: '1.0.0',
      capabilityPattern: 'email:*',
      ...generatorConfig
    };

    // Auto-generate name if not provided
    if (!config.name) {
      this.name = this.generateName();
    }

    // Auto-generate capabilities if not provided
    if (!config.capabilities || config.capabilities.length === 0) {
      this.capabilities = this.generateCapabilities();
    }
  }

  /**
   * Parse email into components
   */
  private parseEmail(email: string): EmailSPIIdentifier {
    const [localPart, domain] = email.split('@');
    return {
      email,
      domain: domain || '',
      localPart: localPart || ''
    };
  }

  /**
   * Generate service name from email
   */
  private generateName(): string {
    return this.generatorConfig.nameTemplate
      .replace('{localPart}', this.emailIdentifier.localPart)
      .replace('{domain}', this.emailIdentifier.domain);
  }

  /**
   * Generate capabilities from email domain
   */
  private generateCapabilities(): string[] {
    const baseCapabilities = [
      `email:${this.emailIdentifier.email}`,
      `domain:${this.emailIdentifier.domain}`,
      `user:${this.emailIdentifier.localPart}`
    ];

    // Add standard capabilities
    const standardCapabilities = [
      'service:read',
      'service:execute',
      'service:health',
      'service:metadata'
    ];

    return [...baseCapabilities, ...standardCapabilities];
  }

  /**
   * Get email identifier
   */
  getEmailIdentifier(): EmailSPIIdentifier {
    return this.emailIdentifier;
  }

  /**
   * Check if email matches pattern
   */
  matchesEmailPattern(pattern: string): boolean {
    const regex = new RegExp(pattern);
    return regex.test(this.emailIdentifier.email);
  }
}

/**
 * SPI Loader
 * Loads and manages email-based service providers
 */
export class SPILoader {
  private generatorConfig: SPIGeneratorConfig = {
    autoGenerate: true,
    nameTemplate: '{localPart}-service',
    versionTemplate: '1.0.0',
    capabilityPattern: 'email:*'
  };

  constructor(
    private registry: SPIRegistry,
    generatorConfig?: Partial<SPIGeneratorConfig>
  ) {
    this.generatorConfig = { ...this.generatorConfig, ...generatorConfig };
  }

  /**
   * Load or generate SPI from user email
   */
  async loadFromEmail(
    email: string,
    config?: Partial<SPIConfiguration>
  ): Promise<EmailSPIProvider> {
    try {
      // Check if already registered
      const existing = this.registry.getService(email);
      if (existing && existing.provider instanceof EmailSPIProvider) {
        logger.info(`Service already exists for email: ${email}`);
        return existing.provider;
      }

      // Create configuration
      const spiConfig: SPIConfiguration = {
        email,
        name: config?.name || this.generateServiceName(email),
        description: config?.description || `Auto-generated service for ${email}`,
        version: config?.version || this.generatorConfig.versionTemplate,
        capabilities: config?.capabilities || this.generateCapabilities(email),
        config: config?.config,
        metadata: config?.metadata
      };

      // Create provider
      const provider = new EmailSPIProvider(spiConfig, this.generatorConfig);

      // Register in registry
      await this.registry.registerService(provider, spiConfig);

      logger.info(`SPI loaded for email: ${email}`);

      return provider;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load SPI from email ${email}: ${message}`);
      throw error;
    }
  }

  /**
   * Load multiple SPIs from email list
   */
  async loadMultiple(emails: string[]): Promise<EmailSPIProvider[]> {
    const providers: EmailSPIProvider[] = [];

    for (const email of emails) {
      try {
        const provider = await this.loadFromEmail(email);
        providers.push(provider);
      } catch (error) {
        logger.error(
          `Failed to load SPI for ${email}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return providers;
  }

  /**
   * Generate service name from email
   */
  private generateServiceName(email: string): string {
    const localPart = email.split('@')[0];
    return this.generatorConfig.nameTemplate.replace('{localPart}', localPart);
  }

  /**
   * Generate capabilities from email
   */
  private generateCapabilities(email: string): string[] {
    const [localPart, domain] = email.split('@');
    return [
      `email:${email}`,
      `domain:${domain}`,
      `user:${localPart}`,
      'service:read',
      'service:execute',
      'service:health',
      'service:metadata'
    ];
  }

  /**
   * Update generator configuration
   */
  setGeneratorConfig(config: Partial<SPIGeneratorConfig>): void {
    this.generatorConfig = { ...this.generatorConfig, ...config };
  }

  /**
   * Get generator configuration
   */
  getGeneratorConfig(): SPIGeneratorConfig {
    return { ...this.generatorConfig };
  }
}

/**
 * Email SPI Factory
 * Factory function to create email-based SPIs
 */
export function createEmailSPIFactory(
  registry: SPIRegistry,
  generatorConfig?: Partial<SPIGeneratorConfig>
): (email: string, config?: Partial<SPIConfiguration>) => Promise<EmailSPIProvider> {
  const loader = new SPILoader(registry, generatorConfig);

  return async (
    email: string,
    config?: Partial<SPIConfiguration>
  ): Promise<EmailSPIProvider> => {
    return loader.loadFromEmail(email, config);
  };
}

/**
 * Create a demo SPI for testing
 */
export class DemoEmailSPIProvider extends EmailSPIProvider {
  private responseCache: Map<string, unknown> = new Map();

  async initialize(): Promise<void> {
    await super.initialize();
    logger.info(`Demo SPI initialized for: ${this.email}`);
  }

  /**
   * Execute a service operation
   */
  async execute(
    operation: string,
    params?: Record<string, unknown>
  ): Promise<SPIResponse> {
    try {
      this.incrementRequestCount();

      // Simulate some processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = {
        success: true,
        data: {
          operation,
          params,
          email: this.email,
          timestamp: new Date().toISOString()
        },
        metadata: {
          serviceEmail: this.email,
          processingTime: 100,
          timestamp: new Date()
        }
      };

      // Cache result
      this.responseCache.set(operation, result);

      return result;
    } catch (error) {
      this.incrementErrorCount();
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Get cached response
   */
  getCachedResponse(operation: string): unknown | undefined {
    return this.responseCache.get(operation);
  }
}
