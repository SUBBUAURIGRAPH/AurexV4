# HMS J4C Agent - Deployment Procedures

**Version**: 1.0.0
**Last Updated**: October 29, 2025

---

## 🚀 Quick Deployment Guide

### Prerequisites
- SSH access to production server (subbu@hms.aurex.in)
- Docker and Docker Compose installed
- Node.js 18+ (for local development)
- Git access to repository

---

## 📦 Deployment Steps

### Step 1: Build Docker Image Locally
```bash
cd /c/subbuworking/HMS
docker build -f Dockerfile.j4c -t aurigraph/hms-j4c-agent:1.0.0 .
```

### Step 2: Transfer to Production Server
```bash
docker save aurigraph/hms-j4c-agent:1.0.0 | gzip | \
  ssh subbu@hms.aurex.in "docker load"
```

### Step 3: Deploy Services
```bash
ssh subbu@hms.aurex.in "cd /opt/HMS && \
  docker-compose -f docker-compose.production.yml down && \
  docker-compose -f docker-compose.production.yml up -d"
```

### Step 4: Verify Deployment
```bash
curl -k https://hms.aurex.in/health
# Should return: {"status":"ok","message":"HMS Agent - OK"}
```

---

## 🔄 Rollback Procedure

```bash
ssh subbu@hms.aurex.in "cd /opt/HMS && \
  docker-compose -f docker-compose.production.yml restart && \
  docker logs hms-j4c-agent | tail -20"
```

---

## 📊 Health Checks

```bash
# Check all services
ssh subbu@hms.aurex.in "docker ps | grep hms"

# Check logs
ssh subbu@hms.aurex.in "docker logs -f hms-j4c-agent"

# Test endpoints
curl -k https://hms.aurex.in/health
curl -k https://hms.aurex.in/api/agents
curl -k https://hms.aurex.in/metrics
```

---

## 🔐 Security Checklist
- [ ] SSL certificate valid
- [ ] Authentication enabled
- [ ] Rate limiting active
- [ ] Firewall rules updated
- [ ] Backups scheduled
- [ ] Monitoring alerts configured

---

**For issues**: engineering@aurigraph.io
