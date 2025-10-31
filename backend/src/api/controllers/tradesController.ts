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
      const limit = Math.min(parseInt(req.query.limit as string) || 7, 100);
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

      // TODO: Query database for recent trades
      // SELECT * FROM trades WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1) ORDER BY trade_date DESC LIMIT $2 OFFSET $3
      const trades: Trade[] = [
        {
          id: 'trade-1',
          portfolioId: 'portfolio-uuid',
          symbol: 'AAPL',
          type: 'BUY',
          status: 'FILLED',
          quantity: 10,
          price: 175.50,
          total: 1755.00,
          signalType: 'AI',
          commission: 8.77,
          tradeDate: new Date(Date.now() - 3600000),
          executedAt: new Date(Date.now() - 3600000),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'trade-2',
          portfolioId: 'portfolio-uuid',
          symbol: 'GOOGL',
          type: 'SELL',
          status: 'FILLED',
          quantity: 5,
          price: 140.25,
          total: 701.25,
          signalType: 'SIGNAL',
          commission: 3.50,
          tradeDate: new Date(Date.now() - 7200000),
          executedAt: new Date(Date.now() - 7200000),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const response: PaginatedResponse<Trade> = {
        success: true,
        data: trades,
        total: 42,
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

      // TODO: Query database for current holdings
      // SELECT * FROM positions WHERE portfolio_id = (SELECT id FROM portfolios WHERE user_id = $1)
      const holdings: Position[] = [
        {
          id: 'position-1',
          portfolioId: 'portfolio-uuid',
          symbol: 'AAPL',
          quantity: 50,
          entryPrice: 165.00,
          currentPrice: 175.50,
          totalValue: 8775.00,
          gainLoss: 525.00,
          gainLossPercent: 6.36,
          sector: 'Technology',
          riskLevel: 'LOW',
          lastPriceUpdate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'position-2',
          portfolioId: 'portfolio-uuid',
          symbol: 'MSFT',
          quantity: 30,
          entryPrice: 370.00,
          currentPrice: 380.00,
          totalValue: 11400.00,
          gainLoss: 300.00,
          gainLossPercent: 2.70,
          sector: 'Technology',
          riskLevel: 'LOW',
          lastPriceUpdate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      // Calculate totals
      const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
      const totalGainLoss = holdings.reduce((sum, h) => sum + h.gainLoss, 0);
      const totalReturnPercent = (totalGainLoss / (totalValue - totalGainLoss)) * 100;

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

      // TODO: Query database for trade
      // SELECT * FROM trades WHERE id = $1 AND portfolio_id = (SELECT id FROM portfolios WHERE user_id = $2)
      const trade: Trade = {
        id: tradeId,
        portfolioId: 'portfolio-uuid',
        symbol: 'AAPL',
        type: 'BUY',
        status: 'FILLED',
        quantity: 10,
        price: 175.50,
        total: 1755.00,
        signalType: 'AI',
        commission: 8.77,
        notes: 'Strong buy signal detected by AI algorithm',
        tradeDate: new Date(),
        executedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

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
