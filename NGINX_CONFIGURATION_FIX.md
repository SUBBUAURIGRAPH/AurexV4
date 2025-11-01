# NGINX Configuration Fix - HMS Production Deployment

**Date**: October 29, 2025
**Issue**: NGINX proxy not forwarding requests to HMS application
**Status**: 🔴 **CRITICAL - REQUIRES IMMEDIATE FIX**

---

## 🔴 Problem Description

When accessing https://hms.aurex.in, users are seeing the **default NGINX welcome page** instead of the HMS application.

**Root Cause**: The NGINX configuration file (`nginx-dlt.conf`) was not updated from the old DLT deployment. It's configured for:
- Domain: `dlt.aurigraph.io` (old)
- SSL Path: `/etc/nginx/ssl/` (wrong)
- Missing proper upstream configuration for HMS

**Expected**: NGINX should proxy requests to the HMS application running on port 9003

---

## 🔧 Solution

### Files Created/Updated

1. **nginx-hms.conf** (NEW)
   - Correct domain configuration for HMS
   - Proper SSL certificate paths
   - Correct upstream backend configuration
   - Frontend: `hms.aurex.in` → proxies to `hms-j4c-agent:9003`
   - API: `apihms.aurex.in` → proxies to `hms-j4c-agent:9003`

2. **docker-compose.hms.yml** (UPDATED)
   - Changed: `./nginx-dlt.conf` → `./nginx-hms.conf`
   - Changed: `/etc/letsencrypt/live/aurcrt` → `/etc/letsencrypt/live/aurexcrt1`

3. **fix-nginx-production.sh** (NEW)
   - Automated fix script for production server
   - Handles SSH deployment and verification

---

## 🚀 How to Fix (Two Options)

### Option 1: Automated Fix (Recommended)

```bash
# On your local machine:
cd /c/subbuworking/HMS

# Run the automated fix script:
./fix-nginx-production.sh hms.aurex.in subbu

# The script will:
# 1. Upload the new nginx-hms.conf
# 2. Backup old configuration
# 3. Update docker-compose.hms.yml
# 4. Restart NGINX container
# 5. Verify the fix
```

### Option 2: Manual Fix

```bash
# SSH to production server:
ssh subbu@hms.aurex.in

# Navigate to HMS directory:
cd /opt/HMS

# Copy new configuration from local:
# (from your local machine)
scp nginx-hms.conf subbu@hms.aurex.in:/opt/HMS/

# On the server:
cd /opt/HMS

# Backup old configuration:
cp nginx-dlt.conf nginx-dlt.conf.backup.$(date +%Y%m%d_%H%M%S)

# Update docker-compose.hms.yml:
sed -i 's|./nginx-dlt.conf:|./nginx-hms.conf:|g' docker-compose.hms.yml
sed -i 's|/etc/letsencrypt/live/aurcrt:|/etc/letsencrypt/live/aurexcrt1:|g' docker-compose.hms.yml

# Restart NGINX:
docker-compose -f docker-compose.hms.yml stop nginx-proxy
docker rm -f hms-nginx-proxy
docker-compose -f docker-compose.hms.yml up -d nginx-proxy

# Verify:
docker logs hms-nginx-proxy
```

---

## ✅ Verification

After applying the fix, verify it worked:

```bash
# Test frontend:
curl -k https://hms.aurex.in/health
# Should return: "HMS Agent - OK"

# Test API:
curl -k https://apihms.aurex.in/health
# Should return: "HMS API - OK"

# In browser:
# https://hms.aurex.in - Should show HMS application (not nginx page)
# https://apihms.aurex.in/health - Should show "HMS API - OK"
```

---

## 📋 What Changed

### nginx-hms.conf Key Differences

| Aspect | Old (nginx-dlt.conf) | New (nginx-hms.conf) |
|--------|----------------------|----------------------|
| **Domain** | dlt.aurigraph.io | hms.aurex.in, apihms.aurex.in |
| **Upstream** | j4c-agent:9003 | j4c-agent:9003 |
| **SSL Path** | /etc/nginx/ssl/ | /etc/letsencrypt/live/aurexcrt1/ |
| **Server Blocks** | 1 | 2 (frontend + API) |
| **Proxy Target** | / → j4c_backend | / → hms_backend |
| **CORS** | Not configured | Properly configured for API |

### New NGINX Configuration Structure

```
Frontend (hms.aurex.in)
├── Health: /health → "HMS Agent - OK"
├── Root: / → hms-j4c-agent:9003
├── API: /api/* → hms-j4c-agent:9003
├── Metrics: /prometheus/ (protected)
└── Dashboards: /grafana/

API (apihms.aurex.in)
├── Health: /health → "HMS API - OK"
├── Root: / → hms-j4c-agent:9003
├── CORS: Properly configured
└── OPTIONS: Preflight handling
```

---

## 🔒 Security Considerations

The new configuration includes:

1. **SSL/TLS**: TLS 1.2 and 1.3
2. **Security Headers**:
   - Strict-Transport-Security (HSTS)
   - X-Frame-Options
   - X-Content-Type-Options
   - X-XSS-Protection
   - Content-Security-Policy

3. **Rate Limiting**:
   - API endpoints: 100 req/s
   - General endpoints: 10 req/s

4. **CORS Protection** (API only):
   - Allows cross-origin requests
   - OPTIONS preflight handling

5. **File Security**:
   - Denies access to hidden files (.*)
   - Denies access to backup files (*~)

---

## 📊 Health Check Endpoints

After fix, these endpoints should be available:

```bash
# Frontend health
GET https://hms.aurex.in/health
Response: "HMS Agent - OK"
HTTP: 200

# API health
GET https://apihms.aurex.in/health
Response: "HMS API - OK"
HTTP: 200

# NGINX internal metrics
GET http://localhost:8080/metrics
Response: "nginx_up 1"
```

---

## 🔄 Rollback Instructions

If something goes wrong, rollback is easy:

```bash
# On production server:
cd /opt/HMS

# Restore old configuration:
cp nginx-dlt.conf.backup.* nginx-dlt.conf

# Update docker-compose:
sed -i 's|./nginx-hms.conf:|./nginx-dlt.conf:|g' docker-compose.hms.yml
sed -i 's|/etc/letsencrypt/live/aurexcrt1:|/etc/letsencrypt/live/aurcrt:|g' docker-compose.hms.yml

# Restart NGINX:
docker rm -f hms-nginx-proxy
docker-compose -f docker-compose.hms.yml up -d nginx-proxy
```

---

## 📝 Files Modified

### Local Repository Changes:
```
MODIFIED: docker-compose.hms.yml
CREATED:  nginx-hms.conf
CREATED:  fix-nginx-production.sh
CREATED:  NGINX_CONFIGURATION_FIX.md
```

### Production Server Changes (after running fix):
```
CREATED:  nginx-hms.conf (uploaded)
CREATED:  nginx-dlt.conf.backup.YYYYMMDD_HHMMSS
MODIFIED: docker-compose.hms.yml
RESTARTED: hms-nginx-proxy (container)
```

---

## 🐛 Troubleshooting

### Still seeing nginx default page?
```bash
# Check NGINX logs:
docker logs hms-nginx-proxy | tail -50

# Verify configuration:
docker exec hms-nginx-proxy nginx -t

# Check upstream connectivity:
docker exec hms-nginx-proxy curl -v http://hms-j4c-agent:9003/health
```

### 502 Bad Gateway Error?
- HMS application may not be running
- Check: `docker ps` should show `hms-j4c-agent` running
- Check logs: `docker logs hms-j4c-agent`

### SSL Certificate Error?
- Verify SSL path: `ls -la /etc/letsencrypt/live/aurexcrt1/`
- Should exist: `fullchain.pem` and `privkey.pem`
- If missing, check Certbot: `sudo certbot certificates`

### Connection Refused?
- Verify NGINX is running: `docker ps | grep nginx`
- Check ports: `netstat -tlnp | grep -E ':(80|443)'`
- Restart: `docker-compose restart nginx-proxy`

---

## 📞 Support

For issues with the fix:

1. **Check logs**:
   - NGINX: `docker logs hms-nginx-proxy`
   - HMS: `docker logs hms-j4c-agent`
   - Docker: `docker compose logs`

2. **Verify services**:
   - `docker ps` should show all containers running
   - `docker network inspect hms-network` should show all services

3. **Test connectivity**:
   - `curl -k https://hms.aurex.in/health`
   - `curl -k https://apihms.aurex.in/health`

4. **Rollback if needed**:
   - Run rollback commands above
   - Services should be back to old configuration

---

## ✅ Verification Checklist

After applying fix, verify:

- [ ] NGINX container is running: `docker ps | grep nginx`
- [ ] HMS agent container is running: `docker ps | grep hms-j4c-agent`
- [ ] Frontend health check works: `curl -k https://hms.aurex.in/health`
- [ ] API health check works: `curl -k https://apihms.aurex.in/health`
- [ ] NGINX configuration is valid: `docker exec hms-nginx-proxy nginx -t`
- [ ] Can access https://hms.aurex.in in browser (shows app, not nginx page)
- [ ] Grafana works: https://hms.aurex.in/grafana/
- [ ] Prometheus works: https://hms.aurex.in/prometheus/ (requires auth)

---

## 📅 Timeline

- **October 29, 2025 07:45 UTC**: HMS deployed to production
- **October 29, 2025 ~08:45 UTC**: Issue discovered (NGINX showing default page)
- **October 29, 2025 08:50 UTC**: Fix identified (wrong NGINX config)
- **October 29, 2025 08:55 UTC**: Fix implemented (nginx-hms.conf created)
- **Now**: Ready to apply fix to production

---

## 🎯 Next Steps

1. **Apply the fix** using one of the methods above
2. **Verify** using the health check endpoints
3. **Test** by accessing https://hms.aurex.in in browser
4. **Monitor** logs for any issues: `docker logs -f hms-nginx-proxy`

---

**Status**: 🟡 **PENDING FIX APPLICATION**
**Priority**: 🔴 **CRITICAL**
**Estimated Time**: 5-10 minutes

Once applied, should fully resolve the issue.

