# API Key Management System

## Overview

The API Key Management System allows registered users to generate and manage API keys for programmatic access to the Strategy Builder API. API keys provide an alternative authentication method to JWT tokens, perfect for server-to-server communication, automated scripts, and third-party integrations.

## Features

- **Secure Key Generation**: Cryptographically secure API keys with SHA-256 hashing
- **Key Scoping**: Restrict API keys to specific permissions
- **Rate Limiting**: Configure per-key rate limits (requests per hour)
- **Key Expiration**: Set optional expiration dates for time-limited keys
- **Key Rotation**: Rotate keys without losing access
- **Audit Trail**: Track last usage of each API key
- **Active/Inactive Status**: Quickly disable keys without deletion

## Installation & Setup

### 1. API Key Model

The system uses a MongoDB collection `api_keys` to store API key data:

```typescript
{
  userId: ObjectId,           // Reference to user
  name: String,              // User-friendly name
  keyHash: String,           // SHA-256 hash of key (for security)
  keyPrefix: String,         // First 8 chars for display
  description: String,       // Optional description
  permissions: [String],     // Scoped permissions
  isActive: Boolean,         // Enable/disable without deletion
  lastUsed: Date,           // Track usage
  expiresAt: Date,          // Optional expiration
  rateLimit: Number,        // Requests per hour (default: 1000)
  createdAt: Date,
  updatedAt: Date
}
```

### 2. Environment Variables

No additional environment variables required. The system uses existing JWT configuration for hashing.

### 3. Middleware Integration

The API key authentication middleware is available for protecting endpoints:

```typescript
// Require API key authentication
import { authenticateAPIKey } from './middleware/apikey';
app.use('/api/v1/protected', authenticateAPIKey);

// Optional API key authentication
import { optionalAPIKeyAuthentication } from './middleware/apikey';
app.use('/api/v1/endpoint', optionalAPIKeyAuthentication);

// Require specific permissions
import { requireAPIKeyPermission } from './middleware/apikey';
router.post('/endpoint', requireAPIKeyPermission('strategy:create', 'backtest:create'));
```

## API Endpoints

### 1. Create API Key

**Endpoint**: `POST /api/v1/apikeys`

**Authentication**: JWT Token (via Authorization header)

**Request Body**:
```json
{
  "name": "My Integration Key",
  "description": "For my trading bot",
  "permissions": ["strategy:read", "backtest:create"],
  "expiresAt": "2025-12-31T23:59:59Z",
  "rateLimit": 5000
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "My Integration Key",
    "keyPrefix": "aur_xxxx",
    "key": "aur_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
    "description": "For my trading bot",
    "permissions": ["strategy:read", "backtest:create"],
    "rateLimit": 5000,
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "createdAt": "2024-10-23T10:30:00.000Z"
  },
  "meta": {
    "timestamp": "2024-10-23T10:30:00.000Z",
    "warning": "Store this key safely. You will not be able to see it again."
  }
}
```

**Important**: The full API key is only shown once. Store it securely immediately. You cannot retrieve it later.

### 2. List API Keys

**Endpoint**: `GET /api/v1/apikeys`

**Authentication**: JWT Token

**Query Parameters**:
- `limit`: Number of keys to return (default: 50, max: 100)
- `skip`: Number of keys to skip for pagination (default: 0)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Production Bot",
      "keyPrefix": "aur_xxxx",
      "description": "Main trading bot",
      "permissions": ["strategy:read", "backtest:create"],
      "isActive": true,
      "rateLimit": 5000,
      "lastUsed": "2024-10-23T09:45:00.000Z",
      "expiresAt": "2025-12-31T23:59:59.000Z",
      "createdAt": "2024-10-20T08:15:00.000Z"
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "name": "Development Key",
      "keyPrefix": "aur_yyyy",
      "description": "For testing",
      "permissions": ["strategy:read", "strategy:create"],
      "isActive": false,
      "rateLimit": 1000,
      "lastUsed": "2024-10-22T15:30:00.000Z",
      "expiresAt": null,
      "createdAt": "2024-10-15T12:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2024-10-23T10:30:00.000Z",
    "page": 1,
    "limit": 50,
    "total": 2
  }
}
```

### 3. Get API Key Details

**Endpoint**: `GET /api/v1/apikeys/:keyId`

**Authentication**: JWT Token

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Production Bot",
    "keyPrefix": "aur_xxxx",
    "description": "Main trading bot",
    "permissions": ["strategy:read", "backtest:create"],
    "isActive": true,
    "rateLimit": 5000,
    "lastUsed": "2024-10-23T09:45:00.000Z",
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "createdAt": "2024-10-20T08:15:00.000Z",
    "updatedAt": "2024-10-23T09:45:00.000Z"
  },
  "meta": {
    "timestamp": "2024-10-23T10:30:00.000Z"
  }
}
```

### 4. Update API Key

**Endpoint**: `PATCH /api/v1/apikeys/:keyId`

**Authentication**: JWT Token

**Request Body** (all fields optional):
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "permissions": ["strategy:read", "strategy:create"],
  "isActive": false,
  "rateLimit": 2000
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Updated Name",
    "keyPrefix": "aur_xxxx",
    "description": "Updated description",
    "permissions": ["strategy:read", "strategy:create"],
    "isActive": false,
    "rateLimit": 2000,
    "lastUsed": "2024-10-23T09:45:00.000Z",
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "createdAt": "2024-10-20T08:15:00.000Z",
    "updatedAt": "2024-10-23T10:35:00.000Z"
  },
  "meta": {
    "timestamp": "2024-10-23T10:35:00.000Z"
  }
}
```

### 5. Revoke API Key

**Endpoint**: `DELETE /api/v1/apikeys/:keyId`

**Alternative**: `POST /api/v1/apikeys/:keyId/revoke`

**Authentication**: JWT Token

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "message": "API key successfully revoked"
  },
  "meta": {
    "timestamp": "2024-10-23T10:30:00.000Z"
  }
}
```

The DELETE endpoint permanently removes the key. The POST /revoke endpoint sets the key to inactive (soft delete).

### 6. Rotate API Key

**Endpoint**: `POST /api/v1/apikeys/:keyId/rotate`

**Authentication**: JWT Token

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd800000000",
    "name": "Production Bot",
    "keyPrefix": "aur_zzzz",
    "key": "aur_z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4",
    "description": "Main trading bot",
    "permissions": ["strategy:read", "backtest:create"],
    "rateLimit": 5000,
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "createdAt": "2024-10-23T10:40:00.000Z"
  },
  "meta": {
    "timestamp": "2024-10-23T10:40:00.000Z",
    "warning": "Old key has been deactivated. Store new key safely."
  }
}
```

The old API key is deactivated, and a new one is generated with the same properties.

### 7. Validate Current API Key

**Endpoint**: `GET /api/v1/apikeys/validate/current`

**Authentication**: JWT Token or API Key

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "userId": "507f1f77bcf86cd799439010",
    "email": "user@example.com",
    "username": "johndoe",
    "role": "trader"
  },
  "meta": {
    "timestamp": "2024-10-23T10:30:00.000Z"
  }
}
```

## Using API Keys

### In HTTP Requests

Use one of these header formats:

**Bearer Format**:
```bash
curl -H "Authorization: Bearer aur_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6" \
  https://api.example.com/api/v1/strategies
```

**ApiKey Format**:
```bash
curl -H "Authorization: ApiKey aur_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6" \
  https://api.example.com/api/v1/strategies
```

### In Python

```python
import requests

headers = {
    "Authorization": "Bearer aur_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
}

response = requests.get(
    "https://api.example.com/api/v1/strategies",
    headers=headers
)
```

### In JavaScript/Node.js

```javascript
const apiKey = "aur_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6";

const response = await fetch("https://api.example.com/api/v1/strategies", {
  headers: {
    "Authorization": `Bearer ${apiKey}`
  }
});

const data = await response.json();
```

## Permission Scopes

API keys can be scoped to specific permissions:

### Strategy Permissions
- `strategy:read` - Read strategies
- `strategy:create` - Create new strategies
- `strategy:update` - Update strategies
- `strategy:delete` - Delete strategies
- `strategy:validate` - Validate strategies

### Backtest Permissions
- `backtest:read` - Read backtest results
- `backtest:create` - Run backtests
- `backtest:cancel` - Cancel running backtests

### Optimization Permissions
- `optimize:read` - Read optimization results
- `optimize:create` - Run optimizations
- `optimize:cancel` - Cancel optimizations

### Deployment Permissions
- `deploy:paper` - Paper trading deployment
- `deploy:live` - Live trading deployment
- `deploy:approve` - Approve deployments
- `deploy:reject` - Reject deployments
- `deploy:stop` - Stop deployments

### Admin Permissions
- `user:manage` - Manage users
- `system:config` - System configuration
- `audit:view` - View audit logs

## Security Best Practices

1. **Store Keys Securely**
   - Never commit API keys to version control
   - Use environment variables or secure vaults
   - Use `.env` files with proper `.gitignore` configuration

2. **Rotate Keys Regularly**
   - Use the rotation endpoint to generate new keys
   - Update applications with new keys before deleting old ones
   - Rotate keys immediately if compromised

3. **Use Minimal Permissions**
   - Only grant permissions your integration actually needs
   - Avoid using keys with admin permissions

4. **Monitor Key Usage**
   - Regularly review the "Last Used" timestamp
   - Check for unexpected activity

5. **Set Expiration Dates**
   - For temporary integrations, set expiration dates
   - Helps prevent accidental long-term key exposure

6. **Use HTTPS**
   - Always transmit API keys over encrypted connections
   - Never use HTTP for API calls with authentication

7. **Implement Rate Limiting**
   - Each key has a configurable rate limit
   - Default: 1000 requests per hour
   - Adjust based on your needs

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Invalid API key"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "API key does not have required permissions"
  }
}
```

### 429 Rate Limited
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "API key not found"
  }
}
```

## Implementation Example: Trading Bot

```typescript
import axios from 'axios';

const API_KEY = process.env.STRATEGY_API_KEY;
const BASE_URL = "https://api.example.com/api/v1";

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Authorization": `Bearer ${API_KEY}`
  }
});

// Get all strategies
async function getStrategies() {
  const response = await client.get("/strategies");
  return response.data.data;
}

// Run backtest
async function runBacktest(strategyId: string) {
  const response = await client.post("/backtests", {
    strategyId,
    startDate: "2024-01-01",
    endDate: "2024-10-23"
  });
  return response.data.data;
}

// Get backtest results
async function getBacktestResults(backtestId: string) {
  const response = await client.get(`/backtests/${backtestId}`);
  return response.data.data;
}

// Main trading bot logic
async function runBot() {
  try {
    // Get available strategies
    const strategies = await getStrategies();

    // Run backtests for each strategy
    for (const strategy of strategies) {
      console.log(`Testing strategy: ${strategy.name}`);
      const backtest = await runBacktest(strategy.id);

      // Wait for backtest completion
      let status = backtest.status;
      while (status === "running") {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const result = await getBacktestResults(backtest.id);
        status = result.status;
      }

      // Process results
      if (status === "completed") {
        console.log(`Strategy ${strategy.name} metrics:`, result.metrics);
      }
    }
  } catch (error) {
    console.error("Bot error:", error.response?.data || error.message);
  }
}

// Run the bot
runBot();
```

## Troubleshooting

### "Invalid API key" Error
- Ensure you're using the full key (starts with `aur_`)
- Check that the key is active and not expired
- Verify the Authorization header format

### "Rate limit exceeded" Error
- Check your key's rate limit setting
- Implement exponential backoff in your client
- Contact support to increase limits if needed

### "Key not found" Error
- The key may have been revoked
- Regenerate a new API key
- Ensure you're using the correct key

## Monitoring & Audit

### View Key Usage
```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  https://api.example.com/api/v1/apikeys
```

The response includes `lastUsed` timestamp for each key.

### Automatic Expiration
Keys automatically expire based on the `expiresAt` date. After expiration:
- The key cannot be used for authentication
- Requests return 401 Unauthorized
- No automatic deletion; key remains in history

### Audit Trail
All API key operations are logged:
- Key creation
- Key updates
- Key revocation
- Failed authentication attempts

## Support & Questions

For issues or questions about API key management, please refer to:
- The main API documentation
- Codebase examples in `/examples`
- Support channels

---

**Last Updated**: October 23, 2024
**Version**: 1.0.0
