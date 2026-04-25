import { randomUUID } from 'node:crypto';
import type {
  GetVerificationStatusParams,
  GetVerificationStatusResult,
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

/**
 * In-memory mock implementation of `KycRegistryAdapter` for tests and the
 * Aurigraph DLT V12 sandbox tenant. Faithfully reproduces a vendor-style
 * KYC state machine without any network calls:
 *
 *   pending → approved          (auto-approves on first getVerificationStatus
 *                                unless seeded otherwise; or driven by
 *                                __seedStatus for deterministic tests)
 *   pending → rejected          (driven by __seedStatus)
 *   approved → revoked          (revokeVerification — sanctions-list update)
 *   pending → revoked           (revokeVerification before approval)
 *
 * Approved verifications can additionally be tagged with a beneficiary
 * reference + attestations via `markBeneficiaryVerified` (B16). Calling
 * `markBeneficiaryVerified` on a non-approved verification fails cleanly
 * with `synced: false` rather than throwing.
 *
 * This adapter is intended for unit tests, integration smoke tests, and
 * the Aurigraph DLT sandbox. NEVER use in production — `sumsub` (or
 * equivalent) is the production target once the vendor contract is signed.
 */

interface MockVerificationRecord {
  verificationId: string;
  vendorRef: string;
  subjectKind: KycSubjectKind;
  subjectRef: string;
  level: KycLevel;
  status: KycVerificationStatus;
  riskScore: number;
  sanctionsHit: boolean;
  beneficiaryRef: string | null;
  attestations: KycAttestation[];
  metadata: Record<string, unknown>;
  lastCheckedAt: string;
  createdAt: string;
  revokedReason: string | null;
}

export class MockKycAdapter implements KycRegistryAdapter {
  readonly adapterName = 'mock';
  readonly isActive = true;

  private readonly verifications = new Map<string, MockVerificationRecord>();

  /** Test helper — wipe in-memory state. Not part of the public adapter
   *  contract. */
  __reset(): void {
    this.verifications.clear();
  }

  /** Test helper — force a verification into a specific status, bypassing
   *  the auto-approval flow. Returns true if the verification existed. */
  __seedStatus(
    verificationId: string,
    status: KycVerificationStatus,
    overrides: { riskScore?: number; sanctionsHit?: boolean } = {},
  ): boolean {
    const v = this.verifications.get(verificationId);
    if (!v) return false;
    v.status = status;
    if (overrides.riskScore !== undefined) v.riskScore = overrides.riskScore;
    if (overrides.sanctionsHit !== undefined) {
      v.sanctionsHit = overrides.sanctionsHit;
    }
    v.lastCheckedAt = new Date().toISOString();
    return true;
  }

  async startVerification(
    params: StartVerificationParams,
  ): Promise<StartVerificationResult> {
    if (!params.subjectRef || params.subjectRef.trim() === '') {
      return {
        synced: false,
        reason: 'subjectRef is required',
      };
    }

    // Block double-starts on identical (subject, vendorRef) pairs by
    // checking active verifications for the subject. We allow multiple
    // verifications per subject only when the previous one was revoked
    // or rejected — vendor SOP requires re-issuing.
    const existingActive = [...this.verifications.values()].find(
      (v) =>
        v.subjectKind === params.subjectKind &&
        v.subjectRef === params.subjectRef &&
        (v.status === 'pending' || v.status === 'approved'),
    );
    if (existingActive) {
      return {
        synced: false,
        reason: `subject ${params.subjectKind}:${params.subjectRef} already has an active verification (id=${existingActive.verificationId}, status=${existingActive.status})`,
      };
    }

    const verificationId = randomUUID();
    const vendorRef = `MOCK-KYC-${randomUUID()}`;
    const now = new Date().toISOString();

    this.verifications.set(verificationId, {
      verificationId,
      vendorRef,
      subjectKind: params.subjectKind,
      subjectRef: params.subjectRef,
      level: params.level,
      status: 'pending',
      // Deterministic mock defaults — basic gets a clean score,
      // enhanced is treated as elevated until the operator seeds otherwise.
      riskScore: params.level === 'enhanced' ? 35 : 10,
      sanctionsHit: false,
      beneficiaryRef: null,
      attestations: [],
      metadata: { ...params.metadata },
      lastCheckedAt: now,
      createdAt: now,
      revokedReason: null,
    });

    return {
      synced: true,
      data: {
        verificationId,
        status: 'pending',
        vendorRef,
      },
    };
  }

  async getVerificationStatus(
    params: GetVerificationStatusParams,
  ): Promise<GetVerificationStatusResult> {
    const v = this.verifications.get(params.verificationId);
    if (!v) {
      return {
        synced: false,
        reason: `no such verificationId=${params.verificationId}`,
      };
    }

    // Mock auto-approval: a `pending` verification with no sanctions hit
    // auto-approves on first status read so basic happy-path tests don't
    // need to reach for `__seedStatus`. Seeded statuses (rejected/revoked)
    // are preserved.
    if (v.status === 'pending' && !v.sanctionsHit) {
      v.status = 'approved';
      v.lastCheckedAt = new Date().toISOString();
    }

    return {
      synced: true,
      data: {
        status: v.status,
        riskScore: v.riskScore,
        sanctionsHit: v.sanctionsHit,
        lastCheckedAt: v.lastCheckedAt,
      },
    };
  }

  async markBeneficiaryVerified(
    params: MarkBeneficiaryVerifiedParams,
  ): Promise<MarkBeneficiaryVerifiedResult> {
    const v = this.verifications.get(params.verificationId);
    if (!v) {
      return {
        synced: false,
        reason: `no such verificationId=${params.verificationId}`,
      };
    }
    if (v.status !== 'approved') {
      return {
        synced: false,
        reason: `markBeneficiaryVerified requires status=approved, got status=${v.status} (B16 retirement guard)`,
      };
    }
    if (!params.beneficiaryRef || params.beneficiaryRef.trim() === '') {
      return {
        synced: false,
        reason: 'beneficiaryRef is required (B16)',
      };
    }
    if (!Array.isArray(params.attestations) || params.attestations.length === 0) {
      return {
        synced: false,
        reason: 'at least one attestation is required (B16)',
      };
    }

    v.beneficiaryRef = params.beneficiaryRef;
    v.attestations = [...params.attestations];
    v.lastCheckedAt = new Date().toISOString();

    return {
      synced: true,
      data: {
        verificationId: v.verificationId,
        beneficiaryRef: v.beneficiaryRef,
        attestationCount: v.attestations.length,
      },
    };
  }

  async revokeVerification(
    params: RevokeVerificationParams,
  ): Promise<RevokeVerificationResult> {
    const v = this.verifications.get(params.verificationId);
    if (!v) {
      return {
        synced: false,
        reason: `no such verificationId=${params.verificationId}`,
      };
    }
    if (v.status === 'revoked') {
      return {
        synced: false,
        reason: `verificationId=${params.verificationId} is already revoked`,
      };
    }
    if (!params.reason || params.reason.trim() === '') {
      return {
        synced: false,
        reason: 'revoke reason is required',
      };
    }

    v.status = 'revoked';
    v.revokedReason = params.reason;
    v.lastCheckedAt = new Date().toISOString();

    return {
      synced: true,
      data: {
        verificationId: v.verificationId,
        status: v.status,
      },
    };
  }

  async listForSubject(
    params: ListForSubjectParams,
  ): Promise<ListForSubjectResult> {
    const entries: KycSubjectListEntry[] = [...this.verifications.values()]
      .filter(
        (v) =>
          v.subjectKind === params.subjectKind &&
          v.subjectRef === params.subjectRef,
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((v) => ({
        verificationId: v.verificationId,
        level: v.level,
        status: v.status,
        vendorRef: v.vendorRef,
        riskScore: v.riskScore,
        sanctionsHit: v.sanctionsHit,
        beneficiaryRef: v.beneficiaryRef ?? undefined,
        lastCheckedAt: v.lastCheckedAt,
        createdAt: v.createdAt,
      }));

    return {
      synced: true,
      data: { entries },
    };
  }
}
