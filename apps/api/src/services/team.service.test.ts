/**
 * team.service tests — drives the prisma mock the same hoist pattern
 * as auth.service.test.ts. Covers list/get/create/update/delete +
 * add/remove member + the validation gates that protect against
 * cross-org leaks and non-member additions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, P2002 } = vi.hoisted(() => {
  // Mock Prisma "known request error" for unique-constraint paths.
  class FakeP2002 extends Error {
    code = 'P2002';
    constructor() {
      super('Unique constraint failed');
    }
  }
  const mock = {
    team: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    teamMember: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    orgMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return { mockPrisma: mock, P2002: FakeP2002 };
});

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
  Prisma: {
    PrismaClientKnownRequestError: P2002,
  },
}));

import {
  listTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  addMember,
  removeMember,
} from './team.service.js';

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const OWNER = 'user-owner';
const MEMBER = 'user-member';
const OUTSIDER = 'user-outsider';
const TEAM = 'team-1';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // sanity
});

function teamRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TEAM,
    orgId: ORG_A,
    name: 'Sustainability Office',
    description: null,
    ownerId: OWNER,
    defaultRole: 'VIEWER',
    status: 'ACTIVE',
    createdAt: new Date('2026-05-03T00:00:00Z'),
    updatedAt: new Date('2026-05-03T00:00:00Z'),
    owner: { id: OWNER, name: 'Nina Rao' },
    _count: { members: 3 },
    ...overrides,
  };
}

describe('listTeams', () => {
  it('returns teams scoped to the requested org with shape suitable for the dashboard', async () => {
    mockPrisma.team.findMany.mockResolvedValue([
      teamRow(),
      teamRow({ id: 'team-2', name: 'Plant Operations - North', _count: { members: 12 } }),
    ]);

    const teams = await listTeams(ORG_A);

    expect(teams).toHaveLength(2);
    expect(teams[0]).toMatchObject({
      id: TEAM,
      name: 'Sustainability Office',
      ownerId: OWNER,
      ownerName: 'Nina Rao',
      defaultRole: 'viewer',
      status: 'ACTIVE',
      memberCount: 3,
    });
    // The findMany was scoped strictly to the requested orgId — never
    // any chance of leaking across tenants.
    const findArgs = mockPrisma.team.findMany.mock.calls[0]![0] as { where: { orgId: string } };
    expect(findArgs.where.orgId).toBe(ORG_A);
  });
});

describe('getTeam', () => {
  it('throws 404 when the team is not in the requested org', async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);
    await expect(getTeam(TEAM, ORG_B)).rejects.toThrow(/not found/i);
  });

  it('returns full detail with members when scoped correctly', async () => {
    mockPrisma.team.findFirst.mockResolvedValue({
      ...teamRow(),
      members: [
        {
          id: 'tm-1',
          user: { id: OWNER, email: 'owner@example.com', name: 'Nina Rao' },
          addedAt: new Date('2026-05-03T00:00:01Z'),
        },
        {
          id: 'tm-2',
          user: { id: MEMBER, email: 'member@example.com', name: 'Arjun Patel' },
          addedAt: new Date('2026-05-03T00:00:02Z'),
        },
      ],
    });

    const detail = await getTeam(TEAM, ORG_A);
    expect(detail.id).toBe(TEAM);
    expect(detail.members).toHaveLength(2);
    expect(detail.members[0]!.userEmail).toBe('owner@example.com');
  });
});

describe('createTeam', () => {
  it('rejects empty names with 400', async () => {
    await expect(createTeam(ORG_A, OWNER, { name: '   ' })).rejects.toThrow(/required/i);
  });

  it('rejects when the named owner is not an active member of the org', async () => {
    mockPrisma.orgMember.findFirst.mockResolvedValue(null); // no membership
    await expect(
      createTeam(ORG_A, OWNER, { name: 'Sustainability Office' }),
    ).rejects.toThrow(/active member/i);
    expect(mockPrisma.team.create).not.toHaveBeenCalled();
  });

  it('rejects when an initial member is not in the org', async () => {
    mockPrisma.orgMember.findFirst.mockResolvedValue({ userId: OWNER });
    mockPrisma.orgMember.findMany.mockResolvedValue([{ userId: MEMBER }]); // OUTSIDER missing
    await expect(
      createTeam(ORG_A, OWNER, {
        name: 'Sustainability Office',
        memberUserIds: [MEMBER, OUTSIDER],
      }),
    ).rejects.toThrow(/non-members/i);
    expect(mockPrisma.team.create).not.toHaveBeenCalled();
  });

  it('creates with owner auto-added as a member; defaults to viewer / ACTIVE', async () => {
    mockPrisma.orgMember.findFirst.mockResolvedValue({ userId: OWNER });
    mockPrisma.team.create.mockResolvedValue({ ...teamRow(), _count: { members: 1 } });

    const result = await createTeam(ORG_A, OWNER, { name: 'Sustainability Office' });

    expect(result.defaultRole).toBe('viewer');
    expect(result.status).toBe('ACTIVE');
    expect(mockPrisma.team.create).toHaveBeenCalledTimes(1);
    const args = mockPrisma.team.create.mock.calls[0]![0] as {
      data: {
        orgId: string;
        ownerId: string;
        name: string;
        defaultRole: string;
        status: string;
        members: { create: Array<{ userId: string }> };
      };
    };
    expect(args.data.orgId).toBe(ORG_A);
    expect(args.data.ownerId).toBe(OWNER);
    expect(args.data.defaultRole).toBe('VIEWER');
    expect(args.data.status).toBe('ACTIVE');
    // Owner auto-added as the first team member.
    expect(args.data.members.create.map((m) => m.userId)).toEqual([OWNER]);
  });

  it('translates Prisma P2002 (unique-constraint) into a 409', async () => {
    mockPrisma.orgMember.findFirst.mockResolvedValue({ userId: OWNER });
    mockPrisma.team.create.mockRejectedValue(new P2002());
    await expect(
      createTeam(ORG_A, OWNER, { name: 'Sustainability Office' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('updateTeam', () => {
  it('404 when team is in a different org', async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);
    await expect(updateTeam(TEAM, ORG_B, { name: 'Renamed' })).rejects.toThrow(/not found/i);
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });

  it('only sets the fields that were provided', async () => {
    mockPrisma.team.findFirst.mockResolvedValue({ id: TEAM });
    mockPrisma.team.update.mockResolvedValue({
      ...teamRow({ name: 'Renamed', status: 'IN_REVIEW' }),
    });

    await updateTeam(TEAM, ORG_A, { name: 'Renamed', status: 'IN_REVIEW' });

    const args = mockPrisma.team.update.mock.calls[0]![0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(args.where.id).toBe(TEAM);
    expect(args.data.name).toBe('Renamed');
    expect(args.data.status).toBe('IN_REVIEW');
    expect('description' in args.data).toBe(false); // not touched
    expect('defaultRole' in args.data).toBe(false);
  });
});

describe('deleteTeam', () => {
  it('404 when not in this org; success otherwise', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    await expect(deleteTeam(TEAM, ORG_A)).rejects.toThrow(/not found/i);

    mockPrisma.team.findFirst.mockResolvedValueOnce({ id: TEAM });
    mockPrisma.team.delete.mockResolvedValue({});
    await expect(deleteTeam(TEAM, ORG_A)).resolves.toBeUndefined();
    expect(mockPrisma.team.delete).toHaveBeenCalledWith({ where: { id: TEAM } });
  });
});

describe('addMember + removeMember', () => {
  it('addMember refuses non-org-members with 400', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce({ id: TEAM });
    mockPrisma.orgMember.findFirst.mockResolvedValue(null); // outsider not in org
    await expect(addMember(TEAM, ORG_A, OUTSIDER)).rejects.toThrow(/active member/i);
    expect(mockPrisma.teamMember.create).not.toHaveBeenCalled();
  });

  it('addMember is idempotent on P2002 (already on the team)', async () => {
    // First findFirst inside addMember
    mockPrisma.team.findFirst.mockResolvedValueOnce({ id: TEAM });
    mockPrisma.orgMember.findFirst.mockResolvedValueOnce({ userId: MEMBER });
    mockPrisma.teamMember.create.mockRejectedValue(new P2002());
    // Subsequent getTeam call (refresh)
    mockPrisma.team.findFirst.mockResolvedValueOnce({
      ...teamRow(),
      members: [
        {
          id: 'tm-x',
          user: { id: MEMBER, email: 'm@example.com', name: 'M' },
          addedAt: new Date(),
        },
      ],
    });

    const result = await addMember(TEAM, ORG_A, MEMBER);
    expect(result.id).toBe(TEAM);
    expect(result.members.some((m) => m.userId === MEMBER)).toBe(true);
  });

  it('removeMember refuses to remove the team owner', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce({ id: TEAM, ownerId: OWNER });
    await expect(removeMember(TEAM, ORG_A, OWNER)).rejects.toThrow(/owner/i);
    expect(mockPrisma.teamMember.deleteMany).not.toHaveBeenCalled();
  });
});
