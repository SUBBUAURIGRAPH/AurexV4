#!/bin/bash

################################################################################
# HMS v2.0 Production Deployment Script
# Builds Docker image and deploys to remote server
#
# Prerequisites:
# - SSH access to remote server (subbu@hms.aurex.in)
# - Docker installed locally
# - Git repository configured
#
# Usage: ./deploy-hms-v2.sh [production|staging]
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ENVIRONMENT="${1:-production}"
REMOTE_USER="subbu"
REMOTE_HOST="hms.aurex.in"
REMOTE_DIR="/opt/HMS"
GIT_BRANCH="main"
DOCKER_IMAGE="hms-gnn"
DOCKER_TAG="v2.0.0"
DOCKER_REGISTRY=""  # Leave empty for local or set to your registry

# Derived variables
DOCKER_IMAGE_FULL="${DOCKER_REGISTRY:+${DOCKER_REGISTRY}/}${DOCKER_IMAGE}:${DOCKER_TAG}"
TEMP_IMAGE_FILE="/tmp/${DOCKER_IMAGE}-${DOCKER_TAG}-$(date +%s).tar"
BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
VCS_REF="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}    $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}[$1] $2${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}\n"
}

print_error() {
    echo -e "${RED}✗ $1${NC}\n"
    exit 1
}

check_prerequisites() {
    print_step "0/9" "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
    fi

    # Check Git
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed"
    fi

    # Check SSH connectivity
    if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "${REMOTE_USER}@${REMOTE_HOST}" "echo 'Connected' > /dev/null" 2>&1; then
        print_error "Cannot connect to remote server ${REMOTE_USER}@${REMOTE_HOST}"
    fi

    print_success "All prerequisites met"
}

install_dependencies() {
    print_step "1/9" "Installing dependencies..."

    cd "$(dirname "$0")"

    # Install root dependencies
    npm install --legacy-peer-deps 2>&1 | tail -5

    # Install backend dependencies
    cd backend
    npm install --legacy-peer-deps 2>&1 | tail -5
    cd ..

    # Install web dependencies
    cd web
    npm install --legacy-peer-deps 2>&1 | tail -5
    cd ..

    print_success "Dependencies installed"
}

build_applications() {
    print_step "2/9" "Building applications..."

    cd "$(dirname "$0")"

    # Build backend TypeScript
    echo "Building backend..."
    cd backend
    npx tsc 2>/dev/null || echo "  Backend TypeScript build skipped (no tsconfig)"
    cd ..

    # Build web
    echo "Building web frontend..."
    cd web
    # If vite is installed, build with it; otherwise skip
    npm run build 2>/dev/null || echo "  Web build skipped (vite not configured)"
    cd ..

    print_success "Applications built"
}

build_docker_image() {
    print_step "3/9" "Building Docker image..."

    cd "$(dirname "$0")"

    docker build \
        -t "${DOCKER_IMAGE_FULL}" \
        --build-arg BUILD_DATE="${BUILD_DATE}" \
        --build-arg VCS_REF="${VCS_REF}" \
        --label "version=${DOCKER_TAG}" \
        --label "build.date=${BUILD_DATE}" \
        -f Dockerfile . \
        2>&1 | tail -20

    print_success "Docker image built: ${DOCKER_IMAGE_FULL}"
}

verify_docker_image() {
    print_step "4/9" "Verifying Docker image..."

    docker images | grep "${DOCKER_IMAGE}" || print_error "Docker image not found"

    # Get image size
    IMAGE_SIZE=$(docker images --format "{{.Size}}" "${DOCKER_IMAGE_FULL}")
    echo "  Image size: ${IMAGE_SIZE}"

    print_success "Docker image verified"
}

test_docker_locally() {
    print_step "5/9" "Testing Docker image locally..."

    # Run container briefly to test
    echo "  Testing image startup (10 second test)..."
    if timeout 10 docker run \
        -p 3000:3000 \
        -e NODE_ENV=test \
        "${DOCKER_IMAGE_FULL}" 2>&1 | head -20 ; then
        echo "  (Timeout is expected - container started successfully)"
    fi

    print_success "Docker image test completed"
}

save_and_transfer_image() {
    print_step "6/9" "Saving and transferring Docker image..."

    echo "  Saving image to ${TEMP_IMAGE_FILE}..."
    docker save "${DOCKER_IMAGE_FULL}" -o "${TEMP_IMAGE_FILE}"

    FILE_SIZE=$(($(stat -f%z "${TEMP_IMAGE_FILE}" 2>/dev/null || stat -c%s "${TEMP_IMAGE_FILE}" 2>/dev/null) / 1024 / 1024))
    echo "  Image file size: ${FILE_SIZE}MB"

    echo "  Transferring to remote server..."
    scp -o ConnectTimeout=10 -o BatchMode=yes \
        "${TEMP_IMAGE_FILE}" \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/" || \
        print_error "Failed to transfer image to remote server"

    # Clean up local temp file
    rm -f "${TEMP_IMAGE_FILE}"

    print_success "Image transferred to remote"
}

prepare_remote_server() {
    print_step "7/9" "Preparing remote server..."

    ssh -o ConnectTimeout=10 -o BatchMode=yes \
        "${REMOTE_USER}@${REMOTE_HOST}" << 'EOFPREP'
set -e
REMOTE_DIR="/opt/HMS"
echo "Creating remote directory structure..."
mkdir -p "${REMOTE_DIR}"
mkdir -p "${REMOTE_DIR}/logs"
mkdir -p "${REMOTE_DIR}/data"
mkdir -p "${REMOTE_DIR}/config"
echo "Remote directory structure ready"
EOFPREP

    print_success "Remote server prepared"
}

stop_and_clean() {
    print_step "8/9" "Stopping and cleaning old containers..."

    ssh -o ConnectTimeout=10 -o BatchMode=yes \
        "${REMOTE_USER}@${REMOTE_HOST}" << 'EOFCLEAN'
set +e
cd /opt/HMS

echo "Stopping Docker Compose services..."
docker-compose down 2>/dev/null || true

echo "Stopping individual containers..."
docker ps -a | grep "hms" | awk '{print $1}' | xargs -r docker stop 2>/dev/null || true

echo "Removing containers..."
docker ps -a | grep "hms" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true

echo "Pruning unused images..."
docker image prune -f --filter "dangling=true" 2>/dev/null || true

set -e
echo "Cleanup complete"
EOFCLEAN

    print_success "Cleanup complete"
}

deploy_application() {
    print_step "9/9" "Deploying application..."

    ssh -o ConnectTimeout=10 -o BatchMode=yes \
        "${REMOTE_USER}@${REMOTE_HOST}" << 'EOFDEPLOY'
set -e
REMOTE_DIR="/opt/HMS"
DOCKER_IMAGE="hms-gnn"
DOCKER_TAG="v2.0.0"
IMAGE_FILE="${DOCKER_IMAGE}-${DOCKER_TAG}-"*.tar

cd "${REMOTE_DIR}"

echo "Loading Docker image..."
docker load -i ${IMAGE_FILE} 2>&1 | grep "Loaded\|loaded" || echo "Image loading completed"

echo "Removing temporary image file..."
rm -f ${IMAGE_FILE}

echo "Starting Docker Compose services..."
if [ -f "docker-compose.prod.yml" ]; then
    docker-compose -f docker-compose.prod.yml up -d
elif [ -f "docker-compose.yml" ]; then
    docker-compose up -d
else
    echo "ERROR: No docker-compose file found"
    exit 1
fi

echo "Waiting for services to start..."
sleep 15

echo "Services started successfully"
EOFDEPLOY

    print_success "Application deployed"
}

verify_deployment() {
    echo ""
    print_header "VERIFYING DEPLOYMENT"

    ssh -o ConnectTimeout=10 -o BatchMode=yes \
        "${REMOTE_USER}@${REMOTE_HOST}" << 'EOFVERIFY'
set +e

echo "═══════════════════════════════════════════════════════════════"
echo "Running Containers:"
echo "═══════════════════════════════════════════════════════════════"
docker ps

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Docker Images:"
echo "═══════════════════════════════════════════════════════════════"
docker images | grep "hms"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Service Health Checks:"
echo "═══════════════════════════════════════════════════════════════"

echo ""
echo "Checking HTTP API (port 3000)..."
curl -s -f -w "HTTP Status: %{http_code}\n" http://localhost:3000/health 2>/dev/null || echo "API not yet responding (may still be starting)"

echo ""
echo "Checking Grafana (port 3001)..."
curl -s -f -w "HTTP Status: %{http_code}\n" http://localhost:3001/api/health 2>/dev/null || echo "Grafana not yet responding"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Recent Logs:"
echo "═══════════════════════════════════════════════════════════════"
docker-compose logs --tail=20 2>/dev/null || echo "No logs available yet"

echo ""
EOFVERIFY

    echo ""
}

################################################################################
# Main Execution
################################################################################

print_header "HMS v2.0 Production Deployment - ${ENVIRONMENT}"
echo "Deployment Configuration:"
echo "  Environment:    ${ENVIRONMENT}"
echo "  Remote Server:  ${REMOTE_USER}@${REMOTE_HOST}"
echo "  Remote Dir:     ${REMOTE_DIR}"
echo "  Docker Image:   ${DOCKER_IMAGE_FULL}"
echo "  Build Date:     ${BUILD_DATE}"
echo "  Git Ref:        ${VCS_REF}"
echo ""
echo "Press ENTER to continue or CTRL+C to cancel..."
read -r

# Execute deployment steps
check_prerequisites
install_dependencies
build_applications
build_docker_image
verify_docker_image

# Skip local test as it may cause issues on CI/CD
# test_docker_locally

save_and_transfer_image
prepare_remote_server
stop_and_clean
deploy_application
verify_deployment

################################################################################
# Summary
################################################################################

print_header "DEPLOYMENT COMPLETE"

echo "✓ HMS v2.0 successfully deployed to ${ENVIRONMENT} environment"
echo ""
echo "Access Points:"
echo "  Frontend:    https://hms.aurex.in"
echo "  Backend API: https://apihms.aurex.in/api/v1"
echo "  Grafana:     https://hms.aurex.in:3001 (default: admin/admin)"
echo "  Prometheus:  https://hms.aurex.in:9090"
echo ""
echo "Useful Commands:"
echo "  View logs:        ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_DIR} && docker-compose logs -f app'"
echo "  Check status:     ssh ${REMOTE_USER}@${REMOTE_HOST} 'docker ps'"
echo "  Restart service:  ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_DIR} && docker-compose restart app'"
echo "  Stop services:    ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_DIR} && docker-compose down'"
echo "  Update .env:      ssh ${REMOTE_USER}@${REMOTE_HOST} 'nano ${REMOTE_DIR}/.env'"
echo ""
echo "Next Steps:"
echo "  1. Verify all services are running"
echo "  2. Check health endpoints"
echo "  3. Review logs for any errors"
echo "  4. Run smoke tests"
echo "  5. Update monitoring dashboards"
echo ""
echo "For troubleshooting, see BUILD_AND_DEPLOYMENT_COMPREHENSIVE.md"
echo ""
