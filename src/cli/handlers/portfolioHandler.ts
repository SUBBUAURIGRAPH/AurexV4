/**
 * Portfolio Command Handler
 * Handles portfolio viewing, analysis, and rebalancing operations
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios';
import * as chalk from 'chalk';
import * as inquirer from 'inquirer';
import { CommandOptions, PortfolioInfo, Position, AssetAllocation, OutputFormat } from '../types';
import Formatter from '../utils/formatter';
import Validator from '../utils/validator';
import ConfigManager from '../utils/config';
import AuthManager from '../utils/auth';

/**
 * Portfolio Handler Class
 * Manages portfolio viewing and analysis operations
 *
 * @example
 * ```bash
 * # Show portfolio overview
 * hms portfolio show
 *
 * # View asset allocation
 * hms portfolio allocation
 *
 * # Rebalance portfolio
 * hms portfolio rebalance --target equity=60,bonds=30,cash=10
 * ```
 */
export class PortfolioHandler {
  private config = ConfigManager.getInstance();
  private auth = AuthManager.getInstance();
  private apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: this.config.getApiUrl(),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Show portfolio overview
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms portfolio show
   * hms portfolio show --format json
   * ```
   */
  async show(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Portfolio Overview');

      const stopLoading = Formatter.loading('Fetching portfolio...');

      try {
        const response = await this.apiClient.get('/portfolio', {
          params: { userId: this.config.getUserId() },
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const portfolio: PortfolioInfo = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.JSON) {
          console.log(JSON.stringify(portfolio, null, 2));
        } else if (format === OutputFormat.TABLE) {
          // Summary
          const summary = {
            'Total Value': `$${portfolio.totalValue.toLocaleString()}`,
            'Cash': `$${portfolio.cash.toLocaleString()}`,
            'Invested': `$${portfolio.investedValue.toLocaleString()}`,
            'Day Return': this.formatReturn(portfolio.dayReturn, portfolio.dayReturnPercent),
            'Total Return': this.formatReturn(portfolio.totalReturn, portfolio.totalReturnPercent)
          };

          console.log(Formatter.format(summary, OutputFormat.TABLE));

          // Positions
          if (portfolio.positions && portfolio.positions.length > 0) {
            Formatter.separator();
            console.log(chalk.bold.cyan('\nPositions:\n'));

            const positionsData = portfolio.positions.map(p => ({
              Symbol: p.symbol,
              Quantity: p.quantity.toLocaleString(),
              Price: `$${p.currentPrice.toFixed(2)}`,
              'Avg Cost': `$${p.averageCost.toFixed(2)}`,
              Value: `$${p.totalValue.toLocaleString()}`,
              'P/L': this.formatPL(p.unrealizedPL, p.unrealizedPLPercent),
              '% Portfolio': `${p.percentOfPortfolio.toFixed(1)}%`
            }));

            console.log(Formatter.format(positionsData, OutputFormat.TABLE));
          }
        } else {
          console.log(Formatter.format(portfolio, format));
        }

      } catch (error: any) {
        stopLoading();
        throw this.handleApiError(error);
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Show asset allocation
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms portfolio allocation
   * hms portfolio allocation --format csv
   * ```
   */
  async allocation(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Asset Allocation');

      const stopLoading = Formatter.loading('Analyzing allocation...');

      try {
        const response = await this.apiClient.get('/portfolio/allocation', {
          params: { userId: this.config.getUserId() },
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const allocation: AssetAllocation[] = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          const allocationData = allocation.map(a => ({
            'Asset Class': a.assetClass,
            'Value': `$${a.value.toLocaleString()}`,
            'Current %': `${a.percentage.toFixed(1)}%`,
            'Target %': a.target ? `${a.target.toFixed(1)}%` : 'N/A',
            'Difference': a.difference
              ? this.formatDifference(a.difference)
              : 'N/A'
          }));

          console.log(Formatter.format(allocationData, OutputFormat.TABLE));

          // Visual bar chart
          console.log(chalk.bold.cyan('\nAllocation Breakdown:\n'));
          allocation.forEach(a => {
            const barLength = Math.round(a.percentage / 2);
            const bar = '█'.repeat(barLength) + '░'.repeat(50 - barLength);
            console.log(`  ${a.assetClass.padEnd(12)} ${chalk.cyan(bar)} ${a.percentage.toFixed(1)}%`);
          });
          console.log('');

        } else {
          console.log(Formatter.format(allocation, format));
        }

      } catch (error: any) {
        stopLoading();
        throw this.handleApiError(error);
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Show diversification analysis
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms portfolio diversification
   * ```
   */
  async diversification(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Diversification Analysis');

      const stopLoading = Formatter.loading('Analyzing diversification...');

      try {
        const response = await this.apiClient.get('/portfolio/diversification', {
          params: { userId: this.config.getUserId() },
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const analysis = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          const metrics = {
            'Herfindahl Index': analysis.herfindahlIndex?.toFixed(4) || 'N/A',
            'Concentration Index': analysis.concentrationIndex?.toFixed(4) || 'N/A',
            'Diversification Ratio': analysis.diversificationRatio?.toFixed(2) || 'N/A',
            'Effective N': analysis.effectiveN?.toFixed(0) || 'N/A',
            'Number of Positions': analysis.positionCount || 0,
            'Largest Position': `${analysis.largestPosition?.toFixed(1)}%` || 'N/A',
            'Top 5 Concentration': `${analysis.top5Concentration?.toFixed(1)}%` || 'N/A',
            'Diversification Score': this.getDiversificationScore(analysis)
          };

          console.log(Formatter.format(metrics, OutputFormat.TABLE));

          // Recommendations
          console.log(chalk.bold.cyan('\nRecommendations:\n'));
          this.showDiversificationRecommendations(analysis);

        } else {
          console.log(Formatter.format(analysis, format));
        }

      } catch (error: any) {
        stopLoading();
        throw this.handleApiError(error);
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Rebalance portfolio
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms portfolio rebalance --target equity=60,bonds=30,cash=10
   * hms portfolio rebalance --dry-run
   * ```
   */
  async rebalance(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Portfolio Rebalance');

      let targetAllocation: any = {};

      // Parse target allocation
      if (options.target) {
        const targets = String(options.target).split(',');
        targets.forEach(t => {
          const [assetClass, percentage] = t.split('=');
          targetAllocation[assetClass.trim()] = parseFloat(percentage);
        });
      } else {
        // Interactive target input
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'equity',
            message: 'Target Equity %:',
            default: '60',
            validate: (input) => !isNaN(parseFloat(input)) || 'Must be a number'
          },
          {
            type: 'input',
            name: 'bonds',
            message: 'Target Bonds %:',
            default: '30',
            validate: (input) => !isNaN(parseFloat(input)) || 'Must be a number'
          },
          {
            type: 'input',
            name: 'cash',
            message: 'Target Cash %:',
            default: '10',
            validate: (input) => !isNaN(parseFloat(input)) || 'Must be a number'
          }
        ]);

        targetAllocation = {
          equity: parseFloat(answers.equity),
          bonds: parseFloat(answers.bonds),
          cash: parseFloat(answers.cash)
        };
      }

      // Validate allocation sums to 100%
      const total = Object.values(targetAllocation).reduce((sum: number, val: any) => sum + val, 0);
      if (Math.abs(total - 100) > 0.01) {
        throw new Error(`Target allocation must sum to 100% (currently ${total.toFixed(1)}%)`);
      }

      const payload = {
        userId: this.config.getUserId(),
        targetAllocation,
        dryRun: !!options.dryRun
      };

      const stopLoading = Formatter.loading('Calculating rebalance...');

      try {
        const response = await this.apiClient.post('/portfolio/rebalance', payload, {
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const result = response.data.data;

        if (options.dryRun) {
          Formatter.info('Dry run - no orders placed');
        } else {
          Formatter.success('Rebalance completed!');
        }

        console.log(chalk.cyan('\nRebalance Summary:\n'));

        // Show trades
        if (result.trades && result.trades.length > 0) {
          const tradesData = result.trades.map((t: any) => ({
            Action: t.side.toUpperCase(),
            Symbol: t.symbol,
            Quantity: t.quantity.toLocaleString(),
            'Estimated Value': `$${t.estimatedValue.toLocaleString()}`
          }));

          console.log(Formatter.format(tradesData, OutputFormat.TABLE));
        }

        // Show new allocation
        if (result.newAllocation) {
          Formatter.separator();
          console.log(chalk.bold.cyan('\nProjected Allocation:\n'));

          const allocationData = result.newAllocation.map((a: any) => ({
            'Asset Class': a.assetClass,
            'Current %': `${a.currentPercentage.toFixed(1)}%`,
            'Target %': `${a.targetPercentage.toFixed(1)}%`,
            'New %': `${a.newPercentage.toFixed(1)}%`
          }));

          console.log(Formatter.format(allocationData, OutputFormat.TABLE));
        }

        console.log('');

      } catch (error: any) {
        stopLoading();
        throw this.handleApiError(error);
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Show portfolio performance
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms portfolio performance --period 30d
   * hms portfolio performance --from 2024-01-01 --to 2024-02-01
   * ```
   */
  async performance(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Portfolio Performance');

      const params: any = {
        userId: this.config.getUserId(),
        period: options.period || '30d'
      };

      if (options.from) {
        params.startDate = Validator.validateDate(options.from);
      }
      if (options.to) {
        params.endDate = Validator.validateDate(options.to);
      }

      const stopLoading = Formatter.loading('Analyzing performance...');

      try {
        const response = await this.apiClient.get('/portfolio/performance', {
          params,
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const performance = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          const perfMetrics = {
            'Total Return': `${(performance.totalReturn * 100).toFixed(2)}%`,
            'Annualized Return': `${(performance.annualizedReturn * 100).toFixed(2)}%`,
            'Sharpe Ratio': performance.sharpeRatio?.toFixed(2) || 'N/A',
            'Sortino Ratio': performance.sortinoRatio?.toFixed(2) || 'N/A',
            'Max Drawdown': `${(performance.maxDrawdown * 100).toFixed(2)}%`,
            'Volatility': `${(performance.volatility * 100).toFixed(2)}%`,
            'Best Day': `${(performance.bestDay * 100).toFixed(2)}%`,
            'Worst Day': `${(performance.worstDay * 100).toFixed(2)}%`
          };

          console.log(Formatter.format(perfMetrics, OutputFormat.TABLE));

          // Performance timeline
          if (performance.timeline && performance.timeline.length > 0) {
            Formatter.separator();
            console.log(chalk.bold.cyan('\nPerformance Timeline (Last 10 days):\n'));

            const timelineData = performance.timeline.slice(-10).map((t: any) => ({
              Date: new Date(t.date).toLocaleDateString(),
              Value: `$${t.value.toLocaleString()}`,
              'Daily Return': `${(t.dailyReturn * 100).toFixed(2)}%`,
              'Cumulative': `${(t.cumulativeReturn * 100).toFixed(2)}%`
            }));

            console.log(Formatter.format(timelineData, OutputFormat.TABLE));
          }

        } else {
          console.log(Formatter.format(performance, format));
        }

      } catch (error: any) {
        stopLoading();
        throw this.handleApiError(error);
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Show risk exposure
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms portfolio exposure
   * ```
   */
  async exposure(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Risk Exposure');

      const stopLoading = Formatter.loading('Analyzing risk exposure...');

      try {
        const response = await this.apiClient.get('/portfolio/exposure', {
          params: { userId: this.config.getUserId() },
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const exposure = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          // Sector exposure
          if (exposure.sector) {
            console.log(chalk.bold.cyan('Sector Exposure:\n'));
            const sectorData = Object.entries(exposure.sector).map(([sector, value]: [string, any]) => ({
              Sector: sector,
              Exposure: `${value.toFixed(1)}%`
            }));
            console.log(Formatter.format(sectorData, OutputFormat.TABLE));
          }

          // Geographic exposure
          if (exposure.geographic) {
            Formatter.separator();
            console.log(chalk.bold.cyan('\nGeographic Exposure:\n'));
            const geoData = Object.entries(exposure.geographic).map(([region, value]: [string, any]) => ({
              Region: region,
              Exposure: `${value.toFixed(1)}%`
            }));
            console.log(Formatter.format(geoData, OutputFormat.TABLE));
          }

          // Currency exposure
          if (exposure.currency) {
            Formatter.separator();
            console.log(chalk.bold.cyan('\nCurrency Exposure:\n'));
            const currencyData = Object.entries(exposure.currency).map(([currency, value]: [string, any]) => ({
              Currency: currency,
              Exposure: `${value.toFixed(1)}%`
            }));
            console.log(Formatter.format(currencyData, OutputFormat.TABLE));
          }

        } else {
          console.log(Formatter.format(exposure, format));
        }

      } catch (error: any) {
        stopLoading();
        throw this.handleApiError(error);
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Show portfolio history
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms portfolio history --days 90
   * ```
   */
  async history(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Portfolio History');

      const days = options.days || 30;
      const stopLoading = Formatter.loading(`Fetching ${days} days of history...`);

      try {
        const response = await this.apiClient.get('/portfolio/history', {
          params: {
            userId: this.config.getUserId(),
            days: Validator.validateNumber(days, 'Days', { min: 1, max: 365 })
          },
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const history = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          const historyData = history.map((h: any) => ({
            Date: new Date(h.date).toLocaleDateString(),
            Value: `$${h.totalValue.toLocaleString()}`,
            Cash: `$${h.cash.toLocaleString()}`,
            Invested: `$${h.investedValue.toLocaleString()}`,
            'Daily Return': `${(h.dailyReturn * 100).toFixed(2)}%`,
            'Total Return': `${(h.totalReturn * 100).toFixed(2)}%`
          }));

          console.log(Formatter.format(historyData, OutputFormat.TABLE));
          console.log(chalk.cyan(`\nShowing ${history.length} days of history\n`));
        } else {
          console.log(Formatter.format(history, format));
        }

      } catch (error: any) {
        stopLoading();
        throw this.handleApiError(error);
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Format return value with color
   */
  private formatReturn(absolute: number, percent: number): string {
    const color = absolute >= 0 ? chalk.green : chalk.red;
    const sign = absolute >= 0 ? '+' : '';
    return color(`${sign}$${absolute.toFixed(2)} (${sign}${percent.toFixed(2)}%)`);
  }

  /**
   * Format P/L with color
   */
  private formatPL(absolute: number, percent: number): string {
    const color = absolute >= 0 ? chalk.green : chalk.red;
    const sign = absolute >= 0 ? '+' : '';
    return color(`${sign}$${absolute.toFixed(2)} (${sign}${percent.toFixed(2)}%)`);
  }

  /**
   * Format difference
   */
  private formatDifference(diff: number): string {
    const color = Math.abs(diff) < 5 ? chalk.green : chalk.yellow;
    const sign = diff >= 0 ? '+' : '';
    return color(`${sign}${diff.toFixed(1)}%`);
  }

  /**
   * Get diversification score
   */
  private getDiversificationScore(analysis: any): string {
    const score = analysis.diversificationScore || 0;
    if (score >= 80) return chalk.green(`${score}/100 (Excellent)`);
    if (score >= 60) return chalk.yellow(`${score}/100 (Good)`);
    if (score >= 40) return chalk.yellow(`${score}/100 (Fair)`);
    return chalk.red(`${score}/100 (Poor)`);
  }

  /**
   * Show diversification recommendations
   */
  private showDiversificationRecommendations(analysis: any): void {
    const recommendations: string[] = [];

    if (analysis.largestPosition > 30) {
      recommendations.push(chalk.yellow(`- Largest position (${analysis.largestPosition.toFixed(1)}%) exceeds 30% - consider reducing`));
    }

    if (analysis.positionCount < 5) {
      recommendations.push(chalk.yellow('- Portfolio has fewer than 5 positions - consider adding more diversification'));
    }

    if (analysis.herfindahlIndex > 0.25) {
      recommendations.push(chalk.yellow('- High concentration detected - consider rebalancing'));
    }

    if (recommendations.length === 0) {
      console.log(chalk.green('  Portfolio is well diversified!'));
    } else {
      recommendations.forEach(r => console.log(`  ${r}`));
    }
    console.log('');
  }

  /**
   * Require authentication
   */
  private requireAuth(): void {
    if (!this.auth.isAuthenticated()) {
      throw new Error('Not authenticated. Please login first using "hms account login"');
    }
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: any): Error {
    if (error.response) {
      const message = error.response.data?.message || error.message;
      return new Error(`API Error: ${message}`);
    }
    return error;
  }
}

export default PortfolioHandler;
