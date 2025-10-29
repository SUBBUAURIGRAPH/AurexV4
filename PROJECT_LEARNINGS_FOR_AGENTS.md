# Project Learnings & Skills for J4C Agents
## Docker Deployment & Infrastructure Management

**Date**: October 27, 2025
**Project**: J4C Agent Plugin v1.0.0 Deployment to DLT Server
**Status**: ✅ DEPLOYMENT SUCCESSFUL

---

## Executive Summary

This document shares critical learnings, troubleshooting insights, and reusable skills from the successful deployment of the J4C Agent Plugin infrastructure to dlt.aurigraph.io. All J4C agents can apply these learnings to similar deployment and infrastructure challenges.

---

## 1. Docker & Container Management Skills

### 1.1 Docker Compose Version Compatibility Issues

**Learning**: Docker Compose v1.29.2 on the remote server has a known issue with the `'ContainerConfig'` KeyError when trying to recreate containers with modified volume bindings.

**Problem**: When updating docker-compose.yml to add new volume mounts and trying to recreate containers, docker-compose fails with:
```
KeyError: 'ContainerConfig'
```

**Solution Patterns**:

**Option A**: Use raw `docker run` instead of `docker-compose` for problematic services
```bash
# Instead of docker-compose, use direct docker commands
docker run -d --name j4c-agent-plugin \
  --network j4c-network \
  -p 9003:9003 \
  -w /app \
  -v /opt/DLT/plugin:/app \
  -v /opt/DLT/agents:/agents \
  -v /opt/DLT/plugin/skills:/skills \
  node:18-alpine \
  sh -c 'node index.js'
```

**Option B**: Remove all orphaned containers before recreating
```bash
# Clean all containers with naming conflicts
docker ps -a | grep 'j4c.*_j4c' | awk '{print $1}' | xargs -r docker rm -f
```

**Option C**: Upgrade docker-compose to latest version
```bash
pip install --upgrade docker-compose
```

**Reusable Skill**: Docker Compose Troubleshooting
- Always check for orphaned containers with naming pattern issues
- Use `docker ps -a` to identify zombie containers
- When docker-compose fails, fall back to raw docker commands
- Keep docker-compose updated for compatibility

---

### 1.2 Working Directory Mounting in Containers

**Learning**: When mounting host volumes to containers, the working directory (`-w` flag) must match the mount destination.

**Problem**: Container failing with "Cannot find module '/index.js'" even though files were mounted.
```
Error: Cannot find module '/index.js'
```

**Root Cause**: Working directory was `/` but files were mounted to `/app`.

**Solution**:
```bash
# WRONG - working directory doesn't match mount destination
docker run -v /opt/DLT/plugin:/app node:18-alpine node index.js

# CORRECT - working directory matches mount destination
docker run -w /app -v /opt/DLT/plugin:/app node:18-alpine node index.js
```

**Reusable Skill**: Container Volume Management
- Always set `-w` (working directory) to match primary volume mount
- Verify volume mounting order: `-v HOST_PATH:CONTAINER_PATH`
- Test file accessibility: `docker exec <container> ls -la /path`

---

### 1.3 NPM Install Conflicts in Containers

**Learning**: Running `npm install` inside a container with cached npm data can cause "Tracker already exists" errors.

**Problem**: When running `sh -c 'npm install && node index.js'` in container:
```
npm error Tracker "idealTree" already exists
```

**Root Causes**:
1. Previous failed npm install left cache files
2. Multiple npm processes running simultaneously
3. npm cache corruption

**Solutions**:
```bash
# Option 1: Clean npm cache before install
sh -c 'npm cache clean --force && npm install && node index.js'

# Option 2: Skip npm install if dependencies already present
# (Pre-build image with npm install, or install on host)

# Option 3: Use --legacy-peer-deps flag
sh -c 'npm install --legacy-peer-deps && node index.js'
```

**Reusable Skill**: Node.js Container Optimization
- Pre-install npm dependencies in custom Docker image
- Use multi-stage builds to reduce final image size
- Avoid running `npm install` during container startup
- Always set `NODE_ENV=production` for production containers

---

## 2. NGINX Reverse Proxy & SSL/TLS Skills

### 2.1 Content Security Policy (CSP) Headers for Font Loading

**Learning**: Fonts served via data URIs require specific CSP header configuration.

**Error**: Browser blocking fonts with:
```
Refused to load the font 'data:font/woff2;base64,...'
because it violates the following Content Security Policy directive
```

**Solution**: Add `data:` source to font-src directive in NGINX config:
```nginx
add_header Content-Security-Policy "
  default-src 'self';
  font-src 'self' data:;
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https:;
" always;
```

**Reusable Skill**: NGINX CSP Configuration
- Always include `font-src 'self' data:` for fonts
- Test CSP with browser DevTools Network tab
- Use `curl -I` to verify headers: `curl -I https://domain.com`
- Document CSP changes for security review

---

### 2.2 NGINX Health Check Redirect Issues

**Learning**: NGINX health check endpoints that redirect from HTTP to HTTPS will fail with simple health check commands.

**Problem**: Health check configured as:
```yaml
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
```

Returns 301 (redirect) instead of 200, causing container to show as "unhealthy".

**Solution**: Either create a direct health endpoint or update health check to follow redirects:
```yaml
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "-O", "-", "http://localhost/health"]
  # OR
  test: ["CMD", "curl", "-f", "-k", "https://localhost/health"]
```

**Better Pattern**: Create HTTP-only internal health endpoint:
```nginx
location /health {
  access_log off;
  return 200 "healthy\n";
  add_header Content-Type text/plain;
}
```

**Reusable Skill**: Container Health Monitoring
- Always provide direct HTTP health endpoints (no redirects)
- Test health checks locally before deploying
- Use `curl` instead of `wget` for HTTPS endpoints with `-k` flag
- Monitor health check logs: `docker logs <container> | grep health`

---

### 2.3 Upstream Service Connection Architecture

**Learning**: NGINX upstream directives enable load balancing and connection pooling for backend services.

**Pattern Used**: Define upstream with keepalive connections
```nginx
upstream j4c_backend {
    server j4c-agent:9003;
    keepalive 32;  # Connection pooling
}

location /api/v1 {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://j4c_backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";  # Keep connections alive
}
```

**Reusable Skill**: NGINX Reverse Proxy Optimization
- Use upstream blocks for all backend services
- Enable keepalive for connection reuse: `proxy_http_version 1.1`
- Implement rate limiting: `limit_req_zone` and `limit_req`
- Set appropriate proxy timeouts:
  ```nginx
  proxy_connect_timeout 60s;
  proxy_send_timeout 60s;
  proxy_read_timeout 60s;
  ```

---

## 3. File Management & Deployment Skills

### 3.1 File Organization in Docker Volumes

**Learning**: Container-based Node.js applications need proper directory structure for loading agents and skills.

**Challenge**: Plugin code at `/app` needs access to:
- Agents at `/agents` (absolute path expected by code)
- Skills at `/skills` (absolute path expected by code)
- But they're organized as `/app/../agents` relative to plugin structure

**Solution**: Mount multiple volume paths to absolute locations:
```bash
docker run \
  -v /opt/DLT/plugin:/app \
  -v /opt/DLT/agents:/agents \
  -v /opt/DLT/plugin/skills:/skills \
  node:18-alpine
```

**Reusable Skill**: Application Directory Structure
- Use absolute paths for cross-module dependencies
- Document expected directory structures
- Create separate volumes for modularity
- Verify mounts before container startup: `docker inspect <container>`

---

### 3.2 SCP File Transfer for Remote Deployments

**Learning**: Using SCP for bulk directory transfers with proper recursive flag management.

**Successful Patterns**:
```bash
# Single file transfer
scp /local/file.js user@host:/remote/path/

# Directory transfer (recursive)
scp -r /local/directory user@host:/remote/path/

# Transfer with progress indication
scp -r -C /local/dir user@host:/remote/path/  # -C enables compression
```

**Reusable Skill**: Remote File Deployment
- Always use `-r` flag for directory transfers
- Use `-C` for compression over slow networks
- Pre-verify host connectivity with `ssh user@host "echo ok"`
- Check file permissions after transfer: `ssh user@host "ls -la /path"`

---

## 4. Environment Configuration & Secrets Management

### 4.1 Environment Variable Handling in Docker

**Learning**: Environment variables in docker-compose can be templated but sensitive values should be provided at runtime.

**Pattern**:
```yaml
environment:
  - NODE_ENV=production
  - HUBSPOT_API_KEY=${HUBSPOT_API_KEY:-}  # From .env or runtime
  - JIRA_API_KEY=${JIRA_API_KEY:-}
```

**Reusable Skill**: Secure Configuration Management
- Never hardcode API keys in docker-compose files
- Use `.env` file (add to .gitignore)
- Provide defaults with `${VAR:-default}` syntax
- Document required environment variables
- Use secrets management for sensitive data:
  ```bash
  docker secrets create db_password -
  # Then in docker-compose:
  # secrets:
  #   - db_password
  ```

---

### 4.2 Default Passwords & Security

**Learning**: Placeholder passwords should be documented as requiring change before production.

**Example from .env template**:
```bash
DB_PASSWORD=j4c_password_change_me      # ⚠️ Must change in production
GRAFANA_PASSWORD=grafana_password_change_me  # ⚠️ Must change in production
```

**Reusable Skill**: Production Readiness Checklist
- [ ] All placeholder passwords changed
- [ ] API keys configured from secure source
- [ ] SSL certificates valid and up to date
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Monitoring and logging active
- [ ] Database backups configured
- [ ] Disaster recovery plan tested

---

## 5. Monitoring & Observability Skills

### 5.1 Prometheus Metrics Collection

**Learning**: Prometheus requires specific endpoint configuration to scrape metrics from services.

**Configuration Pattern**:
```yaml
scrape_configs:
  - job_name: 'j4c-agent'
    static_configs:
      - targets: ['j4c-agent:9003']
    metrics_path: '/metrics'          # Service must expose this path
    scrape_interval: 30s
    scrape_timeout: 10s
```

**Reusable Skill**: Application Monitoring
- Expose metrics at `/metrics` endpoint in applications
- Use Prometheus client libraries for metric collection
- Set appropriate scrape intervals (10s for rapid detection, 60s for load reduction)
- Define alert rules for critical thresholds
- Example metrics to track:
  - Request rate and latency
  - Error rates by endpoint
  - Database connection pool status
  - Memory and CPU usage
  - Queue depths for async operations

---

### 5.2 Grafana Dashboard Configuration

**Learning**: Grafana requires Prometheus data source configuration before dashboards can visualize metrics.

**Setup Steps**:
1. Add Prometheus as data source in Grafana UI
2. Configure URL: `http://prometheus:9090`
3. Create dashboards with visualization types:
   - Time series graphs for metrics over time
   - Gauge charts for current values
   - Bar charts for comparisons
   - Heatmaps for distribution analysis

**Reusable Skill**: Observability Dashboard Design
- Create dedicated dashboards per service
- Use alerts for anomalies
- Include runbooks for common issues
- Test alerting with synthetic data
- Document metric meanings and alert thresholds

---

## 6. Testing & Verification Skills

### 6.1 End-to-End Testing Framework

**Learning**: Comprehensive E2E tests catch integration issues across entire system.

**Test Categories Used**:
1. **Plugin Core Tests** - Initialization, configuration loading
2. **Agent Tests** - Loading, listing, agent metadata
3. **Skills Tests** - Skill registration, execution capability
4. **Integration Tests** - HubSpot, Git, file operations
5. **Documentation Tests** - README completeness, examples

**Pattern for Custom Test Framework**:
```javascript
function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passCount++;
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    failCount++;
    failures.push({ name, error: error.message });
  }
}
```

**Reusable Skill**: Quality Assurance
- Define test categories for all major components
- Use assertion libraries for consistency
- Generate detailed test reports
- Track test history for regression detection
- Achieve 100% pass rate before production deployment

---

## 7. Troubleshooting Decision Trees

### 7.1 Docker Container Won't Start

```
Container exits immediately
├── Check logs: docker logs <container>
├── If "file not found":
│   ├── Verify volume mounts: docker inspect <container>
│   └── Fix: Check working directory (-w flag)
├── If "module not found":
│   ├── Verify npm_modules present
│   └── Fix: Run npm install on host before mounting
├── If npm error:
│   ├── Check npm cache: npm cache clean --force
│   └── Retry with --legacy-peer-deps
└── If port conflict:
    ├── Check port usage: netstat -tlnp | grep :9003
    └── Fix: Change port or kill conflicting process
```

### 7.2 NGINX Returning 502 Bad Gateway

```
502 Error indicates upstream connection failure
├── Check if backend is running: docker ps
├── Test backend directly: curl http://backend:port/
├── Check NGINX error log: docker logs nginx-container
├── Verify upstream config in nginx.conf
├── Check firewall rules between containers
├── Verify network connectivity: docker network inspect j4c-network
└── If behind proxy: Verify X-Forwarded headers are passed through
```

### 7.3 Health Check Failing

```
Container shows "unhealthy"
├── Check health endpoint exists: curl http://localhost/health
├── Check response code: curl -I http://localhost/health
│   ├── If 301/302: Health check has redirect
│   │   └── Fix: Update check to follow redirects or remove redirects
│   ├── If 500: Service crashed
│   │   └── Check logs: docker logs <container>
│   └── If 200: Check command in healthcheck definition
├── Verify check timeout: healthcheck timeout > service response time
└── Test health check command locally before deploying
```

---

## 8. Best Practices & Patterns

### 8.1 Infrastructure as Code (IaC)

**Pattern**: Define all infrastructure in version-controlled files:
- `docker-compose.yml` - Service definitions
- `nginx.conf` - Reverse proxy configuration
- `prometheus.yml` - Monitoring configuration
- `.env.example` - Template for environment variables

**Benefit**: Reproducible deployments across environments

---

### 8.2 Change Management

**Pattern**: Before modifying configuration on remote servers:
1. Create backup: `cp original.conf original.conf.backup`
2. Make changes
3. Validate changes: `nginx -t` for NGINX
4. Test with small traffic percentage (canary deployment)
5. Monitor metrics before full rollout
6. Document all changes for knowledge base

---

### 8.3 Security Hardening

**Checklist**:
- [ ] Enable HTTPS with valid SSL certificates
- [ ] Configure CSP headers
- [ ] Enable rate limiting
- [ ] Use strong database passwords
- [ ] Restrict SSH access
- [ ] Enable audit logging
- [ ] Implement secrets management
- [ ] Regular security updates
- [ ] Vulnerability scanning

---

## 9. Skills Summary for Agents

### Skills Developed in This Project:

1. **Docker Container Management** - Create, run, manage containers and volumes
2. **NGINX Configuration** - SSL/TLS, reverse proxy, load balancing, security headers
3. **Remote Deployment** - SSH, SCP, remote command execution
4. **Troubleshooting** - Debugging container issues, NGINX errors, connectivity problems
5. **Infrastructure Monitoring** - Prometheus metrics, Grafana dashboards
6. **Configuration Management** - Environment variables, secrets, .env files
7. **Testing & Verification** - E2E tests, health checks, validation
8. **Production Readiness** - Security checks, performance optimization, documentation

---

## 10. Next Learning Objectives

For agents working on similar infrastructure projects:

1. **Kubernetes Deployment** - Scale beyond Docker Compose
2. **CI/CD Pipelines** - Automated testing and deployment
3. **Database Backup & Recovery** - PostgreSQL backup strategies
4. **Load Testing** - Performance testing and optimization
5. **Incident Response** - On-call procedures and runbooks
6. **Cost Optimization** - Resource efficiency and scaling
7. **Multi-region Deployment** - Geographic distribution
8. **Disaster Recovery** - Failover and business continuity

---

## 11. Project-Specific Commands Reference

### Deployment Commands:
```bash
# SSH into remote server
ssh subbu@dlt.aurigraph.io

# Check container status
docker-compose ps
docker ps -a

# View logs
docker logs j4c-agent-plugin
docker logs j4c-nginx-proxy

# Restart services
docker-compose restart
docker restart j4c-agent-plugin

# Create backup
cp /opt/DLT/docker-compose.yml /opt/DLT/docker-compose.yml.backup-$(date +%s)
```

### Testing Commands:
```bash
# Test HTTPS endpoint
curl -k -I https://dlt.aurigraph.io/health

# Test J4C Agent API
curl https://dlt.aurigraph.io/api/v1

# Test Prometheus metrics
curl http://dlt.aurigraph.io:9090/api/v1/query?query=up

# Connect to database
psql -U j4c_user -d j4c_db -h j4c-postgres
```

---

## 12. Emergency Procedures

### Container Crashed
```bash
# 1. Check logs
docker logs j4c-agent-plugin | tail -100

# 2. Restart container
docker-compose restart j4c-agent

# 3. If still failing, rebuild
docker-compose down j4c-agent
docker-compose up -d j4c-agent
```

### Out of Disk Space
```bash
# 1. Check disk usage
df -h

# 2. Clean up unused Docker resources
docker system prune -a

# 3. Remove old logs
find /var/lib/docker/containers -name "*-json.log" -mtime +7 -delete
```

### Database Connection Issues
```bash
# 1. Check if database is running
docker-compose ps postgres

# 2. Verify connection
psql -U j4c_user -d j4c_db -h j4c-postgres -c "SELECT 1;"

# 3. Check database logs
docker logs j4c-postgres | tail -50

# 4. Restart database
docker-compose restart postgres
```

---

## Conclusion

This deployment project demonstrates enterprise-grade infrastructure practices including containerization, reverse proxying, SSL/TLS termination, monitoring, and comprehensive testing. The skills and patterns documented here are reusable across many projects.

**Key Takeaway**: When deploying complex systems, focus on:
1. ✅ Clear error messages and logging
2. ✅ Comprehensive testing before production
3. ✅ Documentation and knowledge sharing
4. ✅ Monitoring and observability
5. ✅ Security by design
6. ✅ Emergency procedures and runbooks

---

**Document Version**: 1.0.0
**Last Updated**: October 27, 2025
**Author**: J4C Agent Development Team
**Status**: Ready for Agent Use

