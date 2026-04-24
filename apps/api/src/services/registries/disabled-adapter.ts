import type {
  NotifyFirstTransferParams,
  NotifyIssuanceParams,
  NotifyRetirementParams,
  UnfcccAdapterResult,
  UnfcccRegistryAdapter,
} from './unfccc-adapter.js';

/**
 * Default no-op adapter used when `UNFCCC_REGISTRY_ADAPTER` is unset or
 * explicitly set to `disabled`.
 *
 * The UNFCCC central A6.4 mechanism registry API specification is being
 * finalised under CMA.6+; until it publishes we cannot implement a live
 * client. This adapter lets every call path exercise the adapter seam
 * without side-effects — every notification returns `synced: false` with
 * the same machine-parseable reason so downstream observability is clean.
 *
 * The caller (ca-events / issuance / transaction services) is responsible
 * for recording a `UnfcccRegistrySyncEvent` audit row regardless of sync
 * outcome, so when the operator flips to a live adapter the history is
 * continuous with no gaps.
 */

const DISABLED_REASON =
  'UNFCCC A6.4 mechanism registry API spec not yet published (CMA.6+); adapter disabled by default';

export class DisabledUnfcccAdapter implements UnfcccRegistryAdapter {
  readonly adapterName = 'disabled';
  readonly isActive = false;

  async notifyIssuance(
    _params: NotifyIssuanceParams,
  ): Promise<UnfcccAdapterResult> {
    return { externalRef: null, synced: false, reason: DISABLED_REASON };
  }

  async notifyFirstTransfer(
    _params: NotifyFirstTransferParams,
  ): Promise<UnfcccAdapterResult> {
    return { externalRef: null, synced: false, reason: DISABLED_REASON };
  }

  async notifyRetirement(
    _params: NotifyRetirementParams,
  ): Promise<UnfcccAdapterResult> {
    return { externalRef: null, synced: false, reason: DISABLED_REASON };
  }
}

export const DISABLED_ADAPTER_REASON = DISABLED_REASON;
