/**
 * AAT-V3PORT: coupon.service tests.
 *
 * Mocks @aurex/database with vi.hoisted so the service module sees the
 * fakes when it's imported. We mirror the prisma model surface used by
 * the service (signupCoupon, couponRedemption, $transaction).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    signupCoupon: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    couponRedemption: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  // Default $transaction passes a tx-like client wired to the same mocks.
  // Individual tests can override (e.g. to simulate a race where the cap
  // is reached between the read and the increment).
  mock.$transaction.mockImplementation(
    async (cb: (tx: typeof mock) => unknown) => cb(mock),
  );
  return { mockPrisma: mock };
});

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
  // The service casts metadata via Prisma.InputJsonValue — re-export an
  // empty namespace so the import resolves.
  Prisma: {},
}));

import {
  validateCoupon,
  redeemCoupon,
  listRedemptions,
  markConverted,
  _resetValidateBurstForTests,
} from './coupon.service.js';

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeCoupon(overrides: Record<string, unknown> = {}) {
  return {
    id: 'coupon-1',
    couponCode: 'HEF-PUNE-2026',
    chapterName: 'Pune Chapter',
    organizationName: 'Hydrogen Energy Foundation',
    trialDurationDays: 45,
    trialTier: 'PROFESSIONAL',
    maxRedemptions: 200,
    currentRedemptions: 0,
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validUntil: new Date('2027-12-31T00:00:00Z'),
    isActive: true,
    metadata: { discount_percentage: 25 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetValidateBurstForTests();
  mockPrisma.$transaction.mockImplementation(
    async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma),
  );
});

// ── validateCoupon ────────────────────────────────────────────────────────

describe('validateCoupon', () => {
  it('returns valid:true with the public coupon shape on a happy-path code', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(makeCoupon());

    const result = await validateCoupon({ code: 'HEF-PUNE-2026' });

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.coupon).toEqual({
      code: 'HEF-PUNE-2026',
      chapterName: 'Pune Chapter',
      organizationName: 'Hydrogen Energy Foundation',
      trialDurationDays: 45,
      trialTier: 'PROFESSIONAL',
      metadata: { discount_percentage: 25 },
    });
    // Ensure internal IDs are NOT leaked.
    expect((result.coupon as Record<string, unknown>).id).toBeUndefined();
  });

  it('returns COUPON_NOT_FOUND when no row matches the code', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(null);

    const result = await validateCoupon({ code: 'NOPE' });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('COUPON_NOT_FOUND');
  });

  it('returns COUPON_INACTIVE when isActive is false', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(makeCoupon({ isActive: false }));

    const result = await validateCoupon({ code: 'HEF-PUNE-2026' });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('COUPON_INACTIVE');
  });

  it('returns COUPON_EXPIRED when validUntil is in the past', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(
      makeCoupon({ validUntil: new Date('2020-01-01T00:00:00Z') }),
    );

    const result = await validateCoupon({ code: 'HEF-PUNE-2026' });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('COUPON_EXPIRED');
  });

  it('returns COUPON_NOT_YET_VALID when validFrom is in the future', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(
      makeCoupon({ validFrom: new Date('3000-01-01T00:00:00Z') }),
    );

    const result = await validateCoupon({ code: 'HEF-PUNE-2026' });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('COUPON_NOT_YET_VALID');
  });

  it('returns COUPON_MAX_REDEEMED when currentRedemptions >= maxRedemptions', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(
      makeCoupon({ maxRedemptions: 5, currentRedemptions: 5 }),
    );

    const result = await validateCoupon({ code: 'HEF-PUNE-2026' });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('COUPON_MAX_REDEEMED');
  });

  it('returns EMAIL_ALREADY_USED when the (couponId, email) pair already exists', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(makeCoupon());
    mockPrisma.couponRedemption.findUnique.mockResolvedValue({
      id: 'red-1',
      couponId: 'coupon-1',
      userEmail: 'user@example.com',
    });

    const result = await validateCoupon({ code: 'HEF-PUNE-2026', email: 'User@Example.com' });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('EMAIL_ALREADY_USED');
    // Email is normalised to lowercase before the lookup.
    expect(mockPrisma.couponRedemption.findUnique).toHaveBeenCalledWith({
      where: { couponId_userEmail: { couponId: 'coupon-1', userEmail: 'user@example.com' } },
    });
  });

  it('rate-limits the validate endpoint per IP after 10 attempts in 5 minutes', async () => {
    // The IP burst guard runs BEFORE the DB lookup, so we don't even need
    // to stub a coupon row — the 11th attempt should short-circuit with
    // IP_BURST_LIMIT.
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(null);

    // 10 attempts succeed (in the sense of "reach the DB"), the 11th is
    // rate-limited.
    for (let i = 0; i < 10; i++) {
      const r = await validateCoupon({ code: 'X', ipAddress: '203.0.113.1' });
      expect(r.reason).toBe('COUPON_NOT_FOUND');
    }

    const overBudget = await validateCoupon({ code: 'X', ipAddress: '203.0.113.1' });
    expect(overBudget.valid).toBe(false);
    expect(overBudget.reason).toBe('IP_BURST_LIMIT');
  });
});

// ── redeemCoupon ──────────────────────────────────────────────────────────

describe('redeemCoupon', () => {
  it('happy path: increments currentRedemptions and creates a redemption row', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(makeCoupon());
    mockPrisma.couponRedemption.findUnique.mockResolvedValue(null);
    mockPrisma.signupCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.couponRedemption.create.mockResolvedValue({ id: 'red-1' });

    const result = await redeemCoupon({
      code: 'HEF-PUNE-2026',
      email: 'New@User.com',
      ipAddress: '198.51.100.10',
      geoCountry: 'IN',
    });

    // Increment was guarded by `currentRedemptions < maxRedemptions`.
    expect(mockPrisma.signupCoupon.updateMany).toHaveBeenCalledWith({
      where: { id: 'coupon-1', currentRedemptions: { lt: 200 } },
      data: { currentRedemptions: { increment: 1 } },
    });
    // Redemption row was created with normalised email.
    expect(mockPrisma.couponRedemption.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        couponId: 'coupon-1',
        userEmail: 'new@user.com',
        userIpAddress: '198.51.100.10',
        userGeoCountry: 'IN',
      }),
    });
    expect(result.redemptionId).toBe('red-1');
    expect(result.trialTier).toBe('PROFESSIONAL');
    expect(result.trialDurationDays).toBe(45);
    // Trial window is exactly trialDurationDays apart.
    const windowMs = result.trialEnd.getTime() - result.trialStart.getTime();
    expect(windowMs).toBe(45 * 24 * 60 * 60 * 1000);
  });

  it('throws 409 when the coupon is at capacity (race: two redeems hit cap-1)', async () => {
    // Simulate the race: the read shows cap-1 / cap, but by the time the
    // increment runs, another transaction has filled the slot — updateMany
    // matches 0 rows, so we throw.
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(
      makeCoupon({ maxRedemptions: 1, currentRedemptions: 0 }),
    );
    mockPrisma.couponRedemption.findUnique.mockResolvedValue(null);
    mockPrisma.signupCoupon.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      redeemCoupon({ code: 'HEF-PUNE-2026', email: 'a@b.com' }),
    ).rejects.toMatchObject({ status: 409, title: 'Conflict' });

    // Critically, no redemption row was created when the cap raced shut.
    expect(mockPrisma.couponRedemption.create).not.toHaveBeenCalled();
  });

  it('only one of two concurrent redemptions wins when maxRedemptions=1', async () => {
    // This test exercises the contract end-to-end: under Promise.all, the
    // service must call updateMany twice but only the first updates a row;
    // the second sees count=0 and rolls back.
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(
      makeCoupon({ maxRedemptions: 1, currentRedemptions: 0 }),
    );
    mockPrisma.couponRedemption.findUnique.mockResolvedValue(null);

    let calls = 0;
    mockPrisma.signupCoupon.updateMany.mockImplementation(async () => {
      calls += 1;
      // First call wins (matches 1 row), second loses (cap is full).
      return { count: calls === 1 ? 1 : 0 };
    });
    mockPrisma.couponRedemption.create.mockResolvedValue({ id: 'red-winner' });

    const results = await Promise.allSettled([
      redeemCoupon({ code: 'HEF-PUNE-2026', email: 'a@b.com' }),
      redeemCoupon({ code: 'HEF-PUNE-2026', email: 'c@d.com' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
  });

  it('rejects 409 when (couponId, email) is already redeemed', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(makeCoupon());
    mockPrisma.couponRedemption.findUnique.mockResolvedValue({ id: 'red-existing' });

    await expect(
      redeemCoupon({ code: 'HEF-PUNE-2026', email: 'a@b.com' }),
    ).rejects.toMatchObject({ status: 409, title: 'Conflict' });

    // Increment + create should NOT have been called.
    expect(mockPrisma.signupCoupon.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.couponRedemption.create).not.toHaveBeenCalled();
  });

  it('rejects 404 when the code does not exist', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(null);

    await expect(
      redeemCoupon({ code: 'NOPE', email: 'a@b.com' }),
    ).rejects.toMatchObject({ status: 404, title: 'Not Found' });
  });

  it('skips the cap guard when maxRedemptions is null (unlimited)', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(
      makeCoupon({ maxRedemptions: null, currentRedemptions: 99999 }),
    );
    mockPrisma.couponRedemption.findUnique.mockResolvedValue(null);
    mockPrisma.signupCoupon.update.mockResolvedValue({});
    mockPrisma.couponRedemption.create.mockResolvedValue({ id: 'red-unlimited' });

    const result = await redeemCoupon({ code: 'HEF-PUNE-2026', email: 'a@b.com' });

    // updateMany (the guarded path) should NOT be used.
    expect(mockPrisma.signupCoupon.updateMany).not.toHaveBeenCalled();
    // Plain update is used instead.
    expect(mockPrisma.signupCoupon.update).toHaveBeenCalled();
    expect(result.redemptionId).toBe('red-unlimited');
  });
});

// ── listRedemptions ───────────────────────────────────────────────────────

describe('listRedemptions', () => {
  it('paginates correctly and returns the public row shape', async () => {
    mockPrisma.couponRedemption.findMany.mockResolvedValue([
      {
        id: 'red-1',
        couponId: 'coupon-1',
        userEmail: 'a@b.com',
        userIpAddress: '198.51.100.1',
        userGeoCountry: 'IN',
        trialStart: new Date('2026-01-01T00:00:00Z'),
        trialEnd: new Date('2026-02-15T00:00:00Z'),
        trialStatus: 'ACTIVE',
        converted: false,
        convertedPlan: null,
        convertedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    mockPrisma.couponRedemption.count.mockResolvedValue(35);

    const result = await listRedemptions({
      couponId: 'coupon-1',
      page: 2,
      pageSize: 10,
    });

    expect(mockPrisma.couponRedemption.findMany).toHaveBeenCalledWith({
      where: { couponId: 'coupon-1' },
      skip: 10,
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 10,
      total: 35,
      totalPages: 4,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.userEmail).toBe('a@b.com');
  });
});

// ── markConverted ─────────────────────────────────────────────────────────

describe('markConverted', () => {
  it('flips converted=true, sets convertedPlan + convertedAt + trialStatus=CONVERTED', async () => {
    mockPrisma.couponRedemption.findUnique.mockResolvedValue({
      id: 'red-1',
      converted: false,
    });
    mockPrisma.couponRedemption.update.mockResolvedValue({
      id: 'red-1',
      converted: true,
      convertedPlan: 'professional-monthly',
    });

    const result = await markConverted('red-1', 'professional-monthly');

    expect(mockPrisma.couponRedemption.update).toHaveBeenCalledWith({
      where: { id: 'red-1' },
      data: expect.objectContaining({
        converted: true,
        convertedPlan: 'professional-monthly',
        trialStatus: 'CONVERTED',
        convertedAt: expect.any(Date),
      }),
    });
    expect(result.converted).toBe(true);
  });

  it('refuses to re-convert an already-converted redemption (idempotency guard)', async () => {
    mockPrisma.couponRedemption.findUnique.mockResolvedValue({
      id: 'red-1',
      converted: true,
    });

    await expect(markConverted('red-1', 'enterprise')).rejects.toMatchObject({
      status: 409,
      title: 'Conflict',
    });
    expect(mockPrisma.couponRedemption.update).not.toHaveBeenCalled();
  });

  it('throws 404 when redemption does not exist', async () => {
    mockPrisma.couponRedemption.findUnique.mockResolvedValue(null);

    await expect(markConverted('missing', 'starter')).rejects.toMatchObject({
      status: 404,
    });
  });
});
