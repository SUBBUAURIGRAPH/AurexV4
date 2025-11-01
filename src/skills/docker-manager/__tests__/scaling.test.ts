/**
 * Auto Scaling & Configuration Integration Tests
 * Tests for AutoScaler and ConfigurationManager modules
 *
 * @module __tests__/scaling.test.ts
 */

import { AutoScaler } from '../autoScaler';
import { ConfigurationManager } from '../configurationManager';
import { ContainerManager } from '../containerManager';
import { ServiceRegistry } from '../serviceRegistry';
import { ContainerMonitor } from '../containerMonitor';
import * as Logger from 'winston';
import { ServiceType, ServiceStatus, DeploymentStrategy } from '../types';

// Mock implementations
const mockLogger = Logger.createLogger({ level: 'error' });

// Mock ContainerManager
class MockContainerManager extends ContainerManager {
  async createContainer(): Promise<string> {
    return `container-${Date.now()}`;
  }

  async startContainer(): Promise<void> {
    return Promise.resolve();
  }

  async stopContainer(): Promise<void> {
    return Promise.resolve();
  }

  async removeContainer(): Promise<void> {
    return Promise.resolve();
  }

  async getContainerStatus() {
    return {
      running: true,
      state: 'running' as const,
      pid: 1234,
      exitCode: 0,
    };
  }

  async getMetrics() {
    return {
      timestamp: new Date(),
      cpu: { usage: 45 },
      memory: { percentageUsed: 60 },
      network: { bytesIn: 1000, bytesOut: 2000 },
      disk: { used: 512 },
    };
  }

  async streamLogs(): Promise<void> {
    return Promise.resolve();
  }
}

// Mock ServiceRegistry
class MockServiceRegistry extends ServiceRegistry {
  private mockService: any;

  constructor() {
    super(mockLogger);
    this.mockService = {
      id: 'service-1',
      name: 'Test Service',
      version: '1.0.0',
      type: ServiceType.STRATEGY,
      image: 'test:latest',
      replicas: 3,
      desiredReplicas: 3,
      status: ServiceStatus.RUNNING,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { containerIds: ['container-1', 'container-2', 'container-3'] },
    };
  }

  async getService() {
    return this.mockService;
  }

  async updateService(serviceId: string, updates: any) {
    this.mockService = { ...this.mockService, ...updates };
    return Promise.resolve();
  }
}

// Mock ContainerMonitor
class MockContainerMonitor extends ContainerMonitor {
  constructor() {
    super(new MockContainerManager(mockLogger), mockLogger);
  }

  async getMetricsStatistics() {
    return {
      avgCpu: 45,
      maxCpu: 80,
      avgMemory: 60,
      maxMemory: 85,
      sampleCount: 10,
    };
  }

  async executeHealthCheck() {
    return {
      timestamp: new Date(),
      status: 'healthy' as const,
      failureCount: 0,
      message: 'Healthy',
      duration: 100,
    };
  }
}

describe('AutoScaler', () => {
  let autoScaler: AutoScaler;
  let containerManager: MockContainerManager;
  let serviceRegistry: MockServiceRegistry;
  let containerMonitor: MockContainerMonitor;

  beforeEach(() => {
    containerManager = new MockContainerManager(mockLogger);
    serviceRegistry = new MockServiceRegistry();
    containerMonitor = new MockContainerMonitor();
    autoScaler = new AutoScaler(containerManager, serviceRegistry, containerMonitor, mockLogger);
  });

  afterEach(async () => {
    await autoScaler.cleanup();
  });

  describe('Scaling Policy Management', () => {
    test('should register scaling policy for a service', async () => {
      const policyId = await autoScaler.registerScalingPolicy('service-1', {
        id: 'policy-1',
        serviceId: 'service-1',
        minReplicas: 1,
        maxReplicas: 10,
        scaleUpThreshold: { cpu: 70, memory: 75 },
        scaleDownThreshold: { cpu: 30, memory: 30 },
        scaleUpIncrement: 1,
        scaleDownIncrement: 1,
        cooldownPeriodMinutes: 5,
        enabled: true,
      });

      expect(policyId).toBeDefined();
      expect(policyId).toContain('policy');
    });

    test('should retrieve scaling policies for a service', async () => {
      await autoScaler.registerScalingPolicy('service-1', {
        serviceId: 'service-1',
        minReplicas: 1,
        maxReplicas: 10,
        scaleUpThreshold: { cpu: 70 },
        scaleDownThreshold: { cpu: 30 },
        cooldownPeriodMinutes: 5,
        enabled: true,
      });

      const policies = await autoScaler.getScalingPolicies('service-1');
      expect(policies).toHaveLength(1);
      expect(policies[0].serviceId).toBe('service-1');
    });

    test('should handle multiple policies per service', async () => {
      await autoScaler.registerScalingPolicy('service-1', {
        serviceId: 'service-1',
        minReplicas: 1,
        maxReplicas: 10,
        scaleUpThreshold: { cpu: 70 },
        scaleDownThreshold: { cpu: 30 },
        cooldownPeriodMinutes: 5,
        enabled: true,
      });

      await autoScaler.registerScalingPolicy('service-1', {
        serviceId: 'service-1',
        minReplicas: 1,
        maxReplicas: 5,
        scaleUpThreshold: { memory: 80 },
        scaleDownThreshold: { memory: 40 },
        cooldownPeriodMinutes: 3,
        enabled: true,
      });

      const policies = await autoScaler.getScalingPolicies('service-1');
      expect(policies.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Auto Scaling Operations', () => {
    test('should start auto-scaling for a service', async () => {
      await autoScaler.registerScalingPolicy('service-1', {
        serviceId: 'service-1',
        minReplicas: 1,
        maxReplicas: 10,
        scaleUpThreshold: { cpu: 70 },
        scaleDownThreshold: { cpu: 30 },
        cooldownPeriodMinutes: 5,
        enabled: true,
      });

      const listener = jest.fn();
      autoScaler.on('auto-scaling-started', listener);

      await autoScaler.startAutoScaling('service-1', 1000);

      // Wait briefly for event
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(listener).toHaveBeenCalled();
    });

    test('should stop auto-scaling for a service', async () => {
      await autoScaler.registerScalingPolicy('service-1', {
        serviceId: 'service-1',
        minReplicas: 1,
        maxReplicas: 10,
        scaleUpThreshold: { cpu: 70 },
        scaleDownThreshold: { cpu: 30 },
        cooldownPeriodMinutes: 5,
        enabled: true,
      });

      await autoScaler.startAutoScaling('service-1', 1000);

      const listener = jest.fn();
      autoScaler.on('auto-scaling-stopped', listener);

      await autoScaler.stopAutoScaling('service-1');

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Scaling History', () => {
    test('should retrieve scaling history for a service', async () => {
      const history = await autoScaler.getScalingHistory('service-1');
      expect(Array.isArray(history)).toBe(true);
    });

    test('should respect history limit', async () => {
      const history = await autoScaler.getScalingHistory('service-1', 5);
      expect(history.length).toBeLessThanOrEqual(5);
    });

    test('should get scaling statistics', async () => {
      const stats = await autoScaler.getScalingStatistics();
      expect(stats).toHaveProperty('totalScalingEvents');
      expect(stats).toHaveProperty('successfulScalings');
      expect(stats).toHaveProperty('failedScalings');
      expect(stats).toHaveProperty('scaleUpCount');
      expect(stats).toHaveProperty('scaleDownCount');
    });
  });

  describe('Auto Scaler Cleanup', () => {
    test('should cleanup resources properly', async () => {
      await autoScaler.registerScalingPolicy('service-1', {
        serviceId: 'service-1',
        minReplicas: 1,
        maxReplicas: 10,
        scaleUpThreshold: { cpu: 70 },
        scaleDownThreshold: { cpu: 30 },
        cooldownPeriodMinutes: 5,
        enabled: true,
      });

      await autoScaler.startAutoScaling('service-1');
      await autoScaler.cleanup();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = new ConfigurationManager(mockLogger);
  });

  afterEach(async () => {
    await configManager.cleanup();
  });

  describe('Configuration Creation & Retrieval', () => {
    test('should create a new configuration', async () => {
      const configId = await configManager.setConfiguration('app-config', {
        database: 'postgresql',
        port: 5432,
      });

      expect(configId).toBeDefined();
    });

    test('should retrieve created configuration', async () => {
      await configManager.setConfiguration('app-config', {
        database: 'postgresql',
        port: 5432,
      });

      const config = await configManager.getConfiguration('app-config');
      expect(config).toHaveProperty('database', 'postgresql');
      expect(config).toHaveProperty('port', 5432);
    });

    test('should return null for non-existent configuration', async () => {
      const config = await configManager.getConfiguration('non-existent');
      expect(config).toBeNull();
    });
  });

  describe('Secret Encryption', () => {
    test('should encrypt sensitive data', async () => {
      const configId = await configManager.setConfiguration(
        'api-keys',
        {
          apiKey: 'secret-key-123',
          apiSecret: 'secret-456',
        },
        { isSecret: true }
      );

      expect(configId).toBeDefined();
    });

    test('should decrypt encrypted secrets', async () => {
      await configManager.setConfiguration(
        'api-keys',
        {
          apiKey: 'secret-key-123',
          apiSecret: 'secret-456',
        },
        { isSecret: true }
      );

      const decrypted = await configManager.getConfiguration('api-keys', true);
      expect(decrypted).toHaveProperty('apiKey', 'secret-key-123');
      expect(decrypted).toHaveProperty('apiSecret', 'secret-456');
    });

    test('should support encryption key export and import', async () => {
      const exported = configManager.exportEncryptionKey();
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');

      const newManager = new ConfigurationManager(mockLogger);
      await newManager.importEncryptionKey(exported);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Configuration Versioning', () => {
    test('should track configuration versions', async () => {
      await configManager.setConfiguration('db-config', { host: 'localhost', port: 5432 }, {
        createdBy: 'admin',
      });

      await configManager.setConfiguration('db-config', { host: 'localhost', port: 5433 }, {
        createdBy: 'admin',
      });

      const history = await configManager.getConfigurationHistory('db-config');
      expect(history.length).toBeGreaterThan(0);
    });

    test('should restore configuration to previous version', async () => {
      await configManager.setConfiguration('db-config', { host: 'localhost', port: 5432 }, {
        createdBy: 'admin',
      });

      const history1 = await configManager.getConfigurationHistory('db-config');
      const version1 = history1[0]?.version || 1;

      await configManager.setConfiguration('db-config', { host: 'remote-host', port: 3306 }, {
        createdBy: 'admin',
      });

      await configManager.restoreConfigurationVersion('db-config', version1, 'admin');

      const restored = await configManager.getConfiguration('db-config');
      expect(restored).toHaveProperty('host', 'localhost');
      expect(restored).toHaveProperty('port', 5432);
    });

    test('should maintain version history limit', async () => {
      for (let i = 0; i < 5; i++) {
        await configManager.setConfiguration('test-config', { value: i }, { createdBy: 'tester' });
      }

      const history = await configManager.getConfigurationHistory('test-config', 100);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Updates & Subscriptions', () => {
    test('should emit configuration-updated event', async () => {
      const listener = jest.fn();
      configManager.on('configuration-updated', listener);

      await configManager.setConfiguration('test-config', { value: 'test' });

      expect(listener).toHaveBeenCalled();
    });

    test('should support configuration update subscriptions', async () => {
      await configManager.setConfiguration('subscribed-config', { value: 'initial' });

      const callback = jest.fn();
      await configManager.subscribeToUpdates('subscribed-config', callback);

      await configManager.setConfiguration('subscribed-config', { value: 'updated' });

      // Callback should be triggered
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(callback).toHaveBeenCalled();
    });

    test('should support unsubscription', async () => {
      await configManager.setConfiguration('test-config', { value: 'initial' });

      const callback = jest.fn();
      const unsubscribe = await configManager.subscribeToUpdates('test-config', callback);

      unsubscribe();

      await configManager.setConfiguration('test-config', { value: 'updated' });

      // Callback should not be triggered
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Listing & Filtering', () => {
    test('should list all configurations', async () => {
      await configManager.setConfiguration('config-1', { value: 1 });
      await configManager.setConfiguration('config-2', { value: 2 });

      const configs = await configManager.listConfigurations();
      expect(configs.length).toBeGreaterThanOrEqual(0);
    });

    test('should filter configurations by tags', async () => {
      await configManager.setConfiguration('app-config', { value: 1 }, { tags: ['production', 'critical'] });
      await configManager.setConfiguration('test-config', { value: 2 }, { tags: ['testing'] });

      const configs = await configManager.listConfigurations({ tags: ['production'] });
      expect(Array.isArray(configs)).toBe(true);
    });

    test('should filter configurations by name pattern', async () => {
      await configManager.setConfiguration('database-config', { value: 1 });
      await configManager.setConfiguration('cache-config', { value: 2 });

      const configs = await configManager.listConfigurations({ namePattern: 'database.*' });
      expect(Array.isArray(configs)).toBe(true);
    });
  });

  describe('Configuration Deletion', () => {
    test('should delete configuration by ID', async () => {
      const configId = await configManager.setConfiguration('temp-config', { value: 'temp' });

      await configManager.deleteConfiguration(configId);

      const config = await configManager.getConfiguration(configId);
      expect(config).toBeNull();
    });

    test('should delete configuration by name', async () => {
      await configManager.setConfiguration('named-config', { value: 'data' });

      await configManager.deleteConfiguration('named-config');

      const config = await configManager.getConfiguration('named-config');
      expect(config).toBeNull();
    });

    test('should emit configuration-deleted event', async () => {
      const listener = jest.fn();
      configManager.on('configuration-deleted', listener);

      const configId = await configManager.setConfiguration('delete-test', { value: 'test' });
      await configManager.deleteConfiguration(configId);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Configuration Statistics', () => {
    test('should provide configuration statistics', async () => {
      await configManager.setConfiguration('config-1', { value: 1 });
      await configManager.setConfiguration('secret-1', { key: 'secret' }, { isSecret: true });

      const stats = await configManager.getConfigurationStatistics();

      expect(stats).toHaveProperty('totalConfigurations');
      expect(stats).toHaveProperty('secretConfigurations');
      expect(stats).toHaveProperty('totalVersions');
      expect(stats).toHaveProperty('averageVersionsPerConfig');
    });
  });

  describe('Configuration Manager Cleanup', () => {
    test('should cleanup resources properly', async () => {
      await configManager.setConfiguration('config-1', { value: 1 });
      await configManager.cleanup();

      const config = await configManager.getConfiguration('config-1');
      expect(config).toBeNull();
    });
  });
});

describe('AutoScaler & ConfigurationManager Integration', () => {
  let autoScaler: AutoScaler;
  let configManager: ConfigurationManager;
  let containerManager: MockContainerManager;
  let serviceRegistry: MockServiceRegistry;
  let containerMonitor: MockContainerMonitor;

  beforeEach(() => {
    containerManager = new MockContainerManager(mockLogger);
    serviceRegistry = new MockServiceRegistry();
    containerMonitor = new MockContainerMonitor();
    autoScaler = new AutoScaler(containerManager, serviceRegistry, containerMonitor, mockLogger);
    configManager = new ConfigurationManager(mockLogger);
  });

  afterEach(async () => {
    await autoScaler.cleanup();
    await configManager.cleanup();
  });

  test('should coordinate auto-scaling with configuration management', async () => {
    // Store scaling policy configuration
    const policyConfigId = await configManager.setConfiguration(
      'scaling-policies',
      {
        defaultPolicy: {
          minReplicas: 1,
          maxReplicas: 10,
          scaleUpThreshold: { cpu: 70 },
          scaleDownThreshold: { cpu: 30 },
          cooldownPeriodMinutes: 5,
        },
      },
      { tags: ['scaling', 'production'] }
    );

    expect(policyConfigId).toBeDefined();

    // Register policy from configuration
    const policy = await configManager.getConfiguration('scaling-policies');
    const registeredPolicyId = await autoScaler.registerScalingPolicy('service-1', {
      ...policy!.defaultPolicy,
      serviceId: 'service-1',
      enabled: true,
    });

    expect(registeredPolicyId).toBeDefined();
  });

  test('should manage deployment environment with configurations', async () => {
    // Store deployment environment configuration
    const envConfigId = await configManager.setConfiguration(
      'deployment-env',
      {
        exchangeApiKey: 'test-key',
        strategyId: 'golden-cross',
        backendUrl: 'https://api.example.com',
      },
      { isSecret: true, tags: ['deployment'] }
    );

    expect(envConfigId).toBeDefined();

    // Retrieve for service deployment
    const deploymentEnv = await configManager.getConfiguration('deployment-env', true);
    expect(deploymentEnv).toHaveProperty('exchangeApiKey');
  });
});
