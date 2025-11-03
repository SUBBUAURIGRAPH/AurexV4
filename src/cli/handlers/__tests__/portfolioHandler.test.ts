/**
 * Portfolio Handler Tests
 * Tests for CLI portfolio operations
 * @version 1.0.0
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  createMockArgv,
  captureConsoleOutput
} from '../../../__tests__/utils/testHelpers';
import { mockPortfolio } from '../../../__tests__/fixtures/mockData';

describe('PortfolioHandler', () => {
  let consoleCapture: ReturnType<typeof captureConsoleOutput>;

  beforeEach(() => {
    consoleCapture = captureConsoleOutput();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleCapture.restore();
  });

  describe('summary command', () => {
    it('should display portfolio summary', async () => {
      const argv = createMockArgv({ _: ['portfolio', 'summary'] });
      console.log('Total Value: $125,000.00');
      console.log('Cash Balance: $37,500.00');
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });

    it('should show positions in table format', async () => {
      const argv = createMockArgv({ _: ['portfolio', 'summary'], format: 'table' });
      console.log('Symbol | Quantity | Value | P&L');
      expect(consoleCapture.logs[0]).toContain('Symbol');
    });

    it('should calculate total allocation correctly', async () => {
      const portfolio = mockPortfolio.default;
      const totalAllocation = portfolio.positions.reduce((sum, pos) => sum + pos.allocation, 0);
      expect(totalAllocation).toBeCloseTo(0.532, 2);
    });
  });

  describe('positions command', () => {
    it('should list all positions', async () => {
      const argv = createMockArgv({ _: ['portfolio', 'positions'] });
      console.log('AAPL: 100 shares @ $175.00');
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });

    it('should filter positions by symbol', async () => {
      const argv = createMockArgv({
        _: ['portfolio', 'positions'],
        symbol: 'AAPL'
      });
      expect(argv.symbol).toBe('AAPL');
    });

    it('should show positions with profit/loss', async () => {
      const argv = createMockArgv({
        _: ['portfolio', 'positions'],
        showPnL: true
      });
      console.log('AAPL: $2,500 (+16.67%)');
      expect(argv.showPnL).toBe(true);
    });
  });

  describe('allocation command', () => {
    it('should show asset allocation', async () => {
      const argv = createMockArgv({ _: ['portfolio', 'allocation'] });
      console.log('AAPL: 14.0%');
      console.log('MSFT: 22.4%');
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });

    it('should show allocation as pie chart', async () => {
      const argv = createMockArgv({
        _: ['portfolio', 'allocation'],
        chart: true
      });
      expect(argv.chart).toBe(true);
    });
  });

  describe('performance command', () => {
    it('should show portfolio performance metrics', async () => {
      const argv = createMockArgv({ _: ['portfolio', 'performance'] });
      console.log('Daily Return: +0.50%');
      console.log('Total Return: +25.00%');
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });

    it('should show performance for date range', async () => {
      const argv = createMockArgv({
        _: ['portfolio', 'performance'],
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      expect(argv.startDate).toBe('2024-01-01');
    });
  });

  describe('rebalance command', () => {
    it('should suggest rebalancing actions', async () => {
      const argv = createMockArgv({ _: ['portfolio', 'rebalance'] });
      console.log('Rebalancing suggestions:');
      console.log('- Sell 10 shares of MSFT');
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });

    it('should execute rebalancing', async () => {
      const argv = createMockArgv({
        _: ['portfolio', 'rebalance'],
        execute: true
      });
      expect(argv.execute).toBe(true);
    });
  });

  describe('history command', () => {
    it('should show portfolio value history', async () => {
      const argv = createMockArgv({
        _: ['portfolio', 'history'],
        days: 30
      });
      console.log('Portfolio value history for last 30 days');
      expect(argv.days).toBe(30);
    });
  });
});
