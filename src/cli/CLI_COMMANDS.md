# HMS CLI Commands Reference

Complete command reference for the HMS Trading Platform CLI

**Version:** 2.0.0
**Last Updated:** November 2, 2025

## Table of Contents

- [Installation](#installation)
- [Global Options](#global-options)
- [Account Commands](#account-commands)
- [Strategy Commands](#strategy-commands)
- [Portfolio Commands](#portfolio-commands)
- [Order Commands](#order-commands)
- [Market Data Commands](#market-data-commands)
- [Analytics Commands](#analytics-commands)
- [Paper Trading Commands](#paper-trading-commands)
- [System Commands](#system-commands)
- [Output Formats](#output-formats)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

---

## Installation

```bash
npm install -g @hms/trading-cli
```

Or use directly with npx:
```bash
npx @hms/trading-cli <command>
```

---

## Global Options

All commands support these global options:

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--format` | `-f` | Output format (table, json, csv, yaml) | `table` |
| `--verbose` | `-v` | Verbose output with detailed information | `false` |
| `--user` | `-u` | User ID for authentication | `default-user` |
| `--output` | `-o` | Output file path (stdout if not specified) | `stdout` |
| `--color` | | Enable/disable colored output | `true` |
| `--help` | `-h` | Show command help | |
| `--version` | | Show CLI version | |

### Examples

```bash
# JSON output
hms accounts list --format json

# Save to file
hms portfolio summary --output portfolio.json --format json

# Verbose mode
hms orders list --verbose
```

---

## Account Commands

### `accounts list`

List all trading accounts

**Usage:**
```bash
hms accounts list [options]
```

**Options:**
- `--status <status>` - Filter by status (ACTIVE, INACTIVE, SUSPENDED)
- `--type <type>` - Filter by type (LIVE, PAPER, DEMO)
- `--sort <field>` - Sort by field (name, balance, created_at)
- `--limit <number>` - Limit number of results

**Examples:**
```bash
# List all accounts
hms accounts list

# List only active accounts
hms accounts list --status ACTIVE

# List paper trading accounts
hms accounts list --type PAPER

# Sort by balance (descending)
hms accounts list --sort balance
```

**Output:**
```
┌──────────┬───────────────────────┬────────┬─────────────┬──────────┬────────┐
│ ID       │ Name                  │ Type   │ Balance     │ Currency │ Status │
├──────────┼───────────────────────┼────────┼─────────────┼──────────┼────────┤
│ acc-123  │ Main Trading Account  │ LIVE   │ $125,000.00 │ USD      │ ACTIVE │
│ acc-456  │ Paper Trading Account │ PAPER  │ $100,000.00 │ USD      │ ACTIVE │
└──────────┴───────────────────────┴────────┴─────────────┴──────────┴────────┘
```

---

### `accounts get <id>`

Get detailed information about a specific account

**Usage:**
```bash
hms accounts get <account-id> [options]
```

**Options:**
- `--show-history` - Include account history
- `--show-positions` - Include current positions

**Examples:**
```bash
# Get account details
hms accounts get acc-123

# Get account with positions
hms accounts get acc-123 --show-positions
```

---

### `accounts create`

Create a new trading account

**Usage:**
```bash
hms accounts create [options]
```

**Options:**
- `--name <name>` - Account name (required)
- `--type <type>` - Account type: LIVE, PAPER, DEMO (required)
- `--balance <amount>` - Initial balance (required for PAPER/DEMO)
- `--currency <currency>` - Currency code (default: USD)

**Examples:**
```bash
# Create paper trading account
hms accounts create --name "Test Account" --type PAPER --balance 100000

# Create live account
hms accounts create --name "Live Trading" --type LIVE
```

---

### `accounts update <id>`

Update account information

**Usage:**
```bash
hms accounts update <account-id> [options]
```

**Options:**
- `--name <name>` - Update account name
- `--status <status>` - Update status (ACTIVE, INACTIVE)

**Examples:**
```bash
# Update account name
hms accounts update acc-123 --name "Updated Name"

# Deactivate account
hms accounts update acc-123 --status INACTIVE
```

---

### `accounts delete <id>`

Delete a trading account

**Usage:**
```bash
hms accounts delete <account-id> [options]
```

**Options:**
- `--confirm` - Skip confirmation prompt

**Examples:**
```bash
# Delete account (with confirmation)
hms accounts delete acc-123

# Delete without confirmation
hms accounts delete acc-123 --confirm
```

---

### `accounts balance <id>`

Show account balance and history

**Usage:**
```bash
hms accounts balance <account-id> [options]
```

**Options:**
- `--history` - Show balance history
- `--days <number>` - Number of days of history (default: 30)

**Examples:**
```bash
# Show current balance
hms accounts balance acc-123

# Show 90-day balance history
hms accounts balance acc-123 --history --days 90
```

---

## Strategy Commands

### `strategies list`

List all trading strategies

**Usage:**
```bash
hms strategies list [options]
```

**Options:**
- `--status <status>` - Filter by status (ACTIVE, PAUSED, STOPPED)
- `--type <type>` - Filter by type (MOMENTUM, MEAN_REVERSION, ARBITRAGE)
- `--sort <field>` - Sort by field (name, performance, created_at)

**Examples:**
```bash
# List all strategies
hms strategies list

# List active strategies
hms strategies list --status ACTIVE

# Sort by performance
hms strategies list --sort performance
```

---

### `strategies get <id>`

Get detailed information about a strategy

**Usage:**
```bash
hms strategies get <strategy-id> [options]
```

**Options:**
- `--show-config` - Show strategy configuration
- `--show-performance` - Show performance metrics

**Examples:**
```bash
# Get strategy details
hms strategies get strat-001

# Get with configuration
hms strategies get strat-001 --show-config
```

---

### `strategies create`

Create a new trading strategy

**Usage:**
```bash
hms strategies create [options]
```

**Options:**
- `--name <name>` - Strategy name (required)
- `--type <type>` - Strategy type (required)
- `--config <json>` - Strategy configuration as JSON
- `--description <text>` - Strategy description

**Examples:**
```bash
# Create momentum strategy
hms strategies create \
  --name "Momentum Strategy" \
  --type MOMENTUM \
  --config '{"lookback":20,"threshold":0.02}'

# Create from file
hms strategies create --name "My Strategy" --config @strategy-config.json
```

---

### `strategies update <id>`

Update strategy configuration or status

**Usage:**
```bash
hms strategies update <strategy-id> [options]
```

**Options:**
- `--config <json>` - Update configuration
- `--status <status>` - Update status (ACTIVE, PAUSED, STOPPED)
- `--name <name>` - Update name

**Examples:**
```bash
# Update configuration
hms strategies update strat-001 --config '{"lookback":30}'

# Pause strategy
hms strategies update strat-001 --status PAUSED
```

---

### `strategies delete <id>`

Delete a trading strategy

**Usage:**
```bash
hms strategies delete <strategy-id> [options]
```

**Options:**
- `--confirm` - Skip confirmation prompt

---

### `strategies backtest <id>`

Run backtest for a strategy

**Usage:**
```bash
hms strategies backtest <strategy-id> [options]
```

**Options:**
- `--start-date <date>` - Start date (YYYY-MM-DD)
- `--end-date <date>` - End date (YYYY-MM-DD)
- `--capital <amount>` - Initial capital
- `--symbols <list>` - Comma-separated symbols

**Examples:**
```bash
# Backtest strategy
hms strategies backtest strat-001 \
  --start-date 2024-01-01 \
  --end-date 2024-01-31 \
  --capital 100000

# Backtest specific symbols
hms strategies backtest strat-001 \
  --start-date 2024-01-01 \
  --end-date 2024-01-31 \
  --symbols AAPL,MSFT,GOOGL
```

---

### `strategies performance <id>`

Show strategy performance metrics

**Usage:**
```bash
hms strategies performance <strategy-id> [options]
```

**Options:**
- `--days <number>` - Number of days (default: 30)
- `--compare <id>` - Compare with another strategy

**Examples:**
```bash
# Show performance
hms strategies performance strat-001

# Compare strategies
hms strategies performance strat-001 --compare strat-002
```

---

## Portfolio Commands

### `portfolio summary`

Show portfolio summary

**Usage:**
```bash
hms portfolio summary [options]
```

**Options:**
- `--account <id>` - Account ID (default: default account)

**Examples:**
```bash
# Show portfolio summary
hms portfolio summary

# Show for specific account
hms portfolio summary --account acc-123
```

**Output:**
```
Portfolio Summary
─────────────────────────────────────
Total Value:      $125,000.00
Cash Balance:     $37,500.00
Invested:         $87,500.00
Total P&L:        +$12,500.00 (+11.11%)
Daily Return:     +$625.00 (+0.50%)

Top Positions:
1. MSFT: $28,000 (22.4%)
2. GOOGL: $21,000 (16.8%)
3. AAPL: $17,500 (14.0%)
```

---

### `portfolio positions`

List all portfolio positions

**Usage:**
```bash
hms portfolio positions [options]
```

**Options:**
- `--account <id>` - Account ID
- `--symbol <symbol>` - Filter by symbol
- `--show-pnl` - Show profit/loss details

**Examples:**
```bash
# List all positions
hms portfolio positions

# Show with P&L
hms portfolio positions --show-pnl
```

---

### `portfolio allocation`

Show asset allocation

**Usage:**
```bash
hms portfolio allocation [options]
```

**Options:**
- `--account <id>` - Account ID
- `--chart` - Display as ASCII chart

**Examples:**
```bash
# Show allocation
hms portfolio allocation

# Show as chart
hms portfolio allocation --chart
```

---

### `portfolio performance`

Show portfolio performance metrics

**Usage:**
```bash
hms portfolio performance [options]
```

**Options:**
- `--account <id>` - Account ID
- `--start-date <date>` - Start date
- `--end-date <date>` - End date
- `--benchmark <symbol>` - Compare with benchmark

**Examples:**
```bash
# Show performance
hms portfolio performance

# Compare with S&P 500
hms portfolio performance --benchmark SPY
```

---

### `portfolio rebalance`

Suggest or execute portfolio rebalancing

**Usage:**
```bash
hms portfolio rebalance [options]
```

**Options:**
- `--account <id>` - Account ID
- `--target <json>` - Target allocation as JSON
- `--execute` - Execute rebalancing (default: dry-run)

**Examples:**
```bash
# Show rebalancing suggestions
hms portfolio rebalance

# Execute rebalancing
hms portfolio rebalance --execute

# Rebalance to target allocation
hms portfolio rebalance --target '{"AAPL":0.25,"MSFT":0.25,"GOOGL":0.25,"CASH":0.25}'
```

---

### `portfolio history`

Show portfolio value history

**Usage:**
```bash
hms portfolio history [options]
```

**Options:**
- `--account <id>` - Account ID
- `--days <number>` - Number of days (default: 30)
- `--chart` - Display as ASCII chart

**Examples:**
```bash
# Show 30-day history
hms portfolio history

# Show 90-day history as chart
hms portfolio history --days 90 --chart
```

---

## Order Commands

### `orders list`

List orders

**Usage:**
```bash
hms orders list [options]
```

**Options:**
- `--account <id>` - Account ID
- `--status <status>` - Filter by status (PENDING, FILLED, CANCELLED, REJECTED)
- `--symbol <symbol>` - Filter by symbol
- `--start-date <date>` - Start date
- `--end-date <date>` - End date
- `--limit <number>` - Limit results

**Examples:**
```bash
# List all orders
hms orders list

# List pending orders
hms orders list --status PENDING

# List orders for AAPL
hms orders list --symbol AAPL

# List recent orders
hms orders list --start-date 2024-01-01 --limit 50
```

---

### `orders get <id>`

Get order details

**Usage:**
```bash
hms orders get <order-id>
```

**Examples:**
```bash
# Get order details
hms orders get ord-001
```

---

### `orders create`

Create a new order

**Usage:**
```bash
hms orders create [options]
```

**Options:**
- `--account <id>` - Account ID (required)
- `--symbol <symbol>` - Stock symbol (required)
- `--type <type>` - Order type: MARKET, LIMIT, STOP, STOP_LIMIT (required)
- `--side <side>` - Order side: BUY, SELL (required)
- `--quantity <number>` - Quantity (required)
- `--price <price>` - Limit price (required for LIMIT orders)
- `--stop-price <price>` - Stop price (required for STOP orders)
- `--time-in-force <tif>` - Time in force: DAY, GTC, IOC, FOK (default: DAY)

**Examples:**
```bash
# Market buy order
hms orders create \
  --account acc-123 \
  --symbol AAPL \
  --type MARKET \
  --side BUY \
  --quantity 100

# Limit sell order
hms orders create \
  --account acc-123 \
  --symbol AAPL \
  --type LIMIT \
  --side SELL \
  --quantity 50 \
  --price 180.00

# Stop loss order
hms orders create \
  --account acc-123 \
  --symbol AAPL \
  --type STOP \
  --side SELL \
  --quantity 100 \
  --stop-price 170.00
```

---

### `orders cancel <id>`

Cancel an order

**Usage:**
```bash
hms orders cancel <order-id>
```

**Examples:**
```bash
# Cancel order
hms orders cancel ord-003
```

---

### `orders status <id>`

Get order status

**Usage:**
```bash
hms orders status <order-id> [options]
```

**Options:**
- `--watch` - Watch for status changes (polls every 5 seconds)

**Examples:**
```bash
# Get order status
hms orders status ord-001

# Watch order status
hms orders status ord-001 --watch
```

---

## Market Data Commands

### `market quote <symbol>`

Get real-time quote for a symbol

**Usage:**
```bash
hms market quote <symbol> [symbols...]
```

**Examples:**
```bash
# Get quote for AAPL
hms market quote AAPL

# Get quotes for multiple symbols
hms market quote AAPL MSFT GOOGL
```

**Output:**
```
AAPL: $175.00
  Bid: $174.98 | Ask: $175.02
  Change: +$2.50 (+1.45%)
  Volume: 50,000,000
  High: $176.00 | Low: $172.50
```

---

### `market candles <symbol>`

Get candle/OHLCV data for a symbol

**Usage:**
```bash
hms market candles <symbol> [options]
```

**Options:**
- `--interval <interval>` - Candle interval: 1m, 5m, 15m, 1h, 1d (default: 1h)
- `--limit <number>` - Number of candles (default: 100)
- `--start <date>` - Start date
- `--end <date>` - End date

**Examples:**
```bash
# Get hourly candles
hms market candles AAPL --interval 1h --limit 24

# Get daily candles for a date range
hms market candles AAPL --interval 1d --start 2024-01-01 --end 2024-01-31
```

---

### `market search`

Search for symbols

**Usage:**
```bash
hms market search [options]
```

**Options:**
- `--query <text>` - Search query (required)

**Examples:**
```bash
# Search for Apple
hms market search --query "Apple"
```

**Output:**
```
Results:
1. AAPL - Apple Inc. (NASDAQ)
2. APLE - Apple Hospitality REIT, Inc. (NYSE)
```

---

### `market watchlist`

Manage watchlist

**Usage:**
```bash
# Show watchlist
hms market watchlist

# Add symbol
hms market watchlist add <symbol>

# Remove symbol
hms market watchlist remove <symbol>
```

**Examples:**
```bash
# Show watchlist
hms market watchlist

# Add AAPL
hms market watchlist add AAPL

# Remove MSFT
hms market watchlist remove MSFT
```

---

### `market hours`

Show market hours and status

**Usage:**
```bash
hms market hours [options]
```

**Options:**
- `--market <market>` - Market: NYSE, NASDAQ (default: all)

**Examples:**
```bash
# Show all market hours
hms market hours

# Show NYSE hours
hms market hours --market NYSE
```

**Output:**
```
Market Hours (ET)
──────────────────────────────
NYSE: OPEN
  Regular: 9:30 AM - 4:00 PM
  Pre-Market: 4:00 AM - 9:30 AM
  After-Hours: 4:00 PM - 8:00 PM
```

---

## Analytics Commands

### `analytics summary`

Show analytics summary

**Usage:**
```bash
hms analytics summary [options]
```

**Options:**
- `--account <id>` - Account ID
- `--strategy <id>` - Strategy ID

**Examples:**
```bash
# Show analytics summary
hms analytics summary

# Show for specific strategy
hms analytics summary --strategy strat-001
```

---

### `analytics performance`

Show detailed performance metrics

**Usage:**
```bash
hms analytics performance [options]
```

**Options:**
- `--account <id>` - Account ID
- `--start-date <date>` - Start date
- `--end-date <date>` - End date

**Examples:**
```bash
# Show performance metrics
hms analytics performance

# Show for date range
hms analytics performance --start-date 2024-01-01 --end-date 2024-01-31
```

**Output:**
```
Performance Metrics
────────────────────────────────────
Portfolio Value:   $125,000.00
Daily Return:      +0.50%
Weekly Return:     +2.50%
Monthly Return:    +8.00%
Yearly Return:     +25.00%
Sharpe Ratio:      1.85
Sortino Ratio:     2.15
Max Drawdown:      -15.32%
Volatility:        18.50%
Beta:              1.05
Alpha:             3.00%
```

---

### `analytics risk`

Show risk metrics

**Usage:**
```bash
hms analytics risk [options]
```

**Options:**
- `--account <id>` - Account ID

**Examples:**
```bash
# Show risk metrics
hms analytics risk
```

**Output:**
```
Risk Metrics
────────────────────────────────────
Value at Risk (95%):      -$5,625
Conditional VaR (95%):    -$7,500
Max Drawdown:             -15.32%
Annual Volatility:        18.50%
Downside Volatility:      12.30%
Risk Score:               55.2/100
Risk Level:               MEDIUM
```

---

### `analytics trades`

Show trade statistics

**Usage:**
```bash
hms analytics trades [options]
```

**Options:**
- `--account <id>` - Account ID
- `--start-date <date>` - Start date
- `--end-date <date>` - End date

**Examples:**
```bash
# Show trade statistics
hms analytics trades
```

**Output:**
```
Trade Statistics
────────────────────────────────────
Total Trades:          45
Winning Trades:        28 (62.22%)
Losing Trades:         17 (37.78%)
Average Win:           $450.25
Average Loss:          -$280.50
Profit Factor:         1.82
Expectancy:            $183.39
Max Consecutive Wins:  5
Max Consecutive Losses: 3
```

---

### `analytics export`

Export analytics data

**Usage:**
```bash
hms analytics export [options]
```

**Options:**
- `--format <format>` - Export format: json, csv, pdf (default: json)
- `--output <file>` - Output file (required)
- `--account <id>` - Account ID
- `--start-date <date>` - Start date
- `--end-date <date>` - End date

**Examples:**
```bash
# Export to JSON
hms analytics export --format json --output analytics.json

# Export to CSV
hms analytics export --format csv --output analytics.csv

# Export specific date range
hms analytics export \
  --format json \
  --output analytics.json \
  --start-date 2024-01-01 \
  --end-date 2024-01-31
```

---

## Paper Trading Commands

### `paper create`

Create a paper trading account

**Usage:**
```bash
hms paper create [options]
```

**Options:**
- `--name <name>` - Account name (required)
- `--balance <amount>` - Initial balance (required)

**Examples:**
```bash
# Create paper account
hms paper create --name "Test Account" --balance 100000
```

---

### `paper reset <id>`

Reset paper account to initial balance

**Usage:**
```bash
hms paper reset <account-id> [options]
```

**Options:**
- `--balance <amount>` - New initial balance
- `--confirm` - Skip confirmation

**Examples:**
```bash
# Reset account
hms paper reset acc-456

# Reset with new balance
hms paper reset acc-456 --balance 50000
```

---

### `paper simulate`

Simulate market conditions

**Usage:**
```bash
hms paper simulate [options]
```

**Options:**
- `--account <id>` - Paper account ID (required)
- `--scenario <scenario>` - Scenario: bull_market, bear_market, volatile, crash
- `--start-date <date>` - Historical start date
- `--end-date <date>` - Historical end date
- `--speed <multiplier>` - Time multiplier (default: 1)

**Examples:**
```bash
# Simulate bull market
hms paper simulate --account acc-456 --scenario bull_market

# Simulate historical period
hms paper simulate \
  --account acc-456 \
  --start-date 2024-01-01 \
  --end-date 2024-01-31 \
  --speed 10
```

---

### `paper compare`

Compare paper vs live performance

**Usage:**
```bash
hms paper compare [options]
```

**Options:**
- `--paper-account <id>` - Paper account ID (required)
- `--live-account <id>` - Live account ID (required)

**Examples:**
```bash
# Compare accounts
hms paper compare --paper-account acc-456 --live-account acc-123
```

---

## System Commands

### `system status`

Show system status

**Usage:**
```bash
hms system status [options]
```

**Options:**
- `--detailed` - Show detailed status

**Examples:**
```bash
# Show system status
hms system status

# Show detailed status
hms system status --detailed
```

**Output:**
```
System Status
────────────────────────────────────
Status:     HEALTHY
Uptime:     5 days, 12 hours
Version:    2.0.0
API:        Online
Database:   Connected
WebSocket:  Connected
```

---

### `system config`

Manage system configuration

**Usage:**
```bash
# Show configuration
hms system config

# Get value
hms system config get <key>

# Set value
hms system config set <key> <value>
```

**Examples:**
```bash
# Show all config
hms system config

# Get API URL
hms system config get api.url

# Set timeout
hms system config set api.timeout 30000
```

---

### `system health`

Check system health

**Usage:**
```bash
hms system health
```

**Output:**
```
Health Check
────────────────────────────────────
✓ API:        OK (150ms)
✓ Database:   OK (45ms)
✓ WebSocket:  OK (20ms)
✓ Redis:      OK (10ms)
Overall:      HEALTHY
```

---

### `system logs`

View system logs

**Usage:**
```bash
hms system logs [options]
```

**Options:**
- `--lines <number>` - Number of lines (default: 50)
- `--level <level>` - Filter by level: error, warn, info, debug
- `--follow` - Follow log output

**Examples:**
```bash
# Show last 50 lines
hms system logs

# Show errors only
hms system logs --level error

# Follow logs
hms system logs --follow
```

---

### `system version`

Show version information

**Usage:**
```bash
hms system version
```

**Output:**
```
HMS Trading Platform v2.0.0
CLI Version:     1.0.0
Node Version:    v18.17.0
OS:              Windows 10
Architecture:    x64
```

---

## Output Formats

### Table Format (default)

Human-readable table format with borders

```bash
hms accounts list --format table
```

### JSON Format

Machine-readable JSON format

```bash
hms accounts list --format json
```

```json
[
  {
    "id": "acc-123",
    "name": "Main Trading Account",
    "type": "LIVE",
    "balance": 125000,
    "currency": "USD",
    "status": "ACTIVE"
  }
]
```

### CSV Format

Comma-separated values for spreadsheet import

```bash
hms accounts list --format csv
```

```
ID,Name,Type,Balance,Currency,Status
acc-123,Main Trading Account,LIVE,125000,USD,ACTIVE
```

### YAML Format

YAML format for configuration files

```bash
hms accounts list --format yaml
```

```yaml
- id: acc-123
  name: Main Trading Account
  type: LIVE
  balance: 125000
  currency: USD
  status: ACTIVE
```

---

## Configuration

### Configuration File

Create `~/.hms/config.json`:

```json
{
  "api": {
    "url": "http://localhost:3000",
    "timeout": 30000
  },
  "user": {
    "default": "user-123"
  },
  "output": {
    "format": "table",
    "color": true
  }
}
```

### Environment Variables

- `HMS_API_URL` - API base URL
- `HMS_API_TOKEN` - Authentication token
- `HMS_USER_ID` - Default user ID
- `HMS_OUTPUT_FORMAT` - Default output format

---

## Troubleshooting

### Connection Issues

```bash
# Check system health
hms system health

# Check status
hms system status --detailed
```

### Authentication Issues

```bash
# Verify user ID
hms system config get user.default

# Set user ID
hms system config set user.default user-123
```

### Performance Issues

```bash
# Check system logs
hms system logs --level error

# Monitor real-time logs
hms system logs --follow
```

### Common Errors

| Error | Solution |
|-------|----------|
| `Connection refused` | Check if API server is running |
| `Authentication required` | Set HMS_API_TOKEN environment variable |
| `Account not found` | Verify account ID with `accounts list` |
| `Invalid order type` | Check order type: MARKET, LIMIT, STOP |
| `Insufficient balance` | Check account balance |

---

## Support

For additional help:
- Documentation: https://docs.hms-trading.com
- GitHub: https://github.com/hms/trading-platform
- Email: support@hms-trading.com

---

**End of CLI Commands Reference**
