/**
 * Redux WebSocket Slice - WebSocket Connection State Management
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WebSocketState } from '../types';

const initialState: WebSocketState = {
  isConnected: false,
  isReconnecting: false,
  reconnectAttempts: 0,
  lastMessageTime: 0,
  subscriptions: [],
  error: null
};

export const websocketSlice = createSlice({
  name: 'websocket',
  initialState,
  reducers: {
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
      if (action.payload) {
        state.reconnectAttempts = 0;
        state.isReconnecting = false;
      }
    },
    setReconnecting: (state, action: PayloadAction<boolean>) => {
      state.isReconnecting = action.payload;
    },
    incrementReconnectAttempts: (state) => {
      state.reconnectAttempts += 1;
    },
    resetReconnectAttempts: (state) => {
      state.reconnectAttempts = 0;
    },
    setLastMessageTime: (state) => {
      state.lastMessageTime = Date.now();
    },
    addSubscription: (state, action: PayloadAction<string>) => {
      if (!state.subscriptions.includes(action.payload)) {
        state.subscriptions.push(action.payload);
      }
    },
    removeSubscription: (state, action: PayloadAction<string>) => {
      state.subscriptions = state.subscriptions.filter(s => s !== action.payload);
    },
    clearSubscriptions: (state) => {
      state.subscriptions = [];
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    }
  }
});

export const {
  setConnected,
  setReconnecting,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  setLastMessageTime,
  addSubscription,
  removeSubscription,
  clearSubscriptions,
  setError
} = websocketSlice.actions;

export default websocketSlice.reducer;
