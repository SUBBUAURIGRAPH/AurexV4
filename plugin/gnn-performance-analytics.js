/**
 * GNN Performance Analytics - Trading Performance Analysis
 *
 * Provides detailed performance analysis including:
 * - Trade-level analysis (win rate, profit factor, expectancy)
 * - Period comparison (daily, weekly, monthly, yearly)
 * - Strategy performance decomposition
 * - Consistency and reliability metrics
 * - Performance attribution and trending
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

class GNNPerformanceAnalytics {
  constructor(analyticsEngine, options = {}) {
    this.analyticsEngine = analyticsEngine;
    this.config = {
      minTradesForStats: options.minTradesForStats || 10,
      consistencyWindow: options.consistencyWindow || 252, // Trading days
      ...options
    };

    this.cache = new Map();
    this.stats = {
      analysesPerformed: 0,
      errorsEncountered: 0,
      lastAnalysis: null
    };
  }

  // ============================================================================
  // TRADE-LEVEL ANALYSIS
  // ============================================================================

  /**
   * Analyze trades to calculate win metrics
   * @param {Array} trades - Trade data [{entry, exit, shares, entryTime, exitTime, status}, ...]
   * @returns {Object} Trade analysis
   */
  analyzeTrades(trades) {
    if (!Array.isArray(trades) || trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        breakEvenTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        expectancy: 0,
        largestWin: 0,
        largestLoss: 0
      };
    }

    let winningTrades = 0;
    let losingTrades = 0;
    let breakEvenTrades = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let largestWin = 0;
    let largestLoss = 0;
    const tradeResults = [];

    trades.forEach(trade => {
      const pnl = (trade.exit - trade.entry) * trade.shares;
      const returnPct = (trade.exit - trade.entry) / trade.entry;
      tradeResults.push(pnl);

      if (pnl > 0) {
        winningTrades++;
        totalWins += pnl;
        largestWin = Math.max(largestWin, pnl);
      } else if (pnl < 0) {
        losingTrades++;
        totalLosses += Math.abs(pnl);
        largestLoss = Math.min(largestLoss, pnl);
      } else {
        breakEvenTrades++;
      }
    });

    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;
    const avgWin = winningTrades > 0 ? totalWins / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? totalLosses / losingTrades : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? Infinity : 0);
    const expectancy = totalTrades > 0 ? (totalWins - totalLosses) / totalTrades : 0;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      breakEvenTrades,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      expectancy,
      largestWin,
      largestLoss: Math.abs(largestLoss),
      tradeResults
    };
  }

  /**
   * Calculate consecutive trades metrics
   * @param {Array} trades - Trade data
   * @returns {Object} Consecutive metrics
   */
  calculateConsecutiveMetrics(trades) {
    if (!Array.isArray(trades) || trades.length === 0) {
      return {
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
        currentStreak: 0,
        streakType: 'none'
      };
    }

    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentConsecutiveWins = 0;
    let currentConsecutiveLosses = 0;
    let currentStreak = 0;
    let streakType = 'none';

    trades.forEach(trade => {
      const pnl = (trade.exit - trade.entry) * trade.shares;

      if (pnl > 0) {
        currentConsecutiveWins++;
        currentConsecutiveLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentConsecutiveWins);
        currentStreak = currentConsecutiveWins;
        streakType = 'wins';
      } else if (pnl < 0) {
        currentConsecutiveLosses++;
        currentConsecutiveWins = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentConsecutiveLosses);
        currentStreak = currentConsecutiveLosses;
        streakType = 'losses';
      }
    });

    return {
      maxConsecutiveWins,
      maxConsecutiveLosses,
      currentStreak,
      streakType
    };
  }

  /**
   * Calculate distribution of returns
   * @param {Array} trades - Trade data
   * @returns {Object} Distribution analysis
   */
  calculateReturnDistribution(trades) {
    if (!Array.isArray(trades) || trades.length === 0) {
      return { mean: 0, median: 0, stdDev: 0, skewness: 0, kurtosis: 0 };
    }

    const returns = trades.map(t => (t.exit - t.entry) / t.entry);
    const sorted = [...returns].sort((a, b) => a - b);

    // Mean
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;

    // Median
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    // Standard deviation
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Skewness
    const skewness = returns.length > 2
      ? returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 3), 0) / returns.length
      : 0;

    // Kurtosis
    const kurtosis = returns.length > 3
      ? returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 4), 0) / returns.length - 3
      : 0;

    return { mean, median, stdDev, skewness, kurtosis, min: sorted[0], max: sorted[sorted.length - 1] };
  }

  // ============================================================================
  // PERIOD PERFORMANCE ANALYSIS
  // ============================================================================

  /**
   * Analyze performance by period (daily, weekly, monthly, yearly)
   * @param {Array} returns - Daily returns
   * @param {Array} timestamps - Corresponding timestamps
   * @param {string} period - 'daily', 'weekly', 'monthly', 'yearly'
   * @returns {Object} Period performance
   */
  analyzePerformanceByPeriod(returns, timestamps, period = 'monthly') {
    if (!Array.isArray(returns) || returns.length === 0) return {};

    const periodMap = new Map();
    const multiplier = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      yearly: 365
    }[period] || 1;

    returns.forEach((ret, i) => {
      const date = new Date(timestamps[i]);
      let key;

      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const week = Math.floor(date.getDate() / 7);
          key = `${date.getFullYear()}-W${week}`;
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'yearly':
          key = date.getFullYear().toString();
          break;
        default:
          key = 'unknown';
      }

      if (!periodMap.has(key)) {
        periodMap.set(key, []);
      }
      periodMap.get(key).push(ret);
    });

    const analysis = {};
    periodMap.forEach((periodReturns, key) => {
      const totalReturn = periodReturns.reduce((a, b) => a + b, 0);
      const avgReturn = totalReturn / periodReturns.length;
      const variance = periodReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / periodReturns.length;
      const stdDev = Math.sqrt(variance);

      analysis[key] = {
        returns: periodReturns,
        totalReturn,
        avgReturn,
        stdDev,
        count: periodReturns.length,
        sharpeRatio: stdDev > 0 ? avgReturn / stdDev : 0
      };
    });

    return analysis;
  }

  /**
   * Calculate month-by-month returns table
   * @param {Array} prices - Historical prices
   * @param {Array} timestamps - Corresponding timestamps
   * @returns {Object} Month-year returns
   */
  calculateMonthlyReturnsTable(prices, timestamps) {
    if (!Array.isArray(prices) || prices.length === 0) return {};

    const monthlyMap = new Map();

    for (let i = 1; i < prices.length; i++) {
      const date = new Date(timestamps[i]);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const monthReturn = (prices[i] - prices[i - 1]) / prices[i - 1];

      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, []);
      }
      monthlyMap.get(key).push(monthReturn);
    }

    const table = {};
    monthlyMap.forEach((returns, key) => {
      const totalReturn = returns.reduce((a, b) => a + b, 0);
      table[key] = totalReturn;
    });

    return table;
  }

  // ============================================================================
  // CONSISTENCY AND RELIABILITY METRICS
  // ============================================================================

  /**
   * Calculate consistency metrics
   * @param {Array} returns - Daily returns
   * @param {number} window - Window size for rolling analysis
   * @returns {Object} Consistency metrics
   */
  calculateConsistencyMetrics(returns, window = this.config.consistencyWindow) {
    if (!Array.isArray(returns) || returns.length < window) {
      return { consistency: 0, reliability: 0, volatilityVariance: 0 };
    }

    const rollingVolatilities = [];
    for (let i = window; i <= returns.length; i++) {
      const windowReturns = returns.slice(i - window, i);
      const avg = windowReturns.reduce((a, b) => a + b, 0) / windowReturns.length;
      const variance = windowReturns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / windowReturns.length;
      rollingVolatilities.push(Math.sqrt(variance));
    }

    const avgVolatility = rollingVolatilities.reduce((a, b) => a + b, 0) / rollingVolatilities.length;
    const volatilityVariance = rollingVolatilities.reduce((sum, v) => sum + Math.pow(v - avgVolatility, 2), 0) / rollingVolatilities.length;
    const volatilityStdDev = Math.sqrt(volatilityVariance);

    const consistency = avgVolatility > 0 ? 1 - (volatilityStdDev / avgVolatility) : 0;
    const reliability = Math.max(0, consistency);

    return {
      consistency: Math.max(0, consistency),
      reliability,
      volatilityVariance,
      volatilityStdDev,
      avgVolatility
    };
  }

  /**
   * Calculate drawdown duration metrics
   * @param {Array} prices - Price series
   * @returns {Object} Drawdown duration analysis
   */
  calculateDrawdownDuration(prices) {
    if (!Array.isArray(prices) || prices.length < 2) {
      return { avgDrawdownDuration: 0, maxDrawdownDuration: 0, currentDrawdownDuration: 0 };
    }

    let maxPrice = prices[0];
    let currentDrawdownStart = null;
    let drawdownDurations = [];
    let currentDrawdownDuration = 0;

    for (let i = 1; i < prices.length; i++) {
      maxPrice = Math.max(maxPrice, prices[i]);

      if (prices[i] < maxPrice) {
        // In drawdown
        if (currentDrawdownStart === null) {
          currentDrawdownStart = i;
        }
        currentDrawdownDuration++;
      } else if (prices[i] >= maxPrice && currentDrawdownStart !== null) {
        // Out of drawdown
        drawdownDurations.push(currentDrawdownDuration);
        currentDrawdownStart = null;
        currentDrawdownDuration = 0;
      }
    }

    if (currentDrawdownStart !== null) {
      drawdownDurations.push(currentDrawdownDuration);
    }

    const avgDrawdownDuration = drawdownDurations.length > 0
      ? drawdownDurations.reduce((a, b) => a + b, 0) / drawdownDurations.length
      : 0;

    const maxDrawdownDuration = Math.max(...drawdownDurations, 0);

    return {
      avgDrawdownDuration,
      maxDrawdownDuration,
      currentDrawdownDuration,
      totalDrawdowns: drawdownDurations.length
    };
  }

  // ============================================================================
  // PERFORMANCE ATTRIBUTION
  // ============================================================================

  /**
   * Analyze performance contribution by strategy/signal
   * @param {Array} trades - Trade data with strategy info [{strategy, signal, pnl}, ...]
   * @returns {Object} Strategy contribution
   */
  analyzeStrategyContribution(trades) {
    if (!Array.isArray(trades) || trades.length === 0) return {};

    const strategyMap = new Map();

    trades.forEach(trade => {
      const strategy = trade.strategy || 'unknown';
      const pnl = trade.pnl || ((trade.exit - trade.entry) * trade.shares);

      if (!strategyMap.has(strategy)) {
        strategyMap.set(strategy, {
          trades: [],
          totalPnL: 0,
          winCount: 0,
          lossCount: 0,
          percentage: 0
        });
      }

      const stats = strategyMap.get(strategy);
      stats.trades.push(pnl);
      stats.totalPnL += pnl;
      if (pnl > 0) stats.winCount++;
      if (pnl < 0) stats.lossCount++;
    });

    const totalPnL = Array.from(strategyMap.values()).reduce((sum, s) => sum + s.totalPnL, 0);

    const contribution = {};
    strategyMap.forEach((stats, strategy) => {
      contribution[strategy] = {
        trades: stats.trades.length,
        totalPnL: stats.totalPnL,
        winRate: stats.trades.length > 0 ? stats.winCount / stats.trades.length : 0,
        avgPnL: stats.trades.length > 0 ? stats.totalPnL / stats.trades.length : 0,
        percentage: totalPnL !== 0 ? stats.totalPnL / totalPnL : 0
      };
    });

    return contribution;
  }

  /**
   * Calculate instrument-level performance
   * @param {Array} trades - Trade data with symbol info
   * @returns {Object} Performance by instrument
   */
  analyzeInstrumentPerformance(trades) {
    if (!Array.isArray(trades) || trades.length === 0) return {};

    const instrumentMap = new Map();

    trades.forEach(trade => {
      const symbol = trade.symbol || 'unknown';
      const pnl = trade.pnl || ((trade.exit - trade.entry) * trade.shares);

      if (!instrumentMap.has(symbol)) {
        instrumentMap.set(symbol, {
          trades: [],
          totalPnL: 0,
          winCount: 0,
          lossCount: 0
        });
      }

      const stats = instrumentMap.get(symbol);
      stats.trades.push(pnl);
      stats.totalPnL += pnl;
      if (pnl > 0) stats.winCount++;
      if (pnl < 0) stats.lossCount++;
    });

    const performance = {};
    instrumentMap.forEach((stats, symbol) => {
      performance[symbol] = {
        trades: stats.trades.length,
        totalPnL: stats.totalPnL,
        winRate: stats.trades.length > 0 ? stats.winCount / stats.trades.length : 0,
        avgPnL: stats.trades.length > 0 ? stats.totalPnL / stats.trades.length : 0,
        profitFactor: stats.lossCount > 0
          ? stats.trades.filter(p => p > 0).reduce((a, b) => a + b, 0) / Math.abs(stats.trades.filter(p => p < 0).reduce((a, b) => a + b, 0))
          : (stats.totalPnL > 0 ? Infinity : 0)
      };
    });

    return performance;
  }

  // ============================================================================
  // COMPREHENSIVE PERFORMANCE REPORT
  // ============================================================================

  /**
   * Generate comprehensive performance report
   * @param {Object} performanceData - Performance data
   * @returns {Object} Complete performance report
   */
  generatePerformanceReport(performanceData) {
    const report = {
      timestamp: new Date(),
      summary: {},
      trades: {},
      periods: {},
      consistency: {},
      attribution: {},
      quality: {}
    };

    try {
      // Trade analysis
      if (performanceData.trades) {
        report.trades = this.analyzeTrades(performanceData.trades);
        report.trades.consecutive = this.calculateConsecutiveMetrics(performanceData.trades);
        report.trades.distribution = this.calculateReturnDistribution(performanceData.trades);
      }

      // Period analysis
      if (performanceData.returns && performanceData.timestamps) {
        report.periods = {
          monthly: this.analyzePerformanceByPeriod(performanceData.returns, performanceData.timestamps, 'monthly'),
          quarterly: this.analyzePerformanceByPeriod(performanceData.returns, performanceData.timestamps, 'yearly')
        };
      }

      // Consistency metrics
      if (performanceData.returns) {
        report.consistency = this.calculateConsistencyMetrics(performanceData.returns);
        report.consistency.drawdownDuration = this.calculateDrawdownDuration(performanceData.prices || []);
      }

      // Attribution
      if (performanceData.trades) {
        report.attribution.strategy = this.analyzeStrategyContribution(performanceData.trades);
        report.attribution.instrument = this.analyzeInstrumentPerformance(performanceData.trades);
      }

      // Generate summary
      if (report.trades.totalTrades > 0) {
        report.summary = {
          totalTrades: report.trades.totalTrades,
          winRate: report.trades.winRate,
          profitFactor: report.trades.profitFactor,
          expectancy: report.trades.expectancy,
          maxConsecutiveWins: report.trades.consecutive.maxConsecutiveWins,
          maxConsecutiveLosses: report.trades.consecutive.maxConsecutiveLosses
        };
      }

      this.stats.analysesPerformed++;
      this.stats.lastAnalysis = new Date();

      return report;
    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Performance analysis error:', error);
      return report;
    }
  }

  /**
   * Get analytics statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return this.stats;
  }
}

module.exports = GNNPerformanceAnalytics;
