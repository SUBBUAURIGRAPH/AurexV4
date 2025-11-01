# HMS Phase 2: Production Deployment Guide

**Status**: Ready for Production
**Version**: 2.0
**Date**: October 30, 2025
**Environment**: Production (hms.aurex.in)

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Deployment](#pre-deployment)
3. [Deployment Process](#deployment-process)
4. [Verification](#verification)
5. [Monitoring](#monitoring)
6. [Rollback](#rollback)
7. [Support](#support)

---

## Overview

### What is Being Deployed

**Phase 2.2: Order Execution System**
- Real-time order submission with confirmation workflow
- Business rule validation (position limits, PDT rules, etc.)
- Order status tracking and audit trails
- WebSocket integration for live updates
- Position tracking with P&L analytics

**Phase 2.3: Mobile Architecture** (Backend Preparation)
- API endpoints for mobile app consumption
- Enhanced error handling and response formats
- Mobile-specific rate limiting
- Push notification infrastructure

### Deployment Timeline

- **Estimated Duration**: 30-45 minutes
- **Downtime**: 5-10 minutes (during service restart)
- **Rollback Time**: 5 minutes
- **Post-deployment Validation**: 15 minutes

### Scope

| Component | LOC | Tests | Status |
|-----------|-----|-------|--------|
| Order Manager (v2.0) | 700+ | 50+ | ✅ Ready |
| WebSocket Manager | 600+ | Auto-tested | ✅ Ready |
| Position Tracker | 600+ | Auto-tested | ✅ Ready |
| P&L Calculator | 700+ | Auto-tested | ✅ Ready |
| Order Endpoints | 460+ | 6 handlers | ✅ Ready |
| Chart Endpoints | 400+ | 6 handlers | ✅ Ready |

---

## Pre-Deployment

### Prerequisites Checklist

- [ ] SSH access to hms.aurex.in (subbu account)
- [ ] Database backup scheduled
- [ ] Rollback plan in place
- [ ] Monitoring dashboards open
- [ ] Notification channels ready
- [ ] All tests passing (94%+ coverage)
- [ ] Security audit complete
- [ ] Load testing completed

### Environment Validation

```bash
# SSH to production
ssh subbu@hms.aurex.in

# Check current services
cd /opt/HMS
docker-compose -f docker-compose.production.yml ps

# Verify connectivity
curl https://apihms.aurex.in/health

# Check disk space (ensure >5GB free)
df -h /opt

# Check logs for errors
docker-compose -f docker-compose.production.yml logs --tail=100
```

### Database Backup

```bash
# Create backup before deployment
docker-compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U postgres hms_trading > hms-backup-$(date +%Y%m%d).sql

# Verify backup
ls -lh hms-backup-*.sql

# Optional: compress backup
gzip hms-backup-*.sql
```

### Rollback Preparation

```bash
# Tag current image as rollback point
docker tag aurigraph/hms-j4c-agent:latest aurigraph/hms-j4c-agent:stable
docker tag aurigraph/hms-j4c-agent:latest aurigraph/hms-j4c-agent:pre-phase2
```

---

## Deployment Process

### Option 1: Automated Deployment (Recommended)

```bash
# On local machine or deployment server
# Copy the deployment script
scp deploy-phase2-production.sh subbu@hms.aurex.in:/opt/HMS/

# SSH and run deployment
ssh subbu@hms.aurex.in
cd /opt/HMS
chmod +x deploy-phase2-production.sh
./deploy-phase2-production.sh deploy

# Watch logs
docker-compose -f docker-compose.production.yml logs -f
```

### Option 2: Manual Deployment

#### Step 1: Pull Latest Changes

```bash
cd /opt/HMS
git fetch origin
git checkout main
git pull origin main

# Verify we're on the right commit
git log -1 --oneline
```

#### Step 2: Build Docker Image

```bash
# Build new image with Phase 2 features
docker build -f Dockerfile \
  -t aurigraph/hms-j4c-agent:phase2 \
  -t aurigraph/hms-j4c-agent:latest .

# Verify image was built
docker images | grep hms
```

#### Step 3: Stop Existing Services

```bash
# Create backup of running state
docker-compose -f docker-compose.production.yml ps > docker-state-before.txt

# Stop services (ordered to prevent orphaned processes)
docker-compose -f docker-compose.production.yml down

# Wait for graceful shutdown
sleep 5

# Verify everything stopped
docker ps | grep hms
```

#### Step 4: Start New Services

```bash
# Start services with new image
docker-compose -f docker-compose.production.yml up -d

# Monitor startup
docker-compose -f docker-compose.production.yml logs -f

# Wait for agent to be ready (up to 30 seconds)
for i in {1..30}; do
  curl -s http://localhost:9003/health && break || sleep 1
done
```

#### Step 5: Verify All Services

```bash
# Check all services are running
docker-compose -f docker-compose.production.yml ps

# Verify the command outputs 'running' for all services
```

---

## Verification

### Health Checks

```bash
# Frontend health
curl -k https://hms.aurex.in/health

# Backend health
curl -k https://apihms.aurex.in/health

# Check all containers are running
docker ps

# Check no errors in logs
docker-compose logs --since 5m | grep -i error
```

### API Endpoint Verification

#### Chart Endpoints (Phase 2.1)

```bash
# Test chart data endpoint
curl -k -H "Authorization: Bearer YOUR_TOKEN" \
  https://apihms.aurex.in/api/charts/history/AAPL

# Test indicators endpoint
curl -k -H "Authorization: Bearer YOUR_TOKEN" \
  https://apihms.aurex.in/api/charts/indicators/AAPL

# Test portfolio summary
curl -k -H "Authorization: Bearer YOUR_TOKEN" \
  https://apihms.aurex.in/api/portfolio/summary
```

#### Order Endpoints (Phase 2.2)

```bash
# Test list orders
curl -k -H "Authorization: Bearer YOUR_TOKEN" \
  https://apihms.aurex.in/api/orders

# Test active orders
curl -k -H "Authorization: Bearer YOUR_TOKEN" \
  https://apihms.aurex.in/api/orders/active

# Test order statistics
curl -k -H "Authorization: Bearer YOUR_TOKEN" \
  https://apihms.aurex.in/api/orders/statistics

# Test positions
curl -k -H "Authorization: Bearer YOUR_TOKEN" \
  https://apihms.aurex.in/api/portfolio/positions

# Test P&L
curl -k -H "Authorization: Bearer YOUR_TOKEN" \
  https://apihms.aurex.in/api/portfolio/pnl
```

### Performance Baseline

Record baseline metrics after deployment:

```bash
# Get current metrics from Prometheus
# Access: http://localhost:3000 (SSH tunnel)
# ssh -L 3000:localhost:3000 subbu@hms.aurex.in

# Key metrics to check:
# - http_request_duration_seconds (should be <200ms avg)
# - database_query_duration_seconds (should be <50ms avg)
# - websocket_connection_count (should match active users)
# - order_processing_time_seconds (should be <200ms)
```

### Test Scenarios

#### Scenario 1: Order Submission & Confirmation

```javascript
// 1. Create order (returns pending confirmation)
POST /api/orders/create
{
  symbol: "AAPL",
  side: "buy",
  type: "market",
  quantity: 100
}
// Expected: 200 with orderId and confirmationToken

// 2. Confirm order within 5 minutes
POST /api/orders/confirm
{
  orderId: "order_123",
  token: "confirmation_token_xyz"
}
// Expected: 200 with order status = submitted

// 3. Get order status
GET /api/orders/order_123
// Expected: 200 with updated order status
```

#### Scenario 2: Position Tracking

```javascript
// Get current positions
GET /api/portfolio/positions
// Expected: Array of Position objects with:
// - symbol, quantity, currentPrice, unrealizedPL, etc.

// Get portfolio summary
GET /api/portfolio/summary
// Expected: {
//   totalValue, totalCost, unrealizedPL,
//   cash, buyingPower, lastUpdated
// }
```

#### Scenario 3: Charts & Analytics

```javascript
// Get OHLCV data
GET /api/charts/history/AAPL?interval=1D
// Expected: Array of OHLCV candles

// Get calculated indicators
GET /api/charts/indicators/AAPL
// Expected: Indicators data with SMA, EMA, RSI, MACD

// Get portfolio performance
GET /api/portfolio/performance
// Expected: Performance metrics and chart data
```

---

## Monitoring

### Key Metrics to Watch

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| API Response Time (p95) | <200ms | >500ms | >1000ms |
| Error Rate | <0.1% | >0.5% | >1% |
| Database Query Time | <50ms | >100ms | >200ms |
| WebSocket Connections | n/a | >1000 | >5000 |
| Order Processing Time | <200ms | >500ms | >1000ms |
| CPU Usage | <50% | >70% | >90% |
| Memory Usage | <60% | >80% | >90% |
| Disk Usage | <70% | >85% | >95% |

### Monitoring Dashboard

```bash
# Access Grafana
ssh -L 3000:localhost:3000 subbu@hms.aurex.in
# Then open: http://localhost:3000

# Import Phase 2 dashboard:
# Dashboard ID: HMS_PHASE2_TRADING (to be created)

# Key dashboards:
# - Orders Dashboard (order metrics, latencies, errors)
# - Position Dashboard (portfolio metrics, allocation)
# - API Performance (endpoint latencies, error rates)
# - Database (query times, connections)
```

### Log Monitoring

```bash
# Real-time logs
docker-compose -f docker-compose.production.yml logs -f

# Filter for errors
docker-compose logs | grep ERROR

# Filter for warnings
docker-compose logs | grep WARN

# Check specific service
docker logs -f hms-j4c-agent

# Archive logs (daily)
docker-compose logs > logs-$(date +%Y%m%d).txt
gzip logs-$(date +%Y%m%d).txt
```

### Alert Configuration

Configure alerts in Prometheus/Grafana:

1. **High API Error Rate** (>1% for 5 minutes) → Page
2. **Database Connection Pool Exhausted** → Page
3. **WebSocket Disconnection Rate** (>10% for 2 minutes) → Alert
4. **Order Processing Latency** (p95 >500ms for 10 minutes) → Alert
5. **Disk Space Critical** (<1GB remaining) → Page

---

## Rollback

### When to Rollback

Rollback immediately if:
- Critical API endpoints returning 500 errors
- Database connection failures
- WebSocket subsystem completely down
- Order submission consistently failing
- P&L calculations returning incorrect values
- Performance degradation >50% from baseline

### Rollback Procedure

```bash
# Option 1: Automated rollback
./deploy-phase2-production.sh rollback

# Option 2: Manual rollback
cd /opt/HMS
docker-compose -f docker-compose.production.yml down

# Restore previous image
docker tag aurigraph/hms-j4c-agent:pre-phase2 aurigraph/hms-j4c-agent:latest

# Start previous version
docker-compose -f docker-compose.production.yml up -d

# Verify
docker-compose logs -f
curl -k https://apihms.aurex.in/health
```

### Post-Rollback

1. Notify stakeholders of rollback
2. Investigate root cause in logs
3. Fix issues in staging environment
4. Re-run all tests
5. Schedule redeploy for next window

---

## Success Criteria

Deployment is successful when:

- [ ] All containers are running (docker ps shows 5 running services)
- [ ] Frontend health check passes (https://hms.aurex.in/health)
- [ ] Backend health check passes (https://apihms.aurex.in/health)
- [ ] All chart endpoints responding with valid data
- [ ] All order endpoints responding correctly
- [ ] WebSocket connections establish successfully
- [ ] Order submission & confirmation workflow works end-to-end
- [ ] Position data updates in real-time
- [ ] P&L calculations are accurate
- [ ] Response times are within baseline ±10%
- [ ] Error rate remains <0.1%
- [ ] No critical errors in logs (first 5 minutes)
- [ ] Database queries performing normally
- [ ] All tests passing (94%+ coverage maintained)

---

## Deployment Checklist

### Pre-Deployment
- [ ] All Phase 2.2 features tested in staging
- [ ] Database backups created
- [ ] Rollback image prepared
- [ ] Team notified of deployment window
- [ ] Monitoring dashboards open
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Capacity planning reviewed

### During Deployment
- [ ] Git repository updated to main
- [ ] Docker image built successfully
- [ ] Services stopped gracefully
- [ ] New services started
- [ ] All containers running
- [ ] Health checks passing
- [ ] API endpoints verified
- [ ] WebSocket connections working

### Post-Deployment
- [ ] Monitor logs for 30 minutes
- [ ] Performance metrics within baseline
- [ ] All test scenarios passed
- [ ] Team notified of successful deployment
- [ ] Monitoring dashboards configured
- [ ] Alert rules enabled
- [ ] Documentation updated
- [ ] Deployment report generated

---

## Support & Escalation

### Issues During Deployment

**Issue**: Service fails to start
- Check Docker logs: `docker logs hms-j4c-agent`
- Check disk space: `df -h /opt`
- Verify database is running: `docker ps | grep postgres`
- Action: Investigate logs, potentially rollback

**Issue**: High API error rate after deployment
- Check application logs for exceptions
- Verify database connectivity
- Run database integrity check
- Action: Identify root cause, rollback if necessary

**Issue**: WebSocket connections not working
- Verify websocket service in Docker: `docker ps | grep websocket`
- Check WebSocket logs
- Verify firewall rules allow WebSocket connections
- Action: Review networking configuration

**Issue**: Order submission failing
- Check order-manager service logs
- Verify database connection pool
- Check business rule validation logic
- Action: Review logs, check database state

### Escalation Path

1. **First Contact**: Check logs, review monitoring dashboards
2. **Team Lead**: Review deployment script logs, consider rollback
3. **Architect**: System design review, potential architectural changes
4. **Management**: Plan redeploy window, stakeholder communication

### Support Contacts

- **On-call Engineer**: [To be defined]
- **Platform Team**: agents@aurigraph.io
- **Emergency**: [Escalation number]

---

## References

- [Phase 2 Completion Report](PHASE_2_COMPLETION_REPORT.md)
- [Phase 2 Specification](PHASE_2_SPECIFICATION.md)
- [Security Audit Report](SECURITY_AUDIT_REPORT.md)
- [Production Deployment Guide](AUREX_PRODUCTION_DEPLOYMENT.md)

---

**Document Version**: 2.0
**Last Updated**: October 30, 2025
**Next Review**: After Phase 2 deployment
**Classification**: Internal - Deployment Team
