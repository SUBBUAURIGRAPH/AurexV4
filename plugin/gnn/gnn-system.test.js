/**
 * GNN System Comprehensive Test Suite
 * Tests for all GNN components including model, accuracy, performance, and prediction engines
 *
 * Test Coverage:
 * - GNN Prediction Model (training, prediction, accuracy)
 * - Accuracy Calculator (confusion matrix, metrics)
 * - Performance Metrics (Sharpe, Sortino, Calmar ratios)
 * - Graph Builder (correlation, adjacency, communities)
 * - Prediction Engine (signal aggregation, confidence)
 * - Technical Processor (feature extraction, indicators)
 * - Fundamental Analyzer (health score, signals)
 * - Integration tests
 */

const assert = require('assert');
const { GNNPredictionModel } = require('./gnn-prediction-model');
const { GNNAccuracyCalculator } = require('./gnn-accuracy-calculator');
const { PerformanceMetricsCalculator } = require('./performance-metrics-calculator');
const { GraphBuilder } = require('./graph-builder');
const { PredictionEngine } = require('./prediction-engine');
const { TechnicalDataProcessor } = require('./technical-data-processor');
const { FundamentalAnalyzer } = require('./fundamental-analyzer');

// Test data generators
function generateMockPriceData(count = 200) {
  const data = [];
  let price = 100;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2;
    price = price * (1 + change / 100);

    data.push({
      open: price * 0.98,
      high: price * 1.02,
      low: price * 0.96,
      close: price,
      volume: Math.floor(Math.random() * 1000000) + 500000
    });
  }

  return data;
}

function generateMockReturns(count = 200) {
  const returns = [];
  for (let i = 0; i < count; i++) {
    returns.push((Math.random() - 0.48) * 0.02);
  }
  return returns;
}

function generateMockFundamentals() {
  return {
    pe_ratio: 15 + Math.random() * 10,
    pb_ratio: 1.5 + Math.random() * 2,
    debt_to_equity: 0.5 + Math.random() * 1,
    current_ratio: 1.5 + Math.random() * 1,
    roe: 15 + Math.random() * 10,
    roa: 8 + Math.random() * 5,
    dividend_yield: 2 + Math.random() * 2,
    beta: 1.0 + Math.random() * 0.5,
    market_cap: 50000000000,
    free_cash_flow: 5000000000,
    gross_margin: 40 + Math.random() * 20,
    operating_margin: 15 + Math.random() * 10
  };
}

// Test Suites
describe('GNN Prediction Model Tests', () => {
  let model;

  before(() => {
    model = new GNNPredictionModel({
      logger: { info: () => {}, error: () => {} }
    });
  });

  test('should initialize model with correct dimensions', () => {
    assert.equal(model.inputDim, 58, 'Input dimension should be 58');
    assert.equal(model.hiddenDim, 32, 'Hidden dimension should be 32');
    assert.equal(model.outputDim, 1, 'Output dimension should be 1');
  });

  test('should generate valid predictions', () => {
    const features = new Array(58).fill(0.5);
    const neighbors = [
      { symbol: 'AAPL', features: new Array(58).fill(0.5), weight: 0.8 },
      { symbol: 'MSFT', features: new Array(58).fill(0.5), weight: 0.6 }
    ];

    const prediction = model.predict(features, neighbors);

    assert(prediction.probability >= 0 && prediction.probability <= 1, 'Probability should be between 0 and 1');
    assert(['UP', 'DOWN'].includes(prediction.direction), 'Direction should be UP or DOWN');
    assert(prediction.confidence >= 0 && prediction.confidence <= 1, 'Confidence should be between 0 and 1');
  });

  test('should handle missing neighbors', () => {
    const features = new Array(58).fill(0.5);
    const prediction = model.predict(features, []);

    assert(prediction.probability !== undefined, 'Should generate prediction without neighbors');
    assert(['UP', 'DOWN'].includes(prediction.direction), 'Should have valid direction');
  });

  test('should calculate loss correctly', () => {
    const probability = 0.7;
    const target = 1;
    const loss = model.binaryCrossEntropy(probability, target);

    assert(loss >= 0 && loss <= 10, 'Loss should be in valid range');
    assert(isFinite(loss), 'Loss should be finite');
  });

  test('should apply activations correctly', () => {
    const sigmoid = model.sigmoid(0);
    assert.equal(sigmoid, 0.5, 'Sigmoid(0) should be 0.5');

    const relu = model.relu([-1, 0, 1]);
    assert.deepEqual(relu, [0, 0, 1], 'ReLU should clip negatives');

    const softmax = model.softmax([1, 2, 3]);
    const sum = softmax.reduce((a, b) => a + b);
    assert(Math.abs(sum - 1.0) < 0.0001, 'Softmax should sum to 1');
  });

  test('should train model', async () => {
    const trainingData = [];
    for (let i = 0; i < 50; i++) {
      trainingData.push({
        features: new Array(58).fill(Math.random()),
        neighbors: [],
        label: Math.random() > 0.5 ? 1 : 0
      });
    }

    const result = await model.train(trainingData, 10);

    assert(result.success, 'Training should succeed');
    assert(result.accuracy >= 0 && result.accuracy <= 1, 'Accuracy should be between 0 and 1');
    assert(result.epochs === 10, 'Should complete specified epochs');
  });

  test('should save and load weights', () => {
    const weights = model.saveWeights();

    assert(weights.W1, 'Should have W1');
    assert(weights.b1, 'Should have b1');
    assert(weights.W_attention, 'Should have W_attention');
    assert(weights.W2, 'Should have W2');
    assert(weights.b2, 'Should have b2');

    const modelCopy = new GNNPredictionModel();
    modelCopy.loadWeights(weights);

    assert.equal(modelCopy.accuracy, weights.accuracy, 'Weights should be copied correctly');
  });
});

describe('GNN Accuracy Calculator Tests', () => {
  let calculator;

  before(() => {
    calculator = new GNNAccuracyCalculator({
      logger: { info: () => {}, error: () => {} }
    });
  });

  test('should build confusion matrix', () => {
    const predictions = [
      { direction: 'UP', probability: 0.8, confidence: 0.8 },
      { direction: 'UP', probability: 0.7, confidence: 0.7 },
      { direction: 'DOWN', probability: 0.3, confidence: 0.7 },
      { direction: 'DOWN', probability: 0.2, confidence: 0.8 }
    ];

    const outcomes = [
      { direction: 'UP' },
      { direction: 'DOWN' },
      { direction: 'DOWN' },
      { direction: 'DOWN' }
    ];

    const cm = calculator.buildConfusionMatrix(predictions, outcomes);

    assert(cm.tp >= 0, 'TP should be non-negative');
    assert(cm.tn >= 0, 'TN should be non-negative');
    assert(cm.fp >= 0, 'FP should be non-negative');
    assert(cm.fn >= 0, 'FN should be non-negative');
    assert.equal(cm.tp + cm.tn + cm.fp + cm.fn, 4, 'Total should equal prediction count');
  });

  test('should calculate accuracy metrics', () => {
    const cm = { tp: 80, tn: 70, fp: 20, fn: 30 };
    const metrics = calculator.calculateBasicMetrics(cm);

    assert(metrics.accuracy >= 0 && metrics.accuracy <= 100, 'Accuracy should be 0-100%');
    assert(metrics.precision >= 0 && metrics.precision <= 100, 'Precision should be 0-100%');
    assert(metrics.recall >= 0 && metrics.recall <= 100, 'Recall should be 0-100%');
    assert(metrics.f1Score >= 0 && metrics.f1Score <= 100, 'F1 should be 0-100%');
  });

  test('should calculate directional accuracy', () => {
    const predictions = Array(100).fill({ direction: 'UP', probability: 0.7, confidence: 0.7 });
    const outcomes = Array(100).fill({ direction: 'UP' });

    const accuracy = calculator.calculateDirectionalAccuracy(predictions, outcomes);

    assert.equal(accuracy.hitRate, 100, 'Hit rate should be 100 for perfect prediction');
    assert.equal(accuracy.correctUp, 100, 'All should be correct up');
  });

  test('should calculate ROC-AUC', () => {
    const predictions = [
      { direction: 'UP', probability: 0.9, confidence: 0.9 },
      { direction: 'DOWN', probability: 0.1, confidence: 0.9 },
      { direction: 'UP', probability: 0.8, confidence: 0.8 },
      { direction: 'DOWN', probability: 0.2, confidence: 0.8 }
    ];

    const outcomes = [
      { direction: 'UP' },
      { direction: 'DOWN' },
      { direction: 'UP' },
      { direction: 'DOWN' }
    ];

    const auc = calculator.calculateROCAUC(predictions, outcomes);

    assert(auc >= 0 && auc <= 1, 'AUC should be between 0 and 1');
  });

  test('should validate predictions', () => {
    const predictions = Array(50).fill({ direction: 'UP', probability: 0.7, confidence: 0.7 });
    const outcomes = Array(50).fill({ direction: 'UP', actualPrice: 100, expectedPrice: 100 });

    const result = calculator.validatePredictions(predictions, outcomes);

    assert(result.confusionMatrix, 'Should have confusion matrix');
    assert(result.basicMetrics, 'Should have basic metrics');
    assert(result.directionalAccuracy, 'Should have directional accuracy');
    assert(result.rocAuc >= 0, 'Should have ROC-AUC');
  });

  test('should classify quality tier', () => {
    const metrics = {
      directionalAccuracy: { hitRate: 75 },
      basicMetrics: {},
      priceAccuracy: {},
      rocAuc: 0.8,
      advancedMetrics: {}
    };

    const tier = calculator.getQualityTier(metrics);

    assert(['EXCELLENT', 'VERY_GOOD', 'GOOD', 'FAIR', 'NEUTRAL', 'POOR'].includes(tier), 'Should return valid quality tier');
  });
});

describe('Performance Metrics Calculator Tests', () => {
  let calculator;

  before(() => {
    calculator = new PerformanceMetricsCalculator({
      logger: { info: () => {}, error: () => {} }
    });
  });

  test('should calculate total return', () => {
    const prices = [100, 110, 105, 120];
    const totalReturn = calculator.calculateTotalReturn(prices);

    assert.equal(totalReturn, 0.2, 'Total return should be 20%');
  });

  test('should calculate annualized return', () => {
    const returns = Array(252).fill(0.0005);
    const annualized = calculator.calculateAnnualizedReturn(returns);

    assert(annualized > 0, 'Annualized return should be positive for positive daily returns');
  });

  test('should calculate volatility', () => {
    const returns = [0.01, -0.01, 0.02, -0.02, 0];
    const volatility = calculator.calculateVolatility(returns);

    assert(volatility > 0, 'Volatility should be positive');
    assert(isFinite(volatility), 'Volatility should be finite');
  });

  test('should calculate Sharpe ratio', () => {
    const returns = Array(252).fill(0.001);
    const sharpeRatio = calculator.calculateSharpeRatio(returns, 0.02);

    assert(isFinite(sharpeRatio), 'Sharpe ratio should be finite');
  });

  test('should calculate maximum drawdown', () => {
    const prices = [100, 110, 90, 95, 120, 100];
    const maxDrawdown = calculator.calculateMaxDrawdown(prices);

    assert(maxDrawdown > 0 && maxDrawdown < 1, 'Max drawdown should be between 0 and 1');
  });

  test('should calculate win rate', () => {
    const returns = [0.01, -0.01, 0.02, -0.02, 0.01];
    const winRate = calculator.calculateWinRate(returns);

    assert.equal(winRate, 60, 'Win rate should be 60%');
  });

  test('should calculate profit factor', () => {
    const returns = [0.01, 0.02, -0.01, -0.005];
    const profitFactor = calculator.calculateProfitFactor(returns);

    assert(profitFactor > 0, 'Profit factor should be positive');
  });

  test('should calculate comprehensive metrics', () => {
    const returns = generateMockReturns(252);
    const prices = generateMockPriceData(252);

    const metrics = calculator.calculateMetrics(returns, prices);

    assert(metrics.returnMetrics, 'Should have return metrics');
    assert(metrics.riskMetrics, 'Should have risk metrics');
    assert(metrics.riskAdjustedMetrics, 'Should have risk-adjusted metrics');
    assert(metrics.tradeMetrics, 'Should have trade metrics');
    assert(metrics.riskAdjustedMetrics.sharpeRatio >= 0, 'Sharpe ratio should be non-negative');
  });
});

describe('Graph Builder Tests', () => {
  let builder;

  before(() => {
    builder = new GraphBuilder({
      logger: { info: () => {}, error: () => {} },
      correlationThreshold: 0.5,
      maxNeighbors: 5
    });
  });

  test('should calculate Pearson correlation', () => {
    const series1 = [100, 110, 120, 130, 140];
    const series2 = [100, 110, 120, 130, 140];

    const correlation = builder.calculatePearsonCorrelation(series1, series2);

    assert(Math.abs(correlation - 1.0) < 0.1, 'Identical series should have high correlation');
  });

  test('should build correlation matrix', async () => {
    const stocks = [
      { symbol: 'AAPL', priceHistory: generateMockPriceData(100) },
      { symbol: 'MSFT', priceHistory: generateMockPriceData(100) },
      { symbol: 'GOOGL', priceHistory: generateMockPriceData(100) }
    ];

    await builder.buildGraph(stocks);

    assert(builder.correlationMatrix, 'Should have correlation matrix');
    assert.equal(builder.correlationMatrix.length, 3, 'Should have 3x3 matrix');
    assert.equal(builder.correlationMatrix[0][0], 1.0, 'Self-correlation should be 1.0');
  });

  test('should build adjacency matrix', () => {
    const correlationMatrix = [
      [1.0, 0.7, 0.3],
      [0.7, 1.0, 0.5],
      [0.3, 0.5, 1.0]
    ];

    const adjacency = builder.buildAdjacencyMatrix(correlationMatrix);

    assert(adjacency.length === 3, 'Should have correct dimensions');
    assert.equal(adjacency[0][0], 0, 'Self-loops should be 0');
  });

  test('should get neighbors', async () => {
    const stocks = [
      { symbol: 'AAPL', priceHistory: generateMockPriceData(100) },
      { symbol: 'MSFT', priceHistory: generateMockPriceData(100) }
    ];

    await builder.buildGraph(stocks);

    const neighbors = builder.getNeighbors('AAPL');

    assert(Array.isArray(neighbors), 'Should return array of neighbors');
  });

  test('should detect communities', async () => {
    const stocks = [
      { symbol: 'AAPL', priceHistory: generateMockPriceData(50) },
      { symbol: 'MSFT', priceHistory: generateMockPriceData(50) },
      { symbol: 'GOOGL', priceHistory: generateMockPriceData(50) }
    ];

    await builder.buildGraph(stocks);

    const communities = builder.detectCommunities();

    assert(Array.isArray(communities), 'Should return community assignments');
    assert.equal(communities.length, 3, 'Should have one community per node');
  });

  test('should calculate graph statistics', async () => {
    const stocks = [
      { symbol: 'AAPL', priceHistory: generateMockPriceData(100) },
      { symbol: 'MSFT', priceHistory: generateMockPriceData(100) }
    ];

    await builder.buildGraph(stocks);

    const stats = builder.graph.stats;

    assert(stats.nodeCount > 0, 'Should have nodes');
    assert(stats.avgCorrelation !== undefined, 'Should have average correlation');
  });
});

describe('Prediction Engine Tests', () => {
  let engine;
  let model, graph, fundamentals, technical;

  before(() => {
    model = new GNNPredictionModel({
      logger: { info: () => {}, error: () => {} }
    });

    graph = new GraphBuilder({
      logger: { info: () => {}, error: () => {} }
    });

    fundamentals = new FundamentalAnalyzer({
      logger: { info: () => {}, error: () => {} }
    });

    technical = new TechnicalDataProcessor({
      logger: { info: () => {}, error: () => {} }
    });

    engine = new PredictionEngine({
      logger: { info: () => {}, error: () => {} },
      gnnModel: model,
      graphBuilder: graph,
      fundamentalAnalyzer: fundamentals,
      technicalProcessor: technical
    });
  });

  test('should aggregate signals correctly', () => {
    const signal = engine.aggregateSignals(
      'UP',
      { direction: 'UP', strength: 0.7 },
      { direction: 'UP', strength: 0.6 },
      { direction: 'UP', strength: 0.5 }
    );

    assert(signal.signal > 0, 'Aggregated signal should be positive for UP signals');
    assert(signal.direction === 'UP', 'Direction should be UP');
  });

  test('should calculate confidence', () => {
    const confidence = engine.calculateConfidence(0.8, 0.7, 0.6, 5, 3);

    assert(confidence >= 0 && confidence <= 1, 'Confidence should be between 0 and 1');
  });

  test('should determine confidence level', () => {
    assert.equal(engine.getConfidenceLevel(0.9), 'VERY_HIGH', 'Should classify high confidence');
    assert.equal(engine.getConfidenceLevel(0.5), 'MEDIUM', 'Should classify medium confidence');
    assert.equal(engine.getConfidenceLevel(0.2), 'LOW', 'Should classify low confidence');
  });

  test('should generate recommendation', () => {
    const signal = { signal: 0.8, direction: 'UP', strength: 0.8 };
    const recommendation = engine.generateRecommendation(signal, 0.8);

    assert(recommendation.type, 'Should have recommendation type');
    assert(recommendation.action, 'Should have action');
    assert(recommendation.signalStrength >= 0, 'Should have signal strength');
  });

  test('should analyze batch predictions', () => {
    const predictions = [
      {
        symbol: 'AAPL',
        signals: { aggregated: { direction: 'UP' } },
        confidence: 0.8,
        gnnPrediction: { confidence: 0.8 }
      },
      {
        symbol: 'MSFT',
        signals: { aggregated: { direction: 'DOWN' } },
        confidence: 0.7,
        gnnPrediction: { confidence: 0.7 }
      },
      {
        symbol: 'GOOGL',
        signals: { aggregated: { direction: 'UP' } },
        confidence: 0.9,
        gnnPrediction: { confidence: 0.9 }
      }
    ];

    const analysis = engine.getBatchAnalysis(predictions);

    assert.equal(analysis.upSignals, 2, 'Should count UP signals');
    assert.equal(analysis.downSignals, 1, 'Should count DOWN signals');
    assert(analysis.consensus, 'Should determine consensus');
  });
});

describe('Technical Processor Tests', () => {
  let processor;

  before(() => {
    processor = new TechnicalDataProcessor({
      logger: { info: () => {}, error: () => {} }
    });
  });

  test('should calculate SMA', () => {
    const data = Array(20).fill(null).map((_, i) => ({
      close: 100 + i
    }));

    const sma = processor.calculateSMA(data, 5);

    assert(sma > 0, 'SMA should be positive');
  });

  test('should calculate EMA', () => {
    const data = Array(20).fill(null).map((_, i) => ({
      close: 100 + i * 0.5
    }));

    const ema = processor.calculateEMA(data, 5);

    assert(ema > 0, 'EMA should be positive');
  });

  test('should calculate RSI', () => {
    const data = generateMockPriceData(50);
    const rsi = processor.calculateRSI(data, 14);

    assert(rsi >= 0 && rsi <= 100, 'RSI should be between 0 and 100');
  });

  test('should calculate MACD', () => {
    const data = generateMockPriceData(50);
    const macd = processor.calculateMACD(data);

    assert(macd.macd !== undefined, 'Should have MACD');
    assert(macd.signal !== undefined, 'Should have signal');
    assert(macd.histogram !== undefined, 'Should have histogram');
  });

  test('should extract features', async () => {
    const data = generateMockPriceData(200);
    const features = await processor.extractFeatures(data);

    assert(features.close > 0, 'Should have close price');
    assert(features.rsi_14 >= 0, 'Should have RSI');
    assert(features.macd !== undefined, 'Should have MACD');
  });
});

describe('Fundamental Analyzer Tests', () => {
  let analyzer;

  before(() => {
    analyzer = new FundamentalAnalyzer({
      logger: { info: () => {}, error: () => {} }
    });
  });

  test('should normalize metrics', () => {
    const metrics = generateMockFundamentals();
    const normalized = analyzer.normalizeMetrics(metrics);

    for (const key in normalized) {
      assert(normalized[key] >= 0 && normalized[key] <= 1, `${key} should be between 0 and 1`);
    }
  });

  test('should calculate health score', () => {
    const metrics = generateMockFundamentals();
    const normalized = analyzer.normalizeMetrics(metrics);
    const score = analyzer.calculateHealthScore(normalized);

    assert(score >= 0 && score <= 100, 'Health score should be between 0 and 100');
  });

  test('should identify quality tier', () => {
    const tier = analyzer.identifyQualityTier(80);

    assert(['EXCELLENT', 'GOOD', 'AVERAGE', 'POOR', 'VERY_POOR'].includes(tier), 'Should return valid tier');
  });

  test('should extract GNN features', () => {
    const metrics = generateMockFundamentals();
    const features = analyzer.extractFeaturesForGNN(metrics);

    assert.equal(features.length, 58, 'Should have 58 dimensions');
    for (const feature of features) {
      assert(typeof feature === 'number', 'All features should be numbers');
    }
  });

  test('should generate signals', async () => {
    const metrics = generateMockFundamentals();
    const normalized = analyzer.normalizeMetrics(metrics);
    const score = analyzer.calculateHealthScore(normalized);
    const trends = {
      direction: 'UP',
      momentum: 10
    };

    const signal = analyzer.generateSignal(normalized, score, trends);

    assert(signal.strength >= -1 && signal.strength <= 1, 'Signal strength should be between -1 and 1');
    assert(['STRONG_BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG_SELL'].includes(signal.type), 'Should have valid signal type');
  });
});

describe('Integration Tests', () => {
  test('should handle complete prediction flow', async () => {
    const gnnModel = new GNNPredictionModel({
      logger: { info: () => {}, error: () => {} }
    });

    const graphBuilder = new GraphBuilder({
      logger: { info: () => {}, error: () => {} }
    });

    const fundamentalAnalyzer = new FundamentalAnalyzer({
      logger: { info: () => {}, error: () => {} }
    });

    const technicalProcessor = new TechnicalDataProcessor({
      logger: { info: () => {}, error: () => {} }
    });

    const predictionEngine = new PredictionEngine({
      logger: { info: () => {}, error: () => {} },
      gnnModel: gnnModel,
      graphBuilder: graphBuilder,
      fundamentalAnalyzer: fundamentalAnalyzer,
      technicalProcessor: technicalProcessor
    });

    const ohlcvData = generateMockPriceData(200);
    const fundamentals = generateMockFundamentals();

    // This should not throw
    assert.doesNotThrow(() => {
      predictionEngine.generatePrediction('AAPL', ohlcvData, fundamentals);
    }, 'Complete prediction flow should not throw');
  });

  test('should validate predictions end-to-end', () => {
    const calculator = new GNNAccuracyCalculator({
      logger: { info: () => {}, error: () => {} }
    });

    const predictions = Array(50).fill({
      direction: 'UP',
      probability: 0.7,
      confidence: 0.7
    });

    const outcomes = Array(50).fill({
      direction: 'UP',
      actualPrice: 100,
      expectedPrice: 100
    });

    const result = calculator.validatePredictions(predictions, outcomes);

    assert(result.basicMetrics.accuracy === 100, 'Perfect predictions should have 100% accuracy');
  });

  test('should calculate end-to-end performance metrics', () => {
    const calculator = new PerformanceMetricsCalculator({
      logger: { info: () => {}, error: () => {} }
    });

    const returns = generateMockReturns(252);
    const prices = generateMockPriceData(252);

    const metrics = calculator.calculateMetrics(returns, prices);

    assert(metrics.returnMetrics, 'Should have return metrics');
    assert(metrics.riskAdjustedMetrics.sharpeRatio !== undefined, 'Should have Sharpe ratio');
    assert(metrics.tradeMetrics.winRate >= 0, 'Should have win rate');
  });
});

// Test runner
function runTests() {
  console.log('🧪 Running GNN System Comprehensive Test Suite...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  const suites = [
    { name: 'GNN Prediction Model', tests: globalThis.tests?.gnnModel || [] },
    { name: 'Accuracy Calculator', tests: globalThis.tests?.accuracy || [] },
    { name: 'Performance Metrics', tests: globalThis.tests?.performance || [] },
    { name: 'Graph Builder', tests: globalThis.tests?.graph || [] },
    { name: 'Prediction Engine', tests: globalThis.tests?.engine || [] },
    { name: 'Technical Processor', tests: globalThis.tests?.technical || [] },
    { name: 'Fundamental Analyzer', tests: globalThis.tests?.fundamental || [] },
    { name: 'Integration', tests: globalThis.tests?.integration || [] }
  ];

  console.log(`✅ All test suites defined. Total test cases: ${suites.reduce((sum, s) => sum + s.tests.length, 0)}\n`);

  return { testsPassed, testsFailed };
}

// Export
module.exports = {
  runTests,
  generateMockPriceData,
  generateMockReturns,
  generateMockFundamentals
};
