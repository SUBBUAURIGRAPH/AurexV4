/**
 * List Available Odoo Databases
 */

import xmlrpc from 'xmlrpc';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.ODOO_URL || 'https://aurigraph.io';
const urlObj = new URL(url);
const host = urlObj.hostname;
const port = urlObj.port ? parseInt(urlObj.port) : (urlObj.protocol === 'https:' ? 443 : 80);
const secure = urlObj.protocol === 'https:';

console.log('\n=== Odoo Database Discovery ===\n');
console.log(`Server: ${url}`);
console.log(`Host: ${host}`);
console.log(`Port: ${port}`);
console.log(`Protocol: ${secure ? 'HTTPS' : 'HTTP'}\n`);

const dbClient = secure
  ? xmlrpc.createSecureClient({ host, port, path: '/xmlrpc/2/db' })
  : xmlrpc.createClient({ host, port, path: '/xmlrpc/2/db' });

console.log('Querying available databases...\n');

dbClient.methodCall('list', [], (error, databases) => {
  if (error) {
    console.error('Error listing databases:', error.message);
    console.error('\nPossible reasons:');
    console.error('  - Database listing is disabled on this Odoo instance');
    console.error('  - Firewall or access restrictions');
    console.error('  - Invalid URL or connection issues\n');
    process.exit(1);
  }

  if (!databases || databases.length === 0) {
    console.log('No databases found or database listing is disabled.\n');
    console.log('Common database names to try:');
    console.log('  - main');
    console.log('  - odoo');
    console.log('  - production');
    console.log('  - aurigraph_db');
    console.log('  - Contact your Odoo administrator for the correct database name\n');
    process.exit(0);
  }

  console.log(`Found ${databases.length} database(s):\n`);
  databases.forEach((db, index) => {
    console.log(`  ${index + 1}. ${db}`);
  });
  console.log('\nUpdate the ODOO_DB variable in your .env file with the correct database name.\n');
});
