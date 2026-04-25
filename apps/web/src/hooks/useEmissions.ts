import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Scope } from './useBaselines';

/* ============================================
   Types — match packages/shared/src/schemas/emissions.ts
   (scope SCOPE_1/2/3, camelCase, value = computed CO2e)
   ============================================ */

export type EmissionStatus = 'DRAFT' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface EmissionEntry {
  id: string;
  orgId: string;
  scope: Scope;
  category: string;
  source: string;
  value: number | string;
  unit: string;
  periodStart: string;
  periodEnd: string;
  status: EmissionStatus;
  // Extra UI fields (emissionFactor, activityValue, dataQuality, notes)
  // live inside metadata so they don't require schema changes.
  metadata?: Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmissionsResponse {
  data: EmissionEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateEmissionData {
  scope: Scope;
  category: string;
  source: string;
  value: number;
  unit?: string;
  periodStart: string;
  periodEnd: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateEmissionData extends Partial<CreateEmissionData> {
  id: string;
}

export interface EmissionsFilters {
  scope?: Scope;
  status?: EmissionStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

/* ============================================
   Hooks
   ============================================ */

/**
 * AAT-WORKFLOW (Wave 9a): fetch one emission record by id. Powers the new
 * /emissions/:id detail view and the edit-form prefill.
 */
export function useEmission(id: string | undefined) {
  return useQuery<{ data: EmissionEntry }>({
    queryKey: ['emissions', 'detail', id],
    queryFn: () => api.get<{ data: EmissionEntry }>(`/emissions/${id}`),
    enabled: !!id,
  });
}

export function useEmissions(filters: EmissionsFilters) {
  const params: Record<string, string | number | boolean | undefined> = {
    scope: filters.scope,
    status: filters.status,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    page: filters.page,
    pageSize: filters.pageSize,
    sort: filters.sort,
    order: filters.order,
    search: filters.search,
  };

  return useQuery<EmissionsResponse>({
    queryKey: ['emissions', filters],
    queryFn: () => api.get<EmissionsResponse>('/emissions', params),
  });
}

export function useCreateEmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmissionData) =>
      api.post<{ data: EmissionEntry }>('/emissions', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emissions'] });
    },
  });
}

export function useUpdateEmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateEmissionData) =>
      api.patch<{ data: EmissionEntry }>(`/emissions/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emissions'] });
    },
  });
}

export function useDeleteEmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/emissions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emissions'] });
    },
  });
}

export function useUpdateEmissionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'VERIFIED' | 'REJECTED' }) =>
      api.patch<{ data: EmissionEntry }>(`/emissions/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emissions'] });
    },
  });
}

export function useBulkUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: 'VERIFIED' | 'REJECTED' }) =>
      api.post<{ updated: number }>('/emissions/bulk-status', { ids, status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emissions'] });
    },
  });
}
