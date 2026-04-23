import { Router, type IRouter } from 'express';
import { createBaselineSchema, updateBaselineSchema } from '@aurex/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { logger } from '../lib/logger.js';
import * as baselineService from '../services/baseline.service.js';

export const baselineRouter: IRouter = Router();

// All baseline routes require auth + org scope
baselineRouter.use(requireAuth, requireOrgScope);

/**
 * POST / — Create baseline (manager+)
 */
baselineRouter.post(
  '/',
  requireRole('manager', 'org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const data = createBaselineSchema.parse(req.body);

      const baseline = await baselineService.createBaseline({
        orgId: req.orgId!,
        name: data.name,
        scope: data.scope,
        baseYear: data.baseYear,
        value: data.value,
        unit: data.unit,
        methodology: data.methodology,
        isActive: data.isActive,
      });

      logger.info(
        { baselineId: baseline.id, createdBy: req.user!.sub },
        'Baseline created via API',
      );
      res.status(201).json({ data: baseline });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET / — List baselines for org. Query: scope filter.
 */
baselineRouter.get('/', async (req, res, next) => {
  try {
    const { scope } = req.query as Record<string, string | undefined>;

    const baselines = await baselineService.listBaselines({
      orgId: req.orgId!,
      scope,
    });

    res.json({ data: baselines });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:id — Get single baseline
 */
baselineRouter.get('/:id', async (req, res, next) => {
  try {
    const baseline = await baselineService.getBaselineById(req.params.id as string, req.orgId!);
    res.json({ data: baseline });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /:id — Update baseline (manager+)
 */
baselineRouter.patch(
  '/:id',
  requireRole('manager', 'org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const data = updateBaselineSchema.parse(req.body);

      const updated = await baselineService.updateBaseline(
        req.params.id as string,
        req.orgId!,
        data as Record<string, unknown>,
      );

      logger.info(
        { baselineId: req.params.id, updatedBy: req.user!.sub },
        'Baseline updated via API',
      );
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /:id — Delete baseline (manager+)
 */
baselineRouter.delete(
  '/:id',
  requireRole('manager', 'org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      await baselineService.deleteBaseline(req.params.id as string, req.orgId!);

      logger.info(
        { baselineId: req.params.id, deletedBy: req.user!.sub },
        'Baseline deleted via API',
      );
      res.json({ message: 'Baseline deleted' });
    } catch (err) {
      next(err);
    }
  },
);
