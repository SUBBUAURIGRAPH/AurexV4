import { DisabledBcrAdapter } from './disabled-bcr-adapter.js';
import { MockBcrAdapter } from './mock-bcr-adapter.js';
import type { BcrRegistryAdapter } from './bcr-adapter.js';

export type {
  BcrAdapterResult,
  BcrBeneficiary,
  BcrRegistryAdapter,
  BcrVccStatus,
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
export { DisabledBcrAdapter } from './disabled-bcr-adapter.js';
export { MockBcrAdapter } from './mock-bcr-adapter.js';

/**
 * BCR registry adapter factory.
 *
 * Reads `BCR_REGISTRY_ADAPTER` (default `disabled`). Supported values:
 *
 *   - `disabled` — default. Returns a `DisabledBcrAdapter` that records
 *     every call as `ok: false` with a "BCR Third-Party authorisation
 *     pending" reason. No network side-effects. Use this in production
 *     until BCR Third-Party authorisation has been granted (binding
 *     requirement B1 of `docs/BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md`).
 *
 *   - `mock` — returns a `MockBcrAdapter` with an in-memory state machine
 *     that faithfully reproduces the BCR lock-then-mint flow. Intended
 *     for unit tests, integration smoke tests, and the Aurigraph DLT V12
 *     sandbox tenant. NEVER use in production.
 *
 *   - `live-v1` — reserved name. Throws at startup until the live BCR
 *     adapter is implemented (Sprint 3+ ticket). Misconfiguration fails
 *     fast in production.
 *
 * Any other value throws to avoid silently falling back to disabled in a
 * misconfigured environment.
 *
 * The adapter instance is cached as a module-level singleton so repeated
 * calls within a process share state — important for the `mock` adapter
 * because its state machine lives in memory.
 */

const VALID_RESERVED_NAMES = ['live-v1'] as const;

let cached: BcrRegistryAdapter | null = null;

export function getBcrAdapter(): BcrRegistryAdapter {
  if (cached) return cached;

  const raw = (process.env.BCR_REGISTRY_ADAPTER ?? 'disabled')
    .trim()
    .toLowerCase();

  if (raw === '' || raw === 'disabled') {
    cached = new DisabledBcrAdapter();
    return cached;
  }

  if (raw === 'mock') {
    cached = new MockBcrAdapter();
    return cached;
  }

  if ((VALID_RESERVED_NAMES as readonly string[]).includes(raw)) {
    throw new Error(
      `BCR_REGISTRY_ADAPTER=${raw} is reserved but not yet implemented — ` +
        `apply for BCR Third-Party authorisation first (binding requirement B1, ` +
        `docs/BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md), then implement a ` +
        `concrete adapter in apps/api/src/services/registries/bcr/ and register ` +
        `it here. Set BCR_REGISTRY_ADAPTER=disabled (or unset) to use the no-op ` +
        `default in the meantime.`,
    );
  }

  throw new Error(
    `BCR_REGISTRY_ADAPTER=${raw} is not a recognised adapter name. ` +
      `Supported values: disabled (default), mock, live-v1. ` +
      `See docs/BIOCARBON_SPARC_PLAN.md (Sprint 1) for the adapter runbook.`,
  );
}

/**
 * Test-only helper. Clears the cached singleton so a fresh factory call
 * re-reads the environment (and re-instantiates a new MockBcrAdapter with
 * empty state). Not exported for production code paths.
 */
export function __resetBcrAdapterCache(): void {
  cached = null;
}
