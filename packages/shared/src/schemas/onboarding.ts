import { z } from 'zod';

export const onboardingStep1Schema = z.object({
  name: z.string().min(2).max(200),
  industry: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  website: z.string().url().max(255).optional().or(z.literal('')),
});

export const onboardingStep2Schema = z.object({
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  reportingStandard: z.enum(['GHG_PROTOCOL', 'ISO_14064', 'GRI', 'CUSTOM']),
  baseYear: z.number().int().min(2000).max(2100),
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
