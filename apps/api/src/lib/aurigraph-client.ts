/**
 * Aurigraph DLT SDK — singleton client wiring.
 *
 * Owns the lazy construction + memoisation of the per-process
 * `AurigraphClient` instance used by the chain-adapter layer
 * (`src/services/chains/aurigraph-dlt-adapter.ts`).
 *
 * Configuration is driven entirely by environment variables so the same
 * binary works in dev / CI / staging / production without code changes:
 *
 *   - AURIGRAPH_API_KEY     (required outside NODE_ENV=test)
 *   - AURIGRAPH_BASE_URL    (default: https://dlt.aurigraph.io)
 *   - AURIGRAPH_CHANNEL_ID  (default: marketplace-channel — read by the
 *                            adapter, exposed here for parity)
 *   - AURIGRAPH_APP_ID      (optional but recommended for production —
 *                            switches auth to "ApiKey <appId>:<apiKey>")
 *
 * Test-mode behaviour: when `NODE_ENV === 'test'` and no real `apiKey` is
 * configured, this module returns a *stub* client whose every namespace
 * method throws. That makes accidental network calls in the unit-test suite
 * a hard failure rather than a silent timeout, and removes the need for
 * tests to set the env var. Tests that exercise the adapter MUST inject
 * their own mocked `AurigraphClient` via the adapter's constructor.
 *
 * AAT-β / AV4-370.
 */

import { AurigraphClient } from '@aurigraph/dlt-sdk';
import { logger } from './logger.js';

const DEFAULT_BASE_URL = 'https://dlt.aurigraph.io';
const DEFAULT_CHANNEL_ID = 'marketplace-channel';

/** Resolved Aurigraph runtime configuration (after env-var lookup + defaults). */
export interface AurigraphRuntimeConfig {
  baseUrl: string;
  channelId: string;
  appId?: string;
  /** True when running with a stub client (NODE_ENV=test + no apiKey). */
  isStub: boolean;
}

let cachedClient: AurigraphClient | null = null;
let cachedConfig: AurigraphRuntimeConfig | null = null;

/**
 * Build a stub `AurigraphClient` for the test environment that throws on every
 * SDK call. We only set the namespaces actually used by AurigraphDltAdapter
 * — that's enough to make any accidental untyped traversal explode loudly.
 *
 * The cast to `AurigraphClient` is deliberate: the stub is intentionally
 * non-functional and only exists to satisfy the singleton signature.
 */
function buildStubClient(): AurigraphClient {
  const stubMessage =
    'AurigraphClient: no live connection in tests — inject a mocked client into AurigraphDltAdapter instead';
  const explode = (label: string) => () => {
    throw new Error(`${stubMessage} (called: ${label})`);
  };

  // Each namespace mirrors only the methods the adapter touches. Every other
  // surface stays undefined so that an unintended access also fails fast.
  const stub = {
    contracts: {
      // The 1.2.0 SDK does not yet ship `deploy`; the adapter dispatches via
      // `(client.contracts as { deploy?: ... }).deploy?.(...)`. We expose it
      // here so the type assertion in the adapter remains valid.
      deploy: explode('contracts.deploy'),
      getTokens: explode('contracts.getTokens'),
      bindComposite: explode('contracts.bindComposite'),
      issueDerivedFromComposite: explode('contracts.issueDerivedFromComposite'),
      getBindingsForContract: explode('contracts.getBindingsForContract'),
      getBindingsForToken: explode('contracts.getBindingsForToken'),
    },
    assets: {
      get: explode('assets.get'),
      list: explode('assets.list'),
      listByUseCase: explode('assets.listByUseCase'),
      listByChannel: explode('assets.listByChannel'),
      getPublicLedger: explode('assets.getPublicLedger'),
      query: explode('assets.query'),
    },
    wallet: {
      transfer: explode('wallet.transfer'),
      getBalance: explode('wallet.getBalance'),
      getHistory: explode('wallet.getHistory'),
    },
    tier: {
      getQuota: explode('tier.getQuota'),
      getPartnerTier: explode('tier.getPartnerTier'),
      getUsage: explode('tier.getUsage'),
      requestUpgrade: explode('tier.requestUpgrade'),
    },
    sdk: {
      mintQuota: explode('sdk.mintQuota'),
    },
    // AAT-ρ / AV4-376 — compliance namespace (stubbed for tests).
    compliance: {
      listFrameworks: explode('compliance.listFrameworks'),
      getFramework: explode('compliance.getFramework'),
      assess: explode('compliance.assess'),
      getAssessments: explode('compliance.getAssessments'),
    },
    // AAT-ρ / AV4-377 — dmrv namespace (stubbed for tests).
    dmrv: {
      recordEvent: explode('dmrv.recordEvent'),
      getAuditTrail: explode('dmrv.getAuditTrail'),
      batchRecord: explode('dmrv.batchRecord'),
      triggerMint: explode('dmrv.triggerMint'),
    },
  };

  return stub as unknown as AurigraphClient;
}

/**
 * Resolve configuration from env vars. Throws a clear error when running
 * outside of test mode and `AURIGRAPH_API_KEY` is missing — this is a
 * deliberate fail-fast at boot time.
 */
function resolveConfig(): {
  config: AurigraphRuntimeConfig;
  apiKey?: string;
} {
  const baseUrl = (process.env.AURIGRAPH_BASE_URL ?? DEFAULT_BASE_URL).replace(
    /\/+$/,
    '',
  );
  const channelId = process.env.AURIGRAPH_CHANNEL_ID ?? DEFAULT_CHANNEL_ID;
  const appId = process.env.AURIGRAPH_APP_ID;
  const apiKey = process.env.AURIGRAPH_API_KEY;
  const nodeEnv = process.env.NODE_ENV;

  const isTest = nodeEnv === 'test';

  if (!apiKey && !isTest) {
    throw new Error(
      'AurigraphClient: AURIGRAPH_API_KEY is required (set NODE_ENV=test for the in-memory stub).',
    );
  }

  return {
    config: {
      baseUrl,
      channelId,
      appId,
      isStub: !apiKey && isTest,
    },
    apiKey,
  };
}

/**
 * Return the memoised AurigraphClient singleton. First call constructs the
 * client (or stub); subsequent calls reuse it.
 *
 * In production / staging the live client is always wired with the API key
 * (and optional appId, which switches the SDK to the production
 * `Authorization: ApiKey <appId>:<apiKey>` header).
 *
 * In `NODE_ENV=test` without an API key, a stub is returned so that accidental
 * network calls explode immediately instead of hanging the test process.
 */
export function getAurigraphClient(): AurigraphClient {
  if (cachedClient) return cachedClient;

  const { config, apiKey } = resolveConfig();
  cachedConfig = config;

  if (config.isStub) {
    logger.warn(
      { baseUrl: config.baseUrl },
      'AurigraphClient: running in test-stub mode — every SDK call will throw',
    );
    cachedClient = buildStubClient();
    return cachedClient;
  }

  // Live client. The SDK only requires baseUrl; apiKey/appId set the auth
  // header (see SDK src/client.ts → buildHeaders).
  cachedClient = new AurigraphClient({
    baseUrl: config.baseUrl,
    apiKey,
    appId: config.appId,
    debug: process.env.AURIGRAPH_DEBUG === '1',
  });

  logger.info(
    { baseUrl: config.baseUrl, channelId: config.channelId, hasAppId: !!config.appId },
    'AurigraphClient: initialised',
  );

  return cachedClient;
}

/** Read-only view of the resolved config (lazy — triggers init if needed). */
export function getAurigraphConfig(): AurigraphRuntimeConfig {
  if (!cachedConfig) {
    getAurigraphClient();
  }
  // cachedConfig is set inside getAurigraphClient, so non-null after the call.
  return cachedConfig!;
}

/**
 * Test-only helper. Resets the memoised singleton so successive tests can
 * construct fresh stubs after mutating env vars. Not exported via the
 * public path; tests import this name explicitly.
 */
export function __resetAurigraphClientCache(): void {
  cachedClient = null;
  cachedConfig = null;
}
