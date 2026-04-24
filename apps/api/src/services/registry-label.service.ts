import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';

/**
 * A6.4 Voluntary-Registry Label Forwarding — SCAFFOLD (Phase C, AV4-333).
 *
 * When an Article 6.4 authorized unit is also listed in a voluntary
 * registry (Verra / Gold Standard / ACR), the voluntary registry needs
 * metadata to display the "A6.4-labeled" badge on its serial and to
 * prevent double-claiming if the unit is used for NDC.
 *
 * This service returns the canonical JSON payload that we will push to
 * each voluntary registry's label-forwarding endpoint. Today, each
 * registry's A6.4 labeling endpoint is still being drafted — see:
 *   - Verra:         https://verra.org/article-6-4/ (TBD)
 *   - Gold Standard: https://www.goldstandard.org/ (TBD)
 *   - ACR:           https://acrcarbon.org/ (TBD)
 *
 * Once those endpoints publish, the push-side integration is a follow-up
 * (AV4-335+). Until then this is a read-only payload generator: callers
 * fetch the label JSON and forward it out-of-band (email, PDF, API poll)
 * per registry convention.
 *
 * Shape is intentionally aligned to the SB-sanctioned A6.4 public ledger
 * schema so that downstream mapping is a no-op.
 */

export interface RegistryLabel {
  unitType: 'A6.4ER' | 'A6.4ER_MC';
  vintage: number;
  activityId: string;
  hostCountry: string;
  serial: string;               // first→last, opaque to registry consumers
  serialFirst: string;
  serialLast: string;
  unitCount: number;
  authorizationStatus: 'NDC_USE' | 'OIMP' | 'NDC_AND_OIMP' | 'MITIGATION_CONTRIBUTION';
  caStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPLIED' | 'REVERSED';
  firstTransferAt: string | null;
  retirementStatus: string;
  retirementNarrative: string | null;
  retiredAt: string | null;
  /** Canonical registry link — future: per-registry label URLs. */
  ledgerUri: string;
}

/**
 * Generate the label payload for a given block. Caller must be the block's
 * holder org (or SUPER_ADMIN — enforced at the route layer via requireOrgScope
 * + ownership check here).
 */
export async function generateLabel(
  blockId: string,
  orgId: string,
): Promise<RegistryLabel> {
  const block = await prisma.creditUnitBlock.findUnique({
    where: { id: blockId },
    include: { holderAccount: { select: { orgId: true } } },
  });
  if (!block) {
    throw new AppError(404, 'Not Found', 'Credit unit block not found');
  }
  // Ownership check — only the holder org can fetch the label. Admin
  // accounts (Adaptation Fund / OMGE / Buffer) have no orgId; they are
  // not end-user fetchable.
  if (block.holderAccount?.orgId !== orgId) {
    throw new AppError(404, 'Not Found', 'Credit unit block not found');
  }

  // Map Prisma enum → public label strings.
  const unitType: RegistryLabel['unitType'] =
    block.unitType === 'A6_4ER_MC' ? 'A6.4ER_MC' : 'A6.4ER';

  return {
    unitType,
    vintage: block.vintage,
    activityId: block.activityId,
    hostCountry: block.hostCountry,
    serial: `${block.serialFirst} → ${block.serialLast}`,
    serialFirst: block.serialFirst,
    serialLast: block.serialLast,
    unitCount: Number(block.unitCount),
    authorizationStatus: block.authorizationStatus as RegistryLabel['authorizationStatus'],
    caStatus: block.caStatus as RegistryLabel['caStatus'],
    firstTransferAt: block.firstTransferAt?.toISOString() ?? null,
    retirementStatus: block.retirementStatus,
    retirementNarrative: block.retirementNarrative,
    retiredAt: block.retiredAt?.toISOString() ?? null,
    ledgerUri: `https://aurex.in/a64/blocks/${block.id}`,
  };
}
