/**
 * FLOW-REWORK / Sprint 5 — org-approval gate middleware.
 *
 * Blocks regulatory-write endpoints when the caller's org is
 * PENDING_REVIEW or REJECTED. Returns 412 + RFC 7807 problem so the
 * frontend can render a clear "awaiting Aurex-admin approval" banner.
 *
 * Reads (GET) are NOT blocked — users can explore the platform while
 * waiting. Settings + financials writes are also NOT blocked, so users
 * can prep their data while the registration is in review.
 *
 * Mount selectively on routes that persist regulatory data:
 *   - emissions
 *   - retirements
 *   - issuances / verification reports
 *   - BRSR responses
 */
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@aurex/database';

export async function requireApprovedOrg(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Reads (GET / HEAD) are unrestricted — users can explore while waiting.
  if (req.method === 'GET' || req.method === 'HEAD') {
    return next();
  }

  if (!req.orgId) {
    // requireOrgScope should have populated this; if not, let the
    // downstream auth chain reject.
    return next();
  }

  const org = await prisma.organization.findUnique({
    where: { id: req.orgId },
    select: { approvalStatus: true, rejectedReason: true },
  });

  if (!org) return next();

  if (org.approvalStatus === 'APPROVED') return next();

  if (org.approvalStatus === 'PENDING_REVIEW') {
    res.status(412).json({
      type: 'https://aurex.in/problems/org-pending-approval',
      title: 'Organisation awaiting approval',
      status: 412,
      detail:
        'Your organisation registration is awaiting review by an Aurex administrator. ' +
        'Reads and settings are unrestricted; regulatory-write actions resume once approved.',
    });
    return;
  }

  if (org.approvalStatus === 'REJECTED') {
    res.status(412).json({
      type: 'https://aurex.in/problems/org-rejected',
      title: 'Organisation registration rejected',
      status: 412,
      detail: org.rejectedReason ?? 'Your organisation registration was rejected.',
    });
    return;
  }

  return next();
}
