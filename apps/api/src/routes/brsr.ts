import { Router, type IRouter } from 'express';
import {
  listBrsrPrinciplesQuerySchema,
  listBrsrIndicatorsQuerySchema,
  upsertBrsrResponseSchema,
  listBrsrResponsesQuerySchema,
} from '@aurex/shared';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import * as brsrService from '../services/brsr.service.js';

export const brsrRouter: IRouter = Router();

brsrRouter.use(requireAuth);

brsrRouter.get('/principles', async (req, res, next) => {
  try {
    const parsed = listBrsrPrinciplesQuerySchema.parse(req.query);
    const result = await brsrService.listPrinciples(parsed);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

brsrRouter.get('/principles/:id', async (req, res, next) => {
  try {
    const row = await brsrService.getPrinciple(req.params.id as string);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

brsrRouter.get('/indicators', async (req, res, next) => {
  try {
    const parsed = listBrsrIndicatorsQuerySchema.parse(req.query);
    const result = await brsrService.listIndicators(parsed);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

brsrRouter.get('/indicators/:id', async (req, res, next) => {
  try {
    const row = await brsrService.getIndicator(req.params.id as string);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

brsrRouter.get('/responses', requireOrgScope, async (req, res, next) => {
  try {
    const parsed = listBrsrResponsesQuerySchema.parse(req.query);
    const result = await brsrService.listResponses(req.orgId!, parsed);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

brsrRouter.put('/responses', requireOrgScope, async (req, res, next) => {
  try {
    const data = upsertBrsrResponseSchema.parse(req.body);
    const row = await brsrService.upsertResponse(req.orgId!, req.user!.sub, data);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

brsrRouter.get('/responses/:indicatorId/:fiscalYear', requireOrgScope, async (req, res, next) => {
  try {
    const row = await brsrService.getResponse(
      req.orgId!,
      req.params.indicatorId as string,
      req.params.fiscalYear as string,
    );
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
