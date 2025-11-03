/**
 * Analytics Command Handler
 * Handles analytics, reporting, and performance analysis operations
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { CommandOptions, AnalyticsMetrics, OutputFormat } from '../types';
import Formatter from '../utils/formatter';
import Validator from '../utils/validator';
import ConfigManager from '../utils/config';
import AuthManager from '../utils/auth';

/**
 * Analytics Handler Class
 * Manages analytics and reporting operations
 *
 * @example
 * ```bash
 * # Show performance metrics
 * hms analytics performance --period 30d
 *
 * # Show risk metrics
 * hms analytics risk --strategy strat-123
 *
 * # Analyze trades
 * hms analytics trades --from 2024-01-01 --to 2024-02-01
 *
 * # Generate report
 * hms analytics report --output report.pdf
 * ```
 */
export class AnalyticsHandler {
  private config = ConfigManager.getInstance();
  private auth = AuthManager.getInstance();
  private apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: this.config.getApiUrl(),
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Show performance metrics
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms analytics performance --period 30d
   * hms analytics performance --strategy strat-123
   * hms analytics performance --from 2024-01-01 --to 2024-02-01
   * ```
   */
  async performance(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Performance Metrics');

      const params: any = {
        userId: this.config.getUserId(),
        period: options.period || '30d'
      };

      if (options.strategy) {
        params.strategyId = Validator.validateStrategyId(options.strategy);
      }

      if (options.from) {
        params.startDate = Validator.validateDate(options.from);
      }
      if (options.to) {
        params.endDate = Validator.validateDate(options.to);
      }

      const stopLoading = Formatter.loading('Analyzing performance...');

      try {
        const response = await this.apiClient.get('/analytics/performance', {
          params,
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const metrics: AnalyticsMetrics = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.JSON) {
          console.log(JSON.stringify(metrics, null, 2));
        } else if (format === OutputFormat.TABLE) {
          // Core metrics
          const coreMetrics = {
            'Total Return': `${(metrics.totalReturn * 100).toFixed(2)}%`,
            'Cumulative Return': `${(metrics.cumulativeReturn * 100).toFixed(2)}%`,
            'Sharpe Ratio': metrics.sharpeRatio.toFixed(4),
            'Sortino Ratio': metrics.sortinoRatio.toFixed(4),
            'Calmar Ratio': metrics.calmarRatio.toFixed(4),
            'Max Drawdown': `${(metrics.maxDrawdown * 100).toFixed(2)}%`,
            'Daily Volatility': `${(metrics.dailyVolatility * 100).toFixed(2)}%`
          };

          console.log(chalk.bold.cyan('Core Metrics:\n'));
          console.log(Formatter.format(coreMetrics, OutputFormat.TABLE));

          // Trading metrics
          Formatter.separator();
          console.log(chalk.bold.cyan('\nTrading Metrics:\n'));

          const tradingMetrics = {
            'Total Trades': metrics.totalTrades,
            'Winning Trades': metrics.winningTrades,
            'Losing Trades': metrics.losingTrades,
            'Win Rate': `${(metrics.winRate * 100).toFixed(2)}%`,
            'Profit Factor': metrics.profitFactor.toFixed(2),
            'Average Win': `$${metrics.avgWin.toFixed(2)}`,
            'Average Loss': `$${metrics.avgLoss.toFixed(2)}`,
            'Payoff Ratio': metrics.payoffRatio.toFixed(2)
          };

          console.log(Formatter.format(tradingMetrics, OutputFormat.TABLE));

          // Performance grade
          Formatter.separator();
          console.log(chalk.bold.cyan('\nPerformance Grade:\n'));
          this.showPerformanceGrade(metrics);

        } else {
          console.log(Formatter.format(metrics, format));
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
   * Show risk metrics
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms analytics risk
   * hms analytics risk --strategy strat-123
   * hms analytics risk --confidence 99
   * ```
   */
  async risk(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Risk Metrics');

      const params: any = {
        userId: this.config.getUserId(),
        confidence: options.confidence || 95
      };

      if (options.strategy) {
        params.strategyId = Validator.validateStrategyId(options.strategy);
      }

      const stopLoading = Formatter.loading('Analyzing risk...');

      try {
        const response = await this.apiClient.get('/analytics/risk', {
          params,
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const risk = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          // Value at Risk
          console.log(chalk.bold.cyan('Value at Risk:\n'));
          const varMetrics = {
            [`VaR (${params.confidence}%)`]: `$${Math.abs(risk.var).toLocaleString()}`,
            [`CVaR (${params.confidence}%)`]: `$${Math.abs(risk.cvar).toLocaleString()}`,
            'Max Historical Loss': `$${Math.abs(risk.maxHistoricalLoss || 0).toLocaleString()}`,
            'Expected Shortfall': `$${Math.abs(risk.expectedShortfall || 0).toLocaleString()}`
          };
          console.log(Formatter.format(varMetrics, OutputFormat.TABLE));

          // Volatility metrics
          Formatter.separator();
          console.log(chalk.bold.cyan('\nVolatility Metrics:\n'));
          const volMetrics = {
            'Daily Volatility': `${(risk.dailyVolatility * 100).toFixed(2)}%`,
            'Annual Volatility': `${(risk.annualVolatility * 100).toFixed(2)}%`,
            'Downside Volatility': `${(risk.downsideVolatility * 100).toFixed(2)}%`,
            'Upside Volatility': `${(risk.upsideVolatility * 100).toFixed(2)}%`
          };
          console.log(Formatter.format(volMetrics, OutputFormat.TABLE));

          // Drawdown analysis
          if (risk.drawdown) {
            Formatter.separator();
            console.log(chalk.bold.cyan('\nDrawdown Analysis:\n'));
            const ddMetrics = {
              'Max Drawdown': `${(risk.drawdown.max * 100).toFixed(2)}%`,
              'Max Duration': `${risk.drawdown.maxDuration} days`,
              'Current Drawdown': `${(risk.drawdown.current * 100).toFixed(2)}%`,
              'Recovery Time': risk.drawdown.recoveryTime ? `${risk.drawdown.recoveryTime} days` : 'In drawdown'
            };
            console.log(Formatter.format(ddMetrics, OutputFormat.TABLE));
          }

          // Risk score
          Formatter.separator();
          console.log(chalk.bold.cyan('\nRisk Assessment:\n'));
          this.showRiskAssessment(risk);

        } else {
          console.log(Formatter.format(risk, format));
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
   * Analyze trades
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms analytics trades --from 2024-01-01 --to 2024-02-01
   * hms analytics trades --strategy strat-123
   * hms analytics trades --symbol AAPL
   * ```
   */
  async trades(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Trade Analysis');

      const params: any = {
        userId: this.config.getUserId()
      };

      if (options.strategy) {
        params.strategyId = Validator.validateStrategyId(options.strategy);
      }

      if (options.symbol) {
        params.symbol = Validator.validateSymbol(options.symbol);
      }

      if (options.from) {
        params.startDate = Validator.validateDate(options.from);
      }
      if (options.to) {
        params.endDate = Validator.validateDate(options.to);
      }

      const stopLoading = Formatter.loading('Analyzing trades...');

      try {
        const response = await this.apiClient.get('/analytics/trades', {
          params,
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const analysis = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          // Summary statistics
          console.log(chalk.bold.cyan('Trade Statistics:\n'));
          const stats = {
            'Total Trades': analysis.totalTrades,
            'Winning Trades': analysis.winningTrades,
            'Losing Trades': analysis.losingTrades,
            'Win Rate': `${(analysis.winRate * 100).toFixed(2)}%`,
            'Profit Factor': analysis.profitFactor.toFixed(2),
            'Average Win': `$${analysis.avgWin.toFixed(2)}`,
            'Average Loss': `$${Math.abs(analysis.avgLoss).toFixed(2)}`,
            'Largest Win': `$${analysis.largestWin.toFixed(2)}`,
            'Largest Loss': `$${Math.abs(analysis.largestLoss).toFixed(2)}`,
            'Average Hold Time': `${analysis.avgHoldTime} hours`
          };
          console.log(Formatter.format(stats, OutputFormat.TABLE));

          // Streak analysis
          Formatter.separator();
          console.log(chalk.bold.cyan('\nStreak Analysis:\n'));
          const streaks = {
            'Max Winning Streak': analysis.maxWinStreak,
            'Max Losing Streak': analysis.maxLossStreak,
            'Current Streak': analysis.currentStreak > 0
              ? chalk.green(`${analysis.currentStreak} wins`)
              : chalk.red(`${Math.abs(analysis.currentStreak)} losses`)
          };
          console.log(Formatter.format(streaks, OutputFormat.TABLE));

          // Recent trades
          if (analysis.recentTrades && analysis.recentTrades.length > 0) {
            Formatter.separator();
            console.log(chalk.bold.cyan('\nRecent Trades (Last 10):\n'));

            const tradesData = analysis.recentTrades.slice(-10).map((t: any) => ({
              Date: new Date(t.date).toLocaleDateString(),
              Symbol: t.symbol,
              Side: t.side.toUpperCase(),
              Quantity: t.quantity,
              Entry: `$${t.entryPrice.toFixed(2)}`,
              Exit: `$${t.exitPrice.toFixed(2)}`,
              'P/L': this.formatPL(t.profitLoss),
              'Hold Time': `${t.holdTime}h`
            }));

            console.log(Formatter.format(tradesData, OutputFormat.TABLE));
          }

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
   * Generate analytics report
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms analytics report --output report.pdf
   * hms analytics report --format html --output report.html
   * hms analytics report --strategy strat-123
   * ```
   */
  async report(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Generate Analytics Report');

      const reportFormat = options.reportFormat || 'pdf';
      const outputPath = options.output || `analytics-report-${Date.now()}.${reportFormat}`;

      const params: any = {
        userId: this.config.getUserId(),
        format: reportFormat
      };

      if (options.strategy) {
        params.strategyId = Validator.validateStrategyId(options.strategy);
      }

      if (options.from) {
        params.startDate = Validator.validateDate(options.from);
      }
      if (options.to) {
        params.endDate = Validator.validateDate(options.to);
      }

      const stopLoading = Formatter.loading('Generating report...');

      try {
        const response = await this.apiClient.post('/analytics/report', params, {
          headers: this.auth.getAuthHeader(),
          responseType: reportFormat === 'pdf' ? 'arraybuffer' : 'json'
        });

        stopLoading();

        // Save report to file
        if (reportFormat === 'pdf') {
          fs.writeFileSync(outputPath, response.data);
        } else {
          fs.writeFileSync(outputPath, typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2));
        }

        Formatter.success(`Report generated successfully!`);
        console.log(chalk.cyan('\nReport Details:'));
        console.log(`  Format: ${chalk.yellow(reportFormat.toUpperCase())}`);
        console.log(`  Output: ${chalk.yellow(path.resolve(outputPath))}`);
        console.log(`  Size: ${chalk.yellow(this.formatFileSize(fs.statSync(outputPath).size))}`);
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
   * Export analytics data
   *
   * @param exportFormat - Export format
   * @param options - Command options
   * @example
   * ```bash
   * hms analytics export json --output data.json
   * hms analytics export csv --output data.csv
   * hms analytics export xlsx --output data.xlsx
   * ```
   */
  async export(exportFormat: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Export Analytics Data');

      const validFormats = ['json', 'csv', 'xlsx', 'yaml'];
      const format = Validator.validateString(exportFormat, 'Export format', {
        enum: validFormats
      });

      const outputPath = options.output || `analytics-export-${Date.now()}.${format}`;

      const params: any = {
        userId: this.config.getUserId(),
        format
      };

      if (options.strategy) {
        params.strategyId = Validator.validateStrategyId(options.strategy);
      }

      if (options.from) {
        params.startDate = Validator.validateDate(options.from);
      }
      if (options.to) {
        params.endDate = Validator.validateDate(options.to);
      }

      // Data types to export
      params.include = options.include || 'performance,risk,trades';

      const stopLoading = Formatter.loading(`Exporting data as ${format.toUpperCase()}...`);

      try {
        const response = await this.apiClient.post('/analytics/export', params, {
          headers: this.auth.getAuthHeader(),
          responseType: format === 'xlsx' ? 'arraybuffer' : 'json'
        });

        stopLoading();

        // Save export to file
        if (format === 'xlsx') {
          fs.writeFileSync(outputPath, response.data);
        } else if (format === 'json') {
          fs.writeFileSync(outputPath, JSON.stringify(response.data.data, null, 2));
        } else if (format === 'csv') {
          fs.writeFileSync(outputPath, response.data.data);
        } else if (format === 'yaml') {
          fs.writeFileSync(outputPath, response.data.data);
        }

        Formatter.success(`Data exported successfully!`);
        console.log(chalk.cyan('\nExport Details:'));
        console.log(`  Format: ${chalk.yellow(format.toUpperCase())}`);
        console.log(`  Output: ${chalk.yellow(path.resolve(outputPath))}`);
        console.log(`  Size: ${chalk.yellow(this.formatFileSize(fs.statSync(outputPath).size))}`);
        console.log(`  Includes: ${chalk.yellow(params.include)}`);
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
   * Show performance grade
   */
  private showPerformanceGrade(metrics: AnalyticsMetrics): void {
    let score = 0;
    const grades: string[] = [];

    // Sharpe Ratio grading
    if (metrics.sharpeRatio > 2.0) {
      score += 25;
      grades.push(chalk.green('Sharpe Ratio: Excellent (>2.0)'));
    } else if (metrics.sharpeRatio > 1.0) {
      score += 15;
      grades.push(chalk.yellow('Sharpe Ratio: Good (>1.0)'));
    } else {
      grades.push(chalk.red('Sharpe Ratio: Needs Improvement (<1.0)'));
    }

    // Win Rate grading
    if (metrics.winRate > 0.6) {
      score += 25;
      grades.push(chalk.green('Win Rate: Excellent (>60%)'));
    } else if (metrics.winRate > 0.5) {
      score += 15;
      grades.push(chalk.yellow('Win Rate: Good (>50%)'));
    } else {
      grades.push(chalk.red('Win Rate: Needs Improvement (<50%)'));
    }

    // Profit Factor grading
    if (metrics.profitFactor > 2.0) {
      score += 25;
      grades.push(chalk.green('Profit Factor: Excellent (>2.0)'));
    } else if (metrics.profitFactor > 1.5) {
      score += 15;
      grades.push(chalk.yellow('Profit Factor: Good (>1.5)'));
    } else {
      grades.push(chalk.red('Profit Factor: Needs Improvement (<1.5)'));
    }

    // Max Drawdown grading
    if (Math.abs(metrics.maxDrawdown) < 0.15) {
      score += 25;
      grades.push(chalk.green('Max Drawdown: Excellent (<15%)'));
    } else if (Math.abs(metrics.maxDrawdown) < 0.25) {
      score += 15;
      grades.push(chalk.yellow('Max Drawdown: Acceptable (<25%)'));
    } else {
      grades.push(chalk.red('Max Drawdown: High Risk (>25%)'));
    }

    // Overall grade
    let overallGrade: string;
    let gradeColor: any;
    if (score >= 80) {
      overallGrade = 'A';
      gradeColor = chalk.green;
    } else if (score >= 60) {
      overallGrade = 'B';
      gradeColor = chalk.yellow;
    } else if (score >= 40) {
      overallGrade = 'C';
      gradeColor = chalk.yellow;
    } else {
      overallGrade = 'D';
      gradeColor = chalk.red;
    }

    console.log(gradeColor.bold(`  Overall Grade: ${overallGrade} (${score}/100)\n`));
    grades.forEach(g => console.log(`  ${g}`));
    console.log('');
  }

  /**
   * Show risk assessment
   */
  private showRiskAssessment(risk: any): void {
    const riskScore = risk.riskScore || 50;
    let level: string;
    let color: any;
    let recommendation: string;

    if (riskScore < 30) {
      level = 'LOW';
      color = chalk.green;
      recommendation = 'Portfolio risk is well controlled. Continue monitoring.';
    } else if (riskScore < 60) {
      level = 'MEDIUM';
      color = chalk.yellow;
      recommendation = 'Moderate risk level. Consider diversification strategies.';
    } else if (riskScore < 80) {
      level = 'HIGH';
      color = chalk.red;
      recommendation = 'Elevated risk detected. Review positions and consider reducing exposure.';
    } else {
      level = 'CRITICAL';
      color = chalk.red.bold;
      recommendation = 'CRITICAL risk level. Immediate action recommended to reduce exposure.';
    }

    console.log(color(`  Risk Level: ${level} (Score: ${riskScore}/100)`));
    console.log(`  ${recommendation}`);
    console.log('');
  }

  /**
   * Format P/L with color
   */
  private formatPL(value: number): string {
    const color = value >= 0 ? chalk.green : chalk.red;
    const sign = value >= 0 ? '+' : '';
    return color(`${sign}$${value.toFixed(2)}`);
  }

  /**
   * Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

export default AnalyticsHandler;
