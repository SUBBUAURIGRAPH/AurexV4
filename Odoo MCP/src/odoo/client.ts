/**
 * Odoo XML-RPC Client
 * Provides methods to interact with Odoo ERP via XML-RPC
 */

// @ts-ignore - xmlrpc doesn't have types
import xmlrpc from 'xmlrpc';
import { logger } from '../utils/logger.js';

export interface OdooConfig {
  url: string;
  db: string;
  username: string;
  password: string;
}

export class OdooClient {
  private commonClient: any;
  private objectClient: any;
  private config: OdooConfig;
  private uid: number | null = null;

  constructor(config: OdooConfig) {
    this.config = config;

    const urlObj = new URL(config.url);
    const host = urlObj.hostname;
    const port = urlObj.port ? parseInt(urlObj.port) : (urlObj.protocol === 'https:' ? 443 : 80);
    const secure = urlObj.protocol === 'https:';

    // Initialize XML-RPC clients
    this.commonClient = secure
      ? xmlrpc.createSecureClient({ host, port, path: '/xmlrpc/2/common' })
      : xmlrpc.createClient({ host, port, path: '/xmlrpc/2/common' });

    this.objectClient = secure
      ? xmlrpc.createSecureClient({ host, port, path: '/xmlrpc/2/object' })
      : xmlrpc.createClient({ host, port, path: '/xmlrpc/2/object' });
  }

  /**
   * Authenticate with Odoo
   */
  async authenticate(): Promise<number> {
    if (this.uid) {
      return this.uid;
    }

    return new Promise((resolve, reject) => {
      this.commonClient.methodCall(
        'authenticate',
        [this.config.db, this.config.username, this.config.password, {}],
        (error: Error, value: number) => {
          if (error) {
            logger.error('Odoo authentication failed:', error);
            reject(error);
          } else if (!value) {
            reject(new Error('Authentication failed: invalid credentials'));
          } else {
            this.uid = value;
            logger.info('Odoo authentication successful');
            resolve(value);
          }
        }
      );
    });
  }

  /**
   * Execute a method on an Odoo model
   */
  private async execute(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {}
  ): Promise<any> {
    const uid = await this.authenticate();

    return new Promise((resolve, reject) => {
      this.objectClient.methodCall(
        'execute_kw',
        [this.config.db, uid, this.config.password, model, method, args, kwargs],
        (error: Error, value: any) => {
          if (error) {
            logger.error(`Odoo ${method} failed:`, error);
            reject(error);
          } else {
            resolve(value);
          }
        }
      );
    });
  }

  /**
   * Search for records
   */
  async search(model: string, domain: any[] = [], limit?: number): Promise<number[]> {
    const kwargs: Record<string, any> = {};
    if (limit) {
      kwargs.limit = limit;
    }
    return this.execute(model, 'search', [domain], kwargs);
  }

  /**
   * Read records by IDs
   */
  async read(model: string, ids: number[], fields?: string[]): Promise<any[]> {
    const kwargs: Record<string, any> = {};
    if (fields) {
      kwargs.fields = fields;
    }
    return this.execute(model, 'read', [ids], kwargs);
  }

  /**
   * Search and read records
   */
  async searchRead(
    model: string,
    domain: any[] = [],
    fields?: string[],
    limit?: number
  ): Promise<any[]> {
    const kwargs: Record<string, any> = {};
    if (fields) {
      kwargs.fields = fields;
    }
    if (limit) {
      kwargs.limit = limit;
    }
    return this.execute(model, 'search_read', [domain], kwargs);
  }

  /**
   * Create a new record
   */
  async create(model: string, values: Record<string, any>): Promise<number> {
    return this.execute(model, 'create', [values]);
  }

  /**
   * Update records
   */
  async write(model: string, ids: number[], values: Record<string, any>): Promise<boolean> {
    return this.execute(model, 'write', [ids, values]);
  }

  /**
   * Delete records
   */
  async unlink(model: string, ids: number[]): Promise<boolean> {
    return this.execute(model, 'unlink', [ids]);
  }

  /**
   * Get model fields
   */
  async fieldsGet(model: string, fields?: string[]): Promise<any> {
    const kwargs: Record<string, any> = {};
    if (fields) {
      kwargs.allfields = fields;
    }
    return this.execute(model, 'fields_get', [], kwargs);
  }

  /**
   * Check access rights
   */
  async checkAccessRights(model: string, operation: string): Promise<boolean> {
    return this.execute(model, 'check_access_rights', [operation, false]);
  }
}
