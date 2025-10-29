-- Execution History Schema
-- Stores skill execution history and analytics
-- Version: 1.0.0
-- Created: October 29, 2025

-- Create execution history table
CREATE TABLE IF NOT EXISTS execution_history (
  id VARCHAR(32) PRIMARY KEY,
  skill_id VARCHAR(255) NOT NULL,
  agent_id VARCHAR(255),
  user_id VARCHAR(255),
  session_id VARCHAR(255),

  -- Execution details
  status VARCHAR(50) NOT NULL, -- 'pending', 'running', 'success', 'failed', 'timeout'
  result JSONB,
  error TEXT,

  -- Timing
  start_time TIMESTAMP NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP,
  duration_ms INTEGER DEFAULT 0,

  -- Retry information
  retries INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 0,
  timeout_ms INTEGER DEFAULT 30000,

  -- Request information
  parameters JSONB,
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Versioning
  version VARCHAR(20) DEFAULT '1.0.0',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Indexes
  INDEX idx_skill_id (skill_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_start_time (start_time),
  INDEX idx_skill_user (skill_id, user_id),
  INDEX idx_skill_status (skill_id, status),
  FULL TEXT INDEX idx_error (error)
);

-- Create execution statistics table
CREATE TABLE IF NOT EXISTS execution_stats (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  -- Dimension keys
  skill_id VARCHAR(255),
  user_id VARCHAR(255),
  agent_id VARCHAR(255),
  status VARCHAR(50),

  -- Time period
  period_date DATE NOT NULL,
  period_hour HOUR,

  -- Statistics
  total_executions BIGINT DEFAULT 0,
  successful_executions BIGINT DEFAULT 0,
  failed_executions BIGINT DEFAULT 0,
  timeout_executions BIGINT DEFAULT 0,

  total_duration_ms BIGINT DEFAULT 0,
  min_duration_ms INTEGER,
  max_duration_ms INTEGER,
  avg_duration_ms DECIMAL(10, 2),

  total_retries BIGINT DEFAULT 0,
  avg_retries DECIMAL(10, 2),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Unique constraint
  UNIQUE KEY unique_period (skill_id, user_id, agent_id, status, period_date, period_hour),

  -- Indexes
  INDEX idx_skill_date (skill_id, period_date),
  INDEX idx_user_date (user_id, period_date),
  INDEX idx_period_date (period_date)
);

-- Create error tracking table
CREATE TABLE IF NOT EXISTS execution_errors (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  execution_id VARCHAR(32) NOT NULL,
  skill_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255),

  error_type VARCHAR(255),
  error_message TEXT,
  stack_trace TEXT,

  severity VARCHAR(20), -- 'info', 'warning', 'error', 'critical'

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Foreign keys
  FOREIGN KEY (execution_id) REFERENCES execution_history(id) ON DELETE CASCADE,

  -- Indexes
  INDEX idx_skill_error (skill_id, error_type),
  INDEX idx_execution (execution_id),
  INDEX idx_created_at (created_at)
);

-- Create skill performance table
CREATE TABLE IF NOT EXISTS skill_performance (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  skill_id VARCHAR(255) NOT NULL UNIQUE,

  -- Performance metrics
  total_invocations BIGINT DEFAULT 0,
  success_count BIGINT DEFAULT 0,
  failure_count BIGINT DEFAULT 0,
  success_rate DECIMAL(5, 2),

  avg_duration_ms DECIMAL(10, 2),
  p50_duration_ms INTEGER,
  p95_duration_ms INTEGER,
  p99_duration_ms INTEGER,

  avg_retries DECIMAL(5, 2),

  -- Last execution
  last_executed_at TIMESTAMP,
  last_executed_by VARCHAR(255),
  last_status VARCHAR(50),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Index
  INDEX idx_success_rate (success_rate)
);

-- Create user execution metrics table
CREATE TABLE IF NOT EXISTS user_execution_metrics (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  user_id VARCHAR(255) NOT NULL UNIQUE,

  -- Execution summary
  total_executions BIGINT DEFAULT 0,
  successful_executions BIGINT DEFAULT 0,
  failed_executions BIGINT DEFAULT 0,

  success_rate DECIMAL(5, 2),
  avg_execution_time_ms DECIMAL(10, 2),

  -- Activity
  first_execution_at TIMESTAMP,
  last_execution_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Index
  INDEX idx_last_execution (last_execution_at)
);

-- Create audit trail table for sensitive operations
CREATE TABLE IF NOT EXISTS execution_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  execution_id VARCHAR(32),
  user_id VARCHAR(255),

  action VARCHAR(255), -- 'created', 'updated', 'failed', 'retried', 'succeeded'
  old_state JSONB,
  new_state JSONB,

  ip_address VARCHAR(45),
  user_agent TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Indexes
  INDEX idx_execution_id (execution_id),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
);

-- Create stored procedure to calculate execution stats
DELIMITER $$

CREATE PROCEDURE calculate_execution_stats()
BEGIN
  INSERT INTO execution_stats (
    skill_id, user_id, period_date,
    total_executions, successful_executions, failed_executions, timeout_executions,
    total_duration_ms, avg_duration_ms
  )
  SELECT
    skill_id,
    user_id,
    DATE(start_time) as period_date,
    COUNT(*) as total_executions,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_executions,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_executions,
    SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeout_executions,
    SUM(duration_ms) as total_duration_ms,
    AVG(duration_ms) as avg_duration_ms
  FROM execution_history
  WHERE DATE(start_time) = CURDATE()
  GROUP BY skill_id, user_id, DATE(start_time)
  ON DUPLICATE KEY UPDATE
    total_executions = VALUES(total_executions),
    successful_executions = VALUES(successful_executions),
    failed_executions = VALUES(failed_executions),
    timeout_executions = VALUES(timeout_executions),
    total_duration_ms = VALUES(total_duration_ms),
    avg_duration_ms = VALUES(avg_duration_ms),
    updated_at = NOW();
END$$

DELIMITER ;

-- Create triggers to update stats automatically
DELIMITER $$

CREATE TRIGGER update_skill_performance_on_execution
AFTER UPDATE ON execution_history
FOR EACH ROW
BEGIN
  IF NEW.status = 'success' OR NEW.status = 'failed' THEN
    UPDATE skill_performance
    SET
      total_invocations = total_invocations + 1,
      success_count = success_count + (CASE WHEN NEW.status = 'success' THEN 1 ELSE 0 END),
      failure_count = failure_count + (CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END),
      success_rate = (success_count + (CASE WHEN NEW.status = 'success' THEN 1 ELSE 0 END)) /
                     (total_invocations + 1) * 100,
      last_executed_at = NEW.end_time,
      last_status = NEW.status,
      updated_at = NOW()
    WHERE skill_id = NEW.skill_id;
  END IF;
END$$

DELIMITER ;

-- Create event to periodically calculate stats
-- Note: This requires EVENT privilege and might need to be scheduled separately
-- CREATE EVENT calculate_daily_stats
-- ON SCHEDULE EVERY 1 HOUR
-- DO CALL calculate_execution_stats();

-- Sample queries for common use cases

-- Get execution history for a skill
-- SELECT * FROM execution_history
-- WHERE skill_id = 'docker-manager'
-- ORDER BY start_time DESC LIMIT 100;

-- Get user execution metrics
-- SELECT
--   user_id,
--   COUNT(*) as total,
--   SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
--   AVG(duration_ms) as avg_duration
-- FROM execution_history
-- WHERE user_id = 'user_123'
-- GROUP BY user_id;

-- Get failed executions in last 24 hours
-- SELECT * FROM execution_history
-- WHERE status IN ('failed', 'timeout')
-- AND start_time > DATE_SUB(NOW(), INTERVAL 24 HOUR)
-- ORDER BY start_time DESC;

-- Get skill performance metrics
-- SELECT * FROM skill_performance
-- ORDER BY success_rate DESC;
