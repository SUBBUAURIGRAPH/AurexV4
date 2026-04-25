/**
 * AAT-ο / AV4-364 — End-to-end full-lifecycle test for the BCR/4 leg.
 *
 * Exercises the full BCR-bound token lifecycle in two integration tests:
 *
 *   ISSUED (free) → lock → mint → list → branch A: retire (BURN_FOR_RETIREMENT)
 *   ISSUED (free) → lock → mint → list → branch B: delist (BURN_FOR_DELIST)
 *
 * Strategy
 * --------
 *
 *  - Mocks: ONLY the `BcrRegistryAdapter` and `AurigraphDltAdapter` are
 *    mocked (the two external surfaces). Everything else — Prisma, the
 *    tokenization service, the retirement service, the delist service,
 *    the events worker, the biocarbon-public marketplace service, the
 *    sync recorder — runs as real code.
 *  - Prisma is replaced with an in-memory stateful fake (`fakeDb`) that
 *    supports every model touched by the lifecycle: Issuance, Activity,
 *    MonitoringPeriod, Methodology, Retirement, DelistRequest,
 *    BcrRegistrySyncEvent, AurigraphCallLog, AurigraphEventCursor,
 *    AurigraphProcessedEvent, AuditLog. The fake honours the where-clauses
 *    + includes used by the services under test.
 *  - The events worker is driven via the new `processOnce()` test helper
 *    (added by this ticket) — no `setInterval` required.
 *
 * Coverage
 * --------
 *
 *   1. Branch A — retirement end-to-end (1 e2e test).
 *   2. Branch B — delist end-to-end (1 e2e test).
 *   3. + 4 supporting unit-level pieces:
 *        - mint-only stops at MINTED + 3 sync events
 *        - marketplace surfaces a freshly-minted row
 *        - mint is idempotent (re-call returns cached refs)
 *        - sync events end with synced=true on every leg
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';

// ── Hoisted in-memory fake Prisma ──────────────────────────────────────────

interface AuditLogRow {
  id: string;
  orgId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  newValue: unknown;
  createdAt: Date;
}

interface IssuanceRow {
  id: string;
  activityId: string;
  periodId: string;
  grossUnits: number;
  sopLevyUnits: number;
  omgeCancelledUnits: number;
  netUnits: number;
  vintage: number;
  unitType: 'A6_4ER';
  status: 'REQUESTED' | 'APPROVED' | 'ISSUED' | 'REJECTED' | 'RETIRED';
  requestedBy: string;
  requestedAt: Date;
  issuedAt: Date | null;
  serialBlockId: string | null;
  tokenizationStatus: 'PENDING' | 'MINTED' | 'FAILED' | null;
  tokenizationContractId: string | null;
  tokenizationTxHash: string | null;
  bcrSerialId: string | null;
  bcrLockId: string | null;
  tokenizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ActivityRow {
  id: string;
  orgId: string;
  methodologyId: string;
  title: string;
  hostCountry: string;
  description: string | null;
}

interface MethodologyRow {
  id: string;
  code: string;
  name: string;
  version: string;
  category: string;
  isActive: boolean;
  isBcrEligible: boolean;
  referenceUrl: string | null;
}

interface MonitoringPeriodRow {
  id: string;
  activityId: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
}

interface RetirementRow {
  id: string;
  issuanceId: string;
  kycVerificationId: string;
  bcrSerialId: string;
  tonnesRetired: number;
  vintage: number;
  purpose: string;
  purposeNarrative: string | null;
  retiredFor: unknown;
  retiredByUserId: string;
  retiredByOrgId: string;
  retirementCertificateUrl: string | null;
  txHash: string | null;
  status: 'INITIATED' | 'CHAIN_BURNED' | 'BCR_SYNCED' | 'FAILED';
  bcrSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DelistRequestRow {
  id: string;
  issuanceId: string;
  bcrSerialId: string;
  requestedByUserId: string;
  requestedByOrgId: string;
  reason: string | null;
  txHash: string | null;
  status: 'INITIATED' | 'CHAIN_BURNED' | 'BCR_UNLOCKED' | 'FAILED';
  bcrUnlockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface BcrRegistrySyncEventRow {
  id: string;
  eventType:
    | 'LOCK_VCC'
    | 'CONFIRM_LOCK'
    | 'NOTIFY_MINT'
    | 'NOTIFY_TRANSFER'
    | 'NOTIFY_BURN'
    | 'UNLOCK_VCC'
    | 'RETIRE_VCC'
    | 'GET_STATUS';
  resourceKind: string;
  resourceId: string;
  adapterName: string;
  bcrSerialId: string | null;
  bcrLockId: string | null;
  externalRef: string | null;
  synced: boolean;
  reason: string | null;
  requestPayload: unknown;
  responsePayload: unknown;
  createdAt: Date;
}

interface ProcessedEventRow {
  txHash: string;
  eventType: 'BURN_FOR_RETIREMENT' | 'BURN_FOR_DELIST';
  issuanceId: string | null;
  retryCount: number;
  status: 'PENDING' | 'PROCESSED' | 'FAILED_PERMANENT';
  lastError: string | null;
}

interface CursorRow {
  id: string;
  lastTxHash: string | null;
  lastProcessedAt: Date | null;
}

const { fakeDb, asNumber } = vi.hoisted(() => {
  const issuances = new Map<string, IssuanceRow>();
  const activities = new Map<string, ActivityRow>();
  const methodologies = new Map<string, MethodologyRow>();
  const periods = new Map<string, MonitoringPeriodRow>();
  const orgs = new Map<string, OrgRow>();
  const retirements = new Map<string, RetirementRow>();
  const delistRequests = new Map<string, DelistRequestRow>();
  const syncEvents = new Map<string, BcrRegistrySyncEventRow>();
  const processedEvents = new Map<string, ProcessedEventRow>();
  const cursors = new Map<string, CursorRow>();
  const auditLogs = new Map<string, AuditLogRow>();

  const asNumberFn = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return Number(v);
    if (v && typeof v === 'object' && 'toNumber' in v) {
      const n = (v as { toNumber: () => number }).toNumber();
      return n;
    }
    return Number(v);
  };

  type IssuanceInclude = {
    activity?:
      | boolean
      | {
          include?: { methodology?: boolean; org?: boolean };
          select?: {
            title?: boolean;
            hostCountry?: boolean;
            methodology?: { select?: { code?: boolean } };
            id?: boolean;
            description?: boolean;
            orgId?: boolean;
          };
        };
    period?: boolean;
    serialBlock?: boolean;
    delistRequest?: boolean;
  };

  function buildIssuanceWithIncludes(
    row: IssuanceRow,
    include?: IssuanceInclude,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...row };
    if (include?.activity) {
      const activity = activities.get(row.activityId);
      if (activity) {
        const built: Record<string, unknown> = { ...activity };
        const inc =
          typeof include.activity === 'object' ? include.activity : null;
        if (inc?.include?.methodology || inc?.select?.methodology) {
          const methodology = methodologies.get(activity.methodologyId);
          if (methodology) built.methodology = methodology;
        }
        if (inc?.include?.org) {
          const org = orgs.get(activity.orgId);
          if (org) built.org = org;
        }
        // For listMarketplace `select` projection — keep all fields
        // populated so `mapRowToListing` works.
        result.activity = built;
      } else {
        result.activity = null;
      }
    }
    if (include?.period) {
      result.period = periods.get(row.periodId) ?? null;
    }
    if (include?.serialBlock) {
      result.serialBlock = null;
    }
    if (include?.delistRequest) {
      const dr = [...delistRequests.values()].find(
        (d) => d.issuanceId === row.id,
      );
      result.delistRequest = dr ?? null;
    }
    return result;
  }

  function matchIssuanceWhere(
    row: IssuanceRow,
    where: Record<string, unknown> | undefined,
  ): boolean {
    if (!where) return true;
    for (const [key, val] of Object.entries(where)) {
      if (key === 'id' && val !== row.id) return false;
      if (key === 'tokenizationStatus') {
        if (typeof val === 'string' && val !== row.tokenizationStatus) {
          return false;
        }
      }
      if (key === 'bcrSerialId') {
        if (
          val &&
          typeof val === 'object' &&
          'not' in (val as Record<string, unknown>)
        ) {
          if (row.bcrSerialId === null) return false;
        } else if (typeof val === 'string') {
          if (val !== row.bcrSerialId) return false;
        }
      }
      if (key === 'vintage' && typeof val === 'number' && val !== row.vintage) {
        return false;
      }
      if (key === 'status') {
        if (typeof val === 'string' && val !== row.status) return false;
        if (
          val &&
          typeof val === 'object' &&
          'not' in (val as Record<string, unknown>)
        ) {
          const notVal = (val as { not: unknown }).not;
          if (notVal === row.status) return false;
        }
      }
      if (key === 'activity' && val && typeof val === 'object') {
        // Used by listMarketplace. Walk a tiny set of supported sub-filters.
        const activity = activities.get(row.activityId);
        if (!activity) return false;
        const sub = val as Record<string, unknown>;
        if (sub.methodology && typeof sub.methodology === 'object') {
          const methCode = (sub.methodology as Record<string, unknown>).code;
          const methodology = methodologies.get(activity.methodologyId);
          if (typeof methCode === 'string' && methodology?.code !== methCode) {
            return false;
          }
        }
        if (sub.title && typeof sub.title === 'object') {
          const titleFilter = sub.title as Record<string, unknown>;
          const contains = titleFilter.contains;
          if (
            typeof contains === 'string' &&
            !activity.title
              .toLowerCase()
              .includes(contains.toLowerCase())
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }

  const fakeDbInner = {
    // ── Test helpers (not part of the prisma surface) ────────────────
    issuances,
    activities,
    methodologies,
    periods,
    orgs,
    retirements,
    delistRequests,
    syncEvents,
    processedEvents,
    cursors,
    auditLogs,

    // ── Issuance ────────────────────────────────────────────────────
    issuance: {
      findUnique: vi.fn(
        async (args: {
          where: { id: string };
          include?: IssuanceInclude;
        }) => {
          const row = issuances.get(args.where.id);
          if (!row) return null;
          return buildIssuanceWithIncludes(row, args.include);
        },
      ),
      findFirst: vi.fn(
        async (args: {
          where?: Record<string, unknown>;
          include?: IssuanceInclude;
        }) => {
          for (const row of issuances.values()) {
            if (matchIssuanceWhere(row, args.where)) {
              return buildIssuanceWithIncludes(row, args.include);
            }
          }
          return null;
        },
      ),
      findMany: vi.fn(
        async (args: {
          where?: Record<string, unknown>;
          include?: IssuanceInclude;
          orderBy?: unknown;
          skip?: number;
          take?: number;
        }) => {
          const matched: IssuanceRow[] = [];
          for (const row of issuances.values()) {
            if (matchIssuanceWhere(row, args.where)) matched.push(row);
          }
          // Order by tokenizedAt desc when requested by listMarketplace.
          matched.sort((a, b) => {
            const at = a.tokenizedAt?.getTime() ?? 0;
            const bt = b.tokenizedAt?.getTime() ?? 0;
            return bt - at;
          });
          const start = args.skip ?? 0;
          const end = start + (args.take ?? matched.length);
          return matched
            .slice(start, end)
            .map((r) => buildIssuanceWithIncludes(r, args.include));
        },
      ),
      count: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        let n = 0;
        for (const row of issuances.values()) {
          if (matchIssuanceWhere(row, args.where)) n += 1;
        }
        return n;
      }),
      update: vi.fn(
        async (args: {
          where: { id: string };
          data: Partial<IssuanceRow>;
        }) => {
          const row = issuances.get(args.where.id);
          if (!row) {
            throw new Error(`fakeDb: issuance not found ${args.where.id}`);
          }
          Object.assign(row, args.data, { updatedAt: new Date() });
          return { ...row };
        },
      ),
    },

    // ── Retirement ──────────────────────────────────────────────────
    retirement: {
      findUnique: vi.fn(
        async (args: {
          where: {
            issuanceId_kycVerificationId?: {
              issuanceId: string;
              kycVerificationId: string;
            };
            id?: string;
          };
        }) => {
          if (args.where.issuanceId_kycVerificationId) {
            const { issuanceId, kycVerificationId } =
              args.where.issuanceId_kycVerificationId;
            for (const r of retirements.values()) {
              if (
                r.issuanceId === issuanceId &&
                r.kycVerificationId === kycVerificationId
              ) {
                return { ...r };
              }
            }
            return null;
          }
          if (args.where.id) {
            return retirements.get(args.where.id) ?? null;
          }
          return null;
        },
      ),
      create: vi.fn(
        async (args: { data: Omit<RetirementRow, 'id'> & { id?: string } }) => {
          const id = args.data.id ?? randomUUID();
          const row: RetirementRow = {
            id,
            issuanceId: args.data.issuanceId,
            kycVerificationId: args.data.kycVerificationId,
            bcrSerialId: args.data.bcrSerialId,
            tonnesRetired: asNumberFn(args.data.tonnesRetired),
            vintage: args.data.vintage,
            purpose: args.data.purpose,
            purposeNarrative: args.data.purposeNarrative ?? null,
            retiredFor: args.data.retiredFor,
            retiredByUserId: args.data.retiredByUserId,
            retiredByOrgId: args.data.retiredByOrgId,
            retirementCertificateUrl:
              args.data.retirementCertificateUrl ?? null,
            txHash: args.data.txHash ?? null,
            status: args.data.status ?? 'INITIATED',
            bcrSyncedAt: args.data.bcrSyncedAt ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          retirements.set(id, row);
          return { ...row };
        },
      ),
      update: vi.fn(
        async (args: {
          where: { id: string };
          data: Partial<RetirementRow>;
        }) => {
          const row = retirements.get(args.where.id);
          if (!row) throw new Error(`fakeDb: retirement not found`);
          Object.assign(row, args.data, { updatedAt: new Date() });
          return { ...row };
        },
      ),
      updateMany: vi.fn(
        async (args: {
          where: { issuanceId: string; status?: { in: string[] } };
          data: Partial<RetirementRow>;
        }) => {
          let count = 0;
          for (const row of retirements.values()) {
            if (row.issuanceId !== args.where.issuanceId) continue;
            if (args.where.status?.in && !args.where.status.in.includes(row.status)) {
              continue;
            }
            Object.assign(row, args.data, { updatedAt: new Date() });
            count += 1;
          }
          return { count };
        },
      ),
    },

    // ── DelistRequest ───────────────────────────────────────────────
    delistRequest: {
      findUnique: vi.fn(
        async (args: { where: { issuanceId: string } }) => {
          for (const r of delistRequests.values()) {
            if (r.issuanceId === args.where.issuanceId) return { ...r };
          }
          return null;
        },
      ),
      upsert: vi.fn(
        async (args: {
          where: { issuanceId: string };
          create: Omit<DelistRequestRow, 'id' | 'createdAt' | 'updatedAt'>;
          update: Partial<DelistRequestRow>;
        }) => {
          const existing = [...delistRequests.values()].find(
            (r) => r.issuanceId === args.where.issuanceId,
          );
          if (existing) {
            Object.assign(existing, args.update, { updatedAt: new Date() });
            return { ...existing };
          }
          const id = randomUUID();
          const row: DelistRequestRow = {
            id,
            issuanceId: args.create.issuanceId,
            bcrSerialId: args.create.bcrSerialId,
            requestedByUserId: args.create.requestedByUserId,
            requestedByOrgId: args.create.requestedByOrgId,
            reason: args.create.reason ?? null,
            txHash: args.create.txHash ?? null,
            status: args.create.status ?? 'INITIATED',
            bcrUnlockedAt: args.create.bcrUnlockedAt ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          delistRequests.set(id, row);
          return { ...row };
        },
      ),
      updateMany: vi.fn(
        async (args: {
          where: {
            issuanceId: string;
            status?: { in: Array<DelistRequestRow['status']> };
          };
          data: Partial<DelistRequestRow>;
        }) => {
          let count = 0;
          for (const row of delistRequests.values()) {
            if (row.issuanceId !== args.where.issuanceId) continue;
            if (args.where.status?.in && !args.where.status.in.includes(row.status)) {
              continue;
            }
            Object.assign(row, args.data, { updatedAt: new Date() });
            count += 1;
          }
          return { count };
        },
      ),
    },

    // ── BcrRegistrySyncEvent ────────────────────────────────────────
    bcrRegistrySyncEvent: {
      create: vi.fn(
        async (args: { data: Omit<BcrRegistrySyncEventRow, 'id' | 'createdAt'> }) => {
          const id = randomUUID();
          const row: BcrRegistrySyncEventRow = {
            id,
            eventType: args.data.eventType,
            resourceKind: args.data.resourceKind,
            resourceId: args.data.resourceId,
            adapterName: args.data.adapterName,
            bcrSerialId: args.data.bcrSerialId ?? null,
            bcrLockId: args.data.bcrLockId ?? null,
            externalRef: args.data.externalRef ?? null,
            synced: args.data.synced,
            reason: args.data.reason ?? null,
            requestPayload: args.data.requestPayload ?? null,
            responsePayload: args.data.responsePayload ?? null,
            createdAt: new Date(),
          };
          syncEvents.set(id, row);
          return { ...row };
        },
      ),
    },

    // ── AurigraphCallLog (used by adapter — best-effort, may not fire) ──
    aurigraphCallLog: {
      create: vi.fn(async () => ({})),
    },

    // ── Worker cursors + processed events ───────────────────────────
    aurigraphEventCursor: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        return cursors.get(args.where.id) ?? null;
      }),
      upsert: vi.fn(
        async (args: {
          where: { id: string };
          create: { id: string; lastTxHash: string | null; lastProcessedAt: Date };
          update: { lastTxHash: string | null; lastProcessedAt: Date };
        }) => {
          const existing = cursors.get(args.where.id);
          if (existing) {
            existing.lastTxHash = args.update.lastTxHash;
            existing.lastProcessedAt = args.update.lastProcessedAt;
            return { ...existing };
          }
          const row: CursorRow = {
            id: args.create.id,
            lastTxHash: args.create.lastTxHash,
            lastProcessedAt: args.create.lastProcessedAt,
          };
          cursors.set(args.where.id, row);
          return { ...row };
        },
      ),
    },
    aurigraphProcessedEvent: {
      findUnique: vi.fn(async (args: { where: { txHash: string } }) => {
        return processedEvents.get(args.where.txHash) ?? null;
      }),
      create: vi.fn(
        async (args: { data: ProcessedEventRow }) => {
          const row: ProcessedEventRow = {
            txHash: args.data.txHash,
            eventType: args.data.eventType,
            issuanceId: args.data.issuanceId ?? null,
            retryCount: args.data.retryCount ?? 0,
            status: args.data.status ?? 'PENDING',
            lastError: args.data.lastError ?? null,
          };
          processedEvents.set(row.txHash, row);
          return { ...row };
        },
      ),
      update: vi.fn(
        async (args: {
          where: { txHash: string };
          data: Partial<ProcessedEventRow>;
        }) => {
          const row = processedEvents.get(args.where.txHash);
          if (!row) {
            throw new Error(`fakeDb: processedEvent not found ${args.where.txHash}`);
          }
          Object.assign(row, args.data);
          return { ...row };
        },
      ),
    },

    // ── AuditLog ────────────────────────────────────────────────────
    auditLog: {
      create: vi.fn(
        async (args: { data: Omit<AuditLogRow, 'id' | 'createdAt'> }) => {
          const id = randomUUID();
          const row: AuditLogRow = {
            id,
            orgId: args.data.orgId,
            userId: args.data.userId,
            action: args.data.action,
            resource: args.data.resource,
            resourceId: args.data.resourceId,
            newValue: args.data.newValue,
            createdAt: new Date(),
          };
          auditLogs.set(id, row);
          return { ...row };
        },
      ),
    },
  };

  return { fakeDb: fakeDbInner, asNumber: asNumberFn };
});

vi.mock('@aurex/database', () => ({
  prisma: fakeDb,
  Prisma: { JsonNull: null },
}));

// Avoid the env-bound Aurigraph client bootstrap on import.
vi.mock('./lib/aurigraph-client.js', () => ({
  getAurigraphConfig: () => ({ channelId: 'test-channel' }),
}));

// Avoid the BCR/aurigraph adapter factories — they're injected per call.
vi.mock('./services/registries/bcr/index.js', async () => {
  const actual = await vi.importActual<
    typeof import('./services/registries/bcr/index.js')
  >('./services/registries/bcr/index.js');
  return {
    ...actual,
    getBcrAdapter: () => {
      throw new Error('e2e test must inject bcrAdapter explicitly');
    },
  };
});
vi.mock('./services/chains/aurigraph-dlt-adapter.js', async () => {
  const actual = await vi.importActual<
    typeof import('./services/chains/aurigraph-dlt-adapter.js')
  >('./services/chains/aurigraph-dlt-adapter.js');
  return {
    ...actual,
    getAurigraphAdapter: () => {
      throw new Error('e2e test must inject aurigraphAdapter explicitly');
    },
  };
});

// ── Imports AFTER mocks ────────────────────────────────────────────────────

import { tokenizeIssuance } from './services/tokenization.service.js';
import { retireToken, type KycLookup } from './services/retirement.service.js';
import { delistIssuance } from './services/delist.service.js';
import { listMarketplace } from './services/biocarbon-public.service.js';
import { processOnce } from './workers/aurigraph-events.worker.js';
import { MockBcrAdapter } from './services/registries/bcr/mock-bcr-adapter.js';
import type {
  AurigraphDltAdapter,
  ContractDeployResult,
  AssetBurnSpec,
} from './services/chains/aurigraph-dlt-adapter.js';
import type {
  BcrRegistryAdapter,
  UnlockVccParams,
  UnlockVccResult,
} from './services/registries/bcr/index.js';
import type { BiocarbonRetirementPayload } from '@aurex/shared';

// ── E2E BCR adapter wrapper ────────────────────────────────────────────────

/**
 * Thin wrapper around `MockBcrAdapter` that widens `unlockVCC` so it
 * accepts the `tokenized → free` transition. The default mock only accepts
 * `locked → free`, which models pre-mint cancellation but NOT the
 * post-mint two-way-bridge (B18: tokenized VCC delisted via chain burn,
 * then unlocked back to free on BCR). Live-v1 BCR must support this;
 * this wrapper exercises the worker against a mock that does.
 *
 * On `tokenized → free` the wrapper internally falls back to
 * `notifyBurn(DELIST)`, which is the inner mock's path that actually
 * accepts both `tokenized` and `locked` source states. This keeps the
 * wrapper a thin contract-compatibility shim — it does not re-implement
 * the BCR state machine.
 */
class E2eBcrAdapter implements BcrRegistryAdapter {
  readonly adapterName = 'mock-e2e';
  readonly isActive = true;
  private readonly inner = new MockBcrAdapter();
  private readonly lockToSerial = new Map<string, string>();

  async lockVCC(...args: Parameters<MockBcrAdapter['lockVCC']>) {
    const result = await this.inner.lockVCC(...args);
    if (result.ok && result.data) {
      this.lockToSerial.set(result.data.bcrLockId, result.data.bcrSerialId);
    }
    return result;
  }
  confirmLock = this.inner.confirmLock.bind(this.inner);
  notifyMint = this.inner.notifyMint.bind(this.inner);
  notifyTransfer = this.inner.notifyTransfer.bind(this.inner);
  notifyBurn = this.inner.notifyBurn.bind(this.inner);
  retireVCC = this.inner.retireVCC.bind(this.inner);
  getStatus = this.inner.getStatus.bind(this.inner);

  async unlockVCC(params: UnlockVccParams): Promise<UnlockVccResult> {
    const strict = await this.inner.unlockVCC(params);
    if (strict.ok) return strict;

    // Fall through to notifyBurn(DELIST) when the inner adapter rejected
    // because the VCC is in `tokenized` state. The live BCR API will
    // accept the delist directly via unlockVCC; the mock splits the two
    // transitions across two methods, so we bridge.
    const isTokenizedReject =
      strict.reason !== undefined && strict.reason.includes('tokenized');
    if (!isTokenizedReject) return strict;

    const serial = this.lockToSerial.get(params.bcrLockId);
    if (!serial) return strict;

    const burnRes = await this.inner.notifyBurn({
      bcrSerialId: serial,
      reason: 'DELIST',
      vintage: 0,
      units: 0,
    });
    if (!burnRes.ok) return strict;
    return {
      ok: true,
      externalRef: burnRes.externalRef,
      data: { bcrSerialId: serial },
    };
  }
}

// ── MockAurigraphAdapter ───────────────────────────────────────────────────

/**
 * Minimal in-memory Aurigraph DLT adapter for the e2e test. The real adapter
 * (`apps/api/src/services/chains/aurigraph-dlt-adapter.ts`) wraps the
 * vendored SDK; we mirror enough of the surface that:
 *
 *   - `deployContract({ templateId: 'UC_CARBON', terms })` returns a stable
 *     `(contractId, txHash)` pair AND records the entry on a public-ledger
 *     stream the events worker can read.
 *   - `burnAsset({ assetId, amount, reason, retiredBy?, metadata? })`
 *     appends a `burn` entry to the same public-ledger stream so
 *     `aurigraph-events.worker.processOnce()` can classify it.
 *   - `getPublicLedger('UC_CARBON')` returns the accumulated stream in the
 *     `{ entries: […] }` envelope expected by `extractBurnEvents()`.
 *
 * Implements only the methods the lifecycle services + worker actually call.
 * Keeps state in two arrays (deploys + ledger entries) so each test gets a
 * fresh instance via `new MockAurigraphAdapter()`.
 */
class MockAurigraphAdapter
  implements
    Pick<
      AurigraphDltAdapter,
      'deployContract' | 'burnAsset' | 'getPublicLedger'
    >
{
  readonly adapterName = 'mock-aurigraph';
  private readonly ledger: Array<Record<string, unknown>> = [];
  /** Each deploy keyed by contractId for later lookup on burn. */
  private readonly deploys = new Map<string, Record<string, unknown>>();

  async deployContract(spec: {
    templateId: string;
    useCaseId: string;
    channelId?: string;
    terms: Record<string, unknown>;
  }): Promise<ContractDeployResult> {
    const contractId = `ctr-${randomUUID()}`;
    const txHash = `0x${createHash('sha256')
      .update(contractId)
      .digest('hex')
      .slice(0, 16)}`;
    this.deploys.set(contractId, spec.terms);
    // Mint events go on the ledger too so the worker would see them if it
    // were configured to classify mints. (It isn't — mints have no
    // retiredFor/retiredBy AND no `burn` eventType, so `extractBurnEvents`
    // ignores them. We add them only for symmetry.)
    this.ledger.push({
      txHash,
      eventType: 'deploy',
      metadata: spec.terms,
    });
    return { contractId, txHash };
  }

  async burnAsset(spec: AssetBurnSpec): Promise<ContractDeployResult> {
    const txHash = `0x${createHash('sha256')
      .update(`${spec.assetId}-${randomUUID()}`)
      .digest('hex')
      .slice(0, 16)}`;
    const baseTerms = this.deploys.get(spec.assetId) ?? {};
    // Burns must carry the original `terms` (the events worker reads
    // bcrSerialId / bcrLockId / aurexIssuanceId off `metadata`). Top-level
    // burn metadata wins — that's how the delist initiator passes
    // `{ delist: true }` flags.
    const metadata: Record<string, unknown> = {
      ...baseTerms,
      ...(spec.metadata ?? {}),
    };

    let parsedReason: Record<string, unknown> | null = null;
    try {
      const maybeJson = JSON.parse(spec.reason);
      if (maybeJson && typeof maybeJson === 'object' && !Array.isArray(maybeJson)) {
        parsedReason = maybeJson as Record<string, unknown>;
      }
    } catch {
      // reason isn't JSON — treat as opaque narrative
    }

    if (parsedReason) {
      Object.assign(metadata, parsedReason);
    }
    if (spec.retiredBy) {
      metadata.retiredBy = spec.retiredBy;
    }

    this.ledger.push({
      txHash,
      eventType: 'burn',
      metadata,
    });

    return {
      contractId: spec.assetId,
      txHash,
    };
  }

  async getPublicLedger(_useCaseId: string): Promise<Record<string, unknown>> {
    return { entries: [...this.ledger] };
  }
}

// ── Fixture helpers ────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-4000-8000-000000000100';
const USER_ID = '00000000-0000-4000-8000-000000000101';

function resetState(): void {
  fakeDb.issuances.clear();
  fakeDb.activities.clear();
  fakeDb.methodologies.clear();
  fakeDb.periods.clear();
  fakeDb.orgs.clear();
  fakeDb.retirements.clear();
  fakeDb.delistRequests.clear();
  fakeDb.syncEvents.clear();
  fakeDb.processedEvents.clear();
  fakeDb.cursors.clear();
  fakeDb.auditLogs.clear();
  vi.clearAllMocks();
}

interface SeededFixture {
  issuanceId: string;
  activityId: string;
  methodologyId: string;
  periodId: string;
  orgId: string;
  netUnits: number;
  vintage: number;
}

function seedReadyToMint(
  overrides: Partial<{
    netUnits: number;
    vintage: number;
    methodologyCode: string;
    title: string;
  }> = {},
): SeededFixture {
  const issuanceId = randomUUID();
  const activityId = randomUUID();
  const methodologyId = randomUUID();
  const periodId = randomUUID();
  const netUnits = overrides.netUnits ?? 100;
  const vintage = overrides.vintage ?? 2025;

  fakeDb.orgs.set(ORG_ID, {
    id: ORG_ID,
    name: 'Test Org',
    slug: 'test-org',
  });
  fakeDb.methodologies.set(methodologyId, {
    id: methodologyId,
    code: overrides.methodologyCode ?? 'VM0042',
    name: 'Improved Agricultural Land Management',
    version: '2.0',
    category: 'BASELINE_AND_MONITORING',
    isActive: true,
    isBcrEligible: true,
    referenceUrl: null,
  });
  fakeDb.activities.set(activityId, {
    id: activityId,
    orgId: ORG_ID,
    methodologyId,
    title: overrides.title ?? 'Forest restoration in Karnataka',
    hostCountry: 'IN',
    description: 'Planting native species across 1200ha.',
  });
  fakeDb.periods.set(periodId, {
    id: periodId,
    activityId,
    periodStart: new Date('2025-01-01'),
    periodEnd: new Date('2025-12-31'),
    status: 'ISSUED',
  });

  const grossUnits = Math.ceil(netUnits / 0.93);
  const sopUnits = Math.floor(grossUnits * 0.05);
  const omgeUnits = Math.floor(grossUnits * 0.02);
  // Make the arithmetic exactly net = gross - sop - omge for the schema
  // pre-flight check.
  const correctedNet = grossUnits - sopUnits - omgeUnits;

  fakeDb.issuances.set(issuanceId, {
    id: issuanceId,
    activityId,
    periodId,
    grossUnits,
    sopLevyUnits: sopUnits,
    omgeCancelledUnits: omgeUnits,
    netUnits: correctedNet,
    vintage,
    unitType: 'A6_4ER',
    status: 'ISSUED',
    requestedBy: USER_ID,
    requestedAt: new Date('2026-01-01'),
    issuedAt: new Date('2026-01-15'),
    serialBlockId: null,
    tokenizationStatus: null,
    tokenizationContractId: null,
    tokenizationTxHash: null,
    bcrSerialId: null,
    bcrLockId: null,
    tokenizedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-15'),
  });

  return {
    issuanceId,
    activityId,
    methodologyId,
    periodId,
    orgId: ORG_ID,
    netUnits: correctedNet,
    vintage,
  };
}

/** Approve any KYC verification id — represents AAT-θ's `lookupKycVerification`. */
function alwaysApproveKyc(beneficiaryRef: string): KycLookup {
  return async () => ({
    approved: true,
    subjectKind: 'beneficiary',
    beneficiaryRef,
  });
}

function buildRetirementPayload(args: {
  bcrSerialId: string;
  vintage: number;
  tonnesRetired: number;
  beneficiaryName?: string;
}): Omit<BiocarbonRetirementPayload, 'retiredBy'> {
  return {
    bcrSerialId: args.bcrSerialId,
    tonnesRetired: args.tonnesRetired,
    vintage: args.vintage,
    purpose: 'CSR' as const,
    retiredFor: {
      name: args.beneficiaryName ?? 'AcmeCorp',
      orgRef: 'org:acme',
    },
    kycVerificationId: randomUUID(),
  };
}

// ── Suite setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  resetState();
});

// ── E2E Test 1 — Branch A (retirement) ─────────────────────────────────────

describe('AAT-ο / AV4-364 — full lifecycle e2e', () => {
  it('Branch A: ISSUED → lock → mint → list → burn-for-retirement → RETIRED', async () => {
    // Phase 1 — seed an ISSUED issuance ready to mint.
    const fx = seedReadyToMint({ netUnits: 100, vintage: 2025 });

    const bcrAdapter = new E2eBcrAdapter();
    const aurigraphAdapter = new MockAurigraphAdapter();

    // Phase 2 — tokenize (lock + confirm + mint + notify).
    const mintResult = await tokenizeIssuance(
      { issuanceId: fx.issuanceId, userId: USER_ID },
      {
        bcrAdapter,
        aurigraphAdapter,
        channelId: 'test-channel',
      },
    );

    expect(mintResult.contractId).toMatch(/^ctr-/);
    expect(mintResult.txHash).toMatch(/^0x/);
    expect(mintResult.bcrSerialId).toMatch(/^BCR-/);

    const postMintIssuance = fakeDb.issuances.get(fx.issuanceId);
    expect(postMintIssuance).toBeDefined();
    expect(postMintIssuance!.tokenizationStatus).toBe('MINTED');
    expect(postMintIssuance!.bcrSerialId).toBe(mintResult.bcrSerialId);
    expect(postMintIssuance!.bcrLockId).not.toBeNull();

    // BCR sync events: LOCK_VCC + CONFIRM_LOCK + NOTIFY_MINT, all synced.
    const mintEvents = [...fakeDb.syncEvents.values()];
    expect(mintEvents.map((e) => e.eventType)).toEqual([
      'LOCK_VCC',
      'CONFIRM_LOCK',
      'NOTIFY_MINT',
    ]);
    expect(mintEvents.every((e) => e.synced)).toBe(true);

    // Phase 3 — list: marketplace surfaces the new MINTED row.
    const marketplace = await listMarketplace({});
    expect(marketplace.total).toBe(1);
    expect(marketplace.items[0]!.bcrSerialId).toBe(mintResult.bcrSerialId);
    expect(marketplace.items[0]!.tonnes).toBe(fx.netUnits);
    expect(marketplace.items[0]!.status).toBe('MINTED');

    // Phase 4 — retire (chain burn with retirement metadata).
    const retirementPayload = buildRetirementPayload({
      bcrSerialId: mintResult.bcrSerialId,
      vintage: fx.vintage,
      tonnesRetired: fx.netUnits,
      beneficiaryName: 'AcmeCorp',
    });
    const retirementResult = await retireToken(
      {
        issuanceId: fx.issuanceId,
        userId: USER_ID,
        orgId: ORG_ID,
        payload: retirementPayload,
      },
      {
        aurigraphAdapter,
        kycLookup: alwaysApproveKyc('AcmeCorp'),
      },
    );

    expect(retirementResult.retirementId).toBeTruthy();
    expect(retirementResult.txHash).toMatch(/^0x/);

    // Pre-worker: status is CHAIN_BURNED on the retirement; issuance is still
    // tokenized but un-flipped.
    const retirementMidFlight = fakeDb.retirements.get(
      retirementResult.retirementId,
    );
    expect(retirementMidFlight!.status).toBe('CHAIN_BURNED');
    expect(fakeDb.issuances.get(fx.issuanceId)!.status).toBe('ISSUED');

    // Phase 5 — drive the events worker manually.
    const tickResult = await processOnce({
      aurigraphAdapter,
      bcrAdapter,
    });
    expect(tickResult.fetched).toBe(1);
    expect(tickResult.processed).toBe(1);

    // Post-worker assertions.
    const postWorkerIssuance = fakeDb.issuances.get(fx.issuanceId);
    expect(postWorkerIssuance!.status).toBe('RETIRED');

    // Retirement row is the post-worker terminal state. Today the worker
    // does not bump status to BCR_SYNCED — it remains CHAIN_BURNED while
    // updating the issuance + recording the BCR sync event. If a future
    // ticket adds the BCR_SYNCED transition, this assertion needs updating.
    const postWorkerRetirement = fakeDb.retirements.get(
      retirementResult.retirementId,
    );
    expect(['CHAIN_BURNED', 'BCR_SYNCED']).toContain(
      postWorkerRetirement!.status,
    );

    // RETIRE_VCC sync event present + synced.
    const retireEvents = [...fakeDb.syncEvents.values()].filter(
      (e) => e.eventType === 'RETIRE_VCC',
    );
    expect(retireEvents).toHaveLength(1);
    expect(retireEvents[0]!.synced).toBe(true);
    expect(retireEvents[0]!.bcrSerialId).toBe(mintResult.bcrSerialId);

    // The processed-event row is PROCESSED.
    const processed = [...fakeDb.processedEvents.values()];
    expect(processed).toHaveLength(1);
    expect(processed[0]!.status).toBe('PROCESSED');
    expect(processed[0]!.eventType).toBe('BURN_FOR_RETIREMENT');

    // Audit-log records the operator-visible action chain.
    const actions = [...fakeDb.auditLogs.values()].map((a) => a.action);
    expect(actions).toContain('issuance.tokenized');
    expect(actions).toContain('retirement.initiated');
  });

  // ── E2E Test 2 — Branch B (delist) ─────────────────────────────────────

  it('Branch B: ISSUED → lock → mint → list → burn-for-delist → ISSUED', async () => {
    const fx = seedReadyToMint({ netUnits: 100, vintage: 2025 });

    const bcrAdapter = new E2eBcrAdapter();
    const aurigraphAdapter = new MockAurigraphAdapter();

    // Mint phase — same as Branch A but we keep them independent so each
    // test is a complete narrative.
    const mintResult = await tokenizeIssuance(
      { issuanceId: fx.issuanceId, userId: USER_ID },
      { bcrAdapter, aurigraphAdapter, channelId: 'test-channel' },
    );
    expect(fakeDb.issuances.get(fx.issuanceId)!.tokenizationStatus).toBe(
      'MINTED',
    );

    // Listing visible on marketplace.
    const marketplace = await listMarketplace({});
    expect(marketplace.items[0]!.bcrSerialId).toBe(mintResult.bcrSerialId);

    // Phase 4 — delist (chain burn with `{ delist: true }` metadata).
    const delistResult = await delistIssuance(
      {
        issuanceId: fx.issuanceId,
        userId: USER_ID,
        orgId: ORG_ID,
        role: 'ORG_ADMIN',
        reason: 'returning to free state',
      },
      { aurigraphAdapter },
    );
    expect(delistResult.delistRequestId).toBeTruthy();
    expect(delistResult.txHash).toMatch(/^0x/);

    // Pre-worker: DelistRequest is at CHAIN_BURNED, issuance still MINTED.
    const preWorkerDelist = [...fakeDb.delistRequests.values()][0];
    expect(preWorkerDelist!.status).toBe('CHAIN_BURNED');
    expect(fakeDb.issuances.get(fx.issuanceId)!.status).toBe('ISSUED');

    // Phase 5 — drive the events worker.
    const tickResult = await processOnce({
      aurigraphAdapter,
      bcrAdapter,
    });
    expect(tickResult.fetched).toBe(1);
    expect(tickResult.processed).toBe(1);

    // Post-worker assertions.
    const postWorkerDelist = [...fakeDb.delistRequests.values()][0];
    expect(postWorkerDelist!.status).toBe('BCR_UNLOCKED');
    expect(postWorkerDelist!.bcrUnlockedAt).toBeInstanceOf(Date);

    // Issuance.status is forced to ISSUED by the worker on delist.
    expect(fakeDb.issuances.get(fx.issuanceId)!.status).toBe('ISSUED');

    // UNLOCK_VCC sync event present + synced.
    const unlockEvents = [...fakeDb.syncEvents.values()].filter(
      (e) => e.eventType === 'UNLOCK_VCC',
    );
    expect(unlockEvents).toHaveLength(1);
    expect(unlockEvents[0]!.synced).toBe(true);
    expect(unlockEvents[0]!.bcrLockId).toBe(
      fakeDb.issuances.get(fx.issuanceId)!.bcrLockId,
    );

    // The processed-event row is PROCESSED + BURN_FOR_DELIST.
    const processed = [...fakeDb.processedEvents.values()];
    expect(processed).toHaveLength(1);
    expect(processed[0]!.status).toBe('PROCESSED');
    expect(processed[0]!.eventType).toBe('BURN_FOR_DELIST');
  });
});

// ── Supporting unit-level pieces ───────────────────────────────────────────

describe('AAT-ο / AV4-364 — supporting lifecycle assertions', () => {
  it('mint alone leaves Issuance.tokenizationStatus=MINTED with 3 sync events', async () => {
    const fx = seedReadyToMint();
    const bcrAdapter = new E2eBcrAdapter();
    const aurigraphAdapter = new MockAurigraphAdapter();

    await tokenizeIssuance(
      { issuanceId: fx.issuanceId, userId: USER_ID },
      { bcrAdapter, aurigraphAdapter, channelId: 'test-channel' },
    );

    const issuance = fakeDb.issuances.get(fx.issuanceId)!;
    expect(issuance.tokenizationStatus).toBe('MINTED');
    expect(issuance.tokenizedAt).toBeInstanceOf(Date);

    const events = [...fakeDb.syncEvents.values()];
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.eventType)).toEqual([
      'LOCK_VCC',
      'CONFIRM_LOCK',
      'NOTIFY_MINT',
    ]);
  });

  it('marketplace omits issuances that are not yet MINTED', async () => {
    seedReadyToMint(); // ISSUED, tokenizationStatus=null
    const page = await listMarketplace({});
    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });

  it('mint is idempotent — re-call returns the cached refs without re-hitting BCR/chain', async () => {
    const fx = seedReadyToMint();
    const bcrAdapter = new E2eBcrAdapter();
    const aurigraphAdapter = new MockAurigraphAdapter();
    const deploySpy = vi.spyOn(aurigraphAdapter, 'deployContract');

    const first = await tokenizeIssuance(
      { issuanceId: fx.issuanceId, userId: USER_ID },
      { bcrAdapter, aurigraphAdapter, channelId: 'test-channel' },
    );
    const second = await tokenizeIssuance(
      { issuanceId: fx.issuanceId, userId: USER_ID },
      { bcrAdapter, aurigraphAdapter, channelId: 'test-channel' },
    );

    expect(second).toEqual(first);
    expect(deploySpy).toHaveBeenCalledTimes(1);
  });

  it('every BCR sync event records synced=true on the happy path', async () => {
    const fx = seedReadyToMint();
    const bcrAdapter = new E2eBcrAdapter();
    const aurigraphAdapter = new MockAurigraphAdapter();

    const mintResult = await tokenizeIssuance(
      { issuanceId: fx.issuanceId, userId: USER_ID },
      { bcrAdapter, aurigraphAdapter, channelId: 'test-channel' },
    );

    await delistIssuance(
      {
        issuanceId: fx.issuanceId,
        userId: USER_ID,
        orgId: ORG_ID,
        role: 'ORG_ADMIN',
      },
      { aurigraphAdapter },
    );
    await processOnce({ aurigraphAdapter, bcrAdapter });

    const all = [...fakeDb.syncEvents.values()];
    // 3 mint events + 1 unlock event from the worker.
    expect(all).toHaveLength(4);
    expect(all.every((e) => e.synced)).toBe(true);
    // Sanity: serial id is consistent across the entire trail.
    expect(
      new Set(all.map((e) => e.bcrSerialId).filter(Boolean)),
    ).toEqual(new Set([mintResult.bcrSerialId]));
  });

  it('netUnits round-trip: marketplace reflects the value persisted post-mint', async () => {
    const fx = seedReadyToMint({ netUnits: 250, vintage: 2024 });
    const bcrAdapter = new E2eBcrAdapter();
    const aurigraphAdapter = new MockAurigraphAdapter();

    const mintResult = await tokenizeIssuance(
      { issuanceId: fx.issuanceId, userId: USER_ID },
      { bcrAdapter, aurigraphAdapter, channelId: 'test-channel' },
    );

    const page = await listMarketplace({ vintage: 2024 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.bcrSerialId).toBe(mintResult.bcrSerialId);
    expect(page.items[0]!.tonnes).toBe(fx.netUnits);
    expect(asNumber(fakeDb.issuances.get(fx.issuanceId)!.netUnits)).toBe(
      fx.netUnits,
    );
  });

  it('worker tick is idempotent — re-running after PROCESSED is a no-op', async () => {
    const fx = seedReadyToMint();
    const bcrAdapter = new E2eBcrAdapter();
    const aurigraphAdapter = new MockAurigraphAdapter();

    await tokenizeIssuance(
      { issuanceId: fx.issuanceId, userId: USER_ID },
      { bcrAdapter, aurigraphAdapter, channelId: 'test-channel' },
    );
    await delistIssuance(
      {
        issuanceId: fx.issuanceId,
        userId: USER_ID,
        orgId: ORG_ID,
        role: 'ORG_ADMIN',
      },
      { aurigraphAdapter },
    );

    const first = await processOnce({ aurigraphAdapter, bcrAdapter });
    expect(first.processed).toBe(1);

    const second = await processOnce({ aurigraphAdapter, bcrAdapter });
    expect(second.fetched).toBe(0);
    expect(second.processed).toBe(0);
    // Only one UNLOCK_VCC across the two ticks.
    expect(
      [...fakeDb.syncEvents.values()].filter(
        (e) => e.eventType === 'UNLOCK_VCC',
      ),
    ).toHaveLength(1);
  });
});
