/**
 * Exchange Connector Skill
 * Manages connections to 12+ cryptocurrency and trading exchanges
 * Agent: Trading Operations
 * Version: 1.0.0
 */

import crypto from 'crypto';

// Types for exchange connector
interface ExchangeConfig {
  name: string;
  apiKey: string;
  apiSecret: string;
  apiPassphrase?: string;
  sandbox?: boolean;
  rateLimit?: number;
}

interface ExchangeHealth {
  name: string;
  connected: boolean;
  lastCheck: Date;
  latency: number;
  status: 'healthy' | 'degraded' | 'failed';
  errorMessage?: string;
}

interface Balance {
  exchange: string;
  asset: string;
  free: number;
  locked: number;
  total: number;
}

interface MarketData {
  exchange: string;
  pair: string;
  bid: number;
  ask: number;
  last: number;
  volume24h: number;
  timestamp: Date;
}

interface TradingPair {
  exchange: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  minOrderSize: number;
  maxOrderSize: number;
}

/**
 * Exchange Connector Class
 * Provides unified interface for 12+ exchanges
 */
export class ExchangeConnector {
  private exchanges: Map<string, ExchangeConfig>;
  private health: Map<string, ExchangeHealth>;
  private credentials: Map<string, string>;
  private rateLimits: Map<string, number>;
  private requestQueue: Array<() => Promise<any>>;
  private isProcessing: boolean;

  constructor() {
    this.exchanges = new Map();
    this.health = new Map();
    this.credentials = new Map();
    this.rateLimits = new Map();
    this.requestQueue = [];
    this.isProcessing = false;

    // Initialize rate limits for supported exchanges
    this.initializeRateLimits();
  }

  /**
   * Initialize rate limits for all supported exchanges
   */
  private initializeRateLimits(): void {
    const exchangeLimits: Record<string, number> = {
      'binance': 1200, // 1200 requests per minute
      'coinbase': 10, // 10 requests per second
      'kraken': 15, // 15 requests per second
      'bybit': 120, // 120 requests per minute
      'alpaca': 500, // 500 requests per minute
      'okx': 40, // 40 requests per second
      'kucoin': 100, // 100 requests per 10 seconds
      'bitfinex': 90, // 90 requests per minute
      'gate.io': 3000, // 3000 requests per minute
      'huobi': 100, // 100 requests per second
      'gemini': 120, // 120 requests per minute
      'ftx': 30, // 30 requests per second
    };

    Object.entries(exchangeLimits).forEach(([exchange, limit]) => {
      this.rateLimits.set(exchange, limit);
    });
  }

  /**
   * Register an exchange connection
   */
  registerExchange(config: ExchangeConfig): boolean {
    try {
      // Validate exchange name
      const validExchanges = [
        'binance', 'coinbase', 'kraken', 'bybit', 'alpaca', 'okx',
        'kucoin', 'bitfinex', 'gate.io', 'huobi', 'gemini', 'ftx'
      ];

      if (!validExchanges.includes(config.name.toLowerCase())) {
        throw new Error(`Unsupported exchange: ${config.name}`);
      }

      // Encrypt and store credentials
      const encryptedKey = this.encryptCredential(config.apiKey);
      const encryptedSecret = this.encryptCredential(config.apiSecret);

      this.exchanges.set(config.name, {
        ...config,
        apiKey: encryptedKey,
        apiSecret: encryptedSecret,
      });

      // Initialize health status
      this.health.set(config.name, {
        name: config.name,
        connected: false,
        lastCheck: new Date(),
        latency: 0,
        status: 'failed',
      });

      return true;
    } catch (error) {
      console.error(`Error registering exchange ${config.name}:`, error);
      return false;
    }
  }

  /**
   * Encrypt credential using AES-256
   */
  private encryptCredential(credential: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(credential, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Test connectivity to all exchanges
   */
  async testConnectivity(): Promise<ExchangeHealth[]> {
    const healthChecks: ExchangeHealth[] = [];

    for (const [exchangeName, config] of this.exchanges) {
      const startTime = Date.now();
      try {
        // Simulate connectivity test
        await this.simulateExchangeCall(exchangeName);
        const latency = Date.now() - startTime;

        const healthStatus: ExchangeHealth = {
          name: exchangeName,
          connected: true,
          lastCheck: new Date(),
          latency,
          status: latency < 500 ? 'healthy' : 'degraded',
        };

        this.health.set(exchangeName, healthStatus);
        healthChecks.push(healthStatus);
      } catch (error) {
        const healthStatus: ExchangeHealth = {
          name: exchangeName,
          connected: false,
          lastCheck: new Date(),
          latency: Date.now() - startTime,
          status: 'failed',
          errorMessage: (error as Error).message,
        };

        this.health.set(exchangeName, healthStatus);
        healthChecks.push(healthStatus);
      }
    }

    return healthChecks;
  }

  /**
   * Simulate exchange API call (for demo purposes)
   */
  private async simulateExchangeCall(exchangeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const delay = Math.random() * 500;
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          resolve();
        } else {
          reject(new Error(`Connection failed for ${exchangeName}`));
        }
      }, delay);
    });
  }

  /**
   * Get health status of all exchanges
   */
  getHealthStatus(): ExchangeHealth[] {
    return Array.from(this.health.values());
  }

  /**
   * Get health summary
   */
  getHealthSummary(): {
    total: number;
    connected: number;
    degraded: number;
    failed: number;
    overallHealth: number;
  } {
    const healthStates = Array.from(this.health.values());
    const connected = healthStates.filter(h => h.status === 'healthy').length;
    const degraded = healthStates.filter(h => h.status === 'degraded').length;
    const failed = healthStates.filter(h => h.status === 'failed').length;
    const total = healthStates.length;

    return {
      total,
      connected,
      degraded,
      failed,
      overallHealth: total > 0 ? (connected / total) * 100 : 0,
    };
  }

  /**
   * Get balances from all exchanges
   */
  async getBalances(): Promise<Balance[]> {
    const allBalances: Balance[] = [];

    for (const exchangeName of this.exchanges.keys()) {
      try {
        // Simulate fetching balances
        const balances = await this.fetchExchangeBalances(exchangeName);
        allBalances.push(...balances);
      } catch (error) {
        console.error(`Error fetching balances from ${exchangeName}:`, error);
      }
    }

    return allBalances;
  }

  /**
   * Simulate fetching balances from an exchange
   */
  private async fetchExchangeBalances(exchangeName: string): Promise<Balance[]> {
    const mockBalances: Balance[] = [
      {
        exchange: exchangeName,
        asset: 'BTC',
        free: Math.random() * 10,
        locked: Math.random() * 5,
        total: 0,
      },
      {
        exchange: exchangeName,
        asset: 'ETH',
        free: Math.random() * 100,
        locked: Math.random() * 50,
        total: 0,
      },
      {
        exchange: exchangeName,
        asset: 'USDT',
        free: Math.random() * 10000,
        locked: Math.random() * 5000,
        total: 0,
      },
    ];

    // Calculate total
    mockBalances.forEach(balance => {
      balance.total = balance.free + balance.locked;
    });

    return mockBalances;
  }

  /**
   * Get market data for a trading pair
   */
  async getMarketData(exchangeName: string, pair: string): Promise<MarketData | null> {
    try {
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) {
        throw new Error(`Exchange not found: ${exchangeName}`);
      }

      // Simulate fetching market data
      const data: MarketData = {
        exchange: exchangeName,
        pair,
        bid: Math.random() * 50000,
        ask: Math.random() * 50000,
        last: Math.random() * 50000,
        volume24h: Math.random() * 1000000,
        timestamp: new Date(),
      };

      return data;
    } catch (error) {
      console.error(`Error fetching market data:`, error);
      return null;
    }
  }

  /**
   * Get available trading pairs
   */
  async getTradingPairs(exchangeName: string): Promise<TradingPair[]> {
    try {
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) {
        throw new Error(`Exchange not found: ${exchangeName}`);
      }

      // Simulate fetching trading pairs
      const pairs: TradingPair[] = [
        {
          exchange: exchangeName,
          symbol: 'BTC/USDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          minOrderSize: 0.001,
          maxOrderSize: 100,
        },
        {
          exchange: exchangeName,
          symbol: 'ETH/USDT',
          baseAsset: 'ETH',
          quoteAsset: 'USDT',
          minOrderSize: 0.01,
          maxOrderSize: 10000,
        },
        {
          exchange: exchangeName,
          symbol: 'ADA/USDT',
          baseAsset: 'ADA',
          quoteAsset: 'USDT',
          minOrderSize: 1,
          maxOrderSize: 1000000,
        },
      ];

      return pairs;
    } catch (error) {
      console.error(`Error fetching trading pairs:`, error);
      return [];
    }
  }

  /**
   * Generate diagnostic report
   */
  generateDiagnosticReport(): string {
    const summary = this.getHealthSummary();
    const healthStatus = this.getHealthStatus();

    let report = `
================================================================================
                    EXCHANGE CONNECTOR DIAGNOSTIC REPORT
================================================================================

OVERALL STATUS
--------------
Total Exchanges: ${summary.total}
Connected: ${summary.connected}
Degraded: ${summary.degraded}
Failed: ${summary.failed}
Overall Health: ${summary.overallHealth.toFixed(2)}%

DETAILED STATUS
---------------
`;

    healthStatus.forEach(status => {
      report += `
${status.name.toUpperCase()}
  Status: ${status.status}
  Connected: ${status.connected}
  Latency: ${status.latency}ms
  Last Check: ${status.lastCheck.toISOString()}
  ${status.errorMessage ? `Error: ${status.errorMessage}` : ''}
`;
    });

    report += `
================================================================================
`;

    return report;
  }

  /**
   * Get all registered exchanges
   */
  getRegisteredExchanges(): string[] {
    return Array.from(this.exchanges.keys());
  }

  /**
   * Queue a request respecting rate limits
   */
  async queueRequest(exchangeName: string, request: () => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  /**
   * Process request queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
          // Add delay between requests to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error('Error processing queued request:', error);
        }
      }
    }

    this.isProcessing = false;
  }
}

export default ExchangeConnector;
