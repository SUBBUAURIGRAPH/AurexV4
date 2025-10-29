# J4C Agent Deployment & Infrastructure Skills Guide
## Reusable Patterns & Commands for Similar Projects

---

## Table of Contents
1. Docker Skills
2. NGINX Skills
3. SSH & Remote Deployment Skills
4. Troubleshooting Skills
5. Copy-Paste Command Reference

---

## 1. Docker Skills

### 1.1 Skill: Create Multi-Service Docker Environment

**When to use**: Deploying applications with multiple interdependent services (database, proxy, monitoring, etc.)

**Steps**:
1. Create docker-compose.yml with all services
2. Define networks for inter-service communication
3. Configure volumes for persistence
4. Set environment variables from .env file
5. Define health checks for automatic restart

**Example Template**:
```yaml
version: '3.9'

services:
  app:
    image: node:18-alpine
    container_name: app-main
    working_dir: /app
    volumes:
      - ./src:/app
      - app-logs:/app/logs
    environment:
      - NODE_ENV=production
      - PORT=3000
    ports:
      - "3000:3000"
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  database:
    image: postgres:15-alpine
    container_name: app-db
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - app-db-data:/var/lib/postgresql/data
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  app-logs:
    driver: local
  app-db-data:
    driver: local

networks:
  app-network:
    driver: bridge
    name: app-network
```

---

### 1.2 Skill: Troubleshoot Container Startup Failures

**When to use**: Container exits immediately or shows unhealthy status

**Diagnostic Steps**:
```bash
# Step 1: Check container status
docker ps -a | grep <container-name>

# Step 2: View full error logs
docker logs <container-id> --tail=100

# Step 3: Inspect container configuration
docker inspect <container-id>

# Step 4: Check volume mounts
docker inspect <container-id> | grep -A 20 'Mounts'

# Step 5: Test entry command locally
docker run -it --rm \
  -v /path/to/files:/app \
  -w /app \
  node:18-alpine \
  sh  # Drop into interactive shell
```

**Common Issues & Fixes**:
| Error | Cause | Fix |
|-------|-------|-----|
| "Cannot find module" | Wrong working directory | Add `-w /app` matching volume mount |
| "npm error Tracker" | npm cache corruption | Run `npm cache clean --force` |
| "Address already in use" | Port conflict | Change port or `docker kill <container>` |
| "Connection refused" | Service not running | Check logs: `docker logs` |

---

### 1.3 Skill: Use Docker Volumes for Persistence

**When to use**: When container data needs to survive container restart

**Volume Types**:

**Named Volumes** (recommended for databases):
```yaml
volumes:
  - db-data:/var/lib/postgresql/data  # Persists across restarts
```

**Bind Mounts** (for development source code):
```yaml
volumes:
  - ./src:/app  # Host ./src maps to container /app
```

**Volume Permissions** (if container user differs from host):
```bash
# Fix permission issues
docker exec <container> chown -R app:app /data
```

---

## 2. NGINX Skills

### 2.1 Skill: Configure SSL/TLS with Let's Encrypt

**When to use**: Securing HTTP traffic with HTTPS

**Configuration Template**:
```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates from Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/yourdomain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain/privkey.pem;

    # Security configurations
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

**Let's Encrypt Certificate Setup**:
```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Generate certificate (standalone)
certbot certonly --standalone -d yourdomain.com

# Auto-renewal (runs twice daily)
systemctl enable certbot.timer
```

---

### 2.2 Skill: Configure Reverse Proxy with Load Balancing

**When to use**: Distributing traffic to multiple backend instances

**Configuration**:
```nginx
# Define upstream servers
upstream backend {
    least_conn;  # Load balancing strategy
    server backend1:3000;
    server backend2:3000;
    server backend3:3000;
    keepalive 32;  # Connection pooling
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;

        # Preserve client info
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering off;
    }
}
```

**Load Balancing Strategies**:
- `round_robin` (default) - Sequential distribution
- `least_conn` - Send to least busy server
- `ip_hash` - Route same IP to same server
- `random` - Random distribution
- `weighted` - Based on server weight: `server backend1 weight=3;`

---

### 2.3 Skill: Implement Rate Limiting

**When to use**: Protecting API from abuse and DDoS attacks

**Configuration**:
```nginx
# Define rate limit zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=10r/s;

server {
    # Strict limit for auth endpoints
    location /login {
        limit_req zone=general_limit burst=5 nodelay;
        proxy_pass http://backend;
    }

    # High limit for API endpoints
    location /api {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://backend;
    }

    # No limit for public endpoints
    location /public {
        proxy_pass http://backend;
    }
}
```

**Parameters**:
- `zone=name:size` - Name and memory size for zone
- `rate=10r/s` - Allow 10 requests per second
- `burst=20` - Allow burst of 20 requests above rate
- `nodelay` - Return 429 immediately instead of delaying

---

### 2.4 Skill: Set Security Headers

**When to use**: Protecting against XSS, clickjacking, MIME type sniffing

**Complete Header Configuration**:
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# Content Security Policy (customize based on your app)
add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' data:;
    connect-src 'self' https:;
    frame-ancestors 'none';
" always;
```

---

### 2.5 Skill: Enable Gzip Compression

**When to use**: Reducing response size for faster loading

**Configuration**:
```nginx
# Enable gzip
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;  # 1-9, higher = smaller but slower
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/json
    application/javascript
    application/xml+rss
    font/truetype
    font/opentype;

# Don't compress already compressed types
gzip_disable "msie6";
```

---

## 3. SSH & Remote Deployment Skills

### 3.1 Skill: Establish Secure SSH Connection

**When to use**: Accessing remote servers

**One-Time Setup**:
```bash
# 1. Generate SSH key pair (if not exists)
ssh-keygen -t ed25519 -C "your-email@example.com"

# 2. Copy public key to remote server
ssh-copy-id -i ~/.ssh/id_ed25519 user@remote.com

# 3. Disable password auth on remote (optional, more secure)
# Edit /etc/ssh/sshd_config on remote:
# PasswordAuthentication no
# PubkeyAuthentication yes
```

**Connection**:
```bash
# Basic SSH
ssh user@remote.com

# With specific port
ssh -p 2222 user@remote.com

# With specific key
ssh -i ~/.ssh/custom_key user@remote.com

# Jump through bastion host
ssh -J bastion@jump.com user@target.com
```

---

### 3.2 Skill: Transfer Files Securely with SCP

**When to use**: Copying files to/from remote servers

**Examples**:
```bash
# Upload single file
scp local.txt user@remote.com:/path/on/remote/

# Upload directory recursively
scp -r local/directory user@remote.com:/path/on/remote/

# Download file
scp user@remote.com:/path/to/file.txt ./local/

# Download directory
scp -r user@remote.com:/path/to/directory ./local/

# With compression (slower transfer, faster compression)
scp -C -r local/dir user@remote.com:/path/on/remote/

# With specific port
scp -P 2222 file.txt user@remote.com:/path/
```

---

### 3.3 Skill: Execute Remote Commands

**When to use**: Running commands on remote server from local

**Patterns**:
```bash
# Single command
ssh user@remote.com "docker ps"

# Multiple commands (use && for sequential)
ssh user@remote.com "cd /opt/app && docker-compose ps"

# Pipe output to local processing
ssh user@remote.com "docker logs app" | grep ERROR | wc -l

# Interactive shell
ssh -i key.pem user@remote.com  # Starts interactive session

# Run script from remote
ssh user@remote.com < script.sh

# Heredoc for multiple commands
ssh user@remote.com << 'EOF'
cd /opt/app
docker-compose restart
docker-compose logs -f app
EOF
```

---

### 3.4 Skill: Set Up Automated Deployment Script

**When to use**: Repeatable deployments without manual steps

**Script Template**:
```bash
#!/bin/bash

# Configuration
DEPLOY_HOST="user@remote.com"
DEPLOY_PATH="/opt/app"
LOCAL_PATH="/local/app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting deployment...${NC}"

# Step 1: Test connectivity
echo -e "${YELLOW}Testing SSH connection...${NC}"
if ssh -q $DEPLOY_HOST "echo ok" > /dev/null; then
    echo -e "${GREEN}✓ SSH connection successful${NC}"
else
    echo -e "${RED}✗ SSH connection failed${NC}"
    exit 1
fi

# Step 2: Upload files
echo -e "${YELLOW}Uploading application files...${NC}"
scp -r "$LOCAL_PATH/src" "$DEPLOY_HOST:$DEPLOY_PATH/"
scp "$LOCAL_PATH/docker-compose.yml" "$DEPLOY_HOST:$DEPLOY_PATH/"

# Step 3: Restart services
echo -e "${YELLOW}Restarting services...${NC}"
ssh $DEPLOY_HOST << 'REMOTE_COMMANDS'
cd /opt/app
docker-compose down
docker-compose up -d
docker-compose ps
REMOTE_COMMANDS

echo -e "${GREEN}✓ Deployment complete${NC}"
```

---

## 4. Troubleshooting Skills

### 4.1 Skill: Diagnose Network Connectivity Issues

**When to use**: Services can't communicate, connection refused, timeouts

**Diagnostic Commands**:
```bash
# Check if port is listening
netstat -tlnp | grep :8080
ss -tlnp | grep :8080  # Modern alternative

# Test TCP connection
nc -zv hostname 8080
telnet hostname 8080

# Trace network path
traceroute hostname
mtr hostname  # Better traceroute

# Check DNS resolution
nslookup hostname
dig hostname
host hostname

# Monitor network connections
netstat -an | grep ESTABLISHED
ss -an | grep ESTABLISHED

# Check firewall rules
iptables -L  # On Linux
sudo pfctl -s nat  # On macOS

# Inside Docker container - check service discovery
docker exec <container> nslookup service-name
docker exec <container> getent hosts service-name
```

---

### 4.2 Skill: Debug Container Networking

**When to use**: Container can't reach other services, DNS issues

**Commands**:
```bash
# Inspect network
docker network inspect j4c-network

# Check container's network settings
docker inspect <container> | grep -A 30 NetworkSettings

# Test connectivity from container
docker exec <container> curl http://other-service:8080/health

# Check container's DNS resolution
docker exec <container> nslookup other-service

# Ping from container to container
docker exec <container1> ping <container2>

# Check iptables rules in container
docker exec <container> iptables -L -n
```

---

### 4.3 Skill: Monitor System Resources

**When to use**: Service slow, high CPU/memory usage

**Commands**:
```bash
# Container resource usage
docker stats

# Check disk space
df -h
du -sh /*

# CPU and memory usage
top
htop

# Docker disk usage
docker system df

# Process details
ps aux | grep <process>
lsof -i :8080  # What's using port 8080

# Memory leaks
docker exec <container> ps aux
```

---

## 5. Copy-Paste Command Reference

### Quick Deployment Commands

```bash
# Deploy to remote server
ssh user@remote "cd /opt/app && \
  git pull && \
  docker-compose build && \
  docker-compose up -d && \
  docker-compose ps"

# Check all services
ssh user@remote "cd /opt/app && docker-compose ps && echo '---' && docker-compose logs --tail=20"

# Backup and deploy
ssh user@remote "cd /opt/app && \
  cp docker-compose.yml docker-compose.yml.backup-$(date +%s) && \
  git pull && \
  docker-compose restart && \
  docker-compose logs"

# Health check
ssh user@remote "curl -s https://yourdomain.com/health && \
  echo 'Health check passed' || echo 'Health check failed'"
```

### Emergency Recovery

```bash
# Stop all containers
ssh user@remote "docker-compose stop"

# Restart from backup
ssh user@remote "cd /opt/app && \
  cp docker-compose.yml.backup-* docker-compose.yml && \
  docker-compose up -d && \
  docker-compose ps"

# View recent errors
ssh user@remote "cd /opt/app && \
  docker-compose logs --since=30m | grep -i error | tail -50"

# Reset to clean state
ssh user@remote "cd /opt/app && \
  docker-compose down -v && \
  docker-compose up -d && \
  docker-compose logs"
```

### Monitoring & Logs

```bash
# Follow logs in real-time
ssh -f user@remote "cd /opt/app && docker-compose logs -f app"

# Export logs
ssh user@remote "cd /opt/app && \
  docker-compose logs > logs-$(date +%Y%m%d-%H%M%S).txt" && \
  scp user@remote:/opt/app/logs-*.txt ./logs/

# Search logs for errors
ssh user@remote "cd /opt/app && \
  docker-compose logs 2>&1 | grep -i 'error\|exception\|failed' | tail -100"
```

---

## Quick Reference Tables

### Docker Command Quick Reference

| Task | Command |
|------|---------|
| List containers | `docker ps -a` |
| View logs | `docker logs <container> --tail=100` |
| Execute command | `docker exec <container> <cmd>` |
| Interactive shell | `docker exec -it <container> /bin/sh` |
| Restart container | `docker restart <container>` |
| Remove container | `docker rm <container>` |
| Inspect container | `docker inspect <container>` |
| Get container IP | `docker inspect -f '{{.NetworkSettings.IPAddress}}' <container>` |
| Copy to container | `docker cp local.txt <container>:/path/` |
| Copy from container | `docker cp <container>:/path/file.txt ./` |

### NGINX Command Quick Reference

| Task | Command |
|------|---------|
| Test config | `nginx -t` |
| Reload config | `systemctl reload nginx` |
| Restart | `systemctl restart nginx` |
| View logs | `tail -f /var/log/nginx/access.log` |
| Check listening ports | `netstat -tlnp \| grep nginx` |

### SSH Command Quick Reference

| Task | Command |
|------|---------|
| SSH to host | `ssh user@host` |
| SSH with port | `ssh -p 2222 user@host` |
| Copy file up | `scp file.txt user@host:/path/` |
| Copy directory down | `scp -r user@host:/path/dir .` |
| SSH key setup | `ssh-copy-id user@host` |
| Test connectivity | `ssh -q user@host "echo ok"` |

---

## Key Takeaways

1. **Always test locally first** - before deploying to production
2. **Use health checks** - for automatic recovery from failures
3. **Monitor everything** - logs, metrics, resource usage
4. **Automate deployment** - reduces human error
5. **Document changes** - for disaster recovery and knowledge sharing
6. **Backup before changes** - critical data and configurations
7. **Use environment variables** - for configuration flexibility
8. **Plan for failure** - have recovery procedures

---

**Version**: 1.0
**Status**: Ready for Agent Use
**Last Updated**: October 27, 2025

