# Self-Generated SPI (Service Provider Interface) System

## Overview

The Self-Generated SPI system automatically creates Service Provider Interfaces from user email IDs. This system allows each user to have their own service provider that can be discovered, managed, and utilized throughout the application.

**Key Concept**: Email-driven service discovery where each user's email is a unique service identifier.

## Architecture

```
User Registration
    ↓
Email ID Captured
    ↓
SPI Auto-Generated (Email → Service Provider)
    ↓
Service Registered in Registry
    ↓
Available for Discovery & Use
```

## Core Components

### 1. Types & Interfaces (`src/services/spi/types.ts`)

#### ServiceProvider Interface
```typescript
interface ServiceProvider {
  name: string;
  version: string;
  description: string;
  email: string;                      // User's email
  capabilities: string[];             // What this service can do

  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  health(): Promise<HealthStatus>;
  getMetadata(): ServiceMetadata;
}
```

#### ServiceMetadata
```typescript
interface ServiceMetadata {
  id: string;                         // Unique service ID
  email: string;                      // User's email
  name: string;                       // Service name
  capabilities: string[];             // Service capabilities
  isActive: boolean;                  // Active/inactive flag
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. SPI Registry (`src/services/spi/registry.ts`)

Central management system for all registered services.

**Key Methods:**
- `registerService()` - Register a new service
- `unregisterService()` - Unregister a service
- `discoverServices()` - Find services by email, capability, or name
- `getService()` - Get a specific service
- `healthCheck()` - Check service health
- `getStats()` - Get registry statistics

**Features:**
- Email-based indexing for fast lookup
- Event emissions on service registration/unregistration
- Automatic health checking with configurable intervals
- Event listener system for reactive updates

### 3. Email-Based SPI Loader (`src/services/spi/loader.ts`)

Auto-generates service providers from user emails.

**Base Classes:**

**BaseServiceProvider**
- Implements common ServiceProvider functionality
- Tracks initialization, request count, error count
- Provides health status metrics

**EmailSPIProvider**
- Extends BaseServiceProvider
- Parses email into components (local part, domain)
- Auto-generates service name from email template
- Auto-generates capabilities based on email domain
- Matches email patterns

**DemoEmailSPIProvider**
- Demo implementation for testing
- Simulates service operations
- Caches responses

**SPILoader Class**
```typescript
const loader = new SPILoader(registry);

// Load SPI from email
const provider = await loader.loadFromEmail('user@example.com', {
  name: 'Custom Name',
  description: 'Service description',
  capabilities: ['custom:capability']
});

// Load multiple
const providers = await loader.loadMultiple([
  'user1@example.com',
  'user2@example.com'
]);
```

### 4. Middleware (`src/services/spi/middleware.ts`)

Express middleware for SPI integration.

**Key Middleware:**
- `attachSPIRegistry()` - Add registry to request
- `requireSPIAuth()` - Require user authentication and SPI
- `autoCreateUserSPI()` - Auto-generate SPI if doesn't exist
- `getUserSPI()` - Get user's SPI or error
- `enrichSPIContext()` - Add SPI context to request
- `validateSPIRequest()` - Validate SPI context

### 5. Routes (`src/services/spi/routes.ts`)

RESTful endpoints for SPI management.

## API Endpoints

### 1. Generate/Create SPI from Email

**Endpoint**: `POST /api/v1/spi/generate`

**Authentication**: JWT Token

**Request Body**:
```json
{
  "name": "Custom Service Name",
  "description": "Service description"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "spi_a1b2c3d4e5f6g7h8",
    "name": "Custom Service Name",
    "email": "user@example.com",
    "version": "1.0.0",
    "description": "Service description",
    "capabilities": [
      "email:user@example.com",
      "domain:example.com",
      "user:user",
      "service:read",
      "service:execute",
      "service:health",
      "service:metadata"
    ]
  }
}
```

### 2. Get Current User's SPI

**Endpoint**: `GET /api/v1/spi/me`

**Authentication**: JWT Token

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "spi_a1b2c3d4e5f6g7h8",
    "email": "user@example.com",
    "name": "user-service",
    "version": "1.0.0",
    "capabilities": [...],
    "isActive": true,
    "createdAt": "2024-10-23T10:00:00Z",
    "lastHealthCheck": "2024-10-23T10:30:00Z",
    "healthStatus": {
      "status": "healthy",
      "message": "Service is operational",
      "uptime": 1800000,
      "metrics": {
        "requestsProcessed": 150,
        "errorsEncountered": 2,
        "averageResponseTime": 12
      }
    }
  }
}
```

### 3. Discover Services

**Endpoint**: `GET /api/v1/spi/discover`

**Query Parameters**:
- `email` - Find service by email
- `capability` - Find services with capability
- `name` - Find services by name (partial match)

**Example**: `GET /api/v1/spi/discover?capability=service:execute`

**Response**:
```json
{
  "success": true,
  "data": {
    "found": true,
    "count": 3,
    "services": [
      {
        "id": "spi_xxx",
        "email": "user1@example.com",
        "name": "user1-service",
        "version": "1.0.0",
        "capabilities": ["service:execute", "service:read"],
        "isActive": true
      },
      ...
    ],
    "criteria": {
      "capability": "service:execute"
    }
  }
}
```

### 4. Get Service Health

**Endpoint**: `GET /api/v1/spi/health/:email`

**Response**:
```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "health": {
      "status": "healthy",
      "message": "Service is operational",
      "uptime": 1800000,
      "metrics": {
        "requestsProcessed": 150,
        "errorsEncountered": 2,
        "averageResponseTime": 12
      }
    }
  }
}
```

### 5. Get Registry Statistics

**Endpoint**: `GET /api/v1/spi/stats`

**Response**:
```json
{
  "success": true,
  "data": {
    "totalServices": 42,
    "activeServices": 38,
    "servicesByCapability": {
      "service:execute": 32,
      "service:read": 42,
      "domain:example.com": 10
    },
    "servicesByEmail": {
      "user1@example.com": 1,
      "user2@example.com": 1
    },
    "capabilities": ["service:execute", "service:read", ...]
  }
}
```

### 6. List All Services

**Endpoint**: `GET /api/v1/spi/all`

**Response**:
```json
{
  "success": true,
  "data": {
    "count": 42,
    "services": [
      {
        "id": "spi_xxx",
        "email": "user@example.com",
        "name": "user-service",
        "version": "1.0.0",
        "capabilities": [...],
        "isActive": true,
        "createdAt": "2024-10-23T10:00:00Z"
      }
    ]
  }
}
```

### 7. Get Services by Email

**Endpoint**: `GET /api/v1/spi/by-email/:email`

**Response**:
```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "count": 1,
    "services": [...]
  }
}
```

### 8. Update Service Configuration

**Endpoint**: `PATCH /api/v1/spi/:email`

**Request Body**:
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "isActive": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "spi_xxx",
    "email": "user@example.com",
    "name": "Updated Name",
    "isActive": false
  }
}
```

### 9. Delete/Unregister Service

**Endpoint**: `DELETE /api/v1/spi/:email`

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Service unregistered: user@example.com"
  }
}
```

### 10. Trigger Health Check

**Endpoint**: `POST /api/v1/spi/:email/health-check`

**Response**:
```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "health": {
      "status": "healthy",
      "message": "Service is operational",
      "uptime": 1800000,
      "metrics": {...}
    }
  }
}
```

## Usage Examples

### Basic SPI Generation

```typescript
import { SPILoader } from './src/services/spi/loader';
import { SPIRegistry } from './src/services/spi/registry';

const registry = new SPIRegistry();
const loader = new SPILoader(registry);

// Load SPI from email
const provider = await loader.loadFromEmail('john@example.com', {
  name: 'John\'s Service',
  description: 'Trading bot service'
});

// Service is now registered and discoverable
```

### Service Discovery

```typescript
// Find by email
const result = await registry.discoverServices({
  email: 'john@example.com'
});

// Find by capability
const services = await registry.discoverServices({
  capability: 'service:execute'
});

// Find by name
const matches = await registry.discoverServices({
  name: 'trading'
});
```

### Health Monitoring

```typescript
// Check service health
const health = await registry.healthCheck('john@example.com');

console.log(health.status);        // 'healthy', 'degraded', 'unhealthy'
console.log(health.metrics);       // Detailed metrics

// Start automatic health checks
registry.startHealthChecks();      // Check every 60 seconds
// registry.stopHealthChecks();
```

### Event Listening

```typescript
// Listen to service registration
registry.addEventListener('john@example.com', 'registered', async (event) => {
  console.log('Service registered:', event.data);
});

// Listen to service events
registry.addEventListener('john@example.com', 'health-check', async (event) => {
  console.log('Health check completed:', event.data);
});

// Emit custom event
await registry.emitSPIEvent({
  type: 'custom:event',
  source: 'john@example.com',
  sourceEmail: 'john@example.com',
  timestamp: new Date(),
  data: { /* custom data */ }
});
```

### Express Integration

```typescript
import { createSPIRoutes } from './src/services/spi';
import { autoCreateUserSPI } from './src/services/spi/middleware';
import express from 'express';

const app = express();
const registry = new SPIRegistry();

// Register SPI routes
app.use('/api/v1/spi', createSPIRoutes(registry));

// Auto-create SPI for authenticated users
app.use('/api/v1/protected', autoCreateUserSPI(registry));

// Now req.userSPI is available
app.get('/api/v1/protected/profile', (req, res) => {
  console.log(req.userSPI.email); // User's email
  console.log(req.userSPI.metadata.capabilities);
});
```

## Email-Based Service Naming

Services are auto-named from the email using templates:

**Default Template**: `{localPart}-service`

**Examples**:
- `john@example.com` → `john-service`
- `alice.smith@company.org` → `alice-service`
- `bot-trader@invest.io` → `bot-trader-service`

**Custom Templates**:
```typescript
const loader = new SPILoader(registry, {
  nameTemplate: '{localPart}-{domain}-svc',
  versionTemplate: '2.0.0',
  capabilityPattern: 'email:*'
});
```

## Auto-Generated Capabilities

Each SPI automatically receives these capabilities:

1. **Email-based**:
   - `email:user@example.com` - Specific email
   - `domain:example.com` - Email domain
   - `user:username` - Local part

2. **Standard Service**:
   - `service:read` - Read operations
   - `service:execute` - Execute operations
   - `service:health` - Health checks
   - `service:metadata` - Get metadata

## Service Lifecycle

```
1. USER REGISTRATION
   Email captured: john@example.com

2. SPI AUTO-GENERATION
   - Service created from email
   - Name: john-service
   - Capabilities: auto-generated
   - Status: inactive (pending initialization)

3. INITIALIZATION
   - Service.initialize() called
   - Registered in SPIRegistry
   - Status: active
   - Made discoverable

4. ACTIVE SERVICE
   - Available for discovery
   - Accepts requests
   - Health checks executed
   - Events emitted

5. UNREGISTRATION
   - Service.shutdown() called
   - Removed from registry
   - No longer discoverable
   - History preserved
```

## Health Checks

### Automatic Health Checks

```typescript
// Start checking every 60 seconds
registry.startHealthChecks();

// Check specific service manually
const health = await registry.healthCheck('john@example.com');
```

### Health Status States

| Status | Description |
|--------|-------------|
| `healthy` | Service operational and responsive |
| `degraded` | Service operational but with issues |
| `unhealthy` | Service not responding or failed |

### Metrics Provided

```typescript
{
  requestsProcessed: 150,      // Total requests handled
  errorsEncountered: 2,        // Total errors
  averageResponseTime: 12      // Average response time (ms)
}
```

## Event System

### Event Types

- `service:registered` - Service registered
- `service:unregistered` - Service unregistered
- `service:updated` - Service configuration updated
- `service:health` - Health check completed
- Custom events with `custom:` prefix

### Event Structure

```typescript
interface SPIEvent {
  type: string;                    // Event type
  source: string;                  // Service ID
  sourceEmail: string;             // Service email
  timestamp: Date;                 // When event occurred
  data?: unknown;                  // Event-specific data
  metadata?: Record<string, any>;  // Additional metadata
}
```

## Security Considerations

1. **Email Uniqueness**: Each email generates a unique SPI
2. **Service Isolation**: Services can only access their own capabilities
3. **Permission Scoping**: Capabilities limit what each service can do
4. **Health Verification**: Regular health checks ensure service integrity
5. **Audit Trail**: Events logged for all operations

## Performance Optimization

1. **Indexing**: Email-based fast lookup (O(1))
2. **Caching**: Registry maintains in-memory cache
3. **Async Operations**: All I/O is non-blocking
4. **Event-Driven**: Reactive updates without polling
5. **Configurable Intervals**: Adjust health check frequency

## Error Handling

### SPIError Class

```typescript
class SPIError extends Error {
  code: string;
  details?: unknown;
}
```

### Common Error Codes

| Code | Meaning |
|------|---------|
| `NOT_FOUND` | Service not found |
| `REGISTRATION_FAILED` | Service registration error |
| `HEALTH_CHECK_FAILED` | Health check error |
| `UNREGISTRATION_FAILED` | Unregistration error |
| `INVALID_REQUEST` | Invalid request format |

## Testing

### Demo SPI Provider

For testing, use `DemoEmailSPIProvider`:

```typescript
import { DemoEmailSPIProvider } from './src/services/spi';

const config: SPIConfiguration = {
  email: 'test@example.com',
  name: 'Test Service',
  version: '1.0.0',
  description: 'For testing',
  capabilities: ['test:*']
};

const demoProvider = new DemoEmailSPIProvider(config);
await registry.registerService(demoProvider);

// Execute test operation
const result = await demoProvider.execute('test:operation', {
  param1: 'value1'
});
```

## Integration with API Keys

SPIs can be integrated with the existing API Key system:

```typescript
// API Key scoped to specific SPI
const apiKey = {
  name: 'SPI Integration Key',
  permissions: ['service:execute', `service:${userSPI.email}`],
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
};
```

## Migration Guide

### From Single Service to SPI

Before:
```typescript
// Single monolithic service
const service = new MonolithicService();
```

After:
```typescript
// SPI per user email
const loader = new SPILoader(registry);
const userSPI = await loader.loadFromEmail(user.email);
```

## Best Practices

1. **Auto-Creation**: Use `autoCreateUserSPI` middleware for automatic SPI creation
2. **Health Monitoring**: Enable automatic health checks in production
3. **Event Handling**: Listen to service events for reactive updates
4. **Graceful Shutdown**: Always call `unregisterService()` on app shutdown
5. **Capability Scoping**: Grant only necessary capabilities to services
6. **Error Handling**: Implement proper error handlers for SPI failures

## Future Enhancements

1. **SPI Chaining**: Services can call other services
2. **Request Routing**: Route requests based on email patterns
3. **Load Balancing**: Distribute requests across multiple SPI instances
4. **Persistence**: Store SPI registry in database
5. **Webhooks**: Notify external systems of SPI events
6. **Monitoring Dashboard**: Real-time SPI statistics and health

---

**Version**: 1.0.0
**Status**: Production Ready
**Last Updated**: October 23, 2024
