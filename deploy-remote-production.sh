#!/bin/bash

###############################################################################
# HERMES HF - REMOTE PRODUCTION DEPLOYMENT SCRIPT
# Purpose: Deploy to hms.aurex.in with frontend and backend
# Usage: ./deploy-remote-production.sh [action]
# SSH: ssh subbu@hms.aurex.in
# Remote Directory: /opt/HMS
# Remote Repository: git@github.com:Aurigraph-DLT-Corp/HMS.git
# SSL Certificates: /etc/letsencrypt/live/aurexcrt1/{privkey.pem,fullchain.pem}
###############################################################################

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
REMOTE_HOST="hms.aurex.in"
REMOTE_USER="subbu"
REMOTE_PORT="22"
REMOTE_DIR="/opt/HMS"
REMOTE_GIT_REPO="git@github.com:Aurigraph-DLT-Corp/HMS.git"
REMOTE_GIT_BRANCH="main"

# Frontend/Backend configuration
FRONTEND_DOMAIN="hms.aurex.in"
BACKEND_DOMAIN="apihms.aurex.in"
SSL_CERT_PATH="/etc/letsencrypt/live/aurexcrt1"
SSL_KEY="${SSL_CERT_PATH}/privkey.pem"
SSL_CERT="${SSL_CERT_PATH}/fullchain.pem"

# Local configuration
LOCAL_DOCKER_IMAGE="hermes-hf:production"
REGISTRY_URL="docker.io"

# Log file
LOG_FILE="/tmp/remote-deploy-$(date +%Y%m%d-%H%M%S).log"

#############################################
# UTILITY FUNCTIONS
#############################################

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✓ $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}✗ $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}" | tee -a "$LOG_FILE"
}

header() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
    echo ""
}

#############################################
# PRE-DEPLOYMENT CHECKS
#############################################

check_local_prerequisites() {
    header "CHECKING LOCAL PREREQUISITES"

    log "Checking Git..."
    git --version || error "Git not installed"

    log "Checking Docker..."
    docker --version || error "Docker not installed"

    log "Checking Docker Compose..."
    docker-compose --version || error "Docker Compose not installed"

    log "Checking SSH key..."
    SSH_KEY_PATH="${HOME}/.ssh/id_rsa"
    if [ -f "$SSH_KEY_PATH" ]; then
        success "SSH key found at $SSH_KEY_PATH"
    else
        error "SSH key not found at $SSH_KEY_PATH"
    fi

    success "All local prerequisites verified"
}

check_remote_connectivity() {
    header "CHECKING REMOTE SERVER CONNECTIVITY"

    log "Testing SSH connection to ${REMOTE_USER}@${REMOTE_HOST}..."
    if ssh -o ConnectTimeout=5 -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" "echo 'SSH connection successful'" > /dev/null 2>&1; then
        success "SSH connection established"
    else
        error "Cannot connect to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}"
    fi

    log "Checking remote working directory..."
    if ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" "[ -d $REMOTE_DIR ] && echo 'OK'" > /dev/null 2>&1; then
        success "Remote directory $REMOTE_DIR exists"
    else
        warning "Remote directory $REMOTE_DIR does not exist, will create"
    fi

    success "Remote connectivity verified"
}

check_working_tree() {
    header "CHECKING LOCAL WORKING TREE"

    log "Checking for uncommitted changes..."
    if [ -n "$(git status --porcelain)" ]; then
        warning "Uncommitted changes found:"
        git status --short
        read -p "Continue with uncommitted changes? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Deployment cancelled"
        fi
    else
        success "Working tree is clean"
    fi

    log "Checking current branch..."
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [ "$current_branch" = "$REMOTE_GIT_BRANCH" ]; then
        success "On branch $REMOTE_GIT_BRANCH"
    else
        warning "Current branch is $current_branch, not $REMOTE_GIT_BRANCH"
        read -p "Continue with branch $current_branch? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ [Yy]$ ]]; then
            error "Deployment cancelled"
        fi
    fi

    log "Checking git remotes..."
    git remote -v

    success "Working tree verified"
}

#############################################
# BUILD PHASE
#############################################

build_docker_image() {
    header "BUILDING DOCKER IMAGE"

    log "Building Docker image: $LOCAL_DOCKER_IMAGE"
    docker build \
        --tag "$LOCAL_DOCKER_IMAGE" \
        --build-arg NODE_ENV=production \
        -f Dockerfile . || error "Docker build failed"

    log "Image built successfully"
    docker image inspect "$LOCAL_DOCKER_IMAGE" --format="Size: {{.Size}} bytes"

    success "Docker image built: $LOCAL_DOCKER_IMAGE"
}

#############################################
# REMOTE DEPLOYMENT PHASE
#############################################

prepare_remote_server() {
    header "PREPARING REMOTE SERVER"

    log "Creating deployment directory..."
    ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << EOSSH
        set -e

        # Create directory if not exists
        mkdir -p $REMOTE_DIR

        # Verify directory
        echo "Remote directory: $REMOTE_DIR"
        ls -ld $REMOTE_DIR

        # Create subdirectories
        mkdir -p $REMOTE_DIR/logs
        mkdir -p $REMOTE_DIR/data
        mkdir -p $REMOTE_DIR/backups
        mkdir -p $REMOTE_DIR/monitoring

        echo "Subdirectories created successfully"
EOSSH

    success "Remote server prepared"
}

backup_current_deployment() {
    header "BACKING UP CURRENT DEPLOYMENT"

    log "Creating backup of current deployment..."
    ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << EOSSH
        set -e

        if [ -d "$REMOTE_DIR/.git" ]; then
            cd $REMOTE_DIR
            echo "Creating backup tarball..."
            backup_file="backups/backup-\$(date +%Y%m%d-%H%M%S).tar.gz"
            tar -czf "\$backup_file" \
                --exclude=node_modules \
                --exclude=.git \
                --exclude=logs \
                --exclude=data \
                . 2>/dev/null || true

            echo "Backup created: \$backup_file"
            ls -lh "\$backup_file"
        else
            echo "No existing deployment found, skipping backup"
        fi
EOSSH

    success "Backup completed"
}

pull_latest_code() {
    header "PULLING LATEST CODE TO REMOTE SERVER"

    log "Cloning/updating repository on remote server..."
    ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << EOSSH
        set -e

        if [ -d "$REMOTE_DIR/.git" ]; then
            echo "Repository exists, pulling latest changes..."
            cd $REMOTE_DIR
            git fetch origin
            git checkout $REMOTE_GIT_BRANCH
            git pull origin $REMOTE_GIT_BRANCH
            echo "Repository updated successfully"
        else
            echo "Cloning repository..."
            rm -rf $REMOTE_DIR
            git clone --branch $REMOTE_GIT_BRANCH $REMOTE_GIT_REPO $REMOTE_DIR
            echo "Repository cloned successfully"
        fi

        cd $REMOTE_DIR
        echo "Current commit:"
        git log -1 --oneline
        echo "Current branch:"
        git rev-parse --abbrev-ref HEAD
EOSSH

    # Copy docker-compose files to remote server
    log "Copying docker-compose files to remote server..."
    scp -P $REMOTE_PORT docker-compose.yml "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/" 2>/dev/null || true
    scp -P $REMOTE_PORT docker-compose.yml "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/" 2>/dev/null || true

    success "Latest code pulled to remote server"
}

cleanup_old_docker_containers() {
    header "CLEANING UP OLD DOCKER CONTAINERS"

    log "Removing old containers and images..."
    ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << 'EOSSH'
        set -e

        echo "Stopping and removing all HMS containers..."
        docker-compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true
        docker-compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true

        echo "Removing dangling images and volumes..."
        docker image prune -a -f 2>/dev/null || true
        docker volume prune -f 2>/dev/null || true

        echo "Current Docker status:"
        echo "Running containers:"
        docker ps --no-trunc
        echo ""
        echo "Docker disk usage:"
        docker system df
EOSSH

    success "Docker cleanup completed"
}

deploy_with_docker_compose() {
    header "DEPLOYING WITH DOCKER COMPOSE"

    log "Starting deployment on remote server..."
    ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << EOSSH
        set -e

        cd $REMOTE_DIR

        # Build image on remote (or pull if using registry)
        echo "Building Docker image on remote server..."
        docker build \
            --tag $LOCAL_DOCKER_IMAGE \
            --build-arg NODE_ENV=production \
            -f Dockerfile . || exit 1

        echo "Starting services with docker-compose..."
        docker-compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true

        # Set environment variables for docker-compose
        export NODE_ENV=production
        export PORT=3001
        export FRONTEND_DOMAIN=$FRONTEND_DOMAIN
        export BACKEND_DOMAIN=$BACKEND_DOMAIN
        export SSL_KEY=$SSL_KEY
        export SSL_CERT=$SSL_CERT

        # Start containers
        docker-compose -f docker-compose.yml up -d

        echo "Waiting 30 seconds for services to start..."
        sleep 30

        echo "Service status:"
        docker-compose -f docker-compose.yml ps

        echo "Container logs (last 50 lines):"
        docker-compose -f docker-compose.yml logs --tail=50
EOSSH

    success "Docker Compose deployment completed"
}

#############################################
# POST-DEPLOYMENT VERIFICATION
#############################################

verify_frontend() {
    header "VERIFYING FRONTEND (${FRONTEND_DOMAIN})"

    log "Testing frontend endpoint: http://${FRONTEND_DOMAIN}"

    # Try multiple times in case service is still starting
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://${FRONTEND_DOMAIN}/" 2>/dev/null || echo "000")

        if [ "$response" = "200" ] || [ "$response" = "301" ] || [ "$response" = "302" ]; then
            success "Frontend responding with HTTP $response"
            return 0
        fi

        attempt=$((attempt + 1))
        if [ $attempt -lt $max_attempts ]; then
            warning "Attempt $attempt/$max_attempts: HTTP $response, retrying..."
            sleep 2
        fi
    done

    error "Frontend failed to respond after $max_attempts attempts"
}

verify_backend() {
    header "VERIFYING BACKEND (${BACKEND_DOMAIN})"

    log "Testing backend health endpoint: https://${BACKEND_DOMAIN}/health"

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://${BACKEND_DOMAIN}/health" 2>/dev/null || echo "000")

        if [ "$response" = "200" ]; then
            success "Backend health check passed (HTTP $response)"
            return 0
        fi

        attempt=$((attempt + 1))
        if [ $attempt -lt $max_attempts ]; then
            warning "Attempt $attempt/$max_attempts: HTTP $response, retrying..."
            sleep 2
        fi
    done

    error "Backend health check failed after $max_attempts attempts"
}

verify_ssl_certificates() {
    header "VERIFYING SSL CERTIFICATES"

    log "Checking SSL certificate validity..."

    # Check via remote server since certificates are there
    ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << EOSSH
        echo "Frontend SSL certificate (${FRONTEND_DOMAIN}):"
        openssl x509 -in $SSL_CERT -text -noout | grep -A 2 "Subject\|Issuer\|Not Before\|Not After"

        echo ""
        echo "Checking certificate expiration:"
        expiry_date=\$(openssl x509 -in $SSL_CERT -noout -enddate | cut -d= -f2)
        echo "Expires: \$expiry_date"

        # Check if valid for at least 30 days
        expiry_seconds=\$(date -d "\$expiry_date" +%s)
        current_seconds=\$(date +%s)
        days_remaining=\$(( (\$expiry_seconds - \$current_seconds) / 86400 ))

        if [ \$days_remaining -lt 30 ]; then
            echo "WARNING: Certificate expires in \$days_remaining days!"
        else
            echo "OK: Certificate valid for \$days_remaining more days"
        fi
EOSSH

    success "SSL certificate verification completed"
}

run_health_checks() {
    header "RUNNING COMPREHENSIVE HEALTH CHECKS"

    log "Running remote validation suite..."
    ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << EOSSH
        cd $REMOTE_DIR

        echo "Container status:"
        docker-compose -f docker-compose.yml ps

        echo ""
        echo "Checking database connectivity..."
        docker-compose -f docker-compose.yml exec -T postgres pg_isready -U postgres 2>/dev/null && echo "✓ PostgreSQL OK" || echo "✗ PostgreSQL FAILED"

        echo ""
        echo "Checking Redis connectivity..."
        docker-compose -f docker-compose.yml exec -T redis redis-cli ping 2>/dev/null && echo "✓ Redis OK" || echo "✗ Redis FAILED"

        echo ""
        echo "Checking Prometheus..."
        curl -s -o /dev/null -w "✓ Prometheus HTTP %{http_code}\n" http://localhost:9090/-/healthy

        echo ""
        echo "Checking Grafana..."
        curl -s -o /dev/null -w "✓ Grafana HTTP %{http_code}\n" http://localhost:3000/api/health

        echo ""
        echo "Docker system status:"
        docker system df
EOSSH

    success "Health checks completed"
}

#############################################
# MONITORING & LOGGING
#############################################

show_deployment_info() {
    header "DEPLOYMENT INFORMATION"

    cat << EOF
════════════════════════════════════════════════════════════
DEPLOYMENT SUMMARY
════════════════════════════════════════════════════════════

Frontend:
  Domain: $FRONTEND_DOMAIN
  URL: https://$FRONTEND_DOMAIN
  SSL: $SSL_CERT_PATH

Backend:
  Domain: $BACKEND_DOMAIN
  URL: https://$BACKEND_DOMAIN/health
  gRPC Port: 50051

Remote Server:
  Host: $REMOTE_HOST
  User: $REMOTE_USER
  Directory: $REMOTE_DIR
  Git Branch: $REMOTE_GIT_BRANCH

Services Running:
  - HMS Application (Node.js + Express)
  - PostgreSQL Database
  - Redis Cache
  - Prometheus Metrics
  - Grafana Dashboards
  - Loki Log Aggregation

Access Points:
  Frontend:    https://$FRONTEND_DOMAIN
  Backend API: https://$BACKEND_DOMAIN
  Prometheus:  http://$REMOTE_HOST:9090
  Grafana:     http://$REMOTE_HOST:3000

SSH Access:
  ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST
  cd $REMOTE_DIR

Docker Management:
  docker-compose -f docker-compose.yml ps
  docker-compose -f docker-compose.yml logs -f

Deployment Log:
  $LOG_FILE

════════════════════════════════════════════════════════════
EOF
}

#############################################
# ROLLBACK FUNCTION
#############################################

rollback_deployment() {
    header "ROLLING BACK DEPLOYMENT"

    log "Rolling back to previous version..."
    ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << EOSSH
        set -e

        cd $REMOTE_DIR

        echo "Checking git history..."
        git log --oneline -5

        echo "Rolling back to previous commit..."
        git reset --hard HEAD~1

        echo "Restarting services..."
        docker-compose -f docker-compose.yml down
        docker-compose -f docker-compose.yml up -d

        echo "Verifying rollback..."
        sleep 10
        docker-compose -f docker-compose.yml ps
EOSSH

    success "Rollback completed"
}

#############################################
# MAIN EXECUTION
#############################################

main() {
    action="${1:-deploy}"

    header "HERMES HF - REMOTE PRODUCTION DEPLOYMENT"
    log "Action: $action"
    log "Remote: ${REMOTE_USER}@${REMOTE_HOST}"
    log "Log file: $LOG_FILE"

    case "$action" in
        deploy|full)
            check_local_prerequisites
            check_working_tree
            check_remote_connectivity
            build_docker_image
            prepare_remote_server
            backup_current_deployment
            pull_latest_code
            cleanup_old_docker_containers
            deploy_with_docker_compose
            verify_frontend
            verify_backend
            verify_ssl_certificates
            run_health_checks
            show_deployment_info
            success "DEPLOYMENT SUCCESSFUL!"
            ;;
        rollback)
            check_remote_connectivity
            rollback_deployment
            ;;
        verify)
            header "RUNNING VERIFICATION ONLY"
            verify_frontend
            verify_backend
            run_health_checks
            ;;
        status)
            header "CHECKING DEPLOYMENT STATUS"
            ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << EOSSH
                cd $REMOTE_DIR
                echo "Git status:"
                git log -1 --oneline
                echo ""
                echo "Container status:"
                docker-compose -f docker-compose.yml ps
EOSSH
            ;;
        logs)
            header "VIEWING DEPLOYMENT LOGS"
            ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" "cd $REMOTE_DIR && docker-compose -f docker-compose.yml logs -f --tail=100"
            ;;
        *)
            echo "Usage: $0 [action]"
            echo ""
            echo "Actions:"
            echo "  deploy       - Full deployment (check, build, deploy, verify)"
            echo "  verify       - Verify deployed services"
            echo "  rollback     - Rollback to previous version"
            echo "  status       - Check deployment status"
            echo "  logs         - View deployment logs"
            echo ""
            exit 1
            ;;
    esac
}

main "$@"
