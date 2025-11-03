# Sync Manager Integration Guide

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Basic Usage](#basic-usage)
4. [Integration Examples](#integration-examples)
5. [Configuration Guide](#configuration-guide)
6. [Monitoring and Health Checks](#monitoring-and-health-checks)
7. [Troubleshooting](#troubleshooting)
8. [API Reference](#api-reference)

## Quick Start

Get started with Sync Manager in under 5 minutes:

```typescript
import { SyncManager, SyncType, SyncPriority } from './services/syncManager';

// Initialize with default configuration
const syncManager = new SyncManager();

// Start the sync manager
await syncManager.start();

// Queue a sync operation
const syncId = await syncManager.queueSync({
  id: 'balance-sync-1',
  type: SyncType.EXCHANGE_BALANCE,
  source: 'binance',
  destination: 'local-db',
}, SyncPriority.HIGH);

// Monitor sync completion
syncManager.on('sync:completed', (result) => {
  console.log('Sync completed:', result);
});

// Check health
const health = syncManager.getHealthStatus();
console.log('Health:', health);
```

## Installation

### Prerequisites

- Node.js >= 18.0.0
- TypeScript >= 5.2.2
- Existing HMS project structure

### Setup

The Sync Manager is included in the HMS services directory:

```bash
# Navigate to HMS project
cd C:\subbuworking\HMS

# No additional installation needed - already included
```

### TypeScript Configuration

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "moduleResolution": "node",
    "target": "ES2020",
    "module": "ESNext"
  }
}
```

## Basic Usage

### Initialize Sync Manager

```typescript
import { SyncManager, ConflictResolutionStrategy } from './services/syncManager';

const syncManager = new SyncManager({
  enableRealtime: true,
  batchSize: 100,
  retryAttempts: 3,
  retryBackoffMs: 1000,
  conflictStrategy: ConflictResolutionStrategy.LAST_WRITE_WINS,
  syncIntervals: {
    [SyncType.EXCHANGE_BALANCE]: 30000,
    [SyncType.PORTFOLIO_POSITION]: 10000,
    [SyncType.ORDER_STATUS]: 5000,
  },
  maxConcurrentSyncs: 10,
  performanceThresholdMs: 100,
});

await syncManager.start();
```

### Queue Individual Sync

```typescript
import { SyncType, SyncPriority } from './services/syncManager';

const syncId = await syncManager.queueSync({
  id: 'my-sync-operation',
  type: SyncType.EXCHANGE_BALANCE,
  source: 'binance-api',
  destination: 'postgres-db',
  metadata: {
    exchange: 'binance',
    userId: 'user123',
  },
}, SyncPriority.NORMAL);

console.log('Sync queued with ID:', syncId);
```

### Execute Immediate Sync

```typescript
try {
  const result = await syncManager.executeSync({
    id: 'urgent-sync',
    type: SyncType.ORDER_STATUS,
    source: 'kraken-api',
    destination: 'local-cache',
  });

  if (result.success) {
    console.log(`Sync completed in ${result.duration}ms`);
    console.log(`Records affected: ${result.recordsAffected}`);
  }
} catch (error) {
  console.error('Sync failed:', error);
}
```

### Batch Sync Operations

```typescript
const targets = [
  { id: 'btc-balance', type: SyncType.EXCHANGE_BALANCE, source: 'binance', destination: 'db' },
  { id: 'eth-balance', type: SyncType.EXCHANGE_BALANCE, source: 'binance', destination: 'db' },
  { id: 'sol-balance', type: SyncType.EXCHANGE_BALANCE, source: 'binance', destination: 'db' },
];

const results = await syncManager.batchSync(targets);

results.forEach((result, index) => {
  console.log(`Sync ${index + 1}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
});
```

## Integration Examples

### Example 1: Exchange Balance Synchronization

```typescript
/**
 * Sync exchange balances to local database
 */
import { SyncManager, SyncType, SyncPriority } from './services/syncManager';
import { ExchangeConnector } from './skills/exchange-connector';

class BalanceSyncService {
  private syncManager: SyncManager;
  private exchangeConnector: ExchangeConnector;

  constructor() {
    this.syncManager = new SyncManager({
      conflictStrategy: ConflictResolutionStrategy.HIGHEST_VALUE,
      syncIntervals: {
        [SyncType.EXCHANGE_BALANCE]: 30000, // 30 seconds
      },
    });

    this.exchangeConnector = new ExchangeConnector();
  }

  async initialize(): Promise<void> {
    await this.syncManager.start();

    // Listen for periodic sync events
    this.syncManager.on('sync:periodic', async (event) => {
      if (event.syncType === SyncType.EXCHANGE_BALANCE) {
        await this.syncAllBalances();
      }
    });

    // Listen for sync completion
    this.syncManager.on('sync:completed', (result) => {
      console.log(`Balance sync completed: ${result.syncId}`);
    });

    // Listen for conflicts
    this.syncManager.on('sync:conflict', (conflict) => {
      console.warn('Balance conflict detected:', conflict);
    });
  }

  async syncAllBalances(): Promise<void> {
    const exchanges = ['binance', 'kraken', 'coinbase'];

    for (const exchange of exchanges) {
      await this.syncManager.queueSync({
        id: `balance-${exchange}-${Date.now()}`,
        type: SyncType.EXCHANGE_BALANCE,
        source: exchange,
        destination: 'postgres',
        metadata: { exchange },
      }, SyncPriority.HIGH);
    }
  }

  async syncSingleExchange(exchangeName: string): Promise<void> {
    const result = await this.syncManager.executeSync({
      id: `balance-${exchangeName}-immediate`,
      type: SyncType.EXCHANGE_BALANCE,
      source: exchangeName,
      destination: 'postgres',
    });

    if (!result.success) {
      throw new Error(`Failed to sync ${exchangeName}: ${result.error?.message}`);
    }

    console.log(`Synced ${result.recordsAffected} balances from ${exchangeName}`);
  }

  async getHealthStatus() {
    return this.syncManager.getHealthStatus();
  }

  async shutdown(): Promise<void> {
    await this.syncManager.stop();
  }
}

// Usage
const balanceSync = new BalanceSyncService();
await balanceSync.initialize();
await balanceSync.syncAllBalances();
```

### Example 2: Portfolio Position Reconciliation

```typescript
/**
 * Reconcile portfolio positions with exchange balances
 */
import { SyncManager, SyncType, ConflictResolutionStrategy } from './services/syncManager';

class PortfolioSyncService {
  private syncManager: SyncManager;

  constructor() {
    this.syncManager = new SyncManager({
      conflictStrategy: ConflictResolutionStrategy.SOURCE_PRIORITY,
      sourcePriorities: [
        { source: 'exchange-api', priority: 10 },
        { source: 'local-positions', priority: 5 },
      ],
    });
  }

  async initialize(): Promise<void> {
    await this.syncManager.start();

    // Handle conflicts specially for portfolio positions
    this.syncManager.on('sync:completed', (result) => {
      if (result.conflictResolution) {
        this.logConflictResolution(result);
      }
    });
  }

  async reconcilePortfolio(userId: string): Promise<void> {
    const result = await this.syncManager.executeSync({
      id: `portfolio-${userId}-${Date.now()}`,
      type: SyncType.PORTFOLIO_POSITION,
      source: 'exchange-api',
      destination: 'portfolio-db',
      metadata: {
        userId,
        reconciliationType: 'full',
      },
    });

    if (result.success) {
      console.log(`Portfolio reconciled for user ${userId}`);
      console.log(`Updated ${result.recordsAffected} positions`);

      if (result.conflictResolution) {
        console.log('Conflicts were resolved:', result.conflictResolution.strategy);
      }
    }
  }

  private logConflictResolution(result: any): void {
    console.log('=== CONFLICT RESOLUTION ===');
    console.log('Sync ID:', result.syncId);
    console.log('Strategy:', result.conflictResolution.strategy);
    console.log('Applied Value:', result.conflictResolution.appliedValue);
  }
}
```

### Example 3: Order Status Monitoring

```typescript
/**
 * Monitor and sync order status changes
 */
import { SyncManager, SyncType, SyncPriority } from './services/syncManager';

class OrderSyncService {
  private syncManager: SyncManager;
  private activeOrders: Set<string>;

  constructor() {
    this.syncManager = new SyncManager({
      syncIntervals: {
        [SyncType.ORDER_STATUS]: 5000, // Check every 5 seconds
      },
      performanceThresholdMs: 50, // Orders should sync quickly
    });

    this.activeOrders = new Set();
  }

  async initialize(): Promise<void> {
    await this.syncManager.start();

    // Monitor slow syncs
    this.syncManager.on('sync:slow', (event) => {
      console.warn(`Slow order sync detected: ${event.duration}ms (threshold: ${event.threshold}ms)`);
    });

    // Handle failed syncs
    this.syncManager.on('sync:failed', (result) => {
      console.error(`Order sync failed for ${result.target.id}:`, result.error);
      this.handleFailedOrderSync(result.target.id);
    });

    // Periodic sync for active orders
    this.syncManager.on('sync:periodic', async (event) => {
      if (event.syncType === SyncType.ORDER_STATUS) {
        await this.syncActiveOrders();
      }
    });
  }

  async trackOrder(orderId: string, exchange: string): Promise<void> {
    this.activeOrders.add(orderId);

    await this.syncManager.queueSync({
      id: `order-${orderId}`,
      type: SyncType.ORDER_STATUS,
      source: exchange,
      destination: 'order-db',
      metadata: {
        orderId,
        exchange,
        trackingStarted: new Date(),
      },
    }, SyncPriority.HIGH);
  }

  async syncActiveOrders(): Promise<void> {
    const syncPromises = Array.from(this.activeOrders).map(orderId =>
      this.syncManager.queueSync({
        id: `order-${orderId}`,
        type: SyncType.ORDER_STATUS,
        source: 'exchange',
        destination: 'order-db',
      }, SyncPriority.NORMAL)
    );

    await Promise.all(syncPromises);
  }

  private handleFailedOrderSync(orderId: string): void {
    // Implement retry logic or alerting
    console.log(`Attempting manual resolution for order ${orderId}`);
  }

  stopTracking(orderId: string): void {
    this.activeOrders.delete(orderId);
  }
}
```

### Example 4: Conflict Resolution Customization

```typescript
/**
 * Custom conflict resolution for strategy state
 */
import { ConflictResolver, ConflictResolutionStrategy } from './services/conflictResolver';
import { SyncManager } from './services/syncManager';

class StrategyStateSyncService {
  private syncManager: SyncManager;
  private conflictResolver: ConflictResolver;

  constructor() {
    // Custom conflict resolver for strategy state
    this.conflictResolver = new ConflictResolver(
      ConflictResolutionStrategy.CONSENSUS,
      {
        consensusThreshold: 0.7, // 70% agreement required
        enableManualReview: true,
        manualReviewTimeout: 60000, // 1 minute
      }
    );

    this.syncManager = new SyncManager({
      conflictStrategy: ConflictResolutionStrategy.CONSENSUS,
    });
  }

  async initialize(): Promise<void> {
    await this.syncManager.start();

    // Monitor conflicts that need manual review
    this.conflictResolver.registerValidator('strategyStateValid', (value: unknown) => {
      // Custom validation for strategy state
      return this.validateStrategyState(value);
    });
  }

  private validateStrategyState(state: unknown): boolean {
    // Implement custom validation logic
    if (!state || typeof state !== 'object') {
      return false;
    }

    const stateObj = state as Record<string, unknown>;
    return (
      'version' in stateObj &&
      'config' in stateObj &&
      'positions' in stateObj
    );
  }

  async syncStrategyState(strategyId: string): Promise<void> {
    const result = await this.syncManager.executeSync({
      id: `strategy-${strategyId}`,
      type: SyncType.STRATEGY_STATE,
      source: 'strategy-engine',
      destination: 'state-db',
      metadata: { strategyId },
    });

    if (!result.success) {
      console.error('Strategy state sync failed:', result.error);
    }
  }

  async resolveManualConflict(conflictId: string, resolvedValue: unknown): Promise<void> {
    this.conflictResolver.provideManualResolution(conflictId, resolvedValue);
  }

  getPendingConflicts() {
    return this.conflictResolver.getPendingManualReviews();
  }
}
```

### Example 5: Audit Log Querying

```typescript
/**
 * Query and export audit logs
 */
import { AuditLogger, AuditEventType, AuditSeverity } from './services/auditLogger';

class AuditService {
  private auditLogger: AuditLogger;

  constructor() {
    this.auditLogger = new AuditLogger({
      enableFileLogging: true,
      logDirectory: './logs/audit',
      retentionDays: 90,
      enableConsoleLogging: true,
    });
  }

  async querySyncEvents(startDate: Date, endDate: Date) {
    return this.auditLogger.query({
      startDate,
      endDate,
      types: [
        AuditEventType.SYNC_STARTED,
        AuditEventType.SYNC_COMPLETED,
        AuditEventType.SYNC_FAILED,
      ],
      limit: 1000,
    });
  }

  async queryFailedSyncs(limit: number = 100) {
    return this.auditLogger.query({
      types: [AuditEventType.SYNC_FAILED],
      severities: [AuditSeverity.ERROR, AuditSeverity.CRITICAL],
      limit,
    });
  }

  async exportComplianceReport(outputPath: string): Promise<void> {
    const last90Days = new Date();
    last90Days.setDate(last90Days.getDate() - 90);

    await this.auditLogger.exportToCsv(outputPath, {
      startDate: last90Days,
      types: [
        AuditEventType.SYNC_COMPLETED,
        AuditEventType.CONFLICT_RESOLVED,
        AuditEventType.DATA_VALIDATED,
      ],
    });

    console.log(`Compliance report exported to ${outputPath}`);
  }

  getStatistics() {
    return this.auditLogger.getStatistics();
  }

  async generateDailyReport(): Promise<void> {
    const stats = this.auditLogger.getStatistics();

    console.log('=== DAILY AUDIT REPORT ===');
    console.log(`Total Events: ${stats.totalEvents}`);
    console.log(`Average Events/Day: ${stats.averageEventsPerDay.toFixed(2)}`);
    console.log('\nEvents by Type:');
    Object.entries(stats.eventsByType).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`  ${type}: ${count}`);
      }
    });
    console.log('\nEvents by Severity:');
    Object.entries(stats.eventsBySeverity).forEach(([severity, count]) => {
      if (count > 0) {
        console.log(`  ${severity}: ${count}`);
      }
    });
  }
}
```

## Configuration Guide

### Environment-Based Configuration

```typescript
// config/sync-manager.config.ts

interface SyncManagerEnvironmentConfig {
  development: Partial<SyncConfig>;
  staging: Partial<SyncConfig>;
  production: Partial<SyncConfig>;
}

const config: SyncManagerEnvironmentConfig = {
  development: {
    enableRealtime: true,
    retryAttempts: 1,
    syncIntervals: {
      [SyncType.EXCHANGE_BALANCE]: 60000, // Slower in dev
      [SyncType.ORDER_STATUS]: 10000,
    },
    maxConcurrentSyncs: 5,
    performanceThresholdMs: 500,
  },
  staging: {
    enableRealtime: true,
    retryAttempts: 3,
    syncIntervals: {
      [SyncType.EXCHANGE_BALANCE]: 30000,
      [SyncType.ORDER_STATUS]: 5000,
    },
    maxConcurrentSyncs: 10,
    performanceThresholdMs: 200,
  },
  production: {
    enableRealtime: true,
    retryAttempts: 5,
    syncIntervals: {
      [SyncType.EXCHANGE_BALANCE]: 30000,
      [SyncType.ORDER_STATUS]: 2000,
    },
    maxConcurrentSyncs: 20,
    performanceThresholdMs: 100,
  },
};

export function getSyncConfig(): Partial<SyncConfig> {
  const env = process.env.NODE_ENV || 'development';
  return config[env as keyof SyncManagerEnvironmentConfig];
}
```

### Dynamic Configuration Updates

```typescript
// Update configuration at runtime
syncManager.updateConfig({
  syncIntervals: {
    [SyncType.EXCHANGE_BALANCE]: 15000, // Speed up to 15 seconds
  },
  maxConcurrentSyncs: 15,
});

// Listen for config changes
syncManager.on('config:updated', ({ oldConfig, newConfig }) => {
  console.log('Configuration updated:', {
    old: oldConfig,
    new: newConfig,
  });
});
```

## Monitoring and Health Checks

### Health Status Monitoring

```typescript
// Continuous health monitoring
setInterval(() => {
  const health = syncManager.getHealthStatus();

  if (!health.healthy) {
    console.error('SyncManager health degraded:');
    console.error(`- Active Syncs: ${health.activeSyncs}`);
    console.error(`- Queued Syncs: ${health.queuedSyncs}`);
    console.error(`- Failed (24h): ${health.failedSyncsLast24h}`);
    console.error(`- Avg Duration: ${health.averageSyncDurationMs.toFixed(2)}ms`);

    // Send alert
    alertingService.send({
      severity: 'warning',
      message: 'SyncManager health degraded',
      details: health,
    });
  }
}, 60000); // Check every minute
```

### Performance Metrics

```typescript
// Get and display metrics
const metrics = syncManager.getMetrics();

console.log('=== SYNC MANAGER METRICS ===');
console.log(`Total Syncs: ${metrics.totalSyncs}`);
console.log(`Success Rate: ${(metrics.successfulSyncs / metrics.totalSyncs * 100).toFixed(2)}%`);
console.log(`Failed: ${metrics.failedSyncs}`);
console.log(`Conflicts: ${metrics.conflictsSyncs}`);
console.log(`Avg Duration: ${metrics.averageDurationMs.toFixed(2)}ms`);
console.log(`P95 Duration: ${metrics.p95DurationMs.toFixed(2)}ms`);
console.log(`P99 Duration: ${metrics.p99DurationMs.toFixed(2)}ms`);
console.log(`Throughput: ${metrics.throughputPerSecond.toFixed(2)} ops/sec`);
console.log('\nSyncs by Type:');
Object.entries(metrics.syncsByType).forEach(([type, count]) => {
  console.log(`  ${type}: ${count}`);
});
```

### Event Monitoring

```typescript
// Comprehensive event logging
syncManager.on('sync:queued', ({ syncId, target }) => {
  console.log(`[QUEUED] ${syncId} - ${target.type}`);
});

syncManager.on('sync:started', ({ syncId, target }) => {
  console.log(`[STARTED] ${syncId} - ${target.type}`);
});

syncManager.on('sync:completed', (result) => {
  console.log(`[COMPLETED] ${result.syncId} - ${result.duration}ms - ${result.recordsAffected} records`);
});

syncManager.on('sync:failed', (result) => {
  console.error(`[FAILED] ${result.syncId} - ${result.error?.message}`);
});

syncManager.on('sync:slow', ({ syncId, duration, threshold }) => {
  console.warn(`[SLOW] ${syncId} - ${duration}ms (threshold: ${threshold}ms)`);
});

syncManager.on('health:degraded', (health) => {
  console.error('[HEALTH DEGRADED]', health);
});
```

## Troubleshooting

### Common Issues

#### Issue: High Failure Rate

```typescript
// Diagnose high failure rate
const metrics = syncManager.getMetrics();
const failureRate = metrics.failedSyncs / metrics.totalSyncs;

if (failureRate > 0.1) {
  console.error(`High failure rate: ${(failureRate * 100).toFixed(2)}%`);

  // Check dead letter queue
  const syncQueue = syncManager['syncQueue']; // Access internal queue
  const deadLetterOps = syncQueue.getDeadLetterQueue();

  console.log('Dead Letter Queue:', deadLetterOps);

  // Analyze failure patterns
  const recentFailures = auditLogger.query({
    types: [AuditEventType.SYNC_FAILED],
    limit: 100,
  });

  const errorCounts = new Map<string, number>();
  recentFailures.forEach(event => {
    const errorMsg = event.details?.error as string || 'Unknown';
    errorCounts.set(errorMsg, (errorCounts.get(errorMsg) || 0) + 1);
  });

  console.log('Top errors:', errorCounts);
}
```

#### Issue: Slow Sync Performance

```typescript
// Identify slow sync operations
const slowSyncs = auditLogger.query({
  types: [AuditEventType.SYNC_COMPLETED],
  limit: 1000,
}).filter(event => {
  const duration = event.duration || 0;
  return duration > 1000; // > 1 second
});

console.log(`Found ${slowSyncs.length} slow syncs`);

// Group by type
const slowByType = new Map<string, number>();
slowSyncs.forEach(sync => {
  const type = sync.details?.target?.type as string || 'unknown';
  slowByType.set(type, (slowByType.get(type) || 0) + 1);
});

console.log('Slow syncs by type:', slowByType);

// Recommendations
if (slowByType.size > 0) {
  console.log('\nRecommendations:');
  console.log('1. Increase batch size for bulk operations');
  console.log('2. Add caching layer for frequently accessed data');
  console.log('3. Optimize database queries');
  console.log('4. Consider increasing maxConcurrentSyncs');
}
```

#### Issue: Queue Overflow

```typescript
// Monitor queue depth
syncManager.on('queue:overflow', (event) => {
  console.error('Queue overflow detected!');

  const stats = syncManager['syncQueue'].getStatistics();
  console.log('Queue Stats:', stats);

  // Mitigation strategies
  if (stats.pendingOperations > 1000) {
    console.log('Mitigation: Increasing concurrent sync limit');
    syncManager.updateConfig({
      maxConcurrentSyncs: 20,
    });
  }

  if (stats.averageWaitTimeMs > 30000) {
    console.log('Mitigation: Pausing low-priority syncs');
    // Implement logic to pause BACKGROUND priority syncs
  }
});
```

## API Reference

### SyncManager

#### Methods

- `start(): Promise<void>` - Start sync manager
- `stop(): Promise<void>` - Stop sync manager
- `queueSync(target, priority): Promise<string>` - Queue sync operation
- `executeSync(target): Promise<SyncResult>` - Execute sync immediately
- `batchSync(targets): Promise<SyncResult[]>` - Batch sync multiple targets
- `getSyncStatus(syncId): SyncStatus | null` - Get sync status
- `getSyncResult(syncId): SyncResult | null` - Get sync result
- `getHealthStatus(): SyncHealthStatus` - Get health status
- `getMetrics(): SyncMetrics` - Get performance metrics
- `updateConfig(updates): void` - Update configuration

#### Events

- `started` - Manager started
- `stopped` - Manager stopped
- `sync:queued` - Sync queued
- `sync:started` - Sync started
- `sync:completed` - Sync completed
- `sync:failed` - Sync failed
- `sync:slow` - Slow sync detected
- `sync:periodic` - Periodic sync triggered
- `health:check` - Health check performed
- `health:degraded` - Health degraded
- `config:updated` - Configuration updated

## Best Practices

### 1. Always Start/Stop Properly

```typescript
// Good
const syncManager = new SyncManager();
await syncManager.start();
// ... use sync manager ...
await syncManager.stop();

// Bad - don't forget to stop
const syncManager = new SyncManager();
await syncManager.start();
// ... use sync manager ... (never stopped!)
```

### 2. Handle Events

```typescript
// Monitor important events
syncManager.on('sync:failed', (result) => {
  logger.error('Sync failed:', result);
  alertingService.notify(result);
});

syncManager.on('health:degraded', (health) => {
  pagerDuty.trigger('sync-manager-unhealthy', health);
});
```

### 3. Use Appropriate Priorities

```typescript
// Critical operations
syncManager.queueSync(target, SyncPriority.CRITICAL);

// Normal operations
syncManager.queueSync(target, SyncPriority.NORMAL);

// Background cleanup
syncManager.queueSync(target, SyncPriority.BACKGROUND);
```

### 4. Monitor Performance

```typescript
// Regular metrics collection
setInterval(() => {
  const metrics = syncManager.getMetrics();
  metricsCollector.record('sync_manager_ops_total', metrics.totalSyncs);
  metricsCollector.record('sync_manager_success_rate', metrics.successfulSyncs / metrics.totalSyncs);
  metricsCollector.record('sync_manager_avg_duration_ms', metrics.averageDurationMs);
}, 60000);
```

### 5. Implement Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await syncManager.stop();
  process.exit(0);
});
```

---

For additional support or questions, please refer to the architecture documentation or contact the development team.
