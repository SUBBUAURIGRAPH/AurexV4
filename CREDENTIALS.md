# Credentials Management for Aurigraph Agent Architecture

**Repository**: glowing-adventure
**Version**: 2.0.1
**Last Updated**: October 20, 2025
**Contact**: subbu@aurigraph.io
**Classification**: 🔒 CONFIDENTIAL - Internal Use Only

---

## ⚠️ Security Notice

**DO NOT COMMIT ACTUAL CREDENTIALS TO THIS FILE**

This document serves as a template and reference guide. Actual credentials must be:
1. Stored in secure credential management systems (Vault, AWS Secrets Manager)
2. Referenced from environment variables
3. Never hardcoded in source code
4. Rotated regularly per security policy

---

## Global Credentials Reference

**Primary Credentials Location**: `/Users/subbujois/Documents/GitHub/Aurigraph-DLT/doc/Credentials.md`

This file contains centralized credentials for:
- JIRA/Atlassian API
- GitHub/Git configuration
- Remote server SSH access
- IAM/Keycloak credentials
- Service ports and endpoints
- API keys and tokens

**Usage**:
```bash
# Always reference global credentials first
source /Users/subbujois/Documents/GitHub/Aurigraph-DLT/doc/setup-credentials.sh
```

---

## Agent Architecture Specific Credentials

### 1. JIRA Integration (Project Manager Agent)

**Project**: Aurigraph Agent Architecture (AAE)
**Board**: https://aurigraphdlt.atlassian.net/jira/software/c/projects/AAE/boards/987

```bash
# Environment Variables (DO NOT commit actual values)
export JIRA_URL="https://aurigraphdlt.atlassian.net"
export JIRA_PROJECT_KEY="AAE"
export JIRA_BOARD_ID="987"
export JIRA_USER="sjoish12@gmail.com"
export JIRA_API_TOKEN="<GET-FROM-VAULT-OR-ENV>"  # NEVER hardcode the actual token
```

**🔒 SECURITY - How to Set JIRA API Token**:

**Option 1: Environment Variable (Recommended for Local Development)**
```bash
# Add to ~/.bashrc or ~/.zshrc (NOT committed to Git)
export JIRA_API_TOKEN="your-token-here"

# Or load from a secure file
source ~/.jira_credentials  # This file should be in .gitignore
```

**Option 2: HashiCorp Vault (Recommended for Production)**
```bash
# Store in Vault
vault kv put secret/jira api_token="your-token-here"

# Retrieve from Vault
export JIRA_API_TOKEN=$(vault kv get -field=api_token secret/jira)
```

**Option 3: Global Credentials File (Not Recommended - Use Vault Instead)**
```bash
# See: /Users/subbujois/Documents/GitHub/Aurigraph-DLT/doc/Credentials.md
# This file should NEVER be committed to Git
# This file should have restricted permissions: chmod 600
```

**⚠️ IMPORTANT SECURITY NOTES**:
- ✅ **DO**: Store in Vault, environment variables, or encrypted files
- ✅ **DO**: Add credential files to `.gitignore`
- ✅ **DO**: Use `chmod 600` for credential files (read/write for owner only)
- ✅ **DO**: Rotate tokens every 90 days
- ❌ **DON'T**: Hardcode tokens in source code
- ❌ **DON'T**: Commit tokens to Git
- ❌ **DON'T**: Share tokens in chat/email
- ❌ **DON'T**: Store in plain text documentation

**Creating a New JIRA API Token**:
1. Visit: https://aurigraphdlt.atlassian.net/
2. Click Profile → Account Settings
3. Security → API Tokens
4. Create New Token
5. Copy and store securely (you won't see it again!)
6. **NEVER** share or commit this token

**Permissions Required**:
- Create, edit, and delete issues
- Manage sprints
- View board
- Add comments
- Transition issues

**Usage in Skills**:
- `jira-sync`: Auto-sync Git commits to JIRA
- `sprint-planner`: Sprint management
- `backlog-manager`: Backlog prioritization
- `status-reporter`: Generate reports

---

### 2. GitHub Integration (All Developer Agents)

**Repository URLs**:
- HTTPS: `https://github.com/Aurigraph-DLT-Corp/glowing-adventure`
- SSH: `git@github.com:Aurigraph-DLT-Corp/glowing-adventure.git`

```bash
# Environment Variables
export GITHUB_TOKEN="<stored-in-vault>"  # Get from global Credentials.md
export GITHUB_REPO_OWNER="Aurigraph-DLT-Corp"
export GITHUB_REPO_NAME="glowing-adventure"
export GITHUB_REPO_SSH="git@github.com:Aurigraph-DLT-Corp/glowing-adventure.git"
export GITHUB_REPO_HTTPS="https://github.com/Aurigraph-DLT-Corp/glowing-adventure"
```

**Permissions Required**:
- Read/write repository
- Create pull requests
- Manage issues
- View workflows

**Usage in Skills**:
- All agents use for code repository access
- DevOps: CI/CD integration
- Project Manager: JIRA-GitHub sync

---

### 3. Remote Server Access (DevOps, SRE Agents)

**Aurex Development Server**:
```bash
export AUREX_SSH_HOST="dev.aurigraph.io"
export AUREX_SSH_PORT="2224"
export AUREX_SSH_USER="yogesh"
export AUREX_SSH_KEY_PATH="~/.ssh/aurigraph_deploy_key"
# Password: See global Credentials.md

# Connection command
ssh -p 2224 yogesh@dev.aurigraph.io
```

**Hermes/DLT Server**:
```bash
export DLT_SSH_HOST="dlt.aurigraph.io"
export DLT_SSH_PORT="2235"
export DLT_SSH_USER="subbu"
export DLT_SSH_KEY_PATH="~/.ssh/aurigraph_dlt_key"
# Password: See global Credentials.md

# Connection command
ssh -p 2235 subbu@dlt.aurigraph.io
```

**Service Ports**:
```bash
# HTTP/HTTPS
export AUREX_HTTP_PORT="80"
export AUREX_HTTPS_PORT="443"

# Application Ports
export DLT_SERVICE_PORT="9003"
```

**Usage in Skills**:
- `deploy-wizard`: Automated deployments
- `infra-provisioner`: Server provisioning
- `health-monitor`: Health check monitoring

---

### 4. Docker Registry (DevOps Agent)

```bash
# Docker Hub (if using public registry)
export DOCKER_HUB_USERNAME="aurigraph"
export DOCKER_HUB_TOKEN="<stored-in-vault>"

# Private Registry (if using)
export DOCKER_REGISTRY_URL="registry.aurigraph.io"
export DOCKER_REGISTRY_USERNAME="deploy-bot"
export DOCKER_REGISTRY_PASSWORD="<stored-in-vault>"
```

**Usage in Skills**:
- `docker-manager`: Build and push images
- `deploy-wizard`: Pull images for deployment

---

### 5. Database Credentials (Data Engineer, DevOps Agents)

**MongoDB**:
```bash
export MONGO_HOST="mongodb.aurigraph.io"
export MONGO_PORT="27017"
export MONGO_DATABASE="aurigraph_agents"
export MONGO_USERNAME="agent_user"
export MONGO_PASSWORD="<stored-in-vault>"
export MONGO_CONNECTION_STRING="mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}"
```

**Redis** (for caching):
```bash
export REDIS_HOST="redis.aurigraph.io"
export REDIS_PORT="6379"
export REDIS_PASSWORD="<stored-in-vault>"
export REDIS_DB="0"
```

**PostgreSQL** (if applicable):
```bash
export POSTGRES_HOST="postgres.aurigraph.io"
export POSTGRES_PORT="5432"
export POSTGRES_DATABASE="aurigraph_agents"
export POSTGRES_USERNAME="agent_user"
export POSTGRES_PASSWORD="<stored-in-vault>"
```

**Usage in Skills**:
- `data-pipeline-builder`: Data storage and retrieval
- `analytics-builder`: Query execution
- All agents: Session storage

---

### 6. Blockchain Credentials (DLT Developer Agent)

**Ethereum Networks**:
```bash
# Mainnet
export ETH_MAINNET_RPC="https://mainnet.infura.io/v3/<project-id>"
export ETH_MAINNET_PRIVATE_KEY="<stored-in-vault>"

# Goerli Testnet
export ETH_GOERLI_RPC="https://goerli.infura.io/v3/<project-id>"
export ETH_GOERLI_PRIVATE_KEY="<stored-in-vault>"

# Polygon
export POLYGON_MAINNET_RPC="https://polygon-rpc.com"
export POLYGON_MUMBAI_RPC="https://rpc-mumbai.maticvigil.com"
export POLYGON_PRIVATE_KEY="<stored-in-vault>"
```

**Infura/Alchemy**:
```bash
export INFURA_PROJECT_ID="<stored-in-vault>"
export INFURA_PROJECT_SECRET="<stored-in-vault>"
export ALCHEMY_API_KEY="<stored-in-vault>"
```

**Etherscan API** (for verification):
```bash
export ETHERSCAN_API_KEY="<stored-in-vault>"
export POLYGONSCAN_API_KEY="<stored-in-vault>"
```

**Usage in Skills**:
- `blockchain-deploy`: Deploy contracts
- `token-creator`: Create tokens
- `dlt-auditor`: Audit contracts
- `web3-integrator`: Web3 interactions

---

### 7. Exchange APIs (Trading Operations Agent)

**Supported Exchanges** (12+):

**Alpaca** (Stock Trading):
```bash
export ALPACA_API_KEY="<stored-in-vault>"
export ALPACA_API_SECRET="<stored-in-vault>"
export ALPACA_BASE_URL="https://paper-api.alpaca.markets"  # Paper trading
# export ALPACA_BASE_URL="https://api.alpaca.markets"  # Live trading
```

**Binance** (Crypto):
```bash
export BINANCE_API_KEY="<stored-in-vault>"
export BINANCE_API_SECRET="<stored-in-vault>"
export BINANCE_TESTNET="true"  # Set to false for mainnet
```

**Coinbase Pro**:
```bash
export COINBASE_API_KEY="<stored-in-vault>"
export COINBASE_API_SECRET="<stored-in-vault>"
export COINBASE_PASSPHRASE="<stored-in-vault>"
```

**Kraken**:
```bash
export KRAKEN_API_KEY="<stored-in-vault>"
export KRAKEN_API_SECRET="<stored-in-vault>"
```

**Additional Exchanges**:
- Bitfinex, Bitstamp, Gemini, Huobi, KuCoin, OKEx, FTX (if still supported), Bybit

**Usage in Skills**:
- `exchange-connector`: Connect to exchanges
- `strategy-builder`: Execute strategies
- `backtest-manager`: Historical data
- `order-executor`: Place orders
- `market-scanner`: Market data

---

### 8. Monitoring & Observability (DevOps, SRE Agents)

**Prometheus**:
```bash
export PROMETHEUS_URL="http://prometheus.aurigraph.io:9090"
export PROMETHEUS_BEARER_TOKEN="<stored-in-vault>"
```

**Grafana**:
```bash
export GRAFANA_URL="https://grafana.aurigraph.io"
export GRAFANA_API_KEY="<stored-in-vault>"
export GRAFANA_ORG_ID="1"
```

**ELK Stack** (Elasticsearch, Logstash, Kibana):
```bash
export ELASTICSEARCH_URL="https://elasticsearch.aurigraph.io:9200"
export ELASTICSEARCH_USERNAME="elastic"
export ELASTICSEARCH_PASSWORD="<stored-in-vault>"

export KIBANA_URL="https://kibana.aurigraph.io:5601"
```

**Usage in Skills**:
- `health-monitor`: Health checks
- `log-aggregator`: Log collection
- `slo-tracker`: SLO monitoring
- `performance-profiler`: Performance metrics

---

### 9. Security & Compliance (Security Agent)

**Vault** (HashiCorp Vault):
```bash
export VAULT_ADDR="https://vault.aurigraph.io:8200"
export VAULT_TOKEN="<stored-in-vault>"
export VAULT_NAMESPACE="aurigraph-agents"
```

**Security Scanning Tools**:
```bash
# Snyk
export SNYK_TOKEN="<stored-in-vault>"

# npm audit (no credentials needed)

# OWASP Dependency Check
export NVD_API_KEY="<stored-in-vault>"  # For faster scanning
```

**Compliance APIs**:
```bash
# SEC EDGAR API (if needed)
export SEC_API_KEY="<stored-in-vault>"
```

**Usage in Skills**:
- `security-scanner`: Vulnerability scanning
- `credential-rotator`: Rotate secrets
- `compliance-checker`: Compliance validation
- `audit-logger`: Audit trail logging

---

### 10. Marketing & Communication (Digital Marketing Agent)

**Email Marketing**:
```bash
# SendGrid
export SENDGRID_API_KEY="<stored-in-vault>"
export SENDGRID_FROM_EMAIL="agents@aurigraph.io"

# Mailchimp
export MAILCHIMP_API_KEY="<stored-in-vault>"
export MAILCHIMP_SERVER_PREFIX="us6"  # e.g., us6
export MAILCHIMP_LIST_ID="<stored-in-vault>"
```

**Social Media**:
```bash
# Twitter/X API
export TWITTER_API_KEY="<stored-in-vault>"
export TWITTER_API_SECRET="<stored-in-vault>"
export TWITTER_ACCESS_TOKEN="<stored-in-vault>"
export TWITTER_ACCESS_TOKEN_SECRET="<stored-in-vault>"

# LinkedIn
export LINKEDIN_ACCESS_TOKEN="<stored-in-vault>"
```

**Analytics**:
```bash
# Google Analytics
export GOOGLE_ANALYTICS_TRACKING_ID="UA-XXXXXXXXX-X"
export GOOGLE_ANALYTICS_API_KEY="<stored-in-vault>"

# Mixpanel
export MIXPANEL_TOKEN="<stored-in-vault>"
```

**SEO Tools**:
```bash
# Ahrefs
export AHREFS_API_KEY="<stored-in-vault>"

# SEMrush
export SEMRUSH_API_KEY="<stored-in-vault>"
```

**Usage in Skills**:
- `campaign-orchestrator`: Multi-channel campaigns
- `email-campaign-builder`: Email marketing
- `social-media-manager`: Social posts
- `seo-optimizer`: SEO optimization
- `engagement-analyzer`: Analytics

---

### 11. HR & Onboarding (Employee Onboarding Agent)

**HRIS**:
```bash
# BambooHR
export BAMBOOHR_API_KEY="<stored-in-vault>"
export BAMBOOHR_SUBDOMAIN="aurigraph"

# Workday (if applicable)
export WORKDAY_USERNAME="<stored-in-vault>"
export WORKDAY_PASSWORD="<stored-in-vault>"
export WORKDAY_TENANT="aurigraph"
```

**E-Signature**:
```bash
# DocuSign
export DOCUSIGN_INTEGRATION_KEY="<stored-in-vault>"
export DOCUSIGN_USER_ID="<stored-in-vault>"
export DOCUSIGN_ACCOUNT_ID="<stored-in-vault>"
export DOCUSIGN_PRIVATE_KEY_PATH="~/.ssh/docusign_private.key"

# HelloSign
export HELLOSIGN_API_KEY="<stored-in-vault>"
```

**Learning Management**:
```bash
# LMS Platform
export LMS_API_KEY="<stored-in-vault>"
export LMS_ORGANIZATION_ID="aurigraph"
```

**Usage in Skills**:
- `onboarding-orchestrator`: Onboarding workflow
- `document-collector`: Document e-signatures
- `training-coordinator`: Training tracking
- `compliance-tracker`: Compliance documents

---

### 12. Notification Services (All Agents)

**Slack**:
```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"
export SLACK_BOT_TOKEN="xoxb-<stored-in-vault>"
export SLACK_CHANNEL_AGENTS="#claude-agents"
export SLACK_CHANNEL_DEPLOYMENTS="#deployments"
export SLACK_CHANNEL_ALERTS="#alerts"
```

**Email (SMTP)**:
```bash
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USERNAME="agents@aurigraph.io"
export SMTP_PASSWORD="<stored-in-vault>"
export SMTP_FROM_EMAIL="agents@aurigraph.io"
```

**Twilio** (SMS, if needed):
```bash
export TWILIO_ACCOUNT_SID="<stored-in-vault>"
export TWILIO_AUTH_TOKEN="<stored-in-vault>"
export TWILIO_PHONE_NUMBER="+1XXXXXXXXXX"
```

**Usage**:
- All agents use for notifications
- Deploy success/failure alerts
- Security incident notifications
- Marketing campaign notifications

---

## Environment-Specific Credentials

### Development Environment
```bash
export ENVIRONMENT="development"
export DEBUG_MODE="true"
export LOG_LEVEL="debug"

# Use development/sandbox credentials
# Reference: dev-credentials.env (not committed)
```

### Staging Environment
```bash
export ENVIRONMENT="staging"
export DEBUG_MODE="false"
export LOG_LEVEL="info"

# Use staging credentials
# Reference: staging-credentials.env (not committed)
```

### Production Environment
```bash
export ENVIRONMENT="production"
export DEBUG_MODE="false"
export LOG_LEVEL="warning"

# Use production credentials with restricted access
# Reference: prod-credentials.env (not committed)
# Requires additional authentication (MFA)
```

---

## Credential Management Best Practices

### 1. Storage
- ✅ Use HashiCorp Vault, AWS Secrets Manager, or Azure Key Vault
- ✅ Use environment variables
- ✅ Use encrypted configuration files (git-crypt, sops)
- ❌ Never hardcode in source code
- ❌ Never commit to Git

### 2. Access Control
- ✅ Principle of least privilege
- ✅ Role-based access control (RBAC)
- ✅ MFA for production credentials
- ✅ Audit access logs regularly

### 3. Rotation
- ✅ API keys: Rotate every 90 days
- ✅ Passwords: Rotate every 60 days
- ✅ SSH keys: Rotate annually
- ✅ Database credentials: Rotate quarterly
- ✅ Automate rotation with `credential-rotator` skill

### 4. Monitoring
- ✅ Monitor credential usage
- ✅ Alert on suspicious access patterns
- ✅ Track credential expiration
- ✅ Log all credential access (audit trail)

### 5. Incident Response
- If credentials compromised:
  1. Immediately revoke compromised credentials
  2. Generate new credentials
  3. Update all systems
  4. Investigate breach scope
  5. Document incident
  6. Review and improve security measures

---

## Credential Loading Scripts

### Local Development
```bash
#!/bin/bash
# load-dev-credentials.sh

# Load global credentials first
source /Users/subbujois/Documents/GitHub/Aurigraph-DLT/doc/setup-credentials.sh

# Load agent-specific credentials
export JIRA_PROJECT_KEY="AAE"
export JIRA_BOARD_ID="987"
# ... other agent credentials

echo "Development credentials loaded ✅"
```

### Staging
```bash
#!/bin/bash
# load-staging-credentials.sh

# Load from Vault
export VAULT_ADDR="https://vault.aurigraph.io:8200"
vault login -method=token token=$VAULT_TOKEN

# Fetch credentials from Vault
export JIRA_API_TOKEN=$(vault kv get -field=api_token secret/staging/jira)
export GITHUB_TOKEN=$(vault kv get -field=token secret/staging/github)
# ... other credentials

echo "Staging credentials loaded from Vault ✅"
```

### Production
```bash
#!/bin/bash
# load-prod-credentials.sh

# Requires MFA
echo "Production credential loading requires MFA"
vault login -method=okta username=$USER

# Fetch production credentials
export JIRA_API_TOKEN=$(vault kv get -field=api_token secret/production/jira)
# ... other credentials with time-limited leases

echo "Production credentials loaded (time-limited) ✅"
```

---

## Agent-Specific Credential Requirements

| Agent | Required Credentials | Optional Credentials |
|-------|---------------------|---------------------|
| **DLT Developer** | Infura/Alchemy, Etherscan | Polygon, Arbitrum |
| **Trading Operations** | Exchange APIs (Alpaca, Binance) | Additional exchanges |
| **DevOps Engineer** | SSH keys, Docker Registry, JIRA | Kubernetes, Terraform Cloud |
| **QA Engineer** | Git, JIRA | Security scanning tools |
| **Project Manager** | JIRA, GitHub | Confluence, Slack |
| **Security & Compliance** | Vault, Security tools (Snyk) | Compliance APIs |
| **Data Engineer** | MongoDB, Redis, PostgreSQL | Cloud storage (S3) |
| **Frontend Developer** | Git, npm | CDN credentials |
| **SRE/Reliability** | Prometheus, Grafana, SSH | PagerDuty, Datadog |
| **Digital Marketing** | SendGrid, Social APIs | SEO tools, Ad platforms |
| **Employee Onboarding** | BambooHR, DocuSign | LMS platforms |

---

## Quick Reference Commands

```bash
# Load all credentials for development
source load-dev-credentials.sh

# Verify credentials loaded
env | grep -E "JIRA|GITHUB|SSH" | sed 's/=.*/=***/'  # Hide values

# Test JIRA connection
curl -u $JIRA_USER:$JIRA_API_TOKEN \
  -H "Content-Type: application/json" \
  $JIRA_URL/rest/api/2/myself

# Test GitHub connection
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/user

# Test SSH connection
ssh -p $AUREX_SSH_PORT $AUREX_SSH_USER@$AUREX_SSH_HOST "echo 'SSH connection successful'"

# Rotate credential (example)
# @security-compliance "Rotate JIRA API token"
```

---

## Support

**Security Issues**: security@aurigraph.io (PGP key available)
**Credential Access Requests**: ops@aurigraph.io
**General Questions**: agents@aurigraph.io

**Office Hours**: Mon/Wed 10-12, Tue/Thu 2-4
**Slack**: #claude-agents, #security

---

## Related Documents

- **Global Credentials**: `/Users/subbujois/Documents/GitHub/Aurigraph-DLT/doc/Credentials.md`
- **Global Setup Script**: `/Users/subbujois/Documents/GitHub/Aurigraph-DLT/doc/setup-credentials.sh`
- **SPARC Framework**: [SPARC.md](SPARC.md)
- **Agent Documentation**: [agents/](agents/)
- **Security SOPs**: [docs/SOPS.md](docs/SOPS.md)

---

**Document Status**: ✅ Template Complete (Actual credentials in Vault)
**Last Updated**: October 20, 2025
**Classification**: 🔒 CONFIDENTIAL
**Version**: 1.0.0

**⚠️ REMEMBER**: Never commit actual credentials. Always use secure credential management systems.
