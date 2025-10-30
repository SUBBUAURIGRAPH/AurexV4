/**
 * Dashboard Components - Reusable UI components for analytics dashboards
 *
 * @module analytics-dashboard/dashboardComponents
 * @version 1.0.0
 */

import {PerformanceMetrics, RiskMetrics, PortfolioMetrics, DashboardData} from './types';
import * as Logger from 'winston';

/**
 * Chart configuration
 */
export interface ChartConfig {
  title: string;
  type: 'line' | 'bar' | 'pie' | 'heatmap' | 'scatter';
  data: any;
  options?: {
    responsive?: boolean;
    plugins?: any;
    scales?: any;
  };
}

/**
 * Dashboard widget configuration
 */
export interface WidgetConfig {
  id: string;
  title: string;
  type: string;
  data: any;
  refreshRate: number;
  position?: {x: number; y: number; width: number; height: number};
}

/**
 * DashboardComponentFactory - Creates dashboard components
 */
export class DashboardComponentFactory {
  private logger: Logger.Logger;

  constructor(logger: Logger.Logger) {
    this.logger = logger;
  }

  /**
   * Create overview dashboard
   *
   * @param performance - Performance metrics
   * @param risk - Risk metrics
   * @returns Dashboard data
   */
  createOverviewDashboard(performance: PerformanceMetrics, risk: RiskMetrics): DashboardData {
    const charts: ChartConfig[] = [
      {
        title: 'Performance Overview',
        type: 'line',
        data: {
          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
          datasets: [
            {
              label: 'Daily Returns',
              data: performance.dailyReturns.slice(-28) || [0],
              borderColor: '#10b981',
              tension: 0.4,
            },
          ],
        },
      },
      {
        title: 'Risk Metrics',
        type: 'bar',
        data: {
          labels: ['VaR 95%', 'VaR 99%', 'Volatility'],
          datasets: [
            {
              label: 'Risk Level',
              data: [Math.abs(risk.var95), Math.abs(risk.var99), risk.volatility],
              backgroundColor: ['#ef4444', '#dc2626', '#f87171'],
            },
          ],
        },
      },
      {
        title: 'Win Rate',
        type: 'pie',
        data: {
          labels: ['Winning Trades', 'Losing Trades'],
          datasets: [
            {
              data: [performance.winningTrades, performance.losingTrades],
              backgroundColor: ['#10b981', '#ef4444'],
            },
          ],
        },
      },
      {
        title: 'Key Metrics',
        type: 'bar',
        data: {
          labels: ['Total Return', 'Sharpe Ratio', 'Max Drawdown'],
          datasets: [
            {
              label: 'Value',
              data: [performance.totalReturn * 100, performance.sharpeRatio, Math.abs(performance.maxDrawdown) * 100],
              backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b'],
            },
          ],
        },
      },
    ];

    const dashboard: DashboardData = {
      id: 'overview-dashboard',
      name: 'Overview Dashboard',
      type: 'overview',
      timestamp: new Date(),
      performance,
      risk,
      charts,
      refreshRate: 5000,
      lastUpdated: new Date(),
      dataPoints: 4,
    };

    this.logger.debug('Created overview dashboard');
    return dashboard;
  }

  /**
   * Create performance dashboard
   *
   * @param performance - Performance metrics
   * @returns Dashboard data
   */
  createPerformanceDashboard(performance: PerformanceMetrics): DashboardData {
    const charts: ChartConfig[] = [
      {
        title: 'Returns Over Time',
        type: 'line',
        data: {
          labels: Array.from({length: performance.dailyReturns.length}, (_, i) => `Day ${i + 1}`),
          datasets: [
            {
              label: 'Daily Returns',
              data: performance.dailyReturns,
              borderColor: '#3b82f6',
              fill: true,
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.3,
            },
            {
              label: 'Cumulative Return',
              data: this.calculateCumulative(performance.dailyReturns),
              borderColor: '#10b981',
              tension: 0.3,
            },
          ],
        },
      },
      {
        title: 'Monthly Returns Distribution',
        type: 'bar',
        data: {
          labels: Array.from({length: performance.monthlyReturns.length}, (_, i) => `Month ${i + 1}`),
          datasets: [
            {
              label: 'Monthly Return',
              data: performance.monthlyReturns,
              backgroundColor: performance.monthlyReturns.map((r) => (r >= 0 ? '#10b981' : '#ef4444')),
            },
          ],
        },
      },
      {
        title: 'Rolling Sharpe Ratio',
        type: 'line',
        data: {
          labels: Array.from({length: 30}, (_, i) => `Period ${i + 1}`),
          datasets: [
            {
              label: 'Sharpe Ratio',
              data: Array.from({length: 30}, () => performance.sharpeRatio),
              borderColor: '#8b5cf6',
              fill: false,
            },
          ],
        },
      },
      {
        title: 'Drawdown Analysis',
        type: 'line',
        data: {
          labels: Array.from({length: 20}, (_, i) => `Trade ${i + 1}`),
          datasets: [
            {
              label: 'Drawdown %',
              data: Array.from({length: 20}, () => performance.maxDrawdown * 100),
              borderColor: '#ef4444',
              fill: true,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
            },
          ],
        },
      },
      {
        title: 'Performance Summary',
        type: 'bar',
        data: {
          labels: ['Total Return', 'Annualized', 'Sharpe', 'Sortino', 'Calmar'],
          datasets: [
            {
              label: 'Metrics',
              data: [
                performance.totalReturn * 100,
                performance.annualizedReturn * 100,
                performance.sharpeRatio,
                performance.sortinoRatio,
                performance.calphaRatio,
              ],
              backgroundColor: '#3b82f6',
            },
          ],
        },
      },
    ];

    const dashboard: DashboardData = {
      id: 'performance-dashboard',
      name: 'Performance Dashboard',
      type: 'performance',
      timestamp: new Date(),
      performance,
      charts,
      refreshRate: 10000,
      lastUpdated: new Date(),
      dataPoints: 5,
    };

    this.logger.debug('Created performance dashboard');
    return dashboard;
  }

  /**
   * Create risk dashboard
   *
   * @param risk - Risk metrics
   * @returns Dashboard data
   */
  createRiskDashboard(risk: RiskMetrics): DashboardData {
    const charts: ChartConfig[] = [
      {
        title: 'Value at Risk (VaR)',
        type: 'bar',
        data: {
          labels: ['95% Confidence', '99% Confidence'],
          datasets: [
            {
              label: 'VaR',
              data: [Math.abs(risk.var95), Math.abs(risk.var99)],
              backgroundColor: ['#f97316', '#dc2626'],
            },
          ],
        },
      },
      {
        title: 'Expected Shortfall',
        type: 'bar',
        data: {
          labels: ['95%', '99%'],
          datasets: [
            {
              label: 'CVaR',
              data: [Math.abs(risk.expectedShortfall95), Math.abs(risk.expectedShortfall99)],
              backgroundColor: ['#ef4444', '#b91c1c'],
            },
          ],
        },
      },
      {
        title: 'Risk Decomposition',
        type: 'pie',
        data: {
          labels: ['Market Risk', 'Operational Risk', 'Liquidity Risk', 'Counterparty Risk'],
          datasets: [
            {
              data: [risk.marketRisk, risk.operationalRisk, risk.liquidityRisk, risk.counterpartyRisk],
              backgroundColor: ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6'],
            },
          ],
        },
      },
      {
        title: 'Correlation Heatmap',
        type: 'heatmap',
        data: {
          labels: Object.keys(risk.assetCorrelations),
          datasets: [
            {
              label: 'Asset Correlations',
              data: Object.values(risk.assetCorrelations),
            },
          ],
        },
      },
      {
        title: 'Risk Metrics Summary',
        type: 'bar',
        data: {
          labels: ['Volatility', 'Std Dev', 'Beta', 'Concentration'],
          datasets: [
            {
              label: 'Value',
              data: [risk.volatility * 100, risk.standardDeviation * 100, risk.beta, risk.concentrationRatio],
              backgroundColor: '#ef4444',
            },
          ],
        },
      },
      {
        title: 'Stress Test Results',
        type: 'bar',
        data: {
          labels: risk.stressTestResults.map((s) => s.scenario),
          datasets: [
            {
              label: 'Max Loss',
              data: risk.stressTestResults.map((s) => s.maxLoss * 100),
              backgroundColor: '#dc2626',
            },
          ],
        },
      },
    ];

    const dashboard: DashboardData = {
      id: 'risk-dashboard',
      name: 'Risk Dashboard',
      type: 'risk',
      timestamp: new Date(),
      risk,
      charts,
      refreshRate: 15000,
      lastUpdated: new Date(),
      dataPoints: 6,
    };

    this.logger.debug('Created risk dashboard');
    return dashboard;
  }

  /**
   * Create portfolio dashboard
   *
   * @param portfolio - Portfolio metrics
   * @returns Dashboard data
   */
  createPortfolioDashboard(portfolio: PortfolioMetrics): DashboardData {
    const charts: ChartConfig[] = [
      {
        title: 'Portfolio Allocation',
        type: 'pie',
        data: {
          labels: Object.keys(portfolio.allocation).slice(0, 10),
          datasets: [
            {
              data: Object.values(portfolio.allocation).slice(0, 10) as number[],
              backgroundColor: [
                '#3b82f6',
                '#ef4444',
                '#10b981',
                '#f59e0b',
                '#8b5cf6',
                '#06b6d4',
                '#ec4899',
                '#14b8a6',
                '#f43f5e',
                '#a855f7',
              ],
            },
          ],
        },
      },
      {
        title: 'Strategy Allocation',
        type: 'pie',
        data: {
          labels: Object.keys(portfolio.strategyAllocation),
          datasets: [
            {
              data: Object.values(portfolio.strategyAllocation) as number[],
              backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
            },
          ],
        },
      },
      {
        title: 'Portfolio Performance',
        type: 'line',
        data: {
          labels: Array.from({length: 30}, (_, i) => `Day ${i + 1}`),
          datasets: [
            {
              label: 'Portfolio Value',
              data: Array.from({length: 30}, (_, i) => portfolio.totalValue * (1 + Math.random() * 0.02 - 0.01)),
              borderColor: '#3b82f6',
              tension: 0.3,
            },
          ],
        },
      },
      {
        title: 'Asset Sector Breakdown',
        type: 'bar',
        data: {
          labels: Object.keys(portfolio.sectorAllocation).slice(0, 8),
          datasets: [
            {
              label: 'Sector Weight %',
              data: Object.values(portfolio.sectorAllocation).slice(0, 8) as number[],
              backgroundColor: '#3b82f6',
            },
          ],
        },
      },
      {
        title: 'Portfolio Metrics',
        type: 'bar',
        data: {
          labels: ['Total Value', 'Net Return', 'Sharpe', 'Volatility'],
          datasets: [
            {
              label: 'Value',
              data: [portfolio.totalValue / 10000, portfolio.netReturn, portfolio.portfolioSharpe, portfolio.portfolioVolatility * 100],
              backgroundColor: '#10b981',
            },
          ],
        },
      },
    ];

    const dashboard: DashboardData = {
      id: 'portfolio-dashboard',
      name: 'Portfolio Dashboard',
      type: 'portfolio',
      timestamp: new Date(),
      portfolio,
      charts,
      refreshRate: 20000,
      lastUpdated: new Date(),
      dataPoints: 5,
    };

    this.logger.debug('Created portfolio dashboard');
    return dashboard;
  }

  /**
   * Create trade analysis dashboard
   *
   * @param performance - Performance metrics
   * @returns Dashboard data
   */
  createTradeAnalysisDashboard(performance: PerformanceMetrics): DashboardData {
    const charts: ChartConfig[] = [
      {
        title: 'Trade Distribution',
        type: 'bar',
        data: {
          labels: ['Winning', 'Losing'],
          datasets: [
            {
              label: 'Trades',
              data: [performance.winningTrades, performance.losingTrades],
              backgroundColor: ['#10b981', '#ef4444'],
            },
          ],
        },
      },
      {
        title: 'P&L Distribution',
        type: 'bar',
        data: {
          labels: ['Avg Win', 'Avg Loss', 'Largest Win', 'Largest Loss'],
          datasets: [
            {
              label: 'Amount',
              data: [performance.averageWin, performance.averageLoss, performance.largestWin, performance.largestLoss],
              backgroundColor: ['#10b981', '#ef4444', '#34d399', '#fca5a5'],
            },
          ],
        },
      },
      {
        title: 'Consecutive Trades',
        type: 'bar',
        data: {
          labels: ['Max Wins', 'Max Losses'],
          datasets: [
            {
              label: 'Count',
              data: [performance.maxConsecutiveWins, performance.maxConsecutiveLosses],
              backgroundColor: ['#10b981', '#ef4444'],
            },
          ],
        },
      },
      {
        title: 'Trade Timing Distribution',
        type: 'line',
        data: {
          labels: Array.from({length: 24}, (_, i) => `${i}:00`),
          datasets: [
            {
              label: 'Win Rate',
              data: Array.from({length: 24}, () => performance.winRate * 100),
              borderColor: '#10b981',
            },
          ],
        },
      },
      {
        title: 'Trade Statistics',
        type: 'bar',
        data: {
          labels: ['Total Trades', 'Win Rate %', 'Profit Factor', 'Expectancy'],
          datasets: [
            {
              label: 'Value',
              data: [performance.totalTrades / 100, performance.winRate * 100, performance.profitFactor, performance.expectancy * 1000],
              backgroundColor: '#3b82f6',
            },
          ],
        },
      },
    ];

    const dashboard: DashboardData = {
      id: 'trade-analysis-dashboard',
      name: 'Trade Analysis Dashboard',
      type: 'trade-analysis',
      timestamp: new Date(),
      performance,
      charts,
      refreshRate: 5000,
      lastUpdated: new Date(),
      dataPoints: 5,
    };

    this.logger.debug('Created trade analysis dashboard');
    return dashboard;
  }

  /**
   * Create custom dashboard
   *
   * @param id - Dashboard ID
   * @param name - Dashboard name
   * @param charts - Chart configurations
   * @returns Dashboard data
   */
  createCustomDashboard(id: string, name: string, charts: ChartConfig[]): DashboardData {
    const dashboard: DashboardData = {
      id,
      name,
      type: 'overview',
      timestamp: new Date(),
      charts,
      refreshRate: 10000,
      lastUpdated: new Date(),
      dataPoints: charts.length,
    };

    this.logger.debug(`Created custom dashboard: ${name}`);
    return dashboard;
  }

  /**
   * Calculate cumulative returns
   * @private
   */
  private calculateCumulative(returns: number[]): number[] {
    const cumulative: number[] = [];
    let sum = 0;

    returns.forEach((r) => {
      sum += r;
      cumulative.push(sum);
    });

    return cumulative;
  }

  /**
   * Create alert widget
   */
  createAlertWidget(alerts: any[]): WidgetConfig {
    return {
      id: 'alerts-widget',
      title: 'Active Alerts',
      type: 'alerts',
      data: alerts,
      refreshRate: 5000,
      position: {x: 0, y: 0, width: 3, height: 2},
    };
  }

  /**
   * Create metric card widget
   */
  createMetricCard(title: string, value: number, change: number, unit: string = ''): WidgetConfig {
    return {
      id: `metric-${title}`,
      title,
      type: 'metric',
      data: {value, change, unit},
      refreshRate: 10000,
    };
  }

  /**
   * Create gauge widget
   */
  createGaugeWidget(title: string, value: number, min: number = 0, max: number = 100): WidgetConfig {
    return {
      id: `gauge-${title}`,
      title,
      type: 'gauge',
      data: {value, min, max},
      refreshRate: 15000,
    };
  }
}

export default DashboardComponentFactory;
