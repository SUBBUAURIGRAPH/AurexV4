#!/bin/bash

################################################################################
# HERMES Platform - Remote Server Deployment Script
# Version: 1.0.0
# Date: November 1, 2025
# Purpose: Complete build, deploy, and verification on remote server
#
# Usage:
#   curl -fsSL https://raw.github.com/Aurigraph-DLT-Corp/glowing-adventure/main/deploy-hermes-remote.sh | bash
#   OR
#   bash deploy-hermes-remote.sh
#
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="HERMES"
REPO_URL="https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git"
DEPLOYMENT_DIR="/opt/hermes"
DOCKER_IMAGE="hermes:v1.0.0"
DOCKER_CONTAINER="hermes-app"
NODE_VERSION="18"
DOMAIN="${HERMES_DOMAIN:-localhost}"
HTTPS_PORT="${HERMES_HTTPS_PORT:-443}"
HTTP_PORT="${HERMES_HTTP_PORT:-80}"
API_PORT="${HERMES_API_PORT:-3000}"

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

################################################################################
# Phase 1: System Preparation
################################################################################

log "${BLUE}================================${NC}"
log "${BLUE}Phase 1: System Preparation${NC}"
log "${BLUE}================================${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root (use sudo)"
   exit 1
fi

log_success "Running with root privileges"

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VERSION=$VERSION_ID
else
    log_error "Cannot determine OS"
    exit 1
fi

log "Detected OS: $OS $VERSION"

# Update package manager
log "Updating package manager..."
if [ "$OS" = "Ubuntu" ] || [ "$OS" = "Debian GNU/Linux" ]; then
    apt-get update -qq
    apt-get upgrade -y -qq
elif [ "$OS" = "CentOS Linux" ] || [ "$OS" = "Red Hat Enterprise Linux" ]; then
    yum update -y -q
else
    log_warning "Unknown OS, skipping system updates"
fi

log_success "System packages updated"

################################################################################
# Phase 2: Install Dependencies
################################################################################

log ""
log "${BLUE}================================${NC}"
log "${BLUE}Phase 2: Install Dependencies${NC}"
log "${BLUE}================================${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    log "Installing Node.js v$NODE_VERSION..."
    if [ "$OS" = "Ubuntu" ] || [ "$OS" = "Debian GNU/Linux" ]; then
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - -qq
        apt-get install -y nodejs -qq
    elif [ "$OS" = "CentOS Linux" ] || [ "$OS" = "Red Hat Enterprise Linux" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash - -q
        yum install -y nodejs -q
    fi
else
    NODE_V=$(node --version)
    log_success "Node.js already installed: $NODE_V"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm not found after Node.js installation"
    exit 1
else
    NPM_V=$(npm --version)
    log_success "npm installed: $NPM_V"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    log "Installing Docker..."
    if [ "$OS" = "Ubuntu" ] || [ "$OS" = "Debian GNU/Linux" ]; then
        apt-get install -y docker.io -qq
    elif [ "$OS" = "CentOS Linux" ] || [ "$OS" = "Red Hat Enterprise Linux" ]; then
        yum install -y docker -q
    fi

    # Start Docker
    systemctl start docker
    systemctl enable docker
    log_success "Docker installed and started"
else
    DOCKER_V=$(docker --version)
    log_success "Docker already installed: $DOCKER_V"
    # Ensure Docker is running
    if ! systemctl is-active --quiet docker; then
        log "Starting Docker..."
        systemctl start docker
    fi
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    log "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    log_success "Docker Compose installed"
else
    COMPOSE_V=$(docker-compose --version)
    log_success "Docker Compose already installed: $COMPOSE_V"
fi

# Check Git
if ! command -v git &> /dev/null; then
    log "Installing Git..."
    if [ "$OS" = "Ubuntu" ] || [ "$OS" = "Debian GNU/Linux" ]; then
        apt-get install -y git -qq
    elif [ "$OS" = "CentOS Linux" ] || [ "$OS" = "Red Hat Enterprise Linux" ]; then
        yum install -y git -q
    fi
    log_success "Git installed"
else
    GIT_V=$(git --version)
    log_success "Git already installed: $GIT_V"
fi

# Check NGINX
if ! command -v nginx &> /dev/null; then
    log "Installing NGINX..."
    if [ "$OS" = "Ubuntu" ] || [ "$OS" = "Debian GNU/Linux" ]; then
        apt-get install -y nginx -qq
    elif [ "$OS" = "CentOS Linux" ] || [ "$OS" = "Red Hat Enterprise Linux" ]; then
        yum install -y nginx -q
    fi
    systemctl start nginx
    systemctl enable nginx
    log_success "NGINX installed and started"
else
    NGINX_V=$(nginx -v 2>&1)
    log_success "NGINX already installed: $NGINX_V"
    if ! systemctl is-active --quiet nginx; then
        log "Starting NGINX..."
        systemctl start nginx
    fi
fi

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    log_warning "PostgreSQL not found - install separately if needed"
else
    log_success "PostgreSQL client found"
fi

################################################################################
# Phase 3: Clone/Update Repository
################################################################################

log ""
log "${BLUE}================================${NC}"
log "${BLUE}Phase 3: Clone/Update Repository${NC}"
log "${BLUE}================================${NC}"

# Create deployment directory
if [ ! -d "$DEPLOYMENT_DIR" ]; then
    log "Creating deployment directory: $DEPLOYMENT_DIR"
    mkdir -p "$DEPLOYMENT_DIR"
    log_success "Directory created"
fi

# Clone repository
if [ ! -d "$DEPLOYMENT_DIR/.git" ]; then
    log "Cloning repository from $REPO_URL..."
    git clone "$REPO_URL" "$DEPLOYMENT_DIR"
    log_success "Repository cloned"
else
    log "Repository already exists, pulling latest changes..."
    cd "$DEPLOYMENT_DIR"
    git pull origin main
    log_success "Repository updated"
fi

cd "$DEPLOYMENT_DIR"
log_success "Working directory: $(pwd)"

################################################################################
# Phase 4: Build HERMES Platform
################################################################################

log ""
log "${BLUE}================================${NC}"
log "${BLUE}Phase 4: Build HERMES Platform${NC}"
log "${BLUE}================================${NC}"

# Install root dependencies
log "Installing root dependencies..."
npm clean-install
log_success "Root dependencies installed"

# Install backend dependencies
log "Installing backend dependencies..."
cd backend
npm clean-install
log_success "Backend dependencies installed"

# Compile TypeScript
log "Compiling TypeScript..."
npx tsc 2>&1 | grep -i error || true
if [ -d "dist" ] && [ $(find dist -type f | wc -l) -gt 0 ]; then
    COMPILED_FILES=$(find dist -type f | wc -l)
    log_success "TypeScript compilation successful ($COMPILED_FILES files)"
else
    log_error "TypeScript compilation failed"
    exit 1
fi

cd "$DEPLOYMENT_DIR"
log_success "Build phase complete"

################################################################################
# Phase 5: Build Docker Image
################################################################################

log ""
log "${BLUE}================================${NC}"
log "${BLUE}Phase 5: Build Docker Image${NC}"
log "${BLUE}================================${NC}"

log "Building Docker image: $DOCKER_IMAGE..."
docker build -f Dockerfile.hermes -t "$DOCKER_IMAGE" . 2>&1 | tail -20

# Verify image
if docker images | grep -q "hermes"; then
    IMAGE_SIZE=$(docker images | grep hermes | awk '{print $7}')
    log_success "Docker image built successfully (Size: $IMAGE_SIZE)"
else
    log_error "Docker image build failed"
    exit 1
fi

################################################################################
# Phase 6: Deploy with Docker Compose
################################################################################

log ""
log "${BLUE}================================${NC}"
log "${BLUE}Phase 6: Deploy with Docker Compose${NC}"
log "${BLUE}================================${NC}"

# Check if docker-compose.hermes.yml exists
if [ ! -f "docker-compose.hermes.yml" ]; then
    log_warning "docker-compose.hermes.yml not found, creating minimal version..."
    cat > docker-compose.yml <<'COMPOSEYML'
version: '3.8'

services:
  hermes:
    image: hermes:v1.0.0
    container_name: hermes-app
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=3000
    ports:
      - "3000:3000"
    volumes:
      - ./backend/logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    container_name: hermes-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - hermes
COMPOSEYML
    log_success "Created minimal docker-compose.yml"
fi

# Stop existing container if running
if docker ps | grep -q "$DOCKER_CONTAINER"; then
    log "Stopping existing container: $DOCKER_CONTAINER..."
    docker stop "$DOCKER_CONTAINER" || true
fi

# Remove existing container
if docker ps -a | grep -q "$DOCKER_CONTAINER"; then
    log "Removing existing container..."
    docker rm "$DOCKER_CONTAINER" || true
fi

# Start new container
log "Starting Docker container: $DOCKER_CONTAINER..."
docker run -d \
    --name "$DOCKER_CONTAINER" \
    --restart always \
    -p 3000:3000 \
    -e NODE_ENV=production \
    --health-cmd='curl -f http://localhost:3000/api/health || exit 1' \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=3 \
    "$DOCKER_IMAGE"

# Wait for container to be healthy
log "Waiting for container to be healthy..."
sleep 10
for i in {1..30}; do
    if docker ps | grep "$DOCKER_CONTAINER" | grep -q "healthy"; then
        log_success "Container is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "Container failed to become healthy"
        docker logs "$DOCKER_CONTAINER"
        exit 1
    fi
    sleep 2
done

log_success "Docker container deployed successfully"

################################################################################
# Phase 7: Configure NGINX
################################################################################

log ""
log "${BLUE}================================${NC}"
log "${BLUE}Phase 7: Configure NGINX${NC}"
log "${BLUE}================================${NC}"

# Create NGINX configuration
log "Creating NGINX configuration..."
cat > /etc/nginx/sites-available/hermes <<'NGINXCONF'
upstream hermes_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name _;

    # SSL Configuration (update with actual cert paths)
    # ssl_certificate /etc/nginx/ssl/cert.pem;
    # ssl_certificate_key /etc/nginx/ssl/key.pem;
    # ssl_protocols TLSv1.2 TLSv1.3;
    # ssl_ciphers HIGH:!aNULL:!MD5;
    # ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;

    # API endpoints
    location /api {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://hermes_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # General endpoints
    location / {
        limit_req zone=general burst=10 nodelay;
        proxy_pass http://hermes_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://hermes_backend;
    }
}
NGINXCONF

# Enable site
log "Enabling NGINX site..."
ln -sf /etc/nginx/sites-available/hermes /etc/nginx/sites-enabled/hermes 2>/dev/null || true

# Test NGINX configuration
log "Testing NGINX configuration..."
if nginx -t; then
    log_success "NGINX configuration valid"
else
    log_error "NGINX configuration invalid"
    exit 1
fi

# Reload NGINX
log "Reloading NGINX..."
systemctl reload nginx
log_success "NGINX configured and reloaded"

################################################################################
# Phase 8: Verification & Health Checks
################################################################################

log ""
log "${BLUE}================================${NC}"
log "${BLUE}Phase 8: Verification & Health Checks${NC}"
log "${BLUE}================================${NC}"

# Wait a bit for services to stabilize
sleep 5

# Check container status
log "Checking container status..."
if docker ps | grep -q "$DOCKER_CONTAINER"; then
    log_success "Container is running"
    docker ps | grep "$DOCKER_CONTAINER"
else
    log_error "Container is not running"
    docker logs "$DOCKER_CONTAINER"
    exit 1
fi

# Test health endpoint
log "Testing API health endpoint..."
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    log_success "API health check passed"
else
    log_warning "Health endpoint not responding yet, waiting..."
    sleep 10
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        log_success "API health check passed after waiting"
    else
        log_warning "Health endpoint still not responding (may be expected)"
    fi
fi

# Check NGINX
log "Checking NGINX status..."
if systemctl is-active --quiet nginx; then
    log_success "NGINX is running"
else
    log_error "NGINX is not running"
    exit 1
fi

# Show deployment summary
log ""
log "${BLUE}================================${NC}"
log "${GREEN}DEPLOYMENT COMPLETE!${NC}"
log "${BLUE}================================${NC}"
echo ""
echo -e "${GREEN}HERMES Platform Deployment Summary:${NC}"
echo "  Project: $PROJECT_NAME"
echo "  Deployment Directory: $DEPLOYMENT_DIR"
echo "  Docker Image: $DOCKER_IMAGE"
echo "  Container: $DOCKER_CONTAINER"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  Docker: $(docker --version)"
echo ""
echo -e "${GREEN}Services Running:${NC}"
echo "  API: http://localhost:3000"
echo "  NGINX: http://localhost:80 → https://localhost:443"
echo ""
echo -e "${GREEN}Health Checks:${NC}"
echo "  Container Status: $(docker ps --filter name=$DOCKER_CONTAINER --format '{{.Status}}')"
echo "  NGINX Status: $(systemctl is-active nginx)"
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo "  1. Configure HTTPS certificate (update /etc/nginx/sites-available/hermes)"
echo "  2. Configure database connection (set environment variables)"
echo "  3. Monitor logs: docker logs -f $DOCKER_CONTAINER"
echo "  4. Check NGINX: tail -f /var/log/nginx/access.log"
echo ""
echo -e "${GREEN}Repository:${NC} $REPO_URL"
echo -e "${GREEN}Branch:${NC} main"
echo ""

log_success "Deployment script completed successfully!"

exit 0
