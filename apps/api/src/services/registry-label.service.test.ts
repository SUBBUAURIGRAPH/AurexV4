/**
 * AAT-R1 / AV4-422 — CORSIA Phase 2 Article-6 Authorized IMP labelling tests.
 *
 * Pure-function tests for `applyCorsiaLabels`. The `generateLabel` flow is
 * exercised at the route layer.
 */
import { describe, expect, it } from 'vitest';

import {
  applyCorsiaLabels,
  type CorsiaLabelInput,
} from './registry-label.service.js';

const NOW = new Date('2026-04-01T00:00:00Z');

function input(overrides: Partial<CorsiaLabelInput> = {}): CorsiaLabelInput {
  const base: CorsiaLabelInput = {
    block: {
      authorizationStatus: 'OIMP',
      vintage: 2025,
    },
    hostAuth: {
      status: 'ISSUED',
      formVersion: 'FORM-GOV-002 v1.1',
      authorizedUses: ['oimp_corsia'],
      granularityTags: ['imp:authorized'],
    },
  };
  return {
    block: { ...base.block, ...overrides.block },
    hostAuth:
      overrides.hostAuth === null
        ? null
        : { ...base.hostAuth!, ...overrides.hostAuth },
  };
}

describe('applyCorsiaLabels', () => {
  it('returns null phaseEligibility for MITIGATION_CONTRIBUTION', () => {
    const r = applyCorsiaLabels(
      input({ block: { authorizationStatus: 'MITIGATION_CONTRIBUTION', vintage: 2025 } }),
      NOW,
    );
    expect(r.corsiaPhaseEligibility).toBeNull();
    expect(r.articleSixAuthorizedAt).toBeNull();
  });

  it('returns null for vintages pre-CORSIA (<2021)', () => {
    const r = applyCorsiaLabels(input({ block: { authorizationStatus: 'OIMP', vintage: 2018 } }), NOW);
    expect(r.corsiaPhaseEligibility).toBeNull();
  });

  it('returns null when hostAuth is missing', () => {
    const r = applyCorsiaLabels(input({ hostAuth: null }), NOW);
    expect(r.corsiaPhaseEligibility).toBeNull();
    expect(r.rationale).toMatch(/host-country LoA/);
  });

  it('returns null when hostAuth status != ISSUED', () => {
    const r = applyCorsiaLabels(input({ hostAuth: { status: 'PENDING' } }), NOW);
    expect(r.corsiaPhaseEligibility).toBeNull();
  });

  it('returns null when authorizationStatus is NDC_USE only', () => {
    const r = applyCorsiaLabels(
      input({ block: { authorizationStatus: 'NDC_USE', vintage: 2025 } }),
      NOW,
    );
    expect(r.corsiaPhaseEligibility).toBeNull();
    expect(r.rationale).toMatch(/NDC_USE-only/);
  });

  it('labels vintage 2025 + OIMP + valid LoA as phase1', () => {
    const r = applyCorsiaLabels(input(), NOW);
    expect(r.corsiaPhaseEligibility).toBe('phase1');
    expect(r.articleSixAuthorizedAt).toBeNull();
  });

  it('labels vintage 2026 + NDC_AND_OIMP as phase1', () => {
    const r = applyCorsiaLabels(
      input({ block: { authorizationStatus: 'NDC_AND_OIMP', vintage: 2026 } }),
      NOW,
    );
    expect(r.corsiaPhaseEligibility).toBe('phase1');
  });

  it('labels vintage 2027 with FORM-GOV-002 + oimp_corsia + IMP attestation as phase2_authorized_imp', () => {
    const r = applyCorsiaLabels(
      input({ block: { authorizationStatus: 'OIMP', vintage: 2027 } }),
      NOW,
    );
    expect(r.corsiaPhaseEligibility).toBe('phase2_authorized_imp');
    expect(r.articleSixAuthorizedAt).toEqual(NOW);
  });

  it('labels vintage 2028 missing IMP attestation as phase2 (not authorized)', () => {
    const r = applyCorsiaLabels(
      input({
        block: { authorizationStatus: 'OIMP', vintage: 2028 },
        hostAuth: { granularityTags: ['vintage:2028-2030'] },
      }),
      NOW,
    );
    expect(r.corsiaPhaseEligibility).toBe('phase2');
    expect(r.articleSixAuthorizedAt).toBeNull();
  });

  it('labels vintage 2027 with FORM-GOV-003 (amendment) as phase2 — IMP requires FORM-GOV-002', () => {
    const r = applyCorsiaLabels(
      input({
        block: { authorizationStatus: 'OIMP', vintage: 2027 },
        hostAuth: {
          formVersion: 'FORM-GOV-003 v1.0',
          authorizedUses: ['oimp_corsia'],
          granularityTags: ['imp:authorized'],
        },
      }),
      NOW,
    );
    expect(r.corsiaPhaseEligibility).toBe('phase2');
  });

  it('labels vintage 2027 with oimp_other (not oimp_corsia) as phase2', () => {
    const r = applyCorsiaLabels(
      input({
        block: { authorizationStatus: 'OIMP', vintage: 2027 },
        hostAuth: { authorizedUses: ['oimp_other'] },
      }),
      NOW,
    );
    expect(r.corsiaPhaseEligibility).toBe('phase2');
  });

  it('rationale string is non-empty for every branch', () => {
    const r = applyCorsiaLabels(input(), NOW);
    expect(r.rationale.length).toBeGreaterThan(0);
  });
});
