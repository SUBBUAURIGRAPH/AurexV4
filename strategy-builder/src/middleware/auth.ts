/**
 * Authentication Middleware
 * JWT validation and user authentication
 */

import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
import { verifyToken, extractTokenFromHeader } from '../utils/auth';
import User from '../api/models/user.model';
import { logger } from '../utils/logger';

/**
 * Authenticate user via JWT
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No authentication token provided'
        }
      });
      return;
    }

    // Verify token
    const decoded = verifyToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found'
        }
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User account is disabled'
        }
      });
      return;
    }

    // Attach user to request
    req.user = user;

    next();
  } catch (error) {
    logger.error('Authentication error', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: error instanceof Error ? error.message : 'Authentication failed'
      }
    });
  }
}

/**
 * Optional authentication (doesn't fail if no token)
 */
export async function optionalAuthenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      next();
      return;
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (user && user.isActive) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Don't fail, just proceed without user
    next();
  }
}
