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
 */
import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { prisma } from '@aurex/database';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';

export const retirementsRouter: IRouter = Router();

retirementsRouter.use(requireAuth, requireOrgScope);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * GET / — list retirements for the caller's org.
 *
 * Org-scoped on `retiredByOrgId`. Returns the most-recent first; joins
 * the underlying issuance for context (bcrSerialId / vintage / activity).
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

    res.json({ data: { items, total, page, pageSize } });
  } catch (err) {
    next(err);
  }
});
