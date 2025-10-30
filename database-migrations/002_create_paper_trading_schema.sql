-- Paper Trading System Schema
-- Enables users to practice trading without real money
-- Version: 1.0.0
-- Created: October 30, 2025

-- ============================================
-- Paper Trading Accounts Table
-- ============================================
CREATE TABLE IF NOT EXISTS paper_trading_accounts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT 'Paper Trading Account',

  -- Account status
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'paused', 'archived'
  account_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'competition', 'demo'

  -- Capital management
  initial_capital DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
  current_cash DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
  buying_power DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,

  -- Configuration
  config JSONB DEFAULT '{}', -- { commissionRate, slippage, marginRequirement, shortEnabled, etc. }

  -- Settings
  allow_short_selling BOOLEAN DEFAULT true,
  commission_rate DECIMAL(6, 4) DEFAULT 0.0010, -- 0.1% default
  slippage_buy DECIMAL(6, 4) DEFAULT 0.0010, -- 0.1% slippage on buys
  slippage_sell DECIMAL(6, 4) DEFAULT 0.0010, -- 0.1% slippage on sells
  margin_requirement DECIMAL(5, 4) DEFAULT 0.2500, -- 25% for day trading

  -- Performance tracking
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  total_pl DECIMAL(15, 2) DEFAULT 0.00,
  total_commission DECIMAL(15, 2) DEFAULT 0.00,
  max_drawdown DECIMAL(10, 2) DEFAULT 0.00,
  win_rate DECIMAL(5, 2) DEFAULT 0.00,
  profit_factor DECIMAL(10, 2) DEFAULT 0.00,
  total_return DECIMAL(10, 2) DEFAULT 0.00,
  sharpe_ratio DECIMAL(10, 4) DEFAULT 0.00,

  -- Risk management
  max_position_size DECIMAL(15, 2), -- Optional max size per position
  max_daily_loss DECIMAL(15, 2), -- Optional daily loss limit
  max_total_loss DECIMAL(15, 2), -- Optional total loss limit
  position_limit INTEGER DEFAULT 10, -- Max concurrent positions

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  archived_at TIMESTAMP NULL,

  -- Indexes
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_account_type (account_type),
  INDEX idx_created_at (created_at),
  UNIQUE KEY unique_user_active_account (user_id, name, status)
);

-- ============================================
-- Paper Trading Orders Table
-- ============================================
CREATE TABLE IF NOT EXISTS paper_trading_orders (
  id VARCHAR(36) PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(255) NOT NULL,

  -- Order details
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL, -- 'buy', 'sell'
  type VARCHAR(20) NOT NULL, -- 'market', 'limit', 'stop', 'stop_limit'
  quantity INTEGER NOT NULL,

  -- Pricing
  limit_price DECIMAL(15, 4),
  stop_price DECIMAL(15, 4),
  entry_price DECIMAL(15, 4),
  execution_price DECIMAL(15, 4),
  average_price DECIMAL(15, 4),

  -- Execution details
  filled_quantity INTEGER DEFAULT 0,
  remaining_quantity INTEGER,
  total_value DECIMAL(15, 2),
  commission DECIMAL(15, 2) DEFAULT 0.00,
  slippage DECIMAL(15, 4) DEFAULT 0.00,

  -- Status and lifecycle
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'filled', 'partial', 'cancelled', 'rejected'
  time_in_force VARCHAR(20) DEFAULT 'day', -- 'day', 'gtc', 'ioc', 'fok'
  extended_hours BOOLEAN DEFAULT false,

  -- P&L (for closed positions)
  realized_pl DECIMAL(15, 2) DEFAULT 0.00,
  pl_percent DECIMAL(10, 4) DEFAULT 0.00,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP,
  filled_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Metadata
  metadata JSONB DEFAULT '{}', -- Additional order data
  rejection_reason TEXT,

  -- Foreign keys
  FOREIGN KEY (account_id) REFERENCES paper_trading_accounts(id) ON DELETE CASCADE,

  -- Indexes
  INDEX idx_account_id (account_id),
  INDEX idx_user_id (user_id),
  INDEX idx_symbol (symbol),
  INDEX idx_status (status),
  INDEX idx_side (side),
  INDEX idx_created_at (created_at),
  INDEX idx_filled_at (filled_at),
  INDEX idx_account_symbol (account_id, symbol),
  INDEX idx_account_status (account_id, status)
);

-- ============================================
-- Paper Trading Positions Table
-- ============================================
CREATE TABLE IF NOT EXISTS paper_trading_positions (
  id VARCHAR(36) PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(255) NOT NULL,

  -- Position details
  symbol VARCHAR(20) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  side VARCHAR(10) NOT NULL, -- 'long', 'short'

  -- Cost basis
  average_cost DECIMAL(15, 4) NOT NULL,
  total_cost DECIMAL(15, 2) NOT NULL,

  -- Current valuation
  current_price DECIMAL(15, 4),
  market_value DECIMAL(15, 2),

  -- P&L
  unrealized_pl DECIMAL(15, 2) DEFAULT 0.00,
  unrealized_pl_percent DECIMAL(10, 4) DEFAULT 0.00,
  realized_pl DECIMAL(15, 2) DEFAULT 0.00,
  total_pl DECIMAL(15, 2) DEFAULT 0.00,

  -- Trade tracking
  entry_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Position metadata
  sector VARCHAR(100),
  asset_class VARCHAR(50) DEFAULT 'equity', -- 'equity', 'crypto', 'forex', 'option'

  -- Foreign keys
  FOREIGN KEY (account_id) REFERENCES paper_trading_accounts(id) ON DELETE CASCADE,

  -- Indexes
  INDEX idx_account_id (account_id),
  INDEX idx_user_id (user_id),
  INDEX idx_symbol (symbol),
  INDEX idx_side (side),
  INDEX idx_entry_date (entry_date),
  UNIQUE KEY unique_account_symbol (account_id, symbol)
);

-- ============================================
-- Paper Trading Equity History Table
-- ============================================
CREATE TABLE IF NOT EXISTS paper_trading_equity_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL,

  -- Equity snapshot
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_equity DECIMAL(15, 2) NOT NULL,
  cash DECIMAL(15, 2) NOT NULL,
  position_value DECIMAL(15, 2) NOT NULL,

  -- P&L
  unrealized_pl DECIMAL(15, 2) DEFAULT 0.00,
  realized_pl DECIMAL(15, 2) DEFAULT 0.00,
  total_pl DECIMAL(15, 2) DEFAULT 0.00,

  -- Returns
  daily_return DECIMAL(10, 4),
  total_return DECIMAL(10, 4),

  -- Number of positions
  position_count INTEGER DEFAULT 0,

  -- Foreign keys
  FOREIGN KEY (account_id) REFERENCES paper_trading_accounts(id) ON DELETE CASCADE,

  -- Indexes
  INDEX idx_account_id (account_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_account_timestamp (account_id, timestamp)
);

-- ============================================
-- Paper Trading Performance Metrics Table
-- ============================================
CREATE TABLE IF NOT EXISTS paper_trading_performance_metrics (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL,

  -- Time period
  metric_date DATE NOT NULL,
  metric_period VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'all_time'

  -- Trade metrics
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  win_rate DECIMAL(5, 2) DEFAULT 0.00,

  -- P&L metrics
  gross_profit DECIMAL(15, 2) DEFAULT 0.00,
  gross_loss DECIMAL(15, 2) DEFAULT 0.00,
  net_pl DECIMAL(15, 2) DEFAULT 0.00,
  profit_factor DECIMAL(10, 4) DEFAULT 0.00,

  -- Average metrics
  avg_win DECIMAL(15, 2) DEFAULT 0.00,
  avg_loss DECIMAL(15, 2) DEFAULT 0.00,
  avg_trade DECIMAL(15, 2) DEFAULT 0.00,
  largest_win DECIMAL(15, 2) DEFAULT 0.00,
  largest_loss DECIMAL(15, 2) DEFAULT 0.00,

  -- Risk metrics
  max_drawdown DECIMAL(10, 2) DEFAULT 0.00,
  max_drawdown_amount DECIMAL(15, 2) DEFAULT 0.00,
  sharpe_ratio DECIMAL(10, 4) DEFAULT 0.00,
  sortino_ratio DECIMAL(10, 4) DEFAULT 0.00,
  calmar_ratio DECIMAL(10, 4) DEFAULT 0.00,

  -- Return metrics
  total_return DECIMAL(10, 4) DEFAULT 0.00,
  annualized_return DECIMAL(10, 4) DEFAULT 0.00,

  -- Volume metrics
  total_volume INTEGER DEFAULT 0,
  total_commission DECIMAL(15, 2) DEFAULT 0.00,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign keys
  FOREIGN KEY (account_id) REFERENCES paper_trading_accounts(id) ON DELETE CASCADE,

  -- Indexes
  INDEX idx_account_id (account_id),
  INDEX idx_metric_date (metric_date),
  INDEX idx_metric_period (metric_period),
  UNIQUE KEY unique_account_period (account_id, metric_date, metric_period)
);

-- ============================================
-- Paper vs Live Comparison Table
-- ============================================
CREATE TABLE IF NOT EXISTS paper_live_comparison (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  paper_account_id VARCHAR(36) NOT NULL,

  -- Comparison snapshot
  comparison_date DATE NOT NULL,

  -- Paper trading metrics
  paper_total_return DECIMAL(10, 4),
  paper_sharpe_ratio DECIMAL(10, 4),
  paper_win_rate DECIMAL(5, 2),
  paper_total_trades INTEGER,
  paper_total_pl DECIMAL(15, 2),

  -- Live trading metrics (if available)
  live_total_return DECIMAL(10, 4),
  live_sharpe_ratio DECIMAL(10, 4),
  live_win_rate DECIMAL(5, 2),
  live_total_trades INTEGER,
  live_total_pl DECIMAL(15, 2),

  -- Comparison metrics
  return_difference DECIMAL(10, 4),
  sharpe_difference DECIMAL(10, 4),

  -- User readiness score
  readiness_score DECIMAL(5, 2), -- 0-100 score
  recommendation TEXT, -- Recommendation for transitioning to live

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign keys
  FOREIGN KEY (paper_account_id) REFERENCES paper_trading_accounts(id) ON DELETE CASCADE,

  -- Indexes
  INDEX idx_user_id (user_id),
  INDEX idx_paper_account_id (paper_account_id),
  INDEX idx_comparison_date (comparison_date)
);

-- ============================================
-- Paper Trading Settings Table
-- ============================================
CREATE TABLE IF NOT EXISTS paper_trading_settings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,

  -- Global settings
  paper_trading_enabled BOOLEAN DEFAULT false,
  default_account_id VARCHAR(36),

  -- Preferences
  auto_create_account BOOLEAN DEFAULT true,
  show_paper_banner BOOLEAN DEFAULT true,
  confirm_before_live BOOLEAN DEFAULT true,

  -- Notifications
  notify_on_fill BOOLEAN DEFAULT true,
  notify_on_milestone BOOLEAN DEFAULT true,
  daily_summary_enabled BOOLEAN DEFAULT false,

  -- Feature flags
  allow_options_trading BOOLEAN DEFAULT false,
  allow_crypto_trading BOOLEAN DEFAULT true,
  allow_forex_trading BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_user_id (user_id)
);

-- ============================================
-- Stored Procedures
-- ============================================

DELIMITER $$

-- Calculate account statistics
CREATE PROCEDURE update_paper_account_statistics(IN p_account_id VARCHAR(36))
BEGIN
  DECLARE v_total_trades INT;
  DECLARE v_winning_trades INT;
  DECLARE v_losing_trades INT;
  DECLARE v_total_pl DECIMAL(15, 2);
  DECLARE v_total_commission DECIMAL(15, 2);
  DECLARE v_win_rate DECIMAL(5, 2);
  DECLARE v_profit_factor DECIMAL(10, 2);
  DECLARE v_total_return DECIMAL(10, 2);
  DECLARE v_initial_capital DECIMAL(15, 2);

  -- Get trade counts
  SELECT
    COUNT(*),
    SUM(CASE WHEN realized_pl > 0 THEN 1 ELSE 0 END),
    SUM(CASE WHEN realized_pl < 0 THEN 1 ELSE 0 END),
    SUM(realized_pl),
    SUM(commission)
  INTO
    v_total_trades, v_winning_trades, v_losing_trades, v_total_pl, v_total_commission
  FROM paper_trading_orders
  WHERE account_id = p_account_id AND status = 'filled';

  -- Calculate win rate
  SET v_win_rate = IF(v_total_trades > 0, (v_winning_trades / v_total_trades) * 100, 0);

  -- Calculate profit factor
  SET v_profit_factor = (
    SELECT
      IF(SUM(CASE WHEN realized_pl < 0 THEN ABS(realized_pl) ELSE 0 END) > 0,
        SUM(CASE WHEN realized_pl > 0 THEN realized_pl ELSE 0 END) /
        SUM(CASE WHEN realized_pl < 0 THEN ABS(realized_pl) ELSE 0 END),
        0)
    FROM paper_trading_orders
    WHERE account_id = p_account_id AND status = 'filled'
  );

  -- Get initial capital
  SELECT initial_capital INTO v_initial_capital
  FROM paper_trading_accounts
  WHERE id = p_account_id;

  -- Calculate total return
  SET v_total_return = IF(v_initial_capital > 0, (v_total_pl / v_initial_capital) * 100, 0);

  -- Update account
  UPDATE paper_trading_accounts
  SET
    total_trades = v_total_trades,
    winning_trades = v_winning_trades,
    losing_trades = v_losing_trades,
    total_pl = v_total_pl,
    total_commission = v_total_commission,
    win_rate = v_win_rate,
    profit_factor = v_profit_factor,
    total_return = v_total_return,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_account_id;
END$$

-- Calculate performance metrics
CREATE PROCEDURE calculate_paper_performance_metrics(
  IN p_account_id VARCHAR(36),
  IN p_metric_period VARCHAR(20)
)
BEGIN
  DECLARE v_metric_date DATE;
  DECLARE v_start_date DATE;

  SET v_metric_date = CURDATE();

  -- Determine start date based on period
  CASE p_metric_period
    WHEN 'daily' THEN SET v_start_date = v_metric_date;
    WHEN 'weekly' THEN SET v_start_date = DATE_SUB(v_metric_date, INTERVAL 7 DAY);
    WHEN 'monthly' THEN SET v_start_date = DATE_SUB(v_metric_date, INTERVAL 1 MONTH);
    ELSE SET v_start_date = (SELECT MIN(created_at) FROM paper_trading_orders WHERE account_id = p_account_id);
  END CASE;

  -- Calculate and insert/update metrics
  INSERT INTO paper_trading_performance_metrics (
    account_id, metric_date, metric_period,
    total_trades, winning_trades, losing_trades, win_rate,
    gross_profit, gross_loss, net_pl, profit_factor,
    avg_win, avg_loss, largest_win, largest_loss,
    total_volume, total_commission
  )
  SELECT
    p_account_id,
    v_metric_date,
    p_metric_period,
    COUNT(*) as total_trades,
    SUM(CASE WHEN realized_pl > 0 THEN 1 ELSE 0 END) as winning_trades,
    SUM(CASE WHEN realized_pl < 0 THEN 1 ELSE 0 END) as losing_trades,
    IF(COUNT(*) > 0,
      (SUM(CASE WHEN realized_pl > 0 THEN 1 ELSE 0 END) / COUNT(*)) * 100,
      0) as win_rate,
    SUM(CASE WHEN realized_pl > 0 THEN realized_pl ELSE 0 END) as gross_profit,
    SUM(CASE WHEN realized_pl < 0 THEN ABS(realized_pl) ELSE 0 END) as gross_loss,
    SUM(realized_pl) as net_pl,
    IF(SUM(CASE WHEN realized_pl < 0 THEN ABS(realized_pl) ELSE 0 END) > 0,
      SUM(CASE WHEN realized_pl > 0 THEN realized_pl ELSE 0 END) /
      SUM(CASE WHEN realized_pl < 0 THEN ABS(realized_pl) ELSE 0 END),
      0) as profit_factor,
    AVG(CASE WHEN realized_pl > 0 THEN realized_pl ELSE NULL END) as avg_win,
    AVG(CASE WHEN realized_pl < 0 THEN realized_pl ELSE NULL END) as avg_loss,
    MAX(realized_pl) as largest_win,
    MIN(realized_pl) as largest_loss,
    SUM(quantity) as total_volume,
    SUM(commission) as total_commission
  FROM paper_trading_orders
  WHERE account_id = p_account_id
    AND status = 'filled'
    AND filled_at >= v_start_date
  ON DUPLICATE KEY UPDATE
    total_trades = VALUES(total_trades),
    winning_trades = VALUES(winning_trades),
    losing_trades = VALUES(losing_trades),
    win_rate = VALUES(win_rate),
    gross_profit = VALUES(gross_profit),
    gross_loss = VALUES(gross_loss),
    net_pl = VALUES(net_pl),
    profit_factor = VALUES(profit_factor),
    avg_win = VALUES(avg_win),
    avg_loss = VALUES(avg_loss),
    largest_win = VALUES(largest_win),
    largest_loss = VALUES(largest_loss),
    total_volume = VALUES(total_volume),
    total_commission = VALUES(total_commission),
    updated_at = CURRENT_TIMESTAMP;
END$$

DELIMITER ;

-- ============================================
-- Triggers
-- ============================================

DELIMITER $$

-- Update account statistics after order fill
CREATE TRIGGER update_stats_after_order_fill
AFTER UPDATE ON paper_trading_orders
FOR EACH ROW
BEGIN
  IF NEW.status = 'filled' AND OLD.status != 'filled' THEN
    CALL update_paper_account_statistics(NEW.account_id);
  END IF;
END$$

-- Track equity history
CREATE TRIGGER track_equity_on_position_update
AFTER UPDATE ON paper_trading_positions
FOR EACH ROW
BEGIN
  INSERT INTO paper_trading_equity_history (
    account_id, timestamp, total_equity, cash, position_value,
    unrealized_pl, position_count
  )
  SELECT
    a.id,
    CURRENT_TIMESTAMP,
    a.current_cash + COALESCE(SUM(p.market_value), 0),
    a.current_cash,
    COALESCE(SUM(p.market_value), 0),
    COALESCE(SUM(p.unrealized_pl), 0),
    COUNT(p.id)
  FROM paper_trading_accounts a
  LEFT JOIN paper_trading_positions p ON p.account_id = a.id
  WHERE a.id = NEW.account_id
  GROUP BY a.id;
END$$

DELIMITER ;

-- ============================================
-- Sample Data and Initial Setup
-- ============================================

-- Sample query: Get account performance summary
-- SELECT
--   a.id,
--   a.name,
--   a.current_cash,
--   a.total_pl,
--   a.win_rate,
--   a.total_trades,
--   (SELECT COUNT(*) FROM paper_trading_positions WHERE account_id = a.id) as position_count
-- FROM paper_trading_accounts a
-- WHERE a.user_id = 'user_123' AND a.status = 'active';

-- Sample query: Get recent trades
-- SELECT * FROM paper_trading_orders
-- WHERE account_id = 'account_id_here'
-- ORDER BY created_at DESC
-- LIMIT 20;

-- Sample query: Get equity curve
-- SELECT
--   DATE(timestamp) as date,
--   total_equity,
--   unrealized_pl
-- FROM paper_trading_equity_history
-- WHERE account_id = 'account_id_here'
-- ORDER BY timestamp;
