import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type CreditAccountType =
  | 'ACTIVITY_PARTICIPANT'
  | 'HOST_PARTY'
  | 'ADAPTATION_FUND'
  | 'OMGE_CANCELLATION'
  | 'REVERSAL_BUFFER'
  | 'RETIREMENT_NDC'
  | 'RETIREMENT_OIMP'
  | 'RETIREMENT_VOLUNTARY';

export interface CreditAccount {
  id: string;
  accountType: CreditAccountType;
  name: string;
  orgId: string | null;
  activityId: string | null;
  hostCountry: string | null;
  isActive: boolean;
  activity?: { id: string; title: string; status: string };
  _count?: { holdings: number };
  createdAt: string;
}

export interface CreditUnitBlock {
  id: string;
  serialFirst: string;
  serialLast: string;
  unitCount: string; // Decimal as string from Prisma
  unitType: 'A6_4ER' | 'A6_4ER_MC';
  vintage: number;
  activityId: string;
  hostCountry: string;
  issuanceDate: string;
  holderAccountId: string;
  authorizationStatus: 'NDC_USE' | 'OIMP' | 'NDC_AND_OIMP' | 'MITIGATION_CONTRIBUTION';
  caStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPLIED' | 'REVERSED';
  firstTransferAt: string | null;
  retirementStatus: string;
  retirementNarrative: string | null;
  retiredAt: string | null;
}

export interface AccountHoldings {
  account: CreditAccount & { holdings: CreditUnitBlock[] };
  summary: {
    totalActive: number;
    byType: Record<string, number>;
    blockCount: number;
  };
}

export function useCreditAccounts() {
  return useQuery<{ data: CreditAccount[] }>({
    queryKey: ['credit-accounts'],
    queryFn: () => api.get<{ data: CreditAccount[] }>('/credits/accounts'),
  });
}

export function useAccountHoldings(accountId: string) {
  return useQuery<{ data: AccountHoldings }>({
    queryKey: ['credit-accounts', accountId],
    queryFn: () => api.get<{ data: AccountHoldings }>(`/credits/accounts/${accountId}`),
    enabled: !!accountId,
  });
}
