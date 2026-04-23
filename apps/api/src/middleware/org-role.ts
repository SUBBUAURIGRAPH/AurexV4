import type { Request, Response, NextFunction } from 'express';

/**
 * Org-Role Middleware
 *
 * Gate a route by the caller's organization-scoped role (OrgMember.role), not
 * the global User.role. Must run AFTER `requireOrgScope`, which populates
 * `req.orgRole` from the user's active OrgMember membership.
 *
 * Both the allowed roles passed by the caller and the role stored on the
 * request are normalized to uppercase so that callers can pass either
 * 'maker' / 'MAKER' / 'Maker' interchangeably.
 *
 * Returns RFC 7807 problem responses on denial.
 */
export function requireOrgRole(...roles: string[]) {
  const allowed = new Set(roles.map((r) => r.toUpperCase()));
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.orgRole) {
      res.status(403).json({
        type: 'https://aurex.in/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Organization role required',
      });
      return;
    }

    if (!allowed.has(String(req.orgRole).toUpperCase())) {
      res.status(403).json({
        type: 'https://aurex.in/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Insufficient organization role',
      });
      return;
    }

    next();
  };
}
