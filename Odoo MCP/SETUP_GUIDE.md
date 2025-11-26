# Odoo MCP Setup Guide

Complete step-by-step guide to set up the Odoo MCP server with Zoom and HubSpot integrations.

## Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials (see detailed setup below).

### 3. Build and Run

```bash
npm run build
npm start
```

## Detailed Setup

### Prerequisites Checklist

- [ ] Node.js v20+ installed
- [ ] Odoo instance with admin access
- [ ] Zoom account (for meeting integration)
- [ ] HubSpot account (for CRM integration)
- [ ] Claude Desktop app (for MCP client)

### Step 1: Odoo Configuration

#### 1.1 Verify Odoo Instance

1. Open your Odoo instance in a web browser
2. Log in with administrator credentials
3. Note your instance URL (e.g., `https://yourcompany.odoo.com`)
4. Note your database name (visible in URL or Settings)

#### 1.2 Create API User (Recommended)

For production, create a dedicated API user:

1. Go to **Settings** → **Users & Companies** → **Users**
2. Click **Create**
3. Fill in:
   - Name: "API Integration User"
   - Email: `api@yourcompany.com`
   - Login: `api_user`
   - Access Rights: Select appropriate groups
4. Set a strong password
5. Save

#### 1.3 Test XML-RPC Access

Test connection using Python (optional):

```python
import xmlrpc.client

url = "https://yourcompany.odoo.com"
db = "your_database"
username = "api_user"
password = "your_password"

common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common')
uid = common.authenticate(db, username, password, {})
print(f"Authenticated with UID: {uid}")
```

#### 1.4 Update .env File

```bash
ODOO_URL=https://yourcompany.odoo.com
ODOO_DB=your_database
ODOO_USERNAME=api_user
ODOO_PASSWORD=your_secure_password
```

### Step 2: Zoom Configuration

#### 2.1 Create Zoom App

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Click **Develop** in top right
3. Click **Build App**
4. Select **Server-to-Server OAuth**
5. Fill in app information:
   - **App Name**: `Odoo Integration`
   - **Company Name**: Your company
   - **Description**: Integration between Odoo and Zoom

#### 2.2 Get Credentials

After creating the app:

1. Go to **App Credentials** tab
2. Copy:
   - **Account ID**
   - **Client ID**
   - **Client Secret**

#### 2.3 Add Scopes

Go to **Scopes** tab and add:

- [ ] `meeting:write:admin` - Create meetings
- [ ] `meeting:read:admin` - Read meetings
- [ ] `meeting:update:admin` - Update meetings
- [ ] `meeting:delete:admin` - Delete meetings
- [ ] `user:read:admin` - Read user info

Click **Continue** and **Activate** the app.

#### 2.4 Update .env File

```bash
ZOOM_ACCOUNT_ID=your_account_id
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
```

### Step 3: HubSpot Configuration

#### 3.1 Create Private App

1. In HubSpot, click **Settings** (gear icon)
2. Navigate to **Integrations** → **Private Apps**
3. Click **Create a private app**
4. Fill in:
   - **Name**: `Odoo Integration`
   - **Description**: Integration with Odoo ERP

#### 3.2 Configure Scopes

Go to **Scopes** tab and select:

**CRM Scopes:**
- [ ] `crm.objects.contacts.read`
- [ ] `crm.objects.contacts.write`
- [ ] `crm.objects.companies.read`
- [ ] `crm.objects.companies.write`
- [ ] `crm.objects.deals.read`
- [ ] `crm.objects.deals.write`

**Optional (for advanced features):**
- [ ] `crm.schemas.contacts.read`
- [ ] `crm.schemas.companies.read`
- [ ] `crm.schemas.deals.read`

#### 3.3 Generate Access Token

1. Click **Create app**
2. On the next screen, click **Show token**
3. Copy the access token (save securely!)

#### 3.4 Update .env File

```bash
HUBSPOT_ACCESS_TOKEN=your_access_token
```

### Step 4: Build the Project

#### 4.1 Compile TypeScript

```bash
npm run build
```

This creates the `dist/` directory with compiled JavaScript.

#### 4.2 Verify Build

```bash
ls -la dist/
```

You should see:
- `index.js`
- `index.js.map`
- `odoo/`, `zoom/`, `hubspot/`, `utils/` directories

### Step 5: Test the Server

#### 5.1 Test in Development Mode

```bash
npm run dev
```

Look for output:
```
[INFO] 2025-11-25... Odoo MCP Server started with integrations:
[INFO] 2025-11-25... - Odoo: https://yourcompany.odoo.com
[INFO] 2025-11-25... - Zoom: Enabled
[INFO] 2025-11-25... - HubSpot: Enabled
```

#### 5.2 Test Individual Connections

Create a test file `test-connections.js`:

```javascript
import { OdooClient } from './dist/odoo/client.js';
import { ZoomClient } from './dist/zoom/client.js';
import { HubSpotClient } from './dist/hubspot/client.js';
import dotenv from 'dotenv';

dotenv.config();

async function testConnections() {
  // Test Odoo
  console.log('Testing Odoo connection...');
  const odoo = new OdooClient({
    url: process.env.ODOO_URL,
    db: process.env.ODOO_DB,
    username: process.env.ODOO_USERNAME,
    password: process.env.ODOO_PASSWORD,
  });
  try {
    await odoo.authenticate();
    console.log('✅ Odoo connection successful');
  } catch (error) {
    console.error('❌ Odoo connection failed:', error.message);
  }

  // Test Zoom
  if (process.env.ZOOM_CLIENT_ID) {
    console.log('\nTesting Zoom connection...');
    const zoom = new ZoomClient({
      accountId: process.env.ZOOM_ACCOUNT_ID,
      clientId: process.env.ZOOM_CLIENT_ID,
      clientSecret: process.env.ZOOM_CLIENT_SECRET,
    });
    try {
      await zoom.getUserProfile();
      console.log('✅ Zoom connection successful');
    } catch (error) {
      console.error('❌ Zoom connection failed:', error.message);
    }
  }

  // Test HubSpot
  if (process.env.HUBSPOT_ACCESS_TOKEN) {
    console.log('\nTesting HubSpot connection...');
    const hubspot = new HubSpotClient({
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
    });
    try {
      await hubspot.searchContacts('', 1);
      console.log('✅ HubSpot connection successful');
    } catch (error) {
      console.error('❌ HubSpot connection failed:', error.message);
    }
  }
}

testConnections();
```

Run: `node test-connections.js`

### Step 6: Configure Claude Desktop

#### 6.1 Locate Configuration File

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

#### 6.2 Add MCP Server Configuration

Edit the file and add:

```json
{
  "mcpServers": {
    "odoo-integrations": {
      "command": "node",
      "args": ["/full/path/to/odoo-mcp/dist/index.js"],
      "env": {
        "ODOO_URL": "https://yourcompany.odoo.com",
        "ODOO_DB": "your_database",
        "ODOO_USERNAME": "api_user",
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

Replace `/full/path/to/odoo-mcp` with your actual path.

#### 6.3 Restart Claude Desktop

Close and reopen Claude Desktop to load the new configuration.

### Step 7: Test with Claude

#### 7.1 Verify Server Connection

In Claude, type:
```
List the available tools from the odoo-integrations server
```

You should see all Odoo, Zoom, and HubSpot tools listed.

#### 7.2 Test Odoo Tool

```
Search for the first 5 customers in Odoo
```

Claude should use `odoo_search_records` and return customer data.

#### 7.3 Test Zoom Tool

```
List my upcoming Zoom meetings
```

Claude should use `zoom_list_meetings` and show your meetings.

#### 7.4 Test HubSpot Tool

```
Search for contacts in HubSpot with "john" in their name
```

Claude should use `hubspot_search_contacts` and return results.

## Common Issues and Solutions

### Issue 1: "Cannot find module" Error

**Symptom**: `Error: Cannot find module '@modelcontextprotocol/sdk'`

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue 2: Odoo Authentication Failed

**Symptom**: `Authentication failed: invalid credentials`

**Solutions**:
1. Verify credentials work in Odoo web interface
2. Check database name is correct
3. Ensure user has API access rights
4. Try with admin user first to isolate permissions issues

### Issue 3: Zoom Token Error

**Symptom**: `Failed to authenticate with Zoom API`

**Solutions**:
1. Verify app is **activated** in Zoom marketplace
2. Check credentials are copied correctly (no extra spaces)
3. Ensure all required scopes are granted
4. Wait a few minutes after activating app

### Issue 4: HubSpot Rate Limit

**Symptom**: `429 Too Many Requests`

**Solutions**:
1. HubSpot limits: 100 requests per 10 seconds
2. Reduce frequency of requests
3. Implement caching if making repeated calls
4. Upgrade HubSpot plan for higher limits

### Issue 5: Claude Desktop Not Recognizing Server

**Symptom**: Tools not appearing in Claude

**Solutions**:
1. Verify configuration file path is correct
2. Check JSON syntax (use a JSON validator)
3. Ensure absolute path to `dist/index.js`
4. Restart Claude Desktop completely
5. Check Claude Desktop logs for errors

## Advanced Configuration

### Production Deployment

For production use:

1. **Use Process Manager**:
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name odoo-mcp
   pm2 save
   pm2 startup
   ```

2. **Enable Logging**:
   ```bash
   LOG_LEVEL=info
   ```

3. **Secure Credentials**:
   - Use environment variable management (e.g., AWS Secrets Manager)
   - Rotate credentials regularly
   - Use read-only API users where possible

### Custom Tool Development

To add custom tools:

1. Edit `src/index.ts`
2. Add tool definition in `getTools()`
3. Implement execution logic
4. Rebuild: `npm run build`
5. Restart server

### Integration Examples

See `README.md` for complete use case examples.

## Monitoring and Maintenance

### Health Checks

Create `health-check.sh`:

```bash
#!/bin/bash
node -e "
const odoo = require('./dist/odoo/client.js');
const client = new odoo.OdooClient({
  url: process.env.ODOO_URL,
  db: process.env.ODOO_DB,
  username: process.env.ODOO_USERNAME,
  password: process.env.ODOO_PASSWORD,
});
client.authenticate().then(() => {
  console.log('Health check: OK');
  process.exit(0);
}).catch((err) => {
  console.error('Health check: FAILED', err.message);
  process.exit(1);
});
"
```

Run: `./health-check.sh`

### Log Monitoring

```bash
# View logs in real-time
tail -f logs/odoo-mcp.log

# Search for errors
grep ERROR logs/odoo-mcp.log
```

### Performance Tuning

1. **Connection Pooling**: XML-RPC clients maintain connection pools
2. **Caching**: OAuth tokens cached automatically
3. **Batch Operations**: Use bulk API calls where possible
4. **Rate Limiting**: Implement request throttling for HubSpot

## Support

If you encounter issues:

1. Check this guide
2. Review `README.md`
3. Check server logs
4. Test each integration individually
5. Create an issue on GitHub with:
   - Error message
   - Steps to reproduce
   - Environment details (Node version, OS)

## Next Steps

Once setup is complete:

1. ✅ Test all tools individually
2. ✅ Create example workflows
3. ✅ Set up monitoring
4. ✅ Document custom use cases
5. ✅ Train team on Claude interactions

---

**Setup Version**: 1.0.0
**Last Updated**: November 25, 2025
**Status**: Production Ready ✅
