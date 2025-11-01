/**
 * Optimized Prediction Service
 * High-performance prediction service with built-in caching, batching, and optimization
 *
 * Features:
 * - Intelligent caching at all levels
 * - Automatic batch processing
 * - Lazy loading of indicators
 * - Sparse matrix optimization
 * - Performance monitoring
 * - Automatic garbage collection
 */

const EventEmitter = require('events');
const {
  PredictionPipelineOptimizer,
  CacheManager,
  BatchProcessor,
  LazyIndicatorLoader
} = require('./gnn-performance-optimizer');

/**
 * Optimized Prediction Service
 */
class OptimizedPredictionService extends EventEmitter {
  constructor(config = {}) {
    super();

    this.logger = config.logger || console;
    this.predictionEngine = config.predictionEngine;
    this.technicalProcessor = config.technicalProcessor;
    this.fundamentalAnalyzer = config.fundamentalAnalyzer;
    this.graphBuilder = config.graphBuilder;

    // Initialize optimization components
    this.optimizer = new PredictionPipelineOptimizer(config);
    this.cacheManager = this.optimizer.cacheManager;
    this.batchProcessor = this.optimizer.batchProcessor;
    this.lazyIndicator = new LazyIndicatorLoader({
      logger: this.logger,
      technicalProcessor: this.technicalProcessor
    });

    // Service metrics
    this.metrics = {
      predictions: 0,
      cached: 0,
      batched: 0,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0
    };

    // Garbage collection interval
    this.gcInterval = config.gcInterval || 600000;  // 10 minutes
    this.startGarbageCollection();

    this.logger.info('✅ Optimized Prediction Service initialized');
  }

  /**
   * Generate optimized prediction
   * @param {string} symbol - Stock symbol
   * @param {Array} ohlcvData - OHLCV data
   * @param {Object} fundamentals - Fundamental metrics
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Optimized prediction
   */
  async predict(symbol, ohlcvData, fundamentals, options = {}) {
    const startTime = Date.now();
    const { useBatch = true, useCache = true, lazy = true } = options;

    try {
      // Check cache first
      const cacheKey = `${symbol}_${ohlcvData.length}`;
      if (useCache) {
        const cached = this.cacheManager.getCachePrediction(cacheKey);
        if (cached) {
          this.metrics.cached++;
          this.recordTime(Date.now() - startTime);
          this.emit('prediction:cached', { symbol, cacheHit: true });
          return cached;
        }
      }

      // Optimize request
      const optimizationMetadata = await this.optimizer.optimizeRequest({
        symbol,
        ohlcvData,
        fundamentals
      });

      // Prepare data with optimizations
      let technicalData = ohlcvData;
      let technicalFeatures = null;

      if (lazy) {
        // Lazy load technical indicators
        const indicators = await this.lazyIndicator.loadIndicators(symbol, ohlcvData);
        technicalData = { ...technicalData, indicators };
      } else {
        // Full technical analysis
        technicalFeatures = await this.technicalProcessor.extractGNNFeatures(ohlcvData);
      }

      // Cache or get fundamental data
      let fundamentalData = fundamentals;
      if (useCache) {
        const cachedFundamentals = this.cacheManager.getCacheFundamentals(symbol);
        if (cachedFundamentals) {
          fundamentalData = cachedFundamentals;
        } else if (fundamentals) {
          this.cacheManager.setCacheFundamentals(symbol, fundamentals);
        }
      }

      // Generate prediction with batching
      let prediction;
      if (useBatch && this.batchProcessor.queue.length > 0) {
        this.metrics.batched++;
        prediction = await this.batchProcessor.addToBatch({
          symbol,
          data: technicalData,
          fundamentals: fundamentalData
        });
      } else {
        // Direct prediction
        prediction = await this.predictionEngine.generatePrediction(
          symbol,
          technicalData,
          fundamentalData
        );
      }

      // Cache prediction result
      if (useCache) {
        this.cacheManager.setCachePrediction(cacheKey, prediction);
      }

      // Record metrics
      this.metrics.predictions++;
      const elapsed = Date.now() - startTime;
      this.recordTime(elapsed);

      this.logger.info(`✅ Prediction for ${symbol} completed in ${elapsed}ms`);
      this.emit('prediction:generated', {
        symbol,
        elapsed,
        cached: false,
        batched: useBatch && this.batchProcessor.queue.length > 0
      });

      return prediction;
    } catch (error) {
      this.logger.error(`Error generating prediction for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Batch predict multiple stocks
   * @param {Array} stocks - Array of {symbol, ohlcvData, fundamentals}
   * @param {Object} options - Optimization options
   * @returns {Promise<Array>} Array of predictions
   */
  async predictBatch(stocks, options = {}) {
    const startTime = Date.now();
    this.logger.info(`⚡ Processing batch of ${stocks.length} predictions`);

    const predictions = [];
    const errors = [];

    // Process in parallel batches of 5
    const batchSize = 5;
    for (let i = 0; i < stocks.length; i += batchSize) {
      const batch = stocks.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(stock =>
          this.predict(stock.symbol, stock.ohlcvData, stock.fundamentals, options)
        )
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          predictions.push(result.value);
        } else {
          errors.push({
            symbol: batch[idx].symbol,
            error: result.reason.message
          });
        }
      });
    }

    const elapsed = Date.now() - startTime;
    this.logger.info(`✅ Batch complete: ${predictions.length} predictions in ${elapsed}ms (avg: ${(elapsed / stocks.length).toFixed(2)}ms)`);

    return {
      predictions,
      errors,
      stats: {
        total: stocks.length,
        successful: predictions.length,
        failed: errors.length,
        elapsed,
        avgTime: elapsed / stocks.length
      }
    };
  }

  /**
   * Get cached prediction without regenerating
   * @param {string} symbol - Stock symbol
   * @param {number} dataLength - Length of OHLCV data
   * @returns {Object|null} Cached prediction or null
   */
  getCachedPrediction(symbol, dataLength) {
    const cacheKey = `${symbol}_${dataLength}`;
    return this.cacheManager.getCachePrediction(cacheKey);
  }

  /**
   * Clear specific caches
   * @param {string} type - 'all', 'predictions', 'indicators', 'fundamentals', 'correlations'
   */
  clearCache(type = 'all') {
    switch (type) {
      case 'predictions':
        this.cacheManager.predictionCache.clear();
        this.logger.info('🗑️ Prediction cache cleared');
        break;
      case 'indicators':
        this.lazyIndicator.clearCache();
        this.logger.info('🗑️ Indicator cache cleared');
        break;
      case 'fundamentals':
        this.cacheManager.fundamentalCache.clear();
        this.logger.info('🗑️ Fundamental cache cleared');
        break;
      case 'correlations':
        this.cacheManager.correlationCache.clear();
        this.logger.info('🗑️ Correlation cache cleared');
        break;
      case 'all':
        this.cacheManager.clearAll();
        this.lazyIndicator.clearCache();
        this.logger.info('🗑️ All caches cleared');
        break;
    }
  }

  /**
   * Record prediction time
   * @private
   */
  recordTime(elapsed) {
    this.metrics.totalTime += elapsed;
    this.metrics.avgTime = this.metrics.totalTime / this.metrics.predictions;
    this.metrics.minTime = Math.min(this.metrics.minTime, elapsed);
    this.metrics.maxTime = Math.max(this.metrics.maxTime, elapsed);
  }

  /**
   * Start automatic garbage collection
   * @private
   */
  startGarbageCollection() {
    setInterval(() => {
      // Remove expired cache entries
      const cacheManager = this.cacheManager;

      const removeExpired = (cache) => {
        const now = Date.now();
        let removed = 0;

        for (const [key, value] of cache.entries()) {
          if (now - value.timestamp > value.ttl) {
            cache.delete(key);
            removed++;
          }
        }

        return removed;
      };

      const removed =
        removeExpired(cacheManager.correlationCache) +
        removeExpired(cacheManager.indicatorCache) +
        removeExpired(cacheManager.fundamentalCache) +
        removeExpired(cacheManager.predictionCache);

      if (removed > 0) {
        this.logger.debug(`🗑️ Garbage collection: removed ${removed} expired cache entries`);
      }

      // Force memory collection if memory usage is high
      if (process.memoryUsage().heapUsed > 300 * 1024 * 1024) {  // 300MB threshold
        if (global.gc) {
          global.gc();
          this.logger.info('💾 Triggered manual garbage collection');
        }
      }
    }, this.gcInterval);
  }

  /**
   * Get performance report
   * @returns {string} Detailed performance report
   */
  getPerformanceReport() {
    let report = '📊 Optimized Prediction Service Performance Report\n';
    report += '═════════════════════════════════════════════════════\n\n';

    report += `Service Metrics:\n`;
    report += `  Total Predictions: ${this.metrics.predictions}\n`;
    report += `  Cached Hits: ${this.metrics.cached} (${(this.metrics.cached / (this.metrics.predictions || 1) * 100).toFixed(2)}%)\n`;
    report += `  Batched: ${this.metrics.batched}\n`;
    report += `  Avg Time: ${this.metrics.avgTime.toFixed(2)}ms\n`;
    report += `  Min Time: ${this.metrics.minTime === Infinity ? 'N/A' : this.metrics.minTime + 'ms'}\n`;
    report += `  Max Time: ${this.metrics.maxTime}ms\n\n`;

    report += this.optimizer.getOptimizationReport();

    return report;
  }

  /**
   * Get service statistics
   * @returns {Object} Comprehensive statistics
   */
  getStats() {
    return {
      service: this.metrics,
      optimizer: this.optimizer.getMetrics(),
      queue: {
        pending: this.batchProcessor.queue.length
      }
    };
  }

  /**
   * Health check
   * @returns {Object} Health status
   */
  healthCheck() {
    const memory = process.memoryUsage();
    const memoryHealthy = memory.heapUsed < 500 * 1024 * 1024;  // < 500MB
    const queueHealthy = this.batchProcessor.queue.length < 100;
    const cacheHealthy = this.cacheManager.predictionCache.size < this.cacheManager.maxSize;

    return {
      status: memoryHealthy && queueHealthy && cacheHealthy ? 'healthy' : 'warning',
      memory: {
        heapUsed: (memory.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
        heapTotal: (memory.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
        healthy: memoryHealthy
      },
      queue: {
        pending: this.batchProcessor.queue.length,
        healthy: queueHealthy
      },
      cache: {
        predictions: this.cacheManager.predictionCache.size,
        indicators: this.cacheManager.indicatorCache.size,
        fundamentals: this.cacheManager.fundamentalCache.size,
        healthy: cacheHealthy
      },
      predictions: {
        total: this.metrics.predictions,
        avgTime: this.metrics.avgTime.toFixed(2) + 'ms'
      }
    };
  }
}

// Export
module.exports = {
  OptimizedPredictionService
};
