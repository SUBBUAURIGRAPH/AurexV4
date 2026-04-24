#!/usr/bin/env bash
set -euo pipefail

# ADM-053: Push-deploy-everything workflow
# ADM-054: HTTPS-aware deployment
# ADM-055: Pre/post deployment gating
# ADM-043: Web assets bind-mounted from host — deploy to host path, not container

REMOTE_HOST="${DEPLOY_HOST:-aurex.in}"
REMOTE_USER="${DEPLOY_USER:-subbu}"
REMOTE_PORT="${DEPLOY_SSH_PORT:-2244}"
WEB_PATH="${DEPLOY_WEB_PATH:-/home/subbu/aurex/web}"
SRC_PATH="${DEPLOY_SRC_PATH:-/home/subbu/aurexv4-src}"
API_CONTAINER="${API_CONTAINER:-aurex-api}"
API_IMAGE="${API_IMAGE:-aurexv4-api}"
RUN_DB_PUSH="${RUN_DB_PUSH:-0}"  # set to 1 when schema changed

SSH="ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST}"

echo "=== AurexV4 Deployment ==="
echo "Target: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}"
echo "Web:    ${WEB_PATH}"
echo "Src:    ${SRC_PATH}"
echo "Date:   $(date -Iseconds)"
echo ""

# ADM-055 Gate 1: Infrastructure readiness — the API container must already exist
echo "[Gate 1] Infrastructure readiness..."
if ! $SSH "docker ps --filter name=${API_CONTAINER} --format '{{.Names}}' | grep -qx ${API_CONTAINER}"; then
  echo "Gate 1 FAILED: container ${API_CONTAINER} is not running on ${REMOTE_HOST}"
  echo "  First-time deploys must provision the stack manually (db, redis, nginx, api)."
  exit 1
fi
echo "  Infrastructure OK"

# Build web assets locally (ADM-042: single-bundle)
echo ""
echo "[Build] Building web assets..."
pnpm --filter @aurex/web build

# Deploy web assets to host bind-mount path (ADM-043)
# Using tar-over-ssh since rsync is not available on the remote host.
echo ""
echo "[Deploy] Uploading web assets to ${WEB_PATH}..."
$SSH "rm -rf ${WEB_PATH}/assets ${WEB_PATH}/*.html ${WEB_PATH}/*.css ${WEB_PATH}/*.js 2>/dev/null || true"
( cd apps/web/dist && tar cf - . ) | $SSH "tar xf - -C ${WEB_PATH}/"
echo "  Web assets deployed"

# Ship source tree for API image rebuild
echo ""
echo "[Deploy] Uploading source tree to ${SRC_PATH}..."
$SSH "mkdir -p ${SRC_PATH} && find ${SRC_PATH} -maxdepth 1 -mindepth 1 -exec rm -rf {} + 2>/dev/null || true"
# .dockerignore handles node_modules etc. for docker build; we exclude at tar layer too for smaller transfer.
tar czf - \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.turbo' \
  --exclude='.git' \
  --exclude='coverage' \
  --exclude='credentials.md' \
  --exclude='*.log' \
  . | $SSH "tar xzf - -C ${SRC_PATH}"
echo "  Source tree uploaded"

# Build new API image on the remote
echo ""
echo "[Build] Rebuilding API image ${API_IMAGE}:new..."
$SSH "cd ${SRC_PATH} && docker build -t ${API_IMAGE}:new -f apps/api/Dockerfile ." | tail -10

# Optional: apply Prisma schema changes before rolling the container
if [ "$RUN_DB_PUSH" = "1" ]; then
  echo ""
  echo "[Migrate] Applying Prisma schema (db push)..."
  # Build devDeps-bearing stage so prisma CLI is available
  $SSH "cd ${SRC_PATH} && docker build --target build -t ${API_IMAGE}-build:tmp -f apps/api/Dockerfile ." | tail -5
  DB_URL=$($SSH "docker inspect ${API_CONTAINER} --format '{{range .Config.Env}}{{println .}}{{end}}' | grep ^DATABASE_URL= | cut -d= -f2-")
  if [ -z "$DB_URL" ]; then
    echo "Migrate FAILED: could not read DATABASE_URL from ${API_CONTAINER}"
    exit 1
  fi
  # --accept-data-loss needed when adding unique constraints on nullable cols
  # (Postgres allows multiple NULLs under UNIQUE, but Prisma warns). Safe for
  # the constraints we add; the flag is scoped to this one invocation.
  $SSH "docker run --rm --network aurex_network -e DATABASE_URL='${DB_URL}' -w /app/packages/database ${API_IMAGE}-build:tmp npx --no-install prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss"
  echo "  Schema synced"
fi

# Tag backup + promote :new to :latest, then roll the container
echo ""
echo "[Deploy] Rolling ${API_CONTAINER} onto new image..."
$SSH "set -e
  BACKUP_TAG=${API_IMAGE}:backup-\$(date +%Y%m%d-%H%M)
  docker tag ${API_IMAGE}:latest \$BACKUP_TAG
  docker tag ${API_IMAGE}:new ${API_IMAGE}:latest

  ENV_ARGS=\$(docker inspect ${API_CONTAINER} --format '{{range .Config.Env}}-e {{.}} {{end}}')
  docker stop ${API_CONTAINER} >/dev/null
  docker rm ${API_CONTAINER}-prev 2>/dev/null || true
  docker rename ${API_CONTAINER} ${API_CONTAINER}-prev
  docker run -d --name ${API_CONTAINER} --network aurex_network --restart unless-stopped \$ENV_ARGS ${API_IMAGE}:latest >/dev/null
"
echo "  Container rolled"

# ADM-055 Gate 5: Post-deployment health
echo ""
echo "[Gate 5] Post-deployment health..."
for i in 1 2 3 4 5; do
  HEALTH=$($SSH "docker exec ${API_CONTAINER} node -e 'fetch(\"http://localhost:3001/api/v1/health\").then(r=>r.text()).then(t=>console.log(t))' 2>&1" || true)
  if echo "$HEALTH" | grep -q '"healthy"'; then
    echo "  Container health OK"
    break
  fi
  if [ "$i" = "5" ]; then
    echo "  Health check FAILED — rolling back"
    $SSH "docker stop ${API_CONTAINER} && docker rm ${API_CONTAINER} && docker rename ${API_CONTAINER}-prev ${API_CONTAINER} && docker start ${API_CONTAINER}"
    exit 1
  fi
  sleep 2
done

# ADM-054: HTTPS validation
echo ""
echo "[Gate SSL] Validating HTTPS from client..."
HTTPS_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "https://${REMOTE_HOST}/api/v1/health" 2>/dev/null || echo "000")
if [ "$HTTPS_STATUS" = "200" ]; then
  echo "  HTTPS OK (${HTTPS_STATUS})"
else
  echo "  HTTPS WARNING: status ${HTTPS_STATUS}"
fi

# Optional: seed master data after the new container is healthy. Runs the
# compiled seed script baked into the new image at
# /app/node_modules/@aurex/database/dist/seed-master-data.js.
# Idempotent (upserts on natural keys) — safe to re-run every deploy.
if [ "${RUN_SEED_MASTER:-0}" = "1" ]; then
  echo ""
  echo "[Seed] Running master data seed..."
  E2E_ENV=""
  [ "${E2E_SEED:-0}" = "1" ] && E2E_ENV="-e E2E_SEED=1"
  $SSH "docker exec $E2E_ENV ${API_CONTAINER} node /app/node_modules/@aurex/database/dist/seed-master-data.js" | tail -20
  echo "  Master data seeded"
fi

# Clean up the previous container
echo ""
echo "[Cleanup] Removing previous container + :new tag..."
$SSH "docker rm ${API_CONTAINER}-prev 2>/dev/null || true; docker rmi ${API_IMAGE}:new 2>/dev/null || true" >/dev/null

echo ""
echo "=== Deployment complete ==="
echo "Frontend: https://${REMOTE_HOST}"
echo "API:      https://${REMOTE_HOST}/api/v1/health"
echo ""
echo "Note: if schema changed, re-run with RUN_DB_PUSH=1"
echo "Note: to re-seed master data, re-run with RUN_SEED_MASTER=1"
