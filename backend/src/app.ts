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
    // Skip rate limiting for health checks
    return req.path === '/health';
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
  // ============================================
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: config.CORS_CREDENTIALS,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400 // 24 hours
    })
  );

  // ============================================
  // Request Logging Middleware
  // ============================================
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logLevel =
        res.statusCode >= 500 ? '❌' :
        res.statusCode >= 400 ? '⚠️' :
        res.statusCode >= 300 ? '🔄' :
        '✅';

      console.log(
        `${logLevel} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
      );
    });

    next();
  });

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
  // Error Handler (must be last middleware)
  // ============================================
  app.use(errorHandler);

  return app;
}

export default createApp;
