/**
 * Provenews adapter — content provenance event types.
 *
 * Provenews uses C2PA (Content Provenance and Authenticity) as its DMRV
 * framework. Events flow through `client.dmrv.recordEvent` with a
 * C2PA framework tag carried in `metadata.framework`.
 */

export type ProvenewsAssetEventType =
  | 'ContentRegistered'
  | 'AttributionVerified'
  | 'OwnershipTransferred'
  | 'AssetLicensed';

export interface ProvenewsAssetEvent {
  assetId: string;
  eventType: ProvenewsAssetEventType;
  /** SHA-256 of content bytes, 64 hex chars, lowercase preferred. */
  contentHash: string;
  ownerId: string;
  parentAssetId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export type ProvenewsContractEventType =
  | 'ContractCreated'
  | 'ContractSigned'
  | 'ContractRevoked';

export type ProvenewsLicenseType = 'COMMERCIAL' | 'ROYALTY' | 'OPEN';

export interface ProvenewsContractEvent {
  contractId: string;
  eventType: ProvenewsContractEventType;
  tokenId: string;
  ownerId: string;
  licenseType: ProvenewsLicenseType;
  /** Royalty rate in basis points (bps). 100 bps = 1%. */
  royaltyRateBps?: number;
  timestamp?: string;
}
