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
  frameworkCodes: z.array(z.string().min(1).max(20)).max(20).optional(),
  // FLOW-REWORK: step 4 also accepts subsidiary additions (the new wizard
  // ordering is org → subsidiaries → users → plan → financials → ready,
  // and subsidiaries is captured here when present). Backwards compatible
  // — frameworkCodes still parses for legacy rows.
  subsidiaries: z
    .array(
      z.object({
        name: z.string().min(2).max(255),
        slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/).optional(),
        country: z.string().max(100).optional(),
      }),
    )
    .max(50)
    .optional(),
  skipped: z.boolean().optional(),
});

// FLOW-REWORK / Sprint 5 — step 5: organisational financial dimensions.
export const onboardingStep5Schema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(4),
  currency: z.string().length(3).default('INR'),
  annualRevenue: z.number().nonnegative().optional(),
  totalAssets: z.number().nonnegative().optional(),
  employeeCount: z.number().int().nonnegative().optional(),
  contractorCount: z.number().int().nonnegative().optional(),
  industrySector: z.string().max(100).optional(),
  reportingScope: z.enum(['standalone', 'consolidated']).default('standalone'),
  notes: z.string().max(1000).optional(),
  skipped: z.boolean().optional(),
});

// FLOW-REWORK / Sprint 5 — step 6: ready-to-track marker. Captures the
// commit moment, optionally the user's acknowledgement that they want to
// move on to entering their first emission record.
export const onboardingStep6Schema = z.object({
  acknowledged: z.boolean(),
  baselineYear: z.number().int().min(2000).max(2100).optional(),
  notes: z.string().max(500).optional(),
});

export const skipOnboardingSchema = z.object({
  reason: z.string().max(200).optional(),
});

export type OnboardingStep1Input = z.infer<typeof onboardingStep1Schema>;
export type OnboardingStep2Input = z.infer<typeof onboardingStep2Schema>;
export type OnboardingStep3Input = z.infer<typeof onboardingStep3Schema>;
export type OnboardingStep4Input = z.infer<typeof onboardingStep4Schema>;
export type OnboardingStep5Input = z.infer<typeof onboardingStep5Schema>;
export type OnboardingStep6Input = z.infer<typeof onboardingStep6Schema>;
export type SkipOnboardingInput = z.infer<typeof skipOnboardingSchema>;
