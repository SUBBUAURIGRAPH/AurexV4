import { describe, it, expect } from 'vitest';
import {
  biocarbonRetirementPayloadSchema,
  buildBcrPassthroughPayload,
  verifyRetirementCompleteness,
  MissingKycError,
  MissingBeneficiaryFieldsError,
  WholeTonViolationError,
  type BiocarbonRetirementPayload,
} from './biocarbon-retirement-payload.js';

const VALID_KYC = '11111111-1111-4111-8111-111111111111';
const VALID_USER = '22222222-2222-4222-8222-222222222222';
const VALID_ORG = '33333333-3333-4333-8333-333333333333';

const validPayload: BiocarbonRetirementPayload = {
  bcrSerialId: 'BCR-IND-2024-AR-VM0042-V1-0001',
  tonnesRetired: 100,
  vintage: 2024,
  purpose: 'CSR',
  retiredFor: {
    name: 'Acme Corporation',
    legalIdRef: 'AAACA1234N',
    jurisdiction: 'IN-PAN',
    orgRef: 'org-acme-1',
  },
  retiredBy: {
    userId: VALID_USER,
    orgId: VALID_ORG,
    role: 'sustainability_admin',
  },
  kycVerificationId: VALID_KYC,
  retirementCertificateUrl:
    'https://aurex.in/retirements/BCR-IND-2024-AR-VM0042-V1-0001.pdf',
};

describe('biocarbonRetirementPayloadSchema — happy path', () => {
  it('parses a fully-populated valid payload cleanly', () => {
    const parsed = biocarbonRetirementPayloadSchema.parse(validPayload);
    expect(parsed.bcrSerialId).toBe('BCR-IND-2024-AR-VM0042-V1-0001');
    expect(parsed.tonnesRetired).toBe(100);
    expect(parsed.purpose).toBe('CSR');
    expect(parsed.retiredFor.name).toBe('Acme Corporation');
    expect(parsed.retiredBy.userId).toBe(VALID_USER);
  });

  it('parses without optional fields (jurisdiction, legalIdRef, orgRef, certificateUrl)', () => {
    const minimal = {
      ...validPayload,
      retiredFor: { name: 'Solo Beneficiary' },
      retirementCertificateUrl: undefined,
    };
    const parsed = biocarbonRetirementPayloadSchema.parse(minimal);
    expect(parsed.retiredFor.name).toBe('Solo Beneficiary');
    expect(parsed.retiredFor.legalIdRef).toBeUndefined();
  });
});

describe('biocarbonRetirementPayloadSchema — whole-ton (B11)', () => {
  it('rejects a sub-ton retirement (fractional value)', () => {
    const result = biocarbonRetirementPayloadSchema.safeParse({
      ...validPayload,
      tonnesRetired: 0.5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('tonnesRetired');
    }
  });

  it('rejects a zero-ton retirement', () => {
    const result = biocarbonRetirementPayloadSchema.safeParse({
      ...validPayload,
      tonnesRetired: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative retirement', () => {
    const result = biocarbonRetirementPayloadSchema.safeParse({
      ...validPayload,
      tonnesRetired: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('biocarbonRetirementPayloadSchema — KYC verification id', () => {
  it('rejects a payload missing kycVerificationId', () => {
    const { kycVerificationId: _omit, ...rest } = validPayload;
    void _omit;
    const result = biocarbonRetirementPayloadSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('kycVerificationId');
    }
  });

  it('rejects a payload with a non-UUID kycVerificationId', () => {
    const result = biocarbonRetirementPayloadSchema.safeParse({
      ...validPayload,
      kycVerificationId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('biocarbonRetirementPayloadSchema — purpose narrative refine', () => {
  it('rejects purpose=OTHER without a narrative', () => {
    const result = biocarbonRetirementPayloadSchema.safeParse({
      ...validPayload,
      purpose: 'OTHER',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('purposeNarrative');
    }
  });

  it('accepts purpose=OTHER when a narrative is provided', () => {
    const result = biocarbonRetirementPayloadSchema.safeParse({
      ...validPayload,
      purpose: 'OTHER',
      purposeNarrative:
        'Retired against a community initiative not covered by the standard categories.',
    });
    expect(result.success).toBe(true);
  });
});

describe('biocarbonRetirementPayloadSchema — beneficiary refine', () => {
  it('rejects retiredFor with legalIdRef but no jurisdiction', () => {
    const result = biocarbonRetirementPayloadSchema.safeParse({
      ...validPayload,
      retiredFor: {
        name: 'Acme Corporation',
        legalIdRef: 'AAACA1234N',
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      // Refine targets the jurisdiction path inside the beneficiary object.
      expect(paths.some((p) => p.includes('jurisdiction'))).toBe(true);
    }
  });

  it('rejects retiredFor missing name', () => {
    const result = biocarbonRetirementPayloadSchema.safeParse({
      ...validPayload,
      retiredFor: { jurisdiction: 'IN-PAN' },
    });
    expect(result.success).toBe(false);
  });
});

describe('buildBcrPassthroughPayload', () => {
  it('produces exactly the §5.5 step-14–15 shape', () => {
    const passthrough = buildBcrPassthroughPayload(validPayload);

    // Shape must be exactly { vintage, amount, purpose, beneficiary }.
    expect(Object.keys(passthrough).sort()).toEqual([
      'amount',
      'beneficiary',
      'purpose',
      'vintage',
    ]);
    expect(passthrough.vintage).toBe(2024);
    expect(passthrough.amount).toBe(100);
    expect(passthrough.purpose).toBe('CSR');
    expect(passthrough.beneficiary.name).toBe('Acme Corporation');
    expect(passthrough.beneficiary.legalIdRef).toBe('AAACA1234N');
    expect(passthrough.beneficiary.jurisdiction).toBe('IN-PAN');
  });

  it('uses the narrative as purpose when purpose === "OTHER"', () => {
    const payload: BiocarbonRetirementPayload = {
      ...validPayload,
      purpose: 'OTHER',
      purposeNarrative: 'Decommissioning of legacy diesel pump fleet, FY26',
    };
    const passthrough = buildBcrPassthroughPayload(payload);
    expect(passthrough.purpose).toBe(
      'Decommissioning of legacy diesel pump fleet, FY26',
    );
  });
});

describe('verifyRetirementCompleteness', () => {
  it('passes silently for a valid payload', () => {
    expect(() => verifyRetirementCompleteness(validPayload)).not.toThrow();
  });

  it('throws WholeTonViolationError for sub-ton tonnesRetired', () => {
    expect(() =>
      verifyRetirementCompleteness({
        ...validPayload,
        tonnesRetired: 0.7,
      }),
    ).toThrow(WholeTonViolationError);
  });

  it('throws WholeTonViolationError for zero tonnesRetired', () => {
    expect(() =>
      verifyRetirementCompleteness({
        ...validPayload,
        tonnesRetired: 0,
      }),
    ).toThrow(WholeTonViolationError);
  });

  it('throws MissingKycError when kycVerificationId is absent', () => {
    const { kycVerificationId: _omit, ...rest } = validPayload;
    void _omit;
    expect(() => verifyRetirementCompleteness(rest)).toThrow(MissingKycError);
  });

  it('throws MissingBeneficiaryFieldsError when retiredFor.name is missing', () => {
    expect(() =>
      verifyRetirementCompleteness({
        ...validPayload,
        retiredFor: { name: '' },
      }),
    ).toThrow(MissingBeneficiaryFieldsError);
  });

  it('throws MissingBeneficiaryFieldsError when retiredFor block is missing entirely', () => {
    const { retiredFor: _omit, ...rest } = validPayload;
    void _omit;
    expect(() =>
      verifyRetirementCompleteness(rest as Partial<BiocarbonRetirementPayload>),
    ).toThrow(MissingBeneficiaryFieldsError);
  });

  it('throws MissingBeneficiaryFieldsError when legalIdRef is set without jurisdiction', () => {
    expect(() =>
      verifyRetirementCompleteness({
        ...validPayload,
        retiredFor: {
          name: 'Acme',
          legalIdRef: 'AAACA1234N',
        },
      }),
    ).toThrow(MissingBeneficiaryFieldsError);
  });

  it('exposes a fieldPath on each typed error so the route layer can build RFC 7807 details', () => {
    try {
      verifyRetirementCompleteness({
        ...validPayload,
        tonnesRetired: 0,
      });
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(WholeTonViolationError);
      if (err instanceof WholeTonViolationError) {
        expect(err.fieldPath).toBe('tonnesRetired');
      }
    }
  });
});
