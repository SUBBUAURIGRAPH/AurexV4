/**
 * Order Manager Tests
 * Tests for order lifecycle, validation, and confirmation workflow
 * @version 2.0.0
 */

const OrderManager = require('./order-manager');

// Mock broker
const mockBroker = {
  placeOrder: jest.fn(),
  getOrder: jest.fn(),
  cancelOrder: jest.fn(),
  getOrders: jest.fn()
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

describe('OrderManager', () => {
  let orderManager;

  beforeEach(() => {
    jest.clearAllMocks();

    orderManager = new OrderManager({
      broker: mockBroker,
      logger: mockLogger
    });
  });

  describe('Initialization', () => {
    test('Should initialize with empty orders', () => {
      expect(orderManager.orders.size).toBe(0);
      expect(orderManager.ordersByUser.size).toBe(0);
      expect(orderManager.executionHistory).toHaveLength(0);
    });

    test('Should use provided broker and logger', () => {
      expect(orderManager.broker).toBe(mockBroker);
      expect(orderManager.logger).toBe(mockLogger);
    });
  });

  describe('Order Validation', () => {
    test('Should validate valid order request', () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: 100,
        side: 'buy',
        type: 'market'
      };

      const validation = orderManager.validateOrderRequest(orderRequest);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('Should reject missing symbol', () => {
      const orderRequest = {
        quantity: 100,
        side: 'buy',
        type: 'market'
      };

      const validation = orderManager.validateOrderRequest(orderRequest);
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

      const validation = orderManager.validateOrderRequest(orderRequest);
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

      const validation = orderManager.validateOrderRequest(orderRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Side must be buy or sell');
    });

    test('Should reject invalid type', () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: 100,
        side: 'buy',
        type: 'iceberg'
      };

      const validation = orderManager.validateOrderRequest(orderRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid order type');
    });
  });

  describe('Order Generation', () => {
    test('Should generate unique order IDs', () => {
      const id1 = orderManager.generateOrderId();
      const id2 = orderManager.generateOrderId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^order_\d+_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^order_\d+_[a-f0-9]{16}$/);
    });
  });

  describe('Create Order', () => {
    test('Should create valid order', async () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: 100,
        side: 'buy',
        type: 'market'
      };

      mockBroker.placeOrder.mockResolvedValue({
        id: 'broker-order-123',
        symbol: 'AAPL',
        qty: 100,
        side: 'buy',
        status: 'submitted'
      });

      const order = await orderManager.createOrder(orderRequest, 'user-123');

      expect(order.orderId).toBeDefined();
      expect(order.userId).toBe('user-123');
      expect(order.symbol).toBe('AAPL');
      expect(order.quantity).toBe(100);
      expect(order.side).toBe('buy');
      expect(order.brokerOrderId).toBe('broker-order-123');
      expect(order.status).toBe('submitted');
      expect(mockBroker.placeOrder).toHaveBeenCalled();
    });

    test('Should reject invalid order', async () => {
      const orderRequest = {
        symbol: 'AAPL',
        quantity: 0,
        side: 'buy',
        type: 'market'
      };

      await expect(orderManager.createOrder(orderRequest, 'user-123')).rejects.toThrow(
        'Order validation failed'
      );
    });

    test('Should store order by user', async () => {
      const orderRequest = {
        symbol: 'GOOGL',
        quantity: 50,
        side: 'sell',
        type: 'limit',
        limit_price: 140.00
      };

      mockBroker.placeOrder.mockResolvedValue({
        id: 'broker-order-456',
        status: 'submitted'
      });

      const order = await orderManager.createOrder(orderRequest, 'user-456');

      const userOrders = orderManager.ordersByUser.get('user-456');
      expect(userOrders).toContain(order.orderId);
    });

    test('Should record execution in history', async () => {
      const orderRequest = {
        symbol: 'MSFT',
        quantity: 75,
        side: 'buy',
        type: 'market'
      };

      mockBroker.placeOrder.mockResolvedValue({
        id: 'broker-order-789',
        status: 'submitted'
      });

      await orderManager.createOrder(orderRequest, 'user-789');

      expect(orderManager.executionHistory.length).toBeGreaterThan(0);
      const lastExecution = orderManager.executionHistory[orderManager.executionHistory.length - 1];
      expect(lastExecution.action).toBe('ORDER_CREATED');
      expect(lastExecution.userId).toBe('user-789');
    });
  });

  describe('Get Order Status', () => {
    test('Should get order status from local storage', async () => {
      const mockOrder = {
        orderId: 'order-123',
        symbol: 'AAPL',
        quantity: 100,
        status: 'submitted',
        brokerOrderId: 'broker-123'
      };

      orderManager.orders.set('order-123', mockOrder);

      mockBroker.getOrder.mockResolvedValue({
        id: 'broker-123',
        status: 'submitted',
        filled_qty: 0,
        filled_avg_price: null
      });

      const order = await orderManager.getOrderStatus('order-123');
      expect(order.symbol).toBe('AAPL');
      expect(order.quantity).toBe(100);
    });

    test('Should throw error for non-existent order', async () => {
      await expect(orderManager.getOrderStatus('non-existent')).rejects.toThrow(
        'Order not found'
      );
    });

    test('Should update order from broker', async () => {
      const mockOrder = {
        orderId: 'order-456',
        symbol: 'GOOGL',
        quantity: 50,
        status: 'submitted',
        brokerOrderId: 'broker-456',
        filledQuantity: 0,
        averageFillPrice: null
      };

      orderManager.orders.set('order-456', mockOrder);

      mockBroker.getOrder.mockResolvedValue({
        id: 'broker-456',
        status: 'filled',
        filled_qty: 50,
        filled_avg_price: 140.50
      });

      const order = await orderManager.getOrderStatus('order-456');
      expect(order.status).toBe('filled');
      expect(order.filledQuantity).toBe(50);
    });
  });

  describe('Cancel Order', () => {
    test('Should cancel valid order', async () => {
      const mockOrder = {
        orderId: 'order-789',
        userId: 'user-789',
        symbol: 'MSFT',
        quantity: 75,
        status: 'submitted',
        brokerOrderId: 'broker-789'
      };

      orderManager.orders.set('order-789', mockOrder);

      mockBroker.cancelOrder.mockResolvedValue({ success: true });

      const result = await orderManager.cancelOrder('order-789', 'user-789');
      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order-789');
      expect(mockBroker.cancelOrder).toHaveBeenCalledWith('broker-789');
    });

    test('Should reject cancellation by different user', async () => {
      const mockOrder = {
        orderId: 'order-999',
        userId: 'user-999',
        symbol: 'AAPL',
        quantity: 100,
        status: 'submitted'
      };

      orderManager.orders.set('order-999', mockOrder);

      await expect(orderManager.cancelOrder('order-999', 'other-user')).rejects.toThrow(
        'Unauthorized'
      );
    });

    test('Should allow system to cancel any order', async () => {
      const mockOrder = {
        orderId: 'order-111',
        userId: 'user-111',
        symbol: 'TSLA',
        quantity: 50,
        status: 'submitted',
        brokerOrderId: 'broker-111'
      };

      orderManager.orders.set('order-111', mockOrder);

      mockBroker.cancelOrder.mockResolvedValue({ success: true });

      const result = await orderManager.cancelOrder('order-111', 'system');
      expect(result.success).toBe(true);
    });

    test('Should reject cancellation of filled order', async () => {
      const mockOrder = {
        orderId: 'order-222',
        userId: 'user-222',
        symbol: 'AMZN',
        quantity: 25,
        status: 'filled'
      };

      orderManager.orders.set('order-222', mockOrder);

      await expect(orderManager.cancelOrder('order-222', 'user-222')).rejects.toThrow(
        'Cannot cancel order with status: filled'
      );
    });
  });

  describe('Get Orders By User', () => {
    test('Should get all user orders', async () => {
      mockBroker.placeOrder.mockResolvedValue({
        id: 'broker-1',
        status: 'submitted'
      });

      const order1 = await orderManager.createOrder(
        { symbol: 'AAPL', quantity: 100, side: 'buy', type: 'market' },
        'user-123'
      );

      const order2 = await orderManager.createOrder(
        { symbol: 'GOOGL', quantity: 50, side: 'sell', type: 'market' },
        'user-123'
      );

      const userOrders = orderManager.getOrdersByUser('user-123');
      expect(userOrders.length).toBe(2);
    });

    test('Should return empty array for user with no orders', () => {
      const userOrders = orderManager.getOrdersByUser('non-existent-user');
      expect(userOrders).toEqual([]);
    });

    test('Should filter by status', async () => {
      mockBroker.placeOrder.mockResolvedValue({
        id: 'broker-1',
        status: 'submitted'
      });

      await orderManager.createOrder(
        { symbol: 'AAPL', quantity: 100, side: 'buy', type: 'market' },
        'user-456'
      );

      const filledOrders = orderManager.getOrdersByUser('user-456', { status: 'submitted' });
      expect(filledOrders.length).toBeGreaterThan(0);
      expect(filledOrders[0].status).toBe('submitted');
    });

    test('Should filter by symbol', async () => {
      mockBroker.placeOrder.mockResolvedValue({
        id: 'broker-1',
        status: 'submitted'
      });

      await orderManager.createOrder(
        { symbol: 'AAPL', quantity: 100, side: 'buy', type: 'market' },
        'user-789'
      );

      const aaplOrders = orderManager.getOrdersByUser('user-789', { symbol: 'AAPL' });
      expect(aaplOrders[0].symbol).toBe('AAPL');
    });
  });

  describe('Get Active Orders', () => {
    test('Should return only active orders', async () => {
      mockBroker.placeOrder.mockResolvedValue({
        id: 'broker-1',
        status: 'submitted'
      });

      const order = await orderManager.createOrder(
        { symbol: 'AAPL', quantity: 100, side: 'buy', type: 'market' },
        'user-999'
      );

      const activeOrders = orderManager.getActiveOrders();
      expect(activeOrders.length).toBeGreaterThan(0);
      expect(['pending_submission', 'submitted', 'pending_cancel', 'partially_filled']).toContain(
        activeOrders[0].status
      );
    });
  });

  describe('Execution History', () => {
    test('Should record execution in history', async () => {
      mockBroker.placeOrder.mockResolvedValue({
        id: 'broker-1',
        status: 'submitted'
      });

      await orderManager.createOrder(
        { symbol: 'AAPL', quantity: 100, side: 'buy', type: 'market' },
        'user-111'
      );

      const history = orderManager.getExecutionHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    test('Should filter execution history by user', async () => {
      mockBroker.placeOrder.mockResolvedValue({
        id: 'broker-1',
        status: 'submitted'
      });

      await orderManager.createOrder(
        { symbol: 'AAPL', quantity: 100, side: 'buy', type: 'market' },
        'user-222'
      );

      const userHistory = orderManager.getExecutionHistory({ userId: 'user-222' });
      expect(userHistory.length).toBeGreaterThan(0);
      expect(userHistory[0].userId).toBe('user-222');
    });

    test('Should filter execution history by action', async () => {
      mockBroker.placeOrder.mockResolvedValue({
        id: 'broker-1',
        status: 'submitted'
      });

      await orderManager.createOrder(
        { symbol: 'AAPL', quantity: 100, side: 'buy', type: 'market' },
        'user-333'
      );

      const createHistory = orderManager.getExecutionHistory({ action: 'ORDER_CREATED' });
      expect(createHistory.length).toBeGreaterThan(0);
      expect(createHistory[0].action).toBe('ORDER_CREATED');
    });

    test('Should limit execution history', () => {
      orderManager.recordExecution({ action: 'TEST_1', userId: 'user-1' });
      orderManager.recordExecution({ action: 'TEST_2', userId: 'user-2' });
      orderManager.recordExecution({ action: 'TEST_3', userId: 'user-3' });

      const limited = orderManager.getExecutionHistory({ limit: 2 });
      expect(limited.length).toBe(2);
    });
  });

  describe('Order Cost Calculation', () => {
    test('Should calculate order cost', () => {
      const mockOrder = {
        orderId: 'order-calc-1',
        quantity: 100,
        filledQuantity: 100,
        averageFillPrice: 150.00,
        commission: 10.00
      };

      orderManager.orders.set('order-calc-1', mockOrder);

      const cost = orderManager.calculateOrderCost('order-calc-1');
      expect(cost.filledQuantity).toBe(100);
      expect(parseFloat(cost.filledCost)).toBe(15000.00);
      expect(parseFloat(cost.netCost)).toBe(15010.00);
    });

    test('Should handle partial fills', () => {
      const mockOrder = {
        orderId: 'order-partial',
        quantity: 100,
        filledQuantity: 60,
        averageFillPrice: 155.00,
        commission: 5.00
      };

      orderManager.orders.set('order-partial', mockOrder);

      const cost = orderManager.calculateOrderCost('order-partial');
      expect(cost.remainingQuantity).toBe(40);
      expect(parseFloat(cost.filledCost)).toBe(9300.00);
    });

    test('Should return null for non-existent order', () => {
      const cost = orderManager.calculateOrderCost('non-existent');
      expect(cost).toBeNull();
    });
  });

  describe('Statistics', () => {
    test('Should calculate statistics', async () => {
      mockBroker.placeOrder.mockResolvedValue({
        id: 'broker-1',
        status: 'submitted'
      });

      await orderManager.createOrder(
        { symbol: 'AAPL', quantity: 100, side: 'buy', type: 'market' },
        'user-stats'
      );

      const stats = orderManager.getStatistics('user-stats');
      expect(stats.total).toBeGreaterThan(0);
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('cancelled');
      expect(stats).toHaveProperty('rejected');
    });

    test('Should calculate global statistics', async () => {
      mockBroker.placeOrder.mockResolvedValue({
        id: 'broker-1',
        status: 'submitted'
      });

      await orderManager.createOrder(
        { symbol: 'AAPL', quantity: 100, side: 'buy', type: 'market' },
        'user-global'
      );

      const stats = orderManager.getStatistics();
      expect(stats.total).toBeGreaterThan(0);
    });
  });

  describe('Order Confirmation Workflow (v2.0)', () => {
    test('Should create order with pending confirmation', async () => {
      mockBroker.getAccount = jest.fn().mockResolvedValue({
        buying_power: 50000,
        equity: 100000
      });

      const orderRequest = {
        symbol: 'AAPL',
        quantity: 10,
        side: 'buy',
        type: 'market',
        market_price: 150
      };

      const result = await orderManager.createOrder(orderRequest, 'user123');

      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();
      expect(result.confirmationToken).toBeDefined();
      expect(result.order.symbol).toBe('AAPL');
      expect(result.order.quantity).toBe(10);
      expect(result.expiresAt).toBeDefined();
    });

    test('Should confirm order and submit to broker', async () => {
      mockBroker.getAccount = jest.fn().mockResolvedValue({
        buying_power: 50000,
        equity: 100000
      });

      mockBroker.placeOrder.mockResolvedValue({
        id: 'broker_order_123',
        status: 'submitted'
      });

      const orderRequest = {
        symbol: 'AAPL',
        quantity: 10,
        side: 'buy',
        type: 'market',
        market_price: 150
      };

      const createResult = await orderManager.createOrder(orderRequest, 'user123');
      const confirmResult = await orderManager.confirmOrder(createResult.confirmationToken, 'user123');

      expect(confirmResult.success).toBe(true);
      expect(confirmResult.brokerOrderId).toBe('broker_order_123');
    });

    test('Should reject expired confirmation token', async () => {
      mockBroker.getAccount = jest.fn().mockResolvedValue({
        buying_power: 50000,
        equity: 100000
      });

      const orderRequest = {
        symbol: 'AAPL',
        quantity: 10,
        side: 'buy',
        type: 'market',
        market_price: 150
      };

      const createResult = await orderManager.createOrder(orderRequest, 'user123');

      // Expire the token
      const confirmation = orderManager.pendingConfirmations.get(createResult.confirmationToken);
      confirmation.expiresAt = new Date(Date.now() - 1000);

      await expect(orderManager.confirmOrder(createResult.confirmationToken, 'user123')).rejects.toThrow();
    });

    test('Should prevent unauthorized order confirmation', async () => {
      mockBroker.getAccount = jest.fn().mockResolvedValue({
        buying_power: 50000,
        equity: 100000
      });

      const orderRequest = {
        symbol: 'AAPL',
        quantity: 10,
        side: 'buy',
        type: 'market',
        market_price: 150
      };

      const createResult = await orderManager.createOrder(orderRequest, 'user123');

      await expect(orderManager.confirmOrder(createResult.confirmationToken, 'user456')).rejects.toThrow();
    });

    test('Should cancel pending confirmation', async () => {
      mockBroker.getAccount = jest.fn().mockResolvedValue({
        buying_power: 50000,
        equity: 100000
      });

      const orderRequest = {
        symbol: 'AAPL',
        quantity: 10,
        side: 'buy',
        type: 'market',
        market_price: 150
      };

      const createResult = await orderManager.createOrder(orderRequest, 'user123');
      const cancelResult = orderManager.cancelPendingConfirmation(createResult.confirmationToken);

      expect(cancelResult.success).toBe(true);
      expect(orderManager.pendingConfirmations.has(createResult.confirmationToken)).toBe(false);
    });

    test('Should get pending confirmation details', async () => {
      mockBroker.getAccount = jest.fn().mockResolvedValue({
        buying_power: 50000,
        equity: 100000
      });

      const orderRequest = {
        symbol: 'AAPL',
        quantity: 10,
        side: 'buy',
        type: 'market',
        market_price: 150
      };

      const createResult = await orderManager.createOrder(orderRequest, 'user123');
      const confirmation = orderManager.getPendingConfirmation(createResult.confirmationToken);

      expect(confirmation).not.toBeNull();
      expect(confirmation.symbol).toBe('AAPL');
      expect(confirmation.quantity).toBe(10);
    });
  });

  describe('Business Rule Validation (v2.0)', () => {
    beforeEach(() => {
      mockBroker.getAccount = jest.fn().mockResolvedValue({
        buying_power: 50000,
        equity: 100000
      });
      mockBroker.getPositions = jest.fn().mockResolvedValue([]);
    });

    test('Should reject order below minimum value', async () => {
      const order = {
        symbol: 'AAPL',
        quantity: 1,
        side: 'buy',
        type: 'limit',
        limit_price: 10 // Total: $10 (below $100 minimum)
      };

      await expect(orderManager.createOrder(order, 'user123')).rejects.toThrow();
    });

    test('Should reject order exceeding maximum value', async () => {
      const order = {
        symbol: 'AAPL',
        quantity: 1000,
        side: 'buy',
        type: 'limit',
        limit_price: 200 // Total: $200,000 (above $100,000 maximum)
      };

      await expect(orderManager.createOrder(order, 'user123')).rejects.toThrow();
    });

    test('Should reject order with insufficient buying power', async () => {
      mockBroker.getAccount = jest.fn().mockResolvedValue({
        buying_power: 500,
        equity: 100000
      });

      const order = {
        symbol: 'AAPL',
        quantity: 10,
        side: 'buy',
        type: 'market',
        market_price: 150 // Total: $1500
      };

      await expect(orderManager.createOrder(order, 'user123')).rejects.toThrow();
    });

    test('Should require limit price for limit orders', async () => {
      const limitOrder = {
        symbol: 'AAPL',
        quantity: 10,
        side: 'buy',
        type: 'limit'
      };

      await expect(orderManager.createOrder(limitOrder, 'user123')).rejects.toThrow();
    });
  });
});
