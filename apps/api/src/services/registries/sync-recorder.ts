import { prisma } from '@aurex/database';
import { logger } from '../../lib/logger.js';
import { recordAudit } from '../audit-log.service.js';
import { getUnfcccAdapter } from './index.js';
import type {
  NotifyFirstTransferParams,
  NotifyIssuanceParams,
  NotifyRetirementParams,
  UnfcccAdapterResult,
} from './unfccc-adapter.js';

/**
 * Best-effort wrappers around the UNFCCC adapter.
 *
 * Every wrapper follows the same recipe:
 *
 *   1. Invoke the adapter inside try/catch. An adapter that throws is
 *      coerced into a `synced: false` result with the thrown message as
 *      the reason. Business-flow callers NEVER surface this error.
 *   2. Persist a `UnfcccRegistrySyncEvent` row (also best-effort) so we
 *      have a continuous sync audit trail regardless of outcome.
 *   3. Append an `AuditLog` row with a stable action key so operators can
 *      query adapter activity through the existing audit surface.
 *
 * The whole thing returns `void` — the primary flow (ca-events, issuance,
 * transaction) does not branch on the sync outcome.
 */

type AuditParams = Parameters<typeof recordAudit>[0];

async function recordSyncEvent(
  eventType: 'ISSUANCE' | 'FIRST_TRANSFER' | 'RETIREMENT',
  resourceKind: 'issuance' | 'block' | 'transaction',
  resourceId: string,
  adapterName: string,
  result: UnfcccAdapterResult,
  requestPayload: unknown,
): Promise<void> {
  try {
    await prisma.unfcccRegistrySyncEvent.create({
      data: {
        eventType: eventType as never,
        resourceKind,
        resourceId,
        adapterName,
        externalRef: result.externalRef,
        synced: result.synced,
        reason: result.reason ?? null,
        requestPayload: (requestPayload ?? null) as never,
      },
    });
  } catch (err) {
    logger.error(
      { err, eventType, resourceKind, resourceId },
      'Failed to persist UnfcccRegistrySyncEvent (non-fatal)',
    );
  }
}

function makeFailureResult(err: unknown): UnfcccAdapterResult {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'unknown error';
  return {
    externalRef: null,
    synced: false,
    reason: `adapter threw: ${message}`,
  };
}

export interface SyncIssuanceContext {
  orgId: string | null;
  userId: string | null;
  resourceId: string; // issuance.id
  params: NotifyIssuanceParams;
}

export async function syncIssuance(ctx: SyncIssuanceContext): Promise<void> {
  let adapterName = 'unknown';
  let result: UnfcccAdapterResult;
  try {
    const adapter = getUnfcccAdapter();
    adapterName = adapter.adapterName;
    try {
      result = await adapter.notifyIssuance(ctx.params);
    } catch (err) {
      result = makeFailureResult(err);
      logger.warn(
        { err, issuanceId: ctx.resourceId, adapter: adapterName },
        'UNFCCC adapter notifyIssuance threw — recording as failed sync',
      );
    }
  } catch (err) {
    logger.error(
      { err, issuanceId: ctx.resourceId },
      'UNFCCC adapter factory failed — skipping sync',
    );
    return;
  }

  await recordSyncEvent(
    'ISSUANCE',
    'issuance',
    ctx.resourceId,
    adapterName,
    result,
    ctx.params,
  );

  const auditParams: AuditParams = {
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'unfccc.registry.issuance_notified',
    resource: 'issuance',
    resourceId: ctx.resourceId,
    newValue: {
      adapter: adapterName,
      synced: result.synced,
      externalRef: result.externalRef,
      reason: result.reason ?? null,
    },
  };
  await recordAudit(auditParams);
}

export interface SyncFirstTransferContext {
  orgId: string | null;
  userId: string | null;
  resourceId: string; // block id
  params: NotifyFirstTransferParams;
}

export async function syncFirstTransfer(
  ctx: SyncFirstTransferContext,
): Promise<void> {
  let adapterName = 'unknown';
  let result: UnfcccAdapterResult;
  try {
    const adapter = getUnfcccAdapter();
    adapterName = adapter.adapterName;
    try {
      result = await adapter.notifyFirstTransfer(ctx.params);
    } catch (err) {
      result = makeFailureResult(err);
      logger.warn(
        { err, blockId: ctx.resourceId, adapter: adapterName },
        'UNFCCC adapter notifyFirstTransfer threw — recording as failed sync',
      );
    }
  } catch (err) {
    logger.error(
      { err, blockId: ctx.resourceId },
      'UNFCCC adapter factory failed — skipping sync',
    );
    return;
  }

  await recordSyncEvent(
    'FIRST_TRANSFER',
    'block',
    ctx.resourceId,
    adapterName,
    result,
    ctx.params,
  );

  const auditParams: AuditParams = {
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'unfccc.registry.first_transfer_notified',
    resource: 'credit_unit_block',
    resourceId: ctx.resourceId,
    newValue: {
      adapter: adapterName,
      synced: result.synced,
      externalRef: result.externalRef,
      reason: result.reason ?? null,
    },
  };
  await recordAudit(auditParams);
}

export interface SyncRetirementContext {
  orgId: string | null;
  userId: string | null;
  resourceId: string; // block id
  params: NotifyRetirementParams;
}

export async function syncRetirement(
  ctx: SyncRetirementContext,
): Promise<void> {
  // Voluntary retirements are outside the Article 6.4 CA regime and do not
  // sync to the central registry. Skip cleanly.
  if (ctx.params.purpose === 'VOLUNTARY') return;

  let adapterName = 'unknown';
  let result: UnfcccAdapterResult;
  try {
    const adapter = getUnfcccAdapter();
    adapterName = adapter.adapterName;
    try {
      result = await adapter.notifyRetirement(ctx.params);
    } catch (err) {
      result = makeFailureResult(err);
      logger.warn(
        { err, blockId: ctx.resourceId, adapter: adapterName },
        'UNFCCC adapter notifyRetirement threw — recording as failed sync',
      );
    }
  } catch (err) {
    logger.error(
      { err, blockId: ctx.resourceId },
      'UNFCCC adapter factory failed — skipping sync',
    );
    return;
  }

  await recordSyncEvent(
    'RETIREMENT',
    'block',
    ctx.resourceId,
    adapterName,
    result,
    ctx.params,
  );

  const auditParams: AuditParams = {
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'unfccc.registry.retirement_notified',
    resource: 'credit_unit_block',
    resourceId: ctx.resourceId,
    newValue: {
      adapter: adapterName,
      synced: result.synced,
      externalRef: result.externalRef,
      reason: result.reason ?? null,
      purpose: ctx.params.purpose,
    },
  };
  await recordAudit(auditParams);
}
