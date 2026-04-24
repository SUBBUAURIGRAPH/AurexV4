import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export type ActivityStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'AWAITING_HOST'
  | 'REGISTERED'
  | 'ISSUING'
  | 'CLOSED'
  | 'REJECTED';

export type CreditingPeriodType = 'RENEWABLE_5YR' | 'FIXED_10YR' | 'REMOVAL_15YR';

export interface Methodology {
  id: string;
  code: string;
  name: string;
  version: string;
  category: string;
  sectoralScope: number | null;
  summary: string | null;
  referenceUrl: string | null;
  effectiveFrom: string;
  isActive: boolean;
}

export interface MonitoringParameter {
  id: string;
  code: string;
  name: string;
  unit: string;
  measurementMethod: 'DIRECT' | 'CALCULATED' | 'DEFAULT' | 'ESTIMATED';
  frequency: string;
  equipment: string | null;
  uncertaintyPct: string | number | null;
}

export interface MonitoringPlan {
  id: string;
  activityId: string;
  version: number;
  qaqcNotes: string | null;
  createdAt: string;
  updatedAt: string;
  parameters: MonitoringParameter[];
}

export interface Activity {
  id: string;
  orgId: string;
  methodologyId: string;
  methodology?: { code: string; name: string; category: string };
  title: string;
  description: string | null;
  hostCountry: string;
  sectoralScope: number;
  technologyType: string;
  gasesCovered: string[];
  creditingPeriodType: CreditingPeriodType;
  creditingPeriodStart: string | null;
  creditingPeriodEnd: string | null;
  renewalCount: number;
  expectedAnnualEr: string | null;
  status: ActivityStatus;
  isRemoval: boolean;
  cdmTransition: boolean;
  cdmReference: string | null;
  submittedAt: string | null;
  registeredAt: string | null;
  closedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  monitoringPlan?: MonitoringPlan | null;
}

export interface CreateActivityInput {
  methodologyId: string;
  title: string;
  description?: string;
  hostCountry: string;
  sectoralScope: number;
  technologyType: string;
  gasesCovered: string[];
  creditingPeriodType: CreditingPeriodType;
  creditingPeriodStart?: string;
  creditingPeriodEnd?: string;
  expectedAnnualEr?: number;
  isRemoval?: boolean;
  cdmTransition?: boolean;
  cdmReference?: string;
}

export function useMethodologies() {
  return useQuery<{ data: Methodology[] }>({
    queryKey: ['methodologies'],
    queryFn: () => api.get<{ data: Methodology[] }>('/methodologies'),
  });
}

export function useActivities(status?: ActivityStatus) {
  return useQuery<{ data: Activity[] }>({
    queryKey: ['activities', status ?? 'all'],
    queryFn: () =>
      api.get<{ data: Activity[] }>(`/activities${status ? `?status=${status}` : ''}`),
  });
}

export function useActivity(id: string) {
  return useQuery<{ data: Activity }>({
    queryKey: ['activities', id],
    queryFn: () => api.get<{ data: Activity }>(`/activities/${id}`),
    enabled: !!id,
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateActivityInput) =>
      api.post<{ data: Activity }>('/activities', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });
}

export function useSubmitActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ data: Activity }>(`/activities/${id}/submit`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });
}
