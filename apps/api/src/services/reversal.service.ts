import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from './audit-log.service.js';

/**
 * A6.4 Reversal Buffer Draw (Phase C, AV4-332).
 *
 * When a removal activity experiences a non-permanence reversal (e.g. a
 * reforestation project loses stored carbon to wildfire), the SB can draw
 * from the activity's REVERSAL_BUFFER holdings to make the registry whole.
 *
 * This service cancels ACTIVE buffer CreditUnitBlocks up to `units` worth,
 * marking them `CANCELLED_REVERSAL` with the evidence narrative attached.
 *
 * If the buffer has insufficient coverage, we throw 409 — the "claw back
 * from activity-participant account" path is explicitly out of scope for
 * this pass (it requires a separate MoP decision).
 */

const REVERSAL_BUFFER_ID = 'a64a0000-0000-4000-8000-000000000003';

export interface ReversalDrawInput {
  activityId: string;
  units: number;
  evidence: string;
  actorUserId: string;
  orgId: string;
}

export interface ReversalDrawResult {
  drawnUnits: number;
  bufferRemaining: number;
  cancelledBlockIds: string[];
  transactionIds: string[];
}

/**
 * Draw `units` from this activity's REVERSAL_BUFFER holdings.
 *
 * Selects buffer blocks oldest-first (FIFO by issuanceDate), splitting the
 * last block only if exact unit-count matching requires it. For simplicity
 * in this pass, we cancel WHOLE blocks — if a block has more units than we
 * need, we still cancel the whole block and record the draw as `unitCount`.
 * Block-splitting is deferred to AV4-333+ once Transaction ledger lands.
 */
export async function draw(input: ReversalDrawInput): Promise<ReversalDrawResult> {
  const { activityId, units, evidence, actorUserId, orgId } = input;

  if (!Number.isFinite(units) || units <= 0 || !Number.isInteger(units)) {
    throw new AppError(400, 'Bad Request', 'units must be a positive integer');
  }
  if (!evidence || evidence.trim().length === 0) {
    throw new AppError(400, 'Bad Request', 'evidence narrative is required');
  }

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, orgId },
  });
  if (!activity) {
    throw new AppError(404, 'Not Found', 'Activity not found');
  }
  if (!activity.isRemoval) {
    throw new AppError(
      400,
      'Bad Request',
      'Buffer draw only valid for removal activities',
    );
  }
  const allowedStatuses = ['REGISTERED', 'ISSUING', 'CLOSED'];
  if (!allowedStatuses.includes(activity.status)) {
    throw new AppError(
      409,
      'Conflict',
      `Activity status is ${activity.status}; expected one of ${allowedStatuses.join(', ')}`,
    );
  }

  // Find ACTIVE buffer blocks for this activity, FIFO
  const bufferBlocks = await prisma.creditUnitBlock.findMany({
    where: {
      activityId,
      holderAccountId: REVERSAL_BUFFER_ID,
      retirementStatus: 'ACTIVE',
    },
    orderBy: { issuanceDate: 'asc' },
  });

  const bufferTotal = bufferBlocks.reduce(
    (sum, b) => sum + Number(b.unitCount),
    0,
  );

  if (bufferTotal < units) {
    throw new AppError(
      409,
      'Conflict',
      `insufficient buffer: have ${bufferTotal}, need ${units}; remainder must come from activity-participant account — out of this pass' scope`,
    );
  }

  // Cancel blocks whole, FIFO, until we've covered `units`.
  // (Partial-block splits deferred — see file header.)
  const toCancel: typeof bufferBlocks = [];
  let covered = 0;
  for (const block of bufferBlocks) {
    if (covered >= units) break;
    toCancel.push(block);
    covered += Number(block.unitCount);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Cancel each block and write a per-block Transaction ledger row in the
    // same loop — avoids re-fetching the block just to read unitCount.
    // AAT-1's Transaction schema is per-block; for an in-place reversal
    // cancellation, fromAccountId === toAccountId (block stays in buffer,
    // but flips to CANCELLED_REVERSAL).
    const cancelledIds: string[] = [];
    const transactionIds: string[] = [];
    for (const block of toCancel) {
      const updated = await tx.creditUnitBlock.update({
        where: { id: block.id },
        data: {
          retirementStatus: 'CANCELLED_REVERSAL',
          retirementNarrative: evidence,
          retiredAt: new Date(),
          retiredBy: actorUserId,
        },
      });
      cancelledIds.push(updated.id);

      const txRow = await tx.transaction.create({
        data: {
          transactionType: 'REVERSAL_DRAW',
          blockId: block.id,
          fromAccountId: REVERSAL_BUFFER_ID,
          toAccountId: REVERSAL_BUFFER_ID, // in-place cancellation
          units: block.unitCount,
          actorUserId,
          narrative: `Reversal draw for activity ${activityId}: ${evidence}`,
        },
      });
      transactionIds.push(txRow.id);
    }

    return { cancelledIds, transactionIds };
  });

  await recordAudit({
    orgId,
    userId: actorUserId,
    action: 'reversal.buffer_drawn',
    resource: 'activity',
    resourceId: activityId,
    newValue: {
      requestedUnits: units,
      drawnUnits: covered,
      cancelledBlockIds: result.cancelledIds,
      bufferRemaining: bufferTotal - covered,
      transactionIds: result.transactionIds,
      evidence,
    },
  });

  return {
    drawnUnits: covered,
    bufferRemaining: bufferTotal - covered,
    cancelledBlockIds: result.cancelledIds,
    transactionIds: result.transactionIds,
  };
}
