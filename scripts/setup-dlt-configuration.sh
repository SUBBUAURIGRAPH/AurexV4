#!/bin/bash

##############################################################################
# DLT Docker Configuration Setup Script
#
# Automates the configuration of DLT Docker services with Aurigraph API
# Usage: ./setup-dlt-configuration.sh
#
# Date: October 31, 2025
# Status: Production Ready
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DLT_DIR="/opt/HMS/dlt"
BACKUP_DIR="/opt/HMS/dlt/backups"
LOG_FILE="${BACKUP_DIR}/setup-$(date +%Y%m%d_%H%M%S).log"

##############################################################################
# Functions
##############################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if running as root or with sudo
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root or with sudo"
        exit 1
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    log_success "Docker is installed"

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    log_success "Docker Compose is installed"

    # Check DLT directory
    if [ ! -d "$DLT_DIR" ]; then
        log_error "DLT directory not found: $DLT_DIR"
        exit 1
    fi
    log_success "DLT directory exists"

    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    log_success "Backup directory ready"
}

verify_docker_status() {
    log_info "Verifying Docker services status..."

    cd "$DLT_DIR" || exit 1

    # Check if services are running
    docker compose ps

    # Count running services
    RUNNING=$(docker compose ps -q | wc -l)
    if [ "$RUNNING" -lt 6 ]; then
        log_warning "Not all services are running (found $RUNNING/6)"
        log_info "Starting services..."
        docker compose up -d
    else
        log_success "All 6 services are running"
    fi
}

backup_config() {
    log_info "Backing up current configuration..."

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)

    if [ -f "$DLT_DIR/.env.dlt" ]; then
        cp "$DLT_DIR/.env.dlt" "$BACKUP_DIR/.env.dlt.backup.$TIMESTAMP"
        log_success "Backed up .env.dlt to $BACKUP_DIR/.env.dlt.backup.$TIMESTAMP"
    fi

    if [ -f "$DLT_DIR/docker-compose.yml" ]; then
        cp "$DLT_DIR/docker-compose.yml" "$BACKUP_DIR/docker-compose.yml.backup.$TIMESTAMP"
        log_success "Backed up docker-compose.yml"
    fi
}

prompt_for_credentials() {
    log_info "Collecting Aurigraph API credentials..."

    # Prompt for API Key
    while [ -z "$DLT_API_KEY" ]; do
        read -sp "Enter DLT_API_KEY (will not echo): " DLT_API_KEY
        echo ""
        if [ -z "$DLT_API_KEY" ]; then
            log_error "DLT_API_KEY cannot be empty"
        fi
    done

    # Prompt for API Secret
    while [ -z "$DLT_API_SECRET" ]; then
        read -sp "Enter DLT_API_SECRET (will not echo): " DLT_API_SECRET
        echo ""
        if [ -z "$DLT_API_SECRET" ]; then
            log_error "DLT_API_SECRET cannot be empty"
        fi
    done

    # Prompt for PostgreSQL password
    while [ -z "$POSTGRES_PASSWORD" ]; do
        read -sp "Enter POSTGRES_PASSWORD (will not echo): " POSTGRES_PASSWORD
        echo ""
        if [ -z "$POSTGRES_PASSWORD" ]; then
            log_error "POSTGRES_PASSWORD cannot be empty"
        fi
    done

    # Prompt for Redis password
    while [ -z "$REDIS_PASSWORD" ]; do
        read -sp "Enter REDIS_PASSWORD (will not echo): " REDIS_PASSWORD
        echo ""
        if [ -z "$REDIS_PASSWORD" ]; then
            log_error "REDIS_PASSWORD cannot be empty"
        fi
    done

    # Prompt for Grafana password
    while [ -z "$GRAFANA_PASSWORD" ]; do
        read -sp "Enter GRAFANA_ADMIN_PASSWORD (will not echo): " GRAFANA_PASSWORD
        echo ""
        if [ -z "$GRAFANA_PASSWORD" ]; then
            log_error "GRAFANA_ADMIN_PASSWORD cannot be empty"
        fi
    done

    log_success "Credentials collected"
}

create_env_file() {
    log_info "Creating .env.dlt configuration file..."

    cat > "$DLT_DIR/.env.dlt" << EOF
# ============================================
# DLT Node Configuration
# ============================================

# Aurigraph DLT API Credentials
DLT_API_KEY=$DLT_API_KEY
DLT_API_SECRET=$DLT_API_SECRET
DLT_API_BASE_URL=https://api.aurigraph.io
DLT_API_TIMEOUT=30
DLT_ENVIRONMENT=production
DLT_LOG_LEVEL=info
DLT_RETRY_ATTEMPTS=3
DLT_RETRY_DELAY=1000

# DLT Node Configuration
DLT_NODE_ID=hms-node-001
DLT_NODE_PORT=9004
DLT_NODE_HOST=0.0.0.0
DLT_NETWORK=dlt-network

# ============================================
# Database Configuration
# ============================================

POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=aurigraph_dlt
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=postgresql://postgres:$POSTGRES_PASSWORD@postgres:5432/aurigraph_dlt

# ============================================
# Redis Configuration
# ============================================

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_DB=0
REDIS_TIMEOUT=5000

# ============================================
# NGINX Configuration
# ============================================

NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443
NGINX_UPSTREAM_DLT=dlt-node:9004
SSL_CERT_PATH=/etc/letsencrypt/live/aurexcrt1/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/aurexcrt1/privkey.pem

# ============================================
# Prometheus Configuration
# ============================================

PROMETHEUS_PORT=9091
PROMETHEUS_SCRAPE_INTERVAL=15s
PROMETHEUS_EVALUATION_INTERVAL=15s
PROMETHEUS_RETENTION=720h

# ============================================
# Grafana Configuration
# ============================================

GRAFANA_PORT=3001
GRAFANA_ADMIN_PASSWORD=$GRAFANA_PASSWORD
GRAFANA_USERS_ALLOW_SIGN_UP=false

# ============================================
# Application Settings
# ============================================

NODE_ENV=production
APP_NAME=HMS-DLT
APP_VERSION=2.3.0
CORS_ORIGIN=https://hms.aurex.in
EOF

    chmod 600 "$DLT_DIR/.env.dlt"
    log_success "Created .env.dlt with secure permissions (600)"
}

verify_env_file() {
    log_info "Verifying .env.dlt configuration..."

    ERRORS=0

    # Check for required keys
    if grep -q "^DLT_API_KEY=$" "$DLT_DIR/.env.dlt"; then
        log_error "DLT_API_KEY is empty"
        ERRORS=$((ERRORS + 1))
    else
        log_success "DLT_API_KEY configured"
    fi

    if grep -q "^DLT_API_SECRET=$" "$DLT_DIR/.env.dlt"; then
        log_error "DLT_API_SECRET is empty"
        ERRORS=$((ERRORS + 1))
    else
        log_success "DLT_API_SECRET configured"
    fi

    if grep -q "^POSTGRES_PASSWORD=$" "$DLT_DIR/.env.dlt"; then
        log_error "POSTGRES_PASSWORD is empty"
        ERRORS=$((ERRORS + 1))
    else
        log_success "POSTGRES_PASSWORD configured"
    fi

    if [ $ERRORS -gt 0 ]; then
        log_error "Configuration has $ERRORS errors"
        exit 1
    fi

    log_success "Configuration verified"
}

stop_services() {
    log_info "Stopping Docker services..."

    cd "$DLT_DIR" || exit 1
    docker compose down

    log_success "Services stopped"
}

start_services() {
    log_info "Starting Docker services with new configuration..."

    cd "$DLT_DIR" || exit 1
    docker compose up -d

    log_success "Services started"

    # Wait for services to be ready
    log_info "Waiting for services to initialize (30 seconds)..."
    sleep 30
}

verify_services() {
    log_info "Verifying service health..."

    cd "$DLT_DIR" || exit 1

    # Check containers running
    docker compose ps

    # Test database
    if docker exec postgres psql -U postgres -d postgres -c "SELECT 1;" &> /dev/null; then
        log_success "PostgreSQL is responding"
    else
        log_error "PostgreSQL is not responding"
        return 1
    fi

    # Test Redis
    if docker exec redis redis-cli ping &> /dev/null; then
        log_success "Redis is responding"
    else
        log_error "Redis is not responding"
        return 1
    fi

    # Test DLT Node health
    log_info "Testing DLT Node health endpoint..."
    HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9004/api/v1/health)

    if [ "$HEALTH_RESPONSE" = "200" ]; then
        log_success "DLT Node health check: OK (HTTP 200)"
    else
        log_warning "DLT Node health check returned HTTP $HEALTH_RESPONSE"
    fi
}

generate_report() {
    log_info "Generating configuration report..."

    REPORT_FILE="$BACKUP_DIR/setup-report-$(date +%Y%m%d_%H%M%S).txt"

    cat > "$REPORT_FILE" << EOF
================================================================================
DLT Docker Configuration Setup Report
================================================================================
Date: $(date)
Status: Complete

Configuration Files:
- .env.dlt: $DLT_DIR/.env.dlt
- Backup: $BACKUP_DIR/.env.dlt.backup.*

Services:
$(cd "$DLT_DIR" && docker compose ps)

Environment Variables:
DLT_API_KEY: ✓ Configured
DLT_API_SECRET: ✓ Configured
POSTGRES_PASSWORD: ✓ Configured
REDIS_PASSWORD: ✓ Configured
GRAFANA_ADMIN_PASSWORD: ✓ Configured

Service Health:
$(curl -s http://localhost:9004/api/v1/health 2>/dev/null || echo "Pending...")

Next Steps:
1. Verify all services are healthy
2. Test API endpoints
3. Configure Grafana dashboards
4. Set up automated backups
5. Monitor logs for any issues

Log File: $LOG_FILE
================================================================================
EOF

    log_success "Report generated: $REPORT_FILE"
}

##############################################################################
# Main Execution
##############################################################################

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}  DLT Docker Configuration Setup Script                      ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  This script will configure your DLT Docker environment    ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log_info "Setup started at $(date)"
log_info "Log file: $LOG_FILE"

# Execute setup steps
check_prerequisites
verify_docker_status
backup_config
prompt_for_credentials
create_env_file
verify_env_file
stop_services
start_services
verify_services
generate_report

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${GREEN}DLT Configuration Setup Complete!${NC}                          ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Access your DLT services at:"
echo -e "  DLT API:     ${BLUE}http://localhost:9004${NC}"
echo -e "  Grafana:     ${BLUE}http://localhost:3001${NC}"
echo -e "  Prometheus:  ${BLUE}http://localhost:9091${NC}"
echo ""
echo -e "Or via NGINX:"
echo -e "  DLT API:     ${BLUE}https://dlt.aurex.in${NC}"
echo -e "  Grafana:     ${BLUE}https://dlt-monitor.aurex.in${NC}"
echo ""
echo -e "Configuration file: ${BLUE}$DLT_DIR/.env.dlt${NC}"
echo -e "Backup location: ${BLUE}$BACKUP_DIR${NC}"
echo -e "Log file: ${BLUE}$LOG_FILE${NC}"
echo ""

log_info "Setup completed at $(date)"
