/**
 * AAT-10C (Wave 10c): unit tests for the shared RFC 4180 CSV writer.
 * Mirrors the audit-log-csv tests so the extraction stays a no-op for
 * the audit-log path.
 */

import { describe, it, expect } from 'vitest';
import {
  CSV_ROW_TERMINATOR,
  escapeCsvCell,
  stringifyCell,
  writeCsvBuffer,
} from './csv-writer.js';

describe('escapeCsvCell', () => {
  it('passes plain strings through unchanged', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
    expect(escapeCsvCell('user.update')).toBe('user.update');
  });

  it('quotes cells with commas', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
  });

  it('doubles and quotes embedded double-quotes', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes cells containing CR or LF', () => {
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell('cr\rlf')).toBe('"cr\rlf"');
  });

  it('preserves the empty string', () => {
    expect(escapeCsvCell('')).toBe('');
  });
});

describe('stringifyCell', () => {
  it('renders nullish values as empty cells', () => {
    expect(stringifyCell(null)).toBe('');
    expect(stringifyCell(undefined)).toBe('');
  });

  it('formats Date objects as ISO-8601', () => {
    expect(stringifyCell(new Date('2026-04-01T12:34:56.000Z'))).toBe(
      '2026-04-01T12:34:56.000Z',
    );
  });

  it('coerces primitives via String()', () => {
    expect(stringifyCell(42)).toBe('42');
    expect(stringifyCell(true)).toBe('true');
    expect(stringifyCell('hi')).toBe('hi');
  });

  it('JSON-stringifies objects and arrays', () => {
    expect(stringifyCell({ a: 1 })).toBe('{"a":1}');
    expect(stringifyCell([1, 2])).toBe('[1,2]');
  });

  it('falls back to a sentinel on circular refs', () => {
    const circ: Record<string, unknown> = {};
    circ.self = circ;
    expect(stringifyCell(circ)).toBe('[unserializable]');
  });
});

describe('writeCsvBuffer', () => {
  it('emits a header-only line when rows are empty', () => {
    const buf = writeCsvBuffer([], ['a', 'b']);
    expect(buf.toString('utf-8')).toBe(`a,b${CSV_ROW_TERMINATOR}`);
  });

  it('derives headers from the first row when none supplied', () => {
    const buf = writeCsvBuffer([{ x: 1, y: 2 }]);
    const csv = buf.toString('utf-8');
    expect(csv.split(CSV_ROW_TERMINATOR)[0]).toBe('x,y');
  });

  it('honours explicit header order independent of row key order', () => {
    const buf = writeCsvBuffer([{ b: 2, a: 1 }], ['a', 'b']);
    const lines = buf.toString('utf-8').split(CSV_ROW_TERMINATOR);
    expect(lines[0]).toBe('a,b');
    expect(lines[1]).toBe('1,2');
  });

  it('terminates the output with a trailing CRLF', () => {
    const csv = writeCsvBuffer([{ a: 1 }]).toString('utf-8');
    expect(csv.endsWith(CSV_ROW_TERMINATOR)).toBe(true);
  });

  it('escapes values per RFC 4180 when building rows', () => {
    const csv = writeCsvBuffer(
      [{ a: 'with,comma', b: 'a "quoted" b' }],
      ['a', 'b'],
    ).toString('utf-8');
    const lines = csv.split(CSV_ROW_TERMINATOR);
    expect(lines[1]).toBe('"with,comma","a ""quoted"" b"');
  });
});
