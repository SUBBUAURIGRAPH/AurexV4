# Aurigraph Agents - Team Onboarding Guide

**Welcome!** This guide will get you productive with Aurigraph agents in 30 minutes.

## 🎯 What You'll Learn

1. What agents are and how they help
2. Which agent is right for your role
3. How to use agents effectively
4. Where to get help
5. How to provide feedback

**Time Required**: 30 minutes
**Prerequisites**: Access to HMS repository

---

## Part 1: Introduction (5 minutes)

### What Are Aurigraph Agents?

Specialized AI assistants with 30+ integrated skills that help you:
- **Deploy faster** - Automated deployments with validation
- **Test better** - Comprehensive test execution and reporting
- **Code smarter** - Smart contracts, trading strategies, security scans
- **Manage easier** - JIRA sync, sprint planning, reporting
- **Stay secure** - Automated security scanning and compliance

### The 9 Agents

| Agent | Best For | Key Skills |
|-------|----------|------------|
| 🔗 DLT Developer | Smart contracts, tokenization | 5 blockchain skills |
| 📈 Trading Operations | Trading strategies, exchanges | 7 trading skills |
| 🚀 DevOps Engineer | Deployments, infrastructure | 8 DevOps skills |
| ✅ QA Engineer | Testing, quality assurance | 7 testing skills |
| 📊 Project Manager | JIRA, sprint planning | 7 PM skills |
| 🔒 Security & Compliance | Security, regulations | 7 security skills |
| 💾 Data Engineer | Data pipelines, analytics | 4 data skills |
| 🎨 Frontend Developer | UI/UX, React components | 4 frontend skills |
| ⚙️ SRE/Reliability | Incidents, monitoring | 4 SRE skills |

**Total**: 50+ skills across 9 specialized agents

---

## Part 2: Find Your Agent (5 minutes)

### By Role

**Backend Developer** → DLT Developer + Trading Operations
**Frontend Developer** → Frontend Developer + QA Engineer
**DevOps Engineer** → DevOps Engineer + SRE/Reliability
**QA/Test Engineer** → QA Engineer + Security & Compliance
**Project Manager** → Project Manager + DevOps Engineer
**Data Analyst** → Data Engineer + Trading Operations
**Security Engineer** → Security & Compliance + SRE/Reliability

### By Task

**Deploying** → DevOps Engineer
**Testing** → QA Engineer
**Smart Contract** → DLT Developer
**Trading Strategy** → Trading Operations
**JIRA Update** → Project Manager
**Security Scan** → Security & Compliance
**Data Pipeline** → Data Engineer
**UI Component** → Frontend Developer
**Incident Response** → SRE/Reliability

---

## Part 3: Your First Agent (10 minutes)

### Step 1: Choose a Simple Task
Pick something you do regularly that takes 15-30 minutes.

**Examples**:
- Deploy to staging
- Run test suite
- Update JIRA tickets
- Create smart contract
- Build trading backtest

### Step 2: Find the Agent
Check the table above or `.claude/QUICK_START.md`

### Step 3: Use the Agent

**Method 1: Natural Language** (Easiest)
```
@agent-name "describe what you want to do"

Example:
@devops-engineer "Deploy Hermes 2.0.1 to dev4 staging environment"
```

**Method 2: With Skill Reference**
```
@agent-name skill-name "parameters"

Example:
@qa-engineer test-runner "Run full test suite with coverage report"
```

### Step 4: Review Results
- Did it work as expected?
- How much time did you save?
- What could be better?

### Step 5: Share Feedback
Post in #claude-agents:
```
Used @agent-name for [task]
Result: Success! Saved 20 minutes.
Would use again: Yes
```

---

## Part 4: Real Examples (5 minutes)

### Example 1: Deploy to Staging

**Before** (Manual - 30 minutes):
1. Run tests locally (10 min)
2. SSH into server (2 min)
3. Pull latest code (2 min)
4. Run deployment script (5 min)
5. Check logs for errors (5 min)
6. Verify services healthy (5 min)
7. Notify team (1 min)

**With Agent** (5 minutes):
```
@devops-engineer deploy-wizard

Deploy to dev4:
- Run pre-deployment checklist
- Deploy with health checks
- Send Slack notification
```

**Time Saved**: 25 minutes (83%)

---

### Example 2: Create JIRA Tickets from TODOs

**Before** (Manual - 45 minutes):
1. Search codebase for TODOs (10 min)
2. Read each TODO context (15 min)
3. Create JIRA ticket for each (15 min)
4. Link to code location (5 min)

**With Agent** (5 minutes):
```
@project-manager jira-sync

Scan src/ directory for TODOs and create JIRA tickets:
- Categorize by priority
- Link to code locations
- Assign to appropriate team members
```

**Time Saved**: 40 minutes (89%)

---

### Example 3: Run Full Test Suite

**Before** (Manual - 20 minutes):
1. Run unit tests (5 min)
2. Run integration tests (7 min)
3. Run security tests (5 min)
4. Check coverage reports (3 min)

**With Agent** (5 minutes):
```
@qa-engineer test-runner

Run full test suite:
- All test types (unit, integration, security)
- Generate coverage report
- Retry flaky tests
- Alert if coverage <80%
```

**Time Saved**: 15 minutes (75%)

---

## Part 5: Resources & Support (5 minutes)

### Documentation

| Resource | Location | Purpose |
|----------|----------|---------|
| Quick Start | `.claude/QUICK_START.md` | 5-minute overview |
| Agent Docs | `.claude/agents/*.md` | Detailed agent capabilities |
| Usage Examples | `.claude/AGENT_USAGE_EXAMPLES.md` | 21 real-world examples |
| Skill Reference | `.claude/skills/README.md` | All 50+ skills |
| Sharing Guide | `.claude/AGENT_SHARING_GUIDE.md` | Team collaboration |
| This Guide | `.claude/ONBOARDING_GUIDE.md` | You are here! |

### Getting Help

**Level 1: Self-Service** (Fastest)
1. Check `.claude/QUICK_START.md`
2. Look for similar examples in `AGENT_USAGE_EXAMPLES.md`
3. Read agent documentation

**Level 2: Community** (Same Day)
1. Post in #claude-agents Slack
2. Ask your team's agent champion
3. Attend office hours (Mon/Wed 10-12, Tue/Thu 2-4)

**Level 3: Support Team** (1-2 days)
1. Create JIRA ticket (Project: AGENT-*)
2. Email agents@aurigraph.io
3. Schedule 1-on-1 with agent team

### Office Hours
- **When**: Mon/Wed 10 AM-12 PM, Tue/Thu 2-4 PM
- **Where**: Zoom link in calendar + #claude-agents
- **What**: Demos, troubleshooting, Q&A, training

### Feedback
Share your experience:
- ✅ Quick: Post in #claude-agents
- ✅ Structured: Create JIRA ticket
- ✅ Comprehensive: Monthly survey
- ✅ Interactive: Office hours

---

## Next Steps

### ✅ Today (30 minutes)
1. ✅ Read this onboarding guide
2. ✅ Join #claude-agents on Slack
3. ✅ Pick one agent for your role
4. ✅ Try it on a simple task
5. ✅ Share your experience

### ✅ This Week
1. Use agent for 2-3 daily tasks
2. Read your agent's full documentation
3. Try different skills
4. Share 1 success story
5. Attend an office hours session

### ✅ This Month
1. Become proficient with your primary agent
2. Try 1-2 additional agents
3. Help a colleague get started
4. Submit improvement suggestions
5. Complete monthly feedback survey

---

## Quick Reference Card

### How to Use Agents

```
@agent-name "describe task"
```

### Available Agents

```
@dlt-developer          - Smart contracts & blockchain
@trading-operations     - Trading strategies & exchanges
@devops-engineer        - Deployments & infrastructure
@qa-engineer            - Testing & quality
@project-manager        - JIRA & sprint planning
@security-compliance    - Security & regulations
@data-engineer          - Data pipelines & analytics
@frontend-developer     - UI/UX & React
@sre-reliability        - Incidents & monitoring
```

### Getting Help

```
#claude-agents          - Slack channel
agents@aurigraph.io     - Email support
Project: AGENT-*        - JIRA tickets
Office Hours            - Mon/Wed/Tue/Thu
```

### Documentation

```
.claude/QUICK_START.md           - Start here!
.claude/agents/                  - Agent details
.claude/AGENT_USAGE_EXAMPLES.md  - Real examples
.claude/skills/README.md         - All skills
```

---

## Frequently Asked Questions

### Q: Do agents replace my work?
**A**: No! Agents augment your capabilities. They handle repetitive tasks so you can focus on creative problem-solving.

### Q: Are agents always right?
**A**: No. Always review agent outputs, especially for critical operations. Agents are tools, not replacements for human judgment.

### Q: Can I trust agent recommendations?
**A**: Agents follow best practices and existing procedures. For critical decisions, use agents as advisors and verify outputs.

### Q: What if an agent makes a mistake?
**A**: Report it immediately in #claude-agents. We track all issues and iterate quickly. No blame - just learning!

### Q: How much time will I save?
**A**: Varies by task. Users report 30-80% time savings on routine tasks. Try it and track your time!

### Q: Can I suggest new agents or skills?
**A**: Absolutely! Post in #claude-agents or create a JIRA ticket. We prioritize based on team needs.

### Q: Are agents secure?
**A**: Yes. Agents follow the same security protocols as our codebase. No credentials are stored insecurely.

### Q: Do I need special permissions?
**A**: No. If you have access to HMS repository, you can use agents.

---

## Success Checklist

After this onboarding, you should be able to:

- [ ] Explain what Aurigraph agents are
- [ ] Identify which agent helps with your role
- [ ] Use an agent for a simple task
- [ ] Find documentation when needed
- [ ] Know where to get help
- [ ] Provide feedback on your experience

**All checked?** Congratulations! You're ready to boost your productivity with agents! 🚀

---

## Onboarding Complete!

**What's Next?**
1. Start using agents in your daily work
2. Join #claude-agents to learn from others
3. Attend an office hours session
4. Share your first success story
5. Help a colleague get started

**Need Help?**
- Slack: #claude-agents
- Email: agents@aurigraph.io
- Office Hours: See schedule above
- Documentation: `.claude/` directory

**Welcome to the future of productivity!** 🎉

---

**Version**: 1.0.0
**Last Updated**: October 20, 2025
**Maintained By**: Agent Development Team
**Questions**: #claude-agents on Slack
