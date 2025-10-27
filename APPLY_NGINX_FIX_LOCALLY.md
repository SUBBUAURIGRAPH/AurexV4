# How to Apply NGINX CSP Fix - Local Instructions

**Status**: Cannot Connect to Remote from Current Environment
**Solution**: Use Local Terminal to Apply Fix

---

## Problem

The CSP error on `dlt.aurigraph.io` needs to be fixed by modifying the NGINX configuration on your remote server. The fix scripts and documentation have been prepared, but they need to be applied from your local machine.

---

## Solution: Apply Fix Yourself

Since I cannot directly access your remote server from this environment, here are step-by-step instructions to apply the fix:

### Method 1: Quick Automated Fix (Recommended)

#### Step 1: Copy the fix script to your local machine

```bash
# From your local terminal (not this environment)
# Copy the fix script to your local machine first
scp -P 2224 yogesh@dlt.aurigraph.io:~/fix-nginx-csp.sh ~/fix-nginx-csp.sh 2>/dev/null || \
  echo "Script not on remote yet - see Method 2"
```

#### Step 2: SSH to your server

```bash
ssh -p 2224 yogesh@dlt.aurigraph.io
```

#### Step 3: Upload and run the fix script

```bash
# From your local machine, upload the script
scp -P 2224 /Users/subbujois/subbuworkingdir/Aurex/glowing-adventure/fix-nginx-csp.sh \
    yogesh@dlt.aurigraph.io:~/fix-nginx-csp.sh

# Then SSH and run it
ssh -p 2224 yogesh@dlt.aurigraph.io << 'EOF'
chmod +x ~/fix-nginx-csp.sh
sudo ~/fix-nginx-csp.sh dlt.aurigraph.io
EOF
```

**Total Time**: 2-3 minutes
**Difficulty**: Easy

---

### Method 2: Manual Fix (Step-by-Step)

#### Step 1: SSH to your server

```bash
ssh -p 2224 yogesh@dlt.aurigraph.io
```

#### Step 2: Backup current NGINX config

```bash
# Find your NGINX config
sudo find /etc/nginx -name "*dlt*" -o -name "*.conf" | grep sites-available

# Backup it
sudo cp /etc/nginx/sites-available/dlt.aurigraph.io \
        /etc/nginx/sites-available/dlt.aurigraph.io.backup.$(date +%s)
```

#### Step 3: Edit the configuration

```bash
# Using nano
sudo nano /etc/nginx/sites-available/dlt.aurigraph.io

# Or using vim
sudo vim /etc/nginx/sites-available/dlt.aurigraph.io
```

#### Step 4: Find the server block

Look for:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dlt.aurigraph.io;
```

Or for HTTPS:
```nginx
server {
    listen 443 ssl;
    server_name dlt.aurigraph.io;
```

#### Step 5: Add the CSP header

**After the `listen` directives**, add this line:

```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';" always;
```

**Example of how it should look:**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dlt.aurigraph.io;

    # Add this line here:
    add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';" always;

    # ... rest of your config ...
}
```

#### Step 6: Save and exit

If using nano:
- Press `Ctrl + X`
- Type `Y` for yes
- Press `Enter`

If using vim:
- Press `Escape`
- Type `:wq`
- Press `Enter`

#### Step 7: Test NGINX configuration

```bash
sudo nginx -t
```

**Expected output:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration will be successful
```

#### Step 8: Reload NGINX

```bash
sudo systemctl reload nginx
```

#### Step 9: Verify the fix

```bash
# Check headers
curl -I https://dlt.aurigraph.io/ | grep Content-Security-Policy

# Should show:
# Content-Security-Policy: default-src 'self'; font-src 'self' data:; ...
```

**Total Time**: 5-10 minutes
**Difficulty**: Medium

---

## Verification

After applying the fix, verify it works:

### 1. From Command Line

```bash
# SSH to server and check
ssh -p 2224 yogesh@dlt.aurigraph.io << 'EOF'
echo "Checking NGINX status..."
sudo systemctl status nginx | head -5

echo ""
echo "Checking CSP header..."
curl -I https://dlt.aurigraph.io/ 2>/dev/null | grep -i content-security
EOF
```

**Expected output:**
```
active (running) since ...
Content-Security-Policy: default-src 'self'; font-src 'self' data:; ...
```

### 2. In Browser

1. **Go to**: https://dlt.aurigraph.io
2. **Open Dev Tools**: F12
3. **Check Console**:
   - Should see **NO CSP errors**
   - Should see **NO font errors**
4. **Check Network Tab**:
   - Filter by "font"
   - All fonts should have status **200**
5. **Visual Check**:
   - All text displays correctly
   - No missing fonts
   - Layout looks proper

---

## If Something Goes Wrong

### Rollback to Backup

```bash
ssh -p 2224 yogesh@dlt.aurigraph.io << 'EOF'
# Find backup files
ls -la /etc/nginx/sites-available/dlt.aurigraph.io*

# Restore backup (use the timestamp from above)
sudo cp /etc/nginx/sites-available/dlt.aurigraph.io.backup.TIMESTAMP \
        /etc/nginx/sites-available/dlt.aurigraph.io

# Test
sudo nginx -t

# Reload
sudo systemctl reload nginx
EOF
```

### Check Logs

```bash
ssh -p 2224 yogesh@dlt.aurigraph.io << 'EOF'
# View NGINX error logs
sudo tail -50 /var/log/nginx/error.log

# View NGINX access logs
sudo tail -20 /var/log/nginx/access.log
EOF
```

---

## CSP Header Options

Choose the appropriate CSP header for your environment:

### Minimal (Most Secure)
```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:;" always;
```

### Standard (Recommended) ⭐
```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';" always;
```

### Development (Relaxed)
```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;" always;
```

### Production (Strict)
```nginx
add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';" always;
```

---

## Multiple Server Blocks

If you have both HTTP and HTTPS server blocks, add the CSP header to **both**:

```nginx
# HTTP block
server {
    listen 80;
    server_name dlt.aurigraph.io;
    add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; ...";
    ...
}

# HTTPS block
server {
    listen 443 ssl;
    server_name dlt.aurigraph.io;
    add_header Content-Security-Policy "default-src 'self'; font-src 'self' data:; ...";
    ...
}
```

---

## Detailed Documentation

For more information, see:

1. **NGINX_CSP_QUICK_FIX.md** - Quick reference guide
2. **NGINX_CSP_FIX.md** - Complete comprehensive guide
3. **fix-nginx-csp.sh** - Automated script (for reference)

All files are in:
```
/Users/subbujois/subbuworkingdir/Aurex/glowing-adventure/
```

---

## Files Ready for Use

| File | Purpose | Status |
|------|---------|--------|
| `fix-nginx-csp.sh` | Automated fix script | ✅ Ready |
| `NGINX_CSP_FIX.md` | Complete guide | ✅ Ready |
| `NGINX_CSP_QUICK_FIX.md` | Quick reference | ✅ Ready |

---

## Summary

**What needs to happen**:
1. SSH to your server
2. Apply CSP header to NGINX config
3. Test and reload NGINX
4. Verify in browser

**Time required**: 2-10 minutes depending on method

**Difficulty**: Easy to Medium

**Result**: Fonts will load correctly, no CSP errors

---

## Ready to Apply?

Choose your method:

- **Quick**: Use the automated script (2 min, Method 1)
- **Manual**: Follow step-by-step instructions (5 min, Method 2)
- **Reference**: Read complete guide first (NGINX_CSP_FIX.md)

Apply from your local terminal with:

```bash
# Method 1: Automated
scp -P 2224 /path/to/fix-nginx-csp.sh yogesh@dlt.aurigraph.io:~/
ssh -p 2224 yogesh@dlt.aurigraph.io "sudo ~/fix-nginx-csp.sh dlt.aurigraph.io"

# Method 2: Manual
ssh -p 2224 yogesh@dlt.aurigraph.io
# Then follow the 9 steps above
```

Good luck! The fonts should load correctly once the fix is applied. 🎉

