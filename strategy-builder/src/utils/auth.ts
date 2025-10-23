/**
 * Authentication Utilities
 * JWT token generation and validation
 * API Key generation and validation
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authConfig } from '../config/auth';
import { JWTPayload, UserRole } from '../types';

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: {
  userId: string;
  email: string;
  role: UserRole;
}): string {
  return jwt.sign(payload, authConfig.jwt.secret, {
    expiresIn: authConfig.jwt.expiresIn,
    algorithm: authConfig.jwt.algorithm
  });
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    authConfig.jwt.secret,
    {
      expiresIn: authConfig.jwt.refreshExpiresIn,
      algorithm: authConfig.jwt.algorithm
    }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, authConfig.jwt.secret, {
      algorithms: [authConfig.jwt.algorithm]
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, authConfig.bcrypt.saltRounds);
}

/**
 * Compare password with hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authorization?: string): string | null {
  if (!authorization) {
    return null;
  }

  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Generate a new API key
 * Returns the full key (to be shown once to user) and its hash (for storage)
 */
export function generateAPIKey(): {
  key: string;
  keyHash: string;
  keyPrefix: string;
} {
  const randomBytes = crypto.randomBytes(32);
  const fullKey = `aur_${randomBytes.toString('hex')}`;
  const keyPrefix = fullKey.substring(0, 8);
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

  return {
    key: fullKey,
    keyHash,
    keyPrefix
  };
}

/**
 * Hash an API key for storage verification
 */
export function hashAPIKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Verify an API key against its hash
 */
export function verifyAPIKey(key: string, keyHash: string): boolean {
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return hash === keyHash;
}

/**
 * Extract API key from Authorization header
 * Supports both "Bearer <api_key>" and "ApiKey <api_key>" formats
 */
export function extractAPIKeyFromHeader(authorization?: string): string | null {
  if (!authorization) {
    return null;
  }

  const parts = authorization.split(' ');
  if (parts.length !== 2) {
    return null;
  }

  const [scheme, credentials] = parts;
  if (scheme !== 'Bearer' && scheme !== 'ApiKey') {
    return null;
  }

  return credentials;
}
