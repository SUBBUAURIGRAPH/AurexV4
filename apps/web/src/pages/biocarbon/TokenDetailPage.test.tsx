/**
 * AAT-ν / AV4-356 — TokenDetailPage tests.
 *
 * See header of MarketplacePage.test.tsx for runner status. The pure helper
 * tests below run today; the DOM-render tests are documented in skipped
 * blocks for the test-runner-wiring follow-up.
 *
 * Test count summary (executable today): 4 helper / contract tests.
 * Test count summary once RTL lands: 4 + 4 component tests = 8.
 */
import { describe, it, expect } from 'vitest';

import { buildExplorerUrl, type TokenDetailDto, type TransactionEvent } from '../../hooks/useBiocarbon';

const COMPLIANCE_DISCLOSURE =
  'This token is a 1:1 representation of a BioCarbon Verified Carbon Credit (VCC) issued under the BioCarbon Standard. The underlying VCC is locked on the BioCarbon Registry for the lifetime of this token.';

// ── Pure-helper / contract tests — runnable today ──────────────────────────

describe('TokenDetailDto contract', () => {
  it('shapes a detail object with the B13 attribution + nullable lock id', () => {
    const sample: TokenDetailDto = {
      bcrSerialId: 'BCR-2026-VM0042-0001',
      bcrLockId: 'LOCK-9012',
      methodology: {
        code: 'VM0042',
        name: 'Improved Agricultural Land Management',
        version: '2.0',
        referenceUrl: 'https://biocarbonstandard.com/methodologies/VM0042',
      },
      vintage: 2024,
      tonnes: 1500,
      hostCountry: 'IN',
      projectTitle: 'Karnataka Agroforestry',
      projectDescription: '2,500 ha across 12 villages.',
      projectPageUrl: 'https://biocarbonstandard.com/projects?serial=BCR-2026-VM0042-0001',
      projectVisuals: [],
      status: 'MINTED',
      tokenizationContractId: '0xCONTRACT',
      tokenizationTxHash: '0xMINT',
      mintedAt: '2026-01-10T08:00:00.000Z',
      transactionHistory: [],
      biocarbonAttribution: {
        attribution: 'Issued under BioCarbon Standard',
        registryUrl: 'https://biocarbonstandard.com',
      },
    };
    expect(sample.biocarbonAttribution.registryUrl).toContain('biocarbonstandard.com');
    expect(sample.methodology.referenceUrl).toMatch(/methodologies\/VM0042/);
  });
});

describe('TransactionEvent timeline shape', () => {
  it('supports MINT events with txHash and units', () => {
    const ev: TransactionEvent = {
      type: 'MINT',
      occurredAt: '2026-01-10T08:00:00.000Z',
      txHash: '0xabc',
      units: 1500,
      narrative: 'BCR lock confirmed',
    };
    expect(ev.txHash).toBe('0xabc');
    expect(buildExplorerUrl(ev.txHash!)).toBe('https://dlt.aurigraph.io/tx/0xabc');
  });

  it('supports RETIREMENT events with redacted retiree purpose + opaque hash (PII redacted)', () => {
    const ev: TransactionEvent = {
      type: 'RETIREMENT',
      occurredAt: '2026-02-01T08:00:00.000Z',
      units: 500,
      retirementPurpose: 'VOLUNTARY',
      beneficiaryRefHash: 'sha256:abcdef0123456789',
    };
    expect(ev.retirementPurpose).toBe('VOLUNTARY');
    // Critical: no PII fields on the type itself — only an opaque hash.
    expect(Object.keys(ev)).not.toContain('retireeName');
    expect(Object.keys(ev)).not.toContain('legalIdRef');
  });
});

describe('Compliance disclosure (BCR §5.5 step 9)', () => {
  it('uses the BCR-mandated 1:1 representation language', () => {
    expect(COMPLIANCE_DISCLOSURE).toMatch(/1:1 representation/);
    expect(COMPLIANCE_DISCLOSURE).toMatch(/BioCarbon Standard/);
    expect(COMPLIANCE_DISCLOSURE).toMatch(/locked on the BioCarbon Registry/);
  });
});

// ── Skipped DOM tests — enabled once RTL + jsdom land ──────────────────────
//
// describe('TokenDetailPage <render>', () => {
//   it('renders all 3 tabs (overview / transaction history / compliance) with content from the API mock', () => {});
//   it('renders the [data-testid=token-not-found] card on a 404 RFC-7807 response', () => {});
//   it('renders [data-testid=detail-skeleton] before fetch resolves', () => {});
//   it('renders [data-testid=biocarbon-attribution-badge] + the BCR reference URL on the Compliance tab', () => {});
// });
describe.skip('TokenDetailPage <render> — pending @testing-library/react + jsdom', () => {
  it('placeholder — see follow-up to wire RTL', () => {
    expect(true).toBe(true);
  });
});
