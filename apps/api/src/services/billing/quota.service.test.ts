/**
 * AAT-378 / AV4-378 — quota.service tests.
 *
 * Mocks `@aurex/database` directly so the live count queries become
 * stubs we control per test. We mirror only the prisma surface actually
 * used by quota.service: subscription / emissionsRecord / report /
 * activity / creditAccount / creditUnitBlock / orgMember.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      subscription: { findFirst: vi.fn() },
      emissionsRecord: { count: vi.fn() },
      report: { count: vi.fn() },
      activity: { count: vi.fn() },
      creditAccount: { findFirst: vi.fn() },
      creditUnitBlock: { count: vi.fn() },
      orgMember: { count: vi.fn() },
    },
  };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

import {
  assertQuota,
  checkQuota,
  getCurrentUsage,
  getOrgQuotaSnapshot,
  getPlanForOrg,
  getQuotaForOrg,
  QuotaExceededError,
} from './quota.service.js';
import { FREE_QUOTAS, TIER_QUOTAS } from './quotas.js';

const ORG = 'org-quota-1';

beforeEach(() => {
  for (const model of Object.values(mockPrisma)) {
    for (const fn of Object.values(model)) {
      (fn as ReturnType<typeof vi.fn>).mockReset();
    }
  }
  // Sane defaults — most tests want the "nothing to count" baseline.
  mockPrisma.emissionsRecord.count.mockResolvedValue(0);
  mockPrisma.report.count.mockResolvedValue(0);
  mockPrisma.activity.count.mockResolvedValue(0);
  mockPrisma.creditAccount.findFirst.mockResolvedValue(null);
  mockPrisma.creditUnitBlock.count.mockResolvedValue(0);
  mockPrisma.orgMember.count.mockResolvedValue(0);
});

describe('getQuotaForOrg', () => {
  it('returns FREE_QUOTAS when no subscription exists', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValueOnce(null);
    const q = await getQuotaForOrg(ORG);
    expect(q).toEqual(FREE_QUOTAS);
  });

  it('returns FREE_QUOTAS when the subscription is EXPIRED', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({
      plan: 'MSME_INDIA',
      status: 'EXPIRED',
    });
    const q = await getQuotaForOrg(ORG);
    expect(q).toEqual(FREE_QUOTAS);
  });

  it('returns MSME_INDIA quotas for an MSME_INDIA subscription', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({
      plan: 'MSME_INDIA',
      status: 'ACTIVE',
    });
    const q = await getQuotaForOrg(ORG);
    expect(q).toEqual(TIER_QUOTAS.MSME_INDIA);
  });

  it('returns ENTERPRISE_INTL quotas for an ENTERPRISE_INTL subscription', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({
      plan: 'ENTERPRISE_INTL',
      status: 'ACTIVE',
    });
    const q = await getQuotaForOrg(ORG);
    expect(q).toEqual(TIER_QUOTAS.ENTERPRISE_INTL);
  });
});

describe('getPlanForOrg', () => {
  it('returns FREE for EXPIRED / missing subscription', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValueOnce(null);
    expect(await getPlanForOrg(ORG)).toBe('FREE');

    mockPrisma.subscription.findFirst.mockResolvedValueOnce({
      plan: 'MSME_INDIA',
      status: 'EXPIRED',
    });
    expect(await getPlanForOrg(ORG)).toBe('FREE');
  });

  it('returns the plan code for an active subscription', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({
      plan: 'ENTERPRISE_INDIA',
      status: 'ACTIVE',
    });
    expect(await getPlanForOrg(ORG)).toBe('ENTERPRISE_INDIA');
  });
});

describe('getCurrentUsage', () => {
  it('counts emissions for the current month + reports for the year', async () => {
    mockPrisma.emissionsRecord.count.mockResolvedValueOnce(42);
    mockPrisma.report.count.mockResolvedValueOnce(7);
    mockPrisma.activity.count.mockResolvedValueOnce(3);
    mockPrisma.orgMember.count.mockResolvedValueOnce(4);

    const usage = await getCurrentUsage(ORG);

    expect(usage.monthlyEmissionEntries).toBe(42);
    expect(usage.reportsPerYear).toBe(7);
    expect(usage.activitiesActive).toBe(3);
    expect(usage.teamMembers).toBe(4);
    expect(usage.creditUnitBlocks).toBe(0);
    // not-yet-measured signals reported as 0 (see service header).
    expect(usage.apiRequestsPerHour).toBe(0);
    expect(usage.storageMb).toBe(0);
  });

  it('counts credit blocks via the org credit account when present', async () => {
    mockPrisma.creditAccount.findFirst.mockResolvedValueOnce({ id: 'acct-1' });
    mockPrisma.creditUnitBlock.count.mockResolvedValueOnce(17);

    const usage = await getCurrentUsage(ORG);

    expect(mockPrisma.creditUnitBlock.count).toHaveBeenCalledWith({
      where: { holderAccountId: 'acct-1' },
    });
    expect(usage.creditUnitBlocks).toBe(17);
  });
});

describe('checkQuota', () => {
  it('allows when usage is below limit', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({
      plan: 'MSME_INDIA',
      status: 'ACTIVE',
    });
    mockPrisma.emissionsRecord.count.mockResolvedValueOnce(10);

    const result = await checkQuota(ORG, 'monthlyEmissionEntries');

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(10);
    expect(result.limit).toBe(TIER_QUOTAS.MSME_INDIA.monthlyEmissionEntries);
    expect(result.remaining).toBe(
      TIER_QUOTAS.MSME_INDIA.monthlyEmissionEntries - 10,
    );
    expect(result.resource).toBe('monthlyEmissionEntries');
  });

  it('denies when usage equals the limit (>=, not just >)', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({
      plan: 'MSME_INDIA',
      status: 'ACTIVE',
    });
    mockPrisma.emissionsRecord.count.mockResolvedValueOnce(
      TIER_QUOTAS.MSME_INDIA.monthlyEmissionEntries,
    );

    const result = await checkQuota(ORG, 'monthlyEmissionEntries');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('denies when usage is over the limit', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({
      plan: 'MSME_INDIA',
      status: 'ACTIVE',
    });
    mockPrisma.report.count.mockResolvedValueOnce(99);

    const result = await checkQuota(ORG, 'reportsPerYear');

    expect(result.allowed).toBe(false);
    expect(result.used).toBeGreaterThan(result.limit);
    expect(result.remaining).toBe(0);
  });
});

describe('assertQuota', () => {
  it('returns the result when allowed', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({
      plan: 'ENTERPRISE_INDIA',
      status: 'ACTIVE',
    });
    mockPrisma.activity.count.mockResolvedValueOnce(2);
    const result = await assertQuota(ORG, 'activitiesActive');
    expect(result.allowed).toBe(true);
  });

  it('throws QuotaExceededError when usage hits the limit', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValueOnce(null); // FREE
    mockPrisma.activity.count.mockResolvedValueOnce(
      FREE_QUOTAS.activitiesActive,
    );

    await expect(assertQuota(ORG, 'activitiesActive')).rejects.toBeInstanceOf(
      QuotaExceededError,
    );
  });

  it('QuotaExceededError carries 429 status + structured fields', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValueOnce(null);
    mockPrisma.report.count.mockResolvedValueOnce(FREE_QUOTAS.reportsPerYear);

    let caught: unknown;
    try {
      await assertQuota(ORG, 'reportsPerYear');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(QuotaExceededError);
    const e = caught as QuotaExceededError;
    expect(e.status).toBe(429);
    expect(e.type).toBe('https://aurex.in/errors/quota-exceeded');
    expect(e.resource).toBe('reportsPerYear');
    expect(e.used).toBe(FREE_QUOTAS.reportsPerYear);
    expect(e.limit).toBe(FREE_QUOTAS.reportsPerYear);
  });
});

describe('getOrgQuotaSnapshot', () => {
  it('produces full limits / usage / remaining / ratios', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue({
      plan: 'MSME_INDIA',
      status: 'ACTIVE',
    });
    mockPrisma.emissionsRecord.count.mockResolvedValue(500);
    mockPrisma.report.count.mockResolvedValue(6);
    mockPrisma.activity.count.mockResolvedValue(2);
    mockPrisma.orgMember.count.mockResolvedValue(3);

    const snap = await getOrgQuotaSnapshot(ORG);

    expect(snap.plan).toBe('MSME_INDIA');
    expect(snap.limits).toEqual(TIER_QUOTAS.MSME_INDIA);
    expect(snap.usage.monthlyEmissionEntries).toBe(500);
    expect(snap.remaining.monthlyEmissionEntries).toBe(
      TIER_QUOTAS.MSME_INDIA.monthlyEmissionEntries - 500,
    );
    expect(snap.ratios.monthlyEmissionEntries).toBeCloseTo(
      500 / TIER_QUOTAS.MSME_INDIA.monthlyEmissionEntries,
      4,
    );
  });
});
