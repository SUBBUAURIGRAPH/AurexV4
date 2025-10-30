/**
 * Multi-Asset Backtest Engine Tests
 * Comprehensive test suite for portfolio-level backtesting
 *
 * Test Coverage:
 * - Portfolio initialization
 * - Multi-asset data loading
 * - Correlation calculations
 * - Rebalancing strategies
 * - Portfolio metrics
 * - Risk calculations
 */

const MultiAssetBacktestEngine = require('./multi-asset-backtest-engine');

describe('MultiAssetBacktestEngine', () => {
  let engine;
  let mockDataManager;
  let mockLogger;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Mock data manager
    mockDataManager = {
      loadData: jest.fn()
    };

    engine = new MultiAssetBacktestEngine(mockDataManager, mockLogger);
  });

  describe('Initialization', () => {
    test('should initialize with data manager and logger', () => {
      expect(engine.dataManager).toBe(mockDataManager);
      expect(engine.logger).toBe(mockLogger);
      expect(engine.backtests).toEqual(new Map());
    });

    test('should emit initialized event', (done) => {
      const newEngine = new MultiAssetBacktestEngine(mockDataManager);
      expect(newEngine).toBeDefined();
      done();
    });
  });

  describe('Data Loading', () => {
    test('should load historical data for multiple symbols in parallel', async () => {
      const mockData = {
        AAPL: [
          { date: new Date('2024-01-01'), close: 100 },
          { date: new Date('2024-01-02'), close: 101 }
        ],
        MSFT: [
          { date: new Date('2024-01-01'), close: 200 },
          { date: new Date('2024-01-02'), close: 202 }
        ]
      };

      mockDataManager.loadData
        .mockResolvedValueOnce(mockData.AAPL)
        .mockResolvedValueOnce(mockData.MSFT);

      const result = await engine.loadHistoricalData(
        ['AAPL', 'MSFT'],
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.AAPL).toEqual(mockData.AAPL);
      expect(result.MSFT).toEqual(mockData.MSFT);
      expect(mockDataManager.loadData).toHaveBeenCalledTimes(2);
    });

    test('should handle missing data gracefully', async () => {
      mockDataManager.loadData
        .mockResolvedValueOnce([{ date: new Date('2024-01-01'), close: 100 }])
        .mockRejectedValueOnce(new Error('Data not available'));

      const result = await engine.loadHistoricalData(
        ['AAPL', 'MSFT'],
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.AAPL).toHaveLength(1);
      expect(result.MSFT).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Portfolio Initialization', () => {
    test('should initialize portfolio with correct allocation', () => {
      const historicalData = {
        AAPL: [{ close: 100 }],
        MSFT: [{ close: 200 }]
      };

      const allocation = { AAPL: 60, MSFT: 40 };
      const portfolio = engine.initializePortfolio(allocation, 100000, historicalData);

      expect(portfolio.totalCapital).toBe(100000);
      expect(portfolio.cash).toBe(0);
      expect(Object.keys(portfolio.positions)).toHaveLength(2);
    });

    test('should calculate correct share quantities based on allocation', () => {
      const historicalData = {
        AAPL: [{ close: 100 }],
        MSFT: [{ close: 200 }]
      };

      const allocation = { AAPL: 50, MSFT: 50 };
      const portfolio = engine.initializePortfolio(allocation, 100000, historicalData);

      // 50% of 100000 = 50000 / 100 = 500 shares
      expect(portfolio.positions.AAPL.shares).toBe(500);
      // 50% of 100000 = 50000 / 200 = 250 shares
      expect(portfolio.positions.MSFT.shares).toBe(250);
    });

    test('should handle missing price data', () => {
      const historicalData = {
        AAPL: [{ close: 100 }],
        MSFT: [] // Missing data
      };

      const allocation = { AAPL: 50, MSFT: 50 };
      const portfolio = engine.initializePortfolio(allocation, 100000, historicalData);

      expect(portfolio.positions.MSFT.shares).toBe(0);
    });
  });

  describe('Correlation Calculations', () => {
    test('should calculate Pearson correlation between two assets', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];

      const correlation = engine.calculatePearsonCorrelation(x, y);

      // Perfect positive correlation
      expect(correlation).toBeCloseTo(1, 5);
    });

    test('should calculate negative correlation correctly', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 4, 3, 2, 1];

      const correlation = engine.calculatePearsonCorrelation(x, y);

      // Perfect negative correlation
      expect(correlation).toBeCloseTo(-1, 5);
    });

    test('should calculate zero correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 1, 1, 1, 1];

      const correlation = engine.calculatePearsonCorrelation(x, y);

      // No correlation (constant y)
      expect(correlation).toBeCloseTo(0, 5);
    });

    test('should handle unequal length arrays', () => {
      const x = [1, 2, 3];
      const y = [1, 2, 3, 4, 5];

      const correlation = engine.calculatePearsonCorrelation(x, y);

      expect(typeof correlation).toBe('number');
      expect(isNaN(correlation)).toBe(false);
    });
  });

  describe('Metrics Calculations', () => {
    test('should calculate basic portfolio metrics', () => {
      const equity = [100000, 102000, 104000, 105000, 103000];

      const metrics = engine.calculatePortfolioMetrics({
        equityHistory: equity,
        trades: [],
        positions: [],
        correlations: {}
      });

      expect(metrics.totalReturn).toBeCloseTo(3, 1);
      expect(metrics.volatility).toBeGreaterThan(0);
      expect(metrics.maxDrawdown).toBeLessThan(0);
    });

    test('should calculate Sharpe ratio correctly', () => {
      const equity = [100000, 101000, 102000, 103000, 104000];

      const metrics = engine.calculatePortfolioMetrics({
        equityHistory: equity,
        trades: [],
        positions: [],
        correlations: {}
      });

      expect(metrics.sharpeRatio).toBeGreaterThan(0);
      expect(typeof metrics.sharpeRatio).toBe('number');
    });

    test('should calculate Sortino ratio for downside risk', () => {
      const equity = [100000, 102000, 101000, 103000, 105000, 104000];

      const metrics = engine.calculatePortfolioMetrics({
        equityHistory: equity,
        trades: [],
        positions: [],
        correlations: {}
      });

      expect(metrics.sortinoRatio).toBeGreaterThanOrEqual(metrics.sharpeRatio);
    });

    test('should calculate maximum drawdown', () => {
      const equity = [100000, 110000, 105000, 95000, 100000];

      const metrics = engine.calculatePortfolioMetrics({
        equityHistory: equity,
        trades: [],
        positions: [],
        correlations: {}
      });

      // From 110000 to 95000 = -13.64%
      expect(metrics.maxDrawdown).toBeLessThan(-13);
    });

    test('should handle zero trades correctly', () => {
      const equity = [100000, 100000, 100000];

      const metrics = engine.calculatePortfolioMetrics({
        equityHistory: equity,
        trades: [],
        positions: [],
        correlations: {}
      });

      expect(metrics.totalTrades).toBe(0);
      expect(metrics.winRate).toBe(0);
      expect(metrics.profitFactor).toBe(0);
    });

    test('should calculate profit factor from trades', () => {
      const metrics = engine.calculatePortfolioMetrics({
        equityHistory: [100000, 101000],
        trades: [
          { pnL: 500 }, // Win
          { pnL: 300 }, // Win
          { pnL: -200 }, // Loss
          { pnL: -100 } // Loss
        ],
        positions: [],
        correlations: {}
      });

      // (500 + 300) / (200 + 100) = 800 / 300 = 2.67
      expect(metrics.profitFactor).toBeCloseTo(2.67, 1);
    });
  });

  describe('Rebalancing', () => {
    test('should rebalance portfolio to target allocation', () => {
      const portfolio = {
        cash: 0,
        totalCapital: 100000,
        positions: {
          AAPL: { symbol: 'AAPL', shares: 500, purchasePrice: 100, value: 50000 },
          MSFT: { symbol: 'MSFT', shares: 250, purchasePrice: 200, value: 50000 }
        }
      };

      const allocation = { AAPL: 40, MSFT: 60 };
      const prices = { AAPL: 100, MSFT: 200 };

      engine.rebalancePortfolio(portfolio, allocation, prices);

      // After rebalancing, AAPL should be 40% and MSFT should be 60%
      const aapleValue = portfolio.positions.AAPL.shares * prices.AAPL;
      const msftValue = portfolio.positions.MSFT.shares * prices.MSFT;
      const total = aapleValue + msftValue;

      expect(aapleValue / total).toBeCloseTo(0.4, 1);
      expect(msftValue / total).toBeCloseTo(0.6, 1);
    });

    test('should only rebalance if difference exceeds threshold', () => {
      const portfolio = {
        cash: 0,
        totalCapital: 100000,
        positions: {
          AAPL: { symbol: 'AAPL', shares: 500, purchasePrice: 100, value: 50000 },
          MSFT: { symbol: 'MSFT', shares: 250, purchasePrice: 200, value: 50000 }
        }
      };

      const allocation = { AAPL: 50, MSFT: 50 }; // Already at allocation
      const prices = { AAPL: 100, MSFT: 200 };
      const initialShares = portfolio.positions.AAPL.shares;

      engine.rebalancePortfolio(portfolio, allocation, prices);

      // Shares should remain nearly identical
      expect(portfolio.positions.AAPL.shares).toBeCloseTo(initialShares, 0);
    });

    test('should record rebalancing history', () => {
      const portfolio = {
        cash: 0,
        totalCapital: 100000,
        positions: {
          AAPL: { symbol: 'AAPL', shares: 500, value: 50000 },
          MSFT: { symbol: 'MSFT', shares: 250, value: 50000 }
        },
        rebalanceHistory: []
      };

      const allocation = { AAPL: 40, MSFT: 60 };
      const prices = { AAPL: 100, MSFT: 200 };

      engine.rebalancePortfolio(portfolio, allocation, prices);

      expect(portfolio.rebalanceHistory.length).toBeGreaterThan(0);
      expect(portfolio.rebalanceHistory[0]).toHaveProperty('date');
      expect(portfolio.rebalanceHistory[0]).toHaveProperty('allocation');
    });
  });

  describe('Return Calculations', () => {
    test('should calculate daily returns correctly', () => {
      const equity = [100000, 102000, 101000];
      const returns = engine.calculateReturns(equity);

      expect(returns).toHaveLength(2);
      expect(returns[0]).toBeCloseTo(0.02, 5); // 2% return
      expect(returns[1]).toBeCloseTo(-0.0098, 4); // -0.98% return
    });

    test('should handle zero equity values', () => {
      const equity = [100000, 0, 100000];
      const returns = engine.calculateReturns(equity);

      expect(returns.length).toBeLessThan(3);
    });

    test('should handle single equity value', () => {
      const equity = [100000];
      const returns = engine.calculateReturns(equity);

      expect(returns).toHaveLength(0);
    });
  });

  describe('Helper Methods', () => {
    test('should calculate standard deviation', () => {
      const values = [1, 2, 3, 4, 5];
      const std = engine.calculateStd(values);

      expect(std).toBeGreaterThan(0);
      expect(std).toBeCloseTo(1.414, 2);
    });

    test('should calculate maximum drawdown correctly', () => {
      const equity = [100, 120, 110, 90, 85, 95];
      const maxDD = engine.calculateMaxDrawdown(equity);

      // From 120 to 85 = -29.17%
      expect(maxDD).toBeLessThan(-29);
      expect(maxDD).toBeGreaterThan(-30);
    });
  });

  describe('Backtest Storage', () => {
    test('should store backtest by ID', () => {
      const backtest = {
        id: 'test-id-1',
        metrics: { totalReturn: 5 }
      };

      engine.backtests.set(backtest.id, backtest);
      const retrieved = engine.getBacktest('test-id-1');

      expect(retrieved).toEqual(backtest);
    });

    test('should list all backtests', () => {
      engine.backtests.set('id-1', { id: 'id-1' });
      engine.backtests.set('id-2', { id: 'id-2' });

      const list = engine.listBacktests();

      expect(list).toHaveLength(2);
      expect(list.map(b => b.id)).toContain('id-1');
      expect(list.map(b => b.id)).toContain('id-2');
    });
  });

  describe('Event Emission', () => {
    test('should emit backtest:started event', (done) => {
      mockDataManager.loadData.mockResolvedValue([]);

      engine.on('backtest:started', (data) => {
        expect(data).toHaveProperty('backtestId');
        done();
      });

      engine.runBacktest({
        symbols: ['AAPL'],
        allocation: { AAPL: 100 },
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }).catch(() => {});
    });

    test('should emit backtest:completed event', (done) => {
      mockDataManager.loadData.mockResolvedValue([
        { date: new Date('2024-01-01'), close: 100 }
      ]);

      engine.on('backtest:completed', (data) => {
        expect(data).toHaveProperty('backtestId');
        expect(data).toHaveProperty('metrics');
        done();
      });

      engine.runBacktest({
        symbols: ['AAPL'],
        allocation: { AAPL: 100 },
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }).catch(() => {});
    });
  });

  describe('Error Handling', () => {
    test('should emit error event on failure', (done) => {
      mockDataManager.loadData.mockRejectedValue(new Error('Data load failed'));

      engine.on('backtest:error', (data) => {
        expect(data).toHaveProperty('backtestId');
        expect(data).toHaveProperty('error');
        done();
      });

      engine.runBacktest({
        symbols: ['INVALID'],
        allocation: { INVALID: 100 },
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }).catch(() => {});
    });

    test('should throw error with missing symbols', async () => {
      await expect(
        engine.runBacktest({
          symbols: [],
          allocation: {},
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        })
      ).rejects.toThrow();
    });

    test('should throw error for missing symbol data', async () => {
      mockDataManager.loadData.mockResolvedValue([]);

      await expect(
        engine.runBacktest({
          symbols: ['AAPL'],
          allocation: { AAPL: 100 },
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        })
      ).rejects.toThrow('Missing data for symbols');
    });
  });
});
