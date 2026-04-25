/**
 * AAT-τ / AV4-369 — Cross-system regression E2E harness (AWD2 → Aurex).
 *
 * Simulates the full handoff flow across the AWD2/Aurex contract boundary.
 * Unlike the route-level test (`routes/awd2-handoff.test.ts`, AAT-ξ), the
 * import service is NOT mocked — every layer below the route runs as real
 * code: zod parse, JWT verify, dedup check, persist Awd2Handoff, the import
 * service's methodology eligibility check, organisation existence, Activity
 * find-or-create, MonitoringPeriod create, Issuance create, audit log.
 *
 * The Prisma client is replaced with a stateful in-memory fake (mirrors the
 * pattern in `e2e-full-lifecycle.test.ts` AAT-ο) so the public marketplace
 * service can be hit afterwards and observe the row landing.
 *
 * Six scenarios:
 *
 *   1. Happy-path AWD2 handoff: signed JWT → handoff row → Issuance MINTED
 *      with composite tokenizationContractId (`<addr>:<tokenId>`) → row
 *      surfaces in `GET /api/v1/biocarbon/marketplace?methodologyCode=…`
 *      → row surfaces in `GET /api/v1/biocarbon/tokens/:bcrSerialId` with
 *      B13 BioCarbon attribution.
 *   2. Duplicate-nonce handoff: second POST returns `duplicate` referencing
 *      the same issuanceId; no second Issuance row is created.
 *   3. Methodology not BCR-eligible: 422 RFC 7807, Awd2Handoff row marked
 *      FAILED with structured reason; no Issuance.
 *   4. Invalid JWT signature (signed with stranger key): 401 RFC 7807; no
 *      handoff row, no Issuance.
 *   5. `AWD2_HANDOFF_PUBLIC_KEY` unset → 503 fail-closed.
 *   6. Marketplace excludes failed handoffs (the FAILED row from test 3 is
 *      not visible on the public marketplace listing).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, randomUUID, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';

// ── Shared row types for the in-memory fake ───────────────────────────────

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
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

interface ActivityRow {
  id: string;
  orgId: string;
  methodologyId: string;
  awd2ProjectRef: string | null;
  title: string;
  description: string | null;
  hostCountry: string;
  status: string;
  createdBy: string;
  createdAt: Date;
}

interface MonitoringPeriodRow {
  id: string;
  activityId: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
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
  unitType: string;
  status: string;
  requestedBy: string;
  requestedAt: Date;
  issuedAt: Date | null;
  serialBlockId: string | null;
  tokenizationStatus: string | null;
  tokenizationContractId: string | null;
  tokenizationTxHash: string | null;
  bcrSerialId: string | null;
  bcrLockId: string | null;
  tokenizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Awd2HandoffRow {
  id: string;
  handoffNonce: string;
  awd2ContractAddress: string;
  awd2TokenId: string;
  bcrSerialId: string;
  vintage: number;
  methodologyCode: string;
  projectId: string;
  projectTitle: string;
  tonnes: number;
  currentHolderOrgId: string;
  provenanceHash: string;
  handoffEmittedAt: Date;
  status: 'RECEIVED' | 'IMPORTED' | 'FAILED';
  reason: string | null;
  issuanceId: string | null;
  receivedAt: Date;
  importedAt: Date | null;
}

interface AuditLogRow {
  id: string;
  orgId: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string;
  newValue: unknown;
  createdAt: Date;
}

// ── Hoisted in-memory fake Prisma ─────────────────────────────────────────

const { fakeDb } = vi.hoisted(() => {
  const orgs = new Map<string, OrgRow>();
  const methodologies = new Map<string, MethodologyRow>();
  const activities = new Map<string, ActivityRow>();
  const periods = new Map<string, MonitoringPeriodRow>();
  const issuances = new Map<string, IssuanceRow>();
  const handoffs = new Map<string, Awd2HandoffRow>();
  const auditLogs = new Map<string, AuditLogRow>();

  // ── Issuance include shape used by listMarketplace + getTokenDetail ──
  type IssuanceInclude = {
    activity?:
      | boolean
      | {
          select?: {
            id?: boolean;
            title?: boolean;
            description?: boolean;
            hostCountry?: boolean;
            methodology?:
              | boolean
              | {
                  select?: {
                    code?: boolean;
                    name?: boolean;
                    version?: boolean;
                    referenceUrl?: boolean;
                  };
                };
          };
        };
  };

  function buildIssuanceWithIncludes(
    row: IssuanceRow,
    include?: IssuanceInclude,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...row };
    if (!include?.activity) return out;
    const activity = activities.get(row.activityId);
    if (!activity) {
      out.activity = null;
      return out;
    }
    const built: Record<string, unknown> = { ...activity };
    const inc = typeof include.activity === 'object' ? include.activity : null;
    const wantsMethodology =
      inc?.select?.methodology !== undefined && inc.select.methodology !== false;
    if (wantsMethodology) {
      const methodology = methodologies.get(activity.methodologyId);
      built.methodology = methodology ?? null;
    }
    out.activity = built;
    return out;
  }

  function matchIssuanceWhere(
    row: IssuanceRow,
    where: Record<string, unknown> | undefined,
  ): boolean {
    if (!where) return true;
    for (const [key, val] of Object.entries(where)) {
      if (key === 'tokenizationStatus') {
        if (typeof val === 'string' && val !== row.tokenizationStatus) {
          return false;
        }
      } else if (key === 'bcrSerialId') {
        if (
          val &&
          typeof val === 'object' &&
          'not' in (val as Record<string, unknown>)
        ) {
          if (row.bcrSerialId === null) return false;
        } else if (typeof val === 'string') {
          if (val !== row.bcrSerialId) return false;
        }
      } else if (key === 'vintage' && typeof val === 'number') {
        if (val !== row.vintage) return false;
      } else if (key === 'status') {
        if (typeof val === 'string' && val !== row.status) return false;
        if (
          val &&
          typeof val === 'object' &&
          'not' in (val as Record<string, unknown>)
        ) {
          const notVal = (val as { not: unknown }).not;
          if (notVal === row.status) return false;
        }
      } else if (key === 'activity' && val && typeof val === 'object') {
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
            !activity.title.toLowerCase().includes(contains.toLowerCase())
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }

  const inner = {
    // Test access to the maps.
    orgs,
    methodologies,
    activities,
    periods,
    issuances,
    handoffs,
    auditLogs,

    // ── Organization ─────────────────────────────────────────────────
    organization: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        return orgs.get(args.where.id) ?? null;
      }),
    },

    // ── Methodology ──────────────────────────────────────────────────
    methodology: {
      findFirst: vi.fn(
        async (args: { where: { code: string } }) => {
          for (const m of methodologies.values()) {
            if (m.code === args.where.code) return { ...m };
          }
          return null;
        },
      ),
      // Catalogue (AAT-π / AV4-368) reads the full active set via findMany
      // and orders by (registryCategory, code, version).
      findMany: vi.fn(
        async (args?: { where?: { isActive?: boolean; code?: string } }) => {
          const all = [...methodologies.values()].map((m) => ({ ...m }));
          const filtered = args?.where
            ? all.filter((m) => {
                if (args.where!.isActive !== undefined && m.isActive !== args.where!.isActive) return false;
                if (args.where!.code !== undefined && m.code !== args.where!.code) return false;
                return true;
              })
            : all;
          return filtered;
        },
      ),
      // awd2-import does a findUnique({ where: { code }}) post-eligibility to
      // resolve methodologyId for Activity creation.
      findUnique: vi.fn(
        async (args: { where: { code?: string; id?: string } }) => {
          for (const m of methodologies.values()) {
            if (args.where.code !== undefined && m.code === args.where.code) return { ...m };
            if (args.where.id !== undefined && m.id === args.where.id) return { ...m };
          }
          return null;
        },
      ),
    },

    // ── Activity ─────────────────────────────────────────────────────
    activity: {
      findFirst: vi.fn(
        async (args: {
          where: { awd2ProjectRef?: string; orgId?: string };
        }) => {
          for (const a of activities.values()) {
            if (
              args.where.awd2ProjectRef !== undefined &&
              a.awd2ProjectRef !== args.where.awd2ProjectRef
            ) {
              continue;
            }
            if (
              args.where.orgId !== undefined &&
              a.orgId !== args.where.orgId
            ) {
              continue;
            }
            return { ...a };
          }
          return null;
        },
      ),
      create: vi.fn(
        async (args: { data: Partial<ActivityRow> & { orgId: string } }) => {
          const id = randomUUID();
          const row: ActivityRow = {
            id,
            orgId: args.data.orgId,
            methodologyId: args.data.methodologyId ?? '',
            awd2ProjectRef: args.data.awd2ProjectRef ?? null,
            title: args.data.title ?? '',
            description: args.data.description ?? null,
            hostCountry: args.data.hostCountry ?? 'XX',
            status: args.data.status ?? 'REGISTERED',
            createdBy: args.data.createdBy ?? '',
            createdAt: new Date(),
          };
          activities.set(id, row);
          return { ...row };
        },
      ),
    },

    // ── MonitoringPeriod ─────────────────────────────────────────────
    monitoringPeriod: {
      create: vi.fn(
        async (args: {
          data: Partial<MonitoringPeriodRow> & { activityId: string };
        }) => {
          const id = randomUUID();
          const row: MonitoringPeriodRow = {
            id,
            activityId: args.data.activityId,
            periodStart: args.data.periodStart ?? new Date(),
            periodEnd: args.data.periodEnd ?? new Date(),
            status: args.data.status ?? 'ISSUED',
          };
          periods.set(id, row);
          return { ...row };
        },
      ),
    },

    // ── Issuance ─────────────────────────────────────────────────────
    issuance: {
      findUnique: vi.fn(
        async (args: { where: { id: string }; include?: IssuanceInclude }) => {
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
          skip?: number;
          take?: number;
        }) => {
          const matched: IssuanceRow[] = [];
          for (const row of issuances.values()) {
            if (matchIssuanceWhere(row, args.where)) matched.push(row);
          }
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
      create: vi.fn(
        async (args: { data: Partial<IssuanceRow> & { activityId: string; periodId: string } }) => {
          const id = randomUUID();
          const now = new Date();
          const row: IssuanceRow = {
            id,
            activityId: args.data.activityId,
            periodId: args.data.periodId,
            grossUnits: args.data.grossUnits ?? 0,
            sopLevyUnits: args.data.sopLevyUnits ?? 0,
            omgeCancelledUnits: args.data.omgeCancelledUnits ?? 0,
            netUnits: args.data.netUnits ?? 0,
            vintage: args.data.vintage ?? 2025,
            unitType: args.data.unitType ?? 'A6_4ER',
            status: args.data.status ?? 'ISSUED',
            requestedBy: args.data.requestedBy ?? '',
            requestedAt: args.data.requestedAt ?? now,
            issuedAt: args.data.issuedAt ?? now,
            serialBlockId: args.data.serialBlockId ?? null,
            tokenizationStatus: args.data.tokenizationStatus ?? null,
            tokenizationContractId: args.data.tokenizationContractId ?? null,
            tokenizationTxHash: args.data.tokenizationTxHash ?? null,
            bcrSerialId: args.data.bcrSerialId ?? null,
            bcrLockId: args.data.bcrLockId ?? null,
            tokenizedAt: args.data.tokenizedAt ?? null,
            createdAt: now,
            updatedAt: now,
          };
          issuances.set(id, row);
          return { ...row };
        },
      ),
    },

    // ── Awd2Handoff ──────────────────────────────────────────────────
    awd2Handoff: {
      findUnique: vi.fn(
        async (args: { where: { handoffNonce?: string; id?: string } }) => {
          if (args.where.handoffNonce) {
            for (const h of handoffs.values()) {
              if (h.handoffNonce === args.where.handoffNonce) return { ...h };
            }
            return null;
          }
          if (args.where.id) {
            return handoffs.get(args.where.id) ?? null;
          }
          return null;
        },
      ),
      create: vi.fn(
        async (args: {
          data: Partial<Awd2HandoffRow> & {
            handoffNonce: string;
            currentHolderOrgId: string;
          };
        }) => {
          const id = randomUUID();
          const now = new Date();
          const row: Awd2HandoffRow = {
            id,
            handoffNonce: args.data.handoffNonce,
            awd2ContractAddress: args.data.awd2ContractAddress ?? '',
            awd2TokenId: args.data.awd2TokenId ?? '',
            bcrSerialId: args.data.bcrSerialId ?? '',
            vintage: args.data.vintage ?? 0,
            methodologyCode: args.data.methodologyCode ?? '',
            projectId: args.data.projectId ?? '',
            projectTitle: args.data.projectTitle ?? '',
            tonnes: args.data.tonnes ?? 0,
            currentHolderOrgId: args.data.currentHolderOrgId,
            provenanceHash: args.data.provenanceHash ?? '',
            handoffEmittedAt: args.data.handoffEmittedAt ?? now,
            status: (args.data.status as Awd2HandoffRow['status']) ?? 'RECEIVED',
            reason: args.data.reason ?? null,
            issuanceId: args.data.issuanceId ?? null,
            receivedAt: now,
            importedAt: args.data.importedAt ?? null,
          };
          handoffs.set(id, row);
          return { ...row };
        },
      ),
      update: vi.fn(
        async (args: {
          where: { id: string };
          data: Partial<Awd2HandoffRow>;
        }) => {
          const row = handoffs.get(args.where.id);
          if (!row) {
            throw new Error(`fakeDb: handoff not found ${args.where.id}`);
          }
          Object.assign(row, args.data);
          return { ...row };
        },
      ),
    },

    // ── AuditLog ─────────────────────────────────────────────────────
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

    // ── $transaction — just runs the callback with the same surface ──
    $transaction: vi.fn(),
  };

  // Wire $transaction to pass `inner` as the tx (real Prisma forwards
  // model.create/update/etc. — our fake's models hit the same maps).
  inner.$transaction.mockImplementation(async (cb: unknown) => {
    return (cb as (t: typeof inner) => Promise<unknown>)(inner);
  });

  return { fakeDb: inner };
});

vi.mock('@aurex/database', () => ({
  prisma: fakeDb,
  Prisma: { JsonNull: 'JSON_NULL_SENTINEL' },
}));

// ── Imports AFTER mocks ───────────────────────────────────────────────────

import express, { type Request, type Response } from 'express';
import { awd2HandoffRouter } from './routes/awd2-handoff.js';
import { biocarbonPublicRouter } from './routes/biocarbon-public.js';
import { errorHandler } from './middleware/error-handler.js';

// ── Test keypairs ─────────────────────────────────────────────────────────

const { publicKey: AWD2_PUBLIC_KEY, privateKey: AWD2_PRIVATE_KEY } =
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

const { privateKey: STRANGER_PRIVATE_KEY } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// ── Test fixtures ─────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-4000-8000-000000000301';
const METHODOLOGY_ID_VM0042 = '00000000-0000-4000-8000-000000000310';
const METHODOLOGY_ID_NON_BCR = '00000000-0000-4000-8000-000000000311';

function seedReferenceData(): void {
  fakeDb.orgs.set(ORG_ID, {
    id: ORG_ID,
    name: 'AWD2 Holder Org',
    slug: 'awd2-holder',
    isActive: true,
  });
  fakeDb.methodologies.set(METHODOLOGY_ID_VM0042, {
    id: METHODOLOGY_ID_VM0042,
    code: 'VM0042',
    name: 'Improved Agricultural Land Management',
    version: '2.0',
    category: 'BASELINE_AND_MONITORING',
    isActive: true,
    isBcrEligible: true,
    referenceUrl: null,
    // AAT-π / AV4-368: catalogue fields
    registryCategory: 'BCR',
    gases: ['CO2'],
    sectoralScope: 14,
    effectiveFrom: new Date('2024-01-01'),
    effectiveUntil: null,
    notes: null,
  });
  // Seeded but NOT BCR-eligible — used by the rejection test.
  fakeDb.methodologies.set(METHODOLOGY_ID_NON_BCR, {
    id: METHODOLOGY_ID_NON_BCR,
    code: 'CDM-AMS-III.D',
    name: 'Methane recovery in animal manure management',
    version: '21.0',
    category: 'BASELINE_AND_MONITORING',
    isActive: true,
    isBcrEligible: false,
    referenceUrl: null,
    // AAT-π / AV4-368: catalogue fields
    registryCategory: 'A6_4',
    gases: ['CH4'],
    sectoralScope: 15,
    effectiveFrom: new Date('2020-01-01'),
    effectiveUntil: null,
    notes: null,
  });
}

function makeBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    awd2ContractAddress: '0xabcdef0123456789abcdef0123456789abcdef01',
    awd2TokenId: '12345',
    bcrSerialId: 'BCR-IND-2024-AR-VM0042-V1-0001',
    vintage: 2024,
    methodologyCode: 'VM0042',
    projectId: 'AWD2-PROJ-XSYS-1',
    projectTitle: 'Cross-system Reforestation Project',
    tonnes: 500,
    currentHolderOrgId: ORG_ID,
    provenanceHash:
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    handoffNonce: `nonce-${createHash('sha256').update(randomUUID()).digest('hex').slice(0, 32)}`,
    handoffEmittedAt: '2026-04-20T00:00:00+00:00',
    ...overrides,
  };
}

function signWith(
  privateKey: string,
  claims: Record<string, unknown> = {},
): string {
  return jwt.sign({ iss: 'awd2', ...claims }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '5m',
  });
}

// ── Test app helper ───────────────────────────────────────────────────────

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/awd2', awd2HandoffRouter);
  app.use('/api/v1/biocarbon', biocarbonPublicRouter);
  app.use(errorHandler);
  return app;
}

interface HttpResponse<T = unknown> {
  status: number;
  body: T;
}

/**
 * Drive an Express app via a synthetic req/res — same pattern as
 * `routes/awd2-handoff.test.ts`. Avoids supertest as a runtime dependency.
 */
async function httpRequest<T = unknown>(args: {
  app: express.Express;
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}): Promise<HttpResponse<T>> {
  const queryString = args.query
    ? '?' +
      new URLSearchParams(args.query as Record<string, string>).toString()
    : '';
  const fullUrl = `${args.url}${queryString}`;

  return new Promise<HttpResponse<T>>((resolve, reject) => {
    const req: Partial<Request> = {
      method: args.method,
      url: fullUrl,
      originalUrl: fullUrl,
      path: args.url,
      headers: {
        'content-type': 'application/json',
        ...(args.headers ?? {}),
      },
      body: args.body,
      query: (args.query ?? {}) as Record<string, string>,
      // The rate limiter probes `req.path.startsWith('/api/v1/auth')` — we
      // need a string here, hence the early populate.
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as Request['socket'],
    };

    let status = 200;
    let payload: unknown;
    const headerStore = new Map<string, string>();
    const res: Partial<Response> = {
      status(code: number) {
        status = code;
        return this as Response;
      },
      json(data: unknown) {
        payload = data;
        resolve({ status, body: payload as T });
        return this as Response;
      },
      setHeader(name: string, value: string | number | readonly string[]) {
        headerStore.set(name, String(value));
        return res as Response;
      },
      getHeader(name: string) {
        return headerStore.get(name);
      },
    };

    try {
      // Express's Application is also a callable middleware function — call
      // it through `unknown` cast to avoid relying on the (private) `handle`
      // method's typing.
      (args.app as unknown as {
        handle: (
          req: Request,
          res: Response,
          done: (err?: unknown) => void,
        ) => void;
      }).handle(req as Request, res as Response, (err: unknown) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(async () => {
  fakeDb.orgs.clear();
  fakeDb.methodologies.clear();
  fakeDb.activities.clear();
  fakeDb.periods.clear();
  fakeDb.issuances.clear();
  fakeDb.handoffs.clear();
  fakeDb.auditLogs.clear();
  vi.clearAllMocks();
  // AAT-π / AV4-368: drop the methodology catalogue's in-memory cache so
  // each test sees a freshly-seeded methodology set rather than the prior
  // test's cached entries.
  const { _resetCatalogueCacheForTests } = await import('./services/methodology.service.js');
  _resetCatalogueCacheForTests();
  // Re-attach the $transaction passthrough after clearAllMocks resets call
  // history (the implementation itself survives clearAllMocks but we want
  // to be defensive).
  fakeDb.$transaction.mockImplementation(async (cb: unknown) => {
    return (cb as (t: typeof fakeDb) => Promise<unknown>)(fakeDb);
  });

  process.env.AWD2_HANDOFF_PUBLIC_KEY = AWD2_PUBLIC_KEY;
  seedReferenceData();
});

// ── Test 1 — Happy-path AWD2 handoff ──────────────────────────────────────

describe('AAT-τ / AV4-369 — happy-path AWD2 → Aurex handoff', () => {
  it('signed JWT → Issuance MINTED → row visible in marketplace + token detail with B13 attribution', async () => {
    const app = buildApp();
    const body = makeBody();
    const token = signWith(AWD2_PRIVATE_KEY);

    // ── Step 1: emit signed handoff ─────────────────────────────────
    const handoffRes = await httpRequest<{
      data: { status: string; awd2HandoffId: string; issuanceId: string };
    }>({
      app,
      method: 'POST',
      url: '/api/v1/awd2/handoff',
      body,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(handoffRes.status).toBe(200);
    expect(handoffRes.body.data.status).toBe('imported');
    expect(handoffRes.body.data.awd2HandoffId).toBeTruthy();
    expect(handoffRes.body.data.issuanceId).toBeTruthy();

    const handoffRow = fakeDb.handoffs.get(handoffRes.body.data.awd2HandoffId);
    expect(handoffRow).toBeDefined();
    expect(handoffRow!.status).toBe('IMPORTED');
    expect(handoffRow!.issuanceId).toBe(handoffRes.body.data.issuanceId);

    // ── Step 2: assert Issuance shape ───────────────────────────────
    const issuance = fakeDb.issuances.get(handoffRes.body.data.issuanceId);
    expect(issuance).toBeDefined();
    expect(issuance!.tokenizationStatus).toBe('MINTED');
    // The composite AWD2 reference: `<contractAddress>:<tokenId>`.
    expect(issuance!.tokenizationContractId).toBe(
      `${body.awd2ContractAddress}:${body.awd2TokenId}`,
    );
    expect(issuance!.bcrSerialId).toBe(body.bcrSerialId);
    expect(issuance!.bcrLockId).toMatch(/^AWD2-LOCK-/);
    expect(issuance!.netUnits).toBe(500);
    expect(issuance!.grossUnits).toBe(500);
    expect(issuance!.sopLevyUnits).toBe(0);

    // Activity created with awd2ProjectRef set.
    const activity = fakeDb.activities.get(issuance!.activityId);
    expect(activity).toBeDefined();
    expect(activity!.awd2ProjectRef).toBe(body.projectId);
    expect(activity!.title).toBe(body.projectTitle);

    // ── Step 3: marketplace surfaces the new row ────────────────────
    const marketRes = await httpRequest<{
      items: Array<{ bcrSerialId: string; tonnes: number; status: string }>;
      total: number;
    }>({
      app,
      method: 'GET',
      url: '/api/v1/biocarbon/marketplace',
      query: { methodologyCode: 'VM0042' },
    });

    expect(marketRes.status).toBe(200);
    expect(marketRes.body.total).toBe(1);
    expect(marketRes.body.items[0]!.bcrSerialId).toBe(body.bcrSerialId);
    expect(marketRes.body.items[0]!.tonnes).toBe(500);
    expect(marketRes.body.items[0]!.status).toBe('MINTED');

    // ── Step 4: token detail returns B13 attribution ────────────────
    const detailRes = await httpRequest<{
      bcrSerialId: string;
      projectTitle: string;
      tokenizationContractId: string | null;
      biocarbonAttribution: { attribution: string; registryUrl: string };
    }>({
      app,
      method: 'GET',
      url: `/api/v1/biocarbon/tokens/${encodeURIComponent(String(body.bcrSerialId))}`,
    });

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.bcrSerialId).toBe(body.bcrSerialId);
    expect(detailRes.body.projectTitle).toBe(body.projectTitle);
    expect(detailRes.body.tokenizationContractId).toBe(
      `${body.awd2ContractAddress}:${body.awd2TokenId}`,
    );
    // B13: BioCarbon attribution must be on every public surface.
    expect(detailRes.body.biocarbonAttribution).toEqual({
      attribution: 'Issued under BioCarbon Standard',
      registryUrl: 'https://biocarbonstandard.com',
    });
  });
});

// ── Test 2 — Duplicate handoff dedup ──────────────────────────────────────

describe('AAT-τ / AV4-369 — duplicate handoff dedup', () => {
  it('same nonce twice → first imports, second returns duplicate, no second Issuance', async () => {
    const app = buildApp();
    const body = makeBody();
    const token = signWith(AWD2_PRIVATE_KEY);

    const first = await httpRequest<{
      data: { status: string; awd2HandoffId: string; issuanceId: string };
    }>({
      app,
      method: 'POST',
      url: '/api/v1/awd2/handoff',
      body,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe('imported');

    // Sign a fresh JWT (same payload nonce, different jti).
    const replayToken = signWith(AWD2_PRIVATE_KEY);
    const second = await httpRequest<{
      data: { status: string; awd2HandoffId: string; issuanceId: string | null };
    }>({
      app,
      method: 'POST',
      url: '/api/v1/awd2/handoff',
      body,
      headers: { authorization: `Bearer ${replayToken}` },
    });

    expect(second.status).toBe(200);
    expect(second.body.data.status).toBe('duplicate');
    // Same handoff row + same issuance.
    expect(second.body.data.awd2HandoffId).toBe(first.body.data.awd2HandoffId);
    expect(second.body.data.issuanceId).toBe(first.body.data.issuanceId);

    // Critically: only one issuance row, only one handoff row.
    expect(fakeDb.issuances.size).toBe(1);
    expect(fakeDb.handoffs.size).toBe(1);
  });
});

// ── Test 3 — Methodology not BCR-eligible ─────────────────────────────────

describe('AAT-τ / AV4-369 — methodology eligibility rejection', () => {
  it('non-BCR methodologyCode → 422 RFC 7807, handoff FAILED, no Issuance', async () => {
    const app = buildApp();
    const body = makeBody({ methodologyCode: 'CDM-AMS-III.D' });
    const token = signWith(AWD2_PRIVATE_KEY);

    const res = await httpRequest<{
      type: string;
      title: string;
      status: number;
      detail: string;
    }>({
      app,
      method: 'POST',
      url: '/api/v1/awd2/handoff',
      body,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(422);
    expect(res.body.title).toBe('Unprocessable Entity');
    expect(res.body.detail).toMatch(/not BCR-eligible/i);

    // Awd2Handoff row exists (route persists before importing) and is FAILED.
    expect(fakeDb.handoffs.size).toBe(1);
    const handoff = [...fakeDb.handoffs.values()][0]!;
    expect(handoff.status).toBe('FAILED');
    expect(handoff.reason).toMatch(/not BCR-eligible/i);
    expect(handoff.issuanceId).toBeNull();

    // No Issuance was created.
    expect(fakeDb.issuances.size).toBe(0);
  });

  it('unknown methodologyCode → 422 with structured FAILED handoff', async () => {
    const app = buildApp();
    const body = makeBody({ methodologyCode: 'TOTALLY-UNKNOWN-METHODOLOGY' });
    const token = signWith(AWD2_PRIVATE_KEY);

    const res = await httpRequest<{ status: number; detail: string }>({
      app,
      method: 'POST',
      url: '/api/v1/awd2/handoff',
      body,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(422);
    expect(res.body.detail).toMatch(/not BCR-eligible/i);
    const handoff = [...fakeDb.handoffs.values()][0]!;
    expect(handoff.status).toBe('FAILED');
    expect(fakeDb.issuances.size).toBe(0);
  });
});

// ── Test 4 — Invalid JWT signature ────────────────────────────────────────

describe('AAT-τ / AV4-369 — invalid JWT signature', () => {
  it('JWT signed with stranger key → 401 RFC 7807, no handoff row, no Issuance', async () => {
    const app = buildApp();
    const body = makeBody();
    const forgedToken = signWith(STRANGER_PRIVATE_KEY);

    const res = await httpRequest<{
      type: string;
      title: string;
      status: number;
      detail: string;
    }>({
      app,
      method: 'POST',
      url: '/api/v1/awd2/handoff',
      body,
      headers: { authorization: `Bearer ${forgedToken}` },
    });

    expect(res.status).toBe(401);
    expect(res.body.title).toBe('Unauthorized');
    expect(res.body.detail).toMatch(/Invalid AWD2 handoff JWT/);

    // No DB writes — verification happens before any persistence.
    expect(fakeDb.handoffs.size).toBe(0);
    expect(fakeDb.issuances.size).toBe(0);
  });
});

// ── Test 5 — Federation gate: AWD2_HANDOFF_PUBLIC_KEY unset ───────────────

describe('AAT-τ / AV4-369 — federation gate', () => {
  it('AWD2_HANDOFF_PUBLIC_KEY unset → 503 fail-closed, no DB writes', async () => {
    delete process.env.AWD2_HANDOFF_PUBLIC_KEY;

    const app = buildApp();
    const body = makeBody();
    const token = signWith(AWD2_PRIVATE_KEY);

    const res = await httpRequest<{
      title: string;
      status: number;
      detail: string;
    }>({
      app,
      method: 'POST',
      url: '/api/v1/awd2/handoff',
      body,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(503);
    expect(res.body.title).toBe('Service Unavailable');
    expect(res.body.detail).toMatch(/AWD2_HANDOFF_PUBLIC_KEY unset/);

    // Fail-closed at the gate — nothing persisted.
    expect(fakeDb.handoffs.size).toBe(0);
    expect(fakeDb.issuances.size).toBe(0);
  });
});

// ── Test 6 — Marketplace excludes failed handoffs ─────────────────────────

describe('AAT-τ / AV4-369 — marketplace excludes failed handoffs', () => {
  it('a FAILED handoff produces no marketplace listing (and a successful one alongside is unaffected)', async () => {
    const app = buildApp();

    // First emit a happy-path handoff (success, will appear).
    const goodBody = makeBody({
      bcrSerialId: 'BCR-IND-2024-AR-VM0042-V1-GOOD',
      projectId: 'AWD2-PROJ-GOOD',
    });
    const goodRes = await httpRequest<{
      data: { status: string };
    }>({
      app,
      method: 'POST',
      url: '/api/v1/awd2/handoff',
      body: goodBody,
      headers: { authorization: `Bearer ${signWith(AWD2_PRIVATE_KEY)}` },
    });
    expect(goodRes.body.data.status).toBe('imported');

    // Now emit a failing one (non-BCR methodology).
    const badBody = makeBody({
      bcrSerialId: 'BCR-IND-2024-AR-CDM-V1-BAD',
      projectId: 'AWD2-PROJ-BAD',
      methodologyCode: 'CDM-AMS-III.D',
    });
    const badRes = await httpRequest({
      app,
      method: 'POST',
      url: '/api/v1/awd2/handoff',
      body: badBody,
      headers: { authorization: `Bearer ${signWith(AWD2_PRIVATE_KEY)}` },
    });
    expect(badRes.status).toBe(422);

    // ── Marketplace listing ─────────────────────────────────────────
    const marketRes = await httpRequest<{
      items: Array<{ bcrSerialId: string }>;
      total: number;
    }>({
      app,
      method: 'GET',
      url: '/api/v1/biocarbon/marketplace',
    });

    expect(marketRes.status).toBe(200);
    expect(marketRes.body.total).toBe(1);
    expect(marketRes.body.items.map((i) => i.bcrSerialId)).toEqual([
      'BCR-IND-2024-AR-VM0042-V1-GOOD',
    ]);
    // The bad serial is NOT in the listing.
    expect(
      marketRes.body.items.some(
        (i) => i.bcrSerialId === 'BCR-IND-2024-AR-CDM-V1-BAD',
      ),
    ).toBe(false);

    // Token detail for the failed serial returns 404 (no MINTED row).
    const failDetail = await httpRequest<{
      type: string;
      title: string;
      status: number;
    }>({
      app,
      method: 'GET',
      url: '/api/v1/biocarbon/tokens/BCR-IND-2024-AR-CDM-V1-BAD',
    });
    expect(failDetail.status).toBe(404);
  });
});
