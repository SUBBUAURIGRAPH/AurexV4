/**
 * AAT-ξ / AV4-361 — route-level tests for POST /api/v1/awd2/handoff.
 *
 * These tests exercise the route handler directly through a mocked Express
 * request/response pair. We mock @aurex/database so no real DB is touched,
 * and we mock the import service so the route's responsibilities (JWT
 * verify, body parse, dedup-on-nonce, persist Awd2Handoff row) are
 * isolated from the import-service behaviour (which is covered separately
 * in awd2-import.service.test.ts).
 */

import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockPrisma, mockImportAwd2Handoff } = vi.hoisted(() => ({
  mockPrisma: {
    awd2Handoff: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  mockImportAwd2Handoff: vi.fn(),
}));

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
  Prisma: { JsonNull: 'JSON_NULL_SENTINEL' },
}));

vi.mock('../services/awd2-import.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/awd2-import.service.js')>();
  return {
    ...actual,
    importAwd2Handoff: mockImportAwd2Handoff,
  };
});

import { awd2HandoffRouter } from './awd2-handoff.js';
import { errorHandler } from '../middleware/error-handler.js';
import express from 'express';
import type { Request, Response } from 'express';

// ── Test keypair ──────────────────────────────────────────────────────────
//
// Generate a fresh RS256 keypair for each test run. The public key is
// installed into AWD2_HANDOFF_PUBLIC_KEY; tests sign their JWTs with the
// private key. This proves the route really verifies signatures (a wrong
// key produces a 401, not a happy-path import).

const { publicKey: AWD2_PUBLIC_KEY, privateKey: AWD2_PRIVATE_KEY } =
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

const { publicKey: STRANGER_PUBLIC_KEY, privateKey: STRANGER_PRIVATE_KEY } =
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
// Silence unused-binding lint — STRANGER_PUBLIC_KEY isn't installed; the
// stranger private key is used to forge a JWT signed by a key the route
// does not trust.
void STRANGER_PUBLIC_KEY;

// ── Body fixture ──────────────────────────────────────────────────────────

function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    awd2ContractAddress: '0xabcdef0123456789abcdef0123456789abcdef01',
    awd2TokenId: '12345',
    bcrSerialId: 'BCR-IND-2024-AR-VM0042-V1-0001',
    vintage: 2024,
    methodologyCode: 'VM0042',
    projectId: 'AWD2-PROJ-7891',
    projectTitle: 'Imported Reforestation Project',
    tonnes: 500,
    currentHolderOrgId: '00000000-0000-4000-8000-000000000202',
    provenanceHash:
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    handoffNonce: 'nonce-aaaa-bbbb-cccc',
    handoffEmittedAt: '2026-04-01T00:00:00+00:00',
    ...overrides,
  };
}

function signWith(privateKey: string, claims: Record<string, unknown> = {}) {
  return jwt.sign({ iss: 'awd2', ...claims }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '5m',
  });
}

// ── Test app helper ───────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/awd2', awd2HandoffRouter);
  app.use(errorHandler);
  return app;
}

/**
 * Drive the route through Express directly using a synthetic req/res. This
 * avoids needing supertest as a dependency.
 */
async function postHandoff(
  body: unknown,
  bearer: string | null,
): Promise<{ status: number; body: unknown }> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    const req: Partial<Request> = {
      method: 'POST',
      url: '/api/v1/awd2/handoff',
      originalUrl: '/api/v1/awd2/handoff',
      headers: bearer
        ? { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' }
        : { 'content-type': 'application/json' },
      body,
    };
    let status = 200;
    let payload: unknown;
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
      setHeader: () => res as Response,
      getHeader: () => undefined,
    };
    try {
      // Express routers are middleware functions; cast to invoke directly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (app as any).handle(req as Request, res as Response, (err: unknown) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.awd2Handoff.findUnique.mockReset();
  mockPrisma.awd2Handoff.create.mockReset();
  mockPrisma.awd2Handoff.update.mockReset();
  mockImportAwd2Handoff.mockReset();
  process.env.AWD2_HANDOFF_PUBLIC_KEY = AWD2_PUBLIC_KEY;
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('POST /api/v1/awd2/handoff — happy path', () => {
  it('verifies the AWD2 JWT, persists Awd2Handoff (RECEIVED) and imports', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(null);
    mockPrisma.awd2Handoff.create.mockResolvedValue({
      id: 'handoff-1',
      handoffNonce: 'nonce-aaaa-bbbb-cccc',
      status: 'RECEIVED',
    });
    mockImportAwd2Handoff.mockResolvedValue({
      issuanceId: 'issuance-1',
      awd2HandoffId: 'handoff-1',
      status: 'imported',
    });

    const token = signWith(AWD2_PRIVATE_KEY);
    const res = await postHandoff(makeBody(), token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        status: 'imported',
        awd2HandoffId: 'handoff-1',
        issuanceId: 'issuance-1',
      },
    });

    // Awd2Handoff row was persisted at status=RECEIVED before import.
    expect(mockPrisma.awd2Handoff.create).toHaveBeenCalledTimes(1);
    const createArg = mockPrisma.awd2Handoff.create.mock.calls[0]![0]!;
    expect(createArg.data.handoffNonce).toBe('nonce-aaaa-bbbb-cccc');
    expect(createArg.data.status).toBe('RECEIVED');
    expect(createArg.data.tonnes).toBe(500);
    expect(createArg.data.bcrSerialId).toBe('BCR-IND-2024-AR-VM0042-V1-0001');

    // Import service was called with the row id.
    expect(mockImportAwd2Handoff).toHaveBeenCalledTimes(1);
    const importArg = mockImportAwd2Handoff.mock.calls[0]![0];
    expect(importArg.awd2HandoffId).toBe('handoff-1');
    expect(importArg.tonnes).toBe(500);
  });
});

describe('POST /api/v1/awd2/handoff — federation gate', () => {
  it('returns 503 when AWD2_HANDOFF_PUBLIC_KEY is unset', async () => {
    delete process.env.AWD2_HANDOFF_PUBLIC_KEY;

    const token = signWith(AWD2_PRIVATE_KEY);
    const res = await postHandoff(makeBody(), token);

    expect(res.status).toBe(503);
    const body = res.body as { type: string; title: string; status: number; detail: string };
    expect(body.status).toBe(503);
    expect(body.title).toBe('Service Unavailable');
    expect(body.detail).toMatch(/AWD2_HANDOFF_PUBLIC_KEY unset/);

    // No DB writes attempted.
    expect(mockPrisma.awd2Handoff.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.awd2Handoff.create).not.toHaveBeenCalled();
    expect(mockImportAwd2Handoff).not.toHaveBeenCalled();
  });

  it('returns 503 when AWD2_HANDOFF_PUBLIC_KEY is empty / whitespace', async () => {
    process.env.AWD2_HANDOFF_PUBLIC_KEY = '   ';
    const token = signWith(AWD2_PRIVATE_KEY);
    const res = await postHandoff(makeBody(), token);
    expect(res.status).toBe(503);
  });
});

describe('POST /api/v1/awd2/handoff — JWT signature verification', () => {
  it('returns 401 RFC 7807 when the JWT is signed by an untrusted key', async () => {
    const forgedToken = signWith(STRANGER_PRIVATE_KEY);
    const res = await postHandoff(makeBody(), forgedToken);

    expect(res.status).toBe(401);
    const body = res.body as { status: number; title: string; detail: string };
    expect(body.status).toBe(401);
    expect(body.title).toBe('Unauthorized');
    expect(body.detail).toMatch(/Invalid AWD2 handoff JWT/);

    expect(mockPrisma.awd2Handoff.create).not.toHaveBeenCalled();
    expect(mockImportAwd2Handoff).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await postHandoff(makeBody(), null);
    expect(res.status).toBe(401);
    const body = res.body as { detail: string };
    expect(body.detail).toMatch(/Missing or malformed Authorization header/);
  });

  it('returns 401 when JWT is malformed garbage', async () => {
    const res = await postHandoff(makeBody(), 'not.a.real.jwt.at.all');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/awd2/handoff — duplicate nonce', () => {
  it('returns 200 with status=duplicate and no double-import', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue({
      id: 'handoff-existing',
      handoffNonce: 'nonce-aaaa-bbbb-cccc',
      status: 'IMPORTED',
      issuanceId: 'issuance-existing',
    });

    const token = signWith(AWD2_PRIVATE_KEY);
    const res = await postHandoff(makeBody(), token);

    expect(res.status).toBe(200);
    const body = res.body as { data: { status: string; awd2HandoffId: string; issuanceId: string | null } };
    expect(body.data.status).toBe('duplicate');
    expect(body.data.awd2HandoffId).toBe('handoff-existing');
    expect(body.data.issuanceId).toBe('issuance-existing');

    // Critically: no new row created, no import called.
    expect(mockPrisma.awd2Handoff.create).not.toHaveBeenCalled();
    expect(mockImportAwd2Handoff).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/awd2/handoff — body validation', () => {
  it('rejects sub-ton (fractional) tonnes with 400 from zod', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(null);
    const token = signWith(AWD2_PRIVATE_KEY);
    const res = await postHandoff(makeBody({ tonnes: 12.5 }), token);

    expect(res.status).toBe(400);
    expect(mockPrisma.awd2Handoff.create).not.toHaveBeenCalled();
  });

  it('rejects malformed contract address with 400', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(null);
    const token = signWith(AWD2_PRIVATE_KEY);
    const res = await postHandoff(
      makeBody({ awd2ContractAddress: 'not-an-address' }),
      token,
    );

    expect(res.status).toBe(400);
  });

  it('rejects malformed handoffEmittedAt with 400', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(null);
    const token = signWith(AWD2_PRIVATE_KEY);
    const res = await postHandoff(
      makeBody({ handoffEmittedAt: '2026-04-01' }), // missing time + offset
      token,
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/awd2/handoff — import failure surface', () => {
  it('translates a service AppError into RFC 7807 with the typed status', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(null);
    mockPrisma.awd2Handoff.create.mockResolvedValue({
      id: 'handoff-fail',
      handoffNonce: 'nonce-aaaa-bbbb-cccc',
      status: 'RECEIVED',
    });

    // Use a uniqueId so the import path is fully exercised.
    const handoffNonce = `nonce-${randomUUID()}`;
    const { MethodologyNotEligibleError } = await import(
      '../services/awd2-import.service.js'
    );
    mockImportAwd2Handoff.mockRejectedValue(
      new MethodologyNotEligibleError('UNKNOWN_METHOD'),
    );

    const token = signWith(AWD2_PRIVATE_KEY);
    const res = await postHandoff(makeBody({ handoffNonce }), token);

    expect(res.status).toBe(422);
    const body = res.body as { status: number; title: string; detail: string };
    expect(body.status).toBe(422);
    expect(body.title).toBe('Unprocessable Entity');
    expect(body.detail).toMatch(/not BCR-eligible/);
  });
});
