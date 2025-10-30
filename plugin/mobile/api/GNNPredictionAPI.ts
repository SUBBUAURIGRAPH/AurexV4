/**
 * GNN Prediction API Service
 * Mobile API client for accessing GNN predictions and metrics
 *
 * Endpoints:
 * - Prediction endpoints
 * - Performance metrics
 * - History and consensus
 * - Alerts and watchlists
 */

import axios, { AxiosInstance } from 'axios';

interface APIConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
}

class GNNPredictionAPI {
  private api: AxiosInstance;
  private config: APIConfig;

  constructor(config: APIConfig) {
    this.config = {
      timeout: 10000,
      retries: 2,
      ...config
    };

    this.api = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Client': 'mobile-app'
      }
    });

    // Add response interceptor for retry logic
    this.api.interceptors.response.use(
      (response) => response,
      this.handleError.bind(this)
    );
  }

  /**
   * Get prediction for a symbol
   */
  async getPrediction(symbol: string): Promise<any> {
    try {
      const response = await this.api.get(`/api/gnn/metrics/${symbol}`);
      return response.data.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get batch predictions
   */
  async getBatchPredictions(symbols: string[]): Promise<any> {
    try {
      const response = await this.api.post('/api/gnn/predict-batch', {
        stocks: symbols.map((symbol) => ({
          symbol,
          ohlcvData: [], // Will be populated by backend
          fundamentals: {}
        }))
      });
      return response.data.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get detailed metrics for a symbol
   */
  async getMetrics(symbol: string): Promise<any> {
    try {
      const response = await this.api.get(`/api/gnn/metrics/${symbol}`);
      return response.data.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get prediction history
   */
  async getHistory(options: { type?: string; limit?: number; symbol?: string } = {}): Promise<any> {
    try {
      const params = new URLSearchParams();

      if (options.type && options.type !== 'ALL') {
        // Filter by recommendation type client-side or server-side
        params.append('filter', options.type);
      }

      if (options.limit) {
        params.append('limit', options.limit.toString());
      }

      if (options.symbol) {
        params.append('symbol', options.symbol);
      }

      const response = await this.api.get(`/api/gnn/history?${params.toString()}`);
      return response.data.data.predictions || [];
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get market consensus
   */
  async getConsensus(): Promise<any> {
    try {
      const response = await this.api.get('/api/gnn/consensus');
      return response.data.data.overall;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformance(): Promise<any> {
    try {
      const response = await this.api.get('/api/gnn/performance');
      return response.data.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get graph analysis
   */
  async getGraphAnalysis(symbol?: string): Promise<any> {
    try {
      const url = symbol ? `/api/gnn/graph/${symbol}` : '/api/gnn/graph';
      const response = await this.api.get(url);
      return response.data.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(): Promise<any> {
    try {
      const response = await this.api.get('/api/gnn/model');
      return response.data.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.api.get('/api/gnn/health');
      return response.data.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get detailed prediction breakdown
   */
  async getPredictionBreakdown(symbol: string): Promise<any> {
    try {
      const response = await this.api.get(`/api/gnn/metrics/${symbol}`);
      const data = response.data.data;

      return {
        symbol,
        prediction: data.prediction,
        signals: data.prediction?.signals,
        confidence: data.prediction?.confidence,
        performance: data.backtestMetrics,
        graph: data.graphAnalysis
      };
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Create prediction alert
   */
  async createAlert(symbol: string, options: {
    type: 'PRICE' | 'SIGNAL' | 'CONFIDENCE';
    value: number;
    condition: 'ABOVE' | 'BELOW' | 'EQUALS';
  }): Promise<any> {
    try {
      const response = await this.api.post('/api/gnn/alerts', {
        symbol,
        ...options
      });
      return response.data.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get user alerts
   */
  async getAlerts(): Promise<any> {
    try {
      const response = await this.api.get('/api/gnn/alerts');
      return response.data.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Update alert
   */
  async updateAlert(alertId: string, options: any): Promise<any> {
    try {
      const response = await this.api.put(`/api/gnn/alerts/${alertId}`, options);
      return response.data.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Delete alert
   */
  async deleteAlert(alertId: string): Promise<void> {
    try {
      await this.api.delete(`/api/gnn/alerts/${alertId}`);
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get watchlist
   */
  async getWatchlist(): Promise<any> {
    try {
      const response = await this.api.get('/api/gnn/watchlist');
      return response.data.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Add to watchlist
   */
  async addToWatchlist(symbol: string): Promise<any> {
    try {
      const response = await this.api.post('/api/gnn/watchlist', { symbol });
      return response.data.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Remove from watchlist
   */
  async removeFromWatchlist(symbol: string): Promise<void> {
    try {
      await this.api.delete(`/api/gnn/watchlist/${symbol}`);
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Compare predictions
   */
  async comparePredictions(symbols: string[]): Promise<any> {
    try {
      const response = await this.api.post('/api/gnn/compare', { symbols });
      return response.data.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get sector consensus
   */
  async getSectorConsensus(sector: string): Promise<any> {
    try {
      const response = await this.api.get(`/api/gnn/consensus/sector/${sector}`);
      return response.data.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get trending symbols
   */
  async getTrendingSymbols(limit: number = 10): Promise<any> {
    try {
      const response = await this.api.get(`/api/gnn/trending?limit=${limit}`);
      return response.data.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Export prediction history
   */
  async exportPredictions(format: 'CSV' | 'JSON' = 'CSV'): Promise<Blob> {
    try {
      const response = await this.api.get('/api/gnn/export', {
        params: { format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  /**
   * Handle API errors
   */
  private async handleError(error: any) {
    if (error.response?.status === 429) {
      // Rate limited - wait and retry
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return this.api.request(error.config);
    }

    if (error.response?.status >= 500) {
      // Server error - retry
      if (!error.config.retryCount) {
        error.config.retryCount = 0;
      }

      if (error.config.retryCount < this.config.retries!) {
        error.config.retryCount++;
        await new Promise((resolve) => setTimeout(resolve, 1000 * error.config.retryCount));
        return this.api.request(error.config);
      }
    }

    return Promise.reject(error);
  }

  /**
   * Handle API error responses
   */
  private handleAPIError(error: any): Error {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error || error.response.statusText;

      switch (status) {
        case 400:
          return new Error(`Invalid request: ${message}`);
        case 401:
          return new Error('Unauthorized. Please log in.');
        case 403:
          return new Error('Access denied.');
        case 404:
          return new Error('Resource not found.');
        case 429:
          return new Error('Too many requests. Please try again later.');
        case 500:
          return new Error('Server error. Please try again later.');
        default:
          return new Error(`API Error: ${message}`);
      }
    }

    if (error.request) {
      return new Error('No response from server. Check your connection.');
    }

    return new Error('Request failed. Please try again.');
  }
}

// Singleton instance
let apiInstance: GNNPredictionAPI;

/**
 * Initialize API service
 */
export const initializeGNNAPI = (config: APIConfig): GNNPredictionAPI => {
  apiInstance = new GNNPredictionAPI(config);
  return apiInstance;
};

/**
 * Get API instance
 */
export const getGNNAPI = (): GNNPredictionAPI => {
  if (!apiInstance) {
    throw new Error('GNN API not initialized. Call initializeGNNAPI first.');
  }
  return apiInstance;
};

/**
 * Export default instance methods
 */
export const GNNPredictionAPI = {
  getPrediction: (symbol: string) => getGNNAPI().getPrediction(symbol),
  getBatchPredictions: (symbols: string[]) => getGNNAPI().getBatchPredictions(symbols),
  getMetrics: (symbol: string) => getGNNAPI().getMetrics(symbol),
  getHistory: (options?: any) => getGNNAPI().getHistory(options),
  getConsensus: () => getGNNAPI().getConsensus(),
  getPerformance: () => getGNNAPI().getPerformance(),
  getGraphAnalysis: (symbol?: string) => getGNNAPI().getGraphAnalysis(symbol),
  getModelInfo: () => getGNNAPI().getModelInfo(),
  healthCheck: () => getGNNAPI().healthCheck(),
  getPredictionBreakdown: (symbol: string) => getGNNAPI().getPredictionBreakdown(symbol),
  createAlert: (symbol: string, options: any) => getGNNAPI().createAlert(symbol, options),
  getAlerts: () => getGNNAPI().getAlerts(),
  updateAlert: (alertId: string, options: any) => getGNNAPI().updateAlert(alertId, options),
  deleteAlert: (alertId: string) => getGNNAPI().deleteAlert(alertId),
  getWatchlist: () => getGNNAPI().getWatchlist(),
  addToWatchlist: (symbol: string) => getGNNAPI().addToWatchlist(symbol),
  removeFromWatchlist: (symbol: string) => getGNNAPI().removeFromWatchlist(symbol),
  comparePredictions: (symbols: string[]) => getGNNAPI().comparePredictions(symbols),
  getSectorConsensus: (sector: string) => getGNNAPI().getSectorConsensus(sector),
  getTrendingSymbols: (limit?: number) => getGNNAPI().getTrendingSymbols(limit),
  exportPredictions: (format?: 'CSV' | 'JSON') => getGNNAPI().exportPredictions(format)
};

export default GNNPredictionAPI;
