/**
 * Rate Limiter
 * Manages API rate limits for multiple exchanges
 * Implements token bucket algorithm for precise rate limiting
 * Version: 1.0.0
 */

import { RateLimiterConfig, RateLimitInfo } from './types';

interface TokenBucket {
  exchange: string;
  capacity: number;
  tokens: number;
  lastRefill: Date;
  refillRate: number;
}

interface RequestQueue {
  timestamp: Date;
  priority: number;
  callback: () => Promise<any>;
}

export class RateLimiter {
  private buckets: Map<string, TokenBucket>;
  private requestQueues: Map<string, RequestQueue[]>;
  private config: RateLimiterConfig;
  private stats: Map<string, { attempted: number; allowed: number; queued: number; rejected: number }>;

  // Exchange-specific rate limits (requests per minute)
  private readonly EXCHANGE_LIMITS: Record<string, number> = {
    'binance': 1200,
    'coinbase': 10,
    'kraken': 15,
    'bybit': 120,
    'alpaca': 500,
    'okx': 40,
    'kucoin': 100,
    'bitfinex': 90,
    'gate.io': 3000,
    'huobi': 100,
    'gemini': 120,
    'ftx': 30,
  };

  constructor(config?: RateLimiterConfig) {
    this.buckets = new Map();
    this.requestQueues = new Map();
    this.stats = new Map();
    this.config = {
      globalQPS: config?.globalQPS || 500,
      perExchangeQPS: config?.perExchangeQPS || 100,
      burstMultiplier: config?.burstMultiplier || 2.0,
      backoffStrategy: config?.backoffStrategy || 'exponential',
      throttleUnder: config?.throttleUnder || 0.5,
    };

    // Initialize buckets for all exchanges
    this.initializeBuckets();
  }

  /**
   * Initialize token buckets for all exchanges
   */
  private initializeBuckets(): void {
    for (const [exchange, limit] of Object.entries(this.EXCHANGE_LIMITS)) {
      const refillRate = limit / 60; // Convert per minute to per second
      const capacity = Math.floor(limit * (this.config.burstMultiplier || 2.0));

      this.buckets.set(exchange, {
        exchange,
        capacity,
        tokens: capacity, // Start full
        lastRefill: new Date(),
        refillRate,
      });

      this.stats.set(exchange, { attempted: 0, allowed: 0, queued: 0, rejected: 0 });
      this.requestQueues.set(exchange, []);
    }
  }

  /**
   * Check if request can proceed immediately
   */
  canProceed(exchange: string): boolean {
    this.refillBucket(exchange);
    const bucket = this.buckets.get(exchange);

    if (!bucket) {
      console.error(`Exchange ${exchange} not found in rate limiter`);
      return false;
    }

    const stats = this.stats.get(exchange)!;
    stats.attempted++;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      stats.allowed++;
      return true;
    }

    return false;
  }

  /**
   * Wait for available slot (async)
   */
  async waitForSlot(exchange: string, maxWait: number = 60000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      if (this.canProceed(exchange)) {
        return true;
      }

      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const stats = this.stats.get(exchange)!;
    stats.rejected++;
    return false;
  }

  /**
   * Queue a request with priority
   */
  async queueRequest(
    exchange: string,
    callback: () => Promise<any>,
    priority: number = 0
  ): Promise<any> {
    const queue = this.requestQueues.get(exchange);
    if (!queue) {
      throw new Error(`Exchange ${exchange} not found`);
    }

    const request: RequestQueue = {
      timestamp: new Date(),
      priority,
      callback,
    };

    queue.push(request);
    queue.sort((a, b) => b.priority - a.priority);

    const stats = this.stats.get(exchange)!;
    stats.queued++;

    // Process queue
    return this.processQueue(exchange);
  }

  /**
   * Process request queue
   */
  private async processQueue(exchange: string): Promise<any> {
    const queue = this.requestQueues.get(exchange);
    if (!queue || queue.length === 0) {
      return null;
    }

    const request = queue[0];

    if (await this.waitForSlot(exchange)) {
      queue.shift();
      try {
        return await request.callback();
      } catch (error) {
        console.error(`Error processing queued request for ${exchange}:`, error);
        throw error;
      }
    }

    return null;
  }

  /**
   * Refill bucket based on elapsed time
   */
  private refillBucket(exchange: string): void {
    const bucket = this.buckets.get(exchange);
    if (!bucket) return;

    const now = new Date();
    const elapsedSeconds = (now.getTime() - bucket.lastRefill.getTime()) / 1000;
    const tokensToAdd = elapsedSeconds * bucket.refillRate;

    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Get rate limit information for an exchange
   */
  getRateLimitInfo(exchange: string): RateLimitInfo | null {
    this.refillBucket(exchange);
    const bucket = this.buckets.get(exchange);

    if (!bucket) {
      return null;
    }

    const tokensUntilReset = bucket.capacity - bucket.tokens;
    const resetTime = new Date(bucket.lastRefill.getTime() + (tokensUntilReset / bucket.refillRate) * 1000);

    return {
      exchange,
      limit: Math.floor(bucket.capacity),
      remaining: Math.floor(bucket.tokens),
      reset: resetTime,
      resetIn: Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000)),
      percentageUsed: ((bucket.capacity - bucket.tokens) / bucket.capacity) * 100,
    };
  }

  /**
   * Get rate limits for all exchanges
   */
  getAllRateLimits(): RateLimitInfo[] {
    return Array.from(this.buckets.keys())
      .map(exchange => this.getRateLimitInfo(exchange))
      .filter((info): info is RateLimitInfo => info !== null);
  }

  /**
   * Handle rate limit exceeded (from API response)
   */
  handleRateLimitExceeded(exchange: string, resetTime?: Date): void {
    const bucket = this.buckets.get(exchange);
    if (!bucket) return;

    // Set tokens to 0 to force waiting
    bucket.tokens = 0;

    // Update refill time if provided
    if (resetTime) {
      bucket.lastRefill = new Date(resetTime.getTime() - (bucket.capacity / bucket.refillRate) * 1000);
    }
  }

  /**
   * Check if we should throttle requests
   */
  shouldThrottle(exchange: string): boolean {
    this.refillBucket(exchange);
    const bucket = this.buckets.get(exchange);
    if (!bucket) return false;

    const utilizationRate = (bucket.capacity - bucket.tokens) / bucket.capacity;
    return utilizationRate > (this.config.throttleUnder || 0.5);
  }

  /**
   * Get throttle delay in milliseconds
   */
  getThrottleDelay(exchange: string): number {
    this.refillBucket(exchange);
    const bucket = this.buckets.get(exchange);
    if (!bucket) return 0;

    if (bucket.tokens >= 1) {
      return 0;
    }

    // Calculate time until next token available
    return Math.ceil((1 - bucket.tokens) / bucket.refillRate * 1000);
  }

  /**
   * Reset rate limiter for an exchange
   */
  reset(exchange: string): void {
    const bucket = this.buckets.get(exchange);
    if (!bucket) return;

    bucket.tokens = bucket.capacity;
    bucket.lastRefill = new Date();

    const queue = this.requestQueues.get(exchange);
    if (queue) {
      queue.length = 0;
    }

    const stat = this.stats.get(exchange);
    if (stat) {
      stat.attempted = 0;
      stat.allowed = 0;
      stat.queued = 0;
      stat.rejected = 0;
    }
  }

  /**
   * Reset all rate limiters
   */
  resetAll(): void {
    for (const exchange of this.buckets.keys()) {
      this.reset(exchange);
    }
  }

  /**
   * Get statistics
   */
  getStatistics(exchange?: string): Record<string, any> {
    if (exchange) {
      const stats = this.stats.get(exchange);
      if (!stats) return {};

      const allowRate = stats.attempted > 0 ? (stats.allowed / stats.attempted) * 100 : 0;
      return {
        exchange,
        ...stats,
        allowRate: allowRate.toFixed(2) + '%',
        queueLength: this.requestQueues.get(exchange)?.length || 0,
      };
    }

    const allStats: Record<string, any> = {};
    for (const [ex, stats] of this.stats) {
      const allowRate = stats.attempted > 0 ? (stats.allowed / stats.attempted) * 100 : 0;
      allStats[ex] = {
        ...stats,
        allowRate: allowRate.toFixed(2) + '%',
        queueLength: this.requestQueues.get(ex)?.length || 0,
      };
    }
    return allStats;
  }

  /**
   * Register custom exchange rate limit
   */
  registerExchangeLimit(exchange: string, limit: number): void {
    this.EXCHANGE_LIMITS[exchange] = limit;

    if (!this.buckets.has(exchange)) {
      const refillRate = limit / 60;
      const capacity = Math.floor(limit * (this.config.burstMultiplier || 2.0));

      this.buckets.set(exchange, {
        exchange,
        capacity,
        tokens: capacity,
        lastRefill: new Date(),
        refillRate,
      });

      this.stats.set(exchange, { attempted: 0, allowed: 0, queued: 0, rejected: 0 });
      this.requestQueues.set(exchange, []);
    }
  }
}

export default RateLimiter;
