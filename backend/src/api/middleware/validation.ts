/**
 * Validation Middleware
 * Request validation and error handling
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError, ErrorCodes } from '../../types/index.js';

/**
 * Validate pagination parameters
 */
export function validatePagination(req: Request, res: Response, next: NextFunction): void {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

  if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
    throw new ApiError(
      ErrorCodes.VALIDATION_ERROR,
      400,
      'Limit must be a number between 1 and 100'
    );
  }

  if (offset !== undefined && (isNaN(offset) || offset < 0)) {
    throw new ApiError(
      ErrorCodes.VALIDATION_ERROR,
      400,
      'Offset must be a non-negative number'
    );
  }

  next();
}

/**
 * Validate required path parameters
 */
export function validateRequiredParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.params[paramName]) {
      throw new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        400,
        `${paramName} parameter is required`
      );
    }
    next();
  };
}

/**
 * Validate date format (ISO 8601)
 */
export function validateDateParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.query[paramName] as string;
    if (value && isNaN(Date.parse(value))) {
      throw new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        400,
        `${paramName} must be a valid ISO 8601 date`
      );
    }
    next();
  };
}

/**
 * Validate numeric parameter
 */
export function validateNumericParam(paramName: string, min?: number, max?: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.query[paramName];
    if (value) {
      const num = parseInt(value as string);
      if (isNaN(num)) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          `${paramName} must be a valid number`
        );
      }
      if (min !== undefined && num < min) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          `${paramName} must be >= ${min}`
        );
      }
      if (max !== undefined && num > max) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          `${paramName} must be <= ${max}`
        );
      }
    }
    next();
  };
}

/**
 * Validate enum value
 */
export function validateEnumParam(paramName: string, allowedValues: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName] || req.query[paramName];
    if (value && !allowedValues.includes(value as string)) {
      throw new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        400,
        `${paramName} must be one of: ${allowedValues.join(', ')}`
      );
    }
    next();
  };
}

/**
 * Validate request body structure
 */
export function validateRequestBody(schema: Record<string, any>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const body = req.body;

    for (const [key, rules] of Object.entries(schema)) {
      if (rules.required && !(key in body)) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          `${key} is required`
        );
      }

      if (key in body && rules.type && typeof body[key] !== rules.type) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          `${key} must be of type ${rules.type}`
        );
      }

      if (key in body && rules.minLength && body[key].length < rules.minLength) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          `${key} must have minimum length ${rules.minLength}`
        );
      }

      if (key in body && rules.maxLength && body[key].length > rules.maxLength) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          `${key} must have maximum length ${rules.maxLength}`
        );
      }
    }

    next();
  };
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '')
    .toUpperCase();
}

/**
 * Validate symbol format (ticker symbol)
 */
export function validateSymbol(symbol: string): boolean {
  const symbolRegex = /^[A-Z]{1,5}$/;
  return symbolRegex.test(symbol.toUpperCase());
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default {
  validatePagination,
  validateRequiredParam,
  validateDateParam,
  validateNumericParam,
  validateEnumParam,
  validateRequestBody,
  sanitizeString,
  validateSymbol,
  validateEmail
};
