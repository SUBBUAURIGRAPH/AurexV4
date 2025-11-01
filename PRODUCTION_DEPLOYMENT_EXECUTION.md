# HMS Production Deployment Execution - October 31, 2025

**Target Server**: hms.aurex.in (Self-hosted)
**Frontend URL**: https://hms.aurex.in
**Backend API URL**: https://apihms.aurex.in
**Working Directory**: /opt/HMS
**SSH**: subbu@hms.aurex.in
**Git Branch**: main
**Docker Image**: hms-gnn:v2.1.0

---

## Deployment Steps

### Step 1: Build Docker Image Locally
```bash
docker build -t hms-gnn:v2.1.0 \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  --build-arg VCS_REF=$(git rev-parse --short HEAD) \
  -f Dockerfile .
```

### Step 2: Transfer Image to Remote Server
```bash
docker save hms-gnn:v2.1.0 | gzip | ssh subbu@hms.aurex.in 'gunzip | docker load'
```

### Step 3: Clean Old Containers
```bash
ssh subbu@hms.aurex.in << 'EOFCLEAN'
docker ps -a | grep hms-gnn | awk '{print $1}' | xargs -r docker stop
docker ps -a | grep hms-gnn | awk '{print $1}' | xargs -r docker rm -f
docker image prune -f
EOFCLEAN
```

### Step 4: Deploy Application
```bash
ssh subbu@hms.aurex.in << 'EOFDEPLOY'
cd /opt/HMS
docker-compose -f docker-compose.prod.yml up -d
sleep 30
docker ps
EOFDEPLOY
```

### Step 5: Configure Nginx
```bash
scp nginx-production.conf subbu@hms.aurex.in:/tmp/
ssh subbu@hms.aurex.in 'sudo cp /tmp/nginx-production.conf /etc/nginx/sites-available/hms'
ssh subbu@hms.aurex.in 'sudo ln -sf /etc/nginx/sites-available/hms /etc/nginx/sites-enabled/'
ssh subbu@hms.aurex.in 'sudo nginx -t && sudo systemctl reload nginx'
```

### Step 6: Verify Deployment
```bash
curl https://hms.aurex.in
curl https://apihms.aurex.in/api/gnn/health
```

---

## Automated Deployment

Run the automated script:
```bash
bash deploy-production.sh
```

---

## Post-Deployment Verification

### Health Checks
```bash
ssh subbu@hms.aurex.in 'curl -s http://localhost:3000/api/gnn/health | jq'
```

### View Logs
```bash
ssh subbu@hms.aurex.in 'cd /opt/HMS && docker-compose logs -f'
```

### Monitor Performance
```bash
ssh subbu@hms.aurex.in 'docker stats'
```

---

## Rollback (If Needed)

```bash
ssh subbu@hms.aurex.in 'cd /opt/HMS && docker-compose down'
```

---

## SSL Certificate Renewal (Let's Encrypt)

The certificates at `/etc/letsencrypt/live/aurexcrt1/` will need renewal before expiration.

```bash
ssh subbu@hms.aurex.in 'sudo certbot renew --nginx'
```

---

