import { z } from 'zod';

export const onboardingStep1Schema = z.object({
  name: z.string().min(2).max(200),
  industry: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  website: z.string().url().max(255).optional().or(z.literal('')),
  // AAT-ONBOARD additions — captured by the new wizard, persisted in
  // OnboardingProgress.stepData. Pricing currency + plan eligibility
  // are derived downstream from `region` and `customerSize`.
  region: z.enum(['INDIA', 'INTERNATIONAL']).optional(),
  customerSize: z.enum(['SME_MSME', 'ENTERPRISE']).optional(),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
});

export const onboardingStep2Schema = z.object({
  // The legacy fields stay optional so the existing GHG-config UX still
  // round-trips through OnboardingProgress.stepData; the new wizard
  // doesn't collect them at step 2 but keeps them available for a later
  // pass once billing lands.
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  reportingStandard: z.enum(['GHG_PROTOCOL', 'ISO_14064', 'GRI', 'CUSTOM']).optional(),
  baseYear: z.number().int().min(2000).max(2100).optional(),
  // AAT-ONBOARD additions: plan / voucher state. `selectedPlan` is null
  // when the user is on a trial or has skipped plan selection.
  trialAcknowledged: z.boolean().optional(),
  selectedPlan: z
    .enum(['INDIA_MSME', 'INDIA_ENTERPRISE', 'INTL_SME', 'INTL_ENTERPRISE'])
    .nullable()
    .optional(),
  skipped: z.boolean().optional(),
});

export const onboardingStep3Schema = z.object({
  additionalInvites: z
    .array(
      z.object({
        email: z.string().email(),
        role: z.string().min(1).max(50),
      }),
    )
    .max(10)
    .optional(),
});

export const onboardingStep4Schema = z.object({
  frameworkCodes: z.array(z.string().min(1).max(20)).max(20),
});

export const skipOnboardingSchema = z.object({
  reason: z.string().max(200).optional(),
});

export type OnboardingStep1Input = z.infer<typeof onboardingStep1Schema>;
export type OnboardingStep2Input = z.infer<typeof onboardingStep2Schema>;
export type OnboardingStep3Input = z.infer<typeof onboardingStep3Schema>;
export type OnboardingStep4Input = z.infer<typeof onboardingStep4Schema>;
export type SkipOnboardingInput = z.infer<typeof skipOnboardingSchema>;
