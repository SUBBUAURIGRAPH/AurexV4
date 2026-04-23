import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { logger } from '../lib/logger.js';
import * as analyticsService from '../services/analytics.service.js';

export const analyticsRouter: IRouter = Router();

// All analytics routes require auth + org scope
analyticsRouter.use(requireAuth, requireOrgScope);

/**
 * GET /summary — Aggregated emissions summary (verified only)
 * Query: dateFrom, dateTo (optional ISO strings)
 */
analyticsRouter.get('/summary', async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query as Record<string, string | undefined>;

    const data = await analyticsService.getSummary(req.orgId!, dateFrom, dateTo);

    logger.debug({ orgId: req.orgId, dateFrom, dateTo }, 'Analytics summary requested');
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /trend — Monthly trend data for last 12 months
 * Query: dateFrom, dateTo (unused — always returns trailing 12 months)
 */
analyticsRouter.get('/trend', async (req, res, next) => {
  try {
    const data = await analyticsService.getTrend(req.orgId!);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /breakdown — Scope breakdown with percentages
 * Query: dateFrom, dateTo (optional ISO strings)
 */
analyticsRouter.get('/breakdown', async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query as Record<string, string | undefined>;

    const data = await analyticsService.getBreakdown(req.orgId!, dateFrom, dateTo);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /top-sources — Top emission sources by value (descending)
 * Query: limit (default 10), dateFrom, dateTo
 */
analyticsRouter.get('/top-sources', async (req, res, next) => {
  try {
    const { limit: limitStr, dateFrom, dateTo } = req.query as Record<string, string | undefined>;
    const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? '10', 10) || 10));

    const data = await analyticsService.getTopSources(req.orgId!, limit, dateFrom, dateTo);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /by-category — Emissions grouped by category with scope breakdown
 * Query: dateFrom, dateTo (optional ISO strings)
 */
analyticsRouter.get('/by-category', async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query as Record<string, string | undefined>;

    const data = await analyticsService.getByCategory(req.orgId!, dateFrom, dateTo);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /yoy-comparison — Current year vs previous year by month
 */
analyticsRouter.get('/yoy-comparison', async (req, res, next) => {
  try {
    const data = await analyticsService.getYoYComparison(req.orgId!);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});
