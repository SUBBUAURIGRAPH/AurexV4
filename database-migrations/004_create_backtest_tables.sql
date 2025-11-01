-- =====================================================
-- Backtesting System Database Migration
-- Creates tables for historical data storage and backtest results
-- Version: 1.0.0
-- =====================================================

-- Historical Market Data Table
-- Stores OHLCV data for backtesting
CREATE TABLE IF NOT EXISTS historical_data (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  timeframe VARCHAR(10) NOT NULL, -- 1m, 5m, 15m, 1h, 1d
  timestamp TIMESTAMP NOT NULL,
  open DECIMAL(20, 8) NOT NULL,
  high DECIMAL(20, 8) NOT NULL,
  low DECIMAL(20, 8) NOT NULL,
  close DECIMAL(20, 8) NOT NULL,
  volume BIGINT NOT NULL DEFAULT 0,
  vwap DECIMAL(20, 8) NULL, -- Volume weighted average price
  trades_count INT NULL, -- Number of trades in the period
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_bar (symbol, timeframe, timestamp),
  INDEX idx_symbol_timeframe (symbol, timeframe),
  INDEX idx_timestamp (timestamp),
  INDEX idx_symbol_timestamp (symbol, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backtest Runs Table
-- Stores metadata for each backtest execution
CREATE TABLE IF NOT EXISTS backtests (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  strategy_name VARCHAR(255) NOT NULL,
  strategy_config JSON NOT NULL, -- Strategy parameters
  symbols JSON NOT NULL, -- Array of symbols tested
  timeframe VARCHAR(10) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  initial_capital DECIMAL(20, 2) NOT NULL DEFAULT 100000.00,
  commission_rate DECIMAL(8, 6) NOT NULL DEFAULT 0.001,
  slippage_buy DECIMAL(8, 6) NOT NULL DEFAULT 0.001,
  slippage_sell DECIMAL(8, 6) NOT NULL DEFAULT 0.001,
  margin_requirement DECIMAL(8, 6) NULL,
  allow_short_selling BOOLEAN DEFAULT FALSE,
  max_positions INT DEFAULT 10,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  progress DECIMAL(5, 2) DEFAULT 0.00, -- 0-100
  error_message TEXT NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  duration_ms INT NULL,
  bars_processed INT DEFAULT 0,
  -- Results Summary
  final_equity DECIMAL(20, 2) NULL,
  total_return DECIMAL(10, 4) NULL, -- Percentage
  total_pl DECIMAL(20, 2) NULL,
  total_trades INT DEFAULT 0,
  winning_trades INT DEFAULT 0,
  losing_trades INT DEFAULT 0,
  win_rate DECIMAL(5, 2) NULL,
  profit_factor DECIMAL(10, 4) NULL,
  sharpe_ratio DECIMAL(10, 4) NULL,
  sortino_ratio DECIMAL(10, 4) NULL,
  calmar_ratio DECIMAL(10, 4) NULL,
  max_drawdown DECIMAL(10, 4) NULL,
  max_drawdown_duration_days INT NULL,
  avg_win DECIMAL(20, 2) NULL,
  avg_loss DECIMAL(20, 2) NULL,
  largest_win DECIMAL(20, 2) NULL,
  largest_loss DECIMAL(20, 2) NULL,
  expectancy DECIMAL(20, 2) NULL,
  recovery_factor DECIMAL(10, 4) NULL,
  ulcer_index DECIMAL(10, 4) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_strategy_name (strategy_name),
  INDEX idx_created_at (created_at),
  INDEX idx_sharpe_ratio (sharpe_ratio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backtest Trades Table
-- Stores individual trades executed during backtest
CREATE TABLE IF NOT EXISTS backtest_trades (
  id VARCHAR(36) PRIMARY KEY,
  backtest_id VARCHAR(36) NOT NULL,
  trade_number INT NOT NULL, -- Sequential trade number within backtest
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(10) NOT NULL, -- buy, sell
  type VARCHAR(20) NOT NULL, -- market, limit, stop, stop_limit
  quantity DECIMAL(20, 8) NOT NULL,
  entry_price DECIMAL(20, 8) NOT NULL,
  exit_price DECIMAL(20, 8) NULL,
  entry_timestamp TIMESTAMP NOT NULL,
  exit_timestamp TIMESTAMP NULL,
  duration_minutes INT NULL,
  entry_bar_number INT NOT NULL,
  exit_bar_number INT NULL,
  commission DECIMAL(20, 8) NOT NULL DEFAULT 0,
  slippage DECIMAL(20, 8) NOT NULL DEFAULT 0,
  realized_pl DECIMAL(20, 8) NULL,
  pl_percent DECIMAL(10, 4) NULL,
  mae DECIMAL(20, 8) NULL, -- Maximum Adverse Excursion
  mfe DECIMAL(20, 8) NULL, -- Maximum Favorable Excursion
  r_multiple DECIMAL(10, 4) NULL, -- Risk multiple (R)
  position_size_percent DECIMAL(5, 2) NULL, -- Percentage of portfolio
  entry_signal JSON NULL, -- Signal that triggered entry
  exit_signal JSON NULL, -- Signal that triggered exit
  indicators_at_entry JSON NULL, -- Indicator values at entry
  indicators_at_exit JSON NULL, -- Indicator values at exit
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (backtest_id) REFERENCES backtests(id) ON DELETE CASCADE,
  INDEX idx_backtest_id (backtest_id),
  INDEX idx_symbol (symbol),
  INDEX idx_realized_pl (realized_pl),
  INDEX idx_entry_timestamp (entry_timestamp),
  INDEX idx_trade_number (backtest_id, trade_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backtest Equity Curve Table
-- Stores portfolio value over time during backtest
CREATE TABLE IF NOT EXISTS backtest_equity_curve (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  backtest_id VARCHAR(36) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  bar_number INT NOT NULL,
  equity DECIMAL(20, 2) NOT NULL,
  cash DECIMAL(20, 2) NOT NULL,
  position_value DECIMAL(20, 2) NOT NULL,
  drawdown DECIMAL(10, 4) NULL, -- Current drawdown percentage
  peak_equity DECIMAL(20, 2) NULL, -- Highest equity so far
  underwater_days INT NULL, -- Days since last peak
  daily_return DECIMAL(10, 6) NULL, -- Return for this period
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (backtest_id) REFERENCES backtests(id) ON DELETE CASCADE,
  UNIQUE KEY unique_backtest_bar (backtest_id, bar_number),
  INDEX idx_backtest_id (backtest_id),
  INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backtest Positions Table
-- Stores open positions at each point in time during backtest
CREATE TABLE IF NOT EXISTS backtest_positions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  backtest_id VARCHAR(36) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  bar_number INT NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  average_cost DECIMAL(20, 8) NOT NULL,
  current_price DECIMAL(20, 8) NOT NULL,
  market_value DECIMAL(20, 2) NOT NULL,
  unrealized_pl DECIMAL(20, 8) NOT NULL,
  unrealized_pl_percent DECIMAL(10, 4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (backtest_id) REFERENCES backtests(id) ON DELETE CASCADE,
  INDEX idx_backtest_id (backtest_id),
  INDEX idx_symbol (symbol),
  INDEX idx_bar_number (backtest_id, bar_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backtest Statistics Table
-- Stores detailed statistical analysis for each backtest
CREATE TABLE IF NOT EXISTS backtest_statistics (
  id VARCHAR(36) PRIMARY KEY,
  backtest_id VARCHAR(36) NOT NULL UNIQUE,
  -- Return Statistics
  annualized_return DECIMAL(10, 4) NULL,
  cumulative_return DECIMAL(10, 4) NULL,
  monthly_returns JSON NULL, -- Array of monthly return percentages
  best_month DECIMAL(10, 4) NULL,
  worst_month DECIMAL(10, 4) NULL,
  positive_months INT NULL,
  negative_months INT NULL,
  -- Risk Statistics
  volatility DECIMAL(10, 4) NULL, -- Annualized volatility
  downside_deviation DECIMAL(10, 4) NULL,
  value_at_risk_95 DECIMAL(10, 4) NULL, -- VaR 95%
  conditional_var_95 DECIMAL(10, 4) NULL, -- CVaR 95%
  beta DECIMAL(10, 4) NULL, -- Beta vs benchmark
  alpha DECIMAL(10, 4) NULL, -- Alpha vs benchmark
  correlation_to_benchmark DECIMAL(10, 4) NULL,
  -- Trade Statistics
  consecutive_wins INT NULL,
  consecutive_losses INT NULL,
  avg_bars_per_trade DECIMAL(10, 2) NULL,
  avg_mae DECIMAL(20, 8) NULL,
  avg_mfe DECIMAL(20, 8) NULL,
  avg_r_multiple DECIMAL(10, 4) NULL,
  -- Efficiency Metrics
  equity_high DECIMAL(20, 2) NULL,
  equity_low DECIMAL(20, 2) NULL,
  buy_and_hold_return DECIMAL(10, 4) NULL,
  outperformance DECIMAL(10, 4) NULL,
  -- Distribution Statistics
  return_skewness DECIMAL(10, 4) NULL,
  return_kurtosis DECIMAL(10, 4) NULL,
  -- Additional Metrics
  kelly_criterion DECIMAL(10, 4) NULL,
  optimal_f DECIMAL(10, 4) NULL,
  max_exposure DECIMAL(5, 2) NULL, -- Max portfolio exposure percentage
  avg_exposure DECIMAL(5, 2) NULL, -- Average portfolio exposure
  trades_per_day DECIMAL(10, 4) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (backtest_id) REFERENCES backtests(id) ON DELETE CASCADE,
  INDEX idx_backtest_id (backtest_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historical Data Metadata Table
-- Tracks what historical data is available
CREATE TABLE IF NOT EXISTS historical_data_metadata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  timeframe VARCHAR(10) NOT NULL,
  first_bar_timestamp TIMESTAMP NOT NULL,
  last_bar_timestamp TIMESTAMP NOT NULL,
  total_bars INT NOT NULL,
  gaps_detected INT DEFAULT 0,
  quality_score DECIMAL(5, 2) DEFAULT 100.00, -- Data quality 0-100
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  source VARCHAR(50) NULL, -- alpha_vantage, yahoo, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_symbol_timeframe (symbol, timeframe),
  INDEX idx_symbol (symbol),
  INDEX idx_last_updated (last_updated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backtest Comparison Groups Table
-- Groups backtests for comparison
CREATE TABLE IF NOT EXISTS backtest_comparison_groups (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  backtest_ids JSON NOT NULL, -- Array of backtest IDs
  comparison_results JSON NULL, -- Comparison analysis
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Composite indexes for common queries
CREATE INDEX idx_backtest_user_status ON backtests(user_id, status, created_at DESC);
CREATE INDEX idx_historical_data_lookup ON historical_data(symbol, timeframe, timestamp);
CREATE INDEX idx_trades_backtest_timestamp ON backtest_trades(backtest_id, entry_timestamp);

-- =====================================================
-- Views for Convenient Queries
-- =====================================================

-- View: Backtest Summary
CREATE OR REPLACE VIEW backtest_summary AS
SELECT
  b.id,
  b.user_id,
  b.name,
  b.strategy_name,
  b.timeframe,
  b.start_date,
  b.end_date,
  b.status,
  b.initial_capital,
  b.final_equity,
  b.total_return,
  b.total_trades,
  b.win_rate,
  b.profit_factor,
  b.sharpe_ratio,
  b.max_drawdown,
  b.created_at,
  b.completed_at,
  b.duration_ms,
  CASE
    WHEN b.status = 'completed' AND b.total_return > 0 THEN 'profitable'
    WHEN b.status = 'completed' AND b.total_return <= 0 THEN 'unprofitable'
    ELSE b.status
  END as result_category
FROM backtests b;

-- View: Trade Performance Summary
CREATE OR REPLACE VIEW trade_performance_summary AS
SELECT
  backtest_id,
  COUNT(*) as total_trades,
  SUM(CASE WHEN realized_pl > 0 THEN 1 ELSE 0 END) as winning_trades,
  SUM(CASE WHEN realized_pl < 0 THEN 1 ELSE 0 END) as losing_trades,
  AVG(realized_pl) as avg_pl,
  AVG(CASE WHEN realized_pl > 0 THEN realized_pl END) as avg_win,
  AVG(CASE WHEN realized_pl < 0 THEN realized_pl END) as avg_loss,
  MAX(realized_pl) as largest_win,
  MIN(realized_pl) as largest_loss,
  AVG(duration_minutes) as avg_trade_duration,
  AVG(pl_percent) as avg_return_percent,
  STDDEV(realized_pl) as pl_std_dev
FROM backtest_trades
WHERE realized_pl IS NOT NULL
GROUP BY backtest_id;

-- View: Symbol Performance in Backtests
CREATE OR REPLACE VIEW symbol_backtest_performance AS
SELECT
  symbol,
  COUNT(DISTINCT backtest_id) as backtests_count,
  COUNT(*) as total_trades,
  AVG(realized_pl) as avg_pl_per_trade,
  SUM(realized_pl) as total_pl,
  AVG(pl_percent) as avg_return_percent,
  SUM(CASE WHEN realized_pl > 0 THEN 1 ELSE 0 END) / COUNT(*) * 100 as win_rate
FROM backtest_trades
WHERE realized_pl IS NOT NULL
GROUP BY symbol
ORDER BY total_pl DESC;

-- =====================================================
-- Triggers for Automatic Updates
-- =====================================================

DELIMITER //

-- Update backtest statistics after trade completion
CREATE TRIGGER update_backtest_stats_after_trade
AFTER INSERT ON backtest_trades
FOR EACH ROW
BEGIN
  IF NEW.realized_pl IS NOT NULL THEN
    UPDATE backtests
    SET
      total_trades = total_trades + 1,
      winning_trades = winning_trades + CASE WHEN NEW.realized_pl > 0 THEN 1 ELSE 0 END,
      losing_trades = losing_trades + CASE WHEN NEW.realized_pl < 0 THEN 1 ELSE 0 END,
      total_pl = COALESCE(total_pl, 0) + NEW.realized_pl,
      largest_win = GREATEST(COALESCE(largest_win, 0), NEW.realized_pl),
      largest_loss = LEAST(COALESCE(largest_loss, 0), NEW.realized_pl),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.backtest_id;

    -- Update win rate
    UPDATE backtests
    SET win_rate = CASE
      WHEN total_trades > 0 THEN (winning_trades * 100.0 / total_trades)
      ELSE 0
    END
    WHERE id = NEW.backtest_id;

    -- Update profit factor
    UPDATE backtests b
    SET profit_factor = (
      SELECT
        CASE
          WHEN SUM(CASE WHEN realized_pl < 0 THEN ABS(realized_pl) ELSE 0 END) > 0
          THEN SUM(CASE WHEN realized_pl > 0 THEN realized_pl ELSE 0 END) /
               SUM(CASE WHEN realized_pl < 0 THEN ABS(realized_pl) ELSE 0 END)
          ELSE 0
        END
      FROM backtest_trades
      WHERE backtest_id = NEW.backtest_id
    )
    WHERE b.id = NEW.backtest_id;
  END IF;
END//

DELIMITER ;

-- =====================================================
-- Initial Data and Comments
-- =====================================================

-- Add table comments for documentation
ALTER TABLE historical_data COMMENT='Stores OHLCV historical market data for backtesting';
ALTER TABLE backtests COMMENT='Main backtest execution records and results';
ALTER TABLE backtest_trades COMMENT='Individual trades executed during backtests';
ALTER TABLE backtest_equity_curve COMMENT='Portfolio equity progression over time';
ALTER TABLE backtest_positions COMMENT='Open positions during backtest execution';
ALTER TABLE backtest_statistics COMMENT='Detailed statistical analysis of backtest results';
ALTER TABLE historical_data_metadata COMMENT='Metadata about available historical data';
ALTER TABLE backtest_comparison_groups COMMENT='Groups of backtests for comparison analysis';

-- =====================================================
-- Grant Permissions (Optional - adjust as needed)
-- =====================================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON historical_data TO 'hms_app'@'%';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON backtests TO 'hms_app'@'%';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON backtest_trades TO 'hms_app'@'%';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON backtest_equity_curve TO 'hms_app'@'%';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON backtest_positions TO 'hms_app'@'%';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON backtest_statistics TO 'hms_app'@'%';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON historical_data_metadata TO 'hms_app'@'%';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON backtest_comparison_groups TO 'hms_app'@'%';

-- =====================================================
-- Migration Complete
-- =====================================================
