/**
 * Sync Manager Service
 * Orchestrates data synchronization across multiple components
 * Ensures consistency between exchange data, portfolios, orders, and strategies
 * @version 1.0.0
 */

import EventEmitter from 'events';
import { ConflictResolver, ConflictResolutionStrategy } from './conflictResolver';
import { SyncQueue, SyncOperation, SyncPriority } from './syncQueue';
import { AuditLogger, AuditEventType } from './auditLogger';
import { DataValidator, ValidationResult } from './dataValidator';

export enum SyncType {
  EXCHANGE_BALANCE = 'exchange_balance',
  PORTFOLIO_POSITION = 'portfolio_position',
  ORDER_STATUS = 'order_status',
  STRATEGY_STATE = 'strategy_state',
  MARKET_DATA = 'market_data',
  ACCOUNT_INFO = 'account_info',
}

export enum SyncStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CONFLICT = 'conflict',
  RETRYING = 'retrying',
}

export interface SyncTarget {
  id: string;
  type: SyncType;
  source: string;
  destination: string;
  metadata?: Record<string, unknown>;
}

export interface SyncResult {
  success: boolean;
  syncId: string;
  target: SyncTarget;
  status: SyncStatus;
  timestamp: Date;
  duration: number;
  recordsAffected: number;
  error?: Error;
  conflictResolution?: {
    strategy: ConflictResolutionStrategy;
    appliedValue: unknown;
  };
}

export interface SyncConfig {
  enableRealtime: boolean;
  batchSize: number;
  retryAttempts: number;
  retryBackoffMs: number;
  conflictStrategy: ConflictResolutionStrategy;
  syncIntervals: Record<SyncType, number>;
  enableDeadLetterQueue: boolean;
  maxConcurrentSyncs: number;
  healthCheckIntervalMs: number;
  performanceThresholdMs: number;
}

export interface SyncHealthStatus {
  healthy: boolean;
  activeSync s: number;
  queuedSyncs: number;
  failedSyncsLast24h: number;
  averageSyncDurationMs: number;
  lastSyncTime?: Date;
  errors: Array<{ timestamp: Date; error: string; target: string }>;
}

export interface SyncMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflictsSyncs: number;
  averageDurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  syncsByType: Record<SyncType, number>;
  throughputPerSecond: number;
}

/**
 * Main Sync Manager orchestration service
 * Coordinates all synchronization activities across the HMS platform
 */
export class SyncManager extends EventEmitter {
  private config: SyncConfig;
  private conflictResolver: ConflictResolver;
  private syncQueue: SyncQueue;
  private auditLogger: AuditLogger;
  private dataValidator: DataValidator;

  private activeSyncs: Map<string, SyncOperation>;
  private syncHistory: SyncResult[];
  private syncTimers: Map<SyncType, NodeJS.Timeout>;
  private isRunning: boolean;
  private healthCheckTimer?: NodeJS.Timeout;
  private metricsWindow: SyncResult[];
  private metricsWindowSizeMs: number;

  constructor(config?: Partial<SyncConfig>) {
    super();

    this.config = {
      enableRealtime: config?.enableRealtime ?? true,
      batchSize: config?.batchSize ?? 100,
      retryAttempts: config?.retryAttempts ?? 3,
      retryBackoffMs: config?.retryBackoffMs ?? 1000,
      conflictStrategy: config?.conflictStrategy ?? ConflictResolutionStrategy.LAST_WRITE_WINS,
      syncIntervals: config?.syncIntervals ?? {
        [SyncType.EXCHANGE_BALANCE]: 30000, // 30s
        [SyncType.PORTFOLIO_POSITION]: 10000, // 10s
        [SyncType.ORDER_STATUS]: 5000, // 5s
        [SyncType.STRATEGY_STATE]: 15000, // 15s
        [SyncType.MARKET_DATA]: 2000, // 2s
        [SyncType.ACCOUNT_INFO]: 60000, // 60s
      },
      enableDeadLetterQueue: config?.enableDeadLetterQueue ?? true,
      maxConcurrentSyncs: config?.maxConcurrentSyncs ?? 10,
      healthCheckIntervalMs: config?.healthCheckIntervalMs ?? 10000,
      performanceThresholdMs: config?.performanceThresholdMs ?? 100,
    };

    this.conflictResolver = new ConflictResolver(this.config.conflictStrategy);
    this.syncQueue = new SyncQueue({
      maxConcurrent: this.config.maxConcurrentSyncs,
      retryAttempts: this.config.retryAttempts,
      retryBackoffMs: this.config.retryBackoffMs,
      enableDeadLetterQueue: this.config.enableDeadLetterQueue,
    });
    this.auditLogger = new AuditLogger();
    this.dataValidator = new DataValidator();

    this.activeSyncs = new Map();
    this.syncHistory = [];
    this.syncTimers = new Map();
    this.isRunning = false;
    this.metricsWindow = [];
    this.metricsWindowSizeMs = 3600000; // 1 hour

    this.setupEventListeners();
  }

  /**
   * Start the sync manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('SyncManager is already running');
    }

    this.isRunning = true;
    this.emit('started');

    await this.auditLogger.log({
      type: AuditEventType.SYSTEM_START,
      timestamp: new Date(),
      actor: 'SyncManager',
      action: 'start',
      details: { config: this.config },
    });

    // Start periodic syncs
    this.startPeriodicSyncs();

    // Start health monitoring
    this.startHealthMonitoring();

    console.log('[SyncManager] Started successfully');
  }

  /**
   * Stop the sync manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear all timers
    this.syncTimers.forEach(timer => clearInterval(timer));
    this.syncTimers.clear();

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Wait for active syncs to complete
    await this.waitForActiveSyncs();

    await this.auditLogger.log({
      type: AuditEventType.SYSTEM_STOP,
      timestamp: new Date(),
      actor: 'SyncManager',
      action: 'stop',
      details: { activeSyncs: this.activeSyncs.size },
    });

    this.emit('stopped');
    console.log('[SyncManager] Stopped successfully');
  }

  /**
   * Queue a sync operation
   */
  async queueSync(target: SyncTarget, priority: SyncPriority = SyncPriority.NORMAL): Promise<string> {
    const syncId = this.generateSyncId(target);

    const operation: SyncOperation = {
      id: syncId,
      target,
      priority,
      status: SyncStatus.PENDING,
      createdAt: new Date(),
      retryCount: 0,
    };

    await this.syncQueue.enqueue(operation);

    await this.auditLogger.log({
      type: AuditEventType.SYNC_QUEUED,
      timestamp: new Date(),
      actor: 'SyncManager',
      action: 'queueSync',
      resource: syncId,
      details: { target, priority },
    });

    this.emit('sync:queued', { syncId, target });

    // Process queue
    this.processQueue();

    return syncId;
  }

  /**
   * Execute a sync operation immediately
   */
  async executeSync(target: SyncTarget): Promise<SyncResult> {
    const syncId = this.generateSyncId(target);
    const startTime = Date.now();

    try {
      // Validate sync target
      const validation = await this.validateSyncTarget(target);
      if (!validation.valid) {
        throw new Error(`Invalid sync target: ${validation.errors.join(', ')}`);
      }

      // Mark as in progress
      const operation: SyncOperation = {
        id: syncId,
        target,
        priority: SyncPriority.HIGH,
        status: SyncStatus.IN_PROGRESS,
        createdAt: new Date(),
        startedAt: new Date(),
        retryCount: 0,
      };

      this.activeSyncs.set(syncId, operation);

      await this.auditLogger.log({
        type: AuditEventType.SYNC_STARTED,
        timestamp: new Date(),
        actor: 'SyncManager',
        action: 'executeSync',
        resource: syncId,
        details: { target },
      });

      this.emit('sync:started', { syncId, target });

      // Perform the actual sync based on type
      const syncData = await this.performSync(target);

      // Check for conflicts
      const conflictCheck = await this.checkForConflicts(target, syncData);

      let finalData = syncData;
      let conflictResolution;

      if (conflictCheck.hasConflict) {
        conflictResolution = await this.resolveConflict(target, conflictCheck);
        finalData = conflictResolution.resolvedData;

        await this.auditLogger.log({
          type: AuditEventType.CONFLICT_DETECTED,
          timestamp: new Date(),
          actor: 'SyncManager',
          action: 'resolveConflict',
          resource: syncId,
          details: { conflict: conflictCheck, resolution: conflictResolution },
        });
      }

      // Apply the sync
      const recordsAffected = await this.applySyncData(target, finalData);

      const duration = Date.now() - startTime;

      const result: SyncResult = {
        success: true,
        syncId,
        target,
        status: SyncStatus.COMPLETED,
        timestamp: new Date(),
        duration,
        recordsAffected,
        conflictResolution: conflictResolution
          ? {
              strategy: this.config.conflictStrategy,
              appliedValue: conflictResolution.resolvedData,
            }
          : undefined,
      };

      this.recordSyncResult(result);
      this.activeSyncs.delete(syncId);

      await this.auditLogger.log({
        type: AuditEventType.SYNC_COMPLETED,
        timestamp: new Date(),
        actor: 'SyncManager',
        action: 'executeSync',
        resource: syncId,
        details: { result },
      });

      this.emit('sync:completed', result);

      // Performance warning
      if (duration > this.config.performanceThresholdMs) {
        this.emit('sync:slow', { syncId, duration, threshold: this.config.performanceThresholdMs });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      const result: SyncResult = {
        success: false,
        syncId,
        target,
        status: SyncStatus.FAILED,
        timestamp: new Date(),
        duration,
        recordsAffected: 0,
        error: error instanceof Error ? error : new Error(String(error)),
      };

      this.recordSyncResult(result);
      this.activeSyncs.delete(syncId);

      await this.auditLogger.log({
        type: AuditEventType.SYNC_FAILED,
        timestamp: new Date(),
        actor: 'SyncManager',
        action: 'executeSync',
        resource: syncId,
        details: { error: String(error), target },
      });

      this.emit('sync:failed', result);

      throw error;
    }
  }

  /**
   * Batch sync multiple targets
   */
  async batchSync(targets: SyncTarget[]): Promise<SyncResult[]> {
    const batches = this.createBatches(targets, this.config.batchSize);
    const results: SyncResult[] = [];

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(target => this.executeSync(target))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Create failed result for rejected promises
          const failedTarget = batch[batchResults.indexOf(result)];
          results.push({
            success: false,
            syncId: this.generateSyncId(failedTarget),
            target: failedTarget,
            status: SyncStatus.FAILED,
            timestamp: new Date(),
            duration: 0,
            recordsAffected: 0,
            error: result.reason,
          });
        }
      }
    }

    await this.auditLogger.log({
      type: AuditEventType.BATCH_SYNC,
      timestamp: new Date(),
      actor: 'SyncManager',
      action: 'batchSync',
      details: {
        totalTargets: targets.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    });

    return results;
  }

  /**
   * Get sync status by ID
   */
  getSyncStatus(syncId: string): SyncStatus | null {
    const active = this.activeSyncs.get(syncId);
    if (active) {
      return active.status;
    }

    const historical = this.syncHistory.find(s => s.syncId === syncId);
    return historical?.status ?? null;
  }

  /**
   * Get sync result by ID
   */
  getSyncResult(syncId: string): SyncResult | null {
    return this.syncHistory.find(s => s.syncId === syncId) ?? null;
  }

  /**
   * Get health status
   */
  getHealthStatus(): SyncHealthStatus {
    const now = Date.now();
    const last24h = now - 86400000;

    const recentFailures = this.syncHistory.filter(
      s => !s.success && s.timestamp.getTime() > last24h
    );

    const recentSyncs = this.syncHistory.filter(
      s => s.timestamp.getTime() > now - 60000
    );

    const avgDuration =
      recentSyncs.length > 0
        ? recentSyncs.reduce((sum, s) => sum + s.duration, 0) / recentSyncs.length
        : 0;

    return {
      healthy: this.isRunning && recentFailures.length < 10,
      activeSyncs: this.activeSyncs.size,
      queuedSyncs: this.syncQueue.getQueueSize(),
      failedSyncsLast24h: recentFailures.length,
      averageSyncDurationMs: avgDuration,
      lastSyncTime: this.syncHistory.length > 0 ? this.syncHistory[this.syncHistory.length - 1].timestamp : undefined,
      errors: recentFailures.slice(-5).map(f => ({
        timestamp: f.timestamp,
        error: f.error?.message ?? 'Unknown error',
        target: f.target.id,
      })),
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics(): SyncMetrics {
    const windowStart = Date.now() - this.metricsWindowSizeMs;
    const windowSyncs = this.metricsWindow.filter(
      s => s.timestamp.getTime() > windowStart
    );

    const successful = windowSyncs.filter(s => s.success);
    const failed = windowSyncs.filter(s => !s.success);
    const conflicts = windowSyncs.filter(s => s.conflictResolution);

    const durations = windowSyncs.map(s => s.duration).sort((a, b) => a - b);
    const avgDuration =
      durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;

    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    const syncsByType: Record<SyncType, number> = {
      [SyncType.EXCHANGE_BALANCE]: 0,
      [SyncType.PORTFOLIO_POSITION]: 0,
      [SyncType.ORDER_STATUS]: 0,
      [SyncType.STRATEGY_STATE]: 0,
      [SyncType.MARKET_DATA]: 0,
      [SyncType.ACCOUNT_INFO]: 0,
    };

    windowSyncs.forEach(s => {
      syncsByType[s.target.type]++;
    });

    const throughput = windowSyncs.length / (this.metricsWindowSizeMs / 1000);

    return {
      totalSyncs: windowSyncs.length,
      successfulSyncs: successful.length,
      failedSyncs: failed.length,
      conflictsSyncs: conflicts.length,
      averageDurationMs: avgDuration,
      p95DurationMs: durations[p95Index] ?? 0,
      p99DurationMs: durations[p99Index] ?? 0,
      syncsByType,
      throughputPerSecond: throughput,
    };
  }

  /**
   * Update sync configuration
   */
  updateConfig(updates: Partial<SyncConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };

    // Restart periodic syncs if intervals changed
    if (updates.syncIntervals) {
      this.stopPeriodicSyncs();
      this.startPeriodicSyncs();
    }

    this.emit('config:updated', { oldConfig, newConfig: this.config });

    this.auditLogger.log({
      type: AuditEventType.CONFIG_CHANGE,
      timestamp: new Date(),
      actor: 'SyncManager',
      action: 'updateConfig',
      details: { oldConfig, newConfig: this.config },
    });
  }

  // Private helper methods

  private setupEventListeners(): void {
    this.syncQueue.on('operation:started', (operation: SyncOperation) => {
      this.emit('sync:processing', operation);
    });

    this.syncQueue.on('operation:completed', (operation: SyncOperation) => {
      // Handled in executeSync
    });

    this.syncQueue.on('operation:failed', (operation: SyncOperation, error: Error) => {
      this.emit('sync:failed', { operation, error });
    });

    this.syncQueue.on('operation:retry', (operation: SyncOperation) => {
      this.emit('sync:retrying', operation);
    });
  }

  private startPeriodicSyncs(): void {
    if (!this.isRunning) return;

    Object.entries(this.config.syncIntervals).forEach(([type, interval]) => {
      const syncType = type as SyncType;
      const timer = setInterval(() => {
        this.triggerPeriodicSync(syncType);
      }, interval);

      this.syncTimers.set(syncType, timer);
    });
  }

  private stopPeriodicSyncs(): void {
    this.syncTimers.forEach(timer => clearInterval(timer));
    this.syncTimers.clear();
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      const health = this.getHealthStatus();
      this.emit('health:check', health);

      if (!health.healthy) {
        this.emit('health:degraded', health);
      }
    }, this.config.healthCheckIntervalMs);
  }

  private async triggerPeriodicSync(syncType: SyncType): Promise<void> {
    if (!this.isRunning) return;

    try {
      // This would be implemented based on specific sync type requirements
      // For now, emit an event that can be handled by external listeners
      this.emit('sync:periodic', { syncType, timestamp: new Date() });
    } catch (error) {
      console.error(`[SyncManager] Periodic sync failed for ${syncType}:`, error);
    }
  }

  private async processQueue(): Promise<void> {
    try {
      await this.syncQueue.process(async (operation: SyncOperation) => {
        return await this.executeSync(operation.target);
      });
    } catch (error) {
      console.error('[SyncManager] Queue processing error:', error);
    }
  }

  private async validateSyncTarget(target: SyncTarget): Promise<ValidationResult> {
    return this.dataValidator.validate(target, {
      required: ['id', 'type', 'source', 'destination'],
      types: {
        id: 'string',
        type: 'string',
        source: 'string',
        destination: 'string',
      },
    });
  }

  private async performSync(target: SyncTarget): Promise<unknown> {
    // This is a placeholder - actual implementation would depend on sync type
    // and would interact with exchange connectors, databases, etc.

    switch (target.type) {
      case SyncType.EXCHANGE_BALANCE:
        return this.syncExchangeBalance(target);
      case SyncType.PORTFOLIO_POSITION:
        return this.syncPortfolioPosition(target);
      case SyncType.ORDER_STATUS:
        return this.syncOrderStatus(target);
      case SyncType.STRATEGY_STATE:
        return this.syncStrategyState(target);
      case SyncType.MARKET_DATA:
        return this.syncMarketData(target);
      case SyncType.ACCOUNT_INFO:
        return this.syncAccountInfo(target);
      default:
        throw new Error(`Unsupported sync type: ${target.type}`);
    }
  }

  private async syncExchangeBalance(target: SyncTarget): Promise<unknown> {
    // Placeholder for exchange balance sync
    // Would interact with exchange connector to fetch balances
    return { balances: [], timestamp: new Date() };
  }

  private async syncPortfolioPosition(target: SyncTarget): Promise<unknown> {
    // Placeholder for portfolio position sync
    return { positions: [], timestamp: new Date() };
  }

  private async syncOrderStatus(target: SyncTarget): Promise<unknown> {
    // Placeholder for order status sync
    return { orders: [], timestamp: new Date() };
  }

  private async syncStrategyState(target: SyncTarget): Promise<unknown> {
    // Placeholder for strategy state sync
    return { state: {}, timestamp: new Date() };
  }

  private async syncMarketData(target: SyncTarget): Promise<unknown> {
    // Placeholder for market data sync
    return { marketData: [], timestamp: new Date() };
  }

  private async syncAccountInfo(target: SyncTarget): Promise<unknown> {
    // Placeholder for account info sync
    return { accountInfo: {}, timestamp: new Date() };
  }

  private async checkForConflicts(
    target: SyncTarget,
    syncData: unknown
  ): Promise<{ hasConflict: boolean; localData?: unknown; remoteData?: unknown }> {
    // Placeholder for conflict detection logic
    // Would compare local and remote data to detect discrepancies
    return { hasConflict: false };
  }

  private async resolveConflict(
    target: SyncTarget,
    conflict: { localData?: unknown; remoteData?: unknown }
  ): Promise<{ resolvedData: unknown; strategy: ConflictResolutionStrategy }> {
    const resolved = await this.conflictResolver.resolve({
      localValue: conflict.localData,
      remoteValue: conflict.remoteData,
      timestamp: new Date(),
      source: target.source,
      destination: target.destination,
    });

    return {
      resolvedData: resolved,
      strategy: this.config.conflictStrategy,
    };
  }

  private async applySyncData(target: SyncTarget, data: unknown): Promise<number> {
    // Placeholder for applying sync data
    // Would write to database, update caches, etc.
    return 1;
  }

  private recordSyncResult(result: SyncResult): void {
    this.syncHistory.push(result);
    this.metricsWindow.push(result);

    // Limit history size
    if (this.syncHistory.length > 10000) {
      this.syncHistory = this.syncHistory.slice(-5000);
    }

    // Clean up metrics window
    const windowStart = Date.now() - this.metricsWindowSizeMs;
    this.metricsWindow = this.metricsWindow.filter(
      s => s.timestamp.getTime() > windowStart
    );
  }

  private generateSyncId(target: SyncTarget): string {
    return `sync_${target.type}_${target.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async waitForActiveSyncs(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (this.activeSyncs.size > 0) {
      if (Date.now() - startTime > timeoutMs) {
        console.warn(`[SyncManager] Timeout waiting for ${this.activeSyncs.size} active syncs`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

export default SyncManager;
