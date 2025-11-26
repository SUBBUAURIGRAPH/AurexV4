# Odoo MCP Server with Zoom and HubSpot Integrations

A comprehensive Model Context Protocol (MCP) server that integrates Odoo ERP with Zoom video conferencing and HubSpot CRM, enabling AI assistants to interact with all three platforms seamlessly.

## Features

### Odoo Integration ✅
- **Full ERP Access**: Search, create, update, and delete records across all Odoo models
- **Customer Management**: Direct access to customer/partner data
- **XML-RPC Communication**: Secure, standard Odoo API integration
- **Model Operations**: Execute any Odoo model method
- **Field Inspection**: Dynamic field discovery and validation

### Zoom Integration ✅
- **Meeting Management**: Create, update, list, and delete Zoom meetings
- **Server-to-Server OAuth**: Secure authentication without user intervention
- **Rich Meeting Configuration**: Full control over meeting settings, recordings, and participants
- **Real-time Status**: Check meeting status and participant information
- **Timezone Support**: Global meeting scheduling with timezone handling

### HubSpot Integration ✅
- **Contact Management**: Create, read, update, and search contacts
- **Deal Management**: Complete deal lifecycle management
- **Company Management**: Manage company records and associations
- **Two-way Sync**: Sync data between HubSpot and Odoo
- **Custom Properties**: Support for custom fields and properties
- **Search & Filtering**: Advanced search across all CRM objects

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Assistant (Claude)                     │
│                  Model Context Protocol Client                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Odoo MCP Server (This Project)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Odoo Client  │  │ Zoom Client  │  │HubSpot Client│      │
│  │  (XML-RPC)   │  │  (REST API)  │  │  (REST API)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
│   Odoo ERP       │ │   Zoom API   │ │  HubSpot CRM │
│   (Your Server)  │ │   (Cloud)    │ │   (Cloud)    │
└──────────────────┘ └──────────────┘ └──────────────┘
```

## Prerequisites

- **Node.js**: v20.0.0 or higher
- **Odoo**: Version 12.0 or higher with XML-RPC enabled
- **Zoom**: Server-to-Server OAuth app credentials
- **HubSpot**: Private app with appropriate scopes or access token
- **TypeScript**: Installed via npm (included in dependencies)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd odoo-mcp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Odoo Configuration
ODOO_URL=https://your-odoo-instance.com
ODOO_DB=your_database_name
ODOO_USERNAME=admin
ODOO_PASSWORD=your_password_here

# Zoom Configuration (Optional)
ZOOM_ACCOUNT_ID=your_zoom_account_id
ZOOM_CLIENT_ID=your_zoom_client_id
ZOOM_CLIENT_SECRET=your_zoom_client_secret

# HubSpot Configuration (Optional)
HUBSPOT_ACCESS_TOKEN=your_hubspot_access_token

# MCP Server Configuration
MCP_SERVER_NAME=odoo-integrations
MCP_SERVER_VERSION=1.0.0
LOG_LEVEL=info
```

### 4. Build the Project

```bash
npm run build
```

## Configuration

### Odoo Setup

1. **Enable XML-RPC**: Ensure XML-RPC is enabled in your Odoo instance (enabled by default)
2. **Create API User**: Create a dedicated user for API access with appropriate permissions
3. **Test Connection**: Use the credentials to test connection via XML-RPC

### Zoom Setup

1. **Create Server-to-Server OAuth App**:
   - Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
   - Click "Develop" → "Build App"
   - Select "Server-to-Server OAuth"
   - Fill in app details

2. **Get Credentials**:
   - Account ID: Found in app credentials
   - Client ID: Generated when app is created
   - Client Secret: Generated when app is created

3. **Add Scopes**:
   - `meeting:write:admin` - Create meetings
   - `meeting:read:admin` - Read meeting details
   - `meeting:update:admin` - Update meetings
   - `meeting:delete:admin` - Delete meetings
   - `user:read:admin` - Read user profile

### HubSpot Setup

1. **Create Private App** (Recommended):
   - Go to Settings → Integrations → Private Apps
   - Click "Create private app"
   - Add required scopes:
     - `crm.objects.contacts.read`
     - `crm.objects.contacts.write`
     - `crm.objects.companies.read`
     - `crm.objects.companies.write`
     - `crm.objects.deals.read`
     - `crm.objects.deals.write`
   - Generate access token

2. **Or Use API Key**:
   - Go to Settings → Integrations → API Key
   - Generate API key (deprecated, use private apps instead)

## Usage

### Running the Server

#### Development Mode (with hot reload)

```bash
npm run dev
```

#### Production Mode

```bash
npm start
```

### Integrating with Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "odoo-integrations": {
      "command": "node",
      "args": ["/path/to/odoo-mcp/dist/index.js"],
      "env": {
        "ODOO_URL": "https://your-odoo-instance.com",
        "ODOO_DB": "your_database",
        "ODOO_USERNAME": "admin",
        "ODOO_PASSWORD": "your_password",
        "ZOOM_CLIENT_ID": "your_zoom_client_id",
        "ZOOM_CLIENT_SECRET": "your_zoom_client_secret",
        "ZOOM_ACCOUNT_ID": "your_zoom_account_id",
        "HUBSPOT_ACCESS_TOKEN": "your_hubspot_token"
      }
    }
  }
}
```

## Available Tools

### Odoo Tools

#### `odoo_search_records`
Search for records in any Odoo model.

**Parameters**:
- `model` (string, required): Odoo model name (e.g., "res.partner", "sale.order")
- `domain` (array, optional): Search filters (e.g., `[["name", "like", "John"]]`)
- `fields` (array, optional): Fields to retrieve
- `limit` (number, optional): Maximum records to return (default: 100)

**Example**:
```javascript
{
  "model": "res.partner",
  "domain": [["customer_rank", ">", 0]],
  "fields": ["name", "email", "phone"],
  "limit": 10
}
```

#### `odoo_create_record`
Create a new record in Odoo.

**Parameters**:
- `model` (string, required): Odoo model name
- `values` (object, required): Field values for the new record

**Example**:
```javascript
{
  "model": "res.partner",
  "values": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  }
}
```

#### `odoo_update_record`
Update an existing record.

**Parameters**:
- `model` (string, required): Odoo model name
- `id` (number, required): Record ID to update
- `values` (object, required): Field values to update

#### `odoo_get_customer`
Get customer details by ID.

**Parameters**:
- `customerId` (number, required): Customer/partner ID

### Zoom Tools

#### `zoom_create_meeting`
Create a new Zoom meeting.

**Parameters**:
- `topic` (string, required): Meeting title
- `startTime` (string, optional): Start time (ISO 8601 format)
- `duration` (number, optional): Duration in minutes (default: 60)
- `agenda` (string, optional): Meeting agenda
- `timezone` (string, optional): Timezone (default: UTC)

**Example**:
```javascript
{
  "topic": "Team Standup",
  "startTime": "2025-11-26T10:00:00Z",
  "duration": 30,
  "agenda": "Daily sync meeting",
  "timezone": "America/New_York"
}
```

#### `zoom_list_meetings`
List upcoming Zoom meetings.

**Parameters**:
- `type` (string, optional): Type of meetings ("scheduled", "live", "upcoming")

#### `zoom_get_meeting`
Get details of a specific meeting.

**Parameters**:
- `meetingId` (string, required): Zoom meeting ID

#### `zoom_update_meeting`
Update a meeting.

**Parameters**:
- `meetingId` (string, required): Meeting ID
- `updates` (object, required): Fields to update

#### `zoom_delete_meeting`
Delete a meeting.

**Parameters**:
- `meetingId` (string, required): Meeting ID

### HubSpot Tools

#### `hubspot_create_contact`
Create a new contact in HubSpot.

**Parameters**:
- `email` (string, required): Contact email
- `firstName` (string, optional): First name
- `lastName` (string, optional): Last name
- `company` (string, optional): Company name
- `phone` (string, optional): Phone number
- `properties` (object, optional): Additional custom properties

**Example**:
```javascript
{
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "company": "Acme Corp",
  "phone": "+1234567890"
}
```

#### `hubspot_get_contact`
Get contact by ID or email.

**Parameters**:
- `contactId` (string, required): Contact ID or email address

#### `hubspot_update_contact`
Update a contact.

**Parameters**:
- `contactId` (string, required): Contact ID
- `properties` (object, required): Properties to update

#### `hubspot_search_contacts`
Search for contacts.

**Parameters**:
- `query` (string, optional): Search query
- `limit` (number, optional): Maximum results (default: 100)

#### `hubspot_create_deal`
Create a new deal.

**Parameters**:
- `dealName` (string, required): Deal name
- `amount` (number, optional): Deal amount
- `stage` (string, optional): Deal stage
- `properties` (object, optional): Additional properties

#### `hubspot_sync_to_odoo`
Sync a HubSpot contact or company to Odoo.

**Parameters**:
- `hubspotId` (string, required): HubSpot contact or company ID
- `type` (string, required): Type to sync ("contact" or "company")

## Use Cases

### 1. Automated Customer Onboarding
When a new contact is created in HubSpot:
1. AI assistant creates the contact in Odoo
2. Schedules onboarding Zoom meeting
3. Sends welcome email via Odoo

### 2. Deal Management
When a deal progresses in HubSpot:
1. AI updates corresponding sale order in Odoo
2. Schedules follow-up Zoom call
3. Updates deal stage and notes

### 3. Meeting Scheduling
AI assistant can:
1. Check Odoo for customer details
2. Create Zoom meeting with appropriate settings
3. Update both Odoo and HubSpot with meeting details

### 4. Data Synchronization
Bi-directional sync between platforms:
1. HubSpot contacts → Odoo partners
2. Odoo customers → HubSpot contacts
3. Meeting records synchronized across all platforms

## Development

### Project Structure

```
odoo-mcp/
├── src/
│   ├── index.ts              # Main MCP server
│   ├── odoo/
│   │   └── client.ts         # Odoo XML-RPC client
│   ├── zoom/
│   │   └── client.ts         # Zoom API client
│   ├── hubspot/
│   │   └── client.ts         # HubSpot API client
│   └── utils/
│       └── logger.ts         # Logging utility
├── dist/                     # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### Adding New Tools

1. Add tool definition in `src/index.ts` → `getTools()`
2. Implement tool execution in appropriate `execute*Tool()` method
3. Add client method if needed in respective client file
4. Update documentation

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## Troubleshooting

### Odoo Connection Issues

1. **Check URL**: Ensure `ODOO_URL` includes protocol (http:// or https://)
2. **Verify Credentials**: Test login via Odoo web interface
3. **Check Firewall**: Ensure ports 8069 (HTTP) or 443 (HTTPS) are accessible
4. **XML-RPC Enabled**: Verify in Odoo settings

### Zoom Authentication Errors

1. **Verify Credentials**: Check Account ID, Client ID, and Client Secret
2. **App Activation**: Ensure Server-to-Server OAuth app is activated
3. **Scopes**: Confirm required scopes are granted
4. **Token Expiry**: Server handles token refresh automatically

### HubSpot API Errors

1. **Check Token**: Verify access token is valid
2. **Scope Permissions**: Ensure token has required scopes
3. **Rate Limits**: HubSpot has rate limits (100 requests/10 seconds)
4. **Private App**: Use private apps instead of deprecated API keys

## Performance

- **Caching**: OAuth tokens are cached to minimize API calls
- **Connection Pooling**: XML-RPC clients maintain connection pools
- **Batch Operations**: Support for bulk record operations
- **Error Handling**: Comprehensive error handling with retries

## Security

- **Environment Variables**: Credentials stored securely in environment
- **No Plaintext Passwords**: Never commit credentials to version control
- **OAuth 2.0**: Industry-standard authentication for Zoom and HubSpot
- **XML-RPC over HTTPS**: Secure communication with Odoo
- **Minimal Permissions**: Request only required API scopes

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- **GitHub Issues**: [Create an issue](https://github.com/your-repo/issues)
- **Documentation**: See this README and inline code comments
- **Odoo Forums**: [Odoo Community](https://www.odoo.com/forum)
- **Zoom Support**: [Zoom Developer Forum](https://devforum.zoom.us/)
- **HubSpot Support**: [HubSpot Developer Community](https://community.hubspot.com/developers)

## Acknowledgments

- Built on [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- Uses [@hubspot/api-client](https://www.npmjs.com/package/@hubspot/api-client)
- Integrated with Zoom API v2
- Odoo XML-RPC integration via [xmlrpc](https://www.npmjs.com/package/xmlrpc)

---

**Version**: 1.0.0
**Last Updated**: November 25, 2025
**Status**: Production Ready ✅
