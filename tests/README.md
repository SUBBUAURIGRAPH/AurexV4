# AurexV4 Test Harness

This directory and its siblings house the AurexV4 verification suite. The harness is layered: unit tests live next to the code, integration tests boot the API in-process, and deployment-time scans validate the live system. AV4-295 wired up the integration + OWASP baseline layers.

## Layers

| Layer | Package | Location | Driver |
|-------|---------|----------|--------|
| Unit | `@aurex/api` | `apps/api/src/**/*.test.ts` | vitest |
| Unit | `@aurex/web` | `apps/web/src/**/*.test.ts(x)` | vitest |
| Integration | `@aurex/integration-tests` | `tests/integration/src/**/*.test.ts` | vitest + supertest |
| OWASP Top 10 (code-level) | `@aurex/security-tests` | `tests/security/owasp-*.test.ts` | vitest |
| NGINX / HTTPS (live) | `@aurex/infra-tests` | `tests/infrastructure/nginx-https.test.ts` | vitest |
| OWASP ZAP (live) | n/a | `scripts/deploy/owasp-scan.sh` | Docker `zaproxy/zap-stable` |

## Running

### Unit tests

```bash
pnpm test              # turbo run test across every workspace
```

### Integration tests (in-process, no live DB required)

```bash
pnpm test:integration  # turbo run test --filter=@aurex/integration-tests
```

The integration harness imports `apps/api/src/index.ts` directly and drives it
via `supertest`. It mocks `@aurex/database` so tests do not need a running
Postgres. Current coverage:

- `GET /api/v1/health` -> 200 healthy
- `POST /api/v1/auth/login` with bogus creds -> 401
- `GET /api/v1/emissions` without Authorization -> 401

Broader DB-backed integration tests (full CRUD flows, auth + refresh, org
scoping) are tracked separately and will live in the same package under
`src/**/*.test.ts`.

### OWASP baseline (live URL)

```bash
TARGET_URL=https://aurex.in pnpm test:owasp:baseline
```

Pulls `zaproxy/zap-stable` and runs `zap-baseline.py` against the target.
Outputs `reports/owasp-report.json` and `reports/owasp-report.html`
(gitignored). Exit code 0 or 1 is a pass (warnings tolerated per ADM-056);
2+ is a hard failure.

### NGINX / HTTPS (ADM-057)

```bash
FRONTEND_URL=https://aurex.in API_URL=https://api.aurex.in pnpm test:nginx:all
```

Validates TLS, HSTS/CSP/X-Frame, proxy routing, and response latency against
the deployed stack. As of AV4-295 the missing `vitest.config.ts` is in place,
so the suite runs; it depends on the target being reachable.

## Known gaps

- The live `pnpm test:nginx:all` suite exercises the deployed environment only
  — we do not yet have a local nginx harness. The suite will fail if
  `FRONTEND_URL` / `API_URL` are unreachable or not yet deployed.
- `@aurex/security-tests` lacks a vitest config; `pnpm test:owasp:all` will
  still error until that is added (separate story).
- DB-backed integration flows (create/read/update emission, login with seeded
  user, refresh tokens) are not yet implemented — follow-up story after a
  disposable Postgres fixture lands.
