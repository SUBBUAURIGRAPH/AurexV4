# GitHub CI/CD Setup Checklist

**Objective**: Configure GitHub Actions for automated HMS deployment
**Status**: Ready to Configure
**Estimated Time**: 30-45 minutes

---

## Phase 1: Prepare SSH Keys (5 minutes)

- [ ] **Check local SSH key**
  ```bash
  cat ~/.ssh/id_rsa
  # Should display your private key starting with -----BEGIN RSA PRIVATE KEY-----
  ```

- [ ] **Or generate new SSH key** (if you don't have one)
  ```bash
  ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
  ```

- [ ] **Verify SSH access to production**
  ```bash
  ssh subbu@hms.aurex.in "echo 'SSH Connection OK'"
  # Should print: SSH Connection OK
  ```

---

## Phase 2: Add GitHub Secrets (10 minutes)

1. **Go to GitHub Repository Settings**
   - URL: `https://github.com/Aurigraph-DLT-Corp/glowing-adventure/settings/secrets/actions`
   - Alternative: Settings → Secrets and variables → Actions

2. **Add these 7 REQUIRED secrets** (click "New repository secret" for each):

   | # | Secret Name | Value | How to Get |
   |---|---|---|---|
   | 1 | `PRODUCTION_SSH_KEY` | Your private SSH key (entire contents) | `cat ~/.ssh/id_rsa` |
   | 2 | `PRODUCTION_HOST` | `hms.aurex.in` | From CREDENTIALS.md |
   | 3 | `PRODUCTION_USER` | `subbu` | From CREDENTIALS.md |
   | 4 | `STAGING_SSH_KEY` | Same as PRODUCTION_SSH_KEY | (Copy from #1) |
   | 5 | `STAGING_HOST` | `hms.aurex.in` | Same as production |
   | 6 | `STAGING_USER` | `subbu` | Same as production |
   | 7 | `SLACK_WEBHOOK` | Your Slack webhook URL | Create at https://api.slack.com/messaging/webhooks |

3. **Optional secrets** (for enhanced security scanning):
   - [ ] `SNYK_TOKEN` - Get from https://app.snyk.io/account/
   - [ ] `SONAR_TOKEN` - Get from https://sonarcloud.io/

✅ **Verification**: Go back to Settings → Secrets → Actions and confirm all 7 secrets are listed

---

## Phase 3: Prepare Server Directories (5 minutes)

SSH to production and set up staging directory:

```bash
# SSH to production
ssh subbu@hms.aurex.in

# Create staging directory
mkdir -p /opt/HMS-staging
cd /opt/HMS-staging

# Clone repository
git clone -b main https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git .

# Copy environment file
cp /opt/HMS/.env .env

# Verify
ls -la

# Exit
exit
```

---

## Phase 4: Test Workflow Triggers (10 minutes)

### Test 1: Push to Develop (Testing Pipeline)

```bash
# Navigate to repository
cd /c/subbuworking/HMS

# Create/switch to develop branch
git checkout -b develop 2>/dev/null || git checkout develop

# Make a test change
echo "# CI/CD Pipeline Test - $(date)" >> README.md

# Commit and push
git add README.md
git commit -m "test: Trigger CI/CD pipeline - test-and-build workflow"
git push -u origin develop
```

**What to expect:**
- ⏱️ **5-10 minutes**: Workflow starts
- 📊 **Workflow: test-and-build.yml** runs
  - Node.js tests (18.x and 20.x)
  - Security scanning
  - Docker build
- 🚀 **Automatic deployment** to staging
- 💬 **Slack notification** when complete

**Monitor Progress:**
1. Go to: https://github.com/Aurigraph-DLT-Corp/glowing-adventure/actions
2. Click the latest workflow run
3. Watch the jobs execute
4. Check Slack for notification

---

### Test 2: Verify Staging Deployment

After workflow completes (check GitHub Actions):

```bash
# SSH to production
ssh subbu@hms.aurex.in

# Check staging containers
docker-compose -f /opt/HMS-staging/docker-compose.yml ps

# Test staging endpoint
curl http://localhost/health

# View logs if needed
docker-compose -f /opt/HMS-staging/docker-compose.yml logs -f
```

**Expected Result**: `HTTP 200` or container logs show no errors

---

### Test 3: Push to Main (Production Deployment)

After staging test passes, create a commit to main:

```bash
# Make sure all changes are committed
git status

# Switch to main
git checkout main

# Make a test change
echo "# Production Ready - $(date)" >> README.md

# Commit and push
git add README.md
git commit -m "feat: Prepare for production deployment"
git push origin main
```

**What to expect:**
- ⏱️ **5 minutes**: test-and-build.yml workflow runs
- ⏱️ **5 minutes**: Staging deployment succeeds
- ⏳ **Workflow pauses**: Waiting for manual approval

---

### Test 4: Approve Production Deployment

```
⚠️ IMPORTANT: Production deployment requires manual approval in GitHub
```

1. Go to: https://github.com/Aurigraph-DLT-Corp/glowing-adventure/actions
2. Click the workflow run (should see it paused after staging)
3. Click **Review deployments**
4. Check the **production** environment
5. Click **Approve and deploy**

**What happens next:**
- ⏱️ **1 minute**: Pre-deployment checks (disk space, DB, Redis)
- ⏱️ **2 minutes**: Deploy containers
- ⏱️ **2 minutes**: Health checks
- ⏱️ **5 minutes**: Monitor deployment stability
- 💬 **Slack notification**: Deployment success/failure

---

## Phase 5: Verify Everything Works (5 minutes)

### Check Production Endpoints

```bash
# Test production URLs
curl https://hms.aurex.in/
curl https://apihms.aurex.in/health

# Both should return HTTP 200
```

### Check Monitoring Stack

```bash
# SSH to production
ssh subbu@hms.aurex.in

# Check monitoring services
docker-compose -f /opt/HMS/monitoring/docker-compose.yml ps

# Access Prometheus
curl http://localhost:9090/-/healthy

# Access Grafana (should be running on port 3001)
curl http://localhost:3001/api/health
```

### Check Slack Notifications

- [ ] Received notification from test-and-build workflow
- [ ] Received notification from staging deployment
- [ ] Received notification from production deployment

---

## Troubleshooting

### Issue: Workflow stuck on "Setup SSH"

**Solution**:
1. Verify SSH key in GitHub secrets (should start with `-----BEGIN RSA PRIVATE KEY-----`)
2. Verify host is correct: `hms.aurex.in`
3. Verify user can SSH locally: `ssh subbu@hms.aurex.in`

### Issue: Staging deployment fails

**Check server**:
```bash
ssh subbu@hms.aurex.in
docker-compose -f /opt/HMS-staging/docker-compose.yml logs
df -h  # Check disk space
```

### Issue: Health checks fail

**Check service**:
```bash
docker-compose -f /opt/HMS-staging/docker-compose.yml ps
curl http://localhost/health
docker logs [container-name]
```

### Issue: Slack notifications not arriving

**Solution**:
1. Verify SLACK_WEBHOOK secret value is correct
2. Test webhook manually:
   ```bash
   curl -X POST \
     -H 'Content-type: application/json' \
     --data '{"text":"Test"}' \
     https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

---

## Success Criteria

✅ All of these should be true:

- [ ] All 7 GitHub secrets added and verified
- [ ] Push to develop triggers test-and-build workflow
- [ ] test-and-build workflow succeeds (tests, security scan, docker build)
- [ ] Staging deployment completes automatically
- [ ] Push to main triggers full pipeline
- [ ] Production deployment requires manual approval
- [ ] After approval, production deployment succeeds
- [ ] Health checks pass
- [ ] Slack notifications received for each stage
- [ ] Production endpoints respond (hms.aurex.in, apihms.aurex.in)

---

## Next Steps (After CI/CD is Working)

1. **Create dedicated Slack channels**:
   - #hms-alerts (for monitoring alerts)
   - #hms-critical-alerts (for critical issues)
   - #hms-deployments (for deployment notifications)

2. **Configure alert routing** in Prometheus
   - Update alertmanager.yml with Slack channels
   - Add PagerDuty integration (optional)

3. **Create runbooks** for the ops team:
   - How to respond to alerts
   - How to trigger manual deployment
   - How to rollback

4. **Schedule team training**:
   - Explain CI/CD pipeline
   - Show how to deploy
   - Practice with staging

5. **Monitor first production deployment**:
   - Watch metrics in Prometheus
   - Check Grafana dashboards
   - Verify no errors in logs

---

## Quick Reference Commands

```bash
# Check workflow status
open "https://github.com/Aurigraph-DLT-Corp/glowing-adventure/actions"

# Manually trigger workflow
# Go to: Actions → Select workflow → Run workflow

# SSH to production
ssh subbu@hms.aurex.in

# Check production deployment
docker-compose -f /opt/HMS/docker-compose.yml ps

# View production logs
docker logs hms-mobile-web

# Check staging
docker-compose -f /opt/HMS-staging/docker-compose.yml ps

# Rollback production
cd /opt/HMS && git checkout HEAD~1 && docker-compose up -d
```

---

## Important Notes

⚠️ **Security**:
- Keep SSH keys secure
- Never commit .env files
- Rotate secrets periodically
- Use environment-specific secrets

⚠️ **Deployment**:
- Always test in staging first
- Staging and production use same server (different directories)
- Manual approval required for production
- Automatic rollback on health check failure

⚠️ **Monitoring**:
- Production metrics visible in Prometheus/Grafana
- Alerts routed to Slack
- Set up on-call rotation

---

**Status**: Ready to Execute
**Contact**: devops@hms.aurex.in
**Support**: See GITHUB_CICD_SETUP_GUIDE.md for detailed instructions

