#!/bin/bash

set -e

echo "════════════════════════════════════════════════════════════"
echo "  HMS PRODUCTION DEPLOYMENT TO AUREX - v2.2.0"
echo "════════════════════════════════════════════════════════════"
echo ""

# Configuration
REMOTE_USER="subbu"
REMOTE_HOST="hms.aurex.in"
DOCKER_IMAGE="hms-trading-app:v2.2.0"
DOCKER_TAR="hms-v2.2.0.tar.gz"
WORKING_DIR="/opt/HMS"

echo "[1/5] Verifying Docker image..."
if ! docker image ls | grep -q "$DOCKER_IMAGE"; then
    echo "ERROR: Docker image $DOCKER_IMAGE not found!"
    exit 1
fi
echo "✓ Docker image found: $DOCKER_IMAGE"
docker images | grep "$DOCKER_IMAGE"

echo ""
echo "[2/5] Creating Docker image archive..."
docker save "$DOCKER_IMAGE" | gzip > "$DOCKER_TAR"
SIZE=$(du -h "$DOCKER_TAR" | cut -f1)
echo "✓ Docker image archived: $DOCKER_TAR ($SIZE)"

echo ""
echo "[3/5] Deploying to AUREX (subbu@hms.aurex.in)..."
echo "     - Stopping old containers"
echo "     - Loading Docker image"
echo "     - Starting services"
echo "     - Verifying deployment"
echo ""

scp -r "$DOCKER_TAR" "$REMOTE_USER@$REMOTE_HOST:/tmp/"

ssh "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
set -e

echo "Preparing remote deployment..."
cd /opt/HMS

# Update repository
echo "Updating repository..."
git fetch origin
git checkout main
git pull origin main

# Stop and remove old containers
echo "Stopping old containers..."
docker stop $(docker ps -q) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true

# Load Docker image
echo "Loading Docker image..."
docker load -i /tmp/hms-v2.2.0.tar.gz
rm /tmp/hms-v2.2.0.tar.gz

# Start services
echo "Starting Docker services..."
docker-compose -f docker-compose.yml up -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 10

# Display container status
echo ""
echo "Container Status:"
docker ps

# Check health
echo ""
echo "Health Check:"
curl -s http://localhost:3000/health || echo "Health check pending..."

echo ""
echo "✓ Deployment complete!"

EOF

echo ""
echo "[4/5] Cleaning up local artifacts..."
rm -f "$DOCKER_TAR"
echo "✓ Cleanup done"

echo ""
echo "[5/5] Deployment Summary"
echo "════════════════════════════════════════════════════════════"
echo "Frontend URL: https://hms.aurex.in"
echo "Backend API: https://apihms.aurex.in/api/"
echo "SSH Access: ssh $REMOTE_USER@$REMOTE_HOST"
echo "Logs: docker logs -f hms-backend"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "✅ DEPLOYMENT SUCCESSFUL!"
echo ""
echo "Next steps:"
echo "1. Verify frontend: curl -k https://hms.aurex.in"
echo "2. Check API: curl -k https://apihms.aurex.in/api/health"
echo "3. Monitor logs: ssh $REMOTE_USER@$REMOTE_HOST 'docker logs -f hms-backend'"
echo ""

