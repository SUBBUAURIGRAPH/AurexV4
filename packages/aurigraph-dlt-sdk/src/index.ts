/**
 * @aurigraph/dlt-sdk — Official TypeScript SDK for Aurigraph DLT (V12 platform, V11 API).
 */

export { AurigraphClient } from './client.js';
export * from './types.js';
export {
  AurigraphError,
  AurigraphClientError,
  AurigraphServerError,
  AurigraphNetworkError,
  AurigraphConfigError,
  ValidationError,
  type ProblemDetails,
} from './errors.js';
export { DmrvApi, DMRV_BATCH_CHUNK_SIZE, isUuid } from './namespaces/dmrv.js';
export { ContractsApi } from './namespaces/contracts.js';
export { TokenRegistryApi } from './namespaces/tokenRegistry.js';
export { GdprApi } from './namespaces/gdpr.js';
export { GraphQLApi } from './namespaces/graphql.js';
export { TierApi } from './namespaces/tier.js';
export { AssetsApi } from './namespaces/assets.js';
export { GovernanceApi } from './namespaces/governance.js';
export { WalletApi } from './namespaces/wallet.js';
export { ComplianceApi } from './namespaces/compliance.js';
export { OfflineQueue } from './queue.js';
export { generateKey, generateKeySync, canonicalize } from './idempotency.js';

// Project adapters (Provenews, Battua, Hermes)
export * from './adapters/index.js';
