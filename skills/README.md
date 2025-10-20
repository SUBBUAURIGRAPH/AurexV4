# Aurigraph Agent Skills

This directory contains implemented skills for the 6 specialized Aurigraph agents.

## Priority Skills (Implemented)

### 1. deploy-wizard (DevOps Engineer)
**File**: `deploy-wizard.md`
**Status**: ✅ Implemented
**Purpose**: Intelligent deployment automation across environments

**Key Features**:
- Multi-environment support (dev4, aurex, production)
- Pre-deployment validation checklist
- Blue-green, rolling, and recreate strategies
- Automatic health checks and rollback
- Integration with 20+ existing deployment scripts

**Usage**: `@devops-engineer deploy-wizard "Deploy to production"`

---

### 2. jira-sync (Project Manager)
**File**: `jira-sync.md`
**Status**: ✅ Implemented
**Purpose**: Automated JIRA-GitHub synchronization

**Key Features**:
- Bidirectional sync (GitHub ↔ JIRA)
- Auto-create tickets from TODOs
- Update ticket status from PR state
- Bulk operations
- Sprint tracking
- Integration with 8+ existing JIRA scripts

**Usage**: `@project-manager jira-sync "Sync last week's commits"`

---

### 3. test-runner (QA Engineer)
**File**: `test-runner.md`
**Status**: ✅ Implemented
**Purpose**: Intelligent test execution and reporting

**Key Features**:
- Run tests by type (unit, integration, functional, security, e2e)
- Watch mode for development
- Coverage reports with thresholds
- Retry flaky tests
- Parallel execution
- Integration with Jest and npm scripts

**Usage**: `@qa-engineer test-runner "Run full test suite"`

---

### 4. backtest-manager (Trading Operations)
**File**: `backtest-manager.md`
**Status**: ✅ Implemented
**Purpose**: Comprehensive backtesting workflow automation

**Key Features**:
- Create backtest configurations
- Monitor progress via WebSocket
- Calculate performance metrics
- Compare strategy variants
- Export results
- Integration with new backtesting API

**Usage**: `@trading-operations backtest-manager "Backtest momentum strategy"`

---

### 5. security-scanner (Security & Compliance)
**File**: `security-scanner.md`
**Status**: ✅ Implemented
**Purpose**: Automated security testing and vulnerability scanning

**Key Features**:
- Execute security test suite
- SQL injection testing
- Dependency scanning (npm audit)
- API security testing
- Generate security reports
- Integration with existing security tests

**Usage**: `@security-compliance security-scanner "Run full security scan"`

---

## Skill Implementation Status

| Skill | Agent | Status | Priority |
|-------|-------|--------|----------|
| deploy-wizard | DevOps Engineer | ✅ Implemented | P0 |
| jira-sync | Project Manager | ✅ Implemented | P0 |
| test-runner | QA Engineer | ✅ Implemented | P0 |
| backtest-manager | Trading Operations | ✅ Implemented | P0 |
| security-scanner | Security & Compliance | ✅ Implemented | P0 |
| docker-manager | DevOps Engineer | 📋 Documented | P1 |
| exchange-connector | Trading Operations | 📋 Documented | P1 |
| token-creator | DLT Developer | 📋 Documented | P1 |
| strategy-builder | Trading Operations | 📋 Documented | P1 |
| compliance-checker | Security & Compliance | 📋 Documented | P1 |

## How Skills Work

### Skill Structure
Each skill is defined as a markdown document with:
- Overview and purpose
- Capabilities
- Usage examples
- Configuration
- Implementation details
- Troubleshooting
- Best practices

### Skill Invocation
Skills are referenced through agents:

**Method 1: Natural language**
```
@agent-name "describe task using skill-name"
```

**Method 2: Direct skill reference**
```
@agent-name skill-name "parameters"
```

**Method 3: Explicit invocation (future)**
```
/skill skill-name --param value
```

### Skill Integration
Skills integrate with existing Hermes infrastructure:
- Leverage existing scripts and tools
- Use Hermes APIs and services
- Access databases and configurations
- Send notifications via Slack/email
- Log to monitoring systems

## Skill Development

### Creating New Skills

1. **Document the skill** in `.claude/skills/[skill-name].md`
2. **Define capabilities** and usage examples
3. **Map to existing code** (scripts, APIs, etc.)
4. **Add to agent documentation**
5. **Test the skill** with real scenarios
6. **Collect feedback** and iterate

### Skill Template
Use `SKILL_TEMPLATE.md` to create new skills consistently.

### Skill Best Practices
- Clear purpose and scope
- Well-documented usage
- Integration with existing tools
- Error handling and rollback
- Monitoring and logging
- Success metrics

## Next Skills to Implement (P1)

### Week 1
1. **docker-manager** - Most requested by DevOps
2. **exchange-connector** - Critical for trading operations
3. **token-creator** - High demand from DLT team

### Week 2
4. **strategy-builder** - Trading team priority
5. **compliance-checker** - Regulatory requirement

### Week 3
6. **portfolio-analyzer** - Trading analytics
7. **agent-orchestrator** - Multi-agent coordination

## Skill Metrics

### Usage Tracking
- Invocations per week
- Success rate
- Time saved
- User satisfaction

### Quality Metrics
- Error rate <5%
- Average execution time
- Documentation completeness
- Test coverage

## Support

### Getting Help
- **Documentation**: Read skill markdown file
- **Examples**: Check usage examples in skill doc
- **Slack**: #claude-agents for questions
- **JIRA**: Create ticket (Project: AGENT-*)

### Reporting Issues
When a skill doesn't work as expected:
1. Document what you tried
2. Include error messages
3. Describe expected vs actual behavior
4. Post in #claude-agents or create JIRA ticket

### Suggesting Improvements
- Feature requests welcome
- Post in #claude-agents
- Include use case and benefits
- Tag skill owner

## Skill Ownership

| Skill | Owner | Contact |
|-------|-------|---------|
| deploy-wizard | DevOps Team | #devops |
| jira-sync | PM Team | #project-management |
| test-runner | QA Team | #qa-testing |
| backtest-manager | Trading Team | #trading |
| security-scanner | Security Team | #security |

---

**Directory**: `.claude/skills/`
**Last Updated**: October 20, 2025
**Version**: 1.0.0
**Status**: 5 Priority Skills Implemented ✅
