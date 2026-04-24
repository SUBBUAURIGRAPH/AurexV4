import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import * as issuanceService from '../services/issuance.service.js';

export const issuanceRouter: IRouter = Router();

issuanceRouter.use(requireAuth, requireOrgScope);

const WRITE_ROLES = ['ORG_ADMIN', 'MANAGER', 'SUPER_ADMIN'];
const APPROVE_ROLES = ['ORG_ADMIN', 'SUPER_ADMIN'];

/** POST /periods/:periodId/issuance — request issuance (manager+) */
issuanceRouter.post('/periods/:periodId', requireOrgRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const row = await issuanceService.requestIssuance(
      req.params.periodId as string,
      req.orgId!,
      req.user!.sub,
    );
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

/** POST /:id/approve — mint credit units with SOP/OMGE levies (ORG_ADMIN) */
issuanceRouter.post('/:id/approve', requireOrgRole(...APPROVE_ROLES), async (req, res, next) => {
  try {
    const result = await issuanceService.approveIssuance(
      req.params.id as string,
      req.orgId!,
      req.user!.sub,
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

const rejectSchema = z.object({ reason: z.string().min(1).max(2000) });

issuanceRouter.post('/:id/reject', requireOrgRole(...APPROVE_ROLES), async (req, res, next) => {
  try {
    const { reason } = rejectSchema.parse(req.body);
    const row = await issuanceService.rejectIssuance(
      req.params.id as string,
      req.orgId!,
      req.user!.sub,
      reason,
    );
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/** GET /activities/:activityId — list issuances for an activity */
issuanceRouter.get('/activities/:activityId', async (req, res, next) => {
  try {
    const rows = await issuanceService.listIssuances(
      req.params.activityId as string,
      req.orgId!,
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});
