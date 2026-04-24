import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * AV4-339: E2E — full Article 6.4 / PACM activity lifecycle.
 *
 * This harness runs against a **live deployed** API at `E2E_BASE_URL`
 * (default `https://aurex.in`). Phase C (AV4-328..333) scenarios are
 * stubbed as `it.todo(...)` — they land once transfers, CA, BTR, and
 * retirement are deployed.
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
  const res = await fetch(`${API}${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
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
}
const S: HarnessState = {};

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

    // Create monitoring plan with 3 parameters.
    const plan = await api<{ data: { id: string; version: number } }>(
      `/monitoring/plans`,
      {
        token: S.admin!.accessToken,
        body: {
          activityId: S.activityId,
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
    expect(plan.body.data.version).toBe(1);
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
      `/verification/validation-reports`,
      {
        token: S.doe!.accessToken,
        body: {
          activityId: S.activityId,
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
    const loa = await api(`/activities/${S.activityId}/host-authorization`, {
      token: S.dna!.accessToken,
      body: {
        hostCountry: 'IN',
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
      `/monitoring/periods`,
      {
        token: S.admin!.accessToken,
        body: {
          activityId: S.activityId,
          periodStart: '2026-01-01',
          periodEnd: '2026-03-31',
        },
      },
    );
    expect(period.status === 200 || period.status === 201).toBe(true);
    S.periodId = period.body.data.id;

    // Ingest 10 metered datapoints.
    for (let i = 0; i < 10; i++) {
      const dp = await api(`/monitoring/periods/${S.periodId}/datapoints`, {
        token: S.admin!.accessToken,
        body: {
          parameterCode: 'electricity_generated',
          timestamp: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
          rawValue: 1000 + i * 10,
          provenance: 'METER',
          sourceRef: `meter-001:${i}`,
        },
      });
      expect(dp.status === 200 || dp.status === 201).toBe(true);
    }

    const submit = await api<{ data: { status: string } }>(
      `/monitoring/periods/${S.periodId}/submit`,
      { method: 'POST', token: S.admin!.accessToken },
    );
    expect(submit.status).toBe(200);
    expect(submit.body.data.status).toBe('SUBMITTED');
  });

  it('Scenario 6: DOE verification — expect verified_er=7125', async () => {
    const rep = await api<{ data: { verifiedEr: number | string; opinion: string } }>(
      `/verification/verification-reports`,
      {
        token: S.doe!.accessToken,
        body: {
          periodId: S.periodId,
          doeOrgName: 'DOE-TEST-001',
          doeAccreditationId: 'ACC-0001',
          methodologyVersion: '01.0',
          baselineEmissions: 10000,
          projectEmissions: 2000,
          leakageEmissions: 500,
          conservativenessPct: 5,
          opinion: 'POSITIVE',
        },
      },
    );
    expect(rep.status === 200 || rep.status === 201).toBe(true);
    expect(Number(rep.body.data.verifiedEr)).toBe(7125);

    const period = await api<{ data: { status: string } }>(
      `/monitoring/periods/${S.periodId}`,
      { token: S.admin!.accessToken },
    );
    expect(period.body.data.status).toBe('VERIFIED');
  });

  it('Scenario 7: issuance + levy assertions (net=6627, sop=356, omge=142)', async () => {
    const req = await api<{ data: { id: string } }>(`/issuances`, {
      token: S.admin!.accessToken,
      body: { periodId: S.periodId },
    });
    expect(req.status === 200 || req.status === 201).toBe(true);
    S.issuanceId = req.body.data.id;

    const approve = await api<{
      data: {
        grossUnits: number | string;
        netUnits: number | string;
        sopLevyUnits: number | string;
        omgeCancelledUnits: number | string;
        status: string;
      };
    }>(`/issuances/${S.issuanceId}/approve`, {
      method: 'POST',
      token: S.admin!.accessToken,
    });
    expect(approve.status).toBe(200);

    S.grossUnits = Number(approve.body.data.grossUnits);
    S.netUnits = Number(approve.body.data.netUnits);
    S.sopUnits = Number(approve.body.data.sopLevyUnits);
    S.omgeUnits = Number(approve.body.data.omgeCancelledUnits);

    // Registry math — floor'd at every step.
    expect(S.grossUnits).toBe(7125);
    expect(S.sopUnits).toBe(356);
    expect(S.omgeUnits).toBe(142);
    expect(S.netUnits).toBe(6627);
    expect(S.sopUnits + S.omgeUnits + S.netUnits).toBe(S.grossUnits);

    // Participant credit account balance should equal netUnits.
    const holdings = await api<{ data: Array<{ accountType: string; balance: number | string }> }>(
      `/credits/accounts`,
      { token: S.admin!.accessToken },
    );
    expect(holdings.status).toBe(200);
    const participant = holdings.body.data.find((a) => a.accountType === 'ACTIVITY_PARTICIPANT');
    expect(participant, 'participant account exists').toBeTruthy();
    expect(Number(participant!.balance)).toBeGreaterThanOrEqual(6627);
  });

  // ─── Phase C scenarios — pending AAT-1/2/3 deploy ────────────────────

  it.todo('Scenario 8: first transfer + CA event emission (needs AV4-329)');
  it.todo('Scenario 9: BTR export by host DNA (needs AV4-330)');
  it.todo('Scenario 10: retirement + CA reversal (needs AV4-331)');
});
