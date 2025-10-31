/**
 * Analytics API Routes
 * 15+ REST endpoints for analytics operations
 * @version 1.0.0
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analyticsService';
import {
  AlertType,
  AlertLevel,
  AnalyticsQuery,
  AnalyticsResponse
} from '../../analytics';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

export class AnalyticsRouter {
  private router: Router;
  private service: AnalyticsService;

  constructor(service?: AnalyticsService) {
    this.router = Router();
    this.service = service || new AnalyticsService();
    this.setupRoutes();
  }

  /**
   * Setup all routes
   */
  private setupRoutes(): void {
    // Middleware
    this.router.use(this.authenticateUser.bind(this));
    this.router.use(this.requestLogger.bind(this));

    // Performance Metrics Endpoints
    this.router.get(
      '/performance',
      this.getPerformanceMetrics.bind(this)
    );
    this.router.get(
      '/performance/:strategyId',
      this.getStrategyPerformance.bind(this)
    );

    // Portfolio Endpoints
    this.router.get(
      '/portfolio',
      this.getPortfolioAnalytics.bind(this)
    );
    this.router.get(
      '/portfolio/allocation',
      this.getPortfolioAllocation.bind(this)
    );
    this.router.get(
      '/portfolio/diversification',
      this.getPortfolioDiversification.bind(this)
    );

    // Risk Metrics Endpoints
    this.router.get(
      '/risk',
      this.getRiskMetrics.bind(this)
    );
    this.router.get(
      '/risk/:strategyId',
      this.getStrategyRisk.bind(this)
    );

    // Trade Analysis Endpoints
    this.router.get(
      '/trades/statistics',
      this.getTradeStatistics.bind(this)
    );
    this.router.get(
      '/trades/:tradeId',
      this.getTrade.bind(this)
    );

    // Alert Endpoints
    this.router.get(
      '/alerts',
      this.getAlerts.bind(this)
    );
    this.router.post(
      '/alerts/:alertId/acknowledge',
      this.acknowledgeAlert.bind(this)
    );

    // Daily Snapshot Endpoints
    this.router.get(
      '/snapshots',
      this.getDailySnapshots.bind(this)
    );
    this.router.get(
      '/snapshots/:strategyId',
      this.getStrategySnapshots.bind(this)
    );

    // Summary & Comparison Endpoints
    this.router.get(
      '/summary',
      this.getAnalyticsSummary.bind(this)
    );
    this.router.get(
      '/compare',
      this.getComparativeAnalysis.bind(this)
    );

    // Configuration Endpoints
    this.router.get(
      '/config',
      this.getConfiguration.bind(this)
    );
    this.router.put(
      '/config',
      this.updateConfiguration.bind(this)
    );

    // Export Endpoints
    this.router.get(
      '/export/:format',
      this.exportAnalytics.bind(this)
    );

    // Error handling
    this.router.use(this.errorHandler.bind(this));
  }

  // Middleware

  private async authenticateUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // In production, would verify JWT token
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Extract user ID from token (simplified)
      req.userId = req.query.userId as string || 'default-user';
      next();
    } catch (error) {
      res.status(401).json({ error: 'Authentication failed' });
    }
  }

  private requestLogger(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    console.log(`[Analytics API] ${req.method} ${req.path}`);
    next();
  }

  // Performance Endpoints

  /**
   * GET /analytics/performance
   * Get performance metrics for all strategies
   */
  private async getPerformanceMetrics(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { startDate, endDate, limit = 100 } = req.query;

      const metrics = await this.service.getPerformanceMetrics(
        req.userId!,
        'all',
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: metrics.slice(0, parseInt(limit as string)),
        total: metrics.length,
        timestamp: new Date()
      } as AnalyticsResponse<any>);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * GET /analytics/performance/:strategyId
   * Get performance metrics for specific strategy
   */
  private async getStrategyPerformance(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { strategyId } = req.params;
      const { startDate, endDate } = req.query;

      const metrics = await this.service.getPerformanceMetrics(
        req.userId!,
        strategyId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Portfolio Endpoints

  /**
   * GET /analytics/portfolio
   * Get current portfolio analytics
   */
  private async getPortfolioAnalytics(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const portfolio = await this.service.getPortfolioAnalytics(
        req.userId!
      );

      res.json({
        success: true,
        data: portfolio,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * GET /analytics/portfolio/allocation
   * Get asset allocation
   */
  private async getPortfolioAllocation(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const portfolio = await this.service.getPortfolioAnalytics(
        req.userId!
      );

      res.json({
        success: true,
        data: {
          allocation: portfolio.allocation,
          totalValue: portfolio.totalValue,
          numberOfPositions: portfolio.numberOfPositions
        },
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * GET /analytics/portfolio/diversification
   * Get diversification metrics
   */
  private async getPortfolioDiversification(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const portfolio = await this.service.getPortfolioAnalytics(
        req.userId!
      );

      res.json({
        success: true,
        data: {
          concentrationIndex: portfolio.concentrationIndex,
          diversificationRatio: portfolio.diversificationRatio,
          largestPositionPct: portfolio.largestPositionPct,
          numberOfPositions: portfolio.numberOfPositions
        },
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Risk Endpoints

  /**
   * GET /analytics/risk
   * Get risk metrics for all strategies
   */
  private async getRiskMetrics(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const risks = await this.service.getRiskMetrics(
        req.userId!,
        undefined,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: risks,
        total: risks.length,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * GET /analytics/risk/:strategyId
   * Get risk metrics for specific strategy
   */
  private async getStrategyRisk(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { strategyId } = req.params;
      const { startDate, endDate } = req.query;

      const risks = await this.service.getRiskMetrics(
        req.userId!,
        strategyId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: risks,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Trade Endpoints

  /**
   * GET /analytics/trades/statistics
   * Get trade statistics
   */
  private async getTradeStatistics(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { strategyId } = req.query;

      // In production, would fetch from database
      const statistics = {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0
      };

      res.json({
        success: true,
        data: statistics,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * GET /analytics/trades/:tradeId
   * Get specific trade analytics
   */
  private async getTrade(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { tradeId } = req.params;

      // In production, would fetch from database
      const trade = {
        id: tradeId,
        symbol: 'AAPL',
        entryPrice: 150,
        exitPrice: 155,
        profit: 500,
        profitPercent: 0.033
      };

      res.json({
        success: true,
        data: trade,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Alert Endpoints

  /**
   * GET /analytics/alerts
   * Get alerts
   */
  private async getAlerts(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const {
        strategyId,
        alertType,
        alertLevel,
        acknowledged,
        limit = 50,
        offset = 0
      } = req.query;

      const filters: any = {
        strategyId: strategyId ? String(strategyId) : undefined,
        alertType: alertType ? (alertType as AlertType) : undefined,
        alertLevel: alertLevel ? (alertLevel as AlertLevel) : undefined,
        acknowledged: acknowledged ? JSON.parse(String(acknowledged)) : undefined,
        limit: parseInt(String(limit)),
        offset: parseInt(String(offset))
      };

      const result = await this.service.getAlerts(
        req.userId!,
        filters
      );

      res.json({
        success: true,
        data: result.alerts,
        total: result.total,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * POST /analytics/alerts/:alertId/acknowledge
   * Acknowledge alert
   */
  private async acknowledgeAlert(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { alertId } = req.params;

      const alert = await this.service.acknowledgeAlert(
        req.userId!,
        parseInt(alertId)
      );

      res.json({
        success: true,
        data: alert,
        message: 'Alert acknowledged',
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Daily Snapshot Endpoints

  /**
   * GET /analytics/snapshots
   * Get daily snapshots
   */
  private async getDailySnapshots(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { days = 30 } = req.query;

      const snapshots = await this.service.getDailySnapshots(
        req.userId!,
        undefined,
        parseInt(String(days))
      );

      res.json({
        success: true,
        data: snapshots,
        total: snapshots.length,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * GET /analytics/snapshots/:strategyId
   * Get strategy snapshots
   */
  private async getStrategySnapshots(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { strategyId } = req.params;
      const { days = 30 } = req.query;

      const snapshots = await this.service.getDailySnapshots(
        req.userId!,
        strategyId,
        parseInt(String(days))
      );

      res.json({
        success: true,
        data: snapshots,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Summary & Comparison Endpoints

  /**
   * GET /analytics/summary
   * Get analytics summary
   */
  private async getAnalyticsSummary(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { strategyId } = req.query;

      const summary = await this.service.getAnalyticsSummary(
        req.userId!,
        strategyId ? String(strategyId) : undefined
      );

      res.json({
        success: true,
        data: summary,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * GET /analytics/compare
   * Get comparative analysis
   */
  private async getComparativeAnalysis(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { strategyId, periodDays = 30 } = req.query;

      const comparison = await this.service.getComparativeAnalysis(
        req.userId!,
        strategyId ? String(strategyId) : undefined,
        parseInt(String(periodDays))
      );

      res.json({
        success: true,
        data: comparison,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Configuration Endpoints

  /**
   * GET /analytics/config
   * Get analytics configuration
   */
  private async getConfiguration(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const config = await this.service.getConfig(req.userId!);

      res.json({
        success: true,
        data: config,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * PUT /analytics/config
   * Update analytics configuration
   */
  private async updateConfiguration(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const updatedConfig = await this.service.updateConfig(
        req.userId!,
        req.body
      );

      res.json({
        success: true,
        data: updatedConfig,
        message: 'Configuration updated',
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Export Endpoint

  /**
   * GET /analytics/export/:format
   * Export analytics data
   */
  private async exportAnalytics(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { format } = req.params;
      const { startDate, endDate } = req.query;

      const data = await this.service.exportAnalytics(
        req.userId!,
        format as 'json' | 'csv' | 'pdf',
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="analytics.csv"');
        res.send(data);
      } else {
        res.status(400).json({ error: 'Invalid format' });
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Error Handler

  private errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    console.error('[Analytics API Error]', err);
    res.status(500).json({
      success: false,
      error: err.message,
      timestamp: new Date()
    });
  }

  /**
   * Get Express router
   */
  getRouter(): Router {
    return this.router;
  }
}

export function createAnalyticsRouter(
  service?: AnalyticsService
): Router {
  return new AnalyticsRouter(service).getRouter();
}
