import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

/**
 * AV4-335: PDD (Project Design Document) hooks.
 *
 * Shape of `content` is intentionally `unknown` until the full 9-tab wizard
 * lands — the skeleton only populates `projectInfo`, `boundaries`, and
 * `baseline`. Tabs 4-9 (additionality, monitoring summary, leakage, SD-Tool,
 * stakeholder, attachments) carry through as passthrough keys when present.
 */

export interface Pdd {
  id: string;
  activityId: string;
  version: number;
  content: Record<string, unknown>;
  documentUrl: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PddVersionRow {
  id: string;
  version: number;
  submittedAt: string | null;
  submittedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export function usePdd(activityId: string | undefined) {
  return useQuery<{ data: Pdd | null }>({
    queryKey: ['pdd', activityId],
    queryFn: () => api.get<{ data: Pdd | null }>(`/pdds/${activityId}`),
    enabled: !!activityId,
  });
}

export function usePddVersions(activityId: string | undefined) {
  return useQuery<{ data: PddVersionRow[] }>({
    queryKey: ['pdd', activityId, 'versions'],
    queryFn: () => api.get<{ data: PddVersionRow[] }>(`/pdds/${activityId}/versions`),
    enabled: !!activityId,
  });
}

export function useUpsertPdd(activityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: Record<string, unknown>) =>
      api.put<{ data: Pdd }>(`/pdds/${activityId}`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pdd', activityId] });
    },
  });
}

export function useSubmitPdd(activityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ data: Pdd }>(`/pdds/${activityId}/submit`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pdd', activityId] });
      qc.invalidateQueries({ queryKey: ['activities', activityId] });
    },
  });
}
