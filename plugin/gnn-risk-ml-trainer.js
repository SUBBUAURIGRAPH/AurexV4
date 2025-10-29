/**
 * GNN Risk ML Trainer - Model Training and Cross-Validation
 *
 * Provides comprehensive training, validation, and optimization for
 * ML-based risk prediction models. Includes cross-validation, hyperparameter
 * tuning, and model selection strategies.
 *
 * Features:
 * - K-fold cross-validation for robust evaluation
 * - Stratified sampling to maintain class balance
 * - Hyperparameter grid search and random search
 * - Time-series cross-validation for temporal data
 * - Training data generation and augmentation
 * - Model persistence and versioning
 * - Training progress tracking and metrics
 * - Learning curve analysis
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

const { GNNRiskMLModels } = require('./gnn-risk-ml-models');

class TrainingDataGenerator {
  constructor() {
    this.syntheticDataCache = new Map();
  }

  /**
   * Generate training data from historical portfolio and market data
   * @param {Array<Object>} historicalEvents - Historical market/portfolio events
   * @param {number} samplesPerEvent - Samples to generate per event
   * @returns {Array<Object>} Training data with {features, label}
   */
  generateFromHistory(historicalEvents, samplesPerEvent = 5) {
    const trainingData = [];

    for (const event of historicalEvents) {
      // Use actual event as base
      trainingData.push({
        features: event.features,
        label: event.riskLevel,
      });

      // Generate synthetic variations
      for (let i = 0; i < samplesPerEvent - 1; i++) {
        const augmentedFeatures = this._augmentFeatures(event.features);
        trainingData.push({
          features: augmentedFeatures,
          label: event.riskLevel,
        });
      }
    }

    return trainingData;
  }

  /**
   * Generate synthetic risk scenarios
   * @param {number} count - Number of scenarios to generate
   * @returns {Array<Object>} Synthetic training data
   */
  generateSyntheticScenarios(count = 1000) {
    const scenarios = [];

    // Define scenario templates
    const scenarioTemplates = [
      // Low risk scenario
      {
        name: 'Low Risk - Stable Markets',
        features: [0.5, 0.3, 0.2, 0.1, 0.05, 0.2, 0.05, 0.05],
        label: 0,
        variance: 0.1,
      },
      // Medium risk scenario
      {
        name: 'Medium Risk - Normal Volatility',
        features: [1.0, 0.5, 0.4, 0.3, 0.15, 0.5, 0.1, 0.1],
        label: 1,
        variance: 0.15,
      },
      // High risk scenario
      {
        name: 'High Risk - Elevated Stress',
        features: [2.0, 0.7, 0.6, 0.5, 0.3, 0.8, 0.2, 0.2],
        label: 2,
        variance: 0.2,
      },
      // Extreme stress scenario
      {
        name: 'Extreme Risk - Market Shock',
        features: [4.0, 0.9, 0.8, 0.7, 0.5, 1.0, 0.4, 0.3],
        label: 2,
        variance: 0.25,
      },
    ];

    // Generate scenarios from templates
    for (let i = 0; i < count; i++) {
      const template = scenarioTemplates[i % scenarioTemplates.length];
      const scenario = this._generateScenarioFromTemplate(template);
      scenarios.push(scenario);
    }

    return scenarios;
  }

  /**
   * Generate scenario from template
   * @private
   */
  _generateScenarioFromTemplate(template) {
    const features = template.features.map((f) => {
      const noise = (Math.random() - 0.5) * template.variance;
      const value = f + noise;
      return Math.max(0, Math.min(1, value));
    });

    return {
      features,
      label: template.label,
    };
  }

  /**
   * Augment features with noise and transformations
   * @private
   */
  _augmentFeatures(baseFeatures) {
    return baseFeatures.map((f) => {
      // Add Gaussian noise
      const noise = this._gaussianRandom() * 0.1;
      const value = f + noise;

      // Clamp to valid range
      return Math.max(0, Math.min(1, value));
    });
  }

  /**
   * Generate Gaussian random number
   * @private
   */
  _gaussianRandom() {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}

class CrossValidator {
  constructor(kFolds = 5) {
    this.kFolds = kFolds;
  }

  /**
   * Perform k-fold cross-validation
   * @param {Array<Object>} data - Training data
   * @param {Function} trainFunc - Training function (fold) -> model
   * @param {Function} evalFunc - Evaluation function (model, testData) -> metrics
   * @returns {Object} Cross-validation results
   */
  kFoldCrossValidation(data, trainFunc, evalFunc) {
    const folds = this._stratifiedKFold(data, this.kFolds);
    const results = [];

    for (let i = 0; i < folds.length; i++) {
      const testFold = folds[i];
      const trainFolds = folds.filter((_, idx) => idx !== i).flat();

      // Train model on training folds
      const model = trainFunc(trainFolds);

      // Evaluate on test fold
      const metrics = evalFunc(model, testFold);
      results.push({
        fold: i + 1,
        metrics,
      });
    }

    return {
      foldResults: results,
      meanMetrics: this._aggregateMetrics(results),
      stdMetrics: this._computeStdMetrics(results),
    };
  }

  /**
   * Stratified k-fold split maintaining class distribution
   * @private
   */
  _stratifiedKFold(data, k) {
    // Group by label
    const byLabel = new Map();
    for (const item of data) {
      if (!byLabel.has(item.label)) {
        byLabel.set(item.label, []);
      }
      byLabel.get(item.label).push(item);
    }

    // Create folds
    const folds = Array.from({ length: k }, () => []);

    // Distribute samples from each class
    for (const [label, items] of byLabel) {
      for (let i = 0; i < items.length; i++) {
        folds[i % k].push(items[i]);
      }
    }

    return folds;
  }

  /**
   * Time-series cross-validation (walk-forward)
   * @param {Array<Object>} data - Chronologically ordered data
   * @param {number} initialTrainSize - Initial training set size
   * @param {number} testSize - Test set size
   * @param {Function} trainFunc - Training function
   * @param {Function} evalFunc - Evaluation function
   * @returns {Object} Walk-forward results
   */
  walkForwardValidation(data, initialTrainSize, testSize, trainFunc, evalFunc) {
    const results = [];
    let trainIndex = initialTrainSize;

    while (trainIndex + testSize <= data.length) {
      const trainData = data.slice(0, trainIndex);
      const testData = data.slice(trainIndex, trainIndex + testSize);

      // Train
      const model = trainFunc(trainData);

      // Evaluate
      const metrics = evalFunc(model, testData);
      results.push({
        period: Math.floor(trainIndex / initialTrainSize),
        metrics,
      });

      // Move window
      trainIndex += testSize;
    }

    return {
      periodResults: results,
      meanMetrics: this._aggregateMetrics(results),
    };
  }

  /**
   * Aggregate metrics across folds
   * @private
   */
  _aggregateMetrics(results) {
    if (results.length === 0) return {};

    const metricsArray = results.map((r) => r.metrics);
    const aggregated = {};

    // Average accuracy
    const accuracies = metricsArray.map((m) => m.accuracy || 0);
    aggregated.meanAccuracy = accuracies.reduce((a, b) => a + b) / accuracies.length;

    // Average F1 scores
    const f1Scores = metricsArray.map((m) => m.macroF1 || 0);
    aggregated.meanF1 = f1Scores.reduce((a, b) => a + b) / f1Scores.length;

    return aggregated;
  }

  /**
   * Compute standard deviation of metrics
   * @private
   */
  _computeStdMetrics(results) {
    if (results.length === 0) return {};

    const metricsArray = results.map((r) => r.metrics);
    const accuracies = metricsArray.map((m) => m.accuracy || 0);
    const f1Scores = metricsArray.map((m) => m.macroF1 || 0);

    const mean_acc = accuracies.reduce((a, b) => a + b) / accuracies.length;
    const mean_f1 = f1Scores.reduce((a, b) => a + b) / f1Scores.length;

    const std_acc = Math.sqrt(
      accuracies.reduce((sum, x) => sum + Math.pow(x - mean_acc, 2), 0) / accuracies.length
    );
    const std_f1 = Math.sqrt(
      f1Scores.reduce((sum, x) => sum + Math.pow(x - mean_f1, 2), 0) / f1Scores.length
    );

    return {
      stdAccuracy: std_acc,
      stdF1: std_f1,
    };
  }
}

class HyperparameterTuner {
  constructor() {
    this.bestParams = null;
    this.bestScore = -Infinity;
    this.searchHistory = [];
  }

  /**
   * Grid search for hyperparameters
   * @param {Object} paramGrid - Parameter grid to search
   * @param {Array<Object>} trainingData - Training data
   * @param {number} cvFolds - Number of CV folds
   * @returns {Object} Best parameters and results
   */
  gridSearch(paramGrid, trainingData, cvFolds = 5) {
    const combinations = this._generateCombinations(paramGrid);
    const validator = new CrossValidator(cvFolds);

    for (const params of combinations) {
      const model = new GNNRiskMLModels();

      // Apply parameters
      Object.assign(model.config, params);

      // Cross-validate
      const cvResults = validator.kFoldCrossValidation(
        trainingData,
        (data) => {
          const m = new GNNRiskMLModels();
          Object.assign(m.config, params);
          m.trainModels(data);
          return m;
        },
        (m, data) => m.evaluate(data)
      );

      const score = cvResults.meanMetrics.meanAccuracy;

      this.searchHistory.push({
        params,
        score,
        cvResults,
      });

      if (score > this.bestScore) {
        this.bestScore = score;
        this.bestParams = params;
      }
    }

    return {
      bestParams: this.bestParams,
      bestScore: this.bestScore,
      searchHistory: this.searchHistory,
    };
  }

  /**
   * Random search for hyperparameters
   * @param {Object} paramDist - Parameter distributions
   * @param {number} nIter - Number of iterations
   * @param {Array<Object>} trainingData - Training data
   * @param {number} cvFolds - Number of CV folds
   * @returns {Object} Best parameters and results
   */
  randomSearch(paramDist, nIter, trainingData, cvFolds = 5) {
    const validator = new CrossValidator(cvFolds);

    for (let i = 0; i < nIter; i++) {
      const params = this._sampleParameters(paramDist);

      const model = new GNNRiskMLModels();
      Object.assign(model.config, params);

      const cvResults = validator.kFoldCrossValidation(
        trainingData,
        (data) => {
          const m = new GNNRiskMLModels();
          Object.assign(m.config, params);
          m.trainModels(data);
          return m;
        },
        (m, data) => m.evaluate(data)
      );

      const score = cvResults.meanMetrics.meanAccuracy;

      this.searchHistory.push({
        params,
        score,
        cvResults,
      });

      if (score > this.bestScore) {
        this.bestScore = score;
        this.bestParams = params;
      }
    }

    return {
      bestParams: this.bestParams,
      bestScore: this.bestScore,
      searchHistory: this.searchHistory,
    };
  }

  /**
   * Generate parameter combinations for grid search
   * @private
   */
  _generateCombinations(paramGrid) {
    const keys = Object.keys(paramGrid);
    const combinations = [];

    function generateRecursive(index, current) {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }

      const key = keys[index];
      for (const value of paramGrid[key]) {
        current[key] = value;
        generateRecursive(index + 1, current);
      }
    }

    generateRecursive(0, {});
    return combinations;
  }

  /**
   * Sample parameters from distributions
   * @private
   */
  _sampleParameters(paramDist) {
    const params = {};

    for (const [key, dist] of Object.entries(paramDist)) {
      if (Array.isArray(dist)) {
        // Categorical
        params[key] = dist[Math.floor(Math.random() * dist.length)];
      } else if (dist.type === 'uniform') {
        // Uniform distribution
        params[key] = dist.min + Math.random() * (dist.max - dist.min);
      } else if (dist.type === 'int_uniform') {
        // Integer uniform distribution
        params[key] = Math.floor(dist.min + Math.random() * (dist.max - dist.min + 1));
      }
    }

    return params;
  }
}

class GNNRiskMLTrainer {
  constructor() {
    this.dataGenerator = new TrainingDataGenerator();
    this.crossValidator = new CrossValidator(5);
    this.hyperparameterTuner = new HyperparameterTuner();

    this.trainingHistory = [];
    this.models = [];

    this.stats = {
      totalTrainingSamples: 0,
      lastTrainingTime: null,
      bestModelAccuracy: 0,
      trainingRuns: 0,
    };
  }

  // ============================================================================
  // DATA PREPARATION
  // ============================================================================

  /**
   * Prepare training data from multiple sources
   * @param {Object} sources - Data sources (historical, synthetic, etc.)
   * @returns {Array<Object>} Combined training data
   */
  prepareTrainingData(sources = {}) {
    const trainingData = [];

    // Add historical data
    if (sources.historicalEvents && sources.historicalEvents.length > 0) {
      const generated = this.dataGenerator.generateFromHistory(
        sources.historicalEvents,
        sources.samplesPerEvent || 5
      );
      trainingData.push(...generated);
    }

    // Add synthetic data
    if (sources.syntheticCount && sources.syntheticCount > 0) {
      const synthetic = this.dataGenerator.generateSyntheticScenarios(sources.syntheticCount);
      trainingData.push(...synthetic);
    }

    this.stats.totalTrainingSamples = trainingData.length;

    return trainingData;
  }

  /**
   * Split data into train/test/validation
   * @param {Array<Object>} data - Training data
   * @param {Object} ratios - Split ratios {train, test, validation}
   * @returns {Object} Split data
   */
  trainTestValSplit(data, ratios = { train: 0.6, test: 0.2, validation: 0.2 }) {
    // Shuffle
    const shuffled = [...data].sort(() => Math.random() - 0.5);

    const n = shuffled.length;
    const trainSize = Math.floor(n * ratios.train);
    const testSize = Math.floor(n * ratios.test);

    return {
      train: shuffled.slice(0, trainSize),
      test: shuffled.slice(trainSize, trainSize + testSize),
      validation: shuffled.slice(trainSize + testSize),
    };
  }

  // ============================================================================
  // MODEL TRAINING
  // ============================================================================

  /**
   * Train model with specified data
   * @param {Array<Object>} trainingData - Training data
   * @param {Object} config - Training configuration
   * @returns {Object} Training results
   */
  train(trainingData, config = {}) {
    const startTime = Date.now();

    // Initialize model
    const model = new GNNRiskMLModels();

    // Apply custom config
    if (config.modelConfig) {
      Object.assign(model.config, config.modelConfig);
    }

    // Train models
    const trainResult = model.trainModels(trainingData);

    const trainingTime = Date.now() - startTime;

    // Evaluate on training data
    const trainMetrics = model.evaluate(trainingData.slice(0, Math.min(100, trainingData.length)));

    const result = {
      model,
      trainResult,
      trainMetrics,
      trainingTime,
      timestamp: Date.now(),
    };

    this.trainingHistory.push(result);
    this.models.push(model);

    this.stats.lastTrainingTime = trainingTime;
    this.stats.trainingRuns++;

    return result;
  }

  /**
   * Train with cross-validation
   * @param {Array<Object>} trainingData - Training data
   * @param {number} kFolds - Number of folds
   * @returns {Object} CV results
   */
  trainWithCrossValidation(trainingData, kFolds = 5) {
    this.crossValidator.kFolds = kFolds;

    const cvResults = this.crossValidator.kFoldCrossValidation(
      trainingData,
      (data) => {
        const result = this.train(data);
        return result.model;
      },
      (model, data) => model.evaluate(data)
    );

    return {
      cvResults,
      bestAccuracy: cvResults.meanMetrics.meanAccuracy,
      stdAccuracy: cvResults.stdMetrics.stdAccuracy,
    };
  }

  /**
   * Train with hyperparameter tuning
   * @param {Array<Object>} trainingData - Training data
   * @param {Object} hyperparamGrid - Hyperparameter grid
   * @returns {Object} Tuning results
   */
  trainWithHyperparameterTuning(trainingData, hyperparamGrid) {
    const tuningResults = this.hyperparameterTuner.gridSearch(
      hyperparamGrid,
      trainingData,
      5
    );

    // Train final model with best params
    const finalModel = new GNNRiskMLModels();
    Object.assign(finalModel.config, tuningResults.bestParams);
    finalModel.trainModels(trainingData);

    return {
      tuningResults,
      finalModel,
      bestParams: tuningResults.bestParams,
      bestScore: tuningResults.bestScore,
    };
  }

  /**
   * Train with walk-forward validation
   * @param {Array<Object>} trainingData - Chronologically ordered data
   * @param {number} initialTrainSize - Initial training set size
   * @returns {Object} Walk-forward results
   */
  trainWithWalkForwardValidation(trainingData, initialTrainSize = 100) {
    const results = this.crossValidator.walkForwardValidation(
      trainingData,
      initialTrainSize,
      50,
      (data) => {
        const result = this.train(data);
        return result.model;
      },
      (model, data) => model.evaluate(data)
    );

    return results;
  }

  // ============================================================================
  // LEARNING CURVES
  // ============================================================================

  /**
   * Generate learning curves
   * @param {Array<Object>} trainingData - Training data
   * @param {Array<number>} trainSizes - Training sizes to evaluate
   * @returns {Object} Learning curve data
   */
  generateLearningCurves(trainingData, trainSizes = [20, 50, 100, 200, 500]) {
    const curves = {
      trainSizes: [],
      trainAccuracies: [],
      testAccuracies: [],
    };

    const { train, test } = this.trainTestValSplit(trainingData, {
      train: 0.8,
      test: 0.2,
    });

    for (const size of trainSizes) {
      if (size > train.length) continue;

      const subset = train.slice(0, size);
      const result = this.train(subset);

      const trainAcc = result.trainMetrics.accuracy;
      const testAcc = result.model.evaluate(test).accuracy;

      curves.trainSizes.push(size);
      curves.trainAccuracies.push(trainAcc);
      curves.testAccuracies.push(testAcc);
    }

    return curves;
  }

  // ============================================================================
  // MODEL SELECTION AND ENSEMBLE
  // ============================================================================

  /**
   * Select best model from training history
   * @returns {Object} Best model and stats
   */
  selectBestModel() {
    if (this.trainingHistory.length === 0) {
      throw new Error('No trained models available');
    }

    let bestResult = this.trainingHistory[0];
    let bestAccuracy = bestResult.trainMetrics.accuracy;

    for (const result of this.trainingHistory) {
      if (result.trainMetrics.accuracy > bestAccuracy) {
        bestAccuracy = result.trainMetrics.accuracy;
        bestResult = result;
      }
    }

    this.stats.bestModelAccuracy = bestAccuracy;

    return {
      model: bestResult.model,
      accuracy: bestAccuracy,
      metrics: bestResult.trainMetrics,
    };
  }

  /**
   * Create ensemble from multiple trained models
   * @returns {Object} Ensemble information
   */
  createEnsemble() {
    if (this.models.length === 0) {
      throw new Error('No models available for ensemble');
    }

    return {
      models: this.models,
      size: this.models.length,
      predict: (portfolio, marketState, historicalData) => {
        const predictions = this.models.map((model) =>
          model.predictRisk(portfolio, marketState, historicalData)
        );

        // Average confidence
        const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

        // Majority vote on risk level
        const votes = new Map();
        for (const pred of predictions) {
          const level = pred.riskLevel;
          votes.set(level, (votes.get(level) || 0) + 1);
        }

        let bestLevel = 1;
        let bestCount = 0;
        for (const [level, count] of votes) {
          if (count > bestCount) {
            bestCount = count;
            bestLevel = level;
          }
        }

        return {
          riskLevel: bestLevel,
          riskClass: predictions[0].riskClass,
          confidence: avgConfidence,
          ensembleSize: this.models.length,
          individualPredictions: predictions,
        };
      },
    };
  }

  // ============================================================================
  // MODEL PERSISTENCE
  // ============================================================================

  /**
   * Save model to JSON-serializable format
   * @param {Object} model - Model to save
   * @returns {Object} Serialized model
   */
  serializeModel(model) {
    return {
      config: model.config,
      stats: model.getStatistics(),
      riskFactors: model.riskFactors,
      timestamp: Date.now(),
    };
  }

  /**
   * Get training statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      modelsCount: this.models.length,
      trainingRunsCount: this.trainingHistory.length,
    };
  }

  /**
   * Get training summary
   * @returns {Object} Summary
   */
  getSummary() {
    return {
      dataGenerator: {
        type: 'enabled',
        capabilities: ['synthetic', 'augmentation', 'historical'],
      },
      crossValidation: {
        type: 'k-fold',
        defaultFolds: 5,
        strategy: 'stratified',
      },
      hyperparameterTuning: {
        type: 'gridSearch+randomSearch',
        enabled: true,
      },
      walForwardValidation: {
        type: 'enabled',
        useCase: 'time-series data',
      },
      modelPersistence: {
        format: 'json',
        enabled: true,
      },
      statistics: this.getStatistics(),
    };
  }
}

module.exports = {
  GNNRiskMLTrainer,
  TrainingDataGenerator,
  CrossValidator,
  HyperparameterTuner,
};
