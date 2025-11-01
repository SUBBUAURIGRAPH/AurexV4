/**
 * GNN Dashboard Datasource - API for Dashboard Data
 *
 * Provides data API for Grafana dashboards including:
 * - Real-time performance metrics
 * - Risk dashboard data
 * - Portfolio composition data
 * - Trade execution data
 * - Alert and threshold management
 * - Historical data aggregation
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

class GNNDashboardDatasource {
  constructor(analyticsEngine, performanceAnalytics, riskAnalytics, portfolioAnalytics, options = {}) {
    this.analyticsEngine = analyticsEngine;
    this.performanceAnalytics = performanceAnalytics;
    this.riskAnalytics = riskAnalytics;
    this.portfolioAnalytics = portfolioAnalytics;

    this.config = {
      updateInterval: options.updateInterval || 60000, // 1 minute
      cacheTimeout: options.cacheTimeout || 300000, // 5 minutes
      dataRetentionDays: options.dataRetentionDays || 365,
      ...options
    };

    this.cache = new Map();
    this.alerts = [];
    this.thresholds = new Map();
    this.stats = {
      queriesServed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastUpdate: null
    };
  }

  // ============================================================================
  // PERFORMANCE METRICS
  // ============================================================================

  /**
   * Get real-time performance metrics
   * @param {Object} portfolioData - Current portfolio data
   * @returns {Object} Performance metrics for dashboard
   */
  getPerformanceMetrics(portfolioData) {
    const cacheKey = 'performance_metrics';
    const cached = this._getCache(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    const metrics = {
      timestamp: Date.now(),
      current: {},
      daily: {},
      monthly: {},
      yearly: {},
      benchmark: {}
    };

    try {
      // Current metrics
      if (portfolioData.prices && portfolioData.returns) {
        const dailyReturn = portfolioData.returns[portfolioData.returns.length - 1] || 0;
        const monthlyReturn = portfolioData.monthlyReturns?.[new Date().toISOString().slice(0, 7)] || 0;

        metrics.current = {
          totalReturn: this.analyticsEngine.calculateTotalReturn(portfolioData.prices),
          dailyReturn,
          monthlyReturn,
          ytdReturn: portfolioData.ytdReturn || 0,
          sharpeRatio: this.analyticsEngine.calculateSharpeRatio(portfolioData.returns),
          volatility: this.analyticsEngine.calculateVolatility(portfolioData.returns),
          maxDrawdown: this.analyticsEngine.calculateMaxDrawdown(portfolioData.returns),
          portfolioValue: portfolioData.portfolioValue || 0
        };

        // Daily metrics
        metrics.daily = {
          return: dailyReturn,
          volatility: Math.sqrt(Math.pow(dailyReturn, 2)),
          sharpeRatio: (dailyReturn / (Math.sqrt(Math.pow(dailyReturn, 2)) || 0.001)) * Math.sqrt(252)
        };

        // Monthly metrics
        metrics.monthly = {
          return: monthlyReturn,
          volatility: this.analyticsEngine.calculateVolatility(portfolioData.returns),
          sharpeRatio: this.analyticsEngine.calculateSharpeRatio(portfolioData.returns)
        };

        // Yearly metrics
        metrics.yearly = {
          return: this.analyticsEngine.calculateAnnualizedReturn(portfolioData.prices),
          volatility: this.analyticsEngine.calculateVolatility(portfolioData.returns),
          sharpeRatio: this.analyticsEngine.calculateSharpeRatio(portfolioData.returns)
        };

        // Benchmark comparison
        if (portfolioData.benchmarkReturns) {
          const alphaBeta = this.analyticsEngine.calculateAlphaBeta(
            portfolioData.returns,
            portfolioData.benchmarkReturns
          );
          metrics.benchmark = {
            benchmarkReturn: this.analyticsEngine.calculateTotalReturn(portfolioData.benchmarkPrices || []),
            outperformance: metrics.current.totalReturn - (portfolioData.benchmarkReturn || 0),
            alpha: alphaBeta.alpha,
            beta: alphaBeta.beta,
            informationRatio: this.analyticsEngine.calculateInformationRatio(
              portfolioData.returns,
              portfolioData.benchmarkReturns
            )
          };
        }
      }

      this.stats.cacheMisses++;
      this._setCache(cacheKey, metrics);
      this.stats.queriesServed++;

      return metrics;
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return metrics;
    }
  }

  /**
   * Get trade execution metrics
   * @param {Array} trades - Recent trades
   * @returns {Object} Trade metrics
   */
  getTradeMetrics(trades) {
    const metrics = {
      timestamp: Date.now(),
      today: {},
      thisWeek: {},
      thisMonth: {}
    };

    try {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      // Today's trades
      const todayTrades = trades.filter(t => (now - new Date(t.timestamp).getTime()) < dayMs);
      const analysisToday = this.performanceAnalytics.analyzeTrades(todayTrades);
      metrics.today = {
        trades: todayTrades.length,
        winRate: analysisToday.winRate,
        profitFactor: analysisToday.profitFactor,
        pnl: todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
        avgWin: analysisToday.avgWin,
        avgLoss: analysisToday.avgLoss
      };

      // This week's trades
      const weekTrades = trades.filter(t => (now - new Date(t.timestamp).getTime()) < (7 * dayMs));
      const analysisWeek = this.performanceAnalytics.analyzeTrades(weekTrades);
      metrics.thisWeek = {
        trades: weekTrades.length,
        winRate: analysisWeek.winRate,
        profitFactor: analysisWeek.profitFactor,
        pnl: weekTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
        avgWin: analysisWeek.avgWin,
        avgLoss: analysisWeek.avgLoss
      };

      // This month's trades
      const monthTrades = trades.filter(t => (now - new Date(t.timestamp).getTime()) < (30 * dayMs));
      const analysisMonth = this.performanceAnalytics.analyzeTrades(monthTrades);
      metrics.thisMonth = {
        trades: monthTrades.length,
        winRate: analysisMonth.winRate,
        profitFactor: analysisMonth.profitFactor,
        pnl: monthTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
        avgWin: analysisMonth.avgWin,
        avgLoss: analysisMonth.avgLoss
      };

      this.stats.queriesServed++;
      return metrics;
    } catch (error) {
      console.error('Error getting trade metrics:', error);
      return metrics;
    }
  }

  // ============================================================================
  // RISK DASHBOARD DATA
  // ============================================================================

  /**
   * Get risk dashboard data
   * @param {Object} portfolioData - Portfolio data with risk metrics
   * @returns {Object} Risk dashboard data
   */
  getRiskDashboard(portfolioData) {
    const cacheKey = 'risk_dashboard';
    const cached = this._getCache(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    const dashboard = {
      timestamp: Date.now(),
      riskMetrics: {},
      concentration: {},
      factorRisk: {},
      scenarios: {}
    };

    try {
      // Risk metrics
      if (portfolioData.returns) {
        dashboard.riskMetrics = {
          volatility: this.analyticsEngine.calculateVolatility(portfolioData.returns),
          var95: this.analyticsEngine.calculateVaR(portfolioData.returns, 0.95),
          var99: this.analyticsEngine.calculateVaR(portfolioData.returns, 0.99),
          cvar95: this.analyticsEngine.calculateCVaR(portfolioData.returns, 0.95),
          cvar99: this.analyticsEngine.calculateCVaR(portfolioData.returns, 0.99),
          maxDrawdown: this.analyticsEngine.calculateMaxDrawdown(portfolioData.returns),
          ulcerIndex: this.analyticsEngine.calculateUlcerIndex(portfolioData.prices || [])
        };
      }

      // Concentration
      if (portfolioData.portfolio) {
        dashboard.concentration = this.riskAnalytics.calculateConcentrationRisk(
          portfolioData.portfolio
        );
      }

      // Factor decomposition
      if (portfolioData.portfolio && portfolioData.factorExposures) {
        dashboard.factorRisk = this.riskAnalytics.calculateFactorRiskDecomposition(
          portfolioData.portfolio,
          portfolioData.factorExposures
        );
      }

      // Stress scenarios
      if (portfolioData.portfolio) {
        dashboard.scenarios = this.riskAnalytics.stressTest(
          portfolioData.portfolio,
          portfolioData.scenarios
        );
      }

      this.stats.cacheMisses++;
      this._setCache(cacheKey, dashboard);
      this.stats.queriesServed++;

      return dashboard;
    } catch (error) {
      console.error('Error getting risk dashboard:', error);
      return dashboard;
    }
  }

  /**
   * Get tail risk analysis
   * @param {Array} returns - Returns data
   * @returns {Object} Tail risk data
   */
  getTailRiskAnalysis(returns) {
    if (!Array.isArray(returns) || returns.length < 30) return {};

    const analysis = this.riskAnalytics.analyzeTailRisk(returns);
    return {
      timestamp: Date.now(),
      ...analysis
    };
  }

  // ============================================================================
  // PORTFOLIO COMPOSITION DATA
  // ============================================================================

  /**
   * Get portfolio composition for dashboard
   * @param {Object} portfolio - Portfolio data
   * @returns {Object} Composition data
   */
  getPortfolioComposition(portfolio) {
    const cacheKey = 'portfolio_composition';
    const cached = this._getCache(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    const composition = {
      timestamp: Date.now(),
      overall: {},
      bySector: [],
      byAssetClass: [],
      byGeography: [],
      topPositions: []
    };

    try {
      const analysis = this.portfolioAnalytics.analyzeComposition(portfolio);

      composition.overall = {
        totalValue: analysis.totalValue,
        numberOfPositions: analysis.numberOfPositions,
        largestPosition: analysis.summary.largestPosition,
        diversificationRatio: (analysis.totalValue > 0) ? analysis.numberOfPositions / analysis.totalValue : 0
      };

      // Convert sector data to array format
      composition.bySector = Object.entries(analysis.bySector).map(([sector, data]) => ({
        name: sector,
        value: data.value,
        weight: data.weight,
        positions: data.positions
      }));

      composition.byAssetClass = Object.entries(analysis.byAssetClass).map(([assetClass, data]) => ({
        name: assetClass,
        value: data.value,
        weight: data.weight,
        positions: data.positions
      }));

      composition.byGeography = Object.entries(analysis.byGeography).map(([country, data]) => ({
        name: country,
        value: data.value,
        weight: data.weight,
        positions: data.positions
      }));

      // Top 10 positions
      composition.topPositions = portfolio.holdings
        ?.sort((a, b) => b.value - a.value)
        .slice(0, 10)
        .map(h => ({
          symbol: h.symbol,
          value: h.value,
          weight: h.weight,
          sector: h.sector,
          assetClass: h.assetClass
        })) || [];

      this.stats.cacheMisses++;
      this._setCache(cacheKey, composition);
      this.stats.queriesServed++;

      return composition;
    } catch (error) {
      console.error('Error getting portfolio composition:', error);
      return composition;
    }
  }

  /**
   * Get diversification metrics
   * @param {Object} portfolio - Portfolio data
   * @param {Object} correlations - Correlation matrix
   * @returns {Object} Diversification data
   */
  getDiversificationMetrics(portfolio, correlations) {
    const metrics = this.portfolioAnalytics.calculateDiversification(portfolio, correlations);
    return {
      timestamp: Date.now(),
      ...metrics
    };
  }

  // ============================================================================
  // TIME SERIES DATA
  // ============================================================================

  /**
   * Get time series data for graphing
   * @param {Array} prices - Price history
   * @param {Array} returns - Returns history
   * @param {Array} timestamps - Corresponding timestamps
   * @returns {Object} Time series data
   */
  getTimeSeriesData(prices, returns, timestamps) {
    if (!Array.isArray(prices) || prices.length === 0) return {};

    const timeSeries = {
      timestamp: Date.now(),
      prices: [],
      returns: [],
      drawdown: [],
      cumulativeReturn: []
    };

    try {
      // Build time series arrays
      let maxPrice = prices[0];
      let cumulativeReturn = 0;

      prices.forEach((price, i) => {
        maxPrice = Math.max(maxPrice, price);
        const drawdown = (price - maxPrice) / maxPrice;
        const ret = returns?.[i] || 0;
        cumulativeReturn += ret;

        timeSeries.prices.push({
          time: timestamps?.[i] || new Date(Date.now() - (prices.length - i) * 24 * 60 * 60 * 1000),
          value: price
        });

        timeSeries.returns.push({
          time: timestamps?.[i] || new Date(Date.now() - (prices.length - i) * 24 * 60 * 60 * 1000),
          value: ret
        });

        timeSeries.drawdown.push({
          time: timestamps?.[i] || new Date(Date.now() - (prices.length - i) * 24 * 60 * 60 * 1000),
          value: drawdown
        });

        timeSeries.cumulativeReturn.push({
          time: timestamps?.[i] || new Date(Date.now() - (prices.length - i) * 24 * 60 * 60 * 1000),
          value: cumulativeReturn
        });
      });

      this.stats.queriesServed++;
      return timeSeries;
    } catch (error) {
      console.error('Error getting time series data:', error);
      return timeSeries;
    }
  }

  /**
   * Get rolling metrics
   * @param {Array} returns - Returns history
   * @param {number} window - Rolling window size
   * @returns {Object} Rolling metrics
   */
  getRollingMetrics(returns, window = 60) {
    if (!Array.isArray(returns) || returns.length < window) return {};

    const metrics = {
      timestamp: Date.now(),
      sharpeRatio: [],
      volatility: [],
      maxDrawdown: []
    };

    try {
      for (let i = window; i <= returns.length; i++) {
        const windowReturns = returns.slice(i - window, i);

        metrics.sharpeRatio.push({
          index: i,
          value: this.analyticsEngine.calculateSharpeRatio(windowReturns)
        });

        metrics.volatility.push({
          index: i,
          value: this.analyticsEngine.calculateVolatility(windowReturns)
        });

        metrics.maxDrawdown.push({
          index: i,
          value: this.analyticsEngine.calculateMaxDrawdown(windowReturns)
        });
      }

      this.stats.queriesServed++;
      return metrics;
    } catch (error) {
      console.error('Error getting rolling metrics:', error);
      return metrics;
    }
  }

  // ============================================================================
  // ALERT AND THRESHOLD MANAGEMENT
  // ============================================================================

  /**
   * Add alert threshold
   * @param {string} metricName - Metric name
   * @param {number} threshold - Threshold value
   * @param {string} operator - Comparison operator ('>', '<', '>=', '<=', '==')
   * @param {string} severity - Alert severity ('low', 'medium', 'high', 'critical')
   */
  addAlertThreshold(metricName, threshold, operator = '>', severity = 'high') {
    this.thresholds.set(metricName, {
      threshold,
      operator,
      severity,
      triggered: false,
      lastCheck: null
    });
  }

  /**
   * Check thresholds against metrics
   * @param {Object} metrics - Current metrics
   */
  checkThresholds(metrics) {
    for (const [metricName, config] of this.thresholds.entries()) {
      const value = metrics[metricName];
      if (value === undefined) continue;

      let triggered = false;
      switch (config.operator) {
        case '>':
          triggered = value > config.threshold;
          break;
        case '<':
          triggered = value < config.threshold;
          break;
        case '>=':
          triggered = value >= config.threshold;
          break;
        case '<=':
          triggered = value <= config.threshold;
          break;
        case '==':
          triggered = value === config.threshold;
          break;
      }

      if (triggered && !config.triggered) {
        this.alerts.push({
          timestamp: Date.now(),
          metric: metricName,
          value,
          threshold: config.threshold,
          severity: config.severity,
          message: `${metricName} is ${config.operator} ${config.threshold} (current: ${value})`
        });
        config.triggered = true;
      } else if (!triggered && config.triggered) {
        config.triggered = false;
      }

      config.lastCheck = Date.now();
    }
  }

  /**
   * Get active alerts
   * @param {string} severity - Filter by severity ('low', 'medium', 'high', 'critical')
   * @returns {Array} Active alerts
   */
  getAlerts(severity = null) {
    if (severity) {
      return this.alerts.filter(a => a.severity === severity);
    }
    return this.alerts;
  }

  /**
   * Clear alerts
   * @param {number} olderThanMs - Clear alerts older than N milliseconds
   */
  clearAlerts(olderThanMs = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - olderThanMs;
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Get cached data
   * @private
   */
  _getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.config.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  /**
   * Set cache
   * @private
   */
  _setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const hitRate = this.stats.queriesServed > 0
      ? (this.stats.cacheHits / this.stats.queriesServed) * 100
      : 0;

    return {
      ...this.stats,
      cacheHitRate: hitRate.toFixed(2) + '%',
      activeAlerts: this.alerts.length,
      activeThresholds: this.thresholds.size
    };
  }
}

module.exports = GNNDashboardDatasource;
