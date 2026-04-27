import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

/**
 * FLOW-REWORK / Sprint 5 — organisational financials hook.
 * Backed by GET / PUT /api/v1/me/org/financials.
 */

export interface OrganizationFinancials {
  id: string;
  orgId: string;
  fiscalYear: number;
  fiscalYearStartMonth: number;
  currency: string;
  annualRevenue: string | null;
  totalAssets: string | null;
  employeeCount: number | null;
  contractorCount: number | null;
  industrySector: string | null;
  reportingScope: 'standalone' | 'consolidated';
  notes: string | null;
  capturedBy: string;
  capturedAt: string;
  updatedAt: string;
}

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

export function useFinancials() {
  return useQuery<{ data: OrganizationFinancials | null }>({
    queryKey: ['org-financials'],
    queryFn: () => api.get<{ data: OrganizationFinancials | null }>('/me/org/financials'),
  });
}

export function useUpsertFinancials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FinancialsInput) =>
      api.put<{ data: OrganizationFinancials }>('/me/org/financials', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-financials'] });
    },
  });
}
