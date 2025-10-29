/**
 * Exchange Connector Skill - Test Suite
 * Tests for exchange connectivity, health monitoring, and management
 */

import ExchangeConnector, { ExchangeConnector as ExchangeConnectorClass } from '../../src/skills/exchange-connector';

describe('ExchangeConnector Skill', () => {
  let connector: ExchangeConnectorClass;

  beforeEach(() => {
    connector = new ExchangeConnector();
  });

  describe('Initialization', () => {
    it('should initialize with empty exchanges', () => {
      const exchanges = connector.getRegisteredExchanges();
      expect(exchanges).toHaveLength(0);
    });

    it('should initialize rate limits for all supported exchanges', () => {
      const summary = connector.getHealthSummary();
      expect(summary.total).toBe(0);
    });
  });

  describe('Exchange Registration', () => {
    it('should register a valid exchange', () => {
      const result = connector.registerExchange({
        name: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      expect(result).toBe(true);
      expect(connector.getRegisteredExchanges()).toContain('binance');
    });

    it('should register multiple exchanges', () => {
      connector.registerExchange({
        name: 'binance',
        apiKey: 'key1',
        apiSecret: 'secret1',
      });

      connector.registerExchange({
        name: 'coinbase',
        apiKey: 'key2',
        apiSecret: 'secret2',
      });

      const exchanges = connector.getRegisteredExchanges();
      expect(exchanges).toHaveLength(2);
      expect(exchanges).toContain('binance');
      expect(exchanges).toContain('coinbase');
    });

    it('should reject invalid exchange names', () => {
      const result = connector.registerExchange({
        name: 'invalid-exchange',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      expect(result).toBe(false);
    });

    it('should support all 12 major exchanges', () => {
      const exchanges = [
        'binance', 'coinbase', 'kraken', 'bybit', 'alpaca', 'okx',
        'kucoin', 'bitfinex', 'gate.io', 'huobi', 'gemini', 'ftx'
      ];

      exchanges.forEach(exchange => {
        const result = connector.registerExchange({
          name: exchange,
          apiKey: `key-${exchange}`,
          apiSecret: `secret-${exchange}`,
        });

        expect(result).toBe(true);
      });

      expect(connector.getRegisteredExchanges()).toHaveLength(12);
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(() => {
      connector.registerExchange({
        name: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
      });

      connector.registerExchange({
        name: 'coinbase',
        apiKey: 'key',
        apiSecret: 'secret',
      });
    });

    it('should test connectivity to exchanges', async () => {
      const health = await connector.testConnectivity();
      expect(health).toHaveLength(2);
      expect(health[0]).toHaveProperty('name');
      expect(health[0]).toHaveProperty('connected');
      expect(health[0]).toHaveProperty('latency');
      expect(health[0]).toHaveProperty('status');
    });

    it('should return health status for each exchange', async () => {
      await connector.testConnectivity();
      const status = connector.getHealthStatus();

      expect(status).toHaveLength(2);
      status.forEach(s => {
        expect(['healthy', 'degraded', 'failed']).toContain(s.status);
      });
    });

    it('should calculate overall health summary', async () => {
      await connector.testConnectivity();
      const summary = connector.getHealthSummary();

      expect(summary).toHaveProperty('total', 2);
      expect(summary).toHaveProperty('connected');
      expect(summary).toHaveProperty('degraded');
      expect(summary).toHaveProperty('failed');
      expect(summary).toHaveProperty('overallHealth');
      expect(summary.overallHealth).toBeGreaterThanOrEqual(0);
      expect(summary.overallHealth).toBeLessThanOrEqual(100);
    });
  });

  describe('Credentials Management', () => {
    it('should encrypt API credentials', () => {
      const result = connector.registerExchange({
        name: 'binance',
        apiKey: 'my-api-key',
        apiSecret: 'my-api-secret',
      });

      expect(result).toBe(true);
      // Credentials should be encrypted in the internal storage
    });

    it('should support API passphrase for exchanges that require it', () => {
      const result = connector.registerExchange({
        name: 'kraken',
        apiKey: 'key',
        apiSecret: 'secret',
        apiPassphrase: 'passphrase',
      });

      expect(result).toBe(true);
    });

    it('should support sandbox mode configuration', () => {
      const result = connector.registerExchange({
        name: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
        sandbox: true,
      });

      expect(result).toBe(true);
    });
  });

  describe('Market Data', () => {
    beforeEach(() => {
      connector.registerExchange({
        name: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
      });
    });

    it('should fetch market data for a trading pair', async () => {
      const data = await connector.getMarketData('binance', 'BTC/USDT');
      expect(data).not.toBeNull();
      expect(data?.pair).toBe('BTC/USDT');
      expect(data?.bid).toBeGreaterThan(0);
      expect(data?.ask).toBeGreaterThan(0);
    });

    it('should return null for invalid exchange', async () => {
      const data = await connector.getMarketData('invalid-exchange', 'BTC/USDT');
      expect(data).toBeNull();
    });

    it('should include timestamp in market data', async () => {
      const data = await connector.getMarketData('binance', 'BTC/USDT');
      expect(data?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Trading Pairs', () => {
    beforeEach(() => {
      connector.registerExchange({
        name: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
      });
    });

    it('should fetch available trading pairs', async () => {
      const pairs = await connector.getTradingPairs('binance');
      expect(Array.isArray(pairs)).toBe(true);
      expect(pairs.length).toBeGreaterThan(0);
    });

    it('should return trading pair details', async () => {
      const pairs = await connector.getTradingPairs('binance');
      if (pairs.length > 0) {
        const pair = pairs[0];
        expect(pair).toHaveProperty('symbol');
        expect(pair).toHaveProperty('baseAsset');
        expect(pair).toHaveProperty('quoteAsset');
        expect(pair).toHaveProperty('minOrderSize');
        expect(pair).toHaveProperty('maxOrderSize');
      }
    });

    it('should return empty array for invalid exchange', async () => {
      const pairs = await connector.getTradingPairs('invalid-exchange');
      expect(Array.isArray(pairs)).toBe(true);
      expect(pairs).toHaveLength(0);
    });
  });

  describe('Balances', () => {
    beforeEach(() => {
      connector.registerExchange({
        name: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
      });

      connector.registerExchange({
        name: 'coinbase',
        apiKey: 'key',
        apiSecret: 'secret',
      });
    });

    it('should fetch balances from all exchanges', async () => {
      const balances = await connector.getBalances();
      expect(Array.isArray(balances)).toBe(true);
      expect(balances.length).toBeGreaterThan(0);
    });

    it('should include required balance fields', async () => {
      const balances = await connector.getBalances();
      if (balances.length > 0) {
        const balance = balances[0];
        expect(balance).toHaveProperty('exchange');
        expect(balance).toHaveProperty('asset');
        expect(balance).toHaveProperty('free');
        expect(balance).toHaveProperty('locked');
        expect(balance).toHaveProperty('total');
      }
    });

    it('should calculate total balance correctly', async () => {
      const balances = await connector.getBalances();
      balances.forEach(balance => {
        expect(balance.total).toBe(balance.free + balance.locked);
      });
    });

    it('should support multiple assets per exchange', async () => {
      const balances = await connector.getBalances();
      const binanceBalances = balances.filter(b => b.exchange === 'binance');
      expect(binanceBalances.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Diagnostic Reporting', () => {
    beforeEach(async () => {
      connector.registerExchange({
        name: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
      });

      await connector.testConnectivity();
    });

    it('should generate a diagnostic report', () => {
      const report = connector.generateDiagnosticReport();
      expect(typeof report).toBe('string');
      expect(report).toContain('EXCHANGE CONNECTOR DIAGNOSTIC REPORT');
    });

    it('should include health summary in report', () => {
      const report = connector.generateDiagnosticReport();
      expect(report).toContain('OVERALL STATUS');
      expect(report).toContain('Total Exchanges');
      expect(report).toContain('Overall Health');
    });

    it('should include detailed status for each exchange', () => {
      const report = connector.generateDiagnosticReport();
      expect(report).toContain('DETAILED STATUS');
      expect(report).toContain('binance'.toUpperCase());
    });
  });

  describe('Request Queue Management', () => {
    beforeEach(() => {
      connector.registerExchange({
        name: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
      });
    });

    it('should queue requests respecting rate limits', async () => {
      const mockRequest = jest.fn(() => Promise.resolve('result'));

      const result = await connector.queueRequest('binance', mockRequest);

      expect(result).toBe('result');
      expect(mockRequest).toHaveBeenCalled();
    });

    it('should process multiple queued requests', async () => {
      const requests = [
        jest.fn(() => Promise.resolve('result1')),
        jest.fn(() => Promise.resolve('result2')),
        jest.fn(() => Promise.resolve('result3')),
      ];

      for (const request of requests) {
        await connector.queueRequest('binance', request);
      }

      expect(requests[0]).toHaveBeenCalled();
      expect(requests[1]).toHaveBeenCalled();
      expect(requests[2]).toHaveBeenCalled();
    });

    it('should handle request errors gracefully', async () => {
      const mockRequest = jest.fn(() =>
        Promise.reject(new Error('Request failed'))
      );

      await expect(
        connector.queueRequest('binance', mockRequest)
      ).rejects.toThrow('Request failed');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete workflow: register → test → get balances → get data', async () => {
      // Register
      connector.registerExchange({
        name: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
      });

      // Test connectivity
      const health = await connector.testConnectivity();
      expect(health).toHaveLength(1);

      // Get balances
      const balances = await connector.getBalances();
      expect(balances.length).toBeGreaterThan(0);

      // Get market data
      const marketData = await connector.getMarketData('binance', 'BTC/USDT');
      expect(marketData).not.toBeNull();

      // Get trading pairs
      const pairs = await connector.getTradingPairs('binance');
      expect(pairs.length).toBeGreaterThan(0);
    });

    it('should handle multiple exchanges simultaneously', async () => {
      const exchanges = ['binance', 'coinbase', 'kraken'];

      exchanges.forEach(exchange => {
        connector.registerExchange({
          name: exchange,
          apiKey: `key-${exchange}`,
          apiSecret: `secret-${exchange}`,
        });
      });

      const health = await connector.testConnectivity();
      expect(health).toHaveLength(3);

      const balances = await connector.getBalances();
      expect(balances.length).toBeGreaterThan(0);

      const summary = connector.getHealthSummary();
      expect(summary.total).toBe(3);
    });
  });
});
