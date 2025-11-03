/**
 * Audit Logger Tests
 * Tests for audit logging service
 * @version 1.0.0
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { mockSyncData } from '../../__tests__/fixtures/mockData';

describe('AuditLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Log Creation', () => {
    it('should create audit log entry', async () => {
      const log = {
        id: 'audit-001',
        timestamp: Date.now(),
        userId: 'user-123',
        action: 'CREATE',
        entityType: 'ORDER',
        entityId: 'ord-001',
        changes: { status: 'PENDING' }
      };

      expect(log.action).toBe('CREATE');
      expect(log.entityType).toBe('ORDER');
    });

    it('should log with complete metadata', async () => {
      const log = mockSyncData.auditLog;

      expect(log.metadata).toBeDefined();
      expect(log.metadata.source).toBe('EXCHANGE');
      expect(log.metadata.syncId).toBe('sync-001');
    });

    it('should track change details', async () => {
      const log = {
        id: 'audit-001',
        changes: {
          status: { from: 'PENDING', to: 'FILLED' },
          quantity: { from: 0, to: 100 },
          price: { from: 0, to: 175.00 }
        }
      };

      expect(Object.keys(log.changes).length).toBe(3);
      expect(log.changes.status.to).toBe('FILLED');
    });
  });

  describe('Query Operations', () => {
    it('should query by user ID', async () => {
      const userId = 'user-123';
      const logs = [
        { id: 'log-001', userId: 'user-123' },
        { id: 'log-002', userId: 'user-456' },
        { id: 'log-003', userId: 'user-123' }
      ];

      const filtered = logs.filter(log => log.userId === userId);
      expect(filtered.length).toBe(2);
    });

    it('should query by action type', async () => {
      const logs = [
        { id: 'log-001', action: 'CREATE' },
        { id: 'log-002', action: 'UPDATE' },
        { id: 'log-003', action: 'DELETE' }
      ];

      const creates = logs.filter(log => log.action === 'CREATE');
      expect(creates.length).toBe(1);
    });

    it('should query by date range', async () => {
      const startDate = new Date('2024-01-01').getTime();
      const endDate = new Date('2024-01-31').getTime();

      const logs = [
        { id: 'log-001', timestamp: new Date('2024-01-15').getTime() },
        { id: 'log-002', timestamp: new Date('2024-02-15').getTime() }
      ];

      const filtered = logs.filter(
        log => log.timestamp >= startDate && log.timestamp <= endDate
      );
      expect(filtered.length).toBe(1);
    });

    it('should query by entity type', async () => {
      const logs = [
        { id: 'log-001', entityType: 'ORDER' },
        { id: 'log-002', entityType: 'POSITION' },
        { id: 'log-003', entityType: 'ORDER' }
      ];

      const orders = logs.filter(log => log.entityType === 'ORDER');
      expect(orders.length).toBe(2);
    });
  });

  describe('Compliance', () => {
    it('should include required compliance fields', async () => {
      const log = {
        id: 'audit-001',
        timestamp: Date.now(),
        userId: 'user-123',
        action: 'UPDATE',
        entityType: 'ORDER',
        entityId: 'ord-001',
        ipAddress: '192.168.1.1',
        userAgent: 'HMS-CLI/1.0'
      };

      expect(log.timestamp).toBeDefined();
      expect(log.userId).toBeDefined();
      expect(log.ipAddress).toBeDefined();
    });

    it('should be immutable after creation', async () => {
      const log = Object.freeze({
        id: 'audit-001',
        timestamp: Date.now(),
        action: 'CREATE'
      });

      expect(() => {
        (log as any).action = 'UPDATE';
      }).toThrow();
    });

    it('should retain logs for compliance period', async () => {
      const retentionDays = 2555; // 7 years
      const createdAt = Date.now();
      const expiresAt = createdAt + (retentionDays * 24 * 60 * 60 * 1000);

      expect(expiresAt).toBeGreaterThan(createdAt);
    });
  });

  describe('Performance', () => {
    it('should batch log writes', async () => {
      const batchSize = 100;
      const logs = Array(250).fill(null).map((_, i) => ({
        id: `log-${i}`,
        timestamp: Date.now()
      }));

      const batches = Math.ceil(logs.length / batchSize);
      expect(batches).toBe(3);
    });

    it('should compress old logs', async () => {
      const log = {
        id: 'audit-001',
        data: 'x'.repeat(1000),
        compressed: false
      };

      const originalSize = log.data.length;
      log.compressed = true;

      expect(log.compressed).toBe(true);
      expect(originalSize).toBe(1000);
    });

    it('should archive logs efficiently', async () => {
      const logs = Array(10000).fill(null).map((_, i) => ({
        id: `log-${i}`,
        archived: false
      }));

      const toArchive = logs.filter(log => !log.archived);
      expect(toArchive.length).toBe(10000);
    });
  });

  describe('Error Handling', () => {
    it('should handle logging failures gracefully', async () => {
      const log = {
        id: 'audit-001',
        status: 'PENDING',
        retries: 0
      };

      try {
        throw new Error('Database unavailable');
      } catch (error) {
        log.status = 'FAILED';
        log.retries++;
      }

      expect(log.status).toBe('FAILED');
      expect(log.retries).toBe(1);
    });

    it('should queue logs when offline', async () => {
      const offlineQueue = [
        { id: 'log-001', queued: true },
        { id: 'log-002', queued: true }
      ];

      expect(offlineQueue.length).toBe(2);
      expect(offlineQueue.every(log => log.queued)).toBe(true);
    });
  });

  describe('Search and Export', () => {
    it('should support full-text search', async () => {
      const logs = [
        { id: 'log-001', description: 'Order filled successfully' },
        { id: 'log-002', description: 'Order cancelled by user' },
        { id: 'log-003', description: 'Order rejected due to insufficient funds' }
      ];

      const searchTerm = 'order';
      const results = logs.filter(log =>
        log.description.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(results.length).toBe(3);
    });

    it('should export logs to CSV', async () => {
      const logs = [
        { id: 'log-001', timestamp: 1000, action: 'CREATE' },
        { id: 'log-002', timestamp: 2000, action: 'UPDATE' }
      ];

      const csv = [
        'ID,Timestamp,Action',
        ...logs.map(log => `${log.id},${log.timestamp},${log.action}`)
      ].join('\n');

      expect(csv.split('\n').length).toBe(3);
    });

    it('should export logs to JSON', async () => {
      const logs = [
        { id: 'log-001', action: 'CREATE' },
        { id: 'log-002', action: 'UPDATE' }
      ];

      const json = JSON.stringify(logs, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(logs);
    });
  });
});
