import type {
  NotifyFirstTransferParams,
  NotifyIssuanceParams,
  NotifyRetirementParams,
  UnfcccAdapterResult,
  UnfcccInteropManifest,
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

/**
 * AAT-R5 / AV4-418 — supported event surface for the UNFCCC adapter.
 *
 * These four event names mirror the three `notify*` methods on the
 * adapter interface, broken out so that the retirement methods that
 * surface separate NDC and OIMP semantics can be advertised
 * independently. Order is stable because the manifest is part of the
 * public health-endpoint surface.
 */
const SUPPORTED_EVENTS: ReadonlyArray<string> = [
  'issuance',
  'first-transfer',
  'retirement-ndc',
  'retirement-oimp',
] as const;

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

  /**
   * AAT-R5 / AV4-418 — manifest reports `0.0.0-pending-spec` and
   * `ready: false` so the public health endpoint surfaces an honest
   * "we are wired but the central spec hasn't published" state.
   * `specReference` is `null` until UNFCCC publishes the central
   * registry API spec under CMA.6+.
   */
  getInteropManifest(): UnfcccInteropManifest {
    return {
      adapterName: this.adapterName,
      specVersion: '0.0.0-pending-spec',
      supportedEvents: SUPPORTED_EVENTS,
      ready: this.isActive,
      specReference: null,
    };
  }
}

export const DISABLED_ADAPTER_REASON = DISABLED_REASON;
