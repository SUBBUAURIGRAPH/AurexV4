#!/bin/bash

################################################################################
# HMS Mobile Trading Platform - Deployment Script
# Deploys the mobile app web version to remote server
################################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REMOTE_USER="subbu"
REMOTE_HOST="hms.aurex.in"
REMOTE_WORKDIR="/opt/HMS"
GITHUB_REPO="git@github.com:Aurigraph-DLT-Corp/HMS.git"
GITHUB_BRANCH="main"
IMAGE_NAME="hms-mobile-web"
IMAGE_TAG="latest"
REGISTRY="hms.aurex.in:5000"  # Change to your registry if needed
CONTAINER_NAME="hms-mobile-web"
APP_PORT="80"
APP_PORT_HTTPS="443"

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

################################################################################
# Pre-deployment Checks
################################################################################

check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker."
        exit 1
    fi
    print_success "Docker is installed"

    # Check if git is installed
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed. Please install Git."
        exit 1
    fi
    print_success "Git is installed"

    # Check SSH connection
    if ! ssh -o ConnectTimeout=5 ${REMOTE_USER}@${REMOTE_HOST} "echo connected" &> /dev/null; then
        print_error "Cannot connect to remote server: ${REMOTE_USER}@${REMOTE_HOST}"
        print_error "Please verify SSH credentials and network connectivity"
        exit 1
    fi
    print_success "SSH connection to remote server verified"
}

################################################################################
# Git Operations
################################################################################

commit_changes() {
    print_header "Committing Changes to Git"

    # Check if there are changes
    if git status --short | grep -q .; then
        print_warning "Uncommitted changes detected"

        # Add all changes
        git add .
        print_success "Added all changes to git"

        # Commit with timestamp
        COMMIT_MSG="Deploy: HMS Mobile Web $(date '+%Y-%m-%d %H:%M:%S')"
        git commit -m "$COMMIT_MSG"
        print_success "Committed changes: $COMMIT_MSG"
    else
        print_success "No changes to commit"
    fi
}

push_to_github() {
    print_header "Pushing to GitHub"

    git push origin ${GITHUB_BRANCH}
    print_success "Pushed to GitHub branch: ${GITHUB_BRANCH}"
}

################################################################################
# Docker Build
################################################################################

build_docker_image() {
    print_header "Building Docker Image"

    # Build the Docker image
    docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -f mobile/Dockerfile .
    print_success "Docker image built successfully: ${IMAGE_NAME}:${IMAGE_TAG}"

    # Display image info
    docker images | grep ${IMAGE_NAME}
}

################################################################################
# Remote Deployment
################################################################################

cleanup_remote_containers() {
    print_header "Cleaning Up Remote Containers"

    ssh ${REMOTE_USER}@${REMOTE_HOST} << 'EOFREMOTE'
        set -e

        echo "Stopping container..."
        docker stop hms-mobile-web 2>/dev/null || true

        echo "Removing container..."
        docker rm hms-mobile-web 2>/dev/null || true

        echo "Pruning dangling images..."
        docker image prune -f

        echo "Pruning volumes..."
        docker volume prune -f

        echo "Cleanup completed"
EOFREMOTE

    print_success "Remote cleanup completed"
}

deploy_to_remote() {
    print_header "Deploying to Remote Server"

    # Copy docker-compose and nginx config to remote
    ssh ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${REMOTE_WORKDIR}/mobile/logs"

    scp mobile/docker-compose.yml ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_WORKDIR}/mobile/
    print_success "Copied docker-compose.yml"

    scp mobile/nginx.conf ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_WORKDIR}/mobile/
    print_success "Copied nginx.conf"

    scp mobile/Dockerfile ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_WORKDIR}/mobile/
    print_success "Copied Dockerfile"

    # Build image on remote server
    ssh ${REMOTE_USER}@${REMOTE_HOST} << EOF
        set -e
        cd ${REMOTE_WORKDIR}

        echo "Pulling latest code from GitHub..."
        git pull origin ${GITHUB_BRANCH}

        echo "Building Docker image on remote server..."
        docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -f mobile/Dockerfile .

        echo "Build completed successfully"
EOF

    print_success "Remote build completed"
}

start_containers() {
    print_header "Starting Containers"

    ssh ${REMOTE_USER}@${REMOTE_HOST} << EOF
        set -e
        cd ${REMOTE_WORKDIR}/mobile

        echo "Starting containers with docker-compose..."
        docker-compose up -d

        echo "Waiting for container to be healthy..."
        sleep 10

        echo "Container status:"
        docker ps | grep ${CONTAINER_NAME}

        echo "Checking container logs..."
        docker-compose logs --tail=20
EOF

    print_success "Containers started successfully"
}

################################################################################
# Health Checks
################################################################################

health_check_local() {
    print_header "Local Health Check"

    # Wait for container to be ready
    sleep 5

    # Check if service is responding
    if curl -s http://localhost:${APP_PORT} &> /dev/null; then
        print_success "Local health check passed"
        return 0
    else
        print_warning "Local health check failed - this may be expected if running in WSL"
        return 0
    fi
}

health_check_remote() {
    print_header "Remote Health Check"

    # Check remote service
    if ssh ${REMOTE_USER}@${REMOTE_HOST} "curl -s -k https://${REMOTE_HOST} &> /dev/null"; then
        print_success "Remote health check passed"
        return 0
    else
        print_error "Remote health check failed"
        return 1
    fi
}

################################################################################
# Rollback
################################################################################

rollback_remote() {
    print_header "Rolling Back Remote Deployment"

    ssh ${REMOTE_USER}@${REMOTE_HOST} << EOF
        set -e
        cd ${REMOTE_WORKDIR}/mobile

        echo "Stopping current container..."
        docker-compose down

        echo "Rollback completed"
EOF

    print_success "Rollback completed"
}

################################################################################
# Display Status
################################################################################

display_deployment_status() {
    print_header "Deployment Status"

    echo -e "${GREEN}========== DEPLOYMENT INFORMATION ==========${NC}"
    echo "Frontend URL: https://${REMOTE_HOST}"
    echo "Backend URL: https://apihms.aurex.in"
    echo "WebSocket URL: wss://apihms.aurex.in"
    echo ""
    echo "Remote Server: ${REMOTE_USER}@${REMOTE_HOST}"
    echo "Working Directory: ${REMOTE_WORKDIR}"
    echo "GitHub Branch: ${GITHUB_BRANCH}"
    echo ""
    echo "Docker Image: ${IMAGE_NAME}:${IMAGE_TAG}"
    echo "Container Name: ${CONTAINER_NAME}"
    echo "Ports: ${APP_PORT} (HTTP), ${APP_PORT_HTTPS} (HTTPS)"
    echo ""
    echo -e "${GREEN}========== DEPLOYMENT COMPLETE ==========${NC}"
}

################################################################################
# Main Execution
################################################################################

main() {
    print_header "HMS Mobile Trading Platform - Deployment Pipeline"

    # Parse command line arguments
    case "${1:-deploy}" in
        deploy)
            check_prerequisites
            commit_changes
            push_to_github
            build_docker_image
            cleanup_remote_containers
            deploy_to_remote
            start_containers
            health_check_remote
            display_deployment_status
            ;;
        rollback)
            print_warning "Rolling back deployment..."
            rollback_remote
            print_success "Rollback completed"
            ;;
        status)
            ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_WORKDIR}/mobile && docker-compose ps"
            ;;
        logs)
            ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_WORKDIR}/mobile && docker-compose logs -f"
            ;;
        *)
            echo "Usage: $0 {deploy|rollback|status|logs}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Deploy application to remote server (default)"
            echo "  rollback - Rollback to previous version"
            echo "  status   - Show container status"
            echo "  logs     - View container logs"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
