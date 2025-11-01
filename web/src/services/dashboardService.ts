/**
 * Dashboard Service
 * API service for dashboard data fetching
 * @version 1.0.0
 */

import {
  Portfolio,
  Trade,
  Position,
  AssetAllocation
} from '@/store/dashboardSlice';

/**
 * Dashboard Service Class
 */
export class DashboardService {
  private static instance: DashboardService;
  private baseURL: string;
  private apiVersion: string = 'v1';

  private constructor(baseURL: string = process.env.REACT_APP_API_URL || '/api') {
    this.baseURL = baseURL;
  }

  /**
   * Get or create service instance (singleton)
   */
  static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  /**
   * Fetch portfolio summary
   */
  async getPortfolioSummary(): Promise<Portfolio> {
    try {
      const response = await this.fetchData(
        `/portfolio/summary`,
        'GET'
      );

      // Transform response to match Portfolio interface
      return {
        totalValue: response.totalValue || 0,
        availableBalance: response.availableBalance || 0,
        cash: response.cash || 0,
        todayReturn: response.todayReturn || 0,
        ytdReturn: response.ytdReturn || 0,
        positions: response.positions || [],
        allocation: response.allocation || [],
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to fetch portfolio summary:', error);
      throw error;
    }
  }

  /**
   * Fetch portfolio allocation
   */
  async getPortfolioAllocation(): Promise<AssetAllocation[]> {
    try {
      const response = await this.fetchData(
        `/portfolio/allocation`,
        'GET'
      );

      return Array.isArray(response) ? response : response.allocation || [];
    } catch (error) {
      console.error('Failed to fetch portfolio allocation:', error);
      throw error;
    }
  }

  /**
   * Fetch recent trades
   */
  async getRecentTrades(limit: number = 7): Promise<Trade[]> {
    try {
      const response = await this.fetchData(
        `/trades/recent?limit=${limit}`,
        'GET'
      );

      return Array.isArray(response) ? response : response.trades || [];
    } catch (error) {
      console.error('Failed to fetch recent trades:', error);
      throw error;
    }
  }

  /**
   * Fetch current holdings
   */
  async getCurrentHoldings(): Promise<Position[]> {
    try {
      const response = await this.fetchData(
        `/trades/holdings`,
        'GET'
      );

      return Array.isArray(response) ? response : response.holdings || [];
    } catch (error) {
      console.error('Failed to fetch current holdings:', error);
      throw error;
    }
  }

  /**
   * Fetch portfolio performance for period
   */
  async getPortfolioPerformance(period: string = '30d'): Promise<any[]> {
    try {
      const response = await this.fetchData(
        `/portfolio/performance/${period}`,
        'GET'
      );

      return Array.isArray(response) ? response : response.performanceData || [];
    } catch (error) {
      console.error('Failed to fetch portfolio performance:', error);
      throw error;
    }
  }

  /**
   * Fetch specific trade details
   */
  async getTradeDetails(tradeId: string): Promise<Trade> {
    try {
      return await this.fetchData(
        `/trades/${tradeId}`,
        'GET'
      );
    } catch (error) {
      console.error(`Failed to fetch trade ${tradeId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch position details
   */
  async getPositionDetails(symbol: string): Promise<Position> {
    try {
      return await this.fetchData(
        `/portfolio/positions/${symbol}`,
        'GET'
      );
    } catch (error) {
      console.error(`Failed to fetch position ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get market status
   */
  async getMarketStatus(): Promise<{
    status: 'OPEN' | 'CLOSED';
    lastUpdated: string;
  }> {
    try {
      return await this.fetchData(
        `/market/status`,
        'GET'
      );
    } catch (error) {
      console.error('Failed to fetch market status:', error);
      throw error;
    }
  }

  /**
   * Get AI risk score
   */
  async getAIRiskScore(): Promise<number> {
    try {
      const response = await this.fetchData(
        `/analytics/risk-score`,
        'GET'
      );

      return response.riskScore || 5;
    } catch (error) {
      console.error('Failed to fetch AI risk score:', error);
      throw error;
    }
  }

  /**
   * Get dashboard summary (all data in one call)
   */
  async getDashboardSummary(): Promise<{
    portfolio: Portfolio;
    trades: Trade[];
    holdings: Position[];
    marketStatus: 'OPEN' | 'CLOSED';
    aiRiskScore: number;
  }> {
    try {
      const [portfolio, trades, holdings, marketStatus, aiRiskScore] =
        await Promise.all([
          this.getPortfolioSummary(),
          this.getRecentTrades(),
          this.getCurrentHoldings(),
          this.getMarketStatus(),
          this.getAIRiskScore()
        ]);

      return {
        portfolio,
        trades,
        holdings,
        marketStatus: marketStatus.status,
        aiRiskScore
      };
    } catch (error) {
      console.error('Failed to fetch dashboard summary:', error);
      throw error;
    }
  }

  /**
   * Private helper method for API calls
   */
  private async fetchData(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(
          `API Error: ${response.status} ${response.statusText}`
        );
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null;
      }

      const data = await response.json();

      // Handle API response format
      if (data.success === false) {
        throw new Error(data.message || 'API returned an error');
      }

      // Return data from .data property or root object
      return data.data || data;
    } catch (error) {
      console.error(`API Call Failed: ${method} ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Get authentication token
   */
  private getAuthToken(): string {
    // In production, get token from auth context or localStorage
    return localStorage.getItem('authToken') || '';
  }
}

export default DashboardService.getInstance();
