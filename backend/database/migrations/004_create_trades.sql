-- Migration: Create trades table
-- Date: October 31, 2025
-- Description: Store trade history for all transactions

CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol VARCHAR(10) NOT NULL,
  trade_type VARCHAR(50) NOT NULL CHECK (trade_type IN ('BUY', 'SELL')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('FILLED', 'PENDING', 'CANCELLED')),
  quantity DECIMAL(10,2) NOT NULL,
  price DECIMAL(10,4) NOT NULL,
  total DECIMAL(15,2) NOT NULL,
  signal_type VARCHAR(50) NOT NULL CHECK (signal_type IN ('AI', 'MANUAL', 'SIGNAL')),
  commission DECIMAL(10,4) DEFAULT 0,
  notes TEXT,
  trade_date TIMESTAMP NOT NULL,
  executed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trades_portfolio_id ON trades(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_trade_date ON trades(trade_date);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_portfolio_date ON trades(portfolio_id, trade_date DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_trades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trades_updated_at_trigger
BEFORE UPDATE ON trades
FOR EACH ROW
EXECUTE FUNCTION update_trades_updated_at();
