# HERMES Remote Server Deployment Guide
## Complete Build, Deploy & Verification

**Version**: 1.0.0
**Date**: November 1, 2025
**Platform**: HERMES HF Algo Trading Platform
**Status**: Ready for deployment to production/staging server

---

## 📋 OVERVIEW

This guide provides step-by-step instructions to deploy the HERMES platform to a remote server with:
- Complete automated setup (Node.js, Docker, NGINX, PostgreSQL)
- Full TypeScript build process
- Docker containerization
- NGINX reverse proxy with HTTPS
- Health checks and monitoring
- Security headers and rate limiting

---

## 🎯 PREREQUISITES

### Remote Server Requirements
- **OS**: Ubuntu 20.04+, Debian 10+, CentOS 7+, or RHEL 8+
- **RAM**: Minimum 4GB (8GB+ recommended)
- **Disk**: Minimum 20GB (50GB+ recommended)
- **CPU**: 2 cores minimum (4+ cores recommended)
- **Network**: Outbound HTTPS access for GitHub and Docker Hub

### Local Machine (for executing deployment)
- SSH access to remote server (with root or sudo privileges)
- `git` installed (for repository cloning)
- Bash shell (works on Linux, macOS, WSL, Git Bash)

### Domain & DNS (for HTTPS)
- Domain name pointing to remote server (required for SSL certificates)
- DNS records configured (A record with server IP)
- Ability to obtain SSL certificate (Let's Encrypt or corporate CA)

---

## 🚀 DEPLOYMENT METHODS

### Method 1: Automated Deployment Script (Recommended)

#### Step 1: Prepare Remote Server
```bash
# SSH into remote server
ssh root@your-server-ip
# or
ssh user@your-server-ip
sudo su -  # If not root

# Ensure curl is available
apt-get update && apt-get install -y curl  # Ubuntu/Debian
# or
yum install -y curl  # CentOS/RHEL
```

#### Step 2: Run Deployment Script
**Option A: Direct from GitHub**
```bash
curl -fsSL https://raw.githubusercontent.com/Aurigraph-DLT-Corp/glowing-adventure/main/deploy-hermes-remote.sh | bash
```

**Option B: Download first, then execute**
```bash
# Download script
wget https://raw.githubusercontent.com/Aurigraph-DLT-Corp/glowing-adventure/main/deploy-hermes-remote.sh
chmod +x deploy-hermes-remote.sh

# Execute
./deploy-hermes-remote.sh
```

**Option C: From local machine via SSH**
```bash
# From your local machine
scp deploy-hermes-remote.sh root@your-server-ip:/tmp/
ssh root@your-server-ip "bash /tmp/deploy-hermes-remote.sh"
```

#### Step 3: Monitor Deployment
The script will display:
- Progress for each phase (8 total phases)
- Color-coded output (green ✓ for success, red ✗ for errors)
- Timestamps for each operation
- Final deployment summary

**Expected Duration**: 15-30 minutes (depending on server speed and internet connection)

---

### Method 2: Manual Step-by-Step Deployment

If you prefer manual control or need to troubleshoot, follow these steps:

#### Phase 1: System Preparation
```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install required tools
sudo apt-get install -y curl wget git build-essential
```

#### Phase 2: Install Node.js
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be v18.x or higher
npm --version   # Should be 9.x or higher
```

#### Phase 3: Install Docker
```bash
# Ubuntu/Debian
sudo apt-get install -y docker.io

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Verify installation
docker --version

# Optional: Allow non-root user to run Docker
sudo usermod -aG docker $USER
newgrp docker
```

#### Phase 4: Install Docker Compose
```bash
# Download latest version
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

#### Phase 5: Clone Repository
```bash
# Create deployment directory
sudo mkdir -p /opt/hermes
cd /opt/hermes

# Clone repository
sudo git clone https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git .

# Verify clone
ls -la  # Should show backend/, k8s/, docker/, docs/, etc.
```

#### Phase 6: Build HERMES Platform
```bash
# Install root dependencies
npm clean-install

# Install backend dependencies
cd backend
npm clean-install

# Compile TypeScript
npx tsc

# Verify compilation
ls -la dist/  # Should show compiled .js and .d.ts files

# Return to root directory
cd ..
```

#### Phase 7: Build Docker Image
```bash
# Build Docker image
docker build -f Dockerfile.hermes -t hermes:v1.0.0 .

# Verify image
docker images | grep hermes

# Expected output:
# REPOSITORY   TAG       IMAGE ID       CREATED       SIZE
# hermes       v1.0.0    abc123def456   1 second ago   ~200MB
```

#### Phase 8: Deploy Container
```bash
# Run container
docker run -d \
    --name hermes-app \
    --restart always \
    -p 3000:3000 \
    -e NODE_ENV=production \
    --health-cmd='curl -f http://localhost:3000/api/health || exit 1' \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=3 \
    hermes:v1.0.0

# Monitor startup
docker logs -f hermes-app

# Check status (Ctrl+C to exit logs)
docker ps | grep hermes

# Expected output:
# Container should show as "healthy" after 30-40 seconds
```

#### Phase 9: Configure NGINX
```bash
# Install NGINX
sudo apt-get install -y nginx

# Create NGINX configuration (see Configuration section below)
# Then test:
sudo nginx -t

# If valid, reload:
sudo systemctl reload nginx

# Enable NGINX
sudo systemctl enable nginx
```

#### Phase 10: Configure HTTPS
```bash
# Install Certbot (for Let's Encrypt)
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate (replace example.com with your domain)
sudo certbot certonly --standalone -d example.com

# Auto-renew
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Update NGINX config with certificate paths (see below)
```

---

## ⚙️ CONFIGURATION SECTIONS

### NGINX Configuration

Update `/etc/nginx/sites-available/hermes` with:

```nginx
upstream hermes_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name example.com www.example.com;

    # SSL Certificate (update with actual paths)
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;

    # API Endpoints
    location /api {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://hermes_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # General Endpoints
    location / {
        limit_req zone=general burst=10 nodelay;
        proxy_pass http://hermes_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health Check (no logging)
    location /health {
        access_log off;
        proxy_pass http://hermes_backend;
    }
}
```

### Enable and Test NGINX
```bash
# Enable site
sudo ln -sf /etc/nginx/sites-available/hermes /etc/nginx/sites-enabled/hermes

# Disable default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload NGINX
sudo systemctl reload nginx
```

### Environment Variables

Create `.env` file in `/opt/hermes/backend/.env`:

```bash
# Node environment
NODE_ENV=production
PORT=3000

# Database (if using PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hermes
DB_USER=hermes
DB_PASSWORD=your-secure-password

# API Keys (if needed)
API_KEY=your-api-key
API_SECRET=your-api-secret

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/hermes/app.log
```

**Note**: Restart container after changing environment variables:
```bash
docker restart hermes-app
```

---

## ✅ VERIFICATION & HEALTH CHECKS

### Container Status
```bash
# Check if container is running
docker ps | grep hermes

# Check container health
docker inspect hermes-app --format='{{.State.Health.Status}}'
# Expected output: healthy

# View container logs
docker logs -f hermes-app

# Check container resource usage
docker stats hermes-app
```

### API Health
```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-11-01T15:30:00Z"}

# Test through NGINX
curl -I https://example.com/api/health

# Expected headers:
# HTTP/2 200
# Strict-Transport-Security: max-age=31536000
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
```

### NGINX Status
```bash
# Check NGINX status
sudo systemctl status nginx

# Check NGINX processes
ps aux | grep nginx

# View NGINX logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Test SSL certificate
openssl s_client -connect example.com:443 -servername example.com

# Check certificate expiry
sudo certbot certificates
```

### Database Connection
```bash
# If using PostgreSQL
psql -h localhost -U hermes -d hermes

# Or from within container
docker exec hermes-app psql -h localhost -U hermes -d hermes -c "SELECT version();"
```

---

## 📊 DEPLOYMENT CHECKLIST

### Before Deployment
- [ ] Remote server has minimum 4GB RAM and 20GB disk
- [ ] SSH access confirmed (with root or sudo)
- [ ] Domain name purchased and DNS configured
- [ ] GitHub repository accessible (public or SSH key configured)
- [ ] Deployment script downloaded and reviewed

### During Deployment
- [ ] Run deployment script and monitor output
- [ ] Wait for "DEPLOYMENT COMPLETE!" message
- [ ] Note all endpoints displayed in summary

### After Deployment
- [ ] Container is running: `docker ps | grep hermes`
- [ ] Container is healthy: `docker inspect hermes-app --format='{{.State.Health.Status}}'`
- [ ] API responds: `curl http://localhost:3000/api/health`
- [ ] NGINX is active: `sudo systemctl status nginx`
- [ ] HTTPS certificate valid: `sudo certbot certificates`
- [ ] Security headers present: `curl -I https://example.com`
- [ ] Rate limiting works: `for i in {1..25}; do curl https://example.com/api; done`

---

## 🔧 TROUBLESHOOTING

### Container won't start
```bash
# Check logs
docker logs hermes-app

# Common causes:
# 1. Port 3000 already in use
sudo lsof -i :3000

# 2. Insufficient disk space
df -h

# 3. Docker daemon issues
sudo systemctl restart docker
```

### NGINX not responding
```bash
# Check configuration
sudo nginx -t

# Check if listening on ports
sudo netstat -tlnp | grep nginx

# Check firewall
sudo ufw status
sudo ufw allow 80
sudo ufw allow 443

# Restart NGINX
sudo systemctl restart nginx
```

### TypeScript compilation errors
```bash
# Try cleaning and rebuilding
cd /opt/hermes/backend
rm -rf dist node_modules package-lock.json
npm clean-install
npx tsc --diagnostics

# Check TypeScript version
npx tsc --version
```

### Docker image build fails
```bash
# Check Docker daemon
sudo systemctl status docker

# Check disk space
docker system df

# Clean up old images
docker image prune -a

# Try building with more output
docker build -f Dockerfile.hermes -t hermes:v1.0.0 . --progress=plain
```

### Health check failing
```bash
# Check if API is actually running
curl -v http://localhost:3000/api/health

# Check Docker health status
docker inspect hermes-app | grep -A 5 "Health"

# View container output
docker logs hermes-app

# May need to increase health check timeout
# Edit docker-compose.yml or container run command
```

---

## 🔐 SECURITY HARDENING

After successful deployment, apply these security measures:

### 1. Update System
```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo reboot
```

### 2. Configure Firewall
```bash
sudo ufw enable
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 3000/tcp # API (for internal use only)
```

### 3. Configure fail2ban
```bash
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 4. Set up monitoring
```bash
# Install monitoring tools
sudo apt-get install -y htop curl wget

# Set up log rotation
sudo apt-get install -y logrotate

# Configure Docker log rotation
sudo cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
JSON
```

### 5. Regular backups
```bash
# Create backup script
cat > /usr/local/bin/backup-hermes.sh <<'BACKUP'
#!/bin/bash
BACKUP_DIR="/backups/hermes"
mkdir -p $BACKUP_DIR
docker export hermes-app | gzip > $BACKUP_DIR/hermes-$(date +%Y%m%d).tar.gz
find $BACKUP_DIR -mtime +7 -delete  # Keep last 7 days
BACKUP

chmod +x /usr/local/bin/backup-hermes.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-hermes.sh") | crontab -
```

---

## 📈 MONITORING & MAINTENANCE

### Daily Tasks
- [ ] Check container status: `docker ps | grep hermes`
- [ ] Check logs for errors: `docker logs hermes-app | grep -i error`
- [ ] Monitor disk usage: `df -h`

### Weekly Tasks
- [ ] Review NGINX logs: `sudo tail -100 /var/log/nginx/access.log`
- [ ] Update packages: `sudo apt-get update && apt-get upgrade`
- [ ] Check certificate expiry: `sudo certbot certificates`

### Monthly Tasks
- [ ] Full system update: `sudo apt-get dist-upgrade`
- [ ] Security audit: `sudo lynis audit system`
- [ ] Database backup (if using DB): `pg_dump ... | gzip > backup.sql.gz`

---

## 📞 SUPPORT & RESOURCES

### Documentation
- `HMS_PROJECT_STATUS_CONTEXT.md` - Project overview
- `HMS_PENDING_WORK_PLAN.md` - Implementation roadmap
- `ARCHITECTURE_SYSTEM.md` - System architecture
- `PRD_AURIGRAPH.md` - Product requirements

### Useful Commands
```bash
# View deployment logs
sudo journalctl -u docker -f

# Monitor container in real-time
docker stats hermes-app --no-stream=false

# SSH into container
docker exec -it hermes-app bash

# Restart services
docker restart hermes-app
sudo systemctl restart nginx

# View environment variables
docker exec hermes-app env | grep -i hermes

# Test connectivity
curl -v https://example.com/api/health
```

### Emergency Procedures
```bash
# Stop container
docker stop hermes-app

# Remove container
docker rm hermes-app

# Revert to previous image (if available)
docker images | grep hermes
docker run -d ... hermes:v1.0.0

# Full rollback
cd /opt/hermes
git log --oneline -5
git revert HEAD
docker build -f Dockerfile.hermes -t hermes:rollback .
```

---

## 🎉 DEPLOYMENT COMPLETE!

After successful deployment:

1. **Access your API**
   - HTTP: `http://your-server-ip:3000`
   - HTTPS: `https://example.com` (with domain)

2. **Monitor performance**
   - NGINX logs: `/var/log/nginx/access.log`
   - Application logs: `docker logs hermes-app`
   - System metrics: `docker stats hermes-app`

3. **Plan next steps**
   - Configure database connections
   - Set up monitoring and alerts
   - Plan database migrations
   - Begin testing strategy-builder endpoints
   - Prepare for Sprint 2 development

---

**Deployment Guide Version**: 1.0.0
**Last Updated**: November 1, 2025
**Repository**: https://github.com/Aurigraph-DLT-Corp/glowing-adventure
**Support**: See documentation files or create GitHub issues

