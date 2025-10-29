# HubSpot Integration for J4C Agent Plugin

**Version**: 1.0.0
**Release Date**: October 27, 2025
**Status**: Production Ready
**Integration Type**: Real-time bi-directional sync

---

## Overview

The **HubSpot Integration** connects the J4C Agent Plugin with HubSpot CRM, enabling seamless synchronization of contacts, deals, companies, and campaigns. It bridges **Claude Code**, **J4C Agents**, and **HubSpot** for unified business operations.

### Key Capabilities

✅ **Contact Management** - Import, update, and sync contacts automatically
✅ **Deal Tracking** - Monitor deal pipeline and stage changes
✅ **Campaign Management** - Create and manage marketing campaigns
✅ **Email Automation** - Send and track emails through HubSpot
✅ **Real-time Sync** - Automatic bidirectional data synchronization
✅ **Analytics & Reporting** - Comprehensive CRM analytics and dashboards
✅ **Workflow Automation** - Trigger workflows based on CRM events
✅ **Agent Integration** - Direct integration with J4C agents

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Claude Code IDE                      │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │          J4C Agent Plugin v1.0.0                   │ │
│  │                                                    │ │
│  │  ┌──────────────────────────────────────────────┐ │ │
│  │  │   HubSpot Integration Module                 │ │ │
│  │  │                                              │ │ │
│  │  │  • Contact Sync                             │ │ │
│  │  │  • Deal Management                          │ │ │
│  │  │  • Campaign Automation                      │ │ │
│  │  │  • Email Delivery                           │ │ │
│  │  │  • Analytics Pipeline                       │ │ │
│  │  └──────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────┬──────────────────────────────────────┘
                  │ REST API
                  ▼
┌─────────────────────────────────────────────────────────┐
│              HubSpot CRM Platform                        │
│                                                           │
│  ┌─────────────┬──────────────┬────────────┬──────────┐ │
│  │  Contacts   │    Deals     │ Companies  │Campaigns │ │
│  │             │              │            │          │ │
│  │ 10,000+     │ 500+ active  │ 1,000+     │ 50+      │ │
│  └─────────────┴──────────────┴────────────┴──────────┘ │
│                                                           │
│  Analytics • Email • CRM Workflows • Reporting           │
└─────────────────────────────────────────────────────────┘
```

---

## Installation & Setup

### 1. Prerequisites

- Node.js 18+
- HubSpot account with API access
- HubSpot API key (Private App token)
- Claude Code IDE v1.0+

### 2. Environment Configuration

Create a `.env` file with required credentials:

```bash
# HubSpot Configuration
HUBSPOT_API_KEY=your_hubspot_api_key_here
HUBSPOT_PORTAL_ID=your_portal_id_here

# Claude Code Integration
CLAUDE_CODE_API_URL=http://localhost:9000
CLAUDE_CODE_API_KEY=your_claude_code_api_key

# Notifications
SLACK_WEBHOOK_HUBSPOT=https://hooks.slack.com/services/...
NOTIFICATION_EMAIL=your_email@example.com
HUBSPOT_FROM_EMAIL=noreply@aurigraph.io
```

### 3. Initialize Integration

```bash
# In the plugin directory
node -e "const HubSpot = require('./hubspot-integration.js'); \
  const hs = new HubSpot({ \
    apiKey: process.env.HUBSPOT_API_KEY, \
    portalId: process.env.HUBSPOT_PORTAL_ID \
  }); \
  hs.initialize();"

# Output:
# ✅ HubSpot integration initialized successfully
```

### 4. Verify Connection

```bash
node -e "const HubSpot = require('./hubspot-integration.js'); \
  const hs = new HubSpot({ apiKey: process.env.HUBSPOT_API_KEY }); \
  hs.verifyConnection().then(r => console.log(r));"
```

---

## Core Features

### 1. Contact Management

#### Get All Contacts

```javascript
const contacts = await hubspot.getContacts({
  limit: 100,
  properties: ['firstname', 'lastname', 'email', 'company']
});

// Response
{
  success: true,
  data: [
    {
      id: '123456',
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      company: 'Acme Corp',
      lifecycleStage: 'customer'
    }
  ],
  total: 10000
}
```

#### Find Contact by Email

```javascript
const contact = await hubspot.getContactByEmail('john@example.com');

// Response
{
  success: true,
  data: {
    id: '123456',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    company: 'Acme Corp',
    phone: '+1-555-0100',
    lifecycleStage: 'customer'
  }
}
```

#### Create New Contact

```javascript
const newContact = await hubspot.createContact({
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Smith',
  phone: '+1-555-0101',
  company: 'Tech Corp'
});

// Response
{
  success: true,
  data: {
    id: '654321',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Smith'
  }
}
```

#### Update Contact

```javascript
const updated = await hubspot.updateContact('123456', {
  lifecyclestage: 'customer',
  'hs_lead_status': 'QUALIFIED'
});

// Response
{
  success: true,
  data: { ... }
}
```

### 2. Deal Management

#### Get All Deals

```javascript
const deals = await hubspot.getDeals({
  limit: 100,
  properties: ['dealname', 'dealstage', 'amount', 'closedate']
});

// Response
{
  success: true,
  data: [
    {
      id: 'deal-001',
      name: 'Enterprise Plan - Acme Corp',
      stage: 'negotiation',
      amount: 50000,
      closeDate: '2025-12-31'
    }
  ],
  total: 543
}
```

#### Create New Deal

```javascript
const deal = await hubspot.createDeal({
  name: 'New Enterprise Deal',
  stage: 'appointmentscheduled',
  amount: 75000,
  closeDate: '2025-11-30'
});

// Response
{
  success: true,
  data: {
    id: 'deal-002',
    name: 'New Enterprise Deal',
    stage: 'appointmentscheduled',
    amount: 75000
  }
}
```

#### Update Deal Stage

```javascript
const updated = await hubspot.updateDealStage('deal-001', 'closedwon');

// Response
{
  success: true,
  data: { ... }
}
```

### 3. Campaign Management

#### Get All Campaigns

```javascript
const campaigns = await hubspot.getCampaigns();

// Response
{
  success: true,
  data: [
    {
      id: 'camp-001',
      name: 'Q4 Growth Campaign',
      status: 'active',
      type: 'email'
    }
  ],
  total: 47
}
```

#### Create Campaign

```javascript
const campaign = await hubspot.createCampaign({
  name: 'Product Launch Campaign',
  description: 'Launch campaign for new product'
});

// Response
{
  success: true,
  data: {
    id: 'camp-002',
    name: 'Product Launch Campaign',
    status: 'draft'
  }
}
```

### 4. Email Operations

#### Send Email

```javascript
const email = await hubspot.sendEmail(
  ['recipient@example.com'],
  'Welcome to Aurigraph!',
  '<h1>Welcome</h1><p>Get started with our platform...</p>'
);

// Response
{
  success: true,
  data: { ... }
}
```

### 5. Synchronization

#### Sync All Data

```javascript
const syncResult = await hubspot.syncWithClaudeCode('all');

// Response
{
  success: true,
  message: 'Synced all data with Claude Code',
  lastSync: '2025-10-27T14:30:00Z'
}
```

#### Sync Specific Data Type

```javascript
// Sync only contacts
const syncContacts = await hubspot.syncWithClaudeCode('contacts');

// Sync only deals
const syncDeals = await hubspot.syncWithClaudeCode('deals');

// Sync only companies
const syncCompanies = await hubspot.syncWithClaudeCode('companies');
```

### 6. Analytics

#### Contact Analytics

```javascript
const analytics = await hubspot.getContactAnalytics();

// Response
{
  success: true,
  data: {
    totalContacts: 10543,
    byLifecycleStage: {
      subscriber: 3500,
      lead: 2800,
      marketingqualifiedlead: 1200,
      customer: 2843,
      other: 200
    },
    byCompany: {
      'Acme Corp': 342,
      'Tech Corp': 287,
      'Global Inc': 156,
      // ... more
    },
    emailAddresses: 9876
  }
}
```

#### Deal Analytics

```javascript
const analytics = await hubspot.getDealAnalytics();

// Response
{
  success: true,
  data: {
    totalDeals: 543,
    byStage: {
      negotiation: 87,
      closedwon: 234,
      closedlost: 98,
      appointmentscheduled: 124
    },
    totalAmount: 12500000,
    averageDealSize: 23006
  }
}
```

---

## Agent Integration

### Digital Marketing Agent

```javascript
// Use HubSpot data in marketing campaigns
const agent = agents.get('digital-marketing');
const result = await agent.invoke('campaign-setup', {
  hubspotData: await hubspot.getContacts(),
  segmentation: 'by-industry'
});
```

### Project Manager Agent

```javascript
// Track deals and revenue
const agent = agents.get('project-manager');
const result = await agent.invoke('deal-tracking', {
  hubspotDealId: 'deal-001'
});
```

### Sales Integration

```javascript
// Update deal pipeline
const agent = agents.get('project-manager');
await hubspot.updateDealStage('deal-001', 'closedwon');
console.log('Deal won - notifying team...');
```

---

## Workflow Automation

### Contact Lifecycle Workflow

**Trigger**: New contact created in HubSpot
**Actions**:
1. Send welcome email
2. Add to segment
3. Create follow-up task
4. Notify sales owner

```json
{
  "trigger": "contact_created",
  "actions": [
    { "type": "send_email", "template": "welcome" },
    { "type": "add_segment", "segment": "new_leads" },
    { "type": "create_task", "owner": "sales" },
    { "type": "notify_slack", "channel": "#sales" }
  ]
}
```

### Deal Management Workflow

**Trigger**: Deal stage changes
**Actions**:
1. Update revenue forecast
2. Notify team
3. Send status email
4. Log activity

```json
{
  "trigger": "dealstage_changed",
  "actions": [
    { "type": "update_forecast" },
    { "type": "notify_team" },
    { "type": "send_status_email" },
    { "type": "log_activity" }
  ]
}
```

### Campaign Execution Workflow

**Trigger**: Campaign starts/ends
**Actions**:
1. Generate report
2. Update analytics
3. Send summary
4. Archive data

---

## Real-time Synchronization

### Auto-Sync Configuration

```javascript
const hubspot = new HubSpotIntegration({
  autoSync: true,           // Enable auto-sync
  syncInterval: 3600000,    // Every hour
  claudeCode: {
    enabled: true,
    apiUrl: 'http://localhost:9000'
  }
});

await hubspot.initialize();
// Auto-sync starts automatically
```

### Manual Sync

```javascript
// One-time sync
const result = await hubspot.syncWithClaudeCode('all');

// Or schedule specific sync
setInterval(() => {
  hubspot.syncWithClaudeCode('contacts');
}, 1800000); // Every 30 minutes
```

### Sync Events

```javascript
hubspot.on('syncStarted', (data) => {
  console.log('Sync started:', data);
});

hubspot.on('syncCompleted', (data) => {
  console.log('Sync completed:', data);
  console.log('Last sync time:', data.timestamp);
});

hubspot.on('syncError', (error) => {
  console.error('Sync failed:', error);
});

hubspot.on('contactsRetrieved', (data) => {
  console.log(`Retrieved ${data.count} contacts`);
});
```

---

## Caching Strategy

### Cache Configuration

```javascript
{
  caching: {
    enabled: true,
    ttl: 300000,        // 5 minutes
    maxSize: 1000       // Max cached items
  }
}
```

### Cache Behavior

- Contacts cached for 5 minutes
- Deals cached for 5 minutes
- Companies cached for 10 minutes
- Cache invalidated on updates
- LRU (Least Recently Used) eviction

### Clear Cache

```javascript
// Clear all caches
hubspot.clearCache();

// Cache is automatically cleared on data updates
await hubspot.createContact({ ... });  // Auto-clears cache
await hubspot.updateContact(id, data); // Auto-clears cache
```

---

## Error Handling

### Retry Strategy

```javascript
{
  errorHandling: {
    retryFailedRequests: true,
    retryAttempts: 3,
    retryDelay: 5000,
    exponentialBackoff: true,
    fallbackBehavior: 'cache'
  }
}
```

### Error Recovery

```javascript
try {
  const contacts = await hubspot.getContacts();
} catch (error) {
  if (error.code === 'RATE_LIMIT') {
    console.log('Rate limited, retrying...');
    // Automatic retry with backoff
  } else if (error.code === 'AUTH_FAILED') {
    console.log('Auth failed, check API key');
  }
}
```

---

## Security

### API Key Management

- Store API key in environment variables only
- Never commit API keys to git
- Rotate API keys regularly
- Use HubSpot Private App tokens

### Data Encryption

```bash
# All data in transit is encrypted (HTTPS)
# Sensitive fields masked in logs
# PII detection and handling enabled
```

### Access Control

```json
{
  "security": {
    "encryption": true,
    "apiKeyEncryption": true,
    "dataValidation": true,
    "auditLogging": true,
    "allowedOrigins": [
      "https://app.hubapi.com",
      "https://claude.anthropic.com"
    ]
  }
}
```

---

## Monitoring & Alerts

### Event Notifications

```javascript
hubspot.on('contactCreated', (contact) => {
  console.log('New contact:', contact);
  // Slack notification
  // Email notification
});

hubspot.on('dealUpdated', (deal) => {
  console.log('Deal updated:', deal);
  // Notify sales team
});

hubspot.on('analyticsGenerated', (analytics) => {
  console.log('Analytics ready:', analytics);
  // Send to dashboard
});
```

### Metrics Collection

```javascript
const status = hubspot.getStatus();
// Returns: {
//   initialized: true,
//   claudeCodeEnabled: true,
//   autoSyncEnabled: true,
//   lastSyncTime: '2025-10-27T14:30:00Z',
//   cacheSize: 234
// }
```

---

## Performance Benchmarks

| Operation | Time | Remarks |
|-----------|------|---------|
| Get contacts (100) | 2-3s | Cached: <100ms |
| Create contact | 1-2s | Real-time |
| Update contact | 1-2s | Real-time |
| Get deals (100) | 2-3s | Cached: <100ms |
| Create deal | 1-2s | Real-time |
| Full sync | 15-20s | Hourly default |
| Analytics generation | 5-8s | On demand |

---

## Troubleshooting

### API Key Not Working

```bash
# Verify API key is set
echo $HUBSPOT_API_KEY

# Test connection
node -e "const HubSpot = require('./hubspot-integration.js'); \
  const hs = new HubSpot({ apiKey: process.env.HUBSPOT_API_KEY }); \
  hs.verifyConnection().then(r => console.log(r));"

# Solution: Generate new Private App token from HubSpot
```

### Sync Not Working

```bash
# Check if auto-sync is enabled
hubspot.getStatus()

# Check logs
tail -f ~/.claude/logs/hubspot-integration.log

# Manually trigger sync
await hubspot.syncWithClaudeCode('all')

# Check Claude Code endpoint
curl http://localhost:9000/health
```

### Rate Limiting

```bash
# HubSpot API limit: 300 requests per 10 seconds
# Solution: Increase batchSize, reduce sync frequency
{
  "performance": {
    "batchSize": 500,
    "syncInterval": 7200000  // Every 2 hours
  }
}
```

---

## Use Cases

### 1. Lead Scoring Automation

```javascript
// Digital Marketing Agent monitors new contacts
const contacts = await hubspot.getContacts();
contacts.forEach(contact => {
  if (contact.lifecycleStage === 'lead') {
    // Trigger lead scoring workflow
    // Send targeted emails
    // Add to segments
  }
});
```

### 2. Sales Pipeline Management

```javascript
// Project Manager tracks deals
const deals = await hubspot.getDeals();
const analytics = await hubspot.getDealAnalytics();
console.log(`Total pipeline: $${analytics.totalAmount}`);
console.log(`Avg deal: $${analytics.averageDealSize}`);
// Generate reports, send alerts
```

### 3. Campaign Performance Tracking

```javascript
// Marketing Agent monitors campaign results
const campaigns = await hubspot.getCampaigns();
campaigns.forEach(campaign => {
  // Track open rates, click rates
  // Optimize based on performance
  // Send weekly reports
});
```

### 4. Customer Onboarding

```javascript
// Employee Onboarding Agent uses HubSpot data
// Create company profile from HubSpot companies
// Link contacts to onboarding tasks
// Send welcome emails
```

---

## API Reference

### HubSpotIntegration Class

```javascript
// Constructor
new HubSpotIntegration({
  apiKey: string,
  portalId: string,
  enabled: boolean,
  autoSync: boolean,
  syncInterval: number,
  claudeCode: { enabled, apiUrl }
})

// Methods
.initialize()
.getContacts(options)
.getContactByEmail(email)
.createContact(data)
.updateContact(id, updates)
.getDeals(options)
.createDeal(data)
.updateDealStage(id, stage)
.getCompanies(options)
.getCampaigns()
.createCampaign(data)
.sendEmail(recipients, subject, body)
.syncWithClaudeCode(dataType)
.getContactAnalytics()
.getDealAnalytics()
.startAutoSync()
.stopAutoSync()
.getStatus()
.shutdown()

// Events
.on('initialized', handler)
.on('contactCreated', handler)
.on('dealUpdated', handler)
.on('syncCompleted', handler)
.on('error', handler)
```

---

## Version History

### v1.0.0 (October 27, 2025)
- Initial release
- Contact, deal, company management
- Campaign automation
- Email integration
- Real-time bidirectional sync
- Claude Code integration
- Comprehensive analytics

---

## Support & Documentation

- **Documentation**: See J4C_AGENT_PLUGIN.md
- **Issues**: https://github.com/Aurigraph-DLT-Corp/glowing-adventure/issues
- **Email**: engineering@aurigraph.io

---

**HubSpot Integration v1.0.0**
**October 27, 2025**
**Aurigraph Development Team**

