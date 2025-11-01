#!/bin/bash

###############################################################################
# HMS Remote Server Deployment Script
# Deploys HMS Docker stack to a remote server via SSH
#
# Usage: ./deploy-to-remote.sh <remote_host> <remote_user> [deploy_type]
# Example: ./deploy-to-remote.sh 192.168.1.100 ubuntu docker-compose
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REMOTE_HOST="${1:-}"
REMOTE_USER="${2:-ubuntu}"
DEPLOY_TYPE="${3:-docker-compose}"  # docker-compose, docker-swarm, or kubernetes
REMOTE_PORT="${4:-22}"

# Deployment settings
REMOTE_DIR="/opt/hms"
REMOTE_USER_HOME="/home/${REMOTE_USER}"
DOCKER_REGISTRY="docker.io"
DOCKER_IMAGE="aurigraph/hms-j4c-agent:1.0.0"

###############################################################################
# Functions
###############################################################################

print_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️ $1${NC}"
}

# Validate inputs
validate_inputs() {
    if [ -z "$REMOTE_HOST" ]; then
        print_error "Remote host not provided"
        echo "Usage: ./deploy-to-remote.sh <remote_host> <remote_user> [deploy_type]"
        exit 1
    fi

    if [ "$DEPLOY_TYPE" != "docker-compose" ] && \
       [ "$DEPLOY_TYPE" != "docker-swarm" ] && \
       [ "$DEPLOY_TYPE" != "kubernetes" ]; then
        print_error "Invalid deploy type: $DEPLOY_TYPE"
        echo "Valid options: docker-compose, docker-swarm, kubernetes"
        exit 1
    fi
}

# Check SSH connectivity
check_ssh_connectivity() {
    print_header "Checking SSH Connectivity to $REMOTE_HOST"

    if ssh -o ConnectTimeout=5 -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" "echo 'SSH connection successful'" &>/dev/null; then
        print_success "SSH connection established"
    else
        print_error "Cannot connect to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}"
        echo "Please verify:"
        echo "  1. Host is reachable: ping $REMOTE_HOST"
        echo "  2. SSH key is configured: ssh-add ~/.ssh/id_rsa"
        echo "  3. User has SSH access: check ~/.ssh/authorized_keys"
        exit 1
    fi
}

# Install Docker and Docker Compose on remote server
install_docker_remote() {
    print_header "Installing Docker & Docker Compose on Remote Server"

    ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << 'EOSSH'
        set -e
        echo "Checking Docker installation..."

        if ! command -v docker &> /dev/null; then
            echo "Installing Docker..."
            curl -fsSL https://get.docker.com -o get-docker.sh
            sudo sh get-docker.sh
            rm get-docker.sh

            echo "Adding user to docker group..."
            sudo usermod -aG docker $USER
            newgrp docker <<EOF
exit
EOF
            print_success "Docker installed successfully"
        else
            echo "Docker is already installed: $(docker --version)"
        fi

        if ! command -v docker-compose &> /dev/null; then
            echo "Installing Docker Compose..."
            sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose
            print_success "Docker Compose installed successfully"
        else
            echo "Docker Compose is already installed: $(docker-compose --version)"
        fi

        echo "Docker daemon status:"
        systemctl status docker --no-pager | grep Active
EOSSH

    print_success "Docker installation verified"
}

# Create deployment directory
create_deployment_dir() {
    print_header "Creating Deployment Directory on Remote Server"

    ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << EOSSH
        set -e
        if [ ! -d "$REMOTE_DIR" ]; then
            echo "Creating $REMOTE_DIR..."
            sudo mkdir -p $REMOTE_DIR
            sudo chown ${REMOTE_USER}:${REMOTE_USER} $REMOTE_DIR
        fi

        echo "Directory permissions:"
        ls -ld $REMOTE_DIR
EOSSH

    print_success "Deployment directory ready at $REMOTE_DIR"
}

# Copy docker-compose configuration
copy_docker_compose_config() {
    print_header "Copying Docker Compose Configuration"

    print_info "Uploading docker-compose.hms.yml..."
    scp -P $REMOTE_PORT ./docker-compose.hms.yml "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

    print_info "Uploading .env.example..."
    scp -P $REMOTE_PORT ./.env.example "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/.env"

    print_info "Uploading nginx configuration..."
    scp -P $REMOTE_PORT ./nginx-dlt.conf "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

    print_info "Uploading prometheus configuration..."
    scp -P $REMOTE_PORT ./prometheus-dlt.yml "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

    print_info "Creating grafana-dashboards directory..."
    ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p $REMOTE_DIR/grafana-dashboards"

    print_info "Uploading grafana dashboards..."
    scp -r -P $REMOTE_PORT ./grafana-dashboards/* "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/grafana-dashboards/" 2>/dev/null || true

    print_success "Configuration files uploaded"
}

# Deploy with Docker Compose
deploy_docker_compose() {
    print_header "Deploying HMS with Docker Compose"

    ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << EOSSH
        cd $REMOTE_DIR

        echo "Pulling latest Docker image..."
        docker pull $DOCKER_IMAGE

        echo "Starting services with docker-compose..."
        docker-compose -f docker-compose.hms.yml down 2>/dev/null || true
        docker-compose -f docker-compose.hms.yml up -d

        echo "Waiting for services to start..."
        sleep 10

        echo "Service status:"
        docker-compose -f docker-compose.hms.yml ps

        echo "Checking health endpoints..."
        docker-compose -f docker-compose.hms.yml ps -q hms-j4c-agent | xargs -I {} docker exec {} curl -s http://localhost:9003/health || echo "Agent not ready yet"
EOSSH

    print_success "Docker Compose deployment complete"
}

# Deploy with Docker Swarm
deploy_docker_swarm() {
    print_header "Deploying HMS with Docker Swarm"

    ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << EOSSH
        # Initialize swarm if not already initialized
        if ! docker info | grep -q "Swarm: active"; then
            echo "Initializing Docker Swarm..."
            docker swarm init --advertise-addr $(hostname -I | awk '{print $1}')
        fi

        cd $REMOTE_DIR

        echo "Pulling latest Docker image..."
        docker pull $DOCKER_IMAGE

        echo "Deploying stack..."
        docker stack deploy -c docker-compose.hms.yml hms

        echo "Waiting for services to start..."
        sleep 10

        echo "Stack status:"
        docker stack ps hms

        echo "Service status:"
        docker service ls
EOSSH

    print_success "Docker Swarm deployment complete"
}

# Generate deployment report
generate_report() {
    print_header "Deployment Report"

    cat > deployment-report.txt << EOF
================================================================================
                     HMS Remote Deployment Report
================================================================================

Deployment Date: $(date)
Remote Host: ${REMOTE_HOST}
Remote User: ${REMOTE_USER}
Deployment Type: ${DEPLOY_TYPE}
Deployment Directory: ${REMOTE_DIR}

================================================================================
                           Deployed Services
================================================================================

1. HMS J4C Agent
   - Port: 9003
   - Health Check: http://${REMOTE_HOST}:9003/health
   - Logs: docker-compose logs -f hms-j4c-agent

2. NGINX Reverse Proxy
   - HTTP Port: 80
   - HTTPS Port: 443
   - Health Check: http://${REMOTE_HOST}/health

3. PostgreSQL Database
   - Port: 5432
   - User: hms_user
   - Database: hms_db

4. Prometheus Metrics
   - Port: 9090
   - URL: http://${REMOTE_HOST}:9090
   - Config: ${REMOTE_DIR}/prometheus-dlt.yml

5. Grafana Dashboards
   - Port: 3000
   - URL: http://${REMOTE_HOST}:3000
   - Default Login: admin/admin (CHANGE PASSWORD!)

================================================================================
                         Next Steps
================================================================================

1. SSH into remote server:
   ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST}

2. Navigate to deployment directory:
   cd ${REMOTE_DIR}

3. Check service status:
   docker-compose ps  # for Docker Compose
   docker stack ps hms  # for Docker Swarm

4. View logs:
   docker-compose logs -f hms-j4c-agent

5. Configure environment variables:
   Edit ${REMOTE_DIR}/.env with your credentials:
   - JIRA_API_KEY
   - GITHUB_TOKEN
   - HUBSPOT_API_KEY
   - SLACK_WEBHOOK_URL
   - DB_PASSWORD
   - GRAFANA_PASSWORD

6. Restart services after configuration:
   docker-compose restart
   # or
   docker service update --force hms_hms-j4c-agent

7. Access Grafana and configure:
   - Open http://${REMOTE_HOST}:3000
   - Login with admin/admin
   - Add Prometheus data source: http://prometheus:9090
   - Import dashboards from ${REMOTE_DIR}/grafana-dashboards

================================================================================
                     Monitoring & Health Checks
================================================================================

Monitor service logs:
  ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_DIR} && docker-compose logs -f'

Check service health:
  curl http://${REMOTE_HOST}:9003/health
  curl http://${REMOTE_HOST}:9090/-/healthy

View Prometheus metrics:
  curl http://${REMOTE_HOST}:9090/api/v1/query?query=up

================================================================================
                     Backup & Disaster Recovery
================================================================================

Backup database:
  docker exec \$(docker-compose ps -q postgres) pg_dump -U hms_user hms_db > hms_backup.sql

Backup volumes:
  docker run --rm -v hms-postgres-data:/data -v \$(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .

Stop services:
  docker-compose down

Start services:
  docker-compose up -d

================================================================================

Report Generated: $(date)
For more information, see: HMS_DOCKER_DEPLOYMENT_SUMMARY.md

================================================================================
EOF

    cat deployment-report.txt
}

###############################################################################
# Main Execution
###############################################################################

main() {
    print_header "HMS Remote Server Deployment"
    print_info "Deploying to ${REMOTE_USER}@${REMOTE_HOST} using ${DEPLOY_TYPE}"

    validate_inputs
    check_ssh_connectivity
    install_docker_remote
    create_deployment_dir
    copy_docker_compose_config

    case "$DEPLOY_TYPE" in
        docker-compose)
            deploy_docker_compose
            ;;
        docker-swarm)
            deploy_docker_swarm
            ;;
        kubernetes)
            print_error "Kubernetes deployment not yet configured. Use ./deploy-to-k8s.sh instead"
            exit 1
            ;;
    esac

    generate_report

    print_header "Deployment Summary"
    print_success "HMS successfully deployed to ${REMOTE_HOST}"
    echo ""
    echo "Access your services:"
    echo "  - HMS Agent: http://${REMOTE_HOST}:9003"
    echo "  - Grafana: http://${REMOTE_HOST}:3000"
    echo "  - Prometheus: http://${REMOTE_HOST}:9090"
    echo ""
    echo "SSH into remote server:"
    echo "  ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST}"
    echo ""
    print_info "Full deployment report saved to: deployment-report.txt"
}

main "$@"
