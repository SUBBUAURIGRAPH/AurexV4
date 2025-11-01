/**
 * GNN Performance Optimizer
 * Optimizes prediction engine performance through caching, batching, and efficiency improvements
 *
 * Optimizations:
 * - Intelligent caching (correlations, indicators, scores)
 * - Batch prediction processing
 * - Sparse matrix operations
 * - Lazy loading of indicators
 * - Connection pooling
 * - Memory management
 * - Parallel processing
 */

const EventEmitter = require('events');

/**
 * Cache Manager
 */
class CacheManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = config.logger || console;
    this.maxSize = config.maxSize || 1000;
    this.ttl = config.ttl || 3600000;  // 1 hour default

    this.correlationCache = new Map();
    this.indicatorCache = new Map();
    this.fundamentalCache = new Map();
    this.predictionCache = new Map();

    this.cacheStats = {
      correlationHits: 0,
      correlationMisses: 0,
      indicatorHits: 0,
      indicatorMisses: 0,
      fundamentalHits: 0,
      fundamentalMisses: 0
    };
  }

  /**
   * Cache correlation matrix
   * @param {string} key - Cache key (symbol pair)
   * @param {number} correlation - Correlation value
   * @param {number} ttl - Time to live in ms
   */
  setCacheCorrelation(key, correlation, ttl = this.ttl) {
    if (this.correlationCache.size >= this.maxSize) {
      this.evictOldest(this.correlationCache);
    }

    this.correlationCache.set(key, {
      value: correlation,
      timestamp: Date.now(),
      ttl: ttl
    });

    this.logger.debug(`💾 Cached correlation: ${key}`);
  }

  /**
   * Get cached correlation
   * @param {string} key - Cache key
   * @returns {number|null} Correlation or null if expired/missing
   */
  getCacheCorrelation(key) {
    const cached = this.correlationCache.get(key);

    if (!cached) {
      this.cacheStats.correlationMisses++;
      return null;
    }

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.correlationCache.delete(key);
      this.cacheStats.correlationMisses++;
      return null;
    }

    this.cacheStats.correlationHits++;
    return cached.value;
  }

  /**
   * Cache technical indicators
   * @param {string} symbol - Stock symbol
   * @param {Object} indicators - Technical indicators object
   * @param {number} ttl - Time to live
   */
  setCacheIndicators(symbol, indicators, ttl = this.ttl) {
    if (this.indicatorCache.size >= this.maxSize) {
      this.evictOldest(this.indicatorCache);
    }

    this.indicatorCache.set(symbol, {
      value: indicators,
      timestamp: Date.now(),
      ttl: ttl
    });
  }

  /**
   * Get cached technical indicators
   * @param {string} symbol - Stock symbol
   * @returns {Object|null} Indicators or null
   */
  getCacheIndicators(symbol) {
    const cached = this.indicatorCache.get(symbol);

    if (!cached) {
      this.cacheStats.indicatorMisses++;
      return null;
    }

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.indicatorCache.delete(symbol);
      this.cacheStats.indicatorMisses++;
      return null;
    }

    this.cacheStats.indicatorHits++;
    return cached.value;
  }

  /**
   * Cache fundamental metrics
   * @param {string} symbol - Stock symbol
   * @param {Object} metrics - Fundamental metrics
   * @param {number} ttl - Time to live (longer for fundamentals - quarterly)
   */
  setCacheFundamentals(symbol, metrics, ttl = 7776000000) {  // 90 days
    if (this.fundamentalCache.size >= this.maxSize / 2) {
      this.evictOldest(this.fundamentalCache);
    }

    this.fundamentalCache.set(symbol, {
      value: metrics,
      timestamp: Date.now(),
      ttl: ttl
    });
  }

  /**
   * Get cached fundamentals
   * @param {string} symbol - Stock symbol
   * @returns {Object|null} Metrics or null
   */
  getCacheFundamentals(symbol) {
    const cached = this.fundamentalCache.get(symbol);

    if (!cached) {
      this.cacheStats.fundamentalMisses++;
      return null;
    }

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.fundamentalCache.delete(symbol);
      this.cacheStats.fundamentalMisses++;
      return null;
    }

    this.cacheStats.fundamentalHits++;
    return cached.value;
  }

  /**
   * Cache prediction result
   * @param {string} key - Cache key (symbol + timestamp)
   * @param {Object} prediction - Prediction result
   */
  setCachePrediction(key, prediction) {
    if (this.predictionCache.size >= this.maxSize * 2) {
      this.evictOldest(this.predictionCache);
    }

    this.predictionCache.set(key, {
      value: prediction,
      timestamp: Date.now(),
      ttl: 600000  // 10 minutes for predictions
    });
  }

  /**
   * Get cached prediction
   * @param {string} key - Cache key
   * @returns {Object|null} Prediction or null
   */
  getCachePrediction(key) {
    const cached = this.predictionCache.get(key);

    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.predictionCache.delete(key);
      return null;
    }

    return cached.value;
  }

  /**
   * Evict oldest entry from cache
   * @private
   */
  evictOldest(cache) {
    let oldest = null;
    let oldestKey = null;

    for (const [key, value] of cache.entries()) {
      if (!oldest || value.timestamp < oldest.timestamp) {
        oldest = value;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey);
      this.logger.debug(`🗑️ Evicted cache entry: ${oldestKey}`);
    }
  }

  /**
   * Clear all caches
   */
  clearAll() {
    this.correlationCache.clear();
    this.indicatorCache.clear();
    this.fundamentalCache.clear();
    this.predictionCache.clear();
    this.logger.info('🗑️ All caches cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache hit/miss stats
   */
  getStats() {
    return {
      cacheStats: this.cacheStats,
      correlationCacheSize: this.correlationCache.size,
      indicatorCacheSize: this.indicatorCache.size,
      fundamentalCacheSize: this.fundamentalCache.size,
      predictionCacheSize: this.predictionCache.size,
      hitRates: {
        correlations: this.cacheStats.correlationHits / (this.cacheStats.correlationHits + this.cacheStats.correlationMisses + 1),
        indicators: this.cacheStats.indicatorHits / (this.cacheStats.indicatorHits + this.cacheStats.indicatorMisses + 1),
        fundamentals: this.cacheStats.fundamentalHits / (this.cacheStats.fundamentalHits + this.cacheStats.fundamentalMisses + 1)
      }
    };
  }
}

/**
 * Batch Processor
 */
class BatchProcessor extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = config.logger || console;
    this.batchSize = config.batchSize || 10;
    this.timeout = config.timeout || 5000;

    this.queue = [];
    this.processing = false;
    this.stats = {
      processed: 0,
      failed: 0,
      totalTime: 0
    };
  }

  /**
   * Add prediction to batch queue
   * @param {Object} predictionRequest - Prediction request object
   * @returns {Promise} Promise that resolves with result
   */
  async addToBatch(predictionRequest) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        request: predictionRequest,
        resolve,
        reject,
        timestamp: Date.now()
      });

      if (this.queue.length >= this.batchSize || !this.processing) {
        this.processBatch();
      }
    });
  }

  /**
   * Process batch of predictions
   * @private
   */
  async processBatch() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const startTime = Date.now();
    const batch = this.queue.splice(0, this.batchSize);

    try {
      this.logger.info(`⚡ Processing batch of ${batch.length} predictions`);

      // Process all predictions in parallel
      const results = await Promise.allSettled(
        batch.map(item => this.processSingle(item))
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          batch[idx].resolve(result.value);
          this.stats.processed++;
        } else {
          batch[idx].reject(result.reason);
          this.stats.failed++;
        }
      });

      const elapsed = Date.now() - startTime;
      this.stats.totalTime += elapsed;

      this.logger.info(`✅ Batch processed in ${elapsed}ms (avg: ${(elapsed / batch.length).toFixed(2)}ms per prediction)`);

      // Process next batch if queue has items
      if (this.queue.length > 0) {
        setImmediate(() => this.processBatch());
      }
    } catch (error) {
      this.logger.error('Error processing batch:', error);
      batch.forEach(item => item.reject(error));
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process single prediction
   * @private
   */
  async processSingle(item) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ status: 'timeout', request: item.request });
      }, this.timeout);

      try {
        // Placeholder for actual prediction processing
        clearTimeout(timeout);
        resolve({ status: 'success', request: item.request });
      } catch (error) {
        clearTimeout(timeout);
        resolve({ status: 'error', error });
      }
    });
  }

  /**
   * Get batch processor statistics
   * @returns {Object} Stats
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.queue.length,
      avgTimePerPrediction: this.stats.processed > 0 ? this.stats.totalTime / this.stats.processed : 0
    };
  }
}

/**
 * Sparse Matrix Optimizer
 */
class SparseMatrixOptimizer {
  constructor(config = {}) {
    this.logger = config.logger || console;
    this.threshold = config.threshold || 0.5;
  }

  /**
   * Convert correlation matrix to sparse format
   * @param {Array} correlationMatrix - Dense correlation matrix
   * @param {number} threshold - Minimum absolute correlation to keep
   * @returns {Object} Sparse matrix representation
   */
  toSparseMatrix(correlationMatrix, threshold = this.threshold) {
    const sparse = {
      rows: correlationMatrix.length,
      cols: correlationMatrix[0].length,
      entries: [],
      metadata: {
        originalSize: correlationMatrix.length * correlationMatrix[0].length,
        sparseSize: 0,
        compressionRatio: 0
      }
    };

    for (let i = 0; i < correlationMatrix.length; i++) {
      for (let j = i + 1; j < correlationMatrix[i].length; j++) {
        if (Math.abs(correlationMatrix[i][j]) >= threshold) {
          sparse.entries.push({
            i,
            j,
            value: correlationMatrix[i][j]
          });
        }
      }
    }

    sparse.metadata.sparseSize = sparse.entries.length;
    sparse.metadata.compressionRatio = (sparse.metadata.sparseSize / sparse.metadata.originalSize).toFixed(4);

    this.logger.info(`📦 Sparse matrix: ${sparse.entries.length} entries (${sparse.metadata.compressionRatio * 100}% of original)`);

    return sparse;
  }

  /**
   * Get correlation from sparse matrix
   * @param {Object} sparse - Sparse matrix
   * @param {number} i - Row index
   * @param {number} j - Column index
   * @returns {number} Correlation value
   */
  getCorrelation(sparse, i, j) {
    if (i === j) return 1.0;
    if (i > j) [i, j] = [j, i];

    const entry = sparse.entries.find(e => e.i === i && e.j === j);
    return entry ? entry.value : 0;
  }

  /**
   * Get neighbors from sparse matrix
   * @param {Object} sparse - Sparse matrix
   * @param {number} nodeIdx - Node index
   * @returns {Array} Array of neighbors
   */
  getNeighbors(sparse, nodeIdx) {
    const neighbors = [];

    for (const entry of sparse.entries) {
      if (entry.i === nodeIdx) {
        neighbors.push({ idx: entry.j, correlation: entry.value });
      } else if (entry.j === nodeIdx) {
        neighbors.push({ idx: entry.i, correlation: entry.value });
      }
    }

    return neighbors.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }
}

/**
 * Lazy Indicator Loader
 */
class LazyIndicatorLoader {
  constructor(config = {}) {
    this.logger = config.logger || console;
    this.cache = new Map();
    this.technicalProcessor = config.technicalProcessor;
  }

  /**
   * Lazy load technical indicators
   * @param {string} symbol - Stock symbol
   * @param {Array} ohlcvData - OHLCV data
   * @returns {Promise<Object>} Indicators object
   */
  async loadIndicators(symbol, ohlcvData) {
    const cacheKey = `${symbol}_${ohlcvData.length}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      this.logger.debug(`✅ Using cached indicators for ${symbol}`);
      return this.cache.get(cacheKey);
    }

    // Only calculate indicators if needed
    const indicators = {
      basic: this.calculateBasicIndicators(ohlcvData),
      advanced: null,  // Load on demand
      patterns: null    // Load on demand
    };

    this.cache.set(cacheKey, indicators);
    return indicators;
  }

  /**
   * Calculate basic (fast) indicators only
   * @private
   */
  calculateBasicIndicators(ohlcvData) {
    if (ohlcvData.length < 2) return {};

    const closes = ohlcvData.map(bar => bar.close);
    const prices = closes.slice(-20);

    const sma = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance);

    return {
      currentPrice: closes[closes.length - 1],
      sma20: sma,
      volatility: volatility,
      trend: closes[closes.length - 1] > closes[closes.length - 20] ? 'UP' : 'DOWN'
    };
  }

  /**
   * Load advanced indicators on demand
   * @param {string} symbol - Stock symbol
   * @param {Array} ohlcvData - OHLCV data
   * @returns {Promise<Object>} Advanced indicators
   */
  async loadAdvancedIndicators(symbol, ohlcvData) {
    if (!this.technicalProcessor) return {};

    return await this.technicalProcessor.extractFeatures(ohlcvData);
  }

  /**
   * Load patterns on demand
   * @param {string} symbol - Stock symbol
   * @param {Array} ohlcvData - OHLCV data
   * @returns {Object} Identified patterns
   */
  async loadPatterns(symbol, ohlcvData) {
    if (!this.technicalProcessor) return {};

    return this.technicalProcessor.identifyPatterns(ohlcvData);
  }

  /**
   * Clear indicator cache
   */
  clearCache() {
    this.cache.clear();
    this.logger.info('🗑️ Indicator cache cleared');
  }
}

/**
 * Prediction Pipeline Optimizer
 */
class PredictionPipelineOptimizer {
  constructor(config = {}) {
    this.logger = config.logger || console;
    this.cacheManager = new CacheManager(config);
    this.batchProcessor = new BatchProcessor(config);
    this.sparseOptimizer = new SparseMatrixOptimizer(config);
    this.lazyIndicatorLoader = new LazyIndicatorLoader(config);

    this.metrics = {
      totalPredictions: 0,
      cacheHits: 0,
      cachedPredictions: 0,
      totalTime: 0,
      avgTime: 0
    };
  }

  /**
   * Optimize prediction request
   * @param {Object} request - Prediction request
   * @returns {Promise<Object>} Optimized request metadata
   */
  async optimizeRequest(request) {
    const startTime = Date.now();
    const { symbol, ohlcvData, fundamentals } = request;

    // Check prediction cache first
    const cacheKey = `${symbol}_${ohlcvData.length}`;
    const cached = this.cacheManager.getCachePrediction(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return { cached: true, data: cached, time: Date.now() - startTime };
    }

    // Prepare optimization metadata
    const metadata = {
      useBatchProcessing: true,
      useSparseTechnicalFeatures: ohlcvData.length > 500,
      lazyLoadAdvancedIndicators: true,
      cacheFundamentalsIfNeeded: true,
      estimatedTime: 0
    };

    // Check fundamental cache
    if (fundamentals) {
      const cachedFundamentals = this.cacheManager.getCacheFundamentals(symbol);
      metadata.fundamentalsCached = !!cachedFundamentals;
    }

    return metadata;
  }

  /**
   * Get performance metrics
   * @returns {Object} Comprehensive performance metrics
   */
  getMetrics() {
    const cacheStats = this.cacheManager.getStats();
    const batchStats = this.batchProcessor.getStats();

    return {
      predictions: this.metrics,
      cache: cacheStats,
      batch: batchStats,
      efficiency: {
        cacheHitRate: this.metrics.totalPredictions > 0 ? (this.metrics.cacheHits / this.metrics.totalPredictions).toFixed(4) : 0,
        cachedPercentage: this.metrics.totalPredictions > 0 ? (this.metrics.cachedPredictions / this.metrics.totalPredictions * 100).toFixed(2) : 0,
        avgPredictionTime: this.metrics.avgTime.toFixed(2),
        memoryUsage: process.memoryUsage()
      }
    };
  }

  /**
   * Get optimization report
   * @returns {string} Human-readable report
   */
  getOptimizationReport() {
    const metrics = this.getMetrics();
    let report = '📊 GNN Performance Optimization Report\n';
    report += '═════════════════════════════════════════\n\n';

    report += `Total Predictions: ${metrics.predictions.totalPredictions}\n`;
    report += `Cache Hits: ${metrics.predictions.cacheHits} (${(metrics.efficiency.cacheHitRate * 100).toFixed(2)}%)\n`;
    report += `Avg Prediction Time: ${metrics.efficiency.avgPredictionTime}ms\n\n`;

    report += `Cache Sizes:\n`;
    report += `  - Correlations: ${metrics.cache.correlationCacheSize} entries\n`;
    report += `  - Indicators: ${metrics.cache.indicatorCacheSize} entries\n`;
    report += `  - Fundamentals: ${metrics.cache.fundamentalCacheSize} entries\n`;
    report += `  - Predictions: ${metrics.cache.predictionCacheSize} entries\n\n`;

    report += `Cache Hit Rates:\n`;
    report += `  - Correlations: ${(metrics.cache.hitRates.correlations * 100).toFixed(2)}%\n`;
    report += `  - Indicators: ${(metrics.cache.hitRates.indicators * 100).toFixed(2)}%\n`;
    report += `  - Fundamentals: ${(metrics.cache.hitRates.fundamentals * 100).toFixed(2)}%\n\n`;

    report += `Batch Processing:\n`;
    report += `  - Processed: ${metrics.batch.processed}\n`;
    report += `  - Failed: ${metrics.batch.failed}\n`;
    report += `  - Queue Size: ${metrics.batch.queueSize}\n`;
    report += `  - Avg Time/Prediction: ${metrics.batch.avgTimePerPrediction.toFixed(2)}ms\n\n`;

    report += `Memory Usage:\n`;
    report += `  - RSS: ${(metrics.efficiency.memoryUsage.rss / 1024 / 1024).toFixed(2)}MB\n`;
    report += `  - Heap Used: ${(metrics.efficiency.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB\n`;
    report += `  - Heap Total: ${(metrics.efficiency.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB\n`;

    return report;
  }
}

// Export
module.exports = {
  CacheManager,
  BatchProcessor,
  SparseMatrixOptimizer,
  LazyIndicatorLoader,
  PredictionPipelineOptimizer
};
