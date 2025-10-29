# J4C Agent Plugin - Complete Deployment Guide

**Version**: 1.0.0
**Release Date**: October 27, 2025
**Status**: Production Ready

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Deployment Options](#deployment-options)
4. [Traditional SSH Deployment](#traditional-ssh-deployment)
5. [Docker Deployment](#docker-deployment)
6. [Configuration](#configuration)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)
9. [Monitoring](#monitoring)
10. [Rollback](#rollback)

---

## Quick Start

### Using Deployment Script (Recommended)

```bash
# Make script executable
chmod +x deploy-j4c-agent.sh

# Deploy to staging environment
./deploy-j4c-agent.sh staging yogesh dev.aurigraph.io 2224

# Or deploy to production
./deploy-j4c-agent.sh production yogesh prod.aurigraph.io 2224
```

### Manual Steps

```bash
# 1. Build locally
cd plugin
npm install
npm run validate

# 2. Create package (already done)
# j4c-agent-plugin-1.0.0.tar.gz

# 3. Upload and deploy (see SSH Deployment section)
```

---

## Prerequisites

### Local Machine (Build Server)

- Node.js >= 18.0.0
- npm >= 9.0.0
- git
- tar/gzip utilities
- SSH client
- SCP client

**Verification**:
```bash
node --version      # v18.0.0 or higher
npm --version       # 9.0.0 or higher
ssh -V              # OpenSSH version
```

### Remote Server (Target)

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git
- curl (for health checks)
- sudo access (for systemd)
- SSH server with port 2224 (default)
- 1GB disk space minimum
- 512MB RAM minimum

**Server Info**:
- **Host**: dev.aurigraph.io (staging) or prod.aurigraph.io (production)
- **Port**: 2224
- **User**: yogesh
- **Installation Directory**: /opt/j4c-agent

---

## Deployment Options

### Option 1: Automated SSH Deployment (Recommended)

**Best for**: Most deployments, CI/CD pipelines

```bash
./deploy-j4c-agent.sh <environment> [user] [host] [port]
```

**Advantages**:
- ✅ Automated backup creation
- ✅ Dependency installation
- ✅ Systemd service setup
- ✅ Health checks
- ✅ Rollback support

### Option 2: Docker Deployment

**Best for**: Container-based infrastructure, Kubernetes

```bash
# Build Docker image
docker build -f Dockerfile.j4c -t aurigraph/j4c-agent:1.0.0 .

# Push to registry
docker push ghcr.io/aurigraph/j4c-agent:1.0.0

# Run container
docker run -d \
  --name j4c-agent \
  -p 9003:9003 \
  --env-file .env \
  aurigraph/j4c-agent:1.0.0
```

### Option 3: Manual Deployment

**Best for**: Custom environments, special configurations

See [Traditional SSH Deployment](#traditional-ssh-deployment) section.

---

## Traditional SSH Deployment

### Step 1: Prepare Package

```bash
# Verify package exists
ls -lh j4c-agent-plugin-1.0.0.tar.gz

# Check package contents
tar -tzf j4c-agent-plugin-1.0.0.tar.gz | head -20
```

### Step 2: Upload to Remote

```bash
# Using SCP
scp -P 2224 j4c-agent-plugin-1.0.0.tar.gz yogesh@dev.aurigraph.io:/tmp/

# Or using rsync
rsync -avz -e "ssh -p 2224" j4c-agent-plugin-1.0.0.tar.gz yogesh@dev.aurigraph.io:/tmp/
```

### Step 3: Extract on Remote

```bash
ssh -p 2224 yogesh@dev.aurigraph.io << 'EOF'
# Create directory
sudo mkdir -p /opt/j4c-agent
sudo chown yogesh:yogesh /opt/j4c-agent

# Backup existing (if any)
if [ -d /opt/j4c-agent/index.js ]; then
  sudo cp -r /opt/j4c-agent /opt/j4c-agent.backup.$(date +%s)
fi

# Extract package
cd /tmp
tar -xzf j4c-agent-plugin-1.0.0.tar.gz
cp -r plugin/* /opt/j4c-agent/
EOF
```

### Step 4: Install Dependencies

```bash
ssh -p 2224 yogesh@dev.aurigraph.io << 'EOF'
cd /opt/j4c-agent
npm install --production
EOF
```

### Step 5: Configure Environment

```bash
# Create .env file
cat > /tmp/.env << 'EOF'
HUBSPOT_API_KEY=your_api_key
HUBSPOT_PORTAL_ID=your_portal_id
CLAUDE_CODE_API_URL=http://localhost:9000
CLAUDE_CODE_API_KEY=your_api_key
JIRA_URL=https://aurigraphdlt.atlassian.net
JIRA_API_KEY=your_api_key
GITHUB_TOKEN=your_token
SLACK_WEBHOOK_URL=your_webhook
NODE_ENV=production
EOF

# Upload to remote
scp -P 2224 /tmp/.env yogesh@dev.aurigraph.io:/opt/j4c-agent/.env

# Set permissions
ssh -p 2224 yogesh@dev.aurigraph.io "chmod 600 /opt/j4c-agent/.env"
```

### Step 6: Setup Systemd Service

```bash
# Create systemd service file
cat > /tmp/j4c-agent.service << 'EOF'
[Unit]
Description=J4C Agent Plugin Service
After=network.target

[Service]
Type=simple
User=yogesh
WorkingDirectory=/opt/j4c-agent
Environment="NODE_ENV=production"
EnvironmentFile=/opt/j4c-agent/.env
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Upload and install
ssh -p 2224 yogesh@dev.aurigraph.io << 'EOF'
sudo cp /tmp/j4c-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable j4c-agent
EOF
```

### Step 7: Start Service

```bash
ssh -p 2224 yogesh@dev.aurigraph.io "sudo systemctl start j4c-agent"
```

---

## Docker Deployment

### Build Docker Image

```bash
# Build from project root
docker build -f Dockerfile.j4c -t aurigraph/j4c-agent:1.0.0 .

# Build with build arguments
docker build \
  -f Dockerfile.j4c \
  --build-arg NODE_VERSION=18-alpine \
  -t aurigraph/j4c-agent:1.0.0 \
  .
```

### Run Docker Container

```bash
# Basic run
docker run -d \
  --name j4c-agent \
  -p 9003:9003 \
  --env-file .env \
  aurigraph/j4c-agent:1.0.0

# With volume mounts
docker run -d \
  --name j4c-agent \
  -p 9003:9003 \
  -v /etc/j4c-agent/.env:/app/.env \
  -v /var/log/j4c-agent:/app/logs \
  --env-file .env \
  aurigraph/j4c-agent:1.0.0

# With resource limits
docker run -d \
  --name j4c-agent \
  -p 9003:9003 \
  -m 512m \
  --cpus="0.5" \
  --env-file .env \
  aurigraph/j4c-agent:1.0.0
```

### Push to Registry

```bash
# Tag for registry
docker tag aurigraph/j4c-agent:1.0.0 ghcr.io/aurigraph/j4c-agent:1.0.0

# Login to registry
docker login ghcr.io

# Push image
docker push ghcr.io/aurigraph/j4c-agent:1.0.0
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: j4c-agent
  namespace: aurigraph
spec:
  replicas: 3
  selector:
    matchLabels:
      app: j4c-agent
  template:
    metadata:
      labels:
        app: j4c-agent
    spec:
      containers:
      - name: j4c-agent
        image: ghcr.io/aurigraph/j4c-agent:1.0.0
        ports:
        - containerPort: 9003
          name: api
        env:
        - name: NODE_ENV
          value: production
        envFrom:
        - configMapRef:
            name: j4c-config
        - secretRef:
            name: j4c-secrets
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 9003
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 9003
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: j4c-agent
  namespace: aurigraph
spec:
  selector:
    app: j4c-agent
  ports:
  - protocol: TCP
    port: 80
    targetPort: 9003
  type: ClusterIP
```

---

## Configuration

### Environment Variables

Required for operation:

```bash
# HubSpot CRM Integration
HUBSPOT_API_KEY=your_hubspot_private_app_token
HUBSPOT_PORTAL_ID=your_portal_id

# Claude Code Integration
CLAUDE_CODE_API_URL=http://localhost:9000
CLAUDE_CODE_API_KEY=your_api_key

# JIRA Integration
JIRA_URL=https://aurigraphdlt.atlassian.net
JIRA_API_KEY=your_jira_api_key

# GitHub Integration
GITHUB_TOKEN=your_github_token

# Slack Integration
SLACK_WEBHOOK_URL=your_slack_webhook
SLACK_WEBHOOK_HUBSPOT=your_hubspot_slack_webhook

# Email Notifications
NOTIFICATION_EMAIL=your_email@example.com
HUBSPOT_FROM_EMAIL=noreply@aurigraph.io

# Application Settings
NODE_ENV=production
LOG_LEVEL=info
PORT=9003
```

### Configuration Files

**j4c-agent.config.json**:
- Agent definitions
- Workflow configurations
- Integration settings

**hubspot.config.json**:
- CRM sync settings
- Contact/deal/campaign management
- Automation rules

---

## Verification

### Check Service Status

```bash
# SSH to remote
ssh -p 2224 yogesh@dev.aurigraph.io

# Check systemd status
sudo systemctl status j4c-agent

# View recent logs
sudo journalctl -u j4c-agent -n 50

# Follow logs in real-time
sudo journalctl -u j4c-agent -f
```

### Test CLI

```bash
# SSH to remote and run
ssh -p 2224 yogesh@dev.aurigraph.io << 'EOF'
cd /opt/j4c-agent

# List agents
node j4c-cli.js agents list

# List workflows
node j4c-cli.js workflow list

# Check status
node j4c-cli.js status
EOF
```

### Health Check

```bash
# From local machine
curl -v http://dev.aurigraph.io:9003/health

# Or via SSH
ssh -p 2224 yogesh@dev.aurigraph.io "curl http://localhost:9003/health"
```

---

## Troubleshooting

### SSH Connection Issues

```bash
# Check host key
ssh-keyscan -p 2224 dev.aurigraph.io

# Add to known_hosts
ssh-keyscan -p 2224 dev.aurigraph.io >> ~/.ssh/known_hosts

# Test connection with verbose output
ssh -v -p 2224 yogesh@dev.aurigraph.io "echo 'Connected'"
```

### npm Install Failures

```bash
# Clear npm cache
npm cache clean --force

# Retry with verbose output
npm install --verbose

# Check disk space
df -h

# Check npm registry
npm config get registry
```

### Service Won't Start

```bash
# Check service status
sudo systemctl status j4c-agent

# View error logs
sudo journalctl -u j4c-agent -p 3

# Check permissions
ls -la /opt/j4c-agent/

# Test manually
cd /opt/j4c-agent
node index.js
```

### HubSpot Connection Issues

```bash
# Test API key
curl -H "Authorization: Bearer $HUBSPOT_API_KEY" \
  https://api.hubapi.com/crm/v3/objects/contacts?limit=1

# Check environment variables
env | grep HUBSPOT

# Test connection from app
node -e "require('./hubspot-integration.js').initialize()"
```

---

## Monitoring

### View Logs

```bash
# Last 50 lines
sudo journalctl -u j4c-agent -n 50

# Follow in real-time
sudo journalctl -u j4c-agent -f

# Filter by priority
sudo journalctl -u j4c-agent -p 3

# For specific date
sudo journalctl -u j4c-agent --since "2025-10-27"
```

### Check Metrics

```bash
# From remote
node j4c-cli.js metrics show

# Or locally via SSH
ssh -p 2224 yogesh@dev.aurigraph.io "cd /opt/j4c-agent && node j4c-cli.js metrics show"
```

### Performance Monitoring

```bash
# Check resource usage
ssh -p 2224 yogesh@dev.aurigraph.io << 'EOF'
ps aux | grep "node index.js"
free -h
df -h
EOF
```

---

## Rollback

### Automatic Rollback (Deployment Script)

The deployment script automatically creates backups before deploying.

```bash
# Previous backups are stored as:
# /opt/j4c-agent.backup.TIMESTAMP

# Restore previous version
ssh -p 2224 yogesh@dev.aurigraph.io << 'EOF'
sudo systemctl stop j4c-agent
sudo rm -rf /opt/j4c-agent
sudo cp -r /opt/j4c-agent.backup.LATEST /opt/j4c-agent
sudo systemctl start j4c-agent
EOF
```

### Manual Rollback

```bash
# Stop service
ssh -p 2224 yogesh@dev.aurigraph.io "sudo systemctl stop j4c-agent"

# Restore from backup
ssh -p 2224 yogesh@dev.aurigraph.io "sudo cp -r /opt/j4c-agent.backup /opt/j4c-agent"

# Start service
ssh -p 2224 yogesh@dev.aurigraph.io "sudo systemctl start j4c-agent"

# Verify
ssh -p 2224 yogesh@dev.aurigraph.io "sudo systemctl status j4c-agent"
```

---

## Post-Deployment

### 1. Configure Credentials

Add to `/opt/j4c-agent/.env`:
```bash
HUBSPOT_API_KEY=your_key
JIRA_API_KEY=your_key
GITHUB_TOKEN=your_token
```

### 2. Test Workflows

```bash
ssh -p 2224 yogesh@dev.aurigraph.io << 'EOF'
cd /opt/j4c-agent

# Test development workflow
node j4c-cli.js workflow run development --project="Test"

# Test agent
node j4c-cli.js invoke dlt security-scanner "[test code]"
EOF
```

### 3. Setup Monitoring

Configure alerts for:
- Service crashes
- High CPU/memory usage
- API errors
- Failed deployments

### 4. Documentation

Update team on:
- Deployment completed
- How to access J4C Agent
- Available commands
- Support contacts

---

## Support

- **Documentation**: See J4C_AGENT_PLUGIN.md
- **Issues**: GitHub Issues
- **Email**: engineering@aurigraph.io
- **Slack**: #engineering channel

---

## Deployment Checklist

Before deployment:
- ✅ Package built and tested
- ✅ Environment variables prepared
- ✅ SSH access verified
- ✅ Disk space available (1GB+)
- ✅ Node.js version 18+
- ✅ Backup plan documented

During deployment:
- ✅ Run deployment script or manual steps
- ✅ Monitor deployment progress
- ✅ Verify service is running
- ✅ Test basic commands
- ✅ Check logs for errors

After deployment:
- ✅ Verify all agents available
- ✅ Test workflows
- ✅ Confirm HubSpot sync
- ✅ Set up monitoring
- ✅ Document configuration
- ✅ Notify team

---

**J4C Agent Plugin - Deployment Guide v1.0.0**
**October 27, 2025**
**Production Ready**

