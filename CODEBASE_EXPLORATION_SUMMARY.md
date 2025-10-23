# Codebase Exploration Summary - Aurigraph Strategy Builder

## PROJECT OVERVIEW
- Project: Aurigraph Strategy Builder v5.0.0
- Tech Stack: Node.js, TypeScript, Express, MongoDB, Redis, WebSockets
- Status: Production Ready (infrastructure complete, auth endpoints need implementation)

## KEY FILES & LOCATIONS

### User/Authentication
- User Model: strategy-builder/src/api/models/user.model.ts
- Auth Config: strategy-builder/src/config/auth.ts
- Auth Utils: strategy-builder/src/utils/auth.ts
- Auth Middleware: strategy-builder/src/middleware/auth.ts
- Auth Routes: strategy-builder/src/api/routes/auth.routes.ts (all 501)
- RBAC: strategy-builder/src/middleware/rbac.ts

### Type Definitions
- Types: strategy-builder/src/types/index.ts (494 lines)
- Contains: UserRole, IUser, JWTPayload, all model interfaces

### Database
- Database Config: strategy-builder/src/config/database.ts
- Models: strategy-builder/src/api/models/
  * user.model.ts - email, username, passwordHash, role, permissions
  * strategy.model.ts - trading strategies
  * backtest.model.ts - backtest results
  * optimization.model.ts - parameter optimization
  * deployment.model.ts - live deployment tracking

### Configuration
- Environment: strategy-builder/.env.example
- Docker: strategy-builder/docker-compose.yml
- Package: strategy-builder/package.json

## USER ROLES & HIERARCHY
1. VIEWER - Read-only access
2. TRADER - Create strategies, paper trading
3. SENIOR_TRADER - Live trading capability
4. RISK_MANAGER - Approve/reject deployments
5. ADMIN - Full system access

## AUTHENTICATION PATTERNS

### Token Generation
- JWT with HS256 algorithm
- 24h access token, 7d refresh token
- generateAccessToken(userId, email, role)
- generateRefreshToken(userId)

### Password Handling
- Bcrypt with 10 salt rounds
- hashPassword(password) - async hash
- comparePassword(password, hash) - async compare
- Never stored/returned in API

### Token Verification
- verifyToken(token) - validates signature and expiration
- Throws TokenExpiredError or JsonWebTokenError
- extractTokenFromHeader(authorization) - parses Bearer token

## DATABASE MODELS

### User Schema
- email: unique, lowercase
- username: unique, 3-30 chars
- passwordHash: bcrypt hashed
- role: UserRole enum
- permissions: array (derived from role)
- isActive: boolean
- lastLogin: optional date
- Indexes: email (unique), username (unique)

### Other Models
- Strategy: name, indicators, entry/exit conditions, status
- Backtest: strategyId, config, metrics, progress
- Optimization: algorithm, parameters, results
- Deployment: environment, risk limits, approval workflow

## API STRUCTURE

### Auth Routes (NOT IMPLEMENTED - Return 501)
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/logout
- POST /api/v1/auth/refresh
- GET /api/v1/auth/me

### Other Routes (Placeholder)
- strategies.routes.ts
- backtests.routes.ts
- optimizations.routes.ts
- indicators.routes.ts
- deployments.routes.ts

### Health Check
- GET /health (returns service status)

## MIDDLEWARE STACK

### Authentication
- authenticate: validates JWT, fetches user, checks active status
- optionalAuthenticate: non-blocking variant

### RBAC
- requireRole: hierarchy-based role checking
- requirePermission: granular permission checking
- requireOwnership: resource ownership validation

### Other
- errorHandler: centralized error handling with structured responses
- validation: Zod schema validation
- logging: request and performance logging
- helmet: security headers
- CORS: cross-origin resource sharing
- Rate limiting: 100 req/15min

## ENVIRONMENT VARIABLES

Critical:
- JWT_SECRET: token signing key
- MONGODB_URI: database connection
- REDIS_HOST/PORT: cache connection
- NODE_ENV: development/production

Optional:
- OAUTH_ENABLED: Google OAuth
- CORS_ORIGIN: allowed origins
- Monitoring: SENTRY_DSN, METRICS

## IMPLEMENTATION STATUS

COMPLETED:
- User model with roles/permissions
- JWT generation and validation
- Password hashing (bcrypt)
- Authentication middleware
- RBAC system
- Database models and indexes
- Error handling
- Request validation
- Type definitions
- Redis caching
- Docker infrastructure

NEEDED:
- Register endpoint
- Login endpoint
- Logout endpoint
- Token refresh endpoint
- Get current user endpoint
- All strategy/backtest/optimization/deployment handlers

## PATTERNS & BEST PRACTICES

1. Error Handling: Custom AppError class with statusCode/code/message
2. Async: asyncHandler wrapper for promise rejection handling
3. Validation: Zod schemas for input validation
4. Types: Comprehensive TypeScript interfaces for all entities
5. Security: Helmet, CORS, rate limiting, bcrypt hashing
6. Logging: Winston logger with structured logs
7. Response: Consistent {success, data/error, meta} format

## CRITICAL OBSERVATIONS

1. Auth routes are all placeholders (501) - highest priority implementation
2. All utilities (token, hashing, validation) are fully implemented
3. RBAC is robust with role hierarchy and permission system
4. Type safety is excellent with detailed interfaces
5. Database is well-structured with proper indexing
6. Infrastructure (Docker, Redis, MongoDB) is complete
7. Security hardening is in place (helmet, CORS, rate limiting)

