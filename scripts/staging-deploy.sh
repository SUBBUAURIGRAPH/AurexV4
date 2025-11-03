#!/bin/bash

#############################################
# HERMES HF - STAGING DEPLOYMENT SCRIPT
# Purpose: Automate staging environment setup and deployment
# Usage: ./scripts/staging-deploy.sh [action]
# Actions: setup, deploy, validate, rollback, logs, status
#############################################

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STAGING_DIR="${STAGING_DIR:-/opt/HMS-staging}"
COMPOSE_FILE="docker-compose-staging.yml"
ENV_FILE=".env.staging"
PROJECT_NAME="hermes-hf"
LOG_FILE="/tmp/staging-deploy-$(date +%Y%m%d-%H%M%S).log"

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
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}" | tee -a "$LOG_FILE"
}

check_prerequisites() {
    log "Checking prerequisites..."

    local missing=0

    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        missing=1
    else
        success "Docker found: $(docker --version)"
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
        missing=1
    else
        success "Docker Compose found: $(docker-compose --version)"
    fi

    # Check Git
    if ! command -v git &> /dev/null; then
        error "Git is not installed"
        missing=1
    else
        success "Git found: $(git --version)"
    fi

    # Check environment file
    if [ ! -f "$ENV_FILE" ]; then
        error "Environment file '$ENV_FILE' not found"
        missing=1
    else
        success "Environment file found"
    fi

    if [ $missing -eq 1 ]; then
        error "Missing prerequisites. Please install required tools."
        exit 1
    fi

    log "All prerequisites verified"
}

verify_environment() {
    log "Verifying environment configuration..."

    local required_vars=(
        "NODE_ENV"
        "DB_HOST"
        "DB_PORT"
        "REDIS_URL"
        "JWT_SECRET"
    )

    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$ENV_FILE"; then
            error "Required variable '$var' not found in $ENV_FILE"
            exit 1
        fi
    done

    success "Environment configuration verified"
}

setup_staging() {
    log "Setting up staging environment..."

    check_prerequisites
    verify_environment

    # Create staging directory if needed
    if [ ! -d "$STAGING_DIR" ]; then
        log "Creating staging directory at $STAGING_DIR"
        mkdir -p "$STAGING_DIR"
    fi

    # Copy environment file
    log "Configuring environment..."
    cp "$ENV_FILE" ".env" || {
        error "Failed to copy environment file"
        exit 1
    }
    success "Environment configured"

    # Pull latest code
    log "Pulling latest code..."
    git pull origin main || {
        error "Failed to pull latest code"
        exit 1
    }
    success "Code updated"

    # Build Docker image
    log "Building Docker image..."
    docker build \
        --tag "$PROJECT_NAME:staging" \
        --build-arg NODE_ENV=staging \
        -f Dockerfile . || {
        error "Failed to build Docker image"
        exit 1
    }
    success "Docker image built"

    # Create volumes and networks
    log "Preparing Docker volumes and networks..."
    docker volume create hermes-postgres-data 2>/dev/null || true
    docker volume create hermes-redis-data 2>/dev/null || true
    docker volume create hermes-prometheus-data 2>/dev/null || true
    docker volume create hermes-grafana-data 2>/dev/null || true
    docker volume create hermes-loki-data 2>/dev/null || true
    success "Volumes and networks prepared"

    log "Staging environment setup complete"
}

deploy_staging() {
    log "Starting staging deployment..."

    if [ ! -f ".env" ]; then
        warning "Environment file not found, running setup first..."
        setup_staging
    fi

    # Stop existing containers
    log "Stopping existing containers..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down --remove-orphans 2>/dev/null || true
    sleep 2
    success "Existing containers stopped"

    # Start new containers
    log "Starting containers..."
    docker-compose -f "$COMPOSE_FILE" \
        -p "$PROJECT_NAME" \
        up -d || {
        error "Failed to start containers"
        exit 1
    }
    success "Containers started"

    # Wait for services to be ready
    log "Waiting for services to be ready (60 seconds)..."
    sleep 15

    # Check database connectivity
    log "Checking database connectivity..."
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker exec "${PROJECT_NAME}-postgres" pg_isready -U postgres &>/dev/null; then
            success "Database is ready"
            break
        fi
        attempt=$((attempt + 1))
        if [ $attempt -lt $max_attempts ]; then
            sleep 2
        fi
    done

    if [ $attempt -eq $max_attempts ]; then
        error "Database failed to start within timeout"
        exit 1
    fi

    # Run migrations
    log "Running database migrations..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T hms-app npm run migrate || {
        warning "Migrations may not be available or failed"
    }

    log "Deployment complete"
    success "Staging deployment successful!"
}

validate_staging() {
    log "Validating staging deployment..."

    local failed=0

    # Check if containers are running
    log "Checking container status..."
    local running_count=$(docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps --services --filter "status=running" | wc -l)
    if [ "$running_count" -gt 0 ]; then
        success "Containers running: $running_count"
    else
        error "No containers are running"
        failed=1
    fi

    # Check API health
    log "Checking API health endpoint..."
    local max_attempts=10
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f http://localhost:3001/health > /dev/null; then
            success "API health check passed"
            break
        fi
        attempt=$((attempt + 1))
        if [ $attempt -lt $max_attempts ]; then
            sleep 2
        fi
    done

    if [ $attempt -eq $max_attempts ]; then
        error "API health check failed"
        failed=1
    fi

    # Check database
    log "Checking database connectivity..."
    if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T postgres pg_isready -U postgres &>/dev/null; then
        success "Database is responding"
    else
        error "Database is not responding"
        failed=1
    fi

    # Check Redis
    log "Checking Redis connectivity..."
    if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T redis redis-cli ping &>/dev/null; then
        success "Redis is responding"
    else
        error "Redis is not responding"
        failed=1
    fi

    # Check Prometheus
    log "Checking Prometheus..."
    if curl -s -f http://localhost:9090/-/healthy > /dev/null; then
        success "Prometheus is responding"
    else
        warning "Prometheus may not be fully ready"
    fi

    # Check Grafana
    log "Checking Grafana..."
    if curl -s -f http://localhost:3000/api/health > /dev/null; then
        success "Grafana is responding"
    else
        warning "Grafana may not be fully ready"
    fi

    if [ $failed -eq 0 ]; then
        success "All validation checks passed!"
    else
        error "Some validation checks failed"
        exit 1
    fi
}

rollback_staging() {
    log "Rolling back staging deployment..."

    # Get previous commit
    local prev_commit=$(git rev-parse HEAD~1)
    log "Rolling back to commit: $prev_commit"

    # Stop containers
    log "Stopping containers..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down || true

    # Checkout previous version
    log "Checking out previous version..."
    git checkout "$prev_commit" || {
        error "Failed to checkout previous version"
        exit 1
    }

    # Redeploy
    log "Redeploying previous version..."
    deploy_staging

    success "Rollback complete"
}

show_logs() {
    log "Showing container logs (last 100 lines, follow mode enabled)..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f --tail=100
}

show_status() {
    log "Staging environment status:"
    echo ""
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
    echo ""

    log "Container resource usage:"
    docker stats --no-stream
}

cleanup_staging() {
    log "Cleaning up staging environment..."

    # Stop containers
    log "Stopping containers..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down --remove-orphans || true

    # Remove volumes
    log "Removing volumes..."
    docker volume rm hermes-postgres-data 2>/dev/null || true
    docker volume rm hermes-redis-data 2>/dev/null || true
    docker volume rm hermes-prometheus-data 2>/dev/null || true
    docker volume rm hermes-grafana-data 2>/dev/null || true
    docker volume rm hermes-loki-data 2>/dev/null || true

    success "Cleanup complete"
}

#############################################
# MAIN SCRIPT
#############################################

ACTION="${1:-deploy}"

log "HERMES HF Staging Deployment Script"
log "Action: $ACTION"
log "Log file: $LOG_FILE"
echo ""

case "$ACTION" in
    setup)
        setup_staging
        ;;
    deploy)
        deploy_staging
        ;;
    validate|check)
        validate_staging
        ;;
    rollback)
        rollback_staging
        ;;
    logs|log)
        show_logs
        ;;
    status)
        show_status
        ;;
    cleanup)
        cleanup_staging
        ;;
    full|full-deploy)
        setup_staging
        deploy_staging
        validate_staging
        ;;
    *)
        echo "Usage: $0 [action]"
        echo ""
        echo "Available actions:"
        echo "  setup         - Setup staging environment"
        echo "  deploy        - Deploy to staging"
        echo "  validate      - Validate staging deployment"
        echo "  rollback      - Rollback to previous version"
        echo "  logs          - Show container logs"
        echo "  status        - Show deployment status"
        echo "  cleanup       - Clean up staging environment"
        echo "  full-deploy   - Run setup + deploy + validate"
        echo ""
        exit 1
        ;;
esac

log "Script completed successfully"
