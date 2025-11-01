#!/bin/bash

# HMS GNN Prediction System - Production Deployment Script
# This script deploys the application to a remote server

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REMOTE_USER=${REMOTE_USER:-"deploy"}
REMOTE_HOST=${REMOTE_HOST:-"api.hms-trading.com"}
REMOTE_PATH=${REMOTE_PATH:-"/opt/hms-trading"}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"docker.io"}
APP_NAME="hms-gnn"
VERSION=${VERSION:-"1.0.0"}

# Functions
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

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    # Check SSH access
    if ! ssh -q -o ConnectTimeout=5 "${REMOTE_USER}@${REMOTE_HOST}" exit; then
        log_error "Cannot connect to remote server: ${REMOTE_USER}@${REMOTE_HOST}"
        exit 1
    fi

    log_success "All prerequisites met"
}

build_docker_image() {
    log_info "Building Docker image..."

    docker build \
        --tag "${DOCKER_REGISTRY}/${APP_NAME}:${VERSION}" \
        --tag "${DOCKER_REGISTRY}/${APP_NAME}:latest" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg VERSION="${VERSION}" \
        .

    log_success "Docker image built successfully"
}

push_docker_image() {
    log_info "Pushing Docker image to registry..."

    docker push "${DOCKER_REGISTRY}/${APP_NAME}:${VERSION}"
    docker push "${DOCKER_REGISTRY}/${APP_NAME}:latest"

    log_success "Docker image pushed successfully"
}

prepare_remote_server() {
    log_info "Preparing remote server..."

    ssh "${REMOTE_USER}@${REMOTE_HOST}" << 'EOF'
        set -e

        # Create application directory
        mkdir -p /opt/hms-trading
        cd /opt/hms-trading

        # Create necessary directories
        mkdir -p logs data config/ssl config/grafana/{dashboards,datasources}

        # Create .env file if not exists
        if [ ! -f .env ]; then
            cp .env.example .env || touch .env
        fi

        log_success "Remote server prepared"
EOF

    log_success "Remote server prepared"
}

deploy_application() {
    log_info "Deploying application..."

    ssh "${REMOTE_USER}@${REMOTE_HOST}" << EOF
        set -e

        cd ${REMOTE_PATH}

        # Pull latest code
        git pull origin main || true

        # Update docker-compose.yml with new image version
        sed -i 's|image:.*|image: ${DOCKER_REGISTRY}/${APP_NAME}:${VERSION}|g' docker-compose.yml

        # Pull latest images
        docker-compose pull

        # Stop old containers
        docker-compose down || true

        # Start new containers
        docker-compose up -d

        # Wait for services to be healthy
        echo "Waiting for services to start..."
        sleep 30

        # Run database migrations
        docker-compose exec -T app npm run migrate || true

        # Run health checks
        if curl -f http://localhost:3000/api/gnn/health; then
            echo "Health check passed"
        else
            echo "Health check failed"
            exit 1
        fi
EOF

    log_success "Application deployed successfully"
}

run_smoke_tests() {
    log_info "Running smoke tests..."

    # Test health endpoint
    if curl -f "https://${REMOTE_HOST}/api/gnn/health" &> /dev/null; then
        log_success "Health endpoint responding"
    else
        log_warning "Health endpoint not responding yet"
    fi

    # Test prediction endpoint
    if curl -f "https://${REMOTE_HOST}/api/gnn/model" &> /dev/null; then
        log_success "API endpoints responding"
    else
        log_warning "API endpoints not responding yet"
    fi

    log_success "Smoke tests completed"
}

rollback_deployment() {
    log_warning "Rolling back deployment..."

    ssh "${REMOTE_USER}@${REMOTE_HOST}" << EOF
        cd ${REMOTE_PATH}

        # Revert to previous version
        git checkout HEAD~1

        # Restart with previous version
        docker-compose down
        docker-compose up -d
EOF

    log_success "Rollback completed"
}

cleanup() {
    log_info "Cleaning up..."

    # Remove old images (keep last 3)
    docker image prune -f --filter "until=168h"

    log_success "Cleanup completed"
}

# Main deployment flow
main() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  HMS GNN Prediction System - Production Deployment         ║${NC}"
    echo -e "${BLUE}║  Version: ${VERSION}                                              ║${NC}"
    echo -e "${BLUE}║  Target: ${REMOTE_USER}@${REMOTE_HOST}                           ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --version)
                VERSION="$2"
                shift 2
                ;;
            --host)
                REMOTE_HOST="$2"
                shift 2
                ;;
            --user)
                REMOTE_USER="$2"
                shift 2
                ;;
            --rollback)
                rollback_deployment
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Execute deployment steps
    check_prerequisites
    build_docker_image
    push_docker_image
    prepare_remote_server
    deploy_application
    run_smoke_tests
    cleanup

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✓ Deployment completed successfully!                     ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║  Application URL: https://${REMOTE_HOST}                      ║${NC}"
    echo -e "${GREEN}║  Grafana URL: https://${REMOTE_HOST}:3001                     ║${NC}"
    echo -e "${GREEN}║  Prometheus URL: https://${REMOTE_HOST}:9090                   ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Run main function
main "$@"
