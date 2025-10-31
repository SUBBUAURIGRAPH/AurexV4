# Phase 3 Part 2: Database Services, Routes & Express Setup

## Overview
This phase implements the complete Express.js backend with database integration, service layer, routes, and validation middleware.

---

## Architecture

### Layer Structure
```
Request → Express App
         ↓
    Routes (express router)
         ↓
    Middleware (auth, validation, error handling)
         ↓
    Controllers (request parsing)
         ↓
    Services (business logic)
         ↓
    Database (PostgreSQL queries)
         ↓
    Response → JSON
```

### Directory Structure
```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts      (PostgreSQL connection pool)
│   │   └── env.ts           (environment variables)
│   ├── types/
│   │   ├── index.ts         (already exists)
│   │   └── database.ts      (query result types)
│   ├── api/
│   │   ├── controllers/
│   │   │   ├── portfolioController.ts   (already exists - update)
│   │   │   ├── tradesController.ts      (already exists - update)
│   │   │   └── analyticsController.ts   (already exists - update)
│   │   ├── services/
│   │   │   ├── PortfolioService.ts      (NEW - queries)
│   │   │   ├── TradesService.ts         (NEW - queries)
│   │   │   └── AnalyticsService.ts      (NEW - queries)
│   │   ├── routes/
│   │   │   ├── portfolioRoutes.ts       (NEW - express router)
│   │   │   ├── tradesRoutes.ts          (NEW - express router)
│   │   │   └── analyticsRoutes.ts       (NEW - express router)
│   │   ├── middleware/
│   │   │   ├── auth.ts                  (already exists - update)
│   │   │   ├── errorHandler.ts          (already exists - update)
│   │   │   ├── validation.ts            (NEW - request validation)
│   │   │   └── requestLogger.ts         (NEW - logging middleware)
│   │   └── v1/
│   │       └── index.ts                 (NEW - API v1 router)
│   ├── utils/
│   │   ├── logger.ts                    (NEW - logging utility)
│   │   └── validators.ts                (NEW - validation schemas)
│   ├── app.ts                           (NEW - Express app factory)
│   └── server.ts                        (NEW - server startup)
├── package.json
└── .env (example)
```

---

## Implementation Details

### 1. Database Connection Layer

**backend/src/config/database.ts** (80 LOC)
- PostgreSQL connection pool with pg library
- Connection retry logic
- Health check method
- Graceful shutdown

```typescript
import { Pool, PoolConfig } from 'pg';

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hermes_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = new Pool(poolConfig);

export async function initializeDatabase(): Promise<void> {
  try {
    const client = await pool.connect();
    console.log('✅ Database connection established');
    client.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    throw err;
  }
}

export default pool;
```

**backend/src/config/env.ts** (40 LOC)
- Environment variable validation
- Type-safe configuration object
- Defaults for development

```typescript
const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001'),
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432'),
  DB_NAME: process.env.DB_NAME || 'hermes_db',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'password',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

export default config;
```

### 2. Service Layer

**backend/src/api/services/PortfolioService.ts** (220 LOC)
- 4 database queries mapped to controllers
- Query methods:
  1. getPortfolioSummary(userId: string)
  2. getPortfolioAllocation(userId: string)
  3. getPortfolioPerformance(userId: string, period: string)
  4. getPositionDetails(userId: string, symbol: string)

```typescript
export class PortfolioService {
  async getPortfolioSummary(userId: string): Promise<Portfolio> {
    const query = `
      SELECT id, user_id, total_value, available_balance, cash,
             today_return, ytd_return, total_gain_loss,
             total_gain_loss_percent, market_status, ai_risk_score,
             currency, updated_at
      FROM portfolios
      WHERE user_id = $1
    `;
    const result = await pool.query(query, [userId]);
    if (!result.rows.length) throw new ApiError('PORTFOLIO_NOT_FOUND', 404);
    return result.rows[0];
  }

  async getPortfolioAllocation(userId: string): Promise<AssetAllocation> {
    const query = `
      SELECT
        COALESCE(SUM(CASE WHEN sector = 'US Equities' THEN total_value ELSE 0 END), 0) as us_equities,
        COALESCE(SUM(CASE WHEN sector = 'International' THEN total_value ELSE 0 END), 0) as international,
        COALESCE(SUM(CASE WHEN sector = 'Bonds' THEN total_value ELSE 0 END), 0) as bonds,
        COALESCE(SUM(CASE WHEN sector = 'Cash' THEN total_value ELSE 0 END), 0) as cash,
        SUM(total_value) as total
      FROM positions
      WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1)
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  async getPortfolioPerformance(userId: string, period: string): Promise<PerformanceData[]> {
    // Generate performance data for specified period
    const query = `
      SELECT * FROM portfolio_performance_data
      WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1)
      AND date >= NOW() - INTERVAL $2
      ORDER BY date ASC
    `;
    const result = await pool.query(query, [userId, period]);
    return result.rows;
  }

  async getPositionDetails(userId: string, symbol: string): Promise<Position> {
    const query = `
      SELECT id, portfolio_id, symbol, quantity, entry_price, current_price,
             total_value, gain_loss, gain_loss_percent, sector, risk_level,
             last_price_update, updated_at
      FROM positions
      WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1)
      AND symbol = $2
    `;
    const result = await pool.query(query, [userId, symbol]);
    if (!result.rows.length) throw new ApiError('POSITION_NOT_FOUND', 404);
    return result.rows[0];
  }
}
```

**backend/src/api/services/TradesService.ts** (180 LOC)
- 3 database queries
- Query methods:
  1. getRecentTrades(userId: string, limit: number, offset: number)
  2. getCurrentHoldings(userId: string)
  3. getTradeDetails(userId: string, tradeId: string)

```typescript
export class TradesService {
  async getRecentTrades(userId: string, limit: number = 20, offset: number = 0): Promise<Trade[]> {
    const query = `
      SELECT id, portfolio_id, symbol, trade_type, status, quantity, price,
             total, signal_type, commission, notes, trade_date, executed_at
      FROM trades
      WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1)
      ORDER BY trade_date DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  async getCurrentHoldings(userId: string): Promise<Position[]> {
    const query = `
      SELECT id, portfolio_id, symbol, quantity, entry_price, current_price,
             total_value, gain_loss, gain_loss_percent, sector, risk_level,
             last_price_update
      FROM positions
      WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1)
      AND quantity > 0
      ORDER BY total_value DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  async getTradeDetails(userId: string, tradeId: string): Promise<Trade> {
    const query = `
      SELECT id, portfolio_id, symbol, trade_type, status, quantity, price,
             total, signal_type, commission, notes, trade_date, executed_at
      FROM trades
      WHERE id = $1
      AND portfolio_id = (SELECT id FROM portfolios WHERE user_id = $2)
    `;
    const result = await pool.query(query, [tradeId, userId]);
    if (!result.rows.length) throw new ApiError('TRADE_NOT_FOUND', 404);
    return result.rows[0];
  }
}
```

**backend/src/api/services/AnalyticsService.ts** (160 LOC)
- 2 main queries + bonus
- Query methods:
  1. getMarketStatus()
  2. getAIRiskScore(userId: string)
  3. getAnalyticsSummary(userId: string)

```typescript
export class AnalyticsService {
  async getMarketStatus(): Promise<{ status: 'OPEN' | 'CLOSED'; time: string }> {
    // In real implementation, would call market data provider
    // For now, return mock status based on market hours
    const now = new Date();
    const hours = now.getHours();
    const isWeekday = now.getDay() !== 0 && now.getDay() !== 6;
    const isOpen = isWeekday && hours >= 9 && hours < 16;

    return {
      status: isOpen ? 'OPEN' : 'CLOSED',
      time: now.toISOString()
    };
  }

  async getAIRiskScore(userId: string): Promise<number> {
    const query = `
      SELECT ai_risk_score FROM portfolios WHERE user_id = $1
    `;
    const result = await pool.query(query, [userId]);
    if (!result.rows.length) throw new ApiError('PORTFOLIO_NOT_FOUND', 404);
    return result.rows[0].ai_risk_score;
  }

  async getAnalyticsSummary(userId: string): Promise<object> {
    const portfolio = await new PortfolioService().getPortfolioSummary(userId);
    const trades = await new TradesService().getRecentTrades(userId, 5);
    const holdings = await new TradesService().getCurrentHoldings(userId);

    return {
      portfolio,
      recentTrades: trades,
      topHoldings: holdings.slice(0, 5),
      generatedAt: new Date().toISOString()
    };
  }
}
```

### 3. Express Routes

**backend/src/api/routes/portfolioRoutes.ts** (50 LOC)
- GET /api/v1/portfolio/summary
- GET /api/v1/portfolio/allocation
- GET /api/v1/portfolio/performance/:period
- GET /api/v1/portfolio/positions/:symbol

**backend/src/api/routes/tradesRoutes.ts** (50 LOC)
- GET /api/v1/trades/recent
- GET /api/v1/trades/holdings
- GET /api/v1/trades/:tradeId

**backend/src/api/routes/analyticsRoutes.ts** (40 LOC)
- GET /api/v1/market/status
- GET /api/v1/analytics/risk-score
- GET /api/v1/analytics/summary

**backend/src/api/v1/index.ts** (30 LOC)
- Combines all routes under /api/v1
- Exports main router

### 4. Validation & Middleware

**backend/src/api/middleware/validation.ts** (100 LOC)
- Query parameter validation
- Path parameter validation
- Request body validation
- Reusable validation middleware

**backend/src/utils/validators.ts** (80 LOC)
- Validation schemas for requests
- Helper functions for common validations

### 5. Express App & Server

**backend/src/app.ts** (80 LOC)
- Express app factory
- Middleware setup (cors, body-parser, logging, auth, error handling)
- Route registration
- 404 handler

**backend/src/server.ts** (50 LOC)
- Server startup with graceful shutdown
- Database initialization
- Port listening
- Process signal handlers

### 6. Dependencies to Install

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express-async-errors": "^3.1.1"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "@types/express": "^4.17.21",
    "@types/node": "^20.9.0",
    "@types/pg": "^8.10.7"
  }
}
```

---

## Implementation Order

1. ✅ Database connection configuration
2. ✅ Service layer (PortfolioService, TradesService, AnalyticsService)
3. ✅ Update controllers to use services
4. ✅ Express routes
5. ✅ Validation middleware
6. ✅ Express app factory
7. ✅ Server startup
8. ✅ Environment configuration
9. ✅ Testing connectivity

---

## Testing Checklist

- [ ] Database connection successful
- [ ] Portfolio summary endpoint responds
- [ ] Recent trades endpoint responds
- [ ] Analytics summary endpoint responds
- [ ] Error handling for missing data
- [ ] Authentication middleware blocks unauthenticated requests
- [ ] Validation rejects invalid parameters
- [ ] 404 handler for unmapped routes
- [ ] Graceful shutdown on SIGTERM

---

## Files to Create (1,400+ LOC)

| File | LOC | Status |
|------|-----|--------|
| backend/src/config/database.ts | 80 | TODO |
| backend/src/config/env.ts | 40 | TODO |
| backend/src/api/services/PortfolioService.ts | 220 | TODO |
| backend/src/api/services/TradesService.ts | 180 | TODO |
| backend/src/api/services/AnalyticsService.ts | 160 | TODO |
| backend/src/api/routes/portfolioRoutes.ts | 50 | TODO |
| backend/src/api/routes/tradesRoutes.ts | 50 | TODO |
| backend/src/api/routes/analyticsRoutes.ts | 40 | TODO |
| backend/src/api/v1/index.ts | 30 | TODO |
| backend/src/api/middleware/validation.ts | 100 | TODO |
| backend/src/utils/validators.ts | 80 | TODO |
| backend/src/utils/logger.ts | 60 | TODO |
| backend/src/app.ts | 80 | TODO |
| backend/src/server.ts | 50 | TODO |
| backend/.env.example | 15 | TODO |
| **TOTAL** | **1,195** | |

---

## Success Criteria

✅ All service layer methods implemented
✅ All routes respond with proper status codes
✅ Database queries execute successfully
✅ Error handling returns appropriate error messages
✅ Validation middleware validates all inputs
✅ Authentication middleware protects endpoints
✅ Server starts and listens on configured port
✅ Graceful shutdown implemented
✅ All changes committed to GitHub

