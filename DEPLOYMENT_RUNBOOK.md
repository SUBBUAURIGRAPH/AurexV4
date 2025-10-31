# HMS Platform - Deployment & Validation Runbook
**Date**: October 31, 2025
**Status**: 🚀 Ready for Production Deployment
**Version**: 1.0

---

## 📋 Executive Summary

This runbook covers the deployment and validation of 4 completed tasks:
1. **Run-Tests Skill** - Enhanced with flaky detection and multi-framework support
2. **DLT Docker Configuration** - Automated setup with Aurigraph API integration
3. **Staging Integration Validation** - 7-phase validation framework
4. **Team Training Materials** - 115+ minutes of comprehensive training content

**Expected Timeline**: 4-6 hours total (can be parallelized)

---

## ✅ Pre-Deployment Checklist

### Infrastructure Prerequisites
- [ ] Production server accessible (ssh subbu@hms.aurex.in)
- [ ] Docker services running and healthy
- [ ] PostgreSQL database initialized
- [ ] Redis cache operational
- [ ] NGINX reverse proxy configured
- [ ] Aurigraph API credentials obtained
- [ ] Backup strategy in place

### Code Prerequisites
- [ ] All code committed to main branch
- [ ] CI/CD pipelines passing (if configured)
- [ ] Test coverage verified (92%+ statements)
- [ ] Security audit complete

### Team Prerequisites
- [ ] Team members notified of deployment
- [ ] Staging environment available for validation
- [ ] Team leads briefed on training rollout
- [ ] Support team ready for troubleshooting

---

## 🚀 PHASE 1: Staging Validation (30-45 minutes)

### Objective
Verify all 4 task deliverables function correctly in staging environment before production deployment.

### Steps

**1. Navigate to project directory**
```bash
cd /opt/HMS
```

**2. Run staging integration validation script**
```bash
./scripts/validate-staging-integration.sh
```

**Expected Output**:
- Infrastructure validation ✓
- Unit tests execution ✓
- Integration tests (103 tests) ✓
- API endpoint validation ✓
- Performance benchmarking ✓
- Data consistency checks ✓
- Monitoring & logging validation ✓

**3. Review validation report**
- Check `./test-results/validation-report-*.md`
- Verify all 7 phases passed
- Review any warnings or performance anomalies

**4. Success Criteria**
```
✓ All 103 integration tests pass
✓ API endpoints responding correctly
✓ Performance metrics within targets
✓ No data consistency issues
✓ Monitoring systems operational
```

**If Validation Fails**:
- Review test-results/test-execution-*.log
- Check application error logs
- Refer to INTEGRATION_TESTING_GUIDE.md troubleshooting section
- Contact team leads if blockers persist

---

## 🔧 PHASE 2: DLT Configuration Setup (45-60 minutes)

### Objective
Configure DLT Docker services with Aurigraph API integration on production server.

### Prerequisites
- [ ] Production server SSH access confirmed
- [ ] Aurigraph API credentials obtained and validated
- [ ] Backup of existing .env files created
- [ ] Service downtime window scheduled (if needed)

### Steps

**1. Obtain Aurigraph API Credentials**
- Login to https://dashboard.aurigraph.io
- Navigate to Settings → API Keys
- Click "Generate New Key" (Production environment)
- Copy Key and Secret
- Store securely (password manager recommended)

**Required Credentials**:
```
DLT_API_KEY=<your-api-key>
DLT_API_SECRET=<your-api-secret>
DLT_API_BASE_URL=https://api.aurigraph.io
```

**2. Deploy setup script to production server**
```bash
scp scripts/setup-dlt-configuration.sh subbu@hms.aurex.in:/opt/HMS/
```

**3. SSH to production server**
```bash
ssh subbu@hms.aurex.in
cd /opt/HMS
```

**4. Run DLT configuration setup script**
```bash
sudo chmod +x ./setup-dlt-configuration.sh
sudo ./setup-dlt-configuration.sh
```

**5. When prompted, enter credentials**
- DLT API Key
- DLT API Secret
- Confirmation prompts

**Expected Output**:
```
[✓] Prerequisites verified
[✓] Directory structure created
[✓] .env.dlt file generated
[✓] Database connection tested
[✓] API endpoint validated
[✓] Service health verified
[✓] Configuration backup created
[✓] Setup complete - services operational
```

**6. Verify configuration**
```bash
docker ps
docker logs -f dlt-service  # Monitor for errors
```

**7. Health Check**
```bash
curl -X GET http://localhost:3000/health
# Expected: {"status": "ok", "services": {...}}
```

**If Setup Fails**:
- Check logs: `cat /opt/HMS/dlt/backups/setup-*.log`
- Review DLT_DOCKER_CONFIGURATION_GUIDE.md troubleshooting section
- Ensure Aurigraph API credentials are correct
- Verify network connectivity to api.aurigraph.io

---

## 👥 PHASE 3: Team Training Rollout (60-115 minutes)

### Objective
Equip team members with knowledge to use new testing tools and features.

### Training Materials Available
- **TEAM_TRAINING_PACKAGE.md** - Comprehensive training content (1,500+ lines)
- **TRAINING_IMPLEMENTATION_GUIDE.md** - Guidance for trainers (800+ lines)
- **Run-Tests Skill Guide** - Detailed feature walkthrough

### Two Training Approaches

#### Option A: Synchronous Training (1 hour)
**Best for**: Immediate knowledge transfer with Q&A

**Agenda**:
- 5 min: Welcome & overview
- 15 min: Quick Start Guide
- 20 min: Run-Tests Skill in-depth
- 10 min: Live demo & Q&A
- 10 min: Assignment & next steps

**Steps**:
1. Schedule team meeting (30-min notice minimum)
2. Share TEAM_TRAINING_PACKAGE.md with team
3. Conduct training session (screen share recommended)
4. Record session for asynchronous viewers
5. Provide troubleshooting reference (Troubleshooting Guide section)
6. Assign hands-on exercise (Hands-on Exercise in training package)

#### Option B: Self-Paced Learning (3 hours over 1 week)
**Best for**: Remote teams, async work schedules

**Steps**:
1. Email TEAM_TRAINING_PACKAGE.md to team
2. Share training schedule (suggested: 30 min/day for 3 days)
3. Provide weekly check-in meeting (30 min) to discuss progress
4. Collect feedback on training materials
5. Provide one-on-one support as needed

#### Option C: Hybrid (Recommended)
**Best for**: Maximum learning retention

**Steps**:
1. Self-paced learning first (30 min Quick Start)
2. Synchronous training session (60 min)
3. Hands-on practice (1-2 hours)
4. Follow-up Q&A session (30 min)

### Training Checklist
- [ ] Training materials distributed to team
- [ ] Team members confirm receipt
- [ ] Training session scheduled (or self-paced timeline confirmed)
- [ ] Trainer assigned (for synchronous approach)
- [ ] Recording equipment ready (if recording)
- [ ] Hands-on exercise prepared
- [ ] Support contact info shared
- [ ] Feedback collection plan in place

### Post-Training
- [ ] Collect feedback via brief survey
- [ ] Identify team members needing additional support
- [ ] Schedule follow-up Q&A session (1 week)
- [ ] Celebrate team completion!

---

## 📊 PHASE 4: Post-Deployment Verification (15-30 minutes)

### Objective
Confirm all deployments are functioning correctly in production.

### Verification Steps

**1. Run-Tests Skill Verification**
```bash
cd /opt/HMS
npm test -- run-tests  # If configured
# Or use skill directly in Claude Code
```

**Verify**:
- [ ] Multi-framework support working
- [ ] Test output parsing correct
- [ ] Flaky test detection operational
- [ ] Coverage analysis accurate

**2. DLT Configuration Verification**
```bash
# Check service status
docker ps | grep dlt
docker exec dlt-service curl http://localhost:3000/health

# Check logs for errors
docker logs dlt-service | tail -20
```

**Verify**:
- [ ] DLT service running
- [ ] API endpoints responding
- [ ] Database connections working
- [ ] No error messages in logs

**3. Integration Tests Verification**
```bash
npm test -- integration  # If configured
# Or run specific integration tests
```

**Verify**:
- [ ] All 103 integration tests pass
- [ ] Coverage metrics at/above targets
- [ ] Execution time within SLA (51 seconds)

**4. Monitoring Setup**
- [ ] Prometheus scraping DLT metrics
- [ ] Grafana dashboards updated
- [ ] Alerting rules configured (if applicable)
- [ ] Logs being collected (ELK/similar)

**5. Documentation Accessibility**
- [ ] TEAM_TRAINING_PACKAGE.md accessible to team
- [ ] DLT_DOCKER_CONFIGURATION_GUIDE.md in wiki/docs
- [ ] Integration test guides available
- [ ] Troubleshooting docs linked from main README

---

## 🐛 Troubleshooting Guide

### DLT Configuration Issues

**Problem**: API credentials rejected
```
Error: "Invalid API credentials"
Solution:
1. Verify credentials in dashboard.aurigraph.io
2. Confirm credentials haven't been rotated
3. Check for extra whitespace in .env.dlt
4. Regenerate credentials if needed
5. Restart DLT service: docker restart dlt-service
```

**Problem**: Network connectivity to Aurigraph API
```
Error: "Cannot reach api.aurigraph.io"
Solution:
1. Check firewall rules allow outbound HTTPS (443)
2. Test curl: curl https://api.aurigraph.io/health
3. Verify DNS resolution: nslookup api.aurigraph.io
4. Check proxy settings if behind corporate proxy
5. Temporarily disable firewall to test (security team approval)
```

**Problem**: Database connection fails
```
Error: "PostgreSQL connection refused"
Solution:
1. Check PostgreSQL running: docker ps | grep postgres
2. Verify PostgreSQL credentials in .env.dlt
3. Test connection: psql -h localhost -U postgres
4. Check disk space: df -h
5. Review PostgreSQL logs: docker logs postgres
```

### Integration Test Failures

**Problem**: Some tests fail intermittently
```
Solution: Use flaky test detection feature in run-tests skill
1. Run: npm test -- --flaky-detection
2. Review retry statistics
3. Identify flaky test patterns
4. Run failed tests in isolation
5. Debug based on test logs
```

**Problem**: Performance tests timeout
```
Error: "Test execution exceeded SLA"
Solution:
1. Check system load: top, htop
2. Review resource usage in Prometheus
3. Optimize slow endpoints
4. Increase timeout values if justified
5. Investigate database query performance
```

### Team Training Issues

**Problem**: Team members confused about run-tests skill
```
Solution:
1. Share "Run-Tests Skill Guide" section from TEAM_TRAINING_PACKAGE.md
2. Provide code examples
3. Schedule one-on-one training
4. Create video walkthrough (if needed)
5. Add to team FAQ
```

---

## 📅 Deployment Schedule (Recommended)

### Day 1: Preparation
- [ ] Review all documentation
- [ ] Verify infrastructure prerequisites
- [ ] Obtain Aurigraph API credentials
- [ ] Brief team on upcoming changes

### Day 2: Staging Validation
- [ ] Run validation script on staging
- [ ] Address any issues found
- [ ] Document results
- [ ] Obtain stakeholder approval

### Day 3: Production Deployment
- [ ] Deploy DLT configuration
- [ ] Run post-deployment verification
- [ ] Update monitoring dashboards
- [ ] Notify team of changes

### Day 4: Team Training
- [ ] Conduct training session (or begin self-paced)
- [ ] Provide hands-on exercises
- [ ] Collect initial feedback
- [ ] Plan follow-up Q&A

### Week 2: Monitoring & Support
- [ ] Monitor error rates and metrics
- [ ] Provide training follow-up support
- [ ] Collect team feedback
- [ ] Plan Phase 2 enhancements

---

## 📞 Support & Escalation

### First-Line Support
- Review TEAM_TRAINING_PACKAGE.md Troubleshooting Guide
- Check integration test logs
- Consult DLT_DOCKER_CONFIGURATION_GUIDE.md

### Second-Line Support
- Review run-tests skill documentation
- Check application logs and metrics
- Analyze performance metrics in Prometheus

### Escalation
- Contact: [Team Lead]
- For infrastructure: [DevOps Lead]
- For testing framework: [QA Lead]
- For training: [Training Lead]

---

## 🎯 Success Metrics

### Deployment Success
- [ ] 100% of integration tests pass
- [ ] DLT service operational and healthy
- [ ] All API endpoints responding correctly
- [ ] No critical errors in logs

### Team Adoption
- [ ] 80%+ of team completes training
- [ ] Team using run-tests skill in daily workflow
- [ ] 0 production issues from new features (Week 1)
- [ ] Positive feedback on training materials

### Quality Metrics
- [ ] Code coverage maintained at 92%+
- [ ] Integration test execution time < 1 minute
- [ ] Zero flaky tests detected
- [ ] DLT service uptime > 99.9%

---

## 📝 Deployment Sign-Off

**Deployment Conducted By**: ___________________
**Date**: ___________________
**Staging Validation**: ✓ Pass / ✗ Fail
**DLT Configuration**: ✓ Complete / ✗ Incomplete
**Team Training**: ✓ Completed / ✗ In Progress
**Post-Deployment Verification**: ✓ Pass / ✗ Fail

**Notes**:
```
_____________________________________________________
_____________________________________________________
```

**Approved By**: ___________________
**Date**: ___________________

---

## 📚 Reference Documents

- **TEAM_TRAINING_PACKAGE.md** - Training content
- **TRAINING_IMPLEMENTATION_GUIDE.md** - Trainer guide
- **DLT_DOCKER_CONFIGURATION_GUIDE.md** - Configuration steps
- **INTEGRATION_TESTING_GUIDE.md** - Integration testing
- **INTEGRATION_TEST_SUMMARY.md** - Test overview
- **SESSION_COMPLETE_SUMMARY.md** - Session deliverables

---

**Generated**: October 31, 2025
**Status**: Ready for Production Deployment
**Version**: 1.0
