import { prisma } from '@aurex/database';
import { logger } from '../lib/logger.js';
import { collectDescendantOrgIds } from './organization.service.js';

/**
 * CSV-safe serialization of an arbitrary field.
 * - Wraps in double quotes
 * - Escapes embedded `"` as `""`
 * - Null/undefined serialize to empty string
 * - Dates serialize to ISO 8601
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let s: string;
  if (value instanceof Date) {
    s = value.toISOString();
  } else if (typeof value === 'object') {
    s = JSON.stringify(value);
  } else {
    s = String(value);
  }
  return `"${s.replace(/"/g, '""')}"`;
}

export interface ExportRecord {
  id: string;
  orgId: string;
  scope: string;
  category: string;
  source: string;
  value: unknown;
  unit: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  metadata: unknown;
  createdAt: Date;
}

export const CSV_COLUMNS = [
  'id',
  'orgId',
  'scope',
  'category',
  'source',
  'value',
  'unit',
  'periodStart',
  'periodEnd',
  'status',
  'metadata',
  'createdAt',
] as const;

/**
 * Encode a set of records as CSV (RFC 4180-style: CRLF line endings, all
 * fields double-quoted, embedded quotes doubled). `metadata` is JSON-stringified.
 */
export function encodeCsv(records: ExportRecord[]): string {
  const lines: string[] = [];
  lines.push(CSV_COLUMNS.map((c) => csvEscape(c)).join(','));

  for (const r of records) {
    const row = [
      csvEscape(r.id),
      csvEscape(r.orgId),
      csvEscape(r.scope),
      csvEscape(r.category),
      csvEscape(r.source),
      csvEscape(r.value),
      csvEscape(r.unit),
      csvEscape(r.periodStart),
      csvEscape(r.periodEnd),
      csvEscape(r.status),
      // metadata is explicitly JSON-stringified (including nulls)
      csvEscape(r.metadata === null || r.metadata === undefined ? '' : JSON.stringify(r.metadata)),
      csvEscape(r.createdAt),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\r\n');
}

/**
 * Build a UTC filename like `emissions-YYYYMMDD-HHMM.csv`.
 */
export function buildFilename(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const yyyy = now.getUTCFullYear();
  const mm = pad(now.getUTCMonth() + 1);
  const dd = pad(now.getUTCDate());
  const hh = pad(now.getUTCHours());
  const mi = pad(now.getUTCMinutes());
  return `emissions-${yyyy}${mm}${dd}-${hh}${mi}.csv`;
}

export interface ExportEmissionsOpts {
  scope?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  includeSubsidiaries?: boolean;
}

export interface ExportResult {
  filename: string;
  csv: string;
}

/**
 * Query emissions records (same filter shape as the list endpoint) and
 * return them encoded as a CSV string plus a timestamped filename.
 */
export async function exportEmissionsCsv(
  orgId: string,
  opts: ExportEmissionsOpts = {},
): Promise<ExportResult> {
  const { scope, status, dateFrom, dateTo, includeSubsidiaries } = opts;

  const where: Record<string, unknown> = {};

  if (includeSubsidiaries) {
    const ids = await collectDescendantOrgIds([orgId]);
    where.orgId = { in: ids.length > 0 ? ids : [orgId] };
  } else {
    where.orgId = orgId;
  }

  if (scope) {
    where.scope = scope;
  }

  if (status) {
    where.status = status.toUpperCase();
  }

  if (dateFrom || dateTo) {
    const periodFilter: Record<string, unknown> = {};
    if (dateFrom) periodFilter.gte = new Date(dateFrom);
    if (dateTo) periodFilter.lte = new Date(dateTo);
    where.periodStart = periodFilter;
  }

  const records = await prisma.emissionsRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  const csv = encodeCsv(records as unknown as ExportRecord[]);
  const filename = buildFilename();

  logger.info(
    { orgId, count: records.length, includeSubsidiaries: !!includeSubsidiaries },
    'Emissions CSV export generated',
  );

  return { filename, csv };
}
