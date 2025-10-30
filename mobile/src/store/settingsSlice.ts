/**
 * Redux Settings Slice - User Settings and Preferences
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { SettingsState, AppSettings, Theme } from '../types';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://apihms.aurex.in/api';

export const fetchSettings = createAsyncThunk(
  'settings/fetchSettings',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/settings`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch settings');
    }
  }
);

export const saveSettings = createAsyncThunk(
  'settings/saveSettings',
  async (settings: AppSettings, { rejectWithValue }) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/settings`, settings);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to save settings');
    }
  }
);

const defaultSettings: AppSettings = {
  ui: {
    theme: Theme.DARK,
    language: 'en',
    fontSize: 'medium',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
    decimalPlaces: 2,
    showPercentages: true,
    animationsEnabled: true
  },
  notifications: {
    orderNotifications: true,
    priceAlerts: true,
    positionUpdates: true,
    portfolioAlerts: true,
    systemAlerts: true,
    pushEnabled: true
  },
  security: {
    sessionTimeout: 30 * 60 * 1000,
    requireBiometricForTransactions: false,
    requirePINConfirmation: false,
    autoLockTime: 5 * 60 * 1000
  },
  data: {
    autoSyncInterval: 60 * 1000,
    cacheExpiry: 24 * 60 * 60 * 1000,
    offlineMode: true,
    historicalDataDays: 90
  }
};

const initialState: SettingsState = {
  settings: defaultSettings,
  isLoading: false,
  error: null,
  hasUnsavedChanges: false
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateUISetting: (state, action: PayloadAction<{ key: string; value: any }>) => {
      (state.settings.ui as any)[action.payload.key] = action.payload.value;
      state.hasUnsavedChanges = true;
    },
    updateSecuritySetting: (state, action: PayloadAction<{ key: string; value: any }>) => {
      (state.settings.security as any)[action.payload.key] = action.payload.value;
      state.hasUnsavedChanges = true;
    },
    updateDataSetting: (state, action: PayloadAction<{ key: string; value: any }>) => {
      (state.settings.data as any)[action.payload.key] = action.payload.value;
      state.hasUnsavedChanges = true;
    },
    resetSettings: (state) => {
      state.settings = defaultSettings;
      state.hasUnsavedChanges = false;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.settings = action.payload;
        state.hasUnsavedChanges = false;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(saveSettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.settings = action.payload;
        state.hasUnsavedChanges = false;
      })
      .addCase(saveSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  }
});

export const { updateUISetting, updateSecuritySetting, updateDataSetting, resetSettings, clearError } = settingsSlice.actions;
export default settingsSlice.reducer;
