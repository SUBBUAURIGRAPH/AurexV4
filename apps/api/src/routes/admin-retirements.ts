/**
 * AAT-R4 / AV4-438 — admin endpoints for granular retirement disclosures
 * (EU CSRD ESRS E1-7).
 *
 * Two endpoints, both SUPER_ADMIN-gated:
 *
 *   GET  /api/v1/admin/retirements/csrd-export
 *        ?orgId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *        Streams a flat CSV with the column order ESRS E1-7 disclosure
 *        tooling expects. RFC 7807 errors on bad inputs.
 *
 *   POST /api/v1/admin/retirements/backfill-granularity
 *        Operator one-shot to populate denormalised CSRD fields on
 *        pre-existing rows. Idempotent.
 *
 * The export is org-scoped (SUPER_ADMIN must specify which org's
 * retirements to disclose) — global cross-org dumps are deliberately not
 * supported through this endpoint.
 */
import { Router, type IRouter } from 'express';
import { z, ZodError } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import {
  buildCsrdExportCsv,
  backfillRetirementGranularity,
  ESRS_E17_FIELD_MAPPING,
  CSRD_RETIREMENT_CSV_HEADER,
} from '../services/retirement-csrd-export.service.js';

export const adminRetirementsRouter: IRouter = Router();

adminRetirementsRouter.use(requireAuth, requireRole('SUPER_ADMIN'));

// ── Schemas ───────────────────────────────────────────────────────────────

const csrdExportQuerySchema = z.object({
  orgId: z.string().uuid({ message: 'orgId must be a UUID' }),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
});

function parseDateOrThrow(label: string, raw: string): Date {
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(
      400,
      'Bad Request',
      `${label} is not a valid calendar date: ${raw}`,
      'https://aurex.in/errors/validation',
    );
  }
  return d;
}

// ── Routes ────────────────────────────────────────────────────────────────

/**
 * GET /csrd-export — flat CSV for ESRS E1-7 disclosure.
 *
 * The `to` query param is treated as exclusive upper bound on createdAt
 * (so `from=2026-01-01&to=2026-04-01` returns Q1 2026 retirements).
 */
adminRetirementsRouter.get('/csrd-export', async (req, res, next) => {
  try {
    let parsed;
    try {
      parsed = csrdExportQuerySchema.parse(req.query);
    } catch (err) {
      if (err instanceof ZodError) {
        // Surface as RFC 7807 directly so the validation error inherits
        // the consistent error shape the rest of the API uses.
        throw new AppError(
          400,
          'Bad Request',
          err.issues
            .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
            .join('; '),
          'https://aurex.in/errors/validation',
        );
      }
      throw err;
    }

    const from = parseDateOrThrow('from', parsed.from);
    const to = parseDateOrThrow('to', parsed.to);
    if (to.getTime() <= from.getTime()) {
      throw new AppError(
        400,
        'Bad Request',
        `to (${parsed.to}) must be strictly after from (${parsed.from})`,
        'https://aurex.in/errors/validation',
      );
    }

    const artifact = await buildCsrdExportCsv(parsed.orgId, { from, to });

    logger.info(
      {
        orgId: parsed.orgId,
        from: parsed.from,
        to: parsed.to,
        rowCount: artifact.rowCount,
        actor: req.user?.sub,
      },
      'CSRD ESRS E1-7 retirement export served',
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${artifact.filename}"`,
    );
    res.setHeader('X-Csrd-Row-Count', String(artifact.rowCount));
    res.send(artifact.csv);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /csrd-export/metadata — AV4-439 explicit ESRS E1-7 field mapping.
 *
 * Returns the column-to-ESRS-data-point crosswalk as JSON so external ESG
 * auditors can pivot Aurex CSV output → their ESRS template without
 * re-deriving the mapping from code comments. Same SUPER_ADMIN posture as
 * the export itself; the metadata shape is stable across rows so it can
 * be fetched once per audit cycle.
 *
 * Response shape:
 *   {
 *     mapping: Record<csvColumn, { fieldKey, esrsRef, description }>,
 *     csvHeader: string[],          // CSV column order (load-bearing)
 *     fieldOrder: string[],         // mapping key order (matches CSV)
 *     generatedAt: string           // ISO timestamp
 *   }
 */
adminRetirementsRouter.get('/csrd-export/metadata', (req, res, next) => {
  try {
    // Pivot the mapping by csvColumn so consumers can lookup either by
    // camelCase field key or by snake_case CSV column name.
    const mappingByColumn: Record<
      string,
      { fieldKey: string; esrsRef: string; description: string }
    > = {};
    for (const [fieldKey, entry] of Object.entries(ESRS_E17_FIELD_MAPPING)) {
      mappingByColumn[entry.csvColumn] = {
        fieldKey,
        esrsRef: entry.esrsRef,
        description: entry.description,
      };
    }

    logger.info(
      { actor: req.user?.sub },
      'CSRD ESRS E1-7 metadata mapping served',
    );

    res.json({
      data: {
        mapping: mappingByColumn,
        csvHeader: [...CSRD_RETIREMENT_CSV_HEADER],
        fieldOrder: Object.keys(ESRS_E17_FIELD_MAPPING),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /backfill-granularity — operator one-shot to populate the new
 * AV4-438 denormalised columns on legacy Retirement rows. Idempotent.
 */
adminRetirementsRouter.post('/backfill-granularity', async (req, res, next) => {
  try {
    const result = await backfillRetirementGranularity();
    logger.info(
      { ...result, actor: req.user?.sub },
      'backfillRetirementGranularity invoked via admin route',
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});
