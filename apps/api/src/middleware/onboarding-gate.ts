import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@aurex/database';
import { logger } from '../lib/logger.js';

/**
 * AAT-WORKFLOW (Wave 9a): Onboarding completion gate.
 *
 * Tester feedback (2026-04-25): "Without creating the organization and
 * subsidiaries it allows emission data entry". The wizard collects org name,
 * region, size, sector, baselines, etc. — features that consume that data
 * (emissions writes, baselines, targets, reports build, BRSR writes, A6.4
 * activities, credits) blow up or produce garbage if onboarding hasn't run.
 *
 * Behaviour:
 *   - If `OnboardingProgress` row is missing OR status is `IN_PROGRESS`,
 *     respond with 412 Precondition Failed + RFC 7807 body and a
 *     `nextStep: '/onboarding'` hint the frontend interceptor uses to
 *     redirect.
 *   - If status is `COMPLETED` or `SKIPPED`, call next().
 *
 * Must run AFTER `requireAuth` + `requireOrgScope` so `req.orgId` is set.
 *
 * The schema's OnboardingStatus enum has only IN_PROGRESS / COMPLETED /
 * SKIPPED — there is no NOT_STARTED row, so "no row at all" is treated as
 * the moral equivalent (the row is auto-created by `getProgress()` with
 * IN_PROGRESS the first time the wizard is opened).
 */

export const ONBOARDING_INCOMPLETE_TYPE =
  'https://aurex.in/errors/onboarding-incomplete';

export async function requireOnboardingComplete(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.orgId) {
    // requireOrgScope should have already 403'd, but be defensive.
    res.status(403).json({
      type: 'https://aurex.in/errors/no-organization',
      title: 'Forbidden',
      status: 403,
      detail: 'Organization scope required',
      instance: req.originalUrl,
    });
    return;
  }

  try {
    const progress = await prisma.onboardingProgress.findUnique({
      where: { orgId: req.orgId },
      select: { status: true },
    });

    // No row OR still in progress → block.
    if (!progress || progress.status === 'IN_PROGRESS') {
      res.status(412).json({
        type: ONBOARDING_INCOMPLETE_TYPE,
        title: 'Complete onboarding',
        status: 412,
        detail:
          'Please finish the onboarding wizard before using this feature.',
        instance: req.originalUrl,
        nextStep: '/onboarding',
      });
      return;
    }

    // COMPLETED or SKIPPED — pass through.
    next();
  } catch (err) {
    logger.error(
      { err, orgId: req.orgId, url: req.originalUrl },
      'Failed to check onboarding gate',
    );
    next(err);
  }
}
