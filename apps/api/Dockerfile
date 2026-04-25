# ADM-020: Non-root user, resource-conscious build
FROM node:20-slim AS base
RUN apt-get update -qq && apt-get install -y -qq openssl >/dev/null 2>&1 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/database/package.json packages/database/
COPY packages/aurigraph-dlt-sdk/package.json packages/aurigraph-dlt-sdk/
RUN pnpm install --frozen-lockfile --prod=false

# Build
FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/api/ apps/api/
COPY packages/shared/ packages/shared/
COPY packages/database/ packages/database/
COPY packages/aurigraph-dlt-sdk/ packages/aurigraph-dlt-sdk/
# Generate Prisma client in the build context
RUN cd packages/database && npx --no-install prisma generate
# Build all workspace packages
RUN pnpm --filter @aurex/shared build && \
    pnpm --filter @aurex/database build && \
    pnpm --filter @aurigraph/dlt-sdk build && \
    pnpm --filter @aurex/api build
# Deploy: flatten deps into api node_modules for production
RUN pnpm --filter @aurex/api deploy /app/api-deploy --prod
# Copy built workspace dist into deploy
RUN cp -r /app/packages/shared/dist /app/api-deploy/node_modules/@aurex/shared/dist 2>/dev/null || true && \
    cp -r /app/packages/database/dist /app/api-deploy/node_modules/@aurex/database/dist 2>/dev/null || true && \
    cp -r /app/packages/aurigraph-dlt-sdk/dist /app/api-deploy/node_modules/@aurigraph/dlt-sdk/dist 2>/dev/null || true
# Copy generated Prisma client from build to ALL .prisma locations in deploy
RUN BUILD_PRISMA=$(find /app/node_modules/.pnpm -path '*/.prisma/client/index.js' | head -1 | xargs dirname) && \
    for target in $(find /app/api-deploy/node_modules/.pnpm -path '*/.prisma/client' -type d); do \
      rm -rf "$target"/* && cp -r "$BUILD_PRISMA"/* "$target"/; \
    done && \
    echo "Prisma client copied from $BUILD_PRISMA to deploy"

# Production
FROM node:20-slim AS production
RUN apt-get update -qq && apt-get install -y -qq openssl >/dev/null 2>&1 && rm -rf /var/lib/apt/lists/*

# ADM-020: Non-root user
RUN groupadd -r aurex && useradd -r -g aurex -s /bin/false aurex
WORKDIR /app

COPY --from=build /app/api-deploy/node_modules ./node_modules
COPY --from=build /app/api-deploy/package.json ./
COPY --from=build /app/apps/api/dist ./dist

USER aurex

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/v1/health').then(r=>{if(!r.ok)throw 1})" || exit 1

CMD ["node", "dist/index.js"]
