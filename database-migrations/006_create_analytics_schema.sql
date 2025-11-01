-- =====================================================
-- Analytics System Database Migration
-- Creates time-series tables for comprehensive analytics
-- Version: 1.0.0
-- =====================================================

-- Enable TimescaleDB extension (if using PostgreSQL)
-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =====================================================
-- ANALYTICS METRICS TABLES
-- =====================================================

-- Performance Metrics (Time-series data)
-- Stores trading performance metrics over time
CREATE TABLE IF NOT EXISTS analytics_performance_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  strategy_id VARCHAR(36) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Price & Returns
  portfolio_value DECIMAL(20, 2) NOT NULL,
  daily_return DECIMAL(10, 6) NOT NULL,
  cumulative_return DECIMAL(10, 6) NOT NULL,
  price_change DECIMAL(20, 2) NOT NULL,

  -- Risk Metrics
  daily_volatility DECIMAL(10, 6),
  sharpe_ratio DECIMAL(10, 4),
  sortino_ratio DECIMAL(10, 4),
  calmar_ratio DECIMAL(10, 4),
  max_drawdown DECIMAL(10, 6),

  -- Trade Metrics
  win_rate DECIMAL(5, 4),
  profit_factor DECIMAL(10, 4),
  total_trades INT,
  winning_trades INT,
  losing_trades INT,
  avg_win DECIMAL(20, 2),
  avg_loss DECIMAL(20, 2),
  largest_win DECIMAL(20, 2),
  largest_loss DECIMAL(20, 2),

  -- Advanced Metrics
  recovery_factor DECIMAL(10, 4),
  expectancy DECIMAL(20, 2),
  payoff_ratio DECIMAL(10, 4),
  profit_loss DECIMAL(20, 2),

  INDEX idx_user_strategy_time (user_id, strategy_id, timestamp DESC),
  INDEX idx_timestamp (timestamp DESC),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Portfolio Analytics Table
-- Stores portfolio-level analytics
CREATE TABLE IF NOT EXISTS analytics_portfolio (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Portfolio Value
  total_value DECIMAL(20, 2) NOT NULL,
  cash_balance DECIMAL(20, 2) NOT NULL,
  invested_value DECIMAL(20, 2) NOT NULL,

  -- Asset Allocation
  allocation_json JSON NOT NULL, -- {symbol: {value: x, percentage: y}}

  -- Portfolio Metrics
  portfolio_return DECIMAL(10, 6),
  portfolio_volatility DECIMAL(10, 6),
  portfolio_sharpe_ratio DECIMAL(10, 4),
  portfolio_beta DECIMAL(10, 6),
  portfolio_alpha DECIMAL(10, 6),

  -- Diversification
  concentration_index DECIMAL(5, 4), -- Herfindahl index
  number_of_positions INT,
  largest_position_pct DECIMAL(5, 4),

  -- Correlation Metrics
  avg_correlation DECIMAL(5, 4),
  diversification_ratio DECIMAL(10, 4),

  INDEX idx_user_time (user_id, timestamp DESC),
  INDEX idx_timestamp (timestamp DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Risk Analytics Table
-- Stores risk metrics and analysis
CREATE TABLE IF NOT EXISTS analytics_risk (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  strategy_id VARCHAR(36),
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Value at Risk
  var_95 DECIMAL(20, 2), -- 95% confidence VaR
  var_99 DECIMAL(20, 2), -- 99% confidence VaR
  cvar_95 DECIMAL(20, 2), -- Conditional VaR (Expected Shortfall)
  cvar_99 DECIMAL(20, 2),

  -- Drawdown Metrics
  max_drawdown_percent DECIMAL(10, 6),
  current_drawdown_percent DECIMAL(10, 6),
  recovery_days INT,
  consecutive_losing_days INT,
  consecutive_losing_trades INT,

  -- Volatility Metrics
  annual_volatility DECIMAL(10, 6),
  downside_volatility DECIMAL(10, 6),
  upside_volatility DECIMAL(10, 6),
  volatility_ratio DECIMAL(10, 4),

  -- Stress Testing
  worst_day_loss DECIMAL(20, 2),
  worst_week_loss DECIMAL(20, 2),
  worst_month_loss DECIMAL(20, 2),
  best_day_gain DECIMAL(20, 2),
  best_week_gain DECIMAL(20, 2),
  best_month_gain DECIMAL(20, 2),

  -- Risk Rating
  risk_score DECIMAL(5, 2), -- 0-100 scale
  risk_level VARCHAR(20), -- LOW, MEDIUM, HIGH, CRITICAL

  INDEX idx_user_strategy_time (user_id, strategy_id, timestamp DESC),
  INDEX idx_timestamp (timestamp DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trade-Level Analytics
-- Stores detailed analytics for each trade
CREATE TABLE IF NOT EXISTS analytics_trades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  strategy_id VARCHAR(36) NOT NULL,
  trade_id VARCHAR(36) NOT NULL UNIQUE,

  symbol VARCHAR(20) NOT NULL,
  entry_time TIMESTAMP NOT NULL,
  exit_time TIMESTAMP,

  -- Trade Details
  entry_price DECIMAL(20, 8) NOT NULL,
  exit_price DECIMAL(20, 8),
  quantity INT NOT NULL,

  -- P&L
  entry_cost DECIMAL(20, 2) NOT NULL,
  exit_value DECIMAL(20, 2),
  gross_profit DECIMAL(20, 2),
  net_profit DECIMAL(20, 2),
  profit_percent DECIMAL(10, 6),

  -- Risk
  stop_loss_price DECIMAL(20, 8),
  take_profit_price DECIMAL(20, 8),
  max_profit_reached DECIMAL(20, 2),
  max_loss_reached DECIMAL(20, 2),

  -- Trade Metrics
  holding_time INT, -- Minutes
  consecutive_winning BOOLEAN,
  trade_type VARCHAR(20), -- LONG, SHORT
  status VARCHAR(20), -- OPEN, CLOSED

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_user_strategy_time (user_id, strategy_id, entry_time DESC),
  INDEX idx_symbol (symbol),
  INDEX idx_status (status),
  INDEX idx_entry_time (entry_time DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Daily Snapshot for quick aggregation
-- Stores daily aggregated metrics
CREATE TABLE IF NOT EXISTS analytics_daily_snapshot (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  strategy_id VARCHAR(36),
  snapshot_date DATE NOT NULL,

  -- Opening/Closing Values
  opening_value DECIMAL(20, 2),
  closing_value DECIMAL(20, 2),
  daily_change DECIMAL(20, 2),
  daily_return_pct DECIMAL(10, 6),

  -- Daily Metrics
  daily_high DECIMAL(20, 2),
  daily_low DECIMAL(20, 2),
  daily_volume INT,

  -- Trade Summary
  trades_count INT,
  winning_trades INT,
  losing_trades INT,
  winning_pct DECIMAL(5, 4),
  daily_profit DECIMAL(20, 2),

  -- Risk
  max_daily_drawdown DECIMAL(10, 6),
  daily_volatility DECIMAL(10, 6),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_user_strategy_date (user_id, strategy_id, snapshot_date),
  INDEX idx_user_date (user_id, snapshot_date DESC),
  INDEX idx_strategy_date (strategy_id, snapshot_date DESC),
  INDEX idx_snapshot_date (snapshot_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analytics Alerts/Events
-- Stores important analytics events and alerts
CREATE TABLE IF NOT EXISTS analytics_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  strategy_id VARCHAR(36),

  alert_type VARCHAR(50) NOT NULL, -- DRAWDOWN, VOLATILITY, LOSS_STREAK, PROFIT_TARGET, etc.
  alert_level VARCHAR(20) NOT NULL, -- INFO, WARNING, CRITICAL

  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,

  metric_name VARCHAR(100),
  metric_value DECIMAL(20, 6),
  threshold_value DECIMAL(20, 6),

  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP NULL,

  metadata JSON, -- Additional context

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_user_created (user_id, created_at DESC),
  INDEX idx_strategy_created (strategy_id, created_at DESC),
  INDEX idx_alert_level (alert_level),
  INDEX idx_acknowledged (is_acknowledged)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analytics Configuration
-- Stores user-specific analytics settings
CREATE TABLE IF NOT EXISTS analytics_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,

  -- Metrics to track
  track_performance BOOLEAN DEFAULT TRUE,
  track_portfolio BOOLEAN DEFAULT TRUE,
  track_risk BOOLEAN DEFAULT TRUE,
  track_trades BOOLEAN DEFAULT TRUE,

  -- Alert Thresholds
  max_drawdown_alert DECIMAL(5, 4) DEFAULT 0.20, -- 20%
  volatility_alert DECIMAL(5, 4) DEFAULT 0.30, -- 30%
  loss_streak_alert INT DEFAULT 5, -- 5 consecutive losses

  -- Calculation Settings
  sharpe_ratio_rf DECIMAL(5, 4) DEFAULT 0.02, -- Risk-free rate (2%)
  lookback_days INT DEFAULT 252, -- 1 year

  -- Retention Policy
  retention_days INT DEFAULT 730, -- 2 years
  auto_cleanup BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- VIEWS FOR COMMON ANALYTICS QUERIES
-- =====================================================

-- Current Performance Summary View
CREATE OR REPLACE VIEW v_current_performance AS
SELECT
  user_id,
  strategy_id,
  timestamp,
  portfolio_value,
  cumulative_return,
  sharpe_ratio,
  max_drawdown,
  win_rate,
  profit_factor,
  total_trades
FROM analytics_performance_metrics apm
WHERE (user_id, strategy_id, timestamp) IN (
  SELECT user_id, strategy_id, MAX(timestamp)
  FROM analytics_performance_metrics
  GROUP BY user_id, strategy_id
);

-- Portfolio Allocation View
CREATE OR REPLACE VIEW v_portfolio_allocation AS
SELECT
  user_id,
  timestamp,
  total_value,
  allocation_json,
  portfolio_return,
  portfolio_volatility,
  number_of_positions
FROM analytics_portfolio ap
WHERE (user_id, timestamp) IN (
  SELECT user_id, MAX(timestamp)
  FROM analytics_portfolio
  GROUP BY user_id
);

-- Risk Summary View
CREATE OR REPLACE VIEW v_risk_summary AS
SELECT
  user_id,
  strategy_id,
  timestamp,
  var_95,
  cvar_95,
  max_drawdown_percent,
  annual_volatility,
  risk_score,
  risk_level
FROM analytics_risk ar
WHERE (user_id, strategy_id, timestamp) IN (
  SELECT user_id, strategy_id, MAX(timestamp)
  FROM analytics_risk
  GROUP BY user_id, strategy_id
);

-- Trade Win Rate View
CREATE OR REPLACE VIEW v_trade_statistics AS
SELECT
  user_id,
  strategy_id,
  COUNT(*) as total_trades,
  SUM(CASE WHEN net_profit > 0 THEN 1 ELSE 0 END) as winning_trades,
  SUM(CASE WHEN net_profit <= 0 THEN 1 ELSE 0 END) as losing_trades,
  AVG(CASE WHEN net_profit > 0 THEN net_profit ELSE NULL END) as avg_win,
  AVG(CASE WHEN net_profit <= 0 THEN net_profit ELSE NULL END) as avg_loss,
  SUM(CASE WHEN net_profit > 0 THEN 1 ELSE 0 END) / COUNT(*) as win_rate,
  SUM(net_profit) as total_profit,
  AVG(holding_time) as avg_holding_minutes
FROM analytics_trades
WHERE status = 'CLOSED'
GROUP BY user_id, strategy_id;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_perf_user_time
ON analytics_performance_metrics(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_portfolio_user_time
ON analytics_portfolio(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_risk_user_time
ON analytics_risk(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_trades_closed
ON analytics_trades(user_id, strategy_id, status);

CREATE INDEX IF NOT EXISTS idx_analytics_alerts_unack
ON analytics_alerts(user_id, is_acknowledged);

-- =====================================================
-- STORED PROCEDURES
-- =====================================================

-- Procedure to calculate daily snapshot
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS sp_create_daily_snapshot()
BEGIN
  INSERT INTO analytics_daily_snapshot (
    user_id, strategy_id, snapshot_date,
    closing_value, daily_return_pct,
    trades_count, winning_trades, losing_trades,
    daily_profit
  )
  SELECT
    apm.user_id,
    apm.strategy_id,
    DATE(apm.timestamp),
    apm.portfolio_value,
    apm.daily_return,
    COUNT(at.id),
    SUM(CASE WHEN at.net_profit > 0 THEN 1 ELSE 0 END),
    SUM(CASE WHEN at.net_profit <= 0 THEN 1 ELSE 0 END),
    SUM(at.net_profit)
  FROM analytics_performance_metrics apm
  LEFT JOIN analytics_trades at ON apm.user_id = at.user_id
    AND apm.strategy_id = at.strategy_id
    AND DATE(at.exit_time) = DATE(apm.timestamp)
  WHERE DATE(apm.timestamp) = DATE(CURDATE() - INTERVAL 1 DAY)
  GROUP BY apm.user_id, apm.strategy_id
  ON DUPLICATE KEY UPDATE
    closing_value = VALUES(closing_value),
    daily_return_pct = VALUES(daily_return_pct),
    trades_count = VALUES(trades_count),
    winning_trades = VALUES(winning_trades),
    losing_trades = VALUES(losing_trades),
    daily_profit = VALUES(daily_profit),
    updated_at = CURRENT_TIMESTAMP;
END //

DELIMITER ;
