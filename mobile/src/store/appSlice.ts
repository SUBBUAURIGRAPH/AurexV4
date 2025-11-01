/**
 * Redux App Slice - Application State Management
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AppState {
  isAppReady: boolean;
  isOffline: boolean;
  appVersion: string;
  lastUpdated: number;
}

const initialState: AppState = {
  isAppReady: false,
  isOffline: false,
  appVersion: '1.0.0',
  lastUpdated: 0
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setAppReady: (state, action: PayloadAction<boolean>) => {
      state.isAppReady = action.payload;
    },
    setOfflineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOffline = action.payload;
    },
    setAppVersion: (state, action: PayloadAction<string>) => {
      state.appVersion = action.payload;
    },
    setLastUpdated: (state) => {
      state.lastUpdated = Date.now();
    }
  }
});

export const { setAppReady, setOfflineStatus, setAppVersion, setLastUpdated } = appSlice.actions;
export default appSlice.reducer;
