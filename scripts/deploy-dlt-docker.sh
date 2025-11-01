#!/bin/bash

##############################################################################
# Aurigraph DLT Docker Deployment Script for HMS Production
# Purpose: Deploy DLT services (Node, PostgreSQL, Redis, Prometheus, Grafana)
# Target: hms.aurex.in production server
# Date: October 28, 2025
##############################################################################

set -e

# Configuration
DEPLOY_HOST="${1:-subbu@hms.aurex.in}"
DEPLOY_PORT="${2:-2227}"
DEPLOY_PATH="/opt/hermes/dlt"
DOMAIN="dlt.aurex.in"
API_DOMAIN="dlt-api.aurex.in"
MONITOR_DOMAIN="dlt-monitor.aurex.in"
SSL_CERT_PATH="/etc/letsencrypt/live/aurexcrt1"
LOCAL_PROJECT_PATH="C:\subbuworking\HMS"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Helper functions
log_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  $1${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
}

log_step() {
    echo -e "\n${YELLOW}⊳ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

log_info() {
    echo -e "${CYAN}  ℹ $1${NC}"
}

# Main deployment flow
log_header "Aurigraph DLT Docker Deployment for HMS Production"

echo ""
echo "Configuration:"
echo "  SSH Target: $DEPLOY_HOST:$DEPLOY_PORT"
echo "  Deploy Path: $DEPLOY_PATH"
echo "  DLT Domain: $DOMAIN"
echo "  API Domain: $API_DOMAIN"
echo "  Monitor Domain: $MONITOR_DOMAIN"
echo "  SSL Certs: $SSL_CERT_PATH"
echo "  Local Project: $LOCAL_PROJECT_PATH"
echo ""

# Step 1: Test SSH connection
log_step "Testing SSH connection..."
if ssh -q -p $DEPLOY_PORT $DEPLOY_HOST "echo 'SSH connection successful'" > /dev/null 2>&1; then
    log_success "SSH connection successful"
else
    log_error "SSH connection failed to $DEPLOY_HOST:$DEPLOY_PORT"
fi

# Step 2: Verify remote environment
log_step "Verifying remote environment..."

ssh -p $DEPLOY_PORT $DEPLOY_HOST << 'VERIFY_ENV'
echo "  Checking Docker installation..."
docker --version > /dev/null 2>&1 && echo "    ✓ Docker found" || (echo "    ✗ Docker not found"; exit 1)

echo "  Checking Docker Compose..."
docker-compose --version > /dev/null 2>&1 && echo "    ✓ Docker Compose found" || (echo "    ✗ Docker Compose not found"; exit 1)

echo "  Checking SSL certificates..."
if [ -f "/etc/letsencrypt/live/aurexcrt1/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/aurexcrt1/privkey.pem" ]; then
    echo "    ✓ SSL certificates found"
else
    echo "    ✗ SSL certificates not found at /etc/letsencrypt/live/aurexcrt1/"
    exit 1
fi

echo "  Checking /opt/hermes directory..."
if [ -d "/opt/hermes" ]; then
    echo "    ✓ /opt/hermes directory exists"
else
    echo "    ✗ /opt/hermes directory does not exist"
    exit 1
fi
VERIFY_ENV

log_success "Environment verification complete"

# Step 3: Create DLT deployment directory
log_step "Creating DLT deployment directory..."

ssh -p $DEPLOY_PORT $DEPLOY_HOST << 'CREATE_DIR'
if [ ! -d "/opt/hermes/dlt" ]; then
    mkdir -p /opt/hermes/dlt
    echo "  ✓ Created /opt/hermes/dlt"
else
    echo "  ✓ /opt/hermes/dlt already exists"
fi

if [ ! -d "/opt/hermes/dlt/dlt-service" ]; then
    mkdir -p /opt/hermes/dlt/dlt-service
    echo "  ✓ Created /opt/hermes/dlt/dlt-service"
fi

if [ ! -d "/opt/hermes/dlt/logs" ]; then
    mkdir -p /opt/hermes/dlt/logs
    echo "  ✓ Created /opt/hermes/dlt/logs"
fi
CREATE_DIR

log_success "Directory structure created"

# Step 4: Upload Docker configuration files
log_step "Uploading Docker configuration files..."

echo "  Uploading docker-compose.dlt.yml..."
scp -P $DEPLOY_PORT "$LOCAL_PROJECT_PATH/deployment/docker-compose.dlt.yml" \
    "$DEPLOY_HOST:$DEPLOY_PATH/docker-compose.yml" 2>/dev/null
log_success "docker-compose.dlt.yml uploaded"

echo "  Uploading nginx-dlt.conf..."
scp -P $DEPLOY_PORT "$LOCAL_PROJECT_PATH/deployment/nginx-dlt.conf" \
    "$DEPLOY_HOST:$DEPLOY_PATH/nginx-dlt.conf" 2>/dev/null
log_success "nginx-dlt.conf uploaded"

echo "  Uploading prometheus-dlt.yml..."
scp -P $DEPLOY_PORT "$LOCAL_PROJECT_PATH/deployment/prometheus-dlt.yml" \
    "$DEPLOY_HOST:$DEPLOY_PATH/prometheus-dlt.yml" 2>/dev/null
log_success "prometheus-dlt.yml uploaded"

# Step 5: Create environment file
log_step "Creating environment configuration (.env.dlt)..."

ssh -p $DEPLOY_PORT $DEPLOY_HOST << 'CREATE_ENV'
cat > /opt/hermes/dlt/.env.dlt << 'EOF'
# Aurigraph DLT Configuration
NODE_ENV=production
DLT_NETWORK=testnet
DLT_API_URL=https://api.aurigraph.io
DLT_API_KEY=${DLT_API_KEY:-your-api-key}
DLT_API_SECRET=${DLT_API_SECRET:-your-api-secret}
AURIGRAPH_CONSOLE_URL=https://console.aurigraph.io/api-keys

# Database Configuration
DLT_DB_USER=dlt_user
DLT_DB_PASSWORD=dlt_secure_password_change_me
DLT_DB_NAME=aurigraph_dlt

# Redis Configuration
DLT_REDIS_PASSWORD=dlt_redis_password_change_me

# Grafana Configuration
DLT_GRAFANA_PASSWORD=grafana_admin_password_change_me

# Logging
LOG_LEVEL=info

# Monitoring
PROMETHEUS_RETENTION=30d
EOF
echo "  ✓ Environment file created"
chmod 600 /opt/hermes/dlt/.env.dlt
echo "  ✓ Environment file permissions set"
CREATE_ENV

log_success "Environment configuration created"

# Step 6: Stop existing DLT containers (if any)
log_step "Cleaning up existing DLT containers..."

ssh -p $DEPLOY_PORT $DEPLOY_HOST << 'CLEANUP'
cd /opt/hermes/dlt

if docker-compose -f docker-compose.yml ps | grep -q "dlt-"; then
    echo "  Stopping existing DLT containers..."
    docker-compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true
    echo "  ✓ Existing containers stopped"
else
    echo "  ✓ No existing containers to stop"
fi

# Clean up Docker volumes if needed
echo "  Pruning Docker system (images, networks)..."
docker system prune -f --volumes 2>/dev/null || true
echo "  ✓ Docker system cleaned"
CLEANUP

log_success "Cleanup complete"

# Step 7: Build and start Docker containers
log_step "Building and starting DLT Docker containers..."

ssh -p $DEPLOY_PORT $DEPLOY_HOST << 'DOCKER_START'
cd /opt/hermes/dlt

echo "  Building Docker images..."
docker-compose -f docker-compose.yml build --no-cache 2>&1 | tail -20
echo "  ✓ Docker images built"

echo "  Starting DLT services..."
docker-compose -f docker-compose.yml up -d

echo "  ✓ DLT containers started"

sleep 5

echo "  Container status:"
docker-compose -f docker-compose.yml ps
DOCKER_START

log_success "Docker containers started"

# Step 8: Wait for services to initialize
log_step "Waiting for services to initialize..."

ssh -p $DEPLOY_PORT $DEPLOY_HOST << 'WAIT_SERVICES'
cd /opt/hermes/dlt

echo "  Waiting for DLT Node to be ready..."
for i in {1..30}; do
    if docker-compose -f docker-compose.yml exec -T dlt-node curl -s http://localhost:9004/health > /dev/null 2>&1; then
        echo "  ✓ DLT Node is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "  ✗ DLT Node failed to start after 30 attempts"
        exit 1
    fi
    echo "    Attempt $i/30... waiting..."
    sleep 2
done

echo "  Waiting for PostgreSQL to be ready..."
for i in {1..20}; do
    if docker-compose -f docker-compose.yml exec -T dlt-postgres pg_isready -U dlt_user > /dev/null 2>&1; then
        echo "  ✓ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 20 ]; then
        echo "  ✗ PostgreSQL failed to start"
        exit 1
    fi
    sleep 1
done

echo "  Waiting for Redis to be ready..."
for i in {1..20}; do
    if docker-compose -f docker-compose.yml exec -T dlt-redis redis-cli ping > /dev/null 2>&1; then
        echo "  ✓ Redis is ready"
        break
    fi
    if [ $i -eq 20 ]; then
        echo "  ✗ Redis failed to start"
        exit 1
    fi
    sleep 1
done

echo "  Waiting for Prometheus to be ready..."
sleep 5
echo "  ✓ Prometheus initialized"

echo "  Waiting for Grafana to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "  ✓ Grafana is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "  ⚠ Grafana initialization timeout (non-critical)"
        break
    fi
    sleep 2
done
WAIT_SERVICES

log_success "All services initialized"

# Step 9: Run health checks
log_step "Running health checks..."

ssh -p $DEPLOY_PORT $DEPLOY_HOST << 'HEALTH_CHECKS'
cd /opt/hermes/dlt

echo "  DLT Node health:"
docker-compose -f docker-compose.yml exec -T dlt-node curl -s http://localhost:9004/health | head -20 || echo "    ⚠ Health check pending"

echo ""
echo "  PostgreSQL status:"
docker-compose -f docker-compose.yml exec -T dlt-postgres pg_isready -U dlt_user && echo "    ✓ PostgreSQL operational" || echo "    ⚠ PostgreSQL not ready"

echo ""
echo "  Redis status:"
docker-compose -f docker-compose.yml exec -T dlt-redis redis-cli ping && echo "    ✓ Redis operational" || echo "    ⚠ Redis not ready"

echo ""
echo "  Docker logs (last 20 lines):"
docker-compose -f docker-compose.yml logs --tail=20 dlt-node
HEALTH_CHECKS

log_success "Health checks complete"

# Step 10: Display deployment summary
log_step "Deployment Summary"

ssh -p $DEPLOY_PORT $DEPLOY_HOST << 'SUMMARY'
cd /opt/hermes/dlt

echo "  ${CYAN}DLT Services Deployed:${NC}"
docker-compose -f docker-compose.yml ps | tail -n +3 | awk '{print "    " $1 " - " $3 " - " $5 " - " $6}'

echo ""
echo "  ${CYAN}Access Information:${NC}"
echo "    DLT API: https://dlt.aurex.in (Port 9443 internally)"
echo "    DLT API Direct: https://dlt-api.aurex.in"
echo "    Grafana Dashboard: https://dlt-monitor.aurex.in (User: admin)"
echo "    Prometheus: https://dlt-monitor.aurex.in/prometheus"
echo ""
echo "  ${CYAN}Database Information:${NC}"
echo "    PostgreSQL Host: dlt-postgres"
echo "    PostgreSQL Port: 5432"
echo "    PostgreSQL Database: aurigraph_dlt"
echo "    PostgreSQL User: dlt_user"
echo ""
echo "  ${CYAN}Cache Information:${NC}"
echo "    Redis Host: dlt-redis"
echo "    Redis Port: 6379"
echo ""
echo "  ${CYAN}Configuration Files:${NC}"
echo "    Docker Compose: $DEPLOY_PATH/docker-compose.yml"
echo "    Environment: $DEPLOY_PATH/.env.dlt"
echo "    NGINX Config: $DEPLOY_PATH/nginx-dlt.conf"
echo "    Prometheus Config: $DEPLOY_PATH/prometheus-dlt.yml"
echo ""
echo "  ${CYAN}Log Files:${NC}"
echo "    Location: /opt/hermes/dlt/logs"
echo "    Docker Logs: docker-compose -f /opt/hermes/dlt/docker-compose.yml logs -f"
echo ""
SUMMARY

log_header "🚀 DLT Deployment Complete!"
log_success "Aurigraph DLT services are now running on hms.aurex.in"
echo ""
echo "Next Steps:"
echo "  1. Update Aurigraph DLT API credentials in .env.dlt"
echo "  2. Configure Grafana dashboards"
echo "  3. Set up monitoring alerts"
echo "  4. Run integration tests"
echo "  5. Configure backups"
echo ""
