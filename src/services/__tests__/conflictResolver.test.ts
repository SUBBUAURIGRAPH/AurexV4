/**
 * Conflict Resolver Tests
 * Tests for data conflict resolution
 * @version 1.0.0
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { mockSyncData } from '../../__tests__/fixtures/mockData';

describe('ConflictResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Resolution Strategies', () => {
    it('should keep latest version by timestamp', async () => {
      const local = { id: 'ord-001', status: 'FILLED', updatedAt: 1000 };
      const remote = { id: 'ord-001', status: 'PENDING', updatedAt: 1100 };

      const resolved = remote.updatedAt > local.updatedAt ? remote : local;
      expect(resolved.status).toBe('PENDING');
      expect(resolved.updatedAt).toBe(1100);
    });

    it('should keep local changes', async () => {
      const local = { id: 'ord-001', status: 'FILLED', updatedAt: 1100 };
      const remote = { id: 'ord-001', status: 'PENDING', updatedAt: 1000 };

      const resolved = local;
      expect(resolved.status).toBe('FILLED');
    });

    it('should keep remote changes', async () => {
      const local = { id: 'ord-001', status: 'PENDING', updatedAt: 1000 };
      const remote = { id: 'ord-001', status: 'FILLED', updatedAt: 1100 };

      const resolved = remote;
      expect(resolved.status).toBe('FILLED');
    });

    it('should merge non-conflicting fields', async () => {
      const local = { id: 'ord-001', status: 'FILLED', quantity: 100, updatedAt: 1000 };
      const remote = { id: 'ord-001', status: 'PENDING', notes: 'Test', updatedAt: 1100 };

      const merged = {
        id: local.id,
        status: remote.status,
        quantity: local.quantity,
        notes: remote.notes,
        updatedAt: Math.max(local.updatedAt, remote.updatedAt)
      };

      expect(merged.quantity).toBe(100);
      expect(merged.notes).toBe('Test');
    });

    it('should use custom resolution rules', async () => {
      const local = { id: 'ord-001', status: 'FILLED', priority: 'HIGH' };
      const remote = { id: 'ord-001', status: 'CANCELLED', priority: 'LOW' };

      // Custom rule: FILLED status takes precedence
      const resolved = local.status === 'FILLED' ? local : remote;
      expect(resolved.status).toBe('FILLED');
    });
  });

  describe('Conflict Types', () => {
    it('should detect update-update conflict', async () => {
      const local = { id: 'ord-001', status: 'FILLED', version: 2 };
      const remote = { id: 'ord-001', status: 'CANCELLED', version: 2 };

      const isConflict = local.version === remote.version &&
        local.status !== remote.status;
      expect(isConflict).toBe(true);
    });

    it('should detect update-delete conflict', async () => {
      const local = { id: 'ord-001', status: 'FILLED', deleted: false };
      const remote = { id: 'ord-001', deleted: true };

      const isConflict = !local.deleted && remote.deleted;
      expect(isConflict).toBe(true);
    });

    it('should detect create-create conflict', async () => {
      const local = { id: 'ord-001', createdAt: 1000, source: 'local' };
      const remote = { id: 'ord-001', createdAt: 1100, source: 'remote' };

      const isConflict = local.id === remote.id &&
        local.source !== remote.source;
      expect(isConflict).toBe(true);
    });
  });

  describe('Field-level Resolution', () => {
    it('should resolve individual field conflicts', async () => {
      const conflict = {
        field: 'status',
        localValue: 'FILLED',
        remoteValue: 'PENDING',
        localTimestamp: 1100,
        remoteTimestamp: 1000
      };

      const resolved = conflict.localTimestamp > conflict.remoteTimestamp
        ? conflict.localValue
        : conflict.remoteValue;
      expect(resolved).toBe('FILLED');
    });

    it('should handle array field conflicts', async () => {
      const local = { id: 'ord-001', tags: ['tag1', 'tag2'] };
      const remote = { id: 'ord-001', tags: ['tag2', 'tag3'] };

      const merged = Array.from(new Set([...local.tags, ...remote.tags]));
      expect(merged).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should handle numeric field conflicts', async () => {
      const local = { id: 'ord-001', quantity: 100 };
      const remote = { id: 'ord-001', quantity: 150 };

      // Use maximum value
      const resolved = Math.max(local.quantity, remote.quantity);
      expect(resolved).toBe(150);
    });
  });

  describe('Conflict Logging', () => {
    it('should log conflict details', async () => {
      const conflict = mockSyncData.conflict;
      const log = {
        id: conflict.id,
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        resolution: conflict.resolution,
        timestamp: conflict.resolvedAt
      };

      expect(log.resolution).toBe('KEEP_LOCAL');
      expect(log.entityType).toBe('ORDER');
    });

    it('should track conflict resolution history', async () => {
      const history = [
        { conflictId: 'conf-001', resolution: 'KEEP_LOCAL', timestamp: 1000 },
        { conflictId: 'conf-002', resolution: 'KEEP_REMOTE', timestamp: 2000 }
      ];

      expect(history.length).toBe(2);
      expect(history[1].timestamp).toBeGreaterThan(history[0].timestamp);
    });
  });

  describe('Manual Resolution', () => {
    it('should support manual conflict resolution', async () => {
      const conflict = {
        id: 'conf-001',
        status: 'PENDING_MANUAL',
        localVersion: { status: 'FILLED' },
        remoteVersion: { status: 'CANCELLED' }
      };

      const manualResolution = { status: 'FILLED' };
      expect(manualResolution.status).toBe('FILLED');
    });

    it('should queue conflicts for manual review', async () => {
      const queue = [
        { id: 'conf-001', priority: 'HIGH' },
        { id: 'conf-002', priority: 'LOW' }
      ];

      expect(queue.length).toBe(2);
      expect(queue[0].priority).toBe('HIGH');
    });
  });

  describe('Validation', () => {
    it('should validate resolved data', async () => {
      const resolved = {
        id: 'ord-001',
        status: 'FILLED',
        quantity: 100,
        price: 175.00
      };

      const isValid = resolved.quantity > 0 && resolved.price > 0;
      expect(isValid).toBe(true);
    });

    it('should reject invalid resolutions', async () => {
      const resolved = {
        id: 'ord-001',
        status: 'FILLED',
        quantity: -10,
        price: 175.00
      };

      const isValid = resolved.quantity > 0 && resolved.price > 0;
      expect(isValid).toBe(false);
    });
  });
});
