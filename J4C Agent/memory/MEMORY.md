# Claude Code Session Memory — J4C Agent Project

## #AAT MANDATORY: Use Concurrent Model, NOT Sequential Reviews
Phase 1 — concurrent via tmux (T=0): Maker + Checker (in-process) + QA (TDD plan from requirements)
Phase 2 — sequential: QA executes → Approver NFR Gate → /deploy

## /deploy = #ADM Components 5-6 (Updated Feb 18, 2026)

## J4C Portal Key Facts
- **Server**: j4c.aurigraph.io | **SSH**: `ssh -p 2225 subbu@j4c.aurigraph.io`
- **Repo**: `/Users/subbujois/subbuworkingdir/glowing-adventure`
- **Deploy dir on server**: `/opt/j4c-portal`
- **Runner**: `j4csrv-runner` (self-hosted, same server as production)
- Cassandra heap: MAX_HEAP_SIZE=512M (NOT 2G — server has 4GB RAM total)
- ALWAYS use `--force-recreate --remove-orphans` in all docker-compose up commands

## Critical Docker/NGINX Patterns (Feb 18, 2026)

### INS-021: Git Reset + Bind Mount Inode Staleness — CRITICAL
After `git reset --hard`, running containers with bind mounts still see the OLD file (old inode).
`nginx -s reload` does NOT help. Must `docker-compose up -d --force-recreate --no-deps nginx`.

### INS-022: Hairpin NAT — Self-Hosted Runner
Runner IS the prod server. `curl https://j4c.aurigraph.io/...` times out (exit 28) from within the server.
Fix: `curl --resolve "j4c.aurigraph.io:443:127.0.0.1"` in all smoke tests.

### INS-023: curl --resolve Variable Splitting — CRITICAL
NEVER store multiple --resolve values in a variable. Word splitting makes the 2nd value a URL arg.
Always inline: `--resolve "j4c.aurigraph.io:443:127.0.0.1"` per curl call.

### INS-024: Streamlit baseUrlPath
With `--server.baseUrlPath=/dashboard`:
- Health check: `http://127.0.0.1:8501/dashboard/_stcore/health` (NOT root /)
- NGINX proxy_pass: `http://j4c-streamlit:8501` (NO trailing slash — preserves /dashboard/ prefix)
- Trailing slash strips the path → Streamlit gets "/" instead of "/dashboard/" → 404

### INS-025: check_alive for CI Smoke Tests
Authenticated endpoints return 401 = service alive + auth enforced. Use check_alive (reject only 000/5xx).

### INS-027: NGINX ^~ for Multi-Backend Prefix Routes — CRITICAL
Without `^~`, regex `location ~* \.(js|css|png|...)$` beats prefix `location /dashboard/`.
Result: `/dashboard/static/css/*.css` routed to j4c-portal → served as `application/json` → browser blocks.
Fix: `location ^~ /dashboard/` → NGINX skips regex evaluation for all sub-paths.
Rule: Any prefix serving a different backend than the static asset regex MUST use `^~`.

### INS-026: --force-recreate Mandatory
`docker-compose up -d` without --force-recreate silently skips env var updates in running containers.

## Static Assets in j4c-portal Docker Image
homepage.html, index.html, privacy.html, terms.html, favicon.svg, styles.css must be
explicitly COPY'd in j4c-portal/Dockerfile. express.static(__dirname) serves /app but files
must be in the image.

## Smoke Test Pattern (Proven Working)
```bash
check() {
  STATUS=$(curl -sk --max-time 15 --resolve "j4c.aurigraph.io:443:127.0.0.1" \
    -o /dev/null -w "%{http_code}" "$1" || echo "000")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "301" ] || [ "$STATUS" = "302" ]; then
    echo "✅ $1 → $STATUS"; else echo "❌ $1 → $STATUS"; exit 1; fi
}
check_alive() {  # for authenticated APIs (accept any non-5xx/000)
  STATUS=$(curl -sk --max-time 15 --resolve "j4c.aurigraph.io:443:127.0.0.1" \
    -o /dev/null -w "%{http_code}" "$1" || echo "000")
  if [ "$STATUS" != "000" ] && [ "$STATUS" != "502" ] && [ "$STATUS" != "503" ] && [ "$STATUS" != "504" ]; then
    echo "✅ $1 → $STATUS"; else echo "❌ $1 → $STATUS"; exit 1; fi
}
```

## CI/CD Workflow Key Facts
- Self-hosted runner j4csrv-runner handles ALL workflows (deploy + CI + security + JIRA)
- Single runner = serialized execution — cancel non-critical runs before urgent deploys
- `git clean -fdx` WIPES .env — always backup: `cp .env /tmp/j4c-env-backup` before
- Wait 90s before smoke tests (Streamlit ONNX model download takes ~60s)
- Concurrency group: `j4c-deploy-docker` with cancel-in-progress: false

## Multiple CI Workflows Running Simultaneously
When pushing, these workflows ALL trigger on j4csrv-runner:
- Deploy J4C Portal (Docker) — the deploy
- Complete Test Pipeline, CI - Build Test & Quality, Security SAST, GitHub-JIRA Sync
Use `gh run cancel <id>` for non-deploy runs when deployment is urgent.

## J4C Insights Journal
Located at: `glowing-adventure/docs/J4C_INSIGHTS_JOURNAL.md`
27 insights (INS-001 to INS-027). Session #38 added INS-027 (^~ NGINX modifier).
Search: `grep -n "INS-02[1-6]" glowing-adventure/docs/J4C_INSIGHTS_JOURNAL.md`
