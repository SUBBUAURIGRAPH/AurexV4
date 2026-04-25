/**
 * AAT-10C (Wave 10c) — Report-export shape adapters.
 *
 * The `Report.reportData` Json column stores a different shape per
 * `Report.type`. The download endpoint needs both:
 *   - a flat row representation for CSV (one Record<string,unknown>
 *     per row, ordered columns); and
 *   - a {label, value}[] summary for the PDF cover page.
 *
 * We deliberately keep the dispatch tiny — every helper here pulls
 * what it can out of the stored JSON, gracefully tolerating a missing
 * shape (e.g. an older report where `categoryBreakdown` is absent).
 *
 * For TCFD / CDP / Custom the JSON is free-form (driven by user input),
 * so v1 of the CSV export dumps top-level keys as `key,value` pairs.
 * That's adequate for spreadsheet ingestion and matches the AAT-10C spec.
 */

export interface CsvDataset {
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface SummaryItem {
  label: string;
  value: string;
}

/**
 * Generic helper used by TCFD / CDP / Custom: every top-level key of
 * `reportData` becomes one row with `key` + `value`. Nested objects
 * are JSON-stringified (the shared CSV writer handles that already,
 * but we pre-stringify so the column reads cleanly when the value is
 * a primitive).
 */
function flattenTopLevelKeys(data: unknown): Record<string, unknown>[] {
  if (data === null || data === undefined) return [];
  if (typeof data !== 'object' || Array.isArray(data)) {
    return [{ key: 'value', value: data }];
  }
  return Object.entries(data as Record<string, unknown>).map(([key, value]) => ({
    key,
    value:
      value === null || typeof value !== 'object'
        ? value
        : JSON.stringify(value),
  }));
}

interface GhgReportData {
  reportType?: string;
  reportYear?: number;
  summary?: {
    totalEmissions?: number;
    unit?: string;
    scopeTotals?: Record<string, number>;
    recordCount?: number;
  };
  categoryBreakdown?: Record<string, Record<string, number>>;
  generatedAt?: string;
}

/**
 * Per AAT-10C spec, the GHG CSV emits one row per (scope, category)
 * pair with the columns:
 *   category, source, quantity, unit, factor, emissions_kgco2e
 *
 * The stored `reportData` only carries aggregates per scope+category
 * (no per-record `source` / `factor`), so we map:
 *   - source           → scope name (e.g. "SCOPE_1")
 *   - quantity         → aggregate value as stored (tCO2e)
 *   - unit             → "tCO2e"
 *   - factor           → "" (not retained at aggregate level)
 *   - emissions_kgco2e → quantity * 1000 (kg-equivalent)
 *
 * If `categoryBreakdown` is absent (older report), we fall back to
 * one row per scope total.
 */
function ghgCsvRows(data: GhgReportData): CsvDataset {
  const headers = [
    'category',
    'source',
    'quantity',
    'unit',
    'factor',
    'emissions_kgco2e',
  ];
  const rows: Record<string, unknown>[] = [];

  const cb = data.categoryBreakdown;
  if (cb && typeof cb === 'object') {
    for (const [scope, byCategory] of Object.entries(cb)) {
      if (!byCategory || typeof byCategory !== 'object') continue;
      for (const [category, value] of Object.entries(byCategory)) {
        const tco2e = Number(value) || 0;
        rows.push({
          category,
          source: scope,
          quantity: tco2e,
          unit: 'tCO2e',
          factor: '',
          emissions_kgco2e: tco2e * 1000,
        });
      }
    }
  }

  // Fallback: when no categoryBreakdown, emit one row per scopeTotal so
  // the consumer gets *something* useful instead of an empty body.
  if (rows.length === 0 && data.summary?.scopeTotals) {
    for (const [scope, tco2e] of Object.entries(data.summary.scopeTotals)) {
      const v = Number(tco2e) || 0;
      rows.push({
        category: 'all',
        source: scope,
        quantity: v,
        unit: 'tCO2e',
        factor: '',
        emissions_kgco2e: v * 1000,
      });
    }
  }

  return { headers, rows };
}

/**
 * Build the CSV dataset for a given report type. Branches on the
 * lower-cased `Report.type` value.
 */
export function buildReportCsv(
  type: string,
  reportData: unknown,
): CsvDataset {
  const normalized = (type ?? '').toLowerCase();
  switch (normalized) {
    case 'ghg':
      return ghgCsvRows((reportData ?? {}) as GhgReportData);
    case 'tcfd':
    case 'cdp':
    case 'custom':
    default:
      return {
        headers: ['key', 'value'],
        rows: flattenTopLevelKeys(reportData),
      };
  }
}

interface ReportLike {
  id: string;
  type: string;
  parameters: unknown;
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
  reportData?: unknown;
}

/**
 * Build the {label, value}[] used by the PDF cover page.
 * Independent of report.type — the PDF is just a printable summary,
 * not a full re-render of the data tree.
 */
export function buildReportSummary(report: ReportLike): SummaryItem[] {
  const params = (report.parameters ?? {}) as {
    year?: number | string;
    scopes?: string[];
    includeSubsidiaries?: boolean;
  };
  const data = (report.reportData ?? {}) as GhgReportData;

  const period =
    typeof params.year === 'number' || typeof params.year === 'string'
      ? `Year ${params.year}`
      : '—';
  const scopes =
    Array.isArray(params.scopes) && params.scopes.length > 0
      ? params.scopes.join(', ')
      : 'all scopes';

  const items: SummaryItem[] = [
    { label: 'Report ID', value: report.id },
    { label: 'Type', value: (report.type ?? '').toUpperCase() || '—' },
    { label: 'Period', value: period },
    { label: 'Scopes', value: scopes },
  ];

  const generated =
    report.publishedAt ?? report.createdAt ?? new Date().toISOString();
  const generatedIso =
    generated instanceof Date ? generated.toISOString() : String(generated);
  items.push({ label: 'Generated', value: generatedIso });

  // GHG: surface the headline metrics from reportData.summary if
  // present. For TCFD/CDP/Custom this block is silently skipped.
  if (data.summary && typeof data.summary === 'object') {
    if (typeof data.summary.totalEmissions === 'number') {
      items.push({
        label: 'Total emissions',
        value: `${data.summary.totalEmissions} ${data.summary.unit ?? 'tCO2e'}`,
      });
    }
    if (typeof data.summary.recordCount === 'number') {
      items.push({
        label: 'Records',
        value: String(data.summary.recordCount),
      });
    }
    if (data.summary.scopeTotals && typeof data.summary.scopeTotals === 'object') {
      for (const [scope, value] of Object.entries(data.summary.scopeTotals)) {
        items.push({
          label: scope,
          value: `${Number(value) || 0} ${data.summary.unit ?? 'tCO2e'}`,
        });
      }
    }
  }

  return items;
}
