import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma } from '@aurex/database';
import type { PaginatedResponse } from '@aurex/shared';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';

const SALT_ROUNDS = 12;

export interface UserResult {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ADM-301: workflow roles (MAKER/CHECKER/APPROVER/AUDITOR) sit between ANALYST
// and MANAGER in privilege. Any org member can be escalated to a workflow role;
// only ORG_ADMIN+ can assign ORG_ADMIN or SUPER_ADMIN.
// Missing entries here caused "Cannot assign a role higher than your own" (403)
// when an ORG_ADMIN tried to invite a user as MAKER/CHECKER/APPROVER/AUDITOR
// — the user was never created, surfacing as "can't log in."
const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  SB_OBSERVER: 0, // A6.4: read-only registry view (lowest privilege)
  ANALYST: 1,
  MAKER: 1,
  CHECKER: 2,
  AUDITOR: 2,
  APPROVER: 2,
  MANAGER: 2,
  DOE: 2,         // A6.4: Designated Operational Entity (validator/verifier)
  DNA: 3,         // A6.4: Designated National Authority (host-country gov)
  ORG_ADMIN: 3,
  SUPER_ADMIN: 4,
};

export interface ListUsersParams {
  orgId: string;
  search?: string;
  role?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
  sort: string;
  order: 'asc' | 'desc';
}

export async function listUsers(params: ListUsersParams): Promise<PaginatedResponse<UserResult>> {
  const { orgId, search, role, isActive, page, pageSize, sort, order } = params;
  const skip = (page - 1) * pageSize;

  // Get user IDs in the org
  const memberFilter: Record<string, unknown> = {
    orgId,
    isActive: true,
  };

  const where: Record<string, unknown> = {
    orgMembers: { some: memberFilter },
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = role.toUpperCase();
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { [sort]: order },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users as unknown as UserResult[],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export interface CreateUserResult extends UserResult {
  temporaryPassword?: string;
}

/**
 * Create or invite a user and add them to the specified org.
 * - If the email is unknown: create a new user with a generated temp password
 *   and return it once so the admin can share it.
 * - If the email exists and isn't already a member of this org: link them.
 * - If they're already a member: 409.
 * The caller's role determines role-escalation guardrails.
 */
export async function createUserForOrg(params: {
  orgId: string;
  email: string;
  name: string;
  role: string;
  callerRole: string;
}): Promise<CreateUserResult> {
  const { orgId, email, name, role, callerRole } = params;

  const upperRole = role.toUpperCase();
  const callerUpper = callerRole.toUpperCase();
  const callerLevel = ROLE_HIERARCHY[callerUpper] ?? -1;
  const targetLevel = ROLE_HIERARCHY[upperRole] ?? -1;
  if (targetLevel < 0 || targetLevel > callerLevel) {
    throw new AppError(
      403,
      'Forbidden',
      'Cannot assign a role higher than your own',
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  // Case 1: user exists — link or error.
  if (existing) {
    const alreadyMember = await prisma.orgMember.findFirst({
      where: { orgId, userId: existing.id, isActive: true },
    });
    if (alreadyMember) {
      throw new AppError(409, 'Conflict', 'User is already a member of this organization');
    }

    await prisma.orgMember.upsert({
      where: { userId_orgId: { userId: existing.id, orgId } },
      create: { userId: existing.id, orgId, role: upperRole as never, isActive: true },
      update: { role: upperRole as never, isActive: true },
    });

    logger.info({ userId: existing.id, orgId, role: upperRole }, 'Existing user linked to org');

    return {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      role: existing.role,
      isActive: existing.isActive,
      isVerified: existing.isVerified,
      lastLoginAt: existing.lastLoginAt,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };
  }

  // Case 2: new user — create with temp password, add as org member.
  const temporaryPassword = randomBytes(9).toString('base64url'); // ~12 URL-safe chars
  const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);

  const created = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: upperRole as never,
      isActive: true,
      orgMembers: {
        create: { orgId, role: upperRole as never, isActive: true },
      },
    },
  });

  logger.info({ userId: created.id, orgId, role: upperRole }, 'User created + added to org');

  return {
    id: created.id,
    email: created.email,
    name: created.name,
    role: created.role,
    isActive: created.isActive,
    isVerified: created.isVerified,
    lastLoginAt: created.lastLoginAt,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
    temporaryPassword,
  };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      isVerified: true,
      mfaEnabled: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      orgMembers: {
        where: { isActive: true },
        select: { orgId: true, role: true, org: { select: { id: true, name: true } } },
        take: 1,
      },
    },
  });

  if (!user) throw new AppError(404, 'Not Found', 'User not found');

  const membership = user.orgMembers[0];
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    isVerified: user.isVerified,
    mfaEnabled: user.mfaEnabled,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    orgId: membership?.orgId ?? null,
    orgName: membership?.org?.name ?? null,
    orgRole: membership?.role ?? null,
  };
}

export async function getUserById(userId: string): Promise<UserResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      isVerified: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'Not Found', 'User not found');
  }

  return user as unknown as UserResult;
}

export async function updateUser(
  userId: string,
  data: { name?: string; role?: string; isActive?: boolean },
  requestingUserRole: string,
): Promise<UserResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'Not Found', 'User not found');
  }

  // Prevent role escalation: requester cannot assign a role higher than their own
  if (data.role) {
    const requesterLevel = ROLE_HIERARCHY[requestingUserRole.toUpperCase()] ?? 0;
    const targetLevel = ROLE_HIERARCHY[data.role.toUpperCase()] ?? 0;
    if (targetLevel > requesterLevel) {
      throw new AppError(403, 'Forbidden', 'Cannot assign a role higher than your own');
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role.toUpperCase();
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      isVerified: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info({ userId, changes: Object.keys(updateData) }, 'User updated');
  return updated as unknown as UserResult;
}

export async function softDeleteUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'Not Found', 'User not found');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });

  logger.info({ userId }, 'User soft-deleted');
}
