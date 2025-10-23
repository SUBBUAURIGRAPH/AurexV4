# Jeeves4Coder Plugin - Build & Deployment Guide

## Overview

This guide covers the complete build and deployment process for the Jeeves4Coder Plugin. The system supports multiple environments (development, staging, production) with automated validation, testing, and deployment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Build Process](#build-process)
4. [Deployment](#deployment)
5. [Docker Deployment](#docker-deployment)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Prerequisites

### System Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Git**: Latest version
- **Docker** (optional, for containerized deployment)
- **Access**: Write access to GitHub repository

### Environment Variables

```bash
# NPM Registry
export NPM_TOKEN=your-npm-token
export INTERNAL_NPM_TOKEN=your-internal-registry-token

# Optional: For CI/CD
export GITHUB_TOKEN=your-github-token
export SLACK_WEBHOOK=your-slack-webhook
```

### Repository Setup

```bash
# Clone repository
git clone https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git
cd glowing-adventure

# Navigate to plugin directory
cd plugin

# Install dependencies
npm install
```

---

## Quick Start

### 5-Minute Setup

```bash
# 1. Install dependencies
cd plugin
npm install

# 2. Run build
npm run build

# 3. Deploy to development
npm run deploy:dev

# Done! ✅
```

### Build Only

```bash
# Build without deployment
npm run build

# Outputs to: dist/
# Generated report: BUILD_REPORT.json
```

### Deploy Only

```bash
# Deploy to specific environment
npm run deploy:dev      # Development
npm run deploy:staging  # Staging
npm run deploy:prod     # Production
```

---

## Build Process

### Overview

The build process consists of these stages:

```
Environment Validation
    ↓
Dependency Validation
    ↓
Linting & Code Quality
    ↓
Testing
    ↓
Build Artifacts
    ↓
Build Validation
    ↓
Report Generation
```

### Running the Build

```bash
# Full build with all validations
npm run build

# Or directly
node scripts/build.js
```

### Build Output

```
dist/
├── jeeves4coder.js
├── jeeves4coder.config.json
├── jeeves4coder-package.json
├── index.js
├── skill-manager.js
├── skill-executor.js
├── skills/
│   ├── hello-world.js
│   ├── file-analyzer.js
│   └── helpers/
└── README.md
```

### Build Configuration

Edit `deployment.config.json` to customize:

```json
{
  "build": {
    "optimization": {
      "minify": true,
      "treeshake": true,
      "compress": true
    },
    "quality": {
      "testing": {
        "minCoverage": 80
      }
    }
  }
}
```

### Build Validation

The build validates:

- ✅ Node.js version >= 18.0.0
- ✅ npm version >= 9.0.0
- ✅ Dependencies installed
- ✅ Code quality (linting)
- ✅ Test coverage >= 80%
- ✅ Critical files present
- ✅ File sizes > 0 bytes

### Build Reports

After each build, a report is generated:

```json
{
  "timestamp": "2024-10-23T10:30:00Z",
  "version": "1.0.0",
  "environment": {
    "node": "v18.17.0",
    "npm": "9.8.1",
    "platform": "linux",
    "arch": "x64"
  },
  "files": [
    {
      "name": "jeeves4coder.js",
      "path": "dist/jeeves4coder.js",
      "size": 15234
    }
  ]
}
```

---

## Deployment

### Deployment Strategies

The system supports multiple deployment strategies:

#### 1. Development Deployment (Local)

```bash
npm run deploy:dev
```

**Features:**
- Local installation
- Registry: `http://localhost:4873` (Verdaccio)
- Publishing: Disabled
- Verification: Enabled
- Environment: Loose constraints

**Usage:**
```bash
# Manual deployment
node scripts/deploy.js dev

# With environment variables
NPM_TOKEN=xxx npm run deploy:dev
```

#### 2. Staging Deployment

```bash
npm run deploy:staging
```

**Features:**
- Staging registry
- Publishing: Enabled
- Verification: Strict
- Environment: Test integrations

**Setup:**
```bash
# Configure staging registry
export NPM_TOKEN=your-staging-token
export INTERNAL_NPM_TOKEN=your-internal-token

npm run deploy:staging
```

#### 3. Production Deployment

```bash
npm run deploy:prod
```

**Features:**
- Production registry
- Full validation
- Version bump
- Release notes
- Rollback capability

**Requirements:**
```bash
# Production requirements
export INTERNAL_NPM_TOKEN=your-production-token
export GITHUB_TOKEN=your-github-token

# Review changes
git status
git log --oneline -5

# Deploy
npm run deploy:prod
```

### Deployment Lifecycle

```
Pre-Deployment Checks
    ↓
Prepare Deployment (Create Backup)
    ↓
Install Dependencies
    ↓
Environment Validation
    ↓
Publish to Registry
    ↓
Verify Deployment
    ↓
Record Deployment
    ↓
Success/Rollback
```

### Pre-Deployment Checklist

Before deploying to production:

- [ ] Code reviewed and approved
- [ ] Tests passing (100%)
- [ ] Build successful
- [ ] No security vulnerabilities
- [ ] Version number updated
- [ ] CHANGELOG updated
- [ ] Git commit ready
- [ ] Environment variables configured

```bash
# Quick checklist
npm test
npm run build
npm run security:audit
git status
```

### Rollback Procedure

If deployment fails:

```bash
# View backups
ls -la .backups/

# Rollback to previous version
npm run rollback

# Or manually
npm install @aurigraph/jeeves4coder-plugin@<previous-version>
```

---

## Docker Deployment

### Building Docker Image

```bash
# Build image
docker build -t jeeves4coder-plugin:1.0.0 .

# Tag for registry
docker tag jeeves4coder-plugin:1.0.0 ghcr.io/aurigraph/jeeves4coder-plugin:1.0.0

# Push to registry
docker push ghcr.io/aurigraph/jeeves4coder-plugin:1.0.0
```

### Running Container

```bash
# Basic run
docker run -it jeeves4coder-plugin:1.0.0

# With configuration
docker run -it \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  -v /path/to/config:/app/config \
  jeeves4coder-plugin:1.0.0

# With port mapping
docker run -it \
  -p 3000:3000 \
  jeeves4coder-plugin:1.0.0
```

### Docker Compose

```yaml
version: '3.8'

services:
  jeeves4coder:
    image: ghcr.io/aurigraph/jeeves4coder-plugin:1.0.0
    container_name: jeeves4coder-plugin
    environment:
      NODE_ENV: production
      LOG_LEVEL: info
    ports:
      - "3000:3000"
    volumes:
      - ./config:/app/config
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "console.log('healthy')"]
      interval: 30s
      timeout: 3s
      retries: 3
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jeeves4coder-plugin
  namespace: aurigraph-plugins
spec:
  replicas: 3
  selector:
    matchLabels:
      app: jeeves4coder-plugin
  template:
    metadata:
      labels:
        app: jeeves4coder-plugin
    spec:
      containers:
      - name: jeeves4coder-plugin
        image: ghcr.io/aurigraph/jeeves4coder-plugin:1.0.0
        imagePullPolicy: IfNotPresent
        env:
        - name: NODE_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        ports:
        - containerPort: 3000
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          exec:
            command:
            - node
            - -e
            - console.log('healthy')
          initialDelaySeconds: 5
          periodSeconds: 30
```

---

## CI/CD Pipeline

### GitHub Actions

The repository includes automated CI/CD pipeline (`.github/workflows/build-and-deploy.yml`):

#### Workflows

**1. On Push to develop → Deploy to Development**
```
Validate → Build → Test → Deploy (dev)
```

**2. On Push to staging → Deploy to Staging**
```
Validate → Build → Test → Docker Build → Deploy (staging)
```

**3. On Push to main → Deploy to Production**
```
Validate → Build → Test → Docker Build → Deploy (prod) → Release
```

#### Triggering Manually

```bash
# Trigger via GitHub CLI
gh workflow run build-and-deploy.yml -f environment=prod

# Or via GitHub UI
# Actions → Build and Deploy → Run workflow
```

#### Environment Secrets

Configure in GitHub Repository Settings → Secrets:

```
NPM_TOKEN              # npm registry token
INTERNAL_NPM_TOKEN     # Internal registry token
SLACK_WEBHOOK         # Slack notifications (optional)
GITHUB_TOKEN          # (auto-provided by GitHub)
```

### Pipeline Status

View pipeline status:

```bash
# GitHub CLI
gh run list
gh run view <run-id>

# Or check: Actions tab in GitHub UI
```

---

## Troubleshooting

### Common Issues

#### 1. Build Fails - Node Version

```
Error: Node.js 18.0.0+ required, found v16.x.x
```

**Solution:**
```bash
# Update Node.js
nvm install 18
nvm use 18
node --version  # Should be v18.x.x
```

#### 2. Dependencies Not Installing

```
npm ERR! 404 Not Found - GET
```

**Solution:**
```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### 3. Deployment Fails - Registry Access

```
Error: 403 Forbidden
```

**Solution:**
```bash
# Check npm token
npm config set //npm.aurigraph.io/:_authToken=$NPM_TOKEN

# Verify token
npm whoami --registry https://npm.aurigraph.io

# Try deployment again
npm run deploy:staging
```

#### 4. Tests Failing

```
FAIL  jeeves4coder.test.js
```

**Solution:**
```bash
# Run tests in verbose mode
npm test -- --verbose

# Check coverage
npm test -- --coverage

# Fix issues and retry
npm run build
```

#### 5. Docker Build Fails

```
Error: COPY failed: file not found
```

**Solution:**
```bash
# Ensure files exist
ls -la jeeves4coder.js
ls -la skills/

# Check Dockerfile path
cat Dockerfile

# Rebuild
docker build -t jeeves4coder-plugin:1.0.0 .
```

### Debug Mode

Enable verbose logging:

```bash
# Build with debug
DEBUG=* npm run build

# Deploy with debug
DEBUG=* npm run deploy:staging

# Check logs
tail -f .deployment-logs/*.json
```

### Getting Help

1. Check `BUILD_REPORT.json` for details
2. Review `.deployment-logs/` directory
3. Check GitHub Actions logs
4. Contact: agents@aurigraph.io

---

## Best Practices

### 1. Always Build Before Deploy

```bash
# Don't skip the build
npm run build && npm run deploy:staging
```

### 2. Use Semantic Versioning

```json
{
  "version": "1.0.0"
}
```

- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes

### 3. Keep Backups

```bash
# Automatic backups are created
ls -la .backups/

# Manual backup
cp -r dist/ dist.backup.$(date +%s)
```

### 4. Test Before Production

```bash
# Test progression
npm run build          # Local
npm run deploy:dev     # Development
npm run deploy:staging # Staging
npm run deploy:prod    # Production (Only after staging success)
```

### 5. Monitor Deployments

```bash
# Check deployment logs
tail -f .deployment-logs/*

# Monitor in GitHub Actions
gh run watch <run-id>

# Check registry
npm info @aurigraph/jeeves4coder-plugin
```

### 6. Document Changes

```bash
# Update CHANGELOG before release
echo "## [1.0.0] - 2024-10-23" >> CHANGELOG.md
echo "- New feature" >> CHANGELOG.md

# Commit changes
git add .
git commit -m "Release v1.0.0"
```

### 7. Security Checks

```bash
# Run security audit
npm audit
npm audit fix

# Check for vulnerabilities
npm run security:audit

# Scan dependencies
npm run security:scan
```

### 8. Performance Monitoring

```bash
# Check build artifacts size
du -sh dist/

# Monitor deployment time
time npm run deploy:staging

# View metrics
cat BUILD_REPORT.json | grep -E "timestamp|version|size"
```

---

## Scripts Reference

### Available npm Scripts

```bash
npm run build              # Full build with validation
npm run deploy:dev         # Deploy to development
npm run deploy:staging     # Deploy to staging
npm run deploy:prod        # Deploy to production
npm test                   # Run tests
npm run lint               # Lint code
npm run security:audit     # Security audit
npm run security:scan      # Dependency scan
npm run setup              # Setup plugin
npm run verify             # Verify installation
npm run review:example     # Run example review
```

### Manual Script Execution

```bash
# Build with custom options
node scripts/build.js --verbose

# Deploy to environment
node scripts/deploy.js staging

# Validate plugin
node scripts/validate-plugin.js

# Post-install setup
node scripts/post-install.js
```

---

## Production Checklist

Before releasing to production:

- [ ] All tests passing
- [ ] Code reviewed
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] Version number bumped
- [ ] Git tags created
- [ ] Release notes prepared
- [ ] Monitoring configured
- [ ] Rollback plan in place

```bash
# Final pre-release checks
npm test
npm run security:audit
npm run build
git status
cat CHANGELOG.md
```

---

## Support & Contact

- **Email**: agents@aurigraph.io
- **Slack**: #aurigraph-agents
- **GitHub Issues**: https://github.com/Aurigraph-DLT-Corp/glowing-adventure/issues

---

## Version History

| Version | Date | Status |
|---------|------|--------|
| 1.0.0 | 2024-10-23 | Production Ready |

---

**Last Updated**: October 23, 2024
**Maintained By**: Aurigraph Development Team
