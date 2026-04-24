import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from './audit-log.service.js';

/**
 * A6.4 SD-Tool (AV4-337) — Sustainable Development Tool.
 *
 * Mandatory since 2024 for all PACM activities: every activity must report
 * contributions across at least 2 of the 17 UN SDGs (ex-ante at PDD stage,
 * ex-post per monitoring period).
 *
 * Read catalogue endpoints are public-ish (auth-only, no org gate). Writes are
 * org-scoped: contributions belong to a specific activity or monitoring period.
 */

type ContributionType = 'EX_ANTE' | 'EX_POST';

export interface ContributionInput {
  indicatorCode: string;
  type: ContributionType;
  value: number;
  unit: string;
  notes?: string;
  evidenceUrl?: string;
  monitoringPeriodId?: string; // required for EX_POST; null for EX_ANTE
}

// ─── Catalogue ─────────────────────────────────────────────────────────

export async function listSdgs() {
  return prisma.sdg.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
  });
}

export async function listIndicators(sdgCode?: string) {
  return prisma.sdIndicator.findMany({
    where: {
      isActive: true,
      ...(sdgCode ? { sdgCode } : {}),
    },
    orderBy: { code: 'asc' },
  });
}

// ─── Batch upsert ──────────────────────────────────────────────────────

/**
 * Upsert a batch of contributions for an activity. Each entry is keyed by
 * (activityId, indicatorCode, type, monitoringPeriodId).
 *
 * Validates A6.4 SD-Tool minimum: for the ex-ante batch, contributions must
 * cover at least 2 distinct SDGs. This check applies only when caller is
 * submitting ex-ante contributions (type === 'EX_ANTE' in the batch).
 */
export async function upsertContributions(
  activityId: string,
  orgId: string,
  userId: string,
  data: ContributionInput[],
) {
  if (!data.length) {
    throw new AppError(400, 'Bad Request', 'At least one contribution is required');
  }

  const activity = await prisma.activity.findFirst({ where: { id: activityId, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');

  // Validate indicator codes exist and are active — collect the SDG each maps to,
  // for the ≥2-SDG ex-ante rule.
  const indicatorCodes = Array.from(new Set(data.map((d) => d.indicatorCode)));
  const indicators = await prisma.sdIndicator.findMany({
    where: { code: { in: indicatorCodes }, isActive: true },
    select: { code: true, sdgCode: true },
  });
  if (indicators.length !== indicatorCodes.length) {
    const known = new Set(indicators.map((i) => i.code));
    const missing = indicatorCodes.filter((c) => !known.has(c));
    throw new AppError(
      400,
      'Bad Request',
      `Unknown or inactive SD indicator codes: ${missing.join(', ')}`,
    );
  }
  const sdgByIndicator = new Map(indicators.map((i) => [i.code, i.sdgCode]));

  // A6.4 SD-Tool rule: ex-ante must cover ≥2 distinct SDGs across both the
  // incoming batch AND the already-persisted ex-ante for this activity.
  const hasExAnte = data.some((d) => d.type === 'EX_ANTE');
  if (hasExAnte) {
    const existingExAnte = await prisma.sdContribution.findMany({
      where: { activityId, contributionType: 'EX_ANTE' as never },
      select: { indicatorCode: true },
    });
    const existingCodes = existingExAnte.map((c) => c.indicatorCode);
    const existingIndicatorSdgs =
      existingCodes.length > 0
        ? await prisma.sdIndicator.findMany({
            where: { code: { in: existingCodes } },
            select: { code: true, sdgCode: true },
          })
        : [];
    const allSdgs = new Set<string>();
    for (const e of existingIndicatorSdgs) allSdgs.add(e.sdgCode);
    for (const d of data) {
      if (d.type !== 'EX_ANTE') continue;
      const sdg = sdgByIndicator.get(d.indicatorCode);
      if (sdg) allSdgs.add(sdg);
    }
    if (allSdgs.size < 2) {
      throw new AppError(
        400,
        'Bad Request',
        'SD-Tool requires ex-ante contributions across at least 2 SDGs (per A6.4 SD-Tool minimum)',
      );
    }
  }

  // Per-entry validation: EX_POST must have a monitoringPeriodId that belongs
  // to this activity.
  const exPostPeriodIds = Array.from(
    new Set(
      data
        .filter((d) => d.type === 'EX_POST')
        .map((d) => d.monitoringPeriodId)
        .filter((p): p is string => !!p),
    ),
  );
  if (exPostPeriodIds.length > 0) {
    const periods = await prisma.monitoringPeriod.findMany({
      where: { id: { in: exPostPeriodIds }, activityId },
      select: { id: true },
    });
    if (periods.length !== exPostPeriodIds.length) {
      throw new AppError(
        400,
        'Bad Request',
        'One or more monitoringPeriodId values do not belong to this activity',
      );
    }
  }
  for (const d of data) {
    if (d.type === 'EX_POST' && !d.monitoringPeriodId) {
      throw new AppError(
        400,
        'Bad Request',
        `EX_POST contribution for indicator ${d.indicatorCode} requires monitoringPeriodId`,
      );
    }
  }

  // Execute the upserts in a transaction for atomicity.
  // We use findFirst → update/create rather than `upsert` because
  // monitoringPeriodId is nullable (EX_ANTE rows have no period), and Prisma's
  // compound unique constraints don't select on NULL reliably.
  const results = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const d of data) {
      const existing = await tx.sdContribution.findFirst({
        where: {
          activityId,
          indicatorCode: d.indicatorCode,
          contributionType: d.type as never,
          monitoringPeriodId: d.monitoringPeriodId ?? null,
        },
      });
      if (existing) {
        const updated = await tx.sdContribution.update({
          where: { id: existing.id },
          data: {
            value: d.value,
            unit: d.unit,
            notes: d.notes,
            evidenceUrl: d.evidenceUrl,
            updatedBy: userId,
          },
        });
        rows.push(updated);
      } else {
        const created = await tx.sdContribution.create({
          data: {
            activityId,
            indicatorCode: d.indicatorCode,
            contributionType: d.type as never,
            monitoringPeriodId: d.monitoringPeriodId ?? null,
            value: d.value,
            unit: d.unit,
            notes: d.notes,
            evidenceUrl: d.evidenceUrl,
            updatedBy: userId,
          },
        });
        rows.push(created);
      }
    }
    return rows;
  });

  await recordAudit({
    orgId,
    userId,
    action: 'sd_contribution.upserted',
    resource: 'activity',
    resourceId: activityId,
    newValue: {
      count: results.length,
      types: Array.from(new Set(data.map((d) => d.type))),
      indicators: indicatorCodes,
    },
  });

  return results;
}

// ─── Queries ───────────────────────────────────────────────────────────

export async function listByActivity(activityId: string, orgId: string) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');

  const rows = await prisma.sdContribution.findMany({
    where: { activityId },
    include: {
      indicator: { include: { sdg: true } },
    },
    orderBy: [{ indicatorCode: 'asc' }, { contributionType: 'asc' }, { createdAt: 'asc' }],
  });

  return {
    exAnte: rows.filter((r) => r.contributionType === 'EX_ANTE'),
    exPost: rows.filter((r) => r.contributionType === 'EX_POST'),
  };
}

export async function listByMonitoringPeriod(periodId: string, orgId: string) {
  const period = await prisma.monitoringPeriod.findUnique({
    where: { id: periodId },
    include: { activity: { select: { orgId: true } } },
  });
  if (!period || period.activity.orgId !== orgId) {
    throw new AppError(404, 'Not Found', 'Monitoring period not found');
  }

  return prisma.sdContribution.findMany({
    where: { monitoringPeriodId: periodId, contributionType: 'EX_POST' as never },
    include: { indicator: { include: { sdg: true } } },
    orderBy: [{ indicatorCode: 'asc' }, { createdAt: 'asc' }],
  });
}

/**
 * Aggregated ex-ante vs ex-post table for an activity. Returns per-indicator
 * ex-ante and the most recent ex-post entry per indicator.
 */
export async function aggregatedReport(activityId: string, orgId: string) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');

  const rows = await prisma.sdContribution.findMany({
    where: { activityId },
    include: { indicator: { include: { sdg: true } } },
    orderBy: [{ indicatorCode: 'asc' }, { createdAt: 'desc' }],
  });

  type Row = (typeof rows)[number];
  const byIndicator = new Map<string, { indicator: Row['indicator']; exAnte?: Row; exPost: Row[] }>();
  for (const r of rows) {
    const entry = byIndicator.get(r.indicatorCode) ?? {
      indicator: r.indicator,
      exPost: [] as Row[],
    };
    if (r.contributionType === 'EX_ANTE') {
      // Only keep the most recent EX_ANTE (first in desc order).
      if (!entry.exAnte) entry.exAnte = r;
    } else {
      entry.exPost.push(r);
    }
    byIndicator.set(r.indicatorCode, entry);
  }

  return {
    activityId,
    rows: Array.from(byIndicator.values()).map((entry) => ({
      indicator: entry.indicator,
      exAnte: entry.exAnte ?? null,
      exPost: entry.exPost,
      delta:
        entry.exAnte && entry.exPost.length
          ? Number(entry.exPost[0]!.value.toString()) -
            Number(entry.exAnte.value.toString())
          : null,
    })),
  };
}
