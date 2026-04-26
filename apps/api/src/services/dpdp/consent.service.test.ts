/**
 * AAT-R3 / AV4-428 — consent service unit tests.
 *
 * Mirrors the prisma-mock-hoist pattern used in coupon / auth tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    consentRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import {
  CONSENT_PURPOSES,
  hasActiveConsent,
  listForUser,
  recordConsent,
  withdrawConsent,
} from './consent.service.js';

const USER_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cr-1',
    userId: USER_ID,
    purpose: CONSENT_PURPOSES.KYC_VERIFICATION,
    granted: true,
    grantedAt: new Date('2026-04-26T12:00:00Z'),
    withdrawnAt: null,
    consentText: 'I consent to KYC processing for compliance.',
    consentVersion: 'v1.0.0',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    createdAt: new Date('2026-04-26T12:00:00Z'),
    ...overrides,
  };
}

describe('recordConsent', () => {
  it('persists a new consent row with all fields', async () => {
    mockPrisma.consentRecord.create.mockResolvedValue(makeRow());

    const dto = await recordConsent({
      userId: USER_ID,
      purpose: CONSENT_PURPOSES.KYC_VERIFICATION,
      granted: true,
      consentText: 'I consent to KYC processing for compliance.',
      consentVersion: 'v1.0.0',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(dto.id).toBe('cr-1');
    expect(dto.granted).toBe(true);
    expect(dto.purpose).toBe('kyc_verification');
    expect(mockPrisma.consentRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        purpose: 'kyc_verification',
        granted: true,
        consentVersion: 'v1.0.0',
      }),
    });
  });
});

describe('hasActiveConsent', () => {
  it('returns true when an active granted row exists', async () => {
    mockPrisma.consentRecord.findFirst.mockResolvedValue({ id: 'cr-1' });
    const ok = await hasActiveConsent(USER_ID, 'kyc_verification');
    expect(ok).toBe(true);
    expect(mockPrisma.consentRecord.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        purpose: 'kyc_verification',
        granted: true,
        withdrawnAt: null,
      },
      select: { id: true },
    });
  });

  it('returns false when no active row exists', async () => {
    mockPrisma.consentRecord.findFirst.mockResolvedValue(null);
    const ok = await hasActiveConsent(USER_ID, 'kyc_verification');
    expect(ok).toBe(false);
  });
});

describe('withdrawConsent', () => {
  it('soft-flips the latest active row when found', async () => {
    mockPrisma.consentRecord.findFirst.mockResolvedValue(makeRow());
    mockPrisma.consentRecord.update.mockResolvedValue(
      makeRow({ withdrawnAt: new Date('2026-04-27T00:00:00Z') }),
    );

    const result = await withdrawConsent({
      userId: USER_ID,
      purpose: 'kyc_verification',
    });

    expect(result.withdrawn).toBe(true);
    expect(result.record?.withdrawnAt).toBe('2026-04-27T00:00:00.000Z');
    expect(mockPrisma.consentRecord.update).toHaveBeenCalledWith({
      where: { id: 'cr-1' },
      data: { withdrawnAt: expect.any(Date) },
    });
  });

  it('returns withdrawn=false when no active consent exists (idempotent)', async () => {
    mockPrisma.consentRecord.findFirst.mockResolvedValue(null);
    const result = await withdrawConsent({
      userId: USER_ID,
      purpose: 'kyc_verification',
    });
    expect(result.withdrawn).toBe(false);
    expect(result.record).toBeNull();
    expect(mockPrisma.consentRecord.update).not.toHaveBeenCalled();
  });
});

describe('listForUser', () => {
  it('returns rows sorted desc by createdAt', async () => {
    mockPrisma.consentRecord.findMany.mockResolvedValue([
      makeRow({ id: 'cr-2' }),
      makeRow({ id: 'cr-1' }),
    ]);
    const rows = await listForUser(USER_ID);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toBe('cr-2');
    expect(mockPrisma.consentRecord.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: { createdAt: 'desc' },
    });
  });
});
