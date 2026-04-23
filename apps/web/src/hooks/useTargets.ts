import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Scope } from './useBaselines';

/* ============================================
   Types (match packages/shared/src/schemas/targets.ts)
   ============================================ */

export type Pathway = 'CELSIUS_1_5' | 'WELL_BELOW_2' | 'CELSIUS_2';

export interface Target {
  id: string;
  orgId: string;
  name: string;
  scope: Scope;
  targetYear: number;
  reduction: number;
  pathway: Pathway | null;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  progress?: TargetProgress[];
}

export interface CreateTargetData {
  name: string;
  scope: Scope | '';
  targetYear: number;
  reduction: number;
  pathway?: Pathway;
}

export interface UpdateTargetData extends Partial<Omit<CreateTargetData, 'scope'>> {
  id: string;
  scope?: Scope;
}

export interface TargetProgress {
  id: string;
  targetId: string;
  year: number;
  actual: number;
  projected: number | null;
  variance: number | null;
  createdAt: string;
}

export interface RecordProgressData {
  targetId: string;
  year: number;
  actual: number;
  projected?: number;
}

/* ============================================
   Hooks
   ============================================ */

export function useTargets(scope?: Scope) {
  return useQuery<{ data: Target[] }>({
    queryKey: ['targets', scope],
    queryFn: () => api.get<{ data: Target[] }>('/targets', { scope }),
  });
}

export function useTarget(id: string) {
  return useQuery<{ data: Target }>({
    queryKey: ['targets', id],
    queryFn: () => api.get<{ data: Target }>(`/targets/${id}`),
    enabled: !!id,
  });
}

export function useCreateTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTargetData) =>
      api.post<{ data: Target }>('/targets', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['targets'] });
    },
  });
}

export function useUpdateTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTargetData) =>
      api.patch<{ data: Target }>(`/targets/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['targets'] });
    },
  });
}

export function useApproveTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<{ data: Target }>(`/targets/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['targets'] });
    },
  });
}

export function useRecordProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordProgressData) =>
      api.post<{ data: TargetProgress }>(`/targets/${data.targetId}/progress`, {
        year: data.year,
        actual: data.actual,
        projected: data.projected,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['targets'] });
      qc.invalidateQueries({ queryKey: ['target-progress', variables.targetId] });
    },
  });
}

export function useTargetProgress(targetId: string) {
  return useQuery<{ data: TargetProgress[] }>({
    queryKey: ['target-progress', targetId],
    queryFn: () =>
      api.get<{ data: TargetProgress[] }>(`/targets/${targetId}/progress`),
    enabled: !!targetId,
  });
}
