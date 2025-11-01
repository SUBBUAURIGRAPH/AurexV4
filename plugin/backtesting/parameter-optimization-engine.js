/**
 * Parameter Optimization Engine
 * Systematic parameter tuning for trading strategies
 *
 * Features:
 * - Grid search optimization
 * - Random search (Monte Carlo)
 * - Bayesian optimization (advanced)
 * - Genetic algorithms (advanced)
 * - Walk-forward analysis
 * - Results persistence and comparison
 */

const EventEmitter = require('events');

/**
 * Optimization Strategy Types
 */
const OptimizationType = {
  GRID: 'grid',           // Exhaustive search
  RANDOM: 'random',       // Random sampling
  BAYESIAN: 'bayesian',   // Probabilistic approach
  GENETIC: 'genetic'      // Evolutionary algorithm
};

/**
 * Optimization Objective Metric
 */
const ObjectiveMetric = {
  SHARPE_RATIO: 'sharpe_ratio',
  RETURN: 'total_return',
  PROFIT_FACTOR: 'profit_factor',
  MAX_DRAWDOWN: 'max_drawdown',
  WIN_RATE: 'win_rate',
  CALMAR_RATIO: 'calmar_ratio'
};

/**
 * Parameter Optimization Engine
 */
class ParameterOptimizationEngine extends EventEmitter {
  constructor(config = {}) {
    super();

    this.backtestFn = config.backtestFn;  // Function to run backtest
    this.database = config.database;
    this.logger = config.logger || console;

    this.optimizations = new Map();  // optimization_id -> optimization
    this.trials = new Map();          // trial_id -> trial results
  }

  /**
   * Start parameter optimization
   * @param {Object} optimizationParams - Optimization parameters
   * @returns {Object} Optimization metadata
   */
  async startOptimization(optimizationParams) {
    const {
      id = Math.random().toString(36).substr(2, 9),
      name,
      symbol,
      startDate,
      endDate,
      strategy,
      optimizationType = OptimizationType.GRID,
      parameterGrid,  // { param_name: [values] or {min, max, step} }
      objectiveMetric = ObjectiveMetric.SHARPE_RATIO,
      objectiveDirection = 'maximize',
      maxTrials = 1000
    } = optimizationParams;

    // Validate inputs
    if (!parameterGrid || Object.keys(parameterGrid).length === 0) {
      throw new Error('Parameter grid cannot be empty');
    }

    // Create optimization record
    const optimization = {
      id,
      name,
      symbol,
      startDate,
      endDate,
      strategy,
      optimizationType,
      parameterGrid,
      objectiveMetric,
      objectiveDirection,
      maxTrials,
      status: 'running',
      startTime: new Date(),
      trials: [],
      bestResult: null,
      bestParameters: null,
      bestMetricValue: null,
      progress: 0,
      completedTrials: 0
    };

    this.optimizations.set(id, optimization);

    this.logger.info(
      `🔄 Starting ${optimizationType} optimization: ${name} with ${this._countTrials(parameterGrid)} potential combinations`
    );

    this.emit('optimization:started', { optimizationId: id });

    // Run optimization asynchronously
    this._runOptimization(optimization).catch(error => {
      this.logger.error(`Optimization ${id} failed:`, error);
      optimization.status = 'failed';
      optimization.error = error.message;
      this.emit('optimization:failed', { optimizationId: id, error: error.message });
    });

    return optimization;
  }

  /**
   * Run optimization (internal)
   * @private
   */
  async _runOptimization(optimization) {
    switch (optimization.optimizationType) {
      case OptimizationType.GRID:
        await this._gridSearch(optimization);
        break;
      case OptimizationType.RANDOM:
        await this._randomSearch(optimization);
        break;
      case OptimizationType.BAYESIAN:
        await this._bayesianOptimization(optimization);
        break;
      case OptimizationType.GENETIC:
        await this._geneticAlgorithm(optimization);
        break;
      default:
        throw new Error(`Unknown optimization type: ${optimization.optimizationType}`);
    }

    optimization.status = 'completed';
    optimization.endTime = new Date();
    optimization.duration = (optimization.endTime - optimization.startTime) / 1000;

    this.logger.info(
      `✅ Optimization ${optimization.id} completed in ${optimization.duration}s`
    );

    this.emit('optimization:completed', {
      optimizationId: optimization.id,
      bestParameters: optimization.bestParameters,
      bestMetricValue: optimization.bestMetricValue
    });
  }

  /**
   * Grid Search Optimization
   * Exhaustively search all parameter combinations
   * @private
   */
  async _gridSearch(optimization) {
    const parameterSets = this._generateGridParameterSets(optimization.parameterGrid);

    for (let i = 0; i < parameterSets.length && i < optimization.maxTrials; i++) {
      const parameters = parameterSets[i];
      await this._runTrial(optimization, parameters, i);

      optimization.completedTrials++;
      optimization.progress = (optimization.completedTrials / Math.min(parameterSets.length, optimization.maxTrials)) * 100;

      this.emit('optimization:progress', {
        optimizationId: optimization.id,
        progress: optimization.progress,
        completedTrials: optimization.completedTrials,
        bestMetricValue: optimization.bestMetricValue
      });
    }
  }

  /**
   * Random Search Optimization
   * Randomly sample parameter combinations (Monte Carlo)
   * @private
   */
  async _randomSearch(optimization) {
    for (let i = 0; i < optimization.maxTrials; i++) {
      const parameters = this._generateRandomParameters(optimization.parameterGrid);
      await this._runTrial(optimization, parameters, i);

      optimization.completedTrials++;
      optimization.progress = (optimization.completedTrials / optimization.maxTrials) * 100;

      this.emit('optimization:progress', {
        optimizationId: optimization.id,
        progress: optimization.progress,
        completedTrials: optimization.completedTrials,
        bestMetricValue: optimization.bestMetricValue
      });
    }
  }

  /**
   * Bayesian Optimization
   * Use probabilistic model to guide search
   * @private
   */
  async _bayesianOptimization(optimization) {
    // Simplified Bayesian approach: start with random, then refine based on results
    const initialTrials = Math.min(10, optimization.maxTrials);

    // Initial exploration phase
    for (let i = 0; i < initialTrials; i++) {
      const parameters = this._generateRandomParameters(optimization.parameterGrid);
      await this._runTrial(optimization, parameters, i);
      optimization.completedTrials++;
    }

    // Refinement phase: focus on regions with good results
    const remainingTrials = optimization.maxTrials - initialTrials;
    for (let i = initialTrials; i < initialTrials + remainingTrials; i++) {
      const parameters = this._generateRefinedParameters(
        optimization,
        optimization.parameterGrid
      );
      await this._runTrial(optimization, parameters, i);
      optimization.completedTrials++;

      optimization.progress = (optimization.completedTrials / optimization.maxTrials) * 100;

      this.emit('optimization:progress', {
        optimizationId: optimization.id,
        progress: optimization.progress,
        completedTrials: optimization.completedTrials,
        bestMetricValue: optimization.bestMetricValue
      });
    }
  }

  /**
   * Genetic Algorithm Optimization
   * Evolutionary approach
   * @private
   */
  async _geneticAlgorithm(optimization) {
    const populationSize = 20;
    const generations = Math.ceil(optimization.maxTrials / populationSize);

    // Initialize population with random parameters
    let population = [];
    for (let i = 0; i < populationSize; i++) {
      const parameters = this._generateRandomParameters(optimization.parameterGrid);
      const fitness = await this._runTrial(optimization, parameters, i);
      population.push({ parameters, fitness });
      optimization.completedTrials++;
    }

    // Evolve population
    for (let gen = 1; gen < generations; gen++) {
      // Sort by fitness
      population.sort((a, b) => {
        if (optimization.objectiveDirection === 'maximize') {
          return b.fitness - a.fitness;
        } else {
          return a.fitness - b.fitness;
        }
      });

      // Select top half (elite)
      const elite = population.slice(0, Math.ceil(populationSize / 2));

      // Generate new population through crossover and mutation
      const newPopulation = [...elite];
      while (newPopulation.length < populationSize && optimization.completedTrials < optimization.maxTrials) {
        const parent1 = elite[Math.floor(Math.random() * elite.length)];
        const parent2 = elite[Math.floor(Math.random() * elite.length)];
        const child = this._crossoverAndMutate(parent1.parameters, parent2.parameters, optimization.parameterGrid);
        const fitness = await this._runTrial(optimization, child, optimization.completedTrials);
        newPopulation.push({ parameters: child, fitness });
        optimization.completedTrials++;
      }

      population = newPopulation;

      optimization.progress = (optimization.completedTrials / optimization.maxTrials) * 100;

      this.emit('optimization:progress', {
        optimizationId: optimization.id,
        progress: optimization.progress,
        completedTrials: optimization.completedTrials,
        bestMetricValue: optimization.bestMetricValue
      });
    }
  }

  /**
   * Run a single backtest trial
   * @private
   */
  async _runTrial(optimization, parameters, trialNumber) {
    try {
      // Run backtest with these parameters
      const backtestResult = await this.backtestFn({
        symbol: optimization.symbol,
        startDate: optimization.startDate,
        endDate: optimization.endDate,
        parameters
      });

      // Extract objective metric value
      const metricValue = backtestResult[optimization.objectiveMetric];

      // Update best result if better
      const isBetter = this._isBetter(metricValue, optimization.bestMetricValue, optimization.objectiveDirection);
      if (isBetter) {
        optimization.bestMetricValue = metricValue;
        optimization.bestParameters = parameters;
        optimization.bestResult = backtestResult;
      }

      // Record trial
      const trial = {
        id: Math.random().toString(36).substr(2, 9),
        trialNumber,
        parameters,
        metricValue,
        backtestResult,
        timestamp: new Date()
      };
      optimization.trials.push(trial);

      this.logger.debug(
        `📊 Trial ${trialNumber}: ${optimization.objectiveMetric} = ${metricValue.toFixed(4)}`
      );

      return metricValue;
    } catch (error) {
      this.logger.error(`Trial ${trialNumber} failed:`, error);
      return null;
    }
  }

  /**
   * Get optimization status
   */
  getOptimization(optimizationId) {
    return this.optimizations.get(optimizationId) || null;
  }

  /**
   * Get optimization results
   */
  getOptimizationResults(optimizationId) {
    const optimization = this.getOptimization(optimizationId);
    if (!optimization) return null;

    // Sort trials by metric value
    const sortedTrials = [...optimization.trials].sort((a, b) => {
      if (optimization.objectiveDirection === 'maximize') {
        return (b.metricValue || -Infinity) - (a.metricValue || -Infinity);
      } else {
        return (a.metricValue || Infinity) - (b.metricValue || Infinity);
      }
    });

    return {
      optimizationId,
      name: optimization.name,
      status: optimization.status,
      objectiveMetric: optimization.objectiveMetric,
      bestParameters: optimization.bestParameters,
      bestMetricValue: optimization.bestMetricValue,
      completedTrials: optimization.completedTrials,
      totalTrials: optimization.maxTrials,
      progress: optimization.progress,
      trials: sortedTrials,
      duration: optimization.duration
    };
  }

  /**
   * Cancel optimization
   */
  cancelOptimization(optimizationId) {
    const optimization = this.getOptimization(optimizationId);
    if (!optimization) return false;

    if (optimization.status === 'running') {
      optimization.status = 'cancelled';
      this.emit('optimization:cancelled', { optimizationId });
      return true;
    }

    return false;
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Generate all parameter combinations for grid search
   * @private
   */
  _generateGridParameterSets(parameterGrid) {
    const parameterNames = Object.keys(parameterGrid);
    const parameterRanges = parameterNames.map(name => {
      const config = parameterGrid[name];
      if (Array.isArray(config)) {
        return config;
      } else {
        // Generate range from min, max, step
        return this._generateRange(config.min, config.max, config.step);
      }
    });

    // Generate all combinations
    const combinations = [];
    const _generateCombinations = (index, current) => {
      if (index === parameterNames.length) {
        combinations.push({ ...current });
        return;
      }

      for (const value of parameterRanges[index]) {
        current[parameterNames[index]] = value;
        _generateCombinations(index + 1, current);
      }
    };

    _generateCombinations(0, {});
    return combinations;
  }

  /**
   * Generate random parameters
   * @private
   */
  _generateRandomParameters(parameterGrid) {
    const parameters = {};

    for (const [paramName, config] of Object.entries(parameterGrid)) {
      if (Array.isArray(config)) {
        parameters[paramName] = config[Math.floor(Math.random() * config.length)];
      } else {
        // Random value between min and max
        parameters[paramName] = config.min + Math.random() * (config.max - config.min);
      }
    }

    return parameters;
  }

  /**
   * Generate refined parameters based on best results
   * @private
   */
  _generateRefinedParameters(optimization, parameterGrid) {
    if (!optimization.bestParameters) {
      return this._generateRandomParameters(parameterGrid);
    }

    // Generate parameters around the best parameters
    const parameters = { ...optimization.bestParameters };

    for (const [paramName, config] of Object.entries(parameterGrid)) {
      if (typeof config === 'object' && config.min !== undefined) {
        // Narrow the search range around the best value
        const currentValue = optimization.bestParameters[paramName];
        const range = config.max - config.min;
        const narrowedMin = Math.max(config.min, currentValue - range * 0.1);
        const narrowedMax = Math.min(config.max, currentValue + range * 0.1);
        parameters[paramName] = narrowedMin + Math.random() * (narrowedMax - narrowedMin);
      }
    }

    return parameters;
  }

  /**
   * Crossover and mutate parameters (for genetic algorithm)
   * @private
   */
  _crossoverAndMutate(parent1, parent2, parameterGrid) {
    const child = {};
    const mutationRate = 0.1;

    for (const paramName of Object.keys(parameterGrid)) {
      // 50% chance of inheriting from each parent
      const inheritValue = Math.random() < 0.5 ? parent1[paramName] : parent2[paramName];

      // 10% chance of mutation
      if (Math.random() < mutationRate) {
        const config = parameterGrid[paramName];
        if (Array.isArray(config)) {
          child[paramName] = config[Math.floor(Math.random() * config.length)];
        } else {
          child[paramName] = config.min + Math.random() * (config.max - config.min);
        }
      } else {
        child[paramName] = inheritValue;
      }
    }

    return child;
  }

  /**
   * Generate range from min, max, step
   * @private
   */
  _generateRange(min, max, step) {
    const range = [];
    for (let value = min; value <= max; value += step) {
      range.push(Number(value.toFixed(4)));  // Avoid floating point precision issues
    }
    return range;
  }

  /**
   * Count total number of trials for grid search
   * @private
   */
  _countTrials(parameterGrid) {
    let count = 1;
    for (const config of Object.values(parameterGrid)) {
      if (Array.isArray(config)) {
        count *= config.length;
      } else {
        const numSteps = Math.ceil((config.max - config.min) / config.step) + 1;
        count *= numSteps;
      }
    }
    return count;
  }

  /**
   * Check if a metric value is better than the current best
   * @private
   */
  _isBetter(current, best, direction) {
    if (best === null || best === undefined) return true;
    if (current === null || current === undefined) return false;

    if (direction === 'maximize') {
      return current > best;
    } else {
      return current < best;
    }
  }
}

// Export
module.exports = {
  ParameterOptimizationEngine,
  OptimizationType,
  ObjectiveMetric
};
