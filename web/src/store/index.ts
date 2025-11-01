/**
 * Redux Store Configuration
 * Central store setup with middleware and slices
 * @version 1.0.0
 */

import { configureStore } from '@reduxjs/toolkit';
import dashboardReducer from './dashboardSlice';

/**
 * Create and configure Redux store
 */
export const store = configureStore({
  reducer: {
    dashboard: dashboardReducer,
    // Add more slices here as needed
    // auth: authReducer,
    // notifications: notificationsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore certain action types if needed for thunks
        ignoredActions: ['dashboard/fetchPortfolio/pending']
      }
    }),
  devTools: process.env.NODE_ENV !== 'production'
});

/**
 * Export types for use in components
 */
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
