import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

/**
 * ADM-052: RFC 7807 compliant error handler
 */

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    message?: string,
    public readonly type: string = 'https://aurex.in/errors/general',
  ) {
    super(message ?? title);
    this.name = 'AppError';
  }

  toProblemDetail(req: Request): ProblemDetail {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.message,
      instance: req.originalUrl,
    };
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json(err.toProblemDetail(req));
    return;
  }

  logger.error({ err, url: req.originalUrl, method: req.method }, 'Unhandled error');

  res.status(500).json({
    type: 'https://aurex.in/errors/internal',
    title: 'Internal Server Error',
    status: 500,
    instance: req.originalUrl,
  });
}
