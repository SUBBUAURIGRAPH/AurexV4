/**
 * AAT-378 / AV4-378 — caller-org quota snapshot.
 *
 *   GET /api/v1/quotas/me   — caller's own org snapshot, same shape as
 *                              the admin endpoint (no cross-tenant access).
 *
 * Auth: requireAuth + requireOrgScope. The frontend QuotaWidget on the
 * dashboard reads from this endpoint to show the user how close they
 * are to their limits.
 */
import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { prisma } from '@aurex/database';
import { getOrgQuotaSnapshot } from '../services/billing/quota.service.js';

export const quotasRouter: IRouter = Router();

quotasRouter.use(requireAuth, requireOrgScope);

/** GET /me — caller's org quota snapshot. */
quotasRouter.get('/me', async (req, res, next) => {
  try {
    const orgId = req.orgId!;
    const [snapshot, org] = await Promise.all([
      getOrgQuotaSnapshot(orgId),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, slug: true },
      }),
    ]);
    res.json({
      data: {
        ...snapshot,
        orgName: org?.name ?? null,
        orgSlug: org?.slug ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});
