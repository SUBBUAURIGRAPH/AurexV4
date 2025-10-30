/**
 * Walk-Forward Optimizer Tests
 * Comprehensive test suite for walk-forward optimization
 *
 * Test Coverage:
 * - Window calculation and rolling windows
 * - In-sample parameter optimization
 * - Out-of-sample validation
 * - Parameter stability analysis
 * - Overfitting detection
 * - Performance degradation tracking
 */

const WalkForwardOptimizer = require('./walk-forward-optimizer');

describe('WalkForwardOptimizer', () => {
  let optimizer;
  let mockBacktestingEngine;
  let mockLogger;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Mock backtesting engine
    mockBacktestingEngine = {
      backtest: jest.fn()
    };

    optimizer = new WalkForwardOptimizer(mockBacktestingEngine, mockLogger);
  });

  describe('Initialization', () => {
    test('should initialize with backtesting engine and logger', () => {
      expect(optimizer.engine).toBe(mockBacktestingEngine);
      expect(optimizer.logger).toBe(mockLogger);
      expect(optimizer.optimizations).toEqual(new Map());
    });
  });

  describe('Window Calculation', () => {
    test('should calculate rolling windows correctly', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-31');
      const inSampleDays = 30;
      const outOfSampleDays = 15;
      const stepDays = 15;

      const windows = optimizer.calculateWindows(
        startDate,
        endDate,
        inSampleDays,
        outOfSampleDays,
        stepDays
      );

      expect(windows.length).toBeGreaterThan(0);
      windows.forEach(window => {
        expect(window).toHaveProperty('insampleStart');
        expect(window).toHaveProperty('insampleEnd');
        expect(window).toHaveProperty('oosStart');
        expect(window).toHaveProperty('oosEnd');
      });
    });

    test('should ensure each window has correct date ranges', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const inSampleDays = 60;
      const outOfSampleDays = 30;
      const stepDays = 30;

      const windows = optimizer.calculateWindows(
        startDate,
        endDate,
        inSampleDays,
        outOfSampleDays,
        stepDays
      );

      windows.forEach(window => {
        const insampleSpan = (window.insampleEnd - window.insampleStart) / (24 * 60 * 60 * 1000);
        const oosSpan = (window.oosEnd - window.oosStart) / (24 * 60 * 60 * 1000);

        expect(Math.round(insampleSpan)).toBe(inSampleDays);
        expect(Math.round(oosSpan)).toBe(outOfSampleDays);
      });
    });

    test('should throw error if insufficient data span', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-10'); // Only 10 days
      const inSampleDays = 30;
      const outOfSampleDays = 15;

      expect(() => {
        optimizer.calculateWindows(startDate, endDate, inSampleDays, outOfSampleDays, 1);
      }).toThrow('Insufficient data for walk-forward analysis');
    });

    test('should not create windows beyond end date', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-31');
      const inSampleDays = 30;
      const outOfSampleDays = 15;
      const stepDays = 15;

      const windows = optimizer.calculateWindows(
        startDate,
        endDate,
        inSampleDays,
        outOfSampleDays,
        stepDays
      );

      windows.forEach(window => {
        expect(window.oosEnd <= endDate).toBe(true);
      });
    });
  });

  describe('Parameter Combinations', () => {
    test('should generate all parameter combinations', () => {
      const parameterGrid = {
        period: [10, 20],
        threshold: [0.1, 0.2, 0.3]
      };

      const combinations = optimizer.generateParameterCombinations(parameterGrid);

      // 2 * 3 = 6 combinations
      expect(combinations).toHaveLength(6);
    });

    test('should handle single parameter', () => {
      const parameterGrid = {
        period: [10, 20, 30]
      };

      const combinations = optimizer.generateParameterCombinations(parameterGrid);

      expect(combinations).toHaveLength(3);
      combinations.forEach(combo => {
        expect(combo).toHaveProperty('period');
        expect([10, 20, 30]).toContain(combo.period);
      });
    });

    test('should handle empty parameter grid', () => {
      const parameterGrid = {};

      const combinations = optimizer.generateParameterCombinations(parameterGrid);

      expect(combinations).toHaveLength(1);
      expect(combinations[0]).toEqual({});
    });

    test('should handle large parameter grids', () => {
      const parameterGrid = {
        a: [1, 2, 3, 4, 5],
        b: [10, 20, 30],
        c: [100, 200]
      };

      const combinations = optimizer.generateParameterCombinations(parameterGrid);

      // 5 * 3 * 2 = 30 combinations
      expect(combinations).toHaveLength(30);
    });
  });

  describe('Parameter Optimization', () => {
    test('should find best parameters for in-sample period', async () => {
      mockBacktestingEngine.backtest
        .mockResolvedValueOnce({ metrics: { sharpeRatio: 0.8 } })
        .mockResolvedValueOnce({ metrics: { sharpeRatio: 1.5 } })
        .mockResolvedValueOnce({ metrics: { sharpeRatio: 1.2 } });

      const config = {
        symbol: 'AAPL',
        parameterGrid: {
          period: [10, 20, 30]
        },
        objectiveMetric: 'sharpeRatio'
      };

      const result = await optimizer.optimizeParameters(
        config,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toHaveProperty('bestParameters');
      expect(result).toHaveProperty('metrics');
      expect(result.metrics.sharpeRatio).toBe(1.5);
      expect(result.bestParameters).toHaveProperty('period');
      expect(mockBacktestingEngine.backtest).toHaveBeenCalledTimes(3);
    });

    test('should optimize on any objective metric', async () => {
      mockBacktestingEngine.backtest
        .mockResolvedValueOnce({ metrics: { totalReturn: 5 } })
        .mockResolvedValueOnce({ metrics: { totalReturn: 12 } });

      const config = {
        symbol: 'AAPL',
        parameterGrid: {
          period: [10, 20]
        },
        objectiveMetric: 'totalReturn'
      };

      const result = await optimizer.optimizeParameters(
        config,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.metrics.totalReturn).toBe(12);
    });
  });

  describe('Parameter Stability Analysis', () => {
    test('should calculate coefficient of variation for stability', () => {
      const parameters = [
        { period: 10, threshold: 0.1 },
        { period: 12, threshold: 0.1 },
        { period: 11, threshold: 0.1 }
      ];

      const stability = optimizer.analyzeParameterStability(parameters);

      expect(stability).toHaveProperty('period');
      expect(stability.period).toHaveProperty('mean');
      expect(stability.period).toHaveProperty('std');
      expect(stability.period).toHaveProperty('coefficientOfVariation');
      expect(stability.period).toHaveProperty('isStable');
    });

    test('should mark parameters as stable if CV < 0.2', () => {
      const parameters = [
        { period: 10 },
        { period: 10.5 },
        { period: 10.2 }
      ];

      const stability = optimizer.analyzeParameterStability(parameters);

      expect(stability.period.coefficientOfVariation).toBeLessThan(0.2);
      expect(stability.period.isStable).toBe(true);
    });

    test('should mark parameters as unstable if CV >= 0.2', () => {
      const parameters = [
        { period: 5 },
        { period: 15 },
        { period: 25 }
      ];

      const stability = optimizer.analyzeParameterStability(parameters);

      expect(stability.period.coefficientOfVariation).toBeGreaterThanOrEqual(0.2);
      expect(stability.period.isStable).toBe(false);
    });

    test('should handle empty parameter array', () => {
      const stability = optimizer.analyzeParameterStability([]);

      expect(stability).toEqual({});
    });

    test('should ignore non-numeric parameters', () => {
      const parameters = [
        { period: 10, strategy: 'ma' },
        { period: 10, strategy: 'ema' }
      ];

      const stability = optimizer.analyzeParameterStability(parameters);

      expect(stability).toHaveProperty('period');
      expect(stability).not.toHaveProperty('strategy');
    });
  });

  describe('Overfitting Detection', () => {
    test('should detect overfitting with > 5% avg degradation', () => {
      const windows = [
        { performance: { isReturn: 10, oosReturn: 5, degradation: 5 } },
        { performance: { isReturn: 12, oosReturn: 5.5, degradation: 6.5 } }
      ];

      const isOverfit = optimizer.detectOverfitting(windows);

      expect(isOverfit).toBe(true);
    });

    test('should detect overfitting with > 15% max degradation', () => {
      const windows = [
        { performance: { isReturn: 10, oosReturn: 9, degradation: 1 } },
        { performance: { isReturn: 12, oosReturn: -5, degradation: 17 } }
      ];

      const isOverfit = optimizer.detectOverfitting(windows);

      expect(isOverfit).toBe(true);
    });

    test('should mark as not overfit with low degradation', () => {
      const windows = [
        { performance: { isReturn: 10, oosReturn: 9, degradation: 1 } },
        { performance: { isReturn: 12, oosReturn: 11, degradation: 1 } }
      ];

      const isOverfit = optimizer.detectOverfitting(windows);

      expect(isOverfit).toBe(false);
    });
  });

  describe('Summary Statistics Calculation', () => {
    test('should calculate comprehensive summary statistics', () => {
      const windows = [
        {
          performance: { isReturn: 10, oosReturn: 9, degradation: 1 },
          bestParameters: { period: 10 }
        },
        {
          performance: { isReturn: 12, oosReturn: 11, degradation: 1 },
          bestParameters: { period: 12 }
        },
        {
          performance: { isReturn: 8, oosReturn: 7, degradation: 1 },
          bestParameters: { period: 8 }
        }
      ];

      const summary = optimizer.calculateSummaryStats(windows);

      expect(summary).toHaveProperty('totalWindows');
      expect(summary).toHaveProperty('oosMeanReturn');
      expect(summary).toHaveProperty('oosStdReturn');
      expect(summary).toHaveProperty('oosMedianReturn');
      expect(summary).toHaveProperty('isMeanReturn');
      expect(summary).toHaveProperty('oosMinReturn');
      expect(summary).toHaveProperty('oosMaxReturn');
      expect(summary).toHaveProperty('degradationMean');
      expect(summary).toHaveProperty('degradationMax');
    });

    test('should calculate correct mean OOS return', () => {
      const windows = [
        { performance: { isReturn: 10, oosReturn: 8, degradation: 2 } },
        { performance: { isReturn: 12, oosReturn: 10, degradation: 2 } },
        { performance: { isReturn: 10, oosReturn: 9, degradation: 1 } }
      ];

      const summary = optimizer.calculateSummaryStats(windows);

      expect(summary.oosMeanReturn).toBeCloseTo((8 + 10 + 9) / 3, 5);
    });

    test('should track min and max OOS returns', () => {
      const windows = [
        { performance: { isReturn: 10, oosReturn: 5, degradation: 5 } },
        { performance: { isReturn: 15, oosReturn: 15, degradation: 0 } },
        { performance: { isReturn: 8, oosReturn: 2, degradation: 6 } }
      ];

      const summary = optimizer.calculateSummaryStats(windows);

      expect(summary.oosMinReturn).toBe(2);
      expect(summary.oosMaxReturn).toBe(15);
    });
  });

  describe('Statistical Calculations', () => {
    test('should calculate mean correctly', () => {
      const values = [10, 20, 30];
      const mean = optimizer.calculateMean(values);

      expect(mean).toBe(20);
    });

    test('should calculate standard deviation', () => {
      const values = [1, 2, 3, 4, 5];
      const std = optimizer.calculateStd(values);

      expect(std).toBeCloseTo(1.414, 2);
    });

    test('should calculate median for odd number of values', () => {
      const values = [1, 3, 5, 7, 9];
      const median = optimizer.calculateMedian(values);

      expect(median).toBe(5);
    });

    test('should calculate median for even number of values', () => {
      const values = [1, 2, 3, 4];
      const median = optimizer.calculateMedian(values);

      expect(median).toBe(2.5);
    });

    test('should handle single value', () => {
      expect(optimizer.calculateMean([5])).toBe(5);
      expect(optimizer.calculateMedian([5])).toBe(5);
    });
  });

  describe('Optimization Storage', () => {
    test('should store optimization by ID', () => {
      const optimization = {
        id: 'opt-id-1',
        summary: { totalWindows: 5 }
      };

      optimizer.optimizations.set(optimization.id, optimization);
      const retrieved = optimizer.getOptimization('opt-id-1');

      expect(retrieved).toEqual(optimization);
    });

    test('should list all optimizations', () => {
      optimizer.optimizations.set('opt-1', { id: 'opt-1' });
      optimizer.optimizations.set('opt-2', { id: 'opt-2' });

      const list = optimizer.listOptimizations();

      expect(list).toHaveLength(2);
    });
  });

  describe('Event Emission', () => {
    test('should emit wfo:started event', (done) => {
      mockBacktestingEngine.backtest
        .mockResolvedValue({ metrics: { sharpeRatio: 1.0 } });

      optimizer.on('wfo:started', (data) => {
        expect(data).toHaveProperty('optimizationId');
        expect(data).toHaveProperty('config');
        done();
      });

      optimizer.runWalkForwardOptimization({
        symbol: 'AAPL',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        insamplePeriod: 60,
        outofSamplePeriod: 30,
        stepSize: 30,
        parameterGrid: { period: [10] },
        objectiveMetric: 'sharpeRatio'
      }).catch(() => {});
    });

    test('should emit wfo:completed event', (done) => {
      mockBacktestingEngine.backtest
        .mockResolvedValue({ metrics: { sharpeRatio: 1.0 } });

      optimizer.on('wfo:completed', (data) => {
        expect(data).toHaveProperty('optimizationId');
        expect(data).toHaveProperty('summary');
        done();
      });

      optimizer.runWalkForwardOptimization({
        symbol: 'AAPL',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-06-30'),
        insamplePeriod: 60,
        outofSamplePeriod: 30,
        stepSize: 30,
        parameterGrid: { period: [10] },
        objectiveMetric: 'sharpeRatio'
      }).catch(() => {});
    });

    test('should emit wfo:error event on failure', (done) => {
      mockBacktestingEngine.backtest
        .mockRejectedValue(new Error('Backtest failed'));

      optimizer.on('wfo:error', (data) => {
        expect(data).toHaveProperty('optimizationId');
        expect(data).toHaveProperty('error');
        done();
      });

      optimizer.runWalkForwardOptimization({
        symbol: 'AAPL',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-06-30'),
        insamplePeriod: 60,
        outofSamplePeriod: 30,
        stepSize: 30,
        parameterGrid: { period: [10] },
        objectiveMetric: 'sharpeRatio'
      }).catch(() => {});
    });
  });

  describe('Error Handling', () => {
    test('should throw error with invalid date range', async () => {
      await expect(
        optimizer.runWalkForwardOptimization({
          symbol: 'AAPL',
          startDate: new Date('2024-12-31'),
          endDate: new Date('2024-01-01'),
          insamplePeriod: 60,
          outofSamplePeriod: 30,
          stepSize: 30,
          parameterGrid: { period: [10] },
          objectiveMetric: 'sharpeRatio'
        })
      ).rejects.toThrow();
    });
  });
});
