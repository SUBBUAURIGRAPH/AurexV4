import { prisma } from '@aurex/database';
import type { PaginatedResponse } from '@aurex/shared';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface OrgResult {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function createOrg(
  userId: string,
  data: { name: string; slug?: string },
): Promise<OrgResult> {
  const slug = data.slug ?? slugify(data.name);

  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) {
    throw new AppError(409, 'Conflict', 'Organization slug already exists');
  }

  const org = await prisma.organization.create({
    data: {
      name: data.name,
      slug,
      members: {
        create: {
          userId,
          role: 'ORG_ADMIN',
        },
      },
    },
  });

  logger.info({ orgId: org.id, userId }, 'Organization created');
  return org;
}

export async function getOrgById(orgId: string, userId: string): Promise<OrgResult> {
  const membership = await prisma.orgMember.findFirst({
    where: { orgId, userId, isActive: true },
  });

  if (!membership) {
    throw new AppError(403, 'Forbidden', 'You are not a member of this organization');
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    throw new AppError(404, 'Not Found', 'Organization not found');
  }

  return org;
}

export async function updateOrg(
  orgId: string,
  data: { name?: string; slug?: string; isActive?: boolean },
): Promise<OrgResult> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    throw new AppError(404, 'Not Found', 'Organization not found');
  }

  if (data.slug && data.slug !== org.slug) {
    const existing = await prisma.organization.findUnique({ where: { slug: data.slug } });
    if (existing) {
      throw new AppError(409, 'Conflict', 'Organization slug already exists');
    }
  }

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data,
  });

  logger.info({ orgId }, 'Organization updated');
  return updated;
}

export interface MemberResult {
  id: string;
  userId: string;
  orgId: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export async function listMembers(
  orgId: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<PaginatedResponse<MemberResult>> {
  const skip = (page - 1) * pageSize;

  const [members, total] = await Promise.all([
    prisma.orgMember.findMany({
      where: { orgId, isActive: true },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    }),
    prisma.orgMember.count({ where: { orgId, isActive: true } }),
  ]);

  return {
    data: members as unknown as MemberResult[],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function addMember(
  orgId: string,
  email: string,
  role: string,
): Promise<MemberResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(404, 'Not Found', 'User with this email not found');
  }

  const existing = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: user.id, orgId } },
  });
  if (existing) {
    throw new AppError(409, 'Conflict', 'User is already a member of this organization');
  }

  const member = await prisma.orgMember.create({
    data: {
      userId: user.id,
      orgId,
      role: role.toUpperCase() as any,
    },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  logger.info({ orgId, userId: user.id, role }, 'Member added to organization');
  return member as unknown as MemberResult;
}

export async function updateMemberRole(
  orgId: string,
  memberId: string,
  role: string,
): Promise<MemberResult> {
  const member = await prisma.orgMember.findFirst({
    where: { id: memberId, orgId },
  });

  if (!member) {
    throw new AppError(404, 'Not Found', 'Member not found');
  }

  const updated = await prisma.orgMember.update({
    where: { id: memberId },
    data: { role: role.toUpperCase() as any },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  logger.info({ orgId, memberId, role }, 'Member role updated');
  return updated as unknown as MemberResult;
}

export async function removeMember(orgId: string, memberId: string): Promise<void> {
  const member = await prisma.orgMember.findFirst({
    where: { id: memberId, orgId },
  });

  if (!member) {
    throw new AppError(404, 'Not Found', 'Member not found');
  }

  // Prevent removing the last org_admin
  if (member.role === 'ORG_ADMIN') {
    const adminCount = await prisma.orgMember.count({
      where: { orgId, role: 'ORG_ADMIN', isActive: true },
    });
    if (adminCount <= 1) {
      throw new AppError(
        400,
        'Bad Request',
        'Cannot remove the last organization admin',
        'https://aurex.in/errors/last-admin',
      );
    }
  }

  await prisma.orgMember.update({
    where: { id: memberId },
    data: { isActive: false },
  });

  logger.info({ orgId, memberId }, 'Member removed from organization');
}

export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  const membership = await prisma.orgMember.findFirst({
    where: { orgId, userId, isActive: true },
  });
  return !!membership;
}
