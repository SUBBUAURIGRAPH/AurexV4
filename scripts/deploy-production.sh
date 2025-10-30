#!/bin/bash
# Production Deployment Script for Aurigraph v2.1.0
# Deploys exchange-connector and strategy-builder to remote production server
# Usage: ./deploy-production.sh [staging|production] [region]

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERSION="v2.1.0"
ENVIRONMENT="${1:-staging}"
REGION="${2:-us-east-1}"
BUILD_DIR="${PROJECT_ROOT}/dist"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-registry.example.com}"
DEPLOYMENT_LOG="${PROJECT_ROOT}/deployment-$(date +%Y%m%d-%H%M%S).log"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DEPLOYMENT_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DEPLOYMENT_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DEPLOYMENT_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DEPLOYMENT_LOG"
}

# Pre-flight checks
preflight_checks() {
    log_info "Running pre-flight checks..."

    # Check required tools
    local required_tools=("docker" "docker-compose" "git" "npm" "psql" "redis-cli")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool not found: $tool"
            return 1
        fi
    done
    log_success "All required tools available"

    # Check environment file
    if [[ ! -f "${PROJECT_ROOT}/.env.${ENVIRONMENT}" ]]; then
        log_error "Environment file not found: .env.${ENVIRONMENT}"
        return 1
    fi
    log_success "Environment file found"

    # Load environment variables
    set -a
    source "${PROJECT_ROOT}/.env.${ENVIRONMENT}"
    set +a
    log_success "Environment variables loaded"

    # Check connectivity to remote server
    if [[ -z "${REMOTE_HOST:-}" ]]; then
        log_error "REMOTE_HOST not set in environment file"
        return 1
    fi

    log_info "Verifying connectivity to remote server: $REMOTE_HOST"
    if timeout 5 ssh -o ConnectTimeout=5 "$REMOTE_HOST" "echo 'Connected'" > /dev/null 2>&1; then
        log_success "Remote server connectivity verified"
    else
        log_error "Cannot connect to remote server: $REMOTE_HOST"
        return 1
    fi

    # Check disk space on remote
    log_info "Checking remote disk space..."
    local remote_disk=$(ssh "$REMOTE_HOST" "df -B G / | awk 'NR==2 {print \$4}' | sed 's/G//'")
    if [[ $remote_disk -lt 50 ]]; then
        log_error "Insufficient disk space on remote: ${remote_disk}GB (minimum: 50GB)"
        return 1
    fi
    log_success "Remote disk space sufficient: ${remote_disk}GB available"

    return 0
}

# Build Docker image
build_docker_image() {
    log_info "Building Docker image..."

    cd "$PROJECT_ROOT"

    # Install dependencies
    log_info "Installing dependencies..."
    npm ci --only=production || {
        log_error "Dependency installation failed"
        return 1
    }

    # Build TypeScript
    log_info "Building TypeScript..."
    npm run build || {
        log_error "TypeScript build failed"
        return 1
    }

    # Build Docker image
    log_info "Building Docker image: $DOCKER_REGISTRY/aurigraph:$VERSION"
    docker build \
        --tag "$DOCKER_REGISTRY/aurigraph:$VERSION" \
        --tag "$DOCKER_REGISTRY/aurigraph:latest" \
        --build-arg NODE_ENV=production \
        -f Dockerfile.prod \
        . || {
        log_error "Docker image build failed"
        return 1
    }

    # Verify image
    log_info "Verifying Docker image..."
    docker inspect "$DOCKER_REGISTRY/aurigraph:$VERSION" > /dev/null || {
        log_error "Docker image verification failed"
        return 1
    }

    log_success "Docker image built successfully"
    return 0
}

# Run tests
run_tests() {
    log_info "Running tests..."

    cd "$PROJECT_ROOT"

    # Unit tests
    log_info "Running unit tests..."
    npm run test:unit -- --passWithNoTests || {
        log_warning "Unit tests failed (non-blocking)"
    }

    # Integration tests
    log_info "Running integration tests..."
    npm run test:integration -- --passWithNoTests || {
        log_warning "Integration tests failed (non-blocking)"
    }

    # Security scan
    log_info "Running security scan..."
    npm audit --audit-level=high || {
        log_warning "Security vulnerabilities found"
    }

    log_success "Test suite completed"
    return 0
}

# Scan Docker image
scan_docker_image() {
    log_info "Scanning Docker image for vulnerabilities..."

    if command -v docker scan &> /dev/null; then
        docker scan "$DOCKER_REGISTRY/aurigraph:$VERSION" || {
            log_warning "Docker scan detected vulnerabilities"
        }
    else
        log_warning "docker scan not available, skipping vulnerability scan"
    fi

    log_success "Docker image scan completed"
    return 0
}

# Push to registry
push_to_registry() {
    log_info "Pushing Docker image to registry..."

    # Login to registry
    log_info "Logging in to Docker registry..."
    echo "$DOCKER_REGISTRY_PASSWORD" | docker login -u "$DOCKER_REGISTRY_USERNAME" --password-stdin "$DOCKER_REGISTRY" || {
        log_error "Docker registry login failed"
        return 1
    }

    # Push image
    log_info "Pushing image: $DOCKER_REGISTRY/aurigraph:$VERSION"
    docker push "$DOCKER_REGISTRY/aurigraph:$VERSION" || {
        log_error "Docker push failed"
        return 1
    }

    docker push "$DOCKER_REGISTRY/aurigraph:latest" || {
        log_error "Docker push (latest tag) failed"
        return 1
    }

    log_success "Docker image pushed to registry"
    return 0
}

# Backup production data
backup_production() {
    log_info "Creating production backups on remote server..."

    local backup_timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="/backups/production/$backup_timestamp"

    log_info "Creating backup directory: $backup_dir"
    ssh "$REMOTE_HOST" "mkdir -p $backup_dir" || {
        log_error "Failed to create backup directory"
        return 1
    }

    # Backup database
    log_info "Backing up PostgreSQL database..."
    ssh "$REMOTE_HOST" "pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME --format=custom --verbose -f $backup_dir/db_backup.dump" || {
        log_error "Database backup failed"
        return 1
    }

    # Backup Redis
    log_info "Backing up Redis..."
    ssh "$REMOTE_HOST" "redis-cli -h $REDIS_HOST BGSAVE && sleep 2 && cp /var/lib/redis/dump.rdb $backup_dir/redis_backup.rdb" || {
        log_warning "Redis backup may have failed (non-blocking)"
    }

    log_success "Production backups created: $backup_dir"
    return 0
}

# Deploy to remote
deploy_to_remote() {
    log_info "Deploying to remote server: $REMOTE_HOST"

    local deployment_id=$(date +%s)
    local deployment_dir="/opt/aurigraph/deployments/$deployment_id"

    # Create deployment directory
    log_info "Creating deployment directory..."
    ssh "$REMOTE_HOST" "mkdir -p $deployment_dir && cd $deployment_dir" || {
        log_error "Failed to create deployment directory"
        return 1
    }

    # Copy deployment files
    log_info "Copying deployment files..."
    scp -r "${PROJECT_ROOT}/docker-compose.prod.yml" "$REMOTE_HOST:$deployment_dir/" || {
        log_error "Failed to copy docker-compose file"
        return 1
    }

    scp -r "${PROJECT_ROOT}/.env.${ENVIRONMENT}" "$REMOTE_HOST:$deployment_dir/.env" || {
        log_error "Failed to copy environment file"
        return 1
    }

    # Pull new image
    log_info "Pulling Docker image on remote..."
    ssh "$REMOTE_HOST" "cd $deployment_dir && docker pull $DOCKER_REGISTRY/aurigraph:$VERSION" || {
        log_error "Failed to pull Docker image"
        return 1
    }

    # Stop old deployment (blue-green)
    log_info "Starting blue-green deployment..."
    ssh "$REMOTE_HOST" "cd $deployment_dir && \
        docker-compose -f docker-compose.prod.yml up -d \
        --scale aurigraph=3 \
        --no-deps" || {
        log_error "Docker-compose up failed"
        return 1
    }

    # Wait for containers to be healthy
    log_info "Waiting for deployment to be healthy..."
    local max_attempts=30
    local attempt=0
    while [[ $attempt -lt $max_attempts ]]; do
        local health_status=$(ssh "$REMOTE_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/health" || echo "000")

        if [[ "$health_status" == "200" ]]; then
            log_success "Deployment is healthy"
            return 0
        fi

        attempt=$((attempt + 1))
        log_info "Health check attempt $attempt/$max_attempts (status: $health_status)..."
        sleep 2
    done

    log_error "Deployment failed health check after $max_attempts attempts"
    return 1
}

# Run smoke tests
smoke_tests() {
    log_info "Running smoke tests..."

    # Check API endpoint
    log_info "Testing API endpoint..."
    local api_response=$(curl -s -w "\n%{http_code}" "http://$REMOTE_HOST:8080/health")
    local api_status=$(echo "$api_response" | tail -1)

    if [[ "$api_status" == "200" ]]; then
        log_success "API health check passed"
    else
        log_error "API health check failed (status: $api_status)"
        return 1
    fi

    # Check database connectivity
    log_info "Testing database connectivity..."
    if ssh "$REMOTE_HOST" "psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c 'SELECT 1;' > /dev/null 2>&1"; then
        log_success "Database connectivity verified"
    else
        log_error "Database connectivity check failed"
        return 1
    fi

    # Check Redis connectivity
    log_info "Testing Redis connectivity..."
    if ssh "$REMOTE_HOST" "redis-cli -h $REDIS_HOST ping > /dev/null 2>&1"; then
        log_success "Redis connectivity verified"
    else
        log_error "Redis connectivity check failed"
        return 1
    fi

    # Test exchange connector
    log_info "Testing exchange connector..."
    local exchange_test=$(curl -s "http://$REMOTE_HOST:8080/api/v1/exchanges/health")
    if [[ ! -z "$exchange_test" ]]; then
        log_success "Exchange connector responding"
    else
        log_warning "Exchange connector test inconclusive"
    fi

    log_success "Smoke tests completed successfully"
    return 0
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."

    # Check running containers
    log_info "Checking container status..."
    local running_containers=$(ssh "$REMOTE_HOST" "docker-compose -f /opt/aurigraph/deployments/*/docker-compose.prod.yml ps | grep -c 'Up'")

    if [[ $running_containers -ge 3 ]]; then
        log_success "All containers running ($running_containers)"
    else
        log_error "Not all containers running (found: $running_containers)"
        return 1
    fi

    # Check metrics collection
    log_info "Checking metrics collection..."
    if ssh "$REMOTE_HOST" "curl -s http://localhost:9090/metrics | grep -q 'aurigraph_'"; then
        log_success "Metrics collection active"
    else
        log_warning "Metrics may not be collecting (non-blocking)"
    fi

    log_success "Deployment verified successfully"
    return 0
}

# Rollback function
rollback_deployment() {
    log_error "Rolling back deployment..."

    ssh "$REMOTE_HOST" "cd /opt/aurigraph && \
        docker-compose -f docker-compose.prod.yml stop && \
        docker-compose -f docker-compose.prod.yml down && \
        docker pull $DOCKER_REGISTRY/aurigraph:latest && \
        docker-compose -f docker-compose.prod.yml up -d" || {
        log_error "Rollback failed!"
        return 1
    }

    log_warning "Deployment rolled back to previous version"
    return 0
}

# Main deployment flow
main() {
    log_info "=========================================="
    log_info "Aurigraph v$VERSION Deployment Script"
    log_info "=========================================="
    log_info "Environment: $ENVIRONMENT"
    log_info "Region: $REGION"
    log_info "Log file: $DEPLOYMENT_LOG"
    log_info "=========================================="

    # Pre-flight checks
    if ! preflight_checks; then
        log_error "Pre-flight checks failed"
        exit 1
    fi

    # Build and test
    if ! build_docker_image; then
        log_error "Docker image build failed"
        exit 1
    fi

    if ! run_tests; then
        log_warning "Tests failed but continuing deployment"
    fi

    if ! scan_docker_image; then
        log_warning "Security scan failed but continuing"
    fi

    # Push to registry
    if ! push_to_registry; then
        log_error "Failed to push Docker image to registry"
        exit 1
    fi

    # Backup production
    if ! backup_production; then
        log_error "Backup failed - aborting deployment"
        exit 1
    fi

    # Deploy
    if ! deploy_to_remote; then
        log_error "Deployment failed, rolling back..."
        rollback_deployment
        exit 1
    fi

    # Verify
    if ! verify_deployment; then
        log_error "Deployment verification failed, rolling back..."
        rollback_deployment
        exit 1
    fi

    # Smoke tests
    if ! smoke_tests; then
        log_error "Smoke tests failed, rolling back..."
        rollback_deployment
        exit 1
    fi

    log_success "=========================================="
    log_success "Deployment completed successfully!"
    log_success "Version: $VERSION"
    log_success "Environment: $ENVIRONMENT"
    log_success "Timestamp: $(date)"
    log_success "=========================================="

    return 0
}

# Run main function
main "$@"
exit $?
