/**
 * Portfolio Service
 * Database queries for portfolio operations
 * @version 1.0.0
 */

import { query } from '../../config/database';
import { ApiError, ErrorCodes } from '../../types/index';
import type {
  Portfolio,
  Position,
  AssetAllocation,
  PerformanceData
} from '../../types/index';

/**
 * Portfolio Service - handles all portfolio-related database operations
 */
export class PortfolioService {
  /**
   * Get portfolio summary for a user
   * Maps to: GET /api/v1/portfolio/summary
   */
  async getPortfolioSummary(userId: string): Promise<Portfolio> {
    const result = await query<Portfolio>(
      `SELECT
        id,
        user_id,
        total_value,
        available_balance,
        cash,
        today_return,
        ytd_return,
        total_gain_loss,
        total_gain_loss_percent,
        market_status,
        ai_risk_score,
        currency,
        updated_at
      FROM portfolios
      WHERE user_id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      throw new ApiError(
        ErrorCodes.PORTFOLIO_NOT_FOUND,
        404,
        'Portfolio not found for this user'
      );
    }

    return result.rows[0];
  }

  /**
   * Get portfolio allocation breakdown
   * Maps to: GET /api/v1/portfolio/allocation
   */
  async getPortfolioAllocation(userId: string): Promise<AssetAllocation> {
    // First get the portfolio ID
    const portfolioResult = await query<{ id: string }>(
      'SELECT id FROM portfolios WHERE user_id = $1',
      [userId]
    );

    if (!portfolioResult.rows.length) {
      throw new ApiError(
        ErrorCodes.PORTFOLIO_NOT_FOUND,
        404,
        'Portfolio not found'
      );
    }

    const portfolioId = portfolioResult.rows[0].id;

    // Get allocation by sector/category
    const result = await query<{
      sector: string;
      total_value: string;
      percentage: string;
    }>(
      `SELECT
        sector,
        SUM(total_value)::float as total_value,
        ROUND((SUM(total_value) / (
          SELECT SUM(total_value) FROM positions WHERE portfolio_id = $1
        ) * 100)::numeric, 2)::float as percentage
      FROM positions
      WHERE portfolio_id = $1 AND quantity > 0
      GROUP BY sector
      ORDER BY total_value DESC`,
      [portfolioId]
    );

    if (!result.rows.length) {
      return {
        allocations: [],
        rebalancingSuggestions: [],
        lastUpdated: new Date().toISOString()
      };
    }

    return {
      allocations: result.rows.map(row => ({
        category: row.sector,
        percentage: parseFloat(row.percentage),
        value: parseFloat(row.total_value)
      })),
      rebalancingSuggestions: this.generateRebalancingSuggestions(
        result.rows.map(row => ({
          category: row.sector,
          percentage: parseFloat(row.percentage)
        }))
      ),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get portfolio performance for a specified period
   * Maps to: GET /api/v1/portfolio/performance/:period
   */
  async getPortfolioPerformance(
    userId: string,
    period: string
  ): Promise<PerformanceData[]> {
    // Map period string to days
    const periodDays: Record<string, number> = {
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '1Y': 365,
      'ALL': 3650
    };

    const days = periodDays[period] || 30;

    const result = await query<PerformanceData>(
      `SELECT
        date::date as date,
        ROUND(value::numeric, 2)::float as value,
        ROUND(change_percent::numeric, 2)::float as change_percent,
        ROUND((
          (value - LAG(value) OVER (ORDER BY date)) /
          LAG(value) OVER (ORDER BY date) * 100
        )::numeric, 2)::float as daily_change
      FROM portfolio_performance
      WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1)
      AND date >= CURRENT_DATE - INTERVAL '1 day' * $2
      ORDER BY date ASC`,
      [userId, days]
    );

    // If no performance data exists, generate sample data
    if (!result.rows.length) {
      return this.generateSamplePerformanceData(days);
    }

    return result.rows;
  }

  /**
   * Get details for a specific position
   * Maps to: GET /api/v1/portfolio/positions/:symbol
   */
  async getPositionDetails(userId: string, symbol: string): Promise<Position> {
    const result = await query<Position>(
      `SELECT
        id,
        portfolio_id,
        symbol,
        quantity,
        entry_price,
        current_price,
        total_value,
        gain_loss,
        gain_loss_percent,
        sector,
        risk_level,
        last_price_update,
        updated_at
      FROM positions
      WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1)
      AND symbol = $2`,
      [userId, symbol.toUpperCase()]
    );

    if (!result.rows.length) {
      throw new ApiError(
        ErrorCodes.POSITION_NOT_FOUND,
        404,
        `Position not found for symbol ${symbol}`
      );
    }

    return result.rows[0];
  }

  /**
   * Get all positions for a user (internal use)
   */
  async getPositions(userId: string): Promise<Position[]> {
    const result = await query<Position>(
      `SELECT
        id,
        portfolio_id,
        symbol,
        quantity,
        entry_price,
        current_price,
        total_value,
        gain_loss,
        gain_loss_percent,
        sector,
        risk_level,
        last_price_update,
        updated_at
      FROM positions
      WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1)
      AND quantity > 0
      ORDER BY total_value DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Generate rebalancing suggestions based on allocation
   */
  private generateRebalancingSuggestions(
    allocations: Array<{ category: string; percentage: number }>
  ): string[] {
    const suggestions: string[] = [];
    const targetAllocations: Record<string, number> = {
      'US Equities': 45,
      'International': 20,
      'Bonds': 20,
      'Cash': 15
    };

    for (const allocation of allocations) {
      const target = targetAllocations[allocation.category] || 20;
      const diff = Math.abs(allocation.percentage - target);

      if (diff > 5) {
        if (allocation.percentage > target) {
          suggestions.push(
            `Consider reducing ${allocation.category} from ${allocation.percentage.toFixed(1)}% to ${target}%`
          );
        } else {
          suggestions.push(
            `Consider increasing ${allocation.category} from ${allocation.percentage.toFixed(1)}% to ${target}%`
          );
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate sample performance data for demo purposes
   */
  private generateSamplePerformanceData(days: number): PerformanceData[] {
    const data: PerformanceData[] = [];
    const baseValue = 100000;
    let currentValue = baseValue;

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      // Random walk for realistic looking data
      const change = (Math.random() - 0.48) * 2000;
      currentValue = Math.max(currentValue + change, baseValue * 0.8);

      data.push({
        date: date.toISOString().split('T')[0],
        value: parseFloat(currentValue.toFixed(2)),
        change_percent: parseFloat(
          (((currentValue - baseValue) / baseValue) * 100).toFixed(2)
        ),
        daily_change: parseFloat((((change) / currentValue) * 100).toFixed(2))
      });
    }

    return data;
  }
}

export default PortfolioService;
