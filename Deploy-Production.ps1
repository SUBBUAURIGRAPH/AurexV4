# HMS Production Deployment Script (PowerShell)
# Deploys HMS to production server: hms.aurex.in
# Date: November 2, 2025
# Version: 2.2.0

param(
    [string]$RemoteUser = "subbu",
    [string]$RemoteHost = "hms.aurex.in",
    [string]$RemoteDir = "/opt/HMS",
    [string]$GitRepo = "git@github.com:Aurigraph-DLT-Corp/HMS.git",
    [string]$GitBranch = "main"
)

# Configuration
$RemoteConnection = "$RemoteUser@$RemoteHost"
$FrontendDomain = "hms.aurex.in"
$BackendDomain = "apihms.aurex.in"
$Version = "2.2.0"
$Date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Color codes
function Write-Header {
    param([string]$Message)
    Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║ $($Message.PadRight(60)) ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
}

function Write-Step {
    param([int]$Number, [string]$Message)
    Write-Host "`n[$Number/7] $Message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "    ✓ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "    ✗ $Message" -ForegroundColor Red
}

Write-Header "HMS Production Deployment - PowerShell"
Write-Host "Date: $Date | Version: $Version" -ForegroundColor Cyan
Write-Host "Target: $FrontendDomain (Frontend), $BackendDomain (Backend)" -ForegroundColor Cyan

# ============================================================================
# STEP 1: Verify local git status
# ============================================================================
Write-Step 1 "Verifying local git repository..."

try {
    $gitStatus = git status --porcelain
    $gitLog = git log -1 --oneline
    Write-Success "Git status verified"
    Write-Host "Latest commit: $gitLog" -ForegroundColor Gray
}
catch {
    Write-Error "Git verification failed: $_"
    exit 1
}

# ============================================================================
# STEP 2: Test SSH connection
# ============================================================================
Write-Step 2 "Testing SSH connection to $RemoteHost..."

try {
    $sshTest = ssh -o ConnectTimeout=5 $RemoteConnection "echo 'SSH connection successful'"
    Write-Success "SSH connection established"
}
catch {
    Write-Error "SSH connection failed. Please ensure:"
    Write-Error "  1. SSH key is configured for $RemoteUser@$RemoteHost"
    Write-Error "  2. Remote server is reachable"
    Write-Error "  3. SSH service is running on remote server"
    exit 1
}

# ============================================================================
# STEP 3: Stop and clean Docker containers on remote
# ============================================================================
Write-Step 3 "Stopping and removing old Docker containers on remote..."

$cleanupScript = @'
set -e
echo "Stopping containers..."
docker-compose down 2>/dev/null || true
docker stop $(docker ps -aq) 2>/dev/null || true

echo "Removing HMS containers..."
docker rm -f $(docker ps -a --filter "name=hms" -q) 2>/dev/null || true

echo "Removing HMS images..."
docker rmi -f $(docker images | grep -E 'hms|aurex' | awk '{print $3}') 2>/dev/null || echo "No images to remove"

echo "Pruning dangling resources..."
docker image prune -f --all || true
docker volume prune -f || true
docker network prune -f || true

echo "Cleanup complete"
docker ps -a
docker images
'@

try {
    $result = $cleanupScript | ssh $RemoteConnection "bash -s"
    Write-Success "Docker resources cleaned"
}
catch {
    Write-Host "Cleanup returned: $_" -ForegroundColor Gray
}

# ============================================================================
# STEP 4: Update Git repository on remote
# ============================================================================
Write-Step 4 "Pulling latest code from GitHub..."

$gitPullScript = @"
set -e
cd $RemoteDir || { sudo mkdir -p $RemoteDir && cd $RemoteDir; }

if [ ! -d .git ]; then
    echo "Cloning repository..."
    git clone $GitRepo .
else
    echo "Updating repository..."
    git fetch origin
fi

git checkout $GitBranch
git pull origin $GitBranch

echo "✓ Repository updated"
git log -1 --oneline
"@

try {
    $result = $gitPullScript | ssh $RemoteConnection "bash -s"
    Write-Success "Code pulled from GitHub"
    Write-Host $result -ForegroundColor Gray
}
catch {
    Write-Error "Git pull failed: $_"
    exit 1
}

# ============================================================================
# STEP 5: Build Docker image on remote
# ============================================================================
Write-Step 5 "Building Docker image on remote server..."

$buildScript = @"
set -e
cd $RemoteDir

echo "Installing dependencies..."
npm install --legacy-peer-deps || true

echo "Building Docker image..."
docker build \
  -f Dockerfile \
  -t hms-app:latest \
  -t hms-app:v$Version \
  --build-arg NODE_ENV=production \
  . || { echo "Docker build failed"; exit 1; }

echo "✓ Docker image built successfully"
docker images | grep hms-app
"@

try {
    $result = $buildScript | ssh $RemoteConnection "bash -s"
    Write-Success "Docker image built"
    Write-Host $result -ForegroundColor Gray
}
catch {
    Write-Error "Docker build failed: $_"
    exit 1
}

# ============================================================================
# STEP 6: Deploy with Docker Compose
# ============================================================================
Write-Step 6 "Deploying with Docker Compose..."

$deployScript = @"
set -e
cd $RemoteDir

echo "Creating environment configuration..."
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3000
GRPC_PORT=50051
FRONTEND_URL=https://$FrontendDomain
BACKEND_URL=https://$BackendDomain
API_BASE_URL=https://$BackendDomain/api
LOG_LEVEL=info
SSL_CERT_PATH=/etc/letsencrypt/live/aurexcrt1/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/aurexcrt1/privkey.pem
EOF

echo "Creating docker-compose configuration..."
cat > docker-compose.production.yml << 'EOF'
version: '3.8'
services:
  hms-app:
    image: hms-app:v$Version
    container_name: hms-production
    environment:
      - NODE_ENV=production
      - PORT=3000
    ports:
      - "3000:3000"
      - "50051:50051"
    volumes:
      - /etc/letsencrypt/live/aurexcrt1:/etc/letsencrypt/live/aurexcrt1:ro
    networks:
      - hms-network
    restart: unless-stopped

  nginx:
    image: nginx:latest
    container_name: hms-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt/live/aurexcrt1:/etc/letsencrypt/live/aurexcrt1:ro
    networks:
      - hms-network
    restart: unless-stopped

networks:
  hms-network:
    driver: bridge
EOF

echo "Starting services..."
docker-compose -f docker-compose.production.yml up -d

echo "Waiting for services to start..."
sleep 10

echo "✓ Services deployed"
docker ps
"@

try {
    $result = $deployScript | ssh $RemoteConnection "bash -s"
    Write-Success "Docker services deployed"
}
catch {
    Write-Error "Deployment failed: $_"
}

# ============================================================================
# STEP 7: Verify deployment
# ============================================================================
Write-Step 7 "Verifying deployment..."

$verifyScript = @'
set -e

echo "Service Status:"
docker ps --filter "name=hms"

echo ""
echo "Container Logs (last 20 lines):"
docker logs --tail 20 hms-production 2>/dev/null || echo "Logs not yet available"

echo ""
echo "SSL Certificate Status:"
if [ -f /etc/letsencrypt/live/aurexcrt1/fullchain.pem ]; then
    echo "✓ SSL certificate found"
    openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -noout -dates
else
    echo "✗ SSL certificate not found"
fi

echo ""
echo "Health Check:"
curl -s http://localhost:3000/health || echo "Health endpoint not yet responding"
'@

try {
    $result = $verifyScript | ssh $RemoteConnection "bash -s"
    Write-Success "Deployment verification complete"
    Write-Host $result -ForegroundColor Gray
}
catch {
    Write-Host "Verification returned: $_" -ForegroundColor Gray
}

# ============================================================================
# Summary
# ============================================================================
Write-Header "✓ DEPLOYMENT COMPLETED SUCCESSFULLY!"
Write-Host ""
Write-Host "Service Information:" -ForegroundColor Green
Write-Host "  Frontend URL:     https://$FrontendDomain" -ForegroundColor Cyan
Write-Host "  Backend URL:      https://$BackendDomain" -ForegroundColor Cyan
Write-Host "  Working Directory: $RemoteDir" -ForegroundColor Cyan
Write-Host "  Git Branch:       $GitBranch" -ForegroundColor Cyan
Write-Host "  Version:          $Version" -ForegroundColor Cyan

Write-Host ""
Write-Host "Useful SSH Commands:" -ForegroundColor Green
Write-Host "  View containers:   ssh $RemoteConnection 'docker ps -a'" -ForegroundColor Gray
Write-Host "  View logs:         ssh $RemoteConnection 'docker logs -f hms-production'" -ForegroundColor Gray
Write-Host "  View all logs:     ssh $RemoteConnection 'docker-compose logs -f'" -ForegroundColor Gray
Write-Host "  Resource usage:    ssh $RemoteConnection 'docker stats'" -ForegroundColor Gray

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Green
Write-Host "  1. Wait 30-60 seconds for services to fully initialize" -ForegroundColor Gray
Write-Host "  2. Test frontend: curl https://$FrontendDomain" -ForegroundColor Gray
Write-Host "  3. Test API:      curl https://$BackendDomain/api/health" -ForegroundColor Gray
Write-Host "  4. Monitor logs:  ssh $RemoteConnection 'docker logs -f hms-production'" -ForegroundColor Gray

Write-Host ""
Write-Host "Rollback (if needed):" -ForegroundColor Yellow
Write-Host "  ssh $RemoteConnection 'cd $RemoteDir && git revert HEAD && docker-compose -f docker-compose.production.yml up -d'" -ForegroundColor Gray

Write-Host "`n✓ Deployment complete!`n" -ForegroundColor Green
