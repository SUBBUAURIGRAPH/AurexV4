import { Router, type IRouter } from 'express';
import { enableRecipeSchema } from '@aurex/shared';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import * as workflowService from '../services/workflow-recipe.service.js';

/**
 * Workflow Recipe API (Phase C).
 *
 * Routes:
 *   GET    /recipes                          list all active recipes
 *   GET    /enablements                      list this org's enablements
 *   POST   /enablements                      enable a recipe for a resource type (ORG_ADMIN+)
 *   DELETE /enablements/:resourceType        disable — falls back to default quorum (ORG_ADMIN+)
 */
export const workflowsRouter: IRouter = Router();

const ADMIN_ROLES = ['ORG_ADMIN', 'SUPER_ADMIN'];

workflowsRouter.get('/recipes', requireAuth, async (_req, res, next) => {
  try {
    const rows = await workflowService.listRecipes();
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

workflowsRouter.get(
  '/enablements',
  requireAuth,
  requireOrgScope,
  async (req, res, next) => {
    try {
      const rows = await workflowService.listOrgEnablements(req.orgId!);
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.post(
  '/enablements',
  requireAuth,
  requireOrgScope,
  requireOrgRole(...ADMIN_ROLES),
  async (req, res, next) => {
    try {
      const data = enableRecipeSchema.parse(req.body);
      const row = await workflowService.enableRecipe({
        orgId: req.orgId!,
        userId: req.user!.sub,
        resourceType: data.resourceType,
        recipeCode: data.recipeCode,
        ipAddress: req.ip,
      });
      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.delete(
  '/enablements/:resourceType',
  requireAuth,
  requireOrgScope,
  requireOrgRole(...ADMIN_ROLES),
  async (req, res, next) => {
    try {
      await workflowService.disableRecipe({
        orgId: req.orgId!,
        userId: req.user!.sub,
        resourceType: req.params.resourceType as string,
        ipAddress: req.ip,
      });
      res.json({ message: 'Workflow recipe disabled' });
    } catch (err) {
      next(err);
    }
  },
);
