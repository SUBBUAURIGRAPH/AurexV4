import { prisma } from '@aurex/database';
import { logger } from '../../lib/logger.js';
import { getKycAdapter } from './index.js';
import { recordKycSyncEvent } from './sync-recorder.js';
import {
  CONSENT_PURPOSES,
  hasActiveConsent,
} from '../dpdp/consent.service.js';
import type {
  KycAttestation,
  KycLevel,
  KycSubjectKind,
  KycSubjectListEntry,
  KycVerificationStatus,
} from './kyc-adapter.js';

/**
 * AAT-R3 / AV4-429 — DPDP §6 verifiable-consent gate. Thrown by
 * `startVerification` when the data principal has not granted active
 * consent for the `kyc_verification` purpose. The route handler maps
 * this to a 412 Precondition Failed with RFC 7807 type
 * `/problems/dpdp-consent-required`.
 *
 * Beneficiary KYC is exempt — beneficiaries are external third parties
 * that don't have a User row, and the consent-capture obligation falls
 * on the beneficiary's own jurisdiction (see retirement.service docs).
 */
export class DpdpConsentRequiredError extends Error {
  readonly purpose: string;
  readonly userId: string;
  constructor(userId: string, purpose: string) {
    super(`DPDP consent required for purpose=${purpose}`);
    this.name = 'DpdpConsentRequiredError';
    this.userId = userId;
    this.purpose = purpose;
  }
}

/**
 * KYC service — thin orchestration layer between the route handlers and
 * the (env-keyed) `KycRegistryAdapter`.
 *
 * Each public function follows the same recipe:
 *   1. Resolve the adapter via the factory.
 *   2. Invoke the adapter inside try/catch; an adapter that throws is
 *      coerced into a `synced: false` result with the thrown message as
 *      the reason.
 *   3. On success, persist or update the canonical `KycVerification` row
 *      so the database reflects what the vendor reported.
 *   4. Always call `recordKycSyncEvent` (which writes both the per-
 *      verification audit row and the org-wide AuditLog row).
 *
 * Best-effort writes never throw — primary flow returns the verification
 * row to the caller as the source of truth.
 */

interface AdapterFailureResult<T> {
  synced: false;
  reason: string;
  data?: T;
}

function makeAdapterFailureResult<T>(err: unknown): AdapterFailureResult<T> {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'unknown error';
  return {
    synced: false,
    reason: `adapter threw: ${message}`,
  };
}

export interface StartVerificationServiceParams {
  subjectKind: KycSubjectKind;
  subjectRef: string;
  level: KycLevel;
  metadata: Record<string, unknown>;
  orgId?: string | null;
  userId?: string | null;
}

export interface KycVerificationDto {
  id: string;
  subjectKind: KycSubjectKind;
  subjectRef: string;
  level: KycLevel;
  status: KycVerificationStatus;
  vendorName: string | null;
  vendorRef: string | null;
  riskScore: number | null;
  sanctionsHit: boolean | null;
  beneficiaryRef: string | null;
  attestations: KycAttestation[] | null;
  lastCheckedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DbKycVerificationRow {
  id: string;
  subjectKind: string;
  subjectRef: string;
  level: string;
  status: string;
  vendorName: string | null;
  vendorRef: string | null;
  riskScore: number | null;
  sanctionsHit: boolean | null;
  beneficiaryRef: string | null;
  attestations: unknown;
  lastCheckedAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(row: DbKycVerificationRow): KycVerificationDto {
  return {
    id: row.id,
    subjectKind: row.subjectKind.toLowerCase() as KycSubjectKind,
    subjectRef: row.subjectRef,
    level: row.level.toLowerCase() as KycLevel,
    status: row.status.toLowerCase() as KycVerificationStatus,
    vendorName: row.vendorName,
    vendorRef: row.vendorRef,
    riskScore: row.riskScore,
    sanctionsHit: row.sanctionsHit,
    beneficiaryRef: row.beneficiaryRef,
    attestations: (row.attestations as KycAttestation[] | null) ?? null,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokedReason: row.revokedReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function statusToPrismaEnum(status: KycVerificationStatus): string {
  return status.toUpperCase();
}

function levelToPrismaEnum(level: KycLevel): string {
  return level.toUpperCase();
}

function subjectKindToPrismaEnum(kind: KycSubjectKind): string {
  return kind.toUpperCase();
}

export interface StartVerificationServiceResult {
  verification: KycVerificationDto | null;
  synced: boolean;
  reason?: string;
  adapterName: string;
}

/**
 * Start a new KYC verification. When the adapter is `disabled`, no row is
 * created — the disabled state is recorded in the org-wide audit log only,
 * since there is no `vendorRef` to anchor a row against.
 */
export async function startVerification(
  params: StartVerificationServiceParams,
): Promise<StartVerificationServiceResult> {
  // AAT-R3 / AV4-429 — DPDP §6 verifiable-consent gate. KYC is sensitive
  // personal data; before kicking the adapter we require an active
  // ConsentRecord{purpose:"kyc_verification", granted:true} for the
  // calling user. The User-kind path uses `subjectRef` (which is a User
  // id by contract). Beneficiary-kind is exempt (see
  // DpdpConsentRequiredError docstring).
  if (params.subjectKind === 'user') {
    const consentSubject = params.subjectRef ?? params.userId ?? null;
    if (consentSubject) {
      const ok = await hasActiveConsent(
        consentSubject,
        CONSENT_PURPOSES.KYC_VERIFICATION,
      );
      if (!ok) {
        throw new DpdpConsentRequiredError(
          consentSubject,
          CONSENT_PURPOSES.KYC_VERIFICATION,
        );
      }
    }
  }

  const adapter = getKycAdapter();
  const adapterPayload = {
    subjectKind: params.subjectKind,
    subjectRef: params.subjectRef,
    level: params.level,
    metadata: params.metadata,
  };

  let result: Awaited<ReturnType<typeof adapter.startVerification>>;
  try {
    result = await adapter.startVerification(adapterPayload);
  } catch (err) {
    logger.warn(
      { err, adapter: adapter.adapterName },
      'KYC adapter startVerification threw — recording as failed sync',
    );
    result = makeAdapterFailureResult(err);
  }

  let dto: KycVerificationDto | null = null;
  if (result.synced && result.data) {
    try {
      const row = (await prisma.kycVerification.create({
        data: {
          subjectKind: subjectKindToPrismaEnum(params.subjectKind) as never,
          subjectRef: params.subjectRef,
          level: levelToPrismaEnum(params.level) as never,
          status: statusToPrismaEnum(result.data.status) as never,
          vendorName: adapter.adapterName,
          vendorRef: result.data.vendorRef ?? null,
          attestations: (params.metadata as never) ?? null,
          lastCheckedAt: new Date(),
        },
      })) as unknown as DbKycVerificationRow;
      dto = toDto(row);

      await recordKycSyncEvent({
        eventType: 'START_VERIFICATION',
        verificationId: row.id,
        adapterName: adapter.adapterName,
        result,
        requestPayload: adapterPayload,
        orgId: params.orgId,
        userId: params.userId,
      });
    } catch (err) {
      logger.error(
        { err, subjectRef: params.subjectRef, adapter: adapter.adapterName },
        'Failed to persist KycVerification row after adapter success',
      );
      // Even if the row write fails, surface the adapter result to the
      // caller so they can decide what to do.
      await recordKycSyncEvent({
        eventType: 'START_VERIFICATION',
        verificationId: null,
        adapterName: adapter.adapterName,
        result: {
          synced: false,
          reason: `db write failed: ${err instanceof Error ? err.message : 'unknown error'}`,
        },
        requestPayload: adapterPayload,
        orgId: params.orgId,
        userId: params.userId,
      });
    }
  } else {
    await recordKycSyncEvent({
      eventType: 'START_VERIFICATION',
      verificationId: null,
      adapterName: adapter.adapterName,
      result,
      requestPayload: adapterPayload,
      orgId: params.orgId,
      userId: params.userId,
    });
  }

  return {
    verification: dto,
    synced: result.synced,
    reason: result.reason,
    adapterName: adapter.adapterName,
  };
}

export interface GetVerificationServiceParams {
  verificationId: string;
  orgId?: string | null;
  userId?: string | null;
}

export interface GetVerificationServiceResult {
  verification: KycVerificationDto | null;
  synced: boolean;
  reason?: string;
  adapterName: string;
}

/**
 * Fetch a verification row + refresh its status from the adapter. If the
 * row doesn't exist locally we still query the adapter (so callers
 * holding only an external vendor id can probe status), but the adapter
 * is responsible for telling us whether it knows that id.
 */
export async function getVerification(
  params: GetVerificationServiceParams,
): Promise<GetVerificationServiceResult> {
  const adapter = getKycAdapter();
  const existing = (await prisma.kycVerification.findUnique({
    where: { id: params.verificationId },
  })) as unknown as DbKycVerificationRow | null;

  let result: Awaited<ReturnType<typeof adapter.getVerificationStatus>>;
  try {
    // Mock adapter is keyed by its own verificationId, which equals the
    // db id when the mock is in use. Live adapters will keep the vendorRef
    // in their own state and use that — they can ignore the db id.
    result = await adapter.getVerificationStatus({
      verificationId: existing?.vendorRef ?? params.verificationId,
    });
  } catch (err) {
    result = makeAdapterFailureResult(err);
  }

  let dto: KycVerificationDto | null = existing ? toDto(existing) : null;

  if (result.synced && result.data && existing) {
    try {
      const updated = (await prisma.kycVerification.update({
        where: { id: existing.id },
        data: {
          status: statusToPrismaEnum(result.data.status) as never,
          riskScore: result.data.riskScore ?? null,
          sanctionsHit: result.data.sanctionsHit ?? null,
          lastCheckedAt: new Date(result.data.lastCheckedAt),
        },
      })) as unknown as DbKycVerificationRow;
      dto = toDto(updated);
    } catch (err) {
      logger.error(
        { err, verificationId: existing.id },
        'Failed to refresh KycVerification status from adapter',
      );
    }
  }

  await recordKycSyncEvent({
    eventType: 'GET_STATUS',
    verificationId: existing?.id ?? null,
    adapterName: adapter.adapterName,
    result,
    requestPayload: { verificationId: params.verificationId },
    orgId: params.orgId,
    userId: params.userId,
  });

  return {
    verification: dto,
    synced: result.synced,
    reason: result.reason,
    adapterName: adapter.adapterName,
  };
}

export interface RevokeVerificationServiceParams {
  verificationId: string;
  reason: string;
  orgId?: string | null;
  userId?: string | null;
}

export interface RevokeVerificationServiceResult {
  verification: KycVerificationDto | null;
  synced: boolean;
  reason?: string;
  adapterName: string;
}

export async function revokeVerification(
  params: RevokeVerificationServiceParams,
): Promise<RevokeVerificationServiceResult> {
  const adapter = getKycAdapter();
  const existing = (await prisma.kycVerification.findUnique({
    where: { id: params.verificationId },
  })) as unknown as DbKycVerificationRow | null;

  let result: Awaited<ReturnType<typeof adapter.revokeVerification>>;
  try {
    result = await adapter.revokeVerification({
      verificationId: existing?.vendorRef ?? params.verificationId,
      reason: params.reason,
    });
  } catch (err) {
    result = makeAdapterFailureResult(err);
  }

  let dto: KycVerificationDto | null = existing ? toDto(existing) : null;

  if (result.synced && existing) {
    try {
      const updated = (await prisma.kycVerification.update({
        where: { id: existing.id },
        data: {
          status: 'REVOKED' as never,
          revokedAt: new Date(),
          revokedReason: params.reason,
        },
      })) as unknown as DbKycVerificationRow;
      dto = toDto(updated);
    } catch (err) {
      logger.error(
        { err, verificationId: existing.id },
        'Failed to flip KycVerification to REVOKED after adapter success',
      );
    }
  }

  await recordKycSyncEvent({
    eventType: 'REVOKE',
    verificationId: existing?.id ?? null,
    adapterName: adapter.adapterName,
    result,
    requestPayload: {
      verificationId: params.verificationId,
      reason: params.reason,
    },
    orgId: params.orgId,
    userId: params.userId,
  });

  return {
    verification: dto,
    synced: result.synced,
    reason: result.reason,
    adapterName: adapter.adapterName,
  };
}

export interface MarkBeneficiaryServiceParams {
  verificationId: string;
  beneficiaryRef: string;
  attestations: KycAttestation[];
  orgId?: string | null;
  userId?: string | null;
}

export interface MarkBeneficiaryServiceResult {
  verification: KycVerificationDto | null;
  synced: boolean;
  reason?: string;
  adapterName: string;
}

export async function markBeneficiaryVerified(
  params: MarkBeneficiaryServiceParams,
): Promise<MarkBeneficiaryServiceResult> {
  const adapter = getKycAdapter();
  const existing = (await prisma.kycVerification.findUnique({
    where: { id: params.verificationId },
  })) as unknown as DbKycVerificationRow | null;

  let result: Awaited<ReturnType<typeof adapter.markBeneficiaryVerified>>;
  try {
    result = await adapter.markBeneficiaryVerified({
      verificationId: existing?.vendorRef ?? params.verificationId,
      beneficiaryRef: params.beneficiaryRef,
      attestations: params.attestations,
    });
  } catch (err) {
    result = makeAdapterFailureResult(err);
  }

  let dto: KycVerificationDto | null = existing ? toDto(existing) : null;

  if (result.synced && existing) {
    try {
      const updated = (await prisma.kycVerification.update({
        where: { id: existing.id },
        data: {
          beneficiaryRef: params.beneficiaryRef,
          attestations: params.attestations as never,
          lastCheckedAt: new Date(),
        },
      })) as unknown as DbKycVerificationRow;
      dto = toDto(updated);
    } catch (err) {
      logger.error(
        { err, verificationId: existing.id },
        'Failed to persist beneficiary attestations after adapter success',
      );
    }
  }

  await recordKycSyncEvent({
    eventType: 'MARK_BENEFICIARY',
    verificationId: existing?.id ?? null,
    adapterName: adapter.adapterName,
    result,
    requestPayload: {
      verificationId: params.verificationId,
      beneficiaryRef: params.beneficiaryRef,
      attestationCount: params.attestations.length,
    },
    orgId: params.orgId,
    userId: params.userId,
  });

  return {
    verification: dto,
    synced: result.synced,
    reason: result.reason,
    adapterName: adapter.adapterName,
  };
}

export interface ListForSubjectServiceParams {
  subjectKind: KycSubjectKind;
  subjectRef: string;
  orgId?: string | null;
  userId?: string | null;
}

export interface ListForSubjectServiceResult {
  entries: KycSubjectListEntry[];
  synced: boolean;
  reason?: string;
  adapterName: string;
}

export async function listForSubject(
  params: ListForSubjectServiceParams,
): Promise<ListForSubjectServiceResult> {
  const adapter = getKycAdapter();
  let result: Awaited<ReturnType<typeof adapter.listForSubject>>;
  try {
    result = await adapter.listForSubject({
      subjectKind: params.subjectKind,
      subjectRef: params.subjectRef,
    });
  } catch (err) {
    result = makeAdapterFailureResult(err);
  }

  await recordKycSyncEvent({
    eventType: 'LIST_FOR_SUBJECT',
    verificationId: null,
    adapterName: adapter.adapterName,
    result,
    requestPayload: params,
    orgId: params.orgId,
    userId: params.userId,
  });

  return {
    entries: result.data?.entries ?? [],
    synced: result.synced,
    reason: result.reason,
    adapterName: adapter.adapterName,
  };
}
