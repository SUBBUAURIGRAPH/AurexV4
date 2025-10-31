/**
 * Analytics Client
 * Client-side service for analytics API calls
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios';
import { AlertType, AlertLevel } from '@/analytics/types';

export interface AnalyticsQuery {
  strategyId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AlertFilters {
  strategyId?: string;
  alertType?: AlertType;
  alertLevel?: AlertLevel;
  acknowledged?: boolean;
  limit?: number;
  offset?: number;
}

export class AnalyticsClient {
  private static instances: Map<string, AnalyticsClient> = new Map();
  private client: AxiosInstance;
  private userId: string;
  private baseURL: string;

  private constructor(userId: string, baseURL: string = '/api/analytics') {
    this.userId = userId;
    this.baseURL = baseURL;

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`
      }
    });
  }

  /**
   * Get or create client instance
   */
  static getInstance(userId: string, baseURL?: string): AnalyticsClient {
    if (!this.instances.has(userId)) {
      this.instances.set(userId, new AnalyticsClient(userId, baseURL));
    }
    return this.instances.get(userId)!;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    strategyId?: string,
    limit?: number
  ): Promise<any[]> {
    try {
      const url = strategyId
        ? `/performance/${strategyId}`
        : '/performance';

      const response = await this.client.get(url, {
        params: { limit }
      });

      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
      throw error;
    }
  }

  /**
   * Get portfolio analytics
   */
  async getPortfolioAnalytics(): Promise<any> {
    try {
      const response = await this.client.get('/portfolio');
      return response.data.data || {};
    } catch (error) {
      console.error('Failed to fetch portfolio analytics:', error);
      throw error;
    }
  }

  /**
   * Get portfolio allocation
   */
  async getPortfolioAllocation(): Promise<any> {
    try {
      const response = await this.client.get('/portfolio/allocation');
      return response.data.data || {};
    } catch (error) {
      console.error('Failed to fetch portfolio allocation:', error);
      throw error;
    }
  }

  /**
   * Get diversification metrics
   */
  async getPortfolioDiversification(): Promise<any> {
    try {
      const response = await this.client.get('/portfolio/diversification');
      return response.data.data || {};
    } catch (error) {
      console.error('Failed to fetch diversification metrics:', error);
      throw error;
    }
  }

  /**
   * Get risk metrics
   */
  async getRiskMetrics(
    strategyId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    try {
      const url = strategyId ? `/risk/${strategyId}` : '/risk';

      const response = await this.client.get(url, {
        params: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString()
        }
      });

      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch risk metrics:', error);
      throw error;
    }
  }

  /**
   * Get trade statistics
   */
  async getTradeStatistics(strategyId?: string): Promise<any> {
    try {
      const response = await this.client.get('/trades/statistics', {
        params: { strategyId }
      });

      return response.data.data || {};
    } catch (error) {
      console.error('Failed to fetch trade statistics:', error);
      throw error;
    }
  }

  /**
   * Get specific trade
   */
  async getTrade(tradeId: string): Promise<any> {
    try {
      const response = await this.client.get(`/trades/${tradeId}`);
      return response.data.data || {};
    } catch (error) {
      console.error('Failed to fetch trade:', error);
      throw error;
    }
  }

  /**
   * Get alerts
   */
  async getAlerts(filters?: AlertFilters): Promise<{ alerts: any[]; total: number }> {
    try {
      const response = await this.client.get('/alerts', {
        params: filters
      });

      return {
        alerts: response.data.data || [],
        total: response.data.total || 0
      };
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      throw error;
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: number): Promise<any> {
    try {
      const response = await this.client.post(`/alerts/${alertId}/acknowledge`);
      return response.data.data || {};
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }

  /**
   * Get daily snapshots
   */
  async getDailySnapshots(
    strategyId?: string,
    days?: number
  ): Promise<any[]> {
    try {
      const url = strategyId
        ? `/snapshots/${strategyId}`
        : '/snapshots';

      const response = await this.client.get(url, {
        params: { days }
      });

      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch daily snapshots:', error);
      throw error;
    }
  }

  /**
   * Get analytics summary
   */
  async getSummary(strategyId?: string): Promise<any> {
    try {
      const response = await this.client.get('/summary', {
        params: { strategyId }
      });

      return response.data.data || {};
    } catch (error) {
      console.error('Failed to fetch analytics summary:', error);
      throw error;
    }
  }

  /**
   * Get comparative analysis
   */
  async getComparativeAnalysis(
    strategyId?: string,
    periodDays?: number
  ): Promise<any> {
    try {
      const response = await this.client.get('/compare', {
        params: { strategyId, periodDays }
      });

      return response.data.data || {};
    } catch (error) {
      console.error('Failed to fetch comparative analysis:', error);
      throw error;
    }
  }

  /**
   * Get configuration
   */
  async getConfiguration(): Promise<any> {
    try {
      const response = await this.client.get('/config');
      return response.data.data || {};
    } catch (error) {
      console.error('Failed to fetch configuration:', error);
      throw error;
    }
  }

  /**
   * Update configuration
   */
  async updateConfiguration(config: any): Promise<any> {
    try {
      const response = await this.client.put('/config', config);
      return response.data.data || {};
    } catch (error) {
      console.error('Failed to update configuration:', error);
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    format: 'json' | 'csv' | 'pdf',
    startDate?: Date,
    endDate?: Date
  ): Promise<Blob> {
    try {
      const response = await this.client.get(`/export/${format}`, {
        params: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString()
        },
        responseType: 'blob'
      });

      return response.data;
    } catch (error) {
      console.error('Failed to export analytics:', error);
      throw error;
    }
  }

  /**
   * Download exported file
   */
  async downloadExport(
    format: 'json' | 'csv' | 'pdf',
    startDate?: Date,
    endDate?: Date
  ): Promise<void> {
    try {
      const blob = await this.exportAnalytics(format, startDate, endDate);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download export:', error);
      throw error;
    }
  }

  // Private helper methods

  private getToken(): string {
    // In production, would get token from auth context
    return localStorage.getItem('authToken') || '';
  }
}

export default AnalyticsClient;
