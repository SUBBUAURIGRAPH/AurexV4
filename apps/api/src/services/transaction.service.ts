import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from './audit-log.service.js';
import * as caEvents from './ca-events.service.js';

/**
 * Article 6.4 — transfer + retirement engine.
 *
 * - Transfers move a block's holderAccountId (full-block only for this pass).
 * - On the first transfer of an authorized A6.4ER block, a CA event fires.
 * - Retirements park the block in one of three SB admin retirement accounts
 *   (NDC / OIMP / VOLUNTARY) and set the matching terminal retirementStatus.
 * - NDC/OIMP retirements of authorized A6.4ER blocks also fire a CA event.
 *
 * Every operation appends a Transaction row for audit + registry history.
 */

// SB-managed retirement admin accounts — seeded via seed-master-data.ts.
export const RETIREMENT_NDC_ID       = 'a64a0000-0000-4000-8000-000000000004';
export const RETIREMENT_OIMP_ID      = 'a64a0000-0000-4000-8000-000000000005';
export const RETIREMENT_VOLUNTARY_ID = 'a64a0000-0000-4000-8000-000000000006';

export type RetirementPurpose = 'NDC' | 'OIMP' | 'VOLUNTARY';

/**
 * Pure mapping: retirement purpose → terminal RetirementStatus enum + target
 * admin account id. Exported for unit testing.
 */
export function purposeToRetirementState(purpose: RetirementPurpose): {
  status: 'RETIRED_FOR_NDC' | 'RETIRED_FOR_OIMP' | 'RETIRED_VOLUNTARY';
  accountId: string;
} {
  switch (purpose) {
    case 'NDC':
      return { status: 'RETIRED_FOR_NDC', accountId: RETIREMENT_NDC_ID };
    case 'OIMP':
      return { status: 'RETIRED_FOR_OIMP', accountId: RETIREMENT_OIMP_ID };
    case 'VOLUNTARY':
      return { status: 'RETIRED_VOLUNTARY', accountId: RETIREMENT_VOLUNTARY_ID };
  }
}

// ─── Transfer ───────────────────────────────────────────────────────────────

export interface TransferResult {
  block: Awaited<ReturnType<typeof prisma.creditUnitBlock.update>>;
  caEvent: caEvents.CaEventResult | null;
}

/**
 * Transfer a block (full-block only — serial range splitting is future work)
 * from its current holderAccount to `toAccountId`.
 *
 * - Block must be ACTIVE.
 * - Caller's org must own the currently-holding account.
 * - Target account must be active.
 * - If this is the first transfer (firstTransferAt was null) AND the block is
 *   an authorized A6.4ER with international scope, a CA event is emitted.
 */
export async function transferBlock(
  blockId: string,
  toAccountId: string,
  actorUserId: string,
  orgId: string,
): Promise<TransferResult> {
  const block = await prisma.creditUnitBlock.findUnique({
    where: { id: blockId },
    include: { holderAccount: true },
  });
  if (!block) throw new AppError(404, 'Not Found', 'Block not found');

  // Org-ownership check via the current holder account. Admin accounts have
  // orgId=null and thus can't be transferred from by any org user.
  if (!block.holderAccount.orgId || block.holderAccount.orgId !== orgId) {
    throw new AppError(404, 'Not Found', 'Block not found');
  }

  if (block.retirementStatus !== 'ACTIVE') {
    throw new AppError(409, 'Conflict', `Block is ${block.retirementStatus}, cannot transfer`);
  }

  if (block.holderAccountId === toAccountId) {
    throw new AppError(400, 'Bad Request', 'Source and target account are the same');
  }

  const toAccount = await prisma.creditAccount.findUnique({ where: { id: toAccountId } });
  if (!toAccount) throw new AppError(404, 'Not Found', 'Target account not found');
  if (!toAccount.isActive) {
    throw new AppError(409, 'Conflict', 'Target account is not active');
  }

  const isFirstTransfer = block.firstTransferAt === null;
  const fromAccountId = block.holderAccountId;

  const shouldEmitCa =
    isFirstTransfer &&
    block.unitType === 'A6_4ER' &&
    (block.authorizationStatus === 'NDC_USE' ||
      block.authorizationStatus === 'OIMP' ||
      block.authorizationStatus === 'NDC_AND_OIMP');

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.creditUnitBlock.update({
      where: { id: blockId },
      data: {
        holderAccountId: toAccountId,
        ...(isFirstTransfer ? { firstTransferAt: new Date() } : {}),
      },
    });

    await tx.transaction.create({
      data: {
        transactionType: 'TRANSFER',
        blockId,
        fromAccountId,
        toAccountId,
        units: block.unitCount,
        actorUserId,
        narrative: isFirstTransfer
          ? `First international transfer (${block.unitType})`
          : `Transfer (${block.unitType})`,
      },
    });

    return updated;
  });

  let caEvent: caEvents.CaEventResult | null = null;
  if (shouldEmitCa) {
    caEvent = await caEvents.emitOnFirstTransfer(
      blockId,
      toAccount.hostCountry ?? null,
      Number(block.unitCount),
      actorUserId,
    );
    // Link the CA event back to the transaction row we just created.
    if (caEvent) {
      await prisma.transaction.updateMany({
        where: { blockId, transactionType: 'TRANSFER', caEventId: null },
        data: { caEventId: caEvent.id },
      });
    }
  }

  await recordAudit({
    orgId,
    userId: actorUserId,
    action: 'credit_block.transferred',
    resource: 'credit_unit_block',
    resourceId: blockId,
    oldValue: { holderAccountId: fromAccountId },
    newValue: {
      holderAccountId: toAccountId,
      firstTransfer: isFirstTransfer,
      caEventId: caEvent?.id ?? null,
    },
  });

  return { block: result, caEvent };
}

// ─── Retirement ─────────────────────────────────────────────────────────────

export interface RetireResult {
  block: Awaited<ReturnType<typeof prisma.creditUnitBlock.update>>;
  caEvent: caEvents.CaEventResult | null;
}

/**
 * Retire a block to the matching SB admin retirement account.
 *
 * - Block must be ACTIVE and currently held by an account owned by `orgId`.
 * - Purpose (NDC / OIMP / VOLUNTARY) selects both the terminal
 *   retirementStatus and the target admin account.
 * - If purpose is NDC or OIMP AND the block is an authorized A6.4ER, a CA
 *   event is emitted in addition to the ledger row.
 */
export async function retireBlock(
  blockId: string,
  purpose: RetirementPurpose,
  narrative: string,
  actorUserId: string,
  orgId: string,
): Promise<RetireResult> {
  const block = await prisma.creditUnitBlock.findUnique({
    where: { id: blockId },
    include: { holderAccount: true },
  });
  if (!block) throw new AppError(404, 'Not Found', 'Block not found');
  if (!block.holderAccount.orgId || block.holderAccount.orgId !== orgId) {
    throw new AppError(404, 'Not Found', 'Block not found');
  }
  if (block.retirementStatus !== 'ACTIVE') {
    throw new AppError(409, 'Conflict', `Block is already ${block.retirementStatus}`);
  }

  const { status, accountId } = purposeToRetirementState(purpose);
  const fromAccountId = block.holderAccountId;
  const now = new Date();

  const shouldEmitCa =
    (purpose === 'NDC' || purpose === 'OIMP') &&
    block.unitType === 'A6_4ER' &&
    block.authorizationStatus !== 'MITIGATION_CONTRIBUTION';

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.creditUnitBlock.update({
      where: { id: blockId },
      data: {
        holderAccountId: accountId,
        retirementStatus: status,
        retirementNarrative: narrative,
        retiredAt: now,
        retiredBy: actorUserId,
      },
    });

    await tx.transaction.create({
      data: {
        transactionType: 'RETIREMENT',
        blockId,
        fromAccountId,
        toAccountId: accountId,
        units: block.unitCount,
        actorUserId,
        narrative: `Retired for ${purpose}: ${narrative}`,
      },
    });

    return row;
  });

  let caEvent: caEvents.CaEventResult | null = null;
  if (shouldEmitCa) {
    caEvent = await caEvents.emitOnRetirement(
      blockId,
      purpose as 'NDC' | 'OIMP',
      actorUserId,
    );
    if (caEvent) {
      await prisma.transaction.updateMany({
        where: { blockId, transactionType: 'RETIREMENT', caEventId: null },
        data: { caEventId: caEvent.id },
      });
    }
  }

  await recordAudit({
    orgId,
    userId: actorUserId,
    action: 'credit_block.retired',
    resource: 'credit_unit_block',
    resourceId: blockId,
    oldValue: { retirementStatus: 'ACTIVE' },
    newValue: {
      retirementStatus: status,
      purpose,
      caEventId: caEvent?.id ?? null,
    },
  });

  return { block: updated, caEvent };
}
