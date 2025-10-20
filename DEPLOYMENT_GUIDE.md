# Aurigraph Agents Plugin - Deployment Guide

**Version**: 1.0.0
**Package**: @aurigraph/claude-agents-plugin
**Repository**: git@github.com:Aurigraph-DLT-Corp/glowing-adventure.git
**Last Updated**: October 20, 2025
**Contact**: subbu@aurigraph.io

---

## 🎯 Overview

This guide covers building and deploying the Aurigraph Agents Plugin for Claude Code. The plugin provides access to 11 specialized AI agents with 68+ skills.

---

## 📋 Pre-Deployment Checklist

Before deploying, ensure:

- [ ] Node.js 18+ installed
- [ ] Git repository access configured
- [ ] NPM account created (for NPM publishing)
- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated with version changes
- [ ] Version number incremented in package.json

---

## 🛠️ Build Process

### Step 1: Validate Plugin

```bash
# From project root
cd /path/to/glowing-adventure

# Run validation
node plugin/scripts/validate-plugin.js
```

**Expected output:**
```
✅ All checks passed!
Plugin is ready for deployment.
```

### Step 2: Build Plugin

```bash
# Build the plugin
bash plugin/scripts/build.sh
```

This will:
- Install dependencies
- Run linting (if configured)
- Validate plugin structure
- Create distribution files

### Step 3: Test Locally

```bash
# Test listing agents
node plugin/index.js list

# Test listing skills
node plugin/index.js skills

# Test invoking an agent
node plugin/index.js invoke devops deploy-wizard "Test deployment"
```

**All tests should pass before proceeding.**

---

## 🚀 Deployment Methods

### Method 1: NPM Publishing (Recommended for Organization-Wide)

**Best for**: Organization-wide distribution, version management

```bash
# 1. Ensure you're logged in to NPM
npm login

# 2. Run deployment script
bash plugin/scripts/deploy-npm.sh
```

The script will:
1. Build the plugin
2. Run tests
3. Confirm publication
4. Publish to NPM registry
5. Display installation instructions

**After Publishing:**
```bash
# Team members can install via:
npm install -g @aurigraph/claude-agents-plugin
```

---

### Method 2: Local Installation (For Testing/Development)

**Best for**: Local testing, development

```bash
# Install locally using npm link
bash plugin/scripts/deploy-local.sh
```

This creates a global symlink to your local development version.

**Usage after local install:**
```bash
node plugin/index.js list
node plugin/index.js invoke <agent> <skill> "task"
```

**To uninstall:**
```bash
npm unlink -g @aurigraph/claude-agents-plugin
```

---

### Method 3: Git Submodule (For Project Integration)

**Best for**: Integrating into specific projects

```bash
# In your project directory
cd /path/to/your/project

# Add as submodule
git submodule add git@github.com:Aurigraph-DLT-Corp/glowing-adventure.git .claude

# Initialize and update
git submodule update --init --recursive

# Commit
git add .gitmodules .claude
git commit -m "Add Aurigraph Agents plugin"
git push
```

**Team members get it via:**
```bash
git clone --recurse-submodules <your-repo-url>
# or for existing clones:
git submodule update --init --recursive
```

---

### Method 4: Direct Clone (Simplest)

**Best for**: Quick start, individual use

```bash
# Clone the repository
git clone git@github.com:Aurigraph-DLT-Corp/glowing-adventure.git

# Navigate to plugin
cd glowing-adventure

# Install dependencies
cd plugin && npm install

# Test it
node index.js list
```

---

### Method 5: ZIP Distribution

**Best for**: Teams without Git access

```bash
# Create distribution ZIP
cd /path/to/glowing-adventure
zip -r aurigraph-agents-plugin-v1.0.0.zip \
  plugin/ \
  agents/ \
  skills/ \
  sparc-templates/ \
  sparc-examples/ \
  *.md \
  -x "*.git*" "node_modules/*"
```

**Share the ZIP via:**
- Email
- Slack
- Shared drive
- Internal file server

**Recipients extract and use:**
```bash
unzip aurigraph-agents-plugin-v1.0.0.zip
cd aurigraph-agents-plugin-v1.0.0
cd plugin && npm install
node index.js list
```

---

## 📧 Sharing with Team

### Email Distribution

See [plugin/SHARING_GUIDE.md](plugin/SHARING_GUIDE.md) for complete email template.

**Quick email:**
```
Subject: 🤖 Aurigraph Agents Plugin Now Available

Hi Team,

The Aurigraph Agents Plugin is now available!

Install: npm install -g @aurigraph/claude-agents-plugin

Or clone: git clone git@github.com:Aurigraph-DLT-Corp/glowing-adventure.git

Documentation: https://github.com/Aurigraph-DLT-Corp/glowing-adventure

Questions? #claude-agents on Slack or agents@aurigraph.io

[Your Name]
```

### Slack Distribution

**Post in #claude-agents:**
```
🎉 *Aurigraph Agents Plugin is Live!*

Install: `npm install -g @aurigraph/claude-agents-plugin`

Or clone: `git clone git@github.com:Aurigraph-DLT-Corp/glowing-adventure.git`

:book: Docs: https://github.com/Aurigraph-DLT-Corp/glowing-adventure
:question: Questions? Ask here!
```

See [plugin/SHARING_GUIDE.md](plugin/SHARING_GUIDE.md) for more templates.

---

## 🔧 Configuration for Production

### Environment Variables

Users need to set these environment variables:

```bash
# JIRA Integration
export JIRA_URL="https://aurigraphdlt.atlassian.net"
export JIRA_API_KEY="<your-jira-api-key>"

# GitHub Integration
export GITHUB_TOKEN="<your-github-token>"

# Hermes Integration (if using)
export HERMES_API_URL="http://localhost:8005"
export HERMES_API_KEY="<your-hermes-api-key>"
```

**Add to ~/.bashrc or ~/.zshrc:**
```bash
echo 'export JIRA_URL="https://aurigraphdlt.atlassian.net"' >> ~/.bashrc
echo 'export JIRA_API_KEY="<your-key>"' >> ~/.bashrc
source ~/.bashrc
```

### Security Best Practices

1. **Never commit API keys** to the repository
2. **Use environment variables** for all credentials
3. **Rotate keys regularly** (every 90 days)
4. **Store keys securely** using Vault or similar
5. **Limit key permissions** to minimum required

See [CREDENTIALS.md](CREDENTIALS.md) for complete security guide.

---

## 📊 Post-Deployment

### Verify Installation

```bash
# Check version
node plugin/index.js --version

# List agents
node plugin/index.js list

# Validate
node plugin/scripts/validate-plugin.js
```

### Monitor Usage

If metrics are enabled in config.json:
- Usage data sent to: https://metrics.aurigraph.io/agents
- Track: agent invocations, success rate, execution time
- Dashboard: (to be created)

### Gather Feedback

1. **Slack**: Monitor #claude-agents channel
2. **Email**: agents@aurigraph.io
3. **JIRA**: Project AAE for issues/features
4. **Surveys**: (optional) Create feedback form

---

## 🔄 Update Process

### For Plugin Maintainers

```bash
# 1. Make changes to plugin code

# 2. Update version in package.json
npm version patch  # 1.0.0 -> 1.0.1
# or
npm version minor  # 1.0.0 -> 1.1.0
# or
npm version major  # 1.0.0 -> 2.0.0

# 3. Update CHANGELOG.md with changes

# 4. Commit changes
git add -A
git commit -m "feat: <description of changes>"

# 5. Push to repository
git push origin main

# 6. Publish new version
bash plugin/scripts/deploy-npm.sh
```

### For Plugin Users

```bash
# Update to latest version
npm update -g @aurigraph/claude-agents-plugin

# Or reinstall
npm uninstall -g @aurigraph/claude-agents-plugin
npm install -g @aurigraph/claude-agents-plugin

# For Git clone users
cd glowing-adventure
git pull origin main
cd plugin && npm install
```

---

## 🆘 Troubleshooting

### Installation Fails

**Problem**: `npm install` fails

**Solutions**:
```bash
# Clear npm cache
npm cache clean --force

# Use specific Node version
nvm use 18

# Install with legacy peer deps
npm install --legacy-peer-deps
```

### Plugin Not Found

**Problem**: Command not found after installation

**Solutions**:
```bash
# Check if installed
npm list -g @aurigraph/claude-agents-plugin

# Check npm global path
npm config get prefix

# Add to PATH if needed
export PATH="$(npm config get prefix)/bin:$PATH"
```

### Permission Errors

**Problem**: EACCES errors during npm install

**Solutions**:
```bash
# Fix npm permissions (preferred)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Or use sudo (not recommended)
sudo npm install -g @aurigraph/claude-agents-plugin
```

### Agent Fails to Execute

**Problem**: Agent invocation fails

**Solutions**:
```bash
# Check credentials are set
echo $JIRA_API_KEY
echo $GITHUB_TOKEN

# Check config
cat plugin/config.json

# Run in verbose mode
export CLAUDE_AGENTS_VERBOSE=true
node plugin/index.js invoke <agent> <skill> "task"
```

---

## 📚 Additional Resources

### Documentation
- **Plugin README**: [plugin/README.md](plugin/README.md)
- **SPARC Framework**: [SPARC.md](SPARC.md)
- **Quick Start**: [SPARC_QUICK_START.md](SPARC_QUICK_START.md)
- **Sharing Guide**: [plugin/SHARING_GUIDE.md](plugin/SHARING_GUIDE.md)
- **Credentials**: [CREDENTIALS.md](CREDENTIALS.md)

### Agents
- **All Agents**: [agents/](agents/) directory
- **DevOps Engineer**: [agents/devops-engineer.md](agents/devops-engineer.md)
- **QA Engineer**: [agents/qa-engineer.md](agents/qa-engineer.md)
- **Project Manager**: [agents/project-manager.md](agents/project-manager.md)

### Skills
- **All Skills**: [skills/](skills/) directory
- **Deploy Wizard**: [skills/deploy-wizard.md](skills/deploy-wizard.md)
- **JIRA Sync**: [skills/jira-sync.md](skills/jira-sync.md)
- **Test Runner**: [skills/test-runner.md](skills/test-runner.md)

### Examples
- **SPARC Examples**: [sparc-examples/](sparc-examples/) directory
- **Deploy Wizard Example**: [sparc-examples/example-deploy-wizard.md](sparc-examples/example-deploy-wizard.md)
- **Bug Fix Example**: [sparc-examples/example-bug-fix.md](sparc-examples/example-bug-fix.md)

### Templates
- **SPARC Templates**: [sparc-templates/](sparc-templates/) directory
- **Skill Development**: [sparc-templates/skill-development.md](sparc-templates/skill-development.md)
- **Feature Implementation**: [sparc-templates/feature-implementation.md](sparc-templates/feature-implementation.md)

---

## 🎓 Training & Support

### Office Hours
- **Monday & Wednesday**: 10 AM - 12 PM
- **Tuesday & Thursday**: 2 PM - 4 PM

### Contact
- **Email**: agents@aurigraph.io
- **Slack**: #claude-agents
- **JIRA**: Project AAE (https://aurigraphdlt.atlassian.net/jira/software/c/projects/AAE/boards/987)
- **GitHub Issues**: https://github.com/Aurigraph-DLT-Corp/glowing-adventure/issues

### Training Sessions
Request training via:
- Slack: #claude-agents
- Email: agents@aurigraph.io
- Schedule: Book office hours slot

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Code reviewed and approved
- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version incremented
- [ ] Security scan completed
- [ ] Credentials properly configured

### Deployment
- [ ] Build successful
- [ ] Local testing completed
- [ ] Published to NPM (if applicable)
- [ ] Repository tagged with version
- [ ] Release notes created

### Post-Deployment
- [ ] Team notified (email + Slack)
- [ ] Installation verified
- [ ] Documentation links working
- [ ] Support channels monitored
- [ ] Feedback collected
- [ ] Metrics dashboard reviewed

---

## 🚀 Deployment Complete!

Your Aurigraph Agents Plugin is now deployed and ready for use.

**Next Steps:**
1. Share with your team using templates in [plugin/SHARING_GUIDE.md](plugin/SHARING_GUIDE.md)
2. Monitor usage and gather feedback
3. Plan improvements based on feedback
4. Schedule regular updates

**Questions?** Contact subbu@aurigraph.io or #claude-agents on Slack

---

**Deployed**: October 20, 2025
**Version**: 1.0.0
**Status**: Production Ready ✅
