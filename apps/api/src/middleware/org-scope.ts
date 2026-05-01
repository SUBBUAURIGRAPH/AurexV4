import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@aurex/database';
import { logger } from '../lib/logger.js';

/**
 * Org-Scope Middleware (multi-tenant aware).
 *
 * Resolves which organisation the request acts on and attaches `orgId`
 * + `orgRole` to req. Two ways to drive it:
 *
 *   1. **`x-org-id` header** (preferred for any user with >1
 *      membership, and required for SUPER_ADMIN to act on a specific
 *      org's records). The middleware validates that the user is a
 *      member of that org OR is a global SUPER_ADMIN.
 *
 *   2. **No header** → falls back to the user's oldest membership by
 *      `createdAt:asc`. This preserves the original single-tenant
 *      behavior for users with exactly one org.
 *
 * Why the rewrite (2026-05-01): the prior implementation always picked
 * the oldest membership with no override, which silently locked
 * multi-org users (super_admins included) onto whichever org they
 * happened to join first. End result: the verify-workflow returned 404
 * "Emission record not found" for any record outside that single org.
 */

declare global {
  namespace Express {
    interface Request {
      orgId?: string;
      orgRole?: string;
    }
  }
}

const ORG_HEADER = 'x-org-id';

function isSuperAdmin(role: string | undefined): boolean {
  if (!role) return false;
  return role.toLowerCase() === 'super_admin';
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
    const requestedOrgIdRaw = req.headers[ORG_HEADER];
    const requestedOrgId =
      typeof requestedOrgIdRaw === 'string' && requestedOrgIdRaw.trim().length > 0
        ? requestedOrgIdRaw.trim()
        : undefined;
    const userIsSuperAdmin = isSuperAdmin(req.user.role);

    // ── Path 1: explicit x-org-id header ───────────────────────────
    if (requestedOrgId) {
      // SUPER_ADMIN can scope to any active org without an org_members
      // row. We still confirm the org exists + is active so we don't
      // 404 downstream queries against a deleted org.
      if (userIsSuperAdmin) {
        const org = await prisma.organization.findFirst({
          where: { id: requestedOrgId, isActive: true },
          select: { id: true },
        });
        if (!org) {
          res.status(404).json({
            type: 'https://aurex.in/errors/no-organization',
            title: 'Not Found',
            status: 404,
            detail: 'Organization not found or inactive',
          });
          return;
        }
        req.orgId = org.id;
        req.orgRole = 'super_admin';
        next();
        return;
      }

      // Non-super_admin: must have an active membership in the requested org.
      const membership = await prisma.orgMember.findFirst({
        where: {
          userId: req.user.sub,
          orgId: requestedOrgId,
          isActive: true,
          org: { isActive: true },
        },
        select: { orgId: true, role: true },
      });
      if (!membership) {
        res.status(403).json({
          type: 'https://aurex.in/errors/no-organization',
          title: 'Forbidden',
          status: 403,
          detail: 'You are not a member of the requested organization',
        });
        return;
      }
      req.orgId = membership.orgId;
      req.orgRole = membership.role;
      next();
      return;
    }

    // ── Path 2: no header — fall back to oldest active membership ──
    const membership = await prisma.orgMember.findFirst({
      where: {
        userId: req.user.sub,
        isActive: true,
        org: { isActive: true },
      },
      orderBy: { createdAt: 'asc' },
      select: { orgId: true, role: true },
    });

    if (membership) {
      req.orgId = membership.orgId;
      req.orgRole = membership.role;
      next();
      return;
    }

    // SUPER_ADMIN with no membership and no header: still a useful
    // fallback (admins shouldn't have to populate memberships in every
    // tenant just to inspect data). Pick the oldest active org globally.
    if (userIsSuperAdmin) {
      const fallbackOrg = await prisma.organization.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (fallbackOrg) {
        req.orgId = fallbackOrg.id;
        req.orgRole = 'super_admin';
        next();
        return;
      }
    }

    res.status(403).json({
      type: 'https://aurex.in/errors/no-organization',
      title: 'Forbidden',
      status: 403,
      detail: 'User is not a member of any organization',
    });
  } catch (err) {
    logger.error({ err, userId: req.user.sub }, 'Failed to resolve org scope');
    next(err);
  }
}
