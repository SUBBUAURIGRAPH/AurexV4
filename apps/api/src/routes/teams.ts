/**
 * Teams routes — /api/v1/teams
 *
 * All endpoints require auth + org-scope. Org admin gating is enforced
 * inline (per ADM-068's avoid-magic-middleware-stacks-on-write-paths
 * pattern from the emissions router).
 *
 * GET    /              — list teams in current org (any active member)
 * POST   /              — create (ORG_ADMIN+)
 * GET    /:id           — full detail with members (any active member)
 * PATCH  /:id           — name / description / defaultRole / status (ORG_ADMIN+)
 * DELETE /:id           — cascade-delete (ORG_ADMIN+)
 * POST   /:id/members   — add member by userId (ORG_ADMIN+)
 * DELETE /:id/members/:userId — remove (ORG_ADMIN+)
 */
import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import { AppError } from '../middleware/error-handler.js';
import * as teamService from '../services/team.service.js';

export const teamsRouter: IRouter = Router();

const ROLE_VALUES = ['VIEWER', 'MAKER', 'CHECKER', 'APPROVER', 'AUDITOR', 'ANALYST', 'ORG_ADMIN'] as const;
const STATUS_VALUES = ['ACTIVE', 'IN_REVIEW', 'ARCHIVED'] as const;

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).nullish(),
  defaultRole: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .pipe(z.enum(ROLE_VALUES))
    .optional(),
  status: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .pipe(z.enum(STATUS_VALUES))
    .optional(),
  memberUserIds: z.array(z.string().uuid()).optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(500).nullish(),
  defaultRole: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .pipe(z.enum(ROLE_VALUES))
    .optional(),
  status: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .pipe(z.enum(STATUS_VALUES))
    .optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
});

teamsRouter.use(requireAuth);
teamsRouter.use(requireOrgScope);

teamsRouter.get('/', async (req, res, next) => {
  try {
    const teams = await teamService.listTeams(req.orgId!);
    res.json({ data: teams });
  } catch (err) {
    next(err);
  }
});

teamsRouter.post(
  '/',
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const input = createSchema.parse(req.body ?? {});
      const team = await teamService.createTeam(req.orgId!, req.user!.sub, input);
      res.status(201).json({ data: team });
    } catch (err) {
      next(err);
    }
  },
);

teamsRouter.get('/:id', async (req, res, next) => {
  try {
    const team = await teamService.getTeam(req.params.id as string, req.orgId!);
    res.json({ data: team });
  } catch (err) {
    next(err);
  }
});

teamsRouter.patch(
  '/:id',
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const input = updateSchema.parse(req.body ?? {});
      const team = await teamService.updateTeam(req.params.id as string, req.orgId!, input);
      res.json({ data: team });
    } catch (err) {
      next(err);
    }
  },
);

teamsRouter.delete(
  '/:id',
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      await teamService.deleteTeam(req.params.id as string, req.orgId!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

teamsRouter.post(
  '/:id/members',
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { userId } = addMemberSchema.parse(req.body ?? {});
      const team = await teamService.addMember(
        req.params.id as string,
        req.orgId!,
        userId,
      );
      res.json({ data: team });
    } catch (err) {
      next(err);
    }
  },
);

teamsRouter.delete(
  '/:id/members/:userId',
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const teamId = req.params.id as string;
      const userId = req.params.userId as string;
      if (!/^[0-9a-f-]{36}$/i.test(userId)) {
        throw new AppError(400, 'Bad Request', 'userId must be a UUID');
      }
      const team = await teamService.removeMember(teamId, req.orgId!, userId);
      res.json({ data: team });
    } catch (err) {
      next(err);
    }
  },
);
