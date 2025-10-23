# Week 2 Implementation Plan: API Server and Database Integration
**Timeline**: November 8-10, 2025
**Total Estimated Lines**: 1,650-2,250 lines of code
**Focus**: Production-ready API server with WebSocket support and database integration

---

## Table of Contents
1. [Overview](#overview)
2. [API Server Architecture](#1-api-server-architecture)
3. [Request/Response Pipeline](#2-requestresponse-pipeline)
4. [Database Integration](#3-database-integration)
5. [Core API Endpoints](#4-core-api-endpoints)
6. [WebSocket Support](#5-websocket-support)
7. [Dependencies](#dependencies)
8. [Integration Strategy](#integration-strategy)
9. [Testing Strategy](#testing-strategy)
10. [Performance Considerations](#performance-considerations)
11. [Deployment](#deployment)

---

## Overview

Week 2 builds upon the skill execution framework created in Week 1, adding a production-grade API server that exposes skills via REST and WebSocket interfaces. The implementation focuses on scalability, reliability, and developer experience.

### Key Deliverables
- RESTful API server with Express.js
- Real-time WebSocket communication
- SQLite database with skill execution logs
- Request validation and error handling
- Health monitoring and graceful shutdown
- Comprehensive test coverage

---

## 1. API Server Architecture
**Estimated**: 300-400 lines
**File**: `plugin/api/server.js`

### Features
- Express.js application setup with middleware stack
- CORS configuration for cross-origin requests
- Request parsing (JSON, URL-encoded)
- Helmet.js for security headers
- Morgan for HTTP request logging
- Graceful shutdown handling
- Health check endpoints

### File Structure
```javascript
plugin/api/
├── server.js              // Main server setup (200-250 lines)
├── middleware/
│   ├── auth.js           // Authentication middleware (50-75 lines)
│   ├── error-handler.js  // Global error handling (30-40 lines)
│   └── rate-limiter.js   // Rate limiting (30-40 lines)
└── config/
    └── server.config.js  // Server configuration (20-30 lines)
```

### Implementation Details

#### server.js
```javascript
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const errorHandler = require('./middleware/error-handler');
const apiRoutes = require('./routes');
const { initializeDatabase } = require('./database');
const WebSocketServer = require('./websocket/server');

class ApiServer {
  constructor(options = {}) {
    this.port = options.port || process.env.PORT || 3000;
    this.host = options.host || '0.0.0.0';
    this.app = express();
    this.server = null;
    this.wsServer = null;
    this.shuttingDown = false;
  }

  async initialize() {
    // Database initialization
    await initializeDatabase();

    // Middleware setup
    this.setupMiddleware();

    // Routes
    this.setupRoutes();

    // Error handling
    this.app.use(errorHandler);

    return this;
  }

  setupMiddleware() {
    // Security
    this.app.use(helmet());

    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined'));
    }

    // Rate limiting
    this.app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests, please try again later'
    }));
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });

    // API routes
    this.app.use('/api', apiRoutes);

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path
      });
    });
  }

  async start() {
    // HTTP server
    this.server = this.app.listen(this.port, this.host, () => {
      console.log(`API Server running on ${this.host}:${this.port}`);
    });

    // WebSocket server
    this.wsServer = new WebSocketServer(this.server);
    await this.wsServer.initialize();

    // Graceful shutdown handlers
    this.setupShutdownHandlers();

    return this;
  }

  setupShutdownHandlers() {
    const shutdown = async (signal) => {
      if (this.shuttingDown) return;
      this.shuttingDown = true;

      console.log(`Received ${signal}, starting graceful shutdown...`);

      // Stop accepting new connections
      this.server.close(() => {
        console.log('HTTP server closed');
      });

      // Close WebSocket connections
      if (this.wsServer) {
        await this.wsServer.close();
      }

      // Close database connections
      // await closeDatabase();

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  async stop() {
    if (this.server) {
      await new Promise(resolve => this.server.close(resolve));
    }
    if (this.wsServer) {
      await this.wsServer.close();
    }
  }
}

module.exports = ApiServer;
```

### Testing
- Unit tests for middleware configuration
- Integration tests for server lifecycle
- Health endpoint tests
- Graceful shutdown tests

---

## 2. Request/Response Pipeline
**Estimated**: 200-300 lines
**File**: `plugin/api/middleware/`

### Components

#### Request Context Injection
**File**: `middleware/context.js` (60-80 lines)
```javascript
function injectContext(req, res, next) {
  req.context = {
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  };

  // Attach request ID to response headers
  res.setHeader('X-Request-ID', req.context.requestId);

  next();
}
```

#### Result Formatting
**File**: `middleware/formatter.js` (80-100 lines)
```javascript
class ResultFormatter {
  static format(data, contentType = 'application/json') {
    switch (contentType) {
      case 'application/json':
        return this.formatJSON(data);
      case 'text/plain':
        return this.formatText(data);
      case 'text/html':
        return this.formatHTML(data);
      default:
        return this.formatJSON(data);
    }
  }

  static formatJSON(data) {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };
  }

  static formatError(error, statusCode = 500) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR',
        statusCode
      },
      timestamp: new Date().toISOString()
    };
  }
}
```

#### Error Response Standardization
**File**: `middleware/error-handler.js` (60-80 lines)
```javascript
function errorHandler(err, req, res, next) {
  // Log error
  console.error('[ERROR]', {
    requestId: req.context?.requestId,
    error: err.message,
    stack: err.stack
  });

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Send formatted error response
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message,
      code: err.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack
      })
    },
    requestId: req.context?.requestId,
    timestamp: new Date().toISOString()
  });
}
```

### Testing
- Context injection tests
- Format conversion tests
- Error handling tests
- Request/response transformation tests

---

## 3. Database Integration
**Estimated**: 250-350 lines
**Files**: `plugin/api/database/`

### Schema Design

#### Execution Logs Table
```sql
CREATE TABLE execution_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT UNIQUE NOT NULL,
  skill_name TEXT NOT NULL,
  parameters TEXT, -- JSON
  result TEXT, -- JSON
  success BOOLEAN NOT NULL,
  execution_time INTEGER,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_skill_name (skill_name),
  INDEX idx_created_at (created_at),
  INDEX idx_success (success)
);
```

#### Detection Results Cache
```sql
CREATE TABLE detection_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_hash TEXT UNIQUE NOT NULL,
  detection_type TEXT NOT NULL,
  results TEXT NOT NULL, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  INDEX idx_content_hash (content_hash),
  INDEX idx_expires_at (expires_at)
);
```

### Implementation

#### database.js (150-200 lines)
```javascript
const sqlite3 = require('better-sqlite3');
const path = require('path');

class Database {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '../../data/aurigraph.db');
    this.db = null;
  }

  async initialize() {
    this.db = new sqlite3(this.dbPath);
    this.db.pragma('journal_mode = WAL');

    await this.createTables();
    await this.createIndexes();

    return this;
  }

  async createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS execution_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        execution_id TEXT UNIQUE NOT NULL,
        skill_name TEXT NOT NULL,
        parameters TEXT,
        result TEXT,
        success BOOLEAN NOT NULL,
        execution_time INTEGER,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS detection_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_hash TEXT UNIQUE NOT NULL,
        detection_type TEXT NOT NULL,
        results TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
      );
    `);
  }

  async createIndexes() {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_skill_name ON execution_logs(skill_name);
      CREATE INDEX IF NOT EXISTS idx_created_at ON execution_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_success ON execution_logs(success);
      CREATE INDEX IF NOT EXISTS idx_content_hash ON detection_cache(content_hash);
      CREATE INDEX IF NOT EXISTS idx_expires_at ON detection_cache(expires_at);
    `);
  }

  // CRUD operations
  insertExecutionLog(log) {
    const stmt = this.db.prepare(`
      INSERT INTO execution_logs
      (execution_id, skill_name, parameters, result, success, execution_time, error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      log.executionId,
      log.skillName,
      JSON.stringify(log.parameters),
      JSON.stringify(log.result),
      log.success ? 1 : 0,
      log.executionTime,
      log.error
    );
  }

  getExecutionLog(executionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM execution_logs WHERE execution_id = ?
    `);

    return stmt.get(executionId);
  }

  queryExecutionLogs(filters = {}) {
    let query = 'SELECT * FROM execution_logs WHERE 1=1';
    const params = [];

    if (filters.skillName) {
      query += ' AND skill_name = ?';
      params.push(filters.skillName);
    }

    if (filters.success !== undefined) {
      query += ' AND success = ?';
      params.push(filters.success ? 1 : 0);
    }

    if (filters.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  // Cache operations
  getCachedResult(contentHash) {
    const stmt = this.db.prepare(`
      SELECT * FROM detection_cache
      WHERE content_hash = ?
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    `);

    return stmt.get(contentHash);
  }

  setCachedResult(contentHash, detectionType, results, ttl = 3600) {
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO detection_cache
      (content_hash, detection_type, results, expires_at)
      VALUES (?, ?, ?, ?)
    `);

    return stmt.run(contentHash, detectionType, JSON.stringify(results), expiresAt);
  }

  cleanExpiredCache() {
    const stmt = this.db.prepare(`
      DELETE FROM detection_cache
      WHERE expires_at IS NOT NULL AND expires_at < datetime('now')
    `);

    return stmt.run();
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = Database;
```

#### Connection Pooling
**File**: `database/pool.js` (50-70 lines)
- Single connection for SQLite (WAL mode for concurrent reads)
- Connection health checks
- Automatic reconnection

### Testing
- Schema creation tests
- CRUD operation tests
- Query filter tests
- Cache expiration tests
- Transaction tests
- Connection pool tests

---

## 4. Core API Endpoints
**Estimated**: 600-800 lines
**Files**: `plugin/api/routes/`

### Endpoint Specifications

#### 1. Execute Skill
```
POST /api/skills/{skillName}/execute
Content-Type: application/json

Request Body:
{
  "parameters": {
    "filePath": "/path/to/file.js",
    "options": {}
  },
  "options": {
    "timeout": 30000,
    "async": false
  }
}

Response (200 OK):
{
  "success": true,
  "executionId": "exec_1234567890_abc123",
  "result": {
    // Skill-specific result
  },
  "executionTime": 1250,
  "timestamp": "2025-11-08T10:30:00.000Z"
}

Response (400 Bad Request):
{
  "success": false,
  "error": {
    "message": "Missing required parameter: filePath",
    "code": "VALIDATION_ERROR"
  }
}

Response (404 Not Found):
{
  "success": false,
  "error": {
    "message": "Skill 'invalid-skill' not found",
    "code": "SKILL_NOT_FOUND"
  }
}

Response (500 Internal Server Error):
{
  "success": false,
  "error": {
    "message": "Skill execution failed: ...",
    "code": "EXECUTION_ERROR"
  },
  "executionId": "exec_1234567890_abc123"
}
```

#### 2. List Skills
```
GET /api/skills
Query Parameters:
  - category: string (optional)
  - tag: string (optional)
  - search: string (optional)

Response (200 OK):
{
  "success": true,
  "data": {
    "skills": [
      {
        "name": "analyze-code",
        "description": "...",
        "version": "1.0.0",
        "category": "code-quality",
        "tags": ["analysis", "quality"],
        "parameters": {...}
      }
    ],
    "total": 22
  }
}
```

#### 3. Get Skill Details
```
GET /api/skills/{skillName}

Response (200 OK):
{
  "success": true,
  "data": {
    "name": "analyze-code",
    "description": "...",
    "version": "1.0.0",
    "category": "code-quality",
    "parameters": {
      "filePath": {
        "type": "string",
        "required": true,
        "description": "..."
      }
    },
    "timeout": 30000,
    "examples": [...]
  }
}
```

#### 4. Get Execution Status
```
GET /api/executions/{executionId}

Response (200 OK):
{
  "success": true,
  "data": {
    "executionId": "exec_...",
    "skillName": "analyze-code",
    "status": "completed",
    "result": {...},
    "executionTime": 1250,
    "timestamp": "..."
  }
}
```

#### 5. Query Execution Results
```
GET /api/results
Query Parameters:
  - skillName: string (optional)
  - success: boolean (optional)
  - startDate: ISO datetime (optional)
  - endDate: ISO datetime (optional)
  - limit: number (optional, default: 50)
  - offset: number (optional, default: 0)

Response (200 OK):
{
  "success": true,
  "data": {
    "results": [...],
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

### Implementation

#### routes/index.js (50-70 lines)
```javascript
const express = require('express');
const router = express.Router();

const skillsRouter = require('./skills');
const executionsRouter = require('./executions');
const resultsRouter = require('./results');

router.use('/skills', skillsRouter);
router.use('/executions', executionsRouter);
router.use('/results', resultsRouter);

module.exports = router;
```

#### routes/skills.js (200-250 lines)
```javascript
const express = require('express');
const router = express.Router();
const SkillExecutor = require('../../skill-executor');
const { validateSkillExecution } = require('../validators');
const Database = require('../database');

const executor = new SkillExecutor();
const db = new Database();

// Initialize executor
executor.initialize().catch(console.error);
db.initialize().catch(console.error);

// List all skills
router.get('/', async (req, res, next) => {
  try {
    const { category, tag, search } = req.query;

    let skills = await executor.listSkills();

    // Apply filters
    if (category) {
      skills = skills.filter(s => s.category === category);
    }

    if (tag) {
      skills = skills.filter(s => s.tags && s.tags.includes(tag));
    }

    if (search) {
      const searchLower = search.toLowerCase();
      skills = skills.filter(s =>
        s.name.toLowerCase().includes(searchLower) ||
        s.description.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      data: {
        skills,
        total: skills.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get skill details
router.get('/:skillName', async (req, res, next) => {
  try {
    const { skillName } = req.params;

    const metadata = await executor.getSkillMetadata(skillName);

    res.json({
      success: true,
      data: metadata
    });
  } catch (error) {
    if (error.name === 'SkillNotFoundError') {
      return res.status(404).json({
        success: false,
        error: {
          message: error.message,
          code: 'SKILL_NOT_FOUND'
        }
      });
    }
    next(error);
  }
});

// Execute skill
router.post('/:skillName/execute', async (req, res, next) => {
  try {
    const { skillName } = req.params;
    const { parameters = {}, options = {} } = req.body;

    // Validate
    const validation = validateSkillExecution(parameters);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validation.errors
        }
      });
    }

    // Execute skill
    const result = await executor.execute(skillName, parameters, options);

    // Store in database
    db.insertExecutionLog({
      executionId: result.executionId,
      skillName: result.skillName,
      parameters,
      result: result.result,
      success: result.success,
      executionTime: result.executionTime
    });

    res.json(result);
  } catch (error) {
    if (error.name === 'SkillNotFoundError') {
      return res.status(404).json({
        success: false,
        error: {
          message: error.message,
          code: 'SKILL_NOT_FOUND'
        }
      });
    }

    if (error.name === 'SkillValidationError') {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'VALIDATION_ERROR',
          details: error.validationErrors
        }
      });
    }

    next(error);
  }
});

module.exports = router;
```

#### routes/executions.js (100-150 lines)
```javascript
const express = require('express');
const router = express.Router();
const Database = require('../database');

const db = new Database();
db.initialize().catch(console.error);

// Get execution by ID
router.get('/:executionId', async (req, res, next) => {
  try {
    const { executionId } = req.params;

    const execution = db.getExecutionLog(executionId);

    if (!execution) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Execution '${executionId}' not found`,
          code: 'EXECUTION_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: {
        ...execution,
        parameters: JSON.parse(execution.parameters),
        result: JSON.parse(execution.result)
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

#### routes/results.js (100-150 lines)
```javascript
const express = require('express');
const router = express.Router();
const Database = require('../database');

const db = new Database();
db.initialize().catch(console.error);

// Query results with filters
router.get('/', async (req, res, next) => {
  try {
    const {
      skillName,
      success,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = req.query;

    const filters = {
      skillName,
      success: success !== undefined ? success === 'true' : undefined,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const results = db.queryExecutionLogs(filters);

    res.json({
      success: true,
      data: {
        results: results.map(r => ({
          ...r,
          parameters: JSON.parse(r.parameters),
          result: JSON.parse(r.result)
        })),
        total: results.length,
        limit: filters.limit,
        offset: filters.offset
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

### Testing
- Endpoint integration tests
- Request validation tests
- Error handling tests
- Database integration tests
- Performance tests for query endpoints

---

## 5. WebSocket Support
**Estimated**: 300-400 lines
**Files**: `plugin/api/websocket/`

### Features
- Real-time skill execution updates
- Event-driven architecture
- Connection management
- Message serialization/deserialization
- Heartbeat/ping-pong

### Implementation

#### websocket/server.js (150-200 lines)
```javascript
const WebSocket = require('ws');
const EventEmitter = require('events');

class WebSocketServer extends EventEmitter {
  constructor(httpServer) {
    super();
    this.httpServer = httpServer;
    this.wss = null;
    this.clients = new Map();
  }

  async initialize() {
    this.wss = new WebSocket.Server({
      server: this.httpServer,
      path: '/ws'
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.setupHeartbeat();

    console.log('WebSocket server initialized');
    return this;
  }

  handleConnection(ws, req) {
    const clientId = this.generateClientId();

    const client = {
      id: clientId,
      ws,
      isAlive: true,
      subscriptions: new Set()
    };

    this.clients.set(clientId, client);

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });

    // Send welcome message
    this.send(clientId, {
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString()
    });
  }

  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message.executionId);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.executionId);
          break;
        case 'ping':
          this.send(clientId, { type: 'pong' });
          break;
        default:
          this.send(clientId, {
            type: 'error',
            message: 'Unknown message type'
          });
      }
    } catch (error) {
      this.send(clientId, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  }

  handleSubscribe(clientId, executionId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.add(executionId);
      this.send(clientId, {
        type: 'subscribed',
        executionId
      });
    }
  }

  handleUnsubscribe(clientId, executionId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.delete(executionId);
      this.send(clientId, {
        type: 'unsubscribed',
        executionId
      });
    }
  }

  handleDisconnect(clientId) {
    this.clients.delete(clientId);
    console.log(`Client ${clientId} disconnected`);
  }

  setupHeartbeat() {
    const interval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000); // 30 seconds

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    });
  }

  broadcastToSubscribers(executionId, message) {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.subscriptions.has(executionId) &&
          client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    });
  }

  send(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async close() {
    if (this.wss) {
      this.clients.forEach(client => client.ws.close());
      this.wss.close();
    }
  }
}

module.exports = WebSocketServer;
```

#### websocket/events.js (100-150 lines)
```javascript
const WebSocketServer = require('./server');
const SkillExecutor = require('../../skill-executor');

class WebSocketEventBridge {
  constructor(wsServer, executor) {
    this.wsServer = wsServer;
    this.executor = executor;
    this.setupListeners();
  }

  setupListeners() {
    // Execution started
    this.executor.on('execution:start', (event) => {
      this.wsServer.broadcastToSubscribers(event.executionId, {
        type: 'execution:start',
        executionId: event.executionId,
        skillName: event.skillName,
        timestamp: event.timestamp
      });
    });

    // Execution progress
    this.executor.on('execution:progress', (event) => {
      this.wsServer.broadcastToSubscribers(event.executionId, {
        type: 'execution:progress',
        executionId: event.executionId,
        progress: event.progress,
        message: event.message,
        timestamp: event.timestamp
      });
    });

    // Execution success
    this.executor.on('execution:success', (event) => {
      this.wsServer.broadcastToSubscribers(event.executionId, {
        type: 'execution:success',
        executionId: event.executionId,
        result: event.result,
        executionTime: event.executionTime,
        timestamp: event.timestamp
      });
    });

    // Execution error
    this.executor.on('execution:error', (event) => {
      this.wsServer.broadcastToSubscribers(event.executionId, {
        type: 'execution:error',
        executionId: event.executionId,
        error: {
          message: event.error.message,
          code: event.error.code
        },
        timestamp: event.timestamp
      });
    });
  }
}

module.exports = WebSocketEventBridge;
```

### Client Example
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  // Subscribe to execution updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    executionId: 'exec_1234567890_abc123'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);

  switch (message.type) {
    case 'execution:start':
      console.log('Execution started:', message);
      break;
    case 'execution:progress':
      console.log('Progress:', message.progress);
      break;
    case 'execution:success':
      console.log('Completed:', message.result);
      break;
    case 'execution:error':
      console.error('Error:', message.error);
      break;
  }
});
```

### Testing
- Connection handling tests
- Message parsing tests
- Subscription tests
- Broadcast tests
- Heartbeat tests
- Event integration tests

---

## Dependencies

### Production Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "morgan": "^1.10.0",
    "compression": "^1.7.4",
    "express-rate-limit": "^7.1.5",
    "better-sqlite3": "^9.2.2",
    "ws": "^8.14.2",
    "joi": "^17.11.0",
    "dotenv": "^16.3.1"
  }
}
```

### Development Dependencies
```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "ws": "^8.14.2"
  }
}
```

---

## Integration Strategy

### Phase 1: Foundation (Day 1 - Nov 8)
1. Set up Express server structure
2. Implement middleware pipeline
3. Create database schema
4. Set up basic routes

### Phase 2: Core Features (Day 2 - Nov 9)
1. Implement skill execution endpoints
2. Add database integration
3. Create WebSocket server
4. Connect event bridge

### Phase 3: Polish & Testing (Day 3 - Nov 10)
1. Add comprehensive error handling
2. Implement rate limiting
3. Write integration tests
4. Performance optimization

### Integration with Existing Helpers
- Use `SkillExecutor` from Week 1
- Integrate with `PatternMatcher` for code analysis
- Leverage `LanguageDetector` for file type detection
- Utilize `ReportGenerator` for formatted responses

---

## Testing Strategy

### Unit Tests
- **Middleware**: 20-30 tests
- **Database**: 30-40 tests
- **Routes**: 40-50 tests
- **WebSocket**: 20-30 tests

### Integration Tests
- End-to-end API flow tests
- Database transaction tests
- WebSocket communication tests
- Error propagation tests

### Performance Tests
- Load testing with 100+ concurrent requests
- WebSocket connection stress tests
- Database query performance
- Response time benchmarks

### Test Coverage Goals
- Overall: 85%+
- Critical paths: 95%+
- API routes: 90%+
- Database operations: 95%+

---

## Performance Considerations

### Response Time Targets
- Health check: < 10ms
- Skill listing: < 50ms
- Skill execution: < 5s (depends on skill)
- Database queries: < 100ms

### Caching Strategy
1. **In-Memory Cache**: Skill metadata (LRU, 100MB limit)
2. **Database Cache**: Detection results (1 hour TTL)
3. **HTTP Cache Headers**: Static responses (ETag, Last-Modified)

### Database Optimization
- **Indexes**: All query fields indexed
- **WAL Mode**: Concurrent reads/writes
- **Prepared Statements**: Prevent SQL parsing overhead
- **Connection Pooling**: Reuse connections

### WebSocket Optimization
- **Message Batching**: Group updates for same execution
- **Compression**: Enable per-message deflate
- **Heartbeat**: Detect dead connections early
- **Backpressure**: Handle slow clients gracefully

---

## Deployment

### Environment Variables
```bash
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
DATABASE_PATH=./data/aurigraph.db
CORS_ORIGIN=*
LOG_LEVEL=info
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
WS_HEARTBEAT_INTERVAL=30000
```

### Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "api/server.js"]
```

### Health Monitoring
- Prometheus metrics endpoint: `/metrics`
- Health check endpoint: `/health`
- Graceful shutdown on SIGTERM/SIGINT
- Process uptime tracking

### Logging
- Morgan for HTTP request logs
- Winston for application logs
- Structured JSON logging in production
- Log rotation (daily, 14-day retention)

---

## File Structure Summary

```
plugin/
├── api/
│   ├── server.js                  // Main server (200-250 lines)
│   ├── routes/
│   │   ├── index.js              // Router aggregation (50-70 lines)
│   │   ├── skills.js             // Skill endpoints (200-250 lines)
│   │   ├── executions.js         // Execution endpoints (100-150 lines)
│   │   └── results.js            // Results endpoints (100-150 lines)
│   ├── middleware/
│   │   ├── context.js            // Request context (60-80 lines)
│   │   ├── formatter.js          // Response formatting (80-100 lines)
│   │   ├── error-handler.js      // Error handling (60-80 lines)
│   │   ├── auth.js               // Authentication (50-75 lines)
│   │   └── rate-limiter.js       // Rate limiting (30-40 lines)
│   ├── database/
│   │   ├── index.js              // Database class (150-200 lines)
│   │   ├── pool.js               // Connection pooling (50-70 lines)
│   │   └── migrations/           // Schema migrations
│   ├── websocket/
│   │   ├── server.js             // WebSocket server (150-200 lines)
│   │   └── events.js             // Event bridge (100-150 lines)
│   ├── validators/
│   │   └── index.js              // Request validators (80-100 lines)
│   └── config/
│       └── server.config.js      // Configuration (20-30 lines)
└── __tests__/
    └── api/
        ├── routes.test.js        // Route tests (200+ lines)
        ├── database.test.js      // DB tests (150+ lines)
        └── websocket.test.js     // WS tests (150+ lines)
```

**Total Estimated Lines**: 1,650-2,250

---

## Success Metrics

### Code Quality
- All tests passing
- 85%+ test coverage
- No critical linting errors
- TypeScript definitions (optional)

### Performance
- API response time < 100ms (p95)
- Skill execution throughput: 10+ req/s
- WebSocket connection capacity: 1000+ concurrent
- Database query performance: < 100ms (p95)

### Reliability
- Graceful error handling
- Automatic reconnection for WebSocket
- Database transaction integrity
- Zero data loss on crashes

---

## Next Steps (Week 3 Preview)

Week 3 will focus on:
1. **Authentication & Authorization**: JWT-based auth, API keys
2. **Advanced Caching**: Redis integration
3. **Monitoring**: Prometheus metrics, Grafana dashboards
4. **Documentation**: OpenAPI/Swagger spec
5. **Client SDKs**: JavaScript, Python clients

---

## Appendix: Example Usage

### Execute Skill via REST API
```bash
curl -X POST http://localhost:3000/api/skills/analyze-code/execute \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "filePath": "./src/index.js",
      "options": {
        "includeMetrics": true
      }
    },
    "options": {
      "timeout": 30000
    }
  }'
```

### Subscribe to Execution via WebSocket
```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    executionId: 'exec_1234567890_abc123'
  }));
});

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Event:', event.type, event);
});
```

### Query Execution History
```bash
curl "http://localhost:3000/api/results?skillName=analyze-code&success=true&limit=10"
```

---

**End of Week 2 Implementation Plan**
