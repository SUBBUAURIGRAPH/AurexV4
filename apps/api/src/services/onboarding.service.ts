import { prisma } from '@aurex/database';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';

export interface OnboardingProgressResult {
  id: string;
  orgId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  currentStep: number;
  completedSteps: number[];
  stepData: Record<string, unknown> | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

async function ensureProgress(orgId: string): Promise<OnboardingProgressResult> {
  const existing = await prisma.onboardingProgress.findUnique({ where: { orgId } });
  if (existing) return existing as unknown as OnboardingProgressResult;

  const created = await prisma.onboardingProgress.create({
    data: {
      orgId,
      status: 'IN_PROGRESS',
      currentStep: 1,
      completedSteps: [],
    },
  });
  return created as unknown as OnboardingProgressResult;
}

export async function getProgress(orgId: string): Promise<OnboardingProgressResult> {
  return ensureProgress(orgId);
}

export async function saveStep(
  orgId: string,
  step: 1 | 2 | 3 | 4,
  data: Record<string, unknown>,
): Promise<OnboardingProgressResult> {
  const progress = await ensureProgress(orgId);

  if (progress.status !== 'IN_PROGRESS') {
    throw new AppError(409, 'Conflict', `Onboarding is already ${progress.status.toLowerCase()}`);
  }

  if (step > progress.currentStep + 1 || step > 4) {
    throw new AppError(400, 'Bad Request', `Cannot skip to step ${step}; current step is ${progress.currentStep}`);
  }

  if (step === 1) {
    const profile = data as { name: string; industry?: string; country?: string };
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        name: profile.name,
        ...(profile.industry !== undefined ? {} : {}),
      },
    });
  }

  const currentStepData = (progress.stepData ?? {}) as Record<string, unknown>;
  currentStepData[`step${step}`] = data;

  const completedSteps = Array.from(new Set([...progress.completedSteps, step])).sort((a, b) => a - b);
  const newCurrentStep = step === progress.currentStep ? Math.min(step + 1, 4) : progress.currentStep;

  const isComplete = step === 4;

  const updated = await prisma.onboardingProgress.update({
    where: { orgId },
    data: {
      stepData: currentStepData as never,
      completedSteps,
      currentStep: newCurrentStep,
      status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
      completedAt: isComplete ? new Date() : null,
    },
  });

  logger.info({ orgId, step, isComplete }, 'Onboarding step saved');
  return updated as unknown as OnboardingProgressResult;
}

/**
 * AAT-ONBOARD: explicit completion endpoint for the 3-step wizard.
 *
 * The existing step-driven flow (saveStep with step=4) still works for
 * the legacy 4-step UI. The new wizard collects different signals (org
 * size, region, plan choice, invites) and finishes after step 3 — the
 * model's `completed=true` is the single source of truth, the steps are
 * just journal entries. This helper marks the run done idempotently.
 */
export async function completeOnboarding(
  orgId: string,
  finalStepData?: Record<string, unknown>,
): Promise<OnboardingProgressResult> {
  const progress = await ensureProgress(orgId);

  if (progress.status === 'COMPLETED') {
    // Idempotent — re-completing is a no-op so refreshes / double-clicks
    // don't throw.
    return progress;
  }

  const stepData = (progress.stepData ?? {}) as Record<string, unknown>;
  if (finalStepData) {
    stepData.completion = finalStepData;
  }

  const updated = await prisma.onboardingProgress.update({
    where: { orgId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      stepData: stepData as never,
    },
  });
  logger.info({ orgId }, 'Onboarding completed (wizard)');
  return updated as unknown as OnboardingProgressResult;
}

export async function skipOnboarding(orgId: string, reason?: string): Promise<OnboardingProgressResult> {
  const progress = await ensureProgress(orgId);

  const stepData = (progress.stepData ?? {}) as Record<string, unknown>;
  if (reason) stepData.skipReason = reason;

  const updated = await prisma.onboardingProgress.update({
    where: { orgId },
    data: {
      status: 'SKIPPED',
      completedAt: new Date(),
      stepData: stepData as never,
    },
  });
  logger.info({ orgId, reason }, 'Onboarding skipped');
  return updated as unknown as OnboardingProgressResult;
}

export async function resetOnboarding(orgId: string): Promise<OnboardingProgressResult> {
  await prisma.onboardingProgress.deleteMany({ where: { orgId } });
  const created = await prisma.onboardingProgress.create({
    data: { orgId, status: 'IN_PROGRESS', currentStep: 1, completedSteps: [] },
  });
  logger.info({ orgId }, 'Onboarding reset');
  return created as unknown as OnboardingProgressResult;
}
