---
name: j4c-adm
description: >-
  Applies Aurigraph Jira-4-Carbon (J4C) ADM rules for AurexV4 — package manager,
  auth, security, deploy, and validation gates. Use when the user mentions J4C,
  ADM, ADM-0xx, compliance gates, push-deploy, OWASP, nginx validation, pnpm
  only, or Jira + deployment traceability for carbon / BioCarbon / AV4 work.
---

# J4C ADM (Aurigraph)

**J4C** here means **Jira (AV4) + Carbon / compliance workstreams** governed by **ADM** (Aurigraph deployment & compliance memos). When this skill applies, treat ADMs as **hard constraints** unless the user explicitly supersedes them.

**Canonical project reference:** `CLAUDE.md` (root). Prefer quoting ADM numbers in commits/PRs when touching the affected area.

## Core ADM table (AurexV4 daily)

| ADM | Rule |
|-----|------|
| ADM-033 | **pnpm only** — Dockerfiles, CI, local dev. Never npm or yarn. |
| ADM-040 | Auth rate limiting: separate check vs record vs clear. |
| ADM-041 | No CSRF double-submit; CORS + JWT + SameSite. |
| ADM-042 | Single-bundle production web builds (`inlineDynamicImports` / Vite config). |
| ADM-043 | Deploy web to **host path**, not only inside the container. |
| ADM-052 | Security headers, SSRF protection, Zod input validation, **RFC 7807** errors. |
| ADM-053 | **Push-deploy-everything**: commit + push + deploy + update Jira. |
| ADM-054 | HTTPS (Let’s Encrypt, renewal), TLS 1.2+. |
| ADM-055 | **8-gate** pre/post deployment checklist. |
| ADM-056 | **OWASP** tests after every build (see `tests/security/`, `pnpm test:owasp:*`). |
| ADM-057 | **nginx/HTTPS** validation after deployment (`pnpm test:nginx:all`). |

## Extended ADMs (seen in this repo)

- **ADM-058** — Multi-track / parallel AAT (e.g. SPARC cadence in `docs/BIOCARBON_SPARC_PLAN.md`). Do not compress timelines without calling out resource assumptions.
- **ADM-060** — **Deploy contract**: do not deploy uncommitted work; `main` on remote must match what runs. Align with `.claude/commands/deploy.md` (commit → push → deploy pipeline).
- **ADM-055/056** in auth/UX: route guards, audit, error UX — see WBS references in `docs/WBS_AUREXV4_GREENFIELD.md`.

## Agent behavior

1. **Tooling** — If a command uses `npm`/`yarn` for this monoreop, **correct to pnpm** (ADM-033).
2. **API errors** — Prefer RFC 7807 **Problem** shape; validate with Zod in `@aurex/shared` (ADM-052).
3. **Deploy / release** — Remind: pre-check (`pnpm deploy:pre-check`), post-check (`pnpm deploy:post-check`), nginx tests when infrastructure changes (ADM-055, 057).
4. **Security changes** — Call out OWASP / header tests (ADM-052, 056, 057).
5. **Jira** — AV4 board: `https://aurigraphdlt.atlassian.net/jira/software/projects/AV4/boards/1450`. Traceability: commits ↔ deploy ↔ tickets where applicable (ADM-053).

## If ADMs conflict

Prefer **safety and traceability** (security, no silent deploys, no wrong package manager). Ask the user only when the conflict is product-level, not for skipping ADM-033/052/055 on AurexV4 work.

## Optional: enrich this skill

If your org has a separate **J4C ADM** PDF or Confluence page, add a one-line link under `reference.md` in this folder so the agent can read it for numbers not listed here.
