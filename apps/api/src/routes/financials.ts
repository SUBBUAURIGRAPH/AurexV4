/**
 * Sprint 5 / FLOW-REWORK — organisational financials route.
 *
 * Endpoints:
 *   GET  /api/v1/me/org/financials  — fetch current financials (any member)
 *   PUT  /api/v1/me/org/financials  — upsert financials (ORG_ADMIN+)
 *   DELETE /api/v1/me/org/financials — clear (SUPER_ADMIN, ORG_ADMIN)
 */
import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { onboardingStep5Schema } from '@aurex/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import * as financialsService from '../services/financials.service.js';

export const financialsRouter: IRouter = Router();

financialsRouter.use(requireAuth, requireOrgScope);

financialsRouter.get('/', async (req, res, next) => {
  try {
    const row = await financialsService.getFinancials(req.orgId!);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

// Re-use the onboarding step-5 schema; both surfaces collect the same
// fields (we just persist on the org-level table here, vs the journal
// entry on OnboardingProgress).
const upsertSchema = onboardingStep5Schema.extend({
  // The skipped flag belongs only on the onboarding journal — strip it
  // before passing to the service.
  skipped: z.boolean().optional(),
});

financialsRouter.put(
  '/',
  requireRole('super_admin', 'org_admin'),
  async (req, res, next) => {
    try {
      const parsed = upsertSchema.parse(req.body ?? {});
      const { skipped: _skipped, ...input } = parsed;
      const row = await financialsService.upsertFinancials(
        req.orgId!,
        req.user!.sub,
        input,
      );
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

financialsRouter.delete(
  '/',
  requireRole('super_admin', 'org_admin'),
  async (req, res, next) => {
    try {
      await financialsService.deleteFinancials(req.orgId!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
