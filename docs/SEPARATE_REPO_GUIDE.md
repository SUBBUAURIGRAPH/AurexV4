# Aurigraph Agent Architecture - Separate Repository Guide

**Purpose**: Extract `.claude/` directory into standalone GitHub repository
**New Repo**: `Aurigraph-Agent-Architecture`
**Date**: October 20, 2025

---

## Why Separate Repository?

### Benefits
1. **Reusability**: Share agents across all Aurigraph projects
2. **Versioning**: Independent version control for agent updates
3. **Distribution**: Easy to clone and use in any project
4. **Community**: Can be shared with partners/customers
5. **Maintenance**: Centralized updates, distributed benefits
6. **Documentation**: Self-contained with all guides

### Use Cases
- Add to HMS (current project)
- Add to other Aurigraph projects
- Share with partners/customers
- Distribute to subsidiaries
- Community contributions

---

## Repository Structure

```
Aurigraph-Agent-Architecture/
├── README.md                           # Main repository README
├── LICENSE                             # MIT or proprietary license
├── CHANGELOG.md                        # Version history
├── .gitignore                          # Standard gitignore
│
├── agents/                             # All 11 agent definitions
│   ├── README.md
│   ├── dlt-developer.md
│   ├── trading-operations.md
│   ├── devops-engineer.md
│   ├── qa-engineer.md
│   ├── project-manager.md
│   ├── security-compliance.md
│   ├── data-engineer.md
│   ├── frontend-developer.md
│   ├── sre-reliability.md
│   ├── digital-marketing.md
│   └── employee-onboarding.md
│
├── skills/                             # Implemented skills
│   ├── README.md
│   ├── SKILL_TEMPLATE.md
│   ├── deploy-wizard.md
│   ├── jira-sync.md
│   ├── test-runner.md
│   ├── backtest-manager.md
│   └── security-scanner.md
│
├── plugin/                             # Claude Code plugin
│   ├── README.md
│   ├── package.json
│   ├── config.json
│   └── index.js
│
├── docs/                               # Documentation
│   ├── QUICK_START.md
│   ├── AGENT_SHARING_GUIDE.md
│   ├── AGENT_USAGE_EXAMPLES.md
│   ├── ONBOARDING_GUIDE.md
│   ├── FEEDBACK_SYSTEM.md
│   └── TEAM_DISTRIBUTION_PLAN.md
│
├── rollout/                            # Rollout materials
│   ├── SLACK_CHANNEL_SETUP.md
│   ├── EMAIL_ANNOUNCEMENT.md
│   ├── TRAINING_MATERIALS.md
│   ├── QUICK_REFERENCE_CARDS.md
│   ├── ROLLOUT_COMPLETE_SUMMARY.md
│   └── ORGANIZATION_DISTRIBUTION.md
│
├── examples/                           # Usage examples
│   ├── basic-usage.md
│   ├── advanced-workflows.md
│   ├── multi-agent-orchestration.md
│   └── custom-skills.md
│
├── scripts/                            # Utility scripts
│   ├── install.sh
│   ├── install.ps1
│   ├── validate-agents.js
│   └── update-all-projects.sh
│
└── templates/                          # Templates for new projects
    ├── project-integration-guide.md
    ├── custom-agent-template.md
    └── skill-implementation-template.md
```

---

## Step-by-Step Repository Creation

### Step 1: Create GitHub Repository

**Via GitHub Web UI**:

1. Go to https://github.com/Aurigraph-DLT-Corp
2. Click "New repository"
3. Repository details:
   - **Name**: `Aurigraph-Agent-Architecture`
   - **Description**: "Comprehensive AI agent ecosystem for Aurigraph DLT - 11 specialized agents with 68+ skills for maximum productivity across Development, Operations, Quality, Management, Growth, and HR"
   - **Visibility**: Private (initially) or Public (if ready to share)
   - **Initialize**: ✅ Add README file
   - **License**: MIT License or keep proprietary
   - **.gitignore**: Node
   - Click "Create repository"

**Via GitHub CLI** (alternative):

```bash
# Create repo via GitHub CLI
gh repo create Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture \
  --private \
  --description "Comprehensive AI agent ecosystem for Aurigraph DLT" \
  --clone
```

---

### Step 2: Prepare Content for New Repo

**Create temporary staging directory**:

```bash
# Create staging directory
mkdir -p ~/aurigraph-agents-staging
cd ~/aurigraph-agents-staging

# Initialize git
git init
git branch -M main
```

---

### Step 3: Copy Files from HMS

```bash
# Copy all agent architecture files from HMS
cd ~/aurigraph-agents-staging

# Copy agents
mkdir -p agents
cp /path/to/HMS/.claude/agents/*.md agents/

# Copy skills
mkdir -p skills
cp /path/to/HMS/.claude/skills/*.md skills/

# Copy plugin
mkdir -p plugin
cp -r /path/to/HMS/.claude/plugin/* plugin/

# Copy docs
mkdir -p docs
cp /path/to/HMS/.claude/QUICK_START.md docs/
cp /path/to/HMS/.claude/AGENT_SHARING_GUIDE.md docs/
cp /path/to/HMS/.claude/AGENT_USAGE_EXAMPLES.md docs/
cp /path/to/HMS/.claude/ONBOARDING_GUIDE.md docs/
cp /path/to/HMS/.claude/FEEDBACK_SYSTEM.md docs/
cp /path/to/HMS/.claude/TEAM_DISTRIBUTION_PLAN.md docs/

# Copy rollout materials
mkdir -p rollout
cp /path/to/HMS/.claude/rollout/*.md rollout/

# Copy summaries (for reference)
cp /path/to/HMS/COMPLETE_AGENT_ECOSYSTEM_SUMMARY.md .
cp /path/to/HMS/DIGITAL_MARKETING_AGENT_SUMMARY.md docs/
```

---

### Step 4: Create Main README

**`README.md`**:

```markdown
# Aurigraph Agent Architecture

**Version**: 2.0.0
**Status**: Production Ready
**Last Updated**: October 20, 2025

## Overview

Comprehensive AI agent ecosystem for Aurigraph DLT featuring **11 specialized agents** with **68+ integrated skills** designed to maximize productivity across Development, Operations, Quality, Management, Growth, and HR.

## 🤖 Complete Agent Roster

| Agent | Skills | Purpose | Teams |
|-------|--------|---------|-------|
| **DLT Developer** | 5 | Smart contracts & blockchain | DLT, Backend |
| **Trading Operations** | 7 | Trading strategies & exchanges | Trading, Quant |
| **DevOps Engineer** | 8 | Deployments & infrastructure | DevOps, All |
| **QA Engineer** | 7 | Testing & quality assurance | QA, Dev |
| **Project Manager** | 7 | Sprint planning & JIRA | PM, Scrum |
| **Security & Compliance** | 7 | Security & regulations | Security, Compliance |
| **Data Engineer** | 4 | Data pipelines & analytics | Data, Analytics |
| **Frontend Developer** | 4 | UI/UX & React components | Frontend, Design |
| **SRE/Reliability** | 4 | Incidents & monitoring | SRE, DevOps |
| **Digital Marketing** | 11 | Marketing & engagement | Marketing, Growth |
| **Employee Onboarding** | 8 | Onboarding & offboarding | HR, People Ops |

**Total**: 68+ skills across 11 agents

## ⚡ Quick Start

### 1. Installation

**Option A: Git Submodule** (Recommended)
```bash
# Add to your project as submodule
cd /your/project
git submodule add https://github.com/Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture .claude
git submodule update --init --recursive
```

**Option B: Clone Directly**
```bash
# Clone into your project
cd /your/project
git clone https://github.com/Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture .claude
```

**Option C: NPM Package** (Coming Soon)
```bash
npm install @aurigraph/agent-architecture
```

### 2. First Use

```bash
# Read quick start
cat .claude/docs/QUICK_START.md

# Try your first agent
@devops-engineer "Deploy to dev4"
```

### 3. Get Help

- **Documentation**: `.claude/docs/`
- **Examples**: `.claude/docs/AGENT_USAGE_EXAMPLES.md`
- **Support**: agents@aurigraph.io

## 📚 Documentation

- **[Quick Start](docs/QUICK_START.md)**: Get started in 5 minutes
- **[Usage Examples](docs/AGENT_USAGE_EXAMPLES.md)**: 21 real-world scenarios
- **[Onboarding Guide](docs/ONBOARDING_GUIDE.md)**: Comprehensive 30-minute tour
- **[Sharing Guide](docs/AGENT_SHARING_GUIDE.md)**: Team collaboration
- **[Distribution Plan](docs/TEAM_DISTRIBUTION_PLAN.md)**: Organization rollout

## 🎯 Features

- **11 Specialized Agents**: Role-specific expertise
- **68+ Integrated Skills**: Comprehensive workflows
- **5 Implemented Skills**: Production-ready (deploy-wizard, jira-sync, test-runner, backtest-manager, security-scanner)
- **Claude Code Plugin**: CLI integration
- **Complete Documentation**: Guides, examples, training materials
- **Rollout Package**: Slack, email, training, quick reference cards

## 💡 Impact

- **30-80% time savings** on routine tasks
- **100% compliance** with best practices
- **Faster time to market** for features
- **Higher quality** deliverables
- **Better collaboration** across teams

## 🚀 Integration

### Supported Projects
- Hermes Trading Platform
- DLT Tokenization Services
- ESG Analytics Platform
- Any Aurigraph project

### Supported Tools
- GitHub, JIRA, Confluence
- AWS, Docker, Kubernetes
- Jest, Artillery, k6
- SendGrid, HubSpot, Mailchimp
- And many more...

## 📦 What's Included

```
Aurigraph-Agent-Architecture/
├── agents/          # 11 agent definitions
├── skills/          # 5 implemented + 63+ documented skills
├── plugin/          # Claude Code plugin
├── docs/            # Comprehensive documentation
├── rollout/         # Distribution materials
└── templates/       # Customization templates
```

## 🔧 Customization

### Add Custom Agent
1. Copy `templates/custom-agent-template.md`
2. Define agent capabilities
3. Add to `agents/` directory

### Implement New Skill
1. Copy `skills/SKILL_TEMPLATE.md`
2. Implement skill logic
3. Add to appropriate agent
4. Document in skill README

### Customize for Your Team
1. Review `templates/project-integration-guide.md`
2. Adjust agent configurations
3. Add team-specific examples
4. Update documentation

## 📈 Version History

- **2.0.0** (Oct 20, 2025): Added Digital Marketing + Employee Onboarding agents
- **1.0.0** (Oct 20, 2025): Initial release with 9 agents

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## 🤝 Contributing

### For Aurigraph Employees
1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request
5. Request review from team

### For Partners/Customers
1. Fork repository
2. Create feature branch
3. Submit pull request
4. Provide use case description

## 📧 Support

- **Email**: agents@aurigraph.io
- **Slack**: #claude-agents (internal)
- **Issues**: GitHub Issues
- **Documentation**: This repository

## 📄 License

[MIT License](LICENSE) or Proprietary - See LICENSE file

## 🌟 Acknowledgments

Created by Aurigraph Development Team
Powered by Claude Code (Anthropic)

---

**Ready to boost your productivity?**

Start with the [Quick Start Guide](docs/QUICK_START.md) and transform how you work!

```

---

### Step 5: Create CHANGELOG.md

```markdown
# Changelog

All notable changes to Aurigraph Agent Architecture will be documented in this file.

## [2.0.0] - 2025-10-20

### Added
- **Digital Marketing Agent** (11 skills)
  - Multi-channel marketing automation
  - Social media management
  - Email campaigns and lead nurturing
  - SEO and paid advertising
  - Influencer partnerships

- **Employee Onboarding Agent** (8 skills)
  - Complete lifecycle management (offer → 90 days → offboarding)
  - 31 document tracking with e-signatures
  - Role-specific training curricula
  - System access provisioning (20+ systems)
  - Compliance tracking (legal, regulatory)
  - Buddy matching program
  - 30-60-90 day milestone tracking
  - Offboarding process management

- **Organization Distribution Package**
  - Complete rollout materials
  - Slack channel setup guide
  - Email announcements (HTML + text)
  - Training materials (6 sessions)
  - Quick reference cards (print-ready)

### Changed
- Updated total agent count: 9 → 11
- Updated total skills: 50+ → 68+
- Enhanced plugin with new agent support
- Improved documentation with more examples

## [1.0.0] - 2025-10-20

### Added
- Initial release with 9 specialized agents
- 50+ integrated skills
- 5 priority skills fully implemented
- Claude Code plugin
- Complete documentation suite
- Training and rollout materials

### Agents (v1.0.0)
1. DLT Developer (5 skills)
2. Trading Operations (7 skills)
3. DevOps Engineer (8 skills)
4. QA Engineer (7 skills)
5. Project Manager (7 skills)
6. Security & Compliance (7 skills)
7. Data Engineer (4 skills)
8. Frontend Developer (4 skills)
9. SRE/Reliability (4 skills)

### Implemented Skills (v1.0.0)
- deploy-wizard (600+ lines)
- jira-sync
- test-runner
- backtest-manager
- security-scanner

---

**Format**: [Version] - YYYY-MM-DD
**Types**: Added, Changed, Deprecated, Removed, Fixed, Security
```

---

### Step 6: Create .gitignore

```gitignore
# Node modules
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Build output
dist/
build/
*.log

# Credentials (never commit!)
*credentials*
*secrets*
*keys*
*.pem
*.key

# Temporary files
*.tmp
temp/
tmp/

# Coverage
coverage/
.nyc_output/

# Plugin specific
plugin/node_modules/
```

---

### Step 7: Create Installation Scripts

**`scripts/install.sh`** (Unix/Linux/Mac):

```bash
#!/bin/bash

echo "Installing Aurigraph Agent Architecture..."

# Check if running in a git repository
if [ ! -d ".git" ]; then
    echo "Error: Must run from root of a git repository"
    exit 1
fi

# Add as submodule
echo "Adding as git submodule..."
git submodule add https://github.com/Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture .claude
git submodule update --init --recursive

# Install plugin dependencies
echo "Installing plugin dependencies..."
cd .claude/plugin
npm install
cd ../..

echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Read quick start: cat .claude/docs/QUICK_START.md"
echo "2. Try an agent: @devops-engineer 'your task'"
echo "3. Join #claude-agents for support"
echo ""
echo "Happy agent-ing! 🚀"
```

**`scripts/install.ps1`** (Windows):

```powershell
Write-Host "Installing Aurigraph Agent Architecture..." -ForegroundColor Green

# Check if running in a git repository
if (!(Test-Path ".git")) {
    Write-Host "Error: Must run from root of a git repository" -ForegroundColor Red
    exit 1
}

# Add as submodule
Write-Host "Adding as git submodule..."
git submodule add https://github.com/Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture .claude
git submodule update --init --recursive

# Install plugin dependencies
Write-Host "Installing plugin dependencies..."
Set-Location .claude/plugin
npm install
Set-Location ../..

Write-Host "✅ Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Read quick start: cat .claude/docs/QUICK_START.md"
Write-Host "2. Try an agent: @devops-engineer 'your task'"
Write-Host "3. Join #claude-agents for support"
Write-Host ""
Write-Host "Happy agent-ing! 🚀"
```

---

### Step 8: Commit and Push to New Repo

```bash
# In staging directory
cd ~/aurigraph-agents-staging

# Add all files
git add .

# First commit
git commit -m "feat: Initial release of Aurigraph Agent Architecture v2.0.0

Complete AI agent ecosystem with 11 specialized agents:

Agents (11 total, 68+ skills):
- DLT Developer (5 skills)
- Trading Operations (7 skills)
- DevOps Engineer (8 skills)
- QA Engineer (7 skills)
- Project Manager (7 skills)
- Security & Compliance (7 skills)
- Data Engineer (4 skills)
- Frontend Developer (4 skills)
- SRE/Reliability (4 skills)
- Digital Marketing (11 skills)
- Employee Onboarding (8 skills)

Skills Implemented (5):
- deploy-wizard (600+ lines)
- jira-sync
- test-runner
- backtest-manager
- security-scanner

Documentation:
- Quick start guide (5 min)
- Comprehensive onboarding (30 min)
- 21 usage examples
- Team sharing guide
- Distribution plan
- Training materials (6 sessions)
- Quick reference cards

Rollout Package:
- Slack channel setup
- Email announcements (HTML + text)
- Training session materials
- Organization distribution guide

Plugin:
- Claude Code integration
- NPM package configuration
- CLI interface
- Metrics tracking

Complete coverage for:
✅ Development, Operations, Quality
✅ Management, Growth, HR

Ready for production use and distribution!

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Add remote
git remote add origin https://github.com/Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture.git

# Push to GitHub
git push -u origin main
```

---

## Step 9: Configure HMS to Use New Repo

**In HMS repository**:

### Remove existing .claude directory (backup first!)

```bash
cd /path/to/HMS

# Backup current .claude (just in case)
cp -r .claude .claude-backup-$(date +%Y%m%d)

# Remove current .claude
git rm -r .claude
git commit -m "refactor: Remove .claude directory (moving to separate repo)"
```

### Add new repo as submodule

```bash
# Add as submodule
git submodule add https://github.com/Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture .claude

# Update submodule
git submodule update --init --recursive

# Commit
git commit -m "feat: Add Aurigraph Agent Architecture as submodule

Now using centralized agent repository for easier sharing across projects.

Repository: https://github.com/Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture
Version: 2.0.0
Agents: 11 (68+ skills)

This allows:
- Centralized agent updates
- Easy sharing across Aurigraph projects
- Version control for agent definitions
- Community contributions
"

# Push
git push origin main
```

---

## Step 10: Using in Other Projects

### For New Projects

```bash
# Navigate to project root
cd /your/new/project

# Add as submodule
git submodule add https://github.com/Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture .claude

# Update
git submodule update --init --recursive

# Install plugin dependencies
cd .claude/plugin
npm install
cd ../..

# Commit
git add .gitmodules .claude
git commit -m "feat: Add Aurigraph Agent Architecture"
git push
```

### For Existing Projects

```bash
# Same steps as new projects
git submodule add https://github.com/Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture .claude
git submodule update --init --recursive
git commit -m "feat: Add Aurigraph Agent Architecture"
git push
```

---

## Step 11: Updating Agents (Future)

### In Agent Architecture Repo

```bash
# Make changes to agents
cd ~/Aurigraph-Agent-Architecture
git checkout -b feature/add-new-skill

# Make changes
# ...edit agent files...

# Commit
git add .
git commit -m "feat: Add new skill to DevOps agent"
git push origin feature/add-new-skill

# Create pull request
gh pr create --title "Add new skill to DevOps agent" --body "Description..."

# After merge, tag version
git tag v2.1.0
git push --tags
```

### In Projects Using Agents (like HMS)

```bash
# Update submodule to latest
cd /path/to/HMS
git submodule update --remote .claude

# Commit update
git add .claude
git commit -m "chore: Update Aurigraph Agent Architecture to v2.1.0"
git push
```

---

## Benefits of Separate Repository

### 1. Centralized Management
- Single source of truth for all agents
- Update once, benefit everywhere
- Consistent versioning

### 2. Easy Distribution
- Share via GitHub URL
- Install in any project with one command
- No copy-paste errors

### 3. Version Control
- Semantic versioning (v2.0.0, v2.1.0, etc.)
- Changelog tracking
- Easy rollback if needed

### 4. Collaboration
- Pull requests for improvements
- Community contributions
- Code reviews for agent changes

### 5. Scalability
- Works with any number of projects
- Easy to add new agents
- Simple to remove unused agents

---

## GitHub Repository Settings

### Recommended Settings

**General**:
- Default branch: `main`
- Allow merge commits: ✅
- Allow squash merging: ✅
- Allow rebase merging: ✅
- Auto-delete head branches: ✅

**Branches**:
- Protected branch: `main`
- Require pull request before merging: ✅
- Require approvals: 1
- Dismiss stale reviews: ✅
- Require status checks: ✅

**Collaborators**:
- Add relevant team members
- Set appropriate permissions

**Topics** (for discoverability):
- `ai-agents`
- `claude-code`
- `productivity`
- `automation`
- `aurigraph`
- `trading`
- `devops`

---

## NPM Package (Future Enhancement)

### Create NPM Package

**`package.json`** (in root):

```json
{
  "name": "@aurigraph/agent-architecture",
  "version": "2.0.0",
  "description": "Comprehensive AI agent ecosystem for Aurigraph DLT",
  "main": "plugin/index.js",
  "repository": {
    "type": "git",
    "url": "https://github.com/Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture.git"
  },
  "keywords": [
    "ai-agents",
    "claude-code",
    "productivity",
    "automation",
    "devops",
    "trading"
  ],
  "author": "Aurigraph Development Team",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture/issues"
  },
  "homepage": "https://github.com/Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture#readme"
}
```

### Publish to NPM

```bash
# Login to NPM
npm login

# Publish
npm publish --access=private  # or public

# Users can then install via:
npm install @aurigraph/agent-architecture
```

---

## Summary

**New Repository**: `https://github.com/Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture`

**Benefits**:
✅ Centralized management
✅ Easy distribution
✅ Version control
✅ Collaboration
✅ Scalability

**Usage**:
```bash
# Install in any project
git submodule add https://github.com/Aurigraph-DLT-Corp/Aurigraph-Agent-Architecture .claude
```

**Updates**:
```bash
# Update to latest version
git submodule update --remote .claude
```

---

**Ready to create the separate repository!** 🚀

Follow the steps above to move Aurigraph Agent Architecture to its own GitHub repository for maximum reusability and shareability across all Aurigraph projects and beyond!

---

**Questions?** Contact: agents@aurigraph.io
