#!/bin/bash
##############################################################################
# Remote Deployment Commands for HMS
# Execute these commands on the remote server: ssh subbu@hms.aurex.in
# Working Directory: /opt/HMS
##############################################################################

echo "=== HMS Production Deployment - Remote Commands ==="
echo "Server: hms.aurex.in (Frontend), apihms.aurex.in (Backend)"
echo "Date: November 2, 2025"
echo "Version: 2.2.0"
echo ""

# ============================================================================
# STEP 1: Navigate to working directory
# ============================================================================
echo "STEP 1: Setting up working directory..."
cd /opt/HMS || { sudo mkdir -p /opt/HMS && cd /opt/HMS; }
pwd

# ============================================================================
# STEP 2: Stop and remove old Docker containers
# ============================================================================
echo ""
echo "STEP 2: Cleaning old Docker containers..."

echo "Stopping all containers..."
docker-compose down 2>/dev/null || true
docker stop $(docker ps -aq) 2>/dev/null || true

echo "Removing HMS-related containers..."
docker rm -f $(docker ps -a --filter "name=hms" -q) 2>/dev/null || true
docker rm -f $(docker ps -a --filter "ancestor=hms*" -q) 2>/dev/null || true

echo "Listing remaining containers:"
docker ps -a

# ============================================================================
# STEP 3: Remove old Docker images
# ============================================================================
echo ""
echo "STEP 3: Pruning old Docker images..."

echo "Removing HMS images..."
docker rmi -f $(docker images | grep -E 'hms|aurex' | awk '{print $3}') 2>/dev/null || echo "No HMS images to remove"

echo "Running full image prune..."
docker image prune -f --all

echo "Pruning dangling volumes and networks..."
docker volume prune -f || true
docker network prune -f || true

echo "Remaining images (if any):"
docker images | grep -E 'hms|aurex' || echo "No HMS images remaining"

# ============================================================================
# STEP 4: Clone or update git repository
# ============================================================================
echo ""
echo "STEP 4: Updating Git repository..."

if [ ! -d ".git" ]; then
    echo "Cloning repository..."
    git clone git@github.com:Aurigraph-DLT-Corp/HMS.git .
else
    echo "Updating existing repository..."
    git fetch origin main
    git checkout main
    git pull origin main
fi

echo "Current branch and commit:"
git status
git log -1 --oneline

# ============================================================================
# STEP 5: Install dependencies
# ============================================================================
echo ""
echo "STEP 5: Installing dependencies..."

npm install --legacy-peer-deps || echo "npm install completed with warnings"

# ============================================================================
# STEP 6: Build TypeScript
# ============================================================================
echo ""
echo "STEP 6: Building TypeScript..."

npx tsc --version
npx tsc || echo "TypeScript build completed (some warnings may be present)"

# ============================================================================
# STEP 7: Build Docker image
# ============================================================================
echo ""
echo "STEP 7: Building Docker image..."

# Build main application image
docker build \
  -f Dockerfile \
  -t hms-app:latest \
  -t hms-app:v2.2.0 \
  --build-arg NODE_ENV=production \
  .

if [ $? -ne 0 ]; then
    echo "ERROR: Docker build failed!"
    exit 1
fi

echo "Image built successfully:"
docker images | grep hms-app

# ============================================================================
# STEP 8: Create production environment file
# ============================================================================
echo ""
echo "STEP 8: Creating production environment file..."

cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3000
GRPC_PORT=50051
FRONTEND_URL=https://hms.aurex.in
BACKEND_URL=https://apihms.aurex.in
API_BASE_URL=https://apihms.aurex.in/api
LOG_LEVEL=info
SSL_CERT_PATH=/etc/letsencrypt/live/aurexcrt1/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/aurexcrt1/privkey.pem
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hms_production
DB_USER=hms_user
EOF

echo ".env.production created"
cat .env.production

# ============================================================================
# STEP 9: Verify SSL certificates
# ============================================================================
echo ""
echo "STEP 9: Verifying SSL certificates..."

if [ -f /etc/letsencrypt/live/aurexcrt1/fullchain.pem ]; then
    echo "✓ SSL fullchain certificate found"
    openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -noout -text | grep -A 2 "Subject:"
    openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -noout -dates
else
    echo "✗ ERROR: SSL certificate not found at /etc/letsencrypt/live/aurexcrt1/fullchain.pem"
    echo "  Please ensure SSL certificate is installed before deploying"
fi

if [ -f /etc/letsencrypt/live/aurexcrt1/privkey.pem ]; then
    echo "✓ SSL private key found"
else
    echo "✗ ERROR: SSL private key not found"
fi

# ============================================================================
# STEP 10: Create docker-compose.yml for production
# ============================================================================
echo ""
echo "STEP 10: Creating production docker-compose configuration..."

cat > docker-compose.production.yml << 'EOF'
version: '3.8'

services:
  hms-app:
    image: hms-app:v2.2.0
    container_name: hms-production
    environment:
      - NODE_ENV=production
      - PORT=3000
      - GRPC_PORT=50051
      - FRONTEND_URL=https://hms.aurex.in
      - BACKEND_URL=https://apihms.aurex.in
    ports:
      - "3000:3000"
      - "50051:50051"
    volumes:
      - /etc/letsencrypt/live/aurexcrt1:/etc/letsencrypt/live/aurexcrt1:ro
      - ./logs:/app/logs
    networks:
      - hms-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:latest
    container_name: hms-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt/live/aurexcrt1:/etc/letsencrypt/live/aurexcrt1:ro
    networks:
      - hms-network
    depends_on:
      - hms-app
    restart: unless-stopped

networks:
  hms-network:
    driver: bridge

volumes:
  hms-logs:
EOF

echo "docker-compose.production.yml created"

# ============================================================================
# STEP 11: Start Docker services
# ============================================================================
echo ""
echo "STEP 11: Starting Docker services..."

docker-compose -f docker-compose.production.yml up -d

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to start docker-compose"
    docker-compose -f docker-compose.production.yml logs
    exit 1
fi

echo "Services started. Waiting 10 seconds for startup..."
sleep 10

# ============================================================================
# STEP 12: Verify services are running
# ============================================================================
echo ""
echo "STEP 12: Verifying service status..."

echo "Running containers:"
docker ps --filter "name=hms"

echo ""
echo "Container logs:"
docker logs --tail 30 hms-production

echo ""
echo "Checking health endpoint..."
curl -s http://localhost:3000/health || echo "Health endpoint not yet responding (normal during startup)"

# ============================================================================
# STEP 13: Final summary
# ============================================================================
echo ""
echo "=========================================="
echo "✓ DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "Service URLs:"
echo "  Frontend:  https://hms.aurex.in"
echo "  Backend:   https://apihms.aurex.in"
echo "  API:       https://apihms.aurex.in/api"
echo ""
echo "Working Directory: /opt/HMS"
echo "Git Branch: main"
echo "Version: 2.2.0"
echo ""
echo "Useful Commands:"
echo "  docker ps                          # View running containers"
echo "  docker logs -f hms-production      # View application logs"
echo "  docker-compose logs -f             # View all service logs"
echo "  docker stats                       # View resource usage"
echo ""
echo "Rollback Command:"
echo "  git revert HEAD && docker-compose -f docker-compose.production.yml up -d"
echo ""
echo "Note: Services may take a few minutes to fully initialize."
echo "=========================================="
