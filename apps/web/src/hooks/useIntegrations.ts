/**
 * AAT-FLOW6 — integrations status hook.
 *
 * Wraps `GET /api/v1/integrations/status` so the Operations →
 * Integrations page can render real federation-partner trust data plus
 * env-var status for the three external SaaS services we depend on
 * (Razorpay, email transport, Sumsub).
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type FederationPartner = 'AWD2' | 'HCE2' | 'AURIGRAPH';

export interface FederationPartnerRow {
  partner: FederationPartner;
  keyId: string;
  isActive: boolean;
  expiresAt: string | null;
  rotatedAt: string | null;
}

export interface ServiceStatus {
  code: 'razorpay' | 'email' | 'sumsub';
  name: string;
  category: string;
  configured: boolean;
  detail: string;
}

export interface IntegrationsStatus {
  federationPartners: FederationPartnerRow[];
  services: ServiceStatus[];
}

export function useIntegrationsStatus() {
  return useQuery({
    queryKey: ['integrations', 'status'],
    queryFn: () =>
      api
        .get<{ data: IntegrationsStatus }>('/integrations/status')
        .then((r) => r.data),
    staleTime: 60_000,
  });
}
