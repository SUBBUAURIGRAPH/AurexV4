import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import * as creditsService from '../services/credits.service.js';

export const creditsRouter: IRouter = Router();

creditsRouter.use(requireAuth, requireOrgScope);

/** GET /accounts — list org's credit accounts (activity participant + host party) */
creditsRouter.get('/accounts', async (req, res, next) => {
  try {
    const rows = await creditsService.listOrgAccounts(req.orgId!);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/** GET /accounts/:id — account holdings + summary */
creditsRouter.get('/accounts/:id', async (req, res, next) => {
  try {
    const row = await creditsService.getAccountHoldings(req.params.id as string, req.orgId!);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/** GET /blocks/:serialFirst — lookup block by its first serial number */
creditsRouter.get('/blocks/:serialFirst', async (req, res, next) => {
  try {
    const row = await creditsService.getBlockBySerialRange(
      req.params.serialFirst as string,
      req.orgId!,
    );
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/** POST /blocks/:id/retire — voluntary retirement (ORG_ADMIN only) */
const retireSchema = z.object({ narrative: z.string().min(1).max(2000) });

creditsRouter.post(
  '/blocks/:id/retire',
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { narrative } = retireSchema.parse(req.body);
      const row = await creditsService.retireBlock(
        req.params.id as string,
        req.orgId!,
        req.user!.sub,
        narrative,
      );
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);
