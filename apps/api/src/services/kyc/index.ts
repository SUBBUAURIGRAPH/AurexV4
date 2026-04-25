import { DisabledKycAdapter } from './disabled-kyc-adapter.js';
import { MockKycAdapter } from './mock-kyc-adapter.js';
import type { KycRegistryAdapter } from './kyc-adapter.js';

export type {
  GetVerificationStatusParams,
  GetVerificationStatusResult,
  KycAdapterResult,
  KycAttestation,
  KycLevel,
  KycRegistryAdapter,
  KycSubjectKind,
  KycSubjectListEntry,
  KycVerificationStatus,
  ListForSubjectParams,
  ListForSubjectResult,
  MarkBeneficiaryVerifiedParams,
  MarkBeneficiaryVerifiedResult,
  RevokeVerificationParams,
  RevokeVerificationResult,
  StartVerificationParams,
  StartVerificationResult,
} from './kyc-adapter.js';
export { DisabledKycAdapter } from './disabled-kyc-adapter.js';
export { MockKycAdapter } from './mock-kyc-adapter.js';

/**
 * KYC adapter factory.
 *
 * Reads `KYC_ADAPTER` (default `disabled`). Supported values:
 *
 *   - `disabled` — default. Returns a `DisabledKycAdapter` that records
 *     every call as `synced: false` with a "vendor onboarding pending"
 *     reason. No network side-effects. Use this in production until the
 *     KYC vendor (Sumsub / Onfido / Persona) contract is signed (BCR
 *     binding requirement B15 in
 *     `docs/BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md`).
 *
 *   - `mock` — returns a `MockKycAdapter` with an in-memory state machine
 *     that faithfully reproduces a vendor-style KYC flow. Intended for
 *     unit tests, integration smoke tests, and the Aurigraph DLT V12
 *     sandbox tenant. NEVER use in production.
 *
 *   - `sumsub` / `onfido` / `persona` — reserved names. Throw at startup
 *     until the concrete adapter is implemented (Sprint 3+ ticket).
 *     Misconfiguration fails fast in production.
 *
 * Any other value throws to avoid silently falling back to disabled in a
 * misconfigured environment.
 *
 * The adapter instance is cached as a module-level singleton so repeated
 * calls within a process share state — important for the `mock` adapter
 * because its state machine lives in memory.
 */

const VALID_RESERVED_NAMES = ['sumsub', 'onfido', 'persona'] as const;

let cached: KycRegistryAdapter | null = null;

export function getKycAdapter(): KycRegistryAdapter {
  if (cached) return cached;

  const raw = (process.env.KYC_ADAPTER ?? 'disabled').trim().toLowerCase();

  if (raw === '' || raw === 'disabled') {
    cached = new DisabledKycAdapter();
    return cached;
  }

  if (raw === 'mock') {
    cached = new MockKycAdapter();
    return cached;
  }

  if ((VALID_RESERVED_NAMES as readonly string[]).includes(raw)) {
    throw new Error(
      `KYC_ADAPTER=${raw} is reserved but not yet implemented — ` +
        `sign the ${raw} vendor contract first (BCR binding requirement B15, ` +
        `docs/BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md), then implement a ` +
        `concrete adapter in apps/api/src/services/kyc/ and register it here. ` +
        `Set KYC_ADAPTER=disabled (or unset) to use the no-op default in the ` +
        `meantime.`,
    );
  }

  throw new Error(
    `KYC_ADAPTER=${raw} is not a recognised adapter name. ` +
      `Supported values: disabled (default), mock, sumsub, onfido, persona. ` +
      `See docs/BIOCARBON_SPARC_PLAN.md (Sprint 3) for the adapter runbook.`,
  );
}

/**
 * Test-only helper. Clears the cached singleton so a fresh factory call
 * re-reads the environment (and re-instantiates a new MockKycAdapter with
 * empty state). Not exported for production code paths.
 */
export function __resetKycAdapterCache(): void {
  cached = null;
}
