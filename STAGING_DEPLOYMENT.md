# HERMES HF - STAGING DEPLOYMENT GUIDE

**Version**: 2.2.0
**Date**: November 2025
**Environment**: Staging (Pre-Production)
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Deployment Methods](#deployment-methods)
5. [Configuration](#configuration)
6. [Monitoring & Validation](#monitoring--validation)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedures](#rollback-procedures)
9. [Performance Tuning](#performance-tuning)
10. [Security Considerations](#security-considerations)

---

## Overview

The HERMES HF staging environment is a production-grade deployment used for testing, validation, and pre-production verification before deploying to production. It mirrors production configuration while using staging credentials and scaled-down resources.

### Key Characteristics

- **Multi-container Docker environment** with Kubernetes readiness
- **Full monitoring stack**: Prometheus, Grafana, Loki
- **Automated health checks** and validation
- **Zero-downtime deployments** with rolling updates
- **Comprehensive logging** and alerting
- **Database persistence** with PostgreSQL 15
- **Caching layer** with Redis 7
- **Service mesh ready** with gRPC support

### Services Included

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| HMS App | hms-app | 3001 / 50051 | Core API & gRPC |
| PostgreSQL | postgres | 5432 | Primary database |
| Redis | redis | 6379 | Session/cache store |
| Prometheus | prometheus | 9090 | Metrics collection |
| Grafana | grafana | 3000 | Metrics visualization |
| Loki | loki | 3100 | Log aggregation |

---

## Prerequisites

### System Requirements

```
Minimum:
- CPU: 4 cores
- Memory: 8GB RAM
- Disk: 50GB free space
- OS: Linux/macOS/Windows with Docker

Recommended:
- CPU: 8+ cores
- Memory: 16GB RAM
- Disk: 100GB SSD
- OS: Linux (Ubuntu 20.04+ or RHEL 8+)
```

### Required Software

- **Docker**: 20.10+ ([Install](https://docs.docker.com/get-docker/))
- **Docker Compose**: 1.29+ ([Install](https://docs.docker.com/compose/install/))
- **Git**: 2.25+ ([Install](https://git-scm.com/))
- **curl**: For health checks and testing

### Verification

```bash
# Check Docker
docker --version
# Expected: Docker version 20.10+

# Check Docker Compose
docker-compose --version
# Expected: Docker Compose version 1.29+

# Check Git
git --version
# Expected: git version 2.25+
```

---

## Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     STAGING ENVIRONMENT                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │   NGINX      │────▶│  HMS App     │────▶│  PostgreSQL  │ │
│  │  (Reverse    │     │  (Node.js)   │     │  (Database)  │ │
│  │  Proxy)      │     │  (gRPC)      │     │              │ │
│  └──────────────┘     └──────────────┘     └──────────────┘ │
│                             │                                 │
│                             ├──────────────────────────────┐  │
│                             │                              │  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │  Prometheus  │◀────│  Metrics     │────▶│  Redis       │ │
│  │  (Metrics)   │     │  Exporter    │     │  (Cache)     │ │
│  └──────────────┘     └──────────────┘     └──────────────┘ │
│         │                                                     │
│         ├──────────────────┐                                  │
│         │                  │                                  │
│  ┌──────────────┐     ┌──────────────┐                       │
│  │  Grafana     │     │    Loki      │                       │
│  │  (Dashboard) │     │    (Logs)    │                       │
│  └──────────────┘     └──────────────┘                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Network Architecture

```
External Traffic
       │
       ▼
┌──────────────┐
│  Nginx/LB    │
└──────────────┘
       │
       ▼
  ┌────────────────────────────┐
  │  Docker Bridge Network     │
  │  (hms-network)             │
  │                            │
  │  ┌────────────────────┐   │
  │  │  Application Tier  │   │
  │  │  ┌──────────────┐  │   │
  │  │  │  hms-app     │  │   │
  │  │  └──────────────┘  │   │
  │  └────────────────────┘   │
  │                            │
  │  ┌────────────────────┐   │
  │  │  Data Tier         │   │
  │  │  ┌──────────────┐  │   │
  │  │  │ PostgreSQL   │  │   │
  │  │  │ Redis        │  │   │
  │  │  └──────────────┘  │   │
  │  └────────────────────┘   │
  │                            │
  │  ┌────────────────────┐   │
  │  │  Observability Tier│   │
  │  │  ┌──────────────┐  │   │
  │  │  │ Prometheus   │  │   │
  │  │  │ Grafana      │  │   │
  │  │  │ Loki         │  │   │
  │  │  └──────────────┘  │   │
  │  └────────────────────┘   │
  │                            │
  └────────────────────────────┘
```

---

## Deployment Methods

### Method 1: Automated Script (Recommended)

**Best for**: Quick deployments with validation

```bash
# 1. Full deployment (setup + deploy + validate)
./scripts/staging-deploy.sh full-deploy

# 2. Individual steps
./scripts/staging-deploy.sh setup        # Configure environment
./scripts/staging-deploy.sh deploy       # Start containers
./scripts/staging-deploy.sh validate     # Run health checks
```

### Method 2: Docker Compose Direct

**Best for**: Manual control and debugging

```bash
# 1. Ensure environment file exists
cp .env.staging .env

# 2. Pull latest code
git pull origin main

# 3. Build Docker image
docker build -t hermes-hf:staging -f Dockerfile .

# 4. Start containers
docker-compose -f docker-compose-staging.yml up -d

# 5. Verify deployment
docker-compose -f docker-compose-staging.yml ps
```

### Method 3: GitHub Actions (CI/CD)

**Best for**: Automated deployments from git push

```yaml
# Trigger: Push to main branch
# File: .github/workflows/deploy.yml
# Features: Automated testing, build, deploy, validation
```

#### GitHub Actions Setup

```bash
# 1. Configure secrets in GitHub repository
# Settings > Secrets and variables > Actions

STAGING_SSH_KEY        # SSH private key for staging server
STAGING_HOST           # Staging server hostname
STAGING_USER           # SSH username
SLACK_WEBHOOK          # Slack notification webhook

# 2. Push code to trigger deployment
git push origin main
```

---

## Configuration

### Environment Variables

Copy and customize the staging configuration:

```bash
cp .env.staging .env
```

#### Critical Variables

```env
# Application
NODE_ENV=staging
PORT=3001
GRPC_PORT=50051

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=hermes_db
DB_USER=postgres
DB_PASSWORD=<CHANGE_THIS>

# Redis
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET=<CHANGE_THIS>
ENCRYPTION_KEY=<CHANGE_THIS>
CORS_ORIGIN=http://staging-hms.aurex.in

# Monitoring
PROMETHEUS_ENABLED=true
LOG_LEVEL=info
```

#### Optional Variables

```env
# Third-party integrations
JIRA_API_KEY=
GITHUB_TOKEN=
SLACK_BOT_TOKEN=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Feature flags
FEATURE_ANALYTICS_DASHBOARD=true
FEATURE_STRATEGY_BUILDER=true
FEATURE_DOCKER_MANAGER=true
```

### Volumes Configuration

Staging deployment uses named volumes for persistence:

```yaml
volumes:
  postgres_data:        # PostgreSQL data
  redis_data:          # Redis snapshots
  prometheus_data:     # Metrics history (30 days)
  grafana_data:        # Dashboards and settings
  loki_data:           # Logs storage
```

### Network Configuration

```yaml
networks:
  hms-network:
    driver: bridge
    # Containers can communicate via service name
    # Example: postgres:5432, redis:6379
```

---

## Monitoring & Validation

### Health Check Endpoints

```bash
# API Health
curl http://localhost:3001/health

# Prometheus Health
curl http://localhost:9090/-/healthy

# Grafana Health
curl http://localhost:3000/api/health
```

### Automated Validation

```bash
# Run comprehensive validation suite
./scripts/staging-validate.sh

# Output includes:
# - Container status
# - Service health checks
# - Database connectivity
# - Network configuration
# - Performance metrics
# - Security verification
```

### Manual Verification

```bash
# Check container status
docker-compose -f docker-compose-staging.yml ps

# View logs
docker-compose -f docker-compose-staging.yml logs -f --tail=100

# Check resource usage
docker stats

# Execute commands in container
docker-compose -f docker-compose-staging.yml exec hms-app npm run status
```

### Monitoring Dashboards

**Grafana**: http://localhost:3000
- Default credentials: admin/admin
- Dashboards: Overview, Performance, Infrastructure
- Data sources: Prometheus, Loki

**Prometheus**: http://localhost:9090
- Metrics: Query interface
- Status: Configuration and targets
- Graph: Visualization

---

## Troubleshooting

### Common Issues

#### 1. Containers Keep Restarting

```bash
# Check logs
docker-compose -f docker-compose-staging.yml logs hms-app --tail=50

# Common causes:
# - Application error in code
# - Database connection issue
# - Missing environment variables

# Solution:
docker-compose -f docker-compose-staging.yml down
# Fix issue
docker-compose -f docker-compose-staging.yml up -d
```

#### 2. Database Connection Failed

```bash
# Check PostgreSQL status
docker-compose -f docker-compose-staging.yml exec postgres pg_isready -U postgres

# Check connection string
docker-compose -f docker-compose-staging.yml logs postgres

# Verify environment variables
grep "DB_" .env

# Reset database
docker-compose -f docker-compose-staging.yml down -v  # WARNING: Deletes data
docker-compose -f docker-compose-staging.yml up -d postgres
```

#### 3. Port Already in Use

```bash
# Find process using port
lsof -i :3001

# Free the port
kill -9 <PID>

# Or use different port
export PORT=3002
docker-compose -f docker-compose-staging.yml up -d
```

#### 4. Out of Disk Space

```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a

# Remove unused volumes
docker volume prune
```

#### 5. Network Issues

```bash
# Check network
docker network ls

# Inspect network
docker network inspect hms-network

# Restart networking
docker-compose -f docker-compose-staging.yml down
docker-compose -f docker-compose-staging.yml up -d
```

### Debug Mode

```bash
# Enable verbose logging
export LOG_LEVEL=debug
docker-compose -f docker-compose-staging.yml up

# Inspect environment
docker-compose -f docker-compose-staging.yml config

# Test service connectivity
docker-compose -f docker-compose-staging.yml exec hms-app \
  curl -v http://postgres:5432/
```

---

## Rollback Procedures

### Automated Rollback

```bash
# Rollback to previous version
./scripts/staging-deploy.sh rollback

# Verifies: Git checkout, restart containers, health checks
```

### Manual Rollback

```bash
# 1. Stop current deployment
docker-compose -f docker-compose-staging.yml down

# 2. Checkout previous commit
git log --oneline | head -5  # Find previous commit
git checkout <PREVIOUS_COMMIT_HASH>

# 3. Restart with previous version
docker-compose -f docker-compose-staging.yml up -d

# 4. Verify deployment
./scripts/staging-validate.sh
```

### Emergency Rollback (Database Issues)

```bash
# 1. Stop application (keep database running)
docker-compose -f docker-compose-staging.yml stop hms-app

# 2. Check database status
docker-compose -f docker-compose-staging.yml exec postgres \
  psql -U postgres -d hermes_db -c "\dt"

# 3. Restore from backup if available
docker exec <postgres_container> \
  psql -U postgres -d hermes_db < backup.sql

# 4. Restart application
docker-compose -f docker-compose-staging.yml up -d hms-app

# 5. Verify
./scripts/staging-validate.sh
```

---

## Performance Tuning

### Database Optimization

```sql
-- Check index usage
SELECT * FROM pg_stat_user_indexes
ORDER BY idx_blks_read DESC;

-- Analyze performance
ANALYZE;

-- Vacuum
VACUUM ANALYZE;
```

### Redis Optimization

```bash
# Monitor keys
docker-compose -f docker-compose-staging.yml exec redis \
  redis-cli INFO keyspace

# Clear cache if needed
docker-compose -f docker-compose-staging.yml exec redis \
  redis-cli FLUSHDB
```

### Container Resource Limits

Edit `docker-compose-staging.yml`:

```yaml
services:
  hms-app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

### Connection Pooling

```env
DB_POOL_MIN=2
DB_POOL_MAX=10
REDIS_POOL_SIZE=10
```

---

## Security Considerations

### Secrets Management

```bash
# ⚠️ DO NOT commit .env file
echo ".env" >> .gitignore

# Store secrets securely
# - GitHub Secrets (for CI/CD)
# - Environment variables (for local)
# - Secrets manager (AWS Secrets Manager, HashiCorp Vault)
```

### Network Security

```yaml
# Restrict network access
networks:
  hms-network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.enable_ip_masquerade: 'true'
```

### Database Security

```sql
-- Restrict user privileges
ALTER ROLE postgres WITH ENCRYPTED PASSWORD 'STRONG_PASSWORD';

-- Create application user with limited privileges
CREATE ROLE app_user WITH LOGIN ENCRYPTED PASSWORD 'APP_PASSWORD';
GRANT CONNECT ON DATABASE hermes_db TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
```

### SSL/TLS for External Access

```nginx
# Reverse proxy configuration (if using NGINX)
server {
    listen 443 ssl;
    server_name staging-hms.aurex.in;

    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

---

## Deployment Checklist

- [ ] Docker and Docker Compose installed
- [ ] `.env.staging` configured with staging credentials
- [ ] Git repository up to date (`git pull origin main`)
- [ ] Sufficient disk space available (50GB+ free)
- [ ] Port 3001, 5432, 6379, 9090, 3000 available
- [ ] Network connectivity verified
- [ ] Database backup taken (if updating schema)
- [ ] Run `./scripts/staging-validate.sh` before deployment
- [ ] All health checks passing
- [ ] Monitoring dashboards accessible
- [ ] Team notified of deployment

---

## Post-Deployment Verification

### Functional Testing

```bash
# Test API endpoints
curl -X GET http://localhost:3001/health
curl -X GET http://localhost:3001/api/status

# Test database
curl -X GET http://localhost:3001/api/database/status

# Test cache
curl -X GET http://localhost:3001/api/cache/status
```

### Performance Testing

```bash
# Load test (using Apache Bench)
ab -n 1000 -c 10 http://localhost:3001/health

# Expected: 100+ RPS, <100ms response time
```

### Monitoring Verification

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check Grafana dashboards
# Access: http://localhost:3000
# Verify graphs are displaying data
```

---

## Support & Documentation

- **Project Repository**: https://github.com/Aurigraph-DLT-Corp/glowing-adventure
- **Documentation**: See `docs/` folder
- **Issues**: GitHub Issues
- **Contact**: DevOps Team

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.2.0 | Nov 2025 | Production deployment ready, full staging suite |
| 2.1.0 | Oct 2025 | Enhanced monitoring and validation |
| 2.0.0 | Sept 2025 | Initial production deployment |

---

**Last Updated**: November 2025
**Next Review**: December 2025
