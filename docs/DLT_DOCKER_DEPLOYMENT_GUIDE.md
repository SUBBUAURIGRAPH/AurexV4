# Aurigraph DLT Docker Deployment Guide

**Version**: 1.0.0
**Date**: October 28, 2025
**Status**: ✅ Ready for Deployment
**Target**: hms.aurex.in (Production Server)
**Platform**: Docker + Docker Compose

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick Deployment](#quick-deployment)
5. [Manual Deployment](#manual-deployment)
6. [Service Configuration](#service-configuration)
7. [SSL/TLS Setup](#ssltls-setup)
8. [Monitoring & Alerting](#monitoring--alerting)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)
11. [Health Checks](#health-checks)
12. [Management Commands](#management-commands)

---

## Overview

The Aurigraph DLT Docker deployment provides a complete, production-ready Distributed Ledger Technology stack integrated with the Hermes Trading Platform. This deployment includes:

- **DLT Node Service**: Aurigraph blockchain node with API endpoints
- **PostgreSQL Database**: Persistent data storage
- **Redis Cache**: High-performance caching layer
- **Prometheus**: Metrics collection and monitoring
- **Grafana**: Real-time monitoring dashboards
- **NGINX**: Reverse proxy with SSL/TLS termination

### Key Features

✅ **Multi-Service Stack**: 6 containerized services
✅ **Production-Grade Security**: SSL/TLS, security headers, rate limiting
✅ **High Availability**: Health checks, auto-restart, volume persistence
✅ **Comprehensive Monitoring**: Prometheus metrics, Grafana dashboards
✅ **Easy Management**: Docker Compose orchestration
✅ **Automated Deployment**: Bash script for one-command deployment

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Production Server (hms.aurex.in)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              NGINX Reverse Proxy (Port 443)              │   │
│  │  - SSL/TLS Termination                                  │   │
│  │  - Rate Limiting                                        │   │
│  │  - Security Headers                                     │   │
│  │  - Load Balancing                                       │   │
│  └──────────┬───────────────────────────────────────────────┘   │
│             │                                                    │
│  ┌──────────┴────────────────────────────────────────────────┐   │
│  │              DLT Services Network                         │   │
│  │                                                           │   │
│  │  ┌──────────────┐  ┌────────────────┐  ┌──────────────┐ │   │
│  │  │  DLT Node    │  │  PostgreSQL    │  │   Redis      │ │   │
│  │  │  (Port 9004) │  │  (Port 5433)   │  │  (Port 6380) │ │   │
│  │  └──────────────┘  └────────────────┘  └──────────────┘ │   │
│  │                                                           │   │
│  │  ┌──────────────┐  ┌────────────────┐                   │   │
│  │  │ Prometheus   │  │    Grafana     │                   │   │
│  │  │ (Port 9091)  │  │  (Port 3001)   │                   │   │
│  │  └──────────────┘  └────────────────┘                   │   │
│  │                                                           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Persistent Volumes                          │   │
│  │  - DLT Node Data      - PostgreSQL Data                 │   │
│  │  - Redis Data         - Prometheus Data                 │   │
│  │  - Grafana Data       - NGINX Logs/Cache                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### System Requirements

- **OS**: Linux (Ubuntu 20.04+, CentOS 8+, Debian 10+)
- **CPU**: 4+ cores (8 recommended)
- **RAM**: 8GB minimum (16GB recommended)
- **Disk**: 100GB+ free space (SSD recommended)
- **Network**: Public IP with SSL certificate

### Software Requirements

- Docker 20.10+ (Install: `curl -fsSL https://get.docker.com | sh`)
- Docker Compose 2.0+ (Install: `curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose`)
- Git (for repository management)
- SSH access to production server

### Network Requirements

- **Port 80**: HTTP (redirects to HTTPS)
- **Port 443**: HTTPS (primary access)
- **Port 9090**: Prometheus (internal monitoring, optional external)
- **Port 3001**: Grafana (internal monitoring, optional external)
- **Internal Ports**: 5433 (PostgreSQL), 6380 (Redis), 9004 (DLT Node)

### SSL/TLS Certificates

- **Required**: Valid SSL certificates at `/etc/letsencrypt/live/aurexcrt1/`
- **fullchain.pem**: Certificate chain
- **privkey.pem**: Private key

---

## Quick Deployment

### Option 1: Automated Deployment (Recommended)

```bash
# From local development machine
chmod +x ./scripts/deploy-dlt-docker.sh
./scripts/deploy-dlt-docker.sh subbu@hms.aurex.in 2227

# Follow the on-screen prompts
# Expected duration: 5-10 minutes
```

### Option 2: Manual SSH + Git Clone

```bash
# SSH into production server
ssh -p 2227 subbu@hms.aurex.in

# Create DLT directory structure
mkdir -p /opt/hermes/dlt
cd /opt/hermes/dlt

# Clone or pull latest HMS repository
cd /opt/hermes
git pull origin main

# Copy DLT configurations
cp deployment/docker-compose.dlt.yml ./dlt/docker-compose.yml
cp deployment/nginx-dlt.conf ./dlt/nginx-dlt.conf
cp deployment/prometheus-dlt.yml ./dlt/prometheus-dlt.yml

# Create environment file
cat > ./dlt/.env.dlt << 'EOF'
DLT_NETWORK=testnet
DLT_API_KEY=your-api-key
DLT_API_SECRET=your-api-secret
DLT_DB_PASSWORD=secure-password
DLT_REDIS_PASSWORD=secure-password
DLT_GRAFANA_PASSWORD=grafana-password
EOF

# Start services
cd ./dlt
docker-compose -f docker-compose.yml up -d

# Verify deployment
docker-compose -f docker-compose.yml ps
```

---

## Manual Deployment

### Step 1: Prepare Server

```bash
ssh -p 2227 subbu@hms.aurex.in

# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Verify Docker installation
docker --version
docker-compose --version

# Verify SSL certificates
ls -la /etc/letsencrypt/live/aurexcrt1/
```

### Step 2: Create Directory Structure

```bash
# Create DLT deployment directory
sudo mkdir -p /opt/hermes/dlt/dlt-service
sudo mkdir -p /opt/hermes/dlt/logs
sudo chown -R $USER:$USER /opt/hermes/dlt
```

### Step 3: Upload Configuration Files

From your local machine:

```bash
# Upload Docker Compose configuration
scp -P 2227 deployment/docker-compose.dlt.yml \
    subbu@hms.aurex.in:/opt/hermes/dlt/docker-compose.yml

# Upload NGINX configuration
scp -P 2227 deployment/nginx-dlt.conf \
    subbu@hms.aurex.in:/opt/hermes/dlt/nginx-dlt.conf

# Upload Prometheus configuration
scp -P 2227 deployment/prometheus-dlt.yml \
    subbu@hms.aurex.in:/opt/hermes/dlt/prometheus-dlt.yml
```

### Step 4: Create Environment Configuration

```bash
ssh -p 2227 subbu@hms.aurex.in << 'EOF'
cat > /opt/hermes/dlt/.env.dlt << 'ENVEOF'
# Aurigraph DLT Configuration
NODE_ENV=production
DLT_NETWORK=testnet
DLT_API_URL=https://api.aurigraph.io
DLT_API_KEY=YOUR_API_KEY_HERE
DLT_API_SECRET=YOUR_API_SECRET_HERE

# Database Configuration
DLT_DB_USER=dlt_user
DLT_DB_PASSWORD=CHANGE_THIS_PASSWORD
DLT_DB_NAME=aurigraph_dlt

# Redis Configuration
DLT_REDIS_PASSWORD=CHANGE_THIS_PASSWORD

# Grafana Configuration
DLT_GRAFANA_PASSWORD=CHANGE_THIS_PASSWORD

# Logging
LOG_LEVEL=info
ENVEOF

chmod 600 /opt/hermes/dlt/.env.dlt
EOF
```

### Step 5: Build and Start Services

```bash
ssh -p 2227 subbu@hms.aurex.in << 'EOF'
cd /opt/hermes/dlt

# Build Docker images
docker-compose -f docker-compose.yml build --no-cache

# Start all services
docker-compose -f docker-compose.yml up -d

# Verify services are running
docker-compose -f docker-compose.yml ps

# Check logs
docker-compose -f docker-compose.yml logs -f dlt-node
EOF
```

### Step 6: Wait for Initialization

```bash
# Monitor startup logs
docker-compose -f docker-compose.yml logs -f

# Wait for services to become healthy (2-5 minutes)
docker-compose -f docker-compose.yml ps
```

---

## Service Configuration

### DLT Node Configuration

**File**: `docker-compose.dlt.yml` (dlt-node service)

**Key Environment Variables**:
- `DLT_NETWORK`: Network to connect to (testnet/mainnet)
- `DLT_API_URL`: Aurigraph API endpoint
- `DLT_API_KEY`: Authentication key
- `DLT_API_SECRET`: Authentication secret
- `DLT_PORT`: Service port (default: 9004)

**Health Check**:
- HTTP GET to `http://localhost:9004/health`
- Interval: 30 seconds
- Timeout: 10 seconds
- Threshold: 3 failures to mark unhealthy

### PostgreSQL Configuration

**Database**: `aurigraph_dlt`
**Port**: 5433 (mapped from 5432)
**User**: `dlt_user`
**Backup Path**: `/var/backups/postgresql`

**Key Parameters**:
- `max_connections`: 100
- `shared_buffers`: 256MB
- `work_mem`: 16MB

### Redis Configuration

**Port**: 6380 (mapped from 6379)
**Memory**: 256MB (default)
**Persistence**: AOF (Append-Only File)
**Password**: Required (configured via .env)

### Prometheus Configuration

**Port**: 9091 (mapped from 9090)
**Retention**: 30 days
**Scrape Interval**: 15 seconds

**Monitored Targets**:
- DLT Node (port 9004)
- PostgreSQL (via exporter)
- NGINX (via exporter)
- Prometheus self-monitoring

### Grafana Configuration

**Port**: 3001 (mapped from 3000)
**Default User**: admin
**Default Password**: (configured via .env)
**Database**: PostgreSQL (aurigraph_dlt)

---

## SSL/TLS Setup

### Using Let's Encrypt (Recommended)

```bash
# Install Certbot (if not already installed)
sudo apt-get install certbot python3-certbot-nginx -y

# Obtain certificate for domains
sudo certbot certonly --standalone \
  -d dlt.aurex.in \
  -d dlt-api.aurex.in \
  -d dlt-monitor.aurex.in

# Certificate will be at: /etc/letsencrypt/live/aurexcrt1/
```

### Manual Certificate Installation

If using commercial SSL certificates:

```bash
# Create directory for certificates
sudo mkdir -p /etc/letsencrypt/live/aurexcrt1

# Copy your certificate files
sudo cp /path/to/fullchain.pem /etc/letsencrypt/live/aurexcrt1/
sudo cp /path/to/privkey.pem /etc/letsencrypt/live/aurexcrt1/

# Set permissions
sudo chmod 644 /etc/letsencrypt/live/aurexcrt1/fullchain.pem
sudo chmod 600 /etc/letsencrypt/live/aurexcrt1/privkey.pem
```

### Certificate Renewal

```bash
# Automatic renewal (Certbot handles this)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Manual renewal
sudo certbot renew --dry-run  # Test
sudo certbot renew            # Actual renewal
```

---

## Monitoring & Alerting

### Prometheus Metrics

Access metrics at: `http://dlt-monitor.aurex.in/prometheus`

**Key Metrics**:
- `dlt_node_transactions_total`: Total transactions processed
- `dlt_node_blocks_processed`: Blocks processed count
- `dlt_api_request_duration`: API request duration
- `postgres_connections_active`: Active database connections
- `redis_memory_usage_bytes`: Redis memory usage

### Grafana Dashboards

Access dashboards at: `https://dlt-monitor.aurex.in`

**Default Credentials**:
- Username: `admin`
- Password: (configured in .env.dlt)

**Available Dashboards**:
1. **DLT Node Performance**: Transaction rate, block processing, latency
2. **Database Monitoring**: Connection counts, query performance, storage
3. **System Health**: CPU, memory, disk usage
4. **API Performance**: Request rates, error rates, response times

### Alert Rules

Configure in `prometheus-dlt.yml`:

```yaml
alert:
  - name: DLTNodeDown
    condition: up{job="dlt-node"} == 0
    duration: 5m
    action: alert

  - name: PostgreSQLDown
    condition: pg_up{job="postgres-dlt"} == 0
    duration: 5m
    action: alert

  - name: HighErrorRate
    condition: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    duration: 10m
    action: alert
```

---

## Backup & Recovery

### PostgreSQL Backup

```bash
# Automated daily backup (add to crontab)
0 2 * * * cd /opt/hermes/dlt && \
  docker-compose exec -T dlt-postgres \
  pg_dump -U dlt_user aurigraph_dlt | \
  gzip > /var/backups/postgresql/dlt-backup-$(date +\%Y\%m\%d).sql.gz

# Manual backup
docker-compose -f docker-compose.yml exec dlt-postgres \
  pg_dump -U dlt_user aurigraph_dlt > dlt-backup-$(date +%Y%m%d).sql
```

### Recovery from Backup

```bash
# Restore from backup
docker-compose -f docker-compose.yml exec -T dlt-postgres \
  psql -U dlt_user aurigraph_dlt < dlt-backup-20251028.sql

# Or using gzip
gunzip < dlt-backup-20251028.sql.gz | \
  docker-compose -f docker-compose.yml exec -T dlt-postgres \
  psql -U dlt_user aurigraph_dlt
```

### Volume Backup

```bash
# Backup DLT node data
docker run --rm \
  -v dlt-node-data:/data \
  -v /backups:/backup \
  alpine tar czf /backup/dlt-node-data-$(date +%Y%m%d).tar.gz /data

# Backup all volumes
docker-compose -f docker-compose.yml exec -T dlt-postgres \
  tar czf /var/backups/postgresql/dlt-volumes-$(date +%Y%m%d).tar.gz \
  -C / $(docker volume ls --format "{{.Name}}" | grep dlt)
```

---

## Troubleshooting

### DLT Node Not Starting

```bash
# Check logs
docker-compose -f docker-compose.yml logs dlt-node

# Common issues:
# 1. Port already in use: netstat -tlnp | grep 9004
# 2. API credentials invalid: Check .env.dlt
# 3. Network unreachable: Check DLT_API_URL and firewall

# Solution:
docker-compose -f docker-compose.yml down
# Fix issue
docker-compose -f docker-compose.yml up -d dlt-node
```

### PostgreSQL Connection Errors

```bash
# Check PostgreSQL status
docker-compose -f docker-compose.yml ps dlt-postgres

# Check logs
docker-compose -f docker-compose.yml logs dlt-postgres

# Verify database exists
docker-compose -f docker-compose.yml exec dlt-postgres \
  psql -U dlt_user -l

# Reset database (WARNING: Deletes data)
docker-compose -f docker-compose.yml down -v
docker-compose -f docker-compose.yml up -d dlt-postgres
```

### Redis Connection Issues

```bash
# Test Redis connection
docker-compose -f docker-compose.yml exec dlt-redis \
  redis-cli -a $DLT_REDIS_PASSWORD ping

# Check memory usage
docker-compose -f docker-compose.yml exec dlt-redis \
  redis-cli -a $DLT_REDIS_PASSWORD info memory
```

### NGINX Configuration Errors

```bash
# Validate NGINX configuration
docker-compose -f docker-compose.yml exec dlt-nginx \
  nginx -t

# Check NGINX logs
docker-compose -f docker-compose.yml logs dlt-nginx

# Reload NGINX configuration
docker-compose -f docker-compose.yml exec dlt-nginx \
  nginx -s reload
```

---

## Health Checks

### Automated Health Checks

Each service has built-in health checks:

```bash
# View health status
docker-compose -f docker-compose.yml ps

# Example output:
# NAME              STATUS
# dlt-node          Up 5 minutes (healthy)
# dlt-postgres      Up 5 minutes (healthy)
# dlt-redis         Up 5 minutes (healthy)
# dlt-nginx         Up 5 minutes (healthy)
```

### Manual Health Verification

```bash
# DLT Node health
curl -s http://localhost:9004/health | jq .

# NGINX health
curl -s https://dlt.aurex.in/health

# PostgreSQL health
docker-compose -f docker-compose.yml exec dlt-postgres \
  pg_isready -U dlt_user

# Redis health
docker-compose -f docker-compose.yml exec dlt-redis \
  redis-cli -a $DLT_REDIS_PASSWORD ping

# Prometheus health
curl -s http://localhost:9091/-/healthy
```

---

## Management Commands

### View Logs

```bash
# All services
docker-compose -f docker-compose.yml logs

# Specific service
docker-compose -f docker-compose.yml logs dlt-node

# Follow logs (live)
docker-compose -f docker-compose.yml logs -f dlt-node

# Last 100 lines
docker-compose -f docker-compose.yml logs --tail=100
```

### Start/Stop Services

```bash
# Start all services
docker-compose -f docker-compose.yml up -d

# Stop all services
docker-compose -f docker-compose.yml down

# Stop and remove volumes (WARNING: Data loss)
docker-compose -f docker-compose.yml down -v

# Restart specific service
docker-compose -f docker-compose.yml restart dlt-node

# Stop specific service
docker-compose -f docker-compose.yml stop dlt-postgres
```

### Execute Commands in Container

```bash
# Interactive shell
docker-compose -f docker-compose.yml exec dlt-node bash

# Execute command
docker-compose -f docker-compose.yml exec dlt-node npm test

# PostgreSQL commands
docker-compose -f docker-compose.yml exec dlt-postgres \
  psql -U dlt_user -d aurigraph_dlt -c "SELECT * FROM transactions LIMIT 5;"
```

### Update Configuration

```bash
# Edit environment variables
nano /opt/hermes/dlt/.env.dlt

# Rebuild and restart services with new config
docker-compose -f docker-compose.yml build --no-cache
docker-compose -f docker-compose.yml up -d
```

---

## Performance Tuning

### Optimize PostgreSQL

```bash
# Increase max connections for high load
docker-compose -f docker-compose.yml down

# Edit docker-compose.yml, update postgres command with:
# - "-c"
# - "max_connections=200"
# - "-c"
# - "shared_buffers=512MB"

docker-compose -f docker-compose.yml up -d dlt-postgres
```

### Optimize Redis

```bash
# Increase memory allocation
# In docker-compose.yml, update dlt-redis service:
# command: redis-server --maxmemory 1gb --appendonly yes

docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml up -d dlt-redis
```

### Optimize NGINX

```bash
# Edit nginx-dlt.conf
# Increase worker_connections: 2048 -> 4096
# Increase buffer sizes for high throughput

# Reload configuration
docker-compose -f docker-compose.yml exec dlt-nginx \
  nginx -s reload
```

---

## Support & Documentation

- **Aurigraph DLT Docs**: https://docs.aurigraph.io
- **Aurigraph Console**: https://console.aurigraph.io
- **Docker Documentation**: https://docs.docker.com
- **PostgreSQL Documentation**: https://www.postgresql.org/docs
- **Grafana Documentation**: https://grafana.com/docs

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-28 | Initial deployment guide for HMS DLT integration |

---

**Document Status**: Production Ready
**Last Updated**: October 28, 2025
**Maintained By**: Hermes Development Team
