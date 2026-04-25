/**
 * AAT-10D (Wave 10d) — helper for the BRSR render endpoint.
 *
 * Mirrors the audit-logs CSV export pattern (useAuditCsvExport.ts):
 *   1. HEAD `/api/v1/brsr/responses/{year}/render?format={pdf|xbrl}`
 *      to detect server errors before opening a tab.
 *   2. GET the same URL with the bearer token, blob the body, and
 *      trigger an in-page anchor download.
 *
 * The fiscal-year string from the Builder page (`2024-25`) is split
 * on the first `-` and the leading 4-digit year is what the API
 * expects as the path parameter.
 */

const API_BASE = '/api/v1';

export type BrsrRenderFormat = 'pdf' | 'xbrl';

/**
 * Convert a BRSR fiscal-year string (`2024-25`) to the leading
 * calendar year integer the render route takes (`2024`). Returns
 * `null` if the input doesn't match the expected pattern — the
 * caller should toast and bail rather than calling the API.
 */
export function fiscalYearToYearNumber(fiscalYear: string): number | null {
  const m = /^(\d{4})-\d{2}$/.exec(fiscalYear.trim());
  if (!m) return null;
  return Number(m[1]);
}

/**
 * Build the absolute API path for the BRSR render endpoint.
 * Validation of the year + format happens at the call site.
 */
export function buildBrsrRenderUrl(
  year: number,
  format: BrsrRenderFormat,
): string {
  return `${API_BASE}/brsr/responses/${year}/render?format=${format}`;
}

/**
 * The list of formats shown in the dropdown. The order is
 * load-bearing — `pdf` is the default and must come first so the
 * `<select>` defaults pick it.
 */
export const BRSR_RENDER_FORMATS: ReadonlyArray<{
  value: BrsrRenderFormat;
  label: string;
}> = [
  { value: 'pdf', label: 'PDF' },
  { value: 'xbrl', label: 'XBRL' },
];
