/**
 * Aurigraph DLT SDK — RFC 7807 Problem+JSON error handling.
 *
 * All V12 API errors conform to RFC 7807 (application/problem+json).
 * See ~/.claude/RFC7807.md for the full spec.
 */

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errorCode?: string;
  traceId?: string;
  requestId?: string;
  service?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Base error thrown by AurigraphClient.
 */
export class AurigraphError extends Error {
  public readonly status: number;
  public readonly problem?: ProblemDetails;
  public readonly url?: string;

  constructor(message: string, status: number, problem?: ProblemDetails, url?: string) {
    super(message);
    this.name = 'AurigraphError';
    this.status = status;
    this.problem = problem;
    this.url = url;
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AurigraphError.prototype);
  }
}

/** Thrown on HTTP 4xx responses (application-level validation). */
export class AurigraphClientError extends AurigraphError {
  constructor(message: string, status: number, problem?: ProblemDetails, url?: string) {
    super(message, status, problem, url);
    this.name = 'AurigraphClientError';
    Object.setPrototypeOf(this, AurigraphClientError.prototype);
  }
}

/** Thrown on HTTP 5xx responses (server errors). Retryable. */
export class AurigraphServerError extends AurigraphError {
  constructor(message: string, status: number, problem?: ProblemDetails, url?: string) {
    super(message, status, problem, url);
    this.name = 'AurigraphServerError';
    Object.setPrototypeOf(this, AurigraphServerError.prototype);
  }
}

/** Thrown when request times out or fetch throws. Retryable. */
export class AurigraphNetworkError extends AurigraphError {
  constructor(message: string, url?: string) {
    super(message, 0, undefined, url);
    this.name = 'AurigraphNetworkError';
    Object.setPrototypeOf(this, AurigraphNetworkError.prototype);
  }
}

/** Thrown when SDK config is invalid (missing baseUrl etc.). */
export class AurigraphConfigError extends AurigraphError {
  constructor(message: string) {
    super(message, 0);
    this.name = 'AurigraphConfigError';
    Object.setPrototypeOf(this, AurigraphConfigError.prototype);
  }
}

/**
 * Thrown by adapter modules when user-supplied input fails client-side
 * validation (bad hash format, wallet prefix, symbol whitelist, etc.)
 * before the request is sent to the server.
 */
export class ValidationError extends AurigraphError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, 0);
    this.name = 'ValidationError';
    this.field = field;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
