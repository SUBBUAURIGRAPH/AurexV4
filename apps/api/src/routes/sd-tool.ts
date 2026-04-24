import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { prisma } from '@aurex/database';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import * as sdToolService from '../services/sd-tool.service.js';

export const sdToolRouter: IRouter = Router();

// WRITE_ROLES: activity-owner staff (MANAGER+). DOE may also author EX_POST
// contributions (they verify them in the field).
const WRITE_ROLES = ['ORG_ADMIN', 'MANAGER', 'SUPER_ADMIN'];
const DOE_POST_ROLES = ['ORG_ADMIN', 'MANAGER', 'SUPER_ADMIN', 'DOE'];

// ─── Public catalogue endpoints (authenticated, no org gate) ───────────

/** GET /sdgs — list all 17 UN SDGs */
sdToolRouter.get('/sdgs', requireAuth, async (_req, res, next) => {
  try {
    const rows = await sdToolService.listSdgs();
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/** GET /sd-indicators — list SD indicators, optionally filtered by SDG code */
sdToolRouter.get('/sd-indicators', requireAuth, async (req, res, next) => {
  try {
    const { sdg } = req.query as { sdg?: string };
    const rows = await sdToolService.listIndicators(sdg);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// ─── Org-scoped contribution endpoints ─────────────────────────────────

// Sub-router for everything that requires an organization scope.
const scoped = Router();
scoped.use(requireAuth, requireOrgScope);

const contributionSchema = z.object({
  indicatorCode: z.string().min(1).max(32),
  value: z.number(),
  unit: z.string().min(1).max(32),
  notes: z.string().max(5000).optional(),
  evidenceUrl: z.string().url().max(500).optional(),
});

const exAnteBatchSchema = z.object({
  contributions: z.array(contributionSchema).min(1).max(200),
});

const exPostBatchSchema = z.object({
  contributions: z.array(contributionSchema).min(1).max(200),
});

/** PUT /activities/:id/sd-contributions — batch upsert EX_ANTE (MANAGER+) */
scoped.put(
  '/activities/:id/sd-contributions',
  requireOrgRole(...WRITE_ROLES),
  async (req, res, next) => {
    try {
      const body = exAnteBatchSchema.parse(req.body);
      const result = await sdToolService.upsertContributions(
        req.params.id as string,
        req.orgId!,
        req.user!.sub,
        body.contributions.map((c) => ({ ...c, type: 'EX_ANTE' })),
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

/** PUT /monitoring/periods/:id/sd-contributions — batch upsert EX_POST (MANAGER+ or DOE) */
scoped.put(
  '/monitoring/periods/:id/sd-contributions',
  requireOrgRole(...DOE_POST_ROLES),
  async (req, res, next) => {
    try {
      const body = exPostBatchSchema.parse(req.body);
      const periodId = req.params.id as string;

      // Resolve the period → activity, scoped to the caller's org.
      const period = await prisma.monitoringPeriod.findUnique({
        where: { id: periodId },
        include: { activity: { select: { id: true, orgId: true } } },
      });
      if (!period || period.activity.orgId !== req.orgId) {
        res.status(404).json({
          type: 'https://aurex.in/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Monitoring period not found',
        });
        return;
      }

      const result = await sdToolService.upsertContributions(
        period.activity.id,
        req.orgId!,
        req.user!.sub,
        body.contributions.map((c) => ({
          ...c,
          type: 'EX_POST' as const,
          monitoringPeriodId: periodId,
        })),
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /activities/:id/sd-report — aggregated ex-ante vs ex-post table */
scoped.get('/activities/:id/sd-report', async (req, res, next) => {
  try {
    const report = await sdToolService.aggregatedReport(
      req.params.id as string,
      req.orgId!,
    );
    res.json({ data: report });
  } catch (err) {
    next(err);
  }
});

sdToolRouter.use('/', scoped);
