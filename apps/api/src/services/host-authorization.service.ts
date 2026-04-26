import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from './audit-log.service.js';
import * as activityService from './activity.service.js';

/**
 * Host country LoA (Letter of Authorization) per Article 6.4.
 * Authorization is activity-level (stricter than A6.2 which allows tranche-level).
 *
 * AAT-R1 / AV4-419, AV4-423: this service also verifies that an authorization
 * carries the UNFCCC FORM-GOV-002 / 003 / 010 envelope that became mandatory
 * for Article 6 Authorized — IMP labels in 2025-2026.
 */

// ── AAT-R1 / AV4-423 — LoA verification helper ─────────────────────────────

/**
 * UNFCCC FORM-GOV form versions accepted by Aurex on the LoA. These are the
 * three host-country authorization forms published in 2025 (FORM-GOV-002 v1.x
 * for first-issuance, 003 for amendment, 010 for OIMP-only). The match is a
 * prefix check so minor versions ("v1.0" → "v1.1") flow through automatically.
 *
 * Source: https://unfccc.int/process-and-meetings/the-paris-agreement/article-64/forms
 */
const SUPPORTED_FORM_VERSION_PREFIXES = [
  'FORM-GOV-002',
  'FORM-GOV-003',
  'FORM-GOV-010',
] as const;

export interface LoaVerificationResult {
  ok: boolean;
  errors: Array<{ code: string; message: string }>;
  authorization: {
    id: string;
    activityId: string;
    status: string;
    formVersion: string | null;
    documentUrl: string | null;
    validFrom: Date | null;
    validUntil: Date | null;
  };
}

/**
 * Verify a HostAuthorization carries a complete LoA envelope:
 *   1. `documentUrl` is set (the DNA-signed PDF)
 *   2. `formVersion` is one of FORM-GOV-002 / 003 / 010 (any minor version)
 *   3. `validFrom` is set and on/before `now`
 *   4. `validUntil` is null OR on/after `now`
 *   5. Status is ISSUED (not REVOKED / EXPIRED / PENDING)
 *
 * Returns a structured result so callers (issuance flow, registry-label
 * service, CORSIA labelling) can either gate or surface the failures.
 *
 * @throws AppError(404) when the authorization id doesn't exist.
 */
export async function verifyLoa(
  authId: string,
  now: Date = new Date(),
): Promise<LoaVerificationResult> {
  const auth = await prisma.hostAuthorization.findUnique({
    where: { id: authId },
  });
  if (!auth) {
    throw new AppError(404, 'Not Found', 'Host authorization not found');
  }

  const errors: Array<{ code: string; message: string }> = [];

  if (auth.status !== 'ISSUED') {
    errors.push({
      code: 'LOA_NOT_ISSUED',
      message: `LoA status is ${auth.status}; must be ISSUED`,
    });
  }

  if (!auth.documentUrl || auth.documentUrl.trim().length === 0) {
    errors.push({
      code: 'LOA_DOCUMENT_URL_MISSING',
      message: 'documentUrl is required (LoA must reference the signed PDF)',
    });
  }

  // Prisma row carries the new `formVersion` field added by AV4-419.
  // `as { formVersion?: ... }` keeps the read tolerant if the legacy row
  // pre-dates the migration.
  const formVersion = (auth as { formVersion?: string | null }).formVersion ?? null;
  if (!formVersion || formVersion.trim().length === 0) {
    errors.push({
      code: 'LOA_FORM_VERSION_MISSING',
      message:
        'formVersion is required (UNFCCC FORM-GOV-002 / 003 / 010 published 2025)',
    });
  } else {
    const normalized = formVersion.trim();
    const supported = SUPPORTED_FORM_VERSION_PREFIXES.some((p) =>
      normalized.startsWith(p),
    );
    if (!supported) {
      errors.push({
        code: 'LOA_FORM_VERSION_UNSUPPORTED',
        message:
          `formVersion "${formVersion}" is not one of FORM-GOV-002 / 003 / 010`,
      });
    }
  }

  if (!auth.validFrom) {
    errors.push({
      code: 'LOA_VALID_FROM_MISSING',
      message: 'validFrom must be set',
    });
  } else if (auth.validFrom.getTime() > now.getTime()) {
    errors.push({
      code: 'LOA_NOT_YET_VALID',
      message: `validFrom (${auth.validFrom.toISOString()}) is after now`,
    });
  }

  if (auth.validUntil && auth.validUntil.getTime() < now.getTime()) {
    errors.push({
      code: 'LOA_EXPIRED',
      message: `validUntil (${auth.validUntil.toISOString()}) is before now`,
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    authorization: {
      id: auth.id,
      activityId: auth.activityId,
      status: auth.status,
      formVersion,
      documentUrl: auth.documentUrl ?? null,
      validFrom: auth.validFrom ?? null,
      validUntil: auth.validUntil ?? null,
    },
  };
}

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
