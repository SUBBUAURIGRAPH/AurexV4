# HMS Docker Deployment Summary

**Date**: October 29, 2025
**Status**: ✅ In Progress / Ready
**Deployment Type**: Docker Compose (Local/Docker Host)
**Version**: 1.0.0

---

## Deployment Completed

### Phase 1: Docker Image Build ✅ Complete

**HMS J4C Agent Docker Image**
- **Image Tag**: `aurigraph/hms-j4c-agent:1.0.0` (and `latest`)
- **Size**: 259 MB
- **Base Image**: Node.js 18 Alpine (multi-stage build)
- **Build Date**: October 29, 2025 01:42:01 UTC
- **Build Command**:
  ```bash
  docker build -f Dockerfile.j4c -t aurigraph/hms-j4c-agent:1.0.0 .
  ```

**Docker Configuration**
- ✅ Multi-stage build (builder + runtime)
- ✅ Non-root user (nodejs:1001)
- ✅ Health checks enabled
- ✅ Proper signal handling (tini)
- ✅ Production-ready base image (Alpine)

### Phase 2: Docker Compose Deployment ✅ In Progress

**Deployment Configuration**: `docker-compose.hms.yml`

**Services Being Deployed**:

1. **HMS J4C Agent** (Main Application)
   - Image: aurigraph/hms-j4c-agent:1.0.0
   - Port: 9003
   - Environment: Production
   - Restart Policy: unless-stopped
   - Health Check: Enabled (30s interval)
   - Status: Starting...

2. **NGINX Reverse Proxy**
   - Image: nginx:1.25-alpine
   - Ports: 80, 443
   - Configuration: ./nginx-dlt.conf
   - SSL/TLS: /etc/letsencrypt/live/aurcrt
   - Status: Pulling...

3. **PostgreSQL Database**
   - Image: postgres:15-alpine
   - Port: 5432
   - Database: hms_db
   - User: hms_user
   - Volumes: Persistent data storage
   - Status: Pulling...

4. **Prometheus Metrics**
   - Image: prom/prometheus:latest
   - Port: 9090
   - Configuration: ./prometheus-dlt.yml
   - Retention: 30 days
   - Status: Pulling...

5. **Grafana Dashboards**
   - Image: grafana/grafana:latest
   - Port: 3000
   - Admin: admin (password configurable)
   - Dashboard Provisioning: ./grafana-dashboards
   - Status: Pulling...

### Network Configuration
- **Network**: hms-network (bridge driver)
- **Isolation**: All services connected via internal network
- **Ports Exposed**: 80, 443 (NGINX), 3000 (Grafana), 5432 (PostgreSQL), 9003 (Agent), 9090 (Prometheus)

### Volumes

Persistent Storage:
- `hms-postgres-data`: PostgreSQL data
- `hms-logs`: Application logs
- `hms-prometheus-data`: Prometheus metrics (30-day retention)
- `hms-grafana-data`: Grafana dashboards and config
- `hms-nginx-logs`: NGINX access/error logs
- `hms-nginx-cache`: NGINX caching

### Environment Variables

Required configuration (set in `.env.local`):
```bash
JIRA_API_KEY=your_jira_api_token
GITHUB_TOKEN=your_github_token
HUBSPOT_API_KEY=your_hubspot_key
SLACK_WEBHOOK_URL=your_slack_webhook
DB_USER=hms_user
DB_PASSWORD=hms_secure_password_change_me
GRAFANA_PASSWORD=admin
```

---

## Deployment Commands

### Start Deployment
```bash
docker compose -f docker-compose.hms.yml up -d
```

### Check Status
```bash
docker compose -f docker-compose.hms.yml ps
docker compose -f docker-compose.hms.yml logs -f
```

### Check Specific Service
```bash
docker compose -f docker-compose.hms.yml logs hms-j4c-agent
docker compose -f docker-compose.hms.yml logs nginx-proxy
docker compose -f docker-compose.hms.yml logs postgres
```

### Stop Deployment
```bash
docker compose -f docker-compose.hms.yml down
```

### View Health Status
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
curl http://localhost:9003/health
curl http://localhost:3000  # Grafana
curl http://localhost:9090  # Prometheus
```

---

## Post-Deployment Configuration

### 1. NGINX SSL/TLS Setup
```bash
# Ensure SSL certificates are available
# Update nginx-dlt.conf with your domain
# Verify CSP headers are configured
```

### 2. PostgreSQL Initial Setup
```bash
# Connect to database
docker exec -it hms-postgres psql -U hms_user -d hms_db

# Verify connection
\dt
```

### 3. Grafana Dashboard Setup
1. Access Grafana at `http://localhost:3000`
2. Default login: admin/admin (change password!)
3. Add Prometheus data source: `http://prometheus:9090`
4. Import dashboards from `./grafana-dashboards`

### 4. Prometheus Configuration
1. Access Prometheus at `http://localhost:9090`
2. Check targets status: Status > Targets
3. Verify HMS agent metrics collection

### 5. Agent Verification
```bash
# Check agent logs
docker compose -f docker-compose.hms.yml logs -f hms-j4c-agent

# Test agent health
curl -v http://localhost:9003/health

# Test agent API
curl http://localhost:9003/agents
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Host / Docker Desktop             │
└─────────────────────────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
    ┌─────────────┐   ┌─────────────┐   ┌──────────────┐
    │   NGINX     │   │    HMS      │   │  PostgreSQL  │
    │  (80,443)   │──▶│  J4C Agent  │──▶│   (5432)     │
    │             │   │   (9003)    │   │              │
    └─────────────┘   └─────────────┘   └──────────────┘
          │                  │                  │
          │                  │                  │
    ┌─────────────┐   ┌─────────────┐
    │  Grafana    │   │ Prometheus  │
    │   (3000)    │   │  (9090)     │
    └─────────────┘   └─────────────┘
          │                  │
          └──────────────────┘
           (Metrics Collection)

Network: hms-network (bridge)
```

---

## Performance Characteristics

### Expected Startup Times
- NGINX: 5-10 seconds
- PostgreSQL: 10-15 seconds
- Prometheus: 5-10 seconds
- Grafana: 10-20 seconds
- HMS J4C Agent: 15-30 seconds

**Total Deployment Time**: ~2-3 minutes (first run with image pulls)

### Resource Usage (Estimated)
- Memory: 1.5-2.5 GB
- CPU: 2-4 cores
- Disk: ~50 GB (including logs and data volumes)

### Port Mapping Summary
| Service | Port | Protocol |
|---------|------|----------|
| NGINX HTTP | 80 | HTTP |
| NGINX HTTPS | 443 | TLS/HTTPS |
| HMS Agent | 9003 | HTTP |
| Prometheus | 9090 | HTTP |
| Grafana | 3000 | HTTP |
| PostgreSQL | 5432 | TCP (Internal) |

---

## Monitoring & Logs

### View Real-Time Logs
```bash
# All services
docker compose -f docker-compose.hms.yml logs -f

# Specific service
docker compose -f docker-compose.hms.yml logs -f hms-j4c-agent

# Follow with timestamps
docker compose -f docker-compose.hms.yml logs -f --timestamps
```

### Health Checks
```bash
# Agent health
curl http://localhost:9003/health

# NGINX health
curl http://localhost/health

# Database connectivity
docker exec hms-postgres pg_isready -U hms_user

# Prometheus metrics
curl http://localhost:9090/api/v1/targets
```

---

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker compose -f docker-compose.hms.yml logs hms-j4c-agent

# Check if ports are already in use
netstat -tuln | grep LISTEN

# Restart service
docker compose -f docker-compose.hms.yml restart hms-j4c-agent
```

### Database Connection Issues
```bash
# Check PostgreSQL container
docker compose -f docker-compose.hms.yml ps postgres

# Connect to database
docker compose -f docker-compose.hms.yml exec postgres psql -U hms_user -d hms_db

# Check password
# Verify DB_PASSWORD in .env.local
```

### NGINX SSL Issues
```bash
# Check configuration
docker exec hms-nginx-proxy nginx -t

# View logs
docker compose -f docker-compose.hms.yml logs nginx-proxy

# Ensure certificates exist
ls -la /etc/letsencrypt/live/aurcrt/
```

### Metrics Not Appearing
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check Agent metrics endpoint
curl http://localhost:9003/metrics

# Verify Prometheus config
cat prometheus-dlt.yml
```

---

## Scaling & Production Deployment

### Docker Swarm Deployment
```bash
docker swarm init
docker stack deploy -c docker-compose.hms.yml hms
```

### Kubernetes Deployment
Use K8s manifests from `./k8s/`:
```bash
kubectl apply -f k8s/gnn-hms-namespace.yaml
kubectl apply -f k8s/gnn-components-deployment.yaml
# ... other manifests
```

### Environment-Specific Configurations
1. **Development**: `docker-compose.hms.yml` (current)
2. **Staging**: Create `docker-compose.staging.yml`
3. **Production**: Use K8s manifests or create `docker-compose.prod.yml`

---

## Backup & Recovery

### Database Backup
```bash
# Backup PostgreSQL
docker exec hms-postgres pg_dump -U hms_user hms_db > hms_backup.sql

# Restore PostgreSQL
docker exec -i hms-postgres psql -U hms_user hms_db < hms_backup.sql
```

### Volume Backup
```bash
# Backup Prometheus data
docker run --rm -v hms-prometheus-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/prometheus-backup.tar.gz -C /data .

# Backup Grafana data
docker run --rm -v hms-grafana-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/grafana-backup.tar.gz -C /data .
```

### Full System Backup
```bash
# Export all images
docker save -o hms-docker-images.tar \
  aurigraph/hms-j4c-agent:1.0.0 \
  postgres:15-alpine \
  nginx:1.25-alpine \
  prom/prometheus:latest \
  grafana/grafana:latest
```

---

## Next Steps

### Immediate Actions
- [ ] Verify all 5 services are running: `docker compose -f docker-compose.hms.yml ps`
- [ ] Test health endpoints for each service
- [ ] Configure Grafana dashboards
- [ ] Set up alert rules in Prometheus
- [ ] Test J4C Agent API endpoints

### Short-term Configuration
- [ ] Configure SSL/TLS certificates for production
- [ ] Set secure passwords for all services
- [ ] Configure backup strategy
- [ ] Set up log rotation
- [ ] Configure monitoring alerts

### Long-term Improvements
- [ ] Implement advanced K8s deployment (from ./k8s/)
- [ ] Add load balancing for scalability
- [ ] Implement GitOps pipeline
- [ ] Configure distributed tracing
- [ ] Set up centralized logging (ELK stack)

---

## Support & Documentation

### Related Files
- **Docker Compose**: `docker-compose.hms.yml` (this deployment config)
- **Dockerfile**: `Dockerfile.j4c` (image build definition)
- **NGINX Config**: `nginx-dlt.conf`
- **Prometheus Config**: `prometheus-dlt.yml`
- **K8s Manifests**: `./k8s/` (for production Kubernetes deployment)
- **Grafana Dashboards**: `./grafana-dashboards/`

### Documentation
- **GNN Phases**: `GNN_PHASE_*.md`
- **Deployment Guide**: `plugin/DEPLOYMENT_GUIDE.md`
- **Configuration**: `.env.local` (environment variables)

### Contact & Issues
- **Repository**: https://github.com/Aurigraph-DLT-Corp/glowing-adventure
- **Issues**: GitHub Issues
- **Email**: agents@aurigraph.io

---

**Version**: 1.0.0
**Last Updated**: October 29, 2025
**Maintained By**: Aurigraph Development Team
**Status**: ✅ Ready for Deployment
