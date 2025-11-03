/**
 * Market Command Handler
 * Handles market data retrieval and analysis operations
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios';
import * as chalk from 'chalk';
import { CommandOptions, MarketQuote, OHLCV, OutputFormat } from '../types';
import Formatter from '../utils/formatter';
import Validator from '../utils/validator';
import ConfigManager from '../utils/config';
import AuthManager from '../utils/auth';

/**
 * Market Handler Class
 * Manages market data operations
 *
 * @example
 * ```bash
 * # Get real-time quote
 * hms market quote AAPL
 *
 * # Get historical data
 * hms market history AAPL --from 2024-01-01 --to 2024-02-01
 *
 * # Calculate indicators
 * hms market indicators AAPL --indicators sma,rsi,macd
 *
 * # Scan markets
 * hms market scan "price > sma(20) AND rsi < 30"
 * ```
 */
export class MarketHandler {
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
   * Get market quote
   *
   * @param symbol - Stock symbol
   * @param options - Command options
   * @example
   * ```bash
   * hms market quote AAPL
   * hms market quote BTC/USD
   * hms market quote AAPL,MSFT,GOOGL
   * ```
   */
  async quote(symbol: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Market Quote');

      const symbols = symbol.split(',').map(s => Validator.validateSymbol(s.trim()));
      const stopLoading = Formatter.loading(`Fetching quotes for ${symbols.join(', ')}...`);

      try {
        const response = await this.apiClient.get('/market/quote', {
          params: { symbols: symbols.join(',') },
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const quotes: MarketQuote[] = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.JSON) {
          console.log(JSON.stringify(quotes, null, 2));
        } else if (format === OutputFormat.TABLE) {
          const quoteData = quotes.map(q => ({
            Symbol: q.symbol,
            Price: `$${q.price.toFixed(2)}`,
            Bid: `$${q.bid.toFixed(2)}`,
            Ask: `$${q.ask.toFixed(2)}`,
            Volume: q.volumeQty.toLocaleString(),
            Change: this.formatChange(q.dayChange, q.dayChangePercent),
            '52W High': `$${q.high52week.toFixed(2)}`,
            '52W Low': `$${q.low52week.toFixed(2)}`
          }));

          console.log(Formatter.format(quoteData, OutputFormat.TABLE));

          // Additional details for single symbol
          if (quotes.length === 1 && options.verbose) {
            const q = quotes[0];
            Formatter.separator();
            console.log(chalk.bold.cyan('\nAdditional Details:\n'));
            const details = {
              'Market Cap': q.marketCap ? `$${(q.marketCap / 1e9).toFixed(2)}B` : 'N/A',
              'P/E Ratio': q.peRatio?.toFixed(2) || 'N/A',
              'Last Updated': new Date(q.timestamp).toLocaleString()
            };
            console.log(Formatter.format(details, OutputFormat.TABLE));
          }
        } else {
          console.log(Formatter.format(quotes, format));
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
   * Get historical data
   *
   * @param symbol - Stock symbol
   * @param options - Command options
   * @example
   * ```bash
   * hms market history AAPL --from 2024-01-01 --to 2024-02-01
   * hms market history AAPL --interval 1d --days 30
   * hms market history AAPL --interval 1h --days 7
   * ```
   */
  async history(symbol: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Historical Data');

      const validatedSymbol = Validator.validateSymbol(symbol);
      const interval = options.interval || '1d';
      const days = options.days || 30;

      const params: any = {
        symbol: validatedSymbol,
        interval,
        days
      };

      if (options.from) {
        params.startDate = Validator.validateDate(options.from);
      }
      if (options.to) {
        params.endDate = Validator.validateDate(options.to);
      }

      const stopLoading = Formatter.loading(`Fetching ${days} days of ${interval} data for ${validatedSymbol}...`);

      try {
        const response = await this.apiClient.get('/market/history', {
          params,
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const history: OHLCV[] = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          // Show last 20 entries for readability
          const displayData = history.slice(-20);
          const historyData = displayData.map(h => ({
            Date: new Date(h.timestamp).toLocaleDateString(),
            Open: `$${h.open.toFixed(2)}`,
            High: `$${h.high.toFixed(2)}`,
            Low: `$${h.low.toFixed(2)}`,
            Close: `$${h.close.toFixed(2)}`,
            Volume: h.volume.toLocaleString()
          }));

          console.log(Formatter.format(historyData, OutputFormat.TABLE));
          console.log(chalk.cyan(`\nShowing last 20 of ${history.length} bars\n`));

          // Summary statistics
          if (options.verbose) {
            const closes = history.map(h => h.close);
            const volumes = history.map(h => h.volume);
            const summary = {
              'Highest Close': `$${Math.max(...closes).toFixed(2)}`,
              'Lowest Close': `$${Math.min(...closes).toFixed(2)}`,
              'Average Close': `$${(closes.reduce((a, b) => a + b, 0) / closes.length).toFixed(2)}`,
              'Average Volume': volumes.reduce((a, b) => a + b, 0) / volumes.length,
              'Total Bars': history.length
            };
            Formatter.separator();
            console.log(chalk.bold.cyan('\nSummary Statistics:\n'));
            console.log(Formatter.format(summary, OutputFormat.TABLE));
          }
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
   * Calculate technical indicators
   *
   * @param symbol - Stock symbol
   * @param options - Command options
   * @example
   * ```bash
   * hms market indicators AAPL --indicators sma,rsi,macd
   * hms market indicators AAPL --indicators sma --period 20
   * hms market indicators AAPL --indicators all
   * ```
   */
  async indicators(symbol: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Technical Indicators');

      const validatedSymbol = Validator.validateSymbol(symbol);
      const indicators = options.indicators ? options.indicators.split(',') : ['sma', 'rsi', 'macd'];
      const period = options.period || 20;

      const params = {
        symbol: validatedSymbol,
        indicators: indicators.join(','),
        period: Validator.validateNumber(period, 'Period', { min: 1, max: 200 })
      };

      const stopLoading = Formatter.loading(`Calculating indicators for ${validatedSymbol}...`);

      try {
        const response = await this.apiClient.get('/market/indicators', {
          params,
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const result = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          console.log(chalk.cyan(`Symbol: ${validatedSymbol}\n`));

          // Current price
          if (result.currentPrice) {
            console.log(chalk.bold(`Current Price: ${chalk.yellow(`$${result.currentPrice.toFixed(2)}`)}\n`));
          }

          // Display each indicator
          Object.entries(result.indicators || {}).forEach(([name, data]: [string, any]) => {
            console.log(chalk.bold.cyan(`${name.toUpperCase()}:\n`));

            if (typeof data === 'object' && !Array.isArray(data)) {
              console.log(Formatter.format(data, OutputFormat.TABLE));
            } else if (Array.isArray(data)) {
              // Show last 10 values
              const recentData = data.slice(-10).map((val: any, idx: number) => ({
                Index: data.length - 10 + idx,
                Value: typeof val === 'number' ? val.toFixed(4) : JSON.stringify(val)
              }));
              console.log(Formatter.format(recentData, OutputFormat.TABLE));
            } else {
              console.log(`  ${chalk.yellow(data)}`);
            }
            console.log('');
          });

          // Signals
          if (result.signals) {
            Formatter.separator();
            console.log(chalk.bold.cyan('Trading Signals:\n'));
            result.signals.forEach((signal: any) => {
              const color = signal.type === 'buy' ? chalk.green : signal.type === 'sell' ? chalk.red : chalk.yellow;
              console.log(color(`  ${signal.type.toUpperCase()}: ${signal.message}`));
            });
            console.log('');
          }

        } else {
          console.log(Formatter.format(result, format));
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
   * Scan markets for opportunities
   *
   * @param criteria - Scan criteria
   * @param options - Command options
   * @example
   * ```bash
   * hms market scan "price > sma(20) AND rsi < 30"
   * hms market scan "volume > avgVolume * 2"
   * hms market scan --preset breakout
   * ```
   */
  async scan(criteria: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Market Scan');

      let scanCriteria: string;

      if (options.preset) {
        // Use preset scan
        const presets: Record<string, string> = {
          'breakout': 'price > sma(20) AND volume > avgVolume * 1.5',
          'oversold': 'rsi < 30 AND price < sma(50)',
          'overbought': 'rsi > 70 AND price > sma(50)',
          'momentum': 'sma(10) > sma(20) AND rsi > 50',
          'reversal': 'rsi < 30 AND macd_signal = bullish'
        };

        scanCriteria = presets[options.preset];
        if (!scanCriteria) {
          throw new Error(`Unknown preset: ${options.preset}. Available: ${Object.keys(presets).join(', ')}`);
        }
      } else {
        scanCriteria = criteria;
      }

      const params = {
        criteria: scanCriteria,
        symbols: options.symbols || 'SP500', // Default to S&P 500
        limit: options.limit || 50
      };

      const stopLoading = Formatter.loading('Scanning markets...');

      try {
        const response = await this.apiClient.post('/market/scan', params, {
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const results = response.data.data;

        if (results.matches.length === 0) {
          Formatter.warning('No matches found');
          console.log(chalk.yellow(`\nCriteria: ${scanCriteria}\n`));
          return;
        }

        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        console.log(chalk.cyan(`Criteria: ${scanCriteria}`));
        console.log(chalk.cyan(`Scanned: ${results.totalScanned} symbols`));
        console.log(chalk.cyan(`Matches: ${results.matches.length}\n`));

        if (format === OutputFormat.TABLE) {
          const scanData = results.matches.map((m: any) => ({
            Symbol: m.symbol,
            Price: `$${m.price.toFixed(2)}`,
            Change: this.formatChange(m.change, m.changePercent),
            Volume: m.volume.toLocaleString(),
            RSI: m.rsi?.toFixed(2) || 'N/A',
            'SMA(20)': m.sma20 ? `$${m.sma20.toFixed(2)}` : 'N/A',
            Score: m.score?.toFixed(2) || 'N/A'
          }));

          console.log(Formatter.format(scanData, OutputFormat.TABLE));
        } else {
          console.log(Formatter.format(results.matches, format));
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
   * Show economic calendar
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms market calendar
   * hms market calendar --days 7
   * hms market calendar --importance high
   * ```
   */
  async calendar(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Economic Calendar');

      const params: any = {
        days: options.days || 7
      };

      if (options.importance) {
        params.importance = Validator.validateString(options.importance, 'Importance', {
          enum: ['low', 'medium', 'high']
        });
      }

      if (options.country) {
        params.country = options.country;
      }

      const stopLoading = Formatter.loading('Fetching economic calendar...');

      try {
        const response = await this.apiClient.get('/market/calendar', {
          params,
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const events = response.data.data;

        if (events.length === 0) {
          Formatter.warning('No events found');
          return;
        }

        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          const calendarData = events.map((e: any) => ({
            Date: new Date(e.date).toLocaleDateString(),
            Time: new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            Event: e.event,
            Country: e.country,
            Importance: this.formatImportance(e.importance),
            Forecast: e.forecast || 'N/A',
            Previous: e.previous || 'N/A'
          }));

          console.log(Formatter.format(calendarData, OutputFormat.TABLE));
          console.log(chalk.cyan(`\nTotal: ${events.length} events\n`));
        } else {
          console.log(Formatter.format(events, format));
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
   * Format price change with color
   */
  private formatChange(absolute: number, percent: number): string {
    const color = absolute >= 0 ? chalk.green : chalk.red;
    const sign = absolute >= 0 ? '+' : '';
    return color(`${sign}$${absolute.toFixed(2)} (${sign}${percent.toFixed(2)}%)`);
  }

  /**
   * Format importance level
   */
  private formatImportance(importance: string): string {
    switch (importance.toLowerCase()) {
      case 'high':
        return chalk.red('HIGH');
      case 'medium':
        return chalk.yellow('MEDIUM');
      case 'low':
        return chalk.gray('LOW');
      default:
        return importance.toUpperCase();
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

export default MarketHandler;
