/**
 * Authentication Middleware
 * Validates JWT tokens and extracts user context
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError, ErrorCodes } from '../../types';

/**
 * Extended Request with user context
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: { id: string; email: string };
}

/**
 * Verify JWT Token
 */
export const verifyToken = (token: string): any => {
  try {
    // TODO: Verify JWT token using jsonwebtoken library
    // import jwt from 'jsonwebtoken'
    // return jwt.verify(token, process.env.JWT_SECRET)

    // For now, simulate token verification
    if (!token || token.length < 20) {
      return null;
    }

    // Decode token structure (simplified)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Return decoded payload
    return {
      userId: 'user-uuid',
      email: 'user@example.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400
    };
  } catch (error) {
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

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      throw new ApiError(
        ErrorCodes.INVALID_TOKEN,
        401,
        'Invalid or expired token'
      );
    }

    // Check token expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new ApiError(
        ErrorCodes.EXPIRED_TOKEN,
        401,
        'Token has expired'
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
