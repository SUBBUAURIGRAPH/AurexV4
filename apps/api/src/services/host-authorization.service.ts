import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from './audit-log.service.js';
import * as activityService from './activity.service.js';

/**
 * Host country LoA (Letter of Authorization) per Article 6.4.
 * Authorization is activity-level (stricter than A6.2 which allows tranche-level).
 */

type AuthorizationScope = 'NDC_USE' | 'OIMP' | 'NDC_AND_OIMP' | 'MITIGATION_CONTRIBUTION';

export async function issueAuthorization(
  activityId: string,
  orgId: string,
  dnaUserId: string,
  data: {
    dnaName: string;
    authorizedFor: AuthorizationScope;
    authorizationScopeNotes?: string;
    documentUrl?: string;
    validFrom: Date;
    validUntil?: Date;
  },
) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  if (activity.status !== 'AWAITING_HOST') {
    throw new AppError(
      409,
      'Conflict',
      `Activity status is ${activity.status}; LoA can only be issued in AWAITING_HOST`,
    );
  }

  const existing = await prisma.hostAuthorization.findUnique({ where: { activityId } });
  if (existing && existing.status === 'ISSUED') {
    throw new AppError(409, 'Conflict', 'LoA already ISSUED for this activity');
  }

  const auth = existing
    ? await prisma.hostAuthorization.update({
        where: { id: existing.id },
        data: {
          dnaName: data.dnaName,
          authorizedFor: data.authorizedFor as never,
          authorizationScopeNotes: data.authorizationScopeNotes,
          status: 'ISSUED' as never,
          issuedAt: new Date(),
          issuedBy: dnaUserId,
          documentUrl: data.documentUrl,
          validFrom: data.validFrom,
          validUntil: data.validUntil,
        },
      })
    : await prisma.hostAuthorization.create({
        data: {
          activityId,
          hostCountry: activity.hostCountry,
          dnaName: data.dnaName,
          authorizedFor: data.authorizedFor as never,
          authorizationScopeNotes: data.authorizationScopeNotes,
          status: 'ISSUED' as never,
          issuedAt: new Date(),
          issuedBy: dnaUserId,
          documentUrl: data.documentUrl,
          validFrom: data.validFrom,
          validUntil: data.validUntil,
        },
      });

  await recordAudit({
    orgId,
    userId: dnaUserId,
    action: 'host.authorization.issued',
    resource: 'activity',
    resourceId: activityId,
    newValue: {
      dnaName: data.dnaName,
      authorizedFor: data.authorizedFor,
      status: 'ISSUED',
    },
  });

  // Transition activity → REGISTERED
  await activityService.markRegistered(activityId, orgId, dnaUserId);
  return auth;
}

export async function revokeAuthorization(
  activityId: string,
  orgId: string,
  dnaUserId: string,
  reason: string,
) {
  const existing = await prisma.hostAuthorization.findUnique({ where: { activityId } });
  if (!existing) throw new AppError(404, 'Not Found', 'No authorization to revoke');
  if (existing.status !== 'ISSUED') {
    throw new AppError(409, 'Conflict', `Cannot revoke authorization in status ${existing.status}`);
  }

  // A6.4: revocation NOT allowed after first transfer of any A6.4ER from this activity.
  const firstTransferred = await prisma.creditUnitBlock.findFirst({
    where: { activityId, firstTransferAt: { not: null } },
  });
  if (firstTransferred) {
    throw new AppError(
      409,
      'Conflict',
      'Authorization cannot be revoked: A6.4ERs from this activity have already been internationally transferred',
    );
  }

  const updated = await prisma.hostAuthorization.update({
    where: { id: existing.id },
    data: {
      status: 'REVOKED' as never,
      revokedAt: new Date(),
      revokedReason: reason,
    },
  });
  await recordAudit({
    orgId,
    userId: dnaUserId,
    action: 'host.authorization.revoked',
    resource: 'activity',
    resourceId: activityId,
    newValue: { status: 'REVOKED', reason },
  });
  return updated;
}
