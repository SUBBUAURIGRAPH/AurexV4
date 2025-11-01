/**
 * GNN Accuracy Calculator
 * Measures prediction accuracy and performance metrics
 *
 * Metrics:
 * - Directional accuracy
 * - Hit rate
 * - Precision/Recall
 * - ROC-AUC
 * - Profit metrics
 */

const EventEmitter = require('events');

/**
 * GNN Accuracy Calculator
 */
class GNNAccuracyCalculator extends EventEmitter {
  constructor(config = {}) {
    super();

    this.logger = config.logger || console;
    this.predictions = [];
    this.outcomes = [];
  }

  /**
   * Validate predictions against actual outcomes
   * @param {Array} predictions - Array of {direction, probability, confidence}
   * @param {Array} outcomes - Array of {direction, actualPrice, expectedPrice}
   * @returns {Object} Comprehensive accuracy metrics
   */
  validatePredictions(predictions, outcomes) {
    try {
      if (predictions.length !== outcomes.length) {
        throw new Error('Predictions and outcomes must have equal length');
      }

      this.predictions = predictions;
      this.outcomes = outcomes;

      // Calculate confusion matrix
      const confusionMatrix = this.buildConfusionMatrix(predictions, outcomes);

      // Calculate basic metrics
      const basic = this.calculateBasicMetrics(confusionMatrix);

      // Calculate directional accuracy
      const directional = this.calculateDirectionalAccuracy(predictions, outcomes);

      // Calculate price accuracy
      const price = this.calculatePriceAccuracy(predictions, outcomes);

      // Calculate ROC-AUC
      const rocAuc = this.calculateROCAUC(predictions, outcomes);

      // Calculate F1 and MCC
      const advanced = this.calculateAdvancedMetrics(confusionMatrix);

      const result = {
        confusionMatrix,
        basicMetrics: basic,
        directionalAccuracy: directional,
        priceAccuracy: price,
        rocAuc: rocAuc,
        advancedMetrics: advanced,
        totalPredictions: predictions.length,
        validPredictions: predictions.length,
        timestamp: new Date()
      };

      this.logger.info(`✅ Predictions validated - Hit Rate: ${directional.hitRate.toFixed(2)}%`);
      this.emit('validation:complete', result);

      return result;
    } catch (error) {
      this.logger.error('Error validating predictions:', error);
      throw error;
    }
  }

  /**
   * Build confusion matrix
   * @private
   */
  buildConfusionMatrix(predictions, outcomes) {
    let tp = 0;  // True Positives (predicted UP, actually UP)
    let tn = 0;  // True Negatives (predicted DOWN, actually DOWN)
    let fp = 0;  // False Positives (predicted UP, actually DOWN)
    let fn = 0;  // False Negatives (predicted DOWN, actually UP)

    for (let i = 0; i < predictions.length; i++) {
      const pred = predictions[i].direction === 'UP';
      const actual = outcomes[i].direction === 'UP';

      if (pred && actual) tp++;
      else if (!pred && !actual) tn++;
      else if (pred && !actual) fp++;
      else if (!pred && actual) fn++;
    }

    return { tp, tn, fp, fn };
  }

  /**
   * Calculate basic metrics from confusion matrix
   * @private
   */
  calculateBasicMetrics(cm) {
    const total = cm.tp + cm.tn + cm.fp + cm.fn;
    const accuracy = (cm.tp + cm.tn) / total;

    let precision = cm.tp / (cm.tp + cm.fp) || 0;
    let recall = cm.tp / (cm.tp + cm.fn) || 0;
    let specificity = cm.tn / (cm.tn + cm.fp) || 0;

    // Handle NaN
    precision = isNaN(precision) ? 0 : precision;
    recall = isNaN(recall) ? 0 : recall;
    specificity = isNaN(specificity) ? 0 : specificity;

    const f1 = 2 * (precision * recall) / (precision + recall) || 0;

    return {
      accuracy: Number((accuracy * 100).toFixed(2)),
      precision: Number((precision * 100).toFixed(2)),
      recall: Number((recall * 100).toFixed(2)),
      specificity: Number((specificity * 100).toFixed(2)),
      f1Score: Number((f1 * 100).toFixed(2))
    };
  }

  /**
   * Calculate directional accuracy
   * @private
   */
  calculateDirectionalAccuracy(predictions, outcomes) {
    let correctUp = 0;
    let correctDown = 0;
    let totalUp = 0;
    let totalDown = 0;
    let hitCount = 0;

    for (let i = 0; i < predictions.length; i++) {
      const predDir = predictions[i].direction;
      const actualDir = outcomes[i].direction;

      if (predDir === actualDir) {
        hitCount++;
      }

      if (actualDir === 'UP') {
        totalUp++;
        if (predDir === 'UP') correctUp++;
      } else {
        totalDown++;
        if (predDir === 'DOWN') correctDown++;
      }
    }

    const hitRate = (hitCount / predictions.length) * 100;
    const upAccuracy = totalUp > 0 ? (correctUp / totalUp) * 100 : 0;
    const downAccuracy = totalDown > 0 ? (correctDown / totalDown) * 100 : 0;

    return {
      hitRate: Number(hitRate.toFixed(2)),
      upAccuracy: Number(upAccuracy.toFixed(2)),
      downAccuracy: Number(downAccuracy.toFixed(2)),
      correctUp: correctUp,
      correctDown: correctDown,
      totalUp: totalUp,
      totalDown: totalDown
    };
  }

  /**
   * Calculate price accuracy
   * @private
   */
  calculatePriceAccuracy(predictions, outcomes) {
    const errors = [];
    const percentErrors = [];

    for (let i = 0; i < predictions.length; i++) {
      if (outcomes[i].actualPrice && outcomes[i].expectedPrice) {
        const error = Math.abs(outcomes[i].actualPrice - outcomes[i].expectedPrice);
        const percentError = (error / outcomes[i].expectedPrice) * 100;

        errors.push(error);
        percentErrors.push(percentError);
      }
    }

    if (errors.length === 0) {
      return {
        mae: 0,
        rmse: 0,
        mape: 0,
        r2Score: 0
      };
    }

    const mae = errors.reduce((a, b) => a + b) / errors.length;
    const rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e) / errors.length);
    const mape = percentErrors.reduce((a, b) => a + b) / percentErrors.length;

    // Simple R² approximation
    const avgError = mae;
    const r2Score = Math.max(0, 1 - (rmse / avgError));

    return {
      mae: Number(mae.toFixed(4)),
      rmse: Number(rmse.toFixed(4)),
      mape: Number(mape.toFixed(2)),
      r2Score: Number(r2Score.toFixed(4))
    };
  }

  /**
   * Calculate ROC-AUC
   * @private
   */
  calculateROCAUC(predictions, outcomes) {
    // Get probabilities and actual values
    const scores = predictions.map((p, i) => ({
      score: p.probability,
      actual: outcomes[i].direction === 'UP' ? 1 : 0
    }));

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Calculate AUC using trapezoidal rule
    let tp = 0;
    let fp = 0;
    let prevTp = 0;
    let prevFp = 0;
    let auc = 0;

    const totalPositives = scores.filter(s => s.actual === 1).length;
    const totalNegatives = scores.filter(s => s.actual === 0).length;

    for (const item of scores) {
      if (item.actual === 1) {
        tp++;
      } else {
        fp++;
      }

      const tpr = tp / totalPositives;
      const fpr = fp / totalNegatives;

      auc += ((fpr - (prevFp / totalNegatives)) * (tpr + (prevTp / totalPositives)) / 2);

      prevTp = tp;
      prevFp = fp;
    }

    return Number(Math.max(0, Math.min(1, auc)).toFixed(4));
  }

  /**
   * Calculate advanced metrics (MCC)
   * @private
   */
  calculateAdvancedMetrics(cm) {
    const numerator = (cm.tp * cm.tn) - (cm.fp * cm.fn);
    const denominator = Math.sqrt((cm.tp + cm.fp) * (cm.tp + cm.fn) *
                                  (cm.tn + cm.fp) * (cm.tn + cm.fn));

    const mcc = denominator === 0 ? 0 : numerator / denominator;

    return {
      matthewsCC: Number(mcc.toFixed(4))
    };
  }

  /**
   * Get accuracy summary
   * @param {Object} metrics - Accuracy metrics
   * @returns {string} Formatted summary
   */
  getSummary(metrics) {
    let summary = '📊 Prediction Accuracy Summary\n';
    summary += '═══════════════════════════════════\n';
    summary += `Hit Rate: ${metrics.directionalAccuracy.hitRate.toFixed(2)}%\n`;
    summary += `Precision: ${metrics.basicMetrics.precision.toFixed(2)}%\n`;
    summary += `Recall: ${metrics.basicMetrics.recall.toFixed(2)}%\n`;
    summary += `F1 Score: ${metrics.basicMetrics.f1Score.toFixed(2)}%\n`;
    summary += `ROC-AUC: ${metrics.rocAuc.toFixed(4)}\n`;
    summary += `MAE: ${metrics.priceAccuracy.mae.toFixed(4)}\n`;
    summary += `MAPE: ${metrics.priceAccuracy.mape.toFixed(2)}%\n`;
    return summary;
  }

  /**
   * Get prediction quality classification
   * @param {Object} metrics - Accuracy metrics
   * @returns {string} Quality tier
   */
  getQualityTier(metrics) {
    const hitRate = metrics.directionalAccuracy.hitRate;

    if (hitRate >= 70) return 'EXCELLENT';
    if (hitRate >= 60) return 'VERY_GOOD';
    if (hitRate >= 55) return 'GOOD';
    if (hitRate >= 52) return 'FAIR';
    if (hitRate >= 50) return 'NEUTRAL';
    return 'POOR';
  }

  /**
   * Compare predictions to baseline (50%)
   * @param {Object} metrics - Accuracy metrics
   * @returns {Object} Comparison
   */
  compareToBaseline(metrics) {
    const hitRate = metrics.directionalAccuracy.hitRate;
    const baseline = 50;
    const improvement = hitRate - baseline;
    const improvementPercent = (improvement / baseline) * 100;

    return {
      hitRate: hitRate,
      baseline: baseline,
      improvement: Number(improvement.toFixed(2)),
      improvementPercent: Number(improvementPercent.toFixed(2)),
      isBetter: hitRate > baseline,
      quality: this.getQualityTier(metrics)
    };
  }
}

// Export
module.exports = {
  GNNAccuracyCalculator
};
