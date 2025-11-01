/**
 * Advanced Order Manager and Engine Tests
 * Comprehensive test suite for limit orders, stop orders, and stop-limit orders
 *
 * Test Coverage:
 * - Order creation and validation
 * - Order triggering conditions
 * - Order execution and fills
 * - Order state management
 * - Position tracking with advanced orders
 * - Edge cases and error handling
 */

const assert = require('assert');
const {
  AdvancedOrderManager,
  OrderType,
  OrderStatus
} = require('./advanced-order-manager');
const { AdvancedBacktestingEngine } = require('./advanced-backtesting-engine');

// Mock logger
const mockLogger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {}
};

// Helper: Create mock OHLCV bar
const createBar = (date, open, high, low, close, volume = 1000000) => ({
  date,
  open,
  high,
  low,
  close,
  volume
});

// ============================================================================
// ADVANCED ORDER MANAGER TESTS
// ============================================================================

describe('AdvancedOrderManager', () => {
  let orderManager;

  beforeEach(() => {
    orderManager = new AdvancedOrderManager(mockLogger);
  });

  // ========================================================================
  // ORDER CREATION TESTS
  // ========================================================================

  describe('Order Creation', () => {
    test('should create market order', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.MARKET
      });

      assert.strictEqual(order.symbol, 'AAPL');
      assert.strictEqual(order.side, 'BUY');
      assert.strictEqual(order.quantity, 100);
      assert.strictEqual(order.type, OrderType.MARKET);
      assert.strictEqual(order.status, OrderStatus.PENDING);
      assert.strictEqual(order.filledQuantity, 0);
    });

    test('should create limit buy order', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.LIMIT,
        limitPrice: 150.00
      });

      assert.strictEqual(order.type, OrderType.LIMIT);
      assert.strictEqual(order.limitPrice, 150.00);
    });

    test('should create limit sell order', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 100,
        type: OrderType.LIMIT,
        limitPrice: 160.00
      });

      assert.strictEqual(order.type, OrderType.LIMIT);
      assert.strictEqual(order.limitPrice, 160.00);
    });

    test('should create stop order (stop loss)', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 100,
        type: OrderType.STOP,
        stopPrice: 140.00
      });

      assert.strictEqual(order.type, OrderType.STOP);
      assert.strictEqual(order.stopPrice, 140.00);
    });

    test('should create stop-limit order', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 100,
        type: OrderType.STOP_LIMIT,
        stopPrice: 145.00,
        limitPrice: 144.00
      });

      assert.strictEqual(order.type, OrderType.STOP_LIMIT);
      assert.strictEqual(order.stopPrice, 145.00);
      assert.strictEqual(order.limitPrice, 144.00);
    });

    test('should reject limit order without price', () => {
      assert.throws(() => {
        orderManager.createOrder({
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 100,
          type: OrderType.LIMIT
        });
      });
    });

    test('should reject stop order without price', () => {
      assert.throws(() => {
        orderManager.createOrder({
          symbol: 'AAPL',
          side: 'SELL',
          quantity: 100,
          type: OrderType.STOP
        });
      });
    });

    test('should reject invalid order side', () => {
      assert.throws(() => {
        orderManager.createOrder({
          symbol: 'AAPL',
          side: 'INVALID',
          quantity: 100
        });
      });
    });
  });

  // ========================================================================
  // ORDER TRIGGERING TESTS
  // ========================================================================

  describe('Order Triggering', () => {
    test('should trigger market order immediately', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.MARKET
      });

      const bar = createBar(new Date(), 150, 152, 149, 151);
      const shouldTrigger = orderManager.shouldTriggerOrder(order, bar);

      assert.strictEqual(shouldTrigger, true);
    });

    test('should trigger limit buy order when price touched', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.LIMIT,
        limitPrice: 150.00
      });

      // Test case 1: Low touches limit price
      const bar1 = createBar(new Date(), 155, 156, 149, 152);  // Low: 149 < 150
      assert.strictEqual(orderManager.shouldTriggerOrder(order, bar1), true);

      // Test case 2: Low above limit price
      const bar2 = createBar(new Date(), 155, 156, 150.50, 152);  // Low: 150.50 > 150
      assert.strictEqual(orderManager.shouldTriggerOrder(order, bar2), false);
    });

    test('should trigger limit sell order when price touched', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 100,
        type: OrderType.LIMIT,
        limitPrice: 155.00
      });

      // Test case 1: High touches limit price
      const bar1 = createBar(new Date(), 150, 156, 149, 152);  // High: 156 > 155
      assert.strictEqual(orderManager.shouldTriggerOrder(order, bar1), true);

      // Test case 2: High below limit price
      const bar2 = createBar(new Date(), 150, 154, 149, 152);  // High: 154 < 155
      assert.strictEqual(orderManager.shouldTriggerOrder(order, bar2), false);
    });

    test('should trigger stop buy order when price touched', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.STOP,
        stopPrice: 155.00
      });

      // Test case 1: High touches stop price
      const bar1 = createBar(new Date(), 150, 156, 149, 152);  // High: 156 > 155
      assert.strictEqual(orderManager.shouldTriggerOrder(order, bar1), true);

      // Test case 2: High below stop price
      const bar2 = createBar(new Date(), 150, 154, 149, 152);  // High: 154 < 155
      assert.strictEqual(orderManager.shouldTriggerOrder(order, bar2), false);
    });

    test('should trigger stop sell order (stop loss) when price touched', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 100,
        type: OrderType.STOP,
        stopPrice: 145.00
      });

      // Test case 1: Low touches stop price
      const bar1 = createBar(new Date(), 150, 152, 144, 151);  // Low: 144 < 145
      assert.strictEqual(orderManager.shouldTriggerOrder(order, bar1), true);

      // Test case 2: Low above stop price
      const bar2 = createBar(new Date(), 150, 152, 145.50, 151);  // Low: 145.50 > 145
      assert.strictEqual(orderManager.shouldTriggerOrder(order, bar2), false);
    });

    test('should not trigger order twice', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.LIMIT,
        limitPrice: 150.00
      });

      const bar = createBar(new Date(), 155, 156, 149, 152);

      // First trigger
      orderManager.executeOrder(order, bar, 100000);
      assert.strictEqual(order.status !== OrderStatus.PENDING, true);

      // Should not trigger again
      const shouldTrigger = orderManager.shouldTriggerOrder(order, bar);
      assert.strictEqual(shouldTrigger, false);
    });
  });

  // ========================================================================
  // ORDER EXECUTION TESTS
  // ========================================================================

  describe('Order Execution', () => {
    test('should execute market order at bar close', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.MARKET
      });

      const bar = createBar(new Date(), 150, 152, 149, 151);
      const result = orderManager.executeOrder(order, bar, 100000);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.fills.length, 1);
      assert.strictEqual(result.fills[0].quantity, 100);
      assert.strictEqual(result.executionPrice, 151);  // Close price
    });

    test('should execute limit buy order at limit price', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.LIMIT,
        limitPrice: 150.00
      });

      // Bar low touches 149, so order should execute at 150 (limit price)
      const bar = createBar(new Date(), 155, 156, 149, 151);
      const result = orderManager.executeOrder(order, bar, 100000);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.executionPrice, 150.00);  // Limit price
    });

    test('should execute limit sell order at limit price', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 100,
        type: OrderType.LIMIT,
        limitPrice: 155.00
      });

      // Bar high touches 156, so order should execute at 155 (limit price)
      const bar = createBar(new Date(), 150, 156, 149, 152);
      const result = orderManager.executeOrder(order, bar, 100000);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.executionPrice, 155.00);  // Limit price
    });

    test('should reject order with insufficient buying power', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.MARKET
      });

      // Price: 151, Quantity: 100 = $15,100 total (more than available)
      const bar = createBar(new Date(), 150, 152, 149, 151);
      const result = orderManager.executeOrder(order, bar, 10000);  // Only $10k available

      assert.strictEqual(result.success, false);
      assert.strictEqual(order.status, OrderStatus.REJECTED);
    });

    test('should create fill record on execution', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.MARKET
      });

      const bar = createBar(new Date(), 150, 152, 149, 151);
      orderManager.executeOrder(order, bar, 100000);

      assert.strictEqual(order.fills.length, 1);
      assert.strictEqual(order.filledQuantity, 100);
      assert.strictEqual(order.remainingQuantity, 0);
      assert.strictEqual(order.status, OrderStatus.FILLED);
    });

    test('should update average fill price', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 200,
        type: OrderType.MARKET
      });

      // First fill: 100 shares at $150
      const bar1 = createBar(new Date('2024-01-01'), 150, 152, 149, 150);
      const result1 = orderManager.executeOrder(order, bar1, 100000);
      assert.strictEqual(result1.fills[0].quantity, 100);

      // Average should be $150
      assert.strictEqual(order.averageFillPrice, 150);

      // Second fill: 100 shares at $160
      const bar2 = createBar(new Date('2024-01-02'), 160, 162, 159, 160);
      const result2 = orderManager.executeOrder(order, bar2, 100000);
      assert.strictEqual(result2.fills[0].quantity, 100);

      // Average should be $155
      assert.strictEqual(order.averageFillPrice, 155);
      assert.strictEqual(order.status, OrderStatus.FILLED);
    });
  });

  // ========================================================================
  // ORDER CANCELLATION TESTS
  // ========================================================================

  describe('Order Cancellation', () => {
    test('should cancel pending order', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.LIMIT,
        limitPrice: 150.00
      });

      const success = orderManager.cancelOrder(order.id);

      assert.strictEqual(success, true);
      assert.strictEqual(order.status, OrderStatus.CANCELLED);
      assert.strictEqual(orderManager.pendingOrders.includes(order), false);
    });

    test('should not cancel filled order', () => {
      const order = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.MARKET
      });

      const bar = createBar(new Date(), 150, 152, 149, 151);
      orderManager.executeOrder(order, bar, 100000);

      const success = orderManager.cancelOrder(order.id);

      assert.strictEqual(success, false);
      assert.strictEqual(order.status, OrderStatus.FILLED);
    });

    test('should not cancel non-existent order', () => {
      const success = orderManager.cancelOrder('non-existent-id');
      assert.strictEqual(success, false);
    });
  });

  // ========================================================================
  // ORDER STATISTICS TESTS
  // ========================================================================

  describe('Order Statistics', () => {
    test('should calculate order statistics', () => {
      // Create mixed orders
      const marketOrder = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.MARKET
      });

      const limitOrder = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 50,
        type: OrderType.LIMIT,
        limitPrice: 160.00
      });

      const stopOrder = orderManager.createOrder({
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 100,
        type: OrderType.STOP,
        stopPrice: 145.00
      });

      // Execute market order
      const bar = createBar(new Date(), 150, 152, 149, 151);
      orderManager.executeOrder(marketOrder, bar, 100000);

      const stats = orderManager.getOrderStats();

      assert.strictEqual(stats.totalOrders, 3);
      assert.strictEqual(stats.filledOrders, 1);
      assert.strictEqual(stats.pendingOrders, 2);
      assert.strictEqual(stats.ordersByType.market, 1);
      assert.strictEqual(stats.ordersByType.limit, 1);
      assert.strictEqual(stats.ordersByType.stop, 1);
    });
  });
});

// ============================================================================
// ADVANCED BACKTESTING ENGINE TESTS
// ============================================================================

describe('AdvancedBacktestingEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new AdvancedBacktestingEngine({
      symbol: 'AAPL',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      initialCapital: 100000,
      logger: mockLogger
    });
  });

  describe('Order Submission', () => {
    test('should submit market order', () => {
      const order = engine.submitOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.MARKET
      });

      assert.strictEqual(order.type, OrderType.MARKET);
      assert.strictEqual(order.status, OrderStatus.PENDING);
    });

    test('should submit limit order', () => {
      const order = engine.submitOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.LIMIT,
        limitPrice: 150.00
      });

      assert.strictEqual(order.type, OrderType.LIMIT);
      assert.strictEqual(order.limitPrice, 150.00);
    });

    test('should submit stop order', () => {
      const order = engine.submitOrder({
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 100,
        type: OrderType.STOP,
        stopPrice: 145.00
      });

      assert.strictEqual(order.type, OrderType.STOP);
      assert.strictEqual(order.stopPrice, 145.00);
    });

    test('should cancel order', () => {
      const order = engine.submitOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.LIMIT,
        limitPrice: 150.00
      });

      const success = engine.cancelOrder(order.id);

      assert.strictEqual(success, true);
      assert.strictEqual(order.status, OrderStatus.CANCELLED);
    });
  });

  describe('Order Processing on Bar', () => {
    test('should process orders on bar', async () => {
      engine.state.currentDate = new Date('2024-01-01');
      engine.state.currentBar = createBar(new Date('2024-01-01'), 150, 152, 149, 151);

      const order = engine.submitOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.MARKET
      });

      const results = await engine.processOrdersOnBar(engine.state.currentBar);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].success, true);
      assert.strictEqual(order.status, OrderStatus.FILLED);
    });
  });

  describe('Position Tracking', () => {
    test('should track position from order fill', async () => {
      engine.state.currentDate = new Date('2024-01-01');
      engine.state.currentBar = createBar(new Date('2024-01-01'), 150, 152, 149, 151);

      engine.submitOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.MARKET
      });

      await engine.processOrdersOnBar(engine.state.currentBar);

      const position = engine.state.positions.get('AAPL');
      assert.strictEqual(position.quantity, 100);
      assert.strictEqual(position.avgCost, 151);
    });
  });

  describe('Execution Summary', () => {
    test('should provide execution summary', async () => {
      engine.state.currentDate = new Date('2024-01-01');
      engine.state.currentBar = createBar(new Date('2024-01-01'), 150, 152, 149, 151);

      engine.submitOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.MARKET
      });

      await engine.processOrdersOnBar(engine.state.currentBar);

      const summary = engine.getExecutionSummary();

      assert.strictEqual(summary.initialCapital, 100000);
      assert.strictEqual(summary.filledOrders, 1);
      assert.strictEqual(summary.ordersByType.market, 1);
    });
  });

  describe('Engine Reset', () => {
    test('should reset engine state', async () => {
      engine.state.currentDate = new Date('2024-01-01');
      engine.state.currentBar = createBar(new Date('2024-01-01'), 150, 152, 149, 151);

      engine.submitOrder({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 100,
        type: OrderType.MARKET
      });

      await engine.processOrdersOnBar(engine.state.currentBar);

      engine.reset();

      assert.strictEqual(engine.state.positions.size, 0);
      assert.strictEqual(engine.getPendingOrders().length, 0);
      assert.strictEqual(engine.state.cash, 100000);
    });
  });
});

// ============================================================================
// EXPORT TESTS
// ============================================================================

// These tests can be run with: npm test -- advanced-orders.test.js
// Or with Jest/Mocha test runners
