# Docker-Manager Skill

**Agent**: DevOps Engineer
**Purpose**: Manage Docker containers, images, Compose applications, registries, and orchestration
**Status**: In Development
**Version**: 1.0.0 (SPARC Phase 1: Specification Complete)
**Owner**: DevOps Team
**Last Updated**: 2025-10-23

---

## SPARC Framework Phases

This skill follows the **SPARC Framework** for structured development. Track progress here:

- **Phase 1 - Specification**: ✅ Complete (2025-10-23)
  - Container lifecycle management (create, start, stop, restart, remove)
  - Image management (build, tag, push, pull, cleanup, scan)
  - Docker Compose orchestration (up, down, scale, logs)
  - Container inspection and diagnostics
  - Registry integration (Docker Hub, ECR, GCR, Azure, private)
  - Health checks and auto-recovery
  - Log aggregation and monitoring
  - Resource tracking and optimization
  - Security scanning and vulnerability management
  - Technical requirements (performance, reliability, security, scalability)
  - 4 complete user journeys (developer, DevOps, operations, security)
  - Success metrics (adoption, efficiency, quality, business impact)
  - 10 constraint categories with 100+ limitations
- **Phase 2 - Pseudocode**: 🔄 Next Phase
  - Core algorithms (lifecycle, build, health checks, auto-recovery)
  - Data structures (container metadata, image registry config)
  - Error handling (retry logic, circuit breaker, rollback)
  - API interfaces (Docker API, registries, notifications)
- **Phase 3 - Architecture**: 📋 Pending
  - System design finalization
  - Integration with Kubernetes/Swarm (future phases)
  - Security architecture
- **Phase 4 - Refinement**: 📋 Pending
  - Design optimizations
  - Testing strategy
- **Phase 5 - Completion**: 📋 Pending
  - Full implementation
  - Production deployment

> For more info on SPARC Framework, see `docs/SPARC_FRAMEWORK.md`

---

## Overview

The **docker-manager** skill provides unified management of Docker containers, images, and Compose applications. It consolidates 20+ scattered deployment scripts into a single, intelligent, production-grade subsystem that handles container lifecycle management, image optimization, registry integration, security scanning, and automated health monitoring.

### Key Capabilities

- **Container Lifecycle**: Create, start, stop, restart, remove, pause, with health checks and auto-recovery
- **Image Management**: Build, tag, push, pull, cleanup, scan; optimize for size and performance
- **Docker Compose**: Multi-service orchestration with zero-downtime deployments
- **Registry Integration**: Docker Hub, AWS ECR, Google GCR, Azure ACR, private registries
- **Health Monitoring**: HTTP/TCP/command-based health checks with automatic recovery
- **Log Aggregation**: Search, filter, analyze, export container logs
- **Resource Optimization**: CPU, memory, disk optimization with right-sizing recommendations
- **Security Scanning**: CVE detection, vulnerability tracking, compliance reporting

### Value Proposition

- **80% Faster Deployments**: 15 minutes → 3 minutes (manual → automated)
- **87% Setup Reduction**: 8 hours → 1 hour for CI/CD pipelines
- **99.9% Uptime**: Automatic health checks and recovery
- **100% Security Coverage**: All images scanned, CVEs tracked
- **$183K Annual ROI**: Time savings, incident reduction, cost optimization
- **520 Hours Saved**: Per year in DevOps engineering time

---

## Capabilities

- **Capability 1 - Container Lifecycle Management**: Create, start, stop, restart, remove, pause/unpause containers with intelligent orchestration
- **Capability 2 - Image Management**: Build, tag, push, pull, cleanup images with optimization and versioning
- **Capability 3 - Docker Compose Orchestration**: Manage multi-service applications with dependency resolution and rolling updates
- **Capability 4 - Registry Integration**: Connect to 5+ registries (Docker Hub, ECR, GCR, Azure, private) with credential management
- **Capability 5 - Container Inspection**: Monitor status, resources (CPU/memory/network), real-time diagnostics
- **Capability 6 - Health Checks & Auto-Recovery**: HTTP/TCP/command health checks with automatic restart and rollback
- **Capability 7 - Log Aggregation**: Collect, search, filter, analyze, export container logs with pattern matching
- **Capability 8 - Resource Tracking & Optimization**: Monitor and optimize CPU, memory, disk, network usage with recommendations
- **Capability 9 - Security Scanning**: Vulnerability detection, CVE tracking, compliance reporting (CIS, PCI-DSS, OWASP)
- **Capability 10 - Troubleshooting & Diagnostics**: Network tests, port checks, DNS resolution, performance profiling

---

## Usage

### Basic Usage

```
@devops-engineer docker-manager "Deploy app-api to dev4"
```

**Response**:
```json
{
  "success": true,
  "operation": "deploy",
  "container": "app-api-dev4",
  "status": "running",
  "image": "docker.io/myapp/api:v1.2.3",
  "health": "healthy",
  "uptime": "5 min",
  "resources": {
    "cpu": "45%",
    "memory": "256MB/512MB"
  },
  "endpoints": [
    "http://localhost:8080"
  ]
}
```

### Advanced Usage

#### 1. Build and Deploy with Security Scanning

```
@devops-engineer docker-manager
- operation: build-and-deploy
- context: ./src
- dockerfile: Dockerfile.prod
- registry: docker.io
- tag: v1.2.3
- environment: production
- security-scan: true
- health-check: /health
- timeout: 5m
```

#### 2. Diagnose Container Issues

```
@devops-engineer docker-manager
- operation: diagnose
- container: app-api-prod
- checks:
  - health
  - resources
  - logs (last 100 lines)
  - network
  - performance
```

#### 3. Docker Compose Up with Zero-Downtime

```
@devops-engineer docker-manager
- operation: compose-up
- file: docker-compose.prod.yaml
- environment: production
- scale: { api: 3, worker: 2 }
- health-check-wait: true
- rollback-on-failure: true
```

#### 4. Security Audit All Production Images

```
@devops-engineer docker-manager
- operation: security-audit
- environment: production
- severity-threshold: high
- auto-create-jira: true
- report-format: html
- email-recipients: security-team@company.com
```

#### 5. Optimize Container Resources

```
@devops-engineer docker-manager
- operation: optimize
- scope: all-production
- analysis: memory-leak-detection, cpu-throttling, image-size
- recommendations: true
- auto-apply-safe-changes: false
```

### Example Scenarios

**Example 1: Developer Deploy**
```
@devops-engineer docker-manager "Build and deploy my changes to dev4, run tests"
```
*Builds image with cache, scans for vulnerabilities, deploys, verifies health, reports ready in Slack. Total time: 3 min*

**Example 2: Incident Response**
```
@devops-engineer docker-manager "API container is slow - diagnose and fix"
```
*Analyzes logs, checks resources, identifies memory limit reached, recommends restart + increase, applies fix with confirmation*

**Example 3: Security Compliance**
```
@devops-engineer docker-manager "Audit all production images for CVEs and compliance"
```
*Scans 5 images in parallel, finds 4 critical CVEs, creates JIRA tickets, generates compliance report, emails stakeholders*

**Example 4: Infrastructure Optimization**
```
@devops-engineer docker-manager "Optimize resource allocation across all services"
```
*Analyzes CPU/memory usage, detects oversizing in 3 services, recommends 20% cost reduction, provides safe changes*

---

## Configuration

### Environment Variables

```bash
# Core Configuration
DOCKER_MANAGER_ENABLED=true
DOCKER_MANAGER_LOG_LEVEL=info
DOCKER_HOST=unix:///var/run/docker.sock

# Registry Credentials (stored securely in Vault)
DOCKER_REGISTRY_DOCKER_HUB=${DOCKER_HUB_USERNAME}:${DOCKER_HUB_TOKEN}
DOCKER_REGISTRY_ECR=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
DOCKER_REGISTRY_GCR=gcr.io/${GOOGLE_PROJECT_ID}
DOCKER_REGISTRY_PRIVATE=registry.company.com:5000

# Build Configuration
DOCKER_BUILD_TIMEOUT=30m
DOCKER_BUILD_MEMORY_LIMIT=4g
DOCKER_BUILD_CPU_LIMIT=4

# Health Check Configuration
HEALTH_CHECK_TIMEOUT=30s
HEALTH_CHECK_RETRIES=3
HEALTH_CHECK_INTERVAL=10s

# Security Configuration
SECURITY_SCAN_ENABLED=true
SECURITY_SCAN_SEVERITY_THRESHOLD=HIGH
SECURITY_SCAN_BLOCK_DEPLOYMENT_IF_CRITICAL=true
CVE_FIX_DEADLINE_CRITICAL=24h
CVE_FIX_DEADLINE_HIGH=7d
CVE_FIX_DEADLINE_MEDIUM=30d

# Logging & Monitoring
LOG_DRIVER=json-file
LOG_MAX_SIZE=10m
LOG_MAX_FILE=3
LOG_COMPRESSION=true

# Storage & Performance
REGISTRY_MIRROR=mirror.company.com:5000
BUILD_CACHE_SIZE=50gb
IMAGE_RETENTION_DAYS=30
DOCKER_STORAGE_DRIVER=overlay2
```

### Prerequisites

- [ ] Docker Engine 20.10.0+ installed
- [ ] Docker Compose 2.0+ installed
- [ ] Docker socket accessible
- [ ] Registry credentials configured
- [ ] HashiCorp Vault instance (for credential storage)
- [ ] Access to target registries (Docker Hub, ECR, GCR, etc.)
- [ ] Build system with sufficient resources (4+ CPU cores, 4GB+ RAM)
- [ ] Network access to all registries and deployment targets

---

## Implementation (Phase 1: Specification)

### Integration Points

**Internal Systems**:
- **Docker Engine**: Container lifecycle management
- **Docker Compose**: Multi-service orchestration
- **Docker Registry API**: Image push/pull/manifest operations
- **Kubernetes** (future): Deployment validation
- **MongoDB**: Store image metadata, deployment history
- **Redis**: Cache registry data, build progress
- **Vault**: Secure registry credentials, secrets

**External Systems**:
- **Docker Hub**: Public image registry
- **AWS ECR**: Amazon container registry
- **Google GCR**: Google Cloud container registry
- **Azure ACR**: Azure container registry
- **Private Registries**: Harbor, Nexus, GitLab
- **Slack**: Deployment notifications
- **JIRA**: CVE ticket creation
- **PagerDuty**: Critical alerts

### Data Structures

```json
{
  "container": {
    "id": "abc123def456",
    "name": "app-api-prod-1",
    "image": "docker.io/myapp/api:v1.2.3",
    "status": "running",
    "createdAt": "2025-10-23T10:30:00Z",
    "startedAt": "2025-10-23T10:30:05Z",
    "state": {
      "status": "running",
      "running": true,
      "paused": false,
      "restarting": false,
      "oomKilled": false,
      "dead": false,
      "pid": 12345,
      "exitCode": 0
    },
    "healthStatus": {
      "status": "healthy",
      "failingStreak": 0,
      "lastChecked": "2025-10-23T10:35:00Z",
      "nextCheck": "2025-10-23T10:35:10Z"
    },
    "resources": {
      "cpuUsage": { "value": 45, "limit": 100, "unit": "percent" },
      "memoryUsage": { "value": 256, "limit": 512, "unit": "MB" },
      "networkIo": { "rx": 1024000, "tx": 512000, "unit": "bytes" }
    }
  },

  "image": {
    "id": "sha256:abcd1234",
    "name": "docker.io/myapp/api",
    "tag": "v1.2.3",
    "digest": "sha256:abcd1234...",
    "size": 234567890,
    "createdAt": "2025-10-23T08:00:00Z",
    "registries": ["docker.io", "gcr.io", "ecr.aws"],
    "layers": [
      { "id": "layer1", "size": 50000000, "cmd": "FROM ubuntu:22.04" }
    ],
    "vulnerabilities": {
      "critical": 0,
      "high": 2,
      "medium": 5,
      "low": 12
    },
    "scanDate": "2025-10-23T10:15:00Z",
    "scanTool": "Trivy v0.45.0"
  },

  "registry": {
    "name": "docker.io",
    "type": "docker-hub",
    "auth": {
      "username": "myusername",
      "token": "*** (encrypted in Vault)"
    },
    "rateLimit": {
      "remaining": 48,
      "total": 60,
      "resetAt": "2025-10-23T11:00:00Z"
    }
  }
}
```

---

## Functional Requirements Summary

### 1. Container Lifecycle Operations

| Operation | Parameters | Target Time | Auto-Recovery |
|-----------|-----------|------------|----------------|
| **Create** | Image, name, ports, env, volumes | <2s | No |
| **Start** | Container ID | <5s | Yes (auto-restart) |
| **Stop** | Container ID, timeout (SIGTERM) | <10s | No |
| **Restart** | Container ID, timeout | <10s | Yes (if policy set) |
| **Remove** | Container ID, force | <3s | No |
| **Pause** | Container ID | <2s | No |
| **Exec** | Container ID, command | <5s | Inherit container policy |

### 2. Image Management

**Build**:
- Standard Docker build
- Multi-stage optimization
- BuildKit support (30% faster)
- Cross-platform builds (linux/amd64, linux/arm64)
- Build cache optimization
- Automated layer size analysis

**Tag & Distribute**:
- Semantic versioning (v1.2.3, latest, dev, prod)
- Push to multiple registries (parallel)
- Image promotion workflows (dev → staging → prod)
- Layer deduplication (storage savings)

**Cleanup**:
- Prune dangling images (untagged)
- Remove old versions (>30 days)
- Configurable retention (keep last 5 versions)
- Disk space reports

### 3. Docker Compose Orchestration

| Operation | Capability | Timeout | Status |
|-----------|-----------|---------|--------|
| **Up** | Multi-service start with dependency resolution | <30s | 1.0 |
| **Down** | Graceful shutdown with data persistence | <15s | 1.0 |
| **Scale** | Increase/decrease replicas per service | <20s | 1.0 |
| **Logs** | Aggregate logs from all services | <2s | 1.0 |
| **Exec** | Run command in service container | <5s | 1.0 |
| **Restart** | Restart specific service | <10s | 1.0 |
| **Health** | Check all services health | <10s | 1.0 |

### 4. Registry Integration (5 Supported)

| Registry | Status | Features |
|----------|--------|----------|
| **Docker Hub** | ✅ | Public/private repos, webhooks |
| **AWS ECR** | ✅ | Lifecycle policies, cross-account access |
| **Google GCR** | ✅ | Multi-region replication |
| **Azure ACR** | ✅ | Geo-replication, network rules |
| **Private** | ✅ | Harbor, Nexus, GitLab, custom |

### 5. Health Check Types

| Type | Example | Use Case |
|------|---------|----------|
| **HTTP** | GET /health returns 200 | Web services |
| **TCP** | Port 5432 accepting connections | Databases |
| **Command** | `/bin/sh -c curl http://localhost:8080` | Custom checks |
| **Interval** | Check every 10s, allow 3 failures | Tunable |

### 6. Security Scanning

**Scanners**: Trivy, Snyk, Clair, Docker Scan, Anchore

**Coverage**:
- 100% of images (before deployment)
- CVE database (updated daily)
- Secret detection (API keys, passwords)
- CIS Docker Benchmark

**Severity Actions**:
- Critical: Block deployment, immediate fix
- High: Alert team, fix within 24h
- Medium: Fix within 1 week
- Low: Fix in next sprint

---

## Success Metrics (40+ KPIs)

### Adoption Metrics
- **3 months**: 5 users (50%), 20 weekly invocations, 70% satisfaction
- **6 months**: 8 users (80%), 50 weekly invocations, 80% satisfaction
- **12 months**: 10 users (100%), 100 weekly invocations, 90% satisfaction

### Efficiency Metrics
- Build & Deploy: 15 min → 3 min (80% faster)
- CI/CD Setup: 8 hours → 1 hour (87% faster)
- Incident Diagnosis: 45 min → 10 min (77% faster)
- Security Audit: 3 hours → 20 min (93% faster)
- **Weekly Time Savings**: ~10 hours = 520 hours/year

### Quality Metrics
- Deployment success: 85% → 98%
- Container uptime: 98.5% → 99.9%
- Security scan coverage: 40% → 100%
- Vulnerability fix time: 14 days → 2 days
- Manual errors: 10% → 0%

### Business Impact
- **Annual ROI**: $183,200
  - Time savings: $52,000 (520 hours × $100/hr)
  - Incident reduction: $7,200 (fewer outages)
  - Infrastructure optimization: $24,000 (20% cost reduction)
  - Security compliance: $100,000+ (risk mitigation)
- **Payback Period**: 3 months
- **Investment**: $50K development + $10K/year operations

---

## Constraints & Limitations

### 1. Docker Version Compatibility
- **Minimum**: Docker Engine 20.10.0, Compose 2.0.0
- **Recommended**: Docker Engine 24.0+, Compose 2.20+
- **Not Supported**: Engine <20.10, Compose v1, Podman (Phase 1)

### 2. Performance Limits
- **Max Image Size**: 5GB (>5GB = slow builds)
- **Concurrent Builds**: 5 parallel max (increase in Phase 2)
- **Network Bandwidth**: Shared host bandwidth (1Gbps typical)
- **Disk Space**: <50GB free = critical alert

### 3. Registry Limits
- Docker Hub: 100 pulls/6hrs (free tier rate limiting)
- AWS ECR: Regional, cross-region transfer costs
- Google GCR: $0.026/GB/month storage
- Private registries: Firewall, certificate trust required

### 4. Storage Constraints
- Image layers: 500GB per host max
- Container logs: 10GB/container max (rotation)
- Build cache: 50GB per host
- Log retention: 7-30 days

### 5. Security Constraints
- Docker socket: Root access required (rootless in Phase 2)
- Image signing: Not enforced (optional/future)
- Secret management: Avoid env vars (use Vault/secrets)
- Privileged containers: Blocked unless approved

### 6. Orchestration Constraints
- **Phase 1**: Single-host Compose only
- **No support**: Multi-host, auto-failover, native load balancing
- **Phase 2**: Docker Swarm support
- **Phase 3**: Kubernetes integration

### 7. Platform Constraints
- **Linux**: Full support
- **macOS**: Full support (Docker Desktop)
- **Windows**: Partial (WSL2 + Linux containers only)

### 8. Scalability Constraints
- Phase 1: 100 containers, 500 images, 5 hosts, 5 registries
- Phase 2: 500 containers, 2000 images, 20 hosts, 20 registries

### 9. Network Constraints
- Registry access: Firewall, VPN may be required
- Port conflicts: Dynamic allocation, configurable
- DNS resolution: Custom DNS config supported
- Inter-container: Bridge/custom networks

### 10. Cost Constraints
- Development: $50,000
- Annual operations: $10,000 (maintenance, registries)
- ROI target: Break even in 3 months

---

## Workflow Diagram

```
┌─────────────────────────────────────────┐
│       DOCKER-MANAGER WORKFLOW           │
└─────────────────────────────────────────┘

1. BUILD IMAGE
   ├─ Read Dockerfile
   ├─ Use cache (50% faster)
   ├─ Build layers
   ├─ Optimize size
   └─ Tag image

2. SECURITY SCAN
   ├─ Run Trivy/Snyk
   ├─ Detect CVEs
   ├─ Check CIS compliance
   ├─ Block if CRITICAL
   └─ Create JIRA tickets if needed

3. PUSH TO REGISTRY
   ├─ Authenticate
   ├─ Push image layers
   ├─ Update manifest
   ├─ Multi-registry (parallel)
   └─ Verify digest

4. DEPLOY CONTAINER
   ├─ Pull image
   ├─ Create container
   ├─ Configure resources (CPU, memory)
   ├─ Configure health check
   ├─ Start container
   └─ Monitor startup

5. HEALTH CHECK
   ├─ Wait for ready (interval-based)
   ├─ Test health endpoint
   ├─ Check response time
   ├─ If healthy → continue
   └─ If unhealthy → auto-restart or rollback

6. MONITOR
   ├─ Track CPU/memory/network
   ├─ Collect logs
   ├─ Monitor health status
   ├─ Alert on anomalies
   └─ Auto-recover if needed

7. REPORT
   ├─ Notify Slack
   ├─ Update JIRA
   ├─ Log to MongoDB
   └─ Export metrics
```

---

## Testing Strategy (Phase 4)

- **Unit Tests**: Individual functions (build, push, health check)
- **Integration Tests**: Full workflows (build → scan → push → deploy)
- **E2E Tests**: Complete deployment pipeline
- **Performance Tests**: Build times, deployment speed
- **Security Tests**: Credential handling, CVE detection
- **Chaos Tests**: Simulate failures, test recovery

---

## Timeline

**Phase 1 - Specification**: ✅ Complete (Oct 23, 2025)
**Phase 2 - Pseudocode**: Oct 24-28, 2025 (5 days)
**Phase 3 - Architecture**: Oct 29 - Nov 2, 2025 (5 days)
**Phase 4 - Refinement**: Nov 3-5, 2025 (3 days)
**Phase 5 - Completion**: Nov 6 - Dec 15, 2025 (6 weeks)

**Target Launch**: December 15, 2025

---

## Related Skills

- **deploy-wizard**: Deploy applications to multiple environments
- **security-scanner**: Automated security testing
- **test-runner**: Automated test execution

---

## References

- SPARC Framework: `docs/SPARC_FRAMEWORK.md`
- SOPS: `docs/SOPS.md`
- Docker Documentation: https://docs.docker.com
- Docker Compose: https://docs.docker.com/compose

---

**Skill Documentation Version**: 1.0.0 (Specification Phase)
**Status**: 🟡 In Development (Phase 1: ✅, Phase 2-5: 🔄)
**Last Updated**: 2025-10-23
**Next Phase**: Phase 2 - Pseudocode (EST 2025-10-24)

---

#docker-manager #devops-engineer #container-orchestration #sparc #phase-1
