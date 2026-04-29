// J4C / WBS 11.1.1: OpenBao (Vault-API) env — must run before Prisma and routes.
import './lib/openbao-env.js';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { securityHeadersMiddleware } from './middleware/security-headers.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { authGoogleRouter } from './routes/auth-google.js';
import { organizationRouter } from './routes/organizations.js';
import { userRouter } from './routes/users.js';
import { emissionsRouter } from './routes/emissions.js';
import { referenceDataRouter } from './routes/reference-data.js';
import { analyticsRouter } from './routes/analytics.js';
import { baselineRouter } from './routes/baselines.js';
import { targetRouter } from './routes/targets.js';
import { reportRouter } from './routes/reports.js';
import { auditLogRouter } from './routes/audit-logs.js';
import { importRouter } from './routes/imports.js';
import { notificationsRouter } from './routes/notifications.js';
import { approvalsRouter } from './routes/approvals.js';
import { workflowsRouter } from './routes/workflows.js';
import { esgRouter } from './routes/esg.js';
import { brsrRouter } from './routes/brsr.js';
// AAT-R2 / AV4-427: BRSR Core assurance-readiness admin operations.
import { adminBrsrRouter } from './routes/admin-brsr.js';
import { onboardingRouter } from './routes/onboarding.js';
import { financialsRouter } from './routes/financials.js';
import {
  adminOrgApprovalsRouter,
  orgApprovalStatusRouter,
} from './routes/admin-org-approvals.js';
import { securityRouter } from './routes/security.js';
import { suppliersRouter } from './routes/suppliers.js';
// Article 6.4 / PACM routers (gap-analysis implementation)
import { methodologiesRouter } from './routes/methodologies.js';
import { activitiesRouter } from './routes/activities.js';
import { monitoringRouter } from './routes/monitoring.js';
import { verificationRouter } from './routes/verification.js';
import { issuanceRouter } from './routes/issuance.js';
import { creditsRouter } from './routes/credits.js';
// A6.4 Deferred items (AAT-3): BaselineScenario + SD-Tool
import { baselineScenariosRouter } from './routes/baseline-scenarios.js';
import { sdToolRouter } from './routes/sd-tool.js';
// A6.4 Deferred items (AAT-4): PDD wizard + retention admin
import { pddsRouter } from './routes/pdds.js';
import { adminRetentionRouter } from './routes/admin-retention.js';
// A6.4 Phase C (AAT-2): corresponding adjustments / BTR export
import { correspondingAdjustmentsRouter } from './routes/corresponding-adjustments.js';
// AAT-θ / AV4-354: KYC / CDD / AML / CTF adapter (BCR binding requirement B15)
import { kycRouter } from './routes/kyc.js';
// BCR Sprint 3 (AAT-λ): public marketplace + token detail (B13/B14)
import { biocarbonPublicRouter } from './routes/biocarbon-public.js';
// AAT-ξ / AV4-361, AV4-362: AWD2 → Aurex handoff receive + backfill.
import { awd2HandoffRouter } from './routes/awd2-handoff.js';
// AAT-ρ / AV4-376: Aurigraph DLT compliance namespace integration.
import { complianceRouter } from './routes/compliance.js';
// AAT-V3PORT: HEF voucher / coupon trial-signup (ported from V3).
import { couponsRouter } from './routes/coupons.js';
import { adminCouponsRouter } from './routes/admin-coupons.js';
// AAT-RZP / Wave 7: Razorpay-backed subscription billing.
import { billingRouter } from './routes/billing.js';
// AAT-9C / Wave 9c: persistence-audit GET endpoints (retirements + delist requests)
import { retirementsRouter } from './routes/retirements.js';
import { delistRequestsRouter } from './routes/delist-requests.js';
// AAT-R4 / AV4-438: granular CSRD ESRS E1-7 retirement export + backfill (admin).
import { adminRetirementsRouter } from './routes/admin-retirements.js';
// AAT-367 / AV4-367: service-to-service identity federation (Aurex ↔ AWD2/HCE2/Aurigraph).
import { federationRouter } from './routes/federation.js';
import { adminFederationRouter } from './routes/admin-federation.js';
// AAT-378 / AV4-378: tier quota gate dashboard + caller-org snapshot.
import { quotasRouter } from './routes/quotas.js';
import { adminQuotasRouter } from './routes/admin-quotas.js';
// AAT-DEEPRESEARCH: Google Deep Research (Gemini) adapter — external
// regulatory-landscape scanner (counterpart to the Claude-driven internal
// spec-compliance pipeline at AV4-405 / AAT-405).
import { adminResearchRouter } from './routes/admin-research.js';
// AAT-R3 / AV4-428, AV4-429, AV4-430, AV4-432: India DPDP Act 2023 compliance.
// Owns /me/consent, /me/data-*, /admin/dpdp/* paths under /api/v1.
import { dpdpRouter } from './routes/dpdp.js';
// AAT-FLOW6: Operations → Integrations status read endpoint (federation
// partner roster + service env-var status).
import { integrationsRouter } from './routes/integrations.js';
// AV4-338 / AAT-7: retention header + nightly archival worker
import { retentionHeaderMiddleware } from './middleware/retention-header.js';
import { startRetentionWorker } from './workers/retention-archival.worker.js';
// AAT-ζ / AV4-375: Aurigraph events worker (burn/retire/delist → BCR sync)
import { startAurigraphEventsWorker } from './workers/aurigraph-events.worker.js';
// AAT-RENEWAL / Wave 8c: subscription renewal scheduler (daily scan)
import { startRenewalScheduler } from './workers/subscription-renewal.worker.js';
import { logger } from './lib/logger.js';

const app: Express = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'https://aurex.in,https://www.aurex.in')
  .split(',')
  .map((s) => s.trim());

// ADM-052: Security foundation — helmet + custom security headers
app.use(helmet());
app.use(securityHeadersMiddleware);

// ADM-052: CORS whitelist (ADM-041: CSRF redundant with CORS + JWT + SameSite)
app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }),
);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ADM-052: Rate limiting
app.use(rateLimiter);

// Routes
app.use('/api/v1/health', healthRouter);
// Google sub-router mounted BEFORE the parent so /auth/google/* doesn't
// fall through to authRouter's catch-all error handlers.
app.use('/api/v1/auth/google', authGoogleRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/organizations', organizationRouter);
// Security router must be mounted BEFORE userRouter so /users/me/* doesn't
// fall through to userRouter's /:id handler.
app.use('/api/v1/users/me', securityRouter);
app.use('/api/v1/users', userRouter);
// FLOW-REWORK / Sprint 5 — apply org-approval gate to regulatory-write
// surfaces. The middleware passes GET/HEAD through and blocks
// POST/PUT/PATCH/DELETE with 412 when the org is PENDING_REVIEW or REJECTED.
import { requireApprovedOrg } from './middleware/org-approval-gate.js';
app.use('/api/v1/emissions', requireApprovedOrg, emissionsRouter);
app.use('/api/v1/reference-data', referenceDataRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/baselines', baselineRouter);
app.use('/api/v1/targets', targetRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/api/v1/audit-logs', auditLogRouter);
app.use('/api/v1/imports', importRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/approvals', approvalsRouter);
app.use('/api/v1/workflows', workflowsRouter);
app.use('/api/v1/esg', esgRouter);
app.use('/api/v1/brsr', requireApprovedOrg, brsrRouter);
// AAT-R2 / AV4-427: BRSR assurance-status admin route. Mounted under
// /api/v1/admin/brsr/* so it can co-exist with future admin BRSR ops.
app.use('/api/v1/admin/brsr', adminBrsrRouter);
app.use('/api/v1/onboarding', onboardingRouter);
// FLOW-REWORK / Sprint 5 — organisational financials (revenue, employees,
// fiscal year). Captured during onboarding step 5 + editable later via
// settings. Drives BRSR/CSRD intensity reports.
app.use('/api/v1/me/org/financials', financialsRouter);
// FLOW-REWORK / Sprint 5 — Aurex-admin org-approval workflow.
app.use('/api/v1/admin/org-approvals', adminOrgApprovalsRouter);
app.use('/api/v1/me/org/approval-status', orgApprovalStatusRouter);
app.use('/api/v1/suppliers', suppliersRouter);
// Article 6.4 / Paris Agreement Crediting Mechanism
app.use('/api/v1/methodologies', methodologiesRouter);
app.use('/api/v1/activities', activitiesRouter);
// AV4-338 / AAT-7: tag monitoring + verification responses with the
// retention-policy identifier so DOEs / SB reviewers can verify the ≥ 2yr
// post-crediting-period rule out-of-band.
app.use('/api/v1/monitoring', retentionHeaderMiddleware, monitoringRouter);
app.use('/api/v1/verification', retentionHeaderMiddleware, verificationRouter);
app.use('/api/v1/issuances', requireApprovedOrg, issuanceRouter);
app.use('/api/v1/credits', creditsRouter);
// A6.4 Deferred items (AAT-3)
app.use('/api/v1/baseline-scenarios', baselineScenariosRouter);
app.use('/api/v1/sd-tool', sdToolRouter);
// A6.4 Deferred items (AAT-4)
app.use('/api/v1/pdds', pddsRouter);
app.use('/api/v1/admin/retention', adminRetentionRouter);
// A6.4 Phase C (AAT-2)
app.use('/api/v1/corresponding-adjustments', correspondingAdjustmentsRouter);
// AAT-θ / AV4-354: KYC / CDD / AML / CTF adapter (BCR binding requirement B15)
app.use('/api/v1/kyc', kycRouter);
// AAT-λ / AV4-355: public marketplace + token detail (B13/B14)
app.use('/api/v1/biocarbon', biocarbonPublicRouter);
// AAT-ξ / AV4-361, AV4-362: AWD2 → Aurex handoff receive + backfill.
// Webhook-style — JWT-signed by AWD2's federation key, no Aurex user/org
// scope. Mounts at /api/v1/awd2 so the route file owns the /handoff path.
app.use('/api/v1/awd2', awd2HandoffRouter);
// AAT-ρ / AV4-376: Aurigraph DLT compliance attestation reads + submits.
app.use('/api/v1/compliance', complianceRouter);
// AAT-V3PORT: HEF voucher / coupon trial-signup. Public validate + redeem;
// admin CRUD gated to SUPER_ADMIN / ORG_ADMIN.
app.use('/api/v1/coupons', couponsRouter);
app.use('/api/v1/admin/coupons', adminCouponsRouter);
// AAT-RZP / Wave 7: Razorpay billing — checkout + webhook + subscription reads.
// The webhook endpoint inside billingRouter overrides express.json with
// express.raw so HMAC verification sees the exact bytes Razorpay signed.
app.use('/api/v1/billing', billingRouter);
// AAT-9C / Wave 9c: persistence-audit P0 — list endpoints for write-only entities.
app.use('/api/v1/retirements', requireApprovedOrg, retirementsRouter);
app.use('/api/v1/delist-requests', delistRequestsRouter);
// AAT-R4 / AV4-438: SUPER_ADMIN-gated CSRD ESRS E1-7 export + backfill.
app.use('/api/v1/admin/retirements', adminRetirementsRouter);
// AAT-367 / AV4-367: service-to-service identity federation. Inbound
// partner-signed JWTs land on `/api/v1/federation/*`; ops operations on
// the partner key registry live under `/api/v1/admin/federation/*`.
app.use('/api/v1/federation', federationRouter);
app.use('/api/v1/admin/federation', adminFederationRouter);
// AAT-378 / AV4-378: tier quota gate dashboard.
app.use('/api/v1/quotas', quotasRouter);
app.use('/api/v1/admin/quotas', adminQuotasRouter);
// AAT-DEEPRESEARCH: Google Deep Research (Gemini) admin endpoints.
app.use('/api/v1/admin/research', adminResearchRouter);
// AAT-FLOW6: Operations → Integrations status read.
app.use('/api/v1/integrations', integrationsRouter);
// AAT-R3 / AV4-428, AV4-429, AV4-430, AV4-432: India DPDP Act 2023 compliance.
// The router owns its full paths (/me/consent, /me/data-*, /admin/dpdp/*)
// so it mounts at the API root.
app.use('/api/v1', dpdpRouter);

// ADM-052: RFC 7807 error handler
app.use(errorHandler);

// Skip binding the HTTP listener when running tests (supertest passes the app
// instance directly — no port binding needed). This prevents EADDRINUSE when
// multiple test files import the app, and avoids hanging the vitest process.
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT, cors: CORS_ORIGINS }, 'AurexV4 API started');
  });

  // AV4-338 / AAT-7: opt-in nightly retention archival worker.
  // Operator must explicitly set RETENTION_WORKER_ENABLED=1 — default off
  // so provisioning / credentials / Redis connectivity can be validated
  // before enabling data movement.
  if (process.env.RETENTION_WORKER_ENABLED === '1') {
    startRetentionWorker().catch((err) => {
      logger.error({ err }, 'Failed to start retention archival worker');
    });
  }

  // AAT-ζ / AV4-375: opt-in Aurigraph events worker (burn/retire/delist).
  // Default OFF in test env regardless of the env var; in non-test env the
  // operator must explicitly opt in by setting AURIGRAPH_EVENTS_WORKER_ENABLED=1.
  if (process.env.AURIGRAPH_EVENTS_WORKER_ENABLED === '1') {
    startAurigraphEventsWorker().catch((err) => {
      logger.error({ err }, 'Failed to start Aurigraph events worker');
    });
  }

  // AAT-RENEWAL / Wave 8c: opt-in subscription renewal scheduler.
  // Default OFF — operator must set SUBSCRIPTION_RENEWAL_WORKER_ENABLED=1.
  // The worker scans every 24h (override via SUBSCRIPTION_RENEWAL_INTERVAL_MS)
  // and self-schedules via setTimeout — same pattern as
  // aurigraph-events.worker.ts.
  if (process.env.SUBSCRIPTION_RENEWAL_WORKER_ENABLED === '1') {
    startRenewalScheduler().catch((err) => {
      logger.error({ err }, 'Failed to start subscription renewal scheduler');
    });
  }
}

export { app };
