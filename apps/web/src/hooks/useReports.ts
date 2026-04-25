import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Scope } from './useBaselines';

/* ============================================
   Types (match packages/shared/src/schemas/reports.ts
   and apps/api/src/services/report.service.ts)
   ============================================ */

export type ReportType = 'ghg' | 'tcfd' | 'cdp' | 'custom';
export type ReportStatus = 'QUEUED' | 'GENERATING' | 'COMPLETED' | 'FAILED';

export interface ReportParameters {
  year: number;
  scopes: Scope[];
}

export interface Report {
  id: string;
  type: string;
  status: ReportStatus;
  parameters: ReportParameters | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportStatusInfo {
  id: string;
  status: ReportStatus;
  type: string;
  createdAt: string;
}

export interface GenerateReportData {
  type: ReportType;
  year: number;
  scopes: Scope[];
  includeSubsidiaries?: boolean;
}

/* ============================================
   Hooks
   ============================================ */

export function useReports() {
  return useQuery<{ data: Report[] }>({
    queryKey: ['reports'],
    queryFn: () => api.get<{ data: Report[] }>('/reports'),
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateReportData) =>
      api.post<{ data: { id: string; status: ReportStatus } }>('/reports/generate', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useReportStatus(id: string) {
  return useQuery<{ data: ReportStatusInfo }>({
    queryKey: ['reports', id, 'status'],
    queryFn: () => api.get<{ data: ReportStatusInfo }>(`/reports/${id}/status`),
    enabled: !!id,
    refetchInterval: (query) => {
      const report = query.state.data?.data;
      if (report && (report.status === 'COMPLETED' || report.status === 'FAILED')) {
        return false;
      }
      return 5000;
    },
  });
}

/**
 * AAT-10C (Wave 10c): supported download formats. JSON remains the
 * default so existing callers (the old "Download" button) keep working
 * without passing an explicit format.
 */
export type ReportDownloadFormat = 'json' | 'csv' | 'pdf';
export const REPORT_DOWNLOAD_FORMATS: readonly ReportDownloadFormat[] = [
  'json',
  'csv',
  'pdf',
] as const;

/**
 * Build the versioned API path for a report download. The optional
 * `format` argument appends `?format=<csv|pdf>`; for `json` we stay on
 * the bare path to keep parity with pre-AAT-10C URLs in the wild.
 */
export function downloadReportUrl(
  id: string,
  format: ReportDownloadFormat = 'json',
): string {
  const base = `/api/v1/reports/${id}/download`;
  return format === 'json' ? base : `${base}?format=${format}`;
}
