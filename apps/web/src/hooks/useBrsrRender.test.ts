/**
 * AAT-10D (Wave 10d): pure-helper tests for the BRSR render URL
 * builder + the format-dropdown defaults.
 *
 * RTL/jsdom isn't yet wired into apps/web (see useAuditCsvExport.test.ts
 * for the same pattern), so the page-level "format defaults to PDF"
 * assertion is split between this file (the hook contract) and a
 * source-level guard against the page reverting to the Wave 9a
 * disabled placeholder.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  BRSR_RENDER_FORMATS,
  buildBrsrRenderUrl,
  fiscalYearToYearNumber,
} from './useBrsrRender';

describe('BRSR_RENDER_FORMATS', () => {
  it('defaults to PDF — the first entry must be the pdf format', () => {
    // The Builder page uses BRSR_RENDER_FORMATS[0].value as the
    // initial useState value for the dropdown. If this order ever
    // flips, the default download silently changes from PDF to XBRL.
    expect(BRSR_RENDER_FORMATS[0]?.value).toBe('pdf');
    expect(BRSR_RENDER_FORMATS[0]?.label).toBe('PDF');
  });

  it('exposes both PDF and XBRL as supported formats', () => {
    const values = BRSR_RENDER_FORMATS.map((f) => f.value).sort();
    expect(values).toEqual(['pdf', 'xbrl']);
  });
});

describe('buildBrsrRenderUrl', () => {
  it('builds the pdf URL', () => {
    expect(buildBrsrRenderUrl(2024, 'pdf')).toBe(
      '/api/v1/brsr/responses/2024/render?format=pdf',
    );
  });

  it('builds the xbrl URL', () => {
    expect(buildBrsrRenderUrl(2024, 'xbrl')).toBe(
      '/api/v1/brsr/responses/2024/render?format=xbrl',
    );
  });
});

describe('fiscalYearToYearNumber', () => {
  it('returns the leading 4-digit year', () => {
    expect(fiscalYearToYearNumber('2024-25')).toBe(2024);
    expect(fiscalYearToYearNumber('2099-00')).toBe(2099);
  });

  it('returns null on malformed input', () => {
    expect(fiscalYearToYearNumber('2024')).toBe(null);
    expect(fiscalYearToYearNumber('24-25')).toBe(null);
    expect(fiscalYearToYearNumber('FY24')).toBe(null);
  });

  it('tolerates surrounding whitespace', () => {
    expect(fiscalYearToYearNumber('  2024-25  ')).toBe(2024);
  });
});

// ── BRSRBuilderPage Generate button (source-level guard) ─────────────
//
// Same pattern as useAuditCsvExport.test.ts — RTL/jsdom isn't installed
// in apps/web. We assert that the post-AAT-10D page source no longer
// carries the Wave 9a "Coming soon — Wave 10" disabled marker, which
// is the regression we'd hit if a refactor lost the wiring.
describe('BRSRBuilderPage Generate button (source-level guard)', () => {
  it('is no longer the Wave 9a disabled placeholder', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const pagePath = resolve(
      here,
      '../pages/dashboard/brsr/BRSRBuilderPage.tsx',
    );
    const src = readFileSync(pagePath, 'utf-8');
    // Wave 9a placeholders are gone.
    expect(src).not.toContain('Coming soon — PDF / XBRL export wired in Wave 10');
    expect(src).not.toContain('cursor: \'not-allowed\'');
    // The new live handler is wired on the button.
    expect(src).toContain('handleGenerate');
    // Format dropdown is rendered.
    expect(src).toContain('brsr-render-format');
    expect(src).toContain('brsr-generate-button');
  });
});
