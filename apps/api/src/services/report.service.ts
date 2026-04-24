import { randomBytes } from 'node:crypto';
import { prisma } from '@aurex/database';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';
import { collectDescendantOrgIds } from './organization.service.js';
import { resolveMapping } from './category-mapping.service.js';
import { recordAudit } from './audit-log.service.js';

export interface GenerateReportData {
  orgId: string;
  createdBy: string;
  type: string;
  year: number;
  scopes: string[];
  includeSubsidiaries?: boolean;
}

export interface IndicatorAggregate {
  code: string;
  totalTCO2e: number;
  recordCount: number;
}

export interface IndicatorSummary {
  esg: IndicatorAggregate[];
  brsr: IndicatorAggregate[];
}

export async function generateReport(data: GenerateReportData) {
  const report = await prisma.report.create({
    data: {
      orgId: data.orgId,
      type: data.type,
      status: 'QUEUED',
      parameters: {
        year: data.year,
        scopes: data.scopes,
        includeSubsidiaries: data.includeSubsidiaries ?? false,
      },
      createdBy: data.createdBy,
    },
  });

  try {
    const reportData = await buildReportData(
      data.orgId,
      data.type,
      data.year,
      data.scopes,
      data.includeSubsidiaries,
    );

    const completed = await prisma.report.update({
      where: { id: report.id },
      data: {
        status: 'COMPLETED',
        reportData: reportData as never,
      },
    });

    logger.info({ reportId: report.id, type: data.type, orgId: data.orgId }, 'Report generated');
    return completed;
  } catch (err) {
    await prisma.report.update({
      where: { id: report.id },
      data: { status: 'FAILED' },
    });

    logger.error({ reportId: report.id, err }, 'Report generation failed');
    throw err;
  }
}

async function buildReportData(
  orgId: string,
  type: string,
  year: number,
  scopes: string[],
  includeSubsidiaries?: boolean,
) {
  const periodStart = new Date(`${year}-01-01T00:00:00Z`);
  const periodEnd = new Date(`${year + 1}-01-01T00:00:00Z`);

  const orgIds = includeSubsidiaries ? await collectDescendantOrgIds([orgId]) : [orgId];

  const emissions = await prisma.emissionsRecord.findMany({
    where: {
      orgId: { in: orgIds },
      scope: { in: scopes as never },
      status: 'VERIFIED',
      periodStart: { gte: periodStart },
      periodEnd: { lt: periodEnd },
    },
    orderBy: [{ scope: 'asc' }, { category: 'asc' }],
  });

  const scopeTotals: Record<string, number> = {};
  const categoryBreakdown: Record<string, Record<string, number>> = {};

  for (const record of emissions) {
    const scope = record.scope;
    const value = Number(record.value);

    scopeTotals[scope] = (scopeTotals[scope] ?? 0) + value;

    if (!categoryBreakdown[scope]) {
      categoryBreakdown[scope] = {};
    }
    categoryBreakdown[scope][record.category] =
      (categoryBreakdown[scope][record.category] ?? 0) + value;
  }

  const totalEmissions = Object.values(scopeTotals).reduce((sum, v) => sum + v, 0);

  const indicatorSummary = await buildIndicatorSummary(orgId, emissions);

  const baselines = await prisma.emissionsBaseline.findMany({
    where: {
      orgId: { in: orgIds },
      scope: { in: scopes as never },
      isActive: true,
    },
  });

  const targets = await prisma.emissionsTarget.findMany({
    where: {
      orgId: { in: orgIds },
      scope: { in: scopes as never },
    },
    include: {
      progress: {
        where: { year },
      },
    },
  });

  return {
    reportType: type,
    reportYear: year,
    generatedAt: new Date().toISOString(),
    summary: {
      totalEmissions,
      unit: 'tCO2e',
      scopeTotals,
      recordCount: emissions.length,
    },
    categoryBreakdown,
    indicatorSummary,
    baselines: baselines.map((b) => ({
      id: b.id,
      name: b.name,
      scope: b.scope,
      baseYear: b.baseYear,
      value: Number(b.value),
      unit: b.unit,
    })),
    targets: targets.map((t) => ({
      id: t.id,
      name: t.name,
      scope: t.scope,
      targetYear: t.targetYear,
      reduction: Number(t.reduction),
      pathway: t.pathway,
      isApproved: t.isApproved,
      currentProgress:
        t.progress.length > 0
          ? {
              actual: Number(t.progress[0]!.actual),
              projected: t.progress[0]!.projected ? Number(t.progress[0]!.projected) : null,
              variance: t.progress[0]!.variance ? Number(t.progress[0]!.variance) : null,
            }
          : null,
    })),
  };
}

/**
 * Groups emissions records by ESG and BRSR indicator codes using the
 * CategoryMapping lookup service. Records with no mapping are skipped.
 */
async function buildIndicatorSummary(
  orgId: string,
  emissions: Array<{ scope: string; category: string; value: unknown }>,
): Promise<IndicatorSummary> {
  const esgAgg = new Map<string, { total: number; count: number }>();
  const brsrAgg = new Map<string, { total: number; count: number }>();

  // Cache mapping lookups per (scope, category) to avoid repeated DB hits
  const mappingCache = new Map<
    string,
    { esg: string[]; brsr: string[] } | null
  >();

  for (const record of emissions) {
    const key = `${record.scope}::${record.category}`;
    let mapping = mappingCache.get(key);
    if (mapping === undefined) {
      const resolved = await resolveMapping(orgId, record.scope, record.category);
      mapping = resolved
        ? { esg: resolved.esgIndicatorCodes, brsr: resolved.brsrIndicatorCodes }
        : null;
      mappingCache.set(key, mapping);
    }
    if (!mapping) continue;

    const value = Number(record.value);

    for (const code of mapping.esg) {
      const row = esgAgg.get(code) ?? { total: 0, count: 0 };
      row.total += value;
      row.count += 1;
      esgAgg.set(code, row);
    }
    for (const code of mapping.brsr) {
      const row = brsrAgg.get(code) ?? { total: 0, count: 0 };
      row.total += value;
      row.count += 1;
      brsrAgg.set(code, row);
    }
  }

  const toSorted = (m: Map<string, { total: number; count: number }>): IndicatorAggregate[] =>
    Array.from(m.entries())
      .map(([code, v]) => ({ code, totalTCO2e: v.total, recordCount: v.count }))
      .sort((a, b) => a.code.localeCompare(b.code));

  return { esg: toSorted(esgAgg), brsr: toSorted(brsrAgg) };
}

export async function getReportStatus(id: string, orgId: string) {
  const report = await prisma.report.findFirst({
    where: { id, orgId },
    select: { id: true, status: true, type: true, createdAt: true, lifecycleStatus: true },
  });

  if (!report) {
    throw new AppError(404, 'Not Found', 'Report not found');
  }

  return report;
}

export async function downloadReport(id: string, orgId: string) {
  const report = await prisma.report.findFirst({
    where: { id, orgId },
  });

  if (!report) {
    throw new AppError(404, 'Not Found', 'Report not found');
  }

  if (report.status !== 'COMPLETED') {
    throw new AppError(400, 'Bad Request', `Report is not ready. Current status: ${report.status}`);
  }

  return report;
}

export async function listReports(orgId: string) {
  return prisma.report.findMany({
    where: { orgId },
    select: {
      id: true,
      type: true,
      status: true,
      lifecycleStatus: true,
      parameters: true,
      createdBy: true,
      submittedAt: true,
      approvedAt: true,
      approvedBy: true,
      publishedAt: true,
      publishedBy: true,
      archivedAt: true,
      archivedBy: true,
      shareToken: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Returns just the indicatorSummary block from a report's reportData JSON.
 * Used by the frontend to render indicator tiles without re-fetching the
 * full report payload.
 */
export async function getIndicatorSummary(id: string, orgId: string): Promise<IndicatorSummary> {
  const report = await prisma.report.findFirst({
    where: { id, orgId },
    select: { reportData: true, status: true },
  });

  if (!report) {
    throw new AppError(404, 'Not Found', 'Report not found');
  }

  if (report.status !== 'COMPLETED') {
    throw new AppError(
      400,
      'Bad Request',
      `Report is not ready. Current status: ${report.status}`,
    );
  }

  const data = report.reportData as { indicatorSummary?: IndicatorSummary } | null;
  return data?.indicatorSummary ?? { esg: [], brsr: [] };
}

// ─── Report lifecycle (Phase D) ───────────────────────────────────────────

async function loadReport(id: string, orgId: string) {
  const report = await prisma.report.findFirst({ where: { id, orgId } });
  if (!report) throw new AppError(404, 'Not Found', 'Report not found');
  return report;
}

function assertLifecycle(current: string, expected: string[], resourceId: string): void {
  if (!expected.includes(current)) {
    throw new AppError(
      409,
      'Conflict',
      `Report ${resourceId} is in '${current}' state; expected one of: ${expected.join(', ')}`,
    );
  }
}

export interface LifecycleActor {
  orgId: string;
  userId: string;
  ipAddress?: string;
}

export async function submitForReview(id: string, actor: LifecycleActor) {
  const existing = await loadReport(id, actor.orgId);
  assertLifecycle(existing.lifecycleStatus, ['DRAFT'], id);

  const row = await prisma.report.update({
    where: { id },
    data: {
      lifecycleStatus: 'REVIEW',
      submittedAt: new Date(),
    },
  });

  await recordAudit({
    orgId: actor.orgId,
    userId: actor.userId,
    action: 'report.submitted_for_review',
    resource: 'report',
    resourceId: id,
    oldValue: { lifecycleStatus: existing.lifecycleStatus },
    newValue: { lifecycleStatus: row.lifecycleStatus },
    ipAddress: actor.ipAddress,
  });

  logger.info({ reportId: id, orgId: actor.orgId }, 'Report submitted for review');
  return row;
}

export async function approveReport(id: string, actor: LifecycleActor) {
  const existing = await loadReport(id, actor.orgId);
  assertLifecycle(existing.lifecycleStatus, ['REVIEW'], id);

  const row = await prisma.report.update({
    where: { id },
    data: {
      lifecycleStatus: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: actor.userId,
    },
  });

  await recordAudit({
    orgId: actor.orgId,
    userId: actor.userId,
    action: 'report.approved',
    resource: 'report',
    resourceId: id,
    oldValue: { lifecycleStatus: existing.lifecycleStatus },
    newValue: { lifecycleStatus: row.lifecycleStatus, approvedBy: actor.userId },
    ipAddress: actor.ipAddress,
  });

  logger.info({ reportId: id, orgId: actor.orgId, userId: actor.userId }, 'Report approved');
  return row;
}

export async function publishReport(id: string, actor: LifecycleActor) {
  const existing = await loadReport(id, actor.orgId);
  assertLifecycle(existing.lifecycleStatus, ['APPROVED'], id);

  const shareToken = existing.shareToken ?? randomBytes(24).toString('base64url');

  const row = await prisma.report.update({
    where: { id },
    data: {
      lifecycleStatus: 'PUBLISHED',
      publishedAt: new Date(),
      publishedBy: actor.userId,
      shareToken,
    },
  });

  await recordAudit({
    orgId: actor.orgId,
    userId: actor.userId,
    action: 'report.published',
    resource: 'report',
    resourceId: id,
    oldValue: { lifecycleStatus: existing.lifecycleStatus },
    newValue: { lifecycleStatus: row.lifecycleStatus, publishedBy: actor.userId },
    ipAddress: actor.ipAddress,
  });

  logger.info({ reportId: id, orgId: actor.orgId, userId: actor.userId }, 'Report published');
  return row;
}

export async function archiveReport(id: string, actor: LifecycleActor) {
  const existing = await loadReport(id, actor.orgId);
  if (existing.lifecycleStatus === 'ARCHIVED') {
    throw new AppError(409, 'Conflict', `Report ${id} is already archived`);
  }

  const row = await prisma.report.update({
    where: { id },
    data: {
      lifecycleStatus: 'ARCHIVED',
      archivedAt: new Date(),
      archivedBy: actor.userId,
    },
  });

  await recordAudit({
    orgId: actor.orgId,
    userId: actor.userId,
    action: 'report.archived',
    resource: 'report',
    resourceId: id,
    oldValue: { lifecycleStatus: existing.lifecycleStatus },
    newValue: { lifecycleStatus: row.lifecycleStatus, archivedBy: actor.userId },
    ipAddress: actor.ipAddress,
  });

  logger.info({ reportId: id, orgId: actor.orgId, userId: actor.userId }, 'Report archived');
  return row;
}

/**
 * Fetch a published report by share token. No auth — safe because the token
 * is unguessable (24 random bytes) and only set after an ORG_ADMIN publishes.
 * Returns 404 for any other lifecycle state so unpublished reports cannot
 * leak via stale tokens.
 */
export async function getPublishedReportByToken(shareToken: string) {
  const report = await prisma.report.findUnique({ where: { shareToken } });
  if (!report || report.lifecycleStatus !== 'PUBLISHED') {
    throw new AppError(404, 'Not Found', 'Published report not found');
  }
  return {
    id: report.id,
    type: report.type,
    publishedAt: report.publishedAt,
    reportData: report.reportData,
  };
}
