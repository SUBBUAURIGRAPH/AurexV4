/**
 * Performance Analyzer Tests
 * Tests for all performance metric calculations
 */

import { PerformanceAnalyzer } from '../performanceAnalyzer';
import { PerformanceMetrics, TradeAnalytics, TradeStatus, TradeType } from '../types';

describe('PerformanceAnalyzer', () => {
  describe('calculateDailyReturn', () => {
    it('should calculate daily return correctly', () => {
      const result = PerformanceAnalyzer.calculateDailyReturn(11000, 10000);
      expect(result).toBe(0.1);
    });

    it('should return 0 for zero previous value', () => {
      const result = PerformanceAnalyzer.calculateDailyReturn(10000, 0);
      expect(result).toBe(0);
    });

    it('should handle negative returns', () => {
      const result = PerformanceAnalyzer.calculateDailyReturn(9000, 10000);
      expect(result).toBe(-0.1);
    });
  });

  describe('calculateVolatility', () => {
    it('should calculate volatility from performance data', () => {
      const data: PerformanceMetrics[] = [
        {
          id: 1,
          userId: 'user1',
          strategyId: 'strat1',
          timestamp: new Date('2024-01-01'),
          portfolioValue: 10000,
          dailyReturn: 0,
          cumulativeReturn: 0,
          priceChange: 0
        },
        {
          id: 2,
          userId: 'user1',
          strategyId: 'strat1',
          timestamp: new Date('2024-01-02'),
          portfolioValue: 10100,
          dailyReturn: 0.01,
          cumulativeReturn: 0.01,
          priceChange: 100
        },
        {
          id: 3,
          userId: 'user1',
          strategyId: 'strat1',
          timestamp: new Date('2024-01-03'),
          portfolioValue: 10050,
          dailyReturn: -0.0049,
          cumulativeReturn: 0.005,
          priceChange: -50
        }
      ];

      const volatility = PerformanceAnalyzer.calculateVolatility(data, 2);
      expect(typeof volatility).toBe('number');
      expect(volatility).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for insufficient data', () => {
      const volatility = PerformanceAnalyzer.calculateVolatility([], 20);
      expect(volatility).toBe(0);
    });
  });

  describe('calculateSharpeRatio', () => {
    it('should calculate Sharpe ratio correctly', () => {
      const sharpe = PerformanceAnalyzer.calculateSharpeRatio(0.01, 0.02, 0.02);
      expect(typeof sharpe).toBe('number');
    });

    it('should handle zero volatility', () => {
      const sharpe = PerformanceAnalyzer.calculateSharpeRatio(0.01, 0, 0.02);
      expect(sharpe).toBe(0);
    });
  });

  describe('calculateMaxDrawdown', () => {
    it('should calculate max drawdown correctly', () => {
      const data: PerformanceMetrics[] = [
        {
          id: 1,
          userId: 'user1',
          strategyId: 'strat1',
          timestamp: new Date(),
          portfolioValue: 10000,
          dailyReturn: 0,
          cumulativeReturn: 0,
          priceChange: 0
        },
        {
          id: 2,
          userId: 'user1',
          strategyId: 'strat1',
          timestamp: new Date(),
          portfolioValue: 12000,
          dailyReturn: 0.2,
          cumulativeReturn: 0.2,
          priceChange: 2000
        },
        {
          id: 3,
          userId: 'user1',
          strategyId: 'strat1',
          timestamp: new Date(),
          portfolioValue: 10800,
          dailyReturn: -0.1,
          cumulativeReturn: 0.08,
          priceChange: -1200
        }
      ];

      const maxDrawdown = PerformanceAnalyzer.calculateMaxDrawdown(data);
      expect(maxDrawdown).toBeLessThan(0);
      expect(maxDrawdown).toBeGreaterThan(-0.2);
    });
  });

  describe('calculateWinRate', () => {
    it('should calculate win rate correctly', () => {
      const trades: TradeAnalytics[] = [
        {
          id: 1,
          userId: 'user1',
          strategyId: 'strat1',
          tradeId: 'trade1',
          symbol: 'AAPL',
          entryTime: new Date(),
          entryPrice: 100,
          quantity: 10,
          entryCost: 1000,
          netProfit: 100,
          tradeType: TradeType.LONG,
          status: TradeStatus.CLOSED
        },
        {
          id: 2,
          userId: 'user1',
          strategyId: 'strat1',
          tradeId: 'trade2',
          symbol: 'AAPL',
          entryTime: new Date(),
          entryPrice: 100,
          quantity: 10,
          entryCost: 1000,
          netProfit: -50,
          tradeType: TradeType.LONG,
          status: TradeStatus.CLOSED
        }
      ];

      const winRate = PerformanceAnalyzer.calculateWinRate(trades);
      expect(winRate).toBe(0.5);
    });

    it('should return 0 for no trades', () => {
      const winRate = PerformanceAnalyzer.calculateWinRate([]);
      expect(winRate).toBe(0);
    });
  });

  describe('calculateProfitFactor', () => {
    it('should calculate profit factor correctly', () => {
      const trades: TradeAnalytics[] = [
        {
          id: 1,
          userId: 'user1',
          strategyId: 'strat1',
          tradeId: 'trade1',
          symbol: 'AAPL',
          entryTime: new Date(),
          entryPrice: 100,
          quantity: 10,
          entryCost: 1000,
          netProfit: 200,
          tradeType: TradeType.LONG,
          status: TradeStatus.CLOSED
        },
        {
          id: 2,
          userId: 'user1',
          strategyId: 'strat1',
          tradeId: 'trade2',
          symbol: 'AAPL',
          entryTime: new Date(),
          entryPrice: 100,
          quantity: 10,
          entryCost: 1000,
          netProfit: -100,
          tradeType: TradeType.LONG,
          status: TradeStatus.CLOSED
        }
      ];

      const profitFactor = PerformanceAnalyzer.calculateProfitFactor(trades);
      expect(profitFactor).toBe(2);
    });
  });

  describe('calculateExpectancy', () => {
    it('should calculate expectancy correctly', () => {
      const trades: TradeAnalytics[] = [
        {
          id: 1,
          userId: 'user1',
          strategyId: 'strat1',
          tradeId: 'trade1',
          symbol: 'AAPL',
          entryTime: new Date(),
          entryPrice: 100,
          quantity: 10,
          entryCost: 1000,
          netProfit: 100,
          tradeType: TradeType.LONG,
          status: TradeStatus.CLOSED
        },
        {
          id: 2,
          userId: 'user1',
          strategyId: 'strat1',
          tradeId: 'trade2',
          symbol: 'AAPL',
          entryTime: new Date(),
          entryPrice: 100,
          quantity: 10,
          entryCost: 1000,
          netProfit: 50,
          tradeType: TradeType.LONG,
          status: TradeStatus.CLOSED
        }
      ];

      const expectancy = PerformanceAnalyzer.calculateExpectancy(trades);
      expect(expectancy).toBe(75);
    });
  });

  describe('getConsecutiveStats', () => {
    it('should identify consecutive wins and losses', () => {
      const trades: TradeAnalytics[] = [
        {
          id: 1,
          userId: 'user1',
          strategyId: 'strat1',
          tradeId: 'trade1',
          symbol: 'AAPL',
          entryTime: new Date(),
          entryPrice: 100,
          quantity: 10,
          entryCost: 1000,
          netProfit: 100,
          tradeType: TradeType.LONG,
          status: TradeStatus.CLOSED
        },
        {
          id: 2,
          userId: 'user1',
          strategyId: 'strat1',
          tradeId: 'trade2',
          symbol: 'AAPL',
          entryTime: new Date(),
          entryPrice: 100,
          quantity: 10,
          entryCost: 1000,
          netProfit: 50,
          tradeType: TradeType.LONG,
          status: TradeStatus.CLOSED
        },
        {
          id: 3,
          userId: 'user1',
          strategyId: 'strat1',
          tradeId: 'trade3',
          symbol: 'AAPL',
          entryTime: new Date(),
          entryPrice: 100,
          quantity: 10,
          entryCost: 1000,
          netProfit: -30,
          tradeType: TradeType.LONG,
          status: TradeStatus.CLOSED
        }
      ];

      const stats = PerformanceAnalyzer.getConsecutiveStats(trades);
      expect(stats.maxConsecutiveWins).toBe(2);
      expect(stats.maxConsecutiveLosses).toBe(1);
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate complete metrics set', () => {
      const data: PerformanceMetrics[] = [
        {
          id: 1,
          userId: 'user1',
          strategyId: 'strat1',
          timestamp: new Date(),
          portfolioValue: 10000,
          dailyReturn: 0,
          cumulativeReturn: 0,
          priceChange: 0
        },
        {
          id: 2,
          userId: 'user1',
          strategyId: 'strat1',
          timestamp: new Date(),
          portfolioValue: 10500,
          dailyReturn: 0.05,
          cumulativeReturn: 0.05,
          priceChange: 500
        }
      ];

      const trades: TradeAnalytics[] = [
        {
          id: 1,
          userId: 'user1',
          strategyId: 'strat1',
          tradeId: 'trade1',
          symbol: 'AAPL',
          entryTime: new Date(),
          entryPrice: 100,
          quantity: 10,
          entryCost: 1000,
          netProfit: 100,
          tradeType: TradeType.LONG,
          status: TradeStatus.CLOSED
        }
      ];

      const metrics = PerformanceAnalyzer.calculateMetrics(
        10500,
        10000,
        0.05,
        trades,
        data,
        0.02
      );

      expect(metrics.portfolioValue).toBe(10500);
      expect(metrics.sharpeRatio).toBeDefined();
      expect(metrics.maxDrawdown).toBeDefined();
      expect(metrics.winRate).toBe(1);
    });
  });
});
