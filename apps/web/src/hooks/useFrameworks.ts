import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface EsgFramework {
  id: string;
  code: string;
  name: string;
  description: string | null;
  version: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EsgIndicator {
  id: string;
  frameworkId: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface EsgFrameworkDetail extends EsgFramework {
  indicators: EsgIndicator[];
}

interface FrameworksResponse {
  data: EsgFramework[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const KEYS = {
  frameworks: () => ['frameworks'] as const,
  framework: (id: string) => ['framework', id] as const,
  orgMappings: () => ['framework-mappings'] as const,
};

export function useFrameworks() {
  return useQuery({
    queryKey: KEYS.frameworks(),
    queryFn: () => api.get<FrameworksResponse>('/esg/frameworks', { isActive: true, pageSize: 100 }),
  });
}

export function useFramework(id: string | null) {
  return useQuery({
    queryKey: KEYS.framework(id ?? ''),
    queryFn: () => api.get<{ data: EsgFrameworkDetail }>(`/esg/frameworks/${id}`),
    enabled: !!id,
  });
}

export function useOrgFrameworkMappings() {
  return useQuery({
    queryKey: KEYS.orgMappings(),
    queryFn: () => api.get<{ data: EsgFramework[] }>('/esg/org-mappings'),
  });
}

export function useMapFramework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (frameworkId: string) =>
      api.post<{ data: { orgId: string; frameworkId: string } }>('/esg/org-mappings', { frameworkId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.orgMappings() });
    },
  });
}

export function useUnmapFramework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (frameworkId: string) => api.delete<{ message: string }>(`/esg/org-mappings/${frameworkId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.orgMappings() });
    },
  });
}
