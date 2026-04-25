/**
 * Assets namespace — Asset-agnostic RWA and use-case operations.
 *
 * Works with ANY asset type (Gold, Carbon, Real Estate, IP, etc.).
 * Asset-specific behavior is driven by the `useCaseId` field,
 * not by separate API classes.
 *
 * @example
 * ```ts
 * // List all assets (any type)
 * const assets = await client.assets.list();
 *
 * // Filter by use case
 * const goldAssets = await client.assets.listByUseCase('UC_GOLD');
 *
 * // Filter by channel
 * const channelAssets = await client.assets.listByChannel('ch-a5e40888');
 *
 * // Get public ledger for a use case
 * const ledger = await client.assets.getPublicLedger('UC_GOLD');
 * ```
 */

import type { UseCase } from '../types.js';

export interface AssetsTransport {
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
  unwrapList<T>(p: Promise<unknown>, key: string): Promise<T[]>;
}

export class AssetsApi {
  constructor(private readonly transport: AssetsTransport) {}

  // ── Use Cases ─────────────────────────────────────────────────────────────

  /** List all registered use cases (UC_GOLD, UC_CARBON, UC_REAL_ESTATE, etc.) */
  async listUseCases(): Promise<UseCase[]> {
    return this.transport.unwrapList<UseCase>(
      this.transport.get<unknown>('/use-cases'),
      'useCases',
    );
  }

  /** Get a specific use case by ID. */
  async getUseCase(useCaseId: string): Promise<UseCase> {
    return this.transport.get<UseCase>(`/use-cases/${useCaseId}`);
  }

  // ── Assets (generic, asset-agnostic query) ───────────────────────────────

  /** Query assets with optional filters. Returns paginated results. */
  async query(params?: {
    useCase?: string;
    type?: string;
    status?: string;
    channelId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Record<string, unknown>> {
    const q: Record<string, string | number | undefined> = {
      limit: params?.limit ?? 100,
      offset: params?.offset ?? 0,
      useCase: params?.useCase,
      type: params?.type,
      status: params?.status,
      channelId: params?.channelId,
    };
    return this.transport.get<Record<string, unknown>>('/rwa/query', q);
  }

  /** List all RWA assets across all use cases. */
  async list(): Promise<Record<string, unknown>> {
    return this.query();
  }

  /** Get a single asset by ID (any asset type). */
  async get(assetId: string): Promise<Record<string, unknown>> {
    return this.transport.get<Record<string, unknown>>(`/rwa/assets/${assetId}`);
  }

  /** List assets filtered by use case (e.g., "UC_GOLD", "UC_CARBON"). */
  async listByUseCase(useCaseId: string): Promise<Record<string, unknown>> {
    return this.query({ useCase: useCaseId });
  }

  /** List assets filtered by channel ID. */
  async listByChannel(channelId: string): Promise<Record<string, unknown>> {
    return this.query({ channelId });
  }

  /** List assets filtered by asset type (e.g., "COMMODITY", "REAL_ESTATE"). */
  async listByType(type: string): Promise<Record<string, unknown>> {
    return this.query({ type });
  }

  /** Get use case summary with asset counts per use case. */
  async useCaseSummary(): Promise<Record<string, unknown>> {
    return this.transport.get<Record<string, unknown>>('/rwa/query/use-cases');
  }

  /** Get type summary with asset counts per type. */
  async typeSummary(): Promise<Record<string, unknown>> {
    return this.transport.get<Record<string, unknown>>('/rwa/query/types');
  }

  // ── Public Ledger (per use case) ──────────────────────────────────────────

  /** Get public ledger for a specific use case (asset-agnostic). */
  async getPublicLedger(useCaseId: string): Promise<Record<string, unknown>> {
    const path = useCaseId === 'UC_GOLD'
      ? '/rwa/gold/public/ledger'
      : useCaseId === 'UC_PROVENEWS'
        ? '/provenews/contracts'
        : `/use-cases/${useCaseId}/assets`;
    return this.transport.get<Record<string, unknown>>(path);
  }

  // ── Contracts (per use case) ──────────────────────────────────────────────

  /** List active contracts for a use case. */
  async listContracts(useCaseId: string): Promise<Record<string, unknown>[]> {
    return this.transport.unwrapList<Record<string, unknown>>(
      this.transport.get<unknown>(`/use-cases/${useCaseId}/contracts`),
      'contracts',
    );
  }

  // ── Multi-Channel Assignments ───────────────────────────────────────────

  /** List all channels an asset is assigned to (many-to-many). */
  async channelsForAsset(assetId: string): Promise<Record<string, unknown>> {
    return this.transport.get<Record<string, unknown>>(`/asset-channels/${assetId}`);
  }

  /** List all assets in a channel. */
  async assetsInChannel(channelId: string): Promise<Record<string, unknown>> {
    return this.transport.get<Record<string, unknown>>(`/asset-channels/channel/${channelId}`);
  }

  // ── Compliance (asset-agnostic) ───────────────────────────────────────────

  /** Get compliance status for an asset against a specific framework. */
  async getComplianceStatus(assetId: string, framework: string): Promise<Record<string, unknown>> {
    return this.transport.get<Record<string, unknown>>(`/rwa/${assetId}/compliance/${framework}`);
  }

  // ── Secondary Tokens ──────────────────────────────────────────────────────

  /** List derived/secondary tokens for an asset. */
  async listDerivedTokens(assetId: string): Promise<Record<string, unknown>[]> {
    return this.transport.unwrapList<Record<string, unknown>>(
      this.transport.get<unknown>(`/rwa/${assetId}/derived-tokens`),
      'tokens',
    );
  }
}
