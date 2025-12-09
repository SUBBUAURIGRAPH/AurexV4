# J4C Deployment & QAQC Agent Rules

**Version**: 1.0.0
**Last Updated**: December 2025
**Status**: MEMORIZED - Core Agent Framework Rules

---

## Core Deployment Principles

### 1. INCREMENTAL DEPLOYMENT ONLY - #MEMORIZED

**CRITICAL**: Only deploy changed components. Never reinstall infrastructure on every deployment.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INCREMENTAL DEPLOYMENT FLOW                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Git Push] → [Change Detection] → [Deploy ONLY Changed Components] │
│                      │                                               │
│         ┌───────────┼───────────────┬─────────────────┐             │
│         ▼           ▼               ▼                 ▼             │
│    [Backend?]   [Portal?]      [Config?]         [Nodes?]          │
│    Changed?     Changed?       Changed?          Changed?          │
│         │           │               │                 │             │
│      Y/N ↓       Y/N ↓          Y/N ↓             Y/N ↓            │
│    [Build &    [Build &       [Reload          [Restart           │
│     Deploy]     Deploy]        Config]          Nodes]            │
│                                                                     │
│  Infrastructure (PostgreSQL, Redis, NGINX) = NO CHANGE NEEDED      │
│  unless explicitly modified                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Rules:**
- Backend changes → Rebuild & deploy backend JAR only
- Portal changes → Rebuild & deploy frontend only
- Config changes → Reload configuration only
- Infrastructure → NEVER redeploy unless explicitly required
- Database → NEVER reinitialize unless schema changes

### 2. Component Change Detection

The CI/CD workflow uses `detect-changes` job to identify what changed:
- `backend_changed`: Backend application code
- `portal_changed`: Frontend/portal code
- `nodes_changed`: Validator/node configurations
- `config_changed`: Application configuration files
- `docker_changed`: Docker-related files

### 3. Skip Unnecessary Work

```yaml
# Example: Skip backend build if no backend changes
build-backend:
  if: ${{ needs.detect-changes.outputs.backend_changed == 'true' }}
```

---

## Post-Deployment QAQC Rules

### 4. POST-DEPLOYMENT E2E/SMOKE TESTS - #MEMORIZED

**CRITICAL**: Execute E2E and Smoke tests after EVERY deployment. This is MANDATORY.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    POST-DEPLOYMENT QAQC FLOW                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Deployment Complete] → [Health Check] → [QAQC Agent Triggered]   │
│                                                │                    │
│                         ┌──────────────────────┴─────────────────┐  │
│                         │                                        │  │
│                         ▼                                        ▼  │
│                   [Smoke Tests]                          [E2E Tests] │
│                   Quick validation                       Full suite │
│                   ~30 seconds                            ~5 minutes │
│                         │                                        │  │
│                         └──────────────────────┬─────────────────┘  │
│                                                │                    │
│                                                ▼                    │
│                                    [Test Report Generated]         │
│                                    Pass → Done                      │
│                                    Fail → Alert + Rollback Option  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**QAQC Agent Responsibilities:**

1. **Smoke Tests** (immediate, ~30s):
   - Health endpoint check
   - Info endpoint check
   - Frontend accessibility

2. **E2E Tests** (comprehensive, ~5min):
   - Playwright Frontend Tests
   - Pytest Backend Tests
   - Integration tests

### 5. Test Escalation Rule - #MEMORIZED

**RULE: If Smoke Tests FAIL → Run E2E Tests for diagnosis**

```
┌─────────────────────────────────────────────────────────────┐
│              TEST ESCALATION FLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Smoke Tests] ──PASS──> Done ✅                            │
│       │                                                     │
│      FAIL                                                   │
│       │                                                     │
│       ▼                                                     │
│  [Run E2E Tests] ← Diagnose specific failures               │
│       │                                                     │
│       ├──PASS──> Smoke false positive, verify manually      │
│       │                                                     │
│      FAIL                                                   │
│       │                                                     │
│       ▼                                                     │
│  [Generate Failure Report]                                  │
│       │                                                     │
│       ├──> Document in JIRA                                 │
│       ├──> Alert team                                       │
│       └──> Consider rollback                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Smoke tests are quick but give limited info
- E2E tests identify EXACTLY what's broken
- Never skip E2E when smoke fails

---

## Quick Reference Commands

### Smoke Test Command
```bash
# Run immediately after deployment
curl -sf https://YOUR_SERVER/api/health && \
curl -sf https://YOUR_SERVER/api/info && \
curl -sf https://YOUR_SERVER/ | head -c 100 && \
echo "✅ Smoke tests passed"
```

### E2E Test Commands
```bash
# Frontend E2E Tests (Playwright)
cd frontend && npx playwright test --reporter=list

# Backend E2E Tests (Pytest)
cd backend && python3 -m pytest tests/ -v --tb=short
```

---

## Self-Hosted Runner Configuration

- All deployments should use self-hosted runners to avoid cloud billing
- Labels: `self-hosted`, `Linux`, `X64`
- This bypasses GitHub Actions budget limits

---

## Summary Table

| Rule | Description | Status |
|------|-------------|--------|
| Incremental Deploy | Only deploy changed components | #MEMORIZED |
| E2E/Smoke Tests | Run after EVERY deployment | #MEMORIZED |
| Test Escalation | Smoke FAIL → Run E2E | #MEMORIZED |
| Self-Hosted Runner | Use self-hosted to avoid costs | #MEMORIZED |

---

## Implementation Notes

These rules are implemented in:
1. GitHub Actions workflows with `detect-changes` job
2. Post-deployment health check steps
3. QAQC agent automated test triggers
4. CI/CD pipeline configuration

**Source**: Aurigraph DLT Production Deployment Experience (December 2025)
