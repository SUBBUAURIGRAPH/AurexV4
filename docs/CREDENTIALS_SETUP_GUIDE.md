# Credentials Setup Guide

**Version**: 1.0.0
**Last Updated**: October 23, 2025
**Status**: ✅ Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Security Best Practices](#security-best-practices)
3. [Setup Instructions](#setup-instructions)
4. [Credential Types](#credential-types)
5. [Configuration](#configuration)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)
8. [Emergency Procedures](#emergency-procedures)

---

## Overview

The Aurigraph Agents plugin uses environment variables to securely manage credentials for various services:
- **JIRA**: API authentication
- **GitHub**: Repository access
- **Docker**: Registry authentication
- **AWS**: Cloud services
- **Slack**: Bot integration
- **Database**: MongoDB connection
- **Security**: Encryption and JWT tokens

### Why Environment Variables?

✅ **Secure**: Never committed to version control
✅ **Flexible**: Easy to change between environments
✅ **Standard**: Industry best practice
✅ **Auditable**: Easy to track configuration
✅ **Isolated**: Credentials don't mix with code

---

## Security Best Practices

### ❌ Never Do This

```bash
# ❌ DON'T: Commit credentials to git
git add .env
git commit -m "Add JIRA credentials"

# ❌ DON'T: Paste tokens in chat/email
export JIRA_API_KEY=ATATT3xFfGF0c79X44m_ecHcP5d2F...

# ❌ DON'T: Share in unencrypted files
echo "password123" > credentials.txt

# ❌ DON'T: Use in logged output
console.log('JIRA_API_KEY=' + process.env.JIRA_API_KEY);
```

### ✅ Do This Instead

```bash
# ✅ DO: Keep .env in .gitignore (already configured)
# Already in .gitignore: .env, .env.local, .env.*.local

# ✅ DO: Use environment variables
export JIRA_API_KEY="your_token_here"

# ✅ DO: Use credential managers
# 1Password, LastPass, AWS Secrets Manager, etc.

# ✅ DO: Log safely (don't log values)
console.log('JIRA configured:', !!process.env.JIRA_API_KEY);
```

---

## Setup Instructions

### Step 1: Create .env File

```bash
cd /path/to/aurigraph-agents-staging

# Copy example file
cp .env.example .env

# Open and edit
nano .env  # or your preferred editor
```

### Step 2: Verify .gitignore

Check that `.env` is in `.gitignore`:

```bash
cat .gitignore | grep "^\.env"
```

Should output:
```
.env
.env.local
.env.*.local
```

✅ If already there, you're protected!

### Step 3: Add Your Credentials

Edit `.env` and replace placeholders with real values:

```bash
# Example for JIRA
JIRA_API_KEY=ATATT3xFfGF0c79X44m_ecHcP5...  # Your actual token
JIRA_EMAIL=subbu@aurigraph.io

# Example for GitHub
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Example for Docker
DOCKER_REGISTRY_USERNAME=your_docker_user
DOCKER_REGISTRY_PASSWORD=your_docker_password
```

### Step 4: Load in Your Code

The plugin automatically loads credentials via `dotenv`:

```javascript
// In plugin/index.js - already configured!
require('dotenv').config();

// Access credentials
const jiraApiKey = process.env.JIRA_API_KEY;
const jiraEmail = process.env.JIRA_EMAIL;
```

### Step 5: Verify Setup

```bash
# Test credentials loader
cd plugin
npm test credentials-loader.test.js

# Or use the report command
node -e "
const CredentialsLoader = require('./credentials-loader');
const loader = new CredentialsLoader({ verbose: true });
loader.load();
loader.printReport();
"
```

---

## Credential Types

### 1. JIRA Configuration

**Service**: Project management and issue tracking

**Environment Variables**:
```env
JIRA_API_KEY=your_api_token_here
JIRA_EMAIL=your_email@aurigraph.io
JIRA_BASE_URL=https://aurigraph.atlassian.net
```

**How to Generate JIRA API Key**:
1. Log into Atlassian account at https://id.atlassian.com
2. Go to **Security** → **API tokens**
3. Click **Create API token**
4. Copy the generated token immediately (won't be shown again)
5. Add to `.env`

**Features Enabled**:
- ✅ jira-sync skill
- ✅ Issue creation and updates
- ✅ Sprint management
- ✅ Webhook integration

---

### 2. GitHub Configuration

**Service**: Code repository and CI/CD integration

**Environment Variables**:
```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_API_URL=https://api.github.com
```

**How to Generate GitHub Token**:
1. Log into GitHub at https://github.com
2. Go to **Settings** → **Developer settings** → **Personal access tokens**
3. Click **Generate new token (classic)**
4. Select scopes:
   - `repo` - Full control of private repositories
   - `workflow` - Update GitHub Actions workflows
   - `admin:org_hook` - Write access to organization webhooks
5. Copy token immediately (won't be shown again)
6. Add to `.env`

**Features Enabled**:
- ✅ Commit synchronization
- ✅ PR automation
- ✅ Webhook triggers
- ✅ Action workflow updates

---

### 3. Docker Configuration

**Service**: Container registry and orchestration

**Environment Variables**:
```env
DOCKER_HOST=unix:///var/run/docker.sock
DOCKER_REGISTRY_USERNAME=your_registry_user
DOCKER_REGISTRY_PASSWORD=your_registry_password
DOCKER_REGISTRY_URL=docker.io
```

**How to Generate Docker Credentials**:

**For Docker Hub**:
1. Log into Docker Hub at https://hub.docker.com
2. Go to **Account Settings** → **Security**
3. Click **New Access Token**
4. Copy the token
5. Add to `.env`:
   ```env
   DOCKER_REGISTRY_USERNAME=yourusername
   DOCKER_REGISTRY_PASSWORD=your_access_token
   DOCKER_REGISTRY_URL=docker.io
   ```

**For Private Registry** (AWS ECR, Google GCR, etc.):
- Follow your registry's authentication guide
- Add credentials to `.env`

**Features Enabled**:
- ✅ docker-manager skill
- ✅ Image building
- ✅ Registry push/pull
- ✅ Container orchestration

---

### 4. AWS Configuration

**Service**: Cloud infrastructure and services

**Environment Variables**:
```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

**How to Generate AWS Credentials**:
1. Log into AWS Console at https://console.aws.amazon.com
2. Go to **IAM** → **Users** → Select your user
3. **Security credentials** tab → **Create access key**
4. Copy Access Key ID and Secret Access Key immediately
5. Add to `.env`

**⚠️ Security Note**:
- Never commit AWS credentials to git
- Rotate credentials regularly (AWS recommends every 90 days)
- Use IAM roles for EC2 instances instead of credentials
- Enable MFA for AWS account

**Features Enabled**:
- ✅ AWS service integration
- ✅ ECS/EKS deployment
- ✅ CloudWatch monitoring
- ✅ S3 integration

---

### 5. Slack Configuration

**Service**: Team communication and notifications

**Environment Variables**:
```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
```

**How to Generate Slack Credentials**:
1. Go to https://api.slack.com/apps
2. Create new app or select existing
3. Go to **Features** → **OAuth & Permissions**
4. Copy **Bot User OAuth Token** (starts with `xoxb-`)
5. Go to **Settings** → **Basic Information**
6. Copy **Signing Secret**
7. Add to `.env`

**Features Enabled**:
- ✅ Slack notifications
- ✅ Slash commands
- ✅ Message posting
- ✅ Channel integration

---

### 6. Database Configuration

**Service**: MongoDB and data persistence

**Environment Variables**:
```env
MONGODB_URI=mongodb://localhost:27017/aurigraph
MONGODB_USER=your_username
MONGODB_PASSWORD=your_password
```

**How to Set Up MongoDB Connection**:

**Local MongoDB**:
```env
MONGODB_URI=mongodb://localhost:27017/aurigraph
```

**MongoDB Atlas** (Cloud):
1. Go to https://www.mongodb.com/cloud/atlas
2. Create cluster
3. Go to **Database** → **Connect**
4. Choose **Drivers**
5. Copy connection string
6. Add to `.env`:
   ```env
   MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/aurigraph
   ```

**Features Enabled**:
- ✅ Strategy storage
- ✅ Backtest results
- ✅ User data persistence
- ✅ Audit logging

---

### 7. Security Credentials

**Service**: Encryption and JWT authentication

**Environment Variables**:
```env
JWT_SECRET=your_jwt_secret_key_here
ENCRYPTION_KEY=your_encryption_key_here
```

**How to Generate Secure Keys**:

```bash
# Generate JWT Secret (use one)
openssl rand -base64 32

# Generate Encryption Key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use online generator: https://www.grc.com/passwords.htm
```

**Example Setup**:
```env
JWT_SECRET=a7f8h2k9jd8s7f6h5g4j3k2l1m0n9o8p7q6r5s4t3u2v1w0x
ENCRYPTION_KEY=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z
```

**Security Notes**:
- ✅ Generate truly random keys
- ✅ Use different keys per environment
- ✅ Rotate keys periodically
- ✅ Never hardcode in source

---

## Configuration

### Environment-Specific Setup

```bash
# Development (local machine)
cp .env.example .env
# Edit with test/development credentials

# Staging (staging server)
cp .env.example .env.staging
# Edit with staging credentials
export NODE_ENV=staging
source .env.staging

# Production (production server)
cp .env.example .env.production
# Edit with production credentials
export NODE_ENV=production
source .env.production
```

### Using the CredentialsLoader

```javascript
const CredentialsLoader = require('./plugin/credentials-loader');

// Load all credentials
const loader = new CredentialsLoader({ verbose: true });
const credentials = loader.load();

// Get specific service credentials
const jiraConfig = loader.getCredentials('jira');

// Check if service is configured
if (loader.isConfigured('jira')) {
  console.log('JIRA is available');
}

// Get configured services
const services = loader.getConfiguredServices();
console.log('Configured:', services);

// Print report
loader.printReport();
```

### In Plugin Code

```javascript
// plugin/index.js - Already set up with dotenv!

// Access credentials
async initializeJIRA() {
  const jiraConfig = this.credentials.jira;

  if (!jiraConfig.configured) {
    throw new Error('JIRA credentials not configured');
  }

  // Use credentials
  const headers = {
    'Authorization': `Basic ${Buffer.from(
      `${jiraConfig.email}:${jiraConfig.apiKey}`
    ).toString('base64')}`
  };
}
```

---

## Verification

### Check Environment Variables

```bash
# List all Aurigraph-related env vars
env | grep -E "JIRA|GITHUB|DOCKER|AWS|SLACK|MONGODB"

# Check specific variable (don't echo the value!)
if [ -n "$JIRA_API_KEY" ]; then
  echo "✓ JIRA_API_KEY is set"
else
  echo "✗ JIRA_API_KEY is not set"
fi
```

### Test Credentials

```bash
# JavaScript/Node.js test
npm test

# Or use credentials loader directly
node -e "
const Loader = require('./plugin/credentials-loader');
const loader = new Loader({ verbose: true });
loader.load();
loader.printReport();
"

# Python test (if integrated)
python3 -c "import os; print('JIRA:', 'Set' if os.getenv('JIRA_API_KEY') else 'Not Set')"
```

### Test JIRA Connection

```bash
# Test JIRA API (if configured)
curl -H "Authorization: Basic $(echo -n 'email:token' | base64)" \
  https://aurigraph.atlassian.net/rest/api/3/myself
```

### Git Safety Check

```bash
# Verify .env is not tracked
git status | grep -i "\.env"

# Should show nothing (good!)
# Or: "nothing to commit" (good!)

# Double-check ignored files
git check-ignore .env
# Should output: .env (good!)
```

---

## Troubleshooting

### Problem: "Credentials not found" error

**Solution**:
```bash
# 1. Check if .env file exists
ls -la .env
# Should show: -rw-r--r-- 1 user user ...

# 2. Check if .env is loaded
node -e "require('dotenv').config(); console.log('JIRA:', process.env.JIRA_API_KEY ? '✓' : '✗')"

# 3. Verify file permissions
chmod 600 .env  # Only owner can read

# 4. Check syntax in .env
grep "JIRA_API_KEY" .env
```

### Problem: "Invalid JIRA token" error

**Solution**:
```bash
# 1. Verify token format
grep "^JIRA_API_KEY=" .env | head -c 50
# Should show: JIRA_API_KEY=ATATT3xFfGF0c79X...

# 2. Check if token is still valid
# JIRA tokens may expire - generate a new one at:
# https://id.atlassian.com/manage-profile/security/api-tokens

# 3. Verify email format
grep "JIRA_EMAIL=" .env
# Should show: JIRA_EMAIL=user@aurigraph.io
```

### Problem: "MONGODB_URI connection failed"

**Solution**:
```bash
# 1. Test connection string
node -e "
const uri = process.env.MONGODB_URI;
const mongoose = require('mongoose');
mongoose.connect(uri).then(() => {
  console.log('✓ MongoDB connected');
  process.exit(0);
}).catch(err => {
  console.error('✗ MongoDB failed:', err.message);
  process.exit(1);
});
"

# 2. Check credentials in URI
echo "MONGODB_URI=${MONGODB_URI:0:30}..."  # Show first 30 chars

# 3. For MongoDB Atlas, check:
# - Username/password in connection string
# - IP whitelist (https://cloud.mongodb.com/v2)
# - Database name matches
```

### Problem: ".env changes show as unstaged"

**Solution**:
```bash
# This is a git caching issue
git rm --cached .env
git add .gitignore

# Verify
git status
# Should NOT show .env as modified

# Note: This only affects already-committed .env
# If .env was never committed, this won't appear
```

### Problem: "Credentials exposed in git history"

**⚠️ EMERGENCY SITUATION**

See [Emergency Procedures](#emergency-procedures) below.

---

## Emergency Procedures

### If You Accidentally Committed Credentials

**IMMEDIATE ACTIONS (within minutes)**:

1. **Revoke the exposed credentials**:
   - JIRA: https://id.atlassian.com/manage-profile/security/api-tokens → Delete token
   - GitHub: https://github.com/settings/tokens → Delete token
   - AWS: https://console.aws.amazon.com/iam → Deactivate access keys
   - Docker: https://hub.docker.com/settings/security → Delete token
   - Slack: https://api.slack.com/apps → Regenerate secret

2. **Remove from git history**:
   ```bash
   # Option A: Remove most recent commit (if not pushed)
   git reset --soft HEAD~1
   git rm --cached .env
   git add .gitignore
   git commit -m "Remove .env with exposed credentials"

   # Option B: Use git-filter-repo (if already pushed)
   # See: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
   ```

3. **Notify team**:
   - Slack: #security channel
   - Email: security@aurigraph.io
   - Alert: Mention in next standup

4. **Generate new credentials**:
   - Create new JIRA token
   - Create new GitHub token
   - Create new Docker token
   - Rotate AWS keys
   - Update all services

5. **Update .env**:
   ```bash
   nano .env  # Add new credentials
   ```

### If You See Credentials in a PR

1. **Do not merge the PR**
2. **Comment**: "@reviewer - This PR exposes credentials. Please revoke immediately."
3. **Notify security team**
4. **File incident ticket**

### If Someone Else Has Access

1. **Revoke all credentials immediately**
2. **Generate new credentials**
3. **Re-deploy with new credentials**
4. **Audit access logs**
5. **Notify affected services**

---

## Summary

✅ **You are now secure!**

- ✅ `.env` is in `.gitignore` (won't be committed)
- ✅ `CredentialsLoader` handles all service credentials
- ✅ Environment variables are the standard approach
- ✅ You have troubleshooting procedures
- ✅ Emergency procedures documented

### Quick Reference

```bash
# Initial setup (do once)
cp .env.example .env
nano .env  # Add your credentials

# Verify it works
node -e "
const Loader = require('./plugin/credentials-loader');
new Loader({ verbose: true }).load().printReport();
"

# That's it! Plugin auto-loads via dotenv
```

**For help**: #security channel on Slack or agents@aurigraph.io

---

**Version**: 1.0.0
**Last Updated**: October 23, 2025
**Maintained By**: Aurigraph Development Team
**Status**: ✅ Production Ready
