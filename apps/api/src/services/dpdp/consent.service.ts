import { prisma } from '@aurex/database';
import { logger } from '../../lib/logger.js';

/**
 * AAT-R3 / AV4-428 — granular consent capture service.
 *
 * DPDP §6 requires every processing purpose to be backed by a free,
 * specific, informed and unambiguous affirmative action. This service
 * is the single write-path for `ConsentRecord` rows so that:
 *
 *   1. The exact text shown to the user (`consentText`) and the versioned
 *      consent notice (`consentVersion`) are persisted immutably.
 *   2. Withdrawal is a soft-flip on the most-recent active row — we
 *      never delete consent history (that's the audit trail).
 *   3. `hasActiveConsent` is the canonical gate used by other services
 *      (notably KYC — AV4-429 — which 412s if no active KYC consent
 *      exists for the data principal).
 *
 * Purpose strings are free-form but should be drawn from a small
 * controlled vocabulary; current callers use:
 *   - "marketing_email"
 *   - "kyc_verification"          (gates KYC create — AV4-429)
 *   - "carbon_retirement_publishing"
 *   - "analytics"
 *
 * Routes that capture consent live in `routes/dpdp.ts`.
 */

export const CONSENT_PURPOSES = {
  MARKETING_EMAIL: 'marketing_email',
  KYC_VERIFICATION: 'kyc_verification',
  CARBON_RETIREMENT_PUBLISHING: 'carbon_retirement_publishing',
  ANALYTICS: 'analytics',
} as const;

export type ConsentPurpose = string; // intentionally open — vocabulary above is recommended

export interface RecordConsentParams {
  userId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  consentText: string;
  consentVersion: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ConsentRecordDto {
  id: string;
  userId: string;
  purpose: string;
  granted: boolean;
  grantedAt: string;
  withdrawnAt: string | null;
  consentText: string;
  consentVersion: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface ConsentRow {
  id: string;
  userId: string;
  purpose: string;
  granted: boolean;
  grantedAt: Date;
  withdrawnAt: Date | null;
  consentText: string;
  consentVersion: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

function toDto(row: ConsentRow): ConsentRecordDto {
  return {
    id: row.id,
    userId: row.userId,
    purpose: row.purpose,
    granted: row.granted,
    grantedAt: row.grantedAt.toISOString(),
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
    consentText: row.consentText,
    consentVersion: row.consentVersion,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Record a fresh consent decision (grant or denial) for a (user, purpose).
 * Always inserts a new row — consent decisions are append-only history.
 */
export async function recordConsent(
  params: RecordConsentParams,
): Promise<ConsentRecordDto> {
  const row = (await prisma.consentRecord.create({
    data: {
      userId: params.userId,
      purpose: params.purpose,
      granted: params.granted,
      consentText: params.consentText,
      consentVersion: params.consentVersion,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  })) as unknown as ConsentRow;
  return toDto(row);
}

export interface WithdrawConsentParams {
  userId: string;
  purpose: ConsentPurpose;
}

/**
 * Withdraw the latest active consent for (user, purpose). Idempotent:
 * if no active consent exists, returns `{ withdrawn: false }`.
 */
export async function withdrawConsent(
  params: WithdrawConsentParams,
): Promise<{ withdrawn: boolean; record: ConsentRecordDto | null }> {
  const latest = (await prisma.consentRecord.findFirst({
    where: {
      userId: params.userId,
      purpose: params.purpose,
      granted: true,
      withdrawnAt: null,
    },
    orderBy: { grantedAt: 'desc' },
  })) as unknown as ConsentRow | null;

  if (!latest) {
    return { withdrawn: false, record: null };
  }

  const updated = (await prisma.consentRecord.update({
    where: { id: latest.id },
    data: { withdrawnAt: new Date() },
  })) as unknown as ConsentRow;

  logger.info(
    { userId: params.userId, purpose: params.purpose, recordId: updated.id },
    'DPDP consent withdrawn',
  );
  return { withdrawn: true, record: toDto(updated) };
}

/**
 * Canonical gate: does this user have an active (granted, not-withdrawn)
 * consent for `purpose`? Used by AV4-429 to require explicit consent
 * before initiating a KYC verification on sensitive personal data.
 */
export async function hasActiveConsent(
  userId: string,
  purpose: ConsentPurpose,
): Promise<boolean> {
  const row = await prisma.consentRecord.findFirst({
    where: {
      userId,
      purpose,
      granted: true,
      withdrawnAt: null,
    },
    select: { id: true },
  });
  return row !== null;
}

/**
 * List all consent rows for a user (audit trail). Used by the DSAR
 * data-export flow and by the user's consent-management endpoint.
 */
export async function listForUser(userId: string): Promise<ConsentRecordDto[]> {
  const rows = (await prisma.consentRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })) as unknown as ConsentRow[];
  return rows.map(toDto);
}
