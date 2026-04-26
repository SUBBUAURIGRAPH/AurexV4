/**
 * AAT-R1 / AV4-423 — host-country LoA verification tests.
 *
 * Covers the `verifyLoa` helper added in this sprint. Issuance / revoke
 * flows are exercised separately at the route + integration layer.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    hostAuthorization: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
}));

import { verifyLoa } from './host-authorization.service.js';
import { AppError } from '../middleware/error-handler.js';

const AUTH_ID = '00000000-0000-4000-8000-000000000020';
const ACTIVITY_ID = '00000000-0000-4000-8000-000000000021';

interface AuthRow {
  id: string;
  activityId: string;
  hostCountry: string;
  dnaName: string;
  authorizedFor: string;
  status: string;
  documentUrl: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  formVersion: string | null;
  authorizedUses: string[];
  durationMonths: number | null;
  granularityTags: string[];
}

function makeAuth(overrides: Partial<AuthRow> = {}): AuthRow {
  return {
    id: AUTH_ID,
    activityId: ACTIVITY_ID,
    hostCountry: 'IN',
    dnaName: 'MoEFCC India',
    authorizedFor: 'NDC_AND_OIMP',
    status: 'ISSUED',
    documentUrl: 'https://example.gov.in/loa/0001.pdf',
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validUntil: new Date('2030-12-31T00:00:00Z'),
    formVersion: 'FORM-GOV-002 v1.1',
    authorizedUses: ['ndc', 'oimp_corsia'],
    durationMonths: 60,
    granularityTags: ['vintage:2026-2030', 'category:afolu'],
    ...overrides,
  };
}

const NOW = new Date('2026-04-01T00:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.hostAuthorization.findUnique.mockReset();
});

describe('verifyLoa', () => {
  it('returns ok=true when all envelope fields are valid', async () => {
    mockPrisma.hostAuthorization.findUnique.mockResolvedValue(makeAuth());
    const r = await verifyLoa(AUTH_ID, NOW);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.authorization.formVersion).toBe('FORM-GOV-002 v1.1');
  });

  it('throws AppError(404) when no row matches', async () => {
    mockPrisma.hostAuthorization.findUnique.mockResolvedValue(null);
    await expect(verifyLoa('missing', NOW)).rejects.toBeInstanceOf(AppError);
  });

  it('flags missing documentUrl', async () => {
    mockPrisma.hostAuthorization.findUnique.mockResolvedValue(
      makeAuth({ documentUrl: null }),
    );
    const r = await verifyLoa(AUTH_ID, NOW);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain('LOA_DOCUMENT_URL_MISSING');
  });

  it('flags missing formVersion', async () => {
    mockPrisma.hostAuthorization.findUnique.mockResolvedValue(
      makeAuth({ formVersion: null }),
    );
    const r = await verifyLoa(AUTH_ID, NOW);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain('LOA_FORM_VERSION_MISSING');
  });

  it('rejects an unsupported formVersion', async () => {
    mockPrisma.hostAuthorization.findUnique.mockResolvedValue(
      makeAuth({ formVersion: 'FORM-GOV-001 v0.9' }),
    );
    const r = await verifyLoa(AUTH_ID, NOW);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain('LOA_FORM_VERSION_UNSUPPORTED');
  });

  it('accepts FORM-GOV-003 amendment form', async () => {
    mockPrisma.hostAuthorization.findUnique.mockResolvedValue(
      makeAuth({ formVersion: 'FORM-GOV-003 v1.0' }),
    );
    const r = await verifyLoa(AUTH_ID, NOW);
    expect(r.ok).toBe(true);
  });

  it('accepts FORM-GOV-010 OIMP-only form', async () => {
    mockPrisma.hostAuthorization.findUnique.mockResolvedValue(
      makeAuth({ formVersion: 'FORM-GOV-010 v1.0' }),
    );
    const r = await verifyLoa(AUTH_ID, NOW);
    expect(r.ok).toBe(true);
  });

  it('rejects when status != ISSUED', async () => {
    mockPrisma.hostAuthorization.findUnique.mockResolvedValue(
      makeAuth({ status: 'PENDING' }),
    );
    const r = await verifyLoa(AUTH_ID, NOW);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain('LOA_NOT_ISSUED');
  });

  it('rejects when validFrom is in the future', async () => {
    mockPrisma.hostAuthorization.findUnique.mockResolvedValue(
      makeAuth({ validFrom: new Date('2099-01-01T00:00:00Z') }),
    );
    const r = await verifyLoa(AUTH_ID, NOW);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain('LOA_NOT_YET_VALID');
  });

  it('rejects when validUntil has passed', async () => {
    mockPrisma.hostAuthorization.findUnique.mockResolvedValue(
      makeAuth({ validUntil: new Date('2020-01-01T00:00:00Z') }),
    );
    const r = await verifyLoa(AUTH_ID, NOW);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain('LOA_EXPIRED');
  });

  it('accepts a row with null validUntil (open-ended LoA)', async () => {
    mockPrisma.hostAuthorization.findUnique.mockResolvedValue(
      makeAuth({ validUntil: null }),
    );
    const r = await verifyLoa(AUTH_ID, NOW);
    expect(r.ok).toBe(true);
  });
});
