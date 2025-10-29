# NGINX CSP Quick Fix - 5 Minute Solution

**Problem**: Fonts not loading on dlt.aurigraph.io
**Error**: `Refused to load the font 'data:font/woff2;base64,...'`
**Solution**: Add CSP header allowing data URI fonts
**Time**: 5 minutes

---

## Quick Fix (Choose One)

### Option 1: Automated Script (Easiest) ⭐

```bash
# SSH to server
ssh -p 2224 yogesh@dlt.aurigraph.io

# Copy script
scp -P 2224 fix-nginx-csp.sh yogesh@dlt.aurigraph.io:~/

# Run with sudo
sudo ~/fix-nginx-csp.sh dlt.aurigraph.io
```

**That's it!** The script handles everything.

---

### Option 2: Manual Fix (5 minutes)

#### Step 1: SSH to Server
```bash
ssh -p 2224 yogesh@dlt.aurigraph.io
```

#### Step 2: Find Your NGINX Config
```bash
# Find the config file
sudo find /etc/nginx/sites-available/ -name "*dlt*" -o -name "default"

# Or check the main nginx config
sudo find /etc/nginx/conf.d/ -name "*.conf"
```

#### Step 3: Backup Current Config
```bash
sudo cp /etc/nginx/sites-available/dlt.aurigraph.io /etc/nginx/sites-available/dlt.aurigraph.io.backup
```

#### Step 4: Edit Config
```bash
sudo nano /etc/nginx/sites-available/dlt.aurigraph.io
```

#### Step 5: Add CSP Header
**Find this section:**
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dlt.aurigraph.io;
```

**Add this line after the listen directives:**
```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';" always;
```

**Full example:**
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dlt.aurigraph.io;

    add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';" always;

    # Rest of your config...
}
```

#### Step 6: Test Configuration
```bash
sudo nginx -t
```

**Expected output:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration will be successful
```

#### Step 7: Reload NGINX
```bash
sudo systemctl reload nginx
```

#### Step 8: Verify
```bash
# Check headers
curl -I https://dlt.aurigraph.io/ | grep Content-Security-Policy

# Should output:
# Content-Security-Policy: default-src 'self'; font-src 'self' data:; ...
```

---

## Browser Verification

1. **Clear Cache**
   - Windows/Linux: `Ctrl + Shift + Delete`
   - Mac: `Cmd + Shift + Delete`

2. **Hard Reload**
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

3. **Check Console (F12)**
   - Should see NO CSP errors
   - Fonts should load successfully

4. **Check Network Tab**
   - Look for font files
   - All should have status 200

---

## CSP Header Breakdown

What each part does:

```
default-src 'self'
  → Allow most things only from same origin

font-src 'self' data:
  → Allow fonts from same origin AND data URIs ✓ FIXES FONT ISSUE

script-src 'self' 'unsafe-inline' 'unsafe-eval'
  → Allow scripts from origin and inline (needed for some frameworks)

style-src 'self' 'unsafe-inline'
  → Allow styles from origin and inline

img-src 'self' data:
  → Allow images from origin and data URIs

connect-src 'self'
  → Allow fetch/XHR only to same origin
```

---

## Different CSP Options

### Option A: Minimal (Most Secure)
```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:;" always;
```

### Option B: Standard (Recommended) ⭐
```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';" always;
```

### Option C: Development (Relaxed)
```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;" always;
```

### Option D: Production (Strict)
```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';" always;
```

---

## If You Have Multiple Server Blocks

NGINX might have multiple `server` blocks (one for HTTP, one for HTTPS).

Add the header to **both**:

```nginx
# HTTP server block
server {
    listen 80;
    server_name dlt.aurigraph.io;
    add_header Content-Security-Policy "...";
}

# HTTPS server block
server {
    listen 443 ssl;
    server_name dlt.aurigraph.io;
    add_header Content-Security-Policy "...";
}
```

---

## Troubleshooting

### Problem: Still getting CSP errors
**Solution**:
1. Check you edited the right file: `sudo grep -r "dlt.aurigraph.io" /etc/nginx/`
2. Check both HTTP and HTTPS blocks
3. Did you reload NGINX? `sudo systemctl reload nginx`

### Problem: NGINX won't reload
**Solution**:
1. Test syntax: `sudo nginx -t`
2. Kill stuck process: `sudo pkill -9 nginx`
3. Start fresh: `sudo systemctl start nginx`

### Problem: Still no headers after reload
**Solution**:
1. Verify file was saved: `sudo nano /path/to/config` (then Ctrl+X)
2. Check with: `sudo cat /etc/nginx/sites-available/dlt.aurigraph.io | grep CSP`
3. Restart NGINX: `sudo systemctl restart nginx`

### Problem: Config file not found
**Solution**:
```bash
# Search for NGINX config
sudo find /etc/nginx -type f -name "*.conf" | head -20

# List sites
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/sites-enabled/

# Check main config
cat /etc/nginx/nginx.conf | grep include
```

---

## Reverting Changes

If you need to revert:

```bash
# Restore backup
sudo cp /etc/nginx/sites-available/dlt.aurigraph.io.backup /etc/nginx/sites-available/dlt.aurigraph.io

# Test
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

---

## Verification Checklist

- [ ] Connected to server via SSH
- [ ] Found NGINX config file
- [ ] Created backup
- [ ] Added CSP header
- [ ] Configuration tests (`nginx -t`)
- [ ] NGINX reloaded
- [ ] Headers verified with curl
- [ ] Browser cache cleared
- [ ] Hard reload done
- [ ] Console shows no CSP errors
- [ ] Fonts load successfully

---

## Success Indicators

✅ **Console (F12)**
- No CSP errors
- Font files load

✅ **Network Tab (F12)**
- Font files have status 200
- No 403/404 errors

✅ **curl**
```bash
curl -I https://dlt.aurigraph.io/ | grep CSP
# Shows: Content-Security-Policy: default-src 'self'; font-src 'self' data:; ...
```

✅ **Website**
- All text displays with correct fonts
- Layout looks right
- No visual issues

---

## Getting Help

Check these files for detailed information:

1. **NGINX_CSP_FIX.md** - Complete guide with examples
2. **fix-nginx-csp.sh** - Automated script source code
3. **Logs**: `sudo tail -f /var/log/nginx/error.log`

---

## Common NGINX Locations

| OS | Path |
|----|------|
| Ubuntu/Debian | `/etc/nginx/sites-available/` |
| CentOS/RHEL | `/etc/nginx/conf.d/` |
| Docker | `/etc/nginx/nginx.conf` |
| Homebrew (Mac) | `/usr/local/etc/nginx/nginx.conf` |

---

## Done! 🎉

Your fonts should now load correctly on dlt.aurigraph.io!

If you still see issues:
1. Hard reload browser (Ctrl+Shift+R)
2. Clear all cache
3. Check CSP header is correct: `curl -I https://dlt.aurigraph.io/`
4. Review NGINX_CSP_FIX.md troubleshooting section
5. Check server logs: `sudo tail -50 /var/log/nginx/error.log`

