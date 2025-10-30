/**
 * Walk-Forward Optimization Engine
 * Advanced parameter optimization with walk-forward analysis
 *
 * Features:
 * - Rolling window optimization
 * - Out-of-sample validation
 * - Parameter stability analysis
 * - Overfitting detection
 * - Performance degradation tracking
 *
 * @version 1.0.0
 */

const EventEmitter = require('events');

/**
 * WalkForwardOptimizer
 * Implements walk-forward analysis for robust parameter optimization
 */
class WalkForwardOptimizer extends EventEmitter {
  /**
   * Initialize walk-forward optimizer
   * @param {Object} backtestingEngine - Backtesting engine instance
   * @param {Object} logger - Logger instance
   */
  constructor(backtestingEngine, logger = console) {
    super();
    this.engine = backtestingEngine;
    this.logger = logger;
    this.optimizations = new Map();
  }

  /**
   * Run walk-forward optimization
   * @param {Object} config - Optimization configuration
   * @param {Object} config.symbol - Symbol to optimize
   * @param {Date} config.startDate - Overall start date
   * @param {Date} config.endDate - Overall end date
   * @param {number} config.insamplePeriod - In-sample window size (days)
   * @param {number} config.outofSamplePeriod - Out-of-sample window size (days)
   * @param {number} config.stepSize - Step size for rolling window (days)
   * @param {Object} config.parameterGrid - Parameter grid to optimize
   * @param {Function} config.strategy - Strategy function
   * @param {string} config.objectiveMetric - Metric to optimize (sharpeRatio, return, etc.)
   * @returns {Promise<Object>} Walk-forward results
   */
  async runWalkForwardOptimization(config) {
    const optimizationId = `wfo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.logger.info(`Starting walk-forward optimization: ${optimizationId}`, config);
      this.emit('wfo:started', { optimizationId, config });

      // Calculate windows
      const windows = this.calculateWindows(
        config.startDate,
        config.endDate,
        config.insamplePeriod,
        config.outofSamplePeriod,
        config.stepSize
      );

      this.logger.info(`Created ${windows.length} walk-forward windows`);

      // Run optimization for each window
      const results = {
        windows: [],
        summary: {
          totalWindows: windows.length,
          parameters: [],
          oosSharpe: 0,
          oosReturn: 0,
          oosDrawdown: 0,
          isOverfit: false
        },
        stability: {}
      };

      let windowIndex = 0;
      for (const window of windows) {
        windowIndex++;
        this.emit('wfo:window_started', { optimizationId, window: windowIndex, total: windows.length });

        // In-sample optimization
        const isOptimization = await this.optimizeParameters(
          config,
          window.insampleStart,
          window.insampleEnd
        );

        // Out-of-sample validation
        const oosBacktest = await this.engine.backtest({
          symbol: config.symbol,
          startDate: window.oosStart,
          endDate: window.oosEnd,
          parameters: isOptimization.bestParameters,
          strategy: config.strategy
        });

        results.windows.push({
          window: windowIndex,
          insampleRange: { start: window.insampleStart, end: window.insampleEnd },
          oosRange: { start: window.oosStart, end: window.oosEnd },
          isMetrics: isOptimization.metrics,
          oosMetrics: oosBacktest.metrics,
          bestParameters: isOptimization.bestParameters,
          performance: {
            isReturn: isOptimization.metrics.totalReturn,
            oosReturn: oosBacktest.metrics.totalReturn,
            degradation: isOptimization.metrics.totalReturn - oosBacktest.metrics.totalReturn
          }
        });

        results.summary.parameters.push(isOptimization.bestParameters);

        this.emit('wfo:window_completed', {
          optimizationId,
          window: windowIndex,
          oosReturn: oosBacktest.metrics.totalReturn
        });
      }

      // Calculate summary statistics
      results.summary = this.calculateSummaryStats(results.windows);
      results.stability = this.analyzeParameterStability(results.summary.parameters);
      results.summary.isOverfit = this.detectOverfitting(results.windows);

      this.optimizations.set(optimizationId, results);
      this.emit('wfo:completed', { optimizationId, summary: results.summary });

      return { id: optimizationId, ...results };
    } catch (error) {
      this.logger.error(`Error in walk-forward optimization: ${optimizationId}`, error);
      this.emit('wfo:error', { optimizationId, error: error.message });
      throw error;
    }
  }

  /**
   * Calculate rolling windows for walk-forward analysis
   * @private
   */
  calculateWindows(startDate, endDate, inSampleDays, outOfSampleDays, stepDays) {
    const windows = [];
    const oneDay = 24 * 60 * 60 * 1000;

    let windowStart = new Date(startDate);
    const totalSpan = (endDate - startDate) / oneDay;

    if (totalSpan < inSampleDays + outOfSampleDays) {
      throw new Error('Insufficient data for walk-forward analysis');
    }

    while (true) {
      const insampleEnd = new Date(windowStart.getTime() + inSampleDays * oneDay);
      const oosEnd = new Date(insampleEnd.getTime() + outOfSampleDays * oneDay);

      if (oosEnd > endDate) break;

      windows.push({
        insampleStart: new Date(windowStart),
        insampleEnd: new Date(insampleEnd),
        oosStart: new Date(insampleEnd),
        oosEnd: new Date(oosEnd)
      });

      windowStart = new Date(windowStart.getTime() + stepDays * oneDay);
    }

    return windows;
  }

  /**
   * Optimize parameters for in-sample period
   * @private
   */
  async optimizeParameters(config, startDate, endDate) {
    const parameterCombinations = this.generateParameterCombinations(config.parameterGrid);
    let bestMetric = -Infinity;
    let bestParameters = null;
    const metrics = [];

    for (const params of parameterCombinations) {
      const backtest = await this.engine.backtest({
        symbol: config.symbol,
        startDate,
        endDate,
        parameters: params,
        strategy: config.strategy
      });

      const metricValue = backtest.metrics[config.objectiveMetric] || 0;
      metrics.push({ parameters: params, metricValue });

      if (metricValue > bestMetric) {
        bestMetric = metricValue;
        bestParameters = params;
      }
    }

    return {
      bestParameters,
      metrics: { [config.objectiveMetric]: bestMetric },
      allMetrics: metrics
    };
  }

  /**
   * Generate all parameter combinations from grid
   * @private
   */
  generateParameterCombinations(parameterGrid) {
    const keys = Object.keys(parameterGrid);
    if (keys.length === 0) return [{}];

    const combinations = [];
    const values = keys.map(key => parameterGrid[key]);

    function generate(index, current) {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }

      for (const value of values[index]) {
        current[keys[index]] = value;
        generate(index + 1, current);
      }
    }

    generate(0, {});
    return combinations;
  }

  /**
   * Calculate summary statistics across all windows
   * @private
   */
  calculateSummaryStats(windows) {
    const oosReturns = windows.map(w => w.performance.oosReturn);
    const isReturns = windows.map(w => w.performance.isReturn);
    const degradations = windows.map(w => w.performance.degradation);

    return {
      totalWindows: windows.length,
      oosMeanReturn: this.calculateMean(oosReturns),
      oosStdReturn: this.calculateStd(oosReturns),
      oosMedianReturn: this.calculateMedian(oosReturns),
      isMeanReturn: this.calculateMean(isReturns),
      oosMinReturn: Math.min(...oosReturns),
      oosMaxReturn: Math.max(...oosReturns),
      degradationMean: this.calculateMean(degradations),
      degradationMax: Math.max(...degradations),
      parameters: []
    };
  }

  /**
   * Analyze parameter stability across windows
   * @private
   */
  analyzeParameterStability(parameters) {
    const stability = {};

    if (parameters.length === 0) return stability;

    const keys = Object.keys(parameters[0]);

    for (const key of keys) {
      const values = parameters.map(p => p[key]);

      if (typeof values[0] === 'number') {
        const mean = this.calculateMean(values);
        const std = this.calculateStd(values);
        const cv = std / mean; // Coefficient of variation

        stability[key] = {
          mean,
          std,
          coefficientOfVariation: cv,
          isStable: cv < 0.2 // Less than 20% variation is considered stable
        };
      }
    }

    return stability;
  }

  /**
   * Detect overfitting based on in-sample vs out-of-sample degradation
   * @private
   */
  detectOverfitting(windows) {
    const degradations = windows.map(w => w.performance.degradation);
    const avgDegradation = this.calculateMean(degradations);
    const maxDegradation = Math.max(...degradations);

    // If average degradation > 5% OR max degradation > 15%, consider overfitted
    return avgDegradation > 5 || maxDegradation > 15;
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  /**
   * Calculate mean of array
   * @private
   */
  calculateMean(values) {
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
   * Get optimization by ID
   */
  getOptimization(optimizationId) {
    return this.optimizations.get(optimizationId);
  }

  /**
   * List all optimizations
   */
  listOptimizations() {
    return Array.from(this.optimizations.values());
  }
}

module.exports = WalkForwardOptimizer;
