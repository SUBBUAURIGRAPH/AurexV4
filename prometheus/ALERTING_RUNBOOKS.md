# HMS Alerting Runbooks

**Hermes Trading Platform - Alert Response Procedures**
**Last Updated:** October 30, 2025

## Table of Contents

1. [Overview](#overview)
2. [Alert Response Process](#alert-response-process)
3. [Critical Alerts (P1)](#critical-alerts-p1)
4. [Warning Alerts (P2)](#warning-alerts-p2)
5. [Info Alerts (P3)](#info-alerts-p3)
6. [Escalation Procedures](#escalation-procedures)

---

## Overview

### Alert Severity Levels

| Severity | Priority | Response Time | Notification | Escalation |
|----------|----------|---------------|--------------|------------|
| **Critical** | P1 | <15 minutes | PagerDuty + Slack + Email | After 15 min |
| **Warning** | P2 | <1 hour | Slack + Email | After 4 hours |
| **Info** | P3 | <4 hours | Slack | None |

### General Response Process

1. **Acknowledge** alert in Alertmanager/PagerDuty
2. **Assess** impact using dashboards
3. **Investigate** root cause
4. **Mitigate** immediate impact
5. **Resolve** underlying issue
6. **Document** incident and lessons learned
7. **Follow-up** with preventive measures

---

## Alert Response Process

### Step 1: Acknowledge Alert

```bash
# Via amtool
amtool alert query --alertmanager.url=http://localhost:9093

# Silence alert if false positive
amtool silence add \
  --alertmanager.url=http://localhost:9093 \
  alertname="AlertName" \
  --duration=1h \
  --comment="Investigating"
```

### Step 2: Assess Impact

Check HMS Overview Dashboard:
- Are multiple services affected?
- How many users impacted?
- Is system still functional?
- Are orders being processed?

### Step 3: Initial Response

```bash
# SSH to production server
ssh root@hms.aurex.in

# Check overall system status
docker ps -a
systemctl status

# Check logs
docker logs hms-j4c-agent --tail 100 --follow
```

### Step 4: Communication

**Critical Alerts**:
- Post in #incidents Slack channel
- Update status page if customer-facing
- Notify stakeholders

**Template**:
```
🚨 INCIDENT: [Alert Name]
Status: Investigating
Impact: [Brief description]
ETA: [Time estimate]
Updates: Will post every 15 minutes
```

---

## Critical Alerts (P1)

### 1. HMSAPIDown

**Alert**: HMS API Server is DOWN

**Impact**: Complete service outage - users cannot access HMS

**Immediate Actions**:

```bash
# 1. Check if container is running
docker ps -a | grep hms-j4c-agent

# 2. If stopped, check why it stopped
docker logs hms-j4c-agent --tail 100

# 3. Check for OOM kill
dmesg | grep -i "killed process"
grep -i "out of memory" /var/log/syslog

# 4. Try to restart
docker restart hms-j4c-agent

# 5. If restart fails, check logs again
docker logs hms-j4c-agent --tail 200

# 6. Check if port is already in use
netstat -tlnp | grep 9003

# 7. As last resort, recreate container
docker-compose down
docker-compose up -d hms-j4c-agent
```

**Root Cause Investigation**:

```bash
# Check application errors
docker logs hms-j4c-agent --since 1h | grep -i error

# Check database connectivity
docker exec hms-j4c-agent pg_isready -h postgres -U hms_user

# Check disk space
df -h

# Check memory
free -h

# Check recent deployments
git log --oneline -10
```

**Post-Resolution**:
1. Update incident timeline
2. Schedule post-mortem
3. Implement preventive measures
4. Update runbook with new findings

---

### 2. PostgresDatabaseDown

**Alert**: PostgreSQL Database is DOWN

**Impact**: Complete data access failure - all operations blocked

**Immediate Actions**:

```bash
# 1. Check if PostgreSQL container is running
docker ps -a | grep postgres

# 2. Check PostgreSQL logs
docker logs hms-postgres --tail 100

# 3. Try to restart
docker restart hms-postgres

# 4. If restart fails, check data directory
docker exec hms-postgres ls -la /var/lib/postgresql/data

# 5. Check for disk space (common cause)
df -h

# 6. Check for corrupted data files
docker exec hms-postgres pg_controldata /var/lib/postgresql/data
```

**Database Recovery**:

```bash
# If database won't start, try recovery mode
docker exec hms-postgres \
  pg_ctl start -D /var/lib/postgresql/data -o "-c log_connections=off"

# Check for corrupted indexes
docker exec -it hms-postgres psql -U postgres -d hms_production -c "
  SELECT pg_class.relname, pg_namespace.nspname
  FROM pg_class
  JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
  WHERE pg_class.relkind = 'i' AND pg_class.relisvalid = false;
"

# Reindex if needed
docker exec -it hms-postgres psql -U postgres -d hms_production -c "
  REINDEX DATABASE hms_production;
"

# If corruption is severe, restore from backup
# See backup procedures in MONITORING_SETUP.md
```

**Post-Resolution**:
1. Verify all services reconnected
2. Check data integrity
3. Review backup strategy
4. Monitor for recurring issues

---

### 3. NginxProxyDown

**Alert**: NGINX Reverse Proxy is DOWN

**Impact**: Users cannot access HMS (external connectivity lost)

**Immediate Actions**:

```bash
# 1. Check NGINX container
docker ps -a | grep nginx

# 2. Check NGINX logs
docker logs nginx --tail 100

# 3. Test configuration before restart
docker exec nginx nginx -t

# 4. If config is valid, restart
docker restart nginx

# 5. If config is invalid, fix it
docker exec nginx nginx -T  # Show full config
# Fix config in /etc/nginx/nginx.conf
docker restart nginx

# 6. Verify SSL certificates
docker exec nginx ls -la /etc/letsencrypt/live/

# 7. Check certificate expiration
echo | openssl s_client -connect hms.aurex.in:443 2>/dev/null | \
  openssl x509 -noout -dates
```

**Common NGINX Issues**:

```bash
# Certificate expired
certbot renew --force-renewal
docker restart nginx

# Port already in use
netstat -tlnp | grep :443
# Kill conflicting process or change NGINX port

# Invalid configuration
# Review recent changes
git diff HEAD~1 nginx/nginx.conf
```

---

### 4. HighErrorRateCritical

**Alert**: HTTP 5xx error rate > 1%

**Impact**: Significant service degradation - many requests failing

**Immediate Actions**:

```bash
# 1. Check error logs for patterns
docker logs hms-j4c-agent --tail 500 | grep -i "error\|exception"

# 2. Identify failing endpoints
# Use API Performance dashboard to see which endpoints have high errors

# 3. Check database connectivity
docker exec hms-j4c-agent \
  psql -h postgres -U hms_user -d hms_production -c "SELECT 1;"

# 4. Check external API status (Alpaca)
curl -I https://api.alpaca.markets/v2/account

# 5. Check application metrics
curl http://localhost:9003/metrics | grep error

# 6. If specific endpoint failing, check recent code changes
git log --oneline --since="1 day ago" -- path/to/failing/endpoint
```

**Analysis**:

```bash
# Group errors by type
docker logs hms-j4c-agent --tail 1000 | \
  grep -i error | \
  awk '{print $NF}' | \
  sort | uniq -c | sort -rn

# Check error rate over time
# Use Grafana Error Rate panel

# Identify error correlation
# Check if errors coincide with:
# - Deployment
# - Traffic spike
# - Database slowdown
# - External API issues
```

**Mitigation**:

```bash
# If due to bad deployment, rollback
git revert HEAD
docker-compose down
docker-compose up -d --build

# If due to database issue, check Database Performance dashboard

# If due to resource exhaustion
docker stats  # Check container resources
# Scale horizontally or vertically if needed
```

---

### 5. DatabaseConnectionPoolExhausted

**Alert**: Database connection pool > 80% utilized

**Impact**: New requests blocked, service slowdown imminent

**Immediate Actions**:

```bash
# 1. Check active connections
docker exec -it hms-postgres psql -U postgres -c "
  SELECT count(*) as total,
         state,
         wait_event_type
  FROM pg_stat_activity
  WHERE datname = 'hms_production'
  GROUP BY state, wait_event_type
  ORDER BY total DESC;
"

# 2. Identify long-running queries
docker exec -it hms-postgres psql -U postgres -c "
  SELECT pid,
         now() - pg_stat_activity.query_start AS duration,
         query,
         state
  FROM pg_stat_activity
  WHERE state != 'idle'
    AND now() - pg_stat_activity.query_start > interval '1 minute'
  ORDER BY duration DESC;
"

# 3. Kill idle connections older than 5 minutes
docker exec -it hms-postgres psql -U postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'hms_production'
    AND state = 'idle'
    AND state_change < NOW() - INTERVAL '5 minutes';
"

# 4. Kill long-running problematic queries (use caution!)
docker exec -it hms-postgres psql -U postgres -c "
  SELECT pg_terminate_backend(12345);  -- Replace with actual PID
"
```

**Investigation**:

```bash
# Check for connection leaks in application
# Review database connection handling in code

# Check max_connections setting
docker exec -it hms-postgres psql -U postgres -c "
  SHOW max_connections;
"

# Consider increasing max_connections
# Edit postgresql.conf:
# max_connections = 200  # Increase from default

# Or fix connection pooling in application
```

---

### 6. DiskSpaceCritical

**Alert**: Disk space < 5% free

**Impact**: Service failure imminent, database corruption risk

**Immediate Actions**:

```bash
# 1. Check disk usage
df -h

# 2. Find largest directories
du -sh /* | sort -rh | head -10

# 3. Clean Docker resources
docker system df  # Show Docker disk usage
docker system prune -a --volumes  # Clean everything (careful!)

# 4. Clean old logs
find /var/log -name "*.log" -mtime +7 -delete
journalctl --vacuum-time=7d

# 5. Clean Prometheus old data (if needed)
# This will reduce retention
docker exec prometheus rm -rf /prometheus/data/wal/*

# 6. Check for large files
find / -type f -size +1G -exec ls -lh {} \; 2>/dev/null

# 7. Archive or delete old backups
ls -lh /backup/
# Move to external storage or delete old backups
```

**Prevention**:

```bash
# Set up automated cleanup cron jobs
# Add to crontab:
0 2 * * * docker system prune -f --volumes > /dev/null 2>&1
0 3 * * * find /var/log -name "*.log" -mtime +30 -delete
```

---

### 7. OrderConfirmationTimeout

**Alert**: Order confirmation p95 latency > 500ms

**Impact**: Poor user experience, trading delays

**Immediate Actions**:

```bash
# 1. Check Alpaca API status
curl -I https://api.alpaca.markets/v2/account

# 2. Check order processing logs
docker logs hms-j4c-agent --tail 200 | grep -i order

# 3. Check database query performance
# Use Database Performance dashboard

# 4. Check network latency to Alpaca
ping api.alpaca.markets
traceroute api.alpaca.markets

# 5. Review recent order volume spike
# Use Trading Metrics dashboard
```

**Investigation**:

```bash
# Check for slow database queries related to orders
docker exec -it hms-postgres psql -U postgres -c "
  SELECT query,
         mean_exec_time,
         calls
  FROM pg_stat_statements
  WHERE query LIKE '%orders%'
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"

# Check Alpaca API rate limits
# Review metrics: alpaca_rate_limit_remaining

# Check if issue is systemic or specific orders
# Review order rejection reasons
```

---

## Warning Alerts (P2)

### 1. HighAPILatency

**Alert**: API p95 response time > 200ms

**Response Time**: <1 hour

**Actions**:

```bash
# 1. Identify slow endpoints
# Use API Performance dashboard → Top 10 Slowest Endpoints

# 2. Check database query performance
# Use Database Performance dashboard

# 3. Check system resources
# Use System Health dashboard

# 4. Profile slow endpoint
# Add temporary detailed logging
# Review query execution plans

# 5. Optimize as needed
# Add database indexes
# Implement caching
# Optimize algorithm
```

---

### 2. HighMemoryUsage

**Alert**: Memory usage > 80%

**Response Time**: <1 hour

**Actions**:

```bash
# 1. Identify memory-heavy processes
ps aux --sort=-%mem | head -10

# 2. Check for memory leaks
# Review application metrics over time

# 3. Check container memory
docker stats

# 4. Restart services if memory leak suspected
docker restart hms-j4c-agent

# 5. Consider scaling if persistent
# Increase server memory or scale horizontally
```

---

### 3. HighCPUUsage

**Alert**: CPU usage > 80%

**Response Time**: <1 hour

**Actions**:

```bash
# 1. Identify CPU-heavy processes
top -bn1 | head -20

# 2. Check for infinite loops or inefficient code
# Review recent deployments

# 3. Check for unusual traffic spike
# Use HMS Overview dashboard

# 4. Scale if legitimate high load
# Add more replicas or increase CPU allocation
```

---

### 4. WebSocketConnectionsHigh

**Alert**: WebSocket connections > 1000

**Response Time**: <1 hour

**Actions**:

```bash
# 1. Verify connections are legitimate
# Check connection patterns in logs

# 2. Check for connection leaks
docker logs hms-j4c-agent | grep -i websocket | tail -100

# 3. Monitor connection growth rate
# Use WebSocket Metrics dashboard

# 4. Implement rate limiting if abuse detected
# 5. Scale if legitimate high usage
```

---

### 5. SlowDatabaseQueries

**Alert**: Average query time > 1s

**Response Time**: <1 hour

**Actions**:

```bash
# 1. Identify slow queries
docker exec -it hms-postgres psql -U postgres -c "
  SELECT query,
         mean_exec_time,
         calls,
         total_exec_time
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"

# 2. Get execution plan for slow query
docker exec -it hms-postgres psql -U postgres -d hms_production -c "
  EXPLAIN ANALYZE [your query here];
"

# 3. Add missing indexes
# 4. Optimize query
# 5. Consider query result caching
```

---

## Info Alerts (P3)

### OrderCreationRateLow / PortfolioValueDropSignificant / UnusualTradingVolume

These are informational alerts that track business metrics. They typically don't require immediate technical intervention but should be reviewed by product/trading teams.

**Actions**:
1. Review in daily standup
2. Investigate business reasons
3. Check for seasonal patterns
4. Verify no technical issues

---

## Escalation Procedures

### When to Escalate

**Critical Alerts** (Escalate after 15 minutes if not resolved):
1. Alert acknowledged but solution unclear
2. Multiple services affected
3. Data loss risk
4. Requires specialized expertise

**Warning Alerts** (Escalate after 4 hours if not resolved):
1. Problem persists despite mitigation
2. Performance degradation worsening
3. Pattern indicates deeper issue

### Escalation Path

```
Level 1: On-call Engineer (PagerDuty)
    ↓ (15 min for critical)
Level 2: Backup On-call + Team Lead
    ↓ (30 min for critical)
Level 3: Engineering Manager
    ↓ (1 hour for critical)
Level 4: CTO + All hands on deck
```

### Escalation Communication

**Template**:
```
🚨 ESCALATION REQUIRED

Alert: [Alert Name]
Severity: [Critical/Warning]
Duration: [Time since alert started]
Actions Taken: [Brief summary]
Current Status: [Impact description]
Blocker: [Why escalating]
Needed: [What help is needed]
```

---

## Post-Incident Procedures

### 1. Incident Resolution

```
☑ Alert resolved and silenced
☑ Services stable for 15 minutes
☑ Monitoring confirms normal behavior
☑ Customer impact assessed
☑ Stakeholders notified
```

### 2. Incident Documentation

Create incident report:
```markdown
## Incident Report: [Alert Name]

**Date**: [Date and time]
**Duration**: [Start - End]
**Severity**: [Critical/Warning/Info]

### Impact
- [User impact]
- [Services affected]
- [Data impact]

### Timeline
- [HH:MM] Alert fired
- [HH:MM] Acknowledged
- [HH:MM] Root cause identified
- [HH:MM] Mitigation applied
- [HH:MM] Resolved

### Root Cause
[Detailed explanation]

### Resolution
[What fixed it]

### Action Items
- [ ] Improve monitoring
- [ ] Update runbook
- [ ] Fix underlying issue
- [ ] Add preventive measures
```

### 3. Post-Mortem (for P1 incidents)

Schedule within 48 hours:
- What happened?
- Why did it happen?
- How did we respond?
- What went well?
- What could be improved?
- Action items with owners

---

## Emergency Contacts

| Role | Name | Slack | Phone | Backup |
|------|------|-------|-------|--------|
| On-Call Engineer | Rotation | @oncall | PagerDuty | @backup-oncall |
| Team Lead | [Name] | @teamlead | [Phone] | - |
| Database Admin | [Name] | @dba | [Phone] | - |
| DevOps Manager | [Name] | @devopsmanager | [Phone] | - |

---

## Useful Commands Reference

```bash
# Quick status check
docker ps && df -h && free -h && top -bn1 | head -5

# View all container logs
docker-compose logs --tail=50

# Restart all services
docker-compose restart

# Full system restart (last resort)
docker-compose down && docker-compose up -d

# Check alert status
amtool alert query --alertmanager.url=http://localhost:9093

# Silence alert
amtool silence add alertname=HMSAPIDown --duration=1h

# View Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job, health}'

# Check metrics
curl http://localhost:9003/metrics | grep -i error
```

---

**Document Version**: 1.0
**Last Updated**: October 30, 2025
**Maintained By**: DevOps Team
