import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';

/**
 * Article 6.4 methodology catalogue — read-only.
 * Seeded from UNFCCC Supervisory Body standards in seed-master-data.ts.
 */

export async function listMethodologies(filter?: {
  category?: string;
  isActive?: boolean;
}) {
  const where: Record<string, unknown> = {};
  if (filter?.category) where.category = filter.category;
  if (filter?.isActive !== undefined) where.isActive = filter.isActive;
  return prisma.methodology.findMany({
    where,
    orderBy: [{ category: 'asc' }, { code: 'asc' }],
  });
}

export async function getMethodologyByCode(code: string) {
  const m = await prisma.methodology.findUnique({ where: { code } });
  if (!m) throw new AppError(404, 'Not Found', `Methodology ${code} not found`);
  return m;
}

export async function getMethodologyById(id: string) {
  const m = await prisma.methodology.findUnique({ where: { id } });
  if (!m) throw new AppError(404, 'Not Found', 'Methodology not found');
  return m;
}
