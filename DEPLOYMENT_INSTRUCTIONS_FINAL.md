# HMS Production Deployment Instructions
**Date**: November 2, 2025
**Version**: 2.2.0
**Status**: READY FOR DEPLOYMENT

---

## Overview

This document provides complete instructions for deploying HMS to the production server at **hms.aurex.in** with the following configuration:

| Component | Value |
|-----------|-------|
| **Frontend URL** | https://hms.aurex.in |
| **Backend URL** | https://apihms.aurex.in |
| **Remote User** | subbu |
| **Remote Host** | hms.aurex.in |
| **Working Directory** | /opt/HMS |
| **Git Repository** | git@github.com:Aurigraph-DLT-Corp/HMS.git |
| **Git Branch** | main |
| **SSL Certificates** | /etc/letsencrypt/live/aurexcrt1/ |
| **SSL Private Key** | /etc/letsencrypt/live/aurexcrt1/privkey.pem |
| **SSL Chain** | /etc/letsencrypt/live/aurexcrt1/fullchain.pem |

---

## Pre-Deployment Checklist

Before deploying, ensure the following prerequisites are met:

### Local System
- [ ] All code changes committed to git
- [ ] Code pushed to GitHub main branch
- [ ] No uncommitted changes (`git status` is clean)
- [ ] SSH access configured for remote server
- [ ] Docker installed on local system (for testing, optional)

### Remote Server
- [ ] SSH access available: `ssh subbu@hms.aurex.in`
- [ ] Docker and Docker Compose installed
- [ ] Git installed and configured
- [ ] `/opt/HMS` directory accessible (will be created if needed)
- [ ] SSL certificates present at `/etc/letsencrypt/live/aurexcrt1/`
  - [ ] `fullchain.pem` (SSL certificate chain)
  - [ ] `privkey.pem` (private key)
- [ ] Ports available:
  - [ ] Port 80 (HTTP)
  - [ ] Port 443 (HTTPS)
  - [ ] Port 3000 (Node.js application)
  - [ ] Port 50051 (gRPC)
- [ ] Sufficient disk space (at least 10GB free)
- [ ] Internet connectivity for pulling Docker images

### DNS/SSL Configuration
- [ ] DNS A record for `hms.aurex.in` points to server IP
- [ ] DNS A record for `apihms.aurex.in` points to server IP
- [ ] SSL certificate valid and not expired
- [ ] Verify certificate: `openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -noout -dates`

---

## Deployment Methods

### Method 1: PowerShell Script (Windows Users) ⭐ RECOMMENDED

If you're on Windows with PowerShell:

```powershell
# Run from project root directory
.\Deploy-Production.ps1

# Or with custom parameters:
.\Deploy-Production.ps1 `
  -RemoteUser "subbu" `
  -RemoteHost "hms.aurex.in" `
  -RemoteDir "/opt/HMS" `
  -GitBranch "main"
```

**What it does:**
1. Verifies local git status
2. Tests SSH connection
3. Cleans old Docker containers and images on remote
4. Pulls latest code from GitHub
5. Builds Docker image
6. Deploys services with Docker Compose
7. Verifies deployment

**Expected output:**
- Step-by-step progress with color coding
- Service URLs upon completion
- Useful commands for monitoring

---

### Method 2: Bash Script (Linux/Mac Users)

If you're on Linux or Mac:

```bash
# Run from project root directory
chmod +x deploy-production-final.sh
./deploy-production-final.sh

# Or manually execute remote commands:
chmod +x remote-deploy-commands.sh
ssh subbu@hms.aurex.in 'bash -s' < remote-deploy-commands.sh
```

---

### Method 3: Manual SSH Commands

If you prefer manual control, execute these commands step-by-step:

#### Step 1: Connect to remote server
```bash
ssh subbu@hms.aurex.in
```

#### Step 2: Navigate to working directory
```bash
cd /opt/HMS || { sudo mkdir -p /opt/HMS && cd /opt/HMS; }
pwd
```

#### Step 3: Clean old Docker resources
```bash
# Stop containers
docker-compose down 2>/dev/null || true
docker stop $(docker ps -aq) 2>/dev/null || true

# Remove old containers
docker rm -f $(docker ps -a --filter "name=hms" -q) 2>/dev/null || true

# Remove old images
docker rmi -f $(docker images | grep -E 'hms|aurex' | awk '{print $3}') 2>/dev/null || true

# Prune dangling resources
docker image prune -f --all
docker volume prune -f
docker network prune -f
```

#### Step 4: Update Git repository
```bash
git clone git@github.com:Aurigraph-DLT-Corp/HMS.git . 2>/dev/null || {
    git fetch origin
    git checkout main
    git pull origin main
}
```

#### Step 5: Install dependencies
```bash
npm install --legacy-peer-deps
```

#### Step 6: Build Docker image
```bash
docker build \
  -f Dockerfile \
  -t hms-app:latest \
  -t hms-app:v2.2.0 \
  --build-arg NODE_ENV=production \
  .
```

#### Step 7: Create production environment file
```bash
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3000
GRPC_PORT=50051
FRONTEND_URL=https://hms.aurex.in
BACKEND_URL=https://apihms.aurex.in
API_BASE_URL=https://apihms.aurex.in/api
LOG_LEVEL=info
SSL_CERT_PATH=/etc/letsencrypt/live/aurexcrt1/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/aurexcrt1/privkey.pem
EOF
```

#### Step 8: Create Docker Compose configuration
```bash
cat > docker-compose.production.yml << 'EOF'
version: '3.8'
services:
  hms-app:
    image: hms-app:v2.2.0
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
```

#### Step 9: Start services
```bash
docker-compose -f docker-compose.production.yml up -d
sleep 10
```

#### Step 10: Verify deployment
```bash
docker ps
docker logs -f hms-production
```

---

## Post-Deployment Verification

After deployment, verify everything is working correctly:

### Check Service Status
```bash
ssh subbu@hms.aurex.in 'docker ps -a'
```

Expected output should show:
- `hms-production` (running)
- `hms-nginx` (running)

### View Application Logs
```bash
ssh subbu@hms.aurex.in 'docker logs -f hms-production'
```

### Test Frontend
```bash
curl https://hms.aurex.in
# Should return HTML content
```

### Test Backend API
```bash
curl https://apihms.aurex.in/api/health
# Should return JSON health status
```

### Verify SSL Certificate
```bash
ssh subbu@hms.aurex.in 'openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -noout -dates'
```

### Check Resource Usage
```bash
ssh subbu@hms.aurex.in 'docker stats'
```

---

## Troubleshooting

### Issue: SSH Connection Refused
**Solution:**
```bash
# Verify SSH key is configured
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa

# Add key to authorized_keys on remote
ssh-copy-id -i ~/.ssh/id_rsa.pub subbu@hms.aurex.in
```

### Issue: Docker Build Fails
**Solution:**
```bash
# Check Docker daemon
ssh subbu@hms.aurex.in 'docker ps'

# View build error logs
ssh subbu@hms.aurex.in 'docker build -t hms-test . 2>&1 | tail -50'

# Restart Docker daemon if needed
ssh subbu@hms.aurex.in 'sudo systemctl restart docker'
```

### Issue: Port Already in Use
**Solution:**
```bash
# Find process using port
ssh subbu@hms.aurex.in 'sudo lsof -i :3000'

# Kill process if needed
ssh subbu@hms.aurex.in 'sudo kill -9 <PID>'
```

### Issue: SSL Certificate Not Found
**Solution:**
```bash
# Verify certificate location
ssh subbu@hms.aurex.in 'ls -la /etc/letsencrypt/live/aurexcrt1/'

# If missing, install/renew with Let's Encrypt
ssh subbu@hms.aurex.in 'sudo certbot renew'
```

### Issue: Services Won't Start
**Solution:**
```bash
# Check logs for errors
ssh subbu@hms.aurex.in 'docker logs hms-production'

# Check environment variables
ssh subbu@hms.aurex.in 'cat .env.production'

# Restart services
ssh subbu@hms.aurex.in 'docker-compose -f docker-compose.production.yml restart'
```

---

## Rollback Procedure

If something goes wrong, rollback to the previous version:

```bash
# Option 1: Revert last commit
ssh subbu@hms.aurex.in 'cd /opt/HMS && git revert HEAD'

# Option 2: Go back to previous tag
ssh subbu@hms.aurex.in 'cd /opt/HMS && git checkout v2.1.0'

# Rebuild and restart
ssh subbu@hms.aurex.in 'cd /opt/HMS && docker build -t hms-app:latest . && docker-compose -f docker-compose.production.yml up -d'
```

---

## Monitoring and Maintenance

### Daily Monitoring
```bash
# Check service status
ssh subbu@hms.aurex.in 'docker ps'

# View recent logs
ssh subbu@hms.aurex.in 'docker logs --tail 100 hms-production'

# Check disk space
ssh subbu@hms.aurex.in 'df -h'
```

### Weekly Maintenance
```bash
# Prune unused Docker resources
ssh subbu@hms.aurex.in 'docker system prune -f'

# Update Docker images
ssh subbu@hms.aurex.in 'docker pull nginx:latest'

# Check for updates
ssh subbu@hms.aurex.in 'cd /opt/HMS && git fetch origin'
```

### SSL Certificate Renewal
```bash
# Renew Let's Encrypt certificate (usually automatic)
ssh subbu@hms.aurex.in 'sudo certbot renew'

# Check certificate expiration
ssh subbu@hms.aurex.in 'openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -noout -dates'
```

---

## Useful Commands Reference

### Docker Commands
```bash
# View containers
docker ps -a

# View logs
docker logs -f hms-production

# Restart services
docker-compose restart

# Stop services
docker-compose down

# View resource usage
docker stats

# Clean up
docker system prune -f
```

### Git Commands
```bash
# Check status
git status

# View logs
git log --oneline -10

# Pull latest
git pull origin main

# Revert changes
git revert HEAD
```

### File Management
```bash
# View logs directory
ls -la /opt/HMS/logs/

# Check free space
df -h

# Monitor directory size
du -sh /opt/HMS/*
```

---

## Support and Documentation

For more information, see:
- `README.md` - Project overview
- `CONTEXT.md` - Complete project context
- `SESSION_COMPLETION_SUMMARY_NOV2.md` - Deployment summary
- `docs/` - Architecture and integration guides

---

## Summary

HMS v2.2.0 is **production-ready** and can be deployed using the provided scripts. Choose your deployment method based on your operating system:

- **Windows with PowerShell**: Use `Deploy-Production.ps1`
- **Linux/Mac with Bash**: Use `deploy-production-final.sh` or `remote-deploy-commands.sh`
- **Manual SSH**: Execute commands from "Method 3" above

The deployment process will:
1. ✅ Clean old Docker resources
2. ✅ Pull latest code from GitHub
3. ✅ Build Docker image
4. ✅ Deploy with Docker Compose
5. ✅ Configure SSL certificates
6. ✅ Verify all services

**Estimated deployment time: 10-20 minutes**

---

**Deployment Date**: November 2, 2025
**Version**: 2.2.0
**Status**: READY FOR PRODUCTION
