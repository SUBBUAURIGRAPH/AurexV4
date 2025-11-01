/**
 * Monte Carlo Simulation Engine
 * Probabilistic performance analysis and risk modeling
 *
 * Features:
 * - Return distribution simulations
 * - Drawdown simulations
 * - Confidence interval calculations
 * - Path dependency analysis
 * - Value at Risk (VaR) estimation
 * - Conditional Value at Risk (CVaR)
 *
 * @version 1.0.0
 */

const EventEmitter = require('events');

/**
 * MonteCarloSimulator
 * Runs Monte Carlo simulations for backtesting results
 */
class MonteCarloSimulator extends EventEmitter {
  /**
   * Initialize Monte Carlo simulator
   * @param {Object} logger - Logger instance
   */
  constructor(logger = console) {
    super();
    this.logger = logger;
    this.simulations = new Map();
  }

  /**
   * Run Monte Carlo simulation on backtest results
   * @param {Object} backtestResult - Results from a backtest
   * @param {Object} config - Simulation configuration
   * @param {number} config.numSimulations - Number of simulations (default: 1000)
   * @param {number} config.method - 'returns' or 'bootstrapping' (default: returns)
   * @param {number} config.confidenceLevel - For VaR calculations (default: 0.95)
   * @returns {Object} Simulation results with confidence intervals
   */
  runSimulation(backtestResult, config = {}) {
    const simulationId = `mc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const {
        numSimulations = 1000,
        method = 'returns',
        confidenceLevel = 0.95
      } = config;

      this.logger.info(`Starting Monte Carlo simulation: ${simulationId}`, {
        numSimulations,
        method,
        confidenceLevel
      });

      this.emit('simulation:started', { simulationId, config });

      // Calculate daily returns from equity curve
      const equity = backtestResult.equityCurve || backtestResult.results?.equityHistory || [];
      const returns = this.calculateReturns(equity);

      if (returns.length === 0) {
        throw new Error('No equity data available for simulation');
      }

      // Generate simulations
      let simulations = [];
      if (method === 'bootstrapping') {
        simulations = this.bootstrapSimulation(returns, numSimulations);
      } else {
        simulations = this.returnDistributionSimulation(returns, numSimulations);
      }

      // Calculate statistics
      const statistics = this.calculateSimulationStatistics(
        simulations,
        returns,
        confidenceLevel
      );

      const result = {
        id: simulationId,
        config,
        statistics,
        simulations,
        originalMetrics: backtestResult.metrics || {},
        timestamp: new Date()
      };

      this.simulations.set(simulationId, result);
      this.emit('simulation:completed', { simulationId, statistics });

      return result;
    } catch (error) {
      this.logger.error(`Error in Monte Carlo simulation: ${simulationId}`, error);
      this.emit('simulation:error', { simulationId, error: error.message });
      throw error;
    }
  }

  /**
   * Simulate paths using return distribution
   * @private
   */
  returnDistributionSimulation(historicalReturns, numSimulations) {
    const mean = this.calculateMean(historicalReturns);
    const std = this.calculateStd(historicalReturns);
    const simulations = [];

    for (let i = 0; i < numSimulations; i++) {
      const path = [1.0]; // Start at 1.0

      // Generate one year of daily returns (252 trading days)
      for (let j = 0; j < 252; j++) {
        // Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const randomReturn = mean + z * std;

        path.push(path[path.length - 1] * (1 + randomReturn));
      }

      simulations.push(path);
    }

    return simulations;
  }

  /**
   * Bootstrap simulation using historical returns
   * @private
   */
  bootstrapSimulation(historicalReturns, numSimulations) {
    const simulations = [];

    for (let i = 0; i < numSimulations; i++) {
      const path = [1.0]; // Start at 1.0

      // Generate one year of daily returns by randomly sampling historical returns
      for (let j = 0; j < 252; j++) {
        const randomReturn = historicalReturns[
          Math.floor(Math.random() * historicalReturns.length)
        ];

        path.push(path[path.length - 1] * (1 + randomReturn));
      }

      simulations.push(path);
    }

    return simulations;
  }

  /**
   * Calculate statistics from simulations
   * @private
   */
  calculateSimulationStatistics(simulations, historicalReturns, confidenceLevel) {
    const finalValues = simulations.map(path => path[path.length - 1]);
    const maxDrawdowns = simulations.map(path => this.calculateMaxDrawdown(path));
    const returns = finalValues.map(v => (v - 1) * 100);

    const stats = {
      // Final value statistics
      finalValueMean: this.calculateMean(finalValues),
      finalValueMedian: this.calculateMedian(finalValues),
      finalValueStd: this.calculateStd(finalValues),
      finalValueMin: Math.min(...finalValues),
      finalValueMax: Math.max(...finalValues),

      // Return statistics
      returnMean: this.calculateMean(returns),
      returnMedian: this.calculateMedian(returns),
      returnStd: this.calculateStd(returns),
      returnMin: Math.min(...returns),
      returnMax: Math.max(...returns),

      // Drawdown statistics
      maxDrawdownMean: this.calculateMean(maxDrawdowns),
      maxDrawdownMedian: this.calculateMedian(maxDrawdowns),
      maxDrawdownMin: Math.min(...maxDrawdowns),
      maxDrawdownMax: Math.max(...maxDrawdowns),

      // Risk metrics
      valueAtRisk: this.calculateVaR(returns, confidenceLevel),
      conditionalValueAtRisk: this.calculateCVaR(returns, confidenceLevel),
      confidenceLevel,

      // Confidence intervals
      returnCI95: this.calculateConfidenceInterval(returns, 0.95),
      returnCI99: this.calculateConfidenceInterval(returns, 0.99),
      drawdownCI95: this.calculateConfidenceInterval(maxDrawdowns, 0.95),

      // Probability metrics
      probabilityOfProfit: this.calculateProbability(returns, v => v > 0),
      probabilityOfLoss: this.calculateProbability(returns, v => v < 0),
      probabilityOf50PlusPercent: this.calculateProbability(returns, v => v >= 50),

      // Historical comparison
      historicalReturn: (this.calculateMean(historicalReturns)) * 252 * 100,
      historicalVolatility: this.calculateStd(historicalReturns) * Math.sqrt(252) * 100
    };

    return stats;
  }

  // =========================================================================
  // RISK METRICS
  // =========================================================================

  /**
   * Calculate Value at Risk (VaR)
   * @private
   */
  calculateVaR(returns, confidenceLevel) {
    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.ceil((1 - confidenceLevel) * sorted.length) - 1;
    return Math.max(0, sorted[index]);
  }

  /**
   * Calculate Conditional Value at Risk (CVaR) / Expected Shortfall
   * @private
   */
  calculateCVaR(returns, confidenceLevel) {
    const sorted = [...returns].sort((a, b) => a - b);
    const varIndex = Math.ceil((1 - confidenceLevel) * sorted.length);
    const worstReturns = sorted.slice(0, varIndex);
    return worstReturns.length > 0 ? this.calculateMean(worstReturns) : 0;
  }

  /**
   * Calculate maximum drawdown in a path
   * @private
   */
  calculateMaxDrawdown(path) {
    let maxValue = path[0];
    let maxDrawdown = 0;

    for (let i = 1; i < path.length; i++) {
      maxValue = Math.max(maxValue, path[i]);
      const drawdown = (path[i] - maxValue) / maxValue;
      maxDrawdown = Math.min(maxDrawdown, drawdown);
    }

    return maxDrawdown * 100;
  }

  /**
   * Calculate confidence interval
   * @private
   */
  calculateConfidenceInterval(values, confidenceLevel) {
    const sorted = [...values].sort((a, b) => a - b);
    const alpha = 1 - confidenceLevel;
    const lowerIndex = Math.ceil((alpha / 2) * sorted.length);
    const upperIndex = Math.floor((1 - alpha / 2) * sorted.length);

    return {
      lower: sorted[Math.max(0, lowerIndex - 1)],
      upper: sorted[Math.min(sorted.length - 1, upperIndex)],
      confidenceLevel
    };
  }

  /**
   * Calculate probability of condition
   * @private
   */
  calculateProbability(values, condition) {
    const count = values.filter(condition).length;
    return (count / values.length) * 100;
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  /**
   * Calculate daily returns from equity curve
   * @private
   */
  calculateReturns(equity) {
    const returns = [];
    for (let i = 1; i < equity.length; i++) {
      if (equity[i - 1] !== 0) {
        returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
      }
    }
    return returns;
  }

  /**
   * Calculate mean
   * @private
   */
  calculateMean(values) {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   * @private
   */
  calculateStd(values) {
    const mean = this.calculateMean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate median
   * @private
   */
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Get simulation by ID
   */
  getSimulation(simulationId) {
    return this.simulations.get(simulationId);
  }

  /**
   * List all simulations
   */
  listSimulations() {
    return Array.from(this.simulations.values());
  }
}

module.exports = MonteCarloSimulator;
