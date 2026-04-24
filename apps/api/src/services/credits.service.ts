import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';

/**
 * Read-side for A6.4 credit units + accounts.
 * Transfers/retirements are Phase C — stubbed here.
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
 * Retire units within an account — voluntary retirement path.
 * Phase C will extend this for NDC / OIMP retirements with CA events.
 */
export async function retireBlock(
  blockId: string,
  orgId: string,
  userId: string,
  narrative: string,
) {
  const block = await prisma.creditUnitBlock.findUnique({
    where: { id: blockId },
    include: { holderAccount: true },
  });
  if (!block) throw new AppError(404, 'Not Found', 'Block not found');
  if (block.holderAccount.orgId !== orgId) {
    throw new AppError(404, 'Not Found', 'Block not found');
  }
  if (block.retirementStatus !== 'ACTIVE') {
    throw new AppError(409, 'Conflict', `Block is already ${block.retirementStatus}`);
  }
  return prisma.creditUnitBlock.update({
    where: { id: blockId },
    data: {
      retirementStatus: 'RETIRED_VOLUNTARY' as never,
      retirementNarrative: narrative,
      retiredAt: new Date(),
      retiredBy: userId,
    },
  });
}
