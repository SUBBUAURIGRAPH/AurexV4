/**
 * AAT-ONBOARD: tests for the email-verification service.
 *
 * Drives the prisma mock the same way as auth.service.test.ts. The
 * service hashes the plaintext token before storing it; tests construct
 * the expected hash via the same algorithm so they can probe the
 * verifyToken happy/expired/idempotent paths without leaking the secret
 * representation.
 */

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    emailVerification: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    couponRedemption: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    // AAT-EMAIL: emailService.sendEmail writes audit rows on every send.
    outboundEmail: {
      create: vi.fn().mockResolvedValue({ id: 'oe-1' }),
      update: vi.fn().mockResolvedValue({ id: 'oe-1' }),
    },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation(async (arg: unknown): Promise<unknown> => {
    if (Array.isArray(arg)) return Promise.all(arg);
    if (typeof arg === 'function') {
      return (arg as (tx: typeof mock) => Promise<unknown>)(mock);
    }
    return undefined;
  });
  return { mockPrisma: mock };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import {
  issueToken,
  verifyToken,
  resendForUser,
} from './email-verification.service.js';
import { _testEmailQueue, _resetTestEmailQueue } from './email/email.service.js';

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetTestEmailQueue();
  mockPrisma.outboundEmail.create.mockResolvedValue({ id: 'oe-1' });
  mockPrisma.outboundEmail.update.mockResolvedValue({ id: 'oe-1' });
  mockPrisma.couponRedemption.findFirst.mockResolvedValue(null);
  mockPrisma.$transaction.mockImplementation(async (arg: unknown): Promise<unknown> => {
    if (Array.isArray(arg)) return Promise.all(arg);
    if (typeof arg === 'function') {
      return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return undefined;
  });
});

// ── issueToken ────────────────────────────────────────────────────────────

describe('issueToken', () => {
  it('persists the sha256 hash, never the plaintext, and expires in 24h', async () => {
    mockPrisma.emailVerification.create.mockResolvedValue({ id: 'ev1' });

    const before = Date.now();
    const result = await issueToken('u1', 'a@b.com');
    const after = Date.now();

    // Plaintext is 32 bytes hex = 64 chars; the stored token is the
    // sha256 hex (also 64 chars but a different value).
    expect(result.plaintextToken.length).toBe(64);
    expect(result.token).toBe(sha256(result.plaintextToken));
    expect(result.token).not.toBe(result.plaintextToken);

    // 24h ± epsilon.
    const ttlMs = result.expiresAt.getTime() - before;
    expect(ttlMs).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 50);
    expect(result.expiresAt.getTime() - after).toBeLessThanOrEqual(24 * 60 * 60 * 1000);

    // Critically — the create call carries the HASH, not the plaintext.
    const createArg = mockPrisma.emailVerification.create.mock.calls[0]![0];
    expect((createArg.data as Record<string, unknown>).token).toBe(result.token);
    expect(JSON.stringify(createArg.data)).not.toContain(result.plaintextToken);
  });
});

// ── verifyToken ───────────────────────────────────────────────────────────

describe('verifyToken', () => {
  it('happy path: flips verifiedAt on both EmailVerification and User', async () => {
    const plaintext = 'a'.repeat(64);
    mockPrisma.emailVerification.findUnique.mockResolvedValue({
      id: 'ev1',
      userId: 'u1',
      email: 'a@b.com',
      token: sha256(plaintext),
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await verifyToken(plaintext);

    expect(result.alreadyVerified).toBe(false);
    expect(result.userId).toBe('u1');
    expect(result.email).toBe('a@b.com');

    // Both updates ran inside the transaction.
    expect(mockPrisma.emailVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ev1' },
        data: expect.objectContaining({ verifiedAt: expect.any(Date) }),
      }),
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          emailVerifiedAt: expect.any(Date),
          isVerified: true,
        }),
      }),
    );
  });

  it('returns 410 Gone when the token has expired', async () => {
    const plaintext = 'b'.repeat(64);
    mockPrisma.emailVerification.findUnique.mockResolvedValue({
      id: 'ev1',
      userId: 'u1',
      email: 'a@b.com',
      token: sha256(plaintext),
      verifiedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(verifyToken(plaintext)).rejects.toMatchObject({
      status: 410,
      title: 'Gone',
    });

    // No DB writes when the token is dead.
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.emailVerification.update).not.toHaveBeenCalled();
  });

  it('idempotent: already-verified rows return 200 without re-flipping', async () => {
    const plaintext = 'c'.repeat(64);
    const verifiedAt = new Date('2026-04-01T00:00:00Z');
    mockPrisma.emailVerification.findUnique.mockResolvedValue({
      id: 'ev1',
      userId: 'u1',
      email: 'a@b.com',
      token: sha256(plaintext),
      verifiedAt,
      expiresAt: new Date('2027-01-01T00:00:00Z'),
    });

    const result = await verifyToken(plaintext);
    expect(result.alreadyVerified).toBe(true);
    expect(result.verifiedAt).toEqual(verifiedAt);
    // Re-flipping would be wrong: the txn writes must not run.
    expect(mockPrisma.emailVerification.update).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the token does not match any row', async () => {
    mockPrisma.emailVerification.findUnique.mockResolvedValue(null);
    await expect(verifyToken('d'.repeat(64))).rejects.toMatchObject({ status: 404 });
  });
});

// ── resendForUser ─────────────────────────────────────────────────────────

describe('resendForUser', () => {
  it('invalidates prior tokens before issuing a fresh one', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      emailVerifiedAt: null,
    });
    mockPrisma.emailVerification.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.emailVerification.create.mockResolvedValue({ id: 'ev2' });

    const issued = await resendForUser('u1');

    // updateMany was called BEFORE create — that's the invalidation step.
    const updateOrder = mockPrisma.emailVerification.updateMany.mock
      .invocationCallOrder[0];
    const createOrder = mockPrisma.emailVerification.create.mock
      .invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(createOrder!);

    expect(typeof issued.plaintextToken).toBe('string');
    expect(issued.token.length).toBe(64);
  });

  it('throws 409 when the user is already verified', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      emailVerifiedAt: new Date(),
    });
    await expect(resendForUser('u1')).rejects.toMatchObject({ status: 409 });
    expect(mockPrisma.emailVerification.create).not.toHaveBeenCalled();
  });
});

// ── AAT-EMAIL integration: issueToken + verifyToken email side-effects ────

describe('issueToken — AAT-EMAIL integration', () => {
  it('enqueues a verification email in test mode (NODE_ENV=test)', async () => {
    process.env.NODE_ENV = 'test';
    mockPrisma.emailVerification.create.mockResolvedValue({ id: 'ev1' });
    mockPrisma.user.findUnique.mockResolvedValue({ name: 'Alice' });

    await issueToken('u1', 'alice@example.com');

    expect(_testEmailQueue).toHaveLength(1);
    const queued = _testEmailQueue[0]!;
    expect(queued.to).toBe('alice@example.com');
    expect(queued.templateKey).toBe('verification');
    expect(queued.subject).toMatch(/verify/i);
    // The email body must contain a verification URL whose token is the
    // plaintext (NOT the stored hash).
    expect(queued.html).toMatch(/verify-email\?token=/);
  });

  it('does NOT throw when the email service errors (best-effort)', async () => {
    process.env.NODE_ENV = 'test';
    mockPrisma.emailVerification.create.mockResolvedValue({ id: 'ev1' });
    // Make the audit row fail. emailService catches this.
    mockPrisma.outboundEmail.create.mockRejectedValueOnce(new Error('db down'));

    // Must not throw — registration depends on this.
    const result = await issueToken('u1', 'safe@example.com');
    expect(result.plaintextToken).toBeTruthy();
  });
});

describe('verifyToken — AAT-EMAIL welcome email', () => {
  it('enqueues a welcome email after a successful first-time verify', async () => {
    process.env.NODE_ENV = 'test';
    const plaintext = 'e'.repeat(64);
    mockPrisma.emailVerification.findUnique.mockResolvedValue({
      id: 'ev1',
      userId: 'u1',
      email: 'welcome@example.com',
      token: sha256(plaintext),
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      name: 'Eve',
      email: 'welcome@example.com',
      orgMembers: [{ org: { name: 'Eve LLC' } }],
    });

    await verifyToken(plaintext);

    expect(_testEmailQueue).toHaveLength(1);
    const queued = _testEmailQueue[0]!;
    expect(queued.to).toBe('welcome@example.com');
    expect(queued.templateKey).toBe('welcome');
    expect(queued.html).toContain('Eve LLC');
  });

  it('renders the trial card when the user has an active CouponRedemption', async () => {
    process.env.NODE_ENV = 'test';
    const plaintext = 'f'.repeat(64);
    mockPrisma.emailVerification.findUnique.mockResolvedValue({
      id: 'ev1',
      userId: 'u1',
      email: 'trial@example.com',
      token: sha256(plaintext),
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      name: 'Trial User',
      email: 'trial@example.com',
      orgMembers: [],
    });
    mockPrisma.couponRedemption.findFirst.mockResolvedValue({
      coupon: { couponCode: 'HEF-PUNE-2026', trialTier: 'PROFESSIONAL' },
      trialEnd: new Date('2027-04-25T00:00:00Z'),
    });

    await verifyToken(plaintext);

    expect(_testEmailQueue).toHaveLength(1);
    const welcome = _testEmailQueue[0]!;
    expect(welcome.html).toContain('Trial active');
    expect(welcome.html).toContain('HEF-PUNE-2026');
    expect(welcome.html).toContain('PROFESSIONAL');
  });

  it('does NOT enqueue a welcome email on idempotent re-verify', async () => {
    process.env.NODE_ENV = 'test';
    const plaintext = 'g'.repeat(64);
    mockPrisma.emailVerification.findUnique.mockResolvedValue({
      id: 'ev1',
      userId: 'u1',
      email: 'idempotent@example.com',
      token: sha256(plaintext),
      verifiedAt: new Date('2026-04-01T00:00:00Z'),
      expiresAt: new Date('2027-01-01T00:00:00Z'),
    });

    await verifyToken(plaintext);
    expect(_testEmailQueue).toHaveLength(0);
  });
});
