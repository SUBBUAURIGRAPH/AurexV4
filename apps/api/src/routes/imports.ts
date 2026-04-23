import express, { Router, type IRouter } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { logger } from '../lib/logger.js';
import * as importService from '../services/import.service.js';
import { AppError } from '../middleware/error-handler.js';

export const importRouter: IRouter = Router();

// All import routes require auth + org scope
importRouter.use(requireAuth, requireOrgScope);

/**
 * POST /emissions — Bulk CSV import of emissions records.
 *
 * Accepts either:
 *   - Content-Type: text/csv with the raw CSV as the request body, or
 *   - Content-Type: application/json with `{ filename: string, csv: string }`.
 *
 * The route-level `express.text({ type: 'text/csv' })` parser populates
 * `req.body` as a string when Content-Type is text/csv. For JSON, the global
 * express.json() parser in index.ts handles the body.
 *
 * Auth: requireAuth + requireOrgScope + requireRole (manager | org_admin | super_admin).
 */
importRouter.post(
  '/emissions',
  requireRole('manager', 'org_admin', 'super_admin'),
  express.text({ type: 'text/csv', limit: '20mb' }),
  async (req, res, next) => {
    try {
      const contentType = (req.headers['content-type'] ?? '').toLowerCase();
      let filename: string;
      let csv: string;

      if (contentType.startsWith('text/csv')) {
        csv = typeof req.body === 'string' ? req.body : '';
        filename =
          (req.headers['x-filename'] as string | undefined)?.slice(0, 255) ?? 'upload.csv';
      } else if (
        req.body &&
        typeof req.body === 'object' &&
        typeof (req.body as Record<string, unknown>).csv === 'string'
      ) {
        const body = req.body as { filename?: unknown; csv: string };
        csv = body.csv;
        filename =
          typeof body.filename === 'string' && body.filename.length > 0
            ? body.filename.slice(0, 255)
            : 'upload.csv';
      } else {
        throw new AppError(
          400,
          'Bad Request',
          'Send Content-Type: text/csv with raw CSV body, or JSON { filename, csv }',
        );
      }

      if (!csv || csv.trim().length === 0) {
        throw new AppError(400, 'Bad Request', 'CSV body is empty');
      }

      const job = await importService.importEmissionsCsv(
        req.orgId!,
        req.user!.sub,
        filename,
        csv,
      );

      logger.info(
        {
          jobId: job.id,
          orgId: req.orgId,
          createdBy: req.user!.sub,
          total: job.totalRows,
          ok: job.successRows,
          errs: job.errorRows,
        },
        'CSV emissions import via API',
      );
      res.status(201).json({ data: job });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /emissions — List import jobs for the org.
 * Query: page, pageSize.
 */
importRouter.get('/emissions', async (req, res, next) => {
  try {
    const { page = '1', pageSize = '20' } = req.query as Record<string, string | undefined>;
    const result = await importService.listImportJobs(
      req.orgId!,
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /emissions/:id — Fetch a single import job.
 */
importRouter.get('/emissions/:id', async (req, res, next) => {
  try {
    const job = await importService.getImportJob(req.params.id as string, req.orgId!);
    res.json({ data: job });
  } catch (err) {
    next(err);
  }
});
