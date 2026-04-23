#!/usr/bin/env bash
set -euo pipefail

# ADM-053: Push-deploy-everything workflow
# ADM-054: HTTPS-aware deployment
# ADM-055: Pre/post deployment gating

REMOTE_HOST="${DEPLOY_HOST:-aurex.in}"
REMOTE_USER="${DEPLOY_USER:-subbu}"
REMOTE_PORT="${DEPLOY_SSH_PORT:-22}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/aurexv4}"

echo "=== AurexV4 Deployment ==="
echo "Target: ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_PATH}"
echo "Date:   $(date -Iseconds)"
echo ""

# ADM-055 Gate 1: Infrastructure readiness
echo "[Gate 1] Infrastructure readiness..."
ssh -p "${REMOTE_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" "
  docker ps --filter 'name=aurexv4' --format '{{.Names}} {{.Status}}' && \
  echo 'Infrastructure check passed'
" || { echo "Gate 1 FAILED: Infrastructure not ready"; exit 1; }

# Build web assets locally
echo "[Build] Building web assets..."
pnpm --filter @aurex/web build

# Deploy web assets to host (ADM-043: bind-mount path)
echo "[Deploy] Uploading web assets..."
rsync -avz --delete \
  -e "ssh -p ${REMOTE_PORT}" \
  apps/web/dist/ \
  "${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_PATH}/web/"

# Deploy API (rebuild container on remote)
echo "[Deploy] Rebuilding API container..."
rsync -avz --delete \
  -e "ssh -p ${REMOTE_PORT}" \
  --exclude='node_modules' --exclude='.turbo' --exclude='dist' \
  . \
  "${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_PATH}/src/"

ssh -p "${REMOTE_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" "
  cd ${DEPLOY_PATH}/src && \
  docker compose -f infrastructure/docker/docker-compose.yml build aurex-api && \
  docker compose -f infrastructure/docker/docker-compose.yml up -d
"

# ADM-055 Gate 5: Post-deployment health
echo "[Gate 5] Post-deployment health check..."
sleep 10
HEALTH=$(ssh -p "${REMOTE_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" \
  "curl -sf http://localhost:3001/api/v1/health | head -c 200" 2>/dev/null || echo "FAIL")

if echo "$HEALTH" | grep -q '"healthy"'; then
  echo "Health check PASSED"
else
  echo "Health check FAILED — consider rollback"
  echo "Response: ${HEALTH}"
  exit 1
fi

# ADM-054: HTTPS validation
echo "[Gate SSL] Validating HTTPS..."
HTTPS_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "https://${REMOTE_HOST}/api/v1/health" 2>/dev/null || echo "000")
if [ "$HTTPS_STATUS" = "200" ]; then
  echo "HTTPS validation PASSED (${HTTPS_STATUS})"
else
  echo "HTTPS validation WARNING: status ${HTTPS_STATUS}"
fi

echo ""
echo "=== Deployment complete ==="
echo "Frontend: https://${REMOTE_HOST}"
echo "API:      https://api.${REMOTE_HOST}/api/v1/health"
