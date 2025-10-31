/**
 * Integration Test Setup Utilities
 * Provides common setup and teardown functions for all integration tests
 * @version 1.0.0
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TestEnvironment {
  db: Pool;
  redis: Redis;
  apiBaseUrl: string;
  mockExchangeUrl: string;
  cleanup: () => Promise<void>;
}

/**
 * Setup complete test environment
 */
export async function setupTestEnvironment(): Promise<TestEnvironment> {
  console.log('Setting up test environment...');

  // Database connection
  const db = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    database: process.env.DB_NAME || 'hms_test',
    user: process.env.DB_USER || 'test_user',
    password: process.env.DB_PASSWORD || 'test_password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Redis connection
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD || 'test_redis',
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 100, 3000);
    },
  });

  // Test database is ready
  await waitForDatabase(db);
  await waitForRedis(redis);

  // Clear test data
  await clearDatabase(db);
  await clearRedis(redis);

  // Seed test data
  await seedTestData(db);

  const env: TestEnvironment = {
    db,
    redis,
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:9004',
    mockExchangeUrl: process.env.MOCK_EXCHANGE_URL || 'http://localhost:8888',
    cleanup: async () => {
      await clearDatabase(db);
      await clearRedis(redis);
      await db.end();
      await redis.quit();
    },
  };

  console.log('Test environment ready');
  return env;
}

/**
 * Wait for database to be ready
 */
async function waitForDatabase(db: Pool, maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await db.query('SELECT 1');
      console.log('Database is ready');
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000);
    }
  }
}

/**
 * Wait for Redis to be ready
 */
async function waitForRedis(redis: Redis, maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await redis.ping();
      console.log('Redis is ready');
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000);
    }
  }
}

/**
 * Clear all test data from database
 */
async function clearDatabase(db: Pool): Promise<void> {
  await db.query('TRUNCATE TABLE users, strategies, trades, orders, api_keys CASCADE');
  console.log('Database cleared');
}

/**
 * Clear all test data from Redis
 */
async function clearRedis(redis: Redis): Promise<void> {
  await redis.flushdb();
  console.log('Redis cleared');
}

/**
 * Seed test data
 */
async function seedTestData(db: Pool): Promise<void> {
  // Create test users
  await db.query(`
    INSERT INTO users (id, username, email, password_hash, role, created_at)
    VALUES
      (1, 'test_trader', 'trader@test.hms', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'trader', NOW()),
      (2, 'test_admin', 'admin@test.hms', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'admin', NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  // Create test strategies
  await db.query(`
    INSERT INTO strategies (id, user_id, name, config, status, created_at)
    VALUES
      (1, 1, 'Test MA Cross', '{"type":"ma_cross","params":{"fast":10,"slow":20}}', 'active', NOW()),
      (2, 1, 'Test RSI', '{"type":"rsi","params":{"period":14,"overbought":70,"oversold":30}}', 'inactive', NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  console.log('Test data seeded');
}

/**
 * Create test user via API
 */
export async function createTestUser(
  apiBaseUrl: string,
  userData: {
    username: string;
    email: string;
    password: string;
    role?: string;
  }
): Promise<{ userId: string; token: string }> {
  const response = await fetch(`${apiBaseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    throw new Error(`Failed to create test user: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    userId: data.userId,
    token: data.token,
  };
}

/**
 * Login test user
 */
export async function loginTestUser(
  apiBaseUrl: string,
  username: string,
  password: string
): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(`Failed to login: ${response.statusText}`);
  }

  const data = await response.json();
  return data.token;
}

/**
 * Make authenticated API request
 */
export async function apiRequest(
  url: string,
  options: RequestInit & { token?: string } = {}
): Promise<Response> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...fetchOptions,
    headers,
  });
}

/**
 * Wait for condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await sleep(interval);
  }
  throw new Error('Timeout waiting for condition');
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start Docker Compose test stack
 */
export async function startDockerStack(): Promise<void> {
  console.log('Starting Docker test stack...');
  try {
    await execAsync('docker-compose -f tests/integration/docker-compose.test.yml up -d');
    console.log('Docker stack started');
    await sleep(5000); // Wait for services to be ready
  } catch (error) {
    console.error('Failed to start Docker stack:', error);
    throw error;
  }
}

/**
 * Stop Docker Compose test stack
 */
export async function stopDockerStack(): Promise<void> {
  console.log('Stopping Docker test stack...');
  try {
    await execAsync('docker-compose -f tests/integration/docker-compose.test.yml down -v');
    console.log('Docker stack stopped');
  } catch (error) {
    console.error('Failed to stop Docker stack:', error);
  }
}

/**
 * Get container health status
 */
export async function getContainerHealth(containerName: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `docker inspect --format='{{.State.Health.Status}}' ${containerName}`
    );
    return stdout.trim();
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Assert response is successful
 */
export function assertOkResponse(response: Response, message?: string): void {
  if (!response.ok) {
    throw new Error(
      message || `Request failed: ${response.status} ${response.statusText}`
    );
  }
}

/**
 * Generate random test data
 */
export function generateRandomString(length = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

export function generateRandomEmail(): string {
  return `test_${generateRandomString()}@test.hms`;
}

/**
 * Measure function execution time
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}

/**
 * Calculate percentiles from array of numbers
 */
export function calculatePercentiles(values: number[]): {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
} {
  const sorted = values.sort((a, b) => a - b);
  const len = sorted.length;

  return {
    p50: sorted[Math.floor(len * 0.5)],
    p95: sorted[Math.floor(len * 0.95)],
    p99: sorted[Math.floor(len * 0.99)],
    min: sorted[0],
    max: sorted[len - 1],
    avg: values.reduce((a, b) => a + b, 0) / len,
  };
}
