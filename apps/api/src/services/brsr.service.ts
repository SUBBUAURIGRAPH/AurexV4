import { prisma } from '@aurex/database';
import type { PaginatedResponse } from '@aurex/shared';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from './audit-log.service.js';

/**
 * AAT-R2 / AV4-427 — Assurance status enum surfaced as a string union
 * to keep the column un-Prisma-enumed (cheaper migration; per-tenant
 * extensibility). The four values track the SEBI BRSR Core glide path:
 *
 *   - "unaudited"            — default, fresh response value
 *   - "internal_review"      — reviewed by an internal preparer/checker
 *   - "limited_assurance"    — third-party reviewed at limited level
 *   - "reasonable_assurance" — third-party reviewed at reasonable level
 *                              (the SEBI mandate for top-1000 listed cos.)
 *
 * Any extension MUST be additive — downstream BI dashboards filter on
 * exact string match.
 */
export const BRSR_ASSURANCE_STATUSES = [
  'unaudited',
  'internal_review',
  'limited_assurance',
  'reasonable_assurance',
] as const;

export type BrsrAssuranceStatus = (typeof BRSR_ASSURANCE_STATUSES)[number];

export function isBrsrAssuranceStatus(
  v: string,
): v is BrsrAssuranceStatus {
  return (BRSR_ASSURANCE_STATUSES as readonly string[]).includes(v);
}

export interface BrsrPrincipleResult {
  id: string;
  number: number;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  indicatorCount?: number;
}

export interface BrsrIndicatorResult {
  id: string;
  principleId: string | null;
  section: string;
  indicatorType: string;
  code: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface BrsrResponseResult {
  id: string;
  orgId: string;
  indicatorId: string;
  fiscalYear: string;
  value: unknown;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  indicator?: BrsrIndicatorResult;
  // AAT-R2 / AV4-427 — assurance-readiness audit metadata. See the
  // matching prisma fields on BrsrResponse for the full contract.
  dataProvenance: string | null;
  evidenceUrls: string[];
  lastReviewedBy: string | null;
  lastReviewedAt: Date | null;
  assuranceStatus: BrsrAssuranceStatus;
}

export async function listPrinciples(params: {
  page: number;
  pageSize: number;
}): Promise<PaginatedResponse<BrsrPrincipleResult>> {
  const skip = (params.page - 1) * params.pageSize;

  const [rows, total] = await Promise.all([
    prisma.brsrPrinciple.findMany({
      where: { isActive: true },
      include: { _count: { select: { indicators: true } } },
      skip,
      take: params.pageSize,
      orderBy: { number: 'asc' },
    }),
    prisma.brsrPrinciple.count({ where: { isActive: true } }),
  ]);

  const data = rows.map((r) => {
    const row = r as unknown as BrsrPrincipleResult & { _count?: { indicators: number } };
    return {
      id: row.id,
      number: row.number,
      title: row.title,
      description: row.description,
      isActive: row.isActive,
      createdAt: row.createdAt,
      indicatorCount: row._count?.indicators ?? 0,
    };
  });

  return {
    data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

export async function getPrinciple(id: string): Promise<BrsrPrincipleResult & { indicators: BrsrIndicatorResult[] }> {
  const row = await prisma.brsrPrinciple.findUnique({
    where: { id },
    include: { indicators: { where: { isActive: true }, orderBy: { code: 'asc' } } },
  });
  if (!row) throw new AppError(404, 'Not Found', 'Principle not found');
  return row as unknown as BrsrPrincipleResult & { indicators: BrsrIndicatorResult[] };
}

export async function listIndicators(params: {
  principleId?: string;
  section?: 'SECTION_A' | 'SECTION_B' | 'SECTION_C';
  indicatorType?: 'ESSENTIAL' | 'LEADERSHIP';
  page: number;
  pageSize: number;
}): Promise<PaginatedResponse<BrsrIndicatorResult>> {
  const where: Record<string, unknown> = { isActive: true };
  if (params.principleId) where.principleId = params.principleId;
  if (params.section) where.section = params.section;
  if (params.indicatorType) where.indicatorType = params.indicatorType;
  const skip = (params.page - 1) * params.pageSize;

  const [rows, total] = await Promise.all([
    prisma.brsrIndicator.findMany({
      where,
      skip,
      take: params.pageSize,
      orderBy: { code: 'asc' },
    }),
    prisma.brsrIndicator.count({ where }),
  ]);

  return {
    data: rows as unknown as BrsrIndicatorResult[],
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

export async function getIndicator(id: string): Promise<BrsrIndicatorResult> {
  const row = await prisma.brsrIndicator.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'Not Found', 'Indicator not found');
  return row as unknown as BrsrIndicatorResult;
}

export async function upsertResponse(
  orgId: string,
  createdBy: string,
  data: {
    indicatorId: string;
    fiscalYear: string;
    value?: unknown;
    notes?: string;
    // AAT-R2 / AV4-427 — opt-in assurance fields on upsert. None of
    // these promote a row to a higher assurance tier; that's gated to
    // the admin route. Provenance + evidenceUrls can be set by the
    // preparer at write time so the assurance auditor sees the chain
    // on first review.
    dataProvenance?: string | null;
    evidenceUrls?: string[];
  },
): Promise<BrsrResponseResult> {
  const indicator = await prisma.brsrIndicator.findUnique({ where: { id: data.indicatorId } });
  if (!indicator) throw new AppError(404, 'Not Found', 'Indicator not found');

  const row = await prisma.brsrResponse.upsert({
    where: {
      orgId_indicatorId_fiscalYear: {
        orgId,
        indicatorId: data.indicatorId,
        fiscalYear: data.fiscalYear,
      },
    },
    create: {
      orgId,
      indicatorId: data.indicatorId,
      fiscalYear: data.fiscalYear,
      value: data.value as never,
      notes: data.notes ?? null,
      createdBy,
      dataProvenance: data.dataProvenance ?? null,
      evidenceUrls: data.evidenceUrls ?? [],
      // assuranceStatus deliberately defaults via prisma to "unaudited";
      // promoting a status is gated to the admin route.
    },
    update: {
      value: data.value as never,
      notes: data.notes ?? null,
      // Only overwrite provenance + evidence on update if the caller
      // explicitly passed values — `undefined` keeps the prior value.
      ...(data.dataProvenance !== undefined
        ? { dataProvenance: data.dataProvenance }
        : {}),
      ...(data.evidenceUrls !== undefined
        ? { evidenceUrls: data.evidenceUrls }
        : {}),
    },
  });
  logger.info({ orgId, indicatorId: data.indicatorId, fiscalYear: data.fiscalYear }, 'BRSR response upserted');
  return row as unknown as BrsrResponseResult;
}

// ─── AAT-R2 / AV4-427: assurance-status admin operations ──────────────

/**
 * Result envelope for the admin assurance-set route.
 */
export interface SetAssuranceResult {
  response: BrsrResponseResult;
  /**
   * The assurance status before the set call — useful for the audit
   * log diff. When the row was already at the requested status this
   * equals `response.assuranceStatus`.
   */
  previousStatus: BrsrAssuranceStatus;
}

/**
 * Promote / demote a BRSR response's assurance status. Records an
 * `AuditLog` entry on every state change so an external auditor can
 * reconstruct the review history end-to-end.
 *
 * Auth contract: gated to admin users at the route layer. Any caller
 * passing through this function is assumed to be authorised; the
 * service itself trusts the orgId/userId tuple.
 *
 * Audit log shape (action: `brsr.assurance.update`):
 *   - resource    = `BrsrResponse`
 *   - resourceId  = response.id
 *   - oldValue    = { assuranceStatus: previousStatus, lastReviewedBy, lastReviewedAt }
 *   - newValue    = { assuranceStatus: nextStatus,     lastReviewedBy, lastReviewedAt }
 */
export async function setAssurance(
  responseId: string,
  reviewerUserId: string,
  data: {
    assuranceStatus: BrsrAssuranceStatus;
    /**
     * Optional override — defaults to `reviewerUserId`. Surfaced so
     * the admin route can attribute a sign-off to a delegated auditor
     * (e.g. an external auditor user record) while keeping the JWT
     * caller identity for the AuditLog row.
     */
    lastReviewedBy?: string | null;
    /**
     * Optional override — defaults to `new Date()`. Useful for
     * back-dating a sign-off captured offline.
     */
    lastReviewedAt?: Date | null;
    /** Optional ip address for the audit row. */
    ipAddress?: string;
  },
): Promise<SetAssuranceResult> {
  if (!isBrsrAssuranceStatus(data.assuranceStatus)) {
    throw new AppError(
      400,
      'Bad Request',
      `Invalid assurance status: "${data.assuranceStatus}" ` +
        `(expected one of ${BRSR_ASSURANCE_STATUSES.join(', ')})`,
    );
  }

  const existing = await prisma.brsrResponse.findUnique({
    where: { id: responseId },
    select: {
      id: true,
      orgId: true,
      assuranceStatus: true,
      lastReviewedBy: true,
      lastReviewedAt: true,
    },
  });
  if (!existing) {
    throw new AppError(404, 'Not Found', `BRSR response ${responseId} not found`);
  }

  const previousStatus = (existing.assuranceStatus ?? 'unaudited') as BrsrAssuranceStatus;
  const reviewedAt = data.lastReviewedAt ?? new Date();
  const reviewedBy =
    data.lastReviewedBy === undefined ? reviewerUserId : data.lastReviewedBy;

  const updated = await prisma.brsrResponse.update({
    where: { id: responseId },
    data: {
      assuranceStatus: data.assuranceStatus,
      lastReviewedBy: reviewedBy,
      lastReviewedAt: reviewedAt,
    },
    include: { indicator: true },
  });

  // Audit-log every status change, even no-op writes — auditors need
  // a record of "reviewer X re-confirmed unaudited" as much as a
  // promotion. recordAudit is best-effort; failures are swallowed.
  await recordAudit({
    orgId: existing.orgId,
    userId: reviewerUserId,
    action: 'brsr.assurance.update',
    resource: 'BrsrResponse',
    resourceId: responseId,
    oldValue: {
      assuranceStatus: previousStatus,
      lastReviewedBy: existing.lastReviewedBy,
      lastReviewedAt: existing.lastReviewedAt?.toISOString() ?? null,
    },
    newValue: {
      assuranceStatus: data.assuranceStatus,
      lastReviewedBy: reviewedBy,
      lastReviewedAt: reviewedAt.toISOString(),
    },
    ...(data.ipAddress ? { ipAddress: data.ipAddress } : {}),
  });

  logger.info(
    {
      responseId,
      previousStatus,
      nextStatus: data.assuranceStatus,
      reviewerUserId,
    },
    'BRSR assurance status updated',
  );

  return {
    response: updated as unknown as BrsrResponseResult,
    previousStatus,
  };
}

export async function listResponses(
  orgId: string,
  params: { fiscalYear?: string; principleId?: string; page: number; pageSize: number },
): Promise<PaginatedResponse<BrsrResponseResult>> {
  const where: Record<string, unknown> = { orgId };
  if (params.fiscalYear) where.fiscalYear = params.fiscalYear;
  if (params.principleId) {
    where.indicator = { principleId: params.principleId };
  }
  const skip = (params.page - 1) * params.pageSize;

  const [rows, total] = await Promise.all([
    prisma.brsrResponse.findMany({
      where,
      include: { indicator: true },
      skip,
      take: params.pageSize,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.brsrResponse.count({ where }),
  ]);

  return {
    data: rows as unknown as BrsrResponseResult[],
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

export async function getResponse(
  orgId: string,
  indicatorId: string,
  fiscalYear: string,
): Promise<BrsrResponseResult> {
  const row = await prisma.brsrResponse.findUnique({
    where: { orgId_indicatorId_fiscalYear: { orgId, indicatorId, fiscalYear } },
    include: { indicator: true },
  });
  if (!row) throw new AppError(404, 'Not Found', 'Response not found');
  return row as unknown as BrsrResponseResult;
}
