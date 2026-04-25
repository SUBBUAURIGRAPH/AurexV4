/**
 * AAT-10A (Wave 10a) — helper for the audit-logs CSV export endpoint.
 *
 * The download flow is driven from `AuditLogsPage`:
 *   1. HEAD `/api/v1/audit-logs?format=csv&<filters>` to detect the
 *      10k row-cap (HTTP 413) before opening a tab.
 *   2. GET the same URL and trigger an in-page anchor download (because
 *      browsers don't pass the bearer token on a plain `window.open`).
 *
 * This module just owns URL construction + the small filters type so
 * the page component stays focused on rendering.
 */

export interface AuditCsvFilters {
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const API_BASE = '/api/v1';

/**
 * Build a `/audit-logs?format=csv&...` URL, dropping empty filter
 * values so the server side query schema doesn't reject them.
 */
export function buildAuditCsvUrl(filters: AuditCsvFilters): string {
  const params = new URLSearchParams();
  params.set('format', 'csv');
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.action) params.set('action', filters.action);
  if (filters.resource) params.set('resource', filters.resource);
  if (filters.resourceId) params.set('resourceId', filters.resourceId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  return `${API_BASE}/audit-logs?${params.toString()}`;
}

/**
 * Public note for the UI: the API caps a single export at this many
 * rows. Surface it next to the export button so users know to narrow
 * filters when they expect a large window of history.
 */
export const AUDIT_CSV_ROW_CAP = 10_000;
