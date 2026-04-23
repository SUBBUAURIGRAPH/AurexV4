import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { securityHeadersMiddleware } from './middleware/security-headers.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
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

// ADM-052: RFC 7807 error handler
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT, cors: CORS_ORIGINS }, 'AurexV4 API started');
});

export { app };
