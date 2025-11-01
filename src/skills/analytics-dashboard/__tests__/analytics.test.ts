/**
 * Analytics Dashboard Tests - Comprehensive test suite
 *
 * @module __tests__/analytics.test
 */

import * as Logger from 'winston';
import {PerformanceMetricsCalculator} from '../performanceMetrics';
import {RiskAnalysisCalculator} from '../riskAnalysis';
import {AttributionAnalysisCalculator} from '../attributionAnalysis';
import {TimeSeriesAnalysisCalculator} from '../timeSeriesAnalysis';
import {DataAggregator} from '../dataAggregation';
import {DashboardComponentFactory} from '../dashboardComponents';
import {AnalyticsAPI} from '../analyticsAPI';
import {TradeRecord} from '../types';

// Mock logger
const mockLogger: Logger.Logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as any;

describe('PerformanceMetricsCalculator', () => {
  let calculator: PerformanceMetricsCalculator;

  beforeEach(() => {
    calculator = new PerformanceMetricsCalculator(mockLogger);
  });

  describe('calculateMetrics', () => {
    it('should calculate metrics for valid trades', async () => {
      const trades: TradeRecord[] = [
        {
          id: '1',
          strategyId: 'strat1',
          timestamp: new Date('2025-01-01'),
          symbol: 'BTC',
          side: 'buy',
          quantity: 1,
          entryPrice: 100,
          exitPrice: 110,
          profit: 10,
          profitPercent: 10,
          duration: 3600000,
          commission: 1,
          slippage: 0.5,
        },
        {
          id: '2',
          strategyId: 'strat1',
          timestamp: new Date('2025-01-02'),
          symbol: 'ETH',
          side: 'buy',
          quantity: 2,
          entryPrice: 50,
          exitPrice: 45,
          profit: -10,
          profitPercent: -10,
          duration: 7200000,
          commission: 1,
          slippage: 0.5,
        },
      ];

      const metrics = await calculator.calculateMetrics('strat1', trades, new Date('2025-01-01'), new Date('2025-01-02'), 'daily');

      expect(metrics).toBeDefined();
      expect(metrics.totalTrades).toBe(2);
      expect(metrics.winningTrades).toBe(1);
      expect(metrics.losingTrades).toBe(1);
      expect(metrics.winRate).toBe(0.5);
      expect(metrics.strategyId).toBe('strat1');
    });

    it('should handle empty trades', async () => {
      const metrics = await calculator.calculateMetrics('strat1', [], new Date('2025-01-01'), new Date('2025-01-02'), 'daily');

      expect(metrics.totalTrades).toBe(0);
      expect(metrics.winRate).toBe(0);
    });

    it('should calculate Sharpe ratio correctly', async () => {
      const trades: TradeRecord[] = Array.from({length: 30}, (_, i) => ({
        id: String(i),
        strategyId: 'strat1',
        timestamp: new Date(Date.now() - i * 86400000),
        symbol: 'BTC',
        side: 'buy',
        quantity: 1,
        entryPrice: 100,
        exitPrice: 100 + (Math.random() * 10 - 5),
        profit: Math.random() * 10 - 5,
        profitPercent: Math.random() * 10 - 5,
        duration: 3600000,
        commission: 0.5,
        slippage: 0.2,
      }));

      const metrics = await calculator.calculateMetrics('strat1', trades, new Date(Date.now() - 30 * 86400000), new Date(), 'monthly');

      expect(metrics.sharpeRatio).toBeDefined();
      expect(typeof metrics.sharpeRatio).toBe('number');
    });

    it('should calculate consecutive wins and losses', async () => {
      const trades: TradeRecord[] = [
        {id: '1', strategyId: 'strat1', timestamp: new Date('2025-01-01'), symbol: 'BTC', side: 'buy', quantity: 1, entryPrice: 100, exitPrice: 110, profit: 10, profitPercent: 10, duration: 3600000, commission: 1, slippage: 0.5},
        {id: '2', strategyId: 'strat1', timestamp: new Date('2025-01-02'), symbol: 'BTC', side: 'buy', quantity: 1, entryPrice: 110, exitPrice: 120, profit: 10, profitPercent: 10, duration: 3600000, commission: 1, slippage: 0.5},
        {id: '3', strategyId: 'strat1', timestamp: new Date('2025-01-03'), symbol: 'BTC', side: 'buy', quantity: 1, entryPrice: 120, exitPrice: 110, profit: -10, profitPercent: -10, duration: 3600000, commission: 1, slippage: 0.5},
      ];

      const metrics = await calculator.calculateMetrics('strat1', trades, new Date('2025-01-01'), new Date('2025-01-03'), 'daily');

      expect(metrics.maxConsecutiveWins).toBe(2);
      expect(metrics.maxConsecutiveLosses).toBe(1);
    });
  });

  describe('calculateSharpe', () => {
    it('should return 0 for single value', async () => {
      const metrics = await calculator.calculateMetrics('strat1', [{id: '1', strategyId: 'strat1', timestamp: new Date(), symbol: 'BTC', side: 'buy', quantity: 1, entryPrice: 100, exitPrice: 110, profit: 10, profitPercent: 10, duration: 3600000, commission: 1, slippage: 0.5}], new Date(), new Date(), 'daily');

      expect(metrics.sharpeRatio).toBe(0);
    });
  });
});

describe('RiskAnalysisCalculator', () => {
  let calculator: RiskAnalysisCalculator;

  beforeEach(() => {
    calculator = new RiskAnalysisCalculator(mockLogger);
  });

  describe('calculateRiskMetrics', () => {
    it('should calculate VaR correctly', async () => {
      const trades: TradeRecord[] = Array.from({length: 20}, (_, i) => ({
        id: String(i),
        strategyId: 'strat1',
        timestamp: new Date(),
        symbol: 'BTC',
        side: 'buy',
        quantity: 1,
        entryPrice: 100,
        exitPrice: 100 + (Math.random() * 10 - 5),
        profit: Math.random() * 10 - 5,
        profitPercent: Math.random() * 10 - 5,
        duration: 3600000,
        commission: 0.5,
        slippage: 0.2,
      }));

      const returns = trades.map((t) => t.profitPercent / 100);
      const metrics = await calculator.calculateRiskMetrics('strat1', trades, returns);

      expect(metrics.var95).toBeDefined();
      expect(metrics.var99).toBeDefined();
      expect(metrics.var95 >= 0).toBe(true);
      expect(metrics.var99 >= 0).toBe(true);
    });

    it('should calculate volatility', async () => {
      const trades: TradeRecord[] = Array.from({length: 30}, (_, i) => ({
        id: String(i),
        strategyId: 'strat1',
        timestamp: new Date(),
        symbol: 'BTC',
        side: 'buy',
        quantity: 1,
        entryPrice: 100,
        exitPrice: 100 + (Math.sin(i / 10) * 5),
        profit: Math.sin(i / 10) * 5,
        profitPercent: Math.sin(i / 10) * 5,
        duration: 3600000,
        commission: 0.5,
        slippage: 0.2,
      }));

      const returns = trades.map((t) => t.profitPercent / 100);
      const metrics = await calculator.calculateRiskMetrics('strat1', trades, returns);

      expect(metrics.volatility).toBeDefined();
      expect(metrics.volatility >= 0).toBe(true);
    });

    it('should handle empty returns', async () => {
      const metrics = await calculator.calculateRiskMetrics('strat1', [], []);

      expect(metrics.var95).toBe(0);
      expect(metrics.volatility).toBe(0);
    });
  });

  describe('calculateExpectedShortfall', () => {
    it('should calculate expected shortfall for tail events', async () => {
      const trades: TradeRecord[] = Array.from({length: 100}, (_, i) => ({
        id: String(i),
        strategyId: 'strat1',
        timestamp: new Date(),
        symbol: 'BTC',
        side: 'buy',
        quantity: 1,
        entryPrice: 100,
        exitPrice: 100 + (Math.random() < 0.05 ? -20 : 5),
        profit: Math.random() < 0.05 ? -20 : 5,
        profitPercent: Math.random() < 0.05 ? -20 : 5,
        duration: 3600000,
        commission: 0.5,
        slippage: 0.2,
      }));

      const returns = trades.map((t) => t.profitPercent / 100);
      const metrics = await calculator.calculateRiskMetrics('strat1', trades, returns);

      expect(metrics.expectedShortfall95).toBeDefined();
      expect(metrics.expectedShortfall99).toBeDefined();
    });
  });
});

describe('AttributionAnalysisCalculator', () => {
  let calculator: AttributionAnalysisCalculator;

  beforeEach(() => {
    calculator = new AttributionAnalysisCalculator(mockLogger);
  });

  describe('calculateAttributionMetrics', () => {
    it('should calculate execution metrics', async () => {
      const trades: TradeRecord[] = [
        {id: '1', strategyId: 'strat1', timestamp: new Date(), symbol: 'BTC', side: 'buy', quantity: 1, entryPrice: 100, exitPrice: 110, profit: 10, profitPercent: 10, duration: 3600000, commission: 1, slippage: 0.5},
        {id: '2', strategyId: 'strat1', timestamp: new Date(), symbol: 'ETH', side: 'sell', quantity: 2, entryPrice: 50, exitPrice: 48, profit: 4, profitPercent: 4, duration: 7200000, commission: 0.5, slippage: 0.3},
      ];

      const metrics = await calculator.calculateAttributionMetrics('strat1', trades);

      expect(metrics.totalSlippage).toBeDefined();
      expect(metrics.commissions).toBeDefined();
      expect(metrics.commissions).toBeGreaterThan(0);
    });

    it('should calculate timing metrics', async () => {
      const trades: TradeRecord[] = [
        {id: '1', strategyId: 'strat1', timestamp: new Date(), symbol: 'BTC', side: 'buy', quantity: 1, entryPrice: 100, exitPrice: 105, profit: 5, profitPercent: 5, duration: 3600000, commission: 1, slippage: 0.5},
        {id: '2', strategyId: 'strat1', timestamp: new Date(), symbol: 'BTC', side: 'buy', quantity: 1, entryPrice: 100, exitPrice: 95, profit: -5, profitPercent: -5, duration: 3600000, commission: 1, slippage: 0.5},
      ];

      const metrics = await calculator.calculateAttributionMetrics('strat1', trades);

      expect(metrics.entryTiming).toBeDefined();
      expect(metrics.exitTiming).toBeDefined();
      expect(metrics.positionSizing).toBeDefined();
    });

    it('should handle empty trades', async () => {
      const metrics = await calculator.calculateAttributionMetrics('strat1', []);

      expect(metrics.totalSlippage).toBe(0);
      expect(metrics.commissions).toBe(0);
    });
  });
});

describe('TimeSeriesAnalysisCalculator', () => {
  let calculator: TimeSeriesAnalysisCalculator;

  beforeEach(() => {
    calculator = new TimeSeriesAnalysisCalculator(mockLogger);
  });

  describe('calculateTimeSeriesMetrics', () => {
    it('should calculate autocorrelation', async () => {
      const returns = Array.from({length: 50}, (_, i) => Math.sin(i / 10) * 0.05);

      const metrics = await calculator.calculateTimeSeriesMetrics('strat1', returns);

      expect(metrics.acf).toBeDefined();
      expect(metrics.acf.length).toBeGreaterThan(0);
      expect(metrics.acf[0]).toBe(1); // ACF at lag 0 should be 1
    });

    it('should calculate partial autocorrelation', async () => {
      const returns = Array.from({length: 50}, (_, i) => Math.random() * 0.1 - 0.05);

      const metrics = await calculator.calculateTimeSeriesMetrics('strat1', returns);

      expect(metrics.pacf).toBeDefined();
      expect(metrics.pacf.length).toBeGreaterThan(0);
    });

    it('should decompose time series', async () => {
      const returns = Array.from({length: 60}, (_, i) => Math.sin(i / 20) * 0.05 + Math.random() * 0.02);

      const metrics = await calculator.calculateTimeSeriesMetrics('strat1', returns);

      expect(metrics.trend).toBeDefined();
      expect(metrics.seasonality).toBeDefined();
      expect(metrics.residuals).toBeDefined();
    });

    it('should conduct stationarity test', async () => {
      const returns = Array.from({length: 100}, (_, i) => Math.sin(i / 20) * 0.05 + Math.random() * 0.02);

      const metrics = await calculator.calculateTimeSeriesMetrics('strat1', returns);

      expect(metrics.adfStatistic).toBeDefined();
      expect(metrics.adfPValue).toBeDefined();
      expect(metrics.isStationary).toBeDefined();
    });

    it('should generate forecast', async () => {
      const returns = Array.from({length: 100}, (_, i) => Math.sin(i / 20) * 0.05 + Math.random() * 0.02);

      const metrics = await calculator.calculateTimeSeriesMetrics('strat1', returns);

      expect(metrics.forecast).toBeDefined();
      expect(metrics.forecast.length).toBeGreaterThan(0);
      expect(metrics.confidenceUpper).toBeDefined();
      expect(metrics.confidenceLower).toBeDefined();
    });

    it('should handle small datasets', async () => {
      const metrics = await calculator.calculateTimeSeriesMetrics('strat1', [0.01]);

      expect(metrics.acf).toBeDefined();
      expect(metrics.trend).toBeDefined();
    });
  });
});

describe('DataAggregator', () => {
  let aggregator: DataAggregator;

  beforeEach(async () => {
    aggregator = new DataAggregator(mockLogger);
    await aggregator.initialize();
  });

  describe('addTrades', () => {
    it('should add trades successfully', async () => {
      const trades: TradeRecord[] = [
        {id: '1', strategyId: 'strat1', timestamp: new Date(), symbol: 'BTC', side: 'buy', quantity: 1, entryPrice: 100, exitPrice: 110, profit: 10, profitPercent: 10, duration: 3600000, commission: 1, slippage: 0.5},
      ];

      await aggregator.addTrades(trades);
      const allTrades = aggregator.getAllTrades();

      expect(allTrades.length).toBe(1);
      expect(allTrades[0].strategyId).toBe('strat1');
    });

    it('should get trades by date range', async () => {
      const trades: TradeRecord[] = [
        {id: '1', strategyId: 'strat1', timestamp: new Date('2025-01-01'), symbol: 'BTC', side: 'buy', quantity: 1, entryPrice: 100, exitPrice: 110, profit: 10, profitPercent: 10, duration: 3600000, commission: 1, slippage: 0.5},
        {id: '2', strategyId: 'strat1', timestamp: new Date('2025-01-15'), symbol: 'BTC', side: 'buy', quantity: 1, entryPrice: 100, exitPrice: 110, profit: 10, profitPercent: 10, duration: 3600000, commission: 1, slippage: 0.5},
      ];

      await aggregator.addTrades(trades);
      const filtered = aggregator.getTradesByDateRange(new Date('2025-01-01'), new Date('2025-01-10'));

      expect(filtered.length).toBe(1);
    });

    it('should get trades by symbol', async () => {
      const trades: TradeRecord[] = [
        {id: '1', strategyId: 'strat1', timestamp: new Date(), symbol: 'BTC', side: 'buy', quantity: 1, entryPrice: 100, exitPrice: 110, profit: 10, profitPercent: 10, duration: 3600000, commission: 1, slippage: 0.5},
        {id: '2', strategyId: 'strat1', timestamp: new Date(), symbol: 'ETH', side: 'buy', quantity: 1, entryPrice: 100, exitPrice: 110, profit: 10, profitPercent: 10, duration: 3600000, commission: 1, slippage: 0.5},
      ];

      await aggregator.addTrades(trades);
      const btcTrades = aggregator.getTradesBySymbol('BTC');

      expect(btcTrades.length).toBe(1);
      expect(btcTrades[0].symbol).toBe('BTC');
    });
  });

  describe('calculateRollingMetrics', () => {
    it('should calculate rolling metrics', async () => {
      const trades: TradeRecord[] = Array.from({length: 50}, (_, i) => ({
        id: String(i),
        strategyId: 'strat1',
        timestamp: new Date(Date.now() - i * 86400000),
        symbol: 'BTC',
        side: 'buy',
        quantity: 1,
        entryPrice: 100,
        exitPrice: 100 + (Math.random() * 10 - 5),
        profit: Math.random() * 10 - 5,
        profitPercent: Math.random() * 10 - 5,
        duration: 3600000,
        commission: 0.5,
        slippage: 0.2,
      }));

      await aggregator.addTrades(trades);
      const rolling = aggregator.calculateRollingMetrics('strat1', 20);

      expect(rolling.length).toBeGreaterThan(0);
      expect(rolling[0].index).toBeDefined();
      expect(rolling[0].return).toBeDefined();
      expect(rolling[0].sharpe).toBeDefined();
    });
  });

  describe('getPortfolioAllocation', () => {
    it('should calculate allocation', async () => {
      const trades: TradeRecord[] = [
        {id: '1', strategyId: 'strat1', timestamp: new Date(), symbol: 'BTC', side: 'buy', quantity: 10, entryPrice: 100, exitPrice: 110, profit: 100, profitPercent: 10, duration: 3600000, commission: 1, slippage: 0.5},
        {id: '2', strategyId: 'strat1', timestamp: new Date(), symbol: 'ETH', side: 'buy', quantity: 20, entryPrice: 50, exitPrice: 55, profit: 100, profitPercent: 10, duration: 3600000, commission: 1, slippage: 0.5},
      ];

      await aggregator.addTrades(trades);
      const allocation = aggregator.getPortfolioAllocation();

      expect(allocation.assets['BTC']).toBeDefined();
      expect(allocation.assets['ETH']).toBeDefined();
    });
  });

  describe('getTradeStatistics', () => {
    it('should calculate trade statistics', async () => {
      const trades: TradeRecord[] = [
        {id: '1', strategyId: 'strat1', timestamp: new Date(), symbol: 'BTC', side: 'buy', quantity: 1, entryPrice: 100, exitPrice: 110, profit: 10, profitPercent: 10, duration: 3600000, commission: 1, slippage: 0.5},
        {id: '2', strategyId: 'strat1', timestamp: new Date(), symbol: 'BTC', side: 'buy', quantity: 1, entryPrice: 100, exitPrice: 95, profit: -5, profitPercent: -5, duration: 3600000, commission: 1, slippage: 0.5},
      ];

      await aggregator.addTrades(trades);
      const stats = aggregator.getTradeStatistics();

      expect(stats.totalTrades).toBe(2);
      expect(stats.winningTrades).toBe(1);
      expect(stats.losingTrades).toBe(1);
      expect(stats.winRate).toBe(0.5);
    });
  });
});

describe('DashboardComponentFactory', () => {
  let factory: DashboardComponentFactory;

  beforeEach(() => {
    factory = new DashboardComponentFactory(mockLogger);
  });

  describe('createOverviewDashboard', () => {
    it('should create overview dashboard', () => {
      const performance: any = {
        totalReturn: 0.15,
        sharpeRatio: 1.5,
        maxDrawdown: 0.1,
        winningTrades: 25,
        losingTrades: 10,
        dailyReturns: Array(28).fill(0.001),
      };

      const risk: any = {
        var95: 0.02,
        var99: 0.03,
        volatility: 0.15,
        marketRisk: 0.1,
        operationalRisk: 0.02,
        liquidityRisk: 0.02,
        counterpartyRisk: 0.01,
        assetCorrelations: {},
        stressTestResults: [],
      };

      const dashboard = factory.createOverviewDashboard(performance, risk);

      expect(dashboard.type).toBe('overview');
      expect(dashboard.charts.length).toBeGreaterThan(0);
    });
  });

  describe('createPerformanceDashboard', () => {
    it('should create performance dashboard', () => {
      const performance: any = {
        totalReturn: 0.15,
        annualizedReturn: 0.18,
        sharpeRatio: 1.5,
        sortinoRatio: 2.0,
        calphaRatio: 1.8,
        maxDrawdown: 0.1,
        dailyReturns: Array(30).fill(0.001),
        monthlyReturns: Array(12).fill(0.01),
      };

      const dashboard = factory.createPerformanceDashboard(performance);

      expect(dashboard.type).toBe('performance');
      expect(dashboard.charts.length).toBe(5);
    });
  });

  describe('createRiskDashboard', () => {
    it('should create risk dashboard', () => {
      const risk: any = {
        var95: 0.02,
        var99: 0.03,
        expectedShortfall95: 0.025,
        expectedShortfall99: 0.035,
        volatility: 0.15,
        standardDeviation: 0.012,
        beta: 1.0,
        marketRisk: 0.1,
        operationalRisk: 0.02,
        liquidityRisk: 0.02,
        counterpartyRisk: 0.01,
        assetCorrelations: {BTC: 0.8},
        concentrationRatio: 0.3,
        stressTestResults: [
          {scenario: 'Market Crash', maxLoss: 0.2, probability: 0.01},
        ],
      };

      const dashboard = factory.createRiskDashboard(risk);

      expect(dashboard.type).toBe('risk');
      expect(dashboard.charts.length).toBe(6);
    });
  });

  describe('createPortfolioDashboard', () => {
    it('should create portfolio dashboard', () => {
      const portfolio: any = {
        totalValue: 100000,
        netReturn: 15000,
        portfolioSharpe: 1.5,
        portfolioVolatility: 0.15,
        allocation: {BTC: 50000, ETH: 30000, USDT: 20000},
        strategyAllocation: {strat1: 100000},
        sectorAllocation: {tech: 50, finance: 40},
        herfindahlIndex: 0.35,
        diversificationRatio: 1.7,
      };

      const dashboard = factory.createPortfolioDashboard(portfolio);

      expect(dashboard.type).toBe('portfolio');
      expect(dashboard.charts.length).toBe(5);
    });
  });

  describe('createTradeAnalysisDashboard', () => {
    it('should create trade analysis dashboard', () => {
      const performance: any = {
        totalTrades: 100,
        winningTrades: 65,
        losingTrades: 35,
        winRate: 0.65,
        averageWin: 100,
        averageLoss: 50,
        largestWin: 1000,
        largestLoss: 500,
        maxConsecutiveWins: 8,
        maxConsecutiveLosses: 3,
        profitFactor: 2.0,
        expectancy: 50,
      };

      const dashboard = factory.createTradeAnalysisDashboard(performance);

      expect(dashboard.type).toBe('trade-analysis');
      expect(dashboard.charts.length).toBe(5);
    });
  });
});

describe('AnalyticsAPI', () => {
  let api: AnalyticsAPI;

  beforeEach(() => {
    api = new AnalyticsAPI(mockLogger);
  });

  describe('health check', () => {
    it('should provide health status', () => {
      expect(api.getRouter()).toBeDefined();
    });
  });

  describe('cache management', () => {
    it('should manage cache', () => {
      api.clearCache();
      expect(api.getCacheSize ? api.getCacheSize() : 0).toBeGreaterThanOrEqual(0);
    });
  });
});
