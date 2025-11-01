# HMS Mobile Trading Platform - Deployment Instructions

**Date**: October 31, 2025
**Status**: Production Ready
**Version**: 1.0.0

---

## Quick Start

### Prerequisites
- Docker (installed and running)
- Git with SSH access configured
- SSH access to: `subbu@hms.aurex.in`
- GitHub access to: `git@github.com:Aurigraph-DLT-Corp/HMS.git`

### One-Command Deployment (Linux/Mac/WSL)

```bash
cd mobile
bash deploy.sh
```

### One-Command Deployment (Windows)

```cmd
cd mobile
build-deploy.bat
```

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│              Client (Browser/Mobile)                    │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────────────────┐
│   Nginx Web Server (hms.aurex.in)                       │
│   - Frontend (React/Expo Web)                           │
│   - Static files caching                                │
│   - SSL/TLS termination                                 │
│   - Proxy to backend API                                │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTPS/WebSocket
┌──────────────────▼──────────────────────────────────────┐
│   Backend API (apihms.aurex.in)                         │
│   - Order management                                    │
│   - WebSocket real-time updates                         │
│   - Database operations                                 │
└─────────────────────────────────────────────────────────┘
```

### Docker Configuration

```
Frontend Container (hms-mobile-web):
├── Image: hms-mobile-web:latest
├── Ports: 80 (HTTP) → 443 (HTTPS)
├── Volumes:
│   ├── /etc/letsencrypt/live/aurexcrt1 (SSL certs)
│   ├── ./logs/nginx (Log files)
│   └── ./nginx.conf (Configuration)
└── Network: hms-network
```

---

## Deployment Methods

### Method 1: Automated Deployment (Recommended)

#### Step 1: Build Locally

**Windows:**
```cmd
cd C:\subbuworking\HMS\mobile
build-deploy.bat
```

**Linux/Mac/WSL:**
```bash
cd /path/to/HMS/mobile
bash deploy.sh
```

#### Step 2: Monitor Deployment Progress

The script will automatically:
1. ✅ Commit changes to Git
2. ✅ Push to GitHub
3. ✅ Build Docker image
4. ✅ Connect via SSH to remote server
5. ✅ Clean up old containers
6. ✅ Deploy new containers
7. ✅ Verify health checks

#### Step 3: Verify Deployment

```bash
bash deploy.sh status    # Show container status
bash deploy.sh logs      # View container logs
```

---

### Method 2: Manual Deployment

#### Step 1: Prepare Local Changes

```bash
cd /path/to/HMS
git add .
git commit -m "Deploy: HMS Mobile Web $(date)"
git push origin main
```

#### Step 2: Connect to Remote Server

```bash
ssh subbu@hms.aurex.in
cd /opt/HMS
```

#### Step 3: Pull Latest Code

```bash
git pull origin main
```

#### Step 4: Build Docker Image on Remote

```bash
# Navigate to mobile directory
cd mobile

# Remove old containers and images
docker-compose down
docker container prune -f
docker image prune -f

# Build new image
docker build -t hms-mobile-web:latest -f Dockerfile .
```

#### Step 5: Start Containers

```bash
# Start all services
docker-compose up -d

# Verify status
docker-compose ps

# View logs
docker-compose logs -f
```

#### Step 6: Verify Deployment

```bash
# Check if service is responding
curl -k https://hms.aurex.in

# Monitor logs in real-time
docker-compose logs -f hms-mobile-web
```

---

## SSL/TLS Configuration

### Certificate Paths

- **Private Key**: `/etc/letsencrypt/live/aurexcrt1/privkey.pem`
- **Certificate**: `/etc/letsencrypt/live/aurexcrt1/fullchain.pem`
- **Chain**: `/etc/letsencrypt/live/aurexcrt1/chain.pem`

### Certificate Renewal (Let's Encrypt)

```bash
# Manual renewal
sudo certbot renew --force-renewal

# Auto-renewal with cron
0 0 1 * * /usr/bin/certbot renew --quiet
```

### Verify Certificate

```bash
# Check certificate expiration
openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -text -noout | grep -A 2 "Validity"

# Test SSL/TLS
openssl s_client -connect hms.aurex.in:443 -showcerts
```

---

## Environment Variables

### Frontend Configuration

```env
FRONTEND_URL=https://hms.aurex.in
API_URL=https://apihms.aurex.in
WS_URL=wss://apihms.aurex.in
NODE_ENV=production
```

### Docker Compose

These are automatically set in `docker-compose.yml`:

```yaml
environment:
  - FRONTEND_URL=https://hms.aurex.in
  - API_URL=https://apihms.aurex.in
  - WS_URL=wss://apihms.aurex.in
  - NODE_ENV=production
```

---

## Monitoring & Logs

### View Container Status

```bash
# SSH into remote server
ssh subbu@hms.aurex.in

# Navigate to mobile directory
cd /opt/HMS/mobile

# Check container status
docker-compose ps

# View real-time logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f hms-mobile-web

# View last N lines
docker-compose logs --tail=100
```

### Log Files Location

- **Nginx Access Log**: `/opt/HMS/mobile/logs/nginx/access.log`
- **Nginx Error Log**: `/opt/HMS/mobile/logs/nginx/error.log`
- **Docker Logs**: `docker logs hms-mobile-web`

### Health Check

```bash
# Check container health
docker ps --filter "name=hms-mobile-web" --format "table {{.Names}}\t{{.Status}}"

# Perform health check
curl -k https://hms.aurex.in

# Check WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
  -H "Sec-WebSocket-Version: 13" \
  wss://apihms.aurex.in/ws
```

---

## Rollback Procedure

### Using Deployment Script

```bash
bash deploy.sh rollback
```

### Manual Rollback

```bash
ssh subbu@hms.aurex.in

cd /opt/HMS/mobile

# Stop current containers
docker-compose down

# Remove images
docker image rm hms-mobile-web:latest

# Rebuild from previous state (git checkout if needed)
git checkout HEAD~1

# Rebuild and restart
docker-compose up -d --build
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs hms-mobile-web

# Check for port conflicts
netstat -tlnp | grep :80
netstat -tlnp | grep :443

# Remove stale containers
docker-compose down --volumes
docker-compose up -d --build
```

### SSL/TLS Issues

```bash
# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -text -noout

# Verify Nginx SSL config
nginx -t

# Reload Nginx
docker-compose exec hms-mobile-web nginx -s reload
```

### Proxy Issues to Backend

```bash
# Test connectivity to backend
curl -k https://apihms.aurex.in/api/health

# Check Nginx proxy config
docker-compose exec hms-mobile-web cat /etc/nginx/conf.d/default.conf | grep -A 20 "location /api/"

# Check DNS resolution
nslookup apihms.aurex.in
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Check process list
docker top hms-mobile-web

# Monitor in real-time
docker stats --no-stream=false

# Check Nginx performance
docker-compose exec hms-mobile-web ps aux | grep nginx
```

---

## Performance Tuning

### Nginx Optimization

Located in `nginx.conf`:

```nginx
# Enable gzip compression
gzip on;
gzip_types text/plain text/css application/json;

# Cache static assets
location ~* ^.+\.(js|css|png|jpg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Buffer settings
proxy_buffer_size 4k;
proxy_buffers 8 4k;
proxy_busy_buffers_size 8k;
```

### Docker Optimization

In `docker-compose.yml`:

```yaml
# Memory limit
mem_limit: 512m
memswap_limit: 1g

# CPU limit
cpus: '1.0'

# Restart policy
restart_policy:
  condition: on-failure
  delay: 5s
  max_attempts: 3
```

---

## Security Considerations

### HTTPS/TLS

- ✅ SSL/TLS 1.2+ enforced
- ✅ Strong cipher suites configured
- ✅ HSTS header enabled
- ✅ Certificate pinning ready

### Security Headers

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

### API Proxy

- ✅ CORS headers configured
- ✅ Rate limiting ready
- ✅ Request validation enabled
- ✅ Error responses sanitized

---

## Maintenance

### Regular Tasks

#### Daily
- Monitor error logs
- Check health metrics
- Verify SSL certificate status

#### Weekly
- Review access logs
- Check disk usage
- Update security patches

#### Monthly
- Update dependencies
- Test rollback procedure
- Backup SSL certificates

#### Quarterly
- Security audit
- Performance review
- Capacity planning

### Updating the Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Verify deployment
docker-compose ps
curl -k https://hms.aurex.in
```

### Backup Procedures

```bash
# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz /opt/HMS/mobile/logs

# Backup SSL certificates
tar -czf ssl-backup-$(date +%Y%m%d).tar.gz /etc/letsencrypt/live/aurexcrt1

# Backup application
tar -czf app-backup-$(date +%Y%m%d).tar.gz /opt/HMS/mobile
```

---

## Contacts & Support

**Deployment Issues**: DevOps Team
**Technical Support**: Engineering Team
**Security Concerns**: Security Team

**Documentation**: https://docs.aurex.in/hms
**Status Page**: https://status.aurex.in
**Support Email**: support@aurex.in

---

## Deployment Checklist

- [ ] All tests passing locally
- [ ] Code reviewed and approved
- [ ] Security audit completed
- [ ] Performance benchmarks acceptable
- [ ] Documentation updated
- [ ] Deployment script tested locally
- [ ] SSH access verified
- [ ] Remote server disk space checked
- [ ] Backup taken
- [ ] Monitoring alerts configured
- [ ] On-call engineer notified
- [ ] Rollback procedure tested

---

## Post-Deployment

### Verification Steps

```bash
# 1. Verify frontend is accessible
curl -k https://hms.aurex.in

# 2. Verify backend connectivity
curl -k https://apihms.aurex.in/api/health

# 3. Check WebSocket connection
wscat -c wss://apihms.aurex.in/ws

# 4. Run smoke tests
npm run test:smoke

# 5. Monitor logs for errors
docker-compose logs -f --tail=100
```

### Announce Deployment

- Update status page
- Notify users if needed
- Send deployment confirmation email
- Log deployment in change management system

---

**Deployment Status**: ✅ **READY FOR PRODUCTION**

Last Updated: October 31, 2025
Version: 1.0.0
Next Review: December 31, 2025
