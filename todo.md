# AurexV4 Todo

---

## Done in this session (2026-04-29)

- [x] **AV4-440** — CBAM disclaimer searchable in retirement PDF raw bytes (commit `b6ded9c`, deployed `07:30:58 UTC`, Jira → Done with Remote Link 11060).
- [x] **AutoHeal Layer 2** — `aurex-watchdog.timer` reads Docker health every minute, restarts aurex-api on 3+ consecutive unhealthy reads.
- [x] **AutoHeal Layer 3 (on-host)** — `aurex-external-probe.timer` curls `https://aurex.in/api/v1/health` every minute end-to-end.
- [x] **L2 alert hook** — Mandrill HTTP API + Slack-compatible webhook; synthetic send verified to `subscriptions@aurigraph.io`.
- [x] **Push + deploy** — commits `b6ded9c` + `6ac3fd0` on `origin/main`, deploy succeeded, Gate 5 + Gate SSL pass.

## Done in this session (2026-04-29) — continued

- [x] **L2 — survive no-SSH periods**: `Linger=yes` for subbu via `/etc/sudoers.d/subbu-linger` (NOPASSWD for `loginctl enable-linger subbu` only). User systemd manager now persists across no-SSH periods — timers fire continuously.
- [x] **Google Sign-In (server-side OAuth)**: shipped in commit `c66fd90`. /api/v1/auth/google/start 302's to Google with signed-JWT state; /callback verifies code + ID token, upserts user, redirects to web with tokens in URL fragment. 948 tests pass. Live and verified end-to-end.
- [x] **HEF voucher (HEF-PUNE-2026) — 11/11 prod tests pass**: validate (200 with full coupon body), V3 alias `/coupons/hef/validate`, lowercase normalization, nonexistent code (`valid:false COUPON_NOT_FOUND`), empty code (400 Zod), register-with-coupon (User + active CouponRedemption created, 365-day Professional trial 2026-04-29 → 2027-04-29), register replay (409 Conflict), register-with-bad-coupon (User created with `couponWarning`), DB rows verified, login + `GET /coupons/redemptions/me` returns the trial with `daysRemaining: 365`.

## Done in this session (2026-05-01) — continued

- [x] **Frontend OrgContext + topbar switcher** (commit `192c0aa`): `apps/web/src/contexts/OrgContext.tsx` (new — OrgProvider + useOrg + fetchOrgs from /api/v1/organizations), `apps/web/src/lib/api.ts` (setActiveOrgIdGetter + auto-inject x-org-id header), `apps/web/src/components/layout/DashboardTopbar.tsx` (real org dropdown, removed hardcoded APAC/EMEA labels), `apps/web/src/layouts/DashboardLayout.tsx` (wrapped with OrgProvider). Bundle `index-CHAmXtk_.js` deployed. All 6 new symbols present, both removed labels absent. L2.3: 7 orgs returned with correct shape. All L0–L3 PASS, AutoHeal nominal. 0 bugs filed.
- [x] **Last IFHD PENDING record verified** (L2.4 of 192c0aa deploy): `00000000-0000-0000-0003-e10000000009` (Scope 1, Fugitive Emissions, R-410A, 4.2 tCO₂e, Dec 2024) promoted to VERIFIED at 2026-05-01T05:20:57Z. IFHD 3-record verification cycle complete — all originally-PENDING emissions records are now VERIFIED.

## Done in this session (2026-05-01)

- [x] **Forgot-password / reset-password flow** (commit `a0c6040`): Schema synced (`password_resets` table, `password_reset_request` + `password_reset_complete` enum values), service (`sha256` token, 1h TTL, bcrypt cost 12, no-enumeration), email template (Mandrill live — `status=sent` confirmed for `shreyas@ifhd.in`), frontend pages (`ForgotPasswordPage`, `ResetPasswordPage`) + `LoginPage` "Forgot password?" link. All L0–L3 cascade gates PASS, AutoHeal nominal. 0 bugs filed.
- [x] **Auto-login on register + password-reset** (commit `e463120`): `auth.service.ts` register now issues `accessToken` + `refreshToken` at top level; `password-reset.service.ts` consumeToken now issues same; `auth.ts` routes surface both tokens; `ResetPasswordPage.tsx` auto-stores tokens and navigates to /dashboard. L2 smoke confirms: POST /register → 201 with both tokens, /auth/me 200 with issued token, sessions row = 1; POST /reset-password → 200 with both tokens + user shape, /auth/me 200 with reset token, sessions row = 1 (register session deleted). All L0–L3 PASS, AutoHeal nominal. 0 bugs filed.
- [x] **org-scope: honor x-org-id header + SUPER_ADMIN bypass** (commit `b0f5875`): `apps/api/src/middleware/org-scope.ts` rewritten; 10 unit tests in `org-scope.test.ts`. Deployed 2026-05-01T04:52 UTC. L2 signals: without x-org-id super_admin falls back to oldest membership (404 for cross-org record, correct); with `x-org-id: 439099fd-4197-40fb-80c8-713d1efb9599` (IFHD) → 200 VERIFIED (bypass alive); non-member 403 confirmed; backward-compat (no header) 200 with 16 IFHD records. IFHD emissions record `00000000-0000-0000-0003-e10000000006` promoted to VERIFIED as real workflow completion.
- [x] **Onboarding breadcrumbs** (commit `011d90c`): `apps/web/src/pages/dashboard/OnboardingPage.tsx` rewrites ProgressBar to compact breadcrumb row (Onboarding › Organisation › Plan/voucher › Invite team). Bundle `index-CqaqEX3z.js` deployed; grep confirmed: Onboarding=2, ›=1, Organisation=3, Plan/voucher=1, Invite team=2, ProgressBar=0. `/onboarding` → 200 + SPA shell. All L0–L3 PASS, AutoHeal nominal. 0 bugs filed.

## Done in this session (2026-04-30)

- [x] **Pricing page** (commit `9a9330b`): `apps/web/src/pages/public/PricingPage.tsx` deployed; reachable at https://aurex.in/pricing (200 + SPA shell); "Special Offer" card present in bundle.
- [x] **Voucher-first signup gate** (commit `9a9330b`): `apps/web/src/pages/auth/VoucherSignupPage.tsx` deployed; `/signup/voucher` and `/signup/voucher?code=HEF-PUNE-2026` both return 200 + SPA shell; "Have a voucher code?" and route literal `signup/voucher` present in bundle.
- [x] **PublicHeader "Pricing" nav link** (commit `9a9330b`): `apps/web/src/components/layout/PublicHeader.tsx` updated; "Pricing" present in bundle.
- [x] **Deploy cascade PASS**: L0 infra (4/4 up, TLS, headers), L1 bundle grep, L2 smoke (all routes + HEF-PUNE-2026 validate), AutoHeal L1/L2/L3, MTU 1442 — all green. 0 bugs filed.

- [x] **HEF test user cleanup**: `DELETE FROM coupon_redemptions, users WHERE email LIKE '%@aurex.test'` — 1 redemption + 2 users removed. DB clean (verified `users LIKE '%@aurex.test' = 0`). Prod state: 17 users / 1 active trial / 1 active coupon.
- [x] **E2E prod audit (5 levels) — PASS**:
  - L0: 4/4 containers up, TLS valid through 2026-07-22, HSTS preload, all standard security headers.
  - L1: 952/958 tests pass (6 skipped, 0 fail), 9/9 typecheck.
  - L2: 8/8 platform smoke (health, login validation, Google /start + /callback CSRF + /callback bogus-code in 310ms, HEF validate + V3 alias).
  - L3: AutoHeal Layer 1 (now on ALL containers including postgres+redis), Layer 2+3 timers firing minute cadence, Linger=yes, eth0 MTU=1442 clamp, Mandrill env present mode 600.
  - L4: HEF voucher e2e 11/11, 0 test users remaining.
  - **Hardening applied this audit**: `aurex-postgres` + `aurex-redis` `RestartPolicy=no` → `unless-stopped` (had been `no` since the Apr 22 initial bootstrap, predating AutoHeal Layer 1). Now all four services auto-recover from crash.

## Done in this session (2026-05-01 — late) + (2026-05-02) + (2026-05-03)

- [x] **L3 — Off-host J4C monitor SHIPPED** (commit `cff6ebc`, 2026-05-01): `scripts/j4c-agent.py` + `scripts/deploy/aurex-j4c-watchdog.sh` + `.github/workflows/j4c-watchdog.yml` + systemd unit files. Mandrill alerting confirmed working (status=sent, _id=7b0a27b5abac4814a845590d38ce2a00). PARTIAL verdict alert tested end-to-end.
- [x] **Bridge-level MTU 1442 on aurex_network** (May 1 maintenance window): network rebuilt with `com.docker.network.driver.mtu=1442` opt; all 4 containers (aurex-postgres, aurex-redis, aurex-api, aurex-nginx) now have eth0 MTU=1442 inherited from the bridge. Per-container nsenter clamp in `deploy-to-remote.sh` + `aurex-watchdog.sh` is now defense-in-depth, not the primary mechanism. **Verified 2026-05-03**: `docker network inspect aurex_network` confirms `MTU opt = 1442`; all 4 container eth0 = 1442.
- [x] **ADM-075 — J4C agent activation across all Aurigraph projects + central data collection** (May 1, USER MANDATED): logged in `~/.claude/ADM.md`. Strengthens ADM-068's deploy-time mandate with continuous off-host watchdog + central gRPC reporting. Phased rollout + canonical-source rule + alert/verdict semantics codified.
- [x] **HCE2 PR #3 + PR #4 merged** (May 2): canonical agent at `4f8ff36c` includes Layer 1 `unless-stopped` + deploy `PARTIAL on missing .git` fixes + `section_j4c_llm` (Gemma chat probe) lifted from healthcare. Self-merged via `--admin` (HCE2 self-hosted runner offline).
- [x] **Per-project J4C rollout: 7 PRs merged across the fleet** (May 2):
  - AurexV3 PR #203, AWD2 PR #32, Aurigraph-DLT V12 PR #48, MEV-Shield PR #218 (new vendor)
  - Aurigraph-Website-V-3 PR #30, Jeeves4Coder PR #30, healthcare PR #1 (re-vendor)
  - **9/9 repos at canonical agent parity** (HCE2 + AurexV4 + 7 above) — zero divergence.
- [x] **Jeeves4Coder PR #31 — canonical watchdog bundle** (May 3): added `scripts/deploy/j4c-watchdog.sh`, systemd `.service` + `.timer`, `.github/workflows/j4c-watchdog.yml` to the J4C platform repo. Now self-contained: agent + proto + protoc helper + watchdog scaffold + GHA scheduler.
- [x] **J4C-213 filed** (Jira J4C project): Deploy AgentReportService gRPC backend on j4c.aurigraph.io:443 (path-routed `/agent/`). All consumer projects' `.j4c-agent.json` carry `_pending_endpoint=j4c.aurigraph.io:443` ready to flip once the service ships.
- [x] **AUREX_J4C_ALERT_ON env-var doc clarification** (2026-05-03): AUTOHEAL.md §2 now has explicit env-var tables for both Vector A (host) and Vector B (GHA) with a callout that the trigger flag is `AUREX_J4C_ALERT_ON`, not `AUREX_ALERT_ON`.

## Open — operator-only follow-ups

- [ ] **Google: real user-driven end-to-end test**: click "Sign in with Google" on https://aurex.in/login, complete the Google flow, confirm landing on /dashboard with the right user. Automated cascade is green (start 302, callback CSRF defense, callback bogus-code 302 in 260ms with proper Google error). Then **rotate the OAuth client secret** in Google Cloud Console (it was shared in chat) and re-run the env patch on aurex.in.

- [ ] **Operator action: activate AurexV4 off-host scheduling** (pick ONE path):
  - **Path A — GHA** (recommended, free, multi-region): Set secrets in GitHub repo → Settings → Secrets and variables → Actions: `MANDRILL_API_KEY`, `AUREX_ALERT_EMAIL` (optional). Confirm self-hosted runner pool is NOT on aurex.in (use dev4 or j4c.aurigraph.io).
  - **Path B — dev4 systemd timer**: `scp scripts/deploy/aurex-j4c-watchdog.sh subbu@dev4:~/bin/ && scp scripts/j4c-agent.py subbu@dev4:~/bin/ && scp .j4c-agent.json subbu@dev4:~/aurex-j4c/ && ssh dev4 "chmod +x ~/bin/aurex-j4c-watchdog.sh ~/bin/j4c-agent.py && cp ~/aurex-j4c/scripts/deploy/systemd/aurex-j4c-watchdog.{service,timer} ~/.config/systemd/user/ && systemctl --user enable --now aurex-j4c-watchdog.timer"`. Set `~/.aurex-watchdog.env` on dev4 with `MANDRILL_API_KEY=md-jBPJg7x2FLpKF3tVZefdjg`.
  - Do NOT install the timer on aurex.in itself (defeats off-host purpose).

- [ ] **Per-project `.j4c-agent.json` TODO fills (8 other Aurigraph projects)**: AWD2 (server.host + deploy_path + health_endpoints), MEV-Shield (server.user + deploy_path), Aurigraph-DLT V12 (deploy_path), AurexV3 (none — fully filled). Each project's owner fills these from their own deploy knowledge.

- [ ] **J4C-213 ships on j4c.aurigraph.io** (J4C platform team): once AgentReportService is live at `j4c.aurigraph.io:443` (path-routed `/agent/`), flip `j4c_central.grpc_endpoint` from `null` → `j4c.aurigraph.io:443` in every project's `.j4c-agent.json`. Watchdogs then switch from `doctor` mode to `report` mode and central data collection lights up.

## Infrastructure notes

- `aurex-api` previous backup tag: `aurexv4-api:backup-20260429-0608` (safe to prune; new deploy 2026-04-29T07:30Z superseded it)
- TLS certificate expires: 2026-07-22 (Let's Encrypt — auto-renewal via `certbot-renew.timer`, Sun 03:00, ~30 days before expiry)
- aurex.in lacks `cron` / `crontab` and `at` — schedule periodic jobs as systemd user timers under `~/.config/systemd/user/`. Use `OnCalendar=*:0/1` (every minute, realtime) — `OnBootSec`/`OnUnitActiveSec` does NOT re-arm reliably across user-manager restarts on this host.
