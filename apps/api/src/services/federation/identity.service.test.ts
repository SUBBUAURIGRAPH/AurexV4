/**
 * AAT-367 / AV4-367 — unit tests for the federation identity service.
 *
 * Coverage focuses on the security-critical paths: outbound JWT signing
 * is verifiable by the matching public key, inbound verification rejects
 * every plausible tampering vector (unknown kid, expired token, audience
 * mismatch, key rotation, wrong issuer).
 *
 * Prisma is mocked — these are pure unit tests.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

// ── Hoisted Prisma mock ───────────────────────────────────────────────────

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

// ── SUT (after mocks) ─────────────────────────────────────────────────────

import {
  signOutboundJwt,
  verifyInboundJwt,
  callPartner,
  loadPrivateKey,
  FederationVerificationError,
  FederationConfigurationError,
  AUREX_ISSUER,
  DEFAULT_JWT_LIFETIME_SEC,
  _resetPrivateKeyCache,
} from './identity.service.js';

// ── Test fixtures ─────────────────────────────────────────────────────────

const aurexKeypair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const awd2Keypair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const strangerKeypair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const AWD2_KEY_ID = 'awd2-prod-2026-04';

function signFromAwd2(opts: {
  key?: string;
  iss?: string;
  aud?: string;
  expiresIn?: string | number;
  kid?: string | null; // null → omit kid entirely; undefined → default kid
  extra?: Record<string, unknown>;
} = {}): string {
  const privateKey = opts.key ?? awd2Keypair.privateKey;
  // jsonwebtoken's `keyid` option must be a string when present; the only
  // way to omit the kid header is to leave the option off entirely.
  const signOpts: jwt.SignOptions = {
    algorithm: 'RS256',
    expiresIn: opts.expiresIn ?? '5m',
  };
  if (opts.kid !== null) {
    signOpts.keyid = opts.kid ?? AWD2_KEY_ID;
  }
  return jwt.sign(
    {
      iss: opts.iss ?? 'awd2',
      aud: opts.aud ?? AUREX_ISSUER,
      ...(opts.extra ?? {}),
    },
    privateKey,
    signOpts,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.federationKey.findUnique.mockReset();
  mockPrisma.federationKey.findMany.mockReset();
  mockPrisma.federationCallLog.create.mockReset();
  mockPrisma.federationCallLog.create.mockResolvedValue({ id: 'log-1' });
  _resetPrivateKeyCache();
  process.env.AUREX_FEDERATION_PRIVATE_KEY_PEM = aurexKeypair.privateKey;
  delete process.env.AUREX_FEDERATION_PRIVATE_KEY_FILE;
});

afterEach(() => {
  delete process.env.AUREX_FEDERATION_PRIVATE_KEY_PEM;
  delete process.env.AUREX_FEDERATION_PRIVATE_KEY_FILE;
  delete process.env.AWD2_FEDERATION_BASE_URL;
});

// ── Outbound: signOutboundJwt ─────────────────────────────────────────────

describe('signOutboundJwt', () => {
  it('produces a valid RS256 JWT verifiable with the matching public key', () => {
    const result = signOutboundJwt({
      partner: 'AWD2',
      claims: { reason: 'cancel', ref: 'nonce-1' },
    });

    expect(result.token).toBeTruthy();
    expect(result.audience).toBe('awd2');
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + (DEFAULT_JWT_LIFETIME_SEC + 5) * 1000,
    );

    // Verify with the public key — proves it was signed by Aurex's
    // private key with RS256 over the right claims.
    const decoded = jwt.verify(result.token, aurexKeypair.publicKey, {
      algorithms: ['RS256'],
    }) as jwt.JwtPayload;
    expect(decoded.iss).toBe('aurex');
    expect(decoded.aud).toBe('awd2');
    expect(decoded.jti).toBe(result.jti);
    expect(decoded.reason).toBe('cancel');
    expect(decoded.ref).toBe('nonce-1');
    expect(typeof decoded.iat).toBe('number');
    expect(typeof decoded.exp).toBe('number');
  });

  it('refuses caller attempts to override iss / aud via the claims object', () => {
    const result = signOutboundJwt({
      partner: 'HCE2',
      claims: { iss: 'attacker', aud: 'attacker' },
    });
    const decoded = jwt.verify(result.token, aurexKeypair.publicKey) as jwt.JwtPayload;
    expect(decoded.iss).toBe('aurex');
    expect(decoded.aud).toBe('hce2');
  });

  it('throws FederationConfigurationError when the private key is unconfigured', () => {
    delete process.env.AUREX_FEDERATION_PRIVATE_KEY_PEM;
    delete process.env.AUREX_FEDERATION_PRIVATE_KEY_FILE;
    _resetPrivateKeyCache();

    expect(() =>
      signOutboundJwt({ partner: 'AWD2', claims: { x: 1 } }),
    ).toThrow(FederationConfigurationError);
    // The error must NOT echo the env var values back.
    expect(() => loadPrivateKey()).toThrow(/not configured/);
  });
});

// ── Outbound: callPartner ─────────────────────────────────────────────────

describe('callPartner', () => {
  it('POSTs to the resolved partner URL with the right Authorization header', async () => {
    process.env.AWD2_FEDERATION_BASE_URL = 'https://awd2.example.com/';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 202,
      text: async () => JSON.stringify({ accepted: true }),
    })) as unknown as typeof fetch;

    const result = await callPartner({
      partner: 'AWD2',
      method: 'POST',
      path: '/api/v1/federation/aurex/handback',
      body: { nonce: 'abc' },
      fetchImpl: fetchMock,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body).toEqual({ accepted: true });
    expect((fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls).toHaveLength(1);
    const [url, init] = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]!;
    expect(url).toBe('https://awd2.example.com/api/v1/federation/aurex/handback');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Bearer eyJ/);
    expect(headers['Content-Type']).toBe('application/json');
    expect(typeof headers['X-Federation-Jti']).toBe('string');
    expect(init.body).toBe(JSON.stringify({ nonce: 'abc' }));

    // FederationCallLog written once with status=SUCCESS.
    expect(mockPrisma.federationCallLog.create).toHaveBeenCalledTimes(1);
    const logArg = mockPrisma.federationCallLog.create.mock.calls[0]![0]!;
    expect(logArg.data.direction).toBe('OUTBOUND');
    expect(logArg.data.partner).toBe('AWD2');
    expect(logArg.data.status).toBe('SUCCESS');
    expect(logArg.data.httpStatus).toBe(202);
  });

  it('throws FederationConfigurationError when the partner base URL is unset', async () => {
    delete process.env.AWD2_FEDERATION_BASE_URL;
    await expect(
      callPartner({
        partner: 'AWD2',
        method: 'GET',
        path: '/api/v1/whatever',
        fetchImpl: vi.fn() as unknown as typeof fetch,
      }),
    ).rejects.toThrow(FederationConfigurationError);
  });
});

// ── Inbound: verifyInboundJwt ─────────────────────────────────────────────

function awd2KeyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    keyId: AWD2_KEY_ID,
    publicKeyPem: awd2Keypair.publicKey,
    isActive: true,
    partner: 'AWD2',
    ...overrides,
  };
}

describe('verifyInboundJwt', () => {
  it('accepts a token signed by the registered partner key (kid path)', async () => {
    mockPrisma.federationKey.findUnique.mockResolvedValue(awd2KeyRow());
    const token = signFromAwd2({});
    const result = await verifyInboundJwt(`Bearer ${token}`, 'AWD2');
    expect(result.ok).toBe(true);
    expect(result.keyId).toBe(AWD2_KEY_ID);
    expect(result.claims.iss).toBe('awd2');
    expect(result.claims.aud).toBe('aurex');
    expect(mockPrisma.federationKey.findUnique).toHaveBeenCalledWith({
      where: { keyId: AWD2_KEY_ID },
      select: expect.any(Object),
    });
  });

  it('rejects expired tokens', async () => {
    mockPrisma.federationKey.findUnique.mockResolvedValue(awd2KeyRow());
    const token = signFromAwd2({ expiresIn: -10 }); // already expired
    await expect(
      verifyInboundJwt(`Bearer ${token}`, 'AWD2'),
    ).rejects.toBeInstanceOf(FederationVerificationError);
  });

  it('rejects mismatched audience', async () => {
    mockPrisma.federationKey.findUnique.mockResolvedValue(awd2KeyRow());
    const token = signFromAwd2({ aud: 'wrong-audience' });
    await expect(
      verifyInboundJwt(`Bearer ${token}`, 'AWD2'),
    ).rejects.toMatchObject({ reason: 'wrong-audience' });
  });

  it('rejects unknown keyId (kid not in DB)', async () => {
    mockPrisma.federationKey.findUnique.mockResolvedValue(null);
    const token = signFromAwd2({ kid: 'nonexistent-kid' });
    await expect(
      verifyInboundJwt(`Bearer ${token}`, 'AWD2'),
    ).rejects.toMatchObject({ reason: 'unknown-kid' });
  });

  it('rejects after key rotation (key marked isActive=false)', async () => {
    mockPrisma.federationKey.findUnique.mockResolvedValue(
      awd2KeyRow({ isActive: false }),
    );
    const token = signFromAwd2({});
    await expect(
      verifyInboundJwt(`Bearer ${token}`, 'AWD2'),
    ).rejects.toMatchObject({ reason: 'inactive-key' });
  });

  it('rejects tokens forged by a different (untrusted) keypair under a known kid', async () => {
    // The kid resolves to an active key, but the token was signed by a
    // stranger — RS256 verification must fail.
    mockPrisma.federationKey.findUnique.mockResolvedValue(awd2KeyRow());
    const token = signFromAwd2({ key: strangerKeypair.privateKey });
    await expect(
      verifyInboundJwt(`Bearer ${token}`, 'AWD2'),
    ).rejects.toBeInstanceOf(FederationVerificationError);
  });

  it('rejects a JWT addressed to a different partner via kid lookup', async () => {
    // The kid resolves to an HCE2 key, but the caller asked for AWD2.
    mockPrisma.federationKey.findUnique.mockResolvedValue(
      awd2KeyRow({ partner: 'HCE2' }),
    );
    const token = signFromAwd2({});
    await expect(
      verifyInboundJwt(`Bearer ${token}`, 'AWD2'),
    ).rejects.toMatchObject({ reason: 'unknown-kid' });
  });

  it('rejects tokens signed with HS256 (algorithm downgrade)', async () => {
    mockPrisma.federationKey.findUnique.mockResolvedValue(awd2KeyRow());
    const token = jwt.sign(
      { iss: 'awd2', aud: 'aurex' },
      'shared-secret',
      { algorithm: 'HS256', expiresIn: '5m', keyid: AWD2_KEY_ID },
    );
    await expect(
      verifyInboundJwt(`Bearer ${token}`, 'AWD2'),
    ).rejects.toMatchObject({ reason: 'wrong-algorithm' });
  });

  it('rejects when no Authorization header is present', async () => {
    await expect(verifyInboundJwt(undefined, 'AWD2')).rejects.toMatchObject({
      reason: 'missing-authorization',
    });
  });

  it('falls back to the single active key when JWT carries no kid', async () => {
    mockPrisma.federationKey.findMany.mockResolvedValue([awd2KeyRow()]);
    const token = signFromAwd2({ kid: null}); // empty string disables keyid header
    const result = await verifyInboundJwt(`Bearer ${token}`, 'AWD2');
    expect(result.ok).toBe(true);
    expect(result.keyId).toBe(AWD2_KEY_ID);
    expect(mockPrisma.federationKey.findMany).toHaveBeenCalled();
  });

  it('rejects when no kid AND multiple active keys (ambiguous)', async () => {
    mockPrisma.federationKey.findMany.mockResolvedValue([
      awd2KeyRow(),
      awd2KeyRow({ keyId: 'awd2-prod-2026-05' }),
    ]);
    const token = signFromAwd2({ kid: null});
    await expect(
      verifyInboundJwt(`Bearer ${token}`, 'AWD2'),
    ).rejects.toMatchObject({ reason: 'ambiguous-key' });
  });
});
