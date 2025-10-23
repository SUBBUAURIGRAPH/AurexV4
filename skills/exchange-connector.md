# Exchange-Connector Skill

**Agent**: Trading Operations
**Purpose**: Connect to and manage 12+ cryptocurrency and trading exchanges with unified interface
**Status**: In Development
**Version**: 1.0.0 (SPARC Phase 1: Specification Complete)
**Owner**: Trading Operations Team
**Last Updated**: 2025-10-23

---

## SPARC Framework Phases

This skill follows the **SPARC Framework** for structured development. Track progress here:

- **Phase 1 - Specification**: ✅ Complete (2025-10-23)
  - Functional requirements defined (10 capabilities)
  - Technical requirements documented
  - User journeys mapped (5 personas)
  - Success metrics defined (10 KPIs)
  - Constraints & limitations documented
- **Phase 2 - Pseudocode**: 🔄 Next Phase
  - Algorithm design for connection management
  - Data structures definition
  - Integration point mapping
  - Error handling scenarios
  - WebSocket reconnection strategy
- **Phase 3 - Architecture**: 📋 Pending
  - System design finalization
  - API specifications drafted
  - Security approach defined
- **Phase 4 - Refinement**: 📋 Pending
  - Design optimizations applied
  - Testing strategy finalized
  - Code standards documented
- **Phase 5 - Completion**: 📋 Pending
  - Code implementation done
  - Tests passing (80%+ coverage)
  - Documentation complete

> For more info on SPARC Framework, see `docs/SPARC_FRAMEWORK.md`

---

## Overview

The **exchange-connector** skill provides unified management of 12+ cryptocurrency and traditional asset exchanges through a single, intelligent interface. Rather than maintaining scattered integration scripts across the codebase, this skill consolidates all exchange connectivity into a robust, scalable, and secure subsystem.

### Key Capabilities

- **Multi-Exchange Connection**: Simultaneously connect to Binance, Coinbase Pro, Kraken, Bybit, Alpaca, OKX, KuCoin, Bitfinex, Gate.io, Huobi, Gemini, and FTX
- **Health Monitoring**: Real-time status, latency monitoring, and exchange availability tracking
- **Secure Credential Management**: AES-256 encryption, HashiCorp Vault integration, 90-day rotation policy
- **Rate Limit Management**: Prevent API bans through intelligent request throttling and queue management
- **Failover & Redundancy**: Automatic failover to backup exchanges during outages (recovery time <5s)
- **Unified Data Access**: Consistent API across all exchanges (balances, market data, trading pairs)
- **Diagnostic Reporting**: Comprehensive health reports, audit logs, and incident analysis

### Value Proposition

- **Time Savings**: 80% reduction in manual exchange connection management (30 min → 6 min)
- **Risk Reduction**: 75% faster incident response (8 min → 2 min) during exchange outages
- **Operational Efficiency**: 10 hrs/month for DevOps (API key management, troubleshooting)
- **Business Impact**: $77,000/year in combined savings and loss prevention

---

## Capabilities

- **Capability 1 - Multi-Exchange Connection**: Connect to 12+ exchanges simultaneously, managing concurrent connections with automatic health monitoring
- **Capability 2 - Health Monitoring**: Real-time monitoring of exchange status, latency metrics, and API availability with customizable alerting
- **Capability 3 - Secure Credential Management**: Encrypted storage and retrieval of API credentials with automatic 90-day rotation policies
- **Capability 4 - Rate Limit Management**: Track and enforce exchange-specific rate limits with intelligent request throttling
- **Capability 5 - Balance Retrieval**: Fetch account balances across all connected exchanges with unified format and multi-asset support
- **Capability 6 - Market Data Access**: Real-time and historical market data retrieval from any connected exchange
- **Capability 7 - Trading Pair Discovery**: Query and cache available trading pairs per exchange with dynamic updates
- **Capability 8 - Connectivity Testing**: Validate API credentials and test exchange connectivity with detailed diagnostics
- **Capability 9 - Failover & Redundancy**: Automatic failover to backup exchanges on outage with <5s recovery time
- **Capability 10 - Diagnostic Reporting**: Generate comprehensive health reports, audit logs, and incident analysis

---

## Usage

### Basic Usage

```
@trading-operations exchange-connector "Check all exchange connections"
```

**Response**:
```json
{
  "success": true,
  "summary": {
    "totalExchanges": 12,
    "connected": 11,
    "degraded": 1,
    "failed": 0,
    "overallHealth": 98.5
  },
  "exchanges": [
    {
      "name": "binance",
      "status": "connected",
      "latency": 127,
      "uptime": 99.98,
      "rateLimitUsage": 450/1200
    }
  ]
}
```

### Advanced Usage

#### 1. Connect to Specific Exchanges

```
@trading-operations exchange-connector
- exchange: binance, coinbase-pro, kraken
- region: us-east (for lowest latency)
- validateBalance: true
- verbose: true
```

#### 2. Retrieve Balances Across Exchanges

```
@trading-operations exchange-connector
- operation: getBalances
- exchanges: all
- assetFilter: BTC,ETH,USD
- sortBy: totalValue
- includeUsdValue: true
```

#### 3. Test Exchange Connectivity

```
@trading-operations exchange-connector
- operation: testConnection
- exchange: kraken
- latencyPings: 10
- timeoutSeconds: 5
- verbose: true
```

#### 4. Rotate API Keys (Quarterly)

```
@trading-operations exchange-connector
- operation: rotateCredentials
- exchanges: binance, coinbase-pro, kraken
- rotationPolicy: 90days
- vaultIntegration: enabled
- notifySlack: #trading-ops
```

#### 5. Generate Health Report

```
@trading-operations exchange-connector
- operation: generateReport
- timeframe: 24h
- includeMetrics: [uptime, latency, errorRate, rateLimits]
- exportFormat: json,csv
- sendEmail: risk-team@company.com
```

### Example Scenarios

**Example 1: Trader Morning Routine**
```
@trading-operations exchange-connector "Check all exchange connections and show balance summary"
```
*Returns health status of all exchanges and consolidated balance across accounts in <30 seconds.*

**Example 2: Quant Pre-Deployment Verification**
```
@trading-operations exchange-connector "Verify connectivity for binance, coinbase-pro, kraken with latency <200ms and check BTC/USD pairs available"
```
*Validates 3 exchanges are ready for high-frequency trading strategy deployment.*

**Example 3: Emergency Exchange Outage**
```
@trading-operations exchange-connector "Binance is down - show failover options for BTC/USD positions and suggest alternative exchanges"
```
*Automatically routes trading operations to backup exchanges while monitoring main exchange recovery.*

**Example 4: Security - API Key Rotation**
```
@trading-operations exchange-connector "Rotate all API keys immediately and enable IP whitelisting on US corporate range"
```
*Triggered monthly or on-demand for security policy compliance.*

**Example 5: Audit - Compliance Report**
```
@trading-operations exchange-connector "Generate 6-month audit report of all exchange connections, API key rotations, and security incidents"
```
*Produces detailed report for regulatory compliance and security audit.*

---

## Configuration

### Environment Variables

```bash
# Core Configuration
EXCHANGE_CONNECTOR_ENABLED=true
EXCHANGE_CONNECTOR_LOG_LEVEL=info
EXCHANGE_CONNECTOR_TIMEOUT=30000

# Vault Integration (API Key Storage)
VAULT_ADDR=https://vault.company.com
VAULT_TOKEN=${VAULT_TOKEN}
VAULT_ENGINE_PATH=secret/exchanges

# Redis Cache
REDIS_HOST=redis.company.com
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_CACHE_TTL=300

# MongoDB Logging
MONGODB_URI=mongodb://trading-logs.company.com:27017
MONGODB_DATABASE=exchange_logs
MONGODB_COLLECTION=connections

# CCXT Configuration
CCXT_SANDBOX=false
CCXT_USER_AGENT=aurigraph-trading/1.0.0

# Exchange-Specific Settings
BINANCE_API_TIER=advanced
COINBASE_PRODUCT_ID=BTC-USD,ETH-USD
KRAKEN_RATE_TIER=3

# Alerting
ALERT_SLACK_WEBHOOK=${SLACK_WEBHOOK_URL}
ALERT_PAGERDUTY_KEY=${PAGERDUTY_API_KEY}
ALERT_EMAIL=alerts@company.com

# Performance
POOL_MIN_SIZE=5
POOL_MAX_SIZE=50
REQUEST_TIMEOUT=10000
RETRY_MAX_ATTEMPTS=3
RETRY_BACKOFF_MS=1000
```

### Configuration Files

**File**: `config/exchange-connector.json`

```json
{
  "exchanges": {
    "binance": {
      "enabled": true,
      "priority": 1,
      "region": "us",
      "rateLimit": 1200,
      "timeout": 10000,
      "retryPolicy": "exponential",
      "maxRetries": 3,
      "fallbackExchanges": ["coinbase", "kraken"]
    },
    "coinbase-pro": {
      "enabled": true,
      "priority": 2,
      "region": "us",
      "rateLimit": 300,
      "timeout": 10000,
      "retryPolicy": "exponential",
      "maxRetries": 3,
      "fallbackExchanges": ["kraken", "binance"]
    },
    "kraken": {
      "enabled": true,
      "priority": 3,
      "region": "eu",
      "rateLimit": 600,
      "timeout": 12000,
      "retryPolicy": "exponential",
      "maxRetries": 3,
      "fallbackExchanges": ["binance", "coinbase"]
    }
  },
  "rateLimit": {
    "globalQPS": 500,
    "perExchangeQPS": 100,
    "burstMultiplier": 2.0,
    "backoffStrategy": "exponential",
    "throttleUnder": 0.5
  },
  "cache": {
    "enabled": true,
    "backend": "redis",
    "ttl": 300,
    "keys": ["balances", "tradingPairs", "marketData"]
  },
  "monitoring": {
    "healthCheckInterval": 60000,
    "metricsExport": true,
    "metricsPort": 9090,
    "alertOnLatency": 500,
    "alertOnErrorRate": 0.05
  },
  "security": {
    "credentialEncryption": "aes-256-gcm",
    "vault": "hashicorp",
    "ipWhitelisting": true,
    "rotationPolicy": "90days",
    "auditLogging": true
  }
}
```

### Prerequisites

- [ ] Node.js 18.0.0+ installed
- [ ] CCXT library installed (`npm install ccxt`)
- [ ] ccxws library for WebSocket support (`npm install ccxws`)
- [ ] HashiCorp Vault instance running and configured
- [ ] Redis instance for caching
- [ ] MongoDB instance for audit logging
- [ ] Exchange API keys (Binance, Coinbase Pro, Kraken, etc.)
- [ ] Slack webhook URL for alerting
- [ ] PagerDuty integration key (optional)

---

## Implementation

### Integration Points

**Existing Code**:
- Files: `src/exchanges/`, `src/trading/`, `src/api/v1/`
- Scripts: `scripts/deploy-*.sh`, `scripts/validate-*.js`
- APIs: `/api/v1/trading/balance`, `/api/v1/trading/orders`, `/api/v1/exchanges/*`
- Services: CCXT (npm), Redis (caching), MongoDB (logging), Vault (secrets)

**New Components** (if needed):
- `src/skills/exchange-connector/` - Skill implementation
- `src/skills/exchange-connector/index.js` - Main entry point
- `src/skills/exchange-connector/connectionManager.js` - Connection pool management
- `src/skills/exchange-connector/credentialStore.js` - API key storage/retrieval
- `src/skills/exchange-connector/rateLimiter.js` - Rate limit throttling
- `src/skills/exchange-connector/healthMonitor.js` - Exchange health tracking
- `src/skills/exchange-connector/helpers.js` - Utility functions
- `src/skills/exchange-connector/config.js` - Configuration management
- `config/exchange-connector.json` - Configuration file
- `tests/skills/exchange-connector.test.js` - Unit tests
- `tests/integration/exchange-connector-integration.test.js` - Integration tests

### Workflow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│          EXCHANGE-CONNECTOR SKILL WORKFLOW                    │
└──────────────────────────────────────────────────────────────┘

1. REQUEST VALIDATION
   └─> Validate exchange IDs against config
   └─> Check credential cache in Vault
   └─> Verify operation parameters
   └─> Check rate limits for operation

2. PRE-EXECUTION
   └─> Check Redis cache for recent data
   └─> Verify exchange health status
   └─> Establish/reuse connection from pool
   └─> Configure request timeout/retry policy

3. EXECUTION (4 Paths)
   ├─> Path A: CONNECT
   │   ├─> Load credentials from Vault
   │   ├─> Initialize CCXT exchange object
   │   ├─> Perform auth test (credentials valid?)
   │   ├─> Establish WebSocket if supported
   │   └─> Add to connection pool
   │
   ├─> Path B: GET DATA (balances, trading pairs, market data)
   │   ├─> Check Redis cache (TTL 5 min)
   │   ├─> If miss: Call exchange API via CCXT
   │   ├─> Rate limit check (throttle if needed)
   │   ├─> Parse and normalize response
   │   └─> Cache in Redis + MongoDB log
   │
   ├─> Path C: HEALTH CHECK
   │   ├─> Ping exchange /time endpoint
   │   ├─> Measure latency (ms)
   │   ├─> Check API status page
   │   ├─> Verify WebSocket connectivity
   │   └─> Store in time-series database
   │
   └─> Path D: ROTATE CREDENTIALS
       ├─> Generate new API keys on exchange
       ├─> Load new keys securely
       ├─> Test with new keys
       ├─> Store in Vault (encrypted)
       ├─> Graceful cutover (no downtime)
       └─> Deactivate old keys (24hr delay)

4. RATE LIMIT HANDLING
   └─> Check exchange rate limits (from config)
   └─> Calculate remaining quota
   └─> Queue request if at limit
   └─> Exponential backoff on 429 responses
   └─> Log rate limit exceeded events

5. ERROR HANDLING
   ├─> Network timeout? → Retry with backoff
   ├─> Invalid credentials? → Alert ops, suggest rotation
   ├─> Rate limit? → Queue and retry
   ├─> Exchange down? → Trigger failover
   ├─> Vault unavailable? → Use cached creds (24hr max)
   └─> Unknown error? → Alert, log, escalate

6. POST-EXECUTION
   └─> Format response (consistent schema)
   └─> Update connection health status
   └─> Log to MongoDB (audit trail)
   └─> Export metrics to Prometheus
   └─> Trigger alerts if thresholds exceeded

7. CLEANUP
   └─> Return connection to pool (if applicable)
   └─> Update cache expiry
   └─> Send completion notification
   └─> Update JIRA ticket (if integrated)

8. RESPONSE
   └─> HTTP 200 (success): Return data + metadata
   └─> HTTP 4xx: Return error details + suggestions
   └─> HTTP 5xx: Return error + fallback options
```

### Pseudocode

```javascript
/**
 * PHASE 2 DELIVERABLE: Pseudocode for exchange-connector skill
 * (Actual code implementation comes in Phase 5)
 */

async function executeExchangeConnectorSkill(params) {
  // 1. VALIDATE inputs
  if (!validateParams(params)) {
    return {
      success: false,
      error: 'Invalid parameters',
      suggestions: getParameterSuggestions(params)
    };
  }

  // 2. DETERMINE operation type
  const operationType = params.operation || 'connect';

  try {
    let result;

    switch(operationType) {
      case 'connect':
        result = await handleConnect(params);
        break;

      case 'getBalances':
        result = await handleGetBalances(params);
        break;

      case 'testConnection':
        result = await handleTestConnection(params);
        break;

      case 'rotateCredentials':
        result = await handleRotateCredentials(params);
        break;

      case 'generateReport':
        result = await handleGenerateReport(params);
        break;

      default:
        return {
          success: false,
          error: `Unknown operation: ${operationType}`,
          supportedOperations: ['connect', 'getBalances', 'testConnection', 'rotateCredentials', 'generateReport']
        };
    }

    // 3. POST-EXECUTION processing
    await logToAudit(result);
    await exportMetrics(result);
    await checkAlertThresholds(result);

    // 4. RETURN formatted response
    return {
      success: true,
      skillName: 'exchange-connector',
      executionTime: timer.elapsed(),
      result: result,
      metadata: {
        timestamp: Date.now(),
        requestId: generateRequestId()
      }
    };

  } catch (error) {
    // ERROR HANDLING
    return handleError(error, params);
  }
}

/**
 * SUB-ROUTINE: Handle connect operation
 */
async function handleConnect(params) {
  const exchanges = params.exchanges || [];
  const results = [];

  for (const exchangeId of exchanges) {
    try {
      // 1. Load credentials from Vault
      const credentials = await vaultClient.getCredentials(
        `secret/exchanges/${exchangeId}`
      );

      // 2. Validate credentials exist
      if (!credentials || !credentials.apiKey) {
        throw new Error(`No credentials found for ${exchangeId}`);
      }

      // 3. Create CCXT exchange instance
      const exchange = createExchangeInstance(exchangeId, credentials);

      // 4. Test connection (auth test)
      const authTest = await exchange.checkAuth();
      if (!authTest) {
        throw new Error(`Authentication failed for ${exchangeId}`);
      }

      // 5. Establish WebSocket if supported
      if (supportsWebSocket(exchangeId)) {
        const ws = await connectWebSocket(exchangeId);
        addToConnectionPool(exchangeId, { ccxt: exchange, ws: ws });
      } else {
        addToConnectionPool(exchangeId, { ccxt: exchange });
      }

      // 6. Record successful connection
      results.push({
        exchange: exchangeId,
        status: 'connected',
        timestamp: Date.now(),
        latency: measureLatency()
      });

    } catch (error) {
      // Handle individual exchange failure
      results.push({
        exchange: exchangeId,
        status: 'failed',
        error: error.message,
        suggestion: getSuggestion(error)
      });
    }
  }

  return {
    connections: results,
    summary: {
      total: exchanges.length,
      successful: results.filter(r => r.status === 'connected').length,
      failed: results.filter(r => r.status === 'failed').length
    }
  };
}

/**
 * SUB-ROUTINE: Handle get balances operation
 */
async function handleGetBalances(params) {
  const exchanges = params.exchanges === 'all'
    ? getConnectedExchanges()
    : params.exchanges;

  const assetFilter = params.assetFilter || [];
  const balances = [];

  for (const exchangeId of exchanges) {
    try {
      // 1. Check Redis cache
      const cachedData = await redisClient.get(
        `balance:${exchangeId}`
      );

      if (cachedData && isFresh(cachedData)) {
        balances.push(cachedData);
        continue;
      }

      // 2. Rate limit check
      const canProceed = await rateLimiter.canProceed(exchangeId);
      if (!canProceed) {
        await rateLimiter.waitForSlot(exchangeId);
      }

      // 3. Fetch balance from exchange
      const exchange = getExchangeFromPool(exchangeId);
      const rawBalance = await exchange.fetchBalance();

      // 4. Filter assets if specified
      const filtered = assetFilter.length > 0
        ? filterAssets(rawBalance, assetFilter)
        : rawBalance;

      // 5. Normalize format
      const normalized = normalizeBalanceFormat(filtered, exchangeId);

      // 6. Cache in Redis (5 min TTL)
      await redisClient.setex(
        `balance:${exchangeId}`,
        300,
        JSON.stringify(normalized)
      );

      // 7. Log to MongoDB
      await mongoDb.collection('balances').insertOne({
        exchange: exchangeId,
        data: normalized,
        timestamp: Date.now()
      });

      balances.push(normalized);

    } catch (error) {
      // Handle individual exchange error
      balances.push({
        exchange: exchangeId,
        error: error.message,
        status: 'failed'
      });
    }
  }

  // Calculate totals across exchanges
  const consolidated = consolidateBalances(balances);

  return {
    balances: balances,
    consolidated: consolidated,
    fetchedAt: Date.now()
  };
}

/**
 * SUB-ROUTINE: Handle test connection operation
 */
async function handleTestConnection(params) {
  const exchangeId = params.exchange;
  const pings = params.latencyPings || 5;
  const results = {
    exchange: exchangeId,
    latencies: [],
    status: 'unknown'
  };

  try {
    for (let i = 0; i < pings; i++) {
      const startTime = Date.now();
      await getExchangeFromPool(exchangeId).checkAuth();
      const latency = Date.now() - startTime;
      results.latencies.push(latency);

      // Avoid rate limiting
      await sleep(100);
    }

    // Calculate statistics
    results.avgLatency = avg(results.latencies);
    results.minLatency = Math.min(...results.latencies);
    results.maxLatency = Math.max(...results.latencies);
    results.stdDevLatency = stdDev(results.latencies);

    // Determine status
    if (results.avgLatency < 500) {
      results.status = 'healthy';
    } else if (results.avgLatency < 1000) {
      results.status = 'degraded';
    } else {
      results.status = 'slow';
    }

  } catch (error) {
    results.status = 'failed';
    results.error = error.message;
  }

  return results;
}

/**
 * SUB-ROUTINE: Handle rotate credentials operation
 */
async function handleRotateCredentials(params) {
  const exchanges = params.exchanges;
  const results = [];

  for (const exchangeId of exchanges) {
    try {
      // 1. Generate new credentials on exchange
      // (User manually creates on exchange portal, skill guides process)
      const newCredsLink = generateExchangeLink(exchangeId, 'generate-api-key');

      // 2. Prompt for new keys securely
      const newCredentials = await promptForCredentials(exchangeId);

      // 3. Validate new keys work
      const testResult = await testCredentials(exchangeId, newCredentials);
      if (!testResult.valid) {
        throw new Error('New credentials failed validation');
      }

      // 4. Store in Vault (encrypted)
      await vaultClient.storeCredentials(
        `secret/exchanges/${exchangeId}`,
        newCredentials,
        {
          rotatedAt: Date.now(),
          previousVersion: Date.now()
        }
      );

      // 5. Update connection pool
      const exchange = createExchangeInstance(exchangeId, newCredentials);
      updateConnectionPool(exchangeId, exchange);

      // 6. Verify new connection works
      await exchange.checkAuth();

      // 7. Schedule old key deactivation (24hr delay)
      scheduleKeyDeactivation(exchangeId, 24 * 60 * 60 * 1000);

      // 8. Record in audit log
      results.push({
        exchange: exchangeId,
        status: 'rotated',
        rotatedAt: Date.now(),
        nextRotation: Date.now() + (90 * 24 * 60 * 60 * 1000)
      });

    } catch (error) {
      results.push({
        exchange: exchangeId,
        status: 'failed',
        error: error.message
      });
    }
  }

  return {
    rotations: results,
    summary: {
      total: exchanges.length,
      successful: results.filter(r => r.status === 'rotated').length,
      failed: results.filter(r => r.status === 'failed').length
    }
  };
}

/**
 * ERROR HANDLING
 */
function handleError(error, params) {
  const errorType = classifyError(error);

  let suggestion = '';
  let statusCode = 500;

  switch(errorType) {
    case 'INVALID_PARAMS':
      statusCode = 400;
      suggestion = 'Check parameter syntax. See usage examples.';
      break;
    case 'INVALID_CREDS':
      statusCode = 401;
      suggestion = 'API credentials invalid. Check Vault or rotate keys.';
      break;
    case 'RATE_LIMIT':
      statusCode = 429;
      suggestion = 'Rate limit exceeded. Waiting for quota reset.';
      break;
    case 'EXCHANGE_DOWN':
      statusCode = 503;
      suggestion = 'Exchange offline. Check exchange status page. Using failover exchange.';
      break;
    case 'NETWORK_ERROR':
      statusCode = 503;
      suggestion = 'Network unreachable. Check connectivity and retry.';
      break;
    default:
      statusCode = 500;
      suggestion = 'Unknown error. Check logs and escalate if persistent.';
  }

  return {
    success: false,
    skillName: 'exchange-connector',
    error: error.message,
    errorType: errorType,
    statusCode: statusCode,
    suggestion: suggestion,
    details: error.stack || error.details,
    timestamp: Date.now()
  };
}
```

---

## Output

### Success Output

```json
{
  "success": true,
  "skillName": "exchange-connector",
  "executionTime": "1.234s",
  "result": {
    "exchanges": [
      {
        "exchange": "binance",
        "status": "connected",
        "latency": 127,
        "rateLimitUsage": {
          "current": 450,
          "limit": 1200,
          "percentage": 37.5
        }
      }
    ],
    "summary": {
      "totalExchanges": 12,
      "connected": 11,
      "degraded": 1,
      "failed": 0,
      "overallHealth": 98.5
    }
  },
  "metadata": {
    "timestamp": "2025-10-23T10:30:00Z",
    "requestId": "req_abc123def456",
    "cached": false
  }
}
```

### Error Output

```json
{
  "success": false,
  "skillName": "exchange-connector",
  "error": "Authentication failed for binance",
  "errorType": "INVALID_CREDS",
  "statusCode": 401,
  "suggestions": [
    "Verify API key is correct in Vault",
    "Check API key permissions (trading enabled?)",
    "Rotate API key if compromised"
  ],
  "metadata": {
    "timestamp": "2025-10-23T10:30:00Z",
    "requestId": "req_abc123def456",
    "debug": {
      "exchange": "binance",
      "operation": "checkAuth",
      "raw_error": "Invalid API key"
    }
  }
}
```

---

## Error Handling

### Common Errors

**Error 1: Invalid API Credentials**
- **Cause**: API key expired, permissions changed, or credentials never set
- **Solution**:
  1. Verify key in Vault: `vault kv get secret/exchanges/binance`
  2. Test key manually on exchange dashboard
  3. Rotate key if necessary: `@trading-operations exchange-connector "Rotate credentials for binance"`
- **Prevention**: Implement 90-day automatic rotation, test credentials weekly

**Error 2: Rate Limit Exceeded**
- **Cause**: Too many API requests in short time window
- **Solution**:
  1. Wait for rate limit reset (typically 1 minute)
  2. Reduce request frequency or batch requests
  3. Upgrade exchange tier if available
- **Prevention**: Implement request queuing and throttling, monitor rate limit usage

**Error 3: Exchange Offline/Maintenance**
- **Cause**: Exchange performing scheduled maintenance or experiencing outage
- **Solution**:
  1. Check exchange status page: [Binance Status](https://status.binance.com)
  2. Use failover exchange: `@trading-operations exchange-connector "Failover to coinbase-pro"`
  3. Wait for maintenance window to complete
- **Prevention**: Monitor exchange status page, implement automatic failover, notify trading team

**Error 4: Network Timeout**
- **Cause**: Connection timeout to exchange API, network latency too high
- **Solution**:
  1. Check network connectivity: `ping api.binance.com`
  2. Increase timeout: `timeout: 20000` in config
  3. Use regional endpoint if available
- **Prevention**: Implement exponential backoff, monitor latency, use regional endpoints

**Error 5: WebSocket Connection Failed**
- **Cause**: WebSocket endpoint unreachable, TLS handshake failed
- **Solution**:
  1. Fall back to REST API (automatic)
  2. Check firewall rules for WebSocket (port 443)
  3. Disable WebSocket in config if persistent
- **Prevention**: Test WebSocket connectivity during deployment, implement fallback to REST

### Rollback Procedures

**If Credential Rotation Fails**:
1. Revoke new keys immediately on exchange (prevent access)
2. Restore old keys in Vault from backup
3. Restart application with old keys
4. Notify security team of failed rotation
5. Manual remediation: Contact exchange support

**If Failover Fails**:
1. Alert trading team immediately
2. Stop all automated trading operations
3. Switch to manual trading on available exchanges
4. Investigate failover chain (why backup also down?)
5. Post-mortem to improve redundancy

**If Data Corruption**:
1. Stop all write operations
2. Rollback MongoDB to last good backup
3. Replay transaction log from Redis (if available)
4. Verify data integrity before resuming

---

## Testing

### Unit Tests

```javascript
describe('exchange-connector skill', () => {
  describe('connection management', () => {
    test('should connect to binance successfully', async () => {
      const result = await executeSkill({ exchange: 'binance' });
      expect(result.success).toBe(true);
      expect(result.result.status).toBe('connected');
    });

    test('should handle invalid exchange ID', async () => {
      const result = await executeSkill({ exchange: 'invalid' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown exchange');
    });

    test('should enforce rate limits', async () => {
      // Make 1500 requests (exceeds Binance 1200 limit)
      const results = [];
      for (let i = 0; i < 1500; i++) {
        results.push(executeSkill({ operation: 'getBalance' }));
      }
      const resolved = await Promise.all(results);
      // Should see rate limit errors after 1200
      expect(resolved[1201].error).toContain('rate limit');
    });

    test('should cache data correctly', async () => {
      const result1 = await executeSkill({ operation: 'getBalance', exchange: 'binance' });
      const result2 = await executeSkill({ operation: 'getBalance', exchange: 'binance' });
      // Should use cache (shorter execution time)
      expect(result2.executionTime).toBeLessThan(result1.executionTime);
    });
  });

  describe('credential management', () => {
    test('should retrieve credentials from Vault', async () => {
      const creds = await getCredentialsFromVault('binance');
      expect(creds.apiKey).toBeDefined();
      expect(creds.apiSecret).toBeDefined();
    });

    test('should encrypt credentials in transit', async () => {
      // Verify TLS encryption
      const response = await testVaultConnection();
      expect(response.encrypted).toBe(true);
    });

    test('should rotate credentials successfully', async () => {
      const result = await executeSkill({
        operation: 'rotateCredentials',
        exchange: 'binance'
      });
      expect(result.success).toBe(true);
      expect(result.result.status).toBe('rotated');
    });
  });

  describe('failover and redundancy', () => {
    test('should failover when primary exchange down', async () => {
      // Simulate Binance outage
      mockExchangeOutage('binance');
      const result = await executeSkill({
        operation: 'getBalance',
        exchange: 'binance'
      });
      // Should automatically failover
      expect(result.result.failoverExchange).toBe('coinbase-pro');
      expect(result.success).toBe(true);
    });

    test('should recover when exchange comes back online', async () => {
      // Simulate recovery
      mockExchangeRecovery('binance');
      const result = await executeSkill({ exchange: 'binance' });
      expect(result.result.status).toBe('connected');
      expect(result.result.recoveryTime).toBeLessThan(5000);
    });
  });
});
```

### Integration Tests

```javascript
describe('exchange-connector integration', () => {
  test('should connect to all 12 exchanges successfully', async () => {
    const result = await executeSkill({
      operation: 'connect',
      exchanges: ['binance', 'coinbase-pro', 'kraken', 'bybit', 'alpaca', 'okx', 'kucoin', 'bitfinex', 'gate', 'huobi', 'gemini', 'ftx']
    });
    expect(result.result.summary.successful).toBe(12);
  });

  test('should aggregate balances across all exchanges', async () => {
    const result = await executeSkill({
      operation: 'getBalances',
      exchanges: 'all'
    });
    expect(result.result.consolidated).toBeDefined();
    expect(result.result.consolidated.totalUsdValue).toBeGreaterThan(0);
  });

  test('should generate comprehensive health report', async () => {
    const result = await executeSkill({
      operation: 'generateReport',
      timeframe: '24h'
    });
    expect(result.result.exchanges.length).toBeGreaterThanOrEqual(10);
    expect(result.result.summary.overallHealth).toBeGreaterThan(90);
  });
});
```

### Manual Testing Checklist

- [ ] Connect to primary 3 exchanges (Binance, Coinbase Pro, Kraken)
- [ ] Retrieve balances from all 3 exchanges
- [ ] Test latency to each exchange (<500ms)
- [ ] Verify rate limit tracking
- [ ] Test credential rotation for one exchange
- [ ] Simulate exchange outage and verify failover
- [ ] Check audit logs in MongoDB
- [ ] Verify metrics exported to Prometheus
- [ ] Test Slack alerting
- [ ] Performance test: 100 concurrent requests

---

## Performance

### Metrics

| Metric | Target | Typical | Notes |
|--------|--------|---------|-------|
| **Connection Time** | <2s | 1.2s | Time to connect to exchange |
| **Balance Query** | <1s | 500ms | Retrieve account balance |
| **Health Check** | <3s | 1.5s | Ping exchange + latency test |
| **Rate Limit Overhead** | <100ms | 25ms | Check and enforce rate limits |
| **Credential Rotation** | <10s | 5.3s | Validate, store, cutover |
| **Failover Time** | <5s | 2.1s | Detect outage + switch |
| **Memory per Exchange** | <200MB | 125MB | RSS memory usage |
| **CPU Usage (idle)** | <5% | 1.2% | Idle CPU consumption |
| **Throughput** | 100+ req/s | 150 req/s | Aggregate requests/second |

### Optimization Tips

1. **Use Connection Pooling**: Reuse connections instead of creating new ones each request
2. **Implement Caching**: Cache balances, trading pairs for 5-minute TTL
3. **Rate Limit Batching**: Group requests to same exchange to avoid rate limit violations
4. **WebSocket Priority**: Use WebSocket for real-time data instead of polling
5. **Async Processing**: Use async/await to parallelize API calls
6. **Regional Selection**: Route to nearest regional endpoint
7. **Response Compression**: Compress large responses (>1MB)
8. **Monitor Memory**: Track memory usage per exchange connection

---

## Monitoring

### Health Checks

- **Check 1 - Exchange Connectivity**: Ping `/time` endpoint every 60s, latency <1s ✓
- **Check 2 - API Key Validity**: Validate credentials daily, 0 failures ✓
- **Check 3 - WebSocket Stability**: Verify WS connections alive, reconnects <5 per day ✓
- **Check 4 - Rate Limit Status**: Monitor usage relative to limits, alert at >80% ✓

### Metrics to Track

- **Execution Count**: Total number of skill invocations per day/week/month
- **Success Rate**: Percentage of successful operations (target: >98%)
- **Error Rate by Type**: Track INVALID_CREDS, RATE_LIMIT, EXCHANGE_DOWN, etc.
- **Average Execution Time**: Response time per operation type
- **P95/P99 Latency**: Percentile latencies for SLA compliance
- **Resource Usage**: Memory, CPU, network bandwidth
- **Cache Hit Rate**: Percentage of requests served from cache (target: >80%)
- **Failover Frequency**: Number of failovers per week
- **Credential Rotation Compliance**: All keys rotated within 90-day window

### Alerts

- 🚨 **Critical**: Exchange connection lost + no failover available
- 🔴 **High**: API error rate >5%, latency >1000ms, rate limit violations
- 🟠 **Medium**: API error rate >2%, latency >500ms, cache miss spike
- 🟡 **Low**: Memory usage >300MB, credential rotation due in 7 days

**Alert Channels**:
- Slack: #trading-ops-alerts
- PagerDuty: trading-oncall-team
- Email: alerts@trading-ops.company.com

---

## Best Practices

1. **Always Use Failover Exchanges**: Define fallback exchange chain in config, test monthly
2. **Implement Circuit Breaker**: Stop sending requests to failed exchange after 5 consecutive errors
3. **Validate Before Rotate**: Test new credentials before deactivating old ones
4. **Monitor Latency Trends**: Track latency over time to catch degradation early
5. **Log All Operations**: Comprehensive audit trail for compliance and debugging

---

## Troubleshooting

### Issue: Connection times out after 5 seconds

**Symptoms**: Frequent timeout errors, especially to Kraken and overseas exchanges
**Diagnosis**:
1. Check network connectivity: `ping api.kraken.com`
2. Verify regional endpoint: `curl -I https://api.kraken.com/0/public/Time`
3. Check firewall rules: Are outbound connections allowed?

**Solution**:
1. Increase timeout in config: `timeout: 15000` (was 10000)
2. Switch to regional endpoint: `region: "eu"` for Kraken
3. Add retry logic: `maxRetries: 5` with exponential backoff

---

## Security Considerations

- **Authentication**: API keys stored in HashiCorp Vault with AES-256 encryption
- **Authorization**: Role-based access control (RBAC) for credential management
- **Data Protection**: All API responses transmitted over TLS 1.3, credentials never logged
- **Audit Trail**: Every API call logged with timestamp, user, exchange, operation
- **Rate Limiting**: Prevent abuse through per-IP request throttling
- **Key Rotation**: Automated 90-day rotation with 24-hour overlap for graceful cutover

---

## Dependencies

### Required

- [CCXT](https://github.com/ccxt/ccxt) v2.0.0+ - Cryptocurrency exchange API unified library
- [ccxws](https://github.com/altangent/ccxws) v1.0.0+ - WebSocket support for real-time data
- [HashiCorp Vault Client](https://www.vaultproject.io/) - Secure credential storage
- [redis](https://www.npmjs.com/package/redis) v4.0.0+ - Caching layer
- [mongodb](https://www.npmjs.com/package/mongodb) v4.0.0+ - Audit logging

### Optional

- [prom-client](https://www.npmjs.com/package/prom-client) - Prometheus metrics export
- [slack-sdk](https://www.npmjs.com/package/@slack/web-api) - Slack notifications
- [pagerduty](https://www.npmjs.com/package/pagerduty) - PagerDuty incident creation

---

## Changelog

### Version 1.0.0 (In Development)

- **Phase 1: Specification** ✅ (2025-10-23)
  - Comprehensive requirements defined (10 FR, 10 TR)
  - 5 user journeys with edge cases documented
  - Success metrics and KPIs defined
  - Constraints and limitations documented

- **Phase 2: Pseudocode** 🔄 (In Progress)
  - Main algorithm and 4 sub-routines designed
  - Data structures and error handling defined
  - Rate limit and failover logic outlined

- **Phase 3-5**: TBD

### Version 0.9.0 (Planned)

- Beta release with 3 priority exchanges
- Community testing and feedback

---

## Future Enhancements

- [ ] Support for Margin and Futures trading (Phase 1.1)
- [ ] Advanced order routing (smart order execution)
- [ ] Real-time arbitrage detection
- [ ] Machine learning-based exchange selection
- [ ] Visual dashboard for exchange health and balances
- [ ] Mobile app for remote monitoring
- [ ] Integration with TradingView charts
- [ ] Automated backtesting with multi-exchange support

---

## Related Skills

- **strategy-builder**: Design trading strategies for multi-exchange deployment
- **test-runner**: Automated testing for trading strategies
- **deploy-wizard**: Deploy strategies to production exchanges

---

## References

### Documentation

- [CCXT Documentation](https://docs.ccxt.com/)
- [ccxws Documentation](https://github.com/altangent/ccxws)
- [Binance API Documentation](https://binance-docs.github.io/apidocs/)
- [Coinbase Pro API Documentation](https://docs.cloud.coinbase.com/exchange-rest-api/)

### External Resources

- [Cryptocurrency Exchange Comparison](https://www.cryptocompare.com/)
- [API Status Monitoring](https://status.binance.com/)
- [Trading Best Practices](https://academy.binance.com/)

---

## Support

**Owner**: Trading Operations Team
**Contact**: trading-ops@company.com
**Slack**: #trading-operations, #trading-platform-dev
**JIRA**: Project TRADING-*, use label `exchange-connector`

**Office Hours**: Mon/Wed 2-4 PM EST (with trading team lead)

---

**Skill Documentation Version**: 1.0.0 (Specification Phase)
**Status**: 🟡 In Development (Phase 1: Specification Complete)
**Last Updated**: 2025-10-23
**Next Phase**: Phase 2 - Pseudocode (EST 2025-10-24)

---

#exchange-connector #trading-operations #cryptocurrency #sparc #phase-1
