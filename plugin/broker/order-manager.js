/**
 * Order Management System
 * Handles order lifecycle, tracking, and execution with validation and confirmation
 * @version 2.0.0
 */

const crypto = require('crypto');

/**
 * OrderManager
 * @class
 * @description Manages order lifecycle, validation, confirmation workflow, and tracking
 */
class OrderManager {
  /**
   * Initialize Order Manager
   * @param {Object} config - Configuration
   * @param {Object} config.broker - Broker instance
   * @param {Object} config.logger - Logger instance
   * @param {Object} config.positionTracker - Position tracker instance (optional)
   * @param {Object} config.validationRules - Custom validation rules (optional)
   */
  constructor(config = {}) {
    this.broker = config.broker;
    this.logger = config.logger || console;
    this.positionTracker = config.positionTracker;

    this.orders = new Map(); // Order ID -> Order details
    this.ordersByUser = new Map(); // User ID -> Order IDs
    this.executionHistory = [];
    this.pendingConfirmations = new Map(); // Order ID -> Confirmation details

    // Business rule validation
    this.validationRules = {
      minOrderValue: config.validationRules?.minOrderValue || 100, // Minimum $100
      maxOrderValue: config.validationRules?.maxOrderValue || 1000000, // Max $1M
      maxPositionSize: config.validationRules?.maxPositionSize || 0.3, // 30% of portfolio
      maxDailyTrades: config.validationRules?.maxDailyTrades || 100,
      minAccountBalance: config.validationRules?.minAccountBalance || 2000, // Pattern Day Trader rule
      ...config.validationRules
    };
  }

  /**
   * Create and validate new order (returns pending confirmation)
   * @param {Object} orderRequest - Order details
   * @param {string} userId - User ID placing order
   * @returns {Promise<Object>} Pending confirmation with order preview
   */
  async createOrder(orderRequest, userId = 'system') {
    try {
      // Validate request
      const validation = this.validateOrderRequest(orderRequest);
      if (!validation.valid) {
        throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
      }

      // Validate business rules
      const businessValidation = await this.validateBusinessRules(orderRequest, userId);
      if (!businessValidation.valid) {
        throw new Error(`Business rule validation failed: ${businessValidation.errors.join(', ')}`);
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
        status: 'pending_confirmation',
        brokerOrderId: null,
        createdAt: new Date(),
        submittedAt: null,
        filledAt: null,
        cancelledAt: null,
        filledQuantity: 0,
        averageFillPrice: null,
        commission: 0,
        totalCost: 0,
        estimatedCost: this.estimateOrderCost(orderRequest),
        validationWarnings: businessValidation.warnings || []
      };

      // Store pending confirmation
      const confirmationToken = this.generateConfirmationToken();
      this.pendingConfirmations.set(confirmationToken, {
        orderId: order.orderId,
        order,
        token: confirmationToken,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minute expiry
        createdAt: new Date()
      });

      // Store order in pending state
      this.orders.set(order.orderId, order);

      // Track by user
      if (!this.ordersByUser.has(userId)) {
        this.ordersByUser.set(userId, []);
      }
      this.ordersByUser.get(userId).push(order.orderId);

      // Log execution
      this.recordExecution({
        action: 'ORDER_PENDING_CONFIRMATION',
        orderId: order.orderId,
        userId,
        symbol: order.symbol,
        quantity: order.quantity,
        side: order.side
      });

      this.logger.info(`Order pending confirmation: ${order.orderId}`, { ...order, confirmationToken });

      return {
        success: true,
        orderId: order.orderId,
        confirmationToken,
        order: {
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          quantity: order.quantity,
          limitPrice: order.limitPrice,
          stopPrice: order.stopPrice,
          estimatedCost: order.estimatedCost
        },
        warnings: order.validationWarnings,
        expiresAt: this.pendingConfirmations.get(confirmationToken).expiresAt
      };
    } catch (error) {
      this.logger.error('Failed to create order', { error: error.message });
      throw error;
    }
  }

  /**
   * Confirm and execute pending order
   * @param {string} confirmationToken - Confirmation token from createOrder
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object>} Order confirmation
   */
  async confirmOrder(confirmationToken, userId) {
    try {
      const confirmation = this.pendingConfirmations.get(confirmationToken);
      if (!confirmation) {
        throw new Error('Invalid or expired confirmation token');
      }

      // Check expiry
      if (new Date() > confirmation.expiresAt) {
        this.pendingConfirmations.delete(confirmationToken);
        throw new Error('Confirmation token has expired');
      }

      const order = confirmation.order;

      // Verify authorization
      if (order.userId !== userId && userId !== 'system') {
        throw new Error('Unauthorized: Cannot confirm another user\'s order');
      }

      // Submit to broker
      const brokerResponse = await this.broker.placeOrder({
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        limit_price: order.limitPrice,
        stop_price: order.stopPrice,
        time_in_force: order.timeInForce,
        extended_hours: order.extendedHours
      });

      // Update order with broker response
      order.brokerOrderId = brokerResponse.id;
      order.status = brokerResponse.status || 'submitted';
      order.submittedAt = new Date();

      // Remove from pending confirmations
      this.pendingConfirmations.delete(confirmationToken);

      // Log execution
      this.recordExecution({
        action: 'ORDER_SUBMITTED',
        orderId: order.orderId,
        userId,
        symbol: order.symbol,
        quantity: order.quantity,
        side: order.side,
        brokerOrderId: order.brokerOrderId
      });

      this.logger.info(`Order submitted to broker: ${order.orderId}`, order);

      return {
        success: true,
        orderId: order.orderId,
        brokerOrderId: order.brokerOrderId,
        status: order.status,
        submittedAt: order.submittedAt
      };
    } catch (error) {
      this.logger.error('Failed to confirm order', { error: error.message });
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

    if (orderRequest.type === 'limit' && !orderRequest.limit_price) {
      errors.push('Limit price required for limit orders');
    }

    if (orderRequest.type === 'stop' && !orderRequest.stop_price) {
      errors.push('Stop price required for stop orders');
    }

    if (orderRequest.type === 'stop-limit' && (!orderRequest.limit_price || !orderRequest.stop_price)) {
      errors.push('Both limit and stop prices required for stop-limit orders');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate order against business rules
   * @private
   * @param {Object} orderRequest - Order details
   * @param {string} userId - User ID
   * @returns {Promise<Object>} { valid: boolean, errors: Array, warnings: Array }
   */
  async validateBusinessRules(orderRequest, userId) {
    const errors = [];
    const warnings = [];

    try {
      // Estimate order cost
      const estimatedCost = this.estimateOrderCost(orderRequest);

      // Check minimum order value
      if (estimatedCost < this.validationRules.minOrderValue) {
        errors.push(`Order value ($${estimatedCost.toFixed(2)}) below minimum ($${this.validationRules.minOrderValue})`);
      }

      // Check maximum order value
      if (estimatedCost > this.validationRules.maxOrderValue) {
        errors.push(`Order value ($${estimatedCost.toFixed(2)}) exceeds maximum ($${this.validationRules.maxOrderValue})`);
      }

      // Check account balance if broker available
      if (this.broker && orderRequest.side === 'buy') {
        try {
          const account = await this.broker.getAccount();

          // Check if sufficient buying power
          if (account.buying_power < estimatedCost) {
            errors.push(`Insufficient buying power. Required: $${estimatedCost.toFixed(2)}, Available: $${account.buying_power.toFixed(2)}`);
          }

          // Check minimum account balance (Pattern Day Trader rule)
          if (account.equity < this.validationRules.minAccountBalance) {
            warnings.push(`Account balance ($${account.equity.toFixed(2)}) below recommended minimum (${this.validationRules.minAccountBalance})`);
          }
        } catch (error) {
          this.logger.warn('Could not fetch account for validation', { error: error.message });
        }
      }

      // Check daily trade count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaysTrades = Array.from(this.orders.values()).filter(o => {
        const orderDate = new Date(o.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime() && o.userId === userId;
      }).length;

      if (todaysTrades >= this.validationRules.maxDailyTrades) {
        errors.push(`Daily trade limit reached (${this.validationRules.maxDailyTrades})`);
      }

      // Check position size if position tracker available
      if (this.positionTracker) {
        try {
          const positions = await this.positionTracker.getPositions();
          const totalValue = positions.reduce((sum, p) => sum + (p.marketValue || 0), 0);
          const maxPositionValue = totalValue * this.validationRules.maxPositionSize;

          if (orderRequest.side === 'buy' && estimatedCost > maxPositionValue) {
            warnings.push(`Order size exceeds recommended position limit (${(this.validationRules.maxPositionSize * 100).toFixed(0)}% of portfolio)`);
          }
        } catch (error) {
          this.logger.warn('Could not fetch positions for validation', { error: error.message });
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      this.logger.error('Business rule validation error', { error: error.message });
      return {
        valid: false,
        errors: ['Validation system error: ' + error.message],
        warnings
      };
    }
  }

  /**
   * Estimate order cost based on market price
   * @private
   * @param {Object} orderRequest - Order details
   * @returns {number} Estimated cost
   */
  estimateOrderCost(orderRequest) {
    let estimatedPrice = 0;

    if (orderRequest.type === 'limit') {
      estimatedPrice = orderRequest.limit_price || 0;
    } else if (orderRequest.type === 'market' || orderRequest.type === 'stop') {
      // Assume market price is 100 for estimation if not provided
      estimatedPrice = orderRequest.market_price || 100;
    } else if (orderRequest.type === 'stop-limit') {
      estimatedPrice = orderRequest.limit_price || 0;
    }

    return estimatedPrice * orderRequest.quantity;
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
   * Generate confirmation token
   * @private
   * @returns {string} Confirmation token
   */
  generateConfirmationToken() {
    return `confirm_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Cancel pending confirmation
   * @param {string} confirmationToken - Confirmation token
   * @returns {Object} Cancellation result
   */
  cancelPendingConfirmation(confirmationToken) {
    const confirmation = this.pendingConfirmations.get(confirmationToken);
    if (!confirmation) {
      return { success: false, message: 'Confirmation not found' };
    }

    const order = confirmation.order;
    this.pendingConfirmations.delete(confirmationToken);
    this.orders.delete(order.orderId);

    this.recordExecution({
      action: 'ORDER_CONFIRMATION_CANCELLED',
      orderId: order.orderId,
      userId: order.userId,
      symbol: order.symbol
    });

    return { success: true, orderId: order.orderId };
  }

  /**
   * Get pending confirmation details
   * @param {string} confirmationToken - Confirmation token
   * @returns {Object} Confirmation details or null
   */
  getPendingConfirmation(confirmationToken) {
    const confirmation = this.pendingConfirmations.get(confirmationToken);
    if (!confirmation) {
      return null;
    }

    // Check if expired
    if (new Date() > confirmation.expiresAt) {
      this.pendingConfirmations.delete(confirmationToken);
      return null;
    }

    return {
      orderId: confirmation.order.orderId,
      symbol: confirmation.order.symbol,
      side: confirmation.order.side,
      type: confirmation.order.type,
      quantity: confirmation.order.quantity,
      estimatedCost: confirmation.order.estimatedCost,
      warnings: confirmation.order.validationWarnings,
      expiresAt: confirmation.expiresAt,
      createdAt: confirmation.createdAt
    };
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
