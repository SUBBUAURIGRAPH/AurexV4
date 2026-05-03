# AurexV4 AutoHeal — operator runbook

Three layers of failure handling for the production API on `aurex.in`.

| Layer | What it does | Where it runs | How to verify |
|---|---|---|---|
| L1 | Docker `restart: unless-stopped` on every service | `infrastructure/docker-compose.yml` on aurex.in | `docker inspect aurex-api --format '{{.HostConfig.RestartPolicy.Name}}'` returns `unless-stopped` |
| L2 | systemd user timer reads `docker inspect` health every minute; restarts `aurex-api` after 3 consecutive `unhealthy` reads | `~/.config/systemd/user/aurex-watchdog.timer` + `~/bin/aurex-watchdog.sh` (subbu@aurex.in) | `systemctl --user list-timers aurex-watchdog.timer` shows a future `NEXT` |
| L3 | systemd user timer curls `https://aurex.in/api/v1/health` end-to-end every minute | `~/.config/systemd/user/aurex-external-probe.timer` + `~/bin/aurex-external-probe.sh` | `tail ~/aurex-watchdog/external-probe.log` shows recent `OK 200` lines |

## L2 alerting (Mandrill / Slack)

Configured via `~/.aurex-watchdog.env` on the host (gitignored, never in
this repo). The watchdog script sources it and emits an alert when the
unhealthy threshold trips and a `docker restart aurex-api` is issued.

```bash
# ~/.aurex-watchdog.env on aurex.in
MANDRILL_API_KEY="md-..."
AUREX_ALERT_EMAIL="subscriptions@aurigraph.io"
AUREX_ALERT_FROM="noreply@aurex.in"
# Optional Slack-compatible webhook (POST {text}):
# AUREX_ALERT_WEBHOOK="https://hooks.slack.com/services/..."
```

Smoke-test the alert path without forcing a restart:

```bash
ssh -p 2244 subbu@aurex.in 'set -a; source ~/.aurex-watchdog.env; set +a; \
  curl -sS -X POST "https://mandrillapp.com/api/1.0/messages/send.json" \
  -H "Content-Type: application/json" \
  -d "{\"key\":\"$MANDRILL_API_KEY\",\"message\":{\"from_email\":\"$AUREX_ALERT_FROM\",\"to\":[{\"email\":\"$AUREX_ALERT_EMAIL\",\"type\":\"to\"}],\"subject\":\"L2 watchdog test\",\"text\":\"Synthetic alert.\"}}"'
```

## Operator-only follow-ups

The two items below need an interactive sudo session or an external SaaS
account that this repo cannot provision automatically.

### 1. Enable systemd linger for `subbu`

By default the user systemd manager on aurex.in tears down with the last
SSH session. The watchdog and probe timers are user units and would stop
firing during long no-SSH periods. Enable linger so they survive:

```bash
ssh -p 2244 subbu@aurex.in
sudo loginctl enable-linger subbu
loginctl show-user subbu | grep Linger   # expect: Linger=yes
```

After that, reboot or wait — `systemctl --user list-timers` should still
show the AurexV4 timers active even with no SSH session open.

### 2. Off-host monitor for L3 — J4C Agent watchdog

The `aurex-external-probe.timer` runs on aurex.in itself, so it cannot
catch full-host outages or external reachability regressions (e.g. ISP
loss, DNS resolver outage, certificate trust issue from a different
vantage). Replace this gap with the **J4C agent watchdog** — the same
one used by the deployment cascade, scheduled from a separate machine.

The agent (`scripts/j4c-agent.py`) is config-driven by `.j4c-agent.json`
and audits 6 sections in one pass: deploy SHA drift, expected
containers, HTTP endpoints, CSP, AutoHeal Layer 1/2/3, and Jira
project. Verdict is `PASS | PARTIAL | FAIL`; exit code matches.

**Two scheduling vectors ship in this repo — pick one, don't run both.**

#### Vector A — systemd user timer on dev4 (or any non-aurex.in host)

```bash
# One-time install on the off-host machine (e.g. dev4.aurigraph.io):
ssh -p 2227 subbu@dev4.aurigraph.io
mkdir -p ~/bin ~/aurex-j4c ~/.config/systemd/user

# (from local) copy the agent + config + wrapper + units
scp -P 2227 scripts/j4c-agent.py subbu@dev4:~/bin/
scp -P 2227 scripts/deploy/aurex-j4c-watchdog.sh subbu@dev4:~/bin/
scp -P 2227 .j4c-agent.json subbu@dev4:~/aurex-j4c/
scp -P 2227 scripts/deploy/systemd/aurex-j4c-watchdog.{service,timer} \
    subbu@dev4:~/.config/systemd/user/

# (back on dev4) make scripts executable + enable the timer
ssh -p 2227 subbu@dev4 '
  chmod +x ~/bin/j4c-agent.py ~/bin/aurex-j4c-watchdog.sh
  systemctl --user daemon-reload
  systemctl --user enable --now aurex-j4c-watchdog.timer
  systemctl --user list-timers aurex-j4c-watchdog.timer
'
```

Alert config (same env file pattern as the on-host watchdog):
`~/.aurex-watchdog.env` on dev4. Mode 600. Recognised vars:

| Var | Purpose | Default |
|---|---|---|
| `MANDRILL_API_KEY` | Mandrill HTTP API key (required for email) | — |
| `AUREX_ALERT_EMAIL` | recipient address | `subscriptions@aurigraph.io` |
| `AUREX_ALERT_FROM` | sender address | `noreply@aurex.in` |
| `AUREX_ALERT_WEBHOOK` | Slack-compatible webhook URL (optional) | — |
| **`AUREX_J4C_ALERT_ON`** | when to fire alerts: `fail` (only on verdict=FAIL) or `any` (also on PARTIAL) | `fail` |

> **Note on the alert-trigger flag**: the variable is `AUREX_J4C_ALERT_ON`,
> not `AUREX_ALERT_ON`. The script reads `AUREX_J4C_ALERT_ON`; setting
> `AUREX_ALERT_ON=any` will silently default to `fail` and you'll only
> get pages on hard failures.

#### Vector B — GitHub Actions scheduled workflow

`.github/workflows/j4c-watchdog.yml` runs the agent every 5 minutes on
a self-hosted runner. Set the GitHub Actions secrets the workflow
reads:

| Secret | Purpose | Required |
|---|---|---|
| `MANDRILL_API_KEY` | Mandrill HTTP API key | yes (for email alerts) |
| `AUREX_ALERT_EMAIL` | recipient | optional, defaults to `subscriptions@aurigraph.io` |
| `AUREX_ALERT_FROM` | sender | optional, defaults to `noreply@aurex.in` |
| `AUREX_ALERT_WEBHOOK` | Slack-compatible webhook | optional |

The `AUREX_J4C_ALERT_ON` value is hard-coded in the workflow (`'fail'`
default); change the workflow file if you want PARTIAL alerts via GHA.

Off-host caveat: works only if the self-hosted runner pool is **not**
on aurex.in (otherwise it's effectively on-host).

#### Manual one-shot (any host)

```bash
python3 scripts/j4c-agent.py doctor -v   # human-readable
python3 scripts/j4c-agent.py doctor      # JSON, exit code = verdict
```

## Maintenance

Tail logs:

```bash
ssh -p 2244 subbu@aurex.in 'tail -f ~/aurex-watchdog/watchdog.log ~/aurex-watchdog/external-probe.log'
```

Stop / restart the timers:

```bash
ssh -p 2244 subbu@aurex.in 'systemctl --user restart aurex-watchdog.timer aurex-external-probe.timer'
ssh -p 2244 subbu@aurex.in 'systemctl --user disable --now aurex-watchdog.timer aurex-external-probe.timer'
```

Manual fire (one-shot):

```bash
ssh -p 2244 subbu@aurex.in '~/bin/aurex-watchdog.sh && ~/bin/aurex-external-probe.sh'
```
