# J4C Agent Plugin - Deployment Package

**Version**: 1.0.0
**Build Date**: October 27, 2025
**Deployment Type**: Production Ready
**Target Server**: dev.aurigraph.io (Port 2224)

---

## Package Contents

### Core Files
- `j4c-agent.config.json` - J4C Agent configuration
- `j4c-cli.js` - CLI interface
- `index.js` - Plugin main entry point
- `hubspot-integration.js` - HubSpot CRM integration
- `hubspot.config.json` - HubSpot configuration
- `J4C_AGENT_PLUGIN.md` - Plugin documentation
- `HUBSPOT_INTEGRATION.md` - HubSpot integration guide
- `package.json` - Node.js dependencies

### Configuration Files
- `config.json` - Main plugin config
- `deployment.config.json` - Deployment settings
- `slack.config.json` - Slack integration
- `jeeves4coder.config.json` - J4C configuration

### Documentation
- `J4C_AGENT_PLUGIN_RELEASE_NOTES.md` - Release information
- `BUILD.md` - Build instructions
- `DEPLOYMENT_GUIDE.md` - Deployment guide

### Scripts
- `scripts/validate-plugin.js` - Validation script
- `scripts/distribute.js` - Distribution script
- `scripts/post-install.js` - Post-install setup

---

## Deployment Steps

### 1. Prepare Local Package

```bash
cd /Users/subbujois/subbuworkingdir/Aurex/glowing-adventure/plugin
npm install
npm run validate
```

### 2. Create Distribution Archive

```bash
# Package all files
tar -czf j4c-agent-plugin-1.0.0.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.github \
  .

# Verify package
tar -tzf j4c-agent-plugin-1.0.0.tar.gz | head -20
```

### 3. Deploy to Remote Server

```bash
# Transfer package
scp -P 2224 j4c-agent-plugin-1.0.0.tar.gz yogesh@dev.aurigraph.io:/tmp/

# Extract on remote
ssh -p 2224 yogesh@dev.aurigraph.io "cd /opt && sudo tar -xzf /tmp/j4c-agent-plugin-1.0.0.tar.gz -C /opt/j4c-agent"

# Install dependencies
ssh -p 2224 yogesh@dev.aurigraph.io "cd /opt/j4c-agent && npm install --production"
```

### 4. Configure Environment

Create `.env` file on remote server:

```bash
# HubSpot Configuration
HUBSPOT_API_KEY=your_api_key
HUBSPOT_PORTAL_ID=your_portal_id

# Claude Code Integration
CLAUDE_CODE_API_URL=http://localhost:9000
CLAUDE_CODE_API_KEY=your_api_key

# Integrations
JIRA_URL=https://aurigraphdlt.atlassian.net
JIRA_API_KEY=your_api_key
GITHUB_TOKEN=your_token

# Notifications
SLACK_WEBHOOK_URL=your_webhook
NOTIFICATION_EMAIL=your_email@example.com
```

### 5. Setup Systemd Service

Create `/etc/systemd/system/j4c-agent.service`:

```ini
[Unit]
Description=J4C Agent Plugin Service
After=network.target

[Service]
Type=simple
User=yogesh
WorkingDirectory=/opt/j4c-agent
Environment="NODE_ENV=production"
EnvironmentFile=/opt/j4c-agent/.env
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=j4c-agent

[Install]
WantedBy=multi-user.target
```

### 6. Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable j4c-agent

# Start service
sudo systemctl start j4c-agent

# Check status
sudo systemctl status j4c-agent
```

### 7. Verify Deployment

```bash
# Check service status
sudo systemctl status j4c-agent

# View logs
sudo journalctl -u j4c-agent -f

# Test CLI
j4c agents list
j4c workflow list
j4c status
```

---

## File Structure (Remote)

```
/opt/j4c-agent/
├── index.js                    # Main entry point
├── j4c-cli.js                 # CLI interface
├── hubspot-integration.js      # HubSpot module
├── config.json                # Main config
├── j4c-agent.config.json      # Agent config
├── hubspot.config.json        # HubSpot config
├── package.json               # Dependencies
├── .env                       # Environment variables
├── node_modules/              # Dependencies
├── agents/                    # Agent definitions
├── skills/                    # Skill implementations
├── scripts/                   # Utility scripts
└── docs/                      # Documentation
```

---

## Environment Variables Required

```bash
# HubSpot
HUBSPOT_API_KEY
HUBSPOT_PORTAL_ID

# Claude Code
CLAUDE_CODE_API_URL
CLAUDE_CODE_API_KEY

# JIRA
JIRA_URL
JIRA_API_KEY

# GitHub
GITHUB_TOKEN

# Slack
SLACK_WEBHOOK_URL
SLACK_WEBHOOK_HUBSPOT

# Email
NOTIFICATION_EMAIL
HUBSPOT_FROM_EMAIL
```

---

## System Requirements

**Minimum**:
- Node.js 18.0.0+
- npm 9.0.0+
- 512MB RAM
- 100MB disk space

**Recommended**:
- Node.js 20+
- npm 10+
- 2GB RAM
- 1GB disk space

---

## Build & Validation

### Build Commands

```bash
# Install dependencies
npm install

# Run validation
npm run validate

# Run tests
npm test

# Run linting
npm run lint
```

### Validation Checklist

- ✅ Node.js version >= 18.0.0
- ✅ npm version >= 9.0.0
- ✅ All dependencies installed
- ✅ Configuration files present
- ✅ Plugin loads successfully
- ✅ Agents available (12)
- ✅ Skills available (80+)
- ✅ HubSpot module functional
- ✅ CLI commands accessible
- ✅ Environment variables set

---

## Testing on Remote

```bash
# Test agent list
j4c agents list

# Test workflow list
j4c workflow list

# Test single agent
j4c invoke dlt security-scanner "[Test code]"

# Test metrics
j4c metrics show

# Test HubSpot (if configured)
node -e "const HS = require('./hubspot-integration.js'); \
  const hs = new HS({ apiKey: process.env.HUBSPOT_API_KEY }); \
  hs.initialize().then(r => console.log(r));"
```

---

## Troubleshooting

### SSH Connection Issues
- Check firewall rules
- Verify port 2224 is open
- Ensure known_hosts has server key

### npm Install Fails
- Check internet connection
- Verify npm registry accessible
- Clear npm cache: `npm cache clean --force`

### Service Won't Start
- Check logs: `sudo journalctl -u j4c-agent -n 50`
- Verify .env file exists
- Check file permissions: `chmod +x /opt/j4c-agent/index.js`

### HubSpot Connection Fails
- Verify API key is valid
- Check HUBSPOT_API_KEY environment variable
- Test connection: `node hubspot-integration.js`

---

## Rollback Procedure

```bash
# Stop service
sudo systemctl stop j4c-agent

# Remove current version
sudo rm -rf /opt/j4c-agent

# Restore backup
sudo cp -r /opt/j4c-agent.backup /opt/j4c-agent

# Start service
sudo systemctl start j4c-agent
```

---

## Monitoring

### Health Check

```bash
# Check service status
sudo systemctl status j4c-agent

# Check logs for errors
sudo journalctl -u j4c-agent -p 3 --no-pager

# Monitor in real-time
sudo journalctl -u j4c-agent -f
```

### Metrics

Access metrics via CLI:

```bash
j4c metrics show
j4c metrics export --format=json
j4c metrics trend --agent=dlt-developer --days=7
```

---

## Maintenance

### Daily
- Monitor logs: `sudo journalctl -u j4c-agent -n 100`
- Check service status: `sudo systemctl status j4c-agent`

### Weekly
- Review metrics
- Check for updates
- Backup configuration

### Monthly
- Full backup
- Security scan
- Performance review

---

## Support

- **Documentation**: See J4C_AGENT_PLUGIN.md
- **Issues**: GitHub Issues
- **Email**: engineering@aurigraph.io
- **Slack**: #engineering

---

**Deployment Package v1.0.0**
**October 27, 2025**
**Ready for Production Deployment**

