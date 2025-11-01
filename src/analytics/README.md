# Analytics System

Comprehensive real-time analytics system for trading strategies with performance tracking, risk analysis, portfolio management, and intelligent alerts.

**Version**: 1.0.0 (Sprint 4 - Phase 1)
**Status**: ✅ Core Implementation Complete

## 📊 Overview

The Analytics system provides enterprise-grade analytics capabilities for the HMS trading platform:

- **Performance Analytics**: Sharpe ratio, Sortino ratio, Calmar ratio, volatility, drawdowns
- **Risk Analytics**: Value at Risk (VaR), Conditional VaR, stress testing, risk scoring
- **Portfolio Analytics**: Asset allocation, diversification metrics, sector analysis
- **Trade Analytics**: Trade-by-trade analysis, win rates, profit factors, consecutive streaks
- **Alert System**: 8 different alert types with configurable thresholds
- **Daily Snapshots**: Aggregated metrics for easy historical analysis

## 🏗️ Architecture

```
Analytics System (src/analytics/)
├── Types (types.ts)
│   └── 25+ TypeScript interfaces
├── Analyzers
│   ├── PerformanceAnalyzer (500+ LOC)
│   ├── RiskAnalyzer (600+ LOC)
│   └── PortfolioAnalyzer (400+ LOC)
├── Engine
│   └── AnalyticsEngine (400+ LOC)
│       └── Orchestrates all analyzers + alert system
├── Index (index.ts)
│   └── Exports + Utilities
└── Tests (__tests__/)
    └── Comprehensive test suite (350+ LOC)
```

## 🚀 Getting Started

### Installation

```typescript
import {
  AnalyticsEngine,
  PerformanceAnalyzer,
  RiskAnalyzer,
  PortfolioAnalyzer,
  Analyzers,
  createAnalyticsEngine
} from './analytics';
```

### Quick Start

```typescript
// Create analytics engine for a user
const engine = createAnalyticsEngine('user123', {
  maxDrawdownAlert: 0.20,      // 20%
  volatilityAlert: 0.30,       // 30%
  lossStreakAlert: 5,          // 5 consecutive losses
  sharpeRatioRf: 0.02,         // 2% risk-free rate
  lookbackDays: 252            // 1 year
});

// Calculate comprehensive analytics
const analytics = await engine.calculateAnalytics(
  'strategy123',
  historicalData,      // PerformanceMetrics[]
  trades,              // TradeAnalytics[]
  positions,           // Array<{symbol, quantity, currentPrice}>
  cashBalance          // number
);

// Get summary
const summary = engine.getSummary(analytics);
console.log(summary);
// {
//   totalValue: 125000,
//   return: '25.00%',
//   sharpeRatio: '1.85',
//   maxDrawdown: '-15.32%',
//   winRate: '62.50%',
//   ...
// }
```

## 📈 Performance Metrics

### Available Metrics

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **Sharpe Ratio** | Risk-adjusted return | (Return - RF) / Volatility |
| **Sortino Ratio** | Downside-risk adjusted return | (Return - RF) / Downside Vol |
| **Calmar Ratio** | Return / Max Drawdown | Return / \|Max DD\| |
| **Volatility** | Standard deviation of returns | √(variance of returns) |
| **Max Drawdown** | Largest peak-to-trough decline | (Peak - Trough) / Peak |
| **Win Rate** | % of winning trades | Wins / Total Trades |
| **Profit Factor** | Gross wins / Gross losses | Total Wins / Total Losses |
| **Recovery Factor** | Total Profit / Max Drawdown | Profit / \|Max DD\| |
| **Expectancy** | Average profit per trade | Total Profit / # Trades |
| **Payoff Ratio** | Avg Win / Avg Loss | Avg Win / \|Avg Loss\| |

### Calculation Examples

```typescript
// Get performance metrics
const metrics = PerformanceAnalyzer.calculateMetrics(
  currentValue: 125000,
  previousValue: 120000,
  cumulativeReturn: 0.25,
  trades: [],
  lookbackData: [],
  riskFreeRate: 0.02
);

// Calculate specific metrics
const sharpeRatio = PerformanceAnalyzer.calculateSharpeRatio(
  dailyReturn: 0.001,
  volatility: 0.02,
  riskFreeRate: 0.02
);

const maxDrawdown = PerformanceAnalyzer.calculateMaxDrawdown(
  historicalData: []
);

const winRate = PerformanceAnalyzer.calculateWinRate(trades);

const profitFactor = PerformanceAnalyzer.calculateProfitFactor(trades);
```

## 🎯 Risk Metrics

### Available Risk Metrics

| Metric | Description | Use Case |
|--------|-------------|----------|
| **VaR 95/99** | Maximum loss at confidence level | Regulatory reporting |
| **CVaR 95/99** | Expected loss beyond VaR | Tail risk assessment |
| **Drawdown** | Decline from peak | Emotional tolerance |
| **Volatility** | Annualized standard deviation | Risk comparison |
| **Downside Vol** | Volatility of negative returns | Downside risk |
| **Risk Score** | 0-100 composite risk rating | Quick assessment |
| **Stress Tests** | Historical worst-case scenarios | Scenario planning |

### Calculation Examples

```typescript
// Calculate comprehensive risk metrics
const riskMetrics = RiskAnalyzer.calculateRiskMetrics(
  portfolioValue: 125000,
  historicalData: [],
  trades: [],
  confidenceLevel: 0.95
);

// Calculate specific risk metrics
const var95 = RiskAnalyzer.calculateValueAtRisk(returns, 0.95);
const cvar95 = RiskAnalyzer.calculateConditionalVaR(returns, 0.95);
const maxDrawdown = RiskAnalyzer.calculateMaxDrawdown(historicalData);

// Perform stress testing
const stressResults = RiskAnalyzer.performStressTests(
  historicalData,
  trades
);

// Calculate risk score (0-100)
const riskScore = RiskAnalyzer.calculateRiskScore(
  volatility,
  maxDrawdown,
  var95,
  return_
);
```

## 💼 Portfolio Analytics

### Available Portfolio Metrics

| Feature | Description |
|---------|-------------|
| **Asset Allocation** | Current % allocation to each asset |
| **Diversification Ratio** | Measure of portfolio diversification |
| **Concentration Index** | 1 - Herfindahl Index |
| **Sector Breakdown** | Allocation by sector |
| **Asset Class Mix** | Stocks, bonds, crypto, commodities, cash |
| **Correlation Matrix** | Asset correlations (simplified) |
| **Rebalancing** | Recommendations to reach target allocation |

### Calculation Examples

```typescript
// Calculate portfolio analytics
const portfolio = PortfolioAnalyzer.calculatePortfolioAnalytics(
  userId: 'user123',
  positions: [
    { symbol: 'AAPL', quantity: 100, currentPrice: 150 },
    { symbol: 'MSFT', quantity: 50, currentPrice: 300 }
  ],
  cashBalance: 25000
);

// Get diversification metrics
const diversification = PortfolioAnalyzer.calculateDiversification(
  allocation
);

// Get asset class breakdown
const assetClasses = PortfolioAnalyzer.getAssetClassBreakdown(assets);

// Get sector breakdown
const sectors = PortfolioAnalyzer.getSectorBreakdown(assets);

// Get rebalancing recommendations
const recommendations = PortfolioAnalyzer.getRebalancingRecommendations(
  currentAllocation,
  targetAllocation: { 'AAPL': 0.4, 'MSFT': 0.3, 'CASH': 0.3 }
);
```

## 🚨 Alert System

### Alert Types

| Alert Type | Trigger | Default Threshold |
|-----------|---------|-------------------|
| **DRAWDOWN** | Portfolio loss exceeds threshold | -20% |
| **VOLATILITY** | Annualized volatility too high | 30% |
| **LOSS_STREAK** | Consecutive losing trades | 5+ losses |
| **PROFIT_TARGET** | Profit target reached | Dynamic |
| **RISK_WARNING** | Risk score elevated | 75+ |
| **POSITION_LIMIT** | Single position too large | 40%+ |
| **CORRELATION_SPIKE** | Unexpected correlation increase | 0.8+ |
| **DIVERSIFICATION_LOW** | Profit factor indicates weak edge | <1.5 |

### Alert Configuration

```typescript
// Configure alert thresholds
engine.updateConfig({
  maxDrawdownAlert: 0.15,        // 15%
  volatilityAlert: 0.25,         // 25%
  lossStreakAlert: 3,            // 3 consecutive losses
  trackPerformance: true,
  trackRisk: true
});

// Listen to alerts
engine.on('alert', (alert: AnalyticsAlert) => {
  console.log(`🚨 ${alert.title}`);
  console.log(`Level: ${alert.alertLevel}`);
  console.log(`${alert.description}`);
});

// Acknowledge alert
engine.acknowledgeAlert(alertId);
```

## 📊 Trade Analytics

### Trade-Level Analysis

```typescript
// Get consecutive stats
const stats = PerformanceAnalyzer.getConsecutiveStats(trades);
// {
//   maxConsecutiveWins: 5,
//   maxConsecutiveLosses: 2,
//   currentStreak: 3,
//   currentStreakType: 'wins'
// }

// Calculate trade statistics
const tradeStats = engine.analytics.trades;
// {
//   totalTrades: 45,
//   winningTrades: 28,
//   losingTrades: 17,
//   avgWin: 450.25,
//   avgLoss: -280.50,
//   winRate: 0.6222,
//   totalProfit: 8250.75
// }
```

## 🗄️ Database Schema

### Tables Created

1. **analytics_performance_metrics** - Time-series performance data
2. **analytics_portfolio** - Portfolio allocation snapshots
3. **analytics_risk** - Risk metrics over time
4. **analytics_trades** - Trade-level analytics
5. **analytics_daily_snapshot** - Daily aggregated metrics
6. **analytics_alerts** - Alert history
7. **analytics_config** - User analytics configuration

### Views Created

- `v_current_performance` - Latest performance metrics
- `v_portfolio_allocation` - Latest portfolio allocation
- `v_risk_summary` - Latest risk metrics
- `v_trade_statistics` - Aggregate trade statistics

## 🧪 Testing

### Test Coverage

- ✅ PerformanceAnalyzer (20+ test cases)
- ⏳ RiskAnalyzer (tests in progress)
- ⏳ PortfolioAnalyzer (tests in progress)
- ⏳ AnalyticsEngine (tests in progress)

### Running Tests

```bash
npm test -- src/analytics/__tests__

# With coverage
npm test -- src/analytics/__tests__ --coverage

# Watch mode
npm test -- src/analytics/__tests__ --watch
```

## 📚 Utilities

### Formatting Utilities

```typescript
import { AnalyticsUtils } from './analytics';

// Format percentage
AnalyticsUtils.formatPercentage(0.1234, 2)  // "12.34%"

// Format currency
AnalyticsUtils.formatCurrency(15234.50)     // "$15,234.50"

// Format large numbers
AnalyticsUtils.formatNumber(1500000, 1)     // "1.5M"
AnalyticsUtils.formatNumber(1500, 1)        // "1.5K"

// Get risk level color
AnalyticsUtils.getRiskLevelColor('HIGH')    // "#EF4444" (red)

// Compare metrics
const comparison = AnalyticsUtils.compareMetrics(125000, 120000);
// { change: 5000, percentChange: 0.0417, trend: 'up' }

// Get time period label
AnalyticsUtils.getTimePeriodLabel(startDate, endDate) // "Monthly"
```

## 🔄 Event System

### Available Events

```typescript
// Performance/calculation complete
engine.on('metrics:calculated', (metrics) => {});

// Alert generated
engine.on('alert', (alert) => {});

// Alert acknowledged
engine.on('alert:acknowledged', (data) => {});

// Configuration updated
engine.on('config:updated', (config) => {});

// Cache cleared
engine.on('cache:cleared', () => {});

// Error occurred
engine.on('error', (error) => {});
```

## 📋 Configuration Options

```typescript
interface AnalyticsConfig {
  // Tracking
  trackPerformance: boolean;      // Default: true
  trackPortfolio: boolean;        // Default: true
  trackRisk: boolean;             // Default: true
  trackTrades: boolean;           // Default: true

  // Alert Thresholds
  maxDrawdownAlert: number;       // Default: 0.20 (20%)
  volatilityAlert: number;        // Default: 0.30 (30%)
  lossStreakAlert: number;        // Default: 5

  // Calculation Settings
  sharpeRatioRf: number;          // Default: 0.02 (2%)
  lookbackDays: number;           // Default: 252 (1 year)

  // Retention
  retentionDays: number;          // Default: 730 (2 years)
  autoCleanup: boolean;           // Default: true
}
```

## 🎨 Dashboard Integration

### Dashboard Widgets

The Analytics system is designed to power dashboard widgets:

```typescript
interface DashboardWidget {
  id: string;
  title: string;
  type: 'chart' | 'metric' | 'table' | 'gauge';
  data: ChartData | MetricData | TableData;
  lastUpdated: Date;
  refreshInterval?: number; // seconds
}
```

## 📈 Performance Considerations

- **In-Memory Cache**: Metrics cached for quick access
- **Indexed Queries**: Database indexes for fast time-series queries
- **Lazy Calculation**: Metrics calculated on-demand
- **Batch Operations**: Daily snapshots created nightly
- **Retention Policy**: Auto-cleanup of old data (configurable)

## 🔒 Security

- ✅ User isolation (userId check)
- ✅ Strategy isolation (strategyId scoping)
- ✅ Type-safe calculations
- ✅ Input validation
- ✅ Error handling

## 📝 Next Steps (Phase 2)

- [x] Core analytics implementation
- [ ] Backend Analytics API endpoints
- [ ] Real-time WebSocket updates
- [ ] Web Dashboard UI
- [ ] Mobile Analytics screens
- [ ] Advanced visualizations (charts)
- [ ] Export functionality (PDF, CSV)
- [ ] Performance optimization
- [ ] Additional analyzers (correlation, alpha/beta)

## 📚 Related Documentation

- [Analytics Architecture Guide](./ANALYTICS_ARCHITECTURE.md) (coming soon)
- [API Reference](./API_REFERENCE.md) (coming soon)
- [Configuration Guide](./CONFIGURATION.md) (coming soon)

## 🤝 Contributing

When extending the Analytics system:

1. Add types to `types.ts`
2. Create analyzer in `src/analytics/`
3. Integrate into `AnalyticsEngine`
4. Add tests to `__tests__/`
5. Update documentation

## 📄 License

Part of HMS (Hybrid Market Strategies) Platform
