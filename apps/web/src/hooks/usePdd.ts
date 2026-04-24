import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

/**
 * AV4-335: PDD (Project Design Document) hooks.
 *
 * Tabs 1-9 of the wizard each write a section into `content`:
 *   projectInfo, boundaries, baseline       — tabs 1-3 (AAT-4)
 *   additionality, leakage, sdgs,           — tabs 4, 6, 7 (AAT-6)
 *   stakeholder, attachments                — tabs 8, 9 (AAT-6)
 * Tab 5 (monitoring summary) is read-only from the MonitoringPlan entity.
 *
 * The persisted `content` shape is typed here as `PddContent`, though the
 * server stores it as free-form JSON — the additional keys carry through
 * untouched.
 */

// ─── Sub-types per wizard tab ──────────────────────────────────────────

export interface PddProjectInfo {
  title?: string;
  description?: string;
  technologyType?: string;
  hostCountry?: string;
  creditingPeriodStart?: string | null;
  creditingPeriodEnd?: string | null;
}

export interface PddBoundaries {
  geojson?: string;
  notes?: string;
}

export interface PddBaseline {
  narrative?: string;
  methodologyVersion?: string;
  counterfactual?: string;
}

export interface PddAdditionalityInvestment {
  expectedIrrPct?: number | null;
  benchmarkIrrPct?: number | null;
  npvWithoutCredits?: number | null;
  npvWithCredits?: number | null;
  narrative?: string;
}

export type PddBarrierKind = 'financial' | 'technological' | 'institutional' | 'other';

export interface PddBarrier {
  kind: PddBarrierKind;
  checked: boolean;
  narrative?: string;
}

export interface PddCommonPractice {
  sectorPenetrationPct?: number | null;
  narrative?: string;
}

export interface PddAdditionality {
  investment?: PddAdditionalityInvestment;
  barriers?: PddBarrier[];
  commonPractice?: PddCommonPractice;
  lockInRisk?: string;
}

export type PddLeakageCategory = 'upstream' | 'downstream' | 'market' | 'activity-shifting';

export interface PddLeakageEntry {
  category: PddLeakageCategory;
  methodology?: string;
  estimatedLeakageTco2e?: number | null;
}

export interface PddLeakage {
  categories?: PddLeakageEntry[];
  overallNarrative?: string;
}

export interface PddSdgIndicatorValue {
  indicatorCode: string;
  value?: number | null;
  unit?: string;
  notes?: string;
  evidenceUrl?: string;
}

export interface PddSdgs {
  selected?: string[]; // SDG codes e.g. ["SDG_7", "SDG_13"]
  indicatorValues?: PddSdgIndicatorValue[];
}

export interface PddConsultation {
  date?: string;
  stakeholderGroup?: string;
  summary?: string;
  proofUrl?: string;
}

export interface PddStakeholder {
  consultations?: PddConsultation[];
}

export interface PddAttachment {
  id: string;
  name: string;
  description?: string;
  category?: string;
  uploadedAt: string;
  uploadUrl?: string;
}

export interface PddContent {
  projectInfo?: PddProjectInfo;
  boundaries?: PddBoundaries;
  baseline?: PddBaseline;
  additionality?: PddAdditionality;
  leakage?: PddLeakage;
  sdgs?: PddSdgs;
  stakeholder?: PddStakeholder;
  attachments?: PddAttachment[];
  [k: string]: unknown;
}

// ─── PDD envelope ──────────────────────────────────────────────────────

export interface Pdd {
  id: string;
  activityId: string;
  version: number;
  content: PddContent;
  documentUrl: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PddVersionRow {
  id: string;
  version: number;
  submittedAt: string | null;
  submittedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export function usePdd(activityId: string | undefined) {
  return useQuery<{ data: Pdd | null }>({
    queryKey: ['pdd', activityId],
    queryFn: () => api.get<{ data: Pdd | null }>(`/pdds/${activityId}`),
    enabled: !!activityId,
  });
}

export function usePddVersions(activityId: string | undefined) {
  return useQuery<{ data: PddVersionRow[] }>({
    queryKey: ['pdd', activityId, 'versions'],
    queryFn: () => api.get<{ data: PddVersionRow[] }>(`/pdds/${activityId}/versions`),
    enabled: !!activityId,
  });
}

export function useUpsertPdd(activityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: Record<string, unknown>) =>
      api.put<{ data: Pdd }>(`/pdds/${activityId}`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pdd', activityId] });
    },
  });
}

export function useSubmitPdd(activityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ data: Pdd }>(`/pdds/${activityId}/submit`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pdd', activityId] });
      qc.invalidateQueries({ queryKey: ['activities', activityId] });
    },
  });
}

// ─── Attachments stub (AV4-335 → AV4-338) ──────────────────────────────

export interface AttachmentSignResponse {
  attachmentId: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  note: string;
  expiresIn: number;
}

export function useSignPddAttachment(activityId: string) {
  return useMutation({
    mutationFn: (input: { filename: string; contentType?: string; sizeBytes?: number }) =>
      api.post<{ data: AttachmentSignResponse }>(
        `/pdds/${activityId}/attachments/sign`,
        input,
      ),
  });
}

// ─── SD-Tool hooks (AV4-337 routes) ────────────────────────────────────

export interface Sdg {
  code: string; // "SDG_7"
  name: string;
  description: string;
  iconUrl: string | null;
  isActive: boolean;
}

export interface SdIndicator {
  code: string; // "SDG_7.1"
  sdgCode: string;
  name: string;
  description: string;
  unit: string;
  measurementGuidance: string | null;
  isActive: boolean;
}

export function useSdgs() {
  return useQuery<{ data: Sdg[] }>({
    queryKey: ['sd-tool', 'sdgs'],
    queryFn: () => api.get<{ data: Sdg[] }>('/sd-tool/sdgs'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSdIndicators(sdgCode?: string) {
  return useQuery<{ data: SdIndicator[] }>({
    queryKey: ['sd-tool', 'indicators', sdgCode ?? 'all'],
    queryFn: () =>
      api.get<{ data: SdIndicator[] }>(
        `/sd-tool/sd-indicators${sdgCode ? `?sdg=${encodeURIComponent(sdgCode)}` : ''}`,
      ),
    staleTime: 10 * 60 * 1000,
  });
}

export interface SdContributionInput {
  indicatorCode: string;
  value: number;
  unit: string;
  notes?: string;
  evidenceUrl?: string;
}

export function useUpsertSdContributions(activityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contributions: SdContributionInput[]) =>
      api.put<{ data: unknown[] }>(`/sd-tool/activities/${activityId}/sd-contributions`, {
        contributions,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sd-tool'] });
      qc.invalidateQueries({ queryKey: ['activities', activityId] });
    },
  });
}
