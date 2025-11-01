/**
 * Output Formatting Utilities
 * Format data for various output formats (table, JSON, CSV, YAML)
 * @version 1.0.0
 */

import * as Table from 'cli-table3';
import * as chalk from 'chalk';
import { OutputFormat, FormatterOptions } from '../types';

export class Formatter {
  /**
   * Format data based on output format
   */
  static format(data: any, format: OutputFormat, options?: FormatterOptions): string {
    switch (format) {
      case OutputFormat.TABLE:
        return this.formatTable(data, options);
      case OutputFormat.JSON:
        return this.formatJSON(data);
      case OutputFormat.CSV:
        return this.formatCSV(data, options);
      case OutputFormat.YAML:
        return this.formatYAML(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Format data as table
   */
  static formatTable(data: any, options?: FormatterOptions): string {
    if (Array.isArray(data)) {
      return this.formatArrayAsTable(data, options);
    } else {
      return this.formatObjectAsTable(data, options);
    }
  }

  /**
   * Format array as table
   */
  private static formatArrayAsTable(data: any[], options?: FormatterOptions): string {
    if (data.length === 0) {
      return chalk.yellow('No data to display');
    }

    const table = new Table({
      head: options?.headers || Object.keys(data[0]).map(k => chalk.cyan(k)),
      style: { head: [], border: ['cyan'] },
      wordWrap: true,
      colWidths: this.calculateColWidths(data, options)
    });

    data.forEach((row: any) => {
      const values = (options?.headers || Object.keys(row)).map(key => {
        const value = row[key];
        if (value === null || value === undefined) return '-';
        if (typeof value === 'boolean') return value ? chalk.green('✓') : chalk.red('✗');
        if (typeof value === 'number') return this.formatNumber(value);
        return String(value).substring(0, options?.maxWidth || 50);
      });
      table.push(values);
    });

    return table.toString();
  }

  /**
   * Format object as table
   */
  private static formatObjectAsTable(obj: any, options?: FormatterOptions): string {
    const table = new Table({
      style: { head: [], border: ['cyan'] },
      wordWrap: true
    });

    Object.entries(obj).forEach(([key, value]: [string, any]) => {
      const displayValue = this.formatValue(value);
      table.push([chalk.cyan(key), displayValue]);
    });

    return table.toString();
  }

  /**
   * Format as JSON
   */
  private static formatJSON(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Format as CSV
   */
  private static formatCSV(data: any, options?: FormatterOptions): string {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const headers = options?.headers || Object.keys(data[0]);
    const headerLine = headers.join(',');

    const rows = data.map((row: any) =>
      headers.map(key => {
        const value = row[key];
        if (value === null || value === undefined) return '';
        const stringValue = String(value).replace(/"/g, '""');
        return `"${stringValue}"`;
      }).join(',')
    );

    return [headerLine, ...rows].join('\n');
  }

  /**
   * Format as YAML
   */
  private static formatYAML(data: any, indent: number = 0): string {
    const spaces = ' '.repeat(indent);
    const lines: string[] = [];

    if (Array.isArray(data)) {
      data.forEach((item, idx) => {
        if (typeof item === 'object' && item !== null) {
          lines.push(`${spaces}- ${Object.keys(item)[0]}:`);
          lines.push(this.formatYAML(item, indent + 2).substring(indent + 2));
        } else {
          lines.push(`${spaces}- ${item}`);
        }
      });
    } else if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]: [string, any]) => {
        if (typeof value === 'object' && value !== null) {
          lines.push(`${spaces}${key}:`);
          lines.push(this.formatYAML(value, indent + 2));
        } else {
          lines.push(`${spaces}${key}: ${value}`);
        }
      });
    }

    return lines.join('\n');
  }

  /**
   * Format a value for display
   */
  private static formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'boolean') {
      return value ? chalk.green('✓') : chalk.red('✗');
    }
    if (typeof value === 'number') {
      return this.formatNumber(value);
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Format number with proper precision
   */
  private static formatNumber(value: number): string {
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }

    // Percentage values
    if (Math.abs(value) < 1) {
      return `${(value * 100).toFixed(2)}%`;
    }

    // Regular decimals
    return value.toFixed(2);
  }

  /**
   * Calculate column widths for table
   */
  private static calculateColWidths(data: any[], options?: FormatterOptions): number[] {
    const headers = options?.headers || Object.keys(data[0]);
    const maxWidth = options?.maxWidth || 40;

    return headers.map(header => {
      const values = [header, ...data.map(row => String(row[header] || ''))];
      const maxLength = Math.max(...values.map(v => v.length));
      return Math.min(maxLength + 2, maxWidth);
    });
  }

  /**
   * Display success message
   */
  static success(message: string): void {
    console.log(chalk.green('✓'), chalk.green(message));
  }

  /**
   * Display error message
   */
  static error(message: string, suggestion?: string): void {
    console.error(chalk.red('✗'), chalk.red(message));
    if (suggestion) {
      console.error(chalk.yellow('💡'), chalk.yellow(suggestion));
    }
  }

  /**
   * Display warning message
   */
  static warning(message: string): void {
    console.warn(chalk.yellow('⚠'), chalk.yellow(message));
  }

  /**
   * Display info message
   */
  static info(message: string): void {
    console.log(chalk.blue('ℹ'), chalk.blue(message));
  }

  /**
   * Display section header
   */
  static header(title: string): void {
    console.log('\n' + chalk.bold.cyan('═'.repeat(50)));
    console.log(chalk.bold.cyan(title));
    console.log(chalk.bold.cyan('═'.repeat(50)) + '\n');
  }

  /**
   * Display a separator
   */
  static separator(): void {
    console.log(chalk.gray('─'.repeat(50)));
  }

  /**
   * Display loading spinner
   */
  static loading(message: string): () => void {
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let index = 0;

    const interval = setInterval(() => {
      process.stdout.write(`\r${spinner[index % spinner.length]} ${message}`);
      index++;
    }, 80);

    return () => {
      clearInterval(interval);
      process.stdout.write('\r');
    };
  }
}

export default Formatter;
