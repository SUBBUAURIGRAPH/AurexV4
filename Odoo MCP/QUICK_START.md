# Odoo MCP Integration - Quick Start Guide

**Status**: ✅ Tested and Working with aurigraph.io

---

## Installation (Complete ✅)

The server is already built and tested. Skip to Claude Desktop configuration below.

---

## Claude Desktop Configuration

### Step 1: Locate Config File

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Step 2: Add Server Configuration

Open the config file and add the Odoo MCP server:

```json
{
  "mcpServers": {
    "odoo-integrations": {
      "command": "node",
      "args": ["/Users/subbujois/subbuworkingdir/Odoo MCP/dist/index.js"],
      "env": {
        "ODOO_URL": "https://aurigraph.io",
        "ODOO_DB": "odoodb",
        "ODOO_USERNAME": "subbu@aurigraph.io",
        "ODOO_PASSWORD": "Mko09ijn!",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Note**: If you already have other MCP servers configured, just add this `odoo-integrations` entry to your existing `mcpServers` object.

### Step 3: Restart Claude Desktop

Close Claude Desktop completely and reopen it.

---

## Verification

### Check Server Status

In Claude Desktop, ask:
```
List the available tools from odoo-integrations
```

You should see 4 Odoo tools listed.

### Test Basic Queries

Try these prompts:

1. **Search for customers**:
   ```
   Search for the first 5 partners in Odoo
   ```

2. **Find customers with email**:
   ```
   Find Odoo partners that have email addresses
   ```

3. **Get customer details**:
   ```
   Get details for customer with email alice07@yopmail.com from Odoo
   ```

4. **Search with filters**:
   ```
   Search for companies in Odoo (not individual contacts)
   ```

---

## Available Tools

### 1. odoo_search_records

Search any Odoo model with optional filters.

**Example Prompts**:
- "Search for partners in Odoo"
- "Find all companies in Odoo"
- "Search for invoices from this month"
- "Find products with price greater than 100"

**Parameters**:
- `model`: Odoo model name (e.g., "res.partner", "sale.order")
- `domain`: Optional filter array (e.g., `[["is_company", "=", true]]`)
- `fields`: Optional list of fields to retrieve
- `limit`: Maximum number of records (default: 100)

### 2. odoo_create_record

Create a new record in any Odoo model.

**Example Prompts**:
- "Create a new partner in Odoo named 'Test Company' with email test@example.com"
- "Add a new product to Odoo called 'Widget' with price 99.99"

**Parameters**:
- `model`: Odoo model name
- `values`: Object with field values

### 3. odoo_update_record

Update existing Odoo records.

**Example Prompts**:
- "Update partner ID 1078 in Odoo to set city to 'New York'"
- "Change the phone number for customer 1534 to '555-1234'"

**Parameters**:
- `model`: Odoo model name
- `ids`: Array of record IDs to update
- `values`: Object with new field values

### 4. odoo_get_customer

Get customer details by ID or email.

**Example Prompts**:
- "Get customer details for ID 1078"
- "Find customer with email alice07@yopmail.com"
- "Show me information about customer 1534"

**Parameters**:
- `idOrEmail`: Customer ID (number) or email address (string)

---

## Common Odoo Models

### Customer & Contact Management
- `res.partner` - Partners/Customers/Contacts
- `res.company` - Companies

### Sales & CRM
- `sale.order` - Sales Orders
- `sale.order.line` - Sales Order Lines
- `crm.lead` - Leads/Opportunities

### Products & Inventory
- `product.product` - Products
- `product.template` - Product Templates
- `stock.picking` - Inventory Transfers

### Accounting
- `account.move` - Invoices/Bills
- `account.move.line` - Invoice Lines
- `account.payment` - Payments

### Projects
- `project.project` - Projects
- `project.task` - Tasks

---

## Domain Filter Examples

Domain filters use Odoo's domain syntax: `[["field", "operator", "value"]]`

### Common Operators
- `=` - Equals
- `!=` - Not equals
- `>` - Greater than
- `<` - Less than
- `>=` - Greater than or equal
- `<=` - Less than or equal
- `like` - Contains (case-insensitive)
- `ilike` - Contains (case-insensitive)
- `in` - In list
- `not in` - Not in list

### Example Filters

**Find partners with email**:
```json
[["email", "!=", false]]
```

**Find companies only**:
```json
[["is_company", "=", true]]
```

**Find partners in a city**:
```json
[["city", "=", "New York"]]
```

**Find partners with name containing "test"**:
```json
[["name", "ilike", "test"]]
```

**Combine multiple conditions (AND)**:
```json
[["is_company", "=", true], ["country_id.name", "=", "United States"]]
```

**Combine multiple conditions (OR)**:
```json
["|", ["city", "=", "New York"], ["city", "=", "Los Angeles"]]
```

---

## Real-World Use Cases

### 1. Customer Onboarding

**Scenario**: Create a new customer and set up their account

```
Create a new partner in Odoo with these details:
- Name: Acme Corporation
- Email: contact@acme.com
- Phone: 555-0123
- Is Company: true
```

### 2. Sales Pipeline Management

**Scenario**: Find all opportunities in a specific stage

```
Search for CRM leads in Odoo that are in the "Qualified" stage
```

### 3. Customer Data Enrichment

**Scenario**: Update customer information

```
Update partner ID 1078 in Odoo to add:
- Phone: 555-9876
- City: San Francisco
- State: California
```

### 4. Reporting & Analytics

**Scenario**: Get customer statistics

```
Search for all partners in Odoo and tell me:
1. How many total customers we have
2. How many have email addresses
3. How many are companies vs individuals
```

### 5. Data Quality Checks

**Scenario**: Find incomplete records

```
Find all partners in Odoo that don't have an email address set
```

---

## Troubleshooting

### Tools Not Showing Up

1. Check config file path is correct
2. Verify JSON syntax is valid
3. Ensure server path is correct: `/Users/subbujois/subbuworkingdir/Odoo MCP/dist/index.js`
4. Restart Claude Desktop completely

### Authentication Errors

1. Verify credentials in config file:
   - URL: `https://aurigraph.io`
   - DB: `odoodb`
   - Username: `subbu@aurigraph.io`
   - Password: `Mko09ijn!`
2. Check network connectivity to aurigraph.io
3. Verify Odoo instance is running

### Search Returns No Results

1. Check if you're using the correct model name
2. Verify domain filter syntax
3. Try without filters first to confirm data exists
4. Check user permissions in Odoo

### Server Errors

1. Check Claude Desktop logs (Help → View Logs)
2. Verify Node.js is installed (`node --version`)
3. Check server logs if LOG_LEVEL is set to "debug"
4. Run test script: `cd "/Users/subbujois/subbuworkingdir/Odoo MCP" && node test-odoo-final.js`

---

## Advanced Usage

### Custom Models

The integration works with **any** Odoo model, including custom modules:

```
Search for records in model "x_custom_model" in Odoo
```

### Relationship Fields

Access related records using dot notation:

```
Search for partners in Odoo and include their country name using field "country_id.name"
```

### Bulk Operations

Update multiple records at once:

```
Update partner IDs 1078, 1534, and 1540 in Odoo to set their category to "VIP"
```

---

## Performance Tips

1. **Use Limits**: Always specify a reasonable limit for searches
   - Default is 100 records
   - Use smaller limits for testing: 5-10 records

2. **Select Specific Fields**: Request only the fields you need
   - Faster queries
   - Less data transfer
   - Cleaner results

3. **Use Precise Filters**: Narrow down searches with domain filters
   - Reduces result size
   - Faster processing
   - More relevant results

4. **Cache Results**: If asking multiple questions about the same data
   - Search once
   - Reference results in follow-up questions
   - Claude maintains context

---

## Next Steps

### Enable HubSpot Integration (Optional)

To enable HubSpot tools:

1. Create a HubSpot private app
2. Add access token to config:
   ```json
   "HUBSPOT_ACCESS_TOKEN": "your_token_here"
   ```
3. Restart Claude Desktop

This enables 6 additional tools for HubSpot CRM integration.

### Enable Zoom Integration (Optional)

To enable Zoom tools:

1. Create a Server-to-Server OAuth app
2. Add credentials to config:
   ```json
   "ZOOM_ACCOUNT_ID": "your_account_id",
   "ZOOM_CLIENT_ID": "your_client_id",
   "ZOOM_CLIENT_SECRET": "your_client_secret"
   ```
3. Restart Claude Desktop

This enables 5 additional tools for Zoom meeting management.

---

## Support Resources

### Documentation Files

- `README.md` - Complete technical documentation
- `SETUP_GUIDE.md` - Detailed setup instructions
- `DEPLOYMENT_STATUS.md` - Build and deployment status
- `INTEGRATION_TEST_RESULTS.md` - Test results and verification
- `Credentials.md` - Credential reference (keep secure!)

### Test Scripts

Run these from the terminal to verify the integration:

```bash
cd "/Users/subbujois/subbuworkingdir/Odoo MCP"

# Quick test
node test-odoo.js

# Comprehensive test suite
node test-odoo-final.js

# List databases
node list-databases.js
```

### External Resources

- [Odoo XML-RPC Documentation](https://www.odoo.com/documentation/16.0/developer/reference/external_api.html)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Odoo Domain Filters](https://www.odoo.com/documentation/16.0/developer/reference/backend/orm.html#reference-orm-domains)

---

## Security Reminder

⚠️ **Important**: The config file contains sensitive credentials.

- Never share your `claude_desktop_config.json` file
- Keep credentials secure
- Rotate passwords regularly
- Use minimal required permissions
- Monitor API usage

---

**Quick Start Guide Version**: 1.0
**Last Updated**: November 26, 2025
**Integration Status**: ✅ Tested and Working
