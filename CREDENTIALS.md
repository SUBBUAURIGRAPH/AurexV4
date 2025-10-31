# HMS Mobile Trading Platform - Deployment Credentials & Configuration

**Last Updated**: October 31, 2025
**Status**: ✅ Production Deployed

## Remote Server Configuration

SSH Connection:
  User: subbu
  Host: hms.aurex.in
  Backend API: apihms.aurex.in

## Working Directory

Remote Server Path: /opt/HMS
- Main project directory: /opt/HMS/
- Web server files: /opt/HMS/mobile/
- Docker config: /opt/HMS/mobile/docker-compose.yml
- Nginx config: /opt/HMS/mobile/nginx.conf
- Application logs: /opt/HMS/mobile/logs/

## Git Repository

Repository URL: git@github.com:Aurigraph-DLT-Corp/HMS.git
Branch: main
Clone: git clone -b main git@github.com:Aurigraph-DLT-Corp/HMS.git /opt/HMS

## SSL Certificates

Certificate Path: /etc/letsencrypt/live/aurexcrt1/
- Private Key: /etc/letsencrypt/live/aurexcrt1/privkey.pem
- Full Chain: /etc/letsencrypt/live/aurexcrt1/fullchain.pem
- Issuer: Let's Encrypt
- Renewal: Automatic (certbot)

## Domain Configuration

Frontend URL: https://hms.aurex.in
Backend API URL: https://apihms.aurex.in
WebSocket URL: wss://apihms.aurex.in

## Docker Configuration

### Image Details
Image Name: hms-web
Image Tag: latest
Image Size: 80.2 MB
Base Image: nginx:alpine

### Container Details
Container Name: hms-mobile-web
Container Status: RUNNING
Port Mappings:
  HTTP: 0.0.0.0:80 -> container:80
  HTTPS: 0.0.0.0:443 -> container:443

### Volumes
SSL Certificates: /etc/letsencrypt/live/aurexcrt1/ (read-only)
Nginx Logs: ./logs/nginx:/var/log/nginx
Nginx Config: ./nginx.conf:/etc/nginx/conf.d/default.conf (read-only)

### Environment Variables
FRONTEND_URL: https://hms.aurex.in
API_URL: https://apihms.aurex.in
WS_URL: wss://apihms.aurex.in
NODE_ENV: production

### Health Check
Endpoint: http://localhost:80/
Interval: 30 seconds
Timeout: 10 seconds
Retries: 3
Start Period: 10 seconds

## Deployment Commands

Deploy/Start:
  ssh subbu@hms.aurex.in
  cd /opt/HMS/mobile
  docker-compose -f docker-compose.yml up -d

Stop Container:
  docker-compose -f docker-compose.yml down

View Logs:
  docker-compose -f docker-compose.yml logs -f hms-mobile-web

Restart Container:
  docker-compose -f docker-compose.yml restart hms-mobile-web

Container Status:
  docker-compose -f docker-compose.yml ps
  docker inspect hms-mobile-web

Container Health:
  docker inspect hms-mobile-web --format='{{.State.Health.Status}}'

## Monitoring Commands

View Logs:
  docker logs -f hms-mobile-web
  docker logs --tail=100 hms-mobile-web

Filter Errors:
  docker logs hms-mobile-web | grep -i error

Resource Usage:
  docker stats hms-mobile-web

Container Details:
  docker inspect hms-mobile-web

## Troubleshooting

Check Container:
  docker ps | grep hms-mobile-web
  docker logs hms-mobile-web

Check SSL:
  openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -noout -dates

Renew SSL:
  sudo certbot renew
  docker-compose -f /opt/HMS/mobile/docker-compose.yml restart

## Maintenance Schedule

Daily:
  - Monitor container health
  - Review logs

Weekly:
  - Check SSL expiration
  - Monitor disk space
  - Check API connectivity

Monthly:
  - Security audit
  - Performance analysis
  - Backup verification

30 Days Before Expiry:
  - SSL certificate renewal

## Deployment Timeline

October 31, 2025 - Production Deployment
  11:38 UTC - Container deployed to hms.aurex.in
  - Repository: /opt/HMS
  - Image: hms-web:latest (built)
  - Container: hms-mobile-web (running)
  - Status: ACTIVE & RUNNING

---

#memorize: PRODUCTION DEPLOYMENT ACTIVE (Oct 31, 2025 11:38 UTC)
- Frontend: https://hms.aurex.in
- Backend API: https://apihms.aurex.in
- SSH: ssh subbu@hms.aurex.in
- Directory: /opt/HMS
- Git: git@github.com:Aurigraph-DLT-Corp/HMS.git (main)
- SSL: /etc/letsencrypt/live/aurexcrt1/
- Container: hms-mobile-web (RUNNING)
- Image: hms-web:latest (80.2 MB)
- Status: ✅ SUCCESSFULLY DEPLOYED

Quick Deploy:
  ssh subbu@hms.aurex.in && cd /opt/HMS/mobile && docker-compose up -d

Quick Status:
  docker-compose -f /opt/HMS/mobile/docker-compose.yml ps

Quick Logs:
  docker logs -f hms-mobile-web

Health Check:
  docker inspect hms-mobile-web --format='{{.State.Health.Status}}'

