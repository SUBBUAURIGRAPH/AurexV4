/**
 * Authentication Middleware
 * Validates JWT tokens and extracts user context
 * @version 2.0.0 - Production-grade JWT verification
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError, ErrorCodes } from '../../types/index.js';

/**
 * Extended Request with user context
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: { id: string; email: string };
}

/**
 * Verify JWT Token
 * Validates token signature, expiration, and claims
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid
 * @throws Never - returns null on verification failure
 */
export const verifyToken = (token: string): any => {
  try {
    // Get JWT secret from environment
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET environment variable is not set');
      return null;
    }

    // Verify token signature and expiration
    const payload = jwt.verify(token, secret) as any;

    // Ensure required fields are present
    if (!payload.userId || !payload.email) {
      console.warn('JWT token missing required fields (userId, email)');
      return null;
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.warn('JWT token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn('JWT verification failed:', (error as any).message);
    } else {
      console.error('Unexpected error during JWT verification:', error);
    }
    return null;
  }
};

/**
 * Authentication Middleware
 * Checks for valid JWT token in Authorization header
 */
export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new ApiError(
        ErrorCodes.UNAUTHORIZED,
        401,
        'Authorization header is missing'
      );
    }

    // Extract bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new ApiError(
        ErrorCodes.INVALID_TOKEN,
        401,
        'Invalid authorization header format'
      );
    }

    const token = parts[1];

    // Verify token (handles signature, expiration, and claims validation)
    const payload = verifyToken(token);
    if (!payload) {
      throw new ApiError(
        ErrorCodes.INVALID_TOKEN,
        401,
        'Invalid or expired token'
      );
    }

    // Attach user to request
    req.userId = payload.userId;
    req.user = {
      id: payload.userId,
      email: payload.email
    };

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(
        new ApiError(
          ErrorCodes.UNAUTHORIZED,
          401,
          'Authentication failed'
        )
      );
    }
  }
};

export default authMiddleware;
