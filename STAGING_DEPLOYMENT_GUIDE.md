# Staging Deployment Guide - HMS v2.2.0

**Date**: November 3, 2025
**Environment**: Staging
**Status**: Ready for deployment

---

## Quick Start

### Option 1: Docker Compose (Recommended for Development)

```bash
# Build and start all services
docker-compose -f docker-compose-staging.yml up -d

# View logs
docker-compose -f docker-compose-staging.yml logs -f hms-app

# Stop services
docker-compose -f docker-compose-staging.yml down
```

### Option 2: Manual Kubernetes Deployment

```bash
kubectl apply -f k8s/namespace.yml
kubectl apply -f k8s/configmap.yml
kubectl apply -f k8s/secret.yml
kubectl apply -f k8s/deployment.yml
kubectl apply -f k8s/service.yml
```

---

## Services Overview

### Application Services

1. **HMS App** (hms-app)
   - Port: 3001 (HTTP)
   - Port: 50051 (gRPC)
   - Metrics: GET http://localhost:3001/metrics
   - Health: GET http://localhost:3001/health

2. **PostgreSQL** (postgres)
   - Port: 5432
   - Database: hermes_db
   - User: postgres
   - Password: postgres (change in production!)

3. **Redis** (redis)
   - Port: 6379
   - Cache layer for sessions and data

### Monitoring Stack

4. **Prometheus** (prometheus)
   - Port: 9090
   - Scrapes metrics from HMS App every 10 seconds
   - Retention: 30 days
   - URL: http://localhost:9090

5. **Grafana** (grafana)
   - Port: 3000
   - Admin user: admin
   - Admin password: admin (change in production!)
   - Pre-configured Prometheus datasource
   - URL: http://localhost:3000

6. **Loki** (loki)
   - Port: 3100
   - Log aggregation and searching
   - Integrated with Grafana

---

## Accessing Services

### Application
```bash
curl http://localhost:3001/health
```

### Prometheus
- UI: http://localhost:9090
- Query: http://localhost:9090/api/v1/query?query=up

### Grafana
- UI: http://localhost:3000
- Default credentials: admin/admin
- Add Prometheus datasource (auto-configured)

### gRPC (from another service)
```bash
grpcurl -plaintext localhost:50051 list
```

---

## Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| NODE_ENV | staging | Staging environment |
| PORT | 3001 | HTTP server port |
| DB_HOST | postgres | Database hostname |
| DB_PORT | 5432 | Database port |
| DB_NAME | hermes_db | Database name |
| DB_USER | postgres | Database user |
| DB_PASSWORD | postgres | **Change in production!** |
| REDIS_URL | redis://redis:6379 | Redis connection |
| JWT_SECRET | staging-key-change | **Change in production!** |
| LOG_LEVEL | info | Logging level |
| CORS_ORIGIN | http://localhost:3000 | CORS allowed origin |

---

## Health Checks

### Application Health
```bash
curl -i http://localhost:3001/health
```

### Database Health
```bash
docker-compose -f docker-compose-staging.yml exec postgres pg_isready -U postgres
```

### Redis Health
```bash
docker-compose -f docker-compose-staging.yml exec redis redis-cli ping
```

### Prometheus Health
```bash
curl -i http://localhost:9090/-/healthy
```

### Grafana Health
```bash
curl -i http://localhost:3000/api/health
```

---

## Metrics Available

### HTTP Metrics
- `http_request_duration_seconds` - Request latency
- `http_requests_total` - Total requests
- `http_request_size_bytes` - Request size
- `http_response_size_bytes` - Response size

### Application Metrics
- `active_connections` - Active connection count
- `errors_total` - Total errors
- `warnings_total` - Total warnings

### Database Metrics
- `db_query_duration_seconds` - Query latency
- `db_queries_total` - Total queries
- `db_connection_pool_size` - Connection pool size

### Default Node.js Metrics
- `process_resident_memory_bytes` - Memory usage
- `process_cpu_seconds_total` - CPU time
- `nodejs_eventloop_delay_seconds` - Event loop delay

---

## Testing

### Health Check
```bash
curl http://localhost:3001/health
```

### Metrics Endpoint
```bash
curl http://localhost:3001/metrics
```

### gRPC Service
```bash
grpcurl -plaintext localhost:50051 hms.analytics.AnalyticsService/GetPerformanceMetrics
```

### API Endpoint
```bash
curl -H "Authorization: Bearer <jwt-token>" http://localhost:3001/api/v1/analytics/performance
```

---

## Logging

### View Application Logs
```bash
docker-compose -f docker-compose-staging.yml logs -f hms-app
```

### Log Files (Inside Container)
- `/app/backend/logs/app.log` - All logs
- `/app/backend/logs/error.log` - Errors only
- `/app/backend/logs/exceptions.log` - Uncaught exceptions
- `/app/backend/logs/rejections.log` - Unhandled rejections

---

## Troubleshooting

### Service Won't Start
1. Check logs: `docker-compose -f docker-compose-staging.yml logs`
2. Verify ports available: `lsof -i :3001`
3. Check database connection: `docker-compose -f docker-compose-staging.yml exec postgres psql -U postgres -d hermes_db -c "SELECT 1"`

### High Memory Usage
1. Check Prometheus retention: `docker-compose -f docker-compose-staging.yml logs prometheus`
2. Reduce scrape interval in `prometheus.yml`
3. Clear Grafana dashboard cache

### Metrics Not Showing
1. Verify Prometheus scraping: http://localhost:9090/targets
2. Check Grafana datasource: http://localhost:3000/datasources
3. Verify app /metrics endpoint: `curl http://localhost:3001/metrics`

### Database Connection Issues
1. Check PostgreSQL is running: `docker-compose -f docker-compose-staging.yml ps`
2. Verify credentials in .env
3. Check logs: `docker-compose -f docker-compose-staging.yml logs postgres`

---

## Production Deployment Checklist

Before deploying to production:

- [ ] Change all default passwords (postgres, grafana admin)
- [ ] Update JWT_SECRET to a secure random value
- [ ] Configure proper SSL/TLS certificates
- [ ] Set NODE_ENV=production
- [ ] Configure appropriate CORS_ORIGIN
- [ ] Set up persistent volumes for data
- [ ] Configure backup procedures
- [ ] Set up alerting rules in Prometheus
- [ ] Configure log retention policies
- [ ] Enable authentication for Prometheus/Grafana
- [ ] Set up automated backups
- [ ] Test failover procedures

---

## Monitoring Setup

### Grafana Dashboards
Pre-configured dashboards:
1. **Overview** - System overview and health status
2. **Performance** - Request latency and throughput
3. **Errors** - Error rates and types
4. **Resources** - Memory and CPU usage
5. **Database** - Database performance metrics

### Alert Rules
Configure in Prometheus:
- HTTP 5xx errors > 1% → Critical alert
- Request latency P95 > 500ms → Warning alert
- Database connection pool 90% full → Warning alert
- Memory usage > 80% → Warning alert

---

## Support

For issues or questions:
1. Check logs: `docker-compose -f docker-compose-staging.yml logs`
2. Verify services running: `docker-compose -f docker-compose-staging.yml ps`
3. Check health endpoints
4. Review metrics in Prometheus

---

**Status**: ✅ Ready for staging deployment
**Last Updated**: November 3, 2025
