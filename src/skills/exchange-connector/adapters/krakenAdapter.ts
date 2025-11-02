/**
 * Kraken Exchange Adapter
 * Integrates with Kraken API
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
 * Configuration for Kraken
 */
const KRAKEN_CONFIG = {
  name: 'kraken',
  baseUrl: 'https://api.kraken.com',
  rateLimit: 600, // requests per minute
  timeout: 12000,
  apiVersion: '0',
};

/**
 * Kraken-specific trading pairs
 */
const KRAKEN_PAIRS = [
  'BTC/USD',
  'ETH/USD',
  'XRP/USD',
  'ADA/USD',
  'SOL/USD',
  'DOT/USD',
  'LINK/USD',
  'DOGE/USD',
  'BCH/USD',
  'LTC/USD',
];

export class KrakenAdapter extends BaseExchangeAdapter {
  private apiKey: string = '';
  private apiSecret: string = '';
  private lastRequestTime: number = 0;
  private callCounters: Map<string, number> = new Map();

  constructor() {
    super('kraken');
  }

  /**
   * Initialize Kraken adapter
   */
  async initialize(credentials: CredentialConfig): Promise<boolean> {
    try {
      this.credentials = credentials;
      this.apiKey = credentials.apiKey;
      this.apiSecret = credentials.apiSecret;

      // Test credentials
      const isValid = await this.validateCredentials(credentials);
      if (!isValid) {
        throw new Error('Invalid Kraken credentials');
      }

      this.isConnected = true;
      this.connectionStartTime = new Date();
      this.log('info', 'Successfully initialized Kraken adapter');

      return true;
    } catch (error) {
      this.log('error', 'Failed to initialize Kraken adapter', error);
      return false;
    }
  }

  /**
   * Test connectivity to Kraken
   */
  async testConnectivity(): Promise<HealthCheckResult> {
    const latencies: number[] = [];
    const pings = 5;

    try {
      for (let i = 0; i < pings; i++) {
        const startTime = Date.now();

        // Simulate API call to /0/public/Time
        await this.simulateApiCall('/Time', 'public');

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
        exchange: 'kraken',
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
   * Get account balances from Kraken
   */
  async getBalances(): Promise<Balance[]> {
    try {
      await this.checkRateLimit('private');

      // Simulate fetching balances from /0/private/Balance
      const mockBalances = [
        { asset: 'XXBT', free: '0.75', locked: '0.25' }, // XBT is Kraken's BTC symbol
        { asset: 'XETH', free: '15.0', locked: '5.0' },
        { asset: 'ZUSD', free: '3000.00', locked: '1000.00' },
      ];

      return mockBalances.map(b =>
        this.normalizeBalance('kraken', b.asset, {
          free: parseFloat(b.free),
          locked: parseFloat(b.locked),
        })
      );
    } catch (error) {
      this.handleError(error, 'getBalances');
    }
  }

  /**
   * Get market data from Kraken
   */
  async getMarketData(pair: string): Promise<MarketData | null> {
    try {
      if (!this.validatePair(pair)) {
        throw new Error(`Invalid pair format: ${pair}`);
      }

      await this.checkRateLimit('public');

      // Simulate fetching ticker from /0/public/Ticker
      const mockData = {
        bid: Math.random() * 50000,
        ask: Math.random() * 50000,
        last: Math.random() * 50000,
        volume24h: Math.random() * 500000,
      };

      return this.normalizeMarketData('kraken', pair, mockData);
    } catch (error) {
      this.log('error', `Failed to get market data for ${pair}`, error);
      return null;
    }
  }

  /**
   * Get available trading pairs from Kraken
   */
  async getTradingPairs(): Promise<TradingPair[]> {
    try {
      // Simulate fetching asset pairs from /0/public/AssetPairs
      const pairs = KRAKEN_PAIRS.map(symbol =>
        this.normalizeTradingPair('kraken', symbol, {
          minOrderSize: 0.0001,
          maxOrderSize: 5000000,
        })
      );

      return pairs;
    } catch (error) {
      this.handleError(error, 'getTradingPairs');
    }
  }

  /**
   * Validate Kraken credentials
   */
  async validateCredentials(credentials: CredentialConfig): Promise<boolean> {
    try {
      if (!credentials.apiKey || !credentials.apiSecret) {
        return false;
      }

      // Kraken keys are typically 88 characters for key and longer for secret
      if (credentials.apiKey.length < 80) {
        return false;
      }

      // Simulate API validation call
      await this.simulateApiCall('/Balance', 'private');

      return true;
    } catch (error) {
      this.log('warn', 'Kraken credential validation failed', error);
      return false;
    }
  }

  /**
   * Get Kraken supported pairs
   */
  getSupportedPairs(): string[] {
    return KRAKEN_PAIRS;
  }

  /**
   * Check rate limit for Kraken
   */
  protected async checkRateLimit(type: 'public' | 'private' = 'public'): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Kraken limits: varies by API tier
    // Basic: 15 requests per second (private), 20 (public)
    const minTimeBetweenRequests = type === 'private' ? 70 : 50; // ms

    if (timeSinceLastRequest < minTimeBetweenRequests) {
      const delay = minTimeBetweenRequests - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();

    // Track calls by type
    const key = `${type}_calls`;
    const count = (this.callCounters.get(key) || 0) + 1;
    this.callCounters.set(key, count);

    if (count > 900) {
      // Kraken has 15 requests/sec limit = 900/min
      this.log('warn', `Kraken ${type} rate limit approaching`);
    }
  }

  /**
   * Simulate API call
   */
  private async simulateApiCall(endpoint: string, type: 'public' | 'private'): Promise<any> {
    return new Promise((resolve, reject) => {
      const delay = Math.random() * 300 + 100; // 100-400ms (slightly higher latency for EU)
      setTimeout(() => {
        if (Math.random() > 0.93) {
          // 7% failure rate for testing
          reject(new Error('API call failed'));
        } else {
          resolve({ success: true });
        }
      }, delay);
    });
  }
}

export default KrakenAdapter;
