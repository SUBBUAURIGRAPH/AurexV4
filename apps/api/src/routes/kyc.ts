import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import * as kycService from '../services/kyc/kyc.service.js';

/**
 * KYC / CDD / AML / CTF API (AAT-θ / AV4-354).
 *
 * Routes:
 *   POST   /verifications              start a User-scoped verification
 *                                      (ORG_ADMIN / MAKER / APPROVER)
 *   GET    /verifications/:id          read + refresh status
 *   POST   /verifications/:id/revoke   revoke (ORG_ADMIN / SUPER_ADMIN)
 *   POST   /beneficiary                start a beneficiary verification
 *                                      (B16 retirement pre-check)
 *
 * The default `disabled` adapter responds with `synced: false` for every
 * call — routes still return 202 Accepted in that case so callers
 * observe a uniform contract regardless of the active adapter. The
 * adapter status / reason are surfaced in the response body so callers
 * can decide what to do next.
 */
export const kycRouter: IRouter = Router();

kycRouter.use(requireAuth, requireOrgScope);

const START_ROLES = ['ORG_ADMIN', 'MAKER', 'APPROVER', 'MANAGER', 'SUPER_ADMIN'];
const REVOKE_ROLES = ['ORG_ADMIN', 'SUPER_ADMIN'];

const startUserVerificationSchema = z.object({
  subjectRef: z.string().min(1).max(255),
  level: z.enum(['basic', 'enhanced']).default('basic'),
  metadata: z.record(z.unknown()).default({}),
});

const startBeneficiaryVerificationSchema = z.object({
  beneficiaryRef: z.string().min(1).max(255),
  level: z.enum(['basic', 'enhanced']).default('enhanced'),
  metadata: z.record(z.unknown()).default({}),
});

const revokeSchema = z.object({
  reason: z.string().min(1).max(2000),
});

/**
 * POST /verifications — start a User-scoped KYC verification.
 *
 * Body: { subjectRef, level?, metadata? }
 * Returns 202 with the adapter result; `synced: false` means the
 * default `disabled` adapter is active or the vendor refused the call.
 */
kycRouter.post(
  '/verifications',
  requireOrgRole(...START_ROLES),
  async (req, res, next) => {
    try {
      const body = startUserVerificationSchema.parse(req.body);
      const result = await kycService.startVerification({
        subjectKind: 'user',
        subjectRef: body.subjectRef,
        level: body.level,
        metadata: body.metadata,
        orgId: req.orgId ?? null,
        userId: req.user?.sub ?? null,
      });
      res.status(202).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /verifications/:id — read + refresh status from the adapter.
 */
kycRouter.get('/verifications/:id', async (req, res, next) => {
  try {
    const verificationId = req.params.id as string;
    const result = await kycService.getVerification({
      verificationId,
      orgId: req.orgId ?? null,
      userId: req.user?.sub ?? null,
    });
    if (!result.verification && !result.synced) {
      // Disabled adapter + missing row → 404 so callers don't wait for
      // a vendor that is not configured.
      res.status(404).json({
        type: 'https://aurex.in/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: result.reason ?? 'verification not found',
      });
      return;
    }
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /verifications/:id/revoke — admin-only revocation path. Used on
 * sanctions-list updates or operator-initiated revocation.
 */
kycRouter.post(
  '/verifications/:id/revoke',
  requireOrgRole(...REVOKE_ROLES),
  async (req, res, next) => {
    try {
      const verificationId = req.params.id as string;
      const { reason } = revokeSchema.parse(req.body);
      const result = await kycService.revokeVerification({
        verificationId,
        reason,
        orgId: req.orgId ?? null,
        userId: req.user?.sub ?? null,
      });
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /beneficiary — start a beneficiary KYC verification ahead of a
 * BCR retirement (B16 pre-check). Beneficiary identities are external to
 * the User table; the caller supplies a stable beneficiary reference.
 */
kycRouter.post(
  '/beneficiary',
  requireOrgRole(...START_ROLES),
  async (req, res, next) => {
    try {
      const body = startBeneficiaryVerificationSchema.parse(req.body);
      const result = await kycService.startVerification({
        subjectKind: 'beneficiary',
        subjectRef: body.beneficiaryRef,
        level: body.level,
        metadata: body.metadata,
        orgId: req.orgId ?? null,
        userId: req.user?.sub ?? null,
      });
      res.status(202).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);
