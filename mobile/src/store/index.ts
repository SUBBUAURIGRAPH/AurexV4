/**
 * Redux Store Configuration
 * Sets up the Redux store with all reducers, middleware, and plugins
 */

import { configureStore, ThunkAction, Action } from '@reduxjs/toolkit';
import { useDispatch } from 'react-redux';
import authReducer from './authSlice';
import tradingReducer from './tradingSlice';
import chartsReducer from './chartsSlice';
import notificationsReducer from './notificationsSlice';
import settingsReducer from './settingsSlice';
import websocketReducer from './websocketSlice';
import offlineSyncReducer from './offlineSyncSlice';
import appReducer from './appSlice';

/**
 * Configure and create Redux store
 * Uses Redux Toolkit's configureStore which includes:
 * - redux-thunk middleware by default
 * - serialization check middleware
 * - immutability check middleware
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    trading: tradingReducer,
    charts: chartsReducer,
    notifications: notificationsReducer,
    settings: settingsReducer,
    websocket: websocketReducer,
    offlineSync: offlineSyncReducer,
    app: appReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types and paths
        ignoredActions: ['auth/loginWithEmailPassword/fulfilled'],
        ignoredPaths: ['auth.tokens.expiresAt']
      },
      immutableCheck: {
        // Check all actions except these
        ignoredActionPaths: ['payload.data']
      }
    }).concat([
      // Additional middleware can be added here
      // - Error tracking middleware
      // - Analytics middleware
      // - Persistence middleware
    ]),
  devTools: process.env.NODE_ENV !== 'production'
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/**
 * Typed useDispatch hook
 * Use throughout the app instead of plain `useDispatch`
 */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/**
 * App thunk type for async actions
 */
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;

/**
 * Store listener setup
 * Handles persistence, webhooks, and other side effects
 */
export function initializeStore() {
  // Initialize listeners if needed
  const unsubscribe = store.subscribe(() => {
    const state = store.getState();
    // Handle side effects here if needed
  });

  return unsubscribe;
}
