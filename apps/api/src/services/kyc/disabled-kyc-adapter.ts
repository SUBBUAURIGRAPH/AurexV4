import type {
  GetVerificationStatusParams,
  GetVerificationStatusResult,
  KycRegistryAdapter,
  ListForSubjectParams,
  ListForSubjectResult,
  MarkBeneficiaryVerifiedParams,
  MarkBeneficiaryVerifiedResult,
  RevokeVerificationParams,
  RevokeVerificationResult,
  StartVerificationParams,
  StartVerificationResult,
} from './kyc-adapter.js';

/**
 * Default no-op adapter used when `KYC_ADAPTER` is unset or explicitly
 * set to `disabled`.
 *
 * Per BCR binding requirement B15 (`docs/BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md`)
 * Aurex must onboard a KYC vendor (Sumsub / Onfido / Persona / equivalent)
 * before any live KYC API call is permitted. Until that vendor contract
 * is signed, every adapter call must be a no-op that records audit
 * context only.
 *
 * This adapter lets every call path exercise the adapter seam without
 * side-effects — every method returns `synced: false` with the same
 * machine-parseable reason so downstream observability is clean and the
 * sync-recorder can still write a continuous `KycVerificationEvent` row
 * for every attempt. When the operator flips `KYC_ADAPTER` to a live
 * adapter, the audit history is continuous with no gaps.
 *
 * Contract: methods must NEVER throw — they always resolve with the
 * disabled-state failure result.
 */

const DISABLED_REASON = 'KYC adapter disabled — vendor onboarding pending';

export class DisabledKycAdapter implements KycRegistryAdapter {
  readonly adapterName = 'disabled';
  readonly isActive = false;

  async startVerification(
    _params: StartVerificationParams,
  ): Promise<StartVerificationResult> {
    return { synced: false, reason: DISABLED_REASON };
  }

  async getVerificationStatus(
    _params: GetVerificationStatusParams,
  ): Promise<GetVerificationStatusResult> {
    return { synced: false, reason: DISABLED_REASON };
  }

  async markBeneficiaryVerified(
    _params: MarkBeneficiaryVerifiedParams,
  ): Promise<MarkBeneficiaryVerifiedResult> {
    return { synced: false, reason: DISABLED_REASON };
  }

  async revokeVerification(
    _params: RevokeVerificationParams,
  ): Promise<RevokeVerificationResult> {
    return { synced: false, reason: DISABLED_REASON };
  }

  async listForSubject(
    _params: ListForSubjectParams,
  ): Promise<ListForSubjectResult> {
    return { synced: false, reason: DISABLED_REASON };
  }
}

export const DISABLED_KYC_ADAPTER_REASON = DISABLED_REASON;
