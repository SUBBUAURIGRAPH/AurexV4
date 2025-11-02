/**
 * Paper Trading Command Handler
 * Handles paper trading (simulated trading) operations
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios';
import * as chalk from 'chalk';
import * as inquirer from 'inquirer';
import { CommandOptions, OutputFormat } from '../types';
import Formatter from '../utils/formatter';
import Validator from '../utils/validator';
import ConfigManager from '../utils/config';
import AuthManager from '../utils/auth';

/**
 * Paper Trading Handler Class
 * Manages simulated trading operations
 *
 * @example
 * ```bash
 * # Create paper trading account
 * hms paper create AAPL --quantity 100 --capital 100000
 *
 * # List paper trades
 * hms paper list
 *
 * # View paper trading summary
 * hms paper summary
 *
 * # Close paper trade
 * hms paper close trade-123
 * ```
 */
export class PaperHandler {
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
   * Create paper trade
   *
   * @param symbol - Trading symbol
   * @param options - Command options
   * @example
   * ```bash
   * hms paper create AAPL --quantity 100
   * hms paper create AAPL --side buy --quantity 100 --type limit --price 150.00
   * hms paper create MSFT --side sell --quantity 50
   * ```
   */
  async create(symbol: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Create Paper Trade');

      const validatedSymbol = Validator.validateSymbol(symbol);

      let tradeData: any = {
        symbol: validatedSymbol,
        side: options.side || 'buy',
        quantity: options.quantity || 100,
        type: options.type || 'market'
      };

      // Interactive mode if not all params provided
      if (!options.quantity || !options.side) {
        const answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'side',
            message: 'Trade Side:',
            choices: ['buy', 'sell'],
            default: tradeData.side
          },
          {
            type: 'input',
            name: 'quantity',
            message: 'Quantity:',
            default: tradeData.quantity.toString(),
            validate: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0 || 'Must be positive'
          },
          {
            type: 'list',
            name: 'type',
            message: 'Order Type:',
            choices: ['market', 'limit'],
            default: tradeData.type
          }
        ]);

        tradeData = { ...tradeData, ...answers };
      }

      // Validate
      tradeData.side = Validator.validateString(tradeData.side, 'Side', {
        enum: ['buy', 'sell']
      });
      tradeData.quantity = Validator.validateQuantity(parseFloat(tradeData.quantity));
      tradeData.type = Validator.validateString(tradeData.type, 'Type', {
        enum: ['market', 'limit']
      });

      // Add price for limit orders
      if (tradeData.type === 'limit') {
        if (!options.price) {
          const priceAnswer = await inquirer.prompt([
            {
              type: 'input',
              name: 'price',
              message: 'Limit Price:',
              validate: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0 || 'Must be positive'
            }
          ]);
          tradeData.price = parseFloat(priceAnswer.price);
        } else {
          tradeData.price = Validator.validatePrice(parseFloat(options.price));
        }
      }

      const payload = {
        userId: this.config.getUserId(),
        ...tradeData
      };

      // Confirm trade
      console.log(chalk.cyan('\nPaper Trade Summary:'));
      console.log(`  ${tradeData.side.toUpperCase()} ${tradeData.quantity} ${validatedSymbol}`);
      console.log(`  Type: ${tradeData.type.toUpperCase()}`);
      if (tradeData.price) console.log(`  Price: $${tradeData.price.toFixed(2)}`);
      console.log('');

      const confirmation = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Execute paper trade?',
          default: true
        }
      ]);

      if (!confirmation.confirmed) {
        Formatter.info('Paper trade cancelled');
        return;
      }

      const stopLoading = Formatter.loading('Executing paper trade...');

      try {
        const response = await this.apiClient.post('/paper-trading/trades', payload, {
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const trade = response.data.data;

        Formatter.success('Paper trade executed successfully!');
        console.log(chalk.cyan('\nTrade Details:'));
        console.log(`  Trade ID: ${chalk.yellow(trade.id)}`);
        console.log(`  Symbol: ${chalk.yellow(trade.symbol)}`);
        console.log(`  Side: ${chalk.yellow(trade.side.toUpperCase())}`);
        console.log(`  Quantity: ${chalk.yellow(trade.quantity)}`);
        console.log(`  Entry Price: ${chalk.yellow(`$${trade.entryPrice.toFixed(2)}`)}`);
        console.log(`  Status: ${chalk.yellow(trade.status.toUpperCase())}`);
        console.log(`  Created: ${chalk.yellow(new Date(trade.createdAt).toLocaleString())}`);
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
   * List paper trades
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms paper list
   * hms paper list --status open
   * hms paper list --symbol AAPL
   * ```
   */
  async list(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Paper Trades');

      const params: any = {
        userId: this.config.getUserId()
      };

      if (options.status) {
        params.status = Validator.validateString(options.status, 'Status', {
          enum: ['open', 'closed', 'all']
        });
      }

      if (options.symbol) {
        params.symbol = Validator.validateSymbol(options.symbol);
      }

      const stopLoading = Formatter.loading('Fetching paper trades...');

      try {
        const response = await this.apiClient.get('/paper-trading/trades', {
          params,
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const trades = response.data.data;

        if (trades.length === 0) {
          Formatter.warning('No paper trades found');
          console.log(chalk.yellow('\nUse "hms paper create" to create your first paper trade\n'));
          return;
        }

        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          const tradesData = trades.map((t: any) => ({
            ID: t.id,
            Symbol: t.symbol,
            Side: t.side.toUpperCase(),
            Quantity: t.quantity.toLocaleString(),
            Entry: `$${t.entryPrice.toFixed(2)}`,
            Current: t.currentPrice ? `$${t.currentPrice.toFixed(2)}` : 'N/A',
            'P/L': t.profitLoss !== undefined ? this.formatPL(t.profitLoss) : 'N/A',
            'P/L %': t.profitLossPercent !== undefined
              ? this.formatPercentPL(t.profitLossPercent)
              : 'N/A',
            Status: this.formatStatus(t.status),
            Opened: new Date(t.createdAt).toLocaleDateString()
          }));

          console.log(Formatter.format(tradesData, OutputFormat.TABLE));
          console.log(chalk.cyan(`\nTotal: ${trades.length} trades\n`));

          // Summary stats
          const openTrades = trades.filter((t: any) => t.status === 'open');
          const totalPL = trades.reduce((sum: number, t: any) => sum + (t.profitLoss || 0), 0);

          console.log(chalk.bold.cyan('Summary:'));
          console.log(`  Open Trades: ${chalk.yellow(openTrades.length)}`);
          console.log(`  Total P/L: ${this.formatPL(totalPL)}`);
          console.log('');

        } else {
          console.log(Formatter.format(trades, format));
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
   * Show paper trading summary
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms paper summary
   * hms paper summary --period 30d
   * ```
   */
  async summary(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Paper Trading Summary');

      const params: any = {
        userId: this.config.getUserId(),
        period: options.period || 'all'
      };

      const stopLoading = Formatter.loading('Generating summary...');

      try {
        const response = await this.apiClient.get('/paper-trading/summary', {
          params,
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const summary = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.JSON) {
          console.log(JSON.stringify(summary, null, 2));
        } else if (format === OutputFormat.TABLE) {
          // Account metrics
          console.log(chalk.bold.cyan('Account Metrics:\n'));
          const accountMetrics = {
            'Initial Capital': `$${summary.initialCapital.toLocaleString()}`,
            'Current Value': `$${summary.currentValue.toLocaleString()}`,
            'Cash Available': `$${summary.cashAvailable.toLocaleString()}`,
            'Invested Value': `$${summary.investedValue.toLocaleString()}`,
            'Total P/L': this.formatPL(summary.totalProfitLoss),
            'Total Return': `${(summary.totalReturn * 100).toFixed(2)}%`
          };
          console.log(Formatter.format(accountMetrics, OutputFormat.TABLE));

          // Trading statistics
          Formatter.separator();
          console.log(chalk.bold.cyan('\nTrading Statistics:\n'));
          const tradingStats = {
            'Total Trades': summary.totalTrades,
            'Open Trades': summary.openTrades,
            'Closed Trades': summary.closedTrades,
            'Winning Trades': summary.winningTrades,
            'Losing Trades': summary.losingTrades,
            'Win Rate': `${(summary.winRate * 100).toFixed(2)}%`,
            'Average Win': `$${summary.avgWin.toFixed(2)}`,
            'Average Loss': `$${Math.abs(summary.avgLoss).toFixed(2)}`,
            'Profit Factor': summary.profitFactor.toFixed(2)
          };
          console.log(Formatter.format(tradingStats, OutputFormat.TABLE));

          // Performance metrics
          if (summary.performance) {
            Formatter.separator();
            console.log(chalk.bold.cyan('\nPerformance Metrics:\n'));
            const perfMetrics = {
              'Sharpe Ratio': summary.performance.sharpeRatio?.toFixed(2) || 'N/A',
              'Max Drawdown': `${(summary.performance.maxDrawdown * 100).toFixed(2)}%`,
              'Best Trade': `$${summary.performance.bestTrade.toFixed(2)}`,
              'Worst Trade': `$${summary.performance.worstTrade.toFixed(2)}`
            };
            console.log(Formatter.format(perfMetrics, OutputFormat.TABLE));
          }

          // Top positions
          if (summary.topPositions && summary.topPositions.length > 0) {
            Formatter.separator();
            console.log(chalk.bold.cyan('\nTop Positions by P/L:\n'));
            const positionsData = summary.topPositions.slice(0, 5).map((p: any) => ({
              Symbol: p.symbol,
              Quantity: p.quantity,
              'Entry Price': `$${p.entryPrice.toFixed(2)}`,
              'Current Price': `$${p.currentPrice.toFixed(2)}`,
              'P/L': this.formatPL(p.profitLoss)
            }));
            console.log(Formatter.format(positionsData, OutputFormat.TABLE));
          }

        } else {
          console.log(Formatter.format(summary, format));
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
   * Close paper trade
   *
   * @param id - Trade ID
   * @param options - Command options
   * @example
   * ```bash
   * hms paper close trade-123
   * hms paper close trade-123 --price 155.00
   * ```
   */
  async close(id: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Close Paper Trade');

      const payload: any = {
        userId: this.config.getUserId()
      };

      // Optional exit price
      if (options.price) {
        payload.exitPrice = Validator.validatePrice(parseFloat(options.price));
      }

      // Confirm closure
      const confirmation = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: `Close paper trade ${id}?`,
          default: true
        }
      ]);

      if (!confirmation.confirmed) {
        Formatter.info('Trade closure cancelled');
        return;
      }

      const stopLoading = Formatter.loading('Closing paper trade...');

      try {
        const response = await this.apiClient.post(
          `/paper-trading/trades/${id}/close`,
          payload,
          { headers: this.auth.getAuthHeader() }
        );

        stopLoading();

        const trade = response.data.data;

        Formatter.success('Paper trade closed successfully!');
        console.log(chalk.cyan('\nTrade Summary:'));
        console.log(`  Trade ID: ${chalk.yellow(trade.id)}`);
        console.log(`  Symbol: ${chalk.yellow(trade.symbol)}`);
        console.log(`  Side: ${chalk.yellow(trade.side.toUpperCase())}`);
        console.log(`  Quantity: ${chalk.yellow(trade.quantity)}`);
        console.log(`  Entry Price: ${chalk.yellow(`$${trade.entryPrice.toFixed(2)}`)}`);
        console.log(`  Exit Price: ${chalk.yellow(`$${trade.exitPrice.toFixed(2)}`)}`);
        console.log(`  P/L: ${this.formatPL(trade.profitLoss)}`);
        console.log(`  P/L %: ${this.formatPercentPL(trade.profitLossPercent)}`);
        console.log(`  Hold Time: ${chalk.yellow(this.formatDuration(trade.holdTime))}`);
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
   * Reset paper trading account
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms paper reset --capital 100000
   * ```
   */
  async reset(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Reset Paper Trading Account');

      // Confirm reset
      const confirmation = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: chalk.red('Reset paper trading account? This will close all positions and reset capital.'),
          default: false
        }
      ]);

      if (!confirmation.confirmed) {
        Formatter.info('Reset cancelled');
        return;
      }

      const capital = options.capital || 100000;
      const payload = {
        userId: this.config.getUserId(),
        initialCapital: Validator.validateNumber(capital, 'Initial Capital', { min: 1000 })
      };

      const stopLoading = Formatter.loading('Resetting account...');

      try {
        const response = await this.apiClient.post('/paper-trading/reset', payload, {
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        Formatter.success('Paper trading account reset successfully!');
        console.log(chalk.cyan('\nNew Account:'));
        console.log(`  Initial Capital: ${chalk.yellow(`$${capital.toLocaleString()}`)}`);
        console.log(`  All Positions: ${chalk.yellow('Closed')}`);
        console.log(`  Trade History: ${chalk.yellow('Archived')}`);
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
   * Format P/L with color
   */
  private formatPL(value: number): string {
    const color = value >= 0 ? chalk.green : chalk.red;
    const sign = value >= 0 ? '+' : '';
    return color(`${sign}$${value.toFixed(2)}`);
  }

  /**
   * Format percent P/L with color
   */
  private formatPercentPL(value: number): string {
    const color = value >= 0 ? chalk.green : chalk.red;
    const sign = value >= 0 ? '+' : '';
    return color(`${sign}${value.toFixed(2)}%`);
  }

  /**
   * Format trade status with color
   */
  private formatStatus(status: string): string {
    switch (status.toLowerCase()) {
      case 'open':
        return chalk.yellow(status.toUpperCase());
      case 'closed':
        return chalk.gray(status.toUpperCase());
      default:
        return status.toUpperCase();
    }
  }

  /**
   * Format duration
   */
  private formatDuration(milliseconds: number): string {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h`;
    return '<1h';
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

export default PaperHandler;
