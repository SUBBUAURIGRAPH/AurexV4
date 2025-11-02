/**
 * Coinbase Pro Exchange Adapter
 * Integrates with Coinbase Pro (now Coinbase Advanced) API
 * Version: 1.0.0
 */

import { BaseExchangeAdapter } from './baseAdapter';
import {
  CredentialConfig,
  Balance,
  MarketData,
  TradingPair,
  HealthCheckResult,
} from '../types';

/**
 * Configuration for Coinbase Pro
 */
const COINBASE_CONFIG = {
  name: 'coinbase-pro',
  baseUrl: 'https://api.exchange.coinbase.com',
  sandboxUrl: 'https://api-sandbox.exchange.coinbase.com',
  rateLimit: 300, // requests per minute
  timeout: 10000,
  apiVersion: 'v3',
};

/**
 * Coinbase-specific trading pairs
 */
const COINBASE_PAIRS = [
  'BTC/USD',
  'ETH/USD',
  'XRP/USD',
  'ADA/USD',
  'SOL/USD',
  'AVAX/USD',
  'MATIC/USD',
  'ARB/USD',
  'OP/USD',
  'DOGE/USD',
];

export class CoinbaseAdapter extends BaseExchangeAdapter {
  private apiKey: string = '';
  private apiSecret: string = '';
  private passphrase: string = '';
  private lastRequestTime: number = 0;
  private requestCount: number = 0;

  constructor() {
    super('coinbase-pro');
  }

  /**
   * Initialize Coinbase adapter
   */
  async initialize(credentials: CredentialConfig): Promise<boolean> {
    try {
      this.credentials = credentials;
      this.apiKey = credentials.apiKey;
      this.apiSecret = credentials.apiSecret;
      this.passphrase = credentials.apiPassphrase || '';

      // Coinbase requires all three credentials
      if (!this.apiKey || !this.apiSecret || !this.passphrase) {
        throw new Error('Coinbase requires apiKey, apiSecret, and apiPassphrase');
      }

      // Test credentials
      const isValid = await this.validateCredentials(credentials);
      if (!isValid) {
        throw new Error('Invalid Coinbase credentials');
      }

      this.isConnected = true;
      this.connectionStartTime = new Date();
      this.log('info', 'Successfully initialized Coinbase adapter');

      return true;
    } catch (error) {
      this.log('error', 'Failed to initialize Coinbase adapter', error);
      return false;
    }
  }

  /**
   * Test connectivity to Coinbase
   */
  async testConnectivity(): Promise<HealthCheckResult> {
    const latencies: number[] = [];
    const pings = 5;

    try {
      for (let i = 0; i < pings; i++) {
        const startTime = Date.now();

        // Simulate API call to /time
        await this.simulateApiCall('/time', 'public');

        const latency = Date.now() - startTime;
        latencies.push(latency);

        // Small delay between pings
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const minLatency = Math.min(...latencies);
      const maxLatency = Math.max(...latencies);
      const variance = latencies.reduce((sq, n) => sq + Math.pow(n - avgLatency, 2), 0) / latencies.length;
      const stdDevLatency = Math.sqrt(variance);

      return {
        exchange: 'coinbase-pro',
        latencies,
        avgLatency,
        minLatency,
        maxLatency,
        stdDevLatency,
        status: avgLatency < 500 ? 'healthy' : avgLatency < 1000 ? 'degraded' : 'slow',
        timestamp: new Date(),
      };
    } catch (error) {
      this.handleError(error, 'testConnectivity');
    }
  }

  /**
   * Get account balances from Coinbase
   */
  async getBalances(): Promise<Balance[]> {
    try {
      await this.checkRateLimit('private');

      // Simulate fetching accounts from /accounts
      const mockBalances = [
        { asset: 'BTC', free: '2.0', locked: '0' },
        { asset: 'ETH', free: '50.0', locked: '0' },
        { asset: 'USD', free: '10000.00', locked: '0' },
        { asset: 'USDC', free: '5000.00', locked: '0' },
      ];

      return mockBalances.map(b =>
        this.normalizeBalance('coinbase-pro', b.asset, {
          free: parseFloat(b.free),
          locked: parseFloat(b.locked),
        })
      );
    } catch (error) {
      this.handleError(error, 'getBalances');
    }
  }

  /**
   * Get market data from Coinbase
   */
  async getMarketData(pair: string): Promise<MarketData | null> {
    try {
      if (!this.validatePair(pair)) {
        throw new Error(`Invalid pair format: ${pair}`);
      }

      await this.checkRateLimit('public');

      // Simulate fetching ticker from /products/{product_id}/ticker
      const mockData = {
        bid: Math.random() * 50000,
        ask: Math.random() * 50000,
        last: Math.random() * 50000,
        volume24h: Math.random() * 1000000,
      };

      return this.normalizeMarketData('coinbase-pro', pair, mockData);
    } catch (error) {
      this.log('error', `Failed to get market data for ${pair}`, error);
      return null;
    }
  }

  /**
   * Get available trading pairs from Coinbase
   */
  async getTradingPairs(): Promise<TradingPair[]> {
    try {
      // Simulate fetching products from /products
      const pairs = COINBASE_PAIRS.map(symbol =>
        this.normalizeTradingPair('coinbase-pro', symbol, {
          minOrderSize: 0.01,
          maxOrderSize: 10000000,
        })
      );

      return pairs;
    } catch (error) {
      this.handleError(error, 'getTradingPairs');
    }
  }

  /**
   * Validate Coinbase credentials
   */
  async validateCredentials(credentials: CredentialConfig): Promise<boolean> {
    try {
      if (!credentials.apiKey || !credentials.apiSecret) {
        return false;
      }

      // Coinbase requires passphrase
      if (!credentials.apiPassphrase) {
        this.log('warn', 'Coinbase adapter requires apiPassphrase');
        return false;
      }

      // Coinbase API keys are typically 64 characters
      if (credentials.apiKey.length < 32) {
        return false;
      }

      // Simulate API validation call
      await this.simulateApiCall('/accounts', 'private');

      return true;
    } catch (error) {
      this.log('warn', 'Coinbase credential validation failed', error);
      return false;
    }
  }

  /**
   * Get Coinbase supported pairs
   */
  getSupportedPairs(): string[] {
    return COINBASE_PAIRS;
  }

  /**
   * Check rate limit for Coinbase
   */
  protected async checkRateLimit(type: 'public' | 'private' = 'public'): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Coinbase limit: 10 requests per second
    // = 100ms minimum between requests
    const minTimeBetweenRequests = 100;

    if (timeSinceLastRequest < minTimeBetweenRequests) {
      const delay = minTimeBetweenRequests - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;

    // Reset counter every minute
    if (this.requestCount > 600) {
      // 10 req/sec * 60 = 600 req/min
      this.log('warn', 'Coinbase rate limit approaching');
      this.requestCount = 0;
    }
  }

  /**
   * Simulate API call (Phase 5 will use real CCXT with actual HTTP)
   */
  private async simulateApiCall(endpoint: string, type: 'public' | 'private'): Promise<any> {
    return new Promise((resolve, reject) => {
      const delay = Math.random() * 150 + 50; // 50-200ms
      setTimeout(() => {
        if (Math.random() > 0.97) {
          // 3% failure rate for testing
          reject(new Error('API call failed'));
        } else {
          resolve({ success: true });
        }
      }, delay);
    });
  }

  /**
   * Override to handle Coinbase-specific signing (Phase 5)
   */
  private signRequest(method: string, endpoint: string, body?: string): Record<string, string> {
    // Phase 5: Implement CB-ACCESS-SIGN header
    // Uses HMAC-SHA256 of timestamp + method + path + body
    return {
      'CB-ACCESS-KEY': this.apiKey,
      'CB-ACCESS-TIMESTAMP': Date.now().toString(),
      'CB-ACCESS-SIGN': '', // Will be computed in Phase 5
      'CB-ACCESS-PASSPHRASE': this.passphrase,
    };
  }
}

export default CoinbaseAdapter;
