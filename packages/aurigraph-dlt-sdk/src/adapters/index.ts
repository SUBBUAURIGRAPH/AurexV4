/**
 * Project adapters — thin, project-specific wrappers around
 * `AurigraphClient` that map domain events to DMRV/contract calls.
 */

export { ProvenewsAdapter } from './provenews/adapter.js';
export { BattuaAdapter } from './battua/adapter.js';
export { HermesAdapter } from './hermes/adapter.js';

export type {
  ProvenewsAssetEvent,
  ProvenewsAssetEventType,
  ProvenewsContractEvent,
  ProvenewsContractEventType,
  ProvenewsLicenseType,
} from './provenews/types.js';

export type {
  BattuaTransferEvent,
  BattuaSettlementEvent,
  BattuaNodeStatus,
  BattuaSymbol,
  BattuaFinalityStatus,
} from './battua/types.js';
export { BATTUA_SYMBOLS } from './battua/types.js';

export type {
  HermesTradeEvent,
  HermesBatchEvent,
  HermesVerificationEvent,
  HermesVerificationStatus,
  HermesSide,
} from './hermes/types.js';

export type { DmrvFramework } from './common.js';
