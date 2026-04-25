/**
 * Compliance service — thin façade over `AurigraphDltAdapter` compliance
 * namespace. AAT-ρ / AV4-376.
 *
 * SDK 1.2.0 surface gap: the chain SDK exposes
 * `listFrameworks / getFramework / assess / getAssessments` (no free-form
 * `submit / getAttestation / list` surface). The adapter wraps `assess` as
 * the "submit attestation" path and `getAssessments` as the
 * "list attestations" path; this service is the Aurex-side mapping layer
 * (orgId → subject; activityId → subject) so callers don't need to know
 * the SDK shape.
 */

import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import {
  type AurigraphDltAdapter,
  type ComplianceSubmitResult,
  getAurigraphAdapter,
} from './chains/aurigraph-dlt-adapter.js';
import type { AssessmentResult } from '@aurigraph/dlt-sdk';

// ── Public types ───────────────────────────────────────────────────────────

export interface ListAttestationsOpts {
  since?: Date;
  limit?: number;
}

export interface ComplianceServiceDeps {
  /** Override the chain adapter (tests inject a stub). */
  aurigraphAdapter?: Pick<
    AurigraphDltAdapter,
    | 'getComplianceAttestation'
    | 'listComplianceAttestations'
    | 'submitComplianceAttestation'
  >;
}

// ── Errors ─────────────────────────────────────────────────────────────────

export class ComplianceActivityNotFoundError extends AppError {
  constructor(activityId: string) {
    super(404, 'Not Found', `Activity ${activityId} not found`);
    this.name = 'ComplianceActivityNotFoundError';
  }
}

// ── Service surface ────────────────────────────────────────────────────────

/**
 * Fetch a single compliance attestation by id. Pass-through to the adapter;
 * the Aurex side does not own attestation rows.
 */
export async function getAttestation(
  id: string,
  deps: ComplianceServiceDeps = {},
): Promise<AssessmentResult> {
  const adapter = deps.aurigraphAdapter ?? getAurigraphAdapter();
  return adapter.getComplianceAttestation(id);
}

/**
 * List compliance attestations for an Aurex org.
 *
 * TODO(AV4-376): map orgId -> Aurigraph-side subject reference once the
 * V12 platform exposes a per-tenant subject namespace. For now the orgId
 * itself is forwarded verbatim — that matches the V11 SDK assumption that
 * the asset id IS the subject.
 */
export async function listAttestationsForOrg(
  orgId: string,
  opts: ListAttestationsOpts = {},
  deps: ComplianceServiceDeps = {},
): Promise<AssessmentResult[]> {
  const adapter = deps.aurigraphAdapter ?? getAurigraphAdapter();
  return adapter.listComplianceAttestations({
    subject: orgId,
    since: opts.since,
    limit: opts.limit,
  });
}

/**
 * Submit a new compliance attestation against an Aurex Activity.
 * The Activity's id is used verbatim as the Aurigraph subject reference.
 */
export async function submitAttestationForActivity(
  activityId: string,
  kind: string,
  payload: Record<string, unknown>,
  deps: ComplianceServiceDeps = {},
): Promise<ComplianceSubmitResult> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, orgId: true, title: true },
  });
  if (!activity) {
    throw new ComplianceActivityNotFoundError(activityId);
  }

  const adapter = deps.aurigraphAdapter ?? getAurigraphAdapter();
  const result = await adapter.submitComplianceAttestation({
    subject: activity.id,
    kind,
    payload: {
      ...payload,
      aurexActivityId: activity.id,
      aurexOrgId: activity.orgId,
    },
  });

  logger.info(
    {
      activityId,
      kind,
      attestationId: result.attestationId,
      txHash: result.txHash,
    },
    'compliance attestation submitted',
  );

  return result;
}
