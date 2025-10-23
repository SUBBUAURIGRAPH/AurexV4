/**
 * Request Validation Middleware
 * Schema-based request validation using Zod
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

/**
 * Validate request using Zod schema
 */
export function validate(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate body
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }

      // Validate query
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }

      // Validate params
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation error', {
          errors: error.errors,
          path: req.path
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message
            }))
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      next(error);
    }
  };
}
