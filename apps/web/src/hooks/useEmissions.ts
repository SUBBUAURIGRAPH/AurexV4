import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

/* ============================================
   Types
   ============================================ */

export interface EmissionEntry {
  [key: string]: unknown;
  id: string;
  scope: string;
  category: string;
  source: string;
  emission_factor?: string;
  activity_value: number;
  unit: string;
  co2e: number;
  period_start: string;
  period_end: string;
  data_quality: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EmissionsResponse {
  data: EmissionEntry[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateEmissionData {
  scope: string;
  category: string;
  source: string;
  emission_factor?: string;
  activity_value: number;
  unit: string;
  co2e: number;
  period_start: string;
  period_end: string;
  data_quality: string;
}

export interface UpdateEmissionData extends Partial<CreateEmissionData> {
  id: string;
}

export interface EmissionsFilters {
  scope?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: string;
  search?: string;
}

/* ============================================
   Hooks
   ============================================ */

export function useEmissions(filters: EmissionsFilters) {
  const params: Record<string, string | number | boolean | undefined> = {};
  if (filters.scope) params.scope = filters.scope;
  if (filters.status) params.status = filters.status;
  if (filters.dateFrom) params.date_from = filters.dateFrom;
  if (filters.dateTo) params.date_to = filters.dateTo;
  if (filters.page) params.page = filters.page;
  if (filters.pageSize) params.page_size = filters.pageSize;
  if (filters.sort) params.sort = filters.sort;
  if (filters.order) params.order = filters.order;
  if (filters.search) params.search = filters.search;

  return useQuery<EmissionsResponse>({
    queryKey: ['emissions', filters],
    queryFn: () => api.get<EmissionsResponse>('/emissions', params),
  });
}

export function useCreateEmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmissionData) =>
      api.post<EmissionEntry>('/emissions', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emissions'] });
    },
  });
}

export function useUpdateEmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateEmissionData) =>
      api.patch<EmissionEntry>(`/emissions/${id}`, data),
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
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<EmissionEntry>(`/emissions/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emissions'] });
    },
  });
}

export function useBulkUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      api.post<{ updated: number }>('/emissions/bulk-status', { ids, status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emissions'] });
    },
  });
}
