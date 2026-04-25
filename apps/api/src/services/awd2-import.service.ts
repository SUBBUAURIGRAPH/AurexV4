/**
 * AWD2 → Aurex backfill / handoff import service (AAT-ξ / AV4-362).
 *
 * AWD2 is a separate registry (legacy Polygon ERC-721 NFTs). When a credit's
 * ownership/management transitions to Aurex, the AWD2 emitter (AV4-360, in
 * the AWD2 repo — out of scope here) sends a signed handoff manifest to
 * `POST /api/v1/awd2/handoff`. The route persists every manifest as an
 * `Awd2Handoff` row (status=RECEIVED) and then calls `importAwd2Handoff`
 * here to:
 *
 *   1. Validate the methodology exists in Aurex and is `isBcrEligible`.
 *   2. Validate the destination org exists.
 *   3. Find-or-create a synthetic `Activity` keyed off `awd2ProjectRef`
 *      (added in this AAT). One Activity per AWD2 project — multiple
 *      handoffs (different vintages / serials) reuse the same Activity.
 *   4. Create a fully-formed `Issuance` row with:
 *        - `tokenizationStatus = MINTED`        (the credit is already
 *          tokenized — on AWD2's Polygon ERC-721 contract; we do NOT
 *          re-mint on Aurigraph DLT V12.)
 *        - `tokenizationContractId = <awd2ContractAddress>:<awd2TokenId>`
 *          (composite reference — explicitly NOT a UC_CARBON contractId,
 *          this is a grandfathered AWD2 representation.)
 *        - `bcrSerialId` from the handoff
 *        - `bcrLockId` derived from the bcrSerialId (same hash pattern
 *          tokenization.service uses on the native mint path).
 *        - `tokenizedAt = handoffEmittedAt`
 *        - `quantity (grossUnits/netUnits) = handoff.tonnes`  (whole-ton
 *          enforced by the route schema; the service also defends.)
 *   5. Mark the `Awd2Handoff` row as IMPORTED, populate `issuanceId` +
 *      `importedAt`.
 *   6. Audit-log the action.
 *
 * Idempotency: if the `Awd2Handoff.status === IMPORTED` already, the
 * function returns the existing `issuanceId` without re-creating any rows.
 *
 * Failure handling: any pre-flight validation error (methodology not
 * eligible / org missing / activity create fails / sub-ton tonnes) marks
 * the handoff as FAILED with a structured reason and throws a typed error.
 * The route translates the typed error into RFC 7807 422.
 */

import { hashBcrSerialId } from '@aurex/shared';
import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import { recordAudit } from './audit-log.service.js';
import {
  assertBcrEligible,
  MethodologyNotBcrEligibleError,
  MethodologyNotFoundError,
} from './methodology.service.js';

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Validated handoff payload (matches the zod schema in the route + the
 * `Awd2Handoff` schema fields). The route always persists the row first,
 * then passes the row id + payload here so the service can mark FAILED on
 * its own without round-tripping through the route.
 */
export interface Awd2HandoffInput {
  awd2HandoffId: string;
  handoffNonce: string;
  awd2ContractAddress: string;
  awd2TokenId: string;
  bcrSerialId: string;
  vintage: number;
  methodologyCode: string;
  projectId: string;
  projectTitle: string;
  tonnes: number;
  currentHolderOrgId: string;
  provenanceHash: string;
  handoffEmittedAt: Date;
}

export interface ImportAwd2HandoffResult {
  issuanceId: string;
  awd2HandoffId: string;
  status: 'imported' | 'duplicate';
}

export interface Awd2ImportServiceDeps {
  /** Override the audit recorder (tests inject a noop). */
  audit?: typeof recordAudit;
}

// ── Errors ─────────────────────────────────────────────────────────────────

/** The AWD2 handoff references a methodology that is not BCR-eligible in Aurex. */
export class MethodologyNotEligibleError extends AppError {
  constructor(methodologyCode: string) {
    super(
      422,
      'Unprocessable Entity',
      `Methodology ${methodologyCode} is not BCR-eligible (Methodology.isBcrEligible=false) — cannot import AWD2 handoff`,
    );
    this.name = 'MethodologyNotEligibleError';
  }
}

/** The AWD2 handoff references an org that does not exist in Aurex. */
export class HolderOrgNotFoundError extends AppError {
  constructor(orgId: string) {
    super(
      422,
      'Unprocessable Entity',
      `currentHolderOrgId ${orgId} does not exist in Aurex`,
    );
    this.name = 'HolderOrgNotFoundError';
  }
}

/** Sub-ton / non-positive-integer tonnes (defence in depth — route already guards). */
export class WholeTonViolationError extends AppError {
  constructor(tonnes: number) {
    super(
      422,
      'Unprocessable Entity',
      `tonnes must be a positive whole number; got ${tonnes}`,
    );
    this.name = 'WholeTonViolationError';
  }
}

/** Activity find-or-create failed (e.g. DB constraint). */
export class ActivityCreateError extends AppError {
  constructor(detail: string) {
    super(422, 'Unprocessable Entity', `Failed to attach AWD2 project to Activity: ${detail}`);
    this.name = 'ActivityCreateError';
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Derive a stable bcrLockId for an AWD2-imported issuance.
 *
 * Native (Aurex-side) tokenization has BCR mint a real lockId; for AWD2
 * imports there is no Aurex-side BCR lock — the credit was already locked
 * on AWD2's flow. We use the SHA-256 of the bcrSerialId as a deterministic
 * pseudo-lockId, prefixed with `AWD2-LOCK-` so audit reviewers can tell at
 * a glance this came from a handoff.
 */
async function deriveAwd2LockId(bcrSerialId: string): Promise<string> {
  const hash = await hashBcrSerialId(bcrSerialId);
  // hash is a 0x-prefixed hex string; trim the prefix + take the first 32
  // hex chars to keep the ref short enough for the VarChar(255) column.
  const short = hash.startsWith('0x') ? hash.slice(2, 34) : hash.slice(0, 32);
  return `AWD2-LOCK-${short}`;
}

/**
 * Find-or-create the synthetic Activity row for an AWD2 project. Uses
 * `awd2ProjectRef` as the dedup key; on first import the Activity is
 * created in REGISTERED status (the credit on AWD2 is real, the project
 * is real — we just don't have the Aurex-side PDD/MonitoringPlan rows).
 */
async function findOrCreateActivityForAwd2Project(args: {
  orgId: string;
  methodologyId: string;
  awd2ProjectRef: string;
  projectTitle: string;
  createdBy: string;
}) {
  // Cast `findFirst({ where: { awd2ProjectRef } })` through `as any` only
  // at the where-clause boundary so the compiler doesn't complain when
  // someone's running against a stale generated client. Once `db:generate`
  // has been re-run the field is part of the typed model.
  const existing = await prisma.activity.findFirst({
    where: { awd2ProjectRef: args.awd2ProjectRef, orgId: args.orgId },
  });
  if (existing) return existing;

  // Default fields — synthetic, but consistent with a registered activity
  // (the AWD2-side counterpart has already been validated/registered).
  // hostCountry defaults to 'XX' (international waters / unknown — masters
  // can update later). gases default to CO2 only since AWD2 carries
  // tonnes-of-CO2e (mass-balance equivalent).
  try {
    const created = await prisma.activity.create({
      data: {
        orgId: args.orgId,
        methodologyId: args.methodologyId,
        title: args.projectTitle,
        description: `Imported from AWD2 (handoff). awd2ProjectRef=${args.awd2ProjectRef}`,
        hostCountry: 'XX',
        sectoralScope: 14, // 14 = AFOLU (most common BCR scope; updateable)
        technologyType: 'AWD2_IMPORT',
        gasesCovered: ['CO2'],
        creditingPeriodType: 'FIXED_10YR' as never,
        status: 'REGISTERED' as never,
        registeredAt: new Date(),
        awd2ProjectRef: args.awd2ProjectRef,
        createdBy: args.createdBy,
      },
    });
    return created;
  } catch (err) {
    throw new ActivityCreateError(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Mark a handoff row FAILED with a structured reason. Best-effort —
 * surfacing a DB error here is a no-op because the surrounding code is
 * already on a failure path.
 */
async function markHandoffFailed(
  awd2HandoffId: string,
  reason: string,
): Promise<void> {
  try {
    await prisma.awd2Handoff.update({
      where: { id: awd2HandoffId },
      data: {
        status: 'FAILED' as never,
        reason,
      },
    });
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), awd2HandoffId },
      'markHandoffFailed: failed to persist FAILED status (non-fatal)',
    );
  }
}

// ── The service ────────────────────────────────────────────────────────────

/**
 * Translate a validated AWD2 handoff into an Aurex Issuance row.
 *
 * @throws MethodologyNotEligibleError  — methodology missing / not BCR-eligible
 * @throws HolderOrgNotFoundError       — currentHolderOrgId does not exist
 * @throws WholeTonViolationError       — sub-ton tonnes (defence in depth)
 * @throws ActivityCreateError          — synthetic Activity create failed
 */
export async function importAwd2Handoff(
  input: Awd2HandoffInput,
  deps: Awd2ImportServiceDeps = {},
): Promise<ImportAwd2HandoffResult> {
  const audit = deps.audit ?? recordAudit;

  // ── Step 0: idempotent re-import check ─────────────────────────────
  const handoffRow = await prisma.awd2Handoff.findUnique({
    where: { id: input.awd2HandoffId },
  });
  if (!handoffRow) {
    // The route always persists first — if the row isn't there the
    // caller has misused the service. We don't try to recover.
    throw new AppError(
      500,
      'Internal Server Error',
      `Awd2Handoff ${input.awd2HandoffId} not found — service called out of order`,
    );
  }
  if (handoffRow.status === 'IMPORTED' && handoffRow.issuanceId) {
    logger.info(
      { awd2HandoffId: input.awd2HandoffId, issuanceId: handoffRow.issuanceId },
      'importAwd2Handoff: already imported — returning cached result',
    );
    return {
      issuanceId: handoffRow.issuanceId,
      awd2HandoffId: input.awd2HandoffId,
      status: 'duplicate',
    };
  }

  // ── Step 1: tonnes whole-ton guard (defence in depth) ──────────────
  if (
    !Number.isInteger(input.tonnes) ||
    input.tonnes <= 0 ||
    !Number.isFinite(input.tonnes)
  ) {
    await markHandoffFailed(
      input.awd2HandoffId,
      `tonnes must be a positive whole number; got ${input.tonnes}`,
    );
    throw new WholeTonViolationError(input.tonnes);
  }

  // ── Step 2: methodology eligibility ────────────────────────────────
  // AAT-π / AV4-368: route via the methodology catalogue (single source of
  // truth) instead of an inline prisma.methodology.findFirst. The catalogue
  // throws typed errors; we translate them into the legacy
  // MethodologyNotEligibleError so the route's RFC 7807 mapping is preserved.
  try {
    await assertBcrEligible(input.methodologyCode);
  } catch (err) {
    if (
      err instanceof MethodologyNotFoundError ||
      err instanceof MethodologyNotBcrEligibleError
    ) {
      await markHandoffFailed(
        input.awd2HandoffId,
        `Methodology ${input.methodologyCode} is not BCR-eligible (or does not exist)`,
      );
      throw new MethodologyNotEligibleError(input.methodologyCode);
    }
    throw err;
  }
  // Fetch the row again to get the database id (catalogue entry omits id
  // by design — external consumers don't need it). Cheap follow-up read
  // gated by the catalogue's eligibility check above.
  const methodology = await prisma.methodology.findUnique({
    where: { code: input.methodologyCode },
  });
  if (!methodology) {
    // Defensive — assertBcrEligible just succeeded, so this is a race.
    await markHandoffFailed(
      input.awd2HandoffId,
      `Methodology ${input.methodologyCode} disappeared between catalogue check and id lookup`,
    );
    throw new MethodologyNotEligibleError(input.methodologyCode);
  }

  // ── Step 3: org existence ──────────────────────────────────────────
  const org = await prisma.organization.findUnique({
    where: { id: input.currentHolderOrgId },
  });
  if (!org) {
    await markHandoffFailed(
      input.awd2HandoffId,
      `currentHolderOrgId ${input.currentHolderOrgId} not found`,
    );
    throw new HolderOrgNotFoundError(input.currentHolderOrgId);
  }

  // ── Step 4: find-or-create synthetic Activity ──────────────────────
  let activity;
  try {
    activity = await findOrCreateActivityForAwd2Project({
      orgId: input.currentHolderOrgId,
      methodologyId: methodology.id,
      awd2ProjectRef: input.projectId,
      projectTitle: input.projectTitle,
      // System-generated rows — use a sentinel UUID for createdBy so the FK
      // would point to a fictional "AWD2 importer" user. The createdBy column
      // is a UUID column without an FK constraint to users (verified in the
      // Activity model), so this is safe.
      createdBy: '00000000-0000-4000-8000-000000000099',
    });
  } catch (err) {
    if (err instanceof ActivityCreateError) {
      await markHandoffFailed(input.awd2HandoffId, err.message);
    } else {
      await markHandoffFailed(
        input.awd2HandoffId,
        err instanceof Error ? err.message : String(err),
      );
    }
    throw err;
  }

  // ── Step 5: build the Issuance row ─────────────────────────────────
  // The Issuance schema requires periodId (FK + @unique). For AWD2 imports
  // we don't have an Aurex MonitoringPeriod, so we synthesise one to keep
  // the FK happy. One MonitoringPeriod per import — that mirrors how the
  // native flow has 1 issuance per period.
  const tokenizationContractRef = `${input.awd2ContractAddress}:${input.awd2TokenId}`;
  const bcrLockId = await deriveAwd2LockId(input.bcrSerialId);

  let issuanceId: string;
  try {
    issuanceId = await prisma.$transaction(async (tx) => {
      // Synth MonitoringPeriod — minimum fields to satisfy the FK.
      const periodStart = new Date(Date.UTC(input.vintage, 0, 1));
      const periodEnd = new Date(Date.UTC(input.vintage, 11, 31, 23, 59, 59));
      const period = await tx.monitoringPeriod.create({
        data: {
          activityId: activity.id,
          periodStart,
          periodEnd,
          status: 'ISSUED' as never,
        },
      });

      // The Issuance row — a fully-formed MINTED tokenization that points
      // to the AWD2 contract instead of a UC_CARBON Aurigraph contract.
      // Levies are zero because AWD2 already enforced its own; the gross
      // == net == tonnes for accounting purposes.
      const issuance = await tx.issuance.create({
        data: {
          activityId: activity.id,
          periodId: period.id,
          grossUnits: input.tonnes,
          sopLevyUnits: 0,
          omgeCancelledUnits: 0,
          netUnits: input.tonnes,
          vintage: input.vintage,
          unitType: 'A6_4ER' as never,
          status: 'ISSUED' as never,
          issuedAt: input.handoffEmittedAt,
          requestedBy: '00000000-0000-4000-8000-000000000099',
          // ── Tokenization fields — the credit is already minted on AWD2.
          // tokenizationContractId encodes the AWD2 NFT reference as
          // `<contractAddress>:<tokenId>`. NOT a UC_CARBON contractId.
          tokenizationStatus: 'MINTED' as never,
          tokenizationContractId: tokenizationContractRef,
          tokenizationTxHash: null,
          bcrSerialId: input.bcrSerialId,
          bcrLockId,
          tokenizedAt: input.handoffEmittedAt,
        },
      });

      // Mark the handoff IMPORTED + link the issuance.
      await tx.awd2Handoff.update({
        where: { id: input.awd2HandoffId },
        data: {
          status: 'IMPORTED' as never,
          issuanceId: issuance.id,
          importedAt: new Date(),
          reason: null,
        },
      });

      return issuance.id;
    });
  } catch (err) {
    await markHandoffFailed(
      input.awd2HandoffId,
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  }

  // ── Step 6: audit log (best-effort) ────────────────────────────────
  await audit({
    orgId: input.currentHolderOrgId,
    userId: null,
    action: 'awd2.handoff.imported',
    resource: 'awd2_handoff',
    resourceId: input.awd2HandoffId,
    newValue: {
      issuanceId,
      awd2ContractAddress: input.awd2ContractAddress,
      awd2TokenId: input.awd2TokenId,
      bcrSerialId: input.bcrSerialId,
      methodologyCode: input.methodologyCode,
      vintage: input.vintage,
      tonnes: input.tonnes,
      activityId: activity.id,
    },
  });

  logger.info(
    {
      awd2HandoffId: input.awd2HandoffId,
      issuanceId,
      bcrSerialId: input.bcrSerialId,
      tonnes: input.tonnes,
    },
    'AWD2 handoff imported into Aurex',
  );

  return {
    issuanceId,
    awd2HandoffId: input.awd2HandoffId,
    status: 'imported',
  };
}
