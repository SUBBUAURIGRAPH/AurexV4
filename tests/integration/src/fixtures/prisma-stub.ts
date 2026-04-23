/**
 * AV4-295: In-process stand-in for @aurex/database.
 * Keeps the surface used by apps/api/src/** code paths exercised by the
 * current integration tests. Any method not listed here should be added
 * the moment a new route is covered by the harness.
 *
 * Contract:
 *   - findUnique -> null  (auth service treats this as "no such user" -> 401)
 *   - update/create/deleteMany -> {} (mutations are no-ops, never reached
 *     in the current tests — login fails at the findUnique check)
 *   - $queryRaw -> [{ '?column?': 1 }] (health /ready probe compatibility)
 */

type Noop = (...args: unknown[]) => Promise<unknown>;

const nullFn: Noop = async () => null;
const emptyFn: Noop = async () => ({});

export const prisma = {
  user: { findUnique: nullFn, update: emptyFn, create: emptyFn },
  session: {
    findUnique: nullFn,
    create: emptyFn,
    update: emptyFn,
    deleteMany: emptyFn,
  },
  authEvent: { create: emptyFn },
  orgMember: { findUnique: nullFn, create: emptyFn, update: emptyFn },
  organization: { findUnique: nullFn, create: emptyFn },
  $queryRaw: async () => [{ '?column?': 1 }],
  $disconnect: async () => undefined,
};
