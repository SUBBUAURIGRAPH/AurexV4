import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import { requireOnboardingComplete } from '../middleware/onboarding-gate.js';
import * as activityService from '../services/activity.service.js';
import * as reversalService from '../services/reversal.service.js';

export const activitiesRouter: IRouter = Router();

activitiesRouter.use(requireAuth, requireOrgScope);

// ─── Validation schemas ────────────────────────────────────────────────

const creatingPeriodTypeEnum = z.enum(['RENEWABLE_5YR', 'FIXED_10YR', 'REMOVAL_15YR']);
const gasEnum = z.enum(['CO2', 'CH4', 'N2O', 'HFCs', 'PFCs', 'SF6', 'NF3']);

const createActivitySchema = z.object({
  methodologyId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  hostCountry: z.string().length(2), // ISO-3166 alpha-2
  sectoralScope: z.number().int().min(1).max(15),
  technologyType: z.string().min(1).max(100),
  geoBoundary: z.unknown().optional(), // GeoJSON
  gasesCovered: z.array(gasEnum).min(1),
  creditingPeriodType: creatingPeriodTypeEnum,
  creditingPeriodStart: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  creditingPeriodEnd: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  expectedAnnualEr: z.number().positive().optional(),
  isRemoval: z.boolean().optional(),
  cdmTransition: z.boolean().optional(),
  cdmReference: z.string().max(50).optional(),
});

const updateActivitySchema = createActivitySchema.partial().omit({ methodologyId: true });

const rejectSchema = z.object({
  reason: z.string().min(1).max(2000),
});

// Activity-write roles: ORG_ADMIN, MANAGER (and SUPER_ADMIN). Lifecycle
// transitions gate additionally on DOE / DNA where applicable.
const WRITE_ROLES = ['ORG_ADMIN', 'MANAGER', 'SUPER_ADMIN'];

// ─── Routes ────────────────────────────────────────────────────────────

/** GET / — list activities in caller's org */
activitiesRouter.get('/', async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    const rows = await activityService.listActivities({ orgId: req.orgId!, status });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/** POST / — create activity (manager+) */
activitiesRouter.post('/', requireOnboardingComplete, requireOrgRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const data = createActivitySchema.parse(req.body);
    const activity = await activityService.createActivity({
      orgId: req.orgId!,
      methodologyId: data.methodologyId,
      title: data.title,
      description: data.description,
      hostCountry: data.hostCountry,
      sectoralScope: data.sectoralScope,
      technologyType: data.technologyType,
      geoBoundary: data.geoBoundary,
      gasesCovered: data.gasesCovered,
      creditingPeriodType: data.creditingPeriodType,
      creditingPeriodStart: data.creditingPeriodStart ? new Date(data.creditingPeriodStart) : undefined,
      creditingPeriodEnd: data.creditingPeriodEnd ? new Date(data.creditingPeriodEnd) : undefined,
      expectedAnnualEr: data.expectedAnnualEr,
      isRemoval: data.isRemoval,
      cdmTransition: data.cdmTransition,
      cdmReference: data.cdmReference,
      createdBy: req.user!.sub,
    });
    res.status(201).json({ data: activity });
  } catch (err) {
    next(err);
  }
});

/** GET /:id — full activity with PDD, host LoA, monitoring plan, issuances */
activitiesRouter.get('/:id', async (req, res, next) => {
  try {
    const row = await activityService.getActivity(req.params.id as string, req.orgId!);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/** PATCH /:id — only while DRAFT or REJECTED (see service guard) */
activitiesRouter.patch('/:id', requireOnboardingComplete, requireOrgRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const data = updateActivitySchema.parse(req.body);
    const updated = await activityService.updateActivity(
      req.params.id as string,
      req.orgId!,
      {
        ...data,
        creditingPeriodStart: data.creditingPeriodStart ? new Date(data.creditingPeriodStart) : undefined,
        creditingPeriodEnd: data.creditingPeriodEnd ? new Date(data.creditingPeriodEnd) : undefined,
      },
      req.user!.sub,
    );
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

/** POST /:id/submit — DRAFT → SUBMITTED (manager+) */
activitiesRouter.post('/:id/submit', requireOnboardingComplete, requireOrgRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const row = await activityService.submitActivity(req.params.id as string, req.orgId!, req.user!.sub);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /:id/validate-start — SUBMITTED → VALIDATING.
 * DOE-gated (activity DOE begins validation work).
 */
activitiesRouter.post('/:id/validate-start', requireOrgRole('DOE', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const row = await activityService.startValidation(req.params.id as string, req.orgId!, req.user!.sub);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /:id/close — close the activity (manager+).
 * Crediting period ended or voluntary closure.
 */
activitiesRouter.post('/:id/close', requireOrgRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const row = await activityService.closeActivity(req.params.id as string, req.orgId!, req.user!.sub);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /:id/reject — mark activity as REJECTED with reason.
 * ORG_ADMIN + (DOE for validation-stage rejection).
 */
activitiesRouter.post(
  '/:id/reject',
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN', 'DOE'),
  async (req, res, next) => {
    try {
      const { reason } = rejectSchema.parse(req.body);
      const row = await activityService.rejectActivity(
        req.params.id as string,
        req.orgId!,
        req.user!.sub,
        reason,
      );
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /:id/reversal — draw from REVERSAL_BUFFER on a non-permanence event
 * for a removal activity (Phase C, AV4-332). Gated to ORG_ADMIN / DOE /
 * SUPER_ADMIN — the host-party role (DNA) does not draw directly; they
 * trigger a cancellation event which the mechanism then honours.
 */
const reversalSchema = z.object({
  units: z.number().int().positive(),
  evidence: z.string().min(1).max(5000),
});

activitiesRouter.post(
  '/:id/reversal',
  requireOrgRole('ORG_ADMIN', 'DOE', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { units, evidence } = reversalSchema.parse(req.body);
      const result = await reversalService.draw({
        activityId: req.params.id as string,
        units,
        evidence,
        actorUserId: req.user!.sub,
        orgId: req.orgId!,
      });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);
