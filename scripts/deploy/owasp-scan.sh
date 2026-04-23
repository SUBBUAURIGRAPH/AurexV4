#!/usr/bin/env bash
#
# AV4-295 / ADM-056: OWASP ZAP baseline scan.
#
# Runs the official zaproxy/zap-stable image against ${TARGET_URL:-https://aurex.in}
# and writes reports (JSON + HTML) to ./reports/. Treats ZAP exit codes:
#   0 - no issues
#   1 - warnings only  -> OK, pipeline continues
#   2+ - failures      -> propagate non-zero exit
#
# Usage:
#   TARGET_URL=https://staging.aurex.in ./scripts/deploy/owasp-scan.sh
#   pnpm test:owasp:baseline
#

set -uo pipefail

TARGET_URL="${TARGET_URL:-https://aurex.in}"
REPORT_DIR="$(pwd)/reports"

mkdir -p "$REPORT_DIR"

echo "[owasp-scan] target: $TARGET_URL"
echo "[owasp-scan] reports: $REPORT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "[owasp-scan] ERROR: docker is required but not found on PATH." >&2
  exit 127
fi

# zap-baseline.py is a ~2-minute passive scan; safe for production targets.
docker run --rm \
  -v "$REPORT_DIR:/zap/wrk/:rw" \
  -t zaproxy/zap-stable \
  zap-baseline.py \
    -t "$TARGET_URL" \
    -J owasp-report.json \
    -r owasp-report.html \
    -l WARN

zap_exit=$?

case "$zap_exit" in
  0)
    echo "[owasp-scan] PASS (no issues)"
    exit 0
    ;;
  1)
    echo "[owasp-scan] PASS with warnings (exit=1 tolerated per ADM-056)"
    exit 0
    ;;
  *)
    echo "[owasp-scan] FAIL (ZAP exit=$zap_exit)" >&2
    exit "$zap_exit"
    ;;
esac
