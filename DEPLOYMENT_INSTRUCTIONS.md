# HMS Production Deployment Instructions
# October 31, 2025

## Prerequisites Verification

Before deployment, ensure:

1. SSH Access:
   ```bash
   ssh -i ~/.ssh/id_rsa subbu@hms.aurex.in "echo 'SSH Connection OK'"
   ```

2. Docker on Remote Server:
   ```bash
   ssh subbu@hms.aurex.in "docker --version && docker-compose --version"
   ```

3. Git Repository Access:
   ```bash
   ssh subbu@hms.aurex.in "cd /opt/HMS && git status"
   ```

## Automated Deployment (Recommended)

### Option 1: One-Command Deployment
```bash
bash deploy-production.sh
```

### Option 2: Manual Step-by-Step

#### Step 1: Build Image Locally
```bash
docker build -t hms-gnn:v2.1.0 \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  --build-arg VCS_REF=$(git rev-parse --short HEAD) \
  -f Dockerfile .
```

#### Step 2: Verify Image
```bash
docker images | grep hms-gnn
docker inspect hms-gnn:v2.1.0
```

#### Step 3: Transfer Image
```bash
# Method 1: Via tar (faster for large images)
docker save hms-gnn:v2.1.0 | gzip | \
  ssh subbu@hms.aurex.in 'cd /opt/HMS && gunzip | docker load'

# Method 2: Via file transfer
docker save hms-gnn:v2.1.0 -o hms-gnn-v2.1.0.tar
scp hms-gnn-v2.1.0.tar subbu@hms.aurex.in:/opt/HMS/
ssh subbu@hms.aurex.in 'cd /opt/HMS && docker load -i hms-gnn-v2.1.0.tar && rm hms-gnn-v2.1.0.tar'
```

#### Step 4: Clean Old Containers
```bash
ssh subbu@hms.aurex.in << 'EOFCLEAN'
echo "Stopping old containers..."
docker ps -a | grep "hms-gnn" | awk '{print $1}' | xargs -r docker stop

echo "Removing old containers..."
docker ps -a | grep "hms-gnn" | awk '{print $1}' | xargs -r docker rm -f

echo "Pruning dangling images..."
docker image prune -f --filter "dangling=true"

echo "Current images:"
docker images | grep "hms-gnn"
EOFCLEAN
```

#### Step 5: Deploy Application
```bash
ssh subbu@hms.aurex.in << 'EOFDEPLOY'
cd /opt/HMS
echo "Current git status:"
git status

echo "Pulling latest code..."
git fetch origin
git checkout main
git pull origin main

echo "Starting Docker services..."
if [ -f "docker-compose.prod.yml" ]; then
  docker-compose -f docker-compose.prod.yml up -d
else
  docker-compose up -d
fi

echo "Waiting for services..."
sleep 30

echo "Docker services:"
docker ps

echo "Checking application health..."
curl -s http://localhost:3000/api/gnn/health | jq . || echo "Health check pending..."
EOFDEPLOY
```

#### Step 6: Configure Nginx
```bash
ssh subbu@hms.aurex.in << 'EOFNGINX'
echo "Backup nginx config..."
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%s)

echo "Test nginx syntax..."
sudo nginx -t

echo "Reload nginx..."
sudo systemctl reload nginx

echo "Nginx status:"
sudo systemctl status nginx
EOFNGINX
```

#### Step 7: Verify Deployment
```bash
echo "Testing Frontend..."
curl -k https://hms.aurex.in 2>&1 | head -20

echo ""
echo "Testing Backend API..."
curl -k https://apihms.aurex.in/api/gnn/health | jq . 2>/dev/null || echo "API not yet responding"

echo ""
echo "SSH into server..."
ssh subbu@hms.aurex.in "cd /opt/HMS && docker-compose logs -f --tail 50"
```

## Post-Deployment Verification

### Health Checks
```bash
# Local (from server)
ssh subbu@hms.aurex.in 'curl -s http://localhost:3000/api/gnn/health | jq'

# Via frontend
curl -k https://hms.aurex.in/api/gnn/health

# Via backend API
curl -k https://apihms.aurex.in/api/gnn/health
```

### View Logs
```bash
ssh subbu@hms.aurex.in 'cd /opt/HMS && docker-compose logs -f'
```

### Monitor Resources
```bash
ssh subbu@hms.aurex.in 'watch -n 5 docker stats'
```

### Check Containers
```bash
ssh subbu@hms.aurex.in 'docker ps -a'
```

## Troubleshooting

### Container Not Starting
```bash
ssh subbu@hms.aurex.in 'cd /opt/HMS && docker-compose logs app'
```

### Port Already in Use
```bash
ssh subbu@hms.aurex.in 'lsof -i :3000 || netstat -tulpn | grep 3000'
```

### Image Not Found
```bash
ssh subbu@hms.aurex.in 'docker images | grep hms-gnn'
ssh subbu@hms.aurex.in 'docker load -i /opt/HMS/hms-gnn-v2.1.0.tar'
```

### Nginx Issues
```bash
ssh subbu@hms.aurex.in 'sudo systemctl status nginx'
ssh subbu@hms.aurex.in 'sudo systemctl restart nginx'
ssh subbu@hms.aurex.in 'sudo tail -50 /var/log/nginx/error.log'
```

## Rollback Procedure

If deployment fails:

```bash
ssh subbu@hms.aurex.in << 'EOFROLLBACK'
cd /opt/HMS

echo "Stopping current deployment..."
docker-compose down

echo "Rolling back to previous version..."
git checkout HEAD~1

echo "Restarting with previous version..."
docker-compose up -d

echo "Verifying rollback..."
docker-compose logs --tail 20
EOFROLLBACK
```

## Access After Deployment

- **Frontend**: https://hms.aurex.in
- **Backend API**: https://apihms.aurex.in
- **Health Check**: https://apihms.aurex.in/api/gnn/health
- **SSH Console**: ssh subbu@hms.aurex.in
- **Working Directory**: /opt/HMS

## SSL Certificates

Certificates located at:
- **Private Key**: `/etc/letsencrypt/live/aurexcrt1/privkey.pem`
- **Full Chain**: `/etc/letsencrypt/live/aurexcrt1/fullchain.pem`

Renewal:
```bash
ssh subbu@hms.aurex.in 'sudo certbot renew --nginx'
```

## Monitoring

### Continuous Monitoring
```bash
ssh subbu@hms.aurex.in 'watch -n 5 "docker ps && docker stats --no-stream"'
```

### Log Monitoring
```bash
ssh subbu@hms.aurex.in 'cd /opt/HMS && docker-compose logs -f app'
```

### Performance Metrics
```bash
ssh subbu@hms.aurex.in << 'EOFMETRICS'
echo "Container Stats:"
docker stats --no-stream
echo ""
echo "Disk Usage:"
df -h /opt/HMS
echo ""
echo "Memory:"
free -h
EOFMETRICS
```

## Next Steps

1. ✅ Verify frontend loads: https://hms.aurex.in
2. ✅ Verify API responds: https://apihms.aurex.in/api/gnn/health
3. ✅ Monitor logs for 24 hours
4. ✅ Test with real users
5. ✅ Monitor performance metrics
6. ✅ Gather feedback

---

**Status**: Ready for Deployment
**Date**: October 31, 2025
**Version**: v2.1.0
