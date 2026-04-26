import { prisma } from '@aurex/database';
import { logger } from '../../lib/logger.js';

/**
 * AAT-R3 / AV4-432 — personal data breach incident service.
 *
 * DPDP §8 obliges the data fiduciary to intimate the Data Protection
 * Board of every personal-data-breach within 72 hours of detection.
 * This service is the single write-path for `DataBreachIncident` rows
 * and computes the reporting deadline at create time so the route
 * handler can return it in the create response.
 *
 * `getOverdueBreaches()` is wired into a daily reminder pass — see the
 * `dpdp-breach-reminder.worker.ts` (opt-in via env flag, same pattern
 * as the retention worker).
 */

export const DPB_REPORTING_WINDOW_HOURS = 72;
export const DPB_REPORTING_WINDOW_MS =
  DPB_REPORTING_WINDOW_HOURS * 60 * 60 * 1000;

export type BreachSeverity = 'low' | 'medium' | 'high' | 'critical';
export type BreachStatus = 'open' | 'contained' | 'resolved' | 'reported';

export interface DataBreachIncidentDto {
  id: string;
  detectedAt: string;
  reportedAt: string | null;
  affectedUserCount: number;
  affectedDataTypes: string[];
  severity: BreachSeverity;
  description: string;
  containmentNotes: string | null;
  remediationNotes: string | null;
  status: BreachStatus;
  reportedToDpb: boolean;
  dpbReferenceId: string | null;
  reportedByUserId: string | null;
  /** ISO timestamp = `detectedAt + 72h`. */
  reportingDeadline: string;
  /** True if `now > reportingDeadline` and `reportedToDpb=false`. */
  overdue: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BreachRow {
  id: string;
  detectedAt: Date;
  reportedAt: Date | null;
  affectedUserCount: number;
  affectedDataTypes: string[];
  severity: string;
  description: string;
  containmentNotes: string | null;
  remediationNotes: string | null;
  status: string;
  reportedToDpb: boolean;
  dpbReferenceId: string | null;
  reportedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function computeReportingDeadline(detectedAt: Date): Date {
  return new Date(detectedAt.getTime() + DPB_REPORTING_WINDOW_MS);
}

function toDto(row: BreachRow, now: Date = new Date()): DataBreachIncidentDto {
  const deadline = computeReportingDeadline(row.detectedAt);
  return {
    id: row.id,
    detectedAt: row.detectedAt.toISOString(),
    reportedAt: row.reportedAt?.toISOString() ?? null,
    affectedUserCount: row.affectedUserCount,
    affectedDataTypes: row.affectedDataTypes,
    severity: row.severity as BreachSeverity,
    description: row.description,
    containmentNotes: row.containmentNotes,
    remediationNotes: row.remediationNotes,
    status: row.status as BreachStatus,
    reportedToDpb: row.reportedToDpb,
    dpbReferenceId: row.dpbReferenceId,
    reportedByUserId: row.reportedByUserId,
    reportingDeadline: deadline.toISOString(),
    overdue: !row.reportedToDpb && now > deadline,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface CreateBreachParams {
  detectedAt: Date;
  affectedUserCount?: number;
  affectedDataTypes: string[];
  severity: BreachSeverity;
  description: string;
  containmentNotes?: string | null;
  reportedByUserId?: string | null;
}

export async function createBreach(
  params: CreateBreachParams,
): Promise<DataBreachIncidentDto> {
  const row = (await prisma.dataBreachIncident.create({
    data: {
      detectedAt: params.detectedAt,
      affectedUserCount: params.affectedUserCount ?? 0,
      affectedDataTypes: params.affectedDataTypes,
      severity: params.severity,
      description: params.description,
      containmentNotes: params.containmentNotes ?? null,
      reportedByUserId: params.reportedByUserId ?? null,
      status: 'open',
      reportedToDpb: false,
    },
  })) as unknown as BreachRow;

  logger.warn(
    {
      breachId: row.id,
      severity: params.severity,
      affectedUserCount: row.affectedUserCount,
      reportingDeadline: computeReportingDeadline(row.detectedAt).toISOString(),
    },
    'DPDP breach incident logged — DPB reporting deadline set',
  );

  // TODO(AAT-R3-FOLLOWUP): high/critical breaches should page the DPO
  // immediately via SES + Slack. Stubbed for now; the row is the source
  // of truth and the daily reminder pass picks up overdue items.

  return toDto(row);
}

export interface UpdateBreachParams {
  status?: BreachStatus;
  containmentNotes?: string | null;
  remediationNotes?: string | null;
  reportedToDpb?: boolean;
  dpbReferenceId?: string | null;
  affectedUserCount?: number;
}

export async function updateBreach(
  id: string,
  params: UpdateBreachParams,
): Promise<DataBreachIncidentDto | null> {
  const existing = (await prisma.dataBreachIncident.findUnique({
    where: { id },
  })) as unknown as BreachRow | null;
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (params.status !== undefined) data.status = params.status;
  if (params.containmentNotes !== undefined) {
    data.containmentNotes = params.containmentNotes;
  }
  if (params.remediationNotes !== undefined) {
    data.remediationNotes = params.remediationNotes;
  }
  if (params.affectedUserCount !== undefined) {
    data.affectedUserCount = params.affectedUserCount;
  }
  if (params.reportedToDpb !== undefined) {
    data.reportedToDpb = params.reportedToDpb;
    if (params.reportedToDpb && !existing.reportedAt) {
      data.reportedAt = new Date();
      data.status = params.status ?? 'reported';
    }
  }
  if (params.dpbReferenceId !== undefined) {
    data.dpbReferenceId = params.dpbReferenceId;
  }

  const updated = (await prisma.dataBreachIncident.update({
    where: { id },
    data,
  })) as unknown as BreachRow;

  return toDto(updated);
}

export interface ListBreachesParams {
  status?: BreachStatus;
  page: number;
  pageSize: number;
}

export async function listBreaches(params: ListBreachesParams): Promise<{
  items: DataBreachIncidentDto[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  const skip = (params.page - 1) * params.pageSize;

  const [rows, total] = await Promise.all([
    prisma.dataBreachIncident.findMany({
      where,
      skip,
      take: params.pageSize,
      orderBy: { detectedAt: 'desc' },
    }) as unknown as Promise<BreachRow[]>,
    prisma.dataBreachIncident.count({ where }),
  ]);

  const now = new Date();
  return {
    items: rows.map((r) => toDto(r, now)),
    total,
    page: params.page,
    pageSize: params.pageSize,
  };
}

/**
 * Daily-reminder fan-in: returns every breach whose `detectedAt + 72h`
 * has elapsed without `reportedToDpb=true`. Used by the breach reminder
 * worker (or, in test envs, called directly) to nag the DPO.
 *
 * Pure read — never throws on success path; callers can drive any
 * notification channel they want off the result.
 */
export async function getOverdueBreaches(
  now: Date = new Date(),
): Promise<DataBreachIncidentDto[]> {
  // detectedAt < (now - 72h)  AND  reportedToDpb = false
  const cutoff = new Date(now.getTime() - DPB_REPORTING_WINDOW_MS);
  const rows = (await prisma.dataBreachIncident.findMany({
    where: {
      reportedToDpb: false,
      detectedAt: { lt: cutoff },
    },
    orderBy: { detectedAt: 'asc' },
  })) as unknown as BreachRow[];

  return rows.map((r) => toDto(r, now));
}

export async function getBreachById(
  id: string,
): Promise<DataBreachIncidentDto | null> {
  const row = (await prisma.dataBreachIncident.findUnique({
    where: { id },
  })) as unknown as BreachRow | null;
  return row ? toDto(row) : null;
}
