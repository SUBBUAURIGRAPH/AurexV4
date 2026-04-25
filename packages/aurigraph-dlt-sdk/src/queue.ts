/**
 * OfflineQueue — in-memory FIFO queue of pending mutating operations that
 * the SDK will replay when network connectivity is restored.
 *
 * Features:
 *   - FIFO with configurable max size (default 1000). Overflow drops oldest.
 *   - Optional persistent storage (localStorage-compatible) for durability.
 *   - Event emitter: 'enqueue' | 'flush' | 'error' | 'drop'.
 *   - Auto-flush timer (default every 30 s) when a flush-callback is registered.
 *   - Idempotency-key aware: duplicate keys are deduped on enqueue.
 */

import type { QueueOptions, QueueEventKind, QueuedOperation } from './types.js';

type FlushFn = (op: QueuedOperation) => Promise<void>;
type Listener = (payload: unknown) => void;

const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_FLUSH_INTERVAL_MS = 30_000;
const DEFAULT_STORAGE_KEY = 'aurigraph.offlineQueue';

export class OfflineQueue {
  private queue: QueuedOperation[] = [];
  private readonly maxSize: number;
  private readonly flushIntervalMs: number;
  private readonly storage?: QueueOptions['storage'];
  private readonly storageKey: string;
  private listeners: Map<QueueEventKind, Set<Listener>> = new Map();
  private flushHandler?: FlushFn;
  private timer?: ReturnType<typeof setInterval>;
  private flushing = false;

  constructor(opts: QueueOptions = {}) {
    this.maxSize = opts.maxSize ?? DEFAULT_MAX_SIZE;
    this.flushIntervalMs = opts.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.storage = opts.storage;
    this.storageKey = opts.storageKey ?? DEFAULT_STORAGE_KEY;
    this.restore();
  }

  /**
   * Register the callback used by `flush()` to replay each queued operation.
   * Must throw on failure — success pops the op from the queue.
   */
  setFlushHandler(fn: FlushFn): void {
    this.flushHandler = fn;
    this.startTimer();
  }

  /**
   * Enqueue a new operation. If an operation with the same idempotencyKey
   * already exists, it is replaced (dedup). If the queue is full, drops
   * the oldest entry and emits 'drop'.
   */
  enqueue(op: Omit<QueuedOperation, 'id' | 'enqueuedAt' | 'attempts'>): QueuedOperation {
    const full: QueuedOperation = {
      id: randomId(),
      enqueuedAt: Date.now(),
      attempts: 0,
      ...op,
    };

    if (op.idempotencyKey) {
      const dup = this.queue.findIndex((q) => q.idempotencyKey === op.idempotencyKey);
      if (dup >= 0) {
        this.queue[dup] = full;
        this.persist();
        this.emit('enqueue', full);
        return full;
      }
    }

    while (this.queue.length >= this.maxSize) {
      const dropped = this.queue.shift();
      if (dropped) this.emit('drop', dropped);
    }
    this.queue.push(full);
    this.persist();
    this.emit('enqueue', full);
    return full;
  }

  /** Queue depth. */
  size(): number {
    return this.queue.length;
  }

  /** Peek the queue (copy). */
  snapshot(): QueuedOperation[] {
    return [...this.queue];
  }

  /** Clear all queued operations. */
  clear(): void {
    this.queue = [];
    this.persist();
  }

  /**
   * Flush all queued operations via the registered handler. Re-entrant-safe:
   * concurrent flush() calls are coalesced. Stops on the first handler error.
   */
  async flush(): Promise<{ flushed: number; remaining: number }> {
    if (!this.flushHandler) {
      return { flushed: 0, remaining: this.queue.length };
    }
    if (this.flushing) {
      return { flushed: 0, remaining: this.queue.length };
    }
    this.flushing = true;
    let flushed = 0;
    try {
      while (this.queue.length > 0) {
        const op = this.queue[0];
        op.attempts += 1;
        try {
          await this.flushHandler(op);
          this.queue.shift();
          flushed += 1;
          this.emit('flush', op);
        } catch (err) {
          this.emit('error', { op, error: err });
          break;
        }
      }
      this.persist();
      return { flushed, remaining: this.queue.length };
    } finally {
      this.flushing = false;
    }
  }

  /** Subscribe to queue events. Returns an unsubscribe fn. */
  onEvent(kind: QueueEventKind, listener: Listener): () => void {
    if (!this.listeners.has(kind)) this.listeners.set(kind, new Set());
    this.listeners.get(kind)!.add(listener);
    return () => this.listeners.get(kind)?.delete(listener);
  }

  /** Stop the auto-flush timer and release resources. */
  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.listeners.clear();
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private emit(kind: QueueEventKind, payload: unknown): void {
    const set = this.listeners.get(kind);
    if (!set) return;
    for (const l of set) {
      try {
        l(payload);
      } catch {
        // swallow — listener errors must not break the queue
      }
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch {
      // quota exceeded etc — silently ignore
    }
  }

  private restore(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.queue = parsed as QueuedOperation[];
      }
    } catch {
      // corrupt storage — start fresh
    }
  }

  private startTimer(): void {
    if (this.flushIntervalMs <= 0 || this.timer) return;
    this.timer = setInterval(() => {
      void this.flush().catch(() => undefined);
    }, this.flushIntervalMs);
    // Don't keep the Node event loop alive for the timer.
    const t = this.timer as unknown as { unref?: () => void };
    if (typeof t.unref === 'function') t.unref();
  }
}

function randomId(): string {
  // 96 bit random hex — good enough for a local dedup key.
  const rnd = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `${Date.now().toString(16)}-${rnd()}-${rnd()}`;
}
