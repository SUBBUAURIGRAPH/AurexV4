import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import * as transactionService from './transaction.service.js';

/**
 * Read-side for A6.4 credit units + accounts.
 * Transfers/retirements (Phase C) delegate to transaction.service.
 */

export async function listOrgAccounts(orgId: string) {
  return prisma.creditAccount.findMany({
    where: { orgId, isActive: true },
    include: {
      activity: { select: { id: true, title: true, status: true } },
      _count: { select: { holdings: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getAccountHoldings(accountId: string, orgId: string) {
  const account = await prisma.creditAccount.findFirst({
    where: { id: accountId, orgId },
    include: {
      holdings: {
        orderBy: { issuanceDate: 'desc' },
      },
    },
  });
  if (!account) throw new AppError(404, 'Not Found', 'Account not found');

  // Aggregate summary — "balance" per unit type / vintage / retirement status
  const active = account.holdings.filter((h) => h.retirementStatus === 'ACTIVE');
  const byType = active.reduce<Record<string, number>>((acc, h) => {
    acc[h.unitType] = (acc[h.unitType] ?? 0) + Number(h.unitCount);
    return acc;
  }, {});
  const totalActive = active.reduce((sum, h) => sum + Number(h.unitCount), 0);

  return {
    account,
    summary: {
      totalActive,
      byType,
      blockCount: account.holdings.length,
    },
  };
}

export async function getBlockBySerialRange(serialFirst: string, orgId: string) {
  const block = await prisma.creditUnitBlock.findFirst({
    where: {
      serialFirst,
      holderAccount: { orgId },
    },
    include: {
      holderAccount: { select: { id: true, name: true, accountType: true } },
    },
  });
  if (!block) throw new AppError(404, 'Not Found', 'Credit unit block not found');
  return block;
}

/**
 * Retire units within an account — delegates to transaction.service.
 * Phase C adds purpose enum (NDC / OIMP / VOLUNTARY) and CA event emission.
 * `purpose` defaults to VOLUNTARY for backward compat with pre-Phase-C callers.
 */
export async function retireBlock(
  blockId: string,
  orgId: string,
  userId: string,
  narrative: string,
  purpose: transactionService.RetirementPurpose = 'VOLUNTARY',
) {
  return transactionService.retireBlock(blockId, purpose, narrative, userId, orgId);
}
