/**
 * Service Registry - Centralized Service Management
 * Manages service registration, discovery, health tracking, and service metadata
 *
 * @module docker-manager/serviceRegistry
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import * as Logger from 'winston';
import {
  Service,
  ServiceType,
  ServiceStatus,
  ServiceDependency,
  HealthCheck,
  HealthStatus,
  HealthCheckType,
  HealthResult,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types';

/**
 * ServiceRegistry - Manages service registration, discovery, and health tracking
 * Provides centralized registry for all services with health check coordination
 */
export class ServiceRegistry extends EventEmitter {
  private services: Map<string, Service> = new Map();
  private healthCheckResults: Map<string, HealthStatus> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private logger: Logger.Logger;
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastUpdateTime: Map<string, Date> = new Map();

  /**
   * Creates a new ServiceRegistry instance
   *
   * @param logger - Winston logger instance
   */
  constructor(logger: Logger.Logger) {
    super();
    this.logger = logger;
  }

  /**
   * Register a new service
   *
   * @param service - Service configuration
   * @returns Service ID
   *
   * @example
   * ```typescript
   * const serviceId = await registry.registerService({
   *   id: 'strategy-golden-cross-1',
   *   name: 'golden-cross-strategy',
   *   version: '1.0.0',
   *   type: ServiceType.STRATEGY,
   *   image: 'aurigraph:strategy-executor',
   *   replicas: 2,
   *   desiredReplicas: 2,
   *   status: ServiceStatus.PENDING,
   *   healthCheck: {
   *     type: HealthCheckType.HTTP,
   *     endpoint: '/health',
   *     interval: 5000,
   *     timeout: 2000,
   *     retries: 3
   *   },
   *   dependencies: [],
   *   metadata: { strategyId: 'golden-cross', exchange: 'binance' },
   *   labels: { 'env': 'production' },
   *   environment: { STRATEGY_ID: 'golden-cross' },
   *   resources: { cpuLimit: 2000, memoryLimit: 2147483648 },
   *   createdAt: new Date(),
   *   updatedAt: new Date()
   * });
   * ```
   */
  async registerService(service: Service): Promise<string> {
    try {
      // Validate service
      const validation = this.validateService(service);
      if (!validation.valid) {
        throw new Error(`Service validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Check if service already exists
      if (this.services.has(service.id)) {
        this.logger.warn(`Service already registered: ${service.id}`);
        return service.id;
      }

      // Register service
      this.services.set(service.id, service);

      // Initialize health status
      this.healthCheckResults.set(service.id, {
        overall: 'unknown',
        checks: [],
        lastUpdate: new Date(),
        consecutiveFailures: 0,
      });

      // Build dependency graph
      service.dependencies.forEach((dep) => {
        if (!this.dependencyGraph.has(dep.serviceId)) {
          this.dependencyGraph.set(dep.serviceId, new Set());
        }
        this.dependencyGraph.get(dep.serviceId)!.add(service.id);
      });

      // Set last update time
      this.lastUpdateTime.set(service.id, new Date());

      this.logger.info(`Service registered: ${service.id} (${service.name} v${service.version})`);

      this.emit('service-registered', {
        serviceId: service.id,
        serviceName: service.name,
        version: service.version,
        type: service.type,
      });

      return service.id;
    } catch (error) {
      this.logger.error(`Failed to register service ${service.id}`, error);
      throw new Error(`Service registration failed: ${error.message}`);
    }
  }

  /**
   * Deregister a service
   *
   * @param serviceId - Service ID to deregister
   */
  async deregisterService(serviceId: string): Promise<void> {
    try {
      const service = this.services.get(serviceId);
      if (!service) {
        this.logger.warn(`Service not found for deregistration: ${serviceId}`);
        return;
      }

      // Stop health check if running
      const healthInterval = this.healthCheckIntervals.get(serviceId);
      if (healthInterval) {
        clearInterval(healthInterval);
        this.healthCheckIntervals.delete(serviceId);
      }

      // Remove from registry
      this.services.delete(serviceId);
      this.healthCheckResults.delete(serviceId);
      this.lastUpdateTime.delete(serviceId);

      // Remove from dependency graph
      this.dependencyGraph.delete(serviceId);
      this.dependencyGraph.forEach((deps) => {
        deps.delete(serviceId);
      });

      this.logger.info(`Service deregistered: ${serviceId}`);

      this.emit('service-deregistered', { serviceId });
    } catch (error) {
      this.logger.error(`Failed to deregister service ${serviceId}`, error);
      throw new Error(`Service deregistration failed: ${error.message}`);
    }
  }

  /**
   * Get a service by ID
   *
   * @param serviceId - Service ID
   * @returns Service details
   */
  async getService(serviceId: string): Promise<Service> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }
    return service;
  }

  /**
   * List all services with optional filtering
   *
   * @param filter - Filter criteria
   * @returns Array of services
   */
  async listServices(filter?: { type?: ServiceType; status?: ServiceStatus; label?: string }): Promise<Service[]> {
    let services = Array.from(this.services.values());

    if (filter) {
      if (filter.type) {
        services = services.filter((s) => s.type === filter.type);
      }
      if (filter.status) {
        services = services.filter((s) => s.status === filter.status);
      }
      if (filter.label) {
        const [key, value] = filter.label.split('=');
        services = services.filter((s) => s.labels && s.labels[key] === value);
      }
    }

    return services;
  }

  /**
   * Update service configuration
   *
   * @param serviceId - Service ID
   * @param updates - Partial service updates
   */
  async updateService(serviceId: string, updates: Partial<Service>): Promise<void> {
    try {
      const service = this.services.get(serviceId);
      if (!service) {
        throw new Error(`Service not found: ${serviceId}`);
      }

      // Apply updates
      const updated: Service = {
        ...service,
        ...updates,
        id: service.id, // Don't allow ID change
        createdAt: service.createdAt, // Preserve creation time
        updatedAt: new Date(),
      };

      // Validate updated service
      const validation = this.validateService(updated);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Update service
      this.services.set(serviceId, updated);
      this.lastUpdateTime.set(serviceId, new Date());

      this.logger.info(`Service updated: ${serviceId}`);

      this.emit('service-updated', {
        serviceId,
        changes: updates,
      });
    } catch (error) {
      this.logger.error(`Failed to update service ${serviceId}`, error);
      throw new Error(`Service update failed: ${error.message}`);
    }
  }

  /**
   * Get service health status
   *
   * @param serviceId - Service ID
   * @returns Health status
   */
  async getServiceHealth(serviceId: string): Promise<HealthStatus> {
    const health = this.healthCheckResults.get(serviceId);
    if (!health) {
      throw new Error(`Health status not found for service: ${serviceId}`);
    }
    return health;
  }

  /**
   * Update service health status
   *
   * @param serviceId - Service ID
   * @param health - Health check result
   */
  async updateServiceHealth(serviceId: string, health: HealthResult): Promise<void> {
    try {
      const currentHealth = this.healthCheckResults.get(serviceId);
      if (!currentHealth) {
        throw new Error(`Health status not found for service: ${serviceId}`);
      }

      // Update health checks
      currentHealth.checks.push(health);

      // Keep only last 100 checks
      if (currentHealth.checks.length > 100) {
        currentHealth.checks = currentHealth.checks.slice(-100);
      }

      // Calculate overall health
      const failureCount = currentHealth.checks.filter((c) => c.status === 'unhealthy').length;
      const recentFailures = currentHealth.checks.slice(-5).filter((c) => c.status === 'unhealthy').length;

      if (health.status === 'healthy') {
        currentHealth.overall = failureCount === 0 ? 'healthy' : 'degraded';
        currentHealth.consecutiveFailures = 0;
      } else {
        currentHealth.consecutiveFailures++;
        if (currentHealth.consecutiveFailures >= 3) {
          currentHealth.overall = 'unhealthy';
        } else if (recentFailures > 2) {
          currentHealth.overall = 'degraded';
        }
      }

      currentHealth.lastUpdate = new Date();

      this.logger.debug(`Service health updated: ${serviceId} - ${currentHealth.overall}`);

      this.emit('service-health-updated', {
        serviceId,
        health: currentHealth,
      });

      // Update service status based on health
      const service = this.services.get(serviceId);
      if (service) {
        if (currentHealth.overall === 'unhealthy') {
          await this.updateService(serviceId, { status: ServiceStatus.UNHEALTHY });
        } else if (currentHealth.overall === 'healthy') {
          if (service.status === ServiceStatus.PENDING) {
            await this.updateService(serviceId, { status: ServiceStatus.RUNNING });
          } else if (service.status === ServiceStatus.UNHEALTHY) {
            await this.updateService(serviceId, { status: ServiceStatus.HEALTHY });
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to update service health for ${serviceId}`, error);
    }
  }

  /**
   * Discover services by criteria
   *
   * @param criteria - Discovery criteria
   * @returns Matching services
   */
  async discoverService(criteria: {
    type?: ServiceType;
    label?: Record<string, string>;
    healthStatus?: 'healthy' | 'unhealthy' | 'degraded';
  }): Promise<Service[]> {
    let results = Array.from(this.services.values());

    if (criteria.type) {
      results = results.filter((s) => s.type === criteria.type);
    }

    if (criteria.label) {
      results = results.filter((s) => {
        if (!s.labels) return false;
        return Object.entries(criteria.label!).every(([key, value]) => s.labels![key] === value);
      });
    }

    if (criteria.healthStatus) {
      results = results.filter((s) => {
        const health = this.healthCheckResults.get(s.id);
        return health?.overall === criteria.healthStatus;
      });
    }

    return results;
  }

  /**
   * Check if dependencies are satisfied
   *
   * @param serviceId - Service ID
   * @returns Validation result with dependency status
   */
  async validateDependencies(serviceId: string): Promise<ValidationResult> {
    try {
      const service = this.services.get(serviceId);
      if (!service) {
        return {
          valid: false,
          errors: [{ field: 'serviceId', message: 'Service not found', code: 'SERVICE_NOT_FOUND' }],
          warnings: [],
        };
      }

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      for (const dep of service.dependencies) {
        const depService = this.services.get(dep.serviceId);
        if (!depService) {
          errors.push({
            field: 'dependencies',
            message: `Dependency not found: ${dep.serviceId}`,
            code: 'DEPENDENCY_NOT_FOUND',
          });
          continue;
        }

        const depHealth = this.healthCheckResults.get(dep.serviceId);
        if (!depHealth) {
          warnings.push({
            field: 'dependencies',
            message: `Health status unknown for dependency: ${dep.serviceId}`,
            code: 'HEALTH_UNKNOWN',
          });
          continue;
        }

        // Check strong dependencies
        if (dep.dependencyType === 'strong') {
          if (depHealth.overall !== 'healthy') {
            errors.push({
              field: 'dependencies',
              message: `Strong dependency unhealthy: ${dep.serviceId} (${depHealth.overall})`,
              code: 'DEPENDENCY_UNHEALTHY',
            });
          }
        }

        // Check minimum replicas if specified
        if (dep.minimumReplicas && depService.replicas < dep.minimumReplicas) {
          warnings.push({
            field: 'dependencies',
            message: `Dependency below minimum replicas: ${dep.serviceId}`,
            code: 'LOW_REPLICA_COUNT',
          });
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      this.logger.error(`Failed to validate dependencies for ${serviceId}`, error);
      return {
        valid: false,
        errors: [{ field: 'validation', message: error.message, code: 'VALIDATION_ERROR' }],
        warnings: [],
      };
    }
  }

  /**
   * Get dependent services (services that depend on this service)
   *
   * @param serviceId - Service ID
   * @returns Array of dependent service IDs
   */
  async getDependents(serviceId: string): Promise<string[]> {
    const dependents = this.dependencyGraph.get(serviceId);
    return dependents ? Array.from(dependents) : [];
  }

  /**
   * Get service dependencies
   *
   * @param serviceId - Service ID
   * @returns Array of service dependencies
   */
  async getDependencies(serviceId: string): Promise<ServiceDependency[]> {
    const service = this.services.get(serviceId);
    return service?.dependencies || [];
  }

  /**
   * Track service deployment
   *
   * @param serviceId - Service ID
   * @param version - Service version
   */
  async trackDeployment(serviceId: string, version: string): Promise<void> {
    try {
      const service = this.services.get(serviceId);
      if (!service) {
        throw new Error(`Service not found: ${serviceId}`);
      }

      // Update service version
      await this.updateService(serviceId, {
        version,
        status: ServiceStatus.PENDING,
      });

      this.logger.info(`Deployment tracked for service ${serviceId}: ${version}`);

      this.emit('service-deployment-tracked', {
        serviceId,
        version,
      });
    } catch (error) {
      this.logger.error(`Failed to track deployment for ${serviceId}`, error);
      throw new Error(`Deployment tracking failed: ${error.message}`);
    }
  }

  /**
   * Get service statistics
   *
   * @returns Service statistics
   */
  async getStatistics(): Promise<{
    totalServices: number;
    servicesByType: Record<ServiceType, number>;
    servicesByStatus: Record<ServiceStatus, number>;
    healthySuspices: number;
    unhealthyServices: number;
    totalReplicas: number;
    desiredReplicas: number;
  }> {
    const services = Array.from(this.services.values());
    const stats = {
      totalServices: services.length,
      servicesByType: {} as Record<ServiceType, number>,
      servicesByStatus: {} as Record<ServiceStatus, number>,
      healthySuspices: 0,
      unhealthyServices: 0,
      totalReplicas: 0,
      desiredReplicas: 0,
    };

    services.forEach((service) => {
      // Count by type
      stats.servicesByType[service.type] = (stats.servicesByType[service.type] || 0) + 1;

      // Count by status
      stats.servicesByStatus[service.status] = (stats.servicesByStatus[service.status] || 0) + 1;

      // Count health
      const health = this.healthCheckResults.get(service.id);
      if (health?.overall === 'healthy') {
        stats.healthySuspices++;
      } else if (health?.overall === 'unhealthy') {
        stats.unhealthyServices++;
      }

      // Count replicas
      stats.totalReplicas += service.replicas;
      stats.desiredReplicas += service.desiredReplicas;
    });

    return stats;
  }

  /**
   * Validate service configuration
   * @private
   */
  private validateService(service: Service): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check required fields
    if (!service.id || service.id.trim() === '') {
      errors.push({ field: 'id', message: 'Service ID is required', code: 'MISSING_ID' });
    }

    if (!service.name || service.name.trim() === '') {
      errors.push({ field: 'name', message: 'Service name is required', code: 'MISSING_NAME' });
    }

    if (!service.image || service.image.trim() === '') {
      errors.push({ field: 'image', message: 'Docker image is required', code: 'MISSING_IMAGE' });
    }

    // Check version format
    if (!service.version.match(/^\d+\.\d+\.\d+/)) {
      warnings.push({
        field: 'version',
        message: 'Version should follow semantic versioning',
        code: 'INVALID_VERSION_FORMAT',
      });
    }

    // Check replica counts
    if (service.replicas < 0) {
      errors.push({
        field: 'replicas',
        message: 'Replica count cannot be negative',
        code: 'INVALID_REPLICAS',
      });
    }

    if (service.desiredReplicas < service.replicas) {
      warnings.push({
        field: 'desiredReplicas',
        message: 'Desired replicas less than current replicas',
        code: 'REPLICA_MISMATCH',
      });
    }

    // Check health check configuration
    if (service.healthCheck.type === 'http' && !service.healthCheck.endpoint) {
      errors.push({
        field: 'healthCheck',
        message: 'HTTP health check requires endpoint',
        code: 'MISSING_ENDPOINT',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Cleanup and close registry
   */
  async cleanup(): Promise<void> {
    try {
      // Stop all health check intervals
      this.healthCheckIntervals.forEach((interval) => clearInterval(interval));
      this.healthCheckIntervals.clear();

      // Clear all maps
      this.services.clear();
      this.healthCheckResults.clear();
      this.dependencyGraph.clear();
      this.lastUpdateTime.clear();

      this.logger.info('ServiceRegistry cleanup complete');
    } catch (error) {
      this.logger.error('Error during registry cleanup', error);
    }
  }
}

export default ServiceRegistry;
