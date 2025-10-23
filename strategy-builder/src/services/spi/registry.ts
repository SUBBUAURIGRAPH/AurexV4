/**
 * SPI Registry
 * Manages registration, discovery, and lifecycle of Service Providers
 */

import { EventEmitter } from 'events';
import {
  ServiceProvider,
  SPIRegistryEntry,
  SPIConfiguration,
  ServiceMetadata,
  SPIFactory,
  SPIDiscoveryResult,
  SPIError,
  HealthStatus,
  SPIEvent,
  SPIEventListener
} from './types';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

export class SPIRegistry extends EventEmitter {
  private registry: Map<string, SPIRegistryEntry> = new Map();
  private emailIndex: Map<string, string[]> = new Map(); // email -> [service IDs]
  private factories: Map<string, SPIFactory> = new Map();
  private eventListeners: Map<string, SPIEventListener[]> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(private healthCheckIntervalMs: number = 60000) {
    super();
  }

  /**
   * Register a service provider factory
   */
  registerFactory(name: string, factory: SPIFactory): void {
    this.factories.set(name, factory);
    logger.info(`SPI Factory registered: ${name}`);
  }

  /**
   * Register a service provider instance
   */
  async registerService(
    provider: ServiceProvider,
    config?: SPIConfiguration
  ): Promise<SPIRegistryEntry> {
    try {
      // Generate unique ID based on email
      const id = this.generateServiceId(provider.email);

      // Initialize the service
      await provider.initialize();

      // Create metadata
      const metadata: ServiceMetadata = {
        id,
        email: provider.email,
        name: provider.name,
        version: provider.version,
        description: provider.description,
        capabilities: provider.capabilities,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        supportedEndpoints: [],
        configuration: config?.config || {}
      };

      // Create registry entry
      const entry: SPIRegistryEntry = {
        id,
        email: provider.email,
        provider,
        metadata,
        registeredAt: new Date()
      };

      // Store in registry
      this.registry.set(id, entry);

      // Index by email
      if (!this.emailIndex.has(provider.email)) {
        this.emailIndex.set(provider.email, []);
      }
      this.emailIndex.get(provider.email)!.push(id);

      // Emit registration event
      this.emit('service:registered', entry);

      logger.info(`Service registered: ${provider.name} (${provider.email})`);

      return entry;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to register service: ${message}`);
      throw new SPIError('REGISTRATION_FAILED', message, error);
    }
  }

  /**
   * Unregister a service provider
   */
  async unregisterService(idOrEmail: string): Promise<void> {
    try {
      let serviceIds: string[] = [];

      // Find service IDs
      if (this.registry.has(idOrEmail)) {
        serviceIds = [idOrEmail];
      } else if (this.emailIndex.has(idOrEmail)) {
        serviceIds = this.emailIndex.get(idOrEmail) || [];
      } else {
        throw new SPIError('NOT_FOUND', `Service not found: ${idOrEmail}`);
      }

      // Shutdown and remove services
      for (const id of serviceIds) {
        const entry = this.registry.get(id);
        if (entry) {
          await entry.provider.shutdown();
          this.registry.delete(id);

          // Remove from email index
          const email = entry.email;
          const emailServices = this.emailIndex.get(email) || [];
          const filtered = emailServices.filter(sid => sid !== id);
          if (filtered.length > 0) {
            this.emailIndex.set(email, filtered);
          } else {
            this.emailIndex.delete(email);
          }

          // Emit unregistration event
          this.emit('service:unregistered', entry);

          logger.info(`Service unregistered: ${entry.metadata.name}`);
        }
      }
    } catch (error) {
      if (error instanceof SPIError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to unregister service: ${message}`);
      throw new SPIError('UNREGISTRATION_FAILED', message, error);
    }
  }

  /**
   * Discover services by various criteria
   */
  async discoverServices(criteria: {
    email?: string;
    capability?: string;
    name?: string;
  }): Promise<SPIDiscoveryResult> {
    let results: SPIRegistryEntry[] = [];

    if (criteria.email) {
      // Find by email
      const serviceIds = this.emailIndex.get(criteria.email) || [];
      results = serviceIds
        .map(id => this.registry.get(id))
        .filter((entry): entry is SPIRegistryEntry => entry !== undefined);
    } else if (criteria.capability) {
      // Find by capability
      results = Array.from(this.registry.values()).filter(entry =>
        entry.provider.capabilities.includes(criteria.capability!)
      );
    } else if (criteria.name) {
      // Find by name
      results = Array.from(this.registry.values()).filter(entry =>
        entry.metadata.name.toLowerCase().includes(criteria.name!.toLowerCase())
      );
    } else {
      // Return all services
      results = Array.from(this.registry.values());
    }

    return {
      found: results.length > 0,
      services: results.filter(entry => entry.metadata.isActive),
      matchedCriteria: criteria
    };
  }

  /**
   * Get a service by ID or email
   */
  getService(idOrEmail: string): SPIRegistryEntry | undefined {
    // Try direct ID lookup first
    if (this.registry.has(idOrEmail)) {
      return this.registry.get(idOrEmail);
    }

    // Try email lookup
    const serviceIds = this.emailIndex.get(idOrEmail);
    if (serviceIds && serviceIds.length > 0) {
      return this.registry.get(serviceIds[0]);
    }

    return undefined;
  }

  /**
   * Get all services for an email
   */
  getServicesByEmail(email: string): SPIRegistryEntry[] {
    const serviceIds = this.emailIndex.get(email) || [];
    return serviceIds
      .map(id => this.registry.get(id))
      .filter((entry): entry is SPIRegistryEntry => entry !== undefined);
  }

  /**
   * Update service configuration
   */
  async updateService(
    idOrEmail: string,
    updates: Partial<ServiceMetadata>
  ): Promise<SPIRegistryEntry> {
    const entry = this.getService(idOrEmail);
    if (!entry) {
      throw new SPIError('NOT_FOUND', `Service not found: ${idOrEmail}`);
    }

    // Update metadata
    Object.assign(entry.metadata, updates, { updatedAt: new Date() });

    // Emit update event
    this.emit('service:updated', entry);

    logger.info(`Service updated: ${entry.metadata.name}`);

    return entry;
  }

  /**
   * Perform health check on a service
   */
  async healthCheck(idOrEmail: string): Promise<HealthStatus> {
    try {
      const entry = this.getService(idOrEmail);
      if (!entry) {
        throw new SPIError('NOT_FOUND', `Service not found: ${idOrEmail}`);
      }

      const health = await entry.provider.health();
      entry.lastHealthCheck = new Date();
      entry.healthStatus = health;

      // Emit health check event
      this.emit('service:health', { service: entry, health });

      return health;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Health check failed for service: ${message}`);
      throw new SPIError('HEALTH_CHECK_FAILED', message, error);
    }
  }

  /**
   * Start automatic health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckInterval) {
      return; // Already running
    }

    this.healthCheckInterval = setInterval(async () => {
      for (const entry of this.registry.values()) {
        try {
          const health = await entry.provider.health();
          entry.lastHealthCheck = new Date();
          entry.healthStatus = health;

          // Emit event
          this.emit('service:health', { service: entry, health });
        } catch (error) {
          logger.error(
            `Health check failed for ${entry.metadata.name}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }, this.healthCheckIntervalMs);

    logger.info('Health checks started');
  }

  /**
   * Stop automatic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Health checks stopped');
    }
  }

  /**
   * Listen to SPI events
   */
  addEventListener(
    serviceEmail: string,
    eventType: string,
    listener: SPIEventListener
  ): void {
    const key = `${serviceEmail}:${eventType}`;
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, []);
    }
    this.eventListeners.get(key)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(
    serviceEmail: string,
    eventType: string,
    listener: SPIEventListener
  ): void {
    const key = `${serviceEmail}:${eventType}`;
    const listeners = this.eventListeners.get(key) || [];
    const filtered = listeners.filter(l => l !== listener);
    if (filtered.length > 0) {
      this.eventListeners.set(key, filtered);
    } else {
      this.eventListeners.delete(key);
    }
  }

  /**
   * Emit an SPI event
   */
  async emitSPIEvent(event: SPIEvent): Promise<void> {
    const key = `${event.sourceEmail}:${event.type}`;
    const listeners = this.eventListeners.get(key) || [];

    for (const listener of listeners) {
      try {
        await listener(event);
      } catch (error) {
        logger.error(
          `Event listener error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalServices: number;
    activeServices: number;
    servicesByCapability: Record<string, number>;
    servicesByEmail: Record<string, number>;
  } {
    const stats = {
      totalServices: this.registry.size,
      activeServices: 0,
      servicesByCapability: {} as Record<string, number>,
      servicesByEmail: {} as Record<string, number>
    };

    for (const entry of this.registry.values()) {
      if (entry.metadata.isActive) {
        stats.activeServices++;
      }

      // Count by capability
      for (const capability of entry.provider.capabilities) {
        stats.servicesByCapability[capability] =
          (stats.servicesByCapability[capability] || 0) + 1;
      }

      // Count by email
      stats.servicesByEmail[entry.email] =
        (stats.servicesByEmail[entry.email] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get all services
   */
  getAllServices(): SPIRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  /**
   * Clear all services (for testing)
   */
  async clearAll(): Promise<void> {
    for (const entry of this.registry.values()) {
      try {
        await entry.provider.shutdown();
      } catch (error) {
        logger.error(
          `Error shutting down service: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    this.registry.clear();
    this.emailIndex.clear();
    this.eventListeners.clear();

    logger.info('Registry cleared');
  }

  /**
   * Generate unique service ID from email
   */
  private generateServiceId(email: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(email + Date.now())
      .digest('hex')
      .substring(0, 16);
    return `spi_${hash}`;
  }
}

// Global registry instance
export const globalSPIRegistry = new SPIRegistry();
