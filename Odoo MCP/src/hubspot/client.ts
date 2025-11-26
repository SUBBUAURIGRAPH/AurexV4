/**
 * HubSpot API Client
 * Provides methods to interact with HubSpot CRM
 */

import { Client } from '@hubspot/api-client';
import { logger } from '../utils/logger.js';

export interface HubSpotConfig {
  accessToken: string;
}

export interface HubSpotContact {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  properties?: Record<string, any>;
}

export interface HubSpotDeal {
  dealName: string;
  amount?: number;
  stage?: string;
  properties?: Record<string, any>;
}

export class HubSpotClient {
  private client: Client;

  constructor(config: HubSpotConfig) {
    this.client = new Client({ accessToken: config.accessToken });
  }

  /**
   * Create a new contact
   */
  async createContact(contact: HubSpotContact): Promise<any> {
    try {
      const properties: Record<string, string> = {
        email: contact.email,
      };

      if (contact.firstName) properties.firstname = contact.firstName;
      if (contact.lastName) properties.lastname = contact.lastName;
      if (contact.company) properties.company = contact.company;
      if (contact.phone) properties.phone = contact.phone;

      // Add custom properties
      if (contact.properties) {
        Object.assign(properties, contact.properties);
      }

      const response = await this.client.crm.contacts.basicApi.create({
        properties,
        associations: [],
      });

      logger.info(`HubSpot contact created: ${response.id}`);
      return response;
    } catch (error) {
      logger.error('Failed to create HubSpot contact:', error);
      throw error;
    }
  }

  /**
   * Get contact by ID or email
   */
  async getContact(contactIdOrEmail: string): Promise<any> {
    try {
      // Try as ID first
      if (/^\d+$/.test(contactIdOrEmail)) {
        const response = await this.client.crm.contacts.basicApi.getById(
          contactIdOrEmail,
          undefined,
          undefined,
          undefined
        );
        return response;
      }

      // Search by email
      const searchResponse = await this.client.crm.contacts.searchApi.doSearch({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ' as any,
                value: contactIdOrEmail,
              },
            ],
          },
        ],
        properties: [
          'firstname',
          'lastname',
          'email',
          'phone',
          'company',
          'hs_object_id',
        ],
        limit: 1,
        after: '0',
        sorts: [],
      });

      if (searchResponse.results.length === 0) {
        throw new Error(`Contact not found: ${contactIdOrEmail}`);
      }

      return searchResponse.results[0];
    } catch (error) {
      logger.error(`Failed to get HubSpot contact ${contactIdOrEmail}:`, error);
      throw error;
    }
  }

  /**
   * Update a contact
   */
  async updateContact(contactId: string, properties: Record<string, any>): Promise<void> {
    try {
      await this.client.crm.contacts.basicApi.update(contactId, {
        properties,
      });
      logger.info(`HubSpot contact ${contactId} updated`);
    } catch (error) {
      logger.error(`Failed to update HubSpot contact ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Search contacts
   */
  async searchContacts(query?: string, limit: number = 100): Promise<any[]> {
    try {
      const searchRequest: any = {
        properties: [
          'firstname',
          'lastname',
          'email',
          'phone',
          'company',
          'hs_object_id',
        ],
        limit,
      };

      if (query) {
        searchRequest.query = query;
      }

      const response = await this.client.crm.contacts.searchApi.doSearch(searchRequest);
      return response.results;
    } catch (error) {
      logger.error('Failed to search HubSpot contacts:', error);
      throw error;
    }
  }

  /**
   * Delete a contact
   */
  async deleteContact(contactId: string): Promise<void> {
    try {
      await this.client.crm.contacts.basicApi.archive(contactId);
      logger.info(`HubSpot contact ${contactId} deleted`);
    } catch (error) {
      logger.error(`Failed to delete HubSpot contact ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new deal
   */
  async createDeal(deal: HubSpotDeal): Promise<any> {
    try {
      const properties: Record<string, string> = {
        dealname: deal.dealName,
      };

      if (deal.amount) properties.amount = deal.amount.toString();
      if (deal.stage) properties.dealstage = deal.stage;

      // Add custom properties
      if (deal.properties) {
        Object.assign(properties, deal.properties);
      }

      const response = await this.client.crm.deals.basicApi.create({
        properties,
        associations: [],
      });

      logger.info(`HubSpot deal created: ${response.id}`);
      return response;
    } catch (error) {
      logger.error('Failed to create HubSpot deal:', error);
      throw error;
    }
  }

  /**
   * Get deal by ID
   */
  async getDeal(dealId: string): Promise<any> {
    try {
      const response = await this.client.crm.deals.basicApi.getById(
        dealId,
        undefined,
        undefined,
        undefined
      );
      return response;
    } catch (error) {
      logger.error(`Failed to get HubSpot deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Update a deal
   */
  async updateDeal(dealId: string, properties: Record<string, any>): Promise<void> {
    try {
      await this.client.crm.deals.basicApi.update(dealId, {
        properties,
      });
      logger.info(`HubSpot deal ${dealId} updated`);
    } catch (error) {
      logger.error(`Failed to update HubSpot deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Create a company
   */
  async createCompany(name: string, properties?: Record<string, any>): Promise<any> {
    try {
      const companyProperties: Record<string, string> = {
        name,
        ...properties,
      };

      const response = await this.client.crm.companies.basicApi.create({
        properties: companyProperties,
        associations: [],
      });

      logger.info(`HubSpot company created: ${response.id}`);
      return response;
    } catch (error) {
      logger.error('Failed to create HubSpot company:', error);
      throw error;
    }
  }

  /**
   * Get company by ID
   */
  async getCompany(companyId: string): Promise<any> {
    try {
      const response = await this.client.crm.companies.basicApi.getById(
        companyId,
        undefined,
        undefined,
        undefined
      );
      return response;
    } catch (error) {
      logger.error(`Failed to get HubSpot company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Associate contact with company
   */
  async associateContactWithCompany(contactId: string, companyId: string): Promise<void> {
    try {
      // Use batch API for associations
      await this.client.crm.associations.batchApi.create(
        'contacts',
        'companies',
        {
          inputs: [
            {
              _from: { id: contactId },
              to: { id: companyId },
              types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 1 }],
            } as any,
          ],
        }
      );
      logger.info(`Associated contact ${contactId} with company ${companyId}`);
    } catch (error) {
      logger.error('Failed to associate contact with company:', error);
      throw error;
    }
  }

  /**
   * Get all properties for an object type
   */
  async getProperties(objectType: 'contacts' | 'companies' | 'deals'): Promise<any[]> {
    try {
      const response = await this.client.crm.properties.coreApi.getAll(objectType);
      return response.results;
    } catch (error) {
      logger.error(`Failed to get HubSpot ${objectType} properties:`, error);
      throw error;
    }
  }
}
