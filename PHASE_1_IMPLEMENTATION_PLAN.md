# PHASE 1 IMPLEMENTATION PLAN
## Market Segmentation, Earnings Intelligence, Event-Triggered Trading
**Document Version**: 1.0
**Date**: November 7, 2025
**Status**: Ready for Execution
**Duration**: 8-12 weeks (Q4 2025 - Q1 2026)
**Team Size**: 9-10 engineers (backend, frontend, data scientists, DevOps)

---

## EXECUTIVE SUMMARY

Phase 1 is the foundation layer establishing three core capabilities for HMS 2.0:

1. **Market Segmentation** - Segment users into 3 trading styles (Intraday, Swing, Position) with tiered products
2. **Earnings Intelligence** - AI/ML pipeline to detect earnings announcements and trigger adaptive trading behavior
3. **Event-Triggered Trading** - Real-time event detection system with dynamic risk management

**Key Metrics by End of Phase 1**:
- 500-1,000 active beta users
- 3 fully functional trading segments
- 3 subscription tiers operational
- 70%+ earnings prediction accuracy
- 98%+ event detection accuracy
- 99.5%+ system uptime
- Sub-100ms intraday latency

---

## ARCHITECTURE OVERVIEW

### Current State Analysis
✅ **Ready to Leverage**:
- Express.js + TypeScript backend
- PostgreSQL database with schema
- gRPC HTTP/2 implementation
- Redis caching layer
- Docker deployment pipeline
- JWT authentication
- Prometheus monitoring + Grafana
- React frontend with Redux

❌ **Gaps to Fill**:
- Market data APIs (real-time price feeds)
- Order execution engine
- Strategy execution system
- Earnings data pipeline
- ML model infrastructure
- WebSocket for real-time updates
- Event detection system
- Dynamic risk limits engine

### Phase 1 Architecture Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                     PHASE 1 ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Frontend (React + Redux)                             │  │
│  │ - User Dashboard, Order Form, Risk Shield UI         │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ NGINX (Reverse Proxy + Load Balancer)               │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Backend Services (Express.js)                        │  │
│  │ ┌────────────────┬────────────────┬─────────────────┐│  │
│  │ │ Segment        │ Earnings       │ Event Detection ││  │
│  │ │ Engine         │ Pipeline       │ Engine          ││  │
│  │ ├────────────────┼────────────────┼─────────────────┤│  │
│  │ │ Intraday       │ ETL Service    │ Market Events   ││  │
│  │ │ Swing          │ AI/ML Models   │ Corporate Events││  │
│  │ │ LongTerm       │ Inference API  │ Macro Events    ││  │
│  │ └────────────────┴────────────────┴─────────────────┘│  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Data Layer (PostgreSQL)                              │  │
│  │ - Segments, Tiers, Orders, Earnings, Events          │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Cache Layer (Redis)                                  │  │
│  │ - Market quotes, ML predictions, Risk limits         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  External Integrations:                                     │
│  ├─ NSE/BSE Data APIs (Market, Earnings)                   │
│  ├─ RBI Official Feeds (Monetary Policy)                   │
│  ├─ Financial News (Sentiment Analysis)                    │
│  └─ Broker APIs (Order Execution)                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## DETAILED FEATURE BREAKDOWN

### FEATURE 1: MARKET SEGMENTATION & PRODUCT TIERING

#### 1.1 Market Segmentation Framework (3 weeks)
**Purpose**: Categorize users into 3 trading segments with tailored configurations

**Sub-Tasks**:
1. **Define Segment Models** (1 week)
   - Intraday/Day Trading: 5-60min timeframes, HFT, high leverage (3-5x)
   - Swing Trading: 2-7 days, technical + sentiment analysis, medium leverage (2-3x)
   - Position Trading: 30+ days, fundamental analysis, low leverage (1-2x)

2. **Create Configuration Matrix** (1 week)
   - Per-segment parameters: leverage limits, stop-loss %, profit targets, position size limits
   - Risk profiles: aggressive, balanced, conservative
   - Output: JSON/Excel configuration with preset strategies (5+ per segment)

3. **Documentation & Validation** (1 week)
   - Segment Analysis Report (15 pages)
   - Technical specifications
   - Acceptance: Each segment has 5+ validated strategies

**Deliverables**:
```
📄 SEGMENT_DEFINITION.md
📄 SEGMENT_CONFIGURATION_MATRIX.json
📄 SEGMENT_ANALYSIS_REPORT.pdf
✅ 5+ predefined strategies per segment
```

---

#### 1.2 Tiered Product Architecture (4 weeks)
**Purpose**: Implement 3 subscription tiers with feature gates and usage metering

**Tier Definitions**:

| Aspect | Retail Lite | Pro Trader | Institutional |
|--------|------------|-----------|----------------|
| **Price** | ₹999-1,999/mo | ₹4,999-9,999/mo | ₹25,000+/mo |
| **Portfolio Limit** | ₹5L | ₹50L | Unlimited |
| **Max Positions** | 10 | 50 | Unlimited |
| **API Calls/day** | 1,000 | 50,000 | Unlimited |
| **Backtest Runs/mo** | 5 | 100 | Unlimited |
| **Alerts** | 5 | 50 | Unlimited |
| **Features** | Predefined strategies, basic analytics | Custom strategies, backtesting, webhook API, alerts | Full API, white-label, priority execution |

**Sub-Tasks**:
1. **Feature Gate System** (1.5 weeks)
   - Implement feature gate middleware (check user tier before API access)
   - Gate definitions: `STRATEGY_CUSTOM`, `BACKTESTING`, `ALERTS`, `API_ACCESS`, `WHITE_LABEL`
   - Enforcement at controller level + database constraints

2. **Usage Metering System** (1.5 weeks)
   - Track: API calls, backtest runs, alerts triggered per user
   - Database tables: `tier_usage_metrics`, `usage_logs`
   - Aggregation: Daily/monthly rollups for billing

3. **Pricing & Billing** (1 week)
   - Pricing calculator UI
   - Stripe/Razorpay integration (Phase 2)
   - Invoice generation

**Deliverables**:
```
📄 TIER_SPECIFICATION.md
✅ Feature Gate Implementation (middleware)
✅ Usage Metering Schema (database)
✅ Pricing Calculator (React component)
```

**Database Schema**:
```sql
-- Feature tiers
CREATE TABLE tiers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50),           -- "retail_lite", "pro_trader", "institutional"
  monthly_price DECIMAL(10,2),
  portfolio_limit DECIMAL(15,2),
  max_positions INT,
  api_calls_per_day INT,
  backtest_runs_per_month INT,
  alerts_per_month INT,
  created_at TIMESTAMP
);

-- User tier assignments
CREATE TABLE user_tiers (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  tier_id INT REFERENCES tiers(id),
  active_from TIMESTAMP,
  active_until TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active'
);

-- Usage tracking
CREATE TABLE tier_usage_metrics (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  metric_type VARCHAR(50),    -- "api_call", "backtest_run", "alert"
  usage_count INT DEFAULT 1,
  recorded_at TIMESTAMP,
  month_year VARCHAR(7)       -- "2025-11" for rollups
);

-- Feature gates
CREATE TABLE feature_gates (
  id SERIAL PRIMARY KEY,
  gate_name VARCHAR(100),     -- "STRATEGY_CUSTOM", "BACKTESTING", etc.
  tier_id INT REFERENCES tiers(id),
  enabled BOOLEAN DEFAULT true
);
```

---

#### 1.3 Backend Infrastructure for Segment Management (5 weeks)
**Purpose**: Implement 3 segment-specific microservices with hot-reload configuration

**Segment Engines**:

1. **Intraday Engine** (5-60min timeframes)
   - Real-time price updates via WebSocket
   - High-frequency order execution (<100ms latency)
   - Redis-backed quote cache
   - Technical indicators: RSI, MACD, Bollinger Bands, Volume Profile
   - Position monitoring every 5 minutes

2. **Swing Engine** (2-7 day timeframes)
   - Daily candle aggregation
   - Technical pattern recognition (head-n-shoulders, triangles, wedges)
   - Sentiment analysis from news
   - Daily batch processing
   - Position monitoring every hour

3. **LongTerm Engine** (30+ day timeframes)
   - Fundamental data aggregation (EPS, P/E, growth rates)
   - Macro indicators (interest rates, inflation, GDP growth)
   - Weekly rebalancing checks
   - Position monitoring daily

**Sub-Tasks**:
1. **Service Architecture** (2 weeks)
   - Base service class with common methods
   - Segment-specific implementations
   - Configuration service with hot-reload
   - Each independently deployable

2. **Database Schema for Segments** (1 week)
   - Segment definitions, parameters, active strategies
   - Segment-strategy mapping
   - User segment assignments

3. **API Layer** (1.5 weeks)
   - `/api/v1/segments` - List all segments
   - `/api/v1/segments/:id/config` - Get/update segment config
   - `/api/v1/strategies?segment=:segmentId` - Get strategies for segment
   - `/api/v1/orders/execute-segment` - Execute order with segment rules

4. **Testing & Deployment** (0.5 weeks)
   - Unit tests for each engine
   - Integration tests
   - Docker compose for all engines

**Deliverables**:
```
✅ Segment Engine Microservices (3 modules)
✅ Configuration Service with hot-reload
✅ Database Schema for segments
✅ API endpoints documented
✅ Docker Compose for multi-engine deployment
```

**Database Schema - Segments**:
```sql
CREATE TABLE trading_segments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),              -- "intraday", "swing", "longterm"
  description TEXT,
  timeframe VARCHAR(20),          -- "5min-60min", "2d-7d", "30d+"
  min_leverage DECIMAL(3,1),
  max_leverage DECIMAL(3,1),
  default_stop_loss_pct DECIMAL(4,2),
  default_profit_target_pct DECIMAL(4,2),
  max_position_size_pct DECIMAL(5,2),
  monitoring_frequency VARCHAR(20), -- "5min", "hourly", "daily"
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP
);

CREATE TABLE segment_strategies (
  id SERIAL PRIMARY KEY,
  segment_id INT REFERENCES trading_segments(id),
  name VARCHAR(100),
  description TEXT,
  indicators TEXT,               -- JSON: ["RSI", "MACD", "BB"]
  entry_rules TEXT,              -- JSON with conditions
  exit_rules TEXT,
  risk_management TEXT,          -- JSON with rules
  backtest_performance TEXT,     -- JSON with metrics
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP
);

CREATE TABLE user_segments (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  segment_id INT REFERENCES trading_segments(id),
  primary_segment BOOLEAN DEFAULT false,
  active_from TIMESTAMP,
  active_until TIMESTAMP,
  configuration TEXT             -- JSON with user-specific overrides
);
```

---

### FEATURE 2: ADAPTIVE LEARNING FROM EARNINGS PERFORMANCE

#### 2.1 Earnings Data Pipeline (4 weeks)
**Purpose**: Build automated ETL to capture earnings data, sentiment, and key metrics

**Data Sources**:
1. NSE/BSE official earnings calendars (API integration)
2. Broker APIs (NSE, BSE, Zerodha, Upstox)
3. Company investor relations websites (web scraping)
4. Financial news feeds (Reuters, Bloomberg alternatives)
5. Analyst reports aggregation

**ETL Process**:
```
Raw Data → Parsing → Enrichment → Validation → Storage
   ↓          ↓          ↓          ↓          ↓
 APIs    Extraction  Sentiment   Quality    PostgreSQL
Scrape   NLP        Analysis     Checks     (versioned)
```

**Sub-Tasks**:
1. **Data Sources Integration** (1.5 weeks)
   - NSE/BSE earnings calendar API client
   - Web scraping for earnings documents
   - Broker API aggregation
   - News feed integration

2. **Data Enrichment Pipeline** (1.5 weeks)
   - Sentiment scoring (NLP model: -1 to +1 scale)
   - Key metrics extraction: EPS, Revenue, Margins, Growth rates
   - Management commentary parsing (extract keywords)
   - Relative strength calculation (vs historical, sector average)

3. **Storage & Versioning** (1 week)
   - PostgreSQL schema with audit trail
   - Version tracking (daily snapshots)
   - Data quality metrics
   - Index optimization for queries

**Deliverables**:
```
✅ Data Pipeline Architecture Document
✅ ETL Scripts (Node.js/Python)
✅ Database Schema (earnings, metrics, sentiment)
✅ Data Quality Report + Validation Tests
```

**Database Schema - Earnings**:
```sql
CREATE TABLE earnings_announcements (
  id SERIAL PRIMARY KEY,
  company_symbol VARCHAR(10),
  company_name VARCHAR(200),
  announcement_date DATE,
  results_date DATE,
  fiscal_period VARCHAR(20),     -- "Q2 FY2025", etc.
  announcement_time TIME,
  announcement_type VARCHAR(50), -- "quarterly", "special"
  source VARCHAR(100),           -- "NSE", "BSE", "Company"
  data_quality_score DECIMAL(3,2), -- 0-1
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  raw_data TEXT                  -- JSON backup of raw data
);

CREATE TABLE earnings_metrics (
  id SERIAL PRIMARY KEY,
  earnings_id INT REFERENCES earnings_announcements(id),
  metric_name VARCHAR(100),      -- "eps", "revenue_growth", "profit_margin"
  metric_value DECIMAL(15,4),
  metric_unit VARCHAR(20),       -- "₹", "%", "x"
  previous_period_value DECIMAL(15,4),
  yoy_growth_pct DECIMAL(5,2),
  sector_average DECIMAL(15,4),
  vs_estimates DECIMAL(5,2),     -- surprise %
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP
);

CREATE TABLE earnings_sentiment (
  id SERIAL PRIMARY KEY,
  earnings_id INT REFERENCES earnings_announcements(id),
  sentiment_score DECIMAL(3,2),  -- -1 to +1
  sentiment_label VARCHAR(20),   -- "positive", "neutral", "negative"
  confidence DECIMAL(3,2),       -- 0-1
  key_positive_points TEXT,      -- JSON array
  key_negative_points TEXT,      -- JSON array
  management_tone VARCHAR(20),   -- "bullish", "cautious", "neutral"
  forward_guidance TEXT,         -- parsed forward guidance
  created_at TIMESTAMP
);

CREATE TABLE earnings_sentiment_history (
  id SERIAL PRIMARY KEY,
  earnings_id INT REFERENCES earnings_announcements(id),
  recorded_date DATE,
  sentiment_score DECIMAL(3,2),
  stock_price_change_pct DECIMAL(5,2),
  volume_change_pct DECIMAL(5,2)
);
```

---

#### 2.2 AI/ML Model for Earnings Impact (6 weeks)
**Purpose**: Train predictive models to forecast earnings impact on stock prices

**Models to Train**:

1. **Classification Model** (Earnings Reaction)
   - Input: Earnings metrics (EPS, revenue growth, margins, sentiment, sector context)
   - Output: Positive/Negative/Neutral (3-class)
   - Target Accuracy: 70%+
   - Framework: TensorFlow/PyTorch + scikit-learn

2. **Regression Model** (Price Movement Magnitude)
   - Input: Same as classification
   - Output: Expected price movement ±%
   - Time horizons: 5-day, 15-day, 30-day returns

3. **Anomaly Detection**
   - Detect unusual market reactions (over-reactions, under-reactions)
   - Identify potential opportunities

**Training Data**:
- Historical NSE/BSE data: 10+ years
- Past earnings announcements: 5,000+ samples
- Market reactions: 5/15/30 days post-announcement

**Sub-Tasks**:
1. **Data Preparation** (1.5 weeks)
   - Collect historical earnings (10+ years)
   - Align with stock price movements
   - Feature engineering (earnings_surprise, sentiment, sector_beta, etc.)
   - Train/test split (80/20), time-based validation

2. **Model Training & Evaluation** (3 weeks)
   - Baseline models (logistic regression, random forest)
   - Deep learning (LSTM for time series, CNN for pattern recognition)
   - Ensemble methods
   - Cross-validation and hyperparameter tuning

3. **Model Deployment** (1.5 weeks)
   - Export to ONNX/SavedModel format
   - Inference service (FastAPI/Express)
   - Real-time predictions for upcoming earnings
   - Monthly automated retraining pipeline

**Deliverables**:
```
✅ Model Training Notebooks (Jupyter)
✅ Trained Models (.pkl, .h5, ONNX)
✅ Backtesting Report (10-year validation)
✅ Inference Service API (Docker container)
✅ Monthly Retraining Pipeline (automated)
```

**Technical Stack**:
- **Languages**: Python 3.10+
- **ML Frameworks**: TensorFlow 2.13, PyTorch 2.0
- **Data Processing**: Pandas, NumPy, Polars
- **Visualization**: Matplotlib, Seaborn, Plotly
- **Deployment**: FastAPI, Docker
- **Monitoring**: MLflow, Weights & Biases

**Model Metrics**:
```
Classification Model:
├─ Accuracy: >70% (test set)
├─ Precision: >75%
├─ Recall: >70%
├─ False Positive Rate: <15%
└─ ROC-AUC: >0.75

Regression Model:
├─ R² Score: >0.6
├─ RMSE: <2% price movement
└─ MAE: <1.5%

Anomaly Detection:
├─ Precision: >80%
├─ Recall: >60%
└─ F1-Score: >0.7
```

---

#### 2.3 Earnings-Triggered Algorithm Behavior (4 weeks)
**Purpose**: Implement automatic trading adjustments based on earnings

**Conditional Trading Rules**:

```
IF earnings_prediction = "POSITIVE" THEN
  ├─ Increase position size: +10-25%
  ├─ Pyramiding logic: average-up on dips
  ├─ Profit target: +15-25% above entry
  ├─ Stop-loss: moved up (trailing)
  └─ Notify user: "Positive earnings detected"

ELSE IF earnings_prediction = "NEGATIVE" THEN
  ├─ Reduce exposure: -20-50%
  ├─ Tighten stop-loss: 2% → 1%
  ├─ Quick profit-taking: +5-10%
  ├─ Avoid new longs
  └─ Notify user: "Risk detected - position reduced"

ELSE (NEUTRAL)
  ├─ Keep standard rules
  └─ No adjustments
```

**Scale by Surprise Magnitude**:
- EPS Beat/Miss: ±5% = 1x adjustment
- EPS Beat/Miss: ±15% = 3x adjustment
- EPS Beat/Miss: ±25%+ = 5x adjustment

**Sub-Tasks**:
1. **Rule Engine** (1.5 weeks)
   - Parse earnings signals
   - Calculate adjustment multipliers
   - Apply rules to existing positions
   - Dry-run mode for preview

2. **User Notifications** (1 week)
   - 24-hour pre-earnings alert
   - 1-hour post-earnings summary
   - Hypothetical adjustments preview
   - Email + in-app notifications

3. **Safety & Rollback** (1 week)
   - User override (1-click to revert auto-adjustments)
   - Audit log of all adjustments
   - Manual approval mode (optional)
   - Rollback to pre-earnings state

4. **Testing & Validation** (0.5 weeks)
   - 3-year historical backtesting
   - Edge case testing
   - QA validation

**Deliverables**:
```
✅ Earnings Response Engine (code)
✅ Backtesting Report (3-year validation)
✅ Notification Templates
✅ Risk Management Documentation
```

**Database Schema - Earnings Actions**:
```sql
CREATE TABLE earnings_trading_actions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  position_id INT REFERENCES positions(id),
  earnings_id INT REFERENCES earnings_announcements(id),
  action_type VARCHAR(50),       -- "reduce_long", "increase_long", etc.
  action_reason TEXT,            -- prediction, surprise %, etc.
  before_state TEXT,             -- JSON: quantity, stop_loss, profit_target
  after_state TEXT,              -- JSON: new values
  executed BOOLEAN DEFAULT false,
  executed_at TIMESTAMP,
  user_approved BOOLEAN DEFAULT false,
  dry_run BOOLEAN DEFAULT true,
  created_at TIMESTAMP
);
```

---

### FEATURE 3: EVENT-TRIGGERED TRADING MODE

#### 3.1 Event Detection & Calendar System (3 weeks)
**Purpose**: Build real-time event detection system covering corporate, regulatory, macro events

**Event Types**:

| Category | Examples | Impact | Detection Method |
|----------|----------|--------|-----------------|
| **Corporate** | Earnings, dividends, buyback, block deals, mgmt changes | Stock-specific | NSE/BSE APIs + web scraping |
| **Regulatory** | RBI policy, SEBI announcements, IPO listings | Market-wide | Official feeds + news |
| **Macroeconomic** | CPI, inflation, IIP, employment, credit growth | Sector-specific | Ministry APIs + news |
| **Market Events** | Circuit breakers, trading halts, index rebalancing | Market-wide | Exchange APIs + monitoring |

**Data Sources** (priority order):
1. NSE/BSE official event calendars (API)
2. RBI website (scheduled policies, rate decisions)
3. Ministry of Finance website (budget, economic data)
4. News aggregators (Reuters, CNBC-TV18, Moneycontrol)
5. Exchange announcements (halt notifications)

**Detection Accuracy Target**: 98%+

**Sub-Tasks**:
1. **Event Calendar Schema** (1 week)
   - Event types, categories, impact levels
   - Data structure: date, time, symbol/sector, description
   - Historical archive (3+ years)

2. **Data Ingestion** (1 week)
   - NSE/BSE API clients
   - RBI schedule parser
   - News feed aggregators
   - Real-time monitoring scripts
   - Daily + real-time data update pipelines

3. **Event Matching Engine** (1 week)
   - Match events to user portfolios
   - Impact calculation (VaR impact, sector exposure)
   - Alert routing (email, push, in-app)
   - Latency target: <30 seconds from event occurrence

**Deliverables**:
```
✅ Event Calendar Schema (database)
✅ Event Detection Service (with 5+ data sources)
✅ Matching Algorithm (portfolio-to-events)
✅ Real-time Event Ticker (API endpoint)
```

**Database Schema - Events**:
```sql
CREATE TABLE event_calendar (
  id SERIAL PRIMARY KEY,
  event_name VARCHAR(200),
  event_category VARCHAR(50),    -- "corporate", "regulatory", "macro", "market"
  event_type VARCHAR(100),       -- "earnings", "rbi_policy", "cpi", etc.
  scheduled_date DATE,
  scheduled_time TIME,
  actual_date DATE,              -- filled if occurred
  actual_time TIME,
  symbols JSONB,                 -- affected symbols (null = all market)
  sectors JSONB,                 -- affected sectors
  description TEXT,
  expected_impact VARCHAR(50),   -- "high", "medium", "low"
  actual_outcome TEXT,           -- filled after event
  outcome_sentiment VARCHAR(20), -- "positive", "negative", "neutral"
  data_source VARCHAR(100),      -- "NSE", "RBI", "News", etc.
  source_reliability DECIMAL(3,2), -- 0-1 confidence
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE event_user_impacts (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  event_id INT REFERENCES event_calendar(id),
  impact_type VARCHAR(50),       -- "portfolio_impact", "sector_exposure", etc.
  estimated_impact_pct DECIMAL(5,2),
  alert_sent BOOLEAN DEFAULT false,
  alert_sent_at TIMESTAMP,
  created_at TIMESTAMP
);
```

---

#### 3.2 High-Alert Trading Mode (5 weeks)
**Purpose**: Implement mode switching with reduced risk exposure during high-impact events

**Mode Behavior**:

```
NORMAL MODE (standard trading)
├─ Standard position sizes
├─ Standard stop-loss (2%)
├─ Standard leverage (configured per segment)
└─ Monitoring: hourly

HIGH-ALERT MODE (triggered by event)
├─ Reduce position size: -30-50%
├─ Tighten stop-loss: 2% → 1%
├─ Increase profit-taking: +5-10%
├─ Reduce leverage: by 50%
├─ Pause new entries: true
├─ Monitoring: every 5 minutes
└─ Manual toggle by user
```

**Mode Triggers**:
- RBI monetary policy decision (high impact)
- Budget announcement (high impact)
- Company earnings (stock-specific)
- Major index rebalancing (market-wide)
- Trading halt/circuit breaker (market-wide)
- User manual toggle

**Sub-Tasks**:
1. **Mode Switching Engine** (2 weeks)
   - State management (normal ↔ high-alert)
   - Position size reduction logic
   - Stop-loss & profit-target adjustments
   - Real-time enforcement
   - Dry-run preview for users

2. **Frontend UI Components** (2 weeks)
   - Real-time event ticker (top of dashboard)
   - Mode indicator (visual badge)
   - "Risk Shield" toggle (manual control)
   - Event impact visualization
   - Position adjustments preview

3. **Testing & Validation** (1 week)
   - Edge case testing
   - Performance testing (100+ events/day)
   - User acceptance testing

**Deliverables**:
```
✅ Mode Switching Logic (backend)
✅ Event Ticker Component (React)
✅ Risk Shield Toggle (React)
✅ Position Adjustments API
✅ Dashboard Integration
```

**Backend Implementation**:
```typescript
interface HighAlertMode {
  enabled: boolean;
  trigger_event_id: number;
  position_size_reduction: 0.3 | 0.4 | 0.5;  // 30-50%
  stop_loss_adjustment: 2 | 1;                // % change
  profit_target_adjustment: -5 | -10;         // tighter targets
  leverage_reduction: 0.5;                    // 50% reduction
  allow_new_entries: boolean;
  monitoring_frequency: "5min" | "hourly";
  mode_start_time: timestamp;
  expected_duration: "hours" | "days";
}
```

---

#### 3.3 Dynamic Exposure Limits (4 weeks)
**Purpose**: Implement real-time position limit enforcement based on event proximity

**Limit Types**:

1. **Sector-Level Limits**
   - Max sector exposure during key events
   - Example: 20% max BFSI during RBI policy

2. **Stock-Level Limits**
   - Max position size: based on event proximity
   - Formula: `Position_Limit = Base_Size × (1 - Event_Impact × Time_Proximity)`
   - Closer to event = smaller positions allowed

3. **Leverage Limits**
   - Reduce available leverage during high-impact events
   - Example: max 5x → max 2.5x during RBI decision

4. **Trading Halts**
   - Auto-pause new entries during circuit breakers
   - Liquidation rules (sell at market if limits breached)

**Calculation Example**:
```
Base Position Size: ₹10L
Event Impact Score: 0.8 (0-1)
Time to Event: 2 days
Position Limit = ₹10L × (1 - 0.8 × 0.2) = ₹8.4L
```

**Sub-Tasks**:
1. **Risk Limits Engine** (2 weeks)
   - Limit calculation formulas
   - Real-time position size checks
   - Leverage reduction logic
   - Trading halt detection

2. **Enforcement** (1 week)
   - API request validation
   - Position rejection if breached
   - User alerts when limits hit
   - Audit trail

3. **Testing & Backtesting** (1 week)
   - Historical simulation (2+ years)
   - Impact on returns analysis
   - Edge case validation

**Deliverables**:
```
✅ Risk Limits Engine (code)
✅ Limit Calculation Formulas (documented)
✅ Alert System (API + notifications)
✅ Backtesting Report (impact analysis)
✅ Audit Trail (all limit enforcement)
```

**Database Schema - Risk Limits**:
```sql
CREATE TABLE dynamic_risk_limits (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  limit_type VARCHAR(50),        -- "sector", "stock", "leverage", "trade_halt"
  target_symbol VARCHAR(10),     -- NULL for sector/leverage limits
  target_sector VARCHAR(50),     -- NULL for stock/leverage limits
  base_limit DECIMAL(15,2),
  current_limit DECIMAL(15,2),
  reduction_pct DECIMAL(5,2),    -- how much reduced from base
  trigger_event_id INT REFERENCES event_calendar(id),
  limit_active BOOLEAN DEFAULT true,
  enforcement_level VARCHAR(20), -- "warning", "hard_stop"
  active_from TIMESTAMP,
  active_until TIMESTAMP,
  created_at TIMESTAMP
);

CREATE TABLE limit_violations (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  limit_id INT REFERENCES dynamic_risk_limits(id),
  attempted_position_size DECIMAL(15,2),
  allowed_position_size DECIMAL(15,2),
  violation_type VARCHAR(50),    -- "over_limit", "leverage_exceeded"
  rejected BOOLEAN DEFAULT true,
  created_at TIMESTAMP
);
```

---

## IMPLEMENTATION ROADMAP

### Week-by-Week Timeline (12 weeks total)

```
WEEKS 1-3: Foundation Setup (Parallel with Feature 1.1)
├─ Week 1: Team onboarding, environment setup, database migrations
├─ Week 2: Feature gate system, tier schema, basic metering
└─ Week 3: Segment models defined, configuration matrix created

WEEKS 1-3: Feature 1.1 Market Segmentation
├─ Week 1: Segment definitions, data modeling
├─ Week 2: Configuration matrix, strategy pre-definitions
└─ Week 3: Analysis report, validation, documentation

WEEKS 4-7: Feature 1.2 Tiered Product + 1.3 Backend
├─ Week 4-5: Feature gates, tier enforcement, metering implementation
├─ Week 6-7: Segment microservices, configuration service, hot-reload

WEEKS 4-7: Feature 2.1 Earnings Pipeline
├─ Week 4: Data source integration (NSE, brokers, scrapers)
├─ Week 5-6: ETL pipeline, data enrichment, sentiment scoring
└─ Week 7: Schema creation, data quality validation

WEEKS 8-10: Feature 2.2 ML Models + 2.3 Earnings Trading
├─ Week 8: Data preparation, feature engineering
├─ Week 9: Model training, evaluation, optimization
├─ Week 10: Inference service, earnings-triggered rules, notifications

WEEKS 3-5: Feature 3.1 Event Detection
├─ Week 3: Event calendar schema, data source setup
├─ Week 4: Event ingestion pipelines
└─ Week 5: Matching engine, portfolio impact calculation

WEEKS 6-10: Feature 3.2 High-Alert Mode + 3.3 Risk Limits
├─ Week 6-7: Mode switching engine, position adjustment logic
├─ Week 8: Frontend UI (ticker, toggle, visualizations)
├─ Week 9: Risk limits engine, enforcement, alerts
└─ Week 10: Testing, backtesting, validation

WEEKS 11-12: Integration & Deployment
├─ Week 11: System integration testing, cross-feature validation
├─ Week 12: Deployment to production, monitoring setup, go-live
```

---

## RESOURCE ALLOCATION

### Team Structure (9-10 people)

| Role | Count | Phase 1 Responsibilities |
|------|-------|-------------------------|
| **Backend Engineers** | 4 | Segment engines, earnings ETL, event detection, risk limits, API layer |
| **Frontend Engineers** | 2 | UI components, dashboards, real-time updates, event ticker |
| **Data Scientists** | 2 | ML model training, backtesting, feature engineering |
| **DevOps/Infrastructure** | 1 | Docker, deployment, monitoring, database optimization |
| **QA Engineer** | 1 | Testing, backtesting validation, production readiness |

### Sprint Structure (2-week sprints)
- **Sprint 1-2**: Feature 1.1 + 1.2 + infrastructure setup
- **Sprint 3-4**: Feature 1.3 + 2.1 + 3.1
- **Sprint 5-6**: Feature 2.2 + 2.3 + 3.2
- **Sprint 7**: Feature 3.3 + integration
- **Sprint 8**: Deployment + monitoring

---

## SUCCESS METRICS

### Feature Adoption
- **Segment Distribution**: 30-40% users per segment (Intraday 40%, Swing 30%, LongTerm 30%)
- **Tier Distribution**: 60% Retail Lite, 30% Pro, 10% Institutional
- **ARPU**: ₹2,500-3,000/user/month

### Technical Performance
- **API Latency**: <100ms (intraday), <50ms (risk limits)
- **Earnings Model Accuracy**: >70% on test set, <15% false positive rate
- **Event Detection**: 98%+ accuracy, <30s detection latency
- **System Uptime**: 99.5%+
- **Data Quality**: Zero loss, 100% audit trail

### Business KPIs
- **Users**: 500-1,000 active (closed beta)
- **Trades/Day**: 50-200 per user (avg)
- **Retention**: 80% monthly (first 90 days)
- **NPS**: >30
- **SEBI Compliance**: 100% (zero violations)

---

## RISK MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Earnings data quality issues | Medium | High | Implement multi-source validation, manual QA samples |
| ML model accuracy <70% | Medium | High | Ensemble methods, continuous retraining, fallback to conservative rules |
| Real-time event detection lag | Low | High | Redundant data sources, webhook callbacks, caching |
| Broker API rate limits | Low | Medium | Request queuing, batch processing, fallback to cached data |
| User adoption < 500 | Low | High | Beta marketing, feature releases, user feedback incorporation |
| SEBI compliance issues | Very Low | Critical | Legal review, audit trail, compliance dashboard |

---

## DEPENDENCIES & BLOCKERS

### External Dependencies
- ✅ NSE/BSE API access (usually available)
- ✅ Broker API credentials (existing from Phase 2)
- ⏳ RBI official feeds (may require registration)
- ⏳ News APIs (Reuters, Bloomberg - may require paid subscription)

### Internal Dependencies
- ✅ Current infrastructure (Docker, PostgreSQL, Redis)
- ✅ Authentication system (JWT)
- ✅ Frontend framework (React + Redux)
- ⏳ WebSocket support (needed for real-time updates)

### Critical Path
1. Database schema design (Week 1)
2. Data source integrations (Weeks 1-4)
3. ML model training data (Week 5)
4. API endpoint implementations (Weeks 4-10)
5. Frontend component development (Weeks 4-10)

---

## GIT COMMIT STRATEGY

Each major feature will have dedicated commits:

```bash
feat(segmentation): Implement market segmentation framework
feat(tiering): Add subscription tier feature gates
feat(earnings): Add earnings ETL pipeline
feat(earnings-ml): Train earnings impact prediction models
feat(events): Implement event detection system
feat(alerts): Add high-alert mode and risk limits
docs(phase1): Phase 1 implementation complete
```

---

## DOCUMENTATION DELIVERABLES

By end of Phase 1:
1. **API Documentation** (OpenAPI/Swagger)
   - All 9 features' endpoints documented
   - Request/response examples
   - Error codes and handling

2. **Architecture Diagrams**
   - System architecture overview
   - Service dependencies
   - Data flow diagrams
   - Database ER diagrams

3. **User Guides**
   - Segment selection guide
   - Tier feature comparison
   - Event notification settings
   - Risk management best practices

4. **Risk & Compliance**
   - Risk management policies
   - SEBI compliance documentation
   - Audit trail procedures
   - Data retention policies

---

## CONCLUSION

Phase 1 establishes the foundation for Hermes HF 2.0:
- **Market Segmentation** enables personalized trading strategies
- **Earnings Intelligence** provides AI-driven insights
- **Event-Triggered Trading** adds automated risk management

**Expected Outcome**: 500-1,000 beta users with 3 fully functional segments, proven 70%+ earnings prediction accuracy, and a scalable infrastructure for Phase 2.

---

**Status**: ✅ Ready for Execution
**Next Steps**: Kick-off team meeting, environment setup, Week 1 sprint planning
