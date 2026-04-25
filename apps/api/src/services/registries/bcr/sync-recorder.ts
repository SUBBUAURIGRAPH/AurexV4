import { prisma } from '@aurex/database';
import { logger } from '../../../lib/logger.js';
import type {
  BcrAdapterResult,
} from './bcr-adapter.js';

/**
 * Best-effort writer for `BcrRegistrySyncEvent` rows.
 *
 * Mirrors `apps/api/src/services/registries/sync-recorder.ts` (UNFCCC
 * adapter) but for the BCR adapter. Every adapter call (lock / confirm /
 * mint / transfer / burn / unlock / retire / status) lands here as a
 * single immutable row so operators have a continuous audit trail
 * regardless of sync outcome.
 *
 * Contract: this function NEVER throws. A failure to persist the audit
 * row is logged and swallowed — the caller business flow must not branch
 * on the audit-row write outcome. Sprint 2 will integrate this recorder
 * into the issuance / mint / transaction services; for Sprint 1 we ship
 * the recorder so the integration tickets are unblocked.
 */

export type BcrSyncEventType =
  | 'LOCK_VCC'
  | 'CONFIRM_LOCK'
  | 'NOTIFY_MINT'
  | 'NOTIFY_TRANSFER'
  | 'NOTIFY_BURN'
  | 'UNLOCK_VCC'
  | 'RETIRE_VCC'
  | 'GET_STATUS';

export type BcrResourceKind = 'issuance' | 'block' | 'transaction' | 'lock';

export interface RecordBcrSyncEventParams {
  eventType: BcrSyncEventType;
  resourceKind: BcrResourceKind;
  /** UUID of the resource the call relates to (issuance row, block row,
   *  transaction row, or lock row). */
  resourceId: string;
  adapterName: string;
  bcrSerialId?: string | null;
  bcrLockId?: string | null;
  result: BcrAdapterResult;
  requestPayload: unknown;
}

/**
 * Persist a `BcrRegistrySyncEvent` row. Best-effort — failure is logged,
 * never thrown. The function returns `void` because the caller flow
 * (lock-then-mint orchestration in Sprint 2) must not branch on the
 * audit-row outcome.
 */
export async function recordBcrSyncEvent(
  params: RecordBcrSyncEventParams,
): Promise<void> {
  try {
    await prisma.bcrRegistrySyncEvent.create({
      data: {
        eventType: params.eventType as never,
        resourceKind: params.resourceKind,
        resourceId: params.resourceId,
        adapterName: params.adapterName,
        bcrSerialId: params.bcrSerialId ?? null,
        bcrLockId: params.bcrLockId ?? null,
        externalRef: params.result.externalRef,
        synced: params.result.ok,
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
        resourceKind: params.resourceKind,
        resourceId: params.resourceId,
      },
      'Failed to persist BcrRegistrySyncEvent (non-fatal)',
    );
  }
}
