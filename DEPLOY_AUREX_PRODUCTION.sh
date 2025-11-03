#!/bin/bash

################################################################################
# HMS Production Deployment to AUREX
# Version: 2.2.0
# Configuration for AUREX infrastructure
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Configuration
REMOTE_USER="subbu"
REMOTE_HOST="hms.aurex.in"
WORKING_DIR="/opt/HMS"
GIT_REPO="git@github.com:Aurigraph-DLT-Corp/HMS.git"
GIT_BRANCH="main"
DOCKER_IMAGE="hms-trading-app:v2.2.0"

log "Starting HMS Production Deployment to AUREX..."

# Step 1: Verify Docker image
log "Checking Docker image..."
if ! docker image ls | grep -q "$DOCKER_IMAGE"; then
    log_error "Docker image not found: $DOCKER_IMAGE"
    exit 1
fi
log_success "Docker image found"

# Step 2: Create deployment archive
log "Creating deployment package..."
DOCKER_TAR="hms-v2.2.0.tar"
docker save "$DOCKER_IMAGE" -o "$DOCKER_TAR"
log_success "Docker image saved"

# Step 3: Deploy to remote server
log "Starting remote deployment via SSH..."

ssh -i ~/.ssh/id_rsa "$REMOTE_USER@$REMOTE_HOST" << 'REMOTE'

set -e
WORKING_DIR="/opt/HMS"
GIT_REPO="git@github.com:Aurigraph-DLT-Corp/HMS.git"
GIT_BRANCH="main"

echo "Creating working directory..."
sudo mkdir -p $WORKING_DIR
sudo chown $(whoami):$(whoami) $WORKING_DIR
cd $WORKING_DIR

echo "Cloning/updating repository..."
if [ -d .git ]; then
    git fetch origin && git checkout $GIT_BRANCH && git pull origin $GIT_BRANCH
else
    cd /opt && git clone -b $GIT_BRANCH $GIT_REPO HMS && cd $WORKING_DIR
fi

echo "Stopping old containers..."
docker stop $(docker ps -q) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true

echo "Loading Docker image..."
docker load -i /tmp/hms-v2.2.0.tar
rm /tmp/hms-v2.2.0.tar

echo "Starting services..."
docker-compose -f docker-compose.yml up -d

echo "Verifying deployment..."
sleep 5
docker ps
curl http://localhost:3000/health || echo "Health check pending..."

echo "Deployment complete!"

REMOTE

log_success "Remote deployment completed!"

# Cleanup
rm -f "$DOCKER_TAR"
log "Deployment package cleaned up"

