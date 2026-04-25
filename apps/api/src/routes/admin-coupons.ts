/**
 * AAT-V3PORT: admin coupon CRUD routes — gated SUPER_ADMIN / ORG_ADMIN.
 *
 *   GET    /api/v1/admin/coupons                                    — list (filter + paginate)
 *   GET    /api/v1/admin/coupons/:id                                — single read
 *   POST   /api/v1/admin/coupons                                    — create
 *   PATCH  /api/v1/admin/coupons/:id                                — partial update
 *   POST   /api/v1/admin/coupons/:id/deactivate                     — soft delete
 *   GET    /api/v1/admin/coupons/:id/redemptions                    — paginated redemptions
 *   POST   /api/v1/admin/coupons/:id/redemptions/:redemptionId/mark-converted
 *
 * Auth: requireAuth + requireRole('SUPER_ADMIN', 'ORG_ADMIN'). Cross-org
 * by design — the coupon table is platform-scoped, not tenant-scoped (a
 * coupon grants trial access to *new* signups, who don't yet have an
 * org). ORG_ADMIN access is included so chapter administrators can
 * manage their own codes; if/when we add per-coupon ownership we'll
 * tighten this with a row-level filter.
 *
 * Audit: every write goes through services/audit-log.service.recordAudit
 * with action `coupon.<verb>` and resource `SignupCoupon` so the operator
 * audit trail is complete. The audit call swallows DB errors internally
 * so a failed audit insert never aborts the business operation.
 */

import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as couponService from '../services/coupon.service.js';
import { recordAudit } from '../services/audit-log.service.js';

export const adminCouponsRouter: IRouter = Router();

adminCouponsRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ORG_ADMIN'));

// ─── Schemas ───────────────────────────────────────────────────────────

const trialTierSchema = z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']);

const createSchema = z.object({
  couponCode: z
    .string()
    .trim()
    .min(3)
    .max(64)
    // Common HEF-style codes are alphanumeric + dashes; reject whitespace
    // and other delimiters so we don't end up with codes that vary only by
    // collation.
    .regex(/^[A-Za-z0-9_-]+$/, 'Coupon code may only contain letters, numbers, _ and -'),
  chapterName: z.string().trim().min(1).max(255),
  organizationName: z.string().trim().min(1).max(255),
  trialDurationDays: z.number().int().min(1).max(365),
  trialTier: trialTierSchema.default('STARTER'),
  maxRedemptions: z.number().int().min(1).optional().nullable(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateSchema = z.object({
  chapterName: z.string().trim().min(1).max(255).optional(),
  organizationName: z.string().trim().min(1).max(255).optional(),
  trialDurationDays: z.number().int().min(1).max(365).optional(),
  trialTier: trialTierSchema.optional(),
  maxRedemptions: z.number().int().min(1).nullable().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const markConvertedSchema = z.object({
  plan: z.string().trim().min(1).max(64),
});

const listQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  search: z.string().trim().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const redemptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Routes ────────────────────────────────────────────────────────────

adminCouponsRouter.get('/', async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query);
    const result = await couponService.listCoupons({
      isActive: q.isActive,
      search: q.search,
      page: q.page,
      pageSize: q.pageSize,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

adminCouponsRouter.get('/:id', async (req, res, next) => {
  try {
    const row = await couponService.getCouponById(req.params.id as string);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

adminCouponsRouter.post('/', async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body ?? {});
    const row = await couponService.createCoupon({
      couponCode: body.couponCode,
      chapterName: body.chapterName,
      organizationName: body.organizationName,
      trialDurationDays: body.trialDurationDays,
      trialTier: body.trialTier,
      maxRedemptions: body.maxRedemptions ?? null,
      validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      isActive: body.isActive,
      metadata: body.metadata,
      createdBy: req.user?.sub,
    });

    await recordAudit({
      userId: req.user?.sub ?? null,
      action: 'coupon.create',
      resource: 'SignupCoupon',
      resourceId: row.id,
      newValue: { couponCode: row.couponCode, trialTier: row.trialTier },
      ipAddress: req.ip,
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

adminCouponsRouter.patch('/:id', async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body ?? {});
    const id = req.params.id as string;
    const row = await couponService.updateCoupon(id, {
      chapterName: body.chapterName,
      organizationName: body.organizationName,
      trialDurationDays: body.trialDurationDays,
      trialTier: body.trialTier,
      maxRedemptions: body.maxRedemptions,
      validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
      validUntil:
        body.validUntil === null
          ? null
          : body.validUntil
            ? new Date(body.validUntil)
            : undefined,
      isActive: body.isActive,
      metadata: body.metadata,
    });

    await recordAudit({
      userId: req.user?.sub ?? null,
      action: 'coupon.update',
      resource: 'SignupCoupon',
      resourceId: id,
      newValue: body,
      ipAddress: req.ip,
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

adminCouponsRouter.post('/:id/deactivate', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const row = await couponService.deactivateCoupon(id);
    await recordAudit({
      userId: req.user?.sub ?? null,
      action: 'coupon.deactivate',
      resource: 'SignupCoupon',
      resourceId: id,
      ipAddress: req.ip,
    });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

adminCouponsRouter.get('/:id/redemptions', async (req, res, next) => {
  try {
    const q = redemptionsQuerySchema.parse(req.query);
    const result = await couponService.listRedemptions({
      couponId: req.params.id as string,
      page: q.page,
      pageSize: q.pageSize,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

adminCouponsRouter.post(
  '/:id/redemptions/:redemptionId/mark-converted',
  async (req, res, next) => {
    try {
      const body = markConvertedSchema.parse(req.body ?? {});
      const redemptionId = req.params.redemptionId as string;
      const row = await couponService.markConverted(redemptionId, body.plan);
      await recordAudit({
        userId: req.user?.sub ?? null,
        action: 'coupon.redemption.mark_converted',
        resource: 'CouponRedemption',
        resourceId: redemptionId,
        newValue: { plan: body.plan },
        ipAddress: req.ip,
      });
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);
