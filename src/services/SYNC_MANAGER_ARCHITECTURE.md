# Sync Manager Architecture

Comprehensive architecture documentation for the HMS Sync Manager service

**Version:** 1.0.0
**Last Updated:** November 2, 2025

## Table of Contents

- [Overview](#overview)
- [Architecture Diagram](#architecture-diagram)
- [Core Components](#core-components)
- [Design Patterns](#design-patterns)
- [Synchronization Strategies](#synchronization-strategies)
- [Conflict Resolution](#conflict-resolution)
- [Data Flow](#data-flow)
- [Performance Considerations](#performance-considerations)
- [Security](#security)
- [Scalability](#scalability)

---

## Overview

The Sync Manager is a critical component of the HMS Trading Platform responsible for maintaining data consistency between local and remote systems. It provides real-time synchronization, conflict resolution, and data validation capabilities.

### Key Features

- **Full Synchronization**: Complete data sync from remote to local
- **Incremental Sync**: Sync only changed data since last sync
- **Real-time Sync**: Push changes immediately as they occur
- **Conflict Resolution**: Automatic and manual conflict resolution strategies
- **Queue Management**: Reliable operation queuing with retry logic
- **Audit Logging**: Complete audit trail for compliance
- **Data Validation**: Schema and business rule validation

### Design Goals

1. **Reliability**: Ensure no data loss during synchronization
2. **Performance**: Minimize sync latency and resource usage
3. **Scalability**: Handle millions of records efficiently
4. **Consistency**: Maintain data integrity across systems
5. **Resilience**: Recover gracefully from failures

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        HMS Trading Platform                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Sync Manager                             │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │              │    │              │    │              │     │
│  │   Sync       │───▶│   Conflict   │───▶│   Data       │     │
│  │   Engine     │    │   Resolver   │    │   Validator  │     │
│  │              │    │              │    │              │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │              │    │              │    │              │     │
│  │   Sync       │    │   Audit      │    │   Event      │     │
│  │   Queue      │    │   Logger     │    │   Bus        │     │
│  │              │    │              │    │              │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────┐
        │                                      │
        ▼                                      ▼
┌───────────────┐                    ┌───────────────┐
│               │                    │               │
│  Local        │                    │  Remote       │
│  Database     │                    │  API          │
│  (PostgreSQL) │                    │  (REST/WS)    │
│               │                    │               │
└───────────────┘                    └───────────────┘
```

---

## Core Components

### 1. Sync Engine

The Sync Engine is the core orchestrator that manages all synchronization operations.

**Responsibilities:**
- Coordinate sync operations
- Manage sync lifecycle
- Track sync progress
- Handle errors and retries

**Key Methods:**
```typescript
interface SyncEngine {
  // Start full synchronization
  fullSync(options: SyncOptions): Promise<SyncResult>;

  // Start incremental synchronization
  incrementalSync(since: Date): Promise<SyncResult>;

  // Start real-time synchronization
  realtimeSync(): Promise<void>;

  // Pause/resume synchronization
  pause(): void;
  resume(): void;

  // Get sync status
  getStatus(): SyncStatus;
}
```

**Implementation Pattern:**
```
┌─────────────────────────────────────────┐
│           Sync Engine                   │
│                                         │
│  1. Initialize sync session             │
│  2. Fetch remote data                   │
│  3. Compare with local data             │
│  4. Identify changes                    │
│  5. Resolve conflicts                   │
│  6. Apply changes                       │
│  7. Update metadata                     │
│  8. Complete sync session               │
└─────────────────────────────────────────┘
```

---

### 2. Conflict Resolver

Handles data conflicts when local and remote versions differ.

**Conflict Types:**
- **Update-Update**: Both local and remote modified
- **Update-Delete**: Local updated, remote deleted
- **Create-Create**: Same entity created in both places

**Resolution Strategies:**
```typescript
enum ConflictStrategy {
  KEEP_LOCAL = 'keep_local',
  KEEP_REMOTE = 'keep_remote',
  KEEP_LATEST = 'keep_latest',
  MERGE = 'merge',
  MANUAL = 'manual'
}

interface ConflictResolver {
  detect(local: Entity, remote: Entity): Conflict[];
  resolve(conflict: Conflict, strategy: ConflictStrategy): Entity;
  queue(conflict: Conflict): void;
}
```

**Resolution Flow:**
```
                 ┌────────────┐
                 │  Conflict  │
                 │  Detected  │
                 └──────┬─────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Apply Resolution     │
            │  Strategy             │
            └───────┬───────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│  Automatic    │       │  Manual       │
│  Resolution   │       │  Resolution   │
└───────┬───────┘       └───────┬───────┘
        │                       │
        └───────────┬───────────┘
                    │
                    ▼
            ┌───────────────┐
            │  Apply        │
            │  Resolution   │
            └───────────────┘
```

---

### 3. Sync Queue

Manages the queue of pending sync operations with retry logic.

**Features:**
- Priority-based queuing
- Automatic retry with exponential backoff
- Dead letter queue for failed operations
- Persistence across restarts

**Queue Structure:**
```typescript
interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  data: any;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  error?: string;
}
```

**Processing Flow:**
```
┌────────────┐
│  Enqueue   │
└──────┬─────┘
       │
       ▼
┌────────────────────┐
│  Priority Sort     │
└──────┬─────────────┘
       │
       ▼
┌────────────────────┐
│  Dequeue (FIFO     │
│  within priority)  │
└──────┬─────────────┘
       │
       ▼
┌────────────────────┐
│  Process           │
└──────┬─────────────┘
       │
    Success?
    /     \
   Yes    No
   │      │
   ▼      ▼
┌────┐  ┌──────────┐
│Done│  │ Retry?   │
└────┘  └────┬─────┘
            Yes│ No
            │  │
            │  ▼
            │ ┌─────┐
            │ │ DLQ │
            │ └─────┘
            │
            ▼
        ┌────────────┐
        │ Re-enqueue │
        │ (backoff)  │
        └────────────┘
```

---

### 4. Audit Logger

Maintains comprehensive audit trail for compliance and debugging.

**Log Structure:**
```typescript
interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SYNC';
  entityType: string;
  entityId: string;
  changes: {
    [field: string]: {
      from: any;
      to: any;
    };
  };
  metadata: {
    source: string;
    syncId?: string;
    ipAddress?: string;
    userAgent?: string;
  };
}
```

**Features:**
- Immutable logs
- Indexed for fast querying
- Compressed for storage efficiency
- Retention policy enforcement

---

### 5. Data Validator

Validates data against schemas and business rules.

**Validation Levels:**
1. **Schema Validation**: Validate against type definitions
2. **Business Rules**: Validate against domain logic
3. **Cross-field Validation**: Validate field relationships
4. **Custom Validation**: User-defined validators

**Validator Interface:**
```typescript
interface Validator {
  validateSchema(data: any, schema: Schema): ValidationResult;
  validateBusinessRules(data: any, rules: Rule[]): ValidationResult;
  sanitize(data: any): any;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
```

---

## Design Patterns

### 1. Event Sourcing

All changes are stored as a sequence of events.

**Benefits:**
- Complete audit trail
- Easy to replay events
- Supports temporal queries

**Implementation:**
```typescript
interface Event {
  id: string;
  type: string;
  aggregate: string;
  aggregateId: string;
  data: any;
  timestamp: Date;
  version: number;
}

class EventStore {
  append(event: Event): Promise<void>;
  getEvents(aggregateId: string, from?: number): Promise<Event[]>;
  replay(aggregateId: string): Promise<Entity>;
}
```

---

### 2. CQRS (Command Query Responsibility Segregation)

Separate read and write models.

**Command Side:**
```typescript
interface Command {
  execute(data: any): Promise<void>;
  validate(data: any): ValidationResult;
}

class CreateOrderCommand implements Command {
  async execute(data: OrderData): Promise<void> {
    // Validate
    const validation = this.validate(data);
    if (!validation.valid) throw new Error();

    // Create order
    const order = await this.orderRepository.create(data);

    // Publish event
    await this.eventBus.publish(new OrderCreatedEvent(order));
  }
}
```

**Query Side:**
```typescript
interface Query<T> {
  execute(): Promise<T>;
}

class GetOrdersQuery implements Query<Order[]> {
  async execute(): Promise<Order[]> {
    return await this.orderRepository.findAll();
  }
}
```

---

### 3. Repository Pattern

Abstract data access logic.

```typescript
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(filter?: Filter): Promise<T[]>;
  create(entity: T): Promise<T>;
  update(id: string, entity: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

class OrderRepository implements Repository<Order> {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Order | null> {
    const row = await this.db.query('SELECT * FROM orders WHERE id = $1', [id]);
    return row ? this.mapToOrder(row) : null;
  }

  // ... other methods
}
```

---

### 4. Strategy Pattern

Flexible conflict resolution strategies.

```typescript
interface ResolutionStrategy {
  resolve(local: Entity, remote: Entity): Entity;
}

class KeepLatestStrategy implements ResolutionStrategy {
  resolve(local: Entity, remote: Entity): Entity {
    return local.updatedAt > remote.updatedAt ? local : remote;
  }
}

class MergeStrategy implements ResolutionStrategy {
  resolve(local: Entity, remote: Entity): Entity {
    return {
      ...remote,
      ...local,
      updatedAt: Math.max(local.updatedAt, remote.updatedAt)
    };
  }
}

class ConflictResolver {
  constructor(private strategy: ResolutionStrategy) {}

  resolve(local: Entity, remote: Entity): Entity {
    return this.strategy.resolve(local, remote);
  }
}
```

---

## Synchronization Strategies

### Full Sync

Complete synchronization of all data.

**When to Use:**
- Initial sync
- After extended offline period
- Data integrity check

**Process:**
1. Fetch all remote data
2. Compare with local data
3. Identify changes (CREATE, UPDATE, DELETE)
4. Apply changes in order
5. Update sync metadata

**Performance Optimization:**
- Batch processing (100-1000 records per batch)
- Parallel processing where possible
- Stream large datasets
- Use compression

**Code Example:**
```typescript
async fullSync(): Promise<SyncResult> {
  const session = await this.createSyncSession('FULL');

  try {
    // Fetch remote data in batches
    let offset = 0;
    const batchSize = 1000;
    let totalSynced = 0;

    while (true) {
      const batch = await this.fetchRemoteBatch(offset, batchSize);
      if (batch.length === 0) break;

      // Process batch
      const changes = await this.identifyChanges(batch);
      await this.applyChanges(changes);

      totalSynced += batch.length;
      offset += batchSize;

      // Update progress
      await this.updateProgress(session.id, totalSynced);
    }

    await this.completeSyncSession(session.id, 'COMPLETED');
    return { success: true, recordsSynced: totalSynced };

  } catch (error) {
    await this.completeSyncSession(session.id, 'FAILED', error);
    throw error;
  }
}
```

---

### Incremental Sync

Sync only changes since last sync.

**When to Use:**
- Regular sync intervals
- After short offline periods
- Continuous operation

**Process:**
1. Get last sync timestamp
2. Fetch changes since timestamp
3. Apply changes
4. Update sync timestamp

**Benefits:**
- Faster than full sync
- Less network bandwidth
- Lower resource usage

**Code Example:**
```typescript
async incrementalSync(since: Date): Promise<SyncResult> {
  const session = await this.createSyncSession('INCREMENTAL');

  try {
    // Fetch changes since last sync
    const changes = await this.fetchChangesSince(since);

    // Apply changes
    for (const change of changes) {
      await this.applyChange(change);
    }

    // Update last sync timestamp
    await this.updateLastSyncTime(new Date());

    await this.completeSyncSession(session.id, 'COMPLETED');
    return { success: true, recordsSynced: changes.length };

  } catch (error) {
    await this.completeSyncSession(session.id, 'FAILED', error);
    throw error;
  }
}
```

---

### Real-time Sync

Push changes immediately as they occur.

**When to Use:**
- Critical real-time data
- High-frequency trading
- Live collaboration

**Implementation:**
- WebSocket connection
- Event-driven architecture
- Push notifications

**Code Example:**
```typescript
async realtimeSync(): Promise<void> {
  // Establish WebSocket connection
  const ws = await this.connectWebSocket();

  // Listen for changes
  ws.on('change', async (change) => {
    await this.queueChange(change);
  });

  // Local changes observer
  this.localDb.observe('changes', async (change) => {
    await this.pushChange(ws, change);
  });

  // Handle connection issues
  ws.on('close', () => {
    this.handleDisconnect();
  });
}
```

---

## Conflict Resolution

### Detection

Conflicts occur when local and remote versions of the same entity differ.

**Detection Logic:**
```typescript
function detectConflict(local: Entity, remote: Entity): boolean {
  // Same version but different data
  if (local.version === remote.version) {
    return !isEqual(local, remote);
  }

  // Both modified since last sync
  if (local.updatedAt > lastSyncTime && remote.updatedAt > lastSyncTime) {
    return true;
  }

  return false;
}
```

---

### Resolution Strategies

**1. Keep Latest (Default)**
```typescript
function keepLatest(local: Entity, remote: Entity): Entity {
  return local.updatedAt > remote.updatedAt ? local : remote;
}
```

**2. Keep Local**
```typescript
function keepLocal(local: Entity, remote: Entity): Entity {
  return local;
}
```

**3. Keep Remote**
```typescript
function keepRemote(local: Entity, remote: Entity): Entity {
  return remote;
}
```

**4. Merge (Field-level)**
```typescript
function merge(local: Entity, remote: Entity): Entity {
  const merged = { ...remote };

  for (const [key, localValue] of Object.entries(local)) {
    const remoteValue = remote[key];

    // If same, no conflict
    if (isEqual(localValue, remoteValue)) {
      continue;
    }

    // Use field timestamp if available
    if (local[`${key}UpdatedAt`] > remote[`${key}UpdatedAt`]) {
      merged[key] = localValue;
    }
  }

  return merged;
}
```

**5. Custom Rules**
```typescript
function customResolution(local: Entity, remote: Entity): Entity {
  // Example: For orders, FILLED status always wins
  if (local.type === 'ORDER') {
    if (local.status === 'FILLED' || remote.status === 'FILLED') {
      return local.status === 'FILLED' ? local : remote;
    }
  }

  // Default to latest
  return keepLatest(local, remote);
}
```

---

## Data Flow

### Sync Data Flow

```
Remote System                Sync Manager              Local Database
     │                            │                          │
     │    1. Fetch Changes        │                          │
     │◄───────────────────────────┤                          │
     │                            │                          │
     │    2. Return Changes       │                          │
     ├───────────────────────────▶│                          │
     │                            │                          │
     │                            │  3. Compare with Local   │
     │                            ├─────────────────────────▶│
     │                            │                          │
     │                            │  4. Return Local State   │
     │                            │◄─────────────────────────┤
     │                            │                          │
     │                            │  5. Resolve Conflicts    │
     │                            │──┐                       │
     │                            │◄─┘                       │
     │                            │                          │
     │                            │  6. Apply Changes        │
     │                            ├─────────────────────────▶│
     │                            │                          │
     │                            │  7. Confirm              │
     │                            │◄─────────────────────────┤
     │                            │                          │
     │  8. Update Remote (if      │                          │
     │     local changes)         │                          │
     │◄───────────────────────────┤                          │
     │                            │                          │
     │  9. Confirm                │                          │
     ├───────────────────────────▶│                          │
     │                            │                          │
```

---

## Performance Considerations

### Optimization Techniques

**1. Batch Processing**
- Process records in batches (100-1000)
- Reduces network roundtrips
- Better database performance

**2. Parallel Processing**
- Process independent batches in parallel
- Use worker threads for CPU-intensive tasks
- Respect concurrency limits

**3. Caching**
- Cache frequently accessed data
- Use Redis for distributed caching
- Implement cache invalidation strategy

**4. Indexing**
- Index sync-related fields (updatedAt, version)
- Composite indexes for common queries
- Regular index maintenance

**5. Compression**
- Compress large payloads
- Use gzip or brotli
- Balance compression ratio vs CPU usage

---

### Performance Metrics

**Target Metrics:**
- Full sync: < 5 minutes for 100K records
- Incremental sync: < 30 seconds for 1K changes
- Real-time sync: < 100ms latency
- Conflict resolution: < 10ms per conflict
- Throughput: > 1000 records/second

---

## Security

### Authentication & Authorization

```typescript
interface SyncRequest {
  userId: string;
  token: string;
  entityType: string;
  operation: 'READ' | 'WRITE';
}

async function authorize(request: SyncRequest): Promise<boolean> {
  // Verify token
  const user = await verifyToken(request.token);

  // Check permissions
  return await hasPermission(user, request.entityType, request.operation);
}
```

---

### Data Encryption

- Encrypt data in transit (TLS 1.3)
- Encrypt sensitive fields at rest
- Key rotation policy
- Secure key management

---

### Audit Trail

- Log all sync operations
- Track data access
- Monitor suspicious activity
- Compliance reporting

---

## Scalability

### Horizontal Scaling

```
                    Load Balancer
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
   Sync Manager 1   Sync Manager 2   Sync Manager 3
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                    Message Queue
                          │
                    Shared Database
```

### Vertical Scaling

- Increase CPU cores for parallel processing
- Add memory for larger caching
- Faster storage for database operations

### Database Scaling

- Read replicas for queries
- Write primary for updates
- Sharding for very large datasets
- Connection pooling

---

**End of Architecture Documentation**

See also:
- [Sync Manager Integration Guide](./SYNC_MANAGER_INTEGRATION.md)
- [Sync Manager Examples](./SYNC_MANAGER_EXAMPLES.md)
