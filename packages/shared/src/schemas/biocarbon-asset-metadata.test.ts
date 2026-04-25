import { describe, it, expect } from 'vitest';
import {
  biocarbonAssetMetadataSchema,
  assertMetadataImmutable,
  hashBcrSerialId,
  POST_MINT_MUTABLE_FIELDS,
  type BioCarbonAssetMetadata,
} from './biocarbon-asset-metadata.js';

const validMetadata: BioCarbonAssetMetadata = {
  bcrSerialId: 'BCR-IND-2024-AR-VM0042-V1-0001',
  bcrSerialIdHash: '0x' + 'a'.repeat(64),
  bcrProjectId: 'BCR-PROJ-12345',
  projectTitle: 'Mangrove Restoration — Sundarbans',
  projectPageUrl: 'https://registry.biocarbon.example/projects/12345',
  methodologyCode: 'VM0042',
  methodologyVersion: '2.0',
  vintage: 2024,
  hostCountry: 'IN',
  grossUnits: 1000,
  sopUnits: 50,
  omgeUnits: 20,
  netUnits: 930,
  aurexActivityId: '11111111-1111-4111-8111-111111111111',
  aurexIssuanceId: '22222222-2222-4222-8222-222222222222',
};

describe('biocarbonAssetMetadataSchema', () => {
  it('parses fully-populated valid metadata cleanly', () => {
    const parsed = biocarbonAssetMetadataSchema.parse(validMetadata);
    expect(parsed.bcrSerialId).toBe(validMetadata.bcrSerialId);
    expect(parsed.netUnits).toBe(930);
    expect(parsed.hostCountry).toBe('IN');
  });

  it('rejects payload missing a required field (bcrSerialId)', () => {
    const { bcrSerialId: _omit, ...incomplete } = validMetadata;
    void _omit;
    const result = biocarbonAssetMetadataSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('bcrSerialId');
    }
  });

  it('rejects a host-country code that is not ISO-3166 alpha-2 length', () => {
    const result = biocarbonAssetMetadataSchema.safeParse({
      ...validMetadata,
      hostCountry: 'IND',
    });
    expect(result.success).toBe(false);
  });

  it('rejects vintages outside [2000, 2100]', () => {
    expect(
      biocarbonAssetMetadataSchema.safeParse({ ...validMetadata, vintage: 1999 }).success,
    ).toBe(false);
    expect(
      biocarbonAssetMetadataSchema.safeParse({ ...validMetadata, vintage: 2101 }).success,
    ).toBe(false);
    expect(
      biocarbonAssetMetadataSchema.safeParse({ ...validMetadata, vintage: 2024 }).success,
    ).toBe(true);
  });

  it('rejects a malformed bcrSerialIdHash (wrong shape / non-hex)', () => {
    expect(
      biocarbonAssetMetadataSchema.safeParse({
        ...validMetadata,
        bcrSerialIdHash: '0xZZ',
      }).success,
    ).toBe(false);
  });
});

describe('assertMetadataImmutable', () => {
  it('allows retirement fields to transition from undefined → set', () => {
    const next: BioCarbonAssetMetadata = {
      ...validMetadata,
      retiredAt: '2026-04-24T12:00:00.000Z',
      retiredFor: 'Acme Corp 2025 Net-Zero claim',
      retiredBy: 'Acme Corp Sustainability Office',
      retirementPurpose: 'VOLUNTARY',
    };
    expect(() => assertMetadataImmutable(validMetadata, next)).not.toThrow();
  });

  it('throws when an immutable field changes (bcrSerialId)', () => {
    const tampered: BioCarbonAssetMetadata = {
      ...validMetadata,
      bcrSerialId: 'BCR-XXX-2099-FAKE-0001',
    };
    expect(() => assertMetadataImmutable(validMetadata, tampered)).toThrow(
      /immutability violation.*bcrSerialId/,
    );
  });

  it('throws when a numeric immutable field changes (netUnits)', () => {
    const tampered: BioCarbonAssetMetadata = { ...validMetadata, netUnits: 999_999 };
    expect(() => assertMetadataImmutable(validMetadata, tampered)).toThrow(
      /immutability violation.*netUnits/,
    );
  });

  it('exposes the four expected post-mint mutable fields', () => {
    expect([...POST_MINT_MUTABLE_FIELDS].sort()).toEqual(
      ['retiredAt', 'retiredBy', 'retiredFor', 'retirementPurpose'].sort(),
    );
  });
});

describe('hashBcrSerialId', () => {
  it('returns deterministic 0x-prefixed 64-hex SHA-256 of the input', async () => {
    const id = 'BCR-IND-2024-AR-VM0042-V1-0001';
    const a = await hashBcrSerialId(id);
    const b = await hashBcrSerialId(id);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('produces different digests for different serial IDs', async () => {
    const a = await hashBcrSerialId('BCR-IND-2024-AR-VM0042-V1-0001');
    const b = await hashBcrSerialId('BCR-IND-2024-AR-VM0042-V1-0002');
    expect(a).not.toBe(b);
  });
});
