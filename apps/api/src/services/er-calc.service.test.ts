import { describe, it, expect } from 'vitest';
import { calculateEr } from './er-calc.service.js';

describe('er-calc.service', () => {
  it('ER = baseline − project − leakage for simple case', () => {
    const r = calculateEr({ baselineEmissions: 10_000, projectEmissions: 2_000, leakageEmissions: 500 });
    expect(r.grossEr).toBe(7_500);
    expect(r.netEr).toBe(7_500);
    expect(r.conservativenessDiscount).toBe(0);
  });

  it('applies conservativeness discount correctly', () => {
    const r = calculateEr({
      baselineEmissions: 10_000,
      projectEmissions: 2_000,
      leakageEmissions: 500,
      conservativenessPct: 10,
    });
    expect(r.grossEr).toBe(7_500);
    expect(r.conservativenessDiscount).toBeCloseTo(750, 3);
    expect(r.netEr).toBe(6_750);
  });

  it('rounds down to whole tCO2e (registry requires integer units)', () => {
    const r = calculateEr({ baselineEmissions: 100.9, projectEmissions: 0, leakageEmissions: 0 });
    expect(r.grossEr).toBeCloseTo(100.9, 3);
    expect(r.netEr).toBe(100); // floored
  });

  it('returns 0 when project exceeds baseline (no negative ER)', () => {
    const r = calculateEr({ baselineEmissions: 1_000, projectEmissions: 1_200, leakageEmissions: 0 });
    expect(r.grossEr).toBe(0);
    expect(r.netEr).toBe(0);
  });

  it('rejects negative inputs', () => {
    expect(() => calculateEr({ baselineEmissions: -1, projectEmissions: 0, leakageEmissions: 0 })).toThrow();
  });

  it('rejects out-of-range conservativeness', () => {
    expect(() =>
      calculateEr({ baselineEmissions: 100, projectEmissions: 0, leakageEmissions: 0, conservativenessPct: 150 }),
    ).toThrow();
  });

  it('labels formula for removal activities', () => {
    const r = calculateEr({
      baselineEmissions: 5_000,
      projectEmissions: 1_000,
      leakageEmissions: 100,
      isRemoval: true,
    });
    expect(r.formula).toContain('RR');
    expect(r.netEr).toBe(3_900);
  });
});
