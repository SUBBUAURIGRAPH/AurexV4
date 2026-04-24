import { prisma } from '@aurex/database';
import type { PaginatedResponse } from '@aurex/shared';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from './audit-log.service.js';

export interface SupplierResult {
  id: string;
  orgId: string;
  name: string;
  email: string;
  contactPerson: string | null;
  category: string | null;
  externalId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierRequestResult {
  id: string;
  supplierId: string;
  orgId: string;
  title: string;
  description: string | null;
  dataScope: string;
  periodStart: Date;
  periodEnd: Date;
  dueBy: Date | null;
  status: string;
  submittedValue: unknown;
  submittedAt: Date | null;
  reviewNotes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  supplier?: SupplierResult;
}

export async function listSuppliers(
  orgId: string,
  params: { status?: string; category?: string; search?: string; page: number; pageSize: number },
): Promise<PaginatedResponse<SupplierResult>> {
  const where: Record<string, unknown> = { orgId };
  if (params.status) where.status = params.status;
  if (params.category) where.category = params.category;
  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  const skip = (params.page - 1) * params.pageSize;

  const [rows, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      skip,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.supplier.count({ where }),
  ]);

  return {
    data: rows as unknown as SupplierResult[],
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

export async function getSupplier(id: string, orgId: string): Promise<SupplierResult> {
  const row = await prisma.supplier.findFirst({ where: { id, orgId } });
  if (!row) throw new AppError(404, 'Not Found', 'Supplier not found');
  return row as unknown as SupplierResult;
}

export async function createSupplier(
  orgId: string,
  userId: string,
  data: {
    name: string;
    email: string;
    contactPerson?: string;
    category?: string;
    externalId?: string;
    status?: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  },
  ipAddress?: string,
): Promise<SupplierResult> {
  const existing = await prisma.supplier.findFirst({ where: { orgId, email: data.email } });
  if (existing) {
    throw new AppError(409, 'Conflict', 'A supplier with this email already exists');
  }

  const row = await prisma.supplier.create({
    data: {
      orgId,
      name: data.name,
      email: data.email,
      contactPerson: data.contactPerson ?? null,
      category: data.category ?? null,
      externalId: data.externalId ?? null,
      status: (data.status ?? 'INVITED') as never,
    },
  });

  await recordAudit({
    orgId,
    userId,
    action: 'supplier.created',
    resource: 'supplier',
    resourceId: row.id,
    newValue: { name: data.name, email: data.email, status: row.status },
    ipAddress,
  });

  logger.info({ supplierId: row.id, orgId }, 'Supplier created');
  return row as unknown as SupplierResult;
}

export async function updateSupplier(
  id: string,
  orgId: string,
  userId: string,
  data: Record<string, unknown>,
  ipAddress?: string,
): Promise<SupplierResult> {
  const existing = await prisma.supplier.findFirst({ where: { id, orgId } });
  if (!existing) throw new AppError(404, 'Not Found', 'Supplier not found');

  const row = await prisma.supplier.update({ where: { id }, data: data as never });

  await recordAudit({
    orgId,
    userId,
    action: 'supplier.updated',
    resource: 'supplier',
    resourceId: id,
    oldValue: { name: existing.name, status: existing.status },
    newValue: data,
    ipAddress,
  });

  logger.info({ supplierId: id, orgId }, 'Supplier updated');
  return row as unknown as SupplierResult;
}

export async function deleteSupplier(
  id: string,
  orgId: string,
  userId: string,
  ipAddress?: string,
): Promise<void> {
  const existing = await prisma.supplier.findFirst({ where: { id, orgId } });
  if (!existing) throw new AppError(404, 'Not Found', 'Supplier not found');
  await prisma.supplier.delete({ where: { id } });

  await recordAudit({
    orgId,
    userId,
    action: 'supplier.deleted',
    resource: 'supplier',
    resourceId: id,
    oldValue: { name: existing.name },
    ipAddress,
  });

  logger.info({ supplierId: id, orgId }, 'Supplier deleted');
}

// ─── Data requests ──────────────────────────────────────────────────────

export async function createDataRequest(
  supplierId: string,
  orgId: string,
  userId: string,
  data: {
    title: string;
    description?: string;
    dataScope: string;
    periodStart: string;
    periodEnd: string;
    dueBy?: string;
  },
  ipAddress?: string,
): Promise<SupplierRequestResult> {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, orgId } });
  if (!supplier) throw new AppError(404, 'Not Found', 'Supplier not found');

  const row = await prisma.supplierDataRequest.create({
    data: {
      supplierId,
      orgId,
      title: data.title,
      description: data.description ?? null,
      dataScope: data.dataScope,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      dueBy: data.dueBy ? new Date(data.dueBy) : null,
      createdBy: userId,
    },
  });

  await recordAudit({
    orgId,
    userId,
    action: 'supplier.request.created',
    resource: 'supplier_data_request',
    resourceId: row.id,
    newValue: { supplierId, title: data.title, dataScope: data.dataScope },
    ipAddress,
  });

  logger.info({ requestId: row.id, supplierId, orgId }, 'Supplier data request created');
  return row as unknown as SupplierRequestResult;
}

export async function listDataRequests(
  orgId: string,
  params: { status?: string; supplierId?: string; page: number; pageSize: number },
): Promise<PaginatedResponse<SupplierRequestResult>> {
  const where: Record<string, unknown> = { orgId };
  if (params.status) where.status = params.status;
  if (params.supplierId) where.supplierId = params.supplierId;
  const skip = (params.page - 1) * params.pageSize;

  const [rows, total] = await Promise.all([
    prisma.supplierDataRequest.findMany({
      where,
      include: { supplier: true },
      skip,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.supplierDataRequest.count({ where }),
  ]);

  return {
    data: rows as unknown as SupplierRequestResult[],
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

export async function getDataRequest(
  id: string,
  orgId: string,
): Promise<SupplierRequestResult> {
  const row = await prisma.supplierDataRequest.findFirst({
    where: { id, orgId },
    include: { supplier: true },
  });
  if (!row) throw new AppError(404, 'Not Found', 'Data request not found');
  return row as unknown as SupplierRequestResult;
}

export async function submitDataRequest(
  id: string,
  orgId: string,
  userId: string,
  submittedValue: unknown,
  ipAddress?: string,
): Promise<SupplierRequestResult> {
  const existing = await prisma.supplierDataRequest.findFirst({ where: { id, orgId } });
  if (!existing) throw new AppError(404, 'Not Found', 'Data request not found');
  if (existing.status !== 'PENDING') {
    throw new AppError(409, 'Conflict', `Cannot submit a request in ${existing.status} state`);
  }

  const row = await prisma.supplierDataRequest.update({
    where: { id },
    data: {
      submittedValue: submittedValue as never,
      submittedAt: new Date(),
      status: 'SUBMITTED' as never,
    },
  });

  await recordAudit({
    orgId,
    userId,
    action: 'supplier.request.submitted',
    resource: 'supplier_data_request',
    resourceId: id,
    ipAddress,
  });

  logger.info({ requestId: id, orgId }, 'Supplier data request submitted');
  return row as unknown as SupplierRequestResult;
}

export async function decideDataRequest(
  id: string,
  orgId: string,
  userId: string,
  decision: 'ACCEPTED' | 'REJECTED' | 'CANCELLED',
  reviewNotes?: string,
  ipAddress?: string,
): Promise<SupplierRequestResult> {
  const existing = await prisma.supplierDataRequest.findFirst({ where: { id, orgId } });
  if (!existing) throw new AppError(404, 'Not Found', 'Data request not found');

  // ACCEPTED/REJECTED are only valid from SUBMITTED; CANCELLED is valid from
  // PENDING or SUBMITTED so buyers can withdraw outstanding requests.
  if (decision === 'CANCELLED') {
    if (existing.status === 'ACCEPTED' || existing.status === 'REJECTED' || existing.status === 'CANCELLED') {
      throw new AppError(409, 'Conflict', `Cannot cancel a request in ${existing.status} state`);
    }
  } else if (existing.status !== 'SUBMITTED') {
    throw new AppError(409, 'Conflict', `Cannot ${decision.toLowerCase()} a request in ${existing.status} state`);
  }

  const row = await prisma.supplierDataRequest.update({
    where: { id },
    data: {
      status: decision as never,
      reviewNotes: reviewNotes ?? null,
    },
  });

  await recordAudit({
    orgId,
    userId,
    action: `supplier.request.${decision.toLowerCase()}`,
    resource: 'supplier_data_request',
    resourceId: id,
    oldValue: { status: existing.status },
    newValue: { status: decision, reviewNotes: reviewNotes ?? null },
    ipAddress,
  });

  logger.info({ requestId: id, orgId, decision }, 'Supplier data request decided');
  return row as unknown as SupplierRequestResult;
}
