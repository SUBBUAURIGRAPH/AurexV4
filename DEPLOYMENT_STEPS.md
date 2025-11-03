# HERMES HF Production Deployment Steps

## Environment Details
- **Frontend**: hms.aurex.in (SSL via /etc/letsencrypt/live/aurexcrt1/)
- **Backend API**: apihms.aurex.in
- **Remote User**: subbu
- **Remote Path**: /opt/HMS
- **Git Repo**: git@github.com:Aurigraph-DLT-Corp/HMS.git
- **Git Branch**: main

## Pre-Deployment Checklist
- [x] All code committed and pushed to GitHub
- [x] Working tree clean
- [x] Docker build tested locally
- [x] Jest tests configured (92% pass rate)
- [x] Docker Compose configured
- [x] Kubernetes manifests created

## Deployment Steps

### 1. Build Docker Image
```bash
docker build -t hms-hermes:$(git rev-parse --short HEAD) -t hms-hermes:latest .
```

### 2. Transfer Docker Image to Remote
```bash
docker save hms-hermes:latest | gzip | ssh subbu@hms.aurex.in "cd /opt/HMS && gunzip | docker load"
```

### 3. Update Remote Repository
```bash
ssh subbu@hms.aurex.in << 'REMOTE'
cd /opt/HMS
git fetch origin
git checkout main
git pull origin main
REMOTE
```

### 4. Stop Old Containers
```bash
ssh subbu@hms.aurex.in "cd /opt/HMS && docker-compose down"
```

### 5. Clean Docker Resources
```bash
ssh subbu@hms.aurex.in << 'REMOTE'
cd /opt/HMS
docker image prune -f --filter "dangling=true"
docker image prune -f -a --filter "until=168h"
docker container prune -f
docker volume prune -f
REMOTE
```

### 6. Start New Containers
```bash
ssh subbu@hms.aurex.in "cd /opt/HMS && docker-compose up -d"
```

### 7. Verify Deployment
```bash
ssh subbu@hms.aurex.in << 'REMOTE'
cd /opt/HMS
docker-compose ps
curl http://localhost:3001/health
docker-compose logs --tail=20
REMOTE
```

## Post-Deployment Verification

### Health Checks
- [ ] Frontend loads: https://hms.aurex.in
- [ ] Backend API responds: https://apihms.aurex.in/health
- [ ] gRPC endpoint accessible: apihms.aurex.in:3002
- [ ] SSL certificates valid
- [ ] Database connected
- [ ] Redis cache working

### Monitoring
- [ ] Check container logs: `docker-compose logs -f`
- [ ] Monitor resource usage: `docker stats`
- [ ] Verify no errors in logs
- [ ] Test key API endpoints

### Rollback (if needed)
```bash
ssh subbu@hms.aurex.in << 'ROLLBACK'
cd /opt/HMS
docker-compose down
git checkout <previous-commit>
docker-compose up -d
ROLLBACK
```

## Access After Deployment
- **Frontend**: https://hms.aurex.in
- **Backend API**: https://apihms.aurex.in
- **Health Check**: curl https://apihms.aurex.in/health
- **View Logs**: ssh subbu@hms.aurex.in 'cd /opt/HMS && docker-compose logs -f'

## Troubleshooting

### Containers won't start
```bash
ssh subbu@hms.aurex.in 'cd /opt/HMS && docker-compose logs'
```

### Database connection issues
```bash
ssh subbu@hms.aurex.in 'cd /opt/HMS && docker exec app npm run migrate'
```

### Clear stuck containers
```bash
ssh subbu@hms.aurex.in << 'CLEANUP'
cd /opt/HMS
docker-compose down -v
docker system prune -f
docker-compose up -d
CLEANUP
```

