/**
 * AV4-208: In-process stand-in for @aurex/database.
 *
 * Implements enough of the Prisma client surface to exercise authenticated
 * flows end-to-end in vitest. Tables are in-memory arrays, and findMany /
 * findUnique / findFirst do shallow equality matching on the `where` clause.
 *
 * Not a full Prisma clone — nested relations, complex filters, and joins
 * that aren't needed by the tests return sensible empty defaults. When a
 * new test case needs richer behaviour, extend the relevant table method.
 */

export const TEST_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
export const TEST_ORG_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
export const TEST_USER_EMAIL = 'test@aurex.in';

type Row = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function matches(row: any, where: any): boolean {
  if (!where || typeof where !== 'object') return true;
  for (const key of Object.keys(where)) {
    const expected = where[key];
    if (expected === undefined) continue;
    // Handle nested filters like { org: { isActive: true } } — collapse to true.
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      continue;
    }
    if (row[key] !== expected) return false;
  }
  return true;
}

function makeTable<T extends Row>(initial: T[] = []) {
  const rows: T[] = [...initial];
  return {
    rows,
    findUnique: async ({ where }: { where: Row }) => rows.find((r) => matches(r, where)) ?? null,
    findFirst: async (args?: { where?: Row }) => rows.find((r) => matches(r, args?.where ?? {})) ?? null,
    findMany: async (args?: { where?: Row; take?: number; skip?: number }) => {
      const filtered = rows.filter((r) => matches(r, args?.where ?? {}));
      const skip = args?.skip ?? 0;
      const take = args?.take ?? filtered.length;
      return filtered.slice(skip, skip + take);
    },
    count: async (args?: { where?: Row }) =>
      rows.filter((r) => matches(r, args?.where ?? {})).length,
    create: async ({ data }: { data: T }) => {
      const row = { id: data.id ?? `row-${rows.length + 1}`, ...data } as T;
      rows.push(row);
      return row;
    },
    createMany: async ({ data }: { data: T[] }) => {
      for (const d of data) rows.push({ id: `row-${rows.length + 1}`, ...d } as T);
      return { count: data.length };
    },
    update: async ({ where, data }: { where: Row; data: Partial<T> }) => {
      const row = rows.find((r) => matches(r, where));
      if (row) Object.assign(row, data);
      return row ?? {};
    },
    updateMany: async ({ where, data }: { where: Row; data: Partial<T> }) => {
      let count = 0;
      for (const r of rows) {
        if (matches(r, where)) {
          Object.assign(r, data);
          count += 1;
        }
      }
      return { count };
    },
    upsert: async ({ where, create, update }: { where: Row; create: T; update: Partial<T> }) => {
      const existing = rows.find((r) => matches(r, where));
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const row = { id: `row-${rows.length + 1}`, ...create } as T;
      rows.push(row);
      return row;
    },
    delete: async ({ where }: { where: Row }) => {
      const idx = rows.findIndex((r) => matches(r, where));
      if (idx >= 0) return rows.splice(idx, 1)[0] ?? {};
      return {};
    },
    deleteMany: async ({ where }: { where?: Row } = {}) => {
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (matches(rows[i], where ?? {})) {
          rows.splice(i, 1);
          count += 1;
        }
      }
      return { count };
    },
  };
}

const user = makeTable<Row>([
  {
    id: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    name: 'Test User',
    role: 'ORG_ADMIN',
    passwordHash: '$2b$12$invalid-hash-login-disabled-in-test',
    isActive: true,
    isVerified: true,
    failedAttempts: 0,
    lockedUntil: null,
    mfaEnabled: false,
  },
]);

const organization = makeTable<Row>([
  {
    id: TEST_ORG_ID,
    name: 'Test Org',
    slug: 'test-org',
    isActive: true,
    parentOrgId: null,
  },
]);

const orgMember = makeTable<Row>([
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    userId: TEST_USER_ID,
    orgId: TEST_ORG_ID,
    role: 'ORG_ADMIN',
    isActive: true,
    createdAt: new Date('2025-01-01'),
  },
]);

export const prisma = {
  user,
  organization,
  orgMember,
  session: makeTable<Row>(),
  authEvent: makeTable<Row>(),
  emissionsRecord: makeTable<Row>(),
  emissionsBaseline: makeTable<Row>(),
  emissionsTarget: makeTable<Row>(),
  targetProgress: makeTable<Row>(),
  report: makeTable<Row>(),
  importJob: makeTable<Row>(),
  auditLog: makeTable<Row>(),
  notification: makeTable<Row>(),
  notificationPreference: makeTable<Row>(),
  approvalRequest: makeTable<Row>(),
  approvalComment: makeTable<Row>(),
  approvalVote: makeTable<Row>(),
  workflowRecipe: makeTable<Row>(),
  orgWorkflowEnablement: makeTable<Row>(),
  esgFramework: makeTable<Row>(),
  esgIndicator: makeTable<Row>(),
  orgFrameworkMapping: makeTable<Row>(),
  brsrPrinciple: makeTable<Row>(),
  brsrIndicator: makeTable<Row>(),
  brsrResponse: makeTable<Row>(),
  onboardingProgress: makeTable<Row>(),
  emissionSource: makeTable<Row>(),
  emissionFactor: makeTable<Row>(),
  $queryRaw: async () => [{ '?column?': 1 }],
  $queryRawUnsafe: async () => [],
  $disconnect: async () => undefined,
};
