import { Router, type IRouter } from 'express';
import { generateReportSchema } from '@aurex/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import { requireOnboardingComplete } from '../middleware/onboarding-gate.js';
import { logger } from '../lib/logger.js';
import * as reportService from '../services/report.service.js';

export const reportRouter: IRouter = Router();

/**
 * Public share-token route — must be declared BEFORE the auth middleware so
 * unauthenticated callers can fetch a published report.
 */
reportRouter.get('/public/:shareToken', async (req, res, next) => {
  try {
    const shareToken = req.params.shareToken as string;
    const report = await reportService.getPublishedReportByToken(shareToken);
    res.json({ data: report });
  } catch (err) {
    next(err);
  }
});

// All other report routes require auth + org scope
reportRouter.use(requireAuth, requireOrgScope);

/**
 * POST /generate — Start report generation
 */
reportRouter.post(
  '/generate',
  requireOnboardingComplete,
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
 * GET /:id — Get full report including lifecycleStatus, timestamps, shareToken.
 */
reportRouter.get('/:id', async (req, res, next) => {
  try {
    const report = await reportService.getReport(req.params.id as string, req.orgId!);
    res.json({ data: report });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:id/status — Poll report generation status
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
 * GET /:id/download — Download report data as a JSON file.
 *
 * Sets Content-Disposition: attachment so the browser triggers a file
 * download dialog instead of rendering the JSON inline (which to the user
 * looks like a blank tab — the tester report from 2026-04-25 flagged this).
 *
 * CSV / PDF generation is a Wave 10 follow-up; for now JSON is the only
 * format and we make it actually downloadable.
 */
reportRouter.get('/:id/download', async (req, res, next) => {
  try {
    const report = await reportService.downloadReport(req.params.id as string, req.orgId!);
    const filename = `report-${report.type.toLowerCase()}-${report.id}.json`;
    const payload = JSON.stringify(
      {
        report: {
          id: report.id,
          type: report.type,
          status: report.status,
          lifecycleStatus: report.lifecycleStatus,
          parameters: report.parameters,
          publishedAt: report.publishedAt,
        },
        data: report.reportData,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(payload, 'utf-8').toString());
    res.send(payload);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:id/indicator-summary — Just the indicatorSummary section. Cheaper
 * than /:id/download for frontend tile widgets.
 */
reportRouter.get('/:id/indicator-summary', async (req, res, next) => {
  try {
    const summary = await reportService.getIndicatorSummary(
      req.params.id as string,
      req.orgId!,
    );
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
});

// ─── Lifecycle transitions (Phase D) ─────────────────────────────────────

/**
 * POST /:id/submit-for-review — DRAFT → REVIEW.
 * Any org member with MANAGER+ role (or the creator) may submit.
 */
reportRouter.post(
  '/:id/submit-for-review',
  requireOrgRole('MAKER', 'MANAGER', 'APPROVER', 'ORG_ADMIN', 'SUPER_ADMIN', 'ANALYST'),
  async (req, res, next) => {
    try {
      const row = await reportService.submitForReview(req.params.id as string, {
        orgId: req.orgId!,
        userId: req.user!.sub,
        ipAddress: req.ip,
      });
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /:id/approve — REVIEW → APPROVED. APPROVER/ORG_ADMIN/SUPER_ADMIN only.
 */
reportRouter.post(
  '/:id/approve',
  requireOrgRole('APPROVER', 'ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const row = await reportService.approveReport(req.params.id as string, {
        orgId: req.orgId!,
        userId: req.user!.sub,
        ipAddress: req.ip,
      });
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /:id/publish — APPROVED → PUBLISHED. ORG_ADMIN/SUPER_ADMIN only.
 * Generates a random share token for stakeholder access.
 */
reportRouter.post(
  '/:id/publish',
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const row = await reportService.publishReport(req.params.id as string, {
        orgId: req.orgId!,
        userId: req.user!.sub,
        ipAddress: req.ip,
      });
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /:id/archive — any → ARCHIVED. ORG_ADMIN/SUPER_ADMIN only.
 */
reportRouter.post(
  '/:id/archive',
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const row = await reportService.archiveReport(req.params.id as string, {
        orgId: req.orgId!,
        userId: req.user!.sub,
        ipAddress: req.ip,
      });
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);
