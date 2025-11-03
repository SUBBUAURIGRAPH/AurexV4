# HERMES HF Deployment Checklist

**Version**: 2.1.0
**Status**: ✅ Production Ready
**Last Updated**: November 2, 2025

---

## Pre-Deployment

### Code Quality
- [ ] Run full test suite: `npm test`
- [ ] Check code coverage: `npm run test:coverage`
- [ ] Run linter: `npm run lint`
- [ ] Build backend: `npm run build:backend`

### Security
- [ ] Run security audit: `npm audit`
- [ ] Check for hardcoded secrets
- [ ] Verify environment variables are set
- [ ] Check RBAC policies in k8s

---

## Docker Build & Registry

### Local Testing
- [ ] Docker image builds without errors
- [ ] Image size is optimal
- [ ] Healthcheck endpoint responds
- [ ] All environment variables documented

### Push to Registry
- [ ] Image pushed successfully
- [ ] Registry access verified

---

## Kubernetes Deployment

### Cluster Preparation
- [ ] Namespace created: `hermes`
- [ ] ConfigMap deployed
- [ ] Secrets deployed
- [ ] RBAC policies applied

### Deploy Application
- [ ] Deployment created
- [ ] Service created
- [ ] All 3 replicas running
- [ ] Pods are ready
- [ ] Health checks passing

### Verify Deployment
- [ ] All pods running
- [ ] No pending pods
- [ ] Health endpoint responds
- [ ] gRPC endpoint accessible (port 3002)

---

## Monitoring & Logging

### Prometheus Metrics
- [ ] Prometheus scraping metrics
- [ ] Custom metrics appearing

### Grafana Dashboards
- [ ] Grafana connected
- [ ] Dashboards loading
- [ ] Alerts configured

### Log Aggregation
- [ ] Loki receiving logs
- [ ] Log search working

---

## Performance Testing

### Load Testing
- [ ] Application handles 100+ RPS
- [ ] P95 latency < 200ms
- [ ] No errors under load

### Stress Testing
- [ ] Survives pod failures
- [ ] Recovers from network issues

---

## Post-Deployment Verification

### Smoke Tests
- [ ] Health check passes
- [ ] API endpoints responding
- [ ] Database connected
- [ ] Cache working

### Production Readiness
- [ ] Runbook created
- [ ] Incident response documented
- [ ] On-call schedule published

---

## Deployment Sign-Off

**Version**: 2.1.0
**Environment**: Staging / Production
**Date**: _________________
**Approved By**: _________________

