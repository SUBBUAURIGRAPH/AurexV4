/**
 * GNN Prediction Model
 * Graph Neural Network for stock price prediction
 *
 * Architecture:
 * - GCN (Graph Convolutional Network) layers
 * - Attention mechanism
 * - Multi-head predictions
 * - Confidence scoring
 */

const EventEmitter = require('events');

/**
 * GNN Prediction Model
 * Simplified GNN implementation for stock prediction
 */
class GNNPredictionModel extends EventEmitter {
  constructor(config = {}) {
    super();

    this.logger = config.logger || console;
    this.inputDim = 58;  // Node feature dimensions
    this.hiddenDim = 32;
    this.outputDim = 1;

    // Initialize weights (random)
    this.initializeWeights();

    this.trainedAt = null;
    this.accuracy = 0;
    this.trainingLoss = [];
  }

  /**
   * Initialize network weights
   * @private
   */
  initializeWeights() {
    // Layer 1: Graph convolution
    this.W1 = this.randomMatrix(this.inputDim, this.hiddenDim);
    this.b1 = new Array(this.hiddenDim).fill(0.01);

    // Layer 2: Attention
    this.W_attention = this.randomMatrix(this.hiddenDim, this.hiddenDim);

    // Layer 3: Output layer
    this.W2 = this.randomMatrix(this.hiddenDim, this.outputDim);
    this.b2 = [0.01];

    this.logger.info('✅ GNN Model initialized (58 → 32 → 1)');
  }

  /**
   * Generate random matrix
   * @private
   */
  randomMatrix(rows, cols) {
    const matrix = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        row.push((Math.random() - 0.5) * 0.1);
      }
      matrix.push(row);
    }
    return matrix;
  }

  /**
   * Predict price movement for a stock
   * @param {Array} nodeFeatures - 58-dimensional feature vector
   * @param {Array} neighbors - Neighbor node features
   * @param {number} confidence - Expected confidence (for training)
   * @returns {Object} Prediction result
   */
  predict(nodeFeatures, neighbors = [], confidence = null) {
    try {
      // Forward pass through network
      const hidden = this.graphConvolution(nodeFeatures, neighbors);
      const attention = this.attentionMechanism(hidden);
      const output = this.outputLayer(attention);

      // Calculate prediction
      const probability = this.sigmoid(output[0]);
      const direction = probability > 0.5 ? 'UP' : 'DOWN';
      const confidence_score = Math.abs(probability - 0.5) * 2;

      const prediction = {
        probability: Number(probability.toFixed(4)),
        direction: direction,
        confidence: Number(confidence_score.toFixed(4)),
        signal_strength: Number(((probability - 0.5) * 2).toFixed(3)),
        hidden_state: hidden
      };

      // Calculate loss if we have ground truth
      if (confidence !== null) {
        const target = confidence > 0.5 ? 1 : 0;
        const loss = this.binaryCrossEntropy(probability, target);
        prediction.loss = loss;
      }

      return prediction;
    } catch (error) {
      this.logger.error('Error in prediction:', error);
      return {
        probability: 0.5,
        direction: 'NEUTRAL',
        confidence: 0,
        signal_strength: 0
      };
    }
  }

  /**
   * Graph Convolution Layer
   * @private
   */
  graphConvolution(nodeFeatures, neighbors) {
    // Simple GCN: aggregate neighbor information
    const aggregated = this.aggregateNeighbors(nodeFeatures, neighbors);

    // Apply linear transformation
    const convolved = this.matrixMultiply(aggregated, this.W1);

    // Add bias
    const biased = this.addBias(convolved, this.b1);

    // ReLU activation
    return this.relu(biased);
  }

  /**
   * Aggregate neighbor features
   * @private
   */
  aggregateNeighbors(nodeFeatures, neighbors) {
    let aggregated = [...nodeFeatures];

    if (neighbors && neighbors.length > 0) {
      // Weight: 70% self, 30% neighbors
      const neighborAvg = new Array(this.inputDim).fill(0);

      for (const neighbor of neighbors) {
        for (let i = 0; i < Math.min(neighbor.length, this.inputDim); i++) {
          neighborAvg[i] += neighbor[i];
        }
      }

      const neighborWeight = 0.3 / Math.max(neighbors.length, 1);
      for (let i = 0; i < this.inputDim; i++) {
        aggregated[i] = aggregated[i] * 0.7 + (neighborAvg[i] / Math.max(neighbors.length, 1)) * neighborWeight;
      }
    }

    return aggregated;
  }

  /**
   * Attention Mechanism
   * @private
   */
  attentionMechanism(hidden) {
    // Multi-head attention (simplified)
    const attention = this.matrixMultiply(hidden, this.W_attention);
    const weights = this.softmax(attention);

    // Apply attention weights
    const attended = hidden.map((h, i) => h * weights[i]);
    return attended;
  }

  /**
   * Output Layer
   * @private
   */
  outputLayer(attended) {
    const output = this.matrixMultiply(attended, this.W2);
    return this.addBias(output, this.b2);
  }

  /**
   * Matrix multiplication (vector × matrix)
   * @private
   */
  matrixMultiply(vector, matrix) {
    const result = [];

    for (let j = 0; j < matrix[0].length; j++) {
      let sum = 0;
      for (let i = 0; i < vector.length; i++) {
        sum += vector[i] * matrix[i][j];
      }
      result.push(sum);
    }

    return result;
  }

  /**
   * Add bias
   * @private
   */
  addBias(vector, bias) {
    return vector.map((v, i) => v + (bias[i] || 0));
  }

  /**
   * ReLU activation
   * @private
   */
  relu(vector) {
    return vector.map(v => Math.max(0, v));
  }

  /**
   * Sigmoid activation
   * @private
   */
  sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Softmax activation
   * @private
   */
  softmax(vector) {
    const max = Math.max(...vector);
    const exps = vector.map(v => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sum);
  }

  /**
   * Binary cross entropy loss
   * @private
   */
  binaryCrossEntropy(predicted, actual) {
    const epsilon = 1e-7;
    const p = Math.max(epsilon, Math.min(1 - epsilon, predicted));
    return -(actual * Math.log(p) + (1 - actual) * Math.log(1 - p));
  }

  /**
   * Train model on historical data
   * @param {Array} trainingData - Array of {features, neighbors, label} objects
   * @param {number} epochs - Number of training epochs
   * @returns {Promise<Object>} Training result
   */
  async train(trainingData, epochs = 100) {
    try {
      this.trainingLoss = [];
      const learningRate = 0.001;

      for (let epoch = 0; epoch < epochs; epoch++) {
        let epochLoss = 0;
        let correctPredictions = 0;

        for (const sample of trainingData) {
          const prediction = this.predict(sample.features, sample.neighbors || []);
          const target = sample.label > 0.5 ? 1 : 0;

          // Calculate loss
          const loss = this.binaryCrossEntropy(prediction.probability, target);
          epochLoss += loss;

          // Update accuracy
          if ((prediction.probability > 0.5 && target === 1) ||
              (prediction.probability <= 0.5 && target === 0)) {
            correctPredictions++;
          }

          // Gradient update (simplified)
          const delta = prediction.probability - target;
          this.updateWeights(sample.features, delta, learningRate);
        }

        epochLoss /= trainingData.length;
        this.trainingLoss.push(epochLoss);
        this.accuracy = correctPredictions / trainingData.length;

        if (epoch % 20 === 0) {
          this.logger.info(`📈 Epoch ${epoch}/${epochs} - Loss: ${epochLoss.toFixed(4)}, Accuracy: ${(this.accuracy * 100).toFixed(1)}%`);
        }
      }

      this.trainedAt = new Date();

      this.logger.info(`✅ Model training complete - Final Accuracy: ${(this.accuracy * 100).toFixed(1)}%`);
      this.emit('training:complete', { accuracy: this.accuracy, loss: this.trainingLoss[this.trainingLoss.length - 1] });

      return {
        success: true,
        accuracy: this.accuracy,
        finalLoss: this.trainingLoss[this.trainingLoss.length - 1],
        epochs: epochs
      };
    } catch (error) {
      this.logger.error('Error training model:', error);
      throw error;
    }
  }

  /**
   * Update weights (simplified SGD)
   * @private
   */
  updateWeights(features, delta, learningRate) {
    // Update W1
    for (let i = 0; i < this.W1.length; i++) {
      for (let j = 0; j < this.W1[i].length; j++) {
        this.W1[i][j] -= learningRate * delta * features[i] * 0.01;
      }
    }

    // Update b1
    for (let j = 0; j < this.b1.length; j++) {
      this.b1[j] -= learningRate * delta * 0.01;
    }
  }

  /**
   * Get model summary
   * @returns {Object} Model info
   */
  getSummary() {
    return {
      architecture: 'GCN with Attention',
      layers: [
        { name: 'Input', shape: [58] },
        { name: 'GraphConv', shape: [32] },
        { name: 'Attention', shape: [32] },
        { name: 'Output', shape: [1] }
      ],
      trainedAt: this.trainedAt,
      accuracy: this.accuracy,
      parameters: 58 * 32 + 32 + 32 * 32 + 32 * 1 + 32  // Approximate
    };
  }

  /**
   * Save model weights
   * @returns {Object} Serialized weights
   */
  saveWeights() {
    return {
      W1: this.W1,
      b1: this.b1,
      W_attention: this.W_attention,
      W2: this.W2,
      b2: this.b2,
      trainedAt: this.trainedAt,
      accuracy: this.accuracy
    };
  }

  /**
   * Load model weights
   * @param {Object} weights - Serialized weights
   */
  loadWeights(weights) {
    this.W1 = weights.W1;
    this.b1 = weights.b1;
    this.W_attention = weights.W_attention;
    this.W2 = weights.W2;
    this.b2 = weights.b2;
    this.trainedAt = weights.trainedAt;
    this.accuracy = weights.accuracy;

    this.logger.info(`✅ Model weights loaded - Accuracy: ${(this.accuracy * 100).toFixed(1)}%`);
  }
}

// Export
module.exports = {
  GNNPredictionModel
};
