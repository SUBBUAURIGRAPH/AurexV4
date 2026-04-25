/**
 * Token Registry namespace — Generic V12 token registry operations.
 *
 * Wraps the V12 endpoints at /api/v11/registries/tokens that let 3rd-party
 * apps create and mint tokens on their own registry entries:
 *   - GET  /api/v11/registries/tokens             (list w/ filter + pagination)
 *   - GET  /api/v11/registries/tokens/{id}        (token detail)
 *   - POST /api/v11/registries/tokens             (create token)
 *   - POST /api/v11/registries/tokens/{id}/mint   (mint — requires mint:token scope)
 *   - GET  /api/v11/registries/tokens/{id}/holders
 *   - GET  /api/v11/registries/tokens/{id}/transfers
 *
 * Note: the V12 resource does NOT expose a `/stats` endpoint. The `stats()`
 * method here is a convenience that lists all tokens and computes aggregate
 * counts client-side (see T5). It falls back to an empty stats object on
 * transport error to match the Session #117 resilience pattern.
 */

import type {
  CreateTokenRequest,
  MintRequest,
  TokenDetail,
  TokenHolder,
  TokenListFilter,
  TokenListResponse,
  TokenMintReceipt,
  TokenRegistryStats,
  TokenTransfer,
  TransferFilter,
} from '../types.js';

export interface TokenRegistryTransport {
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  unwrapList<T>(p: Promise<unknown>, key: string): Promise<T[]>;
}

/** Empty response returned when listing fails — matches Session #117 resilience pattern. */
const EMPTY_LIST: TokenListResponse = {
  content: [],
  page: 0,
  size: 0,
  totalElements: 0,
  totalPages: 0,
};

/** Empty aggregate returned when stats() transport fails. */
const EMPTY_STATS: TokenRegistryStats = {
  totalTokens: 0,
  activeTokens: 0,
  totalSupply: '0',
  byType: {},
};

export class TokenRegistryApi {
  constructor(private readonly transport: TokenRegistryTransport) {}

  /**
   * List tokens with optional filtering + pagination. On any transport error
   * returns an empty page rather than throwing, so dashboards stay resilient.
   */
  async list(filter: TokenListFilter = {}): Promise<TokenListResponse> {
    const q: Record<string, string | number | undefined> = {
      standard: filter.standard,
      active: filter.active !== undefined ? String(filter.active) : undefined,
      page: filter.page,
      size: filter.size,
    };
    try {
      const raw = await this.transport.get<unknown>('/registries/tokens', q);
      if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.content)) {
          return {
            content: obj.content as TokenDetail[],
            page: typeof obj.page === 'number' ? obj.page : 0,
            size: typeof obj.size === 'number' ? obj.size : (obj.content as unknown[]).length,
            totalElements:
              typeof obj.totalElements === 'number'
                ? obj.totalElements
                : (obj.content as unknown[]).length,
            totalPages: typeof obj.totalPages === 'number' ? obj.totalPages : 1,
          };
        }
        if (Array.isArray(raw)) {
          const arr = raw as TokenDetail[];
          return { content: arr, page: 0, size: arr.length, totalElements: arr.length, totalPages: 1 };
        }
      }
      return { ...EMPTY_LIST };
    } catch {
      return { ...EMPTY_LIST };
    }
  }

  /** Get a single token by id. Throws AurigraphClientError on 404. */
  async get(tokenId: string): Promise<TokenDetail> {
    if (!tokenId || typeof tokenId !== 'string') {
      const err = new Error(`TokenRegistryApi.get: tokenId must be a non-empty string`);
      (err as unknown as { status: number }).status = 400;
      throw err;
    }
    return this.transport.get<TokenDetail>(
      `/registries/tokens/${encodeURIComponent(tokenId)}`,
    );
  }

  /**
   * Create a new token registry entry. Requires `registry:write` scope on the
   * API key. The V12 resource returns a creation envelope
   * ({ token, merkleRootHash, leafIndex }); this helper unwraps the `token`
   * field so callers get a consistent TokenDetail shape.
   */
  async create(req: CreateTokenRequest): Promise<TokenDetail> {
    if (!req || !req.symbol || !req.tokenType) {
      const err = new Error(
        `TokenRegistryApi.create: symbol and tokenType are required`,
      );
      (err as unknown as { status: number }).status = 400;
      throw err;
    }
    const raw = await this.transport.post<unknown>('/registries/tokens', req);
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      if (obj.token && typeof obj.token === 'object') {
        return obj.token as TokenDetail;
      }
    }
    return raw as TokenDetail;
  }

  /**
   * Mint additional supply on an existing token. Requires `mint:token` scope.
   * The Idempotency-Key header is attached automatically by AurigraphClient
   * for all POST requests (see client.ts auto-idempotency path).
   */
  async mint(tokenId: string, req: MintRequest): Promise<TokenMintReceipt> {
    if (!tokenId || typeof tokenId !== 'string') {
      const err = new Error(`TokenRegistryApi.mint: tokenId must be a non-empty string`);
      (err as unknown as { status: number }).status = 400;
      throw err;
    }
    if (!req || req.amount === undefined || req.amount === null) {
      const err = new Error(`TokenRegistryApi.mint: amount is required`);
      (err as unknown as { status: number }).status = 400;
      throw err;
    }
    // V12 MintTokenRequest expects `amount` (Long) + `recipient` (String).
    // SDK callers use { toAddress, amount, metadata } for a more intuitive
    // surface; we map it to the server-side shape here.
    const body: Record<string, unknown> = {
      amount:
        typeof req.amount === 'string'
          ? Number.parseInt(req.amount, 10)
          : req.amount,
      recipient: req.toAddress ?? req.recipient,
    };
    if (req.metadata) body.metadata = req.metadata;
    return this.transport.post<TokenMintReceipt>(
      `/registries/tokens/${encodeURIComponent(tokenId)}/mint`,
      body,
    );
  }

  /** List holders of a token. Returns empty array on transport failure. */
  async getHolders(tokenId: string): Promise<TokenHolder[]> {
    if (!tokenId) return [];
    try {
      return await this.transport.unwrapList<TokenHolder>(
        this.transport.get<unknown>(
          `/registries/tokens/${encodeURIComponent(tokenId)}/holders`,
        ),
        'content',
      );
    } catch {
      return [];
    }
  }

  /** List transfers of a token. Returns empty array on transport failure. */
  async getTransfers(
    tokenId: string,
    filter: TransferFilter = {},
  ): Promise<TokenTransfer[]> {
    if (!tokenId) return [];
    const q: Record<string, string | number | undefined> = {
      from: filter.from,
      to: filter.to,
      page: filter.page,
      size: filter.size,
    };
    try {
      return await this.transport.unwrapList<TokenTransfer>(
        this.transport.get<unknown>(
          `/registries/tokens/${encodeURIComponent(tokenId)}/transfers`,
          q,
        ),
        'content',
      );
    } catch {
      return [];
    }
  }

  /**
   * Aggregate stats for the token registry. V12 does not expose a dedicated
   * stats endpoint; this helper lists all tokens (size=100) and computes
   * counts client-side. Falls back to an empty aggregate on transport error.
   */
  async stats(): Promise<TokenRegistryStats> {
    try {
      const page = await this.list({ page: 0, size: 100 });
      const tokens = page.content ?? [];
      const byType: Record<string, number> = {};
      let totalSupply = 0n;
      let activeTokens = 0;
      for (const t of tokens) {
        const typ = (t.tokenType ?? 'UNKNOWN') as string;
        byType[typ] = (byType[typ] ?? 0) + 1;
        if ((t.status ?? '').toString().toUpperCase() === 'ACTIVE') {
          activeTokens++;
        }
        const supply = t.totalSupply;
        try {
          if (supply !== undefined && supply !== null) {
            totalSupply += BigInt(
              typeof supply === 'number' ? Math.trunc(supply) : String(supply),
            );
          }
        } catch {
          // swallow — unparseable supply, ignored
        }
      }
      return {
        totalTokens: page.totalElements ?? tokens.length,
        activeTokens,
        totalSupply: totalSupply.toString(),
        byType,
      };
    } catch {
      return { ...EMPTY_STATS, byType: {} };
    }
  }
}
