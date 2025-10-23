/**
 * Redis Configuration
 * Redis client setup for caching and job queues
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_DB = parseInt(process.env.REDIS_DB || '0', 10);

// Create Redis client
export const redisClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  db: REDIS_DB,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true
});

// Connection event handlers
redisClient.on('connect', () => {
  logger.info('Redis client connecting');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready', {
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: REDIS_DB
  });
});

redisClient.on('error', (error) => {
  logger.error('Redis client error', {
    error: error.message
  });
});

redisClient.on('close', () => {
  logger.warn('Redis client connection closed');
});

redisClient.on('reconnecting', () => {
  logger.info('Redis client reconnecting');
});

// Create separate Redis client for Bull queues
export const redisQueueClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  db: REDIS_DB,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: null, // Bull requires this to be null
  enableReadyCheck: false
});

/**
 * Cache helper functions
 */
export const cache = {
  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  },

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: unknown, ttlSeconds: number = 3600): Promise<void> {
    try {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error', { key, error });
    }
  },

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error('Cache del error', { key, error });
    }
  },

  /**
   * Delete keys matching pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (error) {
      logger.error('Cache delPattern error', { pattern, error });
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error });
      return false;
    }
  }
};

/**
 * Close Redis connections
 */
export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.quit();
    await redisQueueClient.quit();
    logger.info('Redis connections closed');
  } catch (error) {
    logger.error('Error closing Redis connections', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
