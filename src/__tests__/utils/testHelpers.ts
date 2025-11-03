/**
 * Test Helpers and Utilities
 * Common test utilities for CLI and Service tests
 * @version 1.0.0
 */

import { jest } from '@jest/globals';

/**
 * Mock console methods to prevent output clutter in tests
 */
export function mockConsole() {
  const originalConsole = { ...console };

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  return originalConsole;
}

/**
 * Create a mock CLI argv object
 */
export function createMockArgv(overrides: any = {}): any {
  return {
    _: [],
    $0: 'test',
    user: 'test-user',
    format: 'table',
    verbose: false,
    output: 'stdout',
    ...overrides
  };
}

/**
 * Create mock API response
 */
export function createMockApiResponse<T>(data: T, status = 200): any {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {}
  };
}

/**
 * Create mock API error
 */
export function createMockApiError(message: string, status = 500): any {
  const error: any = new Error(message);
  error.response = {
    data: { error: message },
    status,
    statusText: 'Error',
    headers: {},
    config: {}
  };
  return error;
}

/**
 * Wait for async operations
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Capture console output
 */
export function captureConsoleOutput(): {
  logs: string[];
  errors: string[];
  warnings: string[];
  restore: () => void;
} {
  const logs: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = jest.fn((...args: any[]) => {
    logs.push(args.join(' '));
  });

  console.error = jest.fn((...args: any[]) => {
    errors.push(args.join(' '));
  });

  console.warn = jest.fn((...args: any[]) => {
    warnings.push(args.join(' '));
  });

  return {
    logs,
    errors,
    warnings,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    }
  };
}

/**
 * Create mock database connection
 */
export function createMockDatabase() {
  return {
    query: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    transaction: jest.fn()
  };
}

/**
 * Create mock HTTP client
 */
export function createMockHttpClient() {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    request: jest.fn()
  };
}

/**
 * Validate table output format
 */
export function validateTableOutput(output: string): boolean {
  return output.includes('─') && output.includes('│');
}

/**
 * Validate JSON output format
 */
export function validateJsonOutput(output: string): boolean {
  try {
    JSON.parse(output);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate CSV output format
 */
export function validateCsvOutput(output: string): boolean {
  const lines = output.trim().split('\n');
  return lines.length > 0 && lines[0].includes(',');
}

/**
 * Create test timeout wrapper
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

/**
 * Assert array contains elements
 */
export function assertArrayContains<T>(
  array: T[],
  elements: T[],
  message?: string
): void {
  const missing = elements.filter(el => !array.includes(el));
  if (missing.length > 0) {
    throw new Error(
      message || `Array missing elements: ${missing.join(', ')}`
    );
  }
}

/**
 * Assert object has keys
 */
export function assertObjectHasKeys(
  obj: any,
  keys: string[],
  message?: string
): void {
  const missing = keys.filter(key => !(key in obj));
  if (missing.length > 0) {
    throw new Error(
      message || `Object missing keys: ${missing.join(', ')}`
    );
  }
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Generate random string
 */
export function randomString(length = 10): string {
  return Math.random().toString(36).substring(2, length + 2);
}

/**
 * Generate random number
 */
export function randomNumber(min = 0, max = 100): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Mock timer for testing
 */
export function createMockTimer() {
  let time = Date.now();

  return {
    now: () => time,
    advance: (ms: number) => { time += ms; },
    reset: () => { time = Date.now(); }
  };
}

/**
 * Assert async throws
 */
export async function assertAsyncThrows(
  fn: () => Promise<any>,
  expectedError?: string | RegExp
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error: any) {
    if (expectedError) {
      if (typeof expectedError === 'string') {
        if (!error.message.includes(expectedError)) {
          throw new Error(
            `Expected error message to include "${expectedError}", got "${error.message}"`
          );
        }
      } else if (!expectedError.test(error.message)) {
        throw new Error(
          `Expected error message to match ${expectedError}, got "${error.message}"`
        );
      }
    }
  }
}

/**
 * Create retry wrapper for flaky tests
 */
export async function retry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 100
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (i < attempts - 1) {
        await waitFor(delayMs);
      }
    }
  }

  throw lastError;
}
