/**
 * Paper Trading Manager Test Suite
 * Comprehensive tests for paper trading functionality
 * @version 1.0.0
 */

const PaperTradingManager = require('./paper-trading-manager');

describe('PaperTradingManager', () => {
  let manager;
  let mockDb;
  let mockMarketData;

  beforeEach(() => {
    // Mock database
    mockDb = {
      query: jest.fn()
    };

    // Mock market data client
    mockMarketData = {
      getQuote: jest.fn().mockResolvedValue({ price: 150.00 })
    };

    manager = new PaperTradingManager({
      db: mockDb,
      marketData: mockMarketData,
      logger: console
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== Account Management Tests ====================

  describe('Account Management', () => {
    test('should create a paper trading account with default settings', async () => {
      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // Settings

      const account = await manager.createAccount('user_123');

      expect(account).toBeDefined();
      expect(account.userId).toBe('user_123');
      expect(account.initialCapital).toBe(100000);
      expect(account.currentCash).toBe(100000);
      expect(account.commissionRate).toBe(0.001);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    test('should create account with custom settings', async () => {
      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const options = {
        name: 'Test Account',
        initialCapital: 50000,
        commissionRate: 0.002,
        allowShortSelling: false
      };

      const account = await manager.createAccount('user_123', options);

      expect(account.name).toBe('Test Account');
      expect(account.initialCapital).toBe(50000);
      expect(account.commissionRate).toBe(0.002);
      expect(account.allowShortSelling).toBe(false);
    });

    test('should get account by ID', async () => {
      const mockAccount = {
        id: 'acc_123',
        user_id: 'user_123',
        name: 'Test Account',
        initial_capital: 100000,
        current_cash: 95000,
        total_trades: 5,
        win_rate: 60.00
      };

      mockDb.query.mockResolvedValueOnce([[mockAccount]]);

      const account = await manager.getAccount('acc_123');

      expect(account).toBeDefined();
      expect(account.id).toBe('acc_123');
      expect(account.userId).toBe('user_123');
      expect(account.currentCash).toBe(95000);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM paper_trading_accounts'),
        ['acc_123']
      );
    });

    test('should throw error when account not found', async () => {
      mockDb.query.mockResolvedValueOnce([[]]);

      await expect(manager.getAccount('invalid_id')).rejects.toThrow('Account not found');
    });

    test('should get all user accounts', async () => {
      const mockAccounts = [
        { id: 'acc_1', user_id: 'user_123', name: 'Account 1', status: 'active', initial_capital: 100000, current_cash: 105000 },
        { id: 'acc_2', user_id: 'user_123', name: 'Account 2', status: 'active', initial_capital: 50000, current_cash: 52000 }
      ];

      mockDb.query.mockResolvedValueOnce([mockAccounts]);

      const accounts = await manager.getUserAccounts('user_123');

      expect(accounts).toHaveLength(2);
      expect(accounts[0].id).toBe('acc_1');
      expect(accounts[1].id).toBe('acc_2');
    });

    test('should update account settings', async () => {
      const mockAccount = {
        id: 'acc_123',
        user_id: 'user_123',
        name: 'Updated Name',
        status: 'active',
        initial_capital: 100000,
        current_cash: 100000
      };

      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      mockDb.query.mockResolvedValueOnce([[mockAccount]]);

      const settings = {
        name: 'Updated Name',
        maxDailyLoss: 1000
      };

      const updatedAccount = await manager.updateAccountSettings('acc_123', settings);

      expect(updatedAccount.name).toBe('Updated Name');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE paper_trading_accounts'),
        expect.arrayContaining(['Updated Name', 1000, 'acc_123'])
      );
    });
  });

  // ==================== Order Execution Tests ====================

  describe('Order Execution', () => {
    let mockAccount;

    beforeEach(() => {
      mockAccount = {
        id: 'acc_123',
        userId: 'user_123',
        status: 'active',
        currentCash: 100000,
        commissionRate: 0.001,
        slippageBuy: 0.001,
        slippageSell: 0.001,
        allowShortSelling: true,
        positionLimit: 10
      };
    });

    test('should execute market buy order successfully', async () => {
      // Mock get account
      mockDb.query.mockResolvedValueOnce([[{
        id: 'acc_123',
        user_id: 'user_123',
        status: 'active',
        current_cash: 100000,
        commission_rate: 0.001,
        slippage_buy: 0.001,
        slippage_sell: 0.001,
        allow_short_selling: true,
        position_limit: 10,
        initial_capital: 100000
      }]]);

      // Mock position check
      mockDb.query.mockResolvedValueOnce([[]]);

      // Mock order insert
      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      // Mock cash update
      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      // Mock position check for update
      mockDb.query.mockResolvedValueOnce([[]]);

      // Mock position create
      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const orderData = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: 10
      };

      const order = await manager.submitOrder('acc_123', orderData);

      expect(order).toBeDefined();
      expect(order.symbol).toBe('AAPL');
      expect(order.side).toBe('buy');
      expect(order.quantity).toBe(10);
      expect(order.status).toBe('filled');
      expect(order.executionPrice).toBeGreaterThan(0);
      expect(order.commission).toBeGreaterThan(0);
    });

    test('should execute market sell order successfully', async () => {
      // Mock get account
      mockDb.query.mockResolvedValueOnce([[{
        id: 'acc_123',
        user_id: 'user_123',
        status: 'active',
        current_cash: 100000,
        commission_rate: 0.001,
        slippage_buy: 0.001,
        slippage_sell: 0.001,
        allow_short_selling: true,
        position_limit: 10,
        initial_capital: 100000
      }]]);

      // Mock position check (existing position)
      mockDb.query.mockResolvedValueOnce([[{
        id: 'pos_123',
        account_id: 'acc_123',
        symbol: 'AAPL',
        quantity: 20,
        average_cost: 145.00,
        total_cost: 2900.00
      }]]);

      // Mock order insert
      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      // Mock cash update
      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      // Mock position check for update
      mockDb.query.mockResolvedValueOnce([[{
        id: 'pos_123',
        account_id: 'acc_123',
        symbol: 'AAPL',
        quantity: 20,
        average_cost: 145.00,
        total_cost: 2900.00,
        realized_pl: 0
      }]]);

      // Mock order update with realized P&L
      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      // Mock position update
      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const orderData = {
        symbol: 'AAPL',
        side: 'sell',
        type: 'market',
        quantity: 10
      };

      const order = await manager.submitOrder('acc_123', orderData);

      expect(order).toBeDefined();
      expect(order.symbol).toBe('AAPL');
      expect(order.side).toBe('sell');
      expect(order.quantity).toBe(10);
      expect(order.status).toBe('filled');
    });

    test('should reject order with insufficient buying power', async () => {
      mockDb.query.mockResolvedValueOnce([[{
        id: 'acc_123',
        user_id: 'user_123',
        status: 'active',
        current_cash: 1000, // Low cash
        commission_rate: 0.001,
        slippage_buy: 0.001,
        slippage_sell: 0.001,
        allow_short_selling: true,
        position_limit: 10,
        initial_capital: 100000
      }]]);

      mockDb.query.mockResolvedValueOnce([[]]);

      const orderData = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: 100 // Large quantity
      };

      await expect(manager.submitOrder('acc_123', orderData))
        .rejects.toThrow('Insufficient buying power');
    });

    test('should reject sell order when position does not exist and short selling disabled', async () => {
      mockDb.query.mockResolvedValueOnce([[{
        id: 'acc_123',
        user_id: 'user_123',
        status: 'active',
        current_cash: 100000,
        commission_rate: 0.001,
        slippage_buy: 0.001,
        slippage_sell: 0.001,
        allow_short_selling: false, // Short selling disabled
        position_limit: 10,
        initial_capital: 100000
      }]]);

      mockDb.query.mockResolvedValueOnce([[]]); // No existing position

      const orderData = {
        symbol: 'AAPL',
        side: 'sell',
        type: 'market',
        quantity: 10
      };

      await expect(manager.submitOrder('acc_123', orderData))
        .rejects.toThrow('Short selling not allowed');
    });

    test('should calculate commission correctly', async () => {
      const executionPrice = 150.00;
      const quantity = 10;
      const commissionRate = 0.001;

      const expectedCommission = quantity * executionPrice * commissionRate;

      expect(expectedCommission).toBe(1.50);
    });

    test('should apply slippage to buy orders', () => {
      const basePrice = 100.00;
      const slippage = { buy: 0.001, sell: 0.001 };

      const executionPrice = manager.calculateExecutionPrice(basePrice, 'buy', slippage);

      expect(executionPrice).toBe(100.10); // 0.1% higher
    });

    test('should apply slippage to sell orders', () => {
      const basePrice = 100.00;
      const slippage = { buy: 0.001, sell: 0.001 };

      const executionPrice = manager.calculateExecutionPrice(basePrice, 'sell', slippage);

      expect(executionPrice).toBe(99.90); // 0.1% lower
    });
  });

  // ==================== Position Management Tests ====================

  describe('Position Management', () => {
    test('should create new position on buy order', async () => {
      mockDb.query.mockResolvedValueOnce([[{
        id: 'acc_123',
        user_id: 'user_123',
        initial_capital: 100000
      }]]);

      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const order = {
        id: 'ord_123',
        accountId: 'acc_123',
        symbol: 'AAPL',
        quantity: 10,
        executionPrice: 150.00,
        totalValue: 1500.00,
        commission: 1.50
      };

      const position = await manager.createPosition('acc_123', order, 150.00);

      expect(position).toBeDefined();
      expect(position.symbol).toBe('AAPL');
      expect(position.quantity).toBe(10);
      expect(position.averageCost).toBe(150.00);
      expect(position.totalCost).toBe(1501.50); // Price + commission
    });

    test('should update position on additional buy', async () => {
      const existingPosition = {
        id: 'pos_123',
        account_id: 'acc_123',
        symbol: 'AAPL',
        quantity: 10,
        average_cost: 145.00,
        total_cost: 1450.00,
        realized_pl: 0
      };

      const newOrder = {
        id: 'ord_456',
        accountId: 'acc_123',
        symbol: 'AAPL',
        side: 'buy',
        quantity: 5,
        executionPrice: 155.00,
        totalValue: 775.00,
        commission: 0.78
      };

      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const updatedPosition = await manager.modifyPosition(existingPosition, newOrder, 155.00);

      expect(updatedPosition.quantity).toBe(15); // 10 + 5
      expect(updatedPosition.totalCost).toBeCloseTo(2225.78); // 1450 + 775 + 0.78
      expect(updatedPosition.averageCost).toBeCloseTo(148.385); // 2225.78 / 15
    });

    test('should calculate realized P&L on sell order', async () => {
      const existingPosition = {
        id: 'pos_123',
        account_id: 'acc_123',
        symbol: 'AAPL',
        quantity: 10,
        average_cost: 145.00,
        total_cost: 1450.00,
        realized_pl: 0
      };

      const sellOrder = {
        id: 'ord_789',
        accountId: 'acc_123',
        symbol: 'AAPL',
        side: 'sell',
        quantity: 5,
        executionPrice: 155.00,
        totalValue: 775.00,
        commission: 0.78
      };

      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // Update order P&L
      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // Update position

      const updatedPosition = await manager.modifyPosition(existingPosition, sellOrder, 155.00);

      // Realized P&L = (Sell Price * Qty - Commission) - (Cost Basis * Qty)
      // = (155 * 5 - 0.78) - (145 * 5)
      // = 774.22 - 725 = 49.22

      expect(updatedPosition.quantity).toBe(5); // 10 - 5
      expect(updatedPosition.realizedPl).toBeCloseTo(49.22);
    });

    test('should close position when selling entire quantity', async () => {
      const existingPosition = {
        id: 'pos_123',
        account_id: 'acc_123',
        symbol: 'AAPL',
        quantity: 10,
        average_cost: 145.00,
        total_cost: 1450.00,
        realized_pl: 0
      };

      const sellOrder = {
        id: 'ord_890',
        accountId: 'acc_123',
        symbol: 'AAPL',
        side: 'sell',
        quantity: 10, // Selling all
        executionPrice: 155.00,
        totalValue: 1550.00,
        commission: 1.55
      };

      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // Update order P&L
      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // Delete position

      const result = await manager.modifyPosition(existingPosition, sellOrder, 155.00);

      expect(result).toBeNull(); // Position closed
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM paper_trading_positions'),
        expect.any(Array)
      );
    });

    test('should get all positions for account', async () => {
      const mockPositions = [
        {
          id: 'pos_1',
          account_id: 'acc_123',
          symbol: 'AAPL',
          quantity: 10,
          average_cost: 150.00,
          current_price: 155.00,
          market_value: 1550.00,
          unrealized_pl: 50.00,
          unrealized_pl_percent: 3.33
        },
        {
          id: 'pos_2',
          account_id: 'acc_123',
          symbol: 'TSLA',
          quantity: 5,
          average_cost: 200.00,
          current_price: 195.00,
          market_value: 975.00,
          unrealized_pl: -25.00,
          unrealized_pl_percent: -2.50
        }
      ];

      mockDb.query.mockResolvedValueOnce([mockPositions]);

      const positions = await manager.getAccountPositions('acc_123');

      expect(positions).toHaveLength(2);
      expect(positions[0].symbol).toBe('AAPL');
      expect(positions[1].symbol).toBe('TSLA');
    });

    test('should update position prices', async () => {
      const mockPositions = [
        {
          id: 'pos_1',
          symbol: 'AAPL',
          quantity: 10,
          totalCost: 1500.00
        }
      ];

      mockDb.query.mockResolvedValueOnce([mockPositions]); // Get positions
      mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // Update position

      await manager.updatePositionPrices('acc_123');

      expect(mockMarketData.getQuote).toHaveBeenCalledWith('AAPL');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE paper_trading_positions'),
        expect.arrayContaining([expect.any(Number), expect.any(Number)])
      );
    });
  });

  // ==================== Performance Calculation Tests ====================

  describe('Performance Calculations', () => {
    test('should calculate performance summary correctly', async () => {
      const mockAccount = {
        id: 'acc_123',
        user_id: 'user_123',
        name: 'Test Account',
        initialCapital: 100000,
        currentCash: 95000,
        totalPl: 5000,
        totalTrades: 20,
        winningTrades: 14,
        losingTrades: 6,
        winRate: 70.00,
        profitFactor: 2.5,
        maxDrawdown: 5.0,
        sharpeRatio: 1.8
      };

      const mockPositions = [
        {
          symbol: 'AAPL',
          quantity: 10,
          currentPrice: 155.00,
          marketValue: 1550.00,
          unrealizedPl: 50.00,
          unrealizedPlPercent: 3.33
        }
      ];

      mockDb.query.mockResolvedValueOnce([[mockAccount]]);
      mockDb.query.mockResolvedValueOnce([mockPositions]);

      const performance = await manager.getPerformanceSummary('acc_123');

      expect(performance).toBeDefined();
      expect(performance.totalEquity).toBe(96550.00); // 95000 cash + 1550 positions
      expect(performance.positionValue).toBe(1550.00);
      expect(performance.totalReturn).toBeCloseTo(-3.45); // (96550 - 100000) / 100000 * 100
      expect(performance.winRate).toBe(70.00);
      expect(performance.totalTrades).toBe(20);
    });

    test('should calculate total return correctly', () => {
      const initialCapital = 100000;
      const totalEquity = 110000;
      const expectedReturn = ((totalEquity - initialCapital) / initialCapital) * 100;

      expect(expectedReturn).toBe(10.00); // 10% return
    });

    test('should calculate win rate correctly', () => {
      const winningTrades = 14;
      const totalTrades = 20;
      const expectedWinRate = (winningTrades / totalTrades) * 100;

      expect(expectedWinRate).toBe(70.00); // 70% win rate
    });

    test('should calculate profit factor correctly', () => {
      const grossProfit = 10000;
      const grossLoss = 4000;
      const expectedProfitFactor = grossProfit / grossLoss;

      expect(expectedProfitFactor).toBe(2.5);
    });
  });

  // ==================== Validation Tests ====================

  describe('Order Validation', () => {
    let mockAccount;

    beforeEach(() => {
      mockAccount = {
        id: 'acc_123',
        userId: 'user_123',
        status: 'active',
        allowShortSelling: false,
        positionLimit: 10
      };
    });

    test('should reject order with missing symbol', async () => {
      const orderData = {
        side: 'buy',
        type: 'market',
        quantity: 10
      };

      await expect(manager.validateOrder(mockAccount, orderData))
        .rejects.toThrow('Missing required order fields');
    });

    test('should reject order with invalid quantity', async () => {
      const orderData = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: -5
      };

      await expect(manager.validateOrder(mockAccount, orderData))
        .rejects.toThrow('Quantity must be positive');
    });

    test('should reject order with invalid side', async () => {
      const orderData = {
        symbol: 'AAPL',
        side: 'invalid',
        type: 'market',
        quantity: 10
      };

      await expect(manager.validateOrder(mockAccount, orderData))
        .rejects.toThrow('Invalid order side');
    });

    test('should reject order when account is not active', async () => {
      mockAccount.status = 'paused';

      const orderData = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: 10
      };

      await expect(manager.validateOrder(mockAccount, orderData))
        .rejects.toThrow('Account is not active');
    });

    test('should reject order when position limit reached', async () => {
      mockDb.query.mockResolvedValueOnce([Array(10).fill({ symbol: 'TEST' })]);

      const orderData = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: 10
      };

      await expect(manager.validateOrder(mockAccount, orderData))
        .rejects.toThrow('Position limit reached');
    });
  });

  // ==================== Helper Methods Tests ====================

  describe('Helper Methods', () => {
    test('should format account data correctly', () => {
      const row = {
        id: 'acc_123',
        user_id: 'user_123',
        name: 'Test Account',
        status: 'active',
        initial_capital: '100000.00',
        current_cash: '95000.00',
        commission_rate: '0.0010',
        total_trades: 10,
        win_rate: '60.00',
        created_at: new Date()
      };

      const formatted = manager.formatAccount(row);

      expect(formatted.id).toBe('acc_123');
      expect(formatted.userId).toBe('user_123');
      expect(typeof formatted.initialCapital).toBe('number');
      expect(formatted.initialCapital).toBe(100000);
      expect(typeof formatted.commissionRate).toBe('number');
    });

    test('should format order data correctly', () => {
      const row = {
        id: 'ord_123',
        account_id: 'acc_123',
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        execution_price: '150.25',
        commission: '1.50',
        status: 'filled',
        created_at: new Date()
      };

      const formatted = manager.formatOrder(row);

      expect(formatted.id).toBe('ord_123');
      expect(formatted.symbol).toBe('AAPL');
      expect(typeof formatted.executionPrice).toBe('number');
      expect(formatted.executionPrice).toBe(150.25);
    });

    test('should get current price from market data', async () => {
      const price = await manager.getCurrentPrice('AAPL');

      expect(price).toBe(150.00);
      expect(mockMarketData.getQuote).toHaveBeenCalledWith('AAPL');
    });

    test('should use price cache when available', async () => {
      // First call - fetch from market data
      await manager.getCurrentPrice('AAPL');

      // Second call - should use cache
      await manager.getCurrentPrice('AAPL');

      // Should only call market data once
      expect(mockMarketData.getQuote).toHaveBeenCalledTimes(2); // Cache expires in 5s
    });

    test('should handle market data errors gracefully', async () => {
      mockMarketData.getQuote.mockRejectedValueOnce(new Error('API error'));

      const price = await manager.getCurrentPrice('AAPL');

      // Should return fallback price
      expect(price).toBeGreaterThan(0);
      expect(price).toBeLessThan(200);
    });
  });
});
