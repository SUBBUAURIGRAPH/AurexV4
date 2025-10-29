# HMS Deployment Pipeline Guide

**Version**: 1.0.0
**Date**: October 29, 2025
**Status**: Complete
**Scope**: Remote server, Docker Swarm, Kubernetes, CI/CD, Monitoring

---

## Table of Contents

1. [Remote Server Deployment](#remote-server-deployment)
2. [Docker Swarm Deployment](#docker-swarm-deployment)
3. [GitHub Actions CI/CD Pipeline](#github-actions-cicd-pipeline)
4. [Prometheus Alerts](#prometheus-alerts)
5. [Grafana Notifications](#grafana-notifications)
6. [Troubleshooting](#troubleshooting)

---

## Remote Server Deployment

### Overview

The `deploy-to-remote.sh` script automates HMS deployment to remote servers via SSH. It supports:
- Docker Compose deployments (single server)
- Docker Swarm deployments (clustered)
- Kubernetes deployments (advanced)

### Prerequisites

1. **SSH Access**
   ```bash
   # Add SSH key to remote server
   ssh-copy-id -p 22 username@remote-host
   ```

2. **Local Setup**
   ```bash
   # Make deployment script executable
   chmod +x deploy-to-remote.sh
   ```

3. **Environment Configuration**
   ```bash
   # Create .env file with credentials
   cp .env.example .env
   # Edit .env with your values:
   # - JIRA_API_KEY
   # - GITHUB_TOKEN
   # - HUBSPOT_API_KEY
   # - Slack webhook URL
   # - Database passwords
   ```

### Deployment Commands

#### Docker Compose (Single Server)
```bash
./deploy-to-remote.sh 192.168.1.100 ubuntu docker-compose 22

# Expected output:
# ✅ SSH connection established
# ✅ Docker installation verified
# ✅ Deployment directory ready at /opt/hms
# ✅ Configuration files uploaded
# ✅ Docker Compose deployment complete
```

#### Docker Swarm (Clustered)
```bash
./deploy-to-remote.sh manager.cluster.local ubuntu docker-swarm 22

# The script will:
# - Initialize Docker Swarm (if not already done)
# - Deploy stack with multiple replicas
# - Configure auto-healing and load balancing
```

### Deployment Report

After successful deployment, a `deployment-report.txt` is generated containing:
- Service endpoints and ports
- SSH access commands
- Health check endpoints
- Backup procedures
- Next steps and verification commands

### Post-Deployment Verification

```bash
# SSH into remote server
ssh -p 22 ubuntu@192.168.1.100

# Check service status
docker-compose ps  # Docker Compose
docker stack ps hms  # Docker Swarm

# Test health endpoints
curl http://localhost:9003/health
curl http://localhost:3000
curl http://localhost:9090/-/healthy

# View logs
docker-compose logs -f hms-j4c-agent
```

### Environment Variables

Required for remote deployment:
```bash
JIRA_API_KEY=your_jira_token
JIRA_EMAIL=your_email@aurigraph.io
JIRA_BASE_URL=https://aurigraph.atlassian.net
GITHUB_TOKEN=your_github_token
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
HUBSPOT_API_KEY=your_hubspot_key
DB_USER=hms_user
DB_PASSWORD=secure_password_change_me
GRAFANA_PASSWORD=secure_password_change_me
```

---

## Docker Swarm Deployment

### Swarm Configuration

The `docker-compose.swarm.yml` file provides:
- **Overlay networking** for multi-node communication
- **Service replication** for high availability
- **Resource constraints** for CPU and memory
- **Automatic restart policies**
- **Health checks** for each service

### Service Configuration

```yaml
# Agent: 2 replicas (load balanced)
hms-j4c-agent:
  replicas: 2
  resources:
    limits: 1 CPU, 1GB RAM
  placement: worker nodes

# NGINX: 2 replicas (manager nodes)
nginx-proxy:
  replicas: 2
  placement: manager nodes only

# Database: 1 replica (manager node)
postgres:
  replicas: 1
  placement: manager node

# Monitoring: Single replicas
prometheus: 1 replica (manager)
grafana: 1 replica (manager)
```

### Initialize Swarm Cluster

```bash
# On manager node
docker swarm init --advertise-addr 192.168.1.100

# Output: Manager token (save this!)
# Join workers with:
docker swarm join --token <worker-token> 192.168.1.100:2377

# Verify cluster
docker node ls
```

### Deploy to Swarm

```bash
# Deploy HMS stack
docker stack deploy -c docker-compose.swarm.yml hms

# Check status
docker stack ps hms
docker service ls

# View service details
docker service inspect hms_hms-j4c-agent
```

### Scaling Services

```bash
# Scale agent to 5 replicas
docker service scale hms_hms-j4c-agent=5

# Scale with constraints
docker service create --replicas 3 \
  --constraint node.role==worker \
  --name scaled-agent \
  aurigraph/hms-j4c-agent:1.0.0
```

### Update Service

```bash
# Update image
docker service update \
  --image aurigraph/hms-j4c-agent:2.0.0 \
  hms_hms-j4c-agent

# Verify rollout
docker service ps hms_hms-j4c-agent

# Rollback if needed
docker service rollback hms_hms-j4c-agent
```

### Swarm Networking

```bash
# Inspect overlay network
docker network inspect hms-network

# List all networks
docker network ls

# Services communicate via DNS:
# http://hms-j4c-agent:9003/health
# http://postgres:5432
# http://prometheus:9090
```

### Monitoring Swarm

```bash
# View all services
docker service ls

# Watch service updates
watch 'docker service ps hms_hms-j4c-agent'

# Logs from all replicas
docker service logs hms_hms-j4c-agent

# Node status
docker node ls
docker node inspect <node-id>
```

---

## GitHub Actions CI/CD Pipeline

### Workflows Included

#### 1. Docker Build & Push (`hms-docker-build-push.yml`)

Automatically triggered on:
- Push to `main` or `develop` branches
- Changes to `Dockerfile.j4c` or `plugin/` directory
- Manual trigger via `workflow_dispatch`

**Features**:
- Multi-stage Docker build with caching
- Vulnerability scanning with Trivy
- Automatic image tagging
- Push to Docker Hub
- Security scanning with GitHub CodeQL
- Slack notifications

**Configuration Required** (GitHub Secrets):
```
DOCKER_USERNAME=your_docker_username
DOCKER_PASSWORD=your_docker_password
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

#### 2. Deploy to Remote (`hms-deploy-remote.yml`)

Automatically triggered after successful Docker build.

**Features**:
- SSH-based remote deployment
- Support for staging and production environments
- Health checks post-deployment
- Slack notifications
- Automated rollback on failure

**Configuration Required** (GitHub Secrets per environment):
```
# Staging Environment
DEPLOY_HOST_STAGING=staging.example.com
DEPLOY_USER_STAGING=deploy
SSH_PRIVATE_KEY_STAGING=-----BEGIN RSA PRIVATE KEY-----...

# Production Environment
DEPLOY_HOST_PRODUCTION=prod.example.com
DEPLOY_USER_PRODUCTION=deploy
SSH_PRIVATE_KEY_PRODUCTION=-----BEGIN RSA PRIVATE KEY-----...
```

### Setting Up CI/CD

#### 1. Add GitHub Secrets

```bash
# Navigate to: Settings > Secrets and variables > Actions

# Docker Registry
DOCKER_USERNAME: your_username
DOCKER_PASSWORD: your_password_token

# SSH Keys (create deployment key)
SSH_PRIVATE_KEY: |
  -----BEGIN RSA PRIVATE KEY-----
  ... (private key content)
  -----END RSA PRIVATE KEY-----

# Slack Webhook
SLACK_WEBHOOK_URL: https://hooks.slack.com/services/...
```

#### 2. Create Deployment Environments

```bash
# Navigate to: Settings > Environments

# Create "staging" environment:
- Deployment branches: main
- Deployment branch requirements: selected
- Secrets:
  - DEPLOY_HOST=staging.host
  - DEPLOY_USER=ubuntu

# Create "production" environment:
- Deployment branches: main
- Required reviewers: devops-team
- Secrets:
  - DEPLOY_HOST=prod.host
  - DEPLOY_USER=ubuntu
```

#### 3. Deploy Workflow

```
GitHub Push
    ↓
hms-docker-build-push.yml
    ├─ Build Docker image
    ├─ Run security scans
    ├─ Push to Docker Hub
    └─ Create manifest PR
    ↓
hms-deploy-remote.yml (triggered on success)
    ├─ Deploy to staging (automatic)
    ├─ Run smoke tests
    └─ Notify Slack
    ↓
Production (manual approval)
    ├─ Deploy to production
    ├─ Run health checks
    └─ Notify team
```

### Manual Deployment

```bash
# Trigger Docker build with image push
gh workflow run hms-docker-build-push.yml --ref main -f push_image=true

# Trigger remote deployment
gh workflow run hms-deploy-remote.yml \
  --ref main \
  -f environment=production \
  -f deploy_type=docker-compose
```

### Workflow Monitoring

```bash
# View workflow runs
gh run list --workflow=hms-docker-build-push.yml

# Watch specific run
gh run view <run-id> --log

# Check deployment status
gh run list --workflow=hms-deploy-remote.yml --status=completed
```

---

## Prometheus Alerts

### Alert Rules (`prometheus-alerts.yml`)

Comprehensive alerting for:
- **Agent Health**: Down, high resource usage
- **Database**: Connection issues, replication lag
- **Proxy**: Error rates, connection limits
- **Monitoring**: Storage capacity, performance
- **Trading System**: Latency, error rates, calculation failures
- **Infrastructure**: Disk space, service restarts

### Alert Configuration

1. **Merge alerts into Prometheus config**:
```bash
# prometheus-dlt.yml should include:
rule_files:
  - 'prometheus-alerts.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

2. **Update docker-compose**:
```yaml
prometheus:
  volumes:
    - ./prometheus-dlt.yml:/etc/prometheus/prometheus.yml:ro
    - ./prometheus-alerts.yml:/etc/prometheus/alerts.yml:ro
```

### Alert Severity Levels

| Severity | Timeout | Action |
|----------|---------|--------|
| Critical | 2 min | Page on-call engineer |
| Warning | 5 min | Create ticket |
| Info | 15 min | Log event |

### Alert Examples

**Critical: Agent Down**
```yaml
- alert: AgentDown
  expr: up{job="hms-agent"} == 0
  for: 2m
  annotations:
    summary: "HMS Agent is down"
    runbook: "https://wiki/troubleshooting#agent-down"
```

**Warning: High Memory**
```yaml
- alert: HighMemoryUsage
  expr: container_memory_usage_bytes{name="hms-j4c-agent"} > 850MB
  for: 5m
```

---

## Grafana Notifications

### Notification Channels

Setup in Grafana UI or via `grafana-alerts.yaml`:

#### Slack Integration
```yaml
contactPoints:
  - name: 'Slack Critical'
    type: slack
    settings:
      url: '${SLACK_WEBHOOK_URL}'
      channel: '#critical-alerts'
      title: 'HMS Alert: {{ .GroupLabels.alertname }}'
```

#### Email Integration
```yaml
contactPoints:
  - name: 'Email - DevOps'
    type: email
    settings:
      addresses: 'devops@aurigraph.io'
```

### Alert Routing

Route alerts to appropriate channels based on:
- Severity (critical → Slack, warning → ticket)
- Component (database → DBA, agent → DevOps)
- Team (trading → trading team, ops → ops team)

```yaml
routingPolicies:
  - match:
      severity: 'critical'
    receiver: 'slack-critical'
    groupWait: '10s'

  - match:
      severity: 'warning'
    receiver: 'slack-warnings'
    groupWait: '30s'
```

### Testing Notifications

```bash
# Via Grafana UI:
# 1. Go to Alerting > Notification channels
# 2. Click test button

# Via curl:
curl -X POST http://localhost:3000/api/v1/rules/test \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"condition":"up==0"}'
```

---

## Troubleshooting

### Deployment Issues

**SSH Connection Refused**
```bash
# Check SSH access
ssh -v -p 22 user@host

# Verify SSH key
ssh-add ~/.ssh/id_rsa

# Add host key
ssh-keyscan -H host >> ~/.ssh/known_hosts
```

**Docker Daemon Not Running**
```bash
# On remote server
sudo systemctl status docker
sudo systemctl start docker
sudo systemctl enable docker
```

**Permission Denied**
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### CI/CD Issues

**Workflow Not Triggering**
```bash
# Check branch protection rules
# Verify secrets are set
gh secret list

# Check workflow syntax
gh workflow validate .github/workflows/hms-docker-build-push.yml
```

**Image Push Fails**
```bash
# Verify Docker credentials
docker login -u username

# Check image name
docker images | grep hms-j4c-agent

# Manual push
docker push aurigraph/hms-j4c-agent:1.0.0
```

### Alert Issues

**Alerts Not Firing**
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Verify rule syntax
curl http://localhost:9090/api/v1/rules

# Test alert expression
curl 'http://localhost:9090/api/v1/query?query=up{job="hms-agent"}'
```

**Notifications Not Sending**
```bash
# Test Slack webhook
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test alert"}'

# Check Grafana alertmanager config
curl http://localhost:3000/api/v1/provisioning/contact-points
```

---

## Monitoring & Health Checks

### Service Health Endpoints

```bash
# Agent
curl http://localhost:9003/health

# PostgreSQL
docker exec hms-postgres pg_isready -U hms_user

# Prometheus
curl http://localhost:9090/-/healthy

# Grafana
curl http://localhost:3000/api/health

# NGINX
curl http://localhost/health
```

### Key Metrics to Monitor

```promql
# Agent request latency
histogram_quantile(0.99, hms_agent_request_duration_seconds)

# Error rate
rate(hms_agent_errors_total[5m])

# Database connections
pg_stat_activity_count

# Disk usage
node_filesystem_avail_bytes / node_filesystem_size_bytes

# Memory usage
container_memory_usage_bytes / container_memory_max_bytes
```

---

## Summary

This deployment pipeline provides:
- ✅ Automated remote server deployments
- ✅ Multi-node Docker Swarm clustering
- ✅ Full CI/CD with GitHub Actions
- ✅ Comprehensive alerting with Prometheus
- ✅ Notification integration with Slack/Email
- ✅ Health monitoring and observability
- ✅ Disaster recovery procedures
- ✅ Detailed troubleshooting guides

**Next Steps**:
1. Configure GitHub secrets for CI/CD
2. Deploy to remote server using `deploy-to-remote.sh`
3. Set up Prometheus alerts and Grafana notifications
4. Configure backup and disaster recovery procedures
5. Monitor and optimize alert thresholds based on baselines

---

**Maintained By**: Aurigraph Development Team
**Repository**: https://github.com/Aurigraph-DLT-Corp/glowing-adventure
**Support**: agents@aurigraph.io
