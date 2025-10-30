/**
 * Error Handling & Retry Utilities
 * Comprehensive error management for API calls and async operations
 *
 * Features:
 * - Structured error types
 * - Automatic retry with exponential backoff
 * - Timeout handling
 * - Error logging and reporting
 * - User-friendly error messages
 */

// ============================================================================
// ERROR TYPES
// ============================================================================

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AppError {
  type: ErrorType;
  message: string;
  statusCode?: number;
  details?: Record<string, any>;
  originalError?: Error;
  timestamp: number;
  userFriendlyMessage?: string;
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * Classify HTTP status code to error type
 */
export function classifyStatusCode(statusCode: number): ErrorType {
  if (statusCode === 408 || statusCode === 504) return ErrorType.TIMEOUT_ERROR;
  if (statusCode === 400 || statusCode === 422) return ErrorType.VALIDATION_ERROR;
  if (statusCode === 404) return ErrorType.NOT_FOUND;
  if (statusCode === 401) return ErrorType.UNAUTHORIZED;
  if (statusCode === 403) return ErrorType.FORBIDDEN;
  if (statusCode === 409) return ErrorType.CONFLICT;
  if (statusCode >= 500) return ErrorType.SERVER_ERROR;
  return ErrorType.UNKNOWN_ERROR;
}

/**
 * Create structured error from response
 */
export function createAppError(
  error: any,
  defaultMessage: string = 'An error occurred'
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  // Network error
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: ErrorType.NETWORK_ERROR,
      message: 'Network connection error',
      userFriendlyMessage: 'Unable to connect to server. Please check your internet connection.',
      originalError: error,
      timestamp: Date.now()
    };
  }

  // HTTP error with response
  if (error.statusCode) {
    return {
      type: classifyStatusCode(error.statusCode),
      message: error.message || defaultMessage,
      statusCode: error.statusCode,
      details: error.details,
      originalError: error,
      timestamp: Date.now(),
      userFriendlyMessage: getUserFriendlyMessage(
        classifyStatusCode(error.statusCode),
        error.message
      )
    };
  }

  // Generic error
  return {
    type: ErrorType.UNKNOWN_ERROR,
    message: error.message || defaultMessage,
    originalError: error instanceof Error ? error : new Error(String(error)),
    timestamp: Date.now(),
    userFriendlyMessage: 'An unexpected error occurred. Please try again.'
  };
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(type: ErrorType, serverMessage?: string): string {
  const messages: Record<ErrorType, string> = {
    [ErrorType.NETWORK_ERROR]: 'Unable to connect. Please check your internet connection.',
    [ErrorType.TIMEOUT_ERROR]: 'Request took too long. Please try again.',
    [ErrorType.VALIDATION_ERROR]: 'Invalid input. Please check your data.',
    [ErrorType.NOT_FOUND]: 'The requested item was not found.',
    [ErrorType.UNAUTHORIZED]: 'You need to log in to continue.',
    [ErrorType.FORBIDDEN]: 'You do not have permission to perform this action.',
    [ErrorType.CONFLICT]: 'There was a conflict with the current state. Please refresh and try again.',
    [ErrorType.SERVER_ERROR]: 'Server error. Please try again later.',
    [ErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
  };

  return messages[type] || 'An error occurred. Please try again.';
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: AppError, attempt: number) => boolean;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2
};

/**
 * Exponential backoff delay calculation
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  multiplier: number
): number {
  const delay = Math.min(
    initialDelayMs * Math.pow(multiplier, attempt - 1),
    maxDelayMs
  );
  // Add jitter to prevent thundering herd
  return delay + Math.random() * (delay * 0.1);
}

/**
 * Determine if error is retryable
 */
export function isRetryableError(error: AppError): boolean {
  // Retry on network errors, timeouts, and server errors
  // Don't retry on validation or authentication errors
  return [
    ErrorType.NETWORK_ERROR,
    ErrorType.TIMEOUT_ERROR,
    ErrorType.SERVER_ERROR,
    ErrorType.CONFLICT
  ].includes(error.type);
}

/**
 * Execute fetch with automatic retry and timeout
 */
export async function fetchWithRetry(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
    retryOptions?: RetryOptions;
  } = {}
): Promise<Response> {
  const {
    timeout = 30000,
    retryOptions = {}
  } = options;

  const finalRetryOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    ...retryOptions
  };

  const { maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier, shouldRetry } = finalRetryOptions;

  let lastError: AppError | null = null;
  let attempt = 0;

  while (attempt < maxAttempts!) {
    attempt++;

    try {
      // Execute fetch with timeout
      const response = await Promise.race([
        fetch(url, {
          method: options.method || 'GET',
          headers: options.headers,
          body: options.body
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
      ]) as Response;

      return response;
    } catch (error: any) {
      lastError = createAppError(error, `Request failed: ${options.method || 'GET'} ${url}`);

      const shouldRetryError = shouldRetry
        ? shouldRetry(lastError, attempt)
        : isRetryableError(lastError);

      if (attempt < maxAttempts! && shouldRetryError) {
        const delay = calculateBackoffDelay(
          attempt,
          initialDelayMs!,
          maxDelayMs!,
          backoffMultiplier!
        );

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || createAppError(new Error('Unknown error'));
}

// ============================================================================
// RESPONSE VALIDATION
// ============================================================================

export interface ResponseSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
  };
}

/**
 * Validate response structure against schema
 */
export function validateResponseSchema(
  data: any,
  schema: ResponseSchema
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Check required
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`Missing required field: ${field}`);
      continue;
    }

    if (value !== undefined && value !== null) {
      // Check type
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        errors.push(`Field ${field} has wrong type: expected ${rules.type}, got ${actualType}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Safely parse and validate JSON response
 */
export async function parseAndValidateResponse(
  response: Response,
  schema?: ResponseSchema
): Promise<any> {
  try {
    const data = await response.json();

    // Validate schema if provided
    if (schema) {
      const validation = validateResponseSchema(data, schema);
      if (!validation.valid) {
        throw createAppError(
          {
            statusCode: 422,
            message: `Response validation failed: ${validation.errors.join(', ')}`
          },
          'Invalid response format'
        );
      }
    }

    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    throw createAppError(
      {
        statusCode: 422,
        message: 'Failed to parse response'
      },
      'Invalid response format'
    );
  }
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

export interface ErrorLogger {
  logError(error: AppError, context?: Record<string, any>): void;
  logWarning(message: string, context?: Record<string, any>): void;
}

/**
 * Default console-based error logger
 */
export const consoleErrorLogger: ErrorLogger = {
  logError(error: AppError, context?: Record<string, any>) {
    console.error(
      `[${error.type}] ${error.message}`,
      error.details,
      context
    );
  },
  logWarning(message: string, context?: Record<string, any>) {
    console.warn(message, context);
  }
};

/**
 * Null error logger (for testing)
 */
export const nullErrorLogger: ErrorLogger = {
  logError() {},
  logWarning() {}
};

let globalErrorLogger: ErrorLogger = consoleErrorLogger;

/**
 * Set global error logger
 */
export function setErrorLogger(logger: ErrorLogger) {
  globalErrorLogger = logger;
}

/**
 * Get global error logger
 */
export function getErrorLogger(): ErrorLogger {
  return globalErrorLogger;
}

// ============================================================================
// ERROR MIDDLEWARE
// ============================================================================

/**
 * Async error wrapper for Redux thunks
 */
export function withErrorHandling<T, U>(
  asyncFn: (...args: any[]) => Promise<T>,
  errorLogger?: ErrorLogger
): (...args: any[]) => Promise<T | AppError> {
  const logger = errorLogger || getErrorLogger();

  return async (...args: any[]): Promise<T | AppError> => {
    try {
      return await asyncFn(...args);
    } catch (error: any) {
      const appError = createAppError(error);
      logger.logError(appError, { args });
      return appError;
    }
  };
}
