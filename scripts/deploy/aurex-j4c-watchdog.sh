#!/usr/bin/env bash
#
# AurexV4 — off-host J4C watchdog wrapper.
#
# Runs `j4c-agent.py doctor` against aurex.in, parses the JSON report,
# and on a non-PASS verdict fires an email alert via Mandrill.
#
# This script is the production replacement for an UptimeRobot-style
# off-host monitor. Designed to run from a separate host (dev4 or any
# scheduler that's not aurex.in itself) so it catches full-host outages
# the on-host probe (aurex-external-probe.timer) can't see.
#
# Exit codes (pass-through from the agent):
#   0 = PASS, 1 = PARTIAL, 2 = FAIL.
#
# Optional alert config (env vars, sourced from ~/.aurex-watchdog.env if
# it exists — same convention as the on-host watchdog):
#   MANDRILL_API_KEY    — if set, sends an email via Mandrill HTTP API
#   AUREX_ALERT_EMAIL   — recipient (default: subscriptions@aurigraph.io)
#   AUREX_ALERT_FROM    — sender    (default: noreply@aurex.in)
#   AUREX_ALERT_WEBHOOK — if set, POSTs JSON {text} to this URL (Slack-compatible)
#   AUREX_J4C_ALERT_ON  — "fail" (default — only on verdict=FAIL) or
#                          "any" (also alert on PARTIAL)
#
# Install (typical):
#   scp scripts/deploy/aurex-j4c-watchdog.sh subbu@dev4:~/bin/
#   scp scripts/j4c-agent.py subbu@dev4:~/bin/
#   scp .j4c-agent.json subbu@dev4:~/aurex-j4c/
#   chmod +x ~/bin/aurex-j4c-watchdog.sh ~/bin/j4c-agent.py
#   systemctl --user enable --now aurex-j4c-watchdog.timer
set -euo pipefail

REPO_ROOT="${AUREX_J4C_REPO_ROOT:-${HOME}/aurex-j4c}"
AGENT_SCRIPT="${AUREX_J4C_AGENT:-${HOME}/bin/j4c-agent.py}"
STATE_DIR="${HOME}/aurex-watchdog"
LOG_FILE="${STATE_DIR}/j4c-watchdog.log"
LAST_REPORT="${STATE_DIR}/j4c-last-report.json"
ALERT_ON="${AUREX_J4C_ALERT_ON:-fail}"

mkdir -p "${STATE_DIR}"

# Source optional alert config — secrets stay out of the repo.
if [[ -f "${HOME}/.aurex-watchdog.env" ]]; then
  # shellcheck disable=SC1090,SC1091
  source "${HOME}/.aurex-watchdog.env"
fi

log() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [aurex-j4c-watchdog] $*" >> "${LOG_FILE}"
}

alert() {
  local subject="$1"
  local body="$2"
  local hostname
  hostname="$(hostname 2>/dev/null || echo unknown)"

  if [[ -n "${AUREX_ALERT_WEBHOOK:-}" ]]; then
    local payload
    payload=$(printf '{"text":"[aurex-j4c-watchdog %s] %s\n%s"}' \
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
        "subject": f"[aurex-j4c {sys.argv[3]}] {sys.argv[4]}",
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

# Run the agent — capture the JSON report + the exit code.
set +e
python3 "${AGENT_SCRIPT}" doctor --repo-root "${REPO_ROOT}" > "${LAST_REPORT}.tmp" 2>>"${LOG_FILE}"
RC=$?
set -e
mv "${LAST_REPORT}.tmp" "${LAST_REPORT}"

# Pull verdict + a one-line digest from the JSON for the alert body.
DIGEST=$(python3 -c '
import json, sys
key_v = "verdict"
with open(sys.argv[1]) as f:
    r = json.load(f)
verdict = r.get(key_v, "?")
sections = []
for name in ("deploy","containers","endpoints","csp","autoheal","jira"):
    sec = r.get(name, {})
    sections.append(name + "=" + sec.get(key_v, "?"))
ep = r.get("endpoints", {}).get("probes", [])
worst = next((p for p in ep if not p.get("ok")), None)
print("verdict=" + verdict + " | " + ", ".join(sections))
if worst:
    print("first failing endpoint: url=" + str(worst.get("url")) + " actual=" + str(worst.get("actual")))
' "${LAST_REPORT}" 2>/dev/null || echo "verdict=UNKNOWN (could not parse report)")

VERDICT=$(echo "${DIGEST}" | head -1 | awk -F'verdict=' '{print $2}' | awk -F' ' '{print $1}')

case "${VERDICT}" in
  PASS)
    log "verdict=PASS rc=${RC}"
    ;;
  PARTIAL)
    log "verdict=PARTIAL rc=${RC} | ${DIGEST}"
    if [[ "${ALERT_ON}" == "any" ]]; then
      alert "PARTIAL" "$(echo "${DIGEST}")"
    fi
    ;;
  FAIL)
    log "verdict=FAIL rc=${RC} | ${DIGEST}"
    alert "FAIL" "${DIGEST}"
    ;;
  *)
    log "verdict=UNKNOWN rc=${RC} | ${DIGEST}"
    alert "UNKNOWN" "j4c-agent exited with rc=${RC} but no parseable verdict. Check ${LOG_FILE}."
    ;;
esac

exit "${RC}"
