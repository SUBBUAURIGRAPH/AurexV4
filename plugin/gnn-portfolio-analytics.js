/**
 * GNN Portfolio Analytics - Portfolio Analysis and Attribution
 *
 * Provides sophisticated portfolio analysis including:
 * - Portfolio composition analysis
 * - Diversification metrics
 * - Performance attribution (holdings, sectors, strategies)
 * - Liquidity analysis
 * - Turnover and rebalancing analysis
 * - Portfolio efficiency metrics
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

class GNNPortfolioAnalytics {
  constructor(analyticsEngine, options = {}) {
    this.analyticsEngine = analyticsEngine;
    this.config = {
      rebalanceThreshold: options.rebalanceThreshold || 0.05, // 5% drift
      minLiquidityRatio: options.minLiquidityRatio || 0.8,
      ...options
    };

    this.stats = {
      analysesPerformed: 0,
      errorsEncountered: 0,
      lastAnalysis: null
    };
  }

  // ============================================================================
  // PORTFOLIO COMPOSITION ANALYSIS
  // ============================================================================

  /**
   * Analyze portfolio composition
   * @param {Object} portfolio - Portfolio holdings
   * @returns {Object} Composition analysis
   */
  analyzeComposition(portfolio) {
    if (!portfolio || !Array.isArray(portfolio.holdings)) return {};

    const composition = {
      totalValue: 0,
      numberOfPositions: portfolio.holdings.length,
      byAsset: {},
      bySector: {},
      byAssetClass: {},
      byGeography: {},
      summary: {}
    };

    portfolio.holdings.forEach(holding => {
      composition.totalValue += holding.value;

      // By asset
      composition.byAsset[holding.symbol] = {
        value: holding.value,
        weight: holding.weight,
        shares: holding.shares,
        price: holding.price,
        assetClass: holding.assetClass,
        sector: holding.sector,
        country: holding.country
      };

      // By sector
      const sector = holding.sector || 'uncategorized';
      if (!composition.bySector[sector]) {
        composition.bySector[sector] = { value: 0, weight: 0, positions: 0 };
      }
      composition.bySector[sector].value += holding.value;
      composition.bySector[sector].weight += holding.weight;
      composition.bySector[sector].positions++;

      // By asset class
      const assetClass = holding.assetClass || 'uncategorized';
      if (!composition.byAssetClass[assetClass]) {
        composition.byAssetClass[assetClass] = { value: 0, weight: 0, positions: 0 };
      }
      composition.byAssetClass[assetClass].value += holding.value;
      composition.byAssetClass[assetClass].weight += holding.weight;
      composition.byAssetClass[assetClass].positions++;

      // By geography
      const country = holding.country || 'unknown';
      if (!composition.byGeography[country]) {
        composition.byGeography[country] = { value: 0, weight: 0, positions: 0 };
      }
      composition.byGeography[country].value += holding.value;
      composition.byGeography[country].weight += holding.weight;
      composition.byGeography[country].positions++;
    });

    // Calculate summary metrics
    const weights = portfolio.holdings.map(h => h.weight);
    composition.summary = {
      totalValue: composition.totalValue,
      numberOfPositions: portfolio.holdings.length,
      averagePosition: composition.totalValue / portfolio.holdings.length,
      largestPosition: Math.max(...weights),
      smallestPosition: Math.min(...weights),
      cashPercentage: portfolio.cash ? (portfolio.cash / (composition.totalValue + (portfolio.cash || 0))) * 100 : 0
    };

    return composition;
  }

  // ============================================================================
  // DIVERSIFICATION ANALYSIS
  // ============================================================================

  /**
   * Calculate diversification metrics
   * @param {Object} portfolio - Portfolio holdings
   * @param {Object} correlations - Correlation matrix
   * @returns {Object} Diversification metrics
   */
  calculateDiversification(portfolio, correlations = null) {
    if (!portfolio || !Array.isArray(portfolio.holdings)) return {};

    const holdings = portfolio.holdings;
    const weights = holdings.map(h => h.weight);

    // Herfindahl Index (concentration)
    const herfindahl = weights.reduce((sum, w) => sum + Math.pow(w, 2), 0);
    const diversificationRatio = 1 / herfindahl;

    // Shannon entropy (diversification measure)
    let entropy = 0;
    weights.forEach(w => {
      if (w > 0) {
        entropy -= w * Math.log(w);
      }
    });

    // Maximum entropy for reference
    const maxEntropy = Math.log(weights.length);
    const normalizedEntropy = entropy / maxEntropy;

    // Number of independent positions
    const numberOfIndependentPositions = Math.exp(entropy);

    // Diversification metrics
    const metrics = {
      herfindahlIndex: herfindahl,
      diversificationRatio: diversificationRatio,
      shannonEntropy: entropy,
      normalizedEntropy: normalizedEntropy,
      numberOfIndependentPositions: numberOfIndependentPositions,
      effectiveDiversification: numberOfIndependentPositions / weights.length,
      largePosCount: weights.filter(w => w > 0.1).length,
      mediumPosCount: weights.filter(w => w > 0.05 && w <= 0.1).length,
      smallPosCount: weights.filter(w => w <= 0.05).length
    };

    // Correlation-adjusted metrics
    if (correlations) {
      let avgCorrelation = 0;
      let corrCount = 0;

      const symbols = holdings.map(h => h.symbol);
      for (let i = 0; i < symbols.length; i++) {
        for (let j = i + 1; j < symbols.length; j++) {
          const corr = correlations[symbols[i]]?.[symbols[j]] || 0;
          if (corr !== 0) {
            avgCorrelation += corr;
            corrCount++;
          }
        }
      }

      metrics.averageCorrelation = corrCount > 0 ? avgCorrelation / corrCount : 0;
      metrics.diversificationBenefit = Math.max(0, 1 - metrics.averageCorrelation);
    }

    return metrics;
  }

  /**
   * Calculate beta-adjusted diversification
   * @param {Array} holdings - Portfolio holdings with betas
   * @returns {Object} Beta diversification metrics
   */
  calculateBetaDiversification(holdings) {
    if (!Array.isArray(holdings) || holdings.length === 0) return {};

    const totalBeta = holdings.reduce((sum, h) => sum + (h.weight * (h.beta || 1)), 0);
    const ideaBeta = holdings.reduce((sum, h) => sum + Math.pow(h.weight * (h.beta || 1), 2), 0);

    const betaDiversification = {
      portfolioBeta: totalBeta,
      betaVariance: ideaBeta,
      betaDispersion: Math.sqrt(ideaBeta - Math.pow(totalBeta, 2)),
      betaConcentration: ideaBeta / Math.pow(totalBeta, 2),
      diversified: ideaBeta < Math.pow(totalBeta, 1.2) // Portfolio is more diversified if variance is lower
    };

    return betaDiversification;
  }

  // ============================================================================
  // LIQUIDITY ANALYSIS
  // ============================================================================

  /**
   * Analyze portfolio liquidity
   * @param {Object} portfolio - Portfolio holdings with liquidity data
   * @returns {Object} Liquidity analysis
   */
  analyzeLiquidity(portfolio) {
    if (!portfolio || !Array.isArray(portfolio.holdings)) return {};

    const holdings = portfolio.holdings;
    const analysis = {
      totalValue: 0,
      liquidValue: 0,
      liquidPercentage: 0,
      byLiquidityTier: {
        highlyLiquid: { value: 0, count: 0, percentage: 0 },
        liquid: { value: 0, count: 0, percentage: 0 },
        moderateLiquid: { value: 0, count: 0, percentage: 0 },
        illiquid: { value: 0, count: 0, percentage: 0 }
      },
      averageBidAskSpread: 0,
      liquidityScore: 0
    };

    let totalSpread = 0;

    holdings.forEach(holding => {
      analysis.totalValue += holding.value;

      const liquidity = holding.liquidity || 'moderate';
      const bidAskSpread = holding.bidAskSpread || 0.001;
      const avgDailyVolume = holding.avgDailyVolume || 0;

      totalSpread += bidAskSpread;

      // Categorize by liquidity
      if (liquidity === 'high' || bidAskSpread < 0.001 || avgDailyVolume > holding.value * 10) {
        analysis.byLiquidityTier.highlyLiquid.value += holding.value;
        analysis.byLiquidityTier.highlyLiquid.count++;
        analysis.liquidValue += holding.value;
      } else if (liquidity === 'medium-high' || bidAskSpread < 0.002) {
        analysis.byLiquidityTier.liquid.value += holding.value;
        analysis.byLiquidityTier.liquid.count++;
        analysis.liquidValue += holding.value * 0.9;
      } else if (liquidity === 'medium' || bidAskSpread < 0.005) {
        analysis.byLiquidityTier.moderateLiquid.value += holding.value;
        analysis.byLiquidityTier.moderateLiquid.count++;
        analysis.liquidValue += holding.value * 0.7;
      } else {
        analysis.byLiquidityTier.illiquid.value += holding.value;
        analysis.byLiquidityTier.illiquid.count++;
        analysis.liquidValue += holding.value * 0.3;
      }
    });

    // Calculate percentages
    Object.keys(analysis.byLiquidityTier).forEach(tier => {
      analysis.byLiquidityTier[tier].percentage = analysis.totalValue > 0
        ? analysis.byLiquidityTier[tier].value / analysis.totalValue
        : 0;
    });

    analysis.liquidPercentage = analysis.totalValue > 0 ? analysis.liquidValue / analysis.totalValue : 0;
    analysis.averageBidAskSpread = holdings.length > 0 ? totalSpread / holdings.length : 0;

    // Liquidity score (0-100)
    analysis.liquidityScore = (analysis.liquidPercentage * 80) +
      ((1 - analysis.averageBidAskSpread * 1000) * 20);

    return analysis;
  }

  /**
   * Calculate time to liquidate analysis
   * @param {Array} holdings - Holdings with volume data
   * @param {number} maxDailyVolumePct - Max percentage of daily volume to trade (default 10%)
   * @returns {Object} Liquidation timeline
   */
  calculateLiquidationTime(holdings, maxDailyVolumePct = 0.1) {
    if (!Array.isArray(holdings) || holdings.length === 0) return {};

    const timeline = {
      totalPositions: holdings.length,
      averageLiquidationDays: 0,
      byPosition: {},
      worstCase: 0
    };

    let totalDays = 0;

    holdings.forEach(holding => {
      const avgDailyVolume = holding.avgDailyVolume || holding.value;
      const shareValue = holding.value;
      const daysToLiquidate = Math.ceil(shareValue / (avgDailyVolume * maxDailyVolumePct));

      timeline.byPosition[holding.symbol] = {
        daysToLiquidate,
        shareValue,
        avgDailyVolume,
        dailyCapacity: avgDailyVolume * maxDailyVolumePct
      };

      totalDays += daysToLiquidate;
      timeline.worstCase = Math.max(timeline.worstCase, daysToLiquidate);
    });

    timeline.averageLiquidationDays = holdings.length > 0 ? totalDays / holdings.length : 0;
    timeline.totalLiquidationDays = timeline.worstCase;

    return timeline;
  }

  // ============================================================================
  // TURNOVER AND REBALANCING ANALYSIS
  // ============================================================================

  /**
   * Calculate portfolio turnover
   * @param {Array} trades - Trading activity
   * @param {number} portfolioValue - Average portfolio value
   * @returns {Object} Turnover metrics
   */
  calculateTurnover(trades, portfolioValue) {
    if (!Array.isArray(trades) || trades.length === 0) return {};

    let buyValue = 0;
    let sellValue = 0;

    trades.forEach(trade => {
      const tradeValue = trade.shares * trade.price;
      if (trade.type === 'buy') {
        buyValue += tradeValue;
      } else if (trade.type === 'sell') {
        sellValue += tradeValue;
      }
    });

    const turnover = Math.min(buyValue, sellValue) / (portfolioValue || 1);
    const annualizedTurnover = turnover * 252 / (trades.length || 1);

    return {
      buyValue,
      sellValue,
      turnover,
      annualizedTurnover,
      tradeCount: trades.length,
      averageTradeSize: (buyValue + sellValue) / (2 * trades.length)
    };
  }

  /**
   * Analyze rebalancing opportunities
   * @param {Object} portfolio - Current portfolio
   * @param {Object} targetAllocation - Target allocation
   * @returns {Object} Rebalancing analysis
   */
  analyzeRebalancing(portfolio, targetAllocation) {
    if (!portfolio || !targetAllocation) return {};

    const analysis = {
      positions: {},
      totalDrift: 0,
      needsRebalancing: false,
      tradesToExecute: []
    };

    const currentAllocation = {};
    portfolio.holdings?.forEach(holding => {
      currentAllocation[holding.symbol] = holding.weight;
    });

    Object.entries(targetAllocation).forEach(([symbol, targetWeight]) => {
      const currentWeight = currentAllocation[symbol] || 0;
      const drift = currentWeight - targetWeight;
      const driftPct = Math.abs(drift);

      analysis.positions[symbol] = {
        currentWeight,
        targetWeight,
        drift,
        driftPercentage: driftPct
      };

      analysis.totalDrift += Math.abs(drift);

      if (driftPct > this.config.rebalanceThreshold) {
        analysis.needsRebalancing = true;

        if (drift > 0) {
          // Need to sell
          analysis.tradesToExecute.push({
            symbol,
            action: 'sell',
            currentWeight,
            targetWeight,
            driftAmount: drift
          });
        } else {
          // Need to buy
          analysis.tradesToExecute.push({
            symbol,
            action: 'buy',
            currentWeight,
            targetWeight,
            driftAmount: Math.abs(drift)
          });
        }
      }
    });

    analysis.rebalancingNeeded = analysis.needsRebalancing;
    analysis.averageDrift = (portfolio.holdings?.length || 1) > 0
      ? analysis.totalDrift / (portfolio.holdings?.length || 1)
      : 0;

    return analysis;
  }

  // ============================================================================
  // PERFORMANCE ATTRIBUTION
  // ============================================================================

  /**
   * Contribution analysis by holding
   * @param {Array} holdings - Holdings with return data
   * @param {number} portfolioReturn - Total portfolio return
   * @returns {Object} Contribution by position
   */
  analyzeHoldingContribution(holdings, portfolioReturn) {
    if (!Array.isArray(holdings) || !portfolioReturn) return {};

    const contribution = {};
    let accumulatedReturn = 0;

    holdings.forEach(holding => {
      const holdingReturn = holding.return || 0;
      const positionContribution = holding.weight * holdingReturn;
      accumulatedReturn += positionContribution;

      contribution[holding.symbol] = {
        weight: holding.weight,
        return: holdingReturn,
        contribution: positionContribution,
        percentageOfTotal: portfolioReturn !== 0 ? positionContribution / portfolioReturn : 0
      };
    });

    return contribution;
  }

  /**
   * Sector contribution analysis
   * @param {Array} holdings - Holdings with sector data
   * @returns {Object} Contribution by sector
   */
  analyzeSectorContribution(holdings) {
    if (!Array.isArray(holdings)) return {};

    const sectorMap = new Map();

    holdings.forEach(holding => {
      const sector = holding.sector || 'uncategorized';
      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, {
          weight: 0,
          return: 0,
          contribution: 0,
          positions: 0
        });
      }

      const sectorData = sectorMap.get(sector);
      sectorData.weight += holding.weight;
      sectorData.return += holding.weight * (holding.return || 0);
      sectorData.contribution += holding.weight * (holding.return || 0);
      sectorData.positions++;
    });

    const contribution = {};
    sectorMap.forEach((data, sector) => {
      contribution[sector] = {
        weight: data.weight,
        avgReturn: data.return / data.weight,
        contribution: data.contribution,
        positions: data.positions
      };
    });

    return contribution;
  }

  // ============================================================================
  // COMPREHENSIVE PORTFOLIO REPORT
  // ============================================================================

  /**
   * Generate comprehensive portfolio analysis report
   * @param {Object} portfolioData - Portfolio data
   * @returns {Object} Complete portfolio report
   */
  generatePortfolioReport(portfolioData) {
    const report = {
      timestamp: new Date(),
      composition: {},
      diversification: {},
      liquidity: {},
      rebalancing: {},
      attribution: {},
      summary: {}
    };

    try {
      // Composition analysis
      if (portfolioData.portfolio) {
        report.composition = this.analyzeComposition(portfolioData.portfolio);
      }

      // Diversification
      if (portfolioData.portfolio) {
        report.diversification = this.calculateDiversification(
          portfolioData.portfolio,
          portfolioData.correlations
        );

        if (portfolioData.portfolio.holdings?.some(h => h.beta)) {
          report.diversification.betaDiversification = this.calculateBetaDiversification(
            portfolioData.portfolio.holdings
          );
        }
      }

      // Liquidity analysis
      if (portfolioData.portfolio) {
        report.liquidity = this.analyzeLiquidity(portfolioData.portfolio);
        report.liquidity.liquidationTime = this.calculateLiquidationTime(
          portfolioData.portfolio.holdings
        );
      }

      // Rebalancing
      if (portfolioData.portfolio && portfolioData.targetAllocation) {
        report.rebalancing = this.analyzeRebalancing(
          portfolioData.portfolio,
          portfolioData.targetAllocation
        );
      }

      // Attribution
      if (portfolioData.portfolio) {
        report.attribution.byHolding = this.analyzeHoldingContribution(
          portfolioData.portfolio.holdings,
          portfolioData.totalReturn || 0
        );
        report.attribution.bySector = this.analyzeSectorContribution(
          portfolioData.portfolio.holdings
        );
      }

      // Turnover
      if (portfolioData.trades) {
        report.turnover = this.calculateTurnover(
          portfolioData.trades,
          portfolioData.portfolio?.totalValue
        );
      }

      this.stats.analysesPerformed++;
      this.stats.lastAnalysis = new Date();

      return report;
    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Portfolio analysis error:', error);
      return report;
    }
  }

  /**
   * Get analytics statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return this.stats;
  }
}

module.exports = GNNPortfolioAnalytics;
