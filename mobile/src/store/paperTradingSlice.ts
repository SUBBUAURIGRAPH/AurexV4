/**
 * Redux Paper Trading Slice
 * State management for paper trading functionality
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import {
  PaperTradingState,
  PaperTradingAccount,
  PaperTradingOrder,
  PaperTradingPosition,
  PaperTradingPerformance,
  CreateAccountRequest,
  SubmitOrderRequest
} from '../types/paperTrading';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://apihms.aurex.in/api';

// ==================== Async Thunks ====================

// Account operations
export const fetchPaperAccounts = createAsyncThunk(
  'paperTrading/fetchAccounts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/paper-trading/accounts`);
      return response.data.accounts;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch accounts');
    }
  }
);

export const createPaperAccount = createAsyncThunk(
  'paperTrading/createAccount',
  async (request: CreateAccountRequest, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/paper-trading/accounts`, request);
      return response.data.account;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create account');
    }
  }
);

export const fetchPaperAccount = createAsyncThunk(
  'paperTrading/fetchAccount',
  async (accountId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/paper-trading/accounts/${accountId}`);
      return response.data.account;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch account');
    }
  }
);

export const updatePaperAccount = createAsyncThunk(
  'paperTrading/updateAccount',
  async ({ accountId, settings }: { accountId: string; settings: any }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/paper-trading/accounts/${accountId}`, settings);
      return response.data.account;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update account');
    }
  }
);

// Order operations
export const submitPaperOrder = createAsyncThunk(
  'paperTrading/submitOrder',
  async ({ accountId, order }: { accountId: string; order: SubmitOrderRequest }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/paper-trading/accounts/${accountId}/orders`, order);
      return response.data.order;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit order');
    }
  }
);

export const fetchPaperOrders = createAsyncThunk(
  'paperTrading/fetchOrders',
  async ({ accountId, filters }: { accountId: string; filters?: any }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/paper-trading/accounts/${accountId}/orders`, {
        params: filters
      });
      return response.data.orders;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch orders');
    }
  }
);

export const fetchPaperOrder = createAsyncThunk(
  'paperTrading/fetchOrder',
  async (orderId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/paper-trading/orders/${orderId}`);
      return response.data.order;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch order');
    }
  }
);

// Position operations
export const fetchPaperPositions = createAsyncThunk(
  'paperTrading/fetchPositions',
  async (accountId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/paper-trading/accounts/${accountId}/positions`);
      return response.data.positions;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch positions');
    }
  }
);

export const refreshPaperPositions = createAsyncThunk(
  'paperTrading/refreshPositions',
  async (accountId: string, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/paper-trading/accounts/${accountId}/positions/refresh`);
      return response.data.positions;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to refresh positions');
    }
  }
);

// Performance operations
export const fetchPaperPerformance = createAsyncThunk(
  'paperTrading/fetchPerformance',
  async (accountId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/paper-trading/accounts/${accountId}/performance`);
      return response.data.performance;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch performance');
    }
  }
);

export const fetchEquityHistory = createAsyncThunk(
  'paperTrading/fetchEquityHistory',
  async ({ accountId, filters }: { accountId: string; filters?: any }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/paper-trading/accounts/${accountId}/equity-history`, {
        params: filters
      });
      return response.data.equityHistory;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch equity history');
    }
  }
);

// Sync all paper trading data
export const syncAllPaperTradingData = createAsyncThunk(
  'paperTrading/syncAll',
  async (accountId: string, { dispatch, rejectWithValue }) => {
    try {
      await Promise.all([
        dispatch(fetchPaperAccount(accountId)),
        dispatch(fetchPaperPositions(accountId)),
        dispatch(fetchPaperOrders({ accountId, filters: { limit: 50 } })),
        dispatch(fetchPaperPerformance(accountId))
      ]);
      return Date.now();
    } catch (error: any) {
      return rejectWithValue('Failed to sync paper trading data');
    }
  }
);

// ==================== Initial State ====================

const initialState: PaperTradingState = {
  accounts: [],
  activeAccountId: null,
  activeAccount: null,
  orders: [],
  selectedOrder: null,
  positions: [],
  selectedPosition: null,
  performance: null,
  equityHistory: [],
  settings: null,
  isPaperMode: false,
  showComparison: false,
  isLoading: false,
  error: null,
  lastSync: 0
};

// ==================== Paper Trading Slice ====================

export const paperTradingSlice = createSlice({
  name: 'paperTrading',
  initialState,
  reducers: {
    // Account management
    setActiveAccount: (state, action: PayloadAction<string | null>) => {
      state.activeAccountId = action.payload;
      state.activeAccount = state.accounts.find(a => a.id === action.payload) || null;
    },

    // Mode toggle
    setPaperMode: (state, action: PayloadAction<boolean>) => {
      state.isPaperMode = action.payload;
    },

    togglePaperMode: (state) => {
      state.isPaperMode = !state.isPaperMode;
    },

    // Selection
    selectPaperOrder: (state, action: PayloadAction<PaperTradingOrder | null>) => {
      state.selectedOrder = action.payload;
    },

    selectPaperPosition: (state, action: PayloadAction<PaperTradingPosition | null>) => {
      state.selectedPosition = action.payload;
    },

    // Comparison
    toggleComparison: (state) => {
      state.showComparison = !state.showComparison;
    },

    // Error handling
    clearPaperError: (state) => {
      state.error = null;
    },

    // Reset
    resetPaperTrading: (state) => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    // Fetch Accounts
    builder
      .addCase(fetchPaperAccounts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPaperAccounts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accounts = action.payload;
        state.lastSync = Date.now();

        // Set first account as active if none selected
        if (!state.activeAccountId && action.payload.length > 0) {
          state.activeAccountId = action.payload[0].id;
          state.activeAccount = action.payload[0];
        }
      })
      .addCase(fetchPaperAccounts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Create Account
    builder
      .addCase(createPaperAccount.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createPaperAccount.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accounts.push(action.payload);
        state.activeAccountId = action.payload.id;
        state.activeAccount = action.payload;
        state.lastSync = Date.now();
      })
      .addCase(createPaperAccount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch Account
    builder
      .addCase(fetchPaperAccount.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPaperAccount.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.accounts.findIndex(a => a.id === action.payload.id);
        if (index >= 0) {
          state.accounts[index] = action.payload;
        } else {
          state.accounts.push(action.payload);
        }
        if (state.activeAccountId === action.payload.id) {
          state.activeAccount = action.payload;
        }
        state.lastSync = Date.now();
      })
      .addCase(fetchPaperAccount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Update Account
    builder
      .addCase(updatePaperAccount.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updatePaperAccount.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.accounts.findIndex(a => a.id === action.payload.id);
        if (index >= 0) {
          state.accounts[index] = action.payload;
        }
        if (state.activeAccountId === action.payload.id) {
          state.activeAccount = action.payload;
        }
      })
      .addCase(updatePaperAccount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Submit Order
    builder
      .addCase(submitPaperOrder.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(submitPaperOrder.fulfilled, (state, action) => {
        state.isLoading = false;
        state.orders.unshift(action.payload);
        state.error = null;
      })
      .addCase(submitPaperOrder.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch Orders
    builder
      .addCase(fetchPaperOrders.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPaperOrders.fulfilled, (state, action) => {
        state.isLoading = false;
        state.orders = action.payload;
        state.lastSync = Date.now();
      })
      .addCase(fetchPaperOrders.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch Order
    builder
      .addCase(fetchPaperOrder.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPaperOrder.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedOrder = action.payload;
      })
      .addCase(fetchPaperOrder.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch Positions
    builder
      .addCase(fetchPaperPositions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPaperPositions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.positions = action.payload;
        state.lastSync = Date.now();
      })
      .addCase(fetchPaperPositions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Refresh Positions
    builder
      .addCase(refreshPaperPositions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(refreshPaperPositions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.positions = action.payload;
        state.lastSync = Date.now();
      })
      .addCase(refreshPaperPositions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch Performance
    builder
      .addCase(fetchPaperPerformance.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPaperPerformance.fulfilled, (state, action) => {
        state.isLoading = false;
        state.performance = action.payload;
        state.lastSync = Date.now();
      })
      .addCase(fetchPaperPerformance.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch Equity History
    builder
      .addCase(fetchEquityHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchEquityHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.equityHistory = action.payload;
        state.lastSync = Date.now();
      })
      .addCase(fetchEquityHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Sync All
    builder
      .addCase(syncAllPaperTradingData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(syncAllPaperTradingData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.lastSync = action.payload;
      })
      .addCase(syncAllPaperTradingData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  }
});

export const {
  setActiveAccount,
  setPaperMode,
  togglePaperMode,
  selectPaperOrder,
  selectPaperPosition,
  toggleComparison,
  clearPaperError,
  resetPaperTrading
} = paperTradingSlice.actions;

export default paperTradingSlice.reducer;
