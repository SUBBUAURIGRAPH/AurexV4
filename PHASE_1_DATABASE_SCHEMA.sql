-- ============================================================================
-- PHASE 1: MARKET SEGMENTATION, EARNINGS, EVENTS DATABASE SCHEMA
-- ============================================================================
-- Version: 1.0
-- Date: November 7, 2025
-- Target: PostgreSQL 15+
-- ============================================================================

-- ============================================================================
-- 1. MARKET SEGMENTATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS trading_segments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,              -- "intraday", "swing", "longterm"
  description TEXT,
  timeframe VARCHAR(50),                          -- "5min-60min", "2d-7d", "30d+"
  risk_profile VARCHAR(50),                       -- "aggressive", "balanced", "conservative"
  min_leverage DECIMAL(3,1) DEFAULT 1.0,
  max_leverage DECIMAL(3,1) DEFAULT 5.0,
  default_stop_loss_pct DECIMAL(4,2) DEFAULT 2.0,
  default_profit_target_pct DECIMAL(4,2) DEFAULT 5.0,
  max_position_size_pct DECIMAL(5,2) DEFAULT 5.0,
  monitoring_frequency VARCHAR(20) DEFAULT '5min', -- "5min", "hourly", "daily"
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS segment_strategies (
  id SERIAL PRIMARY KEY,
  segment_id INT NOT NULL REFERENCES trading_segments(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  strategy_code VARCHAR(50),                      -- "RSI_OVERSOLD", "MACD_CROSS", etc.
  indicators JSONB,                               -- ["RSI", "MACD", "Bollinger Bands"]
  entry_rules JSONB NOT NULL,                     -- { "RSI": { "min": 30, "max": 40 }, ... }
  exit_rules JSONB NOT NULL,                      -- { "profit_target": 5.0, "stop_loss": 2.0 }
  risk_management JSONB,                          -- { "max_position": 5.0, "position_sizing": "fixed" }
  backtest_performance JSONB,                     -- { "win_rate": 65, "profit_factor": 1.5, "sharpe": 0.8 }
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(segment_id, strategy_code)
);

CREATE TABLE IF NOT EXISTS user_segments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  segment_id INT NOT NULL REFERENCES trading_segments(id),
  primary_segment BOOLEAN DEFAULT false,          -- User's main trading segment
  active_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active_until TIMESTAMP,
  configuration JSONB,                            -- User-specific overrides
  performance_tracking JSONB,                     -- Win rate, Sharpe ratio, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, segment_id)
);

-- ============================================================================
-- 2. SUBSCRIPTION TIER & FEATURE GATE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id SERIAL PRIMARY KEY,
  tier_code VARCHAR(50) NOT NULL UNIQUE,          -- "retail_lite", "pro_trader", "institutional"
  tier_name VARCHAR(100) NOT NULL,
  tier_level INT NOT NULL,                        -- 1 (lite), 2 (pro), 3 (institutional)
  monthly_price_inr DECIMAL(10,2),
  portfolio_limit_inr DECIMAL(15,2),              -- Max portfolio size allowed
  max_positions INT,                              -- Max number of open positions
  max_strategies INT,                             -- Max active strategies
  api_calls_per_day INT,
  backtest_runs_per_month INT,
  alerts_per_month INT,
  max_leverage DECIMAL(3,1),
  webhook_enabled BOOLEAN DEFAULT false,
  white_label_enabled BOOLEAN DEFAULT false,
  priority_support BOOLEAN DEFAULT false,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_id INT NOT NULL REFERENCES subscription_tiers(id),
  active_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active_until TIMESTAMP,
  auto_renewal BOOLEAN DEFAULT true,
  status VARCHAR(50) DEFAULT 'active',            -- "active", "paused", "cancelled"
  billing_cycle VARCHAR(20) DEFAULT 'monthly',    -- "monthly", "yearly"
  payment_method VARCHAR(50),                     -- "razorpay", "stripe", "manual"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feature_gates (
  id SERIAL PRIMARY KEY,
  gate_code VARCHAR(100) NOT NULL UNIQUE,        -- "STRATEGY_CUSTOM", "BACKTESTING", "ALERTS", etc.
  gate_name VARCHAR(150),
  description TEXT,
  tier_id INT NOT NULL REFERENCES subscription_tiers(id),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(gate_code, tier_id)
);

CREATE TABLE IF NOT EXISTS tier_usage_metrics (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id INT NOT NULL REFERENCES user_subscriptions(id),
  metric_type VARCHAR(50) NOT NULL,              -- "api_call", "backtest_run", "alert"
  usage_count INT DEFAULT 1,
  metric_value DECIMAL(15,4),                     -- For flexible metric tracking
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  month_year VARCHAR(7),                          -- "2025-11" for monthly rollups
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tier_usage_user_month ON tier_usage_metrics(user_id, month_year);
CREATE INDEX idx_tier_usage_type ON tier_usage_metrics(metric_type, recorded_at);

-- ============================================================================
-- 3. EARNINGS DATA TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS earnings_announcements (
  id SERIAL PRIMARY KEY,
  company_symbol VARCHAR(10) NOT NULL,
  company_name VARCHAR(200),
  exchange VARCHAR(10),                           -- "NSE", "BSE"
  announcement_date DATE,
  announcement_time TIME,
  results_date DATE NOT NULL,
  fiscal_period VARCHAR(20),                      -- "Q2 FY2025"
  announcement_type VARCHAR(50),                  -- "quarterly", "annual", "special"
  source VARCHAR(100),                            -- "NSE", "BSE", "Company", "Broker"
  data_quality_score DECIMAL(3,2),                -- 0.0-1.0
  raw_data TEXT,                                  -- JSON backup of raw announcement
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_symbol, results_date)
);

CREATE INDEX idx_earnings_symbol ON earnings_announcements(company_symbol);
CREATE INDEX idx_earnings_date ON earnings_announcements(results_date);

CREATE TABLE IF NOT EXISTS earnings_metrics (
  id SERIAL PRIMARY KEY,
  earnings_id INT NOT NULL REFERENCES earnings_announcements(id) ON DELETE CASCADE,
  metric_name VARCHAR(100),                       -- "eps", "revenue", "profit", "margin"
  metric_code VARCHAR(50),                        -- "EPS", "REVENUE", "NET_PROFIT", etc.
  metric_value DECIMAL(15,4) NOT NULL,
  metric_unit VARCHAR(20),                        -- "₹", "%", "x"
  previous_period_value DECIMAL(15,4),
  yoy_growth_pct DECIMAL(5,2),                    -- Year-over-year growth %
  qoq_growth_pct DECIMAL(5,2),                    -- Quarter-over-quarter growth %
  sector_average DECIMAL(15,4),
  vs_estimates DECIMAL(5,2),                      -- Surprise % (actual vs consensus)
  verified BOOLEAN DEFAULT false,
  source VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS earnings_sentiment (
  id SERIAL PRIMARY KEY,
  earnings_id INT NOT NULL REFERENCES earnings_announcements(id) ON DELETE CASCADE,
  sentiment_score DECIMAL(3,2),                   -- -1.0 to +1.0
  sentiment_label VARCHAR(20),                    -- "positive", "neutral", "negative"
  confidence DECIMAL(3,2),                        -- 0.0-1.0
  analysis_method VARCHAR(100),                   -- "nlp_model_v1", "rule_based", etc.
  key_positive_points JSONB,                      -- Array of positive factors
  key_negative_points JSONB,                      -- Array of negative factors
  management_tone VARCHAR(30),                    -- "bullish", "neutral", "cautious"
  forward_guidance TEXT,                          -- Parsed forward-looking statements
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS earnings_sentiment_history (
  id SERIAL PRIMARY KEY,
  earnings_id INT NOT NULL REFERENCES earnings_announcements(id) ON DELETE CASCADE,
  recorded_date DATE NOT NULL,
  sentiment_score DECIMAL(3,2),
  stock_price_change_pct DECIMAL(5,2),           -- Stock price % change post-announcement
  volume_change_pct DECIMAL(5,2),                -- Trading volume % change
  days_after_announcement INT,                    -- 0, 1, 5, 15, 30
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_earnings_sentiment_history ON earnings_sentiment_history(earnings_id, days_after_announcement);

-- ============================================================================
-- 4. EARNINGS ML MODEL & INFERENCE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS earnings_ml_models (
  id SERIAL PRIMARY KEY,
  model_name VARCHAR(100) NOT NULL,
  model_version VARCHAR(20),                      -- "1.0", "1.1", etc.
  model_type VARCHAR(50),                         -- "classification", "regression", "anomaly_detection"
  framework VARCHAR(50),                          -- "tensorflow", "pytorch", "sklearn"
  model_file_path VARCHAR(500),                   -- S3 or local path to .pkl/.h5
  training_data_size INT,                         -- Number of samples trained on
  test_accuracy DECIMAL(5,3),                     -- 0.0-1.0
  test_precision DECIMAL(5,3),
  test_recall DECIMAL(5,3),
  test_f1_score DECIMAL(5,3),
  false_positive_rate DECIMAL(5,3),
  roc_auc DECIMAL(5,3),
  training_date DATE,
  last_retrained DATE,
  next_retrain_date DATE,
  production_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(model_name, model_version)
);

CREATE TABLE IF NOT EXISTS earnings_predictions (
  id SERIAL PRIMARY KEY,
  earnings_id INT NOT NULL REFERENCES earnings_announcements(id),
  model_id INT NOT NULL REFERENCES earnings_ml_models(id),
  prediction_class VARCHAR(20),                   -- "positive", "negative", "neutral"
  prediction_confidence DECIMAL(3,2),             -- 0.0-1.0
  predicted_price_change_pct DECIMAL(5,2),       -- Expected price movement
  predicted_movement_5d DECIMAL(5,2),             -- 5-day price movement
  predicted_movement_15d DECIMAL(5,2),            -- 15-day price movement
  predicted_movement_30d DECIMAL(5,2),            -- 30-day price movement
  actual_outcome VARCHAR(20),                     -- Filled after event
  actual_price_change_pct DECIMAL(5,2),
  prediction_correct BOOLEAN,
  prediction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_earnings_predictions_earnings ON earnings_predictions(earnings_id);

-- ============================================================================
-- 5. EARNINGS-TRIGGERED TRADING ACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS earnings_trading_actions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position_id INT,                                -- Reference to open position (if exists)
  earnings_id INT NOT NULL REFERENCES earnings_announcements(id),
  action_type VARCHAR(50),                        -- "reduce_long", "increase_long", "add_stop_loss"
  action_reason TEXT,                             -- Why action was triggered
  prediction_class VARCHAR(20),                   -- "positive", "negative", "neutral"
  adjustment_multiplier DECIMAL(3,2),             -- 1x, 3x, 5x based on surprise %
  before_state JSONB,                             -- { "qty": 100, "stop_loss": 2.0, "profit_target": 5.0 }
  after_state JSONB,                              -- Updated values
  executed BOOLEAN DEFAULT false,
  executed_at TIMESTAMP,
  user_approved BOOLEAN,
  approval_method VARCHAR(50),                    -- "auto", "manual", "1click_confirm"
  dry_run BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_earnings_actions_user ON earnings_trading_actions(user_id, executed);

-- ============================================================================
-- 6. EVENT CALENDAR & DETECTION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_calendar (
  id SERIAL PRIMARY KEY,
  event_name VARCHAR(200) NOT NULL,
  event_category VARCHAR(50) NOT NULL,           -- "corporate", "regulatory", "macro", "market"
  event_type VARCHAR(100),                        -- "earnings", "rbi_policy", "cpi", "circuit_breaker"
  scheduled_date DATE,
  scheduled_time TIME,
  actual_date DATE,
  actual_time TIME,
  symbols JSONB,                                  -- Array of affected symbols (null = all market)
  sectors JSONB,                                  -- Array of affected sectors
  description TEXT,
  expected_impact VARCHAR(50),                    -- "high", "medium", "low"
  impact_score DECIMAL(3,2),                      -- 0.0-1.0 quantified impact
  actual_outcome TEXT,                            -- Filled after event
  outcome_sentiment VARCHAR(20),                  -- "positive", "negative", "neutral"
  outcome_magnitude DECIMAL(5,2),                 -- Magnitude of impact
  data_source VARCHAR(100),                       -- "NSE", "RBI", "News", "Exchange"
  source_reliability DECIMAL(3,2),                -- 0.0-1.0 confidence in source
  detection_latency_seconds INT,                  -- How fast we detected it
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_type, scheduled_date)
);

CREATE INDEX idx_event_calendar_date ON event_calendar(scheduled_date);
CREATE INDEX idx_event_calendar_category ON event_calendar(event_category);
CREATE INDEX idx_event_calendar_impact ON event_calendar(impact_score DESC);

CREATE TABLE IF NOT EXISTS event_user_impacts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INT NOT NULL REFERENCES event_calendar(id),
  impact_type VARCHAR(50),                        -- "portfolio_impact", "sector_exposure", "stock_exposure"
  estimated_var_impact DECIMAL(5,2),              -- Value at Risk % impact
  portfolio_exposure_pct DECIMAL(5,2),            -- User's exposure to affected assets
  affected_symbols JSONB,                         -- User's holdings in affected stocks
  affected_sectors JSONB,                         -- User's exposure to affected sectors
  alert_sent BOOLEAN DEFAULT false,
  alert_sent_at TIMESTAMP,
  alert_channel VARCHAR(50),                      -- "email", "push", "in_app"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_impacts_user ON event_user_impacts(user_id, alert_sent);

-- ============================================================================
-- 7. HIGH-ALERT MODE & DYNAMIC RISK LIMITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS high_alert_modes (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_event_id INT REFERENCES event_calendar(id),
  enabled BOOLEAN DEFAULT false,
  position_size_reduction_pct DECIMAL(3,1),       -- 30, 40, 50
  stop_loss_adjustment_pct DECIMAL(3,1),          -- Tighten from 2% to 1%
  profit_target_adjustment_pct DECIMAL(3,1),      -- Tighten targets
  leverage_reduction_pct DECIMAL(3,1),            -- 50% reduction
  allow_new_entries BOOLEAN DEFAULT false,
  monitoring_frequency VARCHAR(20),               -- "5min", "hourly"
  mode_start_time TIMESTAMP,
  expected_duration_hours INT,
  manual_override BOOLEAN DEFAULT false,
  mode_status VARCHAR(50),                        -- "active", "paused", "ended"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dynamic_risk_limits (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  limit_type VARCHAR(50),                         -- "sector", "stock", "leverage", "trade_halt"
  target_symbol VARCHAR(10),
  target_sector VARCHAR(50),
  base_limit_inr DECIMAL(15,2),                   -- Base position size
  current_limit_inr DECIMAL(15,2),                -- After reduction
  reduction_pct DECIMAL(5,2),                     -- % reduced from base
  trigger_event_id INT REFERENCES event_calendar(id),
  limit_active BOOLEAN DEFAULT true,
  enforcement_level VARCHAR(20),                  -- "warning", "hard_stop"
  active_from TIMESTAMP,
  active_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_risk_limits_user_type ON dynamic_risk_limits(user_id, limit_type);

CREATE TABLE IF NOT EXISTS limit_violations (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  limit_id INT NOT NULL REFERENCES dynamic_risk_limits(id),
  attempted_position_size DECIMAL(15,2),
  allowed_position_size DECIMAL(15,2),
  violation_type VARCHAR(50),                     -- "over_limit", "leverage_exceeded", "halt"
  rejected BOOLEAN DEFAULT true,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. PHASE 1 AUDIT & MONITORING
-- ============================================================================

CREATE TABLE IF NOT EXISTS phase1_audit_log (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(100),                       -- "feature_gate_check", "earnings_prediction", "event_detection"
  user_id INT REFERENCES users(id),
  resource_type VARCHAR(50),                      -- "position", "earnings", "event"
  resource_id INT,
  action_details JSONB,
  result VARCHAR(50),                             -- "success", "blocked", "error"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user_action ON phase1_audit_log(user_id, action_type);

-- ============================================================================
-- 9. INSERTIONS: SEED DATA FOR PHASE 1
-- ============================================================================

-- Insert default trading segments
INSERT INTO trading_segments (name, description, timeframe, risk_profile, min_leverage, max_leverage, default_stop_loss_pct, default_profit_target_pct, max_position_size_pct, monitoring_frequency)
VALUES
  ('intraday', 'High-frequency intraday trading', '5min-60min', 'aggressive', 1.0, 5.0, 1.5, 5.0, 10.0, '5min'),
  ('swing', 'Short-term swing trading', '2d-7d', 'balanced', 1.0, 3.0, 2.0, 8.0, 8.0, 'hourly'),
  ('longterm', 'Long-term position trading', '30d+', 'conservative', 1.0, 2.0, 3.0, 12.0, 5.0, 'daily')
ON CONFLICT (name) DO NOTHING;

-- Insert subscription tiers
INSERT INTO subscription_tiers (tier_code, tier_name, tier_level, monthly_price_inr, portfolio_limit_inr, max_positions, max_strategies, api_calls_per_day, backtest_runs_per_month, alerts_per_month, max_leverage, webhook_enabled, white_label_enabled)
VALUES
  ('retail_lite', 'Retail Lite', 1, 1499.00, 5000000, 10, 5, 1000, 5, 5, 3.0, false, false),
  ('pro_trader', 'Pro Trader', 2, 7499.00, 50000000, 50, 20, 50000, 100, 50, 5.0, true, false),
  ('institutional', 'Institutional', 3, 25000.00, 999999999.99, 500, 100, 999999, 999, 999, 10.0, true, true)
ON CONFLICT (tier_code) DO NOTHING;

-- ============================================================================
-- 10. VIEWS FOR COMMON QUERIES
-- ============================================================================

CREATE OR REPLACE VIEW v_user_tier_status AS
SELECT
  us.user_id,
  st.tier_name,
  us.active_from,
  us.active_until,
  CASE
    WHEN us.active_until IS NULL OR us.active_until > CURRENT_TIMESTAMP THEN 'active'
    ELSE 'expired'
  END as tier_status
FROM user_subscriptions us
JOIN subscription_tiers st ON us.tier_id = st.id
WHERE us.status = 'active';

CREATE OR REPLACE VIEW v_earnings_insights AS
SELECT
  ea.company_symbol,
  ea.results_date,
  es.sentiment_label,
  es.confidence,
  ep.prediction_class,
  ep.prediction_confidence,
  COALESCE(ep.actual_price_change_pct, 0) as actual_return
FROM earnings_announcements ea
LEFT JOIN earnings_sentiment es ON ea.id = es.earnings_id
LEFT JOIN earnings_predictions ep ON ea.id = ep.earnings_id
ORDER BY ea.results_date DESC;

CREATE OR REPLACE VIEW v_active_events AS
SELECT
  *,
  CASE
    WHEN scheduled_date > CURRENT_DATE THEN 'upcoming'
    WHEN scheduled_date = CURRENT_DATE THEN 'today'
    WHEN scheduled_date < CURRENT_DATE AND actual_date IS NULL THEN 'missed'
    ELSE 'completed'
  END as event_status
FROM event_calendar
WHERE (scheduled_date <= CURRENT_DATE + INTERVAL '30 days')
ORDER BY scheduled_date ASC;

-- ============================================================================
-- 11. GRANT PERMISSIONS (Adjust as needed)
-- ============================================================================

-- Note: Uncomment and adjust based on your user roles
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO hms_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hms_app_user;

-- ============================================================================
-- END OF PHASE 1 SCHEMA
-- ============================================================================
