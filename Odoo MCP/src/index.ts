#!/usr/bin/env node

/**
 * Odoo MCP Server with Zoom and HubSpot Integrations
 *
 * This MCP server provides AI assistants with access to:
 * - Odoo ERP data and functionality
 * - Zoom meeting management
 * - HubSpot CRM operations
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

import { OdooClient } from './odoo/client.js';
import { ZoomClient } from './zoom/client.js';
import { HubSpotClient } from './hubspot/client.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'ODOO_URL',
  'ODOO_DB',
  'ODOO_USERNAME',
  'ODOO_PASSWORD',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

/**
 * Main MCP Server class
 */
class OdooMCPServer {
  private server: Server;
  private odooClient: OdooClient;
  private zoomClient: ZoomClient | null = null;
  private hubspotClient: HubSpotClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: process.env.MCP_SERVER_NAME || 'odoo-integrations',
        version: process.env.MCP_SERVER_VERSION || '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize clients
    this.odooClient = new OdooClient({
      url: process.env.ODOO_URL!,
      db: process.env.ODOO_DB!,
      username: process.env.ODOO_USERNAME!,
      password: process.env.ODOO_PASSWORD!,
    });

    // Initialize Zoom client if credentials are provided
    if (process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET) {
      this.zoomClient = new ZoomClient({
        accountId: process.env.ZOOM_ACCOUNT_ID!,
        clientId: process.env.ZOOM_CLIENT_ID!,
        clientSecret: process.env.ZOOM_CLIENT_SECRET!,
      });
    }

    // Initialize HubSpot client if credentials are provided
    if (process.env.HUBSPOT_ACCESS_TOKEN) {
      this.hubspotClient = new HubSpotClient({
        accessToken: process.env.HUBSPOT_ACCESS_TOKEN!,
      });
    }

    this.setupHandlers();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        return await this.executeTool(name, args || {});
      } catch (error) {
        logger.error(`Error executing tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Get list of available tools
   */
  private getTools(): Tool[] {
    const tools: Tool[] = [
      // Odoo Tools
      {
        name: 'odoo_search_records',
        description: 'Search for records in Odoo by model and domain filters',
        inputSchema: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              description: 'Odoo model name (e.g., "res.partner", "sale.order")',
            },
            domain: {
              type: 'array',
              description: 'Search domain filters',
              items: { type: 'array' },
            },
            fields: {
              type: 'array',
              description: 'Fields to retrieve',
              items: { type: 'string' },
            },
            limit: {
              type: 'number',
              description: 'Maximum number of records to return',
              default: 100,
            },
          },
          required: ['model'],
        },
      },
      {
        name: 'odoo_create_record',
        description: 'Create a new record in Odoo',
        inputSchema: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              description: 'Odoo model name',
            },
            values: {
              type: 'object',
              description: 'Field values for the new record',
            },
          },
          required: ['model', 'values'],
        },
      },
      {
        name: 'odoo_update_record',
        description: 'Update an existing record in Odoo',
        inputSchema: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              description: 'Odoo model name',
            },
            id: {
              type: 'number',
              description: 'Record ID to update',
            },
            values: {
              type: 'object',
              description: 'Field values to update',
            },
          },
          required: ['model', 'id', 'values'],
        },
      },
      {
        name: 'odoo_get_customer',
        description: 'Get customer details from Odoo',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: {
              type: 'number',
              description: 'Customer ID',
            },
          },
          required: ['customerId'],
        },
      },
    ];

    // Add Zoom tools if client is initialized
    if (this.zoomClient) {
      tools.push(
        {
          name: 'zoom_create_meeting',
          description: 'Create a new Zoom meeting',
          inputSchema: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'Meeting topic/title',
              },
              startTime: {
                type: 'string',
                description: 'Meeting start time (ISO 8601 format)',
              },
              duration: {
                type: 'number',
                description: 'Meeting duration in minutes',
                default: 60,
              },
              agenda: {
                type: 'string',
                description: 'Meeting agenda',
              },
              timezone: {
                type: 'string',
                description: 'Timezone (e.g., "America/New_York")',
                default: 'UTC',
              },
            },
            required: ['topic'],
          },
        },
        {
          name: 'zoom_list_meetings',
          description: 'List upcoming Zoom meetings',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['scheduled', 'live', 'upcoming'],
                description: 'Type of meetings to list',
                default: 'upcoming',
              },
            },
          },
        },
        {
          name: 'zoom_get_meeting',
          description: 'Get details of a specific Zoom meeting',
          inputSchema: {
            type: 'object',
            properties: {
              meetingId: {
                type: 'string',
                description: 'Zoom meeting ID',
              },
            },
            required: ['meetingId'],
          },
        },
        {
          name: 'zoom_update_meeting',
          description: 'Update an existing Zoom meeting',
          inputSchema: {
            type: 'object',
            properties: {
              meetingId: {
                type: 'string',
                description: 'Zoom meeting ID',
              },
              updates: {
                type: 'object',
                description: 'Fields to update',
              },
            },
            required: ['meetingId', 'updates'],
          },
        },
        {
          name: 'zoom_delete_meeting',
          description: 'Delete a Zoom meeting',
          inputSchema: {
            type: 'object',
            properties: {
              meetingId: {
                type: 'string',
                description: 'Zoom meeting ID',
              },
            },
            required: ['meetingId'],
          },
        }
      );
    }

    // Add HubSpot tools if client is initialized
    if (this.hubspotClient) {
      tools.push(
        {
          name: 'hubspot_create_contact',
          description: 'Create a new contact in HubSpot',
          inputSchema: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                description: 'Contact email address',
              },
              firstName: {
                type: 'string',
                description: 'First name',
              },
              lastName: {
                type: 'string',
                description: 'Last name',
              },
              company: {
                type: 'string',
                description: 'Company name',
              },
              phone: {
                type: 'string',
                description: 'Phone number',
              },
              properties: {
                type: 'object',
                description: 'Additional custom properties',
              },
            },
            required: ['email'],
          },
        },
        {
          name: 'hubspot_get_contact',
          description: 'Get contact details from HubSpot',
          inputSchema: {
            type: 'object',
            properties: {
              contactId: {
                type: 'string',
                description: 'HubSpot contact ID or email',
              },
            },
            required: ['contactId'],
          },
        },
        {
          name: 'hubspot_update_contact',
          description: 'Update an existing contact in HubSpot',
          inputSchema: {
            type: 'object',
            properties: {
              contactId: {
                type: 'string',
                description: 'HubSpot contact ID',
              },
              properties: {
                type: 'object',
                description: 'Properties to update',
              },
            },
            required: ['contactId', 'properties'],
          },
        },
        {
          name: 'hubspot_search_contacts',
          description: 'Search for contacts in HubSpot',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              limit: {
                type: 'number',
                description: 'Maximum results',
                default: 100,
              },
            },
          },
        },
        {
          name: 'hubspot_create_deal',
          description: 'Create a new deal in HubSpot',
          inputSchema: {
            type: 'object',
            properties: {
              dealName: {
                type: 'string',
                description: 'Deal name',
              },
              amount: {
                type: 'number',
                description: 'Deal amount',
              },
              stage: {
                type: 'string',
                description: 'Deal stage',
              },
              properties: {
                type: 'object',
                description: 'Additional properties',
              },
            },
            required: ['dealName'],
          },
        },
        {
          name: 'hubspot_sync_to_odoo',
          description: 'Sync HubSpot contact/company to Odoo',
          inputSchema: {
            type: 'object',
            properties: {
              hubspotId: {
                type: 'string',
                description: 'HubSpot contact or company ID',
              },
              type: {
                type: 'string',
                enum: ['contact', 'company'],
                description: 'Type of record to sync',
              },
            },
            required: ['hubspotId', 'type'],
          },
        }
      );
    }

    return tools;
  }

  /**
   * Execute a tool
   */
  private async executeTool(name: string, args: Record<string, unknown>) {
    // Odoo tools
    if (name.startsWith('odoo_')) {
      return this.executeOdooTool(name, args);
    }

    // Zoom tools
    if (name.startsWith('zoom_')) {
      if (!this.zoomClient) {
        throw new Error('Zoom client not configured. Please set ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET.');
      }
      return this.executeZoomTool(name, args);
    }

    // HubSpot tools
    if (name.startsWith('hubspot_')) {
      if (!this.hubspotClient) {
        throw new Error('HubSpot client not configured. Please set HUBSPOT_ACCESS_TOKEN.');
      }
      return this.executeHubSpotTool(name, args);
    }

    throw new Error(`Unknown tool: ${name}`);
  }

  /**
   * Execute Odoo tool
   */
  private async executeOdooTool(name: string, args: Record<string, unknown>) {
    switch (name) {
      case 'odoo_search_records': {
        const { model, domain, fields, limit } = args;
        const records = await this.odooClient.searchRead(
          model as string,
          domain as any[],
          fields as string[],
          limit as number
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(records, null, 2),
            },
          ],
        };
      }

      case 'odoo_create_record': {
        const { model, values } = args;
        const id = await this.odooClient.create(model as string, values as Record<string, any>);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully created record with ID: ${id}`,
            },
          ],
        };
      }

      case 'odoo_update_record': {
        const { model, id, values } = args;
        await this.odooClient.write(model as string, [id as number], values as Record<string, any>);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated record ID: ${id}`,
            },
          ],
        };
      }

      case 'odoo_get_customer': {
        const { customerId } = args;
        const customer = await this.odooClient.searchRead(
          'res.partner',
          [['id', '=', customerId]],
          ['name', 'email', 'phone', 'street', 'city', 'country_id']
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(customer[0] || {}, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown Odoo tool: ${name}`);
    }
  }

  /**
   * Execute Zoom tool
   */
  private async executeZoomTool(name: string, args: Record<string, unknown>) {
    if (!this.zoomClient) throw new Error('Zoom client not initialized');

    switch (name) {
      case 'zoom_create_meeting': {
        const meeting = await this.zoomClient.createMeeting(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(meeting, null, 2),
            },
          ],
        };
      }

      case 'zoom_list_meetings': {
        const meetings = await this.zoomClient.listMeetings(args.type as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(meetings, null, 2),
            },
          ],
        };
      }

      case 'zoom_get_meeting': {
        const meeting = await this.zoomClient.getMeeting(args.meetingId as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(meeting, null, 2),
            },
          ],
        };
      }

      case 'zoom_update_meeting': {
        await this.zoomClient.updateMeeting(args.meetingId as string, args.updates as any);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated meeting: ${args.meetingId}`,
            },
          ],
        };
      }

      case 'zoom_delete_meeting': {
        await this.zoomClient.deleteMeeting(args.meetingId as string);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully deleted meeting: ${args.meetingId}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown Zoom tool: ${name}`);
    }
  }

  /**
   * Execute HubSpot tool
   */
  private async executeHubSpotTool(name: string, args: Record<string, unknown>) {
    if (!this.hubspotClient) throw new Error('HubSpot client not initialized');

    switch (name) {
      case 'hubspot_create_contact': {
        const contact = await this.hubspotClient.createContact(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(contact, null, 2),
            },
          ],
        };
      }

      case 'hubspot_get_contact': {
        const contact = await this.hubspotClient.getContact(args.contactId as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(contact, null, 2),
            },
          ],
        };
      }

      case 'hubspot_update_contact': {
        await this.hubspotClient.updateContact(args.contactId as string, args.properties as any);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated contact: ${args.contactId}`,
            },
          ],
        };
      }

      case 'hubspot_search_contacts': {
        const contacts = await this.hubspotClient.searchContacts(args.query as string, args.limit as number);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(contacts, null, 2),
            },
          ],
        };
      }

      case 'hubspot_create_deal': {
        const deal = await this.hubspotClient.createDeal(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deal, null, 2),
            },
          ],
        };
      }

      case 'hubspot_sync_to_odoo': {
        const result = await this.syncHubSpotToOdoo(args.hubspotId as string, args.type as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown HubSpot tool: ${name}`);
    }
  }

  /**
   * Sync HubSpot data to Odoo
   */
  private async syncHubSpotToOdoo(hubspotId: string, type: string) {
    if (!this.hubspotClient) throw new Error('HubSpot client not initialized');

    if (type === 'contact') {
      const contact = await this.hubspotClient.getContact(hubspotId);

      // Map HubSpot contact to Odoo partner
      const odooValues = {
        name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
        email: contact.properties.email,
        phone: contact.properties.phone,
        company_type: 'person',
        comment: `Synced from HubSpot (ID: ${hubspotId})`,
      };

      const partnerId = await this.odooClient.create('res.partner', odooValues);

      return {
        success: true,
        odooId: partnerId,
        hubspotId: hubspotId,
        message: 'Contact synced successfully',
      };
    }

    throw new Error(`Unsupported sync type: ${type}`);
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info('Odoo MCP Server started with integrations:');
    logger.info(`- Odoo: ${process.env.ODOO_URL}`);
    logger.info(`- Zoom: ${this.zoomClient ? 'Enabled' : 'Disabled'}`);
    logger.info(`- HubSpot: ${this.hubspotClient ? 'Enabled' : 'Disabled'}`);
  }
}

// Start the server
const server = new OdooMCPServer();
server.start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
