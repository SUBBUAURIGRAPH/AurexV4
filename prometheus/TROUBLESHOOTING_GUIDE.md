# HMS Monitoring Troubleshooting Guide

**Hermes Trading Platform - Common Issues & Solutions**
**Last Updated:** October 30, 2025

## Table of Contents

1. [Prometheus Issues](#prometheus-issues)
2. [Grafana Issues](#grafana-issues)
3. [Alertmanager Issues](#alertmanager-issues)
4. [Metrics Collection Issues](#metrics-collection-issues)
5. [Performance Issues](#performance-issues)
6. [Network Issues](#network-issues)
7. [Storage Issues](#storage-issues)

---

## Prometheus Issues

### Issue 1: Prometheus Not Starting

**Symptoms**:
- Container exits immediately
- `docker ps` doesn't show prometheus
- Error in logs: "invalid configuration"

**Diagnosis**:
```bash
# Check container logs
docker logs prometheus

# Validate configuration
promtool check config prometheus.yml

# Check for syntax errors
```

**Solutions**:

```bash
# Fix 1: Syntax error in config
promtool check config prometheus.yml
# Fix YAML syntax errors shown

# Fix 2: Invalid alert rules
promtool check rules alert-rules.yml
promtool check rules recording-rules.yml

# Fix 3: File permissions
chmod 644 prometheus.yml alert-rules.yml recording-rules.yml

# Fix 4: Recreate container
docker-compose down prometheus
docker-compose up -d prometheus
```

---

### Issue 2: Targets Showing as DOWN

**Symptoms**:
- Targets in Prometheus UI show as DOWN
- Status page shows "Connection refused" or timeout

**Diagnosis**:
```bash
# Check if target service is running
docker ps | grep [service-name]

# Test connectivity from Prometheus container
docker exec prometheus wget -O- http://target-service:port/metrics

# Check firewall rules
iptables -L

# Check Docker network
docker network inspect prometheus_monitoring_network
```

**Solutions**:

```bash
# Fix 1: Target service not running
docker start [service-name]

# Fix 2: Wrong port in config
# Edit prometheus.yml and fix port number

# Fix 3: Network issue
# Ensure services are on same Docker network
docker network connect prometheus_monitoring_network [service-name]

# Fix 4: Firewall blocking
# Allow port in firewall
ufw allow [port-number]

# Fix 5: Target service doesn't expose metrics
# Install appropriate exporter
```

---

### Issue 3: High Memory Usage

**Symptoms**:
- Prometheus using >4GB RAM
- System becoming slow
- OOM killer terminating Prometheus

**Diagnosis**:
```bash
# Check memory usage
docker stats prometheus

# Check TSDB size
du -sh /prometheus/data

# Check cardinality
curl http://localhost:9090/api/v1/status/tsdb | jq '.data.seriesCountByMetricName' | head -20
```

**Solutions**:

```bash
# Fix 1: Reduce retention
# Edit prometheus.yml:
# storage:
#   tsdb:
#     retention.time: 15d  # Reduce from 30d
docker restart prometheus

# Fix 2: Drop high-cardinality metrics
# Add to prometheus.yml metric_relabel_configs:
# - source_labels: [__name__]
#   regex: 'go_.*|process_.*'
#   action: drop

# Fix 3: Increase container memory limit
# Edit docker-compose.yml:
# services:
#   prometheus:
#     mem_limit: 8g

# Fix 4: Enable WAL compression
# Add to prometheus.yml:
# storage:
#   tsdb:
#     wal-compression: true
```

---

### Issue 4: Queries Timing Out

**Symptoms**:
- Grafana shows "Query timeout"
- Prometheus UI shows slow queries
- High CPU usage

**Diagnosis**:
```bash
# Enable query logging
# Add to prometheus.yml:
# global:
#   query_log_file: /prometheus/query.log

# Check slow queries
tail -f /prometheus/query.log | grep -i "duration"

# Check query complexity
# Use Grafana to analyze query execution time
```

**Solutions**:

```bash
# Fix 1: Use recording rules for complex queries
# Move complex queries to recording-rules.yml

# Fix 2: Increase query timeout
# Edit prometheus.yml:
# global:
#   evaluation_timeout: 2m

# Fix 3: Reduce time range in queries
# Use shorter time windows (1h instead of 24h)

# Fix 4: Optimize queries
# Use rate() instead of increase() where possible
# Limit label cardinality
```

---

### Issue 5: Missing Metrics

**Symptoms**:
- Expected metrics not appearing
- Queries return empty results
- Gaps in graphs

**Diagnosis**:
```bash
# Check if metric exists
curl http://localhost:9090/api/v1/label/__name__/values | grep "metric_name"

# Check scrape success
curl http://localhost:9090/api/v1/query?query=up

# Check target logs
docker logs [target-service]

# Test metric endpoint directly
curl http://target-service:port/metrics | grep "metric_name"
```

**Solutions**:

```bash
# Fix 1: Metric not being exposed
# Add metric instrumentation to application code

# Fix 2: Metric being dropped by relabeling
# Check metric_relabel_configs in prometheus.yml
# Remove or adjust rules dropping the metric

# Fix 3: Scrape failing
# Check Prometheus logs for scrape errors
docker logs prometheus | grep -i "scrape"

# Fix 4: Metric renamed
# Search for similar metric names
curl http://localhost:9090/api/v1/label/__name__/values | grep -i "partial_name"
```

---

## Grafana Issues

### Issue 1: Grafana Not Loading

**Symptoms**:
- Cannot access http://localhost:3000
- "Connection refused" error
- Page timeout

**Diagnosis**:
```bash
# Check if Grafana is running
docker ps | grep grafana

# Check Grafana logs
docker logs grafana --tail 100

# Check port binding
netstat -tlnp | grep 3000

# Test from inside container
docker exec grafana curl http://localhost:3000/api/health
```

**Solutions**:

```bash
# Fix 1: Container not running
docker start grafana

# Fix 2: Port conflict
# Change port in docker-compose.yml:
# ports:
#   - "3001:3000"

# Fix 3: Database corruption
# Reset Grafana database
docker exec grafana rm /var/lib/grafana/grafana.db
docker restart grafana

# Fix 4: Permission issues
docker exec grafana chown -R grafana:grafana /var/lib/grafana
docker restart grafana
```

---

### Issue 2: Dashboard Shows "No Data"

**Symptoms**:
- All panels show "No data"
- Some panels work, others don't
- Data was working before

**Diagnosis**:
```bash
# Test Prometheus connection from Grafana
# Go to: Configuration → Data Sources → Prometheus → Test

# Test query directly in Prometheus
curl 'http://localhost:9090/api/v1/query?query=up'

# Check panel query in Grafana
# Edit panel → Query inspector → Refresh

# Check time range
# Ensure time range has data
```

**Solutions**:

```bash
# Fix 1: Prometheus data source misconfigured
# Grafana → Configuration → Data Sources → Prometheus
# URL should be: http://prometheus:9090

# Fix 2: Time range issue
# Change time range to "Last 5 minutes"
# Or use absolute time range with known data

# Fix 3: Query syntax error
# Copy query to Prometheus UI and test
# Fix syntax errors

# Fix 4: Metrics don't exist yet
# Wait for first scrape (15-30s)
# Or generate some traffic to create metrics

# Fix 5: Clear Grafana cache
docker exec grafana rm -rf /var/lib/grafana/cache/*
docker restart grafana
```

---

### Issue 3: Dashboard Import Fails

**Symptoms**:
- "Invalid dashboard JSON" error
- Import button doesn't work
- Dashboard partially loads

**Diagnosis**:
```bash
# Validate JSON syntax
cat dashboard.json | jq empty

# Check JSON structure
cat dashboard.json | jq '.dashboard.title'

# Check for missing fields
```

**Solutions**:

```bash
# Fix 1: Invalid JSON syntax
# Validate and fix JSON:
cat dashboard.json | jq '.' > dashboard-fixed.json

# Fix 2: Wrong format
# Ensure JSON has proper structure:
{
  "dashboard": {
    "title": "...",
    ...
  },
  "overwrite": true
}

# Fix 3: Data source UID mismatch
# Option 1: Remove datasource field, select during import
# Option 2: Update UID to match your Prometheus data source

# Fix 4: Import via API
curl -X POST \
  http://admin:password@localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @dashboard.json
```

---

### Issue 4: Slow Dashboard Loading

**Symptoms**:
- Dashboards take >10s to load
- Panels timeout
- Browser becomes unresponsive

**Diagnosis**:
```bash
# Check Grafana performance
docker stats grafana

# Check query performance
# Grafana → Panel → Query Inspector → Query stats

# Check Prometheus query time
# Run query in Prometheus UI

# Check number of panels
# Too many panels (>50) can cause issues
```

**Solutions**:

```bash
# Fix 1: Optimize queries
# Use recording rules for complex queries
# Reduce time range
# Limit result size with topk()

# Fix 2: Increase Grafana resources
# Edit docker-compose.yml:
# services:
#   grafana:
#     mem_limit: 2g
#     cpus: 2

# Fix 3: Reduce refresh rate
# Change dashboard refresh from 10s to 30s or 1m

# Fix 4: Split dashboard
# Create multiple smaller dashboards
# Use dashboard links to navigate between them

# Fix 5: Enable query caching
# Edit grafana.ini:
# [dataproxy]
# timeout = 300
# [caching]
# enabled = true
```

---

### Issue 5: Cannot Login

**Symptoms**:
- "Invalid username or password"
- Locked out after multiple attempts
- Password reset doesn't work

**Diagnosis**:
```bash
# Check Grafana logs
docker logs grafana | grep -i "login\|auth"

# Check admin password setting
docker exec grafana env | grep GF_SECURITY_ADMIN_PASSWORD
```

**Solutions**:

```bash
# Fix 1: Reset admin password
docker exec grafana grafana-cli admin reset-admin-password newpassword

# Fix 2: Database issue
# Reset Grafana database
docker exec grafana rm /var/lib/grafana/grafana.db
docker restart grafana
# Default login: admin/admin

# Fix 3: OAuth/LDAP misconfiguration
# Disable OAuth temporarily
# Edit grafana.ini, comment out auth sections
docker restart grafana

# Fix 4: Cookie/session issue
# Clear browser cookies and cache
# Try incognito mode
```

---

## Alertmanager Issues

### Issue 1: Alerts Not Sending

**Symptoms**:
- Alerts firing in Prometheus but no notifications
- No messages in Slack/Email/PagerDuty
- Alertmanager shows alerts but status "Waiting"

**Diagnosis**:
```bash
# Check Alertmanager logs
docker logs alertmanager

# Check alert status
amtool alert query --alertmanager.url=http://localhost:9093

# Test Alertmanager config
amtool check-config alertmanager.yml

# Check notification history
curl http://localhost:9093/api/v2/alerts | jq
```

**Solutions**:

```bash
# Fix 1: Invalid configuration
amtool check-config alertmanager.yml
# Fix errors shown

# Fix 2: Webhook/integration not configured
# Check environment variables are set:
echo $SLACK_WEBHOOK_URL
echo $SMTP_PASSWORD
echo $PAGERDUTY_ROUTING_KEY

# Fix 3: Test notifications manually
# Slack:
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test from HMS"}'

# Fix 4: Routing issue
# Check route matching in alertmanager.yml
# Verify alert has correct labels

# Fix 5: Silenced alert
amtool silence query --alertmanager.url=http://localhost:9093
# Remove silence if found:
amtool silence expire [silence-id]
```

---

### Issue 2: Duplicate Notifications

**Symptoms**:
- Same alert sent multiple times
- Notification spam
- Different channels receiving same alert

**Diagnosis**:
```bash
# Check alert grouping config
cat alertmanager.yml | grep -A 10 "route:"

# Check repeat_interval setting
cat alertmanager.yml | grep repeat_interval

# Check for multiple Alertmanager instances
docker ps | grep alertmanager
```

**Solutions**:

```bash
# Fix 1: Adjust grouping
# Edit alertmanager.yml:
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m

# Fix 2: Increase repeat interval
route:
  repeat_interval: 4h  # Don't repeat for 4 hours

# Fix 3: Remove duplicate receivers
# Check for duplicate receiver configs
# Consolidate receivers

# Fix 4: Use inhibit_rules
# Add to alertmanager.yml to suppress related alerts
inhibit_rules:
  - source_match:
      severity: critical
    target_match:
      severity: warning
    equal: ['alertname', 'instance']
```

---

### Issue 3: Alerts Not Resolving

**Symptoms**:
- Alerts stay "Firing" after issue fixed
- Resolved alerts still showing
- Cannot manually resolve

**Diagnosis**:
```bash
# Check if alert condition still true
curl 'http://localhost:9090/api/v1/query?query=[alert_expr]'

# Check alert "for" duration
cat alert-rules.yml | grep -A 10 "[alert_name]"

# Check Prometheus evaluation
curl http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.name=="AlertName")'
```

**Solutions**:

```bash
# Fix 1: Alert condition still true
# Fix the underlying issue causing alert

# Fix 2: Stale alert in Alertmanager
# Restart Alertmanager to clear state
docker restart alertmanager

# Fix 3: Long resolve_timeout
# Edit alertmanager.yml:
global:
  resolve_timeout: 3m  # Reduce if too long

# Fix 4: Prometheus not sending resolved
# Ensure send_resolved: true in receiver config
```

---

## Metrics Collection Issues

### Issue 1: Metrics Collector (Exporter) Crash

**Symptoms**:
- Exporter container not running
- Metrics endpoint unreachable
- Target shows DOWN in Prometheus

**Diagnosis**:
```bash
# Check exporter status
docker ps -a | grep exporter

# Check logs
docker logs [exporter-name]

# Check resource usage
docker stats [exporter-name]
```

**Solutions**:

```bash
# Fix 1: Restart exporter
docker restart [exporter-name]

# Fix 2: Check configuration
# Verify exporter config file
# Check connection to target service

# Fix 3: Resource limits
# Increase memory/CPU limits in docker-compose.yml

# Fix 4: Version compatibility
# Ensure exporter version compatible with target
docker-compose pull [exporter-name]
docker-compose up -d [exporter-name]
```

---

### Issue 2: Incorrect Metric Values

**Symptoms**:
- Metrics show unexpected values
- Sudden spikes or drops
- Values don't match reality

**Diagnosis**:
```bash
# Check raw metric value
curl http://target:port/metrics | grep metric_name

# Check Prometheus query
curl 'http://localhost:9090/api/v1/query?query=metric_name'

# Compare with actual value
# Check application logs
```

**Solutions**:

```bash
# Fix 1: Counter reset
# If counter metric resets, use rate() or increase()
rate(metric_name[5m])

# Fix 2: Wrong metric type
# Ensure using correct function:
# Counters: rate(), increase()
# Gauges: raw value or delta()
# Histograms: histogram_quantile()

# Fix 3: Label mismatch
# Check if aggregating wrong labels
sum(metric_name) by (correct_label)

# Fix 4: Unit conversion needed
# Apply conversion in query:
metric_name / 1024 / 1024  # Convert bytes to MB
```

---

## Performance Issues

### Issue 1: High Latency in Dashboards

**Symptoms**:
- Grafana dashboards slow to load
- Queries taking >10s
- Panels timing out

**Diagnosis**:
```bash
# Check query execution time
# Grafana → Panel → Query Inspector → Stats

# Check Prometheus query performance
# Run query in Prometheus UI
# Look at execution time

# Check system resources
docker stats
```

**Solutions**:

```bash
# Fix 1: Use recording rules
# Move complex queries to recording-rules.yml
# Use pre-calculated metrics

# Fix 2: Optimize time range
# Use relative time ranges
# Avoid large time ranges (>7d)

# Fix 3: Limit result size
topk(10, metric_name)  # Limit to top 10

# Fix 4: Add indexes to database
# If using remote storage

# Fix 5: Increase resources
# Scale Prometheus vertically or horizontally
```

---

### Issue 2: Storage Growing Too Fast

**Symptoms**:
- Disk usage increasing rapidly
- Running out of space
- Prometheus performance degrading

**Diagnosis**:
```bash
# Check storage size
du -sh /prometheus/data

# Check cardinality
curl http://localhost:9090/api/v1/status/tsdb | jq

# Identify high-cardinality metrics
curl http://localhost:9090/api/v1/status/tsdb | \
  jq -r '.data.seriesCountByMetricName[] | "\(.value) \(.name)"' | \
  sort -rn | head -20
```

**Solutions**:

```bash
# Fix 1: Drop high-cardinality metrics
# Add metric_relabel_configs to prometheus.yml:
metric_relabel_configs:
  - source_labels: [__name__]
    regex: 'high_cardinality_metric.*'
    action: drop

# Fix 2: Reduce retention
# Edit prometheus.yml:
storage:
  tsdb:
    retention.time: 15d

# Fix 3: Set size limit
storage:
  tsdb:
    retention.size: 30GB

# Fix 4: Enable compression
storage:
  tsdb:
    wal-compression: true

# Fix 5: Use remote storage
# Configure Thanos or Cortex for long-term storage
```

---

## Network Issues

### Issue 1: Cannot Connect to Exporters

**Symptoms**:
- Targets showing DOWN
- Connection timeout errors
- Network unreachable

**Diagnosis**:
```bash
# Test connectivity
docker exec prometheus ping target-host

# Check DNS resolution
docker exec prometheus nslookup target-host

# Check network
docker network ls
docker network inspect [network-name]

# Check firewall
iptables -L
```

**Solutions**:

```bash
# Fix 1: Join network
docker network connect [network-name] [container]

# Fix 2: Update DNS
# Edit /etc/hosts in container
docker exec prometheus sh -c "echo '10.0.0.5 target-host' >> /etc/hosts"

# Fix 3: Fix firewall
ufw allow from [prometheus-ip] to any port [target-port]

# Fix 4: Use IP instead of hostname
# Edit prometheus.yml:
- targets: ['10.0.0.5:9100']  # Instead of 'hostname:9100'
```

---

## Storage Issues

### Issue 1: Prometheus Data Corruption

**Symptoms**:
- Prometheus won't start
- Error: "corrupt chunk" or "corrupt block"
- Missing data in queries

**Diagnosis**:
```bash
# Check Prometheus logs
docker logs prometheus | grep -i corrupt

# Verify TSDB
docker exec prometheus promtool tsdb analyze /prometheus/data
```

**Solutions**:

```bash
# Fix 1: Clean corrupted data
docker exec prometheus promtool tsdb clean /prometheus/data

# Fix 2: Delete corrupted block
# Identify corrupted block from logs
docker exec prometheus rm -rf /prometheus/data/[block-id]

# Fix 3: Restore from backup
# Stop Prometheus
docker stop prometheus

# Restore data
cp -r /backup/prometheus-data/* /prometheus/data/

# Start Prometheus
docker start prometheus

# Fix 4: Fresh start (last resort)
docker stop prometheus
docker exec prometheus rm -rf /prometheus/data/*
docker start prometheus
```

---

## Quick Reference Commands

### Health Checks
```bash
# All services status
docker-compose ps

# Service health
curl http://localhost:9090/-/healthy  # Prometheus
curl http://localhost:9093/-/healthy  # Alertmanager
curl http://localhost:3000/api/health  # Grafana

# View all logs
docker-compose logs --tail=100 --follow
```

### Restart Services
```bash
# Restart specific service
docker restart [service-name]

# Restart all monitoring
docker-compose restart

# Full restart (reload config)
docker-compose down && docker-compose up -d
```

### Configuration Validation
```bash
# Validate Prometheus config
promtool check config prometheus.yml

# Validate alert rules
promtool check rules alert-rules.yml

# Validate Alertmanager config
amtool check-config alertmanager.yml
```

### Data Management
```bash
# Backup
tar czf prometheus-backup.tar.gz /prometheus/data

# Clean old data
docker exec prometheus find /prometheus/data -mtime +30 -delete

# Check disk usage
du -sh /prometheus/data
df -h
```

---

## Getting Help

### Before Requesting Help

1. ✅ Check this troubleshooting guide
2. ✅ Review logs: `docker logs [service]`
3. ✅ Check service status: `docker ps -a`
4. ✅ Verify configurations
5. ✅ Search error messages online
6. ✅ Check official documentation

### When Requesting Help

Provide:
```
- Error message (full text)
- Service logs (last 100 lines)
- Configuration files
- Steps to reproduce
- What you've tried already
- System information (OS, Docker version)
```

### Support Channels

- **Slack**: #devops-support
- **Email**: devops@aurex.in
- **Docs**: Internal wiki
- **Emergency**: PagerDuty

---

**Document Version**: 1.0
**Last Updated**: October 30, 2025
**Maintained By**: DevOps Team
