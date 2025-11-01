# Phase 6 Part 2: Backtesting Engine - Implementation Plan

**Project**: HMS Trading Platform - Advanced Trading Features
**Phase**: 6.2 - Backtesting Engine
**Status**: PLANNED
**Date**: October 30, 2025
**Estimated Duration**: 3-4 sessions (~40-50 hours)
**Target Completion**: November 15, 2025

---

## Executive Summary

The Backtesting Engine will enable traders to validate strategies using historical market data before deploying them in paper trading or live trading. This system will provide realistic trade execution simulation with comprehensive performance analytics and comparison capabilities.

### Key Objectives

1. **Historical Data Management** - Efficient storage and retrieval of market data
2. **Realistic Backtesting** - Accurate order execution with slippage and commission
3. **Performance Analytics** - Advanced metrics and visualizations
4. **Comparison Tools** - Paper vs Backtest vs Live trading comparison
5. **Optimization Tools** - Parameter optimization and walk-forward analysis
6. **Report Generation** - Professional PDF reports with detailed insights

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Backtesting System                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ Historical Data  │  │ Backtesting      │  │ Analytics  │ │
│  │ Manager          │  │ Engine           │  │ Engine     │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬─────┘ │
│           │                     │                     │       │
│           └─────────────────────┼─────────────────────┘       │
│                                 │                             │
│                    ┌────────────▼────────────┐               │
│                    │  Database Layer          │               │
│                    │  (Historical Data)       │               │
│                    └──────────────────────────┘               │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ Results Storage  │  │ Comparison       │  │ Report     │ │
│  │                  │  │ Engine           │  │ Generator  │ │
│  └──────────────────┘  └──────────────────┘  └────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input (Symbol, Strategy, Date Range)
        ↓
Backtest Engine
        ↓
Historical Data Retrieval
        ↓
Order Simulation with Realistic Fills
        ↓
Position & P&L Tracking
        ↓
Performance Metrics Calculation
        ↓
Results Storage
        ↓
Comparison Engine (vs Paper, vs Live)
        ↓
Report Generation & Visualization
```

---

## Detailed Implementation Plan

### Phase 6.2.1: Historical Data Management (8-10 hours)

#### Components

1. **Historical Data Schema**
   - `backtest_historical_data` - OHLCV (Open, High, Low, Close, Volume) data
   - `backtest_data_sources` - Data source tracking
   - `backtest_data_cache` - Optimization cache for frequently accessed data
   - `backtest_market_calendars` - Trading calendars and holidays

**Tables Design**:
```sql
-- Historical OHLCV Data
CREATE TABLE backtest_historical_data (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  symbol VARCHAR(20),
  date DATE,
  timeframe VARCHAR(10),  -- '1m', '5m', '1h', '1d', etc
  open DECIMAL(12, 4),
  high DECIMAL(12, 4),
  low DECIMAL(12, 4),
  close DECIMAL(12, 4),
  volume BIGINT,
  source VARCHAR(50),     -- 'yahoo_finance', 'polygon', etc
  created_at TIMESTAMP,
  INDEX idx_symbol_date (symbol, date),
  INDEX idx_symbol_timeframe (symbol, timeframe)
);

-- Data Source Configuration
CREATE TABLE backtest_data_sources (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50),
  api_key VARCHAR(255),
  rate_limit INT,
  is_active BOOLEAN,
  last_sync TIMESTAMP
);

-- Market Calendars
CREATE TABLE backtest_market_calendars (
  id INT PRIMARY KEY AUTO_INCREMENT,
  exchange VARCHAR(20),
  date DATE,
  is_trading_day BOOLEAN,
  holiday_name VARCHAR(100),
  UNIQUE KEY unique_exchange_date (exchange, date)
);
```

2. **HistoricalDataManager Class** (400 lines)
   - Load OHLCV data from multiple sources (Yahoo Finance, Polygon, etc.)
   - Cache frequently used data
   - Data validation and quality checks
   - Support for multiple timeframes (1m, 5m, 1h, 1d, etc.)
   - Partial data handling and filling
   - Automatic data sync scheduled jobs

3. **Data Source Connectors** (300 lines total)
   - Yahoo Finance connector
   - Polygon.io connector
   - IEX Cloud connector
   - Built-in fallback to paper trading prices

#### Key Methods

```javascript
// Historical Data Manager API
- loadData(symbol, startDate, endDate, timeframe) → OHLCV[]
- getPrice(symbol, date, time) → Price
- validateData(symbol, dateRange) → ValidationResult
- cacheData(symbol, dateRange) → void
- getAvailableSymbols() → string[]
- getDateRange(symbol) → {start, end}
- fillMissingData(symbol, dateRange) → void
```

---

### Phase 6.2.2: Backtesting Engine (12-15 hours)

#### Core Components

1. **BacktestingEngine Class** (800-1000 lines)
   - Orchestrates backtest execution
   - Simulates order execution with realistic fills
   - Tracks positions and P&L in real-time
   - Handles event sequencing and time progression
   - Manages commissions and slippage

**Architecture**:
```javascript
class BacktestingEngine {
  // Configuration
  constructor(symbol, startDate, endDate, initialCapital, options)

  // Execution
  run(strategy) → BacktestResult
  executeOrder(order, currentPrice) → ExecutedOrder
  updatePosition(order, executionPrice) → Position
  calculateSlippage(basePrice, side, volume) → price

  // State Management
  getCurrentPrice(symbol, timestamp) → price
  getCurrentPositions() → Position[]
  getEquity(timestamp) → number
  getDrawdown(timestamp) → number

  // Analytics
  calculateMetrics(trades) → PerformanceMetrics
  getTradeSequence() → Trade[]
  getEquityCurve() → EquityPoint[]
}
```

2. **Strategy Execution Framework** (300 lines)
   - Strategy interface definition
   - Signal generation and order submission
   - Risk management rule enforcement
   - Event handling (on_bar, on_tick, on_order_filled, etc.)

3. **Order Execution Engine** (400 lines)
   - Market order execution with fill logic
   - Slippage simulation (random, predictable models)
   - Commission calculation (per-trade, percentage-based)
   - Order rejection logic (insufficient buying power, etc.)
   - Short selling support

#### Key Features

- **Event-Driven Execution**: Process historical data bar by bar
- **Realistic Fills**: Use high/low prices for order fills
- **Partial Fills**: Support for large orders that move the market
- **Commission Modeling**: 0.1% default, configurable per trade
- **Slippage Simulation**: 0.05% default spread
- **Buying Power Tracking**: Account for margin requirements

---

### Phase 6.2.3: Performance Analytics (10-12 hours)

#### Analytics Metrics

1. **Basic Metrics** (covered in paper trading, enhanced)
   - Total Return
   - Annualized Return
   - Win Rate
   - Profit Factor
   - Sharpe Ratio

2. **Advanced Metrics** (NEW)
   - **Calmar Ratio**: Annual return / max drawdown
   - **Sortino Ratio**: Return / downside deviation
   - **Information Ratio**: Excess return / tracking error
   - **Maximum Consecutive Wins/Losses**
   - **Recovery Factor**: Net Profit / max drawdown
   - **Ulcer Index**: Pain of drawdown periods
   - **Kurtosis & Skewness**: Return distribution analysis

3. **Risk Metrics**
   - Value at Risk (VaR) - 95% confidence
   - Conditional Value at Risk (CVaR)
   - Beta (vs benchmark)
   - Volatility (annualized)

4. **Trade-Level Metrics**
   - Average win/loss
   - Largest win/loss
   - Average winning trade duration
   - Average losing trade duration
   - Consecutive losing trades
   - Risk/reward ratio per trade

#### AnalyticsEngine Class (600 lines)

```javascript
class AnalyticsEngine {
  // Core Calculations
  calculateMetrics(trades, equityCurve) → BacktestMetrics
  calculateSharpeRatio(returns, riskFreeRate) → number
  calculateSortinoRatio(returns, targetReturn) → number
  calculateCalmarRatio(returns, maxDrawdown) → number

  // Risk Analysis
  calculateVaR(returns, confidence) → number
  calculateCVaR(returns, confidence) → number
  calculateDrawdownStatistics(equityCurve) → DrawdownStats

  // Distribution Analysis
  calculateReturnSkewness(returns) → number
  calculateReturnKurtosis(returns) → number

  // Trade Analysis
  analyzeTrades(trades) → TradeAnalysis
  calculateTradeStatistics(trades) → TradeStats
}
```

---

### Phase 6.2.4: Results Storage & Comparison (8-10 hours)

#### Database Schema

```sql
-- Backtest Results
CREATE TABLE backtest_results (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  strategy_name VARCHAR(255),
  symbol VARCHAR(20),
  start_date DATE,
  end_date DATE,
  initial_capital DECIMAL(15, 2),
  final_capital DECIMAL(15, 2),
  total_return DECIMAL(10, 2),
  annualized_return DECIMAL(10, 2),
  sharpe_ratio DECIMAL(8, 3),
  max_drawdown DECIMAL(10, 2),
  win_rate DECIMAL(5, 2),
  profit_factor DECIMAL(8, 2),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_strategy_symbol (strategy_name, symbol)
);

-- Backtest Trades
CREATE TABLE backtest_trades (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  backtest_result_id BIGINT,
  entry_date DATE,
  entry_price DECIMAL(12, 4),
  exit_date DATE,
  exit_price DECIMAL(12, 4),
  quantity INT,
  gross_pnl DECIMAL(15, 2),
  net_pnl DECIMAL(15, 2),
  commission DECIMAL(10, 2),
  holding_period INT,
  FOREIGN KEY (backtest_result_id) REFERENCES backtest_results(id),
  INDEX idx_backtest_result_id (backtest_result_id)
);

-- Equity Curve
CREATE TABLE backtest_equity_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  backtest_result_id BIGINT,
  date DATE,
  equity DECIMAL(15, 2),
  drawdown_percent DECIMAL(10, 2),
  FOREIGN KEY (backtest_result_id) REFERENCES backtest_results(id),
  INDEX idx_backtest_date (backtest_result_id, date)
);
```

#### Comparison Engine

Compares backtest results with:
- Paper trading results (same symbol/period)
- Live trading results (if available)
- Benchmark (S&P 500, etc.)

```javascript
class ComparisonEngine {
  // Comparison Methods
  compareToPaper(backtestResult, paperAccount) → Comparison
  compareToLive(backtestResult, liveAccount) → Comparison
  compareToBenchmark(backtestResult, benchmarkSymbol) → Comparison

  // Analysis
  identifyOutperformance(results1, results2) → OutperformanceAnalysis
  calculateTrackingError(results1, results2) → number
  correlateReturns(results1, results2) → number
}
```

---

### Phase 6.2.5: API Endpoints (6-8 hours)

#### REST Endpoints

```
# Backtest Execution
POST   /api/backtesting/backtest              - Start a backtest
GET    /api/backtesting/backtest/:id          - Get backtest status
POST   /api/backtesting/backtest/:id/cancel   - Cancel running backtest

# Results Management
GET    /api/backtesting/results               - List user's backtest results
GET    /api/backtesting/results/:id           - Get detailed results
DELETE /api/backtesting/results/:id           - Delete backtest results

# Historical Data
GET    /api/backtesting/data/symbols          - List available symbols
GET    /api/backtesting/data/:symbol          - Get data availability
POST   /api/backtesting/data/sync             - Force data sync

# Analytics
GET    /api/backtesting/results/:id/metrics   - Get performance metrics
GET    /api/backtesting/results/:id/trades    - Get trade history
GET    /api/backtesting/results/:id/equity    - Get equity curve

# Comparison
GET    /api/backtesting/results/:id/vs-paper  - Compare with paper trading
GET    /api/backtesting/results/:id/vs-live   - Compare with live trading
GET    /api/backtesting/results/:id/vs-bench  - Compare with benchmark

# Optimization
POST   /api/backtesting/optimize              - Start parameter optimization
GET    /api/backtesting/optimize/:id          - Get optimization progress
GET    /api/backtesting/optimize/:id/results  - Get optimal parameters
```

---

### Phase 6.2.6: Mobile Integration (8-10 hours)

#### TypeScript Types (200 lines)

```typescript
interface BacktestRequest {
  symbol: string;
  startDate: Date;
  endDate: Date;
  strategyCode: string;
  initialCapital: number;
  commission?: number;
  slippage?: number;
}

interface BacktestResult {
  id: string;
  status: 'running' | 'completed' | 'failed';
  symbol: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  metrics: BacktestMetrics;
  createdAt: Date;
}

interface BacktestMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  tradesCount: number;
  avgWin: number;
  avgLoss: number;
}

interface BacktestTrade {
  entryDate: Date;
  entryPrice: number;
  exitDate: Date;
  exitPrice: number;
  quantity: number;
  pnl: number;
  commission: number;
  holdingDays: number;
}
```

#### Redux State Management (300 lines)

- Async thunks for API calls
- State for backtest results, running tests, historical data
- Caching of frequently accessed data
- Error handling

#### Mobile UI Screens (400-500 lines)

1. **Backtest Setup Screen**
   - Symbol selection
   - Date range picker
   - Initial capital input
   - Strategy selection/upload
   - Commission and slippage settings
   - Start backtest button

2. **Backtest Results Screen**
   - Summary metrics cards
   - Performance comparison (vs paper, vs live)
   - Equity curve chart
   - Drawdown visualization
   - Trade list
   - Download report button

3. **Optimization Screen**
   - Parameter optimization setup
   - Progress tracking
   - Results visualization
   - Optimal parameters display

---

### Phase 6.2.7: Documentation & Testing (6-8 hours)

#### Testing (400+ lines)

- Unit tests for backtesting engine
- Integration tests for data loading and execution
- Edge case testing (gaps in data, corporate actions, etc.)
- Performance tests (backtesting speed benchmarks)
- Target: 80%+ coverage

#### Documentation (2000+ lines)

1. **User Guide**
   - Getting started with backtesting
   - Strategy development guide
   - Interpreting metrics
   - Best practices

2. **Technical Documentation**
   - Architecture overview
   - API reference
   - Data format specifications
   - Performance tuning

3. **API Documentation**
   - Endpoint specifications
   - Request/response examples
   - Error codes

---

## Timeline & Milestones

### Session 1: Core Infrastructure (Days 1-3)
- ✅ Historical Data Management (components, schema, data connectors)
- ✅ Backtesting Engine (core execution logic)
- ✅ Basic testing framework

**Deliverables**: 1,200 LOC, database migrations, data loading

### Session 2: Analytics & Results (Days 4-6)
- ✅ Performance analytics engine
- ✅ Results storage and retrieval
- ✅ Comparison engine
- ✅ Advanced testing

**Deliverables**: 1,500 LOC, analytics, comparison logic, additional tests

### Session 3: API & Integration (Days 7-9)
- ✅ REST API endpoints
- ✅ Mobile Redux integration
- ✅ Mobile UI screens
- ✅ Documentation

**Deliverables**: 1,400 LOC, API endpoints, mobile integration, 50+ pages docs

### Session 4 (Optional): Optimization & Polish (Days 10-11)
- ✅ Parameter optimization engine
- ✅ Performance tuning
- ✅ Additional optimizations
- ✅ Final testing and deployment

**Deliverables**: 600 LOC, optimization engine, final polish

---

## Success Criteria

### Functionality
- ✅ Load historical data from multiple sources
- ✅ Execute backtests with realistic fills
- ✅ Calculate advanced performance metrics
- ✅ Compare backtest vs paper vs live
- ✅ Store and retrieve results
- ✅ Display results in mobile app
- ✅ Support parameter optimization

### Quality
- ✅ 80%+ test coverage
- ✅ Zero linting errors
- ✅ Comprehensive documentation
- ✅ TypeScript type safety in mobile
- ✅ Error handling on all endpoints

### Performance
- ✅ Backtest execution: < 5 seconds for 1-year daily data
- ✅ API response: < 200ms (95th percentile)
- ✅ Mobile UI: 60 FPS smooth scrolling
- ✅ Historical data loading: < 1 second for common symbols

### Deployment
- ✅ Database migrations ready
- ✅ API endpoints functional
- ✅ Mobile app tested
- ✅ Documentation complete
- ✅ Backwards compatible

---

## Risk & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Historical data quality issues | Medium | Medium | Implement validation, use multiple sources |
| Performance on large datasets | High | Low | Optimize queries, implement caching |
| Market data API rate limits | Medium | Medium | Implement caching, batch requests |
| Strategy complexity | High | Low | Use strategy templates, provide examples |
| Backtesting accuracy concerns | High | Low | Extensive testing, compare with paper trades |

---

## Dependencies & Prerequisites

### External Dependencies
- Historical market data source (Yahoo Finance, Polygon, etc.)
- Existing paper trading system (Phase 6.1)
- Database infrastructure
- Mobile app infrastructure (React Native)

### Knowledge Prerequisites
- Understanding of OHLCV data
- Backtesting concepts
- Performance metrics calculations
- Order execution logic

---

## Success Definition

**Phase 6.2 is successful when:**

1. Traders can backtest strategies on historical data
2. Results are compared with paper and live trading
3. Advanced metrics provide actionable insights
4. Optimization tool helps tune strategy parameters
5. Mobile app displays results beautifully
6. System handles millions of historical data points
7. API is stable and performant
8. Documentation is comprehensive
9. Test coverage exceeds 80%
10. System is production-ready

---

## Next Steps (Phase 6.3+)

After completing Phase 6.2 (Backtesting), the roadmap includes:

### Phase 6.3: Strategy Builder
- Visual strategy builder with drag-and-drop components
- Technical indicator library (50+ indicators)
- Signal generation and condition chaining
- Automated strategy generation from templates

### Phase 6.4: Advanced Analytics
- Portfolio optimization using Modern Portfolio Theory
- Risk analytics (VaR, CVaR, stress testing)
- Correlation and covariance analysis
- Sector and asset class exposure tracking

### Phase 6.5: Market Calendars & Events
- Trading calendar management
- Market holiday tracking
- Economic events calendar
- Earnings calendar integration

---

**Status**: PLANNED - Ready for implementation
**Created**: October 30, 2025
**Next Review**: November 15, 2025 (after completion)
