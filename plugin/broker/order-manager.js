/**
 * Order Management System
 * Handles order lifecycle, tracking, and execution
 * @version 1.0.0
 */

const crypto = require('crypto');

/**
 * OrderManager
 * @class
 * @description Manages order lifecycle and tracking
 */
class OrderManager {
  /**
   * Initialize Order Manager
   * @param {Object} config - Configuration
   * @param {Object} config.broker - Broker instance
   * @param {Object} config.logger - Logger instance
   */
  constructor(config = {}) {
    this.broker = config.broker;
    this.logger = config.logger || console;
    this.orders = new Map(); // Order ID -> Order details
    this.ordersByUser = new Map(); // User ID -> Order IDs
    this.executionHistory = [];
  }

  /**
   * Create new order
   * @param {Object} orderRequest - Order details
   * @param {string} userId - User ID placing order
   * @returns {Promise<Object>} Order confirmation
   */
  async createOrder(orderRequest, userId = 'system') {
    try {
      // Validate request
      const validation = this.validateOrderRequest(orderRequest);
      if (!validation.valid) {
        throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
      }

      // Create local order record
      const order = {
        orderId: this.generateOrderId(),
        userId,
        symbol: orderRequest.symbol.toUpperCase(),
        side: orderRequest.side.toLowerCase(),
        type: orderRequest.type.toLowerCase(),
        quantity: orderRequest.quantity,
        limitPrice: orderRequest.limit_price,
        stopPrice: orderRequest.stop_price,
        timeInForce: orderRequest.time_in_force || 'day',
        extendedHours: orderRequest.extended_hours || false,
        status: 'pending_submission',
        brokerOrderId: null,
        createdAt: new Date(),
        submittedAt: null,
        filledAt: null,
        cancelledAt: null,
        filledQuantity: 0,
        averageFillPrice: null,
        commission: 0,
        totalCost: 0
      };

      // Submit to broker
      const brokerResponse = await this.broker.placeOrder(orderRequest);

      // Update order with broker response
      order.brokerOrderId = brokerResponse.id;
      order.status = brokerResponse.status || 'submitted';
      order.submittedAt = new Date();

      // Store order
      this.orders.set(order.orderId, order);

      // Track by user
      if (!this.ordersByUser.has(userId)) {
        this.ordersByUser.set(userId, []);
      }
      this.ordersByUser.get(userId).push(order.orderId);

      // Log execution
      this.recordExecution({
        action: 'ORDER_CREATED',
        orderId: order.orderId,
        userId,
        symbol: order.symbol,
        quantity: order.quantity,
        side: order.side
      });

      this.logger.info(`Order created: ${order.orderId}`, order);

      return order;
    } catch (error) {
      this.logger.error('Failed to create order', { error: error.message });
      throw error;
    }
  }

  /**
   * Get order status
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Order details
   */
  async getOrderStatus(orderId) {
    try {
      const order = this.orders.get(orderId);
      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      // Update from broker if submitted
      if (order.brokerOrderId) {
        const brokerOrder = await this.broker.getOrder(order.brokerOrderId);
        this.updateOrderFromBroker(order, brokerOrder);
      }

      return order;
    } catch (error) {
      this.logger.error(`Failed to get order status: ${orderId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Cancel order
   * @param {string} orderId - Order ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object>} Cancellation confirmation
   */
  async cancelOrder(orderId, userId = 'system') {
    try {
      const order = this.orders.get(orderId);
      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      // Check authorization
      if (order.userId !== userId && userId !== 'system') {
        throw new Error('Unauthorized: Cannot cancel another user\'s order');
      }

      // Check if cancellable
      if (['filled', 'cancelled', 'rejected'].includes(order.status)) {
        throw new Error(`Cannot cancel order with status: ${order.status}`);
      }

      // Cancel with broker
      if (order.brokerOrderId) {
        await this.broker.cancelOrder(order.brokerOrderId);
      }

      // Update order
      order.status = 'cancelled';
      order.cancelledAt = new Date();

      // Log execution
      this.recordExecution({
        action: 'ORDER_CANCELLED',
        orderId,
        userId,
        symbol: order.symbol
      });

      this.logger.info(`Order cancelled: ${orderId}`);

      return {
        success: true,
        orderId,
        status: 'cancelled'
      };
    } catch (error) {
      this.logger.error(`Failed to cancel order: ${orderId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get all orders for user
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Array} Array of orders
   */
  getOrdersByUser(userId, filters = {}) {
    const orderIds = this.ordersByUser.get(userId) || [];
    let orders = orderIds.map(id => this.orders.get(id));

    // Apply filters
    if (filters.status) {
      orders = orders.filter(o => o.status === filters.status);
    }

    if (filters.symbol) {
      orders = orders.filter(o => o.symbol === filters.symbol.toUpperCase());
    }

    if (filters.side) {
      orders = orders.filter(o => o.side === filters.side.toLowerCase());
    }

    // Sort by creation date descending
    orders.sort((a, b) => b.createdAt - a.createdAt);

    return orders;
  }

  /**
   * Get all active orders
   * @returns {Array} Array of active orders
   */
  getActiveOrders() {
    return Array.from(this.orders.values())
      .filter(o => ['pending_submission', 'submitted', 'pending_cancel', 'partially_filled'].includes(o.status));
  }

  /**
   * Synchronize orders with broker
   * @returns {Promise<void>}
   */
  async syncWithBroker() {
    try {
      const brokerOrders = await this.broker.getOrders();

      for (const brokerOrder of brokerOrders) {
        // Find matching order
        let order = Array.from(this.orders.values())
          .find(o => o.brokerOrderId === brokerOrder.id);

        if (!order) {
          // Create new order if not found
          order = {
            orderId: this.generateOrderId(),
            userId: 'system',
            brokerOrderId: brokerOrder.id,
            symbol: brokerOrder.symbol,
            side: brokerOrder.side,
            type: brokerOrder.order_type,
            quantity: brokerOrder.qty,
            status: brokerOrder.status,
            createdAt: new Date(brokerOrder.created_at),
            filledQuantity: brokerOrder.filled_qty,
            averageFillPrice: brokerOrder.filled_avg_price
          };

          this.orders.set(order.orderId, order);
        } else {
          this.updateOrderFromBroker(order, brokerOrder);
        }
      }

      this.logger.info('Orders synchronized with broker');
    } catch (error) {
      this.logger.error('Failed to sync orders with broker', { error: error.message });
    }
  }

  /**
   * Update order from broker response
   * @private
   * @param {Object} order - Local order object
   * @param {Object} brokerOrder - Broker order data
   */
  updateOrderFromBroker(order, brokerOrder) {
    order.status = brokerOrder.status || order.status;
    order.filledQuantity = brokerOrder.filled_qty || 0;
    order.averageFillPrice = brokerOrder.filled_avg_price;

    if (brokerOrder.filled_at) {
      order.filledAt = new Date(brokerOrder.filled_at);
    }

    if (brokerOrder.cancelled_at) {
      order.cancelledAt = new Date(brokerOrder.cancelled_at);
    }

    // Calculate cost
    if (order.averageFillPrice) {
      order.totalCost = (order.filledQuantity * order.averageFillPrice).toFixed(2);
    }
  }

  /**
   * Calculate order cost
   * @param {string} orderId - Order ID
   * @returns {Object} Cost details
   */
  calculateOrderCost(orderId) {
    const order = this.orders.get(orderId);
    if (!order) {
      return null;
    }

    const filledCost = order.filledQuantity * (order.averageFillPrice || 0);
    const remainingQuantity = order.quantity - order.filledQuantity;

    return {
      orderId,
      filledQuantity: order.filledQuantity,
      filledCost: filledCost.toFixed(2),
      remainingQuantity,
      totalQuantity: order.quantity,
      averagePrice: order.averageFillPrice?.toFixed(2),
      commission: order.commission.toFixed(2),
      netCost: (filledCost + order.commission).toFixed(2)
    };
  }

  /**
   * Validate order request
   * @private
   * @param {Object} orderRequest - Order details
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateOrderRequest(orderRequest) {
    const errors = [];

    if (!orderRequest.symbol) {
      errors.push('Symbol is required');
    }

    if (!orderRequest.quantity || orderRequest.quantity <= 0) {
      errors.push('Quantity must be positive');
    }

    if (!['buy', 'sell'].includes(orderRequest.side)) {
      errors.push('Side must be buy or sell');
    }

    if (!['market', 'limit', 'stop', 'stop-limit'].includes(orderRequest.type)) {
      errors.push('Invalid order type');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate unique order ID
   * @private
   * @returns {string} Order ID
   */
  generateOrderId() {
    return `order_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Record execution for audit trail
   * @private
   * @param {Object} execution - Execution details
   */
  recordExecution(execution) {
    this.executionHistory.push({
      ...execution,
      timestamp: new Date()
    });

    // Keep only last 10000 executions
    if (this.executionHistory.length > 10000) {
      this.executionHistory.shift();
    }
  }

  /**
   * Get execution history
   * @param {Object} filters - Filter options
   * @returns {Array} Execution history
   */
  getExecutionHistory(filters = {}) {
    let history = this.executionHistory;

    if (filters.userId) {
      history = history.filter(h => h.userId === filters.userId);
    }

    if (filters.action) {
      history = history.filter(h => h.action === filters.action);
    }

    if (filters.limit) {
      history = history.slice(-filters.limit);
    }

    return history;
  }

  /**
   * Get order statistics
   * @param {string} userId - User ID (optional)
   * @returns {Object} Statistics
   */
  getStatistics(userId = null) {
    let orders = userId
      ? this.getOrdersByUser(userId)
      : Array.from(this.orders.values());

    const stats = {
      total: orders.length,
      completed: orders.filter(o => o.status === 'filled').length,
      pending: orders.filter(o => ['pending_submission', 'submitted', 'pending_cancel'].includes(o.status)).length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      rejected: orders.filter(o => o.status === 'rejected').length,
      avgFillPrice: null,
      totalVolume: 0,
      totalCost: 0
    };

    const filledOrders = orders.filter(o => o.status === 'filled');
    if (filledOrders.length > 0) {
      stats.avgFillPrice = (
        filledOrders.reduce((sum, o) => sum + (o.averageFillPrice || 0) * o.filledQuantity, 0) /
        filledOrders.reduce((sum, o) => sum + o.filledQuantity, 0)
      ).toFixed(2);

      stats.totalVolume = filledOrders.reduce((sum, o) => sum + o.filledQuantity, 0);
      stats.totalCost = filledOrders.reduce((sum, o) => sum + ((o.averageFillPrice || 0) * o.filledQuantity), 0).toFixed(2);
    }

    return stats;
  }
}

module.exports = OrderManager;
