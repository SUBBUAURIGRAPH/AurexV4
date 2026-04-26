import { prisma } from '@aurex/database';
import { logger } from '../../lib/logger.js';
import { listForUser as listConsentForUser } from './consent.service.js';

/**
 * AAT-R3 / AV4-430 — Data Principal request (DSAR) service.
 *
 * DPDP §11–§14 obliges fiduciaries to honour data principal requests for
 * access (export of stored personal data), correction (update of
 * inaccurate data) and erasure (deletion). Our model:
 *
 *   - All three flow through `DataPrincipalRequest` rows so admins have
 *     a single queue to work through.
 *   - Access requests get an inline, synchronous JSON export of the
 *     user's profile + emissions records + retirement statements +
 *     consent history. This is the "basic" export — the full-fat
 *     export across all 24 entities is a follow-up task tracked in
 *     the runbook.
 *   - Correction & erasure requests stay in `pending` until an admin
 *     completes them (no auto-erasure — DPDP §17 carries lots of
 *     legal-hold exemptions and the operator must do that decision).
 *
 * Email notifications on state transitions are stubbed — see the TODO
 * markers below; they will be wired into the SES outbound queue in a
 * follow-up.
 */

export type DsarRequestType = 'access' | 'correction' | 'erasure';
export type DsarStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

export interface DataPrincipalRequestDto {
  id: string;
  userId: string;
  requestType: DsarRequestType;
  status: DsarStatus;
  requestNotes: string | null;
  responseUrl: string | null;
  responseNotes: string | null;
  requestedAt: string;
  completedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  handlerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DsarRow {
  id: string;
  userId: string;
  requestType: string;
  status: string;
  requestNotes: string | null;
  responseUrl: string | null;
  responseNotes: string | null;
  requestedAt: Date;
  completedAt: Date | null;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  handlerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(row: DsarRow): DataPrincipalRequestDto {
  return {
    id: row.id,
    userId: row.userId,
    requestType: row.requestType as DsarRequestType,
    status: row.status as DsarStatus,
    requestNotes: row.requestNotes,
    responseUrl: row.responseUrl,
    responseNotes: row.responseNotes,
    requestedAt: row.requestedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectedReason: row.rejectedReason,
    handlerUserId: row.handlerUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface CreateDsarParams {
  userId: string;
  requestType: DsarRequestType;
  requestNotes?: string | null;
}

export async function createRequest(
  params: CreateDsarParams,
): Promise<DataPrincipalRequestDto> {
  const row = (await prisma.dataPrincipalRequest.create({
    data: {
      userId: params.userId,
      requestType: params.requestType,
      requestNotes: params.requestNotes ?? null,
      status: 'pending',
    },
  })) as unknown as DsarRow;

  // TODO(AAT-R3-FOLLOWUP): enqueue SES email to ops@aurex.in notifying
  // privacy team of new DSAR. For now the row is the source of truth +
  // the audit log captures the create event from the route handler.
  logger.info(
    { dsarId: row.id, userId: params.userId, type: params.requestType },
    'DPDP DSAR created',
  );

  return toDto(row);
}

export async function listForUser(
  userId: string,
): Promise<DataPrincipalRequestDto[]> {
  const rows = (await prisma.dataPrincipalRequest.findMany({
    where: { userId },
    orderBy: { requestedAt: 'desc' },
  })) as unknown as DsarRow[];
  return rows.map(toDto);
}

export interface ListAllParams {
  status?: DsarStatus;
  page: number;
  pageSize: number;
}

export async function listAll(params: ListAllParams): Promise<{
  items: DataPrincipalRequestDto[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;

  const skip = (params.page - 1) * params.pageSize;
  const [rows, total] = await Promise.all([
    prisma.dataPrincipalRequest.findMany({
      where,
      skip,
      take: params.pageSize,
      orderBy: { requestedAt: 'desc' },
    }) as unknown as Promise<DsarRow[]>,
    prisma.dataPrincipalRequest.count({ where }),
  ]);

  return {
    items: rows.map(toDto),
    total,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export interface CompleteDsarParams {
  requestId: string;
  handlerUserId: string;
  responseUrl?: string | null;
  responseNotes?: string | null;
}

export async function completeRequest(
  params: CompleteDsarParams,
): Promise<DataPrincipalRequestDto | null> {
  const existing = (await prisma.dataPrincipalRequest.findUnique({
    where: { id: params.requestId },
  })) as unknown as DsarRow | null;
  if (!existing) return null;

  const updated = (await prisma.dataPrincipalRequest.update({
    where: { id: params.requestId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      handlerUserId: params.handlerUserId,
      responseUrl: params.responseUrl ?? null,
      responseNotes: params.responseNotes ?? null,
    },
  })) as unknown as DsarRow;

  // TODO(AAT-R3-FOLLOWUP): SES email to data principal with download
  // link / completion notice.
  logger.info(
    { dsarId: updated.id, handlerUserId: params.handlerUserId },
    'DPDP DSAR completed',
  );

  return toDto(updated);
}

export interface RejectDsarParams {
  requestId: string;
  handlerUserId: string;
  rejectedReason: string;
}

export async function rejectRequest(
  params: RejectDsarParams,
): Promise<DataPrincipalRequestDto | null> {
  const existing = (await prisma.dataPrincipalRequest.findUnique({
    where: { id: params.requestId },
  })) as unknown as DsarRow | null;
  if (!existing) return null;

  const updated = (await prisma.dataPrincipalRequest.update({
    where: { id: params.requestId },
    data: {
      status: 'rejected',
      rejectedAt: new Date(),
      handlerUserId: params.handlerUserId,
      rejectedReason: params.rejectedReason,
    },
  })) as unknown as DsarRow;

  return toDto(updated);
}

/**
 * Build the synchronous JSON export for an access request.
 *
 * Covers user profile + emissions records the user created + retirement
 * statements the user initiated + consent history. NOTE: this is the
 * "basic" export — full export across all 24 entities (orgs, baselines,
 * targets, reports, suppliers, KYC, billing, etc.) is deferred to a
 * follow-up where it'll move to an async S3-backed job.
 */
export interface DataExportPayload {
  generatedAt: string;
  user: Record<string, unknown> | null;
  emissionsRecords: unknown[];
  retirements: unknown[];
  consentHistory: unknown[];
  notice: string;
}

export async function buildDataExport(userId: string): Promise<DataExportPayload> {
  const user = (await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      isVerified: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })) as Record<string, unknown> | null;

  const [emissionsRecords, retirements] = await Promise.all([
    prisma.emissionsRecord.findMany({
      where: { createdBy: userId },
      select: {
        id: true,
        scope: true,
        category: true,
        source: true,
        value: true,
        unit: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.retirement.findMany({
      where: { retiredByUserId: userId },
      select: {
        id: true,
        bcrSerialId: true,
        tonnesRetired: true,
        vintage: true,
        purpose: true,
        purposeNarrative: true,
        retirementCertificateUrl: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const consentHistory = await listConsentForUser(userId);

  return {
    generatedAt: new Date().toISOString(),
    user,
    emissionsRecords,
    retirements,
    consentHistory,
    notice:
      'Basic DPDP §11 export. Covers user profile, emissions records, ' +
      'retirement statements and consent history. Full multi-entity ' +
      'export (orgs, suppliers, baselines, billing, KYC) is available on ' +
      'request — file a follow-up DSAR with notes describing the entities ' +
      'required.',
  };
}
