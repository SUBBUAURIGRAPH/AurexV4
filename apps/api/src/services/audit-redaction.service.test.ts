import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PII_KEYS,
  REDACTED,
  redactForAudit,
} from './audit-redaction.service.js';

describe('audit-redaction.service — top-level PII keys', () => {
  it('redacts every default PII key found at the root', () => {
    const row = {
      id: 'row-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+44-555-1234',
      legalIdRef: 'AAAPL1234C',
      beneficiaryRef: 'ben-1',
      vintage: 2025,
    };

    const out = redactForAudit(row);

    expect(out.id).toBe('row-1');
    expect(out.vintage).toBe(2025);
    expect(out.name).toBe(REDACTED);
    expect(out.email).toBe(REDACTED);
    expect(out.phone).toBe(REDACTED);
    expect(out.legalIdRef).toBe(REDACTED);
    expect(out.beneficiaryRef).toBe(REDACTED);
  });

  it('does not mutate the original input', () => {
    const row = { id: 'row-1', name: 'Jane Doe', email: 'jane@example.com' };
    const snapshot = JSON.stringify(row);

    redactForAudit(row);

    expect(JSON.stringify(row)).toBe(snapshot);
  });
});

describe('audit-redaction.service — nested PII keys via dot notation', () => {
  it('redacts nested fields in retiredFor object', () => {
    const row = {
      retirementId: 'retire-1',
      retiredFor: {
        name: 'Acme Corp',
        legalIdRef: 'EIN-12-3456789',
        email: 'compliance@acme.test',
        jurisdiction: 'US',
      },
    };

    const out = redactForAudit(row);
    const retiredFor = out.retiredFor as Record<string, unknown>;

    expect(retiredFor.name).toBe(REDACTED);
    expect(retiredFor.legalIdRef).toBe(REDACTED);
    expect(retiredFor.email).toBe(REDACTED);
    // Non-PII nested field preserved.
    expect(retiredFor.jurisdiction).toBe('US');
  });

  it('silently skips paths whose intermediate keys are missing', () => {
    const row = {
      retirementId: 'retire-1',
      // No retiredFor at all.
    };

    const out = redactForAudit(row);

    expect(out).toEqual({ retirementId: 'retire-1' });
  });

  it('redacts every element when an intermediate path segment is an array', () => {
    const row = {
      retirements: [
        { retiredFor: { name: 'A', email: 'a@example.com' } },
        { retiredFor: { name: 'B', email: 'b@example.com' } },
      ],
    };

    const out = redactForAudit(row, {
      piiKeys: ['retirements.retiredFor.name', 'retirements.retiredFor.email'],
    });

    const arr = out.retirements as Array<Record<string, unknown>>;
    expect((arr[0]!.retiredFor as Record<string, unknown>).name).toBe(REDACTED);
    expect((arr[1]!.retiredFor as Record<string, unknown>).email).toBe(REDACTED);
  });
});

describe('audit-redaction.service — custom piiKeys override', () => {
  it('uses the supplied list and IGNORES the default keys', () => {
    const row = {
      // `email` is in DEFAULT_PII_KEYS but should NOT be redacted now.
      email: 'leave@example.com',
      // Custom-only field.
      socialSecurityNumber: '111-22-3333',
    };

    const out = redactForAudit(row, { piiKeys: ['socialSecurityNumber'] });

    expect(out.email).toBe('leave@example.com');
    expect(out.socialSecurityNumber).toBe(REDACTED);
  });
});

describe('audit-redaction.service — non-PII fields preserved', () => {
  it('preserves verbatim values for non-PII fields including bcrSerialId / txHash / methodology', () => {
    const row = {
      bcrSerialId: 'BCR-1',
      bcrLockId: 'LOCK-1',
      txHash: '0xabc',
      methodology: 'AMS-III.AR',
      assessedAt: '2026-04-25T00:00:00Z',
      vintage: 2025,
      net: { units: 930, currency: 'tCO2e' },
    };

    const out = redactForAudit(row);

    expect(out).toEqual(row);
  });

  it('exposes the default PII key set publicly so callers can extend it', () => {
    expect(DEFAULT_PII_KEYS).toContain('email');
    expect(DEFAULT_PII_KEYS).toContain('legalIdRef');
    expect(DEFAULT_PII_KEYS).toContain('retiredFor.name');
  });
});
