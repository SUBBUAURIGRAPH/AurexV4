# Production Configuration Setup Guide

**Date**: October 27, 2025
**Status**: Configuration Ready
**Environment**: dlt.aurigraph.io (Production)

---

## Overview

This guide covers the configuration steps needed to fully activate the J4C Agent Plugin production deployment. The `.env` file has been uploaded to `/opt/DLT/.env` on the remote server with placeholder values that need to be replaced with actual credentials.

---

## Quick Setup (5-10 minutes)

### Step 1: Access Remote Server

```bash
ssh -p 22 subbu@dlt.aurigraph.io
```

### Step 2: Edit Configuration File

```bash
# Navigate to deployment folder
cd /opt/DLT

# Open .env file for editing
nano .env
```

### Step 3: Replace Placeholder Values

Replace these placeholders with actual values:

```env
# Database Password (generate secure password)
DATABASE_PASSWORD=CHANGE_ME_SECURE_PASSWORD_HERE

# HubSpot CRM API Key
HUBSPOT_API_KEY=CHANGE_ME_YOUR_HUBSPOT_API_KEY_HERE

# Jira API Key & Email
JIRA_API_KEY=CHANGE_ME_YOUR_JIRA_API_KEY_HERE
JIRA_USER_EMAIL=CHANGE_ME_YOUR_JIRA_EMAIL_HERE

# GitHub Token
GITHUB_TOKEN=CHANGE_ME_YOUR_GITHUB_TOKEN_HERE

# Grafana Admin Password (generate secure password)
GRAFANA_ADMIN_PASSWORD=CHANGE_ME_SECURE_GRAFANA_PASSWORD_HERE

# Session & JWT Secrets (generate random strings)
SESSION_SECRET=CHANGE_ME_GENERATE_RANDOM_SESSION_SECRET_HERE
JWT_SECRET=CHANGE_ME_GENERATE_RANDOM_JWT_SECRET_HERE
```

### Step 4: Save & Exit

Press `Ctrl+X`, then `Y`, then `Enter` to save in nano editor.

### Step 5: Verify Configuration

```bash
# Check file was saved correctly
cat /opt/DLT/.env | head -20

# Verify file permissions
ls -la /opt/DLT/.env
```

### Step 6: Restart Services

```bash
# Restart all containers to apply new configuration
docker-compose -f /opt/DLT/docker-compose.yml restart

# Verify services are running
docker ps

# Check logs for any configuration errors
docker logs j4c-agent-plugin
docker logs j4c-grafana
docker logs j4c-nginx-proxy
```

---

## Detailed Configuration Guide

### Database Configuration

The database is PostgreSQL running in Docker with these defaults:

```env
DATABASE_HOST=j4c-postgres      # Docker service name
DATABASE_PORT=5432             # PostgreSQL default port
DATABASE_NAME=j4c_agents        # Database name
DATABASE_USER=j4c_admin         # Username
DATABASE_PASSWORD=***           # ⚠️ MUST CHANGE THIS
```

**To generate a secure password:**

```bash
# Option 1: Using openssl
openssl rand -base64 32

# Option 2: Using /dev/urandom
head -c 32 /dev/urandom | base64

# Copy the output and paste into .env DATABASE_PASSWORD field
```

### API Keys Setup

#### HubSpot Integration

1. Go to https://app.hubspot.com/
2. Navigate to Settings → API Keys
3. Create or copy existing API key
4. Paste into `.env` as `HUBSPOT_API_KEY`

#### Jira Integration

1. Go to https://aurigraphdlt.atlassian.net
2. Navigate to Account Settings → Security → API tokens
3. Create new API token (or use existing one)
4. Set `JIRA_API_KEY` and `JIRA_USER_EMAIL`

**Note**: JIRA_USER_EMAIL should be the Atlassian account email (typically `sjoish12@gmail.com` or your registered email)

#### GitHub Integration

1. Go to https://github.com/settings/tokens
2. Create new Personal Access Token (classic)
3. Required scopes:
   - `repo` - Full control of private repositories
   - `admin:repo_hook` - Full control of repository hooks
4. Paste token into `.env` as `GITHUB_TOKEN`

### Security Credentials

#### Generate Session Secret

```bash
# Generate 32-character random string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Generate JWT Secret

```bash
# Generate 64-character random string
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

#### Grafana Admin Password

Generate a secure password:

```bash
# Option: Using openssl
openssl rand -base64 24

# Then set GRAFANA_ADMIN_PASSWORD in .env
```

---

## Service Configuration

### J4C Agent Plugin Service

**Port**: 9003 (internal), exposed through NGINX
**Environment**: Production
**Memory**: 512MB allocated
**Health Check**: HTTP GET to `/health` endpoint

### NGINX Reverse Proxy

**Ports**:
- HTTP (80) → Redirects to HTTPS
- HTTPS (443) → Encrypted traffic

**SSL Certificates**:
- Certificate: `/etc/letsencrypt/live/aurcrt/fullchain.pem`
- Key: `/etc/letsencrypt/live/aurcrt/privkey.pem`

**Security Headers** (automatically applied):
- HSTS (Strict-Transport-Security)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Content-Security-Policy with font support

### PostgreSQL Database

**Port**: 5432 (internal), not exposed directly
**Volume**: `/var/lib/postgresql/data` (persistent)
**Backups**: Configure via cron job (see backup section below)

### Prometheus Monitoring

**Port**: 9090
**Scrape Interval**: 15 seconds
**Retention**: 15 days

**Monitored Metrics**:
- J4C Agent plugin performance
- NGINX request metrics
- PostgreSQL database metrics
- System resource utilization

### Grafana Dashboards

**Port**: 3000
**Default Username**: admin
**Default Password**: ⚠️ MUST CHANGE in .env

**Initial Setup**:

1. Access at https://dlt.aurigraph.io:3000
2. Login with admin / (password from GRAFANA_ADMIN_PASSWORD)
3. Add Prometheus data source:
   - URL: `http://j4c-prometheus:9090`
   - Access: Browser
4. Import dashboards (see "Setup Monitoring" section)

---

## Configuration Verification

After applying configuration, verify each component:

### 1. Check Environment Variables Loaded

```bash
# SSH to server
ssh -p 22 subbu@dlt.aurigraph.io

# Verify .env file
cat /opt/DLT/.env | grep -E "^[A-Z_]+=" | head -10
```

### 2. Verify Database Connection

```bash
# Connect to PostgreSQL from server
docker exec j4c-postgres psql -U j4c_admin -d j4c_agents -c "SELECT version();"
```

### 3. Check Service Logs

```bash
# View J4C Agent logs
docker logs j4c-agent-plugin | tail -20

# View NGINX logs
docker logs j4c-nginx-proxy | tail -20

# View Grafana logs
docker logs j4c-grafana | tail -20
```

### 4. Test HTTPS Connection

```bash
# From your local machine
curl -I https://dlt.aurigraph.io/

# Should return:
# HTTP/2 200 (or similar success code)
```

### 5. Verify SSL Certificate

```bash
# Check certificate validity
curl --insecure -I https://dlt.aurigraph.io/ | grep -i "X-"
```

---

## Next Steps After Configuration

### Immediate (Today)

- [ ] Update all environment variables in `.env`
- [ ] Restart services: `docker-compose restart`
- [ ] Verify services are healthy: `docker ps`
- [ ] Test HTTPS connection: `curl https://dlt.aurigraph.io`

### This Week

- [ ] Set up Grafana dashboards (see MONITORING_SETUP.md)
- [ ] Configure Prometheus alerts
- [ ] Test database backups
- [ ] Verify API integrations (HubSpot, Jira, GitHub)

### This Month

- [ ] Set up automated backups
- [ ] Create monitoring alerts
- [ ] Run disaster recovery drill
- [ ] Document custom configurations
- [ ] Set up log aggregation

---

## Troubleshooting Configuration Issues

### Issue: Services won't start after .env update

**Solution**:
```bash
# Check for syntax errors
docker exec j4c-agent-plugin env | grep -E "^(NODE|DATABASE|PORT)"

# Restart with debug output
docker-compose logs j4c-agent-plugin --follow
```

### Issue: Database connection refused

**Solution**:
```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# Check connection string
docker exec j4c-agent-plugin echo $DATABASE_HOST

# Test connection manually
docker exec j4c-postgres psql -U j4c_admin -d j4c_agents -c "SELECT 1;"
```

### Issue: API keys not working

**Solution**:
```bash
# Verify keys are loaded
docker exec j4c-agent-plugin env | grep "API_KEY"

# Check for special characters in keys
# If key contains special chars, wrap in single quotes in .env
```

### Issue: HTTPS certificate errors

**Solution**:
```bash
# Check certificate file exists
ls -la /etc/letsencrypt/live/aurcrt/

# Verify NGINX config references correct paths
grep -n "ssl_certificate" /opt/DLT/nginx-dlt.conf

# Test NGINX config syntax
docker exec j4c-nginx-proxy nginx -t
```

---

## Security Best Practices

### 1. Protect .env File

```bash
# Ensure only owner can read
chmod 600 /opt/DLT/.env

# Verify permissions
ls -la /opt/DLT/.env
# Should show: -rw------- (600)
```

### 2. Rotate API Keys Regularly

- HubSpot: Every 90 days
- GitHub: Every 6 months
- Jira: Every 90 days

### 3. Monitor for Exposed Credentials

```bash
# Never commit .env to git
cat /opt/DLT/.gitignore
# Should contain: .env
```

### 4. Backup Credentials Securely

```bash
# Create encrypted backup
gpg --symmetric /opt/DLT/.env
# Creates: /opt/DLT/.env.gpg

# Restore from backup
gpg -d /opt/DLT/.env.gpg > /opt/DLT/.env
```

---

## Environment Variables Reference

| Variable | Purpose | Type | Example |
|----------|---------|------|---------|
| `NODE_ENV` | Runtime environment | string | "production" |
| `PORT` | J4C service port | number | 9003 |
| `DATABASE_HOST` | PostgreSQL hostname | string | "j4c-postgres" |
| `DATABASE_PASSWORD` | DB password (SECURE) | string | "xK9...Lq2" |
| `HUBSPOT_API_KEY` | HubSpot integration | string | "pat-na1-..." |
| `JIRA_API_KEY` | Jira API token | string | "ATATT..." |
| `GITHUB_TOKEN` | GitHub access token | string | "ghp_..." |
| `GRAFANA_ADMIN_PASSWORD` | Grafana login | string | "mK7...9Px" |
| `SESSION_SECRET` | Session encryption | string | Random 32 chars |
| `JWT_SECRET` | JWT signing key | string | Random 64 chars |
| `ENABLE_HTTPS` | Force HTTPS | boolean | true |
| `ENABLE_GNN_OPTIMIZATION` | GNN system | boolean | true |

---

## Monitoring Configuration Updates

After each configuration change, monitor:

1. **Service Health**: `docker ps` - All containers should show "Up"
2. **Logs**: `docker logs [service]` - No ERROR level messages
3. **Performance**: Check Grafana dashboards for anomalies
4. **Connectivity**: `curl https://dlt.aurigraph.io/health` - Should return 200

---

**Configuration Setup Status**: ✅ READY FOR MANUAL CREDENTIAL ENTRY
**Next Phase**: Monitoring Setup (see MONITORING_SETUP.md)

