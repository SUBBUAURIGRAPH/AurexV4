/**
 * UNFCCC Article 6.4 mechanism registry adapter interface.
 *
 * The UNFCCC central registry API specification under CMA.6+ has NOT yet
 * been published. We ship this adapter interface as a swappable seam so
 * that the Aurex platform is wired and ready — when the spec publishes,
 * an operator drops in a concrete adapter (e.g. `live-v1`) and flips the
 * `UNFCCC_REGISTRY_ADAPTER` env var. No business-logic changes required.
 *
 * The three `notify*` methods correspond to the three points at which the
 * Article 6.4 supervisory body expects the host registry + participating
 * registries to sync state with the central registry:
 *
 *   1. Issuance — after the Issuance row is approved and the CreditUnitBlock
 *      rows are minted.
 *   2. First international transfer — emits the CA event on the spec side.
 *   3. Retirement (NDC / OIMP) — voluntary retirements are outside the
 *      Article 6.4 CA regime and typically don't sync.
 *
 * Contract: adapters MUST NOT throw. Return `{ synced: false, reason }` on
 * failure instead. The caller wraps every call in try/catch as belt-and-
 * braces, but well-behaved adapters let the caller record a clean audit row.
 */

export interface UnfcccAdapterResult {
  /** External registry reference assigned to this event. `null` when the
   *  adapter is disabled or the sync failed. */
  externalRef: string | null;
  /** `true` when the central registry accepted the notification. */
  synced: boolean;
  /** Human-readable explanation when `synced=false`. Persisted to the
   *  `UnfcccRegistrySyncEvent` audit trail and surfaced in ops dashboards. */
  reason?: string;
}

export interface NotifyIssuanceParams {
  issuanceId: string;
  activityId: string;
  hostCountry: string;
  unitType: 'A6_4ER' | 'A6_4ER_MC';
  vintage: number;
  grossUnits: number;
  netUnits: number;
  sopUnits: number;
  omgeUnits: number;
}

export interface NotifyFirstTransferParams {
  blockSerialFirst: string;
  fromAccountKey: string;
  toAccountKey: string;
  units: number;
  buyerCountry?: string;
}

export interface NotifyRetirementParams {
  blockSerialFirst: string;
  purpose: 'NDC' | 'OIMP' | 'VOLUNTARY';
  units: number;
  narrative: string;
}

/**
 * AAT-R5 / AV4-418 — UNFCCC interop manifest.
 *
 * Returned by {@link UnfcccRegistryAdapter.getInteropManifest}; consumed
 * by the public health endpoint `GET /api/v1/health/unfccc-interop` so
 * external operators (Article 6.4 supervisory body, host-country
 * registries) can probe Aurex's readiness without authenticating.
 *
 * The manifest contract is deliberately small — until the UNFCCC central
 * registry API spec publishes (CMA.6+) every Aurex deploy is in the
 * `disabled` state, but we expose a stable manifest shape so downstream
 * tooling can parse it today and the field set won't churn when the
 * live adapter ships.
 */
export interface UnfcccInteropManifest {
  /** Human-readable identifier for the active adapter — same value as
   *  `UnfcccRegistryAdapter.adapterName`. */
  adapterName: string;
  /** Spec version this adapter implements. The disabled adapter reports
   *  `0.0.0-pending-spec` until UNFCCC publishes the central registry
   *  API specification under CMA.6+. */
  specVersion: string;
  /** Event types the adapter knows how to notify the central registry
   *  about. The disabled adapter reports the full pending event set so
   *  consumers can validate their integration assumptions. */
  supportedEvents: ReadonlyArray<string>;
  /** `true` when the adapter is actively syncing with a published spec.
   *  Mirrors `UnfcccRegistryAdapter.isActive`. */
  ready: boolean;
  /** URL or document reference for the spec this adapter implements.
   *  `null` until UNFCCC publishes the central registry API spec. */
  specReference: string | null;
}

export interface UnfcccRegistryAdapter {
  /** Notify central registry of issuance. Returns external registry ref
   *  (for recording on the Issuance row). */
  notifyIssuance(params: NotifyIssuanceParams): Promise<UnfcccAdapterResult>;

  /** Notify central registry of a first transfer — triggers CA event on the
   *  spec side. */
  notifyFirstTransfer(
    params: NotifyFirstTransferParams,
  ): Promise<UnfcccAdapterResult>;

  /** Notify retirement (NDC / OIMP). Voluntary retirements typically don't
   *  sync. */
  notifyRetirement(
    params: NotifyRetirementParams,
  ): Promise<UnfcccAdapterResult>;

  /**
   * AAT-R5 / AV4-418 — Static description of what this adapter implements
   * and which events it supports. Synchronous because the manifest is
   * a static description of the adapter's surface, not a network probe.
   */
  getInteropManifest(): UnfcccInteropManifest;

  /** Human-readable identifier for audit logs. */
  readonly adapterName: string;
  readonly isActive: boolean;
}
