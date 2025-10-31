-- Migration: Create positions table
-- Date: October 31, 2025
-- Description: Store current portfolio positions (holdings)

CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol VARCHAR(10) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  entry_price DECIMAL(10,4) NOT NULL,
  current_price DECIMAL(10,4) NOT NULL,
  total_value DECIMAL(15,2) NOT NULL,
  gain_loss DECIMAL(15,2) NOT NULL,
  gain_loss_percent DECIMAL(5,2) NOT NULL,
  sector VARCHAR(100),
  risk_level VARCHAR(50) DEFAULT 'MEDIUM' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  last_price_update TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_positions_portfolio_id ON positions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_portfolio_symbol ON positions(portfolio_id, symbol);
CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_unique ON positions(portfolio_id, symbol);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER positions_updated_at_trigger
BEFORE UPDATE ON positions
FOR EACH ROW
EXECUTE FUNCTION update_positions_updated_at();
