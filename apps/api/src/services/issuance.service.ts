import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from './audit-log.service.js';
import * as activityService from './activity.service.js';

/**
 * A6.4 issuance with automatic Share-of-Proceeds + OMGE levies.
 *
 * Per A6.4 rules (Decision 3/CMA.3 para 67-68):
 *   - 5% SOP in-kind to the Adaptation Fund
 *   - 2% OMGE automatic cancellation ("overall mitigation in global emissions")
 *   - Net 93% to the activity-participant account
 *
 * Levies are applied at issuance before any first transfer. Rounding:
 * the registry transacts in whole tCO2e only; fractional units are
 * discarded (floored) at each levy step.
 */

export const SOP_RATE = 0.05;  // 5%
export const OMGE_RATE = 0.02; // 2%

const ADAPTATION_FUND_ID = 'a64a0000-0000-4000-8000-000000000001';
const OMGE_CANCELLATION_ID = 'a64a0000-0000-4000-8000-000000000002';
const REVERSAL_BUFFER_ID = 'a64a0000-0000-4000-8000-000000000003';

/**
 * Default buffer contribution for removal activities — 20% of NET units
 * are parked in the REVERSAL_BUFFER admin account as ACTIVE (drawable).
 * Override per-activity via Activity.bufferPoolContributionPct.
 */
export const DEFAULT_BUFFER_PCT = 20;

export interface BufferSplit {
  participantUnits: number;
  bufferUnits: number;
}

/**
 * Pure function: given NET units + pct (0–100), compute how many go to the
 * REVERSAL_BUFFER admin account vs. the activity-participant account.
 * Buffer is floored; participant absorbs any rounding residue.
 */
export function splitNetForBuffer(netInt: number, pct: number): BufferSplit {
  if (netInt < 0 || !Number.isFinite(netInt)) {
    throw new Error('netInt must be a non-negative finite number');
  }
  if (pct < 0 || pct > 100 || !Number.isFinite(pct)) {
    throw new Error('pct must be between 0 and 100 inclusive');
  }
  const bufferUnits = Math.floor((netInt * pct) / 100);
  const participantUnits = netInt - bufferUnits;
  return { participantUnits, bufferUnits };
}

export interface LevyBreakdown {
  gross: number;
  sop: number;
  omge: number;
  net: number;
}

/**
 * Pure function: gross tCO2e → {gross, sop, omge, net} with integer rounding.
 * SOP is floored down; OMGE is floored down; net = gross − sop − omge.
 * (This keeps levies conservative — Adaptation Fund never receives more than
 * 5% via rounding drift.)
 */
export function calculateLevies(gross: number): LevyBreakdown {
  if (gross < 0 || !Number.isFinite(gross)) {
    throw new Error('gross must be a non-negative finite number');
  }
  const grossInt = Math.floor(gross);
  const sop = Math.floor(grossInt * SOP_RATE);
  const omge = Math.floor(grossInt * OMGE_RATE);
  const net = grossInt - sop - omge;
  return { gross: grossInt, sop, omge, net };
}

// ─── Issuance request + approval ───────────────────────────────────────

export async function requestIssuance(
  periodId: string,
  orgId: string,
  userId: string,
) {
  const period = await prisma.monitoringPeriod.findUnique({
    where: { id: periodId },
    include: {
      activity: { include: { hostAuthorization: true } },
      verificationReport: true,
    },
  });
  if (!period || period.activity.orgId !== orgId) {
    throw new AppError(404, 'Not Found', 'Monitoring period not found');
  }
  if (period.status !== 'VERIFIED') {
    throw new AppError(409, 'Conflict', `Period status is ${period.status}; expected VERIFIED`);
  }
  if (!period.verificationReport) {
    throw new AppError(400, 'Bad Request', 'Verification report missing');
  }
  if (!period.activity.hostAuthorization || period.activity.hostAuthorization.status !== 'ISSUED') {
    throw new AppError(400, 'Bad Request', 'Host authorization must be ISSUED before issuance');
  }
  if (period.activity.status !== 'REGISTERED' && period.activity.status !== 'ISSUING') {
    throw new AppError(409, 'Conflict', `Activity status is ${period.activity.status}; expected REGISTERED or ISSUING`);
  }

  const existing = await prisma.issuance.findUnique({ where: { periodId } });
  if (existing) throw new AppError(409, 'Conflict', 'Issuance already exists for this period');

  const verifiedEr = Number(period.verificationReport.verifiedEr);
  const levies = calculateLevies(verifiedEr);

  // MITIGATION_CONTRIBUTION scope → A6.4ER_MC (non-transferable, no CA)
  const unitType =
    period.activity.hostAuthorization.authorizedFor === 'MITIGATION_CONTRIBUTION'
      ? 'A6_4ER_MC'
      : 'A6_4ER';

  const vintage = new Date(period.periodEnd).getUTCFullYear();

  const issuance = await prisma.issuance.create({
    data: {
      activityId: period.activityId,
      periodId,
      grossUnits: levies.gross,
      sopLevyUnits: levies.sop,
      omgeCancelledUnits: levies.omge,
      netUnits: levies.net,
      vintage,
      unitType: unitType as never,
      status: 'REQUESTED' as never,
      requestedBy: userId,
    },
  });

  await recordAudit({
    orgId,
    userId,
    action: 'issuance.requested',
    resource: 'issuance',
    resourceId: issuance.id,
    newValue: {
      gross: levies.gross,
      sop: levies.sop,
      omge: levies.omge,
      net: levies.net,
      unitType,
      vintage,
    },
  });
  return issuance;
}

/**
 * Approve + mint. Creates a CreditUnitBlock in the activity-participant
 * account for the NET units, and records the levies against the admin
 * accounts. Marks the monitoring period ISSUED and transitions the activity
 * to ISSUING.
 */
export async function approveIssuance(
  issuanceId: string,
  orgId: string,
  approverUserId: string,
) {
  const issuance = await prisma.issuance.findUnique({
    where: { id: issuanceId },
    include: {
      activity: { include: { hostAuthorization: true, creditAccount: true } },
      period: true,
    },
  });
  if (!issuance) throw new AppError(404, 'Not Found', 'Issuance not found');
  if (issuance.activity.orgId !== orgId) {
    throw new AppError(404, 'Not Found', 'Issuance not found');
  }
  if (issuance.status !== 'REQUESTED') {
    throw new AppError(409, 'Conflict', `Issuance status is ${issuance.status}`);
  }
  if (!issuance.activity.creditAccount) {
    throw new AppError(500, 'Internal Server Error', 'Activity participant account missing');
  }

  const serialPrefix = `A64-${issuance.activity.hostCountry}-${issuance.activity.id.slice(0, 8)}-V${issuance.vintage}`;
  const netInt = Number(issuance.netUnits);
  const sopInt = Number(issuance.sopLevyUnits);
  const omgeInt = Number(issuance.omgeCancelledUnits);

  // Removal buffer deposit (Phase C, AV4-330) — removal activities park a
  // percentage of NET units in the REVERSAL_BUFFER admin account, leaving
  // the remainder for the activity-participant account. Buffer units are
  // ACTIVE (drawable on reversal), not cancelled.
  const isRemoval = issuance.activity.isRemoval === true;
  const bufferPct = isRemoval
    ? Number(issuance.activity.bufferPoolContributionPct ?? DEFAULT_BUFFER_PCT)
    : 0;
  const { participantUnits, bufferUnits } = isRemoval
    ? splitNetForBuffer(netInt, bufferPct)
    : { participantUnits: netInt, bufferUnits: 0 };

  const result = await prisma.$transaction(async (tx) => {
    // NET block → activity participant (participantUnits after buffer split)
    const netBlock = participantUnits > 0
      ? await tx.creditUnitBlock.create({
          data: {
            serialFirst: `${serialPrefix}-N-0000000001`,
            serialLast: `${serialPrefix}-N-${String(participantUnits).padStart(10, '0')}`,
            unitCount: participantUnits,
            unitType: issuance.unitType,
            vintage: issuance.vintage,
            activityId: issuance.activityId,
            hostCountry: issuance.activity.hostCountry,
            issuanceDate: new Date(),
            holderAccountId: issuance.activity.creditAccount!.id,
            authorizationStatus: issuance.activity.hostAuthorization!.authorizedFor,
            caStatus: issuance.unitType === 'A6_4ER_MC' ? 'NOT_REQUIRED' : 'PENDING',
            retirementStatus: 'ACTIVE',
          },
        })
      : null;

    // BUFFER block → REVERSAL_BUFFER admin account (ACTIVE — drawable on reversal)
    if (bufferUnits > 0) {
      await tx.creditUnitBlock.create({
        data: {
          serialFirst: `${serialPrefix}-B-0000000001`,
          serialLast: `${serialPrefix}-B-${String(bufferUnits).padStart(10, '0')}`,
          unitCount: bufferUnits,
          unitType: issuance.unitType,
          vintage: issuance.vintage,
          activityId: issuance.activityId,
          hostCountry: issuance.activity.hostCountry,
          issuanceDate: new Date(),
          holderAccountId: REVERSAL_BUFFER_ID,
          authorizationStatus: issuance.activity.hostAuthorization!.authorizedFor,
          caStatus: 'NOT_REQUIRED',
          retirementStatus: 'ACTIVE',
          retirementNarrative: `Reversal buffer deposit (${bufferPct}% of NET) — removal activity, drawable on reversal`,
        },
      });
    }

    // SOP block → Adaptation Fund (active, retirable for use on adaptation projects)
    if (sopInt > 0) {
      await tx.creditUnitBlock.create({
        data: {
          serialFirst: `${serialPrefix}-S-0000000001`,
          serialLast: `${serialPrefix}-S-${String(sopInt).padStart(10, '0')}`,
          unitCount: sopInt,
          unitType: issuance.unitType,
          vintage: issuance.vintage,
          activityId: issuance.activityId,
          hostCountry: issuance.activity.hostCountry,
          issuanceDate: new Date(),
          holderAccountId: ADAPTATION_FUND_ID,
          authorizationStatus: issuance.activity.hostAuthorization!.authorizedFor,
          caStatus: 'NOT_REQUIRED',
          retirementStatus: 'CANCELLED_SOP',
          retirementNarrative: 'SOP 5% — Adaptation Fund contribution (Decision 3/CMA.3 para 67)',
          retiredAt: new Date(),
        },
      });
    }

    // OMGE block → OMGE cancellation account (permanently cancelled at issuance)
    if (omgeInt > 0) {
      await tx.creditUnitBlock.create({
        data: {
          serialFirst: `${serialPrefix}-O-0000000001`,
          serialLast: `${serialPrefix}-O-${String(omgeInt).padStart(10, '0')}`,
          unitCount: omgeInt,
          unitType: issuance.unitType,
          vintage: issuance.vintage,
          activityId: issuance.activityId,
          hostCountry: issuance.activity.hostCountry,
          issuanceDate: new Date(),
          holderAccountId: OMGE_CANCELLATION_ID,
          authorizationStatus: issuance.activity.hostAuthorization!.authorizedFor,
          caStatus: 'NOT_REQUIRED',
          retirementStatus: 'CANCELLED_OMGE',
          retirementNarrative: 'OMGE 2% — automatic cancellation (Decision 3/CMA.3 para 68)',
          retiredAt: new Date(),
        },
      });
    }

    // Flip issuance → ISSUED
    const updated = await tx.issuance.update({
      where: { id: issuanceId },
      data: {
        status: 'ISSUED' as never,
        issuedAt: new Date(),
        serialBlockId: netBlock?.id,
      },
    });

    // Monitoring period → ISSUED
    await tx.monitoringPeriod.update({
      where: { id: issuance.periodId },
      data: { status: 'ISSUED' as never },
    });

    return { issuance: updated, netBlockId: netBlock?.id };
  });

  // Activity → ISSUING (idempotent, best-effort)
  try {
    await activityService.markIssuing(issuance.activityId, orgId, approverUserId);
  } catch {
    /* already ISSUING */
  }

  await recordAudit({
    orgId,
    userId: approverUserId,
    action: 'issuance.approved',
    resource: 'issuance',
    resourceId: issuanceId,
    newValue: {
      status: 'ISSUED',
      netUnits: netInt,
      sopLevy: sopInt,
      omgeLevy: omgeInt,
      // Phase C — buffer deposit (AV4-330). Participant/buffer split is
      // computed at approval (no schema change on Issuance); the raw block
      // rows are the source of truth for audit reconstruction.
      isRemoval,
      bufferPct: isRemoval ? bufferPct : null,
      bufferDepositUnits: bufferUnits,
      participantUnits,
      netBlockId: result.netBlockId,
    },
  });

  return result;
}

export async function listIssuances(activityId: string, orgId: string) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  return prisma.issuance.findMany({
    where: { activityId },
    orderBy: { requestedAt: 'desc' },
  });
}

export async function rejectIssuance(
  issuanceId: string,
  orgId: string,
  userId: string,
  reason: string,
) {
  const issuance = await prisma.issuance.findUnique({
    where: { id: issuanceId },
    include: { activity: true },
  });
  if (!issuance || issuance.activity.orgId !== orgId) {
    throw new AppError(404, 'Not Found', 'Issuance not found');
  }
  if (issuance.status !== 'REQUESTED') {
    throw new AppError(409, 'Conflict', `Cannot reject issuance in status ${issuance.status}`);
  }
  const updated = await prisma.issuance.update({
    where: { id: issuanceId },
    data: { status: 'REJECTED' as never },
  });
  await recordAudit({
    orgId,
    userId,
    action: 'issuance.rejected',
    resource: 'issuance',
    resourceId: issuanceId,
    newValue: { status: 'REJECTED', reason },
  });
  return updated;
}
