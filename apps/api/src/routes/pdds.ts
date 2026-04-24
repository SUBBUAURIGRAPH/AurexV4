import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import * as pddService from '../services/pdd.service.js';

/**
 * AV4-335: PDD (Project Design Document) routes.
 *
 * Layout:
 *   GET  /pdds/:activityId             → fetch current PDD
 *   PUT  /pdds/:activityId             → upsert content (MANAGER+); 409 if locked
 *   GET  /pdds/:activityId/versions    → version history
 *   POST /pdds/:activityId/submit      → lock the current version
 */
export const pddsRouter: IRouter = Router();

pddsRouter.use(requireAuth, requireOrgScope);

const WRITE_ROLES = ['ORG_ADMIN', 'MANAGER', 'SUPER_ADMIN'];

const upsertSchema = z.object({
  content: z.unknown(),
});

pddsRouter.get('/:activityId', async (req, res, next) => {
  try {
    const pdd = await pddService.getPdd(req.params.activityId as string, req.orgId!);
    res.json({ data: pdd });
  } catch (err) {
    next(err);
  }
});

pddsRouter.get('/:activityId/versions', async (req, res, next) => {
  try {
    const versions = await pddService.listPddVersions(
      req.params.activityId as string,
      req.orgId!,
    );
    res.json({ data: versions });
  } catch (err) {
    next(err);
  }
});

pddsRouter.put('/:activityId', requireOrgRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const body = upsertSchema.parse(req.body);
    const pdd = await pddService.upsertPdd({
      activityId: req.params.activityId as string,
      orgId: req.orgId!,
      content: body.content,
      userId: req.user!.sub,
    });
    res.json({ data: pdd });
  } catch (err) {
    next(err);
  }
});

pddsRouter.post(
  '/:activityId/submit',
  requireOrgRole(...WRITE_ROLES),
  async (req, res, next) => {
    try {
      const pdd = await pddService.submitPdd(
        req.params.activityId as string,
        req.orgId!,
        req.user!.sub,
      );
      res.json({ data: pdd });
    } catch (err) {
      next(err);
    }
  },
);
