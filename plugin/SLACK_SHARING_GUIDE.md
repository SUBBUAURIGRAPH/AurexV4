# J4C Plugin - Slack Sharing & Notifications Guide

## Overview

The J4C plugin distribution system includes automated Slack notifications that keep the team informed about releases, distributions, and deployments across multiple channels.

## Slack Channels

The system is configured to notify across four key channels:

### 1. #aurigraph-announcements
- **Purpose**: Major announcements and official releases
- **Audience**: Entire organization
- **Frequency**: Release notifications
- **Content**: Release notes, major updates, new features

### 2. #aurigraph-agents
- **Purpose**: Team discussion and general updates
- **Audience**: Aurigraph agents/developers
- **Frequency**: Distribution updates, development news
- **Content**: Distribution status, updates, general announcements

### 3. #aurigraph-dev
- **Purpose**: Development and technical discussions
- **Audience**: Development team
- **Frequency**: Deployment notifications
- **Content**: Deployment status, technical updates, build notifications

### 4. #releases
- **Purpose**: Automated release notifications
- **Audience**: All interested parties
- **Frequency**: All release events
- **Content**: Release notes, downloads, installation instructions

## Notification Types

### 1. Distribution Notification

**Triggered When**: Plugin is distributed to all channels

**Message Includes**:
- Plugin name and version
- Distribution status
- All available distribution channels
- Installation methods
- Links to documentation, releases, and GitHub

**Channels**: #aurigraph-announcements, #aurigraph-agents, #releases

**Example**:
```
📦 J4C Plugin Distribution Complete

Plugin: @aurigraph/jeeves4coder-plugin
Version: v1.0.0
Status: ✅ Distributed
Date: 2024-10-23

Distribution Channels:
• npm Internal Registry (@aurigraph)
• GitHub Packages (@aurigraph-dlt-corp)
• GitHub Container Registry (ghcr.io)
• Internal Docker Registry
• GitHub Releases
• Direct Download

Installation Methods:
npm install @aurigraph/jeeves4coder-plugin
docker pull ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:1.0.0
```

### 2. Release Notification

**Triggered When**: New version is released

**Message Includes**:
- Release title and version
- Plugin description
- Key features
- Quick installation commands
- Links to documentation and support

**Channels**: #aurigraph-announcements, #releases

**Example**:
```
🚀 J4C Plugin v1.0.0 Released

@aurigraph/jeeves4coder-plugin released!

Key Features:
✅ Code review and analysis
✅ Refactoring suggestions
✅ Architecture review
✅ Performance optimization
✅ Security vulnerability auditing

Quick Installation:
npm install @aurigraph/jeeves4coder-plugin
docker pull ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:1.0.0
```

### 3. Deployment Notification

**Triggered When**: Plugin is deployed to an environment

**Message Includes**:
- Environment (dev, staging, prod)
- Plugin version
- Deployment status
- Timestamp and execution details

**Channels**: #aurigraph-dev, #releases

**Example**:
```
🔧 J4C Plugin Deployed to Production

Plugin: @aurigraph/jeeves4coder-plugin
Version: v1.0.0
Environment: Production
Status: ✅ Deployed

Deployment Details:
• Environment: production
• Version: 1.0.0
• Timestamp: 2024-10-23T10:30:00Z
• Status: Success
```

## Setting Up Slack Notifications

### Step 1: Create Incoming Webhook

For each channel, create an Incoming Webhook:

1. Go to https://api.slack.com/apps
2. Click "Create New App"
3. Choose "From scratch"
4. Name: "J4C Plugin Notifications"
5. Select workspace

### Step 2: Enable Incoming Webhooks

1. Click "Incoming Webhooks" in left sidebar
2. Toggle "On"
3. Click "Add New Webhook to Workspace"
4. Select channel and authorize

### Step 3: Configure Environment Variables

Store webhook URLs as environment variables:

```bash
export SLACK_WEBHOOK_ANNOUNCEMENTS="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
export SLACK_WEBHOOK_AGENTS="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
export SLACK_WEBHOOK_DEV="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
export SLACK_WEBHOOK_RELEASES="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

Or add to `.env`:
```
SLACK_WEBHOOK_ANNOUNCEMENTS=https://hooks.slack.com/services/...
SLACK_WEBHOOK_AGENTS=https://hooks.slack.com/services/...
SLACK_WEBHOOK_DEV=https://hooks.slack.com/services/...
SLACK_WEBHOOK_RELEASES=https://hooks.slack.com/services/...
```

### Step 4: Load Environment Variables

```bash
# Load from .env
export $(cat .env | xargs)

# Verify
echo $SLACK_WEBHOOK_ANNOUNCEMENTS
```

## Sending Notifications

### Automated Notifications

Notifications are automatically sent during:

1. **Distribution**:
   ```bash
   npm run distribute
   # Automatically sends distribution notification
   ```

2. **Deployment**:
   ```bash
   npm run deploy:prod
   # Automatically sends deployment notification
   ```

3. **Release**:
   ```bash
   npm run release
   # Automatically sends release notification
   ```

### Manual Notifications

Send notifications manually:

```bash
# Distribution notification
node scripts/slack-notify.js distribution

# Release notification
node scripts/slack-notify.js release

# Deployment notification (specify environment)
node scripts/slack-notify.js deployment prod
node scripts/slack-notify.js deployment staging
node scripts/slack-notify.js deployment dev
```

### With Environment Variables

```bash
SLACK_WEBHOOK_ANNOUNCEMENTS="..." \
SLACK_WEBHOOK_AGENTS="..." \
SLACK_WEBHOOK_DEV="..." \
SLACK_WEBHOOK_RELEASES="..." \
node scripts/slack-notify.js distribution
```

## Message Formatting

### Rich Message Features

- **Headers**: Large, bold section headers
- **Sections**: Formatted text with fields
- **Dividers**: Visual separation
- **Buttons**: Interactive links
- **Context**: Footer information

### Example Structure

```
┌─ Header: 📦 J4C Plugin Distribution Complete
├─ Section: Fields with plugin info
├─ Divider
├─ Section: Distribution channels
├─ Section: Installation methods
├─ Divider
├─ Actions: Clickable buttons
│  ├─ View Release
│  ├─ Documentation
│  └─ GitHub Packages
└─ Context: Footer with credits
```

## Customization

### Modify Message Templates

Edit `slack.config.json` to customize:

```json
{
  "slack": {
    "notifications": {
      "distribution": {
        "channels": ["announcements", "agents", "releases"],
        "mention": "@aurigraph-team",
        "emoji": "📦"
      }
    }
  }
}
```

### Change Channels

Update channel configuration:

```json
{
  "slack": {
    "channels": {
      "custom_channel": {
        "name": "#custom-channel",
        "webhookUrl": "${SLACK_WEBHOOK_CUSTOM}",
        "enabled": true
      }
    }
  }
}
```

### Create Custom Message

Edit `scripts/slack-notify.js` to add custom message templates:

```javascript
const createCustomMessage = (packageJson) => {
  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Your Custom Message*\nContent here'
        }
      }
    ]
  };
};
```

## Troubleshooting

### Webhook Not Sent

**Problem**: Message not appearing in Slack

**Solutions**:
1. Verify webhook URL is correct
2. Check environment variable is set: `echo $SLACK_WEBHOOK_ANNOUNCEMENTS`
3. Verify channel is correct
4. Check webhook is enabled in Slack

### Authentication Failed

**Problem**: 403 or 401 error

**Solutions**:
1. Regenerate webhook URL in Slack
2. Update environment variables
3. Verify token hasn't expired

### Rate Limiting

**Problem**: Too many requests

**Solutions**:
1. Add delays between notifications
2. Batch notifications
3. Reduce notification frequency

### Message Formatting Issues

**Problem**: Blocks not rendering correctly

**Solutions**:
1. Validate JSON structure
2. Check block types are valid
3. Verify field formatting

## Testing Notifications

### Test Distribution Notification

```bash
# Set up test webhook
export SLACK_WEBHOOK_ANNOUNCEMENTS="your-test-webhook"

# Send test notification
node scripts/slack-notify.js distribution
```

### Test Release Notification

```bash
node scripts/slack-notify.js release
```

### Test Deployment Notification

```bash
# Test production deployment notification
node scripts/slack-notify.js deployment prod

# Test staging deployment notification
node scripts/slack-notify.js deployment staging
```

## Monitoring Notifications

### Check Notification Status

View Slack message delivery:
1. Open Slack workspace
2. Check configured channels
3. Verify message appearance

### View Notification Logs

Notifications are logged to console:
```
[SUCCESS] Send distribution notification to #aurigraph-announcements ✓
[SUCCESS] Send distribution notification to #aurigraph-agents ✓
[SUCCESS] Send distribution notification to #releases ✓
```

### Enable Debug Logging

```bash
DEBUG=* node scripts/slack-notify.js distribution
```

## Best Practices

1. **Schedule Notifications**
   - Send during business hours
   - Avoid multiple notifications at once
   - Space out notifications (wait 30 seconds between channels)

2. **Mention Appropriately**
   - Use `@channel` for urgent announcements
   - Use `@here` for immediate attention
   - Use role mentions (`@dev-team`) for specific audiences

3. **Keep Messages Clear**
   - Use consistent formatting
   - Include actionable links
   - Provide clear next steps

4. **Monitor Delivery**
   - Check message appears in channels
   - Verify links work
   - Test buttons are clickable

5. **Maintain Configuration**
   - Keep webhook URLs secret
   - Rotate tokens periodically
   - Monitor webhook health

## Integration with CI/CD

### GitHub Actions Integration

Add to `.github/workflows/build-and-deploy.yml`:

```yaml
- name: Send Slack Notification
  if: success()
  run: |
    SLACK_WEBHOOK_ANNOUNCEMENTS=${{ secrets.SLACK_WEBHOOK_ANNOUNCEMENTS }} \
    SLACK_WEBHOOK_AGENTS=${{ secrets.SLACK_WEBHOOK_AGENTS }} \
    node scripts/slack-notify.js distribution
```

### Local Deployment Integration

Add to deploy script:

```bash
#!/bin/bash
npm run deploy:prod && \
SLACK_WEBHOOK_DEV=$SLACK_WEBHOOK_DEV \
node scripts/slack-notify.js deployment prod
```

## Support

For Slack notification issues:

- **Email**: agents@aurigraph.io
- **Slack**: Post in #aurigraph-agents
- **GitHub**: https://github.com/Aurigraph-DLT-Corp/glowing-adventure/issues

## Configuration Reference

| Setting | Value | Description |
|---------|-------|-------------|
| webhookUrl | URL | Slack incoming webhook |
| channels | Array | Target channels for notification |
| mention | String | User/group to mention (@team, @here, etc.) |
| emoji | String | Emoji for notification |
| enabled | Boolean | Enable/disable notifications |
| maxRetries | Number | Retry failed notifications |
| delayMs | Number | Delay between retries |

---

**Last Updated**: October 23, 2024
**Status**: Production Ready
**Version**: 1.0.0
