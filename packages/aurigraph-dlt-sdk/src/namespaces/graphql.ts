/**
 * GraphQL namespace — Gateway for flexible querying of the V12 platform.
 *
 * Wraps:
 *   - POST /api/v11/graphql
 *
 * Provides typed convenience methods for common queries (channels, assets,
 * node metrics) plus a generic `query()` for arbitrary GraphQL operations.
 */

import type {
  GraphQLResponse,
  Channel,
  NodeMetrics,
} from '../types.js';

/** Minimal asset shape returned by the GraphQL gateway. */
export interface Asset {
  assetId: string;
  assetType: string;
  status?: string;
  channelId?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphQLTransport {
  post<T>(path: string, body: unknown): Promise<T>;
}

export class GraphQLApi {
  constructor(private readonly transport: GraphQLTransport) {}

  /** Execute an arbitrary GraphQL query or mutation. */
  async query<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<GraphQLResponse<T>> {
    return this.transport.post<GraphQLResponse<T>>('/graphql', {
      query,
      variables,
    });
  }

  /** Convenience: list all channels via GraphQL. */
  async queryChannels(): Promise<GraphQLResponse<{ channels: Channel[] }>> {
    return this.query<{ channels: Channel[] }>(
      `query { channels { channelId name type description createdAt } }`,
    );
  }

  /** Convenience: list assets for a channel via GraphQL. */
  async queryAssets(
    channelId: string,
  ): Promise<GraphQLResponse<{ assets: Asset[] }>> {
    return this.query<{ assets: Asset[] }>(
      `query($channelId: String!) { assets(channelId: $channelId) { assetId assetType status channelId } }`,
      { channelId },
    );
  }

  /** Convenience: get aggregated node metrics via GraphQL. */
  async queryNodeMetrics(): Promise<GraphQLResponse<{ nodeMetrics: NodeMetrics }>> {
    return this.query<{ nodeMetrics: NodeMetrics }>(
      `query { nodeMetrics { totalNodes activeNodes validatorCount networkStatus } }`,
    );
  }
}
