/**
 * Biocarbon delist service — chain-burn + DelistRequest persistence.
 *
 * Marketplace-side trigger for the BCR two-way bridge (binding requirement
 * B18 of `docs/BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md`):
 *
 *   token holder requests delist
 *     → Aurex burns the chain asset with `{ delist: true, … }` metadata
 *     → events worker (`aurigraph-events.worker.ts`) picks up the burn
 *     → worker calls `bcrAdapter.unlockVcc` (locked → free on BCR side)
 *     → worker flips DelistRequest.status to BCR_UNLOCKED
 *
 * Mirrors the Sprint-2 lock-then-mint initiator (`tokenization.service.ts`).
 * BCR-side reconciliation is OUT OF SCOPE for this service — it lives in
 * the events worker so the BCR call is decoupled from the request/response
 * cycle and survives Aurex restarts.
 *
 * AAT-κ / AV4-357.
 */

import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import { recordAudit } from './audit-log.service.js';
import {
  type AurigraphDltAdapter,
  getAurigraphAdapter,
} from './chains/aurigraph-dlt-adapter.js';

// ── Public types ───────────────────────────────────────────────────────────

export interface DelistIssuanceOpts {
  issuanceId: string;
  userId: string;
  orgId: string;
  /** Optional caller-supplied org role (from `req.orgRole`). Used only when
   *  the caller is NOT the issuance's own org and we need to fall back to a
   *  role-based ownership check. See header doc for the policy choice. */
  role?: string;
  /** Free-text reason; baked into both the chain metadata + DelistRequest. */
  reason?: string;
}

export interface DelistIssuanceResult {
  delistRequestId: string;
  txHash: string;
}

export interface DelistServiceDeps {
  /** Override the chain adapter (tests inject a stub). */
  aurigraphAdapter?: Pick<AurigraphDltAdapter, 'burnAsset'>;
}

// ── Errors ─────────────────────────────────────────────────────────────────

/** Issuance row does not exist or caller cannot see it. */
export class DelistIssuanceNotFoundError extends AppError {
  constructor(issuanceId: string) {
    super(404, 'Not Found', `Issuance ${issuanceId} not found`);
    this.name = 'DelistIssuanceNotFoundError';
  }
}

/**
 * Issuance is not currently in MINTED state — i.e. it's been retired,
 * already delisted, or was never tokenized in the first place. Delist
 * requires `tokenizationStatus === 'MINTED'`.
 */
export class NotMintedError extends AppError {
  constructor(status: string | null) {
    super(
      409,
      'Conflict',
      `Issuance is in tokenizationStatus=${status ?? 'null'}; delist requires tokenizationStatus=MINTED`,
    );
    this.name = 'NotMintedError';
  }
}

/**
 * Caller's org does not own this token. Either the issuance belongs to a
 * different org entirely, or the caller's org-role does not carry the
 * delist capability on the owning org.
 */
export class NotOwnerError extends AppError {
  constructor(detail: string) {
    super(403, 'Forbidden', `Cannot delist this issuance: ${detail}`);
    this.name = 'NotOwnerError';
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────

async function loadIssuanceForDelist(issuanceId: string) {
  return prisma.issuance.findUnique({
    where: { id: issuanceId },
    include: {
      activity: {
        select: {
          id: true,
          orgId: true,
          title: true,
        },
      },
      delistRequest: true,
    },
  });
}

type LoadedIssuance = NonNullable<Awaited<ReturnType<typeof loadIssuanceForDelist>>>;

/**
 * Ownership policy. The Issuance model does not currently carry a separate
 * holder-side org id — the original mint is keyed off `activity.orgId`. We
 * therefore treat "owner" as "same org as the activity that minted this
 * token". When a future ticket adds a separate holder/wallet column, this
 * is the single function that needs updating.
 *
 * If the caller's org matches the issuance org, we accept regardless of
 * role (the route layer already gates by ORG_ADMIN/APPROVER). If the
 * caller is from a different org, we reject — cross-org delist is not
 * supported in this initial implementation.
 */
function checkOwnership(issuance: LoadedIssuance, orgId: string): void {
  if (issuance.activity.orgId !== orgId) {
    throw new NotOwnerError(
      `caller org ${orgId} does not own issuance ${issuance.id} (owner=${issuance.activity.orgId})`,
    );
  }
}

// ── The service ────────────────────────────────────────────────────────────

/**
 * Initiate a delist: burn the chain token with `{ delist: true }` metadata
 * and persist a `DelistRequest` row at status=CHAIN_BURNED. The events
 * worker will reconcile to BCR_UNLOCKED asynchronously.
 *
 * Idempotent: re-calling with an issuance that already has a DelistRequest
 * in INITIATED or CHAIN_BURNED returns the cached `delistRequestId` /
 * `txHash` without re-burning.
 *
 * @throws DelistIssuanceNotFoundError — no such issuance
 * @throws NotMintedError              — tokenizationStatus ≠ MINTED
 * @throws NotOwnerError               — caller org does not own the token
 * @throws ChainClientError | ChainServerError | QuotaExhaustedError
 *                                     — surfaced from the adapter on burn
 *                                       failure (DelistRequest stored as
 *                                       FAILED, see policy in the spec)
 */
export async function delistIssuance(
  opts: DelistIssuanceOpts,
  deps: DelistServiceDeps = {},
): Promise<DelistIssuanceResult> {
  const { issuanceId, userId, orgId, role, reason } = opts;
  const aurigraphAdapter = deps.aurigraphAdapter ?? getAurigraphAdapter();

  // ── Step 0: load + validate the issuance ────────────────────────────
  const issuance = await loadIssuanceForDelist(issuanceId);
  if (!issuance) {
    throw new DelistIssuanceNotFoundError(issuanceId);
  }

  // ── Step 1: ownership ───────────────────────────────────────────────
  checkOwnership(issuance, orgId);

  // ── Step 2: idempotency short-circuit ───────────────────────────────
  if (issuance.delistRequest) {
    const existing = issuance.delistRequest;
    if (existing.status === 'INITIATED' || existing.status === 'CHAIN_BURNED') {
      logger.info(
        {
          issuanceId,
          delistRequestId: existing.id,
          status: existing.status,
        },
        'delistIssuance: idempotent re-call — returning existing DelistRequest',
      );
      return {
        delistRequestId: existing.id,
        txHash: existing.txHash ?? '',
      };
    }
    if (existing.status === 'BCR_UNLOCKED') {
      // Already fully reconciled — surface as 409 since the issuance is
      // no longer MINTED at this point either.
      throw new NotMintedError(issuance.tokenizationStatus);
    }
    // `existing.status === 'FAILED'` — fall through and try again. The row
    // gets overwritten by the upsert below. This matches the
    // `tokenization.service` behaviour where FAILED is a retryable state.
  }

  // ── Step 3: tokenizationStatus guard ────────────────────────────────
  // Must be MINTED to delist (i.e. a chain token currently exists).
  if (issuance.tokenizationStatus !== 'MINTED') {
    throw new NotMintedError(issuance.tokenizationStatus);
  }

  if (
    !issuance.tokenizationContractId ||
    !issuance.bcrSerialId
  ) {
    // Defence in depth — MINTED rows always carry these. If they don't,
    // refuse rather than emit a malformed burn payload.
    throw new NotMintedError(
      `MINTED but missing tokenizationContractId or bcrSerialId (data integrity)`,
    );
  }

  // ── Step 4: build delist metadata ───────────────────────────────────
  // The events worker classifies via the absence of `retiredFor`/`retiredBy`
  // on the burn metadata, so we deliberately omit those. We DO include the
  // fields the worker needs: aurexIssuanceId, bcrSerialId, bcrLockId,
  // vintage, netUnits.
  const delistMetadata: Record<string, unknown> = {
    delist: true,
    bcrSerialId: issuance.bcrSerialId,
    bcrLockId: issuance.bcrLockId ?? null,
    originalContractId: issuance.tokenizationContractId,
    aurexIssuanceId: issuance.id,
    vintage: issuance.vintage,
    netUnits: Number(issuance.netUnits),
    requestedBy: {
      userId,
      orgId,
      role: role ?? null,
    },
    reason: reason ?? null,
  };

  // ── Step 5: chain burn ──────────────────────────────────────────────
  let burnResult;
  try {
    burnResult = await aurigraphAdapter.burnAsset({
      assetId: issuance.tokenizationContractId,
      amount: Number(issuance.netUnits),
      reason: reason ?? 'delist',
      // Intentionally NO retiredBy — its presence would cause the worker
      // classifier to label this BURN_FOR_RETIREMENT. The delist payload
      // lives in `metadata` instead.
      metadata: delistMetadata,
    });
  } catch (err) {
    // Persist a FAILED DelistRequest so operators have a record of the
    // attempt. Best-effort — a DB error here is logged + swallowed because
    // the surrounding caller is already on a failure path.
    try {
      await prisma.delistRequest.upsert({
        where: { issuanceId: issuance.id },
        create: {
          issuanceId: issuance.id,
          bcrSerialId: issuance.bcrSerialId,
          requestedByUserId: userId,
          requestedByOrgId: orgId,
          reason: reason ?? null,
          status: 'FAILED',
        },
        update: {
          status: 'FAILED',
          reason: reason ?? null,
          requestedByUserId: userId,
          requestedByOrgId: orgId,
        },
      });
    } catch (persistErr) {
      logger.error(
        {
          err: persistErr instanceof Error ? persistErr.message : String(persistErr),
          issuanceId,
        },
        'delistIssuance: failed to persist FAILED DelistRequest (non-fatal)',
      );
    }
    throw err;
  }

  // ── Step 6: persist the DelistRequest row at CHAIN_BURNED ───────────
  const persisted = await prisma.delistRequest.upsert({
    where: { issuanceId: issuance.id },
    create: {
      issuanceId: issuance.id,
      bcrSerialId: issuance.bcrSerialId,
      requestedByUserId: userId,
      requestedByOrgId: orgId,
      reason: reason ?? null,
      txHash: burnResult.txHash,
      status: 'CHAIN_BURNED',
    },
    update: {
      // Only overwritten when the prior row was FAILED — see the idempotency
      // guard above.
      status: 'CHAIN_BURNED',
      txHash: burnResult.txHash,
      reason: reason ?? null,
      requestedByUserId: userId,
      requestedByOrgId: orgId,
      bcrUnlockedAt: null,
    },
  });

  // ── Step 7: audit row for the operator-visible action ───────────────
  await recordAudit({
    orgId,
    userId,
    action: 'issuance.delist_requested',
    resource: 'issuance',
    resourceId: issuance.id,
    newValue: {
      delistRequestId: persisted.id,
      txHash: burnResult.txHash,
      bcrSerialId: issuance.bcrSerialId,
      bcrLockId: issuance.bcrLockId,
      contractId: issuance.tokenizationContractId,
      reason: reason ?? null,
    },
  });

  return {
    delistRequestId: persisted.id,
    txHash: burnResult.txHash,
  };
}
