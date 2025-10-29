/**
 * Alpaca Broker Tests
 * @version 1.0.0
 */

const AlpacaBroker = require('./alpaca-broker');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

describe('AlpacaBroker', () => {
  describe('Initialization', () => {
    test('Should initialize with paper trading enabled by default', () => {
      const broker = new AlpacaBroker({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        logger: mockLogger
      });

      expect(broker.paperTrading).toBe(true);
      expect(broker.baseURL).toBe('paper-api.alpaca.markets');
    });

    test('Should initialize with live trading when disabled', () => {
      const broker = new AlpacaBroker({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        paperTrading: false,
        logger: mockLogger
      });

      expect(broker.paperTrading).toBe(false);
      expect(broker.baseURL).toBe('api.alpaca.markets');
    });

    test('Should throw error without API key', () => {
      expect(() => {
        new AlpacaBroker({
          apiSecret: 'test-secret',
          logger: mockLogger
        });
      }).toThrow('Alpaca API key and secret are required');
    });

    test('Should throw error without API secret', () => {
      expect(() => {
        new AlpacaBroker({
          apiKey: 'test-key',
          logger: mockLogger
        });
      }).toThrow('Alpaca API key and secret are required');
    });
  });

  describe('Configuration Validation', () => {
    test('Should validate configuration successfully', () => {
      const broker = new AlpacaBroker({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        logger: mockLogger
      });

      expect(broker.apiKey).toBe('test-key');
      expect(broker.apiSecret).toBe('test-secret');
    });
  });

  describe('Capabilities', () => {
    test('Should return Alpaca capabilities', () => {
      const broker = new AlpacaBroker({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        logger: mockLogger
      });

      const capabilities = broker.getCapabilities();
      expect(capabilities.name).toBe('Alpaca');
      expect(capabilities.marketOrders).toBe(true);
      expect(capabilities.limitOrders).toBe(true);
      expect(capabilities.stopOrders).toBe(true);
      expect(capabilities.stopLimitOrders).toBe(true);
      expect(capabilities.extendedHours).toBe(true);
      expect(capabilities.realTimeQuotes).toBe(true);
      expect(capabilities.historicalData).toBe(true);
      expect(capabilities.marginTrading).toBe(true);
      expect(capabilities.shortSelling).toBe(true);
      expect(capabilities.fractionalShares).toBe(true);
      expect(capabilities.multiLegOrders).toBe(false);
    });

    test('Should reflect paper trading status in capabilities', () => {
      const broker = new AlpacaBroker({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        paperTrading: true,
        logger: mockLogger
      });

      const capabilities = broker.getCapabilities();
      expect(capabilities.paperTrading).toBe(true);
    });
  });

  describe('Order Validation', () => {
    let broker;

    beforeEach(() => {
      broker = new AlpacaBroker({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        logger: mockLogger
      });
    });

    test('Should validate market order', () => {
      const orderRequest = {
        symbol: 'aapl',
        quantity: 100,
        side: 'buy',
        type: 'market'
      };

      const validation = broker.validateOrder(orderRequest);
      expect(validation.valid).toBe(true);
    });

    test('Should validate limit order with limit price', () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: 50,
        side: 'sell',
        type: 'limit',
        limit_price: 150.25
      };

      const validation = broker.validateOrder(orderRequest);
      expect(validation.valid).toBe(true);
    });

    test('Should reject invalid order', () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: -10,
        side: 'buy',
        type: 'market'
      };

      const validation = broker.validateOrder(orderRequest);
      expect(validation.valid).toBe(false);
    });
  });

  describe('Position Management', () => {
    let broker;

    beforeEach(() => {
      broker = new AlpacaBroker({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        logger: mockLogger
      });
    });

    test('Should initialize with empty positions', () => {
      expect(broker.positions.size).toBe(0);
    });

    test('Should initialize with empty orders', () => {
      expect(broker.orders.size).toBe(0);
    });

    test('Should store position data', () => {
      const position = {
        symbol: 'AAPL',
        qty: 100,
        avg_fill_price: 150.00,
        market_value: 15500,
        cost_basis: 15000,
        current_price: 155.00,
        side: 'long'
      };

      broker.positions.set('AAPL', position);
      expect(broker.positions.get('AAPL').symbol).toBe('AAPL');
    });
  });

  describe('Status', () => {
    let broker;

    beforeEach(() => {
      broker = new AlpacaBroker({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        logger: mockLogger
      });
    });

    test('Should return disconnected status', () => {
      const status = broker.getStatus();
      expect(status.broker).toBe('Alpaca');
      expect(status.connected).toBe(false);
      expect(status.account).toBeNull();
      expect(status.positions).toBe(0);
      expect(status.orders).toBe(0);
    });

    test('Should return connected status with account', () => {
      broker.account = {
        id: 'acc-123',
        equity: 100000,
        cash: 50000,
        buying_power: 75000
      };

      broker.positions.set('AAPL', {
        symbol: 'AAPL',
        quantity: 100
      });

      broker.orders.set('order-123', {
        id: 'order-123',
        symbol: 'AAPL',
        status: 'submitted'
      });

      const status = broker.getStatus();
      expect(status.connected).toBe(true);
      expect(status.account.equity).toBe(100000);
      expect(status.positions).toBe(1);
      expect(status.orders).toBe(1);
    });
  });
});
