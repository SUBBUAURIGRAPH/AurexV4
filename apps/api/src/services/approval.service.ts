import { prisma } from '@aurex/database';
import type { PaginatedResponse } from '@aurex/shared';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from './audit-log.service.js';

/**
 * Approval workflow service (AV4-219).
 *
 * Lifecycle is one-way from PENDING:
 *   PENDING -> APPROVED | REJECTED | CANCELLED
 * Once an approval row has a non-PENDING status it cannot be re-opened.
 */

export interface ApprovalCommentResult {
  id: string;
  requestId: string;
  userId: string;
  userEmail: string | null;
  body: string;
  createdAt: Date;
}

export interface ApprovalRequestResult {
  id: string;
  orgId: string;
  resource: string;
  resourceId: string;
  requestedBy: string;
  requesterEmail?: string | null;
  status: string;
  decidedBy: string | null;
  deciderEmail?: string | null;
  decidedAt: Date | null;
  reason: string | null;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
  comments?: ApprovalCommentResult[];
}

// ─── Submit ─────────────────────────────────────────────────────────────────

export interface SubmitApprovalParams {
  orgId: string;
  requestedBy: string;
  resource: string;
  resourceId: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
}

export async function submitApproval(
  params: SubmitApprovalParams,
): Promise<ApprovalRequestResult> {
  const row = await prisma.approvalRequest.create({
    data: {
      orgId: params.orgId,
      requestedBy: params.requestedBy,
      resource: params.resource,
      resourceId: params.resourceId,
      // Prisma JsonValue; align with other services that cast to any.
      payload: (params.payload ?? undefined) as never,
    },
  });

  await recordAudit({
    orgId: params.orgId,
    userId: params.requestedBy,
    action: 'approval.submitted',
    resource: 'approval_request',
    resourceId: row.id,
    newValue: { resource: params.resource, resourceId: params.resourceId },
    ipAddress: params.ipAddress,
  });

  logger.info(
    {
      approvalId: row.id,
      orgId: params.orgId,
      resource: params.resource,
      resourceId: params.resourceId,
    },
    'Approval request submitted',
  );

  return row as unknown as ApprovalRequestResult;
}

// ─── Decide ─────────────────────────────────────────────────────────────────

export interface DecideApprovalParams {
  id: string;
  orgId: string;
  deciderId: string;
  status: 'APPROVED' | 'REJECTED';
  reason?: string;
  ipAddress?: string;
}

/**
 * Atomically decide a PENDING approval request. Uses `updateMany` with a
 * {status: PENDING} filter so a concurrent decision is impossible — if the
 * row was already decided by another approver, `count` is 0 and we throw 409.
 */
export async function decideApproval(
  params: DecideApprovalParams,
): Promise<ApprovalRequestResult> {
  // First make sure the row exists in the caller's org (404 vs 409 clarity).
  const existing = await prisma.approvalRequest.findFirst({
    where: { id: params.id, orgId: params.orgId },
  });
  if (!existing) {
    throw new AppError(404, 'Not Found', 'Approval request not found');
  }

  const result = await prisma.approvalRequest.updateMany({
    where: {
      id: params.id,
      orgId: params.orgId,
      status: 'PENDING',
    },
    data: {
      status: params.status,
      decidedBy: params.deciderId,
      decidedAt: new Date(),
      reason: params.reason ?? null,
    },
  });

  if (result.count === 0) {
    throw new AppError(
      409,
      'Conflict',
      'Approval request is not pending and cannot be decided',
    );
  }

  const updated = await prisma.approvalRequest.findUnique({
    where: { id: params.id },
  });

  await recordAudit({
    orgId: params.orgId,
    userId: params.deciderId,
    action: `approval.${params.status.toLowerCase()}`,
    resource: 'approval_request',
    resourceId: params.id,
    oldValue: { status: existing.status },
    newValue: { status: params.status, reason: params.reason ?? null },
    ipAddress: params.ipAddress,
  });

  logger.info(
    {
      approvalId: params.id,
      orgId: params.orgId,
      status: params.status,
      deciderId: params.deciderId,
    },
    'Approval request decided',
  );

  return updated as unknown as ApprovalRequestResult;
}

// ─── List ───────────────────────────────────────────────────────────────────

export interface ListApprovalsParams {
  orgId: string;
  status?: string;
  resource?: string;
  requestedBy?: string;
  page: number;
  pageSize: number;
}

/**
 * Build the Prisma `where` clause for listApprovals. Exported so tests can
 * verify filter composition without hitting a real DB.
 */
export function buildApprovalsWhere(
  params: ListApprovalsParams,
): Record<string, unknown> {
  const where: Record<string, unknown> = { orgId: params.orgId };
  if (params.status) where.status = params.status;
  if (params.resource) where.resource = params.resource;
  if (params.requestedBy) where.requestedBy = params.requestedBy;
  return where;
}

export async function listApprovals(
  params: ListApprovalsParams,
): Promise<PaginatedResponse<ApprovalRequestResult>> {
  const where = buildApprovalsWhere(params);
  const skip = (params.page - 1) * params.pageSize;

  const [rows, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      skip,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.approvalRequest.count({ where }),
  ]);

  return {
    data: rows as unknown as ApprovalRequestResult[],
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

// ─── Get single ─────────────────────────────────────────────────────────────

export async function getApproval(
  id: string,
  orgId: string,
): Promise<ApprovalRequestResult> {
  const row = await prisma.approvalRequest.findFirst({
    where: { id, orgId },
    include: {
      requester: { select: { id: true, email: true } },
      decider: { select: { id: true, email: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, email: true } } },
      },
    },
  });

  if (!row) {
    throw new AppError(404, 'Not Found', 'Approval request not found');
  }

  // Project into a stable shape — flatten requester/decider emails and attach
  // a normalized comments array so route handlers don't need to care about
  // the nested include shape.
  type RowWithIncludes = typeof row & {
    requester?: { email: string | null } | null;
    decider?: { email: string | null } | null;
    comments: Array<{
      id: string;
      requestId: string;
      userId: string;
      body: string;
      createdAt: Date;
      user?: { email: string | null } | null;
    }>;
  };
  const r = row as RowWithIncludes;

  return {
    id: r.id,
    orgId: r.orgId,
    resource: r.resource,
    resourceId: r.resourceId,
    requestedBy: r.requestedBy,
    requesterEmail: r.requester?.email ?? null,
    status: r.status,
    decidedBy: r.decidedBy,
    deciderEmail: r.decider?.email ?? null,
    decidedAt: r.decidedAt,
    reason: r.reason,
    payload: r.payload,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    comments: r.comments.map((c) => ({
      id: c.id,
      requestId: c.requestId,
      userId: c.userId,
      userEmail: c.user?.email ?? null,
      body: c.body,
      createdAt: c.createdAt,
    })),
  };
}

// ─── Comments ───────────────────────────────────────────────────────────────

export interface AddCommentParams {
  requestId: string;
  orgId: string;
  userId: string;
  body: string;
}

export async function addComment(
  params: AddCommentParams,
): Promise<ApprovalCommentResult> {
  // Verify the approval belongs to this org before inserting the comment.
  const parent = await prisma.approvalRequest.findFirst({
    where: { id: params.requestId, orgId: params.orgId },
    select: { id: true },
  });
  if (!parent) {
    throw new AppError(404, 'Not Found', 'Approval request not found');
  }

  const row = await prisma.approvalComment.create({
    data: {
      requestId: params.requestId,
      userId: params.userId,
      body: params.body,
    },
  });

  logger.info(
    { approvalId: params.requestId, commentId: row.id, userId: params.userId },
    'Approval comment added',
  );

  return {
    id: row.id,
    requestId: row.requestId,
    userId: row.userId,
    userEmail: null,
    body: row.body,
    createdAt: row.createdAt,
  };
}
