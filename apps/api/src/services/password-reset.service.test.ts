/**
 * password-reset.service tests — drives the prisma mock the same way as
 * email-verification.service.test.ts. Token plaintext goes through the
 * same sha256 path used by the service, so we can probe consumeToken
 * without leaking the secret representation.
 */

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordReset: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    authEvent: {
      create: vi.fn().mockResolvedValue({ id: 'ae-1' }),
    },
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

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(async (pw: string) => `hash::${pw}`),
    compare: vi.fn(async () => true),
  },
}));

import { requestReset, consumeToken } from './password-reset.service.js';
import { _testEmailQueue, _resetTestEmailQueue } from './email/email.service.js';

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetTestEmailQueue();
  mockPrisma.outboundEmail.create.mockResolvedValue({ id: 'oe-1' });
  mockPrisma.outboundEmail.update.mockResolvedValue({ id: 'oe-1' });
  mockPrisma.passwordReset.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.session.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.$transaction.mockImplementation(async (arg: unknown): Promise<unknown> => {
    if (Array.isArray(arg)) return Promise.all(arg);
    if (typeof arg === 'function') {
      return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return undefined;
  });
});

// ── requestReset ───────────────────────────────────────────────────────────

describe('requestReset', () => {
  it('issues a token, stores its sha256 hash, and emails the plaintext URL', async () => {
    process.env.NODE_ENV = 'test';
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      isActive: true,
    });
    mockPrisma.passwordReset.create.mockResolvedValue({ id: 'pr1' });

    const result = await requestReset('a@b.com', '127.0.0.1', 'jest-ua');

    expect(result.emailQueued).toBe(true);
    expect(result._devResetUrl).toMatch(/\/reset-password\?token=[a-f0-9]{64}$/);

    // Stored token must be the sha256 of the plaintext from the URL.
    expect(mockPrisma.passwordReset.create).toHaveBeenCalledTimes(1);
    const args = mockPrisma.passwordReset.create.mock.calls[0]![0] as {
      data: { userId: string; token: string; expiresAt: Date };
    };
    expect(args.data.userId).toBe('u1');
    expect(args.data.token).toMatch(/^[a-f0-9]{64}$/);

    // Plaintext from the dev URL hashes to the stored token.
    const plaintext = result._devResetUrl!.split('token=')[1]!;
    expect(sha256(plaintext)).toBe(args.data.token);

    // 1h TTL within ±2s.
    const ttlMs = args.data.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(60 * 60 * 1000 - 2000);
    expect(ttlMs).toBeLessThan(60 * 60 * 1000 + 2000);

    // Email queued via the in-process test transport.
    expect(_testEmailQueue.length).toBe(1);
    expect(_testEmailQueue[0]!.subject).toBe('Reset your Aurex password');
    expect(_testEmailQueue[0]!.text).toContain(plaintext);

    // Auth event logged with PASSWORD_RESET_REQUEST + emailQueued metadata.
    expect(mockPrisma.authEvent.create).toHaveBeenCalledTimes(1);
    const evt = mockPrisma.authEvent.create.mock.calls[0]![0] as {
      data: { userId: string; eventType: string; metadata?: { emailQueued?: boolean } };
    };
    expect(evt.data.userId).toBe('u1');
    expect(evt.data.eventType).toBe('PASSWORD_RESET_REQUEST');
  });

  it('invalidates prior unused tokens before issuing a new one', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.com', name: 'Alice', isActive: true,
    });
    mockPrisma.passwordReset.create.mockResolvedValue({ id: 'pr2' });

    await requestReset('a@b.com');

    expect(mockPrisma.passwordReset.updateMany).toHaveBeenCalledTimes(1);
    const args = mockPrisma.passwordReset.updateMany.mock.calls[0]![0] as {
      where: { userId: string; usedAt: null };
      data: { expiresAt: Date };
    };
    expect(args.where.userId).toBe('u1');
    expect(args.where.usedAt).toBeNull();
    expect(args.data.expiresAt.getTime()).toBe(0);
  });

  it('does NOT enumerate non-existent emails (returns success, never throws)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await requestReset('nobody@example.com');

    expect(result.emailQueued).toBe(false);
    expect(mockPrisma.passwordReset.create).not.toHaveBeenCalled();
    expect(_testEmailQueue.length).toBe(0);

    // Audit row still written (with reason=unknown_email) so ops can spot abuse.
    expect(mockPrisma.authEvent.create).toHaveBeenCalledTimes(1);
    const evt = mockPrisma.authEvent.create.mock.calls[0]![0] as {
      data: { userId: string | null; eventType: string; metadata?: { reason?: string } };
    };
    expect(evt.data.userId).toBeNull();
    expect(evt.data.eventType).toBe('PASSWORD_RESET_REQUEST');
    expect(evt.data.metadata?.reason).toBe('unknown_email');
  });

  it('rejects inactive accounts the same as unknown emails (no enumeration)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.com', name: 'Alice', isActive: false,
    });

    const result = await requestReset('a@b.com');

    expect(result.emailQueued).toBe(false);
    expect(mockPrisma.passwordReset.create).not.toHaveBeenCalled();
    expect(_testEmailQueue.length).toBe(0);
  });
});

// ── consumeToken ───────────────────────────────────────────────────────────

describe('consumeToken', () => {
  it('hashes the new password, marks token used, and deletes every session', async () => {
    const plaintext = 'a'.repeat(64);
    const tokenHash = sha256(plaintext);
    mockPrisma.passwordReset.findUnique.mockResolvedValue({
      id: 'pr1',
      userId: 'u1',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    mockPrisma.user.update.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    mockPrisma.passwordReset.update.mockResolvedValue({ id: 'pr1' });

    const result = await consumeToken(plaintext, 'NewStr0ng!Pass', '127.0.0.1', 'jest-ua');

    expect(result).toEqual({ userId: 'u1', email: 'a@b.com' });

    // Looked up by the sha256 hash, never the plaintext.
    expect(mockPrisma.passwordReset.findUnique).toHaveBeenCalledWith({
      where: { token: tokenHash },
      select: expect.any(Object),
    });

    // user.update sets bcrypt hash + clears lockout.
    const userUpd = mockPrisma.user.update.mock.calls[0]![0] as {
      where: { id: string };
      data: { passwordHash: string; failedAttempts: number; lockedUntil: null };
    };
    expect(userUpd.where.id).toBe('u1');
    expect(userUpd.data.passwordHash).toBe('hash::NewStr0ng!Pass');
    expect(userUpd.data.failedAttempts).toBe(0);
    expect(userUpd.data.lockedUntil).toBeNull();

    // Token row stamped used.
    const tokUpd = mockPrisma.passwordReset.update.mock.calls[0]![0] as {
      where: { id: string };
      data: { usedAt: Date };
    };
    expect(tokUpd.where.id).toBe('pr1');
    expect(tokUpd.data.usedAt).toBeInstanceOf(Date);

    // Sessions wiped.
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });

    // Auth event PASSWORD_RESET_COMPLETE.
    expect(mockPrisma.authEvent.create).toHaveBeenCalledTimes(1);
    const evt = mockPrisma.authEvent.create.mock.calls[0]![0] as {
      data: { eventType: string };
    };
    expect(evt.data.eventType).toBe('PASSWORD_RESET_COMPLETE');
  });

  it('rejects unknown tokens with 404', async () => {
    mockPrisma.passwordReset.findUnique.mockResolvedValue(null);
    await expect(consumeToken('unknown'.repeat(10), 'NewStr0ng!Pass')).rejects.toThrow(
      /Reset token not recognised/i,
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects expired tokens with 410', async () => {
    mockPrisma.passwordReset.findUnique.mockResolvedValue({
      id: 'pr1',
      userId: 'u1',
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });
    await expect(consumeToken('a'.repeat(64), 'NewStr0ng!Pass')).rejects.toThrow(
      /expired/i,
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects already-used tokens with 410 (replay defense)', async () => {
    mockPrisma.passwordReset.findUnique.mockResolvedValue({
      id: 'pr1',
      userId: 'u1',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(Date.now() - 5000),
    });
    await expect(consumeToken('a'.repeat(64), 'NewStr0ng!Pass')).rejects.toThrow(
      /already been used/i,
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects weak passwords (<8 chars) with 400', async () => {
    await expect(consumeToken('a'.repeat(64), 'short')).rejects.toThrow(
      /at least 8 characters/i,
    );
    expect(mockPrisma.passwordReset.findUnique).not.toHaveBeenCalled();
  });

  it('rejects empty token with 400', async () => {
    await expect(consumeToken('', 'NewStr0ng!Pass')).rejects.toThrow(
      /token is required/i,
    );
    expect(mockPrisma.passwordReset.findUnique).not.toHaveBeenCalled();
  });
});
