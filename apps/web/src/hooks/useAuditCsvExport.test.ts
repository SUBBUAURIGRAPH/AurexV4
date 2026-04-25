/**
 * AAT-10A (Wave 10a): pure-helper tests for the audit-logs CSV export
 * URL builder + row-cap constant.
 *
 * RTL/jsdom isn't yet wired into apps/web, so the page-level
 * "button is enabled when there are logs" assertion lives as a static
 * source-level check below — see the second describe block — until
 * the test-runner upgrade lands.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  AUDIT_CSV_ROW_CAP,
  buildAuditCsvUrl,
} from './useAuditCsvExport';

describe('buildAuditCsvUrl', () => {
  it('always sets format=csv and targets /api/v1/audit-logs', () => {
    expect(buildAuditCsvUrl({})).toBe('/api/v1/audit-logs?format=csv');
  });

  it('drops empty/undefined filters', () => {
    const url = buildAuditCsvUrl({
      userId: undefined,
      action: '',
      resource: undefined,
    });
    expect(url).toBe('/api/v1/audit-logs?format=csv');
  });

  it('encodes filters as query params', () => {
    const url = buildAuditCsvUrl({
      action: 'user.update',
      resource: 'User',
      dateFrom: '2026-01-01T00:00:00.000Z',
    });
    expect(url).toContain('format=csv');
    expect(url).toContain('action=user.update');
    expect(url).toContain('resource=User');
    expect(url).toContain('dateFrom=2026-01-01T00%3A00%3A00.000Z');
  });
});

describe('AUDIT_CSV_ROW_CAP', () => {
  it('matches the API-side cap (10,000 rows)', () => {
    expect(AUDIT_CSV_ROW_CAP).toBe(10_000);
  });
});

// ── AuditLogsPage button-enabled assertion (static source check) ──────────
//
// RTL/jsdom isn't installed in apps/web (see MarketplacePage.test.tsx for
// the same pattern). Rather than `describe.skip`, we directly assert the
// post-AAT-10A page source no longer carries the "Coming soon — Wave 10"
// disabled marker, which is the regression we'd hit if a refactor lost
// the wiring.
describe('AuditLogsPage Export CSV button (source-level guard)', () => {
  it('is no longer the Wave 9a disabled placeholder', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const pagePath = resolve(here, '../pages/dashboard/AuditLogsPage.tsx');
    const src = readFileSync(pagePath, 'utf-8');
    // Wave 9a placeholder is gone.
    expect(src).not.toContain('Coming soon — CSV export wired in Wave 10');
    // The new live handler is wired on the button.
    expect(src).toContain('handleExportCsv');
    // The 10k row-cap notice is rendered next to the button.
    expect(src).toContain('10,000 rows');
  });
});
