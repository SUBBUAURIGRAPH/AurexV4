# HMS Platform Team Training Package

**Date**: October 31, 2025
**Version**: 1.0.0
**Status**: ✅ Complete and Ready for Team Training

---

## 📚 Training Materials Overview

This comprehensive training package contains everything your team needs to understand and use the HMS integration testing framework.

### Quick Reference

| Document | Duration | Audience | Key Topics |
|----------|----------|----------|-----------|
| **Quick Start Guide** | 15 min | All developers | Running tests, understanding output |
| **Run-Tests Skill Guide** | 30 min | Test engineers | Framework adapters, test execution |
| **Troubleshooting Guide** | 20 min | All developers | Common issues, solutions |
| **FAQ Document** | 20 min | All teams | Common questions, best practices |
| **Training Checklist** | 30 min | New team members | Self-paced onboarding |

---

## 🚀 PART 1: QUICK START GUIDE (15 minutes)

### What is Integration Testing?

Integration testing validates that all HMS platform components work together correctly. Instead of testing components in isolation, we test complete workflows:

- **GNN Trading**: Strategy creation → Backtest → Analysis → Execution → Monitoring
- **Developer Tools**: Code → Analysis → Testing → Security → Review
- **Deployment**: Push → Build → Test → Deploy → Monitor

### Getting Started (5 minutes)

**1. Navigate to Plugin Directory**:
```bash
cd plugin
```

**2. Run Integration Tests**:
```bash
npm run test:integration
```

**Expected Output**:
```
GNN-HMS Integration Tests: 26 passing ✓
DLT Docker Integration Tests: 32 passing ✓
E2E Workflow Tests: 45 passing ✓

Total: 103 passing
Coverage: 92% statements, 89% branches, 94% functions
Time: ~51 seconds
```

**3. View Coverage Report**:
```bash
npm run test:integration -- --coverage

# Open coverage report
open coverage/lcov-report/index.html
```

### Understanding Test Output

**Test Results**:
```
✓ Test passed
✗ Test failed
⊘ Test skipped
⚠ Test warning/flaky
```

**Coverage Metrics**:
- **Statements**: Percentage of code lines executed
- **Branches**: Percentage of conditional branches tested
- **Functions**: Percentage of functions called
- **Lines**: Percentage of lines executed

**Pass Rate**: `passed / total * 100%`

### Common Commands

```bash
# Run all integration tests
npm run test:integration

# Run specific test suite
npm run test:integration -- gnn-hms-integration.test.js

# Run with coverage
npm run test:integration -- --coverage

# Run with specific pattern
npm run test:integration -- --testNamePattern="Trading"

# Watch mode (auto-rerun on changes)
npm run test:integration -- --watch
```

### Success Checklist

- ✅ Can run tests locally
- ✅ Understand test output
- ✅ Can read coverage reports
- ✅ Know where test files are located

---

## 📖 PART 2: RUN-TESTS SKILL GUIDE (30 minutes)

### Overview

The `run-tests` skill provides unified test execution across multiple frameworks:
- **Jest** (JavaScript/TypeScript)
- **Pytest** (Python)
- **Mocha** (Node.js)
- **Go** (Go testing)

### Skill Parameters

```javascript
{
  testPath: "./tests",           // Where tests are located
  framework: "jest",             // jest | pytest | mocha | go | auto
  coverage: true,                // Generate coverage report
  parallel: true,                // Run tests in parallel
  retryFlaky: true,              // Retry failed tests to detect flakiness
  maxRetries: 2,                 // Number of retry attempts
  failFast: false,               // Stop on first failure
  timeout: 300,                  // Test timeout in seconds
  filter: "pattern",             // Filter tests by name
  verbose: false                 // Verbose output
}
```

### Usage Examples

**Example 1: Run Jest Tests with Coverage**
```bash
npm run execute -- run-tests \
  --testPath="./tests" \
  --framework="jest" \
  --coverage=true
```

**Example 2: Run Pytest with Parallel Execution**
```bash
npm run execute -- run-tests \
  --testPath="./tests" \
  --framework="pytest" \
  --parallel=true
```

**Example 3: Auto-Detect Framework**
```bash
npm run execute -- run-tests \
  --testPath="./tests" \
  --framework="auto"
```

**Example 4: Detect Flaky Tests**
```bash
npm run execute -- run-tests \
  --testPath="./tests" \
  --framework="jest" \
  --retryFlaky=true \
  --maxRetries=3
```

### Understanding Results

**Success Result**:
```json
{
  "success": true,
  "framework": "jest",
  "statistics": {
    "total": 100,
    "passed": 100,
    "failed": 0,
    "skipped": 0
  },
  "coverage": {
    "statements": 95,
    "branches": 92,
    "functions": 97,
    "lines": 94
  },
  "recommendations": []
}
```

**Failed Result with Recommendations**:
```json
{
  "success": false,
  "framework": "jest",
  "statistics": {
    "total": 100,
    "passed": 95,
    "failed": 5,
    "skipped": 0
  },
  "coverage": {
    "statements": 75
  },
  "flakyTests": [
    {
      "name": "async operation test",
      "failureCount": 2,
      "attempts": 3,
      "severity": "high"
    }
  ],
  "recommendations": [
    {
      "type": "coverage",
      "priority": "high",
      "message": "Increase coverage to 80%+"
    },
    {
      "type": "flakiness",
      "priority": "high",
      "message": "Fix 1 flaky test"
    }
  ]
}
```

### Interpreting Recommendations

**Coverage Gap**:
- Current coverage below 80%?
- Action: Add tests for uncovered code paths

**Flaky Tests**:
- Tests that intermittently fail?
- Action: Debug timing issues, add waits, improve async handling

**High Failure Rate**:
- >5% of tests failing?
- Action: Focus on fixing failures before proceeding

**Performance**:
- Tests taking too long?
- Action: Enable parallel execution, optimize test setup

### Framework Detection

The skill auto-detects the framework based on:

**Jest**:
- Files: `*.test.js`, `*.spec.js`, `*.test.ts`, `*.spec.ts`
- `package.json` contains `jest` dependency
- Configuration: `jest.config.js` or `jest` section in `package.json`

**Pytest**:
- Files: `test_*.py`, `*_test.py`
- `package.json` contains `pytest.ini` or `setup.py`
- Configuration: `pytest.ini` or `setup.cfg`

**Mocha**:
- Files: `*.test.js`, `*.spec.js`
- `package.json` contains `mocha` dependency
- Configuration: `.mocharc.js` or `mocha` section in `package.json`

**Go**:
- Files: `*_test.go`
- `go.mod` file present
- Run via: `go test ./...`

---

## 🔧 PART 3: TROUBLESHOOTING GUIDE (20 minutes)

### Problem: "Cannot find module 'jest'"

**Cause**: Jest not installed in project

**Solution**:
```bash
npm install --save-dev jest
npm run test:integration
```

### Problem: Tests Timeout

**Cause**: Tests taking longer than configured timeout

**Solution 1 - Increase timeout**:
```bash
npm run test:integration -- --testTimeout=30000
```

**Solution 2 - Optimize tests**:
- Remove unnecessary waits
- Mock external calls
- Use test fixtures

### Problem: Coverage Not Generated

**Cause**: Coverage tools not configured

**Solution**:
```bash
# Ensure jest.config.js has coverage settings
npm run test:integration -- --coverage

# Manual coverage
npm test -- --coverage
```

### Problem: Some Tests Fail Locally but Pass in CI

**Cause**: Environment differences or flaky tests

**Solution**:
```bash
# Retry failed tests
npm run test:integration -- --runInBand

# Enable verbose output
npm run test:integration -- --verbose

# Check for timing issues
npm run test:integration -- --detectOpenHandles
```

### Problem: "EADDRINUSE: address already in use"

**Cause**: Port already in use (usually from previous test run)

**Solution**:
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change test port
PORT=3001 npm run test:integration
```

### Problem: Mock Database Connection Fails

**Cause**: Mock setup incomplete

**Solution**:
```javascript
// In test file
beforeAll(async () => {
  // Setup mock database
  await mockDb.initialize();
});

afterAll(async () => {
  // Cleanup
  await mockDb.cleanup();
});
```

### Problem: "Cannot find file ./tests"

**Cause**: Test path incorrect

**Solution**:
```bash
# Check test directory exists
ls -la plugin/tests/

# Use correct path
npm run test:integration -- plugin/tests/
```

### Getting Help

1. **Check logs**: `npm run test:integration -- --verbose`
2. **Review error message**: Usually contains helpful hints
3. **Search documentation**: Keywords from error message
4. **Ask team**: Use #integration-testing channel
5. **Create issue**: GitHub issues with reproduction steps

---

## ❓ PART 4: FAQ DOCUMENT (20 minutes)

**Q: How often should I run integration tests?**
A: Before committing (pre-commit hook), on every PR, and before deployments.

**Q: What if a test is flaky?**
A: The skill detects flaky tests automatically. Fix the test by:
- Adding explicit waits
- Mocking time-dependent code
- Ensuring async operations complete

**Q: Can I skip certain tests?**
A: Yes, but discouraged. Mark with `.skip` only for temporarily disabled tests.

**Q: How long should tests take?**
A: ~51 seconds for full suite. If slower, enable parallel execution.

**Q: What coverage is good enough?**
A: Target 90%+ statements, 85%+ branches. Discuss with team.

**Q: Do I need to run all frameworks?**
A: No, run framework matching your code (Jest for JavaScript, Pytest for Python).

**Q: How do I debug a failing test?**
A: Run individual test with verbose output:
```bash
npm test -- --testNamePattern="specific test" --verbose
```

**Q: Can tests be run in Docker?**
A: Yes, integration tests are designed for Docker environments.

**Q: What's the difference between unit and integration tests?**
A:
- Unit: Single component in isolation
- Integration: Multiple components working together

**Q: How are recommendations generated?**
A: Based on test results, coverage, flakiness, performance metrics.

---

## ✅ PART 5: TRAINING CHECKLIST (30 minutes)

### Day 1: Onboarding (30 minutes)

- [ ] Read Quick Start Guide (15 min)
- [ ] Run integration tests locally (10 min)
- [ ] Review test output format (5 min)
- [ ] Ask questions about what you learned

### Day 2: Framework Details (45 minutes)

- [ ] Read Run-Tests Skill Guide (30 min)
- [ ] Choose a test framework you use (Jest/Pytest/Mocha/Go)
- [ ] Run tests with that framework specifically (10 min)
- [ ] Compare coverage reports (5 min)

### Day 3: Troubleshooting (30 minutes)

- [ ] Read Troubleshooting Guide (15 min)
- [ ] Intentionally break a test to practice debugging (10 min)
- [ ] Use verbose mode to understand test execution (5 min)

### Week 1: Practice (Throughout week)

- [ ] Run tests before each commit
- [ ] Review coverage reports
- [ ] Help teammates with test issues
- [ ] Document any new issues you encounter

### Week 2: Expertise (Throughout week)

- [ ] Suggest test improvements to teammates
- [ ] Help write new integration tests
- [ ] Mentor newer team members
- [ ] Contribute to test framework improvements

### Certification Criteria

You're ready when you can:

- ✅ Run all integration tests successfully
- ✅ Understand test output and coverage metrics
- ✅ Troubleshoot common issues
- ✅ Write a simple integration test
- ✅ Help a teammate fix a failing test

---

## 📋 TRAINING SUMMARY

| Topic | Time | Key Takeaway |
|-------|------|--------------|
| Quick Start | 15 min | How to run tests and understand output |
| Run-Tests Skill | 30 min | Multi-framework test execution |
| Troubleshooting | 20 min | How to fix common issues |
| FAQ | 20 min | Answers to common questions |
| Checklist | 30 min | Self-paced learning path |
| **Total** | **115 min** | **Complete understanding** |

---

## 🎓 Next Steps After Training

1. **Start Running Tests**: Make it part of your daily workflow
2. **Review Coverage**: Check coverage reports on your code
3. **Fix Flaky Tests**: If you find any, help fix them
4. **Write Tests**: Add tests for new code
5. **Share Knowledge**: Help teammates learn

---

## 📞 Support & Resources

**Questions?**
- Slack: #integration-testing
- Docs: `/plugin/tests/INTEGRATION_TESTING_GUIDE.md`
- Office Hours: Thursdays 2-3 PM UTC

**Quick Links**:
- Integration Test Plan: `TASK_EXECUTION_PLAN_1_to_4.md`
- Complete Guide: `INTEGRATION_TESTING_GUIDE.md`
- Test Files: `plugin/tests/`
- Run-Tests Skill: `plugin/skills/run-tests.js`

---

## ✨ Congratulations!

You're now trained on HMS Integration Testing Framework!

Next, you can:
1. Help other team members learn
2. Contribute to test suite improvements
3. Write tests for new features
4. Help improve test performance

**Welcome to the team!** 🎉

---

**Training Package Status**: ✅ Complete and Ready for Delivery
**Last Updated**: October 31, 2025
**Version**: 1.0.0
