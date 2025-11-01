/**
 * Redux Offline Sync Slice - Offline Data Sync Queue Management
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { OfflineSyncState, OfflineSyncItem, SyncStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

const initialState: OfflineSyncState = {
  items: [],
  isSyncing: false,
  lastSyncTime: 0,
  pendingCount: 0
};

export const offlineSyncSlice = createSlice({
  name: 'offlineSync',
  initialState,
  reducers: {
    addSyncItem: (state, action: PayloadAction<Omit<OfflineSyncItem, 'id' | 'retries' | 'lastAttempt' | 'status'>>) => {
      const item: OfflineSyncItem = {
        ...action.payload,
        id: uuidv4(),
        status: SyncStatus.PENDING,
        retries: 0,
        lastAttempt: new Date().toISOString()
      };
      state.items.push(item);
      state.pendingCount += 1;
    },
    updateSyncItemStatus: (state, action: PayloadAction<{ id: string; status: SyncStatus; error?: string }>) => {
      const item = state.items.find(i => i.id === action.payload.id);
      if (item) {
        const wasPending = item.status === SyncStatus.PENDING;
        item.status = action.payload.status;
        item.lastAttempt = new Date().toISOString();
        if (action.payload.error) {
          item.error = action.payload.error;
        }
        if (wasPending && action.payload.status !== SyncStatus.PENDING) {
          state.pendingCount = Math.max(0, state.pendingCount - 1);
        }
      }
    },
    incrementRetries: (state, action: PayloadAction<string>) => {
      const item = state.items.find(i => i.id === action.payload);
      if (item) {
        item.retries += 1;
      }
    },
    removeSyncItem: (state, action: PayloadAction<string>) => {
      const item = state.items.find(i => i.id === action.payload);
      if (item && item.status === SyncStatus.PENDING) {
        state.pendingCount = Math.max(0, state.pendingCount - 1);
      }
      state.items = state.items.filter(i => i.id !== action.payload);
    },
    clearSyncItems: (state) => {
      state.items = [];
      state.pendingCount = 0;
    },
    setSyncing: (state, action: PayloadAction<boolean>) => {
      state.isSyncing = action.payload;
    },
    setLastSyncTime: (state) => {
      state.lastSyncTime = Date.now();
    }
  }
});

export const {
  addSyncItem,
  updateSyncItemStatus,
  incrementRetries,
  removeSyncItem,
  clearSyncItems,
  setSyncing,
  setLastSyncTime
} = offlineSyncSlice.actions;

export default offlineSyncSlice.reducer;
