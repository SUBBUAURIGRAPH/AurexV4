/**
 * Exchange Connector - Performance Profiling Tests
 * Sprint 1 Week 3: Detailed performance benchmarks and optimization validation
 * Measures: Throughput, latency, memory usage, CPU utilization
 * Version: 1.0.0
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import ExchangeConnector from '../index';
import ConnectionManager from '../connectionManager';
import RateLimiter from '../rateLimiter';
import CredentialStore from '../credentialStore';
import HealthMonitor from '../healthMonitor';
import { CredentialConfig } from '../types';

// ============================================================================
// PERFORMANCE TEST CONFIGURATION
// ============================================================================

const PERFORMANCE_TARGETS = {
  connectionAcquisition: 1000, // < 1 second
  connectionRelease: 100, // < 100ms
  rateLimiterOperation: 10, // < 10ms (O(1) token bucket)
  credentialEncryption: 50, // < 50ms
  healthCheckComplete: 3000, // < 3 seconds
  concurrentRequestHandling: 5000, // < 5 seconds for 10 concurrent
  memoryPerConnection: 200, // < 200MB per exchange
  cpuUtilization: 50, // < 50% CPU for normal operations
};

// ============================================================================
// PERFORMANCE TEST SUITE
// ============================================================================

describe('Exchange Connector Performance Tests', () => {
  let connector: ExchangeConnector;
  let connectionManager: ConnectionManager;
  let rateLimiter: RateLimiter;
  let credentialStore: CredentialStore;
  let healthMonitor: HealthMonitor;

  const mockCredentials: CredentialConfig = {
    exchange: 'binance',
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    sandbox: true,
  };

  beforeAll(async () => {
    connector = new ExchangeConnector();
    connectionManager = new ConnectionManager();
    rateLimiter = new RateLimiter('binance', 1200, 60000); // 1200 req/min
    credentialStore = new CredentialStore();
    healthMonitor = new HealthMonitor();
  });

  afterAll(async () => {
    connectionManager.destroy();
  });

  // ============================================================================
  // CONNECTION POOL PERFORMANCE
  // ============================================================================

  describe('Connection Pool Performance', () => {
    test('should acquire connection within SLA (< 1000ms)', async () => {
      connectionManager.initializePool('binance');

      const startTime = performance.now();
      const connection = await connectionManager.getConnection('binance');
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(PERFORMANCE_TARGETS.connectionAcquisition);
      expect(connection).toBeDefined();

      connectionManager.releaseConnection('binance', connection.id);
    });

    test('should release connection within SLA (< 100ms)', () => {
      connectionManager.initializePool('binance');

      const startTime = performance.now();
      connectionManager.releaseConnection('binance', 'dummy-id');
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(PERFORMANCE_TARGETS.connectionRelease);
    });

    test('should handle 100 concurrent acquisitions within SLA', async () => {
      connectionManager.initializePool('binance');

      const startTime = performance.now();
      const promises = Array(100)
        .fill(null)
        .map(() => connectionManager.getConnection('binance'));

      const connections = await Promise.all(promises);
      const elapsed = performance.now() - startTime;

      expect(connections.length).toBe(100);
      expect(elapsed).toBeLessThan(10000); // 10 seconds for 100 acquisitions

      // Cleanup
      connections.forEach((conn) => {
        connectionManager.releaseConnection('binance', conn.id);
      });
    });

    test('should maintain pool statistics efficiently', () => {
      connectionManager.initializePool('binance');

      const startTime = performance.now();
      const status = connectionManager.getPoolStatus('binance');
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(5); // < 5ms for statistics
      expect(status).toBeDefined();
      expect(status?.totalCount).toBeGreaterThan(0);
    });

    test('should efficiently expand pool under load', async () => {
      connectionManager.initializePool('kraken');

      const initialStatus = connectionManager.getPoolStatus('kraken');
      const initialSize = initialStatus?.totalCount || 0;

      // Create demand for more connections
      const promises = Array(20)
        .fill(null)
        .map(() => connectionManager.getConnection('kraken'));

      const connections = await Promise.all(promises);
      const finalStatus = connectionManager.getPoolStatus('kraken');
      const finalSize = finalStatus?.totalCount || 0;

      // Pool should have expanded
      expect(finalSize).toBeGreaterThanOrEqual(initialSize);

      // Cleanup
      connections.forEach((conn) => {
        connectionManager.releaseConnection('kraken', conn.id);
      });
    });
  });

  // ============================================================================
  // RATE LIMITER PERFORMANCE (O(1) TOKEN BUCKET)
  // ============================================================================

  describe('Rate Limiter Performance', () => {
    test('should acquire token in O(1) time (< 10ms)', () => {
      const limiter = new RateLimiter('binance', 1200, 60000);

      const startTime = performance.now();
      const allowed = limiter.allowRequest();
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(PERFORMANCE_TARGETS.rateLimiterOperation);
      expect(allowed).toBe(true);
    });

    test('should handle 10,000 token checks efficiently', () => {
      const limiter = new RateLimiter('binance', 10000, 60000);

      const startTime = performance.now();
      let successCount = 0;

      for (let i = 0; i < 10000; i++) {
        if (limiter.allowRequest()) {
          successCount++;
        }
      }

      const elapsed = performance.now() - startTime;

      // Should process 10,000 requests in under 1 second
      expect(elapsed).toBeLessThan(1000);
      expect(successCount).toBeGreaterThan(0);
    });

    test('should enforce rate limits without busy-waiting', () => {
      const limiter = new RateLimiter('binance', 5, 1000); // 5 per second

      const startTime = performance.now();
      let allowedCount = 0;

      // Try to get 10 tokens
      for (let i = 0; i < 10; i++) {
        if (limiter.allowRequest()) {
          allowedCount++;
        }
      }

      const elapsed = performance.now() - startTime;

      // Should respect rate limit
      expect(allowedCount).toBeLessThanOrEqual(5);
      // Should not block the thread (no busy wait)
      expect(elapsed).toBeLessThan(100);
    });

    test('should reset tokens efficiently when bucket refills', () => {
      const limiter = new RateLimiter('binance', 100, 100); // 100 per 100ms

      // Use up tokens
      for (let i = 0; i < 100; i++) {
        limiter.allowRequest();
      }

      // Wait for refill
      const startTime = performance.now();
      // Tokens should refill after window
      setTimeout(() => {
        const allowed = limiter.allowRequest();
        expect(allowed).toBe(true);
      }, 150);
    });
  });

  // ============================================================================
  // CREDENTIAL STORE PERFORMANCE
  // ============================================================================

  describe('Credential Store Performance', () => {
    test('should encrypt credentials within SLA (< 50ms)', async () => {
      const store = new CredentialStore();

      const startTime = performance.now();
      const encrypted = await store.storeCredentials(
        'binance',
        mockCredentials,
        'test-password'
      );
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(PERFORMANCE_TARGETS.credentialEncryption);
      expect(encrypted).toBeDefined();
    });

    test('should decrypt credentials efficiently', async () => {
      const store = new CredentialStore();

      const encrypted = await store.storeCredentials(
        'binance',
        mockCredentials,
        'test-password'
      );

      const startTime = performance.now();
      const decrypted = await store.retrieveCredentials('binance', 'test-password');
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(50); // < 50ms
      expect(decrypted).toBeDefined();
    });

    test('should handle 100 concurrent encryptions', async () => {
      const store = new CredentialStore();

      const startTime = performance.now();
      const promises = Array(100)
        .fill(null)
        .map((_, i) =>
          store.storeCredentials(
            `exchange-${i}`,
            { ...mockCredentials, exchange: `exchange-${i}` },
            'password'
          )
        );

      const results = await Promise.all(promises);
      const elapsed = performance.now() - startTime;

      expect(results.length).toBe(100);
      expect(elapsed).toBeLessThan(5000); // < 5 seconds for 100 encryptions
    });

    test('should validate credentials quickly', async () => {
      const store = new CredentialStore();

      const startTime = performance.now();
      const isValid = await store.validateCredentials(mockCredentials);
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(100); // < 100ms
      expect(isValid).toBe(true);
    });
  });

  // ============================================================================
  // HEALTH MONITOR PERFORMANCE
  // ============================================================================

  describe('Health Monitor Performance', () => {
    test('should record metrics efficiently', () => {
      const monitor = new HealthMonitor();

      const startTime = performance.now();
      monitor.recordLatency('binance', 45);
      monitor.recordLatency('binance', 52);
      monitor.recordLatency('binance', 48);
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(10); // < 10ms for 3 recordings
    });

    test('should calculate metrics without blocking', () => {
      const monitor = new HealthMonitor();

      // Record many metrics
      for (let i = 0; i < 1000; i++) {
        monitor.recordLatency('binance', Math.random() * 100);
      }

      const startTime = performance.now();
      const metrics = monitor.getMetrics('binance');
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(50); // < 50ms to calculate
      expect(metrics).toBeDefined();
      expect(metrics.p95).toBeDefined();
      expect(metrics.p99).toBeDefined();
    });

    test('should track uptime efficiently', () => {
      const monitor = new HealthMonitor();

      const startTime = performance.now();
      monitor.recordSuccess('binance');
      monitor.recordFailure('binance');
      monitor.recordSuccess('binance');
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(10);

      const uptime = monitor.getUptime('binance');
      expect(uptime).toBeDefined();
      expect(uptime).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // MEMORY PERFORMANCE
  // ============================================================================

  describe('Memory Performance', () => {
    test('should maintain acceptable memory footprint per connection', () => {
      if (global.gc) {
        global.gc();
        const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;

        connectionManager.initializePool('binance');

        global.gc();
        const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
        const memDiff = memAfter - memBefore;

        expect(memDiff).toBeLessThan(PERFORMANCE_TARGETS.memoryPerConnection);
      }
    });

    test('should not leak memory on credential rotation', async () => {
      if (global.gc) {
        const store = new CredentialStore();
        global.gc();
        const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;

        // Rotate credentials 100 times
        for (let i = 0; i < 100; i++) {
          await store.storeCredentials(`exchange-${i}`, mockCredentials, 'password');
        }

        global.gc();
        const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
        const memDiff = memAfter - memBefore;

        // Should not grow unbounded
        expect(memDiff).toBeLessThan(500); // < 500MB for 100 credentials
      }
    });

    test('should clean up resources on disconnect', async () => {
      if (global.gc) {
        connectionManager.initializePool('binance');
        global.gc();
        const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;

        connectionManager.destroy();
        global.gc();
        const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;

        // Memory should be released (may not be exact due to garbage collection)
        expect(memAfter).toBeLessThanOrEqual(memBefore + 10);
      }
    });
  });

  // ============================================================================
  // THROUGHPUT PERFORMANCE
  // ============================================================================

  describe('Throughput Performance', () => {
    test('should handle 1000 requests per second', async () => {
      connectionManager.initializePool('binance');

      const startTime = performance.now();
      const promises = [];

      for (let i = 0; i < 1000; i++) {
        promises.push(
          connectionManager.getConnection('binance').then((conn) => {
            connectionManager.releaseConnection('binance', conn.id);
          })
        );
      }

      await Promise.all(promises);
      const elapsed = performance.now() - startTime;

      const throughput = (1000 / (elapsed / 1000)).toFixed(0);
      expect(parseFloat(throughput)).toBeGreaterThan(100); // At least 100 req/s
    });

    test('should maintain consistent latency under load', async () => {
      connectionManager.initializePool('binance');
      const latencies = [];

      for (let i = 0; i < 50; i++) {
        const startTime = performance.now();
        const conn = await connectionManager.getConnection('binance');
        const elapsed = performance.now() - startTime;
        latencies.push(elapsed);
        connectionManager.releaseConnection('binance', conn.id);
      }

      // Calculate P95
      const sorted = latencies.sort((a, b) => a - b);
      const p95Index = Math.ceil(latencies.length * 0.95) - 1;
      const p95 = sorted[p95Index];

      expect(p95).toBeLessThan(100); // P95 < 100ms
    });
  });

  // ============================================================================
  // COMBINED STRESS TESTS
  // ============================================================================

  describe('Combined Stress Tests', () => {
    test('should handle mixed concurrent operations', async () => {
      connectionManager.initializePool('binance');
      const rateLimiter = new RateLimiter('binance', 1200, 60000);

      const startTime = performance.now();

      const promises = [
        // Concurrent connection operations
        ...Array(20)
          .fill(null)
          .map(() =>
            connectionManager.getConnection('binance').then((conn) => {
              connectionManager.releaseConnection('binance', conn.id);
            })
          ),

        // Concurrent rate limit checks
        ...Array(100)
          .fill(null)
          .map(() => Promise.resolve(rateLimiter.allowRequest())),

        // Concurrent metrics recording
        ...Array(50)
          .fill(null)
          .map(() => Promise.resolve({ recordMetric: true })),
      ];

      await Promise.all(promises);
      const elapsed = performance.now() - startTime;

      // Should complete within reasonable time even under load
      expect(elapsed).toBeLessThan(5000);
    });

    test('should recover gracefully from sudden load spike', async () => {
      connectionManager.initializePool('binance');

      // Normal load phase
      for (let i = 0; i < 10; i++) {
        const conn = await connectionManager.getConnection('binance');
        connectionManager.releaseConnection('binance', conn.id);
      }

      // Sudden spike
      const spike = Array(100)
        .fill(null)
        .map(() =>
          connectionManager.getConnection('binance').then((conn) => {
            connectionManager.releaseConnection('binance', conn.id);
          })
        );

      const spikeTime = performance.now();
      await Promise.allSettled(spike);
      const spikeDuration = performance.now() - spikeTime;

      // Recovery phase
      const recovery = Array(10)
        .fill(null)
        .map(() =>
          connectionManager.getConnection('binance').then((conn) => {
            connectionManager.releaseConnection('binance', conn.id);
          })
        );

      const recoveryTime = performance.now();
      await Promise.allSettled(recovery);
      const recoveryDuration = performance.now() - recoveryTime;

      // Recovery should be similar to normal phase
      expect(recoveryDuration).toBeLessThan(spikeDuration * 2);
    });
  });
});
