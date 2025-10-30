# GNN Prediction Algorithm Architecture
## Graph Neural Networks for Stock Price Prediction with Backtesting Integration

**Date**: October 30, 2025
**Status**: Implementation Starting
**Scope**: Complete GNN system with accuracy metrics and backtesting

---

## Executive Summary

Implementing an advanced **Graph Neural Network (GNN)** prediction system that:

1. **Builds market graphs** from stock correlations and fundamental relationships
2. **Predicts price movements** using graph neural networks
3. **Integrates with backtesting** to validate predictions
4. **Calculates comprehensive metrics** (Sharpe ratio, accuracy, etc.)
5. **Provides actionable insights** via API and mobile UI

### Expected Performance
- **Prediction Accuracy**: 55-65% (vs 50% random baseline)
- **Sharpe Ratio**: 1.5-2.5+ (risk-adjusted returns)
- **Hit Rate**: 60-70% directional accuracy
- **Execution Speed**: < 500ms per prediction

---

## System Architecture

### Components Overview

```
┌──────────────────────────────────────────────────────────┐
│          GNN Prediction System Architecture              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ Fundamental      │  │ Technical Data   │            │
│  │ Analyzer         │  │ Processor        │            │
│  └────────┬─────────┘  └────────┬─────────┘            │
│           │                      │                      │
│           └──────────┬───────────┘                      │
│                      ▼                                  │
│        ┌──────────────────────────┐                    │
│        │  Graph Builder            │                    │
│        │  - Node creation          │                    │
│        │  - Edge generation        │                    │
│        │  - Feature extraction     │                    │
│        └──────────┬────────────────┘                    │
│                   ▼                                     │
│        ┌──────────────────────────┐                    │
│        │  GNN Model               │                    │
│        │  - Graph convolutions     │                    │
│        │  - Attention mechanisms   │                    │
│        │  - Prediction layers      │                    │
│        └──────────┬────────────────┘                    │
│                   ▼                                     │
│        ┌──────────────────────────┐                    │
│        │  Prediction Engine        │                    │
│        │  - Price predictions      │                    │
│        │  - Confidence scores      │                    │
│        │  - Signal generation      │                    │
│        └──────────┬────────────────┘                    │
│                   ▼                                     │
│   ┌─────────────────────────────────────┐             │
│   │ Accuracy & Performance Calculation   │             │
│   │ - Prediction accuracy                │             │
│   │ - Sharpe ratio                       │             │
│   │ - Hit rate / Win rate                │             │
│   │ - Maximum drawdown                   │             │
│   │ - Information ratio                  │             │
│   └─────────────────────────────────────┘             │
│                                                       │
│   ┌──────────────────────────────────────┐           │
│   │ Backtesting Integration               │           │
│   │ - Validate predictions                │           │
│   │ - Compare vs actual results           │           │
│   │ - Risk analysis                       │           │
│   └──────────────────────────────────────┘           │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## Detailed Component Design

### 1. Fundamental Analyzer (400+ lines)

**Input Data**:
- P/E Ratio
- Debt-to-Equity
- ROE (Return on Equity)
- Current Ratio
- Dividend Yield
- Beta
- Market Cap
- Industry metrics

**Processing**:
```javascript
class FundamentalAnalyzer {
  // Normalize fundamental metrics
  normalizeFundamentals(metrics) → NormalizedMetrics

  // Calculate fundamental scores
  calculateFundamentalScore(metrics) → Score

  // Identify fundamental trends
  analyzeFundamentalTrends(historicalMetrics) → Trends

  // Generate fundamental signals
  generateFundamentalSignals(metrics) → Signal
}
```

**Output**:
- Normalized fundamental vectors
- Fundamental health scores (0-100)
- Quality rankings
- Signal strength (-1 to +1)

---

### 2. Technical Data Processor (350+ lines)

**Input Data**:
- OHLCV (historical prices)
- Technical indicators
- Volume patterns
- Volatility measures

**Processing**:
```javascript
class TechnicalDataProcessor {
  // Extract technical features
  extractTechnicalFeatures(ohlcv) → Features

  // Calculate indicators
  calculateIndicators(data) → Indicators

  // Normalize technical data
  normalizeTechnicalData(features) → NormalizedFeatures

  // Identify patterns
  identifyPatterns(data) → Patterns
}
```

**Features Extracted**:
- Moving averages (5, 20, 50, 200 day)
- Relative Strength Index (RSI)
- MACD
- Bollinger Bands
- Volume trends
- Volatility measures
- Price patterns

---

### 3. Graph Builder (450+ lines)

**Node Types**:
```
Stocks (S)
├─ Market Cap (large, mid, small)
├─ Sector (tech, finance, healthcare, etc.)
├─ Industry (specific industries)
└─ Quality (high, medium, low)

Market Factors (M)
├─ Sector trends
├─ Market sentiment
├─ Risk factors
└─ Macroeconomic indicators
```

**Edge Types**:
```
Correlation (C)
├─ Price correlation (ρ > 0.5)
├─ Fundamental similarity
├─ Sector relationships

Causality (A)
├─ Industry leader → followers
├─ Market cap → performance
├─ Fundamental → technical
```

**Graph Features**:
```javascript
class GraphBuilder {
  // Build stock correlation graph
  buildCorrelationGraph(prices) → Graph

  // Add fundamental relationships
  addFundamentalEdges(fundamentals) → Graph

  // Add sector relationships
  addSectorEdges(sectorData) → Graph

  // Extract node features
  extractNodeFeatures(data) → NodeFeatures

  // Create adjacency matrices
  createAdjacencyMatrix(graph) → Matrix

  // Normalize graph
  normalizeGraph(graph) → NormalizedGraph
}
```

**Node Features** (per stock):
- Normalized fundamentals (10 features)
- Normalized technicals (15 features)
- Historical returns (30 days)
- Volatility measures (3 features)
- **Total: 58-dimensional node embeddings**

**Edge Features**:
- Correlation strength
- Causality direction
- Relationship type
- Time lag

---

### 4. GNN Model (600+ lines)

**Architecture**: Graph Convolutional Network (GCN) with Attention

```
Input Layer (58 features per node)
    ↓
GCN Layer 1 (Graph Convolution + Normalization)
    ↓
Attention Mechanism (Multi-head attention)
    ↓
GCN Layer 2 (Graph Convolution)
    ↓
Dense Hidden Layer (128 units)
    ↓
Dropout (0.2)
    ↓
Dense Output Layer (1 unit)
    ↓
Output (Price prediction probability)
```

**Forward Pass**:
```javascript
class GNNModel {
  // Forward propagation through network
  forward(nodeFeatures, adjacencyMatrix) → Predictions

  // Graph convolution operation
  graphConvolution(features, adj) → ConvolvedFeatures

  // Attention mechanism
  attentionMechanism(features) → AttentionWeights

  // Prediction head
  predictionHead(features) → Predictions

  // Calculate loss
  calculateLoss(predictions, actual) → Loss

  // Backward propagation
  backward(loss) → Gradients
}
```

**Training**:
- Optimizer: Adam (learning rate: 0.001)
- Loss Function: Binary cross-entropy
- Batch Size: 32
- Epochs: 100
- Validation Split: 20%

---

### 5. Prediction Engine (500+ lines)

**Features**:
```javascript
class PredictionEngine {
  // Make price predictions
  predictPriceMovement(graph, timeframe) → Prediction

  // Generate trading signals
  generateSignals(predictions, confidence) → Signals

  // Calculate confidence scores
  calculateConfidence(predictions) → ConfidenceScores

  // Ensemble predictions
  ensemblePredictions(multipleModels) → EnsemblePrediction

  // Risk assessment
  assessPredictionRisk(predictions) → RiskMetrics
}
```

**Output Structure**:
```javascript
{
  symbol: "AAPL",
  timeframe: "1D",
  prediction: {
    priceTarget: 180.50,
    direction: "UP",  // UP, DOWN, NEUTRAL
    confidence: 0.72,  // 0-1 scale
    probability: 0.65  // % chance of movement
  },
  signal: {
    strength: 0.8,  // -1 to +1
    type: "STRONG_BUY",  // signal types
    holdingPeriod: 5  // days
  },
  riskMetrics: {
    maxLoss: -2.5,  // %
    expectedReturn: 3.2,  // %
    riskRewardRatio: 1.28
  }
}
```

---

### 6. Accuracy Calculator (400+ lines)

**Metrics Calculated**:

**Directional Accuracy**:
- True Positives: Correctly predicted UP
- True Negatives: Correctly predicted DOWN
- False Positives: Predicted UP, actually DOWN
- False Negatives: Predicted DOWN, actually UP
- **Hit Rate = (TP + TN) / Total**

**Performance Metrics**:
- **Precision**: TP / (TP + FP) - Reliability of predictions
- **Recall**: TP / (TP + FN) - Coverage of positive cases
- **F1 Score**: Harmonic mean of precision & recall
- **MCC**: Matthews Correlation Coefficient

**Price Prediction Accuracy**:
- **MAE**: Mean Absolute Error (avg absolute difference)
- **RMSE**: Root Mean Square Error (penalizes large errors)
- **MAPE**: Mean Absolute Percentage Error
- **R² Score**: Coefficient of determination

```javascript
class AccuracyCalculator {
  // Calculate directional accuracy
  calculateHitRate(predictions, actual) → HitRate

  // Calculate precision & recall
  calculatePrecisionRecall(predictions, actual) → Metrics

  // Calculate price accuracy
  calculatePriceAccuracy(predictions, actual) → Metrics

  // Generate confusion matrix
  generateConfusionMatrix(predictions, actual) → Matrix

  // Calculate ROC-AUC
  calculateROCAUC(predictions, actual) → AUC
}
```

---

### 7. Sharpe Ratio & Performance Calculator (500+ lines)

**Sharpe Ratio Calculation**:
```
Sharpe = (Return_avg - Risk_free_rate) / Return_std
```

**Key Metrics**:

1. **Total Return**: (Final Value - Initial Value) / Initial Value
2. **Annualized Return**: (Total Return + 1)^(365/days) - 1
3. **Daily Returns**: Daily percentage change
4. **Return Volatility**: Standard deviation of daily returns
5. **Downside Deviation**: Std dev of only negative returns
6. **Maximum Drawdown**: Largest peak-to-trough decline

**Advanced Metrics**:

1. **Sortino Ratio**: Similar to Sharpe but only penalizes downside
   - Sortino = Return / Downside_deviation

2. **Calmar Ratio**: Annual return / Maximum drawdown
   - Calmar = Annual_return / Max_drawdown

3. **Information Ratio**: Active return / Tracking error
   - Info_ratio = (Portfolio_return - Benchmark_return) / Tracking_error

4. **Treynor Ratio**: Excess return / Beta
   - Treynor = (Return - Risk_free) / Beta

5. **Win/Loss Ratio**: Ratio of winning to losing trades

6. **Profit Factor**: Gross profit / Gross loss

```javascript
class PerformanceCalculator {
  // Calculate Sharpe ratio
  calculateSharpeRatio(returns, riskFreeRate) → Sharpe

  // Calculate Sortino ratio
  calculateSortinoRatio(returns) → Sortino

  // Calculate Calmar ratio
  calculateCalmarRatio(returns, maxDrawdown) → Calmar

  // Calculate maximum drawdown
  calculateMaxDrawdown(equityCurve) → MaxDrawdown

  // Calculate volatility
  calculateVolatility(returns) → Volatility

  // Generate performance summary
  generatePerformanceSummary(results) → Summary
}
```

---

### 8. Backtesting Integration (400+ lines)

**Integration Points**:

1. **Input**: GNN predictions feed into backtesting engine
2. **Execution**: Backtest with GNN signals
3. **Validation**: Compare predictions vs actual outcomes
4. **Feedback**: Use backtest results to improve model

```javascript
class GNNBacktestIntegration {
  // Validate predictions against backtest
  validatePredictions(predictions, backtestResults) → ValidationMetrics

  // Compare prediction accuracy to actual
  compareVsActual(predictions, actual) → Comparison

  // Calculate prediction effectiveness
  calculateEffectiveness(predictions, outcomes) → Effectiveness

  // Generate improvement recommendations
  recommendImprovements(results) → Recommendations
}
```

**Metrics from Integration**:
- Prediction accuracy vs backtest results
- Signal effectiveness (how well signals worked)
- Timing accuracy (entry/exit timing)
- Risk management effectiveness

---

## API Endpoints

### Prediction Endpoints
```
POST   /api/gnn/predict                - Make predictions for stock
POST   /api/gnn/predict/batch          - Batch predictions
GET    /api/gnn/predictions/:symbol    - Get symbol predictions
GET    /api/gnn/accuracy               - Get accuracy metrics
```

### Performance Endpoints
```
GET    /api/gnn/performance/sharpe     - Get Sharpe ratios
GET    /api/gnn/performance/metrics    - Get all metrics
GET    /api/gnn/performance/comparison - Compare vs benchmark
```

### Model Endpoints
```
POST   /api/gnn/model/train            - Train GNN model
GET    /api/gnn/model/status           - Get model status
GET    /api/gnn/model/metrics          - Get model performance
```

---

## Data Flow

### Training Flow
```
Fundamental Data → Analyzer ↘
Technical Data → Processor ───→ Graph Builder → GNN Model
Correlation Data → Processor ↗              (Training)
                                              ↓
                                      Model Parameters
                                         (Saved)
```

### Prediction Flow
```
New Data
  ↓
Preprocessing
  ↓
Graph Generation
  ↓
GNN Forward Pass
  ↓
Signal Generation
  ↓
Confidence Calculation
  ↓
Backtesting
  ↓
Accuracy Metrics
  ↓
Output (API/UI)
```

---

## Performance Targets

| Metric | Target | Expected |
|--------|--------|----------|
| **Prediction Accuracy** | >55% | 58-62% |
| **Sharpe Ratio** | >1.5 | 1.8-2.3 |
| **Hit Rate (Directional)** | >60% | 62-68% |
| **Prediction Speed** | <500ms | 200-400ms |
| **Model Accuracy** | >70% | 72-78% |
| **Maximum Drawdown** | <20% | 12-18% |
| **Win Rate** | >55% | 58-65% |
| **Profit Factor** | >1.3 | 1.5-1.8 |

---

## Database Schema Extensions

### New Tables

```sql
-- GNN Model Predictions
CREATE TABLE gnn_predictions (
  id BIGINT PRIMARY KEY,
  symbol VARCHAR(20),
  prediction_date DATE,
  predicted_price DECIMAL(12,4),
  confidence DECIMAL(5,2),
  direction VARCHAR(10),
  actual_price DECIMAL(12,4),
  accuracy BOOLEAN,
  created_at TIMESTAMP
);

-- GNN Model Performance
CREATE TABLE gnn_performance_metrics (
  id BIGINT PRIMARY KEY,
  metric_date DATE,
  hit_rate DECIMAL(5,2),
  precision DECIMAL(5,2),
  recall DECIMAL(5,2),
  sharpe_ratio DECIMAL(8,3),
  sortino_ratio DECIMAL(8,3),
  max_drawdown DECIMAL(10,4),
  created_at TIMESTAMP
);

-- GNN Model States
CREATE TABLE gnn_model_states (
  id BIGINT PRIMARY KEY,
  model_version INT,
  training_date DATE,
  training_accuracy DECIMAL(5,2),
  parameters JSON,
  status VARCHAR(20),
  created_at TIMESTAMP
);
```

---

## Implementation Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Architecture & Design** | 2 hours | This document + design specs |
| **Fundamental Analyzer** | 2 hours | Code + tests |
| **Technical Processor** | 1.5 hours | Code + tests |
| **Graph Builder** | 2 hours | Code + tests |
| **GNN Model** | 3 hours | Implementation + training |
| **Prediction Engine** | 2 hours | Code + inference |
| **Accuracy Calculator** | 1.5 hours | Metrics + tests |
| **Performance Calculator** | 1.5 hours | Sharpe + ratios + tests |
| **Integration** | 1.5 hours | Backtesting connection |
| **API Endpoints** | 2 hours | 10+ endpoints |
| **Testing & Docs** | 2 hours | Comprehensive tests + docs |
| **TOTAL** | **~21 hours** | **Complete GNN system** |

---

## Success Criteria

✅ GNN model predicts stock movements with 55%+ accuracy
✅ Sharpe ratio of predictions > 1.5
✅ Hit rate of directional predictions > 60%
✅ API endpoints fully functional
✅ Integration with backtesting working
✅ Comprehensive testing (80%+ coverage)
✅ Complete documentation
✅ Mobile UI for predictions
✅ Performance metrics dashboard

---

## Next Steps

1. Implement FundamentalAnalyzer (400+ lines)
2. Implement TechnicalDataProcessor (350+ lines)
3. Implement GraphBuilder (450+ lines)
4. Implement GNNModel (600+ lines)
5. Implement PredictionEngine (500+ lines)
6. Implement AccuracyCalculator (400+ lines)
7. Implement PerformanceCalculator (500+ lines)
8. Integration & testing

---

*GNN Prediction Algorithm Architecture v1.0*
*October 30, 2025*
