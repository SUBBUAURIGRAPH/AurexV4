/**
 * Mock Data Fixtures for Testing
 * Provides realistic test data for CLI and Service tests
 * @version 1.0.0
 */

/**
 * Mock Account Data
 */
export const mockAccounts = {
  default: {
    id: 'acc-123',
    userId: 'user-123',
    name: 'Main Trading Account',
    type: 'LIVE',
    balance: 125000,
    currency: 'USD',
    status: 'ACTIVE',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-31T23:59:59Z'
  },
  paper: {
    id: 'acc-456',
    userId: 'user-123',
    name: 'Paper Trading Account',
    type: 'PAPER',
    balance: 100000,
    currency: 'USD',
    status: 'ACTIVE',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-31T23:59:59Z'
  },
  inactive: {
    id: 'acc-789',
    userId: 'user-123',
    name: 'Inactive Account',
    type: 'LIVE',
    balance: 50000,
    currency: 'USD',
    status: 'INACTIVE',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-31T23:59:59Z'
  }
};

/**
 * Mock Strategy Data
 */
export const mockStrategies = {
  momentum: {
    id: 'strat-001',
    userId: 'user-123',
    name: 'Momentum Strategy',
    type: 'MOMENTUM',
    status: 'ACTIVE',
    description: 'Buy high momentum stocks',
    config: {
      lookback: 20,
      threshold: 0.02,
      stopLoss: 0.05,
      takeProfit: 0.10
    },
    performance: {
      totalReturn: 0.25,
      sharpeRatio: 1.85,
      maxDrawdown: -0.1532,
      winRate: 0.6222
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-31T23:59:59Z'
  },
  meanReversion: {
    id: 'strat-002',
    userId: 'user-123',
    name: 'Mean Reversion Strategy',
    type: 'MEAN_REVERSION',
    status: 'ACTIVE',
    description: 'Buy oversold, sell overbought',
    config: {
      rsiPeriod: 14,
      oversold: 30,
      overbought: 70,
      stopLoss: 0.03,
      takeProfit: 0.08
    },
    performance: {
      totalReturn: 0.18,
      sharpeRatio: 1.52,
      maxDrawdown: -0.1125,
      winRate: 0.5833
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-31T23:59:59Z'
  }
};

/**
 * Mock Portfolio Data
 */
export const mockPortfolio = {
  default: {
    id: 'port-001',
    accountId: 'acc-123',
    totalValue: 125000,
    cashBalance: 37500,
    positions: [
      {
        symbol: 'AAPL',
        quantity: 100,
        avgPrice: 150.00,
        currentPrice: 175.00,
        marketValue: 17500,
        unrealizedPnL: 2500,
        unrealizedPnLPercent: 0.1667,
        allocation: 0.14
      },
      {
        symbol: 'MSFT',
        quantity: 80,
        avgPrice: 300.00,
        currentPrice: 350.00,
        marketValue: 28000,
        unrealizedPnL: 4000,
        unrealizedPnLPercent: 0.1667,
        allocation: 0.224
      },
      {
        symbol: 'GOOGL',
        quantity: 150,
        avgPrice: 100.00,
        currentPrice: 140.00,
        marketValue: 21000,
        unrealizedPnL: 6000,
        unrealizedPnLPercent: 0.4,
        allocation: 0.168
      }
    ],
    performanceMetrics: {
      dailyReturn: 0.005,
      totalReturn: 0.25,
      sharpeRatio: 1.85,
      volatility: 0.185,
      maxDrawdown: -0.1532
    },
    updatedAt: '2024-01-31T23:59:59Z'
  }
};

/**
 * Mock Order Data
 */
export const mockOrders = {
  buy: {
    id: 'ord-001',
    accountId: 'acc-123',
    strategyId: 'strat-001',
    symbol: 'AAPL',
    type: 'MARKET',
    side: 'BUY',
    quantity: 100,
    price: 175.00,
    status: 'FILLED',
    filledQuantity: 100,
    avgFillPrice: 175.25,
    commission: 1.50,
    createdAt: '2024-01-31T10:00:00Z',
    filledAt: '2024-01-31T10:00:05Z'
  },
  sell: {
    id: 'ord-002',
    accountId: 'acc-123',
    strategyId: 'strat-001',
    symbol: 'MSFT',
    type: 'LIMIT',
    side: 'SELL',
    quantity: 50,
    price: 350.00,
    status: 'FILLED',
    filledQuantity: 50,
    avgFillPrice: 350.50,
    commission: 1.00,
    createdAt: '2024-01-31T11:00:00Z',
    filledAt: '2024-01-31T11:05:00Z'
  },
  pending: {
    id: 'ord-003',
    accountId: 'acc-123',
    strategyId: 'strat-002',
    symbol: 'GOOGL',
    type: 'LIMIT',
    side: 'BUY',
    quantity: 75,
    price: 135.00,
    status: 'PENDING',
    filledQuantity: 0,
    avgFillPrice: 0,
    commission: 0,
    createdAt: '2024-01-31T12:00:00Z',
    filledAt: null
  },
  cancelled: {
    id: 'ord-004',
    accountId: 'acc-123',
    strategyId: 'strat-001',
    symbol: 'TSLA',
    type: 'STOP',
    side: 'SELL',
    quantity: 20,
    price: 200.00,
    stopPrice: 190.00,
    status: 'CANCELLED',
    filledQuantity: 0,
    avgFillPrice: 0,
    commission: 0,
    createdAt: '2024-01-31T13:00:00Z',
    cancelledAt: '2024-01-31T13:30:00Z'
  }
};

/**
 * Mock Market Data
 */
export const mockMarketData = {
  quote: {
    symbol: 'AAPL',
    price: 175.00,
    bid: 174.98,
    ask: 175.02,
    volume: 50000000,
    timestamp: '2024-01-31T15:59:59Z',
    change: 2.50,
    changePercent: 0.0145,
    high: 176.00,
    low: 172.50,
    open: 173.00,
    previousClose: 172.50
  },
  candles: [
    {
      timestamp: '2024-01-31T09:30:00Z',
      open: 173.00,
      high: 174.00,
      low: 172.50,
      close: 173.50,
      volume: 5000000
    },
    {
      timestamp: '2024-01-31T10:30:00Z',
      open: 173.50,
      high: 175.50,
      low: 173.00,
      close: 175.00,
      volume: 6000000
    },
    {
      timestamp: '2024-01-31T11:30:00Z',
      open: 175.00,
      high: 176.00,
      low: 174.50,
      close: 175.50,
      volume: 4500000
    }
  ]
};

/**
 * Mock Analytics Data
 */
export const mockAnalytics = {
  performance: {
    portfolioValue: 125000,
    dailyReturn: 0.005,
    weeklyReturn: 0.025,
    monthlyReturn: 0.08,
    yearlyReturn: 0.25,
    sharpeRatio: 1.85,
    sortinoRatio: 2.15,
    maxDrawdown: -0.1532,
    volatility: 0.185,
    beta: 1.05,
    alpha: 0.03
  },
  risk: {
    var95: -5625,
    cvar95: -7500,
    maxDrawdownPercent: -0.1532,
    annualVolatility: 0.185,
    downsideVolatility: 0.123,
    riskScore: 55.2,
    riskLevel: 'MEDIUM'
  },
  trades: {
    totalTrades: 45,
    winningTrades: 28,
    losingTrades: 17,
    winRate: 0.6222,
    avgWin: 450.25,
    avgLoss: -280.50,
    profitFactor: 1.82,
    expectancy: 183.39,
    maxConsecutiveWins: 5,
    maxConsecutiveLosses: 3
  }
};

/**
 * Mock Sync Data
 */
export const mockSyncData = {
  operation: {
    id: 'sync-001',
    type: 'FULL',
    status: 'COMPLETED',
    startTime: '2024-01-31T00:00:00Z',
    endTime: '2024-01-31T00:05:30Z',
    duration: 330000,
    recordsSynced: 1500,
    recordsFailed: 5,
    errors: []
  },
  conflict: {
    id: 'conflict-001',
    entityType: 'ORDER',
    entityId: 'ord-001',
    localVersion: {
      id: 'ord-001',
      status: 'FILLED',
      updatedAt: '2024-01-31T10:00:05Z'
    },
    remoteVersion: {
      id: 'ord-001',
      status: 'PENDING',
      updatedAt: '2024-01-31T10:00:03Z'
    },
    resolution: 'KEEP_LOCAL',
    resolvedAt: '2024-01-31T10:00:10Z'
  },
  auditLog: {
    id: 'audit-001',
    timestamp: '2024-01-31T10:00:00Z',
    userId: 'user-123',
    action: 'SYNC',
    entityType: 'ORDER',
    entityId: 'ord-001',
    changes: {
      status: { from: 'PENDING', to: 'FILLED' },
      filledQuantity: { from: 0, to: 100 }
    },
    metadata: {
      source: 'EXCHANGE',
      syncId: 'sync-001'
    }
  }
};

/**
 * Mock Error Responses
 */
export const mockErrors = {
  notFound: {
    code: 'NOT_FOUND',
    message: 'Resource not found',
    status: 404
  },
  unauthorized: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
    status: 401
  },
  forbidden: {
    code: 'FORBIDDEN',
    message: 'Access denied',
    status: 403
  },
  validation: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input data',
    status: 400,
    details: {
      quantity: 'Must be positive',
      price: 'Must be greater than 0'
    }
  },
  serverError: {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    status: 500
  },
  timeout: {
    code: 'TIMEOUT',
    message: 'Request timeout',
    status: 408
  },
  rateLimit: {
    code: 'RATE_LIMIT',
    message: 'Too many requests',
    status: 429
  }
};

/**
 * Mock System Configuration
 */
export const mockConfig = {
  api: {
    baseUrl: 'http://localhost:3000',
    timeout: 30000,
    retries: 3
  },
  sync: {
    interval: 300000,
    batchSize: 100,
    maxRetries: 3,
    conflictResolution: 'KEEP_LATEST'
  },
  analytics: {
    trackPerformance: true,
    trackRisk: true,
    trackTrades: true,
    lookbackDays: 252,
    retentionDays: 730
  }
};
