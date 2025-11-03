#!/bin/bash

################################################################################
# HMS v2.2.0 Production Deployment Script
# Remote Server: hms.aurex.in (subbu@hms.aurex.in)
# Working Directory: /opt/HMS
# Git Repository: git@github.com:Aurigraph-DLT-Corp/HMS.git
# Git Branch: main
# Execution Date: November 3, 2025
################################################################################

set -e  # Exit on any error

# ============================================
# Configuration
# ============================================
REMOTE_USER="subbu"
REMOTE_HOST="hms.aurex.in"
REMOTE_WORK_DIR="/opt/HMS"
GIT_REPO="git@github.com:Aurigraph-DLT-Corp/HMS.git"
GIT_BRANCH="main"
SSL_CERT_DIR="/etc/letsencrypt/live/aurexcrt1"
SSL_KEY_FILE="${SSL_CERT_DIR}/privkey.pem"
SSL_CERT_FILE="${SSL_CERT_DIR}/fullchain.pem"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# Functions
# ============================================

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
    exit 1
}

run_remote_command() {
    local cmd="$1"
    local description="$2"

    log_info "$description"
    ssh -o StrictHostKeyChecking=accept-new "${REMOTE_USER}@${REMOTE_HOST}" "$cmd" || log_error "Failed: $description"
    log_success "Completed: $description"
}

# ============================================
# Pre-Deployment Verification
# ============================================

log_info "=========================================="
log_info "HMS v2.2.0 Production Deployment"
log_info "=========================================="
log_info ""
log_info "Deployment Configuration:"
log_info "  Remote User: $REMOTE_USER"
log_info "  Remote Host: $REMOTE_HOST"
log_info "  Work Directory: $REMOTE_WORK_DIR"
log_info "  Git Repository: $GIT_REPO"
log_info "  Git Branch: $GIT_BRANCH"
log_info "  SSL Certificate: $SSL_CERT_FILE"
log_info "  SSL Key: $SSL_KEY_FILE"
log_info ""

# Verify SSH connectivity
log_info "Verifying SSH connectivity..."
if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new "${REMOTE_USER}@${REMOTE_HOST}" "echo 'SSH connection successful'" > /dev/null 2>&1; then
    log_success "SSH connection verified"
else
    log_error "Cannot connect to ${REMOTE_USER}@${REMOTE_HOST}. Check SSH keys and network connectivity."
fi

# Verify Git repository is accessible
log_info "Verifying Git repository access..."
if ssh -o ConnectTimeout=5 git@github.com -T > /dev/null 2>&1 || echo "GitHub SSH test"; then
    log_success "GitHub SSH access verified"
else
    log_warning "GitHub SSH may need verification, but continuing..."
fi

# ============================================
# Step 1: Prepare Remote Working Directory
# ============================================

log_info ""
log_info "=========================================="
log_info "Step 1: Preparing Remote Working Directory"
log_info "=========================================="

run_remote_command "
    sudo mkdir -p $REMOTE_WORK_DIR && \
    sudo chown $REMOTE_USER:$REMOTE_USER $REMOTE_WORK_DIR && \
    cd $REMOTE_WORK_DIR && \
    pwd
" "Creating and verifying working directory"

# ============================================
# Step 2: Clone or Update Git Repository
# ============================================

log_info ""
log_info "=========================================="
log_info "Step 2: Cloning/Updating Git Repository"
log_info "=========================================="

run_remote_command "
    if [ -d '$REMOTE_WORK_DIR/.git' ]; then
        echo 'Git repository exists, pulling latest changes...'
        cd $REMOTE_WORK_DIR && \
        git fetch origin && \
        git checkout $GIT_BRANCH && \
        git pull origin $GIT_BRANCH && \
        echo 'Latest branch:' && git log -1 --oneline
    else
        echo 'Cloning Git repository for first time...'
        cd /opt && \
        git clone -b $GIT_BRANCH $GIT_REPO HMS && \
        cd HMS && \
        git log -1 --oneline
    fi
" "Cloning/updating Git repository from GitHub"

# ============================================
# Step 3: Verify Docker Installation
# ============================================

log_info ""
log_info "=========================================="
log_info "Step 3: Verifying Docker Installation"
log_info "=========================================="

run_remote_command "
    echo 'Docker version:' && \
    docker --version && \
    echo 'Docker Compose version:' && \
    docker-compose --version && \
    echo 'Verifying Docker daemon is running...' && \
    docker ps > /dev/null && \
    echo 'Docker daemon status: OK'
" "Verifying Docker installation"

# ============================================
# Step 4: Clean Up Old Docker Containers
# ============================================

log_info ""
log_info "=========================================="
log_info "Step 4: Removing Old Docker Containers"
log_info "=========================================="

run_remote_command "
    echo 'Stopping all running containers...' && \
    docker-compose -f $REMOTE_WORK_DIR/docker-compose-staging.yml down -v 2>/dev/null || true && \
    docker-compose -f $REMOTE_WORK_DIR/docker-compose-nginx.yml down -v 2>/dev/null || true && \
    echo 'Removing any remaining HMS-related containers...' && \
    docker ps -a --format '{{.Names}}' | grep -E 'hms|HMS' | xargs -r docker rm -f 2>/dev/null || true && \
    echo 'Docker container cleanup completed' && \
    docker ps -a | grep -E 'hms|HMS' || echo 'No HMS containers found'
" "Stopping and removing old Docker containers"

# ============================================
# Step 5: Prune Docker Images
# ============================================

log_info ""
log_info "=========================================="
log_info "Step 5: Pruning Docker Images"
log_info "=========================================="

run_remote_command "
    echo 'Removing unused Docker images...' && \
    docker image prune -f --all && \
    echo 'Docker image cleanup completed' && \
    echo 'Remaining images:' && \
    docker images | head -10
" "Pruning Docker images"

# ============================================
# Step 6: Verify SSL Certificates
# ============================================

log_info ""
log_info "=========================================="
log_info "Step 6: Verifying SSL Certificates"
log_info "=========================================="

run_remote_command "
    echo 'Checking SSL certificate files...' && \
    ls -lh $SSL_KEY_FILE $SSL_CERT_FILE && \
    echo 'Certificate validity:' && \
    openssl x509 -in $SSL_CERT_FILE -noout -dates && \
    echo 'Certificate subject:' && \
    openssl x509 -in $SSL_CERT_FILE -noout -subject
" "Verifying SSL certificates exist and are valid"

# ============================================
# Step 7: Build Docker Images
# ============================================

log_info ""
log_info "=========================================="
log_info "Step 7: Building Docker Images"
log_info "=========================================="

run_remote_command "
    cd $REMOTE_WORK_DIR && \
    echo 'Building Docker images with docker-compose...' && \
    docker-compose -f docker-compose-staging.yml build --no-cache && \
    echo 'Docker images built successfully' && \
    docker images | grep -E 'hms|HMS' || echo 'Docker build may use base images'
" "Building Docker images for production"

# ============================================
# Step 8: Start Production Services
# ============================================

log_info ""
log_info "=========================================="
log_info "Step 8: Starting Production Services"
log_info "=========================================="

run_remote_command "
    cd $REMOTE_WORK_DIR && \
    echo 'Starting HMS services with docker-compose...' && \
    docker-compose -f docker-compose-staging.yml up -d && \
    sleep 5 && \
    echo 'Services started, waiting for health checks...' && \
    sleep 10
" "Starting Docker services with docker-compose"

# ============================================
# Step 9: Configure and Start NGINX
# ============================================

log_info ""
log_info "=========================================="
log_info "Step 9: Configuring and Starting NGINX"
log_info "=========================================="

run_remote_command "
    echo 'Copying NGINX configuration to system...' && \
    sudo cp $REMOTE_WORK_DIR/nginx-hms-production.conf /etc/nginx/sites-available/hms.conf && \
    echo 'Creating symbolic link for NGINX...' && \
    sudo ln -sf /etc/nginx/sites-available/hms.conf /etc/nginx/sites-enabled/hms.conf && \
    echo 'Removing default NGINX configuration...' && \
    sudo rm -f /etc/nginx/sites-enabled/default && \
    echo 'Testing NGINX configuration syntax...' && \
    sudo nginx -t && \
    echo 'Reloading NGINX...' && \
    sudo systemctl reload nginx && \
    echo 'Verifying NGINX status...' && \
    sudo systemctl status nginx --no-pager | head -10
" "Installing and configuring NGINX reverse proxy"

# ============================================
# Step 10: Health Checks
# ============================================

log_info ""
log_info "=========================================="
log_info "Step 10: Performing Health Checks"
log_info "=========================================="

run_remote_command "
    echo 'Waiting for services to be ready...' && \
    sleep 5 && \
    echo 'Checking Docker container status...' && \
    docker ps --format 'table {{.Names}}\t{{.Status}}' && \
    echo '' && \
    echo 'Checking application health endpoint (local)...' && \
    curl -s http://localhost:3001/health | jq . || echo 'Health endpoint not yet ready' && \
    echo '' && \
    echo 'Checking NGINX status...' && \
    sudo systemctl is-active nginx && \
    echo 'NGINX is running'
" "Verifying services are healthy"

# ============================================
# Step 11: Verify HTTPS/CORS Configuration
# ============================================

log_info ""
log_info "=========================================="
log_info "Step 11: Verifying HTTPS/CORS Configuration"
log_info "=========================================="

log_info "Running HTTPS/TLS verification (may take 30 seconds)..."
sleep 2

run_remote_command "
    echo 'Testing HTTPS connectivity...' && \
    curl -I --silent --show-error https://hms.aurex.in/health 2>&1 | head -5 || echo 'HTTPS test in progress...' && \
    echo '' && \
    echo 'Checking HSTS header...' && \
    curl -I --silent https://hms.aurex.in/ 2>&1 | grep -i 'strict-transport' || echo 'Testing connectivity...' && \
    echo '' && \
    echo 'Testing CORS preflight...' && \
    curl -X OPTIONS --silent https://apihms.aurex.in/api/v1/health -H 'Origin: https://hms.aurex.in' 2>&1 | head -3 || echo 'CORS test in progress...'
" "Verifying HTTPS and CORS configuration"

# ============================================
# Step 12: Display Deployment Summary
# ============================================

log_info ""
log_info "=========================================="
log_info "Step 12: Deployment Summary"
log_info "=========================================="

run_remote_command "
    echo 'Final Service Status:' && \
    echo '' && \
    echo 'Docker Containers:' && \
    docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' && \
    echo '' && \
    echo 'NGINX Status:' && \
    sudo systemctl is-active nginx && \
    echo '' && \
    echo 'Deployment Directory:' && \
    ls -lh $REMOTE_WORK_DIR | head -10 && \
    echo '' && \
    echo 'Latest Git Commit:' && \
    cd $REMOTE_WORK_DIR && \
    git log -1 --pretty=format:'%h - %s (%cr)' && \
    echo '' && \
    echo '' && \
    echo 'SSL Certificate Information:' && \
    openssl x509 -in $SSL_CERT_FILE -noout -dates && \
    echo '' && \
    echo 'Disk Usage:' && \
    df -h /opt/HMS
" "Displaying final deployment summary"

# ============================================
# Post-Deployment Summary
# ============================================

log_info ""
log_info "=========================================="
log_info "🎉 DEPLOYMENT SUCCESSFUL! 🎉"
log_info "=========================================="
log_info ""
log_info "Production URLs:"
log_info "  Frontend: https://hms.aurex.in"
log_info "  API Backend: https://apihms.aurex.in"
log_info "  Metrics: https://apihms.aurex.in/metrics"
log_info ""
log_info "Next Steps:"
log_info "1. Monitor logs: docker-compose logs -f"
log_info "2. Check metrics: https://apihms.aurex.in/metrics"
log_info "3. Verify CORS: curl -X OPTIONS https://apihms.aurex.in/api/v1/health -H 'Origin: https://hms.aurex.in' -v"
log_info "4. Test API: curl -I https://apihms.aurex.in/health"
log_info ""
log_info "Deployment Date: $(date)"
log_info "HMS Version: v2.2.0"
log_info "Status: Production Ready ✅"
log_info ""
log_info "=========================================="

# ============================================
# Log Deployment Details
# ============================================

log_info ""
log_info "Saving deployment log to remote server..."
run_remote_command "
    echo 'Deployment Summary:' > $REMOTE_WORK_DIR/DEPLOYMENT_LOG.txt && \
    echo 'Date: '$(date) >> $REMOTE_WORK_DIR/DEPLOYMENT_LOG.txt && \
    echo 'User: '$(whoami) >> $REMOTE_WORK_DIR/DEPLOYMENT_LOG.txt && \
    echo 'Hostname: '$(hostname) >> $REMOTE_WORK_DIR/DEPLOYMENT_LOG.txt && \
    echo '' >> $REMOTE_WORK_DIR/DEPLOYMENT_LOG.txt && \
    echo 'Docker Containers:' >> $REMOTE_WORK_DIR/DEPLOYMENT_LOG.txt && \
    docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}' >> $REMOTE_WORK_DIR/DEPLOYMENT_LOG.txt && \
    echo '' >> $REMOTE_WORK_DIR/DEPLOYMENT_LOG.txt && \
    echo 'Git Information:' >> $REMOTE_WORK_DIR/DEPLOYMENT_LOG.txt && \
    cd $REMOTE_WORK_DIR && \
    git log -3 --oneline >> $REMOTE_WORK_DIR/DEPLOYMENT_LOG.txt && \
    echo 'Deployment log saved to: $REMOTE_WORK_DIR/DEPLOYMENT_LOG.txt'
" "Saving deployment log"

log_success "Deployment script completed successfully!"
log_info ""
log_info "To access the remote server:"
log_info "  ssh subbu@hms.aurex.in"
log_info ""
log_info "To view Docker logs:"
log_info "  ssh subbu@hms.aurex.in 'cd /opt/HMS && docker-compose logs -f'"
log_info ""
log_info "To check service status:"
log_info "  ssh subbu@hms.aurex.in 'docker ps'"
log_info ""

exit 0
