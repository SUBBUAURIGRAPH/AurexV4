#!/usr/bin/env tsx
/**
 * AAT-371 / AV4-371 — Aurigraph DLT tenant + UC_CARBON capability
 * onboarding smoke test.
 *
 * Operational tool that walks the four steps an Aurex deploy needs to
 * pass before a fresh tenant can mint biocarbon contracts:
 *
 *   1. Resolve config — print the env vars the runtime is using.
 *   2. Connectivity  — call `tier.getQuota()` via the adapter (smallest
 *      authenticated read). Prints the SDK MintQuota.
 *   3. Capabilities  — call `client.sdk.capabilities()` and check that
 *      UC_CARBON appears in either `approvedScopes` or any endpoint
 *      path / description / requiredScope.
 *   4. Rotation reminder — print the calendar date 90 days out so the
 *      operator can drop it on the team calendar.
 *
 * Usage:
 *
 *   pnpm --filter @aurex/api tsx scripts/aurigraph/tenant-onboarding.ts
 *
 * The script prints one line per check + a final OK / FAIL summary, then
 * exits 0 on full success or 1 on any failure. Failures are non-fatal
 * for subsequent checks — we want the operator to see the full picture
 * even if the first call fails.
 *
 * Modeled on `apps/api/scripts/email/send-test.ts` (Wave 11c).
 */

import { getAurigraphAdapter } from '../../src/services/chains/aurigraph-dlt-adapter.js';
import { getAurigraphClient } from '../../src/lib/aurigraph-client.js';
import type { CapabilitiesResponse, MintQuota } from '@aurigraph/dlt-sdk';

const DEFAULT_BASE_URL = 'https://dlt.aurigraph.io';
const DEFAULT_CHANNEL_ID = 'marketplace-channel';
const ROTATION_DAYS = 90;

function formatRotationDate(now: Date, daysAhead: number): string {
  const next = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

function detectUcCarbon(caps: CapabilitiesResponse): boolean {
  for (const scope of caps.approvedScopes ?? []) {
    if (scope.includes('UC_CARBON')) return true;
  }
  for (const ep of caps.endpoints ?? []) {
    if (ep.path?.includes('UC_CARBON')) return true;
    if (ep.description?.includes('UC_CARBON')) return true;
    if (ep.requiredScope?.includes('UC_CARBON')) return true;
  }
  return false;
}

function summariseQuota(q: MintQuota): string {
  if (q.mintMonthlyLimit === -1) {
    return `mint=unlimited (used=${q.mintMonthlyUsed}), dmrv=${q.dmrvDailyRemaining}/${q.dmrvDailyLimit}`;
  }
  return `mint=${q.mintMonthlyRemaining}/${q.mintMonthlyLimit} (used=${q.mintMonthlyUsed}), dmrv=${q.dmrvDailyRemaining}/${q.dmrvDailyLimit}`;
}

async function step1Config(): Promise<{ ok: boolean }> {
  const baseUrl = process.env.AURIGRAPH_BASE_URL ?? DEFAULT_BASE_URL;
  const tenantId = process.env.AURIGRAPH_TENANT_ID ?? '<unset>';
  const channelId = process.env.AURIGRAPH_CHANNEL_ID ?? DEFAULT_CHANNEL_ID;
  const apiKeySet = Boolean(process.env.AURIGRAPH_API_KEY);

  console.log('Step 1 — Config');
  console.log(`  baseUrl  : ${baseUrl}`);
  console.log(`  tenantId : ${tenantId}`);
  console.log(`  channelId: ${channelId}`);
  console.log(`  apiKeySet: ${apiKeySet ? 'yes' : 'NO  (AURIGRAPH_API_KEY missing)'}`);

  if (!apiKeySet) {
    console.error('  FAIL  AURIGRAPH_API_KEY is required.');
    return { ok: false };
  }
  return { ok: true };
}

async function step2Connectivity(): Promise<{ ok: boolean }> {
  console.log('\nStep 2 — Connectivity (tier.getQuota)');
  try {
    const adapter = getAurigraphAdapter();
    const quota = await adapter.getQuota();
    console.log(`  OK   ${summariseQuota(quota)}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  FAIL ${msg}`);
    return { ok: false };
  }
}

async function step3Capabilities(): Promise<{ ok: boolean }> {
  console.log('\nStep 3 — Capabilities (sdk.capabilities)');
  try {
    const client = getAurigraphClient();
    const caps = await client.sdk.capabilities();
    console.log(`  appId        : ${caps.appId}`);
    console.log(
      `  approvedScopes: ${caps.approvedScopes.length} → ${caps.approvedScopes.slice(0, 8).join(', ') || '<none>'}${caps.approvedScopes.length > 8 ? ', …' : ''}`,
    );
    console.log(`  totalEndpoints: ${caps.totalEndpoints}`);
    const ucCarbon = detectUcCarbon(caps);
    if (ucCarbon) {
      console.log('  UC_CARBON     : ENABLED');
      return { ok: true };
    }
    console.error('  UC_CARBON     : NOT enabled — contact the Aurigraph platform team.');
    return { ok: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  FAIL ${msg}`);
    return { ok: false };
  }
}

function step4RotationReminder(): { ok: boolean } {
  console.log('\nStep 4 — Key-rotation reminder');
  const now = new Date();
  const rotateBy = formatRotationDate(now, ROTATION_DAYS);
  console.log(
    `  rotate API key by ${rotateBy}  (calendar invite: "Rotate AURIGRAPH_API_KEY — tenant ${process.env.AURIGRAPH_TENANT_ID ?? '<unset>'}")`,
  );
  return { ok: true };
}

async function main(): Promise<number> {
  console.log('Aurex ↔ Aurigraph DLT tenant onboarding\n');

  const r1 = await step1Config();
  // Bail early if config is missing — subsequent calls will all fail
  // with the same generic "API_KEY missing" message anyway.
  if (!r1.ok) return 1;

  const r2 = await step2Connectivity();
  const r3 = await step3Capabilities();
  const r4 = step4RotationReminder();

  const allOk = r1.ok && r2.ok && r3.ok && r4.ok;
  console.log('\nSummary:');
  console.log(`  config       : ${r1.ok ? 'OK' : 'FAIL'}`);
  console.log(`  connectivity : ${r2.ok ? 'OK' : 'FAIL'}`);
  console.log(`  capabilities : ${r3.ok ? 'OK' : 'FAIL'}`);
  console.log(`  reminder     : ${r4.ok ? 'OK' : 'FAIL'}`);
  return allOk ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
