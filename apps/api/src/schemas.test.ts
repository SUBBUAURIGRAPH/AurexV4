import { describe, it, expect } from 'vitest';
import {
  createBaselineSchema,
  updateBaselineSchema,
  createTargetSchema,
  updateTargetSchema,
  recordProgressSchema,
  generateReportSchema,
} from '@aurex/shared';

describe('createBaselineSchema', () => {
  it('accepts a minimal valid payload', () => {
    const parsed = createBaselineSchema.parse({
      name: '2020 Baseline',
      scope: 'SCOPE_1',
      baseYear: 2020,
      value: 1234.5,
    });
    expect(parsed.unit).toBe('tCO2e');
    expect(parsed.isActive).toBe(true);
  });

  it('rejects an invalid scope', () => {
    expect(() =>
      createBaselineSchema.parse({
        name: 'x',
        scope: 'scope_1',
        baseYear: 2020,
        value: 1,
      }),
    ).toThrow();
  });

  it('rejects a non-positive value', () => {
    expect(() =>
      createBaselineSchema.parse({
        name: 'x',
        scope: 'SCOPE_1',
        baseYear: 2020,
        value: 0,
      }),
    ).toThrow();
  });

  it('rejects a baseYear outside [1990, 2050]', () => {
    expect(() =>
      createBaselineSchema.parse({
        name: 'x',
        scope: 'SCOPE_1',
        baseYear: 1989,
        value: 1,
      }),
    ).toThrow();
  });
});

describe('updateBaselineSchema', () => {
  it('accepts an empty partial update', () => {
    const parsed = updateBaselineSchema.parse({});
    expect(parsed).toEqual({});
  });

  it('accepts a single-field update', () => {
    const parsed = updateBaselineSchema.parse({ value: 42 });
    expect(parsed.value).toBe(42);
  });
});

describe('createTargetSchema', () => {
  it('accepts a valid payload without pathway', () => {
    const parsed = createTargetSchema.parse({
      name: 'Net Zero 2030',
      scope: 'SCOPE_2',
      targetYear: 2030,
      reduction: 50,
    });
    expect(parsed.pathway).toBeUndefined();
  });

  it('accepts each pathway enum value', () => {
    for (const pathway of ['CELSIUS_1_5', 'WELL_BELOW_2', 'CELSIUS_2'] as const) {
      expect(() =>
        createTargetSchema.parse({
          name: 'x',
          scope: 'SCOPE_1',
          targetYear: 2030,
          reduction: 25,
          pathway,
        }),
      ).not.toThrow();
    }
  });

  it('rejects reduction > 100', () => {
    expect(() =>
      createTargetSchema.parse({
        name: 'x',
        scope: 'SCOPE_1',
        targetYear: 2030,
        reduction: 101,
      }),
    ).toThrow();
  });

  it('rejects a past-century targetYear', () => {
    expect(() =>
      createTargetSchema.parse({
        name: 'x',
        scope: 'SCOPE_1',
        targetYear: 2019,
        reduction: 25,
      }),
    ).toThrow();
  });
});

describe('updateTargetSchema', () => {
  it('allows setting pathway to null', () => {
    const parsed = updateTargetSchema.parse({ pathway: null });
    expect(parsed.pathway).toBeNull();
  });
});

describe('recordProgressSchema', () => {
  it('accepts actual-only progress', () => {
    const parsed = recordProgressSchema.parse({ year: 2025, actual: 800 });
    expect(parsed.projected).toBeUndefined();
  });

  it('accepts actual + projected', () => {
    const parsed = recordProgressSchema.parse({ year: 2025, actual: 800, projected: 750 });
    expect(parsed.projected).toBe(750);
  });
});

describe('generateReportSchema', () => {
  it('accepts a valid GHG request', () => {
    const parsed = generateReportSchema.parse({
      type: 'ghg',
      year: 2025,
      scopes: ['SCOPE_1', 'SCOPE_2'],
    });
    expect(parsed.scopes).toHaveLength(2);
  });

  it('rejects empty scopes array', () => {
    expect(() =>
      generateReportSchema.parse({
        type: 'ghg',
        year: 2025,
        scopes: [],
      }),
    ).toThrow();
  });

  it('rejects an unknown report type', () => {
    expect(() =>
      generateReportSchema.parse({
        type: 'xbrl',
        year: 2025,
        scopes: ['SCOPE_1'],
      }),
    ).toThrow();
  });
});
