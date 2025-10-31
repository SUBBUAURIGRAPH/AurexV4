/**
 * Portfolio Analytics Analyzer
 * Calculates portfolio-level metrics, allocation, and diversification
 * @version 1.0.0
 */

import {
  PortfolioAnalytics,
  AssetAllocation,
  DiversificationMetrics
} from './types';

export class PortfolioAnalyzer {
  /**
   * Calculate portfolio analytics
   */
  static calculatePortfolioAnalytics(
    userId: string,
    positions: Array<{ symbol: string; quantity: number; currentPrice: number }>,
    cashBalance: number,
    historicalData?: Array<{ date: Date; value: number }>
  ): Partial<PortfolioAnalytics> {
    const allocation = this.calculateAllocation(positions, cashBalance);
    const totalValue = this.calculateTotalValue(positions, cashBalance);
    const investedValue = this.calculateInvestedValue(positions);

    const diversification = this.calculateDiversification(allocation);

    return {
      userId,
      timestamp: new Date(),
      totalValue,
      cashBalance,
      investedValue,
      allocation: allocation.assets,
      numberOfPositions: allocation.assets.length,
      concentrationIndex: diversification.concentrationIndex,
      largestPositionPct: diversification.largestPosition,
      diversificationRatio: diversification.diversificationRatio,
      avgCorrelation: this.estimateAverageCorrelation(allocation.assets),
      portfolioReturn: historicalData
        ? this.calculatePortfolioReturn(historicalData)
        : undefined,
      portfolioVolatility: historicalData
        ? this.calculatePortfolioVolatility(historicalData)
        : undefined
    };
  }

  /**
   * Calculate asset allocation
   */
  static calculateAllocation(
    positions: Array<{ symbol: string; quantity: number; currentPrice: number }>,
    cashBalance: number
  ): {
    assets: AssetAllocation[];
    totalValue: number;
  } {
    const allocation: AssetAllocation[] = [];
    let totalAssetValue = 0;

    for (const position of positions) {
      const value = position.quantity * position.currentPrice;
      totalAssetValue += value;
      allocation.push({
        symbol: position.symbol,
        value: value,
        quantity: position.quantity,
        percentage: 0 // Will be calculated below
      });
    }

    const totalValue = totalAssetValue + cashBalance;

    // Calculate percentages
    for (const asset of allocation) {
      asset.percentage = totalValue > 0 ? asset.value / totalValue : 0;
    }

    return { assets: allocation, totalValue };
  }

  /**
   * Calculate total portfolio value
   */
  static calculateTotalValue(
    positions: Array<{ symbol: string; quantity: number; currentPrice: number }>,
    cashBalance: number
  ): number {
    const investedValue = positions.reduce(
      (sum, p) => sum + p.quantity * p.currentPrice,
      0
    );
    return investedValue + cashBalance;
  }

  /**
   * Calculate invested value (excluding cash)
   */
  static calculateInvestedValue(
    positions: Array<{ symbol: string; quantity: number; currentPrice: number }>
  ): number {
    return positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);
  }

  /**
   * Calculate diversification metrics
   */
  static calculateDiversification(allocation: {
    assets: AssetAllocation[];
    totalValue: number;
  }): DiversificationMetrics {
    const weights = allocation.assets.map(a => a.percentage);

    // Herfindahl Index (sum of squared weights)
    const herfindahlIndex = weights.reduce((sum, w) => sum + w * w, 0);

    // Concentration Index (1 - Herfindahl)
    const concentrationIndex = 1 - herfindahlIndex;

    // Largest position
    const largestPosition = Math.max(...weights, 0);

    // Top 3 concentration
    const topThree = weights
      .sort((a, b) => b - a)
      .slice(0, 3)
      .reduce((sum, w) => sum + w, 0);

    // Diversification Ratio = Average Weight / Herfindahl
    const numAssets = allocation.assets.length;
    const avgWeight = numAssets > 0 ? 1 / numAssets : 0;
    const diversificationRatio =
      herfindahlIndex > 0
        ? avgWeight / Math.sqrt(herfindahlIndex)
        : 0;

    return {
      concentrationIndex,
      herfindahlIndex,
      diversificationRatio,
      numberOfPositions: allocation.assets.length,
      largestPosition,
      topThreeConcentration: topThree
    };
  }

  /**
   * Calculate portfolio return
   */
  static calculatePortfolioReturn(
    historicalData: Array<{ date: Date; value: number }>
  ): number {
    if (historicalData.length < 2) return 0;

    const startValue = historicalData[0].value;
    const endValue = historicalData[historicalData.length - 1].value;

    if (startValue === 0) return 0;
    return (endValue - startValue) / startValue;
  }

  /**
   * Calculate portfolio volatility
   */
  static calculatePortfolioVolatility(
    historicalData: Array<{ date: Date; value: number }>
  ): number {
    if (historicalData.length < 2) return 0;

    const returns = historicalData.slice(1).map((d, i) => {
      const prev = historicalData[i];
      if (prev.value === 0) return 0;
      return (d.value - prev.value) / prev.value;
    });

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      returns.length;

    return Math.sqrt(variance);
  }

  /**
   * Estimate average correlation between assets
   * Uses sector/asset class proximity as proxy
   */
  static estimateAverageCorrelation(assets: AssetAllocation[]): number {
    if (assets.length < 2) return 0;

    // Simple heuristic: Similar symbols tend to be correlated
    // In production, this would be calculated from historical price data
    const correlations: number[] = [];

    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        // Default assumption: moderate positive correlation
        // Real implementation would calculate this from returns
        const corr = 0.6; // Placeholder value
        correlations.push(corr);
      }
    }

    if (correlations.length === 0) return 0;
    return correlations.reduce((a, b) => a + b, 0) / correlations.length;
  }

  /**
   * Calculate Sharpe ratio for portfolio
   */
  static calculatePortfolioSharpeRatio(
    portfolioReturn: number,
    volatility: number,
    riskFreeRate: number = 0.02
  ): number {
    if (volatility === 0) return 0;
    return (portfolioReturn - riskFreeRate) / volatility;
  }

  /**
   * Calculate portfolio beta
   * Simplified: weighted beta of holdings
   */
  static calculatePortfolioBeta(
    holdings: Array<{
      symbol: string;
      weight: number;
      beta: number;
    }>
  ): number {
    return holdings.reduce((sum, h) => sum + h.weight * h.beta, 0);
  }

  /**
   * Calculate portfolio alpha
   * Simplified: weighted alpha of holdings
   */
  static calculatePortfolioAlpha(
    holdings: Array<{
      symbol: string;
      weight: number;
      alpha: number;
    }>
  ): number {
    return holdings.reduce((sum, h) => sum + h.weight * h.alpha, 0);
  }

  /**
   * Get asset class breakdown
   */
  static getAssetClassBreakdown(
    assets: AssetAllocation[]
  ): {
    [assetClass: string]: number;
  } {
    const breakdown: { [key: string]: number } = {
      STOCKS: 0,
      BONDS: 0,
      CRYPTO: 0,
      COMMODITIES: 0,
      CASH: 0
    };

    for (const asset of assets) {
      const symbol = asset.symbol.toUpperCase();

      if (symbol.includes('BTC') || symbol.includes('ETH')) {
        breakdown.CRYPTO += asset.percentage;
      } else if (symbol.includes('BOND') || symbol.includes('TLT')) {
        breakdown.BONDS += asset.percentage;
      } else if (symbol.includes('GLD') || symbol.includes('GOLD')) {
        breakdown.COMMODITIES += asset.percentage;
      } else {
        breakdown.STOCKS += asset.percentage;
      }
    }

    return breakdown;
  }

  /**
   * Get sector breakdown (simplified)
   */
  static getSectorBreakdown(
    assets: AssetAllocation[]
  ): {
    [sector: string]: number;
  } {
    const breakdown: { [key: string]: number } = {};

    for (const asset of assets) {
      const symbol = asset.symbol.toUpperCase();

      // Simple heuristic based on symbol patterns
      let sector = 'OTHER';

      if (['AAPL', 'MSFT', 'GOOGL', 'META'].includes(symbol)) {
        sector = 'TECHNOLOGY';
      } else if (['JNJ', 'PFE', 'ABBV'].includes(symbol)) {
        sector = 'HEALTHCARE';
      } else if (['JPM', 'GS', 'BAC'].includes(symbol)) {
        sector = 'FINANCE';
      } else if (['XOM', 'CVX'].includes(symbol)) {
        sector = 'ENERGY';
      }

      breakdown[sector] = (breakdown[sector] || 0) + asset.percentage;
    }

    return breakdown;
  }

  /**
   * Identify portfolio risk factors
   */
  static identifyRiskFactors(
    assets: AssetAllocation[],
    diversification: DiversificationMetrics
  ): string[] {
    const risks: string[] = [];

    // Check concentration risk
    if (diversification.largestPosition > 0.4) {
      risks.push('HIGH_CONCENTRATION: Largest position > 40%');
    }

    if (diversification.topThreeConcentration > 0.7) {
      risks.push('CONCENTRATION_RISK: Top 3 positions > 70%');
    }

    // Check diversification
    if (diversification.numberOfPositions < 3) {
      risks.push('LOW_DIVERSIFICATION: Less than 3 positions');
    }

    // Check for single stock exposure
    const largePositions = assets.filter(a => a.percentage > 0.25);
    if (largePositions.length > 2) {
      risks.push('MULTIPLE_LARGE_POSITIONS: Multiple positions > 25%');
    }

    return risks;
  }

  /**
   * Calculate portfolio rebalancing recommendations
   */
  static getRebalancingRecommendations(
    currentAllocation: AssetAllocation[],
    targetAllocation: { [symbol: string]: number }
  ): Array<{
    symbol: string;
    current: number;
    target: number;
    action: 'BUY' | 'SELL' | 'HOLD';
    percentage: number;
  }> {
    const recommendations = [];

    for (const [symbol, targetPct] of Object.entries(targetAllocation)) {
      const current = currentAllocation.find(a => a.symbol === symbol);
      const currentPct = current?.percentage || 0;
      const difference = targetPct - currentPct;

      if (Math.abs(difference) > 0.01) {
        // 1% threshold
        recommendations.push({
          symbol,
          current: currentPct,
          target: targetPct,
          action: difference > 0 ? 'BUY' : 'SELL',
          percentage: Math.abs(difference)
        });
      } else {
        recommendations.push({
          symbol,
          current: currentPct,
          target: targetPct,
          action: 'HOLD',
          percentage: 0
        });
      }
    }

    return recommendations.sort(
      (a, b) => b.percentage - a.percentage
    );
  }

  /**
   * Calculate portfolio correlation matrix
   * Simplified for demonstration
   */
  static calculateCorrelationMatrix(
    assets: AssetAllocation[],
    historicalReturns?: {
      [symbol: string]: number[];
    }
  ): { [key: string]: { [key: string]: number } } {
    const matrix: { [key: string]: { [key: string]: number } } = {};

    for (const asset1 of assets) {
      matrix[asset1.symbol] = {};
      for (const asset2 of assets) {
        if (asset1.symbol === asset2.symbol) {
          matrix[asset1.symbol][asset2.symbol] = 1.0;
        } else {
          // Placeholder correlation (0.5 as default)
          // In production, calculate from historical returns
          matrix[asset1.symbol][asset2.symbol] = 0.5;
        }
      }
    }

    return matrix;
  }
}
