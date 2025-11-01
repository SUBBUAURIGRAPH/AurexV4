# Advanced Backtesting API Documentation

**Version:** 1.0.0
**Last Updated:** 2024
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Multi-Asset Backtesting Endpoints](#multi-asset-backtesting-endpoints)
4. [Walk-Forward Optimization Endpoints](#walk-forward-optimization-endpoints)
5. [Monte Carlo Simulation Endpoints](#monte-carlo-simulation-endpoints)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Response Formats](#response-formats)
9. [Examples](#examples)

---

## Overview

The HMS Advanced Backtesting API provides three powerful features for quantitative trading strategy analysis:

1. **Multi-Asset Backtesting**: Portfolio-level backtesting across multiple assets with correlation analysis and rebalancing
2. **Walk-Forward Optimization**: Robust parameter optimization with out-of-sample validation to prevent overfitting
3. **Monte Carlo Simulation**: Probabilistic performance analysis using 1000+ simulations with risk metrics

All endpoints require authentication and return standardized JSON responses.

### Key Features

- **Asynchronous Processing**: All operations run in the background
- **Real-time Progress Tracking**: Monitor long-running operations
- **Comprehensive Risk Metrics**: VaR, CVaR, Sharpe Ratio, Sortino Ratio, Drawdown analysis
- **Security Validation**: Input validation, sanitization, and rate limiting on all endpoints
- **Event-Driven Architecture**: WebSocket support for real-time updates (coming soon)

---

## Authentication

All endpoints require Bearer token authentication.

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.hms.example.com/api/backtesting/multi-asset
```

**Required Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

---

## Multi-Asset Backtesting Endpoints

### POST /api/backtesting/multi-asset

Start a multi-asset backtest for portfolio-level analysis.

**Request Body:**

```json
{
  "name": "Tech Stock Portfolio Backtest",
  "symbols": ["AAPL", "MSFT", "GOOGL", "NVDA"],
  "allocation": {
    "AAPL": 30,
    "MSFT": 25,
    "GOOGL": 25,
    "NVDA": 20
  },
  "startDate": "2023-01-01",
  "endDate": "2024-12-31",
  "initialCapital": 100000,
  "rebalanceConfig": {
    "frequency": "quarterly",
    "threshold": 5
  },
  "strategy": "function(prices, portfolio) { /* strategy logic */ }"
}
```

**Request Parameters:**

| Parameter | Type | Required | Description | Constraints |
|-----------|------|----------|-------------|-------------|
| name | string | Yes | Descriptive name for the backtest | Max 255 chars |
| symbols | array | Yes | Array of stock symbols to backtest | Min 2, valid symbols only |
| allocation | object | Yes | Portfolio allocation {symbol: percentage} | Must sum to 100% |
| startDate | date | Yes | Start date for backtest | Format: YYYY-MM-DD |
| endDate | date | Yes | End date for backtest | Must be after startDate |
| initialCapital | number | No | Starting capital | Default: 100,000, Max: 1M |
| rebalanceConfig | object | No | Rebalancing rules | See below |
| strategy | function | No | Custom strategy function | Optional |

**rebalanceConfig Options:**

```json
{
  "frequency": "monthly|quarterly|yearly",
  "threshold": 5,
  "maxSlippage": 0.001
}
```

**Response (202 Accepted):**

```json
{
  "backtestId": 12345,
  "status": "running",
  "symbols": ["AAPL", "MSFT", "GOOGL", "NVDA"],
  "allocation": {
    "AAPL": 30,
    "MSFT": 25,
    "GOOGL": 25,
    "NVDA": 20
  },
  "message": "Multi-asset backtest started"
}
```

**Status Codes:**
- `202 Accepted` - Backtest successfully queued
- `400 Bad Request` - Validation error (see response for details)
- `401 Unauthorized` - Missing or invalid token
- `409 Conflict` - Allocation percentages don't sum to 100%
- `500 Internal Server Error` - Server error

---

### GET /api/backtesting/multi-asset/:backtestId

Retrieve multi-asset backtest results.

**Request Parameters:**

| Parameter | Type | Location | Description |
|-----------|------|----------|-------------|
| backtestId | number | URL | ID of the backtest |

**Response (200 OK):**

```json
{
  "backtestId": 12345,
  "status": "completed",
  "symbols": ["AAPL", "MSFT", "GOOGL", "NVDA"],
  "allocation": {
    "AAPL": 30,
    "MSFT": 25,
    "GOOGL": 25,
    "NVDA": 20
  },
  "startDate": "2023-01-01",
  "endDate": "2024-12-31",
  "initialCapital": 100000,
  "results": {
    "equityHistory": [100000, 101000, 102500, ...],
    "trades": [
      {
        "symbol": "AAPL",
        "side": "BUY",
        "quantity": 50,
        "price": 150,
        "date": "2023-01-15"
      }
    ],
    "metrics": {
      "totalReturn": 25.5,
      "annualizedReturn": 11.2,
      "volatility": 15.3,
      "sharpeRatio": 0.732,
      "sortinoRatio": 1.045,
      "maxDrawdown": -18.5,
      "calmarRatio": 0.605,
      "winRate": 58.5,
      "profitFactor": 1.85,
      "totalTrades": 120
    },
    "correlations": {
      "2023-12-31": {
        "AAPL_MSFT": 0.82,
        "AAPL_GOOGL": 0.75,
        "MSFT_GOOGL": 0.88
      }
    }
  },
  "createdAt": "2023-01-01T10:30:00Z",
  "completedAt": "2023-01-02T14:45:30Z"
}
```

**Status Codes:**
- `200 OK` - Results retrieved successfully
- `404 Not Found` - Backtest not found
- `401 Unauthorized` - Access denied

---

## Walk-Forward Optimization Endpoints

### POST /api/backtesting/walk-forward

Start walk-forward optimization with out-of-sample validation.

**Request Body:**

```json
{
  "name": "MA Crossover Walk-Forward Optimization",
  "symbol": "AAPL",
  "startDate": "2023-01-01",
  "endDate": "2024-12-31",
  "insamplePeriod": 90,
  "outofSamplePeriod": 30,
  "stepSize": 30,
  "parameterGrid": {
    "fastPeriod": [10, 20, 30],
    "slowPeriod": [50, 100, 150],
    "threshold": [0.001, 0.002, 0.005]
  },
  "objectiveMetric": "sharpeRatio",
  "strategy": "function(prices, params) { /* strategy logic */ }"
}
```

**Request Parameters:**

| Parameter | Type | Required | Description | Constraints |
|-----------|------|----------|-------------|-------------|
| name | string | Yes | Optimization name | Max 255 chars |
| symbol | string | Yes | Symbol to optimize | Valid ticker format |
| startDate | date | Yes | Start date | Format: YYYY-MM-DD |
| endDate | date | Yes | End date | Must be after startDate |
| insamplePeriod | number | Yes | In-sample window (days) | Min 20, Max 365 |
| outofSamplePeriod | number | Yes | Out-of-sample window (days) | Min 10, Max 180 |
| stepSize | number | Yes | Rolling window step (days) | Min 1, Max 90 |
| parameterGrid | object | Yes | Parameters to optimize | Min 1, Max 10 params |
| objectiveMetric | string | No | Metric to optimize | Default: sharpeRatio |
| strategy | function | No | Strategy function | Optional |

**Valid Objective Metrics:**
- `sharpeRatio` (default) - Risk-adjusted returns
- `totalReturn` - Total percentage return
- `maxDrawdown` - Minimize drawdown
- `winRate` - Maximize winning trades
- `profitFactor` - Return per unit of loss

**Response (202 Accepted):**

```json
{
  "optimizationId": 456,
  "status": "running",
  "symbol": "AAPL",
  "message": "Walk-forward optimization started"
}
```

**Status Codes:**
- `202 Accepted` - Optimization queued
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Missing or invalid token
- `422 Unprocessable Entity` - Invalid parameter grid

---

### GET /api/backtesting/walk-forward/:optimizationId

Retrieve walk-forward optimization results.

**Response (200 OK):**

```json
{
  "optimizationId": 456,
  "name": "MA Crossover Walk-Forward Optimization",
  "status": "completed",
  "symbol": "AAPL",
  "startDate": "2023-01-01",
  "endDate": "2024-12-31",
  "insamplePeriod": 90,
  "outofSamplePeriod": 30,
  "stepSize": 30,
  "objectiveMetric": "sharpeRatio",
  "results": {
    "windows": [
      {
        "window": 1,
        "insampleRange": {
          "start": "2023-01-01",
          "end": "2023-03-31"
        },
        "oosRange": {
          "start": "2023-04-01",
          "end": "2023-04-30"
        },
        "isMetrics": {
          "sharpeRatio": 1.245,
          "totalReturn": 8.5,
          "maxDrawdown": -12.3
        },
        "oosMetrics": {
          "sharpeRatio": 0.923,
          "totalReturn": 5.2,
          "maxDrawdown": -8.5
        },
        "bestParameters": {
          "fastPeriod": 20,
          "slowPeriod": 100,
          "threshold": 0.002
        },
        "performance": {
          "isReturn": 8.5,
          "oosReturn": 5.2,
          "degradation": 3.3
        }
      }
    ],
    "summary": {
      "totalWindows": 8,
      "oosMeanReturn": 5.15,
      "oosStdReturn": 2.35,
      "oosMedianReturn": 5.50,
      "isMeanReturn": 8.24,
      "oosMinReturn": 1.2,
      "oosMaxReturn": 9.8,
      "degradationMean": 3.09,
      "degradationMax": 5.5,
      "isOverfit": false
    },
    "stability": {
      "fastPeriod": {
        "mean": 19.5,
        "std": 2.1,
        "coefficientOfVariation": 0.108,
        "isStable": true
      },
      "slowPeriod": {
        "mean": 99.2,
        "std": 8.5,
        "coefficientOfVariation": 0.086,
        "isStable": true
      }
    }
  },
  "createdAt": "2023-01-01T10:30:00Z",
  "completedAt": "2023-01-10T18:20:45Z"
}
```

**Key Fields Explained:**

- **isOverfit**: Boolean flag indicating overfitting detection
  - `true` if: avg degradation > 5% OR max degradation > 15%
  - `false` if: parameters remain robust across windows
- **Stability Analysis**: Coefficient of Variation (CV) for each parameter
  - CV < 0.2 = Stable (good for production)
  - CV ≥ 0.2 = Unstable (risky, varies across windows)
- **Performance Degradation**: In-sample vs Out-of-sample performance difference
  - Low degradation = Good generalization
  - High degradation = Possible overfitting

---

## Monte Carlo Simulation Endpoints

### POST /api/backtesting/monte-carlo

Start Monte Carlo simulation for probabilistic analysis.

**Request Body:**

```json
{
  "name": "Portfolio Risk Analysis - 1000 Simulations",
  "backtestId": 12345,
  "numSimulations": 1000,
  "method": "returns",
  "confidenceLevel": 0.95
}
```

**Request Parameters:**

| Parameter | Type | Required | Description | Constraints |
|-----------|------|----------|-------------|-------------|
| name | string | Yes | Simulation name | Max 255 chars |
| backtestId | number | Yes | Reference backtest ID | Must exist & be completed |
| numSimulations | number | No | Number of simulations | Min 100, Max 10000, Default 1000 |
| method | string | No | Simulation method | `returns` or `bootstrapping` |
| confidenceLevel | number | No | Confidence level | Min 0.5, Max 0.99, Default 0.95 |

**Simulation Methods:**

- **returns** (default): Uses normal distribution based on historical returns
  - Faster computation
  - Good for trending markets
  - Assumes normal distribution
- **bootstrapping**: Resamples actual historical returns
  - More realistic
  - Captures real return distributions
  - Computationally heavier

**Response (202 Accepted):**

```json
{
  "simulationId": 789,
  "status": "running",
  "backtestId": 12345,
  "numSimulations": 1000,
  "method": "returns",
  "confidenceLevel": 0.95,
  "message": "Monte Carlo simulation started"
}
```

---

### GET /api/backtesting/monte-carlo/:simulationId

Retrieve Monte Carlo simulation results.

**Response (200 OK):**

```json
{
  "simulationId": 789,
  "name": "Portfolio Risk Analysis - 1000 Simulations",
  "status": "completed",
  "backtestId": 12345,
  "numSimulations": 1000,
  "method": "returns",
  "confidenceLevel": 0.95,
  "results": {
    "statistics": {
      "finalValueMean": 1.245,
      "finalValueMedian": 1.240,
      "finalValueStd": 0.185,
      "finalValueMin": 0.850,
      "finalValueMax": 1.680,
      "returnMean": 24.5,
      "returnMedian": 24.0,
      "returnStd": 18.5,
      "returnMin": -15.0,
      "returnMax": 68.0,
      "maxDrawdownMean": -12.8,
      "maxDrawdownMedian": -12.3,
      "maxDrawdownMin": -45.0,
      "maxDrawdownMax": -2.5,
      "valueAtRisk": -8.5,
      "conditionalValueAtRisk": -12.3,
      "confidenceLevel": 0.95,
      "returnCI95": {
        "lower": -8.5,
        "upper": 52.3,
        "confidenceLevel": 0.95
      },
      "returnCI99": {
        "lower": -15.2,
        "upper": 58.9,
        "confidenceLevel": 0.99
      },
      "drawdownCI95": {
        "lower": -28.5,
        "upper": -2.3,
        "confidenceLevel": 0.95
      },
      "probabilityOfProfit": 78.5,
      "probabilityOfLoss": 21.5,
      "probabilityOf50PlusPercent": 25.3,
      "historicalReturn": 24.8,
      "historicalVolatility": 18.2
    },
    "simulations": [
      [1.0, 1.001, 1.002, ..., 1.245],
      [1.0, 0.998, 1.003, ..., 1.238],
      [1.0, 1.005, 1.004, ..., 1.252]
    ]
  },
  "createdAt": "2023-01-01T10:30:00Z",
  "completedAt": "2023-01-01T12:45:30Z"
}
```

**Key Statistics Explained:**

### Risk Metrics

- **Value at Risk (VaR)**: Maximum expected loss at confidence level
  - VaR 95% = 95% chance loss won't exceed this amount
  - Example: VaR 95% = -8.5% means 95% confidence loss won't exceed 8.5%

- **Conditional Value at Risk (CVaR)**: Average loss if worst happens
  - Expected value of losses beyond VaR
  - Always worse than (more negative than) VaR

### Probability Metrics

- **Probability of Profit**: Percentage of simulations with positive return
- **Probability of 50%+ Return**: Percentage achieving 50% or more gain
- **Probability of Loss**: Percentage of simulations with negative return

### Confidence Intervals

- **returnCI95**: 95% of returns fall between lower and upper bounds
- **returnCI99**: 99% of returns fall between lower and upper bounds
  - Wider than 95% CI (less precise but more confident)

---

## Error Handling

All errors follow a standardized format:

```json
{
  "error": "Validation failed",
  "details": [
    "symbol must be valid ticker format",
    "initialCapital must be positive"
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Common Error Scenarios:**

| HTTP Code | Error | Description |
|-----------|-------|-------------|
| 400 | Validation failed | Input validation error |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | No permission to access resource |
| 404 | Not found | Resource doesn't exist |
| 409 | Conflict | Business logic error (e.g., allocation % don't sum to 100) |
| 422 | Unprocessable Entity | Valid format but semantic error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Rate Limiting

All endpoints are rate-limited per user:

**Rate Limits:**

| Endpoint Type | Requests | Per Time |
|---------------|----------|----------|
| GET endpoints | 1000 | Hour |
| POST endpoints | 100 | Hour |
| Background jobs | 20 | Hour |

**Rate Limit Headers:**

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1640000000
```

When rate limit exceeded: `429 Too Many Requests`

---

## Response Formats

### Success Response Format

```json
{
  "data": {},
  "status": "success",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Response Format

```json
{
  "error": "Error message",
  "details": ["Details about error"],
  "timestamp": "2024-01-15T10:30:00Z",
  "traceId": "req-123456"
}
```

---

## Examples

### Example 1: Complete Multi-Asset Backtest Flow

```bash
# 1. Start backtest
curl -X POST https://api.hms.example.com/api/backtesting/multi-asset \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tech Portfolio",
    "symbols": ["AAPL", "MSFT"],
    "allocation": {"AAPL": 50, "MSFT": 50},
    "startDate": "2023-01-01",
    "endDate": "2024-12-31",
    "initialCapital": 100000
  }'

# Response: {"backtestId": 12345, "status": "running"}

# 2. Poll for results
curl https://api.hms.example.com/api/backtesting/multi-asset/12345 \
  -H "Authorization: Bearer TOKEN"

# 3. When status is "completed", get full results
```

### Example 2: Walk-Forward Optimization

```bash
curl -X POST https://api.hms.example.com/api/backtesting/walk-forward \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MA Strategy Optimization",
    "symbol": "AAPL",
    "startDate": "2023-01-01",
    "endDate": "2024-12-31",
    "insamplePeriod": 90,
    "outofSamplePeriod": 30,
    "stepSize": 30,
    "parameterGrid": {
      "fastPeriod": [10, 20, 30],
      "slowPeriod": [50, 100, 150]
    },
    "objectiveMetric": "sharpeRatio"
  }'
```

### Example 3: Monte Carlo Simulation for Risk Assessment

```bash
# Run 1000 simulations for risk analysis
curl -X POST https://api.hms.example.com/api/backtesting/monte-carlo \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Risk Analysis",
    "backtestId": 12345,
    "numSimulations": 1000,
    "method": "bootstrapping",
    "confidenceLevel": 0.95
  }'
```

---

## Webhooks & Notifications (Coming Soon)

When implemented, the API will support webhooks for:

- Backtest completion
- Optimization finished
- Simulation ready
- Errors detected

---

## Support & Documentation

- **API Status**: https://status.hms.example.com
- **GitHub Issues**: https://github.com/yourorg/hms/issues
- **Email Support**: api-support@example.com

