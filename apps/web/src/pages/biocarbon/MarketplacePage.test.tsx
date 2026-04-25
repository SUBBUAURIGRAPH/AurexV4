/**
 * AAT-ν / AV4-356 — MarketplacePage tests.
 *
 * Runner status:
 *   - vitest: installed (works today)
 *   - @testing-library/react / @testing-library/jest-dom / jsdom: NOT yet
 *     listed in apps/web/package.json — these are required for the
 *     full-component render assertions below.
 *
 * Strategy:
 *   The pure-helper tests in this file run today against the public surface
 *   of `hooks/useBiocarbon.ts`. The DOM-rendering tests live next to them
 *   inside `describe.skip(...)` so the runner stays green; once RTL + jsdom
 *   are added (follow-up Jira) the `.skip` is dropped and they become
 *   live. To avoid breaking `pnpm --filter @aurex/web typecheck` while RTL
 *   is absent, the DOM tests are described as comments rather than
 *   imported code — they document intent and will be enabled in the
 *   test-runner-wiring follow-up commit.
 *
 * Test count summary (executable today): 5 helper tests.
 * Test count summary once RTL lands: 5 + 5 component tests = 10.
 */
import { describe, it, expect } from 'vitest';

import {
  BCR_METHODOLOGIES,
  STATUS_OPTIONS,
  buildExplorerUrl,
  type ListingDto,
  type PublicListingStatus,
} from '../../hooks/useBiocarbon';

// ── Pure-helper tests — runnable today ─────────────────────────────────────

describe('BCR_METHODOLOGIES', () => {
  it('mirrors the 6 backend-seeded BCR methodologies', () => {
    expect(BCR_METHODOLOGIES).toHaveLength(6);
    const codes = BCR_METHODOLOGIES.map((m) => m.code).sort();
    expect(codes).toEqual(
      ['AR-AMS0001', 'AR-AMS0003', 'AR-AMS0007', 'VM0007', 'VM0033', 'VM0042'].sort(),
    );
  });

  it('every entry has a non-empty label so the dropdown reads cleanly', () => {
    for (const m of BCR_METHODOLOGIES) {
      expect(m.label.length).toBeGreaterThan(m.code.length);
    }
  });
});

describe('STATUS_OPTIONS', () => {
  it('exposes exactly the three public listing statuses', () => {
    const values = STATUS_OPTIONS.map((s) => s.value).sort();
    const expected: PublicListingStatus[] = ['DELISTED_IN_FLIGHT', 'MINTED', 'RETIRED'];
    expect(values).toEqual(expected.sort());
  });
});

describe('buildExplorerUrl', () => {
  it('builds the default Aurigraph DLT explorer URL for a tx hash', () => {
    expect(buildExplorerUrl('0xdeadbeef')).toBe('https://dlt.aurigraph.io/tx/0xdeadbeef');
  });
});

describe('ListingDto contract', () => {
  it('shapes a listing with the B13 attribution + project page url', () => {
    const sample: ListingDto = {
      bcrSerialId: 'BCR-2026-VM0042-0001',
      projectTitle: 'Karnataka Agroforestry Plot 1',
      projectVisual: undefined,
      projectPageUrl: 'https://biocarbonstandard.com/projects?serial=BCR-2026-VM0042-0001',
      methodologyCode: 'VM0042',
      vintage: 2024,
      tonnes: 1500,
      status: 'MINTED',
      hostCountry: 'IN',
      biocarbonAttribution: {
        attribution: 'Issued under BioCarbon Standard',
        registryUrl: 'https://biocarbonstandard.com',
      },
    };
    expect(sample.biocarbonAttribution.registryUrl).toMatch(/biocarbonstandard\.com/);
    expect(sample.projectPageUrl).toContain('biocarbonstandard.com');
  });
});

// ── Skipped DOM tests — enabled once RTL + jsdom land ──────────────────────
//
// These are intentionally NOT imported so this file type-checks while RTL
// is absent. The expected behaviour is documented inline so the follow-up
// PR knows exactly what to wire up.
//
// describe('MarketplacePage <render>', () => {
//   it('renders cards from API mock', /* mock fetch -> 3 listings, expect 3 [data-testid=marketplace-card] */ () => {});
//   it('triggers a re-fetch with methodologyCode=VM0042 when the dropdown changes (debounced 300ms)', () => {});
//   it('renders [data-testid=marketplace-empty] when total=0', () => {});
//   it('navigates to /biocarbon/tokens/<serial> when a card is clicked (useNavigate spy)', () => {});
//   it('renders one [data-testid=biocarbon-attribution-badge] per card (B13 binding)', () => {});
// });
describe.skip('MarketplacePage <render> — pending @testing-library/react + jsdom', () => {
  it('placeholder — see follow-up to wire RTL', () => {
    expect(true).toBe(true);
  });
});
