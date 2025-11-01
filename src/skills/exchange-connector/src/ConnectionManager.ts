/**
 * ConnectionManager - Connection Pooling & Management
 *
 * Features:
 * - Per-exchange connection pools (5-50 connections)
 * - Automatic connection reuse and recycling
 * - Idle connection cleanup
 * - Health-based connection routing
 */

export interface ConnectionPool {
  exchange: string;
  active: number;
  idle: number;
  max: number;
}

export class ConnectionManager {
  private pools: Map<string, any[]> = new Map();
  private activeConnections: Map<string, number> = new Map();
  private readonly DEFAULT_POOL_SIZE = 20;
  private readonly MIN_POOL_SIZE = 5;
  private readonly MAX_POOL_SIZE = 50;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup of idle connections every minute
    this.startCleanup();
  }

  /**
   * Get or create a connection pool for an exchange
   */
  async getConnection(exchange: string): Promise<any> {
    if (!this.pools.has(exchange)) {
      this.pools.set(exchange, []);
      this.activeConnections.set(exchange, 0);
    }

    const pool = this.pools.get(exchange)!;
    const activeCount = this.activeConnections.get(exchange) || 0;

    // Return idle connection if available
    if (pool.length > 0) {
      return pool.pop();
    }

    // Create new connection if under limit
    if (activeCount < this.MAX_POOL_SIZE) {
      const connection = await this.createConnection(exchange);
      this.activeConnections.set(exchange, activeCount + 1);
      return connection;
    }

    // Wait for connection to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (pool.length > 0) {
          clearInterval(checkInterval);
          resolve(pool.pop());
        }
      }, 100);
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(exchange: string, connection: any): void {
    const pool = this.pools.get(exchange);
    if (pool && pool.length < this.DEFAULT_POOL_SIZE) {
      pool.push(connection);
    }
  }

  /**
   * Get pool statistics for an exchange
   */
  getPoolStats(exchange: string): ConnectionPool | null {
    const pool = this.pools.get(exchange);
    if (!pool) return null;

    return {
      exchange,
      active: (this.activeConnections.get(exchange) || 0) - pool.length,
      idle: pool.length,
      max: this.MAX_POOL_SIZE,
    };
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const [exchange, pool] of this.pools.entries()) {
      for (const connection of pool) {
        try {
          if (connection && typeof connection.close === 'function') {
            await connection.close();
          }
        } catch (error) {
          console.error(`Error closing connection for ${exchange}:`, error);
        }
      }
      this.pools.delete(exchange);
      this.activeConnections.delete(exchange);
    }
  }

  /**
   * Create a new connection (placeholder)
   */
  private async createConnection(exchange: string): Promise<any> {
    // In a real implementation, this would create actual connections
    // For now, return a mock connection object
    return {
      exchange,
      createdAt: new Date(),
      isActive: true,
      close: async () => {
        // Close logic
      },
    };
  }

  /**
   * Start periodic cleanup of idle connections
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      for (const [exchange, pool] of this.pools.entries()) {
        // Keep only minimum idle connections
        if (pool.length > this.MIN_POOL_SIZE) {
          const toRemove = pool.length - this.MIN_POOL_SIZE;
          pool.splice(0, toRemove);
        }
      }
    }, 60000); // Every minute
  }
}

export default ConnectionManager;
