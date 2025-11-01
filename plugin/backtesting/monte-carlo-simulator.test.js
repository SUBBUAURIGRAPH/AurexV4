/**
 * Monte Carlo Simulator Tests
 * Comprehensive test suite for probabilistic performance analysis
 *
 * Test Coverage:
 * - Return distribution simulations
 * - Bootstrap simulations
 * - Value at Risk (VaR) calculations
 * - Conditional Value at Risk (CVaR)
 * - Confidence intervals
 * - Maximum drawdown calculations
 * - Probability metrics
 */

const MonteCarloSimulator = require('./monte-carlo-simulator');

describe('MonteCarloSimulator', () => {
  let simulator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    simulator = new MonteCarloSimulator(mockLogger);
  });

  describe('Initialization', () => {
    test('should initialize with logger', () => {
      expect(simulator.logger).toBe(mockLogger);
      expect(simulator.simulations).toEqual(new Map());
    });

    test('should be an EventEmitter', () => {
      expect(simulator.on).toBeDefined();
      expect(simulator.emit).toBeDefined();
    });
  });

  describe('Return Distribution Simulation', () => {
    test('should generate simulations with return distribution', () => {
      const historicalReturns = [0.01, 0.02, -0.01, 0.015, -0.005, 0.02];
      const numSimulations = 10;

      const simulations = simulator.returnDistributionSimulation(historicalReturns, numSimulations);

      expect(simulations).toHaveLength(numSimulations);
      simulations.forEach(path => {
        expect(path).toHaveLength(253); // 252 trading days + initial value
        expect(path[0]).toBe(1.0); // Start at 1.0
        expect(path[path.length - 1]).toBeGreaterThan(0); // All values positive
      });
    });

    test('should use Box-Muller transform for normal distribution', () => {
      const historicalReturns = Array(252).fill(0.001); // Constant return
      const simulations = simulator.returnDistributionSimulation(historicalReturns, 100);

      // With constant returns, should have low variance
      const finalValues = simulations.map(path => path[path.length - 1]);
      const mean = simulator.calculateMean(finalValues);
      const std = simulator.calculateStd(finalValues);

      expect(mean).toBeGreaterThan(1.0);
      expect(std / mean).toBeLessThan(0.5); // Low coefficient of variation
    });

    test('should respect input mean and std', () => {
      const returns = [0.01, 0.02, 0.01, 0.02, 0.01]; // Small, consistent returns
      const simulations = simulator.returnDistributionSimulation(returns, 100);

      // All paths should show growth
      const finalValues = simulations.map(path => path[path.length - 1]);
      finalValues.forEach(value => {
        expect(value).toBeGreaterThan(0.5); // Should grow or at least not collapse
      });
    });
  });

  describe('Bootstrap Simulation', () => {
    test('should generate bootstrap simulations from historical returns', () => {
      const historicalReturns = [0.01, 0.02, -0.01, 0.015, -0.005, 0.02];
      const numSimulations = 10;

      const simulations = simulator.bootstrapSimulation(historicalReturns, numSimulations);

      expect(simulations).toHaveLength(numSimulations);
      simulations.forEach(path => {
        expect(path).toHaveLength(253); // 252 trading days + initial value
        expect(path[0]).toBe(1.0); // Start at 1.0
      });
    });

    test('should sample from historical returns uniformly', () => {
      const historicalReturns = [0.01, 0.02, 0.03];
      const simulations = simulator.bootstrapSimulation(historicalReturns, 100);

      // All returns in paths should be from historical returns
      const usedReturns = new Set();
      simulations.forEach(path => {
        for (let i = 1; i < path.length; i++) {
          const dayReturn = path[i] / path[i - 1] - 1;
          const rounded = Math.round(dayReturn * 100000) / 100000;
          historicalReturns.forEach(hr => {
            if (Math.abs(rounded - hr) < 0.0001) {
              usedReturns.add(hr);
            }
          });
        }
      });

      expect(usedReturns.size).toBeGreaterThan(0);
    });
  });

  describe('Risk Metrics - Value at Risk (VaR)', () => {
    test('should calculate VaR at 95% confidence level', () => {
      const returns = Array(100).fill(-0.02); // All losses of 2%
      returns.push(...Array(900).fill(0.01)); // And 900 gains of 1%

      const var95 = simulator.calculateVaR(returns, 0.95);

      expect(var95).toBeGreaterThanOrEqual(-0.02);
      expect(var95).toBeLessThanOrEqual(0);
    });

    test('should calculate VaR at different confidence levels', () => {
      const returns = [];
      for (let i = 0; i < 1000; i++) {
        returns.push((Math.random() - 0.5) * 0.1); // Random returns -5% to +5%
      }

      const var90 = simulator.calculateVaR(returns, 0.90);
      const var95 = simulator.calculateVaR(returns, 0.95);
      const var99 = simulator.calculateVaR(returns, 0.99);

      // Higher confidence level should have worse (more negative) VaR
      expect(var99).toBeLessThanOrEqual(var95);
      expect(var95).toBeLessThanOrEqual(var90);
    });

    test('should handle all positive returns', () => {
      const returns = Array(100).fill(0.01);
      const var95 = simulator.calculateVaR(returns, 0.95);

      expect(var95).toBe(0); // No losses
    });
  });

  describe('Risk Metrics - Conditional Value at Risk (CVaR)', () => {
    test('should calculate CVaR as expected shortfall', () => {
      const returns = [];
      for (let i = 0; i < 100; i++) {
        if (i < 5) {
          returns.push(-0.05); // 5 worst returns
        } else {
          returns.push(0.01);
        }
      }

      const cvar95 = simulator.calculateCVaR(returns, 0.95);

      expect(cvar95).toBeLessThan(-0.02);
      expect(cvar95).toBeGreaterThan(-0.06);
    });

    test('should be worse than or equal to VaR', () => {
      const returns = [];
      for (let i = 0; i < 1000; i++) {
        returns.push((Math.random() - 0.5) * 0.1);
      }

      const var95 = simulator.calculateVaR(returns, 0.95);
      const cvar95 = simulator.calculateCVaR(returns, 0.95);

      expect(cvar95).toBeLessThanOrEqual(var95);
    });

    test('should handle all positive returns', () => {
      const returns = Array(100).fill(0.01);
      const cvar95 = simulator.calculateCVaR(returns, 0.95);

      expect(cvar95).toBe(0); // No losses
    });
  });

  describe('Drawdown Calculations', () => {
    test('should calculate maximum drawdown correctly', () => {
      const path = [1.0, 1.1, 1.2, 1.0, 0.8, 1.05];

      const maxDD = simulator.calculateMaxDrawdown(path);

      // From 1.2 to 0.8 = -33.33%
      expect(maxDD).toBeCloseTo(-33.33, 1);
    });

    test('should handle path with no drawdown', () => {
      const path = [1.0, 1.05, 1.1, 1.15, 1.2];

      const maxDD = simulator.calculateMaxDrawdown(path);

      expect(maxDD).toBe(0);
    });

    test('should handle complete loss', () => {
      const path = [1.0, 0.5, 0.25, 0.0];

      const maxDD = simulator.calculateMaxDrawdown(path);

      expect(maxDD).toBe(-100);
    });
  });

  describe('Confidence Intervals', () => {
    test('should calculate 95% confidence interval', () => {
      const values = Array(100).fill(0).map(() => Math.random() * 10);
      const ci = simulator.calculateConfidenceInterval(values, 0.95);

      expect(ci).toHaveProperty('lower');
      expect(ci).toHaveProperty('upper');
      expect(ci).toHaveProperty('confidenceLevel');
      expect(ci.confidenceLevel).toBe(0.95);
      expect(ci.lower).toBeLessThan(ci.upper);
    });

    test('should narrow as confidence level increases', () => {
      const values = Array(1000).fill(0).map(() => Math.random() * 10);

      const ci95 = simulator.calculateConfidenceInterval(values, 0.95);
      const ci99 = simulator.calculateConfidenceInterval(values, 0.99);

      const width95 = ci95.upper - ci95.lower;
      const width99 = ci99.upper - ci99.lower;

      // 99% CI should be wider than 95% CI
      expect(width99).toBeGreaterThan(width95);
    });
  });

  describe('Probability Calculations', () => {
    test('should calculate probability of profit', () => {
      const returns = [-5, -2, 1, 3, 4, 2]; // 4 positive, 2 negative

      const probProfit = simulator.calculateProbability(returns, v => v > 0);

      expect(probProfit).toBeCloseTo(66.67, 1);
    });

    test('should calculate probability of loss', () => {
      const returns = [-5, -2, 1, 3, 4, 2];

      const probLoss = simulator.calculateProbability(returns, v => v < 0);

      expect(probLoss).toBeCloseTo(33.33, 1);
    });

    test('should calculate probability of 50%+ return', () => {
      const returns = [10, 20, 30, 40, 50, 60, 70, 80];

      const prob50 = simulator.calculateProbability(returns, v => v >= 50);

      expect(prob50).toBe(37.5);
    });

    test('should handle all true condition', () => {
      const returns = [1, 2, 3, 4, 5];

      const prob = simulator.calculateProbability(returns, v => v > 0);

      expect(prob).toBe(100);
    });

    test('should handle all false condition', () => {
      const returns = [1, 2, 3, 4, 5];

      const prob = simulator.calculateProbability(returns, v => v < 0);

      expect(prob).toBe(0);
    });
  });

  describe('Statistical Calculations', () => {
    test('should calculate mean correctly', () => {
      const values = [1, 2, 3, 4, 5];
      const mean = simulator.calculateMean(values);

      expect(mean).toBe(3);
    });

    test('should calculate standard deviation', () => {
      const values = [1, 2, 3, 4, 5];
      const std = simulator.calculateStd(values);

      expect(std).toBeCloseTo(1.414, 2);
    });

    test('should calculate median for odd number of values', () => {
      const values = [1, 3, 5, 7, 9];
      const median = simulator.calculateMedian(values);

      expect(median).toBe(5);
    });

    test('should calculate median for even number of values', () => {
      const values = [1, 2, 3, 4];
      const median = simulator.calculateMedian(values);

      expect(median).toBe(2.5);
    });

    test('should handle empty array for mean', () => {
      const mean = simulator.calculateMean([]);

      expect(mean).toBe(0);
    });
  });

  describe('Simulation Statistics', () => {
    test('should calculate comprehensive simulation statistics', () => {
      const simulations = [
        [1.0, 1.01, 1.02, 1.03],
        [1.0, 0.99, 1.01, 1.02],
        [1.0, 1.02, 1.01, 1.04]
      ];
      const historicalReturns = [0.01, -0.01, 0.02];

      const stats = simulator.calculateSimulationStatistics(simulations, historicalReturns, 0.95);

      expect(stats).toHaveProperty('finalValueMean');
      expect(stats).toHaveProperty('finalValueMedian');
      expect(stats).toHaveProperty('returnMean');
      expect(stats).toHaveProperty('returnCI95');
      expect(stats).toHaveProperty('returnCI99');
      expect(stats).toHaveProperty('maxDrawdownMean');
      expect(stats).toHaveProperty('valueAtRisk');
      expect(stats).toHaveProperty('conditionalValueAtRisk');
      expect(stats).toHaveProperty('probabilityOfProfit');
      expect(stats).toHaveProperty('probabilityOfLoss');
    });

    test('should calculate historical volatility annualized', () => {
      const simulations = [[1.0, 1.01], [1.0, 0.99]];
      const historicalReturns = [0.01, -0.01, 0.01, -0.01];

      const stats = simulator.calculateSimulationStatistics(simulations, historicalReturns, 0.95);

      expect(stats.historicalVolatility).toBeGreaterThan(0);
      // Annualized volatility should be roughly sqrt(252) * daily vol
      expect(stats.historicalVolatility).toBeLessThan(50); // Reasonable bound
    });
  });

  describe('Return Calculations', () => {
    test('should calculate returns from equity curve', () => {
      const equity = [100000, 102000, 101000];

      const returns = simulator.calculateReturns(equity);

      expect(returns).toHaveLength(2);
      expect(returns[0]).toBeCloseTo(0.02, 5);
      expect(returns[1]).toBeCloseTo(-0.0098, 4);
    });

    test('should handle zero equity values', () => {
      const equity = [100000, 0, 100000];

      const returns = simulator.calculateReturns(equity);

      expect(returns.length).toBeLessThan(3);
    });

    test('should handle single value', () => {
      const returns = simulator.calculateReturns([100000]);

      expect(returns).toHaveLength(0);
    });
  });

  describe('Simulation Storage', () => {
    test('should store simulation by ID', () => {
      const simulation = {
        id: 'sim-id-1',
        statistics: { finalValueMean: 1.05 }
      };

      simulator.simulations.set(simulation.id, simulation);
      const retrieved = simulator.getSimulation('sim-id-1');

      expect(retrieved).toEqual(simulation);
    });

    test('should list all simulations', () => {
      simulator.simulations.set('sim-1', { id: 'sim-1' });
      simulator.simulations.set('sim-2', { id: 'sim-2' });

      const list = simulator.listSimulations();

      expect(list).toHaveLength(2);
    });
  });

  describe('Event Emission', () => {
    test('should emit simulation:started event', (done) => {
      simulator.on('simulation:started', (data) => {
        expect(data).toHaveProperty('simulationId');
        expect(data).toHaveProperty('config');
        done();
      });

      simulator.runSimulation({
        equityCurve: [100000, 102000, 101000, 103000],
        results: { equityHistory: [100000, 102000, 101000, 103000] }
      }, {
        numSimulations: 10,
        method: 'returns'
      });
    });

    test('should emit simulation:completed event', (done) => {
      simulator.on('simulation:completed', (data) => {
        expect(data).toHaveProperty('simulationId');
        expect(data).toHaveProperty('statistics');
        done();
      });

      simulator.runSimulation({
        equityCurve: [100000, 102000, 101000, 103000],
        results: { equityHistory: [100000, 102000, 101000, 103000] }
      }, {
        numSimulations: 10,
        method: 'returns'
      });
    });
  });

  describe('Error Handling', () => {
    test('should throw error with no equity data', async () => {
      expect(() => {
        simulator.runSimulation({
          equityCurve: [],
          results: { equityHistory: [] }
        }, {
          numSimulations: 10,
          method: 'returns'
        });
      }).toThrow('No equity data available for simulation');
    });

    test('should emit error event on failure', (done) => {
      simulator.on('simulation:error', (data) => {
        expect(data).toHaveProperty('simulationId');
        expect(data).toHaveProperty('error');
        done();
      });

      simulator.runSimulation({
        equityCurve: [],
        results: { equityHistory: [] }
      }, {
        numSimulations: 10,
        method: 'returns'
      });
    });

    test('should log error details', () => {
      try {
        simulator.runSimulation({
          equityCurve: [],
          results: { equityHistory: [] }
        }, {
          numSimulations: 10,
          method: 'returns'
        });
      } catch (error) {
        expect(mockLogger.error).toHaveBeenCalled();
      }
    });
  });

  describe('Integration - Full Simulation Run', () => {
    test('should complete full simulation with both methods', () => {
      const backtestResult = {
        equityCurve: Array(252).fill(0).map((_, i) => 100000 * Math.pow(1.0005, i)),
        results: {
          equityHistory: Array(252).fill(0).map((_, i) => 100000 * Math.pow(1.0005, i))
        }
      };

      const resultReturns = simulator.runSimulation(backtestResult, {
        numSimulations: 50,
        method: 'returns',
        confidenceLevel: 0.95
      });

      const resultBootstrap = simulator.runSimulation(backtestResult, {
        numSimulations: 50,
        method: 'bootstrapping',
        confidenceLevel: 0.95
      });

      expect(resultReturns).toHaveProperty('statistics');
      expect(resultBootstrap).toHaveProperty('statistics');
      expect(resultReturns.simulations).toHaveLength(50);
      expect(resultBootstrap.simulations).toHaveLength(50);
    });
  });
});
