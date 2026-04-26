/**
 * AAT-367 / AV4-367 — tests for `requireFederation` middleware.
 *
 * Drives the middleware through synthetic Express req/res pairs so we
 * can assert: (a) success populates req.federation + calls next(); (b)
 * every reject path returns a 401 RFC 7807 response and writes a
 * FederationCallLog row with status=REJECTED.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    federationKey: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    federationCallLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
}));

import { requireFederation } from './require-federation.js';

const awd2Keypair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const AWD2_KEY_ID = 'awd2-prod-2026-04';

function awd2KeyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    keyId: AWD2_KEY_ID,
    publicKeyPem: awd2Keypair.publicKey,
    isActive: true,
    partner: 'AWD2',
    ...overrides,
  };
}

function makeReq(authHeader?: string): Request {
  return {
    method: 'POST',
    headers: authHeader ? { authorization: authHeader } : {},
    originalUrl: '/api/v1/federation/awd2/handback',
  } as unknown as Request;
}

function makeRes(): { res: Response; calls: { status?: number; body?: unknown } } {
  const calls: { status?: number; body?: unknown } = {};
  const res = {
    status: vi.fn(function (this: Response, code: number) {
      calls.status = code;
      return this;
    }),
    json: vi.fn(function (this: Response, body: unknown) {
      calls.body = body;
      return this;
    }),
  } as unknown as Response;
  return { res, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.federationKey.findUnique.mockReset();
  mockPrisma.federationKey.findMany.mockReset();
  mockPrisma.federationCallLog.create.mockReset();
  mockPrisma.federationCallLog.create.mockResolvedValue({ id: 'log-1' });
});

afterEach(() => {
  delete process.env.AUREX_FEDERATION_PRIVATE_KEY_PEM;
});

describe('requireFederation', () => {
  it('accepts a valid JWT with active key and populates req.federation', async () => {
    mockPrisma.federationKey.findUnique.mockResolvedValue(awd2KeyRow());

    const token = jwt.sign(
      { iss: 'awd2', aud: 'aurex' },
      awd2Keypair.privateKey,
      { algorithm: 'RS256', expiresIn: '5m', keyid: AWD2_KEY_ID },
    );
    const req = makeReq(`Bearer ${token}`);
    const { res, calls } = makeRes();
    const next = vi.fn() as NextFunction;

    await requireFederation('AWD2')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(calls.status).toBeUndefined();
    expect(req.federation).toBeDefined();
    expect(req.federation?.partner).toBe('AWD2');
    expect(req.federation?.keyId).toBe(AWD2_KEY_ID);
    expect(req.federation?.claims.iss).toBe('awd2');
  });

  it('returns 401 RFC 7807 when the bearer is missing', async () => {
    const req = makeReq();
    const { res, calls } = makeRes();
    const next = vi.fn() as NextFunction;

    await requireFederation('AWD2')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(calls.status).toBe(401);
    const body = calls.body as {
      type: string;
      title: string;
      status: number;
      detail: string;
      instance: string;
    };
    expect(body.title).toBe('Unauthorized');
    expect(body.status).toBe(401);
    expect(body.type).toBe('https://aurex.in/errors/federation-unauthorized');
    expect(body.detail).not.toMatch(/private key/i);
  });

  it('returns 401 and writes a REJECTED FederationCallLog row when the JWT is invalid', async () => {
    // kid lookup succeeds but token is forged by a stranger.
    mockPrisma.federationKey.findUnique.mockResolvedValue(awd2KeyRow());
    const stranger = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const forged = jwt.sign(
      { iss: 'awd2', aud: 'aurex' },
      stranger.privateKey,
      { algorithm: 'RS256', expiresIn: '5m', keyid: AWD2_KEY_ID },
    );

    const req = makeReq(`Bearer ${forged}`);
    const { res, calls } = makeRes();
    const next = vi.fn() as NextFunction;

    await requireFederation('AWD2')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(calls.status).toBe(401);

    // FederationCallLog row written with REJECTED status.
    expect(mockPrisma.federationCallLog.create).toHaveBeenCalled();
    const allCalls = mockPrisma.federationCallLog.create.mock.calls.map((c) => c[0]);
    const rejected = allCalls.find(
      (c) => (c as { data: { status: string } }).data.status === 'REJECTED',
    );
    expect(rejected).toBeDefined();
    const data = (rejected as { data: { direction: string; partner: string; endpoint: string; errorMessage: string } }).data;
    expect(data.direction).toBe('INBOUND');
    expect(data.partner).toBe('AWD2');
    expect(data.endpoint).toMatch(/handback/);
    expect(typeof data.errorMessage).toBe('string');
  });

  it('returns 401 when the auth header is malformed (no Bearer prefix)', async () => {
    const req = makeReq('Basic abcdef');
    const { res, calls } = makeRes();
    const next = vi.fn() as NextFunction;

    await requireFederation('AWD2')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(calls.status).toBe(401);
  });
});
