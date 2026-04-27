/**
 * AAT-9C / Wave 9c — GET /api/v1/retirements (persistence audit P0).
 *
 * The persistence audit (`docs/PERSISTENCE_AUDIT.md`, Wave 9b) found that
 * Retirement rows are written by `services/retirement.service.ts` but
 * there is no public list endpoint. This is the smoking-gun cause of the
 * tester's "nothing gets generated for downloads or further action"
 * report — the UI has no API to call to render "your retirements".
 *
 * Surgical: a single auth-gated, org-scoped paginated list endpoint that
 * wraps `prisma.retirement.findMany` with the same join pattern used in
 * `biocarbon-public.service.ts:478`.
 *
 * AAT-R5 / AV4-437 — extended to:
 *   1. Surface the EU CBAM disclaimer on every list and detail response
 *      (every retirement artefact carries the disclaimer).
 *   2. Add `GET /:id` for the detail view (used by the PDF retirement-
 *      statement renderer + future UI deep-link).
 *   3. Add `GET /:id/statement.pdf` for the retirement-statement PDF
 *      which embeds the CBAM disclaimer paragraph.
 */
import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { prisma } from '@aurex/database';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { AppError } from '../middleware/error-handler.js';
import { CBAM_DISCLAIMER } from '../services/retirement.service.js';
import { renderRetirementStatementPdf } from '../services/retirement-statement-pdf.js';

export const retirementsRouter: IRouter = Router();

retirementsRouter.use(requireAuth, requireOrgScope);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const idParamSchema = z.object({
  id: z.string().uuid({ message: 'id must be a UUID' }),
});

/**
 * GET / — list retirements for the caller's org.
 *
 * Org-scoped on `retiredByOrgId`. Returns the most-recent first; joins
 * the underlying issuance for context (bcrSerialId / vintage / activity).
 * Response envelope carries `cbamDisclaimer` per AV4-437 — every
 * retirement artefact must surface the EU CBAM disclaimer.
 */
retirementsRouter.get('/', async (req, res, next) => {
  try {
    const { page, pageSize } = listQuerySchema.parse(req.query);
    const where = { retiredByOrgId: req.orgId! };
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.retirement.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          issuance: {
            select: {
              id: true,
              activityId: true,
              vintage: true,
              bcrSerialId: true,
              status: true,
            },
          },
        },
      }),
      prisma.retirement.count({ where }),
    ]);

    res.json({
      data: { items, total, page, pageSize },
      cbamDisclaimer: CBAM_DISCLAIMER,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:id — single retirement detail (AV4-437).
 *
 * Org-scoped: returns 404 (not 403) when the retirement exists but
 * belongs to a different org, to avoid leaking existence. Carries
 * `cbamDisclaimer` per AV4-437.
 */
retirementsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const row = await prisma.retirement.findFirst({
      where: { id, retiredByOrgId: req.orgId! },
      include: {
        issuance: {
          select: {
            id: true,
            activityId: true,
            vintage: true,
            bcrSerialId: true,
            status: true,
          },
        },
      },
    });
    if (!row) {
      throw new AppError(
        404,
        'Not Found',
        `Retirement ${id} not found`,
      );
    }
    res.json({
      data: row,
      cbamDisclaimer: CBAM_DISCLAIMER,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:id/statement.pdf — retirement-statement PDF (AV4-437).
 *
 * Renders a printable retirement statement that always includes the
 * EU CBAM disclaimer paragraph. Org-scoped on the same posture as the
 * detail endpoint.
 */
retirementsRouter.get('/:id/statement.pdf', async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const row = await prisma.retirement.findFirst({
      where: { id, retiredByOrgId: req.orgId! },
      include: {
        issuance: {
          select: {
            id: true,
            activityId: true,
            vintage: true,
            bcrSerialId: true,
          },
        },
      },
    });
    if (!row) {
      throw new AppError(
        404,
        'Not Found',
        `Retirement ${id} not found`,
      );
    }

    const buf = await renderRetirementStatementPdf({ retirement: row });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="retirement-${id}.pdf"`,
    );
    res.setHeader('Content-Length', String(buf.length));
    res.send(buf);
  } catch (err) {
    next(err);
  }
});
