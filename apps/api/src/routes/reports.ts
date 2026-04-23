import { Router, type IRouter } from 'express';
import { generateReportSchema } from '@aurex/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { logger } from '../lib/logger.js';
import * as reportService from '../services/report.service.js';

export const reportRouter: IRouter = Router();

// All report routes require auth + org scope
reportRouter.use(requireAuth, requireOrgScope);

/**
 * POST /generate — Start report generation
 */
reportRouter.post(
  '/generate',
  requireRole('manager', 'org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const data = generateReportSchema.parse(req.body);

      const report = await reportService.generateReport({
        orgId: req.orgId!,
        createdBy: req.user!.sub,
        type: data.type,
        year: data.year,
        scopes: data.scopes,
        includeSubsidiaries: data.includeSubsidiaries,
      });

      logger.info(
        { reportId: report.id, type: data.type, generatedBy: req.user!.sub },
        'Report generated via API',
      );
      res.status(201).json({ data: { id: report.id, status: report.status } });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET / — List generated reports for org
 */
reportRouter.get('/', async (req, res, next) => {
  try {
    const reports = await reportService.listReports(req.orgId!);
    res.json({ data: reports });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:id/status — Poll report status
 */
reportRouter.get('/:id/status', async (req, res, next) => {
  try {
    const status = await reportService.getReportStatus(req.params.id as string, req.orgId!);
    res.json({ data: status });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:id/download — Download report data
 */
reportRouter.get('/:id/download', async (req, res, next) => {
  try {
    const report = await reportService.downloadReport(req.params.id as string, req.orgId!);
    res.json({ data: report.reportData });
  } catch (err) {
    next(err);
  }
});
