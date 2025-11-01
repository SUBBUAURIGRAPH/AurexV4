# HMS CI/CD Pipeline Setup

**Version**: 1.0.0
**Date**: October 31, 2025
**Status**: ✅ Production Ready

## Overview

Complete CI/CD automation for HMS Mobile Trading Platform with:
- **Automated Testing**: Unit, integration, and E2E tests
- **Security Scanning**: Dependency, container, and code security
- **Docker Builds**: Multi-platform image building
- **Deployment Automation**: Staging and production deployments
- **Monitoring**: Pre and post-deployment health checks

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                  GitHub Actions Workflows                 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Push to main/develop                                      │
│  │                                                          │
│  ├─→ test-and-build.yml                                    │
│  │   ├─ Run Tests (Node 18.x, 20.x)                        │
│  │   ├─ Security Scanning (Trivy, Snyk)                    │
│  │   ├─ Docker Build & Push                                │
│  │   ├─ Validate Deployment Config                         │
│  │   └─ Notify Status (Slack)                              │
│  │                                                          │
│  └─→ security-and-updates.yml (Scheduled Daily)            │
│      ├─ Dependency Check                                   │
│      ├─ Container Scanning                                 │
│      ├─ Code Quality Analysis                              │
│      ├─ License Check                                      │
│      ├─ Auto-update Dependencies (Create PR)               │
│      └─ Notify Results                                     │
│                                                            │
│  Manual Approval for Production                            │
│  │                                                          │
│  └─→ deploy.yml                                            │
│      ├─ Deploy to Staging                                  │
│      ├─ Smoke Tests                                        │
│      ├─ Wait for Approval                                  │
│      ├─ Deploy to Production                               │
│      ├─ Health Checks                                      │
│      ├─ Monitor Deployment (5 min)                         │
│      └─ Rollback on Failure                                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Workflows

### 1. Test & Build Workflow

**File**: `.github/workflows/test-and-build.yml`

**Triggers**:
- Push to `main` or `develop` branch
- Pull requests to `main` or `develop`
- Manual trigger

**Jobs**:

1. **Test Job**
   - Runs on: Ubuntu Latest
   - Node versions: 18.x, 20.x (matrix)
   - Steps:
     - Checkout code
     - Setup Node.js
     - Install dependencies
     - Run linting (ESLint)
     - Run unit tests with coverage
     - Run integration tests
     - Upload coverage to Codecov

2. **Security Scan Job**
   - Trivy filesystem scan (SARIF output)
   - npm audit for vulnerabilities
   - Snyk security scan
   - Results uploaded to GitHub Security

3. **Docker Build Job**
   - Set up Docker Buildx
   - Login to GitHub Container Registry (ghcr.io)
   - Extract metadata (tags, labels)
   - Build and push Docker image
   - Layer caching for faster builds

4. **Deployment Validation Job**
   - Validate docker-compose syntax
   - Check monitoring stack configuration
   - Verify required environment variables
   - Alert rules validation

5. **Notification Job**
   - Collect all job results
   - Send Slack notification
   - Comment on PR with status

**Example Output**:
```
✅ All checks passed
- Tests: PASS (both Node versions)
- Security Scan: PASS
- Docker Build: PASS
- Deployment Validation: PASS

Docker image: ghcr.io/Aurigraph-DLT-Corp/HMS/hms-mobile-web:main
Ready for review and deployment.
```

### 2. Deployment Workflow

**File**: `.github/workflows/deploy.yml`

**Triggers**:
- Push to `main` branch (changes to mobile/, docker-compose.yml, prometheus, workflows)
- Manual trigger with environment selection

**Deployment Stages**:

**Stage 1: Deploy to Staging**
- SSH connection to staging server
- Git pull latest code
- Docker image pull
- Container stop/start
- Health checks
- Smoke tests (HTTP/HTTPS endpoints)
- Slack notification

**Stage 2: Deploy to Production**
- Wait for manual approval
- Pre-deployment checks:
  - Disk space verification
  - Database connectivity
  - Redis connectivity
  - API health checks
- Deploy:
  - Create backup of current state
  - Git pull latest
  - Stop containers gracefully
  - Start new containers
  - Health check polling (30 attempts, 2s interval)
  - Rollback if health checks fail
- Smoke tests (with retries)
- Monitor deployment for 5 minutes
- Slack notification with deployment details

**Stage 3: Rollback on Failure**
- Automatic rollback to previous commit
- Restart containers with previous version
- Verify rollback success
- Slack notification of rollback

**Deployment Variables**:
```
STAGING_SSH_KEY: Private SSH key for staging server
STAGING_HOST: Staging server hostname
STAGING_USER: SSH user for staging
PRODUCTION_SSH_KEY: Private SSH key for production
PRODUCTION_HOST: Production server hostname
PRODUCTION_USER: SSH user for production
SLACK_WEBHOOK: Slack webhook for notifications
```

### 3. Security & Updates Workflow

**File**: `.github/workflows/security-and-updates.yml`

**Triggers**:
- Scheduled daily at 2 AM UTC
- Manual trigger
- Push to package.json, Dockerfile, etc.

**Jobs**:

1. **Dependency Check**
   - npm audit (production dependencies)
   - OWASP Dependency-Check
   - SARIF upload to GitHub Security

2. **Container Scanning**
   - Trivy container image scan
   - Anchore Grype scanner
   - Severity filtering (CRITICAL, HIGH)

3. **Code Quality**
   - ESLint analysis
   - SonarQube scanner
   - Code complexity analysis

4. **License Check**
   - license-checker for compliance
   - Generate license report
   - Verify no GPL licenses

5. **Update Dependencies** (Scheduled only)
   - npm update (patch and minor versions)
   - npm audit fix for security patches
   - Create Pull Request with changes
   - Assign reviewers

6. **Security Alert Processing**
   - Check GitHub security alerts
   - Create issues for vulnerabilities
   - Notify team

7. **Results Notification**
   - Aggregate all scan results
   - Slack notification with summary
   - Email for critical issues

**Example Results**:
```
🔒 Security Scan Complete
- Dependency Check: PASS
- Container Scan: PASS
- Code Quality: PASS
- License Check: PASS
```

## Setup Instructions

### 1. Configure Secrets

Add these secrets to GitHub repository settings:

**SSH Keys & Credentials**:
```
STAGING_SSH_KEY: (private key for staging server)
STAGING_HOST: staging-hms.aurex.in
STAGING_USER: deploy

PRODUCTION_SSH_KEY: (private key for production server)
PRODUCTION_HOST: hms.aurex.in
PRODUCTION_USER: subbu
```

**Container Registry**:
```
Automatically uses GitHub token (GITHUB_TOKEN)
Container registry: ghcr.io
```

**Notifications**:
```
SLACK_WEBHOOK: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SNYK_TOKEN: (optional - for Snyk scanning)
SONAR_TOKEN: (optional - for SonarQube)
```

### 2. Set Up Staging/Production Servers

**On each server**:
```bash
# Create deploy user (if using separate account)
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy

# Add SSH public key
sudo -u deploy mkdir -p ~/.ssh
echo "your-public-key" | sudo -u deploy tee ~/.ssh/authorized_keys
sudo -u deploy chmod 700 ~/.ssh
sudo -u deploy chmod 600 ~/.ssh/authorized_keys

# Create deployment directory
sudo mkdir -p /opt/HMS
sudo chown deploy:deploy /opt/HMS
cd /opt/HMS

# Clone repository
git clone https://github.com/Aurigraph-DLT-Corp/HMS.git .

# Create .env file
cat > .env << EOF
POSTGRES_PASSWORD=secure_password
REDIS_PASSWORD=secure_password
GRAFANA_PASSWORD=secure_password
EOF

chmod 600 .env
```

### 3. Environment Variables

Create `.env` file in project root:
```bash
# Application
NODE_ENV=production
LOG_LEVEL=info

# Database
POSTGRES_DB=hms
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password

# Cache
REDIS_PASSWORD=your_secure_password

# Monitoring
GRAFANA_PASSWORD=your_secure_password
GRAFANA_EMAIL=ops@hms.aurex.in

# Alerts (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
PAGERDUTY_SERVICE_KEY=...
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your_app_password
```

### 4. Deploy Workflows

Workflows are automatically enabled when `.github/workflows/` files exist.

**To trigger manually**:
1. Go to GitHub repository
2. Click "Actions" tab
3. Select workflow
4. Click "Run workflow"
5. Select branch/environment
6. Click "Run workflow"

## Monitoring Deployments

### Real-time Status

**GitHub Actions**:
- Go to "Actions" tab in GitHub
- View workflow run status
- Check logs for each job

**Slack Notifications**:
- Test results
- Build status
- Deployment notifications
- Rollback alerts

**Dashboard**:
- Monitor container health
- Check API endpoint status
- Track error rates

## Pre-deployment Checklist

- [ ] All tests passing
- [ ] Security scan passed
- [ ] Code review approved
- [ ] Docker image built successfully
- [ ] Deployment configuration validated
- [ ] Monitoring stack running
- [ ] Backup created (manual)
- [ ] Team notified
- [ ] Runbook available

## Rollback Procedures

**Automatic Rollback**:
- Triggered if post-deployment health checks fail
- Reverts to previous git commit
- Containers restarted with previous version
- Slack notification sent

**Manual Rollback**:
```bash
# SSH to production
ssh deploy@hms.aurex.in

# Navigate to project
cd /opt/HMS

# Check git history
git log --oneline -5

# Revert to previous commit
git checkout <commit-hash>

# Restart containers
docker-compose down
docker-compose up -d

# Verify health
curl http://localhost/health
```

## Performance Optimization

### Faster Builds

- Cache Docker layers using buildx
- Cache npm dependencies in Actions
- Parallel job execution
- Skip unnecessary steps (conditionals)

### Faster Tests

- Run tests in parallel (multiple Node versions)
- Skip slow tests in CI (flag with `@slow`)
- Use smaller datasets for integration tests

## Troubleshooting

### Deployment Fails

1. Check workflow logs in GitHub Actions
2. Verify SSH keys are correct
3. Check server connectivity: `ssh deploy@server`
4. Review pre-deployment checks
5. Check server disk space: `df -h`
6. Check container logs: `docker logs <container>`

### Health Checks Failing

1. SSH to server
2. Test endpoint manually: `curl http://localhost/health`
3. Check container status: `docker ps`
4. View container logs: `docker logs <container>`
5. Check firewall: `sudo ufw status`
6. Check ports: `netstat -tlnp | grep LISTEN`

### Security Scan False Positives

1. Review Trivy results
2. Add `.trivyignore` file for acceptable risks
3. Update vulnerability database: `trivy image --download-db-only`
4. Document exception with rationale

## Best Practices

### 1. Commit Messages

```
feat: Add new feature
fix: Fix bug
docs: Update documentation
chore: Maintenance tasks
test: Add/update tests
perf: Performance improvements

Example:
feat: Add order validation to trading engine
- Implement comprehensive order validation
- Add unit tests (45 test cases)
- Update documentation
```

### 2. Branch Strategy

- `main`: Production-ready code
- `develop`: Development branch
- `feature/*`: Feature branches
- Merge via Pull Request with reviews

### 3. Testing

- Write tests for all new features
- Maintain 80%+ code coverage
- Test both happy path and error cases
- Include performance tests for critical paths

### 4. Monitoring

- Monitor all workflow runs
- Review failed builds immediately
- Track build time trends
- Optimize slow tests

## Integration with Monitoring

CI/CD pipeline integrates with monitoring stack:
- Deployment events sent to Prometheus
- Health checks use monitoring stack
- Alerts configured for deployment failures
- Rollback events trigger alerts

## Support

**Workflow Documentation**:
- GitHub Actions Docs: https://docs.github.com/en/actions
- act (Local Testing): https://github.com/nektos/act

**Contact**: devops@hms.aurex.in

---

**Next Steps**:
1. Add secrets to GitHub repository
2. Configure staging/production servers
3. Enable workflows
4. Test with staging deployment
5. Create runbooks for team
6. Train team on CI/CD process

**See Also**:
- [MONITORING_SETUP.md](MONITORING_SETUP.md) - Prometheus/Grafana setup
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Manual deployment procedures
- [README.md](README.md) - Project overview
