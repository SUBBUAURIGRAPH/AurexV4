/**
 * Redux Trading Slice - Trading State Management
 * Handles orders, positions, portfolio, and trading operations
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { TradingState, Order, Position, Portfolio, OrderConfirmation } from '../types';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://apihms.aurex.in/api';

// ==================== Async Thunks ====================

export const fetchPortfolio = createAsyncThunk(
  'trading/fetchPortfolio',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/portfolio`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch portfolio');
    }
  }
);

export const fetchPositions = createAsyncThunk(
  'trading/fetchPositions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/portfolio/positions`);
      return response.data.positions;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch positions');
    }
  }
);

export const fetchOrders = createAsyncThunk(
  'trading/fetchOrders',
  async (filters?: { status?: string; symbol?: string }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/orders`, { params: filters });
      return response.data.orders;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch orders');
    }
  }
);

export const createOrder = createAsyncThunk(
  'trading/createOrder',
  async (
    orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'filledQuantity' | 'averageFillPrice' | 'totalCost' | 'commission' | 'userId'>,
    { rejectWithValue }
  ) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/orders/create`, orderData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create order');
    }
  }
);

export const confirmOrder = createAsyncThunk(
  'trading/confirmOrder',
  async (confirmation: { orderId: string; token: string }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/orders/confirm`, confirmation);
      return response.data.order;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to confirm order');
    }
  }
);

export const cancelOrder = createAsyncThunk(
  'trading/cancelOrder',
  async (orderId: string, { rejectWithValue }) => {
    try {
      await axios.delete(`${API_BASE_URL}/orders/${orderId}`);
      return orderId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cancel order');
    }
  }
);

export const fetchOrderDetails = createAsyncThunk(
  'trading/fetchOrderDetails',
  async (orderId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/orders/${orderId}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch order details');
    }
  }
);

export const syncAllTradingData = createAsyncThunk(
  'trading/syncAllTradingData',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      await Promise.all([
        dispatch(fetchPortfolio()),
        dispatch(fetchPositions()),
        dispatch(fetchOrders())
      ]);
      return Date.now();
    } catch (error: any) {
      return rejectWithValue('Failed to sync trading data');
    }
  }
);

// ==================== Initial State ====================

const initialState: TradingState = {
  orders: [],
  positions: [],
  portfolio: null,
  selectedPosition: null,
  selectedOrder: null,
  pendingConfirmation: null,
  isLoading: false,
  error: null,
  lastSync: 0,
  syncInterval: 60000 // 1 minute
};

// ==================== Trading Slice ====================

export const tradingSlice = createSlice({
  name: 'trading',
  initialState,
  reducers: {
    selectPosition: (state, action: PayloadAction<Position | null>) => {
      state.selectedPosition = action.payload;
    },
    selectOrder: (state, action: PayloadAction<Order | null>) => {
      state.selectedOrder = action.payload;
    },
    setPendingConfirmation: (state, action: PayloadAction<OrderConfirmation | null>) => {
      state.pendingConfirmation = action.payload;
    },
    setSyncInterval: (state, action: PayloadAction<number>) => {
      state.syncInterval = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Fetch Portfolio
    builder
      .addCase(fetchPortfolio.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPortfolio.fulfilled, (state, action) => {
        state.isLoading = false;
        state.portfolio = action.payload;
        state.lastSync = Date.now();
      })
      .addCase(fetchPortfolio.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch Positions
    builder
      .addCase(fetchPositions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPositions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.positions = action.payload;
        state.lastSync = Date.now();
      })
      .addCase(fetchPositions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch Orders
    builder
      .addCase(fetchOrders.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.isLoading = false;
        state.orders = action.payload;
        state.lastSync = Date.now();
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Create Order
    builder
      .addCase(createOrder.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createOrder.fulfilled, (state, action) => {
        state.isLoading = false;
        state.pendingConfirmation = action.payload;
        state.error = null;
      })
      .addCase(createOrder.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Confirm Order
    builder
      .addCase(confirmOrder.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(confirmOrder.fulfilled, (state, action) => {
        state.isLoading = false;
        const existingIndex = state.orders.findIndex(o => o.id === action.payload.id);
        if (existingIndex >= 0) {
          state.orders[existingIndex] = action.payload;
        } else {
          state.orders.unshift(action.payload);
        }
        state.pendingConfirmation = null;
        state.error = null;
      })
      .addCase(confirmOrder.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Cancel Order
    builder
      .addCase(cancelOrder.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cancelOrder.fulfilled, (state, action) => {
        state.isLoading = false;
        state.orders = state.orders.filter(o => o.id !== action.payload);
        state.pendingConfirmation = null;
        state.error = null;
      })
      .addCase(cancelOrder.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch Order Details
    builder
      .addCase(fetchOrderDetails.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOrderDetails.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedOrder = action.payload;
      })
      .addCase(fetchOrderDetails.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Sync All Trading Data
    builder
      .addCase(syncAllTradingData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(syncAllTradingData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.lastSync = action.payload;
      })
      .addCase(syncAllTradingData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  }
});

export const { selectPosition, selectOrder, setPendingConfirmation, setSyncInterval, clearError } = tradingSlice.actions;
export default tradingSlice.reducer;
