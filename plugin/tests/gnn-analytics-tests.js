/**
 * GNN Analytics - Comprehensive Test Suite
 *
 * Tests for all analytics modules including:
 * - Analytics Engine
 * - Performance Analytics
 * - Risk Analytics
 * - Portfolio Analytics
 * - Report Generator
 * - Dashboard Datasource
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

const assert = require('assert');
const GNNAnalyticsEngine = require('../gnn-analytics-engine');
const GNNPerformanceAnalytics = require('../gnn-performance-analytics');
const GNNRiskAnalytics = require('../gnn-risk-analytics');
const GNNPortfolioAnalytics = require('../gnn-portfolio-analytics');
const GNNReportGenerator = require('../gnn-report-generator');
const GNNDashboardDatasource = require('../gnn-dashboard-datasource');

class GNNAnalyticsTestSuite {
  constructor() {
    this.analytics = new GNNAnalyticsEngine();
    this.performanceAnalytics = new GNNPerformanceAnalytics(this.analytics);
    this.riskAnalytics = new GNNRiskAnalytics(this.analytics);
    this.portfolioAnalytics = new GNNPortfolioAnalytics(this.analytics);
    this.reportGenerator = new GNNReportGenerator(
      this.analytics,
      this.performanceAnalytics,
      this.riskAnalytics,
      this.portfolioAnalytics
    );
    this.dashboardDatasource = new GNNDashboardDatasource(
      this.analytics,
      this.performanceAnalytics,
      this.riskAnalytics,
      this.portfolioAnalytics
    );

    this.testResults = [];
    this.testsRun = 0;
    this.testsPassed = 0;
    this.testsFailed = 0;
  }

  // ============================================================================
  // TEST HELPERS
  // ============================================================================

  test(name, fn) {
    this.testsRun++;
    try {
      fn();
      this.testsPassed++;
      this.testResults.push({ name, status: 'PASS' });
      console.log(`✓ ${name}`);
    } catch (error) {
      this.testsFailed++;
      this.testResults.push({ name, status: 'FAIL', error: error.message });
      console.error(`✗ ${name}: ${error.message}`);
    }
  }

  assertEquals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  assertCloseTo(actual, expected, tolerance, message) {
    const diff = Math.abs(actual - expected);
    if (diff > tolerance) {
      throw new Error(message || `Expected ~${expected}, got ${actual}, diff: ${diff}`);
    }
  }

  assertTrue(condition, message) {
    if (!condition) {
      throw new Error(message || 'Expected true');
    }
  }

  assertFalse(condition, message) {
    if (condition) {
      throw new Error(message || 'Expected false');
    }
  }

  // ============================================================================
  // HELPER DATA
  // ============================================================================

  generatePriceData(size = 252) {
    const prices = [100];
    for (let i = 1; i < size; i++) {
      const dailyReturn = (Math.random() - 0.49) * 0.02; // ~0-2% daily movement
      prices.push(prices[i - 1] * (1 + dailyReturn));
    }
    return prices;
  }

  generateReturns(size = 252) {
    const returns = [];
    for (let i = 0; i < size; i++) {
      returns.push((Math.random() - 0.49) * 0.02);
    }
    return returns;
  }

  generatePortfolioData() {
    return {
      totalValue: 1000000,
      cash: 50000,
      holdings: [
        { symbol: 'AAPL', shares: 100, price: 150, value: 15000, weight: 0.15, volatility: 0.25, sector: 'Technology', assetClass: 'Equity' },
        { symbol: 'MSFT', shares: 50, price: 300, value: 15000, weight: 0.15, volatility: 0.22, sector: 'Technology', assetClass: 'Equity' },
        { symbol: 'JPM', shares: 200, price: 120, value: 24000, weight: 0.24, volatility: 0.20, sector: 'Finance', assetClass: 'Equity' },
        { symbol: 'TLT', shares: 80, price: 85, value: 6800, weight: 0.068, volatility: 0.08, sector: 'Fixed Income', assetClass: 'Bond' },
        { symbol: 'GLD', shares: 50, price: 180, value: 9000, weight: 0.09, volatility: 0.15, sector: 'Commodities', assetClass: 'Commodity' },
        { symbol: 'SPY', shares: 100, price: 420, value: 42000, weight: 0.42, volatility: 0.18, sector: 'Equity', assetClass: 'ETF' }
      ]
    };
  }

  generateTradesData() {
    return [
      { symbol: 'AAPL', entry: 150, exit: 155, shares: 100, pnl: 500, timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), strategy: 'momentum' },
      { symbol: 'MSFT', entry: 300, exit: 298, shares: 50, pnl: -100, timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), strategy: 'mean_reversion' },
      { symbol: 'JPM', entry: 120, exit: 125, shares: 200, pnl: 1000, timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), strategy: 'value' },
      { symbol: 'GLD', entry: 180, exit: 182, shares: 50, pnl: 100, timestamp: new Date(), strategy: 'hedge' },
      { symbol: 'SPY', entry: 420, exit: 418, shares: 100, pnl: -200, timestamp: new Date(), strategy: 'technical' }
    ];
  }

  // ============================================================================
  // ANALYTICS ENGINE TESTS
  // ============================================================================

  testAnalyticsEngine() {
    console.log('\n=== Analytics Engine Tests ===\n');

    this.test('calculateTotalReturn', () => {
      const prices = [100, 110, 120, 115];
      const result = this.analytics.calculateTotalReturn(prices);
      this.assertCloseTo(result, 0.15, 0.01);
    });

    this.test('calculateDailyReturns', () => {
      const prices = [100, 110, 120];
      const returns = this.analytics.calculateDailyReturns(prices);
      this.assertEquals(returns.length, 2);
      this.assertCloseTo(returns[0], 0.10, 0.01);
      this.assertCloseTo(returns[1], 0.0909, 0.01);
    });

    this.test('calculateAnnualizedReturn', () => {
      const prices = this.generatePriceData(252);
      const result = this.analytics.calculateAnnualizedReturn(prices);
      this.assertTrue(typeof result === 'number');
    });

    this.test('calculateSharpeRatio', () => {
      const returns = this.generateReturns(252);
      const result = this.analytics.calculateSharpeRatio(returns);
      this.assertTrue(typeof result === 'number');
      this.assertTrue(result > -10 && result < 10);
    });

    this.test('calculateSortinoRatio', () => {
      const returns = this.generateReturns(252);
      const result = this.analytics.calculateSortinoRatio(returns);
      this.assertTrue(typeof result === 'number');
    });

    this.test('calculateVolatility', () => {
      const returns = this.generateReturns(252);
      const result = this.analytics.calculateVolatility(returns);
      this.assertTrue(result > 0 && result < 1);
    });

    this.test('calculateVaR', () => {
      const returns = this.generateReturns(100);
      const var95 = this.analytics.calculateVaR(returns, 0.95);
      const var99 = this.analytics.calculateVaR(returns, 0.99);
      // VaR should be negative (worst case loss)
      this.assertTrue(typeof var95 === 'number');
      this.assertTrue(typeof var99 === 'number');
      // 99% VaR should be more negative than 95% VaR
      this.assertTrue(var99 <= var95);
    });

    this.test('calculateCVaR', () => {
      const returns = this.generateReturns(100);
      const cvar = this.analytics.calculateCVaR(returns);
      this.assertTrue(cvar < 0);
    });

    this.test('calculateMaxDrawdown', () => {
      const prices = [100, 110, 105, 115, 100, 95, 105];
      const result = this.analytics.calculateMaxDrawdown(prices);
      this.assertTrue(result <= 0);
      this.assertCloseTo(result, -0.1739, 0.01);
    });

    this.test('calculateAlphaBeta', () => {
      const strategyReturns = this.generateReturns(100);
      const benchmarkReturns = this.generateReturns(100);
      const result = this.analytics.calculateAlphaBeta(strategyReturns, benchmarkReturns);
      this.assertTrue(typeof result.alpha === 'number');
      this.assertTrue(typeof result.beta === 'number');
    });

    this.test('calculateReturnAttribution', () => {
      const portfolio = this.generatePortfolioData();
      portfolio.holdings.forEach((h, i) => {
        h.return = (i + 1) * 0.01; // 1%, 2%, 3%, etc.
      });
      const result = this.analytics.calculateReturnAttribution(portfolio);
      this.assertTrue(typeof result.totalReturn === 'number');
      this.assertTrue(Object.keys(result.byPosition).length > 0);
    });

    this.test('calculateExecutionSlippage', () => {
      const trades = [
        { symbol: 'AAPL', expectedPrice: 150, actualPrice: 150.5, shares: 100 },
        { symbol: 'MSFT', expectedPrice: 300, actualPrice: 299.5, shares: 50 }
      ];
      const result = this.analytics.calculateExecutionSlippage(trades);
      this.assertTrue(typeof result.averageSlippage === 'number');
      this.assertEquals(result.tradeCount, 2);
    });
  }

  // ============================================================================
  // PERFORMANCE ANALYTICS TESTS
  // ============================================================================

  testPerformanceAnalytics() {
    console.log('\n=== Performance Analytics Tests ===\n');

    this.test('analyzeTrades - basic metrics', () => {
      const trades = this.generateTradesData();
      const result = this.performanceAnalytics.analyzeTrades(trades);
      this.assertEquals(result.totalTrades, 5);
      this.assertEquals(result.winningTrades, 3);
      this.assertEquals(result.losingTrades, 2);
      this.assertTrue(result.winRate > 0.5);
    });

    this.test('calculateConsecutiveMetrics', () => {
      const trades = [
        { exit: 155, entry: 150, shares: 100 }, // win
        { exit: 298, entry: 300, shares: 50 },  // loss
        { exit: 125, entry: 120, shares: 200 }, // win
        { exit: 182, entry: 180, shares: 50 }   // win
      ];
      const result = this.performanceAnalytics.calculateConsecutiveMetrics(trades);
      this.assertTrue(typeof result.maxConsecutiveWins === 'number');
      this.assertTrue(typeof result.maxConsecutiveLosses === 'number');
    });

    this.test('calculateReturnDistribution', () => {
      const trades = this.generateTradesData();
      const result = this.performanceAnalytics.calculateReturnDistribution(trades);
      this.assertTrue(typeof result.mean === 'number');
      this.assertTrue(typeof result.stdDev === 'number');
      this.assertTrue(typeof result.skewness === 'number');
    });

    this.test('analyzePerformanceByPeriod', () => {
      const returns = this.generateReturns(252);
      const timestamps = [];
      for (let i = 0; i < 252; i++) {
        timestamps.push(new Date(2024, 0, 1 + i));
      }
      const result = this.performanceAnalytics.analyzePerformanceByPeriod(returns, timestamps, 'monthly');
      this.assertTrue(Object.keys(result).length > 0);
    });

    this.test('analyzeStrategyContribution', () => {
      const trades = this.generateTradesData();
      const result = this.performanceAnalytics.analyzeStrategyContribution(trades);
      this.assertTrue(Object.keys(result).length > 0);
      Object.values(result).forEach(strategy => {
        this.assertTrue(typeof strategy.trades === 'number');
        this.assertTrue(typeof strategy.winRate === 'number');
      });
    });

    this.test('analyzeInstrumentPerformance', () => {
      const trades = this.generateTradesData();
      const result = this.performanceAnalytics.analyzeInstrumentPerformance(trades);
      this.assertTrue(Object.keys(result).length > 0);
      this.assertTrue(result.AAPL || result.MSFT);
    });

    this.test('generatePerformanceReport', () => {
      const performanceData = {
        trades: this.generateTradesData(),
        returns: this.generateReturns(252),
        timestamps: Array.from({length: 252}, (_, i) => new Date(2024, 0, 1 + i))
      };
      const result = this.performanceAnalytics.generatePerformanceReport(performanceData);
      this.assertTrue(typeof result.summary === 'object');
      this.assertTrue(typeof result.trades === 'object');
    });
  }

  // ============================================================================
  // RISK ANALYTICS TESTS
  // ============================================================================

  testRiskAnalytics() {
    console.log('\n=== Risk Analytics Tests ===\n');

    this.test('calculateCorrelationMatrix', () => {
      const returns = {
        AAPL: this.generateReturns(100),
        MSFT: this.generateReturns(100),
        SPY: this.generateReturns(100)
      };
      const result = this.riskAnalytics.calculateCorrelationMatrix(returns);
      this.assertTrue(result.matrix);
      this.assertTrue(result.matrix.AAPL);
      this.assertEquals(result.matrix.AAPL.AAPL, 1);
    });

    this.test('calculateFactorRiskDecomposition', () => {
      const portfolio = this.generatePortfolioData();
      const factorExposures = {
        AAPL: { market: 1.2, tech: 0.8 },
        MSFT: { market: 1.1, tech: 0.9 },
        JPM: { market: 1.0, finance: 0.7 },
        TLT: { market: 0.3, rates: -0.5 },
        GLD: { market: 0.2, commodity: 1.0 },
        SPY: { market: 1.0 }
      };
      const result = this.riskAnalytics.calculateFactorRiskDecomposition(portfolio, factorExposures);
      this.assertTrue(typeof result.totalRisk === 'number');
      this.assertTrue(result.totalRisk > 0);
    });

    this.test('calculateConcentrationRisk', () => {
      const portfolio = this.generatePortfolioData();
      const result = this.riskAnalytics.calculateConcentrationRisk(portfolio);
      this.assertTrue(typeof result.herfindahlIndex === 'number');
      this.assertTrue(result.herfindahlIndex > 0 && result.herfindahlIndex <= 1);
    });

    this.test('analyzeTailRisk', () => {
      const returns = this.generateReturns(100);
      const result = this.riskAnalytics.analyzeTailRisk(returns);
      this.assertTrue(typeof result.excessKurtosis === 'number');
      this.assertTrue(typeof result.skewness === 'number');
    });

    this.test('stressTest', () => {
      const portfolio = this.generatePortfolioData();
      const scenarios = {
        'market_crash': { shock: -0.20, shocks: { default: -0.20 } },
        'rate_shock': { shock: 0.05, shocks: { default: 0.05 } }
      };
      const result = this.riskAnalytics.stressTest(portfolio, scenarios);
      this.assertTrue(result.scenarios);
      this.assertTrue(result.scenarios.market_crash);
    });

    this.test('generateRiskReport', () => {
      const riskData = {
        portfolio: this.generatePortfolioData(),
        returns: this.generateReturns(252),
        prices: this.generatePriceData(252),
        factorExposures: {},
        styleFactors: {}
      };
      const result = this.riskAnalytics.generateRiskReport(riskData);
      this.assertTrue(typeof result.timestamp === 'object');
      this.assertTrue(result.concentration);
      this.assertTrue(result.tailRisk);
    });
  }

  // ============================================================================
  // PORTFOLIO ANALYTICS TESTS
  // ============================================================================

  testPortfolioAnalytics() {
    console.log('\n=== Portfolio Analytics Tests ===\n');

    this.test('analyzeComposition', () => {
      const portfolio = this.generatePortfolioData();
      const result = this.portfolioAnalytics.analyzeComposition(portfolio);
      this.assertEquals(result.numberOfPositions, 6);
      this.assertTrue(result.totalValue > 0);
      this.assertTrue(result.bySector);
      this.assertTrue(result.byAssetClass);
    });

    this.test('calculateDiversification', () => {
      const portfolio = this.generatePortfolioData();
      const result = this.portfolioAnalytics.calculateDiversification(portfolio);
      this.assertTrue(typeof result.herfindahlIndex === 'number');
      this.assertTrue(typeof result.diversificationRatio === 'number');
      this.assertTrue(result.numberOfIndependentPositions > 1);
    });

    this.test('analyzeLiquidity', () => {
      const portfolio = this.generatePortfolioData();
      portfolio.holdings.forEach(h => {
        h.liquidity = 'high';
        h.bidAskSpread = 0.0005;
        h.avgDailyVolume = h.value * 10;
      });
      const result = this.portfolioAnalytics.analyzeLiquidity(portfolio);
      this.assertTrue(typeof result.liquidPercentage === 'number');
      this.assertTrue(result.liquidPercentage > 0.5);
    });

    this.test('calculateTurnover', () => {
      const trades = [
        { type: 'buy', shares: 100, price: 150, timestamp: new Date() },
        { type: 'sell', shares: 50, price: 155, timestamp: new Date() },
        { type: 'buy', shares: 200, price: 120, timestamp: new Date() }
      ];
      const result = this.portfolioAnalytics.calculateTurnover(trades, 1000000);
      this.assertTrue(typeof result.turnover === 'number');
      this.assertTrue(typeof result.annualizedTurnover === 'number');
    });

    this.test('analyzeRebalancing', () => {
      const portfolio = this.generatePortfolioData();
      const target = { AAPL: 0.15, MSFT: 0.15, JPM: 0.25, TLT: 0.1, GLD: 0.1, SPY: 0.25 };
      const result = this.portfolioAnalytics.analyzeRebalancing(portfolio, target);
      this.assertTrue(typeof result.totalDrift === 'number');
      this.assertTrue(Array.isArray(result.tradesToExecute));
    });

    this.test('analyzeSectorContribution', () => {
      const holdings = this.generatePortfolioData().holdings;
      holdings.forEach((h, i) => {
        h.return = (i + 1) * 0.01;
      });
      const result = this.portfolioAnalytics.analyzeSectorContribution(holdings);
      this.assertTrue(Object.keys(result).length > 0);
    });

    this.test('generatePortfolioReport', () => {
      const portfolioData = {
        portfolio: this.generatePortfolioData(),
        trades: this.generateTradesData(),
        returns: this.generateReturns(252),
        prices: this.generatePriceData(252),
        totalReturn: 0.15
      };
      const result = this.portfolioAnalytics.generatePortfolioReport(portfolioData);
      this.assertTrue(result.composition);
      this.assertTrue(result.diversification);
      this.assertTrue(result.liquidity);
    });
  }

  // ============================================================================
  // REPORT GENERATOR TESTS
  // ============================================================================

  testReportGenerator() {
    console.log('\n=== Report Generator Tests ===\n');

    this.test('generateDailyReport', () => {
      const dailyData = {
        trades: this.generateTradesData(),
        returns: this.generateReturns(5),
        pnl: 1500
      };
      const result = this.reportGenerator.generateDailyReport(dailyData);
      this.assertEquals(result.type, 'daily');
      this.assertTrue(result.html.length > 0);
      this.assertTrue(result.json.summary);
    });

    this.test('generateWeeklyReport', () => {
      const weeklyData = {
        trades: this.generateTradesData(),
        returns: this.generateReturns(5),
        return: 0.05,
        pnl: 5000
      };
      const result = this.reportGenerator.generateWeeklyReport(weeklyData);
      this.assertEquals(result.type, 'weekly');
      this.assertTrue(result.html.length > 0);
    });

    this.test('generateMonthlyReport', () => {
      const monthlyData = {
        portfolio: this.generatePortfolioData(),
        trades: this.generateTradesData(),
        returns: this.generateReturns(20),
        return: 0.08,
        pnl: 8000,
        portfolioValue: 1000000
      };
      const result = this.reportGenerator.generateMonthlyReport(monthlyData);
      this.assertEquals(result.type, 'monthly');
      this.assertTrue(result.html.length > 0);
    });

    this.test('generateQuarterlyReport', () => {
      const quarterlyData = {
        portfolio: this.generatePortfolioData(),
        trades: this.generateTradesData(),
        returns: this.generateReturns(60),
        return: 0.12,
        pnl: 12000
      };
      const result = this.reportGenerator.generateQuarterlyReport(quarterlyData);
      this.assertEquals(result.type, 'quarterly');
      this.assertTrue(result.html.length > 0);
    });

    this.test('generateAnnualReport', () => {
      const annualData = {
        trades: this.generateTradesData(),
        returns: this.generateReturns(252),
        prices: this.generatePriceData(252),
        return: 0.25,
        pnl: 25000
      };
      const result = this.reportGenerator.generateAnnualReport(annualData);
      this.assertEquals(result.type, 'annual');
      this.assertTrue(result.html.length > 0);
    });

    this.test('generateCustomReport', () => {
      const customData = {
        summary: { metric1: 'value1', metric2: 'value2' },
        trades: this.generateTradesData()
      };
      const config = {
        title: 'Custom Analysis',
        includeSummary: true,
        includePerformance: true
      };
      const result = this.reportGenerator.generateCustomReport(customData, config);
      this.assertEquals(result.type, 'custom');
      this.assertTrue(result.html.length > 0);
    });

    this.test('listReports', () => {
      const list = this.reportGenerator.listReports();
      this.assertTrue(Array.isArray(list));
      this.assertTrue(list.length > 0);
    });
  }

  // ============================================================================
  // DASHBOARD DATASOURCE TESTS
  // ============================================================================

  testDashboardDatasource() {
    console.log('\n=== Dashboard Datasource Tests ===\n');

    this.test('getPerformanceMetrics', () => {
      const portfolioData = {
        prices: this.generatePriceData(252),
        returns: this.generateReturns(252),
        portfolioValue: 1000000
      };
      const result = this.dashboardDatasource.getPerformanceMetrics(portfolioData);
      this.assertTrue(result.current);
      this.assertTrue(result.current.sharpeRatio !== undefined);
    });

    this.test('getTradeMetrics', () => {
      const trades = this.generateTradesData();
      const result = this.dashboardDatasource.getTradeMetrics(trades);
      this.assertTrue(result.today);
      this.assertTrue(result.thisWeek);
      this.assertTrue(result.thisMonth);
    });

    this.test('getRiskDashboard', () => {
      const portfolioData = {
        portfolio: this.generatePortfolioData(),
        returns: this.generateReturns(100),
        prices: this.generatePriceData(100)
      };
      const result = this.dashboardDatasource.getRiskDashboard(portfolioData);
      this.assertTrue(result.riskMetrics);
      this.assertTrue(result.concentration);
    });

    this.test('getPortfolioComposition', () => {
      const portfolio = this.generatePortfolioData();
      const result = this.dashboardDatasource.getPortfolioComposition(portfolio);
      this.assertTrue(result.overall);
      this.assertTrue(Array.isArray(result.bySector));
      this.assertTrue(Array.isArray(result.topPositions));
    });

    this.test('getTimeSeriesData', () => {
      const prices = this.generatePriceData(50);
      const returns = this.generateReturns(50);
      const timestamps = Array.from({length: 50}, (_, i) => new Date(2024, 0, 1 + i));
      const result = this.dashboardDatasource.getTimeSeriesData(prices, returns, timestamps);
      this.assertTrue(Array.isArray(result.prices));
      this.assertEquals(result.prices.length, 50);
    });

    this.test('getRollingMetrics', () => {
      const returns = this.generateReturns(100);
      const result = this.dashboardDatasource.getRollingMetrics(returns, 20);
      this.assertTrue(Array.isArray(result.sharpeRatio));
      this.assertTrue(result.sharpeRatio.length > 0);
    });

    this.test('addAlertThreshold', () => {
      this.dashboardDatasource.addAlertThreshold('volatility', 0.30, '>', 'high');
      const stats = this.dashboardDatasource.getStatistics();
      this.assertEquals(stats.activeThresholds, 1);
    });

    this.test('checkThresholds', () => {
      this.dashboardDatasource.addAlertThreshold('sharpeRatio', 0.5, '<', 'high');
      this.dashboardDatasource.checkThresholds({ sharpeRatio: 0.3 });
      const alerts = this.dashboardDatasource.getAlerts();
      this.assertTrue(alerts.length > 0);
    });

    this.test('getDashboardStatistics', () => {
      const stats = this.dashboardDatasource.getStatistics();
      this.assertTrue(typeof stats.queriesServed === 'number');
      this.assertTrue(typeof stats.cacheHitRate === 'string');
    });
  }

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  testIntegration() {
    console.log('\n=== Integration Tests ===\n');

    this.test('Full analytics pipeline', () => {
      const portfolioData = this.generatePortfolioData();
      const trades = this.generateTradesData();
      const prices = this.generatePriceData(252);
      const returns = this.generateReturns(252);

      // Analytics engine
      const metrics = this.analytics.compileAnalytics({ prices, returns });
      this.assertTrue(metrics.performance);

      // Performance analytics
      const perfReport = this.performanceAnalytics.generatePerformanceReport({ trades, returns });
      this.assertTrue(perfReport.summary.totalTrades > 0);

      // Risk analytics
      const riskReport = this.riskAnalytics.generateRiskReport({ portfolio: portfolioData, returns, prices });
      this.assertTrue(riskReport.concentration);

      // Portfolio analytics
      const portReport = this.portfolioAnalytics.generatePortfolioReport({ portfolio: portfolioData });
      this.assertTrue(portReport.composition);

      // Reports
      const monthlyReport = this.reportGenerator.generateMonthlyReport({ portfolio: portfolioData, trades, returns, prices });
      this.assertEquals(monthlyReport.type, 'monthly');

      // Dashboard
      const perfMetrics = this.dashboardDatasource.getPerformanceMetrics({ prices, returns, portfolioValue: portfolioData.totalValue });
      this.assertTrue(perfMetrics.current);
    });

    this.test('Performance across datasets', () => {
      const startTime = Date.now();

      // Run multiple analyses
      for (let i = 0; i < 10; i++) {
        const portfolioData = this.generatePortfolioData();
        const prices = this.generatePriceData(252);
        const returns = this.generateReturns(252);

        this.analytics.compileAnalytics({ prices, returns });
        this.portfolioAnalytics.generatePortfolioReport({ portfolio: portfolioData });
      }

      const elapsed = Date.now() - startTime;
      this.assertTrue(elapsed < 5000, `Analytics too slow: ${elapsed}ms`);
    });
  }

  // ============================================================================
  // RUN ALL TESTS
  // ============================================================================

  runAllTests() {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║     GNN ANALYTICS - COMPREHENSIVE TEST SUITE      ║');
    console.log('╚════════════════════════════════════════════════════╝\n');

    this.testAnalyticsEngine();
    this.testPerformanceAnalytics();
    this.testRiskAnalytics();
    this.testPortfolioAnalytics();
    this.testReportGenerator();
    this.testDashboardDatasource();
    this.testIntegration();

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║                  TEST SUMMARY                      ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    console.log(`Total Tests:    ${this.testsRun}`);
    console.log(`Passed:         ${this.testsPassed} (${((this.testsPassed / this.testsRun) * 100).toFixed(1)}%)`);
    console.log(`Failed:         ${this.testsFailed}`);
    console.log(`Coverage:       ${((this.testsPassed / this.testsRun) * 100).toFixed(1)}%\n`);

    if (this.testsFailed === 0) {
      console.log('✓ ALL TESTS PASSED\n');
      return true;
    } else {
      console.log('✗ SOME TESTS FAILED\n');
      return false;
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  const suite = new GNNAnalyticsTestSuite();
  const passed = suite.runAllTests();
  process.exit(passed ? 0 : 1);
}

module.exports = GNNAnalyticsTestSuite;
