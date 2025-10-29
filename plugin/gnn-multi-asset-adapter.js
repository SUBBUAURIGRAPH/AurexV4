/**
 * GNN Multi-Asset Class Adapter
 *
 * Provides unified abstraction layer for trading across multiple asset classes:
 * - Cryptocurrencies (24/7, high volatility, orderbook data)
 * - Equities (market hours, exchange-regulated, tick data)
 * - Commodities (seasonal, futures-based, OHLCV data)
 * - Forex (24/5, high liquidity, bid-ask spreads)
 * - Fixed Income (low volatility, credit spreads, bond yields)
 *
 * Standardizes data formats, trading rules, risk parameters, and execution
 * across all asset classes with unified API.
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

class GNNMultiAssetAdapter {
  constructor(config = {}) {
    this.config = config;
    this.adapters = new Map();
    this.assetClasses = new Map();
    this.marketCalendars = new Map();
    this.liquidityProfiles = new Map();
    this.constraints = new Map();
    this.dataFormatters = new Map();
    this.riskParameters = new Map();

    this.initializeAssetClasses();
    this.initializeMarketCalendars();
    this.initializeLiquidityProfiles();
    this.initializeConstraints();
    this.initializeRiskParameters();
  }

  // ============================================================================
  // INITIALIZATION METHODS
  // ============================================================================

  /**
   * Initialize supported asset classes with their properties
   * @private
   */
  initializeAssetClasses() {
    // Cryptocurrencies - 24/7 trading, high volatility
    this.assetClasses.set('crypto', {
      name: 'Cryptocurrencies',
      tradingHours: '24/7',
      minTickSize: 0.00000001,
      dataFormats: ['orderbook', 'tick', 'ohlcv'],
      exchangeTypes: ['cex', 'dex'],
      settlementTime: 'T+0',
      defaultDataFormat: 'orderbook',
      examples: ['BTC', 'ETH', 'SOL', 'AVAX'],
    });

    // Equities - Market hours, regulated exchanges
    this.assetClasses.set('equities', {
      name: 'Equities',
      tradingHours: '09:30-16:00 ET',
      minTickSize: 0.01,
      dataFormats: ['tick', 'ohlcv'],
      exchangeTypes: ['nasdaq', 'nyse'],
      settlementTime: 'T+2',
      defaultDataFormat: 'tick',
      examples: ['AAPL', 'MSFT', 'TSLA', 'GOOGL'],
      regulatoryRequirements: ['SEC', 'FINRA'],
    });

    // Commodities - Futures-based, seasonal
    this.assetClasses.set('commodities', {
      name: 'Commodities',
      tradingHours: 'Varies (23:00-19:00 CT)',
      minTickSize: 0.01,
      dataFormats: ['ohlcv', 'tick'],
      exchangeTypes: ['cme', 'nymex'],
      settlementTime: 'T+1 or futures expiry',
      defaultDataFormat: 'ohlcv',
      examples: ['GC', 'WTI', 'CORN', 'WHEAT'],
      contractSpecifications: true,
      expirationHandling: 'rollover',
    });

    // Forex - 24/5 trading, high liquidity
    this.assetClasses.set('forex', {
      name: 'Forex',
      tradingHours: '17:00 Sun - 17:00 Fri ET',
      minTickSize: 0.0001,
      dataFormats: ['tick', 'ohlcv'],
      exchangeTypes: ['otc', 'spot'],
      settlementTime: 'T+2',
      defaultDataFormat: 'tick',
      examples: ['EURUSD', 'GBPUSD', 'USDJPY'],
      currencyPairs: true,
      bidAskSpread: true,
    });

    // Fixed Income - Low volatility, credit-sensitive
    this.assetClasses.set('fixed_income', {
      name: 'Fixed Income',
      tradingHours: '08:00-17:00 ET',
      minTickSize: 0.01,
      dataFormats: ['ohlcv', 'yield_curve'],
      exchangeTypes: ['otc', 'exchange'],
      settlementTime: 'T+1',
      defaultDataFormat: 'yield_curve',
      examples: ['US10Y', 'US2Y', 'BND', 'JNK'],
      yieldCurveTracking: true,
      creditSpreadTracking: true,
    });
  }

  /**
   * Initialize market calendars for each asset class
   * @private
   */
  initializeMarketCalendars() {
    this.marketCalendars.set('crypto', {
      holidays: [],
      tradingDays: 'All 365 days',
      marketOpen: '00:00 UTC',
      marketClose: '23:59 UTC',
      liquidityPeaks: ['13:00-20:00 UTC'],
    });

    this.marketCalendars.set('equities', {
      holidays: ['New Year', 'Presidents Day', 'Good Friday', 'Memorial Day', 'Independence Day', 'Labor Day', 'Thanksgiving', 'Christmas'],
      tradingDays: 'Mon-Fri',
      marketOpen: '09:30 ET',
      marketClose: '16:00 ET',
      preMarket: '04:00 ET',
      afterHours: '20:00 ET',
      liquidityPeaks: ['10:00-11:00 ET', '14:30-15:30 ET'],
    });

    this.marketCalendars.set('commodities', {
      holidays: ['New Year', 'Independence Day', 'Thanksgiving', 'Christmas'],
      tradingDays: 'Sun-Fri',
      marketOpen: '17:00 CT (previous day)',
      marketClose: '15:00 CT',
      liquidityPeaks: ['09:30-11:00 CT', '14:00-14:30 CT'],
      contractRollovers: 'Dynamic based on open interest',
    });

    this.marketCalendars.set('forex', {
      holidays: ['Christmas'],
      tradingDays: 'Mon-Fri',
      marketOpen: '17:00 EST Sunday',
      marketClose: '17:00 EST Friday',
      liquidityPeaks: ['08:00-12:00 GMT', '12:00-17:00 GMT', '20:00-23:00 GMT'],
      sessionTimes: {
        asian: '23:00-07:00 GMT',
        european: '07:00-15:00 GMT',
        american: '12:00-20:00 GMT',
      },
    });

    this.marketCalendars.set('fixed_income', {
      holidays: ['New Year', 'Good Friday', 'Memorial Day', 'Independence Day', 'Labor Day', 'Thanksgiving', 'Christmas'],
      tradingDays: 'Mon-Fri',
      marketOpen: '08:00 ET',
      marketClose: '17:00 ET',
      treasuryAuctions: 'Dynamic schedule',
      liquidityPeaks: ['09:00-10:00 ET', '13:00-14:00 ET'],
    });
  }

  /**
   * Initialize liquidity profiles for each asset class
   * @private
   */
  initializeLiquidityProfiles() {
    this.liquidityProfiles.set('crypto', {
      avgSpread: 0.1, // basis points
      avgDailyVolume: 'Very High',
      slippageModel: 'Square root of trade size',
      orderbookDepth: 'Deep (>1000 levels)',
      marketMakerPresence: 'High',
      liquidityBySize: {
        micro: '< 0.1 BTC',
        small: '0.1-1 BTC',
        medium: '1-10 BTC',
        large: '10-100 BTC',
        xlarge: '> 100 BTC',
      },
    });

    this.liquidityProfiles.set('equities', {
      avgSpread: 1, // basis points
      avgDailyVolume: 'High',
      slippageModel: 'Linear with volume',
      orderbookDepth: 'Moderate (50-100 levels)',
      marketMakerPresence: 'High (liquid stocks)',
      liquidityBySize: {
        micro: '< 1000 shares',
        small: '1000-10000 shares',
        medium: '10000-100000 shares',
        large: '100000-1000000 shares',
        xlarge: '> 1000000 shares',
      },
      microCapIlliquidity: true,
    });

    this.liquidityProfiles.set('commodities', {
      avgSpread: 10, // basis points
      avgDailyVolume: 'High (for active contracts)',
      slippageModel: 'Non-linear near expiry',
      orderbookDepth: 'Variable by contract',
      marketMakerPresence: 'Moderate',
      contractExpiryImpact: true,
      liquidityByContractMonth: {
        current: 'Highest',
        nextMonth: 'High',
        thirdMonth: 'Moderate',
        further: 'Low',
      },
    });

    this.liquidityProfiles.set('forex', {
      avgSpread: 0.5, // basis points for major pairs
      avgDailyVolume: 'Extremely High',
      slippageModel: 'Minimal for majors',
      orderbookDepth: 'Deep',
      marketMakerPresence: 'Constant',
      majorPairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'NZDUSD', 'USDCAD'],
      emergingPairsSpread: 'Up to 50 bps',
    });

    this.liquidityProfiles.set('fixed_income', {
      avgSpread: 5, // basis points
      avgDailyVolume: 'Moderate',
      slippageModel: 'Linear with volume',
      orderbookDepth: 'Shallow',
      marketMakerPresence: 'Moderate',
      creditSpreadVolatility: 'High during risk-off',
      treasuryLiquidity: 'Very High',
      corporateLiquidity: 'Variable by rating',
    });
  }

  /**
   * Initialize trading constraints per asset class
   * @private
   */
  initializeConstraints() {
    this.constraints.set('crypto', {
      minPosition: 0.0001,
      maxPosition: 'Unlimited',
      maxLeverage: 125,
      marginRequirement: 0.8,
      dailyWithdrawalLimit: 'API limits',
      depositTimelock: 'None',
      restrictions: ['Some DEX liquidity limits'],
      taxableEventRules: 'Varies by jurisdiction',
    });

    this.constraints.set('equities', {
      minPosition: 0.01,
      maxPosition: '50% of company',
      maxLeverage: 2,
      marginRequirement: 0.5,
      dailyWithdrawalLimit: 'None',
      depositTimelock: 'T+3 for securities',
      restrictions: ['Reg T', 'Short sale rules', 'PDT rules'],
      patternDayTrader: 'Min $25k for 4+ trades/5 days',
      taxableEventRules: 'Capital gains tracking',
    });

    this.constraints.set('commodities', {
      minPosition: '1 contract',
      maxPosition: 'Position limit (varies by commodity)',
      maxLeverage: 20,
      marginRequirement: 0.05,
      dailyWithdrawalLimit: 'None',
      depositTimelock: 'T+0',
      restrictions: ['CFTC position limits', 'Contract expiry handling'],
      contractRollovers: 'Mandatory before expiry',
      taxableEventRules: '60/40 long-term/short-term',
    });

    this.constraints.set('forex', {
      minPosition: '1000 units (micro lot)',
      maxPosition: 'Unlimited',
      maxLeverage: 50,
      marginRequirement: 2,
      dailyWithdrawalLimit: 'None',
      depositTimelock: 'T+0',
      restrictions: ['Retail leverage restrictions', 'Hedging rules'],
      nfaRestrictions: 'In USA',
      taxableEventRules: '1256 contract treatment',
    });

    this.constraints.set('fixed_income', {
      minPosition: 1000,
      maxPosition: 'Unlimited',
      maxLeverage: 5,
      marginRequirement: 0.3,
      dailyWithdrawalLimit: 'None',
      depositTimelock: 'T+1',
      restrictions: ['Callable bonds rules', 'Duration limits'],
      creditRating: 'Investment grade recommended',
      taxableEventRules: 'Interest income + capital gains',
    });
  }

  /**
   * Initialize risk parameters per asset class
   * @private
   */
  initializeRiskParameters() {
    this.riskParameters.set('crypto', {
      maxVolatility: 0.5,
      maxDrawdown: 0.4,
      minSharpeRatio: 0.5,
      maxCorrelation: 0.8,
      volatilityTargetDaily: 0.02,
      volatilityTargetAnnual: 0.4,
      convexityAdjustment: false,
      stressScenarios: ['Market crash', '10x movement', 'Flash crash'],
    });

    this.riskParameters.set('equities', {
      maxVolatility: 0.25,
      maxDrawdown: 0.3,
      minSharpeRatio: 0.75,
      maxCorrelation: 0.7,
      volatilityTargetDaily: 0.01,
      volatilityTargetAnnual: 0.2,
      convexityAdjustment: true,
      stressScenarios: ['2008 crisis', 'Flash crash', 'Circuit breakers'],
    });

    this.riskParameters.set('commodities', {
      maxVolatility: 0.3,
      maxDrawdown: 0.35,
      minSharpeRatio: 0.6,
      maxCorrelation: 0.6,
      volatilityTargetDaily: 0.015,
      volatilityTargetAnnual: 0.25,
      convexityAdjustment: true,
      seasonalityAdjustment: true,
      stressScenarios: ['Supply shock', 'Demand shock', 'Contango/backwardation'],
    });

    this.riskParameters.set('forex', {
      maxVolatility: 0.15,
      maxDrawdown: 0.2,
      minSharpeRatio: 1.0,
      maxCorrelation: 0.6,
      volatilityTargetDaily: 0.005,
      volatilityTargetAnnual: 0.12,
      convexityAdjustment: false,
      interestRateSensitivity: true,
      stressScenarios: ['Carry trade unwind', 'Central bank surprise', 'Debt crisis'],
    });

    this.riskParameters.set('fixed_income', {
      maxVolatility: 0.08,
      maxDrawdown: 0.1,
      minSharpeRatio: 1.2,
      maxCorrelation: 0.5,
      volatilityTargetDaily: 0.002,
      volatilityTargetAnnual: 0.08,
      convexityAdjustment: true,
      durationTarget: 5,
      convexityTarget: 60,
      creditSpreadRisk: true,
      stressScenarios: ['Rate shock +100bps', 'Credit event', 'Curve twist'],
    });
  }

  // ============================================================================
  // UNIFIED API - GET ASSET CLASS PROPERTIES
  // ============================================================================

  /**
   * Get full asset class configuration
   * @param {string} assetClass - Asset class identifier
   * @returns {Object} Complete asset class configuration
   */
  getAssetClassConfig(assetClass) {
    return {
      assetClass: this.assetClasses.get(assetClass),
      marketCalendar: this.marketCalendars.get(assetClass),
      liquidityProfile: this.liquidityProfiles.get(assetClass),
      constraints: this.constraints.get(assetClass),
      riskParameters: this.riskParameters.get(assetClass),
    };
  }

  /**
   * Determine if market is open for given asset class
   * @param {string} assetClass - Asset class identifier
   * @param {Date} time - Time to check (default: now)
   * @returns {boolean} Market open status
   */
  isMarketOpen(assetClass, time = new Date()) {
    const calendar = this.marketCalendars.get(assetClass);
    if (!calendar) return false;

    // Convert to appropriate timezone
    const hour = this.getHourInTimezone(time, assetClass);
    const dayOfWeek = time.getDay();

    if (assetClass === 'crypto') {
      return true; // 24/7
    }

    if (assetClass === 'equities') {
      return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9.5 && hour <= 16; // 9:30-16:00 ET
    }

    if (assetClass === 'forex') {
      return !(dayOfWeek === 6 && hour >= 17) && !(dayOfWeek === 0 && hour < 17); // 17:00 Sun - 17:00 Fri ET
    }

    if (assetClass === 'commodities') {
      return dayOfWeek !== 6; // Mon-Fri (US time)
    }

    if (assetClass === 'fixed_income') {
      return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 8 && hour <= 17; // 8:00-17:00 ET
    }

    return true;
  }

  /**
   * Get expected liquidity level for asset class at given time
   * @param {string} assetClass - Asset class identifier
   * @param {Date} time - Time to check
   * @returns {Object} Liquidity metrics
   */
  getLiquidityAtTime(assetClass, time = new Date()) {
    const hour = this.getHourInTimezone(time, assetClass);
    const profile = this.liquidityProfiles.get(assetClass);

    let liquidityFactor = 1.0;

    if (assetClass === 'equities') {
      // Lower during pre-market and after-hours
      if (hour < 9.5 || hour > 16) liquidityFactor = 0.5;
      // Higher at market open and close
      if ((hour > 9.5 && hour < 10) || (hour > 15.5 && hour < 16)) liquidityFactor = 1.3;
      // Lunch dip
      if (hour > 11.5 && hour < 13) liquidityFactor = 0.8;
    }

    if (assetClass === 'forex') {
      // Asian session
      if (hour > 0 && hour < 8) liquidityFactor = 0.7;
      // European session peak
      if (hour > 7 && hour < 15) liquidityFactor = 1.3;
      // US session
      if (hour > 12 && hour < 20) liquidityFactor = 1.2;
    }

    if (assetClass === 'commodities') {
      // Off-hours lower liquidity
      if (hour < 9.5 || hour > 15) liquidityFactor = 0.6;
      // Peak hours
      if (hour > 9.5 && hour < 11) liquidityFactor = 1.2;
    }

    return {
      spreadFactor: liquidityFactor,
      estimatedSpread: (profile?.avgSpread || 1) / liquidityFactor,
      liquidityFactor,
      slippageEstimate: this.estimateSlippage(assetClass, liquidityFactor),
    };
  }

  /**
   * Estimate execution slippage for given trade size
   * @param {string} assetClass - Asset class identifier
   * @param {number} tradeSize - Size of trade
   * @param {number} liquidityFactor - Liquidity factor (default: 1.0)
   * @returns {number} Estimated slippage in basis points
   */
  estimateSlippage(assetClass, tradeSize, liquidityFactor = 1.0) {
    const profile = this.liquidityProfiles.get(assetClass);
    if (!profile) return 0;

    let baseSlippage = profile.avgSpread || 1;
    let slippage = baseSlippage / liquidityFactor;

    // Scale with trade size (square root model for most assets)
    const sizeMultiplier = Math.sqrt(Math.abs(tradeSize) || 1);
    slippage *= sizeMultiplier;

    // Asset-specific adjustments
    if (assetClass === 'equities') {
      slippage *= 0.5; // Linear scaling
    }

    if (assetClass === 'commodities') {
      slippage *= 1.5; // Non-linear near expiry
    }

    if (assetClass === 'fixed_income') {
      slippage *= 2.0; // Higher slippage for bonds
    }

    return slippage;
  }

  /**
   * Format market data to unified OHLCV format
   * @param {string} assetClass - Asset class identifier
   * @param {Object} rawData - Raw market data from exchange
   * @returns {Object} Standardized OHLCV data
   */
  formatToOHLCV(assetClass, rawData) {
    const formatter = {
      crypto: (data) => ({
        timestamp: data.timestamp || data.t,
        open: parseFloat(data.o),
        high: parseFloat(data.h),
        low: parseFloat(data.l),
        close: parseFloat(data.c),
        volume: parseFloat(data.v),
        vwap: this.calculateVWAP(data),
      }),
      equities: (data) => ({
        timestamp: data.timestamp || data.date,
        open: parseFloat(data.open),
        high: parseFloat(data.high),
        low: parseFloat(data.low),
        close: parseFloat(data.close),
        volume: parseInt(data.volume),
        vwap: this.calculateVWAP(data),
      }),
      commodities: (data) => ({
        timestamp: data.timestamp,
        open: parseFloat(data.open),
        high: parseFloat(data.high),
        low: parseFloat(data.low),
        close: parseFloat(data.close),
        volume: parseInt(data.volume),
        vwap: this.calculateVWAP(data),
        openInterest: parseInt(data.openInterest),
      }),
      forex: (data) => ({
        timestamp: data.timestamp,
        open: parseFloat(data.bid.o || data.o),
        high: parseFloat(data.bid.h || data.h),
        low: parseFloat(data.bid.l || data.l),
        close: parseFloat(data.bid.c || data.c),
        volume: parseInt(data.volume || 0),
        vwap: this.calculateVWAP(data),
      }),
      fixed_income: (data) => ({
        timestamp: data.timestamp,
        open: parseFloat(data.open),
        high: parseFloat(data.high),
        low: parseFloat(data.low),
        close: parseFloat(data.close),
        volume: parseInt(data.volume || 0),
        yield: parseFloat(data.yield),
        duration: parseFloat(data.duration),
        convexity: parseFloat(data.convexity),
      }),
    };

    const format = formatter[assetClass];
    return format ? format(rawData) : rawData;
  }

  /**
   * Calculate VWAP from OHLCV data
   * @private
   * @param {Object} data - OHLCV data
   * @returns {number} VWAP
   */
  calculateVWAP(data) {
    const hlc = (parseFloat(data.high) + parseFloat(data.low) + parseFloat(data.close)) / 3;
    const volume = parseFloat(data.volume || 1);
    return hlc; // Simplified; actual VWAP requires intrabar data
  }

  /**
   * Get optimal position sizing for asset class
   * @param {string} assetClass - Asset class identifier
   * @param {number} portfolioValue - Total portfolio value
   * @param {number} riskPerTrade - Risk per trade (0-1)
   * @returns {Object} Position sizing recommendations
   */
  getPositionSize(assetClass, portfolioValue, riskPerTrade = 0.02) {
    const constraints = this.constraints.get(assetClass);
    const riskParams = this.riskParameters.get(assetClass);

    if (!constraints || !riskParams) return null;

    const maxRiskAmount = portfolioValue * riskPerTrade;
    const volatility = riskParams.volatilityTargetDaily;
    const positionValue = volatility > 0 ? maxRiskAmount / volatility : 0;

    return {
      maxRiskAmount,
      recommendedPositionValue: positionValue,
      percentOfPortfolio: positionValue / portfolioValue,
      minPosition: constraints.minPosition,
      maxPosition: constraints.maxPosition,
      leverage: constraints.maxLeverage,
      marginRequired: constraints.marginRequirement,
    };
  }

  /**
   * Get tax treatment for asset class
   * @param {string} assetClass - Asset class identifier
   * @returns {Object} Tax treatment details
   */
  getTaxTreatment(assetClass) {
    const taxTreatments = {
      crypto: {
        type: 'Capital gains',
        shortTermRate: 'Ordinary income rates',
        longTermRate: '15-20%',
        heldPeriod: '> 1 year',
        specialRules: 'No like-kind exchange after 2017',
        staking: 'Ordinary income',
      },
      equities: {
        type: 'Capital gains',
        shortTermRate: 'Ordinary income rates',
        longTermRate: '0-20%',
        heldPeriod: '> 1 year',
        specialRules: 'Wash sale rules, preferred dividends',
        qualifiedDividends: '0-20%',
      },
      commodities: {
        type: '60/40 mix',
        longTermRate: '15-20%',
        shortTermRate: 'Ordinary income',
        treatmentMix: '60% long-term, 40% short-term',
        specialRules: 'Section 1256 contracts',
      },
      forex: {
        type: '60/40 mix',
        longTermRate: '15-20%',
        shortTermRate: 'Ordinary income',
        treatmentMix: '60% long-term, 40% short-term',
        specialRules: '1256 contract treatment',
        optionsAdjustment: true,
      },
      fixed_income: {
        type: 'Ordinary income + capital gains',
        interestRate: 'Ordinary income rates',
        capitalGainsRate: '0-20%',
        specialRules: 'OID rules, market discount rules',
        municipalBonds: 'Generally tax-free',
      },
    };

    return taxTreatments[assetClass];
  }

  /**
   * Get hour in appropriate timezone for asset class
   * @private
   * @param {Date} date - Date to convert
   * @param {string} assetClass - Asset class identifier
   * @returns {number} Hour in asset class timezone
   */
  getHourInTimezone(date, assetClass) {
    const timezones = {
      equities: 'America/New_York',
      commodities: 'America/Chicago',
      forex: 'America/New_York',
      fixed_income: 'America/New_York',
      crypto: 'UTC',
    };

    const tz = timezones[assetClass];
    if (!tz) return date.getHours();

    // Simplified timezone conversion
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
    });

    const parts = formatter.formatToParts(date);
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || 0);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || 0);

    return hour + minute / 60;
  }

  /**
   * Get correlation matrix between asset classes
   * @param {Array} assetClasses - Array of asset class identifiers
   * @returns {Object} Correlation matrix
   */
  getInterAssetClassCorrelations(assetClasses) {
    // Historical correlation patterns between asset classes
    const correlations = {
      crypto_equities: 0.65,
      crypto_commodities: 0.35,
      crypto_forex: 0.25,
      crypto_fixed_income: -0.15,
      equities_commodities: 0.15,
      equities_forex: 0.45,
      equities_fixed_income: 0.25,
      commodities_forex: 0.35,
      commodities_fixed_income: -0.05,
      forex_fixed_income: 0.3,
    };

    const matrix = {};
    for (const ac1 of assetClasses) {
      matrix[ac1] = {};
      for (const ac2 of assetClasses) {
        if (ac1 === ac2) {
          matrix[ac1][ac2] = 1.0;
        } else {
          const key = [ac1, ac2].sort().join('_');
          matrix[ac1][ac2] = correlations[key] || 0;
        }
      }
    }

    return matrix;
  }

  /**
   * Get diversification benefit from multi-asset allocation
   * @param {Object} allocation - Asset class allocation
   * @returns {Object} Diversification metrics
   */
  getDiversificationBenefit(allocation) {
    const classes = Object.keys(allocation);
    const correlations = this.getInterAssetClassCorrelations(classes);

    // Calculate Herfindahl index
    let herfindahl = 0;
    for (const ac of classes) {
      herfindahl += allocation[ac] ** 2;
    }

    // Calculate diversification ratio
    const individualRisks = classes.map((ac) => this.riskParameters.get(ac).volatilityTargetDaily);
    const avgRisk = individualRisks.reduce((a, b) => a + b) / individualRisks.length;

    let portfolioRisk = 0;
    for (let i = 0; i < classes.length; i++) {
      for (let j = 0; j < classes.length; j++) {
        const w1 = allocation[classes[i]];
        const w2 = allocation[classes[j]];
        const corr = correlations[classes[i]][classes[j]];
        const r1 = individualRisks[i];
        const r2 = individualRisks[j];
        portfolioRisk += w1 * w2 * r1 * r2 * corr;
      }
    }

    return {
      herfindahlIndex: herfindahl,
      diversificationRatio: avgRisk / Math.sqrt(portfolioRisk),
      estimatedVolatilityReduction: 1 - Math.sqrt(portfolioRisk) / avgRisk,
      isWellDiversified: herfindahl < 0.25,
    };
  }

  /**
   * List all supported asset classes
   * @returns {Array} Array of asset class identifiers
   */
  getSupportedAssetClasses() {
    return Array.from(this.assetClasses.keys());
  }

  /**
   * Validate asset class identifier
   * @param {string} assetClass - Asset class to validate
   * @returns {boolean} Whether asset class is supported
   */
  isValidAssetClass(assetClass) {
    return this.assetClasses.has(assetClass);
  }

  /**
   * Get example assets for given asset class
   * @param {string} assetClass - Asset class identifier
   * @returns {Array} Example assets
   */
  getExampleAssets(assetClass) {
    return this.assetClasses.get(assetClass)?.examples || [];
  }
}

// ============================================================================
// EXPORT
// ============================================================================

module.exports = GNNMultiAssetAdapter;
