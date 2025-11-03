# HERMES HF - REMOTE DEPLOYMENT READINESS

**Version**: 2.2.0
**Date**: November 3, 2025
**Status**: ✅ READY FOR PRODUCTION DEPLOYMENT
**Target**: hms.aurex.in (Frontend) + apihms.aurex.in (Backend)

---

## 🎯 DEPLOYMENT OVERVIEW

This document provides complete instructions for deploying HERMES HF v2.2.0 to the production server at `hms.aurex.in` with:
- **Frontend**: hms.aurex.in (with SSL)
- **Backend API**: apihms.aurex.in (with SSL)
- **SSL Certificates**: /etc/letsencrypt/live/aurexcrt1/
- **Remote Directory**: /opt/HMS
- **Git Repository**: git@github.com:Aurigraph-DLT-Corp/HMS.git (main branch)
- **SSH User**: subbu@hms.aurex.in

---

## ✅ PRE-DEPLOYMENT CHECKLIST

### Local Environment
- [ ] Git working tree is clean (`git status`)
- [ ] All changes committed (`git log -1 --oneline`)
- [ ] On main branch (`git branch`)
- [ ] Latest code pulled (`git pull origin main`)
- [ ] Docker installed and running (`docker --version`)
- [ ] Docker Compose installed (`docker-compose --version`)
- [ ] SSH key configured (`ssh-add ~/.ssh/id_rsa`)
- [ ] SSH connection tested (`ssh subbu@hms.aurex.in "echo OK"`)

### Remote Server
- [ ] SSH access verified (`ssh subbu@hms.aurex.in "uname -a"`)
- [ ] Directory /opt/HMS exists or will be created
- [ ] Git repository cloned or ready to clone
- [ ] SSL certificates present at /etc/letsencrypt/live/aurexcrt1/
- [ ] Disk space available (50GB+ free)
- [ ] Docker installed on remote server
- [ ] Database backup taken (if updating existing deployment)

### Code Quality
- [ ] All tests passing locally (`npm test`)
- [ ] No TypeScript errors (`npm run build:backend`)
- [ ] Docker image builds successfully locally (`docker build -t hermes-hf:test .`)
- [ ] Environment variables configured correctly
- [ ] No secrets committed to git

### External Dependencies
- [ ] DNS records pointing to hms.aurex.in
- [ ] SSL certificates are valid and not expired
- [ ] Let's Encrypt auto-renewal configured
- [ ] Firewall rules allow ports 80, 443, 22

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Verify Prerequisites (5 minutes)

```bash
# Check local environment
git status
git log -1 --oneline
docker --version
docker-compose --version

# Test SSH connection
ssh subbu@hms.aurex.in "echo 'SSH connection successful'"

# Verify remote directory
ssh subbu@hms.aurex.in "ls -la /opt/HMS" || echo "Directory will be created"
```

### Step 2: Run Full Deployment (20-30 minutes)

```bash
# Make script executable
chmod +x deploy-remote-production.sh

# Run full deployment
./deploy-remote-production.sh deploy

# This will:
# 1. Check local prerequisites
# 2. Verify git working tree
# 3. Test SSH connectivity
# 4. Build Docker image locally
# 5. Prepare remote server
# 6. Backup current deployment
# 7. Pull latest code to remote
# 8. Clean up old Docker containers
# 9. Deploy with docker-compose
# 10. Verify frontend and backend
# 11. Verify SSL certificates
# 12. Run health checks
```

### Step 3: Verify Deployment (10 minutes)

```bash
# Check status
./deploy-remote-production.sh status

# View logs
./deploy-remote-production.sh logs

# Access services
# Frontend: https://hms.aurex.in
# Backend: https://apihms.aurex.in/health
# Prometheus: http://hms.aurex.in:9090
# Grafana: http://hms.aurex.in:3000
```

### Step 4: Manual Verification (Optional)

```bash
# SSH into remote server
ssh subbu@hms.aurex.in

# Check containers
docker-compose -f /opt/HMS/docker-compose-staging.yml ps

# View logs
docker-compose -f /opt/HMS/docker-compose-staging.yml logs -f hms-app

# Test API
curl https://apihms.aurex.in/health

# Check certificate
openssl s_client -connect hms.aurex.in:443 -showcerts
```

---

## 🔄 DEPLOYMENT WORKFLOW

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PRE-DEPLOYMENT CHECKS                                    │
│    • Local prerequisites (Git, Docker, SSH)                 │
│    • Working tree clean                                     │
│    • Remote connectivity verified                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│ 2. BUILD PHASE                                              │
│    • Build Docker image locally                             │
│    • Verify image created                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│ 3. PREPARATION PHASE                                        │
│    • Create remote directories                              │
│    • Backup current deployment                              │
│    • Pull latest code                                       │
│    • Clean up old containers                                │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│ 4. DEPLOYMENT PHASE                                         │
│    • Build image on remote                                  │
│    • Start containers with docker-compose                   │
│    • Wait for services to start                             │
│    • Verify container status                                │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│ 5. VERIFICATION PHASE                                       │
│    • Test frontend (hms.aurex.in)                           │
│    • Test backend (apihms.aurex.in/health)                  │
│    • Verify SSL certificates                                │
│    • Run health checks                                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
         ┌────────▼────────┐
         │                 │
      SUCCESS          FAILURE
         │                 │
         ▼                 ▼
    Continue       Automatic Rollback
```

---

## 📊 DEPLOYMENT ARCHITECTURE

```
LOCAL MACHINE
└─ Docker Build
   └─ hermes-hf:production (pushed to remote)

REMOTE SERVER (hms.aurex.in)
├─ Frontend Container (Port 3000)
│  └─ hms.aurex.in → /opt/HMS (HTTPS)
│
├─ Backend Container (Port 3001)
│  └─ apihms.aurex.in → /opt/HMS/backend (HTTPS + gRPC)
│
├─ PostgreSQL (Port 5432)
│  └─ Database persistence (/opt/HMS/data)
│
├─ Redis (Port 6379)
│  └─ Session/cache store
│
└─ Monitoring Stack
   ├─ Prometheus (Port 9090)
   ├─ Grafana (Port 3000)
   └─ Loki (Port 3100)

SSL/TLS
└─ /etc/letsencrypt/live/aurexcrt1/
   ├─ privkey.pem (private key)
   └─ fullchain.pem (certificate chain)
```

---

## 🔍 VERIFICATION POINTS

### Frontend Verification
```bash
# Should return 200 status
curl -I https://hms.aurex.in

# Should show homepage
curl https://hms.aurex.in

# Check SSL certificate
openssl s_client -connect hms.aurex.in:443 -showcerts
```

### Backend Verification
```bash
# Should return 200 status
curl -I https://apihms.aurex.in/health

# Should return health JSON
curl https://apihms.aurex.in/health

# Check database
curl https://apihms.aurex.in/api/database/status

# Check cache
curl https://apihms.aurex.in/api/cache/status
```

### Monitoring Verification
```bash
# Prometheus health
curl http://hms.aurex.in:9090/-/healthy

# Grafana health
curl http://hms.aurex.in:3000/api/health

# Container logs
ssh subbu@hms.aurex.in "docker-compose -f /opt/HMS/docker-compose-staging.yml logs --tail=50"
```

---

## 🛠️ TROUBLESHOOTING

### SSH Connection Failed
```bash
# Check if SSH key is added
ssh-add -l

# Add SSH key
ssh-add ~/.ssh/id_rsa

# Test connection with verbose output
ssh -vv subbu@hms.aurex.in "echo OK"
```

### Docker Build Failed
```bash
# Check Docker daemon
docker ps

# Verify Docker image builds locally
docker build -t hermes-hf:test -f Dockerfile .

# Check for uncommitted changes
git status
```

### Remote Deployment Failed
```bash
# Check remote logs
ssh subbu@hms.aurex.in "tail -100 /opt/HMS/logs/*.log"

# Check Docker status
ssh subbu@hms.aurex.in "docker ps -a"

# Rollback previous version
./deploy-remote-production.sh rollback
```

### Frontend/Backend Not Responding
```bash
# Check services on remote
ssh subbu@hms.aurex.in "cd /opt/HMS && docker-compose -f docker-compose-staging.yml ps"

# Check logs
ssh subbu@hms.aurex.in "cd /opt/HMS && docker-compose -f docker-compose-staging.yml logs -f hms-app"

# Verify network connectivity
ssh subbu@hms.aurex.in "docker network ls"
```

### SSL Certificate Issues
```bash
# Check certificate expiration
ssh subbu@hms.aurex.in "openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -noout -enddate"

# Renew certificate (if expired)
ssh subbu@hms.aurex.in "certbot renew"

# Verify certificate permissions
ssh subbu@hms.aurex.in "ls -la /etc/letsencrypt/live/aurexcrt1/"
```

---

## 🔄 ROLLBACK PROCEDURES

### Automatic Rollback (on failure)
```bash
# Already handled by the deployment script
# Runs automatically if health checks fail
# Rolls back to previous git commit
```

### Manual Rollback
```bash
# Rollback to previous version
./deploy-remote-production.sh rollback

# Or manually:
ssh subbu@hms.aurex.in << 'EOF'
  cd /opt/HMS
  git log -1 --oneline
  git reset --hard HEAD~1
  docker-compose -f docker-compose-staging.yml down
  docker-compose -f docker-compose-staging.yml up -d
  sleep 10
  docker-compose -f docker-compose-staging.yml ps
EOF
```

### Recovery from Backup
```bash
# List available backups
ssh subbu@hms.aurex.in "ls -lh /opt/HMS/backups/"

# Restore from backup
ssh subbu@hms.aurex.in << 'EOF'
  cd /opt/HMS/backups
  tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz
  # Manual restoration steps...
EOF
```

---

## 📈 POST-DEPLOYMENT ACTIONS

### 1. Monitor Service Health (24 hours)
```bash
# Check deployment logs
./deploy-remote-production.sh logs

# Monitor resource usage
ssh subbu@hms.aurex.in "docker stats"

# Check error logs
ssh subbu@hms.aurex.in "docker-compose -f /opt/HMS/docker-compose-staging.yml logs --tail=100 | grep -i error"
```

### 2. Verify All Endpoints
```bash
# Frontend
curl -I https://hms.aurex.in

# Backend
curl https://apihms.aurex.in/health

# Monitoring
curl http://hms.aurex.in:9090/-/healthy
curl http://hms.aurex.in:3000/api/health
```

### 3. Update Monitoring Dashboard
- Access Grafana: http://hms.aurex.in:3000
- Login: admin/admin
- Import pre-built dashboards
- Configure Prometheus data source

### 4. Performance Baseline
```bash
# Record current metrics for comparison
ssh subbu@hms.aurex.in << 'EOF'
  docker stats --no-stream
  docker system df
  docker inspect $(docker ps -q) | grep -i memory
EOF
```

### 5. Backup Configuration
```bash
# Create full backup
ssh subbu@hms.aurex.in "tar -czf /opt/HMS/backups/post-deploy-backup.tar.gz /opt/HMS/"

# Test database backup
ssh subbu@hms.aurex.in "docker exec $(docker ps -f name=postgres -q) pg_dump -U postgres hermes_db | wc -l"
```

---

## 🚨 EMERGENCY PROCEDURES

### Total Service Failure
```bash
# Stop all containers
ssh subbu@hms.aurex.in "cd /opt/HMS && docker-compose -f docker-compose-staging.yml down"

# Remove volumes (CAUTION: deletes data)
ssh subbu@hms.aurex.in "docker volume prune -f"

# Redeploy from scratch
./deploy-remote-production.sh deploy
```

### Database Corruption
```bash
# Restore from latest backup
ssh subbu@hms.aurex.in << 'EOF'
  cd /opt/HMS
  docker-compose -f docker-compose-staging.yml stop postgres
  # Restore SQL backup
  docker exec <postgres-container> psql -U postgres < backup.sql
  docker-compose -f docker-compose-staging.yml start postgres
EOF
```

### SSL Certificate Expiration
```bash
# Renew certificate immediately
ssh subbu@hms.aurex.in "sudo certbot renew --force-renewal"

# Restart containers to load new certificate
ssh subbu@hms.aurex.in "cd /opt/HMS && docker-compose -f docker-compose-staging.yml restart"
```

---

## 📋 DEPLOYMENT COMMAND REFERENCE

```bash
# Full deployment with verification
./deploy-remote-production.sh deploy

# Check deployment status
./deploy-remote-production.sh status

# View live logs
./deploy-remote-production.sh logs

# Verify services only
./deploy-remote-production.sh verify

# Rollback to previous version
./deploy-remote-production.sh rollback

# Show help
./deploy-remote-production.sh
```

---

## 📞 SUPPORT & ESCALATION

### Level 1: Verify Deployment
- Check `./deploy-remote-production.sh status`
- Review deployment logs
- Verify frontend and backend responding

### Level 2: Check Remote Server
```bash
ssh subbu@hms.aurex.in
docker ps
docker-compose -f /opt/HMS/docker-compose-staging.yml logs -f
```

### Level 3: Rollback
- `./deploy-remote-production.sh rollback`
- Investigate previous deployment logs
- Check git history for changes

### Level 4: Emergency
- Stop all services: `docker-compose down`
- Restore from backup if available
- Contact DevOps team for support

---

## 🎓 QUICK REFERENCE

| Command | Purpose |
|---------|---------|
| `./deploy-remote-production.sh deploy` | Full deployment |
| `./deploy-remote-production.sh verify` | Verify services |
| `./deploy-remote-production.sh rollback` | Rollback deployment |
| `./deploy-remote-production.sh status` | Check status |
| `./deploy-remote-production.sh logs` | View logs |

| URL | Purpose |
|-----|---------|
| https://hms.aurex.in | Frontend |
| https://apihms.aurex.in/health | Backend health |
| http://hms.aurex.in:9090 | Prometheus metrics |
| http://hms.aurex.in:3000 | Grafana dashboards |

---

## ✅ FINAL CHECKLIST

Before executing deployment:

- [ ] All code committed to main branch
- [ ] Docker image builds successfully
- [ ] SSH key configured
- [ ] Remote connectivity verified
- [ ] Backups taken (if upgrading)
- [ ] Monitoring dashboards ready
- [ ] SSL certificates valid
- [ ] Database migration plan (if needed)
- [ ] Rollback procedure understood
- [ ] Team notified of deployment

After deployment:

- [ ] Frontend responding (hms.aurex.in)
- [ ] Backend responding (apihms.aurex.in/health)
- [ ] Database accessible
- [ ] Cache operational
- [ ] Monitoring active
- [ ] Logs flowing correctly
- [ ] SSL certificates valid
- [ ] Performance baseline established
- [ ] Backup taken post-deployment
- [ ] Team notified deployment complete

---

**Last Updated**: November 3, 2025
**Deployment Ready**: ✅ YES
**Next Steps**: Run `./deploy-remote-production.sh deploy`
