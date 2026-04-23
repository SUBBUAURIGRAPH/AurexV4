import { prisma } from '@aurex/database';
import type { PaginatedResponse } from '@aurex/shared';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';

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

const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  ANALYST: 1,
  MANAGER: 2,
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
