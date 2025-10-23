# SPARC Framework Plugin - Organization-Wide Distribution Guide

**Framework**: Aurigraph Agent Architecture with SPARC
**Version**: 2.0.1
**Distribution Date**: October 20, 2025
**Purpose**: Organization-wide uniform practices

---

## Overview

This guide helps you distribute the complete SPARC Framework and Aurigraph Agent Architecture to your entire organization, ensuring uniform development practices across all teams.

### What Gets Distributed

✅ **SPARC Framework** - Complete 5-phase methodology
✅ **11 Specialized Agents** - All agent documentation and capabilities
✅ **5 SPARC Templates** - Ready-to-use development templates
✅ **3 Real Examples** - Proven SPARC implementations
✅ **Credentials Management** - Secure credentials documentation
✅ **JIRA Integration** - Complete JIRA project structure
✅ **Agent-SPARC Integration** - Full mapping and deliverables

---

## Distribution Methods

### Method 1: Git Submodule (Recommended for Active Development)

**Best for**: Teams actively contributing to the framework

```bash
# In your project repository
cd /path/to/your/project

# Add as submodule
git submodule add https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git .claude

# Initialize and update
git submodule update --init --recursive

# Commit the submodule
git add .gitmodules .claude
git commit -m "Add Aurigraph Agent Architecture with SPARC framework"
git push
```

**Team members clone with submodules**:
```bash
# New clones
git clone --recurse-submodules <your-repo-url>

# Existing clones
git submodule update --init --recursive
```

**Updating the framework**:
```bash
# Pull latest framework changes
cd .claude
git pull origin main
cd ..
git add .claude
git commit -m "Update SPARC framework to latest version"
git push
```

---

### Method 2: Git Clone (Recommended for Read-Only Use)

**Best for**: Teams using the framework as-is without modifications

```bash
# Each team member runs
cd /path/to/your/project
git clone https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git .claude

# Add to .gitignore if you don't want it in your repo
echo ".claude/" >> .gitignore
```

**Updating**:
```bash
cd .claude
git pull origin main
```

---

### Method 3: Download & Copy (Simplest)

**Best for**: Quick setup or non-Git workflows

```bash
# Download latest release
curl -L https://github.com/Aurigraph-DLT-Corp/glowing-adventure/archive/refs/heads/main.zip -o sparc-framework.zip

# Extract
unzip sparc-framework.zip -d .claude

# Move files
mv .claude/glowing-adventure-main/* .claude/
rm -rf .claude/glowing-adventure-main
```

---

### Method 4: NPM Package (For Node.js Projects)

**Best for**: Node.js/JavaScript projects

```bash
# Publish to private npm registry (one-time setup by admin)
cd /path/to/glowing-adventure
npm publish --registry=https://npm.aurigraph.io

# Team members install
npm install --save-dev @aurigraph/agent-architecture
# or
yarn add --dev @aurigraph/agent-architecture
```

**In package.json**:
```json
{
  "devDependencies": {
    "@aurigraph/agent-architecture": "^2.0.1"
  },
  "scripts": {
    "sparc:init": "cp -r node_modules/@aurigraph/agent-architecture/sparc-templates ./sparc-docs",
    "sparc:update": "npm update @aurigraph/agent-architecture"
  }
}
```

---

### Method 5: Internal Git Server / Artifact Repository

**Best for**: Large organizations with strict security

```bash
# Admin: Mirror to internal Git server
git clone --mirror https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git
cd glowing-adventure.git
git remote set-url --push origin https://git.internal.aurigraph.com/sparc-framework.git
git push --mirror

# Team members: Clone from internal server
git clone https://git.internal.aurigraph.com/sparc-framework.git .claude
```

---

## Organization-Wide Setup Script

Create this script for automated setup across your organization:

**File**: `install-sparc-framework.sh`

```bash
#!/bin/bash
#
# SPARC Framework Organization-Wide Installation Script
# Aurigraph DLT Corp - Version 2.0.1
#
# Usage: ./install-sparc-framework.sh [method]
# Methods: submodule, clone, copy, npm

set -e

FRAMEWORK_REPO="https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git"
FRAMEWORK_DIR=".claude"
INSTALL_METHOD="${1:-clone}"

echo "======================================"
echo "SPARC Framework Installation"
echo "======================================"
echo ""
echo "Organization: Aurigraph DLT Corp"
echo "Version: 2.0.1"
echo "Method: $INSTALL_METHOD"
echo ""

# Check if .claude already exists
if [ -d "$FRAMEWORK_DIR" ]; then
    echo "⚠️  Warning: $FRAMEWORK_DIR directory already exists"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Installation cancelled"
        exit 1
    fi
    echo "🗑️  Removing existing $FRAMEWORK_DIR..."
    rm -rf "$FRAMEWORK_DIR"
fi

# Installation based on method
case "$INSTALL_METHOD" in
    "submodule")
        echo "📦 Installing as Git submodule..."
        git submodule add "$FRAMEWORK_REPO" "$FRAMEWORK_DIR"
        git submodule update --init --recursive
        echo "✅ Submodule added successfully"
        echo "👉 Don't forget to commit: git add .gitmodules .claude && git commit -m 'Add SPARC framework'"
        ;;

    "clone")
        echo "📦 Cloning framework repository..."
        git clone "$FRAMEWORK_REPO" "$FRAMEWORK_DIR"
        echo "✅ Repository cloned successfully"
        echo "👉 Add to .gitignore: echo '$FRAMEWORK_DIR/' >> .gitignore"
        ;;

    "copy")
        echo "📦 Downloading and extracting framework..."
        curl -L "${FRAMEWORK_REPO}/archive/refs/heads/main.zip" -o /tmp/sparc-framework.zip
        unzip -q /tmp/sparc-framework.zip -d /tmp/
        mkdir -p "$FRAMEWORK_DIR"
        cp -r /tmp/glowing-adventure-main/* "$FRAMEWORK_DIR/"
        rm -rf /tmp/sparc-framework.zip /tmp/glowing-adventure-main
        echo "✅ Framework copied successfully"
        ;;

    "npm")
        echo "📦 Installing via NPM..."
        if [ ! -f "package.json" ]; then
            echo "❌ No package.json found. This method requires a Node.js project."
            exit 1
        fi
        npm install --save-dev @aurigraph/agent-architecture
        echo "✅ NPM package installed"
        ;;

    *)
        echo "❌ Unknown installation method: $INSTALL_METHOD"
        echo "Valid methods: submodule, clone, copy, npm"
        exit 1
        ;;
esac

# Verify installation
if [ -f "$FRAMEWORK_DIR/SPARC.md" ]; then
    echo ""
    echo "✅ SPARC Framework installed successfully!"
    echo ""
    echo "📚 Documentation:"
    echo "   - Quick Start: $FRAMEWORK_DIR/SPARC_QUICK_START.md"
    echo "   - Full Framework: $FRAMEWORK_DIR/SPARC.md"
    echo "   - Agent Integration: $FRAMEWORK_DIR/SPARC_AGENT_INTEGRATION.md"
    echo "   - Examples: $FRAMEWORK_DIR/sparc-examples/"
    echo "   - Templates: $FRAMEWORK_DIR/sparc-templates/"
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Read quick start: cat $FRAMEWORK_DIR/SPARC_QUICK_START.md"
    echo "   2. Review your agent: cat $FRAMEWORK_DIR/agents/[agent-name].md"
    echo "   3. Try a template: cp $FRAMEWORK_DIR/sparc-templates/skill-development.md ."
    echo ""
    echo "💬 Support:"
    echo "   - Slack: #claude-agents"
    echo "   - Email: agents@aurigraph.io"
    echo "   - Docs: $FRAMEWORK_DIR/README.md"
    echo ""
else
    echo "❌ Installation verification failed"
    echo "Please check the installation and try again"
    exit 1
fi
```

**Make it executable**:
```bash
chmod +x install-sparc-framework.sh
```

---

## Team Onboarding Process

### Phase 1: Pre-Distribution (1 week before)

**Announcement Email Template**:

```
Subject: 🚀 New SPARC Framework - Unified Development Practices Coming Soon!

Team,

We're excited to announce the rollout of the SPARC Framework with Aurigraph Agent Architecture - a comprehensive development methodology that will standardize our practices organization-wide.

📅 Rollout Schedule:
- Week 1 (Oct 27): Framework distribution and installation
- Week 2 (Nov 3): Team training sessions
- Week 3 (Nov 10): Hands-on workshops
- Week 4 (Nov 17): Full adoption begins

🎯 What to Expect:
- 11 specialized agents with 68+ skills
- SPARC 5-phase development methodology
- 40-60% reduction in rework
- 30-50% faster development
- 80%+ test coverage

📚 Pre-Reading:
- Overview: [Link to SPARC.md]
- Quick Start (5 min): [Link to SPARC_QUICK_START.md]
- FAQs: [Link to FAQ]

📅 Save the Date:
- Training: [Date/Time] - [Location/Zoom]
- Office Hours: Mon/Wed 10-12, Tue/Thu 2-4

Questions? Reply to this email or join #claude-agents on Slack.

Excited to get started!
[Your Name]
```

---

### Phase 2: Distribution Day

**Day-Of Checklist**:

1. ✅ **Send Installation Instructions**
   ```bash
   # Share this one-liner with team
   curl -sSL https://raw.githubusercontent.com/Aurigraph-DLT-Corp/glowing-adventure/main/install-sparc-framework.sh | bash
   ```

2. ✅ **Set Up Support Channels**
   - Create #sparc-framework Slack channel
   - Pin installation script
   - Add moderators for questions

3. ✅ **Monitor Installation Progress**
   - Track completion via Slack emoji reactions
   - Offer 1-on-1 help for issues
   - Document common problems and solutions

4. ✅ **Send Follow-Up**
   ```
   Subject: ✅ SPARC Framework Installed? Here's What's Next

   Thanks for installing the SPARC Framework!

   ✅ Verification:
   Run: ls -la .claude/
   You should see: SPARC.md, agents/, sparc-templates/, etc.

   📖 Today's Reading (15 min):
   1. Read: .claude/SPARC_QUICK_START.md
   2. Explore: .claude/agents/[your-role].md
   3. Browse: .claude/sparc-examples/

   🎓 Tomorrow: Live training session at [Time]

   Questions? #sparc-framework on Slack
   ```

---

### Phase 3: Training (Week after distribution)

**Training Schedule**:

**Session 1: SPARC Overview (1 hour)**
- What is SPARC and why use it?
- 5 phases explained with examples
- Benefits and success metrics
- Q&A

**Session 2: Hands-On Workshop (2 hours)**
- Walk through actual skill development with SPARC
- Use templates for real project
- Pair programming with SPARC
- Q&A

**Session 3: Agent-Specific Training (1 hour per team)**
- DevOps team: DevOps Engineer agent + SPARC
- Development team: DLT/Frontend/Trading agents + SPARC
- QA team: QA Engineer agent + SPARC
- PM team: Project Manager agent + SPARC
- etc.

**Session 4: Office Hours (Ongoing)**
- Monday & Wednesday: 10 AM - 12 PM
- Tuesday & Thursday: 2 PM - 4 PM
- Drop-in for questions and support

---

### Phase 4: Adoption Tracking

**Metrics Dashboard**:

```bash
# Track adoption with simple metrics

# File: track-sparc-adoption.sh
#!/bin/bash

echo "SPARC Framework Adoption Metrics"
echo "================================="
echo ""

# Count installed instances
installed=$(find /path/to/projects -name ".claude" -type d | wc -l)
echo "Installations: $installed"

# Count SPARC docs created
sparc_docs=$(find /path/to/projects -path "*sparc-docs/*.md" | wc -l)
echo "SPARC Documents Created: $sparc_docs"

# Teams using SPARC (based on Git commits mentioning SPARC)
teams_using=$(git log --all --grep="SPARC" --pretty=format:"%an" | sort -u | wc -l)
echo "Active SPARC Users: $teams_using"

echo ""
echo "Target Adoption: 85%"
echo "Current Adoption: $((installed * 100 / total_projects))%"
```

---

## Organization-Wide Configuration

### Centralized Configuration File

**File**: `.claude/organization-config.json`

```json
{
  "organization": {
    "name": "Aurigraph DLT Corp",
    "domain": "aurigraph.io",
    "contact": {
      "support": "agents@aurigraph.io",
      "slack": "#claude-agents",
      "office_hours": "Mon/Wed 10-12, Tue/Thu 2-4"
    }
  },
  "sparc": {
    "version": "2.0.1",
    "required": true,
    "quality_gates_enforced": true,
    "min_test_coverage": 80,
    "phases": {
      "specification": { "required_approvals": 2 },
      "architecture": { "required_reviews": ["security", "tech-lead"] },
      "refinement": { "min_coverage": 80, "security_scan_required": true },
      "completion": { "required_docs": ["runbook", "api-docs", "user-guide"] }
    }
  },
  "agents": {
    "enabled": "all",
    "custom_agents": []
  },
  "credentials": {
    "vault_url": "https://vault.aurigraph.io:8200",
    "global_credentials_file": "/Users/subbujois/Documents/GitHub/Aurigraph-DLT/doc/Credentials.md"
  },
  "jira": {
    "url": "https://aurigraphdlt.atlassian.net",
    "project": "AAE",
    "board_id": "987",
    "required_labels": ["sparc"],
    "custom_fields": {
      "sparc_phase": "customfield_10050",
      "test_coverage": "customfield_10051",
      "security_score": "customfield_10052"
    }
  },
  "github": {
    "organization": "Aurigraph-DLT-Corp",
    "required_pr_reviews": 2,
    "required_checks": ["tests", "security-scan", "coverage"],
    "sparc_labels": {
      "specification": "sparc:spec",
      "pseudocode": "sparc:pseudo",
      "architecture": "sparc:arch",
      "refinement": "sparc:refine",
      "completion": "sparc:complete"
    }
  },
  "metrics": {
    "enabled": true,
    "dashboard_url": "https://metrics.aurigraph.io/sparc",
    "tracked_metrics": [
      "adoption_rate",
      "time_savings",
      "test_coverage",
      "deployment_success_rate",
      "rework_percentage"
    ]
  },
  "training": {
    "required": true,
    "certification_required": false,
    "materials": {
      "quick_start": ".claude/SPARC_QUICK_START.md",
      "full_guide": ".claude/SPARC.md",
      "examples": ".claude/sparc-examples/",
      "templates": ".claude/sparc-templates/"
    },
    "schedule": {
      "overview": "First Monday of month, 2 PM",
      "workshops": "Every Wednesday, 10 AM",
      "office_hours": "Mon/Wed 10-12, Tue/Thu 2-4"
    }
  }
}
```

---

## Common Distribution Scenarios

### Scenario 1: New Project Setup

```bash
# Developer starting new project
mkdir my-new-project
cd my-new-project

# Initialize Git
git init

# Install SPARC framework
curl -sSL https://install.aurigraph.io/sparc | bash
# or
./install-sparc-framework.sh clone

# Initialize with SPARC template
cp .claude/sparc-templates/skill-development.md sparc-docs/my-feature.md

# Start development with SPARC
# Phase 1: Edit sparc-docs/my-feature.md - Specification section
# Phase 2: Edit sparc-docs/my-feature.md - Pseudocode section
# etc.
```

---

### Scenario 2: Existing Project Migration

```bash
# Existing project
cd /path/to/existing/project

# Add SPARC framework
./install-sparc-framework.sh submodule

# Migrate existing work to SPARC
# 1. Review current state
# 2. Document as SPARC Specification
# 3. Continue with remaining phases

# Update workflows
# - Add SPARC phases to JIRA workflow
# - Update CI/CD to enforce quality gates
# - Add SPARC labels to GitHub
```

---

### Scenario 3: Multi-Repository Organization

**Setup Script for All Repos**:

```bash
#!/bin/bash
# distribute-sparc-to-all-repos.sh

REPOS=(
    "https://github.com/Aurigraph-DLT-Corp/HMS"
    "https://github.com/Aurigraph-DLT-Corp/DLT-Services"
    "https://github.com/Aurigraph-DLT-Corp/ESG-Platform"
    # ... add all repos
)

for REPO in "${REPOS[@]}"; do
    REPO_NAME=$(basename "$REPO" .git)
    echo "Processing: $REPO_NAME"

    # Clone if not exists
    if [ ! -d "$REPO_NAME" ]; then
        git clone "$REPO"
    fi

    # Add SPARC framework as submodule
    cd "$REPO_NAME"
    git checkout -b add-sparc-framework
    git submodule add https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git .claude
    git add .gitmodules .claude
    git commit -m "Add SPARC framework for unified development practices"
    git push -u origin add-sparc-framework

    # Create PR (using gh CLI)
    gh pr create --title "Add SPARC Framework" \
                 --body "Adds SPARC framework for organization-wide unified development practices" \
                 --label "sparc,documentation"

    cd ..
done

echo "✅ SPARC framework added to all repositories!"
echo "👉 Review and merge PRs in each repository"
```

---

## Verification & Health Checks

### Installation Verification Script

**File**: `verify-sparc-installation.sh`

```bash
#!/bin/bash
#
# SPARC Framework Installation Verification
# Run this to verify correct installation

FRAMEWORK_DIR=".claude"
ERRORS=0

echo "======================================"
echo "SPARC Framework Installation Check"
echo "======================================"
echo ""

# Check framework directory
if [ ! -d "$FRAMEWORK_DIR" ]; then
    echo "❌ Framework directory not found: $FRAMEWORK_DIR"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Framework directory exists"
fi

# Check core files
REQUIRED_FILES=(
    "SPARC.md"
    "SPARC_QUICK_START.md"
    "SPARC_AGENT_INTEGRATION.md"
    "CREDENTIALS.md"
    "README.md"
)

for FILE in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$FRAMEWORK_DIR/$FILE" ]; then
        echo "❌ Missing file: $FILE"
        ERRORS=$((ERRORS + 1))
    else
        echo "✅ Found: $FILE"
    fi
done

# Check directories
REQUIRED_DIRS=(
    "agents"
    "sparc-templates"
    "sparc-examples"
    "docs"
    "skills"
)

for DIR in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$FRAMEWORK_DIR/$DIR" ]; then
        echo "❌ Missing directory: $DIR"
        ERRORS=$((ERRORS + 1))
    else
        echo "✅ Found directory: $DIR"
    fi
done

# Check agent files
AGENT_COUNT=$(ls -1 "$FRAMEWORK_DIR/agents/"*.md 2>/dev/null | wc -l)
if [ "$AGENT_COUNT" -lt 11 ]; then
    echo "❌ Expected 11 agents, found $AGENT_COUNT"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ All 11 agents present"
fi

# Check templates
TEMPLATE_COUNT=$(ls -1 "$FRAMEWORK_DIR/sparc-templates/"*.md 2>/dev/null | wc -l)
if [ "$TEMPLATE_COUNT" -lt 5 ]; then
    echo "❌ Expected 5 templates, found $TEMPLATE_COUNT"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ All 5 templates present"
fi

# Summary
echo ""
echo "======================================"
if [ $ERRORS -eq 0 ]; then
    echo "✅ Installation verified successfully!"
    echo "======================================"
    echo ""
    echo "Next steps:"
    echo "1. Read quick start: cat $FRAMEWORK_DIR/SPARC_QUICK_START.md"
    echo "2. Explore agents: ls $FRAMEWORK_DIR/agents/"
    echo "3. Try a template: cp $FRAMEWORK_DIR/sparc-templates/skill-development.md ."
    exit 0
else
    echo "❌ Installation verification failed with $ERRORS errors"
    echo "======================================"
    echo ""
    echo "Please reinstall the framework:"
    echo "  ./install-sparc-framework.sh [method]"
    exit 1
fi
```

---

## Update & Maintenance

### Automated Update Script

**File**: `update-sparc-framework.sh`

```bash
#!/bin/bash
#
# SPARC Framework Update Script
# Keeps framework synchronized with latest version

FRAMEWORK_DIR=".claude"

echo "Updating SPARC Framework..."

cd "$FRAMEWORK_DIR" || exit 1

# Check if it's a Git repository
if [ -d ".git" ]; then
    # Git-based installation
    echo "📦 Pulling latest changes from Git..."
    git fetch origin
    git pull origin main

    if [ $? -eq 0 ]; then
        echo "✅ Framework updated successfully!"

        # Show what changed
        echo ""
        echo "Recent changes:"
        git log -5 --oneline --decorate
    else
        echo "❌ Update failed. Please resolve conflicts manually."
        exit 1
    fi
else
    # Non-Git installation
    echo "⚠️  This is not a Git-based installation"
    echo "Downloading latest version..."

    cd ..
    mv "$FRAMEWORK_DIR" "${FRAMEWORK_DIR}.backup"

    curl -L https://github.com/Aurigraph-DLT-Corp/glowing-adventure/archive/refs/heads/main.zip -o /tmp/sparc-update.zip
    unzip -q /tmp/sparc-update.zip -d /tmp/
    mkdir -p "$FRAMEWORK_DIR"
    cp -r /tmp/glowing-adventure-main/* "$FRAMEWORK_DIR/"
    rm -rf /tmp/sparc-update.zip /tmp/glowing-adventure-main

    echo "✅ Framework updated successfully!"
    echo "Previous version backed up to: ${FRAMEWORK_DIR}.backup"
fi

cd ..

# Verify update
if [ -f "$FRAMEWORK_DIR/SPARC.md" ]; then
    VERSION=$(grep "Version" "$FRAMEWORK_DIR/README.md" | head -1)
    echo ""
    echo "Current version: $VERSION"
    echo ""
    echo "🎯 Review changelog: cat $FRAMEWORK_DIR/CHANGELOG.md"
else
    echo "❌ Update verification failed"
    exit 1
fi
```

---

## Troubleshooting

### Common Issues

**Issue 1: Permission Denied**
```bash
# Fix
chmod +x install-sparc-framework.sh
sudo chown -R $USER:$USER .claude
```

**Issue 2: Git Submodule Issues**
```bash
# Fix
git submodule deinit -f .claude
git rm -f .claude
rm -rf .git/modules/.claude
# Then reinstall
./install-sparc-framework.sh submodule
```

**Issue 3: Credentials Not Found**
```bash
# Verify global credentials file exists
ls -la /Users/subbujois/Documents/GitHub/Aurigraph-DLT/doc/Credentials.md

# If not, check CREDENTIALS.md for correct path
cat .claude/CREDENTIALS.md
```

---

## Support & Resources

### Getting Help

**Slack**: #sparc-framework
- Installation issues
- Usage questions
- Feature requests
- Bug reports

**Email**: agents@aurigraph.io
- General inquiries
- Training requests
- Custom setup assistance

**Office Hours**: Mon/Wed 10-12, Tue/Thu 2-4
- Live support
- 1-on-1 assistance
- Deep-dive sessions

**JIRA**: Project AAE
- Track issues
- Feature requests
- Documentation improvements

### Quick Links

- **Framework Repo**: https://github.com/Aurigraph-DLT-Corp/glowing-adventure
- **Documentation**: See `.claude/README.md`
- **Examples**: See `.claude/sparc-examples/`
- **Templates**: See `.claude/sparc-templates/`

---

## Success Metrics

Track these metrics to measure distribution success:

- ✅ **Installation Rate**: % of teams with framework installed
- ✅ **Usage Rate**: % of projects using SPARC methodology
- ✅ **Training Completion**: % of team members trained
- ✅ **Satisfaction Score**: Team satisfaction (target >4.5/5)
- ✅ **Time Savings**: Hours saved per week
- ✅ **Quality Improvement**: Test coverage increase, bug reduction

---

**Document Status**: ✅ Ready for Distribution
**Last Updated**: October 20, 2025
**Version**: 1.0.0
**Maintained By**: Aurigraph Agent Architecture Team

**Ready to distribute?** Run `./install-sparc-framework.sh` and share with your team!
