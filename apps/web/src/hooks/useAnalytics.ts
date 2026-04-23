import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

/* ============================================
   Types (match apps/api/src/services/analytics.service.ts)
   ============================================ */

export interface AnalyticsSummary {
  total: number;
  scope1: number;
  scope2: number;
  scope3: number;
  changePercent: number | null;
}

export interface TrendPoint {
  month: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

export interface ScopeBreakdown {
  scope: string;
  value: number;
  percentage: number;
}

export interface TopSource {
  source: string;
  category: string;
  value: number;
}

export interface CategoryBreakdown {
  category: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

export interface YoYPoint {
  month: string;
  currentYear: number;
  previousYear: number;
}

/* ============================================
   Hooks — query params are camelCase (dateFrom/dateTo),
   matching the backend route handlers. An optional
   `includeSubsidiaries` flag rolls child org data into the
   caller's org view.
   ============================================ */

export function useAnalyticsSummary(dateFrom?: string, dateTo?: string, includeSubsidiaries = false) {
  return useQuery<{ data: AnalyticsSummary }>({
    queryKey: ['analytics', 'summary', dateFrom, dateTo, includeSubsidiaries],
    queryFn: () =>
      api.get<{ data: AnalyticsSummary }>('/analytics/summary', {
        dateFrom,
        dateTo,
        includeSubsidiaries: includeSubsidiaries || undefined,
      }),
  });
}

// Backend always returns trailing 12 months; `months` kept for query-key stability.
export function useAnalyticsTrend(months?: number, includeSubsidiaries = false) {
  return useQuery<{ data: TrendPoint[] }>({
    queryKey: ['analytics', 'trend', months, includeSubsidiaries],
    queryFn: () =>
      api.get<{ data: TrendPoint[] }>('/analytics/trend', {
        includeSubsidiaries: includeSubsidiaries || undefined,
      }),
  });
}

export function useAnalyticsBreakdown(dateFrom?: string, dateTo?: string, includeSubsidiaries = false) {
  return useQuery<{ data: ScopeBreakdown[] }>({
    queryKey: ['analytics', 'breakdown', dateFrom, dateTo, includeSubsidiaries],
    queryFn: () =>
      api.get<{ data: ScopeBreakdown[] }>('/analytics/breakdown', {
        dateFrom,
        dateTo,
        includeSubsidiaries: includeSubsidiaries || undefined,
      }),
  });
}

export function useAnalyticsTopSources(
  limit?: number,
  dateFrom?: string,
  dateTo?: string,
  includeSubsidiaries = false,
) {
  return useQuery<{ data: TopSource[] }>({
    queryKey: ['analytics', 'top-sources', limit, dateFrom, dateTo, includeSubsidiaries],
    queryFn: () =>
      api.get<{ data: TopSource[] }>('/analytics/top-sources', {
        limit,
        dateFrom,
        dateTo,
        includeSubsidiaries: includeSubsidiaries || undefined,
      }),
  });
}

export function useAnalyticsByCategory(dateFrom?: string, dateTo?: string, includeSubsidiaries = false) {
  return useQuery<{ data: CategoryBreakdown[] }>({
    queryKey: ['analytics', 'by-category', dateFrom, dateTo, includeSubsidiaries],
    queryFn: () =>
      api.get<{ data: CategoryBreakdown[] }>('/analytics/by-category', {
        dateFrom,
        dateTo,
        includeSubsidiaries: includeSubsidiaries || undefined,
      }),
  });
}

export function useAnalyticsYoY(includeSubsidiaries = false) {
  return useQuery<{ data: YoYPoint[] }>({
    queryKey: ['analytics', 'yoy', includeSubsidiaries],
    queryFn: () =>
      api.get<{ data: YoYPoint[] }>('/analytics/yoy-comparison', {
        includeSubsidiaries: includeSubsidiaries || undefined,
      }),
  });
}
