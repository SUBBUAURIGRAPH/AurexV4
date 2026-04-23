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
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY_SECONDS });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY_SECONDS });
}

export function verifyAccessToken(token: string): DecodedToken {
  return jwt.verify(token, ACCESS_SECRET) as DecodedToken;
}

export function verifyRefreshToken(token: string): DecodedToken {
  return jwt.verify(token, REFRESH_SECRET) as DecodedToken;
}
