import { describe, it, expect } from 'vitest';
import {
  calculateLevies,
  SOP_RATE,
  OMGE_RATE,
  splitNetForBuffer,
  DEFAULT_BUFFER_PCT,
} from './issuance.service.js';

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

describe('issuance.service — removal buffer deposit math (AV4-330)', () => {
  it('default buffer pct is 20% (SB guidance — removals)', () => {
    expect(DEFAULT_BUFFER_PCT).toBe(20);
  });

  it('removal net=1000, pct=20 → participant=800, buffer=200', () => {
    const r = splitNetForBuffer(1000, 20);
    expect(r.participantUnits).toBe(800);
    expect(r.bufferUnits).toBe(200);
    expect(r.participantUnits + r.bufferUnits).toBe(1000);
  });

  it('pct=0 → all to participant, buffer=0', () => {
    const r = splitNetForBuffer(1000, 0);
    expect(r.participantUnits).toBe(1000);
    expect(r.bufferUnits).toBe(0);
  });

  it('pct=100 → all to buffer, participant=0', () => {
    const r = splitNetForBuffer(1000, 100);
    expect(r.participantUnits).toBe(0);
    expect(r.bufferUnits).toBe(1000);
  });

  it('rounding — buffer floored, participant absorbs residue', () => {
    // 137 × 0.20 = 27.4 → floor 27 buffer; 137 − 27 = 110 participant
    const r = splitNetForBuffer(137, 20);
    expect(r.bufferUnits).toBe(27);
    expect(r.participantUnits).toBe(110);
    expect(r.bufferUnits + r.participantUnits).toBe(137);
  });

  it('rejects out-of-range pct', () => {
    expect(() => splitNetForBuffer(100, -1)).toThrow();
    expect(() => splitNetForBuffer(100, 101)).toThrow();
    expect(() => splitNetForBuffer(100, Number.NaN)).toThrow();
  });

  it('rejects negative net', () => {
    expect(() => splitNetForBuffer(-1, 20)).toThrow();
    expect(() => splitNetForBuffer(Number.POSITIVE_INFINITY, 20)).toThrow();
  });

  it('zero net → zero buffer, zero participant', () => {
    const r = splitNetForBuffer(0, 20);
    expect(r.participantUnits).toBe(0);
    expect(r.bufferUnits).toBe(0);
  });
});
