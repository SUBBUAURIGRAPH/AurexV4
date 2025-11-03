# NGINX Proxy & Security Fixes - Quick Start Guide
## HMS v2.2.0 - November 3, 2025

---

## What's Been Fixed

### 1. NGINX Proxy Configuration ✅
- **File**: `nginx-hms-production.conf`
- **Issues Fixed**:
  - Added comprehensive error handling for upstream failures
  - Implemented proper keepalive connections (32 workers)
  - Added HTTP/2 server push hints for static assets
  - Fixed proxy headers (X-Forwarded-*, X-Correlation-ID)
  - Optimized buffer sizes for different request types
  - Added separate upstream blocks for HTTP and gRPC

### 2. CORS Implementation ✅
- **Files**:
  - `nginx-hms-production.conf` (NGINX level CORS)
  - `backend/src/app.ts` (Express level CORS)
- **Issues Fixed**:
  - Implemented whitelist-based origin validation (no wildcards)
  - Added CORS preflight handler (OPTIONS) at NGINX level
  - Added dynamic origin validation in Express based on environment
  - Exposed correlation ID and rate limit headers
  - Proper CORS header caching (maxAge: 86400)
  - Support for credentials in CORS requests

### 3. HTTPS/TLS Configuration ✅
- **File**: `nginx-hms-production.conf` (lines 142-160)
- **Issues Fixed**:
  - Enforced TLS 1.3 and 1.2 only (disabled 1.0, 1.1)
  - Configured modern cipher suites with AEAD modes
  - Added OCSP stapling for faster TLS handshakes
  - Enabled HTTP Strict Transport Security (HSTS)
  - Configured session caching and timeout
  - Added certificate chain verification
  - Automatic Let's Encrypt renewal support

### 4. Firewall & Network Security ✅
- **Documentation**: `NGINX_CORS_HTTPS_SECURITY_GUIDE.md` (Firewall Rules section)
- **Issues Fixed**:
  - Documented inbound/outbound rules
  - Rate limiting at NGINX layer (separate zones for auth, API, general)
  - Port isolation (3001, 5432, 6379 internal only)
  - UFW and iptables configuration templates
  - Docker network security guidelines

---

## Quick Deployment (5 minutes)

### Option 1: Standalone NGINX (Production)

```bash
# 1. Copy configuration to system NGINX
sudo cp nginx-hms-production.conf /etc/nginx/sites-available/hms.conf
sudo ln -s /etc/nginx/sites-available/hms.conf /etc/nginx/sites-enabled/hms.conf

# 2. Test syntax
sudo nginx -t

# 3. Reload NGINX
sudo systemctl reload nginx

# 4. Verify certificate paths
ls -la /etc/letsencrypt/live/aurexcrt1/

# 5. Test HTTPS
curl -I https://hms.aurex.in/health
```

### Option 2: Docker Compose (Staging/Development)

```bash
# 1. Start NGINX with other services
docker-compose -f docker-compose-staging.yml -f docker-compose-nginx.yml up -d

# 2. Verify services running
docker-compose ps

# 3. Test
curl -k https://localhost/health  # -k to skip cert verification in dev

# 4. View logs
docker-compose logs -f nginx
```

---

## Configuration Files Reference

### Main NGINX Config: `nginx-hms-production.conf`

**Key Sections**:
- **Lines 1-100**: Global configuration, worker settings, logging
- **Lines 101-125**: Gzip compression, rate limiting zones
- **Lines 126-205**: CORS origin mapping, upstream servers
- **Lines 210-350**: HTTP→HTTPS redirect server
- **Lines 355-650**: Frontend server (hms.aurex.in:443)
- **Lines 655-900**: API backend server (apihms.aurex.in:443)
- **Lines 905-945**: Internal monitoring server (localhost:8080)

### Express CORS Config: `backend/src/app.ts`

**Key Changes**:
- **Lines 22-44**: `getCorsOrigin()` function with whitelist validation
- **Lines 49-66**: Updated rate limiter configuration
- **Lines 105-130**: CORS middleware with dynamic origin validation

### Docker Compose NGINX: `docker-compose-nginx.yml`

**Services**:
- **NGINX**: Reverse proxy with volume mounts for config and certs
- **Certbot**: Automatic certificate renewal

---

## Testing Checklist

### Quick Verification (2 minutes)

```bash
# 1. HTTPS works
curl -I https://apihms.aurex.in/health
# Should return: HTTP/2 200

# 2. CORS preflight works
curl -X OPTIONS https://apihms.aurex.in/api/v1/profile \
  -H "Origin: https://hms.aurex.in" \
  -H "Access-Control-Request-Method: GET" \
  -v
# Should return: 204 No Content with CORS headers

# 3. Security headers present
curl -I https://hms.aurex.in/ | grep -i "strict-transport\|x-frame\|x-content"
# Should see multiple security headers

# 4. Rate limiting works
for i in {1..5}; do curl -w "\n" https://apihms.aurex.in/health; done
# All 5 should succeed
```

### Comprehensive Testing (5 minutes)

See `NGINX_CORS_HTTPS_SECURITY_GUIDE.md` → **Testing and Validation** section for:
- HTTPS/TLS validation (SSL test, certificate check)
- CORS testing (allowed/disallowed origins)
- Security headers verification
- NGINX configuration testing
- gRPC endpoint testing
- Performance testing (HTTP/2, gzip, caching)

---

## Environment-Specific Configuration

### Development (localhost)

```bash
# .env settings
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true
```

**NGINX behavior**:
- Allows http://localhost and http://127.0.0.1 with any port
- Returns CORS headers for matching origins
- Less strict security headers

### Staging (staging domain)

```bash
# .env settings
NODE_ENV=staging
CORS_ORIGIN=https://hms-staging.aurex.in
CORS_CREDENTIALS=true
```

**NGINX behavior**:
- Allows staging domain origins
- Still enforces HTTPS
- Rate limiting active but more generous

### Production (production domain)

```bash
# .env settings
NODE_ENV=production
CORS_ORIGIN=https://hms.aurex.in
CORS_CREDENTIALS=true
```

**NGINX behavior**:
- Strict whitelist: only hms.aurex.in, apihms.aurex.in, api.hms.aurex.in, api-hms.aurex.in
- Enforces HTTPS strictly
- Strict rate limiting
- No metrics exposed to external clients

---

## Common Issues and Quick Fixes

### Issue: "CORS error in browser"

```bash
# Check allowed origins
grep -A10 "map \$http_origin \$cors_origin" nginx-hms-production.conf

# Test preflight
curl -X OPTIONS https://apihms.aurex.in/api/v1/profile \
  -H "Origin: https://your-domain.com" -v

# If failing:
# 1. Add your domain to NGINX map (line 207)
# 2. Add to Express allowedOrigins (app.ts line 35-41)
# 3. Restart services
```

### Issue: "SSL/TLS certificate error"

```bash
# Check certificate exists
ls -la /etc/letsencrypt/live/aurexcrt1/

# Check expiration
openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -dates -noout

# Renew if needed
sudo certbot renew --force-renewal --nginx

# Reload NGINX
sudo systemctl reload nginx
```

### Issue: "502 Bad Gateway"

```bash
# Check backend is running
curl http://localhost:3001/health

# Check NGINX can reach backend
docker exec hms-nginx curl http://hms-app:3001/health

# View NGINX error log
tail -50 /var/log/nginx/error.log

# Restart services
docker-compose restart hms-app
sudo systemctl reload nginx
```

### Issue: "Too many requests (429)"

```bash
# Check rate limit zones
sudo nginx -T | grep "limit_req_zone"

# The configured limits are:
# - api_limit: 100 req/s
# - auth_limit: 10 req/s
# - general_limit: 50 req/s
# - metrics_limit: 5 req/s

# To increase temporarily:
# Edit nginx-hms-production.conf, increase rate values
# Then: sudo systemctl reload nginx
```

---

## Production Deployment Checklist

- [ ] Copy `nginx-hms-production.conf` to `/etc/nginx/sites-available/hms.conf`
- [ ] Verify Let's Encrypt certificates exist in `/etc/letsencrypt/live/aurexcrt1/`
- [ ] Test NGINX configuration: `sudo nginx -t`
- [ ] Reload NGINX: `sudo systemctl reload nginx`
- [ ] Configure firewall (UFW/iptables) for ports 80, 443
- [ ] Test HTTPS: `curl -I https://hms.aurex.in/health`
- [ ] Test CORS: `curl -X OPTIONS https://apihms.aurex.in/api/v1/profile -H "Origin: https://hms.aurex.in" -v`
- [ ] Verify security headers: `curl -I https://hms.aurex.in/ | grep Strict-Transport`
- [ ] Monitor logs: `tail -f /var/log/nginx/error.log`
- [ ] Test API endpoints
- [ ] Load testing (10-100 concurrent users)

---

## Performance Tuning

### NGINX Worker Optimization

```nginx
# In nginx-hms-production.conf, adjust:
worker_processes auto;          # Use all CPU cores
worker_connections 4096;        # Per-worker connections
worker_rlimit_nofile 65535;     # File descriptor limit
```

### TCP Settings (system-level)

```bash
# Add to /etc/sysctl.conf
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1

# Apply changes
sudo sysctl -p
```

### Backend Connection Pool

```nginx
# In upstream block
upstream hms_backend {
    least_conn;                  # Use least connections load balancing
    server hms-app:3001 max_fails=3 fail_timeout=30s;
    keepalive 32;               # Increase keepalive connections
}
```

---

## Monitoring and Alerts

### Check NGINX Status

```bash
# View stats
curl http://localhost:8080/status

# Monitor in real-time
watch -n 1 'curl -s http://localhost:8080/status'
```

### Monitor Access Logs

```bash
# Real-time monitoring
tail -f /var/log/nginx/hms-api-access.log

# Slow requests (>1 second)
grep "rt=.*[1-9][0-9][0-9][0-9]" /var/log/nginx/access.log

# Error rate
grep " 5.. " /var/log/nginx/access.log | wc -l
```

### Set Up Log Rotation

```bash
# Create logrotate config
sudo cat > /etc/logrotate.d/nginx-hms << 'EOF'
/var/log/nginx/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        systemctl reload nginx > /dev/null 2>&1 || true
    endscript
}
EOF

# Test
sudo logrotate -d /etc/logrotate.d/nginx-hms
```

---

## Maintenance Tasks

### Certificate Renewal

```bash
# Manual renewal
sudo certbot renew --force-renewal --nginx

# Check renewal status
systemctl status certbot.timer

# View renewal log
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

### NGINX Updates

```bash
# Check NGINX version
nginx -v

# Update NGINX
sudo apt-get update && sudo apt-get upgrade nginx -y

# Test after update
sudo nginx -t

# Reload if needed
sudo systemctl reload nginx
```

---

## Next Steps

1. **Deploy to Staging** (5-10 minutes)
   - Copy configuration files
   - Verify certificates
   - Test endpoints

2. **Run Test Suite** (5-10 minutes)
   - HTTPS validation
   - CORS preflight testing
   - Security headers verification

3. **Monitor Logs** (Ongoing)
   - Watch access logs for issues
   - Monitor error logs for warnings
   - Check certificate expiration dates

4. **Performance Optimization** (Optional)
   - Load test with production traffic levels
   - Optimize rate limits based on actual usage
   - Fine-tune buffer sizes

---

## Support Resources

- **NGINX Documentation**: https://nginx.org/en/docs/
- **Let's Encrypt Docs**: https://letsencrypt.org/docs/
- **CORS Specification**: https://www.w3.org/TR/cors/
- **Mozilla SSL Config Generator**: https://ssl-config.mozilla.org/
- **gRPC HTTP/2**: https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md

**Full Documentation**: See `NGINX_CORS_HTTPS_SECURITY_GUIDE.md`

---

**Status**: Ready for Production ✅
**Version**: HMS v2.2.0
**Date**: November 3, 2025
