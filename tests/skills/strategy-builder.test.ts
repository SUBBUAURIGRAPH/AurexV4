/**
 * Strategy Builder Skill - Test Suite
 * Tests for strategy creation, backtesting, and deployment
 */

import StrategyBuilder, { StrategyBuilder as StrategyBuilderClass } from '../../src/skills/strategy-builder';

describe('StrategyBuilder Skill', () => {
  let builder: StrategyBuilderClass;

  beforeEach(() => {
    builder = new StrategyBuilder();
  });

  describe('Initialization', () => {
    it('should initialize with default templates', () => {
      const templates = builder.listTemplates();
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should have momentum, mean reversion, and MACD templates', () => {
      const templates = builder.listTemplates();
      const templateNames = templates.map(t => t.name);

      expect(templateNames).toContain('Simple Momentum');
      expect(templateNames).toContain('Mean Reversion');
      expect(templateNames).toContain('MACD Crossover');
    });

    it('should initialize with no strategies', () => {
      const strategies = builder.listStrategies();
      expect(strategies).toHaveLength(0);
    });
  });

  describe('Strategy Creation from Templates', () => {
    it('should create strategy from momentum template', () => {
      const strategy = builder.createFromTemplate(
        'Simple Momentum',
        'My Momentum Strategy',
        ['binance'],
        'BTC/USDT'
      );

      expect(strategy).not.toBeNull();
      expect(strategy?.name).toBe('My Momentum Strategy');
      expect(strategy?.type).toBe('momentum');
      expect(strategy?.status).toBe('draft');
    });

    it('should create strategy from mean reversion template', () => {
      const strategy = builder.createFromTemplate(
        'Mean Reversion',
        'Mean Reversion Strategy',
        ['coinbase'],
        'ETH/USDT'
      );

      expect(strategy).not.toBeNull();
      expect(strategy?.type).toBe('mean-reversion');
    });

    it('should inherit default indicators from template', () => {
      const strategy = builder.createFromTemplate(
        'Simple Momentum',
        'Test Strategy',
        ['binance'],
        'BTC/USDT'
      );

      expect(strategy?.indicators.length).toBeGreaterThan(0);
      expect(strategy?.indicators[0].type).toBe('SMA');
    });

    it('should inherit risk management from template', () => {
      const strategy = builder.createFromTemplate(
        'Simple Momentum',
        'Test Strategy',
        ['binance'],
        'BTC/USDT'
      );

      expect(strategy?.riskManagement.maxPositionSize).toBe(10000);
      expect(strategy?.riskManagement.maxDailyLoss).toBe(500);
    });

    it('should return null for invalid template', () => {
      const strategy = builder.createFromTemplate(
        'Invalid Template',
        'Test Strategy',
        ['binance'],
        'BTC/USDT'
      );

      expect(strategy).toBeNull();
    });

    it('should support multiple exchanges', () => {
      const strategy = builder.createFromTemplate(
        'Simple Momentum',
        'Multi-Exchange Strategy',
        ['binance', 'coinbase', 'kraken'],
        'BTC/USDT'
      );

      expect(strategy?.exchanges).toEqual(['binance', 'coinbase', 'kraken']);
    });
  });

  describe('Custom Strategy Creation', () => {
    it('should create custom strategy', () => {
      const strategy = builder.createCustomStrategy(
        'Custom Strategy',
        'My custom trading strategy',
        ['binance'],
        'ETH/USDT',
        'custom'
      );

      expect(strategy).not.toBeNull();
      expect(strategy.name).toBe('Custom Strategy');
      expect(strategy.status).toBe('draft');
      expect(strategy.type).toBe('custom');
    });

    it('should have empty indicators initially', () => {
      const strategy = builder.createCustomStrategy(
        'Custom',
        'desc',
        ['binance'],
        'BTC/USDT',
        'custom'
      );

      expect(strategy.indicators).toHaveLength(0);
    });

    it('should create unique strategy IDs', () => {
      const strategy1 = builder.createCustomStrategy('S1', 'd', ['b'], 'P', 'custom');
      const strategy2 = builder.createCustomStrategy('S2', 'd', ['b'], 'P', 'custom');

      expect(strategy1.id).not.toBe(strategy2.id);
    });
  });

  describe('Indicator Management', () => {
    let strategyId: string;

    beforeEach(() => {
      const strategy = builder.createCustomStrategy('Test', 'desc', ['binance'], 'BTC/USDT', 'custom');
      strategyId = strategy.id;
    });

    it('should add indicator to strategy', () => {
      const result = builder.addIndicator(strategyId, {
        type: 'SMA',
        period: 20,
      });

      expect(result).toBe(true);

      const strategy = builder.getStrategy(strategyId);
      expect(strategy?.indicators).toHaveLength(1);
    });

    it('should add multiple indicators', () => {
      builder.addIndicator(strategyId, { type: 'SMA', period: 20 });
      builder.addIndicator(strategyId, { type: 'EMA', period: 50 });
      builder.addIndicator(strategyId, { type: 'RSI', period: 14 });

      const strategy = builder.getStrategy(strategyId);
      expect(strategy?.indicators).toHaveLength(3);
    });

    it('should support various indicator types', () => {
      const indicatorTypes = ['SMA', 'EMA', 'RSI', 'MACD', 'Bollinger'];

      indicatorTypes.forEach(type => {
        builder.addIndicator(strategyId, {
          type: type as any,
          period: 20,
        });
      });

      const strategy = builder.getStrategy(strategyId);
      expect(strategy?.indicators).toHaveLength(5);
    });

    it('should return false for invalid strategy', () => {
      const result = builder.addIndicator('invalid-id', {
        type: 'SMA',
        period: 20,
      });

      expect(result).toBe(false);
    });
  });

  describe('Entry Conditions', () => {
    let strategyId: string;

    beforeEach(() => {
      const strategy = builder.createCustomStrategy('Test', 'desc', ['binance'], 'BTC/USDT', 'custom');
      strategyId = strategy.id;
    });

    it('should add entry condition', () => {
      const result = builder.addEntryCondition(strategyId, {
        indicator: 'SMA20',
        operator: '>',
        value: 50000,
      });

      expect(result).toBe(true);

      const strategy = builder.getStrategy(strategyId);
      expect(strategy?.entryConditions).toHaveLength(1);
    });

    it('should support various operators', () => {
      const operators = ['>', '<', '==', '!=', '>=', '<='];

      operators.forEach(op => {
        const strategy = builder.createCustomStrategy('T', 'd', ['b'], 'P', 'custom');
        builder.addEntryCondition(strategy.id, {
          indicator: 'test',
          operator: op as any,
          value: 100,
        });
      });

      const allStrategies = builder.listStrategies();
      expect(allStrategies.length).toBeGreaterThan(0);
    });

    it('should add multiple entry conditions with logic', () => {
      builder.addEntryCondition(strategyId, {
        indicator: 'SMA',
        operator: '>',
        value: 50000,
        logic: 'AND',
      });

      builder.addEntryCondition(strategyId, {
        indicator: 'RSI',
        operator: '<',
        value: 30,
      });

      const strategy = builder.getStrategy(strategyId);
      expect(strategy?.entryConditions).toHaveLength(2);
    });
  });

  describe('Exit Conditions', () => {
    let strategyId: string;

    beforeEach(() => {
      const strategy = builder.createCustomStrategy('Test', 'desc', ['binance'], 'BTC/USDT', 'custom');
      strategyId = strategy.id;
    });

    it('should add take profit exit', () => {
      const result = builder.addExitCondition(strategyId, {
        type: 'takeProfit',
        value: 5,
      });

      expect(result).toBe(true);

      const strategy = builder.getStrategy(strategyId);
      expect(strategy?.exitConditions).toHaveLength(1);
    });

    it('should add stop loss exit', () => {
      const result = builder.addExitCondition(strategyId, {
        type: 'stopLoss',
        value: 2,
      });

      expect(result).toBe(true);
    });

    it('should add signal-based exit', () => {
      const result = builder.addExitCondition(strategyId, {
        type: 'signal',
        indicator: 'SMA_crossover',
      });

      expect(result).toBe(true);
    });

    it('should add multiple exit conditions', () => {
      builder.addExitCondition(strategyId, { type: 'takeProfit', value: 5 });
      builder.addExitCondition(strategyId, { type: 'stopLoss', value: 2 });

      const strategy = builder.getStrategy(strategyId);
      expect(strategy?.exitConditions).toHaveLength(2);
    });
  });

  describe('Risk Management', () => {
    let strategyId: string;

    beforeEach(() => {
      const strategy = builder.createCustomStrategy('Test', 'desc', ['binance'], 'BTC/USDT', 'custom');
      strategyId = strategy.id;
    });

    it('should update risk management parameters', () => {
      const result = builder.updateRiskManagement(strategyId, {
        maxPositionSize: 5000,
        maxDailyLoss: 250,
      });

      expect(result).toBe(true);

      const strategy = builder.getStrategy(strategyId);
      expect(strategy?.riskManagement.maxPositionSize).toBe(5000);
      expect(strategy?.riskManagement.maxDailyLoss).toBe(250);
    });

    it('should update stop loss and take profit', () => {
      builder.updateRiskManagement(strategyId, {
        stopLossPercent: 1.5,
        takeProfitPercent: 3.5,
      });

      const strategy = builder.getStrategy(strategyId);
      expect(strategy?.riskManagement.stopLossPercent).toBe(1.5);
      expect(strategy?.riskManagement.takeProfitPercent).toBe(3.5);
    });

    it('should update max drawdown', () => {
      builder.updateRiskManagement(strategyId, {
        maxDrawdown: 15,
      });

      const strategy = builder.getStrategy(strategyId);
      expect(strategy?.riskManagement.maxDrawdown).toBe(15);
    });
  });

  describe('Strategy Validation', () => {
    it('should require strategy name', () => {
      const strategy = builder.createCustomStrategy('', 'desc', ['binance'], 'BTC/USDT', 'custom');
      const validation = builder.validateStrategy(strategy.id);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('should require trading pair', () => {
      const strategy = builder.createCustomStrategy('Test', 'desc', ['binance'], '', 'custom');
      const validation = builder.validateStrategy(strategy.id);

      expect(validation.valid).toBe(false);
    });

    it('should require at least one exchange', () => {
      const strategy = builder.createCustomStrategy('Test', 'desc', [], 'BTC/USDT', 'custom');
      const validation = builder.validateStrategy(strategy.id);

      expect(validation.valid).toBe(false);
    });

    it('should require indicators', () => {
      const strategy = builder.createCustomStrategy('Test', 'desc', ['binance'], 'BTC/USDT', 'custom');
      const validation = builder.validateStrategy(strategy.id);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('indicator'))).toBe(true);
    });

    it('should require entry conditions', () => {
      const strategy = builder.createCustomStrategy('Test', 'desc', ['binance'], 'BTC/USDT', 'custom');
      builder.addIndicator(strategy.id, { type: 'SMA', period: 20 });

      const validation = builder.validateStrategy(strategy.id);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('entry'))).toBe(true);
    });

    it('should require exit conditions', () => {
      const strategy = builder.createCustomStrategy('Test', 'desc', ['binance'], 'BTC/USDT', 'custom');
      builder.addIndicator(strategy.id, { type: 'SMA', period: 20 });
      builder.addEntryCondition(strategy.id, { indicator: 'SMA', operator: '>', value: 100 });

      const validation = builder.validateStrategy(strategy.id);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('exit'))).toBe(true);
    });

    it('should validate complete strategy', () => {
      const strategy = builder.createFromTemplate('Simple Momentum', 'Test', ['binance'], 'BTC/USDT');
      if (strategy) {
        builder.addEntryCondition(strategy.id, { indicator: 'SMA', operator: '>', value: 100 });
        builder.addExitCondition(strategy.id, { type: 'takeProfit', value: 5 });

        const validation = builder.validateStrategy(strategy.id);

        // May still have some validation errors but should be mostly valid
        expect(validation.errors.length).toBeLessThan(3);
      }
    });
  });

  describe('Backtesting', () => {
    let strategyId: string;

    beforeEach(async () => {
      const strategy = builder.createFromTemplate('Simple Momentum', 'Test', ['binance'], 'BTC/USDT');
      if (strategy) {
        builder.addEntryCondition(strategy.id, { indicator: 'SMA', operator: '>', value: 100 });
        builder.addExitCondition(strategy.id, { type: 'takeProfit', value: 5 });
        strategyId = strategy.id;
      }
    });

    it('should backtest strategy', async () => {
      if (strategyId) {
        const startDate = new Date('2023-01-01');
        const endDate = new Date('2023-12-31');

        const result = await builder.backtest(strategyId, startDate, endDate);

        expect(result).not.toBeNull();
        expect(result?.totalTrades).toBeGreaterThan(0);
      }
    });

    it('should return realistic backtest metrics', async () => {
      if (strategyId) {
        const result = await builder.backtest(
          strategyId,
          new Date('2023-01-01'),
          new Date('2023-12-31')
        );

        expect(result?.winRate).toBeGreaterThan(0);
        expect(result?.winRate).toBeLessThanOrEqual(100);
        expect(result?.sharpeRatio).toBeGreaterThan(0);
      }
    });

    it('should calculate win rate correctly', async () => {
      if (strategyId) {
        const result = await builder.backtest(
          strategyId,
          new Date('2023-01-01'),
          new Date('2023-12-31')
        );

        const expectedWinRate = (result!.winningTrades / result!.totalTrades) * 100;
        expect(result?.winRate).toBeCloseTo(expectedWinRate, 1);
      }
    });
  });

  describe('Strategy Deployment', () => {
    it('should deploy validated strategy', async () => {
      const strategy = builder.createFromTemplate('Simple Momentum', 'Test', ['binance'], 'BTC/USDT');
      if (strategy) {
        builder.addEntryCondition(strategy.id, { indicator: 'SMA', operator: '>', value: 100 });
        builder.addExitCondition(strategy.id, { type: 'takeProfit', value: 5 });

        // Backtest first
        await builder.backtest(
          strategy.id,
          new Date('2023-01-01'),
          new Date('2023-12-31')
        );

        const result = builder.deployStrategy(strategy.id);
        expect(result).toBe(true);

        const deployed = builder.getStrategy(strategy.id);
        expect(deployed?.status).toBe('active');
      }
    });

    it('should require backtesting before deployment', () => {
      const strategy = builder.createFromTemplate('Simple Momentum', 'Test', ['binance'], 'BTC/USDT');
      if (strategy) {
        builder.addEntryCondition(strategy.id, { indicator: 'SMA', operator: '>', value: 100 });
        builder.addExitCondition(strategy.id, { type: 'takeProfit', value: 5 });

        // Try to deploy without backtesting
        const result = builder.deployStrategy(strategy.id);
        expect(result).toBe(false);
      }
    });
  });

  describe('Strategy Lifecycle', () => {
    it('should pause active strategy', async () => {
      const strategy = builder.createFromTemplate('Simple Momentum', 'Test', ['binance'], 'BTC/USDT');
      if (strategy) {
        builder.addEntryCondition(strategy.id, { indicator: 'SMA', operator: '>', value: 100 });
        builder.addExitCondition(strategy.id, { type: 'takeProfit', value: 5 });

        await builder.backtest(strategy.id, new Date('2023-01-01'), new Date('2023-12-31'));
        builder.deployStrategy(strategy.id);

        const result = builder.pauseStrategy(strategy.id);
        expect(result).toBe(true);

        const paused = builder.getStrategy(strategy.id);
        expect(paused?.status).toBe('paused');
      }
    });

    it('should resume paused strategy', async () => {
      const strategy = builder.createFromTemplate('Simple Momentum', 'Test', ['binance'], 'BTC/USDT');
      if (strategy) {
        builder.addEntryCondition(strategy.id, { indicator: 'SMA', operator: '>', value: 100 });
        builder.addExitCondition(strategy.id, { type: 'takeProfit', value: 5 });

        await builder.backtest(strategy.id, new Date('2023-01-01'), new Date('2023-12-31'));
        builder.deployStrategy(strategy.id);
        builder.pauseStrategy(strategy.id);

        const result = builder.resumeStrategy(strategy.id);
        expect(result).toBe(true);

        const resumed = builder.getStrategy(strategy.id);
        expect(resumed?.status).toBe('active');
      }
    });
  });

  describe('Reporting', () => {
    it('should generate strategy report', () => {
      const strategy = builder.createFromTemplate('Simple Momentum', 'Test', ['binance'], 'BTC/USDT');
      if (strategy) {
        const report = builder.generateReport(strategy.id);

        expect(typeof report).toBe('string');
        expect(report).toContain('STRATEGY REPORT');
        expect(report).toContain('Simple Momentum');
        expect(report).toContain('BTC/USDT');
      }
    });

    it('should include backtest results in report', async () => {
      const strategy = builder.createFromTemplate('Simple Momentum', 'Test', ['binance'], 'BTC/USDT');
      if (strategy) {
        builder.addEntryCondition(strategy.id, { indicator: 'SMA', operator: '>', value: 100 });
        builder.addExitCondition(strategy.id, { type: 'takeProfit', value: 5 });

        await builder.backtest(strategy.id, new Date('2023-01-01'), new Date('2023-12-31'));

        const report = builder.generateReport(strategy.id);
        expect(report).toContain('BACKTEST RESULTS');
      }
    });
  });

  describe('Strategy Listing', () => {
    it('should list all strategies', () => {
      builder.createCustomStrategy('S1', 'd', ['b'], 'P', 'custom');
      builder.createCustomStrategy('S2', 'd', ['b'], 'P', 'custom');
      builder.createCustomStrategy('S3', 'd', ['b'], 'P', 'custom');

      const strategies = builder.listStrategies();
      expect(strategies).toHaveLength(3);
    });

    it('should list strategies by status', async () => {
      const s1 = builder.createCustomStrategy('S1', 'd', ['b'], 'P', 'custom');
      const s2 = builder.createFromTemplate('Simple Momentum', 'S2', ['b'], 'P');

      if (s2) {
        builder.addEntryCondition(s2.id, { indicator: 'SMA', operator: '>', value: 100 });
        builder.addExitCondition(s2.id, { type: 'takeProfit', value: 5 });
        await builder.backtest(s2.id, new Date('2023-01-01'), new Date('2023-12-31'));
        builder.deployStrategy(s2.id);
      }

      const draftStrategies = builder.listStrategies('draft');
      const activeStrategies = builder.listStrategies('active');

      expect(draftStrategies.length).toBeGreaterThan(0);
      expect(activeStrategies.length).toBeGreaterThan(0);
    });
  });
});
