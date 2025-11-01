/**
 * Advanced Order Manager
 * Handles limit orders, stop orders, and stop-limit orders for backtesting
 *
 * Features:
 * - Market orders (existing)
 * - Limit orders (buy/sell at specific price)
 * - Stop orders (stop loss)
 * - Stop-limit orders (combined)
 * - Order state management (pending, triggered, filled, cancelled, rejected)
 * - Partial fills
 * - Order queue management
 */

/**
 * Order Types Enumeration
 */
const OrderType = {
  MARKET: 'market',
  LIMIT: 'limit',
  STOP: 'stop',
  STOP_LIMIT: 'stop_limit'
};

/**
 * Order Status Enumeration
 */
const OrderStatus = {
  PENDING: 'pending',      // Order submitted but not yet triggered/filled
  TRIGGERED: 'triggered',  // Stop order triggered, converted to limit
  FILLED: 'filled',        // Order completely filled
  PARTIALLY_FILLED: 'partially_filled',  // Order partially filled
  CANCELLED: 'cancelled',  // Order cancelled
  REJECTED: 'rejected'     // Order rejected (insufficient funds, etc)
};

/**
 * Advanced Order Manager
 * Manages order lifecycle and execution for different order types
 */
class AdvancedOrderManager {
  constructor(logger = console) {
    this.logger = logger;
    this.orders = [];  // All orders submitted
    this.pendingOrders = [];  // Orders waiting for execution
    this.filledOrders = [];   // Completed orders
  }

  /**
   * Create a new order
   * @param {Object} orderParams - Order parameters
   * @returns {Object} Created order
   */
  createOrder(orderParams) {
    const {
      id = Math.random().toString(36).substr(2, 9),
      symbol,
      side,  // 'BUY' or 'SELL'
      quantity,
      type = OrderType.MARKET,  // market, limit, stop, stop_limit
      limitPrice,  // For limit and stop_limit orders
      stopPrice,   // For stop and stop_limit orders
      entryDate,
      status = OrderStatus.PENDING
    } = orderParams;

    // Validate required fields
    if (!symbol || !side || !quantity || !entryDate) {
      throw new Error('Missing required order fields');
    }

    if (!['BUY', 'SELL'].includes(side)) {
      throw new Error('Invalid order side: must be BUY or SELL');
    }

    // Validate order type-specific fields
    if (type === OrderType.LIMIT && !limitPrice) {
      throw new Error('Limit price required for limit orders');
    }

    if (type === OrderType.STOP && !stopPrice) {
      throw new Error('Stop price required for stop orders');
    }

    if (type === OrderType.STOP_LIMIT && (!stopPrice || !limitPrice)) {
      throw new Error('Both stop price and limit price required for stop-limit orders');
    }

    const order = {
      id,
      symbol,
      side,
      quantity,
      type,
      limitPrice,
      stopPrice,
      entryDate,
      status,
      filledQuantity: 0,
      remainingQuantity: quantity,
      averageFillPrice: 0,
      totalCost: 0,
      fills: [],  // Array of partial fill records
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.orders.push(order);
    if (status === OrderStatus.PENDING) {
      this.pendingOrders.push(order);
    }

    this.logger.debug(`📋 Order created: ${id} - ${side} ${quantity} ${symbol} @ ${this._getPriceDisplay(order)}`);
    return order;
  }

  /**
   * Check if order should be triggered on current bar
   * @param {Object} order - Order to check
   * @param {Object} bar - Current OHLCV bar
   * @returns {boolean} True if order should be triggered
   */
  shouldTriggerOrder(order, bar) {
    if (order.status !== OrderStatus.PENDING) {
      return false;
    }

    // Market orders always triggered
    if (order.type === OrderType.MARKET) {
      return true;
    }

    // Limit orders triggered if price touched
    if (order.type === OrderType.LIMIT) {
      if (order.side === 'BUY') {
        return bar.low <= order.limitPrice;
      } else {
        return bar.high >= order.limitPrice;
      }
    }

    // Stop orders triggered if stop price touched
    if (order.type === OrderType.STOP) {
      if (order.side === 'BUY') {
        return bar.high >= order.stopPrice;
      } else {
        return bar.low <= order.stopPrice;
      }
    }

    // Stop-limit orders: first check stop condition
    if (order.type === OrderType.STOP_LIMIT) {
      const stopTriggered = order.side === 'BUY'
        ? bar.high >= order.stopPrice
        : bar.low <= order.stopPrice;

      // If stop not yet triggered but will be, convert to triggered
      if (stopTriggered && order.status === OrderStatus.PENDING) {
        return true;
      }

      // If already triggered, check limit condition
      if (order.status === OrderStatus.TRIGGERED) {
        return order.side === 'BUY'
          ? bar.low <= order.limitPrice
          : bar.high >= order.limitPrice;
      }
    }

    return false;
  }

  /**
   * Execute order at current bar price
   * @param {Object} order - Order to execute
   * @param {Object} bar - Current OHLCV bar
   * @param {number} availableCash - Available cash for execution
   * @param {number} maxPositionSize - Max position size constraint
   * @returns {Object} Execution result with fills
   */
  executeOrder(order, bar, availableCash, maxPositionSize = Infinity) {
    if (!this.shouldTriggerOrder(order, bar)) {
      return { success: false, reason: 'Order not triggered' };
    }

    const executionPrice = this._calculateExecutionPrice(order, bar);
    const fills = [];

    try {
      // Calculate max fillable quantity
      const maxQuantity = Math.min(
        order.remainingQuantity,
        Math.floor(availableCash / executionPrice)
      );

      if (maxQuantity <= 0) {
        order.status = OrderStatus.REJECTED;
        return {
          success: false,
          reason: 'Insufficient buying power',
          fills: []
        };
      }

      // Execute fill
      const fill = {
        quantity: maxQuantity,
        price: executionPrice,
        timestamp: bar.date,
        commission: 0,  // To be calculated by engine
        slippage: executionPrice - bar.close
      };

      order.filledQuantity += maxQuantity;
      order.remainingQuantity -= maxQuantity;
      order.averageFillPrice = (order.averageFillPrice * (order.filledQuantity - maxQuantity) +
                               executionPrice * maxQuantity) / order.filledQuantity;
      order.totalCost += executionPrice * maxQuantity;
      order.fills.push(fill);
      order.updatedAt = new Date();

      // Update order status
      if (order.remainingQuantity === 0) {
        order.status = OrderStatus.FILLED;
      } else {
        order.status = OrderStatus.PARTIALLY_FILLED;
      }

      fills.push(fill);

      this.logger.debug(
        `✅ Order ${order.id} executed: ${maxQuantity} @ $${executionPrice.toFixed(2)}`
      );

      return { success: true, fills, executionPrice };
    } catch (error) {
      order.status = OrderStatus.REJECTED;
      this.logger.error(`Error executing order ${order.id}:`, error);
      return { success: false, reason: error.message, fills: [] };
    }
  }

  /**
   * Cancel order
   * @param {string} orderId - Order ID to cancel
   * @returns {boolean} Success status
   */
  cancelOrder(orderId) {
    const order = this.orders.find(o => o.id === orderId);

    if (!order) {
      this.logger.warn(`Order not found: ${orderId}`);
      return false;
    }

    if ([OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.REJECTED].includes(order.status)) {
      this.logger.warn(`Cannot cancel order with status: ${order.status}`);
      return false;
    }

    order.status = OrderStatus.CANCELLED;
    order.updatedAt = new Date();

    // Remove from pending orders
    this.pendingOrders = this.pendingOrders.filter(o => o.id !== orderId);

    this.logger.debug(`🚫 Order cancelled: ${orderId}`);
    return true;
  }

  /**
   * Get all pending orders for a symbol
   * @param {string} symbol - Symbol to filter
   * @returns {Array} Pending orders
   */
  getPendingOrdersForSymbol(symbol) {
    return this.pendingOrders.filter(o => o.symbol === symbol);
  }

  /**
   * Get order by ID
   * @param {string} orderId - Order ID
   * @returns {Object|null} Order or null
   */
  getOrder(orderId) {
    return this.orders.find(o => o.id === orderId) || null;
  }

  /**
   * Get all orders for a symbol
   * @param {string} symbol - Symbol to filter
   * @returns {Array} All orders for symbol
   */
  getOrdersForSymbol(symbol) {
    return this.orders.filter(o => o.symbol === symbol);
  }

  /**
   * Get order statistics
   * @returns {Object} Statistics
   */
  getOrderStats() {
    const stats = {
      totalOrders: this.orders.length,
      filledOrders: this.orders.filter(o => o.status === OrderStatus.FILLED).length,
      partiallyFilled: this.orders.filter(o => o.status === OrderStatus.PARTIALLY_FILLED).length,
      cancelledOrders: this.orders.filter(o => o.status === OrderStatus.CANCELLED).length,
      rejectedOrders: this.orders.filter(o => o.status === OrderStatus.REJECTED).length,
      pendingOrders: this.pendingOrders.length,

      // Order type breakdown
      ordersByType: {
        market: this.orders.filter(o => o.type === OrderType.MARKET).length,
        limit: this.orders.filter(o => o.type === OrderType.LIMIT).length,
        stop: this.orders.filter(o => o.type === OrderType.STOP).length,
        stopLimit: this.orders.filter(o => o.type === OrderType.STOP_LIMIT).length
      },

      // Execution stats
      totalShares: this.orders.reduce((sum, o) => sum + o.filledQuantity, 0),
      filledShares: this.orders
        .filter(o => o.status === OrderStatus.FILLED)
        .reduce((sum, o) => sum + o.filledQuantity, 0),
      totalFills: this.orders.reduce((sum, o) => sum + o.fills.length, 0)
    };

    return stats;
  }

  /**
   * Clear all orders (for backtest reset)
   */
  reset() {
    this.orders = [];
    this.pendingOrders = [];
    this.filledOrders = [];
    this.logger.debug('Order manager reset');
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  /**
   * Calculate execution price for different order types
   * @private
   * @param {Object} order - Order
   * @param {Object} bar - Current bar
   * @returns {number} Execution price
   */
  _calculateExecutionPrice(order, bar) {
    switch (order.type) {
      case OrderType.MARKET:
        // Market order executes at close price
        return bar.close;

      case OrderType.LIMIT:
        // Limit order executes at limit price or better
        if (order.side === 'BUY') {
          return Math.min(order.limitPrice, bar.close);
        } else {
          return Math.max(order.limitPrice, bar.close);
        }

      case OrderType.STOP:
        // Stop order converts to market when triggered
        return bar.close;

      case OrderType.STOP_LIMIT:
        // Stop-limit executes at limit price when triggered
        return order.limitPrice;

      default:
        return bar.close;
    }
  }

  /**
   * Get price display string for order
   * @private
   * @param {Object} order - Order
   * @returns {string} Price display
   */
  _getPriceDisplay(order) {
    if (order.type === OrderType.MARKET) {
      return 'Market';
    } else if (order.type === OrderType.LIMIT) {
      return `Limit $${order.limitPrice.toFixed(2)}`;
    } else if (order.type === OrderType.STOP) {
      return `Stop $${order.stopPrice.toFixed(2)}`;
    } else if (order.type === OrderType.STOP_LIMIT) {
      return `Stop ${order.stopPrice.toFixed(2)}/Limit ${order.limitPrice.toFixed(2)}`;
    }
    return 'Unknown';
  }
}

// Export
module.exports = {
  AdvancedOrderManager,
  OrderType,
  OrderStatus
};
