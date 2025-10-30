/**
 * Redux Helper Utilities
 * Patterns and helpers for better Redux store management
 *
 * Features:
 * - Safe selector factories
 * - Default value handling
 * - Memoized selectors
 * - Error-aware state updates
 */

import type { RootState } from '../store';
import { AppError, ErrorType } from './error-handler';

// ============================================================================
// SAFE SELECTOR FACTORIES
// ============================================================================

/**
 * Create a selector with default value fallback
 */
export function createSafeSelector<T, D>(
  selector: (state: RootState) => T | undefined,
  defaultValue: D
): (state: RootState) => T | D {
  return (state: RootState) => {
    const value = selector(state);
    return value !== undefined && value !== null ? value : defaultValue;
  };
}

/**
 * Create a selector that returns array with default fallback
 */
export function createArraySelector<T>(
  selector: (state: RootState) => T[] | undefined
): (state: RootState) => T[] {
  return (state: RootState) => {
    const value = selector(state);
    return Array.isArray(value) ? value : [];
  };
}

/**
 * Create a selector that returns object with default fallback
 */
export function createObjectSelector<T extends object>(
  selector: (state: RootState) => T | undefined,
  defaultValue: T = {} as T
): (state: RootState) => T {
  return (state: RootState) => {
    const value = selector(state);
    return value && typeof value === 'object' ? value : defaultValue;
  };
}

// ============================================================================
// COMMON DEFAULT VALUES
// ============================================================================

export const DEFAULT_BACKTEST_RESULT = {
  id: '',
  symbol: '',
  status: 'pending' as const,
  metrics: {
    totalReturn: 0,
    annualizedReturn: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    calmarRatio: 0,
    volatility: 0,
    winRate: 0,
    profitFactor: 0,
    totalTrades: 0,
    avgWin: 0,
    avgLoss: 0
  },
  trades: [],
  equityCurve: []
};

export const DEFAULT_ERROR: AppError = {
  type: ErrorType.UNKNOWN_ERROR,
  message: '',
  timestamp: Date.now(),
  userFriendlyMessage: 'An error occurred'
};

export const DEFAULT_SYNC_PROGRESS = {
  current: 0,
  total: 0,
  percentage: 0,
  status: 'idle' as const
};

// ============================================================================
// SELECTOR FACTORIES FOR COMMON PATTERNS
// ============================================================================

/**
 * Create selector for optional entity by ID
 */
export function createEntitySelector<T extends { id: string }>(
  parentSelector: (state: RootState) => Record<string, T>,
  idSelector: (state: RootState) => string | undefined,
  defaultValue: T | null = null
) {
  return (state: RootState): T | null => {
    const id = idSelector(state);
    if (!id) return defaultValue;

    const entity = parentSelector(state)[id];
    return entity || defaultValue;
  };
}

/**
 * Create selector for entity collection
 */
export function createCollectionSelector<T extends { id: string }>(
  parentSelector: (state: RootState) => Record<string, T>,
  filterFn?: (entity: T) => boolean
) {
  return (state: RootState): T[] => {
    const collection = parentSelector(state);
    const items = Object.values(collection);

    if (filterFn) {
      return items.filter(filterFn);
    }

    return items;
  };
}

/**
 * Create selector for loading state with dependent operation
 */
export function createLoadingSelector(
  operationName: string,
  loadingState: Record<string, boolean>
): boolean {
  return loadingState[operationName] || false;
}

// ============================================================================
// LOADING STATE MANAGEMENT
// ============================================================================

export interface OperationState {
  loading: boolean;
  error: AppError | null;
  lastUpdated?: number;
}

/**
 * Create initial operation state
 */
export function createOperationState(): OperationState {
  return {
    loading: false,
    error: null
  };
}

/**
 * Reducer for common async operation pattern
 */
export const createAsyncReducers = <T extends any>(
  actionName: string
) => ({
  pending: (state: OperationState) => {
    state.loading = true;
    state.error = null;
  },
  fulfilled: (state: OperationState, data?: T) => {
    state.loading = false;
    state.error = null;
    state.lastUpdated = Date.now();
    return data;
  },
  rejected: (state: OperationState, error: AppError) => {
    state.loading = false;
    state.error = error;
  }
});

// ============================================================================
// MEMOIZATION HELPERS
// ============================================================================

/**
 * Simple memoization for selectors
 */
export function memoizeSelector<Args extends any[], Result>(
  fn: (...args: Args) => Result
): (...args: Args) => Result {
  let lastArgs: Args | null = null;
  let lastResult: Result;

  return (...args: Args): Result => {
    if (!lastArgs || !argsEqual(args, lastArgs)) {
      lastArgs = args;
      lastResult = fn(...args);
    }
    return lastResult;
  };
}

function argsEqual<T extends any[]>(a: T, b: T): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ============================================================================
// STATE NORMALIZATION
// ============================================================================

/**
 * Normalize array of entities by ID
 */
export function normalizeEntities<T extends { id: string }>(
  items: T[]
): Record<string, T> {
  return items.reduce(
    (acc, item) => {
      acc[item.id] = item;
      return acc;
    },
    {} as Record<string, T>
  );
}

/**
 * Denormalize entity collection
 */
export function denormalizeEntities<T extends { id: string }>(
  entities: Record<string, T>,
  ids?: string[]
): T[] {
  if (ids) {
    return ids.map(id => entities[id]).filter(Boolean);
  }
  return Object.values(entities);
}

// ============================================================================
// ERROR STATE HELPERS
// ============================================================================

/**
 * Check if state has error
 */
export function hasError(state: any): boolean {
  return state.error !== null && state.error !== undefined;
}

/**
 * Get error message with fallback
 */
export function getErrorMessage(error: AppError | null | undefined): string {
  if (!error) return '';
  return error.userFriendlyMessage || error.message || 'An error occurred';
}

/**
 * Clear error from state
 */
export function clearError<T extends { error: any }>(state: T): void {
  state.error = null;
}
