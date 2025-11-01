/**
 * Trades Controller
 * Handles trade and holdings endpoints
 * @version 1.0.0
 */

import {
  Request,
  Response,
  NextFunction
} from 'express';
import {
  Trade,
  Position,
  PaginatedResponse,
  ApiResponse,
  ApiError,
  ErrorCodes
} from '../../types';
import TradesService from '../services/TradesService';

/**
 * Extended Request with user context
 */
interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: { id: string; email: string };
}

/**
 * Trades Controller Class
 */
export class TradesController {
  private tradesService: TradesService;

  constructor() {
    this.tradesService = new TradesService();
  }
  /**
   * GET /api/v1/trades/recent
   * Fetch recent trades with pagination
   */
  async getRecentTrades(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId || req.user?.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      if (!userId) {
        throw new ApiError(
          ErrorCodes.UNAUTHORIZED,
          401,
          'User authentication required'
        );
      }

      if (limit < 1 || offset < 0) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          'Invalid limit or offset parameters'
        );
      }

      const [trades, total] = await Promise.all([
        this.tradesService.getRecentTrades(userId, limit, offset),
        this.tradesService.getRecentTradesCount(userId)
      ]);

      const response: PaginatedResponse<Trade> = {
        success: true,
        data: trades,
        total,
        limit,
        offset
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/trades/holdings
   * Fetch current portfolio holdings
   */
  async getCurrentHoldings(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId || req.user?.id;

      if (!userId) {
        throw new ApiError(
          ErrorCodes.UNAUTHORIZED,
          401,
          'User authentication required'
        );
      }

      const holdings = await this.tradesService.getCurrentHoldings(userId);

      // Calculate totals
      const totalValue = holdings.reduce((sum, h) => sum + (h.totalValue || 0), 0);
      const totalGainLoss = holdings.reduce((sum, h) => sum + (h.gainLoss || 0), 0);
      const totalReturnPercent = totalValue > 0 ? (totalGainLoss / (totalValue - totalGainLoss)) * 100 : 0;

      const response: ApiResponse<any> = {
        success: true,
        data: {
          holdings,
          totalValue,
          totalGainLoss,
          totalReturnPercent,
          positionCount: holdings.length
        }
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/trades/:tradeId
   * Fetch specific trade details
   */
  async getTradeDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId || req.user?.id;
      const { tradeId } = req.params;

      if (!userId) {
        throw new ApiError(
          ErrorCodes.UNAUTHORIZED,
          401,
          'User authentication required'
        );
      }

      if (!tradeId) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          'Trade ID is required'
        );
      }

      const trade = await this.tradesService.getTradeDetails(userId, tradeId);

      const response: ApiResponse<Trade> = {
        success: true,
        data: trade
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new TradesController();
