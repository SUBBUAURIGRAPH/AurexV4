import { Router, type IRouter } from 'express';
import * as emissionsService from '../services/emissions.service.js';

export const referenceDataRouter: IRouter = Router();

/**
 * GET /emission-sources — List emission sources (reference data, no auth required)
 * Query: scope, category
 */
referenceDataRouter.get('/emission-sources', async (req, res, next) => {
  try {
    const { scope, category } = req.query as { scope?: string; category?: string };
    const sources = await emissionsService.listEmissionSources(scope, category);
    res.json({ data: sources });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /emission-factors — List emission factors (reference data, no auth required)
 * Query: scope, category, source
 */
referenceDataRouter.get('/emission-factors', async (req, res, next) => {
  try {
    const { scope, category, source } = req.query as {
      scope?: string;
      category?: string;
      source?: string;
    };
    const factors = await emissionsService.listEmissionFactors(scope, category, source);
    res.json({ data: factors });
  } catch (err) {
    next(err);
  }
});
