/**
 * Backtesting Redux Slice
 * Complete state management for backtesting system
 *
 * IMPROVEMENTS:
 * - Enhanced error handling with retry logic
 * - Request timeout (30 seconds)
 * - Response validation
 * - Safe selectors with null fallbacks
 * - Better error messages
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';
import {
  BacktestRequest,
  BacktestResult,
  BacktestStatus,
  BacktestingState,
  BacktestUIState,
  PaperComparison,
  LiveComparison,
  OptimizationResult,
  OptimizationTrial,
  DataAvailability,
  OHLCV,
  DEFAULT_BACKTEST_CONFIG
} from '../types/backtesting';
import {
  fetchWithRetry,
  createAppError,
  parseAndValidateResponse
} from '../utils/error-handler';
import {
  createSafeSelector,
  createArraySelector,
  DEFAULT_BACKTEST_RESULT,
  createEntitySelector
} from '../utils/redux-helpers';

// ============================================================================
// ASYNC THUNKS
// ============================================================================

/**
 * Start a new backtest
 * Enhanced with retry logic, timeout, and better error handling
 */
export const startBacktest = createAsyncThunk(
  'backtesting/startBacktest',
  async (request: BacktestRequest, { rejectWithValue }) => {
    try {
      const response = await fetchWithRetry('/api/backtesting/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        timeout: 30000,
        retryOptions: {
          maxAttempts: 3,
          initialDelayMs: 1000
        }
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(
          createAppError(
            { statusCode: response.status, message: error.message || 'Failed to start backtest' },
            'Failed to start backtest'
          )
        );
      }

      const data = await parseAndValidateResponse(response, {
        id: { type: 'string', required: true },
        status: { type: 'string', required: true }
      });

      return data;
    } catch (error: any) {
      const appError = createAppError(error, 'Failed to start backtest');
      return rejectWithValue(appError);
    }
  }
);

/**
 * Get backtest status
 */
export const getBacktestStatus = createAsyncThunk(
  'backtesting/getBacktestStatus',
  async (backtestId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/backtesting/backtest/${backtestId}`);

      if (!response.ok) {
        return rejectWithValue('Failed to fetch backtest status');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Get detailed backtest results
 */
export const getBacktestResults = createAsyncThunk(
  'backtesting/getBacktestResults',
  async (backtestId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/backtesting/results/${backtestId}`);

      if (!response.ok) {
        return rejectWithValue('Failed to fetch results');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * List user's backtest results
 */
export const listBacktestResults = createAsyncThunk(
  'backtesting/listBacktestResults',
  async (params?: { symbol?: string; status?: string }, { rejectWithValue }) => {
    try {
      const query = new URLSearchParams();
      if (params?.symbol) query.append('symbol', params.symbol);
      if (params?.status) query.append('status', params.status);

      const response = await fetch(`/api/backtesting/results?${query}`);

      if (!response.ok) {
        return rejectWithValue('Failed to fetch results');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Cancel a running backtest
 */
export const cancelBacktest = createAsyncThunk(
  'backtesting/cancelBacktest',
  async (backtestId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/backtesting/backtest/${backtestId}/cancel`, {
        method: 'POST'
      });

      if (!response.ok) {
        return rejectWithValue('Failed to cancel backtest');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Delete backtest results
 */
export const deleteBacktestResults = createAsyncThunk(
  'backtesting/deleteBacktestResults',
  async (backtestId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/backtesting/results/${backtestId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        return rejectWithValue('Failed to delete results');
      }

      return { backtestId };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Get available symbols
 */
export const getAvailableSymbols = createAsyncThunk(
  'backtesting/getAvailableSymbols',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/backtesting/data/symbols');

      if (!response.ok) {
        return rejectWithValue('Failed to fetch symbols');
      }

      const data = await response.json();
      return data.symbols || [];
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Get data availability for symbol
 */
export const getDataAvailability = createAsyncThunk(
  'backtesting/getDataAvailability',
  async (symbol: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/backtesting/data/${symbol}`);

      if (!response.ok) {
        return rejectWithValue('Failed to fetch data availability');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Sync historical data
 */
export const syncHistoricalData = createAsyncThunk(
  'backtesting/syncHistoricalData',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/backtesting/data/sync', {
        method: 'POST'
      });

      if (!response.ok) {
        return rejectWithValue('Failed to start sync');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Get performance metrics
 */
export const getBacktestMetrics = createAsyncThunk(
  'backtesting/getBacktestMetrics',
  async (backtestId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/backtesting/results/${backtestId}/metrics`);

      if (!response.ok) {
        return rejectWithValue('Failed to fetch metrics');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Get equity history
 */
export const getEquityHistory = createAsyncThunk(
  'backtesting/getEquityHistory',
  async (backtestId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/backtesting/results/${backtestId}/equity-history`);

      if (!response.ok) {
        return rejectWithValue('Failed to fetch equity history');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Get backtest vs paper comparison
 */
export const getBacktestVsPaperComparison = createAsyncThunk(
  'backtesting/getBacktestVsPaperComparison',
  async (backtestId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/backtesting/results/${backtestId}/vs-paper`);

      if (!response.ok) {
        return rejectWithValue('Failed to fetch comparison');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Get backtest vs live comparison
 */
export const getBacktestVsLiveComparison = createAsyncThunk(
  'backtesting/getBacktestVsLiveComparison',
  async (backtestId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/backtesting/results/${backtestId}/vs-live`);

      if (!response.ok) {
        return rejectWithValue('Failed to fetch comparison');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Start parameter optimization
 */
export const startOptimization = createAsyncThunk(
  'backtesting/startOptimization',
  async (
    params: {
      symbol: string;
      strategyName: string;
      parameterGrid: Record<string, any>;
      objectiveMetric: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch('/api/backtesting/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        return rejectWithValue('Failed to start optimization');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Get optimization progress
 */
export const getOptimizationProgress = createAsyncThunk(
  'backtesting/getOptimizationProgress',
  async (optimizationId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/backtesting/optimize/${optimizationId}`);

      if (!response.ok) {
        return rejectWithValue('Failed to fetch progress');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Get optimization results
 */
export const getOptimizationResults = createAsyncThunk(
  'backtesting/getOptimizationResults',
  async (optimizationId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/backtesting/optimize/${optimizationId}/results`);

      if (!response.ok) {
        return rejectWithValue('Failed to fetch results');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialBacktestingState: BacktestingState = {
  backtests: {},
  results: {},
  availableSymbols: [],
  dataAvailability: {},
  historicalData: {},
  paperComparisons: {},
  liveComparisons: {},
  optimizations: {},
  optimizationTrials: {},
  showDetailedMetrics: false,
  chartTimeframe: '1d',
  loading: false
};

const initialUIState: BacktestUIState = {
  activeScreen: 'setup',
  setupForm: {
    symbol: 'AAPL',
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    initialCapital: DEFAULT_BACKTEST_CONFIG.initialCapital,
    commission: DEFAULT_BACKTEST_CONFIG.commission,
    slippage: DEFAULT_BACKTEST_CONFIG.slippage
  },
  selectedMetric: 'sharpeRatio',
  chartType: 'equity',
  timeframeFilter: [],
  sortBy: 'date',
  sortOrder: 'desc',
  filterStatus: ['completed']
};

// ============================================================================
// REDUCER SLICES
// ============================================================================

const backtestingSlice = createSlice({
  name: 'backtesting',
  initialState: initialBacktestingState,
  reducers: {
    // Manual actions
    setActiveBacktest: (state, action: PayloadAction<string>) => {
      state.activeBacktestId = action.payload;
    },

    setSelectedBacktest: (state, action: PayloadAction<string | undefined>) => {
      state.selectedBacktestId = action.payload;
    },

    setSelectedTrade: (state, action: PayloadAction<string | undefined>) => {
      state.selectedTradeId = action.payload;
    },

    toggleDetailedMetrics: (state) => {
      state.showDetailedMetrics = !state.showDetailedMetrics;
    },

    setChartTimeframe: (
      state,
      action: PayloadAction<'1d' | '1w' | '1mo'>
    ) => {
      state.chartTimeframe = action.payload;
    },

    setSyncProgress: (state, action: PayloadAction<number>) => {
      state.syncProgress = action.payload;
    },

    clearError: (state) => {
      state.error = undefined;
    },

    resetState: () => initialBacktestingState
  },

  // Async thunk handlers
  extraReducers: (builder) => {
    // Start Backtest
    builder
      .addCase(startBacktest.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(startBacktest.fulfilled, (state, action) => {
        state.loading = false;
        const backtestId = action.payload.id;
        state.activeBacktestId = backtestId;
        state.backtests[backtestId] = {
          id: backtestId,
          symbol: action.payload.symbol,
          status: 'running',
          progress: 0,
          startedAt: new Date()
        };
      })
      .addCase(startBacktest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Get Backtest Status
    builder
      .addCase(getBacktestStatus.pending, (state) => {
        state.loading = true;
      })
      .addCase(getBacktestStatus.fulfilled, (state, action) => {
        state.loading = false;
        const id = action.payload.id;
        state.backtests[id] = {
          id,
          symbol: action.payload.symbol,
          status: action.payload.status as any,
          progress: action.payload.progress,
          error: action.payload.error,
          completedAt: action.payload.completedAt
            ? new Date(action.payload.completedAt)
            : undefined
        };
      })
      .addCase(getBacktestStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Get Backtest Results
    builder
      .addCase(getBacktestResults.pending, (state) => {
        state.loading = true;
      })
      .addCase(getBacktestResults.fulfilled, (state, action) => {
        state.loading = false;
        const result = action.payload;
        state.results[result.id] = result;
      })
      .addCase(getBacktestResults.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // List Backtest Results
    builder
      .addCase(listBacktestResults.pending, (state) => {
        state.loading = true;
      })
      .addCase(listBacktestResults.fulfilled, (state, action) => {
        state.loading = false;
        const results = action.payload.results || [];
        results.forEach((result: any) => {
          state.results[result.id] = result;
        });
      })
      .addCase(listBacktestResults.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Cancel Backtest
    builder
      .addCase(cancelBacktest.fulfilled, (state, action: any) => {
        // Update backtest status
        const backtestId = action.meta.arg;
        if (state.backtests[backtestId]) {
          state.backtests[backtestId].status = 'cancelled';
        }
      })
      .addCase(cancelBacktest.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Delete Backtest Results
    builder
      .addCase(deleteBacktestResults.fulfilled, (state, action: any) => {
        const backtestId = action.payload.backtestId;
        delete state.results[backtestId];
        delete state.backtests[backtestId];
      })
      .addCase(deleteBacktestResults.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Get Available Symbols
    builder
      .addCase(getAvailableSymbols.fulfilled, (state, action) => {
        state.availableSymbols = action.payload;
      })
      .addCase(getAvailableSymbols.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Get Data Availability
    builder
      .addCase(getDataAvailability.fulfilled, (state, action) => {
        state.dataAvailability[action.payload.symbol] = action.payload;
      })
      .addCase(getDataAvailability.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Sync Historical Data
    builder
      .addCase(syncHistoricalData.pending, (state) => {
        state.syncProgress = 0;
      })
      .addCase(syncHistoricalData.fulfilled, (state) => {
        state.syncProgress = 100;
      })
      .addCase(syncHistoricalData.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Get Backtest Metrics
    builder.addCase(getBacktestMetrics.fulfilled, (state, action) => {
      const backtestId = action.meta.arg;
      if (state.results[backtestId]) {
        state.results[backtestId].metrics = action.payload.metrics;
      }
    });

    // Get Equity History
    builder.addCase(getEquityHistory.fulfilled, (state, action) => {
      const backtestId = action.meta.arg;
      if (state.results[backtestId]) {
        state.results[backtestId].equityCurve = action.payload;
      }
    });

    // Get Comparisons
    builder.addCase(getBacktestVsPaperComparison.fulfilled, (state, action) => {
      const backtestId = action.meta.arg;
      state.paperComparisons[backtestId] = action.payload;
    });

    builder.addCase(getBacktestVsLiveComparison.fulfilled, (state, action) => {
      const backtestId = action.meta.arg;
      state.liveComparisons[backtestId] = action.payload;
    });

    // Optimization thunks
    builder.addCase(startOptimization.fulfilled, (state, action) => {
      state.backtests[action.payload.id] = {
        id: action.payload.id,
        symbol: action.meta.arg.symbol,
        status: 'running',
        progress: 0,
        startedAt: new Date()
      };
    });

    builder.addCase(getOptimizationProgress.fulfilled, (state, action) => {
      // Update optimization progress
    });

    builder.addCase(getOptimizationResults.fulfilled, (state, action) => {
      // Store optimization results
    });
  }
});

// ============================================================================
// UI SLICE
// ============================================================================

const backtestingUISlice = createSlice({
  name: 'backtestingUI',
  initialState: initialUIState,
  reducers: {
    setActiveScreen: (
      state,
      action: PayloadAction<'setup' | 'results' | 'optimization' | 'history'>
    ) => {
      state.activeScreen = action.payload;
    },

    updateSetupForm: (state, action: PayloadAction<Partial<BacktestUIState['setupForm']>>) => {
      state.setupForm = { ...state.setupForm, ...action.payload };
    },

    setSelectedMetric: (state, action: PayloadAction<keyof typeof state.setupForm>) => {
      state.selectedMetric = action.payload as any;
    },

    setChartType: (
      state,
      action: PayloadAction<'equity' | 'drawdown' | 'returns' | 'trades'>
    ) => {
      state.chartType = action.payload;
    },

    setSortBy: (
      state,
      action: PayloadAction<'sharpe' | 'return' | 'profit_factor' | 'date' | 'trades'>
    ) => {
      state.sortBy = action.payload;
    },

    setSortOrder: (state, action: PayloadAction<'asc' | 'desc'>) => {
      state.sortOrder = action.payload;
    },

    setFilterStatus: (state, action: PayloadAction<('completed' | 'running' | 'failed')[]>) => {
      state.filterStatus = action.payload;
    },

    resetUIState: () => initialUIState
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

export const backtestingReducer = backtestingSlice.reducer;
export const backtestingUIReducer = backtestingUISlice.reducer;

export const {
  setActiveBacktest,
  setSelectedBacktest,
  setSelectedTrade,
  toggleDetailedMetrics,
  setChartTimeframe,
  setSyncProgress,
  clearError,
  resetState
} = backtestingSlice.actions;

export const {
  setActiveScreen,
  updateSetupForm,
  setSelectedMetric,
  setChartType,
  setSortBy,
  setSortOrder,
  setFilterStatus,
  resetUIState
} = backtestingUISlice.actions;

// ============================================================================
// SELECTORS
// ============================================================================

// ============================================================================
// STATE SELECTORS
// ============================================================================

export const selectBacktestingState = (state: RootState) => state.backtesting;
export const selectBacktestingUIState = (state: RootState) => state.backtestingUI;

/**
 * Safe selector for active backtest with null fallback
 */
export const selectActiveBacktest = createEntitySelector(
  (state: RootState) => state.backtesting.backtests,
  (state: RootState) => state.backtesting.activeBacktestId,
  null
);

/**
 * Safe selector for selected backtest result
 * Returns DEFAULT_BACKTEST_RESULT if not found
 */
export const selectSelectedBacktestResult = createSafeSelector(
  (state: RootState) =>
    state.backtesting.selectedBacktestId
      ? state.backtesting.results[state.backtesting.selectedBacktestId]
      : undefined,
  DEFAULT_BACKTEST_RESULT
);

/**
 * Selector for all backtest results as array
 */
export const selectBacktestResults = createArraySelector(
  (state: RootState) => Object.values(state.backtesting.results)
);

/**
 * Safe selector for available symbols
 */
export const selectAvailableSymbols = createArraySelector(
  (state: RootState) => state.backtesting.availableSymbols
);

/**
 * Selector for loading state
 */
export const selectBacktestLoading = (state: RootState) =>
  state.backtesting.loading ?? false;

/**
 * Safe selector for error state with fallback
 */
export const selectBacktestError = (state: RootState) =>
  state.backtesting.error || null;

/**
 * Safe selector for sync progress
 */
export const selectSyncProgress = (state: RootState) =>
  state.backtesting.syncProgress ?? { current: 0, total: 0, percentage: 0 };

// ============================================================================
// UI STATE SELECTORS
// ============================================================================

/**
 * Selector for setup form
 */
export const selectSetupForm = (state: RootState) =>
  state.backtestingUI.setupForm ?? {
    symbol: 'AAPL',
    startDate: new Date(),
    endDate: new Date(),
    initialCapital: 100000,
    commission: 0.1,
    slippage: 0.05
  };

/**
 * Selector for active screen
 */
export const selectActiveScreen = (state: RootState) =>
  state.backtestingUI.activeScreen ?? 'setup';

export default backtestingSlice;
