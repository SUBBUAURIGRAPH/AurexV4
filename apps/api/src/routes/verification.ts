import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import * as verificationService from '../services/verification.service.js';
import * as hostAuthService from '../services/host-authorization.service.js';

export const verificationRouter: IRouter = Router();

verificationRouter.use(requireAuth, requireOrgScope);

// DOE-gated — only DOE + SUPER_ADMIN may submit validation/verification reports.
const DOE_ONLY = ['DOE', 'SUPER_ADMIN'];

// DNA-gated — host-country authorization ops.
const DNA_ONLY = ['DNA', 'SUPER_ADMIN'];

// ─── Validation (ex-ante) ─────────────────────────────────────────────

const validationSchema = z.object({
  doeOrgName: z.string().min(1).max(255),
  doeAccreditationId: z.string().max(100).optional(),
  opinion: z.enum(['POSITIVE', 'NEGATIVE', 'CONDITIONAL']),
  findings: z.unknown().optional(),
  documentUrl: z.string().url().max(500).optional(),
});

verificationRouter.post('/activities/:id/validation', requireOrgRole(...DOE_ONLY), async (req, res, next) => {
  try {
    const data = validationSchema.parse(req.body);
    const row = await verificationService.submitValidationReport(
      req.params.id as string,
      req.orgId!,
      req.user!.sub,
      data,
    );
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

// ─── Verification (ex-post, per monitoring period) ─────────────────────

const verificationSchema = z.object({
  doeOrgName: z.string().min(1).max(255),
  doeAccreditationId: z.string().max(100).optional(),
  methodologyVersion: z.string().min(1).max(32),
  baselineEmissions: z.number().nonnegative(),
  projectEmissions: z.number().nonnegative(),
  leakageEmissions: z.number().nonnegative(),
  conservativenessPct: z.number().min(0).max(100).optional(),
  opinion: z.enum(['POSITIVE', 'NEGATIVE', 'CONDITIONAL']),
  findings: z.unknown().optional(),
  documentUrl: z.string().url().max(500).optional(),
});

verificationRouter.post(
  '/periods/:periodId/verification',
  requireOrgRole(...DOE_ONLY),
  async (req, res, next) => {
    try {
      const data = verificationSchema.parse(req.body);
      const result = await verificationService.submitVerificationReport(
        req.params.periodId as string,
        req.orgId!,
        req.user!.sub,
        data,
      );
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Host authorization (LoA) ─────────────────────────────────────────

const issueAuthSchema = z.object({
  dnaName: z.string().min(1).max(255),
  authorizedFor: z.enum(['NDC_USE', 'OIMP', 'NDC_AND_OIMP', 'MITIGATION_CONTRIBUTION']),
  authorizationScopeNotes: z.string().max(5000).optional(),
  documentUrl: z.string().url().max(500).optional(),
  validFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  validUntil: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
});

verificationRouter.post('/activities/:id/authorization', requireOrgRole(...DNA_ONLY), async (req, res, next) => {
  try {
    const data = issueAuthSchema.parse(req.body);
    const row = await hostAuthService.issueAuthorization(
      req.params.id as string,
      req.orgId!,
      req.user!.sub,
      {
        ...data,
        validFrom: new Date(data.validFrom),
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      },
    );
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

const revokeAuthSchema = z.object({ reason: z.string().min(1).max(2000) });

verificationRouter.post('/activities/:id/authorization/revoke', requireOrgRole(...DNA_ONLY), async (req, res, next) => {
  try {
    const { reason } = revokeAuthSchema.parse(req.body);
    const row = await hostAuthService.revokeAuthorization(
      req.params.id as string,
      req.orgId!,
      req.user!.sub,
      reason,
    );
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
