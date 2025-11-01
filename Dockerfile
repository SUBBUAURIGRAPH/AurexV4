# Multi-stage Docker build for HMS GNN Prediction System

# Stage 1: Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Build optimizations
RUN npm run build || true

# Stage 2: Runtime stage
FROM node:18-alpine

WORKDIR /app

# Install runtime dependencies (including dumb-init and curl for health checks)
RUN apk add --no-cache \
    curl \
    dumb-init \
    cairo \
    jpeg \
    pango \
    giflib

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create necessary directories
RUN mkdir -p /app/logs /app/data && \
    chown -R nodejs:nodejs /app

# Switch to nodejs user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/sbin/dumb-init", "--"]

# Start application - use the compiled JavaScript instead of TypeScript
CMD ["node", "backend/dist/server.js"]
