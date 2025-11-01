/**
 * Express App Factory
 * Main application setup and middleware configuration
 * @version 1.0.0
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import config from './config/env.js';
import apiV1Routes from './api/v1/index.js';
import { errorHandler, notFoundHandler } from './api/middleware/errorHandler.js';
import authMiddleware from './api/middleware/auth.js';

/**
 * Create and configure Express application
 */
export function createApp(): Express {
  const app = express();

  // ============================================
  // Request Parsing Middleware
  // ============================================
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

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
