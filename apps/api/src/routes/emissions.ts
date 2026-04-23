import { Router, type IRouter } from 'express';
import {
  createEmissionSchema,
  updateEmissionSchema,
  updateEmissionStatusSchema,
  bulkStatusSchema,
} from '@aurex/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { logger } from '../lib/logger.js';
import * as emissionsService from '../services/emissions.service.js';
import { exportEmissionsCsv } from '../services/export.service.js';

export const emissionsRouter: IRouter = Router();

// All emissions routes require auth + org scope
emissionsRouter.use(requireAuth, requireOrgScope);

/**
 * POST /bulk-status — Bulk status change (must be before /:id routes)
 * Manager+ role required. Body: { ids: string[], status: 'verified'|'rejected' }
 */
emissionsRouter.post(
  '/bulk-status',
  requireRole('manager', 'org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const { ids, status } = bulkStatusSchema.parse(req.body);

      const result = await emissionsService.bulkUpdateStatus(ids, req.orgId!, status);

      logger.info(
        { status, count: result.updated, changedBy: req.user!.sub },
        'Bulk emission status update via API',
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST / — Create emission record
 * Sets orgId from user's org, createdBy from user, status=DRAFT.
 */
emissionsRouter.post('/', async (req, res, next) => {
  try {
    const data = createEmissionSchema.parse(req.body);

    const record = await emissionsService.createEmission({
      orgId: req.orgId!,
      createdBy: req.user!.sub,
      scope: data.scope,
      category: data.category,
      source: data.source,
      value: data.value,
      unit: data.unit,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      metadata: data.metadata,
    });

    res.status(201).json({ data: record });
  } catch (err) {
    next(err);
  }
});

/**
 * GET / — List emission records for the org
 * Query: scope, status, dateFrom, dateTo, page, pageSize, sort, order
 */
emissionsRouter.get('/', async (req, res, next) => {
  try {
    const {
      scope,
      status,
      dateFrom,
      dateTo,
      page = '1',
      pageSize = '20',
      sort = 'createdAt',
      order = 'desc',
    } = req.query as Record<string, string | undefined>;

    const result = await emissionsService.listEmissions({
      orgId: req.orgId!,
      scope,
      status,
      dateFrom,
      dateTo,
      page: Math.max(1, parseInt(page ?? '1', 10) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20)),
      sort: sort ?? 'createdAt',
      order: (order === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /export — CSV export of emissions records (AV4-261)
 * Query: scope, status, dateFrom, dateTo, includeSubsidiaries
 * Must be declared before GET /:id to avoid being captured by the :id param.
 */
emissionsRouter.get('/export', async (req, res, next) => {
  try {
    const {
      scope,
      status,
      dateFrom,
      dateTo,
      includeSubsidiaries,
    } = req.query as Record<string, string | undefined>;

    const { filename, csv } = await exportEmissionsCsv(req.orgId!, {
      scope,
      status,
      dateFrom,
      dateTo,
      includeSubsidiaries: includeSubsidiaries === 'true',
    });

    logger.info(
      { orgId: req.orgId, userId: req.user!.sub, filename },
      'Emissions CSV export requested',
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:id — Get single emission record
 * Verifies org ownership.
 */
emissionsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const record = await emissionsService.getEmissionById(id, req.orgId!);
    res.json({ data: record });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /:id/status — Change status (approve/reject)
 * Manager+ role required. Must be before PATCH /:id to avoid route conflict.
 */
emissionsRouter.patch(
  '/:id/status',
  requireRole('manager', 'org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const id = req.params.id as string;
      const { status } = updateEmissionStatusSchema.parse(req.body);

      const updated = await emissionsService.updateEmissionStatus(
        id,
        req.orgId!,
        status,
      );

      logger.info(
        { recordId: id, status, changedBy: req.user!.sub },
        'Emission status changed via API',
      );
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /:id — Update emission record
 * Only if status is DRAFT or REJECTED.
 */
emissionsRouter.patch('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const data = updateEmissionSchema.parse(req.body);

    const updated = await emissionsService.updateEmission(
      id,
      req.orgId!,
      data as Record<string, unknown>,
    );

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /:id — Delete emission record
 * Only if status is DRAFT.
 */
emissionsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    await emissionsService.deleteEmission(id, req.orgId!);

    logger.info({ recordId: id, deletedBy: req.user!.sub }, 'Emission record deleted via API');
    res.json({ message: 'Emission record deleted' });
  } catch (err) {
    next(err);
  }
});
