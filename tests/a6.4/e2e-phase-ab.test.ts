import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * AV4-339: E2E — full Article 6.4 / PACM activity lifecycle.
 *
 * This harness runs against a **live deployed** API at `E2E_BASE_URL`
 * (default `https://aurex.in`). Phase A+B (scenarios 1-7) and Phase C
 * (scenarios 8-10) exercise the full cradle-to-grave path:
 *
 *   create → validate → LoA → monitor → verify → issue
 *         → transfer (CA emitted) → BTR export → retire.
 *
 * Preconditions (seeded via `E2E_SEED=1` path in `seed-master-data.ts`):
 *   - e2e_admin@aurex.in / E2eAdmin@2026!   — ORG_ADMIN
 *   - e2e_doe@aurex.in   / E2eDoe@2026!     — DOE
 *   - e2e_dna@aurex.in   / E2eDna@2026!     — DNA
 *
 * Isolation: each describe-block creates + tears down resources tagged
 * with a unique suffix (test run timestamp) so concurrent runs don't
 * collide. We do NOT delete the seeded test organisation / users — the
 * seed is idempotent across runs.
 *
 * Expected state math (scenarios 6-7):
 *   baseline = 10000, project = 2000, leakage = 500  → gross = 7500
 *   conservativeness 5% floor                        → verified_er = 7125
 *   SOP 5% of 7125 = 356  (floor)
 *   OMGE 2% of 7125 = 142 (floor)
 *   net = 7125 - 356 - 142 = 6627
 *
 * Phase C buyer model (scenarios 8-10):
 *   Aurex's registry has no standalone "buyer receive-only" account type
 *   — transfers move a block between two CreditAccounts (typically both
 *   ACTIVITY_PARTICIPANT). The E2E harness therefore creates a second
 *   "buyer activity" under the same E2E Test Organisation to surface a
 *   fresh ACTIVITY_PARTICIPANT account that can serve as the transfer
 *   target. The CA-emission path does not care whether buyer and seller
 *   share an org — CA is driven by `firstTransferAt === null` +
 *   `unitType === A6_4ER` + authorized scope (NDC_USE / OIMP / NDC_AND_OIMP).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://aurex.in';
const API = `${BASE_URL}/api/v1`;

// Skip the suite unless explicitly enabled — we do NOT want it running in the
// default `pnpm test` wave (would spam production).
const ENABLED = process.env.E2E_RUN === '1';
const d = ENABLED ? describe : describe.skip;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
}

async function login(email: string, password: string): Promise<TokenPair> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenPair;
}

async function api<T>(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  const method = opts.method ?? (opts.body ? 'POST' : 'GET');

  // Simple 429/503 retry w/ exponential back-off. Prod rate-limit is
  // 100 API requests/min per IP (apps/api/src/middleware/rate-limiter.ts)
  // and the lifecycle harness can burst past that when scenarios overlap.
  let attempt = 0;
  const maxAttempts = 4;
  let res: Response;
  let text: string;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    text = await res.text();
    if ((res.status === 429 || res.status === 503) && attempt < maxAttempts - 1) {
      attempt += 1;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    break;
  }

  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body: body as T };
}

// Shared state across tests in the suite — populated as the lifecycle
// advances scenario by scenario.
interface HarnessState {
  admin?: TokenPair;
  doe?: TokenPair;
  dna?: TokenPair;
  methodologyId?: string;
  activityId?: string;
  periodId?: string;
  issuanceId?: string;
  grossUnits?: number;
  netUnits?: number;
  sopUnits?: number;
  omgeUnits?: number;
  // Phase C: transfer + retirement state
  sellerAccountId?: string;  // ACTIVITY_PARTICIPANT for the issuing activity
  netBlockId?: string;       // the NET CreditUnitBlock from issuance (~6627 units)
  buyerActivityId?: string;  // second activity, provides the buyer ACTIVITY_PARTICIPANT
  buyerAccountId?: string;   // buyer ACTIVITY_PARTICIPANT — transfer target
  caEventId?: string;        // CA event emitted on first transfer
}
const S: HarnessState = {};

// Tag used to disambiguate parallel runs' resources.
const RUN_TAG = Date.now();

d('[a6.4] Phase A+B full-lifecycle E2E', () => {
  beforeAll(async () => {
    S.admin = await login('e2e_admin@aurex.in', 'E2eAdmin@2026!');
    S.doe = await login('e2e_doe@aurex.in', 'E2eDoe@2026!');
    S.dna = await login('e2e_dna@aurex.in', 'E2eDna@2026!');
  });

  afterAll(async () => {
    // Activities are tagged with the run's timestamp; cleanup is best-effort.
    // We do NOT delete the seeded test org/users — seed is idempotent so
    // next run reuses them. Archive any leftover activity if needed via
    // `POST /activities/:id/close` (DONE inside scenario 7's cleanup).
  });

  it('Scenario 1: create a grid-RE activity in India (sectoral scope 1)', async () => {
    // Fetch the seeded grid-connected renewable electricity methodology.
    const methos = await api<{ data: Array<{ id: string; code: string }> }>('/methodologies', {
      token: S.admin!.accessToken,
    });
    expect(methos.status).toBe(200);
    const grid = methos.body.data.find((m) => m.code === 'A6.4-AM-GRID-RE-001');
    expect(grid, 'seeded A6.4-AM-GRID-RE-001 methodology present').toBeTruthy();
    S.methodologyId = grid!.id;

    const create = await api<{ data: { id: string; status: string } }>('/activities', {
      token: S.admin!.accessToken,
      body: {
        methodologyId: S.methodologyId,
        title: `E2E Grid-RE Solar ${Date.now()}`,
        description: 'E2E test — 10MW solar PV, grid-connected',
        hostCountry: 'IN',
        sectoralScope: 1,
        technologyType: 'solar_pv',
        gasesCovered: ['CO2'],
        creditingPeriodType: 'FIXED_10YR',
        creditingPeriodStart: '2026-01-01',
        creditingPeriodEnd: '2036-01-01',
        expectedAnnualEr: 15000,
      },
    });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe('DRAFT');
    S.activityId = create.body.data.id;
  });

  it('Scenario 2: upsert PDD + monitoring plan', async () => {
    const pdd = await api(`/pdds/${S.activityId}`, {
      method: 'PUT',
      token: S.admin!.accessToken,
      body: {
        content: {
          projectInfo: { title: 'E2E Grid-RE Solar', technologyType: 'solar_pv' },
          boundaries: { geojson: '{"type":"Polygon","coordinates":[]}' },
          baseline: { narrative: 'Grid-average EF × displaced kWh' },
        },
      },
    });
    expect(pdd.status).toBe(200);

    // Upsert monitoring plan with 3 parameters (PUT /monitoring/activities/:id/plan).
    const plan = await api<{ data: { id: string; version: number } }>(
      `/monitoring/activities/${S.activityId}/plan`,
      {
        method: 'PUT',
        token: S.admin!.accessToken,
        body: {
          parameters: [
            {
              code: 'electricity_generated',
              name: 'Electricity supplied to grid',
              unit: 'MWh',
              measurementMethod: 'DIRECT',
              frequency: 'continuous',
            },
            {
              code: 'grid_ef',
              name: 'Grid emission factor',
              unit: 'tCO2e/MWh',
              measurementMethod: 'DEFAULT',
              frequency: 'annual',
            },
            {
              code: 'displacement_factor',
              name: 'Displacement factor',
              unit: 'ratio',
              measurementMethod: 'DEFAULT',
              frequency: 'annual',
            },
          ],
        },
      },
    );
    expect(plan.status === 200 || plan.status === 201).toBe(true);
    expect(plan.body.data.version).toBeGreaterThanOrEqual(1);
  });

  it('Scenario 3: DOE validation (requires e2e_doe seed user)', async () => {
    // Admin submits the activity first.
    const submitAct = await api(`/activities/${S.activityId}/submit`, {
      method: 'POST',
      token: S.admin!.accessToken,
    });
    expect(submitAct.status).toBe(200);

    // DOE starts validation.
    const startVal = await api(`/activities/${S.activityId}/validate-start`, {
      method: 'POST',
      token: S.doe!.accessToken,
    });
    expect(startVal.status).toBe(200);

    // DOE submits ValidationReport with POSITIVE opinion.
    const valReport = await api<{ data: { opinion: string } }>(
      `/verification/activities/${S.activityId}/validation`,
      {
        token: S.doe!.accessToken,
        body: {
          doeOrgName: 'DOE-TEST-001',
          doeAccreditationId: 'ACC-0001',
          opinion: 'POSITIVE',
          findings: { notes: 'meets A6.4 requirements' },
        },
      },
    );
    expect(valReport.status === 200 || valReport.status === 201).toBe(true);

    // Activity should have advanced to AWAITING_HOST.
    const act = await api<{ data: { status: string } }>(`/activities/${S.activityId}`, {
      token: S.admin!.accessToken,
    });
    expect(act.body.data.status).toBe('AWAITING_HOST');
  });

  it('Scenario 4: host authorization (requires e2e_dna seed user)', async () => {
    const loa = await api(`/verification/activities/${S.activityId}/authorization`, {
      token: S.dna!.accessToken,
      body: {
        dnaName: 'India DNA — E2E',
        authorizedFor: 'NDC_USE',
        validFrom: '2026-01-01',
        validUntil: '2036-01-01',
      },
    });
    expect(loa.status === 200 || loa.status === 201).toBe(true);

    const act = await api<{ data: { status: string } }>(`/activities/${S.activityId}`, {
      token: S.admin!.accessToken,
    });
    expect(act.body.data.status).toBe('REGISTERED');
  });

  it('Scenario 5: monitoring period + datapoints', async () => {
    const period = await api<{ data: { id: string; status: string } }>(
      `/monitoring/activities/${S.activityId}/periods`,
      {
        token: S.admin!.accessToken,
        body: {
          periodStart: '2026-01-01',
          periodEnd: '2026-03-31',
        },
      },
    );
    expect(period.status === 200 || period.status === 201).toBe(true);
    S.periodId = period.body.data.id;

    // Ingest 10 metered datapoints — monitoring route takes `{ datapoints: [] }` batch.
    const datapoints = Array.from({ length: 10 }, (_, i) => ({
      parameterCode: 'electricity_generated',
      timestamp: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
      rawValue: 1000 + i * 10,
      provenance: 'METER' as const,
      sourceRef: `meter-001:${i}`,
    }));
    const dp = await api(`/monitoring/periods/${S.periodId}/datapoints`, {
      token: S.admin!.accessToken,
      body: { datapoints },
    });
    expect(dp.status === 200 || dp.status === 201).toBe(true);

    const submit = await api<{ data: { status: string } }>(
      `/monitoring/periods/${S.periodId}/submit`,
      { method: 'POST', token: S.admin!.accessToken },
    );
    expect(submit.status).toBe(200);
    expect(submit.body.data.status).toBe('SUBMITTED');
  });

  it('Scenario 6: DOE verification — expect verified_er=7125', async () => {
    const rep = await api<{
      data: {
        report: { verifiedEr: number | string; opinion: string };
        erCalculation: { netEr: number; grossEr: number };
      };
    }>(`/verification/periods/${S.periodId}/verification`, {
      token: S.doe!.accessToken,
      body: {
        doeOrgName: 'DOE-TEST-001',
        doeAccreditationId: 'ACC-0001',
        methodologyVersion: '01.0',
        baselineEmissions: 10000,
        projectEmissions: 2000,
        leakageEmissions: 500,
        conservativenessPct: 5,
        opinion: 'POSITIVE',
      },
    });
    expect(rep.status === 200 || rep.status === 201).toBe(true);
    expect(Number(rep.body.data.report.verifiedEr)).toBe(7125);

    // No GET /monitoring/periods/:id endpoint — list for the activity and find ours.
    const periods = await api<{ data: Array<{ id: string; status: string }> }>(
      `/monitoring/activities/${S.activityId}/periods`,
      { token: S.admin!.accessToken },
    );
    const period = periods.body.data.find((p) => p.id === S.periodId);
    expect(period, 'verified period surfaces in list').toBeTruthy();
    expect(period!.status).toBe('VERIFIED');
  });

  it('Scenario 7: issuance + levy assertions (net=6627, sop=356, omge=142)', async () => {
    const req = await api<{ data: { id: string } }>(`/issuances/periods/${S.periodId}`, {
      method: 'POST',
      token: S.admin!.accessToken,
    });
    expect(req.status === 200 || req.status === 201).toBe(true);
    S.issuanceId = req.body.data.id;

    const approve = await api<{
      data: {
        issuance: {
          grossUnits: number | string;
          netUnits: number | string;
          sopLevyUnits: number | string;
          omgeCancelledUnits: number | string;
          status: string;
        };
        netBlockId: string | null;
      };
    }>(`/issuances/${S.issuanceId}/approve`, {
      method: 'POST',
      token: S.admin!.accessToken,
    });
    expect(approve.status).toBe(200);

    S.grossUnits = Number(approve.body.data.issuance.grossUnits);
    S.netUnits = Number(approve.body.data.issuance.netUnits);
    S.sopUnits = Number(approve.body.data.issuance.sopLevyUnits);
    S.omgeUnits = Number(approve.body.data.issuance.omgeCancelledUnits);
    // Scenario 8 uses this directly instead of searching via /accounts/:id holdings.
    S.netBlockId = approve.body.data.netBlockId ?? undefined;

    // Registry math — floor'd at every step.
    expect(S.grossUnits).toBe(7125);
    expect(S.sopUnits).toBe(356);
    expect(S.omgeUnits).toBe(142);
    expect(S.netUnits).toBe(6627);
    expect(S.sopUnits + S.omgeUnits + S.netUnits).toBe(S.grossUnits);

    // Participant credit account balance should equal netUnits. /credits/accounts
    // returns bare CreditAccount rows (no computed balance); resolve it via
    // /credits/accounts/:id whose service returns a `summary.totalActive` sum.
    const accounts = await api<{
      data: Array<{ id: string; accountType: string; activityId: string | null }>;
    }>(`/credits/accounts`, { token: S.admin!.accessToken });
    expect(accounts.status).toBe(200);
    const participant = accounts.body.data.find(
      (a) => a.accountType === 'ACTIVITY_PARTICIPANT' && a.activityId === S.activityId,
    );
    expect(participant, 'participant account exists').toBeTruthy();

    const full = await api<{ data: { summary: { totalActive: number } } }>(
      `/credits/accounts/${participant!.id}`,
      { token: S.admin!.accessToken },
    );
    expect(full.status).toBe(200);
    expect(Number(full.body.data.summary.totalActive)).toBeGreaterThanOrEqual(6627);
  });

  // ─── Phase C scenarios — transfer + BTR + retirement (AAT-1/2 + AAT-8) ──

  it('Scenario 8: first transfer emits a PENDING_EXPORT CA event', async () => {
    // Precondition: scenario 7 approved issuance → NET block id was captured
    // directly into S.netBlockId. Verify block state via /credits/accounts.
    expect(S.netBlockId, 'NET block id populated by scenario 7 approval').toBeTruthy();

    const accounts = await api<{
      data: Array<{
        id: string;
        accountType: string;
        activityId: string | null;
      }>;
    }>(`/credits/accounts`, { token: S.admin!.accessToken });
    expect(accounts.status).toBe(200);

    const seller = accounts.body.data.find(
      (a) => a.accountType === 'ACTIVITY_PARTICIPANT' && a.activityId === S.activityId,
    );
    expect(seller, 'seller ACTIVITY_PARTICIPANT account exists').toBeTruthy();
    S.sellerAccountId = seller!.id;

    // Confirm pre-transfer block state.
    interface BlockRow {
      id: string;
      unitCount: number | string;
      unitType: string;
      retirementStatus: string;
      caStatus: string;
      firstTransferAt: string | null;
      authorizationStatus: string;
      holderAccountId: string;
      retiredAt: string | null;
      retirementNarrative: string | null;
    }
    interface AccountHoldingsResp {
      data: {
        account: { id: string; holdings: BlockRow[] };
        summary: { totalActive: number };
      };
    }
    const sellerFull = await api<AccountHoldingsResp>(
      `/credits/accounts/${S.sellerAccountId}`,
      { token: S.admin!.accessToken },
    );
    expect(sellerFull.status).toBe(200);
    const netBlock = sellerFull.body.data.account.holdings.find((h) => h.id === S.netBlockId);
    expect(netBlock, 'NET block present on seller account pre-transfer').toBeTruthy();
    expect(Number(netBlock!.unitCount)).toBe(S.netUnits);
    expect(netBlock!.unitType).toBe('A6_4ER');
    expect(netBlock!.retirementStatus).toBe('ACTIVE');
    expect(netBlock!.firstTransferAt).toBeNull();
    expect(netBlock!.caStatus).toBe('PENDING');

    // Create a "buyer" activity in the same E2E org to surface a fresh
    // ACTIVITY_PARTICIPANT account. Aurex has no standalone "receive-only"
    // account type; same-org second-activity transfer is the closest
    // analogue and still exercises the CA-emission path (which only cares
    // about firstTransferAt / unitType / authorizationStatus).
    const buyerAct = await api<{ data: { id: string } }>(`/activities`, {
      token: S.admin!.accessToken,
      body: {
        methodologyId: S.methodologyId,
        title: `E2E Buyer Activity ${RUN_TAG}`,
        description: 'E2E test — passive buyer of Phase C block',
        hostCountry: 'IN',
        sectoralScope: 1,
        technologyType: 'solar_pv',
        gasesCovered: ['CO2'],
        creditingPeriodType: 'FIXED_10YR',
        creditingPeriodStart: '2026-01-01',
        creditingPeriodEnd: '2036-01-01',
        expectedAnnualEr: 15000,
      },
    });
    expect(buyerAct.status).toBe(201);
    S.buyerActivityId = buyerAct.body.data.id;

    // Re-list accounts to pick up the buyer's newly-minted participant account.
    const afterAccounts = await api<{
      data: Array<{ id: string; accountType: string; activityId: string | null }>;
    }>(`/credits/accounts`, { token: S.admin!.accessToken });
    const buyerAccount = afterAccounts.body.data.find(
      (a) =>
        a.accountType === 'ACTIVITY_PARTICIPANT' && a.activityId === S.buyerActivityId,
    );
    expect(buyerAccount, 'buyer ACTIVITY_PARTICIPANT account exists').toBeTruthy();
    S.buyerAccountId = buyerAccount!.id;

    // Perform the transfer (ORG_ADMIN role required).
    const transfer = await api<{
      data: { block: { id: string; holderAccountId: string; firstTransferAt: string | null } };
    }>(`/credits/blocks/${S.netBlockId}/transfer`, {
      token: S.admin!.accessToken,
      body: { toAccountId: S.buyerAccountId },
    });
    expect(transfer.status === 200 || transfer.status === 201).toBe(true);
    expect(transfer.body.data.block.holderAccountId).toBe(S.buyerAccountId);
    expect(transfer.body.data.block.firstTransferAt).not.toBeNull();

    // Re-GET the block via the buyer account to confirm post-state.
    const buyerFull = await api<AccountHoldingsResp>(
      `/credits/accounts/${S.buyerAccountId}`,
      { token: S.admin!.accessToken },
    );
    const movedBlock = buyerFull.body.data.account.holdings.find((h) => h.id === S.netBlockId);
    expect(movedBlock, 'block now held by buyer').toBeTruthy();
    expect(movedBlock!.firstTransferAt).not.toBeNull();
    // caStatus stays PENDING until host DNA acknowledges the BTR. emitOnFirstTransfer
    // deliberately does NOT flip to APPLIED — that transition is out of scope here.
    expect(movedBlock!.caStatus).toBe('PENDING');
    expect(movedBlock!.retirementStatus).toBe('ACTIVE');

    // CA event emitted — fetch via the DNA-scoped BTR endpoint. We scope by
    // since=RUN_TAG-60s so only this run's events appear. We deliberately
    // do NOT pass status=PENDING_EXPORT because the route flips matching
    // events → EXPORTED inside the same request, then re-queries with the
    // same `where` (including status=PENDING_EXPORT), which returns [] for
    // the just-flipped events. The no-status variant returns the full
    // post-flip snapshot (see AV4-XXX follow-up: BTR snapshot re-read bug).
    const since = new Date(RUN_TAG - 60_000).toISOString();
    const btr = await api<{
      data: {
        events: Array<{
          eventId: string;
          blockId: string;
          status: string;
          units: number;
        }>;
      };
    }>(
      `/corresponding-adjustments/btr/IN?since=${encodeURIComponent(since)}`,
      { token: S.dna!.accessToken },
    );
    expect(btr.status).toBe(200);
    const ourEvent = btr.body.data.events.find((e) => e.blockId === S.netBlockId);
    expect(ourEvent, 'CA event emitted for transferred block').toBeTruthy();
    expect(ourEvent!.status).toBe('EXPORTED'); // GET /btr has side-effect: flips PENDING→EXPORTED
    expect(Number(ourEvent!.units)).toBe(S.netUnits);
    S.caEventId = ourEvent!.eventId;
  });

  it('Scenario 9: BTR export by host DNA marks CA event EXPORTED', async () => {
    // Precondition: scenario 8 emitted a CA event. The first BTR call in
    // scenario 8 already transitioned it PENDING_EXPORT → EXPORTED; here we
    // re-pull the BTR (idempotent) and assert final shape + totals.
    expect(S.caEventId, 'CA event from scenario 8').toBeTruthy();

    const since = new Date(RUN_TAG - 60_000).toISOString();
    const btr = await api<{
      data: {
        hostCountry: string;
        asOf: string;
        events: Array<{
          eventId: string;
          blockId: string;
          status: string;
          units: number;
          btrExportedAt: string | null;
          unitType: string | null;
          vintage: number;
          buyerCountry: string | null;
        }>;
        totals: {
          pendingExport: number;
          exported: number;
          acknowledged: number;
        };
      };
    }>(
      `/corresponding-adjustments/btr/IN?since=${encodeURIComponent(since)}`,
      { token: S.dna!.accessToken },
    );
    expect(btr.status).toBe(200);

    // Structural shape assertions.
    expect(btr.body.data.hostCountry).toBe('IN');
    expect(btr.body.data.asOf).toEqual(expect.any(String));
    expect(Array.isArray(btr.body.data.events)).toBe(true);
    expect(btr.body.data.totals).toEqual(
      expect.objectContaining({
        pendingExport: expect.any(Number),
        exported: expect.any(Number),
        acknowledged: expect.any(Number),
      }),
    );

    // Our event must be present and EXPORTED with a btrExportedAt stamp.
    const ourEvent = btr.body.data.events.find((e) => e.eventId === S.caEventId);
    expect(ourEvent, 'CA event from scenario 8 still surfaces in BTR').toBeTruthy();
    expect(ourEvent!.status).toBe('EXPORTED');
    expect(ourEvent!.btrExportedAt).not.toBeNull();
    expect(ourEvent!.unitType).toBe('A6_4ER');
    expect(Number(ourEvent!.units)).toBe(S.netUnits);

    // `exported` total must include at least our event.
    expect(btr.body.data.totals.exported).toBeGreaterThanOrEqual(1);
  });

  it('Scenario 10: NDC retirement parks block + emits second CA event', async () => {
    // Precondition: scenario 8 moved the block to the buyer account.
    expect(S.netBlockId).toBeTruthy();
    expect(S.buyerAccountId).toBeTruthy();

    // Retire for NDC — ORG_ADMIN gated. The buyer ORG_ADMIN in our model is
    // the same user (same E2E org) — the transfer was cross-account within
    // the same org so the admin can retire the block.
    const retire = await api<{
      data: {
        block: {
          id: string;
          holderAccountId: string;
          retirementStatus: string;
          retiredAt: string | null;
          retirementNarrative: string | null;
        };
        caEvent: { id: string; status: string; blockId: string } | null;
      };
    }>(`/credits/blocks/${S.netBlockId}/retire`, {
      token: S.admin!.accessToken,
      body: {
        purpose: 'NDC',
        narrative: `Retired for CORSIA phase 1 compliance — E2E test run ${RUN_TAG}`,
      },
    });
    expect(retire.status).toBe(200);

    // Block parked in the seeded RETIREMENT_NDC admin account.
    expect(retire.body.data.block.holderAccountId).toBe(
      'a64a0000-0000-4000-8000-000000000004',
    );
    expect(retire.body.data.block.retirementStatus).toBe('RETIRED_FOR_NDC');
    expect(retire.body.data.block.retiredAt).not.toBeNull();
    expect(retire.body.data.block.retirementNarrative).toContain('CORSIA');

    // NDC retirement of an authorized A6.4ER block MUST emit a second CA
    // event (distinct from the transfer CA event in scenario 8). The
    // transaction.service.retireBlock path calls ca-events.emitOnRetirement
    // which writes a new row with status=PENDING_EXPORT.
    expect(retire.body.data.caEvent, 'retirement CA event present').toBeTruthy();
    expect(retire.body.data.caEvent!.status).toBe('PENDING_EXPORT');
    expect(retire.body.data.caEvent!.id).not.toBe(S.caEventId);
    expect(retire.body.data.caEvent!.blockId).toBe(S.netBlockId);

    // Confirm via the DNA BTR endpoint that the new event surfaces. Same
    // caveat as scenario 8: pass no status filter to avoid the snapshot
    // re-read bug (event may be flipped to EXPORTED mid-request).
    const since = new Date(RUN_TAG - 60_000).toISOString();
    const btrPending = await api<{
      data: { events: Array<{ eventId: string; status: string; blockId: string }> };
    }>(
      `/corresponding-adjustments/btr/IN?since=${encodeURIComponent(since)}`,
      { token: S.dna!.accessToken },
    );
    expect(btrPending.status).toBe(200);
    const retirementEvent = btrPending.body.data.events.find(
      (e) => e.eventId === retire.body.data.caEvent!.id,
    );
    expect(retirementEvent, 'retirement CA event visible to DNA BTR').toBeTruthy();
  });

  // ─── Negative tests (RBAC + state-machine guards) ─────────────────────

  it('Negative: VIEWER/DOE retire attempt → 403', async () => {
    // The DOE user is a seeded org member with orgRole=DOE. The retire
    // route gates on ORG_ADMIN / SUPER_ADMIN, so DOE must be rejected.
    // We use the RETIREMENT_VOLUNTARY admin account's id as a valid-looking
    // :id param — the auth middleware runs before the service layer, so the
    // specific block id doesn't matter. The key assertion is the 403.
    const blockIdForTest = S.netBlockId ?? 'a64a0000-0000-4000-8000-000000000099';
    const res = await api(`/credits/blocks/${blockIdForTest}/retire`, {
      token: S.doe!.accessToken,
      body: { purpose: 'VOLUNTARY', narrative: 'Should be denied — DOE cannot retire' },
    });
    expect(res.status).toBe(403);
  });

  it('Negative: retire with invalid purpose → 400', async () => {
    const blockIdForTest = S.netBlockId ?? 'a64a0000-0000-4000-8000-000000000099';
    const res = await api(`/credits/blocks/${blockIdForTest}/retire`, {
      token: S.admin!.accessToken,
      body: { purpose: 'INVALID', narrative: 'malformed purpose enum' },
    });
    expect(res.status).toBe(400);
  });

  it('Negative: transfer to non-existent account → 404 / 409', async () => {
    // Scenario 10 retired S.netBlockId — it's no longer ACTIVE. A second
    // block is not available in this run, so we exercise the "target
    // account not found" branch instead (still a transfer-service guard).
    // Use a well-formed UUID that cannot match any real account.
    const blockIdForTest = S.netBlockId ?? '00000000-0000-4000-8000-000000000000';
    const res = await api(`/credits/blocks/${blockIdForTest}/transfer`, {
      token: S.admin!.accessToken,
      body: { toAccountId: '00000000-0000-4000-8000-000000000000' },
    });
    // Either 404 (target account not found) or 409 (block no longer ACTIVE
    // after scenario 10 retired it) is acceptable — both are negative-path
    // successes from the service layer's guards.
    expect([400, 404, 409]).toContain(res.status);
  });

  it('Negative: retire an already-retired block → 409', async () => {
    // S.netBlockId was retired in scenario 10. A second retire call must
    // bounce with 409 Conflict from the "already retired" guard.
    expect(S.netBlockId).toBeTruthy();
    const res = await api(`/credits/blocks/${S.netBlockId}/retire`, {
      token: S.admin!.accessToken,
      body: { purpose: 'VOLUNTARY', narrative: 'Double-retire attempt — should fail' },
    });
    // Either 409 Conflict (block already retired) or 404 (service scopes
    // block lookup to the caller's active holdings and the retired block
    // is now on an admin account, not the org's participant account).
    expect([404, 409]).toContain(res.status);
  });
});
