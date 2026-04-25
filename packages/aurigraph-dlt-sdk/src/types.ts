/**
 * Aurigraph DLT SDK — TypeScript Types
 *
 * Mirrors V12 Java DTOs exposed via /api/v11 endpoints.
 */

// ── Client configuration ───────────────────────────────────────────────────

export interface AurigraphClientConfig {
  /** Base URL, e.g. `https://dlt.aurigraph.io`. Path `/api/v11` is appended automatically. */
  baseUrl: string;
  /**
   * API key.
   *
   * - When paired with {@link appId}: sent as `Authorization: ApiKey <appId>:<apiKey>`
   *   (the production SDK handshake format expected by the backend `SdkApiKeyAuthFilter`).
   * - When used alone (legacy): sent as `X-API-Key: <apiKey>` with a one-time
   *   deprecation warning. Existing callers continue to work but should migrate.
   */
  apiKey?: string;
  /**
   * Application ID (UUID) issued during 3rd-party app registration. Required
   * (together with {@link apiKey}) for the production SDK auth flow which sends
   * `Authorization: ApiKey <appId>:<apiKey>`.
   */
  appId?: string;
  /** Optional Keycloak/OAuth2 JWT (sent as `Authorization: Bearer ...`). */
  jwtToken?: string;
  /** Per-request timeout in ms. Default: 10_000. */
  timeoutMs?: number;
  /** Max retry attempts on 5xx / network errors. Default: 3. */
  maxRetries?: number;
  /** Enable console.debug logging. Default: false. */
  debug?: boolean;
  /** Custom fetch impl (for tests or non-browser runtimes). Default: global fetch. */
  fetchImpl?: typeof fetch;
  /** Enable offline-queue: failed 5xx/network mutations are queued for retry. */
  enableQueue?: boolean;
  /** OfflineQueue options (max size, auto-flush interval, storage). */
  queueOptions?: QueueOptions;
  /** Auto-attach `Idempotency-Key` header to POST/PUT/DELETE. Default true when enableQueue. */
  autoIdempotency?: boolean;
  /**
   * If true, fire a best-effort `sdk.hello()` bootstrap call on construction.
   * Result is cached on the client and passed to {@link onHandshake}.
   * Requires `jwtToken` OR (`appId` + `apiKey`). Default: false.
   */
  autoHandshake?: boolean;
  /**
   * If true, start a 5-minute heartbeat interval that calls
   * `sdk.heartbeat()` to keep the app session alive server-side.
   * Requires `appId` + `apiKey`. Default: false.
   *
   * Call {@link AurigraphClient#dispose} on app shutdown to stop the timer.
   */
  autoHeartbeat?: boolean;
  /**
   * Optional caller-provided client version, forwarded as
   * `HeartbeatRequest.clientVersion` when auto-heartbeat is enabled.
   */
  clientVersion?: string;
  /**
   * Callback invoked after a successful auto-handshake. Receives the full
   * {@link HelloResponse} with approved scopes, rate limits, features.
   */
  onHandshake?: (hello: HelloResponse) => void;
}

// ── SDK Handshake Protocol ─────────────────────────────────────────────────

/** Rate-limit policy announced by the server during handshake. */
export interface HandshakeRateLimit {
  requestsPerMinute: number;
  burstSize: number;
}

/**
 * Response from `GET /api/v11/sdk/handshake/hello` — the bootstrap call that
 * returns full server metadata plus this app's registered permissions.
 */
export interface HelloResponse {
  appId: string;
  appName: string;
  did: string;
  status: string;
  serverVersion: string;
  protocolVersion: string;
  approvedScopes: string[];
  requestedScopes: string[];
  pendingScopes: string[];
  rateLimit: HandshakeRateLimit;
  heartbeatIntervalMs: number;
  features: Record<string, boolean>;
  nextHeartbeatAt: string;
}

/** Request body for `POST /api/v11/sdk/handshake/heartbeat`. */
export interface HeartbeatRequest {
  clientVersion?: string;
  timestamp?: string;
}

/** Response from `POST /api/v11/sdk/handshake/heartbeat`. */
export interface HeartbeatResponse {
  receivedAt: string;
  nextHeartbeatAt: string;
  status: string;
}

/** One entry in the capabilities listing — a permitted endpoint. */
export interface CapabilityEndpoint {
  method: string;
  path: string;
  requiredScope: string;
  description: string;
}

/** Response from `GET /api/v11/sdk/handshake/capabilities`. */
export interface CapabilitiesResponse {
  appId: string;
  approvedScopes: string[];
  endpoints: CapabilityEndpoint[];
  totalEndpoints: number;
}

/** Response from `GET /api/v11/sdk/handshake/config` — lightweight refresh. */
export interface ConfigResponse {
  appId: string;
  status: string;
  approvedScopes: string[];
  pendingScopes: string[];
  rateLimit: HandshakeRateLimit;
  lastUpdatedAt: string;
}

// ── Platform stats & health ────────────────────────────────────────────────

export interface HealthResponse {
  status: 'HEALTHY' | 'DEGRADED' | 'UP' | 'DOWN' | string;
  durationMs?: number;
  version?: string;
  timestamp?: string;
}

export interface PlatformStats {
  tps: number;
  activeNodes: number;
  blockHeight: number;
  totalTransactions?: number;
  uptime?: number;
  [key: string]: unknown;
}

// ── Nodes ───────────────────────────────────────────────────────────────────

export type NodeType = 'VALIDATOR' | 'BUSINESS' | 'ENTERPRISE_INTEGRATOR' | 'MOBILE_BUSINESS';

export interface NodeInfo {
  nodeId: string;
  nodeType: NodeType | string;
  status: string;
  host?: string;
  port?: number;
  publicKey?: string;
  registeredAt?: string;
  lastHeartbeat?: string;
}

export interface NodeRegisterRequest {
  nodeId: string;
  nodeType: NodeType | string;
  host?: string;
  port?: number;
  /** Required for VALIDATOR type (PQC public key hex). */
  publicKey?: string;
  nodeLabel?: string;
  version?: string;
}

export interface NodeMetrics {
  totalNodes: number;
  activeNodes: number;
  validatorCount: number;
  businessCount?: number;
  enterpriseCount?: number;
  networkStatus: string;
}

export interface NodeList {
  nodes: NodeInfo[];
  total: number;
  page?: number;
  pageSize?: number;
}

// ── Registries ──────────────────────────────────────────────────────────────

export interface BattuaToken {
  tokenId: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: string;
  issuer?: string;
}

export interface BattuaNodeRegistration {
  nodeId: string;
  nodeLabel?: string;
  lastHeartbeat?: string;
  version?: string;
  status?: string;
}

export interface ProvenewsContract {
  contractId: string;
  title: string;
  documentType?: string;
  createdAt?: string;
  status?: string;
}

/** Request body for POST /provenews/contracts (create monetization contract). */
export interface ProvenewsContractCreateRequest {
  tokenId: string;
  ownerId: string;
  title: string;
  licenseType?: string;
  royaltyRateBps?: number;
  metadata?: Record<string, unknown>;
}

/** Revenue event recorded against a Provenews contract. */
export interface ProvenewsRevenueEvent {
  eventId?: string;
  contractId: string;
  amount: string;
  currency?: string;
  source?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

/** Request body for POST /provenews/contracts/{contractId}/revenue. */
export interface ProvenewsRevenueRequest {
  amount: string;
  currency?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

/** Provenews ledger asset. */
export interface ProvenewsAsset {
  id: string;
  assetType: 'PRIMARY' | 'SECONDARY' | 'COMPOSITE' | string;
  contentHash?: string;
  ownerId?: string;
  status?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

/** Request body for POST /provenews/ledger/assets (register asset). */
export interface ProvenewsAssetRegisterRequest {
  assetType: 'PRIMARY' | 'SECONDARY' | 'COMPOSITE' | string;
  contentHash: string;
  ownerId: string;
  metadata?: Record<string, unknown>;
}

/** Merkle inclusion proof for a Provenews asset. */
export interface ProvenewsMerkleProof {
  assetId: string;
  root: string;
  path: string[];
  leafHash: string;
  verified?: boolean;
}

/** Provenews tree checkpoint. */
export interface ProvenewsCheckpoint {
  type: string;
  root: string;
  totalEntries: number;
  timestamp?: string;
}

/** Provenews org record. */
export interface ProvenewsOrg {
  orgId: string;
  name: string;
  status?: string;
  registeredAt?: string;
  metadata?: Record<string, unknown>;
}

/** Provenews composite token. */
export interface ProvenewsCompositeToken {
  tokenId: string;
  ownerId: string;
  components?: Record<string, unknown>[];
  status?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

/** Request body for POST /provenews/tokens/composite (assemble composite token). */
export interface ProvenewsCompositeAssembleRequest {
  ownerId: string;
  components: string[];
  metadata?: Record<string, unknown>;
}

/** Composite token verification result. */
export interface ProvenewsTokenVerification {
  tokenId: string;
  verified: boolean;
  integrityHash?: string;
  timestamp?: string;
}

/** Provenews device registration. */
export interface ProvenewsDevice {
  deviceId: string;
  userId: string;
  deviceType?: string;
  status?: string;
  registeredAt?: string;
  metadata?: Record<string, unknown>;
}

/** Request body for POST /provenews/devices/register. */
export interface ProvenewsDeviceRegisterRequest {
  userId: string;
  deviceType?: string;
  metadata?: Record<string, unknown>;
}

/** Provenews tokenization node. */
export interface ProvenewsTokenizationNode {
  nodeId: string;
  status?: string;
  assignedAssets?: number;
  metadata?: Record<string, unknown>;
}

/** Request body for POST /provenews/tokenization/assets/{assetId} (assign validators). */
export interface ProvenewsAssignValidatorsRequest {
  validatorNodeIds: string[];
  metadata?: Record<string, unknown>;
}

/** Provenews tokenization summary. */
export interface ProvenewsTokenizationStatus {
  totalNodes: number;
  activeNodes: number;
  totalAssetsTokenized: number;
  pendingAssignments?: number;
}

/** Battua token mint request (admin, requires auth). */
export interface BattuaMintRequest {
  symbol: string;
  amount: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
}

/** Battua node registry statistics. */
export interface BattuaNodeStats {
  totalNodes: number;
  activeNodes: number;
  averageUptimeMs?: number;
  [key: string]: unknown;
}

export interface UseCase {
  id: string;
  name: string;
  category: string;
  description?: string;
  assetCount?: number;
  contractCount?: number;
}

// ── Generic Token Registry (/api/v11/registries/tokens) ────────────────────

export type TokenType =
  | 'PRIMARY'
  | 'SECONDARY'
  | 'COMPOSITE'
  | 'UTILITY'
  | 'GOVERNANCE'
  | 'REWARD'
  | string;

export type TokenStatus =
  | 'CREATED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'FROZEN'
  | 'BURNED'
  | 'RETIRED'
  | string;

export interface Token {
  id: string;
  channelId?: string;
  tokenType: TokenType;
  status: TokenStatus;
  name: string;
  symbol: string;
  ownerId?: string;
  totalSupply?: number | string;
  decimals?: number;
  createdAt?: string;
}

/** Full token detail as returned by GET /registries/tokens/{id}. */
export interface TokenDetail extends Token {
  assetEntryId?: string | null;
  secondaryDataEntryId?: string | null;
  metadata?: Record<string, string>;
}

export interface TokenListFilter {
  /** Token type, e.g. PRIMARY | SECONDARY | COMPOSITE | UTILITY. */
  standard?: TokenType;
  /** Only include ACTIVE tokens when true. */
  active?: boolean;
  /** Zero-indexed page number. Default 0. */
  page?: number;
  /** Page size (V12 clamps to 1..100). Default 20. */
  size?: number;
}

export interface TokenListResponse {
  content: TokenDetail[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CreateTokenRequest {
  tokenType: TokenType;
  name: string;
  symbol: string;
  ownerId?: string;
  assetEntryId?: string;
  secondaryDataEntryId?: string;
  /** Initial total supply — V12 stores as Long. */
  totalSupply?: number;
  /** Decimals (0..18). Default 18. */
  decimals?: number;
  metadata?: Record<string, string>;
}

/** Mint request for the generic token registry. */
export interface MintRequest {
  /** Recipient address — mapped to V12 `recipient` field. */
  toAddress?: string;
  /** Alternative alias for toAddress. */
  recipient?: string;
  /** Integer amount to mint (accepts numeric string for >2^53 values). */
  amount: number | string;
  /** Optional opaque metadata forwarded to the V12 mint request. */
  metadata?: Record<string, unknown>;
}

export interface TokenMintReceipt {
  tokenId: string;
  amount: number;
  recipient?: string;
  newTotalSupply: number;
  merkleRootHash?: string;
  timestamp?: string;
}

export interface TokenHolder {
  address: string;
  balance: number;
  lastUpdated?: string;
}

export interface TokenTransfer {
  transactionHash: string;
  from: string;
  to: string;
  amount: number;
  timestamp?: string;
}

export interface TransferFilter {
  /** ISO-8601 start timestamp. */
  from?: string;
  /** ISO-8601 end timestamp. */
  to?: string;
  page?: number;
  size?: number;
}

export interface TokenRegistryStats {
  totalTokens: number;
  activeTokens: number;
  totalSupply: string;
  byType: Record<string, number>;
}

// ── Channels ────────────────────────────────────────────────────────────────

export interface Channel {
  channelId: string;
  name: string;
  type: string;
  description?: string;
  stakeholders?: ChannelStakeholder[];
  createdAt?: string;
}

export interface ChannelStakeholder {
  nodeId: string;
  role: string;
  joinedAt?: string;
}

export interface ChannelCreateRequest {
  name: string;
  type: string;
  description?: string;
}

// ── Transactions ────────────────────────────────────────────────────────────

export interface Transaction {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  asset: string;
  status: string;
  blockHeight?: number;
  timestamp?: string;
  memo?: string;
}

export interface TransactionSubmitRequest {
  fromAddress: string;
  toAddress: string;
  amount: string;
  asset: string;
  memo?: string;
  /** Optional Ed25519/Dilithium signature. */
  signature?: string;
  /** Optional sender public key hex (required when signature is provided). */
  publicKey?: string;
}

export interface TransactionReceipt {
  txHash: string;
  status: string;
  blockHeight?: number;
  timestamp?: string;
}

export interface TransactionList {
  transactions: Transaction[];
  total: number;
}

// ── DMRV (Digital Measurement, Reporting, Verification) ────────────────────

export type DmrvEventType =
  | 'BATTERY_CHARGE'
  | 'BATTERY_DISCHARGE'
  | 'BATTERY_SWAP'
  | 'CARBON_OFFSET'
  | 'ENERGY_GENERATION'
  | 'ENERGY_CONSUMPTION'
  | 'METER_READING'
  | 'CUSTOM'
  | string;

export interface DmrvEvent {
  /** Optional client-generated event id (UUID recommended). */
  eventId?: string;
  /** Device / node / meter that produced the reading. */
  deviceId: string;
  /** Event type — see DmrvEventType. */
  eventType: DmrvEventType;
  /** Numeric reading (kWh, tCO2e, etc). */
  quantity: number;
  /** Unit label (e.g. 'kWh', 'tCO2e'). */
  unit?: string;
  /** ISO-8601 timestamp when the reading was captured. */
  timestamp?: string;
  /** Optional contract id this event should trigger on. */
  contractId?: string;
  /** Optional geo tag for the reading. */
  location?: { lat: number; lon: number };
  /** Opaque metadata passed through to V12. */
  metadata?: Record<string, unknown>;
}

export interface DmrvReceipt {
  eventId: string;
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING' | string;
  contractId?: string;
  txHash?: string;
  timestamp?: string;
}

export interface AuditFilter {
  contractId?: string;
  deviceId?: string;
  eventType?: DmrvEventType;
  fromTimestamp?: string;
  toTimestamp?: string;
  limit?: number;
}

export interface BatchReceipt {
  accepted: number;
  rejected: number;
  receipts: DmrvReceipt[];
  /** Errors per failed event (index aligned with submitted batch). */
  errors?: Array<{ index: number; message: string; errorCode?: string }>;
}

export interface MintReceipt {
  contractId: string;
  eventType: string;
  quantity: number;
  tokenId?: string;
  txHash?: string;
  status: string;
  timestamp?: string;
}

// ── Composite / Derived Contract Bindings ──────────────────────────────────

export interface TokenBinding {
  tokenId: string;
  contractId: string;
  tokenType: 'COMPOSITE' | 'DERIVED' | 'PRIMARY' | string;
  symbol?: string;
  balance?: string;
  mintedAt?: string;
}

export interface CompositeBinding {
  bindingId: string;
  contractId: string;
  compositeTokenId: string;
  derivedTokenId?: string;
  status: string;
  createdAt?: string;
}

export interface CompositeBindRequest {
  contractId: string;
  compositeTokenId: string;
  /** Optional binding metadata. */
  metadata?: Record<string, unknown>;
}

export interface BindingResult {
  bindingId: string;
  contractId: string;
  compositeTokenId: string;
  status: string;
  timestamp?: string;
}

export interface IssueDerivedRequest {
  contractId: string;
  compositeTokenId: string;
  quantity: number;
  /** Derived token symbol / type — depends on V12 contract config. */
  derivedSymbol?: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
}

export interface IssuanceReceipt {
  derivedTokenId: string;
  contractId: string;
  compositeTokenId: string;
  quantity: number;
  txHash?: string;
  status: string;
  timestamp?: string;
}

// ── SDK Tier Management ───────────────────────────────────────────────────

/** Tier configuration returned by GET /sdk/partner/tier. */
export interface TierConfig {
  tierLevel: number;
  tierName: string;
  limits: {
    mintMonthly: number;
    dmrvDaily: number;
    compositeMonthly: number;
    rateRpm: number;
    burst: number;
    webhooksMax: number;
  };
  allowedTokenTypes: string[];
  grpcAccess: boolean;
  kycLevelRequired: number;
}

/** Partner profile returned by GET /sdk/partner/profile. */
export interface PartnerProfile {
  profileId: string;
  appId: string;
  appName: string;
  tierLevel: number;
  tierName: string;
  kycStatus: string;
  billingPlan: string;
  onboardedAt: string;
}

/** Usage stats returned by GET /sdk/partner/usage. */
export interface UsageStats {
  today: { mintCount: number; dmrvCount: number; compositeCount: number; apiCallCount: number };
  monthly: { mintCount: number; remaining: number };
  quotaPercent: { mint: number; dmrv: number; composite: number };
}

/** Mint quota returned by GET /sdk/mint/quota. */
export interface MintQuota {
  mintMonthlyLimit: number;
  mintMonthlyUsed: number;
  mintMonthlyRemaining: number;
  dmrvDailyLimit: number;
  dmrvDailyUsed: number;
  dmrvDailyRemaining: number;
}

/** Request body for POST /sdk/mint (tier-enforced minting). */
export interface SdkMintRequest {
  typeCode: string;
  amount: number;
  useCaseId?: string;
  channelId?: string;
  toAddress?: string;
  metadata?: Record<string, unknown>;
}

/** Response from POST /sdk/mint. */
export interface SdkMintResponse {
  mintId: string;
  typeCode: string;
  tokenId: string;
  amount: number;
  status: string;
  quotaRemaining: number;
}

/** Token type descriptor returned by GET /sdk/token-types. */
export interface TokenTypeDescriptor {
  typeCode: string;
  displayName: string;
  description: string;
  tierMinLevel: number;
}

/** Webhook registration request body for POST /sdk/webhooks. */
export interface WebhookRegistration {
  url: string;
  events: string[];
  secret?: string;
}

/** Webhook info returned by GET /sdk/webhooks. */
export interface WebhookInfo {
  webhookId: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

// ── GDPR ──────────────────────────────────────────────────────────────────

export interface GdprExportPayload {
  userId: string;
  exportedAt: string;
  sections: DataSection[];
}

export interface DataSection {
  category: string;
  data: Record<string, unknown>[];
}

export interface ErasureReceipt {
  trackingId: string;
  status: string;
  requestedAt: string;
}

// ── GraphQL ───────────────────────────────────────────────────────────────

export interface GraphQLResponse<T = unknown> {
  data: T;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  path?: string[];
}

// ── Gold RWAT ─────────────────────────────────────────────────────────────

export interface GoldLedger {
  totalAssets: number;
  activeOrders: number;
  stats: GoldTradingStats;
  assets: Record<string, unknown>[];
}

export interface GoldOrder {
  orderId: string;
  type: string;
  status: string;
  amount: number;
}

export interface GoldTradingStats {
  totalVolume: number;
  activeOrders: number;
  avgPrice: number;
}

// ── Governance ────────────────────────────────────────────────────────────

export interface Proposal {
  id: string;
  title: string;
  status: string;
  votesFor: number;
  votesAgainst: number;
}

export interface VoteReceipt {
  proposalId: string;
  voterAddress: string;
  approved: boolean;
  timestamp: string;
}

export interface TreasuryStats {
  balance: number;
  proposalCount: number;
}

// ── Wallet ────────────────────────────────────────────────────────────────

export interface WalletBalance {
  address: string;
  available: number;
  staked: number;
  currency: string;
}

export interface TransferRequest {
  from: string;
  to: string;
  amount: number;
  currency: string;
}

export interface TransferReceipt {
  txHash: string;
  status: string;
  timestamp: string;
}

// ── Compliance ────────────────────────────────────────────────────────────

export interface ComplianceFramework {
  code: string;
  description: string;
  url: string;
}

export interface AssessmentResult {
  assetId: string;
  framework: string;
  status: string;
  assessedAt: string;
}

// ── Tier Upgrade ──────────────────────────────────────────────────────────

export interface UpgradeRequest {
  requestId: string;
  currentTier: string;
  targetTier: string;
  status: string;
}

// ── Offline queue ──────────────────────────────────────────────────────────

export type QueueEventKind = 'enqueue' | 'flush' | 'error' | 'drop';

export interface QueuedOperation {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  enqueuedAt: number;
  attempts: number;
}

export interface QueueOptions {
  /** Max operations kept in memory. Default 1000. */
  maxSize?: number;
  /** Auto-flush interval in ms (0 disables). Default 30_000. */
  flushIntervalMs?: number;
  /** Optional persistent storage (localStorage-like: getItem/setItem). */
  storage?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
  /** Storage key. Default 'aurigraph.offlineQueue'. */
  storageKey?: string;
}
