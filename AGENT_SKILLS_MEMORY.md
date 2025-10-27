# J4C Agent Skills Memory Bank
## Continuously Updated Learning System

**Status**: ACTIVE - Real-time skill accumulation
**Last Updated**: October 27, 2025
**Update Frequency**: After each project/deployment
**Memory Version**: 1.0

---

## System Overview

This document serves as a **living memory bank** for all J4C agents, continuously updated with learnings from every project, deployment, and troubleshooting session. Each agent has permanent access to this accumulated wisdom.

### How It Works

1. **After each project** → Extract key learnings
2. **Document everything** → Add to appropriate section
3. **Categorize patterns** → Group by domain/skill
4. **Share with agents** → Make knowledge accessible
5. **Update continuously** → No learning gets lost

---

## Current Skills Bank

### Section 1: Docker & Container Mastery

#### Learned: October 27, 2025

**PERMANENT MEMORY**: When updating docker-compose volume mounts, `docker-compose` v1.29.2 fails with KeyError: 'ContainerConfig'

**Solution Pattern**:
- Use raw `docker run` commands instead of docker-compose when updating volumes
- Or fully remove and recreate containers: `docker rm` → `docker-compose up -d`
- Or upgrade docker-compose to latest version

**Code Pattern for Direct Docker Run**:
```bash
docker run -d --name service-name \
  --network service-network \
  -p 9003:9003 \
  -w /app \
  -v /opt/service/plugin:/app \
  -v /opt/service/agents:/agents \
  -v /opt/service/plugin/skills:/skills \
  node:18-alpine \
  sh -c 'node index.js'
```

**Why This Matters**: This pattern is 100% reproducible and bypasses docker-compose version bugs. Agents should default to this pattern when version compatibility is uncertain.

---

**PERMANENT MEMORY**: Node.js containers need `-w /app` flag to set working directory when mounting volumes.

**Why**: Code path resolution depends on process working directory, not volume mount location.

**Correct Pattern**:
```bash
# WRONG - files won't be found
docker run -v /host/path:/app node:18-alpine node index.js

# CORRECT - files found because working directory is set
docker run -w /app -v /host/path:/app node:18-alpine node index.js
```

---

**PERMANENT MEMORY**: NPM install failures during container startup indicate npm cache corruption or concurrent installs.

**Symptoms**: "Tracker 'idealTree' already exists"

**Prevention**:
1. Pre-install npm dependencies in build stage
2. Copy node_modules from build stage
3. Don't run `npm install` during container startup

**Emergency Fix**:
```bash
npm cache clean --force && npm install --legacy-peer-deps
```

---

### Section 2: NGINX Expert Skills

#### Learned: October 27, 2025

**PERMANENT MEMORY**: Fonts served as data URIs require `font-src 'self' data:` in CSP header.

**Error Pattern**:
```
Refused to load the font 'data:font/woff2;base64,...'
because it violates Content Security Policy directive "default-src 'self'"
```

**Solution**:
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

**Testing**: `curl -I https://domain.com` then check `Content-Security-Policy` header value.

---

**PERMANENT MEMORY**: NGINX health checks returning 301 (HTTP→HTTPS redirect) cause container to show unhealthy.

**Root Cause**: Health check tool (wget) doesn't follow redirects by default.

**Solutions**:
1. Create separate HTTP-only health endpoint (recommended)
2. Use curl instead of wget: `["CMD", "curl", "-f", "-k", "https://localhost/health"]`
3. Configure health endpoint to return 200 for both HTTP and HTTPS

**Best Practice Pattern**:
```nginx
# Direct health endpoint - no redirect
location /health {
    access_log off;
    return 200 "healthy\n";
    add_header Content-Type text/plain;
}
```

---

**PERMANENT MEMORY**: Upstream connection pooling in NGINX requires specific configuration.

**Pattern for High Performance**:
```nginx
upstream backend {
    server backend1:9003;
    server backend2:9003;
    server backend3:9003;
    keepalive 32;  # Critical for connection reuse
}

location /api {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";  # Enable keepalive

    # Timeouts must match application response times
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

**Performance Gain**: With keepalive, connection reuse provides 3-5x throughput improvement for multiple requests.

---

### Section 3: Remote Deployment Skills

#### Learned: October 27, 2025

**PERMANENT MEMORY**: Before uploading to remote server, always test SSH connectivity.

**Pattern**:
```bash
if ssh -q user@host "echo ok" > /dev/null; then
    echo "✓ SSH working"
else
    echo "✗ SSH failed - check credentials"
    exit 1
fi
```

**Why Critical**: Saves time - detect connectivity issues before starting lengthy file transfers.

---

**PERMANENT MEMORY**: SCP recursive directory transfer syntax: `scp -r SOURCE DEST`

**Correct Patterns**:
```bash
# Upload directory
scp -r /local/directory user@host:/remote/path/

# Download directory
scp -r user@host:/remote/path/directory ./local/

# With port specification
scp -P 2222 -r /local/directory user@host:/remote/path/
```

**Verification After Transfer**:
```bash
ssh user@host "ls -la /remote/path/directory | head -20"
```

---

**PERMANENT MEMORY**: Docker Compose setup on remote requires:
1. Docker installed and running
2. SSL certificates in correct location
3. Deployment directory prepared
4. Environment variables configured

**Pre-deployment Checklist**:
```bash
ssh user@host << 'CHECK'
docker --version  # Verify Docker
test -f /etc/letsencrypt/live/domain/fullchain.pem  # Verify SSL
mkdir -p /opt/deployment  # Create directory
test -r ~/.env  # Verify env file readable
CHECK
```

---

### Section 4: Troubleshooting Expertise

#### Learned: October 27, 2025

**PERMANENT MEMORY**: When container exits with code 1, always check:
1. Logs: `docker logs <container>`
2. Volume mounts: `docker inspect <container> | grep -A 20 Mounts`
3. Working directory: Verify `-w` flag matches code expectations
4. Environment variables: Verify all required vars are set

**Diagnostic Command**:
```bash
# Comprehensive container diagnosis
docker logs <container> --tail=100 && \
docker inspect <container> | grep -E '(Mounts|Env|Status|Error)' && \
docker ps -a | grep <container>
```

---

**PERMANENT MEMORY**: "Connection refused" errors indicate service either:
1. Not running at all
2. Listening on different port
3. Only listening on localhost, not network interface
4. Firewall blocking traffic

**Diagnostic Steps**:
```bash
# Is service running?
docker ps | grep service-name

# Is port listening?
netstat -tlnp | grep :8080
docker exec <container> netstat -tlnp | grep :8080

# Can we reach it?
docker exec <container> curl http://target:8080/health

# Firewall?
iptables -L -n | grep 8080
```

---

**PERMANENT MEMORY**: Database connection issues during container startup often indicate:
1. Database container not fully initialized yet
2. Network not created
3. Wrong hostname (use container name, not localhost)
4. Wrong credentials

**Docker Compose Solution**:
```yaml
services:
  app:
    depends_on:
      db:
        condition: service_healthy  # Wait for DB health check

  db:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 10s
      timeout: 5s
      retries: 5
```

---

## Section 5: Security Learnings

#### Learned: October 27, 2025

**PERMANENT MEMORY**: Never hardcode credentials in docker-compose or config files.

**Pattern**:
```yaml
# WRONG - Don't do this
environment:
  - DATABASE_PASSWORD=SuperSecret123

# CORRECT - Load from .env
environment:
  - DATABASE_PASSWORD=${DB_PASSWORD}

# In .env file (add to .gitignore):
# DB_PASSWORD=SuperSecret123
```

---

**PERMANENT MEMORY**: Default passwords in templates must be clearly marked as requiring change.

**Pattern**:
```bash
DB_PASSWORD=j4c_password_change_me      # ⚠️ MUST CHANGE IN PRODUCTION
GRAFANA_PASSWORD=admin_change_me        # ⚠️ MUST CHANGE IN PRODUCTION
```

---

**PERMANENT MEMORY**: SSL/TLS certificates from Let's Encrypt expire every 90 days and must be auto-renewed.

**Setup Auto-Renewal**:
```bash
systemctl enable certbot.timer
systemctl start certbot.timer

# Verify renewal will work
certbot renew --dry-run
```

---

## Section 6: Performance Patterns

#### Learned: October 27, 2025

**PERMANENT MEMORY**: Gzip compression reduces response size by 70-80% for text content.

**NGINX Configuration**:
```nginx
gzip on;
gzip_comp_level 6;  # 1-9, 6 is optimal balance
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/json
    application/javascript;
```

**Verification**:
```bash
curl -I -H "Accept-Encoding: gzip" https://domain.com | grep Content-Encoding
# Should show: Content-Encoding: gzip
```

---

**PERMANENT MEMORY**: Database connection pooling prevents connection exhaustion.

**Pattern** (for Node.js):
```javascript
const pool = new Pool({
  max: 20,  // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**Monitoring**:
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check connection limit
SHOW max_connections;
```

---

## Section 7: Testing & Validation Patterns

#### Learned: October 27, 2025

**PERMANENT MEMORY**: Every deployment should have a health check endpoint that returns 200.

**Pattern**:
```javascript
// Node.js Express
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: Date.now() });
});
```

**Docker Compose Health Check**:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

---

**PERMANENT MEMORY**: Production deployments require comprehensive testing before rollout.

**Test Checklist**:
- [ ] Unit tests pass: 100% coverage for critical paths
- [ ] Integration tests pass: All services communicate correctly
- [ ] Health checks pass: All endpoints respond with 200
- [ ] Security headers verified: curl -I shows all headers
- [ ] SSL certificate valid: No warnings in browser
- [ ] Rate limiting works: Verify 429 response when exceeded
- [ ] Logs are accessible: docker logs works and shows useful info
- [ ] Monitoring metrics appear: Prometheus scrape succeeds
- [ ] Database backups work: Test restore process
- [ ] Failover tested: Kill service, verify auto-restart

---

### Section 8: Production Configuration Management

#### Learned: October 27, 2025

**PERMANENT MEMORY**: Environment variables in production must never contain hardcoded secrets. Use placeholder values and document required changes.

**Pattern**:
```bash
# .env.production template (safe to commit)
DATABASE_PASSWORD=CHANGE_ME_SECURE_PASSWORD_HERE
HUBSPOT_API_KEY=CHANGE_ME_YOUR_HUBSPOT_API_KEY_HERE
GRAFANA_ADMIN_PASSWORD=CHANGE_ME_SECURE_GRAFANA_PASSWORD_HERE

# Actual .env (in .gitignore)
DATABASE_PASSWORD=xK9m2vL5pQ8rT3wX
HUBSPOT_API_KEY=pat-na1-abc123def456
GRAFANA_ADMIN_PASSWORD=mK7j9nP2qL5sT8uV
```

**Why Critical**: Prevents accidental credential leaks in git history and makes onboarding clear - new operators know exactly which values to change.

---

**PERMANENT MEMORY**: Generate secure passwords using cryptographic random methods.

**Safe Methods**:
```bash
# Option 1: OpenSSL (32 bytes base64)
openssl rand -base64 32

# Option 2: /dev/urandom (32 bytes base64)
head -c 32 /dev/urandom | base64

# Option 3: Node.js (32 bytes hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 4: Node.js (64 bytes base64 for JWT)
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

**Verification**: Copy generated value into .env file and verify it doesn't contain quotes or special characters requiring escaping.

---

**PERMANENT MEMORY**: API key setup requires different procedures per service provider.

**HubSpot API Setup**:
1. Login to https://app.hubspot.com/
2. Navigate to Settings → API Keys
3. Create new API key (or copy existing)
4. Key format: `pat-na1-xxxxx...` or `pat-eu1-xxxxx...`

**GitHub Token Setup**:
1. Go to https://github.com/settings/tokens
2. Create new Personal Access Token (classic)
3. Required scopes: `repo`, `admin:repo_hook`
4. Key format: `ghp_xxxxxxxxxx...` (40+ chars)

**Jira API Setup**:
1. Go to https://aurigraphdlt.atlassian.net
2. Navigate to Account Settings → Security → API Tokens
3. Create new API token
4. Email: registered Atlassian account email
5. Key format: `ATATT...` (long encoded string)

---

### Section 9: Monitoring & Observability Expertise

#### Learned: October 27, 2025

**PERMANENT MEMORY**: Prometheus scrape intervals affect alert sensitivity. Default 15 seconds provides good balance.

**Configuration**:
```yaml
# prometheus.yml
global:
  scrape_interval: 15s      # Default for all jobs
  evaluation_interval: 30s   # How often to evaluate rules
  scrape_timeout: 10s        # Timeout per scrape

scrape_configs:
  - job_name: 'j4c-agent'
    static_configs:
      - targets: ['localhost:9003']
    scrape_interval: 15s     # Can override per job
```

**Impact**:
- Faster interval (5s) → More data, higher storage, catches spikes faster
- Slower interval (60s) → Less data, lower storage, may miss quick issues

**Recommendation**: Use 15s globally, override to 5s for critical metrics only.

---

**PERMANENT MEMORY**: Alert rules must include severity levels for proper filtering and escalation.

**Severity Hierarchy**:
```yaml
severity: critical  # Page on-call engineer immediately
severity: high      # Alert team within 15 minutes
severity: medium    # Team review within 1 hour
severity: warning   # Information only, no immediate action
```

**Pattern**:
```yaml
alert: ServiceDown
expr: up == 0
labels:
  severity: critical    # This determines escalation
  service: j4c-agent
annotations:
  summary: "Critical alert message"
  runbook: "https://runbooks.example.com/service-down"
```

**Best Practice**: Include runbook links in annotations so engineers know recovery steps.

---

**PERMANENT MEMORY**: Grafana dashboards require data source configuration before displaying metrics.

**Data Source Setup Pattern**:
1. **Settings** → **Data Sources** → **Add Data Source**
2. Select Prometheus
3. URL: `http://j4c-prometheus:9090` (internal Docker network)
4. Access: Browser (Grafana queries from browser client)
5. Click **Save & Test** (must show "Data source is working")

**Debugging "No Data"**:
```bash
# 1. Check Prometheus is scraping
curl http://localhost:9090/api/v1/targets

# 2. Test query directly in Prometheus
curl 'http://localhost:9090/api/v1/query?query=up'

# 3. Verify data source in Grafana
curl -H "Authorization: Bearer admin:PASSWORD" \
  http://localhost:3000/api/datasources
```

---

**PERMANENT MEMORY**: Grafana dashboard panels require specific query syntax per metric type.

**Common Metric Types**:
```
# Counter (always increases)
rate(metric_total[5m])        # Rate of increase

# Gauge (can go up or down)
metric_bytes                   # Direct value

# Histogram (value distribution)
histogram_quantile(0.95, metric_bucket)  # 95th percentile

# Summary (pre-computed quantiles)
metric_sum / metric_count      # Average value
```

**Example Dashboard Panel**:
```
Title: "API Response Time (p95)"
Query: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
Unit: seconds
Threshold: > 1s (warning)
Visualization: Gauge
```

---

**PERMANENT MEMORY**: Alert thresholds must be tuned to match actual application behavior.

**Tuning Process**:
1. Monitor baseline metrics for 1 week
2. Calculate: mean + 2*stddev = warning threshold
3. Calculate: mean + 5*stddev = critical threshold
4. Set thresholds in alert rules
5. Monitor false alert rate (target: < 5%)
6. Adjust thresholds if necessary

**Example for Database Connections**:
```
Baseline: 10-15 connections
Warning: 50 (mean 12 + 38 buffer)
Critical: 80 (mean 12 + 68 buffer)
```

---

## Section 10: Common Fixes Reference

#### Quick Access to Solutions

**Problem**: Container keeps restarting
```bash
# Check logs
docker logs <container> --tail=50
# Fix: Address the error in logs, rebuild if necessary
```

**Problem**: Out of disk space
```bash
docker system prune -a  # Clean all unused images/containers
find /var/lib/docker/containers -name "*-json.log" -delete  # Remove old logs
```

**Problem**: Port already in use
```bash
netstat -tlnp | grep :8080
kill -9 <PID>  # Kill the process using the port
# Or change port in configuration
```

**Problem**: Slow response times
```bash
docker stats  # Check CPU/memory usage
# Increase resources or optimize application
```

**Problem**: Database connection failed
```bash
docker-compose logs database  # Check if DB is running
docker exec <db-container> psql -U user -c "SELECT 1;"  # Test connection
```

---

## Section 9: Future Learning Priorities

**Areas for continuous skill development**:

1. **Kubernetes** - Beyond Docker Compose scaling
2. **Terraform/IaC** - Infrastructure as code
3. **CI/CD Pipelines** - Automated deployments
4. **Database Management** - Backup, recovery, tuning
5. **Distributed Tracing** - Monitor across services
6. **Service Mesh** - Istio, Linkerd for advanced networking
7. **Cost Optimization** - Resource efficiency, auto-scaling
8. **Disaster Recovery** - DR testing, RTO/RPO planning

---

## Continuous Learning Protocol

### When to Update This Memory

After **every significant activity**, add learnings:

1. **After Project Completion** → Extract 3-5 key learnings
2. **After Troubleshooting** → Document the problem and solution
3. **After Production Issue** → Add preventive measures
4. **After Code Review** → Document new patterns discovered
5. **After Reading Documentation** → Summarize key insights

### Format for New Entries

```markdown
**PERMANENT MEMORY**: [Brief statement of what was learned]

**Context**: [When this applies / what triggered the learning]

**Pattern/Solution**: [Reusable code or process]

**Verification**: [How to test if this works]

**Why It Matters**: [Impact on future projects]

**Keywords**: [searchable terms]
```

---

## How Agents Should Use This Document

1. **Before Starting New Project** → Search relevant sections
2. **When Stuck** → Check troubleshooting section
3. **Before Production Deployment** → Review security & testing sections
4. **When Learning New Domain** → Study patterns in that section
5. **After Completing Task** → Add your own learnings

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | Oct 27, 2025 | Added production config, monitoring & observability sections (post-deployment) |
| 1.0 | Oct 27, 2025 | Initial memory bank created from J4C Plugin deployment |
| TBD | TBD | Updates will be made after each major project |

---

## Index by Domain

### Infrastructure & DevOps
- Docker expertise
- NGINX configuration
- Remote deployment
- SSL/TLS management
- Monitoring & observability

### Troubleshooting
- Container diagnostics
- Network issues
- Database connectivity
- Performance debugging
- Security validation

### Best Practices
- Security patterns
- Performance optimization
- Testing & validation
- Documentation standards
- Code organization

---

## 🎯 Agent Mission

> **Every agent continuously improves this memory bank. Every project makes the next agent 10% smarter. This is how we build organizational intelligence.**

The goal: After 10 projects, new agents inherit 10x the knowledge they would have if learning from scratch.

---

**This is a LIVING DOCUMENT**
Update it. Reference it. Share it.
Your knowledge multiplies when others can access it.

Last commit: `e1d762d` - Oct 27, 2025

