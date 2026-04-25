/**
 * AAT-10C (Wave 10c) — Shared, generic RFC 4180 CSV writer.
 *
 * Extracted from `audit-log-csv.ts` (Wave 10a) so both the audit-logs
 * export and the report download endpoint can share one escaper. The
 * function is intentionally minimal (no streaming, no async iterators)
 * because every CSV the API emits is bounded — audit logs are capped at
 * 10k rows, report payloads are at most a few hundred line items.
 *
 * RFC 4180 escape rules:
 *   - Wrap a cell in double-quotes when it contains `,`, `"`, CR, or LF.
 *   - Escape an embedded `"` by doubling it.
 *   - Use CRLF as the row terminator (so Excel/Sheets parse cleanly).
 */
export const CSV_ROW_TERMINATOR = '\r\n';

/**
 * RFC 4180 cell escaper. Plain strings pass through unchanged; cells
 * with `,` / `"` / `\r` / `\n` get wrapped in double-quotes with any
 * embedded quotes doubled.
 */
export function escapeCsvCell(input: string): string {
  if (input === '') return '';
  if (/[",\r\n]/.test(input)) {
    return `"${input.replace(/"/g, '""')}"`;
  }
  return input;
}

/**
 * Coerce an arbitrary cell value into a CSV-safe string.
 *
 *   - `null` / `undefined` → empty cell
 *   - `Date`               → ISO-8601 (`toISOString`)
 *   - primitives           → `String(v)`
 *   - objects/arrays       → `JSON.stringify(v)` (then escaped)
 */
export function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

/**
 * Build a UTF-8 CSV buffer from row objects.
 *
 *   - `headers` controls the column order (and the header row). When
 *     omitted, the keys of the first row are used.
 *   - Always emits a header line, even when `rows` is empty.
 *   - Always terminates with a trailing CRLF (RFC 4180 §2.2).
 *
 * The output is UTF-8 encoded as a `Buffer` so route handlers can set
 * Content-Length without re-measuring.
 */
export function writeCsvBuffer(
  rows: ReadonlyArray<Record<string, unknown>>,
  headers?: ReadonlyArray<string>,
): Buffer {
  const cols: ReadonlyArray<string> =
    headers ??
    (rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : []);

  const lines: string[] = [];
  lines.push(cols.map((c) => escapeCsvCell(c)).join(','));

  for (const row of rows) {
    const cells = cols.map((col) => escapeCsvCell(stringifyCell(row[col])));
    lines.push(cells.join(','));
  }

  const csv = lines.join(CSV_ROW_TERMINATOR) + CSV_ROW_TERMINATOR;
  return Buffer.from(csv, 'utf-8');
}
