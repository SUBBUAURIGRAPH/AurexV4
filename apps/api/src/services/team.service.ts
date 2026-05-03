/**
 * Team service — named subgroups within an Organization.
 *
 * A Team is a soft grouping of org members with a default role + status.
 * Backs the /teams dashboard page ("Sustainability Office", "Plant
 * Operations - North", etc.). Teams do NOT replace OrgMember role
 * gates — being in a team grants no org-level permissions on its own.
 *
 * Org scoping: every operation takes orgId from req.orgId (set by
 * requireOrgScope middleware which honors x-org-id per ADM-075). Teams
 * are isolated per org — listTeams in org A never returns teams from
 * org B even when called by a SUPER_ADMIN.
 *
 * Role gating (enforced in the route layer via requireOrgRole):
 *   list/get               : any active member of the org
 *   create/update/delete   : ORG_ADMIN, SUPER_ADMIN
 *   add/remove member      : ORG_ADMIN, SUPER_ADMIN
 */
import { prisma } from '@aurex/database';
import { Prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';

type TeamStatus = 'ACTIVE' | 'IN_REVIEW' | 'ARCHIVED';

export interface TeamSummary {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  ownerName: string;
  defaultRole: string;
  status: TeamStatus;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamDetail extends TeamSummary {
  members: Array<{
    id: string;
    userId: string;
    userEmail: string;
    userName: string;
    addedAt: Date;
  }>;
}

export interface CreateTeamInput {
  name: string;
  description?: string | null;
  defaultRole?: string;
  status?: TeamStatus;
  /** Initial member user-ids (must already be active org members). */
  memberUserIds?: string[];
}

export interface UpdateTeamInput {
  name?: string;
  description?: string | null;
  defaultRole?: string;
  status?: TeamStatus;
}

function toRoleLower(role: string): string {
  return role.toLowerCase();
}

function toStatusUpper(status: string | null | undefined): TeamStatus {
  const s = (status ?? 'ACTIVE').toString().toUpperCase();
  if (s === 'ACTIVE' || s === 'IN_REVIEW' || s === 'ARCHIVED') return s;
  return 'ACTIVE';
}

/** List every team in the org with member-count + owner display name. */
export async function listTeams(orgId: string): Promise<TeamSummary[]> {
  const rows = await prisma.team.findMany({
    where: { orgId },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    ownerId: t.owner.id,
    ownerName: t.owner.name,
    defaultRole: toRoleLower(t.defaultRole as unknown as string),
    status: toStatusUpper(t.status as unknown as string),
    memberCount: t._count.members,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
}

/** Full team detail with member list. */
export async function getTeam(teamId: string, orgId: string): Promise<TeamDetail> {
  const t = await prisma.team.findFirst({
    where: { id: teamId, orgId },
    include: {
      owner: { select: { id: true, name: true } },
      members: {
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { addedAt: 'asc' },
      },
      _count: { select: { members: true } },
    },
  });
  if (!t) throw new AppError(404, 'Not Found', 'Team not found');
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    ownerId: t.owner.id,
    ownerName: t.owner.name,
    defaultRole: toRoleLower(t.defaultRole as unknown as string),
    status: toStatusUpper(t.status as unknown as string),
    memberCount: t._count.members,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    members: t.members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      userEmail: m.user.email,
      userName: m.user.name,
      addedAt: m.addedAt,
    })),
  };
}

export async function createTeam(
  orgId: string,
  ownerUserId: string,
  input: CreateTeamInput,
): Promise<TeamSummary> {
  const name = input.name?.trim();
  if (!name) throw new AppError(400, 'Bad Request', 'Team name is required');

  // Validate owner is an active member of this org. (The route already
  // requires the caller to be ORG_ADMIN+, so this is belt-and-braces.)
  const ownerMember = await prisma.orgMember.findFirst({
    where: { userId: ownerUserId, orgId, isActive: true },
    select: { userId: true },
  });
  if (!ownerMember) {
    throw new AppError(
      403,
      'Forbidden',
      'Team owner must be an active member of the organisation',
    );
  }

  // Validate any initial members are also active org members.
  const memberUserIds = Array.from(new Set(input.memberUserIds ?? [])).filter(
    (id) => id !== ownerUserId,
  );
  if (memberUserIds.length > 0) {
    const valid = await prisma.orgMember.findMany({
      where: { orgId, userId: { in: memberUserIds }, isActive: true },
      select: { userId: true },
    });
    const validIds = new Set(valid.map((v) => v.userId));
    const missing = memberUserIds.filter((id) => !validIds.has(id));
    if (missing.length > 0) {
      throw new AppError(
        400,
        'Bad Request',
        `Cannot add non-members: ${missing.join(', ')}`,
      );
    }
  }

  const defaultRole = (input.defaultRole ?? 'viewer').toUpperCase();
  const status = toStatusUpper(input.status);

  try {
    const created = await prisma.team.create({
      data: {
        orgId,
        ownerId: ownerUserId,
        name,
        description: input.description ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        defaultRole: defaultRole as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: status as any,
        members: {
          create: [
            { userId: ownerUserId },
            ...memberUserIds.map((uid) => ({ userId: uid })),
          ],
        },
      },
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });
    return {
      id: created.id,
      name: created.name,
      description: created.description,
      ownerId: created.owner.id,
      ownerName: created.owner.name,
      defaultRole: toRoleLower(created.defaultRole as unknown as string),
      status: toStatusUpper(created.status as unknown as string),
      memberCount: created._count.members,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'Conflict', 'A team with this name already exists in this organisation');
    }
    throw err;
  }
}

export async function updateTeam(
  teamId: string,
  orgId: string,
  input: UpdateTeamInput,
): Promise<TeamSummary> {
  // Confirm team exists in this org first (404 instead of leaking a P2025).
  const existing = await prisma.team.findFirst({
    where: { id: teamId, orgId },
    select: { id: true },
  });
  if (!existing) throw new AppError(404, 'Not Found', 'Team not found');

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new AppError(400, 'Bad Request', 'Team name cannot be empty');
    data.name = trimmed;
  }
  if (input.description !== undefined) data.description = input.description;
  if (input.defaultRole !== undefined) data.defaultRole = input.defaultRole.toUpperCase();
  if (input.status !== undefined) data.status = toStatusUpper(input.status);

  try {
    const updated = await prisma.team.update({
      where: { id: teamId },
      data,
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });
    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      ownerId: updated.owner.id,
      ownerName: updated.owner.name,
      defaultRole: toRoleLower(updated.defaultRole as unknown as string),
      status: toStatusUpper(updated.status as unknown as string),
      memberCount: updated._count.members,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'Conflict', 'A team with this name already exists in this organisation');
    }
    throw err;
  }
}

export async function deleteTeam(teamId: string, orgId: string): Promise<void> {
  const existing = await prisma.team.findFirst({
    where: { id: teamId, orgId },
    select: { id: true },
  });
  if (!existing) throw new AppError(404, 'Not Found', 'Team not found');
  await prisma.team.delete({ where: { id: teamId } });
}

export async function addMember(
  teamId: string,
  orgId: string,
  userId: string,
): Promise<TeamDetail> {
  const team = await prisma.team.findFirst({
    where: { id: teamId, orgId },
    select: { id: true },
  });
  if (!team) throw new AppError(404, 'Not Found', 'Team not found');

  // Member must be an active org member of the same org.
  const orgMember = await prisma.orgMember.findFirst({
    where: { orgId, userId, isActive: true },
    select: { userId: true },
  });
  if (!orgMember) {
    throw new AppError(400, 'Bad Request', 'User is not an active member of this organisation');
  }

  try {
    await prisma.teamMember.create({ data: { teamId, userId } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Idempotent: already on the team — return the current detail.
      return getTeam(teamId, orgId);
    }
    throw err;
  }
  return getTeam(teamId, orgId);
}

export async function removeMember(
  teamId: string,
  orgId: string,
  userId: string,
): Promise<TeamDetail> {
  const team = await prisma.team.findFirst({
    where: { id: teamId, orgId },
    select: { id: true, ownerId: true },
  });
  if (!team) throw new AppError(404, 'Not Found', 'Team not found');
  if (team.ownerId === userId) {
    throw new AppError(
      409,
      'Conflict',
      "Cannot remove the team owner. Transfer ownership or delete the team first.",
    );
  }
  await prisma.teamMember.deleteMany({ where: { teamId, userId } });
  return getTeam(teamId, orgId);
}
