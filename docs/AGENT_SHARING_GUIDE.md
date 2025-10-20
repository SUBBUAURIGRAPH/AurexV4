# Aurigraph Agent Sharing Guide

This guide explains how to share and use the Aurigraph specialized agents across teams for the Hermes 2.0 platform.

## Overview

We've created **6 specialized agents** with integrated skills to streamline development, operations, and maintenance across Aurigraph DLT and Hermes trading platform:

1. **DLT Developer Agent** - Blockchain & DLT development
2. **Trading Operations Agent** - Trading strategies & exchange management
3. **DevOps Engineer Agent** - Deployment & infrastructure
4. **QA Engineer Agent** - Testing & quality assurance
5. **Project Manager Agent** - Sprint planning & JIRA management
6. **Security & Compliance Agent** - Security & regulatory compliance

## Quick Start

### For Team Members

1. **Clone the repository** (if not already):
   ```bash
   git clone https://github.com/SUBBUAURIGRAPH/Hermes.git
   cd Hermes
   ```

2. **Agents are located** in `.claude/agents/`:
   - `dlt-developer.md`
   - `trading-operations.md`
   - `devops-engineer.md`
   - `qa-engineer.md`
   - `project-manager.md`
   - `security-compliance.md`

3. **Use an agent** in Claude Code:
   ```
   @dlt-developer "Help me deploy a new ERC-20 token"
   ```

   Or reference in prompts:
   ```
   Using the DLT Developer Agent, create a smart contract for tokenizing BTC holdings
   ```

## Agent Capabilities

### 1. DLT Developer Agent
**Location**: `.claude/agents/dlt-developer.md`

**Skills**:
- `blockchain-deploy` - Deploy smart contracts and manage blockchain infrastructure
- `token-creator` - Create and manage tokenized assets
- `dlt-auditor` - Security audit for DLT components
- `web3-integrator` - Integrate Web3 functionality
- `gas-optimizer` - Optimize blockchain transaction costs

**Best For**:
- Smart contract development
- Asset tokenization
- DLT integration
- Blockchain node management
- Gas optimization

**Team**: DLT Team, Backend Team

---

### 2. Trading Operations Agent
**Location**: `.claude/agents/trading-operations.md`

**Skills**:
- `exchange-connector` - Manage exchange connections
- `strategy-builder` - Create trading strategies
- `backtest-manager` - Comprehensive backtesting
- `order-executor` - Advanced order management
- `portfolio-analyzer` - Portfolio analysis
- `market-scanner` - Market opportunity detection
- `agent-orchestrator` - Manage trading agents

**Best For**:
- Trading strategy development
- Exchange integration
- Backtesting and optimization
- Portfolio management
- Agent orchestration

**Team**: Trading Team, Quant Team, Backend Team

---

### 3. DevOps Engineer Agent
**Location**: `.claude/agents/devops-engineer.md`

**Skills**:
- `deploy-wizard` - Deployment automation
- `docker-manager` - Docker operations
- `infra-provisioner` - Infrastructure provisioning
- `env-configurator` - Environment configuration
- `health-monitor` - System health monitoring
- `log-aggregator` - Centralized logging
- `performance-profiler` - Performance analysis
- `backup-manager` - Backup and disaster recovery

**Best For**:
- Deployments (dev4, aurex, production)
- Docker management
- Infrastructure setup
- Monitoring and alerting
- Performance optimization

**Team**: DevOps Team, All Teams (for deployment)

---

### 4. QA Engineer Agent
**Location**: `.claude/agents/qa-engineer.md`

**Skills**:
- `test-runner` - Intelligent test execution
- `backtest-validator` - Validate backtesting system
- `exchange-tester` - Exchange integration testing
- `performance-tester` - Performance and load testing
- `security-scanner` - Automated security testing
- `coverage-analyzer` - Test coverage analysis
- `test-generator` - Automated test case generation

**Best For**:
- Running test suites
- Backtesting validation
- Exchange testing
- Performance testing
- Security testing

**Team**: QA Team, Development Team

---

### 5. Project Manager Agent
**Location**: `.claude/agents/project-manager.md`

**Skills**:
- `jira-sync` - JIRA-GitHub synchronization
- `sprint-planner` - Sprint planning and management
- `backlog-manager` - Product backlog management
- `todo-analyzer` - Extract TODOs from code
- `status-reporter` - Automated status reports
- `risk-tracker` - Risk identification and management
- `release-coordinator` - Release planning

**Best For**:
- Sprint planning
- JIRA management
- Backlog prioritization
- Status reporting
- Release coordination

**Team**: Project Managers, Scrum Masters, All Teams

---

### 6. Security & Compliance Agent
**Location**: `.claude/agents/security-compliance.md`

**Skills**:
- `security-scanner` - Comprehensive security scanning
- `compliance-checker` - Regulatory compliance validation
- `credential-rotator` - Secure credential management
- `audit-logger` - Audit trail management
- `vulnerability-manager` - Vulnerability assessment
- `access-monitor` - Access control monitoring
- `incident-responder` - Security incident response

**Best For**:
- Security audits
- Compliance reporting
- Credential rotation
- Vulnerability management
- Incident response

**Team**: Security Team, Compliance Team, DevOps Team

## How to Use Agents

### Method 1: Direct Reference
In Claude Code, reference an agent by name:

```
@dlt-developer

I need to create an ERC-20 token for representing BTC holdings on Polygon.
Include minting/burning capabilities and make it gas-optimized.
```

### Method 2: Contextual Prompt
Include agent context in your prompt:

```
Using the Trading Operations Agent, help me:
1. Create a momentum strategy for BTC/USD
2. Backtest it on 2023 data
3. Optimize parameters for best Sharpe ratio
```

### Method 3: Skill Invocation
Directly invoke a skill (when implemented):

```
/skill backtest-manager

Create and run a backtest for the momentum strategy with these parameters:
- Asset: BTC/USD
- Period: 2023-01-01 to 2023-12-31
- Strategy: momentum-ma-crossover
- Parameters: {fastMA: 50, slowMA: 200}
```

## Team Workflows

### Development Team Workflow
1. Use **DLT Developer Agent** for blockchain features
2. Use **Trading Operations Agent** for trading features
3. Use **QA Engineer Agent** for testing
4. Use **DevOps Engineer Agent** for deployment
5. Use **Project Manager Agent** for JIRA updates

### DevOps Team Workflow
1. Use **DevOps Engineer Agent** for all deployments
2. Use **Security & Compliance Agent** for security checks
3. Use **QA Engineer Agent** for pre-deployment testing
4. Use **Project Manager Agent** for release coordination

### QA Team Workflow
1. Use **QA Engineer Agent** for all testing activities
2. Use **Security & Compliance Agent** for security testing
3. Use **Trading Operations Agent** for backtest validation
4. Use **Project Manager Agent** for test reporting

### Management Workflow
1. Use **Project Manager Agent** for sprint planning
2. Use **Project Manager Agent** for status reports
3. Use **Security & Compliance Agent** for compliance reports
4. Use **DevOps Engineer Agent** for infrastructure status

## Sharing Across Teams

### Repository Structure
```
Hermes/
├── .claude/
│   ├── agents/
│   │   ├── dlt-developer.md
│   │   ├── trading-operations.md
│   │   ├── devops-engineer.md
│   │   ├── qa-engineer.md
│   │   ├── project-manager.md
│   │   └── security-compliance.md
│   └── skills/
│       └── (skills will be implemented here)
└── AGENT_SHARING_GUIDE.md (this file)
```

### Version Control
- Agents are version controlled in Git
- All team members have access via repository
- Updates to agents are tracked in commits
- Use pull requests to propose agent improvements

### Collaboration
1. **Agent Updates**: Submit PRs to improve agents
2. **New Skills**: Propose new skills for agents
3. **Feedback**: Share agent effectiveness in retrospectives
4. **Documentation**: Keep agent docs up to date

## Best Practices

### When to Use Which Agent

| Task | Primary Agent | Supporting Agents |
|------|---------------|-------------------|
| Smart contract development | DLT Developer | Security & Compliance |
| Trading strategy | Trading Operations | QA Engineer |
| Deployment | DevOps Engineer | Security & Compliance |
| Testing | QA Engineer | - |
| Sprint planning | Project Manager | - |
| Security audit | Security & Compliance | QA Engineer |
| Backtest creation | Trading Operations | QA Engineer |
| JIRA sync | Project Manager | - |
| Performance issue | DevOps Engineer | Trading Operations |
| Compliance report | Security & Compliance | Project Manager |

### Agent Collaboration
Agents can work together on complex tasks:

**Example: Deploy New Trading Feature**
1. **Trading Operations Agent** - Develops strategy
2. **QA Engineer Agent** - Tests strategy
3. **Security & Compliance Agent** - Security review
4. **DevOps Engineer Agent** - Deploys to production
5. **Project Manager Agent** - Updates JIRA tickets

### Tips for Effective Use
1. **Be Specific**: Clearly describe what you need
2. **Reference Skills**: Use skill names when applicable
3. **Provide Context**: Include relevant file paths and requirements
4. **Sequential Tasks**: Break complex tasks into steps
5. **Team Coordination**: Share agent outputs with team members

## Implementing Skills

Skills referenced in agents are documented but need implementation. To implement:

1. Create skill in `.claude/skills/` directory
2. Follow Claude Code skill format
3. Reference from agent documentation
4. Test skill functionality
5. Update agent documentation with usage examples

**Priority Skills to Implement First**:
1. `deploy-wizard` - Most scripts already exist, consolidate
2. `jira-sync` - Scripts exist, needs wrapper
3. `test-runner` - Built on existing npm scripts
4. `backtest-manager` - Use backtesting API
5. `security-scanner` - Use existing security tests

## Support and Questions

### Documentation
- Agent files: `.claude/agents/`
- Skills (when implemented): `.claude/skills/`
- This guide: `AGENT_SHARING_GUIDE.md`
- Platform docs: `CLAUDE.md`

### Communication
- **Slack**:
  - #claude-agents - Agent usage and questions
  - #automation - Skill development
  - Team-specific channels for agent feedback

- **JIRA**:
  - Project: AGENT-*
  - Label: claude-agent

### Getting Help
1. Read the specific agent documentation
2. Check this sharing guide
3. Ask in #claude-agents Slack channel
4. Create JIRA ticket for feature requests
5. Submit GitHub issue for bugs

## Maintenance

### Keeping Agents Updated
- Agents evolve as platform changes
- Submit PRs to update agent capabilities
- Document new workflows and best practices
- Review agent effectiveness quarterly

### Metrics
Track agent usage and effectiveness:
- Tasks completed successfully
- Time saved vs manual approach
- User satisfaction
- Areas for improvement

---

**Version**: 1.0.0
**Last Updated**: October 20, 2025
**Maintained By**: Aurigraph Development Team
**Questions**: #claude-agents on Slack

## Next Steps

1. ✅ Review agent documentation for your role
2. ✅ Try using an agent for a simple task
3. ✅ Share feedback with your team
4. ✅ Propose new skills or improvements
5. ✅ Help implement priority skills

**Start using agents today to boost productivity!**
