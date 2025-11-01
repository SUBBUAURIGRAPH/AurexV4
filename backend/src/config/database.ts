/**
 * Database Configuration
 * PostgreSQL connection pool setup with retry logic
 * @version 1.0.0
 */

import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';

/**
 * PostgreSQL connection pool
 */
const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'hermes_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = new Pool(poolConfig);

/**
 * Handle pool errors
 */
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client:', err);
});

/**
 * Initialize database connection and run health check
 */
export async function initializeDatabase(): Promise<void> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = await pool.connect();

      // Run simple health check
      const result = await client.query('SELECT NOW()');

      client.release();

      console.log(`✅ Database connection established (attempt ${i + 1})`);
      console.log(`   Host: ${poolConfig.host}:${poolConfig.port}`);
      console.log(`   Database: ${poolConfig.database}`);
      return;
    } catch (err) {
      lastError = err as Error;
      console.warn(`⚠️ Database connection attempt ${i + 1} failed:`, lastError.message);

      if (i < maxRetries - 1) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  console.error('❌ Failed to connect to database after', maxRetries, 'attempts');
  throw lastError || new Error('Database connection failed');
}

/**
 * Execute query on pool
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  values?: any[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, values);
}

/**
 * Get client from pool for transaction support
 */
export async function getClient() {
  return pool.connect();
}

/**
 * Gracefully close all connections
 */
export async function closeDatabase(): Promise<void> {
  try {
    await pool.end();
    console.log('✅ Database connections closed');
  } catch (err) {
    console.error('❌ Error closing database connections:', err);
    throw err;
  }
}

/**
 * Health check for liveness probe
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await query('SELECT 1');
    return result.rowCount === 1;
  } catch (err) {
    console.error('❌ Health check failed:', err);
    return false;
  }
}

export default pool;
