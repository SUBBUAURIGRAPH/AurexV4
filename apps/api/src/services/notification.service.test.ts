import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @aurex/database before importing the service. vi.mock is hoisted, so
// we use vi.hoisted to construct the mock prisma client that's available
// both inside the factory and in the test body.
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    notificationPreference: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

import {
  buildNotificationsWhere,
  createNotification,
  listNotifications,
  markRead,
  markAllRead,
  getPreferences,
  updatePreferences,
} from './notification.service.js';
import { AppError } from '../middleware/error-handler.js';

describe('buildNotificationsWhere', () => {
  it('scopes to userId when no filter given', () => {
    const where = buildNotificationsWhere({ userId: 'u1', page: 1, pageSize: 20 });
    expect(where).toEqual({ userId: 'u1' });
  });

  it('adds readAt=null when unreadOnly is true', () => {
    const where = buildNotificationsWhere({
      userId: 'u1',
      unreadOnly: true,
      page: 1,
      pageSize: 20,
    });
    expect(where).toEqual({ userId: 'u1', readAt: null });
  });

  it('omits readAt when unreadOnly is false', () => {
    const where = buildNotificationsWhere({
      userId: 'u1',
      unreadOnly: false,
      page: 1,
      pageSize: 20,
    });
    expect(where).toEqual({ userId: 'u1' });
  });
});

describe('listNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the composed where to findMany/count and returns unreadCount', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([
      {
        id: 'n1',
        orgId: 'o1',
        userId: 'u1',
        type: 'INFO',
        title: 'hello',
        body: null,
        resource: null,
        resourceId: null,
        readAt: null,
        createdAt: new Date('2026-03-01T00:00:00Z'),
      },
    ]);
    // First count = total for the (filtered) query, second = unreadCount.
    mockPrisma.notification.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);

    const result = await listNotifications({
      userId: 'u1',
      unreadOnly: true,
      page: 2,
      pageSize: 10,
    });

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', readAt: null },
      skip: 10,
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    expect(mockPrisma.notification.count).toHaveBeenNthCalledWith(1, {
      where: { userId: 'u1', readAt: null },
    });
    expect(mockPrisma.notification.count).toHaveBeenNthCalledWith(2, {
      where: { userId: 'u1', readAt: null },
    });
    expect(result.pagination).toEqual({ page: 2, pageSize: 10, total: 1, totalPages: 1 });
    expect(result.unreadCount).toBe(3);
    expect(result.data).toHaveLength(1);
  });
});

describe('markRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 (AppError) when not owned by caller', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue(null);

    await expect(markRead('n-missing', 'u1')).rejects.toBeInstanceOf(AppError);
    expect(mockPrisma.notification.update).not.toHaveBeenCalled();
  });

  it('no-ops when already read', async () => {
    const alreadyRead = {
      id: 'n1',
      userId: 'u1',
      readAt: new Date('2026-01-01T00:00:00Z'),
    };
    mockPrisma.notification.findFirst.mockResolvedValue(alreadyRead);

    const result = await markRead('n1', 'u1');

    expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    expect(result.readAt).toEqual(alreadyRead.readAt);
  });

  it('updates readAt when unread', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      readAt: null,
    });
    const updated = { id: 'n1', userId: 'u1', readAt: new Date() };
    mockPrisma.notification.update.mockResolvedValue(updated);

    const result = await markRead('n1', 'u1');

    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: expect.objectContaining({ readAt: expect.any(Date) }),
    });
    expect(result).toEqual(updated);
  });
});

describe('markAllRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bulk updates unread rows and returns count', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

    const result = await markAllRead('u1');

    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', readAt: null },
      data: expect.objectContaining({ readAt: expect.any(Date) }),
    });
    expect(result).toEqual({ updated: 5 });
  });
});

describe('createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a row with sensible defaults', async () => {
    mockPrisma.notification.create.mockResolvedValue({});

    await createNotification({
      userId: 'u1',
      title: 'Hello',
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: {
        orgId: null,
        userId: 'u1',
        type: 'INFO',
        title: 'Hello',
        body: null,
        resource: null,
        resourceId: null,
      },
    });
  });

  it('propagates orgId, body, resource, resourceId when given', async () => {
    mockPrisma.notification.create.mockResolvedValue({});

    await createNotification({
      orgId: 'o1',
      userId: 'u1',
      type: 'WARNING',
      title: 'Emission status changed',
      body: 'DRAFT → PENDING',
      resource: 'emissions_record',
      resourceId: 'e1',
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: 'o1',
        userId: 'u1',
        type: 'WARNING',
        title: 'Emission status changed',
        body: 'DRAFT → PENDING',
        resource: 'emissions_record',
        resourceId: 'e1',
      }),
    });
  });

  it('swallows DB errors without throwing', async () => {
    mockPrisma.notification.create.mockRejectedValue(new Error('boom'));

    await expect(
      createNotification({ userId: 'u1', title: 'x' }),
    ).resolves.toBeUndefined();
  });
});

describe('getPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an existing prefs row when present', async () => {
    const existing = {
      id: 'p1',
      userId: 'u1',
      emailOnStatusChange: true,
      emailOnApprovalRequest: true,
      inAppOnStatusChange: true,
      inAppOnApprovalRequest: true,
      updatedAt: new Date(),
    };
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(existing);

    const result = await getPreferences('u1');

    expect(mockPrisma.notificationPreference.create).not.toHaveBeenCalled();
    expect(result).toEqual(existing);
  });

  it('creates a default row when none exists', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
    const created = {
      id: 'p1',
      userId: 'u1',
      emailOnStatusChange: true,
      emailOnApprovalRequest: true,
      inAppOnStatusChange: true,
      inAppOnApprovalRequest: true,
      updatedAt: new Date(),
    };
    mockPrisma.notificationPreference.create.mockResolvedValue(created);

    const result = await getPreferences('u1');

    expect(mockPrisma.notificationPreference.create).toHaveBeenCalledWith({
      data: { userId: 'u1' },
    });
    expect(result).toEqual(created);
  });
});

describe('updatePreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts with partial data', async () => {
    const row = {
      id: 'p1',
      userId: 'u1',
      emailOnStatusChange: false,
      emailOnApprovalRequest: true,
      inAppOnStatusChange: true,
      inAppOnApprovalRequest: true,
      updatedAt: new Date(),
    };
    mockPrisma.notificationPreference.upsert.mockResolvedValue(row);

    const result = await updatePreferences('u1', { emailOnStatusChange: false });

    expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      create: { userId: 'u1', emailOnStatusChange: false },
      update: { emailOnStatusChange: false },
    });
    expect(result).toEqual(row);
  });
});
