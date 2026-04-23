import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface BrsrPrinciple {
  id: string;
  number: number;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  indicatorCount?: number;
}

export interface BrsrIndicator {
  id: string;
  principleId: string | null;
  section: 'SECTION_A' | 'SECTION_B' | 'SECTION_C';
  indicatorType: 'ESSENTIAL' | 'LEADERSHIP';
  code: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface BrsrPrincipleDetail extends BrsrPrinciple {
  indicators: BrsrIndicator[];
}

export interface BrsrResponse {
  id: string;
  orgId: string;
  indicatorId: string;
  fiscalYear: string;
  value: unknown;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  indicator?: BrsrIndicator;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const KEYS = {
  principles: () => ['brsr', 'principles'] as const,
  principle: (id: string) => ['brsr', 'principle', id] as const,
  indicators: (params: object) => ['brsr', 'indicators', params] as const,
  responses: (params: object) => ['brsr', 'responses', params] as const,
};

export function usePrinciples() {
  return useQuery({
    queryKey: KEYS.principles(),
    queryFn: () => api.get<PaginatedResponse<BrsrPrinciple>>('/brsr/principles', { pageSize: 50 }),
  });
}

export function usePrinciple(id: string | null) {
  return useQuery({
    queryKey: KEYS.principle(id ?? ''),
    queryFn: () => api.get<{ data: BrsrPrincipleDetail }>(`/brsr/principles/${id}`),
    enabled: !!id,
  });
}

export function useBrsrIndicators(params: {
  principleId?: string;
  section?: 'SECTION_A' | 'SECTION_B' | 'SECTION_C';
  indicatorType?: 'ESSENTIAL' | 'LEADERSHIP';
} = {}) {
  return useQuery({
    queryKey: KEYS.indicators(params),
    queryFn: () =>
      api.get<PaginatedResponse<BrsrIndicator>>('/brsr/indicators', {
        ...params,
        pageSize: 100,
      }),
  });
}

export function useBrsrResponses(params: { fiscalYear?: string; principleId?: string } = {}) {
  return useQuery({
    queryKey: KEYS.responses(params),
    queryFn: () =>
      api.get<PaginatedResponse<BrsrResponse>>('/brsr/responses', {
        ...params,
        pageSize: 100,
      }),
    enabled: !!params.fiscalYear,
  });
}

export function useUpsertBrsrResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { indicatorId: string; fiscalYear: string; value: unknown; notes?: string }) =>
      api.put<{ data: BrsrResponse }>('/brsr/responses', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brsr', 'responses'] });
    },
  });
}
