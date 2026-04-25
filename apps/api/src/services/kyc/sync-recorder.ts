import { prisma } from '@aurex/database';
import { logger } from '../../lib/logger.js';
import { recordAudit } from '../audit-log.service.js';
import type { KycAdapterResult } from './kyc-adapter.js';

/**
 * Best-effort writer for `KycVerificationEvent` rows + companion `AuditLog`
 * append for every KYC adapter call.
 *
 * Mirrors `apps/api/src/services/registries/bcr/sync-recorder.ts` but for
 * the KYC adapter. Every adapter call (start / get-status / mark-beneficiary
 * / revoke / list) lands here as a single immutable row so operators have
 * a continuous audit trail regardless of sync outcome.
 *
 * Contract:
 *   - This function NEVER throws. A failure to persist either the per-
 *     verification event row OR the org-wide AuditLog row is logged and
 *     swallowed — the caller business flow must not branch on the audit
 *     write outcome.
 *   - Events for verifications that don't yet have a database row (e.g.
 *     `START_VERIFICATION` calls that failed before the row was created)
 *     skip the per-verification row but still emit the AuditLog entry so
 *     the org-wide audit surface stays continuous.
 */

export type KycSyncEventType =
  | 'START_VERIFICATION'
  | 'GET_STATUS'
  | 'MARK_BENEFICIARY'
  | 'REVOKE'
  | 'LIST_FOR_SUBJECT';

export interface RecordKycSyncEventParams {
  eventType: KycSyncEventType;
  /** UUID of the `KycVerification` row this event relates to. `null`
   *  means no row exists yet (e.g. a failed `START_VERIFICATION`); in
   *  that case only the org-wide audit-log entry is written. */
  verificationId: string | null;
  adapterName: string;
  result: KycAdapterResult;
  requestPayload: unknown;
  /** Optional org / user context for the org-wide audit-log row. */
  orgId?: string | null;
  userId?: string | null;
}

/**
 * Persist a `KycVerificationEvent` row + an `AuditLog` row. Best-effort
 * — failures are logged, never thrown. The function returns `void`
 * because the caller flow (KYC orchestration in Sprint 3+) must not
 * branch on the audit-row outcome.
 */
export async function recordKycSyncEvent(
  params: RecordKycSyncEventParams,
): Promise<void> {
  // ─── per-verification append-only event ────────────────────────────
  if (params.verificationId) {
    try {
      await prisma.kycVerificationEvent.create({
        data: {
          verificationId: params.verificationId,
          eventType: params.eventType as never,
          adapterName: params.adapterName,
          synced: params.result.synced,
          reason: params.result.reason ?? null,
          requestPayload: (params.requestPayload ?? null) as never,
          responsePayload: (params.result.data ?? null) as never,
        },
      });
    } catch (err) {
      logger.error(
        {
          err,
          eventType: params.eventType,
          verificationId: params.verificationId,
        },
        'Failed to persist KycVerificationEvent (non-fatal)',
      );
    }
  }

  // ─── org-wide audit-log row (uses the canonical service) ───────────
  await recordAudit({
    orgId: params.orgId ?? null,
    userId: params.userId ?? null,
    action: `kyc.${params.eventType.toLowerCase()}`,
    resource: 'kyc_verification',
    resourceId: params.verificationId ?? undefined,
    newValue: {
      adapter: params.adapterName,
      synced: params.result.synced,
      reason: params.result.reason ?? null,
      data: params.result.data ?? null,
    },
  });
}
