/**
 * BioCarbon Registry (BCR) Third-Party adapter interface.
 *
 * BCR mints nothing on-chain itself — it relies on authorised Third-Parties
 * to operate the lock-then-mint flow described in BCR's Standard Operating
 * Procedure §5.5. Aurex acts as such a Third-Party (binding requirements
 * B1–B24 in `docs/BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md`).
 *
 * Lifecycle (mirroring §5.5 of the BCR SOP):
 *
 *   1. `lockVCC`        — request BCR to lock a VCC tranche (whole-ton, no
 *                         pooling) for a recipient account. Returns a
 *                         `bcrLockId` we keep alongside the chain mint.
 *   2. `confirmLock`    — poll BCR until the lock is confirmed. Mint MUST
 *                         NOT happen until this returns `confirmed=true`.
 *   3. `notifyMint`     — tell BCR the on-chain mint completed; passes the
 *                         immutable token serial-id range so BCR's registry
 *                         and the tokenized representation are bound (B6).
 *   4. `notifyTransfer` — optional; BCR is informed of secondary-market
 *                         transfers when BCR-side data residency requires
 *                         it (B20).
 *   5. `notifyBurn`     — every burn-on-retirement and every delist burn
 *                         flows back to BCR. `reason='RETIRE'` triggers a
 *                         retirement on BCR; `reason='DELIST'` keeps the
 *                         VCC alive on BCR but unlocked (two-way bridge,
 *                         B17 / B18).
 *   6. `unlockVCC`      — explicit delist counterpart (locked → free).
 *   7. `retireVCC`      — atomic retire convenience (lock + burn + retire
 *                         passthrough) used when the chain side has already
 *                         destroyed the token.
 *   8. `getStatus`      — read-only state probe used by reconciliation jobs.
 *
 * Contract: adapters MUST NOT throw on remote-side failures. Return
 * `{ ok: false, externalRef: null, reason }` so the caller can record a
 * clean `BcrRegistrySyncEvent` audit row. The factory may throw on
 * misconfiguration (env var wrong); that's OK because it fires once at boot.
 */

export interface BcrAdapterResult<TPayload = Record<string, unknown>> {
  /** `true` when BCR accepted the call and the state transition is durable. */
  ok: boolean;
  /** External reference assigned by BCR (lock id, retirement id, etc.).
   *  `null` when the adapter is disabled or the call failed. */
  externalRef: string | null;
  /** Human-readable explanation when `ok=false`. Persisted to the audit
   *  trail and surfaced in ops dashboards. */
  reason?: string;
  /** Adapter-specific payload (lock metadata, retirement statement URL,
   *  status string). Always serialisable. */
  data?: TPayload;
}

export interface LockVccParams {
  /** Aurex-side VCC issuance row referenced by the lock. */
  issuanceId: string;
  /** BCR project identifier. */
  projectId: string;
  /** Vintage year of the VCC tranche being locked. */
  vintage: number;
  /** Whole-ton count to lock. Sub-ton fractions rejected per B11. */
  units: number;
  /** Recipient BCR account that will receive the locked balance once
   *  the on-chain mint settles. */
  recipientAccount: string;
  /** Optional caller-supplied serial id; if omitted the adapter assigns
   *  one (mock) or BCR assigns one (live). */
  bcrSerialId?: string;
}

export type LockVccResult = BcrAdapterResult<{
  bcrLockId: string;
  bcrSerialId: string;
  lockedUnits: number;
  expiresAt: string; // ISO-8601
}>;

export interface ConfirmLockParams {
  bcrLockId: string;
}

export type ConfirmLockResult = BcrAdapterResult<{
  confirmed: boolean;
  status: BcrVccStatus;
}>;

export interface NotifyMintParams {
  bcrLockId: string;
  bcrSerialId: string;
  chain: string; // e.g. "polygon-mainnet" / "aurigraph-dlt-v12-sbx"
  tokenContract: string;
  tokenId: string;
  serialFirst: string;
  serialLast: string;
  units: number;
}

export type NotifyMintResult = BcrAdapterResult<{
  bcrConfirmation: string;
}>;

export interface NotifyTransferParams {
  bcrSerialId: string;
  fromAccount: string;
  toAccount: string;
  units: number;
  txHash?: string;
}

export type NotifyTransferResult = BcrAdapterResult<{
  bcrConfirmation: string;
}>;

export interface NotifyBurnParams {
  bcrSerialId: string;
  /** RETIRE → BCR retires the underlying VCC; DELIST → BCR keeps it but
   *  unlocks (two-way bridge, B17 / B18). */
  reason: 'RETIRE' | 'DELIST';
  /** Required when reason='RETIRE' — passed through to BCR's retirement
   *  statement (B16). */
  beneficiary?: BcrBeneficiary;
  vintage: number;
  units: number;
  txHash?: string;
}

export type NotifyBurnResult = BcrAdapterResult<{
  bcrConfirmation: string;
}>;

export interface UnlockVccParams {
  bcrLockId: string;
  /** Always 'DELIST' on this method — the field is kept for parity with
   *  notifyBurn and forward-compatibility (e.g. operator-initiated cancel). */
  reason: 'DELIST';
}

export type UnlockVccResult = BcrAdapterResult<{
  bcrSerialId: string;
}>;

export interface RetireVccParams {
  bcrSerialId: string;
  beneficiary: BcrBeneficiary;
  purpose: string; // free-text per BCR SOP §5.5 step 14
  units: number;
}

export type RetireVccResult = BcrAdapterResult<{
  retirementStatementUrl: string;
}>;

export interface GetStatusParams {
  bcrSerialId: string;
}

export type GetStatusResult = BcrAdapterResult<{
  status: BcrVccStatus;
}>;

/** Identity passed through to BCR retirement statements (B16). */
export interface BcrBeneficiary {
  /** Legal name on the retirement statement. */
  name: string;
  /** ISO-3166 alpha-2 country code. */
  country: string;
  /** Optional reference (org id, registry account number, …). */
  reference?: string;
}

/** Canonical VCC lifecycle states tracked by BCR. */
export type BcrVccStatus =
  | 'free'
  | 'locked'
  | 'tokenized'
  | 'retired'
  | 'cancelled';

export interface BcrRegistryAdapter {
  lockVCC(params: LockVccParams): Promise<LockVccResult>;
  confirmLock(params: ConfirmLockParams): Promise<ConfirmLockResult>;
  notifyMint(params: NotifyMintParams): Promise<NotifyMintResult>;
  notifyTransfer(params: NotifyTransferParams): Promise<NotifyTransferResult>;
  notifyBurn(params: NotifyBurnParams): Promise<NotifyBurnResult>;
  unlockVCC(params: UnlockVccParams): Promise<UnlockVccResult>;
  retireVCC(params: RetireVccParams): Promise<RetireVccResult>;
  getStatus(params: GetStatusParams): Promise<GetStatusResult>;

  /** Human-readable identifier for audit logs. */
  readonly adapterName: string;
  readonly isActive: boolean;
}
