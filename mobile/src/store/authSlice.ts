/**
 * Redux Auth Slice - Authentication State Management
 * Handles user authentication, tokens, biometric setup, and session management
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, AuthUser, JWTToken, BiometricType } from '../types';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://apihms.aurex.in/api';

// ==================== Async Thunks ====================

export const loginWithEmailPassword = createAsyncThunk(
  'auth/loginWithEmailPassword',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
      const { user, tokens } = response.data;

      // Store tokens securely
      await SecureStore.setItemAsync('accessToken', tokens.accessToken);
      await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);

      return { user, tokens };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const loginWithBiometric = createAsyncThunk(
  'auth/loginWithBiometric',
  async (biometricData: { deviceId: string; biometricType: BiometricType }, { rejectWithValue }) => {
    try {
      const storedToken = await SecureStore.getItemAsync('biometricToken');
      if (!storedToken) {
        throw new Error('Biometric token not found. Please login with email/password first.');
      }

      const response = await axios.post(
        `${API_BASE_URL}/auth/biometric-login`,
        biometricData,
        {
          headers: {
            Authorization: `Bearer ${storedToken}`
          }
        }
      );

      const { user, tokens } = response.data;

      // Store tokens securely
      await SecureStore.setItemAsync('accessToken', tokens.accessToken);
      await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);

      return { user, tokens };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Biometric login failed');
    }
  }
);

export const refreshAccessToken = createAsyncThunk(
  'auth/refreshAccessToken',
  async (_, { rejectWithValue }) => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post(
        `${API_BASE_URL}/auth/refresh-token`,
        { refreshToken }
      );

      const { tokens } = response.data;

      // Store new tokens securely
      await SecureStore.setItemAsync('accessToken', tokens.accessToken);
      await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);

      return tokens;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Token refresh failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');

      // Notify server about logout
      if (accessToken) {
        await axios.post(
          `${API_BASE_URL}/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );
      }

      // Clear stored credentials
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('biometricToken');

      return null;
    } catch (error: any) {
      console.error('Logout error:', error);
      // Still clear local storage even if server request fails
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      return rejectWithValue(error.response?.data?.message || 'Logout failed');
    }
  }
);

export const registerBiometric = createAsyncThunk(
  'auth/registerBiometric',
  async (
    data: { biometricType: BiometricType; hashedFingerprint: string },
    { rejectWithValue }
  ) => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');

      const response = await axios.post(
        `${API_BASE_URL}/auth/register-biometric`,
        data,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      const { biometricToken } = response.data;

      // Store biometric token securely
      await SecureStore.setItemAsync('biometricToken', biometricToken);

      return { biometricType: data.biometricType, isEnabled: true };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Biometric registration failed');
    }
  }
);

export const validateSession = createAsyncThunk(
  'auth/validateSession',
  async (_, { rejectWithValue }) => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      if (!accessToken) {
        throw new Error('No access token');
      }

      const response = await axios.get(
        `${API_BASE_URL}/auth/validate-session`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Session validation failed');
    }
  }
);

// ==================== Initial State ====================

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  isBiometricEnabled: false,
  biometricType: null,
  error: null,
  lastLoginTime: null,
  sessionTimeout: 30 * 60 * 1000 // 30 minutes
};

// ==================== Auth Slice ====================

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSessionTimeout: (state, action: PayloadAction<number>) => {
      state.sessionTimeout = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    setLastLoginTime: (state) => {
      state.lastLoginTime = Date.now();
    }
  },
  extraReducers: (builder) => {
    // Login with Email/Password
    builder
      .addCase(loginWithEmailPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginWithEmailPassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.tokens = action.payload.tokens;
        state.lastLoginTime = Date.now();
        state.error = null;
      })
      .addCase(loginWithEmailPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // Login with Biometric
    builder
      .addCase(loginWithBiometric.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginWithBiometric.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.tokens = action.payload.tokens;
        state.lastLoginTime = Date.now();
        state.error = null;
      })
      .addCase(loginWithBiometric.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Refresh Token
    builder
      .addCase(refreshAccessToken.pending, (state) => {
        // Don't set loading to true as we want silent refresh
      })
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.tokens = action.payload;
        state.error = null;
      })
      .addCase(refreshAccessToken.rejected, (state, action) => {
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.user = null;
        state.tokens = null;
      });

    // Logout
    builder
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.tokens = null;
        state.error = null;
        state.isBiometricEnabled = false;
        state.biometricType = null;
        state.lastLoginTime = null;
      })
      .addCase(logout.rejected, (state) => {
        state.isLoading = false;
        // Still clear state even if logout fails
        state.isAuthenticated = false;
        state.user = null;
        state.tokens = null;
        state.isBiometricEnabled = false;
        state.biometricType = null;
      });

    // Register Biometric
    builder
      .addCase(registerBiometric.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerBiometric.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isBiometricEnabled = action.payload.isEnabled;
        state.biometricType = action.payload.biometricType;
        state.error = null;
      })
      .addCase(registerBiometric.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Validate Session
    builder
      .addCase(validateSession.pending, (state) => {
        // Silent validation
      })
      .addCase(validateSession.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(validateSession.rejected, (state, action) => {
        state.isAuthenticated = false;
        state.error = action.payload as string;
      });
  }
});

export const { setSessionTimeout, clearError, setLastLoginTime } = authSlice.actions;
export default authSlice.reducer;
