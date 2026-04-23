import { prisma } from '@aurex/database';
import type { PaginatedResponse } from '@aurex/shared';
import { logger } from '../lib/logger.js';

/**
 * Audit log entry returned from the list endpoint.
 * `userEmail` is resolved from a follow-up query; it's null when the user was
 * deleted or when the audit row has no userId (system-generated events).
 */
export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: Date;
}

export interface RecordAuditParams {
  userId: string | null;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

/**
 * Insert an audit log row. Never throws — any DB error is logged and
 * swallowed so that caller business logic isn't aborted by an audit failure.
 */
export async function recordAudit(params: RecordAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        // Prisma's Json column expects JsonValue; `any` cast aligns with other
        // services (e.g. emissions.service metadata cast).
        oldValue: (params.oldValue ?? null) as never,
        newValue: (params.newValue ?? null) as never,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    logger.error(
      { err, action: params.action, resource: params.resource },
      'Failed to record audit log',
    );
  }
}

export interface ListAuditParams {
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

/**
 * Build the Prisma `where` clause for listAudit. Exported so tests can
 * verify filter composition without hitting a real DB.
 */
export function buildAuditWhere(params: ListAuditParams): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (params.userId) where.userId = params.userId;
  if (params.action) where.action = params.action;
  if (params.resource) where.resource = params.resource;
  if (params.resourceId) where.resourceId = params.resourceId;

  if (params.dateFrom || params.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (params.dateFrom) createdAt.gte = new Date(params.dateFrom);
    if (params.dateTo) createdAt.lte = new Date(params.dateTo);
    where.createdAt = createdAt;
  }

  return where;
}

export async function listAudit(
  params: ListAuditParams,
): Promise<PaginatedResponse<AuditLogEntry>> {
  const where = buildAuditWhere(params);
  const skip = (params.page - 1) * params.pageSize;

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Resolve user emails in one round-trip.
  const userIds = Array.from(
    new Set(rows.map((r) => r.userId).filter((id): id is string => !!id)),
  );
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : [];
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const data: AuditLogEntry[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userEmail: r.userId ? (emailById.get(r.userId) ?? null) : null,
    action: r.action,
    resource: r.resource,
    resourceId: r.resourceId,
    oldValue: r.oldValue,
    newValue: r.newValue,
    ipAddress: r.ipAddress,
    createdAt: r.createdAt,
  }));

  return {
    data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}
