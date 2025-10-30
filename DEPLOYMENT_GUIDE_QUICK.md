# Quick Deployment Guide - Aurigraph v2.1.0
## Build & Deploy to Remote Server

---

## OPTION 1: Automated Script Deployment (Recommended)

### Prerequisites
- SSH access to remote server
- Docker and Docker Compose installed on remote
- PostgreSQL and Redis running (or use managed services)
- AWS CLI or similar cloud provider CLI
- Environment variables configured

### Quick Start (5 minutes)

```bash
# 1. Clone repository
git clone https://github.com/yourusername/aurigraph.git
cd aurigraph

# 2. Configure environment
cp .env.production.example .env.production
# Edit .env.production with your values
nano .env.production

# 3. Run deployment script
chmod +x scripts/deploy-production.sh
./scripts/deploy-production.sh production us-east-1

# Script will:
# ✓ Run pre-flight checks
# ✓ Build Docker image
# ✓ Run tests
# ✓ Scan for vulnerabilities
# ✓ Push to registry
# ✓ Backup production data
# ✓ Deploy to remote server
# ✓ Run smoke tests
# ✓ Verify deployment
```

---

## OPTION 2: Manual Docker Compose Deployment

### Prerequisites
- Remote server with Docker/Docker Compose
- SSH access
- All dependencies installed

### Steps

#### Step 1: Build Image Locally
```bash
# Build Docker image
docker build \
  --tag aurigraph:v2.1.0-prod \
  --build-arg NODE_ENV=production \
  -f Dockerfile.prod \
  .

# Test image locally
docker run -p 8080:8080 aurigraph:v2.1.0-prod

# Verify API responds
curl http://localhost:8080/health
```

#### Step 2: Push to Registry
```bash
# Login to registry
docker login ghcr.io

# Tag for registry
docker tag aurigraph:v2.1.0-prod ghcr.io/yourusername/aurigraph:v2.1.0-prod

# Push
docker push ghcr.io/yourusername/aurigraph:v2.1.0-prod
```

#### Step 3: Deploy to Remote Server
```bash
# SSH to remote server
ssh -i ~/.ssh/aurigraph-prod.pem ubuntu@prod-server.example.com

# Create deployment directory
mkdir -p /opt/aurigraph/v2.1.0
cd /opt/aurigraph/v2.1.0

# Copy files from local machine
# (On your local machine:)
scp -i ~/.ssh/aurigraph-prod.pem \
  docker-compose.prod.yml \
  ubuntu@prod-server.example.com:/opt/aurigraph/v2.1.0/

scp -i ~/.ssh/aurigraph-prod.pem \
  .env.production \
  ubuntu@prod-server.example.com:/opt/aurigraph/v2.1.0/.env

# On remote server, deploy
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Verify
docker-compose -f docker-compose.prod.yml ps
curl http://localhost:8080/health
```

---

## OPTION 3: AWS ECS Deployment (Production)

### Prerequisites
- AWS Account with ECS, RDS, ElastiCache, ECR
- Terraform installed
- AWS CLI configured

### Steps

#### Step 1: Prepare Infrastructure
```bash
# Navigate to infrastructure directory
cd infrastructure/aws

# Initialize Terraform
terraform init

# Create terraform.tfvars
cat > terraform.tfvars <<EOF
aws_region           = "us-east-1"
environment          = "production"
db_username          = "aurigraph_admin"
db_password          = "$(openssl rand -base64 32)"
redis_auth_token     = "$(openssl rand -base64 32)"
ecr_repository_url   = "123456789012.dkr.ecr.us-east-1.amazonaws.com/aurigraph"
ecs_desired_count    = 3
ecs_min_capacity     = 2
ecs_max_capacity     = 10
EOF

# Plan infrastructure
terraform plan -out=tfplan

# Review plan carefully
terraform show tfplan

# Apply infrastructure
terraform apply tfplan
```

#### Step 2: Build and Push to ECR
```bash
# Get ECR login token
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build \
  -t 123456789012.dkr.ecr.us-east-1.amazonaws.com/aurigraph:v2.1.0 \
  -f Dockerfile.prod \
  .

# Push to ECR
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/aurigraph:v2.1.0
```

#### Step 3: Deploy to ECS
```bash
# Update ECS service with new image
aws ecs update-service \
  --cluster aurigraph-production \
  --service aurigraph-production \
  --force-new-deployment

# Wait for deployment
aws ecs wait services-stable \
  --cluster aurigraph-production \
  --services aurigraph-production

# Get load balancer URL
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[?LoadBalancerName==`aurigraph-alb-production`].DNSName' \
  --output text
```

---

## OPTION 4: GitHub Actions CI/CD (Recommended for Teams)

### Prerequisites
- GitHub repository
- GitHub Actions secrets configured:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`
  - `SLACK_WEBHOOK` (for notifications)

### Steps

#### Step 1: Configure Secrets
```bash
# In GitHub repository settings, add secrets:
# Settings > Secrets and variables > Actions

# AWS
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1

# Slack
SLACK_WEBHOOK=https://hooks.slack.com/services/...

# K6 Cloud (optional)
K6_CLOUD_TOKEN=your_token

# Snyk (optional)
SNYK_TOKEN=your_token
```

#### Step 2: Push Changes
```bash
# Make changes to code
git add .
git commit -m "feat: Add new feature"

# Push to main branch (triggers deployment)
git push origin main

# Or manual trigger:
# Go to Actions > Deploy to Production > Run workflow
```

#### Step 3: Monitor Deployment
```bash
# GitHub Actions page shows deployment progress
# Slack notifications sent for success/failure
# ECS service updates automatically
# Smoke tests run automatically
```

---

## POST-DEPLOYMENT VERIFICATION

### Health Checks
```bash
# API Health
curl https://api.example.com/health

# Readiness
curl https://api.example.com/ready

# Metrics
curl https://api.example.com/metrics | grep aurigraph_

# Database
curl https://api.example.com/api/v1/database/health

# Redis
curl https://api.example.com/api/v1/redis/health

# Exchanges
curl https://api.example.com/api/v1/exchanges/health
```

### Monitoring
```bash
# Prometheus
curl http://prometheus.example.com/metrics

# Grafana
# Open http://grafana.example.com
# User: admin / Password: ${GRAFANA_ADMIN_PASSWORD}

# Container logs
docker-compose -f docker-compose.prod.yml logs -f aurigraph
```

### Performance Baseline
```bash
# HTTP request latency
time curl https://api.example.com/health

# Load test
ab -n 100 -c 10 https://api.example.com/health

# K6 cloud performance test
k6 run tests/performance/load-test.js --cloud
```

---

## ROLLBACK PROCEDURES

### Immediate Rollback
```bash
# Stop current deployment
docker-compose -f docker-compose.prod.yml stop aurigraph

# Restore from backup
pg_restore -h $DB_HOST -U $DB_USER -d aurigraph_production \
  /backups/production/db_backup_latest.dump

# Start previous version
docker-compose -f docker-compose.prod.yml up -d

# Verify
curl http://localhost:8080/health
```

### AWS ECS Rollback
```bash
# AWS automatically keeps previous task definition
aws ecs update-service \
  --cluster aurigraph-production \
  --service aurigraph-production \
  --task-definition aurigraph-production:PREVIOUS_VERSION \
  --force-new-deployment

# Wait for completion
aws ecs wait services-stable \
  --cluster aurigraph-production \
  --services aurigraph-production
```

---

## TROUBLESHOOTING

### Container won't start
```bash
# Check logs
docker logs aurigraph

# Check environment variables
docker inspect aurigraph | grep -A 50 Env

# Check dependencies
docker-compose -f docker-compose.prod.yml logs postgres
docker-compose -f docker-compose.prod.yml logs redis
```

### Database connection errors
```bash
# Test database connectivity
psql -h $DB_HOST -U $DB_USER -d aurigraph_production -c "SELECT 1;"

# Check PostgreSQL logs
tail -f /var/log/postgresql/postgresql.log

# Reset connection pool
docker-compose -f docker-compose.prod.yml restart aurigraph
```

### High memory usage
```bash
# Check container memory
docker stats aurigraph

# Check Node.js heap
curl http://localhost:8080/api/v1/system/memory

# Reduce replicas
docker-compose -f docker-compose.prod.yml down aurigraph
docker-compose -f docker-compose.prod.yml up -d --scale aurigraph=1
```

### Redis issues
```bash
# Test Redis connectivity
redis-cli -h $REDIS_HOST ping

# Check memory
redis-cli -h $REDIS_HOST info memory

# Clear cache (if safe)
redis-cli -h $REDIS_HOST FLUSHDB
```

---

## MONITORING & MAINTENANCE

### Daily Tasks
```bash
# Check health
curl https://api.example.com/health

# Review logs
docker-compose -f docker-compose.prod.yml logs --tail=100

# Check resource usage
docker stats

# Database check
psql -h $DB_HOST -U $DB_USER -d aurigraph_production -c "SELECT count(*) FROM pg_stat_activity;"
```

### Weekly Tasks
```bash
# Review metrics in Grafana
# Check for error spikes
# Review slow query logs
# Verify backups completed
# Check certificate expiration
```

### Monthly Tasks
```bash
# Update dependencies
npm update

# Security audit
npm audit

# Database maintenance
VACUUM ANALYZE;

# Docker cleanup
docker system prune -a
```

---

## Support & Resources

- **Documentation**: `/docs/PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Deployment Checklist**: `/docs/DEPLOYMENT_CHECKLIST.md`
- **Monitoring Setup**: `/docs/MONITORING_SETUP.md`
- **Architecture**: `/docs/ARCHITECTURE_SYSTEM.md`
- **Security**: `/src/skills/exchange-connector/SECURITY_AUDIT.md`

---

## Quick Reference Commands

```bash
# Build
docker build -t aurigraph:v2.1.0 -f Dockerfile.prod .

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Logs
docker-compose -f docker-compose.prod.yml logs -f aurigraph

# Status
docker-compose -f docker-compose.prod.yml ps

# Stop
docker-compose -f docker-compose.prod.yml down

# Restart
docker-compose -f docker-compose.prod.yml restart aurigraph

# Scale
docker-compose -f docker-compose.prod.yml up -d --scale aurigraph=5

# Monitor
docker stats

# Health check
curl http://localhost:8080/health
```

---

**Version**: v2.1.0
**Last Updated**: December 13, 2025
**Status**: Production Ready
