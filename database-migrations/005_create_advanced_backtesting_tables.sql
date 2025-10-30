-- =====================================================
-- Advanced Backtesting Features Database Migration
-- Creates tables for multi-asset, walk-forward, and Monte Carlo features
-- Version: 1.0.0
-- =====================================================

-- Multi-Asset Backtesting Results Table
-- Stores results from portfolio-level backtests across multiple assets
CREATE TABLE IF NOT EXISTS backtest_multi_asset (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  symbols JSON NOT NULL, -- Array of symbols in portfolio
  allocation JSON NOT NULL, -- {symbol: percentage} allocation
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  initial_capital DECIMAL(20, 2) NOT NULL DEFAULT 100000.00,
  rebalance_config JSON NULL, -- {frequency: 'monthly|quarterly|yearly', threshold: percentage}
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  results JSON NULL, -- Full results object with metrics
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Walk-Forward Optimization Results Table
-- Stores results from walk-forward parameter optimization
CREATE TABLE IF NOT EXISTS backtest_walk_forward (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  insample_period INT NOT NULL, -- Days for in-sample window
  outofsample_period INT NOT NULL, -- Days for out-of-sample validation
  step_size INT NOT NULL, -- Days to step forward
  parameter_grid JSON NOT NULL, -- Parameter combinations to test
  objective_metric VARCHAR(50) NOT NULL DEFAULT 'sharpeRatio', -- Metric to optimize
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  results JSON NULL, -- {windows: [...], summary: {...}, stability: {...}}
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_symbol (symbol),
  INDEX idx_created_at (created_at),
  INDEX idx_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Walk-Forward Window Results Table
-- Stores detailed results for each window in walk-forward analysis
CREATE TABLE IF NOT EXISTS backtest_walk_forward_windows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  optimization_id INT NOT NULL,
  window_number INT NOT NULL,
  insample_start DATE NOT NULL,
  insample_end DATE NOT NULL,
  oosample_start DATE NOT NULL,
  oosample_end DATE NOT NULL,
  is_metrics JSON NOT NULL, -- In-sample metrics
  oos_metrics JSON NOT NULL, -- Out-of-sample metrics
  best_parameters JSON NOT NULL, -- Best parameters for this window
  performance_degradation DECIMAL(10, 4) NOT NULL, -- Difference between IS and OOS
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (optimization_id) REFERENCES backtest_walk_forward(id) ON DELETE CASCADE,
  INDEX idx_optimization_id (optimization_id),
  INDEX idx_window_number (optimization_id, window_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Monte Carlo Simulation Results Table
-- Stores results from Monte Carlo probabilistic analysis
CREATE TABLE IF NOT EXISTS backtest_monte_carlo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  backtest_id VARCHAR(36) NOT NULL, -- Reference to original backtest
  num_simulations INT NOT NULL DEFAULT 1000, -- Number of simulations run
  method VARCHAR(50) NOT NULL DEFAULT 'returns', -- 'returns' or 'bootstrapping'
  confidence_level DECIMAL(5, 4) NOT NULL DEFAULT 0.95, -- Confidence level for VaR/CVaR
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  results JSON NULL, -- Full simulation results
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_backtest_id (backtest_id),
  INDEX idx_created_at (created_at),
  INDEX idx_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Monte Carlo Simulation Paths Table
-- Stores individual simulation paths for detailed analysis (optional - can be very large)
CREATE TABLE IF NOT EXISTS backtest_monte_carlo_paths (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  simulation_id INT NOT NULL,
  path_number INT NOT NULL,
  path_data JSON NOT NULL, -- Array of equity values for the path
  final_value DECIMAL(20, 8) NOT NULL,
  max_drawdown DECIMAL(10, 4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (simulation_id) REFERENCES backtest_monte_carlo(id) ON DELETE CASCADE,
  INDEX idx_simulation_id (simulation_id),
  INDEX idx_path_number (simulation_id, path_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Advanced Backtesting Order Management Table
-- Stores advanced orders (limit, stop, stop-limit) for backtesting
CREATE TABLE IF NOT EXISTS backtest_advanced_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  backtest_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(10) NOT NULL, -- BUY, SELL
  quantity DECIMAL(20, 8) NOT NULL,
  type VARCHAR(20) NOT NULL, -- market, limit, stop, stop_limit
  limit_price DECIMAL(20, 8) NULL,
  stop_price DECIMAL(20, 8) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, filled, cancelled, rejected
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  filled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_backtest_id (backtest_id),
  INDEX idx_status (status),
  INDEX idx_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Advanced Optimization Results Table
-- Stores results from grid search and Bayesian optimization
CREATE TABLE IF NOT EXISTS backtest_optimization_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  optimization_type VARCHAR(50) NOT NULL, -- grid_search, bayesian, random_search
  parameter_grid JSON NOT NULL,
  objective_metric VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  best_parameters JSON NULL,
  best_metric_value DECIMAL(10, 4) NULL,
  trials_completed INT DEFAULT 0,
  max_trials INT DEFAULT 100,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_symbol (symbol),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optimization Trials Table
-- Stores individual trials from parameter optimization
CREATE TABLE IF NOT EXISTS backtest_optimization_trials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  optimization_result_id INT NOT NULL,
  trial_number INT NOT NULL,
  parameters JSON NOT NULL,
  metric_value DECIMAL(10, 4) NOT NULL,
  metrics JSON NULL, -- Full metrics for this trial
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (optimization_result_id) REFERENCES backtest_optimization_results(id) ON DELETE CASCADE,
  INDEX idx_optimization_id (optimization_result_id),
  INDEX idx_trial_number (optimization_result_id, trial_number),
  INDEX idx_metric_value (metric_value DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Views for Advanced Features
-- =====================================================

-- View: Multi-Asset Backtest Summary
CREATE OR REPLACE VIEW multi_asset_backtest_summary AS
SELECT
  mab.id,
  mab.user_id,
  mab.name,
  mab.symbols,
  mab.allocation,
  mab.start_date,
  mab.end_date,
  mab.initial_capital,
  mab.status,
  mab.created_at,
  mab.completed_at,
  JSON_EXTRACT(mab.results, '$.metrics.totalReturn') as total_return,
  JSON_EXTRACT(mab.results, '$.metrics.sharpeRatio') as sharpe_ratio,
  JSON_EXTRACT(mab.results, '$.metrics.maxDrawdown') as max_drawdown
FROM backtest_multi_asset mab;

-- View: Walk-Forward Optimization Summary
CREATE OR REPLACE VIEW walk_forward_summary AS
SELECT
  wfo.id,
  wfo.user_id,
  wfo.name,
  wfo.symbol,
  wfo.start_date,
  wfo.end_date,
  wfo.status,
  JSON_EXTRACT(wfo.results, '$.summary.totalWindows') as total_windows,
  JSON_EXTRACT(wfo.results, '$.summary.oosMeanReturn') as oos_mean_return,
  JSON_EXTRACT(wfo.results, '$.summary.degradationMean') as degradation_mean,
  JSON_EXTRACT(wfo.results, '$.summary.isOverfit') as is_overfit,
  wfo.created_at,
  wfo.completed_at
FROM backtest_walk_forward wfo;

-- View: Monte Carlo Simulation Summary
CREATE OR REPLACE VIEW monte_carlo_summary AS
SELECT
  mc.id,
  mc.user_id,
  mc.name,
  mc.backtest_id,
  mc.num_simulations,
  mc.method,
  mc.confidence_level,
  mc.status,
  JSON_EXTRACT(mc.results, '$.statistics.finalValueMean') as final_value_mean,
  JSON_EXTRACT(mc.results, '$.statistics.returnMean') as return_mean,
  JSON_EXTRACT(mc.results, '$.statistics.returnCI95') as return_ci_95,
  JSON_EXTRACT(mc.results, '$.statistics.valueAtRisk') as value_at_risk,
  JSON_EXTRACT(mc.results, '$.statistics.probabilityOfProfit') as prob_of_profit,
  mc.created_at,
  mc.completed_at
FROM backtest_monte_carlo mc;

-- =====================================================
-- Indexes for Performance
-- =====================================================

CREATE INDEX idx_multi_asset_user_status ON backtest_multi_asset(user_id, status, created_at DESC);
CREATE INDEX idx_walk_forward_user_status ON backtest_walk_forward(user_id, status, created_at DESC);
CREATE INDEX idx_monte_carlo_user_status ON backtest_monte_carlo(user_id, status, created_at DESC);
CREATE INDEX idx_optimization_user_status ON backtest_optimization_results(user_id, status, created_at DESC);

-- =====================================================
-- Table Comments
-- =====================================================

ALTER TABLE backtest_multi_asset COMMENT='Portfolio-level backtesting results across multiple assets';
ALTER TABLE backtest_walk_forward COMMENT='Walk-forward optimization results with out-of-sample validation';
ALTER TABLE backtest_walk_forward_windows COMMENT='Detailed window results for walk-forward analysis';
ALTER TABLE backtest_monte_carlo COMMENT='Monte Carlo simulation results for probabilistic analysis';
ALTER TABLE backtest_monte_carlo_paths COMMENT='Individual simulation paths from Monte Carlo';
ALTER TABLE backtest_advanced_orders COMMENT='Advanced order types (limit, stop, stop-limit) for backtesting';
ALTER TABLE backtest_optimization_results COMMENT='Parameter optimization results from grid/Bayesian/random search';
ALTER TABLE backtest_optimization_trials COMMENT='Individual trials from optimization process';

-- =====================================================
-- Migration Complete
-- =====================================================
