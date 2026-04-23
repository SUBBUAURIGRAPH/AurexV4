import { Router, type IRouter } from 'express';
import { createOrgSchema, updateOrgSchema, addMemberSchema, updateMemberSchema } from '@aurex/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import * as orgService from '../services/organization.service.js';

/**
 * AAT-1: Organization CRUD API
 * All endpoints require authentication.
 * Write operations on orgs/members require org_admin or super_admin role.
 * Org membership is verified at the route level for scoped operations.
 */

export const organizationRouter: IRouter = Router();

/**
 * Helper: verify caller is a member of the target org, or is a super_admin.
 */
async function assertOrgAccess(userId: string, userRole: string, orgId: string): Promise<void> {
  const upperRole = userRole.toUpperCase();
  if (upperRole === 'SUPER_ADMIN') return;

  const isMember = await orgService.isOrgMember(orgId, userId);
  if (!isMember) {
    throw new AppError(403, 'Forbidden', 'You are not a member of this organization');
  }
}

/**
 * POST / — Create organization (top-level or subsidiary).
 * Authorization:
 *   - No parentOrgId: super_admin only.
 *   - With parentOrgId: super_admin OR an ORG_ADMIN of the parent org.
 * The creator is automatically added as ORG_ADMIN of the new org.
 */
organizationRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = createOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Bad Request', parsed.error.errors[0]?.message ?? 'Invalid input');
    }

    const org = await orgService.createOrg(req.user!.sub, req.user!.role, parsed.data);
    res.status(201).json({ data: org });
  } catch (err) {
    next(err);
  }
});

/**
 * GET / — List organizations visible to the caller.
 * Query: ?includeSubsidiaries=true to expand membership to descendants.
 */
organizationRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const includeSubsidiaries = String(req.query.includeSubsidiaries ?? '').toLowerCase() === 'true';
    const orgs = await orgService.listOrgs(req.user!.sub, req.user!.role, { includeSubsidiaries });
    res.json({ data: orgs });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /tree — Hierarchical forest of visible orgs.
 * Must be declared before GET /:id so Express does not match it as an ID.
 */
organizationRouter.get('/tree', requireAuth, async (req, res, next) => {
  try {
    const tree = await orgService.getOrgTree(req.user!.sub, req.user!.role);
    res.json({ data: tree });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:id — Get organization by ID
 * Requires membership (enforced in service via getOrgById).
 */
organizationRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const orgId = String(req.params.id);
    const org = await orgService.getOrgById(orgId, req.user!.sub);
    res.json({ data: org });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /:id — Update organization
 * Requires org_admin or super_admin + org membership.
 */
organizationRouter.patch(
  '/:id',
  requireAuth,
  requireRole('org_admin', 'super_admin', 'ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const orgId = String(req.params.id);
      await assertOrgAccess(req.user!.sub, req.user!.role, orgId);

      const parsed = updateOrgSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, 'Bad Request', parsed.error.errors[0]?.message ?? 'Invalid input');
      }

      const org = await orgService.updateOrg(orgId, parsed.data);
      res.json({ data: org });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /:id/members — List members (paginated)
 * Any org member can list. Pagination clamped to sane bounds.
 */
organizationRouter.get('/:id/members', requireAuth, async (req, res, next) => {
  try {
    const orgId = String(req.params.id);
    await assertOrgAccess(req.user!.sub, req.user!.role, orgId);

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 20));

    const result = await orgService.listMembers(orgId, page, pageSize);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /:id/members — Add member
 * Requires org_admin or super_admin + org membership.
 */
organizationRouter.post(
  '/:id/members',
  requireAuth,
  requireRole('org_admin', 'super_admin', 'ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const orgId = String(req.params.id);
      await assertOrgAccess(req.user!.sub, req.user!.role, orgId);

      const parsed = addMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, 'Bad Request', parsed.error.errors[0]?.message ?? 'Invalid input');
      }

      const member = await orgService.addMember(orgId, parsed.data.email, parsed.data.role);
      res.status(201).json({ data: member });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /:id/members/:memberId — Update member role
 * Requires org_admin or super_admin + org membership.
 */
organizationRouter.patch(
  '/:id/members/:memberId',
  requireAuth,
  requireRole('org_admin', 'super_admin', 'ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const orgId = String(req.params.id);
      const memberId = String(req.params.memberId);
      await assertOrgAccess(req.user!.sub, req.user!.role, orgId);

      const parsed = updateMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, 'Bad Request', parsed.error.errors[0]?.message ?? 'Invalid input');
      }

      const member = await orgService.updateMemberRole(orgId, memberId, parsed.data.role);
      res.json({ data: member });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /:id/members/:memberId — Remove member (soft-delete)
 * Requires org_admin or super_admin + org membership.
 * Service layer prevents removing the last org admin.
 */
organizationRouter.delete(
  '/:id/members/:memberId',
  requireAuth,
  requireRole('org_admin', 'super_admin', 'ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const orgId = String(req.params.id);
      const memberId = String(req.params.memberId);
      await assertOrgAccess(req.user!.sub, req.user!.role, orgId);

      await orgService.removeMember(orgId, memberId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
