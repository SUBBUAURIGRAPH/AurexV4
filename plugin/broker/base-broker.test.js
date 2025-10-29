/**
 * Base Broker Tests
 * @version 1.0.0
 */

const BaseBroker = require('./base-broker');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

describe('BaseBroker', () => {
  test('Should not instantiate abstract BaseBroker', () => {
    expect(() => {
      new BaseBroker({
        name: 'TestBroker',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        logger: mockLogger
      });
    }).toThrow('BaseBroker is abstract and cannot be instantiated directly');
  });

  describe('validateOrder', () => {
    class TestBroker extends BaseBroker {
      validateConfig() {}
      async connect() { return true; }
      async getAccount() { return {}; }
      async getPositions() { return []; }
      async getPosition() { return null; }
      async placeOrder() { return {}; }
      async getOrder() { return {}; }
      async getOrders() { return []; }
      async cancelOrder() { return {}; }
      async closePosition() { return {}; }
    }

    let broker;

    beforeEach(() => {
      broker = new TestBroker({
        name: 'TestBroker',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        logger: mockLogger
      });
    });

    test('Should validate market order', () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: 100,
        side: 'buy',
        type: 'market'
      };

      const validation = broker.validateOrder(orderRequest);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
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

    test('Should reject limit order without limit price', () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: 50,
        side: 'sell',
        type: 'limit'
      };

      const validation = broker.validateOrder(orderRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Limit price required for limit orders');
    });

    test('Should validate stop order with stop price', () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: 100,
        side: 'buy',
        type: 'stop',
        stop_price: 145.00
      };

      const validation = broker.validateOrder(orderRequest);
      expect(validation.valid).toBe(true);
    });

    test('Should reject stop order without stop price', () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: 100,
        side: 'buy',
        type: 'stop'
      };

      const validation = broker.validateOrder(orderRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Stop price required for stop orders');
    });

    test('Should validate stop-limit order with both prices', () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: 75,
        side: 'sell',
        type: 'stop-limit',
        stop_price: 145.00,
        limit_price: 144.50
      };

      const validation = broker.validateOrder(orderRequest);
      expect(validation.valid).toBe(true);
    });

    test('Should reject stop-limit order without both prices', () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: 75,
        side: 'sell',
        type: 'stop-limit',
        stop_price: 145.00
      };

      const validation = broker.validateOrder(orderRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Both stop and limit prices required for stop-limit orders');
    });

    test('Should reject missing symbol', () => {
      const orderRequest = {
        quantity: 100,
        side: 'buy',
        type: 'market'
      };

      const validation = broker.validateOrder(orderRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Symbol is required');
    });

    test('Should reject invalid quantity', () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: 0,
        side: 'buy',
        type: 'market'
      };

      const validation = broker.validateOrder(orderRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Quantity must be positive');
    });

    test('Should reject invalid side', () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: 100,
        side: 'short',
        type: 'market'
      };

      const validation = broker.validateOrder(orderRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Side must be buy or sell');
    });

    test('Should reject invalid order type', () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: 100,
        side: 'buy',
        type: 'iceberg'
      };

      const validation = broker.validateOrder(orderRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid order type');
    });
  });

  describe('calculatePnL', () => {
    class TestBroker extends BaseBroker {
      validateConfig() {}
      async connect() { return true; }
      async getAccount() { return {}; }
      async getPositions() { return []; }
      async getPosition() { return null; }
      async placeOrder() { return {}; }
      async getOrder() { return {}; }
      async getOrders() { return []; }
      async cancelOrder() { return {}; }
      async closePosition() { return {}; }
    }

    let broker;

    beforeEach(() => {
      broker = new TestBroker({
        name: 'TestBroker',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        logger: mockLogger
      });

      // Add test position
      broker.positions.set('AAPL', {
        symbol: 'AAPL',
        quantity: 100,
        avg_fill_price: 150.00,
        cost_basis: 15000.00
      });
    });

    test('Should calculate P&L for profitable position', () => {
      const pnl = broker.calculatePnL('AAPL', 160.00);
      expect(pnl.symbol).toBe('AAPL');
      expect(pnl.quantity).toBe(100);
      expect(parseFloat(pnl.unrealizedPnL)).toBe(1000.00);
      expect(parseFloat(pnl.marketValue)).toBe(16000.00);
    });

    test('Should calculate P&L for losing position', () => {
      const pnl = broker.calculatePnL('AAPL', 140.00);
      expect(pnl.unrealizedPnL).toBe('-1000.00');
      expect(parseFloat(pnl.unrealizedPnLPercent)).toBeCloseTo(-6.67, 1);
    });

    test('Should return null for non-existent position', () => {
      const pnl = broker.calculatePnL('GOOGL', 150.00);
      expect(pnl).toBeNull();
    });

    test('Should include all P&L details', () => {
      const pnl = broker.calculatePnL('AAPL', 155.00);
      expect(pnl).toHaveProperty('symbol');
      expect(pnl).toHaveProperty('quantity');
      expect(pnl).toHaveProperty('avgCost');
      expect(pnl).toHaveProperty('currentPrice');
      expect(pnl).toHaveProperty('costBasis');
      expect(pnl).toHaveProperty('marketValue');
      expect(pnl).toHaveProperty('unrealizedPnL');
      expect(pnl).toHaveProperty('unrealizedPnLPercent');
      expect(pnl).toHaveProperty('timestamp');
    });
  });

  describe('getStatus', () => {
    class TestBroker extends BaseBroker {
      validateConfig() {}
      async connect() { return true; }
      async getAccount() { return {}; }
      async getPositions() { return []; }
      async getPosition() { return null; }
      async placeOrder() { return {}; }
      async getOrder() { return {}; }
      async getOrders() { return []; }
      async cancelOrder() { return {}; }
      async closePosition() { return {}; }
    }

    test('Should return disconnected status when no account', () => {
      const broker = new TestBroker({
        name: 'TestBroker',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        logger: mockLogger
      });

      const status = broker.getStatus();
      expect(status.connected).toBe(false);
      expect(status.account).toBeNull();
    });

    test('Should return connected status with account info', () => {
      const broker = new TestBroker({
        name: 'TestBroker',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        logger: mockLogger
      });

      broker.account = {
        id: 'acc-123',
        equity: 100000,
        cash: 50000,
        buying_power: 75000
      };

      const status = broker.getStatus();
      expect(status.connected).toBe(true);
      expect(status.account.id).toBe('acc-123');
      expect(status.account.equity).toBe(100000);
    });
  });

  describe('getCapabilities', () => {
    class TestBroker extends BaseBroker {
      validateConfig() {}
      async connect() { return true; }
      async getAccount() { return {}; }
      async getPositions() { return []; }
      async getPosition() { return null; }
      async placeOrder() { return {}; }
      async getOrder() { return {}; }
      async getOrders() { return []; }
      async cancelOrder() { return {}; }
      async closePosition() { return {}; }
    }

    test('Should return capabilities', () => {
      const broker = new TestBroker({
        name: 'TestBroker',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        logger: mockLogger
      });

      const capabilities = broker.getCapabilities();
      expect(capabilities.name).toBe('TestBroker');
      expect(capabilities.marketOrders).toBe(true);
      expect(capabilities.limitOrders).toBe(true);
      expect(capabilities.stopOrders).toBe(true);
    });
  });
});
