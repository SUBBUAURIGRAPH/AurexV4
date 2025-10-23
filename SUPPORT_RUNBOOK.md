# SUPPORT RUNBOOK
## Aurigraph Agent Architecture v2.0.0

**Runbook Owner**: Support Team + DevOps Engineer
**Version**: 1.0
**Last Updated**: October 23, 2025
**Status**: Ready for Deployment

---

## EXECUTIVE SUMMARY

This support runbook provides comprehensive troubleshooting guidance, escalation procedures, and solutions for the top 20+ support scenarios encountered during the Aurigraph Agent Architecture deployment.

**Support Goals**:
- <1 hour response time for Slack questions
- <24 hour response time for email
- <24 hour issue resolution time
- 95%+ resolution rate
- Zero critical issues unresolved

**Support Channels**:
1. Slack #claude-agents (fastest, <1 hour)
2. Email agents@aurigraph.io (<24 hours)
3. Office Hours (Mon/Wed 10-12, Tue/Thu 2-4 PM)
4. GitHub Issues (bug reports, 2-3 days)

---

## TABLE OF CONTENTS

1. [Support Channel Guide](#support-channel-guide)
2. [Top 20 Support Scenarios](#top-20-support-scenarios)
3. [Installation Issues](#installation-issues)
4. [Agent Execution Issues](#agent-execution-issues)
5. [Configuration Issues](#configuration-issues)
6. [Performance Issues](#performance-issues)
7. [Integration Issues](#integration-issues)
8. [Error Messages Reference](#error-messages-reference)
9. [Escalation Procedures](#escalation-procedures)
10. [FAQ Quick Answers](#faq-quick-answers)
11. [Contact Information](#contact-information)

---

## SUPPORT CHANNEL GUIDE

### Channel Selection Matrix

| Issue Type | Severity | Best Channel | Response Time | Best For |
|------------|----------|--------------|---------------|----------|
| Quick question | Low | Slack #claude-agents | <1 hour | Installation help, usage tips |
| Installation issue | Medium | Slack + email | <2 hours | Submodule errors, path issues |
| Agent not working | High | Slack + email | <4 hours | Execution errors, config issues |
| Critical bug | Critical | Slack @mention + email | <1 hour | Affects >10 users, security |
| Feature request | Low | GitHub Issues | 2-3 days | Enhancements, new features |
| Training question | Low | Office Hours | Immediate | In-depth learning, best practices |

### Slack #claude-agents Guidelines

**Best For**:
- Quick questions (<5 min to answer)
- Installation troubleshooting
- Usage examples
- Success story sharing
- General discussions

**Response SLA**: <1 hour (business hours)

**How to Ask for Help**:
```
Hi team! I'm having trouble with [specific issue].

What I'm trying to do: [goal]
What I tried: [steps taken]
What happened: [error or unexpected behavior]
Environment: [project name, OS, Claude Code version]

Error message (if any):
[paste error message]

Thanks!
```

**Support Team Actions**:
1. Acknowledge within 15 minutes
2. Ask clarifying questions if needed
3. Provide solution or escalate
4. Mark as resolved when confirmed
5. Document in FAQ if common issue

### Email agents@aurigraph.io Guidelines

**Best For**:
- Detailed technical issues
- Sensitive information (credentials, etc.)
- Issues requiring screenshots/logs
- Follow-up to Slack discussions

**Response SLA**: <24 hours

**Email Template**:
```
Subject: [Project] - [Brief Issue Description]

Environment:
- Project: [project name]
- OS: [Windows/Mac/Linux]
- Claude Code Version: [version]
- Agent: [agent name if applicable]

Issue Description:
[Detailed description]

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Expected Behavior:
[What should happen]

Actual Behavior:
[What actually happened]

Error Message:
[Paste error message or attach screenshot]

What I've Tried:
[Troubleshooting steps already attempted]

Thanks!
```

### Office Hours Guidelines

**Schedule**:
- Monday & Wednesday: 10:00 AM - 12:00 PM EST
- Tuesday & Thursday: 2:00 PM - 4:00 PM EST

**Best For**:
- In-depth troubleshooting
- Training and best practices
- Complex integration questions
- New feature demonstrations

**How to Join**:
- Zoom link pinned in #claude-agents
- No registration required (walk-ins welcome)
- Optional booking for dedicated time

### GitHub Issues Guidelines

**Best For**:
- Bug reports (reproducible issues)
- Feature requests
- Documentation improvements
- Long-term enhancement tracking

**Response SLA**: 2-3 days

**Issue Template**:
```markdown
## Issue Type
- [ ] Bug
- [ ] Feature Request
- [ ] Documentation
- [ ] Question

## Description
[Clear description of the issue or request]

## Steps to Reproduce (for bugs)
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happened]

## Environment
- OS: [Windows/Mac/Linux]
- Claude Code Version: [version]
- Agent Architecture Version: [version]
- Project: [project name]

## Additional Context
[Screenshots, logs, or other relevant information]
```

---

## TOP 20 SUPPORT SCENARIOS

### SCENARIO 1: Cannot Install Agents (Git Submodule)

**Issue**: User unable to add agents via git submodule
**Frequency**: High (Week 1)
**Severity**: Medium
**Avg Resolution Time**: 15 minutes

#### Common Causes
1. Git not installed or outdated
2. No SSH key configured for GitHub
3. No access to glowing-adventure repository
4. Wrong command syntax
5. Already exists in project

#### Troubleshooting Steps

**Step 1: Verify Git Installation**
```bash
git --version
# Should show git version 2.0+
```

**If git not found**:
- Windows: Download from https://git-scm.com/download/win
- Mac: `brew install git` or Xcode Command Line Tools
- Linux: `sudo apt-get install git` or `sudo yum install git`

**Step 2: Verify SSH Key**
```bash
ssh -T git@github.com
# Should show: "Hi username! You've successfully authenticated..."
```

**If SSH key not configured**:
```bash
# Generate SSH key
ssh-keygen -t rsa -b 4096 -C "your_email@aurigraph.io"

# Copy public key
cat ~/.ssh/id_rsa.pub

# Add to GitHub: Settings -> SSH and GPG keys -> New SSH key
```

**Step 3: Verify Repository Access**
```bash
# Try cloning the repository directly
git clone git@github.com:Aurigraph-DLT-Corp/glowing-adventure.git test-clone

# If successful, remove test clone
rm -rf test-clone
```

**If access denied**:
- Request access from DevOps team
- Verify SSH key added to GitHub
- Check organization membership

**Step 4: Add Submodule (Correct Syntax)**
```bash
# Navigate to project root
cd /path/to/your/project

# Add submodule
git submodule add git@github.com:Aurigraph-DLT-Corp/glowing-adventure.git .claude

# Initialize and update
git submodule update --init --recursive
```

**If "already exists" error**:
```bash
# Check if .claude directory exists
ls -la .claude

# If it exists but not as submodule, remove and re-add
rm -rf .claude
git submodule add git@github.com:Aurigraph-DLT-Corp/glowing-adventure.git .claude
```

#### Resolution Checklist
- [ ] Git installed and working
- [ ] SSH key configured and added to GitHub
- [ ] Repository access granted
- [ ] Submodule added successfully
- [ ] .claude directory visible with agents/ subdirectory
- [ ] User can proceed to next step

#### Prevention
- Include SSH setup in pre-deployment checklist
- Create automated setup script
- Add to onboarding documentation

---

### SCENARIO 2: Agent Not Showing Up in Claude Code

**Issue**: User installed agents but cannot see/use them in Claude Code
**Frequency**: High (Week 1)
**Severity**: Medium
**Avg Resolution Time**: 10 minutes

#### Common Causes
1. Claude Code not reloaded after installation
2. .claude directory in wrong location
3. Agent file syntax errors
4. Claude Code not recognizing agents directory

#### Troubleshooting Steps

**Step 1: Verify Installation Location**
```bash
# Check if .claude is in project root
ls -la | grep .claude

# Should show: drwxr-xr-x  .claude

# Verify agents directory exists
ls .claude/agents/

# Should show: 13+ .md files
```

**If .claude not in root**:
- Move .claude to project root
- Or reinstall using git submodule in correct location

**Step 2: Reload Claude Code**
- Close Claude Code completely
- Reopen Claude Code
- Navigate to project directory
- Try using agent: `@devops-engineer "help"`

**Step 3: Verify Agent File Syntax**
```bash
# Check if agent files are valid Markdown
head .claude/agents/devops-engineer.md

# Should show valid YAML frontmatter
```

**Step 4: Check Claude Code Settings**
- Open Claude Code settings
- Verify agents are enabled
- Check agents directory path (should auto-detect)

#### Resolution Checklist
- [ ] .claude directory in project root
- [ ] agents/ subdirectory contains .md files
- [ ] Claude Code reloaded
- [ ] Can invoke agent with @agent-name
- [ ] Agent responds to commands

---

### SCENARIO 3: "Permission Denied" Error

**Issue**: User gets permission denied when trying to install or use agents
**Frequency**: Medium
**Severity**: Medium
**Avg Resolution Time**: 20 minutes

#### Common Causes
1. No write access to project directory
2. File ownership issues
3. Git configuration issues
4. SSH key permissions

#### Troubleshooting Steps

**Step 1: Check Directory Permissions**
```bash
# Check project directory permissions
ls -ld /path/to/project

# Check if you own the directory
ls -l /path/to/project | grep $(whoami)
```

**If permission denied**:
```bash
# Option 1: Request permission from project owner
# Option 2: Clone project to your own directory

# Fix ownership (if you should have access)
sudo chown -R $(whoami):$(whoami) /path/to/project
```

**Step 2: Check SSH Key Permissions**
```bash
# SSH keys should have restrictive permissions
ls -l ~/.ssh/

# Fix permissions if needed
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
```

**Step 3: Check Git Configuration**
```bash
# Verify git user configuration
git config user.name
git config user.email

# Set if missing
git config user.name "Your Name"
git config user.email "your.email@aurigraph.io"
```

#### Resolution Checklist
- [ ] User has write access to project directory
- [ ] SSH key permissions correct
- [ ] Git configuration valid
- [ ] Can add/commit files to project
- [ ] Submodule installation successful

---

### SCENARIO 4: Agent Responds with Error

**Issue**: Agent executes but returns error message
**Frequency**: Medium
**Severity**: Medium-High
**Avg Resolution Time**: 30 minutes

#### Common Causes
1. Missing dependencies
2. Invalid command syntax
3. Environment variables not set
4. Skill not implemented yet
5. Integration endpoint not accessible

#### Troubleshooting Steps

**Step 1: Check Error Message**
- Read error message carefully
- Identify if it's a skill-level error or agent-level error
- Copy full error message for troubleshooting

**Step 2: Verify Skill Implementation**
```bash
# Check if skill is implemented
ls .claude/skills/ | grep <skill-name>

# Read skill documentation
cat .claude/skills/<skill-name>.md
```

**If skill not implemented**:
- Use alternative skill or agent
- Report as feature request
- Check roadmap for implementation timeline

**Step 3: Check Dependencies**
- Verify required tools installed (Docker, Node.js, etc.)
- Check environment variables set
- Verify API endpoints accessible

**Step 4: Simplify Command**
- Try basic command first: `@agent-name "help"`
- Gradually add complexity
- Isolate issue to specific parameter

#### Resolution Checklist
- [ ] Error message understood
- [ ] Root cause identified
- [ ] Dependencies installed
- [ ] Command syntax corrected
- [ ] Agent responds successfully

---

### SCENARIO 5: Slow Agent Response

**Issue**: Agent takes too long to respond (>30 seconds)
**Frequency**: Low-Medium
**Severity**: Low-Medium
**Avg Resolution Time**: 20 minutes

#### Common Causes
1. Network latency
2. Large codebase analysis
3. Claude Code performance issues
4. Skill complexity

#### Troubleshooting Steps

**Step 1: Check Network**
```bash
# Test network speed
ping google.com

# Check Claude API access
curl -I https://api.anthropic.com
```

**Step 2: Simplify Request**
- Reduce scope of analysis
- Break into smaller tasks
- Use more specific commands

**Step 3: Check Claude Code Performance**
- Close other applications
- Restart Claude Code
- Check system resources (CPU, memory)

**Step 4: Report Performance Issue**
- Document slow scenario
- Measure actual response time
- Submit to support for optimization

#### Resolution Checklist
- [ ] Network connectivity verified
- [ ] Request simplified if needed
- [ ] Response time acceptable (<30 seconds)
- [ ] Performance issue documented if persistent

---

### SCENARIO 6: Deploy-Wizard Fails

**Issue**: deploy-wizard skill fails during deployment
**Frequency**: Medium
**Severity**: High
**Avg Resolution Time**: 45 minutes

#### Common Causes
1. Docker not running
2. Environment not accessible
3. Missing credentials
4. Build failures
5. Health check failures

#### Troubleshooting Steps

**Step 1: Verify Docker**
```bash
# Check Docker status
docker ps

# If error, start Docker
# Windows/Mac: Start Docker Desktop
# Linux: sudo systemctl start docker
```

**Step 2: Verify Environment Access**
```bash
# Check environment is accessible
ping <environment-hostname>

# Check VPN connection if needed
```

**Step 3: Verify Credentials**
```bash
# Check if credentials file exists
ls .claude/credentials.md

# Verify credentials are correct
# Do NOT share credentials in support channels
```

**Step 4: Check Build Logs**
```bash
# Review build logs
docker logs <container-id>

# Check for build failures
```

**Step 5: Manual Deployment Test**
```bash
# Try manual deployment to isolate issue
docker build -t test .
docker run -p 8080:8080 test

# If manual works, issue is with deploy-wizard
# If manual fails, issue is with Docker setup
```

#### Resolution Checklist
- [ ] Docker running
- [ ] Environment accessible
- [ ] Credentials valid
- [ ] Build successful
- [ ] Health checks passing
- [ ] Deployment successful

---

### SCENARIO 7: JIRA-Sync Not Working

**Issue**: jira-sync skill not syncing commits to JIRA
**Frequency**: Medium
**Severity**: Medium
**Avg Resolution Time**: 30 minutes

#### Common Causes
1. JIRA credentials not configured
2. Commit message format incorrect
3. JIRA ticket doesn't exist
4. JIRA API not accessible
5. JIRA permissions insufficient

#### Troubleshooting Steps

**Step 1: Verify JIRA Credentials**
```bash
# Check credentials file
cat .claude/credentials.md | grep JIRA

# Should show JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN
```

**If credentials missing**:
- Generate JIRA API token: JIRA Settings -> Security -> API Tokens
- Add to credentials.md

**Step 2: Verify Commit Message Format**
```bash
# Correct format: PROJ-123: Commit message
# Examples:
# "HMS-456: Add new trading feature"
# "DLT-789: Fix smart contract bug"

# Check recent commits
git log --oneline -5
```

**Step 3: Verify JIRA Ticket**
- Check ticket exists in JIRA
- Verify ticket is not in Done/Closed state
- Check ticket permissions

**Step 4: Test JIRA API**
```bash
# Test JIRA API access
curl -u email@aurigraph.io:api_token https://aurigraph.atlassian.net/rest/api/3/myself
```

#### Resolution Checklist
- [ ] JIRA credentials configured
- [ ] Commit message format correct
- [ ] JIRA ticket exists and accessible
- [ ] JIRA API accessible
- [ ] Sync working

---

### SCENARIO 8: Test-Runner No Tests Found

**Issue**: test-runner skill reports no tests found
**Frequency**: Medium
**Severity**: Low-Medium
**Avg Resolution Time**: 20 minutes

#### Common Causes
1. Tests in non-standard location
2. Test framework not configured
3. Test files not matching pattern
4. Dependencies not installed

#### Troubleshooting Steps

**Step 1: Verify Test Location**
```bash
# Check standard locations
ls tests/
ls test/
ls __tests__/
ls **/*.test.js
ls **/*.spec.js
```

**Step 2: Verify Test Framework**
```bash
# Check package.json for test framework
cat package.json | grep test

# Install if missing
npm install --save-dev jest
# or
npm install --save-dev mocha
```

**Step 3: Configure Test Pattern**
- Specify test pattern in agent command
- Update test configuration file

**Step 4: Run Tests Manually**
```bash
# Try running tests manually
npm test

# If manual works, issue is with test-runner
# If manual fails, fix test setup first
```

#### Resolution Checklist
- [ ] Tests located
- [ ] Test framework configured
- [ ] Dependencies installed
- [ ] Tests running manually
- [ ] test-runner finding and executing tests

---

### SCENARIO 9: Backtest-Manager WebSocket Error

**Issue**: backtest-manager cannot connect to WebSocket
**Frequency**: Low-Medium
**Severity**: Medium
**Avg Resolution Time**: 30 minutes

#### Common Causes
1. Backtesting service not running
2. WebSocket URL incorrect
3. Network/firewall issues
4. Authentication failure

#### Troubleshooting Steps

**Step 1: Verify Service Status**
```bash
# Check if backtesting service is running
curl https://api.aurigraph.io/v1/backtests

# Should return 200 OK
```

**Step 2: Verify WebSocket URL**
```bash
# Check WebSocket configuration
cat .claude/credentials.md | grep BACKTEST

# Should show BACKTEST_WS_URL
```

**Step 3: Test WebSocket Connection**
```bash
# Use wscat to test WebSocket
npm install -g wscat
wscat -c wss://api.aurigraph.io/ws/backtests

# Should connect successfully
```

**Step 4: Check Authentication**
- Verify API token in credentials.md
- Check token expiration
- Regenerate token if needed

#### Resolution Checklist
- [ ] Backtesting service running
- [ ] WebSocket URL correct
- [ ] Network/firewall allowing WebSocket
- [ ] Authentication successful
- [ ] backtest-manager connecting

---

### SCENARIO 10: Security-Scanner False Positives

**Issue**: security-scanner reporting false positive vulnerabilities
**Frequency**: Medium
**Severity**: Low
**Avg Resolution Time**: 30 minutes

#### Common Causes
1. Outdated vulnerability database
2. Dev dependencies flagged
3. Known acceptable risks
4. Scanner misconfiguration

#### Troubleshooting Steps

**Step 1: Review Vulnerability Report**
- Identify specific vulnerabilities
- Check severity level
- Determine if true positive or false positive

**Step 2: Update Dependencies**
```bash
# Update npm packages
npm update

# Update specific package
npm update <package-name>

# Check for security updates
npm audit fix
```

**Step 3: Suppress False Positives**
```bash
# Add to .aurigraphignore or suppression file
# Format: <vulnerability-id>:<reason>
CVE-2021-12345:Acceptable risk, dev dependency only
```

**Step 4: Re-run Scan**
```bash
# Run security-scanner again
@security-compliance "Run security scan"
```

#### Resolution Checklist
- [ ] Vulnerabilities reviewed
- [ ] Dependencies updated
- [ ] False positives suppressed
- [ ] True positives remediated
- [ ] Security score improved

---

### SCENARIO 11: Jeeves4Coder Code Review Incomplete

**Issue**: Jeeves4Coder code review missing expected checks
**Frequency**: Low-Medium
**Severity**: Low
**Avg Resolution Time**: 15 minutes

#### Common Causes
1. Code file too large
2. Language not fully supported
3. Insufficient context provided
4. Review scope too broad

#### Troubleshooting Steps

**Step 1: Check File Size**
```bash
# Check file size
ls -lh <file-path>

# If >5000 lines, break into smaller reviews
```

**Step 2: Verify Language Support**
- Jeeves4Coder supports 10+ languages
- Expert level: JavaScript, TypeScript, Python, SQL
- Advanced level: Java, Go, Rust, etc.
- Check language in skill documentation

**Step 3: Provide More Context**
- Specify review focus: security, performance, style, etc.
- Provide related files if needed
- Use more specific command

**Examples**:
```
# Too broad
@jeeves4coder "Review this code"

# Better
@jeeves4coder "Review this function for security vulnerabilities"
@jeeves4coder "Review this code for performance issues"
@jeeves4coder "Suggest refactoring for this class"
```

#### Resolution Checklist
- [ ] File size manageable (<5000 lines)
- [ ] Language supported
- [ ] Context provided
- [ ] Review scope specific
- [ ] Review complete and helpful

---

### SCENARIO 12: Environment Variables Not Loading

**Issue**: Agents cannot access environment variables or credentials
**Frequency**: Medium
**Severity**: Medium
**Avg Resolution Time**: 20 minutes

#### Common Causes
1. credentials.md not found
2. credentials.md syntax errors
3. Environment variables not exported
4. Credentials not in correct format

#### Troubleshooting Steps

**Step 1: Verify credentials.md Exists**
```bash
# Check if credentials file exists
ls .claude/credentials.md

# If not found, create it
cp .claude/credentials.template.md .claude/credentials.md
```

**Step 2: Verify Syntax**
```bash
# Check credentials file syntax
cat .claude/credentials.md

# Should be in format:
# KEY=value
# API_TOKEN=abc123
```

**Step 3: Verify Required Credentials**
- Check skill documentation for required credentials
- Ensure all required keys present
- Verify values are correct (no trailing spaces)

**Step 4: Test Credential Access**
```bash
# Test if agent can read credentials
@devops-engineer "Show available credentials"
```

#### Resolution Checklist
- [ ] credentials.md exists
- [ ] Syntax correct
- [ ] Required credentials present
- [ ] Agents can access credentials
- [ ] Skill executing successfully

---

### SCENARIO 13: Git Submodule Out of Date

**Issue**: Agent architecture is outdated (missing new features/fixes)
**Frequency**: Low (Month 2+)
**Severity**: Low
**Avg Resolution Time**: 10 minutes

#### Solution

**Step 1: Update Submodule**
```bash
# Navigate to project root
cd /path/to/project

# Update submodule to latest version
git submodule update --remote .claude

# Verify update
cd .claude
git log --oneline -5
```

**Step 2: Commit Update**
```bash
# Navigate back to project root
cd ..

# Stage submodule update
git add .claude

# Commit update
git commit -m "Update agent architecture to latest version"

# Push to remote
git push
```

**Step 3: Reload Claude Code**
- Close Claude Code
- Reopen Claude Code
- Verify new features available

#### Resolution Checklist
- [ ] Submodule updated to latest
- [ ] Update committed and pushed
- [ ] Claude Code reloaded
- [ ] New features accessible

---

### SCENARIO 14: Cannot Find Skill Documentation

**Issue**: User cannot find documentation for specific skill
**Frequency**: Medium
**Severity**: Low
**Avg Resolution Time**: 5 minutes

#### Solution

**Location of Documentation**:
```bash
# All skills are documented in .claude/skills/
ls .claude/skills/

# To read specific skill:
cat .claude/skills/deploy-wizard.md
cat .claude/skills/jira-sync.md
cat .claude/skills/test-runner.md

# To see all skills at once:
cat .claude/docs/SKILLS.md
```

**Quick Reference**:
```bash
# See quick start guide
cat .claude/docs/QUICK_START.md

# See onboarding guide
cat .claude/docs/ONBOARDING_GUIDE.md

# See usage examples
cat .claude/docs/AGENT_USAGE_EXAMPLES.md
```

**Ask Agent for Help**:
```
@agent-name "What can you do?"
@agent-name "List your skills"
@agent-name "Help with [specific-skill]"
```

#### Resolution Checklist
- [ ] Documentation located
- [ ] User understands how to access docs
- [ ] Specific skill documentation found

---

### SCENARIO 15: Multi-Agent Workflow Not Working

**Issue**: User trying to use multiple agents in sequence, not working as expected
**Frequency**: Low-Medium
**Severity**: Low
**Avg Resolution Time**: 20 minutes

#### Common Causes
1. Agent context not passed correctly
2. Output format incompatible
3. Incorrect agent sequence
4. Missing intermediate steps

#### Troubleshooting Steps

**Step 1: Verify Agent Sequence**
- Document desired workflow
- Identify correct agent order
- Check if agents can work together

**Example Workflows**:
```
# Code Review → Deployment
1. @jeeves4coder "Review this code"
2. [Implement fixes]
3. @devops-engineer "Deploy to dev4"

# Strategy Creation → Backtesting → Deployment
1. @trading-operations "Create RSI strategy"
2. @trading-operations "Backtest this strategy"
3. @trading-operations "Deploy to paper trading"

# Issue Discovery → JIRA Ticket
1. @jeeves4coder "Security audit"
2. @project-manager "Create JIRA ticket for [issue]"
```

**Step 2: Pass Context Between Agents**
- Copy relevant output from first agent
- Provide as context to second agent
- Be explicit about what you want

**Step 3: Simplify Workflow**
- Break into smaller steps
- Test each step individually
- Combine once working

#### Resolution Checklist
- [ ] Workflow documented
- [ ] Agent sequence correct
- [ ] Context passed correctly
- [ ] Each step working individually
- [ ] Full workflow successful

---

### SCENARIO 16: Office Hours Zoom Link Not Working

**Issue**: User cannot join office hours via Zoom
**Frequency**: Low
**Severity**: Low
**Avg Resolution Time**: 5 minutes

#### Solution

**Step 1: Find Zoom Link**
- Check #claude-agents pinned message
- Check calendar invite
- Check weekly summary post

**Step 2: Alternative Access**
```
# Zoom Meeting ID: [to be provided]
# Password: [to be provided]

# Or join via:
https://aurigraph.zoom.us/j/[meeting-id]
```

**Step 3: Escalate**
- If link not working, post in #claude-agents
- Support team will provide alternative
- Phone dial-in available

#### Resolution Checklist
- [ ] Zoom link located
- [ ] User joined office hours
- [ ] Issue resolved or escalated

---

### SCENARIO 17: Training Session Recording Not Available

**Issue**: User missed training session, cannot find recording
**Frequency**: Low-Medium (Week 2-3)
**Severity**: Low
**Avg Resolution Time**: 5 minutes

#### Solution

**Location of Recordings**:
- Slack #claude-agents pinned message
- Company learning management system
- Google Drive (shared folder)

**Alternative Training**:
- Office hours attendance
- Self-paced: `.claude/docs/ONBOARDING_GUIDE.md`
- Examples: `.claude/docs/AGENT_USAGE_EXAMPLES.md`

**Request Recording**:
```
Hi team! I missed [training session name] on [date].
Could someone share the recording link?
Thanks!
```

#### Resolution Checklist
- [ ] Recording located
- [ ] User has access
- [ ] Alternative training provided if recording unavailable

---

### SCENARIO 18: Team Member Not Adopting

**Issue**: Team member not installing/using agents despite reminders
**Frequency**: Low-Medium (Week 2-4)
**Severity**: Medium
**Avg Resolution Time**: Varies (1-7 days)

#### Common Causes
1. Too busy / low priority
2. Doesn't see value
3. Technical issues
4. Resistance to change

#### Troubleshooting Steps

**Step 1: Champion Outreach**
- Champion reaches out 1:1
- Understand blockers
- Offer help with installation

**Step 2: Value Demonstration**
- Show relevant use cases
- Demonstrate time savings
- Share success stories

**Step 3: Remove Barriers**
- Help with installation (pair programming)
- Answer technical questions
- Provide training

**Step 4: Management Escalation**
- If no progress after 1 week
- Escalate to team lead/manager
- Make adoption mandatory if needed

#### Resolution Checklist
- [ ] Blockers identified
- [ ] Value demonstrated
- [ ] Installation help provided
- [ ] Training offered
- [ ] Adoption achieved or escalated

---

### SCENARIO 19: Success Story Collection

**Issue**: Support team needs to collect success stories
**Frequency**: Ongoing
**Severity**: Low
**Avg Resolution Time**: 30 minutes per story

#### Process

**Step 1: Identify Candidates**
- Monitor Slack for positive feedback
- Track high-usage users
- Ask champions for nominations

**Step 2: Interview**
```
Success Story Interview Questions:

1. What were you trying to accomplish?
2. Which agent/skill did you use?
3. What was the outcome?
4. How much time did you save?
5. Would you recommend to others?
6. Can we quote you?
```

**Step 3: Document**
```markdown
## Success Story: [Title]

**Team**: [team name]
**Role**: [role]
**Agent**: [agent name]
**Skill**: [skill name]

**Challenge**: [What they were trying to do]

**Solution**: [How they used the agent]

**Outcome**: [Results achieved]

**Time Saved**: [Estimated hours/minutes]

**Quote**: "[User quote in their own words]"

**Date**: [date]
```

**Step 4: Share**
- Post in #claude-agents
- Include in weekly summary
- Add to case study collection

#### Resolution Checklist
- [ ] User identified
- [ ] Interview conducted
- [ ] Story documented
- [ ] Permission to share obtained
- [ ] Story shared publicly

---

### SCENARIO 20: Escalation to Core Team Needed

**Issue**: Support team cannot resolve issue, needs escalation
**Frequency**: Low
**Severity**: Varies
**Avg Resolution Time**: Varies

#### Escalation Triggers
- Issue not resolved within 24 hours
- Critical issue (affects >10 users)
- Security vulnerability discovered
- Feature request requiring architecture changes
- Recurring issue needing permanent fix

#### Escalation Process

**Step 1: Document Issue**
```markdown
## Escalation Request

**Issue ID**: [unique ID]
**Reporter**: [name]
**Date**: [date]
**Severity**: Critical / High / Medium / Low

**Issue Summary**: [1-2 sentence description]

**Users Affected**: [number]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Troubleshooting Attempted**:
- [What has been tried]
- [Results of each attempt]

**Temporary Workaround**: [If available]

**Recommended Action**: [Support team's recommendation]

**Urgency**: [Why this needs escalation now]
```

**Step 2: Notify Core Team**
- Slack @mention in #claude-agents
- Email to agents@aurigraph.io (if critical)
- Include escalation document

**Step 3: Track Resolution**
- Core team assigns owner
- Resolution timeline established
- Support team kept updated
- Users notified of progress

**Step 4: Close Loop**
- Verify fix with original reporter
- Update documentation
- Add to FAQ if common issue
- Post-mortem if critical

#### Resolution Checklist
- [ ] Issue fully documented
- [ ] Core team notified
- [ ] Owner assigned
- [ ] Timeline established
- [ ] Users kept updated
- [ ] Issue resolved
- [ ] Documentation updated

---

## ERROR MESSAGES REFERENCE

### Common Error Messages & Solutions

#### ERROR: "fatal: remote error: Repository not found"
**Cause**: No access to glowing-adventure repository
**Solution**: Request access from DevOps team, verify SSH key

#### ERROR: "'.claude' already exists in the index"
**Cause**: .claude directory already exists
**Solution**:
```bash
rm -rf .claude
git submodule add git@github.com:Aurigraph-DLT-Corp/glowing-adventure.git .claude
```

#### ERROR: "Agent not found"
**Cause**: Agent file missing or Claude Code not recognizing agents
**Solution**: Verify .claude/agents/ directory, reload Claude Code

#### ERROR: "Skill not implemented"
**Cause**: Skill is documented but not yet coded
**Solution**: Use alternative skill, check roadmap, file feature request

#### ERROR: "Authentication failed"
**Cause**: Missing or invalid credentials
**Solution**: Check .claude/credentials.md, verify API tokens

#### ERROR: "Connection timeout"
**Cause**: Network issue or service unavailable
**Solution**: Check network, verify service status, retry

#### ERROR: "Permission denied (publickey)"
**Cause**: SSH key not configured or not added to GitHub
**Solution**: Generate SSH key, add to GitHub, verify with `ssh -T git@github.com`

---

## ESCALATION PROCEDURES

### Level 1: Support Team (Response <2 hours)
**Scope**:
- Quick questions
- Installation help
- Usage guidance
- Documentation clarification

**Actions**:
- Answer directly
- Document in FAQ
- Mark as resolved

### Level 2: Core Deployment Team (Response <4 hours)
**Scope**:
- Complex technical issues
- Integration problems
- Configuration issues
- Recurring problems

**Actions**:
- Investigation
- Coordination with DevOps/QA
- Solution implementation
- Documentation update

### Level 3: Leadership (Response <24 hours)
**Scope**:
- Critical issues (>10 users)
- Security vulnerabilities
- Architecture changes needed
- Resource allocation required

**Actions**:
- Executive decision
- Resource allocation
- Risk mitigation
- Communication to organization

---

## FAQ QUICK ANSWERS

### Q1: How do I install agents?
**A**: Run `git submodule add git@github.com:Aurigraph-DLT-Corp/glowing-adventure.git .claude` in your project root.

### Q2: How do I use an agent?
**A**: In Claude Code, type `@agent-name "your request"`. Example: `@devops-engineer "Deploy to dev4"`

### Q3: Where is the documentation?
**A**: In your project at `.claude/docs/`. Start with `QUICK_START.md`.

### Q4: Which agents are available?
**A**: 13 agents: DLT Developer, Trading Operations, DevOps Engineer, QA Engineer, Project Manager, Security & Compliance, Data Engineer, Frontend Developer, SRE/Reliability, Digital Marketing, Employee Onboarding, Jeeves4Coder, and more.

### Q5: How do I update agents?
**A**: Run `git submodule update --remote .claude` then reload Claude Code.

### Q6: Where do I get support?
**A**: Slack #claude-agents (<1 hour), Email agents@aurigraph.io (<24 hours), Office Hours (Mon/Wed 10-12, Tue/Thu 2-4).

### Q7: What if I find a bug?
**A**: Report in #claude-agents or file GitHub issue at https://github.com/Aurigraph-DLT-Corp/glowing-adventure/issues

### Q8: Can I customize agents?
**A**: Yes! Copy agent file and modify. Contact support for guidance.

### Q9: How often are agents updated?
**A**: Monthly patches, quarterly features. Update via `git submodule update --remote`.

### Q10: Is training available?
**A**: Yes! 6 training sessions (Week 1-3) + office hours (Mon/Wed 10-12, Tue/Thu 2-4).

---

## CONTACT INFORMATION

### Support Channels

**Slack** (Fastest):
- Channel: #claude-agents
- Response Time: <1 hour (business hours)
- Best For: Quick questions, troubleshooting

**Email** (Detailed):
- Address: agents@aurigraph.io
- Response Time: <24 hours
- Best For: Complex issues, sensitive information

**Office Hours** (In-Depth):
- Schedule: Mon/Wed 10-12, Tue/Thu 2-4 PM EST
- Location: Zoom (link in #claude-agents)
- Best For: Training, complex troubleshooting

**GitHub Issues** (Bugs/Features):
- URL: https://github.com/Aurigraph-DLT-Corp/glowing-adventure/issues
- Response Time: 2-3 days
- Best For: Bug reports, feature requests

### Support Team

**Project Manager**: Deployment coordination, escalation
**DevOps Engineer**: Technical issues, infrastructure
**QA Engineer**: Quality issues, testing
**Digital Marketing**: Communications, success stories
**Champions**: Team-specific support (6 champions)

### Emergency Contact

**Critical Issues** (>10 users affected, security):
- Slack: @mention in #claude-agents
- Email: agents@aurigraph.io (mark as URGENT)
- Phone: [To be provided for critical support]

---

## ISSUE TRACKING TEMPLATE

### Support Ticket Template

```markdown
## Support Ticket #[ID]

**Date**: [YYYY-MM-DD]
**Reporter**: [Name]
**Contact**: [Email/Slack]
**Priority**: Critical / High / Medium / Low
**Status**: Open / In Progress / Resolved / Closed

---

**Issue Summary**:
[1-2 sentence description]

**Environment**:
- Project: [project name]
- OS: [Windows/Mac/Linux]
- Claude Code Version: [version]
- Agent: [agent name]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happened]

**Error Message**:
[Paste error or attach screenshot]

---

**Troubleshooting Log**:
- [Timestamp] [Action taken] - [Result]
- [Timestamp] [Action taken] - [Result]

**Resolution**:
[How was it resolved]

**Time to Resolve**: [hours/minutes]
**Follow-Up**: [Any follow-up needed]

**Escalated**: Yes / No
**Escalated To**: [Person/Team]

---

**Lessons Learned**:
[What can prevent this in the future]

**Documentation Update Needed**: Yes / No
**FAQ Addition Needed**: Yes / No
```

---

## CONCLUSION

This support runbook provides comprehensive troubleshooting guidance for the Aurigraph Agent Architecture deployment. Support team should reference this document for all common scenarios and escalate appropriately when needed.

**Status**: ✅ Ready for Deployment
**Version**: 1.0
**Last Updated**: October 23, 2025
**Owner**: Support Team + DevOps Engineer
**Contact**: agents@aurigraph.io

---

**Remember**:
- Response <1 hour on Slack
- Resolution <24 hours when possible
- Escalate proactively
- Document everything
- Celebrate wins!
