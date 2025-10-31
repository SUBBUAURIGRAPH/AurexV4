#!/bin/bash

# HMS Mobile Trading Platform - Remote Deployment Script
# Deploy to production server: hms.aurex.in / apihms.aurex.in
# Usage: ./deploy-remote.sh

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  HMS Mobile Trading Platform - Remote Deployment Script       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Configuration
REMOTE_USER="subbu"
REMOTE_HOST="hms.aurex.in"
REMOTE_DIR="/opt/HMS"
GITHUB_REPO="git@github.com:Aurigraph-DLT-Corp/HMS.git"
GITHUB_BRANCH="main"
CONTAINER_NAME="hms-mobile-web"
IMAGE_NAME="hms-web"
IMAGE_TAG="latest"

echo "Configuration:"
echo "  Remote Server: $REMOTE_USER@$REMOTE_HOST"
echo "  Working Directory: $REMOTE_DIR"
echo "  Git Repository: $GITHUB_REPO"
echo "  Branch: $GITHUB_BRANCH"
echo "  Container: $CONTAINER_NAME"
echo ""

# Create SSH command
SSH_CMD="ssh $REMOTE_USER@$REMOTE_HOST"

echo "Step 1: Connecting to remote server..."
$SSH_CMD "echo 'Connected to $REMOTE_HOST'" || exit 1
echo "✅ Connected"
echo ""

echo "Step 2: Setting up working directory..."
$SSH_CMD "mkdir -p $REMOTE_DIR && echo 'Working directory ready'"
echo "✅ Working directory created"
echo ""

echo "Step 3: Cloning/updating repository..."
$SSH_CMD "cd $REMOTE_DIR && if [ -d .git ]; then git pull origin $GITHUB_BRANCH; else git clone -b $GITHUB_BRANCH $GITHUB_REPO .; fi"
echo "✅ Repository updated"
echo ""

echo "Step 4: Stopping old containers..."
$SSH_CMD "cd $REMOTE_DIR && docker-compose -f mobile/docker-compose.yml down || true"
echo "✅ Old containers stopped"
echo ""

echo "Step 5: Pruning old images..."
$SSH_CMD "docker image prune -f || true"
echo "✅ Old images pruned"
echo ""

echo "Step 6: Building Docker image..."
$SSH_CMD "cd $REMOTE_DIR/mobile && docker build -t $IMAGE_NAME:$IMAGE_TAG ."
echo "✅ Docker image built"
echo ""

echo "Step 7: Creating logs directory..."
$SSH_CMD "mkdir -p $REMOTE_DIR/mobile/logs/nginx && chmod 755 $REMOTE_DIR/mobile/logs/nginx"
echo "✅ Logs directory created"
echo ""

echo "Step 8: Deploying container..."
$SSH_CMD "cd $REMOTE_DIR/mobile && docker-compose -f docker-compose.yml up -d"
echo "✅ Container deployed"
echo ""

echo "Step 9: Verifying deployment..."
$SSH_CMD "sleep 5 && docker-compose -f $REMOTE_DIR/mobile/docker-compose.yml ps"
echo ""

echo "Step 10: Checking health status..."
$SSH_CMD "docker inspect hms-mobile-web --format='Health Status: {{.State.Health.Status}}' || echo 'Health check initializing...'"
echo ""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✅ DEPLOYMENT COMPLETE                                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Deployment Details:"
echo "  Frontend: https://hms.aurex.in"
echo "  Backend API: https://apihms.aurex.in"
echo "  SSL Certificates: /etc/letsencrypt/live/aurexcrt1/"
echo "  Working Directory: /opt/HMS"
echo "  Container: $CONTAINER_NAME (running)"
echo ""
echo "Next Steps:"
echo "  1. Verify: https://hms.aurex.in"
echo "  2. Monitor: ssh $REMOTE_USER@$REMOTE_HOST"
echo "  3. View logs: docker-compose -f /opt/HMS/mobile/docker-compose.yml logs -f"
echo ""

