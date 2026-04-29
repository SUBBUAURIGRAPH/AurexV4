#!/usr/bin/env bash
#
# AurexV4 — Layer 3 external health probe (AV4-440 follow-up).
#
# Curls https://aurex.in/api/v1/health from a separate process so the full
# DNS → TLS → nginx → container chain is exercised end-to-end. On non-200
# the probe logs a CRITICAL line; cron-mailx will surface that to subbu's
# mail spool if local mail is configured.
#
# This is "external in path" but still on-box — a true off-host monitor
# (UptimeRobot, BetterStack, Grafana Synthetic) should replace this when
# we provision a second probe vantage. Until then this catches: expired
# cert, nginx misconfig, DNS regression, container 5xx.
#
# Install:
#   scp this script to subbu@aurex.in:~/bin/aurex-external-probe.sh
#   chmod +x ~/bin/aurex-external-probe.sh
#   crontab -e   # add: */1 * * * * /home/subbu/bin/aurex-external-probe.sh
set -euo pipefail

URL="https://aurex.in/api/v1/health"
STATE_DIR="${HOME}/aurex-watchdog"
LOG_FILE="${STATE_DIR}/external-probe.log"
TIMEOUT=5

mkdir -p "${STATE_DIR}"

log() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [aurex-external-probe] $*" >> "${LOG_FILE}"
}

response="$(curl -sS -o /tmp/aurex-probe.body -w '%{http_code} %{time_total}' \
  --max-time "${TIMEOUT}" "${URL}" 2>&1 || echo "000 curl-error")"

http_code="${response%% *}"
time_total="${response#* }"

if [[ "${http_code}" == "200" ]]; then
  body="$(head -c 200 /tmp/aurex-probe.body 2>/dev/null || true)"
  if echo "${body}" | grep -q 'healthy'; then
    log "OK ${http_code} ${time_total}s"
  else
    log "DEGRADED ${http_code} ${time_total}s body=${body}"
  fi
else
  log "CRITICAL ${http_code} ${time_total}s url=${URL}"
fi

rm -f /tmp/aurex-probe.body
