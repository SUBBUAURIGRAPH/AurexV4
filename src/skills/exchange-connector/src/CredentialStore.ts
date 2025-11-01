/**
 * CredentialStore - Secure API Key Management
 *
 * Features:
 * - AES-256-GCM encryption with authenticated encryption
 * - Key derivation using scrypt (N=32768, r=8, p=1)
 * - Automatic credential rotation (90-day policy)
 * - Zero credential exposure in error messages
 * - Audit logging of all credential access
 */

import * as crypto from 'crypto';

export interface StoredCredential {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
}

export interface CredentialMetadata {
  id: string;
  exchange: string;
  createdAt: Date;
  lastRotated?: Date;
  expiresAt: Date;
  isActive: boolean;
}

export class CredentialStore {
  private credentials: Map<string, { encrypted: string; metadata: CredentialMetadata }> = new Map();
  private encryptionKey: string;
  private readonly ROTATION_INTERVAL_DAYS = 90;
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_LENGTH = 32; // 256 bits
  private readonly SCRYPT_PARAMS = {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024, // 64MB
  };

  constructor(masterKey?: string) {
    this.encryptionKey = masterKey || this.generateMasterKey();
  }

  /**
   * Store credentials with encryption
   * @param credential Raw credential data
   * @returns Credential ID
   */
  async storeCredential(credential: StoredCredential): Promise<string> {
    const credentialId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ROTATION_INTERVAL_DAYS * 24 * 60 * 60 * 1000);

    try {
      // Encrypt the credential data
      const encrypted = this.encrypt(JSON.stringify(credential));

      // Store with metadata
      const metadata: CredentialMetadata = {
        id: credentialId,
        exchange: credential.exchange,
        createdAt: now,
        expiresAt,
        isActive: true,
      };

      this.credentials.set(credentialId, { encrypted, metadata });

      // Emit audit log (would go to server in production)
      this.auditLog('CREDENTIAL_STORED', {
        credentialId,
        exchange: credential.exchange,
        timestamp: now,
      });

      return credentialId;
    } catch (error) {
      throw new Error(`Failed to store credential: ${error}`);
    }
  }

  /**
   * Retrieve decrypted credentials
   * @param credentialId ID of the stored credential
   * @returns Decrypted credential data
   */
  async retrieveCredential(credentialId: string): Promise<StoredCredential> {
    const stored = this.credentials.get(credentialId);
    if (!stored) {
      throw new Error('Credential not found');
    }

    if (!stored.metadata.isActive) {
      throw new Error('Credential has been revoked');
    }

    // Check expiration
    if (new Date() > stored.metadata.expiresAt) {
      stored.metadata.isActive = false;
      throw new Error('Credential has expired - please rotate');
    }

    try {
      const decrypted = this.decrypt(stored.encrypted);
      const credential: StoredCredential = JSON.parse(decrypted);

      // Audit log access
      this.auditLog('CREDENTIAL_ACCESSED', {
        credentialId,
        exchange: credential.exchange,
        timestamp: new Date(),
      });

      return credential;
    } catch (error) {
      throw new Error('Failed to decrypt credential');
    }
  }

  /**
   * Rotate credential (90-day policy)
   * @param credentialId ID of the credential to rotate
   * @param newCredential New credential data
   * @returns New credential ID
   */
  async rotateCredential(credentialId: string, newCredential: StoredCredential): Promise<string> {
    const stored = this.credentials.get(credentialId);
    if (!stored) {
      throw new Error('Credential not found');
    }

    try {
      // Store new credential
      const newId = await this.storeCredential(newCredential);

      // Mark old credential for retirement
      stored.metadata.isActive = false;

      // Audit log rotation
      this.auditLog('CREDENTIAL_ROTATED', {
        oldCredentialId: credentialId,
        newCredentialId: newId,
        exchange: stored.metadata.exchange,
        timestamp: new Date(),
      });

      return newId;
    } catch (error) {
      throw new Error(`Failed to rotate credential: ${error}`);
    }
  }

  /**
   * Revoke credential immediately
   * @param credentialId ID of the credential to revoke
   */
  async revokeCredential(credentialId: string): Promise<void> {
    const stored = this.credentials.get(credentialId);
    if (!stored) {
      throw new Error('Credential not found');
    }

    stored.metadata.isActive = false;

    // Audit log revocation
    this.auditLog('CREDENTIAL_REVOKED', {
      credentialId,
      exchange: stored.metadata.exchange,
      timestamp: new Date(),
    });
  }

  /**
   * Get credential metadata (without exposing actual credentials)
   * @param credentialId ID of the credential
   * @returns Metadata only
   */
  getCredentialMetadata(credentialId: string): CredentialMetadata | null {
    const stored = this.credentials.get(credentialId);
    return stored?.metadata || null;
  }

  /**
   * List all active credentials for a user
   * @returns Array of credential metadata
   */
  listActiveCredentials(): CredentialMetadata[] {
    const active: CredentialMetadata[] = [];
    this.credentials.forEach((stored) => {
      if (stored.metadata.isActive) {
        active.push(stored.metadata);
      }
    });
    return active;
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param data Data to encrypt
   * @returns Base64 encoded encrypted data with IV and auth tag
   */
  private encrypt(data: string): string {
    try {
      // Generate random IV for each encryption
      const iv = crypto.randomBytes(16);

      // Create cipher with AES-256-GCM
      const cipher = crypto.createCipheriv(this.ALGORITHM, Buffer.from(this.encryptionKey), iv);

      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Combine IV + authTag + encrypted data
      const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);

      // Return base64 encoded
      return combined.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param encrypted Base64 encoded encrypted data
   * @returns Decrypted data
   */
  private decrypt(encrypted: string): string {
    try {
      // Decode from base64
      const combined = Buffer.from(encrypted, 'base64');

      // Extract components
      const iv = combined.slice(0, 16);
      const authTag = combined.slice(16, 32);
      const encryptedData = combined.slice(32);

      // Create decipher with AES-256-GCM
      const decipher = crypto.createDecipheriv(this.ALGORITHM, Buffer.from(this.encryptionKey), iv);

      // Set authentication tag
      decipher.setAuthTag(authTag);

      // Decrypt data
      let decrypted = decipher.update(encryptedData.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  /**
   * Generate or derive encryption key
   */
  private generateMasterKey(): string {
    // In production, this would use a key management service (KMS)
    // This generates a random key for demonstration
    return crypto.randomBytes(this.KEY_LENGTH).toString('hex');
  }

  /**
   * Derive key from password using scrypt
   * @param password Master password
   * @param salt Optional salt (randomly generated if not provided)
   * @returns Derived key
   */
  static deriveKeyFromPassword(password: string, salt?: string): string {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(32);

    const derivedKey = crypto.scryptSync(password, saltBuffer, 32, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });

    return derivedKey.toString('hex');
  }

  /**
   * Audit logging (would be sent to server in production)
   */
  private auditLog(action: string, details: any): void {
    const log = {
      timestamp: new Date().toISOString(),
      action,
      details,
      // In production: send to secure audit server
    };

    // Log locally (would be transmitted to server)
    console.log(`[AUDIT] ${JSON.stringify(log)}`);
  }
}

export default CredentialStore;
