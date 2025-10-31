# Staging Environment Setup Guide - HMS Production Deployment

**Date**: October 31, 2025
**Purpose**: Prepare identical staging environment to production for final testing
**Timeline**: 1-2 weeks before production deployment
**Owner**: DevOps Team
**Status**: Ready for execution

---

## Overview

The staging environment must be **identical to production** for accurate testing. This guide provides step-by-step instructions for provisioning and configuring the staging infrastructure.

---

## Pre-Requisites

### Team & Access
- [ ] DevOps engineer with AWS/Azure/GCP access
- [ ] SSH key pair for server access
- [ ] VPN access to infrastructure
- [ ] DNS management access
- [ ] Monitoring account credentials

### Infrastructure
- [ ] Approved cloud budget for staging (~$XXX/month)
- [ ] Network infrastructure approved
- [ ] Security groups/firewall rules approved
- [ ] Database provisioning approved

### Documentation
- [ ] PRODUCTION_DEPLOYMENT_CHECKLIST.md (reviewed)
- [ ] DEPLOYMENT_STRATEGY.md (reviewed)
- [ ] Infrastructure specifications (approved)

---

## Phase 1: Infrastructure Provisioning (3-4 days)

### Step 1.1: Provision Compute Resources

#### Primary Application Server
```bash
# AWS EC2 Example (adjust for your cloud provider)
# Instance Type: t3.2xlarge (8 vCPU, 32GB RAM)
# OS: Ubuntu 22.04 LTS
# Storage: 200GB gp3 SSD
# Region: [Production Region]
# VPC: [Production VPC]

aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.2xlarge \
  --key-name production-key \
  --security-group-ids sg-xxxxxxxx \
  --subnet-id subnet-xxxxxxxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=hms-staging-app}]' \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=200,VolumeType=gp3}' \
  --monitoring Enabled=true

# Assign Elastic IP
# Note: [Instance-ID] from above command
aws ec2 allocate-address --domain vpc
aws ec2 associate-address --instance-id [Instance-ID] --allocation-id [Allocation-ID]
```

**Checklist**:
- [ ] Instance running
- [ ] Security group allows SSH (22), HTTP (80), HTTPS (443)
- [ ] Elastic IP assigned and stable
- [ ] Monitoring enabled
- [ ] Backups configured

#### Database Server
```bash
# PostgreSQL Instance (separate server)
# Instance Type: t3.xlarge (4 vCPU, 16GB RAM)
# Storage: 500GB gp3 SSD (IOPS: 5000+)

aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.xlarge \
  --key-name production-key \
  --security-group-ids sg-database-xxxxxxxx \
  --subnet-id subnet-database-xxxxxxxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=hms-staging-postgres}]' \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=500,VolumeType=gp3,Iops=5000}' \
  --monitoring Enabled=true
```

**Checklist**:
- [ ] Instance running
- [ ] Security group allows PostgreSQL (5432) from app servers only
- [ ] High-performance storage configured
- [ ] Monitoring enabled
- [ ] Backups configured (daily)

#### Backup Server
```bash
# Backup/Replica Server
# Instance Type: t3.large (2 vCPU, 8GB RAM)
# Storage: 500GB gp3 SSD

aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.large \
  --key-name production-key \
  --security-group-ids sg-backup-xxxxxxxx \
  --subnet-id subnet-backup-xxxxxxxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=hms-staging-backup}]' \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=500,VolumeType=gp3}' \
  --monitoring Enabled=true
```

**Checklist**:
- [ ] Instance running
- [ ] PostgreSQL replica configured
- [ ] Backup volume allocated
- [ ] Monitoring enabled

### Step 1.2: Configure Networking

#### Security Groups
```bash
# Application Server Security Group
aws ec2 create-security-group \
  --group-name hms-staging-app-sg \
  --description "HMS Staging Application Server" \
  --vpc-id [VPC-ID]

# Add inbound rules
# SSH (22) from admin IPs
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp --port 22 --cidr [ADMIN-IP]/32

# HTTP (80) from load balancer
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp --port 80 \
  --source-security-group-id [LOAD-BALANCER-SG]

# HTTPS (443) from load balancer
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp --port 443 \
  --source-security-group-id [LOAD-BALANCER-SG]

# Application port (3000)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp --port 3000 \
  --source-security-group-id [LOAD-BALANCER-SG]
```

#### Database Security Group
```bash
# PostgreSQL Security Group
aws ec2 create-security-group \
  --group-name hms-staging-db-sg \
  --description "HMS Staging Database Server" \
  --vpc-id [VPC-ID]

# PostgreSQL (5432) from app servers only
aws ec2 authorize-security-group-ingress \
  --group-id sg-db-xxxxxxxx \
  --protocol tcp --port 5432 \
  --source-security-group-id [APP-SG]

# PostgreSQL (5432) from backup server
aws ec2 authorize-security-group-ingress \
  --group-id sg-db-xxxxxxxx \
  --protocol tcp --port 5432 \
  --source-security-group-id [BACKUP-SG]
```

#### DNS Configuration
```bash
# Create DNS records
# staging-api.company.com -> [Elastic-IP]

# AWS Route53 Example
aws route53 change-resource-record-sets \
  --hosted-zone-id Z12345ABCDEF \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "staging-api.company.com",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": "[ELASTIC-IP]"}]
      }
    }]
  }'
```

**Checklist**:
- [ ] Security groups created and configured
- [ ] All inbound rules added
- [ ] All outbound rules verified (egress rules)
- [ ] DNS records created
- [ ] DNS propagated (test with nslookup)

### Step 1.3: Storage & Backup Configuration

#### Object Storage (S3/Azure Blob)
```bash
# Create S3 bucket for backups
aws s3 mb s3://hms-staging-backups

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket hms-staging-backups \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket hms-staging-backups \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Set lifecycle policy (keep 30 days)
aws s3api put-bucket-lifecycle-configuration \
  --bucket hms-staging-backups \
  --lifecycle-configuration '{
    "Rules": [{
      "Expiration": {"Days": 30},
      "Status": "Enabled",
      "Filter": {"Prefix": ""}
    }]
  }'
```

**Checklist**:
- [ ] S3 bucket created
- [ ] Versioning enabled
- [ ] Encryption enabled
- [ ] Lifecycle policy configured
- [ ] Access permissions set (app servers only)

### Step 1.4: Load Balancer & Reverse Proxy

#### Nginx Load Balancer
```bash
# Install on separate server or use managed service
# Managed Option: AWS ALB (Application Load Balancer)

aws elbv2 create-load-balancer \
  --name hms-staging-alb \
  --subnets subnet-xxxxxxxx subnet-xxxxxxxx \
  --security-groups sg-alb-xxxxxxxx \
  --scheme internet-facing \
  --type application

# Create target group
aws elbv2 create-target-group \
  --name hms-staging-targets \
  --protocol HTTP \
  --port 3000 \
  --vpc-id [VPC-ID] \
  --health-check-path /api/gnn/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3

# Register targets
aws elbv2 register-targets \
  --target-group-arn arn:aws:elasticloadbalancing:... \
  --targets Id=[INSTANCE-ID]
```

**Checklist**:
- [ ] Load balancer created
- [ ] Target group created
- [ ] Targets registered
- [ ] Health checks passing
- [ ] DNS points to load balancer

---

## Phase 2: Software Installation (2-3 days)

### Step 2.1: Install System Dependencies

```bash
# SSH into application server
ssh -i production-key.pem ubuntu@staging-api.company.com

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Node.js (if needed for CLI testing)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL client
sudo apt-get install -y postgresql-client

# Install monitoring agents
# Datadog/NewRelic/etc as appropriate
sudo bash -c "$(curl -L https://raw.githubusercontent.com/DataDog/datadog-agent/master/cmd/agent/install_script.sh)" -- --api-key [API-KEY]
```

**Checklist**:
- [ ] System updated
- [ ] Docker installed and working
- [ ] Docker Compose installed
- [ ] Node.js installed (if needed)
- [ ] PostgreSQL client installed
- [ ] Monitoring agents installed

### Step 2.2: Set Up Database Server

```bash
# SSH into database server
ssh -i production-key.pem ubuntu@hms-staging-postgres

# Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create application database
sudo -u postgres psql <<EOF
CREATE DATABASE hms_staging;
CREATE USER hms_user WITH PASSWORD 'staging_password';
ALTER ROLE hms_user SET client_encoding TO 'utf8';
ALTER ROLE hms_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE hms_user SET default_transaction_deferrable TO on;
ALTER ROLE hms_user SET default_transaction_read_only TO off;
GRANT ALL PRIVILEGES ON DATABASE hms_staging TO hms_user;
EOF

# Configure PostgreSQL for replication (if backup is replica)
sudo nano /etc/postgresql/14/main/postgresql.conf

# Add these lines:
# wal_level = replica
# max_wal_senders = 10
# max_replication_slots = 10
# hot_standby = on

sudo systemctl restart postgresql
```

**Checklist**:
- [ ] PostgreSQL installed
- [ ] Service running and enabled
- [ ] Database created
- [ ] User created with correct permissions
- [ ] Replication configured (if applicable)
- [ ] Backups scheduled

### Step 2.3: Set Up Backup Server

```bash
# SSH into backup server
ssh -i production-key.pem ubuntu@hms-staging-backup

# Install PostgreSQL (for replication)
sudo apt-get install -y postgresql postgresql-contrib

# Configure as standby/replica
# (if using PostgreSQL replication)

# Or install backup tools
sudo apt-get install -y pgbackrest
```

**Checklist**:
- [ ] Backup tools installed
- [ ] Replication configured (if applicable)
- [ ] Backup directory permissions set
- [ ] S3 credentials configured
- [ ] First backup completed successfully

---

## Phase 3: Application Deployment (2-3 days)

### Step 3.1: Clone and Configure Application

```bash
# SSH into application server
ssh -i production-key.pem ubuntu@staging-api.company.com

# Clone repository
cd /opt/hms
git clone https://github.com/company/hms.git .

# Checkout specific version
git checkout v1.0.0  # or specific tag

# Create environment file
cp .env.template .env
nano .env

# Edit .env with staging values:
# SERVER_PORT=3000
# NODE_ENV=staging
# DB_HOST=hms-staging-postgres  (internal IP)
# DB_USER=hms_user
# DB_PASSWORD=staging_password
# REDIS_HOST=localhost
# etc...
```

**Checklist**:
- [ ] Repository cloned
- [ ] Correct version checked out
- [ ] .env file created and configured
- [ ] All required variables set
- [ ] Database credentials verified

### Step 3.2: Build Docker Image

```bash
# Build image locally or push from CI/CD
cd /opt/hms

# Build image
docker build -t hms-gnn:v1.0.0 \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  --build-arg VCS_REF=$(git rev-parse --short HEAD) \
  .

# Tag for registry
docker tag hms-gnn:v1.0.0 [REGISTRY]/hms-gnn:v1.0.0
docker tag hms-gnn:v1.0.0 [REGISTRY]/hms-gnn:latest

# Push to registry (if using registry)
docker login [REGISTRY]
docker push [REGISTRY]/hms-gnn:v1.0.0
docker push [REGISTRY]/hms-gnn:latest

# Or use local image for staging
docker images | grep hms-gnn
```

**Checklist**:
- [ ] Docker build successful
- [ ] Image tagged correctly
- [ ] Image pushed to registry (or available locally)
- [ ] Image size reasonable (<500MB)
- [ ] Image scanned for vulnerabilities

### Step 3.3: Deploy with Docker Compose

```bash
# Create necessary directories
mkdir -p /opt/hms/{data,logs,backups}
chmod 755 /opt/hms/{data,logs,backups}

# Start services
cd /opt/hms
docker-compose up -d

# Wait for services to start
sleep 60

# Check service status
docker-compose ps

# Expected output:
# NAME        STATUS
# app         Up (healthy)
# postgres    Up (healthy)
# redis       Up (healthy)
# nginx       Up (healthy)
# prometheus  Up (healthy)
# grafana     Up (healthy)
# loki        Up (healthy)
# promtail    Up (healthy)

# View logs
docker-compose logs app --tail 100
```

**Checklist**:
- [ ] All services started
- [ ] Health checks passing
- [ ] No critical errors in logs
- [ ] Database initialized
- [ ] Redis connected
- [ ] All data directories accessible

### Step 3.4: Verify Deployment

```bash
# Test application health
curl -s http://localhost:3000/api/gnn/health | jq

# Expected response:
# {
#   "status": "healthy",
#   "version": "1.0.0",
#   "timestamp": "2025-10-31T12:00:00Z"
# }

# Test API endpoints
curl -s http://localhost:3000/api/exchange/status | jq
curl -s http://localhost:3000/api/strategy/status | jq
curl -s http://localhost:3000/api/docker/status | jq
curl -s http://localhost:3000/api/analytics/status | jq

# Test database connectivity
docker-compose exec postgres psql -U hms_user -d hms_staging -c "SELECT version();"

# Test cache connectivity
docker-compose exec redis redis-cli ping
```

**Checklist**:
- [ ] All health checks passing
- [ ] API endpoints responding
- [ ] Database query successful
- [ ] Cache connected
- [ ] Response times < 200ms

---

## Phase 4: Monitoring & Observability Setup (1-2 days)

### Step 4.1: Configure Prometheus

```bash
# Prometheus is started via docker-compose
# Verify it's running
docker-compose ps prometheus

# Access Prometheus UI
# http://staging-api.company.com:9090

# Verify metrics collection
curl -s http://localhost:9090/api/v1/query?query=up | jq

# Check targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, endpoint: .scrapeUrl}'
```

**Checklist**:
- [ ] Prometheus running
- [ ] Metrics being collected
- [ ] All targets healthy
- [ ] Retention configured (15 days minimum)
- [ ] Storage allocated (50GB+ for staging)

### Step 4.2: Configure Grafana

```bash
# Access Grafana
# http://staging-api.company.com:3001
# Default credentials: admin / admin

# Change admin password immediately
# (via UI: Admin > Profile > Change Password)

# Add Prometheus data source (via UI)
# - Data Source: Prometheus
# - URL: http://prometheus:9090
# - Save & Test

# Import dashboards
# Pre-configured dashboards for:
# - Node.js Application Metrics
# - Docker Container Metrics
# - Database Performance
# - System Overview
```

**Checklist**:
- [ ] Grafana running
- [ ] Admin password changed
- [ ] Prometheus data source configured
- [ ] Test data source connection
- [ ] Import dashboards
- [ ] Verify metrics displaying

### Step 4.3: Configure Loki for Logs

```bash
# Loki is started via docker-compose
# Verify it's running
docker-compose ps loki promtail

# Access Loki (via Grafana)
# http://staging-api.company.com:3001
# Add Data Source: Loki
# URL: http://loki:3100

# Verify log collection
curl -s 'http://localhost:3100/loki/api/v1/query' --data-urlencode 'query={job="hms"}' | jq
```

**Checklist**:
- [ ] Loki running
- [ ] Promtail forwarding logs
- [ ] Logs searchable in Grafana
- [ ] Log retention configured (30 days)
- [ ] Storage allocated (100GB+ for staging)

### Step 4.4: Configure Alerting

```bash
# Prometheus alert rules
# Located in: prometheus.yml or prometheus/alerts/

# Configure alert channels:
# - Email: hms-staging-alerts@company.com
# - Slack: #hms-staging-alerts
# - PagerDuty: hms-staging

# Test alert system
# (Trigger a test alert to verify)

curl -X POST http://staging-api.company.com:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "status": "firing",
    "labels": {
      "alertname": "TestAlert",
      "severity": "critical"
    },
    "annotations": {
      "summary": "This is a test alert",
      "description": "Alert system is working"
    }
  }]'

# Verify alert received in Slack/Email
```

**Checklist**:
- [ ] Alert rules configured
- [ ] Alert channels configured
- [ ] Test alert delivered successfully
- [ ] Webhook endpoints verified
- [ ] Escalation procedures documented

---

## Phase 5: Testing & Validation (3-5 days)

### Step 5.1: Functional Testing

```bash
# Run full test suite
cd /opt/hms
npm test -- --coverage

# Expected: All tests passing
# Coverage: >95%

# Run integration tests
npm run test:integration

# Test API endpoints
npm run test:api

# Test CLI commands (if applicable)
npm run test:cli
```

**Checklist**:
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All API tests passing
- [ ] Coverage > 95%
- [ ] No critical warnings

### Step 5.2: Performance Testing

```bash
# Load testing with artillery or similar
npm install -g artillery

# Create load test file
cat > load-test.yml <<EOF
config:
  target: 'http://staging-api.company.com'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: API Load Test
    flow:
      - get:
          url: /api/gnn/health
      - get:
          url: /api/exchange/ticker/BTC/USDT
      - get:
          url: /api/strategy/list
EOF

# Run load test
artillery run load-test.yml

# Expected:
# - Response time p99 < 500ms
# - Error rate < 1%
# - Throughput > 100 requests/sec
```

**Checklist**:
- [ ] Load test completed
- [ ] Response times acceptable
- [ ] Error rate < 1%
- [ ] Throughput sufficient
- [ ] Resource usage monitored
- [ ] Scaling triggered if needed

### Step 5.3: Data Consistency Testing

```bash
# Test database replication (if applicable)
# Verify data replication between primary and replica

# Test backup integrity
# Restore from backup to verify completeness

# Test cache invalidation
# Verify cache updates correctly when data changes

# Test data persistence
# Restart services and verify data intact
docker-compose restart
sleep 30
docker-compose ps
```

**Checklist**:
- [ ] Replication working correctly
- [ ] Backup restoration successful
- [ ] Data consistency verified
- [ ] Cache behavior correct
- [ ] Persistence verified

### Step 5.4: Security Testing

```bash
# Run security scans
npm audit
docker scan [IMAGE]

# Test authentication
# Verify JWT tokens working
# Verify API keys required

# Test authorization
# Verify RBAC working

# Test input validation
# Try SQL injection attempts (should fail)
# Try XSS attempts (should fail)

# Test rate limiting
# Verify rate limits enforced
ab -n 1000 -c 100 http://staging-api.company.com/api/gnn/health
```

**Checklist**:
- [ ] No critical vulnerabilities
- [ ] No high-risk vulnerabilities
- [ ] Authentication working
- [ ] Authorization working
- [ ] Input validation working
- [ ] Rate limiting working

### Step 5.5: User Acceptance Testing (UAT)

```bash
# Invite select users to staging environment
# Provide access and documentation

# Gather feedback on:
# - Feature functionality
# - User experience
# - Performance
# - Documentation clarity
# - Any bugs or issues

# Track issues in JIRA
# Fix any P1/P2 issues before production
# Document known limitations
```

**Checklist**:
- [ ] UAT users identified
- [ ] Access provisioned
- [ ] Documentation reviewed
- [ ] Feedback collected
- [ ] Critical issues resolved
- [ ] Known limitations documented

---

## Phase 6: Final Validation & Sign-Off (1 day)

### Staging Readiness Checklist

#### Infrastructure ✅
- [ ] All servers running and stable
- [ ] Network connectivity verified
- [ ] Security groups configured correctly
- [ ] DNS resolving correctly
- [ ] Load balancer functioning
- [ ] Backups executing automatically

#### Application ✅
- [ ] All services healthy
- [ ] Health checks passing
- [ ] All endpoints responding
- [ ] Database initialized
- [ ] Redis connected
- [ ] Performance baseline met

#### Testing ✅
- [ ] All unit tests passing (>95% coverage)
- [ ] All integration tests passing
- [ ] Load testing completed
- [ ] Security testing completed
- [ ] Data consistency verified
- [ ] User acceptance testing completed

#### Monitoring ✅
- [ ] Prometheus collecting metrics
- [ ] Grafana displaying dashboards
- [ ] Loki aggregating logs
- [ ] Alerts configured and tested
- [ ] Escalation paths defined
- [ ] On-call rotation ready

#### Documentation ✅
- [ ] Deployment guide completed
- [ ] Runbooks for common issues
- [ ] Troubleshooting guide
- [ ] Architecture documentation
- [ ] Security procedures
- [ ] Backup/recovery procedures

#### Sign-Off ✅
- [ ] Engineering Lead approval
- [ ] DevOps Lead approval
- [ ] QA Lead approval
- [ ] Product Manager approval

### Approval Sign-Off Form

```
STAGING ENVIRONMENT READINESS SIGN-OFF

Date: ________________
Environment: Staging
Version: 1.0.0

Verified By:
☐ Engineering Lead: ______________ Date: __________
☐ DevOps Lead:     ______________ Date: __________
☐ QA Lead:         ______________ Date: __________
☐ Product Manager: ______________ Date: __________

Issues Found: _____ (list below)
1. ________________
2. ________________
3. ________________

Resolution Status:
☐ All critical issues resolved
☐ All tests passing
☐ Ready for production deployment

Approved for Production Deployment: ☐ YES  ☐ NO

Notes: _______________________________________________
________________________________________________________
________________________________________________________
```

---

## Next Steps

Once staging is ready:
1. Schedule Go/No-Go meeting
2. Prepare production deployment
3. Notify stakeholders
4. Final production checklist review
5. Execute Blue-Green deployment

---

**Status**: ✅ **READY FOR EXECUTION**

*Follow this guide step-by-step to prepare an identical staging environment for comprehensive final testing before production deployment.*
