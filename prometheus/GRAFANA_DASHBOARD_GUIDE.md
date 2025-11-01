# Grafana Dashboard Guide

**HMS (Hermes Trading Platform) - Monitoring Dashboards**
**Last Updated:** October 30, 2025

## Table of Contents

1. [Dashboard Overview](#dashboard-overview)
2. [HMS Overview Dashboard](#hms-overview-dashboard)
3. [API Performance Dashboard](#api-performance-dashboard)
4. [Database Performance Dashboard](#database-performance-dashboard)
5. [System Health Dashboard](#system-health-dashboard)
6. [WebSocket Metrics Dashboard](#websocket-metrics-dashboard)
7. [Trading Metrics Dashboard](#trading-metrics-dashboard)
8. [Alerts Overview Dashboard](#alerts-overview-dashboard)
9. [Dashboard Customization](#dashboard-customization)
10. [Best Practices](#best-practices)

---

## Dashboard Overview

### Available Dashboards

| Dashboard | Refresh | Purpose | Primary Users |
|-----------|---------|---------|---------------|
| HMS Overview | 30s | System health summary | All teams |
| API Performance | 30s | Request metrics | Backend team |
| Database Performance | 30s | Query performance | Database team |
| System Health | 30s | Resource monitoring | DevOps team |
| WebSocket Metrics | 10s | Real-time connections | Backend team |
| Trading Metrics | 30s | Order flow | Trading team |
| Alerts Overview | 30s | Alert management | DevOps team |

### Common Features

All dashboards include:
- **Auto-refresh**: 10-30s intervals
- **Time range selector**: Last 1h, 6h, 24h, 7d, 30d
- **Variable filters**: Service, instance, environment
- **Alert annotations**: Show alert events on graphs
- **Panel links**: Drill down to detailed views

---

## HMS Overview Dashboard

**File**: `dashboards/hms-overview.json`
**Audience**: All teams
**Refresh**: 30s

### Purpose

Provides a high-level view of the entire HMS system health, including:
- Service availability status
- Request rates and latency
- Error rates
- WebSocket connections
- Trading metrics summary
- System resource utilization

### Key Panels

#### 1. Service Health Status (Row 1)

**Metrics**:
- HMS API Status: `up{job="hms-j4c-agent"}`
- Database Status: `up{job="hms-postgres"}`
- NGINX Status: `up{job="nginx"}`
- Active Alerts: `count(ALERTS{alertstate="firing"})`

**Interpretation**:
- 🟢 Green = Service UP
- 🔴 Red = Service DOWN
- Alert count >5 requires immediate attention

#### 2. Request Rate (Graph)

**Query**: `sum(rate(http_requests_total[5m])) by (service)`

**What to look for**:
- Sudden spikes may indicate traffic surge or DDoS
- Sudden drops may indicate service issues
- Normal range: 10-100 req/s during market hours

#### 3. API Response Time (Graph)

**Queries**:
- p95: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
- p50: `histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))`

**Thresholds**:
- ✅ Good: p95 < 200ms
- ⚠️ Warning: p95 200-500ms
- 🔴 Critical: p95 > 500ms

#### 4. Error Rate (Graph)

**Query**:
```promql
(sum(rate(http_requests_total{status=~"5.."}[5m]))
/ sum(rate(http_requests_total[5m]))) * 100
```

**Thresholds**:
- ✅ Good: <0.1% errors
- ⚠️ Warning: 0.1-1% errors
- 🔴 Critical: >1% errors

#### 5. WebSocket Connections (Graph)

**Query**: `websocket_active_connections`

**Normal behavior**:
- Market hours: 100-500 connections
- After hours: 10-50 connections
- Sudden drops indicate connection issues

#### 6. System Resource Utilization (Gauge)

**Metrics**:
- CPU: `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`
- Memory: `(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100`
- Disk: `(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100`

**Thresholds**:
- 🟢 <70%: Healthy
- 🟡 70-85%: Monitor
- 🔴 >85%: Critical

### Usage Tips

1. **Morning Check**: Review this dashboard first thing each day
2. **Incident Response**: Start here to assess overall impact
3. **Drill Down**: Click on any panel to navigate to detailed dashboard
4. **Time Range**: Use 1h for real-time, 24h for trends

---

## API Performance Dashboard

**File**: `dashboards/api-performance.json`
**Audience**: Backend team
**Refresh**: 30s

### Purpose

Deep dive into API request performance, including:
- Request rates by endpoint
- Response time percentiles
- Error analysis
- Slow endpoint identification

### Key Panels

#### 1. HTTP Request Rate by Endpoint

**Query**: `sum(rate(http_requests_total[5m])) by (path)`

**What to monitor**:
- Top traffic endpoints
- Unusual endpoint spikes
- Zero-traffic critical endpoints

#### 2. Response Time Percentiles

**Queries**:
- p50, p95, p99 latency calculations

**Analysis**:
- p50: Median user experience
- p95: 95% of users
- p99: Worst-case scenarios

**Action items**:
- p95 >200ms: Investigate slow queries
- p99 >1s: Identify performance bottlenecks

#### 3. Top 10 Slowest Endpoints (Table)

**Query**: `topk(10, histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (path, le)))`

**How to use**:
1. Identify slowest endpoints
2. Click endpoint to see detailed logs
3. Analyze database queries
4. Optimize or add caching

#### 4. Error Rate by Status Code

**Analysis**:
- 4xx errors: Client issues (bad requests)
- 5xx errors: Server issues (requires fixing)

**Common causes**:
- 400: Validation errors
- 401/403: Authentication issues
- 500: Application errors
- 502/503: Service unavailable
- 504: Gateway timeout

### Optimization Actions

Based on dashboard findings:

1. **High latency on specific endpoint**:
   - Review database queries
   - Add database indexes
   - Implement caching
   - Optimize algorithm

2. **High 5xx error rate**:
   - Check application logs
   - Review recent deployments
   - Check database connectivity
   - Verify external API status

3. **Traffic spike**:
   - Verify legitimacy
   - Enable rate limiting if abuse
   - Scale resources if needed

---

## Database Performance Dashboard

**File**: `dashboards/database-performance.json`
**Audience**: Database team, Backend team
**Refresh**: 30s

### Purpose

Monitor PostgreSQL database health and performance:
- Connection pool utilization
- Query execution times
- Cache hit ratios
- Table and index usage

### Key Panels

#### 1. Database Connection Pool

**Query**:
```promql
pg_stat_database_numbackends{datname="hms_production"}
pg_settings_max_connections
```

**Thresholds**:
- 🟢 <60%: Healthy
- 🟡 60-80%: Monitor
- 🔴 >80%: Critical (risk of exhaustion)

**Actions when >80%**:
1. Identify long-running queries
2. Kill idle connections
3. Review connection pooling config
4. Check for connection leaks in code

#### 2. Query Execution Time (p95)

**Query**: `histogram_quantile(0.95, rate(pg_query_duration_seconds_bucket[5m]))`

**Targets**:
- ✅ p95 <100ms: Excellent
- ⚠️ p95 100ms-1s: Acceptable
- 🔴 p95 >1s: Needs optimization

#### 3. Top 10 Slowest Queries (Table)

**How to optimize slow queries**:
1. Get query text from `pg_stat_statements`
2. Run `EXPLAIN ANALYZE` on the query
3. Add missing indexes
4. Rewrite inefficient queries
5. Consider materialized views

#### 4. Cache Hit Ratio (Gauge)

**Query**:
```promql
(sum(pg_stat_database_blks_hit{datname="hms_production"})
/ (sum(pg_stat_database_blks_hit{datname="hms_production"})
+ sum(pg_stat_database_blks_read{datname="hms_production"}))) * 100
```

**Targets**:
- ✅ >95%: Excellent
- ⚠️ 90-95%: Consider tuning
- 🔴 <90%: Increase shared_buffers

### Database Optimization Guide

**Low cache hit ratio (<95%)**:
```sql
-- Increase shared_buffers in postgresql.conf
shared_buffers = 4GB  # 25% of RAM

-- Increase effective_cache_size
effective_cache_size = 12GB  # 75% of RAM
```

**High query times**:
```sql
-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Add indexes
CREATE INDEX CONCURRENTLY idx_orders_created_at
ON orders(created_at);
```

**Connection pool exhaustion**:
```sql
-- Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND state_change < NOW() - INTERVAL '5 minutes';
```

---

## System Health Dashboard

**File**: `dashboards/system-health.json`
**Audience**: DevOps team
**Refresh**: 30s

### Purpose

Monitor system-level resources:
- CPU usage
- Memory utilization
- Disk space and I/O
- Network traffic
- Container resources

### Key Panels

#### 1. CPU Usage

**Query**: `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`

**Normal ranges**:
- Idle: 5-20%
- Market hours: 30-50%
- High load: 50-70%
- Critical: >80%

#### 2. Memory Usage

**Analysis**:
- Available memory most important
- Cached memory is good (not a problem)
- Swap usage indicates memory pressure

**Actions when >85%**:
1. Identify memory-heavy processes
2. Check for memory leaks
3. Restart services if needed
4. Scale up server if persistent

#### 3. Disk Usage

**Critical thresholds**:
- >90%: Clean up immediately
- >95%: Risk of service failure

**Cleanup actions**:
```bash
# Find large files
du -sh /* | sort -rh | head -10

# Clean Docker
docker system prune -a --volumes

# Clean logs
find /var/log -name "*.log" -mtime +30 -delete

# Archive old Prometheus data
```

#### 4. Network Traffic

**What to monitor**:
- Sustained high traffic: DDoS or legitimate surge
- Network errors: Hardware or driver issues
- Packet loss: Network quality problems

---

## WebSocket Metrics Dashboard

**File**: `dashboards/websocket-metrics.json`
**Audience**: Backend team
**Refresh**: 10s (real-time)

### Purpose

Monitor real-time WebSocket connections:
- Active connections
- Connection/disconnection rates
- Message latency
- Subscription metrics

### Key Panels

#### 1. Active WebSocket Connections

**Query**: `websocket_active_connections`

**Expected patterns**:
- Market open: Sharp increase
- Market hours: Stable
- Market close: Gradual decrease
- After hours: Low baseline

**Alerts**:
- Sudden spike: Possible attack
- Sudden drop: Server restart or crash

#### 2. Connection Rate

**Queries**:
- Connect: `rate(websocket_connections_total[2m])`
- Disconnect: `rate(websocket_disconnections_total[2m])`

**Healthy ratio**: Connect ≈ Disconnect (balanced)

**Issues**:
- High disconnect rate: Connection stability issues
- High connect rate: Reconnection loops

#### 3. Message Latency

**Target**: p95 <100ms

**High latency causes**:
- Server CPU bottleneck
- Message queue backlog
- Network issues
- Database query delays

---

## Trading Metrics Dashboard

**File**: `dashboards/trading-metrics.json`
**Audience**: Trading team, Product team
**Refresh**: 30s

### Purpose

Monitor trading operations:
- Order creation rate
- Order confirmation latency
- Success/rejection rates
- Portfolio value
- Alpaca API performance

### Key Panels

#### 1. Order Creation Rate

**Query**: `rate(orders_created_total[5m]) * 60`

**Analysis**:
- Market hours: 10-100 orders/min
- Low rate during market hours: Investigate UX issues
- High rate: Verify not automated abuse

#### 2. Order Confirmation Latency

**Target**: p95 <500ms

**High latency causes**:
- Alpaca API delays
- Database slow queries
- Network latency

#### 3. Order Success Rate (Gauge)

**Query**:
```promql
(sum(rate(orders_filled_total[5m]))
/ sum(rate(orders_created_total[5m]))) * 100
```

**Targets**:
- ✅ >95%: Excellent
- ⚠️ 90-95%: Monitor
- 🔴 <90%: Investigate rejections

#### 4. Order Rejection Reasons (Pie Chart)

**Common reasons**:
- Insufficient buying power
- Market closed
- Invalid symbol
- Price out of bounds
- Alpaca API error

**Actions**:
1. Improve client-side validation
2. Show clearer error messages
3. Check account status
4. Review order parameters

#### 5. Portfolio Value (Graph)

**What to monitor**:
- Steady growth: Positive
- Sudden drops: Market crash or bug
- Flat line: No trading activity

---

## Alerts Overview Dashboard

**File**: `dashboards/alerts-overview.json`
**Audience**: DevOps team, All teams
**Refresh**: 30s

### Purpose

Central hub for alert management:
- Active alerts by severity
- Alert timeline
- Alert frequency
- MTTR (Mean Time To Resolution)
- Notification success rate

### Key Panels

#### 1. Active Alerts by Severity

**Queries**:
- Critical: `count(ALERTS{alertstate="firing", severity="critical"})`
- Warning: `count(ALERTS{alertstate="firing", severity="warning"})`
- Info: `count(ALERTS{alertstate="firing", severity="info"})`

**Target**: Zero critical alerts

#### 2. Active Alerts List (Table)

**Columns**:
- Alert Name
- Severity
- Component
- Priority
- Summary
- Duration

**Actions**:
- Click alert name to see details
- Click component to view related dashboard
- Review runbook link

#### 3. MTTR (Mean Time To Resolution)

**Target**:
- Critical: <15 minutes
- Warning: <1 hour
- Info: <4 hours

**Improving MTTR**:
1. Better runbooks
2. Automated remediation
3. Faster notification
4. Better on-call training

---

## Dashboard Customization

### Creating Custom Panels

1. **Add New Panel**:
   - Click "Add panel" button
   - Choose visualization type
   - Write PromQL query
   - Configure display options

2. **Common Query Patterns**:

**Rate of increase**:
```promql
rate(metric_name[5m])
```

**Aggregation**:
```promql
sum(metric_name) by (label)
```

**Percentile**:
```promql
histogram_quantile(0.95,
  rate(metric_name_bucket[5m])
)
```

**Threshold comparison**:
```promql
metric_name > 100
```

### Adding Variables

1. Go to Dashboard Settings → Variables
2. Add new variable:
   - **Name**: `service`
   - **Type**: Query
   - **Query**: `label_values(up, service)`
3. Use in panels: `up{service="$service"}`

### Setting Alerts on Panels

1. Edit panel
2. Go to "Alert" tab
3. Configure conditions
4. Set notification channel
5. Save dashboard

---

## Best Practices

### Dashboard Design

1. **Order panels by priority**:
   - Most critical metrics at top
   - Details below
   - Logs at bottom

2. **Use consistent colors**:
   - 🟢 Green: Good
   - 🟡 Yellow: Warning
   - 🔴 Red: Critical
   - 🔵 Blue: Info

3. **Add helpful descriptions**:
   - Panel descriptions
   - Threshold explanations
   - Action items

4. **Set appropriate time ranges**:
   - Real-time: 15m-1h
   - Trends: 24h-7d
   - Analysis: 30d

### Query Optimization

1. **Use recording rules for complex queries**
2. **Limit time ranges** to necessary data
3. **Avoid high-cardinality labels**
4. **Use `rate()` for counters**
5. **Use `irate()` for spiky metrics**

### Dashboard Organization

1. **Folder structure**:
   ```
   Dashboards/
   ├── Overview/
   │   └── HMS Overview
   ├── Application/
   │   ├── API Performance
   │   ├── WebSocket Metrics
   │   └── Trading Metrics
   ├── Infrastructure/
   │   ├── System Health
   │   └── Database Performance
   └── Alerting/
       └── Alerts Overview
   ```

2. **Naming conventions**:
   - `[ENV] Component - Purpose`
   - Example: `[PROD] HMS - API Performance`

3. **Dashboard tags**:
   - `production`, `staging`, `development`
   - `backend`, `frontend`, `database`
   - `critical`, `monitoring`

### Sharing Dashboards

1. **Create snapshots** for incident reports
2. **Use direct links** for quick access
3. **Set default time range** for consistency
4. **Enable auto-refresh** for monitoring screens

---

## Troubleshooting Dashboard Issues

### No Data in Panels

1. Check Prometheus data source connection
2. Verify query syntax in Prometheus directly
3. Check time range selection
4. Verify metrics exist: `curl http://localhost:9090/api/v1/label/__name__/values`

### Slow Dashboard Loading

1. Reduce time range
2. Simplify complex queries
3. Use recording rules
4. Decrease refresh rate

### Incorrect Data

1. Verify PromQL query
2. Check aggregation functions
3. Review time range and step
4. Validate metric labels

---

## Additional Resources

- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)
- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
- [Dashboard Examples](https://grafana.com/grafana/dashboards/)

---

**Document Version**: 1.0
**Last Updated**: October 30, 2025
**Maintained By**: DevOps Team
