# AurexV4 — Project CLAUDE.md

## Overview
AurexV4 is the greenfield rebuild of the Aurex Sustainability & Environmental Intelligence Platform.
Monorepo architecture with pnpm workspaces + Turborepo.

## Quick Start
```bash
pnpm install          # Install all dependencies
pnpm dev              # Start all apps in dev mode
pnpm build            # Build all packages and apps
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm typecheck        # TypeScript check all packages
```

## Monorepo Structure
```
apps/api/             # Node/Express API (port 3001)
apps/web/             # React/Vite frontend (port 3000)
packages/shared/      # Shared types, schemas, constants
packages/database/    # Prisma client + migrations
packages/aurex-theme-kit/  # Design tokens + ThemeProvider
infrastructure/       # nginx, Docker configs
tests/security/       # OWASP security test suite
tests/infrastructure/ # nginx/HTTPS validation tests
scripts/deploy/       # Deployment scripts + gating
scripts/jira/         # Jira automation
```

## Package Manager
**pnpm only** (ADM-033). Never use npm or yarn.

## ADM Compliance
All code must comply with applied ADMs. Key ones for daily development:

| ADM | Rule |
|-----|------|
| ADM-033 | pnpm everywhere — Dockerfiles, CI, dev |
| ADM-040 | Auth rate limiting: separate check vs record vs clear |
| ADM-041 | No CSRF double-submit; rely on CORS + JWT + SameSite |
| ADM-042 | Single-bundle production builds (inlineDynamicImports) |
| ADM-043 | Deploy web to HOST path, not inside container |
| ADM-052 | Security headers, SSRF protection, input validation, RFC 7807 errors |
| ADM-053 | Push-deploy-everything: commit + push + deploy + update Jira |
| ADM-054 | HTTPS via Let's Encrypt, auto-renewal, TLS 1.2+ |
| ADM-055 | 8-gate pre/post deployment checklist |
| ADM-056 | OWASP testing after every build |
| ADM-057 | nginx/HTTPS validation after every deployment |

## Security
- No hardcoded credentials — use .env (gitignored)
- Security headers middleware on every response
- SSRF protection: private IP blacklisting
- Input validation: Zod schemas from @aurex/shared
- Rate limiting: sliding window, separate auth failure tracking
- OWASP test suite: `pnpm test:owasp:all`

## Deployment
```bash
pnpm deploy:pre-check              # ADM-055 gates 1-4
./scripts/deploy/deploy-to-remote.sh  # Build + deploy + verify
pnpm deploy:post-check             # ADM-055 gates 5-8
pnpm test:nginx:all                # ADM-057 HTTPS validation
```

## Testing
```bash
pnpm test                          # Unit + integration
pnpm test:owasp:all               # OWASP Top 10
pnpm test:owasp:critical          # Critical security only
pnpm test:nginx:all               # Infrastructure
pnpm test:security:all            # OWASP + nginx combined
```

## Jira
Board: https://aurigraphdlt.atlassian.net/jira/software/projects/AV4/boards/1450
```bash
python3 scripts/jira/progress_bar.py              # Check progress
python3 scripts/jira/wbs_to_backlog.py            # Regenerate backlog_seed.json from WBS
python3 scripts/jira/sync_backlog_from_seed.py --dry-run   # Preview Jira updates from seed
python3 scripts/jira/sync_backlog_from_seed.py --apply      # Update matched issues (summary/description)
python3 scripts/jira/seed_backlog.py              # Initial create only — duplicates if board exists
```

## CI/CD
GitHub Actions on self-hosted runners (never ubuntu-latest).
Pipeline: lint → test → build → OWASP → deploy → post-deploy validation.

## Conventions
- Commits: conventional commits (feat/fix/docs/security/...)
- Errors: RFC 7807 Problem Detail format
- API: versioned under /api/v1/
- Types: strict TypeScript, no `any`
- Coverage target: 85% backend, 80% frontend

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
