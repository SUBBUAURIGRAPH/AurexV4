/**
 * StrategyBuilder - Domain Specific Language for Trading Strategy Definition
 * v2.1.0 - Production Ready
 *
 * Enables non-programmers to create sophisticated trading strategies via:
 * - YAML/JSON DSL
 * - 15+ pre-built templates
 * - No-code condition builder
 * - Parameter customization
 * - Backtesting integration
 * - Parameter optimization
 */

import { EventEmitter } from 'events';
import { StrategyDSLParser } from './StrategyDSLParser';
import { ConditionEngine } from './ConditionEngine';
import { ActionExecutor } from './ActionExecutor';
import { TemplateLibrary } from './TemplateLibrary';
import { ParameterOptimizer } from './ParameterOptimizer';
import { BacktesterIntegration } from './BacktesterIntegration';

export interface StrategyDefinition {
  name: string;
  description?: string;
  template?: string;
  parameters: Record<string, any>;
  conditions: ConditionRule[];
  actions: ActionRule[];
  riskManagement?: RiskManagementConfig;
}

export interface ConditionRule {
  type: string;
  params: Record<string, any>;
  operator?: 'and' | 'or' | 'not';
}

export interface ActionRule {
  trigger: 'entry' | 'exit' | 'stop-loss' | 'take-profit';
  type: string;
  params: Record<string, any>;
}

export interface RiskManagementConfig {
  maxPositionSize?: number;
  maxDailyLoss?: number;
  maxDrawdown?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
}

export interface BacktestResult {
  strategy: string;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  tradeCount: number;
  startDate: Date;
  endDate: Date;
}

export interface OptimizationResult {
  strategy: string;
  bestParameters: Record<string, any>;
  bestMetrics: BacktestResult;
  evaluations: number;
  duration: number;
}

export class StrategyBuilder extends EventEmitter {
  private parser: StrategyDSLParser;
  private conditionEngine: ConditionEngine;
  private actionExecutor: ActionExecutor;
  private templateLibrary: TemplateLibrary;
  private optimizer: ParameterOptimizer;
  private backtester: BacktesterIntegration;
  private strategies: Map<string, StrategyDefinition> = new Map();

  constructor() {
    super();
    this.parser = new StrategyDSLParser();
    this.conditionEngine = new ConditionEngine();
    this.actionExecutor = new ActionExecutor();
    this.templateLibrary = new TemplateLibrary();
    this.optimizer = new ParameterOptimizer();
    this.backtester = new BacktesterIntegration();
  }

  /**
   * Create a strategy from DSL definition
   * @param definition Strategy definition in YAML or JSON format
   * @returns Parsed and validated strategy
   */
  async createStrategyFromDSL(definition: StrategyDefinition): Promise<{
    success: boolean;
    strategyId?: string;
    errors?: string[];
  }> {
    try {
      // Validate definition
      const validationErrors = this.validateStrategy(definition);
      if (validationErrors.length > 0) {
        return { success: false, errors: validationErrors };
      }

      // Parse and validate conditions
      const conditionResult = this.conditionEngine.validateConditions(definition.conditions);
      if (!conditionResult.valid) {
        return { success: false, errors: conditionResult.errors };
      }

      // Parse and validate actions
      const actionResult = this.actionExecutor.validateActions(definition.actions);
      if (!actionResult.valid) {
        return { success: false, errors: actionResult.errors };
      }

      // Store strategy
      const strategyId = `strategy-${Date.now()}`;
      this.strategies.set(strategyId, definition);

      this.emit('strategy:created', {
        strategyId,
        name: definition.name,
        timestamp: new Date(),
      });

      return { success: true, strategyId };
    } catch (error) {
      return { success: false, errors: [String(error)] };
    }
  }

  /**
   * Create strategy from template
   * @param templateName Name of the template
   * @param parameters Custom parameters
   * @returns Created strategy ID
   */
  async createStrategyFromTemplate(
    templateName: string,
    parameters: Record<string, any>
  ): Promise<{ success: boolean; strategyId?: string; error?: string }> {
    try {
      const template = this.templateLibrary.getTemplate(templateName);
      if (!template) {
        return { success: false, error: `Template not found: ${templateName}` };
      }

      const strategy: StrategyDefinition = {
        name: template.name,
        description: template.description,
        template: templateName,
        parameters: { ...template.defaultParameters, ...parameters },
        conditions: template.conditions,
        actions: template.actions,
        riskManagement: template.riskManagement,
      };

      const result = await this.createStrategyFromDSL(strategy);
      return result;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get all available templates
   * @returns Array of template metadata
   */
  getAvailableTemplates(): Array<{ name: string; description: string; category: string }> {
    return this.templateLibrary.listTemplates();
  }

  /**
   * Backtest a strategy
   * @param strategyId Strategy ID to test
   * @param options Backtest options (date range, initial capital)
   * @returns Backtest results
   */
  async backtestStrategy(
    strategyId: string,
    options: {
      startDate: Date;
      endDate: Date;
      initialCapital: number;
      symbols: string[];
    }
  ): Promise<{ success: boolean; results?: BacktestResult; error?: string }> {
    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        return { success: false, error: 'Strategy not found' };
      }

      const results = await this.backtester.runBacktest(strategy, options);

      this.emit('backtest:completed', {
        strategyId,
        results,
        timestamp: new Date(),
      });

      return { success: true, results };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Optimize strategy parameters
   * @param strategyId Strategy ID to optimize
   * @param options Optimization options
   * @returns Best parameters and metrics
   */
  async optimizeStrategy(
    strategyId: string,
    options: {
      parameterRanges: Record<string, { min: number; max: number; step: number }>;
      algorithm: 'grid' | 'genetic' | 'bayesian';
      backtestOptions: {
        startDate: Date;
        endDate: Date;
        initialCapital: number;
        symbols: string[];
      };
    }
  ): Promise<{ success: boolean; results?: OptimizationResult; error?: string }> {
    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        return { success: false, error: 'Strategy not found' };
      }

      const startTime = Date.now();
      const results = await this.optimizer.optimize(
        strategy,
        options.parameterRanges,
        options.algorithm,
        options.backtestOptions
      );

      const duration = Date.now() - startTime;

      this.emit('optimization:completed', {
        strategyId,
        results: { ...results, duration },
        timestamp: new Date(),
      });

      return { success: true, results: { ...results, duration } };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get strategy details
   * @param strategyId Strategy ID
   * @returns Strategy definition
   */
  getStrategy(strategyId: string): StrategyDefinition | null {
    return this.strategies.get(strategyId) || null;
  }

  /**
   * List all strategies
   * @returns Array of strategy metadata
   */
  listStrategies(): Array<{
    id: string;
    name: string;
    template?: string;
    conditionCount: number;
    actionCount: number;
  }> {
    const list = [];
    for (const [id, strategy] of this.strategies.entries()) {
      list.push({
        id,
        name: strategy.name,
        template: strategy.template,
        conditionCount: strategy.conditions.length,
        actionCount: strategy.actions.length,
      });
    }
    return list;
  }

  /**
   * Update strategy parameters
   * @param strategyId Strategy ID
   * @param newParameters Updated parameters
   * @returns Success status
   */
  updateStrategyParameters(
    strategyId: string,
    newParameters: Record<string, any>
  ): { success: boolean; error?: string } {
    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        return { success: false, error: 'Strategy not found' };
      }

      strategy.parameters = { ...strategy.parameters, ...newParameters };

      this.emit('strategy:updated', {
        strategyId,
        timestamp: new Date(),
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Delete a strategy
   * @param strategyId Strategy ID
   * @returns Success status
   */
  deleteStrategy(strategyId: string): { success: boolean; error?: string } {
    try {
      if (this.strategies.delete(strategyId)) {
        this.emit('strategy:deleted', {
          strategyId,
          timestamp: new Date(),
        });
        return { success: true };
      }
      return { success: false, error: 'Strategy not found' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Validate strategy definition
   */
  private validateStrategy(definition: StrategyDefinition): string[] {
    const errors = [];

    if (!definition.name || typeof definition.name !== 'string') {
      errors.push('Strategy name is required and must be a string');
    }

    if (!Array.isArray(definition.conditions) || definition.conditions.length === 0) {
      errors.push('At least one condition is required');
    }

    if (!Array.isArray(definition.actions) || definition.actions.length === 0) {
      errors.push('At least one action is required');
    }

    if (!definition.parameters || typeof definition.parameters !== 'object') {
      errors.push('Parameters object is required');
    }

    return errors;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      // Clean up resources
      this.strategies.clear();
      this.removeAllListeners();
      console.log('StrategyBuilder shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}

export default StrategyBuilder;
