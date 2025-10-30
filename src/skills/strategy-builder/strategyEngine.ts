/**
 * Strategy Builder - Strategy Engine
 * Sprint 2 Week 2: Core execution engine for strategies
 * Evaluates conditions, executes actions, manages state
 * Version: 1.0.0
 */

import {
  Strategy,
  StrategyState,
  TradingSignal,
  StrategyStatus,
  MarketData,
  ConditionGroup,
  Condition,
} from './types';

// ============================================================================
// STRATEGY ENGINE
// ============================================================================

export class StrategyEngine {
  private strategy: Strategy;
  private state: StrategyState;
  private marketDataCache: Map<string, MarketData[]> = new Map();
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(strategy: Strategy) {
    this.strategy = strategy;
    this.state = {
      strategyId: strategy.id,
      status: 'IDLE',
      currentSignal: 'HOLD',
      lastSignalTime: null,
      position: null,
      metadata: {},
    };
  }

  /**
   * Initialize strategy engine
   */
  async initialize(): Promise<void> {
    this.state.status = 'IDLE';
    this.emit('initialized', { strategy: this.strategy.name });
  }

  /**
   * Evaluate strategy on new market data
   */
  async evaluate(marketData: MarketData): Promise<TradingSignal> {
    // Cache market data
    const pair = this.strategy.tradingPair;
    if (!this.marketDataCache.has(pair)) {
      this.marketDataCache.set(pair, []);
    }
    this.marketDataCache.get(pair)!.push(marketData);

    // Evaluate entry condition if not in position
    if (!this.state.position) {
      const entrySignal = this.evaluateCondition(
        this.strategy.entryCondition,
        marketData
      );

      if (entrySignal) {
        this.state.currentSignal = 'BUY';
        this.state.status = 'TRIGGERED';
        this.state.entryPrice = marketData.close;
        this.state.lastSignalTime = new Date();
        this.emit('entry_signal', { signal: 'BUY', price: marketData.close });
        return 'BUY';
      }
    }

    // Evaluate exit conditions if in position
    if (this.state.position) {
      for (const exitCondition of this.strategy.exitConditions) {
        const exitSignal = this.evaluateCondition(exitCondition.trigger as any, marketData);

        if (exitSignal) {
          const signal = exitCondition.type === 'stop_loss' ? 'STOP_LOSS' : 'SELL';
          this.state.currentSignal = signal;
          this.state.status = 'TRIGGERED';
          this.state.exitPrice = marketData.close;
          this.state.lastSignalTime = new Date();
          this.emit('exit_signal', { signal, price: marketData.close });
          return signal as TradingSignal;
        }
      }
    }

    // No signal
    this.state.currentSignal = 'HOLD';
    this.state.status = 'ACTIVE';
    return 'HOLD';
  }

  /**
   * Evaluate a condition or condition group
   */
  private evaluateCondition(condition: Condition | ConditionGroup, data: MarketData): boolean {
    // If it's a condition group, recursively evaluate
    if ('operator' in condition && !('type' in condition)) {
      const group = condition as ConditionGroup;
      const results = group.conditions.map((c) => this.evaluateCondition(c, data));

      switch (group.operator) {
        case 'AND':
          return results.every((r) => r);
        case 'OR':
          return results.some((r) => r);
        case 'NOT':
          return !results[0];
        case 'XOR':
          return results.reduce((a, b) => a !== b);
        default:
          return false;
      }
    }

    // Single condition
    const cond = condition as Condition;

    // Get indicator value
    const indicatorValue = this.getIndicatorValue(cond.indicator || '', data, cond.period);

    // Compare
    return this.compareValues(indicatorValue, cond.threshold || 0, cond.operator);
  }

  /**
   * Get indicator value from market data
   */
  private getIndicatorValue(
    indicator: string,
    data: MarketData,
    period?: number
  ): number {
    // Handle built-in indicators
    switch (indicator.toUpperCase()) {
      case 'PRICE':
        return data.close;
      case 'OPEN':
        return data.open;
      case 'HIGH':
        return data.high;
      case 'LOW':
        return data.low;
      case 'VOLUME':
        return data.volume;

      // For custom indicators, try to get from data.indicators
      default:
        if (data.indicators && data.indicators[indicator]) {
          return data.indicators[indicator];
        }
        // Return 0 if indicator not found
        return 0;
    }
  }

  /**
   * Compare values based on operator
   */
  private compareValues(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'equals':
        return Math.abs(value - threshold) < 0.0001;
      case 'not_equals':
        return Math.abs(value - threshold) >= 0.0001;
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'greater_or_equal':
        return value >= threshold;
      case 'less_or_equal':
        return value <= threshold;
      case 'crosses_above':
        // Would need historical data to implement
        return value > threshold;
      case 'crosses_below':
        // Would need historical data to implement
        return value < threshold;
      default:
        return false;
    }
  }

  /**
   * Get current state
   */
  getState(): StrategyState {
    return { ...this.state };
  }

  /**
   * Set strategy parameters
   */
  setParameters(params: Record<string, number | string | boolean>): void {
    // Update default parameters
    this.strategy.defaultParameters = {
      ...this.strategy.defaultParameters,
      ...params,
    };
    this.emit('parameters_updated', { parameters: params });
  }

  /**
   * Reset strategy state
   */
  reset(): void {
    this.state = {
      strategyId: this.strategy.id,
      status: 'IDLE',
      currentSignal: 'HOLD',
      lastSignalTime: null,
      position: null,
      metadata: {},
    };
    this.marketDataCache.clear();
    this.emit('reset', {});
  }

  /**
   * Register event handler
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Unregister event handler
   */
  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }

  /**
   * Get recent market data
   */
  getMarketData(limit: number = 100): MarketData[] {
    const data = this.marketDataCache.get(this.strategy.tradingPair) || [];
    return data.slice(-limit);
  }

  /**
   * Get strategy metadata
   */
  getMetadata(): Record<string, any> {
    return { ...this.state.metadata };
  }

  /**
   * Set strategy metadata
   */
  setMetadata(key: string, value: any): void {
    this.state.metadata[key] = value;
  }
}

// ============================================================================
// STRATEGY MANAGER
// ============================================================================

export class StrategyManager {
  private engines: Map<string, StrategyEngine> = new Map();
  private activeStrategies: Set<string> = new Set();

  /**
   * Register strategy
   */
  registerStrategy(strategy: Strategy): StrategyEngine {
    const engine = new StrategyEngine(strategy);
    this.engines.set(strategy.id, engine);
    return engine;
  }

  /**
   * Activate strategy
   */
  activateStrategy(strategyId: string): boolean {
    const engine = this.engines.get(strategyId);
    if (!engine) return false;

    this.activeStrategies.add(strategyId);
    return true;
  }

  /**
   * Deactivate strategy
   */
  deactivateStrategy(strategyId: string): boolean {
    return this.activeStrategies.delete(strategyId);
  }

  /**
   * Get engine by ID
   */
  getEngine(strategyId: string): StrategyEngine | undefined {
    return this.engines.get(strategyId);
  }

  /**
   * Get all active engines
   */
  getActiveEngines(): StrategyEngine[] {
    return Array.from(this.activeStrategies)
      .map((id) => this.engines.get(id))
      .filter((e) => e !== undefined) as StrategyEngine[];
  }

  /**
   * Evaluate all active strategies on new market data
   */
  async evaluateAll(marketData: MarketData): Promise<Map<string, TradingSignal>> {
    const signals = new Map<string, TradingSignal>();

    for (const strategyId of this.activeStrategies) {
      const engine = this.engines.get(strategyId);
      if (engine) {
        const signal = await engine.evaluate(marketData);
        signals.set(strategyId, signal);
      }
    }

    return signals;
  }

  /**
   * Get strategy count
   */
  getStrategyCount(): number {
    return this.engines.size;
  }

  /**
   * Get active strategy count
   */
  getActiveStrategyCount(): number {
    return this.activeStrategies.size;
  }

  /**
   * Reset all strategies
   */
  resetAll(): void {
    for (const engine of this.engines.values()) {
      engine.reset();
    }
  }

  /**
   * Get all states
   */
  getAllStates(): Map<string, StrategyState> {
    const states = new Map<string, StrategyState>();

    for (const [id, engine] of this.engines) {
      states.set(id, engine.getState());
    }

    return states;
  }
}
