# GitHub CI/CD Setup Guide - Step by Step

**Status**: Ready to Configure
**Last Updated**: October 31, 2025

## Overview

This guide walks you through configuring GitHub Actions for automated CI/CD deployment of the HMS Mobile Trading Platform.

### What You'll Do

1. ✅ Generate SSH keys for deployment
2. ✅ Add secrets to GitHub repository
3. ✅ Verify server SSH access
4. ✅ Test workflows with a push to develop branch
5. ✅ Monitor deployment automation

---

## Step 1: Generate SSH Keys for Deployment

### For Production Server (hms.aurex.in)

If you already have SSH access via `ssh subbu@hms.aurex.in`, extract the key pair from your local SSH config:

```bash
# Windows PowerShell
# Check if you have an existing SSH key
ls ~/.ssh/

# If you have id_rsa, read the private key
cat ~/.ssh/id_rsa

# If you don't have one, generate a new key (press Enter for all prompts)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/hms-deploy -N ""
```

### For Staging Server (if creating new)

If you don't have a staging server yet, you have two options:

**Option A: Use Production as Staging** (Recommended for MVP)
- Deploy staging to same server in `/opt/HMS-staging` directory
- Use same SSH key as production (easier to manage)

**Option B: Create New Staging Server**
- Set up separate staging server
- Generate separate SSH key for staging
- Configure in GitHub secrets separately

For this guide, we'll use **Option A** (staging on same server).

---

## Step 2: Add GitHub Secrets

### Access GitHub Repository Settings

1. Go to: `https://github.com/Aurigraph-DLT-Corp/glowing-adventure`
2. Click **Settings** (gear icon)
3. Click **Secrets and variables** → **Actions** (left sidebar)
4. Click **New repository secret**

### Required Secrets to Add

Add each secret by clicking "New repository secret" and filling in:

#### 1. **PRODUCTION_SSH_KEY**
- **Name**: `PRODUCTION_SSH_KEY`
- **Value**: Contents of your private SSH key (copy entire file including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
- **How to get**: `cat ~/.ssh/id_rsa` (Windows) or `cat ~/.ssh/id_rsa` (Linux/Mac)

#### 2. **PRODUCTION_HOST**
- **Name**: `PRODUCTION_HOST`
- **Value**: `hms.aurex.in`

#### 3. **PRODUCTION_USER**
- **Name**: `PRODUCTION_USER`
- **Value**: `subbu`

#### 4. **STAGING_SSH_KEY**
- **Name**: `STAGING_SSH_KEY`
- **Value**: Same as PRODUCTION_SSH_KEY (for staging on same server)

#### 5. **STAGING_HOST**
- **Name**: `STAGING_HOST`
- **Value**: `hms.aurex.in`

#### 6. **STAGING_USER**
- **Name**: `STAGING_USER`
- **Value**: `subbu`

#### 7. **SLACK_WEBHOOK**
- **Name**: `SLACK_WEBHOOK`
- **Value**: Your Slack webhook URL (format: `https://hooks.slack.com/services/YOUR/WEBHOOK/URL`)
- **How to get**: Create a Slack webhook at https://api.slack.com/messaging/webhooks

#### 8. **SNYK_TOKEN** (Optional)
- **Name**: `SNYK_TOKEN`
- **Value**: Your Snyk API token (for security scanning)
- **How to get**: https://app.snyk.io/account/

#### 9. **SONAR_TOKEN** (Optional)
- **Name**: `SONAR_TOKEN`
- **Value**: Your SonarQube token (for code quality)
- **How to get**: https://sonarcloud.io/

---

## Step 3: Verify Secrets Were Added

```bash
# Go to GitHub and verify all 7 required secrets are listed:
# Settings → Secrets and variables → Actions

# Secrets should show:
# ✓ PRODUCTION_SSH_KEY
# ✓ PRODUCTION_HOST
# ✓ PRODUCTION_USER
# ✓ STAGING_SSH_KEY
# ✓ STAGING_HOST
# ✓ STAGING_USER
# ✓ SLACK_WEBHOOK
# ✓ SNYK_TOKEN (optional)
# ✓ SONAR_TOKEN (optional)
```

---

## Step 4: Prepare Staging Directory on Production Server

SSH into production server and create staging directory:

```bash
# SSH to production
ssh subbu@hms.aurex.in

# Create staging directory
mkdir -p /opt/HMS-staging
cd /opt/HMS-staging

# Clone repository
git clone -b main https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git .

# Copy .env file from production
cp /opt/HMS/.env .env

# Verify structure
ls -la
# Should show: docker-compose.yml, mobile/, prometheus-production.yml, etc.

# Exit SSH
exit
```

---

## Step 5: Test Workflows with Push to Develop

The CI/CD pipeline is triggered automatically on:
- Push to `main` branch (triggers full pipeline including production deployment)
- Push to `develop` branch (triggers test & build, staging deployment only)
- Pull requests to `main` or `develop` (triggers test & build)
- Manual trigger via GitHub Actions

### First Test: Push to Develop Branch

```bash
# Create develop branch if it doesn't exist
cd /c/subbuworking/HMS
git branch develop origin/develop 2>/dev/null || git checkout -b develop

# Make a small change to trigger workflow
echo "# Test CI/CD Pipeline" >> README.md

# Commit and push
git add README.md
git commit -m "test: Trigger CI/CD pipeline test"
git push origin develop
```

### Monitor Workflow Execution

1. Go to: `https://github.com/Aurigraph-DLT-Corp/glowing-adventure/actions`
2. Click the latest workflow run (should see your commit message)
3. Watch the progress:
   - ✅ Tests running (Node 18.x and 20.x)
   - ✅ Security scanning
   - ✅ Docker build
   - ✅ Slack notification

### Expected Timeline
- **5 minutes**: Test & Build workflow complete
- **5 minutes**: Staging deployment (if secrets configured correctly)
- **Check Slack**: Notification should appear in your Slack channel

---

## Step 6: Verify Staging Deployment

After workflow completes, verify staging deployment:

```bash
# SSH to server
ssh subbu@hms.aurex.in

# Check staging containers
docker-compose -f /opt/HMS-staging/docker-compose.yml ps

# Should show running containers for HMS app

# Test health endpoint
curl http://localhost/health

# View logs if issues
docker-compose -f /opt/HMS-staging/docker-compose.yml logs -f
```

---

## Step 7: Test Production Deployment (Manual Approval)

Production deployment requires manual approval in GitHub. Only happens when:
1. Push to `main` branch completes successfully
2. Staging deployment succeeds
3. You click "Approve" in GitHub Actions

### Trigger Production Deployment

```bash
# Make a change to main branch
git checkout main
echo "# Production Ready" >> README.md
git add README.md
git commit -m "feat: Prepare for production deployment"
git push origin main
```

### In GitHub Actions

1. Go to: `https://github.com/Aurigraph-DLT-Corp/glowing-adventure/actions`
2. Click the workflow run
3. Wait for staging deployment to complete
4. Click **Review deployments**
5. Select **production** environment
6. Add optional comment: "Deploying production"
7. Click **Approve and deploy**

### Monitor Production Deployment

```bash
# SSH to production
ssh subbu@hms.aurex.in
cd /opt/HMS

# Watch health checks and deployment
watch -n 2 'docker-compose ps'

# View application logs
docker-compose logs -f hms-mobile-web

# Verify endpoints
curl https://hms.aurex.in/
curl https://apihms.aurex.in/health
```

---

## Workflow File Structure

### 1. `.github/workflows/test-and-build.yml`
- **Triggers**: Push to main/develop, PRs
- **Jobs**: Test (Node 18/20), Security Scan, Docker Build, Validation
- **Output**: Docker image pushed to ghcr.io, Slack notification

### 2. `.github/workflows/deploy.yml`
- **Triggers**: Push to main (auto), Manual trigger
- **Stages**:
  1. Deploy to staging (automatic)
  2. Deploy to production (manual approval required)
  3. Rollback on failure (automatic)
- **Checks**: Pre-deployment (disk, DB, Redis), Health checks, Smoke tests

### 3. `.github/workflows/security-and-updates.yml`
- **Triggers**: Daily at 2 AM UTC, Manual trigger
- **Jobs**: Dependency check, Container scan, Code quality, License check, Auto-update

---

## Troubleshooting

### Workflow Fails at "Setup SSH"

**Problem**: `Permission denied (publickey)`

**Solution**:
1. Verify PRODUCTION_SSH_KEY is correct private key
2. Check PRODUCTION_HOST is correct hostname
3. Verify user can SSH: `ssh subbu@hms.aurex.in` works locally

**Check GitHub Secrets**:
- Go to Settings → Secrets
- Verify SSH key starts with `-----BEGIN` and ends with `-----END`
- No extra spaces or line breaks

### Health Checks Failing

**Problem**: Deployment succeeds but health checks fail

**Solution**:
1. Check application health endpoint: `curl http://localhost/health`
2. View container logs: `docker logs hms-mobile-web`
3. Verify port mappings: `docker port hms-mobile-web`
4. Check firewall: `sudo ufw status`

### Slack Notifications Not Arriving

**Problem**: Workflow runs but no Slack message

**Solution**:
1. Verify SLACK_WEBHOOK secret is correct
2. Test webhook manually:
   ```bash
   curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"Test"}' \
     $SLACK_WEBHOOK_URL
   ```
3. Check Slack channel permissions
4. Verify webhook hasn't expired

### Docker Image Build Fails

**Problem**: `docker build` step fails

**Solution**:
1. Check Dockerfile syntax: `docker build -f mobile/Dockerfile .`
2. View build logs in GitHub Actions
3. Verify all dependencies in package.json exist
4. Check Node.js version compatibility

---

## GitHub Actions Secrets Reference

| Secret Name | Value | Required | Example |
|---|---|---|---|
| PRODUCTION_SSH_KEY | Private SSH key (multiline) | ✅ | `-----BEGIN RSA PRIVATE KEY-----...-----END RSA PRIVATE KEY-----` |
| PRODUCTION_HOST | Production hostname | ✅ | `hms.aurex.in` |
| PRODUCTION_USER | SSH username | ✅ | `subbu` |
| STAGING_SSH_KEY | Staging SSH key | ✅ | Same as PRODUCTION_SSH_KEY |
| STAGING_HOST | Staging hostname | ✅ | `hms.aurex.in` |
| STAGING_USER | SSH username for staging | ✅ | `subbu` |
| SLACK_WEBHOOK | Slack webhook URL | ✅ | `https://hooks.slack.com/services/...` |
| SNYK_TOKEN | Snyk API token | ❌ | API token from Snyk |
| SONAR_TOKEN | SonarQube token | ❌ | API token from SonarQube |

---

## Next Steps

1. ✅ Add all GitHub secrets
2. ✅ Push to develop branch to test workflow
3. ✅ Monitor staging deployment
4. ✅ Push to main and approve production deployment
5. ✅ Monitor production deployment and verify health checks

Once confirmed working:
- Set up Slack channel for #hms-alerts
- Configure PagerDuty integration (optional)
- Create runbooks for on-call team
- Train team on deployment process

---

## Quick Reference

### View Workflow Status
```
https://github.com/Aurigraph-DLT-Corp/glowing-adventure/actions
```

### Manually Trigger Workflow
1. Go to Actions tab
2. Select workflow (test-and-build, deploy, etc.)
3. Click "Run workflow"
4. Select branch
5. Click "Run workflow"

### View Deployment Logs
```
https://github.com/Aurigraph-DLT-Corp/glowing-adventure/actions/runs/[RUN_ID]
```

### Rollback Production
```bash
ssh subbu@hms.aurex.in
cd /opt/HMS
git log --oneline -5
git checkout <commit-hash>
docker-compose down && docker-compose up -d
```

---

**Status**: Ready for GitHub Configuration
**Contact**: devops@hms.aurex.in

