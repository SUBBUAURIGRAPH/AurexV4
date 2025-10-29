/**
 * GNN Pattern Confidence Scorer
 *
 * Calculates and validates confidence scores for discovered trading patterns.
 * Implements multiple scoring methodologies and cross-validates pattern quality.
 * Provides real-time confidence updates based on pattern performance.
 *
 * Features:
 * - Multi-dimensional confidence scoring (statistical, ML-based, performance-based)
 * - Bayesian confidence updating
 * - Cross-pattern validation
 * - Confidence calibration
 * - Temporal confidence decay
 * - Ensemble confidence scoring
 * - Score explanation and transparency
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

class GNNPatternConfidenceScorer {
  constructor() {
    // Scoring configuration
    this.config = {
      // Score dimensions
      dimensions: {
        statistical: 0.25, // Based on statistical significance
        frequency: 0.20, // Occurrence frequency weight
        performance: 0.25, // Historical performance
        stability: 0.15, // Score stability over time
        novelty: 0.15, // Pattern novelty/rarity
      },

      // Scoring parameters
      minConfidenceTreshold: 0.45,
      maxConfidence: 0.99,

      // Statistical scoring
      minSampleSize: 30,
      minFrequency: 3,
      alphaLevel: 0.05,

      // Performance scoring
      performanceWindow: 30, // days
      minProfitability: 0.01, // 1% minimum
      maxDrawdown: 0.2, // 20% max
      sharpeRatioTarget: 0.5,

      // Stability parameters
      stabilityWindow: 7, // days
      stabilityThreshold: 0.1, // 10% max variance

      // Decay parameters
      decayRate: 0.001, // Daily decay
      decayMinimum: 0.30, // Don't go below 30%

      // Calibration
      calibrationWindow: 90, // days
      calibrationBinCount: 10,

      // Ensemble settings
      ensembleWeights: {
        conservative: { statistical: 0.35, frequency: 0.15, performance: 0.35, stability: 0.10, novelty: 0.05 },
        balanced: { statistical: 0.25, frequency: 0.20, performance: 0.25, stability: 0.15, novelty: 0.15 },
        aggressive: { statistical: 0.15, frequency: 0.25, performance: 0.35, stability: 0.10, novelty: 0.15 },
      },
    };

    // Scoring state
    this.patternScores = new Map(); // Pattern ID -> score history
    this.scoreHistory = []; // All score updates
    this.calibrationData = new Map(); // Calibration metrics
    this.scoreExplanations = new Map(); // Score breakdown

    // Statistics
    this.stats = {
      patternsScored: 0,
      scoreUpdates: 0,
      calibrationsRun: 0,
      avgConfidence: 0,
      lastUpdate: new Date(),
    };
  }

  // ============================================================================
  // PRIMARY SCORING METHODS
  // ============================================================================

  /**
   * Calculate comprehensive confidence score for pattern
   * @param {Object} pattern - Pattern to score
   * @param {Array} performance - Historical performance data
   * @param {Object} options - Scoring options
   * @returns {Object} Score and breakdown
   */
  calculateConfidence(pattern, performance = [], options = {}) {
    const startTime = Date.now();

    try {
      const strategy = options.strategy || 'balanced';
      const weights = this.config.ensembleWeights[strategy];

      // Calculate dimension scores
      const statisticalScore = this.calculateStatisticalScore(pattern, performance);
      const frequencyScore = this.calculateFrequencyScore(pattern);
      const performanceScore = this.calculatePerformanceScore(performance);
      const stabilityScore = this.calculateStabilityScore(pattern);
      const noveltyScore = this.calculateNoveltyScore(pattern);

      // Weighted ensemble
      const scores = {
        statistical: statisticalScore,
        frequency: frequencyScore,
        performance: performanceScore,
        stability: stabilityScore,
        novelty: noveltyScore,
      };

      let finalScore = 0;
      const breakdown = {};

      for (const [dimension, weight] of Object.entries(weights)) {
        const score = scores[dimension] || 0;
        breakdown[dimension] = {
          score,
          weight,
          contribution: score * weight,
        };
        finalScore += score * weight;
      }

      // Apply calibration correction
      finalScore = this.applyCalibrationCorrection(finalScore);

      // Clamp to valid range
      finalScore = Math.max(this.config.minConfidenceTreshold, Math.min(this.config.maxConfidence, finalScore));

      // Build comprehensive result
      const result = {
        patternId: pattern.id,
        confidence: finalScore,
        breakdown,
        strategy,
        timestamp: new Date(),
        calculationTimeMs: Date.now() - startTime,
      };

      // Store result
      this.storeConfidenceScore(pattern.id, result);

      return result;

    } catch (error) {
      console.error('Confidence calculation error:', error.message);
      return {
        patternId: pattern.id,
        confidence: 0.5,
        breakdown: {},
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Calculate statistical significance score
   * @param {Object} pattern - Pattern
   * @param {Array} performance - Performance data
   * @returns {number} Statistical score (0-1)
   */
  calculateStatisticalScore(pattern, performance) {
    try {
      const sampleSize = performance.length;

      // Check minimum sample size
      if (sampleSize < this.config.minSampleSize) {
        return 0.3 + (sampleSize / this.config.minSampleSize) * 0.3; // Penalty for small sample
      }

      // Calculate statistical significance
      const wins = performance.filter(p => p.result === 'win').length;
      const losses = performance.filter(p => p.result === 'loss').length;
      const winRate = wins / sampleSize;

      // Binomial test for significance
      const expectedWinRate = 0.5; // Null hypothesis
      const stdError = Math.sqrt((expectedWinRate * (1 - expectedWinRate)) / sampleSize);
      const zScore = (winRate - expectedWinRate) / stdError;
      const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));

      // Convert p-value to confidence score
      let statScore = 0;

      if (pValue < this.config.alphaLevel) {
        // Significant result
        statScore = 0.5 + (Math.abs(zScore) / 3) * 0.5; // Up to 1.0
      } else {
        // Non-significant
        statScore = 0.3 + pValue * 0.2; // 0.3-0.5
      }

      return Math.min(1, statScore);

    } catch (error) {
      console.error('Statistical score calculation error:', error.message);
      return 0.5;
    }
  }

  /**
   * Calculate frequency score
   * @param {Object} pattern - Pattern
   * @returns {number} Frequency score (0-1)
   */
  calculateFrequencyScore(pattern) {
    const occurrences = pattern.occurrences || 0;

    // Minimum frequency requirement
    if (occurrences < this.config.minFrequency) {
      return 0.3 + (occurrences / this.config.minFrequency) * 0.2; // 0.3-0.5
    }

    // Score increases with frequency
    // More occurrences = higher confidence (diminishing returns)
    const frequencyScore = Math.log(occurrences) / Math.log(100);
    return Math.min(1, 0.5 + frequencyScore * 0.5); // 0.5-1.0
  }

  /**
   * Calculate performance score
   * @param {Array} performance - Performance data
   * @returns {number} Performance score (0-1)
   */
  calculatePerformanceScore(performance) {
    try {
      if (performance.length === 0) {
        return 0.5; // Neutral
      }

      // Calculate metrics
      const wins = performance.filter(p => p.result === 'win').length;
      const winRate = wins / performance.length;

      const returns = performance.map(p => p.return || 0);
      const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
      const returnStdDev = this.calculateStdDev(returns);

      // Sharpe ratio
      const sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;

      // Drawdown
      let cumulativeReturn = 1;
      let peak = 1;
      let maxDrawdown = 0;

      for (const ret of returns) {
        cumulativeReturn *= (1 + ret);
        peak = Math.max(peak, cumulativeReturn);
        const drawdown = (peak - cumulativeReturn) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }

      // Performance score components
      const winRateScore = Math.min(1, winRate / 0.6); // 60%+ is excellent
      const sharpeScore = Math.min(1, Math.max(0, (sharpeRatio + 2) / 4)); // Normalize
      const drawdownScore = Math.max(0, 1 - maxDrawdown / this.config.maxDrawdown); // Penalty for large DD

      // Weighted average
      const perfScore = (winRateScore * 0.4 + sharpeScore * 0.3 + drawdownScore * 0.3);

      return Math.min(1, perfScore);

    } catch (error) {
      console.error('Performance score calculation error:', error.message);
      return 0.5;
    }
  }

  /**
   * Calculate stability score
   * @param {Object} pattern - Pattern
   * @returns {number} Stability score (0-1)
   */
  calculateStabilityScore(pattern) {
    try {
      const scoreHistory = this.patternScores.get(pattern.id) || [];

      if (scoreHistory.length < 2) {
        return 0.5; // Default for new patterns
      }

      // Get recent scores
      const recentScores = scoreHistory.slice(-Math.ceil(this.config.stabilityWindow / 7));
      const scores = recentScores.map(s => s.confidence);

      // Calculate variance
      const mean = scores.reduce((a, b) => a + b) / scores.length;
      const variance = scores.reduce((a, b) => a + (b - mean) ** 2) / scores.length;
      const stdDev = Math.sqrt(variance);

      // Score: low variance = high stability
      const varianceRatio = stdDev / (mean || 0.5);
      const stabilityScore = Math.max(0, 1 - varianceRatio);

      return Math.min(1, stabilityScore);

    } catch (error) {
      console.error('Stability score calculation error:', error.message);
      return 0.5;
    }
  }

  /**
   * Calculate novelty score
   * @param {Object} pattern - Pattern
   * @returns {number} Novelty score (0-1)
   */
  calculateNoveltyScore(pattern) {
    try {
      const age = Date.now() - (pattern.discoveredAt?.getTime() || Date.now());
      const ageInDays = age / (24 * 60 * 60 * 1000);

      // Recently discovered patterns get higher novelty scores
      if (ageInDays < 7) {
        return 0.9;
      } else if (ageInDays < 30) {
        return 0.7;
      } else if (ageInDays < 90) {
        return 0.5;
      } else {
        return 0.3; // Older patterns are less novel
      }

    } catch (error) {
      console.error('Novelty score calculation error:', error.message);
      return 0.5;
    }
  }

  // ============================================================================
  // BAYESIAN CONFIDENCE UPDATING
  // ============================================================================

  /**
   * Update confidence score using Bayesian inference
   * @param {string} patternId - Pattern ID
   * @param {number} priorConfidence - Prior confidence
   * @param {Object} evidence - New evidence (trade outcomes)
   * @returns {number} Posterior confidence
   */
  updateConfidenceBayesian(patternId, priorConfidence, evidence) {
    try {
      const likelihood = this.calculateLikelihood(evidence);
      const evidence_prob = this.calculateEvidenceProbability(evidence);

      // Bayes' theorem
      const posteriorOdds = (likelihood * priorConfidence) / (evidence_prob || 0.5);
      const posterior = posteriorOdds / (1 + posteriorOdds);

      return Math.min(1, Math.max(0, posterior));

    } catch (error) {
      console.error('Bayesian update error:', error.message);
      return priorConfidence;
    }
  }

  /**
   * Calculate likelihood of evidence given pattern is good
   * @param {Object} evidence - Evidence (trade outcome)
   * @returns {number} Likelihood probability
   */
  calculateLikelihood(evidence) {
    if (evidence.result === 'win') {
      return 0.7; // 70% chance of win if pattern is good
    } else {
      return 0.3; // 30% chance of loss
    }
  }

  /**
   * Calculate probability of observing evidence
   * @param {Object} evidence - Evidence
   * @returns {number} Evidence probability
   */
  calculateEvidenceProbability(evidence) {
    // P(E) = P(E|good) * P(good) + P(E|bad) * P(bad)
    const pGood = 0.5; // Prior assumption
    const pBad = 0.5;

    const pEGiven_Good = evidence.result === 'win' ? 0.7 : 0.3;
    const pEGiven_Bad = evidence.result === 'win' ? 0.4 : 0.6;

    return (pEGiven_Good * pGood) + (pEGiven_Bad * pBad);
  }

  // ============================================================================
  // CONFIDENCE CALIBRATION
  // ============================================================================

  /**
   * Calibrate confidence scores
   * @param {Array} patterns - Patterns with scores and outcomes
   * @returns {Object} Calibration result
   */
  calibrateScores(patterns) {
    try {
      const result = {
        calibrated: 0,
        corrections: [],
        overconfidence: 0,
        underconfidence: 0,
      };

      // Bin patterns by confidence
      const bins = Array(this.config.calibrationBinCount).fill(0).map(() => ({
        scores: [],
        outcomes: [],
      }));

      for (const pattern of patterns) {
        const binIndex = Math.min(
          this.config.calibrationBinCount - 1,
          Math.floor(pattern.confidence * this.config.calibrationBinCount)
        );

        bins[binIndex].scores.push(pattern.confidence);
        bins[binIndex].outcomes.push(pattern.winRate || 0.5);
      }

      // Calculate corrections
      for (let i = 0; i < bins.length; i++) {
        if (bins[i].scores.length === 0) continue;

        const avgScore = bins[i].scores.reduce((a, b) => a + b) / bins[i].scores.length;
        const avgOutcome = bins[i].outcomes.reduce((a, b) => a + b) / bins[i].outcomes.length;

        const correction = avgOutcome - avgScore;

        if (Math.abs(correction) > 0.05) {
          result.corrections.push({
            bin: i,
            expectedScore: avgScore,
            actualOutcome: avgOutcome,
            correction,
          });

          if (avgScore > avgOutcome) {
            result.overconfidence++;
          } else {
            result.underconfidence++;
          }

          result.calibrated += bins[i].scores.length;
        }
      }

      this.calibrationData.set(`calib_${Date.now()}`, result);
      this.stats.calibrationsRun++;

      return result;

    } catch (error) {
      console.error('Calibration error:', error.message);
      return { calibrated: 0, corrections: [], error: error.message };
    }
  }

  /**
   * Apply calibration correction to score
   * @param {number} score - Raw confidence score
   * @returns {number} Calibrated score
   */
  applyCalibrationCorrection(score) {
    try {
      // Get most recent calibration
      const calibrations = Array.from(this.calibrationData.values());
      if (calibrations.length === 0) return score;

      const latestCalib = calibrations[calibrations.length - 1];

      // Find applicable correction
      for (const correction of latestCalib.corrections) {
        const binStart = correction.bin / this.config.calibrationBinCount;
        const binEnd = (correction.bin + 1) / this.config.calibrationBinCount;

        if (score >= binStart && score < binEnd) {
          // Apply correction
          const correctedScore = score + correction.correction;
          return Math.max(this.config.minConfidenceTreshold, Math.min(this.config.maxConfidence, correctedScore));
        }
      }

      return score;

    } catch (error) {
      console.error('Calibration correction error:', error.message);
      return score;
    }
  }

  // ============================================================================
  // TEMPORAL CONFIDENCE DECAY
  // ============================================================================

  /**
   * Apply temporal decay to confidence scores
   * @param {Array} patterns - Patterns to apply decay to
   * @returns {number} Number of patterns decayed
   */
  applyTemporalDecay(patterns) {
    let count = 0;

    for (const pattern of patterns) {
      const age = Date.now() - (pattern.statusUpdatedAt?.getTime() || pattern.discoveredAt?.getTime() || Date.now());
      const ageInDays = age / (24 * 60 * 60 * 1000);

      // Apply decay
      const decayFactor = 1 - (this.config.decayRate * ageInDays);
      const decayedConfidence = Math.max(
        this.config.decayMinimum,
        pattern.confidence * decayFactor
      );

      if (decayedConfidence !== pattern.confidence) {
        pattern.confidence = decayedConfidence;
        pattern.confidenceDecayed = true;
        pattern.confidenceDecayRate = 1 - decayFactor;
        count++;
      }
    }

    return count;
  }

  // ============================================================================
  // ENSEMBLE & CROSS-PATTERN VALIDATION
  // ============================================================================

  /**
   * Calculate ensemble confidence from multiple patterns
   * @param {Array} patterns - Component patterns
   * @returns {Object} Ensemble confidence result
   */
  calculateEnsembleConfidence(patterns) {
    try {
      if (patterns.length === 0) {
        return { confidence: 0.5, components: 0 };
      }

      // Weight by individual confidence
      let totalConfidence = 0;
      let totalWeight = 0;

      for (const pattern of patterns) {
        const weight = pattern.confidence || 0.5;
        totalConfidence += weight * weight; // Square to emphasize high-confidence patterns
        totalWeight += weight;
      }

      const ensembleConfidence = totalWeight > 0
        ? Math.sqrt(totalConfidence / totalWeight) // Geometric mean-like calculation
        : 0.5;

      return {
        confidence: Math.min(1, ensembleConfidence * 1.05), // Slight boost for ensemble
        components: patterns.length,
        avgComponentConfidence: totalWeight / patterns.length,
        patterns: patterns.map(p => ({ id: p.id, confidence: p.confidence })),
      };

    } catch (error) {
      console.error('Ensemble confidence error:', error.message);
      return { confidence: 0.5, components: patterns.length, error: error.message };
    }
  }

  /**
   * Cross-validate pattern confidence
   * @param {Object} pattern - Pattern to validate
   * @param {Array} similarPatterns - Similar patterns for comparison
   * @returns {Object} Validation result
   */
  crossValidateConfidence(pattern, similarPatterns = []) {
    try {
      const result = {
        patternId: pattern.id,
        originalConfidence: pattern.confidence,
        validationScore: 0,
        isConsistent: true,
        comparisons: [],
      };

      if (similarPatterns.length === 0) {
        result.validationScore = pattern.confidence;
        return result;
      }

      // Compare against similar patterns
      for (const similar of similarPatterns) {
        const confidenceDiff = Math.abs(pattern.confidence - similar.confidence);
        const performanceDiff = Math.abs((pattern.profitability || 0) - (similar.profitability || 0));

        result.comparisons.push({
          similarId: similar.id,
          confidenceDiff,
          performanceDiff,
          isConsistent: confidenceDiff < 0.2,
        });

        if (confidenceDiff > 0.3) {
          result.isConsistent = false;
        }
      }

      // Calculate validation score
      const avgConfidenceDiff = result.comparisons.reduce((a, c) => a + c.confidenceDiff, 0) / result.comparisons.length;
      result.validationScore = pattern.confidence * (1 - avgConfidenceDiff);

      return result;

    } catch (error) {
      console.error('Cross-validation error:', error.message);
      return {
        patternId: pattern.id,
        originalConfidence: pattern.confidence,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // SCORING UTILITIES & STORAGE
  // ============================================================================

  /**
   * Store confidence score in history
   * @param {string} patternId - Pattern ID
   * @param {Object} scoreResult - Score result object
   */
  storeConfidenceScore(patternId, scoreResult) {
    if (!this.patternScores.has(patternId)) {
      this.patternScores.set(patternId, []);
    }

    this.patternScores.get(patternId).push(scoreResult);
    this.scoreHistory.push(scoreResult);

    // Maintain size limits
    if (this.patternScores.get(patternId).length > 1000) {
      this.patternScores.set(patternId, this.patternScores.get(patternId).slice(-1000));
    }

    if (this.scoreHistory.length > 10000) {
      this.scoreHistory = this.scoreHistory.slice(-10000);
    }

    this.stats.scoreUpdates++;
    this.stats.patternsScored++;
  }

  /**
   * Get confidence trend for pattern
   * @param {string} patternId - Pattern ID
   * @returns {Array} Confidence over time
   */
  getConfidenceTrend(patternId, limit = 100) {
    const history = this.patternScores.get(patternId) || [];
    return history.slice(-limit).map(h => ({
      confidence: h.confidence,
      timestamp: h.timestamp,
    }));
  }

  /**
   * Get score explanation
   * @param {string} patternId - Pattern ID
   * @returns {Object} Score breakdown explanation
   */
  getScoreExplanation(patternId) {
    const result = this.scoreExplanations.get(patternId);

    if (!result) {
      return {
        patternId,
        message: 'No scoring explanation available',
      };
    }

    // Build human-readable explanation
    const explanation = {
      patternId,
      finalConfidence: result.confidence.toFixed(3),
      strategy: result.strategy,
      breakdown: [],
    };

    for (const [dimension, data] of Object.entries(result.breakdown)) {
      explanation.breakdown.push({
        dimension,
        score: data.score.toFixed(3),
        weight: (data.weight * 100).toFixed(1) + '%',
        contribution: (data.contribution * 100).toFixed(1) + '%',
      });
    }

    return explanation;
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
   * Normal cumulative distribution function
   * @param {number} x - X value
   * @returns {number} CDF value
   */
  normalCDF(x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const t5 = t4 * t;

    const y = 1.0 - (((((a5 * t5 + a4 * t4) + a3 * t3) + a2 * t2) + a1 * t) * t * Math.exp(-x * x));

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Get statistics
   * @returns {Object} Current statistics
   */
  getStatistics() {
    const avgConfidence = this.scoreHistory.length > 0
      ? this.scoreHistory.reduce((a, s) => a + s.confidence, 0) / this.scoreHistory.length
      : 0;

    return {
      patternsScored: this.stats.patternsScored,
      scoreUpdates: this.stats.scoreUpdates,
      calibrationsRun: this.stats.calibrationsRun,
      avgConfidence: avgConfidence.toFixed(3),
      uniquePatterns: this.patternScores.size,
      totalScoreHistory: this.scoreHistory.length,
      lastUpdate: this.stats.lastUpdate,
    };
  }
}

module.exports = GNNPatternConfidenceScorer;
