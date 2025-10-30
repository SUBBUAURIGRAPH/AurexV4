# Paper Trading System - HMS Trading Platform
**Version**: 2.0.0
**Release Date**: October 30, 2025
**Status**: Production Ready

## Table of Contents
1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Mobile Integration](#mobile-integration)
7. [Usage Guide](#usage-guide)
8. [Performance Metrics](#performance-metrics)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Paper Trading System enables users to practice trading without risking real capital. It provides a complete simulation environment with real-time market data, realistic order execution (including slippage and commissions), and comprehensive performance tracking.

### Key Benefits

- **Risk-Free Learning**: Practice trading strategies without financial risk
- **Real Market Data**: Uses actual market prices for realistic simulation
- **Performance Analytics**: Track detailed metrics like Sharpe ratio, win rate, and drawdown
- **Seamless Transition**: Easy migration from paper to live trading when ready
- **Full Feature Parity**: Same functionality as live trading (orders, positions, P&L tracking)

---

## Features

### 1. Account Management

#### Account Creation
- **Default Starting Capital**: $100,000 (configurable)
- **Multiple Accounts**: Users can create multiple paper trading accounts
- **Account Types**: Standard, Competition, Demo
- **Customizable Settings**: Commission rates, slippage, margin requirements

#### Account Configuration
```javascript
{
  initialCapital: 100000,      // Starting cash
  commissionRate: 0.001,       // 0.1% commission per trade
  slippageBuy: 0.001,          // 0.1% slippage on buys
  slippageSell: 0.001,         // 0.1% slippage on sells
  marginRequirement: 0.25,     // 25% margin for day trading
  allowShortSelling: true,     // Enable/disable short selling
  maxPositions: 10             // Max concurrent positions
}
```

### 2. Order Execution

#### Supported Order Types
- **Market Orders**: Immediate execution at current market price + slippage
- **Limit Orders**: Execute when price reaches specified limit
- **Stop Orders**: Trigger when stop price is reached
- **Stop-Limit Orders**: Combination of stop and limit orders

#### Execution Features
- **Realistic Slippage**: Configurable slippage simulation
- **Commission Tracking**: Automatic commission calculation and tracking
- **Instant Fill**: Market orders filled immediately with current prices
- **Real-Time Validation**: Order validation before execution
- **Buying Power Checks**: Prevents over-leveraging

### 3. Position Tracking

#### Real-Time Position Updates
- Current market value
- Unrealized P&L (dollar and percentage)
- Average cost basis
- Total cost including commissions
- Position entry date and time

#### Position Metrics
```javascript
{
  symbol: "AAPL",
  quantity: 100,
  side: "long",
  averageCost: 150.25,
  totalCost: 15025.00,
  currentPrice: 155.50,
  marketValue: 15550.00,
  unrealizedPl: 525.00,
  unrealizedPlPercent: 3.49,
  entryDate: "2025-10-30T10:00:00Z"
}
```

### 4. Performance Analytics

#### Account-Level Metrics
- **Total Return**: Overall percentage return on initial capital
- **Total P&L**: Net profit/loss in dollars
- **Unrealized vs Realized P&L**: Breakdown of open and closed positions
- **Win Rate**: Percentage of profitable trades
- **Profit Factor**: Ratio of gross profit to gross loss
- **Max Drawdown**: Largest peak-to-trough decline
- **Sharpe Ratio**: Risk-adjusted return metric

#### Trade-Level Metrics
- Total number of trades
- Winning trades count
- Losing trades count
- Average win amount
- Average loss amount
- Largest win
- Largest loss
- Total commission paid

### 5. Equity Curve Tracking

Historical equity snapshots captured at regular intervals:
- Total equity over time
- Cash vs position value breakdown
- Daily returns
- Total return progression
- Position count over time

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────┐
│         Mobile App (React Native)           │
│  ┌──────────────────────────────────────┐   │
│  │   Paper Trading Dashboard Screen     │   │
│  │   - Account Summary                  │   │
│  │   - Performance Metrics              │   │
│  │   - Position List                    │   │
│  │   - Order History                    │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │   Redux State (paperTradingSlice)    │   │
│  │   - Account State                    │   │
│  │   - Orders                           │   │
│  │   - Positions                        │   │
│  │   - Performance Data                 │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                    ↓ HTTP/REST
┌─────────────────────────────────────────────┐
│         Backend API Server (Node.js)        │
│  ┌──────────────────────────────────────┐   │
│  │ Paper Trading API Endpoints          │   │
│  │ /api/paper-trading/accounts          │   │
│  │ /api/paper-trading/orders            │   │
│  │ /api/paper-trading/positions         │   │
│  │ /api/paper-trading/performance       │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │ Paper Trading Manager                │   │
│  │ - Order Execution Engine             │   │
│  │ - Position Tracker                   │   │
│  │ - Performance Calculator             │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Database (MySQL/PostgreSQL)         │
│  - paper_trading_accounts                   │
│  - paper_trading_orders                     │
│  - paper_trading_positions                  │
│  - paper_trading_equity_history             │
│  - paper_trading_performance_metrics        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│       Market Data Provider (Real-time)      │
│  - Alpha Vantage / Polygon / IEX Cloud      │
│  - WebSocket for live price updates         │
└─────────────────────────────────────────────┘
```

### Data Flow

1. **Order Submission**:
   ```
   Mobile App → API Endpoint → Paper Trading Manager → Database
                              → Market Data (price lookup)
                              → Position Update → Equity History
   ```

2. **Performance Calculation**:
   ```
   Scheduled Job → Database Query → Calculate Metrics → Update Tables
   ```

3. **Real-Time Price Updates**:
   ```
   Market Data WebSocket → Price Cache → Position Revaluation → Push Update
   ```

---

## Database Schema

### paper_trading_accounts
```sql
CREATE TABLE paper_trading_accounts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',

  -- Capital
  initial_capital DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
  current_cash DECIMAL(15, 2) NOT NULL,
  buying_power DECIMAL(15, 2) NOT NULL,

  -- Configuration
  commission_rate DECIMAL(6, 4) DEFAULT 0.0010,
  slippage_buy DECIMAL(6, 4) DEFAULT 0.0010,
  slippage_sell DECIMAL(6, 4) DEFAULT 0.0010,
  margin_requirement DECIMAL(5, 4) DEFAULT 0.2500,
  allow_short_selling BOOLEAN DEFAULT true,
  position_limit INTEGER DEFAULT 10,

  -- Performance
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  total_pl DECIMAL(15, 2) DEFAULT 0.00,
  win_rate DECIMAL(5, 2) DEFAULT 0.00,
  profit_factor DECIMAL(10, 2) DEFAULT 0.00,
  max_drawdown DECIMAL(10, 2) DEFAULT 0.00,
  sharpe_ratio DECIMAL(10, 4) DEFAULT 0.00,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### paper_trading_orders
```sql
CREATE TABLE paper_trading_orders (
  id VARCHAR(36) PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(255) NOT NULL,

  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL,  -- 'buy', 'sell'
  type VARCHAR(20) NOT NULL,  -- 'market', 'limit', 'stop'
  quantity INTEGER NOT NULL,

  execution_price DECIMAL(15, 4),
  commission DECIMAL(15, 2) DEFAULT 0.00,
  slippage DECIMAL(15, 4) DEFAULT 0.00,
  realized_pl DECIMAL(15, 2) DEFAULT 0.00,

  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  filled_at TIMESTAMP,

  FOREIGN KEY (account_id) REFERENCES paper_trading_accounts(id)
);
```

### paper_trading_positions
```sql
CREATE TABLE paper_trading_positions (
  id VARCHAR(36) PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL,
  symbol VARCHAR(20) NOT NULL,

  quantity INTEGER NOT NULL,
  average_cost DECIMAL(15, 4) NOT NULL,
  total_cost DECIMAL(15, 2) NOT NULL,

  current_price DECIMAL(15, 4),
  market_value DECIMAL(15, 2),
  unrealized_pl DECIMAL(15, 2) DEFAULT 0.00,
  unrealized_pl_percent DECIMAL(10, 4) DEFAULT 0.00,

  entry_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (account_id) REFERENCES paper_trading_accounts(id),
  UNIQUE KEY (account_id, symbol)
);
```

---

## API Endpoints

### Account Management

#### Create Account
```http
POST /api/paper-trading/accounts
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "My Paper Account",
  "initialCapital": 100000,
  "commissionRate": 0.001,
  "allowShortSelling": true
}
```

**Response**:
```json
{
  "success": true,
  "account": {
    "id": "acc_123456",
    "userId": "user_789",
    "name": "My Paper Account",
    "initialCapital": 100000.00,
    "currentCash": 100000.00,
    "status": "active",
    "createdAt": "2025-10-30T10:00:00Z"
  }
}
```

#### Get Accounts
```http
GET /api/paper-trading/accounts
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "count": 2,
  "accounts": [
    {
      "id": "acc_123456",
      "name": "My Paper Account",
      "totalEquity": 105250.00,
      "totalReturn": 5.25,
      "status": "active"
    }
  ]
}
```

### Order Management

#### Submit Order
```http
POST /api/paper-trading/accounts/{accountId}/orders
Content-Type: application/json
Authorization: Bearer <token>

{
  "symbol": "AAPL",
  "side": "buy",
  "type": "market",
  "quantity": 10
}
```

**Response**:
```json
{
  "success": true,
  "order": {
    "id": "ord_789012",
    "accountId": "acc_123456",
    "symbol": "AAPL",
    "side": "buy",
    "quantity": 10,
    "executionPrice": 150.25,
    "commission": 1.50,
    "status": "filled",
    "filledAt": "2025-10-30T10:05:00Z"
  }
}
```

#### Get Orders
```http
GET /api/paper-trading/accounts/{accountId}/orders?status=filled&limit=20
Authorization: Bearer <token>
```

### Position Management

#### Get Positions
```http
GET /api/paper-trading/accounts/{accountId}/positions
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "count": 3,
  "positions": [
    {
      "id": "pos_345678",
      "symbol": "AAPL",
      "quantity": 10,
      "averageCost": 150.25,
      "currentPrice": 155.50,
      "marketValue": 1555.00,
      "unrealizedPl": 52.50,
      "unrealizedPlPercent": 3.49
    }
  ]
}
```

#### Refresh Positions
```http
POST /api/paper-trading/accounts/{accountId}/positions/refresh
Authorization: Bearer <token>
```

Updates all positions with current market prices.

### Performance Analytics

#### Get Performance Summary
```http
GET /api/paper-trading/accounts/{accountId}/performance
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "performance": {
    "accountId": "acc_123456",
    "initialCapital": 100000.00,
    "currentCash": 95000.00,
    "positionValue": 10500.00,
    "totalEquity": 105500.00,
    "totalReturn": 5.50,
    "totalPl": 5500.00,
    "unrealizedPl": 500.00,
    "realizedPl": 5000.00,
    "totalTrades": 25,
    "winningTrades": 18,
    "losingTrades": 7,
    "winRate": 72.00,
    "profitFactor": 2.5,
    "maxDrawdown": 3.2,
    "sharpeRatio": 1.85
  }
}
```

#### Get Equity History
```http
GET /api/paper-trading/accounts/{accountId}/equity-history?startDate=2025-10-01&limit=100
Authorization: Bearer <token>
```

Returns time-series data for equity curve visualization.

---

## Mobile Integration

### Redux Store Setup

```typescript
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import paperTradingReducer from './paperTradingSlice';

export const store = configureStore({
  reducer: {
    paperTrading: paperTradingReducer,
    // ... other reducers
  }
});
```

### Using Paper Trading in Components

```typescript
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPaperAccounts,
  submitPaperOrder,
  togglePaperMode
} from '../store/paperTradingSlice';

function TradingScreen() {
  const dispatch = useDispatch();
  const { isPaperMode, activeAccount, performance } = useSelector(
    state => state.paperTrading
  );

  useEffect(() => {
    if (isPaperMode && activeAccount) {
      dispatch(fetchPaperPerformance(activeAccount.id));
    }
  }, [isPaperMode, activeAccount]);

  const handlePlaceOrder = async () => {
    const order = {
      symbol: 'AAPL',
      side: 'buy',
      type: 'market',
      quantity: 10
    };

    await dispatch(submitPaperOrder({
      accountId: activeAccount.id,
      order
    }));
  };

  return (
    <View>
      <Switch
        value={isPaperMode}
        onValueChange={() => dispatch(togglePaperMode())}
      />
      {/* Trading UI */}
    </View>
  );
}
```

---

## Usage Guide

### Getting Started

1. **Create a Paper Trading Account**
   - Navigate to Paper Trading section
   - Click "Create Paper Account"
   - Choose starting capital (default $100,000)
   - Configure commission and slippage settings

2. **Enable Paper Trading Mode**
   - Toggle "Paper Mode" switch
   - Paper mode banner will appear on all trading screens
   - All orders will be simulated

3. **Place Your First Trade**
   - Search for a symbol (e.g., AAPL, TSLA, SPY)
   - Select order type (Market, Limit, Stop)
   - Enter quantity
   - Review order details
   - Submit order
   - Order executes immediately (for market orders)

4. **Monitor Performance**
   - View real-time P&L updates
   - Track positions in portfolio view
   - Review order history
   - Analyze performance metrics

### Best Practices

#### 1. Treat It Like Real Money
- Use the same risk management as you would with real capital
- Set stop-losses and take-profit levels
- Don't over-leverage positions
- Track your emotions and decision-making

#### 2. Test Your Strategy
- Paper trade for at least 2-3 months before going live
- Aim for consistent profitability
- Track your win rate and risk-reward ratio
- Document what works and what doesn't

#### 3. Analyze Performance
- Review trades weekly
- Identify patterns in winning and losing trades
- Calculate your edge (average win vs average loss)
- Monitor drawdown periods

#### 4. Transition to Live Trading
- Achieve 3+ months of consistent profitability
- Win rate above 55% recommended
- Profit factor above 1.5
- Max drawdown below 10%
- Start with smaller position sizes than paper trading

### Common Workflows

#### Daily Trading Routine
```
1. Market Open
   - Review open positions
   - Check overnight news
   - Update watchlist

2. During Trading Hours
   - Monitor positions
   - Execute planned trades
   - Adjust stop-losses
   - Take profits when targets hit

3. Market Close
   - Review day's performance
   - Document trade outcomes
   - Plan next day's trades
   - Update strategy notes
```

#### Performance Review (Weekly)
```
1. Calculate key metrics:
   - Total return
   - Win rate
   - Profit factor
   - Max drawdown

2. Identify top performers:
   - Best trades
   - Worst trades
   - Patterns and setups

3. Adjust strategy:
   - What worked?
   - What didn't?
   - What to improve?
```

---

## Performance Metrics

### Key Metrics Explained

#### 1. Total Return
- **Formula**: `(Current Equity - Initial Capital) / Initial Capital * 100`
- **Good Target**: > 10% annually
- **Interpretation**: Overall profitability of your trading

#### 2. Win Rate
- **Formula**: `Winning Trades / Total Trades * 100`
- **Good Target**: > 55%
- **Interpretation**: Percentage of profitable trades
- **Note**: High win rate doesn't guarantee profitability (risk/reward matters)

#### 3. Profit Factor
- **Formula**: `Gross Profit / Gross Loss`
- **Good Target**: > 1.5
- **Interpretation**: How much you make per dollar risked
- **Example**: 2.0 means you make $2 for every $1 lost

#### 4. Max Drawdown
- **Formula**: `(Peak Equity - Trough Equity) / Peak Equity * 100`
- **Good Target**: < 15%
- **Interpretation**: Largest peak-to-trough decline
- **Use**: Measures risk and capital preservation

#### 5. Sharpe Ratio
- **Formula**: `(Return - Risk-Free Rate) / Standard Deviation of Returns`
- **Good Target**: > 1.0 (excellent > 2.0)
- **Interpretation**: Risk-adjusted return
- **Use**: Compare different strategies

### Performance Benchmarks

| Metric | Beginner | Intermediate | Advanced | Elite |
|--------|----------|--------------|----------|-------|
| Total Return (Annual) | 5-10% | 10-20% | 20-40% | 40%+ |
| Win Rate | 45-50% | 50-60% | 60-70% | 70%+ |
| Profit Factor | 1.2-1.5 | 1.5-2.0 | 2.0-3.0 | 3.0+ |
| Max Drawdown | 20-30% | 15-20% | 10-15% | < 10% |
| Sharpe Ratio | 0.5-1.0 | 1.0-1.5 | 1.5-2.5 | 2.5+ |

---

## Best Practices

### Risk Management

1. **Position Sizing**
   - Never risk more than 2% of capital per trade
   - Use position size calculator
   - Account for volatility (larger positions for low-volatility stocks)

2. **Stop-Losses**
   - Always use stop-losses
   - Set stops based on technical levels, not arbitrary percentages
   - Adjust stops as price moves in your favor

3. **Diversification**
   - Don't put all capital in one position
   - Limit sector concentration (max 30% in one sector)
   - Use the position limit feature

4. **Capital Preservation**
   - Set daily loss limits
   - If you hit daily limit, stop trading for the day
   - Protect capital first, make profits second

### Trading Psychology

1. **Emotional Control**
   - Follow your trading plan
   - Don't chase trades
   - Accept losses gracefully
   - Don't revenge trade

2. **Discipline**
   - Stick to your strategy
   - Don't overtrade
   - Take scheduled breaks
   - Review and learn from each trade

3. **Continuous Learning**
   - Keep a trading journal
   - Review trades weekly
   - Study market patterns
   - Adapt and improve

---

## Troubleshooting

### Common Issues

#### Issue: Orders Not Executing
**Symptoms**: Order remains in "pending" status

**Solutions**:
1. Check if market is open (paper trading respects market hours)
2. Verify you have sufficient buying power
3. Check position limit hasn't been reached
4. Review order type (limit orders may not fill if price doesn't reach limit)

#### Issue: Incorrect P&L Calculations
**Symptoms**: P&L doesn't match expectations

**Solutions**:
1. Remember commissions are included in calculations
2. Slippage affects execution price
3. Refresh positions to update with latest prices
4. Check if using FIFO (First In, First Out) cost basis

#### Issue: Performance Metrics Not Updating
**Symptoms**: Statistics appear stale

**Solutions**:
1. Trigger manual refresh
2. Check database triggers are enabled
3. Verify background jobs are running
4. Review database connection status

#### Issue: Real-Time Prices Not Updating
**Symptoms**: Prices appear delayed or stuck

**Solutions**:
1. Check market data API status
2. Verify API key is valid
3. Check rate limits haven't been exceeded
4. Refresh the position view manually

### Getting Help

For additional support:
- Check API documentation: `/api/paper-trading/health`
- Review server logs for errors
- Contact support: support@aurex.in
- Community forum: community.aurex.in

---

## Roadmap

### Upcoming Features

**Q1 2026**:
- Paper trading competitions
- Strategy backtesting integration
- Advanced charting in mobile app
- Custom alerts and notifications

**Q2 2026**:
- Social trading (copy paper traders)
- Strategy marketplace
- Advanced risk analytics
- Multi-timeframe analysis

**Q3 2026**:
- Options paper trading
- Crypto paper trading
- Forex paper trading
- Portfolio optimization AI

---

## Conclusion

The Paper Trading System provides a comprehensive, realistic trading simulation environment. Use it to:

- Learn trading without risk
- Test new strategies
- Build confidence
- Develop discipline
- Track your progress

Remember: **Paper trading success doesn't guarantee live trading success**, but it's an essential step in becoming a profitable trader. Practice with discipline, analyze your performance, and transition to live trading only when you demonstrate consistent profitability.

**Happy Trading!** 🚀

---

**Document Version**: 2.0.0
**Last Updated**: October 30, 2025
**Maintained By**: HMS Development Team
**License**: Proprietary
