/**
 * Google Sign-In (OAuth 2.0 Authorization Code flow).
 *
 * Server-side flow:
 *   1. /auth/google/start — sign a state JWT (5min, includes redirect
 *      target + nonce), 302 to Google with state in the query.
 *   2. Google redirects back to /auth/google/callback with `code` + same
 *      `state`.
 *   3. We verify the state JWT (CSRF protection — only states we issued
 *      will round-trip), exchange the code for tokens via raw fetch to
 *      Google's token endpoint, verify the ID token's signature against
 *      Google's JWKS + audience + issuer + email_verified, and upsert
 *      the user.
 *
 * Implementation note: this used to call into google-auth-library, but
 * its bundled gaxios HTTP transport hangs on oauth2.googleapis.com/token
 * from the production container while native fetch to the same URL
 * returns 400 in <300ms. Switching to raw fetch + crypto.createPublicKey
 * removes a misbehaving dependency and keeps the wire protocol under
 * our control.
 *
 * Account-linking policy: trust Google's email verification. If the
 * incoming `email` matches an existing user with no `googleSub`, link
 * them. If a user already has a `googleSub` that doesn't match the
 * incoming token, refuse — that account is bound to a different Google
 * identity.
 */
import { createPublicKey, type KeyObject } from 'node:crypto';
import jwt, { type JwtHeader } from 'jsonwebtoken';
import { prisma } from '@aurex/database';
import { signAccessToken, signRefreshToken, type TokenPayload as AurexTokenPayload } from '../lib/jwt.js';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import * as authService from './auth.service.js';

const STATE_JWT_AUDIENCE = 'aurex:google-oauth-state';
const STATE_TTL_SECONDS = 5 * 60;
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const JWKS_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS: [string, ...string[]] = ['https://accounts.google.com', 'accounts.google.com'];
const NETWORK_TIMEOUT_MS = 8000;

function readEnv(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  jwtSecret: string;
  webBaseUrl: string;
} {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const jwtSecret = process.env.JWT_SECRET ?? 'dev-access-secret-change-me';
  const webBaseUrl = process.env.WEB_BASE_URL ?? 'https://aurex.in';
  if (!clientId || !clientSecret || !redirectUri) {
    throw new AppError(
      503,
      'Service Unavailable',
      'Google sign-in is not configured on this server',
    );
  }
  return { clientId, clientSecret, redirectUri, jwtSecret, webBaseUrl };
}

interface StatePayload {
  redirect: string;
  nonce: string;
}

/**
 * Build the Google authorization URL the caller should 302 to.
 * `redirect` is the post-login frontend route to return the user to.
 */
export function buildAuthorizationUrl(opts: { redirect?: string }): string {
  const { clientId, redirectUri, jwtSecret } = readEnv();
  const redirect = sanitizeRedirect(opts.redirect);
  const nonce = randomNonce();
  const state = jwt.sign(
    { redirect, nonce } satisfies StatePayload,
    jwtSecret,
    { audience: STATE_JWT_AUDIENCE, expiresIn: STATE_TTL_SECONDS },
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Only allow same-origin redirects to prevent open-redirect abuse. */
function sanitizeRedirect(input: string | undefined): string {
  if (!input) return '/';
  if (!input.startsWith('/')) return '/';
  if (input.startsWith('//')) return '/';
  return input;
}

function randomNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Google ID token verification (JWKS, RS256) ─────────────────────────

interface GoogleJwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

let jwksCache: { keys: GoogleJwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 60 * 60_000; // 1 hour

async function fetchJwks(): Promise<GoogleJwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(JWKS_ENDPOINT, {
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new AppError(502, 'Bad Gateway', `JWKS fetch failed (${res.status})`);
  }
  const body = (await res.json()) as { keys: GoogleJwk[] };
  jwksCache = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

/** For tests: drop the JWKS cache so the next call refetches. */
export function _resetJwksCache(): void {
  jwksCache = null;
}

function jwkToPublicKey(jwk: GoogleJwk): KeyObject {
  // node:crypto's `createPublicKey({ format: 'jwk', key })` accepts a JWK
  // object directly since Node 16; the global `JsonWebKey` DOM type isn't
  // available in our tsconfig, so cast through unknown.
  return createPublicKey({
    key: jwk as unknown as Parameters<typeof createPublicKey>[0] extends string ? never : { kty: string },
    format: 'jwk',
  });
}

interface GoogleIdTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  iss: string;
  aud: string;
  exp: number;
}

async function verifyGoogleIdToken(idToken: string, expectedAud: string): Promise<GoogleIdTokenPayload> {
  // Decode the header so we know which JWKS key to use.
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === 'string') {
    throw new AppError(401, 'Unauthorized', 'Could not decode Google id_token');
  }
  const header = decoded.header as JwtHeader & { kid?: string };
  if (!header.kid) {
    throw new AppError(401, 'Unauthorized', 'Google id_token missing kid');
  }
  if (header.alg !== 'RS256') {
    throw new AppError(401, 'Unauthorized', `Unexpected id_token alg: ${header.alg}`);
  }

  let keys = await fetchJwks();
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    // Key may have rotated since we cached; try one fresh fetch.
    _resetJwksCache();
    keys = await fetchJwks();
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) {
    throw new AppError(401, 'Unauthorized', 'Google id_token kid not in JWKS');
  }

  const publicKey = jwkToPublicKey(jwk);
  let verified: GoogleIdTokenPayload;
  try {
    verified = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      audience: expectedAud,
      issuer: ISSUERS,
    }) as GoogleIdTokenPayload;
  } catch (err) {
    logger.warn({ err }, 'google-oauth: id_token signature/audience verification failed');
    throw new AppError(401, 'Unauthorized', 'Invalid Google id_token');
  }
  return verified;
}

async function exchangeCodeForTokens(code: string): Promise<{ id_token?: string }> {
  const { clientId, clientSecret, redirectUri } = readEnv();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });
  let res: Response;
  try {
    res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn({ err }, 'google-oauth: token endpoint network error');
    throw new AppError(502, 'Bad Gateway', 'Could not reach Google token endpoint');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn({ status: res.status, body: text.slice(0, 300) }, 'google-oauth: token exchange returned error');
    throw new AppError(400, 'Bad Request', 'Could not exchange authorization code');
  }
  return (await res.json()) as { id_token?: string };
}

// ── Public callback flow ───────────────────────────────────────────────

export interface CallbackResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: string };
  redirect: string;
  /** True if a new User row was created in this call. */
  created: boolean;
}

export async function handleCallback(opts: {
  code: string;
  state: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<CallbackResult> {
  const { jwtSecret, clientId } = readEnv();

  // 1. Verify the state JWT (CSRF + tampering protection).
  let parsedState: StatePayload;
  try {
    parsedState = jwt.verify(opts.state, jwtSecret, {
      audience: STATE_JWT_AUDIENCE,
    }) as StatePayload & { iat: number; exp: number };
  } catch (err) {
    logger.warn({ err }, 'google-oauth: state verification failed');
    throw new AppError(400, 'Bad Request', 'Invalid or expired state');
  }

  // 2. Exchange the authorization code for tokens.
  const tokens = await exchangeCodeForTokens(opts.code);
  const idTokenStr = tokens.id_token;
  if (!idTokenStr) {
    throw new AppError(400, 'Bad Request', 'Google response missing id_token');
  }

  // 3. Verify the ID token (signature, audience, issuer, expiry).
  const payload = await verifyGoogleIdToken(idTokenStr, clientId);

  if (payload.email_verified !== true) {
    throw new AppError(
      403,
      'Forbidden',
      'Google account email is not verified — verify with Google before signing in',
    );
  }

  const sub = payload.sub;
  const email = payload.email;
  if (!sub || !email) {
    throw new AppError(400, 'Bad Request', 'Google id_token missing sub/email');
  }
  const displayName = payload.name?.trim() || email.split('@')[0]!;

  // 4. Upsert the user.
  const upsert = await upsertGoogleUser({ sub, email, name: displayName });

  // 5. Issue Aurex JWTs (matches the local /auth/login response shape).
  const tokenPayload: AurexTokenPayload = {
    sub: upsert.user.id,
    email: upsert.user.email,
    role: upsert.user.role as AurexTokenPayload['role'],
  };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  await prisma.session.create({
    data: {
      userId: upsert.user.id,
      refreshToken,
      userAgent: opts.userAgent,
      ipAddress: opts.ipAddress,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
    },
  });

  await authService.logAuthEvent(
    upsert.user.id,
    'LOGIN_SUCCESS',
    opts.ipAddress,
    opts.userAgent,
    { method: 'google-oauth', linked: upsert.linked, created: upsert.created },
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id: upsert.user.id,
      email: upsert.user.email,
      name: upsert.user.name,
      role: upsert.user.role.toLowerCase(),
    },
    redirect: parsedState.redirect,
    created: upsert.created,
  };
}

interface UpsertResult {
  user: { id: string; email: string; name: string; role: string };
  created: boolean;
  linked: boolean;
}

async function upsertGoogleUser(opts: {
  sub: string;
  email: string;
  name: string;
}): Promise<UpsertResult> {
  // Match by Google sub first (stable across email changes), then by email.
  const bySub = await prisma.user.findUnique({ where: { googleSub: opts.sub } });
  if (bySub) {
    if (!bySub.isActive) {
      throw new AppError(403, 'Forbidden', 'Account is disabled');
    }
    await prisma.user.update({
      where: { id: bySub.id },
      data: { lastLoginAt: new Date() },
    });
    return {
      user: { id: bySub.id, email: bySub.email, name: bySub.name, role: bySub.role },
      created: false,
      linked: false,
    };
  }

  const byEmail = await prisma.user.findUnique({ where: { email: opts.email } });
  if (byEmail) {
    if (!byEmail.isActive) {
      throw new AppError(403, 'Forbidden', 'Account is disabled');
    }
    if (byEmail.googleSub && byEmail.googleSub !== opts.sub) {
      // Existing local account is already bound to a different Google
      // identity. Refuse to silently re-bind — operator must intervene.
      throw new AppError(
        409,
        'Conflict',
        'This email is linked to a different Google account',
      );
    }
    // First-time link: attach googleSub, mark verified (Google validated the
    // email), bump login timestamp.
    const updated = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleSub: opts.sub,
        isVerified: true,
        emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
        lastLoginAt: new Date(),
      },
    });
    return {
      user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role },
      created: false,
      linked: true,
    };
  }

  // Brand-new user — create with a federated identity, no local password.
  const created = await prisma.user.create({
    data: {
      email: opts.email,
      name: opts.name,
      googleSub: opts.sub,
      passwordHash: null,
      isVerified: true,
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    },
  });
  logger.info({ userId: created.id, email: opts.email }, 'google-oauth: user created');
  return {
    user: { id: created.id, email: created.email, name: created.name, role: created.role },
    created: true,
    linked: false,
  };
}
