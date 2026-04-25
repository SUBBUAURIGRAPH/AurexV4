/**
 * KYC / CDD / AML / CTF adapter interface (AAT-θ / AV4-354).
 *
 * Satisfies BCR binding requirement B15 — "KYC / CDD / AML / CTF + tax
 * compliance on marketplace" (`docs/BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md`).
 * Also seeds B16 (beneficiary identity verification) ahead of the BCR
 * retirement pass-through implemented in AAT-ι.
 *
 * Adapter pattern mirrors the BCR registry adapter (Sprint 1):
 *
 *   - Default `disabled` adapter — no-op, returns `synced=false` with a
 *     "vendor onboarding pending" reason. No network side-effects until a
 *     vendor (Sumsub / Onfido / Persona) contract is signed.
 *   - `mock` adapter — in-memory state machine for tests + Aurigraph DLT
 *     V12 sandbox.
 *   - Reserved `sumsub` / `onfido` / `persona` slots — throw at startup
 *     until the concrete adapter lands.
 *
 * Lifecycle:
 *
 *   1. `startVerification`        — kick off a KYC job for a User or for a
 *                                   beneficiary identity not in the User
 *                                   table (B16). Returns a verification id
 *                                   plus initial status.
 *   2. `getVerificationStatus`    — poll the vendor for the latest status,
 *                                   risk score, and sanctions-hit flag.
 *                                   Used by ops dashboards + the BCR
 *                                   retirement guard.
 *   3. `markBeneficiaryVerified`  — bind a beneficiary reference + signed
 *                                   attestations to an approved verification
 *                                   so the BCR retirement statement (B16)
 *                                   can be issued.
 *   4. `revokeVerification`       — operator / sanctions-list-update path.
 *                                   Flips the verification to `revoked`
 *                                   and records the reason.
 *   5. `listForSubject`           — read-only audit query.
 *
 * Contract: adapters MUST NOT throw on remote-side failures. Return
 * `{ synced: false, reason }` so the caller can record a clean
 * `KycVerificationEvent` audit row. The factory may throw on
 * misconfiguration (env var wrong); that's OK because it fires once at boot.
 */

export interface KycAdapterResult<TPayload = Record<string, unknown>> {
  /** `true` when the call succeeded and the state transition is durable. */
  synced: boolean;
  /** Human-readable explanation when `synced=false`. Persisted to the
   *  audit trail and surfaced in ops dashboards. */
  reason?: string;
  /** Adapter-specific payload (verification id, status, risk score, …).
   *  Always serialisable. */
  data?: TPayload;
}

/** Subject of a verification — either an internal User row, or an
 *  external beneficiary identity supplied at retirement time (B16). */
export type KycSubjectKind = 'user' | 'beneficiary';

/** Verification depth. `basic` covers KYC/CDD; `enhanced` adds AML/CTF
 *  with sanctions-list screening + PEP screening. */
export type KycLevel = 'basic' | 'enhanced';

/** Canonical states tracked by the verification record. Mirrors the
 *  Prisma `KycStatus` enum with snake-case values used in adapter
 *  responses. */
export type KycVerificationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revoked';

export interface StartVerificationParams {
  subjectKind: KycSubjectKind;
  /** Stable reference to the subject. For `subjectKind=user` this is the
   *  User UUID; for `subjectKind=beneficiary` it is a caller-supplied
   *  identifier (e.g. retirement-statement reference, organisation id). */
  subjectRef: string;
  level: KycLevel;
  /** Free-form vendor metadata (legal name, country, doc type, ...).
   *  Persisted on the verification row so the audit trail is complete. */
  metadata: Record<string, unknown>;
}

export type StartVerificationResult = KycAdapterResult<{
  verificationId: string;
  status: KycVerificationStatus;
  vendorRef?: string;
}>;

export interface GetVerificationStatusParams {
  verificationId: string;
}

export type GetVerificationStatusResult = KycAdapterResult<{
  status: KycVerificationStatus;
  riskScore?: number;
  sanctionsHit?: boolean;
  lastCheckedAt: string; // ISO-8601
}>;

/** Beneficiary attestation captured at retirement-statement time (B16). */
export interface KycAttestation {
  /** Stable identifier for the attestation type (e.g. `aml_screening_v1`). */
  kind: string;
  /** Vendor-supplied or operator-supplied attestation value. */
  value: string;
  /** ISO-8601 timestamp the attestation was signed. */
  signedAt: string;
}

export interface MarkBeneficiaryVerifiedParams {
  verificationId: string;
  /** Caller-supplied beneficiary reference (e.g. retirement-statement id,
   *  external retiree organisation id). */
  beneficiaryRef: string;
  attestations: KycAttestation[];
}

export type MarkBeneficiaryVerifiedResult = KycAdapterResult<{
  verificationId: string;
  beneficiaryRef: string;
  attestationCount: number;
}>;

export interface RevokeVerificationParams {
  verificationId: string;
  reason: string;
}

export type RevokeVerificationResult = KycAdapterResult<{
  verificationId: string;
  status: KycVerificationStatus;
}>;

export interface ListForSubjectParams {
  subjectKind: KycSubjectKind;
  subjectRef: string;
}

export interface KycSubjectListEntry {
  verificationId: string;
  level: KycLevel;
  status: KycVerificationStatus;
  vendorRef?: string;
  riskScore?: number;
  sanctionsHit?: boolean;
  beneficiaryRef?: string;
  lastCheckedAt?: string;
  createdAt: string;
}

export type ListForSubjectResult = KycAdapterResult<{
  entries: KycSubjectListEntry[];
}>;

export interface KycRegistryAdapter {
  startVerification(
    params: StartVerificationParams,
  ): Promise<StartVerificationResult>;

  getVerificationStatus(
    params: GetVerificationStatusParams,
  ): Promise<GetVerificationStatusResult>;

  markBeneficiaryVerified(
    params: MarkBeneficiaryVerifiedParams,
  ): Promise<MarkBeneficiaryVerifiedResult>;

  revokeVerification(
    params: RevokeVerificationParams,
  ): Promise<RevokeVerificationResult>;

  listForSubject(params: ListForSubjectParams): Promise<ListForSubjectResult>;

  /** Human-readable identifier for audit logs. */
  readonly adapterName: string;
  readonly isActive: boolean;
}
