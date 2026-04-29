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

### 2. Off-host external monitor for L3

The `aurex-external-probe.timer` runs on aurex.in itself, so it cannot
catch full-host outages or external reachability regressions (e.g. ISP
loss, DNS resolver outage, certificate trust issue from a different
vantage). Add an off-host monitor — UptimeRobot is the lightest option:

1. Sign in at https://uptimerobot.com/dashboard.
2. **Add New Monitor** → Monitor Type **HTTP(s)**.
3. Friendly name: `AurexV4 — aurex.in /api/v1/health`.
4. URL: `https://aurex.in/api/v1/health`.
5. Monitoring interval: 5 minutes (free tier) or 1 minute (paid).
6. Alert contacts: subscriptions@aurigraph.io.
7. **Advanced** → Keyword Monitoring → expect string `healthy`.
8. Save.

Equivalent setups work in BetterStack, Pingdom, Grafana Synthetic, or any
multi-region uptime probe.

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
