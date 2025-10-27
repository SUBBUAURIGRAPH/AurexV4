#!/bin/bash

##############################################################################
# J4C Agent Plugin Deployment Script for DLT Server
# Purpose: Deploy J4C Agent Plugin with Docker, NGINX, and SSL
# Target: dlt.aurigraph.io
# Date: October 27, 2025
##############################################################################

set -e

# Configuration
DEPLOY_HOST="subbu@dlt.aurigraph.io"
DEPLOY_PATH="/opt/DLT"
DOMAIN="dlt.aurigraph.io"
SSL_CERT_PATH="/etc/letsencrypt/live/aurcrt"
LOCAL_PROJECT_PATH="/Users/subbujois/subbuworkingdir/Aurex/glowing-adventure"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  J4C Agent Plugin Deployment to DLT Server                 ║${NC}"
echo -e "${BLUE}║  Version: 1.0.0                                            ║${NC}"
echo -e "${BLUE}║  Target: $DOMAIN                                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Target: $DEPLOY_HOST"
echo "  Path: $DEPLOY_PATH"
echo "  Domain: $DOMAIN"
echo "  SSL Certs: $SSL_CERT_PATH"
echo ""

# Step 1: Test SSH connection
echo -e "${YELLOW}Step 1: Testing SSH connection...${NC}"
if ssh -q $DEPLOY_HOST "echo 'SSH connection successful'" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ SSH connection successful${NC}"
else
    echo -e "${RED}✗ SSH connection failed${NC}"
    exit 1
fi

# Step 2: Verify remote environment
echo -e "\n${YELLOW}Step 2: Verifying remote environment...${NC}"
ssh $DEPLOY_HOST << 'VERIFY_ENV'
echo "  Checking Docker..."
docker --version || (echo "Docker not installed"; exit 1)

echo "  Checking SSL certificates..."
if [ -f "/etc/letsencrypt/live/aurcrt/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/aurcrt/privkey.pem" ]; then
    echo "  ✓ SSL certificates found"
else
    echo "  ✗ SSL certificates not found"
    exit 1
fi

echo "  Checking /opt/DLT directory..."
if [ -d "/opt/DLT" ]; then
    echo "  ✓ /opt/DLT directory exists"
else
    echo "  ✗ /opt/DLT directory does not exist"
    exit 1
fi
VERIFY_ENV

echo -e "${GREEN}✓ Environment verification complete${NC}"

# Step 3: Copy Docker configuration files
echo -e "\n${YELLOW}Step 3: Uploading Docker configuration files...${NC}"

echo "  Uploading docker-compose file..."
scp "$LOCAL_PROJECT_PATH/docker-compose.dlt-deployment.yml" \
    "$DEPLOY_HOST:$DEPLOY_PATH/docker-compose.yml"

echo "  Uploading NGINX configuration..."
scp "$LOCAL_PROJECT_PATH/nginx-dlt.conf" \
    "$DEPLOY_HOST:$DEPLOY_PATH/nginx.conf"

echo "  Uploading Prometheus configuration..."
scp "$LOCAL_PROJECT_PATH/prometheus-dlt.yml" \
    "$DEPLOY_HOST:$DEPLOY_PATH/prometheus.yml"

echo -e "${GREEN}✓ Configuration files uploaded${NC}"

# Step 4: Upload plugin files
echo -e "\n${YELLOW}Step 4: Uploading J4C Agent Plugin files...${NC}"

# Create plugin directory structure
ssh $DEPLOY_HOST "mkdir -p $DEPLOY_PATH/plugin"

# Upload plugin files
echo "  Uploading plugin source files..."
scp -r "$LOCAL_PROJECT_PATH/plugin/"* "$DEPLOY_HOST:$DEPLOY_PATH/plugin/"

echo -e "${GREEN}✓ Plugin files uploaded${NC}"

# Step 5: Create .env file
echo -e "\n${YELLOW}Step 5: Creating environment configuration...${NC}"

cat > /tmp/j4c.env << 'ENVFILE'
# J4C Agent Plugin Environment Variables
NODE_ENV=production
PORT=9003
LOG_LEVEL=info

# HubSpot Integration
HUBSPOT_API_KEY=${HUBSPOT_API_KEY:-}
HUBSPOT_PORTAL_ID=${HUBSPOT_PORTAL_ID:-}

# JIRA Integration
JIRA_URL=https://aurigraphdlt.atlassian.net
JIRA_API_KEY=${JIRA_API_KEY:-}

# GitHub Integration
GITHUB_TOKEN=${GITHUB_TOKEN:-}

# Slack Integration
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-}

# Database Configuration
DB_USER=j4c_user
DB_PASSWORD=j4c_password_change_me
DB_NAME=j4c_db

# Monitoring
GRAFANA_PASSWORD=grafana_password_change_me
ENVFILE

scp /tmp/j4c.env "$DEPLOY_HOST:$DEPLOY_PATH/.env"
rm /tmp/j4c.env

echo -e "${GREEN}✓ Environment file created${NC}"

# Step 6: Start Docker containers
echo -e "\n${YELLOW}Step 6: Starting Docker containers...${NC}"

ssh $DEPLOY_HOST << 'DOCKER_START'
cd /opt/DLT

echo "  Building and starting containers..."
docker-compose up -d

echo ""
echo "  Waiting for services to be ready..."
sleep 10

echo ""
echo "  Checking container status..."
docker-compose ps

echo ""
echo "  Checking J4C Agent health..."
docker-compose logs j4c-agent | tail -5
DOCKER_START

echo -e "${GREEN}✓ Docker containers started${NC}"

# Step 7: Verify deployment
echo -e "\n${YELLOW}Step 7: Verifying deployment...${NC}"

ssh $DEPLOY_HOST << 'VERIFY_DEPLOY'
cd /opt/DLT

echo "  Checking running containers..."
RUNNING=$(docker-compose ps --services --filter "status=running" | wc -l)
echo "  Running services: $RUNNING"

echo ""
echo "  Testing HTTPS connection..."
curl -s -k -I https://localhost/health 2>/dev/null | head -3

echo ""
echo "  Checking logs..."
echo "  J4C Agent logs:"
docker-compose logs j4c-agent | tail -3

echo ""
echo "  NGINX logs:"
docker-compose logs nginx-proxy | tail -3
VERIFY_DEPLOY

echo -e "${GREEN}✓ Deployment verification complete${NC}"

# Step 8: Final status
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║             Deployment Complete ✓                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

echo ""
echo -e "${GREEN}Deployment Summary:${NC}"
echo "  Target: https://$DOMAIN"
echo "  Path: $DEPLOY_PATH"
echo "  Containers: J4C Agent, NGINX, PostgreSQL, Prometheus, Grafana"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Configure environment variables:"
echo "     - HUBSPOT_API_KEY"
echo "     - JIRA_API_KEY"
echo "     - GITHUB_TOKEN"
echo "     - SLACK_WEBHOOK_URL"
echo "     - Database credentials"
echo ""
echo "  2. Update .env file:"
echo "     ssh $DEPLOY_HOST"
echo "     nano $DEPLOY_PATH/.env"
echo ""
echo "  3. Restart services:"
echo "     docker-compose restart"
echo ""
echo "  4. Access services:"
echo "     - J4C Agent API: https://$DOMAIN/api/v1"
echo "     - Grafana Dashboards: https://$DOMAIN/grafana"
echo "     - Prometheus Metrics: https://$DOMAIN/prometheus"
echo ""

echo -e "${YELLOW}Useful Commands:${NC}"
echo "  View logs:"
echo "    docker-compose logs -f j4c-agent"
echo ""
echo "  Check status:"
echo "    docker-compose ps"
echo ""
echo "  Restart services:"
echo "    docker-compose restart"
echo ""
echo "  Stop containers:"
echo "    docker-compose stop"
echo ""
echo "  Remove containers (keep volumes):"
echo "    docker-compose down"
echo ""

echo -e "${GREEN}Deployment successful! ✓${NC}"
