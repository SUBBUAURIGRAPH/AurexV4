/**
 * Integration Tests for Docker Manager Orchestration
 * Tests: ServiceRegistry, DeploymentOrchestrator, ContainerMonitor
 *
 * @group integration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as Logger from 'winston';
import {
  ServiceType,
  ServiceStatus,
  DeploymentStrategy,
  HealthCheckType,
  AlertLevel,
} from '../types';
import { ServiceRegistry } from '../serviceRegistry';
import { DeploymentOrchestrator } from '../deploymentOrchestrator';
import { ContainerMonitor } from '../containerMonitor';
import { ContainerManager } from '../containerManager';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as any;

describe('ServiceRegistry Integration', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry(mockLogger);
  });

  afterEach(async () => {
    await registry.cleanup();
  });

  it('should register and retrieve a service', async () => {
    const serviceId = await registry.registerService({
      id: 'test-service-1',
      name: 'Test Service',
      version: '1.0.0',
      type: ServiceType.STRATEGY,
      image: 'test:latest',
      replicas: 2,
      desiredReplicas: 2,
      status: ServiceStatus.PENDING,
      healthCheck: {
        type: HealthCheckType.HTTP,
        endpoint: '/health',
        interval: 5000,
        timeout: 2000,
        retries: 3,
      },
      dependencies: [],
      metadata: {},
      labels: { env: 'test' },
      environment: {},
      resources: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(serviceId).toBe('test-service-1');

    const service = await registry.getService('test-service-1');
    expect(service.name).toBe('Test Service');
    expect(service.version).toBe('1.0.0');
  });

  it('should list services with filtering', async () => {
    await registry.registerService({
      id: 'strategy-service-1',
      name: 'Strategy Service',
      version: '1.0.0',
      type: ServiceType.STRATEGY,
      image: 'test:latest',
      replicas: 1,
      desiredReplicas: 1,
      status: ServiceStatus.RUNNING,
      healthCheck: { type: HealthCheckType.HTTP, endpoint: '/health', interval: 5000, timeout: 2000, retries: 3 },
      dependencies: [],
      metadata: {},
      labels: { category: 'strategy' },
      environment: {},
      resources: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await registry.registerService({
      id: 'api-service-1',
      name: 'API Service',
      version: '1.0.0',
      type: ServiceType.API,
      image: 'test:latest',
      replicas: 1,
      desiredReplicas: 1,
      status: ServiceStatus.RUNNING,
      healthCheck: { type: HealthCheckType.HTTP, endpoint: '/health', interval: 5000, timeout: 2000, retries: 3 },
      dependencies: [],
      metadata: {},
      labels: { category: 'api' },
      environment: {},
      resources: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const strategyServices = await registry.listServices({ type: ServiceType.STRATEGY });
    expect(strategyServices).toHaveLength(1);
    expect(strategyServices[0].type).toBe(ServiceType.STRATEGY);
  });

  it('should update service configuration', async () => {
    await registry.registerService({
      id: 'test-service-update',
      name: 'Test Service',
      version: '1.0.0',
      type: ServiceType.WORKER,
      image: 'test:latest',
      replicas: 1,
      desiredReplicas: 1,
      status: ServiceStatus.PENDING,
      healthCheck: { type: HealthCheckType.HTTP, endpoint: '/health', interval: 5000, timeout: 2000, retries: 3 },
      dependencies: [],
      metadata: {},
      labels: {},
      environment: {},
      resources: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await registry.updateService('test-service-update', {
      version: '1.0.1',
      replicas: 3,
      status: ServiceStatus.RUNNING,
    });

    const updated = await registry.getService('test-service-update');
    expect(updated.version).toBe('1.0.1');
    expect(updated.replicas).toBe(3);
    expect(updated.status).toBe(ServiceStatus.RUNNING);
  });

  it('should track dependencies correctly', async () => {
    // Register database service
    await registry.registerService({
      id: 'postgres-db',
      name: 'PostgreSQL',
      version: '13',
      type: ServiceType.MONITOR,
      image: 'postgres:13',
      replicas: 1,
      desiredReplicas: 1,
      status: ServiceStatus.RUNNING,
      healthCheck: { type: HealthCheckType.TCP, interval: 10000, timeout: 5000, retries: 3 },
      dependencies: [],
      metadata: {},
      labels: {},
      environment: {},
      resources: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Register service that depends on database
    await registry.registerService({
      id: 'app-service',
      name: 'App',
      version: '1.0.0',
      type: ServiceType.API,
      image: 'app:latest',
      replicas: 1,
      desiredReplicas: 1,
      status: ServiceStatus.PENDING,
      healthCheck: { type: HealthCheckType.HTTP, endpoint: '/health', interval: 5000, timeout: 2000, retries: 3 },
      dependencies: [
        {
          serviceId: 'postgres-db',
          serviceName: 'PostgreSQL',
          dependencyType: 'strong',
        },
      ],
      metadata: {},
      labels: {},
      environment: {},
      resources: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const dependents = await registry.getDependents('postgres-db');
    expect(dependents).toContain('app-service');

    const deps = await registry.getDependencies('app-service');
    expect(deps).toHaveLength(1);
    expect(deps[0].serviceId).toBe('postgres-db');
  });

  it('should generate statistics', async () => {
    for (let i = 0; i < 3; i++) {
      await registry.registerService({
        id: `service-${i}`,
        name: `Service ${i}`,
        version: '1.0.0',
        type: i % 2 === 0 ? ServiceType.STRATEGY : ServiceType.API,
        image: 'test:latest',
        replicas: i + 1,
        desiredReplicas: i + 1,
        status: ServiceStatus.RUNNING,
        healthCheck: { type: HealthCheckType.HTTP, endpoint: '/health', interval: 5000, timeout: 2000, retries: 3 },
        dependencies: [],
        metadata: {},
        labels: {},
        environment: {},
        resources: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const stats = await registry.getStatistics();
    expect(stats.totalServices).toBe(3);
    expect(stats.totalReplicas).toBe(6); // 1 + 2 + 3
  });
});

describe('DeploymentOrchestrator Integration', () => {
  let registry: ServiceRegistry;
  let containerManager: ContainerManager;
  let orchestrator: DeploymentOrchestrator;

  beforeEach(() => {
    registry = new ServiceRegistry(mockLogger);
    containerManager = {
      createContainer: jest.fn().mockResolvedValue('container-123'),
      startContainer: jest.fn().mockResolvedValue(undefined),
      stopContainer: jest.fn().mockResolvedValue(undefined),
      getContainerStatus: jest.fn().mockResolvedValue({
        id: 'container-123',
        running: true,
        state: 'running',
      }),
      listContainers: jest.fn().mockResolvedValue([]),
      getMetrics: jest.fn().mockResolvedValue({
        cpu: { usage: 20 },
        memory: { percentageUsed: 30 },
      }),
    } as any;
    orchestrator = new DeploymentOrchestrator(registry, containerManager, mockLogger);
  });

  afterEach(async () => {
    await registry.cleanup();
    await orchestrator.cleanup();
  });

  it('should plan a deployment', async () => {
    // Register service first
    await registry.registerService({
      id: 'test-app',
      name: 'Test App',
      version: '1.0.0',
      type: ServiceType.API,
      image: 'app:1.0.0',
      replicas: 1,
      desiredReplicas: 1,
      status: ServiceStatus.RUNNING,
      healthCheck: { type: HealthCheckType.HTTP, endpoint: '/health', interval: 5000, timeout: 2000, retries: 3 },
      dependencies: [],
      metadata: {},
      labels: {},
      environment: {},
      resources: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const plan = await orchestrator.planDeployment({
      serviceId: 'test-app',
      serviceName: 'Test App',
      image: 'app:1.0.1',
      version: '1.0.1',
      strategy: DeploymentStrategy.ROLLING,
      replicas: 1,
      healthCheck: { type: HealthCheckType.HTTP, endpoint: '/health', interval: 5000, timeout: 2000, retries: 3 },
      environment: {},
      resources: {},
    });

    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.totalSteps).toBe(plan.steps.length);
  });

  it('should validate deployment dependencies', async () => {
    await registry.registerService({
      id: 'app-with-deps',
      name: 'App',
      version: '1.0.0',
      type: ServiceType.API,
      image: 'app:latest',
      replicas: 1,
      desiredReplicas: 1,
      status: ServiceStatus.RUNNING,
      healthCheck: { type: HealthCheckType.HTTP, endpoint: '/health', interval: 5000, timeout: 2000, retries: 3 },
      dependencies: [
        {
          serviceId: 'nonexistent-service',
          serviceName: 'Nonexistent',
          dependencyType: 'strong',
        },
      ],
      metadata: {},
      labels: {},
      environment: {},
      resources: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const plan = await orchestrator.planDeployment({
      serviceId: 'app-with-deps',
      serviceName: 'App',
      image: 'app:latest',
      version: '1.0.0',
      strategy: DeploymentStrategy.BLUE_GREEN,
      replicas: 1,
      healthCheck: { type: HealthCheckType.HTTP, endpoint: '/health', interval: 5000, timeout: 2000, retries: 3 },
      environment: {},
      resources: {},
    });

    expect(plan).toBeDefined();
  });

  it('should track deployment history', async () => {
    await registry.registerService({
      id: 'tracked-service',
      name: 'Tracked',
      version: '1.0.0',
      type: ServiceType.WORKER,
      image: 'worker:latest',
      replicas: 1,
      desiredReplicas: 1,
      status: ServiceStatus.RUNNING,
      healthCheck: { type: HealthCheckType.TCP, interval: 5000, timeout: 2000, retries: 3 },
      dependencies: [],
      metadata: {},
      labels: {},
      environment: {},
      resources: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const history = await orchestrator.getDeploymentHistory('tracked-service');
    expect(Array.isArray(history)).toBe(true);
  });
});

describe('ContainerMonitor Integration', () => {
  let containerManager: ContainerManager;
  let monitor: ContainerMonitor;

  beforeEach(() => {
    containerManager = {
      getMetrics: jest.fn().mockResolvedValue({
        timestamp: new Date(),
        containerId: 'test-container',
        containerName: 'test',
        cpu: { usage: 45, userTime: 1000, systemTime: 500, throttledTime: 0, cores: 2 },
        memory: { used: 1073741824, limit: 2147483648, cached: 536870912, rss: 536870912, percentageUsed: 50, pageCache: 268435456 },
        disk: { used: 0, available: 0, readOps: 0, writeOps: 0, readBytes: 0, writeBytes: 0, iopsRead: 0, iopsWrite: 0 },
        network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0, errors: 0, dropped: 0, interfaces: [] },
        processes: { count: 10, runningCount: 8, zombieCount: 0, processes: [] },
      }),
      getContainerStatus: jest.fn().mockResolvedValue({
        id: 'test-container',
        running: true,
        state: 'running',
      }),
    } as any;
    monitor = new ContainerMonitor(containerManager, mockLogger, 100);
  });

  afterEach(async () => {
    await monitor.cleanup();
  });

  it('should collect metrics', async () => {
    await monitor.monitorContainer('test-container', 1000);

    // Wait for first metric collection
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const metrics = await monitor.getMetrics('test-container');
    expect(metrics).toBeDefined();

    if (Array.isArray(metrics)) {
      expect(metrics[0].containerId).toBe('test-container');
    } else {
      expect(metrics.containerId).toBe('test-container');
    }

    await monitor.stopMonitoring('test-container');
  });

  it('should execute health checks', async () => {
    const result = await monitor.executeHealthCheck('test-container');
    expect(result.status).toBe('healthy');
    expect(result.timestamp).toBeDefined();
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should set and retrieve alerts', async () => {
    const alertId = await monitor.setAlert('test-container', {
      id: 'alert-1',
      containerId: 'test-container',
      condition: 'cpu > 80 for 5m',
      level: AlertLevel.CRITICAL,
      actions: [],
      enabled: true,
    });

    expect(alertId).toBeDefined();

    const alerts = await monitor.getAlerts('test-container');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].condition).toBe('cpu > 80 for 5m');
  });

  it('should calculate metrics statistics', async () => {
    // Collect some metrics first
    const containerManager2 = {
      getMetrics: jest.fn()
        .mockResolvedValueOnce({
          timestamp: new Date(),
          containerId: 'stats-container',
          containerName: 'stats',
          cpu: { usage: 30, userTime: 500, systemTime: 250, throttledTime: 0, cores: 2 },
          memory: { used: 536870912, limit: 2147483648, cached: 268435456, rss: 268435456, percentageUsed: 25, pageCache: 134217728 },
          disk: { used: 0, available: 0, readOps: 0, writeOps: 0, readBytes: 0, writeBytes: 0, iopsRead: 0, iopsWrite: 0 },
          network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0, errors: 0, dropped: 0, interfaces: [] },
          processes: { count: 5, runningCount: 5, zombieCount: 0, processes: [] },
        })
        .mockResolvedValueOnce({
          timestamp: new Date(),
          containerId: 'stats-container',
          containerName: 'stats',
          cpu: { usage: 50, userTime: 1000, systemTime: 500, throttledTime: 0, cores: 2 },
          memory: { used: 805306368, limit: 2147483648, cached: 402653184, rss: 402653184, percentageUsed: 37.5, pageCache: 201326592 },
          disk: { used: 0, available: 0, readOps: 0, writeOps: 0, readBytes: 0, writeBytes: 0, iopsRead: 0, iopsWrite: 0 },
          network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0, errors: 0, dropped: 0, interfaces: [] },
          processes: { count: 8, runningCount: 7, zombieCount: 0, processes: [] },
        }),
      getContainerStatus: jest.fn().mockResolvedValue({
        id: 'stats-container',
        running: true,
        state: 'running',
      }),
    } as any;

    const monitor2 = new ContainerMonitor(containerManager2, mockLogger, 100);
    await monitor2.monitorContainer('stats-container', 500);

    // Wait for metrics to collect
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const stats = await monitor2.getMetricsStatistics('stats-container');
    expect(stats.sampleCount).toBeGreaterThan(0);
    expect(stats.avgCpu).toBeGreaterThan(0);

    await monitor2.cleanup();
  });
});

describe('Multi-Module Integration', () => {
  let registry: ServiceRegistry;
  let containerManager: ContainerManager;
  let orchestrator: DeploymentOrchestrator;
  let monitor: ContainerMonitor;

  beforeEach(() => {
    registry = new ServiceRegistry(mockLogger);
    containerManager = {
      createContainer: jest.fn().mockResolvedValue('container-xyz'),
      startContainer: jest.fn().mockResolvedValue(undefined),
      stopContainer: jest.fn().mockResolvedValue(undefined),
      removeContainer: jest.fn().mockResolvedValue(undefined),
      restartContainer: jest.fn().mockResolvedValue(undefined),
      getContainerStatus: jest.fn().mockResolvedValue({
        id: 'container-xyz',
        running: true,
        state: 'running',
      }),
      listContainers: jest.fn().mockResolvedValue([]),
      getMetrics: jest.fn().mockResolvedValue({
        cpu: { usage: 25 },
        memory: { percentageUsed: 40 },
      }),
    } as any;
    orchestrator = new DeploymentOrchestrator(registry, containerManager, mockLogger);
    monitor = new ContainerMonitor(containerManager, mockLogger);
  });

  afterEach(async () => {
    await registry.cleanup();
    await orchestrator.cleanup();
    await monitor.cleanup();
  });

  it('should coordinate between registry, orchestrator, and monitor', async () => {
    // Register service
    const serviceId = await registry.registerService({
      id: 'coordinated-service',
      name: 'Coordinated',
      version: '1.0.0',
      type: ServiceType.STRATEGY,
      image: 'service:latest',
      replicas: 1,
      desiredReplicas: 1,
      status: ServiceStatus.PENDING,
      healthCheck: { type: HealthCheckType.HTTP, endpoint: '/health', interval: 5000, timeout: 2000, retries: 3 },
      dependencies: [],
      metadata: {},
      labels: { env: 'test' },
      environment: { TEST: 'true' },
      resources: { cpuLimit: 1000, memoryLimit: 1073741824 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(serviceId).toBe('coordinated-service');

    // Start monitoring
    await monitor.monitorContainer('container-xyz', 1000);

    // Plan deployment
    const plan = await orchestrator.planDeployment({
      serviceId: 'coordinated-service',
      serviceName: 'Coordinated',
      image: 'service:latest',
      version: '1.0.0',
      strategy: DeploymentStrategy.ROLLING,
      replicas: 1,
      healthCheck: { type: HealthCheckType.HTTP, endpoint: '/health', interval: 5000, timeout: 2000, retries: 3 },
      environment: { TEST: 'true' },
      resources: { cpuLimit: 1000, memoryLimit: 1073741824 },
    });

    expect(plan.steps.length).toBeGreaterThan(0);

    // Stop monitoring
    await monitor.stopMonitoring('container-xyz');
  });
});
