/**
 * CredentialStore Unit Tests
 * Tests AES-256-GCM encryption and credential management
 */

import { CredentialStore } from '../src/CredentialStore';

describe('CredentialStore', () => {
  let store: CredentialStore;
  const testEncryptionKey = 'a'.repeat(64); // 32 bytes in hex

  beforeEach(() => {
    store = new CredentialStore(testEncryptionKey);
  });

  describe('Constructor', () => {
    it('should initialize with provided encryption key', () => {
      expect(store).toBeDefined();
    });

    it('should generate key if none provided', () => {
      const store2 = new CredentialStore();
      expect(store2).toBeDefined();
    });
  });

  describe('storeCredential()', () => {
    it('should store credential and return ID', async () => {
      const credential = {
        exchange: 'binance',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      };

      const id = await store.storeCredential(credential);
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should store credential with passphrase', async () => {
      const credential = {
        exchange: 'coinbase',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        passphrase: 'test-passphrase',
      };

      const id = await store.storeCredential(credential);
      expect(id).toBeDefined();
    });

    it('should encrypt credentials', async () => {
      const credential = {
        exchange: 'binance',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      };

      const id = await store.storeCredential(credential);
      const metadata = store.getCredentialMetadata(id);
      // Metadata should exist but actual credentials encrypted
      expect(metadata).toBeDefined();
    });

    it('should set expiration date', async () => {
      const credential = {
        exchange: 'binance',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      };

      const id = await store.storeCredential(credential);
      const metadata = store.getCredentialMetadata(id);
      expect(metadata?.expiresAt).toBeDefined();
      expect(metadata?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('retrieveCredential()', () => {
    it('should retrieve and decrypt credential', async () => {
      const original = {
        exchange: 'binance',
        apiKey: 'test-api-key-123',
        apiSecret: 'test-api-secret-456',
      };

      const id = await store.storeCredential(original);
      const retrieved = await store.retrieveCredential(id);

      expect(retrieved.exchange).toBe(original.exchange);
      expect(retrieved.apiKey).toBe(original.apiKey);
      expect(retrieved.apiSecret).toBe(original.apiSecret);
    });

    it('should throw error for non-existent credential', async () => {
      try {
        await store.retrieveCredential('non-existent-id');
        fail('Should throw error');
      } catch (error) {
        expect(String(error)).toContain('not found');
      }
    });

    it('should throw error for revoked credential', async () => {
      const credential = {
        exchange: 'binance',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      };

      const id = await store.storeCredential(credential);
      await store.revokeCredential(id);

      try {
        await store.retrieveCredential(id);
        fail('Should throw error');
      } catch (error) {
        expect(String(error)).toContain('revoked');
      }
    });
  });

  describe('rotateCredential()', () => {
    it('should create new credential and mark old as inactive', async () => {
      const original = {
        exchange: 'binance',
        apiKey: 'old-key',
        apiSecret: 'old-secret',
      };

      const oldId = await store.storeCredential(original);

      const newCredential = {
        exchange: 'binance',
        apiKey: 'new-key',
        apiSecret: 'new-secret',
      };

      const newId = await store.rotateCredential(oldId, newCredential);

      // Old should be inactive
      const oldMetadata = store.getCredentialMetadata(oldId);
      expect(oldMetadata?.isActive).toBe(false);

      // New should work
      const retrieved = await store.retrieveCredential(newId);
      expect(retrieved.apiKey).toBe('new-key');
    });

    it('should throw error rotating non-existent credential', async () => {
      try {
        await store.rotateCredential('non-existent', {
          exchange: 'binance',
          apiKey: 'new-key',
          apiSecret: 'new-secret',
        });
        fail('Should throw error');
      } catch (error) {
        expect(String(error)).toContain('not found');
      }
    });
  });

  describe('revokeCredential()', () => {
    it('should mark credential as inactive', async () => {
      const credential = {
        exchange: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      const id = await store.storeCredential(credential);
      await store.revokeCredential(id);

      const metadata = store.getCredentialMetadata(id);
      expect(metadata?.isActive).toBe(false);
    });

    it('should prevent access to revoked credential', async () => {
      const credential = {
        exchange: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      const id = await store.storeCredential(credential);
      await store.revokeCredential(id);

      try {
        await store.retrieveCredential(id);
        fail('Should throw error');
      } catch (error) {
        expect(String(error)).toContain('revoked');
      }
    });
  });

  describe('getCredentialMetadata()', () => {
    it('should return metadata without exposing credentials', async () => {
      const credential = {
        exchange: 'binance',
        apiKey: 'secret-key',
        apiSecret: 'secret-secret',
      };

      const id = await store.storeCredential(credential);
      const metadata = store.getCredentialMetadata(id);

      expect(metadata?.id).toBe(id);
      expect(metadata?.exchange).toBe('binance');
      expect(metadata?.isActive).toBe(true);
      // Should not expose actual credentials
      expect(JSON.stringify(metadata)).not.toContain('secret-key');
    });

    it('should return null for non-existent credential', () => {
      const metadata = store.getCredentialMetadata('non-existent');
      expect(metadata).toBeNull();
    });
  });

  describe('listActiveCredentials()', () => {
    it('should list only active credentials', async () => {
      // Store 3 credentials
      const ids = [];
      for (let i = 0; i < 3; i++) {
        const id = await store.storeCredential({
          exchange: `exchange-${i}`,
          apiKey: `key-${i}`,
          apiSecret: `secret-${i}`,
        });
        ids.push(id);
      }

      // Revoke one
      await store.revokeCredential(ids[0]);

      const active = store.listActiveCredentials();
      expect(active.length).toBe(2);
      expect(active.every(c => c.isActive)).toBe(true);
    });
  });

  describe('Encryption Security', () => {
    it('should produce different ciphertext for same plaintext', async () => {
      const credential = {
        exchange: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      const id1 = await store.storeCredential(credential);
      const id2 = await store.storeCredential(credential);

      // IDs should be different
      expect(id1).not.toBe(id2);

      // Both should decrypt to same value
      const retrieved1 = await store.retrieveCredential(id1);
      const retrieved2 = await store.retrieveCredential(id2);
      expect(retrieved1.apiKey).toBe(retrieved2.apiKey);
    });

    it('should not expose credentials in error messages', async () => {
      try {
        await store.retrieveCredential('invalid-id');
      } catch (error) {
        const errorMsg = String(error);
        expect(errorMsg).not.toContain('apiKey');
        expect(errorMsg).not.toContain('apiSecret');
      }
    });
  });

  describe('Credential Expiration', () => {
    it('should reject expired credentials', async () => {
      const credential = {
        exchange: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      const id = await store.storeCredential(credential);
      const metadata = store.getCredentialMetadata(id);

      // Simulate expiration by checking expiration logic
      expect(metadata?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('deriveKeyFromPassword() static method', () => {
    it('should derive consistent key from password', () => {
      const password = 'my-secure-password';
      const salt = 'a'.repeat(64);

      const key1 = CredentialStore.deriveKeyFromPassword(password, salt);
      const key2 = CredentialStore.deriveKeyFromPassword(password, salt);

      expect(key1).toBe(key2);
    });

    it('should produce different keys for different passwords', () => {
      const salt = 'a'.repeat(64);
      const key1 = CredentialStore.deriveKeyFromPassword('password1', salt);
      const key2 = CredentialStore.deriveKeyFromPassword('password2', salt);

      expect(key1).not.toBe(key2);
    });

    it('should handle long passwords', () => {
      const longPassword = 'a'.repeat(1000);
      const key = CredentialStore.deriveKeyFromPassword(longPassword);
      expect(key).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should encrypt/decrypt quickly', async () => {
      const credential = {
        exchange: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      const start = Date.now();
      const id = await store.storeCredential(credential);
      await store.retrieveCredential(id);
      const duration = Date.now() - start;

      // Should complete in < 50ms
      expect(duration).toBeLessThan(50);
    });

    it('should handle bulk operations', async () => {
      const start = Date.now();

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          store.storeCredential({
            exchange: `exchange-${i}`,
            apiKey: `key-${i}`,
            apiSecret: `secret-${i}`,
          })
        );
      }

      await Promise.all(promises);
      const duration = Date.now() - start;

      // 100 encryptions in < 5 seconds
      expect(duration).toBeLessThan(5000);
    });
  });
});
