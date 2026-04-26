/**
 * AAT-378 / AV4-378 — Tier quota gate.
 *
 * Express middleware factory that gates write routes when the org's
 * tier quota for a specific resource is exhausted. Sibling pattern to
 * the Wave 11b `requireActiveSubscription` gate: same place in the
 * middleware chain (after `requireOrgScope`), same RFC 7807 body
 * shape, but a 429 status because we are throttling on usage rather
 * than on payment status.
 *
 *   429 Too Many Requests is the right code here per RFC 6585 §4.
 *   The body advertises `nextStep: '/billing/manage'` so the frontend
 *   interceptor can offer a one-click upgrade path.
 *
 * Usage:
 *   router.post(
 *     '/',
 *     requireOnboardingComplete,
 *     requireActiveSubscription,
 *     requireQuota('monthlyEmissionEntries'),
 *     handler,
 *   );
 *
 * Must run AFTER `requireAuth + requireOrgScope` so `req.orgId` is set.
 */
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';
import { checkQuota } from '../services/billing/quota.service.js';
import {
  QUOTA_RESOURCE_LABELS,
  type TierQuotas,
} from '../services/billing/quotas.js';

export const QUOTA_EXCEEDED_TYPE = 'https://aurex.in/errors/quota-exceeded';

export function requireQuota(resource: keyof TierQuotas) {
  return async function quotaGate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!req.orgId) {
      // requireOrgScope should have already 403'd, but be defensive.
      res.status(403).json({
        type: 'https://aurex.in/errors/no-organization',
        title: 'Forbidden',
        status: 403,
        detail: 'Organization scope required',
        instance: req.originalUrl,
      });
      return;
    }

    try {
      const result = await checkQuota(req.orgId, resource);
      if (!result.allowed) {
        const label = QUOTA_RESOURCE_LABELS[resource];
        res.status(429).json({
          type: QUOTA_EXCEEDED_TYPE,
          title: 'Quota Exceeded',
          status: 429,
          detail: `Your ${label} quota for this billing cycle is full.`,
          instance: req.originalUrl,
          resource,
          used: result.used,
          limit: result.limit,
          nextStep: '/billing/manage',
        });
        return;
      }
      next();
    } catch (err) {
      logger.error(
        { err, orgId: req.orgId, resource, url: req.originalUrl },
        'Failed to evaluate quota gate',
      );
      next(err);
    }
  };
}
