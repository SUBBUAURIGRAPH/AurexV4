/**
 * AAT-V3PORT: public coupon routes (NO AUTH).
 *
 *   POST /api/v1/coupons/validate      — pre-signup validation
 *   POST /api/v1/coupons/redeem        — atomic redemption + trial-window grant
 *   POST /api/v1/coupons/hef/validate  — V3 HEF parity alias of /validate
 *
 * The validate + redeem endpoints are intentionally public — that's the
 * whole point of pre-signup validation, the user does not have a JWT yet.
 * Brute-force protection comes from the global rate-limiter middleware
 * (100 req / 60s / IP) plus the per-IP burst guard inside
 * `coupon.service.recordValidateAttempt` (10 req / 5min / IP).
 *
 * The endpoints DO NOT create User rows — wiring the redemption into the
 * AurexV4 signup flow is a follow-up. The redeem response includes the
 * trial window so the caller can decide what to do with it.
 */

import { Router, type IRouter, type Request } from 'express';
import { z } from 'zod';
import * as couponService from '../services/coupon.service.js';

export const couponsRouter: IRouter = Router();

// ─── Schemas ───────────────────────────────────────────────────────────

const validateSchema = z.object({
  code: z.string().trim().min(1).max(64),
  email: z.string().email().optional(),
});

const redeemSchema = z.object({
  code: z.string().trim().min(1).max(64),
  email: z.string().email(),
  geoCountry: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .transform((s) => s.toUpperCase())
    .optional(),
});

// ─── Helpers ───────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

// ─── Handlers ──────────────────────────────────────────────────────────

const handleValidate: (req: Request, res: import('express').Response, next: import('express').NextFunction) => Promise<void> = async (req, res, next) => {
  try {
    const body = validateSchema.parse(req.body ?? {});
    const ipAddress = getClientIp(req);
    const result = await couponService.validateCoupon({
      code: body.code,
      email: body.email,
      ipAddress,
    });

    // IP_BURST_LIMIT maps to 429 so callers see standard rate-limit semantics.
    if (result.reason === 'IP_BURST_LIMIT') {
      res.status(429).json({
        type: 'https://aurex.in/errors/rate-limited',
        title: 'Too Many Requests',
        status: 429,
        detail: result.message,
      });
      return;
    }

    // Always 200: validate is read-only and `valid:false` is part of the
    // public contract (the V3 client treats `valid` as the boolean to
    // branch on, not the HTTP status). See coupon-routes.ts:165 in V3.
    res.status(200).json({
      valid: result.valid,
      reason: result.reason,
      message: result.message,
      coupon: result.coupon,
    });
  } catch (err) {
    next(err);
  }
};

couponsRouter.post('/validate', handleValidate);

// V3 parity: /api/v1/coupons/hef/validate is an alias of /validate kept
// for marketing/landing-page compatibility. Behaviour is identical — no
// HEF-specific server-side logic in V3 either, beyond the branding.
// TODO(AAT-V3PORT-2): if/when HEF gets distinct rules (e.g. enforce
// `couponCode.startsWith('HEF-')`), split this handler.
couponsRouter.post('/hef/validate', handleValidate);

couponsRouter.post('/redeem', async (req, res, next) => {
  try {
    const body = redeemSchema.parse(req.body ?? {});
    const ipAddress = getClientIp(req);
    const result = await couponService.redeemCoupon({
      code: body.code,
      email: body.email,
      ipAddress,
      geoCountry: body.geoCountry,
    });

    res.status(201).json({
      data: {
        redemptionId: result.redemptionId,
        trialStart: result.trialStart.toISOString(),
        trialEnd: result.trialEnd.toISOString(),
        trialTier: result.trialTier,
        trialDurationDays: result.trialDurationDays,
      },
    });
  } catch (err) {
    next(err);
  }
});
