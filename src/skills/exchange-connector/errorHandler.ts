/**
 * Error Handler
 * Comprehensive error handling and recovery for exchange operations
 * Provides error classification, retry logic, and user suggestions
 * Version: 1.0.0
 */

import { ExchangeError, AuditLogEntry } from './types';

export class ExchangeErrorHandler {
  private errorLog: AuditLogEntry[] = [];
  private errorCounts: Map<string, Map<string, number>> = new Map();
  private circuitBreakers: Map<string, { failureCount: number; lastFailure: Date; open: boolean }> = new Map();

  constructor(private circuitBreakerThreshold: number = 5, private resetTimeout: number = 60000) {}

  /**
   * Classify and handle an error
   */
  handleError(
    error: any,
    context: {
      exchange?: string;
      operation?: string;
      params?: Record<string, any>;
    }
  ): ExchangeError {
    let errorType: ExchangeError['type'] = 'UNKNOWN';
    let statusCode: number = 500;
    let suggestion: string = 'Unknown error occurred';
    let retryable = false;

    const errorMessage = error?.message || String(error);

    // Classify error based on message/code
    if (
      errorMessage.includes('Invalid API') ||
      errorMessage.includes('Unauthorized') ||
      errorMessage.includes('403') ||
      errorMessage.includes('401')
    ) {
      errorType = 'INVALID_CREDS';
      statusCode = 401;
      suggestion = 'API credentials invalid or expired. Check Vault or rotate keys.';
      retryable = false;
    } else if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('429') ||
      errorMessage.includes('too many requests')
    ) {
      errorType = 'RATE_LIMIT';
      statusCode = 429;
      suggestion = 'Rate limit exceeded. Waiting for quota reset or use fallback exchange.';
      retryable = true;
    } else if (
      errorMessage.includes('down') ||
      errorMessage.includes('maintenance') ||
      errorMessage.includes('503') ||
      errorMessage.includes('offline')
    ) {
      errorType = 'EXCHANGE_DOWN';
      statusCode = 503;
      suggestion = 'Exchange offline or in maintenance. Check status page or use failover exchange.';
      retryable = true;
    } else if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('network')
    ) {
      errorType = 'NETWORK_ERROR';
      statusCode = 503;
      suggestion = 'Network unreachable. Check connectivity and retry with exponential backoff.';
      retryable = true;
    } else if (
      errorMessage.includes('Invalid parameter') ||
      errorMessage.includes('Bad request') ||
      errorMessage.includes('400')
    ) {
      errorType = 'INVALID_PARAMS';
      statusCode = 400;
      suggestion = 'Check parameter syntax and values. See usage examples.';
      retryable = false;
    }

    // Log error
    this.logError(context.exchange || 'unknown', errorType, errorMessage);

    // Check circuit breaker
    if (context.exchange) {
      this.recordFailure(context.exchange);
    }

    return {
      message: errorMessage,
      code: error?.code || 'UNKNOWN',
      type: errorType,
      statusCode,
      retryable,
      suggestion,
      timestamp: new Date(),
      context,
    };
  }

  /**
   * Log error for tracking
   */
  private logError(exchange: string, type: string, message: string): void {
    // Track error counts per exchange
    if (!this.errorCounts.has(exchange)) {
      this.errorCounts.set(exchange, new Map());
    }

    const exchangeErrors = this.errorCounts.get(exchange)!;
    const count = (exchangeErrors.get(type) || 0) + 1;
    exchangeErrors.set(type, count);

    // Trim error log if too large
    if (this.errorLog.length > 1000) {
      this.errorLog.shift();
    }
  }

  /**
   * Record failure for circuit breaker
   */
  private recordFailure(exchange: string): void {
    if (!this.circuitBreakers.has(exchange)) {
      this.circuitBreakers.set(exchange, { failureCount: 0, lastFailure: new Date(), open: false });
    }

    const breaker = this.circuitBreakers.get(exchange)!;
    breaker.failureCount++;
    breaker.lastFailure = new Date();

    if (breaker.failureCount >= this.circuitBreakerThreshold) {
      breaker.open = true;
    }
  }

  /**
   * Record success for circuit breaker
   */
  recordSuccess(exchange: string): void {
    if (!this.circuitBreakers.has(exchange)) {
      return;
    }

    const breaker = this.circuitBreakers.get(exchange)!;
    breaker.failureCount = 0;
    breaker.open = false;
  }

  /**
   * Check if circuit breaker is open
   */
  isCircuitBreakerOpen(exchange: string): boolean {
    const breaker = this.circuitBreakers.get(exchange);
    if (!breaker || !breaker.open) {
      return false;
    }

    // Check if timeout has passed
    const timeSinceLastFailure = Date.now() - breaker.lastFailure.getTime();
    if (timeSinceLastFailure > this.resetTimeout) {
      breaker.failureCount = 0;
      breaker.open = false;
      return false;
    }

    return true;
  }

  /**
   * Get error statistics for an exchange
   */
  getErrorStats(exchange: string): Record<string, number> {
    return Object.fromEntries(this.errorCounts.get(exchange) || new Map());
  }

  /**
   * Get all error statistics
   */
  getAllErrorStats(): Record<string, Record<string, number>> {
    const stats: Record<string, Record<string, number>> = {};
    for (const [exchange, errors] of this.errorCounts) {
      stats[exchange] = Object.fromEntries(errors);
    }
    return stats;
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(exchange: string): { open: boolean; failureCount: number } | null {
    const breaker = this.circuitBreakers.get(exchange);
    if (!breaker) {
      return null;
    }

    return {
      open: breaker.open,
      failureCount: breaker.failureCount,
    };
  }

  /**
   * Reset circuit breaker for an exchange
   */
  resetCircuitBreaker(exchange: string): void {
    const breaker = this.circuitBreakers.get(exchange);
    if (breaker) {
      breaker.failureCount = 0;
      breaker.open = false;
    }
  }

  /**
   * Get retry strategy
   */
  getRetryStrategy(error: ExchangeError): {
    shouldRetry: boolean;
    delay: number;
    maxAttempts: number;
  } {
    const baseDelay = 1000; // 1 second

    switch (error.type) {
      case 'RATE_LIMIT':
        return {
          shouldRetry: true,
          delay: baseDelay * 5, // 5 second delay
          maxAttempts: 3,
        };
      case 'NETWORK_ERROR':
        return {
          shouldRetry: true,
          delay: baseDelay, // 1 second delay with exponential backoff
          maxAttempts: 5,
        };
      case 'EXCHANGE_DOWN':
        return {
          shouldRetry: true,
          delay: baseDelay * 10, // 10 second delay
          maxAttempts: 2,
        };
      case 'INVALID_CREDS':
      case 'INVALID_PARAMS':
        return {
          shouldRetry: false,
          delay: 0,
          maxAttempts: 0,
        };
      default:
        return {
          shouldRetry: true,
          delay: baseDelay,
          maxAttempts: 3,
        };
    }
  }

  /**
   * Exponential backoff delay
   */
  getBackoffDelay(attempt: number, baseDelay: number = 1000): number {
    return baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
  }

  /**
   * Generate error report
   */
  generateErrorReport(): string {
    const summary = this.getAllErrorStats();
    let report = `
================================================================================
                        ERROR SUMMARY REPORT
================================================================================

ERROR COUNTS BY EXCHANGE
------------------------
`;

    for (const [exchange, errors] of Object.entries(summary)) {
      report += `\n${exchange}:`;
      for (const [type, count] of Object.entries(errors)) {
        report += `\n  ${type}: ${count}`;
      }
    }

    report += `\n\nCIRCUIT BREAKER STATUS
---------------------\n`;

    for (const [exchange, breaker] of this.circuitBreakers) {
      report += `${exchange}: ${breaker.open ? 'OPEN' : 'CLOSED'} (${breaker.failureCount} failures)\n`;
    }

    report += `
================================================================================
Generated: ${new Date().toISOString()}
================================================================================
`;

    return report;
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
    this.errorCounts.clear();
  }
}

export default ExchangeErrorHandler;
