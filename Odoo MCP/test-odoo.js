/**
 * Odoo Connection Test Script
 * Tests authentication and basic connectivity to Odoo instance
 */

import { OdooClient } from './dist/odoo/client.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const config = {
  url: process.env.ODOO_URL,
  db: process.env.ODOO_DB,
  username: process.env.ODOO_USERNAME,
  password: process.env.ODOO_PASSWORD,
};

console.log('\n=== Odoo Connection Test ===\n');
console.log('Configuration:');
console.log(`  URL: ${config.url}`);
console.log(`  Database: ${config.db}`);
console.log(`  Username: ${config.username}`);
console.log(`  Password: ${'*'.repeat(config.password?.length || 0)}`);
console.log();

async function testOdooConnection() {
  try {
    console.log('Step 1: Initializing Odoo client...');
    const client = new OdooClient(config);
    console.log('✓ Client initialized\n');

    console.log('Step 2: Authenticating with Odoo...');
    const uid = await client.authenticate();
    console.log(`✓ Authentication successful! User ID: ${uid}\n`);

    console.log('Step 3: Testing basic query (res.partner model)...');
    const partnerIds = await client.search('res.partner', [], 5);
    console.log(`✓ Found ${partnerIds.length} partners (limited to 5)`);
    console.log(`  Partner IDs: ${partnerIds.join(', ')}\n`);

    if (partnerIds.length > 0) {
      console.log('Step 4: Reading partner details...');
      const partners = await client.read('res.partner', [partnerIds[0]], ['name', 'email', 'phone']);
      console.log('✓ Partner details retrieved:');
      console.log(JSON.stringify(partners[0], null, 2));
      console.log();
    }

    console.log('Step 5: Checking available models...');
    const models = await client.search('ir.model', [], 10);
    console.log(`✓ Found ${models.length} models (limited to 10)\n`);

    console.log('=== ✓ All tests passed successfully! ===\n');
    console.log('Your Odoo integration is working correctly.');
    console.log('You can now use the MCP server with Claude Desktop.\n');

  } catch (error) {
    console.error('\n=== ✗ Test failed ===\n');
    console.error('Error details:', error.message);

    if (error.code === 'ENOTFOUND') {
      console.error('\n→ The Odoo URL could not be resolved.');
      console.error('  Please check:');
      console.error('  - Is the URL correct? (currently: ' + config.url + ')');
      console.error('  - Is the Odoo instance accessible from your network?');
      console.error('  - Try accessing the URL in a browser first');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n→ Connection was refused by the server.');
      console.error('  Please check:');
      console.error('  - Is the Odoo service running?');
      console.error('  - Is the port correct? (default: 8069 for HTTP, 8071 for HTTPS)');
      console.error('  - Are there any firewall rules blocking the connection?');
    } else if (error.message.includes('Authentication failed')) {
      console.error('\n→ Authentication failed.');
      console.error('  Please check:');
      console.error('  - Username: ' + config.username);
      console.error('  - Password is correct');
      console.error('  - Database name: ' + config.db);
      console.error('  - User has API access permissions in Odoo');
    } else if (error.message.includes('database')) {
      console.error('\n→ Database error.');
      console.error('  Please check:');
      console.error('  - Database name is correct: ' + config.db);
      console.error('  - Database exists on the Odoo instance');
      console.error('  - You can find the database name in Odoo URL or ask your admin');
    }

    console.error('\n');
    process.exit(1);
  }
}

// Run the test
testOdooConnection();
