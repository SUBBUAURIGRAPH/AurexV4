/**
 * Binance Exchange Adapter
 * Integrates with Binance API
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
 * Configuration for Binance
 */
const BINANCE_CONFIG = {
  name: 'binance',
  baseUrl: 'https://api.binance.com',
  testnetUrl: 'https://testnet.binance.vision',
  wsUrl: 'wss://stream.binance.com',
  rateLimit: 1200, // requests per minute
  timeout: 10000,
  apiVersion: 'v3',
};

/**
 * Binance-specific trading pairs
 */
const BINANCE_PAIRS = [
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'XRP/USDT',
  'ADA/USDT',
  'SOL/USDT',
  'DOT/USDT',
  'DOGE/USDT',
  'MATIC/USDT',
  'LINK/USDT',
];

export class BinanceAdapter extends BaseExchangeAdapter {
  private apiKey: string = '';
  private apiSecret: string = '';
  private lastRequestTime: number = 0;
  private requestCount: number = 0;

  constructor() {
    super('binance');
  }

  /**
   * Initialize Binance adapter
   */
  async initialize(credentials: CredentialConfig): Promise<boolean> {
    try {
      this.credentials = credentials;
      this.apiKey = credentials.apiKey;
      this.apiSecret = credentials.apiSecret;

      // Test credentials
      const isValid = await this.validateCredentials(credentials);
      if (!isValid) {
        throw new Error('Invalid Binance credentials');
      }

      this.isConnected = true;
      this.connectionStartTime = new Date();
      this.log('info', 'Successfully initialized Binance adapter');

      return true;
    } catch (error) {
      this.log('error', 'Failed to initialize Binance adapter', error);
      return false;
    }
  }

  /**
   * Test connectivity to Binance
   */
  async testConnectivity(): Promise<HealthCheckResult> {
    const latencies: number[] = [];
    const pings = 5;

    try {
      for (let i = 0; i < pings; i++) {
        const startTime = Date.now();

        // Simulate API call to /api/v3/ping
        await this.simulateApiCall('/ping');

        const latency = Date.now() - startTime;
        latencies.push(latency);

        // Small delay between pings
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const minLatency = Math.min(...latencies);
      const maxLatency = Math.max(...latencies);

      // Calculate standard deviation
      const variance = latencies.reduce((sq, n) => sq + Math.pow(n - avgLatency, 2), 0) / latencies.length;
      const stdDevLatency = Math.sqrt(variance);

      return {
        exchange: 'binance',
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
   * Get account balances from Binance
   */
  async getBalances(): Promise<Balance[]> {
    try {
      await this.checkRateLimit();

      // Simulate fetching balances from /api/v3/account
      const mockBalances = [
        { asset: 'BTC', free: '1.5', locked: '0.5' },
        { asset: 'ETH', free: '25.0', locked: '10.0' },
        { asset: 'USDT', free: '5000.00', locked: '2000.00' },
        { asset: 'BNB', free: '10.0', locked: '5.0' },
      ];

      return mockBalances.map(b =>
        this.normalizeBalance('binance', b.asset, {
          free: parseFloat(b.free),
          locked: parseFloat(b.locked),
        })
      );
    } catch (error) {
      this.handleError(error, 'getBalances');
    }
  }

  /**
   * Get market data from Binance
   */
  async getMarketData(pair: string): Promise<MarketData | null> {
    try {
      if (!this.validatePair(pair)) {
        throw new Error(`Invalid pair format: ${pair}`);
      }

      await this.checkRateLimit();

      // Simulate fetching ticker from /api/v3/ticker/24hr
      const mockData = {
        bid: Math.random() * 50000,
        ask: Math.random() * 50000,
        last: Math.random() * 50000,
        volume24h: Math.random() * 1000000,
      };

      return this.normalizeMarketData('binance', pair, mockData);
    } catch (error) {
      this.log('error', `Failed to get market data for ${pair}`, error);
      return null;
    }
  }

  /**
   * Get available trading pairs from Binance
   */
  async getTradingPairs(): Promise<TradingPair[]> {
    try {
      // Simulate fetching exchange info from /api/v3/exchangeInfo
      const pairs = BINANCE_PAIRS.map(symbol =>
        this.normalizeTradingPair('binance', symbol, {
          minOrderSize: 0.001,
          maxOrderSize: 10000000,
        })
      );

      return pairs;
    } catch (error) {
      this.handleError(error, 'getTradingPairs');
    }
  }

  /**
   * Validate Binance credentials
   */
  async validateCredentials(credentials: CredentialConfig): Promise<boolean> {
    try {
      if (!credentials.apiKey || !credentials.apiSecret) {
        return false;
      }

      // Check key format (Binance keys are 64+ characters)
      if (credentials.apiKey.length < 64 || credentials.apiSecret.length < 64) {
        return false;
      }

      // Simulate API validation call
      await this.simulateApiCall('/account', 'GET');

      return true;
    } catch (error) {
      this.log('warn', 'Binance credential validation failed', error);
      return false;
    }
  }

  /**
   * Get Binance supported pairs
   */
  getSupportedPairs(): string[] {
    return BINANCE_PAIRS;
  }

  /**
   * Check rate limit for Binance
   */
  protected async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Binance limit: 1200 requests per minute
    // = 20 requests per second
    const minTimeBetweenRequests = 50; // ms

    if (timeSinceLastRequest < minTimeBetweenRequests) {
      const delay = minTimeBetweenRequests - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;

    // Reset counter every minute
    if (this.requestCount > 1200) {
      this.requestCount = 0;
      this.log('warn', 'Binance rate limit approaching');
    }
  }

  /**
   * Simulate API call (Phase 5 will use real CCXT)
   */
  private async simulateApiCall(endpoint: string, method: string = 'GET'): Promise<any> {
    return new Promise((resolve, reject) => {
      const delay = Math.random() * 200 + 50; // 50-250ms
      setTimeout(() => {
        if (Math.random() > 0.95) {
          // 5% failure rate for testing
          reject(new Error('API call failed'));
        } else {
          resolve({ success: true });
        }
      }, delay);
    });
  }
}

export default BinanceAdapter;
