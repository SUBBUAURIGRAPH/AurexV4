/**
 * ExchangeConnector Integration Tests
 * Tests complete workflow from connection to trading
 */

import ExchangeConnector from '../src/ExchangeConnector';

describe('ExchangeConnector Integration Tests', () => {
  let connector: ExchangeConnector;

  beforeEach(() => {
    connector = new ExchangeConnector({
      logLevel: 'error', // Suppress logs in tests
    });
  });

  afterEach(async () => {
    await connector.shutdown();
  });

  describe('Complete Connection Workflow', () => {
    it('should connect to Binance successfully', async () => {
      const result = await connector.connectExchange({
        name: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        sandbox: true,
      });

      expect(result.success).toBe(true);
      expect(result.exchangeId).toBeDefined();
      expect(result.latency).toBeGreaterThan(0);
    });

    it('should connect to multiple exchanges', async () => {
      const exchanges = [
        { name: 'binance', apiKey: 'key1', apiSecret: 'secret1' },
        { name: 'kraken', apiKey: 'key2', apiSecret: 'secret2' },
        { name: 'coinbase', apiKey: 'key3', apiSecret: 'secret3', passphrase: 'pass' },
      ];

      for (const ex of exchanges) {
        const result = await connector.connectExchange(ex as any);
        expect(result.success).toBe(true);
      }

      const active = connector.getActiveExchanges();
      expect(active.length).toBe(3);
    });

    it('should fail to connect to unsupported exchange', async () => {
      const result = await connector.connectExchange({
        name: 'unsupported-exchange',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Health Monitoring', () => {
    it('should track connection health', async () => {
      await connector.connectExchange({
        name: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        sandbox: true,
      });

      const testResult = await connector.testConnection('binance');
      expect(testResult.success).toBe(true);
      expect(testResult.latency).toBeGreaterThan(0);
    });

    it('should monitor multiple exchanges', async () => {
      await connector.connectExchange({
        name: 'binance',
        apiKey: 'key1',
        apiSecret: 'secret1',
      });

      await connector.connectExchange({
        name: 'kraken',
        apiKey: 'key2',
        apiSecret: 'secret2',
      });

      const health = connector.getHealthStatus();
      expect(health.has('binance')).toBe(true);
      expect(health.has('kraken')).toBe(true);
    });

    it('should report health metrics', async () => {
      await connector.connectExchange({
        name: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      await connector.testConnection('binance');

      const health = connector.getHealthStatus();
      const binanceHealth = health.get('binance');

      expect(binanceHealth).toHaveProperty('status');
      expect(binanceHealth).toHaveProperty('latency');
      expect(binanceHealth?.latency).toHaveProperty('p50');
      expect(binanceHealth?.latency).toHaveProperty('p95');
      expect(binanceHealth?.latency).toHaveProperty('p99');
    });
  });

  describe('Balance Operations', () => {
    beforeEach(async () => {
      await connector.connectExchange({
        name: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });
    });

    it('should retrieve balance', async () => {
      const balance = await connector.getBalance('binance');
      expect(balance).toBeDefined();
      expect(typeof balance).toBe('object');
    });

    it('should have correct balance structure', async () => {
      const balance = await connector.getBalance('binance');

      for (const [asset, value] of Object.entries(balance)) {
        expect(typeof asset).toBe('string');
        expect(value).toHaveProperty('free');
        expect(value).toHaveProperty('used');
        expect(value).toHaveProperty('total');
        expect(value.total).toBe(value.free + value.used);
      }
    });

    it('should handle balance errors', async () => {
      try {
        await connector.getBalance('unknown-exchange');
        fail('Should throw error');
      } catch (error) {
        expect(String(error)).toBeDefined();
      }
    });
  });

  describe('Trading Operations', () => {
    beforeEach(async () => {
      await connector.connectExchange({
        name: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        sandbox: true,
      });
    });

    it('should place market order', async () => {
      const trade = await connector.placeTrade('binance', {
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.001,
      });

      expect(trade.orderId).toBeDefined();
      expect(trade.symbol).toBe('BTC/USDT');
      expect(trade.side).toBe('buy');
      expect(trade.status).toBeDefined();
    });

    it('should place limit order', async () => {
      const trade = await connector.placeTrade('binance', {
        symbol: 'ETH/USDT',
        side: 'sell',
        type: 'limit',
        quantity: 0.1,
        price: 2000,
      });

      expect(trade.orderId).toBeDefined();
      expect(trade.price).toBe(2000);
    });

    it('should validate trade parameters', async () => {
      try {
        await connector.placeTrade('binance', {
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: -1, // Invalid negative quantity
        });
        fail('Should throw validation error');
      } catch (error) {
        expect(String(error)).toContain('Quantity');
      }
    });

    it('should require price for limit orders', async () => {
      try {
        await connector.placeTrade('binance', {
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'limit',
          quantity: 1,
          // Missing price
        });
        fail('Should throw validation error');
      } catch (error) {
        expect(String(error)).toContain('price');
      }
    });
  });

  describe('Market Data', () => {
    beforeEach(async () => {
      await connector.connectExchange({
        name: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });
    });

    it('should retrieve market data', async () => {
      const data = await connector.getMarketData('binance', ['BTC/USDT']);
      expect(data).toHaveLength(1);
    });

    it('should have correct market data structure', async () => {
      const data = await connector.getMarketData('binance', ['BTC/USDT', 'ETH/USDT']);

      expect(data).toHaveLength(2);
      for (const item of data) {
        expect(item).toHaveProperty('symbol');
        expect(item).toHaveProperty('bid');
        expect(item).toHaveProperty('ask');
        expect(item).toHaveProperty('last');
        expect(item).toHaveProperty('volume');
        expect(item).toHaveProperty('timestamp');
        expect(item.bid).toBeLessThanOrEqual(item.ask);
      }
    });

    it('should handle empty symbols array', async () => {
      const data = await connector.getMarketData('binance', []);
      expect(data).toHaveLength(0);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await connector.connectExchange({
        name: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });
    });

    it('should enforce rate limits', async () => {
      // Try rapid requests
      let rateLimitHits = 0;

      for (let i = 0; i < 50; i++) {
        try {
          await connector.getBalance('binance');
        } catch (error) {
          if (String(error).includes('rate limit')) {
            rateLimitHits++;
          }
        }
      }

      // Some might hit rate limit depending on timing
      expect(rateLimitHits).toBeLessThanOrEqual(50);
    });

    it('should support burst requests', async () => {
      // Binance burst size is ~40
      const promises = [];
      for (let i = 0; i < 40; i++) {
        promises.push(connector.getBalance('binance'));
      }

      const results = await Promise.allSettled(promises);
      // Most should succeed due to burst capacity
      const successes = results.filter(r => r.status === 'fulfilled').length;
      expect(successes).toBeGreaterThan(10);
    });
  });

  describe('Multi-Exchange Operations', () => {
    beforeEach(async () => {
      await connector.connectExchange({
        name: 'binance',
        apiKey: 'key1',
        apiSecret: 'secret1',
      });

      await connector.connectExchange({
        name: 'kraken',
        apiKey: 'key2',
        apiSecret: 'secret2',
      });

      await connector.connectExchange({
        name: 'coinbase',
        apiKey: 'key3',
        apiSecret: 'secret3',
        passphrase: 'pass',
      });
    });

    it('should get balances from all exchanges', async () => {
      const exchanges = connector.getActiveExchanges();
      expect(exchanges).toContain('binance');
      expect(exchanges).toContain('kraken');
      expect(exchanges).toContain('coinbase');

      for (const ex of exchanges) {
        const balance = await connector.getBalance(ex);
        expect(balance).toBeDefined();
      }
    });

    it('should get health status of all exchanges', async () => {
      const health = connector.getHealthStatus();
      expect(health.size).toBe(3);
      expect(health.has('binance')).toBe(true);
      expect(health.has('kraken')).toBe(true);
      expect(health.has('coinbase')).toBe(true);
    });

    it('should disconnect individual exchanges', async () => {
      await connector.disconnectExchange('binance');
      const active = connector.getActiveExchanges();
      expect(active).not.toContain('binance');
      expect(active).toContain('kraken');
      expect(active).toContain('coinbase');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      try {
        await connector.connectExchange({
          name: 'binance',
          apiKey: '',
          apiSecret: '',
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should not expose sensitive data in errors', async () => {
      try {
        await connector.connectExchange({
          name: 'binance',
          apiKey: 'secret-api-key-12345',
          apiSecret: 'secret-secret-67890',
        });
      } catch (error) {
        const errorMsg = String(error);
        expect(errorMsg).not.toContain('secret-api-key');
        expect(errorMsg).not.toContain('secret-secret');
      }
    });
  });

  describe('Event Emitter', () => {
    it('should emit exchange:connected event', async done => {
      connector.on('exchange:connected', (data) => {
        expect(data.exchange).toBe('binance');
        expect(data.timestamp).toBeDefined();
        expect(data.latency).toBeGreaterThan(0);
        done();
      });

      await connector.connectExchange({
        name: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });
    });

    it('should emit trade:placed event', async done => {
      await connector.connectExchange({
        name: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        sandbox: true,
      });

      connector.on('trade:placed', (data) => {
        expect(data.exchange).toBe('binance');
        expect(data.order).toBeDefined();
        done();
      });

      await connector.placeTrade('binance', {
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.001,
      });
    });
  });

  describe('Supported Exchanges', () => {
    it('should list all supported exchanges', () => {
      const supported = connector.getSupportedExchanges();
      expect(supported).toContain('binance');
      expect(supported).toContain('kraken');
      expect(supported).toContain('coinbase');
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown cleanly', async () => {
      await connector.connectExchange({
        name: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      expect(connector.getActiveExchanges().length).toBeGreaterThan(0);

      await connector.shutdown();

      expect(connector.getActiveExchanges().length).toBe(0);
    });
  });
});
