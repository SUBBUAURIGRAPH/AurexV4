/**
 * AAT-ONBOARD: tests for the coupon-aware register flow + the
 * email-verification scaffold.
 *
 * Same hoist-the-prisma-mock pattern as coupon.service.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    signupCoupon: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    couponRedemption: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    emailVerification: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    authEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  // Default $transaction:
  // - When called with a callback (interactive txn), pass `mock` as tx.
  // - When called with an array of operations, just resolve them — the
  //   service uses both forms (coupon redeem = callback, email verify =
  //   array of two updates).
  mock.$transaction.mockImplementation(
    async (arg: unknown): Promise<unknown> => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof mock) => Promise<unknown>)(mock);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return undefined;
    },
  );
  return { mockPrisma: mock };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(async (pw: string) => `hash::${pw}`),
    compare: vi.fn(async () => true),
  },
}));

vi.mock('../lib/jwt.js', () => ({
  signAccessToken: vi.fn(() => 'access.jwt'),
  signRefreshToken: vi.fn(() => 'refresh.jwt'),
  verifyRefreshToken: vi.fn(() => ({ sub: 'u1', email: 'a@b.com', role: 'VIEWER' })),
}));

import { register, getCurrentUser } from './auth.service.js';
import { _resetValidateBurstForTests } from './coupon.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  _resetValidateBurstForTests();
  mockPrisma.$transaction.mockImplementation(
    async (arg: unknown): Promise<unknown> => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return undefined;
    },
  );
});

afterEach(() => {
  delete process.env.NODE_ENV;
});

function makeCoupon(overrides: Record<string, unknown> = {}) {
  return {
    id: 'coupon-1',
    couponCode: 'HEF-PUNE-2026',
    chapterName: 'Pune Chapter',
    organizationName: 'Hydrogen Energy Foundation',
    trialDurationDays: 365,
    trialTier: 'PROFESSIONAL',
    maxRedemptions: 200,
    currentRedemptions: 0,
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validUntil: new Date('2027-12-31T00:00:00Z'),
    isActive: true,
    metadata: { feature_list: ['scope1', 'scope2'] },
    ...overrides,
  };
}

// ── register: plain (no coupon) ───────────────────────────────────────────

describe('register (no coupon)', () => {
  it('creates a user and issues a verification token; trial absent', async () => {
    process.env.NODE_ENV = 'test';
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Alice' });
    mockPrisma.emailVerification.create.mockResolvedValue({ id: 'ev1' });

    const result = await register('a@b.com', 'Sup3rPass!', 'Alice');

    expect(result.id).toBe('u1');
    expect(result.email).toBe('a@b.com');
    expect(result.name).toBe('Alice');
    expect(result.trial).toBeUndefined();
    expect(result.couponWarning).toBeUndefined();
    // Dev-mode plaintext token surfaced when NODE_ENV !== 'production'.
    expect(typeof result._devVerificationToken).toBe('string');
    expect(result._devVerificationToken!.length).toBeGreaterThan(32);

    // Audit row tagged couponApplied:false.
    expect(mockPrisma.authEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'REGISTER',
          metadata: { couponApplied: false, couponWarning: null },
        }),
      }),
    );
  });

  it('omits the plaintext verification token in production', async () => {
    process.env.NODE_ENV = 'production';
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Alice' });
    mockPrisma.emailVerification.create.mockResolvedValue({ id: 'ev1' });

    const result = await register('a@b.com', 'Sup3rPass!', 'Alice');

    expect(result._devVerificationToken).toBeUndefined();
  });

  it('throws 409 when the email already exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(register('a@b.com', 'pw', 'A')).rejects.toMatchObject({ status: 409 });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});

// ── register: with coupon ─────────────────────────────────────────────────

describe('register (with coupon)', () => {
  it('redeems the voucher and returns the trial window on the response', async () => {
    process.env.NODE_ENV = 'test';
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Alice' });
    mockPrisma.emailVerification.create.mockResolvedValue({ id: 'ev1' });
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(makeCoupon());
    mockPrisma.couponRedemption.findUnique.mockResolvedValue(null);
    mockPrisma.signupCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.couponRedemption.create.mockResolvedValue({ id: 'red-1' });

    const result = await register('a@b.com', 'Sup3rPass!', 'Alice', {
      couponCode: 'HEF-PUNE-2026',
      ipAddress: '198.51.100.10',
    });

    expect(result.couponWarning).toBeUndefined();
    expect(result.trial).toBeDefined();
    expect(result.trial!.appliedCouponCode).toBe('HEF-PUNE-2026');
    expect(result.trial!.trialTier).toBe('PROFESSIONAL');
    expect(result.trial!.trialDurationDays).toBe(365);

    // Audit row records couponApplied:true (without leaking the code).
    expect(mockPrisma.authEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'REGISTER',
          metadata: expect.objectContaining({ couponApplied: true }),
        }),
      }),
    );
    const callArg = mockPrisma.authEvent.create.mock.calls[0]![0];
    const meta = (callArg.data as { metadata: Record<string, unknown> }).metadata;
    expect(JSON.stringify(meta)).not.toContain('HEF-PUNE-2026');
  });

  it('still creates the user and surfaces couponWarning when redemption fails', async () => {
    process.env.NODE_ENV = 'test';
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u2', email: 'b@b.com', name: 'Bob' });
    mockPrisma.emailVerification.create.mockResolvedValue({ id: 'ev2' });
    // Coupon doesn't exist → redeem throws inside the txn.
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(null);

    const result = await register('b@b.com', 'Sup3rPass!', 'Bob', {
      couponCode: 'NONEXISTENT-2026',
    });

    expect(result.id).toBe('u2');
    expect(result.trial).toBeUndefined();
    expect(typeof result.couponWarning).toBe('string');
    expect(result.couponWarning).toMatch(/not found/i);

    // Audit row records the warning.
    expect(mockPrisma.authEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'REGISTER',
          metadata: expect.objectContaining({
            couponApplied: false,
            couponWarning: expect.any(String),
          }),
        }),
      }),
    );
  });

  it('user-creation failure does NOT consume a coupon slot', async () => {
    // Critical: the user.create runs BEFORE the coupon redemption, so a
    // create failure bails out before any voucher is touched.
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockRejectedValue(new Error('DB down'));

    await expect(
      register('c@b.com', 'Sup3rPass!', 'Carol', { couponCode: 'HEF-PUNE-2026' }),
    ).rejects.toThrow();

    expect(mockPrisma.signupCoupon.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.couponRedemption.create).not.toHaveBeenCalled();
  });

  it('returns ALREADY_REDEEMED warning when re-using a voucher with the same email', async () => {
    process.env.NODE_ENV = 'test';
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u3', email: 'd@b.com', name: 'Dave' });
    mockPrisma.emailVerification.create.mockResolvedValue({ id: 'ev3' });
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(makeCoupon());
    // Existing redemption row triggers the dedup branch in redeemCoupon.
    mockPrisma.couponRedemption.findUnique.mockResolvedValue({
      id: 'red-old',
      couponId: 'coupon-1',
      userEmail: 'd@b.com',
    });

    const result = await register('d@b.com', 'Sup3rPass!', 'Dave', {
      couponCode: 'HEF-PUNE-2026',
    });

    expect(result.id).toBe('u3');
    expect(result.trial).toBeUndefined();
    expect(result.couponWarning).toMatch(/already redeemed/i);
  });
});

// ── getCurrentUser ────────────────────────────────────────────────────────

describe('getCurrentUser', () => {
  it('exposes emailVerifiedAt as ISO when set, null when not', async () => {
    const now = new Date('2026-04-25T10:00:00Z');
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      role: 'VIEWER',
      emailVerifiedAt: now,
      orgMembers: [],
    });

    const verified = await getCurrentUser('u1');
    expect(verified.emailVerifiedAt).toBe(now.toISOString());

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      role: 'VIEWER',
      emailVerifiedAt: null,
      orgMembers: [],
    });
    const unverified = await getCurrentUser('u1');
    expect(unverified.emailVerifiedAt).toBeNull();
  });
});
