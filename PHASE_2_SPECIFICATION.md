# HMS Phase 2: UI/UX Enhancements & Real Order Execution

**Date**: October 29, 2025
**Version**: 2.0 Planning Document
**Duration**: 2 weeks (Weeks 3-4)
**Target Completion**: November 15, 2025
**Status**: 📋 Planning Phase

---

## Executive Summary

Phase 2 focuses on **user-facing enhancements** and **real trading capabilities**. The phase is divided into three major work streams:

1. **2.1 Interactive Charts** (5 days) - Candlestick charts, technical indicators
2. **2.2 Real Order Execution** (6 days) - Live trading with Alpaca integration
3. **2.3 Mobile App** (10 days) - iOS/Android with React Native

### Success Criteria
- ✅ Interactive candlestick charts with MA, RSI, MACD indicators
- ✅ Real order submission and execution via Alpaca API
- ✅ Order confirmation workflow with P&L tracking
- ✅ Mobile-responsive design for all features
- ✅ 90%+ test coverage
- ✅ Production-ready performance (<2s chart load)

---

## Phase 2.1: Interactive Charts Dashboard

### Current State Assessment

✅ **Existing Implementations**:
- Chart.js CDN integration (`plugin/public/charts-dashboard.html`)
- Basic chart structure with HTML/CSS
- Navigation and controls UI
- Date range picker stub

⚠️ **Gaps**:
- No candlestick chart implementation
- Technical indicators not calculated
- Real-time data streaming missing
- Chart interaction (zoom, pan) not implemented

### Architecture Design

#### System Overview

```
┌─────────────────────────────────────────────────────┐
│         Frontend (Browser / Mobile)                 │
├─────────────────────────────────────────────────────┤
│  charts-ui.js (React component)                     │
│  ├─ CandlestickChart (Chart.js wrapper)            │
│  ├─ TechnicalIndicators (MA, RSI, MACD)           │
│  └─ PortfolioVisualization (Pie, Bar charts)      │
├─────────────────────────────────────────────────────┤
│         API Layer (Backend)                         │
├─────────────────────────────────────────────────────┤
│  /api/charts/history/{symbol}                       │
│  /api/charts/indicators/{symbol}                    │
│  /api/portfolio/summary                             │
│  /api/portfolio/allocation                          │
├─────────────────────────────────────────────────────┤
│         Market Data & Calculation                   │
├─────────────────────────────────────────────────────┤
│  MarketDataClient (Alpha Vantage / IEX)            │
│  TechnicalIndicatorCalculator                       │
│  └─ Moving Average (SMA, EMA)                       │
│  └─ RSI (Relative Strength Index)                   │
│  └─ MACD (Moving Avg Convergence Divergence)       │
└─────────────────────────────────────────────────────┘
```

#### Data Flow

```
User Request (Symbol: AAPL, Period: 1M)
         ↓
   /api/charts/history
         ↓
MarketDataClient.getIntraday(symbol)
         ↓
Cache Check (TTL: 60s)
         ↓
[API Provider] ← if expired
         ↓
Format OHLCV Data
         ↓
Send to Frontend
         ↓
Chart.js Render
```

### 2.1.1 Candlestick Chart Component

**File**: `plugin/public/js/candlestick-chart.js` (NEW - 400 lines)

**Features**:
```javascript
class CandlestickChart {
  constructor(canvasId, options = {}) {
    // Initialize Chart.js with custom candlestick plugin
    // Custom plugin to render OHLC candles
  }

  async loadData(symbol, period = '1D') {
    // Fetch OHLCV data from API
    // Transform to Chart.js format
  }

  render(ohlcData) {
    // Render candlestick chart
    // Show volume bars below
  }

  // Interactive features
  zoomIn() { }
  zoomOut() { }
  panLeft() { }
  panRight() { }
  resetView() { }
}
```

**Implementation Steps**:
1. Create custom Chart.js plugin for candlestick rendering
2. Fetch OHLC data from market data API
3. Format data: [{ x: date, o: open, h: high, l: low, c: close, v: volume }]
4. Render candlestick + volume subplot
5. Add interaction handlers

**Data Format**:
```javascript
[
  {
    x: new Date('2025-10-29'),
    o: 180.50,  // Open
    h: 185.30,  // High
    l: 179.80,  // Low
    c: 183.20,  // Close
    v: 45000000 // Volume
  }
]
```

---

### 2.1.2 Technical Indicators Module

**File**: `plugin/chart-data/technical-indicators.js` (NEW - 600 lines)

**Indicators Implemented**:

#### 1. Simple Moving Average (SMA)
```javascript
calculateSMA(prices, period = 20) {
  // Calculate 20-day moving average
  // Return array of moving average values
}
```
- Period: 20, 50, 200 days (configurable)
- Uses: Trend identification
- Calculation: Average of last N prices

#### 2. Exponential Moving Average (EMA)
```javascript
calculateEMA(prices, period = 12) {
  // Calculate exponential moving average
  // More weight to recent prices
}
```
- Period: 12, 26 days
- Uses: Faster trend response
- Calculation: Weighted average with exponential decay

#### 3. Relative Strength Index (RSI)
```javascript
calculateRSI(prices, period = 14) {
  // Calculate RSI oscillator
  // Measures momentum
  // Range: 0-100
  // >70: Overbought, <30: Oversold
}
```
- Period: 14 days
- Range: 0-100
- Uses: Momentum identification
- Signals: Overbought (>70), Oversold (<30)

#### 4. MACD (Moving Average Convergence Divergence)
```javascript
calculateMACD(prices) {
  // Calculate MACD line, signal line, histogram
  const macdLine = EMA(prices, 12) - EMA(prices, 26);
  const signalLine = EMA(macdLine, 9);
  const histogram = macdLine - signalLine;
}
```
- MACD Line: 12-EMA - 26-EMA
- Signal Line: 9-EMA of MACD
- Histogram: MACD - Signal
- Uses: Trend momentum and direction

**Usage**:
```javascript
const indicators = new TechnicalIndicators(priceData);
const sma20 = indicators.sma(20);
const rsi14 = indicators.rsi(14);
const macd = indicators.macd();
```

**Performance**: Calculate 1,000 candles in <100ms

---

### 2.1.3 Portfolio Visualization

**File**: `plugin/public/js/portfolio-charts.js` (NEW - 400 lines)

**Chart Types**:

#### Allocation Pie Chart
```javascript
// Show portfolio allocation by sector/symbol
[
  { name: 'Technology', value: 45, color: '#667eea' },
  { name: 'Finance', value: 25, color: '#764ba2' },
  { name: 'Healthcare', value: 20, color: '#f093fb' },
  { name: 'Other', value: 10, color: '#4facfe' }
]
```

#### Performance Bar Chart
```javascript
// Show return by position
[
  { symbol: 'AAPL', return: 15.2, color: '#4ade80' },
  { symbol: 'GOOGL', return: -3.5, color: '#ef4444' },
  { symbol: 'MSFT', return: 8.1, color: '#4ade80' }
]
```

#### Portfolio Value Line Chart
```javascript
// Show portfolio value over time
[
  { date: '2025-01-01', value: 100000 },
  { date: '2025-02-01', value: 108500 },
  { date: '2025-03-01', value: 105200 },
  // ...
]
```

---

### 2.1.4 Backend APIs for Charts

**New Endpoints**:

#### GET /api/charts/history/{symbol}
```bash
GET /api/charts/history/AAPL?period=1M&interval=1D
Authorization: Bearer <token>

Response:
{
  "symbol": "AAPL",
  "period": "1M",
  "data": [
    {
      "date": "2025-10-01",
      "open": 175.50,
      "high": 178.30,
      "low": 174.80,
      "close": 177.20,
      "volume": 52300000
    }
  ]
}
```

#### GET /api/charts/indicators/{symbol}
```bash
GET /api/charts/indicators/AAPL?indicators=sma20,rsi14,macd
Authorization: Bearer <token>

Response:
{
  "symbol": "AAPL",
  "sma20": [177.15, 177.32, 177.48, ...],
  "rsi14": [65.2, 68.5, 72.1, ...],
  "macd": {
    "line": [0.35, 0.42, 0.51, ...],
    "signal": [0.30, 0.35, 0.40, ...],
    "histogram": [0.05, 0.07, 0.11, ...]
  }
}
```

#### GET /api/portfolio/summary
```bash
GET /api/portfolio/summary
Authorization: Bearer <token>

Response:
{
  "totalValue": 450000,
  "totalCost": 425000,
  "totalReturn": 25000,
  "totalReturnPercent": 5.88,
  "positions": [
    {
      "symbol": "AAPL",
      "quantity": 100,
      "avgCost": 175.50,
      "currentPrice": 183.20,
      "marketValue": 18320,
      "unrealizedPL": 770,
      "unrealizedPLPercent": 4.39
    }
  ]
}
```

---

### 2.1.5 Testing Strategy

**Unit Tests** (15 tests):
- ✅ Technical indicator calculations
- ✅ OHLC data formatting
- ✅ Chart rendering
- ✅ API response validation

**Integration Tests** (10 tests):
- ✅ Chart update with new data
- ✅ Indicator recalculation on data change
- ✅ Portfolio summary calculation
- ✅ Real-time data streaming

**E2E Tests** (5 tests):
- ✅ Load chart for symbol
- ✅ Change timeframe
- ✅ Toggle indicators
- ✅ View portfolio allocation
- ✅ Export chart as image

---

## Phase 2.2: Real Order Execution

### Current State Assessment

✅ **Existing Implementations**:
- AlpacaBroker class with API integration
- Order submission methods
- Position tracking
- Account information retrieval

⚠️ **Gaps**:
- No order confirmation workflow
- P&L calculation incomplete
- Real-time order updates missing
- Position monitoring missing

### Architecture Design

#### Order Execution Flow

```
┌──────────────────────────────────────────────┐
│     Place Order Request (Frontend)            │
├──────────────────────────────────────────────┤
│  Symbol: AAPL, Qty: 10, Type: MARKET, Side: BUY
├──────────────────────────────────────────────┤
│     Order Validation                          │
├──────────────────────────────────────────────┤
│  ✅ Symbol valid (exchange check)
│  ✅ Quantity valid (min/max checks)
│  ✅ Account has sufficient buying power
├──────────────────────────────────────────────┤
│     Confirmation Dialog (Frontend)            │
├──────────────────────────────────────────────┤
│  "Buy 10 AAPL at market price?"
│  Estimated cost: $1,832
│  Confirm / Cancel
├──────────────────────────────────────────────┤
│     Order Submission (Alpaca API)             │
├──────────────────────────────────────────────┤
│  POST /v2/orders
│  { symbol, qty, side, type, time_in_force }
├──────────────────────────────────────────────┤
│     Order Acknowledged (Broker)               │
├──────────────────────────────────────────────┤
│  Order ID: 12345, Status: PENDING_NEW
├──────────────────────────────────────────────┤
│     Real-time Update via WebSocket            │
├──────────────────────────────────────────────┤
│  Status: FILLED, Fill Price: $183.25
│  Quantity: 10, Commission: $1.50
├──────────────────────────────────────────────┤
│     Trade Confirmation (Frontend)             │
├──────────────────────────────────────────────┤
│  ✅ Order Filled
│  Bought: 10 AAPL @ $183.25 = $1,832.50
│  Commission: $1.50 | Total: $1,834.00
└──────────────────────────────────────────────┘
```

### 2.2.1 Order Management Enhancements

**File**: `plugin/broker/order-manager.js` (ENHANCE - 400 lines)

**Enhanced Features**:

```javascript
class OrderManager {
  // Existing methods
  async submitOrder(order) { }
  async getOrder(orderId) { }
  async listOrders(filters) { }
  async cancelOrder(orderId) { }

  // NEW: Order confirmation workflow
  async validateOrder(order) {
    // Check symbol validity
    // Check quantity constraints
    // Check account buying power
    // Return { valid, errors, estimatedCost }
  }

  async submitWithConfirmation(order, userConfirmation) {
    // Step 1: Validate order
    // Step 2: Wait for user confirmation
    // Step 3: Submit to broker
    // Step 4: Monitor for execution
  }

  // NEW: Order tracking
  async trackOrder(orderId, options = {}) {
    // Subscribe to order updates
    // Track status changes: PENDING → PARTIAL_FILL → FILLED
    // Call callback on each status change
  }

  // NEW: Order history
  async getOrderHistory(filters = {}) {
    // Symbol, Date range, Status filters
    // Return detailed order history with fills
  }

  // NEW: P&L calculation
  calculateOrderPL(order, currentPrice) {
    // For filled orders, calculate realized/unrealized P&L
    // Include commissions and fees
  }
}
```

**Order Validation Rules**:
```javascript
{
  // Symbol validation
  validSymbols: ['AAPL', 'GOOGL', 'MSFT', ...], // from exchange list

  // Quantity constraints
  minQuantity: 1,
  maxQuantity: 100000,

  // Order type constraints
  allowedTypes: ['MARKET', 'LIMIT', 'STOP', 'TRAILING_STOP'],

  // Order time in force
  allowedTimeInForce: ['DAY', 'GTC', 'OPG', 'CLS'],

  // Account constraints
  minBuyingPower: 100, // $100 minimum
  maxPositionSize: 50000 // $50,000 max per position
}
```

---

### 2.2.2 Real-time WebSocket Integration

**File**: `plugin/broker/websocket-manager.js` (NEW - 300 lines)

**Features**:
```javascript
class WebSocketManager {
  async connect(brokerConfig) {
    // Connect to Alpaca WebSocket
    // Subscribe to account events
    // Subscribe to order updates
  }

  onOrderUpdate(callback) {
    // Callback fired on order status change
    // Data: { orderId, status, filledQty, fillPrice, timestamp }
  }

  onTradeUpdate(callback) {
    // Callback fired on trade execution
    // Data: { symbol, qty, price, commission, timestamp }
  }

  onAccountUpdate(callback) {
    // Callback fired on account change
    // Data: { buyingPower, portfolioValue, equity }
  }

  async disconnect() {
    // Gracefully close WebSocket connection
  }
}
```

**WebSocket Events**:
- `trade_update`: Order filled or partially filled
- `account_update`: Account equity changes
- `order_update`: Order status changes

---

### 2.2.3 Position Tracking System

**File**: `plugin/broker/position-tracker.js` (NEW - 400 lines)

```javascript
class PositionTracker {
  constructor(broker) {
    this.broker = broker;
    this.positions = new Map();
    this.trades = []; // All trades
  }

  async syncPositions() {
    // Fetch positions from broker
    // Calculate metrics for each position
  }

  getPosition(symbol) {
    // Return position details with P&L
  }

  getAllPositions() {
    // Return all open positions
  }

  // Position metrics
  calculateMetrics(position, marketPrice) {
    return {
      symbol: position.symbol,
      quantity: position.qty,
      avgCost: position.avg_fill_price,
      currentPrice: marketPrice,
      marketValue: position.qty * marketPrice,
      costBasis: position.qty * position.avg_fill_price,
      unrealizedPL: position.qty * (marketPrice - position.avg_fill_price),
      unrealizedPLPercent: ((marketPrice - position.avg_fill_price) / position.avg_fill_price) * 100,
      gainLossPercent: position.unrealized_plpc * 100
    };
  }

  // Portfolio aggregates
  getPortfolioMetrics() {
    return {
      totalMarketValue: sum(position.market_value),
      totalCostBasis: sum(position.cost_basis),
      totalUnrealizedPL: sum(position.unrealized_pl),
      totalUnrealizedPLPercent: avg(position.unrealized_plpc),
      bestPerformer: max(position.unrealized_plpc),
      worstPerformer: min(position.unrealized_plpc)
    };
  }
}
```

---

### 2.2.4 Profit & Loss Calculation

**File**: `plugin/broker/pl-calculator.js` (NEW - 250 lines)

```javascript
class PLCalculator {
  /**
   * Calculate realized P&L for closed positions
   */
  calculateRealizedPL(trades) {
    // Match buy/sell pairs using FIFO method
    // Calculate profit/loss for each pair
    // Account for commissions
    return {
      totalRealizedPL: number,
      trades: [
        {
          buyDate, buyPrice, buyCost,
          sellDate, sellPrice, sellProceeds,
          quantity,
          realizedPL: sellProceeds - buyCost,
          commissions: number
        }
      ]
    };
  }

  /**
   * Calculate unrealized P&L for open positions
   */
  calculateUnrealizedPL(position, currentMarketPrice) {
    const marketValue = position.quantity * currentMarketPrice;
    const costBasis = position.quantity * position.avgCost;
    const unrealizedPL = marketValue - costBasis;
    const unrealizedPLPercent = (unrealizedPL / costBasis) * 100;

    return { unrealizedPL, unrealizedPLPercent, marketValue };
  }

  /**
   * Calculate total P&L (realized + unrealized)
   */
  calculateTotalPL(positions, trades) {
    const realizedPL = this.calculateRealizedPL(trades);
    const unrealizedPL = positions.reduce((sum, pos) =>
      sum + this.calculateUnrealizedPL(pos, pos.current_price).unrealizedPL, 0);

    return {
      realizedPL: realizedPL.totalRealizedPL,
      unrealizedPL,
      totalPL: realizedPL.totalRealizedPL + unrealizedPL,
      totalPLPercent: (totalPL / costBasis) * 100
    };
  }

  /**
   * Calculate P&L metrics for reporting
   */
  generatePLReport(positions, trades, dateRange) {
    return {
      period: dateRange,
      realizedGains: number,
      realizedLosses: number,
      unrealizedGains: number,
      unrealizedLosses: number,
      totalReturn: number,
      returnPercent: number,
      winRate: number,
      averageWin: number,
      averageLoss: number,
      profitFactor: number // Total wins / Total losses
    };
  }
}
```

---

### 2.2.5 Order Confirmation UI

**File**: `plugin/public/trading-order.html` (ENHANCE)

**Components**:

1. **Order Form**
   - Symbol input (with autocomplete)
   - Quantity input
   - Order type (Market, Limit, Stop, Trailing Stop)
   - Time in force (DAY, GTC)

2. **Order Preview**
   - Estimated cost/proceeds
   - Current market price
   - Available buying power
   - Estimated commission

3. **Confirmation Dialog**
   - Summary of order details
   - Risk/benefit analysis
   - Confirm / Cancel buttons
   - Order submission status

4. **Order Status Monitor**
   - Real-time status updates
   - Filled quantity tracking
   - Fill price display
   - Commission calculation

---

### 2.2.6 Testing Strategy

**Unit Tests** (20 tests):
- Order validation rules
- P&L calculations
- Position metrics
- Commission calculations

**Integration Tests** (15 tests):
- Order submission flow
- WebSocket updates
- Position synchronization
- P&L aggregation

**E2E Tests** (10 tests):
- Place market order
- Place limit order with confirmation
- Cancel order
- View order history
- Track real-time order updates

---

## Phase 2.3: Mobile App Architecture (Planning)

### Overview

**Platforms**: iOS + Android
**Framework Options**: React Native, Flutter
**Timeline**: 10 days (deferred to Phase 3 if needed)

### Architecture

```
┌─────────────────────────────────────┐
│     Mobile App (React Native)        │
├─────────────────────────────────────┤
│  Navigation Stack                    │
│  ├─ Home / Dashboard                │
│  ├─ Charts & Analysis               │
│  ├─ Trading / Orders                │
│  ├─ Portfolio                       │
│  └─ Settings / Profile              │
├─────────────────────────────────────┤
│  State Management (Redux)            │
│  ├─ Auth State                       │
│  ├─ Portfolio State                  │
│  ├─ Orders State                     │
│  └─ Market Data State                │
├─────────────────────────────────────┤
│  API Client (Redux-Thunk)            │
│  ├─ Authentication API               │
│  ├─ Trading API                      │
│  ├─ Market Data API                  │
│  └─ WebSocket (real-time updates)    │
├─────────────────────────────────────┤
│  Native Features                     │
│  ├─ Biometric Auth (Face ID)        │
│  ├─ Push Notifications               │
│  ├─ Offline Mode (SQLite)           │
│  └─ Local Storage (Sensitive data)   │
├─────────────────────────────────────┤
│  Backend API (HMS)                   │
└─────────────────────────────────────┘
```

### Key Features

1. **Authentication**
   - Login/Registration
   - Biometric authentication (Face ID/Fingerprint)
   - Session management
   - Logout

2. **Dashboard**
   - Portfolio summary
   - Account equity
   - Today's P&L
   - Quick stats

3. **Charts**
   - Interactive candlestick charts
   - Technical indicators
   - Multiple timeframes
   - Offline chart caching

4. **Trading**
   - Place orders (Market, Limit)
   - Order confirmation
   - Real-time order tracking
   - Order history

5. **Push Notifications**
   - Order filled alerts
   - Price alerts
   - Portfolio milestone alerts
   - News notifications

6. **Offline Mode**
   - Cache recent data
   - Queue orders for submission
   - View cached portfolio
   - Support offline authentication

---

## Phase 2 Schedule

### Week 3 (November 3-9, 2025)

**Monday-Tuesday (Days 1-2): Charts Architecture**
- [ ] Design chart component architecture
- [ ] Create candlestick chart component
- [ ] Implement Chart.js plugins
- [ ] Setup chart routing and navigation

**Wednesday-Thursday (Days 3-4): Technical Indicators**
- [ ] Implement SMA/EMA calculations
- [ ] Implement RSI calculation
- [ ] Implement MACD calculation
- [ ] Add indicator UI controls

**Friday (Day 5): Testing & Integration**
- [ ] Unit tests for indicators
- [ ] Integration tests for chart updates
- [ ] E2E tests for chart interactions
- [ ] Performance optimization

### Week 4 (November 10-16, 2025)

**Monday-Wednesday (Days 6-8): Order Execution**
- [ ] Enhance OrderManager with validation
- [ ] Implement WebSocket integration
- [ ] Create order confirmation workflow
- [ ] Build position tracker

**Thursday-Friday (Days 9-10): Testing & Documentation**
- [ ] Unit tests for order flow
- [ ] Integration tests with Alpaca API
- [ ] E2E tests for trading workflow
- [ ] Complete Phase 2 documentation

**November 11-15: P&L, Mobile Planning, Final Testing**
- [ ] P&L calculator implementation
- [ ] Mobile app architecture planning
- [ ] Comprehensive system testing
- [ ] Phase 2 completion report

---

## Deliverables

### Code (2,500+ LOC)
- [ ] Candlestick chart component (400 lines)
- [ ] Technical indicators (600 lines)
- [ ] Portfolio visualizations (400 lines)
- [ ] Order management enhancements (400 lines)
- [ ] WebSocket manager (300 lines)
- [ ] Position tracker (400 lines)
- [ ] P&L calculator (250 lines)

### Tests (60+ tests)
- [ ] Unit tests (35 tests, 90%+ coverage)
- [ ] Integration tests (20 tests)
- [ ] E2E tests (15 tests)

### Documentation (20,000+ words)
- [ ] Architecture documents
- [ ] API documentation
- [ ] Implementation guides
- [ ] Mobile app specification
- [ ] Phase 2 completion report

### Features
- [ ] Interactive candlestick charts
- [ ] 4 technical indicators (SMA, EMA, RSI, MACD)
- [ ] Portfolio allocation visualization
- [ ] Real-time order execution
- [ ] Order confirmation workflow
- [ ] Position tracking
- [ ] P&L calculation and reporting
- [ ] Mobile app architecture (planning)

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Chart load time | <2s | ⏳ Pending |
| Indicator calculation | <100ms (1K candles) | ⏳ Pending |
| Order submission | <1s | ⏳ Pending |
| WebSocket latency | <100ms | ⏳ Pending |
| Test coverage | 90%+ | ⏳ Pending |
| Documentation | 100% | ⏳ Pending |
| Bug-free | 0 critical issues | ⏳ Pending |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Chart rendering slow | Medium | High | Optimize with WebGL plugin |
| Alpaca API rate limits | Low | Medium | Implement caching and batching |
| WebSocket connection drops | Low | Medium | Auto-reconnect with backoff |
| Order validation edge cases | Medium | Medium | Comprehensive test coverage |
| Mobile app complexity | High | High | Defer to Phase 3 if needed |

---

## Dependencies

### External
- ✅ Alpaca API (already integrated)
- ✅ Market Data API (Alpha Vantage/IEX)
- ✅ Chart.js library
- ⏳ React Native framework (for mobile)
- ⏳ WebSocket client library

### Internal
- ✅ Phase 1 (Security hardening) - COMPLETE
- ✅ Authentication system (JWT, RBAC) - COMPLETE
- ✅ Rate limiting - COMPLETE
- ✅ Execution history - COMPLETE

---

## Budget & Resources

### Team Size
- **Senior Developer**: 1 (full-time)
- **QA Engineer**: 1 (75%)
- **DevOps**: 0.5 (as needed)
- **Total**: 2.5 FTE

### Timeline
- **Phase 2.1**: 5 days
- **Phase 2.2**: 6 days
- **Phase 2.3**: 10 days (planning + phase 3)
- **Testing/Docs**: 3 days
- **Total**: 14 days (2 weeks)

### Estimated Effort
- **Development**: 100 hours
- **Testing**: 30 hours
- **Documentation**: 20 hours
- **Total**: 150 hours

---

## Sign-off & Approval

**Phase 2 Planning Approval**:

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Tech Lead | Required | ⏳ | TBD |
| Product Manager | Required | ⏳ | TBD |
| QA Lead | Required | ⏳ | TBD |

---

## Appendices

### A: Technical Indicator Formulas

**SMA (Simple Moving Average)**
```
SMA = (P1 + P2 + ... + Pn) / n
```

**EMA (Exponential Moving Average)**
```
EMA = Price(today) × K + EMA(yesterday) × (1 - K)
where K = 2 / (N + 1)
```

**RSI (Relative Strength Index)**
```
RS = Average Gain / Average Loss
RSI = 100 - (100 / (1 + RS))
```

**MACD (Moving Average Convergence Divergence)**
```
MACD Line = 12-day EMA - 26-day EMA
Signal Line = 9-day EMA of MACD
Histogram = MACD Line - Signal Line
```

### B: Alpaca API Reference
- Account: `GET /v2/account`
- Positions: `GET /v2/positions`
- Orders: `POST /v2/orders`, `GET /v2/orders`
- Trades: `GET /v2/account/portfolio/history`

### C: File Structure
```
plugin/
├── public/
│   ├── charts-dashboard.html (ENHANCE)
│   ├── trading-order.html (ENHANCE)
│   └── js/
│       ├── candlestick-chart.js (NEW)
│       └── portfolio-charts.js (NEW)
├── broker/
│   ├── alpaca-broker.js (ENHANCE)
│   ├── order-manager.js (ENHANCE)
│   ├── position-tracker.js (NEW)
│   ├── pl-calculator.js (NEW)
│   └── websocket-manager.js (NEW)
└── chart-data/
    └── technical-indicators.js (NEW)
```

---

**Phase 2 Specification Complete**
**Target Start**: November 3, 2025
**Target Completion**: November 15, 2025
**Status**: 📋 Ready for Development
