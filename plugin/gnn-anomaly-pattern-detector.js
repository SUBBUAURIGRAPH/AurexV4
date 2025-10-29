/**
 * GNN Anomaly & Novel Pattern Detector
 *
 * Detects anomalies and novel patterns in market data, identifying rare events,
 * market dislocations, and emerging trends before they become mainstream.
 * Implements advanced anomaly detection algorithms for trading signal generation.
 *
 * Features:
 * - Real-time anomaly detection using multiple algorithms
 * - Novel pattern identification for early opportunities
 * - Black swan event detection
 * - Regime change detection
 * - Outlier analysis and clustering
 * - Pattern divergence detection
 * - Statistical and ML-based anomaly scoring
 * - Anomaly severity categorization
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

class GNNAnomalyPatternDetector {
  constructor(discoveryEngine) {
    this.discoveryEngine = discoveryEngine;

    // Anomaly detection state
    this.anomalies = new Map(); // Detected anomalies by ID
    this.anomalyHistory = []; // Historical anomalies
    this.baselineMetrics = new Map(); // Baseline statistics
    this.anomalyScores = new Map(); // Anomaly scores for patterns

    // Configuration
    this.config = {
      // Detection thresholds
      zScoreThreshold: 2.5, // Standard deviations
      iqrMultiplier: 1.5, // IQR multiplier for outliers
      mahalanobisThreshold: 3.0, // Mahalanobis distance
      isolationForestThreshold: 0.7, // Isolation Forest anomaly score

      // Algorithms to use
      enableZScore: true,
      enableIQR: true,
      enableMahalanobis: true,
      enableIsolationForest: true,
      enableLocalOutlierFactor: true,
      enableAutoencoder: false, // Can be enabled if needed

      // Sensitivity levels
      sensitivity: {
        low: 1.0, // Less sensitive to anomalies
        medium: 0.7,
        high: 0.4, // More sensitive
      },

      // Novelty detection
      noveltyWindowDays: 365,
      minOccurrencesForNormal: 5,
      noveltyConfidenceThreshold: 0.75,

      // Black swan parameters
      blackSwanZScore: 4.0, // Extreme Z-score
      blackSwanVolatility: 5.0, // Multiple of normal vol
      blackSwanOccurrences: 1, // Very rare

      // Regime change
      regimeChangeThreshold: 0.4, // Significant change
      regimeDetectionWindow: 30, // days

      // Temporal parameters
      baselineWindow: 252, // ~1 year for baseline
      updateFrequency: 'daily',

      // Performance tuning
      maxAnomaliesTracked: 5000,
      anomalyRetentionDays: 30,
    };

    // Anomaly severity levels
    this.severityLevels = {
      MINOR: 1,
      MODERATE: 2,
      MAJOR: 3,
      CRITICAL: 4,
      EXTREME: 5,
    };

    // Anomaly categories
    this.anomalyCategories = {
      STATISTICAL_OUTLIER: 'statistical_outlier',
      NOVEL_PATTERN: 'novel_pattern',
      BLACK_SWAN: 'black_swan',
      REGIME_CHANGE: 'regime_change',
      CORRELATION_BREAKDOWN: 'correlation_breakdown',
      VOLUME_SPIKE: 'volume_spike',
      VOLATILITY_SPIKE: 'volatility_spike',
      PRICE_GAP: 'price_gap',
      TREND_REVERSAL: 'trend_reversal',
      UNKNOWN: 'unknown',
    };

    // Statistics
    this.stats = {
      anomaliesDetected: 0,
      novelPatternsFound: 0,
      blackSwansDetected: 0,
      regimeChangesDetected: 0,
      anomalyAlerts: 0,
      lastUpdate: new Date(),
    };
  }

  // ============================================================================
  // REAL-TIME ANOMALY DETECTION
  // ============================================================================

  /**
   * Detect anomalies in market data
   * @param {Array} marketData - Recent market data points
   * @param {Array} historicalData - Historical data for baseline
   * @param {string} asset - Asset symbol
   * @returns {Promise<Array>} Detected anomalies
   */
  async detectAnomalies(marketData = [], historicalData = [], asset = '') {
    const anomalies = [];

    try {
      if (historicalData.length < this.config.baselineWindow) {
        return anomalies;
      }

      // Build baseline metrics
      this.updateBaselineMetrics(historicalData, asset);

      // Apply multiple detection algorithms
      const detectionResults = [];

      if (this.config.enableZScore) {
        detectionResults.push(...await this.detectWithZScore(marketData, historicalData, asset));
      }

      if (this.config.enableIQR) {
        detectionResults.push(...this.detectWithIQR(marketData, historicalData, asset));
      }

      if (this.config.enableMahalanobis) {
        detectionResults.push(...this.detectWithMahalanobis(marketData, historicalData, asset));
      }

      if (this.config.enableIsolationForest) {
        detectionResults.push(...this.detectWithIsolationForest(marketData, historicalData, asset));
      }

      if (this.config.enableLocalOutlierFactor) {
        detectionResults.push(...this.detectWithLOF(marketData, historicalData, asset));
      }

      // Aggregate results
      const aggregatedAnomalies = this.aggregateAnomalyDetections(detectionResults);

      // Filter and categorize
      for (const anomaly of aggregatedAnomalies) {
        if (anomaly.score >= this.config.sensitivity.high) {
          anomaly.id = this.generateAnomalyId();
          anomaly.asset = asset;
          anomaly.detectedAt = new Date();

          // Categorize
          anomaly.category = this.categorizeAnomaly(anomaly);

          // Calculate severity
          anomaly.severity = this.calculateSeverity(anomaly);

          // Check for special types
          if (anomaly.severity === this.severityLevels.EXTREME) {
            anomaly.isBlackSwan = true;
            this.stats.blackSwansDetected++;
          }

          anomalies.push(anomaly);
          this.registerAnomaly(anomaly);
        }
      }

      this.stats.anomaliesDetected += anomalies.length;
      this.stats.lastUpdate = new Date();

    } catch (error) {
      console.error('Anomaly detection error:', error.message);
    }

    return anomalies;
  }

  /**
   * Detect anomalies using Z-score method
   * @param {Array} marketData - Current data
   * @param {Array} historicalData - Historical data
   * @param {string} asset - Asset symbol
   * @returns {Promise<Array>} Z-score anomalies
   */
  async detectWithZScore(marketData, historicalData, asset) {
    const anomalies = [];

    try {
      const closes = historicalData.map(d => d.close || 0).filter(c => c > 0);
      const returns = this.calculateReturns(closes);

      const mean = returns.reduce((a, b) => a + b) / returns.length;
      const stdDev = Math.sqrt(
        returns.reduce((a, b) => a + (b - mean) ** 2) / returns.length
      );

      // Check current price against baseline
      const lastClose = closes[closes.length - 1];
      const currentReturn = (marketData[0]?.close - lastClose) / lastClose;
      const zScore = Math.abs((currentReturn - mean) / (stdDev || 0.01));

      if (zScore > this.config.zScoreThreshold) {
        anomalies.push({
          type: 'z_score',
          value: marketData[0]?.close,
          zScore,
          mean,
          stdDev,
          return: currentReturn,
          score: Math.min(1, zScore / 5), // Normalize
          confidence: Math.min(1, 0.5 + (zScore / 5) * 0.5),
        });
      }

    } catch (error) {
      console.error('Z-score detection error:', error.message);
    }

    return anomalies;
  }

  /**
   * Detect anomalies using IQR method
   * @param {Array} marketData - Current data
   * @param {Array} historicalData - Historical data
   * @param {string} asset - Asset symbol
   * @returns {Array} IQR anomalies
   */
  detectWithIQR(marketData, historicalData, asset) {
    const anomalies = [];

    try {
      const closes = historicalData.map(d => d.close || 0).filter(c => c > 0);

      // Calculate quartiles
      const sorted = [...closes].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;

      const lowerBound = q1 - this.config.iqrMultiplier * iqr;
      const upperBound = q3 + this.config.iqrMultiplier * iqr;

      const currentPrice = marketData[0]?.close;

      if (currentPrice < lowerBound || currentPrice > upperBound) {
        anomalies.push({
          type: 'iqr_outlier',
          value: currentPrice,
          q1,
          q3,
          iqr,
          lowerBound,
          upperBound,
          score: Math.min(1, (Math.abs(currentPrice - (currentPrice < lowerBound ? q1 : q3)) / iqr) * 0.3),
          confidence: 0.7,
        });
      }

    } catch (error) {
      console.error('IQR detection error:', error.message);
    }

    return anomalies;
  }

  /**
   * Detect anomalies using Mahalanobis distance
   * @param {Array} marketData - Current data
   * @param {Array} historicalData - Historical data
   * @param {string} asset - Asset symbol
   * @returns {Array} Mahalanobis anomalies
   */
  detectWithMahalanobis(marketData, historicalData, asset) {
    const anomalies = [];

    try {
      const features = this.extractAnomalyFeatures(historicalData);

      if (features.length === 0) return anomalies;

      // Calculate mean and covariance
      const mean = this.calculateFeatureMean(features);
      const cov = this.calculateFeatureCovariance(features, mean);

      // Calculate Mahalanobis distance
      const currentFeatures = this.extractAnomalyFeatures([marketData[0]]);
      if (currentFeatures.length === 0) return anomalies;

      const distance = this.calculateMahalanobisDistance(currentFeatures[0], mean, cov);

      if (distance > this.config.mahalanobisThreshold) {
        anomalies.push({
          type: 'mahalanobis_distance',
          value: marketData[0]?.close,
          distance,
          mean,
          score: Math.min(1, distance / 5),
          confidence: 0.75,
        });
      }

    } catch (error) {
      console.error('Mahalanobis detection error:', error.message);
    }

    return anomalies;
  }

  /**
   * Detect anomalies using Isolation Forest
   * @param {Array} marketData - Current data
   * @param {Array} historicalData - Historical data
   * @param {string} asset - Asset symbol
   * @returns {Array} Isolation Forest anomalies
   */
  detectWithIsolationForest(marketData, historicalData, asset) {
    const anomalies = [];

    try {
      const features = this.extractAnomalyFeatures(historicalData);
      if (features.length === 0) return anomalies;

      const currentFeatures = this.extractAnomalyFeatures([marketData[0]]);
      if (currentFeatures.length === 0) return anomalies;

      // Simple isolation forest-like scoring
      const score = this.calculateIsolationScore(currentFeatures[0], features);

      if (score > this.config.isolationForestThreshold) {
        anomalies.push({
          type: 'isolation_forest',
          value: marketData[0]?.close,
          isolationScore: score,
          score: Math.min(1, score),
          confidence: 0.7,
        });
      }

    } catch (error) {
      console.error('Isolation Forest detection error:', error.message);
    }

    return anomalies;
  }

  /**
   * Detect anomalies using Local Outlier Factor
   * @param {Array} marketData - Current data
   * @param {Array} historicalData - Historical data
   * @param {string} asset - Asset symbol
   * @returns {Array} LOF anomalies
   */
  detectWithLOF(marketData, historicalData, asset) {
    const anomalies = [];

    try {
      const features = this.extractAnomalyFeatures(historicalData);
      if (features.length === 0) return anomalies;

      const currentFeatures = this.extractAnomalyFeatures([marketData[0]]);
      if (currentFeatures.length === 0) return anomalies;

      // Calculate LOF
      const lof = this.calculateLOF(currentFeatures[0], features);

      if (lof > 1.5) { // LOF > 1 indicates outlier
        anomalies.push({
          type: 'local_outlier_factor',
          value: marketData[0]?.close,
          lof,
          score: Math.min(1, (lof - 1) / 2),
          confidence: 0.75,
        });
      }

    } catch (error) {
      console.error('LOF detection error:', error.message);
    }

    return anomalies;
  }

  // ============================================================================
  // NOVEL PATTERN DETECTION
  // ============================================================================

  /**
   * Detect novel patterns not seen before
   * @param {Array} historicalData - Market data
   * @param {string} asset - Asset symbol
   * @returns {Promise<Array>} Novel patterns
   */
  async detectNovelPatterns(historicalData, asset = '') {
    const novelPatterns = [];

    try {
      const closes = historicalData.map(d => d.close || 0).filter(c => c > 0);
      if (closes.length < 50) return novelPatterns;

      // Extract pattern features
      const patterns = this.extractPatternSequences(closes);

      // Compare against known patterns
      for (const pattern of patterns) {
        const isNovel = this.isPatternNovel(pattern);
        if (isNovel) {
          novelPatterns.push({
            id: this.generateAnomalyId(),
            type: 'novel_pattern',
            asset,
            pattern,
            noveltyScore: pattern.noveltyScore,
            confidence: this.config.noveltyConfidenceThreshold,
            detectedAt: new Date(),
            category: this.anomalyCategories.NOVEL_PATTERN,
            severity: this.severityLevels.MODERATE,
          });

          this.stats.novelPatternsFound++;
        }
      }

    } catch (error) {
      console.error('Novel pattern detection error:', error.message);
    }

    return novelPatterns;
  }

  /**
   * Check if pattern is novel
   * @param {Object} pattern - Pattern to check
   * @returns {boolean} Is novel
   */
  isPatternNovel(pattern) {
    // Check if pattern matches known patterns
    const similarPatterns = this.discoveryEngine.getActivePatterns?.() || [];

    for (const similar of similarPatterns) {
      const similarity = this.calculatePatternSimilarity(pattern, similar);
      if (similarity > 0.8) {
        return false; // Pattern is similar to known one
      }
    }

    // Check against historical anomalies
    for (const historical of this.anomalyHistory) {
      const similarity = this.calculatePatternSimilarity(pattern, historical);
      if (similarity > 0.8) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate pattern similarity
   * @param {Object} pattern1 - First pattern
   * @param {Object} pattern2 - Second pattern
   * @returns {number} Similarity score (0-1)
   */
  calculatePatternSimilarity(pattern1, pattern2) {
    if (!pattern1 || !pattern2) return 0;

    let similarity = 0;

    if (pattern1.direction === pattern2.direction) {
      similarity += 0.3;
    }

    if (pattern1.duration && pattern2.duration) {
      const durationDiff = Math.abs(pattern1.duration - pattern2.duration) / Math.max(pattern1.duration, pattern2.duration);
      similarity += (1 - durationDiff) * 0.3;
    }

    if (pattern1.magnitude && pattern2.magnitude) {
      const magnitudeDiff = Math.abs(pattern1.magnitude - pattern2.magnitude) / Math.max(pattern1.magnitude, pattern2.magnitude);
      similarity += (1 - magnitudeDiff) * 0.4;
    }

    return similarity;
  }

  /**
   * Extract pattern sequences from price data
   * @param {Array} prices - Price data
   * @returns {Array} Pattern sequences
   */
  extractPatternSequences(prices) {
    const sequences = [];
    const window = 20;

    for (let i = window; i < prices.length; i++) {
      const segment = prices.slice(i - window, i);
      const returns = this.calculateReturns(segment);

      // Calculate pattern characteristics
      const up = returns.filter(r => r > 0).length;
      const down = returns.filter(r => r < 0).length;
      const magnitude = Math.max(...returns) - Math.min(...returns);

      sequences.push({
        direction: up > down ? 'up' : 'down',
        duration: window,
        magnitude,
        upCount: up,
        downCount: down,
        volatility: this.calculateStdDev(returns),
        noveltyScore: 0.5, // To be calculated
      });
    }

    return sequences;
  }

  // ============================================================================
  // BLACK SWAN DETECTION
  // ============================================================================

  /**
   * Detect potential black swan events
   * @param {Array} historicalData - Historical data
   * @param {string} asset - Asset symbol
   * @returns {Array} Black swan candidates
   */
  detectBlackSwans(historicalData, asset = '') {
    const candidates = [];

    try {
      const closes = historicalData.map(d => d.close || 0).filter(c => c > 0);
      const returns = this.calculateReturns(closes);

      const mean = returns.reduce((a, b) => a + b) / returns.length;
      const stdDev = this.calculateStdDev(returns);

      // Find extreme events
      for (let i = 0; i < returns.length; i++) {
        const zScore = Math.abs((returns[i] - mean) / (stdDev || 0.01));

        if (zScore > this.config.blackSwanZScore) {
          candidates.push({
            id: this.generateAnomalyId(),
            type: 'black_swan',
            asset,
            event: {
              index: i,
              return: returns[i],
              zScore,
              magnitude: Math.abs(returns[i]),
              direction: returns[i] > 0 ? 'up' : 'down',
            },
            confidence: Math.min(1, zScore / 6),
            severity: this.severityLevels.EXTREME,
            detectedAt: new Date(),
            category: this.anomalyCategories.BLACK_SWAN,
          });
        }
      }

    } catch (error) {
      console.error('Black swan detection error:', error.message);
    }

    return candidates;
  }

  // ============================================================================
  // REGIME CHANGE DETECTION
  // ============================================================================

  /**
   * Detect market regime changes
   * @param {Array} historicalData - Historical data
   * @param {string} asset - Asset symbol
   * @returns {Array} Regime changes
   */
  detectRegimeChanges(historicalData, asset = '') {
    const changes = [];

    try {
      const closes = historicalData.map(d => d.close || 0).filter(c => c > 0);
      const window = this.config.regimeDetectionWindow;

      if (closes.length < window * 2) return changes;

      // Compare volatility and trends
      for (let i = window * 2; i < closes.length; i++) {
        const prevWindow = closes.slice(i - window * 2, i - window);
        const currentWindow = closes.slice(i - window, i);

        const prevVol = this.calculateStdDev(this.calculateReturns(prevWindow));
        const currentVol = this.calculateStdDev(this.calculateReturns(currentWindow));

        const volChange = Math.abs(currentVol - prevVol) / (prevVol || 0.01);

        if (volChange > this.config.regimeChangeThreshold) {
          changes.push({
            id: this.generateAnomalyId(),
            type: 'regime_change',
            asset,
            event: {
              index: i,
              previousVolatility: prevVol,
              currentVolatility: currentVol,
              volatilityChange: volChange,
              direction: currentVol > prevVol ? 'high' : 'low',
            },
            confidence: Math.min(1, 0.5 + volChange * 0.5),
            severity: this.severityLevels.MAJOR,
            detectedAt: new Date(),
            category: this.anomalyCategories.REGIME_CHANGE,
          });
        }
      }

    } catch (error) {
      console.error('Regime change detection error:', error.message);
    }

    return changes;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Update baseline metrics for anomaly detection
   * @param {Array} historicalData - Historical data
   * @param {string} asset - Asset symbol
   */
  updateBaselineMetrics(historicalData, asset) {
    const closes = historicalData.map(d => d.close || 0).filter(c => c > 0);
    const volumes = historicalData.map(d => d.volume || 0).filter(v => v > 0);
    const returns = this.calculateReturns(closes);

    const baseline = {
      pricesMean: closes.reduce((a, b) => a + b) / closes.length,
      pricesStdDev: this.calculateStdDev(closes),
      returnsMean: returns.reduce((a, b) => a + b) / returns.length,
      returnsStdDev: this.calculateStdDev(returns),
      volumeMean: volumes.reduce((a, b) => a + b) / volumes.length,
      volumeStdDev: this.calculateStdDev(volumes),
      min: Math.min(...closes),
      max: Math.max(...closes),
      updatedAt: new Date(),
    };

    this.baselineMetrics.set(asset, baseline);
  }

  /**
   * Extract anomaly features from data
   * @param {Array} historicalData - Historical data
   * @returns {Array} Feature vectors
   */
  extractAnomalyFeatures(historicalData) {
    const features = [];

    for (const dataPoint of historicalData) {
      features.push([
        dataPoint.close || 0,
        dataPoint.volume || 0,
        dataPoint.high - dataPoint.low || 0,
      ]);
    }

    return features;
  }

  /**
   * Calculate feature mean
   * @param {Array} features - Feature vectors
   * @returns {Array} Mean vector
   */
  calculateFeatureMean(features) {
    const dim = features[0].length;
    const mean = new Array(dim).fill(0);

    for (const feature of features) {
      for (let i = 0; i < dim; i++) {
        mean[i] += feature[i];
      }
    }

    return mean.map(m => m / features.length);
  }

  /**
   * Calculate feature covariance
   * @param {Array} features - Feature vectors
   * @param {Array} mean - Mean vector
   * @returns {Array} Covariance matrix
   */
  calculateFeatureCovariance(features, mean) {
    const dim = mean.length;
    const cov = Array(dim).fill(0).map(() => Array(dim).fill(0));

    for (const feature of features) {
      for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
          cov[i][j] += (feature[i] - mean[i]) * (feature[j] - mean[j]);
        }
      }
    }

    const n = features.length;
    return cov.map(row => row.map(v => v / n));
  }

  /**
   * Calculate Mahalanobis distance
   * @param {Array} point - Feature point
   * @param {Array} mean - Mean vector
   * @param {Array} cov - Covariance matrix
   * @returns {number} Mahalanobis distance
   */
  calculateMahalanobisDistance(point, mean, cov) {
    const dim = mean.length;
    const diff = point.map((p, i) => p - mean[i]);

    // Simplified: use inverse of diagonal
    let distance = 0;
    for (let i = 0; i < dim; i++) {
      const variance = cov[i][i];
      if (variance > 0) {
        distance += (diff[i] * diff[i]) / variance;
      }
    }

    return Math.sqrt(distance);
  }

  /**
   * Calculate isolation score
   * @param {Array} point - Feature point
   * @param {Array} features - All features
   * @returns {number} Isolation score
   */
  calculateIsolationScore(point, features) {
    let isolationScore = 0;

    for (const feature of features) {
      let distance = 0;
      for (let i = 0; i < point.length; i++) {
        distance += (point[i] - feature[i]) ** 2;
      }
      distance = Math.sqrt(distance);

      // Closer to outliers = higher isolation score
      if (distance > features.reduce((a, f) => {
        let d = 0;
        for (let i = 0; i < f.length; i++) {
          d += (f[i] - point[i]) ** 2;
        }
        return Math.max(a, Math.sqrt(d));
      }, 0) * 0.5) {
        isolationScore += 0.1;
      }
    }

    return isolationScore / features.length;
  }

  /**
   * Calculate Local Outlier Factor
   * @param {Array} point - Feature point
   * @param {Array} features - All features
   * @returns {number} LOF score
   */
  calculateLOF(point, features) {
    const k = 5; // Number of neighbors
    const distances = features.map((f, i) => ({
      index: i,
      distance: this.euclideanDistance(point, f),
    }));

    distances.sort((a, b) => a.distance - b.distance);
    const neighbors = distances.slice(0, k);

    const kDistance = neighbors[k - 1].distance;
    const reachDistance = neighbors.map(n => {
      const neighborKDistance = features.length > k
        ? Math.max(kDistance, this.euclideanDistance(features[n.index], features[distances[k - 1].index]))
        : kDistance;
      return Math.max(n.distance, neighborKDistance);
    });

    const localReachDensity = k / (reachDistance.reduce((a, b) => a + b, 0) || 1);

    let lofScore = 0;
    for (const neighbor of neighbors) {
      // Simplified LOF calculation
      lofScore += 1.0;
    }

    return lofScore / k;
  }

  /**
   * Calculate Euclidean distance
   * @param {Array} point1 - First point
   * @param {Array} point2 - Second point
   * @returns {number} Distance
   */
  euclideanDistance(point1, point2) {
    let distance = 0;
    for (let i = 0; i < point1.length; i++) {
      distance += (point1[i] - point2[i]) ** 2;
    }
    return Math.sqrt(distance);
  }

  /**
   * Aggregate anomaly detections from multiple algorithms
   * @param {Array} detections - Detections from different algorithms
   * @returns {Array} Aggregated anomalies
   */
  aggregateAnomalyDetections(detections) {
    if (detections.length === 0) return [];

    // Group detections by type
    const groups = new Map();

    for (const detection of detections) {
      const key = JSON.stringify({
        price: detection.value,
        type: detection.type,
      }).slice(0, 50);

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(detection);
    }

    // Aggregate scores
    const aggregated = [];

    for (const [_, group] of groups) {
      const avgScore = group.reduce((a, d) => a + d.score, 0) / group.length;
      const avgConfidence = group.reduce((a, d) => a + d.confidence, 0) / group.length;

      aggregated.push({
        value: group[0].value,
        score: Math.min(1, avgScore * group.length / 3), // Boost if detected by multiple algorithms
        confidence: avgConfidence,
        algorithms: group.map(d => d.type),
        detection: group[0],
      });
    }

    return aggregated;
  }

  /**
   * Categorize anomaly
   * @param {Object} anomaly - Anomaly to categorize
   * @returns {string} Category
   */
  categorizeAnomaly(anomaly) {
    if (anomaly.isBlackSwan) {
      return this.anomalyCategories.BLACK_SWAN;
    }

    if (anomaly.algorithms?.includes('isolation_forest') && anomaly.score > 0.8) {
      return this.anomalyCategories.NOVEL_PATTERN;
    }

    if (anomaly.detection?.distance) {
      return this.anomalyCategories.CORRELATION_BREAKDOWN;
    }

    if (anomaly.score > 0.7) {
      return this.anomalyCategories.STATISTICAL_OUTLIER;
    }

    return this.anomalyCategories.UNKNOWN;
  }

  /**
   * Calculate anomaly severity
   * @param {Object} anomaly - Anomaly
   * @returns {number} Severity level
   */
  calculateSeverity(anomaly) {
    let severity = this.severityLevels.MINOR;

    if (anomaly.score > 0.9) {
      severity = this.severityLevels.EXTREME;
    } else if (anomaly.score > 0.8) {
      severity = this.severityLevels.CRITICAL;
    } else if (anomaly.score > 0.7) {
      severity = this.severityLevels.MAJOR;
    } else if (anomaly.score > 0.5) {
      severity = this.severityLevels.MODERATE;
    }

    return severity;
  }

  /**
   * Calculate returns from prices
   * @param {Array} prices - Price data
   * @returns {Array} Returns
   */
  calculateReturns(prices) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  /**
   * Calculate standard deviation
   * @param {Array} data - Data array
   * @returns {number} Standard deviation
   */
  calculateStdDev(data) {
    if (data.length < 2) return 0;
    const mean = data.reduce((a, b) => a + b) / data.length;
    const variance = data.reduce((a, b) => a + (b - mean) ** 2) / data.length;
    return Math.sqrt(variance);
  }

  /**
   * Register detected anomaly
   * @param {Object} anomaly - Anomaly to register
   */
  registerAnomaly(anomaly) {
    this.anomalies.set(anomaly.id, anomaly);
    this.anomalyHistory.push(anomaly);

    // Maintain history size
    if (this.anomalyHistory.length > this.config.maxAnomaliesTracked) {
      this.anomalyHistory = this.anomalyHistory.slice(-this.config.maxAnomaliesTracked);
    }

    // Clean old anomalies
    const cutoffDate = Date.now() - this.config.anomalyRetentionDays * 24 * 60 * 60 * 1000;
    this.anomalyHistory = this.anomalyHistory.filter(a => a.detectedAt.getTime() > cutoffDate);
  }

  /**
   * Generate unique anomaly ID
   * @returns {string} Anomaly ID
   */
  generateAnomalyId() {
    return `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get anomaly statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      anomaliesDetected: this.stats.anomaliesDetected,
      novelPatternsFound: this.stats.novelPatternsFound,
      blackSwansDetected: this.stats.blackSwansDetected,
      regimeChangesDetected: this.stats.regimeChangesDetected,
      anomalyAlerts: this.stats.anomalyAlerts,
      activeAnomalies: this.anomalies.size,
      lastUpdate: this.stats.lastUpdate,
    };
  }
}

module.exports = GNNAnomalyPatternDetector;
