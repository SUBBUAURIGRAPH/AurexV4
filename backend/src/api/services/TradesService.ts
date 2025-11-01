/**
 * Trades Service
 * Database queries for trades and holdings operations
 * @version 1.0.0
 */

import { query } from '../../config/database.js';
import { ApiError, ErrorCodes } from '../../types/index.js';
import type { Trade, Position } from '../../types/index.js';
import config from '../../config/env.js';

/**
 * Trades Service - handles all trade and holding-related database operations
 */
export class TradesService {
  /**
   * Get recent trades for a user (paginated)
   * Maps to: GET /api/v1/trades/recent
   */
  async getRecentTrades(
    userId: string,
    limit: number = config.DEFAULT_PAGE_SIZE,
    offset: number = 0
  ): Promise<Trade[]> {
    // Validate pagination parameters
    if (limit > config.MAX_PAGE_SIZE) {
      limit = config.MAX_PAGE_SIZE;
    }
    if (limit < 1) {
      limit = 1;
    }
    if (offset < 0) {
      offset = 0;
    }

    const result = await query<Trade>(
      `SELECT
        id,
        portfolio_id,
        symbol,
        trade_type,
        status,
        quantity,
        price,
        total,
        signal_type,
        commission,
        notes,
        trade_date,
        executed_at,
        updated_at
      FROM trades
      WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1)
      ORDER BY trade_date DESC, executed_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * Get count of recent trades (for pagination)
   */
  async getRecentTradesCount(userId: string): Promise<number> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*)::int as count
      FROM trades
      WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1)`,
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get current holdings (positions with quantity > 0)
   * Maps to: GET /api/v1/trades/holdings
   */
  async getCurrentHoldings(userId: string): Promise<Position[]> {
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
   * Get details for a specific trade
   * Maps to: GET /api/v1/trades/:tradeId
   */
  async getTradeDetails(userId: string, tradeId: string): Promise<Trade> {
    const result = await query<Trade>(
      `SELECT
        id,
        portfolio_id,
        symbol,
        trade_type,
        status,
        quantity,
        price,
        total,
        signal_type,
        commission,
        notes,
        trade_date,
        executed_at,
        updated_at
      FROM trades
      WHERE id = $1
      AND portfolio_id = (SELECT id FROM portfolios WHERE user_id = $2)`,
      [tradeId, userId]
    );

    if (!result.rows.length) {
      throw new ApiError(
        ErrorCodes.TRADE_NOT_FOUND,
        404,
        `Trade not found with ID ${tradeId}`
      );
    }

    return result.rows[0];
  }

  /**
   * Get trades filtered by status
   */
  async getTradesByStatus(
    userId: string,
    status: 'FILLED' | 'PENDING' | 'CANCELLED',
    limit: number = config.DEFAULT_PAGE_SIZE,
    offset: number = 0
  ): Promise<Trade[]> {
    const result = await query<Trade>(
      `SELECT
        id,
        portfolio_id,
        symbol,
        trade_type,
        status,
        quantity,
        price,
        total,
        signal_type,
        commission,
        notes,
        trade_date,
        executed_at,
        updated_at
      FROM trades
      WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1)
      AND status = $2
      ORDER BY trade_date DESC
      LIMIT $3 OFFSET $4`,
      [userId, status, limit, offset]
    );

    return result.rows;
  }

  /**
   * Get trades filtered by symbol
   */
  async getTradesBySymbol(
    userId: string,
    symbol: string,
    limit: number = config.DEFAULT_PAGE_SIZE,
    offset: number = 0
  ): Promise<Trade[]> {
    const result = await query<Trade>(
      `SELECT
        id,
        portfolio_id,
        symbol,
        trade_type,
        status,
        quantity,
        price,
        total,
        signal_type,
        commission,
        notes,
        trade_date,
        executed_at,
        updated_at
      FROM trades
      WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1)
      AND symbol = $2
      ORDER BY trade_date DESC
      LIMIT $3 OFFSET $4`,
      [userId, symbol.toUpperCase(), limit, offset]
    );

    return result.rows;
  }

  /**
   * Get performance statistics for a user's trades
   */
  async getTradePerformanceStats(userId: string): Promise<{
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalGainLoss: number;
    averageGainLoss: number;
  }> {
    const result = await query<{
      total_trades: string;
      winning_trades: string;
      losing_trades: string;
      total_gain_loss: string;
      avg_gain_loss: string;
    }>(
      `SELECT
        COUNT(*)::int as total_trades,
        COUNT(CASE WHEN gain_loss > 0 THEN 1 END)::int as winning_trades,
        COUNT(CASE WHEN gain_loss < 0 THEN 1 END)::int as losing_trades,
        COALESCE(SUM(gain_loss)::float, 0) as total_gain_loss,
        COALESCE(AVG(gain_loss)::float, 0) as avg_gain_loss
      FROM positions
      WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1)`,
      [userId]
    );

    const row = result.rows[0];
    const totalTrades = parseInt(row.total_trades, 10);
    const winningTrades = parseInt(row.winning_trades, 10);

    return {
      totalTrades,
      winningTrades,
      losingTrades: parseInt(row.losing_trades, 10),
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      totalGainLoss: parseFloat(row.total_gain_loss),
      averageGainLoss: parseFloat(row.avg_gain_loss)
    };
  }

  /**
   * Get closed positions (sold out or fully liquidated)
   */
  async getClosedPositions(
    userId: string,
    limit: number = config.DEFAULT_PAGE_SIZE,
    offset: number = 0
  ): Promise<Position[]> {
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
      AND quantity = 0
      ORDER BY updated_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }
}

export default TradesService;
