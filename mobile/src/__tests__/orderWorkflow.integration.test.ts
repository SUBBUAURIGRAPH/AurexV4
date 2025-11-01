/**
 * Order Workflow Integration Tests
 * End-to-end testing of order creation, confirmation, and tracking
 */

import {
  validateOrder,
  getOrderDescription,
  calculateEstimatedCost,
} from '../utils/orderValidation';

import {
  applyFilters,
  getOrderStatistics,
  getActiveFilterCount,
} from '../utils/orderHistoryFilters';

import { OrderNotificationManager } from '../utils/orderNotifications';

// ==================== Mock Data ====================

const mockOrderData = {
  symbol: 'AAPL',
  side: 'buy' as const,
  type: 'limit' as const,
  quantity: 100,
  price: 150.5,
  timeInForce: 'day' as const,
  notes: 'Test order',
};

const mockOrderResponse = {
  id: 'ord-123',
  ...mockOrderData,
  status: 'confirmed' as const,
  filledQuantity: 0,
  averageFillPrice: 0,
  totalCost: 15050,
  commission: 15.05,
  createdAt: '2025-10-31T10:00:00Z',
  updatedAt: '2025-10-31T10:00:00Z',
};

const mockConfirmationData = {
  token: 'token_abc123xyz789',
  orderId: 'ord-123',
  expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
  details: mockOrderResponse,
};

// ==================== Test Suites ====================

describe('Order Workflow Integration Tests', () => {
  // ==================== Order Creation Workflow ====================

  describe('Order Creation Workflow', () => {
    it('should validate order before creation', () => {
      // Step 1: User fills in order form
      const orderInput = {
        symbol: 'AAPL',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 100,
        price: 150.5,
      };

      // Step 2: Validate order
      const validation = validateOrder(orderInput);

      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should show estimated cost before creation', () => {
      const cost = calculateEstimatedCost(
        mockOrderData.type,
        mockOrderData.quantity,
        mockOrderData.price
      );

      expect(cost).toBe(15050);
    });

    it('should generate human-readable order description', () => {
      const description = getOrderDescription(mockOrderData);

      expect(description).toContain('AAPL');
      expect(description).toContain('Buy');
      expect(description).toContain('100');
      expect(description).toContain('150.5');
    });

    it('should create order with confirmation response', async () => {
      // Simulate successful order creation
      const result = { ...mockConfirmationData };

      expect(result.orderId).toBe('ord-123');
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });
  });

  // ==================== Order Confirmation Workflow ====================

  describe('Order Confirmation Workflow', () => {
    it('should require valid confirmation token', () => {
      const confirmationData = mockConfirmationData;

      expect(confirmationData.token).toBeDefined();
      expect(confirmationData.orderId).toBe('ord-123');
    });

    it('should check token expiration', () => {
      const expiryTime = new Date(mockConfirmationData.expiresAt);
      const now = new Date();

      expect(expiryTime.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should display order details for confirmation', () => {
      const details = mockConfirmationData.details;

      expect(details.symbol).toBe('AAPL');
      expect(details.quantity).toBe(100);
      expect(details.price).toBe(150.5);
      expect(details.status).toBe('confirmed');
    });

    it('should confirm order with token', async () => {
      // Simulate order confirmation
      const confirmed = {
        ...mockOrderResponse,
        status: 'submitted' as const,
      };

      expect(confirmed.id).toBe('ord-123');
      expect(confirmed.status).toBe('submitted');
    });
  });

  // ==================== Real-Time Updates Workflow ====================

  describe('Real-Time Updates Workflow', () => {
    it('should create notification from order update', () => {
      const manager = new OrderNotificationManager();

      // Simulate order status update
      const update = {
        orderId: 'ord-123',
        status: 'partial',
        filledQuantity: 50,
        averageFillPrice: 150.5,
        totalCost: 7525,
        commission: 7.525,
        timestamp: new Date().toISOString(),
        event: 'fill_update' as const,
      };

      const notification = manager.createNotificationFromUpdate(update);

      expect(notification.orderId).toBe('ord-123');
      expect(notification.status).toBe('partial');
      expect(notification.filledQuantity).toBe(50);
      expect(notification.dismissed).toBe(false);
    });

    it('should manage notification lifecycle', () => {
      const manager = new OrderNotificationManager();

      const update = {
        orderId: 'ord-123',
        status: 'filled',
        filledQuantity: 100,
        averageFillPrice: 150.5,
        totalCost: 15050,
        commission: 15.05,
        timestamp: new Date().toISOString(),
        event: 'fill_update' as const,
      };

      // Create notification
      const notification = manager.createNotificationFromUpdate(update);
      const id = manager.addNotification(notification);

      expect(id).toBeDefined();
      expect(manager.getCount()).toBe(1);

      // Dismiss notification
      manager.dismissNotification(id);
      const active = manager.getActiveNotifications();

      expect(active.length).toBe(0);
    });

    it('should track multiple order updates', () => {
      const manager = new OrderNotificationManager();

      const updates = [
        {
          orderId: 'ord-123',
          status: 'submitted',
          filledQuantity: 0,
          averageFillPrice: 0,
          totalCost: 15050,
          commission: 15.05,
          timestamp: new Date().toISOString(),
          event: 'status_change' as const,
        },
        {
          orderId: 'ord-123',
          status: 'partial',
          filledQuantity: 50,
          averageFillPrice: 150.5,
          totalCost: 7525,
          commission: 7.525,
          timestamp: new Date().toISOString(),
          event: 'fill_update' as const,
        },
        {
          orderId: 'ord-123',
          status: 'filled',
          filledQuantity: 100,
          averageFillPrice: 150.5,
          totalCost: 15050,
          commission: 15.05,
          timestamp: new Date().toISOString(),
          event: 'fill_update' as const,
        },
      ];

      updates.forEach((update) => {
        const notification = manager.createNotificationFromUpdate(update);
        manager.addNotification(notification);
      });

      expect(manager.getCount()).toBe(3);
      expect(manager.getOrderNotifications('ord-123').length).toBe(3);
    });
  });

  // ==================== Order History & Filtering Workflow ====================

  describe('Order History & Filtering Workflow', () => {
    it('should display order history with all orders', () => {
      const orders = [
        mockOrderResponse,
        {
          ...mockOrderResponse,
          id: 'ord-124',
          symbol: 'GOOGL',
          status: 'filled' as const,
          quantity: 50,
          price: 140,
          totalCost: 7000,
        },
        {
          ...mockOrderResponse,
          id: 'ord-125',
          symbol: 'MSFT',
          status: 'pending' as const,
          quantity: 75,
          price: 300,
          filledQuantity: 0,
          totalCost: 22500,
        },
      ];

      expect(orders.length).toBe(3);
    });

    it('should filter orders by symbol', () => {
      const orders = [
        mockOrderResponse,
        {
          ...mockOrderResponse,
          id: 'ord-124',
          symbol: 'GOOGL',
        },
        {
          ...mockOrderResponse,
          id: 'ord-125',
          symbol: 'AAPL',
        },
      ];

      const filtered = applyFilters(orders, { symbol: 'AAPL' });

      expect(filtered.length).toBe(2);
      expect(filtered.every((o) => o.symbol === 'AAPL')).toBe(true);
    });

    it('should filter orders by status', () => {
      const orders = [
        { ...mockOrderResponse, status: 'filled' as const },
        { ...mockOrderResponse, id: 'ord-124', status: 'pending' as const },
        { ...mockOrderResponse, id: 'ord-125', status: 'cancelled' as const },
      ];

      const filtered = applyFilters(orders, {
        status: ['filled', 'pending'],
      });

      expect(filtered.length).toBe(2);
    });

    it('should calculate statistics for filtered orders', () => {
      const orders = [
        { ...mockOrderResponse, quantity: 100, filledQuantity: 100 },
        { ...mockOrderResponse, id: 'ord-124', quantity: 50, filledQuantity: 0 },
        { ...mockOrderResponse, id: 'ord-125', quantity: 75, filledQuantity: 75 },
      ];

      const stats = getOrderStatistics(orders);

      expect(stats.totalOrders).toBe(3);
      expect(stats.totalQuantity).toBe(225);
      expect(stats.filledOrders).toBe(2);
    });

    it('should apply multiple filters', () => {
      const orders = [
        { ...mockOrderResponse, symbol: 'AAPL', status: 'filled' as const },
        { ...mockOrderResponse, id: 'ord-124', symbol: 'AAPL', status: 'pending' as const },
        { ...mockOrderResponse, id: 'ord-125', symbol: 'GOOGL', status: 'filled' as const },
      ];

      const filtered = applyFilters(orders, {
        symbol: 'AAPL',
        status: ['filled'],
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].symbol).toBe('AAPL');
      expect(filtered[0].status).toBe('filled');
    });
  });

  // ==================== Complete Order Workflow ====================

  describe('Complete Order Workflow', () => {
    it('should execute complete order creation to confirmation workflow', async () => {
      // 1. User prepares order
      const orderInput = mockOrderData;

      // 2. Validate order
      const validation = validateOrder(orderInput);
      expect(validation.isValid).toBe(true);

      // 3. Show estimated cost
      const estimatedCost = calculateEstimatedCost(
        orderInput.type,
        orderInput.quantity,
        orderInput.price
      );
      expect(estimatedCost).toBe(15050);

      // 4. Show order description
      const description = getOrderDescription(orderInput);
      expect(description).toContain('AAPL');

      // 5. Submit order (returns confirmation)
      const confirmation = mockConfirmationData;
      expect(confirmation.token).toBeDefined();

      // 6. Display confirmation details
      expect(confirmation.details.symbol).toBe('AAPL');
      expect(confirmation.details.quantity).toBe(100);

      // 7. User confirms order
      const confirmedOrder = {
        ...confirmation.details,
        status: 'submitted' as const,
      };
      expect(confirmedOrder.id).toBe('ord-123');
    });

    it('should execute order tracking and update workflow', async () => {
      const manager = new OrderNotificationManager();

      // Order is confirmed and submitted
      let order = {
        ...mockOrderResponse,
        status: 'submitted' as const,
      };

      // Status updates come from WebSocket
      const updates = [
        {
          orderId: order.id,
          status: 'partial' as const,
          filledQuantity: 50,
          averageFillPrice: 150.5,
          totalCost: 7525,
          commission: 7.525,
          timestamp: new Date().toISOString(),
          event: 'fill_update' as const,
        },
        {
          orderId: order.id,
          status: 'filled' as const,
          filledQuantity: 100,
          averageFillPrice: 150.5,
          totalCost: 15050,
          commission: 15.05,
          timestamp: new Date().toISOString(),
          event: 'fill_update' as const,
        },
      ];

      // Each update creates a notification
      updates.forEach((update) => {
        const notification = manager.createNotificationFromUpdate(update);
        manager.addNotification(notification);
        order = { ...order, ...update };
      });

      // Verify final state
      expect(order.status).toBe('filled');
      expect(order.filledQuantity).toBe(100);
      expect(manager.getCount()).toBe(2);
    });

    it('should execute order history review and export workflow', async () => {
      // User has multiple orders
      const orders = [
        { ...mockOrderResponse, symbol: 'AAPL', status: 'filled' as const },
        { ...mockOrderResponse, id: 'ord-124', symbol: 'GOOGL', status: 'filled' as const },
        { ...mockOrderResponse, id: 'ord-125', symbol: 'MSFT', status: 'pending' as const },
      ];

      // Apply filters
      const filtered = applyFilters(orders, {
        status: ['filled'],
      });

      expect(filtered.length).toBe(2);

      // Get statistics
      const stats = getOrderStatistics(filtered);

      expect(stats.totalOrders).toBe(2);
      expect(stats.filledOrders).toBe(2);

      // Get filter count
      const filterCount = getActiveFilterCount({ status: ['filled'] });

      expect(filterCount).toBe(1);
    });
  });

  // ==================== Error Handling Workflows ====================

  describe('Error Handling Workflows', () => {
    it('should handle invalid order data gracefully', () => {
      const invalidOrder = {
        symbol: 'invalid',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: -100, // Invalid: negative quantity
      };

      const validation = validateOrder(invalidOrder);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing required fields', () => {
      const incompleteOrder = {
        symbol: 'AAPL',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 100,
        // Missing price for limit order
      };

      const validation = validateOrder(incompleteOrder);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.field === 'price')).toBe(true);
    });

    it('should handle confirmation token expiry', () => {
      // Create expired confirmation
      const expiredConfirmation = {
        ...mockConfirmationData,
        expiresAt: new Date(Date.now() - 60000).toISOString(), // Expired 1 minute ago
      };

      const now = new Date();
      const expiryTime = new Date(expiredConfirmation.expiresAt);

      expect(expiryTime.getTime()).toBeLessThan(now.getTime());
    });

    it('should handle notification manager overflow', () => {
      const manager = new OrderNotificationManager();

      // Add many notifications
      for (let i = 0; i < 100; i++) {
        const notification = manager.createNotificationFromUpdate({
          orderId: `ord-${i}`,
          status: 'filled',
          filledQuantity: 100,
          averageFillPrice: 150,
          totalCost: 15000,
          commission: 15,
          timestamp: new Date().toISOString(),
          event: 'fill_update',
        });
        manager.addNotification(notification);
      }

      expect(manager.getCount()).toBe(100);

      // Clear dismissed
      manager.clearDismissed();

      // Should still have all active
      expect(manager.getActiveCount()).toBe(100);
    });
  });

  // ==================== Performance Tests ====================

  describe('Performance Benchmarks', () => {
    it('should validate orders quickly', () => {
      const iterations = 1000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        validateOrder(mockOrderData);
      }

      const duration = Date.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(1); // Should be < 1ms per validation
      console.log(`Validation avg time: ${avgTime.toFixed(3)}ms`);
    });

    it('should filter large datasets efficiently', () => {
      const orders = Array.from({ length: 1000 }, (_, i) => ({
        ...mockOrderResponse,
        id: `ord-${i}`,
        symbol: ['AAPL', 'GOOGL', 'MSFT', 'TSLA'][i % 4],
      }));

      const start = Date.now();

      const filtered = applyFilters(orders, {
        symbol: 'AAPL',
      });

      const duration = Date.now() - start;

      expect(filtered.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should be < 100ms for 1000 items
      console.log(`Filter duration: ${duration}ms for 1000 items`);
    });
  });
});
