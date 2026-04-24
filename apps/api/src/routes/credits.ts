import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { prisma } from '@aurex/database';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import { AppError } from '../middleware/error-handler.js';
import * as creditsService from '../services/credits.service.js';
import * as transactionService from '../services/transaction.service.js';

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

/** POST /blocks/:id/retire — NDC / OIMP / voluntary retirement (ORG_ADMIN only) */
const retireSchema = z.object({
  narrative: z.string().min(1).max(2000),
  purpose: z.enum(['NDC', 'OIMP', 'VOLUNTARY']).optional().default('VOLUNTARY'),
});

creditsRouter.post(
  '/blocks/:id/retire',
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { narrative, purpose } = retireSchema.parse(req.body);
      const row = await creditsService.retireBlock(
        req.params.id as string,
        req.orgId!,
        req.user!.sub,
        narrative,
        purpose,
      );
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /blocks/:id/transfer — move a block to another CreditAccount.
 * Full-block transfers only; serial-range splitting is future work.
 * ORG_ADMIN / SUPER_ADMIN only.
 */
const transferSchema = z.object({
  toAccountId: z.string().uuid(),
  units: z.number().positive().optional(),
});

creditsRouter.post(
  '/blocks/:id/transfer',
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { toAccountId, units } = transferSchema.parse(req.body);
      const blockId = req.params.id as string;

      // Serial-range split is future work — for now reject any `units` param
      // that doesn't match the block's full unitCount.
      if (units !== undefined) {
        const block = await prisma.creditUnitBlock.findUnique({
          where: { id: blockId },
          select: { unitCount: true },
        });
        if (!block) throw new AppError(404, 'Not Found', 'Block not found');
        if (Number(block.unitCount) !== units) {
          throw new AppError(
            400,
            'Bad Request',
            'Partial transfers not yet supported; units must equal full block unitCount',
          );
        }
      }

      const result = await transactionService.transferBlock(
        blockId,
        toAccountId,
        req.user!.sub,
        req.orgId!,
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);
