/**
 * AAT-FLOW6 — IFHD self-service org fixtures.
 *
 * Idempotent seed for the production org `IFHD` (id
 * 439099fd-4197-40fb-80c8-713d1efb9599) and primary admin
 * `shreyas@ifhd.in` (id 9c9cfed4-e21f-4609-94e7-ab655b80d439).
 *
 * Usage:
 *   pnpm exec tsx packages/database/scripts/seed-ifhd-fixtures.ts
 *
 * Re-running is safe: every row uses a deterministic UUID under the
 * `00000000-0000-0000-0002-...` namespace and we either `upsert` or
 * `findFirst → skip` to avoid duplicates.
 *
 * What it creates:
 *   • 3 suppliers     (mixed status: ACTIVE, INVITED, SUSPENDED)
 *   • 2 supplier data requests (one PENDING, one SUBMITTED)
 *   • 1 ApprovalRequest tied to a real IFHD emission record (or skipped
 *     if no emission rows exist)
 *   • 1 active FederationKey for the AWD2 partner (dummy public key —
 *     this is non-secret material, just a public PEM, but DO NOT use
 *     this key for actual federation traffic; rotate before going live)
 *   • 2 audit log rows so /audit-logs has visible activity
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const IFHD_ORG_ID = '439099fd-4197-40fb-80c8-713d1efb9599';
const IFHD_USER_ID = '9c9cfed4-e21f-4609-94e7-ab655b80d439';

// Deterministic UUIDs for the fixture rows so every run touches the
// same rows and never explodes the table.
const SUPPLIER_IDS = {
  acme: '00000000-0000-0000-0002-000000000001',
  greenfields: '00000000-0000-0000-0002-000000000002',
  steel: '00000000-0000-0000-0002-000000000003',
};
const REQUEST_IDS = {
  pending: '00000000-0000-0000-0002-000000000101',
  submitted: '00000000-0000-0000-0002-000000000102',
};
const APPROVAL_ID = '00000000-0000-0000-0002-000000000201';
const FEDERATION_KEY_ID = 'awd2-ifhd-flow6-demo';
const AUDIT_IDS = {
  one: '00000000-0000-0000-0002-000000000301',
  two: '00000000-0000-0000-0002-000000000302',
};

// PKCS#8 PEM stub. Valid format (BEGIN/END markers + base64 body) so the
// FederationKey schema validation accepts it. NEVER trust this key for
// real federation — operators rotate via /api/v1/admin/federation/keys.
const DEMO_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvQzZ9/AAT-FLOW6/SEED/
DEMO-KEY-NOT-FOR-PRODUCTION-USE-ROTATE-BEFORE-GO-LIVE-aurex-flow6/
fa1lNmlP6MbR4pq5h8LR6Y9wXHnJRtJgJqV0xCxYIsx2oYBcHJZlwuqB0uBJL5tLc
7sZQ5TYsZqjwq7j8HmcwmkxKqUYwUZcjU5vEcA9cYsZqjwq7j8HmcwmkxKqUYwUZ
cjU5vEcA9cYsZqjwq7j8HmcwmkxKqUYwUZcjU5vEcA9cYsZqjwq7j8HmcwmkxKqU
YwUZcjU5vEcA9cYsZqjwq7j8HmcwmkxKqUYwUZcjU5vEcA9cYsZqjwq7j8Hmcwmk
xQIDAQAB
-----END PUBLIC KEY-----`;

async function main(): Promise<void> {
  console.log('AAT-FLOW6 / IFHD fixtures — start');

  // ── Pre-flight: confirm the org + user exist ────────────────────────
  const org = await prisma.organization.findUnique({
    where: { id: IFHD_ORG_ID },
    select: { id: true, name: true },
  });
  if (!org) {
    console.error(
      `ERROR: IFHD org ${IFHD_ORG_ID} not found. Aborting (this seed only works on the prod database where the self-service registration landed).`,
    );
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: IFHD_USER_ID },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error(
      `ERROR: IFHD admin ${IFHD_USER_ID} not found. Aborting.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`  org:  ${org.name} (${org.id})`);
  console.log(`  user: ${user.email} (${user.id})`);

  // ── Suppliers (3) ──────────────────────────────────────────────────
  await prisma.supplier.upsert({
    where: { id: SUPPLIER_IDS.acme },
    update: {
      // Refresh status / category each run so re-seed converges to the
      // documented fixture state.
      name: 'ACME Logistics Pvt Ltd',
      email: 'sustainability@acmelogistics.example',
      contactPerson: 'Priya Mehta',
      category: 'Transport',
      status: 'ACTIVE',
    },
    create: {
      id: SUPPLIER_IDS.acme,
      orgId: IFHD_ORG_ID,
      name: 'ACME Logistics Pvt Ltd',
      email: 'sustainability@acmelogistics.example',
      contactPerson: 'Priya Mehta',
      category: 'Transport',
      status: 'ACTIVE',
    },
  });

  await prisma.supplier.upsert({
    where: { id: SUPPLIER_IDS.greenfields },
    update: {
      name: 'Greenfields Energy Co',
      email: 'esg@greenfieldsenergy.example',
      contactPerson: 'Rahul Sharma',
      category: 'Energy',
      status: 'INVITED',
    },
    create: {
      id: SUPPLIER_IDS.greenfields,
      orgId: IFHD_ORG_ID,
      name: 'Greenfields Energy Co',
      email: 'esg@greenfieldsenergy.example',
      contactPerson: 'Rahul Sharma',
      category: 'Energy',
      status: 'INVITED',
    },
  });

  await prisma.supplier.upsert({
    where: { id: SUPPLIER_IDS.steel },
    update: {
      name: 'Steel Cement Pvt Ltd',
      email: 'compliance@steelcement.example',
      contactPerson: 'Anita Rao',
      category: 'Materials',
      status: 'SUSPENDED',
    },
    create: {
      id: SUPPLIER_IDS.steel,
      orgId: IFHD_ORG_ID,
      name: 'Steel Cement Pvt Ltd',
      email: 'compliance@steelcement.example',
      contactPerson: 'Anita Rao',
      category: 'Materials',
      status: 'SUSPENDED',
    },
  });
  console.log('  ✓ 3 suppliers upserted');

  // ── Supplier data requests (2) ─────────────────────────────────────
  await prisma.supplierDataRequest.upsert({
    where: { id: REQUEST_IDS.pending },
    update: {
      status: 'PENDING',
      title: 'FY 2025-26 Q1 Scope 3 emissions',
      dataScope: 'scope_3_emissions',
    },
    create: {
      id: REQUEST_IDS.pending,
      supplierId: SUPPLIER_IDS.acme,
      orgId: IFHD_ORG_ID,
      title: 'FY 2025-26 Q1 Scope 3 emissions',
      description: 'Quarterly Scope 3 freight emissions per supplier policy.',
      dataScope: 'scope_3_emissions',
      periodStart: new Date('2025-04-01T00:00:00Z'),
      periodEnd: new Date('2025-06-30T23:59:59Z'),
      dueBy: new Date('2025-07-15T23:59:59Z'),
      status: 'PENDING',
      createdBy: IFHD_USER_ID,
    },
  });

  await prisma.supplierDataRequest.upsert({
    where: { id: REQUEST_IDS.submitted },
    update: {
      status: 'SUBMITTED',
      submittedAt: new Date('2025-04-20T10:00:00Z'),
      submittedValue: {
        electricity_kwh: 124500,
        renewable_share_pct: 32.5,
        unit: 'kWh',
      } as Prisma.InputJsonValue,
    },
    create: {
      id: REQUEST_IDS.submitted,
      supplierId: SUPPLIER_IDS.greenfields,
      orgId: IFHD_ORG_ID,
      title: 'FY 2024-25 H2 energy consumption',
      description: 'Energy use for the Pune facility, with renewable share split.',
      dataScope: 'energy_consumption',
      periodStart: new Date('2024-10-01T00:00:00Z'),
      periodEnd: new Date('2025-03-31T23:59:59Z'),
      dueBy: new Date('2025-04-30T23:59:59Z'),
      status: 'SUBMITTED',
      submittedAt: new Date('2025-04-20T10:00:00Z'),
      submittedValue: {
        electricity_kwh: 124500,
        renewable_share_pct: 32.5,
        unit: 'kWh',
      } as Prisma.InputJsonValue,
      createdBy: IFHD_USER_ID,
    },
  });
  console.log('  ✓ 2 supplier data requests upserted');

  // ── ApprovalRequest tied to a real IFHD emission ────────────────────
  const emission = await prisma.emissionsRecord.findFirst({
    where: { orgId: IFHD_ORG_ID },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (emission) {
    await prisma.approvalRequest.upsert({
      where: { id: APPROVAL_ID },
      update: {
        // We deliberately do NOT reset status — if an Aurex admin already
        // approved this request in a prior run, leave their decision
        // alone.
        resource: 'EmissionsRecord',
        resourceId: emission.id,
      },
      create: {
        id: APPROVAL_ID,
        orgId: IFHD_ORG_ID,
        resource: 'EmissionsRecord',
        resourceId: emission.id,
        requestedBy: IFHD_USER_ID,
        status: 'PENDING',
        payload: {
          note: 'AAT-FLOW6 demo approval — review the IFHD emission entry.',
        } as Prisma.InputJsonValue,
        requiredApprovers: 1,
        approvalsReceived: 0,
      },
    });
    console.log('  ✓ 1 approval request upserted (tied to emission ' + emission.id + ')');
  } else {
    console.log('  ⚠ no IFHD emission rows found — skipping approval seed');
  }

  // ── FederationKey for AWD2 partner ─────────────────────────────────
  // findFirst → upsert by `keyId` (the unique column).
  await prisma.federationKey.upsert({
    where: { keyId: FEDERATION_KEY_ID },
    update: {
      isActive: true,
      notes:
        'AAT-FLOW6 demo federation key for AWD2 partner. NOT FOR PRODUCTION TRAFFIC — rotate via /api/v1/admin/federation/keys before go-live.',
    },
    create: {
      partner: 'AWD2',
      keyId: FEDERATION_KEY_ID,
      publicKeyPem: DEMO_PUBLIC_KEY_PEM,
      algorithm: 'RS256',
      isActive: true,
      notes:
        'AAT-FLOW6 demo federation key for AWD2 partner. NOT FOR PRODUCTION TRAFFIC — rotate via /api/v1/admin/federation/keys before go-live.',
    },
  });
  console.log('  ✓ 1 federation key upserted (AWD2)');

  // ── Audit log rows (2) ─────────────────────────────────────────────
  // We use upsert-by-id so re-running stays idempotent. The Prisma
  // AuditLog model has no unique constraint other than `id`; that's
  // enough.
  await prisma.auditLog.upsert({
    where: { id: AUDIT_IDS.one },
    update: {},
    create: {
      id: AUDIT_IDS.one,
      orgId: IFHD_ORG_ID,
      userId: IFHD_USER_ID,
      action: 'org.member.add',
      resource: 'OrgMember',
      resourceId: null,
      newValue: { role: 'org_admin' } as Prisma.InputJsonValue,
      ipAddress: '203.0.113.10',
    },
  });
  await prisma.auditLog.upsert({
    where: { id: AUDIT_IDS.two },
    update: {},
    create: {
      id: AUDIT_IDS.two,
      orgId: IFHD_ORG_ID,
      userId: IFHD_USER_ID,
      action: 'supplier.invite',
      resource: 'Supplier',
      resourceId: SUPPLIER_IDS.greenfields,
      newValue: { name: 'Greenfields Energy Co', status: 'INVITED' } as Prisma.InputJsonValue,
      ipAddress: '203.0.113.10',
    },
  });
  console.log('  ✓ 2 audit log rows upserted');

  console.log('AAT-FLOW6 / IFHD fixtures — done');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
