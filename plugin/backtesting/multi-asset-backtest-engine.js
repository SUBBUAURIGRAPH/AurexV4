/**
 * Multi-Asset Backtesting Engine
 * Support for backtesting strategies across multiple assets
 *
 * Features:
 * - Portfolio-level backtesting
 * - Correlation analysis between assets
 * - Cross-asset risk metrics
 * - Rebalancing strategies
 * - Multi-asset performance comparison
 *
 * @version 1.0.0
 */

const EventEmitter = require('events');

/**
 * MultiAssetBacktestEngine
 * Handles backtesting for portfolios with multiple assets
 */
class MultiAssetBacktestEngine extends EventEmitter {
  /**
   * Initialize multi-asset backtest engine
   * @param {Object} historicalDataManager - Manager for loading historical data
   * @param {Object} logger - Logger instance
   */
  constructor(historicalDataManager, logger = console) {
    super();
    this.dataManager = historicalDataManager;
    this.logger = logger;
    this.backtests = new Map();
  }

  /**
   * Run multi-asset backtest
   * @param {Object} config - Backtest configuration
   * @param {Array} config.symbols - Array of symbols to backtest
   * @param {Date} config.startDate - Start date
   * @param {Date} config.endDate - End date
   * @param {Object} config.allocation - Initial allocation {symbol: percentage}
   * @param {Object} config.rebalanceConfig - Rebalancing configuration
   * @param {Function} config.strategy - Strategy function(prices, portfolio) => orders
   * @returns {Promise<Object>} Backtest results
   */
  async runBacktest(config) {
    const backtestId = `multi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.logger.info(`Starting multi-asset backtest: ${backtestId}`, {
        symbols: config.symbols,
        allocation: config.allocation
      });

      this.emit('backtest:started', { backtestId, config });

      // Load historical data for all symbols
      const historicalData = await this.loadHistoricalData(
        config.symbols,
        config.startDate,
        config.endDate
      );

      // Validate we have data for all symbols
      const missingSymbols = config.symbols.filter(s => !historicalData[s] || historicalData[s].length === 0);
      if (missingSymbols.length > 0) {
        throw new Error(`Missing data for symbols: ${missingSymbols.join(', ')}`);
      }

      // Initialize portfolio
      const portfolio = this.initializePortfolio(
        config.allocation,
        config.initialCapital || 100000,
        historicalData
      );

      // Run simulation
      const results = await this.simulatePortfolio(
        historicalData,
        portfolio,
        config
      );

      // Calculate metrics
      const metrics = this.calculatePortfolioMetrics(results);

      const backtest = {
        id: backtestId,
        config,
        results,
        metrics,
        portfolio,
        timestamp: new Date()
      };

      this.backtests.set(backtestId, backtest);
      this.emit('backtest:completed', { backtestId, metrics });

      return backtest;
    } catch (error) {
      this.logger.error(`Error in multi-asset backtest: ${backtestId}`, error);
      this.emit('backtest:error', { backtestId, error: error.message });
      throw error;
    }
  }

  /**
   * Load historical data for multiple symbols in parallel
   * @private
   */
  async loadHistoricalData(symbols, startDate, endDate) {
    const dataPromises = symbols.map(symbol =>
      this.dataManager
        .loadData(symbol, startDate, endDate, '1d')
        .catch(error => {
          this.logger.warn(`Failed to load data for ${symbol}:`, error);
          return [];
        })
    );

    const dataArrays = await Promise.all(dataPromises);
    const historicalData = {};

    symbols.forEach((symbol, index) => {
      historicalData[symbol] = dataArrays[index];
    });

    return historicalData;
  }

  /**
   * Initialize portfolio with allocation
   * @private
   */
  initializePortfolio(allocation, initialCapital, historicalData) {
    const positions = {};
    const totalCapital = initialCapital;

    for (const [symbol, percentage] of Object.entries(allocation)) {
      const capital = totalCapital * (percentage / 100);
      const firstPrice = historicalData[symbol]?.[0]?.close || 0;
      const shares = firstPrice > 0 ? capital / firstPrice : 0;

      positions[symbol] = {
        symbol,
        shares,
        purchasePrice: firstPrice,
        currentPrice: firstPrice,
        value: capital,
        allocation: percentage,
        unrealizedPnL: 0,
        realizedPnL: 0
      };
    }

    return {
      totalCapital,
      cash: 0,
      positions,
      equityHistory: [totalCapital],
      rebalanceHistory: [],
      tradeHistory: []
    };
  }

  /**
   * Simulate portfolio over time
   * @private
   */
  async simulatePortfolio(historicalData, portfolio, config) {
    const symbols = Object.keys(historicalData);
    const maxBars = Math.max(...symbols.map(s => historicalData[s].length));
    const results = {
      equityHistory: [portfolio.totalCapital],
      positions: [],
      trades: [],
      correlations: {}
    };

    // Get all dates from first symbol
    const dates = historicalData[symbols[0]].map(bar => bar.date);

    for (let barIndex = 0; barIndex < dates.length; barIndex++) {
      const date = dates[barIndex];
      const prices = {};

      // Get prices for all symbols at this date
      for (const symbol of symbols) {
        const bar = historicalData[symbol][barIndex];
        prices[symbol] = bar ? bar.close : prices[symbol];
      }

      // Update positions
      let totalEquity = portfolio.cash;
      for (const [symbol, position] of Object.entries(portfolio.positions)) {
        position.currentPrice = prices[symbol];
        position.value = position.shares * position.currentPrice;
        position.unrealizedPnL = position.value - (position.shares * position.purchasePrice);
        totalEquity += position.value;
      }

      results.equityHistory.push(totalEquity);

      // Execute strategy if provided
      if (config.strategy && barIndex > 0) {
        const orders = config.strategy(prices, portfolio);
        if (orders && orders.length > 0) {
          this.executeOrders(orders, portfolio, prices);
          results.trades.push(...orders);
        }
      }

      // Check rebalancing
      if (config.rebalanceConfig && this.shouldRebalance(barIndex, config.rebalanceConfig)) {
        this.rebalancePortfolio(portfolio, config.allocation, prices);
        results.correlations[date] = this.calculateCorrelations(
          historicalData,
          barIndex,
          config.lookbackPeriod || 30
        );
      }

      results.positions.push(this.serializePositions(portfolio, date));
    }

    return results;
  }

  /**
   * Calculate portfolio-level metrics
   * @private
   */
  calculatePortfolioMetrics(results) {
    const equity = results.equityHistory;
    const startValue = equity[0];
    const endValue = equity[equity.length - 1];

    // Basic metrics
    const totalReturn = ((endValue - startValue) / startValue) * 100;
    const annualizedReturn = totalReturn / (equity.length / 252);

    // Risk metrics
    const returns = this.calculateReturns(equity);
    const volatility = this.calculateStd(returns) * Math.sqrt(252);
    const maxDrawdown = this.calculateMaxDrawdown(equity);
    const sharpeRatio = (annualizedReturn / volatility) * Math.sqrt(252);

    // Downside deviation for Sortino ratio
    const downside = returns.filter(r => r < 0);
    const downsideDeviation = downside.length > 0
      ? Math.sqrt(downside.reduce((sum, r) => sum + r * r, 0) / downside.length) * Math.sqrt(252)
      : 0;
    const sortinoRatio = downsideDeviation > 0 ? (annualizedReturn / downsideDeviation) * Math.sqrt(252) : 0;

    // Trade metrics
    const trades = results.trades || [];
    const winningTrades = trades.filter(t => t.pnL >= 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

    return {
      totalReturn,
      annualizedReturn,
      volatility,
      maxDrawdown,
      sharpeRatio,
      sortinoRatio,
      winRate,
      totalTrades: trades.length,
      profitFactor: this.calculateProfitFactor(trades),
      calmarRatio: Math.abs(maxDrawdown) > 0 ? annualizedReturn / Math.abs(maxDrawdown) : 0
    };
  }

  /**
   * Calculate correlation matrix between assets
   * @private
   */
  calculateCorrelations(historicalData, upToIndex, lookbackPeriod) {
    const symbols = Object.keys(historicalData);
    const correlations = {};

    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const symbol1 = symbols[i];
        const symbol2 = symbols[j];

        const startIndex = Math.max(0, upToIndex - lookbackPeriod);
        const data1 = historicalData[symbol1].slice(startIndex, upToIndex + 1);
        const data2 = historicalData[symbol2].slice(startIndex, upToIndex + 1);

        const returns1 = data1.map((d, i) => i === 0 ? 0 : (d.close - data1[i - 1].close) / data1[i - 1].close);
        const returns2 = data2.map((d, i) => i === 0 ? 0 : (d.close - data2[i - 1].close) / data2[i - 1].close);

        const correlation = this.calculatePearsonCorrelation(returns1, returns2);
        correlations[`${symbol1}_${symbol2}`] = correlation;
      }
    }

    return correlations;
  }

  /**
   * Helper: Calculate Pearson correlation
   * @private
   */
  calculatePearsonCorrelation(x, y) {
    const n = Math.min(x.length, y.length);
    const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let sumX = 0;
    let sumY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      sumX += dx * dx;
      sumY += dy * dy;
    }

    const denominator = Math.sqrt(sumX * sumY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Should portfolio be rebalanced at this bar?
   * @private
   */
  shouldRebalance(barIndex, rebalanceConfig) {
    if (!rebalanceConfig) return false;
    if (rebalanceConfig.frequency === 'monthly') return barIndex % 21 === 0;
    if (rebalanceConfig.frequency === 'quarterly') return barIndex % 63 === 0;
    if (rebalanceConfig.frequency === 'yearly') return barIndex % 252 === 0;
    return false;
  }

  /**
   * Rebalance portfolio to target allocation
   * @private
   */
  rebalancePortfolio(portfolio, allocation, prices) {
    let totalValue = portfolio.cash;
    for (const position of Object.values(portfolio.positions)) {
      totalValue += position.value;
    }

    for (const [symbol, targetPercentage] of Object.entries(allocation)) {
      const targetValue = totalValue * (targetPercentage / 100);
      const currentValue = portfolio.positions[symbol].value;
      const difference = targetValue - currentValue;

      if (Math.abs(difference) > 0.01) {
        portfolio.positions[symbol].shares = targetValue / prices[symbol];
        portfolio.positions[symbol].value = targetValue;
      }
    }

    portfolio.rebalanceHistory.push({
      date: new Date(),
      allocation
    });
  }

  /**
   * Execute buy/sell orders
   * @private
   */
  executeOrders(orders, portfolio, prices) {
    for (const order of orders) {
      const { symbol, side, quantity } = order;
      if (!portfolio.positions[symbol]) continue;

      const price = prices[symbol];
      const cost = quantity * price;

      if (side === 'BUY') {
        portfolio.positions[symbol].shares += quantity;
        portfolio.cash -= cost;
      } else if (side === 'SELL') {
        portfolio.positions[symbol].shares -= quantity;
        portfolio.cash += cost;
      }

      portfolio.tradeHistory.push({
        symbol,
        side,
        quantity,
        price,
        date: new Date()
      });
    }
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  /**
   * Calculate daily returns
   * @private
   */
  calculateReturns(equity) {
    const returns = [];
    for (let i = 1; i < equity.length; i++) {
      returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
    }
    return returns;
  }

  /**
   * Calculate standard deviation
   * @private
   */
  calculateStd(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate maximum drawdown
   * @private
   */
  calculateMaxDrawdown(equity) {
    let maxValue = equity[0];
    let maxDrawdown = 0;

    for (let i = 1; i < equity.length; i++) {
      maxValue = Math.max(maxValue, equity[i]);
      const drawdown = (equity[i] - maxValue) / maxValue;
      maxDrawdown = Math.min(maxDrawdown, drawdown);
    }

    return maxDrawdown * 100;
  }

  /**
   * Calculate profit factor
   * @private
   */
  calculateProfitFactor(trades) {
    const gains = trades.filter(t => t.pnL >= 0).reduce((sum, t) => sum + (t.pnL || 0), 0);
    const losses = Math.abs(trades.filter(t => t.pnL < 0).reduce((sum, t) => sum + (t.pnL || 0), 0));
    return losses > 0 ? gains / losses : gains > 0 ? Infinity : 0;
  }

  /**
   * Serialize positions for output
   * @private
   */
  serializePositions(portfolio, date) {
    return {
      date,
      positions: Object.entries(portfolio.positions).map(([symbol, pos]) => ({
        symbol,
        shares: pos.shares,
        value: pos.value,
        allocation: (pos.value / portfolio.totalCapital) * 100
      }))
    };
  }

  /**
   * Get backtest by ID
   */
  getBacktest(backtestId) {
    return this.backtests.get(backtestId);
  }

  /**
   * List all backtests
   */
  listBacktests() {
    return Array.from(this.backtests.values());
  }
}

module.exports = MultiAssetBacktestEngine;
