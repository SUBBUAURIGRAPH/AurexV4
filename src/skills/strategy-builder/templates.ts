/**
 * Strategy Builder - Pre-built Templates (15 strategies)
 * Sprint 2 Week 2: Ready-to-use strategy templates
 * Categories: Trend, Mean Reversion, Momentum, Arbitrage, Options, Hybrid
 * Version: 1.0.0
 */

import { Strategy, StrategyTemplate } from './types';

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

const strategyTemplates: StrategyTemplate[] = [];

// ============================================================================
// 1. TREND FOLLOWING STRATEGIES (5)
// ============================================================================

/**
 * Simple Moving Average Crossover (SMA 50/200)
 */
const smaBasic: Strategy = {
  id: 'sma-basic',
  name: 'SMA Crossover 50/200',
  description: 'Classic trend following strategy using 50-period and 200-period SMAs',
  version: '1.0.0',
  category: 'trend_following',
  tags: ['trend', 'moving-average', 'beginner'],
  tradingPair: 'BTC/USD',
  exchange: 'binance',
  timeframe: '4h',
  entryCondition: {
    id: 'entry-sma-basic',
    name: 'Golden Cross',
    description: 'SMA 50 crosses above SMA 200',
    operator: 'AND',
    conditions: [
      {
        id: 'cond-1',
        type: 'indicator',
        operator: 'crosses_above',
        indicator: 'SMA',
        period: 50,
        value: 0,
        threshold: 0,
      },
    ],
  },
  exitConditions: [
    {
      id: 'exit-1',
      type: 'stop_loss',
      trigger: {
        id: 'sl-trigger',
        type: 'price',
        operator: 'less_than',
        value: 0.95,
        threshold: 0.95,
      },
      value: 5, // 5% stop loss
    },
    {
      id: 'exit-2',
      type: 'condition_based',
      trigger: {
        id: 'death-cross',
        type: 'indicator',
        operator: 'crosses_below',
        indicator: 'SMA',
        period: 50,
        value: 0,
        threshold: 0,
      },
    },
  ],
  actions: {
    entryActions: [{ id: 'buy-1', type: 'buy', size: 100, timeInForce: 'GTC' }],
    exitActions: [{ id: 'sell-1', type: 'sell', size: 100, timeInForce: 'GTC' }],
    monitoringActions: [],
  },
  parameters: [
    {
      name: 'fast_ma_period',
      description: 'Fast moving average period',
      type: 'number',
      default: 50,
      min: 10,
      max: 100,
      step: 5,
      unit: 'period',
      optimizable: true,
    },
    {
      name: 'slow_ma_period',
      description: 'Slow moving average period',
      type: 'number',
      default: 200,
      min: 100,
      max: 500,
      step: 50,
      unit: 'period',
      optimizable: true,
    },
    {
      name: 'stop_loss_percent',
      description: 'Stop loss percentage',
      type: 'number',
      default: 5,
      min: 1,
      max: 20,
      unit: '%',
      optimizable: true,
    },
  ],
  defaultParameters: {
    fast_ma_period: 50,
    slow_ma_period: 200,
    stop_loss_percent: 5,
  },
  maxPositionSize: 10,
  maxDailyLoss: 5,
  complexity: 'simple',
  riskLevel: 'low',
  minCapital: 1000,
  createdAt: new Date(),
  updatedAt: new Date(),
};

strategyTemplates.push({
  id: 'template-sma-basic',
  name: 'SMA Crossover',
  description: 'Golden/Death cross strategy for trend following',
  category: 'trend_following',
  difficulty: 'beginner',
  strategy: smaBasic,
  recommendedFor: ['trending markets', 'strong uptrends', 'forex'],
  disclaimer: 'Best used in strong trending markets. May whipsaw in sideways markets.',
});

/**
 * EMA Ribbons Trend Following
 */
const emaRibbons: Strategy = {
  ...smaBasic,
  id: 'ema-ribbons',
  name: 'EMA Ribbons Trend',
  description: 'Multi-EMA ribbon strategy for trend confirmation',
  parameters: [
    {
      name: 'ema_1',
      description: 'First EMA period',
      type: 'number',
      default: 5,
      min: 2,
      max: 20,
      optimizable: true,
    },
    {
      name: 'ema_2',
      description: 'Second EMA period',
      type: 'number',
      default: 10,
      min: 5,
      max: 30,
      optimizable: true,
    },
    {
      name: 'ema_3',
      description: 'Third EMA period',
      type: 'number',
      default: 20,
      min: 10,
      max: 50,
      optimizable: true,
    },
    {
      name: 'ema_4',
      description: 'Fourth EMA period',
      type: 'number',
      default: 50,
      min: 30,
      max: 100,
      optimizable: true,
    },
  ],
  defaultParameters: {
    ema_1: 5,
    ema_2: 10,
    ema_3: 20,
    ema_4: 50,
  },
  complexity: 'moderate',
  riskLevel: 'low',
};

strategyTemplates.push({
  id: 'template-ema-ribbons',
  name: 'EMA Ribbons',
  description: 'Multi-EMA ribbon for strong trend confirmation',
  category: 'trend_following',
  difficulty: 'intermediate',
  strategy: emaRibbons,
  recommendedFor: ['trending markets', 'cryptocurrencies'],
});

/**
 * ADX + DMI Trend Strength
 */
const adxDmi: Strategy = {
  ...smaBasic,
  id: 'adx-dmi',
  name: 'ADX + DMI Trend',
  description: 'Trend strength using ADX with directional movement',
  parameters: [
    {
      name: 'adx_period',
      description: 'ADX period',
      type: 'number',
      default: 14,
      min: 7,
      max: 30,
      optimizable: true,
    },
    {
      name: 'adx_threshold',
      description: 'ADX threshold for trend confirmation',
      type: 'number',
      default: 25,
      min: 20,
      max: 40,
      optimizable: true,
    },
  ],
  defaultParameters: {
    adx_period: 14,
    adx_threshold: 25,
  },
  complexity: 'moderate',
  riskLevel: 'medium',
};

strategyTemplates.push({
  id: 'template-adx-dmi',
  name: 'ADX+DMI',
  description: 'Trend strength indicator with directional movement',
  category: 'trend_following',
  difficulty: 'intermediate',
  strategy: adxDmi,
  recommendedFor: ['trend confirmation', 'forex', 'commodities'],
});

/**
 * MACD Trend with Signal
 */
const macdTrend: Strategy = {
  ...smaBasic,
  id: 'macd-trend',
  name: 'MACD Trend',
  description: 'MACD histogram crossing for trend following',
  parameters: [
    {
      name: 'fast_ema',
      description: 'Fast EMA for MACD',
      type: 'number',
      default: 12,
      min: 5,
      max: 20,
      optimizable: true,
    },
    {
      name: 'slow_ema',
      description: 'Slow EMA for MACD',
      type: 'number',
      default: 26,
      min: 20,
      max: 50,
      optimizable: true,
    },
  ],
  defaultParameters: {
    fast_ema: 12,
    slow_ema: 26,
  },
  complexity: 'simple',
  riskLevel: 'low',
};

strategyTemplates.push({
  id: 'template-macd-trend',
  name: 'MACD',
  description: 'Classic MACD crossover strategy',
  category: 'trend_following',
  difficulty: 'beginner',
  strategy: macdTrend,
  recommendedFor: ['all markets', 'momentum confirmation'],
});

/**
 * Ichimoku Cloud Trend
 */
const ichimoku: Strategy = {
  ...smaBasic,
  id: 'ichimoku',
  name: 'Ichimoku Cloud',
  description: 'Japanese Ichimoku indicator for trend and support/resistance',
  parameters: [
    {
      name: 'conversion_period',
      description: 'Conversion period (Tenkan-sen)',
      type: 'number',
      default: 9,
      min: 5,
      max: 20,
      optimizable: true,
    },
    {
      name: 'base_period',
      description: 'Base period (Kijun-sen)',
      type: 'number',
      default: 26,
      min: 15,
      max: 35,
      optimizable: true,
    },
  ],
  defaultParameters: {
    conversion_period: 9,
    base_period: 26,
  },
  complexity: 'complex',
  riskLevel: 'medium',
};

strategyTemplates.push({
  id: 'template-ichimoku',
  name: 'Ichimoku',
  description: 'Ichimoku cloud for trend, support/resistance, and momentum',
  category: 'trend_following',
  difficulty: 'advanced',
  strategy: ichimoku,
  recommendedFor: ['trend identification', 'Japanese markets', 'forex'],
});

// ============================================================================
// 2. MEAN REVERSION STRATEGIES (4)
// ============================================================================

/**
 * RSI Oversold Bounce
 */
const rsiOversold: Strategy = {
  ...smaBasic,
  id: 'rsi-oversold',
  name: 'RSI Oversold Bounce',
  description: 'Buy when RSI < 30 (oversold), sell on recovery',
  parameters: [
    {
      name: 'rsi_period',
      description: 'RSI period',
      type: 'number',
      default: 14,
      min: 7,
      max: 28,
      optimizable: true,
    },
    {
      name: 'oversold_level',
      description: 'Oversold threshold',
      type: 'number',
      default: 30,
      min: 10,
      max: 40,
      optimizable: true,
    },
  ],
  defaultParameters: {
    rsi_period: 14,
    oversold_level: 30,
  },
  complexity: 'simple',
  riskLevel: 'medium',
};

strategyTemplates.push({
  id: 'template-rsi-oversold',
  name: 'RSI Oversold',
  description: 'Mean reversion buying on RSI oversold signals',
  category: 'mean_reversion',
  difficulty: 'beginner',
  strategy: rsiOversold,
  recommendedFor: ['ranging markets', 'bounce trading'],
});

/**
 * Bollinger Bands Mean Reversion
 */
const bollingerMR: Strategy = {
  ...smaBasic,
  id: 'bollinger-mr',
  name: 'Bollinger Bands Mean Reversion',
  description: 'Trade mean reversion off Bollinger Band extremes',
  parameters: [
    {
      name: 'bb_period',
      description: 'Bollinger Bands period',
      type: 'number',
      default: 20,
      min: 10,
      max: 50,
      optimizable: true,
    },
    {
      name: 'bb_stddev',
      description: 'Standard deviations',
      type: 'number',
      default: 2,
      min: 1,
      max: 3,
      step: 0.5,
      optimizable: true,
    },
  ],
  defaultParameters: {
    bb_period: 20,
    bb_stddev: 2,
  },
  complexity: 'moderate',
  riskLevel: 'medium',
};

strategyTemplates.push({
  id: 'template-bollinger-mr',
  name: 'Bollinger Bands',
  description: 'Mean reversion trading off Bollinger Band extremes',
  category: 'mean_reversion',
  difficulty: 'intermediate',
  strategy: bollingerMR,
  recommendedFor: ['ranging markets', 'volatility trading'],
});

/**
 * Stochastic Mean Reversion
 */
const stochasticMR: Strategy = {
  ...smaBasic,
  id: 'stochastic-mr',
  name: 'Stochastic Mean Reversion',
  description: 'Mean reversion using Stochastic Oscillator extremes',
  parameters: [
    {
      name: 'stoch_period',
      description: 'Stochastic period',
      type: 'number',
      default: 14,
      min: 7,
      max: 28,
      optimizable: true,
    },
    {
      name: 'oversold_level',
      description: 'Oversold level',
      type: 'number',
      default: 20,
      min: 10,
      max: 30,
      optimizable: true,
    },
  ],
  defaultParameters: {
    stoch_period: 14,
    oversold_level: 20,
  },
  complexity: 'simple',
  riskLevel: 'medium',
};

strategyTemplates.push({
  id: 'template-stochastic-mr',
  name: 'Stochastic',
  description: 'Mean reversion using Stochastic Oscillator',
  category: 'mean_reversion',
  difficulty: 'beginner',
  strategy: stochasticMR,
  recommendedFor: ['ranging markets', 'swing trading'],
});

/**
 * PPO Divergence Mean Reversion
 */
const ppoMR: Strategy = {
  ...smaBasic,
  id: 'ppo-mr',
  name: 'PPO Divergence',
  description: 'Detect bearish/bullish divergences with PPO',
  parameters: [
    {
      name: 'ppo_fast',
      description: 'Fast EMA',
      type: 'number',
      default: 12,
      min: 5,
      max: 20,
      optimizable: true,
    },
    {
      name: 'ppo_slow',
      description: 'Slow EMA',
      type: 'number',
      default: 26,
      min: 20,
      max: 50,
      optimizable: true,
    },
  ],
  defaultParameters: {
    ppo_fast: 12,
    ppo_slow: 26,
  },
  complexity: 'complex',
  riskLevel: 'high',
};

strategyTemplates.push({
  id: 'template-ppo-mr',
  name: 'PPO Divergence',
  description: 'Detect price/PPO divergences for reversals',
  category: 'mean_reversion',
  difficulty: 'advanced',
  strategy: ppoMR,
  recommendedFor: ['divergence trading', 'reversal detection'],
});

// ============================================================================
// 3. MOMENTUM STRATEGIES (2)
// ============================================================================

/**
 * RSI Extreme Momentum
 */
const rsiMomentum: Strategy = {
  ...smaBasic,
  id: 'rsi-momentum',
  name: 'RSI Extreme Momentum',
  description: 'Trade extreme momentum when RSI > 70',
  parameters: [
    {
      name: 'rsi_period',
      description: 'RSI period',
      type: 'number',
      default: 14,
      min: 7,
      max: 28,
      optimizable: true,
    },
    {
      name: 'overbought_level',
      description: 'Overbought threshold',
      type: 'number',
      default: 70,
      min: 60,
      max: 80,
      optimizable: true,
    },
  ],
  defaultParameters: {
    rsi_period: 14,
    overbought_level: 70,
  },
  complexity: 'simple',
  riskLevel: 'high',
};

strategyTemplates.push({
  id: 'template-rsi-momentum',
  name: 'RSI Momentum',
  description: 'Ride momentum on RSI overbought signals',
  category: 'momentum',
  difficulty: 'beginner',
  strategy: rsiMomentum,
  recommendedFor: ['trending markets', 'momentum chasing'],
});

/**
 * Rate of Change (ROC) Momentum
 */
const rocMomentum: Strategy = {
  ...smaBasic,
  id: 'roc-momentum',
  name: 'ROC Momentum',
  description: 'Trade based on rate of change of price',
  parameters: [
    {
      name: 'roc_period',
      description: 'ROC period',
      type: 'number',
      default: 14,
      min: 5,
      max: 30,
      optimizable: true,
    },
    {
      name: 'momentum_threshold',
      description: 'Momentum threshold',
      type: 'number',
      default: 1,
      min: 0.5,
      max: 5,
      step: 0.5,
      unit: '%',
      optimizable: true,
    },
  ],
  defaultParameters: {
    roc_period: 14,
    momentum_threshold: 1,
  },
  complexity: 'moderate',
  riskLevel: 'high',
};

strategyTemplates.push({
  id: 'template-roc-momentum',
  name: 'ROC',
  description: 'Rate of change momentum strategy',
  category: 'momentum',
  difficulty: 'intermediate',
  strategy: rocMomentum,
  recommendedFor: ['momentum trading', 'breakouts'],
});

// ============================================================================
// 4. ARBITRAGE STRATEGY (1)
// ============================================================================

/**
 * Simple Arbitrage across Exchanges
 */
const crossExchangeArb: Strategy = {
  ...smaBasic,
  id: 'cross-exchange-arb',
  name: 'Cross-Exchange Arbitrage',
  description: 'Simple arbitrage on price discrepancies across exchanges',
  parameters: [
    {
      name: 'min_spread_percent',
      description: 'Minimum spread to trigger trade',
      type: 'number',
      default: 0.5,
      min: 0.1,
      max: 2,
      step: 0.1,
      unit: '%',
      optimizable: true,
    },
    {
      name: 'fee_percent',
      description: 'Total fees (both exchanges)',
      type: 'number',
      default: 0.2,
      min: 0.1,
      max: 1,
      unit: '%',
      optimizable: false,
    },
  ],
  defaultParameters: {
    min_spread_percent: 0.5,
    fee_percent: 0.2,
  },
  complexity: 'complex',
  riskLevel: 'low',
};

strategyTemplates.push({
  id: 'template-cross-exchange-arb',
  name: 'Cross-Exchange Arb',
  description: 'Exploit price discrepancies across exchanges',
  category: 'arbitrage',
  difficulty: 'advanced',
  strategy: crossExchangeArb,
  recommendedFor: ['multi-exchange trading', 'low-risk profit'],
});

// ============================================================================
// 5. OPTIONS STRATEGY (1)
// ============================================================================

/**
 * Iron Condor Options Strategy
 */
const ironCondor: Strategy = {
  ...smaBasic,
  id: 'iron-condor',
  name: 'Iron Condor',
  description: 'Limited risk, limited reward options strategy',
  parameters: [
    {
      name: 'days_to_expiration',
      description: 'Days to expiration',
      type: 'number',
      default: 30,
      min: 15,
      max: 45,
      unit: 'days',
      optimizable: true,
    },
    {
      name: 'strike_offset',
      description: 'Strike offset from ATM',
      type: 'number',
      default: 10,
      min: 5,
      max: 20,
      unit: '%',
      optimizable: true,
    },
  ],
  defaultParameters: {
    days_to_expiration: 30,
    strike_offset: 10,
  },
  complexity: 'complex',
  riskLevel: 'medium',
};

strategyTemplates.push({
  id: 'template-iron-condor',
  name: 'Iron Condor',
  description: 'Limited risk options strategy for range-bound markets',
  category: 'options',
  difficulty: 'advanced',
  strategy: ironCondor,
  recommendedFor: ['options trading', 'premium selling', 'range-bound'],
});

// ============================================================================
// 6. HYBRID STRATEGIES (2)
// ============================================================================

/**
 * Trend + Mean Reversion Hybrid
 */
const trendMRHybrid: Strategy = {
  ...smaBasic,
  id: 'trend-mr-hybrid',
  name: 'Trend + Mean Reversion',
  description: 'Confirm trend then trade mean reversion pullbacks',
  parameters: [
    {
      name: 'trend_sma_period',
      description: 'Trend confirmation SMA',
      type: 'number',
      default: 200,
      min: 100,
      max: 500,
      optimizable: true,
    },
    {
      name: 'rsi_oversold',
      description: 'RSI oversold level',
      type: 'number',
      default: 30,
      min: 10,
      max: 40,
      optimizable: true,
    },
  ],
  defaultParameters: {
    trend_sma_period: 200,
    rsi_oversold: 30,
  },
  complexity: 'moderate',
  riskLevel: 'medium',
};

strategyTemplates.push({
  id: 'template-trend-mr-hybrid',
  name: 'Trend+MR',
  description: 'Hybrid strategy combining trend and mean reversion',
  category: 'hybrid',
  difficulty: 'intermediate',
  strategy: trendMRHybrid,
  recommendedFor: ['all market types', 'balanced trading'],
});

/**
 * Breakout + Confirmation Hybrid
 */
const breakoutConfirm: Strategy = {
  ...smaBasic,
  id: 'breakout-confirm',
  name: 'Breakout with Confirmation',
  description: 'Trade breakouts with momentum confirmation',
  parameters: [
    {
      name: 'lookback_period',
      description: 'Lookback period for highs/lows',
      type: 'number',
      default: 20,
      min: 10,
      max: 50,
      unit: 'periods',
      optimizable: true,
    },
    {
      name: 'volume_threshold',
      description: 'Volume increase threshold',
      type: 'number',
      default: 1.5,
      min: 1,
      max: 3,
      step: 0.25,
      optimizable: true,
    },
  ],
  defaultParameters: {
    lookback_period: 20,
    volume_threshold: 1.5,
  },
  complexity: 'moderate',
  riskLevel: 'high',
};

strategyTemplates.push({
  id: 'template-breakout-confirm',
  name: 'Breakout',
  description: 'Breakout trading with volume and momentum confirmation',
  category: 'hybrid',
  difficulty: 'intermediate',
  strategy: breakoutConfirm,
  recommendedFor: ['breakout trading', 'momentum confirmation'],
});

// ============================================================================
// EXPORT REGISTRY
// ============================================================================

export class StrategyTemplateRegistry {
  /**
   * Get all available templates
   */
  static getAllTemplates(): StrategyTemplate[] {
    return strategyTemplates;
  }

  /**
   * Get template by ID
   */
  static getTemplateById(id: string): StrategyTemplate | undefined {
    return strategyTemplates.find((t) => t.id === id);
  }

  /**
   * Get templates by category
   */
  static getTemplatesByCategory(
    category: string
  ): StrategyTemplate[] {
    return strategyTemplates.filter((t) => t.category === category);
  }

  /**
   * Get templates by difficulty
   */
  static getTemplatesByDifficulty(difficulty: string): StrategyTemplate[] {
    return strategyTemplates.filter((t) => t.difficulty === difficulty);
  }

  /**
   * Search templates by name or description
   */
  static search(query: string): StrategyTemplate[] {
    const lowerQuery = query.toLowerCase();

    return strategyTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.recommendedFor.some((r) => r.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get template count
   */
  static getTemplateCount(): number {
    return strategyTemplates.length;
  }

  /**
   * Get statistics
   */
  static getStatistics() {
    const byCat egory = strategyTemplates.reduce(
      (acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byDifficulty = strategyTemplates.reduce(
      (acc, t) => {
        acc[t.difficulty] = (acc[t.difficulty] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      total: strategyTemplates.length,
      byCategory: byCategory,
      byDifficulty: byDifficulty,
    };
  }
}
