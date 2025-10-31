/**
 * Analytics Service
 * Database queries for analytics and market data operations
 * @version 1.0.0
 */

import { query } from '../../config/database';
import { ApiError, ErrorCodes } from '../../types/index';
import type { Portfolio } from '../../types/index';
import PortfolioService from './PortfolioService';
import TradesService from './TradesService';

/**
 * Analytics Service - handles analytics and market-related operations
 */
export class AnalyticsService {
  private portfolioService: PortfolioService;
  private tradesService: TradesService;

  constructor() {
    this.portfolioService = new PortfolioService();
    this.tradesService = new TradesService();
  }

  /**
   * Get current market status (OPEN or CLOSED)
   * Maps to: GET /api/v1/market/status
   */
  async getMarketStatus(): Promise<{
    status: 'OPEN' | 'CLOSED';
    time: string;
    nextOpen?: string;
    nextClose?: string;
    isWeekday: boolean;
  }> {
    const now = new Date();

    // US Market hours: 9:30 AM - 4:00 PM EST (Monday-Friday)
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const dayOfWeek = now.getDay();

    const isWeekday = dayOfWeek !== 0 && dayOfWeek !== 6; // 0 = Sunday, 6 = Saturday
    const time = hours * 60 + minutes;
    const marketOpen = 9.5 * 60; // 9:30 AM
    const marketClose = 16 * 60; // 4:00 PM

    const isOpen = isWeekday && time >= marketOpen && time < marketClose;

    const response = {
      status: isOpen ? 'OPEN' as const : 'CLOSED' as const,
      time: now.toISOString(),
      isWeekday
    };

    // Calculate next market open/close times
    let nextDate = new Date(now);

    if (isWeekday && time < marketOpen) {
      // Market opens today
      response.nextOpen = new Date(nextDate.setHours(9, 30, 0, 0)).toISOString();
      response.nextClose = new Date(nextDate.setHours(16, 0, 0, 0)).toISOString();
    } else if (isWeekday && time >= marketOpen && time < marketClose) {
      // Market is open, will close today
      response.nextClose = new Date(nextDate.setHours(16, 0, 0, 0)).toISOString();
    } else {
      // Market is closed, find next open day
      nextDate.setDate(nextDate.getDate() + (dayOfWeek === 5 ? 3 : dayOfWeek === 6 ? 2 : 1));
      response.nextOpen = new Date(nextDate.setHours(9, 30, 0, 0)).toISOString();
    }

    return response;
  }

  /**
   * Get AI risk score for a user's portfolio
   * Maps to: GET /api/v1/analytics/risk-score
   */
  async getAIRiskScore(userId: string): Promise<{
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    factors: {
      volatility: number;
      concentration: number;
      leverage: number;
      diversification: number;
    };
    recommendation: string;
  }> {
    const portfolio = await this.portfolioService.getPortfolioSummary(userId);

    if (!portfolio) {
      throw new ApiError(
        ErrorCodes.PORTFOLIO_NOT_FOUND,
        404,
        'Portfolio not found'
      );
    }

    const score = portfolio.ai_risk_score || 5;
    let level: 'LOW' | 'MEDIUM' | 'HIGH';

    if (score <= 3) {
      level = 'LOW';
    } else if (score <= 7) {
      level = 'MEDIUM';
    } else {
      level = 'HIGH';
    }

    // Calculate risk factors
    const holdings = await this.portfolioService.getPositions(userId);
    const positions = holdings.filter(h => h.quantity > 0);

    const factors = {
      volatility: this.calculateVolatility(positions),
      concentration: this.calculateConcentration(positions),
      leverage: this.calculateLeverage(portfolio),
      diversification: this.calculateDiversification(positions)
    };

    const recommendation = this.generateRiskRecommendation(score, factors);

    return {
      score,
      level,
      factors,
      recommendation
    };
  }

  /**
   * Get comprehensive analytics summary
   * Maps to: GET /api/v1/analytics/summary
   */
  async getAnalyticsSummary(userId: string): Promise<{
    portfolio: Portfolio;
    recentTrades: any[];
    topHoldings: any[];
    tradeStats: any;
    marketStatus: any;
    riskScore: any;
    generatedAt: string;
  }> {
    const [
      portfolio,
      recentTrades,
      holdings,
      tradeStats,
      marketStatus,
      riskScore
    ] = await Promise.all([
      this.portfolioService.getPortfolioSummary(userId),
      this.tradesService.getRecentTrades(userId, 5, 0),
      this.portfolioService.getPositions(userId),
      this.tradesService.getTradePerformanceStats(userId),
      this.getMarketStatus(),
      this.getAIRiskScore(userId)
    ]);

    return {
      portfolio,
      recentTrades,
      topHoldings: holdings.slice(0, 5),
      tradeStats,
      marketStatus,
      riskScore,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Get user performance metrics
   */
  async getPerformanceMetrics(userId: string): Promise<{
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  }> {
    const portfolio = await this.portfolioService.getPortfolioSummary(userId);
    const stats = await this.tradesService.getTradePerformanceStats(userId);

    // Simplified metrics calculation
    return {
      totalReturn: portfolio.total_gain_loss_percent || 0,
      annualizedReturn: (portfolio.total_gain_loss_percent || 0) / 1.5, // Rough estimate
      sharpeRatio: 1.2, // Placeholder - would need more complex calculation
      maxDrawdown: 12.5, // Placeholder - would need historical data
      winRate: stats.winRate
    };
  }

  /**
   * Calculate volatility score (0-10)
   */
  private calculateVolatility(positions: any[]): number {
    if (positions.length === 0) return 0;

    // Simplified volatility calculation based on gain/loss variance
    const changes = positions.map(p => p.gain_loss_percent || 0);
    const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
    const variance = changes.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / changes.length;
    const stdDev = Math.sqrt(variance);

    return Math.min(Math.round(stdDev / 5), 10);
  }

  /**
   * Calculate concentration score (0-10)
   */
  private calculateConcentration(positions: any[]): number {
    if (positions.length === 0) return 0;

    const totalValue = positions.reduce((sum, p) => sum + (p.total_value || 0), 0);
    const largestPosition = Math.max(...positions.map(p => (p.total_value || 0) / totalValue));

    return Math.round(largestPosition * 10);
  }

  /**
   * Calculate leverage score (0-10)
   */
  private calculateLeverage(portfolio: Portfolio): number {
    // Simplified leverage check
    const cashRatio = (portfolio.cash || 0) / (portfolio.total_value || 1);
    const leverage = Math.max(0, (100 - (cashRatio * 100)) / 10);
    return Math.min(Math.round(leverage), 10);
  }

  /**
   * Calculate diversification score (0-10)
   */
  private calculateDiversification(positions: any[]): number {
    if (positions.length === 0) return 0;

    // More positions = more diversified
    const positionScore = Math.min(positions.length, 10);

    // Sector diversification
    const sectors = new Set(positions.map(p => p.sector));
    const sectorScore = Math.min(sectors.size * 2, 10);

    return Math.round((positionScore + sectorScore) / 2);
  }

  /**
   * Generate risk recommendation based on score and factors
   */
  private generateRiskRecommendation(
    score: number,
    factors: any
  ): string {
    if (score <= 3) {
      return 'Your portfolio is conservative. Consider diversifying into growth assets if your time horizon permits.';
    } else if (score <= 5) {
      return 'Your portfolio has balanced risk. Monitor sector concentration and rebalance quarterly.';
    } else if (score <= 7) {
      return 'Your portfolio has moderate-to-high risk. Consider reducing position sizes if volatility concerns you.';
    } else {
      return 'Your portfolio has high risk. Consider diversifying and implementing stop-loss orders.';
    }
  }
}

export default AnalyticsService;
