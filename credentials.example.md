# Credentials (example template)

**This file is safe to commit.** It documents every secret or environment value the project expects.

1. Copy to a local file ignored by git:

   ```bash
   cp credentials.example.md credentials.md
   ```

2. Fill in `credentials.md` (never committed). Optionally paste values from `~/AurexV3/AurexV3` `.env` files or from `.credentials-aurexv3-import/aurexv3-mirror/` after a local import.

---

## Jira / Atlassian

- **Board**: https://aurigraphdlt.atlassian.net/jira/software/projects/AV4/boards/1450
- **Site**: `https://aurigraphdlt.atlassian.net`
- **User email**: `<your-atlassian-email>`
- **API token**: `<create at https://id.atlassian.com/manage-profile/security/api-tokens>`
- **Project key (e.g. AV4)**: `<JIRA_PROJECT_KEY>`
- **Epic Link custom field id** (if using `scripts/jira/seed_backlog.py`): `<e.g. customfield_10014>`

After copying this file to `credentials.md`, add shell exports, then push the full WBS backlog:

```bash
python3 scripts/jira/wbs_to_backlog.py   # refresh scripts/jira/backlog_seed.json from docs/WBS_*.md
export JIRA_BASE_URL="https://aurigraphdlt.atlassian.net"
export JIRA_USER_EMAIL="…"
export JIRA_API_TOKEN="…"
export JIRA_PROJECT_KEY="AV4"
# export JIRA_EPIC_LINK_FIELD="customfield_…"
python3 scripts/jira/seed_backlog.py --dry-run
python3 scripts/jira/seed_backlog.py --epic-link-field "${JIRA_EPIC_LINK_FIELD:-}"
```

**Backfill / update existing issues from `backlog_seed.json`** (recommended after WBS changes — does not create duplicates):

```bash
python3 scripts/jira/wbs_to_backlog.py
python3 scripts/jira/sync_backlog_from_seed.py --dry-run
python3 scripts/jira/sync_backlog_from_seed.py --apply
# Optional: refresh description text from seed when summary already matches:
# python3 scripts/jira/sync_backlog_from_seed.py --apply --refresh-descriptions
```

---

## OpenBao (J4C) — KMS / secrets

J4C: **OpenBao is the KMS** (key management and application secrets: Vault-API, KV, transit, etc.). It is **not** the container image registry (that is **Harbor** — see below).

- **API base (Vault-API)**: `https://j4c.aurigraph.io/openbao` — J4C org OpenBao; set as `OPENBAO_ADDR` (no trailing slash). Requests are `${OPENBAO_ADDR}/v1/...`.
- **Token** — `OPENBAO_TOKEN` or `VAULT_TOKEN` (same header as Vault: `X-Vault-Token`).

```bash
export OPENBAO_ADDR="https://j4c.aurigraph.io/openbao"
export OPENBAO_TOKEN="…"
# optional: OPENBAO_KV_MOUNT=secret  OPENBAO_KV_DATA_PATH=aurex/api
```

## Harbor (J4C) — Docker / OCI image registry

J4C: **Harbor is the Docker image registry** (push/pull OCI images for `aurexv4-api`, `aurex-web`, and related builds). It does **not** store application key material like OpenBao; use **separate** Harbor robot accounts or `docker login` credentials for CI and hosts.

- **Harbor base (Aurigraph J4C)**: `https://j4c.aurigraph.io/harbor` — UI / API (constant `AURIGRAPH_J4C_HARBOR_BASE` in `apps/api/src/lib/j4c-platform.ts`).
- **Image names** for `docker push` / K8s `image:` are usually the registry hostname and project (e.g. `j4c.aurigraph.io/<project>/aurexv4-api:<tag>`); match what Harbor shows under your project, which may differ from the `/harbor` path used for the web UI.

---

## GitHub

- **User / org**: `<owner>`
- **PAT** (repo + packages if needed): `<ghp_...>`

---

## Application & database (Aurex / monorepo)

Use the same names as `.env.example` in the repo you are working on. Examples:

- `DATABASE_URL`
- `DIRECT_URL` (if Prisma)
- `REDIS_URL`
- `JWT_SECRET` / `JWT_REFRESH_SECRET` (or RS256 keys path)
- `SESSION_SECRET`
- `VITE_*` public vs server-only keys

---

## Email (e.g. SendGrid)

- `SENDGRID_API_KEY`
- From address / domain verification notes

---

## Google Deep Research (Gemini) — AAT-DEEPRESEARCH

Powers the weekly external regulatory landscape scan
(`.github/workflows/gemini-regulatory-research.yml`) and the on-demand
`POST /api/v1/admin/research/run` endpoint. Counterpart to the internal
Claude-driven spec-compliance pipeline (AV4-405 / AAT-405).

- **API key (preferred name)**: `GOOGLE_AI_API_KEY`
- **API key (alias, also accepted)**: `GEMINI_API_KEY`
- **Where to get one**: https://aistudio.google.com/apikey — standalone Gemini API key, NO Google Cloud project required.
- **Optional model overrides**:
  - `GEMINI_QUICK_MODEL` (default `gemini-2.5-flash`)
  - `GEMINI_STANDARD_MODEL` (default `gemini-2.5-pro`)
  - `GEMINI_DEEP_RESEARCH_MODEL` (default `gemini-2.5-pro-deep-research` — set to `gemini-2.5-pro` if your tier doesn't have deep-research access)
- **Mock mode for local/test**: `GEMINI_MOCK_MODE=1` — returns deterministic stub findings, no HTTP call.
- **GitHub Actions secret** (for the weekly workflow): `AUREX_ADMIN_TOKEN` — a long-lived super-admin JWT issued out-of-band and rotated every 90 days. Used to call `https://aurex.in/api/v1/admin/research/run`.

See `docs/REGULATORY_RESEARCH_AUTOMATION.md` for the full runbook.

---

## SSL / TLS (optional — Aurex.in / edge nginx)

**Prefer paths to PEM files** on the machine that terminates HTTPS (e.g. after **Certbot**). Do **not** paste full certificate or private-key PEM bodies into this file; use a vault or files under `/etc/letsencrypt/` (or your CA layout) and reference them here for your own `source` / copy-paste.

| Field | Value |
| --- | --- |
| Primary hostname | `aurex.in` (and SANs such as `www`, `api` if one cert covers them) |
| Full chain (certificate + intermediates) | `<absolute path, e.g. /etc/letsencrypt/live/aurex.in/fullchain.pem>` |
| Private key | `<absolute path, e.g. /etc/letsencrypt/live/aurex.in/privkey.pem>` |
| Optional: chain only (rare) | `<path or leave empty>` |

Shell exports (local tooling or server-side scripts that read env from your notes):

```bash
# Paths only — readable by the user that runs nginx/docker on that host
export AUREX_SSL_CERT_PATH="/etc/letsencrypt/live/aurex.in/fullchain.pem"
export AUREX_SSL_KEY_PATH="/etc/letsencrypt/live/aurex.in/privkey.pem"
# Optional: if you use a separate DH params file
# export AUREX_SSL_DHPARAM_PATH="/etc/nginx/ssl/dhparam.pem"
```

**On the server**, after DNS points to the host, issue or renew certs with Certbot (example):

```bash
sudo certbot certonly --nginx -d aurex.in -d www.aurex.in -d api.aurex.in
# or: sudo certbot --nginx -d aurex.in -d www.aurex.in -d api.aurex.in --redirect
```

Then point `nginx` `ssl_certificate` / `ssl_certificate_key` at the same paths you set in `AUREX_SSL_*`, or run the AurexV3 helper `scripts/server/fix-aurex-https-connection.sh` and follow its **certbot** hint.

---

## Cloud / infra (optional)

- AWS access key id / secret (prefer IAM roles in prod)
- Kubernetes kubeconfig path (local only)
- Terraform cloud token

---

## Tools

- SonarQube / SonarCloud token
- MCP / CI tokens

---

## Notes

- Rotate keys if they were ever committed by mistake.
- Prefer a password manager or team vault for sharing; `credentials.md` is for **your machine only**.
- **SSL**: keep private keys out of git and out of long-lived chat logs; store **paths** in `credentials.md`, not PEM text.
