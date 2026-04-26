/**
 * AAT-367 / AV4-367 — federation router.
 *
 *   POST  /api/v1/federation/awd2/handback   (partner JWT, AWD2)
 *   GET   /api/v1/federation/peer-pings      (admin auth, SUPER_ADMIN)
 *
 * The legacy direct AWD2 → Aurex handoff route at `/api/v1/awd2/handoff`
 * stays where it is (AAT-ξ); this router carries the federated identity
 * path. Eventually the handoff will migrate here, but that's out of
 * scope for this ticket.
 *
 * `/handback` is the canonical "AWD2 changed its mind" path: AWD2 hands
 * off a credit, then realises the source row was wrong (operator typo,
 * wrong project, etc.) and emits a cancel/reissue instruction. We mark
 * the matching `Awd2Handoff` row as FAILED with reason
 * `cancelled-by-source` (or `reissue-requested` for the reissue
 * variant) so the operator can decide whether to re-import. We do NOT
 * touch the `Issuance` row here — that's a follow-up reversal task
 * (Wave 13+).
 */

import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@aurex/database';
import { requireFederation } from '../middleware/require-federation.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import { recordAudit } from '../services/audit-log.service.js';

export const federationRouter: IRouter = Router();

// ── /awd2/handback ───────────────────────────────────────────────────────

const handbackBodySchema = z.object({
  awd2HandoffNonce: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,64}$/, 'awd2HandoffNonce must be 8–64 chars [A-Za-z0-9_-]'),
  action: z.enum(['cancel', 'reissue']),
  reason: z.string().max(2000).optional(),
});

federationRouter.post(
  '/awd2/handback',
  requireFederation('AWD2'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = handbackBodySchema.parse(req.body);

      const existing = await prisma.awd2Handoff.findUnique({
        where: { handoffNonce: body.awd2HandoffNonce },
        select: { id: true, status: true, issuanceId: true },
      });
      if (!existing) {
        throw new AppError(
          404,
          'Not Found',
          `No AWD2 handoff found for nonce ${body.awd2HandoffNonce}`,
          'https://aurex.in/errors/handoff-not-found',
        );
      }

      const reasonCode =
        body.action === 'cancel' ? 'cancelled-by-source' : 'reissue-requested';
      const fullReason = body.reason
        ? `${reasonCode}: ${body.reason}`
        : reasonCode;

      const updated = await prisma.awd2Handoff.update({
        where: { id: existing.id },
        data: {
          status: 'FAILED',
          reason: fullReason,
        },
        select: { id: true, status: true, reason: true, issuanceId: true },
      });

      await recordAudit({
        userId: null,
        action: `awd2.handoff.${body.action}`,
        resource: 'Awd2Handoff',
        resourceId: existing.id,
        newValue: { status: updated.status, reason: updated.reason },
      });

      logger.info(
        {
          awd2HandoffId: existing.id,
          handoffNonce: body.awd2HandoffNonce,
          action: body.action,
        },
        'AWD2 handback applied',
      );

      res.status(200).json({
        data: {
          awd2HandoffId: existing.id,
          status: updated.status,
          reason: updated.reason,
          issuanceId: updated.issuanceId,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── /peer-pings (ops visibility) ────────────────────────────────────────

federationRouter.get(
  '/peer-pings',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 500);
      const rows = await prisma.federationCallLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          direction: true,
          partner: true,
          keyId: true,
          endpoint: true,
          status: true,
          httpStatus: true,
          errorMessage: true,
          requestId: true,
          latencyMs: true,
          createdAt: true,
        },
      });
      res.status(200).json({ data: rows, count: rows.length });
    } catch (err) {
      next(err);
    }
  },
);
