#!/bin/bash

# HMS NGINX Configuration Fix Script
# Fixes NGINX proxy configuration to properly route requests to HMS application
# Usage: ./fix-nginx-production.sh

set -e

echo "🔧 HMS NGINX Configuration Fix"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REMOTE_HOST="${1:-hms.aurex.in}"
REMOTE_USER="${2:-subbu}"
REMOTE_DIR="/opt/HMS"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Remote Host: $REMOTE_HOST"
echo "  Remote User: $REMOTE_USER"
echo "  Remote Dir: $REMOTE_DIR"
echo ""

# Step 1: Copy new NGINX configuration
echo -e "${YELLOW}Step 1: Uploading corrected NGINX configuration...${NC}"
scp -P 22 ./nginx-hms.conf "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/nginx-hms.conf"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ NGINX configuration uploaded successfully${NC}"
else
  echo -e "${RED}❌ Failed to upload NGINX configuration${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Backing up old NGINX configuration...${NC}"
ssh -p 22 "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && cp nginx-dlt.conf nginx-dlt.conf.backup.$(date +%Y%m%d_%H%M%S)"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Old configuration backed up${NC}"
else
  echo -e "${RED}❌ Failed to backup old configuration${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Step 3: Updating docker-compose.hms.yml...${NC}"
ssh -p 22 "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && \
  sed -i 's|./nginx-dlt.conf:|./nginx-hms.conf:|g' docker-compose.hms.yml && \
  sed -i 's|/etc/letsencrypt/live/aurcrt:|/etc/letsencrypt/live/aurexcrt1:|g' docker-compose.hms.yml"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ docker-compose.hms.yml updated${NC}"
else
  echo -e "${RED}❌ Failed to update docker-compose.hms.yml${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Step 4: Stopping old NGINX container...${NC}"
ssh -p 22 "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker-compose -f docker-compose.hms.yml stop nginx-proxy 2>/dev/null || true"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ NGINX container stopped${NC}"
else
  echo -e "${YELLOW}⚠️  NGINX container may not have been running${NC}"
fi

echo ""
echo -e "${YELLOW}Step 5: Removing old NGINX container...${NC}"
ssh -p 22 "$REMOTE_USER@$REMOTE_HOST" "docker rm -f hms-nginx-proxy 2>/dev/null || true"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Old NGINX container removed${NC}"
else
  echo -e "${YELLOW}⚠️  NGINX container may not have existed${NC}"
fi

echo ""
echo -e "${YELLOW}Step 6: Starting NGINX with new configuration...${NC}"
ssh -p 22 "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker-compose -f docker-compose.hms.yml up -d nginx-proxy"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ NGINX container started successfully${NC}"
else
  echo -e "${RED}❌ Failed to start NGINX container${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Step 7: Waiting for NGINX to be ready...${NC}"
sleep 3
ssh -p 22 "$REMOTE_USER@$REMOTE_HOST" "docker logs hms-nginx-proxy | tail -20"

echo ""
echo -e "${YELLOW}Step 8: Testing NGINX configuration...${NC}"
ssh -p 22 "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker exec hms-nginx-proxy nginx -t"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ NGINX configuration is valid${NC}"
else
  echo -e "${RED}❌ NGINX configuration has errors${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Step 9: Testing health endpoints...${NC}"
echo "Testing hms.aurex.in/health..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -k https://hms.aurex.in/health)
if [ "$FRONTEND_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Frontend health check passed (HTTP $FRONTEND_STATUS)${NC}"
else
  echo -e "${YELLOW}⚠️  Frontend returned HTTP $FRONTEND_STATUS (may need time to start)${NC}"
fi

echo ""
echo "Testing apihms.aurex.in/health..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -k https://apihms.aurex.in/health)
if [ "$API_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ API health check passed (HTTP $API_STATUS)${NC}"
else
  echo -e "${YELLOW}⚠️  API returned HTTP $API_STATUS (may need time to start)${NC}"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ NGINX Configuration Fix Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Next Steps:"
echo "1. Visit https://hms.aurex.in in your browser"
echo "2. Verify the HMS application is now loading (not nginx default page)"
echo "3. Check API at https://apihms.aurex.in/health"
echo ""
echo "If issues persist:"
echo "  - Check NGINX logs: ssh subbu@hms.aurex.in 'docker logs hms-nginx-proxy'"
echo "  - Check HMS application logs: ssh subbu@hms.aurex.in 'docker logs hms-j4c-agent'"
echo "  - Rollback: ssh subbu@hms.aurex.in 'cd /opt/HMS && cp nginx-dlt.conf.backup.* nginx-dlt.conf && docker-compose restart nginx-proxy'"
echo ""
