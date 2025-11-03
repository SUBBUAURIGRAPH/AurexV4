/**
 * Prometheus Metrics Middleware
 * Tracks HTTP requests and system metrics
 */

import { Request, Response, NextFunction } from 'express';
import {
  httpRequestDuration,
  httpRequestTotal,
  httpRequestSize,
  httpResponseSize,
  activeConnections,
} from '../../utils/metrics.js';

/**
 * Metrics middleware to track HTTP requests
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const startMs = process.hrtime.bigint();

  // Track active connections
  activeConnections.inc();

  // Track request size
  const contentLength = req.get('content-length');
  if (contentLength) {
    httpRequestSize.labels(req.method, req.route?.path || req.path).observe(parseInt(contentLength));
  }

  // Handle response finish
  res.on('finish', () => {
    // Calculate duration
    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;
    const endMs = process.hrtime.bigint();
    const duration = Number(endMs - startMs) / 1e6; // Convert to milliseconds

    // Get route path (with wildcards replaced)
    const route = req.route?.path || req.path || 'unknown';

    // Record metrics
    const statusCode = res.statusCode.toString();
    httpRequestDuration
      .labels(req.method, route, statusCode)
      .observe(duration / 1000); // Convert ms to seconds

    httpRequestTotal.labels(req.method, route, statusCode).inc();

    // Track response size
    const responseLength = res.get('content-length');
    if (responseLength) {
      httpResponseSize.labels(req.method, route, statusCode).observe(parseInt(responseLength));
    }

    // Decrement active connections
    activeConnections.dec();
  });

  next();
}

export default metricsMiddleware;
