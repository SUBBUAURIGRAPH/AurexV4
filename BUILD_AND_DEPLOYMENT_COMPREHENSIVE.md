# HMS Build and Deployment Comprehensive Guide

**Date**: November 1, 2025
**Version**: 2.0.0
**Target Environment**: Production (hms.aurex.in)
**Deployment Strategy**: Docker + Docker Compose

---

## Executive Summary

This document provides a comprehensive guide for building and deploying the HMS (Hermes Trading Platform) system to a remote production server. The deployment uses Docker containerization with the following components:

- **Frontend**: React/TypeScript web dashboard (web/)
- **Backend**: Express.js API server (backend/)
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Reverse Proxy**: Nginx
- **Monitoring**: Prometheus + Grafana
- **Log Aggregation**: Loki + Promtail

---

## Project Structure Analysis

### Current State
```
HMS/
├── web/                     # React frontend (incomplete - no package.json)
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── store/
│   └── node_modules/
├── backend/                 # Express.js API (Phase 3 Part 2 complete)
│   ├── src/
│   │   ├── config/
│   │   ├── api/
│   │   └── app.ts
│   └── .env.example
├── mobile/                  # React Native app
│   └── package.json
├── plugin/                  # Plugin system
│   └── package.json
├── strategy-builder/        # Strategy builder tool
│   └── package.json
├── Dockerfile              # Multi-stage build for app
├── docker-compose.yml      # Development compose
├── docker-compose.prod.yml # Production compose
└── deploy-production.sh    # Deployment script
```

### Key Observations

**✅ What's Ready**:
- Docker and docker-compose configuration exists
- Backend Phase 3 Part 2 implementation complete (services, routes, controllers)
- Database migrations ready (Phase 3 Part 1)
- Deployment script exists (deploy-production.sh)
- Monitoring stack configured (Prometheus, Grafana, Loki)

**⚠️ What's Missing**:
- Root-level package.json for monolithic build
- Web frontend package.json
- Backend package.json
- Build scripts (npm run build for web/backend)
- Production environment file (.env)

---

## Step 1: Prerequisites Check

Before starting deployment, verify:

```bash
# Check Node.js version
node --version  # Should be v18+

# Check npm version
npm --version   # Should be v9+

# Check Docker
docker --version

# Check Docker Compose
docker-compose --version

# Check Git
git status
git remote -v

# Check SSH access to remote server
ssh -o ConnectTimeout=5 subbu@hms.aurex.in "echo 'Connected successfully'"
```

---

## Step 2: Create Root-Level Package.json

The Dockerfile expects a package.json at the root level. Create this file:

**File**: `HMS/package.json`

```json
{
  "name": "hms-trading-platform",
  "version": "2.0.0",
  "description": "Hermes Trading Platform - AI-Powered Trading System",
  "main": "backend/src/server.ts",
  "type": "module",
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "scripts": {
    "dev": "concurrently \"npm:dev:backend\" \"npm:dev:web\"",
    "dev:backend": "cd backend && npm run dev",
    "dev:web": "cd web && npm run dev",
    "build": "npm run build:backend && npm run build:web",
    "build:backend": "cd backend && npm run build",
    "build:web": "cd web && npm run build",
    "start": "node backend/src/server.js",
    "test": "npm run test:backend && npm run test:web",
    "test:backend": "cd backend && npm run test",
    "test:web": "cd web && npm run test",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"**/*.{ts,tsx,js,json,md}\""
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express-async-errors": "^3.1.1"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "typescript": "^5.2.2",
    "@types/node": "^20.9.0",
    "eslint": "^8.52.0",
    "prettier": "^3.0.3"
  }
}
```

---

## Step 3: Create Backend Package.json

**File**: `HMS/backend/package.json`

```json
{
  "name": "hms-backend",
  "version": "2.0.0",
  "description": "HMS Backend API Server",
  "main": "src/server.ts",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node src/server.js",
    "test": "jest",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\""
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express-async-errors": "^3.1.1"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "@types/express": "^4.17.21",
    "@types/node": "^20.9.0",
    "@types/pg": "^8.10.7",
    "tsx": "^3.14.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.7",
    "eslint": "^8.52.0",
    "prettier": "^3.0.3"
  }
}
```

---

## Step 4: Create Web Frontend Package.json

**File**: `HMS/web/package.json`

```json
{
  "name": "hms-web",
  "version": "2.0.0",
  "description": "HMS Web Dashboard",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "lint": "eslint src --ext .ts,.tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx}\""
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-redux": "^8.1.3",
    "@reduxjs/toolkit": "^1.9.7",
    "react-router-dom": "^6.17.0"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "@types/react": "^18.2.31",
    "@types/react-dom": "^18.2.14",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.1.0",
    "eslint": "^8.52.0",
    "prettier": "^3.0.3",
    "vitest": "^0.34.6"
  }
}
```

---

## Step 5: Build Process

### 5.1 Install Dependencies

```bash
# Navigate to project root
cd /path/to/HMS

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install web dependencies
cd web
npm install
cd ..
```

### 5.2 Build Backend

```bash
# From HMS root
npm run build:backend

# Or from backend directory
cd backend
npm run build
```

### 5.3 Build Frontend

```bash
# From HMS root
npm run build:web

# Or from web directory
cd web
npm run build
```

### 5.4 Build Both

```bash
# From HMS root
npm run build
```

---

## Step 6: Create Docker Build and Push

### 6.1 Build Docker Image Locally

```bash
# From HMS root directory
docker build -t hms-gnn:latest \
    --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    --build-arg VCS_REF="$(git rev-parse --short HEAD)" \
    -f Dockerfile .

# Tag for registry (if using Docker Hub or private registry)
docker tag hms-gnn:latest your-registry/hms-gnn:latest
```

### 6.2 Verify Image

```bash
# List images
docker images | grep hms-gnn

# Run container locally to test
docker run -p 3000:3000 \
    -e NODE_ENV=production \
    -e DATABASE_URL=postgresql://user:pass@postgres:5432/hms \
    hms-gnn:latest
```

---

## Step 7: Prepare Production Environment

### 7.1 Create .env File

**File**: `HMS/.env.production`

```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=hms_trading
DB_USER=hms_user
DB_PASSWORD=SECURE_PASSWORD_HERE
DATABASE_URL=postgresql://hms_user:SECURE_PASSWORD_HERE@postgres:5432/hms_trading

# JWT
JWT_SECRET=VERY_SECURE_JWT_SECRET_KEY_HERE
JWT_EXPIRY=24h
JWT_REFRESH_SECRET=VERY_SECURE_REFRESH_SECRET_HERE
JWT_REFRESH_EXPIRY=7d

# CORS
CORS_ORIGIN=https://hms.aurex.in
CORS_CREDENTIALS=true

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_PASSWORD=SECURE_GRAFANA_PASSWORD_HERE

# Cache
REDIS_HOST=redis
REDIS_PORT=6379
CACHE_TTL=3600000

# API
API_KEY=SECURE_API_KEY_HERE

# Slack (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 7.2 Copy to Remote Server (Pre-deployment)

```bash
# Securely copy env file to remote
scp .env.production subbu@hms.aurex.in:/opt/HMS/.env

# Or after deployment, update on remote
ssh subbu@hms.aurex.in "cd /opt/HMS && cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
...
EOF"
```

---

## Step 8: Deploy to Remote Server

### 8.1 Automated Deployment Script

Create an updated deployment script:

**File**: `HMS/deploy-hms-v2.sh`

```bash
#!/bin/bash

# HMS v2.0 Production Deployment Script
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REMOTE_USER="subbu"
REMOTE_HOST="hms.aurex.in"
REMOTE_DIR="/opt/HMS"
GIT_BRANCH="main"
DOCKER_IMAGE="hms-gnn"
DOCKER_TAG="v2.0.0"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}    HMS v2.0 Production Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Step 1: Build
echo -e "${YELLOW}[1/8] Installing dependencies...${NC}"
npm install
npm run build:backend
npm run build:web
echo -e "${GREEN}✓ Build complete${NC}\n"

# Step 2: Build Docker image
echo -e "${YELLOW}[2/8] Building Docker image...${NC}"
docker build -t "${DOCKER_IMAGE}:${DOCKER_TAG}" \
    --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    --build-arg VCS_REF="$(git rev-parse --short HEAD)" \
    -f Dockerfile .
echo -e "${GREEN}✓ Docker image built${NC}\n"

# Step 3: Test locally
echo -e "${YELLOW}[3/8] Testing image...${NC}"
docker images | grep "${DOCKER_IMAGE}" || exit 1
echo -e "${GREEN}✓ Image verified${NC}\n"

# Step 4: Save image
echo -e "${YELLOW}[4/8] Saving and transferring image...${NC}"
TEMP_FILE="/tmp/hms-gnn-${DOCKER_TAG}.tar"
docker save "${DOCKER_IMAGE}:${DOCKER_TAG}" -o "${TEMP_FILE}"
scp -o ConnectTimeout=10 "${TEMP_FILE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
rm -f "${TEMP_FILE}"
echo -e "${GREEN}✓ Image transferred${NC}\n"

# Step 5: Prepare remote
echo -e "${YELLOW}[5/8] Preparing remote server...${NC}"
ssh -o ConnectTimeout=10 "${REMOTE_USER}@${REMOTE_HOST}" << 'EOFPREP'
set -e
REMOTE_DIR="/opt/HMS"
sudo mkdir -p "${REMOTE_DIR}"
sudo chown -R $(whoami):$(whoami) "${REMOTE_DIR}"
echo "Remote directory ready"
EOFPREP
echo -e "${GREEN}✓ Remote prepared${NC}\n"

# Step 6: Stop and clean
echo -e "${YELLOW}[6/8] Stopping and cleaning containers...${NC}"
ssh -o ConnectTimeout=10 "${REMOTE_USER}@${REMOTE_HOST}" << 'EOFSTOP'
set +e
cd /opt/HMS
docker-compose down 2>/dev/null || true
docker ps -a | grep "hms" | awk '{print $1}' | xargs -r docker stop 2>/dev/null || true
docker ps -a | grep "hms" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true
docker image prune -f --filter "dangling=true" 2>/dev/null || true
set -e
echo "Cleanup complete"
EOFSTOP
echo -e "${GREEN}✓ Cleanup complete${NC}\n"

# Step 7: Deploy
echo -e "${YELLOW}[7/8] Deploying application...${NC}"
ssh -o ConnectTimeout=10 "${REMOTE_USER}@${REMOTE_HOST}" << 'EOFDEPLOY'
set -e
cd /opt/HMS
DOCKER_IMAGE="hms-gnn"
DOCKER_TAG="v2.0.0"

echo "Loading Docker image..."
docker load -i hms-gnn-${DOCKER_TAG}.tar
rm -f hms-gnn-${DOCKER_TAG}.tar

echo "Starting services..."
if [ -f "docker-compose.prod.yml" ]; then
    docker-compose -f docker-compose.prod.yml up -d
else
    docker-compose -f docker-compose.yml up -d
fi

sleep 30
echo "Services started"
EOFDEPLOY
echo -e "${GREEN}✓ Application deployed${NC}\n"

# Step 8: Verify
echo -e "${YELLOW}[8/8] Verifying deployment...${NC}"
ssh -o ConnectTimeout=10 "${REMOTE_USER}@${REMOTE_HOST}" << 'EOFVERIFY'
echo "Running containers:"
docker ps | grep -E "CONTAINER|hms" || echo "No hms containers running"
echo ""
echo "Health checks:"
curl -s http://localhost:3000/health 2>/dev/null | jq . || echo "API health check pending..."
echo ""
echo "Docker images:"
docker images | grep "hms-gnn"
EOFVERIFY
echo -e "${GREEN}✓ Deployment verified${NC}\n"

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ DEPLOYMENT COMPLETE${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Access Points:"
echo "  Frontend: https://hms.aurex.in"
echo "  Backend API: https://apihms.aurex.in"
echo "  Grafana: https://hms.aurex.in:3001"
echo "  Prometheus: https://hms.aurex.in:9090"
echo ""
echo "Useful Commands:"
echo "  Logs: ssh subbu@hms.aurex.in 'cd /opt/HMS && docker-compose logs -f app'"
echo "  Status: ssh subbu@hms.aurex.in 'docker ps'"
echo "  Restart: ssh subbu@hms.aurex.in 'cd /opt/HMS && docker-compose restart'"
echo ""
```

### 8.2 Run Deployment

```bash
# Make script executable
chmod +x deploy-hms-v2.sh

# Run deployment
./deploy-hms-v2.sh
```

---

## Step 9: Post-Deployment Verification

### 9.1 Check Services Status

```bash
# SSH into remote
ssh subbu@hms.aurex.in

# Check running containers
docker ps

# Check logs
docker-compose logs -f

# Check health endpoints
curl http://localhost:3000/health
curl http://localhost:3001/health  # Grafana

# Exit SSH
exit
```

### 9.2 Database Verification

```bash
# Connect to PostgreSQL
ssh subbu@hms.aurex.in
docker exec -it hms-postgres psql -U hms_user -d hms_trading -c "SELECT version();"
exit
```

### 9.3 Health Checks

```bash
# From local machine
# Test frontend
curl -I https://hms.aurex.in

# Test backend
curl https://apihms.aurex.in/api/v1/health

# Test Grafana
curl -I https://hms.aurex.in:3001
```

---

## Step 10: Monitoring and Maintenance

### 10.1 View Logs

```bash
# Real-time logs
ssh subbu@hms.aurex.in "cd /opt/HMS && docker-compose logs -f app"

# Specific service
ssh subbu@hms.aurex.in "cd /opt/HMS && docker-compose logs -f postgres"

# Last 100 lines
ssh subbu@hms.aurex.in "cd /opt/HMS && docker-compose logs --tail=100 app"
```

### 10.2 Restart Services

```bash
# Restart all services
ssh subbu@hms.aurex.in "cd /opt/HMS && docker-compose restart"

# Restart specific service
ssh subbu@hms.aurex.in "cd /opt/HMS && docker-compose restart app"

# Restart without downtime (rolling restart)
ssh subbu@hms.aurex.in "cd /opt/HMS && docker-compose restart postgres && sleep 10 && docker-compose restart app"
```

### 10.3 Update Configuration

```bash
# Update .env
ssh subbu@hms.aurex.in "nano /opt/HMS/.env"

# Reload services after config change
ssh subbu@hms.aurex.in "cd /opt/HMS && docker-compose restart app"
```

---

## Troubleshooting

### Issue: Containers not starting

```bash
# Check logs
docker-compose logs app

# Check if ports are available
netstat -tlnp | grep 3000

# Kill any existing process on port 3000
lsof -i :3000
kill -9 <PID>
```

### Issue: Database connection failed

```bash
# Check PostgreSQL status
docker ps | grep postgres

# Test connection
docker exec hms-postgres psql -U hms_user -c "SELECT 1"

# Check environment variables
docker inspect hms-app | grep -A 20 "Env"
```

### Issue: High memory usage

```bash
# Check container stats
docker stats

# Reduce PostgreSQL cache
docker exec hms-postgres psql -U hms_user -c "ALTER SYSTEM SET shared_buffers = '256MB';"

# Restart PostgreSQL
docker-compose restart postgres
```

### Issue: SSL certificate errors

```bash
# Check certificate validity
ssh subbu@hms.aurex.in "openssl x509 -in /etc/nginx/ssl/cert.pem -text -noout"

# Renew certificate (if using Let's Encrypt)
ssh subbu@hms.aurex.in "certbot renew --nginx"
```

---

## Rollback Procedure

If deployment fails and you need to rollback:

```bash
# Connect to remote
ssh subbu@hms.aurex.in

cd /opt/HMS

# Stop current containers
docker-compose down

# Load previous image (if saved)
docker load -i hms-gnn-v1.9.9.tar

# Run old version
docker-compose up -d

# Verify
docker ps
curl http://localhost:3000/health
```

---

## Performance Optimization

### 10.1 Database Optimization

```sql
-- Create indexes for faster queries
CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX idx_positions_portfolio_id ON positions(portfolio_id);
CREATE INDEX idx_trades_portfolio_id ON trades(portfolio_id);
CREATE INDEX idx_trades_date ON trades(trade_date DESC);

-- Vacuum database
VACUUM ANALYZE;
```

### 10.2 Redis Caching

```bash
# Check Redis memory
redis-cli INFO memory

# Clear cache if needed
redis-cli FLUSHALL
```

### 10.3 Nginx Configuration

```bash
# Enable gzip compression
# Already configured in nginx.conf

# Monitor Nginx
curl http://localhost:80/nginx_status
```

---

## Disaster Recovery

### Backup Procedure

```bash
# Backup PostgreSQL
ssh subbu@hms.aurex.in "docker exec hms-postgres pg_dump -U hms_user hms_trading | gzip > /opt/HMS/backup-$(date +%Y%m%d).sql.gz"

# Backup Docker volumes
ssh subbu@hms.aurex.in "tar czf /opt/HMS/volume-backup-$(date +%Y%m%d).tar.gz -C /var/lib/docker/volumes ."

# Copy backups to local
scp subbu@hms.aurex.in:/opt/HMS/backup-*.sql.gz ./backups/
```

### Restore Procedure

```bash
# Restore PostgreSQL
ssh subbu@hms.aurex.in "gunzip -c backup-20251101.sql.gz | docker exec -i hms-postgres psql -U hms_user hms_trading"

# Verify
ssh subbu@hms.aurex.in "docker exec hms-postgres psql -U hms_user -c \"SELECT COUNT(*) FROM portfolios;\""
```

---

## Monitoring Dashboard

After deployment, access:

- **Grafana**: https://hms.aurex.in:3001 (Default: admin/admin)
- **Prometheus**: https://hms.aurex.in:9090
- **API Logs**: `docker-compose logs -f app`

---

## Success Criteria

✅ Deployment successful when:
- All docker containers are running (`docker ps`)
- Health check endpoints respond (HTTP 200)
- Database connectivity verified
- Frontend loads at https://hms.aurex.in
- API endpoints respond at /api/v1/health
- Monitoring dashboards accessible

---

## Next Steps

1. ✅ Create package.json files
2. ✅ Build applications
3. ✅ Build Docker image
4. ✅ Run deployment script
5. ✅ Verify health checks
6. Run comprehensive test suite (Phase 3 Part 3)
7. Set up continuous deployment (GitHub Actions)
8. Configure backup and disaster recovery

---

**Document Version**: 2.0.0
**Last Updated**: November 1, 2025
**Status**: Ready for Deployment

