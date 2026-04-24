import { prisma } from '@aurex/database';
import type { PaginatedResponse } from '@aurex/shared';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';

/**
 * Notification row returned from list / markRead endpoints.
 */
export interface NotificationResult {
  id: string;
  orgId: string | null;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  resource: string | null;
  resourceId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationPreferencesResult {
  id: string;
  userId: string;
  emailOnStatusChange: boolean;
  emailOnApprovalRequest: boolean;
  inAppOnStatusChange: boolean;
  inAppOnApprovalRequest: boolean;
  updatedAt: Date;
}

export interface CreateNotificationParams {
  orgId?: string | null;
  userId: string;
  type?: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  title: string;
  body?: string;
  resource?: string;
  resourceId?: string;
}

/**
 * Best-effort notification insert. Mirrors the audit-log pattern: never
 * throws — a notification failure must not abort the caller's business
 * logic. Errors are logged.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        orgId: params.orgId ?? null,
        userId: params.userId,
        type: (params.type ?? 'INFO') as never,
        title: params.title,
        body: params.body ?? null,
        resource: params.resource ?? null,
        resourceId: params.resourceId ?? null,
      },
    });
  } catch (err) {
    logger.error(
      { err, userId: params.userId, title: params.title },
      'Failed to create notification',
    );
  }
}

export interface ListNotificationsParams {
  userId: string;
  unreadOnly?: boolean;
  page: number;
  pageSize: number;
}

/**
 * Build the Prisma where clause for listNotifications. Exported for tests so
 * filter composition can be asserted without hitting a DB.
 */
export function buildNotificationsWhere(
  params: ListNotificationsParams,
): Record<string, unknown> {
  const where: Record<string, unknown> = { userId: params.userId };
  if (params.unreadOnly) {
    where.readAt = null;
  }
  return where;
}

export interface ListNotificationsResult
  extends PaginatedResponse<NotificationResult> {
  unreadCount: number;
}

export async function listNotifications(
  params: ListNotificationsParams,
): Promise<ListNotificationsResult> {
  const where = buildNotificationsWhere(params);
  const skip = (params.page - 1) * params.pageSize;

  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: params.userId, readAt: null } }),
  ]);

  return {
    data: rows as unknown as NotificationResult[],
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
    unreadCount,
  };
}

/**
 * Mark a single notification read. Throws 404 if the notification is not
 * owned by the caller (or does not exist). No-op if already read.
 */
export async function markRead(id: string, userId: string): Promise<NotificationResult> {
  const existing = await prisma.notification.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new AppError(404, 'Not Found', 'Notification not found');
  }

  if (existing.readAt) {
    return existing as unknown as NotificationResult;
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
  return updated as unknown as NotificationResult;
}

/**
 * Bulk-mark all the caller's unread notifications as read.
 */
export async function markAllRead(userId: string): Promise<{ updated: number }> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

/**
 * Fetch the caller's preferences row, creating a default one if missing.
 */
export async function getPreferences(userId: string): Promise<NotificationPreferencesResult> {
  const existing = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (existing) return existing as unknown as NotificationPreferencesResult;

  const created = await prisma.notificationPreference.create({ data: { userId } });
  return created as unknown as NotificationPreferencesResult;
}

export interface UpdatePreferencesData {
  emailOnStatusChange?: boolean;
  emailOnApprovalRequest?: boolean;
  inAppOnStatusChange?: boolean;
  inAppOnApprovalRequest?: boolean;
}

/**
 * Upsert the caller's preferences row. Missing fields fall back to defaults
 * on create; on update, only the provided fields are changed.
 */
export async function updatePreferences(
  userId: string,
  data: UpdatePreferencesData,
): Promise<NotificationPreferencesResult> {
  const upserted = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return upserted as unknown as NotificationPreferencesResult;
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}
