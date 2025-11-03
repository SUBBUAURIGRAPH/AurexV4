/**
 * Express App Factory
 * Main application setup and middleware configuration
 * @version 1.0.0
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import config from './config/env.js';
import apiV1Routes from './api/v1/index.js';
import { errorHandler, notFoundHandler } from './api/middleware/errorHandler.js';
import authMiddleware from './api/middleware/auth.js';
import { loggingMiddleware, errorLoggingMiddleware } from './api/middleware/logging.js';
import metricsMiddleware from './api/middleware/metrics.js';
import { getMetrics } from './utils/metrics.js';

/**
 * Configure CORS origin validation
 * Supports dynamic origin checking based on environment
 */
const getCorsOrigin = (origin: string | undefined): boolean => {
  // Allow requests with no origin (same origin requests)
  if (!origin) return true;

  // Development environments
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging') {
    // Allow localhost and 127.0.0.1 with any port
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return true;
    }
  }

  // Production allowed origins
  const allowedOrigins = [
    'https://hms.aurex.in',
    'https://www.hms.aurex.in',
    'https://apihms.aurex.in',
    'https://api.hms.aurex.in',
    'https://api-hms.aurex.in'
  ];

  return allowedOrigins.includes(origin);
};

/**
 * Configure rate limiters for different endpoints
 */
const createRateLimiter = (
  windowMs: number,
  maxRequests: number,
  message: string
) => rateLimit({
  windowMs,
  max: maxRequests,
  message,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: (req) => {
    // Skip rate limiting for health checks and metrics in staging
    if (req.path === '/health') return true;
    if (req.path === '/metrics' && process.env.NODE_ENV !== 'production') return true;
    return false;
  }
});

// General API limiter: 100 requests per 15 minutes
const apiLimiter = createRateLimiter(
  config.RATE_LIMIT_WINDOW,
  config.RATE_LIMIT_MAX_REQUESTS,
  'Too many requests from this IP, please try again later.'
);

// Auth limiter: stricter limit for authentication endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 requests
  'Too many authentication attempts, please try again later.'
);

// Public endpoints limiter: more generous
const publicLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  'Too many requests, please try again later.'
);

/**
 * Create and configure Express application
 */
export function createApp(): Express {
  const app = express();

  // ============================================
  // Request Parsing Middleware
  // ============================================
  app.use(express.json({ limit: '2mb' })); // Reduced from 10mb for security
  app.use(express.urlencoded({ limit: '2mb', extended: true }));

  // ============================================
  // CORS Configuration
  // Supports wildcard in development, strict whitelist in production
  // ============================================
  app.use(
    cors({
      origin: getCorsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Correlation-ID',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
      ],
      exposedHeaders: [
        'X-Correlation-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'Content-Length'
      ],
      maxAge: 86400, // 24 hours
      optionsSuccessStatus: 200
    })
  );

  // ============================================
  // Structured Request Logging Middleware
  // ============================================
  // Add correlation ID and Winston logger to requests
  app.use(loggingMiddleware);

  // ============================================
  // Security Headers Middleware
  // ============================================
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // ============================================
  // Metrics Collection Middleware
  // ============================================
  app.use(metricsMiddleware);

  // ============================================
  // Health Check Endpoint
  // ============================================
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Server is healthy',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV
    });
  });

  // ============================================
  // Prometheus Metrics Endpoint
  // ============================================
  app.get('/metrics', async (req: Request, res: Response) => {
    try {
      res.set('Content-Type', 'text/plain; version=0.0.4');
      const metrics = await getMetrics();
      res.send(metrics);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve metrics',
        error: (error as any).message
      });
    }
  });

  // ============================================
  // Rate Limiting Middleware
  // ============================================
  // Apply general rate limiter to all API routes
  app.use(`${config.API_PREFIX}`, apiLimiter);

  // ============================================
  // API Routes
  // ============================================
  app.use(`${config.API_PREFIX}`, apiV1Routes);

  // ============================================
  // 404 Handler (must be after all routes)
  // ============================================
  app.use(notFoundHandler);

  // ============================================
  // Error Logging (must be before error handler)
  // ============================================
  app.use(errorLoggingMiddleware);

  // ============================================
  // Error Handler (must be last middleware)
  // ============================================
  app.use(errorHandler);

  return app;
}

export default createApp;
