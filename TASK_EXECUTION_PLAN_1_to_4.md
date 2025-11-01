# HMS Platform - Tasks 1-4 Execution Plan

**Date**: October 31, 2025
**Status**: 🚀 Ready for Implementation
**Total Estimated Time**: 8-10 hours

---

## Executive Summary

This document outlines the complete execution plan for 4 critical tasks to finalize HMS production deployment:

1. **Run-Tests Skill Implementation** (Sprint 2 Week 2) - 3-4 hours
2. **DLT Aurigraph API Credentials Setup** - 1-2 hours
3. **Full Integration Validation on Staging** - 2-3 hours
4. **Team Training Materials** - 2 hours

---

## TASK 1: Implement Run-Tests Skill (Sprint 2 Week 2)

**Status**: ⏳ In Progress
**Estimated Duration**: 3-4 hours
**Deliverables**: 1,200-1,500 lines of production code

### Objectives

✅ Multi-framework test execution (Jest, Pytest, Mocha, Go)
✅ Coverage analysis and reporting
✅ Flaky test detection with automatic retries
✅ Parallel test execution optimization
✅ Comprehensive test result aggregation
✅ Performance gap identification and recommendations

### Implementation Phases

#### Phase 1: Framework Adapters (1 hour)

**Jest Adapter**:
```javascript
- Parse jest-results.json
- Extract coverage from coverage-summary.json
- Support --coverage flag
- Parallel execution with maxWorkers
```

**Pytest Adapter**:
```python
- Parse pytest-results.json
- Extract coverage from .coverage files
- Support -n auto for parallel
- Coverage analysis via pytest-cov
```

**Mocha Adapter**:
```javascript
- JSON reporter for results
- NYC coverage support
- Parallel test execution
- Test filtering with --grep
```

**Go Adapter**:
```go
- Parse JSON output from 'go test -json'
- Extract coverage metrics
- Support parallel execution
- Test filtering
```

#### Phase 2: Flaky Test Detection (45 minutes)

**Implementation**:
```javascript
class FlakyTestDetector {
  async detectFlaky(results, maxRetries = 2) {
    // Identify tests that fail intermittently
    // Retry failed tests up to maxRetries times
    // Track failure patterns
    // Generate severity scores
  }

  async retryTest(test, maxRetries) {
    // Retry individual test
    // Track pass/fail outcomes
    // Identify patterns
  }

  generateReport(flakyTests) {
    // List flaky tests with stats
    // Prioritize by severity
    // Recommend fixes
  }
}
```

#### Phase 3: Coverage Analysis & Recommendations (45 minutes)

**Coverage Metrics**:
- Statement coverage
- Branch coverage
- Function coverage
- Line coverage
- Per-file breakdowns

**Gap Identification**:
```javascript
class CoverageAnalyzer {
  analyzeGaps(coverage, threshold = 0.80) {
    // Identify files below threshold
    // Calculate improvement needed
    // Prioritize by impact
    // Generate recommendations
  }

  generateRecommendations(results) {
    // Coverage gaps
    // Performance issues
    // Flaky tests
    // Slow tests
    // High skip rates
  }
}
```

#### Phase 4: Integration with Skill Executor (30 minutes)

**Skill Registration**:
```javascript
// Register run-tests skill with executor
executor.register('run-tests', {
  name: 'run-tests',
  description: 'Execute tests across frameworks',
  parameters: { framework, testPath, coverage, ... },
  execute: async (params) => { ... }
});
```

**Integration Points**:
- Skill parameter validation
- Context injection
- Result formatting
- Error handling

### Deliverables

```
plugin/skills/run-tests.js (1,500+ lines)
├── Framework adapters (Jest, Pytest, Mocha, Go)
├── Flaky test detection engine
├── Coverage analysis framework
├── Recommendation generation
└── Result formatting and reporting

plugin/skills/__tests__/run-tests.test.js (400+ lines)
├── Framework detection tests
├── Coverage analysis tests
├── Flaky test detection tests
├── Error handling tests
└── Integration scenario tests
```

### Success Criteria

- ✅ All 4 frameworks supported and tested
- ✅ Coverage metrics calculated accurately
- ✅ Flaky tests detected and reported
- ✅ Execution time < 5 minutes for typical project
- ✅ 30+ unit tests passing
- ✅ Integration tests demonstrating multi-framework support

### Testing Strategy

```javascript
// Unit Tests
- Framework detection
- Parameter validation
- Coverage parsing
- Flaky detection
- Error scenarios

// Integration Tests
- Jest execution with coverage
- Pytest execution with coverage
- Mocha parallel execution
- Go test discovery
- Multi-framework workflows

// Performance Tests
- 100+ test execution time
- Parallel vs serial comparison
- Coverage report generation time
```

### Commit Strategy

```bash
git commit -m "feat: Implement Run-Tests Skill - Sprint 2 Week 2

- Add Jest test framework adapter (300 lines)
- Add Pytest test framework adapter (250 lines)
- Add Mocha test framework adapter (250 lines)
- Add Go test framework adapter (200 lines)
- Implement flaky test detection (300 lines)
- Implement coverage analysis (250 lines)
- Add comprehensive test suite (400 lines)
- Integration with skill executor complete

Total: 1,950 lines of production code
Tests: 30+ unit tests, integration tests
Status: Production ready

🤖 Generated with Claude Code - Jeeves4Coder Agent
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## TASK 2: Complete DLT Aurigraph API Credentials Setup

**Status**: ⏳ Pending
**Estimated Duration**: 1-2 hours
**Deliverables**: Configured DLT Docker environment

### Current Status

✅ Docker services deployed (6 containers running)
✅ Database initialized (PostgreSQL)
✅ Redis operational with AOF persistence
✅ NGINX reverse proxy configured
✅ Prometheus metrics collection active
✅ Grafana monitoring dashboard running

⏳ **Pending**: Aurigraph DLT API credentials

### Configuration Steps

#### Step 1: Obtain Aurigraph API Credentials (15 minutes)

```bash
# From Aurigraph DLT account
- DLT_API_KEY=xxx...
- DLT_API_SECRET=yyy...
- DLT_API_BASE_URL=https://api.aurigraph.io
- DLT_ENVIRONMENT=production
```

#### Step 2: Update .env.dlt Configuration (10 minutes)

```bash
# File: /opt/HMS/dlt/.env.dlt

# Aurigraph DLT Configuration
DLT_API_KEY=<from-step-1>
DLT_API_SECRET=<from-step-1>
DLT_API_BASE_URL=https://api.aurigraph.io
DLT_ENVIRONMENT=production
DLT_LOG_LEVEL=info
DLT_TIMEOUT=30

# Existing configs (already set)
POSTGRES_DB=aurigraph_dlt
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<secure>
REDIS_PASSWORD=<secure>
```

#### Step 3: Verify DLT Node Configuration (15 minutes)

```bash
# SSH to production server
ssh subbu@hms.aurex.in

# Navigate to DLT directory
cd /opt/HMS/dlt

# Verify .env.dlt is complete
cat .env.dlt | grep DLT_API

# Verify DLT service package.json exists
cat dlt-service/package.json

# Expected output:
# {
#   "name": "aurigraph-dlt",
#   "version": "2.3.0",
#   "main": "index.js",
#   "scripts": {
#     "start": "node index.js",
#     "test": "jest"
#   }
# }
```

#### Step 4: Restart DLT Services (15 minutes)

```bash
# Navigate to DLT directory
cd /opt/HMS/dlt

# Restart DLT services
docker compose down
docker compose up -d

# Monitor logs
docker compose logs -f dlt-node

# Expected output:
# dlt-node | Connected to Aurigraph API
# dlt-node | Database initialized
# dlt-node | API server listening on port 9004
# dlt-node | Ready to accept requests
```

#### Step 5: Validate Configuration (15 minutes)

```bash
# Test DLT API endpoint
curl -X GET http://localhost:9004/api/v1/health \
  -H "Authorization: Bearer $DLT_API_KEY"

# Expected response:
# {
#   "status": "healthy",
#   "version": "2.3.0",
#   "timestamp": "2025-10-31T00:00:00Z",
#   "api": "connected",
#   "database": "connected",
#   "redis": "connected"
# }

# Test via NGINX gateway
curl -X GET https://dlt.aurex.in/api/v1/health

# Verify in Grafana
# - Login: https://dlt-monitor.aurex.in
# - Check DLT Node metrics
# - Verify CPU, memory, disk usage
```

### Deliverables

```
✅ .env.dlt configured with API credentials
✅ DLT service restarted and healthy
✅ API endpoint verified and responding
✅ Grafana showing live metrics
✅ Database connectivity confirmed
✅ All 6 services passing health checks
```

### Success Criteria

- ✅ DLT Node container status: running
- ✅ API health check returns 200 OK
- ✅ Database queries executing successfully
- ✅ Metrics being collected by Prometheus
- ✅ Grafana dashboard displaying live data
- ✅ Zero error logs in DLT container

### Troubleshooting

```bash
# If DLT Node won't start
docker compose logs dlt-node --tail 50

# If API credentials invalid
# - Verify credentials from Aurigraph account
# - Check .env.dlt formatting
# - Restart container

# If database not connecting
# - Verify PostgreSQL container running
# - Check POSTGRES_PASSWORD in .env.dlt
# - Verify aurigraph_dlt database exists

# If Redis not available
# - Check Redis container status
# - Verify REDIS_PASSWORD in .env.dlt
# - Check Redis logs for errors
```

---

## TASK 3: Run Full Integration Validation on Staging

**Status**: ⏳ Pending
**Estimated Duration**: 2-3 hours
**Deliverables**: Complete integration test validation report

### Pre-Deployment Checklist

```bash
# Verify staging environment
✅ All services running
✅ Databases initialized
✅ DNS records pointing to staging
✅ SSL certificates valid
✅ Monitoring configured
```

### Test Execution Plan

#### Phase 1: Infrastructure Validation (30 minutes)

```bash
# Run infrastructure tests
npm run test:infrastructure

# Verify:
✅ All Docker services healthy
✅ Database connections working
✅ Redis cache operational
✅ NGINX routing correctly
✅ Prometheus scraping metrics
✅ Grafana dashboards loading
```

#### Phase 2: Integration Test Suite (60 minutes)

```bash
# Run full integration tests
cd plugin
npm run test:integration

# Expected results:
✅ GNN-HMS Trading: 26/26 tests passing
✅ DLT Docker Services: 32/32 tests passing
✅ E2E Workflows: 45/45 tests passing
✅ Total: 103/103 tests passing
✅ Coverage: >90% on all metrics
✅ Execution time: ~51 seconds
```

#### Phase 3: Staging Environment Testing (45 minutes)

```bash
# Test trading workflow on staging
1. Create test strategy
2. Run backtest
3. Execute paper trade
4. Verify P&L calculation
5. Check portfolio update

# Test developer tools on staging
1. Upload test code
2. Run analysis
3. Execute tests
4. Scan security
5. Generate review

# Test deployment workflow
1. Push to develop
2. Trigger CI/CD
3. Verify staging deployment
4. Run smoke tests
5. Verify monitoring
```

#### Phase 4: Performance Validation (30 minutes)

```bash
# Run performance tests
npm run test:performance

# Measure:
✅ GNN analysis latency: < 200ms (p95)
✅ API response time: < 200ms (p95)
✅ Database query: < 10ms (p95)
✅ Cache hit rate: > 85%
✅ Test execution: < 5 minutes for full suite
```

### Test Report Template

```markdown
# HMS Integration Testing Report

**Date**: October 31, 2025
**Environment**: Staging (hms-staging.aurex.in)
**Status**: ✅ PASSED / ❌ FAILED

## Executive Summary

[Summary of test results]

## Test Results

| Category | Tests | Passed | Failed | Coverage |
|----------|-------|--------|--------|----------|
| GNN-HMS Trading | 26 | 26 | 0 | 92% |
| DLT Docker | 32 | 32 | 0 | 89% |
| E2E Workflows | 45 | 45 | 0 | 94% |
| **Total** | **103** | **103** | **0** | **92%** |

## Performance Metrics

| Component | Target | Measured | Status |
|-----------|--------|----------|--------|
| GNN Analysis | <200ms | 150ms | ✅ |
| API Response | <200ms | 180ms | ✅ |
| Backtest (1Y) | <2s | 1.2s | ✅ |
| Full Suite | <60s | 51s | ✅ |

## Issues Found

[List any issues with severity and remediation]

## Recommendations

[Recommendations for production deployment]

## Sign-Off

- [ ] All tests passing
- [ ] Performance acceptable
- [ ] No critical issues
- [ ] Ready for production
```

### Deliverables

```
✅ Integration test suite execution report
✅ Performance benchmark results
✅ Staging environment validation complete
✅ Issues identified and tracked
✅ Recommendations for production
✅ Sign-off documentation
```

### Success Criteria

- ✅ 103/103 integration tests passing
- ✅ Coverage > 90% on all metrics
- ✅ Performance targets met
- ✅ No critical issues identified
- ✅ Staging environment stable
- ✅ Ready for production deployment

---

## TASK 4: Create Team Training Materials

**Status**: ⏳ Pending
**Estimated Duration**: 2 hours
**Deliverables**: Complete training documentation and guides

### Training Materials Required

#### 1. Integration Testing Quick Start (15 minutes read time)

**File**: `INTEGRATION_TESTING_QUICK_START.md`

```markdown
# Integration Testing - Quick Start Guide

## What is Integration Testing?

[Explanation with examples]

## Why It Matters

- Validates all components working together
- Catches issues before production
- Ensures data consistency
- Validates performance expectations

## Running Tests (5 minutes)

```bash
# Navigate to plugin directory
cd plugin

# Run all integration tests
npm run test:integration

# View results
# Output: 103 tests, 51 seconds, 92% coverage
```

## Understanding Results

[Interpret test output]
```

#### 2. Developer Tools Skill Guide (30 minutes read time)

**File**: `RUN_TESTS_SKILL_GUIDE.md`

```markdown
# Run-Tests Skill - Comprehensive Guide

## Overview

The run-tests skill executes tests across multiple frameworks:
- Jest (JavaScript/TypeScript)
- Pytest (Python)
- Mocha (Node.js)
- Go testing

## Quick Examples

### Run Jest tests with coverage
```bash
run-tests testPath="./tests" framework="jest" coverage=true
```

### Run Pytest with parallel execution
```bash
run-tests testPath="./tests" framework="pytest" parallel=true
```

### Auto-detect framework
```bash
run-tests testPath="./tests" framework="auto"
```

## Interpreting Results

[How to read test output]
[Understanding coverage metrics]
[Identifying flaky tests]

## Troubleshooting

[Common issues and solutions]
```

#### 3. Team Training Slides (1 hour presentation)

**File**: `INTEGRATION_TESTING_TRAINING.pptx` (outline)

```
Slide 1: Title - HMS Integration Testing Framework
Slide 2: What We Accomplished
Slide 3: Test Coverage Overview (103 tests)
Slide 4: Three Test Suites
  - GNN-HMS Trading (26 tests)
  - DLT Docker Services (32 tests)
  - E2E Workflows (45 tests)
Slide 5: How to Run Tests
Slide 6: Understanding Test Output
Slide 7: CI/CD Integration
Slide 8: Performance Benchmarks
Slide 9: Q&A
```

#### 4. Troubleshooting Guide (20 minutes read time)

**File**: `INTEGRATION_TESTING_TROUBLESHOOTING.md`

```markdown
# Integration Testing - Troubleshooting Guide

## Common Issues & Solutions

### Issue 1: "Cannot find module 'jest'"
**Solution**: npm install --save-dev jest

### Issue 2: Tests timeout
**Solution**: Increase timeout in jest.config.js

### Issue 3: Coverage not generated
**Solution**: Verify --coverage flag and jest setup

## Debug Mode

[How to enable debug logging]
[How to run individual tests]
[How to profile test performance]

## Getting Help

[Support channels]
[Escalation procedures]
```

#### 5. CI/CD Integration Guide (25 minutes read time)

**File**: `INTEGRATION_TESTING_CICD_SETUP.md`

```markdown
# Integration Testing in CI/CD

## GitHub Actions Workflow

[Complete workflow configuration]

## Pre-Commit Hooks

[Setup instructions]

## Coverage Reporting

[How to upload to Codecov]

## Deployment Validation

[Post-deployment testing]
```

### Training Materials Checklist

- [ ] Quick Start guide created (README format)
- [ ] Run-Tests skill guide created with examples
- [ ] Training presentation outline created
- [ ] Troubleshooting guide completed
- [ ] CI/CD setup guide completed
- [ ] Sample test configurations provided
- [ ] Video tutorial scripts prepared
- [ ] FAQ document created

### Training Delivery Plan

**Option A: Synchronous Training (1 hour)**
- 15 min: Overview and objectives
- 15 min: Live demonstration
- 15 min: Q&A and hands-on
- 15 min: Best practices and tips

**Option B: Self-Paced Learning (2-3 hours)**
- Read Quick Start guide (15 min)
- Run tests locally (15 min)
- Review test results (15 min)
- Read skill guide (30 min)
- Try variations (30 min)
- Complete troubleshooting guide (30 min)

### Deliverables

```
📚 Training Documentation:
├── INTEGRATION_TESTING_QUICK_START.md
├── RUN_TESTS_SKILL_GUIDE.md
├── INTEGRATION_TESTING_TROUBLESHOOTING.md
├── INTEGRATION_TESTING_CICD_SETUP.md
├── FAQ.md
├── GLOSSARY.md
└── Training slides (PDF)

💻 Interactive Components:
├── Sample test project
├── Test configuration templates
├── Troubleshooting checklist
└── Quick reference cards
```

### Success Criteria

- ✅ All documentation complete and clear
- ✅ Team can run tests independently
- ✅ Team understands test results
- ✅ Team can troubleshoot issues
- ✅ Team knows how to add tests
- ✅ Adoption rate > 80% within 1 week

---

## Execution Timeline

### Week 1: Task 1 (Run-Tests Skill)

**Monday-Tuesday**:
- Framework adapters (Jest, Pytest, Mocha, Go)
- Flaky test detection
- Coverage analysis
- Test suite completion

**Wednesday**:
- Code review and testing
- Integration with skill executor
- Commit to main

### Week 1: Task 2 (DLT Credentials)

**Thursday**:
- Configure .env.dlt
- Restart services
- Validate connectivity
- Update monitoring

### Week 2: Task 3 (Integration Validation)

**Monday**:
- Infrastructure tests
- Integration test suite
- Performance validation
- Test report generation

### Week 2: Task 4 (Team Training)

**Tuesday-Wednesday**:
- Documentation creation
- Training materials preparation
- Training delivery
- Feedback collection

---

## Dependencies & Prerequisites

### Task 1 Dependencies
✅ Skill executor framework (complete)
✅ Helper utilities (complete)
⏳ Run-tests skill partially complete

### Task 2 Dependencies
✅ Docker deployment (complete)
✅ Services running (complete)
⏳ API credentials (needed)

### Task 3 Dependencies
✅ Task 1 complete (run-tests)
✅ Task 2 complete (DLT setup)
✅ Integration tests (complete)

### Task 4 Dependencies
✅ All tasks 1-3 complete
✅ Documentation for all systems

---

## Risk Assessment & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| API credentials delay | High | Request early, have backup plan |
| Test failures | Medium | Debug and fix, don't block team |
| Performance issues | Medium | Profile and optimize |
| Team adoption slow | Low | Provide training and support |

---

## Success Metrics

**Task 1: Run-Tests Skill**
- ✅ 1,950+ lines of code
- ✅ 30+ unit tests passing
- ✅ All 4 frameworks supported
- ✅ Production-ready quality

**Task 2: DLT Setup**
- ✅ All services healthy
- ✅ API responding
- ✅ Metrics collecting
- ✅ Monitoring active

**Task 3: Integration Validation**
- ✅ 103/103 tests passing
- ✅ >90% coverage
- ✅ <60 second execution
- ✅ Zero critical issues

**Task 4: Team Training**
- ✅ 5+ documentation files
- ✅ Complete training materials
- ✅ 80%+ team adoption
- ✅ Support infrastructure ready

---

## Next Steps After Task Completion

1. **Production Deployment** (Week 3)
   - Deploy run-tests skill to production
   - Enable CI/CD integration
   - Start monitoring adoption

2. **Advanced Training** (Week 4)
   - Best practices workshop
   - Performance optimization
   - Custom test configuration

3. **Continuous Improvement** (Ongoing)
   - Collect feedback
   - Optimize test suite
   - Expand coverage
   - Update documentation

---

## Contact & Support

**Slack Channel**: #integration-testing
**Documentation**: All files in `plugin/tests/` and root directory
**Escalation**: DevOps lead for infrastructure issues

---

**Status**: 📋 Plan Complete - Ready for Implementation

All 4 tasks have clear objectives, deliverables, and success criteria. Team can execute independently with provided documentation.
