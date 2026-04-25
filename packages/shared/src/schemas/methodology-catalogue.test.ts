import { describe, it, expect } from 'vitest';
import {
  methodologyCatalogueEntrySchema,
  methodologyCatalogueResponseSchema,
  METHODOLOGY_CATEGORIES,
  type MethodologyCatalogueEntry,
} from './methodology-catalogue.js';

const validEntry: MethodologyCatalogueEntry = {
  code: 'VM0042',
  version: '2.0',
  name: 'Methodology for improved agricultural land management',
  category: 'BCR',
  isBcrEligible: true,
  isA64Eligible: false,
  referenceUrl:
    'https://verra.org/methodologies/vm0042-methodology-for-improved-agricultural-land-management/',
  gases: ['CO2', 'N2O'],
  sectoralScope: 14,
  effectiveFrom: '2023-09-26T00:00:00.000Z',
  effectiveUntil: null,
  notes: null,
};

describe('methodologyCatalogueEntrySchema', () => {
  it('parses a fully-populated valid entry', () => {
    const parsed = methodologyCatalogueEntrySchema.parse(validEntry);
    expect(parsed.code).toBe('VM0042');
    expect(parsed.gases).toEqual(['CO2', 'N2O']);
    expect(parsed.sectoralScope).toBe(14);
  });

  it('rejects sectoralScope outside 1..15', () => {
    expect(
      methodologyCatalogueEntrySchema.safeParse({
        ...validEntry,
        sectoralScope: 0,
      }).success,
    ).toBe(false);
    expect(
      methodologyCatalogueEntrySchema.safeParse({
        ...validEntry,
        sectoralScope: 16,
      }).success,
    ).toBe(false);
    expect(
      methodologyCatalogueEntrySchema.safeParse({
        ...validEntry,
        sectoralScope: 1,
      }).success,
    ).toBe(true);
    expect(
      methodologyCatalogueEntrySchema.safeParse({
        ...validEntry,
        sectoralScope: 15,
      }).success,
    ).toBe(true);
  });

  it('rejects effectiveUntil earlier than effectiveFrom', () => {
    const result = methodologyCatalogueEntrySchema.safeParse({
      ...validEntry,
      effectiveFrom: '2024-01-01T00:00:00.000Z',
      effectiveUntil: '2023-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join('.') === 'effectiveUntil'),
      ).toBe(true);
    }
  });

  it('accepts effectiveUntil equal to or after effectiveFrom', () => {
    expect(
      methodologyCatalogueEntrySchema.safeParse({
        ...validEntry,
        effectiveFrom: '2024-01-01T00:00:00.000Z',
        effectiveUntil: '2024-01-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      methodologyCatalogueEntrySchema.safeParse({
        ...validEntry,
        effectiveFrom: '2024-01-01T00:00:00.000Z',
        effectiveUntil: '2025-01-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('accepts forward-compatible custom category strings', () => {
    // Aurex emits A6_4 / BCR / VOLUNTARY_OTHER, but the schema is opaque.
    expect(
      methodologyCatalogueEntrySchema.safeParse({
        ...validEntry,
        category: 'FUTURE_REGISTRY_X',
      }).success,
    ).toBe(true);
    for (const c of METHODOLOGY_CATEGORIES) {
      expect(
        methodologyCatalogueEntrySchema.safeParse({ ...validEntry, category: c })
          .success,
      ).toBe(true);
    }
  });

  it('rejects malformed referenceUrl', () => {
    const result = methodologyCatalogueEntrySchema.safeParse({
      ...validEntry,
      referenceUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

describe('methodologyCatalogueResponseSchema', () => {
  it('parses a complete response envelope', () => {
    const parsed = methodologyCatalogueResponseSchema.parse({
      entries: [validEntry],
      etag: 'a'.repeat(64),
      generatedAt: '2026-04-25T00:00:00.000Z',
    });
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.etag).toHaveLength(64);
  });

  it('rejects an envelope missing etag', () => {
    const result = methodologyCatalogueResponseSchema.safeParse({
      entries: [validEntry],
      generatedAt: '2026-04-25T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});
