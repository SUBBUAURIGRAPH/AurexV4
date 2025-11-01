/**
 * Advanced Order Types
 * Implements sophisticated order types beyond standard market/limit/stop
 *
 * Supported Types:
 * - Trailing Stop Orders
 * - Conditional Orders (If/Then)
 * - Bracket Orders (Stop Loss + Take Profit)
 * - Iceberg Orders (hidden portions)
 * - Time-weighted Average Price (TWAP)
 * - Volume-weighted Average Price (VWAP)
 */

const EventEmitter = require('events');
const uuid = require('uuid');

class AdvancedOrderTypes extends EventEmitter {
  constructor() {
    super();
    this.advancedOrders = new Map();
    this.activeConditions = new Map();
    this.priceHistory = new Map();
  }

  /**
   * Create a trailing stop order
   * Automatically adjusts stop price as price moves favorably
   */
  createTrailingStopOrder(orderData) {
    const {
      userId,
      symbol,
      quantity,
      side, // 'buy' or 'sell'
      trailingPercent, // e.g., 0.05 for 5% trailing
      currentPrice,
      expiresAt
    } = orderData;

    if (!trailingPercent || trailingPercent <= 0) {
      throw new Error('Invalid trailing percentage');
    }

    const orderId = uuid.v4();

    const order = {
      id: orderId,
      type: 'trailing_stop',
      userId,
      symbol,
      quantity,
      side,
      currentPrice,
      trailingPercent,
      highWaterMark: side === 'sell' ? currentPrice : null,
      lowWaterMark: side === 'buy' ? currentPrice : null,
      stopPrice: side === 'sell' ? currentPrice * (1 - trailingPercent) : currentPrice * (1 + trailingPercent),
      status: 'active',
      createdAt: new Date(),
      expiresAt,
      activationPrice: null,
      activatedAt: null,
      executedAt: null,
      executedPrice: null,
      description: `Trailing ${side} of ${quantity} ${symbol} with ${(trailingPercent * 100).toFixed(1)}% trail`
    };

    this.advancedOrders.set(orderId, order);
    this.emit('order:created:trailingStop', order);

    return order;
  }

  /**
   * Update trailing stop order with new price
   */
  updateTrailingStopPrice(orderId, newPrice) {
    const order = this.advancedOrders.get(orderId);
    if (!order || order.type !== 'trailing_stop') {
      throw new Error('Order not found or not a trailing stop');
    }

    if (order.status !== 'active') {
      return; // Order no longer active
    }

    const { side, trailingPercent } = order;

    if (side === 'sell') {
      // For sell orders, maintain price above the stop
      if (newPrice > order.highWaterMark) {
        order.highWaterMark = newPrice;
        order.stopPrice = newPrice * (1 - trailingPercent);
      }
      // Check if triggered
      if (newPrice <= order.stopPrice) {
        order.status = 'triggered';
        order.executedPrice = newPrice;
        order.executedAt = new Date();
        this.emit('order:triggered', order);
      }
    } else {
      // For buy orders, maintain price below the stop
      if (newPrice < order.lowWaterMark) {
        order.lowWaterMark = newPrice;
        order.stopPrice = newPrice * (1 + trailingPercent);
      }
      // Check if triggered
      if (newPrice >= order.stopPrice) {
        order.status = 'triggered';
        order.executedPrice = newPrice;
        order.executedAt = new Date();
        this.emit('order:triggered', order);
      }
    }
  }

  /**
   * Create a bracket order (primary + stop loss + take profit)
   */
  createBracketOrder(orderData) {
    const {
      userId,
      symbol,
      quantity,
      entryPrice,
      stopLossPrice,
      takeProfitPrice
    } = orderData;

    const bracketsId = uuid.v4();
    const now = new Date();

    const bracket = {
      id: bracketsId,
      type: 'bracket',
      userId,
      symbol,
      quantity,
      status: 'pending',
      createdAt: now,
      // Primary order
      primary: {
        id: uuid.v4(),
        side: 'buy',
        price: entryPrice,
        status: 'pending',
        type: 'limit'
      },
      // Stop loss order (activated when primary fills)
      stopLoss: {
        id: uuid.v4(),
        side: 'sell',
        stopPrice: stopLossPrice,
        status: 'pending',
        type: 'stop',
        linkedTo: null // Will be set when primary fills
      },
      // Take profit order (activated when primary fills)
      takeProfit: {
        id: uuid.v4(),
        side: 'sell',
        limitPrice: takeProfitPrice,
        status: 'pending',
        type: 'limit',
        linkedTo: null // Will be set when primary fills
      }
    };

    this.advancedOrders.set(bracketsId, bracket);
    this.emit('order:created:bracket', bracket);

    return bracket;
  }

  /**
   * Fill primary order and activate protective orders
   */
  fillBracketPrimary(bracketId, executedPrice) {
    const bracket = this.advancedOrders.get(bracketId);
    if (!bracket || bracket.type !== 'bracket') {
      throw new Error('Bracket order not found');
    }

    bracket.primary.status = 'filled';
    bracket.primary.executedPrice = executedPrice;
    bracket.primary.executedAt = new Date();
    bracket.status = 'active';

    // Link protective orders
    bracket.stopLoss.linkedTo = bracket.primary.id;
    bracket.takeProfit.linkedTo = bracket.primary.id;

    // Activate stop loss and take profit
    bracket.stopLoss.status = 'active';
    bracket.takeProfit.status = 'active';

    this.emit('bracket:primary:filled', bracket);

    return bracket;
  }

  /**
   * Create a conditional order (If/Then logic)
   */
  createConditionalOrder(orderData) {
    const {
      userId,
      symbol,
      quantity,
      side,
      // Condition
      triggerCondition, // e.g., "price > 150" or "indicator_signal == BUY"
      triggerPrice,
      triggerComparator, // '>', '<', '==', '!=', '>=', '<='
      // Order to execute when condition met
      orderType, // 'market', 'limit', 'stop'
      limitPrice,
      stopPrice
    } = orderData;

    const orderId = uuid.v4();

    const order = {
      id: orderId,
      type: 'conditional',
      userId,
      symbol,
      quantity,
      side,
      status: 'pending',
      createdAt: new Date(),
      // Trigger condition
      triggerCondition,
      triggerPrice,
      triggerComparator,
      isTriggered: false,
      triggeredAt: null,
      // Order to execute
      executionOrder: {
        type: orderType,
        limitPrice,
        stopPrice
      },
      // Result
      resultingOrderId: null
    };

    this.advancedOrders.set(orderId, order);
    this.activeConditions.set(orderId, order);

    this.emit('order:created:conditional', order);

    return order;
  }

  /**
   * Check conditional orders against current market data
   */
  evaluateConditionalOrders(symbol, currentPrice, marketData = {}) {
    const triggeredOrders = [];

    for (const [orderId, order] of this.activeConditions.entries()) {
      if (order.symbol !== symbol || order.isTriggered) {
        continue;
      }

      // Evaluate trigger condition
      const isConditionMet = this.evaluateCondition(
        order.triggerComparator,
        currentPrice,
        order.triggerPrice
      );

      if (isConditionMet) {
        order.isTriggered = true;
        order.triggeredAt = new Date();

        // Create the actual order that would be executed
        const resultingOrder = {
          id: uuid.v4(),
          symbol: order.symbol,
          quantity: order.quantity,
          side: order.side,
          type: order.executionOrder.type,
          limitPrice: order.executionOrder.limitPrice,
          stopPrice: order.executionOrder.stopPrice,
          linkedConditionalOrder: orderId
        };

        order.resultingOrderId = resultingOrder.id;
        this.activeConditions.delete(orderId);

        triggeredOrders.push({
          conditional: order,
          resultingOrder
        });

        this.emit('order:triggered:conditional', order);
      }
    }

    return triggeredOrders;
  }

  /**
   * Evaluate trigger condition
   */
  evaluateCondition(comparator, currentPrice, triggerPrice) {
    switch (comparator) {
      case '>':
        return currentPrice > triggerPrice;
      case '<':
        return currentPrice < triggerPrice;
      case '>=':
        return currentPrice >= triggerPrice;
      case '<=':
        return currentPrice <= triggerPrice;
      case '==':
        return currentPrice === triggerPrice;
      case '!=':
        return currentPrice !== triggerPrice;
      default:
        throw new Error(`Unknown comparator: ${comparator}`);
    }
  }

  /**
   * Create an iceberg order (shows only a portion publicly)
   */
  createIcebergOrder(orderData) {
    const {
      userId,
      symbol,
      quantity,
      side,
      limitPrice,
      visibleQuantity
    } = orderData;

    if (visibleQuantity > quantity || visibleQuantity <= 0) {
      throw new Error('Visible quantity must be between 0 and total quantity');
    }

    const orderId = uuid.v4();

    const order = {
      id: orderId,
      type: 'iceberg',
      userId,
      symbol,
      side,
      limitPrice,
      totalQuantity: quantity,
      visibleQuantity,
      filledQuantity: 0,
      hiddenQuantity: quantity - visibleQuantity,
      status: 'active',
      createdAt: new Date(),
      orders: [], // Internal orders placed
      description: `Iceberg order: ${visibleQuantity} visible of ${quantity} total`
    };

    this.advancedOrders.set(orderId, order);
    this.emit('order:created:iceberg', order);

    return order;
  }

  /**
   * Update iceberg order as portions fill
   */
  fillIcebergPortion(icebergOrderId, filledQuantity) {
    const order = this.advancedOrders.get(icebergOrderId);
    if (!order || order.type !== 'iceberg') {
      throw new Error('Iceberg order not found');
    }

    order.filledQuantity += filledQuantity;

    // If portion was visible, replenish hidden portion
    if (order.filledQuantity >= order.visibleQuantity) {
      order.visibleQuantity = Math.min(
        order.hiddenQuantity,
        order.totalQuantity - order.filledQuantity
      );
      order.hiddenQuantity -= order.visibleQuantity;
    }

    if (order.filledQuantity >= order.totalQuantity) {
      order.status = 'filled';
      this.emit('order:filled:iceberg', order);
    } else {
      this.emit('order:partial:iceberg', order);
    }

    return order;
  }

  /**
   * Get order by ID
   */
  getOrder(orderId) {
    return this.advancedOrders.get(orderId);
  }

  /**
   * Cancel an advanced order
   */
  cancelOrder(orderId) {
    const order = this.advancedOrders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.type === 'bracket') {
      // Cancel all parts of bracket
      order.primary.status = 'cancelled';
      order.stopLoss.status = 'cancelled';
      order.takeProfit.status = 'cancelled';
      order.status = 'cancelled';
    } else {
      order.status = 'cancelled';
    }

    // Remove from active conditions if applicable
    if (order.type === 'conditional') {
      this.activeConditions.delete(orderId);
    }

    this.emit('order:cancelled', order);

    return order;
  }

  /**
   * Get all active advanced orders for a user
   */
  getUserAdvancedOrders(userId) {
    const userOrders = [];
    for (const order of this.advancedOrders.values()) {
      if (order.userId === userId && ['active', 'pending'].includes(order.status)) {
        userOrders.push(order);
      }
    }
    return userOrders;
  }
}

module.exports = AdvancedOrderTypes;
