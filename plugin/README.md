# Aurigraph Agents - Claude Code Plugin

**Version**: 1.0.0
**Compatible with**: Claude Code CLI
**Maintained by**: Aurigraph Development Team

## Overview

This plugin provides direct access to all 9 Aurigraph specialized agents with 50+ skills through Claude Code. Team members can invoke agents for automated tasks, getting instant productivity boosts.

## Features

- ✅ 9 specialized agents with role-specific capabilities
- ✅ 50+ integrated skills
- ✅ Natural language interface
- ✅ Integration with existing Hermes infrastructure
- ✅ Real-time execution and feedback
- ✅ Success tracking and metrics

## Installation

### Method 1: Via NPM (Recommended)

```bash
npm install -g @aurigraph/claude-agents-plugin
```

### Method 2: Local Installation

```bash
# Clone HMS repository if you haven't
git clone https://github.com/Aurigraph-DLT-Corp/HMS.git
cd HMS

# Link plugin to Claude Code
claude plugins add .claude/plugin

# Verify installation
claude plugins list | grep aurigraph
```

### Method 3: Direct Copy

```bash
# Copy plugin files to Claude Code plugins directory
cp -r .claude/plugin ~/.claude/plugins/aurigraph-agents

# Reload Claude Code
claude plugins reload
```

## Quick Start

### 1. Verify Installation

```bash
claude agents list
```

Expected output:
```
Aurigraph Agents (v1.0.0)
=========================
✓ dlt-developer (5 skills)
✓ trading-operations (7 skills)
✓ devops-engineer (8 skills)
✓ qa-engineer (7 skills)
✓ project-manager (7 skills)
✓ security-compliance (7 skills)
✓ data-engineer (4 skills)
✓ frontend-developer (4 skills)
✓ sre-reliability (4 skills)
```

### 2. Use an Agent

```bash
# Method 1: Direct command
claude agent devops deploy-wizard "Deploy to dev4"

# Method 2: Interactive
claude agent
> Select agent: devops-engineer
> Select skill: deploy-wizard
> Parameters: Deploy to dev4 with health checks
```

### 3. Check Agent Help

```bash
# Get agent information
claude agent devops-engineer --help

# Get skill information
claude agent devops-engineer deploy-wizard --help

# List all skills
claude agent devops-engineer --list-skills
```

## Usage Examples

### DevOps Tasks

```bash
# Deploy to environment
claude agent devops deploy-wizard "Deploy Hermes 2.0.1 to dev4"

# Manage Docker containers
claude agent devops docker-manager "Restart trading services"

# Check system health
claude agent devops health-monitor "Check all services"
```

### Testing Tasks

```bash
# Run test suite
claude agent qa test-runner "Run full test suite with coverage"

# Security scan
claude agent security security-scanner "Run OWASP Top 10 tests"

# Performance test
claude agent qa performance-tester "Load test API endpoints"
```

### Project Management Tasks

```bash
# Sync JIRA
claude agent pm jira-sync "Sync last week's commits to JIRA"

# Create tickets from TODOs
claude agent pm todo-analyzer "Scan src/ and create JIRA tickets"

# Generate report
claude agent pm status-reporter "Generate weekly status report"
```

### DLT Development Tasks

```bash
# Create token
claude agent dlt token-creator "Create ERC-20 token for BTC on Polygon"

# Deploy contract
claude agent dlt blockchain-deploy "Deploy token to mainnet"

# Audit contract
claude agent dlt dlt-auditor "Audit smart contract for vulnerabilities"
```

### Trading Tasks

```bash
# Create strategy
claude agent trading strategy-builder "Create momentum strategy for BTC/USD"

# Backtest
claude agent trading backtest-manager "Backtest strategy on 2023 data"

# Test exchange
claude agent trading exchange-connector "Test Binance connection"
```

## Configuration

### Plugin Configuration File

Location: `~/.claude/config/aurigraph-agents.json`

```json
{
  "version": "1.0.0",
  "agents": {
    "enabled": ["all"],
    "disabled": []
  },
  "defaults": {
    "timeout": 300,
    "retries": 3,
    "verbose": false
  },
  "integrations": {
    "hermes": {
      "api": "http://localhost:8005",
      "auth": "env:HERMES_API_KEY"
    },
    "jira": {
      "url": "https://aurigraphdlt.atlassian.net",
      "auth": "env:JIRA_API_KEY"
    }
  },
  "metrics": {
    "enabled": true,
    "endpoint": "https://metrics.aurigraph.io"
  }
}
```

### Environment Variables

```bash
# Add to ~/.bashrc or ~/.zshrc

# Hermes API
export HERMES_API_KEY="your-api-key"
export HERMES_API_URL="http://localhost:8005"

# JIRA
export JIRA_API_KEY="your-jira-api-key"
export JIRA_URL="https://aurigraphdlt.atlassian.net"

# Plugin settings
export CLAUDE_AGENTS_VERBOSE=false
export CLAUDE_AGENTS_TIMEOUT=300
```

## Advanced Usage

### Chaining Skills

```bash
# Deploy and test
claude agent devops deploy-wizard "Deploy to dev4" && \
claude agent qa test-runner "Run smoke tests"

# Create and backtest strategy
claude agent trading strategy-builder "Create momentum strategy" && \
claude agent trading backtest-manager "Backtest on 2023 data"
```

### Batch Operations

```bash
# Run multiple agents in sequence
claude agents batch <<EOF
devops deploy-wizard "Deploy to dev4"
qa test-runner "Run integration tests"
security security-scanner "Run security scan"
pm jira-sync "Update JIRA tickets"
EOF
```

### Scripting

```bash
#!/bin/bash
# deploy-and-validate.sh

echo "Starting deployment..."
claude agent devops deploy-wizard "Deploy Hermes 2.0.1 to production"

if [ $? -eq 0 ]; then
  echo "Deployment successful, running validation..."
  claude agent qa test-runner "Run smoke tests"
  claude agent security security-scanner "Quick security scan"
  echo "Deployment complete!"
else
  echo "Deployment failed, check logs"
  exit 1
fi
```

## Plugin API

### For Developers

Create custom integrations with the plugin:

```javascript
const AurigraphAgents = require('@aurigraph/claude-agents-plugin');

// Initialize
const agents = new AurigraphAgents({
  config: '~/.claude/config/aurigraph-agents.json'
});

// Use an agent
const result = await agents.invoke('devops-engineer', 'deploy-wizard', {
  environment: 'dev4',
  version: '2.0.1',
  strategy: 'blue-green'
});

console.log(result.success); // true/false
console.log(result.output); // Execution output
console.log(result.metrics); // Performance metrics
```

## Troubleshooting

### Plugin Not Found

```bash
# Verify installation
claude plugins list

# Reinstall
claude plugins remove aurigraph-agents
claude plugins add .claude/plugin
```

### Agent Fails to Execute

```bash
# Enable verbose mode
export CLAUDE_AGENTS_VERBOSE=true

# Check logs
claude agents logs --tail 50

# Test connection
claude agent test-connection
```

### Permission Errors

```bash
# Fix permissions
chmod +x ~/.claude/plugins/aurigraph-agents/bin/*

# Verify
ls -la ~/.claude/plugins/aurigraph-agents/bin/
```

### Configuration Issues

```bash
# Validate config
claude agents config validate

# Reset to defaults
claude agents config reset

# Show current config
claude agents config show
```

## Metrics & Analytics

### View Usage Statistics

```bash
# Your usage
claude agents stats

# Team usage (if enabled)
claude agents stats --team

# Specific agent
claude agents stats devops-engineer
```

### Export Metrics

```bash
# Export to CSV
claude agents stats --export csv > agent-usage.csv

# Export to JSON
claude agents stats --export json > agent-usage.json
```

## Updates

### Check for Updates

```bash
claude agents update check
```

### Install Updates

```bash
# Update plugin
claude agents update install

# Update specific agent
claude agents update agent devops-engineer
```

### Version History

```bash
# Show changelog
claude agents changelog

# Show specific version
claude agents changelog 1.0.0
```

## Uninstallation

### Remove Plugin

```bash
# Via Claude Code
claude plugins remove aurigraph-agents

# Manual removal
rm -rf ~/.claude/plugins/aurigraph-agents

# Clean config
rm ~/.claude/config/aurigraph-agents.json
```

## Support

### Getting Help

```bash
# General help
claude agents --help

# Agent-specific help
claude agent devops-engineer --help

# Skill-specific help
claude agent devops-engineer deploy-wizard --help
```

### Contact

- **Slack**: #claude-agents
- **Email**: agents@aurigraph.io
- **JIRA**: Project AGENT-*
- **GitHub**: https://github.com/Aurigraph-DLT-Corp/HMS/issues

### Office Hours

- Monday & Wednesday: 10 AM - 12 PM
- Tuesday & Thursday: 2 PM - 4 PM

## Contributing

### Report Issues

```bash
# Via CLI
claude agents report-issue

# Or create JIRA ticket
# Project: AGENT-*
# Type: Bug / Feature / Improvement
```

### Suggest Improvements

Share feedback in #claude-agents or create JIRA ticket with:
- Use case description
- Expected behavior
- Suggested solution

## License

MIT License - See HMS/LICENSE

---

## Quick Reference

### Common Commands

```bash
# List agents
claude agents list

# Use agent
claude agent <agent-name> <skill-name> "task description"

# Get help
claude agent <agent-name> --help

# View stats
claude agents stats

# Update plugin
claude agents update

# Check status
claude agents status
```

### Agent Short Names

```bash
dlt          → dlt-developer
trading      → trading-operations
devops       → devops-engineer
qa           → qa-engineer
pm           → project-manager
security     → security-compliance
data         → data-engineer
frontend     → frontend-developer
sre          → sre-reliability
```

### Example Session

```bash
$ claude agents list
Aurigraph Agents (v1.0.0) - 9 agents, 50+ skills

$ claude agent devops deploy-wizard "Deploy to dev4"
✓ Pre-deployment checks passed
✓ Creating backup...
✓ Deploying to dev4...
✓ Running health checks...
✓ Deployment successful!

Time saved: 25 minutes
Next: Monitor logs for 15 minutes

$ claude agents stats
Today: 3 invocations, 1.2 hours saved
This week: 15 invocations, 6.5 hours saved
```

---

**Plugin Version**: 1.0.0
**Last Updated**: October 20, 2025
**Status**: Production Ready ✅

**Get Started**: `claude plugins add .claude/plugin`
