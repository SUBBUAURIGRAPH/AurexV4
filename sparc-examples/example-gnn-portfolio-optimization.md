# SPARC Example: GNN-Based Portfolio Optimization

**Skill**: Graph-based Portfolio Optimizer
**Agent**: GNN Heuristic Agent
**Project**: Trading Portfolio Optimization
**Complexity**: Advanced
**Duration**: 6 weeks
**Team Size**: 3 (ML Engineer, Quant, DevOps)
**Business Impact**: $2.5M annual improvement in portfolio performance

---

## 📋 Executive Summary

**Problem**: Traditional Markowitz portfolio optimization doesn't capture complex relationships between assets. Need intelligent portfolio construction considering asset correlations, sector relationships, and market dynamics.

**Solution**: Graph Neural Network that learns portfolio construction heuristics from historical data, modeling assets as graph nodes and their relationships as edges.

**Results**:
- **Sharpe Ratio**: Improved from 1.8 to 2.4 (+33%)
- **Max Drawdown**: Reduced from -15% to -9%
- **Rebalancing Cost**: Reduced by 40%
- **Inference Time**: < 50ms (real-time decision making)
- **Business Value**: $2.5M additional annual returns

---

## Phase 1: Specification

**Duration**: 1 week (10% of total time)
**Status**: ✅ Complete
**Sign-off**: CTO, Head of Trading (2025-09-01)

### Problem Statement

Traditional portfolio optimization methods (Markowitz Mean-Variance, Black-Litterman) have limitations:
1. Assume linear relationships between assets
2. Don't capture sector/industry clustering
3. Ignore market regime changes
4. High sensitivity to parameter estimation

**Goal**: Build a GNN-based system that learns optimal portfolio allocation by understanding asset relationships through graph structure.

### Requirements Gathering

**Functional Requirements**:
- FR1: Construct asset correlation graphs from historical data
- FR2: Learn portfolio weights using GNN
- FR3: Handle 500+ assets
- FR4: Support real-time rebalancing decisions
- FR5: Consider transaction costs
- FR6: Respect portfolio constraints (long-only, sector limits, etc.)

**Non-Functional Requirements**:
- NFR1 - Performance: Inference < 100ms
- NFR2 - Quality: Sharpe ratio > 2.0
- NFR3 - Robustness: Max drawdown < -12%
- NFR4 - Scalability: Support up to 5000 assets
- NFR5 - Latency: Real-time updates on market data

### Use Cases

**UC1**: Daily Portfolio Rebalancing
- **Actor**: Trading System
- **Goal**: Optimal asset weights
- **Steps**:
  1. Fetch latest market data
  2. Update asset correlation graph
  3. Run GNN inference
  4. Get recommended weights
  5. Execute trades

**UC2**: Risk-Adjusted Portfolio Construction
- **Actor**: Portfolio Manager
- **Goal**: Construct low-risk, high-return portfolio
- **Steps**:
  1. Specify risk tolerance
  2. Define constraints
  3. Run GNN optimizer
  4. Review recommendations
  5. Approve and execute

### Acceptance Criteria

- AC1: System produces valid portfolio weights (sum to 1, non-negative)
- AC2: Sharpe ratio > 2.0 on historical backtest
- AC3: Outperforms Markowitz baseline by > 15%
- AC4: Inference time < 100ms for 500 assets
- AC5: Handles missing data gracefully
- AC6: Respects all constraints (sector limits, position sizes)

### Success Metrics

| Metric | Baseline | Target | Achieved |
|--------|----------|--------|----------|
| Sharpe Ratio | 1.8 | 2.0 | 2.4 |
| Annual Return | 12% | 15% | 18.5% |
| Max Drawdown | -15% | -12% | -9% |
| Win Rate | 52% | 55% | 58% |
| Inference Time | - | < 100ms | 45ms |

---

## Phase 2: Pseudocode

**Duration**: 1.5 weeks (15% of total time)
**Status**: ✅ Complete
**Sign-off**: Lead ML Engineer (2025-09-08)

### Algorithm Design

```
Algorithm: GNN Portfolio Optimizer

Input:
  - asset_prices: Historical prices (T x N matrix)
  - features: Asset features (fundamental, technical)
  - constraints: Portfolio constraints
Output:
  - weights: Portfolio allocation (N-dimensional vector)

function optimize_portfolio(asset_prices, features, constraints):
    # Step 1: Construct Asset Graph
    graph = construct_asset_graph(asset_prices, features)
      # Nodes: assets with features (returns, vol, fundamentals)
      # Edges: correlations, sector relationships

    # Step 2: GNN Encoding
    encoder = GNNEncoder(
        node_features_dim=features.shape[1],
        hidden_dim=128,
        num_layers=4,
        attention_heads=8
    )
    asset_embeddings = encoder(graph)

    # Step 3: Portfolio Construction Decoder
    decoder = PortfolioDecoder(
        embedding_dim=128,
        output_dim=1  # Weight for each asset
    )
    raw_weights = decoder(asset_embeddings)

    # Step 4: Constraint Projection
    weights = project_to_constraints(raw_weights, constraints)
      # Ensure: sum(weights) = 1
      # Ensure: weights >= 0 (long-only)
      # Ensure: sector limits
      # Ensure: position size limits

    # Step 5: Risk-Return Optimization
    expected_return = compute_expected_return(weights, asset_prices)
    risk = compute_portfolio_risk(weights, asset_prices)
    sharpe = expected_return / risk

    return weights, sharpe

function construct_asset_graph(prices, features):
    N = prices.shape[1]  # Number of assets

    # Compute correlation matrix
    returns = compute_returns(prices)
    corr_matrix = compute_correlation(returns)

    # Build edges based on correlation threshold
    edges = []
    edge_features = []

    for i in range(N):
        for j in range(i+1, N):
            if abs(corr_matrix[i, j]) > threshold:
                edges.append((i, j))
                edges.append((j, i))
                edge_features.append(corr_matrix[i, j])
                edge_features.append(corr_matrix[j, i])

    # Add sector/industry edges
    sector_edges = add_sector_edges(features.sector)

    # Node features: returns, volatility, Sharpe, fundamentals
    node_features = compute_node_features(prices, features)

    graph = Graph(
        nodes=range(N),
        edges=edges,
        node_features=node_features,
        edge_features=edge_features
    )

    return graph

function train_gnn_portfolio():
    # Initialize model
    model = GNNPortfolioOptimizer()
    optimizer = Adam(model.parameters(), lr=1e-4)

    # Training data: sliding windows
    for epoch in range(num_epochs):
        for window in sliding_windows(historical_data):
            # Training period
            train_prices = window.train_prices
            train_features = window.train_features

            # Get optimal portfolio (from future returns)
            optimal_weights = compute_hindsight_optimal(
                train_prices,
                window.future_prices
            )

            # Model prediction
            pred_weights = model(train_prices, train_features)

            # Loss: Combined objectives
            loss = sharpe_loss(pred_weights, window.future_prices) + \
                   mse_loss(pred_weights, optimal_weights) + \
                   transaction_cost_loss(pred_weights, prev_weights)

            # Optimize
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

        # Validation
        val_sharpe = evaluate_portfolio(model, validation_data)
        log_metrics(epoch, val_sharpe)

    return model
```

### Data Flow

```
Historical Prices → Returns Computation → Correlation Matrix
                                              ↓
                                          Graph Construction
                                              ↓
                                    ┌─────────┴─────────┐
                                    │                   │
                           Node Features        Edge Features
                          (return, vol, ...)  (correlation)
                                    │                   │
                                    └─────────┬─────────┘
                                              ↓
                                          GNN Encoder
                                     (4 layers, 128-dim)
                                              ↓
                                      Asset Embeddings
                                              ↓
                                    Portfolio Decoder
                                              ↓
                                        Raw Weights
                                              ↓
                                  Constraint Projection
                                              ↓
                                    Final Portfolio Weights
```

### Error Handling

1. **Missing Data**: Forward-fill with last known values
2. **Correlation Matrix Singularity**: Regularization (add small epsilon to diagonal)
3. **Infeasible Constraints**: Relax constraints iteratively
4. **Model Divergence**: Gradient clipping, learning rate decay
5. **Market Regime Change**: Ensemble of models for different regimes

### Edge Cases

- **New Assets**: Cold-start with mean-variance estimates
- **Extreme Volatility**: Risk caps and position size limits
- **Low Correlation Market**: Fall back to sector-based allocation
- **Transaction Cost Surge**: Reduce rebalancing frequency

---

## Phase 3: Architecture

**Duration**: 1 week (15% of total time)
**Status**: ✅ Complete
**Sign-off**: Solutions Architect (2025-09-15)

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Trading Platform                          │
│                 (Real-time Market Data)                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Data Ingestion Service                          │
│  - Fetch prices, fundamentals, news                         │
│  - Normalize and validate data                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Graph Construction Service                      │
│  - Compute correlations, features                           │
│  - Build asset graph                                        │
│  - Cache graph for reuse                                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              GNN Inference Service                           │
│  - Load trained model                                       │
│  - Run GNN forward pass                                     │
│  - Output portfolio weights                                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│           Portfolio Optimization Service                     │
│  - Apply constraints                                        │
│  - Compute risk metrics                                     │
│  - Generate rebalancing orders                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Order Execution Service                         │
│  - Submit orders to broker                                  │
│  - Monitor execution                                        │
│  - Update portfolio state                                   │
└─────────────────────────────────────────────────────────────┘
```

### GNN Model Architecture

```python
class GNNPortfolioOptimizer(nn.Module):
    def __init__(self, config):
        super().__init__()

        # Encoder: Asset embeddings
        self.encoder = GATEncoder(
            input_dim=config.num_features,
            hidden_dim=128,
            num_layers=4,
            heads=8
        )

        # Risk-aware attention
        self.risk_attention = nn.MultiheadAttention(
            embed_dim=128,
            num_heads=8
        )

        # Portfolio decoder
        self.decoder = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1),  # Weight per asset
            nn.Softmax(dim=0)  # Ensure weights sum to 1
        )

    def forward(self, graph_data):
        # Encode assets
        asset_embeddings = self.encoder(
            graph_data.x,
            graph_data.edge_index,
            graph_data.edge_attr
        )

        # Risk-aware attention
        risk_adjusted_embeddings, _ = self.risk_attention(
            asset_embeddings,
            asset_embeddings,
            asset_embeddings
        )

        # Decode to weights
        weights = self.decoder(risk_adjusted_embeddings)

        return weights
```

### Technology Stack

**ML/AI**:
- PyTorch + PyTorch Geometric
- NumPy, Pandas for data processing
- scikit-learn for baselines

**Data**:
- PostgreSQL (time-series data)
- Redis (caching graphs, model outputs)
- Apache Kafka (streaming market data)

**Deployment**:
- Docker + Kubernetes
- TorchServe (model serving)
- FastAPI (REST APIs)
- Prometheus + Grafana (monitoring)

**Backtest**:
- Backtrader framework
- Custom performance metrics
- Risk analysis tools

---

## Phase 4: Refinement

**Duration**: 3 weeks (50% of total time)
**Status**: ✅ Complete
**Sign-off**: Head of Quant Research (2025-10-06)

### Implementation

**Training Results**:

| Experiment | Architecture | Sharpe (Val) | Training Time |
|------------|--------------|--------------|---------------|
| Baseline (Markowitz) | - | 1.8 | - |
| GNN-v1 (GCN) | 3 layers, 64-dim | 2.1 | 12 hours |
| GNN-v2 (GAT) | 4 layers, 128-dim | 2.3 | 18 hours |
| **GNN-v3 (GAT + Risk Attn)** | **4 layers, 128-dim** | **2.4** | **24 hours** |

**Hyperparameter Optimization**:
- Learning rate: 1e-4 (best among [1e-3, 1e-4, 1e-5])
- Hidden dim: 128 (best among [64, 128, 256])
- Num layers: 4 (best among [2, 3, 4, 5])
- Attention heads: 8 (best among [4, 8, 16])

### Code Quality

**Unit Tests**:
```python
def test_graph_construction():
    """Test asset graph construction"""
    prices = generate_mock_prices(100, 50)  # 100 days, 50 assets
    graph = construct_asset_graph(prices)

    assert graph.num_nodes == 50
    assert graph.num_edges > 0
    assert graph.node_features.shape == (50, num_features)

def test_portfolio_constraints():
    """Test constraint satisfaction"""
    weights = model.predict(graph_data)

    assert torch.allclose(weights.sum(), torch.tensor(1.0))  # Sum to 1
    assert (weights >= 0).all()  # Non-negative
    assert (weights <= 0.1).all()  # Position size limit

def test_inference_speed():
    """Test inference latency"""
    import time
    start = time.time()
    weights = model.predict(graph_data)
    latency = (time.time() - start) * 1000
    assert latency < 100  # < 100ms
```

**Integration Tests**:
- End-to-end backtest
- Real-time data pipeline
- Order execution simulation

**Performance Metrics**:
- Test Coverage: 92%
- Code Quality Score: A (SonarQube)
- Documentation Coverage: 95%

### Backtesting Results

**Period**: 2020-01-01 to 2025-09-30 (5.75 years)

| Metric | GNN Portfolio | Markowitz | S&P 500 |
|--------|---------------|-----------|---------|
| Annual Return | 18.5% | 12.0% | 14.2% |
| Sharpe Ratio | 2.4 | 1.8 | 1.5 |
| Max Drawdown | -9.0% | -15.0% | -23.5% |
| Volatility | 7.7% | 6.7% | 9.5% |
| Win Rate | 58% | 52% | 51% |
| Calmar Ratio | 2.06 | 0.80 | 0.60 |

**Risk Analysis**:
- VaR (95%): -2.1% (vs -3.5% for Markowitz)
- CVaR (95%): -3.8% (vs -5.2% for Markowitz)
- Beta to S&P 500: 0.65 (vs 0.82 for Markowitz)

---

## Phase 5: Completion

**Duration**: 0.5 weeks (10% of total time)
**Status**: ✅ Complete
**Sign-off**: CTO (2025-10-13)

### Deployment

**Production Deployment** (2025-10-10):
```bash
# Build Docker image
docker build -t gnn-portfolio-optimizer:1.0 .

# Deploy to Kubernetes
kubectl apply -f k8s/gnn-service.yaml

# Verify deployment
kubectl get pods -l app=gnn-portfolio
```

**API Endpoint**:
```
POST /api/v1/optimize-portfolio
{
  "assets": ["AAPL", "GOOGL", "MSFT", ...],
  "lookback_days": 252,
  "constraints": {
    "max_position_size": 0.1,
    "sector_limits": {...}
  }
}

Response:
{
  "weights": {
    "AAPL": 0.08,
    "GOOGL": 0.06,
    ...
  },
  "expected_sharpe": 2.35,
  "inference_time_ms": 45
}
```

### Monitoring

**Production Metrics** (First 30 Days):
- Uptime: 99.95%
- Avg Inference Time: 47ms
- P99 Inference Time: 82ms
- API Success Rate: 99.98%
- Model Sharpe Ratio: 2.38 (live trading)

**Monitoring Dashboard** (Grafana):
- Real-time Sharpe ratio
- Portfolio weights distribution
- Risk metrics (VaR, volatility)
- Inference latency
- Model drift detection

### Documentation

**Created**:
- ✅ Model Card: Performance characteristics, limitations
- ✅ API Documentation: FastAPI auto-generated + examples
- ✅ User Guide: For quant team
- ✅ Deployment Guide: For DevOps
- ✅ Monitoring Runbook: Alert handling procedures

### Training & Handoff

**Training Sessions**:
- Quant Team (2 sessions, 4 hours total)
- Trading Ops (1 session, 2 hours)
- DevOps (1 session, 2 hours)

**Handoff Materials**:
- Code repository with README
- Model weights and training logs
- Backtest results and analysis
- Production deployment config

---

## 📊 Business Impact

### Financial Impact

**Annual Performance Improvement**:
- Portfolio Return: 18.5% vs 12% baseline = **+6.5% excess return**
- AUM: $40M
- **Additional Annual Return**: $2.6M

**Risk Reduction**:
- Max Drawdown: -9% vs -15% baseline = **40% reduction**
- Avoided Losses: Estimated $1.2M during volatile periods

**Cost Savings**:
- Rebalancing Cost: -40% due to smarter position changes
- Annual Savings: ~$100K in transaction costs

**Total Annual Benefit**: $2.5M

### Operational Impact

- **Decision Speed**: 100x faster than manual analysis
- **Scalability**: Can handle 5000+ assets (vs 500 manual limit)
- **Consistency**: Removes human bias and errors
- **Research Time**: Freed up 60% of quant team time for new strategies

---

## 🎓 Lessons Learned

### What Worked Well

✅ **Graph Representation**: Capturing asset relationships as graphs was key
✅ **Attention Mechanisms**: GAT outperformed GCN significantly
✅ **Risk-Aware Features**: Explicitly modeling risk improved Sharpe ratio
✅ **Backtesting Framework**: Comprehensive testing caught many issues
✅ **Incremental Deployment**: Gradual rollout reduced risk

### Challenges & Solutions

**Challenge 1**: Model overfit to recent market regime
- **Solution**: Trained on multiple market regimes (bull, bear, sideways)
- **Result**: More robust performance

**Challenge 2**: Correlation matrix unstable
- **Solution**: Added regularization and used rolling windows
- **Result**: Stable graph construction

**Challenge 3**: Transaction costs not initially considered
- **Solution**: Added transaction cost term to loss function
- **Result**: 40% reduction in rebalancing frequency

**Challenge 4**: Cold-start for new assets
- **Solution**: Use fundamental features + sector clustering
- **Result**: Reasonable performance for new assets

### Improvements for Next Time

1. **Multi-horizon Optimization**: Optimize for multiple time horizons
2. **Market Regime Detection**: Automatically switch models by regime
3. **Reinforcement Learning**: Online learning from live trading
4. **Explainability**: Better interpretation of portfolio decisions
5. **Alternative Data**: Incorporate news, sentiment, alternative data

---

## 🔬 Technical Deep Dive

### Why GNNs for Portfolio Optimization?

**Traditional Methods Limitations**:
- Assume pairwise independence or simple correlation
- Don't capture higher-order relationships (e.g., sector clustering)
- Linear assumptions about risk and return

**GNN Advantages**:
- Naturally model relationships through edges
- Learn hierarchical representations (asset → sector → market)
- Capture non-linear dependencies
- Transfer learning across different markets

### Model Architecture Insights

**Key Design Decisions**:

1. **Graph Construction**: Used dynamic correlation threshold (top 20% correlations)
2. **Node Features**: Return, volatility, Sharpe, momentum, fundamentals (P/E, EPS growth)
3. **Edge Features**: Pearson correlation, mutual information
4. **Attention Mechanism**: Learned to focus on high-quality relationships
5. **Risk Modeling**: Separate risk attention layer

### Training Strategy

**Multi-objective Loss**:
```
Loss = α * sharpe_loss + β * mse_loss + γ * transaction_cost_loss + δ * constraint_loss

Where:
- sharpe_loss: Negative Sharpe ratio
- mse_loss: Distance from hindsight optimal
- transaction_cost_loss: Turnover penalty
- constraint_loss: Soft constraint violations
```

**Data Augmentation**:
- Bootstrap sampling
- Noise injection
- Regime mixing

---

## 📈 Future Roadmap

### Phase 2 (Q4 2025)
- [ ] Multi-asset class support (equities, bonds, commodities)
- [ ] Crypto portfolio integration
- [ ] Real-time model updates (online learning)
- [ ] Factor integration (Fama-French, momentum, etc.)

### Phase 3 (2026)
- [ ] Multi-objective optimization (return, risk, ESG)
- [ ] Explainable AI module
- [ ] Market regime auto-detection
- [ ] Cross-market transfer learning

---

## 📚 References

1. "Deep Learning for Portfolio Optimization" (Zhang et al., 2020)
2. "Graph Neural Networks in Financial Trading" (Chen et al., 2021)
3. "Attention-based Portfolio Management" (Jiang et al., 2020)
4. "Risk-Aware Portfolio Optimization with GNNs" (Li et al., 2022)

---

## 🏆 Awards & Recognition

- **Best ML Project 2025**: Internal innovation award
- **Industry Recognition**: Featured in Journal of Financial Data Science
- **Conference Presentation**: NeurIPS 2025 Workshop on Finance

---

**Project Status**: ✅ Successfully Deployed
**Business Value**: $2.5M annually
**Team**: GNN Heuristic Agent, Quant Team, DevOps
**Timeline**: 6 weeks (on time)
**Budget**: Within budget

**🧠 Powered by Graph Neural Networks - Intelligent Portfolio Construction**
