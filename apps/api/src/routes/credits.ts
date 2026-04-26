import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { prisma } from '@aurex/database';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import { requireOnboardingComplete } from '../middleware/onboarding-gate.js';
import { requireActiveSubscription } from '../middleware/subscription-active-gate.js';
import { AppError } from '../middleware/error-handler.js';
import * as creditsService from '../services/credits.service.js';
import * as transactionService from '../services/transaction.service.js';
import * as registryLabelService from '../services/registry-label.service.js';

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

/**
 * GET /blocks (AAT-9C / Wave 9c) — paginated list of CreditUnitBlocks for
 * the caller's org, optionally filtered by accountId. Persistence audit
 * P0: the audit found no list endpoint for blocks per org / per account
 * — only single-block lookup by `:serialFirst`. The "Credits" dashboard
 * had no list source.
 *
 * Org-scoping uses the holder account's `orgId` (single-tenant per org),
 * matching the existing `getBlockBySerialRange` pattern.
 */
const listBlocksQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

creditsRouter.get('/blocks', async (req, res, next) => {
  try {
    const { accountId, page, pageSize } = listBlocksQuerySchema.parse(req.query);
    const where = {
      holderAccount: { orgId: req.orgId! },
      ...(accountId ? { holderAccountId: accountId } : {}),
    };
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.creditUnitBlock.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { issuanceDate: 'desc' },
        include: {
          holderAccount: { select: { id: true, name: true, accountType: true } },
        },
      }),
      prisma.creditUnitBlock.count({ where }),
    ]);

    res.json({ data: { items, total, page, pageSize } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /blocks/:serialFirst — lookup block by its first serial number.
 *
 * AAT-R1 / AV4-422: the response includes the new CORSIA-labelling fields
 * `corsiaPhaseEligibility` (null | "phase1" | "phase2" | "phase2_authorized_imp")
 * and `articleSixAuthorizedAt` populated by `registry-label.service.applyCorsiaLabels`.
 */
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
  requireOnboardingComplete, requireActiveSubscription,
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
  requireOnboardingComplete, requireActiveSubscription,
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

/**
 * GET /blocks/:id/registry-label — voluntary-registry label JSON for a
 * block (AV4-333). Scaffold — see registry-label.service for rollout note.
 * Org-scope gated: only the block's holder org can fetch the label.
 */
creditsRouter.get('/blocks/:id/registry-label', async (req, res, next) => {
  try {
    const label = await registryLabelService.generateLabel(
      req.params.id as string,
      req.orgId!,
    );
    res.json({ data: label });
  } catch (err) {
    next(err);
  }
});
