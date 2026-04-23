import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

/* ============================================
   Types
   ============================================ */

export interface EmissionSource {
  id: string;
  scope: string;
  category: string;
  name: string;
  description?: string;
}

export interface EmissionFactor {
  id: string;
  scope: string;
  category: string;
  source: string;
  factor: number;
  unit: string;
  region?: string;
  year?: number;
}

/* ============================================
   Hooks
   ============================================ */

export function useEmissionSources(scope?: string, category?: string) {
  const params: Record<string, string | number | boolean | undefined> = {};
  if (scope) params.scope = scope;
  if (category) params.category = category;

  return useQuery<EmissionSource[]>({
    queryKey: ['emission-sources', scope, category],
    queryFn: () => api.get<EmissionSource[]>('/emission-sources', params),
  });
}

export function useEmissionFactors(scope?: string, category?: string, source?: string) {
  const params: Record<string, string | number | boolean | undefined> = {};
  if (scope) params.scope = scope;
  if (category) params.category = category;
  if (source) params.source = source;

  return useQuery<EmissionFactor[]>({
    queryKey: ['emission-factors', scope, category, source],
    queryFn: () => api.get<EmissionFactor[]>('/emission-factors', params),
  });
}
