import { prisma } from '@aurex/database';
import { recordAudit } from './audit-log.service.js';

/**
 * Article 6.4 — Corresponding Adjustment (CA) event emission.
 *
 * CA events are the registry trigger that tells the host Party to apply an
 * adjustment in its Biennial Transparency Report. They are emitted in two
 * scenarios (Decision 3/CMA.3 + SB standards):
 *
 *   1. First international transfer of an authorized A6.4ER block.
 *   2. Retirement of an authorized A6.4ER block for NDC use or OIMP.
 *
 * A6.4ER_MC (mitigation contribution) blocks DO NOT trigger CA — they are
 * non-transferable by design and carry `caStatus: NOT_REQUIRED`.
 *
 * The service does NOT flip block.caStatus to APPLIED — that transition
 * happens only when the host DNA acknowledges the CA in its BTR (handled
 * separately, out of scope for this phase).
 */

export interface CaEventResult {
  id: string;
  blockId: string;
  hostCountry: string;
  buyerCountry: string | null;
  units: number;
  vintage: number;
  status: string;
  triggeredAt: Date;
}

/**
 * Emit a CA event on first international transfer of an authorized A6.4ER
 * block. Returns `null` for A6.4ER_MC blocks (no CA required) or blocks that
 * are not authorized for international use.
 */
export async function emitOnFirstTransfer(
  blockId: string,
  buyerCountry: string | null,
  units: number,
  actorUserId: string,
): Promise<CaEventResult | null> {
  const block = await prisma.creditUnitBlock.findUnique({ where: { id: blockId } });
  if (!block) return null;

  // Guard: only A6_4ER blocks emit CA events. A6_4ER_MC retains NOT_REQUIRED.
  if (block.unitType !== 'A6_4ER') return null;

  // Guard: MITIGATION_CONTRIBUTION scope cannot transfer internationally.
  // (Belt-and-braces — these should be minted as A6_4ER_MC and caught above.)
  if (block.authorizationStatus === 'MITIGATION_CONTRIBUTION') return null;

  const event = await prisma.correspondingAdjustmentEvent.create({
    data: {
      blockId: block.id,
      hostCountry: block.hostCountry,
      buyerCountry: buyerCountry ?? null,
      units,
      vintage: block.vintage,
      status: 'PENDING_EXPORT',
    },
  });

  await recordAudit({
    orgId: null,
    userId: actorUserId,
    action: 'ca_event.emitted',
    resource: 'corresponding_adjustment_event',
    resourceId: event.id,
    newValue: {
      trigger: 'first_transfer',
      blockId,
      hostCountry: block.hostCountry,
      buyerCountry,
      units,
      vintage: block.vintage,
    },
  });

  return {
    id: event.id,
    blockId: event.blockId,
    hostCountry: event.hostCountry,
    buyerCountry: event.buyerCountry,
    units: Number(event.units),
    vintage: event.vintage,
    status: event.status,
    triggeredAt: event.triggeredAt,
  };
}

/**
 * Emit a CA event when an authorized A6.4ER block is retired for NDC use or
 * OIMP. Voluntary retirements do NOT emit CA — voluntary cancellation is
 * outside the Article 6.4 CA regime.
 *
 * The purpose (NDC / OIMP) is captured as the narrative so downstream BTR
 * exporters (AAT-2) can classify the adjustment bucket.
 */
export async function emitOnRetirement(
  blockId: string,
  purpose: 'NDC' | 'OIMP',
  actorUserId: string,
): Promise<CaEventResult | null> {
  const block = await prisma.creditUnitBlock.findUnique({ where: { id: blockId } });
  if (!block) return null;
  if (block.unitType !== 'A6_4ER') return null;
  if (block.authorizationStatus === 'MITIGATION_CONTRIBUTION') return null;

  const event = await prisma.correspondingAdjustmentEvent.create({
    data: {
      blockId: block.id,
      hostCountry: block.hostCountry,
      buyerCountry: null, // retirement — no buyer country (retired in-registry)
      units: block.unitCount,
      vintage: block.vintage,
      status: 'PENDING_EXPORT',
    },
  });

  await recordAudit({
    orgId: null,
    userId: actorUserId,
    action: 'ca_event.emitted',
    resource: 'corresponding_adjustment_event',
    resourceId: event.id,
    newValue: {
      trigger: 'retirement',
      purpose,
      blockId,
      hostCountry: block.hostCountry,
      units: Number(block.unitCount),
      vintage: block.vintage,
      retirementNarrative: `Retired for ${purpose} — CA required`,
    },
  });

  return {
    id: event.id,
    blockId: event.blockId,
    hostCountry: event.hostCountry,
    buyerCountry: event.buyerCountry,
    units: Number(event.units),
    vintage: event.vintage,
    status: event.status,
    triggeredAt: event.triggeredAt,
  };
}

/**
 * List CA events by host country. Used by AAT-2's BTR exporter to produce the
 * aggregated adjustment table for a given Party's submission.
 */
export async function listByHostCountry(
  hostCountry: string,
  status?: 'PENDING_EXPORT' | 'EXPORTED' | 'ACKNOWLEDGED' | 'REVERSED',
) {
  return prisma.correspondingAdjustmentEvent.findMany({
    where: {
      hostCountry,
      ...(status ? { status } : {}),
    },
    orderBy: { triggeredAt: 'asc' },
  });
}

/**
 * Mark a CA event EXPORTED (stamps btrExportedAt). Called by AAT-2's BTR
 * exporter once the event has been rolled into a submitted BTR bundle.
 */
export async function markExported(eventId: string) {
  const event = await prisma.correspondingAdjustmentEvent.findUnique({
    where: { id: eventId },
  });
  if (!event) return null;
  if (event.status !== 'PENDING_EXPORT') return event;

  return prisma.correspondingAdjustmentEvent.update({
    where: { id: eventId },
    data: {
      status: 'EXPORTED',
      btrExportedAt: new Date(),
    },
  });
}
