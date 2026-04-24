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

  /** Human-readable identifier for audit logs. */
  readonly adapterName: string;
  readonly isActive: boolean;
}
