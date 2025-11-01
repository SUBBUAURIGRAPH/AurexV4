/**
 * Error Handler Middleware
 * Centralized error handling for all API routes
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError, ErrorCodes, ApiResponse } from '../../types/index.js';

/**
 * Error Handler Middleware
 * Must be registered as last middleware in Express app
 */
export const errorHandler = (
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('[Error Handler]', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Handle custom API errors
  if (error instanceof ApiError) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    };

    res.status(error.statusCode).json(response);
    return;
  }

  // Handle validation errors
  if (error.message.includes('validation')) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: error.message
      }
    };

    res.status(400).json(response);
    return;
  }

  // Handle database errors
  if (error.message.includes('database') || error.message.includes('query')) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: ErrorCodes.DATABASE_ERROR,
        message: 'Database error occurred. Please try again later.'
      }
    };

    res.status(500).json(response);
    return;
  }

  // Handle unexpected errors
  const response: ApiResponse<null> = {
    success: false,
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred'
        : error.message
    }
  };

  res.status(500).json(response);
};

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new ApiError(
    ErrorCodes.NOT_FOUND,
    404,
    `Route ${req.method} ${req.path} not found`
  );

  next(error);
};

export default errorHandler;
