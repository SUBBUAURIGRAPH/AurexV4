/**
 * Aurigraph DLT SDK — Main Client
 *
 * Unified SDK for 3rd-party apps to integrate with the Aurigraph DLT V12 platform
 * (V11 API). Zero runtime dependencies beyond fetch.
 *
 * @example Basic usage
 * ```ts
 * import { AurigraphClient } from '@aurigraph/dlt-sdk';
 *
 * const client = new AurigraphClient({
 *   baseUrl: 'https://dlt.aurigraph.io',
 *   apiKey: process.env.AURIGRAPH_API_KEY,
 * });
 *
 * const health = await client.health.get();
 * const stats  = await client.stats.get();
 * ```
 */

import {
  AurigraphClientConfig,
  HealthResponse,
  PlatformStats,
  NodeInfo,
  NodeList,
  NodeRegisterRequest,
  NodeMetrics,
  BattuaToken,
  BattuaNodeRegistration,
  BattuaMintRequest,
  BattuaNodeStats,
  ProvenewsContract,
  ProvenewsContractCreateRequest,
  ProvenewsRevenueEvent,
  ProvenewsRevenueRequest,
  ProvenewsAsset,
  ProvenewsAssetRegisterRequest,
  ProvenewsMerkleProof,
  ProvenewsCheckpoint,
  ProvenewsOrg,
  ProvenewsCompositeToken,
  ProvenewsCompositeAssembleRequest,
  ProvenewsTokenVerification,
  ProvenewsDevice,
  ProvenewsDeviceRegisterRequest,
  ProvenewsTokenizationNode,
  ProvenewsAssignValidatorsRequest,
  ProvenewsTokenizationStatus,
  UseCase,
  Channel,
  ChannelCreateRequest,
  Transaction,
  TransactionList,
  TransactionSubmitRequest,
  TransactionReceipt,
  QueueOptions,
  QueuedOperation,
  HelloResponse,
  HeartbeatResponse,
  CapabilitiesResponse,
  ConfigResponse,
  TierConfig,
  PartnerProfile,
  UsageStats,
  MintQuota,
  SdkMintRequest,
  SdkMintResponse,
  TokenTypeDescriptor,
  WebhookRegistration,
  WebhookInfo,
  GdprExportPayload,
  ErasureReceipt,
  GraphQLResponse,
  GoldLedger,
  GoldOrder,
  GoldTradingStats,
  Proposal,
  VoteReceipt,
  TreasuryStats,
  WalletBalance,
  TransferRequest,
  TransferReceipt,
  ComplianceFramework,
  AssessmentResult,
  UpgradeRequest,
} from './types.js';
import {
  AurigraphClientError,
  AurigraphConfigError,
  AurigraphNetworkError,
  AurigraphServerError,
  ProblemDetails,
} from './errors.js';
import { DmrvApi } from './namespaces/dmrv.js';
import { ContractsApi } from './namespaces/contracts.js';
import { TokenRegistryApi } from './namespaces/tokenRegistry.js';
import { GdprApi } from './namespaces/gdpr.js';
import { GraphQLApi } from './namespaces/graphql.js';
import { TierApi } from './namespaces/tier.js';
import { AssetsApi } from './namespaces/assets.js';
import { GovernanceApi } from './namespaces/governance.js';
import { WalletApi } from './namespaces/wallet.js';
import { ComplianceApi } from './namespaces/compliance.js';
import { OfflineQueue } from './queue.js';
import { generateKeySync } from './idempotency.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const API_PREFIX = '/api/v11';

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Internal — skip auto-enqueue when this call is itself a queue flush. */
  _skipQueue?: boolean;
  /** Internal — caller-supplied idempotency key (overrides auto-gen). */
  _idempotencyKey?: string;
}

/**
 * Main Aurigraph DLT client. Use namespaces (client.health, client.nodes, ...)
 * to access the V11 API surface.
 */
export class AurigraphClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly appId?: string;
  private readonly jwtToken?: string;
  private readonly clientVersion?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly debug: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly enableQueue: boolean;
  private readonly autoIdempotency: boolean;
  private readonly _queue?: OfflineQueue;
  /** One-time deprecation-warning flag for legacy `apiKey`-only (no `appId`) usage. */
  private _legacyApiKeyWarned = false;
  /** Cached HelloResponse from the most recent successful handshake. */
  private _helloCache?: HelloResponse;
  /** Timer handle for auto-heartbeat (cleared by {@link dispose}). */
  private _heartbeatTimer?: ReturnType<typeof setInterval>;

  public readonly dmrv: DmrvApi;
  public readonly contracts: ContractsApi;
  public readonly gdpr: GdprApi;
  public readonly graphql: GraphQLApi;
  public readonly tier: TierApi;
  /** Asset-agnostic RWA operations — works with any asset type. */
  public readonly assets: AssetsApi;
  public readonly governance: GovernanceApi;
  public readonly wallet: WalletApi;
  public readonly compliance: ComplianceApi;

  // ── Namespaces ────────────────────────────────────────────────────────────

  /**
   * SDK Handshake Protocol — bootstrap / heartbeat / capabilities / config.
   *
   * Use these to announce this client to the server, discover its approved
   * scopes + rate limits, and keep the app session alive with periodic pings.
   * See {@link AurigraphClientConfig#autoHandshake} and
   * {@link AurigraphClientConfig#autoHeartbeat} for automatic wiring.
   */
  public readonly sdk = {
    /** Bootstrap call — returns full server metadata + app permissions. */
    hello: (): Promise<HelloResponse> =>
      this.request<HelloResponse>({ method: 'GET', path: '/sdk/handshake/hello' }),

    /** Liveness ping — call every 5 minutes (or let autoHeartbeat do it). */
    heartbeat: (clientVersion?: string): Promise<HeartbeatResponse> =>
      this.request<HeartbeatResponse>({
        method: 'POST',
        path: '/sdk/handshake/heartbeat',
        body: { clientVersion, timestamp: new Date().toISOString() },
      }),

    /** Endpoint listing filtered by this app's approved scopes. */
    capabilities: (): Promise<CapabilitiesResponse> =>
      this.request<CapabilitiesResponse>({
        method: 'GET',
        path: '/sdk/handshake/capabilities',
      }),

    /** Lightweight refresh — detects scope/status changes without full hello. */
    config: (): Promise<ConfigResponse> =>
      this.request<ConfigResponse>({ method: 'GET', path: '/sdk/handshake/config' }),

    // ── Tier Management ────────────────────────────────────────────────────

    /** Get partner profile + tier details. */
    profile: (): Promise<PartnerProfile> =>
      this.request<PartnerProfile>({ method: 'GET', path: '/sdk/partner/profile' }),

    /** Get current tier config + limits. */
    tier: (): Promise<TierConfig> =>
      this.request<TierConfig>({ method: 'GET', path: '/sdk/partner/tier' }),

    /** Get current period usage stats. */
    usage: (): Promise<UsageStats> =>
      this.request<UsageStats>({ method: 'GET', path: '/sdk/partner/usage' }),

    /** Get remaining quota for mint/DMRV/composite. */
    mintQuota: (): Promise<MintQuota> =>
      this.request<MintQuota>({ method: 'GET', path: '/sdk/mint/quota' }),

    /** List token types available at current tier. */
    tokenTypes: async (): Promise<TokenTypeDescriptor[]> => {
      const raw = await this.request<{ tokenTypes: TokenTypeDescriptor[] }>({
        method: 'GET',
        path: '/sdk/token-types',
      });
      return raw.tokenTypes ?? [];
    },

    /** Mint a token with tier enforcement. Defaults useCaseId to UC_BATTUA on server. */
    mint: (req: SdkMintRequest): Promise<SdkMintResponse> =>
      this.request<SdkMintResponse>({ method: 'POST', path: '/sdk/mint', body: req }),

    /** Mint with pre-flight quota check. Throws early if quota would be exceeded. */
    mintSafe: async (req: SdkMintRequest): Promise<SdkMintResponse> => {
      const quota = await this.request<MintQuota>({ method: 'GET', path: '/sdk/mint/quota' });
      if (quota.mintMonthlyLimit !== -1 && quota.mintMonthlyRemaining < req.amount) {
        throw new AurigraphClientError(
          `Mint quota insufficient: ${quota.mintMonthlyRemaining} remaining, ${req.amount} requested`,
          429,
          {
            type: 'about:blank',
            title: 'Quota Exceeded',
            status: 429,
            errorCode: 'SDK_QUOTA_PREFLIGHT',
            detail: `Mint quota insufficient: ${quota.mintMonthlyRemaining} remaining, ${req.amount} requested`,
          },
        );
      }
      return this.request<SdkMintResponse>({ method: 'POST', path: '/sdk/mint', body: req });
    },

    /** Record a DMRV event with daily quota enforcement. */
    recordDmrv: (event: {
      deviceId: string;
      eventType: string;
      quantity: number;
      unit: string;
      timestamp?: string;
      metadata?: Record<string, unknown>;
    }): Promise<{ recorded: boolean; dmrvDailyRemaining: number }> =>
      this.request<{ recorded: boolean; dmrvDailyRemaining: number }>({
        method: 'POST',
        path: '/sdk/dmrv/record',
        body: event,
      }),

    /** List webhooks. */
    webhooks: async (): Promise<WebhookInfo[]> => {
      const raw = await this.request<{ webhooks: WebhookInfo[] }>({
        method: 'GET',
        path: '/sdk/webhooks',
      });
      return raw.webhooks ?? [];
    },

    /** Register a webhook. */
    registerWebhook: (reg: WebhookRegistration): Promise<{ webhookId: string }> =>
      this.request<{ webhookId: string }>({ method: 'POST', path: '/sdk/webhooks', body: reg }),

    /** Delete a webhook. */
    deleteWebhook: async (webhookId: string): Promise<void> => {
      await this.request<void>({
        method: 'DELETE',
        path: `/sdk/webhooks/${encodeURIComponent(webhookId)}`,
      });
    },
  };

  public readonly health = {
    get: (): Promise<HealthResponse> =>
      this.request<HealthResponse>({ method: 'GET', path: '/health' }),
  };

  public readonly stats = {
    get: (): Promise<PlatformStats> =>
      this.request<PlatformStats>({ method: 'GET', path: '/stats' }),
  };

  public readonly nodes = {
    list: (page = 0, pageSize = 50): Promise<NodeList> =>
      this.request<NodeList>({
        method: 'GET',
        path: '/nodes',
        query: { page, pageSize },
      }),
    get: (nodeId: string): Promise<NodeInfo> =>
      this.request<NodeInfo>({ method: 'GET', path: `/nodes/${encodeURIComponent(nodeId)}` }),
    register: (req: NodeRegisterRequest): Promise<NodeInfo> =>
      this.request<NodeInfo>({ method: 'POST', path: '/nodes', body: req }),
    getMetrics: (): Promise<NodeMetrics> =>
      this.request<NodeMetrics>({ method: 'GET', path: '/nodes/metrics' }),
  };

  public readonly registries: {
    battua: {
      tokens: () => Promise<BattuaToken[]>;
      getToken: (tokenId: string) => Promise<BattuaToken>;
      getTokenByTxHash: (txHash: string) => Promise<BattuaToken>;
      mint: (req: BattuaMintRequest) => Promise<BattuaToken>;
      nodes: () => Promise<BattuaNodeRegistration[]>;
      getNode: (nodeId: string) => Promise<BattuaNodeRegistration>;
      registerNodeHeartbeat: (req: BattuaNodeRegistration) => Promise<BattuaNodeRegistration>;
      nodeStats: () => Promise<BattuaNodeStats>;
      stats: () => Promise<Record<string, unknown>>;
    };
    provenews: {
      contracts: () => Promise<ProvenewsContract[]>;
      createContract: (req: ProvenewsContractCreateRequest) => Promise<ProvenewsContract>;
      getContract: (contractId: string) => Promise<ProvenewsContract>;
      getContractByToken: (tokenId: string) => Promise<ProvenewsContract>;
      getContractsByOwner: (ownerId: string) => Promise<ProvenewsContract[]>;
      recordRevenue: (contractId: string, req: ProvenewsRevenueRequest) => Promise<ProvenewsRevenueEvent>;
      listRevenue: (contractId: string) => Promise<ProvenewsRevenueEvent[]>;
      suspendContract: (contractId: string) => Promise<ProvenewsContract>;
      terminateContract: (contractId: string) => Promise<ProvenewsContract>;
      assets: () => Promise<ProvenewsAsset[]>;
      registerAsset: (req: ProvenewsAssetRegisterRequest) => Promise<ProvenewsAsset>;
      getAsset: (assetId: string) => Promise<ProvenewsAsset>;
      getAssetProof: (assetId: string) => Promise<ProvenewsMerkleProof>;
      checkpoints: () => Promise<ProvenewsCheckpoint[]>;
      getCheckpoint: (type: string) => Promise<ProvenewsCheckpoint>;
      org: () => Promise<ProvenewsOrg>;
      tokens: {
        assembleComposite: (req: ProvenewsCompositeAssembleRequest) => Promise<ProvenewsCompositeToken>;
        getToken: (tokenId: string) => Promise<ProvenewsCompositeToken>;
        verifyToken: (tokenId: string) => Promise<ProvenewsTokenVerification>;
        listByOwner: (ownerId: string) => Promise<ProvenewsCompositeToken[]>;
      };
      devices: {
        register: (req: ProvenewsDeviceRegisterRequest) => Promise<ProvenewsDevice>;
        listByUser: (userId: string) => Promise<ProvenewsDevice[]>;
        get: (deviceId: string) => Promise<ProvenewsDevice>;
      };
      tokenization: {
        nodes: () => Promise<ProvenewsTokenizationNode[]>;
        assignValidators: (assetId: string, req: ProvenewsAssignValidatorsRequest) => Promise<Record<string, unknown>>;
        status: () => Promise<ProvenewsTokenizationStatus>;
      };
    };
    /** Generic token registry — list/get/create/mint tokens on /api/v11/registries/tokens. */
    tokens: TokenRegistryApi;
  } = {
    battua: {
      tokens: (): Promise<BattuaToken[]> =>
        this.unwrapList<BattuaToken>(
          this.request<unknown>({ method: 'GET', path: '/registries/battua' }),
          'tokens',
        ),
      getToken: (tokenId: string): Promise<BattuaToken> =>
        this.request<BattuaToken>({
          method: 'GET',
          path: `/registries/battua/${encodeURIComponent(tokenId)}`,
        }),
      getTokenByTxHash: (txHash: string): Promise<BattuaToken> =>
        this.request<BattuaToken>({
          method: 'GET',
          path: `/registries/battua/tx/${encodeURIComponent(txHash)}`,
        }),
      mint: (req: BattuaMintRequest): Promise<BattuaToken> =>
        this.request<BattuaToken>({
          method: 'POST',
          path: '/registries/battua/mint',
          body: req,
        }),
      nodes: (): Promise<BattuaNodeRegistration[]> =>
        this.unwrapList<BattuaNodeRegistration>(
          this.request<unknown>({ method: 'GET', path: '/registries/battua-nodes' }),
          'nodes',
        ),
      getNode: (nodeId: string): Promise<BattuaNodeRegistration> =>
        this.request<BattuaNodeRegistration>({
          method: 'GET',
          path: `/registries/battua-nodes/${encodeURIComponent(nodeId)}`,
        }),
      registerNodeHeartbeat: (req: BattuaNodeRegistration): Promise<BattuaNodeRegistration> =>
        this.request<BattuaNodeRegistration>({
          method: 'POST',
          path: '/registries/battua-nodes/register',
          body: req,
        }),
      nodeStats: (): Promise<BattuaNodeStats> =>
        this.request<BattuaNodeStats>({
          method: 'GET',
          path: '/registries/battua-nodes/stats',
        }),
      stats: (): Promise<Record<string, unknown>> =>
        this.request<Record<string, unknown>>({
          method: 'GET',
          path: '/registries/battua',
        }),
    },
    provenews: {
      contracts: (): Promise<ProvenewsContract[]> =>
        this.unwrapList<ProvenewsContract>(
          this.request<unknown>({ method: 'GET', path: '/provenews/contracts' }),
          'contracts',
        ),
      createContract: (req: ProvenewsContractCreateRequest): Promise<ProvenewsContract> =>
        this.request<ProvenewsContract>({
          method: 'POST',
          path: '/provenews/contracts',
          body: req,
        }),
      getContract: (contractId: string): Promise<ProvenewsContract> =>
        this.request<ProvenewsContract>({
          method: 'GET',
          path: `/provenews/contracts/${encodeURIComponent(contractId)}`,
        }),
      getContractByToken: (tokenId: string): Promise<ProvenewsContract> =>
        this.request<ProvenewsContract>({
          method: 'GET',
          path: `/provenews/contracts/token/${encodeURIComponent(tokenId)}`,
        }),
      getContractsByOwner: (ownerId: string): Promise<ProvenewsContract[]> =>
        this.unwrapList<ProvenewsContract>(
          this.request<unknown>({
            method: 'GET',
            path: `/provenews/contracts/owner/${encodeURIComponent(ownerId)}`,
          }),
          'contracts',
        ),
      recordRevenue: (contractId: string, req: ProvenewsRevenueRequest): Promise<ProvenewsRevenueEvent> =>
        this.request<ProvenewsRevenueEvent>({
          method: 'POST',
          path: `/provenews/contracts/${encodeURIComponent(contractId)}/revenue`,
          body: req,
        }),
      listRevenue: (contractId: string): Promise<ProvenewsRevenueEvent[]> =>
        this.unwrapList<ProvenewsRevenueEvent>(
          this.request<unknown>({
            method: 'GET',
            path: `/provenews/contracts/${encodeURIComponent(contractId)}/revenue`,
          }),
          'events',
        ),
      suspendContract: (contractId: string): Promise<ProvenewsContract> =>
        this.request<ProvenewsContract>({
          method: 'PUT',
          path: `/provenews/contracts/${encodeURIComponent(contractId)}/suspend`,
        }),
      terminateContract: (contractId: string): Promise<ProvenewsContract> =>
        this.request<ProvenewsContract>({
          method: 'PUT',
          path: `/provenews/contracts/${encodeURIComponent(contractId)}/terminate`,
        }),
      assets: (): Promise<ProvenewsAsset[]> =>
        this.unwrapList<ProvenewsAsset>(
          this.request<unknown>({ method: 'GET', path: '/provenews/ledger/assets' }),
          'assets',
        ),
      registerAsset: (req: ProvenewsAssetRegisterRequest): Promise<ProvenewsAsset> =>
        this.request<ProvenewsAsset>({
          method: 'POST',
          path: '/provenews/ledger/assets',
          body: req,
        }),
      getAsset: (assetId: string): Promise<ProvenewsAsset> =>
        this.request<ProvenewsAsset>({
          method: 'GET',
          path: `/provenews/ledger/assets/${encodeURIComponent(assetId)}`,
        }),
      getAssetProof: (assetId: string): Promise<ProvenewsMerkleProof> =>
        this.request<ProvenewsMerkleProof>({
          method: 'GET',
          path: `/provenews/ledger/assets/${encodeURIComponent(assetId)}/proof`,
        }),
      checkpoints: (): Promise<ProvenewsCheckpoint[]> =>
        this.unwrapList<ProvenewsCheckpoint>(
          this.request<unknown>({ method: 'GET', path: '/provenews/ledger/checkpoints' }),
          'checkpoints',
        ),
      getCheckpoint: (type: string): Promise<ProvenewsCheckpoint> =>
        this.request<ProvenewsCheckpoint>({
          method: 'GET',
          path: `/provenews/ledger/checkpoints/${encodeURIComponent(type)}`,
        }),
      org: (): Promise<ProvenewsOrg> =>
        this.request<ProvenewsOrg>({
          method: 'GET',
          path: '/provenews/ledger/org',
        }),
      tokens: {
        assembleComposite: (req: ProvenewsCompositeAssembleRequest): Promise<ProvenewsCompositeToken> =>
          this.request<ProvenewsCompositeToken>({
            method: 'POST',
            path: '/provenews/tokens/composite',
            body: req,
          }),
        getToken: (tokenId: string): Promise<ProvenewsCompositeToken> =>
          this.request<ProvenewsCompositeToken>({
            method: 'GET',
            path: `/provenews/tokens/${encodeURIComponent(tokenId)}`,
          }),
        verifyToken: (tokenId: string): Promise<ProvenewsTokenVerification> =>
          this.request<ProvenewsTokenVerification>({
            method: 'GET',
            path: `/provenews/tokens/${encodeURIComponent(tokenId)}/verify`,
          }),
        listByOwner: (ownerId: string): Promise<ProvenewsCompositeToken[]> =>
          this.unwrapList<ProvenewsCompositeToken>(
            this.request<unknown>({
              method: 'GET',
              path: `/provenews/tokens/user/${encodeURIComponent(ownerId)}`,
            }),
            'tokens',
          ),
      },
      devices: {
        register: (req: ProvenewsDeviceRegisterRequest): Promise<ProvenewsDevice> =>
          this.request<ProvenewsDevice>({
            method: 'POST',
            path: '/provenews/devices/register',
            body: req,
          }),
        listByUser: (userId: string): Promise<ProvenewsDevice[]> =>
          this.unwrapList<ProvenewsDevice>(
            this.request<unknown>({
              method: 'GET',
              path: `/provenews/devices/user/${encodeURIComponent(userId)}`,
            }),
            'devices',
          ),
        get: (deviceId: string): Promise<ProvenewsDevice> =>
          this.request<ProvenewsDevice>({
            method: 'GET',
            path: `/provenews/devices/${encodeURIComponent(deviceId)}`,
          }),
      },
      tokenization: {
        nodes: (): Promise<ProvenewsTokenizationNode[]> =>
          this.unwrapList<ProvenewsTokenizationNode>(
            this.request<unknown>({ method: 'GET', path: '/provenews/tokenization/nodes' }),
            'nodes',
          ),
        assignValidators: (assetId: string, req: ProvenewsAssignValidatorsRequest): Promise<Record<string, unknown>> =>
          this.request<Record<string, unknown>>({
            method: 'POST',
            path: `/provenews/tokenization/assets/${encodeURIComponent(assetId)}`,
            body: req,
          }),
        status: (): Promise<ProvenewsTokenizationStatus> =>
          this.request<ProvenewsTokenizationStatus>({
            method: 'GET',
            path: '/provenews/tokenization/status',
          }),
      },
    },
    // Assigned in constructor (needs the bound transport shim).
    tokens: undefined as unknown as TokenRegistryApi,
  };

  public readonly useCases = {
    list: (): Promise<UseCase[]> =>
      this.unwrapList<UseCase>(
        this.request<unknown>({ method: 'GET', path: '/use-cases' }),
        'useCases',
      ),
    get: (id: string): Promise<UseCase> =>
      this.request<UseCase>({ method: 'GET', path: `/use-cases/${encodeURIComponent(id)}` }),
  };

  public readonly channels = {
    list: (): Promise<Channel[]> =>
      this.unwrapList<Channel>(
        this.request<unknown>({ method: 'GET', path: '/channels' }),
        'channels',
      ),
    get: (id: string): Promise<Channel> =>
      this.request<Channel>({ method: 'GET', path: `/channels/${encodeURIComponent(id)}` }),
    create: (req: ChannelCreateRequest): Promise<Channel> =>
      this.request<Channel>({ method: 'POST', path: '/channels', body: req }),
  };

  public readonly transactions = {
    recent: (limit = 20): Promise<Transaction[]> =>
      this.unwrapList<Transaction>(
        this.request<unknown>({
          method: 'GET',
          path: '/transactions/recent',
          query: { limit },
        }),
        'transactions',
      ),
    submit: (tx: TransactionSubmitRequest): Promise<TransactionReceipt> =>
      this.request<TransactionReceipt>({ method: 'POST', path: '/transactions', body: tx }),
    get: (txHash: string): Promise<Transaction> =>
      this.request<Transaction>({
        method: 'GET',
        path: `/transactions/${encodeURIComponent(txHash)}`,
      }),
    list: (limit = 50): Promise<TransactionList> =>
      this.request<TransactionList>({
        method: 'GET',
        path: '/transactions',
        query: { limit },
      }),
  };

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor(config: AurigraphClientConfig) {
    if (!config || !config.baseUrl) {
      throw new AurigraphConfigError('AurigraphClient: baseUrl is required');
    }
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.appId = config.appId;
    this.jwtToken = config.jwtToken;
    this.clientVersion = config.clientVersion;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.debug = config.debug ?? false;

    const providedFetch = config.fetchImpl;
    const globalFetch =
      typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function'
        ? globalThis.fetch.bind(globalThis)
        : undefined;
    const resolvedFetch = providedFetch ?? globalFetch;
    if (!resolvedFetch) {
      throw new AurigraphConfigError(
        'AurigraphClient: no fetch impl available. Pass fetchImpl or use Node 18+.',
      );
    }
    this.fetchImpl = resolvedFetch;

    this.enableQueue = config.enableQueue ?? false;
    this.autoIdempotency = config.autoIdempotency ?? this.enableQueue;
    if (this.enableQueue) {
      this._queue = new OfflineQueue(config.queueOptions);
      this._queue.setFlushHandler(async (op: QueuedOperation) => {
        // Replay without re-queuing on failure (flush() will retry next cycle).
        await this.request<unknown>({
          method: op.method,
          path: op.path,
          body: op.body,
          _skipQueue: true,
          _idempotencyKey: op.idempotencyKey,
        } as RequestOptions);
      });
    }

    // Wire namespaces with a transport shim bound to this client.
    const transport = {
      get: <T>(path: string, query?: Record<string, string | number | undefined>) =>
        this.request<T>({ method: 'GET', path, query }),
      post: <T>(path: string, body: unknown) =>
        this.request<T>({ method: 'POST', path, body }),
      unwrapList: <T>(p: Promise<unknown>, key: string) => this.unwrapList<T>(p, key),
    };
    this.dmrv = new DmrvApi(transport);
    this.contracts = new ContractsApi(transport);
    this.gdpr = new GdprApi({
      ...transport,
      delete: <T>(path: string) =>
        this.request<T>({ method: 'DELETE', path }),
    });
    this.graphql = new GraphQLApi(transport);
    this.tier = new TierApi(transport);
    this.assets = new AssetsApi(transport);
    this.governance = new GovernanceApi(transport);
    this.wallet = new WalletApi(transport);
    this.compliance = new ComplianceApi(transport);
    // Generic token registry — wired after transport is bound.
    this.registries.tokens = new TokenRegistryApi(transport);

    // ── Auto-handshake (best-effort, fire-and-forget) ──────────────────────
    const hasAnyAuth =
      !!config.jwtToken || (!!config.appId && !!config.apiKey);
    if (config.autoHandshake && hasAnyAuth) {
      this.sdk
        .hello()
        .then((hello) => {
          this._helloCache = hello;
          try {
            config.onHandshake?.(hello);
          } catch (cbErr) {
            this.log(
              `onHandshake callback threw: ${
                cbErr instanceof Error ? cbErr.message : String(cbErr)
              }`,
            );
          }
          this.log(`handshake OK — appId=${hello.appId} scopes=${hello.approvedScopes.length}`);
        })
        .catch((err) => {
          this.log(
            `handshake failed (best-effort, swallowed): ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
    }

    // ── Auto-heartbeat (5-minute interval) ─────────────────────────────────
    if (config.autoHeartbeat && config.appId && config.apiKey) {
      this._heartbeatTimer = setInterval(
        () => {
          this.sdk.heartbeat(this.clientVersion).catch((err) => {
            this.log(
              `heartbeat failed (will retry next cycle): ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          });
        },
        5 * 60 * 1000,
      );
      // Don't block Node.js process exit on this timer.
      // `unref` is Node-only; guard for browser environments.
      const timer = this._heartbeatTimer as unknown as { unref?: () => void };
      if (typeof timer.unref === 'function') {
        timer.unref();
      }
    }
  }

  /** Access the offline queue (undefined if enableQueue was false). */
  public queue(): OfflineQueue | undefined {
    return this._queue;
  }

  // ── Core request ──────────────────────────────────────────────────────────

  private async request<T>(opts: RequestOptions): Promise<T> {
    const url = this.buildUrl(opts.path, opts.query);
    const headers = this.buildHeaders(opts.body !== undefined);

    // Auto-attach idempotency key on mutating requests.
    const isMutating = opts.method !== 'GET';
    let idempotencyKey: string | undefined = opts._idempotencyKey;
    if (isMutating && this.autoIdempotency && !idempotencyKey) {
      idempotencyKey = generateKeySync({
        method: opts.method,
        path: opts.path,
        body: opts.body ?? null,
      });
    }
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    let lastError: unknown;
    try {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        this.log(`→ [attempt ${attempt}/${this.maxRetries}] ${opts.method} ${url}`);
        const res = await this.fetchImpl(url, {
          method: opts.method,
          headers,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timeoutHandle);
        this.log(`← ${res.status} ${opts.method} ${url}`);

        if (res.status >= 200 && res.status < 300) {
          if (res.status === 204) {
            return undefined as T;
          }
          const text = await res.text();
          if (!text) return undefined as T;
          try {
            return JSON.parse(text) as T;
          } catch {
            return text as unknown as T;
          }
        }

        // Error: parse RFC 7807 problem+json
        const problem = await this.parseProblem(res);
        const msg = `${opts.method} ${opts.path} failed: ${res.status} ${problem?.title ?? res.statusText}`;

        if (res.status >= 400 && res.status < 500) {
          // 4xx — don't retry
          throw new AurigraphClientError(msg, res.status, problem, url);
        }

        // 5xx — retry
        lastError = new AurigraphServerError(msg, res.status, problem, url);
        if (attempt < this.maxRetries) {
          await this.backoff(attempt);
          continue;
        }
        throw lastError;
      } catch (err) {
        clearTimeout(timeoutHandle);
        if (err instanceof AurigraphClientError) {
          throw err; // 4xx — never retry
        }
        if (err instanceof AurigraphServerError) {
          lastError = err;
          if (attempt < this.maxRetries) {
            await this.backoff(attempt);
            continue;
          }
          throw err;
        }
        // Network error, abort, etc.
        const netMsg =
          err instanceof Error ? err.message : `Unknown network error: ${String(err)}`;
        lastError = new AurigraphNetworkError(
          `${opts.method} ${opts.path} network error: ${netMsg}`,
          url,
        );
        if (attempt < this.maxRetries) {
          this.log(`  network error, retrying: ${netMsg}`);
          await this.backoff(attempt);
          continue;
        }
        throw lastError;
      }
    }
    // All retries exhausted with no explicit throw — should be unreachable.
    throw lastError ?? new AurigraphNetworkError('request failed with no error', url);
    } catch (finalErr) {
      // 4xx client errors are permanent — never enqueue.
      if (!(finalErr instanceof AurigraphClientError)) {
        this.maybeEnqueue(opts, idempotencyKey);
      }
      throw finalErr;
    }
  }

  private maybeEnqueue(opts: RequestOptions, idempotencyKey?: string): void {
    if (!this._queue) return;
    if (opts._skipQueue) return;
    if (opts.method === 'GET') return;
    this._queue.enqueue({
      method: opts.method as 'POST' | 'PUT' | 'DELETE',
      path: opts.path,
      body: opts.body,
      idempotencyKey,
    });
  }

  /**
   * Build request headers with auth.
   *
   * Auth precedence (first match wins):
   *   1. `jwtToken`                     → `Authorization: Bearer <jwt>`
   *   2. `appId` + `apiKey` (production) → `Authorization: ApiKey <appId>:<apiKey>`
   *   3. `apiKey` alone (legacy)        → `X-API-Key: <apiKey>` + one-time deprecation warning
   */
  private buildHeaders(hasBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.jwtToken) {
      headers['Authorization'] = `Bearer ${this.jwtToken}`;
    } else if (this.appId && this.apiKey) {
      headers['Authorization'] = `ApiKey ${this.appId}:${this.apiKey}`;
    } else if (this.apiKey) {
      if (!this._legacyApiKeyWarned) {
        // eslint-disable-next-line no-console
        console.warn(
          '[aurigraph-sdk] Deprecated: apiKey without appId uses legacy X-API-Key ' +
            'header. Production 3rd-party auth requires { appId, apiKey } which is ' +
            'sent as "Authorization: ApiKey <appId>:<apiKey>" — see handshake docs ' +
            '(README.md → Handshake Protocol).',
        );
        this._legacyApiKeyWarned = true;
      }
      headers['X-API-Key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Stop the auto-heartbeat interval (if any). Call this on app shutdown to
   * allow the process to exit cleanly and to release the timer handle.
   */
  public dispose(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = undefined;
    }
  }

  /** Returns the cached HelloResponse from the most recent handshake, if any. */
  public getHelloCache(): HelloResponse | undefined {
    return this._helloCache;
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    let url = `${this.baseUrl}${API_PREFIX}${normalizedPath}`;
    if (query) {
      const params: string[] = [];
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) {
          params.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
        }
      }
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
    }
    return url;
  }

  private async parseProblem(res: Response): Promise<ProblemDetails | undefined> {
    try {
      const text = await res.text();
      if (!text) return undefined;
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        return parsed as ProblemDetails;
      }
    } catch {
      // swallow — non-JSON error body
    }
    return undefined;
  }

  private async backoff(attempt: number): Promise<void> {
    // Exponential with jitter: 200ms, 400ms, 800ms (+ up to 100ms jitter)
    const base = 200 * Math.pow(2, attempt - 1);
    const jitter = Math.floor(Math.random() * 100);
    const delay = base + jitter;
    this.log(`  backing off ${delay}ms before retry`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private log(msg: string): void {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.debug(`[aurigraph-sdk] ${msg}`);
    }
  }

  /**
   * Some V12 endpoints return `{ items: [...] }` or `{ <key>: [...] }` envelopes.
   * This helper unwraps array responses whether they are bare arrays or keyed.
   */
  private async unwrapList<T>(p: Promise<unknown>, key: string): Promise<T[]> {
    const data = await p;
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const candidate = obj[key] ?? obj['items'] ?? obj['content'] ?? obj['data'];
      if (Array.isArray(candidate)) return candidate as T[];
    }
    return [];
  }
}
