import { describe, it, expect } from 'vitest';
import { parseCsv, parseCsvLine } from './import.service.js';

describe('parseCsvLine', () => {
  it('splits simple comma-separated fields', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('preserves commas inside quoted fields', () => {
    expect(parseCsvLine('"a,b",c,"d"')).toEqual(['a,b', 'c', 'd']);
  });

  it('unescapes doubled quotes inside quoted fields', () => {
    expect(parseCsvLine('"she said ""hi""",ok')).toEqual(['she said "hi"', 'ok']);
  });

  it('keeps empty trailing fields', () => {
    expect(parseCsvLine('a,,c,')).toEqual(['a', '', 'c', '']);
  });
});

describe('parseCsv', () => {
  const goodHeader = 'scope,category,source,value,unit,periodStart,periodEnd';

  it('parses header and a single row', () => {
    const csv = `${goodHeader}\nSCOPE_1,stationary,diesel,12.5,tCO2e,2025-01-01,2025-01-31`;
    const { header, rows } = parseCsv(csv);

    expect(header).toEqual([
      'scope',
      'category',
      'source',
      'value',
      'unit',
      'periodStart',
      'periodEnd',
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([
      'SCOPE_1',
      'stationary',
      'diesel',
      '12.5',
      'tCO2e',
      '2025-01-01',
      '2025-01-31',
    ]);
  });

  it('handles CRLF line endings and a trailing newline', () => {
    const csv = `${goodHeader}\r\nSCOPE_2,purchased_electricity,grid,100,tCO2e,2025-01-01,2025-03-31\r\n`;
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]![0]).toBe('SCOPE_2');
  });

  it('accepts an optional metadata column', () => {
    const csv = `${goodHeader},metadata\nSCOPE_3,business_travel,flights,5,tCO2e,2025-01-01,2025-01-31,"{""note"":""q1""}"`;
    const { header, rows } = parseCsv(csv);
    expect(header).toContain('metadata');
    expect(rows[0]![7]).toBe('{"note":"q1"}');
  });

  it('rejects CSV missing a required header', () => {
    const csv = `scope,category,source,value,unit,periodStart\nSCOPE_1,c,s,1,tCO2e,2025-01-01`;
    expect(() => parseCsv(csv)).toThrowError(/missing required column: periodEnd/);
  });

  it('rejects empty input', () => {
    expect(() => parseCsv('')).toThrowError(/empty/i);
  });
});
