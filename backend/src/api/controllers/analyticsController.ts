/**
 * Analytics Controller
 * Handles analytics and market data endpoints
 * @version 1.0.0
 */

import {
  Request,
  Response,
  NextFunction
} from 'express';
import {
  ApiResponse,
  ApiError,
  ErrorCodes
} from '../../types/index.js';
import AnalyticsService from '../services/AnalyticsService.js';

/**
 * Extended Request with user context
 */
interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: { id: string; email: string };
}

/**
 * Analytics Controller Class
 */
export class AnalyticsController {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }
  /**
   * GET /api/v1/market/status
   * Fetch current market status
   */
  async getMarketStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const marketStatus = await this.analyticsService.getMarketStatus();

      const response: ApiResponse<any> = {
        success: true,
        data: marketStatus
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/analytics/risk-score
   * Fetch AI risk score analysis
   */
  async getAIRiskScore(
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

      const riskData = await this.analyticsService.getAIRiskScore(userId);

      const response: ApiResponse<any> = {
        success: true,
        data: riskData
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/analytics/summary
   * Fetch complete analytics summary
   */
  async getAnalyticsSummary(
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

      const summary = await this.analyticsService.getAnalyticsSummary(userId);

      const response: ApiResponse<any> = {
        success: true,
        data: summary
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new AnalyticsController();
