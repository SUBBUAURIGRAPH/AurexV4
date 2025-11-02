/**
 * Input Validation Utilities
 * Validate command inputs and options
 * @version 1.0.0
 */

import { ValidatorOptions, CLIError } from '../types';

export class Validator {
  /**
   * Validate required string
   */
  static validateString(
    value: any,
    fieldName: string,
    options?: ValidatorOptions
  ): string {
    if ((options?.required || true) && !value) {
      throw this.createError(
        `${fieldName} is required`,
        'VALIDATION_ERROR',
        `Please provide a valid ${fieldName}`
      );
    }

    const stringValue = String(value);

    if (options?.pattern && !options.pattern.test(stringValue)) {
      throw this.createError(
        `${fieldName} format is invalid`,
        'VALIDATION_ERROR',
        `${fieldName} must match pattern: ${options.pattern}`
      );
    }

    if (options?.enum && !options.enum.includes(stringValue)) {
      throw this.createError(
        `${fieldName} value not allowed`,
        'VALIDATION_ERROR',
        `${fieldName} must be one of: ${options.enum.join(', ')}`
      );
    }

    return stringValue;
  }

  /**
   * Validate number
   */
  static validateNumber(
    value: any,
    fieldName: string,
    options?: ValidatorOptions
  ): number {
    if ((options?.required || false) && (value === null || value === undefined)) {
      throw this.createError(
        `${fieldName} is required`,
        'VALIDATION_ERROR',
        `Please provide a valid number for ${fieldName}`
      );
    }

    const numValue = Number(value);

    if (isNaN(numValue)) {
      throw this.createError(
        `${fieldName} must be a number`,
        'VALIDATION_ERROR',
        `${fieldName} must be a valid numeric value`
      );
    }

    if (options?.min !== undefined && numValue < options.min) {
      throw this.createError(
        `${fieldName} is too small`,
        'VALIDATION_ERROR',
        `${fieldName} must be at least ${options.min}`
      );
    }

    if (options?.max !== undefined && numValue > options.max) {
      throw this.createError(
        `${fieldName} is too large`,
        'VALIDATION_ERROR',
        `${fieldName} must be at most ${options.max}`
      );
    }

    return numValue;
  }

  /**
   * Validate symbol (e.g., AAPL, BTC/USD)
   */
  static validateSymbol(symbol: string): string {
    const pattern = /^[A-Z0-9]+(\/[A-Z0-9]+)?$/;
    if (!pattern.test(symbol)) {
      throw this.createError(
        `${symbol} is not a valid symbol`,
        'INVALID_SYMBOL',
        'Symbol should be in format like AAPL or BTC/USD'
      );
    }
    return symbol.toUpperCase();
  }

  /**
   * Validate strategy ID
   */
  static validateStrategyId(id: string): string {
    if (!id || id.length < 3) {
      throw this.createError(
        'Strategy ID is invalid',
        'INVALID_ID',
        'Strategy ID must be at least 3 characters'
      );
    }
    return id;
  }

  /**
   * Validate quantity (must be positive)
   */
  static validateQuantity(quantity: number): number {
    const num = this.validateNumber(quantity, 'quantity', { min: 0.001 });
    return num;
  }

  /**
   * Validate price (must be positive)
   */
  static validatePrice(price: number): number {
    return this.validateNumber(price, 'price', { min: 0.01 });
  }

  /**
   * Validate date string (ISO format)
   */
  static validateDate(dateString: string): Date {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw this.createError(
        'Invalid date format',
        'INVALID_DATE',
        'Please use ISO format: YYYY-MM-DD'
      );
    }
    return date;
  }

  /**
   * Validate file path exists
   */
  static async validateFilePath(filePath: string): Promise<string> {
    try {
      const fs = require('fs').promises;
      await fs.access(filePath);
      return filePath;
    } catch {
      throw this.createError(
        `File not found: ${filePath}`,
        'FILE_NOT_FOUND',
        'Please check the file path and try again'
      );
    }
  }

  /**
   * Validate JSON content
   */
  static validateJSON(jsonString: string): any {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw this.createError(
        'Invalid JSON',
        'INVALID_JSON',
        'Please provide valid JSON content'
      );
    }
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): string {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!pattern.test(email)) {
      throw this.createError(
        `${email} is not a valid email`,
        'INVALID_EMAIL',
        'Please provide a valid email address'
      );
    }
    return email;
  }

  /**
   * Create CLI error
   */
  private static createError(
    message: string,
    code: string,
    suggestion?: string
  ): CLIError {
    const error = new Error(message) as CLIError;
    error.code = code;
    error.suggestion = suggestion;
    return error;
  }

  /**
   * Validate multiple fields
   */
  static validateFields(fields: Record<string, any>): Record<string, any> {
    const errors: Record<string, string> = {};

    Object.entries(fields).forEach(([key, value]) => {
      if (!value) {
        errors[key] = `${key} is required`;
      }
    });

    if (Object.keys(errors).length > 0) {
      throw this.createError(
        'Validation failed',
        'VALIDATION_ERROR',
        `Missing fields: ${Object.keys(errors).join(', ')}`
      );
    }

    return fields;
  }
}

export default Validator;
