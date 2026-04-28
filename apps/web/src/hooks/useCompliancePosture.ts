/**
 * AAT-FLOW6 — compliance posture hook.
 *
 * Wraps `GET /api/v1/compliance/posture` — an aggregate read that
 * blends BRSR Core readiness, DPDP consent counts, retention policies,
 * and the most recent regulatory-research runs into a single payload
 * the Compliance Center page can render without juggling four loaders.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface RetentionPolicy {
  id: string;
  name: string;
  minRetentionYears: number;
  isDefault: boolean;
}

export interface RegulatoryRunSummary {
  id: string;
  topic: string;
  depth: string;
  summary: string | null;
  createdAt: string;
}

export interface CompliancePosture {
  brsr: {
    responseCount: number;
    assuranceBreakdown: Record<string, number>;
    fiscalYearsCovered: string[];
  };
  dpdp: {
    orgMemberCount: number;
    consentGranted: number;
    consentWithdrawn: number;
  };
  retention: {
    activePolicies: RetentionPolicy[];
  };
  research: {
    runs: RegulatoryRunSummary[];
  };
}

export function useCompliancePosture() {
  return useQuery({
    queryKey: ['compliance', 'posture'],
    queryFn: () =>
      api
        .get<{ data: CompliancePosture }>('/compliance/posture')
        .then((r) => r.data),
    staleTime: 60_000,
  });
}
