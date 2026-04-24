import { DisabledUnfcccAdapter } from './disabled-adapter.js';
import type { UnfcccRegistryAdapter } from './unfccc-adapter.js';

export type { UnfcccRegistryAdapter, UnfcccAdapterResult } from './unfccc-adapter.js';
export { DisabledUnfcccAdapter } from './disabled-adapter.js';

/**
 * UNFCCC registry adapter factory.
 *
 * Reads `UNFCCC_REGISTRY_ADAPTER` (default `disabled`). Supported values:
 *
 *   - `disabled` — default. Returns a `DisabledUnfcccAdapter` that records
 *     every call as `synced: false` with a spec-pending reason. No network
 *     side-effects.
 *   - `mock`, `backblaze-b2`, `live-v1` — reserved for future adapters.
 *     Currently throw at startup with a clear error so misconfiguration
 *     fails fast in production.
 *
 * Any other value throws to avoid silently falling back to disabled in
 * a misconfigured environment.
 *
 * The adapter instance is cached as a module-level singleton so repeated
 * calls within a process share state (useful for future adapters that
 * maintain a connection pool / retry queue).
 */

const VALID_RESERVED_NAMES = ['mock', 'backblaze-b2', 'live-v1'] as const;

let cached: UnfcccRegistryAdapter | null = null;

export function getUnfcccAdapter(): UnfcccRegistryAdapter {
  if (cached) return cached;

  const raw = (process.env.UNFCCC_REGISTRY_ADAPTER ?? 'disabled').trim().toLowerCase();

  if (raw === '' || raw === 'disabled') {
    cached = new DisabledUnfcccAdapter();
    return cached;
  }

  if ((VALID_RESERVED_NAMES as readonly string[]).includes(raw)) {
    throw new Error(
      `UNFCCC_REGISTRY_ADAPTER=${raw} is reserved but not yet implemented. ` +
        `The UNFCCC A6.4 mechanism registry API spec (CMA.6+) has not published. ` +
        `Set UNFCCC_REGISTRY_ADAPTER=disabled (or unset) to use the no-op default, ` +
        `or implement a concrete adapter in apps/api/src/services/registries/ and ` +
        `register it here.`,
    );
  }

  throw new Error(
    `UNFCCC_REGISTRY_ADAPTER=${raw} is not a recognised adapter name. ` +
      `Supported values: disabled (default), mock, backblaze-b2, live-v1. ` +
      `See docs/A6_4_UNFCCC_REGISTRY.md for the adapter runbook.`,
  );
}

/**
 * Test-only helper. Clears the cached singleton so a fresh factory call
 * re-reads the environment. Not exported for production code paths.
 */
export function __resetUnfcccAdapterCache(): void {
  cached = null;
}
