/**
 * AAT-378 / AV4-378 — admin quota dashboard routes.
 *
 *   GET /api/v1/admin/quotas/:orgId   — single-org snapshot (limits, usage, remaining, ratios)
 *   GET /api/v1/admin/quotas          — list all orgs whose top-utilisation > 80%
 *
 * Auth: SUPER_ADMIN (cross-tenant by design — operators auditing
 * customers near their tier ceiling).
 *
 * Snapshots are computed live by quota.service.getOrgQuotaSnapshot —
 * no caching. The list endpoint is therefore O(orgs) Prisma-count
 * queries; for the MVP scale (<= a few hundred orgs) that is fine.
 */
import { Router, type IRouter } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import { prisma } from '@aurex/database';
import {
  getOrgQuotaSnapshot,
  type OrgQuotaSnapshot,
} from '../services/billing/quota.service.js';
import { QUOTA_RESOURCE_KEYS } from '../services/billing/quotas.js';

export const adminQuotasRouter: IRouter = Router();

adminQuotasRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'super_admin'));

const HIGH_UTILISATION_THRESHOLD = 0.8;

/**
 * Computes the maximum utilisation ratio across all known quota
 * resources for a snapshot. Used to filter the listing endpoint.
 */
function maxRatio(snapshot: OrgQuotaSnapshot): number {
  let max = 0;
  for (const k of QUOTA_RESOURCE_KEYS) {
    const r = snapshot.ratios[k] ?? 0;
    if (r > max) max = r;
  }
  return max;
}

/** GET /api/v1/admin/quotas/:orgId — full snapshot for one org. */
adminQuotasRouter.get('/:orgId', async (req, res, next) => {
  try {
    const orgId = req.params.orgId as string;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, slug: true },
    });
    if (!org) {
      res.status(404).json({
        type: 'https://aurex.in/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Organization ${orgId} not found`,
        instance: req.originalUrl,
      });
      return;
    }
    const snapshot = await getOrgQuotaSnapshot(org.id);
    res.json({
      data: {
        ...snapshot,
        orgName: org.name,
        orgSlug: org.slug,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/quotas — list orgs whose max-utilisation > 80%.
 * `?all=true` returns every org regardless of utilisation (for the
 * full operator overview). `?threshold=0.5` overrides the cutoff.
 */
adminQuotasRouter.get('/', async (req, res, next) => {
  try {
    const all = req.query.all === 'true';
    const thresholdRaw = req.query.threshold;
    let threshold = HIGH_UTILISATION_THRESHOLD;
    if (typeof thresholdRaw === 'string') {
      const parsed = Number(thresholdRaw);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 10) {
        threshold = parsed;
      }
    }

    const orgs = await prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });

    const snapshots = await Promise.all(
      orgs.map(async (o) => {
        const snap = await getOrgQuotaSnapshot(o.id);
        return {
          orgId: o.id,
          orgName: o.name,
          orgSlug: o.slug,
          plan: snap.plan,
          limits: snap.limits,
          usage: snap.usage,
          remaining: snap.remaining,
          ratios: snap.ratios,
          maxRatio: maxRatio(snap),
        };
      }),
    );

    const data = all
      ? snapshots
      : snapshots.filter((s) => s.maxRatio >= threshold);

    res.json({
      data,
      meta: {
        total: data.length,
        scanned: orgs.length,
        threshold,
        all,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to enumerate admin quota snapshots');
    next(err);
  }
});
