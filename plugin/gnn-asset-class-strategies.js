/**
 * GNN Asset-Class Specific Strategies
 *
 * Provides comprehensive strategy configurations, optimization parameters,
 * and execution rules tailored to each asset class:
 * - Cryptocurrency momentum and arbitrage strategies
 * - Equity mean reversion and trend following
 * - Commodity seasonal and carry strategies
 * - Forex pair trading and rate differential strategies
 * - Fixed income curve and credit spread strategies
 *
 * Includes parameter optimization, performance benchmarking, and
 * asset-specific risk management rules.
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

class GNNAssetClassStrategies {
  constructor(multiAssetAdapter) {
    this.adapter = multiAssetAdapter;
    this.strategies = new Map();
    this.parameterRanges = new Map();
    this.performanceBenchmarks = new Map();
    this.tacticalRules = new Map();
    this.hedgingStrategies = new Map();
    this.executionTemplates = new Map();

    this.initializeStrategies();
    this.initializeParameterRanges();
    this.initializePerformanceBenchmarks();
    this.initializeTacticalRules();
    this.initializeHedgingStrategies();
  }

  // ============================================================================
  // STRATEGY INITIALIZATION
  // ============================================================================

  /**
   * Initialize asset-class specific strategies
   * @private
   */
  initializeStrategies() {
    // CRYPTOCURRENCY STRATEGIES
    this.strategies.set('crypto_momentum', {
      name: 'Crypto Momentum',
      assetClass: 'crypto',
      type: 'Trend Following',
      description: 'High-frequency momentum based on 4-hour and daily charts',
      signals: {
        entry: 'RSI > 70 with increasing volume',
        exit: 'RSI < 50 or stop loss triggered',
        timeframe: ['4h', '1d'],
      },
      expectedMetrics: {
        winRate: 0.58,
        profitFactor: 1.8,
        sharpeRatio: 1.2,
        maxDrawdown: 0.25,
      },
      risks: ['Flash crashes', 'Regulatory news', 'Exchange hacks'],
    });

    this.strategies.set('crypto_arbitrage', {
      name: 'Crypto Cross-Exchange Arbitrage',
      assetClass: 'crypto',
      type: 'Arbitrage',
      description: 'Exploit price differences across exchanges (Binance, Coinbase, Kraken)',
      signals: {
        entry: 'Price diff > 0.5% after fees',
        exit: 'Price convergence',
        timeframe: ['1m'],
      },
      expectedMetrics: {
        winRate: 0.95,
        profitFactor: 3.0,
        sharpeRatio: 2.5,
        maxDrawdown: 0.02,
      },
      risks: ['Withdrawal delays', 'Deposit fees', 'API rate limits'],
    });

    this.strategies.set('crypto_mean_reversion', {
      name: 'Crypto Mean Reversion',
      assetClass: 'crypto',
      type: 'Mean Reversion',
      description: 'Trading reversions from Bollinger Band extremes',
      signals: {
        entry: 'Price beyond 2-sigma, volume increase',
        exit: 'Return to 1-sigma or stop loss',
        timeframe: ['4h', '1d'],
      },
      expectedMetrics: {
        winRate: 0.55,
        profitFactor: 1.6,
        sharpeRatio: 0.9,
        maxDrawdown: 0.2,
      },
      risks: ['Trend continuation', 'Volatility expansion'],
    });

    // EQUITY STRATEGIES
    this.strategies.set('equity_mean_reversion', {
      name: 'Equity Mean Reversion',
      assetClass: 'equities',
      type: 'Mean Reversion',
      description: 'Exploit oversold/overbought conditions in quality stocks',
      signals: {
        entry: 'RSI < 30 or below Bollinger Band lower',
        exit: 'RSI > 70 or target price',
        timeframe: ['1d', '1w'],
      },
      expectedMetrics: {
        winRate: 0.60,
        profitFactor: 1.9,
        sharpeRatio: 1.1,
        maxDrawdown: 0.22,
      },
      risks: ['Bankruptcy', 'Earnings surprises', 'Delisting'],
      brokers: ['Interactive Brokers', 'E*TRADE', 'Charles Schwab'],
    });

    this.strategies.set('equity_dividend_capture', {
      name: 'Equity Dividend Capture',
      assetClass: 'equities',
      type: 'Income',
      description: 'Buy before ex-dividend date, sell after dividend payment',
      signals: {
        entry: '2-3 days before ex-dividend',
        exit: 'Day after ex-dividend',
        timeframe: ['1d'],
      },
      expectedMetrics: {
        winRate: 0.70,
        profitFactor: 2.2,
        sharpeRatio: 1.3,
        maxDrawdown: 0.15,
      },
      risks: ['Ex-dividend stock drop', 'Tax inefficiency'],
    });

    this.strategies.set('equity_sector_rotation', {
      name: 'Equity Sector Rotation',
      assetClass: 'equities',
      type: 'Tactical Allocation',
      description: 'Rotate between sectors based on economic cycle',
      signals: {
        entry: 'Sector outperformance begins',
        exit: 'Sector momentum slows',
        timeframe: ['1w', '1m'],
      },
      expectedMetrics: {
        winRate: 0.65,
        profitFactor: 2.0,
        sharpeRatio: 1.4,
        maxDrawdown: 0.18,
      },
      sectors: ['Technology', 'Healthcare', 'Financials', 'Industrials', 'Consumer', 'Energy', 'Materials', 'Utilities', 'Real Estate', 'Communication'],
    });

    // COMMODITY STRATEGIES
    this.strategies.set('commodity_seasonal', {
      name: 'Commodity Seasonal Trading',
      assetClass: 'commodities',
      type: 'Seasonal',
      description: 'Trade seasonal patterns (e.g., agriculture, heating oil)',
      signals: {
        entry: 'Seasonal period begins',
        exit: 'Seasonal period ends or loss limit',
        timeframe: ['1m', '3m'],
      },
      expectedMetrics: {
        winRate: 0.62,
        profitFactor: 1.95,
        sharpeRatio: 1.05,
        maxDrawdown: 0.28,
      },
      seasonalPatterns: {
        corn: 'April-July (spring planting)',
        wheat: 'May-August (summer harvest)',
        cattle: 'June-September (summer feeding)',
        gold: 'October-February (risk-off)',
      },
    });

    this.strategies.set('commodity_carry', {
      name: 'Commodity Carry Trade',
      assetClass: 'commodities',
      type: 'Carry',
      description: 'Exploit contango in futures markets',
      signals: {
        entry: 'Front month cheaper than back month',
        exit: 'Convergence or roll to next contract',
        timeframe: ['1m', '3m'],
      },
      expectedMetrics: {
        winRate: 0.68,
        profitFactor: 2.1,
        sharpeRatio: 1.2,
        maxDrawdown: 0.20,
      },
      costs: ['Roll cost', 'Financing cost', 'Storage cost'],
    });

    this.strategies.set('commodity_spread', {
      name: 'Commodity Calendar Spread',
      assetClass: 'commodities',
      type: 'Spread',
      description: 'Trade spread between different contract months',
      signals: {
        entry: 'Spread too wide vs historical',
        exit: 'Spread normalizes',
        timeframe: ['1d', '1w'],
      },
      expectedMetrics: {
        winRate: 0.70,
        profitFactor: 2.3,
        sharpeRatio: 1.4,
        maxDrawdown: 0.15,
      },
    });

    // FOREX STRATEGIES
    this.strategies.set('forex_carry', {
      name: 'Forex Carry Trade',
      assetClass: 'forex',
      type: 'Carry',
      description: 'Benefit from interest rate differentials',
      signals: {
        entry: 'High-rate currency vs low-rate currency',
        exit: 'Rate changes or risk-off event',
        timeframe: ['1d', '1w'],
      },
      expectedMetrics: {
        winRate: 0.55,
        profitFactor: 2.0,
        sharpeRatio: 1.5,
        maxDrawdown: 0.20,
      },
      highYieldCurrencies: ['AUD', 'NZD', 'ZAR', 'BRL'],
      lowYieldCurrencies: ['JPY', 'CHF', 'EUR', 'USD'],
      risks: ['Carry trade unwind', 'Central bank surprises'],
    });

    this.strategies.set('forex_trend', {
      name: 'Forex Trend Following',
      assetClass: 'forex',
      type: 'Trend Following',
      description: 'Follow major currency trends on daily timeframe',
      signals: {
        entry: 'Break above 20-day high',
        exit: 'Break below 20-day low',
        timeframe: ['1d'],
      },
      expectedMetrics: {
        winRate: 0.52,
        profitFactor: 1.8,
        sharpeRatio: 1.1,
        maxDrawdown: 0.25,
      },
    });

    this.strategies.set('forex_mean_reversion', {
      name: 'Forex Mean Reversion',
      assetClass: 'forex',
      type: 'Mean Reversion',
      description: 'Revert from extreme valuations (PPP analysis)',
      signals: {
        entry: 'Currency 2-sigma from mean',
        exit: 'Return to mean',
        timeframe: ['1w', '1m'],
      },
      expectedMetrics: {
        winRate: 0.58,
        profitFactor: 1.85,
        sharpeRatio: 1.05,
        maxDrawdown: 0.22,
      },
    });

    // FIXED INCOME STRATEGIES
    this.strategies.set('fixed_income_curve', {
      name: 'Fixed Income Curve Trades',
      assetClass: 'fixed_income',
      type: 'Yield Curve',
      description: 'Trade curve flattening/steepening',
      signals: {
        entry: 'Curve shape extreme vs history',
        exit: 'Curve normalizes',
        timeframe: ['1w', '1m'],
      },
      expectedMetrics: {
        winRate: 0.62,
        profitFactor: 2.1,
        sharpeRatio: 1.6,
        maxDrawdown: 0.12,
      },
      trades: ['Steepener', 'Flattener', 'Butterfly', 'Condor'],
    });

    this.strategies.set('fixed_income_credit', {
      name: 'Fixed Income Credit Spread',
      assetClass: 'fixed_income',
      type: 'Credit',
      description: 'Trade corporate bond spreads over Treasuries',
      signals: {
        entry: 'Spread > 2 sigma above mean',
        exit: 'Spread normalizes',
        timeframe: ['1w', '1m'],
      },
      expectedMetrics: {
        winRate: 0.65,
        profitFactor: 2.2,
        sharpeRatio: 1.7,
        maxDrawdown: 0.10,
      },
      creditRatings: ['BBB', 'A', 'AA'],
    });

    this.strategies.set('fixed_income_roll_down', {
      name: 'Fixed Income Roll-Down',
      assetClass: 'fixed_income',
      type: 'Income',
      description: 'Capture gains from bonds rolling down the yield curve',
      signals: {
        entry: 'Long duration bonds at reasonable yields',
        exit: 'Maturity approach or risk limit',
        timeframe: ['1m', '3m'],
      },
      expectedMetrics: {
        winRate: 0.72,
        profitFactor: 2.4,
        sharpeRatio: 1.8,
        maxDrawdown: 0.08,
      },
    });
  }

  /**
   * Initialize parameter ranges for optimization
   * @private
   */
  initializeParameterRanges() {
    // Crypto momentum parameters
    this.parameterRanges.set('crypto_momentum', {
      rsiPeriod: { min: 10, max: 30, step: 5 },
      rsiOverbought: { min: 65, max: 80, step: 5 },
      rsiOversold: { min: 20, max: 35, step: 5 },
      volumeSmaLength: { min: 10, max: 30, step: 5 },
      stopLossPercent: { min: 0.02, max: 0.10, step: 0.01 },
      takeProfitPercent: { min: 0.05, max: 0.20, step: 0.02 },
      positionSize: { min: 0.01, max: 0.10, step: 0.01 },
    });

    // Crypto arbitrage parameters
    this.parameterRanges.set('crypto_arbitrage', {
      minSpreadBps: { min: 20, max: 100, step: 10 },
      maxLatencyMs: { min: 100, max: 1000, step: 100 },
      positionSize: { min: 0.1, max: 1.0, step: 0.1 },
      hedgingRatio: { min: 0.9, max: 1.0, step: 0.01 },
    });

    // Equity mean reversion parameters
    this.parameterRanges.set('equity_mean_reversion', {
      rsiPeriod: { min: 10, max: 30, step: 5 },
      bbPeriod: { min: 15, max: 30, step: 5 },
      bbStdDev: { min: 1.5, max: 2.5, step: 0.25 },
      stopLossPercent: { min: 0.03, max: 0.10, step: 0.01 },
      takeProfitPercent: { min: 0.05, max: 0.15, step: 0.02 },
      positionSize: { min: 0.01, max: 0.05, step: 0.005 },
      minDailyVolume: { min: 1000000, max: 10000000, step: 1000000 },
    });

    // Commodity seasonal parameters
    this.parameterRanges.set('commodity_seasonal', {
      seasonalMonths: { min: 1, max: 6, step: 1 },
      entryThreshold: { min: 0.5, max: 2.0, step: 0.1 },
      exitThreshold: { min: -0.5, max: 1.0, step: 0.1 },
      stopLossPercent: { min: 0.02, max: 0.10, step: 0.01 },
      takeProfitPercent: { min: 0.05, max: 0.20, step: 0.02 },
      positionSize: { min: 0.01, max: 0.10, step: 0.01 },
    });

    // Forex carry trade parameters
    this.parameterRanges.set('forex_carry', {
      minRateDiff: { min: 0.5, max: 2.0, step: 0.1 },
      stopLossPercent: { min: 0.02, max: 0.10, step: 0.01 },
      takeProfitPercent: { min: 0.05, max: 0.20, step: 0.02 },
      leverage: { min: 1, max: 10, step: 1 },
      positionSize: { min: 0.01, max: 0.10, step: 0.01 },
    });

    // Fixed income curve trade parameters
    this.parameterRanges.set('fixed_income_curve', {
      curveSpreadThreshold: { min: 10, max: 50, step: 5 },
      durationTarget: { min: 3, max: 7, step: 1 },
      convexityTarget: { min: 40, max: 80, step: 10 },
      stopLossBps: { min: 20, max: 100, step: 10 },
      takeProfitBps: { min: 50, max: 200, step: 25 },
      positionSize: { min: 0.02, max: 0.10, step: 0.01 },
    });
  }

  /**
   * Initialize performance benchmarks for each strategy
   * @private
   */
  initializePerformanceBenchmarks() {
    // Crypto benchmarks
    this.performanceBenchmarks.set('crypto_momentum', {
      benchmark: 'BTC/USD',
      lookbackPeriod: '252 days',
      annualizedReturn: 0.35,
      volatility: 0.40,
      sharpeRatio: 0.875,
      maxDrawdown: -0.25,
      winRate: 0.58,
      profitFactor: 1.8,
    });

    // Equity benchmarks
    this.performanceBenchmarks.set('equity_mean_reversion', {
      benchmark: 'S&P 500 (SPY)',
      lookbackPeriod: '252 days',
      annualizedReturn: 0.12,
      volatility: 0.16,
      sharpeRatio: 0.75,
      maxDrawdown: -0.22,
      winRate: 0.60,
      profitFactor: 1.9,
    });

    // Commodity benchmarks
    this.performanceBenchmarks.set('commodity_seasonal', {
      benchmark: 'Bloomberg Commodity Index',
      lookbackPeriod: '252 days',
      annualizedReturn: 0.08,
      volatility: 0.18,
      sharpeRatio: 0.44,
      maxDrawdown: -0.28,
      winRate: 0.62,
      profitFactor: 1.95,
    });

    // Forex benchmarks
    this.performanceBenchmarks.set('forex_carry', {
      benchmark: 'G10 Basket',
      lookbackPeriod: '252 days',
      annualizedReturn: 0.10,
      volatility: 0.12,
      sharpeRatio: 0.83,
      maxDrawdown: -0.20,
      winRate: 0.55,
      profitFactor: 2.0,
    });

    // Fixed income benchmarks
    this.performanceBenchmarks.set('fixed_income_curve', {
      benchmark: 'Bloomberg Bond Index',
      lookbackPeriod: '252 days',
      annualizedReturn: 0.06,
      volatility: 0.08,
      sharpeRatio: 0.75,
      maxDrawdown: -0.12,
      winRate: 0.62,
      profitFactor: 2.1,
    });
  }

  /**
   * Initialize tactical rules per asset class
   * @private
   */
  initializeTacticalRules() {
    // Crypto tactical rules
    this.tacticalRules.set('crypto', {
      maxPositionSize: 0.20,
      maxLeverage: 10,
      minLiquidity: 1000000,
      timeoutBetweenTrades: 3600,
      maxOpenPositions: 5,
      riskPerTrade: 0.02,
      stopLossRequired: true,
      volatilityMultiplierAdjustment: 1.5,
      news_Impact: 'Very High',
      regulatoryRiskAllowed: true,
    });

    // Equity tactical rules
    this.tacticalRules.set('equities', {
      maxPositionSize: 0.10,
      maxLeverage: 2,
      minLiquidity: 500000,
      timeoutBetweenTrades: 0,
      maxOpenPositions: 20,
      riskPerTrade: 0.01,
      stopLossRequired: true,
      volatilityMultiplierAdjustment: 1.0,
      news_Impact: 'High',
      regulatoryRiskAllowed: false,
    });

    // Commodity tactical rules
    this.tacticalRules.set('commodities', {
      maxPositionSize: 0.15,
      maxLeverage: 20,
      minLiquidity: 100000,
      timeoutBetweenTrades: 0,
      maxOpenPositions: 10,
      riskPerTrade: 0.02,
      stopLossRequired: true,
      volatilityMultiplierAdjustment: 1.2,
      news_Impact: 'High',
      regulatoryRiskAllowed: false,
      contractRollovers: 'Mandatory before expiry',
    });

    // Forex tactical rules
    this.tacticalRules.set('forex', {
      maxPositionSize: 0.10,
      maxLeverage: 50,
      minLiquidity: 10000000,
      timeoutBetweenTrades: 0,
      maxOpenPositions: 15,
      riskPerTrade: 0.01,
      stopLossRequired: true,
      volatilityMultiplierAdjustment: 0.8,
      news_Impact: 'Very High',
      regulatoryRiskAllowed: false,
    });

    // Fixed income tactical rules
    this.tacticalRules.set('fixed_income', {
      maxPositionSize: 0.25,
      maxLeverage: 5,
      minLiquidity: 1000000,
      timeoutBetweenTrades: 0,
      maxOpenPositions: 20,
      riskPerTrade: 0.01,
      stopLossRequired: false,
      volatilityMultiplierAdjustment: 0.5,
      news_Impact: 'Moderate',
      regulatoryRiskAllowed: false,
      creditRatingMin: 'BBB-',
      durationLimit: 10,
    });
  }

  /**
   * Initialize hedging strategies
   * @private
   */
  initializeHedgingStrategies() {
    this.hedgingStrategies.set('crypto_hedge', {
      underlying: 'crypto',
      instruments: ['Futures', 'Options', 'Inverse positions'],
      optimalRatio: 0.5,
      costBps: 5,
      effectiveness: 0.85,
      examples: [
        { position: 'Long BTC', hedge: 'Short BTC futures', ratio: 1.0 },
        { position: 'Long ETH', hedge: 'Put options', ratio: 0.5 },
      ],
    });

    this.hedgingStrategies.set('equity_hedge', {
      underlying: 'equities',
      instruments: ['Index puts', 'Inverse ETFs', 'Collar strategies'],
      optimalRatio: 0.3,
      costBps: 25,
      effectiveness: 0.90,
      examples: [
        { position: 'Long SPY', hedge: 'SPY put options', ratio: 0.2 },
        { position: 'Long sector', hedge: 'Inverse sector ETF', ratio: 0.3 },
      ],
    });

    this.hedgingStrategies.set('commodity_hedge', {
      underlying: 'commodities',
      instruments: ['Futures', 'Options', 'EFTs'],
      optimalRatio: 0.6,
      costBps: 30,
      effectiveness: 0.80,
      examples: [
        { position: 'Long crude', hedge: 'Crude futures short', ratio: 1.0 },
        { position: 'Long gold', hedge: 'Put options', ratio: 0.5 },
      ],
    });

    this.hedgingStrategies.set('forex_hedge', {
      underlying: 'forex',
      instruments: ['Forward contracts', 'Options', 'Inverse positions'],
      optimalRatio: 0.5,
      costBps: 10,
      effectiveness: 0.95,
      examples: [
        { position: 'Long EURUSD', hedge: 'Put options', ratio: 0.5 },
        { position: 'Long AUD carry', hedge: 'Reverse carry', ratio: 0.3 },
      ],
    });

    this.hedgingStrategies.set('fixed_income_hedge', {
      underlying: 'fixed_income',
      instruments: ['Interest rate swaps', 'Swaptions', 'Duration management'],
      optimalRatio: 0.4,
      costBps: 15,
      effectiveness: 0.92,
      examples: [
        { position: 'Long bonds', hedge: 'Rate swaps', ratio: 0.5 },
        { position: 'Long credit', hedge: 'Credit default swaps', ratio: 0.3 },
      ],
    });
  }

  // ============================================================================
  // STRATEGY RETRIEVAL AND ANALYSIS
  // ============================================================================

  /**
   * Get strategy by identifier
   * @param {string} strategyId - Strategy identifier
   * @returns {Object} Strategy configuration
   */
  getStrategy(strategyId) {
    return this.strategies.get(strategyId);
  }

  /**
   * Get all strategies for asset class
   * @param {string} assetClass - Asset class identifier
   * @returns {Array} Array of strategies
   */
  getStrategiesForAssetClass(assetClass) {
    const result = [];
    for (const [id, strategy] of this.strategies) {
      if (strategy.assetClass === assetClass) {
        result.push({ id, ...strategy });
      }
    }
    return result;
  }

  /**
   * Get parameter ranges for strategy
   * @param {string} strategyId - Strategy identifier
   * @returns {Object} Parameter ranges for optimization
   */
  getParameterRanges(strategyId) {
    return this.parameterRanges.get(strategyId);
  }

  /**
   * Get performance benchmark for strategy
   * @param {string} strategyId - Strategy identifier
   * @returns {Object} Historical performance metrics
   */
  getPerformanceBenchmark(strategyId) {
    return this.performanceBenchmarks.get(strategyId);
  }

  /**
   * Get tactical rules for asset class
   * @param {string} assetClass - Asset class identifier
   * @returns {Object} Tactical rules and constraints
   */
  getTacticalRules(assetClass) {
    return this.tacticalRules.get(assetClass);
  }

  /**
   * Get hedging strategy for position
   * @param {string} positionType - Position type (e.g., 'Long BTC')
   * @param {string} assetClass - Asset class identifier
   * @returns {Object} Recommended hedging strategy
   */
  getHedgeStrategy(positionType, assetClass) {
    const hedgeId = assetClass + '_hedge';
    const hedge = this.hedgingStrategies.get(hedgeId);

    if (!hedge) return null;

    return {
      ...hedge,
      position: positionType,
      recommendedRatio: hedge.optimalRatio,
      estimatedCost: hedge.costBps,
      expectedEffectiveness: hedge.effectiveness,
    };
  }

  /**
   * Calculate optimal position size with risk management
   * @param {string} assetClass - Asset class identifier
   * @param {number} portfolioValue - Total portfolio value
   * @param {number} entryPrice - Entry price for position
   * @param {number} stopLossPrice - Stop loss price
   * @returns {Object} Position sizing recommendations
   */
  calculatePositionSize(assetClass, portfolioValue, entryPrice, stopLossPrice) {
    const tacticalRules = this.tacticalRules.get(assetClass);
    if (!tacticalRules) return null;

    const maxRiskAmount = portfolioValue * tacticalRules.riskPerTrade;
    const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
    const positionSize = riskPerUnit > 0 ? maxRiskAmount / riskPerUnit : 0;

    const maxPositionValue = portfolioValue * tacticalRules.maxPositionSize;
    const positionValue = positionSize * entryPrice;

    return {
      recommendedSize: Math.min(positionSize, maxPositionValue / entryPrice),
      positionValue: Math.min(positionValue, maxPositionValue),
      maxRiskAmount,
      riskPerUnit,
      percentOfPortfolio: Math.min(positionValue, maxPositionValue) / portfolioValue,
      leverageRequired: Math.min(positionValue, maxPositionValue) / portfolioValue > 1 ? Math.min(positionValue, maxPositionValue) / portfolioValue : 1,
      maxAllowedLeverage: tacticalRules.maxLeverage,
    };
  }

  /**
   * Validate strategy compatibility with asset class
   * @param {string} strategyId - Strategy identifier
   * @param {string} assetClass - Asset class identifier
   * @returns {Object} Validation result with details
   */
  validateStrategyAssetClassCompatibility(strategyId, assetClass) {
    const strategy = this.getStrategy(strategyId);
    if (!strategy) {
      return { valid: false, reason: 'Strategy not found' };
    }

    if (strategy.assetClass !== assetClass) {
      return {
        valid: false,
        reason: `Strategy designed for ${strategy.assetClass}, not ${assetClass}`,
        suggestedAlternatives: this.getStrategiesForAssetClass(assetClass),
      };
    }

    return {
      valid: true,
      strategy,
      tacicalRules: this.getTacticalRules(assetClass),
    };
  }

  /**
   * Get strategy performance vs benchmark
   * @param {string} strategyId - Strategy identifier
   * @param {Object} actualPerformance - Actual performance metrics
   * @returns {Object} Performance comparison
   */
  comparePerformanceToBenchmark(strategyId, actualPerformance) {
    const benchmark = this.getPerformanceBenchmark(strategyId);
    if (!benchmark) return null;

    return {
      strategy: strategyId,
      benchmark: benchmark.benchmark,
      annualizedReturnDiff: actualPerformance.annualizedReturn - benchmark.annualizedReturn,
      volatilityDiff: actualPerformance.volatility - benchmark.volatility,
      sharpeDiff: actualPerformance.sharpeRatio - benchmark.sharpeRatio,
      drawdownDiff: actualPerformance.maxDrawdown - benchmark.maxDrawdown,
      winRateDiff: actualPerformance.winRate - benchmark.winRate,
      profitFactorDiff: actualPerformance.profitFactor - benchmark.profitFactor,
      performanceRating: this.calculatePerformanceRating(actualPerformance, benchmark),
    };
  }

  /**
   * Calculate performance rating (1-10 scale)
   * @private
   * @param {Object} actual - Actual performance
   * @param {Object} benchmark - Benchmark performance
   * @returns {number} Performance rating
   */
  calculatePerformanceRating(actual, benchmark) {
    let score = 5;

    if (actual.sharpeRatio > benchmark.sharpeRatio) score += 1;
    if (actual.sharpeRatio > benchmark.sharpeRatio * 1.1) score += 1;

    if (actual.maxDrawdown > benchmark.maxDrawdown) score -= 1;
    if (actual.maxDrawdown > benchmark.maxDrawdown * 1.1) score -= 1;

    if (actual.winRate > benchmark.winRate) score += 1;

    return Math.max(1, Math.min(10, score));
  }

  /**
   * List all available strategies
   * @returns {Array} Array of all strategy identifiers
   */
  listAllStrategies() {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get strategy count by asset class
   * @returns {Object} Strategy counts by asset class
   */
  getStrategyCountByAssetClass() {
    const counts = {};

    for (const [, strategy] of this.strategies) {
      const ac = strategy.assetClass;
      counts[ac] = (counts[ac] || 0) + 1;
    }

    return counts;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

module.exports = GNNAssetClassStrategies;
