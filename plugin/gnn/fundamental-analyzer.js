/**
 * Fundamental Analyzer
 * Analyzes company fundamental metrics for GNN input
 *
 * Features:
 * - Fundamental metric normalization
 * - Health score calculation
 * - Trend analysis
 * - Signal generation
 */

const EventEmitter = require('events');

/**
 * Fundamental Metrics Type
 */
const FundamentalMetrics = {
  PE_RATIO: 'pe_ratio',
  PB_RATIO: 'pb_ratio',
  DEBT_TO_EQUITY: 'debt_to_equity',
  CURRENT_RATIO: 'current_ratio',
  ROE: 'roe',
  ROA: 'roa',
  DIVIDEND_YIELD: 'dividend_yield',
  BETA: 'beta',
  MARKET_CAP: 'market_cap',
  FREE_CASH_FLOW: 'free_cash_flow',
  GROSS_MARGIN: 'gross_margin',
  OPERATING_MARGIN: 'operating_margin'
};

/**
 * Fundamental Analyzer
 */
class FundamentalAnalyzer extends EventEmitter {
  constructor(config = {}) {
    super();

    this.logger = config.logger || console;
    this.database = config.database;

    // Normalization ranges (industry averages)
    this.normalizationRanges = {
      [FundamentalMetrics.PE_RATIO]: { min: 5, max: 30, healthy: 15 },
      [FundamentalMetrics.PB_RATIO]: { min: 0.5, max: 5, healthy: 1.5 },
      [FundamentalMetrics.DEBT_TO_EQUITY]: { min: 0, max: 3, healthy: 1.0 },
      [FundamentalMetrics.CURRENT_RATIO]: { min: 0.5, max: 3, healthy: 1.5 },
      [FundamentalMetrics.ROE]: { min: -20, max: 50, healthy: 15 },
      [FundamentalMetrics.ROA]: { min: -10, max: 30, healthy: 8 },
      [FundamentalMetrics.DIVIDEND_YIELD]: { min: 0, max: 10, healthy: 3 },
      [FundamentalMetrics.BETA]: { min: 0.5, max: 2.5, healthy: 1.0 },
      [FundamentalMetrics.GROSS_MARGIN]: { min: 0, max: 80, healthy: 40 },
      [FundamentalMetrics.OPERATING_MARGIN]: { min: -20, max: 40, healthy: 15 }
    };
  }

  /**
   * Analyze fundamentals for a stock
   * @param {string} symbol - Stock symbol
   * @param {Object} metrics - Fundamental metrics
   * @returns {Promise<Object>} Analyzed fundamentals
   */
  async analyzeFundamentals(symbol, metrics) {
    try {
      // Normalize metrics
      const normalized = this.normalizeMetrics(metrics);

      // Calculate health score
      const healthScore = this.calculateHealthScore(normalized);

      // Identify trends
      const trends = await this.analyzeTrends(symbol);

      // Generate signals
      const signal = this.generateSignal(normalized, healthScore, trends);

      const analysis = {
        symbol,
        metrics: metrics,
        normalized: normalized,
        healthScore: healthScore,
        trends: trends,
        signal: signal,
        timestamp: new Date()
      };

      this.logger.info(`📊 Fundamentals analyzed for ${symbol}: Score ${healthScore.toFixed(1)}`);
      this.emit('analysis:complete', analysis);

      return analysis;
    } catch (error) {
      this.logger.error(`Error analyzing fundamentals for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Normalize fundamental metrics to 0-1 scale
   * @param {Object} metrics - Raw metrics
   * @returns {Object} Normalized metrics
   */
  normalizeMetrics(metrics) {
    const normalized = {};

    for (const [key, value] of Object.entries(metrics)) {
      const range = this.normalizationRanges[key];

      if (!range || value === null || value === undefined) {
        normalized[key] = 0.5;  // Default to neutral
        continue;
      }

      // Clamp value to min-max range
      const clamped = Math.max(range.min, Math.min(range.max, value));

      // Normalize to 0-1
      const normalizedValue = (clamped - range.min) / (range.max - range.min);

      normalized[key] = Number(normalizedValue.toFixed(4));
    }

    return normalized;
  }

  /**
   * Calculate fundamental health score (0-100)
   * @param {Object} normalized - Normalized metrics
   * @returns {number} Health score
   */
  calculateHealthScore(normalized) {
    const weights = {
      [FundamentalMetrics.PE_RATIO]: 15,           // Valuation
      [FundamentalMetrics.ROE]: 20,                // Profitability
      [FundamentalMetrics.DEBT_TO_EQUITY]: 15,     // Leverage
      [FundamentalMetrics.CURRENT_RATIO]: 10,      // Liquidity
      [FundamentalMetrics.GROSS_MARGIN]: 15,       // Efficiency
      [FundamentalMetrics.OPERATING_MARGIN]: 15,   // Operational health
      [FundamentalMetrics.DIVIDEND_YIELD]: 5,      // Returns to shareholders
      [FundamentalMetrics.BETA]: 5                 // Stability
    };

    let score = 0;
    let totalWeight = 0;

    for (const [metric, weight] of Object.entries(weights)) {
      if (normalized[metric] !== undefined) {
        // Invert some metrics where lower is better
        let value = normalized[metric];

        if ([FundamentalMetrics.DEBT_TO_EQUITY, FundamentalMetrics.BETA, FundamentalMetrics.PE_RATIO].includes(metric)) {
          value = 1 - value;  // Invert: lower is better
        }

        score += value * weight;
        totalWeight += weight;
      }
    }

    return (score / totalWeight) * 100;
  }

  /**
   * Analyze fundamental trends
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Trend analysis
   */
  async analyzeTrends(symbol) {
    try {
      // Get historical fundamental data (if available)
      const query = `
        SELECT metric_name, metric_value, quarter_date
        FROM fundamental_metrics
        WHERE symbol = ?
        ORDER BY quarter_date DESC
        LIMIT 12
      `;

      let rows = [];
      if (this.database) {
        [rows] = await this.database.query(query, [symbol]);
      }

      if (!rows || rows.length < 2) {
        return {
          trend: 'NEUTRAL',
          direction: 'FLAT',
          momentum: 0
        };
      }

      // Calculate trend direction
      const recent = rows[0].metric_value;
      const historical = rows[rows.length - 1].metric_value;
      const change = (recent - historical) / historical;

      const trend = {
        trend: change > 0.1 ? 'IMPROVING' : (change < -0.1 ? 'DECLINING' : 'STABLE'),
        direction: change > 0 ? 'UP' : (change < 0 ? 'DOWN' : 'FLAT'),
        momentum: Number((change * 100).toFixed(2)),
        quarters: rows.length
      };

      return trend;
    } catch (error) {
      this.logger.warn(`Could not analyze trends for ${symbol}:`, error);
      return {
        trend: 'NEUTRAL',
        direction: 'FLAT',
        momentum: 0
      };
    }
  }

  /**
   * Generate fundamental signal
   * @param {Object} normalized - Normalized metrics
   * @param {number} healthScore - Health score
   * @param {Object} trends - Trend analysis
   * @returns {Object} Signal
   */
  generateSignal(normalized, healthScore, trends) {
    let signalStrength = 0;

    // Health score influence (-1 to +1)
    if (healthScore > 70) {
      signalStrength += 0.5;
    } else if (healthScore < 40) {
      signalStrength -= 0.5;
    } else {
      signalStrength += (healthScore - 50) / 100;
    }

    // Trend influence
    if (trends.direction === 'UP') {
      signalStrength += 0.3;
    } else if (trends.direction === 'DOWN') {
      signalStrength -= 0.3;
    }

    // Clamp to -1 to +1
    signalStrength = Math.max(-1, Math.min(1, signalStrength));

    // Determine signal type
    let signalType = 'NEUTRAL';
    if (signalStrength > 0.5) {
      signalType = 'STRONG_BUY';
    } else if (signalStrength > 0.2) {
      signalType = 'BUY';
    } else if (signalStrength < -0.5) {
      signalType = 'STRONG_SELL';
    } else if (signalStrength < -0.2) {
      signalType = 'SELL';
    }

    return {
      strength: Number(signalStrength.toFixed(3)),
      type: signalType,
      confidence: Math.abs(signalStrength),
      healthFactor: healthScore / 100,
      trendFactor: trends.momentum / 100
    };
  }

  /**
   * Extract features for GNN (58-dimensional vector)
   * @param {Object} metrics - Fundamental metrics
   * @returns {number[]} Feature vector
   */
  extractFeaturesForGNN(metrics) {
    const normalized = this.normalizeMetrics(metrics);
    const features = [];

    // Add normalized fundamentals
    for (const metric of Object.values(FundamentalMetrics)) {
      features.push(normalized[metric] || 0.5);
    }

    // Add derived features
    features.push(this.calculateHealthScore(normalized) / 100);  // Health score (0-1)

    // Pad to 58 dimensions if needed
    while (features.length < 58) {
      features.push(0.5);  // Neutral padding
    }

    return features.slice(0, 58);
  }

  /**
   * Compare two sets of fundamentals
   * @param {Object} metrics1 - First set
   * @param {Object} metrics2 - Second set
   * @returns {number} Similarity score (0-1)
   */
  compareFundamentals(metrics1, metrics2) {
    const norm1 = this.normalizeMetrics(metrics1);
    const norm2 = this.normalizeMetrics(metrics2);

    let similarity = 0;
    let count = 0;

    for (const key of Object.keys(norm1)) {
      if (norm2[key] !== undefined) {
        const diff = Math.abs(norm1[key] - norm2[key]);
        similarity += (1 - diff);
        count++;
      }
    }

    return count > 0 ? similarity / count : 0;
  }

  /**
   * Identify quality tier
   * @param {number} healthScore - Health score (0-100)
   * @returns {string} Quality tier
   */
  identifyQualityTier(healthScore) {
    if (healthScore >= 75) return 'EXCELLENT';
    if (healthScore >= 60) return 'GOOD';
    if (healthScore >= 45) return 'AVERAGE';
    if (healthScore >= 30) return 'POOR';
    return 'VERY_POOR';
  }

  /**
   * Get fundamental scoring explanation
   * @param {Object} normalized - Normalized metrics
   * @param {number} healthScore - Health score
   * @returns {string} Explanation
   */
  getScoreExplanation(normalized, healthScore) {
    const tier = this.identifyQualityTier(healthScore);
    const peRatio = normalized[FundamentalMetrics.PE_RATIO];
    const roe = normalized[FundamentalMetrics.ROE];
    const debt = normalized[FundamentalMetrics.DEBT_TO_EQUITY];

    let explanation = `Fundamental Quality: ${tier} (Score: ${healthScore.toFixed(1)}/100)\n`;

    if (peRatio < 0.4) {
      explanation += '✓ Undervalued (Low P/E)\n';
    } else if (peRatio > 0.7) {
      explanation += '⚠ Overvalued (High P/E)\n';
    }

    if (roe > 0.6) {
      explanation += '✓ Highly Profitable\n';
    } else if (roe < 0.3) {
      explanation += '⚠ Low Profitability\n';
    }

    if (debt < 0.3) {
      explanation += '✓ Strong Balance Sheet\n';
    } else if (debt > 0.7) {
      explanation += '⚠ High Leverage\n';
    }

    return explanation;
  }
}

// Export
module.exports = {
  FundamentalAnalyzer,
  FundamentalMetrics
};
