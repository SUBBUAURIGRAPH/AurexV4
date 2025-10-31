-- Migration: Create portfolios table
-- Date: October 31, 2025
-- Description: Store portfolio summary data for each user

CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  available_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  cash DECIMAL(15,2) NOT NULL DEFAULT 0,
  today_return DECIMAL(15,2) DEFAULT 0,
  ytd_return DECIMAL(15,2) DEFAULT 0,
  total_gain_loss DECIMAL(15,2) DEFAULT 0,
  total_gain_loss_percent DECIMAL(5,2) DEFAULT 0,
  market_status VARCHAR(50) DEFAULT 'CLOSED' CHECK (market_status IN ('OPEN', 'CLOSED', 'PRE_MARKET', 'AFTER_HOURS')),
  ai_risk_score SMALLINT DEFAULT 5 CHECK (ai_risk_score >= 1 AND ai_risk_score <= 10),
  currency VARCHAR(3) DEFAULT 'USD',
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_last_updated ON portfolios(last_updated);
CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolios_user_id_unique ON portfolios(user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_portfolios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER portfolios_updated_at_trigger
BEFORE UPDATE ON portfolios
FOR EACH ROW
EXECUTE FUNCTION update_portfolios_updated_at();
