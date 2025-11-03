# NGINX, CORS, and HTTPS Security Configuration Guide
## HMS v2.2.0 - November 3, 2025

---

## Table of Contents
1. [Overview](#overview)
2. [NGINX Configuration](#nginx-configuration)
3. [CORS Implementation](#cors-implementation)
4. [HTTPS/TLS Configuration](#httpstls-configuration)
5. [Firewall Rules](#firewall-rules)
6. [Deployment Instructions](#deployment-instructions)
7. [Testing and Validation](#testing-and-validation)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides comprehensive documentation for the HMS v2.2.0 production deployment with:
- **NGINX reverse proxy** with HTTP/2 and gRPC support
- **CORS (Cross-Origin Resource Sharing)** with whitelist-based origin validation
- **HTTPS/TLS** with modern cipher suites and OCSP stapling
- **Firewall rules** for defense-in-depth security
- **Rate limiting** at both NGINX and Express layers

### Key Components
- **Frontend**: hms.aurex.in (HTTP/2, HTTPS, SPA)
- **API Backend**: apihms.aurex.in (HTTP/2, HTTPS, REST + gRPC)
- **Internal Monitoring**: localhost:8080 (metrics and status)

---

## NGINX Configuration

### Configuration Files

#### Primary Configuration: `nginx-hms-production.conf`

**Location**: `/etc/nginx/nginx-hms-production.conf`

The production NGINX configuration includes:

```nginx
# Key Settings:
- Worker processes: auto (adjusts to CPU count)
- Worker connections: 4096 (increased from 1024 for high load)
- Client body timeout: 30s
- Client max body size: 5M (reduced from 100M for security)
```

### NGINX Upstream Configuration

```nginx
# Backend HTTP service
upstream hms_backend {
    least_conn;  # Load balancing algorithm
    server hms-app:3001 max_fails=3 fail_timeout=30s weight=1;
    keepalive 32;
}

# gRPC backend service
upstream hms_grpc_backend {
    least_conn;
    server hms-app:50051 max_fails=3 fail_timeout=30s weight=1;
}
```

### Rate Limiting Configuration

NGINX implements four rate-limiting zones:

```nginx
# API endpoints: 100 requests/second
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;

# Authentication endpoints: 10 requests/second (stricter)
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/s;

# General endpoints: 50 requests/second
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=50r/s;

# Metrics endpoints: 5 requests/second (protected)
limit_req_zone $binary_remote_addr zone=metrics_limit:10m rate=5r/s;
```

### NGINX Server Blocks

#### 1. HTTP to HTTPS Redirect Server (Port 80)

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name hms.aurex.in apihms.aurex.in *.hms.aurex.in;

    # Allow Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
    }

    # Redirect all other HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}
```

#### 2. Frontend Server (hms.aurex.in:443)

Serves the SPA with static assets and API proxy:

**Key Features**:
- HTTP/2 with Server Push hints
- Long-lived caching for static assets
- CORS preflight handling
- Rate limiting by endpoint type

**Static File Caching**:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable, max-age=31536000";
}
```

**API Proxy**:
```nginx
location /api/ {
    limit_req zone=api_limit burst=100 nodelay;

    proxy_pass http://hms_backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

#### 3. Backend API Server (apihms.aurex.in:443)

Pure API endpoint with stricter security:

**Key Features**:
- Stricter CORS validation (no wildcards)
- REST API endpoints (/api/v1/)
- gRPC endpoints (/hms.analytics.AnalyticsService/)
- WebSocket support (/ws/)
- Metrics endpoint (/metrics)

**gRPC Proxy Configuration**:
```nginx
location /hms.analytics.AnalyticsService/ {
    limit_req zone=api_limit burst=50 nodelay;

    proxy_pass http://hms_grpc_backend;

    # gRPC requires HTTP/2
    proxy_http_version 2.0;
    proxy_set_header Connection "";
    proxy_set_header Content-Type "application/grpc";

    proxy_read_timeout 86400;  # Long timeout for streaming
    proxy_buffering off;
}
```

**WebSocket Proxy Configuration**:
```nginx
location /ws/ {
    limit_req zone=general_limit burst=50 nodelay;

    proxy_pass http://hms_backend;
    proxy_http_version 1.1;

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Long timeouts for persistent WebSocket connections
    proxy_send_timeout 3600s;
    proxy_read_timeout 3600s;

    proxy_buffering off;
}
```

#### 4. Internal Monitoring Server (localhost:8080)

Not exposed externally - for internal monitoring only:

```nginx
server {
    listen 8080;
    listen [::]:8080;
    server_name localhost 127.0.0.1;

    # Metrics endpoint
    location /metrics {
        access_log off;
        return 200 "nginx_up 1\n";
    }

    # NGINX stub status
    location /status {
        stub_status on;
        allow 127.0.0.1;
        allow 172.16.0.0/12;  # Docker internal
        allow 10.0.0.0/8;     # Private networks
        deny all;
    }
}
```

---

## CORS Implementation

### Problem Statement

The original configuration had several CORS issues:
1. **No CORS handling** at the NGINX level
2. **Inconsistent headers** between NGINX and Express
3. **No CORS preflight** support for complex requests
4. **Wildcard origins** allowed (security risk)
5. **Missing exposed headers** (correlation IDs, rate limit info)

### Solution: Whitelist-Based Origin Validation

#### NGINX CORS Map Configuration

```nginx
map $http_origin $cors_origin {
    default "";
    "~^https?://localhost(:[0-9]+)?$" $http_origin;
    "~^https?://127.0.0.1(:[0-9]+)?$" $http_origin;
    "~^https://hms\.aurex\.in$" $http_origin;
    "~^https://apihms\.aurex\.in$" $http_origin;
    "~^https://[a-z0-9.-]*\.aurex\.in$" $http_origin;
}
```

This map:
- Validates origin against whitelist using regex patterns
- Returns the origin if allowed, empty string if denied
- Supports development (localhost), staging, and production domains

#### NGINX CORS Headers

Applied to all responses:

```nginx
add_header Access-Control-Allow-Origin $cors_origin always;
add_header Access-Control-Allow-Credentials "true" always;
add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With, X-Correlation-ID, Accept, Origin" always;
add_header Access-Control-Expose-Headers "X-Correlation-ID, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset" always;
add_header Access-Control-Max-Age "86400" always;
```

#### NGINX CORS Preflight Handler

For each location that needs CORS:

```nginx
if ($request_method = 'OPTIONS') {
    add_header 'Access-Control-Allow-Origin' $cors_origin always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Requested-With, X-Correlation-ID, Accept, Origin' always;
    add_header 'Access-Control-Max-Age' '86400' always;
    add_header 'Content-Type' 'text/plain; charset=utf-8';
    add_header 'Content-Length' '0' always;
    return 204;
}
```

### Express.js CORS Configuration

**File**: `backend/src/app.ts`

#### Dynamic Origin Validation Function

```typescript
const getCorsOrigin = (origin: string | undefined): boolean => {
  // Allow requests with no origin (same origin requests)
  if (!origin) return true;

  // Development environments
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging') {
    // Allow localhost and 127.0.0.1 with any port
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return true;
    }
  }

  // Production allowed origins
  const allowedOrigins = [
    'https://hms.aurex.in',
    'https://www.hms.aurex.in',
    'https://apihms.aurex.in',
    'https://api.hms.aurex.in',
    'https://api-hms.aurex.in'
  ];

  return allowedOrigins.includes(origin);
};
```

#### Express CORS Configuration

```typescript
app.use(
  cors({
    origin: getCorsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Correlation-ID',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers'
    ],
    exposedHeaders: [
      'X-Correlation-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Content-Length'
    ],
    maxAge: 86400,
    optionsSuccessStatus: 200
  })
);
```

### CORS Request Flow

#### Preflight Request (OPTIONS)
1. Browser sends OPTIONS request with headers
2. NGINX or Express validates origin against whitelist
3. If valid, returns CORS headers with 204 No Content
4. Browser caches response for 24 hours (maxAge)
5. Browser sends actual request

#### Actual Request
1. Browser sends GET/POST/etc with origin header
2. Server validates origin
3. If valid, includes Access-Control-Allow-Origin header
4. Browser allows response to be read by JavaScript

---

## HTTPS/TLS Configuration

### Certificate Management

**Certificate Provider**: Let's Encrypt
**Certificate Path**: `/etc/letsencrypt/live/aurexcrt1/`
**Files**:
- `fullchain.pem` - Certificate chain
- `privkey.pem` - Private key
- `chain.pem` - Intermediate certificates

### TLS Protocol Configuration

```nginx
ssl_protocols TLSv1.3 TLSv1.2;
```

**Rationale**:
- TLSv1.3: Modern protocol with reduced handshake time
- TLSv1.2: Backward compatibility for older clients
- TLSv1.1 and earlier: Disabled (security vulnerabilities)

### Cipher Suite Configuration

```nginx
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:!aNULL:!MD5:!DSS';
ssl_prefer_server_ciphers on;
```

**Cipher Strength**:
- **AES-256-GCM**: 256-bit encryption with Galois/Counter Mode
- **CHACHA20-POLY1305**: Modern AEAD cipher, fast on older CPUs
- **!aNULL**: Exclude anonymous ciphers
- **!MD5**: Exclude weak hash algorithms
- **!DSS**: Exclude weak DSS signatures

### Session Management

```nginx
ssl_session_cache shared:SSL:10m;  # 10MB shared cache
ssl_session_timeout 10m;            # 10 minute timeout
ssl_session_tickets off;            # Disable session tickets for security
```

### OCSP Stapling

```nginx
ssl_stapling on;
ssl_stapling_verify on;
ssl_stapling_responder http://ocsp.int-x3.letsencrypt.org;
resolver 1.1.1.1 8.8.8.8 valid=300s;
resolver_timeout 5s;
```

**Benefits**:
- Reduces TLS handshake time
- Improves privacy (client doesn't directly contact OCSP server)
- Provides proof of certificate validity

### HTTP Strict Transport Security (HSTS)

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

**Configuration**:
- `max-age=31536000`: 1 year validity
- `includeSubDomains`: Apply to all subdomains
- `preload`: Allow inclusion in browser HSTS preload list

### Certificate Renewal

**Let's Encrypt Auto-Renewal** (via Certbot):

```bash
# Manual renewal (if needed)
certbot renew --nginx

# Automatic renewal (cron job)
0 12 * * * /usr/bin/certbot renew --quiet --nginx
```

---

## Firewall Rules

### Inbound Rules

#### Port 80 (HTTP)
- **Source**: 0.0.0.0/0 (any)
- **Destination**: NGINX reverse proxy
- **Action**: ACCEPT (redirects to HTTPS)
- **Purpose**: Let's Encrypt ACME challenge + HTTP → HTTPS redirect

#### Port 443 (HTTPS)
- **Source**: 0.0.0.0/0 (any)
- **Destination**: NGINX reverse proxy
- **Action**: ACCEPT
- **Purpose**: HTTPS traffic for frontend and API

#### Port 50051 (gRPC - Optional External)
- **Source**: 0.0.0.0/0 (or restricted to known clients)
- **Destination**: NGINX reverse proxy
- **Action**: ACCEPT or DROP (depending on requirements)
- **Purpose**: gRPC service-to-service communication
- **Note**: Typically proxied through NGINX on port 443

#### Port 8080 (Internal Metrics)
- **Source**: 172.16.0.0/12, 10.0.0.0/8, 127.0.0.1
- **Destination**: NGINX metrics endpoint
- **Action**: ACCEPT
- **Purpose**: Internal monitoring and metrics collection

#### Port 3001 (Express Backend - Internal Only)
- **Source**: 172.16.0.0/12, 10.0.0.0/8 (Docker networks)
- **Destination**: Express application
- **Action**: ACCEPT
- **Purpose**: NGINX to Express proxying (Docker internal)

#### Port 5432 (PostgreSQL - Internal Only)
- **Source**: 172.16.0.0/12, 10.0.0.0/8
- **Destination**: PostgreSQL database
- **Action**: ACCEPT
- **Purpose**: Database access from application

#### Port 6379 (Redis - Internal Only)
- **Source**: 172.16.0.0/12, 10.0.0.0/8
- **Destination**: Redis cache
- **Action**: ACCEPT
- **Purpose**: Cache layer access from application

### Outbound Rules

#### DNS (Port 53)
- **Source**: NGINX, Express, Applications
- **Destination**: 1.1.1.1, 8.8.8.8 (DNS resolvers)
- **Action**: ACCEPT
- **Purpose**: Domain name resolution

#### OCSP (Port 80)
- **Source**: NGINX
- **Destination**: ocsp.int-x3.letsencrypt.org
- **Action**: ACCEPT
- **Purpose**: Certificate status verification

#### NTP (Port 123)
- **Source**: All services
- **Destination**: 0.0.0.0/0
- **Action**: ACCEPT
- **Purpose**: Time synchronization

#### HTTPS (Port 443)
- **Source**: All services
- **Destination**: 0.0.0.0/0 (Internet)
- **Action**: ACCEPT
- **Purpose**: External API calls, updates

### Docker-Specific Rules

For Docker Compose deployments:

```bash
# Allow inter-container communication on hms-network
iptables -A FORWARD -i docker0 -o docker0 -j ACCEPT

# Allow NGINX to reach backend services
iptables -A FORWARD -i docker0 -o docker0 -p tcp -j ACCEPT

# Allow external traffic to NGINX
iptables -A FORWARD -i eth0 -o docker0 -p tcp --dport 443 -j ACCEPT
iptables -A FORWARD -i eth0 -o docker0 -p tcp --dport 80 -j ACCEPT
```

### UFW Rules (Ubuntu/Debian)

```bash
# Enable firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow internal metrics (restricted)
sudo ufw allow from 10.0.0.0/8 to any port 8080
sudo ufw allow from 172.16.0.0/12 to any port 8080

# Check rules
sudo ufw status numbered
```

### iptables Rules

```bash
# Flush existing rules
sudo iptables -F

# Default policies
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD ACCEPT
sudo iptables -P OUTPUT ACCEPT

# Allow loopback
sudo iptables -A INPUT -i lo -j ACCEPT

# Allow established connections
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP and HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow internal metrics
sudo iptables -A INPUT -s 10.0.0.0/8 -p tcp --dport 8080 -j ACCEPT
sudo iptables -A INPUT -s 172.16.0.0/12 -p tcp --dport 8080 -j ACCEPT

# Save rules
sudo iptables-save > /etc/iptables/rules.v4
```

---

## Deployment Instructions

### Prerequisites

```bash
# System requirements
- Ubuntu/Debian Linux
- Docker and Docker Compose
- Let's Encrypt certificate (certbot)
- NGINX 1.21+ (HTTP/2 and HTTP/2 server push support)

# Certificates must exist
/etc/letsencrypt/live/aurexcrt1/fullchain.pem
/etc/letsencrypt/live/aurexcrt1/privkey.pem
/etc/letsencrypt/live/aurexcrt1/chain.pem
```

### Step 1: Copy NGINX Configuration

```bash
# Copy production configuration
sudo cp nginx-hms-production.conf /etc/nginx/sites-available/hms.conf

# Create symbolic link
sudo ln -s /etc/nginx/sites-available/hms.conf /etc/nginx/sites-enabled/hms.conf

# Remove default configuration
sudo rm /etc/nginx/sites-enabled/default

# Test configuration syntax
sudo nginx -t

# Output should be:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration will be successful
```

### Step 2: Configure Let's Encrypt Certificates

```bash
# Install certbot (if not already installed)
sudo apt-get install certbot python3-certbot-nginx -y

# Obtain certificate (if not already done)
sudo certbot certonly --standalone -d hms.aurex.in -d apihms.aurex.in

# Verify certificate
sudo ls -la /etc/letsencrypt/live/aurexcrt1/
```

### Step 3: Setup Automatic Certificate Renewal

```bash
# Create renewal hook script
sudo cat > /etc/letsencrypt/renewal-hooks/post/nginx-reload.sh << 'EOF'
#!/bin/bash
/usr/sbin/nginx -s reload
EOF

# Make executable
sudo chmod +x /etc/letsencrypt/renewal-hooks/post/nginx-reload.sh

# Test renewal process
sudo certbot renew --dry-run

# Renewal will automatically run via systemd timer (Ubuntu 20.04+)
systemctl status certbot.timer
```

### Step 4: Configure Firewall

```bash
# Using UFW
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow from 10.0.0.0/8 to any port 8080

# Verify
sudo ufw status
```

### Step 5: Start NGINX

```bash
# Enable at startup
sudo systemctl enable nginx

# Start service
sudo systemctl start nginx

# Check status
sudo systemctl status nginx

# View logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Step 6: Start Containers

```bash
# Start HMS stack
cd /app/hms
docker-compose -f docker-compose-staging.yml up -d

# Verify containers
docker-compose ps

# Check application health
curl https://hms.aurex.in/health
curl https://apihms.aurex.in/health
```

---

## Testing and Validation

### 1. HTTPS/TLS Testing

#### Test SSL Certificate

```bash
# Check certificate details
openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -text -noout

# Test SSL connection
openssl s_client -connect hms.aurex.in:443 -servername hms.aurex.in

# Test cipher strength
nmap --script ssl-enum-ciphers -p 443 hms.aurex.in

# Online SSL test (Mozilla Observatory)
https://observatory.mozilla.org/
```

#### Test HSTS Header

```bash
curl -I https://hms.aurex.in/
# Should include:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

#### Test TLS Version

```bash
# TLSv1.3 should be supported
curl -I https://hms.aurex.in/

# Verify no TLSv1.0 or TLSv1.1
nmap --script ssl-enum-ciphers -p 443 hms.aurex.in | grep -E "TLSv1\.[01]"
# Should return nothing
```

### 2. CORS Testing

#### Test Preflight Request

```bash
# Test OPTIONS request (CORS preflight)
curl -i -X OPTIONS https://hms.aurex.in/api/v1/analytics/performance \
  -H "Origin: https://hms.aurex.in" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type"

# Should return 204 No Content with CORS headers
```

#### Test Different Origins

```bash
# Allowed origin (should work)
curl -i https://hms.aurex.in/api/v1/analytics/performance \
  -H "Origin: https://hms.aurex.in"
# Should include: Access-Control-Allow-Origin: https://hms.aurex.in

# Disallowed origin (should fail)
curl -i https://hms.aurex.in/api/v1/analytics/performance \
  -H "Origin: https://malicious.com"
# Should NOT include CORS headers
```

#### Test Credentials

```bash
# With credentials
curl -i -b "session=12345" https://apihms.aurex.in/api/v1/profile \
  -H "Origin: https://hms.aurex.in"
# Should include: Access-Control-Allow-Credentials: true
```

### 3. NGINX Configuration Testing

#### Test Configuration Syntax

```bash
sudo nginx -t
sudo nginx -T  # Show full configuration
```

#### Test Rate Limiting

```bash
# Test API rate limit (should allow 100 req/s)
ab -n 1000 -c 100 https://apihms.aurex.in/api/v1/health

# Test auth limit (should allow 10 req/15min)
for i in {1..15}; do
  curl -X POST https://apihms.aurex.in/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}'
  echo "Request $i"
done
```

#### Test Proxy Headers

```bash
# Check X-Forwarded headers are passed through
curl -i https://apihms.aurex.in/api/v1/debug/headers \
  -H "X-Correlation-ID: test-123"

# Should see in response:
# x-correlation-id: test-123
# x-forwarded-for: <your-ip>
# x-forwarded-proto: https
```

#### Test gRPC Endpoint

```bash
# Test gRPC connectivity
grpcurl -plaintext hms-app:50051 list

# Test through NGINX HTTPS
grpcurl -d '{"strategy_id":"TEST"}' \
  https://apihms.aurex.in/hms.analytics.AnalyticsService/GetPerformanceMetrics

# Test with mTLS
grpcurl -cacert ca.crt -cert client.crt -key client.key \
  https://apihms.aurex.in/hms.analytics.AnalyticsService/GetPerformanceMetrics
```

### 4. Security Headers Testing

#### Verify All Security Headers

```bash
# Get all headers
curl -I https://hms.aurex.in/ | grep -i "X-\|Content-Security\|Strict"

# Should include:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-Frame-Options: SAMEORIGIN (frontend) or DENY (API)
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
# Content-Security-Policy: (restrictive policy)
# Referrer-Policy: strict-origin-when-cross-origin (frontend) or no-referrer (API)
# Permissions-Policy: geolocation=(), microphone=(), camera=()
```

#### Test CSP Headers

```bash
# Verify CSP allows necessary domains
curl -I https://hms.aurex.in/ | grep "Content-Security-Policy"

# Test CSP violation reporting (if configured)
curl -X POST https://hms.aurex.in/csp-report \
  -H "Content-Type: application/json" \
  -d '{"csp-report":{"document-uri":"https://hms.aurex.in"}}'
```

### 5. Performance Testing

#### Test HTTP/2

```bash
# Check HTTP/2 support
curl -I --http2 https://hms.aurex.in/
# Should show: HTTP/2 200

# Compare with HTTP/1.1
curl -I --http1.1 https://hms.aurex.in/
# Should show: HTTP/1.1 200 (but slower)
```

#### Test Gzip Compression

```bash
# With compression
curl -I -H "Accept-Encoding: gzip" https://hms.aurex.in/api/v1/data
# Should include: Content-Encoding: gzip

# Without compression
curl -I https://hms.aurex.in/api/v1/data | grep Content-Encoding
# Should be empty or not present
```

#### Test Caching

```bash
# Check static asset caching
curl -I https://hms.aurex.in/static/app.js
# Should include: Cache-Control: public, immutable, max-age=31536000

# Check API caching (should not cache)
curl -I https://apihms.aurex.in/api/v1/profile
# Should NOT include Cache-Control or have: no-cache, no-store
```

### 6. Load Testing

```bash
# Using Apache Bench
ab -n 10000 -c 100 -g results.tsv https://apihms.aurex.in/api/v1/health

# Using k6
k6 run --vus 100 --duration 30s load-test.js

# Using wrk
wrk -t8 -c100 -d30s https://apihms.aurex.in/api/v1/health
```

---

## Troubleshooting

### Issue 1: CORS Errors in Browser Console

**Error**: "Access to XMLHttpRequest blocked by CORS policy"

**Diagnosis**:
```bash
# Check if preflight request succeeds
curl -X OPTIONS https://apihms.aurex.in/api/v1/profile \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

**Solutions**:
1. Verify origin is in whitelist: `nginx-hms-production.conf` line 207
2. Check Express CORS configuration: `backend/src/app.ts` getCorsOrigin function
3. Verify NGINX preflight handler: `nginx-hms-production.conf` lines 280-291

**Fix**:
```nginx
# Update allowed origins in NGINX map (line 207)
map $http_origin $cors_origin {
    "~^https://your-domain\.com$" $http_origin;
    "~^https://subdomain\.your-domain\.com$" $http_origin;
}

# Update Express allowed origins (backend/src/app.ts)
const allowedOrigins = [
  'https://your-domain.com',
  'https://subdomain.your-domain.com'
];
```

### Issue 2: HTTPS Certificate Errors

**Error**: "NET::ERR_CERT_AUTHORITY_INVALID" or similar

**Diagnosis**:
```bash
# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -dates -noout

# Check certificate chain
openssl s_client -connect hms.aurex.in:443 -showcerts

# Test with curl
curl -vI https://hms.aurex.in/
```

**Solutions**:
1. Certificate may be expired (renew with `certbot renew`)
2. Certificate path may be wrong (verify in `nginx-hms-production.conf`)
3. Private key permissions may be incorrect

**Fix**:
```bash
# Verify certificate paths
sudo ls -la /etc/letsencrypt/live/aurexcrt1/

# Fix permissions if needed
sudo chmod 644 /etc/letsencrypt/live/aurexcrt1/fullchain.pem
sudo chmod 600 /etc/letsencrypt/live/aurexcrt1/privkey.pem

# Renew certificate
sudo certbot renew --force-renewal

# Reload NGINX
sudo systemctl reload nginx
```

### Issue 3: 502 Bad Gateway

**Error**: "502 Bad Gateway" from NGINX

**Diagnosis**:
```bash
# Check NGINX error log
sudo tail -50 /var/log/nginx/error.log

# Check if backend is running
docker-compose ps
curl http://localhost:3001/health

# Check upstream configuration
sudo nginx -T | grep -A5 "upstream hms_backend"
```

**Solutions**:
1. Backend service (hms-app:3001) is not running
2. NGINX cannot reach backend (network issue)
3. Upstream configuration is wrong
4. Backend is rejecting connections

**Fix**:
```bash
# Restart backend container
docker-compose restart hms-app

# Check if NGINX can reach backend
sudo docker exec hms-nginx curl http://hms-app:3001/health

# Verify upstream health
curl http://localhost:8080/status | grep upstream
```

### Issue 4: Rate Limiting False Positives

**Error**: "Too many requests" on legitimate traffic

**Diagnosis**:
```bash
# Check rate limit zone configuration
sudo nginx -T | grep "limit_req_zone"

# Monitor requests in real-time
sudo tail -f /var/log/nginx/access.log | grep "429\|503"

# Check if behind proxy (may group IPs)
curl -H "X-Forwarded-For: 1.2.3.4" https://apihms.aurex.in/health
```

**Solutions**:
1. Rate limits may be too strict for your traffic
2. Multiple users behind same IP (corporate proxy)
3. Health checks hitting rate limits

**Fix**:
```nginx
# Increase rate limits for legitimate traffic
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=200r/s;

# Exclude health checks from rate limiting
location /health {
    access_log off;
    return 200 "OK\n";
}

# Reload NGINX
sudo systemctl reload nginx
```

### Issue 5: gRPC Connection Failures

**Error**: "UNAVAILABLE: No connection established" or "DEADLINE_EXCEEDED"

**Diagnosis**:
```bash
# Check gRPC endpoint accessibility
grpcurl -plaintext localhost:50051 list

# Check through NGINX
grpcurl https://apihms.aurex.in/hms.analytics.AnalyticsService/GetPerformanceMetrics -v

# Check if backend gRPC server is running
docker-compose logs hms-app | grep -i grpc
```

**Solutions**:
1. gRPC backend (port 50051) not running
2. NGINX gRPC proxy not configured correctly
3. HTTP/2 requirement not met

**Fix**:
```bash
# Verify gRPC server is running
docker-compose ps | grep hms-app

# Check NGINX has correct gRPC configuration
sudo grep -A20 "location /hms.analytics" /etc/nginx/sites-enabled/hms.conf

# Verify HTTP/2 is being used
curl -I --http2 https://apihms.aurex.in/

# Test gRPC with TLS
grpcurl -cacert ca.crt https://apihms.aurex.in/hms.analytics.AnalyticsService/GetPerformanceMetrics
```

### Issue 6: WebSocket Connection Failures

**Error**: "WebSocket is closed before the connection is established" or 1006 abnormal closure

**Diagnosis**:
```bash
# Check WebSocket endpoint
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  https://apihms.aurex.in/ws/

# Check NGINX WebSocket configuration
sudo grep -A20 "location /ws/" /etc/nginx/sites-enabled/hms.conf

# Monitor connections
sudo ss -tlnp | grep 3001
```

**Solutions**:
1. Proxy upgrade headers not set correctly
2. Timeouts too short
3. Buffering preventing WebSocket upgrade

**Fix**:
```nginx
# Ensure WebSocket proxy is configured correctly
location /ws/ {
    proxy_pass http://hms_backend;
    proxy_http_version 1.1;

    # Critical for WebSocket
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Long timeouts for persistent connections
    proxy_send_timeout 3600s;
    proxy_read_timeout 3600s;

    # Disable buffering
    proxy_buffering off;
    proxy_request_buffering off;
}

# Reload NGINX
sudo systemctl reload nginx
```

---

## Maintenance and Monitoring

### Certificate Renewal Monitoring

```bash
# Check certificate expiration
sudo certbot certificates

# Set up renewal reminders
# Certbot automatically renews via systemd timer
systemctl status certbot.timer

# Manual renewal if needed
sudo certbot renew --force-renewal --nginx
```

### NGINX Log Monitoring

```bash
# Monitor access in real-time
sudo tail -f /var/log/nginx/hms-api-access.json.log | jq .

# Find slow requests
sudo grep "rt=" /var/log/nginx/access.log | awk '{print $NF}' | sort -rn | head -10

# Count 4xx errors
sudo grep " 4.. " /var/log/nginx/access.log | wc -l

# Count 5xx errors
sudo grep " 5.. " /var/log/nginx/access.log | wc -l
```

### Performance Monitoring

```bash
# Check NGINX internal metrics
curl http://localhost:8080/status

# Monitor upstream health
curl http://localhost:8080/status | grep -A10 "upstream"

# Check connection count
netstat -an | grep ESTABLISHED | wc -l
```

---

## References and Resources

- **NGINX Documentation**: https://nginx.org/en/docs/
- **Mozilla SSL Configuration Generator**: https://ssl-config.mozilla.org/
- **Let's Encrypt Documentation**: https://letsencrypt.org/docs/
- **CORS Specification**: https://www.w3.org/TR/cors/
- **gRPC over HTTP/2**: https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md
- **OWASP Security Headers**: https://owasp.org/www-project-secure-headers/

---

**Document Version**: 1.0.0
**Date**: November 3, 2025
**HMS Version**: v2.2.0
**Status**: Production Ready ✅
