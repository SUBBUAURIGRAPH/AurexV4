import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type DecodedToken } from '../lib/jwt.js';
import { logger } from '../lib/logger.js';

/**
 * ADM-036: Unified auth middleware
 * Extracts and verifies JWT from Authorization header
 */

declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({
      type: 'https://aurex.in/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Authentication required',
    });
    return;
  }

  const token = header.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    logger.warn({ err }, 'Invalid JWT');
    res.status(401).json({
      type: 'https://aurex.in/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Invalid or expired token',
    });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        type: 'https://aurex.in/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        type: 'https://aurex.in/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}
