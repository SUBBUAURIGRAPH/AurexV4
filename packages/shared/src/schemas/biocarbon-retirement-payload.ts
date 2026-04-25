/**
 * Biocarbon retirement payload schema (AAT-ι / AV4-358).
 *
 * Implements the marketplace-side preconditions for a BCR-bound retirement
 * call (BioCarbon Registry SOP §5.5 step 13–15):
 *
 *   §5.5 step 13 — beneficiary identity verification on the marketplace
 *                  before issuing retirement.
 *   §5.5 step 14 — marketplace calls BCR API with vintage / amount /
 *                  purpose / beneficiary on retirement.
 *   §5.5 step 15 — BCR records the retirement statement and returns a
 *                  durable URL.
 *
 * Binding requirements covered:
 *
 *   B11 — whole-ton accounting: `tonnesRetired` must be a positive integer.
 *   B16 — beneficiary identity verification + pass-through to BCR on
 *         retirement (verified by `kycVerificationId`).
 *   B17 — burn-on-retirement → BCR API call with vintage / amount /
 *         purpose / beneficiary (`bcrPassthroughPayload` mirrors that exact
 *         shape and is consumed by the events worker via
 *         `bcrAdapter.retireVCC(...)`).
 *
 * This module is shared, schema-only, and synchronous. The runtime KYC
 * lookup (does `kycVerificationId` resolve to an APPROVED KycVerification
 * with `subjectKind === 'beneficiary'`?) is the responsibility of the
 * service layer because the KycVerification model is owned by AAT-θ /
 * AV4-357 and we deliberately keep that out of `@aurex/shared`. See the
 * `kycLookup` injection seam in `apps/api/src/services/retirement.service.ts`.
 *
 * Composition: this schema reuses `bcrSerialIdSchema` from
 * `biocarbon-asset-metadata.ts` rather than duplicating the BCR Serial ID
 * length / shape constraints.
 */

import { z } from 'zod';
import { bcrSerialIdSchema } from './biocarbon-asset-metadata.js';

// ── Sub-schemas ────────────────────────────────────────────────────────────

/**
 * Retirement purpose enum. Mirrors the BCR-side purpose categories with one
 * Aurex-specific extension (`OTHER`) that requires `purposeNarrative` to be
 * set so the retirement statement still has a human-readable rationale.
 */
export const retirementPurposeSchema = z.enum([
  'CSR',
  'NDC_OFFSET',
  'CORSIA',
  'PROGRAMMATIC',
  'OTHER',
]);
export type RetirementPurpose = z.infer<typeof retirementPurposeSchema>;

/**
 * Verified beneficiary identity. `name` is mandatory because the retirement
 * statement is publicly attributable (B16). If `legalIdRef` is set, a
 * `jurisdiction` is required so the legal id is unambiguous (e.g. an
 * Indian PAN vs. a US EIN look identical at the string level — only the
 * jurisdiction disambiguates).
 *
 * The runtime KYC check (does this beneficiary actually have an APPROVED
 * KycVerification?) lives in the service layer and is keyed off
 * `kycVerificationId` on the parent payload.
 */
export const retirementBeneficiarySchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    legalIdRef: z.string().trim().min(1).max(255).optional(),
    jurisdiction: z.string().trim().min(2).max(64).optional(),
    orgRef: z.string().trim().min(1).max(255).optional(),
  })
  .refine(
    (b) => !b.legalIdRef || (b.legalIdRef && b.jurisdiction),
    {
      message:
        'jurisdiction is required when legalIdRef is set (legal id must be qualified by issuing jurisdiction)',
      path: ['jurisdiction'],
    },
  );
export type RetirementBeneficiary = z.infer<typeof retirementBeneficiarySchema>;

/**
 * Aurex actor (the human / org that initiated the retirement). Filled in by
 * the route layer from the authenticated session — clients never set this
 * directly.
 */
export const retiringActorSchema = z.object({
  userId: z.string().uuid(),
  orgId: z.string().uuid(),
  role: z.string().min(1).max(64),
});
export type RetiringActor = z.infer<typeof retiringActorSchema>;

/**
 * BCR pass-through payload — exactly the §5.5 step-14–15 shape. This is what
 * the events worker hands to `bcrAdapter.retireVCC(...)` once the on-chain
 * burn settles.
 */
export const bcrPassthroughPayloadSchema = z.object({
  vintage: z.number().int().min(2000).max(2100),
  amount: z.number().int().positive(),
  purpose: z.string().min(1).max(255),
  beneficiary: z.object({
    name: z.string().min(1).max(255),
    legalIdRef: z.string().max(255).optional(),
    jurisdiction: z.string().max(64).optional(),
    orgRef: z.string().max(255).optional(),
  }),
});
export type BcrPassthroughPayload = z.infer<typeof bcrPassthroughPayloadSchema>;

// ── Top-level schema ───────────────────────────────────────────────────────

/**
 * Full retirement payload accepted by `retirement.service.retireToken(...)`.
 *
 * Surface contract:
 *
 *   - `bcrSerialId` is the immutable BCR serial recorded at mint time.
 *   - `tonnesRetired` is a positive integer (whole-ton, B11). Sub-ton or
 *     zero values are rejected before any chain or BCR call.
 *   - `vintage` is enforced equal to the asset's vintage by the service
 *     layer (the schema only checks the year range here).
 *   - `purpose` is one of the BCR purpose categories. `OTHER` requires
 *     `purposeNarrative`.
 *   - `retiredFor` (beneficiary): name required; `legalIdRef` requires
 *     `jurisdiction`.
 *   - `retiredBy` is filled by the server from the authenticated session.
 *   - `kycVerificationId` is REQUIRED. The service confirms that this
 *     resolves to an APPROVED KycVerification with `subjectKind ===
 *     'beneficiary'` and `beneficiaryRef === retiredFor.legalIdRef ??
 *     retiredFor.name`. The schema only enforces the UUID shape — the
 *     runtime check belongs to the service layer.
 *   - `retirementCertificateUrl` is optional; populated when the
 *     marketplace generates a public retirement statement before the BCR
 *     leg lands (B16 nice-to-have).
 *   - `bcrPassthroughPayload` is OPTIONAL on input — clients may pre-build
 *     it, but the service prefers `buildBcrPassthroughPayload(parsed)` so
 *     the payload is guaranteed to mirror the rest of the parsed object.
 */
export const biocarbonRetirementPayloadSchema = z
  .object({
    bcrSerialId: bcrSerialIdSchema,
    tonnesRetired: z
      .number()
      .int({ message: 'tonnesRetired must be a whole number (B11 whole-ton accounting)' })
      .positive({ message: 'tonnesRetired must be > 0 (B11 whole-ton accounting)' }),
    vintage: z.number().int().min(2000).max(2100),
    purpose: retirementPurposeSchema,
    purposeNarrative: z.string().max(500).optional(),
    retiredFor: retirementBeneficiarySchema,
    retiredBy: retiringActorSchema,
    kycVerificationId: z.string().uuid({
      message: 'kycVerificationId must be a UUID referencing an APPROVED KycVerification',
    }),
    retirementCertificateUrl: z.string().url().max(2048).optional(),
    bcrPassthroughPayload: bcrPassthroughPayloadSchema.optional(),
  })
  .refine(
    (p) => p.purpose !== 'OTHER' || (p.purposeNarrative && p.purposeNarrative.trim().length > 0),
    {
      message: 'purposeNarrative is required when purpose === "OTHER"',
      path: ['purposeNarrative'],
    },
  );

export type BiocarbonRetirementPayload = z.infer<typeof biocarbonRetirementPayloadSchema>;

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build the BCR §5.5 step 14–15 pass-through payload from a parsed
 * retirement payload. The shape is normative: BCR's adapter layer expects
 * exactly `{ vintage, amount, purpose, beneficiary }` — DO NOT add extra
 * keys here without coordinating with the BCR adapter contract
 * (`bcrAdapter.retireVCC(...)`).
 *
 * `purpose` is the enum value for known categories and the narrative for
 * `OTHER` (BCR's free-text retirement statement field).
 */
export function buildBcrPassthroughPayload(
  payload: BiocarbonRetirementPayload,
): BcrPassthroughPayload {
  const purposeText =
    payload.purpose === 'OTHER'
      ? // Schema refine guarantees narrative is present when purpose is OTHER.
        (payload.purposeNarrative ?? 'OTHER')
      : payload.purpose;

  return {
    vintage: payload.vintage,
    amount: payload.tonnesRetired,
    purpose: purposeText,
    beneficiary: {
      name: payload.retiredFor.name,
      legalIdRef: payload.retiredFor.legalIdRef,
      jurisdiction: payload.retiredFor.jurisdiction,
      orgRef: payload.retiredFor.orgRef,
    },
  };
}

// ── Typed completeness errors ──────────────────────────────────────────────

/** Base for typed retirement-completeness failures (helps `instanceof` tests). */
export class RetirementCompletenessError extends Error {
  public readonly fieldPath: string;
  constructor(message: string, fieldPath: string) {
    super(message);
    this.name = 'RetirementCompletenessError';
    this.fieldPath = fieldPath;
    Object.setPrototypeOf(this, RetirementCompletenessError.prototype);
  }
}

/** `kycVerificationId` was missing or did not resolve to an APPROVED record. */
export class MissingKycError extends RetirementCompletenessError {
  constructor(message = 'kycVerificationId missing or not approved') {
    super(message, 'kycVerificationId');
    this.name = 'MissingKycError';
    Object.setPrototypeOf(this, MissingKycError.prototype);
  }
}

/** Beneficiary block is missing required identity fields (B16). */
export class MissingBeneficiaryFieldsError extends RetirementCompletenessError {
  constructor(fieldPath: string, message?: string) {
    super(
      message ?? `Beneficiary identity is incomplete: missing ${fieldPath}`,
      fieldPath,
    );
    this.name = 'MissingBeneficiaryFieldsError';
    Object.setPrototypeOf(this, MissingBeneficiaryFieldsError.prototype);
  }
}

/** `tonnesRetired` was not a positive whole integer (B11). */
export class WholeTonViolationError extends RetirementCompletenessError {
  constructor(value: unknown) {
    super(
      `tonnesRetired must be a positive whole integer (B11); received ${String(value)}`,
      'tonnesRetired',
    );
    this.name = 'WholeTonViolationError';
    Object.setPrototypeOf(this, WholeTonViolationError.prototype);
  }
}

export interface VerifyRetirementOptions {
  /**
   * When `true`, treats the presence of `kycVerificationId` as sufficient.
   * The service-layer runtime check (does it resolve to APPROVED?) is the
   * caller's job; this helper just ensures the payload itself is shaped
   * correctly so the service can attempt the lookup.
   *
   * Defaults to `true` — the schema-level guarantee is presence + UUID
   * shape; the service performs the deeper check.
   */
  acceptKycPresenceOnly?: boolean;
}

/**
 * Throw a typed completeness error for any structural retirement failure
 * the service layer wants to surface BEFORE attempting the chain burn.
 *
 * Distinct from `biocarbonRetirementPayloadSchema.parse()` — this helper is
 * an *additional* gate the service can call after the schema passes (e.g.
 * for runtime invariants the schema cannot express, like beneficiary
 * cross-field consistency).
 *
 * @throws WholeTonViolationError       — tonnesRetired ≤ 0 or fractional
 * @throws MissingKycError              — kycVerificationId absent
 * @throws MissingBeneficiaryFieldsError — required beneficiary fields missing
 */
export function verifyRetirementCompleteness(
  payload: Partial<BiocarbonRetirementPayload>,
  options: VerifyRetirementOptions = {},
): void {
  // 1. Whole-ton (B11). Run before anything BCR-side so we never call out
  //    on a sub-ton or non-positive amount.
  const t = payload.tonnesRetired;
  if (typeof t !== 'number' || !Number.isFinite(t) || !Number.isInteger(t) || t <= 0) {
    throw new WholeTonViolationError(t);
  }

  // 2. Beneficiary fields (B16).
  const b = payload.retiredFor;
  if (!b || typeof b !== 'object') {
    throw new MissingBeneficiaryFieldsError('retiredFor');
  }
  if (!b.name || b.name.trim().length === 0) {
    throw new MissingBeneficiaryFieldsError('retiredFor.name');
  }
  if (b.legalIdRef && (!b.jurisdiction || b.jurisdiction.trim().length === 0)) {
    throw new MissingBeneficiaryFieldsError(
      'retiredFor.jurisdiction',
      'jurisdiction is required when legalIdRef is set',
    );
  }

  // 3. KYC presence (B16 — the actual approval check is service-side).
  const acceptKycPresenceOnly = options.acceptKycPresenceOnly ?? true;
  if (acceptKycPresenceOnly) {
    if (!payload.kycVerificationId || payload.kycVerificationId.trim().length === 0) {
      throw new MissingKycError();
    }
  }
}
