/**
 * Dashboard Redux Slice
 * State management for dashboard data (portfolio, trades, holdings)
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

/**
 * Types
 */
export interface Portfolio {
  totalValue: number;
  availableBalance: number;
  cash: number;
  todayReturn: number;
  ytdReturn: number;
  positions: Position[];
  allocation: AssetAllocation[];
  lastUpdated: string;
}

export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  totalValue: number;
  gainLoss: number;
  gainLossPercent: number;
  sector?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  status: 'FILLED' | 'PENDING' | 'CANCELLED';
  quantity: number;
  price: number;
  total: number;
  signalType: 'AI' | 'MANUAL' | 'SIGNAL';
  timestamp: string;
}

export interface AssetAllocation {
  assetClass: string;
  percentage: number;
  value: number;
}

export interface DashboardState {
  portfolio: Portfolio | null;
  trades: Trade[];
  holdings: Position[];
  loading: boolean;
  loadingPortfolio: boolean;
  loadingTrades: boolean;
  loadingHoldings: boolean;
  error: string | null;
  errorPortfolio: string | null;
  errorTrades: string | null;
  errorHoldings: string | null;
  lastUpdated: string | null;
}

/**
 * Initial State
 */
const initialState: DashboardState = {
  portfolio: null,
  trades: [],
  holdings: [],
  loading: false,
  loadingPortfolio: false,
  loadingTrades: false,
  loadingHoldings: false,
  error: null,
  errorPortfolio: null,
  errorTrades: null,
  errorHoldings: null,
  lastUpdated: null
};

/**
 * Async Thunks
 */

/**
 * Fetch Portfolio Data
 */
export const fetchPortfolio = createAsyncThunk<
  Portfolio,
  void,
  { rejectValue: string }
>(
  'dashboard/fetchPortfolio',
  async (_, { rejectWithValue }) => {
    try {
      // In production, this would call an API endpoint
      // For now, we'll simulate the API call
      const response = await fetch('/api/portfolio/summary');

      if (!response.ok) {
        throw new Error(`Portfolio API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch portfolio'
      );
    }
  }
);

/**
 * Fetch Trades Data
 */
export const fetchTrades = createAsyncThunk<
  Trade[],
  void,
  { rejectValue: string }
>(
  'dashboard/fetchTrades',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/trades/recent');

      if (!response.ok) {
        throw new Error(`Trades API error: ${response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data.data) ? data.data : data;
    } catch (error) {
      console.error('Failed to fetch trades:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch trades'
      );
    }
  }
);

/**
 * Fetch Holdings Data
 */
export const fetchHoldings = createAsyncThunk<
  Position[],
  void,
  { rejectValue: string }
>(
  'dashboard/fetchHoldings',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/trades/holdings');

      if (!response.ok) {
        throw new Error(`Holdings API error: ${response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data.data) ? data.data : data;
    } catch (error) {
      console.error('Failed to fetch holdings:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch holdings'
      );
    }
  }
);

/**
 * Dashboard Slice
 */
const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    // Synchronous actions
    clearError: (state) => {
      state.error = null;
      state.errorPortfolio = null;
      state.errorTrades = null;
      state.errorHoldings = null;
    },
    setPortfolio: (state, action: PayloadAction<Portfolio>) => {
      state.portfolio = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
    setTrades: (state, action: PayloadAction<Trade[]>) => {
      state.trades = action.payload;
    },
    setHoldings: (state, action: PayloadAction<Position[]>) => {
      state.holdings = action.payload;
    }
  },
  extraReducers: (builder) => {
    // Fetch Portfolio
    builder
      .addCase(fetchPortfolio.pending, (state) => {
        state.loadingPortfolio = true;
        state.errorPortfolio = null;
      })
      .addCase(fetchPortfolio.fulfilled, (state, action) => {
        state.loadingPortfolio = false;
        state.portfolio = action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchPortfolio.rejected, (state, action) => {
        state.loadingPortfolio = false;
        state.errorPortfolio = action.payload || 'Failed to fetch portfolio';
      });

    // Fetch Trades
    builder
      .addCase(fetchTrades.pending, (state) => {
        state.loadingTrades = true;
        state.errorTrades = null;
      })
      .addCase(fetchTrades.fulfilled, (state, action) => {
        state.loadingTrades = false;
        state.trades = action.payload;
      })
      .addCase(fetchTrades.rejected, (state, action) => {
        state.loadingTrades = false;
        state.errorTrades = action.payload || 'Failed to fetch trades';
      });

    // Fetch Holdings
    builder
      .addCase(fetchHoldings.pending, (state) => {
        state.loadingHoldings = true;
        state.errorHoldings = null;
      })
      .addCase(fetchHoldings.fulfilled, (state, action) => {
        state.loadingHoldings = false;
        state.holdings = action.payload;
      })
      .addCase(fetchHoldings.rejected, (state, action) => {
        state.loadingHoldings = false;
        state.errorHoldings = action.payload || 'Failed to fetch holdings';
      });
  }
});

/**
 * Selectors
 */
export const selectPortfolio = (state: { dashboard: DashboardState }) =>
  state.dashboard.portfolio;

export const selectTrades = (state: { dashboard: DashboardState }) =>
  state.dashboard.trades;

export const selectHoldings = (state: { dashboard: DashboardState }) =>
  state.dashboard.holdings;

export const selectDashboardLoading = (state: { dashboard: DashboardState }) =>
  state.dashboard.loading ||
  state.dashboard.loadingPortfolio ||
  state.dashboard.loadingTrades ||
  state.dashboard.loadingHoldings;

export const selectDashboardError = (state: { dashboard: DashboardState }) =>
  state.dashboard.error ||
  state.dashboard.errorPortfolio ||
  state.dashboard.errorTrades ||
  state.dashboard.errorHoldings;

export const selectLastUpdated = (state: { dashboard: DashboardState }) =>
  state.dashboard.lastUpdated;

/**
 * Actions
 */
export const { clearError, setPortfolio, setTrades, setHoldings } =
  dashboardSlice.actions;

export default dashboardSlice.reducer;
