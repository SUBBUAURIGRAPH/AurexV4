# J4C Agent System - Production Deployment Checklist

**Version**: 1.0.0
**Last Updated**: October 29, 2025
**Scope**: HMS J4C Agent System Deployment
**Maintainer**: Aurigraph Development Team

---

## 📋 Pre-Deployment Verification

### Local Environment Setup
- [ ] Git repository cloned and on `main` branch
- [ ] All uncommitted changes committed and pushed
- [ ] SSH keys configured for GitHub access
- [ ] SSH keys configured for target server access
- [ ] Docker installed locally (version 20+)
- [ ] Docker Compose installed locally (version 2.0+)
- [ ] Required scripts executable (`chmod +x *.sh`)

### Code Quality Checks
- [ ] Linting passed: `npm run lint`
- [ ] Tests passed: `npm run test`
- [ ] Security scan completed: `trivy image aurigraph/hms-j4c-agent`
- [ ] Code review completed
- [ ] Documentation updated for changes
- [ ] CHANGELOG.md updated with new version
- [ ] Version number bumped in package.json

### Repository State
- [ ] Main branch is clean: `git status` shows no uncommitted changes
- [ ] Latest commit is tagged: `git tag v1.0.0`
- [ ] GitHub Actions workflows are enabled
- [ ] Branch protection rules configured
- [ ] Pre-commit hooks installed and passing

---

## 🔧 Remote Server Prerequisites

### Network & Access
- [ ] SSH connectivity verified: `ssh -p 22 user@host "echo OK"`
- [ ] SSH key authentication working (no password needed)
- [ ] Server IP/hostname accessible from local machine
- [ ] Firewall rules allow ports: 80, 443, 9003, 5432, 9090, 3000
- [ ] VPN access configured (if required)

### Server Infrastructure
- [ ] OS installed and updated: `uname -a`
- [ ] Sufficient disk space: `df -h` (minimum 50GB)
- [ ] Sufficient memory: `free -h` (minimum 4GB)
- [ ] CPU cores available: `nproc` (minimum 2 cores)
- [ ] Swap space configured: `swapon --show`

### Docker & Containers
- [ ] Docker installed: `docker --version`
- [ ] Docker Compose installed: `docker-compose --version`
- [ ] Docker daemon running: `systemctl status docker`
- [ ] User added to docker group: `groups $USER`
- [ ] Docker socket permissions correct: `ls -l /var/run/docker.sock`

### Git & Repository
- [ ] Git installed: `git --version`
- [ ] SSH key for GitHub configured: `ssh -T git@github.com`
- [ ] Repository directory created: `ls -la /opt/HMS`
- [ ] Directory ownership correct: `ls -ld /opt/HMS`
- [ ] Repository cloned/updated: `git -C /opt/HMS log -1 --oneline`

### SSL/TLS Certificates
- [ ] SSL certificate file exists: `ls -la /etc/letsencrypt/live/aurexcrt1/fullchain.pem`
- [ ] Private key exists: `ls -la /etc/letsencrypt/live/aurexcrt1/privkey.pem`
- [ ] Certificate is valid: `openssl x509 -noout -dates -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem`
- [ ] Certificate not expired: Check expiry date
- [ ] Certbot installed for auto-renewal: `certbot --version`
- [ ] Auto-renewal enabled: `systemctl status certbot.timer`

### Environment Variables
- [ ] .env file created from .env.example
- [ ] JIRA_API_KEY configured
- [ ] GITHUB_TOKEN configured
- [ ] HUBSPOT_API_KEY configured (if needed)
- [ ] SLACK_WEBHOOK_URL configured
- [ ] Database password configured: DB_PASSWORD
- [ ] Grafana password configured: GRAFANA_PASSWORD
- [ ] All secrets are strong (min 16 characters)

---

## 🐳 Docker Image Preparation

### Image Building
- [ ] Dockerfile.j4c validated: `docker build --dry-run -f Dockerfile.j4c .`
- [ ] Docker image built successfully: `docker build -f Dockerfile.j4c -t aurigraph/hms-j4c-agent:1.0.0 .`
- [ ] Image size reasonable (< 500MB): `docker images | grep hms-j4c-agent`
- [ ] Image scanned for vulnerabilities: `trivy image aurigraph/hms-j4c-agent:1.0.0`
- [ ] No high/critical vulnerabilities found

### Image Testing
- [ ] Image runs locally: `docker run --rm aurigraph/hms-j4c-agent:1.0.0 node -v`
- [ ] Health check works: `docker run --rm --health-cmd='curl -f http://localhost:9003/health' aurigraph/hms-j4c-agent:1.0.0`
- [ ] Environment variables accepted: Test with `-e` flags
- [ ] Volume mounts work: Test with `-v` flags
- [ ] Port mapping works: Test with `-p` flags

### Image Registry (Docker Hub)
- [ ] Logged in to Docker Hub: `docker login`
- [ ] Image tagged for push: `docker tag aurigraph/hms-j4c-agent:1.0.0 aurigraph/hms-j4c-agent:latest`
- [ ] Image pushed to registry: `docker push aurigraph/hms-j4c-agent:1.0.0`
- [ ] Image publicly available: Verify on Docker Hub

---

## 📋 Deployment Script Verification

### Script Validation
- [ ] Deployment script exists: `ls -la deploy-to-aurex.sh`
- [ ] Script is executable: `test -x deploy-to-aurex.sh && echo OK`
- [ ] Script syntax valid: `bash -n deploy-to-aurex.sh`
- [ ] Script tested locally (dry-run mode if available)
- [ ] Script has error handling: Check for `set -e`
- [ ] Script has logging: Check for status messages

### Configuration Files
- [ ] docker-compose.production.yml exists: `ls -la docker-compose.production.yml`
- [ ] docker-compose.production.yml valid YAML: `docker-compose -f docker-compose.production.yml config`
- [ ] NGINX configuration exists: `ls -la nginx-dlt.conf`
- [ ] NGINX configuration valid: `nginx -t -c nginx-dlt.conf`
- [ ] Prometheus config exists: `ls -la prometheus-dlt.yml`
- [ ] Alert rules exist: `ls -la prometheus-alerts.yml`
- [ ] Grafana config exists: `ls -la grafana-alerts.yaml`

---

## 🚀 Deployment Execution

### Pre-Deployment Communication
- [ ] Team notified of deployment: Slack/Email
- [ ] Maintenance window scheduled: Date/time documented
- [ ] Stakeholders informed: Business/product teams
- [ ] On-call engineer assigned: Contact info documented
- [ ] Rollback plan communicated to team
- [ ] Expected deployment time: 5-10 minutes

### Deployment Steps
- [ ] Run deployment script: `./deploy-to-aurex.sh`
- [ ] Monitor script progress: Watch for ✅ confirmations
- [ ] Script completes without errors
- [ ] Deployment report generated: `aurex-deployment-report.txt`
- [ ] Review deployment report for issues
- [ ] No errors or warnings in script output

### Service Startup Verification
- [ ] All containers running: `docker ps -a`
- [ ] Expected services present:
  - [ ] hms-j4c-agent
  - [ ] hms-nginx-proxy
  - [ ] hms-postgres
  - [ ] hms-prometheus
  - [ ] hms-grafana
- [ ] No containers in "exited" state
- [ ] No containers restarting: `docker ps --format "table {{.Names}}\t{{.Status}}"`

### Log Verification
- [ ] Agent logs checked: `docker logs hms-j4c-agent | head -20`
- [ ] NGINX logs checked: `docker logs hms-nginx-proxy | head -20`
- [ ] Database logs checked: `docker logs hms-postgres | head -20`
- [ ] Prometheus logs checked: `docker logs hms-prometheus | head -20`
- [ ] No critical errors in logs
- [ ] No permission denied errors
- [ ] No connection refused errors

---

## ✅ Post-Deployment Validation

### Health Checks
- [ ] Frontend health check: `curl -v https://hms.aurex.in/health`
  - Expected: HTTP 200
  - Response time: < 1 second
- [ ] Backend health check: `curl -v https://apihms.aurex.in/health`
  - Expected: HTTP 200
  - Response time: < 1 second
- [ ] Database health: `docker exec hms-postgres pg_isready -U hms_user`
  - Expected: "accepting connections"
- [ ] Prometheus health: `curl http://localhost:9090/-/healthy`
  - Expected: HTTP 200
- [ ] Grafana health: `curl http://localhost:3000/api/health`
  - Expected: HTTP 200 with "ok"

### SSL/TLS Verification
- [ ] HTTPS is enforced: HTTP redirects to HTTPS
- [ ] Certificate is valid: No SSL warnings in browser
- [ ] Certificate chain complete: `openssl s_client -connect hms.aurex.in:443 -showcerts`
- [ ] Certificate expiry checked: Not expiring within 30 days
- [ ] TLS version 1.2+: `openssl s_client -connect hms.aurex.in:443 -tls1_2`
- [ ] Strong ciphers used: No deprecated ciphers

### API Endpoint Testing
- [ ] Agent API responds: `curl https://apihms.aurex.in/api/status`
- [ ] Agent metrics available: `curl https://apihms.aurex.in/metrics`
- [ ] Agent info endpoint: `curl https://apihms.aurex.in/info`
- [ ] JIRA integration working: Check agent logs for JIRA connectivity
- [ ] GitHub integration working: Check agent logs for GitHub connectivity
- [ ] Database queries working: Check Prometheus queries for success

### Service Connectivity
- [ ] Agent connects to database: `docker logs hms-j4c-agent | grep postgres`
- [ ] NGINX proxies to agent: `curl -v https://hms.aurex.in/api/test`
- [ ] Prometheus scrapes agent: Check Prometheus targets page
- [ ] Prometheus scrapes database: Check database metrics in Prometheus
- [ ] Grafana connects to Prometheus: Check Grafana data source status

### Performance Checks
- [ ] Agent response time acceptable: < 1 second for API calls
- [ ] Database queries responsive: < 100ms for simple queries
- [ ] Prometheus storage healthy: Check TSDB size in Prometheus UI
- [ ] CPU usage normal: `docker stats | grep hms-j4c-agent`
- [ ] Memory usage normal: < 80% of container limit
- [ ] Disk usage acceptable: `df -h` shows sufficient free space
- [ ] Network bandwidth normal: `docker stats | grep NET`

---

## 🔒 Security Validation

### Authentication & Authorization
- [ ] SSH key authentication working (no password prompts)
- [ ] Database password set and not default
- [ ] Grafana default password changed
- [ ] API authentication configured (if applicable)
- [ ] JIRA token is valid and not expired
- [ ] GitHub token is valid and not expired
- [ ] Slack webhook URL is valid and accessible

### Network Security
- [ ] Only required ports exposed: 80, 443, 22
- [ ] Unnecessary ports blocked: 5432, 9090, 3000 (internal only)
- [ ] Firewall rules configured correctly
- [ ] HTTPS enforced on all external endpoints
- [ ] HTTP → HTTPS redirects working
- [ ] CORS headers configured (if needed)
- [ ] Rate limiting enabled (if needed)

### Container Security
- [ ] Containers running as non-root: Check Dockerfile
- [ ] Read-only root filesystem (where applicable): `--read-only` flag
- [ ] Secrets not in environment variables (use .env)
- [ ] No hardcoded credentials in code
- [ ] Image scanning passed: Trivy/Snyk report
- [ ] Regular expression for sensitive data passed
- [ ] No debug mode enabled in production

### Data Protection
- [ ] Database backups configured: Cron job created
- [ ] Volume backups configured: Regular snapshots
- [ ] Backups stored securely: Encrypted, off-site
- [ ] Backup restoration tested: Verified restore procedure
- [ ] Sensitive data encrypted: Database encryption enabled
- [ ] Access logs enabled: NGINX, PostgreSQL audit logs

---

## 📊 Monitoring & Alerting

### Prometheus Configuration
- [ ] Prometheus running and scraping metrics
- [ ] Agent metrics being collected: Check Prometheus targets
- [ ] Database metrics being collected: Check postgres_exporter
- [ ] NGINX metrics being collected: Check prometheus_client
- [ ] Alert rules loaded: `docker exec hms-prometheus cat /etc/prometheus/alerts.yml`
- [ ] Alert rules valid: No YAML syntax errors

### Alert Rules Verification
- [ ] Critical alerts configured: Agent down, database down
- [ ] Warning alerts configured: High CPU, high memory
- [ ] Information alerts configured: Service restarts
- [ ] Alert thresholds appropriate: Tested with mock alerts
- [ ] Alert evaluation happening: Check Prometheus alerts page

### Grafana Setup
- [ ] Grafana accessible: `http://localhost:3000`
- [ ] Default password changed: Admin password updated
- [ ] Prometheus data source added: Test query working
- [ ] Dashboards imported: Performance, Risk, Portfolio
- [ ] Dashboard panels showing data: All metrics populated
- [ ] Alerts configured: Notification channels set up
- [ ] Notification channels working: Test alerts sent

### Notification Channels
- [ ] Slack webhook configured: `echo "test" | curl -X POST $WEBHOOK_URL -d @-`
- [ ] Slack channel accessible: Verify channel name
- [ ] Email notifications configured: Test email sent
- [ ] Alert routing configured: Critical → Slack, Warning → Email
- [ ] On-call escalation configured: If applicable
- [ ] Alert history accessible: View past alerts

---

## 🔄 Deployment Rollback Plan

### Rollback Preparation
- [ ] Rollback script exists: `deploy-rollback.sh`
- [ ] Previous version available: Docker image tagged with version
- [ ] Backup data available: Database backup from before deployment
- [ ] Rollback procedure documented: Step-by-step instructions
- [ ] Team trained on rollback: All team members know procedure
- [ ] Rollback testing completed: Test rollback in staging

### Rollback Triggers
- [ ] Rollback threshold documented: When to trigger rollback
- [ ] Decision maker identified: Who authorizes rollback
- [ ] Stakeholders identified: Who to notify on rollback
- [ ] Rollback impact assessed: What breaks if rolled back
- [ ] Customer impact minimized: Minimize downtime
- [ ] Data consistency ensured: Database remains consistent

### Rollback Execution
- [ ] Rollback command prepared: Ready to execute
- [ ] Services stopped cleanly: Graceful shutdown
- [ ] Previous version deployed: Old containers started
- [ ] Data restored (if needed): Database rollback applied
- [ ] Configuration reverted: Old .env files used
- [ ] Services verified running: Health checks pass
- [ ] Notifications sent: Team/customers informed

---

## 📝 Post-Deployment Documentation

### Update Documentation
- [ ] Deployment date recorded: October 29, 2025
- [ ] Deployed version documented: v1.0.0
- [ ] Deployment report saved: `aurex-deployment-report.txt`
- [ ] Changes documented: What changed in this deployment
- [ ] Known issues documented: Any quirks or limitations
- [ ] Runbooks updated: Instructions for on-call engineers
- [ ] Troubleshooting guide updated: New issues & solutions

### Update Monitoring
- [ ] Prometheus scrape configuration updated (if needed)
- [ ] Alert rules updated (if needed)
- [ ] Grafana dashboards updated (if needed)
- [ ] Alert thresholds tuned: Based on observed metrics
- [ ] Dashboard annotations updated: Note deployment event
- [ ] Baseline metrics recorded: For comparison in future

### Team Communication
- [ ] Deployment completed announcement: Team notification
- [ ] Key metrics/status reported: Performance data
- [ ] Issues encountered documented: Lessons learned
- [ ] Team feedback collected: Improvement suggestions
- [ ] Retrospective scheduled: Follow-up meeting
- [ ] Post-deployment review completed: Sign-off from team

---

## 🚨 Incident Response

### If Deployment Fails

#### Immediate Actions
- [ ] Stop deployment: Cancel running deployment script
- [ ] Assess impact: What services are affected
- [ ] Notify team: Alert on-call engineer
- [ ] Keep stakeholders informed: Regular updates
- [ ] Check error logs: `docker logs <container>`
- [ ] Identify root cause: What went wrong

#### Common Issues & Solutions
- [ ] SSL certificate not found:
  - Verify: `ls -la /etc/letsencrypt/live/aurexcrt1/`
  - Solution: Copy certificate files to correct location

- [ ] Database connection failure:
  - Verify: `docker logs hms-postgres`
  - Solution: Check DB_PASSWORD in .env matches configuration

- [ ] NGINX SSL error:
  - Verify: `nginx -t -c /etc/nginx/nginx.conf`
  - Solution: Fix NGINX configuration, restart service

- [ ] Docker image not found:
  - Verify: `docker images | grep hms-j4c-agent`
  - Solution: Pull image: `docker pull aurigraph/hms-j4c-agent:1.0.0`

- [ ] Port already in use:
  - Verify: `netstat -tulpn | grep LISTEN`
  - Solution: Kill process or use different port

#### Escalation Path
- [ ] Level 1: Review logs, check common issues (15 min)
- [ ] Level 2: Rollback deployment if needed (10 min)
- [ ] Level 3: Contact DevOps lead for manual intervention (5 min)
- [ ] Level 4: Executive decision on extended downtime

---

## 🎯 Success Criteria

### Deployment is Successful When:
- [ ] All services running without errors
- [ ] All health checks passing
- [ ] SSL/TLS certificates valid and working
- [ ] API endpoints responding (< 1 second)
- [ ] Database accessible and responsive
- [ ] Monitoring and alerting active
- [ ] No critical errors in logs
- [ ] Team notified and satisfied
- [ ] Documentation updated

### Key Metrics to Monitor (24-48 hours post-deployment)
- [ ] Error rate: < 0.1% (target)
- [ ] API latency: < 500ms (p99)
- [ ] Database response time: < 100ms
- [ ] CPU usage: < 60% average
- [ ] Memory usage: < 70% average
- [ ] Disk space: > 20GB free
- [ ] Network bandwidth: Normal patterns
- [ ] User complaints: None reported

---

## 🔄 Continuous Improvement

### Lessons Learned
- [ ] Document what went well
- [ ] Document what could be improved
- [ ] Identify automation opportunities
- [ ] Update scripts/procedures
- [ ] Share knowledge with team
- [ ] Update this checklist for next deployment

### Checklist Amendments

**Version History**:
- v1.0.0 - Initial version (Oct 29, 2025)
- v1.1.0 - [Date/Changes]
- v1.2.0 - [Date/Changes]

**Amendment Process**:
1. Identify improvement needed
2. Test the improvement
3. Document the change
4. Update this checklist
5. Communicate to team
6. Version bump
7. Commit changes to git

**Recent Amendments**:
- [Add amendments here as you make them]

---

## 📞 Support & Escalation

### On-Call Engineer
- **Name**: [To be filled]
- **Phone**: [To be filled]
- **Email**: [To be filled]
- **Slack**: [@handle]

### Escalation Contacts
- **DevOps Lead**: [Name/Contact]
- **Security Officer**: [Name/Contact]
- **Manager**: [Name/Contact]
- **CTO**: [Name/Contact]

### Support Resources
- **GitHub**: https://github.com/Aurigraph-DLT-Corp/HMS
- **Documentation**: DEPLOYMENT_PIPELINE_GUIDE.md
- **Runbooks**: [Internal wiki/documentation]
- **Email**: agents@aurigraph.io

---

## ✍️ Sign-Off

### Deployment Completion Sign-Off

**Deployment Date**: [Date]
**Deployed Version**: [Version]
**Deployed By**: [Name]
**Verified By**: [Name]
**Approved By**: [Name]

**Signature**: _________________ **Date**: _________

---

## 📌 Notes for Future Deployments

**Tips & Tricks**:
- Always backup database before deployment
- Test rollback procedure before going live
- Have team available during deployment window
- Monitor logs for first 24 hours
- Document any anomalies observed
- Update runbooks based on learnings

**Common Pitfalls to Avoid**:
- ❌ Deploying without proper testing
- ❌ Not backing up data before deployment
- ❌ Deploying during critical business hours
- ❌ Not informing stakeholders of changes
- ❌ Ignoring warning messages in logs
- ❌ Not having rollback plan prepared
- ❌ Deplying directly to production without staging

**Best Practices**:
- ✅ Always deploy to staging first
- ✅ Run full test suite before deployment
- ✅ Have team on standby during deployment
- ✅ Monitor metrics closely post-deployment
- ✅ Document all changes thoroughly
- ✅ Keep rollback plan updated and tested
- ✅ Communicate status to stakeholders

---

## 📄 Appendix

### A. Useful Commands

```bash
# Deployment
./deploy-to-aurex.sh

# SSH Access
ssh -p 22 subbu@hms.aurex.in

# Service Management
docker-compose -f docker-compose.production.yml ps
docker-compose -f docker-compose.production.yml logs -f hms-j4c-agent
docker-compose -f docker-compose.production.yml restart

# Health Checks
curl https://hms.aurex.in/health
curl https://apihms.aurex.in/health

# Monitoring
docker stats
docker ps -a --no-trunc

# Logs
docker logs hms-j4c-agent
docker logs hms-nginx-proxy
docker logs hms-postgres

# Cleanup
docker system prune -a -f
```

### B. Environment Variables Template

```bash
# JIRA Configuration
JIRA_API_KEY=your_jira_token
JIRA_EMAIL=your_email@aurigraph.io
JIRA_BASE_URL=https://aurigraph.atlassian.net

# GitHub Configuration
GITHUB_TOKEN=your_github_token
GITHUB_API_URL=https://api.github.com

# Database Configuration
DB_USER=hms_user
DB_PASSWORD=secure_password_min_16_chars
DB_NAME=hms_db

# Application Configuration
NODE_ENV=production
LOG_LEVEL=info
PORT=9003

# Slack Configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# HubSpot Configuration
HUBSPOT_API_KEY=your_hubspot_key

# Grafana Configuration
GRAFANA_PASSWORD=secure_password_min_16_chars
```

### C. Rollback Commands

```bash
# If deployment fails and you need to rollback:

# Stop current services
docker-compose -f docker-compose.production.yml down

# Remove problematic images (optional)
docker rmi aurigraph/hms-j4c-agent:1.0.0

# Pull previous working version
docker pull aurigraph/hms-j4c-agent:0.9.0

# Update image in docker-compose.production.yml
# Change: image: aurigraph/hms-j4c-agent:0.9.0

# Start previous version
docker-compose -f docker-compose.production.yml up -d

# Verify health
curl https://hms.aurex.in/health
```

---

**Document Status**: ✅ ACTIVE
**Last Review**: October 29, 2025
**Next Review**: [Date for next deployment]
**Frequency**: Each deployment or quarterly

---

**Print this checklist and mark items as you complete them during deployment.**
**This is a living document - amend and improve it after each deployment.**
