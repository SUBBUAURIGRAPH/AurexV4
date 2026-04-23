import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding AurexV4 database...');

  // Create default org
  const org = await prisma.organization.upsert({
    where: { slug: 'aurigraph' },
    update: {},
    create: {
      name: 'Aurigraph DLT Corp',
      slug: 'aurigraph',
    },
  });
  console.log(`  Organization: ${org.name} (${org.id})`);

  // Create admin user
  const passwordHash = await bcrypt.hash('Admin@AurexV4!2026', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aurigraph.io' },
    update: {},
    create: {
      email: 'admin@aurigraph.io',
      passwordHash,
      name: 'Subbu Jois',
      role: 'SUPER_ADMIN',
      isVerified: true,
    },
  });
  console.log(`  Admin user: ${admin.email} (${admin.id})`);

  // Link admin to org
  await prisma.orgMember.upsert({
    where: { userId_orgId: { userId: admin.id, orgId: org.id } },
    update: {},
    create: {
      userId: admin.id,
      orgId: org.id,
      role: 'SUPER_ADMIN',
    },
  });

  // Create test user
  const testHash = await bcrypt.hash('Test@Password123', 12);
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      passwordHash: testHash,
      name: 'Test User',
      role: 'ANALYST',
      isVerified: true,
    },
  });
  console.log(`  Test user: ${testUser.email} (${testUser.id})`);

  await prisma.orgMember.upsert({
    where: { userId_orgId: { userId: testUser.id, orgId: org.id } },
    update: {},
    create: {
      userId: testUser.id,
      orgId: org.id,
      role: 'ANALYST',
    },
  });

  console.log('Seed complete.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
