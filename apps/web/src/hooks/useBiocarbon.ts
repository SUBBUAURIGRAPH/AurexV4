/**
 * AAT-ν / AV4-356 — Biocarbon public marketplace + token detail hooks.
 *
 * Read-only, NO-AUTH against `/api/v1/biocarbon/*`. Mirrors the DTOs in
 * `apps/api/src/services/biocarbon-public.service.ts`.
 */
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';

// ── Public DTOs (1:1 with backend) ────────────────────────────────────────

export type PublicListingStatus = 'MINTED' | 'DELISTED_IN_FLIGHT' | 'RETIRED';

export interface BiocarbonAttribution {
  attribution: string;
  registryUrl: string;
}

export interface ListingDto {
  bcrSerialId: string;
  projectTitle: string;
  projectVisual?: string;
  projectPageUrl: string;
  methodologyCode: string;
  vintage: number;
  tonnes: number;
  status: PublicListingStatus;
  hostCountry: string;
  biocarbonAttribution: BiocarbonAttribution;
}

export interface MarketplacePage {
  items: ListingDto[];
  total: number;
  page: number;
  pageSize: number;
}

export type TransactionEventType = 'MINT' | 'TRANSFER' | 'DELIST' | 'RETIREMENT';

export interface TransactionEvent {
  type: TransactionEventType;
  occurredAt: string;
  txHash?: string;
  units?: number;
  narrative?: string;
  retirementPurpose?: 'NDC' | 'OIMP' | 'VOLUNTARY';
  beneficiaryRefHash?: string;
}

export interface TokenDetailDto {
  bcrSerialId: string;
  bcrLockId: string | null;
  methodology: {
    code: string;
    name: string;
    version: string;
    referenceUrl: string | null;
  };
  vintage: number;
  tonnes: number;
  hostCountry: string;
  projectTitle: string;
  projectDescription: string | null;
  projectPageUrl: string;
  projectVisuals: string[];
  status: PublicListingStatus;
  tokenizationContractId: string | null;
  tokenizationTxHash: string | null;
  mintedAt: string | null;
  transactionHistory: TransactionEvent[];
  biocarbonAttribution: BiocarbonAttribution;
}

export interface MarketplaceQuery {
  page?: number;
  pageSize?: number;
  methodologyCode?: string;
  vintage?: number;
  status?: PublicListingStatus;
  search?: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────

export function useMarketplace(query: MarketplaceQuery) {
  return useQuery<MarketplacePage>({
    queryKey: ['biocarbon-marketplace', query],
    queryFn: () =>
      api.get<MarketplacePage>('/biocarbon/marketplace', {
        page: query.page,
        pageSize: query.pageSize,
        methodologyCode: query.methodologyCode,
        vintage: query.vintage,
        status: query.status,
        search: query.search,
      }),
  });
}

export function useTokenDetail(bcrSerialId: string | undefined) {
  return useQuery<TokenDetailDto, ApiError>({
    queryKey: ['biocarbon-token', bcrSerialId],
    queryFn: () =>
      api.get<TokenDetailDto>(`/biocarbon/tokens/${encodeURIComponent(bcrSerialId!)}`),
    enabled: !!bcrSerialId,
    retry: (failureCount, err) => {
      // Don't retry on 404 — use the RFC 7807 surfaced status.
      if (err && (err as ApiError).status === 404) return false;
      return failureCount < 1;
    },
  });
}

// ── Static reference data ─────────────────────────────────────────────────

/**
 * The 6 BCR methodologies seeded by the backend (mirrors the seed script).
 * Hardcoded here because the backend doesn't yet expose a methodologies
 * endpoint and these are stable BCR identifiers.
 */
export const BCR_METHODOLOGIES: Array<{ code: string; label: string }> = [
  { code: 'VM0042', label: 'VM0042 — Improved Agricultural Land Management' },
  { code: 'VM0007', label: 'VM0007 — REDD+ Methodology Framework' },
  { code: 'VM0033', label: 'VM0033 — Tidal Wetland & Seagrass Restoration' },
  { code: 'AR-AMS0001', label: 'AR-AMS0001 — Small-Scale A/R CDM' },
  { code: 'AR-AMS0003', label: 'AR-AMS0003 — A/R on Wetlands (Small-Scale)' },
  { code: 'AR-AMS0007', label: 'AR-AMS0007 — A/R on Lands with Vegetation' },
];

export const STATUS_OPTIONS: Array<{ value: PublicListingStatus; label: string }> = [
  { value: 'MINTED', label: 'Minted' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'DELISTED_IN_FLIGHT', label: 'Delist in flight' },
];

/**
 * Build the explorer URL for a tx hash.
 * TODO(prod-explorer): switch to env-configured explorer once the public
 * Aurigraph DLT mainnet URL is finalised.
 */
export function buildExplorerUrl(txHash: string): string {
  return `https://dlt.aurigraph.io/tx/${txHash}`;
}
