/**
 * AurigraphDltAdapter — chain-abstraction wrapper around `@aurigraph/dlt-sdk`.
 *
 * Mirrors the swappable-seam pattern used by the UNFCCC registry adapter
 * (`apps/api/src/services/registries/unfccc-adapter.ts`). The biocarbon
 * issuance pipeline (AV4-373, next sprint) will depend on `ChainAdapter`
 * rather than the SDK directly, so the underlying chain backend can be
 * swapped without touching service code.
 *
 * Capabilities:
 *
 *   - deployContract / getAsset / listByUseCase / getPublicLedger /
 *     transferAsset / burnAsset / getQuota
 *   - Pre-flight quota check on every mint / transfer / burn — throws
 *     `QuotaExhaustedError` *before* contacting the SDK when quota is zero.
 *   - Retry on transient `AurigraphServerError` (5xx): up to 3 attempts with
 *     exponential back-off. 4xx (`AurigraphClientError`) is never retried.
 *   - Persists every call to the `aurigraph_call_logs` table — the audit log
 *     is best-effort: any logging failure is swallowed so a flaky DB never
 *     blocks a contract deploy.
 *
 * AAT-β / AV4-372.
 */

import {
  AurigraphClient,
  AurigraphClientError,
  AurigraphServerError,
  type MintQuota,
  type TransferRequest,
  type TransferReceipt,
} from '@aurigraph/dlt-sdk';
import { Prisma, prisma } from '@aurex/database';
import { logger } from '../../lib/logger.js';
import {
  getAurigraphClient,
  getAurigraphConfig,
} from '../../lib/aurigraph-client.js';

// ── Public types ───────────────────────────────────────────────────────────

/**
 * Spec for a single contract deploy. Matches the V11 SDK `contracts.deploy`
 * documented surface (see DEVELOPER_GUIDE.md → Carbon tokenization example).
 *
 * `templateId` + `useCaseId` are the contract-template binding (e.g. both
 * `UC_CARBON` for biocarbon retirement). `terms` is the Ricardian-contract
 * payload — shape is template-specific and validated server-side.
 */
export interface ContractDeploySpec {
  templateId: string;
  useCaseId: string;
  channelId?: string;
  terms: Record<string, unknown>;
}

export interface ContractDeployResult {
  contractId: string;
  txHash: string;
}

export interface AssetTransferSpec {
  from: string;
  to: string;
  amount: number;
  currency: string;
}

export interface AssetBurnSpec {
  /** Asset / token id to burn (retire). */
  assetId: string;
  amount: number;
  /** Audit narrative — required so the burn shows up in the public ledger. */
  reason: string;
  retiredBy?: string;
  /**
   * Optional structured metadata baked into the burn `terms`. Used by the
   * AAT-κ delist initiator (AV4-357) to emit `{ delist: true, bcrSerialId,
   * bcrLockId, aurexIssuanceId, … }` so the events worker can classify the
   * resulting on-ledger burn as `BURN_FOR_DELIST` (no `retiredFor`/`retiredBy`)
   * and call `bcrAdapter.unlockVcc`. Merged into the chain-template `terms`;
   * top-level retire fields take precedence.
   */
  metadata?: Record<string, unknown>;
}

/** Common surface every chain adapter implements. */
export interface ChainAdapter {
  deployContract(spec: ContractDeploySpec): Promise<ContractDeployResult>;
  getAsset(assetId: string): Promise<Record<string, unknown>>;
  listByUseCase(useCaseId: string): Promise<Record<string, unknown>>;
  getPublicLedger(useCaseId: string): Promise<Record<string, unknown>>;
  transferAsset(spec: AssetTransferSpec): Promise<TransferReceipt>;
  burnAsset(spec: AssetBurnSpec): Promise<ContractDeployResult>;
  getQuota(): Promise<MintQuota>;
  readonly adapterName: string;
}

// ── Errors ─────────────────────────────────────────────────────────────────

/**
 * Thrown by the pre-flight quota check on mint / transfer / burn. Caught by
 * upstream services and surfaced as a `429` to the client.
 */
export class QuotaExhaustedError extends Error {
  public readonly mintMonthlyRemaining: number;
  public readonly mintMonthlyLimit: number;

  constructor(mintMonthlyRemaining: number, mintMonthlyLimit: number) {
    super(
      `Aurigraph mint quota exhausted (${mintMonthlyRemaining}/${mintMonthlyLimit} remaining)`,
    );
    this.name = 'QuotaExhaustedError';
    this.mintMonthlyRemaining = mintMonthlyRemaining;
    this.mintMonthlyLimit = mintMonthlyLimit;
    Object.setPrototypeOf(this, QuotaExhaustedError.prototype);
  }
}

/**
 * Wrapper thrown by adapter methods when the SDK escalates an
 * `AurigraphServerError` past the retry budget. Preserves `cause` so the
 * original RFC 7807 problem detail is recoverable up-stack.
 */
export class ChainServerError extends Error {
  public readonly status: number;
  public readonly errorCode?: string;

  constructor(message: string, status: number, errorCode?: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'ChainServerError';
    this.status = status;
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, ChainServerError.prototype);
  }
}

/** Wrapper thrown for permanent (4xx) SDK errors. Never retried. */
export class ChainClientError extends Error {
  public readonly status: number;
  public readonly errorCode?: string;

  constructor(message: string, status: number, errorCode?: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'ChainClientError';
    this.status = status;
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, ChainClientError.prototype);
  }
}

// ── Internal: call-log helper ──────────────────────────────────────────────

type CallLogStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRIED';

interface CallLogEntry {
  method: string;
  params: Record<string, unknown> | null;
  responseRef?: string;
  status: CallLogStatus;
  errorCode?: string;
  errorMsg?: string;
  latencyMs: number;
}

/**
 * Best-effort write to `aurigraph_call_logs`. NEVER throws — a flaky audit
 * log must not break a contract deploy. Errors are logged at warn level and
 * swallowed.
 */
async function writeCallLog(entry: CallLogEntry): Promise<void> {
  try {
    await prisma.aurigraphCallLog.create({
      data: {
        method: entry.method,
        params:
          entry.params === null
            ? Prisma.JsonNull
            : (entry.params as Prisma.InputJsonValue),
        responseRef: entry.responseRef ?? null,
        status: entry.status,
        errorCode: entry.errorCode ?? null,
        errorMsg: entry.errorMsg ?? null,
        latencyMs: entry.latencyMs,
      },
    });
  } catch (err) {
    logger.warn(
      {
        err: err instanceof Error ? err.message : String(err),
        method: entry.method,
      },
      'AurigraphCallLog write failed (swallowed)',
    );
  }
}

// ── Internal: retry helpers ────────────────────────────────────────────────

const DEFAULT_MAX_RETRIES = 3;
const RETRY_BASE_MS = 200;

interface RetryOptions {
  /** Max attempts — including the first. Default 3 (200 / 400 / 800ms). */
  maxAttempts?: number;
  /** Whether to retry on `AurigraphServerError`. Default true. Set false for
   *  non-idempotent mutations (e.g. transfer / burn) when the SDK doesn't
   *  expose an idempotency-key on that call. */
  retryServerErrors?: boolean;
}

async function backoff(attempt: number): Promise<void> {
  const base = RETRY_BASE_MS * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * 100);
  await new Promise((resolve) => setTimeout(resolve, base + jitter));
}

/**
 * Wrap an SDK call with optional retry-on-5xx + structured error mapping.
 *
 * @returns `{ value, attempts }` on success — `attempts` lets the caller
 *          distinguish "first-try success" from "retried success" so the
 *          call log records `RETRIED` rather than `SUCCESS` in the latter
 *          case.
 */
async function callWithRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<{ value: T; attempts: number }> {
  const max = opts.maxAttempts ?? DEFAULT_MAX_RETRIES;
  const retryServer = opts.retryServerErrors ?? true;

  let lastError: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      const value = await fn();
      return { value, attempts: attempt };
    } catch (err) {
      lastError = err;

      // 4xx — never retry, surface immediately as ChainClientError.
      if (err instanceof AurigraphClientError) {
        throw new ChainClientError(
          err.message,
          err.status,
          err.problem?.errorCode,
          err,
        );
      }

      // 5xx — retry if budget remains AND retry is allowed for this op.
      if (err instanceof AurigraphServerError) {
        if (retryServer && attempt < max) {
          await backoff(attempt);
          continue;
        }
        throw new ChainServerError(
          err.message,
          err.status,
          err.problem?.errorCode,
          err,
        );
      }

      // QuotaExhaustedError already thrown by the pre-flight — propagate.
      if (err instanceof QuotaExhaustedError) {
        throw err;
      }

      // Unknown / network errors — re-throw as-is so the caller's catch
      // path can decide. They are NOT retried here because the SDK already
      // does its own network retry; double-retry burns the budget.
      throw err;
    }
  }

  // Unreachable in practice — the loop either returns or throws — but keep
  // a defensive throw to satisfy the type checker.
  if (lastError instanceof AurigraphServerError) {
    throw new ChainServerError(
      lastError.message,
      lastError.status,
      lastError.problem?.errorCode,
      lastError,
    );
  }
  throw lastError ?? new Error('callWithRetry exhausted with no recorded error');
}

// ── The adapter ────────────────────────────────────────────────────────────

/** Subset of `AurigraphClient` the adapter actually uses, for testability. */
export interface AurigraphClientLike {
  contracts: AurigraphClient['contracts'] & {
    deploy?: (spec: ContractDeploySpec) => Promise<ContractDeployResult>;
  };
  assets: AurigraphClient['assets'];
  wallet: AurigraphClient['wallet'];
  tier: AurigraphClient['tier'];
}

export interface AurigraphDltAdapterOptions {
  /** Override the underlying client (for tests). Defaults to the env-driven
   *  singleton from `getAurigraphClient()`. */
  client?: AurigraphClientLike;
  /** Override the channel id used for contract deploys. Defaults to the
   *  resolved env config. */
  channelId?: string;
}

export class AurigraphDltAdapter implements ChainAdapter {
  public readonly adapterName = 'aurigraph-dlt-v1.2.0';

  private readonly client: AurigraphClientLike;
  private readonly channelId: string;

  constructor(opts: AurigraphDltAdapterOptions = {}) {
    this.client = opts.client ?? (getAurigraphClient() as AurigraphClientLike);
    this.channelId = opts.channelId ?? getAurigraphConfig().channelId;
  }

  // ── Mints / mutations (with quota pre-flight) ──────────────────────────

  /**
   * Deploy a Ricardian contract + mint the underlying token in a single
   * atomic call. Pre-flight quota check first; retries on 5xx.
   *
   * NOTE: The 1.2.0 SDK's `ContractsApi` does not yet expose `deploy()` as a
   * typed method — the documented surface is forward-looking (DEVELOPER_GUIDE
   * §5.2). We dispatch via duck-typing so this adapter starts working the
   * moment the SDK ships the real method, and tests pass a mock with the
   * method already in place.
   */
  async deployContract(spec: ContractDeploySpec): Promise<ContractDeployResult> {
    const method = 'contracts.deploy';
    const params = { ...spec, channelId: spec.channelId ?? this.channelId };
    const startedAt = Date.now();

    // Pre-flight quota — fail before contacting the SDK.
    await this.preflightQuota({ method, params, startedAt });

    try {
      const { value, attempts } = await callWithRetry(async () => {
        const deployFn = this.client.contracts.deploy;
        if (typeof deployFn !== 'function') {
          // Surface a permanent failure: the SDK in this runtime does not
          // expose deploy(). Mapped to ChainClientError for fail-fast visibility.
          throw new ChainClientError(
            'AurigraphClient.contracts.deploy is not available in this SDK build (1.2.0). Upgrade @aurigraph/dlt-sdk or supply a wrapped client.',
            501,
            'SDK_DEPLOY_UNAVAILABLE',
          );
        }
        return deployFn.call(this.client.contracts, params);
      });

      await writeCallLog({
        method,
        params,
        responseRef: value.contractId ?? value.txHash,
        status: attempts > 1 ? 'RETRIED' : 'SUCCESS',
        latencyMs: Date.now() - startedAt,
      });

      return value;
    } catch (err) {
      await this.recordFailure(method, params, startedAt, err);
      throw err;
    }
  }

  async transferAsset(spec: AssetTransferSpec): Promise<TransferReceipt> {
    const method = 'wallet.transfer';
    const params = { ...spec };
    const startedAt = Date.now();

    await this.preflightQuota({ method, params, startedAt });

    try {
      // Transfers are non-idempotent without an SDK-level idempotency key;
      // disable retry-on-5xx to avoid double-spend. The SDK transport layer
      // still does its own conservative retry inside one call.
      const { value, attempts } = await callWithRetry(
        () => this.client.wallet.transfer(spec as TransferRequest),
        { retryServerErrors: false },
      );

      await writeCallLog({
        method,
        params,
        responseRef: value.txHash,
        status: attempts > 1 ? 'RETRIED' : 'SUCCESS',
        latencyMs: Date.now() - startedAt,
      });

      return value;
    } catch (err) {
      await this.recordFailure(method, params, startedAt, err);
      throw err;
    }
  }

  /**
   * Burn / retire an asset. The V11 surface for retirement is a special-form
   * contract deploy (`templateId: UC_*_RETIREMENT` with a `retiredFor` term)
   * rather than a separate burn endpoint, so we delegate to deployContract
   * with a marker template id. This keeps the audit trail uniform.
   */
  async burnAsset(spec: AssetBurnSpec): Promise<ContractDeployResult> {
    const method = 'contracts.deploy.retire';
    const params: Record<string, unknown> = { ...spec };
    const startedAt = Date.now();

    await this.preflightQuota({ method, params, startedAt });

    try {
      const { value, attempts } = await callWithRetry(async () => {
        const deployFn = this.client.contracts.deploy;
        if (typeof deployFn !== 'function') {
          throw new ChainClientError(
            'AurigraphClient.contracts.deploy is not available in this SDK build (1.2.0). Upgrade @aurigraph/dlt-sdk or supply a wrapped client.',
            501,
            'SDK_DEPLOY_UNAVAILABLE',
          );
        }
        // Merge optional structured metadata (AAT-κ / AV4-357 delist payload)
        // UNDER the canonical retire fields so a misbehaving caller cannot
        // silently overwrite assetId/amount/reason/retiredBy via metadata.
        const terms: Record<string, unknown> = {
          ...(spec.metadata ?? {}),
          assetId: spec.assetId,
          amount: spec.amount,
          reason: spec.reason,
          retiredBy: spec.retiredBy,
        };
        return deployFn.call(this.client.contracts, {
          templateId: 'RETIREMENT',
          useCaseId: 'RETIREMENT',
          channelId: this.channelId,
          terms,
        });
      });

      await writeCallLog({
        method,
        params,
        responseRef: value.contractId ?? value.txHash,
        status: attempts > 1 ? 'RETRIED' : 'SUCCESS',
        latencyMs: Date.now() - startedAt,
      });

      return value;
    } catch (err) {
      await this.recordFailure(method, params, startedAt, err);
      throw err;
    }
  }

  // ── Reads (idempotent — safe to retry) ─────────────────────────────────

  async getAsset(assetId: string): Promise<Record<string, unknown>> {
    return this.runRead('assets.get', { assetId }, () =>
      this.client.assets.get(assetId),
    );
  }

  async listByUseCase(useCaseId: string): Promise<Record<string, unknown>> {
    return this.runRead('assets.listByUseCase', { useCaseId }, () =>
      this.client.assets.listByUseCase(useCaseId),
    );
  }

  async getPublicLedger(useCaseId: string): Promise<Record<string, unknown>> {
    return this.runRead('assets.getPublicLedger', { useCaseId }, () =>
      this.client.assets.getPublicLedger(useCaseId),
    );
  }

  async getQuota(): Promise<MintQuota> {
    return this.runRead('tier.getQuota', null, () =>
      this.client.tier.getQuota(),
    );
  }

  // ── Internal helpers ───────────────────────────────────────────────────

  private async preflightQuota(ctx: {
    method: string;
    params: Record<string, unknown>;
    startedAt: number;
  }): Promise<void> {
    let quota: MintQuota;
    try {
      quota = await this.client.tier.getQuota();
    } catch (err) {
      // Map the pre-flight error itself; do NOT mask it as quota-exhausted.
      if (err instanceof AurigraphClientError) {
        throw new ChainClientError(
          `Quota pre-flight failed: ${err.message}`,
          err.status,
          err.problem?.errorCode,
          err,
        );
      }
      if (err instanceof AurigraphServerError) {
        throw new ChainServerError(
          `Quota pre-flight failed: ${err.message}`,
          err.status,
          err.problem?.errorCode,
          err,
        );
      }
      throw err;
    }

    // mintMonthlyLimit === -1 means "unlimited" per the V11 contract — skip.
    if (
      quota.mintMonthlyLimit !== -1 &&
      quota.mintMonthlyRemaining < 1
    ) {
      const qe = new QuotaExhaustedError(
        quota.mintMonthlyRemaining,
        quota.mintMonthlyLimit,
      );
      // Record the pre-flight rejection so ops can see quota-driven failures.
      await writeCallLog({
        method: ctx.method,
        params: ctx.params,
        status: 'FAILED',
        errorCode: 'QUOTA_EXHAUSTED',
        errorMsg: qe.message,
        latencyMs: Date.now() - ctx.startedAt,
      });
      throw qe;
    }
  }

  private async runRead<T>(
    method: string,
    params: Record<string, unknown> | null,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      // Reads are idempotent — retry-on-5xx is on by default.
      const { value, attempts } = await callWithRetry(fn);
      await writeCallLog({
        method,
        params,
        status: attempts > 1 ? 'RETRIED' : 'SUCCESS',
        latencyMs: Date.now() - startedAt,
      });
      return value;
    } catch (err) {
      await this.recordFailure(method, params, startedAt, err);
      throw err;
    }
  }

  private async recordFailure(
    method: string,
    params: Record<string, unknown> | null,
    startedAt: number,
    err: unknown,
  ): Promise<void> {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorCode =
      err instanceof ChainClientError || err instanceof ChainServerError
        ? err.errorCode
        : err instanceof QuotaExhaustedError
          ? 'QUOTA_EXHAUSTED'
          : err instanceof AurigraphClientError || err instanceof AurigraphServerError
            ? err.problem?.errorCode
            : undefined;

    await writeCallLog({
      method,
      params,
      status: 'FAILED',
      errorCode,
      errorMsg,
      latencyMs: Date.now() - startedAt,
    });
  }
}

/**
 * Module-level singleton accessor — most callers should use this rather than
 * constructing `AurigraphDltAdapter` directly. Mirrors `getUnfcccAdapter()`.
 */
let cachedAdapter: AurigraphDltAdapter | null = null;

export function getAurigraphAdapter(): AurigraphDltAdapter {
  if (!cachedAdapter) {
    cachedAdapter = new AurigraphDltAdapter();
  }
  return cachedAdapter;
}

/** Test-only — reset the cached adapter so the next test gets a fresh instance. */
export function __resetAurigraphAdapterCache(): void {
  cachedAdapter = null;
}
