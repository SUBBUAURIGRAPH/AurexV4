/**
 * Base Exchange Adapter
 * Abstract base class for all exchange adapters
 * Defines interface and common functionality for exchange integrations
 * Version: 1.0.0
 */

import {
  CredentialConfig,
  Balance,
  MarketData,
  TradingPair,
  ExchangeHealth,
  HealthCheckResult,
} from '../types';

/**
 * Abstract base class for exchange adapters
 * All exchanges must implement this interface
 */
export abstract class BaseExchangeAdapter {
  protected exchangeName: string;
  protected credentials: CredentialConfig | null = null;
  protected isConnected: boolean = false;
  protected connectionStartTime: Date | null = null;

  constructor(exchangeName: string) {
    this.exchangeName = exchangeName;
  }

  /**
   * Initialize exchange adapter with credentials
   */
  abstract initialize(credentials: CredentialConfig): Promise<boolean>;

  /**
   * Test connectivity to exchange
   */
  abstract testConnectivity(): Promise<HealthCheckResult>;

  /**
   * Get account balances
   */
  abstract getBalances(): Promise<Balance[]>;

  /**
   * Get market data for a trading pair
   */
  abstract getMarketData(pair: string): Promise<MarketData | null>;

  /**
   * Get available trading pairs
   */
  abstract getTradingPairs(): Promise<TradingPair[]>;

  /**
   * Validate credentials
   */
  abstract validateCredentials(credentials: CredentialConfig): Promise<boolean>;

  /**
   * Get health status
   */
  getHealthStatus(): ExchangeHealth {
    const uptime = this.calculateUptime();

    return {
      name: this.exchangeName,
      status: this.isConnected ? 'healthy' : 'failed',
      connected: this.isConnected,
      lastCheck: new Date(),
      latency: 0, // Will be populated during health check
      uptime,
    };
  }

  /**
   * Get exchange name
   */
  getName(): string {
    return this.exchangeName;
  }

  /**
   * Check if connected
   */
  isConnectedToExchange(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect from exchange
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.credentials = null;
  }

  /**
   * Get supported pairs
   */
  abstract getSupportedPairs(): string[];

  /**
   * Calculate uptime since connection
   */
  protected calculateUptime(): number {
    if (!this.connectionStartTime || !this.isConnected) {
      return 0;
    }

    const now = new Date();
    const connectionDuration = now.getTime() - this.connectionStartTime.getTime();
    // Return uptime as percentage (100% if connected < 1 second)
    return Math.min(100, (connectionDuration / (24 * 60 * 60 * 1000)) * 100);
  }

  /**
   * Common error handling
   */
  protected handleError(error: any, context: string): never {
    const errorMessage = error?.message || String(error);
    const code = error?.code || 'UNKNOWN';

    throw {
      exchange: this.exchangeName,
      context,
      message: errorMessage,
      code,
      timestamp: new Date(),
    };
  }

  /**
   * Validate pair format
   */
  protected validatePair(pair: string): boolean {
    // Expected format: BTC/USD, ETH/USDT, etc.
    return /^[A-Z]+\/[A-Z]+$/.test(pair);
  }

  /**
   * Parse pair into base and quote assets
   */
  protected parsePair(pair: string): { base: string; quote: string } | null {
    const [base, quote] = pair.split('/');
    if (!base || !quote) {
      return null;
    }
    return { base, quote };
  }

  /**
   * Format number to exchange precision
   */
  protected formatNumber(value: number, precision: number): string {
    return value.toFixed(precision);
  }

  /**
   * Retry logic for network failures
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < maxAttempts) {
          // Exponential backoff
          const delay = delayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Normalize balance format
   */
  protected normalizeBalance(exchange: string, asset: string, data: any): Balance {
    return {
      exchange,
      asset,
      free: data.free || 0,
      locked: data.locked || 0,
      total: (data.free || 0) + (data.locked || 0),
    };
  }

  /**
   * Normalize market data format
   */
  protected normalizeMarketData(exchange: string, pair: string, data: any): MarketData {
    return {
      exchange,
      pair,
      bid: data.bid || 0,
      ask: data.ask || 0,
      last: data.last || 0,
      volume24h: data.volume24h || 0,
      timestamp: new Date(),
    };
  }

  /**
   * Normalize trading pair format
   */
  protected normalizeTradingPair(exchange: string, symbol: string, data?: any): TradingPair {
    const parsed = this.parsePair(symbol);

    return {
      exchange,
      symbol,
      baseAsset: parsed?.base || '',
      quoteAsset: parsed?.quote || '',
      minOrderSize: data?.minOrderSize || 0.001,
      maxOrderSize: data?.maxOrderSize || 10000000,
    };
  }

  /**
   * Check rate limit before API call
   */
  protected async checkRateLimit(): Promise<void> {
    // Override in specific adapters if rate limiting needed
  }

  /**
   * Log operation
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${this.exchangeName}] [${level.toUpperCase()}] ${message}`;

    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  }
}

/**
 * Factory function for creating adapters
 */
export function createExchangeAdapter(exchangeName: string): BaseExchangeAdapter | null {
  const adapters: Record<string, new () => BaseExchangeAdapter> = {
    binance: () => require('./binanceAdapter').BinanceAdapter,
    kraken: () => require('./krakenAdapter').KrakenAdapter,
    'coinbase-pro': () => require('./coinbaseAdapter').CoinbaseAdapter,
  };

  const AdapterClass = adapters[exchangeName.toLowerCase()]?.();
  if (!AdapterClass) {
    return null;
  }

  return new AdapterClass(exchangeName);
}

export default BaseExchangeAdapter;
