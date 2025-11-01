# Hermes-J4C Integration Guide

**Version**: v11.4.5
**Date**: November 1, 2025
**Status**: Production Ready
**Framework**: J4C Agent with Hermes Trading Platform

---

## Quick Start

### 1. Installation & Setup

```bash
# Install dependencies
npm install --legacy-peer-deps

# Set environment variables
export HERMES_API_URL=http://localhost:8005
export HERMES_API_KEY=your-api-key
export HERMES_TIMEOUT=30000
export HERMES_MAX_RETRIES=3
```

### 2. Initialize Adapter

```typescript
import { createJ4CHermesAdapter } from './j4c-hermes-adapter';

const adapter = createJ4CHermesAdapter(
  'http://localhost:8005',
  process.env.HERMES_API_KEY
);

// Check health
const isHealthy = await adapter.checkHealth();
console.log(`Hermes API Status: ${isHealthy ? '✅ OK' : '❌ DOWN'}`);
```

### 3. Discover Agents

```typescript
import { createAgentDiscoveryService } from './j4c-hermes-agent-discovery';

const discovery = createAgentDiscoveryService(adapter);

// Discover all agents
const agents = await discovery.discoverAgents();
console.log(`Found ${agents.length} agents`);

// Get specific agent
const tradingAgent = await discovery.getAgent('trading-operations');
console.log(`Trading Agent Skills: ${tradingAgent?.skills.join(', ')}`);
```

### 4. Execute Skills

```typescript
import { createSkillExecutor } from './j4c-hermes-skill-executor';

const executor = createSkillExecutor(adapter);

// Execute a skill
const result = await executor.executeSkill(
  'trading-operations',
  'strategy-builder',
  {
    strategy: 'momentum',
    timeframe: '1h',
    symbols: ['BTC/USD', 'ETH/USD']
  },
  30000  // timeout
);

console.log(`Execution Status: ${result.success ? '✅' : '❌'}`);
console.log(`Result:`, result.result);
console.log(`Execution Time: ${result.executionTime}ms`);
```

---

## Architecture Overview

### Component Structure

```
┌─────────────────────────────────────┐
│      J4C Agent Framework            │
├─────────────────────────────────────┤
│   Application Layer                 │
│   └─ Agent Service                  │
│      └─ Skill Router                │
├─────────────────────────────────────┤
│   Integration Layer (NEW)           │
│   ├─ J4CHermesAdapter               │
│   │  └─ HTTP Client (axios)         │
│   ├─ Agent Discovery Service        │
│   │  └─ Capability Mapping          │
│   └─ Skill Executor                 │
│      └─ Execution Engine            │
├─────────────────────────────────────┤
│   Hermes Platform                   │
│   ├─ 14 Specialized Agents          │
│   ├─ 91 Production Skills           │
│   └─ 3 Workflows                    │
└─────────────────────────────────────┘
```

### Data Flow

```
User Request
    ↓
J4C Agent Service
    ↓
Skill Router (Task Type → Agent Selection)
    ↓
Agent Discovery Service (Find Best Agent)
    ↓
J4CHermesAdapter (API Communication)
    ↓
Hermes Platform
    ├─ Agent Execution
    ├─ Skill Processing
    └─ Result Generation
    ↓
Skill Executor (Result Processing)
    ↓
Logging & Monitoring
    ↓
User Response
```

---

## Adapter Usage Guide

### Creating an Adapter

```typescript
import {
  J4CHermesAdapter,
  createJ4CHermesAdapter
} from './j4c-hermes-adapter';

// Method 1: Factory function (recommended)
const adapter = createJ4CHermesAdapter();

// Method 2: Direct instantiation
const adapter = new J4CHermesAdapter({
  hermesApiUrl: 'http://localhost:8005',
  hermesApiKey: process.env.HERMES_API_KEY,
  timeout: 30000,
  maxRetries: 3,
  retryDelayMs: 1000,
  enableCache: true,
  cacheExpireMs: 300000,
  enableEncryption: false,
  logRequests: true,
  logLevel: 'info'
});
```

### Adapter Methods

#### Health Check
```typescript
const isHealthy = await adapter.checkHealth();
if (isHealthy) {
  console.log('Hermes API is operational');
}
```

#### Agent Management
```typescript
// Get all agents
const allAgents = await adapter.getAvailableAgents();

// Get specific agent
const agent = await adapter.getAgent('trading-operations');
if (agent) {
  console.log(`Agent: ${agent.name}`);
  console.log(`Skills: ${agent.skills.length}`);
}

// Get agent skills
const skills = await adapter.getAgentSkills('trading-operations');
skills.forEach(skill => {
  console.log(`- ${skill.name}: ${skill.description}`);
});
```

#### Skill Execution
```typescript
const request = {
  agent: 'trading-operations',
  skill: 'backtest-manager',
  parameters: {
    strategy: 'RSI',
    initialCapital: 10000,
    startDate: '2024-01-01',
    endDate: '2024-10-31'
  },
  timeout: 30000
};

const response = await adapter.executeSkill(request);
console.log(`Success: ${response.success}`);
console.log(`Execution Time: ${response.executionTime}ms`);
```

#### Execution History & Statistics
```typescript
// Get last 50 executions
const history = adapter.getExecutionHistory(50);

// Get statistics
const stats = adapter.getStatistics();
console.log(`Total Executions: ${stats.totalExecutions}`);
console.log(`Success Rate: ${stats.successRate}%`);
console.log(`Avg Execution Time: ${stats.averageExecutionTime}ms`);
```

---

## Discovery Service Usage

### Agent Discovery

```typescript
import { createAgentDiscoveryService } from './j4c-hermes-agent-discovery';

const discovery = createAgentDiscoveryService(adapter);

// Discover all agents and their capabilities
const agents = await discovery.discoverAgents();
console.log(`Discovered ${agents.length} agents`);
```

### Agent Selection

```typescript
// Select best agent for a task
const selection = await discovery.selectBestAgent(
  'Build and backtest a momentum trading strategy',
  {
    requiredCapabilities: ['trading', 'backtesting'],
    preferredAgents: ['trading-operations'],
    maxExecutionTime: 120000,
    prioritizeReliability: true,
    taskType: 'trading-strategy'
  }
);

if (selection) {
  console.log(`Selected Agent: ${selection.agent}`);
  console.log(`Skill: ${selection.skill}`);
  console.log(`Confidence: ${(selection.confidence * 100).toFixed(2)}%`);
  console.log(`Reason: ${selection.reason}`);

  if (selection.alternativeAgents) {
    console.log('\nAlternatives:');
    selection.alternativeAgents.forEach(alt => {
      console.log(`- ${alt.agent} (${alt.skill})`);
    });
  }
}
```

### Capability Search

```typescript
// Find all agents with specific capability
const capableAgents = discovery.searchAgentsByCapability('trading');
console.log(`Agents with 'trading' capability: ${capableAgents.length}`);

capableAgents.forEach(agent => {
  console.log(`\n${agent.agent}`);
  console.log(`  Capabilities: ${agent.capabilities.join(', ')}`);
  console.log(`  Specializations: ${agent.specializations.length}`);
});
```

### Discovery Statistics

```typescript
const stats = discovery.getDiscoveryStats();
console.log(`Total Agents: ${stats.totalAgents}`);
console.log(`Discovered At: ${stats.discoveredAt}`);
stats.agentCapabilities.forEach(agent => {
  console.log(`- ${agent.agent}: ${agent.capabilities} capabilities`);
});
```

---

## Skill Executor Usage

### Basic Execution

```typescript
import { createSkillExecutor } from './j4c-hermes-skill-executor';

const executor = createSkillExecutor(adapter);

// Execute single skill
const result = await executor.executeSkill(
  'dlt-developer',
  'blockchain-deploy',
  {
    network: 'mainnet',
    contract: 'ERC20',
    initialSupply: 1000000
  }
);

console.log(`Execution ID: ${result.executionId}`);
console.log(`Success: ${result.success}`);
console.log(`Time: ${result.executionTime}ms`);
```

### Async Execution with Callbacks

```typescript
// Execute asynchronously
const executionId = await executor.executeSkillAsync(
  'qa-engineer',
  'test-runner',
  { suite: 'integration', coverage: true },
  (result) => {
    console.log(`[${result.executionId}] ${result.success ? '✅' : '❌'}`);
  }
);

// Get execution status
const status = executor.getExecutionStatus(executionId);
console.log(`Status: ${status?.status}`);
```

### Execution Listeners

```typescript
// Register execution listener
executor.on(executionId, (context) => {
  console.log(`[${context.executionId}] Status: ${context.status}`);

  if (context.status === 'completed') {
    console.log('Execution completed!');
    console.log('Result:', context.result);
  }
});

// Remove listener when done
executor.off(executionId, listener);
```

### Wait for Execution

```typescript
// Wait for execution to complete
try {
  const result = await executor.waitForExecution(executionId, 60000);
  console.log('Final result:', result);
} catch (error) {
  console.error('Execution timeout or failed:', error);
}
```

### Batch Execution

```typescript
// Execute multiple skills in parallel
const results = await executor.executeSkillBatch([
  {
    agent: 'qa-engineer',
    skill: 'test-runner',
    parameters: { suite: 'unit' }
  },
  {
    agent: 'devops-engineer',
    skill: 'deploy-wizard',
    parameters: { environment: 'staging' }
  },
  {
    agent: 'security-compliance',
    skill: 'security-scanner',
    parameters: { scanType: 'full' }
  }
]);

results.forEach(result => {
  console.log(`${result.agent}/${result.skill}: ${result.success ? '✅' : '❌'}`);
});
```

### Execution Logging

```typescript
// Get execution logs
const logs = executor.getExecutionLogs(executionId);
logs.forEach(log => console.log(log));

// Example output:
// [2025-11-01T10:30:45.123Z] Skill execution started: trading-operations/strategy-builder
// [2025-11-01T10:30:46.234Z] Building momentum strategy...
// [2025-11-01T10:30:48.456Z] Strategy built successfully
// [2025-11-01T10:30:48.789Z] Skill execution completed successfully
```

### Statistics & Monitoring

```typescript
const stats = executor.getStatistics();
console.log(`
Active Executions: ${stats.activeExecutions}
Completed: ${stats.completedExecutions}
Failed: ${stats.failedExecutions}
Average Time: ${stats.averageExecutionTime}ms
`);
```

---

## Workflow Examples

### Trading Pipeline

```typescript
async function executeTraditionalTradingPipeline() {
  // 1. Build strategy
  const strategyResult = await executor.executeSkill(
    'trading-operations',
    'strategy-builder',
    { strategy: 'momentum', timeframe: '1h' }
  );

  if (!strategyResult.success) {
    throw new Error('Strategy building failed');
  }

  // 2. Backtest strategy
  const backtestResult = await executor.executeSkill(
    'trading-operations',
    'backtest-manager',
    {
      strategy: strategyResult.result,
      startDate: '2024-01-01',
      endDate: '2024-10-31'
    }
  );

  // 3. Deploy to exchange
  const deployResult = await executor.executeSkill(
    'trading-operations',
    'order-executor',
    {
      strategy: backtestResult.result,
      liveTrading: false  // Paper trading first
    }
  );

  return deployResult;
}
```

### Blockchain Deployment

```typescript
async function deploySmartContract() {
  // 1. Create contract
  const contractResult = await executor.executeSkill(
    'dlt-developer',
    'token-creator',
    {
      name: 'MyToken',
      symbol: 'MTK',
      supply: 1000000
    }
  );

  // 2. Audit contract
  const auditResult = await executor.executeSkill(
    'dlt-developer',
    'dlt-auditor',
    { contract: contractResult.result }
  );

  // 3. Deploy
  const deployResult = await executor.executeSkill(
    'dlt-developer',
    'blockchain-deploy',
    {
      contract: contractResult.result,
      network: 'mainnet'
    }
  );

  return deployResult;
}
```

### Data Analysis Pipeline

```typescript
async function analyzeMarketData() {
  // Parallel execution
  const results = await executor.executeSkillBatch([
    {
      agent: 'data-engineer',
      skill: 'pipeline-builder',
      parameters: { source: 'exchange-feeds' }
    },
    {
      agent: 'data-engineer',
      skill: 'analytics-runner',
      parameters: { metrics: ['OHLCV', 'volume', 'vix'] }
    },
    {
      agent: 'data-engineer',
      skill: 'report-generator',
      parameters: { format: 'json', details: true }
    }
  ]);

  return results;
}
```

---

## Configuration

### Environment Variables

```bash
# Hermes API Configuration
HERMES_API_URL=http://localhost:8005
HERMES_API_KEY=your-secret-api-key
HERMES_TIMEOUT=30000
HERMES_MAX_RETRIES=3
HERMES_RETRY_DELAY=1000

# Caching
HERMES_CACHE_ENABLED=true
HERMES_CACHE_EXPIRE=300000

# Encryption
HERMES_ENCRYPTION_ENABLED=false
HERMES_ENCRYPTION_KEY=optional-encryption-key

# Logging
HERMES_LOG_REQUESTS=true
HERMES_LOG_LEVEL=info
```

### Configuration File (j4c-agent.config.json)

```json
{
  "integrations": {
    "hermes": {
      "enabled": true,
      "api": "${HERMES_API_URL:http://localhost:8005}",
      "auth": "${HERMES_API_KEY}",
      "timeout": 30000,
      "retries": 3,
      "cacheEnabled": true,
      "cacheExpireSecs": 300,
      "discoveryInterval": 3600000,
      "agentDiscovery": true,
      "skillAutoload": true,
      "agents": [
        // 14 agents with 91 skills configured
      ]
    }
  }
}
```

---

## Error Handling

### Common Errors & Solutions

#### 1. API Connection Failed

```typescript
try {
  const adapter = createJ4CHermesAdapter();
  const healthy = await adapter.checkHealth();

  if (!healthy) {
    console.error('Hermes API is not responding');
    // Fallback to cached agent list or local processing
  }
} catch (error) {
  console.error('Failed to connect to Hermes API:', error.message);
  // Implement fallback strategy
}
```

#### 2. Agent Not Found

```typescript
const agent = await discovery.getAgent('invalid-agent');
if (!agent) {
  console.warn('Agent not found');

  // Try to find alternative agent
  const alternatives = await discovery.searchAgentsByCapability('trading');
  if (alternatives.length > 0) {
    const bestAlternative = alternatives[0];
    console.log(`Using alternative agent: ${bestAlternative.agent}`);
  }
}
```

#### 3. Skill Execution Timeout

```typescript
try {
  const result = await executor.executeSkill(
    'trading-operations',
    'backtest-manager',
    { /* params */ },
    5000  // Short timeout
  );
} catch (error) {
  if (error.message.includes('timeout')) {
    console.warn('Skill execution timeout - increasing timeout');

    // Retry with longer timeout
    const result = await executor.executeSkill(
      'trading-operations',
      'backtest-manager',
      { /* params */ },
      60000  // Longer timeout
    );
  }
}
```

#### 4. Rate Limiting (429)

```typescript
// The adapter automatically handles rate limiting with retry logic
// Max retries configured: 3
// Retry delay: 1000ms (exponential backoff)

const result = await adapter.executeSkill(request);
// If rate limited, adapter will retry automatically
```

---

## Testing

### Unit Tests

```typescript
import {
  createJ4CHermesAdapter,
  createAgentDiscoveryService,
  createSkillExecutor
} from './j4c-hermes';

describe('Hermes Integration', () => {
  let adapter: J4CHermesAdapter;

  beforeEach(() => {
    adapter = createJ4CHermesAdapter();
  });

  test('adapter initializes correctly', () => {
    expect(adapter).toBeDefined();
  });

  test('health check works', async () => {
    const health = await adapter.checkHealth();
    expect(typeof health).toBe('boolean');
  });

  test('agent discovery returns agents', async () => {
    const agents = await adapter.getAvailableAgents();
    expect(Array.isArray(agents)).toBe(true);
    expect(agents.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
describe('Hermes Workflow', () => {
  test('trading pipeline executes successfully', async () => {
    const discovery = createAgentDiscoveryService(adapter);
    const executor = createSkillExecutor(adapter);

    // Select agent
    const selection = await discovery.selectBestAgent(
      'Build trading strategy',
      { requiredCapabilities: ['trading'] }
    );

    expect(selection).toBeDefined();

    // Execute skill
    const result = await executor.executeSkill(
      selection!.agent,
      selection!.skill,
      { strategy: 'test' }
    );

    expect(result.success).toBe(true);
  });
});
```

---

## Deployment

### Docker Deployment

```bash
# Build Hermes container
docker build -f Dockerfile.hermes -t hermes:v2.1.0 .

# Deploy with Docker Compose
docker-compose -f docker-compose.hermes.yml up -d

# Verify deployment
docker-compose ps
```

### Kubernetes Deployment

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/hermes-namespace.yml
kubectl apply -f k8s/hermes-deployment.yml
kubectl apply -f k8s/hermes-service.yml

# Check deployment status
kubectl get pods -n hermes
kubectl logs -n hermes deployment/hermes-api
```

### Health Verification

```bash
# Check Hermes API health
curl -k https://hms.aurex.in/health

# Expected response:
# {"status": "ok", "message": "HMS Agent - OK"}

# Check agent count
curl https://hms.aurex.in/api/agents | jq '.agents | length'
```

---

## Monitoring & Observability

### Metrics to Track

```typescript
// Get adapter metrics
const adapterStats = adapter.getStatistics();
console.log(`
Executions: ${adapterStats.totalExecutions}
Success Rate: ${adapterStats.successRate}%
Avg Time: ${adapterStats.averageExecutionTime}ms
`);

// Get executor metrics
const executorStats = executor.getStatistics();
console.log(`
Active: ${executorStats.activeExecutions}
Completed: ${executorStats.completedExecutions}
Failed: ${executorStats.failedExecutions}
`);
```

### Logging

```typescript
// Configure logging level
process.env.HERMES_LOG_LEVEL = 'debug';

// View logs
executor.getExecutionLogs(executionId).forEach(log => {
  console.log(log);
});
```

---

## Performance Tuning

### Optimization Tips

1. **Enable Caching**: Reduces agent discovery calls
   ```typescript
   { enableCache: true, cacheExpireMs: 300000 }
   ```

2. **Adjust Timeouts**: Based on skill complexity
   ```typescript
   timeout: 120000  // For long-running backtests
   ```

3. **Parallel Execution**: Use batch operations
   ```typescript
   executor.executeSkillBatch([...])
   ```

4. **Max Concurrent**: Limit parallel executions
   ```typescript
   const executor = createSkillExecutor(adapter, 10);
   ```

5. **Retry Strategy**: Configure appropriately
   ```typescript
   { maxRetries: 3, retryDelayMs: 1000 }
   ```

---

## Support & Troubleshooting

### Documentation References
- **Hermes API**: HMS_API_DOCUMENTATION.md
- **J4C Agent**: J4C-AGENT-INSTRUCTIONS.md
- **Release Notes**: RELEASE-NOTES.md
- **Session Summary**: SESSION-20-SUMMARY.md

### Getting Help
1. Check DUPLICATE-DETECTION-REPORT.md for validation issues
2. Review execution logs for detailed errors
3. Check adapter/executor statistics
4. Verify Hermes API health endpoint
5. Review configuration in j4c-agent.config.json

---

**Version**: v11.4.5
**Last Updated**: November 1, 2025
**Status**: Production Ready
**Maintained By**: J4C Agent Framework
