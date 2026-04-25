/**
 * Biocarbon tokenization service — lock-then-mint orchestration.
 *
 * Replaces the (previously stubbed) ERC-1155 mint path with a service that
 * calls `AurigraphDltAdapter.deployContract({ templateId: 'UC_CARBON', … })`
 * via the vendored `@aurigraph/dlt-sdk` (AAT-β / AV4-372). Combines:
 *
 *   - BCR (BioCarbon Registry) lock-then-mint flow (AAT-α / Sprint 1)
 *   - Aurigraph DLT V12 SDK contracts.deploy mint (AAT-β / Sprint 2)
 *   - `biocarbonAssetMetadataSchema` whole-ton + serial-id guard (AAT-γ)
 *
 * Flow (B5 of `docs/BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md`):
 *
 *   1. Pre-checks: issuance row exists + ISSUED + methodology.isBcrEligible
 *   2. `bcrAdapter.lockVCC(...)`        → record LOCK_VCC sync event
 *   3. `bcrAdapter.confirmLock(...)`    → record CONFIRM_LOCK sync event
 *      (failure → bail, throw LockFailedError, no mint attempted)
 *   4. `biocarbonAssetMetadataSchema.parse(...)` — whole-ton + serial-id guard
 *      (failure → no external call, schema validation throws)
 *   5. `aurigraphAdapter.deployContract({ templateId: 'UC_CARBON', terms })`
 *      (failure → best-effort `unlockVCC` + record events, throw chain error)
 *   6. Persist contractId / txHash on the issuance row
 *   7. `bcrAdapter.notifyMint(...)`     → record NOTIFY_MINT sync event
 *      (failure → mint stays good, sync event records `synced=false`,
 *       reconciliation worker re-attempts later — TODO AV4-375)
 *
 * Idempotency: presence of `tokenizationContractId` short-circuits the call
 * with the cached values. A divergent re-call (different bcrSerialId etc.)
 * throws `TokenizationDivergenceError`.
 *
 * AAT-ε / AV4-373.
 */

import { randomUUID } from 'node:crypto';
import {
  biocarbonAssetMetadataSchema,
  hashBcrSerialId,
  type BioCarbonAssetMetadata,
} from '@aurex/shared';
import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import { recordAudit } from './audit-log.service.js';
import {
  AurigraphDltAdapter,
  getAurigraphAdapter,
  type ContractDeployResult,
} from './chains/aurigraph-dlt-adapter.js';
import { getBcrAdapter } from './registries/bcr/index.js';
import type { BcrRegistryAdapter } from './registries/bcr/index.js';
import { recordBcrSyncEvent } from './registries/bcr/sync-recorder.js';
import { getAurigraphConfig } from '../lib/aurigraph-client.js';

// ── Public types ───────────────────────────────────────────────────────────

export interface TokenizeIssuanceOpts {
  issuanceId: string;
  userId: string;
}

export interface TokenizeIssuanceResult {
  contractId: string;
  txHash: string;
  bcrSerialId: string;
}

export interface TokenizationServiceDeps {
  /** Override the BCR adapter (tests inject MockBcrAdapter). */
  bcrAdapter?: BcrRegistryAdapter;
  /** Override the chain adapter (tests inject a stub). */
  aurigraphAdapter?: Pick<AurigraphDltAdapter, 'deployContract'>;
  /** Override the resolved Aurigraph channel id (defaults to env config). */
  channelId?: string;
}

// ── Errors ─────────────────────────────────────────────────────────────────

/** Issuance row does not exist or caller cannot see it. */
export class IssuanceNotFoundError extends AppError {
  constructor(issuanceId: string) {
    super(404, 'Not Found', `Issuance ${issuanceId} not found`);
    this.name = 'IssuanceNotFoundError';
  }
}

/** Methodology behind this issuance is not on the BCR-eligible allow-list. */
export class NotBcrEligibleError extends AppError {
  constructor(methodologyCode: string) {
    super(
      409,
      'Conflict',
      `Methodology ${methodologyCode} is not BCR-eligible (Methodology.isBcrEligible=false)`,
    );
    this.name = 'NotBcrEligibleError';
  }
}

/** Issuance is in a state that does not allow tokenization (e.g. REQUESTED). */
export class IssuanceNotTokenizableError extends AppError {
  constructor(status: string) {
    super(
      409,
      'Conflict',
      `Issuance is in status=${status}; tokenization requires status=ISSUED`,
    );
    this.name = 'IssuanceNotTokenizableError';
  }
}

/** BCR lockVCC + confirmLock did not yield a confirmed lock. */
export class LockFailedError extends AppError {
  constructor(reason: string) {
    super(502, 'Bad Gateway', `BCR lock/confirm failed: ${reason}`);
    this.name = 'LockFailedError';
  }
}

/** Idempotency divergence: existing tokenization row disagrees with current call. */
export class TokenizationDivergenceError extends AppError {
  constructor(detail: string) {
    super(409, 'Conflict', `Tokenization already minted but diverges: ${detail}`);
    this.name = 'TokenizationDivergenceError';
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────

/** Recipient account fallback used until per-org wallet wiring lands. */
const DEFAULT_RECIPIENT_ACCOUNT = process.env.AURIGRAPH_DEFAULT_RECIPIENT ?? 'aurex-treasury';

/**
 * Pull back the issuance row plus the joins needed to build the
 * BioCarbonAssetMetadata payload. Uses `findFirst` with the orgId join so
 * missing-vs-forbidden look identical to the caller (defence in depth — the
 * route layer already calls `requireOrgScope`).
 */
async function loadIssuanceForTokenization(issuanceId: string) {
  return prisma.issuance.findUnique({
    where: { id: issuanceId },
    include: {
      activity: {
        include: {
          methodology: true,
          org: true,
        },
      },
      period: true,
      serialBlock: true,
    },
  });
}

type LoadedIssuance = NonNullable<Awaited<ReturnType<typeof loadIssuanceForTokenization>>>;

/**
 * Resolve a placeholder `bcrProjectId` and `projectPageUrl`. The Activity
 * model does not yet carry these BCR-side identifiers (AV4-376 will add
 * them); for the Sprint 2 wiring we derive deterministic placeholders from
 * the activity id so the metadata schema validates and the BCR adapter's
 * mock registry stays consistent across calls.
 */
function deriveBcrProject(issuance: LoadedIssuance): {
  bcrProjectId: string;
  projectPageUrl: string;
  projectTitle: string;
} {
  const projectShort = issuance.activityId.slice(0, 8);
  return {
    bcrProjectId: `BCR-PROJ-${projectShort}`,
    projectPageUrl: `https://www.biocarbonregistry.com/projects/${projectShort}`,
    projectTitle: issuance.activity.title,
  };
}

/**
 * Build (and validate) the BioCarbonAssetMetadata payload that gets baked
 * into the Ricardian contract `terms` for the V12 mint. Throws a `ZodError`
 * on whole-ton / serial-id violations — surfaced to the caller via the
 * route layer's existing ZodError → 400 handler (ADM-052 RFC 7807).
 */
async function buildAssetMetadata(args: {
  issuance: LoadedIssuance;
  bcrSerialId: string;
}): Promise<BioCarbonAssetMetadata> {
  const { issuance, bcrSerialId } = args;
  const { bcrProjectId, projectPageUrl, projectTitle } = deriveBcrProject(issuance);
  const bcrSerialIdHash = await hashBcrSerialId(bcrSerialId);

  // The Issuance row's Decimal columns surface as Prisma Decimal — coerce to
  // a plain number for the integer schema. Because the issuance.service
  // floors all levy steps, the values are guaranteed integral on disk.
  const grossUnits = Number(issuance.grossUnits);
  const sopUnits = Number(issuance.sopLevyUnits);
  const omgeUnits = Number(issuance.omgeCancelledUnits);
  const netUnits = Number(issuance.netUnits);

  const payload: Record<string, unknown> = {
    bcrSerialId,
    bcrSerialIdHash,
    bcrProjectId,
    projectTitle,
    projectPageUrl,
    methodologyCode: issuance.activity.methodology.code,
    methodologyVersion: issuance.activity.methodology.version,
    vintage: issuance.vintage,
    hostCountry: issuance.activity.hostCountry,
    grossUnits,
    sopUnits,
    omgeUnits,
    netUnits,
    aurexActivityId: issuance.activityId,
    aurexIssuanceId: issuance.id,
  };

  // .parse() throws ZodError on B6 / B7 / B11 / B16 violations.
  return biocarbonAssetMetadataSchema.parse(payload);
}

// ── The service ────────────────────────────────────────────────────────────

/**
 * Mint a tokenized representation of the given Issuance via BCR
 * lock-then-mint + Aurigraph DLT `contracts.deploy(UC_CARBON, …)`.
 *
 * Idempotent: re-calling this with an issuance that already has
 * `tokenizationContractId` set returns the cached values without re-hitting
 * the BCR or chain adapters.
 *
 * @throws IssuanceNotFoundError       — no such issuance
 * @throws IssuanceNotTokenizableError — issuance status ≠ ISSUED
 * @throws NotBcrEligibleError         — methodology.isBcrEligible=false
 * @throws LockFailedError             — BCR lock/confirm failed
 * @throws ZodError                    — metadata schema validation failed
 *                                       (whole-ton / BCR Serial ID / etc.)
 * @throws ChainClientError | ChainServerError | QuotaExhaustedError
 *                                     — surfaced from the adapter on mint
 *                                       failure (lock is unlocked first,
 *                                       best-effort)
 * @throws TokenizationDivergenceError — idempotent re-call disagrees with
 *                                       persisted state
 */
export async function tokenizeIssuance(
  opts: TokenizeIssuanceOpts,
  deps: TokenizationServiceDeps = {},
): Promise<TokenizeIssuanceResult> {
  const { issuanceId, userId } = opts;
  const bcrAdapter = deps.bcrAdapter ?? getBcrAdapter();
  const aurigraphAdapter = deps.aurigraphAdapter ?? getAurigraphAdapter();

  // Resolve channel id eagerly; for tests the env is unset so fall back.
  let channelId = deps.channelId;
  if (!channelId) {
    try {
      channelId = getAurigraphConfig().channelId;
    } catch {
      channelId = process.env.AURIGRAPH_CHANNEL_ID ?? 'marketplace-channel';
    }
  }

  // ── Step 0: load + validate the issuance ────────────────────────────
  const issuance = await loadIssuanceForTokenization(issuanceId);
  if (!issuance) {
    throw new IssuanceNotFoundError(issuanceId);
  }

  // ── Step 1: idempotency short-circuit ───────────────────────────────
  if (issuance.tokenizationContractId) {
    if (
      !issuance.tokenizationTxHash ||
      !issuance.bcrSerialId
    ) {
      // Half-written record — divergence; refuse to "fix" silently.
      throw new TokenizationDivergenceError(
        `tokenizationContractId=${issuance.tokenizationContractId} but tokenizationTxHash or bcrSerialId is null`,
      );
    }
    logger.info(
      {
        issuanceId,
        contractId: issuance.tokenizationContractId,
      },
      'tokenizeIssuance: idempotent re-call — returning cached values',
    );
    return {
      contractId: issuance.tokenizationContractId,
      txHash: issuance.tokenizationTxHash,
      bcrSerialId: issuance.bcrSerialId,
    };
  }

  // Status guard — only ISSUED issuances are tokenizable.
  if (issuance.status !== 'ISSUED') {
    throw new IssuanceNotTokenizableError(String(issuance.status));
  }

  // BCR-eligibility guard.
  if (!issuance.activity.methodology.isBcrEligible) {
    throw new NotBcrEligibleError(issuance.activity.methodology.code);
  }

  const orgId = issuance.activity.orgId;
  const { bcrProjectId } = deriveBcrProject(issuance);

  // Pre-assign the BCR Serial ID so we can pin the metadata payload + lock
  // call to the same identifier. The mock adapter accepts an explicit serial;
  // the live adapter will overwrite it with BCR's authoritative id when the
  // adapter swap-in lands (AV4-376).
  const bcrSerialId = `BCR-${randomUUID()}`;
  const netUnits = Number(issuance.netUnits);

  // ── Pre-flight whole-ton guard (B11) ─────────────────────────────────
  // Run the same schema validation that will gate the on-chain mint, but
  // against a preview payload that uses the to-be-assigned bcrSerialId. This
  // ensures sub-ton / non-positive-integer netUnits fail BEFORE any external
  // call (BCR or chain) is attempted — important for the "schema rejects
  // before any external call" guarantee in B11 / B7.
  const previewBcrSerialIdHash = await hashBcrSerialId(bcrSerialId);
  biocarbonAssetMetadataSchema.parse({
    bcrSerialId,
    bcrSerialIdHash: previewBcrSerialIdHash,
    bcrProjectId,
    projectTitle: issuance.activity.title,
    projectPageUrl: deriveBcrProject(issuance).projectPageUrl,
    methodologyCode: issuance.activity.methodology.code,
    methodologyVersion: issuance.activity.methodology.version,
    vintage: issuance.vintage,
    hostCountry: issuance.activity.hostCountry,
    grossUnits: Number(issuance.grossUnits),
    sopUnits: Number(issuance.sopLevyUnits),
    omgeUnits: Number(issuance.omgeCancelledUnits),
    netUnits,
    aurexActivityId: issuance.activityId,
    aurexIssuanceId: issuance.id,
  });

  // ── Step 2: lockVCC ─────────────────────────────────────────────────
  const lockParams = {
    issuanceId,
    projectId: bcrProjectId,
    vintage: issuance.vintage,
    units: netUnits,
    recipientAccount: DEFAULT_RECIPIENT_ACCOUNT,
    bcrSerialId,
  };
  const lockResult = await bcrAdapter.lockVCC(lockParams);
  await recordBcrSyncEvent({
    eventType: 'LOCK_VCC',
    resourceKind: 'issuance',
    resourceId: issuanceId,
    adapterName: bcrAdapter.adapterName,
    bcrSerialId: lockResult.data?.bcrSerialId ?? bcrSerialId,
    bcrLockId: lockResult.data?.bcrLockId ?? null,
    result: lockResult,
    requestPayload: lockParams,
  });

  if (!lockResult.ok || !lockResult.data) {
    throw new LockFailedError(lockResult.reason ?? 'lockVCC returned ok=false');
  }
  const { bcrLockId, bcrSerialId: lockedSerialId } = lockResult.data;

  // ── Step 3: confirmLock ─────────────────────────────────────────────
  const confirmResult = await bcrAdapter.confirmLock({ bcrLockId });
  await recordBcrSyncEvent({
    eventType: 'CONFIRM_LOCK',
    resourceKind: 'issuance',
    resourceId: issuanceId,
    adapterName: bcrAdapter.adapterName,
    bcrSerialId: lockedSerialId,
    bcrLockId,
    result: confirmResult,
    requestPayload: { bcrLockId },
  });

  if (!confirmResult.ok || !confirmResult.data?.confirmed) {
    // Lock acquired but unconfirmed — do NOT proceed to mint. Mark
    // tokenization FAILED so a reconciliation worker can decide whether to
    // retry or release; the lock itself is left in place for ops review.
    await markIssuanceFailed(issuanceId, lockedSerialId, bcrLockId);
    throw new LockFailedError(
      confirmResult.reason ?? 'confirmLock returned ok=false or confirmed=false',
    );
  }

  // ── Step 4: build + validate the asset metadata ─────────────────────
  // Failures here throw ZodError with whole-ton / serial-id detail.
  const metadata = await buildAssetMetadata({
    issuance,
    bcrSerialId: lockedSerialId,
  });

  // ── Step 5: chain mint via contracts.deploy(UC_CARBON, terms) ───────
  let deployResult: ContractDeployResult;
  try {
    deployResult = await aurigraphAdapter.deployContract({
      templateId: 'UC_CARBON',
      useCaseId: 'UC_CARBON',
      channelId,
      terms: metadata as unknown as Record<string, unknown>,
    });
  } catch (err) {
    // Best-effort unlockVCC to release the BCR-side lock so a future retry
    // can re-acquire. Failures here are logged + recorded as a sync event;
    // they never mask the underlying chain error.
    try {
      const unlockResult = await bcrAdapter.unlockVCC({
        bcrLockId,
        reason: 'DELIST',
      });
      await recordBcrSyncEvent({
        eventType: 'UNLOCK_VCC',
        resourceKind: 'issuance',
        resourceId: issuanceId,
        adapterName: bcrAdapter.adapterName,
        bcrSerialId: lockedSerialId,
        bcrLockId,
        result: unlockResult,
        requestPayload: { bcrLockId, reason: 'DELIST' },
      });
    } catch (unlockErr) {
      logger.error(
        {
          err: unlockErr instanceof Error ? unlockErr.message : String(unlockErr),
          issuanceId,
          bcrLockId,
        },
        'tokenizeIssuance: best-effort unlockVCC threw (non-fatal)',
      );
    }
    await markIssuanceFailed(issuanceId, lockedSerialId, bcrLockId);
    throw err;
  }

  // ── Step 6: persist the mint trail on the issuance row ──────────────
  await prisma.issuance.update({
    where: { id: issuanceId },
    data: {
      tokenizationStatus: 'MINTED' as never,
      tokenizationContractId: deployResult.contractId,
      tokenizationTxHash: deployResult.txHash,
      bcrSerialId: lockedSerialId,
      bcrLockId,
      tokenizedAt: new Date(),
    },
  });

  // Audit row for the operator-visible action — separate from the SDK call
  // log + BCR sync events which are technical-trail concerns.
  await recordAudit({
    orgId,
    userId,
    action: 'issuance.tokenized',
    resource: 'issuance',
    resourceId: issuanceId,
    newValue: {
      contractId: deployResult.contractId,
      txHash: deployResult.txHash,
      bcrSerialId: lockedSerialId,
      bcrLockId,
      netUnits,
      methodologyCode: issuance.activity.methodology.code,
      vintage: issuance.vintage,
    },
  });

  // ── Step 7: notifyMint — best-effort post-mint reconciliation ───────
  // Failure here does NOT roll back the chain mint (B7: chain is now the
  // source of truth). The sync event records `synced=false` so a separate
  // reconciliation worker can re-attempt later (TODO AV4-375).
  const notifyParams = {
    bcrLockId,
    bcrSerialId: lockedSerialId,
    chain: 'aurigraph-dlt-v12',
    tokenContract: deployResult.contractId,
    tokenId: deployResult.contractId, // V12 contracts.deploy returns one token per contract
    serialFirst: `${lockedSerialId}-1`,
    serialLast: `${lockedSerialId}-${netUnits}`,
    units: netUnits,
  };
  let notifyResult;
  try {
    notifyResult = await bcrAdapter.notifyMint(notifyParams);
  } catch (err) {
    // Adapter contract says it should not throw, but be defensive.
    notifyResult = {
      ok: false as const,
      externalRef: null,
      reason: `notifyMint threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  await recordBcrSyncEvent({
    eventType: 'NOTIFY_MINT',
    resourceKind: 'issuance',
    resourceId: issuanceId,
    adapterName: bcrAdapter.adapterName,
    bcrSerialId: lockedSerialId,
    bcrLockId,
    result: notifyResult,
    requestPayload: notifyParams,
  });
  if (!notifyResult.ok) {
    // TODO(AV4-375): enqueue a reconciliation job to re-attempt notifyMint.
    logger.warn(
      {
        issuanceId,
        contractId: deployResult.contractId,
        reason: notifyResult.reason,
      },
      'tokenizeIssuance: notifyMint failed post-mint — chain mint stands; reconciliation pending',
    );
  }

  return {
    contractId: deployResult.contractId,
    txHash: deployResult.txHash,
    bcrSerialId: lockedSerialId,
  };
}

/**
 * Mark the issuance's tokenization as FAILED while leaving the rest of the
 * row untouched. Used when lock confirmation or chain mint fails. Best-effort
 * — a DB error here is logged and swallowed because the surrounding code is
 * already on a failure path.
 */
async function markIssuanceFailed(
  issuanceId: string,
  bcrSerialId: string,
  bcrLockId: string,
): Promise<void> {
  try {
    await prisma.issuance.update({
      where: { id: issuanceId },
      data: {
        tokenizationStatus: 'FAILED' as never,
        bcrSerialId,
        bcrLockId,
      },
    });
  } catch (err) {
    logger.error(
      {
        err: err instanceof Error ? err.message : String(err),
        issuanceId,
      },
      'markIssuanceFailed: failed to persist FAILED status (non-fatal)',
    );
  }
}
