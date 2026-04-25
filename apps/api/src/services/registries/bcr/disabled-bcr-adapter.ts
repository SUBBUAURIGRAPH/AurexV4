import type {
  BcrRegistryAdapter,
  ConfirmLockParams,
  ConfirmLockResult,
  GetStatusParams,
  GetStatusResult,
  LockVccParams,
  LockVccResult,
  NotifyBurnParams,
  NotifyBurnResult,
  NotifyMintParams,
  NotifyMintResult,
  NotifyTransferParams,
  NotifyTransferResult,
  RetireVccParams,
  RetireVccResult,
  UnlockVccParams,
  UnlockVccResult,
} from './bcr-adapter.js';

/**
 * Default no-op adapter used when `BCR_REGISTRY_ADAPTER` is unset or
 * explicitly set to `disabled`.
 *
 * Per binding requirement B1 (`docs/BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md`)
 * Aurex must hold a BCR Third-Party authorisation before any live BCR
 * registry API call is permitted. Until that authorisation is in hand,
 * every adapter call must be a no-op that records audit context only.
 *
 * This adapter lets every call path exercise the adapter seam without
 * side-effects — every method returns `ok: false` with the same
 * machine-parseable reason so downstream observability is clean and the
 * sync-recorder can still write a continuous `BcrRegistrySyncEvent` row
 * for every attempt. When the operator flips `BCR_REGISTRY_ADAPTER` to a
 * live adapter, the audit history is continuous with no gaps.
 *
 * Contract: methods must NEVER throw — they always resolve with the
 * disabled-state failure result.
 */

const DISABLED_REASON =
  'BCR Third-Party authorisation pending — adapter disabled by default';

export class DisabledBcrAdapter implements BcrRegistryAdapter {
  readonly adapterName = 'disabled';
  readonly isActive = false;

  async lockVCC(_params: LockVccParams): Promise<LockVccResult> {
    return { ok: false, externalRef: null, reason: DISABLED_REASON };
  }

  async confirmLock(_params: ConfirmLockParams): Promise<ConfirmLockResult> {
    return { ok: false, externalRef: null, reason: DISABLED_REASON };
  }

  async notifyMint(_params: NotifyMintParams): Promise<NotifyMintResult> {
    return { ok: false, externalRef: null, reason: DISABLED_REASON };
  }

  async notifyTransfer(
    _params: NotifyTransferParams,
  ): Promise<NotifyTransferResult> {
    return { ok: false, externalRef: null, reason: DISABLED_REASON };
  }

  async notifyBurn(_params: NotifyBurnParams): Promise<NotifyBurnResult> {
    return { ok: false, externalRef: null, reason: DISABLED_REASON };
  }

  async unlockVCC(_params: UnlockVccParams): Promise<UnlockVccResult> {
    return { ok: false, externalRef: null, reason: DISABLED_REASON };
  }

  async retireVCC(_params: RetireVccParams): Promise<RetireVccResult> {
    return { ok: false, externalRef: null, reason: DISABLED_REASON };
  }

  async getStatus(_params: GetStatusParams): Promise<GetStatusResult> {
    return { ok: false, externalRef: null, reason: DISABLED_REASON };
  }
}

export const DISABLED_BCR_ADAPTER_REASON = DISABLED_REASON;
