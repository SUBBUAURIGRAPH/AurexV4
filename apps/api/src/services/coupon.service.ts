/**
 * AAT-V3PORT: HEF voucher / SignupCoupon service.
 *
 * Ported from AurexV3 (`.internal/archive/node-api-backup-20260420/api/src/
 * routes/coupon.routes.ts` + `routes/admin/coupon.routes.ts`). Backend MVP
 * only — no User row creation, no email verification, no Razorpay. The
 * routes return the trial window so the frontend can decide what to do
 * with it.
 *
 * Design notes:
 *   - validateCoupon is read-only. Used by the public /validate endpoint
 *     before the user even submits signup data.
 *   - redeemCoupon is atomic: a Prisma `$transaction` runs an
 *     `updateMany` with `WHERE currentRedemptions < maxRedemptions` so the
 *     database enforces the cap. If the update affects 0 rows, the txn
 *     rolls back (we throw) — preventing double-spend at maxRedemptions-1
 *     when two requests race.
 *   - Per-IP burst guard for /validate is implemented in this module via
 *     a small in-memory counter (10 attempts / 5 minutes). The global
 *     rate-limiter (100/60s on /api/v1/*) still applies as the outer
 *     bound; this is the inner per-route bucket.
 *
 * Skipped (intentional, follow-ups):
 *   - V3 disposable-email-domain blacklist (TODO: port if/when needed)
 *   - PendingSignup + email verification flow (V3 had it; AurexV4 signup
 *     handles user creation separately)
 *   - Razorpay / billing conversion (out of scope)
 */

import { prisma, Prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';

// ─── Types ─────────────────────────────────────────────────────────────

export type TrialTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type TrialStatus = 'ACTIVE' | 'EXPIRED' | 'CONVERTED' | 'CANCELLED';

export interface PublicCoupon {
  code: string;
  chapterName: string;
  organizationName: string;
  trialDurationDays: number;
  trialTier: TrialTier;
  metadata: Record<string, unknown>;
}

export type ValidateReason =
  | 'COUPON_NOT_FOUND'
  | 'COUPON_INACTIVE'
  | 'COUPON_EXPIRED'
  | 'COUPON_NOT_YET_VALID'
  | 'COUPON_MAX_REDEEMED'
  | 'EMAIL_ALREADY_USED'
  | 'IP_BURST_LIMIT';

export interface ValidateResult {
  valid: boolean;
  reason?: ValidateReason;
  message?: string;
  coupon?: PublicCoupon;
}

export interface ValidateInput {
  code: string;
  email?: string;
  ipAddress?: string;
}

export interface RedeemInput {
  code: string;
  email: string;
  ipAddress?: string;
  geoCountry?: string;
  userId?: string;
}

export interface RedeemResult {
  redemptionId: string;
  couponId: string;
  couponCode: string;
  trialStart: Date;
  trialEnd: Date;
  trialTier: TrialTier;
  trialDurationDays: number;
}

// ─── Per-IP burst guard for /validate ──────────────────────────────────
// 10 attempts / 5 minutes per IP. In-memory only — fine for a single API
// node; if we ever go multi-node behind a load balancer we should swap
// this for a shared store (Redis) keyed the same way.

const VALIDATE_BURST_WINDOW_MS = 5 * 60_000;
const VALIDATE_BURST_LIMIT = 10;

interface BurstEntry {
  count: number;
  resetAt: number;
}

const burstStore = new Map<string, BurstEntry>();

/**
 * Increments the per-IP counter and returns true if the IP is over-budget.
 * Exported for tests and so the public route handler can consume the
 * decision without re-implementing the bookkeeping.
 */
export function recordValidateAttempt(ipAddress: string): boolean {
  const now = Date.now();
  const entry = burstStore.get(ipAddress);
  if (!entry || entry.resetAt < now) {
    burstStore.set(ipAddress, { count: 1, resetAt: now + VALIDATE_BURST_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > VALIDATE_BURST_LIMIT;
}

/** Test-only: clear the burst-store between cases. */
export function _resetValidateBurstForTests(): void {
  burstStore.clear();
}

// ─── Helpers ───────────────────────────────────────────────────────────

function normaliseCode(code: string): string {
  return code.trim();
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicCoupon(row: {
  couponCode: string;
  chapterName: string;
  organizationName: string;
  trialDurationDays: number;
  trialTier: string;
  metadata: Prisma.JsonValue;
}): PublicCoupon {
  return {
    code: row.couponCode,
    chapterName: row.chapterName,
    organizationName: row.organizationName,
    trialDurationDays: row.trialDurationDays,
    trialTier: row.trialTier as TrialTier,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

// ─── validateCoupon ────────────────────────────────────────────────────

/**
 * Read-only validation. Returns `{ valid: true, coupon }` on success or
 * `{ valid: false, reason, message }` on any failure. Does NOT throw on
 * normal validation failures — these are part of the public contract.
 *
 * Throws AppError(503) only if the database layer is unreachable.
 */
export async function validateCoupon(input: ValidateInput): Promise<ValidateResult> {
  const code = normaliseCode(input.code);

  // Per-IP burst guard. Note: this counts every validate ATTEMPT regardless
  // of the result — preventing brute-force enumeration of valid codes.
  if (input.ipAddress) {
    const overBudget = recordValidateAttempt(input.ipAddress);
    if (overBudget) {
      return {
        valid: false,
        reason: 'IP_BURST_LIMIT',
        message: 'Too many validation attempts from this IP. Try again in a few minutes.',
      };
    }
  }

  const coupon = await prisma.signupCoupon.findFirst({
    where: { couponCode: { equals: code, mode: 'insensitive' } },
  });

  if (!coupon) {
    return { valid: false, reason: 'COUPON_NOT_FOUND', message: 'Coupon code not found' };
  }

  if (!coupon.isActive) {
    return {
      valid: false,
      reason: 'COUPON_INACTIVE',
      message: 'This coupon is no longer active',
    };
  }

  const now = new Date();
  if (coupon.validUntil && coupon.validUntil < now) {
    return {
      valid: false,
      reason: 'COUPON_EXPIRED',
      message: `Coupon expired on ${coupon.validUntil.toISOString().slice(0, 10)}`,
    };
  }
  if (coupon.validFrom > now) {
    return {
      valid: false,
      reason: 'COUPON_NOT_YET_VALID',
      message: `Coupon becomes valid on ${coupon.validFrom.toISOString().slice(0, 10)}`,
    };
  }

  if (coupon.maxRedemptions !== null && coupon.currentRedemptions >= coupon.maxRedemptions) {
    return {
      valid: false,
      reason: 'COUPON_MAX_REDEEMED',
      message: 'This coupon has reached its maximum number of redemptions',
    };
  }

  if (input.email) {
    const email = normaliseEmail(input.email);
    const existing = await prisma.couponRedemption.findUnique({
      where: { couponId_userEmail: { couponId: coupon.id, userEmail: email } },
    });
    if (existing) {
      return {
        valid: false,
        reason: 'EMAIL_ALREADY_USED',
        message: 'This email has already redeemed this coupon',
      };
    }
  }

  return { valid: true, coupon: toPublicCoupon(coupon) };
}

// ─── redeemCoupon ──────────────────────────────────────────────────────

/**
 * Atomic redemption. Re-validates the coupon, increments
 * `currentRedemptions` under a `WHERE currentRedemptions < maxRedemptions`
 * guard (so the DB enforces the cap), and creates a CouponRedemption row.
 *
 * Errors:
 *   - 404 COUPON_NOT_FOUND
 *   - 409 COUPON_INACTIVE / COUPON_EXPIRED / COUPON_NOT_YET_VALID /
 *         COUPON_MAX_REDEEMED / EMAIL_ALREADY_USED
 *
 * Race-safety: two concurrent redeems against `maxRedemptions=1` will
 * both reach the increment step. Postgres serialises `UPDATE ... WHERE
 * currentRedemptions < maxRedemptions` so only one update affects a row;
 * the other returns count=0 and we throw — that transaction rolls back
 * before any CouponRedemption row is written.
 */
export async function redeemCoupon(input: RedeemInput): Promise<RedeemResult> {
  const code = normaliseCode(input.code);
  const email = normaliseEmail(input.email);

  return prisma.$transaction(async (tx) => {
    // 1. Locate the coupon (case-insensitive) and re-validate inside the txn.
    const coupon = await tx.signupCoupon.findFirst({
      where: { couponCode: { equals: code, mode: 'insensitive' } },
    });
    if (!coupon) {
      throw new AppError(404, 'Not Found', 'Coupon code not found');
    }
    if (!coupon.isActive) {
      throw new AppError(409, 'Conflict', 'This coupon is no longer active');
    }
    const now = new Date();
    if (coupon.validUntil && coupon.validUntil < now) {
      throw new AppError(409, 'Conflict', 'Coupon has expired');
    }
    if (coupon.validFrom > now) {
      throw new AppError(409, 'Conflict', 'Coupon is not yet valid');
    }

    // 2. Dedup on (couponId, userEmail). A duplicate also surfaces from
    //    the unique constraint on the create() below, but checking first
    //    lets us return a clean 409 (vs. a P2002 surfacing as 500).
    const existing = await tx.couponRedemption.findUnique({
      where: { couponId_userEmail: { couponId: coupon.id, userEmail: email } },
    });
    if (existing) {
      throw new AppError(409, 'Conflict', 'This email has already redeemed this coupon');
    }

    // 3. Atomic increment guarded by the cap. If maxRedemptions is NULL
    //    (unlimited), skip the guard.
    if (coupon.maxRedemptions !== null) {
      const incrementResult = await tx.signupCoupon.updateMany({
        where: {
          id: coupon.id,
          currentRedemptions: { lt: coupon.maxRedemptions },
        },
        data: { currentRedemptions: { increment: 1 } },
      });
      if (incrementResult.count === 0) {
        throw new AppError(
          409,
          'Conflict',
          'This coupon has reached its maximum number of redemptions',
        );
      }
    } else {
      await tx.signupCoupon.update({
        where: { id: coupon.id },
        data: { currentRedemptions: { increment: 1 } },
      });
    }

    // 4. Compute trial window + persist the redemption.
    const trialStart = new Date();
    const trialEnd = new Date(
      trialStart.getTime() + coupon.trialDurationDays * 24 * 60 * 60 * 1000,
    );

    const redemption = await tx.couponRedemption.create({
      data: {
        couponId: coupon.id,
        userEmail: email,
        userIpAddress: input.ipAddress ?? null,
        userGeoCountry: input.geoCountry ?? null,
        trialStart,
        trialEnd,
      },
    });

    logger.info(
      {
        couponCode: coupon.couponCode,
        couponId: coupon.id,
        redemptionId: redemption.id,
        userEmail: email,
      },
      'Coupon redeemed',
    );

    return {
      redemptionId: redemption.id,
      couponId: coupon.id,
      couponCode: coupon.couponCode,
      trialStart,
      trialEnd,
      trialTier: coupon.trialTier as TrialTier,
      trialDurationDays: coupon.trialDurationDays,
    };
  });
}

// ─── Admin CRUD helpers ────────────────────────────────────────────────

export interface ListCouponsParams {
  isActive?: boolean;
  search?: string;
  page: number;
  pageSize: number;
}

export interface CouponListRow {
  id: string;
  couponCode: string;
  chapterName: string;
  organizationName: string;
  trialDurationDays: number;
  trialTier: TrialTier;
  maxRedemptions: number | null;
  currentRedemptions: number;
  validFrom: Date;
  validUntil: Date | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  redemptionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedCoupons {
  data: CouponListRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function listCoupons(params: ListCouponsParams): Promise<PaginatedCoupons> {
  const where: Prisma.SignupCouponWhereInput = {};
  if (params.isActive !== undefined) where.isActive = params.isActive;
  if (params.search && params.search.trim().length > 0) {
    where.couponCode = { contains: params.search.trim(), mode: 'insensitive' };
  }

  const skip = (params.page - 1) * params.pageSize;
  const [rows, total] = await Promise.all([
    prisma.signupCoupon.findMany({
      where,
      skip,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    }),
    prisma.signupCoupon.count({ where }),
  ]);

  const data: CouponListRow[] = rows.map((r) => ({
    id: r.id,
    couponCode: r.couponCode,
    chapterName: r.chapterName,
    organizationName: r.organizationName,
    trialDurationDays: r.trialDurationDays,
    trialTier: r.trialTier as TrialTier,
    maxRedemptions: r.maxRedemptions,
    currentRedemptions: r.currentRedemptions,
    validFrom: r.validFrom,
    validUntil: r.validUntil,
    isActive: r.isActive,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    redemptionCount: r._count.redemptions,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return {
    data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    },
  };
}

export async function getCouponById(id: string): Promise<CouponListRow> {
  const row = await prisma.signupCoupon.findUnique({
    where: { id },
    include: { _count: { select: { redemptions: true } } },
  });
  if (!row) throw new AppError(404, 'Not Found', 'Coupon not found');
  return {
    id: row.id,
    couponCode: row.couponCode,
    chapterName: row.chapterName,
    organizationName: row.organizationName,
    trialDurationDays: row.trialDurationDays,
    trialTier: row.trialTier as TrialTier,
    maxRedemptions: row.maxRedemptions,
    currentRedemptions: row.currentRedemptions,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    isActive: row.isActive,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    redemptionCount: row._count.redemptions,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface CreateCouponInput {
  couponCode: string;
  chapterName: string;
  organizationName: string;
  trialDurationDays: number;
  trialTier: TrialTier;
  maxRedemptions?: number | null;
  validFrom?: Date;
  validUntil?: Date | null;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export async function createCoupon(input: CreateCouponInput) {
  const code = normaliseCode(input.couponCode);
  const existing = await prisma.signupCoupon.findUnique({ where: { couponCode: code } });
  if (existing) {
    throw new AppError(409, 'Conflict', 'A coupon with this code already exists');
  }

  return prisma.signupCoupon.create({
    data: {
      couponCode: code,
      chapterName: input.chapterName,
      organizationName: input.organizationName,
      trialDurationDays: input.trialDurationDays,
      trialTier: input.trialTier,
      maxRedemptions: input.maxRedemptions ?? null,
      validFrom: input.validFrom ?? new Date(),
      validUntil: input.validUntil ?? null,
      isActive: input.isActive ?? true,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      createdBy: input.createdBy ?? null,
    },
  });
}

export interface UpdateCouponInput {
  chapterName?: string;
  organizationName?: string;
  trialDurationDays?: number;
  trialTier?: TrialTier;
  maxRedemptions?: number | null;
  validFrom?: Date;
  validUntil?: Date | null;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export async function updateCoupon(id: string, input: UpdateCouponInput) {
  const existing = await prisma.signupCoupon.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Not Found', 'Coupon not found');

  const data: Prisma.SignupCouponUpdateInput = {};
  if (input.chapterName !== undefined) data.chapterName = input.chapterName;
  if (input.organizationName !== undefined) data.organizationName = input.organizationName;
  if (input.trialDurationDays !== undefined) data.trialDurationDays = input.trialDurationDays;
  if (input.trialTier !== undefined) data.trialTier = input.trialTier;
  if (input.maxRedemptions !== undefined) data.maxRedemptions = input.maxRedemptions;
  if (input.validFrom !== undefined) data.validFrom = input.validFrom;
  if (input.validUntil !== undefined) data.validUntil = input.validUntil;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.metadata !== undefined) {
    data.metadata = input.metadata as Prisma.InputJsonValue;
  }

  return prisma.signupCoupon.update({ where: { id }, data });
}

export async function deactivateCoupon(id: string) {
  const existing = await prisma.signupCoupon.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Not Found', 'Coupon not found');
  return prisma.signupCoupon.update({
    where: { id },
    data: { isActive: false },
  });
}

// ─── Redemption admin ──────────────────────────────────────────────────

export interface ListRedemptionsParams {
  couponId: string;
  page: number;
  pageSize: number;
}

export interface RedemptionRow {
  id: string;
  couponId: string;
  userEmail: string;
  userIpAddress: string | null;
  userGeoCountry: string | null;
  trialStart: Date;
  trialEnd: Date;
  trialStatus: TrialStatus;
  converted: boolean;
  convertedPlan: string | null;
  convertedAt: Date | null;
  createdAt: Date;
}

export async function listRedemptions(params: ListRedemptionsParams): Promise<{
  data: RedemptionRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const skip = (params.page - 1) * params.pageSize;
  const [rows, total] = await Promise.all([
    prisma.couponRedemption.findMany({
      where: { couponId: params.couponId },
      skip,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.couponRedemption.count({ where: { couponId: params.couponId } }),
  ]);

  const data: RedemptionRow[] = rows.map((r) => ({
    id: r.id,
    couponId: r.couponId,
    userEmail: r.userEmail,
    userIpAddress: r.userIpAddress,
    userGeoCountry: r.userGeoCountry,
    trialStart: r.trialStart,
    trialEnd: r.trialEnd,
    trialStatus: r.trialStatus as TrialStatus,
    converted: r.converted,
    convertedPlan: r.convertedPlan,
    convertedAt: r.convertedAt,
    createdAt: r.createdAt,
  }));

  return {
    data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    },
  };
}

export async function markConverted(redemptionId: string, plan: string) {
  const existing = await prisma.couponRedemption.findUnique({ where: { id: redemptionId } });
  if (!existing) throw new AppError(404, 'Not Found', 'Redemption not found');
  if (existing.converted) {
    throw new AppError(409, 'Conflict', 'Redemption already marked converted');
  }
  return prisma.couponRedemption.update({
    where: { id: redemptionId },
    data: {
      converted: true,
      convertedPlan: plan,
      convertedAt: new Date(),
      trialStatus: 'CONVERTED',
    },
  });
}
