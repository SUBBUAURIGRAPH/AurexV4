import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import * as baselineScenarioService from '../services/baseline-scenario.service.js';

export const baselineScenariosRouter: IRouter = Router();

baselineScenariosRouter.use(requireAuth, requireOrgScope);

// MANAGER+ may author / submit scenarios. DOE (and SUPER_ADMIN) approve/reject.
const WRITE_ROLES = ['ORG_ADMIN', 'MANAGER', 'SUPER_ADMIN'];
const DOE_ONLY = ['DOE', 'SUPER_ADMIN'];

// ─── Schemas ───────────────────────────────────────────────────────────

const emissionSchema = z.object({
  year: z.number().int().min(1900).max(3000),
  emissionsTco2e: z.number().nonnegative(),
  downwardAdjustmentFactor: z.number().min(0).max(1).optional(),
  notes: z.string().max(2000).optional(),
});

const createScenarioSchema = z.object({
  narrative: z.string().min(1).max(50_000),
  methodologyVersion: z.string().min(1).max(32),
  ndcAlignmentJustification: z.string().max(20_000).optional(),
  ltLedsReference: z.string().max(500).optional(),
  suppressedDemandFlag: z.boolean().optional(),
  suppressedDemandNotes: z.string().max(5000).optional(),
  emissions: z.array(emissionSchema).min(1),
});

const rejectSchema = z.object({
  reason: z.string().min(1).max(2000),
});

// ─── Routes (mounted at /api/v1/baseline-scenarios) ────────────────────

/** POST /activities/:id/baseline-scenarios — create new DRAFT scenario (MANAGER+) */
baselineScenariosRouter.post(
  '/activities/:id/baseline-scenarios',
  requireOrgRole(...WRITE_ROLES),
  async (req, res, next) => {
    try {
      const data = createScenarioSchema.parse(req.body);
      const scenario = await baselineScenarioService.createScenario(
        req.params.id as string,
        req.orgId!,
        req.user!.sub,
        data,
      );
      res.status(201).json({ data: scenario });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /activities/:id/baseline-scenarios — list all versions for an activity */
baselineScenariosRouter.get('/activities/:id/baseline-scenarios', async (req, res, next) => {
  try {
    const rows = await baselineScenarioService.listByActivity(
      req.params.id as string,
      req.orgId!,
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/** GET /:id — scenario detail with emissions */
baselineScenariosRouter.get('/:id', async (req, res, next) => {
  try {
    const scenario = await baselineScenarioService.getScenario(
      req.params.id as string,
      req.orgId!,
    );
    res.json({ data: scenario });
  } catch (err) {
    next(err);
  }
});

/** POST /:id/submit — DRAFT → SUBMITTED (MANAGER+) */
baselineScenariosRouter.post(
  '/:id/submit',
  requireOrgRole(...WRITE_ROLES),
  async (req, res, next) => {
    try {
      const row = await baselineScenarioService.submitScenario(
        req.params.id as string,
        req.orgId!,
        req.user!.sub,
      );
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

/** POST /:id/approve — SUBMITTED → APPROVED (DOE only) */
baselineScenariosRouter.post(
  '/:id/approve',
  requireOrgRole(...DOE_ONLY),
  async (req, res, next) => {
    try {
      const row = await baselineScenarioService.approveByDoe(
        req.params.id as string,
        req.user!.sub,
      );
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

/** POST /:id/reject — SUBMITTED → REJECTED (DOE only) */
baselineScenariosRouter.post(
  '/:id/reject',
  requireOrgRole(...DOE_ONLY),
  async (req, res, next) => {
    try {
      const { reason } = rejectSchema.parse(req.body);
      const row = await baselineScenarioService.rejectByDoe(
        req.params.id as string,
        req.user!.sub,
        reason,
      );
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);
