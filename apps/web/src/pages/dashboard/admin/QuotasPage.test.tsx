/**
 * AAT-378 / AV4-378 — QuotasPage + QuotaWidget tests.
 *
 * Pure-helper tests run today against the public surface of
 * `useQuotas` + the `topThreeQuotas` helper. The full DOM-render
 * tests live inside `describe.skip(...)` until @testing-library/react
 * + jsdom land in apps/web/package.json — same convention used by
 * MarketplacePage.test.tsx (AAT-ν / AV4-356).
 */
import { describe, it, expect } from 'vitest';
import {
  QUOTA_RESOURCES,
  type OrgQuotaSnapshotDto,
  type QuotaResourceKey,
} from '../../../hooks/useQuotas';
import { topThreeQuotas } from '../../../components/dashboard/QuotaWidget';

function makeSnapshot(
  overrides: Partial<Record<QuotaResourceKey, { used: number; limit: number }>> = {},
): OrgQuotaSnapshotDto {
  const limits: Record<QuotaResourceKey, number> = {
    monthlyEmissionEntries: 1000,
    reportsPerYear: 12,
    activitiesActive: 5,
    creditUnitBlocks: 100,
    apiRequestsPerHour: 1000,
    storageMb: 1024,
    teamMembers: 5,
  };
  const usage: Record<QuotaResourceKey, number> = {
    monthlyEmissionEntries: 0,
    reportsPerYear: 0,
    activitiesActive: 0,
    creditUnitBlocks: 0,
    apiRequestsPerHour: 0,
    storageMb: 0,
    teamMembers: 0,
  };
  for (const [k, v] of Object.entries(overrides) as Array<
    [QuotaResourceKey, { used: number; limit: number }]
  >) {
    usage[k] = v.used;
    limits[k] = v.limit;
  }
  const remaining: Record<QuotaResourceKey, number> = { ...limits };
  const ratios: Record<QuotaResourceKey, number> = { ...usage };
  (Object.keys(limits) as QuotaResourceKey[]).forEach((k) => {
    remaining[k] = Math.max(0, limits[k] - usage[k]);
    ratios[k] = limits[k] === 0 ? 0 : usage[k] / limits[k];
  });
  return {
    orgId: 'org-1',
    orgName: 'Test Org',
    orgSlug: 'test-org',
    plan: 'MSME_INDIA',
    limits,
    usage,
    remaining,
    ratios,
  };
}

describe('QUOTA_RESOURCES', () => {
  it('lists exactly the seven tracked resources', () => {
    expect(QUOTA_RESOURCES).toHaveLength(7);
    const keys = QUOTA_RESOURCES.map((r) => r.key).sort();
    expect(keys).toEqual(
      [
        'activitiesActive',
        'apiRequestsPerHour',
        'creditUnitBlocks',
        'monthlyEmissionEntries',
        'reportsPerYear',
        'storageMb',
        'teamMembers',
      ].sort(),
    );
  });

  it('every entry has a non-empty human label', () => {
    for (const r of QUOTA_RESOURCES) {
      expect(r.label.length).toBeGreaterThan(0);
    }
  });
});

describe('topThreeQuotas', () => {
  it('returns an empty list when no resource is consumed', () => {
    const snap = makeSnapshot();
    expect(topThreeQuotas(snap)).toEqual([]);
  });

  it('returns the three highest-utilised resources sorted descending', () => {
    const snap = makeSnapshot({
      monthlyEmissionEntries: { used: 900, limit: 1000 },
      reportsPerYear: { used: 6, limit: 12 },
      activitiesActive: { used: 4, limit: 5 },
      teamMembers: { used: 1, limit: 5 },
    });
    const top = topThreeQuotas(snap);
    expect(top).toHaveLength(3);
    expect(top[0]?.key).toBe('monthlyEmissionEntries');
    expect(top[1]?.key).toBe('activitiesActive');
    expect(top[2]?.key).toBe('reportsPerYear');
    // Ratios are monotonically decreasing.
    expect(top[0]!.ratio).toBeGreaterThanOrEqual(top[1]!.ratio);
    expect(top[1]!.ratio).toBeGreaterThanOrEqual(top[2]!.ratio);
  });

  it('caps the result at 3 even when more resources are utilised', () => {
    const snap = makeSnapshot({
      monthlyEmissionEntries: { used: 100, limit: 1000 },
      reportsPerYear: { used: 1, limit: 12 },
      activitiesActive: { used: 1, limit: 5 },
      teamMembers: { used: 1, limit: 5 },
      storageMb: { used: 50, limit: 1024 },
    });
    expect(topThreeQuotas(snap)).toHaveLength(3);
  });
});

// ── DOM rendering tests — skip-gated until RTL + jsdom land ───────────────
//
// describe.skip block kept as documentation of the intended assertions:
//   - QuotasPage renders one row per AdminQuotaListItem from the API mock
//   - QuotaWidget renders the top-3 rows surfaced by topThreeQuotas
//   - 429 interceptor toast surfaces detail + nextStep CTA
//
// These will become live the moment apps/web pulls in @testing-library/react.

describe.skip('QuotasPage (RTL — gated until jsdom lands)', () => {
  it('renders one row per AdminQuotaListItem from the API mock', () => {
    /* render(<QuotasPage />); ...assert table rows... */
  });
  it('429 interceptor shows toast with upgrade CTA', () => {
    /* mockFetch429 → ToastProvider catches `quotaExceeded` → expect text */
  });
  it('QuotaWidget renders the top-3 rows from useMyQuotas', () => {
    /* render(<QuotaWidget />); ...assert three quota-widget-row-* nodes... */
  });
});
