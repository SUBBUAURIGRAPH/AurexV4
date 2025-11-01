/**
 * GNN Analytics Engine - Advanced Analytics & Metrics Calculation
 *
 * Provides sophisticated analytics calculations including:
 * - Performance metrics (returns, Sharpe, Sortino, Calmar, information ratio, alpha/beta)
 * - Risk metrics (volatility, VaR, CVaR, max drawdown, recovery factor, Ulcer index)
 * - Attribution analysis (decomposition, strategy attribution, risk attribution)
 * - Execution analytics (slippage, fill rates, efficiency, market impact)
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

class GNNAnalyticsEngine {
  constructor(options = {}) {
    this.config = {
      riskFreeRate: options.riskFreeRate || 0.02, // 2% annual
      minPeriods: options.minPeriods || 20, // Minimum data points for metrics
      confidenceLevel: options.confidenceLevel || 0.95, // For VaR/CVaR
      rollingWindow: options.rollingWindow || 252, // Trading days
      ...options
    };

    this.metrics = {};
    this.cache = new Map();
    this.stats = {
      calculationsPerformed: 0,
      errorsEncountered: 0,
      cacheHits: 0,
      lastCalculation: null
    };
  }

  // ============================================================================
  // PERFORMANCE METRICS
  // ============================================================================

  /**
   * Calculate total returns
   * @param {Array} prices - Asset price series
   * @returns {number} Total return (decimal)
   */
  calculateTotalReturn(prices) {
    if (!Array.isArray(prices) || prices.length < 2) return 0;
    return (prices[prices.length - 1] - prices[0]) / prices[0];
  }

  /**
   * Calculate cumulative returns (daily)
   * @param {Array} prices - Asset price series
   * @returns {Array} Daily returns
   */
  calculateDailyReturns(prices) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  /**
   * Calculate annualized return
   * @param {Array} prices - Asset price series
   * @param {number} periods - Trading periods per year (default 252)
   * @returns {number} Annualized return
   */
  calculateAnnualizedReturn(prices, periods = 252) {
    if (!Array.isArray(prices) || prices.length < 2) return 0;
    const totalReturn = this.calculateTotalReturn(prices);
    const years = (prices.length - 1) / periods;
    if (years <= 0) return totalReturn;
    return Math.pow(1 + totalReturn, 1 / years) - 1;
  }

  /**
   * Calculate Sharpe Ratio
   * @param {Array} returns - Daily returns
   * @param {number} riskFreeRate - Annual risk-free rate (default from config)
   * @param {number} periods - Trading periods per year
   * @returns {number} Sharpe Ratio
   */
  calculateSharpeRatio(returns, riskFreeRate = this.config.riskFreeRate, periods = 252) {
    if (!Array.isArray(returns) || returns.length < this.config.minPeriods) return 0;

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const excessReturn = (avgReturn * periods) - riskFreeRate;
    const annualizedStdDev = stdDev * Math.sqrt(periods);

    return excessReturn / annualizedStdDev;
  }

  /**
   * Calculate Sortino Ratio
   * @param {Array} returns - Daily returns
   * @param {number} targetReturn - Target/minimum acceptable return (default 0)
   * @param {number} riskFreeRate - Annual risk-free rate
   * @param {number} periods - Trading periods per year
   * @returns {number} Sortino Ratio
   */
  calculateSortinoRatio(returns, targetReturn = 0, riskFreeRate = this.config.riskFreeRate, periods = 252) {
    if (!Array.isArray(returns) || returns.length < this.config.minPeriods) return 0;

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const downisdeDeviation = returns.reduce((sum, r) => {
      const downside = Math.min(r - targetReturn, 0);
      return sum + downside * downside;
    }, 0);

    const downsideStdDev = Math.sqrt(downisdeDeviation / returns.length);
    if (downsideStdDev === 0) return 0;

    const excessReturn = (avgReturn * periods) - riskFreeRate;
    const annualizedDownsideStdDev = downsideStdDev * Math.sqrt(periods);

    return excessReturn / annualizedDownsideStdDev;
  }

  /**
   * Calculate Calmar Ratio
   * @param {Array} returns - Daily returns
   * @param {number} periods - Trading periods per year
   * @returns {number} Calmar Ratio
   */
  calculateCalmarRatio(returns, periods = 252) {
    if (!Array.isArray(returns) || returns.length < this.config.minPeriods) return 0;

    const annualizedReturn = this.calculateAnnualizedReturn(
      returns.reduce((prices, ret) => {
        const lastPrice = prices[prices.length - 1] || 1;
        prices.push(lastPrice * (1 + ret));
        return prices;
      }, [])
    );

    const maxDrawdown = this.calculateMaxDrawdown(returns);
    if (maxDrawdown === 0) return 0;

    return Math.abs(annualizedReturn / maxDrawdown);
  }

  /**
   * Calculate Information Ratio
   * @param {Array} returns - Strategy returns
   * @param {Array} benchmarkReturns - Benchmark returns (same length)
   * @param {number} periods - Trading periods per year
   * @returns {number} Information Ratio
   */
  calculateInformationRatio(returns, benchmarkReturns, periods = 252) {
    if (!Array.isArray(returns) || returns.length < this.config.minPeriods) return 0;
    if (benchmarkReturns.length !== returns.length) return 0;

    const activeReturns = returns.map((r, i) => r - benchmarkReturns[i]);
    const avgActiveReturn = activeReturns.reduce((a, b) => a + b, 0) / activeReturns.length;
    const trackingError = activeReturns.reduce((sum, r) => sum + Math.pow(r - avgActiveReturn, 2), 0);
    const trackingErrorStdDev = Math.sqrt(trackingError / activeReturns.length) * Math.sqrt(periods);

    if (trackingErrorStdDev === 0) return 0;
    return (avgActiveReturn * periods) / trackingErrorStdDev;
  }

  /**
   * Calculate Alpha and Beta
   * @param {Array} returns - Strategy returns
   * @param {Array} benchmarkReturns - Benchmark returns
   * @param {number} riskFreeRate - Annual risk-free rate
   * @returns {Object} {alpha, beta}
   */
  calculateAlphaBeta(returns, benchmarkReturns, riskFreeRate = this.config.riskFreeRate) {
    if (returns.length < this.config.minPeriods || returns.length !== benchmarkReturns.length) {
      return { alpha: 0, beta: 0 };
    }

    const strategyAvg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const benchmarkAvg = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;

    let covariance = 0;
    let benchmarkVariance = 0;

    for (let i = 0; i < returns.length; i++) {
      covariance += (returns[i] - strategyAvg) * (benchmarkReturns[i] - benchmarkAvg);
      benchmarkVariance += Math.pow(benchmarkReturns[i] - benchmarkAvg, 2);
    }

    covariance /= returns.length;
    benchmarkVariance /= returns.length;

    const beta = benchmarkVariance === 0 ? 0 : covariance / benchmarkVariance;
    const alpha = strategyAvg - (riskFreeRate / 252 + beta * (benchmarkAvg - riskFreeRate / 252));

    return { alpha: alpha * 252, beta }; // Annualize alpha
  }

  // ============================================================================
  // RISK METRICS
  // ============================================================================

  /**
   * Calculate volatility (standard deviation of returns)
   * @param {Array} returns - Daily returns
   * @param {number} periods - Trading periods per year
   * @returns {number} Annualized volatility
   */
  calculateVolatility(returns, periods = 252) {
    if (!Array.isArray(returns) || returns.length < this.config.minPeriods) return 0;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance * periods);
  }

  /**
   * Calculate Value at Risk (VaR)
   * @param {Array} returns - Daily returns
   * @param {number} confidenceLevel - Confidence level (default from config)
   * @returns {number} VaR (as negative percentage)
   */
  calculateVaR(returns, confidenceLevel = this.config.confidenceLevel) {
    if (!Array.isArray(returns) || returns.length < this.config.minPeriods) return 0;

    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.ceil((1 - confidenceLevel) * sorted.length) - 1;
    return index >= 0 ? sorted[index] : 0;
  }

  /**
   * Calculate Conditional Value at Risk (CVaR / Expected Shortfall)
   * @param {Array} returns - Daily returns
   * @param {number} confidenceLevel - Confidence level
   * @returns {number} CVaR (as negative percentage)
   */
  calculateCVaR(returns, confidenceLevel = this.config.confidenceLevel) {
    if (!Array.isArray(returns) || returns.length < this.config.minPeriods) return 0;

    const var_ = this.calculateVaR(returns, confidenceLevel);
    const worstReturns = returns.filter(r => r <= var_);

    if (worstReturns.length === 0) return var_;
    return worstReturns.reduce((a, b) => a + b, 0) / worstReturns.length;
  }

  /**
   * Calculate Maximum Drawdown
   * @param {Array} returns - Daily returns or prices
   * @returns {number} Max drawdown (negative value)
   */
  calculateMaxDrawdown(returns) {
    if (!Array.isArray(returns) || returns.length < 2) return 0;

    // Check if input is prices or returns
    let prices = returns;
    if (Math.max(...returns) < 10) {
      // Likely returns, convert to prices
      prices = [1];
      for (const ret of returns) {
        prices.push(prices[prices.length - 1] * (1 + ret));
      }
    }

    let maxPrice = prices[0];
    let maxDrawdown = 0;

    for (let i = 1; i < prices.length; i++) {
      maxPrice = Math.max(maxPrice, prices[i]);
      const drawdown = (prices[i] - maxPrice) / maxPrice;
      maxDrawdown = Math.min(maxDrawdown, drawdown);
    }

    return maxDrawdown;
  }

  /**
   * Calculate Recovery Factor
   * @param {Array} returns - Daily returns
   * @returns {number} Recovery factor (profit / max drawdown)
   */
  calculateRecoveryFactor(returns) {
    if (!Array.isArray(returns) || returns.length < this.config.minPeriods) return 0;

    const totalProfit = returns.reduce((a, b) => a + b, 0);
    const maxDrawdown = Math.abs(this.calculateMaxDrawdown(returns));

    if (maxDrawdown === 0) return totalProfit > 0 ? Infinity : 0;
    return totalProfit / maxDrawdown;
  }

  /**
   * Calculate Ulcer Index
   * @param {Array} prices - Price series
   * @param {number} periods - Rolling window (default 252)
   * @returns {number} Ulcer Index
   */
  calculateUlcerIndex(prices, periods = 252) {
    if (!Array.isArray(prices) || prices.length < periods) return 0;

    let sumSquaredDrawdowns = 0;
    let maxPrice = prices[0];

    for (let i = 1; i < prices.length; i++) {
      maxPrice = Math.max(maxPrice, prices[i]);
      const drawdown = (prices[i] - maxPrice) / maxPrice;
      sumSquaredDrawdowns += drawdown * drawdown;
    }

    return Math.sqrt(sumSquaredDrawdowns / prices.length);
  }

  // ============================================================================
  // ATTRIBUTION ANALYSIS
  // ============================================================================

  /**
   * Calculate Return Attribution (decompose returns)
   * @param {Object} portfolio - Portfolio data {holdings: [{symbol, weight, return}, ...]}
   * @returns {Object} Attribution breakdown
   */
  calculateReturnAttribution(portfolio) {
    if (!portfolio || !Array.isArray(portfolio.holdings)) return {};

    const attribution = {
      totalReturn: 0,
      byPosition: {},
      byAssetClass: {},
      bySector: {}
    };

    let totalValue = 0;
    portfolio.holdings.forEach(holding => {
      const positionReturn = (holding.weight || 0) * (holding.return || 0);
      attribution.totalReturn += positionReturn;

      attribution.byPosition[holding.symbol] = {
        weight: holding.weight,
        return: holding.return,
        contribution: positionReturn,
        assetClass: holding.assetClass,
        sector: holding.sector
      };

      if (holding.assetClass) {
        if (!attribution.byAssetClass[holding.assetClass]) {
          attribution.byAssetClass[holding.assetClass] = { weight: 0, return: 0, contribution: 0 };
        }
        attribution.byAssetClass[holding.assetClass].weight += holding.weight;
        attribution.byAssetClass[holding.assetClass].contribution += positionReturn;
      }

      if (holding.sector) {
        if (!attribution.bySector[holding.sector]) {
          attribution.bySector[holding.sector] = { weight: 0, return: 0, contribution: 0 };
        }
        attribution.bySector[holding.sector].weight += holding.weight;
        attribution.bySector[holding.sector].contribution += positionReturn;
      }

      totalValue += holding.weight;
    });

    return attribution;
  }

  /**
   * Calculate Risk Attribution
   * @param {Object} portfolio - Portfolio data with risk metrics
   * @returns {Object} Risk contribution by position
   */
  calculateRiskAttribution(portfolio) {
    if (!portfolio || !Array.isArray(portfolio.holdings)) return {};

    const riskAttribution = {
      totalRisk: 0,
      byPosition: {},
      marginOfConcentration: 0
    };

    const holdings = portfolio.holdings;
    const totalRisk = Math.sqrt(
      holdings.reduce((sum, h) => sum + Math.pow(h.volatility * h.weight, 2), 0)
    );

    riskAttribution.totalRisk = totalRisk;

    holdings.forEach(holding => {
      const riskContribution = (holding.volatility * holding.weight) / (totalRisk || 1);
      riskAttribution.byPosition[holding.symbol] = {
        volatility: holding.volatility,
        weight: holding.weight,
        contribution: riskContribution,
        percentage: totalRisk > 0 ? riskContribution / totalRisk : 0
      };
    });

    // Calculate concentration risk
    const concentrationFactor = holdings.reduce((sum, h) => sum + Math.pow(h.weight, 2), 0);
    riskAttribution.marginOfConcentration = concentrationFactor;

    return riskAttribution;
  }

  /**
   * Brinson-Fachler Attribution Analysis
   * @param {Object} actual - Actual portfolio {holdings: [...]}
   * @param {Object} benchmark - Benchmark portfolio {holdings: [...]}
   * @returns {Object} Attribution analysis
   */
  calculateBrinsonFachlerAttribution(actual, benchmark) {
    if (!actual || !benchmark) return {};

    const attribution = {
      allocationEffect: 0,
      selectionEffect: 0,
      interactionEffect: 0,
      totalEffect: 0,
      byPosition: {}
    };

    const benchmarkMap = new Map();
    benchmark.holdings?.forEach(h => benchmarkMap.set(h.symbol, h));

    actual.holdings?.forEach(actualHolding => {
      const benchmarkHolding = benchmarkMap.get(actualHolding.symbol) || { weight: 0, return: 0 };

      const weightDifference = actualHolding.weight - benchmarkHolding.weight;
      const returnDifference = actualHolding.return - benchmarkHolding.return;
      const benchmarkWeight = benchmarkHolding.weight;
      const actualReturn = actualHolding.return;

      const allocationEffect = weightDifference * benchmarkHolding.return;
      const selectionEffect = benchmarkWeight * returnDifference;
      const interactionEffect = weightDifference * returnDifference;

      const totalEffect = allocationEffect + selectionEffect + interactionEffect;

      attribution.allocationEffect += allocationEffect;
      attribution.selectionEffect += selectionEffect;
      attribution.interactionEffect += interactionEffect;
      attribution.totalEffect += totalEffect;

      attribution.byPosition[actualHolding.symbol] = {
        allocationEffect,
        selectionEffect,
        interactionEffect,
        totalEffect
      };
    });

    return attribution;
  }

  // ============================================================================
  // EXECUTION ANALYTICS
  // ============================================================================

  /**
   * Calculate Execution Slippage
   * @param {Array} trades - Trade data [{timestamp, symbol, expectedPrice, actualPrice, shares}, ...]
   * @returns {Object} Slippage metrics
   */
  calculateExecutionSlippage(trades) {
    if (!Array.isArray(trades) || trades.length === 0) return {};

    let totalSlippage = 0;
    let totalSlippageAmount = 0;
    let worstSlippage = 0;
    let bestSlippage = 0;

    const slippageBySymbol = {};

    trades.forEach(trade => {
      const slippage = (trade.actualPrice - trade.expectedPrice) / trade.expectedPrice;
      const slippageAmount = Math.abs(trade.actualPrice - trade.expectedPrice) * trade.shares;

      totalSlippage += slippage;
      totalSlippageAmount += slippageAmount;
      worstSlippage = Math.min(worstSlippage, slippage);
      bestSlippage = Math.max(bestSlippage, slippage);

      if (!slippageBySymbol[trade.symbol]) {
        slippageBySymbol[trade.symbol] = { count: 0, totalSlippage: 0, avgSlippage: 0 };
      }
      slippageBySymbol[trade.symbol].count++;
      slippageBySymbol[trade.symbol].totalSlippage += slippage;
      slippageBySymbol[trade.symbol].avgSlippage = slippageBySymbol[trade.symbol].totalSlippage / slippageBySymbol[trade.symbol].count;
    });

    return {
      averageSlippage: totalSlippage / trades.length,
      totalSlippageAmount,
      worstSlippage,
      bestSlippage,
      bySymbol: slippageBySymbol,
      tradeCount: trades.length
    };
  }

  /**
   * Calculate Fill Rates
   * @param {Array} orders - Order data [{symbol, orderedShares, filledShares, status}, ...]
   * @returns {Object} Fill rate metrics
   */
  calculateFillRates(orders) {
    if (!Array.isArray(orders) || orders.length === 0) return {};

    let totalOrdered = 0;
    let totalFilled = 0;
    let partialFills = 0;
    let unfilled = 0;

    const fillBySymbol = {};

    orders.forEach(order => {
      totalOrdered += order.orderedShares;
      totalFilled += order.filledShares;

      if (order.filledShares === 0) {
        unfilled++;
      } else if (order.filledShares < order.orderedShares) {
        partialFills++;
      }

      if (!fillBySymbol[order.symbol]) {
        fillBySymbol[order.symbol] = { totalOrdered: 0, totalFilled: 0, fillRate: 0 };
      }
      fillBySymbol[order.symbol].totalOrdered += order.orderedShares;
      fillBySymbol[order.symbol].totalFilled += order.filledShares;
      fillBySymbol[order.symbol].fillRate = fillBySymbol[order.symbol].totalFilled / (fillBySymbol[order.symbol].totalOrdered || 1);
    });

    return {
      overallFillRate: totalOrdered > 0 ? totalFilled / totalOrdered : 0,
      partialFills,
      unfilled,
      bySymbol: fillBySymbol,
      orderCount: orders.length
    };
  }

  /**
   * Calculate Execution Efficiency
   * @param {Object} execution - Execution metrics {trades: [...], orders: [...], benchmarkPrice: number}
   * @returns {Object} Efficiency metrics
   */
  calculateExecutionEfficiency(execution) {
    if (!execution) return {};

    const slippage = this.calculateExecutionSlippage(execution.trades || []);
    const fillRates = this.calculateFillRates(execution.orders || []);

    const efficiency = {
      slippageMetrics: slippage,
      fillRateMetrics: fillRates,
      overallEfficiency: 0,
      impactScore: 0
    };

    // Calculate efficiency score (0-1, where 1 is perfect)
    const fillScore = fillRates.overallFillRate || 0;
    const slippageScore = Math.max(0, 1 + (slippage.averageSlippage || 0));
    efficiency.overallEfficiency = (fillScore + slippageScore) / 2;

    // Calculate market impact score
    efficiency.impactScore = Math.abs(slippage.averageSlippage || 0);

    return efficiency;
  }

  /**
   * Calculate Market Impact
   * @param {Object} trade - Trade data {symbol, shares, vwap, price, volumePercent}
   * @returns {number} Estimated market impact (percentage)
   */
  calculateMarketImpact(trade) {
    if (!trade) return 0;

    // Simple linear impact model: impact = sqrt(orderSize / averageVolume) * volatility
    const volumeImpact = trade.volumePercent || 0;
    const priceImpact = Math.abs((trade.price - trade.vwap) / trade.vwap) || 0;

    return Math.sqrt(Math.pow(volumeImpact, 2) + Math.pow(priceImpact, 2));
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Compile comprehensive analytics
   * @param {Object} portfolioData - Complete portfolio/strategy data
   * @returns {Object} Complete analytics summary
   */
  compileAnalytics(portfolioData) {
    const analytics = {
      timestamp: new Date(),
      performance: {},
      risk: {},
      attribution: {},
      execution: {}
    };

    try {
      // Performance metrics
      if (portfolioData.prices) {
        const returns = this.calculateDailyReturns(portfolioData.prices);
        analytics.performance = {
          totalReturn: this.calculateTotalReturn(portfolioData.prices),
          annualizedReturn: this.calculateAnnualizedReturn(portfolioData.prices),
          sharpeRatio: this.calculateSharpeRatio(returns),
          sortinoRatio: this.calculateSortinoRatio(returns),
          calmarRatio: this.calculateCalmarRatio(returns),
          informationRatio: portfolioData.benchmarkReturns ?
            this.calculateInformationRatio(returns, portfolioData.benchmarkReturns) : 0,
          alphaBeta: portfolioData.benchmarkReturns ?
            this.calculateAlphaBeta(returns, portfolioData.benchmarkReturns) : { alpha: 0, beta: 0 }
        };
      }

      // Risk metrics
      if (portfolioData.prices) {
        const returns = this.calculateDailyReturns(portfolioData.prices);
        analytics.risk = {
          volatility: this.calculateVolatility(returns),
          var95: this.calculateVaR(returns, 0.95),
          var99: this.calculateVaR(returns, 0.99),
          cvar95: this.calculateCVaR(returns, 0.95),
          maxDrawdown: this.calculateMaxDrawdown(returns),
          recoveryFactor: this.calculateRecoveryFactor(returns),
          ulcerIndex: this.calculateUlcerIndex(portfolioData.prices)
        };
      }

      // Attribution
      if (portfolioData.portfolio) {
        analytics.attribution = {
          returnAttribution: this.calculateReturnAttribution(portfolioData.portfolio),
          riskAttribution: this.calculateRiskAttribution(portfolioData.portfolio)
        };
      }

      // Execution metrics
      if (portfolioData.execution) {
        analytics.execution = this.calculateExecutionEfficiency(portfolioData.execution);
      }

      this.stats.calculationsPerformed++;
      this.stats.lastCalculation = new Date();

      return analytics;
    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Analytics compilation error:', error);
      return analytics;
    }
  }

  /**
   * Get analytics statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      cacheSize: this.cache.size
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = GNNAnalyticsEngine;
