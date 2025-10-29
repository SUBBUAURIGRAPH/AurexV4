/**
 * GNN Cross-Asset Class Correlations
 *
 * Advanced correlation analysis and portfolio optimization across multiple
 * asset classes. Provides:
 * - Dynamic correlation matrix computation
 * - Hedging recommendation engine
 * - Diversification benefits analysis
 * - Regime-aware portfolio optimization
 * - Contagion detection and systemic risk assessment
 *
 * Integrates with GNNMultiAssetAdapter for asset class specifics and
 * GNNAssetClassStrategies for tactical portfolio construction.
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

class GNNCrossAssetCorrelations {
  constructor(multiAssetAdapter, strategies) {
    this.adapter = multiAssetAdapter;
    this.strategies = strategies;
    this.correlationHistory = new Map();
    this.regimeCorrelations = new Map();
    this.hedgingMatrix = new Map();
    this.diversificationScores = new Map();
    this.stressCorrelations = new Map();

    this.initializeCorrelationModels();
    this.initializeRegimes();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize base correlation models
   * @private
   */
  initializeCorrelationModels() {
    // Normal market correlations (average case)
    const baseCorrelations = {
      'crypto-equities': 0.65,
      'crypto-commodities': 0.35,
      'crypto-forex': 0.25,
      'crypto-fixed_income': -0.15,
      'equities-commodities': 0.15,
      'equities-forex': 0.45,
      'equities-fixed_income': 0.25,
      'commodities-forex': 0.35,
      'commodities-fixed_income': -0.05,
      'forex-fixed_income': 0.30,
    };

    // Intra-asset class correlations
    const intraAssetCorrelations = {
      'crypto': {
        'BTC-ETH': 0.75,
        'BTC-SOL': 0.65,
        'ETH-SOL': 0.72,
        'Stables-Alt': -0.10,
      },
      'equities': {
        'Tech-Tech': 0.85,
        'Finance-Finance': 0.80,
        'Consumer-Consumer': 0.75,
        'Growth-Value': -0.30,
        'Large-Small': 0.70,
      },
      'commodities': {
        'Energy-Energy': 0.80,
        'Metals-Metals': 0.75,
        'Agriculture-Agriculture': 0.70,
        'Energy-Metals': 0.40,
      },
      'forex': {
        'USD-correlated': -0.60,
        'Risk-off-correlated': 0.70,
        'EUR-GBP': 0.80,
        'Carry-pairs': 0.85,
      },
      'fixed_income': {
        'Treasury-Treasury': 0.95,
        'Corporate-Corporate': 0.75,
        'Investment-Grade': 0.80,
        'High-Yield': 0.70,
      },
    };

    this.correlationHistory.set('base', baseCorrelations);
    this.correlationHistory.set('intra', intraAssetCorrelations);
  }

  /**
   * Initialize regime-specific correlation models
   * @private
   */
  initializeRegimes() {
    // Risk-on regime (bull market, risk appetite)
    this.regimeCorrelations.set('risk-on', {
      'crypto-equities': 0.75,
      'crypto-commodities': 0.45,
      'crypto-forex': 0.35,
      'crypto-fixed_income': 0.10,
      'equities-commodities': 0.35,
      'equities-forex': 0.55,
      'equities-fixed_income': 0.40,
      'commodities-forex': 0.45,
      'commodities-fixed_income': 0.15,
      'forex-fixed_income': 0.40,
      probability: 0.40,
      volatility: 0.15,
    });

    // Risk-off regime (bear market, flight to quality)
    this.regimeCorrelations.set('risk-off', {
      'crypto-equities': 0.35,
      'crypto-commodities': 0.10,
      'crypto-forex': -0.10,
      'crypto-fixed_income': -0.40,
      'equities-commodities': -0.20,
      'equities-forex': 0.20,
      'equities-fixed_income': -0.30,
      'commodities-forex': 0.10,
      'commodities-fixed_income': -0.50,
      'forex-fixed_income': -0.15,
      probability: 0.25,
      volatility: 0.35,
    });

    // Volatility spike regime (uncertain times)
    this.regimeCorrelations.set('volatility-spike', {
      'crypto-equities': 0.85,
      'crypto-commodities': 0.55,
      'crypto-forex': 0.45,
      'crypto-fixed_income': -0.25,
      'equities-commodities': 0.60,
      'equities-forex': 0.70,
      'equities-fixed_income': -0.20,
      'commodities-forex': 0.65,
      'commodities-fixed_income': -0.15,
      'forex-fixed_income': 0.35,
      probability: 0.20,
      volatility: 0.45,
    });

    // Stable regime (normal conditions)
    this.regimeCorrelations.set('stable', {
      'crypto-equities': 0.55,
      'crypto-commodities': 0.25,
      'crypto-forex': 0.15,
      'crypto-fixed_income': -0.05,
      'equities-commodities': 0.10,
      'equities-forex': 0.40,
      'equities-fixed_income': 0.20,
      'commodities-forex': 0.30,
      'commodities-fixed_income': 0.05,
      'forex-fixed_income': 0.25,
      probability: 0.15,
      volatility: 0.12,
    });
  }

  // ============================================================================
  // CORRELATION ANALYSIS
  // ============================================================================

  /**
   * Compute dynamic correlation matrix between asset classes
   * @param {Object} historicalData - Historical price data for all assets
   * @param {number} lookbackPeriod - Number of periods for correlation (default: 252)
   * @returns {Object} Correlation matrix
   */
  computeDynamicCorrelations(historicalData, lookbackPeriod = 252) {
    const assetClasses = this.adapter.getSupportedAssetClasses();
    const correlations = {};

    // Initialize matrix
    for (const ac1 of assetClasses) {
      correlations[ac1] = {};
      for (const ac2 of assetClasses) {
        if (ac1 === ac2) {
          correlations[ac1][ac2] = 1.0;
        } else {
          correlations[ac1][ac2] = this.computeCorrelation(
            historicalData[ac1],
            historicalData[ac2],
            lookbackPeriod
          );
        }
      }
    }

    correlations.timestamp = new Date();
    correlations.lookbackPeriod = lookbackPeriod;

    return correlations;
  }

  /**
   * Compute correlation between two asset classes
   * @private
   * @param {Array} data1 - Price series 1
   * @param {Array} data2 - Price series 2
   * @param {number} periods - Number of periods
   * @returns {number} Correlation coefficient
   */
  computeCorrelation(data1, data2, periods) {
    if (!data1 || !data2 || data1.length < 2 || data2.length < 2) {
      return 0;
    }

    const n = Math.min(periods, data1.length, data2.length);
    const d1 = data1.slice(-n);
    const d2 = data2.slice(-n);

    // Compute returns
    const returns1 = [];
    const returns2 = [];

    for (let i = 1; i < n; i++) {
      returns1.push((d1[i] - d1[i - 1]) / d1[i - 1]);
      returns2.push((d2[i] - d2[i - 1]) / d2[i - 1]);
    }

    // Compute means
    const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
    const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;

    // Compute covariance and standard deviations
    let cov = 0;
    let std1 = 0;
    let std2 = 0;

    for (let i = 0; i < returns1.length; i++) {
      const dev1 = returns1[i] - mean1;
      const dev2 = returns2[i] - mean2;
      cov += dev1 * dev2;
      std1 += dev1 * dev1;
      std2 += dev2 * dev2;
    }

    cov /= returns1.length;
    std1 = Math.sqrt(std1 / returns1.length);
    std2 = Math.sqrt(std2 / returns2.length);

    const correlation = std1 > 0 && std2 > 0 ? cov / (std1 * std2) : 0;

    return Math.max(-1, Math.min(1, correlation));
  }

  /**
   * Get current market regime and regime-aware correlations
   * @param {Object} marketIndicators - Current market indicators
   * @returns {Object} Market regime and correlations
   */
  detectMarketRegime(marketIndicators) {
    const regimes = Array.from(this.regimeCorrelations.keys());
    let bestRegime = 'stable';
    let bestScore = -Infinity;

    for (const regime of regimes) {
      const score = this.calculateRegimeScore(regime, marketIndicators);
      if (score > bestScore) {
        bestScore = score;
        bestRegime = regime;
      }
    }

    const regimeConfig = this.regimeCorrelations.get(bestRegime);

    return {
      currentRegime: bestRegime,
      confidence: bestScore,
      correlations: regimeConfig,
      volatilityTarget: regimeConfig.volatility,
      expectedRegimeProbability: regimeConfig.probability,
      recommendations: this.getRegimeRecommendations(bestRegime),
    };
  }

  /**
   * Calculate regime score based on market indicators
   * @private
   * @param {string} regime - Regime identifier
   * @param {Object} indicators - Market indicators
   * @returns {number} Regime score
   */
  calculateRegimeScore(regime, indicators) {
    let score = 0;

    // VIX level (volatility)
    if (indicators.vix) {
      if (regime === 'risk-off' && indicators.vix > 25) score += 2;
      if (regime === 'volatility-spike' && indicators.vix > 35) score += 2;
      if (regime === 'stable' && indicators.vix < 15) score += 2;
    }

    // Yield curve
    if (indicators.yieldCurveSlope) {
      if (regime === 'risk-on' && indicators.yieldCurveSlope > 0) score += 1;
      if (regime === 'risk-off' && indicators.yieldCurveSlope < 0) score += 1;
    }

    // Credit spreads
    if (indicators.creditSpreads) {
      if (regime === 'risk-off' && indicators.creditSpreads > 200) score += 1;
      if (regime === 'risk-on' && indicators.creditSpreads < 150) score += 1;
    }

    // Equity momentum
    if (indicators.equityMomentum) {
      if (regime === 'risk-on' && indicators.equityMomentum > 0) score += 1;
      if (regime === 'risk-off' && indicators.equityMomentum < 0) score += 1;
    }

    return score;
  }

  /**
   * Get tactical recommendations for current regime
   * @private
   * @param {string} regime - Current regime
   * @returns {Object} Recommendations
   */
  getRegimeRecommendations(regime) {
    const recommendations = {
      'risk-on': {
        action: 'Increase risk exposure',
        assetClasses: ['crypto', 'equities', 'commodities'],
        reduceAssets: ['fixed_income', 'forex-safe-havens'],
        allocation: { crypto: 0.15, equities: 0.50, commodities: 0.15, fixed_income: 0.10, forex: 0.10 },
      },
      'risk-off': {
        action: 'Reduce risk exposure',
        assetClasses: ['fixed_income', 'forex-safe-havens'],
        reduceAssets: ['crypto', 'commodities'],
        allocation: { crypto: 0.05, equities: 0.25, commodities: 0.05, fixed_income: 0.50, forex: 0.15 },
      },
      'volatility-spike': {
        action: 'Use hedging strategies',
        assetClasses: ['fixed_income', 'volatility'],
        reduceAssets: ['crypto', 'equities'],
        allocation: { crypto: 0.05, equities: 0.20, commodities: 0.10, fixed_income: 0.50, forex: 0.15 },
      },
      'stable': {
        action: 'Balanced allocation',
        assetClasses: ['all'],
        allocation: { crypto: 0.10, equities: 0.40, commodities: 0.10, fixed_income: 0.25, forex: 0.15 },
      },
    };

    return recommendations[regime];
  }

  // ============================================================================
  // HEDGING RECOMMENDATIONS
  // ============================================================================

  /**
   * Generate hedging recommendations for portfolio
   * @param {Object} portfolio - Current portfolio allocation
   * @param {Object} marketRegime - Current market regime
   * @returns {Object} Hedging recommendations
   */
  generateHedgingRecommendations(portfolio, marketRegime = null) {
    const recommendations = [];

    // Analyze each position for hedge needs
    for (const [assetClass, allocation] of Object.entries(portfolio)) {
      if (allocation <= 0) continue;

      const hedgeRatio = this.calculateOptimalHedgeRatio(assetClass, marketRegime);
      const hedgeInstruments = this.getAvailableHedges(assetClass);

      recommendations.push({
        assetClass,
        currentAllocation: allocation,
        hedgeRatio,
        instruments: hedgeInstruments,
        estimatedCost: this.estimateHedgeCost(assetClass, allocation, hedgeRatio),
        effectiveness: this.calculateHedgeEffectiveness(assetClass, marketRegime),
      });
    }

    return {
      timestamp: new Date(),
      marketRegime,
      hedges: recommendations,
      totalCost: recommendations.reduce((sum, h) => sum + h.estimatedCost, 0),
      portfolioDiversificationScore: this.calculateDiversificationScore(portfolio),
    };
  }

  /**
   * Calculate optimal hedge ratio for asset class
   * @private
   * @param {string} assetClass - Asset class identifier
   * @param {Object} regime - Market regime
   * @returns {number} Optimal hedge ratio (0-1)
   */
  calculateOptimalHedgeRatio(assetClass, regime) {
    const baseRatios = {
      crypto: 0.5,
      equities: 0.3,
      commodities: 0.4,
      forex: 0.25,
      fixed_income: 0.2,
    };

    let ratio = baseRatios[assetClass] || 0.3;

    // Adjust for regime
    if (regime === 'risk-off') ratio *= 1.5;
    if (regime === 'volatility-spike') ratio *= 1.3;
    if (regime === 'risk-on') ratio *= 0.7;

    return Math.min(1, ratio);
  }

  /**
   * Get available hedging instruments for asset class
   * @private
   * @param {string} assetClass - Asset class identifier
   * @returns {Array} Available hedge instruments
   */
  getAvailableHedges(assetClass) {
    const hedges = {
      crypto: ['Futures short', 'Put options', 'Inverse leveraged ETFs', 'Stablecoin swap'],
      equities: ['Index put options', 'Inverse ETFs', 'Collar strategies', 'Put spreads'],
      commodities: ['Futures short', 'Put options', 'Inverse products', 'Calendar spreads'],
      forex: ['Forward contracts', 'Put options', 'Reverse carry positions', 'Currency swaps'],
      fixed_income: [
        'Rate swaps',
        'Swaptions',
        'Treasury futures short',
        'Credit default swaps',
        'Duration management',
      ],
    };

    return hedges[assetClass] || [];
  }

  /**
   * Estimate hedge cost in basis points
   * @private
   * @param {string} assetClass - Asset class identifier
   * @param {number} allocation - Portfolio allocation
   * @param {number} hedgeRatio - Hedge ratio
   * @returns {number} Cost in basis points
   */
  estimateHedgeCost(assetClass, allocation, hedgeRatio) {
    const baseCosts = {
      crypto: 5,
      equities: 25,
      commodities: 30,
      forex: 10,
      fixed_income: 15,
    };

    const baseCost = baseCosts[assetClass] || 20;
    const hedgedAmount = allocation * hedgeRatio;

    return hedgedAmount * (baseCost / 10000); // Convert bps to decimal
  }

  /**
   * Calculate hedge effectiveness for regime
   * @private
   * @param {string} assetClass - Asset class identifier
   * @param {Object} regime - Market regime
   * @returns {number} Expected effectiveness (0-1)
   */
  calculateHedgeEffectiveness(assetClass, regime) {
    const baseEffectiveness = {
      crypto: 0.75,
      equities: 0.90,
      commodities: 0.80,
      forex: 0.85,
      fixed_income: 0.92,
    };

    let effectiveness = baseEffectiveness[assetClass] || 0.85;

    // Regime adjustments
    if (regime === 'volatility-spike') effectiveness *= 0.8; // Effectiveness decreases during spikes
    if (regime === 'risk-on') effectiveness *= 1.1;

    return Math.min(1, Math.max(0, effectiveness));
  }

  // ============================================================================
  // DIVERSIFICATION ANALYSIS
  // ============================================================================

  /**
   * Calculate diversification score for portfolio
   * @param {Object} portfolio - Portfolio allocation
   * @returns {Object} Diversification metrics
   */
  calculateDiversificationScore(portfolio) {
    // Herfindahl index (concentration)
    let herfindahl = 0;
    let maxAllocation = 0;

    for (const allocation of Object.values(portfolio)) {
      herfindahl += allocation * allocation;
      maxAllocation = Math.max(maxAllocation, allocation);
    }

    // Diversification ratio
    const diversificationRatio = 1 / herfindahl;

    // Effective number of asset classes
    const effectiveN = 1 / herfindahl;

    // Allocation spread (entropy)
    let entropy = 0;
    for (const allocation of Object.values(portfolio)) {
      if (allocation > 0) {
        entropy -= allocation * Math.log2(allocation);
      }
    }

    const maxEntropy = Math.log2(Object.keys(portfolio).length);
    const normalizedEntropy = entropy / maxEntropy;

    return {
      herfindahlIndex: herfindahl,
      diversificationRatio,
      effectiveAssetClasses: effectiveN,
      entropy: normalizedEntropy,
      maxConcentration: maxAllocation,
      isWellDiversified: herfindahl < 0.3 && effectiveN > 2,
      diversificationScore: Math.round((normalizedEntropy * 100) / 2 + (1 - herfindahl) * 50),
    };
  }

  /**
   * Suggest optimal allocation across asset classes
   * @param {number} riskTolerance - Risk tolerance (0-1)
   * @param {Object} marketRegime - Current market regime
   * @returns {Object} Suggested allocation
   */
  suggestOptimalAllocation(riskTolerance, marketRegime = null) {
    // Base allocations by risk tolerance
    const baseAllocations = {
      conservative: { crypto: 0.05, equities: 0.30, commodities: 0.05, fixed_income: 0.50, forex: 0.10 },
      moderate: { crypto: 0.10, equities: 0.45, commodities: 0.10, fixed_income: 0.25, forex: 0.10 },
      aggressive: { crypto: 0.20, equities: 0.50, commodities: 0.15, fixed_income: 0.10, forex: 0.05 },
    };

    let allocation;
    if (riskTolerance < 0.4) {
      allocation = { ...baseAllocations.conservative };
    } else if (riskTolerance < 0.7) {
      allocation = { ...baseAllocations.moderate };
    } else {
      allocation = { ...baseAllocations.aggressive };
    }

    // Adjust for regime
    if (marketRegime) {
      const regimeRecs = this.getRegimeRecommendations(marketRegime);
      if (regimeRecs && regimeRecs.allocation) {
        const factor = 0.3; // 30% weight to regime adjustment
        for (const ac of Object.keys(allocation)) {
          const regimeAlloc = regimeRecs.allocation[ac] || 0;
          allocation[ac] = allocation[ac] * (1 - factor) + regimeAlloc * factor;
        }
      }
    }

    // Normalize to sum to 1
    const sum = Object.values(allocation).reduce((a, b) => a + b, 0);
    for (const ac of Object.keys(allocation)) {
      allocation[ac] /= sum;
    }

    return {
      riskTolerance,
      marketRegime: marketRegime || 'unknown',
      suggestedAllocation: allocation,
      diversificationScore: this.calculateDiversificationScore(allocation),
      projectedAnnualReturn: this.projectPortfolioReturn(allocation),
      projectedVolatility: this.projectPortfolioVolatility(allocation),
    };
  }

  /**
   * Project portfolio return based on allocation
   * @private
   * @param {Object} allocation - Asset class allocation
   * @returns {number} Projected annual return
   */
  projectPortfolioReturn(allocation) {
    const returns = {
      crypto: 0.25,
      equities: 0.10,
      commodities: 0.05,
      fixed_income: 0.03,
      forex: 0.02,
    };

    let totalReturn = 0;
    for (const [ac, alloc] of Object.entries(allocation)) {
      totalReturn += (returns[ac] || 0) * alloc;
    }

    return totalReturn;
  }

  /**
   * Project portfolio volatility based on allocation
   * @private
   * @param {Object} allocation - Asset class allocation
   * @returns {number} Projected annual volatility
   */
  projectPortfolioVolatility(allocation) {
    const volatilities = {
      crypto: 0.40,
      equities: 0.16,
      commodities: 0.18,
      fixed_income: 0.06,
      forex: 0.10,
    };

    const correlations = this.correlationHistory.get('base');

    let variance = 0;
    const assetClasses = Object.keys(allocation);

    for (let i = 0; i < assetClasses.length; i++) {
      for (let j = 0; j < assetClasses.length; j++) {
        const ac1 = assetClasses[i];
        const ac2 = assetClasses[j];
        const w1 = allocation[ac1];
        const w2 = allocation[ac2];
        const v1 = volatilities[ac1];
        const v2 = volatilities[ac2];

        const key = [ac1, ac2].sort().join('-');
        const corr = correlations[key] || (i === j ? 1 : 0);

        variance += w1 * w2 * v1 * v2 * corr;
      }
    }

    return Math.sqrt(variance);
  }

  // ============================================================================
  // CONTAGION AND SYSTEMIC RISK
  // ============================================================================

  /**
   * Detect potential contagion risk between asset classes
   * @param {Object} marketStress - Stressed market indicators
   * @returns {Object} Contagion analysis
   */
  detectContagionRisk(marketStress) {
    const contagionPaths = [];

    // Stress test each asset class
    for (const sourceClass of this.adapter.getSupportedAssetClasses()) {
      const impactedAssets = this.modelContagion(sourceClass, marketStress);

      for (const [targetClass, impact] of Object.entries(impactedAssets)) {
        if (impact > 0.3) {
          contagionPaths.push({
            source: sourceClass,
            target: targetClass,
            impactMagnitude: impact,
            mechanism: this.identifyContagionMechanism(sourceClass, targetClass),
            mitigationStrategy: this.getContagionMitigation(sourceClass, targetClass),
          });
        }
      }
    }

    return {
      systemicRisk: contagionPaths.length > 3 ? 'HIGH' : 'MODERATE',
      contagionPaths: contagionPaths.sort((a, b) => b.impactMagnitude - a.impactMagnitude),
      timestamp: new Date(),
    };
  }

  /**
   * Model contagion from source asset class
   * @private
   * @param {string} sourceClass - Source asset class
   * @param {Object} stress - Stress indicators
   * @returns {Object} Impact on other asset classes
   */
  modelContagion(sourceClass, stress) {
    const impacts = {};
    const targetClasses = this.adapter.getSupportedAssetClasses();

    for (const targetClass of targetClasses) {
      if (sourceClass === targetClass) {
        impacts[targetClass] = 1.0;
      } else {
        // Base correlation impact
        const key = [sourceClass, targetClass].sort().join('-');
        const baseCorr = this.correlationHistory.get('base')[key] || 0;

        // Stress amplification
        const stressAmplification = stress[sourceClass] || 0;
        const contagionFactor = 0.7; // 70% correlation beta during stress

        impacts[targetClass] = Math.abs(baseCorr) * (1 + stressAmplification * contagionFactor);
      }
    }

    return impacts;
  }

  /**
   * Identify contagion transmission mechanism
   * @private
   * @param {string} source - Source asset class
   * @param {string} target - Target asset class
   * @returns {string} Mechanism description
   */
  identifyContagionMechanism(source, target) {
    const mechanisms = {
      'crypto-equities': 'Correlation beta increase during risk-off',
      'crypto-fixed_income': 'Inverse relationship strengthens in stress',
      'equities-fixed_income': 'Flight to quality reduces equity valuations',
      'commodities-equities': 'Input cost inflation on corporate earnings',
      'forex-equities': 'Currency depreciation impacts earnings',
      'forex-fixed_income': 'Rate carry unwind drives both higher',
    };

    const key = [source, target].sort().join('-');
    return mechanisms[key] || 'Increased correlation during stress';
  }

  /**
   * Get contagion mitigation strategy
   * @private
   * @param {string} source - Source asset class
   * @param {string} target - Target asset class
   * @returns {Object} Mitigation strategy
   */
  getContagionMitigation(source, target) {
    return {
      reducePairCorrelation: `Decrease allocation to ${target} to reduce contagion exposure`,
      hedge: `Use hedges on ${target} correlated with ${source} stress`,
      diversify: `Increase allocation to uncorrelated assets`,
      dynamicRebalance: `Rebalance quarterly instead of annually`,
      stressTest: `Model worst-case scenarios between ${source} and ${target}`,
    };
  }

  /**
   * Generate comprehensive portfolio risk report
   * @param {Object} portfolio - Current portfolio
   * @param {Object} historicalData - Historical price data
   * @returns {Object} Comprehensive risk report
   */
  generateRiskReport(portfolio, historicalData) {
    const correlations = this.computeDynamicCorrelations(historicalData);
    const regime = this.detectMarketRegime({
      vix: 15,
      yieldCurveSlope: 0.5,
      creditSpreads: 150,
      equityMomentum: 0.1,
    });

    const diversification = this.calculateDiversificationScore(portfolio);
    const hedges = this.generateHedgingRecommendations(portfolio, regime.currentRegime);
    const contagion = this.detectContagionRisk({ crypto: 0.2, equities: 0.1 });

    return {
      timestamp: new Date(),
      portfolio,
      correlations,
      marketRegime: regime,
      diversification,
      hedgingRecommendations: hedges,
      contagionRisk: contagion,
      summaryScore: this.calculateSummaryRiskScore(diversification, hedges, contagion),
    };
  }

  /**
   * Calculate summary risk score
   * @private
   * @param {Object} div - Diversification metrics
   * @param {Object} hedges - Hedging recommendations
   * @param {Object} contagion - Contagion analysis
   * @returns {number} Risk score (0-100)
   */
  calculateSummaryRiskScore(div, hedges, contagion) {
    let score = 50;

    // Diversification benefit
    score += div.isWellDiversified ? 20 : -10;

    // Hedging adequacy
    score -= hedges.totalCost > 0 ? 5 : 0;

    // Systemic risk
    if (contagion.systemicRisk === 'HIGH') score -= 20;

    return Math.max(0, Math.min(100, score));
  }
}

// ============================================================================
// EXPORT
// ============================================================================

module.exports = GNNCrossAssetCorrelations;
