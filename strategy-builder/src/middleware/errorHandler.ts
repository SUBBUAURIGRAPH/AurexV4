/**
 * Error Handling Middleware
 * Centralized error handling with structured responses
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler
 */
export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // Log error
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Handle known errors
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Handle Mongoose validation errors
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.message
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Handle Mongoose cast errors
  if (error.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: 'Invalid ID format'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Handle unexpected errors
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * 404 handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Async handler wrapper to catch promise rejections
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
