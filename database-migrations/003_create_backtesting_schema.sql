-- HMS Phase 6 Part 2: Backtesting Engine - Database Schema
-- Migration Version: 003
-- Created: October 30, 2025
-- Description: Comprehensive backtesting system schema with historical data, results, and analytics

-- Enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 1. HISTORICAL DATA TABLES
-- ============================================================================

-- Historical OHLCV (Open, High, Low, Close, Volume) Data Storage
CREATE TABLE IF NOT EXISTS backtest_historical_data (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  symbol VARCHAR(20) NOT NULL,
  date DATE NOT NULL,
  timeframe VARCHAR(10) NOT NULL,  -- '1m', '5m', '15m', '1h', '4h', '1d', '1w', '1mo'
  open DECIMAL(15, 6) NOT NULL,
  high DECIMAL(15, 6) NOT NULL,
  low DECIMAL(15, 6) NOT NULL,
  close DECIMAL(15, 6) NOT NULL,
  volume BIGINT NOT NULL DEFAULT 0,
  adjusted_close DECIMAL(15, 6),  -- For dividend/split adjustment
  split_coefficient DECIMAL(10, 4) DEFAULT 1.0,
  dividend_amount DECIMAL(10, 4) DEFAULT 0,
  source VARCHAR(50) NOT NULL DEFAULT 'yahoo_finance',  -- 'yahoo_finance', 'polygon', 'iex', 'manual'
  is_complete BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes for query optimization
  UNIQUE KEY unique_symbol_date_timeframe (symbol, date, timeframe),
  INDEX idx_symbol_date (symbol, date),
  INDEX idx_symbol_timeframe (symbol, timeframe),
  INDEX idx_symbol_date_range (symbol, date, close),
  INDEX idx_source (source),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data Source Configuration & Management
CREATE TABLE IF NOT EXISTS backtest_data_sources (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,  -- 'yahoo_finance', 'polygon', 'iex', etc.
  api_endpoint VARCHAR(500),
  api_key VARCHAR(500),
  rate_limit INT DEFAULT 100,  -- requests per minute
  requests_per_minute INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,  -- Lower number = higher priority
  last_sync TIMESTAMP,
  last_sync_status VARCHAR(20),  -- 'success', 'partial', 'failed'
  last_error VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_name (name),
  INDEX idx_is_active (is_active),
  INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Market Calendar (Trading Days & Holidays)
CREATE TABLE IF NOT EXISTS backtest_market_calendars (
  id INT PRIMARY KEY AUTO_INCREMENT,
  exchange VARCHAR(20) NOT NULL,  -- 'NYSE', 'NASDAQ', 'EUREX', 'LSE', etc.
  date DATE NOT NULL,
  is_trading_day BOOLEAN NOT NULL DEFAULT TRUE,
  market_hours_open TIME,
  market_hours_close TIME,
  early_close_time TIME,  -- For early market closes
  holiday_name VARCHAR(100),
  holiday_type VARCHAR(30),  -- 'public_holiday', 'market_holiday', 'early_close'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_exchange_date (exchange, date),
  INDEX idx_exchange (exchange),
  INDEX idx_date (date),
  INDEX idx_is_trading_day (exchange, date, is_trading_day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data Cache for Performance Optimization
CREATE TABLE IF NOT EXISTS backtest_data_cache (
  id INT PRIMARY KEY AUTO_INCREMENT,
  symbol VARCHAR(20) NOT NULL,
  timeframe VARCHAR(10) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  record_count INT DEFAULT 0,
  data_hash VARCHAR(64),  -- SHA256 hash for change detection
  is_complete BOOLEAN DEFAULT TRUE,
  cache_size INT,  -- bytes
  last_accessed TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_symbol_timeframe_range (symbol, timeframe, start_date, end_date),
  INDEX idx_symbol_timeframe (symbol, timeframe),
  INDEX idx_last_accessed (last_accessed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. BACKTEST EXECUTION & RESULTS TABLES
-- ============================================================================

-- Backtest Results (Main Results Storage)
CREATE TABLE IF NOT EXISTS backtest_results (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  strategy_name VARCHAR(255) NOT NULL,
  strategy_description TEXT,
  symbol VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  timeframe VARCHAR(10) DEFAULT '1d',
  initial_capital DECIMAL(15, 2) NOT NULL,
  final_capital DECIMAL(15, 2) NOT NULL,
  net_profit DECIMAL(15, 2),
  total_return DECIMAL(10, 4),  -- As percentage
  annualized_return DECIMAL(10, 4),

  -- Risk Metrics
  max_drawdown DECIMAL(10, 4),
  max_drawdown_date DATE,
  volatility DECIMAL(10, 4),
  sharpe_ratio DECIMAL(8, 3),
  sortino_ratio DECIMAL(8, 3),
  calmar_ratio DECIMAL(8, 3),
  information_ratio DECIMAL(8, 3),
  recovery_factor DECIMAL(10, 3),
  ulcer_index DECIMAL(8, 3),

  -- Risk Analytics
  var_95 DECIMAL(10, 4),  -- Value at Risk (95%)
  cvar_95 DECIMAL(10, 4),  -- Conditional VaR (95%)
  beta DECIMAL(8, 4),
  skewness DECIMAL(8, 3),
  kurtosis DECIMAL(8, 3),

  -- Trade Statistics
  total_trades INT DEFAULT 0,
  winning_trades INT DEFAULT 0,
  losing_trades INT DEFAULT 0,
  win_rate DECIMAL(5, 2),  -- As percentage
  profit_factor DECIMAL(8, 2),
  avg_win DECIMAL(12, 2),
  avg_loss DECIMAL(12, 2),
  largest_win DECIMAL(12, 2),
  largest_loss DECIMAL(12, 2),
  consecutive_wins INT DEFAULT 0,
  consecutive_losses INT DEFAULT 0,
  avg_win_loss_ratio DECIMAL(8, 2),

  -- Performance Configuration
  commission_percent DECIMAL(8, 4) DEFAULT 0.1,
  slippage_percent DECIMAL(8, 4) DEFAULT 0.05,

  -- Status & Metadata
  status VARCHAR(20) NOT NULL DEFAULT 'completed',  -- 'running', 'completed', 'failed', 'cancelled'
  progress_percent INT DEFAULT 0,
  error_message VARCHAR(500),
  benchmark_symbol VARCHAR(20),
  notes TEXT,
  tags JSON,  -- Store tags as JSON array

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,

  -- Indexes
  INDEX idx_user_id (user_id),
  INDEX idx_strategy_symbol (strategy_name, symbol),
  INDEX idx_symbol (symbol),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_sharpe_ratio (sharpe_ratio),
  INDEX idx_max_drawdown (max_drawdown),
  FULLTEXT INDEX ft_strategy_name_description (strategy_name, strategy_description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Individual Trades from Backtest
CREATE TABLE IF NOT EXISTS backtest_trades (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  backtest_result_id BIGINT NOT NULL,
  trade_number INT NOT NULL,
  entry_date DATE NOT NULL,
  entry_time TIME,
  entry_price DECIMAL(15, 6) NOT NULL,
  entry_reason VARCHAR(500),

  exit_date DATE,
  exit_time TIME,
  exit_price DECIMAL(15, 6),
  exit_reason VARCHAR(500),

  quantity INT NOT NULL,
  side VARCHAR(10) NOT NULL,  -- 'BUY', 'SELL'
  position_type VARCHAR(20) DEFAULT 'long',  -- 'long', 'short'

  -- Financial Details
  entry_commission DECIMAL(10, 2),
  exit_commission DECIMAL(10, 2),
  total_commission DECIMAL(10, 2),

  entry_slippage DECIMAL(10, 4),
  exit_slippage DECIMAL(10, 4),

  gross_pnl DECIMAL(15, 2),  -- Before commission & slippage
  net_pnl DECIMAL(15, 2),    -- After commission & slippage
  pnl_percent DECIMAL(10, 4),

  -- Trade Analysis
  holding_period INT,  -- in days
  bars_held INT,
  max_profit DECIMAL(15, 2),
  max_loss DECIMAL(15, 2),
  profit_factor DECIMAL(10, 2),
  risk_reward_ratio DECIMAL(10, 2),

  -- Status
  status VARCHAR(20) DEFAULT 'closed',  -- 'open', 'closed'

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes & Foreign Key
  FOREIGN KEY (backtest_result_id) REFERENCES backtest_results(id) ON DELETE CASCADE,
  INDEX idx_backtest_result_id (backtest_result_id),
  INDEX idx_entry_date (entry_date),
  INDEX idx_exit_date (exit_date),
  INDEX idx_status (status),
  INDEX idx_pnl (net_pnl)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Equity Curve History (For charting and analysis)
CREATE TABLE IF NOT EXISTS backtest_equity_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  backtest_result_id BIGINT NOT NULL,
  date DATE NOT NULL,
  time TIME,
  equity DECIMAL(15, 2) NOT NULL,
  cash DECIMAL(15, 2),
  positions_value DECIMAL(15, 2),

  -- Cumulative metrics
  cumulative_pnl DECIMAL(15, 2),
  cumulative_return DECIMAL(10, 4),
  drawdown_percent DECIMAL(10, 4),
  max_drawdown_to_date DECIMAL(10, 4),

  -- Daily metrics
  daily_return DECIMAL(10, 4),
  daily_pnl DECIMAL(15, 2),
  trades_today INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes & Foreign Key
  FOREIGN KEY (backtest_result_id) REFERENCES backtest_results(id) ON DELETE CASCADE,
  INDEX idx_backtest_date (backtest_result_id, date),
  INDEX idx_date (date),
  INDEX idx_equity (equity),
  INDEX idx_drawdown (drawdown_percent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. COMPARISON & ANALYSIS TABLES
-- ============================================================================

-- Backtest vs Paper Trading Comparison
CREATE TABLE IF NOT EXISTS backtest_paper_comparison (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  backtest_result_id BIGINT NOT NULL,
  paper_account_id BIGINT,

  -- Returns Comparison
  backtest_return DECIMAL(10, 4),
  paper_return DECIMAL(10, 4),
  return_difference DECIMAL(10, 4),
  correlation DECIMAL(8, 4),

  -- Risk Comparison
  backtest_sharpe DECIMAL(8, 3),
  paper_sharpe DECIMAL(8, 3),
  backtest_drawdown DECIMAL(10, 4),
  paper_drawdown DECIMAL(10, 4),

  -- Trade Quality
  backtest_win_rate DECIMAL(5, 2),
  paper_win_rate DECIMAL(5, 2),
  trades_matching INT,
  trades_diverging INT,

  -- Analysis
  insights TEXT,
  consistency_score DECIMAL(5, 2),  -- 0-100

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (backtest_result_id) REFERENCES backtest_results(id) ON DELETE CASCADE,
  INDEX idx_backtest_result_id (backtest_result_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backtest vs Live Trading Comparison
CREATE TABLE IF NOT EXISTS backtest_live_comparison (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  backtest_result_id BIGINT NOT NULL,
  live_account_id BIGINT,

  -- Returns Comparison
  backtest_return DECIMAL(10, 4),
  live_return DECIMAL(10, 4),
  return_difference DECIMAL(10, 4),
  correlation DECIMAL(8, 4),

  -- Risk Comparison
  backtest_sharpe DECIMAL(8, 3),
  live_sharpe DECIMAL(8, 3),
  backtest_drawdown DECIMAL(10, 4),
  live_drawdown DECIMAL(10, 4),

  -- Slippage Analysis
  backtest_avg_slippage DECIMAL(8, 4),
  live_actual_slippage DECIMAL(8, 4),
  slippage_variance DECIMAL(8, 4),

  -- Execution Quality
  backtest_win_rate DECIMAL(5, 2),
  live_win_rate DECIMAL(5, 2),

  -- Analysis
  insights TEXT,
  execution_quality_score DECIMAL(5, 2),  -- 0-100

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (backtest_result_id) REFERENCES backtest_results(id) ON DELETE CASCADE,
  INDEX idx_backtest_result_id (backtest_result_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. OPTIMIZATION & PARAMETER TUNING TABLES
-- ============================================================================

-- Parameter Optimization Results
CREATE TABLE IF NOT EXISTS backtest_optimization_results (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  backtest_result_id BIGINT,
  optimization_name VARCHAR(255) NOT NULL,

  -- Strategy Parameters
  strategy_name VARCHAR(255) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Optimization Configuration
  optimization_type VARCHAR(20) NOT NULL,  -- 'grid', 'random', 'genetic', 'bayesian'
  parameter_grid JSON,  -- Parameters and ranges to optimize
  objective_metric VARCHAR(50) NOT NULL,  -- 'sharpe', 'return', 'profit_factor', etc.
  objective_direction VARCHAR(10) DEFAULT 'maximize',  -- 'maximize', 'minimize'

  -- Optimization Progress
  total_combinations INT,
  completed_combinations INT,
  progress_percent INT DEFAULT 0,

  -- Best Results
  best_parameters JSON,
  best_metric_value DECIMAL(10, 4),
  best_backtest_id BIGINT,

  -- Statistics
  avg_metric_value DECIMAL(10, 4),
  median_metric_value DECIMAL(10, 4),
  std_dev_metric DECIMAL(10, 4),

  -- Status
  status VARCHAR(20) DEFAULT 'running',  -- 'running', 'completed', 'failed', 'cancelled'
  error_message VARCHAR(500),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,

  -- Indexes
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_backtest_result_id (backtest_result_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optimization Trial Results
CREATE TABLE IF NOT EXISTS backtest_optimization_trials (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  optimization_result_id BIGINT NOT NULL,
  trial_number INT NOT NULL,

  -- Parameters for this trial
  parameters JSON NOT NULL,

  -- Results
  metric_value DECIMAL(10, 4),
  total_return DECIMAL(10, 4),
  sharpe_ratio DECIMAL(8, 3),
  max_drawdown DECIMAL(10, 4),
  win_rate DECIMAL(5, 2),

  -- Status
  status VARCHAR(20) DEFAULT 'completed',
  duration_seconds INT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes & Foreign Key
  FOREIGN KEY (optimization_result_id) REFERENCES backtest_optimization_results(id) ON DELETE CASCADE,
  INDEX idx_optimization_id (optimization_result_id),
  INDEX idx_trial_number (trial_number),
  INDEX idx_metric_value (metric_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. UTILITY TABLES & STORED PROCEDURES
-- ============================================================================

-- Backtest Settings & Configuration
CREATE TABLE IF NOT EXISTS backtest_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,

  -- Default Configuration
  default_commission DECIMAL(8, 4) DEFAULT 0.1,
  default_slippage DECIMAL(8, 4) DEFAULT 0.05,
  default_initial_capital DECIMAL(15, 2) DEFAULT 100000,

  -- Optimization Settings
  default_optimization_type VARCHAR(20) DEFAULT 'grid',
  max_optimization_trials INT DEFAULT 1000,

  -- Data Settings
  auto_sync_historical BOOLEAN DEFAULT TRUE,
  data_retention_days INT DEFAULT 365,  -- Keep data for 1 year

  -- Notification Settings
  notify_on_completion BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. STORED PROCEDURES FOR AUTOMATED CALCULATIONS
-- ============================================================================

DELIMITER $$

-- Calculate Performance Metrics for a Backtest Result
CREATE PROCEDURE IF NOT EXISTS sp_calculate_backtest_metrics(
  IN p_backtest_result_id BIGINT
)
BEGIN
  DECLARE v_total_trades INT;
  DECLARE v_winning_trades INT;
  DECLARE v_losing_trades INT;
  DECLARE v_total_profit DECIMAL(15, 2);
  DECLARE v_total_loss DECIMAL(15, 2);
  DECLARE v_avg_win DECIMAL(12, 2);
  DECLARE v_avg_loss DECIMAL(12, 2);

  -- Count trades
  SELECT COUNT(*) INTO v_total_trades
  FROM backtest_trades
  WHERE backtest_result_id = p_backtest_result_id;

  SELECT COUNT(*) INTO v_winning_trades
  FROM backtest_trades
  WHERE backtest_result_id = p_backtest_result_id AND net_pnl > 0;

  SELECT COUNT(*) INTO v_losing_trades
  FROM backtest_trades
  WHERE backtest_result_id = p_backtest_result_id AND net_pnl <= 0;

  -- Calculate win/loss amounts
  SELECT SUM(net_pnl) INTO v_total_profit
  FROM backtest_trades
  WHERE backtest_result_id = p_backtest_result_id AND net_pnl > 0;

  SELECT SUM(ABS(net_pnl)) INTO v_total_loss
  FROM backtest_trades
  WHERE backtest_result_id = p_backtest_result_id AND net_pnl <= 0;

  -- Calculate averages
  IF v_winning_trades > 0 THEN
    SET v_avg_win = v_total_profit / v_winning_trades;
  ELSE
    SET v_avg_win = 0;
  END IF;

  IF v_losing_trades > 0 THEN
    SET v_avg_loss = v_total_loss / v_losing_trades;
  ELSE
    SET v_avg_loss = 0;
  END IF;

  -- Update backtest_results
  UPDATE backtest_results
  SET
    total_trades = v_total_trades,
    winning_trades = v_winning_trades,
    losing_trades = v_losing_trades,
    win_rate = IF(v_total_trades > 0, (v_winning_trades / v_total_trades) * 100, 0),
    profit_factor = IF(v_total_loss > 0, v_total_profit / v_total_loss, IF(v_total_profit > 0, 99.99, 0)),
    avg_win = v_avg_win,
    avg_loss = v_avg_loss,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_backtest_result_id;

END$$

-- Update Equity History Metrics
CREATE PROCEDURE IF NOT EXISTS sp_update_equity_history(
  IN p_backtest_result_id BIGINT
)
BEGIN
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;

  -- Update drawdown calculations
  WITH cte_max_equity AS (
    SELECT
      date,
      equity,
      MAX(equity) OVER (ORDER BY date) as max_equity_to_date
    FROM backtest_equity_history
    WHERE backtest_result_id = p_backtest_result_id
  )
  UPDATE backtest_equity_history eh
  SET
    drawdown_percent = ((cme.equity - cme.max_equity_to_date) / cme.max_equity_to_date) * 100
  FROM cte_max_equity cme
  WHERE eh.backtest_result_id = p_backtest_result_id
    AND eh.date = cme.date;

END$$

DELIMITER ;

-- ============================================================================
-- 7. INDEXES & CONSTRAINTS
-- ============================================================================

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_backtest_user_date
ON backtest_results(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_backtest_symbol_date
ON backtest_results(symbol, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_historical_data_symbol_date_close
ON backtest_historical_data(symbol, date, close);

-- ============================================================================
-- 8. INSERT DEFAULT DATA
-- ============================================================================

-- Insert default data sources if not exists
INSERT IGNORE INTO backtest_data_sources
(name, api_endpoint, priority, is_active) VALUES
('yahoo_finance', 'https://query1.finance.yahoo.com', 1, TRUE),
('polygon', 'https://api.polygon.io', 2, FALSE),
('iex_cloud', 'https://cloud.iexapis.com', 3, FALSE);

-- Insert common market calendars for NYSE (2024-2025)
INSERT IGNORE INTO backtest_market_calendars
(exchange, date, is_trading_day, holiday_name, holiday_type) VALUES
('NYSE', '2025-01-01', FALSE, 'New Year Day', 'public_holiday'),
('NYSE', '2025-01-20', FALSE, 'MLK Jr. Day', 'public_holiday'),
('NYSE', '2025-02-17', FALSE, 'Presidents Day', 'public_holiday'),
('NYSE', '2025-03-17', FALSE, 'Good Friday', 'market_holiday'),
('NYSE', '2025-05-26', FALSE, 'Memorial Day', 'public_holiday'),
('NYSE', '2025-06-19', FALSE, 'Juneteenth', 'public_holiday'),
('NYSE', '2025-07-04', FALSE, 'Independence Day', 'public_holiday'),
('NYSE', '2025-09-01', FALSE, 'Labor Day', 'public_holiday'),
('NYSE', '2025-11-27', FALSE, 'Thanksgiving', 'public_holiday'),
('NYSE', '2025-12-25', FALSE, 'Christmas', 'public_holiday');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 1;

-- Record migration completion
SELECT CONCAT('✅ Backtesting Schema Migration (v003) completed at ', NOW()) AS migration_status;
