import { describe, it, expect } from 'vitest';
import { calculateLevies, SOP_RATE, OMGE_RATE } from './issuance.service.js';

describe('issuance.service — SOP + OMGE levy math', () => {
  it('rates are 5% SOP + 2% OMGE (ADM compliance)', () => {
    expect(SOP_RATE).toBe(0.05);
    expect(OMGE_RATE).toBe(0.02);
  });

  it('1000 tCO2e → 50 SOP + 20 OMGE + 930 net', () => {
    const r = calculateLevies(1000);
    expect(r.gross).toBe(1000);
    expect(r.sop).toBe(50);
    expect(r.omge).toBe(20);
    expect(r.net).toBe(930);
  });

  it('handles 0 gross', () => {
    const r = calculateLevies(0);
    expect(r).toEqual({ gross: 0, sop: 0, omge: 0, net: 0 });
  });

  it('100 tCO2e → 5 SOP + 2 OMGE + 93 net', () => {
    const r = calculateLevies(100);
    expect(r).toEqual({ gross: 100, sop: 5, omge: 2, net: 93 });
  });

  it('rounds fractional inputs down (registry = whole tCO2e only)', () => {
    const r = calculateLevies(1000.9);
    expect(r.gross).toBe(1000);
    expect(r.sop + r.omge + r.net).toBe(1000);
  });

  it('levy rounding is conservative — sum equals gross (no drift)', () => {
    for (const g of [1, 7, 13, 99, 333, 1234, 9997, 100_000, 12_345_678]) {
      const r = calculateLevies(g);
      expect(r.sop + r.omge + r.net).toBe(r.gross);
      expect(r.sop).toBeLessThanOrEqual(Math.ceil(g * SOP_RATE));
      expect(r.omge).toBeLessThanOrEqual(Math.ceil(g * OMGE_RATE));
    }
  });

  it('rejects negative or non-finite gross', () => {
    expect(() => calculateLevies(-1)).toThrow();
    expect(() => calculateLevies(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => calculateLevies(Number.NaN)).toThrow();
  });

  it('small values — 19 tCO2e → 0 SOP + 0 OMGE + 19 net (floor drops sub-unit levies)', () => {
    const r = calculateLevies(19);
    // 19 × 0.05 = 0.95 → floor 0; 19 × 0.02 = 0.38 → floor 0
    expect(r.sop).toBe(0);
    expect(r.omge).toBe(0);
    expect(r.net).toBe(19);
  });

  it('boundary — 20 tCO2e → 1 SOP + 0 OMGE + 19 net', () => {
    // 20 × 0.05 = 1.0; 20 × 0.02 = 0.4 → floor 0
    const r = calculateLevies(20);
    expect(r.sop).toBe(1);
    expect(r.omge).toBe(0);
    expect(r.net).toBe(19);
  });
});
