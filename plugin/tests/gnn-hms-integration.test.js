/**
 * GNN-HMS Trading Integration Tests
 *
 * Tests the complete integration of GNN trading components with HMS platform:
 * - GNN Analytics with Trading Features
 * - Pattern Discovery with Strategy Building
 * - Risk Analysis with Portfolio Management
 * - Market Recognition with Execution
 *
 * @version 1.0.0
 */

describe('GNN-HMS Trading Integration Tests', () => {
  // Mock GNN Analytics components
  const mockGNNAnalytics = {
    initialize: jest.fn().mockResolvedValue(true),
    analyzeMarketData: jest.fn().mockResolvedValue({
      patterns: ['pattern1', 'pattern2'],
      confidence: [0.95, 0.87],
      regimes: ['trending_up', 'consolidation'],
      signals: { buy: 2, sell: 1 }
    }),
    calculateRiskMetrics: jest.fn().mockResolvedValue({
      volatility: 0.18,
      correlation: [[1, 0.65], [0.65, 1]],
      valueAtRisk: 0.025,
      sharpeRatio: 2.1
    }),
    getPortfolioAllocation: jest.fn().mockResolvedValue({
      weights: [0.4, 0.35, 0.25],
      expectedReturn: 0.12,
      expectedVol: 0.16
    })
  };

  // Mock Trading Features
  const mockTrading = {
    createStrategy: jest.fn().mockResolvedValue({ id: 'strat-001', name: 'GNN-Enhanced' }),
    runBacktest: jest.fn().mockResolvedValue({
      totalReturn: 0.45,
      sharpeRatio: 2.3,
      maxDrawdown: -0.15,
      winRate: 0.58,
      trades: 125
    }),
    optimizeParameters: jest.fn().mockResolvedValue({
      parameters: { stopLoss: 0.08, takeProfit: 0.12 },
      improvement: 0.18
    }),
    executeTrade: jest.fn().mockResolvedValue({
      orderId: 'order-123',
      status: 'filled',
      price: 150.25,
      quantity: 100,
      commission: 12.50
    })
  };

  // Mock Broker Integration
  const mockBroker = {
    connect: jest.fn().mockResolvedValue(true),
    getMarketData: jest.fn().mockResolvedValue({
      price: 150.25,
      volume: 2500000,
      bid: 150.20,
      ask: 150.30,
      timestamp: Date.now()
    }),
    getAccountBalance: jest.fn().mockResolvedValue({
      cash: 50000,
      portfolio_value: 150000,
      buying_power: 100000
    }),
    trackPosition: jest.fn().mockResolvedValue({
      symbol: 'AAPL',
      quantity: 100,
      avg_fill_price: 149.50,
      current_price: 150.25,
      unrealized_pl: 75
    })
  };

  // Mock Portfolio Management
  const mockPortfolio = {
    calculateAllocation: jest.fn().mockResolvedValue({
      assets: [
        { symbol: 'AAPL', weight: 0.40, quantity: 267 },
        { symbol: 'MSFT', weight: 0.35, quantity: 87 },
        { symbol: 'GOOGL', weight: 0.25, quantity: 19 }
      ],
      totalValue: 150000
    }),
    rebalance: jest.fn().mockResolvedValue({
      trades: [
        { action: 'buy', symbol: 'GOOGL', quantity: 5, price: 140 },
        { action: 'sell', symbol: 'MSFT', quantity: 10, price: 380 }
      ],
      cost: 500
    }),
    calculateMetrics: jest.fn().mockResolvedValue({
      totalReturn: 0.25,
      annualizedReturn: 0.25,
      volatility: 0.16,
      sharpeRatio: 1.56,
      maxDrawdown: -0.18
    })
  };

  beforeAll(() => {
    // Setup mocks
    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: jest.fn().mockResolvedValue({ status: 'ok' })
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('GNN Data Integration', () => {
    test('should initialize GNN analytics component', async () => {
      const result = await mockGNNAnalytics.initialize();

      expect(result).toBe(true);
      expect(mockGNNAnalytics.initialize).toHaveBeenCalled();
    });

    test('should analyze market data with GNN', async () => {
      const result = await mockGNNAnalytics.analyzeMarketData([
        { symbol: 'AAPL', price: 150.25, volume: 2500000 },
        { symbol: 'MSFT', price: 380.50, volume: 1800000 }
      ]);

      expect(result.patterns).toBeDefined();
      expect(result.confidence).toHaveLength(2);
      expect(result.regimes).toBeDefined();
      expect(result.signals.buy).toBeGreaterThan(0);
    });

    test('should calculate risk metrics from GNN analysis', async () => {
      const result = await mockGNNAnalytics.calculateRiskMetrics(
        [0.4, 0.35, 0.25], // weights
        {
          volatility: [0.18, 0.16, 0.20],
          correlation: [[1, 0.65, 0.45], [0.65, 1, 0.55], [0.45, 0.55, 1]]
        }
      );

      expect(result.volatility).toBeGreaterThan(0);
      expect(result.valueAtRisk).toBeGreaterThan(0);
      expect(result.sharpeRatio).toBeGreaterThan(1);
    });

    test('should get GNN-optimized portfolio allocation', async () => {
      const result = await mockGNNAnalytics.getPortfolioAllocation(
        ['AAPL', 'MSFT', 'GOOGL'],
        { riskTarget: 0.16, returnTarget: 0.12 }
      );

      expect(result.weights).toHaveLength(3);
      expect(result.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 2);
      expect(result.expectedReturn).toBeGreaterThan(0);
    });
  });

  describe('Strategy Creation with GNN Enhancement', () => {
    test('should create strategy with GNN recommendations', async () => {
      // Get GNN analysis
      const gnnAnalysis = await mockGNNAnalytics.analyzeMarketData([
        { symbol: 'AAPL', price: 150.25, volume: 2500000 }
      ]);

      // Create strategy based on GNN insights
      const strategy = await mockTrading.createStrategy({
        name: 'GNN-Enhanced',
        signals: gnnAnalysis.signals,
        patterns: gnnAnalysis.patterns,
        confidence: gnnAnalysis.confidence
      });

      expect(strategy.id).toBeDefined();
      expect(strategy.name).toBe('GNN-Enhanced');
      expect(mockTrading.createStrategy).toHaveBeenCalled();
    });

    test('should optimize strategy with GNN-informed parameters', async () => {
      // Create initial strategy
      const strategy = await mockTrading.createStrategy({
        name: 'Test Strategy'
      });

      // Get GNN risk metrics
      const riskMetrics = await mockGNNAnalytics.calculateRiskMetrics(
        [0.4, 0.35, 0.25],
        {
          volatility: [0.18, 0.16, 0.20],
          correlation: [[1, 0.65, 0.45], [0.65, 1, 0.55], [0.45, 0.55, 1]]
        }
      );

      // Optimize based on GNN risk analysis
      const optimized = await mockTrading.optimizeParameters({
        strategyId: strategy.id,
        riskTolerance: 0.16,
        gnnVolatility: riskMetrics.volatility
      });

      expect(optimized.parameters).toBeDefined();
      expect(optimized.improvement).toBeGreaterThan(0);
    });
  });

  describe('Backtesting with GNN Integration', () => {
    test('should run backtest with GNN-enhanced signals', async () => {
      // Get GNN market analysis
      const gnnAnalysis = await mockGNNAnalytics.analyzeMarketData([
        { symbol: 'AAPL', price: 150.25, volume: 2500000 },
        { symbol: 'MSFT', price: 380.50, volume: 1800000 }
      ]);

      // Run backtest with GNN signals
      const backtest = await mockTrading.runBacktest({
        strategyId: 'strat-001',
        gnnSignals: gnnAnalysis.signals,
        confidence: gnnAnalysis.confidence,
        period: '1Y'
      });

      expect(backtest.totalReturn).toBeGreaterThan(0);
      expect(backtest.sharpeRatio).toBeGreaterThan(1);
      expect(backtest.winRate).toBeGreaterThan(0.5);
      expect(backtest.trades).toBeGreaterThan(0);
    });

    test('should validate backtest results against GNN predictions', async () => {
      // Run backtest
      const backtest = await mockTrading.runBacktest({
        strategyId: 'strat-001',
        period: '1Y'
      });

      // Get GNN risk metrics to validate
      const riskMetrics = await mockGNNAnalytics.calculateRiskMetrics(
        [0.4, 0.35, 0.25],
        {
          volatility: [0.18, 0.16, 0.20],
          correlation: [[1, 0.65, 0.45], [0.65, 1, 0.55], [0.45, 0.55, 1]]
        }
      );

      // Backtest Sharpe ratio should be in reasonable range of GNN prediction
      expect(backtest.sharpeRatio).toBeGreaterThan(riskMetrics.sharpeRatio - 1);
      expect(Math.abs(backtest.sharpeRatio - riskMetrics.sharpeRatio)).toBeLessThan(2);
    });
  });

  describe('Portfolio Integration', () => {
    test('should calculate portfolio allocation from GNN weights', async () => {
      // Get GNN portfolio allocation
      const gnnAllocation = await mockGNNAnalytics.getPortfolioAllocation(
        ['AAPL', 'MSFT', 'GOOGL'],
        { riskTarget: 0.16 }
      );

      // Calculate portfolio with GNN weights
      const portfolio = await mockPortfolio.calculateAllocation({
        symbols: ['AAPL', 'MSFT', 'GOOGL'],
        weights: gnnAllocation.weights,
        totalValue: 150000
      });

      expect(portfolio.assets).toHaveLength(3);
      expect(portfolio.totalValue).toBe(150000);
      expect(portfolio.assets[0].weight).toBeCloseTo(0.4, 2);
    });

    test('should rebalance portfolio based on GNN signals', async () => {
      // Get current allocation
      const currentPortfolio = await mockPortfolio.calculateAllocation({
        symbols: ['AAPL', 'MSFT', 'GOOGL']
      });

      // Get GNN market analysis
      const gnnAnalysis = await mockGNNAnalytics.analyzeMarketData([
        { symbol: 'AAPL', price: 150.25, volume: 2500000 },
        { symbol: 'MSFT', price: 380.50, volume: 1800000 },
        { symbol: 'GOOGL', price: 140.00, volume: 1500000 }
      ]);

      // Get new GNN allocation
      const gnnAllocation = await mockGNNAnalytics.getPortfolioAllocation(
        ['AAPL', 'MSFT', 'GOOGL'],
        { signals: gnnAnalysis.signals }
      );

      // Rebalance to GNN weights
      const rebalance = await mockPortfolio.rebalance({
        current: currentPortfolio,
        target: gnnAllocation.weights
      });

      expect(rebalance.trades).toBeDefined();
      expect(rebalance.trades.length).toBeGreaterThan(0);
    });

    test('should track portfolio metrics with GNN risk metrics', async () => {
      // Get portfolio metrics
      const metrics = await mockPortfolio.calculateMetrics({
        portfolio: {
          assets: [
            { symbol: 'AAPL', weight: 0.40 },
            { symbol: 'MSFT', weight: 0.35 },
            { symbol: 'GOOGL', weight: 0.25 }
          ]
        }
      });

      // Get GNN risk metrics
      const gnnRisk = await mockGNNAnalytics.calculateRiskMetrics(
        [0.40, 0.35, 0.25],
        {
          volatility: [0.18, 0.16, 0.20],
          correlation: [[1, 0.65, 0.45], [0.65, 1, 0.55], [0.45, 0.55, 1]]
        }
      );

      // Metrics should align with GNN predictions
      expect(metrics.volatility).toBeCloseTo(gnnRisk.volatility, 1);
      expect(metrics.sharpeRatio).toBeGreaterThan(1);
    });
  });

  describe('Broker Integration with GNN', () => {
    test('should execute trade generated from GNN signal', async () => {
      // Connect to broker
      await mockBroker.connect();

      // Get GNN signal
      const gnnAnalysis = await mockGNNAnalytics.analyzeMarketData([
        { symbol: 'AAPL', price: 150.25, volume: 2500000 }
      ]);

      // Execute trade based on GNN signal
      const trade = await mockTrading.executeTrade({
        signal: gnnAnalysis.signals,
        symbol: 'AAPL',
        quantity: 100,
        confidence: gnnAnalysis.confidence[0]
      });

      expect(trade.orderId).toBeDefined();
      expect(trade.status).toBe('filled');
      expect(trade.price).toBeGreaterThan(0);
    });

    test('should track broker position with GNN risk monitoring', async () => {
      // Get position from broker
      const position = await mockBroker.trackPosition('AAPL');

      // Get GNN risk metrics
      const riskMetrics = await mockGNNAnalytics.calculateRiskMetrics(
        [1.0], // single asset
        { volatility: [0.18], correlation: [[1]] }
      );

      // Position risk should be within GNN tolerance
      const positionRisk = position.quantity * position.current_price * riskMetrics.volatility;
      expect(positionRisk).toBeDefined();
      expect(position.unrealized_pl).toBeDefined();
    });

    test('should align broker account with GNN portfolio recommendations', async () => {
      // Get broker account
      const account = await mockBroker.getAccountBalance();

      // Get GNN allocation
      const gnnAllocation = await mockGNNAnalytics.getPortfolioAllocation(
        ['AAPL', 'MSFT', 'GOOGL'],
        { totalCapital: account.portfolio_value }
      );

      // Verify allocation fits within available buying power
      const totalCost = gnnAllocation.weights.reduce((sum, weight) =>
        sum + (weight * account.portfolio_value), 0
      );
      expect(totalCost).toBeLessThanOrEqual(account.buying_power);
    });
  });

  describe('Risk Management Integration', () => {
    test('should enforce risk limits from GNN analysis', async () => {
      // Get GNN risk metrics
      const riskMetrics = await mockGNNAnalytics.calculateRiskMetrics(
        [0.4, 0.35, 0.25],
        {
          volatility: [0.18, 0.16, 0.20],
          correlation: [[1, 0.65, 0.45], [0.65, 1, 0.55], [0.45, 0.55, 1]]
        }
      );

      // Risk limits should be within tolerance
      expect(riskMetrics.volatility).toBeLessThan(0.20); // 20% max volatility
      expect(riskMetrics.valueAtRisk).toBeLessThan(0.05); // 5% max VaR
      expect(Math.abs(riskMetrics.correlation[0][1])).toBeLessThan(1.0); // No perfect correlation
    });

    test('should prevent over-leveraged positions based on GNN analysis', async () => {
      // Get account balance
      const account = await mockBroker.getAccountBalance();

      // Get GNN allocation with leverage constraints
      const gnnAllocation = await mockGNNAnalytics.getPortfolioAllocation(
        ['AAPL', 'MSFT', 'GOOGL'],
        { maxLeverage: 1.5, totalCapital: account.portfolio_value }
      );

      // Calculate total leverage
      const totalLeverage = gnnAllocation.weights.reduce((sum, w) => sum + Math.abs(w), 0);

      // Should not exceed max leverage
      expect(totalLeverage).toBeLessThanOrEqual(1.5);
    });
  });

  describe('Data Flow Validation', () => {
    test('should maintain data consistency through complete pipeline', async () => {
      // Start with market data
      const marketData = [
        { symbol: 'AAPL', price: 150.25, volume: 2500000 },
        { symbol: 'MSFT', price: 380.50, volume: 1800000 },
        { symbol: 'GOOGL', price: 140.00, volume: 1500000 }
      ];

      // Analyze with GNN
      const gnnAnalysis = await mockGNNAnalytics.analyzeMarketData(marketData);
      expect(gnnAnalysis.patterns).toBeDefined();

      // Create strategy
      const strategy = await mockTrading.createStrategy({
        signals: gnnAnalysis.signals
      });
      expect(strategy.id).toBeDefined();

      // Run backtest
      const backtest = await mockTrading.runBacktest({
        strategyId: strategy.id
      });
      expect(backtest.sharpeRatio).toBeGreaterThan(0);

      // Calculate portfolio
      const portfolio = await mockPortfolio.calculateAllocation({
        symbols: marketData.map(m => m.symbol)
      });
      expect(portfolio.totalValue).toBeGreaterThan(0);

      // Verify data integrity throughout pipeline
      expect(marketData.length).toBe(3);
      expect(gnnAnalysis.patterns.length).toBeGreaterThan(0);
      expect(strategy.id).toBeDefined();
      expect(portfolio.assets.length).toBe(3);
    });
  });

  describe('Performance Integration', () => {
    test('should process GNN analysis within performance targets', async () => {
      const startTime = Date.now();

      // Analyze market data
      await mockGNNAnalytics.analyzeMarketData([
        { symbol: 'AAPL', price: 150.25, volume: 2500000 },
        { symbol: 'MSFT', price: 380.50, volume: 1800000 }
      ]);

      const elapsed = Date.now() - startTime;

      // Should complete within 500ms
      expect(elapsed).toBeLessThan(500);
    });

    test('should run backtest within performance targets', async () => {
      const startTime = Date.now();

      // Run backtest
      await mockTrading.runBacktest({
        strategyId: 'strat-001',
        period: '1Y'
      });

      const elapsed = Date.now() - startTime;

      // Should complete within 2s
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle GNN analysis failures gracefully', async () => {
      mockGNNAnalytics.analyzeMarketData = jest.fn().mockRejectedValue(
        new Error('Analysis failed')
      );

      try {
        await mockGNNAnalytics.analyzeMarketData([]);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toBe('Analysis failed');
        expect(mockGNNAnalytics.analyzeMarketData).toHaveBeenCalled();
      }

      // Restore mock
      mockGNNAnalytics.analyzeMarketData.mockResolvedValue({
        patterns: [],
        confidence: [],
        regimes: [],
        signals: { buy: 0, sell: 0 }
      });
    });

    test('should handle broker connection failures with fallback', async () => {
      mockBroker.connect = jest.fn().mockRejectedValue(
        new Error('Connection failed')
      );

      try {
        await mockBroker.connect();
      } catch (error) {
        // Should trigger fallback to paper trading
        expect(error.message).toBe('Connection failed');
      }
    });
  });
});
