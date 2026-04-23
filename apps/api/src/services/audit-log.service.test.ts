import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @aurex/database before importing the service. vi.mock is hoisted,
// so we use vi.hoisted to construct the mock prisma client in a way that's
// available both inside the factory and in the test body.
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

import { buildAuditWhere, listAudit, recordAudit } from './audit-log.service.js';

describe('buildAuditWhere', () => {
  it('returns an empty where when no filters given', () => {
    const where = buildAuditWhere({ page: 1, pageSize: 20 });
    expect(where).toEqual({});
  });

  it('composes exact-match filters', () => {
    const where = buildAuditWhere({
      userId: 'u1',
      action: 'user.update',
      resource: 'User',
      resourceId: 'r1',
      page: 1,
      pageSize: 20,
    });
    expect(where).toEqual({
      userId: 'u1',
      action: 'user.update',
      resource: 'User',
      resourceId: 'r1',
    });
  });

  it('builds createdAt gte/lte from date range', () => {
    const where = buildAuditWhere({
      dateFrom: '2026-01-01T00:00:00Z',
      dateTo: '2026-02-01T00:00:00Z',
      page: 1,
      pageSize: 20,
    });
    expect(where.createdAt).toEqual({
      gte: new Date('2026-01-01T00:00:00Z'),
      lte: new Date('2026-02-01T00:00:00Z'),
    });
  });

  it('builds createdAt gte only when dateTo missing', () => {
    const where = buildAuditWhere({
      dateFrom: '2026-01-01T00:00:00Z',
      page: 1,
      pageSize: 20,
    });
    expect(where.createdAt).toEqual({ gte: new Date('2026-01-01T00:00:00Z') });
  });

  it('omits createdAt entirely when neither date given', () => {
    const where = buildAuditWhere({ userId: 'u1', page: 1, pageSize: 20 });
    expect(where.createdAt).toBeUndefined();
  });
});

describe('listAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the composed where to findMany/count and returns pagination', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'a1',
        userId: 'u1',
        action: 'user.update',
        resource: 'User',
        resourceId: 'r1',
        oldValue: null,
        newValue: null,
        ipAddress: '127.0.0.1',
        createdAt: new Date('2026-03-01T00:00:00Z'),
      },
    ]);
    mockPrisma.auditLog.count.mockResolvedValue(1);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'a@b.com' }]);

    const result = await listAudit({
      userId: 'u1',
      resource: 'User',
      page: 2,
      pageSize: 10,
    });

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', resource: 'User' },
      skip: 10,
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
      where: { userId: 'u1', resource: 'User' },
    });
    expect(result.pagination).toEqual({ page: 2, pageSize: 10, total: 1, totalPages: 1 });
    expect(result.data[0]?.userEmail).toBe('a@b.com');
  });

  it('skips user lookup when no rows have userId', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'a2',
        userId: null,
        action: 'system.sync',
        resource: 'Connector',
        resourceId: null,
        oldValue: null,
        newValue: null,
        ipAddress: null,
        createdAt: new Date(),
      },
    ]);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const result = await listAudit({ page: 1, pageSize: 20 });

    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(result.data[0]?.userEmail).toBeNull();
  });
});

describe('recordAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a row via prisma.auditLog.create', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({});

    await recordAudit({
      userId: 'u1',
      action: 'emissions.create',
      resource: 'EmissionsRecord',
      resourceId: 'e1',
      newValue: { scope: 'SCOPE_1' },
      ipAddress: '10.0.0.1',
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        action: 'emissions.create',
        resource: 'EmissionsRecord',
        resourceId: 'e1',
        oldValue: null,
        newValue: { scope: 'SCOPE_1' },
        ipAddress: '10.0.0.1',
      },
    });
  });

  it('swallows DB errors without throwing', async () => {
    mockPrisma.auditLog.create.mockRejectedValue(new Error('boom'));

    await expect(
      recordAudit({ userId: null, action: 'x', resource: 'y' }),
    ).resolves.toBeUndefined();
  });
});
