import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import * as monitoringService from '../services/monitoring.service.js';

export const monitoringRouter: IRouter = Router();

monitoringRouter.use(requireAuth, requireOrgScope);

const WRITE_ROLES = ['ORG_ADMIN', 'MANAGER', 'SUPER_ADMIN'];

const upsertPlanSchema = z.object({
  qaqcNotes: z.string().max(5000).optional(),
  parameters: z
    .array(
      z.object({
        code: z.string().min(1).max(64),
        name: z.string().min(1).max(255),
        unit: z.string().min(1).max(32),
        measurementMethod: z.enum(['DIRECT', 'CALCULATED', 'DEFAULT', 'ESTIMATED']),
        frequency: z.string().min(1).max(64),
        equipment: z.string().max(1000).optional(),
        uncertaintyPct: z.number().min(0).max(100).optional(),
      }),
    )
    .min(1),
});

const createPeriodSchema = z.object({
  periodStart: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  periodEnd: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
});

const addDatapointsSchema = z.object({
  datapoints: z
    .array(
      z.object({
        parameterCode: z.string().min(1),
        timestamp: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
        rawValue: z.number(),
        adjustedValue: z.number().optional(),
        provenance: z.enum(['METER', 'INVOICE', 'SATELLITE', 'SURVEY', 'LABORATORY', 'CALCULATED']),
        sourceRef: z.string().max(500).optional(),
        uncertaintyPct: z.number().min(0).max(100).optional(),
        notes: z.string().max(2000).optional(),
      }),
    )
    .min(1)
    .max(10000),
});

/** PUT /activities/:id/plan — upsert monitoring plan (manager+) */
monitoringRouter.put('/activities/:id/plan', requireOrgRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const data = upsertPlanSchema.parse(req.body);
    const plan = await monitoringService.upsertMonitoringPlan(
      req.params.id as string,
      req.orgId!,
      data,
      req.user!.sub,
    );
    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
});

/** POST /activities/:id/periods — create a new monitoring period (manager+) */
monitoringRouter.post('/activities/:id/periods', requireOrgRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const data = createPeriodSchema.parse(req.body);
    const period = await monitoringService.createMonitoringPeriod(
      req.params.id as string,
      req.orgId!,
      new Date(data.periodStart),
      new Date(data.periodEnd),
      req.user!.sub,
    );
    res.status(201).json({ data: period });
  } catch (err) {
    next(err);
  }
});

/** GET /activities/:id/periods — list monitoring periods for an activity */
monitoringRouter.get('/activities/:id/periods', async (req, res, next) => {
  try {
    const rows = await monitoringService.listMonitoringPeriods(req.params.id as string, req.orgId!);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/** POST /periods/:periodId/submit — OPEN → SUBMITTED (manager+) */
monitoringRouter.post('/periods/:periodId/submit', requireOrgRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const row = await monitoringService.submitMonitoringPeriod(
      req.params.periodId as string,
      req.orgId!,
      req.user!.sub,
    );
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/** POST /periods/:periodId/datapoints — bulk-add monitoring data */
monitoringRouter.post(
  '/periods/:periodId/datapoints',
  requireOrgRole(...WRITE_ROLES, 'MAKER'),
  async (req, res, next) => {
    try {
      const data = addDatapointsSchema.parse(req.body);
      const result = await monitoringService.addDatapoints(
        req.params.periodId as string,
        req.orgId!,
        data.datapoints.map((d) => ({ ...d, timestamp: new Date(d.timestamp) })),
        req.user!.sub,
      );
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);
