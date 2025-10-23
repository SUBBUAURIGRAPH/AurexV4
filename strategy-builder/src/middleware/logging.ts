/**
 * Logging Middleware
 * Request/response logging with structured format
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Log HTTP requests
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log request
  logger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Capture response
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info('HTTP Response', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
}

/**
 * Log performance metrics
 */
export function performanceLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationNs = endTime - startTime;
    const durationMs = Number(durationNs) / 1000000;

    if (durationMs > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration: `${durationMs.toFixed(2)}ms`
      });
    }
  });

  next();
}
