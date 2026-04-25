import { Router, type IRouter } from 'express';
import {
  onboardingStep1Schema,
  onboardingStep2Schema,
  onboardingStep3Schema,
  onboardingStep4Schema,
  skipOnboardingSchema,
} from '@aurex/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import * as onboardingService from '../services/onboarding.service.js';

export const onboardingRouter: IRouter = Router();

onboardingRouter.use(requireAuth, requireOrgScope);

onboardingRouter.get('/', async (req, res, next) => {
  try {
    const row = await onboardingService.getProgress(req.orgId!);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

onboardingRouter.post('/steps/1', async (req, res, next) => {
  try {
    const data = onboardingStep1Schema.parse(req.body);
    const row = await onboardingService.saveStep(req.orgId!, 1, data);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

onboardingRouter.post('/steps/2', async (req, res, next) => {
  try {
    const data = onboardingStep2Schema.parse(req.body);
    const row = await onboardingService.saveStep(req.orgId!, 2, data);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

onboardingRouter.post('/steps/3', async (req, res, next) => {
  try {
    const data = onboardingStep3Schema.parse(req.body);
    const row = await onboardingService.saveStep(req.orgId!, 3, data);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

onboardingRouter.post('/steps/4', async (req, res, next) => {
  try {
    const data = onboardingStep4Schema.parse(req.body);
    const row = await onboardingService.saveStep(req.orgId!, 4, data);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

onboardingRouter.post('/skip', async (req, res, next) => {
  try {
    const { reason } = skipOnboardingSchema.parse(req.body);
    const row = await onboardingService.skipOnboarding(req.orgId!, reason);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

// AAT-ONBOARD: explicit "wizard done" finaliser. The new 3-step wizard
// hits this after step 3 to atomically flip status=COMPLETED without
// also having to coerce step 4 (frameworks) into the flow.
onboardingRouter.post('/complete', async (req, res, next) => {
  try {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const row = await onboardingService.completeOnboarding(req.orgId!, body);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

onboardingRouter.delete('/', requireRole('super_admin', 'org_admin'), async (req, res, next) => {
  try {
    const row = await onboardingService.resetOnboarding(req.orgId!);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
