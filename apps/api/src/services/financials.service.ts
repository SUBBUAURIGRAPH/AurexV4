/**
 * Sprint 5 / FLOW-REWORK — organisational financials service.
 *
 * Captured during onboarding step 5 ("Upload organisational financials").
 * Drives:
 *   - BRSR P9 + CSRD ESRS-2 entity-level disclosures
 *   - Emissions-intensity KPIs on the dashboard (tCO2e per ₹revenue)
 *   - Auditor reasonable-assurance context
 *
 * 1:1 with Organization. The route layer (admin-financials / financials)
 * gates on `OrgMember.role` so only ORG_ADMIN+ can write.
 */
import { prisma } from '@aurex/database';
import { logger } from '../lib/logger.js';

export interface FinancialsInput {
  fiscalYear: number;
  fiscalYearStartMonth?: number;
  currency?: string;
  annualRevenue?: number;
  totalAssets?: number;
  employeeCount?: number;
  contractorCount?: number;
  industrySector?: string;
  reportingScope?: 'standalone' | 'consolidated';
  notes?: string;
}

export interface FinancialsResult {
  id: string;
  orgId: string;
  fiscalYear: number;
  fiscalYearStartMonth: number;
  currency: string;
  annualRevenue: string | null;   // Decimal serialised
  totalAssets: string | null;
  employeeCount: number | null;
  contractorCount: number | null;
  industrySector: string | null;
  reportingScope: string;
  notes: string | null;
  capturedBy: string;
  capturedAt: Date;
  updatedAt: Date;
}

function serialise(row: unknown): FinancialsResult {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    orgId: r.orgId as string,
    fiscalYear: r.fiscalYear as number,
    fiscalYearStartMonth: r.fiscalYearStartMonth as number,
    currency: r.currency as string,
    annualRevenue: r.annualRevenue == null ? null : String(r.annualRevenue),
    totalAssets: r.totalAssets == null ? null : String(r.totalAssets),
    employeeCount: (r.employeeCount as number | null) ?? null,
    contractorCount: (r.contractorCount as number | null) ?? null,
    industrySector: (r.industrySector as string | null) ?? null,
    reportingScope: r.reportingScope as string,
    notes: (r.notes as string | null) ?? null,
    capturedBy: r.capturedBy as string,
    capturedAt: r.capturedAt as Date,
    updatedAt: r.updatedAt as Date,
  };
}

export async function getFinancials(orgId: string): Promise<FinancialsResult | null> {
  const row = await prisma.organizationFinancials.findUnique({ where: { orgId } });
  return row ? serialise(row) : null;
}

export async function upsertFinancials(
  orgId: string,
  capturedBy: string,
  input: FinancialsInput,
): Promise<FinancialsResult> {
  const data = {
    fiscalYear: input.fiscalYear,
    fiscalYearStartMonth: input.fiscalYearStartMonth ?? 4,
    currency: input.currency ?? 'INR',
    annualRevenue: input.annualRevenue ?? null,
    totalAssets: input.totalAssets ?? null,
    employeeCount: input.employeeCount ?? null,
    contractorCount: input.contractorCount ?? null,
    industrySector: input.industrySector ?? null,
    reportingScope: input.reportingScope ?? 'standalone',
    notes: input.notes ?? null,
  };

  const row = await prisma.organizationFinancials.upsert({
    where: { orgId },
    update: data,
    create: { orgId, capturedBy, ...data },
  });
  logger.info({ orgId, fiscalYear: data.fiscalYear }, 'Organisational financials saved');
  return serialise(row);
}

export async function deleteFinancials(orgId: string): Promise<void> {
  await prisma.organizationFinancials.deleteMany({ where: { orgId } });
  logger.info({ orgId }, 'Organisational financials cleared');
}
