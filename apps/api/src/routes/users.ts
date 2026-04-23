import { Router, type IRouter } from 'express';
import { createUserSchema, listUsersQuerySchema, updateUserSchema } from '@aurex/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { logger } from '../lib/logger.js';
import * as userService from '../services/user.service.js';

export const userRouter: IRouter = Router();

/**
 * POST / — Create a user and add them to the caller's org (admin only).
 * Generates a one-time temporary password returned in the response so the
 * admin can share it with the new user; password should be rotated on first
 * login. If the email already exists, the user is linked to this org instead
 * of being recreated.
 */
userRouter.post(
  '/',
  requireAuth,
  requireOrgScope,
  requireRole('org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const data = createUserSchema.parse(req.body);

      const result = await userService.createUserForOrg({
        orgId: req.orgId!,
        email: data.email,
        name: data.name,
        role: data.role,
        callerRole: req.user!.role,
      });

      logger.info(
        { userId: result.id, orgId: req.orgId, invitedBy: req.user!.sub },
        'User added via admin API',
      );
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET / — List users in the caller's org
 * Query: search, role, isActive, page, pageSize, sort, order
 */
userRouter.get('/', requireAuth, requireOrgScope, async (req, res, next) => {
  try {
    const parsed = listUsersQuerySchema.parse(req.query);

    const result = await userService.listUsers({
      orgId: req.orgId!,
      search: parsed.search,
      role: parsed.role,
      isActive: parsed.isActive,
      page: parsed.page,
      pageSize: parsed.pageSize,
      sort: parsed.sort,
      order: parsed.order,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:id — Get user by ID
 */
userRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const user = await userService.getUserById(id);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /:id — Update user (admin only)
 * Validates with updateUserSchema. Prevents role escalation above own role.
 */
userRouter.patch(
  '/:id',
  requireAuth,
  requireRole('org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const id = req.params.id as string;
      const data = updateUserSchema.parse(req.body);

      const updated = await userService.updateUser(
        id,
        data,
        req.user!.role,
      );

      logger.info({ userId: id, updatedBy: req.user!.sub }, 'User update via API');
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /:id — Soft delete user (admin only)
 * Sets isActive=false.
 */
userRouter.delete(
  '/:id',
  requireAuth,
  requireRole('org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const id = req.params.id as string;
      await userService.softDeleteUser(id);

      logger.info({ userId: id, deletedBy: req.user!.sub }, 'User soft-deleted via API');
      res.json({ message: 'User deactivated' });
    } catch (err) {
      next(err);
    }
  },
);
