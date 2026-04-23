import { prisma } from '@aurex/database';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';
import { collectDescendantOrgIds } from './organization.service.js';

export interface GenerateReportData {
  orgId: string;
  createdBy: string;
  type: string;
  year: number;
  scopes: string[];
  includeSubsidiaries?: boolean;
}

export async function generateReport(data: GenerateReportData) {
  // Create the report record
  const report = await (prisma as any).report.create({
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

  // For now, generate synchronously
  try {
    const reportData = await buildReportData(
      data.orgId,
      data.type,
      data.year,
      data.scopes,
      data.includeSubsidiaries,
    );

    const completed = await (prisma as any).report.update({
      where: { id: report.id },
      data: {
        status: 'COMPLETED',
        reportData,
      },
    });

    logger.info({ reportId: report.id, type: data.type, orgId: data.orgId }, 'Report generated');
    return completed;
  } catch (err) {
    await (prisma as any).report.update({
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
  // Pull aggregated emissions data for the specified year and scopes
  const periodStart = new Date(`${year}-01-01T00:00:00Z`);
  const periodEnd = new Date(`${year + 1}-01-01T00:00:00Z`);

  const orgIds = includeSubsidiaries ? await collectDescendantOrgIds([orgId]) : [orgId];

  const emissions = await prisma.emissionsRecord.findMany({
    where: {
      orgId: { in: orgIds },
      scope: { in: scopes as any },
      status: 'VERIFIED',
      periodStart: { gte: periodStart },
      periodEnd: { lt: periodEnd },
    },
    orderBy: [{ scope: 'asc' }, { category: 'asc' }],
  });

  // Aggregate by scope
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

  // Pull baselines for context
  const baselines = await prisma.emissionsBaseline.findMany({
    where: {
      orgId: { in: orgIds },
      scope: { in: scopes as any },
      isActive: true,
    },
  });

  // Pull targets for context
  const targets = await prisma.emissionsTarget.findMany({
    where: {
      orgId: { in: orgIds },
      scope: { in: scopes as any },
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
    baselines: baselines.map((b: any) => ({
      id: b.id,
      name: b.name,
      scope: b.scope,
      baseYear: b.baseYear,
      value: Number(b.value),
      unit: b.unit,
    })),
    targets: targets.map((t: any) => ({
      id: t.id,
      name: t.name,
      scope: t.scope,
      targetYear: t.targetYear,
      reduction: Number(t.reduction),
      pathway: t.pathway,
      isApproved: t.isApproved,
      currentProgress: t.progress.length > 0
        ? {
            actual: Number(t.progress[0].actual),
            projected: t.progress[0].projected ? Number(t.progress[0].projected) : null,
            variance: t.progress[0].variance ? Number(t.progress[0].variance) : null,
          }
        : null,
    })),
  };
}

export async function getReportStatus(id: string, orgId: string) {
  const report = await (prisma as any).report.findFirst({
    where: { id, orgId },
    select: { id: true, status: true, type: true, createdAt: true },
  });

  if (!report) {
    throw new AppError(404, 'Not Found', 'Report not found');
  }

  return report;
}

export async function downloadReport(id: string, orgId: string) {
  const report = await (prisma as any).report.findFirst({
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
  return (prisma as any).report.findMany({
    where: { orgId },
    select: {
      id: true,
      type: true,
      status: true,
      parameters: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}
