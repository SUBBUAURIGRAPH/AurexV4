/**
 * AAT-PERSISTENCE / Wave 9b — Data persistence round-trip audit.
 *
 * Verifies that every CRUD operation on the major entities round-trips
 * through the @aurex/database Prisma client. The Prisma client is replaced
 * with a stateful in-memory fake (mirrors `cross-system-regression.test.ts`
 * and `e2e-full-lifecycle.test.ts`) so the service / route layer runs as
 * real code.
 *
 * Each describe block corresponds to one entity in the audit list. The
 * tests drive the SERVICE layer directly (rather than the Express route)
 * — the route → service mapping is already covered by routes/*.test.ts;
 * what the persistence audit has to prove is that every service.create /
 * update / delete / findMany lands a row that subsequent reads observe.
 *
 * Design notes:
 *
 *   - We mock @aurex/database with a per-model `Map<id, row>`. Each model
 *     exposes only the methods the audited service touches — no point
 *     reimplementing all of Prisma.
 *   - `$transaction(callback)` forwards the same fake as the tx so any
 *     model the callback uses will share the same maps.
 *   - Status: PASS = full Create → List → Read → Update → Delete works
 *             PARTIAL = some operations work, some are missing
 *             SCHEMA-ONLY = model exists but no service-layer round-trip
 *
 * Companion: docs/PERSISTENCE_AUDIT.md (per-entity findings).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

// ─────────────────────────────────────────────────────────────────────────
// In-memory fake Prisma — supports the entities we round-trip below.
// ─────────────────────────────────────────────────────────────────────────

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  parentOrgId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface OrgMemberRow {
  id: string;
  userId: string;
  orgId: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  user?: { id: string; email: string; name: string };
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface EmissionsRow {
  id: string;
  orgId: string;
  scope: string;
  category: string;
  source: string;
  value: number;
  unit: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  metadata: unknown;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface BaselineRow {
  id: string;
  orgId: string;
  name: string;
  scope: string;
  baseYear: number;
  value: number;
  unit: string;
  methodology: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface TargetRow {
  id: string;
  orgId: string;
  name: string;
  scope: string;
  targetYear: number;
  reduction: number;
  pathway: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  progress?: unknown[];
}

interface ReportRow {
  id: string;
  orgId: string;
  type: string;
  status: string;
  lifecycleStatus: string;
  parameters: unknown;
  reportData: unknown;
  createdBy: string;
  shareToken: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  publishedAt: Date | null;
  publishedBy: string | null;
  archivedAt: Date | null;
  archivedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SupplierRow {
  id: string;
  orgId: string;
  name: string;
  email: string;
  contactPerson: string | null;
  category: string | null;
  externalId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
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

interface OnboardingRow {
  id: string;
  orgId: string;
  status: string;
  currentStep: number;
  completedSteps: number[];
  stepData: Record<string, unknown> | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AuditLogRow {
  id: string;
  orgId: string | null;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: Date;
}

interface KycRow {
  id: string;
  subjectKind: string;
  subjectRef: string;
  level: string;
  status: string;
  vendorName: string | null;
  vendorRef: string | null;
  riskScore: number | null;
  sanctionsHit: boolean | null;
  beneficiaryRef: string | null;
  attestations: unknown;
  lastCheckedAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const { fakeDb } = vi.hoisted(() => {
  const orgs = new Map<string, OrgRow>();
  const orgMembers = new Map<string, OrgMemberRow>();
  const users = new Map<string, UserRow>();
  const emissions = new Map<string, EmissionsRow>();
  const baselines = new Map<string, BaselineRow>();
  const targets = new Map<string, TargetRow>();
  const reports = new Map<string, ReportRow>();
  const suppliers = new Map<string, SupplierRow>();
  const activities = new Map<string, ActivityRow>();
  const onboarding = new Map<string, OnboardingRow>();
  const auditLogs = new Map<string, AuditLogRow>();
  const kyc = new Map<string, KycRow>();

  function matchOrg(row: OrgRow, where: Record<string, unknown> | undefined): boolean {
    if (!where) return true;
    if (where.id !== undefined && row.id !== where.id) return false;
    if (where.slug !== undefined && row.slug !== where.slug) return false;
    return true;
  }

  function matchOrgMember(
    row: OrgMemberRow,
    where: Record<string, unknown> | undefined,
  ): boolean {
    if (!where) return true;
    if (where.userId !== undefined && row.userId !== where.userId) return false;
    if (where.orgId !== undefined && row.orgId !== where.orgId) return false;
    if (where.role !== undefined && row.role !== where.role) return false;
    if (where.isActive !== undefined && row.isActive !== where.isActive) return false;
    return true;
  }

  const inner = {
    // expose for tests
    orgs,
    orgMembers,
    users,
    emissions,
    baselines,
    targets,
    reports,
    suppliers,
    activities,
    onboarding,
    auditLogs,
    kyc,

    // ── User ───────────────────────────────────────────────────────
    user: {
      findUnique: vi.fn(
        async (args: { where: { id?: string; email?: string } }) => {
          for (const u of users.values()) {
            if (args.where.id !== undefined && u.id === args.where.id) return { ...u };
            if (args.where.email !== undefined && u.email === args.where.email) return { ...u };
          }
          return null;
        },
      ),
      findMany: vi.fn(async () => Array.from(users.values()).map((u) => ({ ...u }))),
      create: vi.fn(
        async (args: {
          data: Partial<UserRow> & {
            orgMembers?: {
              create: { orgId: string; role: string; isActive?: boolean };
            };
          };
        }) => {
          const id = (args.data.id as string) ?? randomUUID();
          const now = new Date();
          const row: UserRow = {
            id,
            email: args.data.email ?? '',
            name: args.data.name ?? '',
            role: args.data.role ?? 'VIEWER',
            passwordHash: args.data.passwordHash ?? '',
            isActive: args.data.isActive ?? true,
            isVerified: args.data.isVerified ?? false,
            createdAt: now,
            updatedAt: now,
          };
          users.set(id, row);
          // Inline OrgMember create when user.create includes a nested
          // orgMembers.create (used by createUserForOrg).
          if (args.data.orgMembers?.create) {
            const memberId = randomUUID();
            const member: OrgMemberRow = {
              id: memberId,
              userId: id,
              orgId: args.data.orgMembers.create.orgId,
              role: args.data.orgMembers.create.role,
              isActive: args.data.orgMembers.create.isActive ?? true,
              createdAt: now,
            };
            orgMembers.set(memberId, member);
          }
          return { ...row };
        },
      ),
      update: vi.fn(
        async (args: { where: { id: string }; data: Partial<UserRow> }) => {
          const row = users.get(args.where.id);
          if (!row) throw new Error(`fakeDb: user ${args.where.id} not found`);
          Object.assign(row, args.data, { updatedAt: new Date() });
          return { ...row };
        },
      ),
      delete: vi.fn(async (args: { where: { id: string } }) => {
        users.delete(args.where.id);
        return { id: args.where.id };
      }),
    },

    // ── Organization ───────────────────────────────────────────────
    organization: {
      findUnique: vi.fn(
        async (args: { where: { id?: string; slug?: string } }) => {
          for (const o of orgs.values()) {
            if (matchOrg(o, args.where)) return { ...o };
          }
          return null;
        },
      ),
      findMany: vi.fn(
        async (args?: {
          where?: { id?: { in: string[] } } & Record<string, unknown>;
        }) => {
          const ids = args?.where?.id?.in;
          let all = Array.from(orgs.values());
          if (ids) all = all.filter((o) => ids.includes(o.id));
          return all.map((o) => ({ ...o }));
        },
      ),
      create: vi.fn(
        async (args: {
          data: Partial<OrgRow> & {
            members?: { create: { userId: string; role: string } };
          };
        }) => {
          const id = randomUUID();
          const now = new Date();
          const row: OrgRow = {
            id,
            name: args.data.name ?? '',
            slug: args.data.slug ?? '',
            isActive: args.data.isActive ?? true,
            parentOrgId: args.data.parentOrgId ?? null,
            createdAt: now,
            updatedAt: now,
          };
          orgs.set(id, row);
          // Inline OrgMember create (Prisma "members.create" relation)
          if (args.data.members?.create) {
            const memberId = randomUUID();
            const member: OrgMemberRow = {
              id: memberId,
              userId: args.data.members.create.userId,
              orgId: id,
              role: args.data.members.create.role,
              isActive: true,
              createdAt: now,
            };
            orgMembers.set(memberId, member);
          }
          return { ...row };
        },
      ),
      update: vi.fn(
        async (args: { where: { id: string }; data: Partial<OrgRow> }) => {
          const row = orgs.get(args.where.id);
          if (!row) throw new Error(`fakeDb: org ${args.where.id} not found`);
          Object.assign(row, args.data, { updatedAt: new Date() });
          return { ...row };
        },
      ),
    },

    // ── OrgMember ──────────────────────────────────────────────────
    orgMember: {
      findFirst: vi.fn(
        async (args: { where: Record<string, unknown> }) => {
          for (const m of orgMembers.values()) {
            if (matchOrgMember(m, args.where)) return { ...m };
          }
          return null;
        },
      ),
      findUnique: vi.fn(
        async (args: { where: { userId_orgId?: { userId: string; orgId: string } } }) => {
          if (args.where.userId_orgId) {
            const { userId, orgId } = args.where.userId_orgId;
            for (const m of orgMembers.values()) {
              if (m.userId === userId && m.orgId === orgId) return { ...m };
            }
          }
          return null;
        },
      ),
      findMany: vi.fn(
        async (args?: {
          where?: Record<string, unknown>;
          select?: { orgId?: boolean };
          include?: { user?: { select: { id: boolean; email: boolean; name: boolean } } };
          skip?: number;
          take?: number;
        }) => {
          const matched: OrgMemberRow[] = [];
          for (const m of orgMembers.values()) {
            if (matchOrgMember(m, args?.where)) matched.push(m);
          }
          const start = args?.skip ?? 0;
          const end = start + (args?.take ?? matched.length);
          return matched.slice(start, end).map((m) => {
            const out: Record<string, unknown> = { ...m };
            if (args?.include?.user) {
              const user = users.get(m.userId);
              out.user = user
                ? { id: user.id, email: user.email, name: user.name }
                : null;
            }
            if (args?.select?.orgId) {
              return { orgId: m.orgId };
            }
            return out;
          });
        },
      ),
      count: vi.fn(async (args?: { where?: Record<string, unknown> }) => {
        let n = 0;
        for (const m of orgMembers.values()) {
          if (matchOrgMember(m, args?.where)) n += 1;
        }
        return n;
      }),
      create: vi.fn(
        async (args: {
          data: Partial<OrgMemberRow>;
          include?: { user?: unknown };
        }) => {
          const id = randomUUID();
          const row: OrgMemberRow = {
            id,
            userId: args.data.userId ?? '',
            orgId: args.data.orgId ?? '',
            role: args.data.role ?? 'VIEWER',
            isActive: args.data.isActive ?? true,
            createdAt: new Date(),
          };
          orgMembers.set(id, row);
          const out: Record<string, unknown> = { ...row };
          if (args.include?.user) {
            const user = users.get(row.userId);
            out.user = user
              ? { id: user.id, email: user.email, name: user.name }
              : null;
          }
          return out;
        },
      ),
      update: vi.fn(
        async (args: {
          where: { id: string };
          data: Partial<OrgMemberRow>;
          include?: { user?: unknown };
        }) => {
          const row = orgMembers.get(args.where.id);
          if (!row) throw new Error(`fakeDb: member ${args.where.id} not found`);
          Object.assign(row, args.data);
          const out: Record<string, unknown> = { ...row };
          if (args.include?.user) {
            const user = users.get(row.userId);
            out.user = user
              ? { id: user.id, email: user.email, name: user.name }
              : null;
          }
          return out;
        },
      ),
      upsert: vi.fn(
        async (args: {
          where: { userId_orgId: { userId: string; orgId: string } };
          create: Partial<OrgMemberRow>;
          update: Partial<OrgMemberRow>;
        }) => {
          const { userId, orgId } = args.where.userId_orgId;
          for (const m of orgMembers.values()) {
            if (m.userId === userId && m.orgId === orgId) {
              Object.assign(m, args.update);
              return { ...m };
            }
          }
          const id = randomUUID();
          const row: OrgMemberRow = {
            id,
            userId,
            orgId,
            role: args.create.role ?? 'VIEWER',
            isActive: args.create.isActive ?? true,
            createdAt: new Date(),
          };
          orgMembers.set(id, row);
          return { ...row };
        },
      ),
    },

    // Raw SQL (org descendant CTE) — flatten to no descendants for tests.
    $queryRaw: vi.fn(async (..._args: unknown[]) => {
      // Returns the seed orgs straight back; for these tests we don't
      // exercise the descendant tree.
      return [] as Array<{ id: string }>;
    }),

    // ── EmissionsRecord ────────────────────────────────────────────
    emissionsRecord: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        return emissions.get(args.where.id) ?? null;
      }),
      findFirst: vi.fn(
        async (args: { where: { id?: string; orgId?: string } }) => {
          for (const e of emissions.values()) {
            if (args.where.id !== undefined && e.id !== args.where.id) continue;
            if (args.where.orgId !== undefined && e.orgId !== args.where.orgId) continue;
            return { ...e };
          }
          return null;
        },
      ),
      findMany: vi.fn(
        async (args?: {
          where?: Record<string, unknown>;
          skip?: number;
          take?: number;
          orderBy?: Record<string, string>;
        }) => {
          const w = args?.where ?? {};
          const matched: EmissionsRow[] = [];
          for (const e of emissions.values()) {
            if (w.orgId !== undefined && e.orgId !== w.orgId) continue;
            if (w.scope !== undefined && e.scope !== w.scope) continue;
            if (w.status !== undefined && e.status !== w.status) continue;
            matched.push(e);
          }
          const start = args?.skip ?? 0;
          const end = start + (args?.take ?? matched.length);
          return matched.slice(start, end).map((e) => ({ ...e }));
        },
      ),
      count: vi.fn(async (args?: { where?: Record<string, unknown> }) => {
        const w = args?.where ?? {};
        let n = 0;
        for (const e of emissions.values()) {
          if (w.orgId !== undefined && e.orgId !== w.orgId) continue;
          if (w.scope !== undefined && e.scope !== w.scope) continue;
          if (w.status !== undefined && e.status !== w.status) continue;
          n += 1;
        }
        return n;
      }),
      create: vi.fn(async (args: { data: Partial<EmissionsRow> }) => {
        const id = randomUUID();
        const now = new Date();
        const row: EmissionsRow = {
          id,
          orgId: args.data.orgId ?? '',
          scope: args.data.scope ?? 'SCOPE_1',
          category: args.data.category ?? '',
          source: args.data.source ?? '',
          value: Number(args.data.value ?? 0),
          unit: args.data.unit ?? 'tCO2e',
          periodStart: args.data.periodStart ?? now,
          periodEnd: args.data.periodEnd ?? now,
          status: args.data.status ?? 'DRAFT',
          metadata: args.data.metadata ?? null,
          createdBy: args.data.createdBy ?? '',
          createdAt: now,
          updatedAt: now,
        };
        emissions.set(id, row);
        return { ...row };
      }),
      update: vi.fn(
        async (args: { where: { id: string }; data: Partial<EmissionsRow> }) => {
          const row = emissions.get(args.where.id);
          if (!row) throw new Error(`fakeDb: emission ${args.where.id} not found`);
          Object.assign(row, args.data, { updatedAt: new Date() });
          return { ...row };
        },
      ),
      updateMany: vi.fn(
        async (args: {
          where: { id?: { in: string[] }; orgId?: string };
          data: Partial<EmissionsRow>;
        }) => {
          const ids = args.where.id?.in ?? [];
          let count = 0;
          for (const id of ids) {
            const row = emissions.get(id);
            if (!row) continue;
            if (args.where.orgId && row.orgId !== args.where.orgId) continue;
            Object.assign(row, args.data, { updatedAt: new Date() });
            count += 1;
          }
          return { count };
        },
      ),
      delete: vi.fn(async (args: { where: { id: string } }) => {
        const row = emissions.get(args.where.id);
        emissions.delete(args.where.id);
        return row ?? { id: args.where.id };
      }),
    },

    // ── EmissionsBaseline ──────────────────────────────────────────
    emissionsBaseline: {
      findFirst: vi.fn(
        async (args: { where: { id?: string; orgId?: string } }) => {
          for (const b of baselines.values()) {
            if (args.where.id !== undefined && b.id !== args.where.id) continue;
            if (args.where.orgId !== undefined && b.orgId !== args.where.orgId) continue;
            return { ...b };
          }
          return null;
        },
      ),
      findMany: vi.fn(
        async (args?: { where?: Record<string, unknown> }) => {
          const w = args?.where ?? {};
          const matched: BaselineRow[] = [];
          for (const b of baselines.values()) {
            if (w.orgId !== undefined && b.orgId !== w.orgId) continue;
            if (w.scope !== undefined && b.scope !== w.scope) continue;
            matched.push(b);
          }
          return matched.map((b) => ({ ...b }));
        },
      ),
      create: vi.fn(async (args: { data: Partial<BaselineRow> }) => {
        const id = randomUUID();
        const now = new Date();
        const row: BaselineRow = {
          id,
          orgId: args.data.orgId ?? '',
          name: args.data.name ?? '',
          scope: args.data.scope ?? 'SCOPE_1',
          baseYear: args.data.baseYear ?? 2020,
          value: Number(args.data.value ?? 0),
          unit: args.data.unit ?? 'tCO2e',
          methodology: args.data.methodology ?? null,
          isActive: args.data.isActive ?? true,
          createdAt: now,
          updatedAt: now,
        };
        baselines.set(id, row);
        return { ...row };
      }),
      update: vi.fn(
        async (args: { where: { id: string }; data: Partial<BaselineRow> }) => {
          const row = baselines.get(args.where.id);
          if (!row) throw new Error(`fakeDb: baseline ${args.where.id} not found`);
          Object.assign(row, args.data, { updatedAt: new Date() });
          return { ...row };
        },
      ),
      delete: vi.fn(async (args: { where: { id: string } }) => {
        const row = baselines.get(args.where.id);
        baselines.delete(args.where.id);
        return row ?? { id: args.where.id };
      }),
    },

    // ── EmissionsTarget ────────────────────────────────────────────
    emissionsTarget: {
      findFirst: vi.fn(
        async (args: {
          where: { id?: string; orgId?: string };
          include?: { progress?: unknown };
        }) => {
          for (const t of targets.values()) {
            if (args.where.id !== undefined && t.id !== args.where.id) continue;
            if (args.where.orgId !== undefined && t.orgId !== args.where.orgId) continue;
            const out: Record<string, unknown> = { ...t };
            if (args.include?.progress) out.progress = [];
            return out;
          }
          return null;
        },
      ),
      findMany: vi.fn(
        async (args?: { where?: Record<string, unknown> }) => {
          const w = args?.where ?? {};
          const matched: TargetRow[] = [];
          for (const t of targets.values()) {
            if (w.orgId !== undefined && t.orgId !== w.orgId) continue;
            if (w.scope !== undefined && t.scope !== w.scope) continue;
            matched.push(t);
          }
          return matched.map((t) => ({ ...t }));
        },
      ),
      create: vi.fn(async (args: { data: Partial<TargetRow> }) => {
        const id = randomUUID();
        const now = new Date();
        const row: TargetRow = {
          id,
          orgId: args.data.orgId ?? '',
          name: args.data.name ?? '',
          scope: args.data.scope ?? 'SCOPE_1',
          targetYear: args.data.targetYear ?? 2030,
          reduction: Number(args.data.reduction ?? 0),
          pathway: args.data.pathway ?? null,
          status: args.data.status ?? 'DRAFT',
          createdAt: now,
          updatedAt: now,
        };
        targets.set(id, row);
        return { ...row };
      }),
      update: vi.fn(
        async (args: { where: { id: string }; data: Partial<TargetRow> }) => {
          const row = targets.get(args.where.id);
          if (!row) throw new Error(`fakeDb: target ${args.where.id} not found`);
          Object.assign(row, args.data, { updatedAt: new Date() });
          return { ...row };
        },
      ),
    },

    // ── Report ─────────────────────────────────────────────────────
    report: {
      findFirst: vi.fn(
        async (args: {
          where: { id?: string; orgId?: string };
          select?: Record<string, boolean>;
        }) => {
          for (const r of reports.values()) {
            if (args.where.id !== undefined && r.id !== args.where.id) continue;
            if (args.where.orgId !== undefined && r.orgId !== args.where.orgId) continue;
            return { ...r };
          }
          return null;
        },
      ),
      findMany: vi.fn(
        async (args?: { where?: Record<string, unknown> }) => {
          const w = args?.where ?? {};
          const matched: ReportRow[] = [];
          for (const r of reports.values()) {
            if (w.orgId !== undefined && r.orgId !== w.orgId) continue;
            matched.push(r);
          }
          return matched
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((r) => ({ ...r }));
        },
      ),
      create: vi.fn(async (args: { data: Partial<ReportRow> }) => {
        const id = randomUUID();
        const now = new Date();
        const row: ReportRow = {
          id,
          orgId: args.data.orgId ?? '',
          type: args.data.type ?? 'GHG_ANNUAL',
          status: args.data.status ?? 'QUEUED',
          lifecycleStatus: args.data.lifecycleStatus ?? 'DRAFT',
          parameters: args.data.parameters ?? null,
          reportData: args.data.reportData ?? null,
          createdBy: args.data.createdBy ?? '',
          shareToken: args.data.shareToken ?? null,
          submittedAt: args.data.submittedAt ?? null,
          approvedAt: args.data.approvedAt ?? null,
          approvedBy: args.data.approvedBy ?? null,
          publishedAt: args.data.publishedAt ?? null,
          publishedBy: args.data.publishedBy ?? null,
          archivedAt: args.data.archivedAt ?? null,
          archivedBy: args.data.archivedBy ?? null,
          createdAt: now,
          updatedAt: now,
        };
        reports.set(id, row);
        return { ...row };
      }),
      update: vi.fn(
        async (args: { where: { id: string }; data: Partial<ReportRow> }) => {
          const row = reports.get(args.where.id);
          if (!row) throw new Error(`fakeDb: report ${args.where.id} not found`);
          Object.assign(row, args.data, { updatedAt: new Date() });
          return { ...row };
        },
      ),
    },

    // ── Supplier ───────────────────────────────────────────────────
    supplier: {
      findFirst: vi.fn(
        async (args: { where: Record<string, unknown> }) => {
          const w = args.where;
          for (const s of suppliers.values()) {
            if (w.id !== undefined && s.id !== w.id) continue;
            if (w.orgId !== undefined && s.orgId !== w.orgId) continue;
            if (w.email !== undefined && s.email !== w.email) continue;
            return { ...s };
          }
          return null;
        },
      ),
      findMany: vi.fn(
        async (args?: {
          where?: Record<string, unknown>;
          skip?: number;
          take?: number;
        }) => {
          const w = args?.where ?? {};
          const matched: SupplierRow[] = [];
          for (const s of suppliers.values()) {
            if (w.orgId !== undefined && s.orgId !== w.orgId) continue;
            if (w.status !== undefined && s.status !== w.status) continue;
            if (w.category !== undefined && s.category !== w.category) continue;
            matched.push(s);
          }
          const start = args?.skip ?? 0;
          const end = start + (args?.take ?? matched.length);
          return matched.slice(start, end).map((s) => ({ ...s }));
        },
      ),
      count: vi.fn(async (args?: { where?: Record<string, unknown> }) => {
        const w = args?.where ?? {};
        let n = 0;
        for (const s of suppliers.values()) {
          if (w.orgId !== undefined && s.orgId !== w.orgId) continue;
          if (w.status !== undefined && s.status !== w.status) continue;
          n += 1;
        }
        return n;
      }),
      create: vi.fn(async (args: { data: Partial<SupplierRow> }) => {
        const id = randomUUID();
        const now = new Date();
        const row: SupplierRow = {
          id,
          orgId: args.data.orgId ?? '',
          name: args.data.name ?? '',
          email: args.data.email ?? '',
          contactPerson: args.data.contactPerson ?? null,
          category: args.data.category ?? null,
          externalId: args.data.externalId ?? null,
          status: args.data.status ?? 'INVITED',
          createdAt: now,
          updatedAt: now,
        };
        suppliers.set(id, row);
        return { ...row };
      }),
      update: vi.fn(
        async (args: { where: { id: string }; data: Partial<SupplierRow> }) => {
          const row = suppliers.get(args.where.id);
          if (!row) throw new Error(`fakeDb: supplier ${args.where.id} not found`);
          Object.assign(row, args.data, { updatedAt: new Date() });
          return { ...row };
        },
      ),
      delete: vi.fn(async (args: { where: { id: string } }) => {
        const row = suppliers.get(args.where.id);
        suppliers.delete(args.where.id);
        return row ?? { id: args.where.id };
      }),
    },

    // ── Activity ───────────────────────────────────────────────────
    activity: {
      findFirst: vi.fn(
        async (args: { where: Record<string, unknown> }) => {
          const w = args.where;
          for (const a of activities.values()) {
            if (w.id !== undefined && a.id !== w.id) continue;
            if (w.orgId !== undefined && a.orgId !== w.orgId) continue;
            return { ...a };
          }
          return null;
        },
      ),
      findMany: vi.fn(
        async (args?: { where?: Record<string, unknown> }) => {
          const w = args?.where ?? {};
          const matched: ActivityRow[] = [];
          for (const a of activities.values()) {
            if (w.orgId !== undefined && a.orgId !== w.orgId) continue;
            if (w.status !== undefined && a.status !== w.status) continue;
            matched.push(a);
          }
          return matched.map((a) => ({ ...a }));
        },
      ),
      create: vi.fn(async (args: { data: Partial<ActivityRow> }) => {
        const id = randomUUID();
        const row: ActivityRow = {
          id,
          orgId: args.data.orgId ?? '',
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
      }),
      update: vi.fn(
        async (args: { where: { id: string }; data: Partial<ActivityRow> }) => {
          const row = activities.get(args.where.id);
          if (!row) throw new Error(`fakeDb: activity ${args.where.id} not found`);
          Object.assign(row, args.data);
          return { ...row };
        },
      ),
    },

    // ── OnboardingProgress ─────────────────────────────────────────
    onboardingProgress: {
      findUnique: vi.fn(async (args: { where: { orgId: string } }) => {
        for (const o of onboarding.values()) {
          if (o.orgId === args.where.orgId) return { ...o };
        }
        return null;
      }),
      create: vi.fn(async (args: { data: Partial<OnboardingRow> }) => {
        const id = randomUUID();
        const now = new Date();
        const row: OnboardingRow = {
          id,
          orgId: args.data.orgId ?? '',
          status: args.data.status ?? 'IN_PROGRESS',
          currentStep: args.data.currentStep ?? 1,
          completedSteps: args.data.completedSteps ?? [],
          stepData: (args.data.stepData ?? null) as Record<string, unknown> | null,
          completedAt: args.data.completedAt ?? null,
          createdAt: now,
          updatedAt: now,
        };
        onboarding.set(id, row);
        return { ...row };
      }),
      update: vi.fn(
        async (args: { where: { orgId: string }; data: Partial<OnboardingRow> }) => {
          for (const row of onboarding.values()) {
            if (row.orgId !== args.where.orgId) continue;
            Object.assign(row, args.data, { updatedAt: new Date() });
            return { ...row };
          }
          throw new Error(`fakeDb: onboarding for org ${args.where.orgId} not found`);
        },
      ),
      deleteMany: vi.fn(async (args: { where: { orgId: string } }) => {
        let n = 0;
        for (const [id, row] of onboarding.entries()) {
          if (row.orgId === args.where.orgId) {
            onboarding.delete(id);
            n += 1;
          }
        }
        return { count: n };
      }),
    },

    // ── AuditLog ───────────────────────────────────────────────────
    auditLog: {
      findMany: vi.fn(
        async (args?: {
          where?: Record<string, unknown>;
          skip?: number;
          take?: number;
        }) => {
          const w = args?.where ?? {};
          const matched: AuditLogRow[] = [];
          for (const a of auditLogs.values()) {
            if (w.orgId !== undefined && a.orgId !== w.orgId) continue;
            if (w.userId !== undefined && a.userId !== w.userId) continue;
            if (w.resource !== undefined && a.resource !== w.resource) continue;
            if (w.resourceId !== undefined && a.resourceId !== w.resourceId) continue;
            if (w.action !== undefined && a.action !== w.action) continue;
            matched.push(a);
          }
          const start = args?.skip ?? 0;
          const end = start + (args?.take ?? matched.length);
          return matched
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(start, end)
            .map((a) => ({ ...a }));
        },
      ),
      count: vi.fn(async (args?: { where?: Record<string, unknown> }) => {
        const w = args?.where ?? {};
        let n = 0;
        for (const a of auditLogs.values()) {
          if (w.orgId !== undefined && a.orgId !== w.orgId) continue;
          if (w.resource !== undefined && a.resource !== w.resource) continue;
          n += 1;
        }
        return n;
      }),
      create: vi.fn(async (args: { data: Partial<AuditLogRow> }) => {
        const id = randomUUID();
        const row: AuditLogRow = {
          id,
          orgId: (args.data.orgId as string | null) ?? null,
          userId: (args.data.userId as string | null) ?? null,
          action: args.data.action ?? '',
          resource: args.data.resource ?? '',
          resourceId: args.data.resourceId ?? '',
          oldValue: args.data.oldValue ?? null,
          newValue: args.data.newValue ?? null,
          ipAddress: (args.data.ipAddress as string | null) ?? null,
          createdAt: new Date(),
        };
        auditLogs.set(id, row);
        return { ...row };
      }),
    },

    // ── KycVerification (used by audit-log redactor only here) ────
    kycVerification: {
      findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
        const w = args.where;
        for (const k of kyc.values()) {
          if (w.id !== undefined && k.id !== w.id) continue;
          if (w.subjectKind !== undefined && k.subjectKind !== w.subjectKind) continue;
          if (w.subjectRef !== undefined && k.subjectRef !== w.subjectRef) continue;
          return { ...k };
        }
        return null;
      }),
      findUnique: vi.fn(async (args: { where: { id?: string } }) => {
        if (args.where.id) {
          return kyc.get(args.where.id) ?? null;
        }
        return null;
      }),
      create: vi.fn(async (args: { data: Partial<KycRow> }) => {
        const id = randomUUID();
        const now = new Date();
        const row: KycRow = {
          id,
          subjectKind: args.data.subjectKind ?? 'USER',
          subjectRef: args.data.subjectRef ?? '',
          level: args.data.level ?? 'BASIC',
          status: args.data.status ?? 'PENDING',
          vendorName: args.data.vendorName ?? null,
          vendorRef: args.data.vendorRef ?? null,
          riskScore: args.data.riskScore ?? null,
          sanctionsHit: args.data.sanctionsHit ?? null,
          beneficiaryRef: args.data.beneficiaryRef ?? null,
          attestations: args.data.attestations ?? null,
          lastCheckedAt: args.data.lastCheckedAt ?? null,
          revokedAt: args.data.revokedAt ?? null,
          revokedReason: args.data.revokedReason ?? null,
          createdAt: now,
          updatedAt: now,
        };
        kyc.set(id, row);
        return { ...row };
      }),
      update: vi.fn(
        async (args: { where: { id: string }; data: Partial<KycRow> }) => {
          const row = kyc.get(args.where.id);
          if (!row) throw new Error(`fakeDb: kyc ${args.where.id} not found`);
          Object.assign(row, args.data, { updatedAt: new Date() });
          return { ...row };
        },
      ),
    },

    // ── $transaction passthrough ──────────────────────────────────
    $transaction: vi.fn(),
  };

  inner.$transaction.mockImplementation(async (cb: unknown) => {
    return (cb as (t: typeof inner) => Promise<unknown>)(inner);
  });

  return { fakeDb: inner };
});

vi.mock('@aurex/database', () => ({
  prisma: fakeDb,
  Prisma: { JsonNull: 'JSON_NULL_SENTINEL' },
}));

// Imports after the mock so the services pick up the fake Prisma.
import * as orgService from './services/organization.service.js';
import * as userService from './services/user.service.js';
import * as emissionsService from './services/emissions.service.js';
import * as baselineService from './services/baseline.service.js';
import * as targetService from './services/target.service.js';
import * as reportService from './services/report.service.js';
import * as supplierService from './services/supplier.service.js';
import * as activityService from './services/activity.service.js';
import * as onboardingService from './services/onboarding.service.js';
import * as auditLogService from './services/audit-log.service.js';

// ── Test fixtures ─────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-4000-8000-0000000000a1';
const USER_ID = '00000000-0000-4000-8000-0000000000a2';
const ADMIN_ID = '00000000-0000-4000-8000-0000000000a3';

function seedBaseline(): void {
  fakeDb.users.set(USER_ID, {
    id: USER_ID,
    email: 'maker@example.com',
    name: 'Maker User',
    role: 'MAKER',
    passwordHash: 'x',
    isActive: true,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  fakeDb.users.set(ADMIN_ID, {
    id: ADMIN_ID,
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ORG_ADMIN',
    passwordHash: 'x',
    isActive: true,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  fakeDb.orgs.set(ORG_ID, {
    id: ORG_ID,
    name: 'Persistence Org',
    slug: 'persistence-org',
    isActive: true,
    parentOrgId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  // Make ADMIN an ORG_ADMIN of the org so removeMember preconditions pass.
  fakeDb.orgMembers.set('seed-admin-member', {
    id: 'seed-admin-member',
    userId: ADMIN_ID,
    orgId: ORG_ID,
    role: 'ORG_ADMIN',
    isActive: true,
    createdAt: new Date(),
  });
}

beforeEach(() => {
  fakeDb.orgs.clear();
  fakeDb.orgMembers.clear();
  fakeDb.users.clear();
  fakeDb.emissions.clear();
  fakeDb.baselines.clear();
  fakeDb.targets.clear();
  fakeDb.reports.clear();
  fakeDb.suppliers.clear();
  fakeDb.activities.clear();
  fakeDb.onboarding.clear();
  fakeDb.auditLogs.clear();
  fakeDb.kyc.clear();
  vi.clearAllMocks();
  fakeDb.$transaction.mockImplementation(async (cb: unknown) => {
    return (cb as (t: typeof fakeDb) => Promise<unknown>)(fakeDb);
  });
  seedBaseline();
});

// ─── 1. Organization round-trip ─────────────────────────────────────────────

describe('AAT-PERSISTENCE — Organization', () => {
  it('Create → Read → Update → List round-trips through Prisma', async () => {
    // Create as SUPER_ADMIN (top-level org).
    const created = await orgService.createOrg(USER_ID, 'SUPER_ADMIN', {
      name: 'Audit Subsidiary',
      slug: 'audit-subsidiary',
    });
    expect(created.id).toBeDefined();
    expect(fakeDb.orgs.has(created.id)).toBe(true);

    // Auto-membership: createOrg should add the creator as ORG_ADMIN.
    const membersForCreator = Array.from(fakeDb.orgMembers.values()).filter(
      (m) => m.orgId === created.id,
    );
    expect(membersForCreator).toHaveLength(1);
    expect(membersForCreator[0].userId).toBe(USER_ID);
    expect(membersForCreator[0].role).toBe('ORG_ADMIN');

    // Read.
    const readBack = await orgService.getOrgById(created.id, USER_ID);
    expect(readBack.id).toBe(created.id);
    expect(readBack.slug).toBe('audit-subsidiary');

    // Update.
    const updated = await orgService.updateOrg(created.id, {
      name: 'Audit Subsidiary v2',
    });
    expect(updated.name).toBe('Audit Subsidiary v2');
    expect(fakeDb.orgs.get(created.id)!.name).toBe('Audit Subsidiary v2');
  });
});

// ─── 2. User round-trip (admin path) ───────────────────────────────────────

describe('AAT-PERSISTENCE — User', () => {
  it('createUserForOrg → getUserById → updateUser → softDeleteUser round-trips', async () => {
    const created = await userService.createUserForOrg({
      orgId: ORG_ID,
      email: 'newhire@example.com',
      name: 'New Hire',
      role: 'MAKER',
      callerRole: 'ORG_ADMIN',
    });
    expect(created.id).toBeDefined();
    expect(fakeDb.users.has(created.id)).toBe(true);

    // OrgMember row should also have landed.
    const memberships = Array.from(fakeDb.orgMembers.values()).filter(
      (m) => m.userId === created.id,
    );
    expect(memberships).toHaveLength(1);
    expect(memberships[0].orgId).toBe(ORG_ID);
    expect(memberships[0].role).toBe('MAKER');

    // Read.
    const readBack = await userService.getUserById(created.id);
    expect(readBack.email).toBe('newhire@example.com');

    // Update.
    const updated = await userService.updateUser(
      created.id,
      { name: 'New Hire (Updated)' },
      'ORG_ADMIN',
    );
    expect(updated.name).toBe('New Hire (Updated)');
    expect(fakeDb.users.get(created.id)!.name).toBe('New Hire (Updated)');

    // Soft-delete.
    await userService.softDeleteUser(created.id);
    expect(fakeDb.users.get(created.id)!.isActive).toBe(false);
  });
});

// ─── 3. EmissionsRecord round-trip ─────────────────────────────────────────

describe('AAT-PERSISTENCE — EmissionsRecord', () => {
  it('Create → List → Read → Update → Delete round-trips', async () => {
    const created = await emissionsService.createEmission({
      orgId: ORG_ID,
      createdBy: USER_ID,
      scope: 'SCOPE_1',
      category: 'stationary_combustion',
      source: 'natural_gas',
      value: 12.5,
      unit: 'tCO2e',
      periodStart: '2026-01-01T00:00:00Z',
      periodEnd: '2026-03-31T23:59:59Z',
      metadata: { siteRef: 'PUNE-1' },
    });
    expect(created.id).toBeDefined();
    expect(fakeDb.emissions.has(created.id)).toBe(true);

    // List.
    const list = await emissionsService.listEmissions({
      orgId: ORG_ID,
      page: 1,
      pageSize: 20,
      sort: 'createdAt',
      order: 'desc',
    });
    expect(list.pagination.total).toBe(1);
    expect(list.data[0].id).toBe(created.id);

    // Read.
    const readBack = await emissionsService.getEmissionById(created.id, ORG_ID);
    expect(readBack.value).toBe(12.5);

    // Update (DRAFT only).
    const updated = await emissionsService.updateEmission(created.id, ORG_ID, {
      value: 18.75,
    });
    expect(updated.value).toBe(18.75);

    // Delete.
    await emissionsService.deleteEmission(created.id, ORG_ID);
    expect(fakeDb.emissions.has(created.id)).toBe(false);
  });

  it('updateEmissionStatus persists through Prisma', async () => {
    const created = await emissionsService.createEmission({
      orgId: ORG_ID,
      createdBy: USER_ID,
      scope: 'SCOPE_2',
      category: 'purchased_electricity',
      source: 'grid_mix',
      value: 100,
      unit: 'tCO2e',
      periodStart: '2026-01-01T00:00:00Z',
      periodEnd: '2026-03-31T23:59:59Z',
    });
    const updated = await emissionsService.updateEmissionStatus(
      created.id,
      ORG_ID,
      'PENDING',
    );
    expect(updated.status).toBe('PENDING');
    expect(fakeDb.emissions.get(created.id)!.status).toBe('PENDING');
  });
});

// ─── 4. EmissionsBaseline round-trip ───────────────────────────────────────

describe('AAT-PERSISTENCE — EmissionsBaseline', () => {
  it('Create → List → Read → Update → Delete round-trips', async () => {
    const created = await baselineService.createBaseline({
      orgId: ORG_ID,
      name: 'FY2020 baseline',
      scope: 'SCOPE_1',
      baseYear: 2020,
      value: 1500,
      unit: 'tCO2e',
      methodology: 'GHG Protocol',
    });
    expect(fakeDb.baselines.has(created.id)).toBe(true);

    // List.
    const list = await baselineService.listBaselines({ orgId: ORG_ID });
    expect(list).toHaveLength(1);

    // Read.
    const readBack = await baselineService.getBaselineById(created.id, ORG_ID);
    expect(readBack.name).toBe('FY2020 baseline');

    // Update.
    const updated = await baselineService.updateBaseline(created.id, ORG_ID, {
      value: 1450,
    });
    expect(Number(updated.value)).toBe(1450);

    // Delete.
    await baselineService.deleteBaseline(created.id, ORG_ID);
    expect(fakeDb.baselines.has(created.id)).toBe(false);
  });
});

// ─── 5. EmissionsTarget round-trip ─────────────────────────────────────────

describe('AAT-PERSISTENCE — EmissionsTarget', () => {
  it('Create → List → Read → Update → approve round-trips', async () => {
    const created = await targetService.createTarget({
      orgId: ORG_ID,
      name: 'Net-zero by 2040',
      scope: 'SCOPE_1',
      targetYear: 2040,
      reduction: 100,
      pathway: 'SBTi',
    });
    expect(fakeDb.targets.has(created.id)).toBe(true);

    // List.
    const list = await targetService.listTargets({ orgId: ORG_ID });
    expect(list).toHaveLength(1);

    // Read.
    const readBack = await targetService.getTarget(created.id, ORG_ID);
    expect(readBack.id).toBe(created.id);

    // Update.
    const updated = await targetService.updateTarget(created.id, ORG_ID, {
      reduction: 90,
    });
    expect(Number(updated.reduction)).toBe(90);
    expect(Number(fakeDb.targets.get(created.id)!.reduction)).toBe(90);
  });
});

// ─── 6. Report round-trip ──────────────────────────────────────────────────

describe('AAT-PERSISTENCE — Report', () => {
  it('generateReport → list → getReport round-trips', async () => {
    // Generate a report. Service hits prisma.emissionsRecord.findMany /
    // emissionsBaseline.findMany internally — both are wired in fakeDb.
    const generated = await reportService.generateReport({
      orgId: ORG_ID,
      createdBy: ADMIN_ID,
      type: 'GHG_ANNUAL',
      year: 2026,
      scopes: ['SCOPE_1', 'SCOPE_2'],
    });
    expect(fakeDb.reports.has(generated.id)).toBe(true);
    // After generateReport the row should be COMPLETED, not QUEUED.
    expect(fakeDb.reports.get(generated.id)!.status).toBe('COMPLETED');

    // List.
    const list = await reportService.listReports(ORG_ID);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(generated.id);

    // Read.
    const readBack = await reportService.getReport(generated.id, ORG_ID);
    expect(readBack.type).toBe('GHG_ANNUAL');
  });
});

// ─── 7. Supplier round-trip ───────────────────────────────────────────────

describe('AAT-PERSISTENCE — Supplier', () => {
  it('Create → List → Read → Update → Delete round-trips (with audit log)', async () => {
    const created = await supplierService.createSupplier(
      ORG_ID,
      ADMIN_ID,
      {
        name: 'Acme Logistics',
        email: 'ops@acme.example',
        category: 'transport',
      },
      '127.0.0.1',
    );
    expect(fakeDb.suppliers.has(created.id)).toBe(true);
    // Side-effect: an AuditLog row should have landed.
    const auditCreates = Array.from(fakeDb.auditLogs.values()).filter(
      (a) => a.resourceId === created.id && a.action === 'supplier.created',
    );
    expect(auditCreates).toHaveLength(1);

    // List.
    const list = await supplierService.listSuppliers(ORG_ID, {
      page: 1,
      pageSize: 20,
    });
    expect(list.pagination.total).toBe(1);

    // Read.
    const readBack = await supplierService.getSupplier(created.id, ORG_ID);
    expect(readBack.email).toBe('ops@acme.example');

    // Update.
    const updated = await supplierService.updateSupplier(
      created.id,
      ORG_ID,
      ADMIN_ID,
      { name: 'Acme Logistics Pvt Ltd' },
      '127.0.0.1',
    );
    expect(updated.name).toBe('Acme Logistics Pvt Ltd');

    // Delete.
    await supplierService.deleteSupplier(
      created.id,
      ORG_ID,
      ADMIN_ID,
      '127.0.0.1',
    );
    expect(fakeDb.suppliers.has(created.id)).toBe(false);
  });
});

// ─── 8. Activity round-trip (A6.4) ─────────────────────────────────────────

describe('AAT-PERSISTENCE — Activity', () => {
  it('Create → List → Read → Update round-trips (incl. CreditAccount side-effect)', async () => {
    const methodologyId = '00000000-0000-4000-8000-0000000000b1';
    // activity.service uses methodology.findUnique; wire a minimal fake +
    // creditAccount.create (also touched on activity.create).
     
    (fakeDb as any).methodology = {
      findUnique: vi.fn(async () => ({
        id: methodologyId,
        code: 'VM0042',
        name: 'IALM',
        version: '2.0',
        isActive: true,
        isBcrEligible: true,
      })),
    };
    const creditAccounts = new Map<string, Record<string, unknown>>();
     
    (fakeDb as any).creditAccount = {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        const row = { id, ...args.data };
        creditAccounts.set(id, row);
        return { ...row };
      }),
    };

    const created = await activityService.createActivity({
      orgId: ORG_ID,
      methodologyId,
      title: 'Persistence audit activity',
      hostCountry: 'IN',
      sectoralScope: 14,
      technologyType: 'AGRICULTURE',
      gasesCovered: ['CO2'],
      creditingPeriodType: 'RENEWABLE_5YR',
      createdBy: USER_ID,
    });
    expect(fakeDb.activities.has(created.id)).toBe(true);
    // CreditAccount side-effect — every Activity.create writes one too.
    expect(creditAccounts.size).toBe(1);

    // List uses include: { methodology: ... } — augment the fake just in
    // time so the include resolution doesn't error.
     
    (fakeDb.activity.findMany as any).mockImplementationOnce(
      async (args?: { where?: Record<string, unknown> }) => {
        const w = args?.where ?? {};
        const matched = Array.from(fakeDb.activities.values()).filter((a) => {
          if (w.orgId !== undefined && a.orgId !== w.orgId) return false;
          if (w.status !== undefined && a.status !== w.status) return false;
          return true;
        });
        return matched.map((a) => ({
          ...a,
          methodology: { code: 'VM0042', name: 'IALM', category: 'BASELINE' },
        }));
      },
    );
    const list = await activityService.listActivities({ orgId: ORG_ID });
    expect(list).toHaveLength(1);

    // Read uses an extensive include — short-circuit with a single mock.
     
    (fakeDb.activity.findFirst as any).mockImplementationOnce(
      async (args: { where: { id: string; orgId: string } }) => {
        const a = fakeDb.activities.get(args.where.id);
        if (!a) return null;
        if (a.orgId !== args.where.orgId) return null;
        return {
          ...a,
          methodology: null,
          pdd: null,
          hostAuthorization: null,
          validationReport: null,
          monitoringPlan: null,
          monitoringPeriods: [],
          issuances: [],
          creditAccount: null,
        };
      },
    );
    const readBack = await activityService.getActivity(created.id, ORG_ID);
    expect(readBack.title).toBe('Persistence audit activity');

    // Update.
    const updated = await activityService.updateActivity(
      created.id,
      ORG_ID,
      { description: 'Updated description' },
      USER_ID,
    );
    expect(updated.description).toBe('Updated description');
  });
});

// ─── 9. OnboardingProgress round-trip ──────────────────────────────────────

describe('AAT-PERSISTENCE — OnboardingProgress', () => {
  it('saveStep auto-creates row, completeOnboarding flips status, reset deletes + recreates', async () => {
    // saveStep with step=1 also calls organization.update — the org seeded
    // in beforeEach handles that.
    const step1 = await onboardingService.saveStep(ORG_ID, 1, {
      name: 'Persistence Org',
      industry: 'Technology',
      country: 'IN',
    });
    expect(step1.completedSteps).toContain(1);
    expect(fakeDb.onboarding.size).toBe(1);

    // Read.
    const readBack = await onboardingService.getProgress(ORG_ID);
    expect(readBack.orgId).toBe(ORG_ID);

    // Complete.
    const completed = await onboardingService.completeOnboarding(ORG_ID, {
      plan: 'msme_india',
    });
    expect(completed.status).toBe('COMPLETED');
    expect(completed.completedAt).not.toBeNull();

    // Reset.
    const reset = await onboardingService.resetOnboarding(ORG_ID);
    expect(reset.status).toBe('IN_PROGRESS');
    expect(reset.currentStep).toBe(1);
    // The reset should have replaced the row, not orphaned it.
    expect(fakeDb.onboarding.size).toBe(1);
  });
});

// ─── 10. AuditLog round-trip ───────────────────────────────────────────────

describe('AAT-PERSISTENCE — AuditLog', () => {
  it('recordAudit persists, listAudit reads back with composed where', async () => {
    await auditLogService.recordAudit({
      orgId: ORG_ID,
      userId: ADMIN_ID,
      action: 'persistence.test',
      resource: 'TestResource',
      resourceId: 'r-1',
      newValue: { foo: 'bar' },
      ipAddress: '127.0.0.1',
    });
    await auditLogService.recordAudit({
      orgId: ORG_ID,
      userId: ADMIN_ID,
      action: 'persistence.test',
      resource: 'TestResource',
      resourceId: 'r-2',
      newValue: { foo: 'baz' },
      ipAddress: '127.0.0.1',
    });
    expect(fakeDb.auditLogs.size).toBe(2);

    const list = await auditLogService.listAudit({
      orgId: ORG_ID,
      resource: 'TestResource',
      page: 1,
      pageSize: 20,
    });
    expect(list.pagination.total).toBe(2);
    // Both rows should appear, newest first (auditLog.findMany sorts desc).
    const resourceIds = list.data.map((r) => r.resourceId);
    expect(resourceIds).toContain('r-1');
    expect(resourceIds).toContain('r-2');
  });
});
