# HMS Advanced Backtesting Features - Deployment & Configuration Guide

**Version:** 1.0.0
**Target Environment:** Production
**Last Updated:** 2024
**Author:** Development Team

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Database Setup](#database-setup)
3. [Environment Configuration](#environment-configuration)
4. [Engine Initialization](#engine-initialization)
5. [API Endpoint Integration](#api-endpoint-integration)
6. [Performance Tuning](#performance-tuning)
7. [Security Hardening](#security-hardening)
8. [Monitoring & Alerting](#monitoring--alerting)
9. [Troubleshooting](#troubleshooting)
10. [Rollback Procedures](#rollback-procedures)

---

## Pre-Deployment Checklist

Before deploying advanced backtesting features to production, verify:

### Infrastructure Requirements

- [ ] Database server: MySQL 5.7+ or MariaDB 10.2+
- [ ] Node.js: v16.0.0 or higher
- [ ] RAM: Minimum 8GB (16GB recommended)
- [ ] CPU: 4+ cores (8+ for high volume)
- [ ] Disk Space: 500GB+ for historical data
- [ ] Network: Stable, low-latency connection to data providers

### Code & Dependencies

- [ ] All tests passing: `npm test`
- [ ] Security audit clean: `npm audit`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Type checking clean: `npm run typecheck`

### Database Verification

- [ ] Backup strategy in place
- [ ] Replica/failover configured
- [ ] Performance benchmarks established
- [ ] Storage monitoring set up

### Team Readiness

- [ ] Deployment team trained
- [ ] Runbooks documented
- [ ] Escalation paths defined
- [ ] Communication plan established

---

## Database Setup

### Step 1: Create Database

```sql
CREATE DATABASE IF NOT EXISTS hms_backtesting
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'hms_app'@'localhost' IDENTIFIED BY 'SECURE_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON hms_backtesting.* TO 'hms_app'@'localhost';

-- For remote access (if needed)
CREATE USER 'hms_app'@'%' IDENTIFIED BY 'SECURE_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON hms_backtesting.* TO 'hms_app'@'%';

FLUSH PRIVILEGES;
```

### Step 2: Run Database Migrations

**Order of migrations is important!**

```bash
# Navigate to your database migration directory
cd database-migrations

# Run migrations in sequence
mysql -u root -p hms_backtesting < 001_create_execution_history.sql
mysql -u root -p hms_backtesting < 002_create_paper_trading_schema.sql
mysql -u root -p hms_backtesting < 003_create_backtesting_schema.sql
mysql -u root -p hms_backtesting < 004_create_backtest_tables.sql
mysql -u root -p hms_backtesting < 005_create_advanced_backtesting_tables.sql

# Verify migrations
mysql -u root -p hms_backtesting -e "SHOW TABLES;"
```

**Expected Tables After Migration:**

```
backtest_multi_asset
backtest_walk_forward
backtest_walk_forward_windows
backtest_monte_carlo
backtest_monte_carlo_paths
backtest_advanced_orders
backtest_optimization_results
backtest_optimization_trials
```

### Step 3: Create Indexes for Performance

```sql
-- Multi-asset indexes
CREATE INDEX idx_multi_asset_user_status ON backtest_multi_asset(user_id, status, created_at DESC);
CREATE INDEX idx_multi_asset_symbols ON backtest_multi_asset(JSON_EXTRACT(symbols, '$[0]'));

-- Walk-forward indexes
CREATE INDEX idx_wfo_user_status ON backtest_walk_forward(user_id, status, created_at DESC);
CREATE INDEX idx_wfo_windows_opt ON backtest_walk_forward_windows(optimization_id, window_number);

-- Monte Carlo indexes
CREATE INDEX idx_mc_user_status ON backtest_monte_carlo(user_id, status, created_at DESC);
CREATE INDEX idx_mc_backtest ON backtest_monte_carlo(backtest_id);

-- Optimization indexes
CREATE INDEX idx_opt_user_status ON backtest_optimization_results(user_id, status, created_at DESC);
CREATE INDEX idx_opt_trials ON backtest_optimization_trials(optimization_result_id, metric_value DESC);
```

### Step 4: Set Up Archival Strategy

For long-term storage of simulation data:

```sql
-- Archive old simulations (older than 1 year)
CREATE EVENT archive_old_simulations
ON SCHEDULE EVERY 1 DAY
DO
BEGIN
  INSERT INTO backtest_monte_carlo_archive
  SELECT * FROM backtest_monte_carlo
  WHERE completed_at < DATE_SUB(NOW(), INTERVAL 1 YEAR)
    AND archived_at IS NULL;

  DELETE FROM backtest_monte_carlo
  WHERE completed_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
END;

-- Enable event scheduler
SET GLOBAL event_scheduler = ON;
```

---

## Environment Configuration

### Step 1: Create .env File

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=hms_app
DB_PASSWORD=SECURE_PASSWORD_HERE
DB_NAME=hms_backtesting
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_ACQUIRE_TIMEOUT=10000

# Advanced Features Configuration
ENABLE_MULTI_ASSET_BACKTEST=true
ENABLE_WALK_FORWARD_OPTIMIZATION=true
ENABLE_MONTE_CARLO_SIMULATION=true

# Backtesting Engine Configuration
BACKTEST_MAX_SYMBOLS=10
BACKTEST_MAX_BARS=50000
BACKTEST_TIMEOUT_MS=600000
BACKTEST_MEMORY_LIMIT_MB=2048

# Walk-Forward Configuration
WFO_MAX_WINDOWS=20
WFO_MAX_PARAMETER_COMBINATIONS=10000
WFO_OPTIMIZATION_TIMEOUT_MS=3600000

# Monte Carlo Configuration
MC_MIN_SIMULATIONS=100
MC_MAX_SIMULATIONS=10000
MC_DEFAULT_SIMULATIONS=1000
MC_MAX_EQUITY_HISTORY_SIZE=10000

# Caching
CACHE_TYPE=redis
CACHE_HOST=localhost
CACHE_PORT=6379
CACHE_MAX_SIZE=1000
CACHE_TTL_SECONDS=3600

# Historical Data
HISTORICAL_DATA_CACHE_ENABLED=true
HISTORICAL_DATA_CACHE_SIZE=500
HISTORICAL_DATA_RETENTION_DAYS=1825

# API Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_MAX_BACKGROUND_JOBS=20

# Security
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=86400
CORS_ORIGIN=https://yourdomain.com
API_KEY_ROTATION_DAYS=90

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_RETENTION_DAYS=30
LOG_MAX_FILE_SIZE_MB=100

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
DATADOG_ENABLED=false
NEWRELIC_ENABLED=false

# Feature Flags
FEATURE_REAL_TIME_PROGRESS=true
FEATURE_WEBHOOKS=false
FEATURE_BULK_OPERATIONS=false

# Environment
NODE_ENV=production
APP_VERSION=1.0.0
```

### Step 2: Validate Configuration

```bash
# Create a validation script
cat > validate-config.js << 'EOF'
const fs = require('fs');
require('dotenv').config();

const requiredVars = [
  'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
  'JWT_SECRET', 'CORS_ORIGIN'
];

const missing = requiredVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error('Missing environment variables:', missing);
  process.exit(1);
}

console.log('✅ Configuration validation passed');
EOF

node validate-config.js
```

---

## Engine Initialization

### Step 1: Initialize Engine Instances

**File: `plugin/index.js` or `app.js`**

```javascript
const MultiAssetBacktestEngine = require('./plugin/backtesting/multi-asset-backtest-engine');
const WalkForwardOptimizer = require('./plugin/backtesting/walk-forward-optimizer');
const MonteCarloSimulator = require('./plugin/backtesting/monte-carlo-simulator');
const HistoricalDataManager = require('./plugin/data/historical-data-manager');
const LRUCache = require('./plugin/cache/lru-cache');

// Initialize LRU Cache
const cache = new LRUCache({
  maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000,
  defaultTtl: (parseInt(process.env.CACHE_TTL_SECONDS) || 3600) * 1000
});

// Initialize Data Manager
const dataManager = new HistoricalDataManager(database, cache, logger);

// Initialize Backtesting Engines
const multiAssetBacktestEngine = new MultiAssetBacktestEngine(dataManager, logger);
const walkForwardOptimizer = new WalkForwardOptimizer(dataManager, logger);
const monteCarloSimulator = new MonteCarloSimulator(logger);

// Log initialization
logger.info('Advanced backtesting engines initialized successfully', {
  multiAsset: true,
  walkForward: true,
  monteCarlo: true
});

// Export for use in API routes
module.exports = {
  multiAssetBacktestEngine,
  walkForwardOptimizer,
  monteCarloSimulator,
  dataManager,
  cache
};
```

### Step 2: Initialize API Routes

**File: `app.js` or `server.js`**

```javascript
const express = require('express');
const { initializeAdvancedBacktestingRoutes } = require('./plugin/api/advanced-backtesting-endpoints');
const engines = require('./plugin/index');

const app = express();

// Initialize advanced backtesting routes
app.use(initializeAdvancedBacktestingRoutes({
  database,
  multiAssetBacktestEngine: engines.multiAssetBacktestEngine,
  walkForwardOptimizer: engines.walkForwardOptimizer,
  monteCarloSimulator: engines.monteCarloSimulator,
  dataManager: engines.dataManager,
  logger,
  authMiddleware
}));

logger.info('Advanced backtesting routes initialized');
```

---

## API Endpoint Integration

### Step 1: Verify Endpoints Are Registered

```bash
# Check if endpoints are accessible
curl -X GET http://localhost:3000/api/backtesting/health

# Expected response:
# {"status": "healthy", "version": "1.0.0"}
```

### Step 2: Test Each Endpoint

```bash
# Test multi-asset endpoint
curl -X POST http://localhost:3000/api/backtesting/multi-asset \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "symbols": ["AAPL", "MSFT"], ...}'

# Test walk-forward endpoint
curl -X POST http://localhost:3000/api/backtesting/walk-forward \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test WFO", "symbol": "AAPL", ...}'

# Test Monte Carlo endpoint
curl -X POST http://localhost:3000/api/backtesting/monte-carlo \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test MC", "backtestId": 1, ...}'
```

### Step 3: Load Testing (Optional but Recommended)

```bash
# Using Apache Bench
ab -n 100 -c 10 -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/backtesting/health

# Or using wrk
wrk -t4 -c100 -d30s --latency \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/backtesting/health
```

---

## Performance Tuning

### Step 1: Database Optimization

```sql
-- Analyze table statistics
ANALYZE TABLE backtest_multi_asset;
ANALYZE TABLE backtest_walk_forward;
ANALYZE TABLE backtest_monte_carlo;
ANALYZE TABLE backtest_optimization_results;

-- Check query performance
EXPLAIN SELECT * FROM backtest_multi_asset
  WHERE user_id = 1 AND status = 'completed';

-- Optimize table (periodic maintenance)
OPTIMIZE TABLE backtest_multi_asset;
OPTIMIZE TABLE backtest_walk_forward;
OPTIMIZE TABLE backtest_monte_carlo;
```

### Step 2: Memory Optimization

```javascript
// Monitor memory usage
setInterval(() => {
  const memUsage = process.memoryUsage();
  logger.info('Memory usage', {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
    external: Math.round(memUsage.external / 1024 / 1024) + 'MB'
  });
}, 60000); // Every minute

// Enable GC monitoring (if using --trace-gc flag)
if (process.env.ENABLE_GC_LOGGING) {
  console.log('Garbage collection monitoring enabled');
}
```

### Step 3: Connection Pool Tuning

```javascript
// Database connection pool configuration
const poolConfig = {
  min: parseInt(process.env.DB_POOL_MIN) || 5,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT) || 10000
};

// Monitor pool stats
setInterval(() => {
  logger.info('Database pool stats', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  });
}, 60000);
```

### Step 4: Cache Optimization

```javascript
// Monitor cache statistics
setInterval(() => {
  const stats = cache.getStats();
  logger.info('Cache statistics', {
    size: stats.size,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%'
  });
}, 60000);
```

---

## Security Hardening

### Step 1: Verify Security Middleware

```javascript
// Check security middleware is applied
const securityChecks = [
  { name: 'InputValidator', imported: typeof InputValidator !== 'undefined' },
  { name: 'InputSanitizer', imported: typeof InputSanitizer !== 'undefined' },
  { name: 'RateLimiter', imported: typeof createRateLimitMiddleware !== 'undefined' },
  { name: 'CORS', enabled: app.get('cors') !== undefined }
];

securityChecks.forEach(check => {
  if (check.enabled) {
    logger.info(`✅ Security check: ${check.name}`);
  } else {
    logger.warn(`⚠️ Security check: ${check.name} not found`);
  }
});
```

### Step 2: Database Security

```sql
-- Disable FILE privilege
REVOKE FILE ON *.* FROM 'hms_app'@'localhost';

-- Restrict schema access
REVOKE ALL PRIVILEGES ON information_schema.* FROM 'hms_app'@'localhost';

-- Enable SSL for connections
-- Restart MySQL with SSL enabled
-- Update connection string:
-- mysql://hms_app@localhost/hms_backtesting?ssl=true
```

### Step 3: API Security

```javascript
// Enable security headers
app.use(helmet()); // HSTS, X-Frame-Options, etc.

// Rate limiting
app.use(createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
}));

// Request timeout
app.use(createTimeoutMiddleware(30000)); // 30 seconds

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
```

### Step 4: Input Validation

```javascript
// Test input validation
const validators = {
  symbol: InputValidator.isValidSymbol('AAPL'),
  quantity: InputValidator.isValidQuantity(100),
  price: InputValidator.isValidPrice(150.50),
  percentage: InputValidator.isValidPercentage(50),
  dateRange: InputValidator.isValidDateRange(
    new Date('2024-01-01'),
    new Date('2024-12-31')
  )
};

logger.info('Input validation tests:', validators);
```

---

## Monitoring & Alerting

### Step 1: Enable Application Monitoring

```javascript
// Prometheus metrics
const promClient = require('prom-client');

if (process.env.PROMETHEUS_ENABLED === 'true') {
  // Define metrics
  const backtestCounter = new promClient.Counter({
    name: 'backtests_total',
    help: 'Total backtests executed',
    labelNames: ['type', 'status']
  });

  const executionDuration = new promClient.Histogram({
    name: 'backtest_duration_seconds',
    help: 'Backtest execution duration',
    buckets: [10, 30, 60, 120, 300, 600]
  });

  // Expose metrics endpoint
  app.get('/metrics', (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(promClient.register.metrics());
  });

  logger.info('Prometheus metrics enabled at /metrics');
}
```

### Step 2: Set Up Alerting Rules

**File: `monitoring/alerting-rules.yml`**

```yaml
groups:
  - name: backtest_alerts
    interval: 30s
    rules:
      # Alert if backtests are failing
      - alert: BacktestFailureRate
        expr: rate(backtests_total{status="failed"}[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High backtest failure rate"

      # Alert if execution time is too long
      - alert: BacktestTimeoutRisk
        expr: histogram_quantile(0.99, backtest_duration_seconds) > 300
        for: 10m
        annotations:
          summary: "Backtests taking too long to execute"

      # Alert on database connection issues
      - alert: DatabaseConnectionIssues
        expr: db_pool_waiting_connections > 5
        for: 5m
        annotations:
          summary: "Database connection pool is exhausted"

      # Alert on cache miss rate
      - alert: HighCacheMissRate
        expr: (cache_misses / (cache_hits + cache_misses)) > 0.5
        for: 10m
        annotations:
          summary: "Cache miss rate is too high"
```

### Step 3: Log Aggregation

```javascript
// Configure centralized logging
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    // Write to file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 30 // Keep 30 days
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 100 * 1024 * 1024,
      maxFiles: 30
    }),
    // Also log to console in development
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: winston.format.simple()
      })
    ] : [])
  ]
});
```

---

## Troubleshooting

### Issue: Monte Carlo Simulations Running Out of Memory

**Symptoms:**
- `FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed`
- Simulations crash with large numSimulations

**Solution:**

```javascript
// Reduce simulation batch size
const MAX_SIMULATIONS_PER_BATCH = 100;
async function runLargeSimulation(numSimulations) {
  const results = [];
  for (let i = 0; i < numSimulations; i += MAX_SIMULATIONS_PER_BATCH) {
    const batchSize = Math.min(MAX_SIMULATIONS_PER_BATCH, numSimulations - i);
    const batchResults = simulator.runSimulation(data, {
      numSimulations: batchSize
    });
    results.push(...batchResults.simulations);
    // Force garbage collection between batches
    if (global.gc) global.gc();
  }
  return results;
}

// Increase Node.js heap
node --max-old-space-size=4096 app.js
```

### Issue: Database Timeouts on Large Backtests

**Symptoms:**
- `PROTOCOL_SEQUENCE_TIMEOUT`
- `Lost connection to MySQL server`

**Solution:**

```sql
-- Increase MySQL timeout settings
SET GLOBAL connect_timeout = 30;
SET GLOBAL interactive_timeout = 3600;
SET GLOBAL wait_timeout = 3600;
SET GLOBAL max_allowed_packet = 67108864; -- 64MB

-- Restart service to persist (add to my.cnf)
```

### Issue: Walk-Forward Optimization Never Completes

**Symptoms:**
- Status stays "running" indefinitely
- No error message

**Solution:**

```javascript
// Add timeout check
const MAX_OPTIMIZATION_TIME = 3600000; // 1 hour
const startTime = Date.now();

async function runWFOWithTimeout(config) {
  const optimization = optimizer.runWalkForwardOptimization(config);

  return Promise.race([
    optimization,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('WFO timeout')), MAX_OPTIMIZATION_TIME)
    )
  ]);
}
```

---

## Rollback Procedures

### Emergency Rollback (If Critical Issue Found)

```bash
# 1. Stop the application
systemctl stop hms-app

# 2. Restore database from backup (if needed)
mysql hms_backtesting < backup_2024_01_15.sql

# 3. Revert to previous version
git checkout v1.0.0-prev
npm install
npm run build

# 4. Restart application
systemctl start hms-app

# 5. Verify health
curl http://localhost:3000/api/backtesting/health
```

### Gradual Rollback (If UI/Feature Issues)

```bash
# 1. Disable new feature endpoints via feature flags
export ENABLE_MONTE_CARLO_SIMULATION=false
export ENABLE_WALK_FORWARD_OPTIMIZATION=false

# 2. Restart app (graceful)
systemctl reload hms-app

# 3. Monitor error rates
curl http://localhost:3000/metrics | grep backtest

# 4. When ready, completely rollback
git revert <commit-hash>
```

---

## Post-Deployment Verification

### Checklist for Production Deployment

- [ ] All endpoints respond with 200/202 status
- [ ] Authentication is enforced on all protected endpoints
- [ ] Rate limiting is active
- [ ] Database connections are pooled
- [ ] Logs are being aggregated
- [ ] Metrics are being collected
- [ ] Alerts are configured
- [ ] Backup and recovery procedures tested
- [ ] Team is trained on runbooks
- [ ] Documentation is current

### Performance Baseline

After deployment, establish baseline metrics:

```javascript
const baselineMetrics = {
  avgBacktestDuration: '2-5 minutes',
  avgWFODuration: '15-30 minutes',
  avgMCDuration: '5-10 minutes',
  cacheHitRate: '> 70%',
  databasePoolUtilization: '< 50%',
  errorRate: '< 0.5%',
  p99Latency: '< 5 seconds'
};
```

---

## Support & Escalation

For issues during deployment:

1. **Check Logs**: `tail -f logs/error.log`
2. **Check Database**: `SELECT COUNT(*) FROM backtest_multi_asset;`
3. **Check Health**: `curl http://localhost:3000/api/backtesting/health`
4. **Contact Support**: api-support@example.com

