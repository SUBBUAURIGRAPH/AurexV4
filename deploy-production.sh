#!/bin/bash

################################################################################
# HMS Production Deployment Script
# Deploys HMS to production server with Docker Compose
#
# Configuration:
# - Remote Host: subbu@hms.aurex.in
# - Remote Path: /opt/HMS
# - Git Repo: git@github.com:Aurigraph-DLT-Corp/HMS.git
# - Frontend: hms.aurex.in
# - Backend: apihms.aurex.in
# - SSL Path: /etc/letsencrypt/live/aurexcrt1/
#
# Features:
# - Install Docker and Docker Compose on remote server
# - Clone/update git repository
# - Build Docker images
# - Deploy with Docker Compose
# - Configure SSL certificates
# - Run health checks
# - Clean up old containers and images
#
# Usage: ./deploy-production.sh [--skip-docker-install] [--skip-build]
################################################################################

set -e

# ============================================================================
# CONFIGURATION
# ============================================================================

REMOTE_USER="${REMOTE_USER:-subbu}"
REMOTE_HOST="${REMOTE_HOST:-hms.aurex.in}"
REMOTE_FULL="${REMOTE_USER}@hms.aurex.in"
REMOTE_PATH="/opt/HMS"
GIT_REPO="git@github.com:Aurigraph-DLT-Corp/HMS.git"
GIT_BRANCH="main"
DOCKER_REGISTRY="docker.io"
APP_NAME="hms-trading"
VERSION="$(date +%Y%m%d-%H%M%S)"
FRONTEND_DOMAIN="hms.aurex.in"
BACKEND_DOMAIN="apihms.aurex.in"
SSL_PATH="/etc/letsencrypt/live/aurexcrt1"

SKIP_DOCKER_INSTALL=false
SKIP_BUILD=false

# ============================================================================
# COLOR CODES
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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
# PREREQUISITE CHECKS
# ============================================================================

check_local_prerequisites() {
    log_section "Checking Local Prerequisites"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed on local machine"
        exit 1
    fi
    log_success "Docker is installed: $(docker --version)"

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed on local machine"
        exit 1
    fi
    log_success "Docker Compose is installed: $(docker-compose --version)"

    # Check Git
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed on local machine"
        exit 1
    fi
    log_success "Git is installed: $(git --version)"

    # Check SSH access
    log_info "Testing SSH connection to ${REMOTE_FULL}..."
    if ssh -q -o ConnectTimeout=5 "${REMOTE_FULL}" exit 2>/dev/null; then
        log_success "SSH connection successful"
    else
        log_error "Cannot connect to ${REMOTE_FULL}"
        exit 1
    fi

    log_success "All local prerequisites met"
}

# ============================================================================
# REMOTE DOCKER INSTALLATION
# ============================================================================

install_docker_remote() {
    log_section "Installing Docker and Docker Compose on Remote Server"

    ssh "${REMOTE_FULL}" << 'DOCKER_INSTALL_EOF'
        set -e

        log_info() { echo "[INFO] $1"; }
        log_success() { echo "[SUCCESS] $1"; }
        log_error() { echo "[ERROR] $1"; }

        # Check if Docker is already installed
        if command -v docker &> /dev/null; then
            log_success "Docker is already installed: $(docker --version)"
        else
            log_info "Installing Docker..."

            # Update package manager
            sudo apt-get update

            # Install dependencies
            sudo apt-get install -y \
                apt-transport-https \
                ca-certificates \
                curl \
                gnupg \
                lsb-release

            # Add Docker GPG key
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

            # Add Docker repository
            echo \
              "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
              $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

            # Install Docker
            sudo apt-get update
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

            # Add user to docker group
            sudo usermod -aG docker $(whoami)

            log_success "Docker installed successfully"
        fi

        # Check if Docker Compose is installed
        if command -v docker-compose &> /dev/null || command -v docker compose &> /dev/null; then
            log_success "Docker Compose is already installed"
        else
            log_info "Installing Docker Compose..."

            # Download Docker Compose
            sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
                -o /usr/local/bin/docker-compose

            # Make executable
            sudo chmod +x /usr/local/bin/docker-compose

            log_success "Docker Compose installed successfully"
        fi

        # Start Docker service
        sudo systemctl start docker
        sudo systemctl enable docker

        log_success "Docker service started and enabled"

DOCKER_INSTALL_EOF

    log_success "Docker and Docker Compose installed on remote server"
}

# ============================================================================
# REPOSITORY SETUP
# ============================================================================

setup_remote_repository() {
    log_section "Setting up Repository on Remote Server"

    ssh "${REMOTE_FULL}" << REPO_SETUP_EOF
        set -e

        log_info() { echo "[INFO] $1"; }
        log_success() { echo "[SUCCESS] $1"; }
        log_warning() { echo "[WARNING] $1"; }

        # Create remote path if not exists
        if [ ! -d "${REMOTE_PATH}" ]; then
            log_info "Creating remote directory: ${REMOTE_PATH}"
            mkdir -p "${REMOTE_PATH}"
        fi

        cd "${REMOTE_PATH}"

        # Initialize or update git repository
        if [ -d .git ]; then
            log_info "Repository already exists, updating..."
            git fetch origin
            git reset --hard origin/${GIT_BRANCH}
        else
            log_info "Cloning repository..."
            git clone -b ${GIT_BRANCH} ${GIT_REPO} .
        fi

        log_success "Repository setup complete"

        # Create necessary directories
        mkdir -p logs data config/ssl

        # Create .env file if not exists
        if [ ! -f .env ]; then
            log_warning ".env file not found, creating from template"
            if [ -f .env.template ]; then
                cp .env.template .env
            else
                touch .env
            fi
        fi

        log_success "Directory structure created"

REPO_SETUP_EOF

    log_success "Repository setup on remote server completed"
}

# ============================================================================
# BUILD DOCKER IMAGES LOCALLY
# ============================================================================

build_docker_images() {
    log_section "Building Docker Images Locally"

    log_info "Building Docker images with version: ${VERSION}"

    # Build main application image
    log_info "Building main application image..."
    docker build \
        --tag "${DOCKER_REGISTRY}/${APP_NAME}:${VERSION}" \
        --tag "${DOCKER_REGISTRY}/${APP_NAME}:latest" \
        --tag "${DOCKER_REGISTRY}/${APP_NAME}:prod" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg VERSION="${VERSION}" \
        --build-arg GIT_COMMIT="$(git rev-parse --short HEAD)" \
        --file Dockerfile \
        .

    log_success "Main application image built successfully"

    # Display built images
    log_info "Built Docker images:"
    docker images | grep "${APP_NAME}" | head -5

    log_success "Docker images built locally"
}

# ============================================================================
# DEPLOY APPLICATION
# ============================================================================

deploy_application() {
    log_section "Deploying Application to Remote Server"

    ssh "${REMOTE_FULL}" << DEPLOY_EOF
        set -e

        log_info() { echo "[INFO] \$1"; }
        log_success() { echo "[SUCCESS] \$1"; }
        log_warning() { echo "[WARNING] \$1"; }

        cd "${REMOTE_PATH}"

        # Create docker-compose configuration
        log_info "Creating docker-compose configuration..."

        cat > docker-compose.prod.yml << 'COMPOSE_EOF'
version: '3.8'

services:
  app:
    image: docker.io/${APP_NAME}:latest
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
      - DB_PASSWORD=\${DB_PASSWORD}
      - DB_NAME=hms_trading
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=\${JWT_SECRET}
      - CORS_ORIGIN=https://${FRONTEND_DOMAIN},https://${BACKEND_DOMAIN}
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
      - POSTGRES_PASSWORD=\${DB_PASSWORD}
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
      - ${SSL_PATH}/privkey.pem:/etc/nginx/ssl/privkey.pem:ro
      - ${SSL_PATH}/fullchain.pem:/etc/nginx/ssl/fullchain.pem:ro
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

        # Pull latest code
        log_info "Pulling latest code from ${GIT_BRANCH}..."
        git pull origin ${GIT_BRANCH}

        # Stop and remove old containers
        log_info "Stopping and removing old containers..."
        docker-compose -f docker-compose.prod.yml down --remove-orphans || true

        # Pull latest images
        log_info "Pulling latest Docker images..."
        docker-compose -f docker-compose.prod.yml pull || true

        # Start new containers
        log_info "Starting new containers..."
        docker-compose -f docker-compose.prod.yml up -d

        # Wait for services to be healthy
        log_info "Waiting for services to start..."
        sleep 15

        # Check service health
        log_info "Checking service health..."
        for i in {1..30}; do
            if docker-compose -f docker-compose.prod.yml exec -T app curl -f http://localhost:3000/api/backtesting/health &> /dev/null; then
                log_success "Application is healthy"
                break
            fi

            if [ \$i -eq 30 ]; then
                log_warning "Application health check timeout (may still be starting)"
            else
                log_info "Waiting for application to be ready... (\$i/30)"
                sleep 2
            fi
        done

        log_success "Application deployed successfully"

DEPLOY_EOF

    log_success "Application deployment completed"
}

# ============================================================================
# CONFIGURE SSL AND NGINX
# ============================================================================

configure_ssl_nginx() {
    log_section "Configuring SSL Certificates and Nginx"

    ssh "${REMOTE_FULL}" << SSL_CONFIG_EOF
        set -e

        log_info() { echo "[INFO] \$1"; }
        log_success() { echo "[SUCCESS] \$1"; }

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
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=api:10m rate=100r/m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Upstream configuration
    upstream app {
        server hms-app:3000;
        keepalive 32;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name ${FRONTEND_DOMAIN} ${BACKEND_DOMAIN};
        return 301 https://\$server_name\$request_uri;
    }

    # Frontend HTTPS server
    server {
        listen 443 ssl http2;
        server_name ${FRONTEND_DOMAIN};

        # SSL certificates
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Rate limiting
        limit_req zone=general burst=50 nodelay;

        # Frontend location
        location / {
            root /usr/share/nginx/html;
            try_files \$uri \$uri/ /index.html;
            expires 1h;
        }

        # Static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend HTTPS server
    server {
        listen 443 ssl http2;
        server_name ${BACKEND_DOMAIN};

        # SSL certificates
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Rate limiting for API
        limit_req zone=api burst=200 nodelay;

        # API proxy
        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
            proxy_buffering off;
        }

        # Health check endpoint
        location /health {
            access_log off;
            proxy_pass http://app;
            proxy_http_version 1.1;
        }
    }
}
NGINX_CONF_EOF

        log_success "Nginx configuration created"

        # Verify SSL certificates exist
        if [ ! -f "${SSL_PATH}/privkey.pem" ] || [ ! -f "${SSL_PATH}/fullchain.pem" ]; then
            log_warning "SSL certificates not found at ${SSL_PATH}"
            log_info "Please ensure SSL certificates are in place at:"
            log_info "  - ${SSL_PATH}/privkey.pem"
            log_info "  - ${SSL_PATH}/fullchain.pem"
        else
            log_success "SSL certificates verified"
        fi

        # Restart Nginx
        log_info "Restarting Nginx..."
        docker-compose -f docker-compose.prod.yml restart nginx || true

        log_success "SSL and Nginx configuration completed"

SSL_CONFIG_EOF

    log_success "SSL certificates and Nginx configured"
}

# ============================================================================
# HEALTH CHECKS AND VERIFICATION
# ============================================================================

run_health_checks() {
    log_section "Running Health Checks"

    ssh "${REMOTE_FULL}" << HEALTH_CHECK_EOF
        set -e

        log_info() { echo "[INFO] \$1"; }
        log_success() { echo "[SUCCESS] \$1"; }
        log_warning() { echo "[WARNING] \$1"; }

        cd "${REMOTE_PATH}"

        # Check Docker containers status
        log_info "Checking Docker containers status..."
        docker-compose -f docker-compose.prod.yml ps

        # Check application health
        log_info "Checking application health endpoint..."
        if curl -f -s -k https://${BACKEND_DOMAIN}/api/backtesting/health > /dev/null 2>&1; then
            log_success "Backend API health check passed"
        else
            log_warning "Backend API health check pending (may take a moment)"
        fi

        # Check frontend
        log_info "Checking frontend health..."
        if curl -f -s -k https://${FRONTEND_DOMAIN}/ > /dev/null 2>&1; then
            log_success "Frontend health check passed"
        else
            log_warning "Frontend health check pending"
        fi

        # Check database connectivity
        log_info "Checking database connectivity..."
        if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U hms_user > /dev/null 2>&1; then
            log_success "PostgreSQL database is healthy"
        else
            log_warning "PostgreSQL database not ready yet"
        fi

        # Check Redis
        log_info "Checking Redis..."
        if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
            log_success "Redis is healthy"
        else
            log_warning "Redis not ready yet"
        fi

        log_success "Health checks completed"

HEALTH_CHECK_EOF

    log_success "Health checks completed"
}

# ============================================================================
# CLEANUP
# ============================================================================

cleanup_docker() {
    log_section "Cleaning Up Old Docker Containers and Images"

    ssh "${REMOTE_FULL}" << CLEANUP_EOF
        log_info() { echo "[INFO] \$1"; }
        log_success() { echo "[SUCCESS] \$1"; }

        log_info "Removing stopped containers..."
        docker container prune -f --filter "until=24h"

        log_info "Removing unused images..."
        docker image prune -f --filter "until=168h"

        log_info "Removing unused volumes..."
        docker volume prune -f

        log_success "Docker cleanup completed"

CLEANUP_EOF

    log_success "Docker cleanup completed"
}

# ============================================================================
# DISPLAY DEPLOYMENT SUMMARY
# ============================================================================

display_summary() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║  ✓ DEPLOYMENT COMPLETED SUCCESSFULLY!                     ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Deployment Details:${NC}"
    echo "  Server:           ${REMOTE_FULL}"
    echo "  Remote Path:      ${REMOTE_PATH}"
    echo "  Git Branch:       ${GIT_BRANCH}"
    echo "  Build Version:    ${VERSION}"
    echo ""
    echo -e "${CYAN}Access URLs:${NC}"
    echo "  Frontend:         ${GREEN}https://${FRONTEND_DOMAIN}${NC}"
    echo "  Backend API:      ${GREEN}https://${BACKEND_DOMAIN}/api/${NC}"
    echo "  Health Check:     ${GREEN}https://${BACKEND_DOMAIN}/api/backtesting/health${NC}"
    echo ""
    echo -e "${CYAN}SSH Access:${NC}"
    echo "  Command:          ${GREEN}ssh ${REMOTE_FULL}${NC}"
    echo "  Working Dir:      ${GREEN}${REMOTE_PATH}${NC}"
    echo ""
    echo -e "${CYAN}Useful Docker Commands:${NC}"
    echo "  View logs:        ${GREEN}docker-compose -f docker-compose.prod.yml logs -f app${NC}"
    echo "  Shell access:     ${GREEN}docker-compose -f docker-compose.prod.yml exec app /bin/sh${NC}"
    echo "  Restart app:      ${GREEN}docker-compose -f docker-compose.prod.yml restart app${NC}"
    echo "  Stop services:    ${GREEN}docker-compose -f docker-compose.prod.yml down${NC}"
    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo "  1. Verify applications are accessible at the URLs above"
    echo "  2. Check application logs: docker-compose -f docker-compose.prod.yml logs"
    echo "  3. Monitor the deployment for errors in the first few minutes"
    echo "  4. Set up backups and monitoring as needed"
    echo ""
}

# ============================================================================
# MAIN DEPLOYMENT FLOW
# ============================================================================

main() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  HMS Production Deployment Script                         ║${NC}"
    echo -e "${CYAN}║  Version: ${VERSION}${NC}"
    echo -e "${CYAN}║  Target: ${REMOTE_FULL}                                  ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-docker-install)
                SKIP_DOCKER_INSTALL=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Execute deployment steps
    check_local_prerequisites

    if [ "$SKIP_DOCKER_INSTALL" != "true" ]; then
        install_docker_remote
    else
        log_warning "Skipping Docker installation on remote server"
    fi

    setup_remote_repository

    if [ "$SKIP_BUILD" != "true" ]; then
        build_docker_images
    else
        log_warning "Skipping local Docker build"
    fi

    deploy_application
    configure_ssl_nginx
    run_health_checks
    cleanup_docker

    # Display summary
    display_summary
}

# Run main function
main "$@"
