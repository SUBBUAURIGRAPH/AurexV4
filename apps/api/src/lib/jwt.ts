import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role } from '@aurex/shared';

const ACCESS_SECRET = process.env.JWT_SECRET ?? 'dev-access-secret-change-me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me';
const ACCESS_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const REFRESH_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface TokenPayload {
  sub: string; // userId
  email: string;
  role: Role;
  orgId?: string;
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
  jti?: string;
}

/**
 * Both helpers stamp a fresh `jti` (JWT ID) on every call so two
 * tokens minted in the same second for the same user are still
 * unique strings. Without this, two concurrent /auth/login calls for
 * the same identity produce identical signatures and the second
 * `prisma.session.create` collides on the `refresh_token` UNIQUE
 * constraint (Prisma P2002 — observed during the 2026-05-03 deploy
 * regression cascade for commit 9a7fa45).
 */

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRY_SECONDS,
    jwtid: randomUUID(),
  });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRY_SECONDS,
    jwtid: randomUUID(),
  });
}

export function verifyAccessToken(token: string): DecodedToken {
  return jwt.verify(token, ACCESS_SECRET) as DecodedToken;
}

export function verifyRefreshToken(token: string): DecodedToken {
  return jwt.verify(token, REFRESH_SECRET) as DecodedToken;
}
