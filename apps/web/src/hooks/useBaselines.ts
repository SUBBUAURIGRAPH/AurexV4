import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

/* ============================================
   Types (match packages/shared/src/schemas/baselines.ts)
   ============================================ */

export type Scope = 'SCOPE_1' | 'SCOPE_2' | 'SCOPE_3';

export interface Baseline {
  id: string;
  orgId: string;
  name: string;
  scope: Scope;
  baseYear: number;
  value: number;
  unit: string;
  methodology: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBaselineData {
  name: string;
  scope: Scope | '';
  baseYear: number;
  value: number;
  unit: string;
  methodology?: string;
  isActive?: boolean;
}

export interface UpdateBaselineData extends Partial<Omit<CreateBaselineData, 'scope'>> {
  id: string;
  scope?: Scope;
}

/* ============================================
   Hooks
   ============================================ */

export function useBaselines(scope?: Scope) {
  return useQuery<{ data: Baseline[] }>({
    queryKey: ['baselines', scope],
    queryFn: () => api.get<{ data: Baseline[] }>('/baselines', { scope }),
  });
}

export function useCreateBaseline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBaselineData) =>
      api.post<{ data: Baseline }>('/baselines', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baselines'] });
    },
  });
}

export function useUpdateBaseline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateBaselineData) =>
      api.patch<{ data: Baseline }>(`/baselines/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baselines'] });
    },
  });
}

export function useDeleteBaseline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/baselines/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baselines'] });
    },
  });
}
