/**
 * Prediction Engine
 * Generates trading signals using GNN model with confidence scoring
 *
 * Features:
 * - Multi-factor signal generation
 * - Confidence scoring and calibration
 * - Signal aggregation and fusion
 * - Risk-adjusted predictions
 * - Signal strength analysis
 */

const EventEmitter = require('events');

/**
 * Prediction Engine
 * Generates predictions using GNN model and market graph
 */
class PredictionEngine extends EventEmitter {
  constructor(config = {}) {
    super();

    this.logger = config.logger || console;
    this.gnnModel = config.gnnModel;
    this.graphBuilder = config.graphBuilder;
    this.fundamentalAnalyzer = config.fundamentalAnalyzer;
    this.technicalProcessor = config.technicalProcessor;

    this.predictions = [];
    this.signals = [];
    this.confidence = 0;

    // Signal weights
    this.weights = {
      technical: 0.30,
      fundamental: 0.25,
      gnn: 0.35,
      graph: 0.10
    };

    // Confidence calibration
    this.confidenceThresholds = {
      veryHigh: 0.85,
      high: 0.70,
      medium: 0.55,
      low: 0.40,
      veryLow: 0.25
    };
  }

  /**
   * Generate prediction for a stock
   * @param {string} symbol - Stock symbol
   * @param {Array} ohlcvData - OHLCV data
   * @param {Object} fundamentals - Fundamental metrics
   * @returns {Promise<Object>} Prediction with signals
   */
  async generatePrediction(symbol, ohlcvData, fundamentals) {
    try {
      // Extract features from different sources
      const technicalFeatures = await this.technicalProcessor.extractGNNFeatures(ohlcvData);
      const fundamentalFeatures = this.fundamentalAnalyzer.extractFeaturesForGNN(fundamentals);
      const graphNeighbors = this.graphBuilder.getNeighbors(symbol);

      // Get neighbor features for graph convolution
      const neighborFeatures = await this.extractNeighborFeaturesForGNN(graphNeighbors);

      // Combine features into 58-dimensional vector
      const nodeFeatures = this.combineFeatures(technicalFeatures, fundamentalFeatures);

      // Get GNN prediction
      const gnnPrediction = this.gnnModel.predict(nodeFeatures, neighborFeatures);

      // Get fundamental signal
      const fundamentalAnalysis = await this.fundamentalAnalyzer.analyzeFundamentals(symbol, fundamentals);
      const fundamentalSignal = this.getFundamentalSignal(fundamentalAnalysis);

      // Get technical signal
      const technicalAnalysis = await this.technicalProcessor.getTechnicalSummary(ohlcvData);
      const technicalSignal = this.getTechnicalSignal(technicalAnalysis);

      // Get graph signal (based on neighbor correlations)
      const graphSignal = this.getGraphSignal(symbol, gnnPrediction.direction);

      // Aggregate signals
      const aggregatedSignal = this.aggregateSignals(
        gnnPrediction.direction,
        technicalSignal,
        fundamentalSignal,
        graphSignal
      );

      // Calculate confidence
      const confidence = this.calculateConfidence(
        gnnPrediction.confidence,
        fundamentalAnalysis.signal.confidence,
        technicalSignal.strength,
        graphNeighbors.length,
        neighborFeatures.length
      );

      const prediction = {
        symbol,
        timestamp: new Date(),
        gnnPrediction: {
          direction: gnnPrediction.direction,
          probability: gnnPrediction.probability,
          confidence: gnnPrediction.confidence,
          signalStrength: gnnPrediction.signal_strength
        },
        signals: {
          technical: technicalSignal,
          fundamental: fundamentalSignal,
          graph: graphSignal,
          aggregated: aggregatedSignal
        },
        confidence: confidence,
        confidenceLevel: this.getConfidenceLevel(confidence),
        recommendation: this.generateRecommendation(aggregatedSignal, confidence),
        factors: {
          technicalWeight: this.weights.technical,
          fundamentalWeight: this.weights.fundamental,
          gnnWeight: this.weights.gnn,
          graphWeight: this.weights.graph
        },
        neighborCount: graphNeighbors.length,
        neighborCorrelations: graphNeighbors.map(n => ({
          symbol: n.symbol,
          correlation: n.correlation
        }))
      };

      this.predictions.push(prediction);
      this.logger.info(`📈 Prediction generated for ${symbol}: ${prediction.recommendation.type} (Confidence: ${confidence.toFixed(2)})`);
      this.emit('prediction:generated', prediction);

      return prediction;
    } catch (error) {
      this.logger.error(`Error generating prediction for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Extract neighbor features for graph convolution
   * @private
   */
  async extractNeighborFeaturesForGNN(neighbors) {
    const neighborFeatures = [];

    for (const neighbor of neighbors) {
      try {
        // Create simplified neighbor feature vector
        // In production, would fetch actual data for neighbor
        const features = new Array(58).fill(0.5);
        neighborFeatures.push({
          symbol: neighbor.symbol,
          features: features,
          weight: neighbor.weight
        });
      } catch (error) {
        this.logger.warn(`Could not extract features for neighbor ${neighbor.symbol}`);
      }
    }

    return neighborFeatures;
  }

  /**
   * Combine technical and fundamental features
   * @private
   */
  combineFeatures(technicalFeatures, fundamentalFeatures) {
    // Technical: 15 dimensions
    // Fundamental: 13 dimensions
    // Combined should be padded to 58
    const combined = [];

    // Add technical features
    for (let i = 0; i < Math.min(15, technicalFeatures.length); i++) {
      combined.push(technicalFeatures[i]);
    }

    // Add fundamental features
    for (let i = 0; i < Math.min(13, fundamentalFeatures.length); i++) {
      combined.push(fundamentalFeatures[i]);
    }

    // Pad to 58 dimensions
    while (combined.length < 58) {
      combined.push(0.5);
    }

    return combined.slice(0, 58);
  }

  /**
   * Get fundamental signal from analysis
   * @private
   */
  getFundamentalSignal(analysis) {
    const signal = analysis.signal;
    const score = analysis.healthScore;

    return {
      strength: signal.strength,
      type: signal.type,
      healthScore: score,
      confidence: signal.confidence,
      direction: signal.strength > 0 ? 'UP' : (signal.strength < 0 ? 'DOWN' : 'NEUTRAL')
    };
  }

  /**
   * Get technical signal
   * @private
   */
  getTechnicalSignal(technicalSummary) {
    // Parse technical summary to extract directional bias
    let directionBias = 0;
    let indicatorCount = 0;

    // Count bullish vs bearish indicators
    const bullishPatterns = ['📈', '↗', '✓'];
    const bearishPatterns = ['📉', '↘', '✗'];

    for (const pattern of bullishPatterns) {
      if (technicalSummary.includes(pattern)) {
        directionBias += 0.5;
        indicatorCount++;
      }
    }

    for (const pattern of bearishPatterns) {
      if (technicalSummary.includes(pattern)) {
        directionBias -= 0.5;
        indicatorCount++;
      }
    }

    const avgBias = indicatorCount > 0 ? directionBias / indicatorCount : 0;
    const strength = Math.abs(avgBias);

    return {
      strength: Number(strength.toFixed(3)),
      direction: avgBias > 0.2 ? 'UP' : (avgBias < -0.2 ? 'DOWN' : 'NEUTRAL'),
      bias: Number(avgBias.toFixed(3)),
      indicatorCount: indicatorCount
    };
  }

  /**
   * Get graph-based signal
   * @private
   */
  getGraphSignal(symbol, direction) {
    const neighbors = this.graphBuilder.getNeighbors(symbol);

    if (neighbors.length === 0) {
      return {
        strength: 0,
        direction: 'NEUTRAL',
        neighborConsensus: 0,
        correlationStrength: 0
      };
    }

    // Analyze neighbor correlations
    let correlationSum = 0;
    let positiveCount = 0;
    let correlationStrength = 0;

    for (const neighbor of neighbors) {
      const absCor = Math.abs(neighbor.correlation);
      correlationSum += neighbor.correlation;
      correlationStrength += absCor;

      if (neighbor.correlation > 0) {
        positiveCount++;
      }
    }

    const avgCorrelation = correlationSum / neighbors.length;
    const consensusStrength = Math.abs(positiveCount / neighbors.length - 0.5) * 2;
    const avgCorrelationStrength = correlationStrength / neighbors.length;

    return {
      strength: Number(avgCorrelationStrength.toFixed(3)),
      direction: avgCorrelation > 0.1 ? 'UP' : (avgCorrelation < -0.1 ? 'DOWN' : 'NEUTRAL'),
      neighborConsensus: Number(consensusStrength.toFixed(3)),
      correlationStrength: Number(avgCorrelationStrength.toFixed(3)),
      neighborCount: neighbors.length
    };
  }

  /**
   * Aggregate signals from multiple sources
   * @private
   */
  aggregateSignals(gnnDirection, technicalSignal, fundamentalSignal, graphSignal) {
    // Convert directions to numeric signals
    const gnnSignal = this.directionToSignal(gnnDirection);
    const techSignal = this.directionToSignal(technicalSignal.direction) * technicalSignal.strength;
    const fundSignal = this.directionToSignal(fundamentalSignal.direction) * Math.abs(fundamentalSignal.strength);
    const graphSig = this.directionToSignal(graphSignal.direction) * graphSignal.strength;

    // Weighted aggregation
    const aggregated =
      (gnnSignal * this.weights.gnn) +
      (techSignal * this.weights.technical) +
      (fundSignal * this.weights.fundamental) +
      (graphSig * this.weights.graph);

    // Normalize to -1 to 1
    const normalized = Math.max(-1, Math.min(1, aggregated / (this.weights.gnn + this.weights.technical + this.weights.fundamental + this.weights.graph)));

    return {
      signal: Number(normalized.toFixed(3)),
      direction: normalized > 0.1 ? 'UP' : (normalized < -0.1 ? 'DOWN' : 'NEUTRAL'),
      strength: Number(Math.abs(normalized).toFixed(3)),
      components: {
        gnn: Number(gnnSignal.toFixed(3)),
        technical: Number(techSignal.toFixed(3)),
        fundamental: Number(fundSignal.toFixed(3)),
        graph: Number(graphSig.toFixed(3))
      }
    };
  }

  /**
   * Convert direction string to numeric signal
   * @private
   */
  directionToSignal(direction) {
    switch (direction) {
      case 'UP':
      case 'STRONG_BUY':
      case 'BUY':
        return 1;
      case 'DOWN':
      case 'STRONG_SELL':
      case 'SELL':
        return -1;
      default:
        return 0;
    }
  }

  /**
   * Calculate confidence score
   * @private
   */
  calculateConfidence(gnnConfidence, fundamentalConfidence, technicalStrength, neighborCount, neighborFeatureCount) {
    // GNN confidence has highest weight
    let confidence = gnnConfidence * 0.40;

    // Fundamental confidence
    confidence += fundamentalConfidence * 0.25;

    // Technical strength
    confidence += Math.min(technicalStrength, 1.0) * 0.20;

    // Graph signal strength (more neighbors = more confident)
    const graphConfidence = Math.min(neighborCount / 10, 1.0);
    confidence += graphConfidence * 0.15;

    return Number(Math.max(0, Math.min(1, confidence)).toFixed(4));
  }

  /**
   * Get confidence level string
   * @private
   */
  getConfidenceLevel(confidence) {
    if (confidence >= this.confidenceThresholds.veryHigh) return 'VERY_HIGH';
    if (confidence >= this.confidenceThresholds.high) return 'HIGH';
    if (confidence >= this.confidenceThresholds.medium) return 'MEDIUM';
    if (confidence >= this.confidenceThresholds.low) return 'LOW';
    if (confidence >= this.confidenceThresholds.veryLow) return 'VERY_LOW';
    return 'INSUFFICIENT';
  }

  /**
   * Generate trading recommendation
   * @private
   */
  generateRecommendation(aggregatedSignal, confidence) {
    const signal = aggregatedSignal.signal;
    const strength = aggregatedSignal.strength;

    let type = 'NEUTRAL';
    let action = 'HOLD';
    let description = '';

    // Determine recommendation based on signal and confidence
    if (signal > 0.3 && confidence > this.confidenceThresholds.medium) {
      if (signal > 0.6 && confidence > this.confidenceThresholds.high) {
        type = 'STRONG_BUY';
        action = 'BUY_AGGRESSIVE';
        description = 'Strong bullish signal with high confidence';
      } else {
        type = 'BUY';
        action = 'BUY';
        description = 'Bullish signal detected';
      }
    } else if (signal < -0.3 && confidence > this.confidenceThresholds.medium) {
      if (signal < -0.6 && confidence > this.confidenceThresholds.high) {
        type = 'STRONG_SELL';
        action = 'SELL_AGGRESSIVE';
        description = 'Strong bearish signal with high confidence';
      } else {
        type = 'SELL';
        action = 'SELL';
        description = 'Bearish signal detected';
      }
    } else {
      type = 'NEUTRAL';
      action = 'HOLD';
      description = confidence < this.confidenceThresholds.veryLow ?
        'Insufficient signal confidence' :
        'Mixed signals, holding position';
    }

    return {
      type,
      action,
      description,
      signalStrength: strength,
      confidence,
      riskLevel: this.calculateRiskLevel(strength, confidence)
    };
  }

  /**
   * Calculate risk level
   * @private
   */
  calculateRiskLevel(strength, confidence) {
    // High strength + low confidence = high risk
    // Low strength + high confidence = low risk
    // High strength + high confidence = medium risk (but justified)
    // Low strength + low confidence = low risk (but insufficient)

    if (confidence < this.confidenceThresholds.low) {
      return 'VERY_HIGH';  // Insufficient data
    }

    if (strength > 0.6 && confidence > 0.8) {
      return 'MEDIUM';  // Clear signal
    }

    if (strength > 0.6 && confidence < 0.6) {
      return 'HIGH';  // Strong signal but not confident
    }

    if (strength < 0.3) {
      return 'LOW';  // Weak signal
    }

    return 'MEDIUM';
  }

  /**
   * Get batch predictions for multiple stocks
   * @param {Array} predictions - Array of symbol predictions
   * @returns {Object} Batch analysis
   */
  getBatchAnalysis(predictions) {
    const upSignals = predictions.filter(p => p.signals.aggregated.direction === 'UP').length;
    const downSignals = predictions.filter(p => p.signals.aggregated.direction === 'DOWN').length;
    const neutralSignals = predictions.filter(p => p.signals.aggregated.direction === 'NEUTRAL').length;

    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
    const avgGNNConfidence = predictions.reduce((sum, p) => sum + p.gnnPrediction.confidence, 0) / predictions.length;

    // Find consensus
    const consensus = upSignals > downSignals ? 'BULLISH' : (downSignals > upSignals ? 'BEARISH' : 'NEUTRAL');

    return {
      totalPredictions: predictions.length,
      upSignals,
      downSignals,
      neutralSignals,
      consensus,
      consensusStrength: Math.max(upSignals, downSignals) / predictions.length,
      avgConfidence: Number(avgConfidence.toFixed(4)),
      avgGNNConfidence: Number(avgGNNConfidence.toFixed(4)),
      highConfidencePredictions: predictions.filter(p => p.confidence > this.confidenceThresholds.high).length,
      lowConfidencePredictions: predictions.filter(p => p.confidence < this.confidenceThresholds.low).length
    };
  }

  /**
   * Get prediction summary
   * @returns {Object} Summary of recent predictions
   */
  getSummary() {
    if (this.predictions.length === 0) {
      return {
        totalPredictions: 0,
        recentPredictions: [],
        avgConfidence: 0,
        topRecommendations: []
      };
    }

    const recent = this.predictions.slice(-20);
    const topRecs = recent
      .filter(p => p.recommendation.type !== 'NEUTRAL')
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);

    return {
      totalPredictions: this.predictions.length,
      recentPredictions: recent.map(p => ({
        symbol: p.symbol,
        recommendation: p.recommendation.type,
        confidence: p.confidence,
        timestamp: p.timestamp
      })),
      avgConfidence: Number((recent.reduce((sum, p) => sum + p.confidence, 0) / recent.length).toFixed(4)),
      topRecommendations: topRecs.map(p => ({
        symbol: p.symbol,
        recommendation: p.recommendation.type,
        confidence: p.confidence,
        signalStrength: p.recommendation.signalStrength
      }))
    };
  }
}

// Export
module.exports = {
  PredictionEngine
};
