import { describe, it, expect } from 'vitest';
import {
  csvEscape,
  encodeCsv,
  buildFilename,
  CSV_COLUMNS,
  type ExportRecord,
} from './export.service.js';

function makeRecord(overrides: Partial<ExportRecord> = {}): ExportRecord {
  return {
    id: 'rec-1',
    orgId: 'org-1',
    scope: 'SCOPE_1',
    category: 'stationary_combustion',
    source: 'natural_gas',
    value: 123.45,
    unit: 'tCO2e',
    periodStart: new Date('2025-01-01T00:00:00.000Z'),
    periodEnd: new Date('2025-01-31T23:59:59.000Z'),
    status: 'DRAFT',
    metadata: null,
    createdAt: new Date('2025-02-01T10:15:00.000Z'),
    ...overrides,
  };
}

describe('csvEscape', () => {
  it('escapes embedded double-quotes by doubling them', () => {
    expect(csvEscape('a "quoted" value')).toBe('"a ""quoted"" value"');
  });

  it('wraps commas without modification (fields are always quoted)', () => {
    expect(csvEscape('hello, world')).toBe('"hello, world"');
  });

  it('serializes null/undefined as empty quoted strings', () => {
    expect(csvEscape(null)).toBe('""');
    expect(csvEscape(undefined)).toBe('""');
  });

  it('serializes Date as ISO 8601', () => {
    expect(csvEscape(new Date('2025-03-15T12:00:00.000Z'))).toBe(
      '"2025-03-15T12:00:00.000Z"',
    );
  });
});

describe('encodeCsv', () => {
  it('emits a header row that matches CSV_COLUMNS', () => {
    const csv = encodeCsv([]);
    const expectedHeader = CSV_COLUMNS.map((c) => `"${c}"`).join(',');
    expect(csv).toBe(expectedHeader);
  });

  it('row count matches records count (header + N rows)', () => {
    const records = [makeRecord({ id: 'r1' }), makeRecord({ id: 'r2' }), makeRecord({ id: 'r3' })];
    const csv = encodeCsv(records);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(1 + records.length);
  });

  it('uses CRLF between rows', () => {
    const csv = encodeCsv([makeRecord()]);
    expect(csv.includes('\r\n')).toBe(true);
    // ensure no bare LF outside of CRLF pairs
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/\n/);
  });

  it('correctly escapes a record whose source contains a comma and a quote', () => {
    const tricky = makeRecord({
      source: 'fuel, "premium" blend',
    });
    const csv = encodeCsv([tricky]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    // the source field should be properly quoted and its internal quotes doubled
    expect(lines[1]).toContain('"fuel, ""premium"" blend"');
  });

  it('JSON-stringifies metadata in the output', () => {
    const rec = makeRecord({ metadata: { foo: 'bar', n: 1 } });
    const csv = encodeCsv([rec]);
    const lines = csv.split('\r\n');
    // JSON is `{"foo":"bar","n":1}`, with every `"` doubled by csvEscape
    expect(lines[1]).toContain('"{""foo"":""bar"",""n"":1}"');
  });
});

describe('buildFilename', () => {
  it('produces emissions-YYYYMMDD-HHMM.csv in UTC', () => {
    const fn = buildFilename(new Date('2026-04-23T09:07:00.000Z'));
    expect(fn).toBe('emissions-20260423-0907.csv');
  });
});
