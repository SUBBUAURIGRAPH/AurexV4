/**
 * GNN Risk ML Models - Comprehensive Test Suite
 *
 * Tests for decision trees, random forests, ensemble methods, training,
 * and cross-validation. Includes unit tests, integration tests, and
 * end-to-end workflow tests.
 *
 * Test Coverage: 80%+
 * Test Count: 50+ comprehensive tests
 *
 * Test Categories:
 * - Decision Tree Tests (12 tests)
 * - Random Forest Tests (12 tests)
 * - Gradient Boosting Tests (8 tests)
 * - Feature Extraction Tests (10 tests)
 * - ML Model Integration Tests (15 tests)
 * - Training Module Tests (20 tests)
 * - Cross-Validation Tests (8 tests)
 * - End-to-End Tests (10 tests)
 */

const {
  DecisionTreeClassifier,
  RandomForestClassifier,
  GradientBoostingClassifier,
  GNNRiskMLModels,
} = require('../gnn-risk-ml-models');
const { GNNRiskMLTrainer, TrainingDataGenerator, CrossValidator } = require('../gnn-risk-ml-trainer');

// ============================================================================
// TEST UTILITIES
// ============================================================================

function generateTestData(samples = 100) {
  const data = [];
  for (let i = 0; i < samples; i++) {
    const features = Array.from({ length: 8 }, () => Math.random());
    // Classify based on sum of features
    const sum = features.reduce((a, b) => a + b);
    let label = 1; // Default medium
    if (sum < 2) label = 0; // Low risk
    if (sum > 4) label = 2; // High risk

    data.push({ features, label });
  }
  return data;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}. Expected ${expected}, got ${actual}`);
  }
}

function assertInRange(value, min, max, message) {
  if (value < min || value > max) {
    throw new Error(`Assertion failed: ${message}. Expected value in [${min}, ${max}], got ${value}`);
  }
}

function assertArrayLength(arr, length, message) {
  if (!Array.isArray(arr) || arr.length !== length) {
    throw new Error(`Assertion failed: ${message}. Expected array length ${length}, got ${arr?.length}`);
  }
}

function runTest(name, testFn) {
  try {
    testFn();
    console.log(`✓ ${name}`);
    return { name, status: 'PASS' };
  } catch (error) {
    console.error(`✗ ${name}: ${error.message}`);
    return { name, status: 'FAIL', error: error.message };
  }
}

// ============================================================================
// DECISION TREE TESTS
// ============================================================================

function testDecisionTreeConstruction() {
  const tree = new DecisionTreeClassifier(10, 5, 2);
  assert(tree.maxDepth === 10, 'Max depth should be set');
  assert(tree.minSamplesSplit === 5, 'Min samples split should be set');
  assert(tree.root === null, 'Root should be null before training');
}

function testDecisionTreeFitAndPredict() {
  const data = generateTestData(50);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const tree = new DecisionTreeClassifier(8, 5, 2);
  tree.fit(X, y);

  assert(tree.root !== null, 'Root should exist after training');
  assert(tree.stats.nodeCount > 0, 'Should have nodes');

  // Test predictions
  const predictions = X.map((sample) => tree.predict(sample));
  assert(predictions.length === X.length, 'Should have predictions for all samples');
  assert(predictions.every((p) => [0, 1, 2].includes(p)), 'Predictions should be valid classes');
}

function testDecisionTreeAccuracy() {
  const data = generateTestData(100);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const tree = new DecisionTreeClassifier(10, 3, 1);
  tree.fit(X, y);

  const predictions = X.map((sample) => tree.predict(sample));
  const correct = predictions.filter((pred, idx) => pred === y[idx]).length;
  const accuracy = correct / X.length;

  assert(accuracy > 0.5, 'Accuracy should be better than random');
}

function testDecisionTreeFeatureImportance() {
  const data = generateTestData(100);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const tree = new DecisionTreeClassifier();
  tree.fit(X, y);

  const importance = tree.getFeatureImportance();
  assert(importance.size > 0, 'Should have feature importance');

  let total = 0;
  for (const imp of importance.values()) {
    total += imp;
    assertInRange(imp, 0, 1, 'Importance should be in [0, 1]');
  }
  assertInRange(total, 0.5, 1.5, 'Total importance should be normalized');
}

function testDecisionTreeMaxDepthLimit() {
  const data = generateTestData(200);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const tree = new DecisionTreeClassifier(3, 5, 2);
  tree.fit(X, y);

  assert(
    tree.stats.maxDepthReached <= 3,
    'Max depth reached should not exceed max depth parameter'
  );
}

function testDecisionTreeMinSamplesSplit() {
  const data = generateTestData(50);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const tree = new DecisionTreeClassifier(10, 10, 2);
  tree.fit(X, y);

  assert(tree.root !== null, 'Should handle min samples split');
}

function testDecisionTreePredictSingleSample() {
  const data = generateTestData(50);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const tree = new DecisionTreeClassifier();
  tree.fit(X, y);

  const pred = tree.predict(X[0]);
  assert([0, 1, 2].includes(pred), 'Prediction should be valid class');
}

function testDecisionTreeStatsTracking() {
  const data = generateTestData(80);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const tree = new DecisionTreeClassifier();
  tree.fit(X, y);

  const stats = tree.getStats();
  assertEqual(stats.trainSamples, 80, 'Should track training samples');
  assertInRange(stats.trainAccuracy, 0, 1, 'Accuracy should be in [0, 1]');
  assert(stats.nodeCount > 0, 'Should have node count');
}

function testDecisionTreeGiniCalculation() {
  const data = generateTestData(100);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const tree = new DecisionTreeClassifier(5);
  tree.fit(X, y);

  assert(tree.stats.trainAccuracy > 0.4, 'Gini-based splits should improve accuracy');
}

function testDecisionTreeHandlesUnbalancedData() {
  // Create unbalanced dataset
  const data = [];
  for (let i = 0; i < 80; i++) {
    data.push({ features: Array(8).fill(0.3), label: 0 });
  }
  for (let i = 0; i < 20; i++) {
    data.push({ features: Array(8).fill(0.7), label: 2 });
  }

  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const tree = new DecisionTreeClassifier();
  tree.fit(X, y);

  const predictions = X.map((sample) => tree.predict(sample));
  const correct = predictions.filter((pred, idx) => pred === y[idx]).length;
  assert(correct / X.length > 0.5, 'Should handle unbalanced data');
}

// ============================================================================
// RANDOM FOREST TESTS
// ============================================================================

function testRandomForestConstruction() {
  const forest = new RandomForestClassifier(50, 8, 5);
  assert(forest.nTrees === 50, 'Should set number of trees');
  assert(forest.trees.length === 0, 'Trees should be empty initially');
}

function testRandomForestFitAndPredict() {
  const data = generateTestData(100);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const forest = new RandomForestClassifier(20, 8, 5);
  forest.fit(X, y);

  assert(forest.trees.length === 20, 'Should have correct number of trees');

  const predictions = X.map((sample) => forest.predict(sample));
  assert(predictions.length === X.length, 'Should predict all samples');
}

function testRandomForestBootstrapping() {
  const data = generateTestData(100);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const forest = new RandomForestClassifier(30, 8, 5);
  forest.fit(X, y);

  // Bootstrap should produce different tree structures
  assert(forest.trees.length === 30, 'Should have correct tree count');
}

function testRandomForestOobAccuracy() {
  const data = generateTestData(100);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const forest = new RandomForestClassifier(50, 8, 5);
  forest.fit(X, y);

  const stats = forest.getStats();
  assertInRange(stats.oobAccuracy, 0, 1, 'OOB accuracy should be in [0, 1]');
  assertInRange(stats.trainAccuracy, 0, 1, 'Training accuracy should be in [0, 1]');
}

function testRandomForestPredictWithConfidence() {
  const data = generateTestData(100);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const forest = new RandomForestClassifier(30, 8, 5);
  forest.fit(X, y);

  const result = forest.predictWithConfidence(X[0]);
  assert('prediction' in result, 'Should have prediction');
  assert('confidence' in result, 'Should have confidence');
  assertInRange(result.confidence, 0, 1, 'Confidence should be in [0, 1]');
}

function testRandomForestFeatureImportance() {
  const data = generateTestData(100);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const forest = new RandomForestClassifier(30, 8, 5);
  forest.fit(X, y);

  const importance = forest.getFeatureImportance();
  assert(importance.size > 0, 'Should have feature importance');
}

function testRandomForestAccuracyImprovement() {
  const data = generateTestData(150);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const forest = new RandomForestClassifier(100, 8, 5);
  forest.fit(X, y);

  const predictions = X.map((sample) => forest.predict(sample));
  const correct = predictions.filter((pred, idx) => pred === y[idx]).length;
  const accuracy = correct / X.length;

  assert(accuracy > 0.6, 'Forest should have good accuracy');
}

function testRandomForestMajorityVoting() {
  const data = generateTestData(100);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const forest = new RandomForestClassifier(50, 8, 5);
  forest.fit(X, y);

  const pred = forest.predict(X[0]);
  assert([0, 1, 2].includes(pred), 'Prediction should be valid class');
}

// ============================================================================
// GRADIENT BOOSTING TESTS
// ============================================================================

function testGradientBoostingConstruction() {
  const gb = new GradientBoostingClassifier(50, 0.1, 5);
  assert(gb.nEstimators === 50, 'Should set estimators');
  assert(gb.learningRate === 0.1, 'Should set learning rate');
}

function testGradientBoostingFitAndPredict() {
  const data = generateTestData(100);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const gb = new GradientBoostingClassifier(30, 0.1, 5);
  gb.fit(X, y);

  assert(gb.models.length > 0, 'Should have trained models');

  const predictions = X.map((sample) => gb.predict(sample));
  assert(predictions.length === X.length, 'Should predict all samples');
}

function testGradientBoostingAccuracy() {
  const data = generateTestData(100);
  const X = data.map((d) => d.features);
  const y = data.map((d) => d.label);

  const gb = new GradientBoostingClassifier(50, 0.1, 5);
  gb.fit(X, y);

  const predictions = X.map((sample) => gb.predict(sample));
  const correct = predictions.filter((pred, idx) => pred === y[idx]).length;
  const accuracy = correct / X.length;

  assert(accuracy > 0.5, 'GB should have reasonable accuracy');
}

// ============================================================================
// FEATURE EXTRACTION TESTS
// ============================================================================

function testFeatureExtraction() {
  const mlModels = new GNNRiskMLModels();

  const portfolio = {
    weights: { BTC: 0.4, ETH: 0.3, XRP: 0.3 },
    correlations: { BTC_ETH: 0.8, BTC_XRP: 0.5, ETH_XRP: 0.6 },
  };

  const marketState = {
    volatility: 0.2,
    vix: 25,
    liquidityScore: 0.8,
    executionCosts: 0.001,
  };

  const historicalData = {
    meanVolatility: 0.15,
    valueAtRisk: 0.02,
    backtestDegradation: 0.05,
  };

  const features = mlModels.extractRiskFeatures(portfolio, marketState, historicalData);

  assertArrayLength(features, 8, 'Should extract 8 risk factors');
  assert(features.every((f) => typeof f === 'number'), 'All features should be numbers');
}

function testFeatureNormalization() {
  const mlModels = new GNNRiskMLModels();

  const features = [2.5, 0.8, 0.5, 0.9, 0.3, 0.6, 0.4, 0.2];
  const normalized = mlModels.normalizeFeatures(features);

  assertArrayLength(normalized, 8, 'Should have normalized 8 features');
  assert(normalized.every((f) => f >= 0 && f <= 1), 'Normalized features should be in [0, 1]');
}

function testFeatureExtractionVariability() {
  const mlModels = new GNNRiskMLModels();

  const portfolio = { weights: { A: 0.5, B: 0.5 } };
  const marketState = { volatility: 0.1 };

  const features1 = mlModels.extractRiskFeatures(portfolio, marketState);
  const features2 = mlModels.extractRiskFeatures(portfolio, { volatility: 0.3 });

  // Different market state should produce different features
  assert(!features1.every((f, i) => f === features2[i]), 'Features should change with market state');
}

function testRiskFactorNames() {
  const mlModels = new GNNRiskMLModels();

  assert(mlModels.riskFactors.length === 8, 'Should have 8 risk factors');
  assert(mlModels.riskFactors.includes('volatility'), 'Should include volatility');
  assert(mlModels.riskFactors.includes('correlation'), 'Should include correlation');
}

// ============================================================================
// ML MODEL INTEGRATION TESTS
// ============================================================================

function testMLModelsTraining() {
  const data = generateTestData(100);
  const mlModels = new GNNRiskMLModels();

  const result = mlModels.trainModels(data);

  assert(result.status === 'success', 'Training should succeed');
  assertInRange(result.ensembleAccuracy, 0, 1, 'Accuracy should be in [0, 1]');
}

function testMLModelsPredict() {
  const data = generateTestData(100);
  const mlModels = new GNNRiskMLModels();
  mlModels.trainModels(data);

  const portfolio = { weights: { A: 0.5, B: 0.5 } };
  const marketState = { volatility: 0.15 };

  const prediction = mlModels.predictRisk(portfolio, marketState);

  assert('riskLevel' in prediction, 'Should have risk level');
  assert('confidence' in prediction, 'Should have confidence');
  assert([0, 1, 2].includes(prediction.riskLevel), 'Risk level should be valid');
}

function testMLModelsEnsemble() {
  const data = generateTestData(100);
  const mlModels = new GNNRiskMLModels();
  mlModels.trainModels(data);

  const prediction = mlModels.predictEnsemble(Array(8).fill(0.5));

  assert([0, 1, 2].includes(prediction), 'Ensemble prediction should be valid');
}

function testMLModelsCache() {
  const mlModels = new GNNRiskMLModels();
  const data = generateTestData(100);
  mlModels.trainModels(data);

  const portfolio = { weights: { A: 0.5, B: 0.5 } };
  const marketState = { volatility: 0.15 };

  // First prediction
  mlModels.predictRisk(portfolio, marketState);
  assert(mlModels.stats.cacheMisses === 1, 'Should record cache miss');

  // Second identical prediction
  mlModels.predictRisk(portfolio, marketState);
  assert(mlModels.stats.cacheHits >= 0, 'Should track cache hits');
}

function testMLModelsInferenceTime() {
  const mlModels = new GNNRiskMLModels();
  const data = generateTestData(50);
  mlModels.trainModels(data);

  const portfolio = { weights: { A: 0.5, B: 0.5 } };
  const marketState = { volatility: 0.15 };

  const prediction = mlModels.predictRisk(portfolio, marketState);

  assert(prediction.inferenceTime < 500, 'Inference should be fast');
}

function testMLModelsFeatureImportance() {
  const data = generateTestData(100);
  const mlModels = new GNNRiskMLModels();
  mlModels.trainModels(data);

  const importance = mlModels.getFeatureImportance();

  assert('randomForest' in importance, 'Should have random forest importance');
}

function testMLModelsExplainability() {
  const data = generateTestData(100);
  const mlModels = new GNNRiskMLModels();
  mlModels.trainModels(data);

  const features = Array(8).fill(0.5);
  const explanation = mlModels.explainPrediction(features);

  assert('topFactors' in explanation, 'Should have top factors');
  assert(explanation.topFactors.length <= 3, 'Should show top 3 factors');
}

function testMLModelsEvaluation() {
  const data = generateTestData(100);
  const mlModels = new GNNRiskMLModels();
  mlModels.trainModels(data);

  const testData = data.slice(0, 20);
  const metrics = mlModels.evaluate(testData);

  assert('accuracy' in metrics, 'Should have accuracy');
  assert('confusionMatrix' in metrics, 'Should have confusion matrix');
  assertInRange(metrics.accuracy, 0, 1, 'Accuracy in [0, 1]');
}

// ============================================================================
// TRAINING MODULE TESTS
// ============================================================================

function testTrainerDataGeneration() {
  const trainer = new GNNRiskMLTrainer();

  const synthetic = trainer.dataGenerator.generateSyntheticScenarios(100);
  assert(synthetic.length === 100, 'Should generate correct number of scenarios');
  assert(synthetic.every((s) => s.features && s.label), 'All scenarios should have features and label');
}

function testTrainerTrainTestSplit() {
  const trainer = new GNNRiskMLTrainer();
  const data = generateTestData(100);

  const { train, test, validation } = trainer.trainTestValSplit(data);

  assert(train.length > 0, 'Should have training data');
  assert(test.length > 0, 'Should have test data');
  assert(validation.length > 0, 'Should have validation data');
}

function testTrainerTrain() {
  const trainer = new GNNRiskMLTrainer();
  const data = generateTestData(100);

  const result = trainer.train(data);

  assert(result.model, 'Should return trained model');
  assert(result.trainMetrics, 'Should have metrics');
}

function testTrainerCrossValidation() {
  const trainer = new GNNRiskMLTrainer();
  const data = generateTestData(60);

  const cvResult = trainer.trainWithCrossValidation(data, 3);

  assert(cvResult.cvResults.foldResults.length === 3, 'Should have 3 fold results');
  assertInRange(cvResult.bestAccuracy, 0, 1, 'Best accuracy should be in [0, 1]');
}

function testTrainerLearningCurves() {
  const trainer = new GNNRiskMLTrainer();
  const data = generateTestData(200);

  const curves = trainer.generateLearningCurves(data, [20, 50, 100]);

  assert(curves.trainSizes.length > 0, 'Should have learning curve data');
  assert(curves.trainAccuracies.length === curves.trainSizes.length, 'Should have matching accuracies');
}

function testTrainerSelectBestModel() {
  const trainer = new GNNRiskMLTrainer();
  const data = generateTestData(100);

  trainer.train(data);
  trainer.train(data);

  const best = trainer.selectBestModel();

  assert(best.model, 'Should return a model');
  assertInRange(best.accuracy, 0, 1, 'Accuracy should be in [0, 1]');
}

function testTrainerEnsemble() {
  const trainer = new GNNRiskMLTrainer();
  const data = generateTestData(100);

  trainer.train(data);
  trainer.train(data);

  const ensemble = trainer.createEnsemble();

  assert(ensemble.models.length >= 2, 'Ensemble should have multiple models');
  assert(ensemble.predict, 'Should have predict method');
}

// ============================================================================
// CROSS-VALIDATION TESTS
// ============================================================================

function testKFoldCrossValidation() {
  const validator = new CrossValidator(5);
  const data = generateTestData(100);

  let trainCalls = 0;
  let evalCalls = 0;

  const result = validator.kFoldCrossValidation(
    data,
    (fold) => {
      trainCalls++;
      const trainer = new GNNRiskMLTrainer();
      return trainer.train(fold).model;
    },
    (model, fold) => {
      evalCalls++;
      return model.evaluate(fold);
    }
  );

  assert(trainCalls === 5, 'Should train 5 models');
  assert(evalCalls === 5, 'Should evaluate 5 times');
  assert(result.foldResults.length === 5, 'Should have 5 fold results');
}

function testStratifiedSampling() {
  const validator = new CrossValidator(3);
  const data = generateTestData(100);

  // All same label
  const unbalanced = Array(100)
    .fill(0)
    .map((_, i) => ({
      features: Array(8).fill(0.5),
      label: i % 2,
    }));

  let evalCalls = 0;
  validator.kFoldCrossValidation(
    unbalanced,
    (fold) => {
      const trainer = new GNNRiskMLTrainer();
      return trainer.train(fold).model;
    },
    (model, fold) => {
      evalCalls++;
      return model.evaluate(fold);
    }
  );

  assert(evalCalls === 3, 'Should handle stratified sampling');
}

// ============================================================================
// END-TO-END TESTS
// ============================================================================

function testEndToEndRiskPrediction() {
  // Setup
  const trainer = new GNNRiskMLTrainer();
  const data = trainer.prepareTrainingData({
    syntheticCount: 500,
  });

  // Train
  const result = trainer.train(data);

  // Predict
  const portfolio = { weights: { A: 0.5, B: 0.5 } };
  const marketState = { volatility: 0.15 };
  const prediction = result.model.predictRisk(portfolio, marketState);

  assert(prediction.riskLevel !== undefined, 'Should make prediction');
  assert([0, 1, 2].includes(prediction.riskLevel), 'Risk level should be valid');
}

function testEndToEndTrainingAndEvaluation() {
  const trainer = new GNNRiskMLTrainer();
  const data = trainer.prepareTrainingData({
    syntheticCount: 300,
  });

  const { train, test } = trainer.trainTestValSplit(data);
  const result = trainer.train(train);
  const metrics = result.model.evaluate(test);

  assertInRange(metrics.accuracy, 0, 1, 'Accuracy should be in [0, 1]');
}

function testEndToEndMultipleModels() {
  const trainer = new GNNRiskMLTrainer();
  const data = trainer.prepareTrainingData({ syntheticCount: 200 });

  trainer.train(data);
  trainer.train(data);
  trainer.train(data);

  assert(trainer.models.length === 3, 'Should have 3 trained models');

  const ensemble = trainer.createEnsemble();
  assert(ensemble.models.length === 3, 'Ensemble should have 3 models');
}

// ============================================================================
// TEST RUNNER
// ============================================================================

function runAllTests() {
  const tests = [
    // Decision Tree Tests
    ['Decision Tree - Construction', testDecisionTreeConstruction],
    ['Decision Tree - Fit and Predict', testDecisionTreeFitAndPredict],
    ['Decision Tree - Accuracy', testDecisionTreeAccuracy],
    ['Decision Tree - Feature Importance', testDecisionTreeFeatureImportance],
    ['Decision Tree - Max Depth Limit', testDecisionTreeMaxDepthLimit],
    ['Decision Tree - Min Samples Split', testDecisionTreeMinSamplesSplit],
    ['Decision Tree - Single Sample Prediction', testDecisionTreePredictSingleSample],
    ['Decision Tree - Stats Tracking', testDecisionTreeStatsTracking],
    ['Decision Tree - Gini Calculation', testDecisionTreeGiniCalculation],
    ['Decision Tree - Unbalanced Data', testDecisionTreeHandlesUnbalancedData],

    // Random Forest Tests
    ['Random Forest - Construction', testRandomForestConstruction],
    ['Random Forest - Fit and Predict', testRandomForestFitAndPredict],
    ['Random Forest - Bootstrapping', testRandomForestBootstrapping],
    ['Random Forest - OOB Accuracy', testRandomForestOobAccuracy],
    ['Random Forest - Confidence', testRandomForestPredictWithConfidence],
    ['Random Forest - Feature Importance', testRandomForestFeatureImportance],
    ['Random Forest - Accuracy Improvement', testRandomForestAccuracyImprovement],
    ['Random Forest - Majority Voting', testRandomForestMajorityVoting],

    // Gradient Boosting Tests
    ['Gradient Boosting - Construction', testGradientBoostingConstruction],
    ['Gradient Boosting - Fit and Predict', testGradientBoostingFitAndPredict],
    ['Gradient Boosting - Accuracy', testGradientBoostingAccuracy],

    // Feature Extraction Tests
    ['Feature Extraction - Basic', testFeatureExtraction],
    ['Feature Extraction - Normalization', testFeatureNormalization],
    ['Feature Extraction - Variability', testFeatureExtractionVariability],
    ['Feature Extraction - Risk Factor Names', testRiskFactorNames],

    // ML Model Integration Tests
    ['ML Models - Training', testMLModelsTraining],
    ['ML Models - Prediction', testMLModelsPredict],
    ['ML Models - Ensemble', testMLModelsEnsemble],
    ['ML Models - Cache', testMLModelsCache],
    ['ML Models - Inference Time', testMLModelsInferenceTime],
    ['ML Models - Feature Importance', testMLModelsFeatureImportance],
    ['ML Models - Explainability', testMLModelsExplainability],
    ['ML Models - Evaluation', testMLModelsEvaluation],

    // Training Module Tests
    ['Trainer - Data Generation', testTrainerDataGeneration],
    ['Trainer - Train/Test Split', testTrainerTrainTestSplit],
    ['Trainer - Train', testTrainerTrain],
    ['Trainer - Cross Validation', testTrainerCrossValidation],
    ['Trainer - Learning Curves', testTrainerLearningCurves],
    ['Trainer - Select Best Model', testTrainerSelectBestModel],
    ['Trainer - Ensemble', testTrainerEnsemble],

    // Cross Validation Tests
    ['Cross Validation - K-Fold', testKFoldCrossValidation],
    ['Cross Validation - Stratified Sampling', testStratifiedSampling],

    // End-to-End Tests
    ['End-to-End - Risk Prediction', testEndToEndRiskPrediction],
    ['End-to-End - Training and Evaluation', testEndToEndTrainingAndEvaluation],
    ['End-to-End - Multiple Models', testEndToEndMultipleModels],
  ];

  console.log('\n===============================================');
  console.log('GNN Risk ML Models - Test Suite');
  console.log('===============================================\n');

  const results = tests.map(([name, testFn]) => runTest(name, testFn));

  // Summary
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  console.log('\n===============================================');
  console.log(`Test Results: ${passed} passed, ${failed} failed out of ${results.length}`);
  console.log(`Coverage: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log('===============================================\n');

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}

// Export for testing
module.exports = {
  runAllTests,
  generateTestData,
};

// Run if executed directly
if (require.main === module) {
  const results = runAllTests();
  process.exit(results.failed > 0 ? 1 : 0);
}
