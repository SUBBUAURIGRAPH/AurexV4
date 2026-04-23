import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@aurex/database';
import { logger } from '../lib/logger.js';

/**
 * Org-Scope Middleware
 * Extracts the user's org from their OrgMember records.
 * Attaches orgId to req. Uses the first org the user belongs to (single-tenant initially).
 */

declare global {
  namespace Express {
    interface Request {
      orgId?: string;
      orgRole?: string;
    }
  }
}

export async function requireOrgScope(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      type: 'https://aurex.in/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Authentication required',
    });
    return;
  }

  try {
    const membership = await prisma.orgMember.findFirst({
      where: {
        userId: req.user.sub,
        isActive: true,
        org: { isActive: true },
      },
      orderBy: { createdAt: 'asc' },
      select: { orgId: true, role: true },
    });

    if (!membership) {
      res.status(403).json({
        type: 'https://aurex.in/errors/no-organization',
        title: 'Forbidden',
        status: 403,
        detail: 'User is not a member of any organization',
      });
      return;
    }

    req.orgId = membership.orgId;
    req.orgRole = membership.role;
    next();
  } catch (err) {
    logger.error({ err, userId: req.user.sub }, 'Failed to resolve org scope');
    next(err);
  }
}
