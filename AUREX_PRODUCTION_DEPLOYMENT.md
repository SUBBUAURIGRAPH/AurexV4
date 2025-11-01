# HMS Production Deployment to hms.aurex.in

**Date**: October 29, 2025
**Environment**: Production (Aurex)
**Frontend**: https://hms.aurex.in
**Backend API**: https://apihms.aurex.in
**Remote Dir**: /opt/HMS
**Git Branch**: main

---

## Quick Start

```bash
# From local machine
chmod +x deploy-to-aurex.sh
./deploy-to-aurex.sh
```

The script will:
1. ✅ Connect via SSH (subbu@hms.aurex.in)
2. ✅ Clean up all old Docker containers
3. ✅ Prune unused Docker images
4. ✅ Clone/update HMS repository from GitHub
5. ✅ Create NGINX configuration with SSL/TLS
6. ✅ Pull latest Docker image
7. ✅ Start all services (Agent, PostgreSQL, Prometheus, Grafana)
8. ✅ Verify health endpoints
9. ✅ Generate deployment report

---

## Prerequisites

### On Your Local Machine

```bash
# 1. Ensure you have SSH access configured
ssh -p 22 subbu@hms.aurex.in "echo 'SSH works'"

# 2. Add SSH key to agent (if needed)
ssh-add ~/.ssh/id_rsa

# 3. Make script executable
chmod +x deploy-to-aurex.sh

# 4. Have latest code committed to main branch
git push origin main
```

### On Remote Server (hms.aurex.in)

```bash
# Should already have:
✅ Docker and Docker Compose installed
✅ SSH key for GitHub (git@github.com:Aurigraph-DLT-Corp/HMS.git)
✅ SSL certificates at /etc/letsencrypt/live/aurexcrt1/
  - fullchain.pem
  - privkey.pem
✅ /opt/HMS directory writable by subbu user
```

---

## Deployment Process

### Step 1: Verify Prerequisites

```bash
# Check SSH connectivity
ssh -p 22 subbu@hms.aurex.in "docker version"

# Check SSL certificates exist
ssh -p 22 subbu@hms.aurex.in "ls -la /etc/letsencrypt/live/aurexcrt1/"

# Check directory exists
ssh -p 22 subbu@hms.aurex.in "ls -la /opt/"
```

### Step 2: Commit Latest Code

```bash
# Make sure all changes are pushed to main
git add .
git commit -m "Your commit message"
git push origin main
```

### Step 3: Run Deployment Script

```bash
# Make script executable
chmod +x deploy-to-aurex.sh

# Run deployment
./deploy-to-aurex.sh

# Output will show:
# ✅ SSH connection established
# ✅ Docker cleanup complete
# ✅ Repository ready at /opt/HMS
# ✅ NGINX SSL configuration created
# ✅ Production Docker Compose configuration created
# ✅ Services started successfully
# ✅ NGINX configured and running
```

### Step 4: Monitor Deployment

```bash
# Watch the script output for progress
# It takes approximately 5-10 minutes total

# Key steps:
# 1. Container cleanup (1-2 min)
# 2. Git update (1 min)
# 3. Docker image pull (2-3 min)
# 4. Service startup (2-3 min)
```

### Step 5: Verify Deployment

After deployment completes, test endpoints:

```bash
# Test Frontend (with SSL)
curl -v https://hms.aurex.in/health

# Test Backend API (with SSL)
curl -v https://apihms.aurex.in/health

# SSH to verify services
ssh subbu@hms.aurex.in
  cd /opt/HMS
  docker-compose -f docker-compose.production.yml ps
  docker-compose -f docker-compose.production.yml logs -f hms-j4c-agent
```

---

## Post-Deployment Configuration

### 1. Set Environment Variables

```bash
# SSH into server
ssh subbu@hms.aurex.in

# Navigate to deployment directory
cd /opt/HMS

# Create .env file
cp .env.example .env

# Edit with production credentials
nano .env

# Required variables:
JIRA_API_KEY=your_token
GITHUB_TOKEN=your_token
HUBSPOT_API_KEY=your_token
SLACK_WEBHOOK_URL=your_webhook
DB_PASSWORD=secure_password
GRAFANA_PASSWORD=secure_password
```

### 2. Restart Services with New Environment

```bash
# After editing .env
docker-compose -f docker-compose.production.yml restart

# Verify
docker-compose -f docker-compose.production.yml ps
```

### 3. Access Services

```bash
# Frontend (Browser)
https://hms.aurex.in

# Backend API (Browser)
https://apihms.aurex.in

# Grafana (SSH Tunnel)
ssh -L 3000:localhost:3000 subbu@hms.aurex.in
# Then open: http://localhost:3000
# Default login: admin/admin (change password!)

# Prometheus (SSH Tunnel)
ssh -L 9090:localhost:9090 subbu@hms.aurex.in
# Then open: http://localhost:9090
```

---

## Service Configuration

### NGINX (Reverse Proxy with SSL)
- **Ports**: 80 (HTTP → HTTPS redirect), 443 (HTTPS)
- **Frontend Domain**: hms.aurex.in
- **Backend API Domain**: apihms.aurex.in
- **SSL Cert**: /etc/letsencrypt/live/aurexcrt1/fullchain.pem
- **SSL Key**: /etc/letsencrypt/live/aurexcrt1/privkey.pem
- **Status**: `sudo systemctl status nginx`

### HMS J4C Agent
- **Port**: 9003 (internal)
- **Container**: hms-j4c-agent
- **Health Check**: /health
- **Exposed via**: NGINX proxy

### PostgreSQL
- **Port**: 5432 (internal)
- **Container**: hms-postgres
- **Database**: hms_db
- **User**: hms_user
- **Volume**: hms-postgres-data

### Prometheus
- **Port**: 9090 (internal)
- **Container**: hms-prometheus
- **Metrics Retention**: 90 days
- **Config**: prometheus-dlt.yml
- **Alerts**: prometheus-alerts.yml

### Grafana
- **Port**: 3000 (internal)
- **Container**: hms-grafana
- **Default Login**: admin/admin
- **Config**: grafana-alerts.yaml

---

## Monitoring & Health Checks

### Check Service Health

```bash
# SSH to server
ssh subbu@hms.aurex.in
cd /opt/HMS

# Check all services
docker-compose -f docker-compose.production.yml ps

# Check specific service
docker ps | grep hms-j4c-agent

# View logs
docker-compose -f docker-compose.production.yml logs -f hms-j4c-agent
docker-compose -f docker-compose.production.yml logs -f hms-nginx-proxy
docker-compose -f docker-compose.production.yml logs -f hms-postgres
```

### Health Endpoints

```bash
# Frontend health
curl https://hms.aurex.in/health

# Backend health
curl https://apihms.aurex.in/health

# From server (internal)
curl http://hms-j4c-agent:9003/health
curl http://localhost:9090/-/healthy
```

### View Metrics

```bash
# Prometheus queries
curl http://localhost:9090/api/v1/query?query=up

# Grafana dashboards
http://localhost:3000 (via SSH tunnel)
```

---

## Docker Cleanup (What Was Done)

The deployment script automatically cleaned up:

```bash
# Remove all containers
docker ps -a -q | xargs -r docker rm -f

# Prune images
docker image prune -a -f --filter "until=72h"

# Prune system
docker system prune -a -f --volumes
```

---

## Backup & Disaster Recovery

### Database Backup

```bash
# Backup PostgreSQL
ssh subbu@hms.aurex.in
docker exec hms-postgres pg_dump -U hms_user hms_db > /opt/HMS/backup_$(date +%Y%m%d).sql

# Backup volumes
docker run --rm \
  -v hms-postgres-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup_$(date +%Y%m%d).tar.gz -C /data .
```

### Restore from Backup

```bash
# Restore database
docker exec -i hms-postgres psql -U hms_user hms_db < backup_20251029.sql

# Restore volumes
docker run --rm \
  -v hms-postgres-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres-backup_20251029.tar.gz -C /data .
```

---

## Troubleshooting

### Services Not Starting

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs hms-j4c-agent

# Restart services
docker-compose -f docker-compose.production.yml restart

# Check health
curl http://hms-j4c-agent:9003/health
```

### SSL Certificate Issues

```bash
# Verify certificate
sudo openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -text -noout

# Check certificate expiry
sudo certbot certificates

# Check NGINX SSL config
sudo nginx -t
sudo systemctl reload nginx
```

### Database Connection Issues

```bash
# Check database
docker exec hms-postgres pg_isready -U hms_user

# Connect to database
docker exec -it hms-postgres psql -U hms_user -d hms_db

# View database logs
docker logs hms-postgres
```

### NGINX Issues

```bash
# Test NGINX config
sudo nginx -t

# View NGINX logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Restart NGINX
sudo systemctl restart nginx
```

### Docker Issues

```bash
# Show all containers
docker ps -a

# Show all images
docker images

# Inspect container
docker inspect hms-j4c-agent

# View container stats
docker stats hms-j4c-agent
```

---

## Performance Monitoring

### CPU and Memory Usage

```bash
# Real-time stats
docker stats

# Historical data (Grafana)
http://localhost:3000 (via SSH tunnel)
```

### Disk Space

```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df

# Find large images
docker images --format "{{.Repository}}:{{.Tag}} {{.Size}}"
```

### Network Traffic

```bash
# Check NGINX connections
sudo netstat -tlnp | grep nginx
# or
sudo ss -tlnp | grep nginx

# View traffic logs
sudo tail -f /var/log/nginx/access.log | grep -E "GET|POST"
```

---

## Maintenance Tasks

### Daily
- Monitor logs: `docker-compose logs -f`
- Check health endpoints
- Monitor disk space: `df -h`

### Weekly
- Review error logs
- Check Prometheus alerts
- Verify backups completed
- Update Docker images: `docker pull aurigraph/hms-j4c-agent:latest`

### Monthly
- Review and optimize alert thresholds
- Update runbooks
- Performance analysis
- Security updates: `docker system prune -a`

### Quarterly
- Review disaster recovery procedures
- Test backup restoration
- Performance baseline comparison
- Plan capacity upgrades

---

## Support & Contact

### SSH Access
```bash
ssh -p 22 subbu@hms.aurex.in
```

### Documentation
- Deployment Guide: DEPLOYMENT_PIPELINE_GUIDE.md
- Docker Setup: HMS_DOCKER_DEPLOYMENT_SUMMARY.md
- Completion Summary: DEPLOYMENT_COMPLETION_SUMMARY.md

### Contact
- Email: agents@aurigraph.io
- Repository: https://github.com/Aurigraph-DLT-Corp/HMS
- Issues: Report bugs and request features

---

## Deployment Checklist

Before deployment:
- [ ] Latest code pushed to main branch
- [ ] SSH key configured and accessible
- [ ] SSL certificates in place at /etc/letsencrypt/live/aurexcrt1/
- [ ] /opt/HMS directory exists and is writable

After deployment:
- [ ] Verify SSH connection works
- [ ] Test frontend: https://hms.aurex.in/health
- [ ] Test backend: https://apihms.aurex.in/health
- [ ] Check all services running: `docker-compose ps`
- [ ] Configure .env file with credentials
- [ ] Restart services with new .env
- [ ] Access Grafana and verify dashboards
- [ ] Test API endpoints
- [ ] Monitor logs for errors
- [ ] Set up scheduled backups

---

**Deployment Status**: ✅ READY
**Last Updated**: October 29, 2025
**Version**: 1.0.0
**Maintained By**: Aurigraph Development Team

For immediate deployment, run:
```bash
./deploy-to-aurex.sh
```
