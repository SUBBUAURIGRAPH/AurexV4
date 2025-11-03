/**
 * Request Logging Middleware
 * Adds correlation IDs and structured logging to all requests
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger, CorrelationLogger } from '../../utils/logger.js';

/**
 * Extended Request with logging context
 */
export interface LoggingRequest extends Request {
  correlationId?: string;
  logger?: CorrelationLogger;
  startTime?: number;
}

/**
 * Middleware to add correlation ID and logger to each request
 */
export function loggingMiddleware(
  req: LoggingRequest,
  res: Response,
  next: NextFunction
): void {
  // Generate or extract correlation ID
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  req.correlationId = correlationId;
  req.logger = new CorrelationLogger(correlationId);
  req.startTime = Date.now();

  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', correlationId);

  // Log request start
  req.logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Capture response details
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = function (body: any) {
    res.locals.body = body;
    return originalJson(body);
  };

  res.send = function (body: any) {
    res.locals.body = body;
    return originalSend(body);
  };

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || Date.now());
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    const logMethod = (req.logger as any)[level].bind(req.logger);

    logMethod('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      contentLength: res.get('content-length'),
    });
  });

  next();
}

/**
 * Error logging middleware
 */
export function errorLoggingMiddleware(
  err: any,
  req: LoggingRequest,
  res: Response,
  next: NextFunction
): void {
  const duration = Date.now() - (req.startTime || Date.now());

  if (req.logger) {
    req.logger.error('Request error', err, {
      method: req.method,
      path: req.path,
      statusCode: err.statusCode || res.statusCode || 500,
      durationMs: duration,
    });
  } else {
    logger.error('Request error', err, {
      method: req.method,
      path: req.path,
      correlationId: req.correlationId,
      durationMs: duration,
    });
  }

  next(err);
}

export default loggingMiddleware;
