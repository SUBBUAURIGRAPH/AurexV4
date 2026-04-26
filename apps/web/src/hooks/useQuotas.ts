/**
 * AAT-378 / AV4-378 — Tier quota react-query hooks.
 *
 *   useMyQuotas()              — caller-org snapshot for the dashboard widget
 *   useAdminOrgQuotas(orgId)   — single-org snapshot (SUPER_ADMIN admin page)
 *   useAdminQuotasList(opts)   — list of orgs filtered by utilisation
 *
 * Snapshots are computed server-side per request — see
 * apps/api/src/services/billing/quota.service.ts. The frontend does
 * not cache aggressively (default react-query staleTime).
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type QuotaResourceKey =
  | 'monthlyEmissionEntries'
  | 'reportsPerYear'
  | 'activitiesActive'
  | 'creditUnitBlocks'
  | 'apiRequestsPerHour'
  | 'storageMb'
  | 'teamMembers';

export interface TierQuotas {
  monthlyEmissionEntries: number;
  reportsPerYear: number;
  activitiesActive: number;
  creditUnitBlocks: number;
  apiRequestsPerHour: number;
  storageMb: number;
  teamMembers: number;
}

export interface OrgQuotaSnapshotDto {
  orgId: string;
  orgName: string | null;
  orgSlug: string | null;
  plan: string;
  limits: TierQuotas;
  usage: TierQuotas;
  remaining: TierQuotas;
  ratios: Record<QuotaResourceKey, number>;
}

export interface AdminQuotaListItem extends OrgQuotaSnapshotDto {
  maxRatio: number;
}

export interface AdminQuotaListResponse {
  data: AdminQuotaListItem[];
  meta: {
    total: number;
    scanned: number;
    threshold: number;
    all: boolean;
  };
}

/** Stable display order + labels for the seven resources. */
export const QUOTA_RESOURCES: Array<{
  key: QuotaResourceKey;
  label: string;
}> = [
  { key: 'monthlyEmissionEntries', label: 'Emission entries (this month)' },
  { key: 'reportsPerYear', label: 'Reports (this year)' },
  { key: 'activitiesActive', label: 'Active activities' },
  { key: 'creditUnitBlocks', label: 'Credit unit blocks' },
  { key: 'teamMembers', label: 'Team members' },
  { key: 'storageMb', label: 'Storage (MB)' },
  { key: 'apiRequestsPerHour', label: 'API requests (per hour)' },
];

export function useMyQuotas() {
  return useQuery({
    queryKey: ['quotas', 'me'],
    queryFn: () => api.get<{ data: OrgQuotaSnapshotDto }>('/quotas/me'),
  });
}

export function useAdminOrgQuotas(orgId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'quotas', orgId],
    queryFn: () =>
      api.get<{ data: OrgQuotaSnapshotDto }>(`/admin/quotas/${orgId}`),
    enabled: !!orgId,
  });
}

export function useAdminQuotasList(opts: {
  all?: boolean;
  threshold?: number;
}) {
  const params: Record<string, string | number | boolean | undefined> = {};
  if (opts.all) params.all = 'true';
  if (typeof opts.threshold === 'number') params.threshold = opts.threshold;
  return useQuery({
    queryKey: ['admin', 'quotas', 'list', opts],
    queryFn: () => api.get<AdminQuotaListResponse>('/admin/quotas', params),
  });
}
