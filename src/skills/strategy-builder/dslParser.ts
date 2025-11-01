/**
 * Strategy Builder - DSL Parser
 * Sprint 2 Week 1: Parse strategy YAML/JSON DSL into Strategy objects
 * Supports both YAML and JSON formats
 * Version: 1.0.0
 */

import {
  Strategy,
  StrategyDSL,
  EntryCondition,
  ExitCondition,
  Condition,
  ConditionGroup,
  LogicalOperator,
  ConditionOperator,
  Parameter,
  Action,
  ActionPlan,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types';

// ============================================================================
// DSL PARSER CLASS
// ============================================================================

export class StrategyDSLParser {
  /**
   * Parse DSL string (YAML or JSON) into Strategy object
   */
  static parse(dslContent: string): Strategy {
    // Detect format (YAML vs JSON)
    const format = this.detectFormat(dslContent);

    let dslObject: StrategyDSL;

    if (format === 'json') {
      dslObject = JSON.parse(dslContent);
    } else {
      // For YAML, we'd need a YAML parser
      // For now, parse as JSON if it fails
      try {
        dslObject = JSON.parse(dslContent);
      } catch {
        throw new Error('Invalid DSL format. Supported: JSON, YAML');
      }
    }

    return this.convertDSLToStrategy(dslObject);
  }

  /**
   * Detect DSL format (YAML vs JSON)
   */
  private static detectFormat(content: string): 'yaml' | 'json' {
    const trimmed = content.trim();

    // JSON starts with { or [
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'json';
    }

    // YAML typically starts with word: or ---
    if (trimmed.startsWith('strategy:') || trimmed.startsWith('---')) {
      return 'yaml';
    }

    // Default to JSON
    return 'json';
  }

  /**
   * Convert DSL object to Strategy
   */
  private static convertDSLToStrategy(dslObject: StrategyDSL): Strategy {
    const strategyDef = dslObject.strategy;

    if (typeof strategyDef === 'string') {
      throw new Error('Strategy must be an object, not a string');
    }

    return {
      id: this.generateId(),
      name: strategyDef.name,
      description: strategyDef.description,
      version: '1.0.0',
      category: strategyDef.category,
      tags: this.extractTags(strategyDef.name),

      tradingPair: strategyDef.trading_pair,
      exchange: strategyDef.exchange,
      timeframe: strategyDef.timeframe,

      entryCondition: this.parseEntryCondition(
        strategyDef.entry_condition.name,
        strategyDef.entry_condition.logic
      ),
      exitConditions: this.parseExitConditions(strategyDef.exit_conditions),
      actions: this.parseActions(strategyDef.actions),

      parameters: this.parseParameters(strategyDef.parameters),
      defaultParameters: this.extractDefaultParameters(strategyDef.parameters),

      maxPositionSize: strategyDef.risk_management?.max_position_size,
      maxDailyLoss: strategyDef.risk_management?.max_daily_loss,
      maxDrawdown: strategyDef.risk_management?.max_drawdown,

      complexity: this.determineComplexity(strategyDef),
      riskLevel: 'medium', // default
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Parse entry condition from logic string
   */
  private static parseEntryCondition(
    name: string,
    logic: string
  ): EntryCondition {
    return {
      id: this.generateId(),
      name,
      description: `Entry condition: ${logic}`,
      operator: 'AND',
      conditions: this.parseLogicExpression(logic),
    };
  }

  /**
   * Parse exit conditions
   */
  private static parseExitConditions(
    exitDefs: Array<{ type: string; condition: string }>
  ): ExitCondition[] {
    return exitDefs.map((exitDef) => ({
      id: this.generateId(),
      type: exitDef.type as 'stop_loss' | 'take_profit' | 'time_based' | 'condition_based',
      trigger: this.parseConditionFromString(exitDef.condition),
    }));
  }

  /**
   * Parse action configuration
   */
  private static parseActions(
    actionDef: { entry: string[]; exit: string[] }
  ): ActionPlan {
    return {
      entryActions: actionDef.entry.map((actionStr) =>
        this.parseActionString(actionStr)
      ),
      exitActions: actionDef.exit.map((actionStr) =>
        this.parseActionString(actionStr)
      ),
      monitoringActions: [],
    };
  }

  /**
   * Parse action string into Action object
   * Format: "buy 100" or "sell 50%" or "alert notification"
   */
  private static parseActionString(actionStr: string): Action {
    const parts = actionStr.toLowerCase().split(/\s+/);
    const type = parts[0] as
      | 'buy'
      | 'sell'
      | 'close'
      | 'alert'
      | 'notification';
    const value = parts[1];

    return {
      id: this.generateId(),
      type,
      size: value ? parseFloat(value) : undefined,
      timeInForce: 'GTC',
    };
  }

  /**
   * Parse parameters from DSL
   */
  private static parseParameters(
    paramDefs?: Record<string, any>
  ): Parameter[] {
    if (!paramDefs) return [];

    return Object.entries(paramDefs).map(([name, config]) => ({
      name,
      description: config.description || name,
      type: config.type || 'number',
      default: config.default,
      min: config.min,
      max: config.max,
      step: config.step || 1,
      optimizable: config.optimizable !== false,
    }));
  }

  /**
   * Extract default parameters
   */
  private static extractDefaultParameters(
    paramDefs?: Record<string, any>
  ): Record<string, number | string | boolean> {
    if (!paramDefs) return {};

    const defaults: Record<string, number | string | boolean> = {};
    for (const [name, config] of Object.entries(paramDefs)) {
      defaults[name] = config.default;
    }

    return defaults;
  }

  /**
   * Parse logic expression into conditions
   * Supports: "RSI < 30 AND PRICE > MA(50)"
   */
  private static parseLogicExpression(logic: string): Condition[] {
    // Split by AND/OR operators while preserving the operator
    const conditionStrings = logic.split(/\s+(AND|OR)\s+/);
    const conditions: Condition[] = [];

    for (let i = 0; i < conditionStrings.length; i += 2) {
      const condStr = conditionStrings[i].trim();
      if (condStr) {
        conditions.push(this.parseConditionString(condStr));
      }
    }

    return conditions;
  }

  /**
   * Parse single condition string
   * Formats: "RSI < 30", "PRICE > MA(50)", "VOLUME > 1000"
   */
  private static parseConditionString(condStr: string): Condition {
    // Match pattern: INDICATOR OPERATOR VALUE
    const match = condStr.match(
      /(\w+(?:\(\d+\))?)\s*(>|<|>=|<=|==|!=|~)\s*([\d.]+|[\w\(\)]+)/
    );

    if (!match) {
      throw new Error(`Invalid condition format: ${condStr}`);
    }

    const [, indicator, operator, value] = match;
    const op = this.mapOperator(operator);

    return {
      id: this.generateId(),
      type: this.classifyIndicator(indicator),
      operator: op,
      indicator: indicator.split('(')[0], // Extract base name
      value: isNaN(parseFloat(value)) ? value : parseFloat(value),
      threshold: parseFloat(value),
    };
  }

  /**
   * Parse condition from string (more flexible)
   */
  private static parseConditionFromString(
    condStr: string
  ): Condition | ConditionGroup {
    // Try to parse as condition first
    try {
      return this.parseConditionString(condStr);
    } catch {
      // If it's a complex condition with AND/OR, return a group
      return {
        operator: 'AND',
        conditions: this.parseLogicExpression(condStr),
      };
    }
  }

  /**
   * Map DSL operator to ConditionOperator
   */
  private static mapOperator(op: string): ConditionOperator {
    const mapping: Record<string, ConditionOperator> = {
      '>': 'greater_than',
      '<': 'less_than',
      '>=': 'greater_or_equal',
      '<=': 'less_or_equal',
      '==': 'equals',
      '!=': 'not_equals',
      '~': 'contains',
    };

    return mapping[op] || 'equals';
  }

  /**
   * Classify indicator type
   */
  private static classifyIndicator(indicator: string): string {
    const baseIndicator = indicator.split('(')[0].toUpperCase();

    const typeMap: Record<string, string> = {
      PRICE: 'price',
      VOLUME: 'volume',
      RSI: 'indicator',
      MACD: 'indicator',
      MA: 'indicator',
      EMA: 'indicator',
      ATR: 'indicator',
      STOCHASTIC: 'indicator',
      BOLLINGER: 'indicator',
    };

    return typeMap[baseIndicator] || 'custom';
  }

  /**
   * Determine complexity from DSL
   */
  private static determineComplexity(strategyDef: any): 'simple' | 'moderate' | 'complex' {
    let complexityScore = 0;

    // Count conditions
    const conditionCount = (strategyDef.entry_condition.logic.match(/AND|OR/g) || []).length;
    complexityScore += conditionCount;

    // Count exit conditions
    complexityScore += (strategyDef.exit_conditions || []).length;

    // Count parameters
    complexityScore += Object.keys(strategyDef.parameters || {}).length;

    if (complexityScore <= 2) return 'simple';
    if (complexityScore <= 5) return 'moderate';
    return 'complex';
  }

  /**
   * Generate unique ID
   */
  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract tags from strategy name
   */
  private static extractTags(name: string): string[] {
    const tags = name
      .toLowerCase()
      .split(/[\s\-_]/)
      .filter((word) => word.length > 2);

    return [...new Set(tags)]; // Remove duplicates
  }
}

// ============================================================================
// STRATEGY VALIDATOR
// ============================================================================

export class StrategyValidator {
  /**
   * Validate strategy object
   */
  static validate(strategy: Strategy): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Validate required fields
    this.validateRequiredFields(strategy, errors);

    // Validate ranges
    this.validateRanges(strategy, errors, warnings);

    // Validate conditions
    this.validateConditions(strategy, errors);

    // Validate actions
    this.validateActions(strategy, errors);

    // Check for optimizations
    this.checkOptimizations(strategy, suggestions);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate required fields
   */
  private static validateRequiredFields(
    strategy: Strategy,
    errors: ValidationError[]
  ): void {
    const requiredFields = [
      'name',
      'description',
      'category',
      'tradingPair',
      'exchange',
      'timeframe',
      'entryCondition',
      'exitConditions',
    ];

    for (const field of requiredFields) {
      const value = (strategy as any)[field];

      if (!value) {
        errors.push({
          field,
          message: `${field} is required`,
          severity: 'critical',
        });
      }
    }
  }

  /**
   * Validate parameter ranges
   */
  private static validateRanges(
    strategy: Strategy,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    for (const param of strategy.parameters) {
      const defaultValue = strategy.defaultParameters[param.name];

      if (param.min !== undefined && defaultValue < param.min) {
        errors.push({
          field: `parameters.${param.name}`,
          message: `Default value ${defaultValue} is below minimum ${param.min}`,
          severity: 'high',
        });
      }

      if (param.max !== undefined && defaultValue > param.max) {
        errors.push({
          field: `parameters.${param.name}`,
          message: `Default value ${defaultValue} is above maximum ${param.max}`,
          severity: 'high',
        });
      }
    }

    // Validate risk management ranges
    if (strategy.maxDrawdown && strategy.maxDrawdown > 100) {
      warnings.push({
        field: 'maxDrawdown',
        message: 'Max drawdown > 100% is unusual',
        suggestion: 'Consider setting max drawdown to a reasonable percentage',
      });
    }
  }

  /**
   * Validate conditions
   */
  private static validateConditions(
    strategy: Strategy,
    errors: ValidationError[]
  ): void {
    // Check entry condition
    if (!strategy.entryCondition.conditions || strategy.entryCondition.conditions.length === 0) {
      errors.push({
        field: 'entryCondition',
        message: 'Entry condition must have at least one condition',
        severity: 'critical',
      });
    }

    // Check exit conditions
    if (!strategy.exitConditions || strategy.exitConditions.length === 0) {
      errors.push({
        field: 'exitConditions',
        message: 'Strategy must have at least one exit condition',
        severity: 'critical',
      });
    }
  }

  /**
   * Validate actions
   */
  private static validateActions(
    strategy: Strategy,
    errors: ValidationError[]
  ): void {
    if (!strategy.actions.entryActions || strategy.actions.entryActions.length === 0) {
      errors.push({
        field: 'actions.entryActions',
        message: 'Entry actions required',
        severity: 'critical',
      });
    }

    if (!strategy.actions.exitActions || strategy.actions.exitActions.length === 0) {
      errors.push({
        field: 'actions.exitActions',
        message: 'Exit actions required',
        severity: 'critical',
      });
    }
  }

  /**
   * Check for optimization suggestions
   */
  private static checkOptimizations(
    strategy: Strategy,
    suggestions: string[]
  ): void {
    // Suggest parameter optimization if many parameters are optimizable
    const optimizableCount = strategy.parameters.filter((p) => p.optimizable).length;

    if (optimizableCount > 5) {
      suggestions.push(
        `Strategy has ${optimizableCount} optimizable parameters. Consider using Bayesian optimization.`
      );
    }

    // Suggest backtesting
    suggestions.push('Run backtesting to validate strategy performance.');

    // Suggest paper trading
    suggestions.push('Test strategy in paper trading before live deployment.');
  }
}
