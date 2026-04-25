/**
 * AAT-10C (Wave 10c): unit tests for the per-report-type CSV row
 * shaper + the PDF cover-page summary builder.
 */

import { describe, it, expect } from 'vitest';
import { buildReportCsv, buildReportSummary } from './report-export.js';

describe('buildReportCsv (GHG)', () => {
  it('emits the canonical 6-column header for GHG', () => {
    const ds = buildReportCsv('ghg', {
      categoryBreakdown: { SCOPE_1: { stationary: 12 } },
    });
    expect(ds.headers).toEqual([
      'category',
      'source',
      'quantity',
      'unit',
      'factor',
      'emissions_kgco2e',
    ]);
  });

  it('produces one row per (scope, category) with a tCO2e→kg conversion', () => {
    const ds = buildReportCsv('ghg', {
      categoryBreakdown: {
        SCOPE_1: { stationary: 60 },
        SCOPE_2: { electricity: 40 },
      },
    });
    expect(ds.rows).toHaveLength(2);
    expect(ds.rows[0]).toEqual({
      category: 'stationary',
      source: 'SCOPE_1',
      quantity: 60,
      unit: 'tCO2e',
      factor: '',
      emissions_kgco2e: 60_000,
    });
    expect(ds.rows[1]).toEqual({
      category: 'electricity',
      source: 'SCOPE_2',
      quantity: 40,
      unit: 'tCO2e',
      factor: '',
      emissions_kgco2e: 40_000,
    });
  });

  it('falls back to scopeTotals when categoryBreakdown is absent', () => {
    const ds = buildReportCsv('ghg', {
      summary: {
        scopeTotals: { SCOPE_1: 5, SCOPE_3: 7 },
      },
    });
    expect(ds.rows).toHaveLength(2);
    expect(ds.rows[0]).toMatchObject({
      category: 'all',
      source: 'SCOPE_1',
      quantity: 5,
      emissions_kgco2e: 5000,
    });
  });
});

describe('buildReportCsv (TCFD / CDP / Custom)', () => {
  it('TCFD dumps top-level keys as key,value rows', () => {
    const ds = buildReportCsv('tcfd', {
      governance: 'A',
      strategy: 'B',
    });
    expect(ds.headers).toEqual(['key', 'value']);
    expect(ds.rows).toEqual([
      { key: 'governance', value: 'A' },
      { key: 'strategy', value: 'B' },
    ]);
  });

  it('CDP dumps top-level keys as key,value rows', () => {
    const ds = buildReportCsv('cdp', { score: 'A-' });
    expect(ds.headers).toEqual(['key', 'value']);
    expect(ds.rows).toEqual([{ key: 'score', value: 'A-' }]);
  });

  it('Custom JSON-stringifies nested object values', () => {
    const ds = buildReportCsv('custom', {
      simple: 1,
      nested: { a: 1 },
    });
    expect(ds.rows).toEqual([
      { key: 'simple', value: 1 },
      { key: 'nested', value: '{"a":1}' },
    ]);
  });
});

describe('buildReportSummary', () => {
  it('renders id / type / period / scopes for any report', () => {
    const summary = buildReportSummary({
      id: 'rep-1',
      type: 'tcfd',
      parameters: { year: 2025, scopes: ['SCOPE_1'] },
      reportData: { governance: 'in place' },
      createdAt: new Date('2026-04-19T08:00:00.000Z'),
    });
    const labels = summary.map((s) => s.label);
    expect(labels).toContain('Report ID');
    expect(labels).toContain('Type');
    expect(labels).toContain('Period');
    expect(labels).toContain('Scopes');
    expect(summary.find((s) => s.label === 'Type')?.value).toBe('TCFD');
    expect(summary.find((s) => s.label === 'Period')?.value).toBe('Year 2025');
  });

  it('surfaces GHG headline metrics from reportData.summary', () => {
    const summary = buildReportSummary({
      id: 'rep-2',
      type: 'ghg',
      parameters: { year: 2025, scopes: ['SCOPE_1', 'SCOPE_2'] },
      reportData: {
        summary: {
          totalEmissions: 100,
          unit: 'tCO2e',
          scopeTotals: { SCOPE_1: 60 },
          recordCount: 5,
        },
      },
      createdAt: new Date('2026-04-19T08:00:00.000Z'),
    });
    const lookup = (label: string): string | undefined =>
      summary.find((s) => s.label === label)?.value;
    expect(lookup('Total emissions')).toBe('100 tCO2e');
    expect(lookup('Records')).toBe('5');
    expect(lookup('SCOPE_1')).toBe('60 tCO2e');
  });
});
