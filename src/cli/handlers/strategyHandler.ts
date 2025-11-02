/**
 * Strategy Command Handler
 * Handles strategy management, testing, and deployment operations
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios';
import * as chalk from 'chalk';
import * as inquirer from 'inquirer';
import * as fs from 'fs';
import { CommandOptions, StrategyInfo, OutputFormat } from '../types';
import Formatter from '../utils/formatter';
import Validator from '../utils/validator';
import ConfigManager from '../utils/config';
import AuthManager from '../utils/auth';

/**
 * Strategy Handler Class
 * Manages trading strategy lifecycle operations
 *
 * @example
 * ```bash
 * # Create a new strategy
 * hms strategy create my-strategy --file strategy.dsl
 *
 * # List all strategies
 * hms strategy list
 *
 * # Test a strategy
 * hms strategy test strat-123 --symbol AAPL
 *
 * # Deploy a strategy
 * hms strategy deploy strat-123
 * ```
 */
export class StrategyHandler {
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
   * Create new strategy
   *
   * @param name - Strategy name
   * @param options - Command options
   * @example
   * ```bash
   * hms strategy create my-strategy --file strategy.dsl --description "My first strategy"
   * hms strategy create momentum --type momentum --symbols AAPL,MSFT
   * ```
   */
  async create(name: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Create Strategy');

      // Validate strategy name
      Validator.validateString(name, 'Strategy name');

      let dsl: string;
      let description: string = options.description || '';

      // Load DSL from file or prompt
      if (options.file) {
        const filePath = await Validator.validateFilePath(options.file);
        dsl = fs.readFileSync(filePath, 'utf-8');
        Formatter.info(`Loaded strategy from ${options.file}`);
      } else {
        // Interactive DSL input
        const answers = await inquirer.prompt([
          {
            type: 'editor',
            name: 'dsl',
            message: 'Enter strategy DSL:',
            default: '// Define your strategy here\nWHEN price > sma(20) THEN buy(100)',
            validate: (input) => input.length > 10 || 'Strategy DSL is too short'
          },
          {
            type: 'input',
            name: 'description',
            message: 'Description (optional):',
            default: description
          }
        ]);
        dsl = answers.dsl;
        description = answers.description;
      }

      // Create strategy payload
      const payload = {
        name,
        description,
        dsl,
        status: 'inactive',
        symbols: options.symbols ? options.symbols.split(',') : [],
        userId: this.config.getUserId()
      };

      const stopLoading = Formatter.loading('Creating strategy...');

      try {
        const response = await this.apiClient.post('/strategies', payload, {
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const strategy: StrategyInfo = response.data.data;

        Formatter.success(`Strategy created successfully!`);
        console.log(chalk.cyan('\nStrategy Details:'));
        console.log(`  ID: ${chalk.yellow(strategy.id)}`);
        console.log(`  Name: ${chalk.yellow(strategy.name)}`);
        console.log(`  Status: ${chalk.yellow(strategy.status)}`);
        console.log(`  Created: ${chalk.yellow(new Date(strategy.createdAt).toLocaleString())}`);
        console.log('');

        if (this.config.isVerbose()) {
          console.log(chalk.gray('DSL Preview:'));
          console.log(chalk.gray(dsl.split('\n').slice(0, 5).join('\n')));
          console.log('');
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
   * List all strategies
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms strategy list
   * hms strategy list --status active
   * hms strategy list --format json
   * ```
   */
  async list(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Strategies');

      const params: any = {
        userId: this.config.getUserId()
      };

      if (options.status) {
        params.status = Validator.validateString(options.status, 'Status', {
          enum: ['active', 'inactive', 'testing', 'deployed']
        });
      }

      const stopLoading = Formatter.loading('Fetching strategies...');

      try {
        const response = await this.apiClient.get('/strategies', {
          params,
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const strategies: StrategyInfo[] = response.data.data;

        if (strategies.length === 0) {
          Formatter.warning('No strategies found');
          console.log(chalk.yellow('\nUse "hms strategy create" to create your first strategy\n'));
          return;
        }

        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          const tableData = strategies.map(s => ({
            ID: s.id,
            Name: s.name,
            Status: s.status.toUpperCase(),
            'Sharpe Ratio': s.performance?.sharpeRatio?.toFixed(2) || 'N/A',
            'Return': s.performance?.totalReturn
              ? `${(s.performance.totalReturn * 100).toFixed(2)}%`
              : 'N/A',
            'Updated': new Date(s.updatedAt).toLocaleDateString()
          }));

          console.log(Formatter.format(tableData, OutputFormat.TABLE));
          console.log(chalk.cyan(`\nTotal: ${strategies.length} strategies\n`));
        } else {
          console.log(Formatter.format(strategies, format));
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
   * Show strategy details
   *
   * @param id - Strategy ID
   * @param options - Command options
   * @example
   * ```bash
   * hms strategy show strat-123
   * hms strategy show strat-123 --verbose
   * ```
   */
  async show(id: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Strategy Details');

      const strategyId = Validator.validateStrategyId(id);
      const stopLoading = Formatter.loading('Fetching strategy...');

      try {
        const response = await this.apiClient.get(`/strategies/${strategyId}`, {
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const strategy: StrategyInfo = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.JSON) {
          console.log(JSON.stringify(strategy, null, 2));
        } else if (format === OutputFormat.TABLE) {
          const basicInfo = {
            'ID': strategy.id,
            'Name': strategy.name,
            'Description': strategy.description || 'N/A',
            'Status': strategy.status.toUpperCase(),
            'Created': new Date(strategy.createdAt).toLocaleString(),
            'Updated': new Date(strategy.updatedAt).toLocaleString(),
            'Last Backtest': strategy.lastBacktest
              ? new Date(strategy.lastBacktest).toLocaleString()
              : 'Never'
          };

          console.log(Formatter.format(basicInfo, OutputFormat.TABLE));

          // Performance metrics
          if (strategy.performance) {
            Formatter.separator();
            console.log(chalk.bold.cyan('\nPerformance Metrics:\n'));
            const perfData = {
              'Sharpe Ratio': strategy.performance.sharpeRatio.toFixed(2),
              'Total Return': `${(strategy.performance.totalReturn * 100).toFixed(2)}%`,
              'Max Drawdown': `${(strategy.performance.maxDrawdown * 100).toFixed(2)}%`,
              'Win Rate': `${(strategy.performance.winRate * 100).toFixed(2)}%`
            };
            console.log(Formatter.format(perfData, OutputFormat.TABLE));
          }

          // DSL preview
          if (options.verbose || options.showDsl) {
            Formatter.separator();
            console.log(chalk.bold.cyan('\nStrategy DSL:\n'));
            console.log(chalk.gray(strategy.dsl));
            console.log('');
          }
        } else {
          console.log(Formatter.format(strategy, format));
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
   * Test strategy with sample data
   *
   * @param id - Strategy ID
   * @param options - Command options
   * @example
   * ```bash
   * hms strategy test strat-123 --symbol AAPL --days 30
   * hms strategy test strat-123 --symbol AAPL --from 2024-01-01 --to 2024-02-01
   * ```
   */
  async test(id: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Test Strategy');

      const strategyId = Validator.validateStrategyId(id);
      const symbol = options.symbol ? Validator.validateSymbol(options.symbol) : 'AAPL';
      const days = options.days || 30;

      const payload: any = {
        symbol,
        days,
        mode: 'test'
      };

      if (options.from) {
        payload.startDate = Validator.validateDate(options.from);
      }
      if (options.to) {
        payload.endDate = Validator.validateDate(options.to);
      }

      const stopLoading = Formatter.loading(`Testing strategy with ${symbol}...`);

      try {
        const response = await this.apiClient.post(
          `/strategies/${strategyId}/test`,
          payload,
          { headers: this.auth.getAuthHeader() }
        );

        stopLoading();

        const result = response.data.data;

        Formatter.success('Test completed successfully!');
        console.log(chalk.cyan('\nTest Results:'));
        console.log(`  Symbol: ${chalk.yellow(symbol)}`);
        console.log(`  Period: ${chalk.yellow(days)} days`);
        console.log(`  Total Trades: ${chalk.yellow(result.totalTrades || 0)}`);
        console.log(`  Win Rate: ${chalk.yellow((result.winRate * 100 || 0).toFixed(2))}%`);
        console.log(`  Return: ${chalk.yellow((result.return * 100 || 0).toFixed(2))}%`);
        console.log(`  Sharpe Ratio: ${chalk.yellow(result.sharpeRatio?.toFixed(2) || 'N/A')}`);
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
   * Optimize strategy parameters
   *
   * @param id - Strategy ID
   * @param options - Command options
   * @example
   * ```bash
   * hms strategy optimize strat-123 --symbol AAPL --metric sharpe
   * hms strategy optimize strat-123 --symbol AAPL --iterations 100
   * ```
   */
  async optimize(id: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Optimize Strategy');

      const strategyId = Validator.validateStrategyId(id);
      const symbol = options.symbol ? Validator.validateSymbol(options.symbol) : 'AAPL';
      const metric = options.metric || 'sharpe';
      const iterations = options.iterations || 50;

      const payload = {
        symbol,
        metric,
        iterations: Validator.validateNumber(iterations, 'Iterations', { min: 10, max: 500 })
      };

      const stopLoading = Formatter.loading(`Optimizing strategy (${iterations} iterations)...`);

      try {
        const response = await this.apiClient.post(
          `/strategies/${strategyId}/optimize`,
          payload,
          { headers: this.auth.getAuthHeader() }
        );

        stopLoading();

        const result = response.data.data;

        Formatter.success('Optimization completed!');
        console.log(chalk.cyan('\nOptimization Results:'));
        console.log(`  Best ${metric}: ${chalk.yellow(result.bestScore?.toFixed(4) || 'N/A')}`);
        console.log(`  Iterations: ${chalk.yellow(result.iterations)}`);
        console.log(`  Time: ${chalk.yellow(result.duration || 'N/A')}s`);
        console.log('');

        if (result.parameters) {
          console.log(chalk.bold.cyan('Optimized Parameters:\n'));
          console.log(Formatter.format(result.parameters, OutputFormat.TABLE));
          console.log('');
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
   * Run full backtest
   *
   * @param id - Strategy ID
   * @param options - Command options
   * @example
   * ```bash
   * hms strategy backtest strat-123 --symbol AAPL --from 2023-01-01 --to 2024-01-01
   * hms strategy backtest strat-123 --portfolio --capital 100000
   * ```
   */
  async backtest(id: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Backtest Strategy');

      const strategyId = Validator.validateStrategyId(id);

      const payload: any = {
        symbol: options.symbol ? Validator.validateSymbol(options.symbol) : 'AAPL',
        initialCapital: options.capital || 100000,
        commission: options.commission || 0.001
      };

      if (options.from) {
        payload.startDate = Validator.validateDate(options.from);
      }
      if (options.to) {
        payload.endDate = Validator.validateDate(options.to);
      }

      const stopLoading = Formatter.loading('Running backtest (this may take a while)...');

      try {
        const response = await this.apiClient.post(
          `/strategies/${strategyId}/backtest`,
          payload,
          { headers: this.auth.getAuthHeader() }
        );

        stopLoading();

        const result = response.data.data;

        Formatter.success('Backtest completed!');
        console.log(chalk.cyan('\nBacktest Results:\n'));

        const results = {
          'Initial Capital': `$${payload.initialCapital.toLocaleString()}`,
          'Final Value': `$${result.finalValue?.toLocaleString() || 'N/A'}`,
          'Total Return': `${(result.totalReturn * 100 || 0).toFixed(2)}%`,
          'Sharpe Ratio': result.sharpeRatio?.toFixed(2) || 'N/A',
          'Max Drawdown': `${(result.maxDrawdown * 100 || 0).toFixed(2)}%`,
          'Total Trades': result.totalTrades || 0,
          'Win Rate': `${(result.winRate * 100 || 0).toFixed(2)}%`,
          'Profit Factor': result.profitFactor?.toFixed(2) || 'N/A'
        };

        console.log(Formatter.format(results, OutputFormat.TABLE));
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
   * Deploy strategy to live trading
   *
   * @param id - Strategy ID
   * @param options - Command options
   * @example
   * ```bash
   * hms strategy deploy strat-123
   * hms strategy deploy strat-123 --capital 50000 --symbols AAPL,MSFT
   * ```
   */
  async deploy(id: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Deploy Strategy');

      const strategyId = Validator.validateStrategyId(id);

      // Confirm deployment
      const confirmation = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: chalk.yellow('Deploy strategy to live trading?'),
          default: false
        }
      ]);

      if (!confirmation.confirmed) {
        Formatter.info('Deployment cancelled');
        return;
      }

      const payload: any = {
        capital: options.capital || 100000,
        symbols: options.symbols ? options.symbols.split(',') : []
      };

      const stopLoading = Formatter.loading('Deploying strategy...');

      try {
        const response = await this.apiClient.post(
          `/strategies/${strategyId}/deploy`,
          payload,
          { headers: this.auth.getAuthHeader() }
        );

        stopLoading();

        const result = response.data.data;

        Formatter.success('Strategy deployed successfully!');
        console.log(chalk.cyan('\nDeployment Details:'));
        console.log(`  Strategy ID: ${chalk.yellow(result.strategyId)}`);
        console.log(`  Status: ${chalk.green('DEPLOYED')}`);
        console.log(`  Capital: ${chalk.yellow(`$${payload.capital.toLocaleString()}`)}`);
        console.log(`  Deployed At: ${chalk.yellow(new Date().toLocaleString())}`);
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
   * Delete strategy
   *
   * @param id - Strategy ID
   * @param options - Command options
   * @example
   * ```bash
   * hms strategy delete strat-123
   * hms strategy delete strat-123 --force
   * ```
   */
  async delete(id: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Delete Strategy');

      const strategyId = Validator.validateStrategyId(id);

      // Confirm deletion
      if (!options.force) {
        const confirmation = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: chalk.red('Permanently delete this strategy?'),
            default: false
          }
        ]);

        if (!confirmation.confirmed) {
          Formatter.info('Deletion cancelled');
          return;
        }
      }

      const stopLoading = Formatter.loading('Deleting strategy...');

      try {
        await this.apiClient.delete(`/strategies/${strategyId}`, {
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        Formatter.success('Strategy deleted successfully');

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

export default StrategyHandler;
