# Week 2 Pending Tasks - Complete Checklist

**Timeline**: November 8-10, 2025
**Status**: Ready to Start
**Total Estimated Lines**: 1,650-2,250 lines of code
**Total Estimated Tasks**: 20+ subtasks across 5 major components

---

## 📋 Task Breakdown by Priority

### 🔴 CRITICAL PATH (Must Complete First)

#### Task 1: Express.js API Server Foundation (300-400 lines)
**File**: `plugin/api/server.js`
**Estimated Time**: 2-3 hours
**Dependencies**: None (ready to start immediately)

**Subtasks**:
- [ ] Create `plugin/api/` directory structure
- [ ] Install dependencies: express, helmet, cors, morgan, compression
- [ ] Write ApiServer class with constructor
- [ ] Implement setupMiddleware() method
  - [ ] Add helmet() for security headers
  - [ ] Add cors() configuration
  - [ ] Add morgan() HTTP logging
  - [ ] Add compression() gzip support
- [ ] Implement setupRoutes() method (placeholder for routes)
- [ ] Implement start() method with HTTP server
- [ ] Implement stop() method with graceful shutdown
- [ ] Add health check endpoint: GET /health
- [ ] Add root endpoint: GET /
- [ ] Add error handler middleware
- [ ] Write JSDoc for all methods
- [ ] Test server startup/shutdown

**Acceptance Criteria**:
- Server starts on configurable port
- Health check returns 200 OK
- Server shuts down gracefully
- No unhandled promise rejections
- All middleware properly ordered

---

#### Task 2: Error Handling Middleware (35-50 lines)
**File**: `plugin/api/middleware/error-handler.js`
**Estimated Time**: 1 hour
**Dependencies**: Task 1 (API Server)

**Subtasks**:
- [ ] Create middleware file
- [ ] Write global error handler function
- [ ] Map SkillError types to HTTP status codes
  - [ ] SkillNotFoundError → 404
  - [ ] SkillValidationError → 400
  - [ ] SkillTimeoutError → 504
  - [ ] SkillExecutionError → 500
- [ ] Handle generic Error objects
- [ ] Add error logging
- [ ] Return standardized error response format
- [ ] Include stack trace only in development mode
- [ ] Write JSDoc

**Acceptance Criteria**:
- All error types handled correctly
- HTTP status codes appropriate
- Stack traces only in dev environment
- Response format consistent

---

#### Task 3: Response Builder Utility (60-90 lines)
**File**: `plugin/api/utils/response-builder.js`
**Estimated Time**: 1.5 hours
**Dependencies**: Task 2 (Error Handler)

**Subtasks**:
- [ ] Create ResponseBuilder class
- [ ] Implement successResponse() method
  - [ ] Accept data, message, statusCode
  - [ ] Return standardized success format
  - [ ] Include metadata (requestId, timestamp, executionTime)
- [ ] Implement errorResponse() method
  - [ ] Accept error object, statusCode
  - [ ] Extract error details
  - [ ] Format error properly
- [ ] Add helper methods:
  - [ ] formatError()
  - [ ] formatData()
  - [ ] buildMetadata()
- [ ] Handle arrays vs single objects
- [ ] Write comprehensive JSDoc

**Response Format**:
```json
{
  "success": true/false,
  "data": {...},
  "message": "...",
  "meta": {
    "requestId": "...",
    "timestamp": "2025-10-23T...",
    "executionTime": 123,
    "version": "1.0.0"
  }
}
```

---

#### Task 4: Database Connection Layer (80-120 lines)
**File**: `plugin/api/database/connection.js`
**Estimated Time**: 2 hours
**Dependencies**: Task 1 (setup), need better-sqlite3 package

**Subtasks**:
- [ ] Install dependency: better-sqlite3
- [ ] Create Database singleton class
- [ ] Implement constructor with configuration
- [ ] Implement initialize() method
  - [ ] Create/open SQLite database
  - [ ] Enable WAL mode
  - [ ] Set PRAGMA options
  - [ ] Run schema initialization
- [ ] Implement query() method for raw SQL
- [ ] Implement prepare() for prepared statements
- [ ] Implement transaction() method
- [ ] Implement health() method
- [ ] Implement close() method
- [ ] Add error handling and logging
- [ ] Write JSDoc

**Acceptance Criteria**:
- Database file created
- WAL mode enabled
- Prepared statements work
- Health check returns true
- Graceful close without errors

---

#### Task 5: Database Schema (80-120 lines)
**File**: `plugin/api/database/schema.js`
**Estimated Time**: 1.5 hours
**Dependencies**: Task 4 (Connection)

**Subtasks**:
- [ ] Create initializeSchema() function
- [ ] Create execution_logs table with columns:
  - [ ] id (INTEGER PRIMARY KEY)
  - [ ] skillName (TEXT NOT NULL)
  - [ ] executionId (TEXT UNIQUE NOT NULL)
  - [ ] success (BOOLEAN NOT NULL)
  - [ ] result (TEXT - JSON)
  - [ ] error (TEXT)
  - [ ] executionTime (INTEGER)
  - [ ] timestamp (TEXT)
  - [ ] userId (TEXT)
- [ ] Create detection_cache table with columns:
  - [ ] id (INTEGER PRIMARY KEY)
  - [ ] filePath (TEXT NOT NULL)
  - [ ] language (TEXT)
  - [ ] findings (TEXT - JSON)
  - [ ] createdAt (TEXT)
  - [ ] expiresAt (TEXT)
- [ ] Create indexes:
  - [ ] execution_logs(skillName)
  - [ ] execution_logs(timestamp)
  - [ ] execution_logs(executionId)
  - [ ] detection_cache(filePath)
  - [ ] detection_cache(expiresAt)
- [ ] Write createTableIfNotExists() for each table
- [ ] Add migration support function
- [ ] Write JSDoc

**Acceptance Criteria**:
- Tables created without errors
- Indexes created
- Schema can be initialized multiple times safely
- Data types appropriate

---

### 🟡 HIGH PRIORITY (Start After Critical Path)

#### Task 6: Database Repository (90-130 lines)
**File**: `plugin/api/database/repository.js`
**Estimated Time**: 2.5 hours
**Dependencies**: Task 5 (Schema)

**Subtasks**:
- [ ] Create Repository class
- [ ] Implement execution logging methods:
  - [ ] logExecution() - INSERT
  - [ ] getExecution() - SELECT single
  - [ ] getExecutionHistory() - SELECT with pagination
  - [ ] deleteOldExecutions() - DELETE with date filter
- [ ] Implement cache methods:
  - [ ] cacheFindings() - INSERT with TTL
  - [ ] getCachedFindings() - SELECT
  - [ ] clearExpiredCache() - DELETE expired
- [ ] Implement analytics methods:
  - [ ] getSkillStats() - COUNT queries
  - [ ] getExecutionStats() - Aggregation
- [ ] Use prepared statements for all queries
- [ ] Add error handling
- [ ] Write JSDoc

**Acceptance Criteria**:
- All CRUD operations work
- Pagination works correctly
- TTL expiration works
- Statistics queries return correct data
- No SQL injection vulnerabilities

---

#### Task 7: Request Context Middleware (80-120 lines)
**File**: `plugin/api/middleware/request-context.js`
**Estimated Time**: 1.5 hours
**Dependencies**: Task 3 (Response Builder)

**Subtasks**:
- [ ] Create requestContext() middleware
- [ ] Generate unique requestId
  - [ ] Use UUID or timestamp-based ID
  - [ ] Store in res.locals
- [ ] Capture request start time
- [ ] Extract user from authorization header
- [ ] Create scoped logger
- [ ] Pass context to next middleware
- [ ] Add request timing calculation
- [ ] Write JSDoc

**Acceptance Criteria**:
- Request ID generated and accessible
- Timing calculated accurately
- Logger properly scoped
- No performance impact

---

#### Task 8: Response Formatter Middleware (60-90 lines)
**File**: `plugin/api/middleware/response-formatter.js`
**Estimated Time**: 1.5 hours
**Dependencies**: Task 7 (Request Context), Task 3 (Response Builder)

**Subtasks**:
- [ ] Create responseFormatter() middleware
- [ ] Wrap res.json() method
- [ ] Add metadata from request context
- [ ] Calculate execution time
- [ ] Include request ID
- [ ] Handle different content types
- [ ] Add error formatting
- [ ] Write JSDoc

**Acceptance Criteria**:
- All responses include metadata
- Execution time accurate
- Format consistent across endpoints
- Error responses properly formatted

---

#### Task 9: Authentication Middleware (50-70 lines)
**File**: `plugin/api/middleware/auth.js`
**Estimated Time**: 1 hour
**Dependencies**: Task 1 (API Server)

**Subtasks**:
- [ ] Create auth() middleware
- [ ] Check Authorization header
- [ ] Parse Bearer token
- [ ] Validate API key (placeholder implementation)
- [ ] Add user to request context
- [ ] Skip auth for /health endpoint
- [ ] Return 401 for invalid keys
- [ ] Write JSDoc

**Acceptance Criteria**:
- Valid tokens accepted
- Invalid tokens rejected
- Health check bypasses auth
- User context added correctly

---

#### Task 10: Rate Limiter Middleware (35-50 lines)
**File**: `plugin/api/middleware/rate-limiter.js`
**Estimated Time**: 1 hour
**Dependencies**: Task 1 (API Server), need express-rate-limit package

**Subtasks**:
- [ ] Install dependency: express-rate-limit
- [ ] Create rate limiter configuration
- [ ] Set 100 req/min for unauthenticated
- [ ] Set 1000 req/min for authenticated
- [ ] Skip health check endpoint
- [ ] Return 429 when exceeded
- [ ] Add appropriate headers
- [ ] Write JSDoc

**Acceptance Criteria**:
- Requests counted correctly
- Limits enforced
- Health check not rate limited
- Headers include retry-after

---

### 🔵 MEDIUM PRIORITY (API Endpoints)

#### Task 11: Skills Routes (200-280 lines)
**File**: `plugin/api/routes/skills.js`
**Estimated Time**: 3 hours
**Dependencies**: Task 4-8 (Database + Middleware)

**Subtasks**:
- [ ] Implement GET /api/skills
  - [ ] List all skills
  - [ ] Support query params: category, tag, search, limit, offset
  - [ ] Return paginated results
  - [ ] Filter by category/tag
  - [ ] Search by name
- [ ] Implement GET /api/skills/:skillName
  - [ ] Return full metadata
  - [ ] Include parameter definitions
  - [ ] Include usage examples
- [ ] Implement POST /api/skills/:skillName/execute
  - [ ] Validate parameters against skill definition
  - [ ] Call SkillExecutor.execute()
  - [ ] Return execution result
  - [ ] Log to database
  - [ ] Handle errors gracefully
- [ ] Write comprehensive JSDoc

**Acceptance Criteria**:
- List endpoint returns correct format
- Filtering works correctly
- Execution endpoint validates properly
- Results logged to database
- All error cases handled

---

#### Task 12: Executions Routes (150-220 lines)
**File**: `plugin/api/routes/executions.js`
**Estimated Time**: 2 hours
**Dependencies**: Task 4-8 (Database + Middleware)

**Subtasks**:
- [ ] Implement GET /api/executions/:executionId
  - [ ] Query database for execution
  - [ ] Return full execution details
  - [ ] Include result data
- [ ] Implement GET /api/executions
  - [ ] Query execution history
  - [ ] Support filtering: skillName, status, timeRange
  - [ ] Support pagination
  - [ ] Support sorting
- [ ] Implement DELETE /api/executions/:executionId
  - [ ] Delete cached result
  - [ ] Return success/error
- [ ] Implement POST /api/executions/:executionId/retry
  - [ ] Re-execute previous skill
  - [ ] Use original parameters
  - [ ] Create new execution ID
- [ ] Write comprehensive JSDoc

**Acceptance Criteria**:
- Retrieval works correctly
- Filtering works
- Retry uses original parameters
- Database queries efficient

---

#### Task 13: Results Routes (150-220 lines)
**File**: `plugin/api/routes/results.js`
**Estimated Time**: 2 hours
**Dependencies**: Task 4-8 (Database + Middleware)

**Subtasks**:
- [ ] Implement GET /api/results
  - [ ] Search execution results
  - [ ] Filter by skillName, type, severity
  - [ ] Support pagination
  - [ ] Return findings
- [ ] Implement GET /api/results/export
  - [ ] Support format param: json, csv, html
  - [ ] Stream export data
  - [ ] Set proper content-type
- [ ] Implement POST /api/results/search
  - [ ] Full-text search on findings
  - [ ] Support complex filters
  - [ ] Support pagination and sorting
- [ ] Write comprehensive JSDoc

**Acceptance Criteria**:
- Search returns correct results
- Export formats work
- Filtering by severity works
- Pagination correct

---

#### Task 14: Health Routes (50-80 lines)
**File**: `plugin/api/routes/health.js`
**Estimated Time**: 1 hour
**Dependencies**: Task 4-8 (Database + Middleware)

**Subtasks**:
- [ ] Implement GET /health
  - [ ] Return simple { healthy: true }
  - [ ] Return 200 OK
- [ ] Implement GET /health/detailed
  - [ ] Check database connectivity
  - [ ] Check SkillExecutor availability
  - [ ] Return component status
  - [ ] Return 503 if critical component down
- [ ] Write comprehensive JSDoc

**Acceptance Criteria**:
- Health check returns correct status
- Detailed health checks all components
- Returns proper HTTP status codes

---

#### Task 15: Routes Index/Router (50-80 lines)
**File**: `plugin/api/routes/index.js`
**Estimated Time**: 1 hour
**Dependencies**: Tasks 11-14 (All routes)

**Subtasks**:
- [ ] Import all route modules
- [ ] Create Express router
- [ ] Mount skills routes at /api/skills
- [ ] Mount executions routes at /api/executions
- [ ] Mount results routes at /api/results
- [ ] Mount health routes at /health
- [ ] Export router
- [ ] Write JSDoc

**Acceptance Criteria**:
- All routes properly mounted
- Route order correct (health first for bypass)
- Router exports correctly

---

### 🟢 LOWER PRIORITY (Testing & Integration)

#### Task 16: API Integration Tests (200-300 lines)
**File**: `plugin/api/__tests__/api-integration.test.js`
**Estimated Time**: 3-4 hours
**Dependencies**: Tasks 1-15 (All server components)

**Subtasks**:
- [ ] Server lifecycle tests (start/stop)
- [ ] Health check tests
- [ ] Skills list endpoint tests
- [ ] Skills execution tests
- [ ] Execution history tests
- [ ] Error handling tests
- [ ] Authentication tests
- [ ] Rate limiting tests
- [ ] Database persistence tests
- [ ] Response format tests

**Test Suites**:
- [ ] Server Lifecycle (4 tests)
- [ ] Health Checks (3 tests)
- [ ] Skills Endpoints (6 tests)
- [ ] Execution Endpoints (8 tests)
- [ ] Error Handling (5 tests)
- [ ] Integration (4 tests)

**Acceptance Criteria**:
- All tests passing
- 80%+ code coverage
- Both happy paths and error cases tested
- Database operations tested

---

#### Task 17: Server Configuration (25-35 lines)
**File**: `plugin/api/config/server.config.js`
**Estimated Time**: 30 minutes
**Dependencies**: Task 1 (API Server)

**Subtasks**:
- [ ] Export port configuration
- [ ] Export host configuration
- [ ] Export environment setting
- [ ] Export feature flags
- [ ] Export logging configuration
- [ ] Export CORS settings
- [ ] Export rate limit settings

**Acceptance Criteria**:
- All configurations exported
- Defaults appropriate
- Environment variables supported

---

### ⚪ OPTIONAL (Nice to Have)

#### Task 18: API Documentation (OpenAPI/Swagger)
**Estimated Time**: 2-3 hours
**Dependencies**: Tasks 11-14 (All routes)

**Subtasks**:
- [ ] Install swagger-ui-express and swagger-jsdoc
- [ ] Write OpenAPI spec
- [ ] Document all endpoints
- [ ] Add request/response examples
- [ ] Add error responses
- [ ] Implement Swagger UI endpoint

---

#### Task 19: Performance Testing
**Estimated Time**: 2 hours
**Dependencies**: Tasks 1-15 (All components)

**Subtasks**:
- [ ] Load test API server
- [ ] Measure response times
- [ ] Test concurrent requests
- [ ] Verify rate limiting
- [ ] Database query performance

---

#### Task 20: WebSocket Support (300-400 lines)
**Estimated Time**: 4-5 hours
**Dependencies**: Tasks 1-15 (Defer to later if needed)

**Subtasks**:
- [ ] Install ws package
- [ ] Create WebSocket server
- [ ] Implement real-time updates
- [ ] Pub/sub for execution events
- [ ] Connection management
- [ ] Message serialization

---

## 📊 Summary & Timeline

### Estimated Effort
- **Critical Path**: 9 tasks, ~12 hours
- **High Priority**: 6 tasks, ~10 hours
- **Medium Priority**: 5 tasks, ~12 hours
- **Testing**: 1 task, ~3 hours
- **Optional**: 3 tasks, ~7 hours
- **Total**: 24 tasks, ~44 hours (1-2 sprints)

### Phased Approach
**Phase 1 (Nov 8)**: Tasks 1-5 (Server + Database Foundation)
**Phase 2 (Nov 9)**: Tasks 6-10 (Database + Middleware)
**Phase 3 (Nov 10)**: Tasks 11-17 (API Endpoints + Testing)
**Phase 4 (Later)**: Tasks 18-20 (Documentation + Optional)

### Dependencies Graph
```
Task 1 (Server)
├─→ Task 2 (Error Handler)
│   └─→ Task 3 (Response Builder)
│       ├─→ Task 7 (Request Context)
│       │   └─→ Task 8 (Response Formatter)
│       └─→ Task 11-14 (Routes)
├─→ Task 4 (DB Connection)
│   └─→ Task 5 (Schema)
│       └─→ Task 6 (Repository)
│           └─→ Task 11-14 (Routes)
├─→ Task 9 (Auth)
└─→ Task 10 (Rate Limiter)

Task 15 (Router)
└─→ Tasks 11-14 (All Routes)

Task 16 (Tests)
└─→ Tasks 1-15 (All Components)
```

---

## ✅ Definition of Done

Each task is complete when:
1. ✅ Code written and follows style guide
2. ✅ JSDoc comments on all methods
3. ✅ Error handling implemented
4. ✅ Unit tests written (or integration tests)
5. ✅ All tests passing
6. ✅ Code reviewed (self-review)
7. ✅ Git committed with clear message
8. ✅ Documented in commit message

---

## 🚀 Getting Started

**Before Starting Week 2**:
1. [ ] Review this checklist
2. [ ] Review WEEK_2_IMPLEMENTATION_PLAN.md
3. [ ] Install dependencies: `npm install express helmet cors morgan compression express-rate-limit better-sqlite3`
4. [ ] Create directory structure: `mkdir -p plugin/api/{middleware,routes,database,config,__tests__,utils}`
5. [ ] Create a branch: `git checkout -b week-2-api-server`

**Ready to Begin**: Yes ✅

---

**Generated**: October 23, 2025
**Status**: Ready for Week 2 Execution
**Next Review**: Before starting each phase

