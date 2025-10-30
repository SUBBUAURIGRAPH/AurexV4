/**
 * Backtesting Engine
 * Core execution engine for realistic backtesting of trading strategies
 *
 * Features:
 * - Event-driven execution
 * - Realistic order fills with slippage
 * - Commission simulation
 * - Position tracking with P&L calculation
 * - Risk management rule enforcement
 * - Performance metrics calculation
 */

const EventEmitter = require('events');

/**
 * BacktestingEngine
 * Orchestrates backtest execution with realistic order simulation
 */
class BacktestingEngine extends EventEmitter {
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

    // State
    this.state = {
      equity: this.initialCapital,
      cash: this.initialCapital,
      positions: new Map(), // symbol -> position object
      openOrders: [],
      closedOrders: [],
      trades: [],
      equityCurve: [],
      drawdown: 0,
      maxDrawdown: 0,
      peakEquity: this.initialCapital,
      currentDate: null,
      currentBar: null
    };

    this.logger.info(`✅ Backtesting Engine initialized - Symbol: ${this.symbol}, Capital: $${this.initialCapital}`);
  }

  /**
   * Run backtest with historical data and strategy
   * @param {HistoricalDataManager} dataManager - Historical data manager
   * @param {Strategy} strategy - Strategy to backtest
   * @returns {Promise<BacktestResult>} Complete backtest result
   */
  async run(dataManager, strategy) {
    try {
      this.logger.info(`📊 Starting backtest: ${this.symbol} (${this.startDate.toISOString().split('T')[0]} - ${this.endDate.toISOString().split('T')[0]})`);
      this.emit('backtest:started', { symbol: this.symbol });

      // Load historical data
      const bars = await dataManager.loadData(
        this.symbol,
        this.startDate,
        this.endDate,
        '1d'
      );

      if (!bars || bars.length === 0) {
        throw new Error(`No historical data available for ${this.symbol}`);
      }

      this.logger.info(`📈 Loaded ${bars.length} bars of historical data`);

      // Initialize strategy
      await strategy.initialize(this);

      // Process each bar
      let barCount = 0;
      for (const bar of bars) {
        try {
          // Update current state
          this.state.currentDate = new Date(bar.date);
          this.state.currentBar = bar;

          // Update positions based on current price
          this.updatePositions(bar);

          // Call strategy's on_bar callback
          if (typeof strategy.onBar === 'function') {
            await strategy.onBar(bar, this);
          }

          // Record equity history
          this.recordEquityHistory();

          barCount++;
          if (barCount % 50 === 0) {
            this.emit('backtest:progress', {
              currentDate: bar.date,
              barCount,
              totalBars: bars.length,
              progress: (barCount / bars.length) * 100
            });
          }
        } catch (error) {
          this.logger.error(`Error processing bar ${bar.date}:`, error);
          this.emit('backtest:error', { date: bar.date, error: error.message });
        }
      }

      // Close all open positions at end
      await this.closeAllPositions('strategy_end');

      // Calculate final metrics
      const result = this.calculateMetrics();

      this.logger.info(`✅ Backtest completed`);
      this.emit('backtest:completed', result);

      return result;
    } catch (error) {
      this.logger.error('Backtest failed:', error);
      this.emit('backtest:failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Submit a market order
   * @param {Object} order - Order details
   * @returns {Promise<ExecutedOrder>} Executed order
   */
  async submitOrder(order) {
    try {
      // Validate order
      this.validateOrder(order);

      // Get current price
      const executionPrice = this.calculateExecutionPrice(
        this.state.currentBar.close,
        order.side,
        order.quantity
      );

      // Calculate commission and net cost
      const grossCost = order.quantity * executionPrice;
      const commissionAmount = grossCost * this.commission;
      const totalCost = grossCost + commissionAmount;

      // Check buying power
      if (order.side === 'BUY' && totalCost > this.state.cash) {
        throw new Error(`Insufficient buying power: $${this.state.cash} < $${totalCost}`);
      }

      // Execute order
      const executedOrder = {
        id: Math.random().toString(36).substr(2, 9),
        symbol: this.symbol,
        side: order.side,
        quantity: order.quantity,
        entryPrice: executionPrice,
        entryDate: this.state.currentDate,
        commission: commissionAmount,
        slippage: executionPrice - this.state.currentBar.close,
        status: 'filled'
      };

      // Update cash
      if (order.side === 'BUY') {
        this.state.cash -= totalCost;
      } else {
        this.state.cash += (grossCost - commissionAmount);
      }

      // Update or create position
      this.updateOrCreatePosition(executedOrder);

      // Record order
      this.state.openOrders.push(executedOrder);

      this.emit('order:filled', executedOrder);
      this.logger.debug(`📍 ${order.side} order filled: ${order.quantity} @ $${executionPrice.toFixed(2)}`);

      return executedOrder;
    } catch (error) {
      this.logger.error('Order submission failed:', error);
      this.emit('order:rejected', { order, error: error.message });
      throw error;
    }
  }

  /**
   * Close a position
   * @param {string} symbol - Symbol to close
   * @param {string} reason - Reason for close
   * @returns {Promise<Object>} Close result
   */
  async closePosition(symbol, reason = 'user_request') {
    try {
      const position = this.state.positions.get(symbol);

      if (!position || position.quantity === 0) {
        throw new Error(`No open position for ${symbol}`);
      }

      // Create sell order
      const exitPrice = this.state.currentBar.close;
      const grossProceeds = position.quantity * exitPrice;
      const commissionAmount = grossProceeds * this.commission;
      const netProceeds = grossProceeds - commissionAmount;

      // Calculate P&L
      const realizedPnL = netProceeds - (position.quantity * position.avgCost);

      // Update cash
      this.state.cash += netProceeds;

      // Record trade
      const trade = {
        entryDate: position.entryDate,
        entryPrice: position.avgCost,
        exitDate: this.state.currentDate,
        exitPrice: exitPrice,
        quantity: position.quantity,
        side: 'LONG',
        grossPnL: realizedPnL + commissionAmount,
        netPnL: realizedPnL,
        commission: commissionAmount,
        holdingPeriod: Math.floor((this.state.currentDate - position.entryDate) / (1000 * 60 * 60 * 24)),
        pnlPercent: (realizedPnL / (position.quantity * position.avgCost)) * 100,
        exitReason: reason
      };

      this.state.trades.push(trade);
      this.state.closedOrders.push(...this.state.openOrders);
      this.state.openOrders = [];

      // Close position
      position.quantity = 0;
      position.status = 'closed';

      this.emit('position:closed', trade);
      this.logger.debug(`✅ Position closed: ${trade.quantity} units, P&L: $${trade.netPnL.toFixed(2)}`);

      return trade;
    } catch (error) {
      this.logger.error(`Error closing position: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close all open positions
   * @param {string} reason - Reason for close
   * @returns {Promise<Array>} Array of closed trades
   */
  async closeAllPositions(reason = 'strategy_end') {
    const closedTrades = [];

    for (const [symbol, position] of this.state.positions) {
      if (position.quantity > 0) {
        try {
          const trade = await this.closePosition(symbol, reason);
          closedTrades.push(trade);
        } catch (error) {
          this.logger.warn(`Failed to close ${symbol}:`, error.message);
        }
      }
    }

    return closedTrades;
  }

  /**
   * Get current account equity
   * @returns {number} Current equity
   */
  getEquity() {
    let positionsValue = 0;

    for (const [symbol, position] of this.state.positions) {
      if (position.quantity > 0) {
        positionsValue += position.quantity * this.state.currentBar.close;
      }
    }

    return this.state.cash + positionsValue;
  }

  /**
   * Get current positions
   * @returns {Array} Array of positions
   */
  getPositions() {
    return Array.from(this.state.positions.values())
      .filter(pos => pos.quantity !== 0);
  }

  /**
   * Get trade history
   * @returns {Array} All closed trades
   */
  getTrades() {
    return this.state.trades;
  }

  /**
   * Get equity curve
   * @returns {Array} Equity history points
   */
  getEquityCurve() {
    return this.state.equityCurve;
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Validate order parameters
   */
  validateOrder(order) {
    if (!order.symbol || !order.side || !order.quantity) {
      throw new Error('Invalid order: missing required fields');
    }
    if (!['BUY', 'SELL'].includes(order.side)) {
      throw new Error('Invalid order side');
    }
    if (order.quantity <= 0) {
      throw new Error('Invalid order quantity');
    }
  }

  /**
   * Calculate execution price with slippage
   */
  calculateExecutionPrice(basePrice, side, quantity) {
    let slippageAmount = basePrice * this.slippage;

    // Unfavorable slippage for execution
    if (side === 'BUY') {
      slippageAmount *= 1; // Buy = higher price
    } else {
      slippageAmount *= -1; // Sell = lower price
    }

    const executionPrice = basePrice + slippageAmount;
    return executionPrice;
  }

  /**
   * Update positions based on current bar price
   */
  updatePositions(bar) {
    for (const [symbol, position] of this.state.positions) {
      if (symbol === this.symbol && position.quantity > 0) {
        // Calculate unrealized P&L
        const currentValue = position.quantity * bar.close;
        const costBasis = position.quantity * position.avgCost;
        position.unrealizedPnL = currentValue - costBasis;
        position.unrealizedPercent = (position.unrealizedPnL / costBasis) * 100;
      }
    }

    // Update equity
    const newEquity = this.getEquity();
    this.state.equity = newEquity;

    // Update drawdown
    if (newEquity > this.state.peakEquity) {
      this.state.peakEquity = newEquity;
    }
    this.state.drawdown = (newEquity - this.state.peakEquity) / this.state.peakEquity;
    this.state.maxDrawdown = Math.min(this.state.maxDrawdown, this.state.drawdown);
  }

  /**
   * Update or create position from order
   */
  updateOrCreatePosition(order) {
    let position = this.state.positions.get(this.symbol);

    if (!position) {
      position = {
        symbol: this.symbol,
        quantity: 0,
        avgCost: 0,
        entryDate: order.entryDate,
        unrealizedPnL: 0,
        unrealizedPercent: 0,
        status: 'open'
      };
      this.state.positions.set(this.symbol, position);
    }

    if (order.side === 'BUY') {
      // Calculate new average cost
      const oldCost = position.quantity * position.avgCost;
      const newCost = order.quantity * order.entryPrice;
      position.quantity += order.quantity;
      position.avgCost = (oldCost + newCost) / position.quantity;
    } else {
      position.quantity -= order.quantity;
    }
  }

  /**
   * Record equity for equity curve
   */
  recordEquityHistory() {
    this.state.equityCurve.push({
      date: this.state.currentDate,
      equity: this.state.equity,
      cash: this.state.cash,
      drawdown: this.state.drawdown
    });
  }

  /**
   * Calculate performance metrics
   */
  calculateMetrics() {
    const trades = this.state.trades;
    const equityCurve = this.state.equityCurve;

    if (trades.length === 0 || equityCurve.length === 0) {
      return this.getEmptyResult();
    }

    // Basic metrics
    const totalReturn = (this.state.equity - this.initialCapital) / this.initialCapital;
    const netProfit = this.state.equity - this.initialCapital;

    // Trade statistics
    const winningTrades = trades.filter(t => t.netPnL > 0);
    const losingTrades = trades.filter(t => t.netPnL <= 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

    const totalWins = winningTrades.reduce((sum, t) => sum + t.netPnL, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnL, 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 99.99 : 0);

    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

    // Returns for Sharpe ratio
    const returns = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const ret = (equityCurve[i].equity - equityCurve[i-1].equity) / equityCurve[i-1].equity;
      returns.push(ret);
    }

    // Sharpe ratio (assuming 252 trading days/year, 0% risk-free rate)
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn * 252) / (stdDev * Math.sqrt(252)) : 0;

    // Calmar ratio
    const calmarRatio = this.state.maxDrawdown !== 0
      ? (totalReturn * 252) / Math.abs(this.state.maxDrawdown)
      : 0;

    // Duration calculation
    const duration = Math.floor(
      (equityCurve[equityCurve.length - 1].date - equityCurve[0].date) / (1000 * 60 * 60 * 24)
    );

    return {
      symbol: this.symbol,
      initialCapital: this.initialCapital,
      finalEquity: this.state.equity,
      netProfit,
      totalReturn: totalReturn * 100,
      annualizedReturn: (Math.pow(1 + totalReturn, 365 / duration) - 1) * 100,
      sharpeRatio: parseFloat(sharpeRatio.toFixed(3)),
      calmarRatio: parseFloat(calmarRatio.toFixed(3)),
      maxDrawdown: this.state.maxDrawdown * 100,
      winRate: parseFloat(winRate.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      largestWin: Math.max(...trades.map(t => t.netPnL), 0),
      largestLoss: Math.min(...trades.map(t => t.netPnL), 0),
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      trades: trades,
      equityCurve: equityCurve,
      duration
    };
  }

  /**
   * Get empty result for backtests with no trades
   */
  getEmptyResult() {
    return {
      symbol: this.symbol,
      initialCapital: this.initialCapital,
      finalEquity: this.initialCapital,
      netProfit: 0,
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      trades: [],
      equityCurve: this.state.equityCurve,
      duration: 0
    };
  }
}

module.exports = BacktestingEngine;
