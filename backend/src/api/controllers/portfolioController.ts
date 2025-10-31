/**
 * Portfolio Controller
 * Handles portfolio and analytics endpoints
 * @version 1.0.0
 */

import {
  Request,
  Response,
  NextFunction
} from 'express';
import {
  Portfolio,
  Position,
  ApiResponse,
  PaginatedResponse,
  AssetAllocation,
  PerformanceData,
  ApiError,
  ErrorCodes
} from '../../types';
import PortfolioService from '../services/PortfolioService';

/**
 * Extended Request with user context
 */
interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: { id: string; email: string };
}

/**
 * Portfolio Controller Class
 */
export class PortfolioController {
  private portfolioService: PortfolioService;

  constructor() {
    this.portfolioService = new PortfolioService();
  }

  /**
   * GET /api/v1/portfolio/summary
   * Fetch portfolio summary data
   */
  async getPortfolioSummary(
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

      const portfolio = await this.portfolioService.getPortfolioSummary(userId);

      const response: ApiResponse<Portfolio> = {
        success: true,
        data: portfolio
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/portfolio/allocation
   * Fetch asset allocation breakdown
   */
  async getPortfolioAllocation(
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

      const allocation = await this.portfolioService.getPortfolioAllocation(userId);

      const response: ApiResponse<any> = {
        success: true,
        data: allocation
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/portfolio/performance/:period
   * Fetch performance data for specific period
   */
  async getPortfolioPerformance(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId || req.user?.id;
      const { period = '1M' } = req.params;

      if (!userId) {
        throw new ApiError(
          ErrorCodes.UNAUTHORIZED,
          401,
          'User authentication required'
        );
      }

      // Validate period parameter
      const validPeriods = ['1W', '1M', '3M', '1Y', 'ALL'];
      if (!validPeriods.includes(period.toUpperCase())) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          `Invalid period. Must be one of: ${validPeriods.join(', ')}`
        );
      }

      const performanceData = await this.portfolioService.getPortfolioPerformance(
        userId,
        period.toUpperCase()
      );

      const response: ApiResponse<PerformanceData[]> = {
        success: true,
        data: performanceData
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/portfolio/positions/:symbol
   * Fetch specific position details
   */
  async getPositionDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId || req.user?.id;
      const { symbol } = req.params;

      if (!userId) {
        throw new ApiError(
          ErrorCodes.UNAUTHORIZED,
          401,
          'User authentication required'
        );
      }

      if (!symbol) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          'Symbol parameter is required'
        );
      }

      const position = await this.portfolioService.getPositionDetails(userId, symbol);

      const response: ApiResponse<Position> = {
        success: true,
        data: position
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new PortfolioController();
