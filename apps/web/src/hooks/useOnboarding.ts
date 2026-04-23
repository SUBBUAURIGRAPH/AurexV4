import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface OnboardingProgress {
  id: string;
  orgId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  currentStep: number;
  completedSteps: number[];
  stepData: Record<string, unknown> | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useOnboarding() {
  return useQuery({
    queryKey: ['onboarding'],
    queryFn: () => api.get<{ data: OnboardingProgress }>('/onboarding'),
  });
}

export function useSaveOnboardingStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ step, data }: { step: 1 | 2 | 3 | 4; data: Record<string, unknown> }) =>
      api.post<{ data: OnboardingProgress }>(`/onboarding/steps/${step}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
}

export function useSkipOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      api.post<{ data: OnboardingProgress }>('/onboarding/skip', reason ? { reason } : {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
}

export interface EsgFramework {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export function useEsgFrameworks() {
  return useQuery({
    queryKey: ['esg', 'frameworks'],
    queryFn: () => api.get<{ data: EsgFramework[]; pagination: unknown }>('/esg/frameworks', { isActive: true }),
  });
}
