/**
 * AAT-ONBOARD: route tests for the auth endpoints we touched —
 * /verify-email and /resend-verification. Uses the same router-driving
 * pattern as coupons.test.ts to avoid pulling in supertest.
 */

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';

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
    authEvent: {
      create: vi.fn(),
    },
    couponRedemption: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    // AAT-EMAIL: emailService.sendEmail (test mode) writes a PENDING
    // row, then patches it to SENT.
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

import { authRouter } from './auth.js';
import { errorHandler } from '../middleware/error-handler.js';
import { signAccessToken } from '../lib/jwt.js';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
  app.use(errorHandler);
  return app;
}

interface FakeResponse {
  status: number;
  body: unknown;
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<FakeResponse> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    let status = 200;
    let payload: unknown = undefined;
    const req: Partial<Request> = {
      method: 'POST',
      url,
      originalUrl: url,
      path: url,
      headers: { 'content-type': 'application/json', ...headers },
      body,
      ip: '198.51.100.99',
       
      socket: { remoteAddress: '198.51.100.99' } as any,
    };
    const res: Partial<Response> = {
      status(code: number) {
        status = code;
        return this as Response;
      },
      json(data: unknown) {
        payload = data;
        resolve({ status, body: payload });
        return this as Response;
      },
      end(data?: unknown) {
        if (payload === undefined && data !== undefined) payload = data;
        resolve({ status, body: payload });
        return this as Response;
      },
      setHeader: () => res as Response,
      getHeader: () => undefined,
    };
    try {
       
      (app as any).handle(req as Request, res as Response, (err: unknown) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (arg: unknown): Promise<unknown> => {
    if (Array.isArray(arg)) return Promise.all(arg);
    if (typeof arg === 'function') {
      return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return undefined;
  });
});

// ── /verify-email ─────────────────────────────────────────────────────────

describe('POST /api/v1/auth/verify-email', () => {
  it('returns 200 and flips the verification on a fresh token', async () => {
    const plaintext = 'a'.repeat(64);
    mockPrisma.emailVerification.findUnique.mockResolvedValue({
      id: 'ev1',
      userId: 'u1',
      email: 'me@aurex.in',
      token: sha256(plaintext),
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await postJson('/api/v1/auth/verify-email', { token: plaintext });

    expect(res.status).toBe(200);
    const body = res.body as { data: Record<string, unknown> };
    expect(body.data.alreadyVerified).toBe(false);
    expect(typeof body.data.verifiedAt).toBe('string');
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });

  it('returns 410 Gone for an expired token', async () => {
    const plaintext = 'b'.repeat(64);
    mockPrisma.emailVerification.findUnique.mockResolvedValue({
      id: 'ev1',
      userId: 'u1',
      email: 'me@aurex.in',
      token: sha256(plaintext),
      verifiedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const res = await postJson('/api/v1/auth/verify-email', { token: plaintext });

    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({ status: 410, title: 'Gone' });
  });

  it('returns 200 idempotently when the token was already verified', async () => {
    const plaintext = 'c'.repeat(64);
    const verifiedAt = new Date('2026-04-01T00:00:00Z');
    mockPrisma.emailVerification.findUnique.mockResolvedValue({
      id: 'ev1',
      userId: 'u1',
      email: 'me@aurex.in',
      token: sha256(plaintext),
      verifiedAt,
      expiresAt: new Date('2027-01-01T00:00:00Z'),
    });

    const res = await postJson('/api/v1/auth/verify-email', { token: plaintext });

    expect(res.status).toBe(200);
    const body = res.body as { data: Record<string, unknown> };
    expect(body.data.alreadyVerified).toBe(true);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('returns 400 when the body is malformed', async () => {
    const res = await postJson('/api/v1/auth/verify-email', { wrong: 'x' });
    expect(res.status).toBe(400);
  });
});

// ── /resend-verification ─────────────────────────────────────────────────

describe('POST /api/v1/auth/resend-verification', () => {
  function authHeader(): Record<string, string> {
    const token = signAccessToken({
      sub: '00000000-0000-0000-0000-000000000001',
      email: 'me@aurex.in',
       
      role: 'VIEWER' as any,
    });
    return { authorization: `Bearer ${token}` };
  }

  it('issues a fresh token and invalidates prior ones', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'me@aurex.in',
      emailVerifiedAt: null,
    });
    mockPrisma.emailVerification.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.emailVerification.create.mockResolvedValue({ id: 'ev2' });

    const res = await postJson('/api/v1/auth/resend-verification', {}, authHeader());

    expect(res.status).toBe(200);
    // updateMany (invalidate) ran before create (issue).
    const updateOrder = mockPrisma.emailVerification.updateMany.mock
      .invocationCallOrder[0];
    const createOrder = mockPrisma.emailVerification.create.mock
      .invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(createOrder!);
  });

  it('returns 401 without a JWT', async () => {
    const res = await postJson('/api/v1/auth/resend-verification', {});
    expect(res.status).toBe(401);
  });

  it('returns 409 when the user is already verified', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'me@aurex.in',
      emailVerifiedAt: new Date(),
    });
    const res = await postJson('/api/v1/auth/resend-verification', {}, authHeader());
    expect(res.status).toBe(409);
  });
});
