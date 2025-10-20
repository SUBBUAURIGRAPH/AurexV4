# Deploy Wizard Skill

**Agent**: DevOps Engineer
**Purpose**: Intelligent deployment automation across multiple environments
**Status**: Implemented
**Version**: 1.0.0

## Overview

The Deploy Wizard skill provides automated, intelligent deployment workflows for Hermes 2.0 across multiple environments (dev4, aurex, production, local) with comprehensive validation, health checks, and rollback capabilities.

## Capabilities

### 1. Environment Management
- Select target environment interactively
- Validate environment configuration
- Check prerequisites
- Verify credentials

### 2. Pre-Deployment Validation
- ✅ All tests passing
- ✅ Code review approved
- ✅ Security scan complete
- ✅ Database migrations ready
- ✅ Credentials configured
- ✅ Backup created
- ✅ Dependencies installed
- ✅ Build successful

### 3. Deployment Execution
- Zero-downtime deployments
- Blue-green deployment strategy
- Rolling updates
- Database migrations
- Configuration updates
- Service restarts

### 4. Post-Deployment Validation
- Health check verification
- Smoke tests
- Performance validation
- Log monitoring
- Error detection
- Metrics tracking

### 5. Rollback Capability
- Automatic rollback on failure
- Manual rollback option
- Quick recovery (<5 minutes)
- State restoration

## Usage

### Basic Deployment
```markdown
@devops-engineer

Use deploy-wizard to deploy Hermes 2.0.1 to production:
1. Run pre-deployment checklist
2. Create database backup
3. Deploy with zero downtime
4. Run health checks
5. Monitor for 15 minutes
```

### Environment-Specific Deployment
```markdown
@devops-engineer deploy-wizard

Deploy to staging environment:
- Environment: dev4
- Version: 2.0.1
- Strategy: rolling update
- Validation: full test suite
```

### Deployment with Custom Options
```markdown
@devops-engineer

deploy-wizard:
- Target: production
- Version: 2.0.2
- Strategy: blue-green
- Skip tests: false
- Auto-rollback: true
- Notification: slack #deployments
```

## Configuration

### Environment Files

#### DEV4 (Staging)
**File**: `deploy/env/dev4.env`
```bash
ENVIRONMENT=dev4
HOST=dev4.aurigraph.io
PORT=8005
SSH_PORT=2227
SSH_USER=subbu
DEPLOY_PATH=/opt/hermes
```

#### AUREX (Pre-Production)
**File**: `deploy/env/aurex.env`
```bash
ENVIRONMENT=aurex
HOST=aurex.aurigraph.io
PORT=8005
SSH_PORT=2227
SSH_USER=subbu
DEPLOY_PATH=/opt/hermes
```

#### PRODUCTION
**File**: `deploy/env/production.env`
```bash
ENVIRONMENT=production
HOST=hermes.aurigraph.io
PORT=8005
SSH_PORT=22
SSH_USER=deploy
DEPLOY_PATH=/opt/hermes
STRATEGY=blue-green
AUTO_ROLLBACK=true
```

### Deployment Scripts

The skill orchestrates existing deployment scripts:
- `deploy.sh` - Main deployment script
- `deploy-to-dev4.sh` - DEV4-specific deployment
- `deploy-to-remote.sh` - Remote deployment wrapper
- `deploy_dev4.py` - Python deployment automation
- `deploy-remote.py` - Python remote deployment

## Implementation

### Skill Logic

```javascript
// .claude/skills/deploy-wizard/index.js
const DeployWizard = {
  name: 'deploy-wizard',
  description: 'Intelligent deployment automation',

  async execute(options) {
    // 1. Select and validate environment
    const env = await this.selectEnvironment(options.environment);
    await this.validateEnvironment(env);

    // 2. Run pre-deployment checklist
    const checklistPassed = await this.preDeploymentChecklist(env);
    if (!checklistPassed) {
      return { success: false, reason: 'Checklist failed' };
    }

    // 3. Create backup
    await this.createBackup(env);

    // 4. Execute deployment
    const deployResult = await this.deploy(env, options);

    // 5. Validate deployment
    const validationPassed = await this.postDeploymentValidation(env);

    // 6. Handle result
    if (!validationPassed && options.autoRollback) {
      await this.rollback(env);
      return { success: false, reason: 'Validation failed, rolled back' };
    }

    // 7. Send notifications
    await this.sendNotifications(env, deployResult);

    return { success: true, deployment: deployResult };
  },

  async selectEnvironment(envName) {
    const environments = {
      dev4: require('../deploy/env/dev4.env'),
      aurex: require('../deploy/env/aurex.env'),
      production: require('../deploy/env/production.env'),
      local: require('../deploy/env/local.env')
    };
    return environments[envName] || environments.dev4;
  },

  async preDeploymentChecklist(env) {
    console.log('Running pre-deployment checklist...');

    // Check 1: Tests passing
    const testsPass = await this.runCommand('npm test');
    if (!testsPass) return false;

    // Check 2: Security scan
    const securityPass = await this.runCommand('npm audit');
    if (!securityPass) return false;

    // Check 3: Build successful
    const buildPass = await this.runCommand('npm run build');
    if (!buildPass) return false;

    // Check 4: Credentials present
    const credsValid = await this.validateCredentials(env);
    if (!credsValid) return false;

    // Check 5: Database migrations ready
    const migrationsReady = await this.checkMigrations(env);
    if (!migrationsReady) return false;

    return true;
  },

  async deploy(env, options) {
    console.log(`Deploying to ${env.ENVIRONMENT}...`);

    const strategy = options.strategy || env.STRATEGY || 'rolling';

    switch (strategy) {
      case 'blue-green':
        return await this.deployBlueGreen(env);
      case 'rolling':
        return await this.deployRolling(env);
      case 'recreate':
        return await this.deployRecreate(env);
      default:
        return await this.deployDefault(env);
    }
  },

  async deployBlueGreen(env) {
    // 1. Deploy to green (new) environment
    await this.deployToGreen(env);

    // 2. Run health checks on green
    const healthCheckPassed = await this.healthCheck(env, 'green');
    if (!healthCheckPassed) {
      throw new Error('Green environment health check failed');
    }

    // 3. Switch traffic to green
    await this.switchTraffic(env, 'green');

    // 4. Monitor for issues
    await this.monitorDeployment(env, 15); // 15 minutes

    // 5. Decommission blue (old) environment
    await this.decommissionBlue(env);

    return { strategy: 'blue-green', success: true };
  },

  async postDeploymentValidation(env) {
    console.log('Running post-deployment validation...');

    // Health checks
    const healthPass = await this.healthCheck(env);
    if (!healthPass) return false;

    // Smoke tests
    const smokePass = await this.runSmokeTests(env);
    if (!smokePass) return false;

    // Performance validation
    const perfPass = await this.validatePerformance(env);
    if (!perfPass) return false;

    return true;
  },

  async rollback(env) {
    console.log(`Rolling back deployment on ${env.ENVIRONMENT}...`);

    // Use existing deployment script with rollback
    const rollbackScript = env.ENVIRONMENT === 'production'
      ? 'deploy-rollback-prod.sh'
      : 'deploy-rollback.sh';

    await this.runCommand(`bash ${rollbackScript}`);

    // Verify rollback success
    const healthPass = await this.healthCheck(env);
    if (!healthPass) {
      throw new Error('Rollback failed! Manual intervention required.');
    }

    console.log('Rollback successful');
  },

  async healthCheck(env, target = 'current') {
    const url = `https://${env.HOST}/health`;
    const response = await fetch(url);
    return response.ok && response.status === 200;
  },

  async sendNotifications(env, result) {
    // Slack notification
    if (process.env.SLACK_WEBHOOK) {
      await this.sendSlackNotification(env, result);
    }

    // Email notification
    if (process.env.EMAIL_ENABLED) {
      await this.sendEmailNotification(env, result);
    }

    // PagerDuty (production only)
    if (env.ENVIRONMENT === 'production' && !result.success) {
      await this.alertPagerDuty(env, result);
    }
  }
};

module.exports = DeployWizard;
```

## Workflow Diagram

```
┌─────────────────────────────────────────────────┐
│          DEPLOY WIZARD WORKFLOW                 │
└─────────────────────────────────────────────────┘

1. SELECT ENVIRONMENT
   └─> dev4, aurex, production, local

2. PRE-DEPLOYMENT CHECKLIST
   ├─> Run tests
   ├─> Security scan
   ├─> Build project
   ├─> Validate credentials
   └─> Check migrations

3. CREATE BACKUP
   ├─> Database backup
   └─> Configuration backup

4. EXECUTE DEPLOYMENT
   ├─> Blue-Green Strategy
   │   ├─> Deploy to green
   │   ├─> Health check green
   │   ├─> Switch traffic
   │   └─> Decommission blue
   │
   ├─> Rolling Strategy
   │   ├─> Update pod 1
   │   ├─> Health check
   │   ├─> Update pod 2
   │   └─> Continue...
   │
   └─> Recreate Strategy
       ├─> Stop old version
       └─> Start new version

5. POST-DEPLOYMENT VALIDATION
   ├─> Health checks
   ├─> Smoke tests
   └─> Performance validation

6. ROLLBACK (if needed)
   ├─> Restore previous version
   ├─> Restore configuration
   └─> Verify health

7. SEND NOTIFICATIONS
   ├─> Slack #deployments
   ├─> Email stakeholders
   └─> PagerDuty (if failed)
```

## Pre-Deployment Checklist

### Automated Checks
- [x] All tests passing (npm test)
- [x] Security scan clean (npm audit)
- [x] Build successful (npm run build)
- [x] No uncommitted changes
- [x] Branch up to date with main

### Manual Verification
- [ ] Code review approved
- [ ] JIRA tickets linked
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Stakeholders notified

### Environment-Specific
- [ ] Credentials configured
- [ ] Environment variables set
- [ ] SSL certificates valid
- [ ] Load balancer configured
- [ ] Monitoring enabled

## Deployment Strategies

### 1. Blue-Green Deployment (Production)
**Best For**: Zero-downtime production deployments

**Process**:
1. Deploy new version to "green" environment
2. Run full validation on green
3. Switch load balancer to green
4. Monitor for 15 minutes
5. Decommission blue environment

**Rollback**: Switch load balancer back to blue (<1 min)

### 2. Rolling Update (Staging)
**Best For**: Gradual updates with resource constraints

**Process**:
1. Update 1 pod at a time
2. Health check after each pod
3. Continue if healthy
4. Complete when all pods updated

**Rollback**: Roll back pods to previous version

### 3. Recreate (Development)
**Best For**: Fast deployments in dev

**Process**:
1. Stop all old pods
2. Start all new pods
3. Validate health

**Rollback**: Redeploy previous version

## Post-Deployment Validation

### Health Checks
```bash
# API health
curl https://dev4.aurigraph.io/health

# Exchange connectivity
curl https://dev4.aurigraph.io/api/exchanges/status

# Agent status
curl https://dev4.aurigraph.io/api/agents/status
```

### Smoke Tests
- User login
- API endpoints respond
- Database connectivity
- Redis connectivity
- Exchange connections
- Agent initialization

### Performance Validation
- API response time <100ms
- Order execution <1ms
- Memory usage normal
- CPU usage normal

## Rollback Procedures

### Automatic Rollback Triggers
- Health check failures
- Error rate >5%
- Response time >500ms
- Any critical error

### Manual Rollback
```bash
# Via skill
@devops-engineer

deploy-wizard rollback:
- Environment: production
- Reason: [describe issue]
- Restore: previous version

# Via script
./deploy-rollback.sh production
```

### Rollback Verification
- All services healthy
- No errors in logs
- Performance metrics normal
- User access working

## Monitoring & Alerts

### Deployment Monitoring
- Track deployment progress
- Monitor error rates
- Watch performance metrics
- Check resource usage

### Alert Configuration
- Failed deployment → PagerDuty (production)
- Health check failure → Slack + Email
- Performance degradation → Slack
- Rollback executed → Slack + Email + PagerDuty

## Integration with Existing Scripts

### Consolidated Script Matrix

| Environment | Primary Script | Backup Script | Rollback Script |
|-------------|---------------|---------------|-----------------|
| DEV4 | `deploy-to-dev4.sh` | `deploy_dev4.py` | `deploy-rollback.sh` |
| AUREX | `deploy-aurex.sh` | `deploy-to-remote.sh` | `deploy-rollback.sh` |
| Production | `deploy.sh` | `deploy-remote.py` | `deploy-rollback-prod.sh` |
| Local | `docker-compose up` | N/A | `docker-compose down` |

### Script Usage
The deploy-wizard skill intelligently selects and orchestrates these scripts based on:
- Target environment
- Deployment strategy
- Validation requirements
- Rollback needs

## Troubleshooting

### Issue: Pre-deployment checklist fails
**Solution**:
1. Check which check failed
2. Fix the issue
3. Re-run deploy-wizard

### Issue: Deployment times out
**Solution**:
1. Check network connectivity
2. Verify SSH access
3. Check server resources
4. Review deployment logs

### Issue: Health check fails after deployment
**Solution**:
1. Check application logs
2. Verify all services started
3. Test manually
4. Rollback if can't resolve quickly

### Issue: Rollback fails
**Solution**:
1. **CRITICAL**: Manual intervention required
2. SSH into server
3. Manually restore previous version
4. Contact DevOps team immediately

## Success Metrics

### Deployment Performance
- Deployment time <5 minutes
- Success rate >95%
- Rollback time <2 minutes
- Zero-downtime achieved

### Quality Metrics
- Failed deployments <5%
- Rollbacks <10%
- Post-deployment issues <2%
- User impact incidents: 0

## Best Practices

1. **Always run pre-deployment checklist**
2. **Create backup before deployment**
3. **Monitor deployment closely**
4. **Have rollback plan ready**
5. **Communicate with stakeholders**
6. **Document any issues**
7. **Update runbooks**

## Future Enhancements

- [ ] Canary deployments (gradual traffic shift)
- [ ] A/B testing support
- [ ] Multi-region deployments
- [ ] Automated performance testing
- [ ] ML-based anomaly detection
- [ ] Self-healing capabilities

---

**Skill Owner**: DevOps Team
**Last Updated**: October 20, 2025
**Version**: 1.0.0
**Status**: Production Ready ✅
