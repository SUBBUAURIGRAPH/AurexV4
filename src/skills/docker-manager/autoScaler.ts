/**
 * Auto Scaler - Intelligent Container & Service Scaling
 * Manages horizontal scaling based on metrics and scaling policies
 *
 * @module docker-manager/autoScaler
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import * as Logger from 'winston';
import {
  Metrics,
  ScalingPolicy,
  ScalingDecision,
  ScalingEvent,
  Service,
  ServiceStatus,
} from './types';
import { ContainerManager } from './containerManager';
import { ServiceRegistry } from './serviceRegistry';
import { ContainerMonitor } from './containerMonitor';

/**
 * Scaling metric types for decision making
 */
type ScalingMetricType = 'cpu' | 'memory' | 'network' | 'custom';

/**
 * Scaling decision result
 */
interface ScalingDecisionResult {
  scale: boolean;
  direction: 'up' | 'down' | 'none';
  targetReplicas: number;
  reason: string;
  confidence: number; // 0-1 confidence level
}

/**
 * Scaling event history entry
 */
interface ScalingEventEntry {
  timestamp: Date;
  serviceId: string;
  previousReplicas: number;
  newReplicas: number;
  reason: string;
  direction: 'up' | 'down';
  duration: number; // ms to complete scaling
  status: 'success' | 'failed' | 'partial';
  error?: string;
}

/**
 * AutoScaler - Intelligent horizontal scaling management
 * Monitors metrics and automatically scales services based on policies
 */
export class AutoScaler extends EventEmitter {
  private containerManager: ContainerManager;
  private serviceRegistry: ServiceRegistry;
  private containerMonitor: ContainerMonitor;
  private logger: Logger.Logger;

  private scalingPolicies: Map<string, ScalingPolicy> = new Map();
  private lastScalingTime: Map<string, number> = new Map();
  private scalingHistory: ScalingEventEntry[] = [];
  private scalingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private maxHistorySize: number = 500;

  /**
   * Creates a new AutoScaler instance
   *
   * @param containerManager - Container manager instance
   * @param serviceRegistry - Service registry instance
   * @param containerMonitor - Container monitor instance
   * @param logger - Winston logger instance
   * @param maxHistorySize - Maximum scaling history to keep (default: 500)
   */
  constructor(
    containerManager: ContainerManager,
    serviceRegistry: ServiceRegistry,
    containerMonitor: ContainerMonitor,
    logger: Logger.Logger,
    maxHistorySize: number = 500
  ) {
    super();
    this.containerManager = containerManager;
    this.serviceRegistry = serviceRegistry;
    this.containerMonitor = containerMonitor;
    this.logger = logger;
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Register scaling policy for a service
   *
   * @param serviceId - Service ID
   * @param policy - Scaling policy configuration
   * @returns Policy ID
   */
  async registerScalingPolicy(serviceId: string, policy: ScalingPolicy): Promise<string> {
    try {
      const policyId = policy.id || `policy-${serviceId}-${Date.now()}`;

      this.scalingPolicies.set(policyId, {
        ...policy,
        id: policyId,
        serviceId,
      });

      this.logger.info(`Scaling policy registered: ${policyId} for service ${serviceId}`);

      this.emit('policy-registered', {
        policyId,
        serviceId,
        minReplicas: policy.minReplicas,
        maxReplicas: policy.maxReplicas,
      });

      return policyId;
    } catch (error) {
      this.logger.error(`Failed to register scaling policy for ${serviceId}`, error);
      throw new Error(`Failed to register policy: ${error.message}`);
    }
  }

  /**
   * Get scaling policy for a service
   *
   * @param serviceId - Service ID
   * @returns Scaling policies for service
   */
  async getScalingPolicies(serviceId: string): Promise<ScalingPolicy[]> {
    const policies: ScalingPolicy[] = [];

    this.scalingPolicies.forEach((policy) => {
      if (policy.serviceId === serviceId) {
        policies.push(policy);
      }
    });

    return policies;
  }

  /**
   * Start automatic scaling for a service
   *
   * @param serviceId - Service ID to monitor and scale
   * @param evaluationInterval - Interval in milliseconds for evaluation (default: 30000)
   */
  async startAutoScaling(serviceId: string, evaluationInterval: number = 30000): Promise<void> {
    try {
      // Validate service exists
      const service = await this.serviceRegistry.getService(serviceId);
      if (!service) {
        throw new Error(`Service not found: ${serviceId}`);
      }

      // Check if already scaling
      if (this.scalingIntervals.has(serviceId)) {
        this.logger.warn(`Auto-scaling already active for service: ${serviceId}`);
        return;
      }

      this.logger.info(`Starting auto-scaling for service: ${serviceId} (interval: ${evaluationInterval}ms)`);

      // Reset last scaling time
      this.lastScalingTime.set(serviceId, Date.now());

      // Start evaluation interval
      const interval = setInterval(async () => {
        try {
          await this.evaluateAndScale(serviceId);
        } catch (error) {
          this.logger.warn(`Failed to evaluate scaling for ${serviceId}`, error);
        }
      }, evaluationInterval);

      this.scalingIntervals.set(serviceId, interval);

      this.emit('auto-scaling-started', { serviceId, evaluationInterval });
    } catch (error) {
      this.logger.error(`Failed to start auto-scaling for ${serviceId}`, error);
      throw new Error(`Failed to start auto-scaling: ${error.message}`);
    }
  }

  /**
   * Stop automatic scaling for a service
   *
   * @param serviceId - Service ID to stop scaling
   */
  async stopAutoScaling(serviceId: string): Promise<void> {
    try {
      const interval = this.scalingIntervals.get(serviceId);
      if (interval) {
        clearInterval(interval);
        this.scalingIntervals.delete(serviceId);
      }

      this.logger.info(`Stopped auto-scaling for service: ${serviceId}`);

      this.emit('auto-scaling-stopped', { serviceId });
    } catch (error) {
      this.logger.error(`Failed to stop auto-scaling for ${serviceId}`, error);
    }
  }

  /**
   * Evaluate metrics and make scaling decision
   * @private
   */
  private async evaluateAndScale(serviceId: string): Promise<void> {
    try {
      const service = await this.serviceRegistry.getService(serviceId);
      if (!service) {
        return;
      }

      // Get policies for service
      const policies = await this.getScalingPolicies(serviceId);
      if (policies.length === 0) {
        return;
      }

      // Get current metrics
      const metrics = await this.collectServiceMetrics(serviceId, service);
      if (!metrics) {
        return;
      }

      // Evaluate each policy
      for (const policy of policies) {
        if (!policy.enabled) continue;

        const decision = await this.makeScalingDecision(service, policy, metrics);

        if (decision.scale) {
          // Check cooldown period
          const canScale = this.checkCooldownPeriod(serviceId, policy);
          if (!canScale) {
            this.logger.debug(`Scaling for ${serviceId} blocked by cooldown period`);
            continue;
          }

          // Execute scaling
          await this.executeScaling(service, decision, policy);
        }
      }
    } catch (error) {
      this.logger.error(`Error during scaling evaluation for ${serviceId}`, error);
    }
  }

  /**
   * Check if cooldown period has passed
   * @private
   */
  private checkCooldownPeriod(serviceId: string, policy: ScalingPolicy): boolean {
    const lastScaling = this.lastScalingTime.get(serviceId) || 0;
    const now = Date.now();
    const cooldownMs = (policy.cooldownPeriodMinutes || 5) * 60 * 1000;

    return now - lastScaling >= cooldownMs;
  }

  /**
   * Collect metrics for a service
   * @private
   */
  private async collectServiceMetrics(
    serviceId: string,
    service: Service
  ): Promise<{
    avgCpu: number;
    avgMemory: number;
    maxCpu: number;
    maxMemory: number;
    sampleCount: number;
  } | null> {
    try {
      // Aggregate metrics from all service containers
      if (!service.metadata || !service.metadata.containerIds) {
        return null;
      }

      const containerIds = Array.isArray(service.metadata.containerIds)
        ? service.metadata.containerIds
        : [service.metadata.containerIds];

      if (containerIds.length === 0) {
        return null;
      }

      let totalCpu = 0;
      let totalMemory = 0;
      let maxCpu = 0;
      let maxMemory = 0;
      let sampleCount = 0;

      for (const containerId of containerIds) {
        try {
          const stats = await this.containerMonitor.getMetricsStatistics(containerId);
          if (stats && stats.sampleCount > 0) {
            totalCpu += stats.avgCpu * stats.sampleCount;
            totalMemory += stats.avgMemory * stats.sampleCount;
            maxCpu = Math.max(maxCpu, stats.maxCpu);
            maxMemory = Math.max(maxMemory, stats.maxMemory);
            sampleCount += stats.sampleCount;
          }
        } catch (error) {
          this.logger.debug(`Failed to collect metrics for container ${containerId}`);
        }
      }

      if (sampleCount === 0) {
        return null;
      }

      return {
        avgCpu: totalCpu / sampleCount,
        avgMemory: totalMemory / sampleCount,
        maxCpu,
        maxMemory,
        sampleCount,
      };
    } catch (error) {
      this.logger.error(`Failed to collect metrics for service ${serviceId}`, error);
      return null;
    }
  }

  /**
   * Make scaling decision based on metrics and policy
   * @private
   */
  private async makeScalingDecision(
    service: Service,
    policy: ScalingPolicy,
    metrics: any
  ): Promise<ScalingDecisionResult> {
    const currentReplicas = service.replicas || 1;
    const targetReplicas = currentReplicas;

    // Default: no scaling needed
    let decision: ScalingDecisionResult = {
      scale: false,
      direction: 'none',
      targetReplicas,
      reason: 'No scaling needed',
      confidence: 0,
    };

    try {
      // Evaluate scaling up
      if (
        metrics.avgCpu >= (policy.scaleUpThreshold?.cpu || 70) &&
        currentReplicas < (policy.maxReplicas || 10)
      ) {
        decision = {
          scale: true,
          direction: 'up',
          targetReplicas: Math.min(currentReplicas + (policy.scaleUpIncrement || 1), policy.maxReplicas || 10),
          reason: `CPU usage (${metrics.avgCpu.toFixed(1)}%) exceeds threshold (${policy.scaleUpThreshold?.cpu || 70}%)`,
          confidence: Math.min((metrics.avgCpu / 100) * 1.2, 1), // Higher CPU = higher confidence
        };
      }

      // Evaluate scaling down
      if (
        metrics.avgCpu <= (policy.scaleDownThreshold?.cpu || 30) &&
        metrics.avgMemory <= (policy.scaleDownThreshold?.memory || 30) &&
        currentReplicas > (policy.minReplicas || 1)
      ) {
        decision = {
          scale: true,
          direction: 'down',
          targetReplicas: Math.max(currentReplicas - (policy.scaleDownIncrement || 1), policy.minReplicas || 1),
          reason: `Low resource usage (CPU: ${metrics.avgCpu.toFixed(1)}%, Memory: ${metrics.avgMemory.toFixed(1)}%)`,
          confidence: 0.8, // Conservative confidence for scaling down
        };
      }

      // Memory-based scaling
      if (
        metrics.avgMemory >= (policy.scaleUpThreshold?.memory || 75) &&
        currentReplicas < (policy.maxReplicas || 10)
      ) {
        decision = {
          scale: true,
          direction: 'up',
          targetReplicas: Math.min(currentReplicas + (policy.scaleUpIncrement || 1), policy.maxReplicas || 10),
          reason: `Memory usage (${metrics.avgMemory.toFixed(1)}%) exceeds threshold (${policy.scaleUpThreshold?.memory || 75}%)`,
          confidence: Math.min((metrics.avgMemory / 100) * 1.1, 1),
        };
      }
    } catch (error) {
      this.logger.warn(`Failed to evaluate scaling decision`, error);
    }

    return decision;
  }

  /**
   * Execute scaling operation
   * @private
   */
  private async executeScaling(
    service: Service,
    decision: ScalingDecisionResult,
    policy: ScalingPolicy
  ): Promise<void> {
    const startTime = Date.now();
    const previousReplicas = service.replicas || 1;

    try {
      this.logger.info(
        `Executing scaling for service ${service.id}: ${previousReplicas} -> ${decision.targetReplicas} (${decision.direction})`
      );

      // Update service replicas in registry
      await this.serviceRegistry.updateService(service.id, {
        desiredReplicas: decision.targetReplicas,
      });

      // Scale up: create new containers
      if (decision.direction === 'up') {
        const containersToAdd = decision.targetReplicas - previousReplicas;
        for (let i = 0; i < containersToAdd; i++) {
          try {
            const containerId = await this.containerManager.createContainer({
              image: service.image,
              name: `${service.name}-${Date.now()}-${i}`,
              environment: service.environment || {},
              resourceLimits: service.resources,
              restartPolicy: { name: 'unless-stopped' },
            });
            await this.containerManager.startContainer(containerId);
            this.logger.info(`Created and started container: ${containerId}`);
          } catch (error) {
            this.logger.warn(`Failed to create container during scale up`, error);
          }
        }
      }
      // Scale down: remove containers
      else if (decision.direction === 'down') {
        const containerIds = Array.isArray(service.metadata?.containerIds)
          ? service.metadata.containerIds
          : [service.metadata?.containerIds];

        const containersToRemove = previousReplicas - decision.targetReplicas;
        for (let i = 0; i < containersToRemove && i < containerIds.length; i++) {
          try {
            await this.containerManager.stopContainer(containerIds[i]);
            await this.containerManager.removeContainer(containerIds[i]);
            this.logger.info(`Stopped and removed container: ${containerIds[i]}`);
          } catch (error) {
            this.logger.warn(`Failed to remove container during scale down`, error);
          }
        }
      }

      const duration = Date.now() - startTime;

      // Record scaling event
      const event: ScalingEventEntry = {
        timestamp: new Date(),
        serviceId: service.id,
        previousReplicas,
        newReplicas: decision.targetReplicas,
        reason: decision.reason,
        direction: decision.direction as 'up' | 'down',
        duration,
        status: 'success',
      };

      this.recordScalingEvent(event);
      this.lastScalingTime.set(service.id, Date.now());

      this.emit('scaling-executed', {
        serviceId: service.id,
        previousReplicas,
        newReplicas: decision.targetReplicas,
        direction: decision.direction,
        reason: decision.reason,
        duration,
      });

      this.logger.info(
        `Scaling completed for ${service.id}: ${previousReplicas} -> ${decision.targetReplicas} in ${duration}ms`
      );
    } catch (error) {
      this.logger.error(`Failed to execute scaling for ${service.id}`, error);

      // Record failed scaling event
      const event: ScalingEventEntry = {
        timestamp: new Date(),
        serviceId: service.id,
        previousReplicas,
        newReplicas: previousReplicas,
        reason: decision.reason,
        direction: decision.direction as 'up' | 'down',
        duration: Date.now() - startTime,
        status: 'failed',
        error: error.message,
      };

      this.recordScalingEvent(event);

      this.emit('scaling-failed', {
        serviceId: service.id,
        reason: error.message,
      });
    }
  }

  /**
   * Record scaling event in history
   * @private
   */
  private recordScalingEvent(event: ScalingEventEntry): void {
    this.scalingHistory.push(event);

    // Keep history size under control
    if (this.scalingHistory.length > this.maxHistorySize) {
      this.scalingHistory.shift();
    }
  }

  /**
   * Get scaling history for a service
   *
   * @param serviceId - Service ID
   * @param limit - Maximum number of events to return (default: 50)
   * @returns Scaling events
   */
  async getScalingHistory(serviceId: string, limit: number = 50): Promise<ScalingEventEntry[]> {
    const events = this.scalingHistory.filter((e) => e.serviceId === serviceId);
    return events.slice(-limit);
  }

  /**
   * Get scaling statistics
   *
   * @returns Scaling statistics
   */
  async getScalingStatistics(): Promise<{
    totalScalingEvents: number;
    successfulScalings: number;
    failedScalings: number;
    averageDuration: number;
    scaleUpCount: number;
    scaleDownCount: number;
  }> {
    const stats = {
      totalScalingEvents: this.scalingHistory.length,
      successfulScalings: 0,
      failedScalings: 0,
      averageDuration: 0,
      scaleUpCount: 0,
      scaleDownCount: 0,
    };

    if (this.scalingHistory.length === 0) {
      return stats;
    }

    let totalDuration = 0;

    for (const event of this.scalingHistory) {
      if (event.status === 'success') {
        stats.successfulScalings++;
      } else {
        stats.failedScalings++;
      }

      if (event.direction === 'up') {
        stats.scaleUpCount++;
      } else {
        stats.scaleDownCount++;
      }

      totalDuration += event.duration;
    }

    stats.averageDuration = totalDuration / this.scalingHistory.length;

    return stats;
  }

  /**
   * Cleanup auto scaler resources
   */
  async cleanup(): Promise<void> {
    try {
      // Stop all scaling intervals
      this.scalingIntervals.forEach((interval) => clearInterval(interval));
      this.scalingIntervals.clear();

      // Clear data
      this.scalingPolicies.clear();
      this.lastScalingTime.clear();
      this.scalingHistory = [];

      this.logger.info('AutoScaler cleanup complete');
    } catch (error) {
      this.logger.error('Error during auto scaler cleanup', error);
    }
  }
}

export default AutoScaler;
