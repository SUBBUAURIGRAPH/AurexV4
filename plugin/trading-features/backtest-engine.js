/**
 * Backtesting Engine
 * Simulates trading strategies against historical market data
 * Enables validation and optimization before live trading
 *
 * Features:
 * - Historical data replay
 * - Strategy signal evaluation
 * - Trade simulation with realistic fills
 * - Performance metrics calculation
 * - Monte Carlo analysis
 */

const EventEmitter = require('events');
const uuid = require('uuid');

class BacktestEngine extends EventEmitter {
  constructor(options = {}) {
    super();

    this.backtests = new Map();
    this.historicalData = new Map();

    this.defaultConfig = {
      initialCapital: 100000,
      commissionRate: 0.001,
      slippage: {
        buy: 0.0005,
        sell: 0.0005
      },
      startDate: null,
      endDate: null,
      symbols: [],
      ...options
    };
  }

  /**
   * Add historical data for backtesting
   */
  addHistoricalData(symbol, ohlcvData) {
    if (!Array.isArray(ohlcvData) || ohlcvData.length === 0) {
      throw new Error('Invalid OHLCV data');
    }

    // Sort by date
    const sortedData = ohlcvData.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateA - dateB;
    });

    this.historicalData.set(symbol, sortedData);
    this.emit('data:loaded', { symbol, count: sortedData.length });
  }

  /**
   * Run a backtest
   */
  runBacktest(backtestId, strategy, config = {}) {
    const mergedConfig = { ...this.defaultConfig, ...config };

    // Validate historical data exists for all symbols
    for (const symbol of strategy.symbols || []) {
      if (!this.historicalData.has(symbol)) {
        throw new Error(`No historical data for ${symbol}`);
      }
    }

    const backtest = {
      id: backtestId || uuid.v4(),
      strategy: strategy.name,
      config: mergedConfig,
      status: 'running',
      startTime: new Date(),
      results: {
        trades: [],
        positions: new Map(),
        equity: [],
        metrics: {}
      },
      errors: []
    };

    this.backtests.set(backtest.id, backtest);

    try {
      // Replay historical data
      this.replayHistoricalData(backtest, strategy);

      // Calculate metrics
      this.calculateBacktestMetrics(backtest);

      backtest.status = 'completed';
      this.emit('backtest:completed', backtest);
    } catch (error) {
      backtest.status = 'failed';
      backtest.errors.push(error.message);
      this.emit('backtest:failed', { backtestId: backtest.id, error });
    }

    backtest.endTime = new Date();
    backtest.duration = backtest.endTime - backtest.startTime;

    return backtest;
  }

  /**
   * Replay historical data point by point
   */
  replayHistoricalData(backtest, strategy) {
    const { symbols } = strategy;
    const dataStreams = new Map();

    // Initialize data streams for each symbol
    for (const symbol of symbols) {
      const data = this.historicalData.get(symbol) || [];
      dataStreams.set(symbol, { data, index: 0 });
    }

    // Create backtest session
    const session = {
      cash: backtest.config.initialCapital,
      positions: new Map(),
      trades: [],
      equity: [],
      currentBar: 0
    };

    // Find date range
    const allDates = new Set();
    for (const [symbol, stream] of dataStreams.entries()) {
      stream.data.forEach(bar => {
        allDates.add(new Date(bar.timestamp).getTime());
      });
    }

    const sortedDates = Array.from(allDates).sort((a, b) => a - b);

    // Replay each bar
    for (const timestamp of sortedDates) {
      const barData = {};
      const date = new Date(timestamp);

      // Collect current bar data for each symbol
      for (const symbol of symbols) {
        const stream = dataStreams.get(symbol);
        const bar = stream.data[stream.index];

        if (bar && new Date(bar.timestamp).getTime() === timestamp) {
          barData[symbol] = bar;
          stream.index += 1;
        }
      }

      if (Object.keys(barData).length === 0) continue;

      // Execute strategy signal
      const signal = strategy.evaluate(barData, session);

      if (signal) {
        this.executeTrade(session, signal, barData);
      }

      // Update positions with current prices
      this.updateSessionEquity(session, barData);

      // Record equity
      session.equity.push({
        timestamp: date,
        value: this.calculateSessionEquity(session)
      });

      session.currentBar += 1;
    }

    backtest.results.trades = session.trades;
    backtest.results.positions = session.positions;
    backtest.results.equity = session.equity;
    backtest.results.finalCash = session.cash;
  }

  /**
   * Execute a trade during backtest
   */
  executeTrade(session, signal, barData) {
    const { symbol, action, quantity, limitPrice } = signal;

    const bar = barData[symbol];
    if (!bar) return;

    // Determine execution price
    let executionPrice;
    if (action === 'buy') {
      executionPrice = bar.close + bar.close * this.defaultConfig.slippage.buy;
    } else {
      executionPrice = bar.close - bar.close * this.defaultConfig.slippage.sell;
    }

    // Apply limit price if specified
    if (limitPrice) {
      if (action === 'buy' && executionPrice > limitPrice) {
        return; // Order not filled
      }
      if (action === 'sell' && executionPrice < limitPrice) {
        return; // Order not filled
      }
      executionPrice = limitPrice;
    }

    // Calculate commission
    const commission = quantity * executionPrice * this.defaultConfig.commissionRate;
    const totalCost = quantity * executionPrice + commission;

    // Execute trade
    const trade = {
      id: uuid.v4(),
      symbol,
      action,
      quantity,
      entryPrice: executionPrice,
      commission,
      timestamp: new Date(bar.timestamp),
      barNumber: session.currentBar,
      pl: 0
    };

    if (action === 'buy') {
      // Check buying power
      if (totalCost > session.cash) {
        throw new Error(`Insufficient buying power for ${symbol}`);
      }

      session.cash -= totalCost;

      const position = session.positions.get(symbol) || {
        symbol,
        quantity: 0,
        averageCost: 0
      };

      const newQuantity = position.quantity + quantity;
      position.averageCost = (position.quantity * position.averageCost + totalCost) / newQuantity;
      position.quantity = newQuantity;

      session.positions.set(symbol, position);
    } else {
      // Sell
      const position = session.positions.get(symbol);
      if (!position || position.quantity < quantity) {
        throw new Error(`Cannot sell - insufficient position for ${symbol}`);
      }

      const gain = quantity * (executionPrice - position.averageCost) - commission;
      trade.pl = gain;
      session.cash += quantity * executionPrice - commission;

      position.quantity -= quantity;
      if (position.quantity === 0) {
        session.positions.delete(symbol);
      }
    }

    session.trades.push(trade);
  }

  /**
   * Update session equity with current prices
   */
  updateSessionEquity(session, barData) {
    // Positions are updated at end of day (simplified)
  }

  /**
   * Calculate session equity
   */
  calculateSessionEquity(session) {
    let positionValue = 0;

    for (const position of session.positions.values()) {
      const lastPrice = position.averageCost; // Simplified - should be current price
      positionValue += position.quantity * lastPrice;
    }

    return session.cash + positionValue;
  }

  /**
   * Calculate backtest metrics
   */
  calculateBacktestMetrics(backtest) {
    const { trades, equity } = backtest.results;

    if (trades.length === 0) {
      backtest.results.metrics = {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalReturn: 0,
        totalPL: 0,
        maxDrawdown: 0,
        profitFactor: 0,
        sharpeRatio: 0
      };
      return;
    }

    // Calculate trade statistics
    const winningTrades = trades.filter(t => t.pl > 0);
    const losingTrades = trades.filter(t => t.pl < 0);

    const totalPL = trades.reduce((sum, t) => sum + t.pl, 0);
    const initialCapital = backtest.config.initialCapital;
    const finalEquity = equity.length > 0 ? equity[equity.length - 1].value : initialCapital;

    // Win rate
    const winRate = (winningTrades.length / trades.length) * 100;

    // Profit factor
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Return
    const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;

    // Drawdown
    const maxDD = this.calculateMaxDrawdown(equity);

    // Sharpe ratio (simplified)
    const sharpeRatio = this.calculateSharpeRatio(equity);

    backtest.results.metrics = {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalReturn,
      totalPL,
      maxDrawdown: maxDD,
      profitFactor,
      sharpeRatio,
      averageWin: winningTrades.length > 0 ? grossProfit / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 ? grossLoss / losingTrades.length : 0,
      payoffRatio: losingTrades.length > 0 ? (grossProfit / winningTrades.length) / (grossLoss / losingTrades.length) : 0
    };
  }

  /**
   * Calculate maximum drawdown
   */
  calculateMaxDrawdown(equity) {
    if (equity.length === 0) return 0;

    let peak = equity[0].value;
    let maxDD = 0;

    for (const point of equity) {
      if (point.value > peak) {
        peak = point.value;
      }
      const drawdown = (peak - point.value) / peak;
      maxDD = Math.max(maxDD, drawdown);
    }

    return maxDD * 100;
  }

  /**
   * Calculate Sharpe ratio (simplified)
   */
  calculateSharpeRatio(equity) {
    if (equity.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < equity.length; i++) {
      const ret = (equity[i].value - equity[i - 1].value) / equity[i - 1].value;
      returns.push(ret);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    const riskFreeRate = 0.02 / 252; // Daily risk-free rate

    return stdDev > 0 ? (mean - riskFreeRate) / stdDev : 0;
  }

  /**
   * Get backtest results
   */
  getBacktestResults(backtestId) {
    return this.backtests.get(backtestId);
  }

  /**
   * Generate optimization report
   */
  generateOptimizationReport(backtests) {
    const report = {
      totalBacktests: backtests.length,
      successful: backtests.filter(b => b.status === 'completed').length,
      failed: backtests.filter(b => b.status === 'failed').length,
      results: []
    };

    for (const backtest of backtests) {
      report.results.push({
        id: backtest.id,
        strategy: backtest.strategy,
        metrics: backtest.results.metrics,
        duration: backtest.duration
      });
    }

    // Sort by Sharpe ratio (best strategy)
    report.results.sort((a, b) => b.metrics.sharpeRatio - a.metrics.sharpeRatio);

    return report;
  }
}

module.exports = BacktestEngine;
