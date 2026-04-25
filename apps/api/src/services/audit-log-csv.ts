/**
 * AAT-10A (Wave 10a) — Minimal RFC 4180 CSV writer for the audit-log
 * export endpoint.
 *
 * We deliberately avoid pulling in `papaparse` / `csv-stringify` for a
 * single export route. The escaper here handles the three characters
 * RFC 4180 requires quoting on (`,`, `"`, newline) and is exercised by
 * unit tests in `audit-log-csv.test.ts`.
 *
 * Header row contract (do NOT reorder without bumping a follow-up — the
 * web download links are versionless and may be opened by spreadsheets
 * that key columns by position):
 *
 *   timestamp, actor, action, resourceKind, resourceId, changeSummary, ipAddress
 */

import type { AuditLogEntry } from './audit-log.service.js';

export const AUDIT_CSV_ROW_CAP = 10_000;

export const AUDIT_CSV_HEADER = [
  'timestamp',
  'actor',
  'action',
  'resourceKind',
  'resourceId',
  'changeSummary',
  'ipAddress',
] as const;

const CHANGE_SUMMARY_MAX = 200;

/**
 * RFC 4180 cell escaper. A cell is wrapped in double-quotes when it
 * contains a comma, a double-quote, a CR, or an LF. Embedded
 * double-quotes are escaped by doubling them.
 */
export function escapeCsvCell(input: string): string {
  if (input === '') return '';
  // Test once; covers `,`, `"`, `\r`, `\n` per RFC 4180.
  if (/[",\r\n]/.test(input)) {
    return `"${input.replace(/"/g, '""')}"`;
  }
  return input;
}

/**
 * Reduce an audit-log row's old/new payload to a single-line summary.
 * Truncated to CHANGE_SUMMARY_MAX chars so a noisy diff doesn't blow
 * the cell width (and so the file stays readable in Excel/Sheets).
 */
export function summarizeChange(
  oldValue: unknown,
  newValue: unknown,
): string {
  const hasOld = oldValue !== null && oldValue !== undefined;
  const hasNew = newValue !== null && newValue !== undefined;
  if (!hasOld && !hasNew) return '';

  let summary: string;
  try {
    if (hasOld && hasNew) {
      summary = `before=${JSON.stringify(oldValue)}; after=${JSON.stringify(newValue)}`;
    } else if (hasNew) {
      summary = `set=${JSON.stringify(newValue)}`;
    } else {
      summary = `cleared=${JSON.stringify(oldValue)}`;
    }
  } catch {
    // JSON.stringify can throw on circular refs; fall back to a hint.
    summary = '[unserializable]';
  }

  // Collapse whitespace + newlines to a single space so the row stays
  // on one logical line even before CSV-escaping kicks in.
  summary = summary.replace(/\s+/g, ' ').trim();

  if (summary.length > CHANGE_SUMMARY_MAX) {
    summary = summary.slice(0, CHANGE_SUMMARY_MAX - 1) + '…';
  }
  return summary;
}

/**
 * Format an `AuditLogEntry` as a single CSV row (header order).
 */
export function rowToCsv(row: AuditLogEntry): string {
  const ts =
    row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : new Date(row.createdAt).toISOString();
  const actor = row.userEmail ?? (row.userId ? row.userId : 'system');
  const cells = [
    ts,
    actor,
    row.action,
    row.resource,
    row.resourceId ?? '',
    summarizeChange(row.oldValue, row.newValue),
    row.ipAddress ?? '',
  ];
  return cells.map((c) => escapeCsvCell(c)).join(',');
}

/**
 * Build the full CSV body (header + rows). Always uses CRLF row
 * terminators per RFC 4180.
 */
export function buildAuditCsv(rows: readonly AuditLogEntry[]): string {
  const lines: string[] = [AUDIT_CSV_HEADER.join(',')];
  for (const r of rows) lines.push(rowToCsv(r));
  return lines.join('\r\n') + '\r\n';
}
