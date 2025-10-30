# HMS Backtesting System - Complete Guide

**Version**: 1.0.0
**Last Updated**: October 30, 2025
**Status**: Production Ready

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture](#architecture)
3. [API Reference](#api-reference)
4. [Mobile Integration](#mobile-integration)
5. [Performance Metrics](#performance-metrics)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Quick Start

### For Mobile Users

1. **Open Backtest Setup Screen**
   - Navigate to "Backtest" tab in HMS app
   - Tap "Configure Backtest"

2. **Configure Your Backtest**
   - Select a symbol (e.g., AAPL)
   - Choose date range (from/to dates)
   - Set initial capital ($100,000 recommended)
   - Adjust commission (0.1% default)
   - Adjust slippage (0.05% default)

3. **Start Backtest**
   - Review configuration summary
   - Tap "🚀 Start Backtest"
   - Wait for completion (usually 5-30 seconds)

4. **View Results**
   - Three tabs:
     - **Metrics**: All performance indicators
     - **Equity**: Equity curve chart
     - **Trades**: Individual trade history

### For API Developers

```bash
# Start a backtest
curl -X POST https://apihms.aurex.in/api/backtesting/backtest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2025-01-01",
    "strategyCode": "default",
    "initialCapital": 100000,
    "commission": 0.001,
    "slippage": 0.0005
  }'

# Response:
{
  "id": "backtest_123",
  "status": "running",
  "symbol": "AAPL",
  "progress": 0
}

# Get results
curl -X GET https://apihms.aurex.in/api/backtesting/results/backtest_123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile App (React Native)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Redux Store (backtestingSlice)               │  │
│  │  - State management                                  │  │
│  │  - 15 async thunks for API calls                    │  │
│  │  - Selectors for components                          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Mobile UI Screens                            │  │
│  │  - BacktestSetupScreen                              │  │
│  │  - BacktestResultsScreen                            │  │
│  │  - Charts and visualizations                        │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST
┌──────────────────────────┴──────────────────────────────────┐
│                 REST API (Express.js)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  16 API Endpoints                                    │  │
│  │  - Backtest execution (/backtest)                   │  │
│  │  - Results management (/results)                    │  │
│  │  - Data management (/data)                          │  │
│  │  - Analytics (/metrics)                             │  │
│  │  - Optimization (/optimize)                         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Backend Processing                                  │  │
│  │  - HistoricalDataManager (data loading)             │  │
│  │  - BacktestingEngine (execution)                    │  │
│  │  - AnalyticsEngine (metrics calculation)            │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ SQL
┌──────────────────────────┴──────────────────────────────────┐
│               MySQL Database                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  9 Backtesting Tables                               │  │
│  │  - Historical data (OHLCV)                          │  │
│  │  - Results and trades                               │  │
│  │  - Equity curves                                    │  │
│  │  - Optimization results                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input (Mobile UI)
        ↓
Redux Dispatch (startBacktest thunk)
        ↓
API Request (POST /api/backtesting/backtest)
        ↓
Express Server
        ↓
HistoricalDataManager
  ├─ Load data from Yahoo Finance
  ├─ Validate data quality
  └─ Cache for performance
        ↓
BacktestingEngine
  ├─ Process bars day-by-day
  ├─ Execute orders with slippage
  ├─ Track positions and P&L
  └─ Record equity history
        ↓
AnalyticsEngine
  ├─ Calculate Sharpe, Sortino, Calmar
  ├─ Compute risk metrics (VaR, CVaR)
  ├─ Generate trade statistics
  └─ Analyze distribution
        ↓
Database Storage
  ├─ Save results
  ├─ Store trades
  └─ Archive equity curve
        ↓
API Response (JSON)
        ↓
Redux Update (store results)
        ↓
Mobile UI Re-render
        ↓
Results Display (Charts, Metrics)
```

---

## API Reference

### Authentication

All endpoints require JWT Bearer token:

```
Authorization: Bearer <your_token>
```

### Backtest Endpoints

#### POST /api/backtesting/backtest
**Start a new backtest**

Request:
```json
{
  "symbol": "AAPL",
  "startDate": "2024-01-01",
  "endDate": "2025-01-01",
  "strategyCode": "default",
  "initialCapital": 100000,
  "commission": 0.001,
  "slippage": 0.0005
}
```

Response (200):
```json
{
  "id": "backtest_123",
  "status": "running",
  "symbol": "AAPL",
  "startDate": "2024-01-01",
  "endDate": "2025-01-01",
  "message": "Backtest started"
}
```

#### GET /api/backtesting/backtest/:id
**Get backtest status**

Response (200):
```json
{
  "id": "backtest_123",
  "symbol": "AAPL",
  "status": "completed",
  "progress": 100,
  "initialCapital": 100000,
  "finalEquity": 112500,
  "totalReturn": 12.5,
  "sharpeRatio": 1.245,
  "maxDrawdown": -8.5,
  "winRate": 62.5,
  "totalTrades": 24,
  "createdAt": "2025-10-30T12:00:00Z",
  "completedAt": "2025-10-30T12:05:30Z"
}
```

#### POST /api/backtesting/backtest/:id/cancel
**Cancel a running backtest**

Response (200):
```json
{
  "message": "Backtest cancelled"
}
```

### Results Endpoints

#### GET /api/backtesting/results
**List user's backtest results**

Query Parameters:
- `symbol` (optional): Filter by symbol
- `status` (optional): Filter by status (completed, running, failed)
- `limit` (default: 20): Results per page
- `offset` (default: 0): Pagination offset

Response (200):
```json
{
  "total": 5,
  "results": [
    {
      "id": "backtest_123",
      "symbol": "AAPL",
      "status": "completed",
      "totalReturn": 12.5,
      "sharpeRatio": 1.245,
      "maxDrawdown": -8.5,
      "winRate": 62.5,
      "totalTrades": 24,
      "createdAt": "2025-10-30T12:00:00Z"
    }
  ]
}
```

#### GET /api/backtesting/results/:id
**Get detailed backtest results with trades and equity**

Response (200):
```json
{
  "id": "backtest_123",
  "symbol": "AAPL",
  "status": "completed",
  "startDate": "2024-01-01",
  "endDate": "2025-01-01",
  "initialCapital": 100000,
  "finalEquity": 112500,
  "metrics": {
    "totalReturn": 12.5,
    "annualizedReturn": 12.5,
    "sharpeRatio": 1.245,
    "sortinoRatio": 1.456,
    "calmarRatio": 1.471,
    "maxDrawdown": -8.5,
    "volatility": 0.145,
    "winRate": 62.5,
    "profitFactor": 1.85,
    "totalTrades": 24,
    "totalTrades": 24,
    "winningTrades": 15,
    "losingTrades": 9
  },
  "trades": [
    {
      "id": "trade_1",
      "entryDate": "2024-01-15",
      "entryPrice": 150.25,
      "exitDate": "2024-01-20",
      "exitPrice": 152.50,
      "quantity": 100,
      "netPnL": 225.0,
      "pnlPercent": 1.5,
      "holdingPeriod": 5
    }
  ],
  "equityCurve": [
    {
      "date": "2024-01-01",
      "equity": 100000,
      "drawdown": 0
    },
    {
      "date": "2024-01-02",
      "equity": 100500,
      "drawdown": 0
    }
  ]
}
```

#### DELETE /api/backtesting/results/:id
**Delete backtest results**

Response (200):
```json
{
  "message": "Result deleted"
}
```

### Data Endpoints

#### GET /api/backtesting/data/symbols
**List available symbols**

Response (200):
```json
{
  "symbols": ["AAPL", "MSFT", "GOOGL", "TSLA"],
  "count": 4
}
```

#### GET /api/backtesting/data/:symbol
**Get data availability for symbol**

Response (200):
```json
{
  "symbol": "AAPL",
  "available": true,
  "startDate": "2015-01-01",
  "endDate": "2025-10-30"
}
```

#### POST /api/backtesting/data/sync
**Force historical data synchronization**

Response (200):
```json
{
  "message": "Data sync started in background"
}
```

### Analytics Endpoints

#### GET /api/backtesting/results/:id/metrics
**Get performance metrics**

Response (200):
```json
{
  "id": "backtest_123",
  "metrics": {
    "performance": {
      "totalReturn": 12.5,
      "annualizedReturn": 12.5,
      "netProfit": 12500
    },
    "risk": {
      "maxDrawdown": -8.5,
      "volatility": 14.5,
      "var95": -2.5,
      "cvar95": -3.2
    },
    "ratios": {
      "sharpeRatio": 1.245,
      "sortinoRatio": 1.456,
      "calmarRatio": 1.471,
      "informationRatio": 0.892,
      "profitFactor": 1.85
    },
    "trades": {
      "total": 24,
      "winning": 15,
      "losing": 9,
      "winRate": 62.5,
      "avgWin": 1250,
      "avgLoss": -833
    }
  }
}
```

#### GET /api/backtesting/results/:id/equity-history
**Get equity curve data**

Response (200):
```json
{
  "data": [
    {
      "date": "2024-01-01",
      "equity": 100000,
      "drawdown": 0
    },
    {
      "date": "2024-01-02",
      "equity": 100500,
      "drawdown": 0
    }
  ]
}
```

### Comparison Endpoints

#### GET /api/backtesting/results/:id/vs-paper
**Compare backtest vs paper trading account**

Response (200):
```json
{
  "backtest": {
    "return": 12.5,
    "sharpeRatio": 1.245,
    "drawdown": -8.5,
    "winRate": 62.5
  },
  "paper": {
    "return": 10.2,
    "sharpeRatio": 1.0,
    "drawdown": -10.0,
    "winRate": 58.3
  },
  "analysis": {
    "correlation": 0.85,
    "consistency": 92,
    "insights": "Backtest outperforms paper trading with better risk-adjusted returns"
  }
}
```

#### GET /api/backtesting/results/:id/vs-live
**Compare backtest vs live trading account**

Response (200):
```json
{
  "backtest": {
    "return": 12.5,
    "sharpeRatio": 1.245
  },
  "live": {
    "return": 9.8,
    "sharpeRatio": 0.95
  },
  "analysis": {
    "correlation": 0.78,
    "executionQuality": 88,
    "insights": "Live trading underperforms due to execution costs"
  }
}
```

### Optimization Endpoints

#### POST /api/backtesting/optimize
**Start parameter optimization**

Request:
```json
{
  "symbol": "AAPL",
  "strategyName": "moving_average_crossover",
  "parameterGrid": {
    "fastMA": [10, 20, 30],
    "slowMA": [50, 100, 200]
  },
  "objectiveMetric": "sharpe"
}
```

Response (200):
```json
{
  "id": "opt_123",
  "status": "running",
  "message": "Optimization started"
}
```

#### GET /api/backtesting/optimize/:id
**Get optimization progress**

Response (200):
```json
{
  "id": "opt_123",
  "status": "running",
  "progress": 45,
  "completed": 9,
  "total": 20,
  "bestMetric": 1.456
}
```

#### GET /api/backtesting/optimize/:id/results
**Get optimal parameters**

Response (200):
```json
{
  "id": "opt_123",
  "bestParameters": {
    "fastMA": 20,
    "slowMA": 100
  },
  "bestMetricValue": 1.567,
  "avgMetricValue": 1.245,
  "medianMetricValue": 1.300,
  "stdDev": 0.156,
  "completedAt": "2025-10-30T13:00:00Z"
}
```

### Health Check

#### GET /api/backtesting/health
**Check service health**

Response (200):
```json
{
  "status": "ok",
  "service": "backtesting-service",
  "version": "1.0.0",
  "timestamp": "2025-10-30T12:00:00Z",
  "components": {
    "database": true,
    "historicalDataManager": true,
    "analyticsEngine": true
  }
}
```

---

## Mobile Integration

### Setup Redux Store

```typescript
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { backtestingReducer, backtestingUIReducer } from './backtestingSlice';

export const store = configureStore({
  reducer: {
    backtesting: backtestingReducer,
    backtestingUI: backtestingUIReducer,
    // ... other slices
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### Use in Components

```typescript
import { useDispatch, useSelector } from 'react-redux';
import {
  startBacktest,
  selectBacktestLoading,
  selectBacktestError,
  selectSelectedBacktestResult
} from '../store/backtestingSlice';

export function MyComponent() {
  const dispatch = useDispatch<AppDispatch>();
  const loading = useSelector(selectBacktestLoading);
  const error = useSelector(selectBacktestError);
  const result = useSelector(selectSelectedBacktestResult);

  const handleStartBacktest = () => {
    dispatch(startBacktest({
      symbol: 'AAPL',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-01-01'),
      strategyCode: 'default',
      initialCapital: 100000,
      commission: 0.001,
      slippage: 0.0005
    }));
  };

  return (
    <View>
      <Button onPress={handleStartBacktest} disabled={loading}>
        Start Backtest
      </Button>
      {loading && <ActivityIndicator />}
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      {result && <Text>Return: {result.metrics.totalReturn}%</Text>}
    </View>
  );
}
```

---

## Performance Metrics

### Interpretation Guide

#### Sharpe Ratio (Ideal: > 1.0)
- Measures risk-adjusted returns
- **> 1.0**: Good strategy
- **> 1.5**: Excellent strategy
- **< 0.5**: Insufficient risk-reward

#### Sortino Ratio (Ideal: > 1.0)
- Like Sharpe but focuses on downside risk
- Better for strategies with asymmetric returns
- Similar interpretation to Sharpe

#### Calmar Ratio (Ideal: > 0.5)
- Return divided by max drawdown
- **> 1.0**: Excellent recovery capability
- **0.5-1.0**: Good recovery
- **< 0.5**: Poor recovery

#### Profit Factor (Ideal: > 1.5)
- Gross profit / gross loss ratio
- **> 2.0**: Excellent
- **1.5-2.0**: Good
- **1.0-1.5**: Average
- **< 1.0**: Losing strategy

#### Win Rate (Ideal: > 50%)
- Percentage of winning trades
- Combined with profit factor for full picture
- High win rate with low avg win can be problematic

#### Max Drawdown (Ideal: < -10%)
- Largest peak-to-trough decline
- Risk metric (lower is better)
- Critical for understanding worst-case scenario

#### Volatility (Ideal: < 20%)
- Annualized standard deviation of returns
- Measure of consistency
- Lower = more stable returns

---

## Best Practices

### 1. Data Range Selection

**Recommendation**: Test on 2-5 years of historical data
- **Short-term** (< 1 year): Subject to luck
- **Medium-term** (1-3 years): Good for validation
- **Long-term** (3-5+ years): Best for robustness

### 2. Configuration Settings

```typescript
// Conservative settings (lower risk)
initialCapital: 100000;
commission: 0.001;      // 0.1% per trade
slippage: 0.0005;       // 0.05% execution cost

// Aggressive settings (higher speed)
initialCapital: 50000;
commission: 0.0005;     // 0.05% per trade
slippage: 0.0002;       // 0.02% execution cost

// Realistic settings (recommended)
initialCapital: 100000;
commission: 0.001;      // Match your broker
slippage: 0.0005;       // Account for market impact
```

### 3. Strategy Development Workflow

1. **Paper Trade First**
   - Start with paper trading
   - Validate strategy in real-time
   - Build confidence

2. **Backtest Historical Data**
   - Multiple time periods
   - Different market conditions
   - Various symbols

3. **Compare Results**
   - Backtest vs Paper vs Live
   - Identify discrepancies
   - Understand execution differences

4. **Optimize Parameters**
   - Use optimization tool
   - Walk-forward analysis
   - Avoid overfitting

5. **Live Trading**
   - Start with small capital
   - Monitor closely
   - Scale gradually

### 4. Risk Management

```typescript
// Position sizing
const riskPerTrade = 0.02; // 2% of capital
const stopLoss = 0.05;      // 5% below entry
const positionSize = (capital * riskPerTrade) / stopLoss;

// Drawdown management
const maxAcceptableDrawdown = 0.15; // 15%
const dailyLossLimit = capital * 0.05; // 5% per day

// Profit taking
const takeProfit = 0.10;    // 10% above entry
```

### 5. Metrics to Monitor

**Essential Metrics**:
- ✅ Total Return
- ✅ Sharpe Ratio (risk-adjusted)
- ✅ Max Drawdown (risk)
- ✅ Win Rate (quality)
- ✅ Profit Factor (profitability)

**Advanced Metrics**:
- Sortino Ratio (downside risk)
- Calmar Ratio (recovery)
- Consecutive losses (resilience)
- Holding period (efficiency)

---

## Troubleshooting

### Common Issues

#### Backtest Status: "Failed"

**Possible Causes**:
- Invalid symbol
- No historical data available
- Date range too small
- Strategy error

**Solution**:
1. Check symbol availability: `/api/backtesting/data/symbols`
2. Verify date range: `/api/backtesting/data/:symbol`
3. Check error message in response
4. Try different symbol or date range

#### "Insufficient Buying Power" Error

**Cause**: Initial capital too low for position size

**Solution**:
```typescript
// Increase initial capital
initialCapital: 200000  // was 100000

// OR reduce position size in strategy
// Reduce lot sizes or frequency
```

#### Backtest Takes Too Long

**Cause**: Large dataset or complex calculations

**Solution**:
1. Reduce date range (test 1 year instead of 5)
2. Use larger timeframe (daily instead of hourly)
3. Simplify strategy logic

#### Results Show Unrealistic Returns

**Possible Issues**:
- Slippage too low
- Commission not configured
- Survivorship bias
- Lookahead bias

**Solution**:
```typescript
// Use realistic settings
commission: 0.001,  // Match your broker
slippage: 0.001,    // Account for wider spreads
```

#### Mobile App Crashes When Loading Results

**Cause**: Large dataset exceeding memory

**Solution**:
1. Clear app cache
2. Reduce equity curve data points
3. Load trades in batches

---

## FAQ

### Q: What's the difference between backtest and paper trading?
**A**:
- **Backtest**: Historical simulation, instant, shows what "would have" happened
- **Paper Trading**: Live simulation, real-time, shows what "is" happening
- Use backtest to validate strategy, then paper trade before going live

### Q: How accurate are backtests?
**A**:
- Generally 85-95% accurate
- Main differences: execution prices, order fills, slippage
- Always validate with paper trading before live trading

### Q: Can I change the strategy between backtests?
**A**:
- Yes, each backtest is independent
- Strategy code is stored per backtest
- Good practice to test multiple strategies

### Q: How long does a backtest take?
**A**:
- Typically 5-30 seconds for 1 year of daily data
- Longer for:
  - More years of data
  - Smaller timeframes (1m vs 1d)
  - Complex strategies

### Q: What's the recommended portfolio size?
**A**:
- **Backtest**: $100,000 (standard)
- **Paper Trading**: Match live capital
- **Live**: Start small, scale gradually

### Q: Can I compare multiple strategies?
**A**:
- Yes, run separate backtests
- Use optimization to find best parameters
- Use comparison features to vs paper/live

### Q: What's included in historical data?
**A**:
- Daily OHLCV (Open, High, Low, Close, Volume)
- Adjusted for splits and dividends
- From 2015 to present (growing)

### Q: How often is data updated?
**A**:
- Daily updates at market close
- Manual sync available via API
- Auto-sync runs every 4 hours

### Q: Can I export backtest results?
**A**:
- Currently: Via API as JSON
- Planned: PDF reports, CSV exports
- Trades and equity curve downloadable

### Q: What happens if data is missing?
**A**:
- System fills gaps using forward-fill
- Quality checks flag anomalies
- User notified of data issues

---

## Support & Resources

### Documentation
- API Reference: `/docs/api-reference.md`
- Type Definitions: `mobile/src/types/backtesting.ts`
- Redux Setup: `mobile/src/store/backtestingSlice.ts`

### Code Examples
- Setup Screen: `mobile/src/screens/BacktestSetupScreen.tsx`
- Results Screen: `mobile/src/screens/BacktestResultsScreen.tsx`

### Quick Links
- Health Check: `GET /api/backtesting/health`
- Available Symbols: `GET /api/backtesting/data/symbols`
- Current Time: Use `new Date()` for reference

### Getting Help
- Check this guide first
- Review error messages carefully
- Check API status: `/api/backtesting/health`
- Contact support with:
  - Backtest ID
  - Symbol tested
  - Date range
  - Error message

---

**Last Updated**: October 30, 2025
**Version**: 1.0.0
**Status**: Production Ready ✅

For questions or issues, contact the HMS development team.
