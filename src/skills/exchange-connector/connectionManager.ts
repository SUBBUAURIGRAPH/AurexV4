/**
 * Connection Manager
 * Manages connection pooling for multiple exchanges
 * Provides connection reuse, cleanup, and monitoring
 * Version: 1.0.0
 */

import { ConnectionConfig, ConnectionPool } from './types';

interface PoolConnection {
  id: string;
  exchange: string;
  createdAt: Date;
  lastUsed: Date;
  inUse: boolean;
  instance: any;
}

export class ConnectionManager {
  private pools: Map<string, PoolConnection[]>;
  private config: ConnectionConfig;
  private stats: Map<string, { created: number; reused: number; destroyed: number }>;

  constructor(config?: ConnectionConfig) {
    this.pools = new Map();
    this.stats = new Map();
    this.config = {
      poolSize: config?.poolSize || 5,
      maxPoolSize: config?.maxPoolSize || 50,
      timeout: config?.timeout || 10000,
      retryAttempts: config?.retryAttempts || 3,
      retryDelay: config?.retryDelay || 1000,
    };
  }

  /**
   * Initialize connection pool for an exchange
   */
  initializePool(exchangeName: string): void {
    if (!this.pools.has(exchangeName)) {
      this.pools.set(exchangeName, []);
      this.stats.set(exchangeName, { created: 0, reused: 0, destroyed: 0 });
      this.createInitialConnections(exchangeName);
    }
  }

  /**
   * Create initial pool connections
   */
  private createInitialConnections(exchangeName: string): void {
    const poolSize = this.config.poolSize || 5;
    for (let i = 0; i < poolSize; i++) {
      this.addConnection(exchangeName);
    }
  }

  /**
   * Add a connection to the pool
   */
  private addConnection(exchangeName: string): void {
    const pool = this.pools.get(exchangeName) || [];
    const connection: PoolConnection = {
      id: `${exchangeName}-${pool.length}-${Date.now()}`,
      exchange: exchangeName,
      createdAt: new Date(),
      lastUsed: new Date(),
      inUse: false,
      instance: null, // Will be set when actual exchange instance is created
    };

    pool.push(connection);
    this.pools.set(exchangeName, pool);

    const stats = this.stats.get(exchangeName)!;
    stats.created++;
  }

  /**
   * Get an available connection from the pool
   */
  async getConnection(exchangeName: string): Promise<any> {
    const pool = this.pools.get(exchangeName);
    if (!pool) {
      this.initializePool(exchangeName);
      return this.getConnection(exchangeName);
    }

    // Find available connection
    const available = pool.find(conn => !conn.inUse);
    if (available) {
      available.inUse = true;
      available.lastUsed = new Date();
      const stats = this.stats.get(exchangeName)!;
      stats.reused++;
      return available.instance;
    }

    // Create new connection if pool not at max size
    if (pool.length < (this.config.maxPoolSize || 50)) {
      this.addConnection(exchangeName);
      return this.getConnection(exchangeName);
    }

    // Wait for available connection
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const availableConn = pool.find(conn => !conn.inUse);
        if (availableConn) {
          clearInterval(checkInterval);
          availableConn.inUse = true;
          availableConn.lastUsed = new Date();
          const stats = this.stats.get(exchangeName)!;
          stats.reused++;
          resolve(availableConn.instance);
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(null);
      }, 30000);
    });
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(exchangeName: string, connectionId: string): void {
    const pool = this.pools.get(exchangeName);
    if (!pool) return;

    const connection = pool.find(conn => conn.id === connectionId);
    if (connection) {
      connection.inUse = false;
    }
  }

  /**
   * Get pool status
   */
  getPoolStatus(exchangeName: string): ConnectionPool | null {
    const pool = this.pools.get(exchangeName);
    if (!pool) return null;

    const availableCount = pool.filter(conn => !conn.inUse).length;
    const activeCount = pool.filter(conn => conn.inUse).length;

    return {
      exchange: exchangeName,
      connections: new Map(pool.map(conn => [conn.id, conn])),
      availableCount,
      totalCount: pool.length,
      activeCount,
    };
  }

  /**
   * Get all pools status
   */
  getAllPoolsStatus(): ConnectionPool[] {
    const status: ConnectionPool[] = [];
    for (const exchangeName of this.pools.keys()) {
      const poolStatus = this.getPoolStatus(exchangeName);
      if (poolStatus) {
        status.push(poolStatus);
      }
    }
    return status;
  }

  /**
   * Clear idle connections (not used for timeout period)
   */
  clearIdleConnections(exchangeName: string, idleTimeout: number = 300000): number {
    const pool = this.pools.get(exchangeName);
    if (!pool) return 0;

    const now = new Date().getTime();
    const toRemove: number[] = [];

    pool.forEach((conn, index) => {
      if (!conn.inUse && (now - conn.lastUsed.getTime()) > idleTimeout) {
        toRemove.push(index);
      }
    });

    // Remove from end to avoid index shifting
    for (let i = toRemove.length - 1; i >= 0; i--) {
      pool.splice(toRemove[i], 1);
      const stats = this.stats.get(exchangeName)!;
      stats.destroyed++;
    }

    return toRemove.length;
  }

  /**
   * Clear all connections for an exchange
   */
  clearAllConnections(exchangeName: string): number {
    const pool = this.pools.get(exchangeName);
    if (!pool) return 0;

    const count = pool.length;
    const stats = this.stats.get(exchangeName)!;
    stats.destroyed += count;

    pool.length = 0;
    return count;
  }

  /**
   * Get connection statistics
   */
  getStatistics(exchangeName?: string): Record<string, any> {
    if (exchangeName) {
      const stats = this.stats.get(exchangeName);
      return {
        exchange: exchangeName,
        ...stats,
        efficiency: stats ? (stats.reused / (stats.created + stats.reused)) * 100 : 0,
      };
    }

    const allStats: Record<string, any> = {};
    for (const [exchange, stats] of this.stats) {
      allStats[exchange] = {
        ...stats,
        efficiency: (stats.reused / (stats.created + stats.reused)) * 100,
      };
    }
    return allStats;
  }

  /**
   * Destroy connection manager and cleanup
   */
  destroy(): void {
    for (const exchangeName of this.pools.keys()) {
      this.clearAllConnections(exchangeName);
    }
    this.pools.clear();
    this.stats.clear();
  }
}

export default ConnectionManager;
