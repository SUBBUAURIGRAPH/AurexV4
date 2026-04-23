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
