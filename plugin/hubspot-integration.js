/**
 * HubSpot Integration Module for J4C Agent Plugin
 * Connects J4C agents with Claude Code and HubSpot CRM
 *
 * Features:
 * - Contact sync from HubSpot
 * - Deal tracking and updates
 * - Campaign management
 * - Email automation
 * - Analytics and reporting
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const axios = require('axios');
const EventEmitter = require('events');

class HubSpotIntegration extends EventEmitter {
  constructor(config = {}) {
    super();

    this.name = 'HubSpot Integration';
    this.version = '1.0.0';

    // HubSpot configuration
    this.hubspotApiKey = config.apiKey || process.env.HUBSPOT_API_KEY;
    this.hubspotApiUrl = config.apiUrl || 'https://api.hubapi.com';
    this.hubspotPortalId = config.portalId || process.env.HUBSPOT_PORTAL_ID;

    // Integration configuration
    this.enabled = config.enabled !== false;
    this.autoSync = config.autoSync !== false;
    this.syncInterval = config.syncInterval || 3600000; // 1 hour default

    // Claude Code configuration
    this.claudeCodeEnabled = config.claudeCode?.enabled !== false;
    this.claudeCodeApiUrl = config.claudeCode?.apiUrl || process.env.CLAUDE_CODE_API_URL;

    // Caching
    this.cache = new Map();
    this.cacheExpiry = config.cacheExpiry || 300000; // 5 minutes default

    // State
    this.initialized = false;
    this.syncInProgress = false;
    this.lastSyncTime = null;

    if (!this.hubspotApiKey) {
      console.warn('⚠️  HubSpot API key not configured');
    }
  }

  /**
   * Initialize HubSpot integration
   */
  async initialize() {
    try {
      if (!this.hubspotApiKey) {
        throw new Error('HubSpot API key is required');
      }

      // Verify HubSpot connection
      const status = await this.verifyConnection();

      if (!status.success) {
        throw new Error('Failed to connect to HubSpot: ' + status.error);
      }

      this.initialized = true;

      console.log('✅ HubSpot integration initialized successfully');

      // Start auto-sync if enabled
      if (this.autoSync) {
        this.startAutoSync();
      }

      this.emit('initialized');
      return { success: true, message: 'HubSpot integration initialized' };
    } catch (error) {
      console.error('❌ HubSpot initialization failed:', error.message);
      this.emit('error', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify connection to HubSpot
   */
  async verifyConnection() {
    try {
      const response = await axios.get(`${this.hubspotApiUrl}/crm/v3/objects/contacts`, {
        headers: {
          'Authorization': `Bearer ${this.hubspotApiKey}`,
          'Content-Type': 'application/json'
        },
        params: { limit: 1 }
      });

      return { success: true, portalId: this.hubspotPortalId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // CONTACT OPERATIONS
  // ==========================================

  /**
   * Get all contacts from HubSpot
   */
  async getContacts(options = {}) {
    try {
      const cacheKey = `contacts_${JSON.stringify(options)}`;
      const cached = this.getFromCache(cacheKey);

      if (cached) {
        return cached;
      }

      const response = await axios.get(
        `${this.hubspotApiUrl}/crm/v3/objects/contacts`,
        {
          headers: this.getHeaders(),
          params: {
            limit: options.limit || 100,
            after: options.after || undefined,
            properties: options.properties || [
              'firstname',
              'lastname',
              'email',
              'phone',
              'company',
              'lifecyclestage'
            ]
          }
        }
      );

      const contacts = response.data.results.map(item => ({
        id: item.id,
        email: item.properties.email,
        firstName: item.properties.firstname,
        lastName: item.properties.lastname,
        phone: item.properties.phone,
        company: item.properties.company,
        lifecycleStage: item.properties.lifecyclestage,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }));

      this.setInCache(cacheKey, contacts);
      this.emit('contactsRetrieved', { count: contacts.length });

      return {
        success: true,
        data: contacts,
        total: contacts.length,
        paging: response.data.paging
      };
    } catch (error) {
      console.error('❌ Error fetching contacts:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get a single contact by email
   */
  async getContactByEmail(email) {
    try {
      const response = await axios.get(
        `${this.hubspotApiUrl}/crm/v3/objects/contacts`,
        {
          headers: this.getHeaders(),
          params: {
            limit: 1,
            filterGroups: [{
              filters: [{
                propertyName: 'email',
                operator: 'EQ',
                value: email
              }]
            }]
          }
        }
      );

      if (response.data.results.length === 0) {
        return { success: false, error: 'Contact not found' };
      }

      const item = response.data.results[0];
      return {
        success: true,
        data: {
          id: item.id,
          email: item.properties.email,
          firstName: item.properties.firstname,
          lastName: item.properties.lastname,
          phone: item.properties.phone,
          company: item.properties.company,
          lifecycleStage: item.properties.lifecyclestage
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new contact in HubSpot
   */
  async createContact(contactData) {
    try {
      const response = await axios.post(
        `${this.hubspotApiUrl}/crm/v3/objects/contacts`,
        {
          properties: {
            email: contactData.email,
            firstname: contactData.firstName,
            lastname: contactData.lastName,
            phone: contactData.phone,
            company: contactData.company
          }
        },
        { headers: this.getHeaders() }
      );

      const contact = {
        id: response.data.id,
        email: response.data.properties.email,
        firstName: response.data.properties.firstname,
        lastName: response.data.properties.lastname
      };

      this.clearCache();
      this.emit('contactCreated', contact);

      return { success: true, data: contact };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an existing contact
   */
  async updateContact(contactId, updates) {
    try {
      const response = await axios.patch(
        `${this.hubspotApiUrl}/crm/v3/objects/contacts/${contactId}`,
        {
          properties: updates
        },
        { headers: this.getHeaders() }
      );

      this.clearCache();
      this.emit('contactUpdated', { id: contactId, updates });

      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // DEAL OPERATIONS
  // ==========================================

  /**
   * Get all deals from HubSpot
   */
  async getDeals(options = {}) {
    try {
      const response = await axios.get(
        `${this.hubspotApiUrl}/crm/v3/objects/deals`,
        {
          headers: this.getHeaders(),
          params: {
            limit: options.limit || 100,
            properties: options.properties || [
              'dealname',
              'dealstage',
              'amount',
              'closedate',
              'hubspot_owner_id'
            ]
          }
        }
      );

      const deals = response.data.results.map(item => ({
        id: item.id,
        name: item.properties.dealname,
        stage: item.properties.dealstage,
        amount: item.properties.amount,
        closeDate: item.properties.closedate,
        ownerId: item.properties.hubspot_owner_id
      }));

      this.emit('dealsRetrieved', { count: deals.length });

      return {
        success: true,
        data: deals,
        total: deals.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new deal
   */
  async createDeal(dealData) {
    try {
      const response = await axios.post(
        `${this.hubspotApiUrl}/crm/v3/objects/deals`,
        {
          properties: {
            dealname: dealData.name,
            dealstage: dealData.stage || 'negotiation',
            amount: dealData.amount,
            closedate: dealData.closeDate
          }
        },
        { headers: this.getHeaders() }
      );

      const deal = {
        id: response.data.id,
        name: response.data.properties.dealname,
        stage: response.data.properties.dealstage,
        amount: response.data.properties.amount
      };

      this.clearCache();
      this.emit('dealCreated', deal);

      return { success: true, data: deal };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update deal stage
   */
  async updateDealStage(dealId, newStage) {
    try {
      const response = await axios.patch(
        `${this.hubspotApiUrl}/crm/v3/objects/deals/${dealId}`,
        {
          properties: {
            dealstage: newStage
          }
        },
        { headers: this.getHeaders() }
      );

      this.clearCache();
      this.emit('dealUpdated', { id: dealId, stage: newStage });

      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // COMPANY OPERATIONS
  // ==========================================

  /**
   * Get all companies
   */
  async getCompanies(options = {}) {
    try {
      const response = await axios.get(
        `${this.hubspotApiUrl}/crm/v3/objects/companies`,
        {
          headers: this.getHeaders(),
          params: {
            limit: options.limit || 100,
            properties: options.properties || [
              'name',
              'domain',
              'industry',
              'numberofemployees',
              'annualrevenue'
            ]
          }
        }
      );

      const companies = response.data.results.map(item => ({
        id: item.id,
        name: item.properties.name,
        domain: item.properties.domain,
        industry: item.properties.industry,
        employees: item.properties.numberofemployees,
        revenue: item.properties.annualrevenue
      }));

      return {
        success: true,
        data: companies,
        total: companies.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // CAMPAIGN OPERATIONS
  // ==========================================

  /**
   * Get all campaigns
   */
  async getCampaigns() {
    try {
      const response = await axios.get(
        `${this.hubspotApiUrl}/marketing/v3/campaigns`,
        { headers: this.getHeaders() }
      );

      const campaigns = response.data.results || [];

      return {
        success: true,
        data: campaigns,
        total: campaigns.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new campaign
   */
  async createCampaign(campaignData) {
    try {
      const response = await axios.post(
        `${this.hubspotApiUrl}/marketing/v3/campaigns`,
        {
          name: campaignData.name,
          description: campaignData.description,
          status: 'draft'
        },
        { headers: this.getHeaders() }
      );

      this.emit('campaignCreated', response.data);

      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // EMAIL OPERATIONS
  // ==========================================

  /**
   * Send email through HubSpot
   */
  async sendEmail(recipients, subject, body, options = {}) {
    try {
      // This would typically use HubSpot's email API or third-party integration
      const response = await axios.post(
        `${this.hubspotApiUrl}/crm/v3/objects/emails`,
        {
          properties: {
            hs_timestamp: new Date().toISOString(),
            hs_email_subject: subject,
            hs_email_text: body,
            hs_email_to: Array.isArray(recipients) ? recipients.join(';') : recipients
          }
        },
        { headers: this.getHeaders() }
      );

      this.emit('emailSent', { recipients, subject });

      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // SYNC OPERATIONS
  // ==========================================

  /**
   * Sync data between HubSpot and Claude Code
   */
  async syncWithClaudeCode(dataType = 'all') {
    try {
      if (!this.claudeCodeEnabled) {
        return { success: false, error: 'Claude Code integration not enabled' };
      }

      const syncData = {
        timestamp: new Date().toISOString(),
        dataType: dataType,
        data: {}
      };

      // Fetch data from HubSpot
      if (dataType === 'all' || dataType === 'contacts') {
        const contacts = await this.getContacts({ limit: 500 });
        syncData.data.contacts = contacts.data;
      }

      if (dataType === 'all' || dataType === 'deals') {
        const deals = await this.getDeals({ limit: 500 });
        syncData.data.deals = deals.data;
      }

      if (dataType === 'all' || dataType === 'companies') {
        const companies = await this.getCompanies({ limit: 500 });
        syncData.data.companies = companies.data;
      }

      // Send to Claude Code
      if (this.claudeCodeApiUrl) {
        await this.sendToClaudeCode(syncData);
      }

      this.lastSyncTime = new Date();
      this.emit('syncCompleted', { dataType, timestamp: this.lastSyncTime });

      return {
        success: true,
        message: `Synced ${dataType} data with Claude Code`,
        lastSync: this.lastSyncTime
      };
    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send data to Claude Code API
   */
  async sendToClaudeCode(data) {
    try {
      if (!this.claudeCodeApiUrl) {
        console.warn('Claude Code API URL not configured');
        return;
      }

      await axios.post(
        `${this.claudeCodeApiUrl}/integrations/hubspot/sync`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Integration': 'HubSpot',
            'X-Timestamp': new Date().toISOString()
          },
          timeout: 30000
        }
      );

      this.emit('claudeCodeSyncSuccess', data);
    } catch (error) {
      console.error('❌ Claude Code sync failed:', error.message);
      this.emit('claudeCodeSyncError', error);
    }
  }

  /**
   * Start automatic sync
   */
  startAutoSync() {
    if (this.syncInProgress) return;

    this.syncInterval = setInterval(async () => {
      if (this.syncInProgress) return;

      this.syncInProgress = true;
      console.log('🔄 Starting auto-sync with HubSpot...');

      try {
        await this.syncWithClaudeCode('all');
        console.log('✅ Auto-sync completed successfully');
      } catch (error) {
        console.error('❌ Auto-sync failed:', error.message);
      } finally {
        this.syncInProgress = false;
      }
    }, this.syncInterval);

    console.log(`🔄 Auto-sync started (interval: ${this.syncInterval}ms)`);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('🛑 Auto-sync stopped');
    }
  }

  // ==========================================
  // ANALYTICS
  // ==========================================

  /**
   * Get contact analytics
   */
  async getContactAnalytics() {
    try {
      const contacts = await this.getContacts({ limit: 1000 });

      if (!contacts.success) {
        return contacts;
      }

      const analytics = {
        totalContacts: contacts.data.length,
        byLifecycleStage: {},
        byCompany: {},
        emailAddresses: contacts.data.filter(c => c.email).length
      };

      contacts.data.forEach(contact => {
        // Count by lifecycle stage
        const stage = contact.lifecycleStage || 'unknown';
        analytics.byLifecycleStage[stage] = (analytics.byLifecycleStage[stage] || 0) + 1;

        // Count by company
        if (contact.company) {
          analytics.byCompany[contact.company] = (analytics.byCompany[contact.company] || 0) + 1;
        }
      });

      this.emit('analyticsGenerated', analytics);

      return { success: true, data: analytics };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get deal analytics
   */
  async getDealAnalytics() {
    try {
      const deals = await this.getDeals({ limit: 1000 });

      if (!deals.success) {
        return deals;
      }

      const analytics = {
        totalDeals: deals.data.length,
        byStage: {},
        totalAmount: 0,
        averageDealSize: 0
      };

      deals.data.forEach(deal => {
        // Count by stage
        const stage = deal.stage || 'unknown';
        analytics.byStage[stage] = (analytics.byStage[stage] || 0) + 1;

        // Calculate totals
        if (deal.amount) {
          analytics.totalAmount += parseFloat(deal.amount);
        }
      });

      analytics.averageDealSize = deals.data.length > 0
        ? analytics.totalAmount / deals.data.length
        : 0;

      this.emit('dealAnalyticsGenerated', analytics);

      return { success: true, data: analytics };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Get request headers for HubSpot API
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.hubspotApiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Cache management - get from cache
   */
  getFromCache(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Cache management - set cache
   */
  setInCache(key, data) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheExpiry
    });
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get integration status
   */
  getStatus() {
    return {
      name: this.name,
      version: this.version,
      enabled: this.enabled,
      initialized: this.initialized,
      claudeCodeEnabled: this.claudeCodeEnabled,
      autoSyncEnabled: this.autoSync,
      lastSyncTime: this.lastSyncTime,
      cacheSize: this.cache.size
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.stopAutoSync();
    this.clearCache();
    this.removeAllListeners();
    console.log('🛑 HubSpot integration shutdown');
  }
}

module.exports = HubSpotIntegration;
