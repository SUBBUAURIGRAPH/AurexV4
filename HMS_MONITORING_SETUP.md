# HMS J4C Agent - Monitoring & Alerting Setup

**Date**: October 29, 2025
**Status**: ✅ Production Monitoring Ready

---

## 📊 Monitoring Stack

### Components
- **Prometheus** (9090): Metrics collection and alerting
- **Grafana** (3000): Visualization and dashboards
- **HMS Agent** (9003): Application metrics endpoint
- **NGINX**: Reverse proxy with SSL/TLS

### Architecture
```
HMS Agent (/metrics) → Prometheus → Grafana
                     → Alert Rules → Notifications
```

---

## 🔔 Alert Rules

### Critical Alerts (IMMEDIATE ACTION)
1. **HMSAgentDown** - Application unreachable for 2+ minutes
2. **NginxProxyDown** - Reverse proxy unreachable for 2+ minutes
3. **PostgresDown** - Database unreachable for 2+ minutes
4. **SSLCertificateExpired** - SSL certificate no longer valid

### Warning Alerts (INVESTIGATE)
1. **HealthCheckFailing** - /health endpoint returning non-200
2. **HighMemoryUsage** - Memory > 500MB for 5+ minutes
3. **HighErrorRate** - 5xx errors > 5% for 5+ minutes
4. **HighRequestLatency** - p99 latency > 5 seconds for 5+ minutes
5. **ServiceRestartingFrequently** - > 3 restarts in 10 minutes

---

## 📈 Key Metrics to Monitor

### Application Health
- **Uptime**: Target > 99.9%
- **Error Rate**: Target < 1%, Warning > 5%
- **Response Time (p95)**: Target < 1s, Warning > 5s
- **Request Rate**: Baseline monitoring

### Resource Usage
- **Memory**: Target < 200MB, Warning > 500MB
- **CPU**: Target < 20%, Warning > 80%
- **Disk Space**: Warning < 20% free

### API Performance
- **Requests/sec**: Baseline monitoring
- **Errors by endpoint**: Identify problem areas
- **Slowest endpoints**: Find bottlenecks

---

## 🚀 Setup Instructions

### Step 1: Deploy Alert Rules
```bash
# Copy prometheus-alerts.yml to production server
scp prometheus-alerts.yml subbu@hms.aurex.in:/opt/HMS/

# Update Prometheus configuration to include rules
ssh subbu@hms.aurex.in
cd /opt/HMS
# Add to prometheus-dlt.yml:
# rule_files:
#   - "prometheus-alerts.yml"

# Restart Prometheus
docker-compose -f docker-compose.production.yml restart prometheus
```

### Step 2: Configure Notifications
See HMS_MONITORING_GUIDE.md for Slack/Email/PagerDuty setup

### Step 3: Access Dashboards
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000
- Credentials: See docker-compose.production.yml

---

## 🔍 Monitoring Commands

### Check Health
```bash
# HMS health
curl https://hms.aurex.in/health

# Prometheus health
curl http://localhost:9090/-/healthy

# Prometheus targets
curl http://localhost:9090/api/v1/targets
```

### View Metrics
```bash
# Get all metrics from HMS
curl https://hms.aurex.in/metrics

# Query Prometheus
curl 'http://localhost:9090/api/v1/query?query=http_requests_total'

# Query time series
curl 'http://localhost:9090/api/v1/query_range?query=rate(http_requests_total[5m])&start=START&end=END&step=60s'
```

### View Alerts
```bash
# Get active alerts
curl http://localhost:9090/api/v1/alerts

# Get alert rules
curl http://localhost:9090/api/v1/rules
```

---

## 🛠️ Alert Response Guide

### When HMSAgentDown Alert Fires
1. Check if container is running: `docker ps | grep hms-j4c-agent`
2. If down, start it: `docker-compose up -d hms-j4c-agent`
3. If won't start, check logs: `docker logs hms-j4c-agent`
4. If persistent, escalate to development team

### When HighErrorRate Alert Fires
1. Check recent logs: `docker logs hms-j4c-agent | tail -50`
2. Query which endpoints are failing
3. Check database connectivity
4. Restart container if transient: `docker-compose restart hms-j4c-agent`

### When HighMemoryUsage Alert Fires
1. Check current memory: `curl https://hms.aurex.in/metrics | grep memory`
2. Monitor trend over next 15 minutes
3. If increasing, restart: `docker-compose restart hms-j4c-agent`
4. If persists after restart, investigate code for memory leak

---

## ✅ Monitoring Checklist

**Daily**:
- ✅ Check Grafana dashboard
- ✅ Verify no active critical alerts
- ✅ Review error logs
- ✅ Check disk space usage

**Weekly**:
- ✅ Review performance trends
- ✅ Analyze slow endpoints
- ✅ Check alert frequency and accuracy
- ✅ Verify backup status

**Monthly**:
- ✅ Review capacity planning
- ✅ Update alert thresholds
- ✅ Check SSL certificate expiry (>30 days)
- ✅ Plan for growth

---

## 📞 Support Contacts

For monitoring issues:
- Engineering: engineering@aurigraph.io
- On-call: See runbook
- Emergency: Escalate to platform team

---

**Status**: ✅ Operational
**Last Updated**: October 29, 2025
**Next Review**: November 5, 2025
