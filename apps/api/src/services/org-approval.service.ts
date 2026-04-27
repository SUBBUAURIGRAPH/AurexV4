/**
 * FLOW-REWORK / Sprint 5 — Aurex-admin org-approval workflow.
 *
 * When a user signs up and self-registers a top-level org, the org
 * lands as PENDING_REVIEW. An Aurex SUPER_ADMIN reviews the registration
 * and either approves (org becomes fully usable) or rejects (with
 * reason; the user can amend + resubmit).
 *
 * Until approval lands, the `requireApprovedOrg` middleware blocks
 * regulatory-write endpoints (emissions, retirements, BRSR responses)
 * with 412 + RFC 7807 problem `https://aurex.in/problems/org-pending-approval`.
 */
import { prisma } from '@aurex/database';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';

export type OrgApprovalStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export interface OrgApprovalRow {
  id: string;
  name: string;
  slug: string;
  approvalStatus: OrgApprovalStatus;
  approvalRequestedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  rejectedReason: string | null;
  parentOrgId: string | null;
  createdAt: Date;
  /** Email of the ORG_ADMIN who registered the org (first member). */
  registeredBy?: { id: string; name: string; email: string } | null;
}

export async function listPending(): Promise<OrgApprovalRow[]> {
  const orgs = await prisma.organization.findMany({
    where: { approvalStatus: 'PENDING_REVIEW' },
    orderBy: { approvalRequestedAt: 'asc' },
    include: {
      members: {
        where: { role: 'ORG_ADMIN', isActive: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    approvalStatus: o.approvalStatus as OrgApprovalStatus,
    approvalRequestedAt: o.approvalRequestedAt,
    reviewedAt: o.reviewedAt,
    reviewedBy: o.reviewedBy,
    rejectedReason: o.rejectedReason,
    parentOrgId: o.parentOrgId,
    createdAt: o.createdAt,
    registeredBy: o.members[0]?.user ?? null,
  }));
}

export async function listAll(): Promise<OrgApprovalRow[]> {
  const orgs = await prisma.organization.findMany({
    orderBy: [{ approvalRequestedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      members: {
        where: { role: 'ORG_ADMIN', isActive: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    approvalStatus: o.approvalStatus as OrgApprovalStatus,
    approvalRequestedAt: o.approvalRequestedAt,
    reviewedAt: o.reviewedAt,
    reviewedBy: o.reviewedBy,
    rejectedReason: o.rejectedReason,
    parentOrgId: o.parentOrgId,
    createdAt: o.createdAt,
    registeredBy: o.members[0]?.user ?? null,
  }));
}

export async function approve(orgId: string, reviewerId: string): Promise<OrgApprovalRow> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new AppError(404, 'Not Found', 'Organisation not found');
  if (org.approvalStatus === 'APPROVED') {
    return _toRow(org);
  }
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      approvalStatus: 'APPROVED',
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
      rejectedReason: null,
    },
  });
  logger.info({ orgId, reviewerId }, 'Organisation approved');
  return _toRow(updated);
}

export async function reject(
  orgId: string,
  reviewerId: string,
  reason: string,
): Promise<OrgApprovalRow> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new AppError(404, 'Not Found', 'Organisation not found');
  if (!reason.trim()) {
    throw new AppError(400, 'Bad Request', 'Rejection reason is required');
  }
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      approvalStatus: 'REJECTED',
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
      rejectedReason: reason.trim(),
    },
  });
  logger.info({ orgId, reviewerId, reason: reason.slice(0, 80) }, 'Organisation rejected');
  return _toRow(updated);
}

export async function getApprovalStatus(orgId: string): Promise<OrgApprovalStatus | null> {
  const row = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { approvalStatus: true },
  });
  return (row?.approvalStatus as OrgApprovalStatus) ?? null;
}

function _toRow(o: {
  id: string;
  name: string;
  slug: string;
  approvalStatus: string;
  approvalRequestedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  rejectedReason: string | null;
  parentOrgId: string | null;
  createdAt: Date;
}): OrgApprovalRow {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    approvalStatus: o.approvalStatus as OrgApprovalStatus,
    approvalRequestedAt: o.approvalRequestedAt,
    reviewedAt: o.reviewedAt,
    reviewedBy: o.reviewedBy,
    rejectedReason: o.rejectedReason,
    parentOrgId: o.parentOrgId,
    createdAt: o.createdAt,
    registeredBy: null,
  };
}
