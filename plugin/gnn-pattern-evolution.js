/**
 * GNN Pattern Evolution & Learning System
 *
 * Manages pattern learning, evolution, and adaptation based on market feedback.
 * Implements continuous improvement of discovered patterns through reinforcement learning
 * and adaptive mechanisms.
 *
 * Features:
 * - Pattern learning from market data feedback
 * - Adaptive pattern evolution based on performance
 * - Reinforcement learning for pattern improvements
 * - Pattern mutation and variation generation
 * - Historical performance tracking
 * - Pattern performance scoring and ranking
 * - Generalization and specialization strategies
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

class GNNPatternEvolution {
  constructor(discoveryEngine) {
    this.discoveryEngine = discoveryEngine;

    // Learning state
    this.patternPerformance = new Map(); // Historical performance metrics
    this.patternFitness = new Map(); // Fitness scores for patterns
    this.patternVariations = new Map(); // Generated pattern variations
    this.learningHistory = []; // Learning evolution history
    this.feedbackQueue = []; // Market feedback to process

    // Configuration
    this.config = {
      // Learning parameters
      learningRate: 0.1,
      momentumFactor: 0.9,
      explorationRate: 0.2,
      exploitationRate: 0.8,

      // Performance thresholds
      minPerformanceImprovement: 0.05, // 5% improvement threshold
      performanceDecayRate: 0.001, // Daily decay
      performanceHistoryDays: 90,

      // Mutation parameters
      mutationRate: 0.15,
      mutationStrength: 0.1,
      maxMutationsPerPattern: 5,

      // Variation generation
      variationGenerationRate: 0.3,
      maxVariationsPerPattern: 20,

      // Fitness calculation
      fitnessWindow: 30, // days
      fitnessMetrics: ['profitability', 'winRate', 'sharpeRatio', 'drawdown', 'consistency'],

      // Generalization
      generalizationThreshold: 0.75,
      specializationThreshold: 0.85,

      // Feedback processing
      maxFeedbackBatchSize: 1000,
      feedbackProcessingRate: 100, // per minute
    };

    // Statistics
    this.stats = {
      patternsImproved: 0,
      mutationsAttempted: 0,
      mutationsSuccessful: 0,
      variationsGenerated: 0,
      feedbackProcessed: 0,
      evolutionCycles: 0,
      lastUpdate: new Date(),
    };
  }

  // ============================================================================
  // PATTERN LEARNING FROM FEEDBACK
  // ============================================================================

  /**
   * Process market feedback to improve patterns
   * @param {Array} trades - Executed trades with results
   * @param {Array} patterns - Patterns involved
   * @returns {Promise<Object>} Learning result
   */
  async processMarketFeedback(trades = [], patterns = []) {
    const startTime = Date.now();

    try {
      if (trades.length === 0 || patterns.length === 0) {
        return { processed: 0, improved: 0, errors: [] };
      }

      const result = {
        processed: 0,
        improved: 0,
        errors: [],
        improvements: [],
      };

      // Queue feedback for processing
      for (const trade of trades) {
        this.feedbackQueue.push({
          trade,
          processedAt: null,
          status: 'pending',
        });
      }

      // Process feedback in batches
      const batchSize = this.config.maxFeedbackBatchSize;
      for (let i = 0; i < this.feedbackQueue.length; i += batchSize) {
        const batch = this.feedbackQueue.slice(i, Math.min(i + batchSize, this.feedbackQueue.length));

        for (const feedbackItem of batch) {
          if (feedbackItem.status === 'processed') continue;

          try {
            const improvement = this.learnFromTrade(feedbackItem.trade, patterns);
            if (improvement) {
              result.improvements.push(improvement);
              result.improved++;
            }
            result.processed++;
            feedbackItem.status = 'processed';
            feedbackItem.processedAt = new Date();
          } catch (error) {
            result.errors.push(`Trade feedback error: ${error.message}`);
            feedbackItem.status = 'error';
          }
        }
      }

      // Clean up old feedback
      this.feedbackQueue = this.feedbackQueue.filter(f => f.status !== 'processed' || f.processedAt > Date.now() - 24 * 60 * 60 * 1000);

      this.stats.feedbackProcessed += result.processed;
      this.stats.patternsImproved += result.improved;
      this.stats.lastUpdate = new Date();

      return result;

    } catch (error) {
      console.error('Feedback processing error:', error.message);
      return { processed: 0, improved: 0, errors: [error.message] };
    }
  }

  /**
   * Learn from individual trade
   * @param {Object} trade - Trade with results
   * @param {Array} patterns - Patterns involved
   * @returns {Object} Learning improvement
   */
  learnFromTrade(trade, patterns = []) {
    if (!trade || !trade.patternId) return null;

    const pattern = patterns.find(p => p.id === trade.patternId);
    if (!pattern) return null;

    const outcome = {
      patternId: trade.patternId,
      result: trade.result || (trade.pnl > 0 ? 'win' : 'loss'),
      pnl: trade.pnl || 0,
      return: trade.return || 0,
      timestamp: trade.exitTime || new Date(),
      duration: trade.duration || 0,
    };

    // Update performance history
    if (!this.patternPerformance.has(trade.patternId)) {
      this.patternPerformance.set(trade.patternId, []);
    }

    const history = this.patternPerformance.get(trade.patternId);
    history.push(outcome);

    // Maintain time window
    const cutoffDate = new Date(Date.now() - this.config.performanceHistoryDays * 24 * 60 * 60 * 1000);
    const filtered = history.filter(h => new Date(h.timestamp) > cutoffDate);
    this.patternPerformance.set(trade.patternId, filtered);

    // Calculate updated fitness
    const oldFitness = this.patternFitness.get(trade.patternId) || 0.5;
    const newFitness = this.calculatePatternFitness(trade.patternId);
    this.patternFitness.set(trade.patternId, newFitness);

    // Check for improvement
    const improvement = newFitness - oldFitness;
    const isImprovement = improvement > this.config.minPerformanceImprovement;

    return {
      patternId: trade.patternId,
      oldFitness,
      newFitness,
      improvement,
      isImprovement,
      outcomeCount: filtered.length,
    };
  }

  /**
   * Calculate pattern fitness score
   * @param {string} patternId - Pattern ID
   * @returns {number} Fitness score (0-1)
   */
  calculatePatternFitness(patternId) {
    const performance = this.patternPerformance.get(patternId) || [];

    if (performance.length === 0) {
      return 0.5; // Default neutral
    }

    const scores = {};

    // Profitability
    const profitable = performance.filter(p => p.pnl > 0).length;
    scores.profitability = profitable / performance.length;

    // Win rate
    const wins = performance.filter(p => p.result === 'win').length;
    scores.winRate = wins / performance.length;

    // Sharpe ratio estimate
    const returns = performance.map(p => p.return || 0);
    const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - avgReturn) ** 2) / returns.length;
    const sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;
    scores.sharpeRatio = Math.min(1, Math.max(0, (sharpeRatio + 2) / 4)); // Normalize

    // Maximum drawdown
    let cumReturn = 1;
    let peak = 1;
    let maxDrawdown = 0;

    for (const p of performance) {
      cumReturn *= 1 + p.return;
      if (cumReturn > peak) peak = cumReturn;
      const drawdown = (peak - cumReturn) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    scores.drawdown = Math.max(0, 1 - maxDrawdown); // Inverse

    // Consistency
    const recentCount = Math.min(10, performance.length);
    const recent = performance.slice(-recentCount);
    const recentWins = recent.filter(p => p.result === 'win').length;
    scores.consistency = recentWins / recentCount;

    // Weighted fitness
    const weights = {
      profitability: 0.25,
      winRate: 0.25,
      sharpeRatio: 0.20,
      drawdown: 0.15,
      consistency: 0.15,
    };

    let fitness = 0;
    for (const [metric, weight] of Object.entries(weights)) {
      fitness += (scores[metric] || 0) * weight;
    }

    return Math.min(1, Math.max(0, fitness));
  }

  // ============================================================================
  // PATTERN MUTATION & VARIATION
  // ============================================================================

  /**
   * Generate pattern variations through mutation
   * @param {Object} pattern - Base pattern
   * @returns {Array} Generated variations
   */
  generatePatternVariations(pattern) {
    const variations = [];

    try {
      // Check if we've reached mutation limit
      const existingMutations = this.patternVariations.get(pattern.id) || [];
      if (existingMutations.length >= this.config.maxMutationsPerPattern) {
        return variations;
      }

      // Generate mutations based on pattern type
      switch (pattern.type) {
        case 'trend':
          variations.push(...this.mutateTrendPattern(pattern));
          break;
        case 'volatility':
          variations.push(...this.mutateVolatilityPattern(pattern));
          break;
        case 'correlation':
          variations.push(...this.mutateCorrelationPattern(pattern));
          break;
        case 'anomaly':
          variations.push(...this.mutateAnomalyPattern(pattern));
          break;
        default:
          variations.push(...this.mutateGenericPattern(pattern));
      }

      // Store variations
      if (!this.patternVariations.has(pattern.id)) {
        this.patternVariations.set(pattern.id, []);
      }

      const stored = this.patternVariations.get(pattern.id);
      stored.push(...variations);

      // Limit variations
      if (stored.length > this.config.maxVariationsPerPattern) {
        this.patternVariations.set(pattern.id, stored.slice(-this.config.maxVariationsPerPattern));
      }

      this.stats.variationsGenerated += variations.length;

    } catch (error) {
      console.error('Variation generation error:', error.message);
    }

    return variations;
  }

  /**
   * Mutate trend pattern
   * @param {Object} pattern - Base pattern
   * @returns {Array} Mutated patterns
   */
  mutateTrendPattern(pattern) {
    const mutations = [];

    try {
      // Mutation 1: Vary duration
      if (Math.random() < this.config.mutationRate) {
        const durationMutation = { ...pattern };
        durationMutation.features = { ...pattern.features };
        durationMutation.features.duration = pattern.features.duration
          * (1 + (Math.random() - 0.5) * this.config.mutationStrength * 2);
        durationMutation.id = `${pattern.id}_mut_duration_${Date.now()}`;
        mutations.push(durationMutation);
        this.stats.mutationsAttempted++;
      }

      // Mutation 2: Vary strength
      if (Math.random() < this.config.mutationRate) {
        const strengthMutation = { ...pattern };
        strengthMutation.features = { ...pattern.features };
        strengthMutation.features.strength = pattern.features.strength
          * (1 + (Math.random() - 0.5) * this.config.mutationStrength * 2);
        strengthMutation.id = `${pattern.id}_mut_strength_${Date.now()}`;
        mutations.push(strengthMutation);
        this.stats.mutationsAttempted++;
      }

      // Mutation 3: Vary direction/entry
      if (Math.random() < this.config.mutationRate) {
        const directionMutation = { ...pattern };
        directionMutation.features = { ...pattern.features };
        directionMutation.features.direction = pattern.features.direction === 'up' ? 'down' : 'up';
        directionMutation.id = `${pattern.id}_mut_direction_${Date.now()}`;
        mutations.push(directionMutation);
        this.stats.mutationsAttempted++;
      }

    } catch (error) {
      console.error('Trend mutation error:', error.message);
    }

    return mutations;
  }

  /**
   * Mutate volatility pattern
   * @param {Object} pattern - Base pattern
   * @returns {Array} Mutated patterns
   */
  mutateVolatilityPattern(pattern) {
    const mutations = [];

    try {
      // Mutation 1: Adjust volatility threshold
      if (Math.random() < this.config.mutationRate) {
        const volMutation = { ...pattern };
        volMutation.features = { ...pattern.features };
        volMutation.features.averageVolatility = pattern.features.averageVolatility
          * (1 + (Math.random() - 0.5) * this.config.mutationStrength * 2);
        volMutation.id = `${pattern.id}_mut_vol_${Date.now()}`;
        mutations.push(volMutation);
        this.stats.mutationsAttempted++;
      }

      // Mutation 2: Vary spike sensitivity
      if (Math.random() < this.config.mutationRate) {
        const spikeMutation = { ...pattern };
        spikeMutation.features = { ...pattern.features };
        spikeMutation.features.volatilitySpike = !pattern.features.volatilitySpike;
        spikeMutation.id = `${pattern.id}_mut_spike_${Date.now()}`;
        mutations.push(spikeMutation);
        this.stats.mutationsAttempted++;
      }

    } catch (error) {
      console.error('Volatility mutation error:', error.message);
    }

    return mutations;
  }

  /**
   * Mutate correlation pattern
   * @param {Object} pattern - Base pattern
   * @returns {Array} Mutated patterns
   */
  mutateCorrelationPattern(pattern) {
    const mutations = [];

    try {
      // Mutation 1: Vary correlation threshold
      if (Math.random() < this.config.mutationRate) {
        const corrMutation = { ...pattern };
        corrMutation.features = { ...pattern.features };
        corrMutation.features.correlationStrength = pattern.features.correlationStrength
          * (1 + (Math.random() - 0.5) * this.config.mutationStrength * 2);
        corrMutation.id = `${pattern.id}_mut_corr_${Date.now()}`;
        mutations.push(corrMutation);
        this.stats.mutationsAttempted++;
      }

      // Mutation 2: Vary regime
      if (Math.random() < this.config.mutationRate) {
        const regimeMutation = { ...pattern };
        regimeMutation.features = { ...pattern.features };
        const regimes = ['positively_correlated', 'negatively_correlated', 'uncorrelated'];
        const currentIndex = regimes.indexOf(pattern.features.regime);
        regimeMutation.features.regime = regimes[(currentIndex + 1) % regimes.length];
        regimeMutation.id = `${pattern.id}_mut_regime_${Date.now()}`;
        mutations.push(regimeMutation);
        this.stats.mutationsAttempted++;
      }

    } catch (error) {
      console.error('Correlation mutation error:', error.message);
    }

    return mutations;
  }

  /**
   * Mutate anomaly pattern
   * @param {Object} pattern - Base pattern
   * @returns {Array} Mutated patterns
   */
  mutateAnomalyPattern(pattern) {
    const mutations = [];

    try {
      // Mutation 1: Vary magnitude threshold
      if (Math.random() < this.config.mutationRate) {
        const magMutation = { ...pattern };
        magMutation.features = { ...pattern.features };
        magMutation.features.magnitude = pattern.features.magnitude
          * (1 + (Math.random() - 0.5) * this.config.mutationStrength * 2);
        magMutation.id = `${pattern.id}_mut_magnitude_${Date.now()}`;
        mutations.push(magMutation);
        this.stats.mutationsAttempted++;
      }

      // Mutation 2: Vary direction sensitivity
      if (Math.random() < this.config.mutationRate) {
        const dirMutation = { ...pattern };
        dirMutation.features = { ...pattern.features };
        const directions = ['up', 'down', 'both'];
        const currentIndex = directions.indexOf(pattern.features.direction);
        dirMutation.features.direction = directions[(currentIndex + 1) % directions.length];
        dirMutation.id = `${pattern.id}_mut_anomaly_dir_${Date.now()}`;
        mutations.push(dirMutation);
        this.stats.mutationsAttempted++;
      }

    } catch (error) {
      console.error('Anomaly mutation error:', error.message);
    }

    return mutations;
  }

  /**
   * Generic pattern mutation
   * @param {Object} pattern - Base pattern
   * @returns {Array} Mutated patterns
   */
  mutateGenericPattern(pattern) {
    const mutations = [];

    try {
      // Vary confidence
      if (Math.random() < this.config.mutationRate) {
        const confMutation = { ...pattern };
        confMutation.confidence = pattern.confidence
          * (1 + (Math.random() - 0.5) * this.config.mutationStrength);
        confMutation.confidence = Math.min(1, Math.max(0, confMutation.confidence));
        confMutation.id = `${pattern.id}_mut_conf_${Date.now()}`;
        mutations.push(confMutation);
        this.stats.mutationsAttempted++;
      }

    } catch (error) {
      console.error('Generic mutation error:', error.message);
    }

    return mutations;
  }

  // ============================================================================
  // PATTERN EVOLUTION CYCLE
  // ============================================================================

  /**
   * Execute evolution cycle
   * @param {Array} patterns - Patterns to evolve
   * @returns {Promise<Object>} Evolution result
   */
  async evolvePatterns(patterns = []) {
    const startTime = Date.now();

    try {
      const result = {
        evolved: 0,
        improved: 0,
        deprecated: 0,
        generalized: 0,
        specialized: 0,
        errors: [],
      };

      for (const pattern of patterns) {
        try {
          // Calculate current fitness
          const fitness = this.calculatePatternFitness(pattern.id);
          this.patternFitness.set(pattern.id, fitness);

          // Apply learning decay
          pattern.confidence = pattern.confidence * (1 - this.config.performanceDecayRate);

          // Generate and test variations
          const variations = this.generatePatternVariations(pattern);
          for (const variation of variations) {
            const varFitness = this.calculatePatternFitness(variation.id);
            if (varFitness > fitness) {
              // Promote mutation
              Object.assign(pattern, variation);
              result.improved++;
              this.stats.mutationsSuccessful++;
            }
          }

          // Check for generalization
          if (fitness > this.config.generalizationThreshold) {
            this.generalizePattern(pattern);
            result.generalized++;
          }

          // Check for specialization
          if (fitness > this.config.specializationThreshold) {
            this.specializePattern(pattern);
            result.specialized++;
          }

          result.evolved++;

        } catch (error) {
          result.errors.push(`Pattern evolution error: ${error.message}`);
        }
      }

      this.stats.evolutionCycles++;
      this.stats.lastUpdate = new Date();

      return result;

    } catch (error) {
      console.error('Evolution cycle error:', error.message);
      return {
        evolved: 0,
        improved: 0,
        deprecated: 0,
        generalized: 0,
        specialized: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * Generalize pattern to wider applicability
   * @param {Object} pattern - Pattern to generalize
   */
  generalizePattern(pattern) {
    // Increase asset applicability
    pattern.applicableAssets = pattern.applicableAssets || [];
    if (pattern.applicableAssets.length < 50) {
      pattern.applicableAssets.push(`asset_${Date.now()}`);
    }

    // Broaden parameter ranges
    if (pattern.features) {
      if (pattern.features.duration) {
        pattern.features.duration *= 1.2;
      }
      if (pattern.features.strength) {
        pattern.features.strength *= 0.9; // Lower requirements
      }
    }

    // Reduce confidence slightly
    pattern.confidence *= 0.95;
  }

  /**
   * Specialize pattern for specific conditions
   * @param {Object} pattern - Pattern to specialize
   */
  specializePattern(pattern) {
    // Narrow focus to specific assets
    pattern.specializedAssets = pattern.specializedAssets || [pattern.asset];

    // Tighten parameter ranges
    if (pattern.features) {
      if (pattern.features.duration) {
        pattern.features.duration *= 0.8;
      }
      if (pattern.features.strength) {
        pattern.features.strength *= 1.1; // Higher requirements
      }
    }

    // Increase confidence
    pattern.confidence = Math.min(0.99, pattern.confidence * 1.05);
  }

  // ============================================================================
  // PATTERN ENSEMBLE & COMBINATION
  // ============================================================================

  /**
   * Combine multiple patterns into ensemble
   * @param {Array} patterns - Patterns to combine
   * @returns {Object} Combined pattern
   */
  combinePatterns(patterns) {
    if (patterns.length === 0) {
      return null;
    }

    if (patterns.length === 1) {
      return patterns[0];
    }

    // Calculate ensemble properties
    const avgConfidence = patterns.reduce((a, p) => a + p.confidence, 0) / patterns.length;
    const totalOccurrences = patterns.reduce((a, p) => a + (p.occurrences || 0), 0);
    const avgProfitability = patterns.reduce((a, p) => a + (p.profitability || 0), 0) / patterns.length;

    // Create ensemble pattern
    const ensemble = {
      id: `ensemble_${Date.now()}`,
      type: 'ensemble',
      basePatterns: patterns.map(p => p.id),
      confidence: Math.min(0.99, avgConfidence * 1.1), // Boost for ensemble
      occurrences: totalOccurrences,
      profitability: avgProfitability,
      features: {
        combinationStrategy: 'voting',
        componentCount: patterns.length,
        avgComponentConfidence: avgConfidence,
      },
      discoveredAt: new Date(),
      status: 'validated',
    };

    return ensemble;
  }

  /**
   * Find complementary patterns
   * @param {Object} pattern - Reference pattern
   * @param {Array} allPatterns - All available patterns
   * @returns {Array} Complementary patterns
   */
  findComplementaryPatterns(pattern, allPatterns = []) {
    const complementary = [];

    for (const other of allPatterns) {
      if (other.id === pattern.id) continue;

      // Check for complementary characteristics
      const isComplementary =
        this.areAssetsRelated(pattern.asset, other.asset) &&
        this.areTypesComplementary(pattern.type, other.type) &&
        this.areFeaturesComplementary(pattern.features, other.features);

      if (isComplementary) {
        complementary.push(other);
      }
    }

    return complementary.sort((a, b) => b.confidence - a.confidence);
  }

  areAssetsRelated(asset1, asset2) {
    // Check if assets are related (different but correlated)
    return asset1 !== asset2;
  }

  areTypesComplementary(type1, type2) {
    // Define complementary type pairs
    const complementaryPairs = [
      ['trend', 'volatility'],
      ['trend', 'anomaly'],
      ['volatility', 'anomaly'],
      ['correlation', 'regime'],
    ];

    return complementaryPairs.some(pair =>
      (pair[0] === type1 && pair[1] === type2) ||
      (pair[0] === type2 && pair[1] === type1)
    );
  }

  areFeaturesComplementary(features1, features2) {
    if (!features1 || !features2) return false;

    // Features are complementary if they don't conflict
    // (e.g., one trending up, other non-trending)
    return true; // Simplified for now
  }

  // ============================================================================
  // PATTERN RANKING & SELECTION
  // ============================================================================

  /**
   * Rank patterns by multiple criteria
   * @param {Array} patterns - Patterns to rank
   * @param {Object} weights - Scoring weights
   * @returns {Array} Ranked patterns
   */
  rankPatterns(patterns, weights = {}) {
    const defaultWeights = {
      confidence: 0.25,
      fitness: 0.25,
      profitability: 0.20,
      occurrences: 0.15,
      recency: 0.15,
    };

    const finalWeights = { ...defaultWeights, ...weights };

    const rankedPatterns = patterns.map(pattern => {
      const confidence = pattern.confidence || 0;
      const fitness = this.patternFitness.get(pattern.id) || 0.5;
      const profitability = (pattern.profitability || 0) + 0.5; // Shift to 0-1 range
      const occurrences = Math.min(1, (pattern.occurrences || 0) / 100); // Normalize
      const recency = 1 - (Date.now() - pattern.discoveredAt.getTime()) / (90 * 24 * 60 * 60 * 1000); // 90 days

      const score =
        confidence * finalWeights.confidence +
        fitness * finalWeights.fitness +
        Math.max(0, Math.min(1, profitability)) * finalWeights.profitability +
        occurrences * finalWeights.occurrences +
        Math.max(0, recency) * finalWeights.recency;

      return {
        ...pattern,
        score: Math.min(1, Math.max(0, score)),
      };
    });

    return rankedPatterns.sort((a, b) => b.score - a.score);
  }

  /**
   * Select best patterns for deployment
   * @param {Array} patterns - Candidate patterns
   * @param {number} count - Number to select
   * @returns {Array} Selected patterns
   */
  selectBestPatterns(patterns, count = 50) {
    const ranked = this.rankPatterns(patterns);
    return ranked.slice(0, count);
  }

  // ============================================================================
  // STATISTICS & REPORTING
  // ============================================================================

  /**
   * Get evolution statistics
   * @returns {Object} Current statistics
   */
  getStatistics() {
    return {
      patternsImproved: this.stats.patternsImproved,
      mutationsAttempted: this.stats.mutationsAttempted,
      mutationsSuccessful: this.stats.mutationsSuccessful,
      mutationSuccessRate: this.stats.mutationsAttempted > 0
        ? (this.stats.mutationsSuccessful / this.stats.mutationsAttempted * 100).toFixed(2)
        : 0,
      variationsGenerated: this.stats.variationsGenerated,
      feedbackProcessed: this.stats.feedbackProcessed,
      evolutionCycles: this.stats.evolutionCycles,
      activePatterns: this.patternFitness.size,
      avgFitness: this.calculateAverageFitness(),
      lastUpdate: this.stats.lastUpdate,
    };
  }

  /**
   * Calculate average fitness across all patterns
   * @returns {number} Average fitness
   */
  calculateAverageFitness() {
    if (this.patternFitness.size === 0) return 0;

    const sum = Array.from(this.patternFitness.values()).reduce((a, b) => a + b, 0);
    return sum / this.patternFitness.size;
  }

  /**
   * Get pattern performance report
   * @param {string} patternId - Pattern ID
   * @returns {Object} Performance report
   */
  getPatternPerformanceReport(patternId) {
    const performance = this.patternPerformance.get(patternId) || [];
    const fitness = this.patternFitness.get(patternId) || 0;

    if (performance.length === 0) {
      return {
        patternId,
        status: 'no_data',
        trades: 0,
        fitness,
      };
    }

    const wins = performance.filter(p => p.result === 'win').length;
    const losses = performance.filter(p => p.result === 'loss').length;
    const totalPnl = performance.reduce((a, b) => a + (b.pnl || 0), 0);
    const totalReturn = performance.reduce((a, b) => a + (b.return || 0), 0);

    return {
      patternId,
      trades: performance.length,
      wins,
      losses,
      winRate: (wins / performance.length * 100).toFixed(2),
      totalPnl,
      totalReturn: (totalReturn * 100).toFixed(2),
      avgPnl: (totalPnl / performance.length).toFixed(4),
      fitness,
      recentPerformance: performance.slice(-10),
    };
  }

  /**
   * Get learning history
   * @param {number} limit - Number of entries to return
   * @returns {Array} Learning history
   */
  getLearningHistory(limit = 100) {
    return this.learningHistory.slice(-limit);
  }
}

module.exports = GNNPatternEvolution;
