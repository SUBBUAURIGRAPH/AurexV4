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
  // Normalize once up-front: the users.role column stores uppercase enum names
  // (ORG_ADMIN) but callers pass 'org_admin' or 'ORG_ADMIN' interchangeably.
  const allowed = new Set(roles.map((r) => r.toUpperCase()));
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        type: 'https://aurex.in/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
      });
      return;
    }

    if (!allowed.has(String(req.user.role).toUpperCase())) {
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
