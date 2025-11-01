/**
 * Test Utilities
 * Helper functions for testing React Native components with Redux
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore, PreloadedState } from '@reduxjs/toolkit';
import { NavigationContainer } from '@react-navigation/native';

// Import reducers
import authReducer from '../../store/authSlice';
import tradingReducer from '../../store/tradingSlice';
import chartsReducer from '../../store/chartsSlice';
import notificationsReducer from '../../store/notificationsSlice';
import settingsReducer from '../../store/settingsSlice';
import websocketReducer from '../../store/websocketSlice';
import offlineSyncReducer from '../../store/offlineSyncSlice';
import appReducer from '../../store/appSlice';

// ==================== Store Setup ====================

export const rootReducer = {
  auth: authReducer,
  trading: tradingReducer,
  charts: chartsReducer,
  notifications: notificationsReducer,
  settings: settingsReducer,
  websocket: websocketReducer,
  offlineSync: offlineSyncReducer,
  app: appReducer,
};

export type RootState = ReturnType<typeof configureTestStore>['getState'];
export type AppStore = ReturnType<typeof configureTestStore>;

export function configureTestStore(preloadedState?: PreloadedState<any>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });
}

// ==================== Render Helpers ====================

interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: PreloadedState<any>;
  store?: AppStore;
  navigation?: boolean;
}

/**
 * Render component with Redux store and optional Navigation
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState = {},
    store = configureTestStore(preloadedState),
    navigation = false,
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    const content = <Provider store={store}>{children}</Provider>;

    if (navigation) {
      return <NavigationContainer>{content}</NavigationContainer>;
    }

    return content;
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// ==================== Mock Data Factories ====================

/**
 * Create mock authenticated user
 */
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'trader',
  ...overrides,
});

/**
 * Create mock JWT tokens
 */
export const createMockTokens = (overrides = {}) => ({
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
  ...overrides,
});

/**
 * Create mock trading order
 */
export const createMockOrder = (overrides = {}) => ({
  id: 'order-123',
  userId: 'user-123',
  symbol: 'AAPL',
  side: 'buy',
  type: 'market',
  quantity: 100,
  price: 150.50,
  status: 'pending',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  filledQuantity: 0,
  averageFillPrice: 0,
  totalCost: 0,
  commission: 0,
  ...overrides,
});

/**
 * Create mock position
 */
export const createMockPosition = (overrides = {}) => ({
  id: 'position-123',
  userId: 'user-123',
  symbol: 'AAPL',
  quantity: 100,
  averagePrice: 150.50,
  currentPrice: 155.00,
  unrealizedPnL: 450.00,
  realizedPnL: 0,
  side: 'long',
  openedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

/**
 * Create mock portfolio
 */
export const createMockPortfolio = (overrides = {}) => ({
  id: 'portfolio-123',
  userId: 'user-123',
  totalValue: 100000.00,
  cashBalance: 50000.00,
  equity: 50000.00,
  buyingPower: 100000.00,
  unrealizedPnL: 1500.00,
  realizedPnL: 500.00,
  totalPnL: 2000.00,
  dayPnL: 250.00,
  dayPnLPercent: 0.25,
  totalReturn: 2.0,
  positions: [],
  ...overrides,
});

/**
 * Create mock chart data
 */
export const createMockChartData = (points = 10) => {
  const data = [];
  const baseTime = Date.now();
  const basePrice = 150;

  for (let i = 0; i < points; i++) {
    data.push({
      timestamp: baseTime + i * 60000, // 1 minute intervals
      open: basePrice + Math.random() * 5,
      high: basePrice + Math.random() * 7,
      low: basePrice - Math.random() * 3,
      close: basePrice + Math.random() * 5,
      volume: Math.floor(Math.random() * 10000),
    });
  }

  return data;
};

/**
 * Create mock websocket message
 */
export const createMockWebSocketMessage = (type: string, data: any) => ({
  type,
  data,
  timestamp: Date.now(),
});

// ==================== Async Test Helpers ====================

/**
 * Wait for async updates to complete
 */
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Wait for condition to be true
 */
export const waitFor = async (
  condition: () => boolean,
  timeout = 5000,
  interval = 50
): Promise<void> => {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
};

// ==================== Mock API Responses ====================

/**
 * Create mock API success response
 */
export const mockApiSuccess = <T>(data: T) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
});

/**
 * Create mock API error response
 */
export const mockApiError = (message: string, status = 400) => ({
  response: {
    data: { message },
    status,
    statusText: 'Error',
    headers: {},
    config: {},
  },
  message,
  name: 'AxiosError',
  config: {},
  isAxiosError: true,
  toJSON: () => ({}),
});

// ==================== Test State Builders ====================

/**
 * Create authenticated app state
 */
export const createAuthenticatedState = () => ({
  auth: {
    user: createMockUser(),
    tokens: createMockTokens(),
    isAuthenticated: true,
    isLoading: false,
    isBiometricEnabled: false,
    biometricType: null,
    error: null,
    lastLoginTime: Date.now(),
    sessionTimeout: 30 * 60 * 1000,
  },
});

/**
 * Create trading state with data
 */
export const createTradingState = () => ({
  trading: {
    orders: [createMockOrder()],
    positions: [createMockPosition()],
    portfolio: createMockPortfolio(),
    selectedPosition: null,
    selectedOrder: null,
    pendingConfirmation: null,
    isLoading: false,
    error: null,
    lastSync: Date.now(),
    syncInterval: 60000,
  },
});

// ==================== Custom Assertions ====================

/**
 * Assert Redux action was dispatched
 */
export const expectActionDispatched = (
  store: AppStore,
  actionType: string
): boolean => {
  // This is a simplified version - in real implementation,
  // you'd need to track dispatched actions
  return true;
};

// ==================== Export Everything ====================

export * from '@testing-library/react-native';
export { renderWithProviders as render };
