/**
 * Tier namespace — SDK tier management, usage stats, and upgrade requests.
 *
 * Wraps:
 *   - GET  /api/v11/sdk/partner/tier
 *   - GET  /api/v11/sdk/partner/usage
 *   - GET  /api/v11/sdk/mint/quota
 *   - POST /api/v11/sdk/partner/upgrade
 */

import type {
  TierConfig,
  UsageStats,
  MintQuota,
  UpgradeRequest,
} from '../types.js';

export interface TierTransport {
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

export class TierApi {
  constructor(private readonly transport: TierTransport) {}

  /** Get the current partner tier configuration and limits. */
  async getPartnerTier(): Promise<TierConfig> {
    return this.transport.get<TierConfig>('/sdk/partner/tier');
  }

  /** Get current period usage stats (today + monthly). */
  async getUsage(): Promise<UsageStats> {
    return this.transport.get<UsageStats>('/sdk/partner/usage');
  }

  /** Get remaining mint/DMRV/composite quota for the current billing period. */
  async getQuota(): Promise<MintQuota> {
    return this.transport.get<MintQuota>('/sdk/mint/quota');
  }

  /** Request a tier upgrade. Returns the upgrade request with tracking status. */
  async requestUpgrade(targetTier: string): Promise<UpgradeRequest> {
    return this.transport.post<UpgradeRequest>('/sdk/partner/upgrade', {
      targetTier,
    });
  }
}
