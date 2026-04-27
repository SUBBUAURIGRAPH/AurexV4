import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';

/**
 * A6.4 Voluntary-Registry Label Forwarding — SCAFFOLD (Phase C, AV4-333).
 *
 * When an Article 6.4 authorized unit is also listed in a voluntary
 * registry (Verra / Gold Standard / ACR), the voluntary registry needs
 * metadata to display the "A6.4-labeled" badge on its serial and to
 * prevent double-claiming if the unit is used for NDC.
 *
 * This service returns the canonical JSON payload that we will push to
 * each voluntary registry's label-forwarding endpoint. Today, each
 * registry's A6.4 labeling endpoint is still being drafted — see:
 *   - Verra:         https://verra.org/article-6-4/ (TBD)
 *   - Gold Standard: https://www.goldstandard.org/ (TBD)
 *   - ACR:           https://acrcarbon.org/ (TBD)
 *
 * Once those endpoints publish, the push-side integration is a follow-up
 * (AV4-335+). Until then this is a read-only payload generator: callers
 * fetch the label JSON and forward it out-of-band (email, PDF, API poll)
 * per registry convention.
 *
 * Shape is intentionally aligned to the SB-sanctioned A6.4 public ledger
 * schema so that downstream mapping is a no-op.
 */

export interface RegistryLabel {
  unitType: 'A6.4ER' | 'A6.4ER_MC';
  vintage: number;
  activityId: string;
  hostCountry: string;
  serial: string;               // first→last, opaque to registry consumers
  serialFirst: string;
  serialLast: string;
  unitCount: number;
  authorizationStatus: 'NDC_USE' | 'OIMP' | 'NDC_AND_OIMP' | 'MITIGATION_CONTRIBUTION';
  caStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPLIED' | 'REVERSED';
  firstTransferAt: string | null;
  retirementStatus: string;
  retirementNarrative: string | null;
  retiredAt: string | null;
  /** Canonical registry link — future: per-registry label URLs. */
  ledgerUri: string;
  /**
   * AAT-R1 / AV4-418 — Article 6.4 interop: version the JSON we forward to
   * UNFCCC / voluntary registries so partners can key off a stable contract.
   * (Full UNFCCC wire spec remains TBD — this is Aurex’s export shape.)
   */
  article6LabelInterop: {
    schemaVersion: string;
    specNote: string;
  };
}

/**
 * Generate the label payload for a given block. Caller must be the block's
 * holder org (or SUPER_ADMIN — enforced at the route layer via requireOrgScope
 * + ownership check here).
 */
export async function generateLabel(
  blockId: string,
  orgId: string,
): Promise<RegistryLabel> {
  const block = await prisma.creditUnitBlock.findUnique({
    where: { id: blockId },
    include: { holderAccount: { select: { orgId: true } } },
  });
  if (!block) {
    throw new AppError(404, 'Not Found', 'Credit unit block not found');
  }
  // Ownership check — only the holder org can fetch the label. Admin
  // accounts (Adaptation Fund / OMGE / Buffer) have no orgId; they are
  // not end-user fetchable.
  if (block.holderAccount?.orgId !== orgId) {
    throw new AppError(404, 'Not Found', 'Credit unit block not found');
  }

  // Map Prisma enum → public label strings.
  const unitType: RegistryLabel['unitType'] =
    block.unitType === 'A6_4ER_MC' ? 'A6.4ER_MC' : 'A6.4ER';

  return {
    unitType,
    vintage: block.vintage,
    activityId: block.activityId,
    hostCountry: block.hostCountry,
    serial: `${block.serialFirst} → ${block.serialLast}`,
    serialFirst: block.serialFirst,
    serialLast: block.serialLast,
    unitCount: Number(block.unitCount),
    authorizationStatus: block.authorizationStatus as RegistryLabel['authorizationStatus'],
    caStatus: block.caStatus as RegistryLabel['caStatus'],
    firstTransferAt: block.firstTransferAt?.toISOString() ?? null,
    retirementStatus: block.retirementStatus,
    retirementNarrative: block.retirementNarrative,
    retiredAt: block.retiredAt?.toISOString() ?? null,
    ledgerUri: `https://aurex.in/a64/blocks/${block.id}`,
    article6LabelInterop: {
      schemaVersion: '1.0',
      specNote:
        'Aurex A6.4 public-ledger label JSON; follow UNFCCC Supervisory Body Article 6.4 registry interop as published, then map fields 1:1.',
    },
  };
}

// ── AAT-R1 / AV4-422 — CORSIA Phase 2 Article-6-Authorized IMP labels ──────

/**
 * CORSIA-eligibility tag emitted into `CreditUnitBlock.corsiaPhaseEligibility`.
 *
 *   null                       — not CORSIA-eligible (mitigation contribution
 *                                only, or no host LoA in scope).
 *   "phase1"                   — Phase 1 eligible (vintages 2024-2026 with an
 *                                OIMP-tagged authorization).
 *   "phase2"                   — Phase 2 eligible (vintages 2027+ with an
 *                                OIMP authorization but missing the explicit
 *                                IMP attestation in the LoA).
 *   "phase2_authorized_imp"    — Phase 2 eligible AND the LoA carries the
 *                                FORM-GOV-002 IMP / Article-6 attestation.
 */
export type CorsiaPhaseEligibility =
  | 'phase1'
  | 'phase2'
  | 'phase2_authorized_imp'
  | null;

export interface CorsiaLabelInput {
  /** Subset of CreditUnitBlock that the labelling decision depends on. */
  block: {
    authorizationStatus:
      | 'NDC_USE'
      | 'OIMP'
      | 'NDC_AND_OIMP'
      | 'MITIGATION_CONTRIBUTION';
    vintage: number;
  };
  /**
   * Subset of HostAuthorization. Pass `null` when the block was issued under
   * a mitigation-contribution flow (no LoA required). When a host LoA is
   * present, the full set of granularity fields drives Phase 2 IMP detection.
   */
  hostAuth: {
    status: string;
    formVersion: string | null;
    authorizedUses: string[];
    granularityTags: string[];
  } | null;
}

export interface CorsiaLabelDecision {
  corsiaPhaseEligibility: CorsiaPhaseEligibility;
  /** Set when the block earns the IMP-authorized label, otherwise null. */
  articleSixAuthorizedAt: Date | null;
  /** Human-readable rationale for the audit log. */
  rationale: string;
}

/** First vintage that lands in CORSIA Phase 2. */
const CORSIA_PHASE2_FIRST_VINTAGE = 2027;
/** Last vintage that qualifies for Phase 1 eligibility. */
const CORSIA_PHASE1_LAST_VINTAGE = 2026;
/** First vintage that CORSIA accepts at all (Phase 1 baseline). */
const CORSIA_FIRST_VINTAGE = 2021;

/**
 * Decide the CORSIA Phase / Article 6 IMP label for a credit unit block.
 *
 * Pure function — no DB / network. Caller is expected to write the returned
 * fields onto `CreditUnitBlock` via `prisma.creditUnitBlock.update`.
 *
 * Decision matrix:
 *   - MITIGATION_CONTRIBUTION                → null (never CORSIA-eligible)
 *   - vintage < 2021                          → null
 *   - hostAuth missing / not ISSUED           → null (LoA is required)
 *   - authorizationStatus ∈ {NDC_USE}          → null (NDC-only, blocked
 *                                                from international use)
 *   - vintage ≤ 2026 + OIMP / NDC_AND_OIMP   → "phase1"
 *   - vintage ≥ 2027 + OIMP / NDC_AND_OIMP   → "phase2"
 *      └── plus FORM-GOV-002, "oimp_corsia" in
 *          authorizedUses, "imp:authorized"
 *          granularity tag                    → "phase2_authorized_imp"
 *
 * The "imp:authorized" granularity tag is Aurex's canonical surface for the
 * IMP attestation field on FORM-GOV-002 (rendered into our model as a tag
 * because the form is open-ended on attestation strings). Operators encode
 * the attestation by adding the tag to the host-authorization granularityTags
 * array at issuance time.
 */
export function applyCorsiaLabels(
  input: CorsiaLabelInput,
  now: Date = new Date(),
): CorsiaLabelDecision {
  const { block, hostAuth } = input;

  // ── Hard exclusions ──────────────────────────────────────────────────
  if (block.authorizationStatus === 'MITIGATION_CONTRIBUTION') {
    return {
      corsiaPhaseEligibility: null,
      articleSixAuthorizedAt: null,
      rationale: 'Mitigation contribution unit — never CORSIA-eligible.',
    };
  }
  if (block.vintage < CORSIA_FIRST_VINTAGE) {
    return {
      corsiaPhaseEligibility: null,
      articleSixAuthorizedAt: null,
      rationale: `Vintage ${block.vintage} pre-dates CORSIA Phase 1 (2021).`,
    };
  }
  if (!hostAuth || hostAuth.status !== 'ISSUED') {
    return {
      corsiaPhaseEligibility: null,
      articleSixAuthorizedAt: null,
      rationale: 'No issued host-country LoA — CORSIA labelling not applicable.',
    };
  }
  if (block.authorizationStatus === 'NDC_USE') {
    return {
      corsiaPhaseEligibility: null,
      articleSixAuthorizedAt: null,
      rationale: 'NDC_USE-only authorisation — not OIMP, not CORSIA-eligible.',
    };
  }

  // ── Phase 1 (2021-2026) ──────────────────────────────────────────────
  if (block.vintage <= CORSIA_PHASE1_LAST_VINTAGE) {
    return {
      corsiaPhaseEligibility: 'phase1',
      articleSixAuthorizedAt: null,
      rationale:
        `Vintage ${block.vintage} + OIMP authorisation → CORSIA Phase 1 eligible.`,
    };
  }

  // ── Phase 2 (2027+) ──────────────────────────────────────────────────
  if (block.vintage >= CORSIA_PHASE2_FIRST_VINTAGE) {
    const formIsGov002 = (hostAuth.formVersion ?? '').startsWith('FORM-GOV-002');
    const authorizedUses = hostAuth.authorizedUses.map((u) => u.toLowerCase());
    const usesOimpCorsia = authorizedUses.includes('oimp_corsia');
    const granularityTags = hostAuth.granularityTags.map((t) => t.toLowerCase());
    const hasImpAttestation = granularityTags.includes('imp:authorized');

    if (formIsGov002 && usesOimpCorsia && hasImpAttestation) {
      return {
        corsiaPhaseEligibility: 'phase2_authorized_imp',
        articleSixAuthorizedAt: now,
        rationale:
          `Vintage ${block.vintage} + FORM-GOV-002 + oimp_corsia + IMP attestation ` +
          `→ Phase 2 Article-6 Authorized IMP.`,
      };
    }

    return {
      corsiaPhaseEligibility: 'phase2',
      articleSixAuthorizedAt: null,
      rationale:
        `Vintage ${block.vintage} + OIMP authorisation → CORSIA Phase 2 eligible ` +
        `(IMP attestation missing — operator must update LoA granularity tags).`,
    };
  }

  // Unreachable — both branches above cover the full vintage range above
  // CORSIA_FIRST_VINTAGE. Defensive default returned only if vintage rules
  // are revised in the future without updating this function.
  return {
    corsiaPhaseEligibility: null,
    articleSixAuthorizedAt: null,
    rationale: 'Unrecognised vintage / authorisation combination.',
  };
}
