/**
 * Exchange Connector Skill - Main Entry Point
 * Unified interface for 12+ cryptocurrency and trading exchanges
 * Agent: Trading Operations
 * Version: 1.0.0 (Phase 3: Architecture Complete)
 */

import ConnectionManager from './connectionManager';
import CredentialStore from './credentialStore';
import RateLimiter from './rateLimiter';
import HealthMonitor from './healthMonitor';
import ExchangeErrorHandler from './errorHandler';
import {
  ExchangeConfig,
  CredentialConfig,
  Balance,
  ConsolidatedBalance,
  MarketData,
  TradingPair,
  ExchangeHealth,
  SkillResponse,
  DiagnosticReport,
  OperationResult,
  ExchangeError,
} from './types';

export class ExchangeConnector {
  private connectionManager: ConnectionManager;
  private credentialStore: CredentialStore;
  private rateLimiter: RateLimiter;
  private healthMonitor: HealthMonitor;
  private errorHandler: ExchangeErrorHandler;

  private config: Record<string, ExchangeConfig> = {};
  private registeredExchanges: Set<string> = new Set();

  constructor(config?: {
    exchanges?: Record<string, ExchangeConfig>;
    encryptionKey?: string;
  }) {
    this.connectionManager = new ConnectionManager();
    this.credentialStore = new CredentialStore(undefined, config?.encryptionKey);
    this.rateLimiter = new RateLimiter();
    this.healthMonitor = new HealthMonitor();
    this.errorHandler = new ExchangeErrorHandler();

    if (config?.exchanges) {
      this.config = config.exchanges;
    }
  }

  /**
   * Initialize exchange connector
   */
  async initialize(): Promise<void> {
    // Initialize pools for all configured exchanges
    for (const exchange of Object.keys(this.config)) {
      if (this.config[exchange].enabled !== false) {
        this.connectionManager.initializePool(exchange);
        this.registeredExchanges.add(exchange);
      }
    }

    // Start health monitoring
    this.healthMonitor.startHealthChecks();
  }

  /**
   * Register credentials for an exchange
   */
  registerExchangeCredentials(exchange: string, creds: CredentialConfig): { success: boolean; errors?: string[] } {
    // Validate credentials
    const validation = this.credentialStore.validateCredentials(creds);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // Store credentials
    const stored = this.credentialStore.storeCredentials(exchange, creds);
    return { success: stored };
  }

  /**
   * Get registered exchanges
   */
  getRegisteredExchanges(): string[] {
    return Array.from(this.registeredExchanges);
  }

  /**
   * Check connectivity to exchanges
   */
  async checkConnectivity(): Promise<SkillResponse<ExchangeHealth[]>> {
    const startTime = Date.now();
    const results: ExchangeHealth[] = [];

    for (const exchange of this.registeredExchanges) {
      try {
        // Rate limit check
        if (!await this.rateLimiter.waitForSlot(exchange)) {
          results.push({
            name: exchange,
            status: 'degraded',
            connected: false,
            lastCheck: new Date(),
            latency: 0,
            errorMessage: 'Rate limit exceeded',
          });
          continue;
        }

        // Perform connectivity test
        const startLatency = Date.now();
        const creds = this.credentialStore.getCredentials(exchange);

        if (!creds) {
          results.push({
            name: exchange,
            status: 'failed',
            connected: false,
            lastCheck: new Date(),
            latency: Date.now() - startLatency,
            errorMessage: 'No credentials found',
          });
          this.errorHandler.recordFailure(exchange);
          continue;
        }

        // Simulate connectivity test (Phase 5 will implement actual API calls)
        const latency = Date.now() - startLatency;
        const health: ExchangeHealth = {
          name: exchange,
          status: latency < 500 ? 'healthy' : 'degraded',
          connected: true,
          lastCheck: new Date(),
          latency,
        };

        results.push(health);
        this.healthMonitor.updateHealth(health);
        this.errorHandler.recordSuccess(exchange);
      } catch (error) {
        const exchangeError = this.errorHandler.handleError(error, { exchange });
        results.push({
          name: exchange,
          status: 'failed',
          connected: false,
          lastCheck: new Date(),
          latency: 0,
          errorMessage: exchangeError.message,
        });
        this.errorHandler.recordFailure(exchange);
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      success: results.some(r => r.status === 'healthy'),
      skillName: 'exchange-connector',
      executionTime: `${executionTime}ms`,
      result: results,
      metadata: {
        timestamp: new Date(),
        requestId: this.generateRequestId(),
      },
    };
  }

  /**
   * Get balances from exchanges
   */
  async getBalances(exchanges?: string[]): Promise<SkillResponse<ConsolidatedBalance>> {
    const startTime = Date.now();
    const targetExchanges = exchanges || Array.from(this.registeredExchanges);
    const allBalances: Balance[] = [];

    for (const exchange of targetExchanges) {
      try {
        // Check circuit breaker
        if (this.errorHandler.isCircuitBreakerOpen(exchange)) {
          console.warn(`Circuit breaker open for ${exchange}`);
          continue;
        }

        // Rate limit check
        if (!await this.rateLimiter.waitForSlot(exchange)) {
          console.warn(`Rate limit exceeded for ${exchange}`);
          continue;
        }

        // Get credentials
        const creds = this.credentialStore.getCredentials(exchange);
        if (!creds) {
          continue;
        }

        // Simulate balance fetching (Phase 5 will implement actual API calls)
        const balances = await this.simulateGetBalances(exchange);
        allBalances.push(...balances);

        this.errorHandler.recordSuccess(exchange);
      } catch (error) {
        const exchangeError = this.errorHandler.handleError(error, { exchange, operation: 'getBalances' });
        console.error(`Error getting balances from ${exchange}:`, exchangeError);
        this.errorHandler.recordFailure(exchange);
      }
    }

    // Consolidate balances
    const consolidated = this.consolidateBalances(allBalances);
    const executionTime = Date.now() - startTime;

    return {
      success: allBalances.length > 0,
      skillName: 'exchange-connector',
      executionTime: `${executionTime}ms`,
      result: consolidated,
      metadata: {
        timestamp: new Date(),
        requestId: this.generateRequestId(),
      },
    };
  }

  /**
   * Get market data
   */
  async getMarketData(exchange: string, pair: string): Promise<SkillResponse<MarketData | null>> {
    const startTime = Date.now();

    try {
      // Check circuit breaker
      if (this.errorHandler.isCircuitBreakerOpen(exchange)) {
        throw new Error(`Circuit breaker open for ${exchange}`);
      }

      // Rate limit check
      if (!await this.rateLimiter.waitForSlot(exchange)) {
        throw new Error(`Rate limit exceeded for ${exchange}`);
      }

      // Simulate market data fetch
      const data = await this.simulateGetMarketData(exchange, pair);
      const executionTime = Date.now() - startTime;

      this.errorHandler.recordSuccess(exchange);

      return {
        success: true,
        skillName: 'exchange-connector',
        executionTime: `${executionTime}ms`,
        result: data,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
        },
      };
    } catch (error) {
      const exchangeError = this.errorHandler.handleError(error, {
        exchange,
        operation: 'getMarketData',
      });
      this.errorHandler.recordFailure(exchange);

      return {
        success: false,
        skillName: 'exchange-connector',
        executionTime: `${Date.now() - startTime}ms`,
        error: exchangeError.message,
        errorType: exchangeError.type,
        statusCode: exchangeError.statusCode,
        suggestions: [exchangeError.suggestion],
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
        },
      };
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): SkillResponse<DiagnosticReport> {
    const summary = this.healthMonitor.getHealthSummary();
    const exchanges = this.healthMonitor.getHealthStatus();

    const report: DiagnosticReport = {
      generatedAt: new Date(),
      summary: {
        totalExchanges: summary.total,
        connected: summary.healthy,
        degraded: summary.degraded,
        failed: summary.failed,
        overallHealth: summary.overallHealth,
      },
      exchanges,
      rateLimits: this.rateLimiter.getAllRateLimits(),
      recentErrors: this.formatRecentErrors(),
    };

    return {
      success: summary.healthy > 0,
      skillName: 'exchange-connector',
      executionTime: '0ms',
      result: report,
      metadata: {
        timestamp: new Date(),
        requestId: this.generateRequestId(),
      },
    };
  }

  /**
   * Generate diagnostic report
   */
  generateDiagnosticReport(): string {
    let report = this.healthMonitor.generateHealthReport();
    report += '\n\n' + this.errorHandler.generateErrorReport();
    return report;
  }

  /**
   * Rotate credentials for an exchange
   */
  rotateCredentials(exchange: string, newCreds: CredentialConfig): { success: boolean; message: string } {
    const validation = this.credentialStore.validateCredentials(newCreds);
    if (!validation.valid) {
      return {
        success: false,
        message: `Credential validation failed: ${validation.errors.join(', ')}`,
      };
    }

    const success = this.credentialStore.rotateCredentials(exchange, newCreds);
    return {
      success,
      message: success
        ? `Credentials rotated for ${exchange}`
        : `Failed to rotate credentials for ${exchange}`,
    };
  }

  /**
   * Consolidate balances from multiple exchanges
   */
  private consolidateBalances(balances: Balance[]): ConsolidatedBalance {
    const assets: Record<string, Balance[]> = {};
    const totals: Record<string, number> = {};
    let totalUsdValue = 0;

    for (const balance of balances) {
      if (!assets[balance.asset]) {
        assets[balance.asset] = [];
      }
      assets[balance.asset].push(balance);

      totals[balance.asset] = (totals[balance.asset] || 0) + balance.total;
      if (balance.usdValue) {
        totalUsdValue += balance.usdValue;
      }
    }

    return {
      assets,
      totals,
      totalUsdValue,
      timestamp: new Date(),
    };
  }

  /**
   * Simulate getting balances (Phase 5 will use real API)
   */
  private async simulateGetBalances(exchange: string): Promise<Balance[]> {
    return [
      {
        exchange,
        asset: 'BTC',
        free: Math.random() * 10,
        locked: Math.random() * 5,
        total: Math.random() * 15,
      },
      {
        exchange,
        asset: 'ETH',
        free: Math.random() * 100,
        locked: Math.random() * 50,
        total: Math.random() * 150,
      },
    ];
  }

  /**
   * Simulate getting market data
   */
  private async simulateGetMarketData(exchange: string, pair: string): Promise<MarketData> {
    return {
      exchange,
      pair,
      bid: Math.random() * 50000,
      ask: Math.random() * 50000,
      last: Math.random() * 50000,
      volume24h: Math.random() * 1000000,
      timestamp: new Date(),
    };
  }

  /**
   * Format recent errors
   */
  private formatRecentErrors(): Array<{ exchange: string; error: string; timestamp: Date; count: number }> {
    const stats = this.errorHandler.getAllErrorStats();
    const formatted: Array<{ exchange: string; error: string; timestamp: Date; count: number }> = [];

    for (const [exchange, errors] of Object.entries(stats)) {
      for (const [errorType, count] of Object.entries(errors)) {
        formatted.push({
          exchange,
          error: errorType,
          timestamp: new Date(),
          count: count as number,
        });
      }
    }

    return formatted.slice(0, 10); // Return top 10
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Destroy connector
   */
  destroy(): void {
    this.healthMonitor.destroy();
    this.connectionManager.destroy();
    this.credentialStore.clear();
  }
}

export default ExchangeConnector;
export * from './types';
export { ConnectionManager, CredentialStore, RateLimiter, HealthMonitor, ExchangeErrorHandler };
