# HMS J4C Agent - API Documentation

**Version**: 1.0.0
**Base URL**: `https://hms.aurex.in`
**API Base**: `https://apihms.aurex.in` or `https://hms.aurex.in/api`
**Last Updated**: October 29, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Core Endpoints](#core-endpoints)
4. [Agents API](#agents-api)
5. [Skills API](#skills-api)
6. [Execution API](#execution-api)
7. [Error Handling](#error-handling)
8. [Examples](#examples)
9. [Agent Reference](#agent-reference)

---

## Overview

The HMS J4C Agent API provides access to 15 specialized agents with 80+ skills through a RESTful interface. Each agent is designed for specific domains (DevOps, Trading, Security, etc.) and can execute tasks autonomously.

### Key Features
- ✅ RESTful API design
- ✅ JSON request/response format
- ✅ CORS support for cross-origin requests
- ✅ Health check endpoints
- ✅ Server metrics and monitoring
- ✅ Agent discovery and skill listing
- ✅ Rate limiting (100 req/s for API endpoints)
- ✅ SSL/TLS encryption (TLS 1.2, 1.3)

---

## Authentication

**Current**: No authentication required (open API)
**Future**: API Key support planned

### CORS Headers
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE, PUT
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Core Endpoints

### 1. Health Check
Returns server health status

```http
GET /health
```

**Response** (200 OK):
```json
{
  "status": "ok",
  "message": "HMS Agent - OK"
}
```

**Example**:
```bash
curl -k https://hms.aurex.in/health
```

---

### 2. API Root / Documentation
Returns API documentation and available endpoints

```http
GET /
```

**Response** (200 OK):
```json
{
  "name": "Aurigraph Agents",
  "version": "1.0.0",
  "status": "running",
  "endpoints": {
    "health": "/health",
    "metrics": "/metrics",
    "agents": "/api/agents",
    "skills": "/api/skills",
    "execute": "/api/execute"
  }
}
```

**Example**:
```bash
curl -k https://hms.aurex.in/
```

---

### 3. Server Metrics
Returns server performance metrics

```http
GET /metrics
```

**Response** (200 OK):
```json
{
  "uptime": 1234.567,
  "memory": {
    "rss": 62210048,
    "heapTotal": 11010048,
    "heapUsed": 9401312,
    "external": 2896810,
    "arrayBuffers": 33300
  },
  "environment": "production"
}
```

**Fields**:
- `uptime` - Server uptime in seconds
- `memory` - Node.js process memory usage in bytes
  - `rss` - Resident set size
  - `heapTotal` - Total heap size
  - `heapUsed` - Used heap size
  - `external` - External memory usage
  - `arrayBuffers` - Array buffers size
- `environment` - Deployment environment (development/production)

**Example**:
```bash
curl -k https://hms.aurex.in/metrics
```

---

## Agents API

### 1. List All Agents
Returns all 15 available agents

```http
GET /api/agents
```

**Response** (200 OK):
```json
{
  "agents": [
    {
      "id": "dlt-developer",
      "name": "DLT Developer",
      "description": "DLT (Distributed Ledger Technology) Development for the Aurigraph/Hermes 2.0 platform...",
      "skills": 5
    },
    ...
  ],
  "version": "1.0.0"
}
```

**Example**:
```bash
curl -k https://hms.aurex.in/api/agents
```

**Response Format**:
- `agents[]` - Array of agent objects
  - `id` - Agent identifier (kebab-case)
  - `name` - Human-readable agent name
  - `description` - Agent capabilities description
  - `skills` - Number of available skills
- `version` - API version

---

### 2. Get Agent Details
Returns detailed information for a specific agent

```http
GET /api/agents/{agent_id}
```

**Parameters**:
- `agent_id` - Agent identifier (see Agent Reference below)

**Response** (200 OK):
```json
{
  "id": "devops-engineer",
  "name": "DevOps Engineer",
  "description": "DevOps Engineer for the Aurigraph/Hermes 2.0 platform. Your expertise covers...",
  "skills": 8
}
```

**Status Codes**:
- `200` - Success
- `404` - Agent not found

**Example**:
```bash
curl -k https://hms.aurex.in/api/agents/devops-engineer
curl -k https://hms.aurex.in/api/agents/trading-operations
curl -k https://hms.aurex.in/api/agents/security-compliance
```

---

## Skills API

### 1. List All Skills
Returns all available skills across all agents

```http
GET /api/skills
```

**Response** (200 OK):
```json
{
  "skills": [
    {
      "id": "deploy-service",
      "name": "Deploy Service",
      "agent": "devops-engineer",
      "status": "available"
    },
    ...
  ],
  "total": 42
}
```

**Response Format**:
- `skills[]` - Array of skill objects
  - `id` - Skill identifier
  - `name` - Skill name
  - `agent` - Agent ID that owns this skill
  - `status` - Skill status (available/deprecated/beta)
- `total` - Total number of skills

**Example**:
```bash
curl -k https://hms.aurex.in/api/skills
```

---

### 2. Get Skill Details
Returns detailed information for a specific skill

```http
GET /api/skills/{skill_id}
```

**Parameters**:
- `skill_id` - Skill identifier

**Response** (200 OK):
```json
{
  "id": "deploy-service",
  "name": "Deploy Service",
  "agent": "devops-engineer",
  "description": "Deploy a service to production...",
  "status": "available",
  "parameters": [...]
}
```

**Status Codes**:
- `200` - Success
- `404` - Skill not found

**Example**:
```bash
curl -k https://hms.aurex.in/api/skills/deploy-service
```

---

## Execution API

### Execute Agent Skill
Executes a skill from a specific agent

```http
POST /api/execute
Content-Type: application/json
```

**Request Body**:
```json
{
  "agent": "devops-engineer",
  "skill": "deploy-service",
  "task": "Deploy the HMS application to production"
}
```

**Parameters**:
- `agent` - Agent ID to execute
- `skill` - Skill ID to execute
- `task` - Task description or parameters

**Response** (200 OK):
```json
{
  "success": true,
  "output": "Service deployed successfully",
  "metrics": {
    "executionTime": 5432,
    "timestamp": "2025-10-29T08:45:00Z"
  }
}
```

**Status Codes**:
- `200` - Execution successful
- `400` - Invalid request (missing parameters)
- `404` - Agent or skill not found
- `500` - Execution error

**Response Format**:
- `success` - Execution success status
- `output` - Execution result or error message
- `metrics` - Execution metrics
  - `executionTime` - Execution time in milliseconds
  - `timestamp` - Execution timestamp (ISO 8601)

**Example**:
```bash
curl -X POST -k https://hms.aurex.in/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "devops-engineer",
    "skill": "deploy-service",
    "task": "Deploy HMS application"
  }'
```

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "error": "Error message",
  "path": "/api/path",
  "status": 404
}
```

### Common Error Codes

| Code | Description | Example |
|------|-------------|---------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Missing required parameters |
| 404 | Not Found | Agent/skill/endpoint doesn't exist |
| 500 | Server Error | Internal server error |

### Examples

**Missing Agent**:
```bash
curl -k https://hms.aurex.in/api/agents/fake-agent
```
Response:
```json
{
  "error": "Agent not found"
}
```

**Invalid Endpoint**:
```bash
curl -k https://hms.aurex.in/api/invalid
```
Response:
```json
{
  "error": "Not Found",
  "path": "/api/invalid"
}
```

---

## Examples

### Example 1: Check System Health

```bash
# Check HMS health
curl -k https://hms.aurex.in/health

# Check server metrics
curl -k https://hms.aurex.in/metrics
```

### Example 2: Discover Available Agents

```bash
# List all agents
curl -k https://hms.aurex.in/api/agents

# Get specific agent details
curl -k https://hms.aurex.in/api/agents/trading-operations
```

### Example 3: List Available Skills

```bash
# List all skills
curl -k https://hms.aurex.in/api/skills

# Get specific skill details
curl -k https://hms.aurex.in/api/skills/deploy-service
```

### Example 4: Execute a Task

```bash
# Execute DevOps task
curl -X POST -k https://hms.aurex.in/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "devops-engineer",
    "skill": "deploy-service",
    "task": "Deploy the new version of HMS"
  }'

# Execute Trading task
curl -X POST -k https://hms.aurex.in/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "trading-operations",
    "skill": "backtest-strategy",
    "task": "Backtest momentum strategy with 30-day lookback"
  }'
```

### Example 5: Using with JavaScript

```javascript
// Check health
fetch('https://hms.aurex.in/health')
  .then(r => r.json())
  .then(data => console.log('Health:', data.status));

// List agents
fetch('https://hms.aurex.in/api/agents')
  .then(r => r.json())
  .then(data => {
    console.log('Available agents:', data.agents.length);
    data.agents.forEach(agent => {
      console.log(`- ${agent.name} (${agent.skills} skills)`);
    });
  });

// Execute task
fetch('https://hms.aurex.in/api/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent: 'qa-engineer',
    skill: 'run-tests',
    task: 'Run automated test suite'
  })
})
  .then(r => r.json())
  .then(data => console.log('Result:', data.output));
```

### Example 6: Using with Python

```python
import requests

# Base URL
base_url = 'https://hms.aurex.in'

# Health check
response = requests.get(f'{base_url}/health', verify=False)
print(f"Health: {response.json()['status']}")

# List agents
response = requests.get(f'{base_url}/api/agents', verify=False)
agents = response.json()['agents']
for agent in agents:
    print(f"- {agent['name']}: {agent['description'][:50]}...")

# Execute task
response = requests.post(
    f'{base_url}/api/execute',
    json={
        'agent': 'security-compliance',
        'skill': 'scan-vulnerabilities',
        'task': 'Scan codebase for security vulnerabilities'
    },
    verify=False
)
print(f"Execution: {response.json()['output']}")
```

---

## Agent Reference

### Complete Agent List (15 Total)

#### Core Development
| ID | Name | Skills | Description |
|----|------|--------|-------------|
| `dlt-developer` | DLT Developer | 5 | Smart contracts, tokenization, blockchain development |
| `frontend-developer` | Frontend Developer | 4 | React, UI/UX, responsive design |
| `developer-tools` | Developer Tools | 6 | Code analysis, testing, security, documentation |

#### Operations & Infrastructure
| ID | Name | Skills | Description |
|----|------|--------|-------------|
| `devops-engineer` | DevOps Engineer | 8 | Deployments, infrastructure, monitoring, CI/CD |
| `sre-reliability` | SRE/Reliability | 4 | Incidents, monitoring, SLOs, reliability |
| `data-engineer` | Data Engineer | 4 | Data pipelines, ETL, analytics, warehousing |

#### Quality & Security
| ID | Name | Skills | Description |
|----|------|--------|-------------|
| `qa-engineer` | QA Engineer | 7 | Testing, coverage, automation, security |
| `security-compliance` | Security & Compliance | 7 | Security scans, compliance, audits, penetration testing |

#### Business & Project Management
| ID | Name | Skills | Description |
|----|------|--------|-------------|
| `project-manager` | Project Manager | 7 | Sprint planning, JIRA, backlog, reporting |
| `digital-marketing` | Digital Marketing | 11 | Campaigns, content, SEO, social media, email |
| `employee-onboarding` | Employee Onboarding | 8 | Onboarding, training, compliance, offboarding |

#### Specialized/Trading
| ID | Name | Skills | Description |
|----|------|--------|-------------|
| `trading-operations` | Trading Operations | 7 | Exchange integrations, strategies, backtesting |
| `gnn-heuristic-agent` | GNN Heuristic | 8 | Graph Neural Networks, optimization heuristics |

#### Platform
| ID | Name | Skills | Description |
|----|------|--------|-------------|
| `dlt-architect` | DLT Architect | 0 | Blockchain architecture, system design |
| `master-sop` | Master SOP | 0 | Master standard operating procedures |

---

## Rate Limiting

**Limits**:
- API endpoints: 100 requests/second
- General endpoints: 10 requests/second

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1635321600
```

---

## Security Notes

### SSL/TLS
- Minimum version: TLS 1.2
- Recommended: TLS 1.3
- Certificate issuer: Let's Encrypt

### Security Headers
```
Strict-Transport-Security: max-age=31536000
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

### Best Practices
1. Always use HTTPS (enforce with HSTS)
2. Use strong API keys when implemented
3. Validate all input before sending
4. Never expose credentials in logs
5. Use appropriate HTTP methods (GET for read, POST for write)

---

## Troubleshooting

### Common Issues

**CORS Error**:
- Ensure requests are made over HTTPS
- Check that browser supports CORS
- Verify request method and headers

**Connection Timeout**:
- Verify server is running: `curl -k https://hms.aurex.in/health`
- Check network connectivity
- Review server logs

**Agent Not Found**:
- List agents first: `curl -k https://hms.aurex.in/api/agents`
- Verify agent ID spelling (use kebab-case)
- Check agent is enabled in configuration

### Debug Commands

```bash
# Check health
curl -v -k https://hms.aurex.in/health

# Get detailed agent list
curl -s -k https://hms.aurex.in/api/agents | head -100

# Test specific agent
curl -k https://hms.aurex.in/api/agents/qa-engineer

# Check server metrics
curl -k https://hms.aurex.in/metrics
```

---

## Support

For issues or questions:
- **Documentation**: https://github.com/Aurigraph-DLT-Corp/HMS
- **Issues**: Create GitHub issue with details
- **Email**: engineering@aurigraph.io

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Oct 29, 2025 | Initial release with 15 agents |

---

**Last Updated**: October 29, 2025
**API Status**: ✅ Production (Stable)
