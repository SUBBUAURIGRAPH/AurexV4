# Self-Generated SPI - Quick Start Guide

## 5-Minute Setup

### Step 1: Initialize Registry

```typescript
import { SPIRegistry } from './src/services/spi';

const spiRegistry = new SPIRegistry();
spiRegistry.startHealthChecks(); // Auto-check every 60 seconds
```

### Step 2: Create SPI from User Email

```typescript
import { SPILoader } from './src/services/spi';

const loader = new SPILoader(spiRegistry);

// Auto-generate SPI from email
const provider = await loader.loadFromEmail('john@example.com', {
  name: 'John Trading Bot',
  description: 'Automated trading service'
});

console.log(provider.capabilities);
// Output: ["email:john@example.com", "domain:example.com", "user:john",
//          "service:read", "service:execute", "service:health", "service:metadata"]
```

### Step 3: Discover Services

```typescript
// Find by email
const result = await spiRegistry.discoverServices({
  email: 'john@example.com'
});

console.log(result.found);           // true
console.log(result.services.length); // 1

// Find by capability
const services = await spiRegistry.discoverServices({
  capability: 'service:execute'
});

console.log(services.services);      // All services with execute capability
```

### Step 4: Check Service Health

```typescript
// Get health status
const health = await spiRegistry.healthCheck('john@example.com');

console.log(health.status);          // 'healthy'
console.log(health.metrics);         // { requestsProcessed, errorsEncountered, ... }
```

### Step 5: Use in Express

```typescript
import { createSPIRoutes, autoCreateUserSPI } from './src/services/spi';

// Register SPI routes
app.use('/api/v1/spi', createSPIRoutes(spiRegistry));

// Auto-create SPI for authenticated users
app.use('/api/v1/protected', autoCreateUserSPI(spiRegistry));

// Access user's SPI in handlers
app.get('/api/v1/protected/my-spi', (req, res) => {
  const userSPI = req.userSPI;
  res.json({
    email: userSPI.email,
    name: userSPI.metadata.name,
    capabilities: userSPI.metadata.capabilities
  });
});
```

---

## Common Operations

### Create SPI for User During Registration

```typescript
// In user registration handler
async function registerUser(email, password) {
  const user = await User.create({ email, password });

  // Auto-generate SPI
  const loader = new SPILoader(spiRegistry);
  await loader.loadFromEmail(email, {
    name: `${user.username}-service`,
    description: `Service for ${user.username}`
  });

  return user;
}
```

### Load Multiple SPIs

```typescript
const emails = [
  'user1@example.com',
  'user2@example.com',
  'user3@example.com'
];

const loader = new SPILoader(spiRegistry);
const providers = await loader.loadMultiple(emails);

console.log(`Loaded ${providers.length} services`);
```

### Get Service by Email

```typescript
const service = spiRegistry.getService('john@example.com');

if (service) {
  console.log(service.metadata.name);
  console.log(service.metadata.capabilities);
}
```

### Update Service Configuration

```typescript
const updated = await spiRegistry.updateService('john@example.com', {
  name: 'New Service Name',
  isActive: false
});
```

### Remove Service

```typescript
await spiRegistry.unregisterService('john@example.com');
```

---

## API Usage

### Generate SPI via HTTP

```bash
curl -X POST http://localhost:3000/api/v1/spi/generate \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Trading Bot",
    "description": "Automated trading service"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "spi_a1b2c3d4e5f6g7h8",
    "name": "My Trading Bot",
    "email": "user@example.com",
    "version": "1.0.0",
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

### Get My SPI

```bash
curl http://localhost:3000/api/v1/spi/me \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Discover Services

```bash
# By email
curl http://localhost:3000/api/v1/spi/discover?email=user@example.com \
  -H "Authorization: Bearer <JWT_TOKEN>"

# By capability
curl http://localhost:3000/api/v1/spi/discover?capability=service:execute \
  -H "Authorization: Bearer <JWT_TOKEN>"

# By name pattern
curl http://localhost:3000/api/v1/spi/discover?name=trading \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Check Health

```bash
curl http://localhost:3000/api/v1/spi/health/user@example.com \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Get Statistics

```bash
curl http://localhost:3000/api/v1/spi/stats \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

## Event Listening

### Listen to Service Registration

```typescript
spiRegistry.addEventListener('user@example.com', 'registered', async (event) => {
  console.log('Service registered!', event);
});
```

### Listen to Health Events

```typescript
spiRegistry.on('service:health', ({ service, health }) => {
  console.log(`${service.email}: ${health.status}`);
});
```

### Listen to All Registry Events

```typescript
spiRegistry.on('service:registered', (entry) => {
  console.log('Registered:', entry.metadata.name);
});

spiRegistry.on('service:unregistered', (entry) => {
  console.log('Unregistered:', entry.metadata.name);
});

spiRegistry.on('service:updated', (entry) => {
  console.log('Updated:', entry.metadata.name);
});
```

---

## Troubleshooting

### SPI Not Found

```typescript
const service = spiRegistry.getService('user@example.com');
if (!service) {
  console.log('Service not registered for this email');

  // Create it
  const loader = new SPILoader(spiRegistry);
  await loader.loadFromEmail('user@example.com');
}
```

### Service Appears Unhealthy

```typescript
const health = await spiRegistry.healthCheck('user@example.com');

if (health.status !== 'healthy') {
  console.log(health.message);
  console.log(health.metrics);

  // Could indicate service is overloaded or erroring
}
```

### Capabilities Not as Expected

```typescript
// Check what capabilities were auto-generated
const service = spiRegistry.getService('user@example.com');
console.log(service.metadata.capabilities);

// Update if needed
await spiRegistry.updateService('user@example.com', {
  capabilities: ['custom:capability', 'service:read']
});
```

---

## Best Practices

### 1. Auto-Create on User Registration

```typescript
// User signs up
// SPI is automatically created with their email
// They get a fully functional service immediately
```

### 2. Monitor Service Health

```typescript
// Enable automatic health checks
spiRegistry.startHealthChecks();

// Listen for unhealthy services
spiRegistry.on('service:health', ({ service, health }) => {
  if (health.status === 'unhealthy') {
    // Send alert
    console.error(`Service ${service.email} is unhealthy!`);
  }
});
```

### 3. Use Email as Service ID

```typescript
// Email is unique and human-readable
// Use it directly instead of separate IDs
const userEmail = 'john@example.com';
const service = spiRegistry.getService(userEmail);
```

### 4. Leverage Auto-Generated Capabilities

```typescript
// Don't manually assign all capabilities
// Let the system auto-generate based on email domain
// Only customize when necessary
```

### 5. Clean Shutdown

```typescript
// On app shutdown
spiRegistry.stopHealthChecks();
await spiRegistry.clearAll();
```

---

## Code Examples

### Complete User Registration

```typescript
import { SPILoader } from './src/services/spi';

async function registerUser(email, password, username) {
  // Create user
  const user = await User.create({ email, password, username });

  // Auto-create SPI from email
  const loader = new SPILoader(spiRegistry);
  const provider = await loader.loadFromEmail(email, {
    name: `${username}-service`,
    description: `Service for ${username}`
  });

  console.log(`User ${username} registered with SPI`);
  console.log(`Service capabilities:`, provider.capabilities);

  return user;
}
```

### Service Discovery with Filtering

```typescript
async function findActiveServices() {
  // Get all active services
  const discovery = await spiRegistry.discoverServices({});

  const activeServices = discovery.services.filter(s =>
    s.metadata.isActive
  );

  return activeServices;
}
```

### Health Monitoring Dashboard

```typescript
async function getServiceDashboard() {
  const stats = spiRegistry.getStats();
  const services = spiRegistry.getAllServices();

  const dashboard = {
    totalServices: stats.totalServices,
    activeServices: stats.activeServices,
    healthStatus: [],
    recentErrors: []
  };

  // Get health status for each service
  for (const service of services) {
    const health = await spiRegistry.healthCheck(service.email);
    dashboard.healthStatus.push({
      email: service.email,
      status: health.status,
      uptime: health.uptime
    });
  }

  return dashboard;
}
```

---

## Next Steps

1. ✅ Understand SPI concept (email = service)
2. ✅ Initialize registry in your app
3. ✅ Auto-create SPIs for users
4. ✅ Discover services for routing
5. ✅ Monitor service health
6. ✅ Integrate with Express routes
7. Review full documentation: `SPI_DOCUMENTATION.md`

---

**Version**: 1.0.0
**Updated**: October 23, 2024
