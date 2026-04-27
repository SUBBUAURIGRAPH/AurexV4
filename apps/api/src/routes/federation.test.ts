/**
 * AAT-367 / AV4-367 — route tests for the federation router.
 *
 * Mocks @aurex/database (federation key + call log + Awd2Handoff) and
 * exercises POST /federation/awd2/handback through Express. Unlike the
 * legacy awd2-handoff.test.ts which uses the AWD2_HANDOFF_PUBLIC_KEY
 * env, this path resolves the verifying key through the
 * `federationKey` table.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import express from 'express';
import type { Request, Response } from 'express';

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    federationKey: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    federationCallLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    awd2Handoff: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

// Bypass requireAuth/requireRole so the admin-only endpoints can be
// driven by tests without minting a real user JWT. We do, however, want
// to assert that the auth middleware is wired — we test the 401 path
// by leaving the user undefined and the real middleware running on a
// secondary app instance.
vi.mock('../middleware/auth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../middleware/auth.js')>();
  return {
    ...actual,
  };
});

// ── Fixtures ──────────────────────────────────────────────────────────────

const awd2Keypair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const AWD2_KEY_ID = 'awd2-prod-2026-04';

function awd2KeyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'aaaaaaaa-1111-4222-8333-444444444444',
    keyId: AWD2_KEY_ID,
    publicKeyPem: awd2Keypair.publicKey,
    isActive: true,
    partner: 'AWD2',
    ...overrides,
  };
}

function signFromAwd2(): string {
  return jwt.sign(
    { iss: 'awd2', aud: 'aurex' },
    awd2Keypair.privateKey,
    { algorithm: 'RS256', expiresIn: '5m', keyid: AWD2_KEY_ID },
  );
}

// ── SUT ──────────────────────────────────────────────────────────────────

import { federationRouter } from './federation.js';
import { errorHandler } from '../middleware/error-handler.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/federation', federationRouter);
  app.use(errorHandler);
  return app;
}

async function call(
  method: 'POST' | 'GET',
  path: string,
  body: unknown,
  bearer: string | null,
): Promise<{ status: number; body: unknown }> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    const req = {
      method,
      url: path,
      originalUrl: path,
      headers,
      body,
      query: {},
    } as unknown as Request;
    let status = 200;
    let payload: unknown;
    const res = {
      status(code: number) {
        status = code;
        return this as Response;
      },
      json(data: unknown) {
        payload = data;
        resolve({ status, body: payload });
        return this as Response;
      },
      setHeader: () => res,
      getHeader: () => undefined,
    } as unknown as Response;
    try {
       
      (app as any).handle(req, res, (err: unknown) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(mockPrisma).forEach((modelMocks) => {
    Object.values(modelMocks).forEach((m) => {
      (m as unknown as { mockReset: () => void }).mockReset();
    });
  });
  mockPrisma.federationCallLog.create.mockResolvedValue({ id: 'log-1' });
  mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
});

afterEach(() => {
  delete process.env.AUREX_FEDERATION_PRIVATE_KEY_PEM;
});

// ── /awd2/handback ────────────────────────────────────────────────────────

describe('POST /api/v1/federation/awd2/handback', () => {
  it('happy path: marks Awd2Handoff FAILED with reason cancelled-by-source', async () => {
    mockPrisma.federationKey.findUnique.mockResolvedValue(awd2KeyRow());
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue({
      id: 'handoff-1',
      status: 'IMPORTED',
      issuanceId: 'issuance-1',
    });
    mockPrisma.awd2Handoff.update.mockResolvedValue({
      id: 'handoff-1',
      status: 'FAILED',
      reason: 'cancelled-by-source: operator reverted',
      issuanceId: 'issuance-1',
    });

    const res = await call(
      'POST',
      '/api/v1/federation/awd2/handback',
      {
        awd2HandoffNonce: 'nonce-aaaa-bbbb-cccc',
        action: 'cancel',
        reason: 'operator reverted',
      },
      signFromAwd2(),
    );

    expect(res.status).toBe(200);
    const body = res.body as {
      data: { awd2HandoffId: string; status: string; reason: string; issuanceId: string };
    };
    expect(body.data.awd2HandoffId).toBe('handoff-1');
    expect(body.data.status).toBe('FAILED');
    expect(body.data.reason).toMatch(/^cancelled-by-source/);

    expect(mockPrisma.awd2Handoff.update).toHaveBeenCalledTimes(1);
    const updateArg = mockPrisma.awd2Handoff.update.mock.calls[0]![0]!;
    expect(updateArg.where.id).toBe('handoff-1');
    expect(updateArg.data.status).toBe('FAILED');
    expect(updateArg.data.reason).toMatch(/cancelled-by-source.*operator reverted/);
  });

  it('uses reissue-requested marker when action=reissue', async () => {
    mockPrisma.federationKey.findUnique.mockResolvedValue(awd2KeyRow());
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue({
      id: 'handoff-2',
      status: 'IMPORTED',
      issuanceId: 'issuance-2',
    });
    mockPrisma.awd2Handoff.update.mockResolvedValue({
      id: 'handoff-2',
      status: 'FAILED',
      reason: 'reissue-requested',
      issuanceId: 'issuance-2',
    });

    const res = await call(
      'POST',
      '/api/v1/federation/awd2/handback',
      { awd2HandoffNonce: 'nonce-reissue-001', action: 'reissue' },
      signFromAwd2(),
    );

    expect(res.status).toBe(200);
    const arg = mockPrisma.awd2Handoff.update.mock.calls[0]![0]!;
    expect(arg.data.reason).toBe('reissue-requested');
  });

  it('returns 404 RFC 7807 when the handoff nonce is unknown', async () => {
    mockPrisma.federationKey.findUnique.mockResolvedValue(awd2KeyRow());
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(null);

    const res = await call(
      'POST',
      '/api/v1/federation/awd2/handback',
      { awd2HandoffNonce: 'nonce-unknown-xyz', action: 'cancel' },
      signFromAwd2(),
    );

    expect(res.status).toBe(404);
    const body = res.body as { status: number; title: string; detail: string };
    expect(body.status).toBe(404);
    expect(body.title).toBe('Not Found');
    expect(body.detail).toMatch(/nonce-unknown-xyz/);
    expect(mockPrisma.awd2Handoff.update).not.toHaveBeenCalled();
  });

  it('returns 401 when no federation auth is supplied', async () => {
    const res = await call(
      'POST',
      '/api/v1/federation/awd2/handback',
      { awd2HandoffNonce: 'nonce-aaaa-bbbb-cccc', action: 'cancel' },
      null,
    );
    expect(res.status).toBe(401);
    const body = res.body as { type: string; title: string; status: number };
    expect(body.title).toBe('Unauthorized');
    expect(body.type).toBe('https://aurex.in/errors/federation-unauthorized');
    expect(mockPrisma.awd2Handoff.findUnique).not.toHaveBeenCalled();
  });

  it('rejects malformed handoffNonce body with 400', async () => {
    mockPrisma.federationKey.findUnique.mockResolvedValue(awd2KeyRow());

    const res = await call(
      'POST',
      '/api/v1/federation/awd2/handback',
      { awd2HandoffNonce: '!!bad!!', action: 'cancel' },
      signFromAwd2(),
    );
    expect(res.status).toBe(400);
  });
});

// ── /peer-pings — admin gate ──────────────────────────────────────────────

describe('GET /api/v1/federation/peer-pings', () => {
  it('returns 401 without an admin auth bearer', async () => {
    const res = await call('GET', '/api/v1/federation/peer-pings', null, null);
    // requireAuth in middleware/auth.ts always returns 401 on missing
    // bearer, before requireRole runs.
    expect(res.status).toBe(401);
  });
});
