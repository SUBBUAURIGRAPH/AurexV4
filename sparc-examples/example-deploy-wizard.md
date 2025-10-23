# SPARC Example: deploy-wizard Skill

**Skill Name**: deploy-wizard
**Agent**: DevOps Engineer
**Developer**: DevOps Team
**Date**: October 2025
**Status**: ✅ Production (v1.0.0)
**Lines of Code**: 600+

---

## Executive Summary

The deploy-wizard skill automated deployment processes across multiple environments (dev4, aurex, production), reducing deployment time by 83% (from 30 minutes to 5 minutes) while achieving zero deployment-related incidents.

**Key Results**:
- ⏱️ Time Saved: 83% (30min → 5min per deployment)
- 🎯 Deployment Success Rate: 99.9%
- 🐛 Production Incidents: 0 (was 15% before)
- 📊 Test Coverage: 92.3%
- 🔒 Security Score: 95/100

---

## Phase 1: Specification

### Problem Statement

**Before deploy-wizard**:
- Manual deployments took 30 minutes per environment
- Error-prone process causing production incidents 15% of the time
- 20+ separate scripts needed manual execution
- Inconsistent deployment procedures across teams
- No automated rollback mechanism
- Limited audit trail for compliance

**Why This Skill Was Critical**:
- 50+ deployments per month = 25 hours of manual work
- Production incidents cost ~$5,000 each in downtime
- Compliance requirements demanded complete audit trails
- Team frustration with manual, repetitive work

### Requirements Gathered

#### Functional Requirements
- **FR1**: Support three environments (dev4, aurex, production)
- **FR2**: Pre-deployment validation (tests, coverage, security)
- **FR3**: Multiple deployment strategies (blue-green, rolling, recreate)
- **FR4**: Automated health checks and monitoring
- **FR5**: Automatic rollback on failure
- **FR6**: Complete audit trail and reporting

#### Non-Functional Requirements
- **NFR1 - Performance**: Complete deployment in <5 minutes
- **NFR2 - Reliability**: 99.9% deployment success rate
- **NFR3 - Security**: No credential exposure, secure deployments
- **NFR4 - Auditability**: Complete logs for compliance (SOX, ISO 27001)
- **NFR5 - Usability**: Simple one-command deployment

### Use Cases Documented

#### Primary Use Case 1: Standard Deployment
**Scenario**: Deploy latest code to dev4 for testing
**Steps**:
1. Developer commits code to main branch
2. Invokes: `@devops-engineer deploy-wizard dev4`
3. Agent runs tests, checks coverage
4. Deploys using blue-green strategy
5. Runs health checks
6. Switches traffic to new version
7. Reports success

**Success Criteria**: Deployment completes in <5 minutes with all checks passing

#### Primary Use Case 2: Production Deployment
**Scenario**: Deploy tested code to production
**Steps**: [Similar but with additional approvals and validations]

#### Edge Cases Handled
1. **Tests fail during pre-deployment**: Abort, report failures
2. **Health checks fail post-deployment**: Automatic rollback
3. **Partial deployment failure**: Rollback to last known good state
4. **Network issues during deployment**: Retry logic, then rollback

### Acceptance Criteria (All Met ✅)
- ✅ Deployment time <5 minutes (Actual: 3.2 minutes average)
- ✅ Success rate >95% (Actual: 99.9%)
- ✅ Zero manual steps required
- ✅ Complete audit trail for all deployments
- ✅ Rollback completes in <2 minutes (Actual: 1.5 minutes)
- ✅ Works across all three environments
- ✅ Test coverage >80% (Actual: 92.3%)

### Stakeholder Sign-off

✅ **Product Owner**: Approved - Critical for velocity
✅ **Technical Lead**: Approved - Architecture sound
✅ **Security Team**: Approved - Security requirements met
✅ **DevOps Lead**: Approved - Solves major pain point

---

## Phase 2: Pseudocode

### High-Level Algorithm

```
FUNCTION deploy_wizard(environment, strategy, options):
  // ============================================
  // Phase 1: Pre-deployment Validation
  // ============================================
  PRINT "Starting pre-deployment validation..."

  RUN test_suite()
  IF tests_fail:
    REPORT "Tests failed: [list failures]"
    RETURN error_report

  CHECK code_coverage()
  IF coverage < 80%:
    REPORT "Coverage too low: [current]%"
    RETURN error_report

  SCAN security_vulnerabilities()
  IF critical_vulnerabilities_found:
    REPORT "Security issues: [list issues]"
    RETURN error_report

  VALIDATE environment_config(environment)
  IF config_invalid:
    REPORT "Invalid config: [errors]"
    RETURN error_report

  PRINT "✅ Pre-deployment validation passed"

  // ============================================
  // Phase 2: Backup Current State
  // ============================================
  PRINT "Creating deployment backup..."

  backup = CREATE_BACKUP()
    - version = get_current_version()
    - state = capture_environment_state()
    - timestamp = current_timestamp()

  SAVE rollback_point(backup)
  PRINT "✅ Backup created: [backup_id]"

  // ============================================
  // Phase 3: Execute Deployment
  // ============================================
  PRINT "Starting deployment with [strategy] strategy..."

  TRY:
    IF strategy == "blue-green":
      // Blue-Green Deployment
      green_env = CREATE_NEW_ENVIRONMENT()
      DEPLOY_TO(green_env)
      RUN health_checks(green_env)

      IF health_checks_pass:
        SWITCH_TRAFFIC(blue_env -> green_env)
        KEEP(blue_env) FOR rollback
        PRINT "✅ Traffic switched to new version"
      ELSE:
        DESTROY(green_env)
        RETURN error("Health checks failed")

    ELSE IF strategy == "rolling":
      // Rolling Deployment
      FOR each instance in instances:
        UPDATE_INSTANCE(instance)
        RUN health_check(instance)
        IF health_check_fails:
          ROLLBACK_ALL()
          RETURN error("Instance [id] failed health check")
        WAIT(stagger_delay)

    ELSE IF strategy == "recreate":
      // Recreate Deployment
      SHUTDOWN_OLD()
      DEPLOY_NEW()
      RUN health_checks()

  CATCH deployment_error:
    PRINT "❌ Deployment failed: [error]"
    EXECUTE rollback_procedure(backup)
    RETURN error_report

  // ============================================
  // Phase 4: Post-deployment Validation
  // ============================================
  PRINT "Running post-deployment validation..."

  RUN health_endpoints()
  IF health_check_fails:
    EXECUTE automatic_rollback()
    RETURN error("Health endpoints failing")

  RUN smoke_tests()
  IF smoke_tests_fail:
    EXECUTE automatic_rollback()
    RETURN error("Smoke tests failed")

  MONITOR error_rates(duration: 2 minutes)
  IF error_rate > threshold:
    EXECUTE automatic_rollback()
    RETURN error("High error rate detected")

  CHECK performance_metrics()
  IF performance_degraded:
    WARN "Performance degradation detected"
    // Don't rollback, but alert team

  PRINT "✅ Post-deployment validation passed"

  // ============================================
  // Phase 5: Cleanup and Reporting
  // ============================================
  PRINT "Cleaning up and generating report..."

  CLEANUP old_versions(keep_last: 3)

  GENERATE deployment_report():
    - deployment_id
    - environment
    - strategy_used
    - start_time, end_time, duration
    - pre_deployment_checks: PASSED
    - deployment_status: SUCCESS
    - post_deployment_checks: PASSED
    - rollback_point_saved
    - old_version, new_version
    - metrics_snapshot

  SEND_NOTIFICATIONS(stakeholders, report)

  LOG_AUDIT_TRAIL():
    - who: current_user
    - what: "deployment"
    - when: timestamp
    - where: environment
    - why: deployment_reason
    - how: strategy
    - result: "SUCCESS"

  PRINT "🎉 Deployment completed successfully!"
  RETURN success_report

END FUNCTION
```

### Key Functions Decomposed

#### Function: run_test_suite()
```
FUNCTION run_test_suite():
  RESULTS = []

  PRINT "Running unit tests..."
  unit_results = RUN "npm test -- --testPathPattern=unit"
  RESULTS.add(unit_results)

  PRINT "Running integration tests..."
  integration_results = RUN "npm test -- --testPathPattern=integration"
  RESULTS.add(integration_results)

  PRINT "Running functional tests..."
  functional_results = RUN "npm test -- --testPathPattern=functional"
  RESULTS.add(functional_results)

  AGGREGATE results
  IF any_failures:
    RETURN { success: false, failures: [list] }

  RETURN { success: true, total_tests: N, passed: N }
END FUNCTION
```

#### Function: health_check()
```
FUNCTION health_check(environment):
  endpoints = [
    "/health",
    "/api/health",
    "/api/v1/health"
  ]

  FOR each endpoint in endpoints:
    TRY:
      response = HTTP_GET(endpoint, timeout: 5s)
      IF response.status != 200:
        RETURN { healthy: false, endpoint: endpoint }
    CATCH timeout:
      RETURN { healthy: false, error: "timeout" }

  RETURN { healthy: true }
END FUNCTION
```

### Data Flow Diagram

```
Input Params
    ↓
Validation
    ↓
[Valid?] → No → Return Error
    ↓ Yes
Pre-deployment Checks
    ↓
[Passed?] → No → Return Error Report
    ↓ Yes
Create Backup
    ↓
Execute Deployment Strategy
    ↓
[Success?] → No → Auto Rollback → Return Error
    ↓ Yes
Post-deployment Validation
    ↓
[Valid?] → No → Auto Rollback → Return Error
    ↓ Yes
Cleanup & Report
    ↓
Success Response
```

---

## Phase 3: Architecture

### Component Structure (Implemented)

```
skills/deploy-wizard/
├── index.js                    # Main entry point
├── core/
│   ├── validator.js            # Pre-deployment validation
│   ├── deployment.js           # Core deployment orchestration
│   ├── health-checker.js       # Health check utilities
│   └── rollback.js             # Rollback procedures
├── strategies/
│   ├── blue-green.js           # Blue-green deployment strategy
│   ├── rolling.js              # Rolling update strategy
│   └── recreate.js             # Recreate strategy
├── integrations/
│   ├── docker.js               # Docker integration
│   ├── kubernetes.js           # Kubernetes integration (future)
│   └── monitoring.js           # Monitoring integration
├── utils/
│   ├── logger.js               # Structured logging
│   ├── reporter.js             # Report generation
│   ├── notifier.js             # Slack/email notifications
│   └── audit.js                # Audit trail logging
├── config/
│   └── environments.js         # Environment configurations
└── tests/
    ├── unit/                   # Unit tests (85% coverage)
    ├── integration/            # Integration tests (95% coverage)
    └── fixtures/               # Test data
```

### Technology Stack Decisions

**Runtime**: Node.js 18 LTS
- Why: Async I/O perfect for orchestration tasks
- Why: Strong ecosystem for Docker/K8s integration

**Testing**: Jest + Supertest
- Why: Industry standard, great mocking capabilities
- Why: Integrated coverage reporting

**Containerization**: Docker
- Why: Already in use across Aurigraph
- Why: Blue-green deployments require container orchestration

**Monitoring**: Prometheus + Grafana
- Why: Already deployed in infrastructure
- Why: Great for real-time metrics during deployment

**Logging**: Winston + ELK Stack
- Why: Structured logging for audit trails
- Why: Integration with existing log aggregation

### Design Patterns Applied

1. **Strategy Pattern** (strategies/)
   - Different deployment strategies (blue-green, rolling, recreate)
   - Easy to add new strategies in future
   - Encapsulates algorithm variations

2. **Builder Pattern** (deployment.js)
   - Complex deployment configuration
   - Step-by-step construction of deployment plan

3. **Observer Pattern** (monitoring.js)
   - Real-time monitoring during deployment
   - Multiple subscribers (logs, alerts, reports)

4. **Command Pattern** (rollback.js)
   - Encapsulates rollback as command object
   - Supports undo operations

### Security Design

- **No credential storage in code**: All from environment/vault
- **Principle of least privilege**: Minimal permissions required
- **Audit logging**: Every action logged with who/what/when/why
- **Secure communication**: HTTPS only, certificate validation
- **Input sanitization**: All user inputs validated and sanitized

---

## Phase 4: Refinement

### Implementation Progress (All Completed ✅)

- ✅ Core deployment logic (deployment.js) - 200 lines
- ✅ Blue-green strategy (blue-green.js) - 150 lines
- ✅ Rolling strategy (rolling.js) - 120 lines
- ✅ Validation logic (validator.js) - 100 lines
- ✅ Health checks (health-checker.js) - 80 lines
- ✅ Rollback procedures (rollback.js) - 100 lines
- ✅ Logging and reporting - 80 lines
- ✅ Configuration management - 50 lines

**Total**: 600+ lines of production code

### Testing Results

#### Unit Tests
- **Coverage**: 85% (target: 80%)
- **Tests**: 45 unit tests
- **All Passing**: ✅

Key test areas:
- Input validation logic
- Strategy selection
- Error handling paths
- Utility functions

#### Integration Tests
- **Coverage**: 95%
- **Tests**: 20 integration tests
- **All Passing**: ✅

Key test scenarios:
- End-to-end deployment workflows
- Rollback procedures
- Health check integrations
- Docker API interactions

#### Performance Tests
- **Load Test**: 10 concurrent deployments ✅
- **Stress Test**: Handles network failures gracefully ✅
- **Response Time**: Average 3.2 minutes (target: <5 min) ✅

#### Security Tests
- **npm audit**: 0 vulnerabilities ✅
- **Code scan**: No security issues ✅
- **Penetration test**: Passed ✅
- **Security Score**: 95/100 ✅

### Code Reviews

**Review 1** (Senior DevOps Engineer):
- ✅ Approved with minor comments
- Feedback: "Excellent error handling, comprehensive logging"
- Changes: Added timeout handling for health checks

**Review 2** (Security Team):
- ✅ Approved
- Feedback: "Strong security posture, good audit trail"
- Changes: Enhanced credential handling

**Review 3** (Platform Architect):
- ✅ Approved
- Feedback: "Architecture is solid and extensible"
- No changes required

### Iterations

**Iteration 1**: Basic blue-green deployment
- Result: Works but lacks comprehensive validation

**Iteration 2**: Added pre/post deployment checks
- Result: Much more robust, caught issues early

**Iteration 3**: Implemented rollback logic
- Result: Safety net in place, confidence increased

**Iteration 4**: Added rolling and recreate strategies
- Result: Flexible for different scenarios

**Iteration 5**: Enhanced monitoring and reporting
- Result: Great visibility, stakeholder satisfaction

---

## Phase 5: Completion

### Production Deployment

**Staging Deployment**: September 15, 2025
- Status: ✅ Complete
- Tests: 30 deployments, all successful
- Issues: 2 minor (both fixed)

**Production Deployment**: October 1, 2025
- Status: ✅ Complete
- Strategy: Gradual rollout (20% → 50% → 100%)
- Rollback Plan: Ready (never needed)
- Monitoring: Active and healthy

### Documentation Completed

- ✅ User guide: How to use deploy-wizard
- ✅ API documentation: All functions documented
- ✅ Troubleshooting guide: Common issues and solutions
- ✅ Runbook: Operations procedures
- ✅ Architecture diagrams: System design documented

### Team Handoff

**Training Sessions**: 3 sessions, 45 people trained
- Session 1: Overview and benefits
- Session 2: Hands-on deployment
- Session 3: Advanced scenarios and troubleshooting

**Feedback**: 4.8/5 average rating
- "Game changer for our deployment process"
- "So much faster and more reliable"
- "Love the automated rollback"

### Success Metrics Achieved

| Metric | Baseline | Target | Actual | Status |
|--------|----------|--------|--------|--------|
| Deployment Time | 30 min | <5 min | 3.2 min | ✅ 83% improvement |
| Success Rate | 85% | >95% | 99.9% | ✅ Exceeded |
| Production Incidents | 15% | <5% | 0% | ✅ Perfect |
| User Satisfaction | 2.5/5 | >4/5 | 4.8/5 | ✅ Excellent |
| Time Saved/Week | 0 | 10hrs | 21hrs | ✅ 2x target |

### Lessons Learned

#### What Went Well
1. **SPARC methodology prevented rework**: Comprehensive planning meant implementation went smoothly
2. **Pseudocode was incredibly valuable**: Converting to code was straightforward
3. **Early stakeholder buy-in**: Sign-offs prevented scope creep
4. **Iterative refinement**: Each iteration added real value
5. **Comprehensive testing**: Caught issues before production

#### What Could Be Improved
1. **Initial scope was ambitious**: Could have started with just blue-green
2. **Documentation took longer than expected**: 8 hours → 12 hours
3. **Performance testing should have started earlier**: Found optimization opportunities late

#### Action Items for Future Skills
1. Start with MVP, iterate to full feature set
2. Allocate more time for documentation (1.5x estimate)
3. Begin performance testing in Architecture phase
4. Create test plan during Pseudocode phase
5. Schedule code reviews during implementation, not after

---

## SPARC Time Breakdown

| Phase | Estimated | Actual | % of Total |
|-------|-----------|--------|------------|
| **Specification** | 3 hrs | 4 hrs | 7% |
| **Pseudocode** | 4 hrs | 5 hrs | 9% |
| **Architecture** | 8 hrs | 10 hrs | 18% |
| **Refinement** | 35 hrs | 32 hrs | 57% |
| **Completion** | 4 hrs | 5 hrs | 9% |
| **Total** | **54 hrs** | **56 hrs** | **100%** |

**Note**: Planning phases (Spec + Pseudo + Arch) = 34% of total time
**Result**: Implementation faster due to clear plan, minimal rework

---

## Key Takeaways

### SPARC Benefits Realized

1. **Clear Requirements**: No scope creep, everyone aligned
2. **Better Architecture**: Planned for extensibility from start
3. **Faster Implementation**: Pseudocode made coding straightforward
4. **Higher Quality**: 92.3% test coverage, zero incidents
5. **Great Documentation**: SPARC forced us to document as we went

### Would We Use SPARC Again?

**Absolutely YES! 🎉**

The upfront planning time (19 hours) was more than compensated by:
- Faster implementation (estimated 50 hours, actual 32 hours)
- Zero rework needed
- No production incidents
- Excellent team satisfaction
- Clear documentation from day one

**Estimated Time Without SPARC**: 80-100 hours (lots of rework)
**Actual Time With SPARC**: 56 hours
**Time Saved**: 24-44 hours (30-44%)

---

## Artifacts

All SPARC artifacts are available:

- [Specification Document](../sparc-docs/deploy-wizard-spec.md)
- [Pseudocode](../sparc-docs/deploy-wizard-pseudocode.md)
- [Architecture Diagrams](../sparc-docs/deploy-wizard-architecture.md)
- [Source Code](../../src/skills/deploy-wizard/)
- [Test Suite](../../src/skills/deploy-wizard/tests/)
- [Documentation](../skills/deploy-wizard.md)

---

**Example Status**: ✅ Complete and Production-Ready
**Last Updated**: October 20, 2025
**Success Story**: Yes - Recommended reference for complex skills
