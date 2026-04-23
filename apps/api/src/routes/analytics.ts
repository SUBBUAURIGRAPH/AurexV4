import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { logger } from '../lib/logger.js';
import * as analyticsService from '../services/analytics.service.js';

export const analyticsRouter: IRouter = Router();

analyticsRouter.use(requireAuth, requireOrgScope);

function parseBool(v: unknown): boolean {
  return String(v ?? '').toLowerCase() === 'true';
}

/**
 * GET /summary — Aggregated emissions summary (verified only)
 * Query: dateFrom, dateTo, includeSubsidiaries
 */
analyticsRouter.get('/summary', async (req, res, next) => {
  try {
    const { dateFrom, dateTo, includeSubsidiaries } = req.query as Record<string, string | undefined>;
    const data = await analyticsService.getSummary(req.orgId!, {
      dateFrom,
      dateTo,
      includeSubsidiaries: parseBool(includeSubsidiaries),
    });
    logger.debug({ orgId: req.orgId, dateFrom, dateTo, includeSubsidiaries }, 'Analytics summary requested');
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /trend — Monthly trend for last 12 months
 */
analyticsRouter.get('/trend', async (req, res, next) => {
  try {
    const { includeSubsidiaries } = req.query as Record<string, string | undefined>;
    const data = await analyticsService.getTrend(req.orgId!, 12, {
      includeSubsidiaries: parseBool(includeSubsidiaries),
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /breakdown — Scope breakdown with percentages
 */
analyticsRouter.get('/breakdown', async (req, res, next) => {
  try {
    const { dateFrom, dateTo, includeSubsidiaries } = req.query as Record<string, string | undefined>;
    const data = await analyticsService.getBreakdown(req.orgId!, {
      dateFrom,
      dateTo,
      includeSubsidiaries: parseBool(includeSubsidiaries),
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /top-sources — Top emission sources by value
 */
analyticsRouter.get('/top-sources', async (req, res, next) => {
  try {
    const { limit: limitStr, dateFrom, dateTo, includeSubsidiaries } = req.query as Record<
      string,
      string | undefined
    >;
    const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? '10', 10) || 10));
    const data = await analyticsService.getTopSources(req.orgId!, limit, {
      dateFrom,
      dateTo,
      includeSubsidiaries: parseBool(includeSubsidiaries),
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /by-category — Emissions grouped by category with scope breakdown
 */
analyticsRouter.get('/by-category', async (req, res, next) => {
  try {
    const { dateFrom, dateTo, includeSubsidiaries } = req.query as Record<string, string | undefined>;
    const data = await analyticsService.getByCategory(req.orgId!, {
      dateFrom,
      dateTo,
      includeSubsidiaries: parseBool(includeSubsidiaries),
    });
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
    const { includeSubsidiaries } = req.query as Record<string, string | undefined>;
    const data = await analyticsService.getYoYComparison(req.orgId!, {
      includeSubsidiaries: parseBool(includeSubsidiaries),
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});
