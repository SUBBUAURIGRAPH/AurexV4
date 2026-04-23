import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

/* ============================================
   Types (shape matches apps/api/src/services/audit-log.service.ts)
   ============================================ */

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogsResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditLogsFilters {
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/* ============================================
   Hook
   ============================================ */

export function useAuditLogs(filters: AuditLogsFilters) {
  const params: Record<string, string | number | boolean | undefined> = {};
  if (filters.userId) params.userId = filters.userId;
  if (filters.action) params.action = filters.action;
  if (filters.resource) params.resource = filters.resource;
  if (filters.resourceId) params.resourceId = filters.resourceId;
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.page) params.page = filters.page;
  if (filters.pageSize) params.pageSize = filters.pageSize;

  return useQuery<AuditLogsResponse>({
    queryKey: ['audit-logs', filters],
    queryFn: () => api.get<AuditLogsResponse>('/audit-logs', params),
  });
}
