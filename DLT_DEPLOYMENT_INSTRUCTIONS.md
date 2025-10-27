# J4C Agent Plugin Deployment to DLT Server

**Target**: dlt.aurigraph.io
**Date**: October 27, 2025
**Version**: 1.0.0
**Status**: Ready for Deployment

---

## Overview

This document describes the deployment of the J4C Agent Plugin to the DLT server using Docker Compose with NGINX reverse proxy, SSL/TLS, and optional monitoring services.

### What's Being Deployed

- **J4C Agent Plugin v1.0.0** - Main application
- **NGINX Reverse Proxy** - With SSL/TLS and CSP headers fixed
- **PostgreSQL 15** - Database (optional)
- **Prometheus** - Metrics collection (optional)
- **Grafana** - Monitoring dashboard (optional)

### Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│              Internet (HTTPS)                        │
│         dlt.aurigraph.io:443/80                      │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │   NGINX Reverse Proxy   │
        │  - SSL/TLS (Let's Enc)  │
        │  - CSP Headers Fixed    │
        │  - Rate Limiting        │
        │  - Security Headers     │
        └────────────┬────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
┌────▼────┐  ┌─────▼──────┐  ┌────▼──────┐
│  J4C    │  │ Prometheus │  │  Grafana  │
│ Agent   │  │  :9090     │  │  :3000    │
│ :9003   │  │            │  │           │
└────┬────┘  └─────┬──────┘  └────┬──────┘
     │             │              │
     └─────────────┼──────────────┘
                   │
         ┌─────────▼──────────┐
         │   PostgreSQL 15    │
         │     :5432          │
         └────────────────────┘
```

---

## Prerequisites

✅ SSH access to dlt.aurigraph.io as `subbu`
✅ Docker installed (v28.5.1+)
✅ SSL certificates at `/etc/letsencrypt/live/aurcrt/`
✅ `/opt/DLT` directory exists
✅ Docker containers/volumes cleaned up

---

## Files Included

### Core Deployment Files

| File | Purpose | Size |
|------|---------|------|
| `deploy-j4c-to-dlt.sh` | Main deployment script | 7.5 KB |
| `docker-compose.dlt-deployment.yml` | Docker services configuration | 6.2 KB |
| `nginx-dlt.conf` | NGINX reverse proxy config | 8.9 KB |
| `prometheus-dlt.yml` | Prometheus scrape config | 1.2 KB |

### Plugin Files

| Directory | Contents |
|-----------|----------|
| `plugin/` | J4C Agent Plugin source code |
| `plugin/index.js` | Main entry point |
| `plugin/j4c-cli.js` | CLI interface |
| `plugin/hubspot-integration.js` | HubSpot CRM integration |
| `plugin/package.json` | Dependencies |

### Configuration & Documentation

| File | Purpose |
|------|---------|
| `APPLY_NGINX_FIX_LOCALLY.md` | Manual NGINX CSP fix instructions |
| `DLT_DEPLOYMENT_INSTRUCTIONS.md` | This file |

---

## Quick Deployment (Automated)

### Step 1: Copy Deployment Script

```bash
# From your local machine
scp /Users/subbujois/subbuworkingdir/Aurex/glowing-adventure/deploy-j4c-to-dlt.sh \
    subbu@dlt.aurigraph.io:/opt/DLT/

# SSH to server
ssh subbu@dlt.aurigraph.io
```

### Step 2: Execute Deployment

```bash
cd /opt/DLT
chmod +x deploy-j4c-to-dlt.sh
./deploy-j4c-to-dlt.sh
```

**Expected Duration**: 3-5 minutes

### Step 3: Configure Environment Variables

```bash
# Edit .env file
nano /opt/DLT/.env

# Required variables to set:
HUBSPOT_API_KEY=your_key
HUBSPOT_PORTAL_ID=your_portal_id
JIRA_API_KEY=your_key
GITHUB_TOKEN=your_token
SLACK_WEBHOOK_URL=your_webhook
DB_PASSWORD=change_me
GRAFANA_PASSWORD=change_me

# Save and exit (Ctrl+X, Y, Enter)
```

### Step 4: Restart Services

```bash
cd /opt/DLT
docker-compose restart
docker-compose ps
```

### Step 5: Verify Deployment

```bash
# Check services are running
docker-compose ps

# Check logs
docker-compose logs j4c-agent

# Test HTTPS connection
curl -k -I https://localhost/health
```

---

## Manual Deployment (Step-by-Step)

If the automated script doesn't work, follow these manual steps:

### Step 1: Upload Configuration Files

```bash
# From local machine
scp docker-compose.dlt-deployment.yml subbu@dlt.aurigraph.io:/opt/DLT/docker-compose.yml
scp nginx-dlt.conf subbu@dlt.aurigraph.io:/opt/DLT/nginx.conf
scp prometheus-dlt.yml subbu@dlt.aurigraph.io:/opt/DLT/prometheus.yml
```

### Step 2: Upload Plugin Files

```bash
# Upload plugin directory
scp -r plugin/ subbu@dlt.aurigraph.io:/opt/DLT/
```

### Step 3: Create Environment File

```bash
# SSH to server
ssh subbu@dlt.aurigraph.io

# Create .env file
cat > /opt/DLT/.env << 'EOF'
NODE_ENV=production
PORT=9003
LOG_LEVEL=info
HUBSPOT_API_KEY=
HUBSPOT_PORTAL_ID=
JIRA_URL=https://aurigraphdlt.atlassian.net
JIRA_API_KEY=
GITHUB_TOKEN=
SLACK_WEBHOOK_URL=
DB_USER=j4c_user
DB_PASSWORD=change_me
DB_NAME=j4c_db
GRAFANA_PASSWORD=change_me
EOF
```

### Step 4: Start Docker Compose

```bash
cd /opt/DLT
docker-compose up -d
```

### Step 5: Verify Services

```bash
docker-compose ps
docker-compose logs j4c-agent
```

---

## Services Configuration

### J4C Agent Plugin

**Port**: 9003
**Image**: node:18-alpine
**Volumes**:
- `./plugin:/app` - Plugin source code
- `j4c-logs:/app/logs` - Application logs

**Environment**:
- NODE_ENV=production
- PORT=9003
- All integration credentials

**Health Check**:
- HTTP GET to http://localhost:9003
- Every 30 seconds
- 3 retries before unhealthy

### NGINX Reverse Proxy

**Ports**:
- HTTP (80) → HTTPS redirect
- HTTPS (443) → Listening

**Features**:
- ✅ SSL/TLS with Let's Encrypt
- ✅ CSP headers fixed for fonts
- ✅ Security headers (HSTS, X-Frame-Options, etc.)
- ✅ Rate limiting
- ✅ Gzip compression
- ✅ Static file caching
- ✅ WebSocket support
- ✅ Protected Prometheus access

**Configuration**:
- SSL Cert: `/etc/letsencrypt/live/aurcrt/fullchain.pem`
- SSL Key: `/etc/letsencrypt/live/aurcrt/privkey.pem`

### PostgreSQL

**Port**: 5432
**Image**: postgres:15-alpine
**Database**: j4c_db
**User**: j4c_user
**Volume**: j4c-postgres-data

**Note**: Optional - can be disabled if not needed

### Prometheus

**Port**: 9090
**Image**: prom/prometheus:latest
**Volume**: j4c-prometheus-data
**Scrape Interval**: 15s

**Targets**:
- J4C Agent (:9003)
- NGINX (:8080/status)
- PostgreSQL
- Prometheus self-monitoring

### Grafana

**Port**: 3000
**Image**: grafana/grafana:latest
**Volume**: j4c-grafana-data
**Admin Password**: Set in .env (GRAFANA_PASSWORD)

**Note**: Optional - can be disabled if not needed

---

## SSL/TLS Configuration

### Certificate Details

```
Location: /etc/letsencrypt/live/aurcrt/
Files:
  - fullchain.pem (certificate chain)
  - privkey.pem (private key)
```

### NGINX SSL Configuration

```nginx
ssl_certificate /etc/nginx/ssl/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
```

### Certificate Renewal

The certificates will be managed by Let's Encrypt. To renew:

```bash
ssh subbu@dlt.aurigraph.io

# Check certificate expiration
openssl x509 -enddate -noout -in /etc/letsencrypt/live/aurcrt/fullchain.pem

# Manual renewal (if needed)
sudo certbot renew

# Reload NGINX
docker-compose exec nginx-proxy nginx -s reload
```

---

## CSP Headers Configuration

### Issue Fixed

**Problem**: Fonts not loading (data URI blocked)
**Error**: `Refused to load the font 'data:font/woff2;base64,...'`
**Solution**: Updated CSP header in NGINX

### Header Used

```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none';" always;
```

### What This Allows

- ✅ Fonts from data URIs (fixes the issue)
- ✅ Inline scripts and styles (for frameworks)
- ✅ Images from data URIs
- ✅ External HTTPS connections
- ✅ Same-origin resources
- ✅ No frame embedding (security)

---

## Accessing Services

### J4C Agent API

**URL**: https://dlt.aurigraph.io/api/v1
**Protocol**: HTTPS
**Port**: 443 (reverse proxied through NGINX)

**Endpoints**:
- `GET /health` - Health check
- `GET /agents/list` - List all agents
- `GET /skills/list` - List all skills
- `POST /invoke` - Invoke agent/skill
- `GET /status` - System status

### Prometheus Metrics

**URL**: https://dlt.aurigraph.io/prometheus/
**Auth**: Username/password (set in NGINX config)
**Port**: 443 (reverse proxied from 9090)

### Grafana Dashboards

**URL**: https://dlt.aurigraph.io/grafana/
**Port**: 443 (reverse proxied from 3000)
**Username**: admin
**Password**: Set in .env (GRAFANA_PASSWORD)

---

## Management Commands

### Check Status

```bash
cd /opt/DLT
docker-compose ps
```

### View Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs j4c-agent
docker-compose logs nginx-proxy
docker-compose logs postgres

# Follow logs in real-time
docker-compose logs -f j4c-agent
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart j4c-agent
docker-compose restart nginx-proxy
```

### Stop Services

```bash
# Stop all
docker-compose stop

# Stop specific service
docker-compose stop j4c-agent
```

### Remove Containers (Keep Volumes)

```bash
docker-compose down
```

### Remove Everything

```bash
# ⚠️ WARNING: This removes containers AND volumes
docker-compose down -v
```

---

## Troubleshooting

### Services Won't Start

**Check Docker daemon**:
```bash
systemctl status docker
sudo systemctl restart docker
```

**Check configuration files**:
```bash
cd /opt/DLT
docker-compose config
```

**Check logs**:
```bash
docker-compose logs
```

### HTTPS Connection Issues

**Check SSL certificates**:
```bash
ls -la /etc/letsencrypt/live/aurcrt/
openssl x509 -text -noout -in /etc/letsencrypt/live/aurcrt/fullchain.pem
```

**Test HTTPS**:
```bash
curl -k -v https://localhost/health
```

### J4C Agent Not Responding

**Check container**:
```bash
docker-compose ps j4c-agent
docker-compose logs j4c-agent
```

**Check port**:
```bash
docker-compose exec j4c-agent netstat -tlnp | grep 9003
```

**Restart service**:
```bash
docker-compose restart j4c-agent
docker-compose logs -f j4c-agent
```

### Database Connection Issues

**Check PostgreSQL**:
```bash
docker-compose exec postgres psql -U j4c_user -d j4c_db -c "\l"
```

**Reset database** (if needed):
```bash
docker-compose stop postgres
docker volume rm j4c-postgres-data
docker-compose up -d postgres
```

### NGINX Configuration Issues

**Test NGINX configuration**:
```bash
docker-compose exec nginx-proxy nginx -t
```

**Reload NGINX**:
```bash
docker-compose exec nginx-proxy nginx -s reload
```

### Port Conflicts

**Check port usage**:
```bash
netstat -tlnp | grep -E '80|443|9003|5432|9090|3000'
```

**Change ports** (in docker-compose.yml):
```yaml
ports:
  - "8080:80"  # Change from 80
  - "8443:443" # Change from 443
```

---

## Performance Monitoring

### Check Resource Usage

```bash
docker stats
```

### Prometheus Queries

Access Prometheus at https://dlt.aurigraph.io/prometheus/

Useful queries:
```
up                    # Service availability
container_memory_usage_bytes  # Memory usage
container_cpu_usage_seconds_total  # CPU usage
rate(container_cpu_usage_seconds_total[5m])  # CPU rate
```

### Grafana Dashboards

Create dashboards in Grafana at https://dlt.aurigraph.io/grafana/

Data source: Prometheus (http://prometheus:9090)

---

## Security Best Practices

### 1. Update Secrets

```bash
# SSH to server
ssh subbu@dlt.aurigraph.io

# Edit .env
nano /opt/DLT/.env

# Change these values:
DB_PASSWORD=<strong_password>
GRAFANA_PASSWORD=<strong_password>
HUBSPOT_API_KEY=<actual_key>
JIRA_API_KEY=<actual_key>
GITHUB_TOKEN=<actual_token>
SLACK_WEBHOOK_URL=<actual_url>
```

### 2. Enable Firewall

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 3. Backup Configuration

```bash
# Backup important files
cd /opt/DLT
tar -czf backup-$(date +%s).tar.gz docker-compose.yml .env nginx.conf prometheus.yml
```

### 4. Monitor Logs

```bash
# Monitor for suspicious activity
tail -f /var/log/auth.log  # SSH access
docker-compose logs | grep ERROR  # Application errors
```

---

## Backup & Recovery

### Create Backup

```bash
cd /opt/DLT

# Backup configuration
tar -czf backup-config-$(date +%s).tar.gz docker-compose.yml .env nginx.conf prometheus.yml

# Backup volumes
docker run --rm -v j4c-postgres-data:/data -v $(pwd):/backup alpine tar -czf /backup/backup-postgres-$(date +%s).tar.gz -C / data
```

### Restore from Backup

```bash
# Restore configuration
tar -xzf backup-config-*.tar.gz

# Restore volumes
docker run --rm -v j4c-postgres-data:/data -v $(pwd):/backup alpine tar -xzf /backup/backup-postgres-*.tar.gz -C /

# Restart services
docker-compose up -d
```

---

## Testing & Verification

### Test HTTPS

```bash
# From any machine
curl -I https://dlt.aurigraph.io/

# Expected: 200 OK with security headers
```

### Test J4C Agent

```bash
# Check API endpoint
curl https://dlt.aurigraph.io/api/v1/agents/list

# Expected: JSON list of agents
```

### Test Database

```bash
# From server
docker-compose exec postgres psql -U j4c_user -d j4c_db -c "SELECT version();"
```

### Test Metrics

```bash
# From server
curl http://localhost:9090/api/v1/targets
```

---

## Maintenance Schedule

### Daily

- Check service health: `docker-compose ps`
- Monitor logs for errors: `docker-compose logs | grep ERROR`

### Weekly

- Review resource usage: `docker stats`
- Check Prometheus metrics
- Review Grafana dashboards

### Monthly

- Update Docker images: `docker-compose pull && docker-compose up -d`
- Check certificate expiration
- Review security logs

### Quarterly

- Full backup: `tar -czf backup-full-$(date +%s).tar.gz -C /opt/DLT .`
- Test recovery procedure
- Performance review

---

## Support & Documentation

### Quick Links

- **J4C Agent Docs**: `/opt/DLT/plugin/J4C_AGENT_PLUGIN.md`
- **HubSpot Integration**: `/opt/DLT/plugin/HUBSPOT_INTEGRATION.md`
- **Deployment Guide**: `J4C_DEPLOYMENT_GUIDE.md`
- **NGINX Fix**: `NGINX_CSP_FIX.md`

### Common Issues

For troubleshooting, see **Troubleshooting** section above.

### Getting Help

1. Check logs: `docker-compose logs`
2. Check Docker status: `docker-compose ps`
3. Check configuration: `docker-compose config`
4. Review documentation files
5. Check remote Git: https://github.com/Aurigraph-DLT-Corp/glowing-adventure

---

## Summary

The J4C Agent Plugin is now ready for deployment on dlt.aurigraph.io with:

✅ Full Docker Compose stack
✅ NGINX reverse proxy with SSL/TLS
✅ Fixed CSP headers for font loading
✅ Production security headers
✅ Database support (PostgreSQL)
✅ Monitoring (Prometheus/Grafana)
✅ Automated deployment script
✅ Comprehensive documentation

**Deploy with**: `./deploy-j4c-to-dlt.sh`

**Access at**: https://dlt.aurigraph.io

---

**Document**: DLT_DEPLOYMENT_INSTRUCTIONS.md
**Version**: 1.0.0
**Date**: October 27, 2025

