#!/bin/bash
set -e

REMOTE_USER="subbu"
REMOTE_HOST="hms.aurex.in"
REMOTE_PATH="/opt/HMS"
IMAGE_TAG="$(git rev-parse --short HEAD)"

echo "Deploying HERMES HF to production..."
echo "Host: $REMOTE_HOST"
echo "Path: $REMOTE_PATH"
echo "Image Tag: $IMAGE_TAG"

# Build image
echo ""
echo "Building Docker image..."
docker build -t hms-hermes:$IMAGE_TAG -t hms-hermes:latest .

# Save and transfer
echo "Transferring image..."
docker save hms-hermes:$IMAGE_TAG | gzip | ssh -i ~/.ssh/id_rsa ${REMOTE_USER}@${REMOTE_HOST} "cd $REMOTE_PATH && gunzip | docker load"

# Deploy on remote
echo "Deploying on remote..."
ssh -i ~/.ssh/id_rsa ${REMOTE_USER}@${REMOTE_HOST} << 'REMOTE'
cd /opt/HMS
git fetch origin
git checkout main
git pull origin main
docker-compose down || true
docker image prune -f --filter "dangling=true"
docker image prune -f -a --filter "until=168h"
docker container prune -f
docker volume prune -f
docker-compose up -d
sleep 10
docker-compose ps
REMOTE

echo ""
echo "✓ Deployment complete!"
echo "Frontend: https://hms.aurex.in"
echo "Backend: https://apihms.aurex.in"
echo "View logs: ssh subbu@hms.aurex.in 'cd /opt/HMS && docker-compose logs -f'"

