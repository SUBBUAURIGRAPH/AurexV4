#!/bin/bash

################################################################################
# HMS Production Deployment Script (Remote-Side)
# This script runs entirely on the remote server
#
# Usage:
# 1. Download this script to remote server
# 2. Run: bash deploy-production-remote.sh
#
# Or remotely:
# ssh subbu@hms.aurex.in 'bash -s' < deploy-production-remote.sh
################################################################################

set -e

# ============================================================================
# CONFIGURATION
# ============================================================================

REMOTE_PATH="/opt/HMS"
GIT_REPO="git@github.com:Aurigraph-DLT-Corp/HMS.git"
GIT_BRANCH="main"
APP_NAME="hms-trading"
FRONTEND_DOMAIN="hms.aurex.in"
BACKEND_DOMAIN="apihms.aurex.in"
SSL_PATH="/etc/letsencrypt/live/aurexcrt1"
DOCKER_REGISTRY="docker.io"
VERSION="$(date +%Y%m%d-%H%M%S)"

# ============================================================================
# COLOR CODES
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# ============================================================================
# PREREQUISITES CHECK
# ============================================================================

check_prerequisites() {
    log_section "Checking Prerequisites on Remote Server"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    log_success "Docker is installed: $(docker --version)"

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    log_success "Docker Compose is installed"

    # Check Git
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed"
        exit 1
    fi
    log_success "Git is installed: $(git --version)"

    # Check curl
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed"
        exit 1
    fi
    log_success "curl is installed"

    log_success "All prerequisites met"
}

# ============================================================================
# REPOSITORY SETUP
# ============================================================================

setup_repository() {
    log_section "Setting up Repository"

    # Create remote path if not exists
    if [ ! -d "${REMOTE_PATH}" ]; then
        log_info "Creating directory: ${REMOTE_PATH}"
        sudo mkdir -p "${REMOTE_PATH}"
        sudo chown -R "$(whoami):$(whoami)" "${REMOTE_PATH}"
    fi

    cd "${REMOTE_PATH}"

    # Initialize or update git repository
    if [ -d .git ]; then
        log_info "Repository exists, pulling latest changes..."
        git fetch origin
        git reset --hard origin/${GIT_BRANCH}
    else
        log_info "Cloning repository..."
        git clone -b ${GIT_BRANCH} ${GIT_REPO} .
    fi

    log_success "Repository updated to latest commit"
    git log -1 --oneline

    # Create necessary directories
    log_info "Creating necessary directories..."
    mkdir -p logs data config/ssl downloads

    # Create .env file if not exists
    if [ ! -f .env ]; then
        log_warning ".env file not found, creating from template"
        if [ -f .env.template ]; then
            cp .env.template .env
            log_warning "Edit .env file with your configuration: nano .env"
        else
            touch .env
        fi
    else
        log_success ".env file already exists"
    fi

    log_success "Repository setup completed"
}

# ============================================================================
# BUILD DOCKER IMAGES
# ============================================================================

build_docker_images() {
    log_section "Building Docker Images"

    cd "${REMOTE_PATH}"

    log_info "Building Docker image: ${APP_NAME}:${VERSION}"

    docker build \
        --tag "${DOCKER_REGISTRY}/${APP_NAME}:${VERSION}" \
        --tag "${DOCKER_REGISTRY}/${APP_NAME}:latest" \
        --tag "${DOCKER_REGISTRY}/${APP_NAME}:prod" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg VERSION="${VERSION}" \
        --build-arg GIT_COMMIT="$(git rev-parse --short HEAD)" \
        --file Dockerfile \
        . 2>&1 | tail -20

    log_success "Docker image built successfully"

    # List built images
    log_info "Built Docker images:"
    docker images | grep "${APP_NAME}" | head -3

    log_success "Docker build completed"
}

# ============================================================================
# DEPLOY APPLICATION
# ============================================================================

deploy_application() {
    log_section "Deploying Application with Docker Compose"

    cd "${REMOTE_PATH}"

    # Create docker-compose configuration
    log_info "Creating docker-compose.prod.yml..."

    cat > docker-compose.prod.yml << 'COMPOSE_EOF'
version: '3.8'

services:
  app:
    image: docker.io/hms-trading:latest
    container_name: hms-app
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - PORT=3000
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=hms_user
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=hms_trading
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=https://hms.aurex.in,https://apihms.aurex.in
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - hms-network
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/backtesting/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"

  postgres:
    image: postgres:15-alpine
    container_name: hms-postgres
    restart: always
    environment:
      - POSTGRES_USER=hms_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=hms_trading
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - hms-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hms_user -d hms_trading"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

  redis:
    image: redis:7-alpine
    container_name: hms-redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - hms-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

  nginx:
    image: nginx:alpine
    container_name: hms-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt/live/aurexcrt1/privkey.pem:/etc/nginx/ssl/privkey.pem:ro
      - /etc/letsencrypt/live/aurexcrt1/fullchain.pem:/etc/nginx/ssl/fullchain.pem:ro
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - app
    networks:
      - hms-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"

volumes:
  postgres_data:
  redis_data:

networks:
  hms-network:
    driver: bridge
COMPOSE_EOF

    log_success "docker-compose.prod.yml created"

    # Remove old containers
    log_info "Removing old containers..."
    docker-compose -f docker-compose.prod.yml down --remove-orphans || true

    # Start new containers
    log_info "Starting containers..."
    docker-compose -f docker-compose.prod.yml up -d

    # Wait for services to start
    log_info "Waiting for services to start..."
    sleep 20

    log_success "Application deployed successfully"

    # Show container status
    docker-compose -f docker-compose.prod.yml ps
}

# ============================================================================
# CONFIGURE NGINX WITH SSL
# ============================================================================

configure_nginx() {
    log_section "Configuring Nginx with SSL"

    cd "${REMOTE_PATH}"

    # Create Nginx configuration
    log_info "Creating Nginx configuration..."

    cat > nginx.conf << 'NGINX_CONF_EOF'
events {
    worker_connections 1024;
}

http {
    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log warn;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # MIME types
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Upstream
    upstream app {
        server hms-app:3000;
        keepalive 32;
    }

    # HTTP redirect to HTTPS
    server {
        listen 80;
        server_name hms.aurex.in apihms.aurex.in;
        return 301 https://$server_name$request_uri;
    }

    # Frontend
    server {
        listen 443 ssl http2;
        server_name hms.aurex.in;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        limit_req zone=general burst=50 nodelay;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # Backend API
    server {
        listen 443 ssl http2;
        server_name apihms.aurex.in;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        limit_req zone=api burst=200 nodelay;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_buffering off;
        }

        location /health {
            access_log off;
            proxy_pass http://app;
        }
    }
}
NGINX_CONF_EOF

    log_success "Nginx configuration created"

    # Check SSL certificates
    if [ -f "${SSL_PATH}/privkey.pem" ] && [ -f "${SSL_PATH}/fullchain.pem" ]; then
        log_success "SSL certificates verified at ${SSL_PATH}"
    else
        log_warning "SSL certificates not found at ${SSL_PATH}"
        log_info "Expected paths:"
        log_info "  - ${SSL_PATH}/privkey.pem"
        log_info "  - ${SSL_PATH}/fullchain.pem"
    fi

    # Restart Nginx
    log_info "Restarting Nginx..."
    docker-compose -f docker-compose.prod.yml restart nginx || true

    log_success "Nginx configuration completed"
}

# ============================================================================
# HEALTH CHECKS
# ============================================================================

run_health_checks() {
    log_section "Running Health Checks"

    cd "${REMOTE_PATH}"

    # Container status
    log_info "Docker container status:"
    docker-compose -f docker-compose.prod.yml ps
    echo ""

    # Application health
    log_info "Checking application health..."
    for i in {1..10}; do
        if docker-compose -f docker-compose.prod.yml exec -T app curl -f http://localhost:3000/api/backtesting/health &> /dev/null; then
            log_success "Application health check passed"
            break
        fi
        if [ $i -lt 10 ]; then
            log_info "Waiting for application... ($i/10)"
            sleep 2
        else
            log_warning "Application health check timeout"
        fi
    done

    # Database status
    log_info "Checking database connectivity..."
    if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U hms_user &> /dev/null; then
        log_success "PostgreSQL is ready"
    else
        log_warning "PostgreSQL not responding yet"
    fi

    # Redis status
    log_info "Checking Redis..."
    if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping &> /dev/null; then
        log_success "Redis is responding"
    else
        log_warning "Redis not responding yet"
    fi

    log_success "Health checks completed"
}

# ============================================================================
# CLEANUP
# ============================================================================

cleanup() {
    log_section "Cleaning Up Old Docker Resources"

    log_info "Removing stopped containers..."
    docker container prune -f --filter "until=72h" || true

    log_info "Removing unused images (older than 7 days)..."
    docker image prune -f --filter "until=168h" || true

    log_info "Removing unused volumes..."
    docker volume prune -f || true

    log_success "Docker cleanup completed"
}

# ============================================================================
# DISPLAY SUMMARY
# ============================================================================

display_summary() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║  ✓ DEPLOYMENT COMPLETED SUCCESSFULLY!                     ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Deployment Summary:${NC}"
    echo "  Application:      HMS Trading System"
    echo "  Remote Path:      ${REMOTE_PATH}"
    echo "  Git Branch:       ${GIT_BRANCH}"
    echo "  Build Version:    ${VERSION}"
    echo "  Build Date:       $(date)"
    echo ""
    echo -e "${CYAN}Access URLs:${NC}"
    echo "  Frontend:         ${GREEN}https://${FRONTEND_DOMAIN}${NC}"
    echo "  Backend API:      ${GREEN}https://${BACKEND_DOMAIN}${NC}"
    echo "  Health Check:     ${GREEN}https://${BACKEND_DOMAIN}/api/backtesting/health${NC}"
    echo ""
    echo -e "${CYAN}Useful Commands:${NC}"
    echo "  View logs:        ${GREEN}cd ${REMOTE_PATH} && docker-compose -f docker-compose.prod.yml logs -f app${NC}"
    echo "  Shell access:     ${GREEN}docker-compose -f docker-compose.prod.yml exec app /bin/sh${NC}"
    echo "  Restart app:      ${GREEN}docker-compose -f docker-compose.prod.yml restart app${NC}"
    echo "  Stop all:         ${GREEN}docker-compose -f docker-compose.prod.yml down${NC}"
    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo "  1. Verify access to https://${FRONTEND_DOMAIN}"
    echo "  2. Test API at https://${BACKEND_DOMAIN}/api/backtesting/health"
    echo "  3. Monitor logs: docker-compose logs -f app"
    echo "  4. Check .env configuration is correct"
    echo ""
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  HMS Production Deployment (Remote)                       ║${NC}"
    echo -e "${CYAN}║  Server: $(hostname)${NC}"
    echo -e "${CYAN}║  User: $(whoami)${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    check_prerequisites
    setup_repository
    build_docker_images
    deploy_application
    configure_nginx
    run_health_checks
    cleanup
    display_summary
}

# Execute main function
main "$@"
