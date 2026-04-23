import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { securityHeadersMiddleware } from './middleware/security-headers.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
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
import { esgRouter } from './routes/esg.js';
import { brsrRouter } from './routes/brsr.js';
import { onboardingRouter } from './routes/onboarding.js';
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
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/organizations', organizationRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/emissions', emissionsRouter);
app.use('/api/v1/reference-data', referenceDataRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/baselines', baselineRouter);
app.use('/api/v1/targets', targetRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/api/v1/audit-logs', auditLogRouter);
app.use('/api/v1/imports', importRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/approvals', approvalsRouter);
app.use('/api/v1/esg', esgRouter);
app.use('/api/v1/brsr', brsrRouter);
app.use('/api/v1/onboarding', onboardingRouter);

// ADM-052: RFC 7807 error handler
app.use(errorHandler);

// Skip binding the HTTP listener when running tests (supertest passes the app
// instance directly — no port binding needed). This prevents EADDRINUSE when
// multiple test files import the app, and avoids hanging the vitest process.
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT, cors: CORS_ORIGINS }, 'AurexV4 API started');
  });
}

export { app };
