import { Router, type IRouter } from 'express';
import { generateReportSchema } from '@aurex/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import { requireOnboardingComplete } from '../middleware/onboarding-gate.js';
import { requireActiveSubscription } from '../middleware/subscription-active-gate.js';
import { logger } from '../lib/logger.js';
import * as reportService from '../services/report.service.js';
import { writeCsvBuffer } from '../services/csv-writer.js';
import {
  buildReportCsv,
  buildReportSummary,
} from '../services/report-export.js';
import { renderReportPdf } from '../services/report-pdf.js';

/**
 * AAT-10C (Wave 10c): supported `?format=` values on /:id/download.
 * Unknown formats yield a 400 RFC 7807 problem detail (handled inline
 * in the route — no exception class — to keep the router self-contained).
 */
export const SUPPORTED_DOWNLOAD_FORMATS = ['json', 'csv', 'pdf'] as const;
export type DownloadFormat = (typeof SUPPORTED_DOWNLOAD_FORMATS)[number];

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
  requireOnboardingComplete, requireActiveSubscription,
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
 * GET /:id/download — Download a report as JSON (default), CSV, or PDF.
 *
 * Sets `Content-Disposition: attachment` so the browser triggers a file
 * download dialog instead of rendering inline (the tester report from
 * 2026-04-25 flagged that as a blank-tab bug for the JSON path).
 *
 * AAT-10C (Wave 10c): adds CSV + PDF support. Format is selected via
 * the `?format=` query parameter:
 *   - `json` (default): existing behaviour — full reportData JSON
 *   - `csv`           : flattened per-type rows (see `report-export.ts`)
 *   - `pdf`           : single-page printable summary (pdfkit)
 *
 * Unknown formats return 400 RFC 7807 (handled inline so we keep the
 * `report` lookup short-circuited until the format is validated).
 */
reportRouter.get('/:id/download', async (req, res, next) => {
  try {
    const rawFormat = req.query.format;
    const formatStr = rawFormat === undefined || rawFormat === ''
      ? 'json'
      : String(rawFormat).toLowerCase();
    if (!(SUPPORTED_DOWNLOAD_FORMATS as readonly string[]).includes(formatStr)) {
      res
        .status(400)
        .setHeader('Content-Type', 'application/problem+json; charset=utf-8')
        .json({
          type: 'https://aurex.in/errors/unsupported-format',
          title: 'Bad Request',
          status: 400,
          detail: `Unsupported download format '${formatStr}'. Supported: ${SUPPORTED_DOWNLOAD_FORMATS.join(', ')}.`,
          instance: req.originalUrl,
          supported: [...SUPPORTED_DOWNLOAD_FORMATS],
        });
      return;
    }
    const format = formatStr as DownloadFormat;

    const report = await reportService.downloadReport(
      req.params.id as string,
      req.orgId!,
    );
    const typeSlug = (report.type ?? 'report').toLowerCase();

    if (format === 'csv') {
      const { headers, rows } = buildReportCsv(report.type, report.reportData);
      const buf = writeCsvBuffer(rows, headers);
      const filename = `report-${typeSlug}-${report.id}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader('Content-Length', buf.byteLength.toString());
      res.send(buf);
      return;
    }

    if (format === 'pdf') {
      const summary = buildReportSummary({
        id: report.id,
        type: report.type,
        parameters: report.parameters,
        publishedAt: report.publishedAt,
        createdAt: report.createdAt,
        reportData: report.reportData,
      });
      const buf = await renderReportPdf({
        reportType: report.type ?? 'report',
        reportId: report.id,
        summary,
      });
      const filename = `report-${typeSlug}-${report.id}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader('Content-Length', buf.byteLength.toString());
      res.send(buf);
      return;
    }

    // Default: JSON
    const filename = `report-${typeSlug}-${report.id}.json`;
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
    res.setHeader(
      'Content-Length',
      Buffer.byteLength(payload, 'utf-8').toString(),
    );
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
