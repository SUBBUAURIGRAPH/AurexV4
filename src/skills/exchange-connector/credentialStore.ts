/**
 * Credential Store
 * Securely stores and manages exchange API credentials
 * Supports encryption, rotation policies, and Vault integration
 * Version: 1.0.0
 */

import crypto from 'crypto';
import { CredentialConfig, StoredCredential, SecurityConfig } from './types';

export class CredentialStore {
  private credentials: Map<string, StoredCredential>;
  private encryptionKey: string;
  private config: SecurityConfig;
  private rotationLog: Map<string, Date[]>;

  constructor(config?: SecurityConfig, encryptionKey?: string) {
    this.credentials = new Map();
    this.rotationLog = new Map();
    this.config = {
      credentialEncryption: config?.credentialEncryption || 'aes-256-gcm',
      vault: config?.vault || 'local',
      ipWhitelisting: config?.ipWhitelisting || false,
      rotationPolicy: config?.rotationPolicy || '90days',
      auditLogging: config?.auditLogging || true,
    };
    this.encryptionKey = encryptionKey || process.env.ENCRYPTION_KEY || 'default-insecure-key';
  }

  /**
   * Store credentials for an exchange
   */
  storeCredentials(exchangeName: string, creds: CredentialConfig): boolean {
    try {
      const encrypted = this.encryptCredentials(creds);
      const stored: StoredCredential = {
        exchangeName,
        encrypted,
        createdAt: new Date(),
        rotatedAt: new Date(),
        expiresAt: this.calculateExpiration(),
      };

      this.credentials.set(exchangeName, stored);
      this.logRotation(exchangeName);
      return true;
    } catch (error) {
      console.error(`Error storing credentials for ${exchangeName}:`, error);
      return false;
    }
  }

  /**
   * Retrieve credentials for an exchange
   */
  getCredentials(exchangeName: string): CredentialConfig | null {
    try {
      const stored = this.credentials.get(exchangeName);
      if (!stored) {
        return null;
      }

      // Check if credentials are expired
      if (stored.expiresAt && new Date() > stored.expiresAt) {
        console.warn(`Credentials for ${exchangeName} have expired`);
        return null;
      }

      return this.decryptCredentials(stored.encrypted);
    } catch (error) {
      console.error(`Error retrieving credentials for ${exchangeName}:`, error);
      return null;
    }
  }

  /**
   * Encrypt credentials using AES-256-GCM
   */
  private encryptCredentials(creds: CredentialConfig): any {
    const algorithm = 'aes-256-gcm';
    const key = this.deriveKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(JSON.stringify(creds), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      apiKey: encrypted,
      apiSecret: authTag.toString('hex'),
      apiPassphrase: iv.toString('hex'),
    };
  }

  /**
   * Decrypt credentials
   */
  private decryptCredentials(encrypted: any): CredentialConfig {
    const algorithm = 'aes-256-gcm';
    const key = this.deriveKey();

    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(encrypted.apiPassphrase, 'hex')
    );

    decipher.setAuthTag(Buffer.from(encrypted.apiSecret, 'hex'));

    let decrypted = decipher.update(encrypted.apiKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Derive encryption key from master key
   */
  private deriveKey(): Buffer {
    const salt = 'exchange-connector-salt'; // In production, use random salt
    return crypto.scryptSync(this.encryptionKey, salt, 32);
  }

  /**
   * Rotate credentials for an exchange
   */
  rotateCredentials(exchangeName: string, newCreds: CredentialConfig): boolean {
    try {
      const oldCreds = this.credentials.get(exchangeName);
      if (!oldCreds) {
        console.warn(`No existing credentials found for ${exchangeName}`);
      }

      // Store new credentials
      this.storeCredentials(exchangeName, newCreds);

      // Log rotation
      this.logRotation(exchangeName);

      return true;
    } catch (error) {
      console.error(`Error rotating credentials for ${exchangeName}:`, error);
      return false;
    }
  }

  /**
   * Check if credentials need rotation
   */
  needsRotation(exchangeName: string): boolean {
    const stored = this.credentials.get(exchangeName);
    if (!stored) return false;

    if (!stored.rotatedAt) return true;

    const daysSinceRotation = Math.floor(
      (new Date().getTime() - stored.rotatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const rotationDays = parseInt(this.config.rotationPolicy?.match(/\d+/) || ['90'][0]);
    return daysSinceRotation >= rotationDays;
  }

  /**
   * Get credentials close to expiration
   */
  getExpiringCredentials(daysUntilExpiry: number = 7): string[] {
    const expiringExchanges: string[] = [];
    const now = new Date().getTime();

    for (const [exchange, stored] of this.credentials) {
      if (stored.expiresAt) {
        const daysUntil = (stored.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24);
        if (daysUntil <= daysUntilExpiry && daysUntil > 0) {
          expiringExchanges.push(exchange);
        }
      }
    }

    return expiringExchanges;
  }

  /**
   * Delete credentials for an exchange
   */
  deleteCredentials(exchangeName: string): boolean {
    return this.credentials.delete(exchangeName);
  }

  /**
   * Get all stored exchanges
   */
  getStoredExchanges(): string[] {
    return Array.from(this.credentials.keys());
  }

  /**
   * Log credential rotation
   */
  private logRotation(exchangeName: string): void {
    if (!this.rotationLog.has(exchangeName)) {
      this.rotationLog.set(exchangeName, []);
    }
    const log = this.rotationLog.get(exchangeName)!;
    log.push(new Date());

    // Keep only last 100 rotation logs
    if (log.length > 100) {
      log.shift();
    }
  }

  /**
   * Get rotation history
   */
  getRotationHistory(exchangeName: string): Date[] {
    return this.rotationLog.get(exchangeName) || [];
  }

  /**
   * Calculate expiration date based on rotation policy
   */
  private calculateExpiration(): Date {
    const days = parseInt(this.config.rotationPolicy?.match(/\d+/) || ['90'][0]);
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + days);
    return expiration;
  }

  /**
   * Validate credentials
   */
  validateCredentials(creds: CredentialConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!creds.apiKey || creds.apiKey.trim() === '') {
      errors.push('API key is required');
    }

    if (!creds.apiSecret || creds.apiSecret.trim() === '') {
      errors.push('API secret is required');
    }

    // Check key length (most exchanges use 64+ character keys)
    if (creds.apiKey && creds.apiKey.length < 10) {
      errors.push('API key appears too short (typically 64+ characters)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export credentials status (for diagnostics, no secrets)
   */
  exportStatus(): Record<string, any> {
    const status: Record<string, any> = {};

    for (const [exchange, stored] of this.credentials) {
      status[exchange] = {
        storedAt: stored.createdAt,
        rotatedAt: stored.rotatedAt,
        expiresAt: stored.expiresAt,
        expiresIn: stored.expiresAt
          ? Math.ceil((stored.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) + ' days'
          : 'unknown',
        needsRotation: this.needsRotation(exchange),
      };
    }

    return status;
  }

  /**
   * Clear all credentials
   */
  clear(): void {
    this.credentials.clear();
    this.rotationLog.clear();
  }
}

export default CredentialStore;
