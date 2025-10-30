# HMS Monitoring Infrastructure

**Hermes Trading Platform - Phase 4: Performance & Monitoring**

## Quick Start

```bash
# 1. Setup environment
cp .env.example .env
# Edit .env with your credentials

# 2. Start monitoring stack
docker-compose up -d

# 3. Access services
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (admin/admin)
# Alertmanager: http://localhost:9093

# 4. Import Grafana dashboards
# Login to Grafana → Dashboards → Import
# Upload JSON files from dashboards/ directory
```

## Documentation

- **[MONITORING_SETUP.md](MONITORING_SETUP.md)** - Complete setup guide
- **[GRAFANA_DASHBOARD_GUIDE.md](GRAFANA_DASHBOARD_GUIDE.md)** - Dashboard usage guide
- **[ALERTING_RUNBOOKS.md](ALERTING_RUNBOOKS.md)** - Alert response procedures
- **[TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md)** - Common issues & solutions

## Structure

```
prometheus/
├── prometheus.yml              # Prometheus configuration
├── alert-rules.yml            # Alert definitions (40+ rules)
├── recording-rules.yml        # Recording rules (65 rules)
├── alertmanager.yml           # Alertmanager configuration
├── docker-compose.yml         # Complete monitoring stack
├── blackbox.yml               # Blackbox exporter config
├── .env.example               # Environment variables template
├── dashboards/                # Grafana dashboards (7 dashboards)
│   ├── hms-overview.json
│   ├── api-performance.json
│   ├── database-performance.json
│   ├── system-health.json
│   ├── websocket-metrics.json
│   ├── trading-metrics.json
│   └── alerts-overview.json
├── templates/                 # Notification templates
│   ├── slack.tmpl
│   └── email.tmpl
└── docs/                      # Documentation
    ├── MONITORING_SETUP.md
    ├── GRAFANA_DASHBOARD_GUIDE.md
    ├── ALERTING_RUNBOOKS.md
    └── TROUBLESHOOTING_GUIDE.md
```

## Features

✅ **11 Monitored Services**
- HMS API (J4C Agent)
- PostgreSQL Database
- NGINX Proxy
- WebSocket Server
- Node Exporter (System)
- Grafana
- Prometheus
- Redis
- Docker Containers
- Blackbox (HTTP)
- Alpaca Trading API

✅ **7 Grafana Dashboards**
- HMS Overview - System health summary
- API Performance - Request metrics
- Database Performance - Query analysis
- System Health - Resource monitoring
- WebSocket Metrics - Real-time connections
- Trading Metrics - Order flow
- Alerts Overview - Alert management

✅ **40+ Alert Rules**
- 8 Critical (P1)
- 7 Warning (P2)
- 5 Info (P3)
- SSL monitoring
- Business metrics

✅ **65 Recording Rules**
- HTTP metrics
- API latency
- Order metrics
- WebSocket metrics
- Database metrics
- System metrics
- SLO tracking
- Business metrics

✅ **Multi-Channel Alerting**
- Slack integration
- Email notifications
- PagerDuty escalation
- Custom templates

✅ **SLO Tracking**
- 99.9% availability target
- p95 latency <200ms
- Order success rate >95%
- Error budget monitoring

## Metrics Collected

- **HTTP**: Request rate, latency, errors, status codes
- **Database**: Connections, query time, cache hit ratio
- **System**: CPU, memory, disk, network
- **WebSocket**: Connections, messages, latency
- **Trading**: Orders, confirmations, portfolio value
- **Alpaca API**: Response time, rate limits, errors

## Alert Severity

| Severity | Priority | Response Time | Channels |
|----------|----------|---------------|----------|
| Critical | P1 | <15 minutes | PagerDuty + Slack + Email |
| Warning | P2 | <1 hour | Slack + Email |
| Info | P3 | <4 hours | Slack |

## Support

- **Slack**: #devops-support
- **Email**: devops@aurex.in
- **On-Call**: PagerDuty rotation
- **Docs**: [MONITORING_SETUP.md](MONITORING_SETUP.md)

---

**Version**: 1.0
**Last Updated**: October 30, 2025
**Maintained By**: DevOps Team
