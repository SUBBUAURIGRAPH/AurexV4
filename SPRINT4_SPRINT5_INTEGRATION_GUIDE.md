# HMS Sprints 4-5 Integration Guide

**Date**: October 31, 2025
**Version**: 1.0.0
**Scope**: Analytics Dashboard (Sprint 4) + CLI Interface (Sprint 5) Integration

---

## Overview

This guide documents how the Analytics Dashboard (Sprint 4) and CLI Interface (Sprint 5) integrate with the existing core skills (Sprints 1-3) and with each other.

---

## System Architecture Integration

### Full System Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                          Users / Teams                          │
└──────────────┬─────────────────────────────────────┬────────────┘
               │                                     │
        ┌──────▼─────┐                        ┌─────▼──────┐
        │   Web UI   │                        │    CLI     │
        │ Dashboard  │                        │  Interface │
        │  (HTML/   │                        │  (Sprint 5) │
        │   React)  │                        │            │
        └──────┬─────┘                        └─────┬──────┘
               │                                     │
               └──────────────┬──────────────────────┘
                              │
                    ┌─────────▼────────────┐
                    │   REST API / gRPC    │
                    │   (API Gateway)      │
                    └──────┬─────┬─────────┘
                           │     │
        ┌──────────────────┼─────┼──────────────────┐
        │                  │     │                  │
    ┌───▼─────┐    ┌──────▼──┐ ┌▼──────┐    ┌─────▼──┐
    │Exchange │    │Strategy │ │Docker │    │Analyt- │
    │Connector│    │ Builder │ │Manager│    │ics Dash│
    │(Sprint 1)    │(Sprint 2)│ │(Sprint3)   │(Sprint4)
    └───┬─────┘    └──────┬──┘ └▼──────┘    └─────┬──┘
        │                  │     │                  │
        └──────────────────┼─────┼──────────────────┘
                           │     │
        ┌──────────────────┼─────┼──────────────────┐
        │                  │     │                  │
    ┌───▼─────┐    ┌──────▼──┐ ┌▼──────┐    ┌─────▼──┐
    │Exchange │    │Strategy │ │Docker │    │Prometheus
    │APIs     │    │Engine   │ │Daemon │    │Grafana  │
    │(Binance,    │        │ │        │    │Loki    │
    │ Kraken, │    │        │ │        │    │        │
    │Coinbase)    │        │ │        │    │        │
    └─────────┘    └────────┘ └───────┘    └────────┘
        │                  │     │                  │
        └──────────────────┼─────┼──────────────────┘
                           │     │
        ┌──────────────────┼─────┼──────────────────┐
        │                  │     │                  │
    ┌───▼─────────┐    ┌──────▼──┐ ┌▼──────────┐   │
    │PostgreSQL   │    │ Redis   │ │Filesystem │   │
    │(Trades,     │    │(Cache)  │ │ (Logs,    │   │
    │ Strategies) │    │         │ │  Backups) │   │
    └─────────────┘    └─────────┘ └───────────┘   │
        │                                           │
        └───────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Trading Workflow (Exchange → Strategy → Analytics)

```
┌─────────────────────────────────────────────────────────────┐
│                       User: Trader                          │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
      ┌──────────────┐
      │ CLI Command  │
      │ hms exchange │
      │ order create │
      └──────┬───────┘
             │
      ┌──────▼────────────────────────────────────────┐
      │  Exchange Connector (Sprint 1)                 │
      │  ├─ Validate order params                     │
      │  ├─ Apply rate limiting                       │
      │  ├─ Encrypt credentials                       │
      │  └─ Send to exchange API                      │
      └──────┬────────────────────────────────────────┘
             │
      ┌──────▼────────────────────────────────────────┐
      │  Exchange API (Binance/Kraken/Coinbase)       │
      │  └─ Return order confirmation + order ID     │
      └──────┬────────────────────────────────────────┘
             │
      ┌──────▼────────────────────────────────────────┐
      │  Store Order in Database                      │
      │  ├─ Save order details                        │
      │  ├─ Update position                           │
      │  └─ Create audit log                          │
      └──────┬────────────────────────────────────────┘
             │
      ┌──────▼────────────────────────────────────────┐
      │  Strategy Engine (Sprint 2)                    │
      │  ├─ Evaluate strategy signals                 │
      │  ├─ Adjust orders if needed                   │
      │  └─ Log strategy execution                    │
      └──────┬────────────────────────────────────────┘
             │
      ┌──────▼────────────────────────────────────────┐
      │  Analytics Dashboard (Sprint 4)                │
      │  ├─ Calculate performance metrics             │
      │  ├─ Risk analysis                             │
      │  ├─ Attribution analysis                      │
      │  └─ Update real-time dashboards              │
      └──────┬────────────────────────────────────────┘
             │
      ┌──────▼────────────────────────────────────────┐
      │  Display Results                               │
      │  ├─ CLI: Order confirmation                   │
      │  ├─ Web: Updated dashboard                    │
      │  └─ Alerts: Profit/Loss notifications        │
      └──────────────────────────────────────────────┘
```

### 2. Strategy Development Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                  User: Strategy Developer                  │
└────────────┬────────────────────────────────────────────────┘
             │
      ┌──────▼──────────────────────┐
      │ CLI: hms strategy create     │
      │ --name ma-crossover          │
      │ --template trend-following   │
      └──────┬───────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │ Strategy Builder (Sprint 2)                  │
      │ ├─ Load template                            │
      │ ├─ Create DSL document                      │
      │ └─ Validate strategy syntax                 │
      └──────┬──────────────────────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │ CLI: hms strategy optimize                  │
      │ --algorithm genetic                        │
      │ --generations 50                           │
      └──────┬──────────────────────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │ Strategy Optimizer (Sprint 2)                │
      │ ├─ Genetic algorithm runs                   │
      │ ├─ Test combinations                        │
      │ └─ Return best parameters                   │
      └──────┬──────────────────────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │ CLI: hms strategy backtest                  │
      │ --start 2024-01-01                         │
      │ --end 2025-01-01                           │
      └──────┬──────────────────────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │ Backtesting Engine                          │
      │ ├─ Run historical simulation                │
      │ ├─ Calculate metrics                        │
      │ └─ Generate report                          │
      └──────┬──────────────────────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │ Analytics Dashboard (Sprint 4)               │
      │ ├─ Display backtest results                 │
      │ ├─ Performance charts                       │
      │ ├─ Risk metrics                             │
      │ └─ Drawdown analysis                        │
      └──────┬──────────────────────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │ CLI: hms strategy start                     │
      │ --name ma-crossover                        │
      │ --live                                     │
      └──────┬──────────────────────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │ Display: Strategy Live in Dashboard         │
      └──────────────────────────────────────────────┘
```

### 3. Infrastructure Management Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                 User: DevOps Engineer                       │
└────────────┬────────────────────────────────────────────────┘
             │
      ┌──────▼──────────────────────┐
      │ CLI: hms docker service      │
      │ deploy --service trading    │
      │ --version 1.0.0             │
      └──────┬───────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │ Docker Manager (Sprint 3)                    │
      │ ├─ Pull image                               │
      │ ├─ Apply deployment strategy                │
      │ │  └─ Blue-Green / Canary / Rolling         │
      │ ├─ Health checks                            │
      │ └─ Update service registry                  │
      └──────┬──────────────────────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │ Docker Daemon                                │
      │ ├─ Create containers                        │
      │ ├─ Network configuration                    │
      │ └─ Volume management                        │
      └──────┬──────────────────────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │ CLI: hms docker deployment scale            │
      │ --deployment trading-prod                   │
      │ --replicas 5                                │
      └──────┬──────────────────────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │ Docker Manager (Sprint 3)                    │
      │ ├─ Auto-scaler logic                        │
      │ ├─ Health monitoring                        │
      │ └─ Alerting system                          │
      └──────┬──────────────────────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │ Analytics Dashboard (Sprint 4)               │
      │ ├─ Container metrics                        │
      │ ├─ Deployment status                        │
      │ ├─ Performance dashboards                   │
      │ └─ Alert visualization                      │
      └──────┬──────────────────────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │ Display: Status in CLI + Web Dashboard      │
      └──────────────────────────────────────────────┘
```

---

## API Integration Points

### 4.1 API Endpoints Used by CLI (Sprint 5)

```
Exchange Connector (Sprint 1) Endpoints:
GET  /api/exchange/{exchange}/ticker/{symbol}
GET  /api/exchange/{exchange}/ohlc/{symbol}
GET  /api/exchange/{exchange}/book/{symbol}
POST /api/exchange/{exchange}/order/create
POST /api/exchange/{exchange}/order/cancel
GET  /api/exchange/{exchange}/order/{orderId}
GET  /api/exchange/{exchange}/position/{symbol}
GET  /api/exchange/{exchange}/balance

Strategy Builder (Sprint 2) Endpoints:
GET  /api/strategy/templates
GET  /api/strategy/{strategyId}
POST /api/strategy/create
POST /api/strategy/{strategyId}/validate
POST /api/strategy/{strategyId}/optimize
POST /api/strategy/{strategyId}/backtest
POST /api/strategy/{strategyId}/start
POST /api/strategy/{strategyId}/stop

Docker Manager (Sprint 3) Endpoints:
GET  /api/docker/containers
GET  /api/docker/containers/{containerId}
POST /api/docker/containers/create
POST /api/docker/containers/{containerId}/start
POST /api/docker/containers/{containerId}/stop
POST /api/docker/services/deploy
GET  /api/docker/services/{serviceId}
POST /api/docker/deployments/scale

Analytics Dashboard (Sprint 4) Endpoints:
GET  /api/analytics/metrics/performance
GET  /api/analytics/metrics/risk
GET  /api/analytics/attribution
GET  /api/analytics/dashboard/{dashboardId}
POST /api/analytics/report/generate
GET  /api/analytics/report/{reportId}
```

### 4.2 Data Models Shared Across Skills

```typescript
// Order Model (Exchange Connector)
interface Order {
  id: string;
  symbol: string;
  type: 'limit' | 'market';
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  timestamp: Date;
  status: 'open' | 'filled' | 'cancelled';
  executedQuantity: number;
  executedPrice?: number;
  fee?: number;
}

// Strategy Model (Strategy Builder)
interface Strategy {
  id: string;
  name: string;
  template: string;
  parameters: Record<string, any>;
  signals: Signal[];
  status: 'draft' | 'validated' | 'active' | 'paused';
  createdAt: Date;
  updatedAt: Date;
}

// Deployment Model (Docker Manager)
interface Deployment {
  id: string;
  name: string;
  service: string;
  version: string;
  strategy: 'blue-green' | 'canary' | 'rolling' | 'recreate';
  replicas: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: ContainerMetrics[];
}

// Metrics Model (Analytics Dashboard)
interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  timestamp: Date;
}
```

---

## Feature Interactions

### 5.1 Analytics Dashboard + CLI Integration

#### Scenario 1: Monitor Strategy Performance via CLI

```bash
# Watch strategy performance in real-time via CLI
watch "hms analytics metrics performance \
  --strategy ma-crossover \
  --format table"

# Output updates every 2 seconds
┌─────────────────────────────────────────┐
│ Performance Metrics - MA Crossover       │
├─────────────────────────────────────────┤
│ Total Return: +15.2%                    │
│ Annualized: +18.5%                      │
│ Sharpe Ratio: 1.8                       │
│ Max Drawdown: -8.3%                     │
│ Win Rate: 62.3%                         │
└─────────────────────────────────────────┘
```

#### Scenario 2: Generate Backtest Reports

```bash
# Run backtest via CLI
hms strategy backtest \
  --strategy ma-crossover \
  --start 2024-01-01 \
  --end 2025-01-01

# Generate analytics report
hms analytics report generate \
  --strategy ma-crossover \
  --format pdf \
  --output backtest_report.pdf

# Includes:
# - Performance metrics
# - Risk analysis
# - Attribution breakdown
# - Charts and visualizations
# - Recommendations
```

#### Scenario 3: Export Metrics for External Analysis

```bash
# Export metrics in JSON for processing
hms analytics metrics performance \
  --symbol BTC/USDT \
  --period 30d \
  --format json > metrics.json

# Use in external tools
python analyze_metrics.py metrics.json
R script plot_metrics.R metrics.json
```

### 5.2 CLI + Docker Manager Integration

#### Scenario 1: Deploy New Version via CLI

```bash
# Deploy new trading engine version
hms docker service deploy \
  --service trading-engine \
  --version 2.0.0 \
  --strategy blue-green \
  --wait-for-health

# Monitor deployment in Dashboard
# - Watch traffic shift from Blue to Green
# - Monitor error rates
# - Check performance metrics
```

#### Scenario 2: Auto-Scale Based on Load

```bash
# Configure auto-scaling via CLI
hms docker deployment create \
  --name trading-prod \
  --service trading-engine \
  --min-replicas 2 \
  --max-replicas 10 \
  --target-cpu 70%

# Monitor scaling actions
hms docker deployment status --name trading-prod

# Dashboard shows:
# - Current replica count
# - CPU/Memory usage
# - Scaling history
# - Projected capacity
```

### 5.3 Complete Analytics Dashboard + CLI + Docker Workflow

```bash
#!/bin/bash
# Complete trading system workflow

# 1. Deploy infrastructure
echo "Deploying infrastructure..."
hms docker service deploy \
  --service trading-engine \
  --version 2.0.0 \
  --strategy canary

# 2. Verify deployment health
sleep 30
HEALTH=$(hms docker service status trading-engine --format json | jq '.health')
if [ "$HEALTH" != "healthy" ]; then
  echo "Deployment failed - rolling back..."
  hms docker deployment rollout --name trading-prod --revert
  exit 1
fi

# 3. Start strategy
echo "Starting strategy..."
hms strategy start \
  --name ma-crossover \
  --live

# 4. Monitor performance
echo "Monitoring strategy performance..."
for i in {1..60}; do
  METRICS=$(hms analytics metrics performance \
    --strategy ma-crossover \
    --format json)
  PROFIT=$(echo $METRICS | jq '.totalReturn')
  DRAWDOWN=$(echo $METRICS | jq '.maxDrawdown')

  echo "Profit: $PROFIT%, Drawdown: $DRAWDOWN%"

  if (( $(echo "$DRAWDOWN < -10" | bc -l) )); then
    echo "Drawdown exceeded threshold - stopping strategy..."
    hms strategy stop --name ma-crossover
    break
  fi

  sleep 10
done

# 5. Generate report
echo "Generating performance report..."
hms analytics report generate \
  --strategy ma-crossover \
  --format pdf \
  --output daily_report.pdf
```

---

## Integration Testing Strategy

### 6.1 Cross-Component Tests

```
Test Suite Structure:

1. Exchange → Strategy Integration
   ✓ Place order via exchange
   ✓ Strategy reads live orders
   ✓ Signals generated correctly
   ✓ Orders updated in real-time

2. Strategy → Analytics Integration
   ✓ Metrics calculated from trades
   ✓ Performance data accurate
   ✓ Risk metrics correct
   ✓ Attribution complete

3. Docker → Analytics Integration
   ✓ Container metrics collected
   ✓ Health status reflected
   ✓ Scaling events logged
   ✓ Performance correlated

4. CLI → All Components Integration
   ✓ Commands execute correctly
   ✓ Data retrieved properly
   ✓ Output formatted correctly
   ✓ Errors handled gracefully
```

### 6.2 End-to-End Scenarios

```
Scenario 1: Complete Trading Cycle
1. Deploy strategy via CLI
2. Place order via CLI
3. Monitor position via CLI
4. Check analytics dashboard
5. Export performance report

Scenario 2: Infrastructure Management
1. Deploy service via CLI
2. Monitor health in dashboard
3. Scale based on metrics
4. Verify no performance degradation
5. Rollback if needed

Scenario 3: Backtesting & Analysis
1. Create strategy via CLI
2. Run backtest
3. Generate analytics report
4. Compare with other strategies
5. Export results
```

---

## Deployment Timeline

### Phase 1: Sprint 4 Deployment (Current)
- Analytics Dashboard goes to production
- Integrates with Sprints 1-3

### Phase 2: Sprint 5 Development (Jan 24 - Feb 13)
- CLI Interface implementation
- Integration with all components
- Comprehensive testing

### Phase 3: Sprint 5 Deployment (Mid-February)
- CLI to production
- User training
- Runbook documentation

---

## Future Integrations (Sprints 5-6)

### Mobile App Integration
- Real-time notifications from CLI
- Mobile dashboard updates
- Remote strategy management

### Webhook & Events
- Trigger external systems from CLI
- Real-time analytics streaming
- Alert integration with external services

### Advanced Automation
- GitOps workflows
- Infrastructure as Code
- Automated compliance reporting

---

## Conclusion

The Analytics Dashboard (Sprint 4) and CLI Interface (Sprint 5) together provide:
1. **Data Visibility**: Comprehensive metrics and analytics
2. **User Interface**: Both visual (Dashboard) and CLI (Programmatic)
3. **Automation**: Scriptable commands for workflows
4. **Monitoring**: Real-time observability across all components
5. **Management**: Complete infrastructure and strategy control

This creates a powerful, flexible system for traders, developers, and operations teams to manage sophisticated trading strategies at scale.

---

**Status**: ✅ **Integration Architecture Defined**

**Ready For**: Sprint 4 Completion & Sprint 5 Execution

*All components are designed to work together seamlessly, providing a comprehensive trading platform with powerful analytics and command-line automation.*
