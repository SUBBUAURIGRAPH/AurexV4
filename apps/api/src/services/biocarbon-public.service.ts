/**
 * AAT-λ / AV4-355 + AV4-356 — Biocarbon public marketplace + token detail.
 *
 * Read-only, NO-AUTH service that surfaces tokenized issuances under the
 * BCR ("BioCarbon") binding requirements:
 *
 *   B13 — every listing must surface project title + visuals + project page
 *         link + "BioCarbon" attribution
 *   B14 — public token registry / inventory + transaction history UI
 *
 * Privacy: the public surface NEVER exposes retiree PII (name, legalIdRef).
 * Retirement events are surfaced as { purpose, beneficiaryRefHash } where
 * the hash is SHA-256(bcrSerialId) per `hashBcrSerialId` (the serial is
 * already public; the hash is purely a stable opaque identifier so a
 * curious user can correlate retirements without revealing identity).
 */
import { prisma } from '@aurex/database';
import { hashBcrSerialId } from '@aurex/shared';

// ── Public DTOs ────────────────────────────────────────────────────────────

export interface ListingDto {
  /** Opaque BCR serial id; primary public key for the marketplace surface. */
  bcrSerialId: string;
  /** Activity title (e.g. "Forest restoration in Karnataka"). */
  projectTitle: string;
  /** First-frame visual URL (can be undefined for projects without imagery). */
  projectVisual?: string;
  /** BCR project page (for B13 attribution / linkback). */
  projectPageUrl: string;
  /** Methodology (e.g. "VM0042" / "AR-AMS-0001"). */
  methodologyCode: string;
  vintage: number;
  /** Whole tCO2e represented by the token. */
  tonnes: number;
  /** Listing status — MINTED is the steady-state; DELISTED / RETIRED are derived. */
  status: PublicListingStatus;
  hostCountry: string;
  /** B13: must be present on every listing. */
  biocarbonAttribution: BiocarbonAttribution;
}

export interface TokenDetailDto {
  bcrSerialId: string;
  bcrLockId: string | null;
  methodology: {
    code: string;
    name: string;
    version: string;
    referenceUrl: string | null;
  };
  vintage: number;
  tonnes: number;
  hostCountry: string;
  projectTitle: string;
  /** Free-text project description — sourced from `Activity.description`. */
  projectDescription: string | null;
  projectPageUrl: string;
  /** Ordered list of project visuals; first item is the hero image. */
  projectVisuals: string[];
  status: PublicListingStatus;
  tokenizationContractId: string | null;
  tokenizationTxHash: string | null;
  mintedAt: string | null;
  /** Append-only event timeline — mint + transfers + delist + retirement. */
  transactionHistory: TransactionEvent[];
  /** B13: rendered on the detail header AND on the compliance tab. */
  biocarbonAttribution: BiocarbonAttribution;
}

export type PublicListingStatus = 'MINTED' | 'DELISTED_IN_FLIGHT' | 'RETIRED';

export interface BiocarbonAttribution {
  attribution: string;
  registryUrl: string;
}

export type TransactionEventType =
  | 'MINT'
  | 'TRANSFER'
  | 'DELIST'
  | 'RETIREMENT';

export interface TransactionEvent {
  type: TransactionEventType;
  /** ISO-8601 UTC timestamp. */
  occurredAt: string;
  /** Aurigraph DLT tx hash, if any (pass to explorer). */
  txHash?: string;
  /** Whole tCO2e moved by the event. */
  units?: number;
  /** Free-text note (for transfers) — never contains PII. */
  narrative?: string;
  /** Retirement events: redacted retiree purpose (NDC / OIMP / VOLUNTARY). */
  retirementPurpose?: 'NDC' | 'OIMP' | 'VOLUNTARY';
  /** Retirement events: SHA-256(bcrSerialId) — opaque, deterministic. */
  beneficiaryRefHash?: string;
}

export interface ListMarketplaceQuery {
  page?: number;
  pageSize?: number;
  methodologyCode?: string;
  vintage?: number;
  status?: PublicListingStatus;
  search?: string;
}

export interface MarketplacePage {
  items: ListingDto[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

export const BIOCARBON_ATTRIBUTION: BiocarbonAttribution = {
  attribution: 'Issued under BioCarbon Standard',
  registryUrl: 'https://biocarbonstandard.com',
};

/**
 * Default explorer URL pattern. Operators override via env in prod.
 * TODO: switch to the configured explorer once the public Aurigraph DLT
 * mainnet URL is finalised.
 */
const DEFAULT_EXPLORER_URL = 'https://dlt.aurigraph.io/tx/';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 24;

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build the BCR project page URL. The BCR registry hosts a public page per
 * project keyed off `bcrSerialId`'s project component; until BCR publishes
 * a stable URL template we link to the registry root + serial id query.
 */
export function buildProjectPageUrl(bcrSerialId: string): string {
  const encoded = encodeURIComponent(bcrSerialId);
  return `https://biocarbonstandard.com/projects?serial=${encoded}`;
}

/**
 * Pure clamp helper for pagination params — exposed for unit tests.
 */
export function clampPagination(page: number | undefined, pageSize: number | undefined): {
  page: number;
  pageSize: number;
} {
  const safePage = Number.isFinite(page) && (page ?? 0) > 0 ? Math.floor(page!) : 1;
  const rawSize = Number.isFinite(pageSize) && (pageSize ?? 0) > 0
    ? Math.floor(pageSize!)
    : DEFAULT_PAGE_SIZE;
  const safeSize = Math.min(rawSize, MAX_PAGE_SIZE);
  return { page: safePage, pageSize: safeSize };
}

/**
 * Pure helper: derive a public-facing listing status from raw row state.
 * Exposed for unit tests.
 */
export function deriveListingStatus(input: {
  tokenizationStatus: string | null;
  issuanceStatus: string;
}): PublicListingStatus {
  // RETIRED takes precedence — issuance row flips to RETIRED when the
  // aurigraph events worker records a retirement burn.
  if (input.issuanceStatus === 'RETIRED') return 'RETIRED';
  // Defensive: if tokenization went FAILED post-mint we don't surface it,
  // but the route already filters MINTED-only — so anything else here is
  // treated as MINTED for safety.
  if (input.tokenizationStatus === 'MINTED') return 'MINTED';
  return 'MINTED';
}

// ── Service: list ──────────────────────────────────────────────────────────

interface IssuanceListRow {
  bcrSerialId: string | null;
  vintage: number;
  netUnits: unknown; // Prisma Decimal
  status: string;
  tokenizationStatus: string | null;
  activity: {
    title: string;
    hostCountry: string;
    methodology: {
      code: string;
    };
  };
}

/**
 * GET /api/v1/biocarbon/marketplace — paginated list of MINTED issuances.
 * Filters: methodologyCode, vintage, status, free-text search on project
 * title. Public, no auth.
 */
export async function listMarketplace(
  query: ListMarketplaceQuery,
): Promise<MarketplacePage> {
  const { page, pageSize } = clampPagination(query.page, query.pageSize);

  // Always require MINTED + bcrSerialId set — these are the only rows that
  // are public-facing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    tokenizationStatus: 'MINTED',
    bcrSerialId: { not: null },
  };

  if (query.vintage !== undefined && Number.isFinite(query.vintage)) {
    where.vintage = query.vintage;
  }
  if (query.methodologyCode) {
    where.activity = { methodology: { code: query.methodologyCode } };
  }
  if (query.search) {
    where.activity = {
      ...(where.activity ?? {}),
      title: { contains: query.search, mode: 'insensitive' },
    };
  }

  // Status filter is a derived value; we map MINTED → row filter on
  // issuanceStatus = ISSUED (ACTIVE) and RETIRED → issuanceStatus=RETIRED.
  if (query.status === 'RETIRED') {
    where.status = 'RETIRED';
  } else if (query.status === 'MINTED') {
    where.status = { not: 'RETIRED' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const issuanceModel = (prisma as any).issuance;

  const [rows, total] = await Promise.all([
    issuanceModel.findMany({
      where,
      orderBy: { tokenizedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        activity: {
          select: {
            title: true,
            hostCountry: true,
            methodology: { select: { code: true } },
          },
        },
      },
    }),
    issuanceModel.count({ where }),
  ]);

  const items: ListingDto[] = (rows as IssuanceListRow[])
    .filter((r) => r.bcrSerialId)
    .map((r) => mapRowToListing(r));

  return { items, total: Number(total), page, pageSize };
}

function mapRowToListing(row: IssuanceListRow): ListingDto {
  const bcrSerialId = row.bcrSerialId!;
  return {
    bcrSerialId,
    projectTitle: row.activity.title,
    projectVisual: undefined, // Activity.geoBoundary doesn't carry visuals; future: link to PDD doc.
    projectPageUrl: buildProjectPageUrl(bcrSerialId),
    methodologyCode: row.activity.methodology.code,
    vintage: row.vintage,
    tonnes: Number(row.netUnits),
    status: deriveListingStatus({
      tokenizationStatus: row.tokenizationStatus,
      issuanceStatus: row.status,
    }),
    hostCountry: row.activity.hostCountry,
    biocarbonAttribution: BIOCARBON_ATTRIBUTION,
  };
}

// ── Service: detail ───────────────────────────────────────────────────────

export class TokenNotFoundError extends Error {
  constructor(bcrSerialId: string) {
    super(`Token not found: ${bcrSerialId}`);
    this.name = 'TokenNotFoundError';
  }
}

interface IssuanceDetailRow {
  id: string;
  bcrSerialId: string | null;
  bcrLockId: string | null;
  vintage: number;
  netUnits: unknown;
  status: string;
  tokenizationStatus: string | null;
  tokenizationContractId: string | null;
  tokenizationTxHash: string | null;
  tokenizedAt: Date | null;
  serialBlockId: string | null;
  activity: {
    id: string;
    title: string;
    description: string | null;
    hostCountry: string;
    methodology: {
      code: string;
      name: string;
      version: string;
      referenceUrl: string | null;
    };
  };
}

/**
 * GET /api/v1/biocarbon/tokens/:bcrSerialId — single-token detail.
 * 404s if the token does not exist OR is not yet MINTED.
 */
export async function getTokenDetail(
  bcrSerialId: string,
  _opts?: { now?: () => Date },
): Promise<TokenDetailDto> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const issuanceModel = (prisma as any).issuance;

  const row: IssuanceDetailRow | null = await issuanceModel.findFirst({
    where: { bcrSerialId, tokenizationStatus: 'MINTED' },
    include: {
      activity: {
        select: {
          id: true,
          title: true,
          description: true,
          hostCountry: true,
          methodology: {
            select: {
              code: true,
              name: true,
              version: true,
              referenceUrl: true,
            },
          },
        },
      },
    },
  });

  if (!row || !row.bcrSerialId) {
    throw new TokenNotFoundError(bcrSerialId);
  }

  const transactionHistory = await buildTransactionHistory(row);

  return {
    bcrSerialId: row.bcrSerialId,
    bcrLockId: row.bcrLockId,
    methodology: row.activity.methodology,
    vintage: row.vintage,
    tonnes: Number(row.netUnits),
    hostCountry: row.activity.hostCountry,
    projectTitle: row.activity.title,
    projectDescription: row.activity.description,
    projectPageUrl: buildProjectPageUrl(row.bcrSerialId),
    projectVisuals: [], // Wired up when the PDD document/visuals service lands.
    status: deriveListingStatus({
      tokenizationStatus: row.tokenizationStatus,
      issuanceStatus: row.status,
    }),
    tokenizationContractId: row.tokenizationContractId,
    tokenizationTxHash: row.tokenizationTxHash,
    mintedAt: row.tokenizedAt ? row.tokenizedAt.toISOString() : null,
    transactionHistory,
    biocarbonAttribution: BIOCARBON_ATTRIBUTION,
  };
}

/**
 * Assemble the public transaction timeline. The issuance row carries the
 * mint event natively; transfer / delist / retirement events come from
 * the Transaction ledger when present, with graceful degradation when the
 * AAT-ι (Retirement) and AAT-κ (DelistRequest) models haven't merged yet.
 */
async function buildTransactionHistory(
  row: IssuanceDetailRow,
): Promise<TransactionEvent[]> {
  const events: TransactionEvent[] = [];

  // 1. Mint event (always present when MINTED).
  if (row.tokenizedAt) {
    events.push({
      type: 'MINT',
      occurredAt: row.tokenizedAt.toISOString(),
      txHash: row.tokenizationTxHash ?? undefined,
      units: Number(row.netUnits),
      narrative: 'BCR lock confirmed; UC_CARBON contract deployed on Aurigraph DLT',
    });
  }

  // 2. Transfer / retirement events from the Transaction ledger (Article 6.4
  //    Phase C). These are scoped by the issuance's serial block. If the
  //    block isn't set yet (older fixtures) we silently skip — the array
  //    just contains the mint event.
  if (row.serialBlockId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txModel = (prisma as any).transaction;
      if (txModel?.findMany) {
        const txs = await txModel.findMany({
          where: { blockId: row.serialBlockId },
          orderBy: { createdAt: 'asc' },
        });
        for (const tx of txs as Array<{
          transactionType: string;
          createdAt: Date;
          units: unknown;
          narrative: string;
        }>) {
          if (tx.transactionType === 'TRANSFER') {
            events.push({
              type: 'TRANSFER',
              occurredAt: tx.createdAt.toISOString(),
              units: Number(tx.units),
              narrative: tx.narrative,
            });
          } else if (tx.transactionType === 'RETIREMENT') {
            // PII redaction — surface only the BCR-grade purpose + an
            // opaque hash. We hash the bcrSerialId (already public) to
            // produce a stable beneficiary ref token for cross-event
            // correlation without exposing the retiree.
            const beneficiaryRefHash = await hashBcrSerialId(row.bcrSerialId!);
            events.push({
              type: 'RETIREMENT',
              occurredAt: tx.createdAt.toISOString(),
              units: Number(tx.units),
              retirementPurpose: 'VOLUNTARY',
              beneficiaryRefHash,
            });
          }
        }
      }
    } catch {
      // Don't let a Transaction-ledger query failure break the public detail
      // endpoint — the mint event alone is sufficient for B14 minimum.
    }
  }

  // 3. Delist events — graceful degradation when AAT-κ (DelistRequest)
  //    hasn't merged yet. Probe the model dynamically.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delistModel = (prisma as any).delistRequest;
  if (delistModel?.findMany) {
    try {
      const delists = await delistModel.findMany({
        where: { bcrSerialId: row.bcrSerialId },
        orderBy: { createdAt: 'asc' },
      });
      for (const d of delists as Array<{ createdAt: Date; status?: string }>) {
        events.push({
          type: 'DELIST',
          occurredAt: d.createdAt.toISOString(),
          narrative: `Delist request raised (status: ${d.status ?? 'pending'})`,
        });
      }
    } catch {
      // AAT-κ not yet present — silently skip.
    }
  }

  // 4. Retirement records — graceful degradation when AAT-ι (Retirement)
  //    hasn't merged yet. The Issuance row's `status === 'RETIRED'` is
  //    the canonical signal in absence of the dedicated model.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const retirementModel = (prisma as any).retirement;
  if (retirementModel?.findMany) {
    try {
      const retirements = await retirementModel.findMany({
        where: { bcrSerialId: row.bcrSerialId },
        orderBy: { retiredAt: 'asc' },
      });
      const beneficiaryRefHash = await hashBcrSerialId(row.bcrSerialId!);
      for (const r of retirements as Array<{
        retiredAt: Date;
        purpose?: string;
        units?: unknown;
      }>) {
        events.push({
          type: 'RETIREMENT',
          occurredAt: r.retiredAt.toISOString(),
          units: r.units !== undefined ? Number(r.units) : undefined,
          retirementPurpose: normalizePurpose(r.purpose),
          beneficiaryRefHash,
        });
      }
    } catch {
      // AAT-ι not yet present — silently skip.
    }
  }

  return events;
}

function normalizePurpose(purpose?: string): 'NDC' | 'OIMP' | 'VOLUNTARY' {
  if (purpose === 'NDC' || purpose === 'OIMP') return purpose;
  return 'VOLUNTARY';
}

/**
 * Pure helper: build the explorer URL for a tx hash. The default points to
 * `https://dlt.aurigraph.io/tx/<hash>`; operators can override via env.
 */
export function buildExplorerUrl(txHash: string, baseUrl?: string): string {
  const base = baseUrl?.endsWith('/') ? baseUrl : `${baseUrl ?? DEFAULT_EXPLORER_URL}`;
  return `${base}${txHash}`;
}
