/**
 * Biocarbon retirement service shell — initiator side of the burn-on-retire
 * loop (AAT-ι / AV4-358).
 *
 * Sequence (BCR §5.5 step 13–15 + B16/B17):
 *
 *   1. `biocarbonRetirementPayloadSchema.parse(...)` — whole-ton (B11),
 *      beneficiary identity required (B16), purpose narrative refine for
 *      `OTHER`, kycVerificationId UUID shape.
 *   2. `verifyRetirementCompleteness(...)` — typed completeness errors
 *      (`MissingKycError`, `MissingBeneficiaryFieldsError`,
 *      `WholeTonViolationError`) before any DB / chain call.
 *   3. KYC runtime check via injected `kycLookup`. The KycVerification
 *      model is owned by AAT-θ / AV4-357 — this service does NOT import
 *      that model directly. Instead callers pass a `kycLookup` function
 *      that returns `{ approved, subjectKind, beneficiaryRef }`. The route
 *      layer wires the real lookup once AAT-θ merges; tests inject mocks.
 *   4. Issuance state guards: must exist; tokenizationStatus must be
 *      `MINTED` (not RETIRED, not FAILED, not absent).
 *   5. Idempotency probe on `(issuanceId, kycVerificationId)` — if a
 *      Retirement row already exists, return its cached values and skip
 *      both schema-driven persistence and the chain burn.
 *   6. Persist `Retirement` row with status=INITIATED.
 *   7. `aurigraphAdapter.burnAsset(...)` — the chain burn. The events
 *      worker (AAT-ζ / AV4-375) observes the BURN_FOR_RETIREMENT event
 *      asynchronously and calls `bcrAdapter.retireVCC(...)` with the
 *      pass-through payload. THIS service does NOT call BCR directly.
 *   8. On chain success → status=CHAIN_BURNED + persist txHash. On chain
 *      failure → status=FAILED, throw underlying error (no BCR-side
 *      side-effect, the chain didn't move).
 *
 * Audit trail: `recordAudit` row for `retirement.initiated` so the operator
 * dashboard sees the action; the events worker's `BcrRegistrySyncEvent`
 * row captures the BCR-side leg later.
 *
 * Errors:
 *   - `IssuanceNotFoundError`     — issuance id not in DB
 *   - `IssuanceNotMintedError`    — tokenizationStatus ≠ MINTED
 *   - `AlreadyRetiredError`       — issuance.status === RETIRED
 *   - `KycNotApprovedError`       — kycLookup returned not-approved
 *   - `RetirementDivergenceError` — partial idempotent row missing data
 *   - `ZodError`                  — schema validation failed (B7 / B11 / B16)
 *   - `WholeTonViolationError | MissingBeneficiaryFieldsError | MissingKycError`
 *     — typed completeness errors thrown by verifyRetirementCompleteness
 *   - chain adapter errors (ChainClientError / ChainServerError /
 *     QuotaExhaustedError) — surfaced verbatim from `aurigraphAdapter.burnAsset`
 */

import { prisma, Prisma } from '@aurex/database';
import {
  biocarbonRetirementPayloadSchema,
  buildBcrPassthroughPayload,
  verifyRetirementCompleteness,
  type BcrPassthroughPayload,
  type BiocarbonRetirementPayload,
} from '@aurex/shared';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import { recordAudit } from './audit-log.service.js';
import {
  getAurigraphAdapter,
  type AurigraphDltAdapter,
} from './chains/aurigraph-dlt-adapter.js';

// ── Public types ───────────────────────────────────────────────────────────

export interface RetireTokenOpts {
  issuanceId: string;
  /**
   * Client-supplied retirement payload. The `retiredBy` block is overwritten
   * by the service from `userId` / `orgId` so the route layer cannot be
   * fooled into recording a different actor than the authenticated session.
   */
  payload: Omit<BiocarbonRetirementPayload, 'retiredBy'> & {
    retiredBy?: BiocarbonRetirementPayload['retiredBy'];
  };
  userId: string;
  orgId: string;
  /**
   * Role the actor holds at retirement time. Stamped onto `retiredBy.role`.
   * Defaults to `'sustainability_admin'` for tests / operator-driven flows.
   */
  role?: string;
}

export interface RetireTokenResult {
  retirementId: string;
  /** May be `null` for an idempotent re-call before the chain burn lands. */
  txHash: string | null;
  /**
   * Pass-through payload the events worker will hand to
   * `bcrAdapter.retireVCC` once the BURN_FOR_RETIREMENT event reaches the
   * worker. Returned to the caller so the marketplace UI can show the
   * exact `{ vintage, amount, purpose, beneficiary }` that BCR will see.
   */
  expectedBcrPassthrough: BcrPassthroughPayload;
}

/**
 * Result of the injected KYC lookup.
 *
 * The KycVerification model + factory live in AAT-θ / AV4-357. The route
 * layer will wire a real `kycLookup` once that merges:
 *
 *   import { lookupKycVerification } from './kyc.service.js';
 *   await retireToken({ ... }, { kycLookup: lookupKycVerification });
 *
 * Tests inject a vi.fn() so this service stays decoupled from the KYC
 * data model.
 */
export interface KycLookupResult {
  /** Verification reached the APPROVED terminal state. */
  approved: boolean;
  /** What the verification is *for*. We require `beneficiary`. */
  subjectKind: 'beneficiary' | 'tokenizer' | 'org' | string;
  /**
   * The beneficiary identity the verification was issued against. Compared
   * against `retiredFor.legalIdRef ?? retiredFor.name` to ensure the
   * verification matches the actual retirement beneficiary.
   */
  beneficiaryRef: string;
}

export type KycLookup = (kycVerificationId: string) => Promise<KycLookupResult | null>;

export interface RetirementServiceDeps {
  /** Override the chain adapter — primarily for tests. */
  aurigraphAdapter?: Pick<AurigraphDltAdapter, 'burnAsset'>;
  /**
   * KYC lookup (B16 runtime gate). REQUIRED for production callers; tests
   * pass a vi.fn(). The route layer will wire AAT-θ's
   * `lookupKycVerification` once that ticket lands. Until then, callers
   * must explicitly inject a lookup so this service never silently passes
   * the gate.
   */
  kycLookup?: KycLookup;
}

// ── Errors ─────────────────────────────────────────────────────────────────

/** Issuance row does not exist or caller cannot see it. */
export class IssuanceNotFoundError extends AppError {
  constructor(issuanceId: string) {
    super(404, 'Not Found', `Issuance ${issuanceId} not found`);
    this.name = 'IssuanceNotFoundError';
    Object.setPrototypeOf(this, IssuanceNotFoundError.prototype);
  }
}

/** Issuance was never tokenized (or tokenization is FAILED / PENDING). */
export class IssuanceNotMintedError extends AppError {
  constructor(tokenizationStatus: string | null) {
    super(
      409,
      'Conflict',
      `Issuance is not mintable for retirement (tokenizationStatus=${
        tokenizationStatus ?? 'null'
      }); retirement requires tokenizationStatus=MINTED`,
    );
    this.name = 'IssuanceNotMintedError';
    Object.setPrototypeOf(this, IssuanceNotMintedError.prototype);
  }
}

/** Issuance.status is already RETIRED — chain side already burned. */
export class AlreadyRetiredError extends AppError {
  constructor(issuanceId: string) {
    super(
      409,
      'Conflict',
      `Issuance ${issuanceId} is already RETIRED`,
    );
    this.name = 'AlreadyRetiredError';
    Object.setPrototypeOf(this, AlreadyRetiredError.prototype);
  }
}

/** kycLookup returned not-approved or wrong subjectKind. */
export class KycNotApprovedError extends AppError {
  constructor(detail: string) {
    super(403, 'Forbidden', `Beneficiary KYC verification failed: ${detail}`);
    this.name = 'KycNotApprovedError';
    Object.setPrototypeOf(this, KycNotApprovedError.prototype);
  }
}

/** Idempotent re-call hit a partial Retirement row. Refuse to "fix" silently. */
export class RetirementDivergenceError extends AppError {
  constructor(detail: string) {
    super(409, 'Conflict', `Retirement row exists but diverges: ${detail}`);
    this.name = 'RetirementDivergenceError';
    Object.setPrototypeOf(this, RetirementDivergenceError.prototype);
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Resolve the KYC seam. If `deps.kycLookup` is set we use it; otherwise we
 * fall back to a stub that ALWAYS rejects so production code paths never
 * silently bypass the B16 gate. The route layer must wire AAT-θ's lookup
 * explicitly.
 *
 * The fallback is deliberately verbose — it's not a `() => true` because
 * a no-op default would be a B16 violation in production.
 */
function resolveKycLookup(deps: RetirementServiceDeps): KycLookup {
  if (deps.kycLookup) return deps.kycLookup;
  return async () => {
    throw new KycNotApprovedError(
      'kycLookup not wired into retirement.service — route layer must inject lookupKycVerification (AAT-θ / AV4-357) before retirement is callable in production',
    );
  };
}

async function loadIssuance(issuanceId: string) {
  return prisma.issuance.findUnique({
    where: { id: issuanceId },
  });
}

type LoadedIssuance = NonNullable<Awaited<ReturnType<typeof loadIssuance>>>;

/**
 * Verify the KYC verification id resolves to an APPROVED beneficiary
 * verification whose subject matches the payload's beneficiary. Throws
 * `KycNotApprovedError` for every failure mode (missing, not approved,
 * wrong subjectKind, mismatched beneficiaryRef).
 */
async function verifyKyc(
  kycLookup: KycLookup,
  payload: BiocarbonRetirementPayload,
): Promise<void> {
  const result = await kycLookup(payload.kycVerificationId);
  if (!result) {
    throw new KycNotApprovedError(
      `kycVerificationId ${payload.kycVerificationId} not found`,
    );
  }
  if (!result.approved) {
    throw new KycNotApprovedError(
      `kycVerificationId ${payload.kycVerificationId} is not in APPROVED state`,
    );
  }
  if (result.subjectKind !== 'beneficiary') {
    throw new KycNotApprovedError(
      `kycVerificationId ${payload.kycVerificationId} subjectKind=${result.subjectKind}; expected 'beneficiary'`,
    );
  }
  const expectedRef = payload.retiredFor.legalIdRef ?? payload.retiredFor.name;
  if (result.beneficiaryRef !== expectedRef) {
    throw new KycNotApprovedError(
      `kycVerificationId ${payload.kycVerificationId} was issued for beneficiaryRef=${result.beneficiaryRef}; retirement payload references ${expectedRef}`,
    );
  }
}

/**
 * Validate the issuance is in a terminal state that allows retirement.
 *
 *   - `tokenizationStatus === 'MINTED'` — required (no point retiring an
 *     unminted credit; the chain has nothing to burn).
 *   - `status !== 'RETIRED'` — already retired, AlreadyRetiredError.
 */
function assertIssuanceRetirable(issuance: LoadedIssuance): void {
  if (issuance.status === 'RETIRED') {
    throw new AlreadyRetiredError(issuance.id);
  }
  if (issuance.tokenizationStatus !== 'MINTED') {
    throw new IssuanceNotMintedError(issuance.tokenizationStatus ?? null);
  }
  if (!issuance.tokenizationContractId) {
    throw new IssuanceNotMintedError(
      `${issuance.tokenizationStatus ?? 'null'} (no tokenizationContractId)`,
    );
  }
}

// ── The service ────────────────────────────────────────────────────────────

/**
 * Initiate retirement of a tokenized biocarbon issuance.
 *
 * Idempotent on `(issuanceId, kycVerificationId)`: a re-call with the same
 * pair returns the existing row.
 */
export async function retireToken(
  opts: RetireTokenOpts,
  deps: RetirementServiceDeps = {},
): Promise<RetireTokenResult> {
  const { issuanceId, userId, orgId } = opts;
  const role = opts.role ?? 'sustainability_admin';

  // ── Step 0: stamp retiredBy from auth + parse + completeness gate ───
  const stampedPayload = {
    ...opts.payload,
    retiredBy: { userId, orgId, role },
  } as BiocarbonRetirementPayload;

  const payload = biocarbonRetirementPayloadSchema.parse(stampedPayload);
  // Belt-and-braces typed completeness check — ensures sub-ton or missing
  // beneficiary fields throw a typed completeness error BEFORE we touch DB
  // or chain. The schema parse already enforces these, so this is a defence
  // in depth for callers that pre-built the payload via `safeParse`.
  verifyRetirementCompleteness(payload);

  const expectedBcrPassthrough = buildBcrPassthroughPayload(payload);

  // ── Step 1: KYC runtime gate (B16) ───────────────────────────────────
  const kycLookup = resolveKycLookup(deps);
  await verifyKyc(kycLookup, payload);

  // ── Step 2: load issuance + state guards ────────────────────────────
  const issuance = await loadIssuance(issuanceId);
  if (!issuance) {
    throw new IssuanceNotFoundError(issuanceId);
  }
  assertIssuanceRetirable(issuance);

  // Cross-check vintage + bcrSerialId match the asset (server-enforced).
  if (issuance.vintage !== payload.vintage) {
    throw new AppError(
      409,
      'Conflict',
      `Retirement vintage=${payload.vintage} does not match issuance.vintage=${issuance.vintage}`,
    );
  }
  if (issuance.bcrSerialId && issuance.bcrSerialId !== payload.bcrSerialId) {
    throw new AppError(
      409,
      'Conflict',
      `Retirement bcrSerialId=${payload.bcrSerialId} does not match issuance.bcrSerialId=${issuance.bcrSerialId}`,
    );
  }

  // ── Step 3: idempotency probe ────────────────────────────────────────
  const existing = await prisma.retirement.findUnique({
    where: {
      issuanceId_kycVerificationId: {
        issuanceId,
        kycVerificationId: payload.kycVerificationId,
      },
    },
  });
  if (existing) {
    if (existing.status === 'FAILED') {
      // Existing row failed previously — surface the divergence rather
      // than silently retrying. Operator must explicitly retry by clearing
      // the FAILED row (or by using a fresh kycVerificationId).
      throw new RetirementDivergenceError(
        `existing retirement ${existing.id} is in FAILED status; clear or retry with a new kycVerificationId`,
      );
    }
    logger.info(
      { retirementId: existing.id, issuanceId, status: existing.status },
      'retireToken: idempotent re-call — returning existing retirement',
    );
    return {
      retirementId: existing.id,
      txHash: existing.txHash ?? null,
      expectedBcrPassthrough,
    };
  }

  // ── Step 4: persist Retirement row (status=INITIATED) ────────────────
  const retirement = await prisma.retirement.create({
    data: {
      issuanceId,
      kycVerificationId: payload.kycVerificationId,
      bcrSerialId: payload.bcrSerialId,
      tonnesRetired: payload.tonnesRetired,
      vintage: payload.vintage,
      purpose: payload.purpose,
      purposeNarrative: payload.purposeNarrative ?? null,
      retiredFor: payload.retiredFor as unknown as Prisma.InputJsonValue,
      retiredByUserId: userId,
      retiredByOrgId: orgId,
      retirementCertificateUrl: payload.retirementCertificateUrl ?? null,
      status: 'INITIATED',
    },
  });

  // ── Step 5: chain burn ──────────────────────────────────────────────
  // The chain adapter's burnAsset spec is `{ assetId, amount, reason,
  // retiredBy? }`. We map the retirement payload onto it. The metadata the
  // events worker reads from the public ledger is encoded into `reason`
  // as a JSON blob (the worker already inspects metadata.retiredFor /
  // metadata.retirementPurpose for classification — see
  // aurigraph-events.worker.ts:parseBurnEntry).
  const aurigraphAdapter = deps.aurigraphAdapter ?? getAurigraphAdapter();
  const burnReason = JSON.stringify({
    retirement: true,
    aurexIssuanceId: issuanceId,
    aurexRetirementId: retirement.id,
    bcrSerialId: payload.bcrSerialId,
    bcrLockId: issuance.bcrLockId ?? null,
    vintage: payload.vintage,
    netUnits: payload.tonnesRetired,
    retiredFor: payload.retiredFor.name,
    retiredBy: payload.retiredFor.orgRef ?? payload.retiredFor.name,
    retirementPurpose:
      payload.purpose === 'OTHER' ? payload.purposeNarrative : payload.purpose,
    bcrPassthrough: expectedBcrPassthrough,
  });

  let txHash: string;
  try {
    const burnResult = await aurigraphAdapter.burnAsset({
      assetId: issuance.tokenizationContractId!,
      amount: payload.tonnesRetired,
      reason: burnReason,
      retiredBy: payload.retiredFor.orgRef ?? payload.retiredFor.name,
    });
    txHash = burnResult.txHash;
  } catch (err) {
    // Chain didn't move — mark the row FAILED so the operator can see why.
    // Re-throw the underlying error verbatim so the route layer can convert
    // to RFC 7807 with the right status (502 / 503 / 429 etc).
    await prisma.retirement
      .update({
        where: { id: retirement.id },
        data: { status: 'FAILED' },
      })
      .catch((updateErr: unknown) => {
        logger.error(
          {
            err: updateErr instanceof Error ? updateErr.message : String(updateErr),
            retirementId: retirement.id,
          },
          'retireToken: failed to mark retirement FAILED (non-fatal)',
        );
      });
    throw err;
  }

  // ── Step 6: persist txHash + flip to CHAIN_BURNED ───────────────────
  await prisma.retirement.update({
    where: { id: retirement.id },
    data: {
      status: 'CHAIN_BURNED',
      txHash,
    },
  });

  // ── Step 7: audit log (operator-visible action) ─────────────────────
  await recordAudit({
    orgId,
    userId,
    action: 'retirement.initiated',
    resource: 'issuance',
    resourceId: issuanceId,
    newValue: {
      retirementId: retirement.id,
      bcrSerialId: payload.bcrSerialId,
      tonnesRetired: payload.tonnesRetired,
      vintage: payload.vintage,
      purpose: payload.purpose,
      retiredFor: payload.retiredFor.name,
      txHash,
      kycVerificationId: payload.kycVerificationId,
    },
  });

  return {
    retirementId: retirement.id,
    txHash,
    expectedBcrPassthrough,
  };
}
