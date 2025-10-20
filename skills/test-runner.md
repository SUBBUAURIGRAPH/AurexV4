# Test Runner Skill

**Agent**: QA Engineer  
**Purpose**: Intelligent test execution and reporting  
**Status**: Implemented  
**Version**: 1.0.0

## Overview
Provides intelligent test execution with coverage analysis, retry logic, and comprehensive reporting across all test types.

## Capabilities
- Run tests by type (unit, integration, functional, security, e2e, load)
- Watch mode for TDD
- Coverage reports with 80% threshold
- Retry flaky tests automatically
- Parallel execution for speed
- Generate comprehensive test reports

## Usage
```
@qa-engineer test-runner "Run full test suite"
@qa-engineer test-runner "Unit tests in watch mode"
@qa-engineer test-runner "Integration tests with coverage"
```

## Test Types Supported
- **Unit**: `npm run test:unit` (892 tests)
- **Integration**: `npm run test:integration` (547 tests)
- **Functional**: `npm run test:functional` (324 tests)
- **Security**: `npm run test:security` (security scans)
- **E2E**: `npm run test:e2e` (end-to-end scenarios)
- **Load**: `npm run test:load` (performance tests)

## Key Features
- **Smart execution**: Run only affected tests
- **Coverage tracking**: Enforce 80% threshold
- **Flaky test retry**: Auto-retry up to 3 times
- **Parallel runs**: Speed up execution
- **Rich reporting**: HTML, JSON, console output

## Integration
- Jest configuration: `jest.config.js`
- Test scripts: `package.json`
- Test suites: 1,763 tests total
- Coverage: 92.3% current

---
**Owner**: QA Team | **Updated**: 2025-10-20
