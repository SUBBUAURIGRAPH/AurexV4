# Backtest Manager Skill

**Agent**: Trading Operations  
**Purpose**: Comprehensive backtesting workflow automation  
**Status**: Implemented  
**Version**: 1.0.0

## Overview
Automates the complete backtesting workflow from configuration to results analysis, leveraging the new backtesting API infrastructure.

## Capabilities
- Create backtest configurations interactively
- Execute backtests with historical data
- Monitor progress via WebSocket real-time
- Calculate comprehensive performance metrics
- Compare multiple strategy variants
- Export results to reports (CSV/JSON/PDF)

## Usage
```
@trading-operations backtest-manager "Backtest momentum strategy on BTC/USD 2023"
@trading-operations backtest-manager "Compare 3 MA crossover variants"
@trading-operations backtest-manager "Generate performance report for Q4"
```

## Integration
Uses new backtesting infrastructure:
- REST API: `/api/v1/backtests`
- WebSocket: `/ws/backtests`
- Job queue: BullMQ with Redis
- Documentation: `src/backtesting/README.md`

## Key Metrics
- **Sharpe Ratio**: Risk-adjusted returns
- **Sortino Ratio**: Downside risk focus
- **Max Drawdown**: Worst loss period
- **Win Rate**: Percentage of winning trades
- **Profit Factor**: Gross profit / gross loss
- **Calmar Ratio**: Return / max drawdown

## Features
- **Real-time monitoring**: WebSocket progress updates
- **Parameter optimization**: Grid search, genetic algorithms
- **Walk-forward analysis**: Test robustness
- **Multiple assets**: Stocks, crypto, forex
- **Custom strategies**: Import your own logic

## Workflow
1. Define strategy and parameters
2. Select asset and time period
3. Configure initial capital and risk
4. Execute backtest (queued via BullMQ)
5. Monitor progress (WebSocket)
6. Analyze results and metrics
7. Optimize parameters if needed
8. Export report for stakeholders

---
**Owner**: Trading Team | **Updated**: 2025-10-20
