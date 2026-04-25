/**
 * AAT-9C / Wave 9c — GET /api/v1/delist-requests (persistence audit P0).
 *
 * Mirrors retirements.ts. The audit (`docs/PERSISTENCE_AUDIT.md`) flagged
 * DelistRequest rows as write-only — `services/delist.service.ts` writes
 * but no list endpoint surfaced them. After hitting "Delist", a user has
 * no way to see their in-flight DelistRequest rows.
 *
 * Surgical: paginated list scoped to the caller's org.
 */
import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { prisma } from '@aurex/database';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';

export const delistRequestsRouter: IRouter = Router();

delistRequestsRouter.use(requireAuth, requireOrgScope);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * GET / — list delist requests for the caller's org.
 *
 * Org-scoped on `requestedByOrgId`. Returns most-recent first; joins
 * the underlying issuance so the UI can surface context.
 */
delistRequestsRouter.get('/', async (req, res, next) => {
  try {
    const { page, pageSize } = listQuerySchema.parse(req.query);
    const where = { requestedByOrgId: req.orgId! };
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.delistRequest.findMany({
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
      prisma.delistRequest.count({ where }),
    ]);

    res.json({ data: { items, total, page, pageSize } });
  } catch (err) {
    next(err);
  }
});
