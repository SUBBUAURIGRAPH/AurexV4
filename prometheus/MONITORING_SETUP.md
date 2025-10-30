# HMS Monitoring Infrastructure Setup Guide

**Hermes Trading Platform - Phase 4: Performance & Monitoring**
**Production Server:** hms.aurex.in
**Last Updated:** October 30, 2025

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Dashboard Setup](#dashboard-setup)
7. [Alert Configuration](#alert-configuration)
8. [Testing](#testing)
9. [Maintenance](#maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The HMS monitoring infrastructure provides comprehensive observability for the Hermes Trading Platform, including:

- **Real-time metrics** collection and aggregation
- **Visual dashboards** for system health and performance
- **Automated alerting** with multi-channel notifications
- **SLO tracking** and error budget monitoring
- **Historical data** retention and analysis

### Key Features

- ✅ Multi-service monitoring (API, Database, WebSocket, Trading)
- ✅ 7 pre-built Grafana dashboards
- ✅ 40+ alert rules with smart routing
- ✅ Slack, Email, and PagerDuty integrations
- ✅ SLO tracking with error budgets
- ✅ 65 recording rules for performance
- ✅ 30-day local retention + long-term storage

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         HMS Production                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ HMS API  │  │PostgreSQL│  │  NGINX   │  │WebSocket │       │
│  │ (J4C)    │  │          │  │  Proxy   │  │ Server   │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │ :9003       │ :9187       │ :9113       │ :9003        │
│       │             │             │             │              │
│       └─────────────┴─────────────┴─────────────┘              │
│                           │                                     │
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │   Prometheus    │                           │
│                  │   (Port 9090)   │                           │
│                  └────────┬────────┘                           │
│                           │                                     │
│              ┌────────────┼────────────┐                       │
│              ▼            ▼            ▼                       │
│      ┌─────────────┐ ┌─────────┐ ┌──────────┐                │
│      │Alertmanager │ │ Grafana │ │  Thanos  │                │
│      │ (Port 9093) │ │(:3000)  │ │(Remote)  │                │
│      └──────┬──────┘ └─────────┘ └──────────┘                │
│             │                                                   │
│    ┌────────┼────────┐                                        │
│    ▼        ▼        ▼                                        │
│ ┌─────┐ ┌──────┐ ┌─────────┐                                 │
│ │Slack│ │Email │ │PagerDuty│                                 │
│ └─────┘ └──────┘ └─────────┘                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Metrics Collection**: Prometheus scrapes metrics from exporters every 10-30s
2. **Storage**: Metrics stored locally (30 days) + remote (Thanos, unlimited)
3. **Evaluation**: Alert rules evaluated every 30s-1m
4. **Notification**: Alertmanager routes alerts to appropriate channels
5. **Visualization**: Grafana queries Prometheus for dashboard data

---

## Components

### 1. Prometheus

**Purpose**: Metrics collection, storage, and querying

**Configuration File**: `prometheus.yml`

**Key Settings**:
- Scrape interval: 10-30s (service-dependent)
- Retention: 30 days local storage
- Storage: 50GB max
- Remote write: Thanos integration

**Metrics Collected**:
- HTTP requests, latency, error rates
- Database connections, query performance
- System resources (CPU, memory, disk)
- WebSocket connections and messages
- Trading orders and confirmations
- Alpaca API performance

### 2. Alertmanager

**Purpose**: Alert routing, grouping, and notification

**Configuration File**: `alertmanager.yml`

**Features**:
- Multi-channel routing (Slack, Email, PagerDuty)
- Alert grouping by severity
- Inhibition rules to prevent alert spam
- Escalation policies

**Notification Channels**:
- **Critical**: PagerDuty + Slack + Email
- **Warning**: Slack + Email
- **Info**: Slack only

### 3. Grafana

**Purpose**: Data visualization and dashboards

**Port**: 3000

**Dashboards** (7 total):
1. HMS Overview - System health summary
2. API Performance - Request latency and errors
3. Database Performance - Query performance and connections
4. System Health - CPU, memory, disk metrics
5. WebSocket Metrics - Real-time connection monitoring
6. Trading Metrics - Order flow and success rates
7. Alerts Overview - Active alerts and trends

### 4. Node Exporter

**Purpose**: System-level metrics collection

**Port**: 9100

**Metrics**:
- CPU usage by core
- Memory utilization
- Disk I/O and space
- Network traffic
- System load

### 5. PostgreSQL Exporter

**Purpose**: Database metrics collection

**Port**: 9187

**Metrics**:
- Connection pool status
- Query execution times
- Cache hit ratios
- Table and index sizes
- Transaction rates

### 6. Blackbox Exporter

**Purpose**: Endpoint health checks

**Port**: 9115

**Checks**:
- HTTPS endpoints availability
- Response time monitoring
- SSL certificate expiration

### 7. cAdvisor

**Purpose**: Container resource monitoring

**Port**: 8080

**Metrics**:
- Container CPU usage
- Container memory usage
- Container network I/O
- Container disk usage

---

## Installation

### Prerequisites

- Docker and Docker Compose installed
- Minimum 4GB RAM available
- 50GB disk space for metrics storage
- Network access to monitored services

### Step 1: Clone Repository

```bash
cd /opt/hms
git pull origin main
cd prometheus
```

### Step 2: Set Environment Variables

Create `.env` file:

```bash
# Alertmanager Configuration
export SMTP_PASSWORD="your-gmail-app-password"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
export PAGERDUTY_ROUTING_KEY="your-pagerduty-integration-key"

# Grafana Configuration
export GF_SECURITY_ADMIN_PASSWORD="your-secure-password"
export GF_INSTALL_PLUGINS="grafana-piechart-panel"
```

### Step 3: Deploy with Docker Compose

```bash
# Start all monitoring services
docker-compose up -d

# Verify all containers are running
docker-compose ps

# Check logs
docker-compose logs -f prometheus
docker-compose logs -f grafana
docker-compose logs -f alertmanager
```

### Step 4: Verify Services

```bash
# Prometheus
curl http://localhost:9090/-/healthy

# Alertmanager
curl http://localhost:9093/-/healthy

# Grafana
curl http://localhost:3000/api/health
```

---

## Configuration

### Prometheus Configuration

**File**: `prometheus.yml`

**Key Sections**:

1. **Global Settings**:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'hms-production'
    environment: 'production'
```

2. **Scrape Configs**: 11 jobs configured
   - hms-j4c-agent (10s interval)
   - hms-postgres (30s interval)
   - node-exporter (15s interval)
   - etc.

3. **Alert Rules**:
```yaml
rule_files:
  - 'alert-rules.yml'
  - 'recording-rules.yml'
```

### Alert Rules

**File**: `alert-rules.yml`

**Alert Categories**:
- Critical Infrastructure (8 alerts)
- Performance Warnings (7 alerts)
- WebSocket Alerts (2 alerts)
- Trading Alerts (3 alerts)
- SSL Certificate Alerts (2 alerts)

**Example Alert**:
```yaml
- alert: HMSAPIDown
  expr: up{job="hms-j4c-agent"} == 0
  for: 2m
  labels:
    severity: critical
    priority: P1
  annotations:
    summary: "HMS API Server is DOWN"
    action: |
      1. SSH to server
      2. Check container status
      3. Review logs
      4. Restart if needed
```

### Recording Rules

**File**: `recording-rules.yml`

**Rule Categories**:
- HTTP Request Metrics (12 rules)
- API Latency Metrics (7 rules)
- Order & Trading Metrics (10 rules)
- WebSocket Metrics (6 rules)
- Database Metrics (8 rules)
- System Metrics (5 rules)
- SLO Metrics (12 rules)
- Business Metrics (5 rules)

**Total**: 65 recording rules

---

## Dashboard Setup

### Importing Dashboards

1. **Access Grafana**:
   ```
   https://hms.aurex.in/grafana
   ```

2. **Login**:
   - Username: `admin`
   - Password: From environment variable

3. **Import Dashboards**:
   - Navigate to: Dashboards → Import
   - Upload JSON files from `dashboards/` directory
   - Select Prometheus data source
   - Click "Import"

### Dashboard List

| Dashboard | File | Purpose |
|-----------|------|---------|
| HMS Overview | `hms-overview.json` | System health summary |
| API Performance | `api-performance.json` | Request metrics |
| Database Performance | `database-performance.json` | DB queries |
| System Health | `system-health.json` | Resources |
| WebSocket Metrics | `websocket-metrics.json` | Real-time |
| Trading Metrics | `trading-metrics.json` | Orders |
| Alerts Overview | `alerts-overview.json` | Alerts |

### Dashboard Configuration

Each dashboard includes:
- Auto-refresh (30s)
- Time range selector
- Variable filters
- Alert annotations
- Panel drill-downs

---

## Alert Configuration

### Alertmanager Setup

1. **Configure Slack**:
```bash
# Create Slack webhook
# 1. Go to https://api.slack.com/apps
# 2. Create new app
# 3. Enable Incoming Webhooks
# 4. Create webhook for channel
# 5. Copy webhook URL to .env file
```

2. **Configure Email**:
```bash
# Gmail configuration
# 1. Enable 2FA on Gmail
# 2. Generate App Password
# 3. Add to .env file
```

3. **Configure PagerDuty**:
```bash
# 1. Create service in PagerDuty
# 2. Get integration key
# 3. Add to .env file
```

### Alert Routing

**Critical Alerts** → PagerDuty + Slack (#critical-alerts) + Email
**Warning Alerts** → Slack (#devops-alerts) + Email
**Info Alerts** → Slack (#monitoring-info)

### Testing Alerts

```bash
# Send test alert
amtool alert add \
  --alertmanager.url=http://localhost:9093 \
  alertname=TestAlert \
  severity=warning \
  service=test \
  summary="This is a test alert"

# Check alert status
amtool alert query --alertmanager.url=http://localhost:9093

# Silence alert
amtool silence add \
  --alertmanager.url=http://localhost:9093 \
  alertname=TestAlert \
  --duration=1h \
  --comment="Testing silences"
```

---

## Testing

### 1. Metrics Collection Test

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job, health}'

# Query a metric
curl 'http://localhost:9090/api/v1/query?query=up' | jq
```

### 2. Alert Rule Test

```bash
# Check loaded rules
curl http://localhost:9090/api/v1/rules | jq

# Check active alerts
curl http://localhost:9090/api/v1/alerts | jq
```

### 3. Dashboard Test

1. Open Grafana: `https://hms.aurex.in/grafana`
2. Navigate to HMS Overview dashboard
3. Verify all panels load data
4. Check for "No data" errors

### 4. Notification Test

```bash
# Test Slack notification
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test message from HMS monitoring"}'

# Check Alertmanager status
curl http://localhost:9093/api/v2/status | jq
```

---

## Maintenance

### Daily Tasks

- Review active alerts in Grafana
- Check alert notification success rate
- Monitor disk space usage

### Weekly Tasks

- Review dashboard performance
- Update alert thresholds if needed
- Check for configuration drift

### Monthly Tasks

- Review SLO compliance
- Analyze alert patterns
- Update runbooks
- Optimize recording rules
- Clean up old data

### Backup Procedures

```bash
# Backup Prometheus data
docker exec prometheus tar czf /tmp/prometheus-data.tar.gz /prometheus/data
docker cp prometheus:/tmp/prometheus-data.tar.gz ./backups/

# Backup Grafana dashboards
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/search?type=dash-db | \
  jq -r '.[] | .uid' | \
  xargs -I {} curl -H "Authorization: Bearer YOUR_API_KEY" \
    http://localhost:3000/api/dashboards/uid/{} > dashboards-backup.json

# Backup configurations
tar czf config-backup.tar.gz prometheus.yml alert-rules.yml recording-rules.yml alertmanager.yml
```

---

## Troubleshooting

### Prometheus Not Scraping Targets

**Symptoms**: Targets show as "DOWN" in Prometheus

**Solutions**:
```bash
# Check target accessibility
curl http://target-host:port/metrics

# Check Prometheus logs
docker logs prometheus --tail 100

# Verify network connectivity
docker exec prometheus ping target-host

# Restart Prometheus
docker restart prometheus
```

### Grafana Not Showing Data

**Symptoms**: Dashboards show "No data"

**Solutions**:
```bash
# Check Prometheus data source
# Grafana → Configuration → Data Sources → Prometheus

# Verify query in Prometheus first
curl 'http://localhost:9090/api/v1/query?query=up'

# Check Grafana logs
docker logs grafana --tail 100

# Clear Grafana cache
docker exec grafana rm -rf /var/lib/grafana/cache/*
docker restart grafana
```

### Alerts Not Firing

**Symptoms**: Expected alerts not triggering

**Solutions**:
```bash
# Check alert rules syntax
promtool check rules alert-rules.yml

# Verify rule evaluation
curl http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.type=="alerting")'

# Check Alertmanager config
amtool config show --alertmanager.url=http://localhost:9093

# Test alert manually
amtool alert add alertname=TestAlert severity=critical
```

### High Memory Usage

**Symptoms**: Prometheus using >4GB RAM

**Solutions**:
```bash
# Check metric cardinality
curl http://localhost:9090/api/v1/status/tsdb | jq

# Reduce retention
# Edit prometheus.yml:
# storage:
#   tsdb:
#     retention.time: 15d  # Reduce from 30d

# Add metric relabeling to drop high-cardinality metrics
```

### Disk Space Issues

**Symptoms**: Disk usage >90%

**Solutions**:
```bash
# Check Prometheus data size
du -sh /prometheus/data

# Clean old data
docker exec prometheus rm -rf /prometheus/data/wal/*

# Enable compression
# Add to prometheus.yml:
# storage:
#   tsdb:
#     wal-compression: true

# Reduce retention period
```

---

## Performance Tuning

### Prometheus Optimization

```yaml
# prometheus.yml
storage:
  tsdb:
    retention.time: 30d
    retention.size: 50GB
    wal-compression: true

# Reduce scrape frequency for less critical services
scrape_configs:
  - job_name: 'less-critical'
    scrape_interval: 60s  # Instead of 15s
```

### Query Optimization

```yaml
# Use recording rules for complex queries
# Instead of:
# histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Use pre-calculated:
# http:latency:p95
```

### Alert Optimization

```yaml
# Group related alerts
route:
  group_by: ['alertname', 'service']
  group_wait: 30s
  group_interval: 5m
```

---

## Security Considerations

### Authentication

- Enable Grafana authentication (OAuth, LDAP)
- Use API keys for programmatic access
- Rotate credentials quarterly

### Network Security

- Restrict Prometheus to internal network
- Use NGINX reverse proxy with SSL
- Implement IP whitelisting

### Data Privacy

- Avoid collecting PII in metrics
- Mask sensitive data in logs
- Implement data retention policies

---

## Additional Resources

### Documentation

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)

### Internal Guides

- [GRAFANA_DASHBOARD_GUIDE.md](./GRAFANA_DASHBOARD_GUIDE.md)
- [ALERTING_RUNBOOKS.md](./ALERTING_RUNBOOKS.md)
- [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)

### Support

- **Slack**: #devops-support
- **Email**: devops@aurex.in
- **On-Call**: PagerDuty rotation

---

**Document Version**: 1.0
**Last Updated**: October 30, 2025
**Maintained By**: DevOps Team
