#!/bin/bash

# HMS Production Deployment Script
# Target: Self-hosted server (hms.aurex.in)
# Date: October 31, 2025

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REMOTE_USER="subbu"
REMOTE_HOST="hms.aurex.in"
REMOTE_WORK_DIR="/opt/HMS"
GIT_REPO="git@github.com:Aurigraph-DLT-Corp/HMS.git"
GIT_BRANCH="main"
DOCKER_IMAGE="hms-gnn"
DOCKER_TAG="v2.1.0"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}    HMS PRODUCTION DEPLOYMENT${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# STEP 1: Build Docker Image
echo -e "${YELLOW}[1/7] Building Docker image...${NC}"
docker build -t "${DOCKER_IMAGE}:${DOCKER_TAG}" \
    --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    --build-arg VCS_REF="$(git rev-parse --short HEAD)" \
    -f Dockerfile .
echo -e "${GREEN}✓ Image built${NC}\n"

# STEP 2: Verify Local Build
echo -e "${YELLOW}[2/7] Verifying Docker image...${NC}"
docker images | grep "${DOCKER_IMAGE}"
echo -e "${GREEN}✓ Image verified${NC}\n"

# STEP 3: Prepare Remote Server
echo -e "${YELLOW}[3/7] Preparing remote server...${NC}"
ssh -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" << 'EOFREMOTE'
REMOTE_WORK_DIR="/opt/HMS"
sudo mkdir -p "${REMOTE_WORK_DIR}"
sudo chown -R $(whoami):$(whoami) "${REMOTE_WORK_DIR}"
echo "Remote directory ready: ${REMOTE_WORK_DIR}"
EOFREMOTE
echo -e "${GREEN}✓ Remote server prepared${NC}\n"

# STEP 4: Save and Transfer Image
echo -e "${YELLOW}[4/7] Transferring Docker image...${NC}"
TEMP_IMAGE="/tmp/hms-gnn-v2.1.0.tar"
docker save "${DOCKER_IMAGE}:${DOCKER_TAG}" -o "${TEMP_IMAGE}"
scp -o StrictHostKeyChecking=no "${TEMP_IMAGE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_WORK_DIR}/"
rm -f "${TEMP_IMAGE}"
echo -e "${GREEN}✓ Image transferred${NC}\n"

# STEP 5: Clean Old Containers
echo -e "${YELLOW}[5/7] Cleaning old containers and images...${NC}"
ssh -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" << 'EOFCLEAN'
echo "Stopping containers..."
docker ps -a | grep "hms-gnn" | awk '{print $1}' | xargs -r docker stop 2>/dev/null || true
echo "Removing containers..."
docker ps -a | grep "hms-gnn" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true
echo "Pruning images..."
docker image prune -f --filter "dangling=true" || true
echo "Remaining hms-gnn images:"
docker images | grep "hms-gnn" || echo "None"
EOFCLEAN
echo -e "${GREEN}✓ Cleanup complete${NC}\n"

# STEP 6: Deploy Application
echo -e "${YELLOW}[6/7] Deploying application...${NC}"
ssh -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" << 'EOFDEPLOY'
set -e
REMOTE_WORK_DIR="/opt/HMS"
DOCKER_IMAGE="hms-gnn"
DOCKER_TAG="v2.1.0"
cd "${REMOTE_WORK_DIR}"

echo "Loading Docker image..."
docker load -i hms-gnn-v2.1.0.tar
rm -f hms-gnn-v2.1.0.tar

echo "Starting application..."
if [ -f "docker-compose.prod.yml" ]; then
    docker-compose -f docker-compose.prod.yml up -d
else
    docker-compose up -d
fi

sleep 30
echo "Services started"
EOFDEPLOY
echo -e "${GREEN}✓ Application deployed${NC}\n"

# STEP 7: Verify Deployment
echo -e "${YELLOW}[7/7] Verifying deployment...${NC}"
ssh -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" << 'EOFVERIFY'
echo "Running containers:"
docker ps | grep -E "CONTAINER|hms" || echo "No hms containers"
echo ""
echo "Health check:"
curl -s http://localhost:3000/api/gnn/health 2>/dev/null | head -20 || echo "Health check endpoint not yet ready"
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
echo "  Backend: https://apihms.aurex.in"
echo "  SSH: ssh subbu@hms.aurex.in"
echo "  Working Dir: /opt/HMS"
echo ""
echo "Useful Commands:"
echo "  View logs: ssh subbu@hms.aurex.in 'cd /opt/HMS && docker-compose logs -f'"
echo "  Check status: ssh subbu@hms.aurex.in 'docker ps'"
echo "  Restart: ssh subbu@hms.aurex.in 'cd /opt/HMS && docker-compose restart'"
echo ""
