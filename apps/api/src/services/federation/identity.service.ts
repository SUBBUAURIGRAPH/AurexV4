/**
 * AAT-367 / AV4-367 — service-to-service identity federation.
 *
 * Bidirectional RS256-signed JWT federation between Aurex and partner
 * registries (AWD2, HCE2, Aurigraph DLT). The legacy AWD2 → Aurex direct
 * handoff route (`/api/v1/awd2/handoff`, AAT-ξ) is unchanged; this
 * namespace adds a generic federated identity layer that works in both
 * directions.
 *
 * OUTBOUND  (Aurex → partner):
 *   - `signOutboundJwt({ partner, audience, claims })` — RS256 over
 *     Aurex's private key (loaded once from env/file). Standard claims:
 *     iss=aurex, aud, iat, exp (default 5min), jti, plus caller-supplied.
 *   - `callPartner({ partner, method, path, body? })` — POSTs/GETs the
 *     partner's federation endpoint with the signed bearer token. The
 *     base URL comes from `<PARTNER>_FEDERATION_BASE_URL`. Every call is
 *     logged to `FederationCallLog` (best-effort).
 *
 * INBOUND  (partner → Aurex):
 *   - `verifyInboundJwt(authHeader, partner)` — extracts the bearer,
 *     decodes the kid, looks up the active `FederationKey` for that
 *     partner, RS256-verifies, and validates iss/aud/exp/iat. Returns
 *     `{ ok: true, claims, keyId }` on success or throws
 *     `FederationVerificationError` on every failure mode (missing
 *     header, malformed token, unknown kid, inactive key, signature
 *     mismatch, audience mismatch, expired). The error carries an
 *     RFC 7807 status (always 401 here) so the middleware can surface it
 *     without leaking internals.
 *
 * Security notes:
 *   - The private key is NEVER logged. We never include it in error
 *     messages and we cache it in module scope after the first load.
 *   - We deliberately do not throw on missing private key at module
 *     load — a fresh test boot or read-only worker shouldn't fail just
 *     because outbound is unconfigured. The error surfaces at first
 *     `signOutboundJwt` call instead.
 *   - JWT lifetime is 5 minutes by default (matches existing AWD2
 *     handoff route). Override via the `expiresInSec` argument.
 */

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '@aurex/database';
import type {
  FederationPartner,
  FederationDirection,
  FederationStatus,
} from '@aurex/database';
import { logger } from '../../lib/logger.js';

// ── Constants ────────────────────────────────────────────────────────────

export const AUREX_ISSUER = 'aurex';
export const DEFAULT_JWT_LIFETIME_SEC = 5 * 60;

const ENV_PRIVATE_KEY_PEM = 'AUREX_FEDERATION_PRIVATE_KEY_PEM';
const ENV_PRIVATE_KEY_FILE = 'AUREX_FEDERATION_PRIVATE_KEY_FILE';

const PARTNER_AUDIENCE: Record<FederationPartner, string> = {
  AWD2: 'awd2',
  HCE2: 'hce2',
  AURIGRAPH: 'aurigraph',
};

const PARTNER_BASE_URL_ENV: Record<FederationPartner, string> = {
  AWD2: 'AWD2_FEDERATION_BASE_URL',
  HCE2: 'HCE2_FEDERATION_BASE_URL',
  AURIGRAPH: 'AURIGRAPH_FEDERATION_BASE_URL',
};

// ── Errors ───────────────────────────────────────────────────────────────

/**
 * Thrown by `verifyInboundJwt` and `requireFederation` middleware on
 * every reject path. Always 401 — we don't leak which precise check
 * failed (signature vs audience vs key lookup).
 */
export class FederationVerificationError extends Error {
  public readonly status = 401;
  public readonly title = 'Unauthorized';
  public readonly type = 'https://aurex.in/errors/federation-unauthorized';

  constructor(
    public readonly reason: string,
    public readonly safeDetail = 'Federation JWT could not be verified',
  ) {
    super(safeDetail);
    this.name = 'FederationVerificationError';
  }
}

/**
 * Thrown when outbound signing is attempted without a configured
 * private key. We delay this to call-time so test boots / inbound-only
 * deployments don't fail.
 */
export class FederationConfigurationError extends Error {
  public readonly status = 500;
  public readonly title = 'Internal Server Error';

  constructor(message: string) {
    super(message);
    this.name = 'FederationConfigurationError';
  }
}

// ── Private key (lazy + cached) ──────────────────────────────────────────

let cachedPrivateKey: string | null = null;
let cachedPrivateKeySource: 'env' | 'file' | null = null;

/**
 * Reset the cached private key. Tests use this to flip between fixture
 * keys; production code never calls it.
 */
export function _resetPrivateKeyCache(): void {
  cachedPrivateKey = null;
  cachedPrivateKeySource = null;
}

function unescapePem(raw: string): string {
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

/**
 * Load Aurex's RS256 private key. Prefers the literal env var; falls
 * back to a file path. Throws `FederationConfigurationError` if neither
 * is set or the file is unreadable. The key is cached for the process
 * lifetime once loaded — operators rotate by restarting the API.
 */
export function loadPrivateKey(): string {
  if (cachedPrivateKey) return cachedPrivateKey;

  const inline = process.env[ENV_PRIVATE_KEY_PEM];
  if (inline && inline.trim().length > 0) {
    cachedPrivateKey = unescapePem(inline);
    cachedPrivateKeySource = 'env';
    return cachedPrivateKey;
  }

  const filePath = process.env[ENV_PRIVATE_KEY_FILE];
  if (filePath && filePath.trim().length > 0) {
    try {
      cachedPrivateKey = readFileSync(filePath, 'utf8');
      cachedPrivateKeySource = 'file';
      return cachedPrivateKey;
    } catch (err) {
      // We log without including the key contents (the file might not
      // exist — only the path). Path is operator-controlled, safe to
      // include.
      logger.error(
        { err, filePath },
        'Failed to read AUREX_FEDERATION_PRIVATE_KEY_FILE',
      );
      throw new FederationConfigurationError(
        `Could not read federation private key file at ${filePath}`,
      );
    }
  }

  throw new FederationConfigurationError(
    'Aurex federation private key not configured (set AUREX_FEDERATION_PRIVATE_KEY_PEM or AUREX_FEDERATION_PRIVATE_KEY_FILE)',
  );
}

/** Test helper — exposed for assertions; never used in production paths. */
export function _privateKeySource(): 'env' | 'file' | null {
  return cachedPrivateKeySource;
}

// ── Outbound: sign + call ────────────────────────────────────────────────

export interface SignOutboundJwtParams {
  partner: FederationPartner;
  audience?: string; // override; defaults to partner audience
  claims?: Record<string, unknown>;
  expiresInSec?: number; // default 300
}

export interface OutboundJwt {
  token: string;
  jti: string;
  expiresAt: Date;
  audience: string;
}

/**
 * Sign an RS256 JWT addressed to the given partner. Claims always
 * include iss=aurex, aud, iat, exp, jti — caller's `claims` are merged
 * on top (cannot override the standard claims).
 */
export function signOutboundJwt(params: SignOutboundJwtParams): OutboundJwt {
  const privateKey = loadPrivateKey();
  const audience = params.audience ?? PARTNER_AUDIENCE[params.partner];
  const expiresInSec = params.expiresInSec ?? DEFAULT_JWT_LIFETIME_SEC;
  const jti = randomUUID();

  // Order matters: standard claims overwrite caller-supplied ones so a
  // misconfigured caller can't forge an iss/aud.
  const payload: Record<string, unknown> = {
    ...(params.claims ?? {}),
    iss: AUREX_ISSUER,
    aud: audience,
    jti,
  };

  const token = jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: expiresInSec,
  });

  return {
    token,
    jti,
    audience,
    expiresAt: new Date(Date.now() + expiresInSec * 1000),
  };
}

export type FederationHttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface CallPartnerParams {
  partner: FederationPartner;
  method: FederationHttpMethod;
  path: string; // e.g. '/api/v1/federation/aurex/handback'
  body?: unknown;
  claims?: Record<string, unknown>;
  // Optional injection seam for tests so we don't depend on global fetch.
  fetchImpl?: typeof fetch;
}

export interface CallPartnerResult {
  ok: boolean;
  status: number;
  body: unknown;
  jti: string;
  latencyMs: number;
}

/**
 * Resolve the partner base URL or throw a `FederationConfigurationError`.
 * Trailing slashes are normalized.
 */
function resolvePartnerBaseUrl(partner: FederationPartner): string {
  const envName = PARTNER_BASE_URL_ENV[partner];
  const raw = process.env[envName];
  if (!raw || raw.trim().length === 0) {
    throw new FederationConfigurationError(
      `Federation base URL for ${partner} is not configured (${envName} unset)`,
    );
  }
  return raw.replace(/\/+$/, '');
}

/**
 * Call a partner registry with a freshly-signed federation JWT. Logs the
 * attempt + outcome to `FederationCallLog` (best effort — DB log
 * failure never aborts the call).
 */
export async function callPartner(params: CallPartnerParams): Promise<CallPartnerResult> {
  const baseUrl = resolvePartnerBaseUrl(params.partner);
  const fullUrl = `${baseUrl}${params.path.startsWith('/') ? params.path : `/${params.path}`}`;
  const signed = signOutboundJwt({
    partner: params.partner,
    claims: params.claims,
  });

  const fetchFn = params.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${signed.token}`,
    'Content-Type': 'application/json',
    'X-Federation-Jti': signed.jti,
  };

  const start = Date.now();
  let httpStatus: number | null = null;
  let okFlag = false;
  let body: unknown = null;
  let errMessage: string | null = null;

  try {
    const init: RequestInit = {
      method: params.method,
      headers,
    };
    if (params.body !== undefined && params.method !== 'GET') {
      init.body = JSON.stringify(params.body);
    }
    const resp = await fetchFn(fullUrl, init);
    httpStatus = resp.status;
    okFlag = resp.ok;
    // Try to decode JSON body but don't blow up on empty / non-JSON.
    const text = await resp.text();
    if (text.length > 0) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
    }
  } catch (err) {
    errMessage = err instanceof Error ? err.message : 'unknown fetch error';
  }

  const latencyMs = Date.now() - start;
  const status: FederationStatus = okFlag
    ? 'SUCCESS'
    : errMessage
      ? 'FAILED'
      : (httpStatus ?? 0) >= 400
        ? 'FAILED'
        : 'PENDING';

  await writeCallLog({
    direction: 'OUTBOUND',
    partner: params.partner,
    endpoint: `${params.method} ${params.path}`,
    status,
    httpStatus,
    errorMessage: errMessage,
    requestId: signed.jti,
    latencyMs,
  });

  if (errMessage) {
    throw new FederationConfigurationError(
      `Federation call to ${params.partner} failed: ${errMessage}`,
    );
  }

  return {
    ok: okFlag,
    status: httpStatus ?? 0,
    body,
    jti: signed.jti,
    latencyMs,
  };
}

// ── Inbound: verify ──────────────────────────────────────────────────────

export interface InboundJwtClaims {
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
  jti?: string;
  kid?: string;
  [key: string]: unknown;
}

export interface VerifyInboundResult {
  ok: true;
  claims: InboundJwtClaims;
  keyId: string;
}

/**
 * Pull the bearer JWT from an Authorization header. Throws
 * FederationVerificationError if missing or malformed.
 */
export function extractBearer(authHeader: string | undefined): string {
  if (!authHeader || typeof authHeader !== 'string') {
    throw new FederationVerificationError(
      'missing-authorization',
      'Missing or malformed Authorization header',
    );
  }
  if (!authHeader.startsWith('Bearer ')) {
    throw new FederationVerificationError(
      'malformed-authorization',
      'Missing or malformed Authorization header',
    );
  }
  const token = authHeader.slice(7).trim();
  if (token.length === 0) {
    throw new FederationVerificationError('empty-bearer', 'Empty bearer token');
  }
  return token;
}

/**
 * Decode the JWT header (without verifying) so we can extract the kid
 * before looking up the public key. Throws FederationVerificationError
 * on malformed JWTs.
 */
function decodeHeader(token: string): { kid?: string; alg?: string } {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') {
    throw new FederationVerificationError('malformed-jwt', 'Malformed JWT');
  }
  const header = decoded.header as { kid?: unknown; alg?: unknown };
  return {
    kid: typeof header.kid === 'string' ? header.kid : undefined,
    alg: typeof header.alg === 'string' ? header.alg : undefined,
  };
}

/**
 * Verify an inbound bearer JWT signed by `partner`. Looks up the active
 * FederationKey by kid (or by single-active fallback if the JWT has no
 * kid header), then RS256-verifies and asserts iss + aud claims.
 */
export async function verifyInboundJwt(
  authHeader: string | undefined,
  partner: FederationPartner,
): Promise<VerifyInboundResult> {
  const token = extractBearer(authHeader);
  const header = decodeHeader(token);

  if (header.alg !== 'RS256') {
    throw new FederationVerificationError(
      'wrong-algorithm',
      'Federation JWT must be RS256-signed',
    );
  }

  // Resolve the key. If the JWT carries a kid, look it up directly. If
  // it doesn't, fall back to the single active key for this partner —
  // strict-rejecting when there's >1 active key (operator should rotate
  // properly with kid then).
  interface KeyRow {
    id: string;
    keyId: string;
    publicKeyPem: string;
    isActive: boolean;
  }
  let keyRow: KeyRow;

  if (header.kid) {
    const found = await prisma.federationKey.findUnique({
      where: { keyId: header.kid },
      select: { id: true, keyId: true, publicKeyPem: true, isActive: true, partner: true },
    });
    if (!found || found.partner !== partner) {
      throw new FederationVerificationError(
        'unknown-kid',
        'Federation key not registered',
      );
    }
    if (!found.isActive) {
      throw new FederationVerificationError(
        'inactive-key',
        'Federation key has been rotated/deactivated',
      );
    }
    keyRow = {
      id: found.id,
      keyId: found.keyId,
      publicKeyPem: found.publicKeyPem,
      isActive: found.isActive,
    };
  } else {
    const active = await prisma.federationKey.findMany({
      where: { partner, isActive: true },
      select: { id: true, keyId: true, publicKeyPem: true, isActive: true },
    });
    if (active.length === 0) {
      throw new FederationVerificationError(
        'no-active-key',
        'No active federation key registered for partner',
      );
    }
    if (active.length > 1) {
      throw new FederationVerificationError(
        'ambiguous-key',
        'Multiple active federation keys; JWT must include a kid',
      );
    }
    keyRow = active[0]!;
  }

  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, unescapePem(keyRow.publicKeyPem), {
      algorithms: ['RS256'],
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'verify-failed';
    // jsonwebtoken surfaces TokenExpiredError; preserve the reason for
    // the audit log without leaking it to the HTTP body.
    throw new FederationVerificationError(reason, 'Federation JWT verification failed');
  }
  if (typeof payload === 'string') {
    throw new FederationVerificationError(
      'string-payload',
      'Federation JWT must be a JSON object',
    );
  }

  // iss check — partner's expected issuer. We accept either the
  // canonical lowercase ("awd2") or the partner's own name claim if
  // they happen to set iss=aurex incorrectly we reject.
  const expectedIss = PARTNER_AUDIENCE[partner];
  if (typeof payload.iss !== 'string' || payload.iss !== expectedIss) {
    throw new FederationVerificationError(
      'wrong-iss',
      'Federation JWT issuer mismatch',
    );
  }

  // aud check — must be 'aurex'.
  const aud = payload.aud;
  const audOk =
    aud === AUREX_ISSUER ||
    (Array.isArray(aud) && aud.includes(AUREX_ISSUER));
  if (!audOk) {
    throw new FederationVerificationError(
      'wrong-audience',
      'Federation JWT audience mismatch',
    );
  }

  return {
    ok: true,
    claims: payload as InboundJwtClaims,
    keyId: keyRow.keyId,
  };
}

// ── Best-effort call log writer ──────────────────────────────────────────

export interface CallLogParams {
  direction: FederationDirection;
  partner: FederationPartner;
  endpoint: string;
  status: FederationStatus;
  keyId?: string | null;
  httpStatus?: number | null;
  errorMessage?: string | null;
  requestId?: string | null;
  latencyMs?: number | null;
}

export async function writeCallLog(params: CallLogParams): Promise<void> {
  try {
    await prisma.federationCallLog.create({
      data: {
        direction: params.direction,
        partner: params.partner,
        keyId: params.keyId ?? null,
        endpoint: params.endpoint,
        status: params.status,
        httpStatus: params.httpStatus ?? null,
        errorMessage: params.errorMessage ?? null,
        requestId: params.requestId ?? null,
        latencyMs: params.latencyMs ?? null,
      },
    });
  } catch (err) {
    logger.error(
      { err, direction: params.direction, partner: params.partner, endpoint: params.endpoint },
      'Failed to write FederationCallLog',
    );
  }
}
