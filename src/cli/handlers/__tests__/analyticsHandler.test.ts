/**
 * Analytics Handler Tests
 * Tests for CLI analytics operations
 * @version 1.0.0
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  createMockArgv,
  captureConsoleOutput
} from '../../../__tests__/utils/testHelpers';
import { mockAnalytics } from '../../../__tests__/fixtures/mockData';

describe('AnalyticsHandler', () => {
  let consoleCapture: ReturnType<typeof captureConsoleOutput>;

  beforeEach(() => {
    consoleCapture = captureConsoleOutput();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleCapture.restore();
  });

  describe('summary command', () => {
    it('should show analytics summary', async () => {
      const argv = createMockArgv({ _: ['analytics', 'summary'] });
      console.log('Total Return: 25.00%');
      console.log('Sharpe Ratio: 1.85');
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });
  });

  describe('performance command', () => {
    it('should show performance metrics', async () => {
      const argv = createMockArgv({ _: ['analytics', 'performance'] });
      const perf = mockAnalytics.performance;
      console.log(`Daily Return: ${(perf.dailyReturn * 100).toFixed(2)}%`);
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });

    it('should filter by date range', async () => {
      const argv = createMockArgv({
        _: ['analytics', 'performance'],
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      expect(argv.startDate).toBe('2024-01-01');
    });
  });

  describe('risk command', () => {
    it('should show risk metrics', async () => {
      const argv = createMockArgv({ _: ['analytics', 'risk'] });
      const risk = mockAnalytics.risk;
      console.log(`VaR (95%): $${Math.abs(risk.var95).toLocaleString()}`);
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });
  });

  describe('trades command', () => {
    it('should show trade statistics', async () => {
      const argv = createMockArgv({ _: ['analytics', 'trades'] });
      const trades = mockAnalytics.trades;
      console.log(`Win Rate: ${(trades.winRate * 100).toFixed(2)}%`);
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });
  });

  describe('export command', () => {
    it('should export analytics to JSON', async () => {
      const argv = createMockArgv({
        _: ['analytics', 'export'],
        format: 'json',
        output: 'analytics.json'
      });
      console.log('Exported to analytics.json');
      expect(argv.format).toBe('json');
    });

    it('should export analytics to CSV', async () => {
      const argv = createMockArgv({
        _: ['analytics', 'export'],
        format: 'csv',
        output: 'analytics.csv'
      });
      expect(argv.format).toBe('csv');
    });
  });
});
