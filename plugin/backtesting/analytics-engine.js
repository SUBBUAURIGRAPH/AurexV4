/**
 * Analytics Engine
 * Comprehensive performance and risk analysis for backtest results
 *
 * Features:
 * - Advanced performance metrics (Sharpe, Sortino, Calmar, Information Ratio)
 * - Risk analytics (VaR, CVaR, Beta)
 * - Distribution analysis (Skewness, Kurtosis)
 * - Trade-level analytics
 * - Comparison capabilities
 */

/**
 * AnalyticsEngine
 * Calculates comprehensive performance and risk metrics
 */
class AnalyticsEngine {
  constructor(config = {}) {
    this.riskFreeRate = config.riskFreeRate || 0.02; // 2% annual
    this.targetReturn = config.targetReturn || 0.0; // For Sortino ratio
    this.confidenceLevel = config.confidenceLevel || 0.95; // For VaR/CVaR
    this.logger = config.logger || console;
  }

  /**
   * Calculate comprehensive metrics from backtest result
   * @param {Object} backtestResult - Result from BacktestingEngine
   * @returns {Object} Comprehensive metrics
   */
  calculateMetrics(backtestResult) {
    try {
      const { trades, equityCurve, initialCapital, finalEquity } = backtestResult;

      if (!equityCurve || equityCurve.length === 0) {
        return this.getEmptyMetrics();
      }

      // Calculate returns array
      const returns = this.calculateReturns(equityCurve);
      if (returns.length === 0) {
        return this.getEmptyMetrics();
      }

      // Basic metrics
      const basicMetrics = {
        totalReturn: backtestResult.totalReturn || 0,
        annualizedReturn: backtestResult.annualizedReturn || 0,
        netProfit: finalEquity - initialCapital,
        initialCapital,
        finalEquity,
        duration: backtestResult.duration || 0
      };

      // Volatility and risk metrics
      const volatilityMetrics = this.calculateVolatilityMetrics(returns, basicMetrics.duration);

      // Advanced Sharpe-family ratios
      const sharpeMetrics = {
        sharpeRatio: this.calculateSharpeRatio(returns, this.riskFreeRate),
        sortinoRatio: this.calculateSortinoRatio(returns, this.targetReturn),
        calmarRatio: backtestResult.calmarRatio || 0,
        informationRatio: this.calculateInformationRatio(returns)
      };

      // Drawdown analysis
      const drawdownMetrics = this.calculateDrawdownMetrics(equityCurve);

      // Risk metrics (VaR, CVaR)
      const riskMetrics = {
        var95: this.calculateVaR(returns, 0.95),
        var99: this.calculateVaR(returns, 0.99),
        cvar95: this.calculateCVaR(returns, 0.95),
        cvar99: this.calculateCVaR(returns, 0.99)
      };

      // Distribution metrics
      const distributionMetrics = {
        skewness: this.calculateSkewness(returns),
        kurtosis: this.calculateKurtosis(returns),
        jarqueBeraTest: this.jarqueBeraTest(returns)
      };

      // Trade statistics
      const tradeMetrics = this.calculateTradeMetrics(trades);

      // Efficiency metrics
      const efficiencyMetrics = {
        recoveryFactor: this.calculateRecoveryFactor(basicMetrics.netProfit, drawdownMetrics.maxDrawdown),
        profitFactor: backtestResult.profitFactor || 0,
        winRate: backtestResult.winRate || 0,
        expectancy: this.calculateExpectancy(trades)
      };

      return {
        ...basicMetrics,
        ...volatilityMetrics,
        ...sharpeMetrics,
        ...drawdownMetrics,
        ...riskMetrics,
        ...distributionMetrics,
        ...tradeMetrics,
        ...efficiencyMetrics,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Error calculating metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  /**
   * Calculate daily returns
   * @param {Array} equityCurve - Equity history
   * @returns {Array} Daily returns as decimals
   */
  calculateReturns(equityCurve) {
    const returns = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const ret = (equityCurve[i].equity - equityCurve[i-1].equity) / equityCurve[i-1].equity;
      returns.push(ret);
    }
    return returns;
  }

  /**
   * Calculate volatility and related metrics
   */
  calculateVolatilityMetrics(returns, durationDays = 252) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;

    // Daily variance and volatility
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const dailyVolatility = Math.sqrt(variance);
    const annualizedVolatility = dailyVolatility * Math.sqrt(252);

    // Calculate beta (correlation * (std_dev_returns / std_dev_market))
    // Simplified beta = correlation * (volatility / market_volatility)
    // For now, we'll use a simplified calculation
    const beta = this.calculateBeta(returns);

    return {
      dailyVolatility: parseFloat(dailyVolatility.toFixed(4)),
      annualizedVolatility: parseFloat(annualizedVolatility.toFixed(4)),
      variance: parseFloat(variance.toFixed(6)),
      beta: parseFloat(beta.toFixed(4))
    };
  }

  /**
   * Calculate Sharpe Ratio
   * (Return - Risk-Free Rate) / Standard Deviation
   */
  calculateSharpeRatio(returns, riskFreeRate = 0.02) {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const excessReturn = (mean * 252) - riskFreeRate;
    const sharpeRatio = excessReturn / (stdDev * Math.sqrt(252));

    return parseFloat(sharpeRatio.toFixed(3));
  }

  /**
   * Calculate Sortino Ratio
   * (Return - Target Return) / Downside Deviation
   */
  calculateSortinoRatio(returns, targetReturn = 0.0) {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const annualizedReturn = mean * 252;

    // Calculate downside deviation (only negative returns)
    const downSideVariance = returns
      .filter(r => r < targetReturn)
      .reduce((sum, r) => sum + Math.pow(r - targetReturn, 2), 0) / returns.length;

    const downSideDeviation = Math.sqrt(downSideVariance);

    if (downSideDeviation === 0) return 0;

    const excessReturn = annualizedReturn - targetReturn;
    const sortinoRatio = excessReturn / (downSideDeviation * Math.sqrt(252));

    return parseFloat(sortinoRatio.toFixed(3));
  }

  /**
   * Calculate Information Ratio
   * (Strategy Return - Benchmark Return) / Tracking Error
   */
  calculateInformationRatio(returns, benchmarkReturns = null) {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;

    if (!benchmarkReturns || benchmarkReturns.length === 0) {
      // If no benchmark, use 0% as benchmark
      benchmarkReturns = Array(returns.length).fill(0);
    }

    const trackingError = this.calculateTrackingError(returns, benchmarkReturns);

    if (trackingError === 0) return 0;

    const excessReturn = (mean * 252);
    const informationRatio = excessReturn / trackingError;

    return parseFloat(informationRatio.toFixed(3));
  }

  /**
   * Calculate Calmar Ratio
   * Annual Return / Maximum Drawdown
   */
  calculateCalmarRatio(annualizedReturn, maxDrawdown) {
    if (maxDrawdown === 0 || maxDrawdown === undefined) return 0;
    return parseFloat((annualizedReturn / Math.abs(maxDrawdown)).toFixed(3));
  }

  /**
   * Calculate drawdown metrics
   */
  calculateDrawdownMetrics(equityCurve) {
    let maxDrawdown = 0;
    let maxDrawdownDate = null;
    let peak = equityCurve[0]?.equity || 0;
    let peakDate = equityCurve[0]?.date;

    for (const point of equityCurve) {
      const drawdown = (point.equity - peak) / peak;

      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownDate = point.date;
      }

      if (point.equity > peak) {
        peak = point.equity;
        peakDate = point.date;
      }
    }

    // Calculate recovery time (days to return to peak)
    let recoveryTime = 0;
    if (maxDrawdownDate && peakDate && maxDrawdownDate > peakDate) {
      recoveryTime = Math.floor((equityCurve[equityCurve.length - 1].date - maxDrawdownDate) / (1000 * 60 * 60 * 24));
    }

    return {
      maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
      maxDrawdownDate,
      drawdownDuration: recoveryTime,
      averageDrawdown: this.calculateAverageDrawdown(equityCurve)
    };
  }

  /**
   * Calculate average drawdown
   */
  calculateAverageDrawdown(equityCurve) {
    let totalDrawdown = 0;
    let drawdownDays = 0;
    let peak = equityCurve[0]?.equity || 0;

    for (const point of equityCurve) {
      const drawdown = (point.equity - peak) / peak;

      if (drawdown < 0) {
        totalDrawdown += Math.abs(drawdown);
        drawdownDays++;
      }

      if (point.equity > peak) {
        peak = point.equity;
      }
    }

    return drawdownDays > 0 ? parseFloat((totalDrawdown / drawdownDays * 100).toFixed(2)) : 0;
  }

  /**
   * Calculate Value at Risk (VaR)
   * Parametric VaR using normal distribution
   */
  calculateVaR(returns, confidence = 0.95) {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Z-score for confidence levels
    const zScores = {
      0.90: -1.282,
      0.95: -1.645,
      0.99: -2.326
    };

    const zScore = zScores[confidence] || -1.645;
    const var_ = mean + (zScore * stdDev);

    return parseFloat((var_ * 100).toFixed(2));
  }

  /**
   * Calculate Conditional Value at Risk (CVaR) / Expected Shortfall
   * Average of returns worse than VaR
   */
  calculateCVaR(returns, confidence = 0.95) {
    if (returns.length === 0) return 0;

    const var_ = this.calculateVaR(returns, confidence) / 100;
    const worstReturns = returns.filter(r => r < var_);

    if (worstReturns.length === 0) {
      return var_ * 100;
    }

    const cvar = worstReturns.reduce((a, b) => a + b, 0) / worstReturns.length;

    return parseFloat((cvar * 100).toFixed(2));
  }

  /**
   * Calculate Skewness
   * Measures asymmetry of return distribution
   */
  calculateSkewness(returns) {
    if (returns.length < 3) return 0;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const m3 = returns.reduce((sum, r) => sum + Math.pow(r - mean, 3), 0) / returns.length;
    const skewness = m3 / Math.pow(stdDev, 3);

    return parseFloat(skewness.toFixed(4));
  }

  /**
   * Calculate Kurtosis
   * Measures tail heaviness of return distribution
   */
  calculateKurtosis(returns) {
    if (returns.length < 4) return 0;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const m4 = returns.reduce((sum, r) => sum + Math.pow(r - mean, 4), 0) / returns.length;
    const kurtosis = (m4 / Math.pow(stdDev, 4)) - 3; // Excess kurtosis

    return parseFloat(kurtosis.toFixed(4));
  }

  /**
   * Jarque-Bera Test for normality
   */
  jarqueBeraTest(returns) {
    const n = returns.length;
    const skewness = this.calculateSkewness(returns);
    const kurtosis = this.calculateKurtosis(returns);

    const jb = (n / 6) * (Math.pow(skewness, 2) + (Math.pow(kurtosis, 2) / 4));

    // Chi-square critical value at 0.05 significance = 5.99
    const isNormal = jb < 5.99;

    return {
      statistic: parseFloat(jb.toFixed(4)),
      isNormal,
      pValue: 1 - this.chi2CDF(jb, 2) // Approximate
    };
  }

  /**
   * Calculate Beta (vs market)
   */
  calculateBeta(returns, marketReturns = null) {
    if (!marketReturns || marketReturns.length === 0) {
      // Use S&P 500 approximation (14% annual return, 18% volatility)
      return 1.0; // Neutral beta
    }

    const covarianceXY = this.calculateCovariance(returns, marketReturns);
    const varianceY = marketReturns.reduce((sum, r) => {
      const mean = marketReturns.reduce((a, b) => a + b, 0) / marketReturns.length;
      return sum + Math.pow(r - mean, 2);
    }, 0) / marketReturns.length;

    return varianceY !== 0 ? covarianceXY / varianceY : 1.0;
  }

  /**
   * Calculate trade-level metrics
   */
  calculateTradeMetrics(trades) {
    if (!trades || trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        largestWin: 0,
        largestLoss: 0,
        avgHoldingDays: 0,
        consecutiveWins: 0,
        consecutiveLosses: 0,
        profitFactor: 0,
        expectancy: 0
      };
    }

    const winningTrades = trades.filter(t => t.netPnL > 0);
    const losingTrades = trades.filter(t => t.netPnL <= 0);

    const totalWins = winningTrades.reduce((sum, t) => sum + t.netPnL, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnL, 0));

    // Calculate consecutive wins/losses
    let maxConsecWins = 0;
    let maxConsecLosses = 0;
    let currentConsecWins = 0;
    let currentConsecLosses = 0;

    for (const trade of trades) {
      if (trade.netPnL > 0) {
        currentConsecWins++;
        currentConsecLosses = 0;
        maxConsecWins = Math.max(maxConsecWins, currentConsecWins);
      } else {
        currentConsecLosses++;
        currentConsecWins = 0;
        maxConsecLosses = Math.max(maxConsecLosses, currentConsecLosses);
      }
    }

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: parseFloat(((winningTrades.length / trades.length) * 100).toFixed(2)),
      avgWin: parseFloat((totalWins / (winningTrades.length || 1)).toFixed(2)),
      avgLoss: parseFloat((totalLosses / (losingTrades.length || 1)).toFixed(2)),
      largestWin: Math.max(...trades.map(t => t.netPnL), 0),
      largestLoss: Math.min(...trades.map(t => t.netPnL), 0),
      avgHoldingDays: parseFloat((trades.reduce((sum, t) => sum + (t.holdingPeriod || 0), 0) / trades.length).toFixed(0)),
      consecutiveWins: maxConsecWins,
      consecutiveLosses: maxConsecLosses,
      profitFactor: totalLosses > 0 ? parseFloat((totalWins / totalLosses).toFixed(2)) : (totalWins > 0 ? 99.99 : 0)
    };
  }

  /**
   * Calculate expectancy (average profit per trade)
   */
  calculateExpectancy(trades) {
    if (!trades || trades.length === 0) return 0;

    const totalPnL = trades.reduce((sum, t) => sum + (t.netPnL || 0), 0);
    return parseFloat((totalPnL / trades.length).toFixed(2));
  }

  /**
   * Calculate Recovery Factor
   * Net Profit / Maximum Drawdown
   */
  calculateRecoveryFactor(netProfit, maxDrawdown) {
    if (maxDrawdown === 0 || Math.abs(maxDrawdown) < 0.0001) return 0;
    return parseFloat((netProfit / Math.abs(maxDrawdown)).toFixed(2));
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Calculate covariance between two return series
   */
  calculateCovariance(returns1, returns2) {
    const len = Math.min(returns1.length, returns2.length);
    const mean1 = returns1.reduce((a, b) => a + b, 0) / len;
    const mean2 = returns2.reduce((a, b) => a + b, 0) / len;

    let covariance = 0;
    for (let i = 0; i < len; i++) {
      covariance += (returns1[i] - mean1) * (returns2[i] - mean2);
    }

    return covariance / len;
  }

  /**
   * Calculate tracking error vs benchmark
   */
  calculateTrackingError(returns, benchmarkReturns) {
    if (benchmarkReturns.length !== returns.length) {
      return 0;
    }

    const differences = returns.map((r, i) => r - benchmarkReturns[i]);
    const variance = differences.reduce((sum, d) => sum + Math.pow(d, 2), 0) / differences.length;

    return Math.sqrt(variance) * Math.sqrt(252);
  }

  /**
   * Chi-square CDF approximation
   */
  chi2CDF(x, k) {
    // Simplified approximation
    if (x <= 0) return 0;
    if (x > 20) return 1;

    // Use approximation for small values
    return 1 - Math.exp(-x / 2) * (1 + x / (2 * k));
  }

  /**
   * Get empty metrics object
   */
  getEmptyMetrics() {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      netProfit: 0,
      initialCapital: 0,
      finalEquity: 0,
      duration: 0,
      dailyVolatility: 0,
      annualizedVolatility: 0,
      variance: 0,
      beta: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      informationRatio: 0,
      maxDrawdown: 0,
      drawdownDuration: 0,
      averageDrawdown: 0,
      var95: 0,
      var99: 0,
      cvar95: 0,
      cvar99: 0,
      skewness: 0,
      kurtosis: 0,
      totalTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0
    };
  }
}

module.exports = AnalyticsEngine;
