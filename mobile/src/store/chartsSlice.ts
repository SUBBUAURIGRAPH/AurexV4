/**
 * Redux Charts Slice - Chart and Analytics State Management
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ChartsState, ChartData } from '../types';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://apihms.aurex.in/api';

export const fetchChartData = createAsyncThunk(
  'charts/fetchChartData',
  async (params: { symbol: string; interval: string }, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/charts/history/${params.symbol}`,
        { params: { interval: params.interval } }
      );
      return { symbol: params.symbol, data: response.data };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch chart data');
    }
  }
);

export const fetchPortfolioCharts = createAsyncThunk(
  'charts/fetchPortfolioCharts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/portfolio/performance`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch portfolio charts');
    }
  }
);

const initialState: ChartsState = {
  chartData: {},
  portfolioCharts: {},
  analytics: [],
  selectedSymbol: null,
  chartTimeframe: '1D',
  isLoading: false,
  error: null,
  lastUpdate: 0
};

export const chartsSlice = createSlice({
  name: 'charts',
  initialState,
  reducers: {
    selectSymbol: (state, action: PayloadAction<string>) => {
      state.selectedSymbol = action.payload;
    },
    setTimeframe: (state, action: PayloadAction<'1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'>) => {
      state.chartTimeframe = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChartData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchChartData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.chartData[action.payload.symbol] = action.payload.data;
        state.lastUpdate = Date.now();
      })
      .addCase(fetchChartData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(fetchPortfolioCharts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPortfolioCharts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.portfolioCharts = action.payload;
        state.lastUpdate = Date.now();
      })
      .addCase(fetchPortfolioCharts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  }
});

export const { selectSymbol, setTimeframe, clearError } = chartsSlice.actions;
export default chartsSlice.reducer;
