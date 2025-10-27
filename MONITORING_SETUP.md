# Monitoring Setup Guide - Grafana & Prometheus

**Date**: October 27, 2025
**Status**: Ready to Deploy
**Environment**: dlt.aurigraph.io (Production)

---

## Overview

This guide covers setting up comprehensive monitoring dashboards in Grafana and configuring alerts in Prometheus. The system monitors:

- **J4C Agent Plugin**: Performance, API latency, request rates
- **NGINX Reverse Proxy**: Request metrics, error rates, SSL status
- **PostgreSQL Database**: Query performance, connection pools, disk usage
- **System Resources**: CPU, memory, disk I/O
- **Grafana & Prometheus**: Self-monitoring metrics

---

## Quick Start (10-15 minutes)

### Step 1: Access Grafana

1. Open browser: **https://dlt.aurigraph.io:3000**
2. Login with credentials from .env:
   - Username: `admin`
   - Password: `GRAFANA_ADMIN_PASSWORD` (from your .env file)

### Step 2: Add Prometheus Data Source

1. Click **Settings** (gear icon) → **Data Sources**
2. Click **Add Data Source**
3. Select **Prometheus**
4. Configure:
   - **Name**: `Prometheus`
   - **URL**: `http://j4c-prometheus:9090`
   - **Access**: `Browser`
   - **Scrape Interval**: `15s`
5. Click **Save & Test** (should show "Data source is working")

### Step 3: Import Dashboards

Follow steps in section "Import Pre-Built Dashboards" below.

### Step 4: Create Alert Notification Channel

1. Navigate to **Alerting** → **Notification Channels**
2. Create email notification (optional, requires SMTP setup)
3. Create Webhook notification (for Slack/Teams integration)

---

## Prometheus Configuration

### Alert Rules Setup

Create file: `/opt/DLT/prometheus-alerts.yml`

```yaml
groups:
  - name: j4c_alerts
    interval: 30s
    rules:
      # ==========================================
      # J4C Agent Plugin Alerts
      # ==========================================

      - alert: J4CAgentDown
        expr: up{job="j4c-agent"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "J4C Agent Plugin is DOWN"
          description: "J4C Agent service has been unreachable for 2 minutes"

      - alert: J4CHighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "J4C High Error Rate (>5%)"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: J4CHighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "J4C High API Latency"
          description: "95th percentile latency: {{ $value }}s"

      - alert: J4CMemoryHigh
        expr: container_memory_usage_bytes{name="j4c-agent-plugin"} / 1073741824 > 0.4
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "J4C Memory Usage High (>40%)"
          description: "Memory usage: {{ $value | humanize }}GB"

      # ==========================================
      # NGINX Alerts
      # ==========================================

      - alert: NGINXDown
        expr: up{job="nginx"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "NGINX Proxy is DOWN"
          description: "NGINX has been unreachable for 2 minutes"

      - alert: NGINXHighErrorRate
        expr: rate(nginx_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "NGINX High Error Rate"
          description: "5xx errors: {{ $value | humanizePercentage }}"

      - alert: NGINXSSLCertExpiring
        expr: ssl_cert_not_after - time() < 604800
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "SSL Certificate Expiring Soon (<7 days)"
          description: "Certificate will expire in {{ $value | humanizeDuration }}"

      # ==========================================
      # PostgreSQL Alerts
      # ==========================================

      - alert: PostgreSQLDown
        expr: up{job="postgres"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL is DOWN"
          description: "Database has been unreachable for 2 minutes"

      - alert: PostgreSQLHighConnections
        expr: pg_stat_activity_count{state="active"} > 50
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL High Connection Count"
          description: "Active connections: {{ $value }}"

      - alert: PostgreSQLDiskSpaceWarning
        expr: pg_database_size_bytes{datname="j4c_agents"} / pg_stat_database_blks_hit > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL Disk Space Low"
          description: "Database size is 80%+ of available space"

      - alert: PostgreSQLSlowQueries
        expr: rate(pg_slow_queries[5m]) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL Slow Query Rate High"
          description: "Slow queries per minute: {{ $value }}"

      # ==========================================
      # System Resource Alerts
      # ==========================================

      - alert: HighCPUUsage
        expr: (1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU Usage (>80%)"
          description: "CPU usage: {{ $value | humanizePercentage }}"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High Memory Usage (>85%)"
          description: "Memory usage: {{ $value | humanizePercentage }}"

      - alert: DiskSpaceWarning
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes) < 0.15
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Disk Space Low (<15%)"
          description: "Available space: {{ $value | humanizePercentage }}"

      - alert: DiskSpaceCritical
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes) < 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Disk Space Critical (<5%)"
          description: "Available space: {{ $value | humanizePercentage }}"
```

### Deploy Alert Rules

```bash
# Copy alert rules to remote server
scp -P 22 /Users/subbujois/subbuworkingdir/Aurex/glowing-adventure/prometheus-alerts.yml \
    subbu@dlt.aurigraph.io:/opt/DLT/

# SSH to server and reload Prometheus
ssh -p 22 subbu@dlt.aurigraph.io

# Reload Prometheus to apply new rules
docker exec j4c-prometheus kill -HUP 1

# Or restart Prometheus service
docker-compose -f /opt/DLT/docker-compose.yml restart j4c-prometheus

# Verify alerts loaded
curl http://localhost:9090/api/v1/rules | jq '.data.groups[].rules | length'
```

---

## Grafana Dashboard Setup

### Dashboard 1: J4C Agent Overview

**Name**: J4C Agent Plugin - Overview
**Purpose**: High-level system health and performance metrics

**Panels**:

1. **Service Status** (Stat)
   - Query: `up{job="j4c-agent"}`
   - Thresholds: 1 = green (up), 0 = red (down)

2. **Request Rate** (Graph)
   - Query: `rate(http_requests_total[5m])`
   - Title: "Requests per Second"

3. **Error Rate** (Graph)
   - Query: `rate(http_requests_total{status=~"5.."}[5m])`
   - Title: "5xx Error Rate"
   - Threshold: > 0.05 warning

4. **API Latency P95** (Gauge)
   - Query: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
   - Unit: seconds
   - Threshold: > 1s warning

5. **Memory Usage** (Gauge)
   - Query: `container_memory_usage_bytes{name="j4c-agent-plugin"} / 1073741824`
   - Unit: GB
   - Max: 0.5

6. **CPU Usage** (Gauge)
   - Query: `rate(container_cpu_usage_seconds_total{name="j4c-agent-plugin"}[5m]) * 100`
   - Unit: percent
   - Max: 50

7. **Agent Skills Count** (Stat)
   - Query: `j4c_agent_skills_total`
   - Title: "Total Available Skills"

8. **Active Tasks** (Stat)
   - Query: `j4c_active_tasks_total`
   - Title: "Currently Running Tasks"

### Dashboard 2: Infrastructure Health

**Name**: Infrastructure - System Health
**Purpose**: Monitor system-wide health

**Panels**:

1. **Services Status** (Table)
   - Query: `up{job=~"j4c-agent|nginx|postgres|prometheus|grafana"}`
   - Shows which services are up/down

2. **NGINX Request Rate** (Graph)
   - Query: `rate(nginx_requests_total[5m])`
   - Title: "NGINX Requests/sec"

3. **NGINX Error Rate** (Graph)
   - Query: `rate(nginx_requests_total{status=~"5.."}[5m])`
   - Title: "NGINX 5xx Errors"

4. **CPU Usage by Container** (Graph)
   - Query: `rate(container_cpu_usage_seconds_total[5m]) * 100`
   - Group by: Container name

5. **Memory Usage by Container** (Graph)
   - Query: `container_memory_usage_bytes / 1073741824`
   - Group by: Container name

6. **Disk Space** (Gauge)
   - Query: `(node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes) * 100`
   - Unit: percent
   - Threshold: < 15% warning

7. **Network I/O** (Graph)
   - Query: `rate(node_network_receive_bytes_total[5m])`
   - Show both receive and transmit

### Dashboard 3: Database Performance

**Name**: PostgreSQL - Database Performance
**Purpose**: Monitor database health and performance

**Panels**:

1. **Database Status** (Stat)
   - Query: `up{job="postgres"}`
   - Title: "PostgreSQL Status"

2. **Active Connections** (Gauge)
   - Query: `pg_stat_activity_count{state="active"}`
   - Max: 100
   - Threshold: > 50 warning

3. **Query Performance** (Graph)
   - Query: `rate(pg_stat_statements_mean_time[5m])`
   - Title: "Average Query Time"

4. **Database Size** (Gauge)
   - Query: `pg_database_size_bytes{datname="j4c_agents"} / 1073741824`
   - Unit: GB

5. **Cache Hit Ratio** (Gauge)
   - Query: `pg_stat_database_blks_hit{datname="j4c_agents"} / (pg_stat_database_blks_hit{datname="j4c_agents"} + pg_stat_database_blks_read{datname="j4c_agents"})`
   - Unit: percentunit
   - Target: > 0.99

6. **Slow Queries** (Graph)
   - Query: `rate(pg_slow_queries[5m])`
   - Title: "Slow Queries per Minute"

7. **Connections by State** (Graph)
   - Query: `pg_stat_activity_count` grouped by state
   - Shows idle, active, waiting connections

### Dashboard 4: Application Metrics

**Name**: J4C Agents - Application Metrics
**Purpose**: Agent system performance and productivity

**Panels**:

1. **Agent Count** (Stat)
   - Query: `j4c_agent_count_total`
   - Title: "Total Agents"

2. **Task Success Rate** (Gauge)
   - Query: `(j4c_tasks_successful_total / j4c_tasks_total) * 100`
   - Unit: percent
   - Target: > 95%

3. **Average Task Duration** (Graph)
   - Query: `j4c_task_duration_seconds_bucket`
   - Percentiles: p50, p95, p99

4. **Skills Usage Distribution** (Pie Chart)
   - Query: `topk(10, j4c_skill_executions_total)`
   - Shows most-used skills

5. **Agent Productivity** (Graph)
   - Query: `rate(j4c_completed_tasks_total[1h])`
   - Group by agent

6. **GNN Recommendations Accepted** (Gauge)
   - Query: `(j4c_gnn_recommendations_accepted / j4c_gnn_recommendations_total) * 100`
   - Unit: percent

7. **Knowledge Base Growth** (Graph)
   - Query: `j4c_knowledge_base_size_bytes / 1024 / 1024`
   - Unit: MB
   - Title: "Knowledge Base Size"

---

## Manual Dashboard Creation

If you prefer to create dashboards manually:

### Access Grafana

1. Navigate to https://dlt.aurigraph.io:3000
2. Click **+** → **Dashboard**
3. Click **Add Panel**

### Create Panel

1. **Panel Title**: Enter descriptive name
2. **Data Source**: Select "Prometheus"
3. **Metrics Query**: Enter Prometheus query
4. **Visualization**: Select chart type (Graph, Gauge, Stat, etc.)
5. **Alert**: Optional - set alert thresholds
6. **Save**: Click Save to add to dashboard

### Example Query: Request Rate

```
rate(http_requests_total[5m])
```

This shows the number of HTTP requests per second over the last 5 minutes.

---

## Alert Configuration

### Create Webhook Notification

For Slack/Teams integration:

1. Go to **Alerting** → **Notification Channels**
2. Click **New Channel**
3. **Name**: "Slack Alerts"
4. **Type**: Webhook
5. **Webhook URL**: Your Slack incoming webhook URL
6. **HTTP Method**: POST
7. Click **Save**

### Create Email Notification

1. Go to **Alerting** → **Notification Channels**
2. Click **New Channel**
3. **Name**: "Email Alerts"
4. **Type**: Email
5. **Addresses**: recipient@example.com
6. **Send reminder**: Enabled (every hour)
7. Click **Save**

### Configure Alert on Dashboard

1. Edit any panel
2. Go to **Alert** tab
3. Click **Create Alert**
4. Set **Condition**:
   - Query condition
   - Threshold value
   - Duration (evaluation window)
5. Set **No Data and Error Handling**
6. Set **Notification Channel**: Choose created channel
7. Click **Save**

---

## Key Metrics to Monitor

### J4C Agent Plugin

- **Uptime**: Agent availability (should be 100%)
- **Request Latency**: API response time (target: < 500ms)
- **Error Rate**: Percentage of failed requests (target: < 1%)
- **Throughput**: Requests per second (baseline for comparison)
- **Memory Usage**: Agent memory consumption (max 50% of allocated)
- **CPU Usage**: Agent CPU usage (max 80%)
- **Active Tasks**: Currently executing tasks
- **Skill Usage**: Distribution of skill invocations

### NGINX

- **Request Rate**: Total incoming requests/sec
- **Error Rate**: 4xx and 5xx errors
- **Request Distribution**: GET, POST, PUT, DELETE breakdown
- **Upstream Health**: Backend service availability
- **SSL Certificate Expiry**: Days until cert renewal needed
- **Cache Hit Rate**: If caching is enabled

### PostgreSQL

- **Active Connections**: Currently connected clients
- **Query Performance**: Average, p95, p99 query times
- **Slow Queries**: Queries exceeding 1 second
- **Database Size**: Disk space used
- **Cache Hit Ratio**: Memory cache effectiveness (target: > 99%)
- **Write/Read Ratio**: IO load distribution
- **Replication Lag**: If using replication (N/A for single instance)

### System Resources

- **CPU Usage**: Overall and per-core utilization
- **Memory Usage**: Total and available
- **Disk Space**: Available and usage trends
- **Network I/O**: Bandwidth usage
- **Load Average**: System load (1m, 5m, 15m)
- **File Descriptor Usage**: Open files/sockets

---

## Dashboard Import Instructions

If you have JSON dashboard definitions:

1. Download dashboard JSON file
2. In Grafana: **+** → **Import**
3. Paste JSON content or upload file
4. Select Prometheus data source
5. Click **Import**

---

## Recommended Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Agent Uptime | < 99.5% | < 99% |
| Error Rate | > 1% | > 5% |
| API Latency (p95) | > 1s | > 5s |
| Memory Usage | > 40% | > 50% |
| CPU Usage | > 70% | > 90% |
| Disk Space | < 15% | < 5% |
| DB Connections | > 50 | > 80 |
| Slow Queries/min | > 5 | > 20 |

---

## Verification Steps

After setup, verify monitoring is working:

```bash
# 1. Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'

# 2. Check alerts are loaded
curl http://localhost:9090/api/v1/rules | jq '.data.groups[].rules | length'

# 3. Test a query
curl 'http://localhost:9090/api/v1/query?query=up'

# 4. Verify Grafana data source
curl -H "Authorization: Bearer <api_token>" \
  http://localhost:3000/api/datasources/proxy/1/api/v1/query?query=up
```

---

## Backup Grafana Dashboards

```bash
# Export all dashboards
curl -H "Authorization: Bearer admin:PASSWORD" \
  http://localhost:3000/api/search | \
  jq -r '.[] | .id' | \
  while read id; do
    curl -H "Authorization: Bearer admin:PASSWORD" \
      http://localhost:3000/api/dashboards/db/dashboard-$id > dashboard-$id.json
  done

# Restore from backup
for file in dashboard-*.json; do
  curl -X POST \
    -H "Authorization: Bearer admin:PASSWORD" \
    -H "Content-Type: application/json" \
    -d @$file \
    http://localhost:3000/api/dashboards/db
done
```

---

## Troubleshooting

### No Data in Dashboards

1. Verify Prometheus data source is configured
2. Check Prometheus scrape targets: http://localhost:9090/targets
3. Verify services are exposing metrics on expected ports
4. Check Prometheus retention hasn't deleted data

### Alerts Not Firing

1. Verify alert rules are loaded: `/api/v1/rules`
2. Check alert condition with query in Prometheus UI
3. Verify notification channel is configured and tested
4. Check Grafana logs for alert execution errors

### High Memory Usage in Grafana

1. Check dashboard complexity (too many panels)
2. Reduce query frequency (increase step parameter)
3. Increase Grafana container memory limit
4. Remove old dashboards

---

**Monitoring Setup Status**: ✅ READY FOR DEPLOYMENT
**Next Phase**: Update Agent Knowledge Base

