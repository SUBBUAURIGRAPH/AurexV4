# Multi-stage build for Jeeves4Coder Plugin

# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /build

# Install build dependencies
RUN apk add --no-cache git curl

# Copy package files
COPY jeeves4coder-package.json package.json
COPY package-lock.json .

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source files
COPY jeeves4coder.js .
COPY jeeves4coder.config.json .
COPY index.js .
COPY skill-manager.js .
COPY skill-executor.js .
COPY context-manager.js .
COPY infrastructure-manager.js .
COPY environment-loader.js .

# Copy skills directory
COPY skills/ ./skills/

# Stage 2: Runtime
FROM node:18-alpine

# Labels for image metadata
LABEL maintainer="Aurigraph Development Team <agents@aurigraph.io>"
LABEL description="Jeeves4Coder - Sophisticated coding assistant plugin for Claude Code"
LABEL version="1.0.0"

# Set working directory
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    bash \
    ca-certificates && \
    npm install -g npm@9

# Copy built artifacts from builder stage
COPY --from=builder /build /app

# Create non-root user for security
RUN addgroup -g 1000 jeeves && \
    adduser -D -u 1000 -G jeeves jeeves && \
    chown -R jeeves:jeeves /app

# Switch to non-root user
USER jeeves

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Environment variables
ENV NODE_ENV=production \
    LOG_LEVEL=info \
    DEBUG=false \
    PORT=3000

# Expose port (for service exposure)
EXPOSE 3000

# Volume for configuration
VOLUME ["/app/config"]

# Default command
CMD ["node", "jeeves4coder.js"]

# Build arguments and labels
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION=1.0.0

LABEL org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$VERSION
