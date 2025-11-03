# HMS CLI Usage Examples

Practical examples and workflows for the HMS Trading Platform CLI

**Version:** 2.0.0
**Last Updated:** November 2, 2025

## Table of Contents

- [Getting Started](#getting-started)
- [Account Management](#account-management)
- [Trading Workflows](#trading-workflows)
- [Strategy Development](#strategy-development)
- [Portfolio Management](#portfolio-management)
- [Market Analysis](#market-analysis)
- [Risk Management](#risk-management)
- [Paper Trading](#paper-trading)
- [Automation & Scripting](#automation--scripting)
- [Integration with External Tools](#integration-with-external-tools)
- [Advanced Workflows](#advanced-workflows)
- [Best Practices](#best-practices)

---

## Getting Started

### Initial Setup

```bash
# Install CLI globally
npm install -g @hms/trading-cli

# Check installation
hms --version

# Check system status
hms system status

# Configure API endpoint
hms system config set api.url https://api.hms-trading.com

# Set default user
hms system config set user.default your-user-id

# Verify configuration
hms system config
```

### Quick Health Check

```bash
# Check all system components
hms system health

# View detailed status
hms system status --detailed

# Monitor logs
hms system logs --follow
```

---

## Account Management

### Creating and Managing Accounts

```bash
# Create a paper trading account for testing
hms paper create --name "Strategy Testing" --balance 100000

# Create a live trading account
hms accounts create --name "Live Trading" --type LIVE

# List all accounts
hms accounts list

# Get detailed information
hms accounts get acc-123 --show-positions

# Check balance
hms accounts balance acc-123

# View balance history
hms accounts balance acc-123 --history --days 90
```

### Account Monitoring

```bash
# Monitor multiple accounts
hms accounts list --format table

# Export account data
hms accounts list --format json --output accounts.json

# Filter active accounts
hms accounts list --status ACTIVE --format csv
```

---

## Trading Workflows

### Basic Trading Flow

```bash
# 1. Check market hours
hms market hours

# 2. Get current quote
hms market quote AAPL

# 3. Place market order
hms orders create \
  --account acc-123 \
  --symbol AAPL \
  --type MARKET \
  --side BUY \
  --quantity 100

# 4. Monitor order status
hms orders status ord-001 --watch

# 5. Check position
hms portfolio positions --symbol AAPL
```

### Limit Order Strategy

```bash
# Get current price
CURRENT_PRICE=$(hms market quote AAPL --format json | jq -r '.price')

# Calculate limit price (2% below current)
LIMIT_PRICE=$(echo "$CURRENT_PRICE * 0.98" | bc)

# Place limit buy order
hms orders create \
  --account acc-123 \
  --symbol AAPL \
  --type LIMIT \
  --side BUY \
  --quantity 100 \
  --price $LIMIT_PRICE

# List pending orders
hms orders list --status PENDING
```

### Stop Loss Protection

```bash
# Get current position
hms portfolio positions --symbol AAPL --format json

# Place stop loss order (5% below current price)
hms orders create \
  --account acc-123 \
  --symbol AAPL \
  --type STOP \
  --side SELL \
  --quantity 100 \
  --stop-price 166.25

# Monitor active orders
hms orders list --status PENDING --symbol AAPL
```

### Bracket Order (Entry + Stop Loss + Take Profit)

```bash
# 1. Entry: Buy at market
ENTRY_ORDER=$(hms orders create \
  --account acc-123 \
  --symbol AAPL \
  --type MARKET \
  --side BUY \
  --quantity 100 \
  --format json | jq -r '.id')

# Wait for fill
hms orders status $ENTRY_ORDER --watch

# 2. Stop Loss: Sell 5% below entry
hms orders create \
  --account acc-123 \
  --symbol AAPL \
  --type STOP \
  --side SELL \
  --quantity 100 \
  --stop-price 166.25

# 3. Take Profit: Sell 10% above entry
hms orders create \
  --account acc-123 \
  --symbol AAPL \
  --type LIMIT \
  --side SELL \
  --quantity 100 \
  --price 192.50
```

---

## Strategy Development

### Creating a Momentum Strategy

```bash
# Create strategy with configuration
hms strategies create \
  --name "Momentum Trading" \
  --type MOMENTUM \
  --description "Buy stocks with strong upward momentum" \
  --config '{
    "lookback": 20,
    "threshold": 0.02,
    "stopLoss": 0.05,
    "takeProfit": 0.10,
    "maxPositions": 5
  }'

# List strategies
hms strategies list

# View strategy details
hms strategies get strat-001 --show-config
```

### Backtesting a Strategy

```bash
# Run backtest for last year
hms strategies backtest strat-001 \
  --start-date 2024-01-01 \
  --end-date 2024-12-31 \
  --capital 100000 \
  --format json --output backtest-results.json

# Run backtest on specific symbols
hms strategies backtest strat-001 \
  --start-date 2024-01-01 \
  --end-date 2024-12-31 \
  --symbols AAPL,MSFT,GOOGL,AMZN,META \
  --capital 100000

# View backtest results
cat backtest-results.json | jq '.performance'
```

### Strategy Optimization

```bash
# Test multiple parameter combinations
for LOOKBACK in 10 20 30; do
  for THRESHOLD in 0.01 0.02 0.03; do
    echo "Testing lookback=$LOOKBACK threshold=$THRESHOLD"

    hms strategies backtest strat-001 \
      --start-date 2024-01-01 \
      --end-date 2024-12-31 \
      --config "{\"lookback\":$LOOKBACK,\"threshold\":$THRESHOLD}" \
      --output "backtest-$LOOKBACK-$THRESHOLD.json"
  done
done

# Find best performing configuration
grep -h "totalReturn" backtest-*.json | sort -rn | head -1
```

### Live Strategy Deployment

```bash
# 1. Test in paper trading first
hms strategies update strat-001 --account acc-456

# 2. Monitor performance for 30 days
hms strategies performance strat-001 --days 30

# 3. If successful, deploy to live
hms strategies update strat-001 --account acc-123 --status ACTIVE

# 4. Monitor closely
hms strategies performance strat-001 --watch
```

---

## Portfolio Management

### Portfolio Analysis

```bash
# View portfolio summary
hms portfolio summary

# Get detailed positions
hms portfolio positions --show-pnl

# View asset allocation
hms portfolio allocation --chart

# Check portfolio performance
hms portfolio performance --days 30 --benchmark SPY

# Export portfolio data
hms portfolio summary --format json --output portfolio.json
```

### Portfolio Rebalancing

```bash
# 1. Check current allocation
hms portfolio allocation

# 2. Define target allocation
cat > target-allocation.json << EOF
{
  "AAPL": 0.20,
  "MSFT": 0.20,
  "GOOGL": 0.20,
  "AMZN": 0.15,
  "META": 0.15,
  "CASH": 0.10
}
EOF

# 3. Preview rebalancing actions
hms portfolio rebalance --target @target-allocation.json

# 4. Execute rebalancing
hms portfolio rebalance --target @target-allocation.json --execute

# 5. Verify new allocation
hms portfolio allocation
```

### Dividend Tracking

```bash
# Get positions with dividend information
hms portfolio positions --show-dividends

# Calculate dividend yield
hms portfolio summary --show-income

# Export dividend history
hms portfolio dividends --start-date 2024-01-01 --format csv --output dividends.csv
```

---

## Market Analysis

### Multi-Symbol Quote Monitoring

```bash
# Create watchlist
hms market watchlist add AAPL
hms market watchlist add MSFT
hms market watchlist add GOOGL
hms market watchlist add AMZN
hms market watchlist add META

# Monitor watchlist
watch -n 5 'hms market watchlist'

# Get quotes with details
hms market quote AAPL MSFT GOOGL --verbose
```

### Technical Analysis

```bash
# Get historical data
hms market candles AAPL --interval 1d --limit 252 --format csv --output aapl-daily.csv

# Calculate moving averages (using external tool)
cat aapl-daily.csv | awk -F',' 'NR>1 {sum+=$5; if(NR>20) print $1","sum/20; if(NR>21) sum-=prev[NR-20]} {prev[NR]=$5}'

# Get intraday data
hms market candles AAPL --interval 5m --limit 78 --format json
```

### Market Screening

```bash
# Search for stocks by sector
hms market search --query "technology" --limit 50 --format csv > tech-stocks.csv

# Search by market cap
hms market search --query "large-cap" --filter "marketCap>100B" --format csv

# Find stocks with specific criteria
hms market search --filter "price>100 AND volume>1M AND sector=Technology"
```

---

## Risk Management

### Portfolio Risk Analysis

```bash
# View risk metrics
hms analytics risk

# Check Value at Risk
hms analytics risk --confidence 95 --horizon 1

# Stress testing
hms analytics risk --scenario "2008_crisis"

# Generate risk report
hms analytics risk --format json --output risk-report.json
```

### Position Sizing

```bash
#!/bin/bash
# Position sizing script based on portfolio risk

ACCOUNT_BALANCE=$(hms accounts balance acc-123 --format json | jq -r '.balance')
RISK_PER_TRADE=0.02  # 2% risk per trade
STOP_LOSS_PCT=0.05   # 5% stop loss

# Calculate position size
RISK_AMOUNT=$(echo "$ACCOUNT_BALANCE * $RISK_PER_TRADE" | bc)
POSITION_SIZE=$(echo "$RISK_AMOUNT / $STOP_LOSS_PCT" | bc)

echo "Account Balance: $ACCOUNT_BALANCE"
echo "Risk Amount: $RISK_AMOUNT"
echo "Position Size: $POSITION_SIZE"

# Place order with calculated size
hms orders create \
  --account acc-123 \
  --symbol AAPL \
  --type MARKET \
  --side BUY \
  --quantity $(echo "$POSITION_SIZE / 175" | bc)  # Divide by current price
```

### Drawdown Monitoring

```bash
# Monitor max drawdown
hms analytics performance --metric maxDrawdown

# Alert if drawdown exceeds threshold
DRAWDOWN=$(hms analytics performance --format json | jq -r '.maxDrawdown')
THRESHOLD=-0.15  # -15%

if (( $(echo "$DRAWDOWN < $THRESHOLD" | bc -l) )); then
  echo "WARNING: Drawdown $DRAWDOWN exceeds threshold $THRESHOLD"
  # Pause strategy
  hms strategies update strat-001 --status PAUSED
fi
```

---

## Paper Trading

### Complete Paper Trading Workflow

```bash
# 1. Create paper account
PAPER_ACCOUNT=$(hms paper create \
  --name "Strategy Test" \
  --balance 100000 \
  --format json | jq -r '.id')

# 2. Deploy strategy to paper account
hms strategies update strat-001 --account $PAPER_ACCOUNT

# 3. Simulate market conditions
hms paper simulate \
  --account $PAPER_ACCOUNT \
  --scenario bull_market \
  --duration 30d

# 4. Monitor performance
hms portfolio performance --account $PAPER_ACCOUNT

# 5. Compare with live account
hms paper compare \
  --paper-account $PAPER_ACCOUNT \
  --live-account acc-123

# 6. If successful, migrate to live
if [ $(hms analytics performance --account $PAPER_ACCOUNT --format json | jq -r '.sharpeRatio') > 1.5 ]; then
  echo "Paper trading successful. Ready for live deployment."
  hms strategies update strat-001 --account acc-123
fi
```

### Historical Simulation

```bash
# Simulate specific historical period
hms paper simulate \
  --account $PAPER_ACCOUNT \
  --start-date 2024-01-01 \
  --end-date 2024-12-31 \
  --speed 100  # 100x speed

# Simulate market crash
hms paper simulate \
  --account $PAPER_ACCOUNT \
  --scenario crash_2008
```

---

## Automation & Scripting

### Daily Trading Bot

```bash
#!/bin/bash
# Daily trading automation script

# Check if market is open
if [ $(hms market hours --format json | jq -r '.status') == "OPEN" ]; then

  # Get top movers
  MOVERS=$(hms market search --filter "changePercent>5" --limit 10 --format json)

  # Analyze each mover
  echo "$MOVERS" | jq -c '.[]' | while read stock; do
    SYMBOL=$(echo $stock | jq -r '.symbol')

    # Check if meets criteria
    PRICE=$(echo $stock | jq -r '.price')
    VOLUME=$(echo $stock | jq -r '.volume')

    if [ $PRICE -gt 50 ] && [ $VOLUME -gt 1000000 ]; then
      echo "Trading opportunity: $SYMBOL"

      # Place order
      hms orders create \
        --account acc-123 \
        --symbol $SYMBOL \
        --type LIMIT \
        --side BUY \
        --quantity 100 \
        --price $(echo "$PRICE * 0.99" | bc)
    fi
  done
fi
```

### Performance Monitoring Script

```bash
#!/bin/bash
# Monitor and alert on performance metrics

# Get metrics
METRICS=$(hms analytics performance --format json)
DAILY_RETURN=$(echo $METRICS | jq -r '.dailyReturn')
SHARPE=$(echo $METRICS | jq -r '.sharpeRatio')
DRAWDOWN=$(echo $METRICS | jq -r '.maxDrawdown')

# Alert conditions
if (( $(echo "$DAILY_RETURN < -0.05" | bc -l) )); then
  echo "ALERT: Daily loss exceeds 5%"
  # Send notification (webhook, email, etc.)
fi

if (( $(echo "$SHARPE < 1.0" | bc -l) )); then
  echo "WARNING: Sharpe ratio below 1.0"
fi

if (( $(echo "$DRAWDOWN < -0.20" | bc -l) )); then
  echo "CRITICAL: Drawdown exceeds 20%"
  # Pause all strategies
  hms strategies list --format json | jq -r '.[].id' | while read id; do
    hms strategies update $id --status PAUSED
  done
fi
```

### End-of-Day Report

```bash
#!/bin/bash
# Generate end-of-day trading report

REPORT_DATE=$(date +%Y-%m-%d)
REPORT_FILE="report-$REPORT_DATE.md"

cat > $REPORT_FILE << EOF
# Trading Report - $REPORT_DATE

## Portfolio Summary
$(hms portfolio summary --format table)

## Performance Metrics
$(hms analytics performance --format table)

## Today's Trades
$(hms orders list --start-date $REPORT_DATE --format table)

## Risk Metrics
$(hms analytics risk --format table)

## Top Positions
$(hms portfolio positions --show-pnl --limit 5 --format table)

---
Generated at: $(date)
EOF

echo "Report generated: $REPORT_FILE"

# Email report (using external tool)
# mail -s "Trading Report $REPORT_DATE" you@example.com < $REPORT_FILE
```

---

## Integration with External Tools

### Export to Spreadsheet

```bash
# Export portfolio to CSV
hms portfolio positions --format csv --output positions.csv

# Export orders to CSV
hms orders list --start-date 2024-01-01 --format csv --output orders.csv

# Export performance metrics
hms analytics performance --format csv --output performance.csv

# Import to Excel/Google Sheets
# Open the CSV files in your spreadsheet application
```

### Integration with Python

```bash
# Export data as JSON for Python analysis
hms portfolio summary --format json > portfolio.json

# Python script to analyze
cat > analyze.py << 'EOF'
import json
import pandas as pd

# Load portfolio data
with open('portfolio.json') as f:
    portfolio = json.load(f)

# Convert to DataFrame
df = pd.DataFrame(portfolio['positions'])

# Calculate metrics
total_value = df['marketValue'].sum()
best_performer = df.loc[df['unrealizedPnLPercent'].idxmax()]

print(f"Total Value: ${total_value:,.2f}")
print(f"Best Performer: {best_performer['symbol']} ({best_performer['unrealizedPnLPercent']:.2%})")
EOF

python3 analyze.py
```

### Integration with Trading View

```bash
# Export candle data
hms market candles AAPL --interval 1d --limit 365 --format csv --output aapl-1year.csv

# Format for TradingView import
awk -F',' 'BEGIN {print "time,open,high,low,close,volume"} NR>1 {print $1","$2","$3","$4","$5","$6}' aapl-1year.csv > tradingview-data.csv
```

### Webhook Notifications

```bash
# Monitor orders and send webhooks
hms orders list --status FILLED --watch | while read line; do
  curl -X POST https://hooks.slack.com/your-webhook \
    -H 'Content-Type: application/json' \
    -d "{\"text\": \"Order Filled: $line\"}"
done
```

---

## Advanced Workflows

### Multi-Account Management

```bash
# Manage multiple accounts
ACCOUNTS=$(hms accounts list --format json | jq -r '.[].id')

# Execute same strategy across accounts
for ACCOUNT in $ACCOUNTS; do
  echo "Deploying to account $ACCOUNT"
  hms strategies update strat-001 --account $ACCOUNT
done

# Compare performance across accounts
hms accounts list --format json | jq -r '.[].id' | while read acc; do
  echo "Account: $acc"
  hms analytics performance --account $acc
  echo "---"
done
```

### Pairs Trading

```bash
# Monitor two correlated stocks
while true; do
  AAPL=$(hms market quote AAPL --format json | jq -r '.price')
  MSFT=$(hms market quote MSFT --format json | jq -r '.price')

  RATIO=$(echo "$AAPL / $MSFT" | bc -l)
  echo "AAPL/MSFT Ratio: $RATIO"

  # Trade if ratio deviates from mean
  if (( $(echo "$RATIO > 1.2" | bc -l) )); then
    echo "Selling AAPL, Buying MSFT"
    hms orders create --symbol AAPL --side SELL --quantity 100 --type MARKET
    hms orders create --symbol MSFT --side BUY --quantity 100 --type MARKET
  fi

  sleep 60
done
```

### Portfolio Insurance (Hedging)

```bash
# Calculate hedge ratio
PORTFOLIO_VALUE=$(hms portfolio summary --format json | jq -r '.totalValue')
BETA=$(hms analytics performance --format json | jq -r '.beta')
HEDGE_RATIO=$(echo "$BETA" | bc -l)

# Buy SPY puts as hedge
SPY_PRICE=$(hms market quote SPY --format json | jq -r '.price')
PUT_QUANTITY=$(echo "($PORTFOLIO_VALUE * $HEDGE_RATIO * 0.05) / ($SPY_PRICE * 100)" | bc)

echo "Hedging $PORTFOLIO_VALUE portfolio with $PUT_QUANTITY SPY puts"
```

---

## Best Practices

### Error Handling

```bash
#!/bin/bash
# Robust order placement with error handling

place_order() {
  local result=$(hms orders create \
    --account acc-123 \
    --symbol $1 \
    --type MARKET \
    --side BUY \
    --quantity $2 \
    2>&1)

  if [ $? -eq 0 ]; then
    echo "Order placed successfully: $result"
    return 0
  else
    echo "Order failed: $result"
    return 1
  fi
}

# Use with retry logic
for i in {1..3}; do
  if place_order "AAPL" 100; then
    break
  else
    echo "Retry attempt $i"
    sleep 5
  fi
done
```

### Logging Best Practices

```bash
#!/bin/bash
# Logging wrapper for all trading operations

LOG_FILE="trading-$(date +%Y-%m-%d).log"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

log "Starting trading session"
log "Account balance: $(hms accounts balance acc-123)"

# Execute trades with logging
hms orders create --symbol AAPL --quantity 100 --type MARKET 2>&1 | while read line; do
  log "ORDER: $line"
done

log "Trading session complete"
```

### Rate Limiting

```bash
#!/bin/bash
# Respect API rate limits

RATE_LIMIT=10  # requests per second
INTERVAL=$(echo "1 / $RATE_LIMIT" | bc -l)

for SYMBOL in AAPL MSFT GOOGL AMZN META TSLA NVDA; do
  hms market quote $SYMBOL
  sleep $INTERVAL
done
```

### Configuration Management

```bash
# Use environment-specific configs
ENV=${ENV:-production}
CONFIG_FILE="config.$ENV.json"

# Load configuration
hms system config set api.url $(jq -r '.api.url' $CONFIG_FILE)
hms system config set user.default $(jq -r '.user.default' $CONFIG_FILE)

# Verify loaded config
hms system config
```

---

## Tips and Tricks

### Quick Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc
alias hq='hms market quote'
alias hp='hms portfolio summary'
alias ho='hms orders list'
alias hs='hms strategies list'
alias ha='hms analytics summary'

# Usage
hq AAPL
hp
ho --status PENDING
```

### Piping and Filtering

```bash
# Get top gainers
hms market search --filter "changePercent>5" --format json | jq '.[] | select(.volume > 1000000)'

# Find large positions
hms portfolio positions --format json | jq '.[] | select(.marketValue > 10000)'

# Filter orders by date
hms orders list --format json | jq '.[] | select(.createdAt > "2024-01-01")'
```

### Performance Optimization

```bash
# Cache frequently accessed data
PORTFOLIO_CACHE="/tmp/portfolio-cache.json"
CACHE_TTL=300  # 5 minutes

get_portfolio() {
  if [ ! -f $PORTFOLIO_CACHE ] || [ $(( $(date +%s) - $(stat -c %Y $PORTFOLIO_CACHE) )) -gt $CACHE_TTL ]; then
    hms portfolio summary --format json > $PORTFOLIO_CACHE
  fi
  cat $PORTFOLIO_CACHE
}

get_portfolio | jq '.totalValue'
```

---

**End of CLI Examples**

For more information, see:
- [CLI Commands Reference](./CLI_COMMANDS.md)
- [Documentation](https://docs.hms-trading.com)
- [GitHub Examples](https://github.com/hms/trading-platform/tree/main/examples)
