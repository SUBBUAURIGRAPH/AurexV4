/**
 * Performance Metrics Calculator
 * Calculates Sharpe ratio and other financial performance metrics
 *
 * Metrics:
 * - Sharpe Ratio
 * - Sortino Ratio
 * - Calmar Ratio
 * - Information Ratio
 * - Maximum Drawdown
 * - Win Rate
 * - Profit Factor
 */

const EventEmitter = require('events');

/**
 * Performance Metrics Calculator
 */
class PerformanceMetricsCalculator extends EventEmitter {
  constructor(config = {}) {
    super();

    this.logger = config.logger || console;
    this.riskFreeRate = config.riskFreeRate || 0.02;  // 2% annual
  }

  /**
   * Calculate comprehensive performance metrics
   * @param {Array} returns - Daily returns (as decimals)
   * @param {Array} prices - Daily closing prices
   * @returns {Object} Comprehensive metrics
   */
  calculateMetrics(returns, prices) {
    try {
      if (!returns || returns.length < 2 || !prices || prices.length < 2) {
        throw new Error('Need at least 2 data points');
      }

      const dailyRiskFreeRate = this.riskFreeRate / 252;

      // Calculate basic metrics
      const totalReturn = this.calculateTotalReturn(prices);
      const annualizedReturn = this.calculateAnnualizedReturn(returns);
      const volatility = this.calculateVolatility(returns);
      const downside = this.calculateDownsideDeviation(returns);

      // Calculate Sharpe Ratio
      const sharpeRatio = this.calculateSharpeRatio(returns, this.riskFreeRate);

      // Calculate Sortino Ratio
      const sortinoRatio = this.calculateSortinoRatio(returns, this.riskFreeRate);

      // Calculate Maximum Drawdown
      const maxDrawdown = this.calculateMaxDrawdown(prices);

      // Calculate Calmar Ratio
      const calmarRatio = this.calculateCalmarRatio(annualizedReturn, maxDrawdown);

      // Calculate Win Rate
      const winRate = this.calculateWinRate(returns);

      // Calculate Profit Factor
      const profitFactor = this.calculateProfitFactor(returns);

      // Calculate consecutive wins/losses
      const consecutive = this.calculateConsecutiveWL(returns);

      // Calculate Information Ratio (vs buy-and-hold)
      const infoRatio = this.calculateInformationRatio(returns);

      // Calculate Treynor Ratio (simplified, assuming beta=1)
      const treynorRatio = this.calculateTreynorRatio(annualizedReturn, 1.0);

      // Compile all metrics
      const metrics = {
        returnMetrics: {
          totalReturn: Number(totalReturn.toFixed(4)),
          annualizedReturn: Number(annualizedReturn.toFixed(4)),
          dailyAvgReturn: Number((returns.reduce((a, b) => a + b) / returns.length).toFixed(4))
        },

        riskMetrics: {
          volatility: Number(volatility.toFixed(4)),
          annualizedVolatility: Number((volatility * Math.sqrt(252)).toFixed(4)),
          downside: Number(downside.toFixed(4)),
          annualizedDownside: Number((downside * Math.sqrt(252)).toFixed(4)),
          maxDrawdown: Number(maxDrawdown.toFixed(4)),
          currentDrawdown: Number(this.calculateCurrentDrawdown(prices).toFixed(4))
        },

        riskAdjustedMetrics: {
          sharpeRatio: Number(sharpeRatio.toFixed(3)),
          sortinoRatio: Number(sortinoRatio.toFixed(3)),
          calmarRatio: Number(calmarRatio.toFixed(3)),
          infoRatio: Number(infoRatio.toFixed(3)),
          treynorRatio: Number(treynorRatio.toFixed(3))
        },

        tradeMetrics: {
          winRate: Number(winRate.toFixed(2)),
          profitFactor: Number(profitFactor.toFixed(3)),
          consecutiveWins: consecutive.wins,
          consecutiveLosses: consecutive.losses,
          avgWin: Number(this.calculateAverageWin(returns).toFixed(4)),
          avgLoss: Number(this.calculateAverageLoss(returns).toFixed(4))
        },

        timestamp: new Date()
      };

      this.logger.info(`📊 Performance metrics calculated - Sharpe: ${sharpeRatio.toFixed(3)}`);
      this.emit('metrics:calculated', metrics);

      return metrics;
    } catch (error) {
      this.logger.error('Error calculating performance metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate total return
   * @private
   */
  calculateTotalReturn(prices) {
    if (!prices || prices.length < 2) return 0;
    return (prices[prices.length - 1] - prices[0]) / prices[0];
  }

  /**
   * Calculate annualized return
   * @private
   */
  calculateAnnualizedReturn(returns) {
    const dailyAvg = returns.reduce((a, b) => a + b) / returns.length;
    return (Math.pow(1 + dailyAvg, 252) - 1) * 100;
  }

  /**
   * Calculate volatility (standard deviation)
   * @private
   */
  calculateVolatility(returns) {
    const mean = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2)) / returns.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate downside deviation (only negative returns)
   * @private
   */
  calculateDownsideDeviation(returns) {
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return 0;

    const variance = negativeReturns.reduce((sum, r) => sum + r * r) / negativeReturns.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate Sharpe Ratio
   * @private
   */
  calculateSharpeRatio(returns, riskFreeRate) {
    const dailyRiskFreeRate = riskFreeRate / 252;
    const excessReturns = returns.map(r => r - dailyRiskFreeRate);
    const avgExcessReturn = excessReturns.reduce((a, b) => a + b) / excessReturns.length;
    const volatility = this.calculateVolatility(excessReturns);

    if (volatility === 0) return 0;
    return (avgExcessReturn * 252) / (volatility * Math.sqrt(252));
  }

  /**
   * Calculate Sortino Ratio
   * @private
   */
  calculateSortinoRatio(returns, riskFreeRate) {
    const dailyRiskFreeRate = riskFreeRate / 252;
    const excessReturns = returns.map(r => r - dailyRiskFreeRate);
    const avgExcessReturn = excessReturns.reduce((a, b) => a + b) / excessReturns.length;
    const downside = this.calculateDownsideDeviation(returns);

    if (downside === 0) return 0;
    return (avgExcessReturn * 252) / (downside * Math.sqrt(252));
  }

  /**
   * Calculate Maximum Drawdown
   * @private
   */
  calculateMaxDrawdown(prices) {
    let maxDrawdown = 0;
    let peak = prices[0];

    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > peak) {
        peak = prices[i];
      }

      const drawdown = (peak - prices[i]) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * Calculate current drawdown
   * @private
   */
  calculateCurrentDrawdown(prices) {
    let peak = prices[0];

    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > peak) {
        peak = prices[i];
      }
    }

    return (peak - prices[prices.length - 1]) / peak;
  }

  /**
   * Calculate Calmar Ratio
   * @private
   */
  calculateCalmarRatio(annualizedReturn, maxDrawdown) {
    if (maxDrawdown === 0) return 0;
    return (annualizedReturn / 100) / maxDrawdown;
  }

  /**
   * Calculate Information Ratio
   * @private
   */
  calculateInformationRatio(returns) {
    const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
    const trackingError = this.calculateVolatility(returns.map(r => r - avgReturn));

    if (trackingError === 0) return 0;
    return (avgReturn * 252) / (trackingError * Math.sqrt(252));
  }

  /**
   * Calculate Treynor Ratio
   * @private
   */
  calculateTreynorRatio(annualizedReturn, beta) {
    if (beta === 0) return 0;
    return (annualizedReturn / 100 - this.riskFreeRate) / beta;
  }

  /**
   * Calculate Win Rate
   * @private
   */
  calculateWinRate(returns) {
    const wins = returns.filter(r => r > 0).length;
    return (wins / returns.length) * 100;
  }

  /**
   * Calculate Profit Factor
   * @private
   */
  calculateProfitFactor(returns) {
    const profits = returns.filter(r => r > 0).reduce((a, b) => a + b, 0);
    const losses = Math.abs(returns.filter(r => r < 0).reduce((a, b) => a + b, 0));

    if (losses === 0) return profits > 0 ? Infinity : 0;
    return profits / losses;
  }

  /**
   * Calculate average win
   * @private
   */
  calculateAverageWin(returns) {
    const wins = returns.filter(r => r > 0);
    if (wins.length === 0) return 0;
    return wins.reduce((a, b) => a + b) / wins.length;
  }

  /**
   * Calculate average loss
   * @private
   */
  calculateAverageLoss(returns) {
    const losses = returns.filter(r => r < 0);
    if (losses.length === 0) return 0;
    return losses.reduce((a, b) => a + b) / losses.length;
  }

  /**
   * Calculate consecutive wins/losses
   * @private
   */
  calculateConsecutiveWL(returns) {
    let maxWins = 0;
    let currentWins = 0;
    let maxLosses = 0;
    let currentLosses = 0;

    for (const ret of returns) {
      if (ret > 0) {
        currentWins++;
        currentLosses = 0;
        maxWins = Math.max(maxWins, currentWins);
      } else if (ret < 0) {
        currentLosses++;
        currentWins = 0;
        maxLosses = Math.max(maxLosses, currentLosses);
      }
    }

    return {
      wins: maxWins,
      losses: maxLosses
    };
  }

  /**
   * Get performance summary
   * @param {Object} metrics - Performance metrics
   * @returns {string} Formatted summary
   */
  getSummary(metrics) {
    const m = metrics;
    let summary = '📈 Performance Summary\n';
    summary += '═══════════════════════════════════\n';
    summary += `Sharpe Ratio: ${m.riskAdjustedMetrics.sharpeRatio.toFixed(3)}\n`;
    summary += `Sortino Ratio: ${m.riskAdjustedMetrics.sortinoRatio.toFixed(3)}\n`;
    summary += `Calmar Ratio: ${m.riskAdjustedMetrics.calmarRatio.toFixed(3)}\n`;
    summary += `Win Rate: ${m.tradeMetrics.winRate.toFixed(2)}%\n`;
    summary += `Profit Factor: ${m.tradeMetrics.profitFactor.toFixed(3)}\n`;
    summary += `Max Drawdown: ${(m.riskMetrics.maxDrawdown * 100).toFixed(2)}%\n`;
    summary += `Annualized Return: ${m.returnMetrics.annualizedReturn.toFixed(2)}%\n`;
    return summary;
  }

  /**
   * Get performance quality rating
   * @param {Object} metrics - Performance metrics
   * @returns {string} Quality rating
   */
  getQualityRating(metrics) {
    const sharpe = metrics.riskAdjustedMetrics.sharpeRatio;

    if (sharpe >= 2.0) return 'EXCELLENT';
    if (sharpe >= 1.5) return 'VERY_GOOD';
    if (sharpe >= 1.0) return 'GOOD';
    if (sharpe >= 0.5) return 'FAIR';
    if (sharpe > 0) return 'POOR';
    return 'NEGATIVE';
  }

  /**
   * Compare two sets of metrics
   * @param {Object} metrics1 - First metric set
   * @param {Object} metrics2 - Second metric set
   * @returns {Object} Comparison
   */
  compareMetrics(metrics1, metrics2) {
    return {
      sharpeComparison: {
        metric1: metrics1.riskAdjustedMetrics.sharpeRatio,
        metric2: metrics2.riskAdjustedMetrics.sharpeRatio,
        winner: metrics1.riskAdjustedMetrics.sharpeRatio > metrics2.riskAdjustedMetrics.sharpeRatio ? 'metric1' : 'metric2'
      },
      returnComparison: {
        metric1: metrics1.returnMetrics.annualizedReturn,
        metric2: metrics2.returnMetrics.annualizedReturn,
        winner: metrics1.returnMetrics.annualizedReturn > metrics2.returnMetrics.annualizedReturn ? 'metric1' : 'metric2'
      },
      winRateComparison: {
        metric1: metrics1.tradeMetrics.winRate,
        metric2: metrics2.tradeMetrics.winRate,
        winner: metrics1.tradeMetrics.winRate > metrics2.tradeMetrics.winRate ? 'metric1' : 'metric2'
      }
    };
  }
}

// Export
module.exports = {
  PerformanceMetricsCalculator
};
