# NGINX CSP Configuration Fix for dlt.aurigraph.io

**Issue**: Content Security Policy (CSP) violation preventing font loading
**Error**: `Refused to load the font 'data:font/woff2;base64,...'`
**Root Cause**: CSP header not allowing data URIs for fonts
**Solution**: Update NGINX proxy settings

---

## Problem Analysis

The error indicates that:
1. Frontend is trying to load fonts from data URIs
2. NGINX CSP header has `default-src 'self'` but no `font-src` directive
3. Missing fonts breaks CSS styling on the webpage

---

## Solution: Update NGINX Configuration

### Step 1: SSH to Your Server

```bash
ssh -p 2224 yogesh@dev.aurigraph.io
```

Or for production:

```bash
ssh -p 2224 yogesh@dlt.aurigraph.io
```

### Step 2: Locate NGINX Configuration

```bash
# Find NGINX main config
sudo find /etc/nginx -name "nginx.conf" -o -name "*.conf" | grep -v test

# Or check standard locations
ls -la /etc/nginx/nginx.conf
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/sites-enabled/
ls -la /etc/nginx/conf.d/
```

### Step 3: Identify Your Site Configuration

```bash
# For dlt.aurigraph.io, look for:
sudo grep -r "dlt.aurigraph.io" /etc/nginx/

# Or list all enabled sites
ls -la /etc/nginx/sites-enabled/
```

### Step 4: Edit the Configuration

**Option A: Fix in Main Server Block**

If you find a config file for your domain, look for the server block:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dlt.aurigraph.io;

    # ... existing configuration ...
}
```

**Option B: Fix in Proxy Configuration**

If you're using a proxy to backend services:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dlt.aurigraph.io;

    location / {
        proxy_pass http://backend_service;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ... existing configuration ...
}
```

---

## NGINX CSP Header Fixes

### Fix 1: Basic CSP with Font Support (Recommended)

Add this inside your `server` block:

```nginx
# Allow fonts from data URIs and self
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';" always;
```

### Fix 2: More Permissive CSP (Development)

```nginx
# Development/debugging - more permissive
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:" always;
```

### Fix 3: Production CSP (Most Secure)

```nginx
# Production - stricter policies with nonce support
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';" always;
```

### Fix 4: CSP with HTTPS CDN Support

```nginx
# If fonts are served from CDN
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; connect-src 'self';" always;
```

---

## Complete NGINX Configuration Example

Here's a complete server block configuration:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dlt.aurigraph.io;

    # Redirect HTTP to HTTPS (optional but recommended)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name dlt.aurigraph.io;

    # SSL Certificate Configuration
    ssl_certificate /etc/letsencrypt/live/dlt.aurigraph.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dlt.aurigraph.io/privkey.pem;

    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Content Security Policy - FIXED
    add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';" always;

    # CORS Headers (if needed)
    add_header Access-Control-Allow-Origin "$http_origin" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;

    # Logging
    access_log /var/log/nginx/dlt.aurigraph.io.access.log;
    error_log /var/log/nginx/dlt.aurigraph.io.error.log;

    # Root directory or proxy configuration
    # Option 1: Static files
    root /var/www/dlt.aurigraph.io;
    index index.html;

    # Option 2: Proxy to backend (uncomment if using proxy)
    # location / {
    #     proxy_pass http://localhost:3000;
    #     proxy_set_header Host $host;
    #     proxy_set_header X-Real-IP $remote_addr;
    #     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #     proxy_set_header X-Forwarded-Proto $scheme;
    # }

    # Try to serve file directly, fallback to index.html for SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Step-by-Step Implementation

### 1. Backup Current Configuration

```bash
sudo cp /etc/nginx/sites-available/dlt.aurigraph.io /etc/nginx/sites-available/dlt.aurigraph.io.backup.$(date +%s)
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%s)
```

### 2. Edit the Configuration

Using nano:
```bash
sudo nano /etc/nginx/sites-available/dlt.aurigraph.io
```

Or vim:
```bash
sudo vim /etc/nginx/sites-available/dlt.aurigraph.io
```

### 3. Find the Server Block

Look for:
```nginx
server {
    listen 80;
    server_name dlt.aurigraph.io;
```

Or:
```nginx
server {
    listen 443 ssl;
    server_name dlt.aurigraph.io;
```

### 4. Add the CSP Header

Inside the `server { }` block, add:

```nginx
# Content Security Policy - Allow fonts from data URIs
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';" always;
```

**Position**: Add this after other security headers, before closing the server block.

### 5. Test NGINX Configuration

```bash
# Test syntax
sudo nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration will be successful
```

### 6. Reload NGINX

```bash
# Reload without dropping connections
sudo systemctl reload nginx

# Or
sudo service nginx reload
```

### 7. Verify Changes

```bash
# Check NGINX is running
sudo systemctl status nginx

# View logs for any errors
sudo tail -f /var/log/nginx/error.log
```

---

## Testing the Fix

### 1. Check Headers from Command Line

```bash
# Get response headers
curl -I https://dlt.aurigraph.io/

# Should show:
# Content-Security-Policy: default-src 'self'; font-src 'self' data:; ...
```

### 2. Browser Developer Tools

1. Open Developer Tools (F12)
2. Go to Network tab
3. Reload the page
4. Check the response headers:
   - Should see `Content-Security-Policy` header
   - Should allow `font-src 'self' data:`
5. Go to Console tab
   - CSP errors should be gone
   - Font warnings should disappear

### 3. Check Font Loading

In the Network tab:
- Filter by "font"
- All fonts should load successfully (status 200, not 403/404)

---

## If Using Docker

If your NGINX is in a Docker container:

### 1. Find the Container

```bash
docker ps | grep nginx
```

### 2. Copy Configuration In

```bash
docker cp /path/to/nginx.conf container_id:/etc/nginx/nginx.conf
```

### 3. Reload NGINX in Container

```bash
docker exec container_id nginx -s reload
```

---

## If Using Docker Compose

Edit your `docker-compose.yml`:

```yaml
services:
  nginx:
    image: nginx:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    command: nginx -g 'daemon off;'
```

Then reload:

```bash
docker-compose restart nginx
```

---

## Common CSP Directives Reference

| Directive | Purpose | Example |
|-----------|---------|---------|
| `default-src` | Default policy for all content | `'self'` |
| `font-src` | Allowed font sources | `'self' data:` |
| `script-src` | Allowed script sources | `'self' 'unsafe-inline'` |
| `style-src` | Allowed style sources | `'self' 'unsafe-inline'` |
| `img-src` | Allowed image sources | `'self' data:` |
| `connect-src` | Allowed fetch/XHR sources | `'self'` |
| `frame-ancestors` | Allowed frame sources | `'none'` |

---

## Recommended CSP Policies

### For Static Frontend Only

```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; style-src 'self' 'unsafe-inline'; img-src 'self' data:;" always;
```

### For Frontend with External APIs

```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.example.com;" always;
```

### For React/Vue/Angular SPA

```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self';" always;
```

### For Development (Relaxed)

```nginx
add_header Content-Security-Policy "default-src 'self'; font-src *; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; img-src *; connect-src *;" always;
```

---

## Troubleshooting

### Issue: Still Getting CSP Errors

**Solution 1**: Check which config file is being used
```bash
sudo nginx -T | grep "# configuration"
sudo nginx -T | grep "^http\|^server" | head -20
```

**Solution 2**: Test with inline style in HTML
```html
<style>
  body { font-family: sans-serif; }
</style>
```

**Solution 3**: Use nonce for inline scripts
```nginx
add_header Content-Security-Policy "script-src 'nonce-$request_id'" always;
```

### Issue: Can't Connect to Backend API

**Add to CSP**:
```nginx
add_header Content-Security-Policy "connect-src 'self' https://api.yourdomain.com;" always;
```

### Issue: Fonts Still Not Loading

**Check MIME types**:
```nginx
types {
    font/woff2 woff2;
    font/woff woff;
    font/ttf ttf;
    application/vnd.ms-fontobject eot;
}
```

### Issue: NGINX Won't Reload

```bash
# Check syntax first
sudo nginx -t

# Check for process
ps aux | grep nginx

# Kill old process if stuck
sudo pkill -9 nginx

# Start fresh
sudo systemctl start nginx
```

---

## Verification Checklist

- [ ] Backed up original configuration
- [ ] Added CSP header to correct server block
- [ ] Tested configuration with `nginx -t`
- [ ] Reloaded NGINX without errors
- [ ] Checked headers with `curl -I`
- [ ] Verified fonts load in browser (Network tab)
- [ ] Verified no CSP errors in Console
- [ ] Tested on different browsers
- [ ] Verified HTTPS works (if applicable)
- [ ] Checked error logs for issues

---

## Support Commands

```bash
# View current NGINX configuration
sudo nginx -T

# Check NGINX version
nginx -v

# View access logs (last 20 lines)
sudo tail -20 /var/log/nginx/access.log

# Follow error logs in real-time
sudo tail -f /var/log/nginx/error.log

# Test configuration syntax
sudo nginx -t

# Gracefully reload
sudo nginx -s reload

# Restart NGINX
sudo systemctl restart nginx

# Check NGINX status
sudo systemctl status nginx

# View specific site config
sudo cat /etc/nginx/sites-available/dlt.aurigraph.io
```

---

## Summary

The CSP error is fixed by:

1. **Adding proper CSP headers** that allow fonts from data URIs
2. **Reloading NGINX** to apply changes
3. **Verifying** headers are being sent correctly

The key fix is:
```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; ..." always;
```

This allows fonts to load from data URIs while maintaining security.

---

**Apply this fix on your remote server and the font loading errors should be resolved.**

