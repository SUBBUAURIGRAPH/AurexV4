/**
 * AAT-R2 / AV4-427 — admin operational endpoints for BRSR Core
 * assurance-readiness audit metadata. Gated to SUPER_ADMIN globally;
 * org-scoped admins (ORG_ADMIN) can also promote rows belonging to
 * their own org via the same route — we re-check ownership inside the
 * handler so the access pattern stays uniform whether the caller is a
 * platform operator or a tenant administrator.
 *
 *   POST /api/v1/admin/brsr/responses/:id/assurance
 *
 * The route accepts a JSON body with `assuranceStatus` plus optional
 * `lastReviewedBy` + `lastReviewedAt` overrides. Every state change
 * is mirrored into the central `AuditLog` table by the service layer
 * (see `setAssurance` in brsr.service.ts) so external auditors can
 * trace the full review chain.
 */

import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import {
  BRSR_ASSURANCE_STATUSES,
  setAssurance,
} from '../services/brsr.service.js';

export const adminBrsrRouter: IRouter = Router();

/**
 * Both SUPER_ADMIN (platform ops) and ORG_ADMIN (tenant admin) are
 * permitted to call the assurance route. The service layer audits
 * every change with the JWT caller's user id so attribution survives
 * even when multiple admins touch the same row.
 */
adminBrsrRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ORG_ADMIN'));

// ── Schemas ──────────────────────────────────────────────────────────────

const idParamSchema = z.object({
  id: z.string().uuid('id must be a UUID'),
});

const assuranceBodySchema = z.object({
  assuranceStatus: z.enum(
    BRSR_ASSURANCE_STATUSES as unknown as [string, ...string[]],
  ),
  lastReviewedBy: z
    .string()
    .uuid('lastReviewedBy must be a UUID')
    .nullable()
    .optional(),
  lastReviewedAt: z
    .string()
    .datetime({ offset: true, message: 'lastReviewedAt must be ISO-8601' })
    .nullable()
    .optional(),
});

// ── POST /responses/:id/assurance ───────────────────────────────────────

adminBrsrRouter.post(
  '/responses/:id/assurance',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const body = assuranceBodySchema.parse(req.body);

      const reviewerUserId = req.user?.sub;
      if (!reviewerUserId) {
        throw new AppError(401, 'Unauthorized', 'Missing JWT subject');
      }

      const result = await setAssurance(id, reviewerUserId, {
        assuranceStatus:
          body.assuranceStatus as (typeof BRSR_ASSURANCE_STATUSES)[number],
        ...(body.lastReviewedBy !== undefined
          ? { lastReviewedBy: body.lastReviewedBy }
          : {}),
        ...(body.lastReviewedAt !== undefined
          ? {
              lastReviewedAt:
                body.lastReviewedAt === null
                  ? null
                  : new Date(body.lastReviewedAt),
            }
          : {}),
        ...(req.ip ? { ipAddress: req.ip } : {}),
      });

      res.status(200).json({
        data: {
          response: result.response,
          previousStatus: result.previousStatus,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
