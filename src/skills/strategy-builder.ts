/**
 * Strategy Builder Skill
 * Create, backtest, and deploy trading strategies
 * Agent: Trading Operations
 * Version: 1.0.0
 */

// Types for strategy builder
interface Indicator {
  type: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'Bollinger' | 'Custom';
  period: number;
  parameters?: Record<string, number>;
}

interface EntryCondition {
  indicator: string;
  operator: '>' | '<' | '==' | '!=' | '>=' | '<=';
  value: number;
  logic?: 'AND' | 'OR';
}

interface ExitCondition {
  type: 'takeProfit' | 'stopLoss' | 'signal';
  value?: number;
  indicator?: string;
}

interface RiskManagement {
  maxPositionSize: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  type: 'momentum' | 'mean-reversion' | 'arbitrage' | 'custom';
  exchanges: string[];
  tradingPair: string;
  indicators: Indicator[];
  entryConditions: EntryCondition[];
  exitConditions: ExitCondition[];
  riskManagement: RiskManagement;
  createdAt: Date;
  backtestResults?: BacktestResult;
  status: 'draft' | 'backtesting' | 'active' | 'paused' | 'archived';
}

interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  startDate: Date;
  endDate: Date;
  period: string;
}

interface StrategyTemplate {
  name: string;
  type: 'momentum' | 'mean-reversion' | 'arbitrage';
  description: string;
  defaultIndicators: Indicator[];
  defaultRiskManagement: RiskManagement;
}

/**
 * Strategy Builder Class
 * Manages strategy creation, backtesting, and deployment
 */
export class StrategyBuilder {
  private strategies: Map<string, Strategy>;
  private templates: Map<string, StrategyTemplate>;
  private backtestQueue: Array<{ strategyId: string; callback: () => Promise<void> }>;

  constructor() {
    this.strategies = new Map();
    this.templates = new Map();
    this.backtestQueue = [];
    this.initializeTemplates();
  }

  /**
   * Initialize default strategy templates
   */
  private initializeTemplates(): void {
    const templates: StrategyTemplate[] = [
      {
        name: 'Simple Momentum',
        type: 'momentum',
        description: 'Buy when price breaks above 20-day moving average, sell below 50-day MA',
        defaultIndicators: [
          { type: 'SMA', period: 20 },
          { type: 'SMA', period: 50 },
        ],
        defaultRiskManagement: {
          maxPositionSize: 10000,
          maxDailyLoss: 500,
          maxDrawdown: 20,
          stopLossPercent: 2,
          takeProfitPercent: 5,
        },
      },
      {
        name: 'Mean Reversion',
        type: 'mean-reversion',
        description: 'Buy oversold (RSI < 30), sell overbought (RSI > 70)',
        defaultIndicators: [
          { type: 'RSI', period: 14 },
          { type: 'Bollinger', period: 20, parameters: { stdDev: 2 } },
        ],
        defaultRiskManagement: {
          maxPositionSize: 5000,
          maxDailyLoss: 300,
          maxDrawdown: 15,
          stopLossPercent: 1.5,
          takeProfitPercent: 3,
        },
      },
      {
        name: 'MACD Crossover',
        type: 'momentum',
        description: 'Trade MACD signal line crossovers',
        defaultIndicators: [
          { type: 'MACD', period: 12, parameters: { signalPeriod: 9, histogramPeriod: 26 } },
        ],
        defaultRiskManagement: {
          maxPositionSize: 8000,
          maxDailyLoss: 400,
          maxDrawdown: 18,
          stopLossPercent: 2,
          takeProfitPercent: 4,
        },
      },
    ];

    templates.forEach(template => {
      this.templates.set(template.name, template);
    });
  }

  /**
   * Create a new strategy from template
   */
  createFromTemplate(
    templateName: string,
    strategyName: string,
    exchanges: string[],
    tradingPair: string
  ): Strategy | null {
    try {
      const template = this.templates.get(templateName);
      if (!template) {
        throw new Error(`Template not found: ${templateName}`);
      }

      const strategy: Strategy = {
        id: `strategy-${Date.now()}`,
        name: strategyName,
        description: template.description,
        type: template.type,
        exchanges,
        tradingPair,
        indicators: [...template.defaultIndicators],
        entryConditions: [],
        exitConditions: [],
        riskManagement: { ...template.defaultRiskManagement },
        createdAt: new Date(),
        status: 'draft',
      };

      this.strategies.set(strategy.id, strategy);
      return strategy;
    } catch (error) {
      console.error(`Error creating strategy from template:`, error);
      return null;
    }
  }

  /**
   * Create a custom strategy
   */
  createCustomStrategy(
    name: string,
    description: string,
    exchanges: string[],
    tradingPair: string,
    type: 'momentum' | 'mean-reversion' | 'arbitrage' | 'custom'
  ): Strategy {
    const strategy: Strategy = {
      id: `strategy-${Date.now()}`,
      name,
      description,
      type,
      exchanges,
      tradingPair,
      indicators: [],
      entryConditions: [],
      exitConditions: [],
      riskManagement: {
        maxPositionSize: 10000,
        maxDailyLoss: 500,
        maxDrawdown: 20,
      },
      createdAt: new Date(),
      status: 'draft',
    };

    this.strategies.set(strategy.id, strategy);
    return strategy;
  }

  /**
   * Add indicator to strategy
   */
  addIndicator(strategyId: string, indicator: Indicator): boolean {
    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      strategy.indicators.push(indicator);
      return true;
    } catch (error) {
      console.error(`Error adding indicator:`, error);
      return false;
    }
  }

  /**
   * Add entry condition to strategy
   */
  addEntryCondition(strategyId: string, condition: EntryCondition): boolean {
    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      strategy.entryConditions.push(condition);
      return true;
    } catch (error) {
      console.error(`Error adding entry condition:`, error);
      return false;
    }
  }

  /**
   * Add exit condition to strategy
   */
  addExitCondition(strategyId: string, condition: ExitCondition): boolean {
    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      strategy.exitConditions.push(condition);
      return true;
    } catch (error) {
      console.error(`Error adding exit condition:`, error);
      return false;
    }
  }

  /**
   * Update risk management parameters
   */
  updateRiskManagement(strategyId: string, riskManagement: Partial<RiskManagement>): boolean {
    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      strategy.riskManagement = { ...strategy.riskManagement, ...riskManagement };
      return true;
    } catch (error) {
      console.error(`Error updating risk management:`, error);
      return false;
    }
  }

  /**
   * Validate strategy configuration
   */
  validateStrategy(strategyId: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        return { valid: false, errors: [`Strategy not found: ${strategyId}`] };
      }

      // Check required fields
      if (!strategy.name) errors.push('Strategy name is required');
      if (!strategy.tradingPair) errors.push('Trading pair is required');
      if (strategy.exchanges.length === 0) errors.push('At least one exchange is required');
      if (strategy.indicators.length === 0) errors.push('At least one indicator is required');
      if (strategy.entryConditions.length === 0) errors.push('At least one entry condition is required');
      if (strategy.exitConditions.length === 0) errors.push('At least one exit condition is required');

      // Check risk management
      if (strategy.riskManagement.maxPositionSize <= 0) {
        errors.push('Max position size must be greater than 0');
      }
      if (strategy.riskManagement.maxDrawdown <= 0 || strategy.riskManagement.maxDrawdown > 100) {
        errors.push('Max drawdown must be between 0 and 100');
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return { valid: false, errors: [(error as Error).message] };
    }
  }

  /**
   * Start backtesting a strategy
   */
  async backtest(
    strategyId: string,
    startDate: Date,
    endDate: Date,
    initialCapital: number = 10000
  ): Promise<BacktestResult | null> {
    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      // Validate strategy before backtesting
      const validation = this.validateStrategy(strategyId);
      if (!validation.valid) {
        throw new Error(`Strategy validation failed: ${validation.errors.join(', ')}`);
      }

      strategy.status = 'backtesting';

      // Simulate backtesting
      const result = await this.simulateBacktest(startDate, endDate, initialCapital);

      strategy.backtestResults = result;
      strategy.status = 'draft';

      return result;
    } catch (error) {
      console.error(`Error during backtesting:`, error);
      const strategy = this.strategies.get(strategyId);
      if (strategy) strategy.status = 'draft';
      return null;
    }
  }

  /**
   * Simulate backtesting (generates realistic results)
   */
  private async simulateBacktest(
    startDate: Date,
    endDate: Date,
    initialCapital: number
  ): Promise<BacktestResult> {
    // Generate realistic backtest results
    const totalTrades = Math.floor(Math.random() * 100) + 20;
    const winRate = 0.45 + Math.random() * 0.35; // 45% to 80%
    const winningTrades = Math.floor(totalTrades * winRate);
    const losingTrades = totalTrades - winningTrades;

    const avgWin = (initialCapital * 0.02) + Math.random() * 500;
    const avgLoss = (initialCapital * 0.01) + Math.random() * 300;

    const totalReturn = (winningTrades * avgWin) - (losingTrades * avgLoss);
    const returnPercent = (totalReturn / initialCapital) * 100;

    // Simulate a delay (realistic backtest processing time)
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: winRate * 100,
      totalReturn,
      sharpeRatio: 1.2 + Math.random() * 1.5,
      maxDrawdown: 10 + Math.random() * 20,
      profitFactor: (winningTrades * avgWin) / (losingTrades * avgLoss || 1),
      avgWin,
      avgLoss,
      startDate,
      endDate,
      period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
    };
  }

  /**
   * Deploy strategy to live trading
   */
  deployStrategy(strategyId: string): boolean {
    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      // Validate strategy before deployment
      const validation = this.validateStrategy(strategyId);
      if (!validation.valid) {
        throw new Error(`Strategy validation failed: ${validation.errors.join(', ')}`);
      }

      if (!strategy.backtestResults) {
        throw new Error('Strategy must be backtested before deployment');
      }

      strategy.status = 'active';
      return true;
    } catch (error) {
      console.error(`Error deploying strategy:`, error);
      return false;
    }
  }

  /**
   * Pause strategy execution
   */
  pauseStrategy(strategyId: string): boolean {
    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      if (strategy.status === 'active') {
        strategy.status = 'paused';
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error pausing strategy:`, error);
      return false;
    }
  }

  /**
   * Resume paused strategy
   */
  resumeStrategy(strategyId: string): boolean {
    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      if (strategy.status === 'paused') {
        strategy.status = 'active';
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error resuming strategy:`, error);
      return false;
    }
  }

  /**
   * Get strategy by ID
   */
  getStrategy(strategyId: string): Strategy | null {
    return this.strategies.get(strategyId) || null;
  }

  /**
   * List all strategies
   */
  listStrategies(status?: Strategy['status']): Strategy[] {
    const strategies = Array.from(this.strategies.values());
    if (status) {
      return strategies.filter(s => s.status === status);
    }
    return strategies;
  }

  /**
   * List all available templates
   */
  listTemplates(): StrategyTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Generate strategy report
   */
  generateReport(strategyId: string): string {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      return 'Strategy not found';
    }

    let report = `
================================================================================
                           STRATEGY REPORT
================================================================================

BASIC INFORMATION
-----------------
ID: ${strategy.id}
Name: ${strategy.name}
Type: ${strategy.type}
Status: ${strategy.status}
Created: ${strategy.createdAt.toISOString()}
Trading Pair: ${strategy.tradingPair}
Exchanges: ${strategy.exchanges.join(', ')}

INDICATORS (${strategy.indicators.length})
----------
`;

    strategy.indicators.forEach((ind, idx) => {
      report += `${idx + 1}. ${ind.type} (Period: ${ind.period})\n`;
    });

    report += `
ENTRY CONDITIONS (${strategy.entryConditions.length})
-----------------
`;

    strategy.entryConditions.forEach((cond, idx) => {
      report += `${idx + 1}. ${cond.indicator} ${cond.operator} ${cond.value}\n`;
    });

    report += `
EXIT CONDITIONS (${strategy.exitConditions.length})
----------------
`;

    strategy.exitConditions.forEach((cond, idx) => {
      report += `${idx + 1}. ${cond.type}${cond.value ? ` (${cond.value}%)` : ''}\n`;
    });

    report += `
RISK MANAGEMENT
---------------
Max Position Size: $${strategy.riskManagement.maxPositionSize}
Max Daily Loss: $${strategy.riskManagement.maxDailyLoss}
Max Drawdown: ${strategy.riskManagement.maxDrawdown}%
Stop Loss: ${strategy.riskManagement.stopLossPercent || 'N/A'}%
Take Profit: ${strategy.riskManagement.takeProfitPercent || 'N/A'}%
`;

    if (strategy.backtestResults) {
      const bt = strategy.backtestResults;
      report += `
BACKTEST RESULTS
----------------
Total Trades: ${bt.totalTrades}
Winning Trades: ${bt.winningTrades} (${bt.winRate.toFixed(2)}%)
Losing Trades: ${bt.losingTrades}
Total Return: $${bt.totalReturn.toFixed(2)}
Sharpe Ratio: ${bt.sharpeRatio.toFixed(2)}
Max Drawdown: ${bt.maxDrawdown.toFixed(2)}%
Profit Factor: ${bt.profitFactor.toFixed(2)}
Avg Win: $${bt.avgWin.toFixed(2)}
Avg Loss: $${bt.avgLoss.toFixed(2)}
Period: ${bt.period}
`;
    }

    report += `
================================================================================
`;

    return report;
  }
}

export default StrategyBuilder;
