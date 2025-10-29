/**
 * GNN Risk Analytics - Advanced Risk Decomposition and Analysis
 *
 * Provides sophisticated risk analysis including:
 * - Risk factor decomposition (market risk, factor risk, residual risk)
 * - Correlation and covariance analysis
 * - Stress testing and scenario analysis
 * - Risk metrics decomposition
 * - Tail risk analysis
 * - Risk concentration analysis
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

class GNNRiskAnalytics {
  constructor(analyticsEngine, options = {}) {
    this.analyticsEngine = analyticsEngine;
    this.config = {
      confidenceLevel: options.confidenceLevel || 0.95,
      scenarios: options.scenarios || {},
      minCorrelationDataPoints: options.minCorrelationDataPoints || 20,
      ...options
    };

    this.stats = {
      analysesPerformed: 0,
      errorsEncountered: 0,
      lastAnalysis: null
    };
  }

  // ============================================================================
  // CORRELATION AND COVARIANCE ANALYSIS
  // ============================================================================

  /**
   * Calculate correlation matrix
   * @param {Object} returns - Returns by asset {asset1: [...], asset2: [...], ...}
   * @returns {Object} Correlation matrix
   */
  calculateCorrelationMatrix(returns) {
    const assets = Object.keys(returns);
    if (assets.length < 2) return {};

    const matrix = {};
    const covariances = {};

    // Calculate covariances
    for (let i = 0; i < assets.length; i++) {
      for (let j = i; j < assets.length; j++) {
        const assetI = assets[i];
        const assetJ = assets[j];
        const returnsI = returns[assetI];
        const returnsJ = returns[assetJ];

        if (!Array.isArray(returnsI) || !Array.isArray(returnsJ)) continue;
        if (returnsI.length < this.config.minCorrelationDataPoints) continue;

        const meanI = returnsI.reduce((a, b) => a + b, 0) / returnsI.length;
        const meanJ = returnsJ.reduce((a, b) => a + b, 0) / returnsJ.length;

        let cov = 0;
        let stdDevI = 0;
        let stdDevJ = 0;

        for (let k = 0; k < returnsI.length; k++) {
          cov += (returnsI[k] - meanI) * (returnsJ[k] - meanJ);
          stdDevI += Math.pow(returnsI[k] - meanI, 2);
          stdDevJ += Math.pow(returnsJ[k] - meanJ, 2);
        }

        cov /= returnsI.length;
        stdDevI = Math.sqrt(stdDevI / returnsI.length);
        stdDevJ = Math.sqrt(stdDevJ / returnsJ.length);

        covariances[`${assetI}-${assetJ}`] = {
          covariance: cov,
          stdDevI,
          stdDevJ,
          correlation: (stdDevI > 0 && stdDevJ > 0) ? cov / (stdDevI * stdDevJ) : 0
        };

        if (!matrix[assetI]) matrix[assetI] = {};
        if (!matrix[assetJ]) matrix[assetJ] = {};

        const corr = covariances[`${assetI}-${assetJ}`].correlation;
        matrix[assetI][assetJ] = corr;
        matrix[assetJ][assetI] = corr;
      }
    }

    // Fill diagonal with 1s
    assets.forEach(asset => {
      if (!matrix[asset]) matrix[asset] = {};
      matrix[asset][asset] = 1;
    });

    return { matrix, covariances };
  }

  /**
   * Calculate correlation decay/stability
   * @param {Object} returns - Returns by asset
   * @param {number} window - Rolling window size
   * @returns {Object} Correlation stability metrics
   */
  calculateCorrelationStability(returns, window = 60) {
    const assets = Object.keys(returns);
    if (assets.length < 2) return {};

    const stability = {};

    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const assetI = assets[i];
        const assetJ = assets[j];
        const returnsI = returns[assetI];
        const returnsJ = returns[assetJ];

        if (!Array.isArray(returnsI) || !Array.isArray(returnsJ)) continue;

        const correlations = [];
        for (let k = window; k <= returnsI.length; k++) {
          const windowI = returnsI.slice(k - window, k);
          const windowJ = returnsJ.slice(k - window, k);

          const meanI = windowI.reduce((a, b) => a + b, 0) / windowI.length;
          const meanJ = windowJ.reduce((a, b) => a + b, 0) / windowJ.length;

          let cov = 0;
          let stdDevI = 0;
          let stdDevJ = 0;

          for (let l = 0; l < windowI.length; l++) {
            cov += (windowI[l] - meanI) * (windowJ[l] - meanJ);
            stdDevI += Math.pow(windowI[l] - meanI, 2);
            stdDevJ += Math.pow(windowJ[l] - meanJ, 2);
          }

          cov /= windowI.length;
          stdDevI = Math.sqrt(stdDevI / windowI.length);
          stdDevJ = Math.sqrt(stdDevJ / windowJ.length);

          const correlation = (stdDevI > 0 && stdDevJ > 0) ? cov / (stdDevI * stdDevJ) : 0;
          correlations.push(correlation);
        }

        const avgCorr = correlations.reduce((a, b) => a + b, 0) / correlations.length;
        const corrStdDev = Math.sqrt(
          correlations.reduce((sum, c) => sum + Math.pow(c - avgCorr, 2), 0) / correlations.length
        );

        stability[`${assetI}-${assetJ}`] = {
          averageCorrelation: avgCorr,
          correlationStdDev: corrStdDev,
          trend: correlations[correlations.length - 1] - correlations[0],
          stability: 1 - (corrStdDev / (Math.abs(avgCorr) + 0.001))
        };
      }
    }

    return stability;
  }

  // ============================================================================
  // FACTOR RISK DECOMPOSITION
  // ============================================================================

  /**
   * Decompose risk into factor contributions
   * @param {Object} portfolio - Portfolio holdings
   * @param {Object} factorExposures - Factor exposures by asset
   * @returns {Object} Risk decomposition
   */
  calculateFactorRiskDecomposition(portfolio, factorExposures) {
    if (!portfolio || !factorExposures) return {};

    const decomposition = {
      totalRisk: 0,
      factorRisk: {},
      residualRisk: 0,
      byFactor: {}
    };

    // Calculate portfolio risk from factor exposures
    const factors = new Set();
    Object.values(factorExposures).forEach(exposures => {
      Object.keys(exposures).forEach(f => factors.add(f));
    });

    let totalFactorVariance = 0;
    let totalResidualVariance = 0;

    // Calculate contribution by holding
    portfolio.holdings?.forEach(holding => {
      const exposures = factorExposures[holding.symbol] || {};

      // Factor contribution
      Object.entries(exposures).forEach(([factor, exposure]) => {
        if (!decomposition.byFactor[factor]) {
          decomposition.byFactor[factor] = {
            exposure: 0,
            variance: 0,
            contribution: 0
          };
        }

        const weightedExposure = exposure * holding.weight;
        decomposition.byFactor[factor].exposure += weightedExposure;
      });

      // Residual risk
      const residualRisk = holding.residualRisk || 0;
      totalResidualVariance += Math.pow(residualRisk * holding.weight, 2);
    });

    decomposition.residualRisk = Math.sqrt(totalResidualVariance);

    // Calculate factor risk and total risk
    factors.forEach(factor => {
      const factorData = decomposition.byFactor[factor];
      const factorVol = factorData.exposure;
      totalFactorVariance += Math.pow(factorVol, 2);
      factorData.variance = Math.pow(factorVol, 2);
    });

    decomposition.totalRisk = Math.sqrt(totalFactorVariance + Math.pow(decomposition.residualRisk, 2));

    // Calculate percentages
    const totalVariance = decomposition.totalRisk * decomposition.totalRisk;
    factors.forEach(factor => {
      decomposition.byFactor[factor].percentage = totalVariance > 0
        ? decomposition.byFactor[factor].variance / totalVariance
        : 0;
    });

    decomposition.residualRiskPercentage = totalVariance > 0
      ? Math.pow(decomposition.residualRisk, 2) / totalVariance
      : 0;

    return decomposition;
  }

  /**
   * Calculate style risk decomposition (momentum, value, size, etc.)
   * @param {Object} portfolio - Portfolio holdings
   * @param {Object} styleFactors - Style factors by asset
   * @returns {Object} Style risk breakdown
   */
  calculateStyleRiskDecomposition(portfolio, styleFactors) {
    if (!portfolio || !styleFactors) return {};

    const decomposition = {
      momentum: { exposure: 0, variance: 0 },
      value: { exposure: 0, variance: 0 },
      quality: { exposure: 0, variance: 0 },
      size: { exposure: 0, variance: 0 },
      volatility: { exposure: 0, variance: 0 },
      other: { exposure: 0, variance: 0 }
    };

    portfolio.holdings?.forEach(holding => {
      const styles = styleFactors[holding.symbol] || {};

      Object.entries(styles).forEach(([style, factor]) => {
        if (decomposition[style]) {
          decomposition[style].exposure += factor.exposure * holding.weight;
          decomposition[style].variance += Math.pow(factor.exposure * holding.weight, 2);
        }
      });
    });

    let totalVariance = 0;
    Object.values(decomposition).forEach(style => {
      totalVariance += style.variance;
    });

    Object.values(decomposition).forEach(style => {
      style.percentage = totalVariance > 0 ? style.variance / totalVariance : 0;
    });

    return decomposition;
  }

  // ============================================================================
  // STRESS TESTING AND SCENARIO ANALYSIS
  // ============================================================================

  /**
   * Perform stress test with predefined scenarios
   * @param {Object} portfolio - Portfolio data
   * @param {Object} scenarios - Scenario definitions {name: {shocks: {...}}}
   * @returns {Object} Stress test results
   */
  stressTest(portfolio, scenarios = this.config.scenarios) {
    if (!portfolio || !portfolio.holdings) return {};

    const results = {
      scenarios: {},
      worstCase: null,
      worstCaseImpact: Infinity,
      averageImpact: 0
    };

    const impacts = [];

    Object.entries(scenarios).forEach(([scenarioName, scenarioData]) => {
      let portfolioImpact = 0;

      portfolio.holdings.forEach(holding => {
        const shock = scenarioData.shocks[holding.symbol] || scenarioData.shocks.default || 0;
        const impact = holding.weight * shock;
        portfolioImpact += impact;
      });

      results.scenarios[scenarioName] = {
        shock: scenarioData.shock,
        portfolioImpact,
        priceTarget: (1 + portfolioImpact) * (portfolio.currentValue || 1),
        lossAmount: -portfolioImpact * (portfolio.currentValue || 1)
      };

      impacts.push(Math.abs(portfolioImpact));
      if (portfolioImpact < results.worstCaseImpact) {
        results.worstCaseImpact = portfolioImpact;
        results.worstCase = scenarioName;
      }
    });

    results.averageImpact = impacts.length > 0
      ? impacts.reduce((a, b) => a + b, 0) / impacts.length
      : 0;

    return results;
  }

  /**
   * Perform historical scenario analysis
   * @param {Array} prices - Historical prices
   * @param {Array} timestamps - Corresponding timestamps
   * @param {number} lookback - Number of days to look back
   * @returns {Object} Historical scenarios
   */
  historicalScenarioAnalysis(prices, timestamps, lookback = 252) {
    if (!Array.isArray(prices) || prices.length < lookback) return {};

    const scenarios = {};

    // Find historically significant days
    const returns = [];
    const dates = [];

    for (let i = 1; i < prices.length; i++) {
      const ret = (prices[i] - prices[i - 1]) / prices[i - 1];
      returns.push(ret);
      dates.push(timestamps[i]);
    }

    // Find extreme returns
    const sorted = returns.map((r, i) => ({ return: r, index: i }))
      .sort((a, b) => a.return - b.return);

    const extremeDown = sorted.slice(0, 5);
    const extremeUp = sorted.slice(-5);

    // Create scenarios from extreme days
    extremeDown.forEach((event, i) => {
      scenarios[`Historical_Crash_${i + 1}`] = {
        shock: 'Historical crash scenario',
        shocks: {
          default: event.return
        },
        date: dates[event.index],
        severity: 'high'
      };
    });

    extremeUp.forEach((event, i) => {
      scenarios[`Historical_Rally_${i + 1}`] = {
        shock: 'Historical rally scenario',
        shocks: {
          default: event.return
        },
        date: dates[event.index],
        severity: 'high'
      };
    });

    return { scenarios, extremeReturns: { down: extremeDown, up: extremeUp } };
  }

  /**
   * Monte Carlo value-at-risk estimation
   * @param {Array} returns - Historical returns
   * @param {number} numSimulations - Number of simulations
   * @param {number} horizon - Time horizon (days)
   * @returns {Object} Monte Carlo VaR results
   */
  monteCarloVaR(returns, numSimulations = 10000, horizon = 1) {
    if (!Array.isArray(returns) || returns.length === 0) return {};

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    const simulations = [];

    for (let i = 0; i < numSimulations; i++) {
      let pathReturn = 0;
      for (let j = 0; j < horizon; j++) {
        // Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        pathReturn += mean + stdDev * z;
      }
      simulations.push(pathReturn);
    }

    simulations.sort((a, b) => a - b);

    return {
      var95: simulations[Math.floor(numSimulations * 0.05)],
      var99: simulations[Math.floor(numSimulations * 0.01)],
      mean: simulations.reduce((a, b) => a + b, 0) / simulations.length,
      stdDev: Math.sqrt(simulations.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / simulations.length),
      min: simulations[0],
      max: simulations[simulations.length - 1],
      simulations: simulations.slice(0, 100) // Return sample
    };
  }

  // ============================================================================
  // CONCENTRATION RISK ANALYSIS
  // ============================================================================

  /**
   * Calculate concentration metrics
   * @param {Object} portfolio - Portfolio holdings
   * @returns {Object} Concentration analysis
   */
  calculateConcentrationRisk(portfolio) {
    if (!portfolio || !Array.isArray(portfolio.holdings)) return {};

    const weights = portfolio.holdings.map(h => h.weight);
    const n = weights.length;

    // Herfindahl-Hirschman Index (HHI)
    const hhi = weights.reduce((sum, w) => sum + Math.pow(w, 2), 0);

    // Effective number of positions
    const effectivePositions = 1 / hhi;

    // Concentration ratio (top 10%)
    const sorted = [...weights].sort((a, b) => b - a);
    const topCount = Math.ceil(n * 0.1);
    const concentrationRatio = sorted.slice(0, topCount).reduce((a, b) => a + b, 0);

    // Gini coefficient
    let sumWeightedIndex = 0;
    sorted.forEach((w, i) => {
      sumWeightedIndex += w * (i + 1);
    });
    const gini = (2 * sumWeightedIndex) / (n * weights.reduce((a, b) => a + b, 0)) - (n + 1) / n;

    return {
      herfindahlIndex: hhi,
      effectiveNumberOfPositions: effectivePositions,
      concentrationRatio: concentrationRatio,
      giniCoefficient: gini,
      largestPosition: Math.max(...weights),
      diversificationScore: Math.min(1, effectivePositions / n)
    };
  }

  /**
   * Calculate sector/asset class concentration
   * @param {Object} portfolio - Portfolio with classifications
   * @returns {Object} Concentration by category
   */
  calculateCategoryConcentration(portfolio) {
    if (!portfolio || !Array.isArray(portfolio.holdings)) return {};

    const byCategory = {};

    portfolio.holdings.forEach(holding => {
      const category = holding.sector || holding.assetClass || 'uncategorized';
      if (!byCategory[category]) {
        byCategory[category] = { weight: 0, count: 0 };
      }
      byCategory[category].weight += holding.weight;
      byCategory[category].count++;
    });

    const concentration = {};
    Object.entries(byCategory).forEach(([category, data]) => {
      concentration[category] = {
        weight: data.weight,
        count: data.count,
        avgWeight: data.weight / data.count,
        concentration: Math.pow(data.weight, 2)
      };
    });

    return concentration;
  }

  // ============================================================================
  // TAIL RISK ANALYSIS
  // ============================================================================

  /**
   * Analyze tail risk characteristics
   * @param {Array} returns - Daily returns
   * @returns {Object} Tail risk metrics
   */
  analyzeTailRisk(returns) {
    if (!Array.isArray(returns) || returns.length < 30) return {};

    const sorted = [...returns].sort((a, b) => a - b);
    const n = sorted.length;

    // Calculate tail metrics
    const tail5Pct = sorted.slice(0, Math.ceil(n * 0.05));
    const tail1Pct = sorted.slice(0, Math.ceil(n * 0.01));

    const avgTail5 = tail5Pct.reduce((a, b) => a + b, 0) / tail5Pct.length;
    const avgTail1 = tail1Pct.reduce((a, b) => a + b, 0) / tail1Pct.length;

    // Excess kurtosis (fat tails indicator)
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const std = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length);
    const kurtosis = returns.reduce((sum, r) => sum + Math.pow((r - mean) / std, 4), 0) / returns.length - 3;

    // Skewness
    const skewness = returns.reduce((sum, r) => sum + Math.pow((r - mean) / std, 3), 0) / returns.length;

    return {
      avg5PctTail: avgTail5,
      avg1PctTail: avgTail1,
      excessKurtosis: kurtosis,
      skewness: skewness,
      minReturn: sorted[0],
      maxReturn: sorted[n - 1],
      tailAsymmetry: Math.abs(avgTail5) - Math.abs(tail5Pct[tail5Pct.length - 1]),
      fatTailIndicator: kurtosis > 3 ? 'present' : 'absent'
    };
  }

  // ============================================================================
  // COMPREHENSIVE RISK REPORT
  // ============================================================================

  /**
   * Generate comprehensive risk analysis report
   * @param {Object} riskData - Risk data
   * @returns {Object} Complete risk report
   */
  generateRiskReport(riskData) {
    const report = {
      timestamp: new Date(),
      correlations: {},
      factorRisk: {},
      stressTests: {},
      concentration: {},
      tailRisk: {},
      summary: {}
    };

    try {
      // Correlation analysis
      if (riskData.returns) {
        const corrAnalysis = this.calculateCorrelationMatrix(riskData.returns);
        report.correlations = corrAnalysis;
        report.correlations.stability = this.calculateCorrelationStability(riskData.returns);
      }

      // Factor decomposition
      if (riskData.portfolio && riskData.factorExposures) {
        report.factorRisk.decomposition = this.calculateFactorRiskDecomposition(
          riskData.portfolio,
          riskData.factorExposures
        );
      }

      if (riskData.portfolio && riskData.styleFactors) {
        report.factorRisk.styleDecomposition = this.calculateStyleRiskDecomposition(
          riskData.portfolio,
          riskData.styleFactors
        );
      }

      // Stress testing
      if (riskData.portfolio) {
        report.stressTests = this.stressTest(riskData.portfolio);

        if (riskData.prices && riskData.timestamps) {
          const historicalScenarios = this.historicalScenarioAnalysis(
            riskData.prices,
            riskData.timestamps
          );
          report.stressTests.historical = historicalScenarios;
        }
      }

      // Concentration analysis
      if (riskData.portfolio) {
        report.concentration.positionConcentration = this.calculateConcentrationRisk(riskData.portfolio);
        report.concentration.categoryConcentration = this.calculateCategoryConcentration(riskData.portfolio);
      }

      // Tail risk
      if (riskData.returns) {
        report.tailRisk = this.analyzeTailRisk(riskData.returns);

        if (riskData.returns.length > 30) {
          report.tailRisk.monteCarloVaR = this.monteCarloVaR(riskData.returns);
        }
      }

      this.stats.analysesPerformed++;
      this.stats.lastAnalysis = new Date();

      return report;
    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Risk analysis error:', error);
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

module.exports = GNNRiskAnalytics;
