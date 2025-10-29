# HMS J4C Agent - Skill Execution Framework

**Version**: 1.0.0
**Last Updated**: October 29, 2025

---

## 📋 Overview

The Skill Execution Framework (v1.0.0) provides comprehensive skill invocation with:
- **Parameter Validation** - Schema-based validation before execution
- **Execution Context** - Rich context tracking for each skill run
- **Logging & Audit Trail** - Complete execution logs and history
- **Retry & Timeout** - Built-in resilience patterns
- **Batch Execution** - Execute multiple skills concurrently
- **Statistics & Analytics** - Performance tracking and metrics

---

## 🚀 Quick Start

### Define Parameter Schema

```javascript
// Define what parameters a skill expects
const schema = {
  symbol: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 10
  },
  quantity: {
    type: 'number',
    required: true,
    min: 1,
    max: 1000000
  },
  side: {
    type: 'string',
    enum: ['buy', 'sell']
  },
  price: {
    type: 'number',
    min: 0.01
  }
};

executor.defineParameterSchema('order-skill', schema);
```

### Execute Skill

```bash
curl -X POST http://localhost:9003/api/skills/order-skill/execute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "quantity": 100,
    "side": "buy",
    "price": 150.50
  }'
```

**Response:**
```json
{
  "executionId": "exec_1729696800000_a1b2c3d4",
  "status": "completed",
  "context": {
    "executionId": "exec_1729696800000_a1b2c3d4",
    "agentId": "trader-agent",
    "skillId": "order-skill",
    "userId": "user_1",
    "status": "successful",
    "result": { "orderId": "order_123", "status": "pending" },
    "duration": 245,
    "logs": [
      { "timestamp": "...", "level": "info", "message": "Skill execution completed successfully" }
    ]
  }
}
```

---

## 📊 Parameter Schema Definition

### Data Types

```javascript
// String type
{
  type: 'string',
  required: true,
  minLength: 1,
  maxLength: 100
}

// Number type
{
  type: 'number',
  min: 0,
  max: 1000000
}

// Integer type
{
  type: 'integer',
  min: 1
}

// Array type
{
  type: 'array',
  required: false
}

// Object type
{
  type: 'object',
  required: false
}
```

### Schema Properties

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | Data type: 'string', 'number', 'integer', 'array', 'object' |
| `required` | boolean | Whether parameter is required |
| `minLength` | number | Minimum string length |
| `maxLength` | number | Maximum string length |
| `min` | number | Minimum numeric value |
| `max` | number | Maximum numeric value |
| `enum` | array | Allowed values |

### Complete Example

```javascript
const portfolioSchema = {
  startDate: {
    type: 'string',
    required: true,
    pattern: '^\\d{4}-\\d{2}-\\d{2}$'
  },
  endDate: {
    type: 'string',
    required: true
  },
  assets: {
    type: 'array',
    required: false
  },
  reportFormat: {
    type: 'string',
    enum: ['json', 'csv', 'pdf'],
    required: true
  },
  includeMetrics: {
    type: 'object',
    required: false
  }
};

executor.defineParameterSchema('portfolio-analysis', portfolioSchema);
```

---

## 🔌 API Endpoints

### POST /api/execute
**Description**: Execute a skill with standard execution

**Authenticated**: Yes (requires 'user' role)

**Request:**
```json
{
  "agent": "trader-agent",
  "skill": "order-skill",
  "task": "Place buy order",
  "parameters": {
    "symbol": "AAPL",
    "quantity": 100,
    "side": "buy",
    "price": 150.50
  }
}
```

**Response (200):**
```json
{
  "executionId": "exec_1729696800000_a1b2c3d4",
  "status": "completed",
  "context": {
    "agentId": "trader-agent",
    "skillId": "order-skill",
    "status": "successful",
    "result": { ... },
    "duration": 245,
    "logs": [ ... ]
  }
}
```

**Errors:**
- `400` - Parameter validation failed
- `401` - Unauthorized
- `404` - Skill not found
- `500` - Execution error

---

### POST /api/skills/:skillId/execute
**Description**: Execute skill with timeout protection

**Authenticated**: Yes (requires 'user' role)

**Request:**
```json
{
  "parameters": {
    "symbol": "AAPL",
    "quantity": 100
  },
  "timeout": 30000,
  "retry": {
    "enabled": true,
    "maxAttempts": 3,
    "delayMs": 1000
  }
}
```

**Response (200):**
```json
{
  "executionId": "exec_...",
  "status": "completed",
  "context": { ... }
}
```

---

### POST /api/executions/batch
**Description**: Execute multiple skills in parallel

**Authenticated**: Yes (requires 'user' role)

**Request:**
```json
{
  "executions": [
    {
      "agent": "agent1",
      "skill": "skill1",
      "parameters": { ... }
    },
    {
      "agent": "agent2",
      "skill": "skill2",
      "parameters": { ... }
    }
  ]
}
```

**Response (200):**
```json
{
  "batchId": "batch_...",
  "status": "completed",
  "results": [
    {
      "executionId": "exec_...",
      "status": "completed",
      "success": true,
      "context": { ... }
    },
    {
      "executionId": "exec_...",
      "status": "completed",
      "success": false,
      "error": "Parameter validation failed"
    }
  ]
}
```

---

### GET /api/executions/history
**Description**: Retrieve execution history

**Authenticated**: Yes (requires 'user' role)

**Query Parameters:**
- `skillId` - Filter by skill
- `agentId` - Filter by agent
- `userId` - Filter by user (admin can filter others)
- `status` - Filter by status (successful, failed)
- `limit` - Number of results (default: 100, max: 1000)
- `startDate` - Start date (ISO 8601)
- `endDate` - End date (ISO 8601)

**Example:**
```bash
curl "http://localhost:9003/api/executions/history?skillId=order-skill&status=successful&limit=50" \
  -H "Authorization: Bearer <token>"
```

**Response (200):**
```json
{
  "total": 250,
  "results": [
    {
      "executionId": "exec_1729696800000_a1b2c3d4",
      "agentId": "trader-agent",
      "skillId": "order-skill",
      "userId": "user_1",
      "status": "successful",
      "timestamp": "2025-10-29T10:30:00Z",
      "duration": 245,
      "result": { ... }
    }
  ]
}
```

---

### GET /api/executions/:executionId
**Description**: Get execution context and logs

**Authenticated**: Yes (requires 'user' role)

**Response (200):**
```json
{
  "executionId": "exec_1729696800000_a1b2c3d4",
  "agentId": "trader-agent",
  "skillId": "order-skill",
  "userId": "user_1",
  "status": "successful",
  "startTime": "2025-10-29T10:30:00Z",
  "endTime": "2025-10-29T10:30:00.245Z",
  "duration": 245,
  "result": {
    "orderId": "order_123",
    "status": "pending",
    "price": 150.50,
    "quantity": 100
  },
  "logs": [
    {
      "timestamp": "2025-10-29T10:30:00.050Z",
      "level": "info",
      "message": "Parameters validated successfully"
    },
    {
      "timestamp": "2025-10-29T10:30:00.200Z",
      "level": "info",
      "message": "Skill execution completed successfully",
      "data": { "result": { ... } }
    }
  ],
  "metadata": { ... }
}
```

---

### GET /api/executions/stats
**Description**: Get execution statistics

**Authenticated**: Yes (requires 'admin' role)

**Response (200):**
```json
{
  "total": 1254,
  "successful": 1189,
  "failed": 65,
  "skipped": 0,
  "totalDuration": 562340,
  "averageDuration": 448,
  "successRate": "94.82%",
  "failureRate": "5.18%",
  "historySizeLimit": 10000,
  "currentHistorySize": 1254
}
```

---

## 🔄 Execution Patterns

### Basic Execution

```javascript
const result = await executor.executeSkill({
  agentId: 'trader-agent',
  skillId: 'order-skill',
  userId: 'user_1',
  parameters: {
    symbol: 'AAPL',
    quantity: 100,
    side: 'buy'
  }
});
```

### Execution with Timeout

```javascript
const result = await executor.executeSkillWithTimeout({
  agentId: 'analyzer-agent',
  skillId: 'analyze-portfolio',
  userId: 'user_1',
  parameters: { ... }
}, 30000);  // 30 second timeout
```

### Execution with Retry

```javascript
const result = await executor.executeSkillWithRetry({
  agentId: 'trader-agent',
  skillId: 'order-skill',
  userId: 'user_1',
  parameters: { ... }
}, 3, 1000);  // 3 retries, 1 second delay
```

### Batch Execution

```javascript
const results = await executor.batchExecute([
  {
    agentId: 'agent1',
    skillId: 'skill1',
    userId: 'user_1',
    parameters: { ... }
  },
  {
    agentId: 'agent2',
    skillId: 'skill2',
    userId: 'user_1',
    parameters: { ... }
  }
]);
```

---

## 📊 Execution Context

The execution context provides complete tracking:

```json
{
  "executionId": "exec_1729696800000_a1b2c3d4",
  "agentId": "trader-agent",
  "skillId": "order-skill",
  "userId": "user_1",
  "sessionId": "sess_...",
  "parameters": { ... },
  "startTime": "2025-10-29T10:30:00Z",
  "endTime": "2025-10-29T10:30:00.245Z",
  "duration": 245,
  "status": "successful|failed|running",
  "result": { ... },
  "error": {
    "message": "Error description",
    "stack": "Stack trace..."
  },
  "logs": [
    {
      "timestamp": "...",
      "level": "info|warn|error",
      "message": "...",
      "data": { ... }
    }
  ],
  "metadata": { ... },
  "parentExecutionId": null
}
```

---

## 🛡️ Error Handling

### Parameter Validation Errors

```json
{
  "error": "Parameter validation failed",
  "details": [
    "Missing required parameter: symbol",
    "Parameter 'quantity' must be number, got string",
    "Parameter 'quantity' must be <= 1000000"
  ]
}
```

### Execution Errors

```json
{
  "executionId": "exec_...",
  "status": "completed",
  "context": {
    "status": "failed",
    "error": {
      "message": "Order API returned 400: Invalid symbol",
      "stack": "..."
    },
    "logs": [ ... ]
  }
}
```

---

## 🧪 Testing Execution

### Test Parameter Validation

```bash
# Valid parameters
curl -X POST http://localhost:9003/api/skills/order-skill/execute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","quantity":100,"side":"buy","price":150.50}'

# Invalid parameters - missing required
curl -X POST http://localhost:9003/api/skills/order-skill/execute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"quantity":100}'

# Invalid parameters - wrong type
curl -X POST http://localhost:9003/api/skills/order-skill/execute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","quantity":"not-a-number"}'
```

### Test Execution History

```bash
# Get all executions
curl http://localhost:9003/api/executions/history \
  -H "Authorization: Bearer <token>"

# Filter by skill
curl 'http://localhost:9003/api/executions/history?skillId=order-skill' \
  -H "Authorization: Bearer <token>"

# Filter by success status
curl 'http://localhost:9003/api/executions/history?status=successful' \
  -H "Authorization: Bearer <token>"

# Get specific execution
curl http://localhost:9003/api/executions/exec_1729696800000_a1b2c3d4 \
  -H "Authorization: Bearer <token>"
```

---

## 📈 Performance Considerations

### Execution Limits

- **Maximum execution duration**: 30 seconds (configurable)
- **Maximum batch size**: 100 executions
- **History limit**: 10,000 entries (auto-rotates)
- **Context memory**: 1,000 active contexts

### Optimization Tips

1. **Use batch execution** for multiple skills
2. **Set timeouts** to prevent hanging
3. **Enable retry logic** for transient failures
4. **Clear old history** regularly for large deployments

---

## 🐛 Troubleshooting

### "Parameter Validation Failed"
```bash
# Check schema definition
curl http://localhost:9003/api/skills/skill-id \
  -H "Authorization: Bearer <token>"

# Verify parameter types and values
echo '{"symbol":"AAPL","quantity":100}' | jq
```

### "Execution Timeout"
```bash
# Increase timeout in request
curl -X POST http://localhost:9003/api/skills/order-skill/execute \
  -H "Authorization: Bearer <token>" \
  -d '{"parameters":{...},"timeout":60000}'
```

### "Skill Not Found"
```bash
# List available skills
curl http://localhost:9003/api/skills \
  -H "Authorization: Bearer <token>"
```

---

## 📞 Support

For skill execution issues:
- Check execution history: `/api/executions/history`
- Review execution logs: `/api/executions/{executionId}`
- View statistics: `/api/executions/stats`

**Contact**: engineering@aurigraph.io
