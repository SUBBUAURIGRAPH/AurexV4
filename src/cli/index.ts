#!/usr/bin/env node

/**
 * HMS CLI - Command Line Interface
 * Main entry point for CLI operations
 * @version 1.0.0
 */

import * as yargs from 'yargs';
import * as chalk from 'chalk';
import { AnalyticsCLI } from './analyticsCLI';
import ConfigManager from './utils/config';
import AuthManager from './utils/auth';
import Formatter from './utils/formatter';
import { OutputFormat } from './types';

class HMSCLI {
  private config = ConfigManager.getInstance();
  private auth = AuthManager.getInstance();

  /**
   * Initialize and run CLI
   */
  async run(args?: string[]): Promise<void> {
    try {
      const yargsInstance = yargs(args || process.argv.slice(2))
        .option('verbose', {
          alias: 'v',
          description: 'Enable verbose output',
          type: 'boolean',
          default: false
        })
        .option('format', {
          alias: 'f',
          description: 'Output format (table, json, csv, yaml)',
          type: 'string',
          default: 'table'
        })
        .option('config', {
          description: 'Config file path',
          type: 'string'
        })
        .option('user',  {
          alias: 'u',
          description: 'User ID',
          type: 'string'
        })
        .global(['verbose', 'format', 'config', 'user'])
        .help('help', 'Show help')
        .alias('help', 'h')
        .version('version', '1.0.0')
        .alias('version', 'v')
        .command(
          'account <subcommand>',
          'Manage account and authentication',
          (yargs) => this.setupAccountCommands(yargs),
          (argv) => this.handleAccountCommand(argv)
        )
        .command(
          'strategy <subcommand>',
          'Manage trading strategies',
          (yargs) => this.setupStrategyCommands(yargs),
          (argv) => this.handleStrategyCommand(argv)
        )
        .command(
          'portfolio <subcommand>',
          'View and manage portfolio',
          (yargs) => this.setupPortfolioCommands(yargs),
          (argv) => this.handlePortfolioCommand(argv)
        )
        .command(
          'order <subcommand>',
          'Manage orders',
          (yargs) => this.setupOrderCommands(yargs),
          (argv) => this.handleOrderCommand(argv)
        )
        .command(
          'market <subcommand>',
          'Get market data',
          (yargs) => this.setupMarketCommands(yargs),
          (argv) => this.handleMarketCommand(argv)
        )
        .command(
          'analytics <subcommand>',
          'View analytics and reports',
          (yargs) => this.setupAnalyticsCommands(yargs),
          (argv) => this.handleAnalyticsCommand(argv)
        )
        .command(
          'paper <subcommand>',
          'Paper trading operations',
          (yargs) => this.setupPaperCommands(yargs),
          (argv) => this.handlePaperCommand(argv)
        )
        .command(
          'system <subcommand>',
          'System commands',
          (yargs) => this.setupSystemCommands(yargs),
          (argv) => this.handleSystemCommand(argv)
        )
        .demandCommand(1, 'Please specify a command')
        .strict()
        .wrap(Math.min(100, yargs.terminalWidth()));

      const argv = await yargsInstance.argv;

      // Apply global options
      if (argv.verbose) {
        this.config.setVerbose(true);
      }
      if (argv.format) {
        this.config.setOutputFormat(argv.format as any);
      }
      if (argv.user) {
        this.config.setUserId(argv.user);
      }
    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message, (error as any).suggestion);
      } else {
        Formatter.error('An unexpected error occurred');
      }
      process.exit(1);
    }
  }

  /**
   * Setup account commands
   */
  private setupAccountCommands(yargs: any) {
    return yargs
      .command('login', 'Login to HMS account')
      .command('status', 'Show account status')
      .command('config', 'Manage account configuration')
      .command('logout', 'Logout from account');
  }

  /**
   * Setup strategy commands
   */
  private setupStrategyCommands(yargs: any) {
    return yargs
      .command('create <name>', 'Create new strategy')
      .command('list', 'List all strategies')
      .command('show <id>', 'Show strategy details')
      .command('test <id>', 'Test strategy')
      .command('optimize <id>', 'Optimize strategy parameters')
      .command('backtest <id>', 'Run full backtest')
      .command('deploy <id>', 'Deploy strategy')
      .command('delete <id>', 'Delete strategy');
  }

  /**
   * Setup portfolio commands
   */
  private setupPortfolioCommands(yargs: any) {
    return yargs
      .command('show', 'Show portfolio details')
      .command('allocation', 'Show asset allocation')
      .command('diversification', 'Show diversification analysis')
      .command('rebalance', 'Rebalance portfolio')
      .command('performance', 'Show portfolio performance')
      .command('exposure', 'Show risk exposure')
      .command('history', 'Show portfolio history');
  }

  /**
   * Setup order commands
   */
  private setupOrderCommands(yargs: any) {
    return yargs
      .command('create', 'Create new order')
      .command('list', 'List active orders')
      .command('show <id>', 'Show order details')
      .command('cancel <id>', 'Cancel order')
      .command('history', 'Show order history')
      .command('templates', 'Show order templates');
  }

  /**
   * Setup market commands
   */
  private setupMarketCommands(yargs: any) {
    return yargs
      .command('quote <symbol>', 'Get market quote')
      .command('history <symbol>', 'Get historical data')
      .command('indicators <symbol>', 'Calculate indicators')
      .command('scan <criteria>', 'Scan markets')
      .command('calendar', 'Show economic calendar');
  }

  /**
   * Setup analytics commands
   */
  private async setupAnalyticsCommands(yargs: any) {
    return yargs
      .command('performance', 'Show performance metrics')
      .command('risk', 'Show risk metrics')
      .command('trades', 'Analyze trades')
      .command('report', 'Generate analytics report')
      .command('export <format>', 'Export analytics data');
  }

  /**
   * Setup paper trading commands
   */
  private setupPaperCommands(yargs: any) {
    return yargs
      .command('create <symbol>', 'Create paper trade')
      .command('list', 'List paper trades')
      .command('summary', 'Show paper trading summary')
      .command('close <id>', 'Close paper trade');
  }

  /**
   * Setup system commands
   */
  private setupSystemCommands(yargs: any) {
    return yargs
      .command('config', 'Show system configuration')
      .command('health', 'Check system health')
      .command('version', 'Show version')
      .command('update', 'Check for updates');
  }

  /**
   * Handle account command
   */
  private async handleAccountCommand(argv: any) {
    Formatter.info('Account command: ' + argv.subcommand);
  }

  /**
   * Handle strategy command
   */
  private async handleStrategyCommand(argv: any) {
    Formatter.info('Strategy command: ' + argv.subcommand);
  }

  /**
   * Handle portfolio command
   */
  private async handlePortfolioCommand(argv: any) {
    Formatter.info('Portfolio command: ' + argv.subcommand);
  }

  /**
   * Handle order command
   */
  private async handleOrderCommand(argv: any) {
    Formatter.info('Order command: ' + argv.subcommand);
  }

  /**
   * Handle market command
   */
  private async handleMarketCommand(argv: any) {
    Formatter.info('Market command: ' + argv.subcommand);
  }

  /**
   * Handle analytics command
   */
  private async handleAnalyticsCommand(argv: any) {
    if (argv.subcommand === 'performance') {
      const analyticsCLI = new AnalyticsCLI();
      await analyticsCLI.run(['performance', '--user', argv.user || 'default-user']);
    } else {
      Formatter.info('Analytics command: ' + argv.subcommand);
    }
  }

  /**
   * Handle paper command
   */
  private async handlePaperCommand(argv: any) {
    Formatter.info('Paper trading command: ' + argv.subcommand);
  }

  /**
   * Handle system command
   */
  private async handleSystemCommand(argv: any) {
    switch (argv.subcommand) {
      case 'config':
        this.showConfig();
        break;
      case 'health':
        this.checkHealth();
        break;
      case 'version':
        console.log(chalk.blue('HMS CLI v1.0.0'));
        break;
      case 'update':
        Formatter.info('Checking for updates...');
        break;
      default:
        Formatter.warning(`Unknown system command: ${argv.subcommand}`);
    }
  }

  /**
   * Show configuration
   */
  private showConfig(): void {
    const configData = this.config.getAll();
    Formatter.header('System Configuration');
    console.log(Formatter.format(configData, OutputFormat.TABLE));
  }

  /**
   * Check system health
   */
  private async checkHealth(): Promise<void> {
    Formatter.header('System Health Check');
    const health = {
      'CLI Version': '1.0.0',
      'Config Loaded': this.config.getConfigPath(),
      'Authenticated': this.auth.isAuthenticated() ? 'Yes' : 'No',
      'API URL': this.config.getApiUrl(),
      'Output Format': this.config.getOutputFormat()
    };
    console.log(Formatter.format(health, OutputFormat.TABLE));
  }
}

// Run CLI if executed directly
if (require.main === module) {
  const cli = new HMSCLI();
  cli.run().catch(error => {
    Formatter.error(error.message || 'Unknown error');
    process.exit(1);
  });
}

export default HMSCLI;
