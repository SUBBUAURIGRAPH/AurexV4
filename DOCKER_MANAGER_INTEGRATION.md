# Docker Manager Integration Guide
## Multi-Skill Orchestration & Deployment

**Document Version**: 1.0.0
**Status**: Production Ready
**Last Updated**: December 27, 2025
**Scope**: Comprehensive guide for integrating Docker Manager with Exchange Connector and Strategy Builder skills

---

## TABLE OF CONTENTS

1. [Overview](#overview)
2. [Architecture Overview](#architecture-overview)
3. [Exchange Connector Integration](#exchange-connector-integration)
4. [Strategy Builder Integration](#strategy-builder-integration)
5. [Multi-Skill Workflows](#multi-skill-workflows)
6. [Deployment Patterns](#deployment-patterns)
7. [Configuration Management](#configuration-management)
8. [Auto-Scaling Strategies](#auto-scaling-strategies)
9. [Monitoring & Observability](#monitoring--observability)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)
12. [Examples](#examples)

---

## OVERVIEW

### Purpose

The Docker Manager skill provides enterprise-grade container orchestration for Aurigraph v2.1.0, enabling seamless integration of the Exchange Connector and Strategy Builder skills through:

- **Containerized Deployment**: Package strategies and connectors as immutable containers
- **Service Orchestration**: Manage multi-service deployments with dependency tracking
- **Intelligent Scaling**: Automatically scale based on trading volume and computational load
- **Configuration Management**: Centralized, encrypted configuration for all services
- **Health Monitoring**: Real-time metrics collection and alerting
- **Deployment Automation**: Multiple strategies for zero-downtime deployments

### Integration Goals

1. **Seamless Skill Coordination**: Docker Manager orchestrates Exchange Connector and Strategy Builder
2. **Automated Deployments**: Zero-downtime updates to live trading systems
3. **Resource Optimization**: Intelligent auto-scaling based on market conditions
4. **Security**: Encrypted credentials and configuration management
5. **Observability**: Complete visibility into all services and operations
6. **Resilience**: Automatic recovery and failover capabilities

---

## ARCHITECTURE OVERVIEW

### Aurigraph Multi-Skill Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Aurigraph Platform v2.1.0                │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │  Exchange        │  │  Strategy        │  │  Docker    │ │
│  │  Connector Skill │  │  Builder Skill   │  │  Manager   │ │
│  │                  │  │                  │  │  Skill     │ │
│  │ • Connect to     │  │ • Design         │  │ • Manage   │ │
│  │   exchanges      │  │   strategies     │  │   containers│
│  │ • Fetch market   │  │ • Backtest       │  │ • Deploy   │
│  │   data           │  │ • Optimize       │  │   services │
│  │ • Execute trades │  │ • Validate rules │  │ • Scale    │
│  └──────────────────┘  └──────────────────┘  │ • Monitor  │
│          │                      │              └────────────┘
│          └──────────────────────┼──────────────────┘
│                                 │
│  ┌──────────────────────────────▼──────────────────┐
│  │          Docker Container Orchestration         │
│  │                                                  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │  │ Connector   │  │ Strategy    │  │ Monitor │ │
│  │  │ Containers  │  │ Containers  │  │ Stack   │ │
│  │  │             │  │             │  │         │ │
│  │  │ • Binance   │  │ • Golden    │  │ • Prom  │ │
│  │  │ • Kraken    │  │   Cross     │  │ • Grafana
│  │  │ • Coinbase  │  │ • RSI       │  │ • Alert │ │
│  │  └─────────────┘  └─────────────┘  └─────────┘ │
│  │                                                  │
│  └──────────────────────────────────────────────────┘
│                      │
│  ┌──────────────────▼──────────────────┐
│  │  Persistence & Messaging Layer      │
│  │                                      │
│  │  ┌──────────┐  ┌──────────────┐    │
│  │  │PostgreSQL│  │Redis/Message │    │
│  │  │Database  │  │Queue         │    │
│  │  └──────────┘  └──────────────┘    │
│  └──────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────────┘
```

### Service Dependencies

```
Strategy Builder Service
    ↓ depends on
Exchange Connector Service
    ↓ depends on
External Exchange APIs
    ↓
Docker Manager Monitoring
    ↓
Health Checks & Alerts
```

---

## EXCHANGE CONNECTOR INTEGRATION

### Overview

The Exchange Connector skill provides real-time market data and trade execution. Docker Manager enables:

- **Containerized Connectors**: Each exchange connector runs in isolated containers
- **Horizontal Scaling**: Add new connector instances for increased throughput
- **Credential Management**: Secure storage of exchange API keys
- **Health Monitoring**: Track connector health and exchange connectivity
- **Auto-Recovery**: Automatic restart on failures

### Deployment Configuration

```typescript
import { DeploymentOrchestrator } from './skills/docker-manager';
import { DeploymentStrategy } from './skills/docker-manager/types';

// Deploy Binance Exchange Connector
const binanceDeployment = {
  serviceId: 'exchange-binance',
  serviceName: 'Binance Exchange Connector',
  image: 'aurigraph:exchange-connector-latest',
  version: '2.1.0',
  strategy: DeploymentStrategy.ROLLING, // Update one at a time
  replicas: 3, // Three concurrent connections

  environment: {
    EXCHANGE: 'binance',
    API_KEY_ENCRYPTED: process.env.BINANCE_API_KEY,
    API_SECRET_ENCRYPTED: process.env.BINANCE_API_SECRET,
    SANDBOX_MODE: 'false',
  },

  resources: {
    cpuLimit: 1000,        // 1 CPU core
    memoryLimit: 1073741824, // 1GB RAM
    cpuRequest: 500,       // Request 0.5 CPU
    memoryRequest: 536870912, // Request 512MB
  },

  healthCheck: {
    type: 'http',
    endpoint: '/health/exchange',
    interval: 10000,  // Check every 10 seconds
    timeout: 5000,    // 5 second timeout
    retries: 3,       // Restart after 3 failures
  },

  restartPolicy: {
    name: 'unless-stopped',
    maximumRetryCount: 5,
  },
};

const result = await orchestrator.deployService(binanceDeployment);
```

### API Key Management

**Secure API Key Storage**:

```typescript
import { ConfigurationManager } from './skills/docker-manager';

const configManager = new ConfigurationManager(logger);

// Store encrypted API credentials
const credentialsId = await configManager.setConfiguration(
  'exchange-credentials',
  {
    binance: {
      apiKey: process.env.BINANCE_API_KEY,
      apiSecret: process.env.BINANCE_API_SECRET,
      testnet: false,
    },
    kraken: {
      apiKey: process.env.KRAKEN_API_KEY,
      apiSecret: process.env.KRAKEN_API_SECRET,
      tier: 'intermediate',
    },
  },
  {
    isSecret: true,
    description: 'Encrypted exchange API credentials',
    tags: ['production', 'credentials'],
  }
);

// Retrieve credentials (automatically decrypted)
const credentials = await configManager.getConfiguration('exchange-credentials', true);
```

### Connector Scaling

```typescript
import { AutoScaler } from './skills/docker-manager';

const autoScaler = new AutoScaler(containerManager, registry, monitor, logger);

// Register scaling policy based on API usage
await autoScaler.registerScalingPolicy('exchange-binance', {
  minReplicas: 1,
  maxReplicas: 5,

  scaleUpThreshold: {
    cpu: 70,     // Scale up if CPU > 70%
    memory: 75,  // OR memory > 75%
  },

  scaleDownThreshold: {
    cpu: 30,
    memory: 30,
  },

  scaleUpIncrement: 1,      // Add 1 container
  scaleDownIncrement: 1,    // Remove 1 container
  cooldownPeriodMinutes: 5, // Wait 5 min between scaling
  enabled: true,
});

// Start automatic scaling
await autoScaler.startAutoScaling('exchange-binance', 30000); // Evaluate every 30 seconds
```

### Monitoring Exchange Connectors

```typescript
import { ContainerMonitor } from './skills/docker-manager';

const monitor = new ContainerMonitor(containerManager, logger);

// Monitor a connector instance
await monitor.monitorContainer('exchange-binance-1', 5000);

// Get current metrics
const metrics = await monitor.getMetrics('exchange-binance-1');
console.log(`CPU: ${metrics.cpu.usage}%, Memory: ${metrics.memory.percentageUsed}%`);

// Set alerts for critical conditions
await monitor.setAlert('exchange-binance-1', {
  id: 'api-latency-alert',
  condition: 'memory > 85',
  level: 'critical',
  actions: [
    {
      type: 'slack',
      target: '#alerts',
    },
    {
      type: 'pagerduty',
      target: 'trading-on-call',
    },
  ],
  enabled: true,
});
```

---

## STRATEGY BUILDER INTEGRATION

### Overview

The Strategy Builder skill enables backtesting and optimization of trading strategies. Docker Manager provides:

- **Isolated Execution Environments**: Each backtest runs in a clean container
- **Resource-Constrained Backtests**: Prevent runaway processes from consuming system resources
- **Parallel Backtesting**: Run multiple backtests simultaneously
- **Result Persistence**: Store backtest results for comparison and analysis
- **Automated Deployment**: Deploy validated strategies to production

### Backtest Execution

```typescript
// Deploy strategy backtester service
const backtesterDeployment = {
  serviceId: 'strategy-backtester',
  serviceName: 'Strategy Backtester',
  image: 'aurigraph:strategy-builder-latest',
  version: '2.1.0',

  // Use RECREATE strategy - each backtest gets fresh container
  strategy: DeploymentStrategy.RECREATE,
  replicas: 1, // One backtest at a time (can scale to 4-5 parallel)

  environment: {
    EXECUTION_MODE: 'backtest',
    DATA_SOURCE: 'postgresql',
    OPTIMIZATION_ENGINE: 'bayesian',
  },

  resources: {
    cpuLimit: 4000,        // 4 CPU cores for heavy computation
    memoryLimit: 4294967296, // 4GB for historical data
    cpuRequest: 2000,
    memoryRequest: 2147483648,
  },

  healthCheck: {
    type: 'http',
    endpoint: '/health/backtest',
    interval: 30000,  // Less frequent checks (long operations)
    timeout: 10000,
    retries: 2,
  },
};

await orchestrator.deployService(backtesterDeployment);
```

### Strategy Validation & Deployment

```typescript
import { ServiceRegistry } from './skills/docker-manager';
import { DeploymentStrategy } from './skills/docker-manager/types';

const registry = new ServiceRegistry(logger);

// Register a validated strategy for deployment
const strategyServiceId = await registry.registerService({
  id: 'strategy-golden-cross-v2',
  name: 'Golden Cross v2',
  version: '2.1.0',
  type: 'strategy',
  image: 'aurigraph:strategy-executor:golden-cross-v2',
  replicas: 2, // Two parallel executors
  desiredReplicas: 2,
  status: 'pending',

  healthCheck: {
    type: 'http',
    endpoint: '/health/strategy',
    interval: 5000,
    timeout: 2000,
    retries: 3,
  },

  environment: {
    STRATEGY_ID: 'golden-cross-v2',
    MARKETS: 'BTC/USDT,ETH/USDT,ADA/USDT',
    EXECUTION_MODE: 'live',
  },

  dependencies: ['exchange-binance'], // Depends on exchange connector

  resources: {
    cpuLimit: 2000,
    memoryLimit: 2147483648,
  },

  metadata: {
    backtest: {
      totalReturn: 0.287,      // 28.7% return
      sharpeRatio: 1.85,       // Risk-adjusted return
      maxDrawdown: -0.12,      // Maximum loss
      winRate: 0.62,           // 62% winning trades
    },
  },

  createdAt: new Date(),
  updatedAt: new Date(),
});

// Deploy the strategy
const deploymentResult = await orchestrator.deployService({
  serviceId: 'strategy-golden-cross-v2',
  serviceName: 'Golden Cross v2',
  image: 'aurigraph:strategy-executor:golden-cross-v2',
  version: '2.1.0',
  strategy: DeploymentStrategy.BLUE_GREEN, // Zero-downtime deployment
  replicas: 2,
  // ... rest of configuration
});
```

### Parallel Backtesting

```typescript
// Run multiple backtests in parallel
const backtests = [
  {
    strategyId: 'golden-cross',
    parameters: { fastPeriod: 12, slowPeriod: 26 },
    startDate: '2023-01-01',
    endDate: '2023-12-31',
  },
  {
    strategyId: 'rsi',
    parameters: { period: 14, oversoldThreshold: 30, overboughtThreshold: 70 },
    startDate: '2023-01-01',
    endDate: '2023-12-31',
  },
  {
    strategyId: 'macd',
    parameters: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    startDate: '2023-01-01',
    endDate: '2023-12-31',
  },
];

// Deploy backtester with multiple replicas for parallel execution
const backtesterServiceId = 'strategy-backtester-parallel';

// Scale to 3 parallel backtests
await autoScaler.registerScalingPolicy(backtesterServiceId, {
  minReplicas: 1,
  maxReplicas: 5,
  scaleUpThreshold: { cpu: 60 },
  scaleDownThreshold: { cpu: 20 },
  cooldownPeriodMinutes: 2,
  enabled: true,
});

// Execute backtests
const backtest results = await Promise.all(
  backtests.map((backtest) =>
    orchestrator.deployService({
      serviceId: `backtest-${backtest.strategyId}-${Date.now()}`,
      serviceName: `Backtest ${backtest.strategyId}`,
      image: 'aurigraph:strategy-backtester',
      environment: {
        STRATEGY: JSON.stringify(backtest),
      },
      resources: {
        cpuLimit: 4000,
        memoryLimit: 4294967296,
      },
      // ... rest of configuration
    })
  )
);
```

### Strategy Performance Monitoring

```typescript
// Monitor strategy execution
await monitor.monitorContainer('strategy-golden-cross-v2', 5000);

// Get strategy metrics
const strategyMetrics = await monitor.getMetrics('strategy-golden-cross-v2');

// Set performance-based alerts
await monitor.setAlert('strategy-golden-cross-v2', {
  id: 'performance-alert',
  condition: 'cpu > 80 for 5m', // Alert if CPU high for 5 min
  level: 'warning',
  actions: [
    {
      type: 'slack',
      target: '#trading-ops',
    },
  ],
  enabled: true,
});

// Get statistics
const stats = await monitor.getMetricsStatistics('strategy-golden-cross-v2');
console.log(`Avg CPU: ${stats.avgCpu}%, Max CPU: ${stats.maxCpu}%`);
```

---

## MULTI-SKILL WORKFLOWS

### Complete Trading Workflow

```
1. Exchange Connector
   ├─ Connect to Binance, Kraken, Coinbase
   ├─ Fetch OHLCV data (1h, 4h, daily)
   ├─ Subscribe to trade stream updates
   └─ Maintain order book

2. Strategy Builder (Parallel)
   ├─ Analyze market conditions
   ├─ Generate trading signals
   ├─ Calculate position size
   └─ Validate rules

3. Exchange Connector (Execution)
   ├─ Place limit orders
   ├─ Manage positions
   ├─ Handle fills and rejections
   └─ Track P&L

4. Docker Manager (Monitoring)
   ├─ Monitor all services
   ├─ Track metrics
   ├─ Trigger alerts
   └─ Auto-scale as needed
```

### Example: End-to-End Setup

```typescript
import {
  DeploymentOrchestrator,
  ServiceRegistry,
  ContainerMonitor,
  AutoScaler,
  ConfigurationManager,
} from './skills/docker-manager';

// Initialize managers
const registry = new ServiceRegistry(logger);
const orchestrator = new DeploymentOrchestrator(registry, containerManager, logger);
const monitor = new ContainerMonitor(containerManager, logger);
const autoScaler = new AutoScaler(containerManager, registry, monitor, logger);
const configManager = new ConfigurationManager(logger);

// 1. Store credentials
const credentialsId = await configManager.setConfiguration(
  'trading-credentials',
  {
    binance: { apiKey: process.env.BINANCE_KEY, apiSecret: process.env.BINANCE_SECRET },
    strategies: { apiKey: process.env.STRATEGY_KEY },
  },
  { isSecret: true }
);

// 2. Deploy exchange connectors
const exchanges = ['binance', 'kraken', 'coinbase'];
for (const exchange of exchanges) {
  await orchestrator.deployService({
    serviceId: `exchange-${exchange}`,
    serviceName: `${exchange.toUpperCase()} Connector`,
    image: `aurigraph:exchange-connector-${exchange}:latest`,
    version: '2.1.0',
    strategy: DeploymentStrategy.ROLLING,
    replicas: 2,
    environment: {
      EXCHANGE: exchange,
      CREDENTIALS_ID: credentialsId,
    },
    resources: { cpuLimit: 1000, memoryLimit: 1073741824 },
    healthCheck: {
      type: 'http',
      endpoint: '/health/exchange',
      interval: 10000,
      timeout: 5000,
      retries: 3,
    },
  });

  // Set up auto-scaling for this connector
  await autoScaler.registerScalingPolicy(`exchange-${exchange}`, {
    minReplicas: 2,
    maxReplicas: 5,
    scaleUpThreshold: { cpu: 70, memory: 75 },
    scaleDownThreshold: { cpu: 30, memory: 30 },
    cooldownPeriodMinutes: 5,
    enabled: true,
  });

  await autoScaler.startAutoScaling(`exchange-${exchange}`);
}

// 3. Deploy strategy executor
await orchestrator.deployService({
  serviceId: 'strategy-golden-cross',
  serviceName: 'Golden Cross Strategy',
  image: 'aurigraph:strategy-executor:golden-cross:latest',
  version: '2.1.0',
  strategy: DeploymentStrategy.BLUE_GREEN,
  replicas: 2,
  dependencies: ['exchange-binance', 'exchange-kraken'], // Requires these to be running
  environment: {
    STRATEGY_ID: 'golden-cross-v2',
    MARKETS: 'BTC/USDT,ETH/USDT',
    EXECUTION_MODE: 'live',
  },
  resources: { cpuLimit: 2000, memoryLimit: 2147483648 },
  healthCheck: {
    type: 'http',
    endpoint: '/health/strategy',
    interval: 5000,
    timeout: 2000,
    retries: 3,
  },
});

// 4. Set up monitoring
for (const service of ['exchange-binance', 'exchange-kraken', 'strategy-golden-cross']) {
  await monitor.monitorContainer(service, 5000);

  await monitor.setAlert(service, {
    id: `${service}-critical-alert`,
    condition: 'cpu > 90 or memory > 90',
    level: 'critical',
    actions: [
      { type: 'slack', target: '#trading-alerts' },
      { type: 'pagerduty', target: 'trading-on-call' },
    ],
    enabled: true,
  });
}

console.log('Multi-skill trading system deployed and running!');
```

---

## DEPLOYMENT PATTERNS

### 1. Blue-Green Deployment (Zero-Downtime)

Used for strategy updates that require careful coordination:

```typescript
const deployment = {
  serviceId: 'strategy-executor',
  strategy: DeploymentStrategy.BLUE_GREEN,
  replicas: 2,
  // ...
};

// Process:
// 1. Create new (green) containers with new version
// 2. Run health checks on green containers
// 3. Switch traffic from blue to green
// 4. Keep blue containers for quick rollback
// 5. After validation, stop blue containers
```

### 2. Canary Deployment (Gradual Rollout)

Used for risky strategy updates:

```typescript
const deployment = {
  serviceId: 'strategy-executor',
  strategy: DeploymentStrategy.CANARY,
  canaryReplicas: 1,      // Start with 1 out of 4 containers
  canaryPercentage: 25,   // 25% of traffic

  steps: [
    { replicas: 1, duration: 300000 }, // 5 min with 1 container
    { replicas: 2, duration: 600000 }, // 10 min with 2 containers
    { replicas: 3, duration: 600000 }, // 10 min with 3 containers
    { replicas: 4, duration: 0 },      // Finally full scale
  ],
};
```

### 3. Rolling Deployment (Standard Updates)

Used for connector updates:

```typescript
const deployment = {
  serviceId: 'exchange-binance',
  strategy: DeploymentStrategy.ROLLING,
  replicas: 4,
  maxUnavailable: 1, // Ensure max 1 container down

  // Process:
  // 1. Stop 1 container
  // 2. Start new version
  // 3. Health check new version
  // 4. Move to next container
  // 5. Repeat until all updated
};
```

### 4. Recreate Deployment (Stateless)

Used for backtests:

```typescript
const deployment = {
  serviceId: 'strategy-backtester',
  strategy: DeploymentStrategy.RECREATE,

  // Process:
  // 1. Stop all containers
  // 2. Start new containers
  // 3. Wait for health checks
};
```

---

## CONFIGURATION MANAGEMENT

### Multi-Environment Setup

```typescript
// Development environment
const devConfigId = await configManager.setConfiguration(
  'trading-env-dev',
  {
    environment: 'development',
    exchanges: ['binance-testnet'],
    strategies: ['golden-cross-v1'],
    logLevel: 'debug',
    resources: {
      minReplicas: 1,
      maxReplicas: 2,
    },
  },
  { tags: ['environment', 'development'] }
);

// Staging environment
const stagingConfigId = await configManager.setConfiguration(
  'trading-env-staging',
  {
    environment: 'staging',
    exchanges: ['binance', 'kraken'],
    strategies: ['golden-cross-v2', 'rsi-v1'],
    logLevel: 'info',
    resources: {
      minReplicas: 2,
      maxReplicas: 5,
    },
  },
  { tags: ['environment', 'staging'] }
);

// Production environment
const prodConfigId = await configManager.setConfiguration(
  'trading-env-prod',
  {
    environment: 'production',
    exchanges: ['binance', 'kraken', 'coinbase'],
    strategies: ['golden-cross-v2', 'rsi-v1', 'macd-v1'],
    logLevel: 'warn',
    resources: {
      minReplicas: 3,
      maxReplicas: 10,
    },
  },
  { isSecret: false, tags: ['environment', 'production'] }
);

// Load configuration based on environment
const currentEnv = process.env.NODE_ENV || 'development';
const envConfig = await configManager.getConfiguration(`trading-env-${currentEnv}`);
```

### Hot Configuration Updates

```typescript
// Subscribe to configuration changes
const unsubscribe = await configManager.subscribeToUpdates(
  'trading-env-prod',
  async (event) => {
    console.log(`Configuration updated: ${event.changesSummary}`);

    // Hot reload without restarting services
    const newConfig = await configManager.getConfiguration('trading-env-prod');

    // Update running strategy containers
    for (const container of runningStrategies) {
      container.updateConfiguration(newConfig);
    }
  }
);

// Update configuration (will trigger subscription callbacks)
await configManager.setConfiguration(
  'trading-env-prod',
  {
    ...existingConfig,
    strategies: [...existingConfig.strategies, 'macd-v1'],
  },
  { createdBy: 'admin' }
);
```

---

## AUTO-SCALING STRATEGIES

### Market-Responsive Scaling

```typescript
// Scale based on trading volume
await autoScaler.registerScalingPolicy('strategy-executor', {
  minReplicas: 1,
  maxReplicas: 10,

  // Scale up when CPU or memory high
  scaleUpThreshold: {
    cpu: 70,
    memory: 75,
  },

  // Scale down when idle
  scaleDownThreshold: {
    cpu: 30,
    memory: 30,
  },

  // Scale in steps
  scaleUpIncrement: 2,   // Add 2 containers when needed
  scaleDownIncrement: 1, // Remove 1 container when idle

  // Wait between scaling operations
  cooldownPeriodMinutes: 5,

  enabled: true,
});

await autoScaler.startAutoScaling('strategy-executor', 10000); // Check every 10 sec
```

### Schedule-Based Scaling

```typescript
// Pre-market scaling (implemented at application level)
const scheduleScaling = async () => {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Scale up before market open (9:30 EST = 14:30 UTC)
  if (hour === 14 && day >= 1 && day <= 5) {
    await autoScaler.executeScaling('strategy-executor', {
      targetReplicas: 8,
      reason: 'Market opening soon',
      confidence: 0.95,
    });
  }

  // Scale down after market close (4:00 PM EST = 21:00 UTC)
  if (hour === 21 && day >= 1 && day <= 5) {
    await autoScaler.executeScaling('strategy-executor', {
      targetReplicas: 2,
      reason: 'Market closed',
      confidence: 0.95,
    });
  }

  // Minimal replicas on weekends
  if (day === 0 || day === 6) {
    await autoScaler.executeScaling('strategy-executor', {
      targetReplicas: 1,
      reason: 'Weekend',
      confidence: 1.0,
    });
  }
};

// Run scaling checks every hour
setInterval(scheduleScaling, 3600000);
```

---

## MONITORING & OBSERVABILITY

### Comprehensive Metrics Collection

```typescript
// Monitor all services
const services = await registry.listServices();

for (const service of services) {
  const containerIds = service.metadata?.containerIds || [];

  for (const containerId of containerIds) {
    await monitor.monitorContainer(containerId, 5000); // Every 5 seconds
  }
}

// Collect metrics
const systemMetrics = {
  timestamp: new Date(),
  services: {},
};

for (const service of services) {
  const history = service.metadata?.containerIds || [];
  let totalCpu = 0;
  let totalMemory = 0;
  let containerCount = 0;

  for (const containerId of history) {
    const metrics = await monitor.getMetrics(containerId);
    if (metrics) {
      totalCpu += metrics.cpu.usage;
      totalMemory += metrics.memory.percentageUsed;
      containerCount++;
    }
  }

  systemMetrics.services[service.id] = {
    avgCpu: containerCount > 0 ? totalCpu / containerCount : 0,
    avgMemory: containerCount > 0 ? totalMemory / containerCount : 0,
    replicas: containerCount,
  };
}

console.log('System Metrics:', systemMetrics);
```

### Alert Management

```typescript
// CPU alert
await monitor.setAlert('strategy-executor', {
  id: 'cpu-high',
  condition: 'cpu > 85',
  level: 'critical',
  actions: [
    { type: 'slack', target: '#alerts' },
    { type: 'pagerduty', target: 'on-call' },
  ],
  enabled: true,
});

// Memory alert
await monitor.setAlert('exchange-connector', {
  id: 'memory-leak',
  condition: 'memory > 90',
  level: 'critical',
  actions: [
    { type: 'webhook', target: 'https://monitoring.example.com/alerts' },
  ],
  enabled: true,
});

// Deployment alert
await monitor.setAlert('strategy-golden-cross', {
  id: 'health-check-failed',
  condition: 'unhealthy',
  level: 'critical',
  actions: [
    { type: 'slack', target: '#trading-ops' },
    { type: 'pagerduty', target: 'trading-on-call' },
  ],
  enabled: true,
});
```

---

## BEST PRACTICES

### 1. Service Dependency Management

✅ **DO**: Define clear dependencies between services
```typescript
const strategyService = await registry.registerService({
  // ...
  dependencies: [
    { serviceId: 'exchange-binance', required: true },  // Strong dependency
    { serviceId: 'data-cache', required: false },       // Weak dependency
  ],
});
```

❌ **DON'T**: Create circular dependencies or rely on startup order

### 2. Resource Limits

✅ **DO**: Set appropriate resource limits
```typescript
const deployment = {
  resources: {
    cpuLimit: 2000,          // Hard limit
    cpuRequest: 1000,        // Minimum guaranteed
    memoryLimit: 2147483648, // Hard limit
    memoryRequest: 1073741824, // Minimum guaranteed
  },
};
```

### 3. Health Checks

✅ **DO**: Implement proper health check endpoints
```typescript
// Application level
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date(),
  };
  res.json(health);
});
```

### 4. Credential Management

✅ **DO**: Use ConfigurationManager for all secrets
```typescript
const credentialsId = await configManager.setConfiguration(
  'api-keys',
  { apiKey: '...', apiSecret: '...' },
  { isSecret: true } // Encrypted with AES-256-GCM
);
```

❌ **DON'T**: Hardcode credentials or pass as plain environment variables

### 5. Deployment Safety

✅ **DO**: Use Blue-Green for critical services
✅ **DO**: Use Canary for risky updates
✅ **DO**: Always have rollback capability

---

## TROUBLESHOOTING

### Service Won't Start

**Symptoms**: Service container fails to start or crashes immediately

**Diagnosis**:
1. Check logs: `docker logs <container-id>`
2. Verify resource availability: `docker stats`
3. Check health endpoint: `curl http://container:port/health`

**Solutions**:
- Increase memory/CPU limits
- Check for hard dependencies
- Verify configuration is correct

### High CPU Usage

**Symptoms**: Service using 80%+ CPU consistently

**Solutions**:
1. Check application logs for infinite loops
2. Profile the service: `docker exec <id> npm run profile`
3. Scale up: increase replicas
4. Optimize configuration

### Database Connection Issues

**Solutions**:
1. Verify PostgreSQL is running
2. Check connection string in configuration
3. Verify network connectivity
4. Check connection pool settings

---

## EXAMPLES

### Example 1: Multi-Exchange Trading System

```typescript
// Deploy Binance + Kraken + Coinbase with auto-scaling
const exchanges = [
  { name: 'binance', priority: 1, maxReplicas: 5 },
  { name: 'kraken', priority: 2, maxReplicas: 4 },
  { name: 'coinbase', priority: 3, maxReplicas: 3 },
];

for (const exchange of exchanges) {
  // Deploy connector
  await orchestrator.deployService({
    serviceId: `exchange-${exchange.name}`,
    serviceName: `${exchange.name.toUpperCase()} Connector`,
    image: `aurigraph:exchange-${exchange.name}`,
    version: '2.1.0',
    replicas: 2,
    strategy: DeploymentStrategy.ROLLING,
    // ... rest of config
  });

  // Register scaling policy
  await autoScaler.registerScalingPolicy(`exchange-${exchange.name}`, {
    minReplicas: 1,
    maxReplicas: exchange.maxReplicas,
    scaleUpThreshold: { cpu: 70 },
    scaleDownThreshold: { cpu: 30 },
    cooldownPeriodMinutes: 5,
    enabled: true,
  });
}

// Deploy strategy that uses all exchanges
await orchestrator.deployService({
  serviceId: 'strategy-multi-exchange',
  serviceName: 'Multi-Exchange Arbitrage',
  image: 'aurigraph:strategy-arbitrage',
  replicas: 3,
  dependencies: [
    { serviceId: 'exchange-binance', required: true },
    { serviceId: 'exchange-kraken', required: true },
    { serviceId: 'exchange-coinbase', required: false },
  ],
  // ... rest of config
});
```

### Example 2: Backtest Pipeline

```typescript
// Run multiple backtests in parallel
const backtestConfigs = [
  { strategy: 'golden-cross', parameters: { fast: 12, slow: 26 } },
  { strategy: 'rsi', parameters: { period: 14 } },
  { strategy: 'macd', parameters: { fast: 12, slow: 26, signal: 9 } },
];

// Scale backtester for parallel execution
await autoScaler.registerScalingPolicy('backtester', {
  minReplicas: 1,
  maxReplicas: 4,
  enabled: true,
});

// Submit backtests
const results = await Promise.all(
  backtestConfigs.map((config) =>
    submitBacktest(config, configManager, orchestrator)
  )
);

// Process results
results.forEach((result) => {
  console.log(`${result.strategy}: Return=${result.totalReturn}, Sharpe=${result.sharpeRatio}`);
});
```

---

## SUMMARY

The Docker Manager skill provides enterprise-grade container orchestration for Aurigraph v2.1.0:

✅ **Exchange Connector Integration**: Deploy multiple exchange connectors with auto-scaling
✅ **Strategy Builder Integration**: Execute backtests and deploy strategies
✅ **Multi-Skill Coordination**: Manage dependencies between services
✅ **Zero-Downtime Deployments**: Multiple strategies for safe updates
✅ **Automatic Scaling**: Scale based on metrics and schedules
✅ **Secure Configuration**: Encrypted credentials and configuration management
✅ **Comprehensive Monitoring**: Real-time metrics and alerting

---

**Document Version**: 1.0.0
**Status**: Production Ready
**Maintained By**: Aurigraph Engineering Team
**Last Updated**: December 27, 2025
