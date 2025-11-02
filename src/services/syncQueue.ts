/**
 * Sync Queue Service
 * Manages pending sync operations with priority queuing, retry logic, and dead-letter queue
 * @version 1.0.0
 */

import EventEmitter from 'events';
import { SyncTarget, SyncStatus } from './syncManager';

export enum SyncPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  BACKGROUND = 4,
}

export interface SyncOperation {
  id: string;
  target: SyncTarget;
  priority: SyncPriority;
  status: SyncStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  lastError?: Error;
  metadata?: Record<string, unknown>;
}

export interface SyncQueueConfig {
  maxConcurrent: number;
  retryAttempts: number;
  retryBackoffMs: number;
  enableDeadLetterQueue: boolean;
  deadLetterQueueSize: number;
  queueTimeout: number;
  enablePriorityBoosting: boolean;
  priorityBoostThreshold: number;
}

export interface QueueStats {
  totalOperations: number;
  pendingOperations: number;
  activeOperations: number;
  completedOperations: number;
  failedOperations: number;
  retriedOperations: number;
  deadLetterOperations: number;
  averageWaitTimeMs: number;
  averageProcessTimeMs: number;
}

/**
 * Priority-based sync queue with retry logic and dead-letter queue
 */
export class SyncQueue extends EventEmitter {
  private config: SyncQueueConfig;
  private queue: SyncOperation[];
  private activeOperations: Map<string, SyncOperation>;
  private completedOperations: SyncOperation[];
  private deadLetterQueue: SyncOperation[];
  private processing: boolean;
  private stats: {
    total: number;
    completed: number;
    failed: number;
    retried: number;
    totalWaitTimeMs: number;
    totalProcessTimeMs: number;
  };

  constructor(config?: Partial<SyncQueueConfig>) {
    super();

    this.config = {
      maxConcurrent: config?.maxConcurrent ?? 10,
      retryAttempts: config?.retryAttempts ?? 3,
      retryBackoffMs: config?.retryBackoffMs ?? 1000,
      enableDeadLetterQueue: config?.enableDeadLetterQueue ?? true,
      deadLetterQueueSize: config?.deadLetterQueueSize ?? 1000,
      queueTimeout: config?.queueTimeout ?? 300000, // 5 minutes
      enablePriorityBoosting: config?.enablePriorityBoosting ?? true,
      priorityBoostThreshold: config?.priorityBoostThreshold ?? 60000, // 1 minute
    };

    this.queue = [];
    this.activeOperations = new Map();
    this.completedOperations = [];
    this.deadLetterQueue = [];
    this.processing = false;

    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      totalWaitTimeMs: 0,
      totalProcessTimeMs: 0,
    };

    this.startPriorityBooster();
  }

  /**
   * Enqueue a sync operation
   */
  async enqueue(operation: SyncOperation): Promise<void> {
    this.queue.push(operation);
    this.stats.total++;

    // Sort by priority
    this.sortQueue();

    this.emit('operation:enqueued', operation);

    // Start processing if not already running
    if (!this.processing) {
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Process operations using the provided handler
   */
  async process(handler: (operation: SyncOperation) => Promise<unknown>): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 || this.activeOperations.size > 0) {
      // Process next operation if we have capacity
      if (
        this.queue.length > 0 &&
        this.activeOperations.size < this.config.maxConcurrent
      ) {
        const operation = this.dequeue();
        if (operation) {
          this.processOperation(operation, handler);
        }
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.processing = false;
  }

  /**
   * Process next operation in queue
   */
  private async processNext(): Promise<void> {
    if (!this.processing && this.queue.length > 0 && this.activeOperations.size < this.config.maxConcurrent) {
      this.processing = true;
      const operation = this.dequeue();
      if (operation) {
        this.emit('operation:processing', operation);
      }
      this.processing = false;
    }
  }

  /**
   * Process a single operation
   */
  private async processOperation(
    operation: SyncOperation,
    handler: (operation: SyncOperation) => Promise<unknown>
  ): Promise<void> {
    const startTime = Date.now();
    const waitTime = startTime - operation.createdAt.getTime();
    this.stats.totalWaitTimeMs += waitTime;

    operation.status = SyncStatus.IN_PROGRESS;
    operation.startedAt = new Date();
    this.activeOperations.set(operation.id, operation);

    this.emit('operation:started', operation);

    try {
      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), this.config.queueTimeout);
      });

      const operationPromise = handler(operation);

      // Race between operation and timeout
      await Promise.race([operationPromise, timeoutPromise]);

      // Success
      operation.status = SyncStatus.COMPLETED;
      operation.completedAt = new Date();

      const processTime = Date.now() - startTime;
      this.stats.totalProcessTimeMs += processTime;
      this.stats.completed++;

      this.activeOperations.delete(operation.id);
      this.completedOperations.push(operation);

      this.emit('operation:completed', operation);
    } catch (error) {
      operation.lastError = error instanceof Error ? error : new Error(String(error));
      operation.status = SyncStatus.FAILED;

      // Retry logic
      if (operation.retryCount < this.config.retryAttempts) {
        await this.retryOperation(operation);
      } else {
        // Move to dead letter queue
        this.handleFailedOperation(operation);
      }

      this.activeOperations.delete(operation.id);

      this.emit('operation:failed', operation, error);
    }
  }

  /**
   * Retry a failed operation
   */
  private async retryOperation(operation: SyncOperation): Promise<void> {
    operation.retryCount++;
    operation.status = SyncStatus.RETRYING;

    this.stats.retried++;

    // Exponential backoff
    const backoffMs = this.config.retryBackoffMs * Math.pow(2, operation.retryCount - 1);

    this.emit('operation:retry', operation);

    setTimeout(() => {
      // Re-enqueue with higher priority
      const retriedOperation: SyncOperation = {
        ...operation,
        status: SyncStatus.PENDING,
        priority: Math.max(0, operation.priority - 1) as SyncPriority, // Boost priority
      };

      this.enqueue(retriedOperation);
    }, backoffMs);
  }

  /**
   * Handle permanently failed operation
   */
  private handleFailedOperation(operation: SyncOperation): void {
    this.stats.failed++;

    if (this.config.enableDeadLetterQueue) {
      this.deadLetterQueue.push(operation);

      // Limit dead letter queue size
      if (this.deadLetterQueue.length > this.config.deadLetterQueueSize) {
        this.deadLetterQueue.shift(); // Remove oldest
      }

      this.emit('operation:dead-letter', operation);
    }
  }

  /**
   * Dequeue next operation
   */
  private dequeue(): SyncOperation | null {
    if (this.queue.length === 0) {
      return null;
    }

    // Already sorted by priority
    return this.queue.shift() ?? null;
  }

  /**
   * Sort queue by priority
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // First by priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Then by creation time (older first)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * Start priority boosting mechanism
   */
  private startPriorityBooster(): void {
    if (!this.config.enablePriorityBoosting) {
      return;
    }

    setInterval(() => {
      const now = Date.now();
      let boosted = 0;

      this.queue.forEach(operation => {
        const age = now - operation.createdAt.getTime();

        // Boost priority if operation has been waiting too long
        if (age > this.config.priorityBoostThreshold && operation.priority > SyncPriority.CRITICAL) {
          operation.priority = Math.max(
            SyncPriority.CRITICAL,
            operation.priority - 1
          ) as SyncPriority;
          boosted++;
        }
      });

      if (boosted > 0) {
        this.sortQueue();
        this.emit('priority:boosted', { count: boosted });
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get operation by ID
   */
  getOperation(id: string): SyncOperation | null {
    // Check active operations
    const active = this.activeOperations.get(id);
    if (active) {
      return active;
    }

    // Check queue
    const queued = this.queue.find(op => op.id === id);
    if (queued) {
      return queued;
    }

    // Check completed
    const completed = this.completedOperations.find(op => op.id === id);
    if (completed) {
      return completed;
    }

    // Check dead letter queue
    const deadLetter = this.deadLetterQueue.find(op => op.id === id);
    return deadLetter ?? null;
  }

  /**
   * Remove operation from queue
   */
  removeOperation(id: string): boolean {
    const index = this.queue.findIndex(op => op.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.emit('operation:removed', { id });
      return true;
    }

    return false;
  }

  /**
   * Clear completed operations
   */
  clearCompleted(): number {
    const count = this.completedOperations.length;
    this.completedOperations = [];
    return count;
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): number {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    return count;
  }

  /**
   * Retry operations from dead letter queue
   */
  retryDeadLetterQueue(): number {
    const operations = [...this.deadLetterQueue];
    this.deadLetterQueue = [];

    operations.forEach(operation => {
      const retriedOperation: SyncOperation = {
        ...operation,
        status: SyncStatus.PENDING,
        retryCount: 0,
        priority: SyncPriority.HIGH,
      };

      this.enqueue(retriedOperation);
    });

    return operations.length;
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get active operations count
   */
  getActiveCount(): number {
    return this.activeOperations.size;
  }

  /**
   * Get operations by status
   */
  getOperationsByStatus(status: SyncStatus): SyncOperation[] {
    const operations: SyncOperation[] = [];

    if (status === SyncStatus.PENDING) {
      operations.push(...this.queue);
    } else if (status === SyncStatus.IN_PROGRESS) {
      operations.push(...Array.from(this.activeOperations.values()));
    } else if (status === SyncStatus.COMPLETED) {
      operations.push(...this.completedOperations.filter(op => op.status === status));
    } else if (status === SyncStatus.FAILED) {
      operations.push(...this.deadLetterQueue);
    }

    return operations;
  }

  /**
   * Get operations by priority
   */
  getOperationsByPriority(priority: SyncPriority): SyncOperation[] {
    return this.queue.filter(op => op.priority === priority);
  }

  /**
   * Get queue statistics
   */
  getStatistics(): QueueStats {
    const pending = this.queue.length;
    const active = this.activeOperations.size;
    const completed = this.stats.completed;
    const failed = this.stats.failed;

    return {
      totalOperations: this.stats.total,
      pendingOperations: pending,
      activeOperations: active,
      completedOperations: completed,
      failedOperations: failed,
      retriedOperations: this.stats.retried,
      deadLetterOperations: this.deadLetterQueue.length,
      averageWaitTimeMs:
        this.stats.total > 0 ? this.stats.totalWaitTimeMs / this.stats.total : 0,
      averageProcessTimeMs:
        this.stats.completed > 0 ? this.stats.totalProcessTimeMs / this.stats.completed : 0,
    };
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.processing = false;
    this.emit('queue:paused');
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    if (!this.processing && (this.queue.length > 0 || this.activeOperations.size > 0)) {
      setImmediate(() => this.processNext());
    }
    this.emit('queue:resumed');
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0 && this.activeOperations.size === 0;
  }

  /**
   * Get all pending operations
   */
  getPendingOperations(): SyncOperation[] {
    return [...this.queue];
  }

  /**
   * Get all active operations
   */
  getActiveOperations(): SyncOperation[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): SyncOperation[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Update queue configuration
   */
  updateConfig(updates: Partial<SyncQueueConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config:updated', this.config);
  }

  /**
   * Clear all queues
   */
  clearAll(): void {
    this.queue = [];
    this.completedOperations = [];
    this.deadLetterQueue = [];
    this.emit('queue:cleared');
  }

  /**
   * Get health status
   */
  isHealthy(): boolean {
    const stats = this.getStatistics();

    // Consider unhealthy if:
    // - Too many failed operations (>10% failure rate)
    // - Dead letter queue is filling up
    // - Average wait time is too high (>30s)

    const failureRate = stats.totalOperations > 0 ? stats.failedOperations / stats.totalOperations : 0;
    const queueCapacityUsed = stats.deadLetterOperations / this.config.deadLetterQueueSize;

    return (
      failureRate < 0.1 &&
      queueCapacityUsed < 0.8 &&
      stats.averageWaitTimeMs < 30000
    );
  }
}

export default SyncQueue;
