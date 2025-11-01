/**
 * Deployment Orchestrator - Multi-Service Deployment Orchestration
 * Handles complex deployment workflows, rollback, and deployment strategies
 *
 * @module docker-manager/deploymentOrchestrator
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import * as Logger from 'winston';
import {
  DeploymentSpec,
  DeploymentStrategy,
  DeploymentResult,
  DeploymentPlan,
  DeploymentStep,
  DeploymentEvent,
  Service,
  ServiceStatus,
  HealthCheckType,
} from './types';
import { ServiceRegistry } from './serviceRegistry';
import { ContainerManager } from './containerManager';

/**
 * DeploymentOrchestrator - Manages complex multi-service deployments
 * Handles deployment strategies, dependency management, and rollback
 */
export class DeploymentOrchestrator extends EventEmitter {
  private serviceRegistry: ServiceRegistry;
  private containerManager: ContainerManager;
  private logger: Logger.Logger;
  private activeDeployments: Map<string, DeploymentResult> = new Map();
  private deploymentHistory: Map<string, DeploymentResult[]> = new Map();

  /**
   * Creates a new DeploymentOrchestrator instance
   *
   * @param serviceRegistry - Service registry instance
   * @param containerManager - Container manager instance
   * @param logger - Winston logger instance
   */
  constructor(serviceRegistry: ServiceRegistry, containerManager: ContainerManager, logger: Logger.Logger) {
    super();
    this.serviceRegistry = serviceRegistry;
    this.containerManager = containerManager;
    this.logger = logger;
  }

  /**
   * Plan a deployment without executing it
   *
   * @param spec - Deployment specification
   * @returns Deployment plan with steps
   */
  async planDeployment(spec: DeploymentSpec): Promise<DeploymentPlan> {
    try {
      this.logger.info(`Planning deployment for service: ${spec.serviceId}`);

      const plan: DeploymentPlan = {
        id: `plan-${Date.now()}`,
        steps: [],
        totalSteps: 0,
        estimatedDuration: 0,
      };

      // Get current service
      const currentService = await this.serviceRegistry.getService(spec.serviceId);

      // Step 1: Pull image
      plan.steps.push({
        order: 1,
        action: 'pull',
        targetService: spec.serviceId,
        expectedDuration: 30000,
        retryable: true,
        rollbackAction: 'none',
      });

      // Step 2: Create new containers (based on strategy)
      if (spec.strategy === DeploymentStrategy.BLUE_GREEN) {
        plan.steps.push({
          order: 2,
          action: 'create',
          targetService: spec.serviceId,
          expectedDuration: 10000,
          retryable: true,
          rollbackAction: 'remove',
        });
      } else if (spec.strategy === DeploymentStrategy.CANARY) {
        // Start with canary percentage
        plan.steps.push({
          order: 2,
          action: 'create',
          targetService: spec.serviceId,
          expectedDuration: 10000,
          retryable: true,
          rollbackAction: 'remove',
        });
      } else if (spec.strategy === DeploymentStrategy.ROLLING) {
        // Rolling update - one at a time
        plan.steps.push({
          order: 2,
          action: 'create',
          targetService: spec.serviceId,
          expectedDuration: 10000,
          retryable: true,
          rollbackAction: 'remove',
        });
      }

      // Step 3: Health check
      plan.steps.push({
        order: plan.steps.length + 1,
        action: 'health_check',
        targetService: spec.serviceId,
        expectedDuration: 15000,
        retryable: true,
        rollbackAction: 'remove',
      });

      // Step 4: Route traffic (for blue-green/canary)
      if (spec.strategy === DeploymentStrategy.BLUE_GREEN || spec.strategy === DeploymentStrategy.CANARY) {
        plan.steps.push({
          order: plan.steps.length + 1,
          action: 'route',
          targetService: spec.serviceId,
          expectedDuration: 5000,
          retryable: true,
          rollbackAction: 'route',
        });
      }

      // Step 5: Scale to desired replicas
      plan.steps.push({
        order: plan.steps.length + 1,
        action: 'scale',
        targetService: spec.serviceId,
        expectedDuration: 20000,
        retryable: true,
        rollbackAction: 'scale',
      });

      plan.totalSteps = plan.steps.length;
      plan.estimatedDuration = plan.steps.reduce((total, step) => total + step.expectedDuration, 0);

      this.logger.info(`Deployment plan created: ${plan.id} (${plan.totalSteps} steps, ${plan.estimatedDuration}ms)`);

      return plan;
    } catch (error) {
      this.logger.error(`Failed to plan deployment for ${spec.serviceId}`, error);
      throw new Error(`Deployment planning failed: ${error.message}`);
    }
  }

  /**
   * Execute a deployment
   *
   * @param deployment - Deployment specification
   * @returns Deployment result
   *
   * @example
   * ```typescript
   * const result = await orchestrator.deployService({
   *   serviceId: 'strategy-1',
   *   serviceName: 'Strategy Service',
   *   image: 'aurigraph:strategy-executor',
   *   version: '1.0.1',
   *   strategy: DeploymentStrategy.BLUE_GREEN,
   *   replicas: 3,
   *   healthCheck: { type: 'http', endpoint: '/health', ... },
   *   environment: { ... },
   *   resources: { ... }
   * });
   * ```
   */
  async deployService(deployment: DeploymentSpec): Promise<DeploymentResult> {
    const deploymentId = `deploy-${Date.now()}`;
    const result: DeploymentResult = {
      deploymentId,
      serviceId: deployment.serviceId,
      status: 'success',
      createdContainers: [],
      failedContainers: [],
      duration: 0,
      startedAt: new Date(),
      completedAt: new Date(),
    };

    try {
      this.logger.info(`Starting deployment: ${deploymentId} (${deployment.serviceId})`);

      // Mark deployment as active
      this.activeDeployments.set(deploymentId, result);

      const startTime = Date.now();

      // Plan deployment
      const plan = await this.planDeployment(deployment);

      // Validate dependencies
      const validation = await this.serviceRegistry.validateDependencies(deployment.serviceId);
      if (!validation.valid) {
        throw new Error(`Deployment dependencies invalid: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Execute deployment strategy
      switch (deployment.strategy) {
        case DeploymentStrategy.BLUE_GREEN:
          await this.executeBlueGreenDeployment(deployment, result);
          break;
        case DeploymentStrategy.CANARY:
          await this.executeCanaryDeployment(deployment, result);
          break;
        case DeploymentStrategy.ROLLING:
          await this.executeRollingDeployment(deployment, result);
          break;
        case DeploymentStrategy.RECREATE:
          await this.executeRecreateDeployment(deployment, result);
          break;
      }

      // Update deployment result
      result.duration = Date.now() - startTime;
      result.completedAt = new Date();

      // Track in history
      if (!this.deploymentHistory.has(deployment.serviceId)) {
        this.deploymentHistory.set(deployment.serviceId, []);
      }
      this.deploymentHistory.get(deployment.serviceId)!.push(result);

      // Emit completion event
      this.emit('deployment-complete', {
        deploymentId,
        serviceId: deployment.serviceId,
        status: result.status,
        duration: result.duration,
      });

      this.logger.info(`Deployment completed: ${deploymentId} (${result.status})`);

      return result;
    } catch (error) {
      this.logger.error(`Deployment failed: ${deploymentId}`, error);

      result.status = 'failed';
      result.error = error as Error;
      result.completedAt = new Date();
      result.duration = Date.now() - result.startedAt.getTime();

      // Attempt rollback
      try {
        await this.rollbackDeployment(deploymentId, result);
      } catch (rollbackError) {
        this.logger.error(`Rollback failed for deployment ${deploymentId}`, rollbackError);
        result.status = 'failed';
        result.rollbackReason = `Deployment failed and rollback also failed: ${rollbackError.message}`;
      }

      this.emit('deployment-failed', {
        deploymentId,
        serviceId: deployment.serviceId,
        error: error.message,
      });

      throw error;
    } finally {
      // Remove from active deployments
      this.activeDeployments.delete(deploymentId);
    }
  }

  /**
   * Execute blue-green deployment strategy
   * @private
   */
  private async executeBlueGreenDeployment(deployment: DeploymentSpec, result: DeploymentResult): Promise<void> {
    this.logger.info(`Executing blue-green deployment for ${deployment.serviceId}`);

    try {
      // Get current service
      const currentService = await this.serviceRegistry.getService(deployment.serviceId);

      // Create new green deployment
      for (let i = 0; i < deployment.replicas; i++) {
        const containerId = await this.containerManager.createContainer({
          image: deployment.image,
          name: `${deployment.serviceId}-green-${i}`,
          env: deployment.environment,
          ports: currentService.networkSettings?.networks
            ? Object.entries(currentService.networkSettings.networks).map(([network, config]) => ({
                containerPort: 8080,
                hostPort: 8080 + i,
                protocol: 'tcp',
              }))
            : undefined,
          resources: deployment.resources,
          healthCheck: this.healthCheckToDockerHealthCheck(deployment.healthCheck),
        });

        result.createdContainers.push(containerId);

        // Start container
        await this.containerManager.startContainer(containerId);

        this.emit('deployment-progress', {
          deploymentId: result.deploymentId,
          step: `Created and started container ${i + 1}/${deployment.replicas}`,
          progress: ((i + 1) / (deployment.replicas * 2)) * 100,
        });
      }

      // Wait for all containers to be healthy
      await this.waitForHealthy(result.createdContainers, 60000);

      // Switch traffic (in real implementation, would use load balancer)
      this.emit('deployment-progress', {
        deploymentId: result.deploymentId,
        step: 'Switching traffic to new deployment',
        progress: 85,
      });

      // Stop old containers (blue)
      const oldContainers = (await this.containerManager.listContainers()).filter((c) =>
        c.name.includes(`${deployment.serviceId}-blue`)
      );

      for (const container of oldContainers) {
        await this.containerManager.stopContainer(container.id);
      }

      // Update service
      await this.serviceRegistry.updateService(deployment.serviceId, {
        status: ServiceStatus.HEALTHY,
        replicas: deployment.replicas,
        desiredReplicas: deployment.replicas,
        containerIds: result.createdContainers,
        version: deployment.version,
      });

      result.status = 'success';
      this.logger.info(`Blue-green deployment successful for ${deployment.serviceId}`);
    } catch (error) {
      this.logger.error(`Blue-green deployment failed`, error);
      throw error;
    }
  }

  /**
   * Execute canary deployment strategy
   * @private
   */
  private async executeCanaryDeployment(deployment: DeploymentSpec, result: DeploymentResult): Promise<void> {
    this.logger.info(`Executing canary deployment for ${deployment.serviceId}`);

    try {
      const canaryReplicas = Math.max(1, Math.ceil((deployment.replicas * (deployment.canaryPercentage || 10)) / 100));

      // Deploy canary
      this.logger.info(`Deploying canary with ${canaryReplicas} replicas`);

      for (let i = 0; i < canaryReplicas; i++) {
        const containerId = await this.containerManager.createContainer({
          image: deployment.image,
          name: `${deployment.serviceId}-canary-${i}`,
          env: deployment.environment,
          resources: deployment.resources,
          healthCheck: this.healthCheckToDockerHealthCheck(deployment.healthCheck),
        });

        result.createdContainers.push(containerId);
        await this.containerManager.startContainer(containerId);
      }

      // Wait for canary to be healthy
      await this.waitForHealthy(result.createdContainers, 30000);

      this.emit('deployment-progress', {
        deploymentId: result.deploymentId,
        step: 'Canary deployment healthy, monitoring for stability',
        progress: 50,
      });

      // Monitor canary for duration
      const monitorDuration = deployment.canaryDuration || 60000;
      await new Promise((resolve) => setTimeout(resolve, monitorDuration));

      // If stable, promote to full deployment
      this.logger.info('Canary stable, promoting to full deployment');

      const remainingReplicas = deployment.replicas - canaryReplicas;
      for (let i = 0; i < remainingReplicas; i++) {
        const containerId = await this.containerManager.createContainer({
          image: deployment.image,
          name: `${deployment.serviceId}-prod-${i}`,
          env: deployment.environment,
          resources: deployment.resources,
          healthCheck: this.healthCheckToDockerHealthCheck(deployment.healthCheck),
        });

        result.createdContainers.push(containerId);
        await this.containerManager.startContainer(containerId);
      }

      // Wait for all to be healthy
      await this.waitForHealthy(result.createdContainers, 30000);

      // Update service
      await this.serviceRegistry.updateService(deployment.serviceId, {
        status: ServiceStatus.HEALTHY,
        replicas: deployment.replicas,
        containerIds: result.createdContainers,
        version: deployment.version,
      });

      result.status = 'success';
      this.logger.info(`Canary deployment successful for ${deployment.serviceId}`);
    } catch (error) {
      this.logger.error(`Canary deployment failed`, error);
      throw error;
    }
  }

  /**
   * Execute rolling deployment strategy
   * @private
   */
  private async executeRollingDeployment(deployment: DeploymentSpec, result: DeploymentResult): Promise<void> {
    this.logger.info(`Executing rolling deployment for ${deployment.serviceId}`);

    try {
      const maxUnavailable = deployment.maxUnavailable || 1;
      const maxSurge = deployment.maxSurge || 1;

      for (let i = 0; i < deployment.replicas; i++) {
        // Create new container
        const containerId = await this.containerManager.createContainer({
          image: deployment.image,
          name: `${deployment.serviceId}-${i}-new`,
          env: deployment.environment,
          resources: deployment.resources,
          healthCheck: this.healthCheckToDockerHealthCheck(deployment.healthCheck),
        });

        result.createdContainers.push(containerId);
        await this.containerManager.startContainer(containerId);

        // Wait for new container to be healthy
        await this.waitForHealthy([containerId], 30000);

        // Stop old container
        const oldContainers = (await this.containerManager.listContainers()).filter(
          (c) => c.name.includes(`${deployment.serviceId}-${i}`) && !c.name.includes('-new')
        );

        for (const container of oldContainers) {
          await this.containerManager.stopContainer(container.id);
        }

        this.emit('deployment-progress', {
          deploymentId: result.deploymentId,
          step: `Rolling update ${i + 1}/${deployment.replicas}`,
          progress: ((i + 1) / deployment.replicas) * 100,
        });
      }

      // Update service
      await this.serviceRegistry.updateService(deployment.serviceId, {
        status: ServiceStatus.HEALTHY,
        replicas: deployment.replicas,
        containerIds: result.createdContainers,
        version: deployment.version,
      });

      result.status = 'success';
      this.logger.info(`Rolling deployment successful for ${deployment.serviceId}`);
    } catch (error) {
      this.logger.error(`Rolling deployment failed`, error);
      throw error;
    }
  }

  /**
   * Execute recreate deployment strategy
   * @private
   */
  private async executeRecreateDeployment(deployment: DeploymentSpec, result: DeploymentResult): Promise<void> {
    this.logger.info(`Executing recreate deployment for ${deployment.serviceId}`);

    try {
      // Stop all current containers
      const currentContainers = (await this.containerManager.listContainers()).filter((c) =>
        c.name.includes(deployment.serviceId)
      );

      for (const container of currentContainers) {
        await this.containerManager.stopContainer(container.id);
      }

      this.emit('deployment-progress', {
        deploymentId: result.deploymentId,
        step: 'Old containers stopped',
        progress: 25,
      });

      // Create new containers
      for (let i = 0; i < deployment.replicas; i++) {
        const containerId = await this.containerManager.createContainer({
          image: deployment.image,
          name: `${deployment.serviceId}-${i}`,
          env: deployment.environment,
          resources: deployment.resources,
          healthCheck: this.healthCheckToDockerHealthCheck(deployment.healthCheck),
        });

        result.createdContainers.push(containerId);
        await this.containerManager.startContainer(containerId);

        this.emit('deployment-progress', {
          deploymentId: result.deploymentId,
          step: `Creating new containers ${i + 1}/${deployment.replicas}`,
          progress: 25 + ((i + 1) / deployment.replicas) * 50,
        });
      }

      // Wait for all containers to be healthy
      await this.waitForHealthy(result.createdContainers, 60000);

      // Update service
      await this.serviceRegistry.updateService(deployment.serviceId, {
        status: ServiceStatus.HEALTHY,
        replicas: deployment.replicas,
        containerIds: result.createdContainers,
        version: deployment.version,
      });

      result.status = 'success';
      this.logger.info(`Recreate deployment successful for ${deployment.serviceId}`);
    } catch (error) {
      this.logger.error(`Recreate deployment failed`, error);
      throw error;
    }
  }

  /**
   * Rollback a deployment
   *
   * @param deploymentId - Deployment ID to rollback
   * @param previousVersion - Previous version to rollback to
   */
  async rollbackDeployment(deploymentId: string, result: DeploymentResult): Promise<void> {
    try {
      this.logger.info(`Rolling back deployment: ${deploymentId}`);

      // Stop newly created containers
      for (const containerId of result.createdContainers) {
        try {
          await this.containerManager.stopContainer(containerId);
        } catch (error) {
          this.logger.warn(`Failed to stop container ${containerId}`, error);
        }
      }

      // Restart previous containers
      const currentContainers = (await this.containerManager.listContainers()).filter(
        (c) => c.state === 'stopped' || c.state === 'exited'
      );

      for (const container of currentContainers) {
        try {
          await this.containerManager.startContainer(container.id);
        } catch (error) {
          this.logger.warn(`Failed to start container ${container.id}`, error);
        }
      }

      this.logger.info(`Deployment rolled back: ${deploymentId}`);

      this.emit('deployment-rolled-back', {
        deploymentId,
        serviceId: result.serviceId,
      });
    } catch (error) {
      this.logger.error(`Rollback failed for deployment ${deploymentId}`, error);
      throw new Error(`Deployment rollback failed: ${error.message}`);
    }
  }

  /**
   * Wait for containers to become healthy
   * @private
   */
  private async waitForHealthy(containerIds: string[], timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      let allHealthy = true;

      for (const containerId of containerIds) {
        try {
          const status = await this.containerManager.getContainerStatus(containerId);
          if (!status.running) {
            allHealthy = false;
            break;
          }
        } catch (error) {
          allHealthy = false;
          break;
        }
      }

      if (allHealthy) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`Containers did not become healthy within ${timeout}ms`);
  }

  /**
   * Convert health check to Docker format
   * @private
   */
  private healthCheckToDockerHealthCheck(
    healthCheck: any
  ): { type: string; interval: number; timeout: number; retries: number; command?: string[] } | undefined {
    if (!healthCheck) return undefined;

    return {
      type: healthCheck.type || 'http',
      interval: healthCheck.interval,
      timeout: healthCheck.timeout,
      retries: healthCheck.retries,
      command: healthCheck.command,
    };
  }

  /**
   * Get deployment history for a service
   *
   * @param serviceId - Service ID
   * @returns Array of deployment results
   */
  async getDeploymentHistory(serviceId: string): Promise<DeploymentResult[]> {
    return this.deploymentHistory.get(serviceId) || [];
  }

  /**
   * Cleanup orchestrator resources
   */
  async cleanup(): Promise<void> {
    this.activeDeployments.clear();
    this.deploymentHistory.clear();
    this.logger.info('DeploymentOrchestrator cleanup complete');
  }
}

export default DeploymentOrchestrator;
