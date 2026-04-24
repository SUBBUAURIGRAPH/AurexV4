import { prisma } from '@aurex/database';
import type { PaginatedResponse } from '@aurex/shared';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from './audit-log.service.js';
import { resolveRequiredApprovers } from './workflow-recipe.service.js';

/**
 * Approval workflow service (AV4-219 + Phase C recipe engine).
 *
 * Lifecycle is one-way from PENDING:
 *   PENDING -> APPROVED | REJECTED | CANCELLED
 *
 * Quorum semantics (Phase C):
 *   - Each ApprovalRequest stores the recipe's `requiredApprovers` at submit
 *     time so the quorum is frozen for the lifetime of the request even if
 *     the org later changes its recipe for that resource type.
 *   - Every decide call writes an ApprovalVote. A unique (requestId, userId)
 *     index prevents one approver double-counting.
 *   - REJECTED vote = immediate REJECTED outcome (any single rejection fails
 *     the whole quorum).
 *   - APPROVED votes are tallied on `approvalsReceived`. Once it reaches
 *     `requiredApprovers` the request flips to APPROVED.
 */

export interface ApprovalCommentResult {
  id: string;
  requestId: string;
  userId: string;
  userEmail: string | null;
  body: string;
  createdAt: Date;
}

export interface ApprovalVoteResult {
  id: string;
  requestId: string;
  userId: string;
  userEmail: string | null;
  decision: string;
  reason: string | null;
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
  recipeId: string | null;
  requiredApprovers: number;
  approvalsReceived: number;
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
  // Resolve the active recipe for this org/resourceType (falls back to a
  // default of 1 approver if no recipe is enabled).
  const quorum = await resolveRequiredApprovers(params.orgId, params.resource);

  const row = await prisma.approvalRequest.create({
    data: {
      orgId: params.orgId,
      requestedBy: params.requestedBy,
      resource: params.resource,
      resourceId: params.resourceId,
      recipeId: quorum.recipeId,
      requiredApprovers: quorum.requiredApprovers,
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
    newValue: {
      resource: params.resource,
      resourceId: params.resourceId,
      recipeId: quorum.recipeId,
      requiredApprovers: quorum.requiredApprovers,
    },
    ipAddress: params.ipAddress,
  });

  logger.info(
    {
      approvalId: row.id,
      orgId: params.orgId,
      resource: params.resource,
      resourceId: params.resourceId,
      requiredApprovers: quorum.requiredApprovers,
    },
    'Approval request submitted',
  );

  return row as unknown as ApprovalRequestResult;
}

// ─── Decide (vote-based quorum) ─────────────────────────────────────────────

export interface DecideApprovalParams {
  id: string;
  orgId: string;
  deciderId: string;
  status: 'APPROVED' | 'REJECTED';
  reason?: string;
  ipAddress?: string;
}

/**
 * Cast a vote on an approval request. One vote per user per request. Any
 * single REJECTED vote fails the whole quorum; APPROVED votes accumulate on
 * `approvalsReceived` until they hit `requiredApprovers`.
 *
 * Error matrix:
 *   - 404: request not found in caller's org.
 *   - 409: request is already decided (not PENDING).
 *   - 409: caller has already voted on this request.
 */
export async function decideApproval(
  params: DecideApprovalParams,
): Promise<ApprovalRequestResult> {
  const existing = await prisma.approvalRequest.findFirst({
    where: { id: params.id, orgId: params.orgId },
  });
  if (!existing) {
    throw new AppError(404, 'Not Found', 'Approval request not found');
  }

  if (existing.status !== 'PENDING') {
    throw new AppError(
      409,
      'Conflict',
      'Approval request is not pending and cannot be decided',
    );
  }

  // One vote per approver per request.
  const priorVote = await prisma.approvalVote.findUnique({
    where: {
      requestId_userId: { requestId: params.id, userId: params.deciderId },
    },
  });
  if (priorVote) {
    throw new AppError(
      409,
      'Conflict',
      'You have already voted on this approval request',
    );
  }

  // Insert the vote first so we have an audit trail even if the quorum
  // decision transaction is interrupted.
  await prisma.approvalVote.create({
    data: {
      requestId: params.id,
      userId: params.deciderId,
      decision: params.status,
      reason: params.reason ?? null,
    },
  });

  // Any REJECTED vote short-circuits the quorum — flip immediately.
  if (params.status === 'REJECTED') {
    const rejected = await prisma.approvalRequest.update({
      where: { id: params.id },
      data: {
        status: 'REJECTED',
        decidedBy: params.deciderId,
        decidedAt: new Date(),
        reason: params.reason ?? null,
      },
    });

    await recordAudit({
      orgId: params.orgId,
      userId: params.deciderId,
      action: 'approval.rejected',
      resource: 'approval_request',
      resourceId: params.id,
      oldValue: { status: existing.status },
      newValue: { status: 'REJECTED', reason: params.reason ?? null },
      ipAddress: params.ipAddress,
    });

    logger.info(
      { approvalId: params.id, orgId: params.orgId, deciderId: params.deciderId },
      'Approval request rejected',
    );

    return rejected as unknown as ApprovalRequestResult;
  }

  // APPROVED: increment tally and maybe flip.
  const nextCount = existing.approvalsReceived + 1;
  const quorumReached = nextCount >= existing.requiredApprovers;

  const updated = await prisma.approvalRequest.update({
    where: { id: params.id },
    data: {
      approvalsReceived: nextCount,
      ...(quorumReached
        ? {
            status: 'APPROVED',
            decidedBy: params.deciderId,
            decidedAt: new Date(),
            reason: params.reason ?? null,
          }
        : {}),
    },
  });

  await recordAudit({
    orgId: params.orgId,
    userId: params.deciderId,
    action: quorumReached ? 'approval.approved' : 'approval.vote_cast',
    resource: 'approval_request',
    resourceId: params.id,
    oldValue: {
      status: existing.status,
      approvalsReceived: existing.approvalsReceived,
    },
    newValue: {
      status: quorumReached ? 'APPROVED' : 'PENDING',
      approvalsReceived: nextCount,
      requiredApprovers: existing.requiredApprovers,
      reason: params.reason ?? null,
    },
    ipAddress: params.ipAddress,
  });

  logger.info(
    {
      approvalId: params.id,
      orgId: params.orgId,
      deciderId: params.deciderId,
      approvalsReceived: nextCount,
      requiredApprovers: existing.requiredApprovers,
      quorumReached,
    },
    quorumReached ? 'Approval request approved (quorum reached)' : 'Approval vote cast',
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
    recipeId: r.recipeId,
    requiredApprovers: r.requiredApprovers,
    approvalsReceived: r.approvalsReceived,
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

// ─── Votes ──────────────────────────────────────────────────────────────────

/**
 * List the votes cast on an approval request. Scoped by org so a request
 * belonging to another tenant can't be introspected. Used by the approvals
 * detail panel to render "who voted and why".
 */
export async function getVotes(
  requestId: string,
  orgId: string,
): Promise<ApprovalVoteResult[]> {
  const parent = await prisma.approvalRequest.findFirst({
    where: { id: requestId, orgId },
    select: { id: true },
  });
  if (!parent) {
    throw new AppError(404, 'Not Found', 'Approval request not found');
  }

  const rows = await prisma.approvalVote.findMany({
    where: { requestId },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((v) => ({
    id: v.id,
    requestId: v.requestId,
    userId: v.userId,
    userEmail: v.user?.email ?? null,
    decision: v.decision,
    reason: v.reason,
    createdAt: v.createdAt,
  }));
}
