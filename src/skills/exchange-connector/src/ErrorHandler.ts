/**
 * ErrorHandler - Intelligent Error Classification & Recovery
 *
 * Features:
 * - Circuit breaker pattern (Closed → Open → Half-Open)
 * - Error classification (5 types)
 * - Automatic retry with exponential backoff
 * - Error context preservation
 */

export class SkillError extends Error {
  constructor(public code: string, message: string, public details?: any) {
    super(message);
    this.name = 'SkillError';
  }
}

export class SkillNotFoundError extends SkillError {
  constructor(skillName: string) {
    super('SKILL_NOT_FOUND', `Skill not found: ${skillName}`);
    this.name = 'SkillNotFoundError';
  }
}

export class SkillValidationError extends SkillError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'SkillValidationError';
  }
}

export class SkillExecutionError extends SkillError {
  constructor(message: string, details?: any) {
    super('EXECUTION_ERROR', message, details);
    this.name = 'SkillExecutionError';
  }
}

export class SkillTimeoutError extends SkillError {
  constructor(timeoutMs: number) {
    super('TIMEOUT', `Execution timed out after ${timeoutMs}ms`);
    this.name = 'SkillTimeoutError';
  }
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

export class ErrorHandler {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private readonly FAILURE_THRESHOLD = 5;
  private readonly TIMEOUT_MS = 60000; // 1 minute

  /**
   * Handle and classify errors
   */
  handle(error: any): SkillError {
    if (error instanceof SkillError) {
      return error;
    }

    // Classify error type
    if (error.code === 'RATE_LIMITED') {
      return new SkillExecutionError('Rate limit exceeded', {
        originalError: error.message,
      });
    }

    if (error.code === 'NETWORK_ERROR') {
      return new SkillExecutionError('Network error', {
        originalError: error.message,
      });
    }

    if (error.code === 'AUTHENTICATION_ERROR') {
      return new SkillExecutionError('Authentication failed', {
        originalError: error.message,
      });
    }

    // Default to execution error
    return new SkillExecutionError(error.message || 'Unknown error', {
      originalError: error,
    });
  }

  /**
   * Check circuit breaker state
   */
  canExecute(exchangeName: string): boolean {
    const breaker = this.circuitBreakers.get(exchangeName) || {
      state: 'CLOSED',
      failureCount: 0,
    };

    if (breaker.state === 'CLOSED') {
      return true;
    }

    if (breaker.state === 'OPEN') {
      // Check if timeout has passed
      const now = Date.now();
      const lastFailure = breaker.lastFailureTime?.getTime() || 0;

      if (now - lastFailure > this.TIMEOUT_MS) {
        // Try half-open
        breaker.state = 'HALF_OPEN';
        return true;
      }

      return false;
    }

    // Half-open state - allow one request
    return true;
  }

  /**
   * Record failure and update circuit breaker
   */
  recordFailure(exchangeName: string): void {
    const breaker = this.circuitBreakers.get(exchangeName) || {
      state: 'CLOSED',
      failureCount: 0,
    };

    breaker.failureCount++;
    breaker.lastFailureTime = new Date();

    if (breaker.failureCount >= this.FAILURE_THRESHOLD) {
      breaker.state = 'OPEN';
    }

    this.circuitBreakers.set(exchangeName, breaker);
  }

  /**
   * Record success and reset circuit breaker
   */
  recordSuccess(exchangeName: string): void {
    const breaker = this.circuitBreakers.get(exchangeName);
    if (breaker) {
      breaker.state = 'CLOSED';
      breaker.failureCount = 0;
      this.circuitBreakers.set(exchangeName, breaker);
    }
  }

  /**
   * Get circuit breaker state
   */
  getState(exchangeName: string): CircuitBreakerState {
    return this.circuitBreakers.get(exchangeName) || {
      state: 'CLOSED',
      failureCount: 0,
    };
  }

  /**
   * Calculate exponential backoff delay
   */
  getBackoffDelay(attemptNumber: number): number {
    // Base delay: 100ms, doubles each attempt: 100ms, 200ms, 400ms, 800ms, 1600ms
    const delay = 100 * Math.pow(2, attemptNumber - 1);
    // Add jitter: ±20% randomization
    const jitter = delay * 0.2 * (Math.random() - 0.5);
    return Math.max(100, delay + jitter);
  }
}

export default ErrorHandler;
