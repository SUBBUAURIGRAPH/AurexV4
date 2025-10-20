# Aurigraph Agent Usage Examples

Real-world examples of using specialized agents for common tasks in Hermes 2.0 and Aurigraph DLT development.

## Table of Contents
1. [DLT Development Examples](#dlt-development-examples)
2. [Trading Operations Examples](#trading-operations-examples)
3. [DevOps Examples](#devops-examples)
4. [QA Testing Examples](#qa-testing-examples)
5. [Project Management Examples](#project-management-examples)
6. [Security & Compliance Examples](#security--compliance-examples)
7. [Multi-Agent Workflows](#multi-agent-workflows)

---

## DLT Development Examples

### Example 1: Create and Deploy ERC-20 Token

**Scenario**: Need to tokenize BTC holdings on Polygon network

```
@dlt-developer

Create an ERC-20 token for representing BTC holdings with these requirements:
- Token name: "Aurigraph BTC"
- Symbol: ABTC
- Decimals: 8 (to match BTC)
- Total supply: 1,000,000 tokens
- Mintable by admin only
- Burnable by token holders
- Transfer restrictions for compliance
- Deploy to Polygon testnet first, then mainnet after testing
```

**Expected Workflow**:
1. Agent generates ERC-20 contract with OpenZeppelin standards
2. Implements minting/burning with access control
3. Adds compliance transfer restrictions
4. Compiles and deploys to Polygon Mumbai testnet
5. Tests minting, transferring, and burning
6. Runs security audit with `dlt-auditor` skill
7. Deploys to Polygon mainnet
8. Integrates with Hermes trading system

---

### Example 2: Optimize Gas Costs

**Scenario**: Token transfers are too expensive

```
@dlt-developer

Our ABTC token transfers are costing 120k gas. Use the gas-optimizer skill to:
1. Analyze current gas consumption
2. Identify optimization opportunities
3. Refactor contract code
4. Implement batch transfer functionality
5. Test gas savings on testnet
6. Generate cost comparison report
```

---

### Example 3: Smart Contract Security Audit

**Scenario**: Need security review before mainnet deployment

```
@dlt-developer

Use the dlt-auditor skill to audit the ABTC token contract:
- Check for common vulnerabilities (reentrancy, overflow, etc.)
- Validate access control mechanisms
- Test for edge cases
- Review gas optimization opportunities
- Generate comprehensive audit report
```

---

## Trading Operations Examples

### Example 4: Create Momentum Trading Strategy

**Scenario**: Develop and test a momentum strategy for BTC/USD

```
@trading-operations

Create a momentum trading strategy for BTC/USD with these specifications:
- Use MA crossover (50-day fast, 200-day slow)
- Entry: Buy when fast MA crosses above slow MA
- Exit: Sell when fast MA crosses below slow MA
- Risk: 2% per trade with stop-loss
- Position size: 10% of portfolio
- Backtest on 2023 data
- Optimize for best Sharpe ratio
```

**Expected Workflow**:
1. Uses `strategy-builder` to create momentum template
2. Configures indicators and entry/exit rules
3. Implements risk management rules
4. Uses `backtest-manager` to test on historical data
5. Analyzes performance metrics
6. Optimizes parameters
7. Generates performance report
8. Deploys to paper trading

---

### Example 5: Investigate Exchange Issues

**Scenario**: Orders failing on Binance

```
@trading-operations

Our Binance orders have been failing with "Insufficient balance" errors.
Use exchange-connector to:
1. Test Binance connection
2. Check API credentials
3. Verify account balances
4. Review rate limits
5. Analyze recent error logs
6. Provide resolution steps
```

---

### Example 6: Portfolio Risk Analysis

**Scenario**: Need to assess current portfolio risk

```
@trading-operations

Use portfolio-analyzer to analyze our current portfolio:
- Calculate Value at Risk (VaR)
- Assess maximum drawdown
- Analyze asset correlations
- Identify concentration risk
- Check if any positions exceed limits
- Recommend rebalancing if needed
- Generate risk report for executives
```

---

## DevOps Examples

### Example 7: Deploy to Production

**Scenario**: Deploy Hermes 2.0.1 to production

```
@devops-engineer

Deploy Hermes 2.0.1 to production using deploy-wizard:
1. Run pre-deployment checklist:
   - All tests passing
   - Security scan complete
   - Database migrations ready
   - Credentials verified
2. Create backup of production database
3. Deploy with zero downtime
4. Run health checks post-deployment
5. Monitor logs for 15 minutes
6. Send deployment notification
```

**Expected Workflow**:
1. Validates pre-deployment requirements
2. Uses `backup-manager` to backup database
3. Uses `env-configurator` to verify production config
4. Executes deployment script
5. Uses `health-monitor` to verify services
6. Uses `log-aggregator` to monitor logs
7. Generates deployment report

---

### Example 8: Troubleshoot Performance Issue

**Scenario**: API endpoints are slow

```
@devops-engineer

API response times have increased to 800ms (target: <200ms).
Use performance-profiler to:
1. Benchmark all API endpoints
2. Identify slow database queries
3. Check resource usage (CPU, memory)
4. Analyze Redis cache hit rate
5. Recommend optimizations
6. Implement fixes
7. Verify improvement
```

---

### Example 9: Docker Container Management

**Scenario**: Need to restart trading services

```
@devops-engineer

Use docker-manager to:
1. Check current status of all containers
2. Identify trading-related containers
3. Gracefully stop trading agents
4. Restart containers in correct order
5. Verify all services are healthy
6. Check logs for startup issues
7. Confirm trading agents are operational
```

---

## QA Testing Examples

### Example 10: Pre-Deployment Test Suite

**Scenario**: Run full test suite before production deployment

```
@qa-engineer

Run comprehensive test suite for Hermes 2.0.1 deployment:
1. Unit tests (>85% coverage required)
2. Integration tests (all exchanges)
3. Functional tests (end-to-end workflows)
4. Security tests (SQL injection, XSS)
5. Performance tests (API benchmarks)
6. Generate test report
7. Provide go/no-go recommendation
```

**Expected Workflow**:
1. Uses `test-runner` for all test types
2. Uses `coverage-analyzer` to verify 80%+ coverage
3. Uses `security-scanner` for security tests
4. Uses `exchange-tester` for exchange validation
5. Uses `performance-tester` for benchmarks
6. Generates comprehensive report
7. Provides deployment recommendation

---

### Example 11: Validate Backtesting System

**Scenario**: New backtesting feature needs validation

```
@qa-engineer

Validate the new backtesting system:
1. Create test backtest configurations
2. Run backtests with known strategies
3. Verify performance metric calculations (Sharpe, Sortino, drawdown)
4. Test WebSocket notifications
5. Validate API endpoints
6. Test concurrent backtests
7. Generate validation report
```

---

### Example 12: Generate Tests for New Feature

**Scenario**: New trading agent needs test coverage

```
@qa-engineer

Use test-generator to create tests for the new ArbitrageAgent:
- Generate unit tests for all methods
- Create integration tests for exchange interactions
- Add mock data for testing
- Create E2E test scenarios
- Ensure 80%+ coverage
- Document test cases
```

---

## Project Management Examples

### Example 13: Plan Sprint 8

**Scenario**: Need to plan upcoming sprint

```
@project-manager

Plan Sprint 8 (Oct 21 - Nov 3) using sprint-planner:
1. Review prioritized backlog
2. Analyze team velocity from last 3 sprints
3. Select stories based on capacity (40 story points)
4. Assign tickets to team members
5. Identify dependencies and risks
6. Create sprint goal
7. Generate sprint planning document
8. Schedule sprint kickoff
```

**Expected Workflow**:
1. Uses `backlog-manager` to review backlog
2. Uses `sprint-planner` to create Sprint 8
3. Analyzes historical velocity
4. Selects appropriate stories
5. Uses `risk-tracker` to identify dependencies
6. Generates planning document

---

### Example 14: Sync JIRA with GitHub

**Scenario**: Need to sync latest code changes to JIRA

```
@project-manager

Use jira-sync to:
1. Sync all commits from last week to JIRA tickets
2. Update ticket status based on PR state
3. Create tickets for code TODOs
4. Link commits to epics
5. Generate sync report
6. Notify team of updates
```

---

### Example 15: Generate Weekly Status Report

**Scenario**: Need status report for stakeholders

```
@project-manager

Generate weekly status report for executives:
1. Summarize Sprint 7 progress
2. List completed stories and features
3. Identify blockers and risks
4. Show team velocity trend
5. Highlight upcoming milestones
6. Format for executive audience
```

---

## Security & Compliance Examples

### Example 16: Pre-Deployment Security Scan

**Scenario**: Security check before production deployment

```
@security-compliance

Run comprehensive security scan before Hermes 2.0.1 deployment:
1. Execute security test suite (SQL injection, XSS, CSRF)
2. Scan dependencies for vulnerabilities (npm audit)
3. Check API authentication and authorization
4. Verify data encryption (at rest and in transit)
5. Test rate limiting
6. Generate security report with risk assessment
7. Provide go/no-go recommendation
```

**Expected Workflow**:
1. Uses `security-scanner` for automated tests
2. Uses `vulnerability-manager` for dependency scan
3. Uses `access-monitor` to review permissions
4. Uses `audit-logger` to verify logging
5. Generates comprehensive security report

---

### Example 17: Monthly Compliance Report

**Scenario**: Generate monthly compliance report for regulators

```
@security-compliance

Generate October 2025 compliance report:
1. Validate ESG metrics reporting
2. Check trading compliance rules (no violations)
3. Verify audit trail completeness (100% coverage)
4. Assess data privacy compliance (GDPR, CCPA)
5. Review financial regulations compliance (MiFID II, SEC)
6. Generate executive summary
7. Identify compliance gaps and remediation plan
```

---

### Example 18: Rotate Production Credentials

**Scenario**: Quarterly credential rotation

```
@security-compliance

Quarterly credential rotation for Q4 2025:
1. Inventory all production credentials
2. Prioritize by criticality (exchanges, databases, APIs)
3. Rotate exchange API keys
4. Update database passwords
5. Rotate service tokens
6. Update .env files securely
7. Verify new credentials work
8. Document rotation in audit log
9. Generate rotation report
```

---

## Multi-Agent Workflows

### Example 19: Deploy New Trading Feature End-to-End

**Scenario**: New momentum strategy feature from development to production

```
Step 1: Development
@trading-operations
Create momentum strategy for BTC/USD with MA crossover logic

Step 2: Testing
@qa-engineer
Run full test suite for momentum strategy including backtests

Step 3: Security Review
@security-compliance
Security scan and compliance check for new strategy

Step 4: Deployment
@devops-engineer
Deploy momentum strategy to production with deploy-wizard

Step 5: Project Management
@project-manager
Update JIRA tickets and generate deployment report
```

---

### Example 20: Investigate Production Incident

**Scenario**: Trading agent crashed in production

```
Step 1: Incident Detection
@devops-engineer
Use health-monitor to identify failed services and log-aggregator to find errors

Step 2: Security Assessment
@security-compliance
Use incident-responder to assess if this is a security incident

Step 3: Root Cause Analysis
@trading-operations
Use agent-orchestrator to analyze agent behavior and logs

Step 4: Fix and Test
@qa-engineer
Validate fix with test-runner and ensure no regression

Step 5: Deploy Fix
@devops-engineer
Deploy hotfix with deploy-wizard and monitor

Step 6: Documentation
@project-manager
Document incident, create JIRA ticket, generate incident report
```

---

### Example 21: Launch New DLT Token Feature

**Scenario**: Complete lifecycle of launching tokenized BTC on Polygon

```
Step 1: Smart Contract Development
@dlt-developer
Create ERC-20 token contract with compliance features

Step 2: Testing
@qa-engineer
Test smart contract thoroughly on testnet

Step 3: Security Audit
@security-compliance
Audit smart contract for vulnerabilities

Step 4: Compliance Validation
@security-compliance
Ensure tokenization meets regulatory requirements

Step 5: Deployment
@devops-engineer
Deploy smart contract to Polygon mainnet

Step 6: Integration
@dlt-developer
Integrate token with Hermes trading platform

Step 7: Trading Strategy
@trading-operations
Create trading strategies for tokenized BTC

Step 8: Project Tracking
@project-manager
Update JIRA, generate launch report
```

---

## Tips for Effective Agent Use

### 1. Be Specific
❌ Bad: "Deploy the app"
✅ Good: "Deploy Hermes 2.0.1 to production environment using zero-downtime deployment"

### 2. Reference Skills
❌ Bad: "Test the code"
✅ Good: "Use test-runner to execute unit and integration tests with coverage report"

### 3. Provide Context
❌ Bad: "Fix the bug"
✅ Good: "The ArbitrageAgent is failing with 'Insufficient balance' on Binance. Use exchange-connector to diagnose."

### 4. Break Down Complex Tasks
❌ Bad: "Launch new feature"
✅ Good: Use multiple agents in sequence for development, testing, security, deployment

### 5. Use Multiple Agents
For complex workflows, orchestrate multiple agents to handle different aspects

---

## Quick Reference

| I want to... | Use Agent | Example |
|--------------|-----------|---------|
| Deploy smart contract | DLT Developer | `@dlt-developer deploy token to Polygon` |
| Create trading strategy | Trading Operations | `@trading-operations create momentum strategy` |
| Deploy to production | DevOps Engineer | `@devops-engineer deploy with deploy-wizard` |
| Run tests | QA Engineer | `@qa-engineer run full test suite` |
| Plan sprint | Project Manager | `@project-manager plan Sprint 8` |
| Security scan | Security & Compliance | `@security-compliance run security scan` |
| Sync JIRA | Project Manager | `@project-manager sync JIRA with GitHub` |
| Troubleshoot exchange | Trading Operations | `@trading-operations test Binance connection` |
| Check portfolio risk | Trading Operations | `@trading-operations analyze portfolio risk` |
| Rotate credentials | Security & Compliance | `@security-compliance rotate production credentials` |

---

**Version**: 1.0.0
**Last Updated**: October 20, 2025
**More Help**: See `AGENT_SHARING_GUIDE.md`
