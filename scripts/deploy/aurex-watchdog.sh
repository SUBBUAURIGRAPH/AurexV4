#!/usr/bin/env bash
#
# AurexV4 — Layer 2 watchdog (AV4-440 follow-up).
#
# Reads Docker's built-in healthcheck status for `aurex-api`. After 3
# consecutive `unhealthy` reads (≈3 minutes when run by a 1-minute cron),
# restarts the container. Resets the counter on any `healthy` read.
#
# Logs every action to ~/aurex-watchdog/watchdog.log. Stateless across
# container restarts — uses a counter file in ~/aurex-watchdog/.
#
# Optional alerting (env vars, sourced from ~/.aurex-watchdog.env if it
# exists — keep secrets there, never in this repo):
#   MANDRILL_API_KEY    — if set, sends an email via Mandrill HTTP API
#   AUREX_ALERT_EMAIL   — recipient (default: subscriptions@aurigraph.io)
#   AUREX_ALERT_FROM    — sender    (default: noreply@aurex.in)
#   AUREX_ALERT_WEBHOOK — if set, POSTs JSON {text} to this URL (Slack-compatible)
#
# Install:
#   scp this script to subbu@aurex.in:~/bin/aurex-watchdog.sh
#   chmod +x ~/bin/aurex-watchdog.sh
#   systemctl --user enable --now aurex-watchdog.timer
set -euo pipefail

# Load optional alert config (Mandrill key, webhook URL, etc.)
if [[ -f "${HOME}/.aurex-watchdog.env" ]]; then
  # shellcheck disable=SC1090,SC1091
  source "${HOME}/.aurex-watchdog.env"
fi

CONTAINER="aurex-api"
STATE_DIR="${HOME}/aurex-watchdog"
COUNTER_FILE="${STATE_DIR}/unhealthy_count"
LOG_FILE="${STATE_DIR}/watchdog.log"
THRESHOLD=3

mkdir -p "${STATE_DIR}"

log() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [aurex-watchdog] $*" >> "${LOG_FILE}"
}

# Send an alert via Mandrill (email) and/or Slack-compatible webhook.
# Best-effort — failures are logged but never block the restart action.
alert() {
  local subject="$1"
  local body="$2"
  local hostname
  hostname="$(hostname 2>/dev/null || echo unknown)"

  if [[ -n "${AUREX_ALERT_WEBHOOK:-}" ]]; then
    local payload
    payload=$(printf '{"text":"[aurex-watchdog %s] %s\n%s"}' \
      "${hostname}" "${subject}" "${body}")
    curl -sS -m 8 -o /dev/null -X POST -H 'Content-Type: application/json' \
      --data "${payload}" "${AUREX_ALERT_WEBHOOK}" \
      && log "alert webhook posted" \
      || log "alert webhook FAILED"
  fi

  if [[ -n "${MANDRILL_API_KEY:-}" ]]; then
    local to="${AUREX_ALERT_EMAIL:-subscriptions@aurigraph.io}"
    local from="${AUREX_ALERT_FROM:-noreply@aurex.in}"
    local mail_payload
    mail_payload=$(python3 -c '
import json, sys, os
print(json.dumps({
    "key": os.environ["MANDRILL_API_KEY"],
    "message": {
        "from_email": sys.argv[1],
        "to": [{"email": sys.argv[2], "type": "to"}],
        "subject": f"[aurex-watchdog {sys.argv[3]}] {sys.argv[4]}",
        "text": sys.argv[5],
    },
}))' "${from}" "${to}" "${hostname}" "${subject}" "${body}")
    curl -sS -m 8 -o /dev/null -X POST \
      -H 'Content-Type: application/json' \
      --data "${mail_payload}" \
      'https://mandrillapp.com/api/1.0/messages/send.json' \
      && log "alert email sent to ${to}" \
      || log "alert email FAILED to ${to}"
  fi
}

read_counter() {
  if [[ -f "${COUNTER_FILE}" ]]; then
    cat "${COUNTER_FILE}"
  else
    echo 0
  fi
}

write_counter() {
  echo "$1" > "${COUNTER_FILE}"
}

status="$(docker inspect --format '{{.State.Health.Status}}' "${CONTAINER}" 2>/dev/null || echo "missing")"

case "${status}" in
  healthy)
    if [[ "$(read_counter)" != "0" ]]; then
      log "container ${CONTAINER} healthy again — resetting counter"
    fi
    write_counter 0
    ;;
  starting)
    log "container ${CONTAINER} status=starting — no action"
    ;;
  unhealthy)
    count=$(($(read_counter) + 1))
    write_counter "${count}"
    log "container ${CONTAINER} unhealthy (consecutive=${count}/${THRESHOLD})"
    if (( count >= THRESHOLD )); then
      log "threshold reached — restarting ${CONTAINER}"
      if docker restart "${CONTAINER}" >/dev/null 2>&1; then
        log "restart issued for ${CONTAINER}"
        # Re-clamp container eth0 MTU to 1442. After a Docker-managed
        # restart (e.g., this watchdog or unless-stopped), eth0 reverts
        # to bridge MTU 1500 — without this clamp, outbound HTTPS to
        # upstream services (Google OAuth, GitHub, etc.) silently times
        # out on this host's 1442-byte uplink. AV4-441.
        CPID="$(docker inspect "${CONTAINER}" --format '{{.State.Pid}}' 2>/dev/null || true)"
        if [[ -n "${CPID}" ]] && sudo -n nsenter -t "${CPID}" -n ip link set dev eth0 mtu 1442 2>/dev/null; then
          log "container eth0 MTU re-clamped to 1442"
        else
          log "WARN: could not re-clamp eth0 MTU after restart — egress may flake"
        fi
        alert "container restarted" \
          "Watchdog restarted ${CONTAINER} after ${count} consecutive unhealthy reads. Tail: ~/aurex-watchdog/watchdog.log"
      else
        log "ERROR: docker restart ${CONTAINER} failed"
        alert "RESTART FAILED" \
          "docker restart ${CONTAINER} returned non-zero. Manual intervention required."
      fi
      write_counter 0
    fi
    ;;
  missing)
    log "container ${CONTAINER} not found — no action (deploy may be in progress)"
    ;;
  *)
    log "container ${CONTAINER} status=${status} — no action"
    ;;
esac
