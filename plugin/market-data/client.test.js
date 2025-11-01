/**
 * Market Data Client Tests
 * @version 1.0.0
 */

const MarketDataClient = require('./client');

// Mock HTTPS
jest.mock('https');
const https = require('https');

describe('MarketDataClient', () => {
  let client;
  let mockResponse;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock response
    mockResponse = {
      on: jest.fn(),
      once: jest.fn()
    };

    // Setup HTTPS mock
    https.get = jest.fn((url, callback) => {
      callback(mockResponse);
      return {
        on: jest.fn()
      };
    });
  });

  describe('Initialization', () => {
    test('should initialize with default config', () => {
      client = new MarketDataClient({
        apiKey: 'test-key'
      });

      expect(client.provider).toBe('alpha-vantage');
      expect(client.apiKey).toBe('test-key');
      expect(client.cacheTTL).toBe(60);
    });

    test('should initialize with IEX Cloud provider', () => {
      client = new MarketDataClient({
        provider: 'iex-cloud',
        apiKey: 'test-key'
      });

      expect(client.provider).toBe('iex-cloud');
    });

    test('should reject unknown provider', () => {
      expect(() => {
        new MarketDataClient({
          provider: 'unknown',
          apiKey: 'test-key'
        });
      }).toThrow('Unknown provider');
    });
  });

  describe('Quote Fetching', () => {
    beforeEach(() => {
      client = new MarketDataClient({
        provider: 'alpha-vantage',
        apiKey: 'test-key'
      });
    });

    test('should fetch quote from Alpha Vantage', async () => {
      const mockData = {
        'Global Quote': {
          '01. symbol': 'AAPL',
          '02. open': '150.00',
          '03. high': '152.50',
          '04. low': '149.50',
          '05. price': '151.30',
          '06. volume': '50000000',
          '09. change': '1.30',
          '10. change percent': '0.87%'
        }
      };

      mockResponse.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback(JSON.stringify(mockData));
        } else if (event === 'end') {
          callback();
        }
      });

      const quote = await client.getQuote('AAPL', false);

      expect(quote.symbol).toBe('AAPL');
      expect(quote.price).toBe(151.30);
      expect(quote.high).toBe(152.50);
    });

    test('should cache quote data', async () => {
      const mockData = {
        'Global Quote': {
          '01. symbol': 'AAPL',
          '05. price': '150.00',
          '09. change': '1.00',
          '10. change percent': '0.67%'
        }
      };

      mockResponse.on.mockImplementation((event, callback) => {
        if (event === 'data') callback(JSON.stringify(mockData));
        else if (event === 'end') callback();
      });

      // First call - fetches from API
      await client.getQuote('AAPL', false);

      // Second call - should use cache
      const quote = await client.getQuote('AAPL', true);
      expect(https.get).toHaveBeenCalledTimes(1);
    });

    test('should return cached quote when available', async () => {
      const quote1 = {
        symbol: 'AAPL',
        price: 150.00,
        timestamp: new Date(),
        source: 'alpha-vantage'
      };

      client.setCache('quote_AAPL', quote1);

      const quote2 = await client.getQuote('AAPL', true);
      expect(quote2).toEqual(quote1);
    });

    test('should handle API errors', async () => {
      mockResponse.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback(JSON.stringify({
            'Error Message': 'Invalid API key'
          }));
        } else if (event === 'end') callback();
      });

      await expect(
        client.getQuote('AAPL', false)
      ).rejects.toThrow('Invalid API key');
    });
  });

  describe('Multiple Quotes', () => {
    beforeEach(() => {
      client = new MarketDataClient({
        provider: 'alpha-vantage',
        apiKey: 'test-key'
      });

      const mockData = {
        'Global Quote': {
          '01. symbol': 'AAPL',
          '05. price': '150.00',
          '09. change': '1.00',
          '10. change percent': '0.67%'
        }
      };

      mockResponse.on.mockImplementation((event, callback) => {
        if (event === 'data') callback(JSON.stringify(mockData));
        else if (event === 'end') callback();
      });
    });

    test('should fetch multiple quotes', async () => {
      const quotes = await client.getQuotes(['AAPL', 'MSFT']);

      expect(Object.keys(quotes)).toHaveLength(2);
      expect(quotes.AAPL).toBeDefined();
    });
  });

  describe('Price History', () => {
    beforeEach(() => {
      client = new MarketDataClient({
        provider: 'alpha-vantage',
        apiKey: 'test-key'
      });
    });

    test('should record price history', () => {
      const quote = {
        symbol: 'AAPL',
        price: 150.00,
        change: 1.00,
        changePercent: 0.67,
        timestamp: new Date()
      };

      client.recordPriceHistory('AAPL', quote);

      const history = client.getPriceHistory('AAPL');
      expect(history).toHaveLength(1);
      expect(history[0].price).toBe(150.00);
    });

    test('should limit price history to 1000 entries', () => {
      for (let i = 0; i < 1100; i++) {
        client.recordPriceHistory('AAPL', {
          price: 150 + i,
          change: i,
          changePercent: 0.01 * i,
          timestamp: new Date(Date.now() + i * 1000)
        });
      }

      const history = client.getPriceHistory('AAPL', 1000);
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    test('should return price history in reverse order', () => {
      const dates = [
        new Date('2025-01-01'),
        new Date('2025-01-02'),
        new Date('2025-01-03')
      ];

      dates.forEach((date, i) => {
        client.recordPriceHistory('AAPL', {
          price: 150 + i,
          timestamp: date
        });
      });

      const history = client.getPriceHistory('AAPL');
      expect(history[0].timestamp).toEqual(dates[2]);
      expect(history[2].timestamp).toEqual(dates[0]);
    });
  });

  describe('Caching', () => {
    beforeEach(() => {
      client = new MarketDataClient({
        provider: 'alpha-vantage',
        apiKey: 'test-key',
        cacheTTL: 1  // 1 second
      });
    });

    test('should validate cache', () => {
      client.setCache('test-key', { data: 'test' });
      expect(client.isCacheValid('test-key')).toBe(true);
    });

    test('should expire cache after TTL', async () => {
      client.setCache('test-key', { data: 'test' });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(client.isCacheValid('test-key')).toBe(false);
    });

    test('should clear all cache', () => {
      client.setCache('key1', { data: 'data1' });
      client.setCache('key2', { data: 'data2' });

      expect(client.cache.size).toBe(2);

      client.clearCache();
      expect(client.cache.size).toBe(0);
    });

    test('should return cache statistics', () => {
      client.setCache('key1', { data: 'data1' });

      const stats = client.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.ttl).toBe(1);
      expect(stats.provider).toBe('alpha-vantage');
    });
  });

  describe('Data Normalization', () => {
    beforeEach(() => {
      client = new MarketDataClient({
        provider: 'alpha-vantage',
        apiKey: 'test-key'
      });
    });

    test('should normalize Alpha Vantage quote', () => {
      const avData = {
        'Global Quote': {
          '01. symbol': 'AAPL',
          '02. open': '150.00',
          '03. high': '152.50',
          '04. low': '149.50',
          '05. price': '151.30',
          '06. volume': '50000000',
          '09. change': '1.30',
          '10. change percent': '0.87%'
        }
      };

      const normalized = client.normalizeQuote(avData, 'alpha-vantage');

      expect(normalized.symbol).toBe('AAPL');
      expect(normalized.price).toBe(151.30);
      expect(normalized.source).toBe('alpha-vantage');
    });

    test('should normalize IEX Cloud quote', () => {
      const iexData = {
        symbol: 'AAPL',
        latestPrice: 151.30,
        open: 150.00,
        high: 152.50,
        low: 149.50,
        change: 1.30,
        changePercent: 0.0087,
        volume: 50000000
      };

      const normalized = client.normalizeQuote(iexData, 'iex-cloud');

      expect(normalized.symbol).toBe('AAPL');
      expect(normalized.price).toBe(151.30);
      expect(normalized.source).toBe('iex-cloud');
    });
  });

  describe('Search', () => {
    beforeEach(() => {
      client = new MarketDataClient({
        provider: 'alpha-vantage',
        apiKey: 'test-key'
      });
    });

    test('should search for symbols', async () => {
      const mockData = {
        bestMatches: [
          {
            '1. symbol': 'AAPL',
            '2. name': 'Apple Inc.'
          }
        ]
      };

      mockResponse.on.mockImplementation((event, callback) => {
        if (event === 'data') callback(JSON.stringify(mockData));
        else if (event === 'end') callback();
      });

      const results = await client.search('Apple');
      expect(results).toHaveLength(1);
    });
  });
});
