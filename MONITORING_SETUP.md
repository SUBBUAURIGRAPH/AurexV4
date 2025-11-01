# Post-Deployment Monitoring Setup
## Aurigraph v2.1.0 - Complete Monitoring Configuration
**Version**: 1.0.0
**Status**: Ready for Implementation
**Last Updated**: December 13, 2025

---

## MONITORING OVERVIEW

### Monitoring Stack
- **Metrics**: Prometheus (15s scrape interval, 30d retention)
- **Visualization**: Grafana (dashboards, alerts)
- **Logs**: ELK Stack or Datadog
- **Alerting**: AlertManager + PagerDuty/Slack
- **APM** (Optional): Datadog or New Relic

### Key Metrics Categories
1. **System Metrics**: CPU, memory, disk, network
2. **Application Metrics**: Requests, latency, errors, throughput
3. **Exchange Connector**: Connection pool, rate limit, health by exchange
4. **Strategy Builder**: Active strategies, signals, optimization, backtest
5. **Database**: Connections, queries, replication lag
6. **Redis**: Memory, hit ratio, operations, replication

---

## PROMETHEUS CONFIGURATION

### Step 1: Install Prometheus

```bash
# Download and extract Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.40.0/prometheus-2.40.0.linux-amd64.tar.gz
tar xvfz prometheus-2.40.0.linux-amd64.tar.gz
cd prometheus-2.40.0.linux-amd64

# Create data directory
mkdir -p /var/lib/prometheus /etc/prometheus

# Copy binaries
sudo cp prometheus /usr/local/bin/
sudo cp promtool /usr/local/bin/

# Create Prometheus user
sudo useradd --no-create-home --shell /bin/false prometheus

# Create systemd service
sudo tee /etc/systemd/system/prometheus.service > /dev/null <<EOF
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
User=prometheus
Group=prometheus
Type=simple
ExecStart=/usr/local/bin/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/var/lib/prometheus/ \
  --web.console.templates=/etc/prometheus/consoles \
  --web.console.libraries=/etc/prometheus/console_libraries

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl start prometheus
sudo systemctl enable prometheus
```

### Step 2: Configure Prometheus (`/etc/prometheus/prometheus.yml`)

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'aurigraph-production'
    environment: 'production'

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - 'localhost:9093'

# Load rules once and periodically evaluate them
rule_files:
  - '/etc/prometheus/rules.yml'

scrape_configs:
  # Aurigraph application metrics
  - job_name: 'aurigraph'
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: '/metrics'
    static_configs:
      - targets: ['localhost:8080']
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        regex: '(.*):8080'
        replacement: '${1}'

  # PostgreSQL metrics (requires postgres_exporter)
  - job_name: 'postgres'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:9187']
    relabel_configs:
      - source_labels: [__address__]
        target_label: db_instance
        regex: '(.*):9187'
        replacement: 'production-db'

  # Redis metrics (requires redis_exporter)
  - job_name: 'redis'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:9121']
    relabel_configs:
      - source_labels: [__address__]
        target_label: redis_instance
        regex: '(.*):9121'
        replacement: 'production-redis'

  # Node exporter for system metrics
  - job_name: 'node'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:9100']

  # Docker containers
  - job_name: 'cadvisor'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:8081']
```

### Step 3: Create Alert Rules (`/etc/prometheus/rules.yml`)

```yaml
groups:
  - name: aurigraph_alerts
    interval: 30s
    rules:
      # CRITICAL ALERTS
      - alert: ApplicationDown
        expr: up{job="aurigraph"} == 0
        for: 2m
        labels:
          severity: critical
          service: aurigraph
        annotations:
          summary: "Aurigraph application is down"
          description: "Application {{ $labels.instance }} has been unreachable for more than 2 minutes."
          runbook: "https://docs.example.com/runbooks/app-down"
          action: "1. Check application logs: docker logs aurigraph"
                  "2. Check system resources: docker stats"
                  "3. If persistent, trigger rollback procedure"

      - alert: HighErrorRate
        expr: rate(http_requests_errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
          service: aurigraph
        annotations:
          summary: "High error rate (> 5%)"
          description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"
          action: "Check application logs for error messages"

      - alert: CriticalDatabaseIssue
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
          service: database
        annotations:
          summary: "PostgreSQL database is down"
          description: "Database is unreachable"
          action: "1. Verify database service: systemctl status postgresql"
                  "2. Check database logs: /var/log/postgresql/"
                  "3. If not recoverable, failover to replica"

      - alert: RedisDown
        expr: up{job="redis"} == 0
        for: 1m
        labels:
          severity: critical
          service: cache
        annotations:
          summary: "Redis cache is down"
          description: "Redis is unreachable"
          action: "1. Verify Redis service: systemctl status redis"
                  "2. Try restart: systemctl restart redis"
                  "3. Check Redis persistence and recovery"

      # HIGH SEVERITY ALERTS
      - alert: HighCPUUsage
        expr: node_cpu_usage_percent > 80
        for: 5m
        labels:
          severity: high
          service: infrastructure
        annotations:
          summary: "High CPU usage (> 80%)"
          description: "CPU usage is {{ $value | humanize }}%"
          action: "Analyze top processes: top -b -n 1"

      - alert: HighMemoryUsage
        expr: node_memory_usage_percent > 85
        for: 5m
        labels:
          severity: high
          service: infrastructure
        annotations:
          summary: "High memory usage (> 85%)"
          description: "Memory usage is {{ $value | humanize }}%"
          action: "Check memory consumption: free -h"

      - alert: LowDiskSpace
        expr: node_disk_avail_percent < 15
        for: 5m
        labels:
          severity: high
          service: infrastructure
        annotations:
          summary: "Low disk space (< 15%)"
          description: "Available disk space is {{ $value | humanize }}%"
          action: "Check disk usage: df -h /"

      - alert: DatabaseReplicationLag
        expr: pg_replication_lag_seconds > 30
        for: 5m
        labels:
          severity: high
          service: database
        annotations:
          summary: "Database replication lag > 30 seconds"
          description: "Replication lag is {{ $value | humanize }}s"
          action: "Check replication status: SELECT pg_last_wal_receive_lsn();"

      - alert: DatabaseConnectionPoolExhausted
        expr: pg_stat_activity_count > 45
        for: 2m
        labels:
          severity: high
          service: database
        annotations:
          summary: "Database connection pool near exhaustion"
          description: "{{ $value }} active connections (limit: 50)"
          action: "Kill idle connections or increase pool size"

      - alert: ExchangeConnectorErrors
        expr: rate(exchange_connector_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: high
          service: exchange-connector
        annotations:
          summary: "Exchange connector error rate > 10%"
          description: "{{ $labels.exchange }} has {{ $value | humanizePercentage }} error rate"
          action: "Check exchange API status and network connectivity"

      - alert: StrategyOptimizationStuck
        expr: increase(strategy_optimization_duration_seconds[5m]) == 0 AND
              strategy_optimization_active > 0
        for: 5m
        labels:
          severity: high
          service: strategy-builder
        annotations:
          summary: "Strategy optimization appears stuck"
          description: "Optimization running but no progress"
          action: "Check strategy optimization logs"

      # MEDIUM SEVERITY ALERTS
      - alert: SlowAPIResponse
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 1
        for: 10m
        labels:
          severity: medium
          service: aurigraph
        annotations:
          summary: "API response time high (p95 > 1s)"
          description: "P95 latency: {{ $value | humanize }}s"
          action: "Check database query performance"

      - alert: HighGCPauseDuration
        expr: nodejs_gc_duration_seconds_sum > 1
        for: 5m
        labels:
          severity: medium
          service: aurigraph
        annotations:
          summary: "Long garbage collection pause"
          description: "Total GC time: {{ $value | humanize }}s"
          action: "Consider memory optimization or heap size adjustment"

      - alert: RedisPersistenceIssue
        expr: redis_rdb_last_save_timestamp_seconds == 0
        for: 10m
        labels:
          severity: medium
          service: cache
        annotations:
          summary: "Redis persistence not working"
          description: "No successful save detected"
          action: "Check Redis persistence: CONFIG GET save"

      # LOW SEVERITY ALERTS
      - alert: BackupMissing
        expr: backup_last_successful_timestamp == 0
        for: 1h
        labels:
          severity: low
          service: backup
        annotations:
          summary: "No successful backup in last hour"
          description: "Last successful backup unknown"
          action: "Manually trigger backup or investigate scheduler"

      - alert: CertificateExpiringSoon
        expr: certificate_expiry_seconds < 604800
        labels:
          severity: low
          service: security
        annotations:
          summary: "SSL certificate expiring in less than 7 days"
          description: "Certificate expires in {{ $value | humanizeDuration }}"
          action: "Renew SSL certificate immediately"

      - alert: DependencyVulnerability
        expr: dependency_vulnerabilities_total > 0
        for: 1h
        labels:
          severity: low
          service: security
        annotations:
          summary: "Vulnerable dependencies detected"
          description: "{{ $value }} vulnerabilities found"
          action: "Review and update dependencies"
```

### Step 4: Test Prometheus

```bash
# Verify configuration
promtool check config /etc/prometheus/prometheus.yml

# Check rules
promtool check rules /etc/prometheus/rules.yml

# Verify Prometheus is running
curl http://localhost:9090/-/healthy

# Check targets
curl http://localhost:9090/api/v1/targets

# Verify metrics collection
curl http://localhost:9090/api/v1/query?query=up
```

---

## GRAFANA SETUP

### Step 1: Install Grafana

```bash
# Download Grafana
wget https://dl.grafana.com/oss/release/grafana-9.2.0.linux-amd64.tar.gz
tar -zxvf grafana-9.2.0.linux-amd64.tar.gz

# Create systemd service
sudo tee /etc/systemd/system/grafana-server.service > /dev/null <<EOF
[Unit]
Description=Grafana
Wants=network-online.target
After=network-online.target

[Service]
Type=notify
ExecStart=/path/to/grafana-server
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl start grafana-server
sudo systemctl enable grafana-server

# Verify running
curl http://localhost:3000
```

### Step 2: Configure Data Source

```bash
# Access Grafana at http://localhost:3000
# Default: admin / admin

# Add Prometheus data source via API
curl -X POST http://admin:admin@localhost:3000/api/datasources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Prometheus",
    "type": "prometheus",
    "url": "http://localhost:9090",
    "access": "proxy",
    "isDefault": true
  }'
```

### Step 3: Import Dashboards

Create dashboard JSON files:

**Dashboard 1: System Health**
```json
{
  "dashboard": {
    "title": "System Health",
    "panels": [
      {
        "title": "CPU Usage",
        "targets": [{"expr": "node_cpu_usage_percent"}],
        "thresholds": [{"value": 80, "color": "red"}]
      },
      {
        "title": "Memory Usage",
        "targets": [{"expr": "node_memory_usage_percent"}],
        "thresholds": [{"value": 85, "color": "red"}]
      },
      {
        "title": "Disk Space Available",
        "targets": [{"expr": "node_disk_avail_percent"}],
        "thresholds": [{"value": 15, "color": "red"}]
      },
      {
        "title": "Network I/O",
        "targets": [
          {"expr": "rate(node_network_transmit_bytes_total[5m])"},
          {"expr": "rate(node_network_receive_bytes_total[5m])"}
        ]
      }
    ]
  }
}
```

**Dashboard 2: Application Metrics**
```json
{
  "dashboard": {
    "title": "Application Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{"expr": "rate(http_requests_total[5m])"}]
      },
      {
        "title": "Error Rate",
        "targets": [{"expr": "rate(http_requests_errors_total[5m])"}]
      },
      {
        "title": "Latency (p50/p95/p99)",
        "targets": [
          {"expr": "histogram_quantile(0.50, http_request_duration_seconds_bucket)"},
          {"expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)"},
          {"expr": "histogram_quantile(0.99, http_request_duration_seconds_bucket)"}
        ]
      },
      {
        "title": "Throughput",
        "targets": [{"expr": "rate(http_requests_total[1m])"}]
      }
    ]
  }
}
```

**Dashboard 3: Exchange Connector**
```json
{
  "dashboard": {
    "title": "Exchange Connector",
    "panels": [
      {
        "title": "Connection Pool Usage by Exchange",
        "targets": [
          {"expr": "exchange_connector_connection_pool_used / exchange_connector_connection_pool_size"}
        ]
      },
      {
        "title": "Rate Limiter Status by Exchange",
        "targets": [
          {"expr": "exchange_connector_rate_limiter_tokens / exchange_connector_rate_limiter_capacity"}
        ]
      },
      {
        "title": "API Errors by Exchange",
        "targets": [{"expr": "rate(exchange_connector_errors_total[5m])"}]
      },
      {
        "title": "Health Check Latency",
        "targets": [{"expr": "exchange_connector_health_check_duration_seconds"}]
      }
    ]
  }
}
```

**Dashboard 4: Strategy Builder**
```json
{
  "dashboard": {
    "title": "Strategy Builder",
    "panels": [
      {
        "title": "Active Strategies",
        "targets": [{"expr": "strategy_builder_active_strategies_count"}]
      },
      {
        "title": "Signal Generation Rate",
        "targets": [{"expr": "rate(strategy_builder_signals_generated_total[5m])"}]
      },
      {
        "title": "Optimization Job Status",
        "targets": [{"expr": "strategy_builder_optimization_active"}]
      },
      {
        "title": "Backtest Progress",
        "targets": [{"expr": "strategy_builder_backtest_progress_percentage"}]
      }
    ]
  }
}
```

---

## ALERTMANAGER CONFIGURATION

### Install and Configure AlertManager

```bash
# Download AlertManager
wget https://github.com/prometheus/alertmanager/releases/download/v0.24.0/alertmanager-0.24.0.linux-amd64.tar.gz
tar xvfz alertmanager-0.24.0.linux-amd64.tar.gz
cd alertmanager-0.24.0.linux-amd64

# Create config: /etc/alertmanager/alertmanager.yml
cat > /etc/alertmanager/alertmanager.yml <<'EOF'
global:
  resolve_timeout: 5m
  slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
  pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

route:
  receiver: 'default'
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 4h

  routes:
    # Critical alerts -> PagerDuty
    - match:
        severity: critical
      receiver: pagerduty
      group_wait: 0s
      group_interval: 1m
      repeat_interval: 30m

    # High alerts -> Slack
    - match:
        severity: high
      receiver: slack_high

    # Medium alerts -> Slack
    - match:
        severity: medium
      receiver: slack_medium

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'
        description: '{{ .GroupLabels.alertname }}'
        details:
          severity: '{{ .GroupLabels.severity }}'
          description: '{{ .Alerts.Firing | len }} firing'

  - name: 'slack_high'
    slack_configs:
      - channel: '#aurigraph-critical'
        color: 'danger'

  - name: 'slack_medium'
    slack_configs:
      - channel: '#aurigraph-warnings'
        color: 'warning'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'medium'
    equal: ['alertname', 'dev', 'instance']
EOF

# Start AlertManager
systemctl start alertmanager
systemctl enable alertmanager
```

### Test Alerting

```bash
# Check AlertManager status
curl http://localhost:9093/-/healthy

# Check active alerts
curl http://localhost:9093/api/v1/alerts

# Send test alert to Prometheus
cat > /tmp/test_alert.json <<'EOF'
{
  "labels": {
    "alertname": "TestAlert",
    "severity": "critical"
  },
  "annotations": {
    "summary": "Test alert",
    "description": "This is a test alert"
  },
  "generatorURL": "http://localhost:9090/graph"
}
EOF

# Verify Slack integration by manually sending message
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test message from Aurigraph monitoring"}'
```

---

## HEALTH CHECKS

### Application Health Endpoints

Implement these endpoints in the application:

```typescript
// GET /health - Liveness probe
router.get('/health', (req, res) => {
  const health = {
    status: 'up',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
  res.status(200).json(health);
});

// GET /ready - Readiness probe
router.get('/ready', async (req, res) => {
  try {
    // Check dependencies
    await db.query('SELECT 1');
    await redis.ping();
    const exchangeHealth = await exchangeConnector.getStatus();

    if (exchangeHealth.status === 'healthy') {
      return res.status(200).json({ ready: true });
    } else {
      return res.status(503).json({ ready: false });
    }
  } catch (error) {
    return res.status(503).json({ ready: false, error: error.message });
  }
});

// GET /metrics - Prometheus metrics
router.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(register.metrics());
});
```

### Kubernetes Health Probes (if using K8s)

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: aurigraph
spec:
  containers:
  - name: aurigraph
    image: aurigraph:v2.1.0-prod
    livenessProbe:
      httpGet:
        path: /health
        port: 8080
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3

    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 5
      timeoutSeconds: 2
      failureThreshold: 3

    startupProbe:
      httpGet:
        path: /health
        port: 8080
      initialDelaySeconds: 0
      periodSeconds: 10
      timeoutSeconds: 3
      failureThreshold: 30
```

---

## CUSTOM METRICS

### Exchange Connector Metrics

```typescript
// metrics/exchange.ts

export const exchangeMetrics = {
  // Connection pool metrics
  connectionPoolUsed: new Gauge({
    name: 'exchange_connector_connection_pool_used',
    help: 'Number of active connections in pool',
    labelNames: ['exchange'],
  }),

  connectionPoolSize: new Gauge({
    name: 'exchange_connector_connection_pool_size',
    help: 'Maximum connection pool size',
    labelNames: ['exchange'],
  }),

  // Rate limiter metrics
  rateLimiterTokens: new Gauge({
    name: 'exchange_connector_rate_limiter_tokens',
    help: 'Current tokens in rate limiter',
    labelNames: ['exchange'],
  }),

  rateLimiterCapacity: new Gauge({
    name: 'exchange_connector_rate_limiter_capacity',
    help: 'Rate limiter capacity',
    labelNames: ['exchange'],
  }),

  // API error metrics
  apiErrors: new Counter({
    name: 'exchange_connector_errors_total',
    help: 'Total API errors',
    labelNames: ['exchange', 'error_type'],
  }),

  // Health check latency
  healthCheckDuration: new Histogram({
    name: 'exchange_connector_health_check_duration_seconds',
    help: 'Health check duration in seconds',
    labelNames: ['exchange'],
    buckets: [0.1, 0.5, 1, 2, 5],
  }),
};
```

### Strategy Builder Metrics

```typescript
// metrics/strategy.ts

export const strategyMetrics = {
  // Active strategies
  activeStrategies: new Gauge({
    name: 'strategy_builder_active_strategies_count',
    help: 'Number of active strategies',
    labelNames: ['category'],
  }),

  // Signal generation
  signalsGenerated: new Counter({
    name: 'strategy_builder_signals_generated_total',
    help: 'Total signals generated',
    labelNames: ['signal_type', 'category'],
  }),

  // Optimization metrics
  optimizationActive: new Gauge({
    name: 'strategy_builder_optimization_active',
    help: 'Number of active optimization jobs',
    labelNames: ['algorithm'],
  }),

  optimizationDuration: new Histogram({
    name: 'strategy_builder_optimization_duration_seconds',
    help: 'Optimization job duration',
    labelNames: ['algorithm'],
    buckets: [10, 30, 60, 120, 300, 600],
  }),

  // Backtest metrics
  backtestProgress: new Gauge({
    name: 'strategy_builder_backtest_progress_percentage',
    help: 'Backtest progress percentage',
    labelNames: ['strategy_id'],
  }),
};
```

---

## MONITORING DASHBOARD INITIALIZATION

```bash
#!/bin/bash
# Initialize monitoring stack

echo "=== Initializing Monitoring Stack ==="

# Start Prometheus
systemctl start prometheus
systemctl status prometheus
echo "✓ Prometheus started"

# Start AlertManager
systemctl start alertmanager
systemctl status alertmanager
echo "✓ AlertManager started"

# Start Grafana
systemctl start grafana-server
systemctl status grafana-server
echo "✓ Grafana started"

# Wait for services to start
sleep 10

# Verify connectivity
curl -s http://localhost:9090/-/healthy && echo "✓ Prometheus healthy"
curl -s http://localhost:9093/-/healthy && echo "✓ AlertManager healthy"
curl -s http://localhost:3000 > /dev/null && echo "✓ Grafana responding"

# Create Grafana data source
echo "Creating Grafana data source..."
curl -s -X POST http://admin:admin@localhost:3000/api/datasources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Prometheus",
    "type": "prometheus",
    "url": "http://localhost:9090",
    "access": "proxy",
    "isDefault": true
  }' && echo "✓ Data source created"

# Verify alert rules loaded
RULES=$(curl -s http://localhost:9090/api/v1/rules | jq '.data.groups | length')
echo "✓ Alert rules loaded: $RULES groups"

echo "=== Monitoring Stack Initialization Complete ==="
```

---

## VERIFICATION CHECKLIST

- [ ] Prometheus scraping all targets
- [ ] AlertManager receiving alerts
- [ ] Grafana dashboards loaded and showing data
- [ ] Slack integration working (test message sent)
- [ ] PagerDuty integration working (if configured)
- [ ] Email notifications working (if configured)
- [ ] All health checks passing
- [ ] Metrics retention policy correct (30 days minimum)
- [ ] Alert rules syntax valid
- [ ] No duplicate alerts firing
- [ ] Backup procedures for monitoring configuration

---

## MONITORING HANDOFF CHECKLIST

### Pre-Handoff Review
- [ ] All dashboards created and customized
- [ ] Alert thresholds reviewed with team
- [ ] Escalation policies documented
- [ ] Runbooks linked to alerts
- [ ] On-call procedures documented
- [ ] Monitoring training completed

### Operations Team Sign-Off
- [ ] Monitoring setup reviewed and accepted
- [ ] All dashboards accessible
- [ ] Alert routing verified
- [ ] Can interpret metrics
- [ ] Knows runbook locations
- [ ] Has access to all monitoring systems

---

**Document Version**: 1.0.0
**Status**: Ready for Implementation
**Last Updated**: December 13, 2025
