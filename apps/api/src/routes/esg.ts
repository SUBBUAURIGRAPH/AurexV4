import { Router, type IRouter } from 'express';
import {
  listFrameworksQuerySchema,
  listIndicatorsQuerySchema,
  createFrameworkSchema,
  updateFrameworkSchema,
  mapFrameworkSchema,
} from '@aurex/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import * as esgService from '../services/esg.service.js';

export const esgRouter: IRouter = Router();

esgRouter.use(requireAuth);

esgRouter.get('/frameworks', async (req, res, next) => {
  try {
    const parsed = listFrameworksQuerySchema.parse(req.query);
    const result = await esgService.listFrameworks(parsed);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

esgRouter.post('/frameworks', requireRole('super_admin'), async (req, res, next) => {
  try {
    const data = createFrameworkSchema.parse(req.body);
    const row = await esgService.createFramework(data);
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

esgRouter.get('/frameworks/:id', async (req, res, next) => {
  try {
    const row = await esgService.getFramework(req.params.id as string);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

esgRouter.patch('/frameworks/:id', requireRole('super_admin'), async (req, res, next) => {
  try {
    const data = updateFrameworkSchema.parse(req.body);
    const row = await esgService.updateFramework(req.params.id as string, data);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

esgRouter.get('/indicators', async (req, res, next) => {
  try {
    const parsed = listIndicatorsQuerySchema.parse(req.query);
    const result = await esgService.listIndicators(parsed);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

esgRouter.get('/org-mappings', requireOrgScope, async (req, res, next) => {
  try {
    const rows = await esgService.getOrgFrameworks(req.orgId!);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

esgRouter.post(
  '/org-mappings',
  requireOrgScope,
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { frameworkId } = mapFrameworkSchema.parse(req.body);
      await esgService.mapFramework(req.orgId!, frameworkId);
      res.status(201).json({ data: { orgId: req.orgId, frameworkId } });
    } catch (err) {
      next(err);
    }
  },
);

esgRouter.delete(
  '/org-mappings/:frameworkId',
  requireOrgScope,
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      await esgService.unmapFramework(req.orgId!, req.params.frameworkId as string);
      res.json({ message: 'Framework unmapped' });
    } catch (err) {
      next(err);
    }
  },
);
