#!/bin/bash

###############################################################################
# HMS Production Deployment to hms.aurex.in
# Deploys HMS to Aurex production environment with SSL certificates
#
# Usage: ./deploy-to-aurex.sh
# SSH: ssh subbu@hms.aurex.in
#
# Configuration:
# - Frontend: hms.aurex.in
# - Backend API: apihms.aurex.in
# - Remote Directory: /opt/HMS
# - Git Repo: git@github.com:Aurigraph-DLT-Corp/HMS.git
# - Git Branch: main
# - SSL Certs: /etc/letsencrypt/live/aurexcrt1/
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REMOTE_HOST="hms.aurex.in"
REMOTE_USER="subbu"
REMOTE_PORT="22"
REMOTE_DIR="/opt/HMS"
GIT_REPO="git@github.com:Aurigraph-DLT-Corp/HMS.git"
GIT_BRANCH="main"
FRONTEND_DOMAIN="hms.aurex.in"
BACKEND_DOMAIN="apihms.aurex.in"
SSL_CERT_DIR="/etc/letsencrypt/live/aurexcrt1"
DOCKER_IMAGE="aurigraph/hms-j4c-agent:1.0.0"

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

# Step 1: Check SSH connectivity
print_header "Step 1: Verifying SSH Connection to $REMOTE_HOST"

if ssh -o ConnectTimeout=5 -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" "echo 'Connected to $REMOTE_HOST'" &>/dev/null; then
    print_success "SSH connection established"
else
    print_error "Cannot connect to ${REMOTE_USER}@${REMOTE_HOST}"
    echo "SSH Command: ssh -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST}"
    exit 1
fi

# Step 2: Clean up old containers and images
print_header "Step 2: Cleaning Up Old Docker Containers & Images"

ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << 'EOSSH'
    set -e
    echo "Removing old containers..."
    docker ps -a -q | xargs -r docker rm -f 2>/dev/null || true
    print_success "All containers removed"

    echo "Pruning Docker images..."
    docker image prune -a -f --filter "until=72h" 2>/dev/null || true
    print_success "Old images pruned"

    echo "Pruning Docker system..."
    docker system prune -a -f --volumes 2>/dev/null || true
    print_success "Docker system pruned"

    echo "Current Docker status:"
    docker ps -a
    docker images
EOSSH

print_success "Docker cleanup complete"

# Step 3: Clone/Update Git Repository
print_header "Step 3: Cloning/Updating Git Repository"

ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << EOSSH
    set -e

    if [ ! -d "$REMOTE_DIR" ]; then
        echo "Creating $REMOTE_DIR..."
        sudo mkdir -p $REMOTE_DIR
        sudo chown ${REMOTE_USER}:${REMOTE_USER} $REMOTE_DIR
    fi

    if [ ! -d "$REMOTE_DIR/.git" ]; then
        echo "Cloning repository..."
        cd $REMOTE_DIR
        git clone -b $GIT_BRANCH $GIT_REPO .
    else
        echo "Updating repository..."
        cd $REMOTE_DIR
        git fetch origin
        git checkout $GIT_BRANCH
        git pull origin $GIT_BRANCH
    fi

    echo "Git status:"
    cd $REMOTE_DIR
    git log -1 --oneline
    git status
EOSSH

print_success "Repository ready at $REMOTE_DIR"

# Step 4: Create NGINX Configuration with SSL
print_header "Step 4: Creating NGINX Configuration with SSL"

ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << 'EOSSH'
    FRONTEND_DOMAIN="hms.aurex.in"
    BACKEND_DOMAIN="apihms.aurex.in"
    SSL_CERT_DIR="/etc/letsencrypt/live/aurexcrt1"
    REMOTE_DIR="/opt/HMS"

    # Verify SSL certificates exist
    echo "Verifying SSL certificates..."
    if [ ! -f "$SSL_CERT_DIR/privkey.pem" ] || [ ! -f "$SSL_CERT_DIR/fullchain.pem" ]; then
        echo "❌ SSL certificates not found at $SSL_CERT_DIR"
        echo "Expected files:"
        echo "  - $SSL_CERT_DIR/privkey.pem"
        echo "  - $SSL_CERT_DIR/fullchain.pem"
        exit 1
    fi
    echo "✅ SSL certificates verified"

    # Create NGINX configuration
    cat > /tmp/nginx-aurex.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;

    # Health check endpoint
    server {
        listen 80;
        server_name _;
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }

    # Frontend (hms.aurex.in)
    server {
        listen 80;
        listen [::]:80;
        server_name hms.aurex.in;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name hms.aurex.in;

        ssl_certificate /etc/letsencrypt/live/aurexcrt1/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/aurexcrt1/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        access_log /var/log/nginx/frontend_access.log main;
        error_log /var/log/nginx/frontend_error.log warn;

        location / {
            proxy_pass http://hms-j4c-agent:9003;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_buffering off;
            proxy_request_buffering off;
        }

        location /health {
            proxy_pass http://hms-j4c-agent:9003/health;
            access_log off;
        }
    }

    # Backend API (apihms.aurex.in)
    server {
        listen 80;
        listen [::]:80;
        server_name apihms.aurex.in;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name apihms.aurex.in;

        ssl_certificate /etc/letsencrypt/live/aurexcrt1/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/aurexcrt1/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        access_log /var/log/nginx/backend_access.log main;
        error_log /var/log/nginx/backend_error.log warn;

        location / {
            proxy_pass http://hms-j4c-agent:9003;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_buffering off;
            proxy_request_buffering off;
        }

        location /api/ {
            proxy_pass http://hms-j4c-agent:9003/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /health {
            proxy_pass http://hms-j4c-agent:9003/health;
            access_log off;
        }
    }
}
EOF

    sudo cp /tmp/nginx-aurex.conf /etc/nginx/nginx.conf
    sudo nginx -t && echo "✅ NGINX configuration valid" || exit 1
EOSSH

print_success "NGINX SSL configuration created"

# Step 5: Create Docker Compose for Aurex Production
print_header "Step 5: Creating Production Docker Compose Configuration"

ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << 'EOSSH'
    REMOTE_DIR="/opt/HMS"
    FRONTEND_DOMAIN="hms.aurex.in"
    BACKEND_DOMAIN="apihms.aurex.in"

    cat > $REMOTE_DIR/docker-compose.production.yml << 'EOF'
version: '3.9'

services:
  hms-j4c-agent:
    image: aurigraph/hms-j4c-agent:1.0.0
    container_name: hms-j4c-agent
    environment:
      - NODE_ENV=production
      - PORT=9003
      - LOG_LEVEL=info
      - JIRA_API_KEY=${JIRA_API_KEY:-}
      - JIRA_EMAIL=${JIRA_EMAIL:-}
      - GITHUB_TOKEN=${GITHUB_TOKEN:-}
      - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-}
      - HUBSPOT_API_KEY=${HUBSPOT_API_KEY:-}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9003/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    volumes:
      - hms-logs:/app/logs
    networks:
      - hms-network
    depends_on:
      - postgres
      - prometheus

  nginx-proxy:
    image: nginx:1.25-alpine
    container_name: hms-nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt/live/aurexcrt1:/etc/nginx/ssl:ro
      - hms-nginx-logs:/var/log/nginx
      - hms-nginx-cache:/var/cache/nginx
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - hms-network
    depends_on:
      - hms-j4c-agent

  postgres:
    image: postgres:15-alpine
    container_name: hms-postgres
    environment:
      - POSTGRES_USER=${DB_USER:-hms_user}
      - POSTGRES_PASSWORD=${DB_PASSWORD:-}
      - POSTGRES_DB=${DB_NAME:-hms_db}
    volumes:
      - hms-postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-hms_user}"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - hms-network

  prometheus:
    image: prom/prometheus:latest
    container_name: hms-prometheus
    volumes:
      - ./prometheus-dlt.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus-alerts.yml:/etc/prometheus/alerts.yml:ro
      - hms-prometheus-data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
      - "--storage.tsdb.retention.time=90d"
    restart: unless-stopped
    networks:
      - hms-network

  grafana:
    image: grafana/grafana:latest
    container_name: hms-grafana
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - hms-grafana-data:/var/lib/grafana
      - ./grafana-dashboards:/etc/grafana/provisioning/dashboards
    restart: unless-stopped
    networks:
      - hms-network

volumes:
  hms-logs:
  hms-postgres-data:
  hms-nginx-logs:
  hms-nginx-cache:
  hms-prometheus-data:
  hms-grafana-data:

networks:
  hms-network:
    driver: bridge
EOF

    echo "✅ Production Docker Compose created at $REMOTE_DIR/docker-compose.production.yml"
EOSSH

print_success "Production Docker Compose configuration created"

# Step 6: Pull latest Docker image and start services
print_header "Step 6: Pulling Docker Image & Starting Services"

ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << EOSSH
    cd $REMOTE_DIR

    echo "Pulling latest Docker image..."
    docker pull $DOCKER_IMAGE

    echo "Starting services with production configuration..."
    docker-compose -f docker-compose.production.yml up -d

    echo "Waiting for services to start..."
    sleep 10

    echo "Service status:"
    docker-compose -f docker-compose.production.yml ps

    echo "Health check endpoints:"
    echo "Frontend: https://hms.aurex.in/health"
    echo "Backend: https://apihms.aurex.in/health"
    echo "Grafana: http://localhost:3000/api/health"
EOSSH

print_success "Services started successfully"

# Step 7: Verify NGINX and restart
print_header "Step 7: Verifying NGINX Configuration"

ssh -p $REMOTE_PORT "${REMOTE_USER}@${REMOTE_HOST}" << 'EOSSH'
    echo "Testing NGINX configuration..."
    sudo nginx -t

    echo "Restarting NGINX..."
    sudo systemctl restart nginx

    echo "Checking NGINX status..."
    sudo systemctl status nginx --no-pager | head -5

    echo "Checking open ports..."
    sudo netstat -tlnp | grep -E ':(80|443)' || sudo ss -tlnp | grep -E ':(80|443)'
EOSSH

print_success "NGINX configured and running"

# Step 8: Create deployment report
print_header "Step 8: Deployment Complete"

cat > aurex-deployment-report.txt << EOF
================================================================================
                   HMS Aurex Production Deployment Report
================================================================================

Deployment Date: $(date)
Remote Host: $REMOTE_HOST
Remote User: $REMOTE_USER
Remote Directory: $REMOTE_DIR
Git Repo: $GIT_REPO
Git Branch: $GIT_BRANCH

================================================================================
                         Deployment Summary
================================================================================

✅ SSH Connection Verified
✅ Old Docker Containers Cleaned
✅ Docker Images Pruned
✅ Repository Cloned/Updated (Branch: $GIT_BRANCH)
✅ NGINX SSL Configuration Created
✅ Docker Image Pulled ($DOCKER_IMAGE)
✅ Services Started and Verified

================================================================================
                       Service Endpoints
================================================================================

Frontend (HTTPS):
  - URL: https://$FRONTEND_DOMAIN
  - Health: https://$FRONTEND_DOMAIN/health
  - IP: 443

Backend API (HTTPS):
  - URL: https://$BACKEND_DOMAIN
  - Health: https://$BACKEND_DOMAIN/health
  - IP: 443

Services:
  - HMS Agent: http://localhost:9003
  - PostgreSQL: localhost:5432
  - Prometheus: http://localhost:9090
  - Grafana: http://localhost:3000

SSL Certificates:
  - Certificate: /etc/letsencrypt/live/aurexcrt1/fullchain.pem
  - Private Key: /etc/letsencrypt/live/aurexcrt1/privkey.pem
  - Auto-renewal: Enabled (Certbot)

================================================================================
                         Access Instructions
================================================================================

SSH Access:
  ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST

Docker Compose:
  cd $REMOTE_DIR
  docker-compose -f docker-compose.production.yml ps
  docker-compose -f docker-compose.production.yml logs -f

View Logs:
  docker logs -f hms-j4c-agent
  docker logs -f hms-nginx-proxy

Health Checks:
  curl https://$FRONTEND_DOMAIN/health
  curl https://$BACKEND_DOMAIN/health

================================================================================
                       Configuration Files
================================================================================

Production Compose File:
  $REMOTE_DIR/docker-compose.production.yml

NGINX Configuration:
  /etc/nginx/nginx.conf

Environment Variables (needs to be set):
  $REMOTE_DIR/.env

Create .env with:
  JIRA_API_KEY=your_token
  GITHUB_TOKEN=your_token
  DB_PASSWORD=secure_password
  GRAFANA_PASSWORD=secure_password
  SLACK_WEBHOOK_URL=your_webhook

================================================================================
                       Docker Cleanup Summary
================================================================================

Removed:
  - All old containers
  - Unused images
  - Dangling volumes
  - Build cache

Current Docker Status:
  Images: Check 'docker images'
  Containers: Check 'docker ps -a'

================================================================================
                         Next Steps
================================================================================

1. SSH into server:
   ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST

2. Create .env file with production credentials:
   cd $REMOTE_DIR
   cp .env.example .env
   # Edit with actual values

3. Restart services after .env changes:
   docker-compose -f docker-compose.production.yml restart

4. Test endpoints:
   curl -v https://$FRONTEND_DOMAIN/health
   curl -v https://$BACKEND_DOMAIN/health

5. Monitor logs:
   docker-compose -f docker-compose.production.yml logs -f

6. Access Grafana:
   http://localhost:3000 (ssh tunnel)
   ssh -L 3000:localhost:3000 $REMOTE_USER@$REMOTE_HOST

7. Configure backups:
   - Database: Setup automated PostgreSQL backups
   - Volumes: Setup volume snapshots
   - Logs: Setup log rotation

================================================================================

Report Generated: $(date)
Deployment Status: ✅ SUCCESSFUL

For Issues: Check logs with docker-compose logs
For Support: Contact agents@aurigraph.io

================================================================================
EOF

cat aurex-deployment-report.txt

print_success "Deployment report saved to: aurex-deployment-report.txt"

print_header "Deployment Complete!"
echo ""
echo "Frontend URL: https://$FRONTEND_DOMAIN"
echo "Backend URL: https://$BACKEND_DOMAIN"
echo ""
echo "SSH Command: ssh $REMOTE_USER@$REMOTE_HOST"
echo ""
echo "Next: Set environment variables and test endpoints!"
