import { Router, type IRouter } from 'express';
import { createTargetSchema, updateTargetSchema, recordProgressSchema } from '@aurex/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOnboardingComplete } from '../middleware/onboarding-gate.js';
import { logger } from '../lib/logger.js';
import * as targetService from '../services/target.service.js';

export const targetRouter: IRouter = Router();

// All target routes require auth + org scope
targetRouter.use(requireAuth, requireOrgScope);

/**
 * POST / — Create target (manager+)
 */
targetRouter.post(
  '/',
  requireOnboardingComplete,
  requireRole('manager', 'org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const data = createTargetSchema.parse(req.body);

      const target = await targetService.createTarget({
        orgId: req.orgId!,
        name: data.name,
        scope: data.scope,
        targetYear: data.targetYear,
        reduction: data.reduction,
        pathway: data.pathway,
      });

      logger.info(
        { targetId: target.id, createdBy: req.user!.sub },
        'Target created via API',
      );
      res.status(201).json({ data: target });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET / — List targets for org
 */
targetRouter.get('/', async (req, res, next) => {
  try {
    const { scope } = req.query as Record<string, string | undefined>;

    const targets = await targetService.listTargets({
      orgId: req.orgId!,
      scope,
    });

    res.json({ data: targets });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:id — Get target with progress data
 */
targetRouter.get('/:id', async (req, res, next) => {
  try {
    const target = await targetService.getTarget(req.params.id as string, req.orgId!);
    res.json({ data: target });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /:id/approve — Approve target (org_admin+)
 * Must be before PATCH /:id to avoid route conflict.
 */
targetRouter.patch(
  '/:id/approve',
  requireOnboardingComplete,
  requireRole('org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const updated = await targetService.approveTarget(req.params.id as string, req.orgId!);

      logger.info(
        { targetId: req.params.id, approvedBy: req.user!.sub },
        'Target approved via API',
      );
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /:id — Update target (manager+)
 */
targetRouter.patch(
  '/:id',
  requireOnboardingComplete,
  requireRole('manager', 'org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const data = updateTargetSchema.parse(req.body);

      const updated = await targetService.updateTarget(
        req.params.id as string,
        req.orgId!,
        data as Record<string, unknown>,
      );

      logger.info(
        { targetId: req.params.id, updatedBy: req.user!.sub },
        'Target updated via API',
      );
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /:id/progress — Record progress for a year
 */
targetRouter.post(
  '/:id/progress',
  requireOnboardingComplete,
  requireRole('manager', 'org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const data = recordProgressSchema.parse(req.body);

      const progress = await targetService.recordProgress({
        targetId: req.params.id as string,
        orgId: req.orgId!,
        year: data.year,
        actual: data.actual,
        projected: data.projected,
      });

      logger.info(
        { targetId: req.params.id, year: data.year, recordedBy: req.user!.sub },
        'Target progress recorded via API',
      );
      res.status(201).json({ data: progress });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /:id/progress — Get progress history
 */
targetRouter.get('/:id/progress', async (req, res, next) => {
  try {
    const progress = await targetService.getProgress(req.params.id as string, req.orgId!);
    res.json({ data: progress });
  } catch (err) {
    next(err);
  }
});
