/**
 * Advanced Backtesting Engine
 * Extended version supporting limit orders, stop orders, and stop-limit orders
 *
 * Extends the base BacktestingEngine with advanced order type support
 *
 * Features:
 * - Market orders (existing)
 * - Limit orders (buy/sell at specific price)
 * - Stop orders (stop loss)
 * - Stop-limit orders (combined)
 * - Order state management
 * - Realistic order execution with multiple fills
 */

const EventEmitter = require('events');
const { AdvancedOrderManager, OrderType, OrderStatus } = require('./advanced-order-manager');

/**
 * Advanced Backtesting Engine
 * Extends base engine with advanced order type support
 */
class AdvancedBacktestingEngine extends EventEmitter {
  constructor(config = {}) {
    super();

    // Configuration
    this.symbol = config.symbol;
    this.startDate = config.startDate;
    this.endDate = config.endDate;
    this.initialCapital = config.initialCapital || 100000;
    this.commission = config.commission || 0.001; // 0.1%
    this.slippage = config.slippage || 0.0005; // 0.05%
    this.shortingAllowed = config.shortingAllowed !== false;
    this.maxPositionSize = config.maxPositionSize || 1; // Max as % of capital
    this.logger = config.logger || console;

    // Core components
    this.orderManager = new AdvancedOrderManager(this.logger);

    // State
    this.state = {
      equity: this.initialCapital,
      cash: this.initialCapital,
      positions: new Map(), // symbol -> position object
      closedOrders: [],
      closedTrades: [],
      equityCurve: [],
      drawdown: 0,
      maxDrawdown: 0,
      peakEquity: this.initialCapital,
      currentDate: null,
      currentBar: null
    };

    this.logger.info(
      `✅ Advanced Backtesting Engine initialized - Symbol: ${this.symbol}, Capital: $${this.initialCapital}`
    );
  }

  /**
   * Submit an order
   * @param {Object} orderParams - Order parameters
   * @returns {Object} Created order
   */
  submitOrder(orderParams) {
    try {
      const order = this.orderManager.createOrder({
        ...orderParams,
        entryDate: this.state.currentDate
      });

      this.logger.debug(
        `📋 Order submitted: ${order.type.toUpperCase()} - ${order.side} ${order.quantity} ${order.symbol}`
      );

      this.emit('order:submitted', order);
      return order;
    } catch (error) {
      this.logger.error('Error submitting order:', error);
      this.emit('order:error', { error: error.message });
      throw error;
    }
  }

  /**
   * Cancel an order
   * @param {string} orderId - Order ID
   * @returns {boolean} Success status
   */
  cancelOrder(orderId) {
    const success = this.orderManager.cancelOrder(orderId);
    if (success) {
      this.emit('order:cancelled', { orderId });
    }
    return success;
  }

  /**
   * Get order by ID
   * @param {string} orderId - Order ID
   * @returns {Object|null} Order or null
   */
  getOrder(orderId) {
    return this.orderManager.getOrder(orderId);
  }

  /**
   * Get all pending orders
   * @returns {Array} Pending orders
   */
  getPendingOrders() {
    return this.orderManager.pendingOrders;
  }

  /**
   * Process orders on current bar
   * Called on each bar to execute pending orders
   * @param {Object} bar - Current OHLCV bar
   * @returns {Object} Execution results
   */
  async processOrdersOnBar(bar) {
    const executionResults = [];

    // Get all pending orders for this symbol
    const pendingOrders = this.orderManager.getPendingOrdersForSymbol(this.symbol);

    for (const order of pendingOrders) {
      try {
        const result = this.orderManager.executeOrder(
          order,
          bar,
          this.state.cash,
          this.maxPositionSize * this.state.equity
        );

        if (result.success && result.fills.length > 0) {
          // Process each fill
          for (const fill of result.fills) {
            await this._processFill(order, fill, result.executionPrice);
          }

          executionResults.push({
            orderId: order.id,
            success: true,
            fills: result.fills,
            executionPrice: result.executionPrice
          });

          // Emit order events
          if (order.status === OrderStatus.FILLED) {
            this.emit('order:filled', order);
          } else if (order.status === OrderStatus.PARTIALLY_FILLED) {
            this.emit('order:partially_filled', order);
          }
        } else if (!result.success && order.status === OrderStatus.REJECTED) {
          this.emit('order:rejected', {
            orderId: order.id,
            reason: result.reason
          });
        }
      } catch (error) {
        this.logger.error(`Error processing order ${order.id}:`, error);
        this.emit('order:error', {
          orderId: order.id,
          error: error.message
        });
      }
    }

    return executionResults;
  }

  /**
   * Process order fill
   * @private
   * @param {Object} order - Order
   * @param {Object} fill - Fill details
   * @param {number} executionPrice - Execution price
   */
  async _processFill(order, fill, executionPrice) {
    // Calculate commission and slippage
    const commissionAmount = fill.quantity * executionPrice * this.commission;
    const slippageAmount = Math.abs(fill.slippage * fill.quantity);

    fill.commission = commissionAmount;
    fill.totalCost = (fill.quantity * executionPrice) + commissionAmount;

    // Update position
    this._updateOrCreatePosition(order, fill, executionPrice);

    // Update cash
    if (order.side === 'BUY') {
      this.state.cash -= fill.totalCost;
    } else {
      this.state.cash += (fill.quantity * executionPrice) - commissionAmount;
    }

    // Log fill
    this.logger.debug(
      `📍 Order fill: ${order.side} ${fill.quantity} ${order.symbol} @ $${executionPrice.toFixed(2)} (Commission: $${commissionAmount.toFixed(2)})`
    );
  }

  /**
   * Update or create position from fill
   * @private
   * @param {Object} order - Order
   * @param {Object} fill - Fill details
   * @param {number} executionPrice - Execution price
   */
  _updateOrCreatePosition(order, fill, executionPrice) {
    let position = this.state.positions.get(order.symbol);

    if (!position) {
      position = {
        symbol: order.symbol,
        quantity: 0,
        avgCost: 0,
        entryDate: this.state.currentDate,
        entryPrice: executionPrice,
        status: 'open',
        trades: []
      };
      this.state.positions.set(order.symbol, position);
    }

    if (order.side === 'BUY') {
      // Update average cost
      const totalQuantity = position.quantity + fill.quantity;
      position.avgCost = (position.avgCost * position.quantity + executionPrice * fill.quantity) /
                        totalQuantity;
      position.quantity = totalQuantity;
    } else {
      // Selling
      if (position.quantity >= fill.quantity) {
        // Close all or part of position
        const realizedPnL = (executionPrice - position.avgCost) * fill.quantity;

        // Record trade
        const trade = {
          entryDate: position.entryDate,
          entryPrice: position.avgCost,
          exitDate: this.state.currentDate,
          exitPrice: executionPrice,
          quantity: fill.quantity,
          side: 'LONG',
          grossPnL: realizedPnL + (fill.commission / 2),  // Split commission
          netPnL: realizedPnL - (fill.commission / 2),
          commission: fill.commission / 2,
          holdingPeriod: Math.floor((this.state.currentDate - position.entryDate) / (1000 * 60 * 60 * 24)),
          pnlPercent: (realizedPnL / (position.quantity * position.avgCost)) * 100,
          orderId: order.id
        };

        this.state.closedTrades.push(trade);
        position.trades.push(trade);

        position.quantity -= fill.quantity;
      }
    }

    return position;
  }

  /**
   * Update positions based on current price
   * @param {Object} bar - Current bar
   */
  updatePositions(bar) {
    for (const [symbol, position] of this.state.positions) {
      if (position.quantity > 0) {
        const currentValue = position.quantity * bar.close;
        const unrealizedPnL = currentValue - (position.quantity * position.avgCost);
        position.unrealizedPnL = unrealizedPnL;
        position.currentValue = currentValue;
      }
    }
  }

  /**
   * Record equity history
   */
  recordEquityHistory() {
    const equity = this._calculateEquity();
    this.state.equityCurve.push({
      date: this.state.currentDate,
      equity: equity
    });

    // Update drawdown tracking
    if (equity > this.state.peakEquity) {
      this.state.peakEquity = equity;
    }

    const drawdown = (this.state.peakEquity - equity) / this.state.peakEquity;
    if (drawdown > this.state.maxDrawdown) {
      this.state.maxDrawdown = drawdown;
    }

    this.state.drawdown = drawdown;
  }

  /**
   * Calculate current equity
   * @private
   * @returns {number} Current equity
   */
  _calculateEquity() {
    let positionsValue = 0;

    for (const [symbol, position] of this.state.positions) {
      if (position.quantity > 0) {
        positionsValue += position.currentValue || (position.quantity * this.state.currentBar.close);
      }
    }

    return this.state.cash + positionsValue;
  }

  /**
   * Get order statistics
   * @returns {Object} Order statistics
   */
  getOrderStats() {
    return this.orderManager.getOrderStats();
  }

  /**
   * Get execution summary
   * @returns {Object} Execution summary
   */
  getExecutionSummary() {
    const stats = this.getOrderStats();
    const equity = this._calculateEquity();

    return {
      initialCapital: this.initialCapital,
      finalEquity: equity,
      totalReturn: ((equity - this.initialCapital) / this.initialCapital) * 100,
      maxDrawdown: this.state.maxDrawdown * 100,
      closedTrades: this.state.closedTrades.length,
      ...stats
    };
  }

  /**
   * Reset engine state
   */
  reset() {
    this.state = {
      equity: this.initialCapital,
      cash: this.initialCapital,
      positions: new Map(),
      closedOrders: [],
      closedTrades: [],
      equityCurve: [],
      drawdown: 0,
      maxDrawdown: 0,
      peakEquity: this.initialCapital,
      currentDate: null,
      currentBar: null
    };

    this.orderManager.reset();
    this.logger.info('Advanced Backtesting Engine reset');
  }
}

// Export
module.exports = {
  AdvancedBacktestingEngine,
  OrderType,
  OrderStatus
};
