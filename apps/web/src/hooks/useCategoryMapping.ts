import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface CategoryMapping {
  id: string;
  orgId: string | null;
  scope: string;
  category: string;
  esgIndicatorCodes: string[];
  brsrIndicatorCodes: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Resolve the effective mapping for (scope, category) for the caller's org.
 * Returns null (wrapped in `{data: null}`) when neither an org override nor a
 * platform default is configured.
 */
export function useResolvedMapping(scope: string | null, category: string | null) {
  const enabled = !!scope && !!category;
  return useQuery({
    queryKey: ['category-mapping', scope, category],
    queryFn: () =>
      api.get<{ data: CategoryMapping | null }>('/reference-data/category-mappings/resolve', {
        scope: scope ?? undefined,
        category: category ?? undefined,
      }),
    enabled,
    // Mappings change rarely; keep cache warm.
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategoryMappings(scope?: string) {
  return useQuery({
    queryKey: ['category-mappings', scope ?? 'all'],
    queryFn: () =>
      api.get<{ data: CategoryMapping[] }>('/reference-data/category-mappings', {
        scope: scope ?? undefined,
      }),
    staleTime: 5 * 60 * 1000,
  });
}
